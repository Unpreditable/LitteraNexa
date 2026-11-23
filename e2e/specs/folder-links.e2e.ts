// Folder links: folders offered as rows, what picking one writes, what clicking a folder link does
// and how it is drawn. The pure rules behind these (parsing, resolving, writing the link text) are
// unit-tested in tests/folder-links.test.ts.
//
// Fixture folders: Harbor/Docks and Orchard Lane/Docks (two folders of the same name) and Ledgers.

// Written without imports: describe, it, expect, browser, $ and the helpers are globals the harness
// provides.

const PLUGIN = "littera-nexa";

describe("Folder rows", () => {
  beforeEach(async () => {
    await resetState();
    await openEmptyNote();
  });

  it("offers a folder and writes a link to it with its name shown", async () => {
    await type("Ledg");
    expect(await menu()).toEqual({ owner: PLUGIN, rows: ["Ledgers"] });
    await press("Enter");
    expect(await line()).toBe("[[Ledgers/|Ledgers]]");
  });

  it("marks a folder row with a folder icon and its parent path", async () => {
    await type("Ledg");
    // Settled first: the rows are redrawn on every keystroke, so a row found earlier goes stale.
    expect(await menu()).toEqual({ owner: PLUGIN, rows: ["Ledgers"] });
    const row = $(".suggestion-container .suggestion-item");
    expect(await row.$(".suggestion-flair svg").getAttribute("class")).toMatch(/folder/);
    expect(await row.$(".suggestion-note").getText()).toBe("/");
  });

  it("offers both folders of one name and writes enough path to tell them apart", async () => {
    await type("Dock");
    expect(await menu()).toEqual({ owner: PLUGIN, rows: ["Docks", "Docks"] });
    const notes = $$(".suggestion-container .suggestion-item .suggestion-note");
    expect(await notes[0].getText()).toBe("Harbor/");
    expect(await notes[1].getText()).toBe("Orchard Lane/");
    await press("Enter");
    expect(await line()).toBe("[[Harbor/Docks/|Docks]]");
  });

  it("offers no folders with Suggest folders off", async () => {
    await setPluginSettings(PLUGIN, { suggestFolders: false });
    await type("Ledg");
    expect(await menu()).toBeNull();
  });

  it("leaves out an excluded folder", async () => {
    await setPluginSettings(PLUGIN, { excludedFolders: [{ path: "Ledgers", subfolders: true }] });
    await type("Ledg");
    expect(await menu()).toBeNull();
  });
});

/**
 * Creates a note and opens it, in live preview or reading view, with the caret on its last line so
 * live preview draws the links on the lines above as links, not as their source.
 */
async function openLinkNote(path: string, text: string, reading = false): Promise<void> {
  await browser.executeObsidian(
    async ({ app }, path, text, reading) => {
      app.workspace.detachLeavesOfType("markdown");
      const file = app.vault.getFileByPath(path) ?? (await app.vault.create(path, text));
      for (let tries = 0; !app.metadataCache.getFileCache(file)?.sections; tries++) {
        if (tries === 100) throw new Error(`${path} was not indexed within 5 s`);
        await new Promise((resolve) => window.setTimeout(resolve, 50));
      }
      const leaf = app.workspace.getLeaf(false);
      await leaf.openFile(file, { state: { mode: reading ? "preview" : "source", source: false } });
      app.workspace.setActiveLeaf(leaf, { focus: true });
      const editor = app.workspace.activeEditor?.editor;
      if (!reading && editor) {
        const last = editor.lastLine();
        editor.setCursor({ line: last, ch: editor.getLine(last).length });
        editor.focus();
      }
    },
    path,
    text,
    reading,
  );
}

/** Collapses Harbor in the file explorer, so a revealed Harbor/Docks has to be expanded to show. */
async function collapseHarbor(): Promise<void> {
  await browser.executeObsidian(({ app }) => {
    const view = app.workspace.getLeavesOfType("file-explorer")[0]?.view as unknown as
      | { fileItems?: Record<string, { setCollapsed?: (collapsed: boolean) => void }> }
      | undefined;
    view?.fileItems?.["Harbor"]?.setCollapsed?.(true);
  });
}

