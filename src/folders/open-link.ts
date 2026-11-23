import { around } from "monkey-around";
import { Notice, Plugin, TFolder } from "obsidian";
import { FolderIndex } from "./folder-index";
import { t } from "../i18n/i18n";
import { folderLinkPath, resolveFolder } from "./folder-links";
import { revealFolder } from "./internals";

/**
 * Routes folder links (`[[Clients/]]`) to the file explorer. Every way of opening a link — a click
 * in either view, Ctrl+click, middle-click, the graph, "Open link under cursor" — goes through
 * `workspace.openLinkText`, so wrapping it is the one place none of them can slip past and create
 * an empty note. Embeds, the hover popup's "click to create" and the outgoing links pane all reach
 * it too. Hover previews of folder links are dropped. Any other link goes to Obsidian unchanged.
 * `around` keeps a wrapper another plugin installs after this one intact when this one unloads.
 */
export function installFolderLinkOpener(plugin: Plugin, index: FolderIndex<{ path: string }>): void {
  const app = plugin.app;
  plugin.register(
    around(app.workspace, {
      openLinkText: (original) =>
        async function (this: unknown, linktext: string, sourcePath: string, ...rest: unknown[]): Promise<void> {
          const linkPath = folderLinkPath(linktext);
          if (linkPath === null) return original.call(this, linktext, sourcePath, ...rest);
          const found = resolveFolder(linkPath, sourcePath, index.lookup());
          const folder = found === null ? null : app.vault.getFolderByPath(found);
          // A new tab has nothing to show for a folder, so every way of opening it reveals it.
          if (!(folder instanceof TFolder)) new Notice(t("notices.folderNotFound", { path: linkPath }));
          else if (!revealFolder(app, folder)) new Notice(t("notices.noFileExplorer"));
        },
      // Hovering a link fires "hover-link", which Page preview answers with a popup. For a folder
      // that popup can only say "not created yet", so the event is dropped for folder links.
      trigger: (original) =>
        function (this: unknown, name: string, ...data: unknown[]): void {
          if (name === "hover-link" && isFolderHover(data[0])) return;
          original.call(this, name, ...data);
        },
    }),
  );
}

function isFolderHover(info: unknown): boolean {
  const linktext = (info as { linktext?: unknown } | undefined)?.linktext;
  return typeof linktext === "string" && folderLinkPath(linktext) !== null;
}
