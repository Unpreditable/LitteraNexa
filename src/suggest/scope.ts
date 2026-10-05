import { FolderEntry, LitteraNexaSettings } from "../settings";

export type ScopeSettings = Pick<LitteraNexaSettings, "scopeMode" | "includedFolders" | "excludedFolders">;

/** Whether the note at this vault path is one to suggest. */
export function inScope(notePath: string, settings: ScopeSettings): boolean {
  const slash = notePath.lastIndexOf("/");
  const folder = slash < 0 ? "" : notePath.slice(0, slash);
  return settings.scopeMode === "vault"
    ? !settings.excludedFolders.some((entry) => covers(entry, folder))
    : settings.includedFolders.some((entry) => covers(entry, folder));
}

/** Whether a scope entry covers notes sitting in `folder` ("" for the vault root). */
function covers(entry: FolderEntry, folder: string): boolean {
  const typed = entry.path.trim();
  // A row the user has only just added.
  if (typed === "") return false;
  // "/" is the vault root, which is "" once the slashes are gone.
  const path = typed.replace(/^\/+|\/+$/g, "");
  if (folder === path) return true;
  return entry.subfolders && (path === "" || folder.startsWith(`${path}/`));
}