async function folderShown(path: string): Promise<boolean> {
  const title = $(`.nav-folder-title[data-path="${path}"]`);
  try {
    await title.waitForDisplayed({ timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

async function fileCount(): Promise<number> {
  return browser.executeObsidian(({ app }) => app.vault.getAllLoadedFiles().length);
}

/** Whether a notice holding `text` shows up. Earlier notices may still be on screen. */
async function noticeShown(text: string): Promise<boolean> {
  try {
    await browser.waitUntil(
      () =>
        browser.executeObsidian((_, text) => [...document.querySelectorAll(".notice")].some((n) => n.textContent?.includes(text)), text),
      { timeout: 3000 },
    );
    return true;
  } catch {
    return false;
  }
}

const LIVE_LINK = ".markdown-source-view.is-live-preview .cm-hmd-internal-link";

describe("Clicking a folder link", () => {
  beforeEach(async () => {
    await resetState();
    await collapseHarbor();
  });

  it("reveals the folder from live preview and creates nothing", async () => {
    await openLinkNote("Links.md", "[[Harbor/Docks/|Docks]]\n\nend");
    const before = await fileCount();
    await $(LIVE_LINK).click();
    expect(await folderShown("Harbor/Docks")).toBe(true);
    expect(await fileCount()).toBe(before);
  });

  it("reveals the folder from reading view", async () => {
    await openLinkNote("Read.md", "[[Harbor/Docks/|Docks]]\n", true);
    await $('.markdown-reading-view a.internal-link[data-href="Harbor/Docks/"]').click();
    expect(await folderShown("Harbor/Docks")).toBe(true);
  });

  it("resolves a path typed in the wrong case", async () => {
    await browser.executeObsidian(({ app }) => app.workspace.openLinkText("orchard lane/docks/", "Note.md"));
    expect(await folderShown("Orchard Lane/Docks")).toBe(true);
  });

  it("shows a notice for a missing folder and creates nothing", async () => {
    await openLinkNote("Missing.md", "[[Nowhere/]]\n\nend");
    const before = await fileCount();
    await $(LIVE_LINK).click();
    expect(await noticeShown("Folder not found: Nowhere")).toBe(true);
    await browser.pause(500);
    expect(await fileCount()).toBe(before);
    expect(await browser.executeObsidian(({ app }) => app.vault.getAbstractFileByPath("Nowhere") !== null)).toBe(false);
  });

  it("says so when the file explorer is turned off", async () => {
    await browser.executeObsidian(async ({ app }) => {
      const plugins = (app as unknown as { internalPlugins: { getPluginById(id: string): { disable(b: boolean): Promise<void> } } })
        .internalPlugins;
      await plugins.getPluginById("file-explorer").disable(true);
    });
    try {
      await browser.executeObsidian(({ app }) => app.workspace.openLinkText("Ledgers/", "Note.md"));
      expect(await noticeShown("Files core plugin")).toBe(true);
    } finally {
      await browser.executeObsidian(async ({ app }) => {
        const plugins = (app as unknown as { internalPlugins: { getPluginById(id: string): { enable(b: boolean): Promise<void> } } })
          .internalPlugins;
        await plugins.getPluginById("file-explorer").enable(true);
      });
    }
  });

  it("still works after the plugin is turned off and on, and note links still open", async () => {
    await togglePlugin(PLUGIN);
    await collapseHarbor();
    const before = await fileCount();
    await browser.executeObsidian(({ app }) => app.workspace.openLinkText("Harbor/Docks/", "Note.md"));
    expect(await folderShown("Harbor/Docks")).toBe(true);
    expect(await fileCount()).toBe(before);
    await browser.executeObsidian(({ app }) => app.workspace.openLinkText("Jane", "Note.md"));
    const opened = await browser.executeObsidian(({ app }) => app.workspace.getActiveFile()?.path ?? null);
    expect(opened).toBe("People/Jane.md");
  });
});

/** WebdriverIO's own pointer move, which the harness helpers don't declare. */
async function hover(selector: string, withCtrl: boolean): Promise<void> {
  if (withCtrl) await browser.keys(["Control"]);
  await ($(selector) as unknown as { moveTo(): Promise<void> }).moveTo();
}

async function releaseCtrl(): Promise<void> {
  await browser.keys(["Control"]);
}

async function vaultPaths(): Promise<string[]> {
  return browser.executeObsidian(({ app }) => app.vault.getAllLoadedFiles().map((file) => file.path));
}

const CREATE_NOTE = "Intro.\n\n[[Nowhere/]] [[Harbor/Docks/]]\n\n![[Nowhere/]]\n\n![[Harbor/Docks/]]\n\nend";

describe("Nothing is created for a folder link", () => {
  beforeEach(() => resetState());

  it("shows no hover preview for a folder link, found or missing", async () => {
    await openLinkNote("Hover.md", CREATE_NOTE, true);
    for (const href of ["Nowhere/", "Harbor/Docks/"]) {
      await hover(`.markdown-reading-view a.internal-link[data-href="${href}"]`, true);
      await browser.pause(1200);
      const shown = await $(".popover.hover-popover").isExisting();
      await releaseCtrl();
      await hover(".markdown-reading-view p", false);
      expect([href, shown]).toEqual([href, false]);
    }
  });

  it("creates nothing when a folder embed is clicked, in either view", async () => {
    for (const reading of [true, false]) {
      await openLinkNote("Embeds.md", CREATE_NOTE, reading);
      for (const src of ["Nowhere/", "Harbor/Docks/"]) {
        const before = await vaultPaths();
        await browser.executeObsidian((_, src) => {
          const embed = document.querySelector(`.workspace-leaf.mod-active .internal-embed[src="${src}"]`);
          if (!embed) throw new Error(`no embed of ${src}`);
          for (const type of ["mousedown", "mouseup", "click"]) {
            embed.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 }));
          }
        }, src);
        await browser.pause(800);
        expect([reading, src, await vaultPaths()]).toEqual([reading, src, before]);
      }
    }
  });

  it("creates nothing when a folder link is clicked in the outgoing links pane", async () => {
    await openLinkNote("Outgoing.md", CREATE_NOTE, true);
    const before = await vaultPaths();
    const clicked = await browser.executeObsidian(async ({ app }) => {
      const side = app.workspace.getRightLeaf(false);
      if (!side) throw new Error("no right sidebar");
      await side.setViewState({ type: "outgoing-link", state: { file: "Outgoing.md" } });
      await app.workspace.revealLeaf(side);
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
      const root = side.view.containerEl;
      root.querySelectorAll<HTMLElement>(".tree-item.is-collapsed > .tree-item-self").forEach((el) => el.click());
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      const items = [...root.querySelectorAll<HTMLElement>(".tree-item-self")].filter((el) =>
        ["Nowhere/", "Harbor/Docks/"].includes(el.innerText),
      );
      for (const item of items) item.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return items.length;
    });
    await browser.pause(800);
    expect(clicked).toBe(2);
    expect(await vaultPaths()).toEqual(before);
  });
});

/**
 * How each link on the note's first line looks, by its text: its colour and how opaque it is once
 * every element around it is counted. Obsidian fades an unresolved link through a wrapper's
 * opacity, which the link's own computed style doesn't show.
 */
async function linkLooks(reading: boolean): Promise<Record<string, string>> {
  return browser.executeObsidian((_, reading) => {
    const selector = reading
      ? ".markdown-reading-view a.internal-link"
      : ".markdown-source-view.is-live-preview .cm-line .cm-hmd-internal-link .cm-underline";
    const looks: Record<string, string> = {};
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      let opacity = 1;
      for (let node: HTMLElement | null = el; node && !node.classList.contains("cm-line"); node = node.parentElement) {
        opacity *= Number(getComputedStyle(node).opacity);
        if (node.classList.contains("markdown-preview-view")) break;
      }
      looks[el.textContent ?? ""] = `${getComputedStyle(el).color} ${opacity.toFixed(2)}`;
    }
    return looks;
  }, reading);
}

