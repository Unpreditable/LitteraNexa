import { Plugin } from "obsidian";
import { NoteSuggest } from "./suggest/NoteSuggest";

export default class LitteraNexaPlugin extends Plugin {
  async onload(): Promise<void> {
    this.registerEditorSuggest(new NoteSuggest(this.app));
  }

  onunload(): void {}
}
