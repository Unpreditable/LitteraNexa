import { Plugin } from "obsidian";
import { LitteraNexaSettings, mergeSettings } from "./settings";
import { LitteraNexaSettingTab } from "./settings/settings-tab";
import { NoteSuggest } from "./suggest/NoteSuggest";

export default class LitteraNexaPlugin extends Plugin {
  settings: LitteraNexaSettings = mergeSettings(null);

  async onload(): Promise<void> {
    this.settings = mergeSettings(await this.loadData());
    this.addSettingTab(new LitteraNexaSettingTab(this.app, this));
    this.registerEditorSuggest(new NoteSuggest(this.app, () => this.settings));
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  onunload(): void {}
}
