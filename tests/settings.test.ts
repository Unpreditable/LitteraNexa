import { DEFAULT_SETTINGS, extraAliasLimit, mergeSettings } from "../src/settings";

describe("mergeSettings", () => {
  it("gives the defaults for nothing saved", () => {
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings("junk")).toEqual(DEFAULT_SETTINGS);
  });

  it("never hands out the default lists themselves", () => {
    const settings = mergeSettings(null);
    settings.excludedFolders.push({ path: "A", subfolders: true });
    expect(DEFAULT_SETTINGS.excludedFolders).toEqual([]);
  });

  it("keeps valid saved values", () => {
    const saved = {
      scopeMode: "folders",
      includedFolders: [{ path: "People", subfolders: false }],
      excludedFolders: [{ path: "Archive", subfolders: true }],
      capitalOnly: false,
      minCharacters: 2,
      maxWords: 5,
      inCodeBlocks: true,
      inInlineCode: true,
      inMathBlocks: true,
      inInlineMath: true,
      inComments: true,
      inFrontmatter: true,
      extraAliases: "1",
    };
    expect(mergeSettings(saved)).toEqual(saved);
  });

  it("falls back per field when a saved value has the wrong type", () => {
    const merged = mergeSettings({ scopeMode: "galaxy", capitalOnly: "yes", extraAliases: 2, maxWords: 4 });
    expect(merged).toEqual({ ...DEFAULT_SETTINGS, maxWords: 4 });
  });

  it("rejects numbers outside the range or not whole", () => {
    expect(mergeSettings({ minCharacters: 0 }).minCharacters).toBe(DEFAULT_SETTINGS.minCharacters);
    expect(mergeSettings({ minCharacters: 7 }).minCharacters).toBe(DEFAULT_SETTINGS.minCharacters);
    expect(mergeSettings({ maxWords: 2.5 }).maxWords).toBe(DEFAULT_SETTINGS.maxWords);
    expect(mergeSettings({ maxWords: 6 }).maxWords).toBe(DEFAULT_SETTINGS.maxWords);
  });

  it("keeps only well-formed folder entries, subfolders on unless saved off", () => {
    const merged = mergeSettings({
      includedFolders: [{ path: "A" }, { path: "B", subfolders: false }, { subfolders: true }, "C", null],
    });
    expect(merged.includedFolders).toEqual([
      { path: "A", subfolders: true },
      { path: "B", subfolders: false },
    ]);
  });
});

describe("extraAliasLimit", () => {
  it("turns the setting into a row limit", () => {
    expect(extraAliasLimit("0")).toBe(0);
    expect(extraAliasLimit("2")).toBe(2);
    expect(extraAliasLimit("all")).toBe(Infinity);
  });
});
