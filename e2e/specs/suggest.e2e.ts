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
 * from that index. The note opens in live preview unless `sourceMode` is set.
 */
async function openNote(path: string, atLine: number, text?: string, sourceMode = false): Promise<void> {
  await browser.executeObsidian(
    async ({ app }, path, atLine, text, sourceMode) => {
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
      await leaf.openFile(file, { state: { mode: "source", source: sourceMode } });
      app.workspace.setActiveLeaf(leaf, { focus: true });
      const editor = app.workspace.activeEditor?.editor;
      if (!editor) throw new Error(`no editor after opening ${path}`);
      editor.setCursor({ line: atLine, ch: editor.getLine(atLine).length });
      editor.focus();
    },
    path,
    atLine,
    text ?? null,
    sourceMode,
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

  it("writes a link by name into a table cell", async () => {
    await openNote("Grid.md", 0, "| a | b |\n| --- | --- |\n|  |  |\n");
    const cell = $(".markdown-source-view.is-live-preview .cm-table-widget tbody td");
    await cell.waitForExist();
    await cell.click();
    await type("Jan");
    expect(await menu()).toEqual(JANE);
    await press("Enter");
    await browser.waitUntil(async () => (await noteText()).includes("[[Jane]]"), {
      timeoutMsg: "the note never held the link",
    });
  });

  it("escapes the bar itself in a table in source mode", async () => {
    await openNote("Source grid.md", 2, "| a | b |\n| --- | --- |\n| ", true);
    await type("Bob");
    expect(await menu()).toMatchObject({ owner: LN, rows: ["Bob", "Robert Stone"] });
    await press("Enter");
    expect(await line()).toBe("| [[Robert Stone\\|Bob]]");
  });
});

describe("Links that need a path", () => {
  beforeEach(async () => {
    await resetState();
    await openEmptyNote();
  });

  it("carries the path and displays the bare name when two notes share a name", async () => {
    await type("Dan");
    expect(await menu()).toEqual({ owner: LN, rows: ["Dana", "Dana"] });
    // Down to one row, so which note Enter picks is known.
    await setPluginSettings(LN, { excludedFolders: [{ path: "Archive", subfolders: true }] });
    await press("Backspace");
    await type("n");
    expect(await menu()).toEqual({ owner: LN, rows: ["Dana"] });
    await press("Enter");
    expect(await line()).toBe("[[People/Dana|Dana]]");
  });
});

