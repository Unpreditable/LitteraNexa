export interface Query {
  text: string;
  startCh: number;
}

export interface QueryOptions {
  capitalOnly: boolean;
  minLetters: number;
  maxWords: number;
}

// Letters, digits, and the apostrophes and hyphen that stay inside a word (O'Brien, Jean-Luc).
const WORD_CHAR = /[\p{L}\p{N}'’-]/u;
const ALNUM = /[\p{L}\p{N}]/u;
const SPACE = /\s/;

/**
 * Candidate search texts for the text before the cursor: one per word in the lookback range that
 * can start a query, each running from that word's first letter or digit up to the cursor.
 */
export function findQueries(before: string, after: string, opts: QueryOptions): Query[] {
  // Whitespace after the last word keeps the popup open but is not searched for.
  const typed = before.trimEnd();
  if (after.length > 0 && ALNUM.test(after[0])) return [];
  if (typed.length === 0 || !WORD_CHAR.test(typed[typed.length - 1])) return [];
  // An open [ covers both an open [[ and the text of a markdown link.
  if (typed.lastIndexOf("[") > typed.lastIndexOf("]")) return [];
  if (typed.split("`").length % 2 === 0) return [];
  if (typed.replace(/\\\$/g, "").split("$").length % 2 === 0) return [];

  const queries: Query[] = [];
  let end = typed.length;
  for (let words = 0; words < opts.maxWords; words++) {
    let start = end;
    while (start > 0 && WORD_CHAR.test(typed[start - 1])) start--;

    // Text glued to the word without whitespace: a tag's # or a URL's path ends the lookback here.
    let chunk = start;
    while (chunk > 0 && !SPACE.test(typed[chunk - 1])) chunk--;
    const glued = typed.slice(chunk, start);
    if (glued.endsWith("#") || glued.includes("/")) break;

    const firstAt = typed.slice(start, end).search(ALNUM);
    if (firstAt >= 0) {
      const startCh = start + firstAt;
      const text = typed.slice(startCh);
      // A leading digit counts as a capital, so 3Mxx searches for "3Mxx", never "Mxx".
      const capital = /[\p{Lu}\p{N}]/u.test(typed[startCh]);
      if ((capital || !opts.capitalOnly) && countCharacters(text) >= opts.minLetters) {
        queries.push({ text, startCh });
      }
    }

    // Only whitespace may separate this word from the previous one; anything else ends the lookback.
    let prev = start;
    while (prev > 0 && SPACE.test(typed[prev - 1])) prev--;
    if (prev === start || prev === 0 || !WORD_CHAR.test(typed[prev - 1])) break;
    end = prev;
  }

  return queries.sort((a, b) => a.startCh - b.startCh);
}

/** Letters and digits; spaces and punctuation don't count towards the minimum. */
function countCharacters(text: string): number {
  return text.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
}
