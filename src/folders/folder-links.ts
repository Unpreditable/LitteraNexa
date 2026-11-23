/** How Obsidian writes new links: Settings → Files and links → New link format. */
export type LinkFormat = "shortest" | "relative" | "absolute";

/**
 * The folder path a link points at, without its trailing slash, or null for a link that is not a
 * folder link. A folder link is one whose path ends in "/" before any heading or block part.
 */
export function folderLinkPath(linktext: string): string | null {
  // Display text, escaped or not inside a table, then a heading or block reference.
  const path = linktext.split(/\\?\|/)[0].split(/[#^]/)[0].trim();
  if (!path.endsWith("/")) return null;
  // "./" is the note's own folder; "/" alone would be the vault root, which is never a target.
  if (path === "./") return ".";
  const trimmed = path.replace(/\/+$/, "");
  return trimmed === "" ? null : trimmed;
}

/** A wikilink's place in a text and what is between its brackets. */
export interface WikilinkMatch {
  start: number;
  end: number;
  inner: string;
}

// One line only: a stray "[[" must not pair with a "]]" lines further down.
const WIKILINK = /\[\[([^[\]\n]+)\]\]/g;

/** Every `[[…]]` in the text, embeds' included (the "!" before one is not part of the match). */
export function findWikilinks(text: string): WikilinkMatch[] {
  return [...text.matchAll(WIKILINK)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    inner: match[1],
  }));
}

/** Whether a folder's path can be written inside a wikilink and read back as the same path. */
export function isLinkableFolder(path: string): boolean {
  return path !== "" && !/[#^|]|\[\[|\]\]/.test(path);
}

/**
 * The vault's folder paths, indexed for lookups: by whole path and by last name, each ignoring
 * case. Resolving a link then looks at the folders that could match, not at every folder.
 */
export class FolderLookup {
  private readonly byPath = new Map<string, string[]>();
  private readonly byName = new Map<string, string[]>();

  constructor(readonly paths: readonly string[]) {
    for (const path of paths) {
      push(this.byPath, path.toLowerCase(), path);
      push(this.byName, path.slice(path.lastIndexOf("/") + 1).toLowerCase(), path);
    }
  }

  /** Folders at exactly this path, in any case. */
  at(path: string): readonly string[] {
    return this.byPath.get(path.toLowerCase()) ?? [];
  }

  /** Folders whose path ends with these whole segments, in any case. */
  endingWith(tail: string): string[] {
    const lower = tail.toLowerCase();
    const named = this.byName.get(lower.slice(lower.lastIndexOf("/") + 1)) ?? [];
    return named.filter((path) => `/${path.toLowerCase()}`.endsWith(`/${lower}`));
  }
}

export function folderLookup(folders: readonly string[]): FolderLookup {
  return new FolderLookup(folders);
}

function push(map: Map<string, string[]>, key: string, value: string): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function asLookup(folders: readonly string[] | FolderLookup): FolderLookup {
  return folders instanceof FolderLookup ? folders : new FolderLookup(folders);
}

/**
 * The vault folder a folder link resolves to, or null. Tried in order: the path from the vault
 * root, the path from the source note's folder, then any folder whose path ends with it — the one
 * nearest the note when there are several. A path starting with "./" or "../" is only ever read
 * from the note's folder. Case is ignored, an exact-case match winning at each step.
 */
export function resolveFolder(
  linkPath: string,
  sourcePath: string,
  folders: readonly string[] | FolderLookup,
): string | null {
  const lookup = asLookup(folders);
  const from = parentOf(sourcePath);
  const explicit = linkPath === "." || linkPath === ".." || /^\.\.?\//.test(linkPath);
  const absolute = explicit ? null : normalize(linkPath);
  if (absolute !== null) {
    const found = pick(lookup.at(absolute), absolute);
    if (found) return found;
  }
  const relative = normalize(from === "" ? linkPath : `${from}/${linkPath}`);
  if (relative !== null) {
    const found = pick(lookup.at(relative), relative);
    if (found) return found;
  }
  if (absolute === null || absolute === "" || absolute.startsWith("..")) return null;
  const candidates = lookup.endingWith(absolute);
  const exact = candidates.filter((f) => `/${f}`.endsWith(`/${absolute}`));
  return nearest(exact.length > 0 ? exact : candidates, from);
}

/** The text of a link to `folderPath`, ending in "/", written in the given format. */
export function folderLinkText(
  folderPath: string,
  sourcePath: string,
  folders: readonly string[] | FolderLookup,
  format: LinkFormat,
): string {
  const lookup = asLookup(folders);
  if (format === "absolute") return `${folderPath}/`;
  if (format === "relative") {
    const relative = relativePath(parentOf(sourcePath), folderPath);
    if (relative.startsWith("..")) return `${relative}/`;
    // Written "./" where the plain form would be read from the vault root first and find another
    // folder, and for the note's own folder, which has no plain form.
    const plain = relative === "" ? null : resolveFolder(relative, sourcePath, lookup);
    return plain === folderPath ? `${relative}/` : `./${relative === "" ? "" : `${relative}/`}`;
  }
  const segments = folderPath.split("/");
  for (let n = 1; n < segments.length; n++) {
    const tail = segments.slice(-n).join("/");
    if (lookup.endingWith(tail).every((f) => f === folderPath)) return `${tail}/`;
  }
  return `${folderPath}/`;
}

function parentOf(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash < 0 ? "" : path.slice(0, slash);
}

/** A path with "." and ".." applied, or null when ".." climbs above the vault root. */
function normalize(path: string): string | null {
  const out: string[] = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (out.length === 0) return null;
      out.pop();
    } else out.push(part);
  }
  return out.join("/");
}

/** The exact-case match among same-path folders, else the first. */
function pick(matches: readonly string[], path: string): string | null {
  return matches.find((f) => f === path) ?? matches[0] ?? null;
}

/** The folder sharing the most leading segments with `from`, ties alphabetical. */
function nearest(folders: string[], from: string): string | null {
  const base = from === "" ? [] : from.split("/");
  let best: string | null = null;
  let bestShared = -1;
  for (const folder of [...folders].sort()) {
    const parts = folder.split("/");
    let shared = 0;
    while (shared < parts.length && shared < base.length && parts[shared] === base[shared]) shared++;
    if (shared > bestShared) {
      best = folder;
      bestShared = shared;
    }
  }
  return best;
}

function relativePath(from: string, to: string): string {
  const a = from === "" ? [] : from.split("/");
  const b = to.split("/");
  let shared = 0;
  while (shared < a.length && shared < b.length && a[shared] === b[shared]) shared++;
  return [...Array<string>(a.length - shared).fill(".."), ...b.slice(shared)].join("/");
}
