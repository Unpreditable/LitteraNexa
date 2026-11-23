import {
  folderLinkPath,
  folderLinkText,
  folderLookup,
  isLinkableFolder,
  LinkFormat,
  resolveFolder,
} from "../src/folders/folder-links";

const F = ["Harbor", "Harbor/Docks", "Orchard Lane", "Orchard Lane/Docks", "Ledgers"];

describe("large vaults", () => {
  // 100,000 folders: a walk over every folder for each link would take seconds here.
  const many: string[] = [];
  for (let a = 0; a < 100; a++) {
    many.push(`Area ${a}`);
    for (let b = 0; b < 999; b++) many.push(`Area ${a}/Topic ${b}`);
  }
  const lookup = folderLookup(many);

  it("resolves thousands of links quickly through a lookup", () => {
    // Checked after the clock stops: expect() itself costs more than a lookup.
    const wrong: string[] = [];
    const started = performance.now();
    for (let i = 0; i < 10000; i++) {
      const found = resolveFolder(`Topic ${i % 999}`, `Area ${i % 100}/n.md`, lookup);
      if (found !== `Area ${i % 100}/Topic ${i % 999}`) wrong.push(`${i}: ${found}`);
    }
    const elapsed = performance.now() - started;
    expect(wrong).toEqual([]);
    expect(elapsed).toBeLessThan(500);
  });

  it("gives the same answers through a lookup as through a list", () => {
    for (const [path, from] of [
      ["Docks", "Orchard Lane/Note.md"],
      ["orchard lane/docks", "Note.md"],
      ["./Docks", "Harbor/Note.md"],
      ["../Ledgers", "Harbor/Note.md"],
      ["Nowhere", "Note.md"],
    ]) {
      expect(resolveFolder(path, from, folderLookup(F))).toBe(resolveFolder(path, from, F));
    }
  });
});

describe("review findings", () => {
  // A, C and A/C: the plain relative "C/" from a note in A would resolve to the root C.
  const G = ["A", "C", "A/C", "A/B", "B"];

  it("every written link resolves back to its folder, in every format and from every folder", () => {
    const formats: LinkFormat[] = ["shortest", "relative", "absolute"];
    for (const folders of [F, G]) {
      for (const from of ["", ...folders]) {
        const source = from === "" ? "n.md" : `${from}/n.md`;
        for (const target of folders) {
          for (const format of formats) {
            const text = folderLinkText(target, source, folders, format);
            const path = folderLinkPath(text);
            expect([format, source, target, text, path && resolveFolder(path, source, folders)]).toEqual([
              format,
              source,
              target,
              text,
              target,
            ]);
          }
        }
      }
    }
  });

  it("writes ./ for the note's own folder in relative format", () => {
    expect(folderLinkText("A", "A/n.md", G, "relative")).toBe("./");
  });

  it("resolves an explicit ./ or ../ from the note only", () => {
    expect(resolveFolder("./C", "A/n.md", G)).toBe("A/C");
    expect(resolveFolder(".", "A/n.md", G)).toBe("A");
    expect(resolveFolder("../B", "A/C/n.md", G)).toBe("A/B");
  });

  it("ignores spaces around the path", () => {
    expect(folderLinkPath("Harbor/Docks/ | Docks")).toBe("Harbor/Docks");
    expect(folderLinkPath(" Harbor/Docks/ ")).toBe("Harbor/Docks");
  });

  it("refuses folders whose path can't be written inside a wikilink", () => {
    expect(isLinkableFolder("Harbor/Docks")).toBe(true);
    for (const bad of ["C#", "Q^1", "a|b", "x]]y", "[[x", "A#/B"]) expect(isLinkableFolder(bad)).toBe(false);
  });
});

