import { App, PluginSettingTab, setIcon, Setting, SettingDefinitionItem } from "obsidian";
import {
  DEFAULT_SETTINGS,
  FolderEntry,
  LitteraNexaSettings,
  MAX_WORDS_RANGE,
  MIN_CHARACTERS_RANGE,
  ScopeMode,
} from "../settings";
import { renderFolderRow } from "./folder-list";
import { SettingsHost } from "./host";
import { SectionsPage, sectionsSummary } from "./sections-page";
import { t } from "../i18n/i18n";

type Key = keyof LitteraNexaSettings;

export class LitteraNexaSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly host: SettingsHost,
  ) {
    super(app, host);
  }

  getControlValue(key: string): unknown {
    return this.host.settings[key as Key];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    Object.assign(this.host.settings, { [key]: value });
    await this.host.saveSettings();
  }

  getSettingDefinitions(): SettingDefinitionItem<Key>[] {
    const settings = this.host.settings;
    const vault = settings.scopeMode === "vault";
    const folders = vault ? settings.excludedFolders : settings.includedFolders;

    return [
      {
        type: "group",
        cls: "littera-nexa-first-group",
        heading: t("settings.scope.heading"),
        items: [
          {
            // Drawn by hand so the warning under it follows the dropdown: Obsidian doesn't redraw a
            // declarative row while its own control has focus, but always redraws a rendered one.
            name: t("settings.scope.mode.name"),
            render: (setting: Setting) => this.renderScopeMode(setting),
          },
        ],
      },
      {
        // The framework's list for the heading, the add affordance and the empty state; the rows
        // are drawn by hand in folder-list.ts.
        type: "list",
        cls: "littera-nexa-folder-list",
        heading: vault ? t("settings.scope.excludedHeading") : t("settings.scope.includedHeading"),
        // An empty exclusion list is the ordinary state. An empty selection suggests nothing.
        emptyState: vault ? undefined : t("settings.scope.noFolders"),
        addItem: {
          name: vault ? t("settings.scope.excludeFolder") : t("settings.scope.addFolder"),
          action: () => {
            // Not saved yet: a blank row covers nothing, and is saved once it has a path.
            folders.push({ path: "", subfolders: true });
            this.update();
          },
        },
        items: folders.map((entry) => ({
          name: entry.path || t("settings.scope.newFolder"),
          render: (setting: Setting) =>
            renderFolderRow(setting, this.app, entry, {
              onSave: () => void this.host.saveSettings(),
              onDelete: () => void this.deleteFolder(folders, entry),
            }),
        })),
      },
      {
        type: "group",
        cls: "littera-nexa-group",
        heading: t("settings.trigger.heading"),
        items: [
          {
            name: t("settings.trigger.capitalOnly.name"),
            desc: t("settings.trigger.capitalOnly.description"),
            control: { type: "toggle", key: "capitalOnly", defaultValue: DEFAULT_SETTINGS.capitalOnly },
          },
          {
            name: t("settings.trigger.minCharacters.name"),
            desc: t("settings.trigger.minCharacters.description"),
            control: {
              type: "slider",
              key: "minCharacters",
              defaultValue: DEFAULT_SETTINGS.minCharacters,
              ...MIN_CHARACTERS_RANGE,
              step: 1,
            },
          },
          {
            name: t("settings.trigger.maxWords.name"),
            desc: t("settings.trigger.maxWords.description"),
            control: {
              type: "slider",
              key: "maxWords",
              defaultValue: DEFAULT_SETTINGS.maxWords,
              ...MAX_WORDS_RANGE,
              step: 1,
            },
          },
          {
            name: t("settings.sections.heading"),
            type: "page",
            displayValue: () => sectionsSummary(this.host.settings),
            page: () => new SectionsPage(this.host, () => this.update()),
          },
        ],
      },
      {
        type: "group",
        cls: "littera-nexa-group",
        heading: t("settings.rows.heading"),
        items: [
          {
            name: t("settings.rows.extraAliases.name"),
            desc: t("settings.rows.extraAliases.description"),
            control: {
              type: "dropdown",
              key: "extraAliases",
              defaultValue: DEFAULT_SETTINGS.extraAliases,
              options: {
                "0": t("settings.rows.extraAliases.none"),
                // Counts, not words: the same in every language.
                "1": "1",
                "2": "2",
                all: t("settings.rows.extraAliases.all"),
              },
            },
          },
        ],
      },
    ];
  }

  private renderScopeMode(setting: Setting): void {
    const mode = this.host.settings.scopeMode;
    // Temporary: goes when large vaults get an index.
    if (mode === "vault") setting.setDesc(largeVaultWarning());
    setting.addDropdown((dropdown) =>
      dropdown
        .addOption("vault", t("settings.scope.mode.vault"))
        .addOption("folders", t("settings.scope.mode.folders"))
        .setValue(mode)
        .onChange((value) => void this.setScopeMode(value as ScopeMode)),
    );
  }

  /** The mode decides which list, heading and warning are on the page, so the page is redrawn. */
  private async setScopeMode(mode: ScopeMode): Promise<void> {
    this.host.settings.scopeMode = mode;
    await this.host.saveSettings();
    this.update();
  }

  private async deleteFolder(folders: FolderEntry[], entry: FolderEntry): Promise<void> {
    // By identity, not position: a second click can land before the first redraw.
    const index = folders.indexOf(entry);
    if (index < 0) return;
    folders.splice(index, 1);
    await this.host.saveSettings();
    this.update();
  }
}

/** A warning icon and a line pointing at the other mode, named by the dropdown's own labels. */
function largeVaultWarning(): DocumentFragment {
  const fragment = createFragment();
  const warning = fragment.createDiv({ cls: "littera-nexa-settings-warning" });
  setIcon(warning.createSpan({ cls: "littera-nexa-settings-warning-icon" }), "alert-triangle");
  warning.createSpan({
    text: t("settings.scope.largeVault", {
      folders: t("settings.scope.mode.folders"),
      vault: t("settings.scope.mode.vault"),
    }),
  });
  return fragment;
}
