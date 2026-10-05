import { Plugin } from "obsidian";
import { LitteraNexaSettings } from "../settings";

/**
 * What the settings surfaces need of the plugin. Structural rather than an import of the plugin
 * class, so the settings tab and `main.ts` don't import each other.
 */
export interface SettingsHost extends Plugin {
  settings: LitteraNexaSettings;
  saveSettings(): Promise<void>;
}
