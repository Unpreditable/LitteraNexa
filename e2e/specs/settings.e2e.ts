// The hand-drawn parts of the settings tab, clicked through as a person would: the folder rows, and
// the warning under the scope dropdown. Every other spec changes settings through
// setPluginSettings and never opens the tab.

// Written without imports: describe, it, expect, browser, $ and the helpers are globals the harness
// provides.

const LN = "littera-nexa";

const SCOPE = ".littera-nexa-first-group select:not(.is-measuring)";
const WARNING = ".littera-nexa-settings-warning";
const LIST = ".littera-nexa-folder-list";
const ADD = `${LIST} .setting-item-heading .clickable-icon`;
const ROW = ".littera-nexa-folder-row";
const PATH = `${ROW} .littera-nexa-folder-path`;

/** What Obsidian keeps of its settings window that the specs reach for. */
interface SettingsWindow {
  open(): void;
  openTabById(id: string): void;
  close(): void;
}

/**
 * Opens the plugin's settings tab inside the main window. Obsidian can open its settings in a
 * window of their own, which the helpers here cannot see.
 */
async function openSettings(): Promise<void> {
  await browser.executeObsidian(({ app }, id) => {
    (app.vault as unknown as { setConfig(key: string, value: unknown): void }).setConfig("settingsPopoutWindow", false);
    const setting = (app as unknown as { setting: SettingsWindow }).setting;
    setting.open();
    setting.openTabById(id);
  }, LN);
  await $(SCOPE).waitForDisplayed();
}

async function closeSettings(): Promise<void> {
  await browser.executeObsidian(({ app }) => (app as unknown as { setting: SettingsWindow }).setting.close());
}

/** The excluded folders in the plugin's data.json: what was saved, not what the tab holds. */
function savedExcluded(): Promise<unknown[]> {
  return browser.executeObsidian(async ({ app }, id) => {
    const file = `${app.vault.configDir}/plugins/${id}/data.json`;
    if (!(await app.vault.adapter.exists(file))) return [];
    const data = JSON.parse(await app.vault.adapter.read(file)) as { excludedFolders?: unknown[] };
    return data.excludedFolders ?? [];
  }, LN);
}

async function waitForSaved(expected: unknown[]): Promise<void> {
  const wanted = JSON.stringify(expected);
  await browser.waitUntil(async () => JSON.stringify(await savedExcluded()) === wanted, {
    timeoutMsg: `data.json never held the excluded folders ${wanted}`,
  });
}

/** Adds a folder row, types a path into it and leaves the field, which is what saves it. */
async function addFolder(path: string): Promise<void> {
  await $(ADD).click();
  await $(PATH).click();
  await browser.keys(path);
  await press("Tab");
}

describe("The settings tab", () => {
  beforeEach(async () => {
    await resetState();
    await openSettings();
  });

  afterEach(() => closeSettings());

  it("shows the large-vault warning only while the entire vault is suggested from", async () => {
    expect(await $(WARNING).isDisplayed()).toBe(true);
    await $(SCOPE).$("option[value='folders']").click();
    await $(WARNING).waitForExist({ reverse: true });
    expect(await $(LIST).getText()).toContain("No folders selected. Nothing will be suggested.");
    await $(SCOPE).$("option[value='vault']").click();
    await $(WARNING).waitForDisplayed();
  });

  it("adds a blank folder row without saving it", async () => {
    await $(ADD).click();
    await $(ROW).waitForDisplayed();
    expect(await $$(ROW).length).toBe(1);
    expect(await savedExcluded()).toEqual([]);
  });

  it("saves a typed folder on leaving the field, and stops suggesting from it", async () => {
    await addFolder("Archive");
    await waitForSaved([{ path: "Archive", subfolders: true }]);
    await closeSettings();
    await openEmptyNote();
    await type("Zel");
    expect(await menu()).toBeNull();
  });

  it("marks a folder that is not in the vault", async () => {
    await addFolder("Nowhere");
    const missing = $(`${ROW} .littera-nexa-folder-missing`);
    await missing.waitForDisplayed();
    expect(await missing.getAttribute("aria-label")).toBe("Folder not found");
  });

  it("saves the subfolders checkbox", async () => {
    await addFolder("Archive");
    await waitForSaved([{ path: "Archive", subfolders: true }]);
    await $(`${ROW} .littera-nexa-folder-subfolders input`).click();
    await waitForSaved([{ path: "Archive", subfolders: false }]);
  });

  it("removes a folder row and saves", async () => {
    await addFolder("Archive");
    await waitForSaved([{ path: "Archive", subfolders: true }]);
    await $(`${ROW} > .clickable-icon`).click();
    await $(ROW).waitForExist({ reverse: true });
    await waitForSaved([]);
  });
});

// Keeps this file's names its own: a file with no import or export shares one scope with every other.
export {};
