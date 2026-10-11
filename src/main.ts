import { Plugin } from "obsidian";
import { LitteraNexaSettings, mergeSettings } from "./settings";
import { LitteraNexaSettingTab } from "./settings/settings-tab";
import { menuOpen, suggestManager } from "./suggest/manager";
import { NoteSuggest } from "./suggest/NoteSuggest";

export default class LitteraNexaPlugin extends Plugin {
  settings: LitteraNexaSettings = mergeSettings(null);

  async onload(): Promise<void> {
    this.settings = mergeSettings(await this.loadData());
    this.addSettingTab(new LitteraNexaSettingTab(this.app, this));
    const suggest = new NoteSuggest(this.app, () => this.settings);
    this.registerEditorSuggest(suggest);
    this.askFirst(suggest);
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
