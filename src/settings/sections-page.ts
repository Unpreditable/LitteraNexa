import { Setting, SettingPage } from "obsidian";
import { LitteraNexaSettings } from "../settings";
import { SettingsHost } from "./host";
import { t } from "../i18n/i18n";

/** The toggleable parts of a note, in the order the page lists them. */
const SECTIONS = [
  ["inCodeBlocks", "codeBlocks"],
  ["inInlineCode", "inlineCode"],
  ["inMathBlocks", "mathBlocks"],
  ["inInlineMath", "inlineMath"],
  ["inComments", "comments"],
  ["inFrontmatter", "frontmatter"],
] as const;

/** Which parts of a note the suggestion list may open in. */
export class SectionsPage extends SettingPage {
  private changed = false;

  constructor(
    private readonly host: SettingsHost,
    private readonly onChanged: () => void,
  ) {
    super();
    this.title = t("settings.sections.heading");
  }

  /**
   * The summary on the row behind this page is only re-read when the tab is told to update, and
   * leaving the page is the moment to say so: per toggle would redraw the tab under the page.
   */
  hide(): void {
    super.hide();
    if (!this.changed) return;
    this.changed = false;
    this.onChanged();
  }

  display(): void {
    this.containerEl.empty();
    // Obsidian's default rows are sized for pages with far fewer of them.
    this.containerEl.addClass("littera-nexa-settings-page");

    // Listed, switched on and locked, so the set of sections is complete on the page.
    new Setting(this.containerEl)
      .setName(t("settings.sections.text"))
      .addToggle((toggle) => toggle.setValue(true).setDisabled(true));

    for (const [key, label] of SECTIONS) {
      new Setting(this.containerEl).setName(t(`settings.sections.${label}`)).addToggle((toggle) =>
        toggle.setValue(this.host.settings[key]).onChange((value) => {
          this.host.settings[key] = value;
          this.changed = true;
          void this.host.saveSettings();
        }),
      );
    }
  }
}

/** A middle dot rather than a comma: it reads as a list in every script. */
const SUMMARY_SEPARATOR = " · ";

/** The sections currently on, for the row that opens the page. */
export function sectionsSummary(settings: LitteraNexaSettings): string {
  const on = [t("settings.sections.text")];
  for (const [key, label] of SECTIONS) {
    if (settings[key]) on.push(t(`settings.sections.${label}`));
  }
  return on.join(SUMMARY_SEPARATOR);
}
