/** One folder in a scope list. */
export interface FolderEntry {
  path: string;
  /** Whether notes below the folder count, not only the ones directly in it. */
  subfolders: boolean;
}

export type ScopeMode = "vault" | "folders";

/** How many of a matching note's other aliases are offered as rows. */
export type ExtraAliases = "0" | "1" | "2" | "all";

/**
 * How a typed word must fit a word of a note's name: from its start, from its first letter with
 * letters left out, as a run of letters anywhere in it, as letters in order anywhere in it, or from
 * its start give or take a typo.
 */
export type MatchRule = "prefix" | "anchored" | "substring" | "subsequence" | "typos";

export interface LitteraNexaSettings {
  /** Which list below is in force. Both lists persist whichever mode is active. */
  scopeMode: ScopeMode;
  /** Folders suggested from under "folders". */
  includedFolders: FolderEntry[];
  /** Folders left out under "vault". */
  excludedFolders: FolderEntry[];
  /** Only a word starting with a capital letter or a digit can start a query. */
  capitalOnly: boolean;
  /** Fewest letters and digits a query needs before suggestions appear. */
  minCharacters: number;
  /** Most words a query may span, counting the one at the cursor. */
  maxWords: number;
  inCodeBlocks: boolean;
  inInlineCode: boolean;
  inMathBlocks: boolean;
  inInlineMath: boolean;
  inComments: boolean;
  inFrontmatter: boolean;
  /** Applied to each typed word separately. */
  matchRule: MatchRule;
  extraAliases: ExtraAliases;
}

export const MIN_CHARACTERS_RANGE = { min: 1, max: 6 };
export const MAX_WORDS_RANGE = { min: 1, max: 5 };

const SCOPE_MODES: readonly ScopeMode[] = ["vault", "folders"];
export const MATCH_RULES: readonly MatchRule[] = ["prefix", "anchored", "substring", "subsequence", "typos"];
const EXTRA_ALIASES: readonly ExtraAliases[] = ["0", "1", "2", "all"];

export const DEFAULT_SETTINGS: LitteraNexaSettings = {
  scopeMode: "vault",
  includedFolders: [],
  excludedFolders: [],
  capitalOnly: true,
  minCharacters: 3,
  maxWords: 3,
  inCodeBlocks: false,
  inInlineCode: false,
  inMathBlocks: false,
  inInlineMath: false,
  inComments: false,
  inFrontmatter: false,
  matchRule: "anchored",
  extraAliases: "all",
};

/**
 * The settings for whatever data.json holds. That file is what an earlier version or a hand edit
 * left, not a trusted shape, so each field is taken only if it is valid and defaults otherwise.
 */
export function mergeSettings(stored: unknown): LitteraNexaSettings {
  const s = isRecord(stored) ? stored : {};
  const d = DEFAULT_SETTINGS;
  return {
    scopeMode: oneOf(s.scopeMode, SCOPE_MODES, d.scopeMode),
    includedFolders: folderList(s.includedFolders),
    excludedFolders: folderList(s.excludedFolders),
    capitalOnly: bool(s.capitalOnly, d.capitalOnly),
    minCharacters: whole(s.minCharacters, MIN_CHARACTERS_RANGE, d.minCharacters),
    maxWords: whole(s.maxWords, MAX_WORDS_RANGE, d.maxWords),
    inCodeBlocks: bool(s.inCodeBlocks, d.inCodeBlocks),
    inInlineCode: bool(s.inInlineCode, d.inInlineCode),
    inMathBlocks: bool(s.inMathBlocks, d.inMathBlocks),
    inInlineMath: bool(s.inInlineMath, d.inInlineMath),
    inComments: bool(s.inComments, d.inComments),
    inFrontmatter: bool(s.inFrontmatter, d.inFrontmatter),
    matchRule: oneOf(s.matchRule, MATCH_RULES, d.matchRule),
    extraAliases: oneOf(s.extraAliases, EXTRA_ALIASES, d.extraAliases),
  };
}

/** The most extra alias rows a note may show. */
export function extraAliasLimit(value: ExtraAliases): number {
  return value === "all" ? Infinity : Number(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function whole(value: unknown, range: { min: number; max: number }, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= range.min && value <= range.max
    ? value
    : fallback;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.find((option) => option === value) ?? fallback;
}

function folderList(value: unknown): FolderEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: FolderEntry[] = [];
  for (const item of value as unknown[]) {
    if (isRecord(item) && typeof item.path === "string") {
      entries.push({ path: item.path, subfolders: bool(item.subfolders, true) });
    }
  }
  return entries;
}
