import { App, TAbstractFile, TFolder } from "obsidian";
import { LinkFormat } from "./folder-links";

/*
 * The one place folder links read Obsidian's internals: the vault's link-format config and,
 * for revealing a folder, the Files core plugin.
 */

const LINK_FORMATS: readonly LinkFormat[] = ["shortest", "relative", "absolute"];

/** Settings → Files and links → New link format. Internal config key; "shortest" if unreadable. */
export function linkFormat(app: App): LinkFormat {
  const vault = app.vault as unknown as { getConfig?: (key: string) => unknown };
  const value = typeof vault.getConfig === "function" ? vault.getConfig("newLinkFormat") : undefined;
  return LINK_FORMATS.find((format) => format === value) ?? "shortest";
}

interface FileExplorerPlugin {
  revealInFolder(file: TAbstractFile): void;
}

/**
 * Shows the folder in the file explorer, opening the sidebar and expanding its parents. False when
 * the Files core plugin is off, or its internal reveal is no longer there.
 */
export function revealFolder(app: App, folder: TFolder): boolean {
  const plugins = (app as unknown as { internalPlugins?: { getEnabledPluginById?: (id: string) => unknown } })
    .internalPlugins;
  const explorer = plugins?.getEnabledPluginById?.("file-explorer") as Partial<FileExplorerPlugin> | null | undefined;
  if (typeof explorer?.revealInFolder !== "function") return false;
  explorer.revealInFolder(folder);
  return true;
}