describe("folderLinkPath", () => {
  it("reads a folder link", () => {
    expect(folderLinkPath("Harbor/Docks/")).toBe("Harbor/Docks");
    expect(folderLinkPath("Harbor/Docks/#Heading")).toBe("Harbor/Docks");
    expect(folderLinkPath("Harbor/Docks/^block")).toBe("Harbor/Docks");
    expect(folderLinkPath("Harbor/Docks/|Docks")).toBe("Harbor/Docks");
    expect(folderLinkPath("Harbor/Docks/\\|Docks")).toBe("Harbor/Docks");
    expect(folderLinkPath("../Ledgers/")).toBe("../Ledgers");
  });

  it("ignores note links and the root", () => {
    expect(folderLinkPath("Harbor/Docks")).toBeNull();
    expect(folderLinkPath("Jane#Work/")).toBeNull();
    expect(folderLinkPath("/")).toBeNull();
    expect(folderLinkPath("")).toBeNull();
  });
});

describe("resolveFolder", () => {
  it("prefers the absolute path", () => {
    expect(resolveFolder("Harbor/Docks", "x/Note.md", F)).toBe("Harbor/Docks");
  });

  it("resolves relative to the note", () => {
    expect(resolveFolder("./Docks", "Harbor/Note.md", F)).toBe("Harbor/Docks");
    expect(resolveFolder("../Ledgers", "Harbor/Note.md", F)).toBe("Ledgers");
    expect(resolveFolder("Docks", "Harbor/Note.md", F)).toBe("Harbor/Docks");
  });

  it("resolves a unique shortest path", () => {
    expect(resolveFolder("Ledgers", "Harbor/Note.md", F)).toBe("Ledgers");
    expect(resolveFolder("Lane/Docks", "Note.md", F)).toBeNull();
  });

  it("picks the nearest of several", () => {
    expect(resolveFolder("Docks", "Orchard Lane/Note.md", F)).toBe("Orchard Lane/Docks");
    expect(resolveFolder("Docks", "Harbor/Note.md", F)).toBe("Harbor/Docks");
    // A tie goes alphabetical.
    expect(resolveFolder("Docks", "Note.md", F)).toBe("Harbor/Docks");
  });

  it("ignores case, preferring exact case", () => {
    expect(resolveFolder("orchard lane/docks", "Note.md", F)).toBe("Orchard Lane/Docks");
    expect(resolveFolder("a", "Note.md", ["A", "a"])).toBe("a");
  });

  it("finds nothing for a missing folder", () => {
    expect(resolveFolder("Nowhere", "Note.md", F)).toBeNull();
    expect(resolveFolder("../../Ledgers", "Harbor/Note.md", F)).toBeNull();
  });
});

describe("folderLinkText", () => {
  it("shortest: the name when unique, more path when not", () => {
    expect(folderLinkText("Ledgers", "Harbor/Note.md", F, "shortest")).toBe("Ledgers/");
    expect(folderLinkText("Harbor/Docks", "Note.md", F, "shortest")).toBe("Harbor/Docks/");
    expect(folderLinkText("Orchard Lane/Docks", "Note.md", F, "shortest")).toBe("Orchard Lane/Docks/");
  });

  it("shortest: uniqueness ignores case", () => {
    expect(folderLinkText("x/Docs", "Note.md", ["x", "x/Docs", "y", "y/docs"], "shortest")).toBe("x/Docs/");
  });

  it("relative: from the note's folder", () => {
    expect(folderLinkText("Harbor/Docks", "Harbor/Note.md", F, "relative")).toBe("Docks/");
    expect(folderLinkText("Ledgers", "Harbor/Note.md", F, "relative")).toBe("../Ledgers/");
    expect(folderLinkText("Orchard Lane/Docks", "Harbor/Docks/Note.md", F, "relative")).toBe("../../Orchard Lane/Docks/");
  });

  it("absolute: from the root", () => {
    expect(folderLinkText("Ledgers", "Harbor/Note.md", F, "absolute")).toBe("Ledgers/");
    expect(folderLinkText("Harbor/Docks", "Harbor/Note.md", F, "absolute")).toBe("Harbor/Docks/");
  });
});
