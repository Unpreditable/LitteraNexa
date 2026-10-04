import { Query } from "./queries";

export interface Candidate {
  file: unknown;
  /** The note name or alias a query is matched against. */
  text: string;
}

export interface Rankable extends Candidate {
  query: Query;
  result: { score: number; matches: [number, number][] };
}

/**
 * The rows to show, the note covering the most typed text first, each note's rows together. A note gets a row for every name
 * or alias that matched, then one for each of its other candidates, so any of them can be picked
 * once the note is found.
 *
 * When one name matched several queries the longer query wins, so picking it replaces all the
 * typed text it covers — but only when its leading words start words of the name, so a loose fuzzy
 * match never swallows typed words that aren't part of the name.
 */
export function rank<C extends Candidate, M extends C & Rankable>(matches: M[], candidates: C[] = []): M[] {
  const notes = new Map<unknown, Map<string, M>>();
  for (const match of matches) {
    let rows = notes.get(match.file);
    if (!rows) notes.set(match.file, (rows = new Map<string, M>()));
    const current = rows.get(match.text);
    if (!current || compareWithinNote(match, current) < 0) rows.set(match.text, match);
  }

  const groups = [...notes.values()].map((rows) => [...rows.values()].sort(compareWithinNote));
  groups.sort((a, b) => compareAcrossNotes(a[0], b[0]));

  return groups.flatMap((rows) => {
    const [best] = rows;
    const shown = new Set(rows.map((row) => row.text));
    const others = candidates
      .filter((c) => c.file === best.file && !shown.has(c.text))
      .map((c) => ({ ...c, query: best.query, result: { score: -Infinity, matches: [] } }) as unknown as M);
    return [...rows, ...others];
  });
}

function compareWithinNote(a: Rankable, b: Rankable): number {
  return (
    Number(wordAligned(b)) - Number(wordAligned(a)) ||
    b.query.text.length - a.query.text.length ||
    b.result.score - a.result.score
  );
}

/** Whether every query word but the last starts a word of the matched text, in order. */
function wordAligned(match: Rankable): boolean {
  const leading = words(match.query.text).slice(0, -1);
  const target = words(match.text);
  let t = 0;
  for (const word of leading) {
    while (t < target.length && !target[t].startsWith(word)) t++;
    if (t === target.length) return false;
    t++;
  }
  return true;
}

function words(text: string): string[] {
  return text.toLowerCase().split(/\s+/).filter(Boolean);
}

// Scores from queries of different lengths aren't comparable, so the note covering more of the typed
// text goes first and the score only settles notes found by the same length of query.
function compareAcrossNotes(a: Rankable, b: Rankable): number {
  return b.query.text.length - a.query.text.length || b.result.score - a.result.score;
}