describe("Alias rows", () => {
  beforeEach(async () => {
    await resetState();
    await openEmptyNote();
  });

  it("offers a note's other aliases, but none that cannot be a link's display text", async () => {
    await type("Que");
    expect(await menu()).toEqual({ owner: LN, rows: ["Quentin Vale", "Skipper", "Captain", "Chief"] });
  });

  it("offers as many extra aliases as the setting allows", async () => {
    await setPluginSettings(LN, { extraAliases: "2" });
    await type("Que");
    expect(await menu()).toEqual({ owner: LN, rows: ["Quentin Vale", "Skipper", "Captain"] });
    await setPluginSettings(LN, { extraAliases: "1" });
    await press("Backspace");
    await type("e");
    expect(await menu()).toEqual({ owner: LN, rows: ["Quentin Vale", "Skipper"] });
    await setPluginSettings(LN, { extraAliases: "0" });
    await press("Backspace");
    await type("e");
    expect(await menu()).toEqual({ owner: LN, rows: ["Quentin Vale"] });
  });

  it("still shows a typed alias and its note with no extra aliases", async () => {
    await setPluginSettings(LN, { extraAliases: "0" });
    await type("Ski");
    expect(await menu()).toEqual({ owner: LN, rows: ["Skipper", "Quentin Vale"] });
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

  it("matches from a name's first word by default, and from a later one with Match from the first word off", async () => {
    await type("Sto");
    expect(await menu()).toBeNull();
    await setPluginSettings(LN, { firstWordOnly: false });
    await press("Backspace");
    await type("o");
    expect(await menu()).toEqual({ owner: LN, rows: ["Robert Stone", "Bob"] });
  });

  it("does not offer the note being written in", async () => {
    await openNote("People/Jane.md", 1);
    await type("Jan");
    expect(await menu()).toBeNull();
  });

  it("looks back no further than the maximum number of words, which is a setting", async () => {
    // With one word to go on, the name is found by its second word.
    await setPluginSettings(LN, { maxWords: 1, firstWordOnly: false });
    await type("Robert Sto");
    expect(await menu()).toEqual({ owner: LN, rows: ["Robert Stone", "Bob"] });
    await press("Enter");
    expect(await line()).toBe("Robert [[Robert Stone]]");
  });

  it("stays closed after a tag's #", async () => {
    await type("#Jan");
    // Obsidian may show its own tag menu here; only this plugin's list must not.
    expect((await menu())?.owner).not.toBe(LN);
  });

  it("stays closed inside a URL", async () => {
    await type("http://x.com/Jan");
    expect(await menu()).toBeNull();
  });

  it("stays closed while a letter follows the caret", async () => {
    await type("x");
    await press("ArrowLeft");
    await type("Jan");
    expect(await menu()).toBeNull();
    await press("Delete");
    await press("Backspace");
    await type("n");
    expect(await menu()).toEqual(JANE);
  });
});

describe("The other matching rules", () => {
  beforeEach(async () => {
    await resetState();
    await openEmptyNote();
  });

  it("wants every letter in a row under the prefix rule", async () => {
    await type("Jne");
    expect(await menu()).toEqual(JANE);
    await setPluginSettings(LN, { matchRule: "prefix" });
    await press("Backspace");
    await type("e");
    expect(await menu()).toBeNull();
  });

  it("finds letters in order anywhere in a word under the subsequence rule", async () => {
    await type("Onc");
    expect(await menu()).toBeNull();
    await setPluginSettings(LN, { matchRule: "subsequence" });
    await press("Backspace");
    await type("c");
    expect(await menu()).toEqual({ owner: LN, rows: ["Monica"] });
  });

  it("forgives swapped letters under the typos rule", async () => {
    await type("Jnae");
    expect(await menu()).toBeNull();
    await setPluginSettings(LN, { matchRule: "typos" });
    await press("Backspace");
    await type("e");
    expect(await menu()).toEqual(JANE);
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

  it("stays out of inline math unless the setting allows it", async () => {
    await openEmptyNote();
    await type("$Jan");
    expect(await menu()).toBeNull();
    await setPluginSettings(LN, { inInlineMath: true });
    await press("Backspace");
    await type("n");
    expect(await menu()).toEqual(JANE);
  });

  it("stays out of a math block unless the setting allows it", async () => {
    await openNote("Math.md", 1, "$$\n\n$$\n");
    await type("Jan");
    expect(await menu()).toBeNull();
    await setPluginSettings(LN, { inMathBlocks: true });
    await press("Backspace");
    await type("n");
    expect(await menu()).toEqual(JANE);
  });

  it("stays out of a comment unless the setting allows it", async () => {
    await openNote("Comment.md", 1, "%%\n\n%%\n");
    await type("Jan");
    expect(await menu()).toBeNull();
    await setPluginSettings(LN, { inComments: true });
    await press("Backspace");
    await type("n");
    expect(await menu()).toEqual(JANE);
  });

  it("stays out of frontmatter unless the setting allows it", async () => {
    // In source mode: live preview shows frontmatter as the Properties widget, not as text.
    await openNote("Properties.md", 1, "---\ntitle: \n---\n", true);
    await type("Jan");
    expect(await menu()).toBeNull();
    await setPluginSettings(LN, { inFrontmatter: true });
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

  it("leaves out only the folder's own notes when its subfolders are not excluded", async () => {
    await setPluginSettings(LN, { excludedFolders: [{ path: "People", subfolders: false }] });
    await type("Jan");
    expect(await menu()).toBeNull();
    await type(" Wen");
    expect(await menu()).toEqual({ owner: LN, rows: ["Wendy"] });
  });

  it("suggests only the folder's own notes when its subfolders are not included", async () => {
    await setPluginSettings(LN, { scopeMode: "folders", includedFolders: [{ path: "People", subfolders: false }] });
    await type("Wen");
    expect(await menu()).toBeNull();
    await type(" Jan");
    expect(await menu()).toEqual(JANE);
  });
});

// Keeps this file's names its own: a file with no import or export shares one scope with every other.
export {};
