import { debounce, MarkdownView, Plugin, TAbstractFile, TFolder } from "obsidian";
import { FolderIndex } from "./folders/folder-index";
import { folderLinkExtension } from "./folders/live-preview";
import { installFolderLinkOpener } from "./folders/open-link";
import { folderLinkPostProcessor, refreshFolderLinks } from "./folders/reading-view";
import { LitteraNexaSettings, mergeSettings } from "./settings";
import { LitteraNexaSettingTab } from "./settings/settings-tab";
import { menuOpen, suggestManager } from "./suggest/manager";
import { NoteSuggest } from "./suggest/NoteSuggest";

export default class LitteraNexaPlugin extends Plugin {
  settings: LitteraNexaSettings = mergeSettings(null);

  async onload(): Promise<void> {
    this.settings = mergeSettings(await this.loadData());
    this.addSettingTab(new LitteraNexaSettingTab(this.app, this));
    const folders = new FolderIndex(() => this.app.vault.getAllFolders(false));
    const suggest = new NoteSuggest(this.app, () => this.settings, folders);
    this.registerEditorSuggest(suggest);
    this.askFirst(suggest);
    installFolderLinkOpener(this, folders);
    this.registerMarkdownPostProcessor(folderLinkPostProcessor(folders));
    this.registerEditorExtension(folderLinkExtension(folders));
    // A folder appearing or going changes which folder links resolve: the index is read again, and
    // open notes redraw theirs. The redraw waits until the vault has loaded, which fires "create"
    // for every folder it already has, and is debounced, since renaming a folder fires once for
    // each folder inside it too.
    let loaded = false;
    this.app.workspace.onLayoutReady(() => (loaded = true));
    const redrawSoon = debounce(() => this.redrawFolderLinks(folders), 100, true);
    const changed = (file: TAbstractFile) => {
      if (!(file instanceof TFolder)) return;
      folders.invalidate();
      if (loaded) redrawSoon();
    };
    this.registerEvent(this.app.vault.on("create", changed));
    this.registerEvent(this.app.vault.on("delete", changed));
    this.registerEvent(this.app.vault.on("rename", changed));
  }

  /**
   * Live preview redraws through a reconfigure. What Obsidian rendered from markdown — reading view,
   * live-preview table cells and embeds — is brought up to date in place.
   */
  private redrawFolderLinks(folders: FolderIndex<TFolder>): void {
    this.app.workspace.updateOptions();
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.file) refreshFolderLinks(view.containerEl, view.file.path, folders);
    }
  }

  /**
   * Obsidian asks the suggesters in the order they registered and stops at the first that triggers,
   * so one registered earlier that always has rows, like Tasks on a task line, would keep this one
   * from ever being asked. Only where the suggester can also see a menu that is already open, which
   * is what keeps it from replacing every one; otherwise it stays where it registered.
   */
  private askFirst(suggest: NoteSuggest): void {
    const suggests = suggestManager(this.app)?.suggests;
    if (!suggests || menuOpen(suggest) === null) return;
    const at = suggests.indexOf(suggest);
    if (at <= 0) return;
    suggests.splice(at, 1);
    suggests.unshift(suggest);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  onunload(): void {}
}
