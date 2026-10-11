// The manual checklist for other plugins' menus, row by row, with the rows' own numbers.

// Written without imports: describe, it, expect, browser, $ and the helpers are globals the harness
// provides.

const LN = "littera-nexa";
const TASKS = "obsidian-tasks-plugin";
const KALENDAE = "kalendae";

/** The Littera Nexa list, offering Jane. */
const JANE = { owner: LN, rows: ["Jane"] };

describe("1. Plain text: nothing regressed", () => {
  beforeEach(() => openEmptyNote());

  it("1.1 opens with Jane on Jan", async () => {
    await type("Jan");
    expect(await menu()).toEqual(JANE);
  });

  it("1.2 shows no menu on Zzz", async () => {
    await type("Zzz");
    expect(await menu()).toBeNull();
  });

  it("1.3 leaves [[Jan to Obsidian's own link menu", async () => {
    await type("[[Jan");
    expect(await menu()).toMatchObject({ owner: "obsidian" });
  });

  it("1.4 shows no menu on lowercase jan", async () => {
    await type("jan");
    expect(await menu()).toBeNull();
  });
});

describe("2. Kalendae: a menu you asked for is never replaced", () => {
  beforeEach(() => openEmptyNote());

  it("2.1 keeps Kalendae's menu open throughout @in 4 we", async () => {
    for (const part of ["@in", " 4", " we"]) {
      await type(part);
      expect(await menu()).toMatchObject({ owner: KALENDAE });
    }
  });

  it("2.2 does not take over at the n of @Jan", async () => {
    await type("@Ja");
    expect(await menu()).toMatchObject({ owner: KALENDAE });
    await type("n");
    expect(await menu()).toMatchObject({ owner: KALENDAE });
  });

  it("2.3 does not take over at Mon in @next Mon", async () => {
    await type("@next Mo");
    expect(await menu()).toMatchObject({ owner: KALENDAE });
    await type("n");
    expect(await menu()).toMatchObject({ owner: KALENDAE });
  });

  it("2.4 opens with Jane once Kalendae's menu is closed with Escape", async () => {
    await type("@Jan");
    await press("Escape");
    expect(await menu()).toBeNull();
    await type("e");
    expect(await menu()).toEqual(JANE);
  });

  it("2.5 opens with Jane after a date is written", async () => {
    await type("@today");
    await press("Enter");
    const written = await line();
    expect(written).not.toContain("@");
    expect(written).toMatch(/\d/);
    await type(" Jan");
    expect(await menu()).toEqual(JANE);
  });

  it("2.6 keeps Kalendae's menu after an opening bracket", async () => {
    await type("(@Jan");
    expect(await menu()).toMatchObject({ owner: KALENDAE });
  });

  describe("with Kalendae's trigger set to @@", () => {
    it("2.2 again: does not take over at the n of @@Jan", async () => {
      await setPluginSettings(KALENDAE, { typeTrigger: "@@" });
      await openEmptyNote();
      await type("@@Ja");
      expect(await menu()).toMatchObject({ owner: KALENDAE });
      await type("n");
      expect(await menu()).toMatchObject({ owner: KALENDAE });
    });
  });
});

describe("3. Tasks: a line-wide menu is replaced while a note matches", () => {
  beforeEach(async () => {
    await openEmptyNote();
    await type("- [ ] ");
  });

  it("3.1 shows Tasks' menu on call", async () => {
    await type("call ");
    expect(await menu()).toMatchObject({ owner: TASKS });
  });

  it("3.2 replaces Tasks' menu at the n", async () => {
    await type("call Ja");
    expect(await menu()).toMatchObject({ owner: TASKS });
    await type("n");
    expect(await menu()).toEqual(JANE);
  });

  it("3.3 writes the link on Enter", async () => {
    await type("call Jan");
    expect(await menu()).toEqual(JANE);
    await press("Enter");
    expect(await line()).toBe("- [ ] call [[Jane]]");
  });

  it("3.4 never shows on call Zzz", async () => {
    await type("call ");
    for (const character of "Zzz") {
      await type(character);
      expect(await menu()).toMatchObject({ owner: TASKS });
    }
  });

  it("3.5 gives the line back to Tasks at the x of Janx", async () => {
    await type("call Jan");
    expect(await menu()).toEqual(JANE);
    await type("x");
    expect(await menu()).toMatchObject({ owner: TASKS });
  });

  it("3.6 leaves call [[Jan to Obsidian's own link menu", async () => {
    await type("call [[Jan");
    expect(await menu()).toMatchObject({ owner: "obsidian" });
  });

  it("3.7 reports whose menu shows on call @Jan", async () => {
    // No fixed answer: it depends on which of Tasks and Kalendae registered first. Reported so it
    // is known, never asserted.
    await type("call @Ja");
    const before = await menu();
    await type("n");
    const after = await menu();
    console.debug(`3.7: at "call @Ja" ${before?.owner ?? "no menu"}; at "call @Jan" ${after?.owner ?? "no menu"}`);
  });
});

