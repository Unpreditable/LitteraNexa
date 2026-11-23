import { FolderIndex } from "../src/folders/folder-index";
import { findWikilinks } from "../src/folders/folder-links";

describe("FolderIndex", () => {
  const folder = (path: string) => ({ path });

  it("reads the vault once until a folder changes, sorted by path, unlinkable ones left out", () => {
    let loads = 0;
    const index = new FolderIndex(() => {
      loads++;
      return [folder("b"), folder("a/c"), folder("a"), folder("x#y")];
    });
    expect(index.lookup().paths).toEqual(["a", "a/c", "b"]);
    expect(index.folders().map((f) => f.path)).toEqual(["a", "a/c", "b"]);
    index.lookup();
    expect(loads).toBe(1);
    const version = index.version;
    index.invalidate();
    expect(index.version).not.toBe(version);
    expect(index.lookup().paths).toEqual(["a", "a/c", "b"]);
    expect(loads).toBe(2);
  });
});

describe("findWikilinks", () => {
  it("finds each link with its position and inner text", () => {
    expect(findWikilinks("see [[A/]] and [[B|b]]")).toEqual([
      { start: 4, end: 10, inner: "A/" },
      { start: 15, end: 22, inner: "B|b" },
    ]);
  });

  it("never spans a line break", () => {
    expect(findWikilinks("[[stray\nDocks/]] [[C/]]")).toEqual([{ start: 17, end: 23, inner: "C/" }]);
  });
});
