import { FolderEntry } from "../src/settings";
import { inScope } from "../src/suggest/scope";

const vault = (...excludedFolders: FolderEntry[]) =>
  ({ scopeMode: "vault" as const, includedFolders: [], excludedFolders });
const folders = (...includedFolders: FolderEntry[]) =>
  ({ scopeMode: "folders" as const, includedFolders, excludedFolders: [] });
const deep = (path: string): FolderEntry => ({ path, subfolders: true });
const flat = (path: string): FolderEntry => ({ path, subfolders: false });

describe("inScope, entire vault", () => {
  it("suggests everything with no exclusions", () => {
    expect(inScope("Note.md", vault())).toBe(true);
    expect(inScope("People/Work/Jane.md", vault())).toBe(true);
  });

  it("leaves out an excluded folder and what is below it", () => {
    const s = vault(deep("Archive"));
    expect(inScope("Archive/Old.md", s)).toBe(false);
    expect(inScope("Archive/2020/Old.md", s)).toBe(false);
    expect(inScope("People/Jane.md", s)).toBe(true);
  });

  it("lets subfolders through when the box is unticked", () => {
    const s = vault(flat("Archive"));
    expect(inScope("Archive/Old.md", s)).toBe(false);
    expect(inScope("Archive/2020/Old.md", s)).toBe(true);
  });

  it("ignores the included list", () => {
    const s = { scopeMode: "vault" as const, includedFolders: [deep("People")], excludedFolders: [] };
    expect(inScope("Other/Note.md", s)).toBe(true);
  });
});

describe("inScope, selected folders", () => {
  it("suggests nothing from an empty list", () => {
    expect(inScope("Note.md", folders())).toBe(false);
  });

  it("suggests a folder and what is below it", () => {
    const s = folders(deep("People"));
    expect(inScope("People/Jane.md", s)).toBe(true);
    expect(inScope("People/Work/Jane.md", s)).toBe(true);
    expect(inScope("Note.md", s)).toBe(false);
  });

  it("suggests only the folder's own notes when the box is unticked", () => {
    const s = folders(flat("People"));
    expect(inScope("People/Jane.md", s)).toBe(true);
    expect(inScope("People/Work/Jane.md", s)).toBe(false);
  });

  it("compares folder names whole", () => {
    const s = folders(deep("People"));
    expect(inScope("People2/Jane.md", s)).toBe(false);
    expect(inScope("Old/People/Jane.md", s)).toBe(false);
  });

  it("handles nested folders and stray slashes", () => {
    expect(inScope("A/B/C/Note.md", folders(deep("A/B")))).toBe(true);
    expect(inScope("A/B/Note.md", folders(flat("/A/B/")))).toBe(true);
    expect(inScope("A/Note.md", folders(deep("A/B")))).toBe(false);
  });

  it("treats / as the vault root", () => {
    expect(inScope("Note.md", folders(flat("/")))).toBe(true);
    expect(inScope("A/Note.md", folders(flat("/")))).toBe(false);
    expect(inScope("A/Note.md", folders(deep("/")))).toBe(true);
  });

  it("ignores a blank row", () => {
    expect(inScope("Note.md", folders(deep("")))).toBe(false);
    expect(inScope("Note.md", folders(deep("  ")))).toBe(false);
    expect(inScope("Note.md", vault(deep("")))).toBe(true);
  });

  it("ignores the excluded list", () => {
    const s = { scopeMode: "folders" as const, includedFolders: [deep("People")], excludedFolders: [deep("People")] };
    expect(inScope("People/Jane.md", s)).toBe(true);
  });
});