// Below an intro line: the pointer rests where an earlier test clicked, and a hovered link is never faded.
const LOOKS_LINE = "Links below.\n\n[[Jane]] [[Harbor/Docks/|Docks]] [[Nowhere/]]\n\nend";

describe("How a folder link is drawn", () => {
  beforeEach(() => resetState());

  it("draws a folder link like a note link in live preview, and a missing one faded", async () => {
    await openLinkNote("Looks.md", LOOKS_LINE);
    await $(LIVE_LINK).waitForExist();
    const looks = await linkLooks(false);
    expect(looks["Docks"]).toBe(looks["Jane"]);
    expect(looks["Nowhere/"]).not.toBe(looks["Jane"]);
  });

  it("draws a folder link like a note link in reading view, and a missing one faded", async () => {
    await openLinkNote("Looks read.md", LOOKS_LINE, true);
    await $(".markdown-reading-view a.internal-link").waitForExist();
    const looks = await linkLooks(true);
    expect(looks["Docks"]).toBe(looks["Jane"]);
    expect(looks["Nowhere/"]).not.toBe(looks["Jane"]);
  });

  it("redraws a link when its folder is created, without reopening the note", async () => {
    await openLinkNote("Later.md", LOOKS_LINE);
    await $(LIVE_LINK).waitForExist();
    await browser.executeObsidian(async ({ app }) => {
      if (!app.vault.getFolderByPath("Nowhere")) await app.vault.createFolder("Nowhere");
    });
    await browser.waitUntil(
      async () => {
        const looks = await linkLooks(false);
        return looks["Nowhere/"] === looks["Jane"];
      },
      { timeout: 3000, timeoutMsg: "the link to the new folder still looks unresolved" },
    );
  });

  it("redraws a link in reading view when its folder is created", async () => {
    await openLinkNote("Later read.md", LOOKS_LINE, true);
    await $(".markdown-reading-view a.internal-link").waitForExist();
    await browser.executeObsidian(async ({ app }) => {
      if (!app.vault.getFolderByPath("Nowhere")) await app.vault.createFolder("Nowhere");
    });
    await browser.waitUntil(
      async () => {
        const looks = await linkLooks(true);
        return looks["Nowhere/"] === looks["Jane"];
      },
      { timeout: 3000, timeoutMsg: "the reading-view link to the new folder still looks unresolved" },
    );
  });

  it("marks a folder link as it is typed, and keeps the mark while another line is edited", async () => {
    await openLinkNote("Typed.md", "Links below.\n\n\n\nend");
    const marks = () =>
      browser.executeObsidian(
        () => document.querySelectorAll(".markdown-source-view.is-live-preview .littera-nexa-folder-link").length,
      );
    await browser.executeObsidian(({ app }) => {
      const editor = app.workspace.activeEditor?.editor;
      if (!editor) throw new Error("no editor");
      editor.replaceRange("[[Ledgers/]]", { line: 2, ch: 0 });
      editor.setCursor({ line: 4, ch: 3 });
    });
    await browser.waitUntil(async () => (await marks()) === 1, { timeout: 3000, timeoutMsg: "the typed link was never marked" });
    await type(" more");
    expect(await marks()).toBe(1);
  });

  it("does nothing in source mode, where Obsidian doesn't style links", async () => {
    await browser.executeObsidian(async ({ app }) => {
      app.workspace.detachLeavesOfType("markdown");
      const file = await app.vault.create("Source.md", "[[Harbor/Docks/]]\n\nend");
      await app.workspace.getLeaf(false).openFile(file, { state: { mode: "source", source: true } });
    });
    await $(".markdown-source-view .cm-line").waitForExist();
    const marked = await browser.executeObsidian(
      () => document.querySelectorAll(".markdown-source-view .littera-nexa-folder-link").length,
    );
    expect(marked).toBe(0);
  });

  it("leaves link-like text in code alone in live preview", async () => {
    await openLinkNote("Code.md", "Links below.\n\n`[[Harbor/Docks/]]`\n\n```\n[[Ledgers/]]\n```\n\n$[[Ledgers/]]$\n\nend");
    await $(".markdown-source-view.is-live-preview .cm-line").waitForExist();
    const marked = await browser.executeObsidian(
      () => document.querySelectorAll(".markdown-source-view.is-live-preview .littera-nexa-folder-link").length,
    );
    expect(marked).toBe(0);
  });

  it("redraws a table-cell link when its folder is created, and again when it is deleted", async () => {
    await openLinkNote("Cell later.md", "| a |\n| --- |\n| [[Later/]] |\n\nend");
    await $(".cm-table-widget .internal-link").waitForExist();
    const faded = () =>
      browser.executeObsidian(() => {
        const a = document.querySelector<HTMLElement>(".cm-table-widget .internal-link");
        return a ? getComputedStyle(a).opacity !== "1" : null;
      });
    expect(await faded()).toBe(true);
    await browser.executeObsidian(async ({ app }) => {
      if (!app.vault.getFolderByPath("Later")) await app.vault.createFolder("Later");
    });
    await browser.waitUntil(async () => (await faded()) === false, {
      timeout: 3000,
      timeoutMsg: "the cell link never lost its unresolved look",
    });
    await browser.executeObsidian(async ({ app }) => {
      const folder = app.vault.getFolderByPath("Later");
      if (folder) await app.fileManager.trashFile(folder);
    });
    await browser.waitUntil(async () => (await faded()) === true, {
      timeout: 3000,
      timeoutMsg: "the cell link never looked unresolved again",
    });
  });

  it("works in a table cell in live preview", async () => {
    await openLinkNote("Table links.md", "| a |\n| --- |\n| [[Harbor/Docks/\\|Docks]] |\n\nend");
    await collapseHarbor();
    const link = $(".cm-table-widget .internal-link");
    await link.waitForExist();
    const looks = await browser.executeObsidian(() => {
      const a = document.querySelector<HTMLElement>(".cm-table-widget .internal-link");
      return a ? `${getComputedStyle(a).color} ${getComputedStyle(a).opacity}` : "none";
    });
    expect(looks).not.toContain(" 0.");
    await link.click();
    expect(await folderShown("Harbor/Docks")).toBe(true);
  });
});

// Keeps this file's names its own: a file with no import or export shares one scope with every other.
export {};
