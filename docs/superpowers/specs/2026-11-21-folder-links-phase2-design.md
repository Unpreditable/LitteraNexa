# Folder links, phase 2: design

Date: 2026-11-21. Updated 2026-11-22 for what phase 1 shipped.

## Why

Phase 1 (`2026-11-21-folder-links-phase1-design.md`) makes folder links work and appear in
suggestions, and already drops Obsidian's "not created yet" hover popup for them. Phase 2 removes
the remaining gaps so folder links behave like note links: they survive renames, show up in the
graph and outgoing links, list their contents on hover and have backlinks. These are
extras, not the core of the feature, and each item ships on its own.

## Order

1. Missing-folder setting
2. Renames
3. Outgoing links and graph (starts with a test, below)
4. Hover preview
5. Backlinks

## Anti-goals

Same as phase 1: never create an empty note, never add files the user didn't ask for.

## 1. Missing-folder setting

**"Clicking a link to a missing folder"**: dropdown.

- **Show a notice** (default; phase 1 behaviour).
- **Create the folder**, then reveal it.

Where it is created: the link path from the vault root, or from the note's folder for a relative
link (`./`, `../`). *(My call.)*

## 2. Renames

**"When a linked folder is renamed or moved"**: dropdown.

- **Leave links as they are.**
- **Update all links** (default, matching what Obsidian does for notes). *(Default: my call.)*
- **Choose which to update:** a dialog lists the notes with links to the folder, all checked, with
  "Update" and "Skip". Only checked notes change.

Details *(my calls)*:

- Triggered by the vault's rename event for a folder. Renaming a parent folder also counts for
  links to folders inside it.
- Each rewritten link keeps its format (shortest, relative or absolute, recomputed for the new
  path) and its display text.
- Links in the body and in frontmatter both, edited at the positions the metadata cache records.
- A note that moves gets its own relative folder links rewritten, under the same setting.
- The folder index from phase 1 (`FolderIndex`) is dropped on every folder event already; the
  rename handler hooks in beside that.
- The notes to update are found through one lookup function. Before item 3 lands it reads
  Obsidian's unresolved-link records; after, the resolved ones.

## 3. Outgoing links and graph

**Idea:** move each folder link from Obsidian's unresolved-link records to the resolved ones,
pointing at the folder's path. The outgoing links pane, the graph and the unresolved count all read
those records, so folder links would show as real links, and items 2 and 5 reuse the same data.

**Risk:** the records are meant for files. How the graph and the outgoing pane treat a folder entry
is unknown.

**Step one, a 30-minute throwaway test** in the dev vault, before building:

- Does the change survive the cache recomputing (after each edit, and on startup)?
- Graph: does the folder get a node, and what is it labelled? (A node click already reaches the
  phase 1 handler: the graph calls `openLinkText`, with no source note.)
- Outgoing links pane: is the folder listed as a link, and does clicking it reveal the folder?
- Does anything break: console errors, the unresolved count, other core plugins?

**If it works:** build it as tested. **If not, the fallback:** only remove folder links from the
unresolved records. They drop out of the graph and the outgoing pane, which is quiet but correct.
The test's results go back to the user before building.

## 4. Hover preview

Phase 1 drops the `hover-link` event for folder links (`src/folders/open-link.ts`), so hovering one
shows nothing today. Phase 2 answers that event itself instead: Ctrl+hover (or hover, per the Page
preview settings) over a folder link shows a popup with:

- the folder's name as a heading;
- its direct contents, subfolders first, then files, each group alphabetical;
- clicking a subfolder reveals it; clicking a note opens it.

Every file type is listed, not only notes, and a long folder scrolls. *(My calls.)*

A missing folder shows no popup, as today.

The same item replaces the "not created yet" box Obsidian draws for an embedded folder link
(`![[Clients/]]`) with the same contents list, or hides it. Clicking that box creates nothing
already.

## 5. Backlinks

Folders can't open in a tab, so the backlinks pane can't show them. Instead:

- the file explorer's right-click menu on a folder gets **"Notes linking here"**;
- it opens a dialog listing the notes that link to the folder; clicking one opens it.

Uses the same lookup as item 2.

## Left to the builder

- How to draw a popover of our own at the hovered link (item 4); the event carries the target
  element and the hover parent.
- Whether resolved-record entries need re-applying on every cache event (answered by the test).
