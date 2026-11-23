import { FolderLookup, isLinkableFolder } from "./folder-links";

/**
 * The vault's folders, read once and kept until a folder is created, renamed or deleted, so the
 * suggester and the link drawing don't walk the vault on every keystroke. Sorted by path, so
 * same-named folders keep a steady order; folders whose path can't be written inside a wikilink
 * are left out.
 */
export class FolderIndex<F extends { path: string }> {
  /** Goes up on every change, so a cache built from the index can tell it is stale. */
  version = 0;
  private cachedFolders: F[] | null = null;
  private cachedLookup: FolderLookup | null = null;

  constructor(private readonly load: () => F[]) {}

  folders(): F[] {
    this.cachedFolders ??= this.load()
      .filter((folder) => isLinkableFolder(folder.path))
      .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    return this.cachedFolders;
  }

  /** The folders' paths, indexed for resolving links. */
  lookup(): FolderLookup {
    this.cachedLookup ??= new FolderLookup(this.folders().map((folder) => folder.path));
    return this.cachedLookup;
  }

  invalidate(): void {
    this.version++;
    this.cachedFolders = null;
    this.cachedLookup = null;
  }
}
