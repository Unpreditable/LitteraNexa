import { Query } from "./queries";

export interface Candidate {
  file: unknown;
  /** The note name or alias a query is matched against. */
  text: string;
  /** The alias this candidate is, or null for the note's name. */
  alias: string | null;
}

export interface Rankable extends Candidate {
  query: Query;
  result: { score: number; matches: [number, number][] };
}

/**
 * The rows to show, the note covering the most typed text first, each note's rows together.
 *
 * A matching note shows its name, the alias that matched best, and then its other aliases as
 * extras — the ones that also matched first, then the rest — up to `extraAliases` of them.
 *
 * When one name matched several queries the longer query wins, so picking it replaces all the
 * typed text it covers — but only when its leading words start words of the name, so a loose fuzzy
 * match never swallows typed words that aren't part of the name.
 */
export function rank<C extends Candidate, M extends C & Rankable>(
  matches: M[],
  candidates: C[] = [],
  extraAliases = Infinity,
): M[] {
  const notes = new Map<unknown, Map<string, M>>();
  for (const match of matches) {
    let rows = notes.get(match.file);
    if (!rows) notes.set(match.file, (rows = new Map<string, M>()));
    const current = rows.get(rowKey(match));
    if (!current || compareWithinNote(match, current) < 0) rows.set(rowKey(match), match);
  }

  // Grouped once rather than filtered per note: with the whole vault in scope, both lists are long.
  const byNote = new Map<unknown, C[]>();
  for (const candidate of candidates) {
    if (!notes.has(candidate.file)) continue;
    const own = byNote.get(candidate.file);
    if (own) own.push(candidate);
    else byNote.set(candidate.file, [candidate]);
  }

  const groups = [...notes.entries()].map(([file, rows]) =>
    noteRows([...rows.values()], byNote.get(file) ?? [], extraAliases),
  );
  groups.sort((a, b) => compareAcrossNotes(a[0], b[0]));
  return groups.flat();
}

/** One note's rows: its best row, its name or matched alias, then the extras. */
function noteRows<C extends Candidate, M extends C & Rankable>(matched: M[], own: C[], extraAliases: number): M[] {
  matched.sort(compareWithinNote);
  const best = matched[0];
  const offer = (c: C) => ({ ...c, query: best.query, result: { score: -Infinity, matches: [] } }) as unknown as M;

  const shown = new Set(matched.map(rowKey));
  const unmatched = own.filter((c) => !shown.has(rowKey(c)));

  const [primary, ...alsoMatched] = matched.filter((row) => row.alias !== null);
  const name = matched.find((row) => row.alias === null) ?? unmatched.filter((c) => c.alias === null).map(offer)[0];
  const head = [name, primary].filter((row): row is M => row !== undefined);
  // The offered name has no score to compare, so it only ever follows the matched alias.
  if (head.length === 2 && head[0].result.score !== -Infinity) head.sort(compareWithinNote);
  else if (head.length === 2) head.reverse();

  const extras = [...alsoMatched, ...unmatched.filter((c) => c.alias !== null).map(offer)];
  return [...head, ...extras.slice(0, extraAliases)];
}

/** Tells a note's name from an alias spelled the same. */
function rowKey(row: Candidate): string {
  return `${row.alias === null ? "name" : "alias"}:${row.text}`;
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
