import { AbstractInputSuggest, App, Setting, setIcon, setTooltip, TFolder } from "obsidian";
import { FolderEntry } from "../settings";
import { t } from "../i18n/i18n";

export interface FolderRowActions {
  /** The entry was edited and wants saving. */
  onSave: () => void;
  onDelete: () => void;
}

/**
 * One row of a folder list, drawn by hand: the declarative row types can't carry a field, a
 * checkbox and a delete button together.
 */
export function renderFolderRow(setting: Setting, app: App, entry: FolderEntry, actions: FolderRowActions): void {
  const row = setting.settingEl;
  row.empty();
  row.addClass("littera-nexa-folder-row");

  const icon = row.createSpan({ cls: "littera-nexa-folder-icon" });
  const paintIcon = () => {
    // A blank row is one the user has only just added, not a broken path.
    const missing = entry.path.trim() !== "" && !folderExists(app, entry.path);
    setIcon(icon, missing ? "alert-triangle" : "folder");
    icon.toggleClass("littera-nexa-folder-missing", missing);
    setTooltip(icon, missing ? t("settings.scope.folderNotFound") : "");
  };
  paintIcon();

  const input = row.createEl("input", { type: "text", cls: "littera-nexa-folder-path", value: entry.path });
  input.placeholder = t("settings.scope.folderPlaceholder");
  // Saved on leaving the field or picking a folder. The row is repainted here rather than redrawn
  // by the tab: a redraw replaces every row, and leaving a field is usually a click on something
  // in one of them, which the replacement would swallow.
  const commit = (path: string) => {
    if (path.trim() === entry.path) return;
    entry.path = path.trim();
    paintIcon();
    actions.onSave();
  };
  input.addEventListener("blur", () => commit(input.value));
  new FolderSuggest(app, input, commit);

  const label = row.createEl("label", { cls: "littera-nexa-folder-subfolders" });
  const checkbox = label.createEl("input", { type: "checkbox" });
  checkbox.checked = entry.subfolders;
  checkbox.addEventListener("change", () => {
    entry.subfolders = checkbox.checked;
    actions.onSave();
  });
  label.appendText(t("settings.scope.includeSubfolders"));

  const remove = row.createDiv({ cls: "clickable-icon" });
  setIcon(remove, "trash-2");
  setTooltip(remove, t("settings.scope.removeFolder"));
  remove.addEventListener("click", () => actions.onDelete());
}

function folderExists(app: App, path: string): boolean {
  const cleaned = path.trim().replace(/^\/+|\/+$/g, "");
  return cleaned === "" || app.vault.getFolderByPath(cleaned) !== null;
}

/** Folder autocomplete for a path field. */
class FolderSuggest extends AbstractInputSuggest<TFolder> {
  constructor(
    app: App,
    input: HTMLInputElement,
    private readonly onPick: (path: string) => void,
  ) {
    super(app, input);
  }

  protected getSuggestions(query: string): TFolder[] {
    const wanted = query.toLowerCase();
    return this.app.vault.getAllFolders(false).filter((folder) => folder.path.toLowerCase().includes(wanted));
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.setText(folder.path);
  }

  selectSuggestion(folder: TFolder): void {
    this.setValue(folder.path);
    this.close();
    this.onPick(folder.path);
  }
}
