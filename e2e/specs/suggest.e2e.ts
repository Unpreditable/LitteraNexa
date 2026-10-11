// What Littera Nexa does by itself: when its list appears, what the rows are, and what picking one
// writes. The pure rules behind these are unit-tested under tests/; this covers the part that only
// exists inside Obsidian.

// Written without imports: describe, it, expect, browser, $ and the helpers are globals the harness
// provides.

const LN = "littera-nexa";

/** The Littera Nexa list, offering Jane. */
const JANE = { owner: LN, rows: ["Jane"] };

/**
 * Opens a note with the caret at the end of one of its lines. With `text`, the note is created
 * first, and opened only once Obsidian has indexed it: where a code block starts and ends comes
 * from that index.
 */
async function openNote(path: string, atLine: number, text?: string): Promise<void> {
  await browser.executeObsidian(
    async ({ app }, path, atLine, text) => {
      app.workspace.detachLeavesOfType("markdown");
      if (text !== null) {
        const created = await app.vault.create(path, text);
        for (let tries = 0; !app.metadataCache.getFileCache(created)?.sections; tries++) {
          if (tries === 100) throw new Error(`${path} was not indexed within 5 s`);
          await new Promise((resolve) => window.setTimeout(resolve, 50));
        }
      }
      const file = app.vault.getFileByPath(path);
      if (!file) throw new Error(`no note at ${path}`);
      const leaf = app.workspace.getLeaf(false);
      await leaf.openFile(file, { state: { mode: "source", source: false } });
      app.workspace.setActiveLeaf(leaf, { focus: true });
      const editor = app.workspace.activeEditor?.editor;
      if (!editor) throw new Error(`no editor after opening ${path}`);
      editor.setCursor({ line: atLine, ch: editor.getLine(atLine).length });
      editor.focus();
    },
    path,
    atLine,
    text ?? null,
  );
}

describe("Picking a note writes a link", () => {
  beforeEach(() => openEmptyNote());

  it("replaces the typed word on Enter and keeps the text before it", async () => {
    await type("see Jan");
    expect(await menu()).toEqual(JANE);
    await press("Enter");
    expect(await line()).toBe("see [[Jane]]");
    expect(await menu()).toBeNull();
  });

  it("writes the link on a click", async () => {
    await type("Jan");
    expect(await menu()).toEqual(JANE);
    await $(".suggestion-container .suggestion-item").click();
    expect(await line()).toBe("[[Jane]]");
  });

  it("matches a name of several words and replaces all of them", async () => {
    await type("ask Robert St");
    expect(await menu()).toMatchObject({ owner: LN, rows: ["Robert Stone", "Bob"] });
    await press("Enter");
    expect(await line()).toBe("ask [[Robert Stone]]");
  });

  it("offers an alias first when that is what was typed, and links through it", async () => {
    await type("Bob");
    expect(await menu()).toEqual({ owner: LN, rows: ["Bob", "Robert Stone"] });
    await press("Enter");
    expect(await line()).toBe("[[Robert Stone|Bob]]");
  });

  it("writes an alias link into a table cell with its bar escaped", async () => {
    await openNote("Table.md", 0, "| a | b |\n| --- | --- |\n|  |  |\n");
    const cell = $(".markdown-source-view.is-live-preview .cm-table-widget tbody td");
    await cell.waitForExist();
    await cell.click();
    await type("Bob");
    expect(await menu()).toMatchObject({ owner: LN, rows: ["Bob", "Robert Stone"] });
    await press("Enter");
    await browser.waitUntil(async () => (await noteText()).includes("[[Robert Stone\\|Bob]]"), {
      timeoutMsg: "the note never held the link with an escaped bar",
    });
  });
});

describe("When the list appears", () => {
  beforeEach(async () => {
    await resetState();
    await openEmptyNote();
  });

  it("waits for the minimum number of characters, which is a setting", async () => {
    await type("Ja");
    expect(await menu()).toBeNull();
    await setPluginSettings(LN, { minCharacters: 2 });
    await press("Backspace");
    await type("a");
    expect(await menu()).toEqual(JANE);
  });

  it("ignores a lowercase word unless Starts with a capital is off", async () => {
    await type("jan");
    expect(await menu()).toBeNull();
    await setPluginSettings(LN, { capitalOnly: false });
    await press("Backspace");
    await type("n");
    expect(await menu()).toEqual(JANE);
  });

  it("matches from a word's first letter by default, and anywhere in it under the substring rule", async () => {
    await type("Ane");
    expect(await menu()).toBeNull();
    await setPluginSettings(LN, { matchRule: "substring" });
    await press("Backspace");
    await type("e");
    expect(await menu()).toEqual(JANE);
  });

  it("does not offer the note being written in", async () => {
    await openNote("People/Jane.md", 1);
    await type("Jan");
    expect(await menu()).toBeNull();
  });
});

describe("Where the list is held back", () => {
  beforeEach(() => resetState());

  it("stays out of inline code unless the setting allows it", async () => {
    await openEmptyNote();
    await type("`Jan");
    expect(await menu()).toBeNull();
    await setPluginSettings(LN, { inInlineCode: true });
    await press("Backspace");
    await type("n");
    expect(await menu()).toEqual(JANE);
  });

  it("stays out of a code block unless the setting allows it", async () => {
    await openNote("Code.md", 1, "```\n\n```\n");
    await type("Jan");
    expect(await menu()).toBeNull();
    await setPluginSettings(LN, { inCodeBlocks: true });
    await press("Backspace");
    await type("n");
    expect(await menu()).toEqual(JANE);
  });
});

describe("Which notes are suggested", () => {
  beforeEach(async () => {
    await resetState();
    await openEmptyNote();
  });

  it("suggests from the whole vault by default", async () => {
    await type("Zel");
    expect(await menu()).toEqual({ owner: LN, rows: ["Zelda"] });
  });

  it("leaves out an excluded folder", async () => {
    await setPluginSettings(LN, { excludedFolders: [{ path: "Archive", subfolders: true }] });
    await type("Zel");
    expect(await menu()).toBeNull();
  });

  it("suggests only from the selected folders in that mode", async () => {
    await setPluginSettings(LN, { scopeMode: "folders", includedFolders: [{ path: "People", subfolders: true }] });
    await type("Zel");
    expect(await menu()).toBeNull();
    await type(" Jan");
    expect(await menu()).toEqual(JANE);
  });
});

// Keeps this file's names its own: a file with no import or export shares one scope with every other.
export {};
