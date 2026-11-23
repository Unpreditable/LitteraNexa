import { MarkdownPostProcessor } from "obsidian";
import { FolderIndex } from "./folder-index";
import { folderLinkPath, resolveFolder } from "./folder-links";

/** The class that draws a folder link as a resolved link; styles.css says how. */
export const FOLDER_LINK_CLASS = "littera-nexa-folder-link";

/**
 * Reading view, and anything else Obsidian renders from markdown (a live-preview table cell, an
 * embed): a link to a folder that exists loses the unresolved look Obsidian gave it.
 */
export function folderLinkPostProcessor(index: FolderIndex<{ path: string }>): MarkdownPostProcessor {
  return (el, ctx) => refreshFolderLinks(el, ctx.sourcePath, index);
}

/**
 * Brings every rendered folder link under `root` in line with the vault: resolved-looking when its
 * folder exists, unresolved when it doesn't. Run on new renders and, after a folder changes, on
 * what is already on screen, which Obsidian doesn't render again by itself.
 */
export function refreshFolderLinks(root: HTMLElement, sourcePath: string, index: FolderIndex<{ path: string }>): void {
  for (const link of Array.from(root.querySelectorAll<HTMLAnchorElement>("a.internal-link"))) {
    const linkPath = folderLinkPath(link.dataset.href ?? "");
    if (linkPath === null) continue;
    const found = resolveFolder(linkPath, sourcePath, index.lookup()) !== null;
    link.toggleClass(FOLDER_LINK_CLASS, found);
    link.toggleClass("is-unresolved", !found);
  }
}