describe("4. The setting: Replace line-wide menus off", () => {
  beforeEach(async () => {
    await setPluginSettings(LN, { replaceLineMenus: false });
    await openEmptyNote();
  });

  it("4.1 leaves Tasks' menu alone", async () => {
    await type("- [ ] call Jan");
    expect(await menu()).toMatchObject({ owner: TASKS });
  });

  it("4.2 opens with Jane once Tasks' menu is closed with Escape", async () => {
    await type("- [ ] call Jan");
    await press("Escape");
    expect(await menu()).toBeNull();
    await type("e");
    expect(await menu()).toEqual(JANE);
  });

  it("4.3 still opens on an empty line", async () => {
    await type("Jan");
    expect(await menu()).toEqual(JANE);
  });

  it("4.4 still leaves Kalendae's menu alone", async () => {
    await type("@Jan");
    expect(await menu()).toMatchObject({ owner: KALENDAE });
  });

  it("3.2 again: applies at once when switched back on, without a reload", async () => {
    await setPluginSettings(LN, { replaceLineMenus: true });
    await type("- [ ] call Ja");
    expect(await menu()).toMatchObject({ owner: TASKS });
    await type("n");
    expect(await menu()).toEqual(JANE);
  });
});

/** Rows 2.2 and 3.2, which must hold whichever plugin loaded last. */
async function expectSameWhateverLoadedLast(): Promise<void> {
  expect((await suggesters())[0]).toBe(LN);
  await openEmptyNote();
  await type("@Jan");
  expect(await menu()).toMatchObject({ owner: KALENDAE });
  await openEmptyNote();
  await type("- [ ] call Ja");
  expect(await menu()).toMatchObject({ owner: TASKS });
  await type("n");
  expect(await menu()).toEqual(JANE);
}

describe("5. Load order", () => {
  it("5.1 holds after Kalendae is turned off and on", async () => {
    await togglePlugin(KALENDAE);
    await expectSameWhateverLoadedLast();
  });

  it("5.2 holds after Tasks is turned off and on", async () => {
    await togglePlugin(TASKS);
    await expectSameWhateverLoadedLast();
  });

  it("5.3 holds after Littera Nexa is turned off and on", async () => {
    await togglePlugin(LN);
    await expectSameWhateverLoadedLast();
  });

  it("5.4 holds after Obsidian is restarted", async () => {
    await restartObsidian();
    await expectSameWhateverLoadedLast();
  });
});

describe("6. Elsewhere", () => {
  it("6.1 opens with Jane in a table cell in live preview", async () => {
    await obsidianPage.write("Table.md", "| a | b |\n| --- | --- |\n|  |  |\n");
    await obsidianPage.openFile("Table.md");
    const cell = $(".markdown-source-view.is-live-preview .cm-table-widget tbody td");
    await cell.waitForExist();
    await cell.click();
    await type("Jan");
    expect(await menu()).toEqual(JANE);
  });

  it("6.2 opens with Jane in one pane while Kalendae's menu is open in the other", async () => {
    await openEmptyNote();
    await browser.executeObsidian(async ({ app }) => {
      const file = await app.vault.create("second-pane.md", "");
      const leaf = app.workspace.getLeaf("split");
      await leaf.openFile(file, { state: { mode: "source", source: false } });
      app.workspace.setActiveLeaf(leaf, { focus: true });
      app.workspace.activeEditor?.editor?.focus();
    });
    await type("@");
    expect(await menu()).toMatchObject({ owner: KALENDAE });
    await $$(".workspace-leaf-content[data-type='markdown'] .cm-content")[0].click();
    await type("Jan");
    expect(await menu()).toEqual(JANE);
  });

  it("6.3 logs no error when the caret leaves the word and comes back", async () => {
    await openEmptyNote();
    await type("Jan");
    expect(await menu()).toEqual(JANE);
    await press("ArrowLeft");
    await press("ArrowRight");
    // Lets anything the last key set off finish. The wrapper then fails the test on any console error.
    await menu();
  });
});

// Keeps this file's names its own: a file with no import or export shares one scope with every other.
export {};
