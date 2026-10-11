import { App, EditorSuggest } from "obsidian";

/** As much of Obsidian's suggester manager as the plugin reads. */
export interface SuggestManager {
  /** Every registered suggester, in the order Obsidian asks them. */
  suggests: unknown[];
  /** The one whose menu was last shown. */
  currentSuggest: unknown;
}

/**
 * Obsidian's suggester manager, or null where it no longer has this shape. Internal API, and all
 * or nothing: asking first without being able to see an open menu would replace every one of them.
 */
export function suggestManager(app: App): SuggestManager | null {
  const manager = (app.workspace as unknown as { editorSuggest?: unknown }).editorSuggest;
  if (typeof manager !== "object" || manager === null) return null;
  if (!("currentSuggest" in manager) || !("suggests" in manager) || !Array.isArray(manager.suggests)) return null;
  return manager as SuggestManager;
}

/** Whether a suggester's menu is showing, or null where Obsidian no longer says. */
export function menuOpen(suggest: EditorSuggest<unknown>): boolean | null {
  const open = (suggest as unknown as { isOpen?: unknown }).isOpen;
  return typeof open === "boolean" ? open : null;
}
