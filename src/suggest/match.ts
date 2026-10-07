import { MatchRule } from "../settings";

/** The shape Obsidian's renderResults takes: a higher score is a better match. */
export interface WordMatch {
  score: number;
  /** The matched letters as [start, end) ranges of the text, in order. */
  matches: [number, number][];
}

interface Word {
  /** Lowercase and without accents, for comparing. */
  folded: string;
  /** For each character of `folded`, the range of the text it came from. */
  ranges: [number, number][];
}

interface Fit {
  tier: number;
  /** Which characters of the folded word the typed ones landed on. */
  at: number[];
}

// How tightly a typed word fits a word of the name.
const EXACT = 3;
const START = 2;
const PART = 1;
const SCATTERED = 0;

/**
 * Matches typed text against a note name or alias, word by word: every typed word must fit a
 * different word of the name, in the name's order, and words of the name may be skipped. Words are
 * split on whitespace only, so typed letters never match across a space. `rule` says what fitting a
 * word means, and applies to each word on its own.
 *
 * The score puts tighter fits first, then names with fewer unmatched words, then shorter names.
 */
export function matchWords(query: string, text: string, rule: MatchRule): WordMatch | null {
  const typed = fold(query).split(/\s+/).filter(Boolean);
  const words = splitWords(text);
  if (typed.length === 0 || typed.length > words.length) return null;

  const fits = typed.map((word) => words.map((target) => fitWord(word, target.folded, rule)));

  // best[i][j]: the highest total tier for typed words i… against name words j…, -Infinity for none.
  const best = typed.map(() => words.map(() => -Infinity));
  const bestAt = (i: number, j: number) => (i === typed.length ? 0 : j === words.length ? -Infinity : best[i][j]);
  const taking = (i: number, j: number) => (fits[i][j] ? fits[i][j].tier + bestAt(i + 1, j + 1) : -Infinity);
  for (let i = typed.length - 1; i >= 0; i--) {
    for (let j = words.length - 1; j >= 0; j--) best[i][j] = Math.max(taking(i, j), bestAt(i, j + 1));
  }
  if (best[0][0] === -Infinity) return null;

  // Walked from the start, so of equally tight ways the one using the earlier words is taken.
  const matches: [number, number][] = [];
  for (let i = 0, j = 0; i < typed.length; j++) {
    const fit = fits[i][j];
    if (!fit || taking(i, j) < best[i][j]) continue;
    for (const at of fit.at) {
      const [start, end] = words[j].ranges[at];
      const last = matches[matches.length - 1];
      if (matches.length > 0 && start <= last[1]) last[1] = Math.max(last[1], end);
      else matches.push([start, end]);
    }
    i++;
  }

  const unmatched = Math.min(words.length - typed.length, 99);
  return { score: best[0][0] * 1e6 - unmatched * 1e4 - Math.min(text.length, 9999), matches };
}

function fitWord(typed: string, word: string, rule: MatchRule): Fit | null {
  if (word.startsWith(typed)) return { tier: typed.length === word.length ? EXACT : START, at: run(0, typed.length) };
  if (rule === "typos") return fitWithTypos(typed, word);
  if (rule === "prefix" || typed.length > word.length) return null;

  if (rule !== "anchored") {
    const from = word.indexOf(typed);
    if (from >= 0) return { tier: PART, at: run(from, typed.length) };
    if (rule === "substring") return null;
  } else if (typed[0] !== word[0]) {
    return null;
  }

  const at: number[] = [];
  let next = 0;
  for (let i = 0; i < typed.length; i++) {
    next = word.indexOf(typed[i], next);
    if (next < 0) return null;
    at.push(next++);
  }
  return { tier: SCATTERED, at };
}

/**
 * The typed word against the start of the word, a few typos apart: a wrong, missing, extra or
 * swapped letter each count as one. The first letter must be right, and the longer the typed word
 * the more typos it may have — a short one with a typo allowed would fit nearly any word.
 */
function fitWithTypos(typed: string, word: string): Fit | null {
  const allowed = typed.length <= 3 ? 0 : typed.length <= 7 ? 1 : 2;
  if (allowed === 0 || typed[0] !== word[0]) return null;

  // No start longer than this can be within the allowance.
  const width = Math.min(word.length, typed.length + allowed);
  // Rows of the edit-distance table, one per typed letter: row[j] is the distance to the word's first j letters.
  let above: number[] = [];
  let row = run(0, width + 1);
  for (let i = 1; i <= typed.length; i++) {
    const next = [i];
    for (let j = 1; j <= width; j++) {
      let distance = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (typed[i - 1] === word[j - 1] ? 0 : 1));
      const swapped = i > 1 && j > 1 && typed[i - 1] === word[j - 2] && typed[i - 2] === word[j - 1];
      if (swapped) distance = Math.min(distance, above[j - 2] + 1);
      next.push(distance);
    }
    above = row;
    row = next;
  }

  // The closest start; of equally close ones, the one nearest the typed word's length.
  let length = 0;
  for (let j = 1; j <= width; j++) {
    const closer = row[j] - row[length] || Math.abs(j - typed.length) - Math.abs(length - typed.length);
    if (closer < 0) length = j;
  }
  // One typo ranks below a plain start of a word, two below one.
  return row[length] <= allowed ? { tier: START - row[length], at: run(0, length) } : null;
}

function run(from: number, length: number): number[] {
  return Array.from({ length }, (_, i) => from + i);
}

function splitWords(text: string): Word[] {
  const words: Word[] = [];
  const pattern = /\S+/g;
  for (let found = pattern.exec(text); found; found = pattern.exec(text)) {
    let folded = "";
    const ranges: [number, number][] = [];
    let start = found.index;
    for (const char of found[0]) {
      const end = start + char.length;
      const plain = fold(char);
      // A combining accent written as its own character stays with the letter before it.
      if (plain === "" && ranges.length > 0) ranges[ranges.length - 1][1] = end;
      for (let i = 0; i < plain.length; i++) ranges.push([start, end]);
      folded += plain;
      start = end;
    }
    if (folded) words.push({ folded, ranges });
  }
  return words;
}

/** Lowercase, with the accents taken off. */
function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}
