# Folder links, phase 1: design

Date: 2026-11-21. Updated 2026-11-22 to match what shipped.

## Why

The user needed a link to a folder and had to install a separate plugin (Folder Links) for it.
Folder links belong in Littera Nexa, because offering a folder as a suggestion sits naturally next to
offering a note. Phase 1 is a releasable feature on its own: folder links work when clicked, look
like links, and folders appear in suggestions. Graph, backlinks, renames and a hover listing are
phase 2 (`2026-11-21-folder-links-phase2-design.md`).

Only the ideas of Folder Links are taken, not its code.

## Goals

- `[[Projects/Clients/]]` in a note is a folder link. Clicking it reveals the folder in the file
  explorer.
- Folder links are drawn as normal links in live preview and reading view, not faded as unresolved.
- Folders are offered as suggestions alongside notes, and picking one inserts a folder link.
- Nothing about a folder link ever creates a note: no click, no hover popup, no embed, no pane.

## Non-goals (phase 2)

- Creating a missing folder on click (phase 1 shows a notice only; no setting yet).
- Updating links when a folder is renamed or moved.
- Graph, outgoing links pane, backlinks, and a hover popup listing the folder's contents.

## Anti-goals

- Clicking a folder link must never create an empty note. That is the bug this removes.
- No files are added to the user's vault (no hidden "folder notes").

## Approaches

- **A. Wrap `workspace.openLinkText` (picked).** Clicks, Ctrl+click, middle-click, graph and the
  "Open link under cursor" command all pass through it. One choke point, no gap on mobile or the
  keyboard. Cost: it wraps a function Obsidian owns; the wrapper must uninstall cleanly and keep
  any other plugin's wrapper intact.
- **B. Capture DOM clicks on link elements.** Leaves Obsidian's functions alone, but live preview,
  reading view, mobile taps, middle-click and the keyboard command each need separate handling, and
  every missed path creates an empty note. Rejected.
- **C. Hidden folder notes.** Puts files into the vault. Rejected (anti-goal).

The user picked A.

## Link syntax

- A wikilink whose link path ends in `/` is a folder link: `[[Clients/]]`, `[[Projects/Clients/]]`,
  `[[../Clients/]]`, `[[./]]` for the note's own folder, with display text `[[Clients/|Clients]]`
  (and `\|` inside tables). Spaces around the path or the bar are ignored.
- The same syntax as the Folder Links plugin, so links written with it keep working.
- A `#heading` or `^block` part after the slash is ignored.
- A folder whose path holds `#`, `^`, `|`, `[[` or `]]` can't be written as a link that reads back
  the same, so it is never offered or resolved.

## Resolving a folder link

A pure function (`resolveFolder` in `src/folders/folder-links.ts`): given the link path without its
trailing slash, the source note's path and the vault's folders, return the folder or none. In order:

1. **Absolute:** a folder whose path is exactly the link path.
2. **Relative:** the link path resolved against the source note's folder.
3. **Shortest:** folders whose path ends with `/<link path>`, by whole folder names. If several,
   the one nearest the source note (most leading folders shared), ties alphabetical.

A path starting with `./` or `../` is read from the note's folder only (step 2), never from the
root. Matching is case-insensitive, as Obsidian's note links are; an exact-case match wins at the
same step.

The folders are held in a lookup (`FolderLookup`) keyed by lower-cased path and by last folder
name, so a link costs a couple of map reads, not a pass over every folder: 10,000 links resolve in
a 100,000-folder vault in well under half a second.

## Writing a folder link

The link text follows Obsidian's **Files and links → New link format**, the same setting note links
already follow:

- **Shortest path when possible** (Obsidian's default): the shortest run of trailing folder names
  that no other folder in the vault ends with: `Clients/`, growing to `Projects/Clients/` only
  when another `Clients` exists. Uniqueness is checked against the whole vault, not the suggestion
  scope.
- **Relative path:** from the current note's folder, written with a leading `./` when the plain
  form would be read from the root and find another folder, and as `./` for the note's own folder.
- **Absolute path:** from the vault root.

Every written link resolves back to its folder, in every format, from every folder; a unit test
checks this exhaustively over two fixture vaults.

The inserted link always carries the folder name as display text, `[[Clients/|Clients]]`, so the
note reads "Clients" rather than "Clients/" or a path. Tables get `\|`, as note links do.

The vault root is never a link target or a suggestion.

## Clicking a folder link

The wrapper (`src/folders/open-link.ts`) sees every `openLinkText` call. If the link path ends in `/`:

- **Folder found:** reveal it with the Files core plugin's own `revealInFolder` (internal; there is
  no public API), which opens the sidebar, or the left drawer on mobile, and expands the parents.
  Ctrl/Cmd+click and middle-click do the same; there is no tab to open.
- **Folder not found:** a notice, "Folder not found: <link path>". Nothing is created.
- **Files core plugin turned off:** a notice saying so.

Any other link passes to the original function unchanged. The wrapper uses `monkey-around`, so it
chains to whatever `openLinkText` was before it and uninstalls on unload without breaking a wrapper
installed after it. The Obsidian internals the feature reads (the link-format config and the Files
plugin) live in `src/folders/internals.ts`.

Checked in a real Obsidian 1.14.4, and pinned by e2e tests where the harness can reach: the hover
popup's "click to create", a folder embed's "not created yet" box in both views, and the outgoing
links pane all go through `openLinkText`, so none of them creates anything. The graph's node click
does too (read from Obsidian's code; its canvas is out of the harness's reach), passing no source
note, so a relative link clicked there resolves from the root.

## Hover

Page preview answers the `hover-link` workspace event with a popup, which for a folder can only say
"not created yet". The same wrapper drops that event for folder links, so hovering one shows
nothing. A popup listing the folder's contents is phase 2.

## Drawing folder links

Obsidian fades an unresolved link through its `--link-unresolved-*` CSS variables. A
`littera-nexa-folder-link` class re-points them at the resolved look (`styles.css`), so nothing has
to out-rank Obsidian's selectors and no `text-decoration-*` sub-property is needed. A theme that
fades unresolved links without those variables still fades folder links.

- **Reading view, live-preview table cells and embeds** (anything Obsidian renders from markdown):
  a post-processor gives resolving folder links the class and drops `is-unresolved`.
- **Live preview:** an editor extension wraps each resolving folder link in a span with the class.
  It has the lowest precedence, because CodeMirror nests a lower-precedence mark outside a higher
  one, and only an outer span can pass the variables to Obsidian's own `is-unresolved` span.
  After an edit it re-reads only the lines the edit touched; scrolling or a redraw reads the visible
  text again. `[[…]]` inside inline code, code blocks and math is skipped (Obsidian's token names
  there contain "code" or "math").
- **Source mode:** nothing is marked; Obsidian doesn't style links there.
- **Missing folder:** stays faded, like a missing note.

When a folder is created, renamed or deleted, the folder index is dropped and, debounced by 100 ms
and only once the vault has finished loading, open notes redraw: live preview through
`workspace.updateOptions()`, and every rendered link (reading view, table cells, embeds) is brought
up to date in place, in both directions.

## Folder suggestions

- **Setting:** "Suggest folders", a toggle, **on by default**, so existing users get folders after
  updating. Placed in the "Notes to suggest" group, after the folder list. Description: "Offer
  folders from the same scope as notes. Links reveal them in the file explorer."
- **Candidates:** every linkable folder except the root, matched by its name only (folders have no
  aliases), under the same matching rule, first-word rule and trigger settings as notes.
- **Scope:** a folder is in scope when a note sitting directly inside it would be. Excluding
  `Archive` therefore hides `Archive` itself; selecting `People` without subfolders offers `People`
  but not `People/Staff`.
- **Row:** the folder name as the title (with match highlights), the parent path on the small line
  (`/` for a root-level folder), and a folder icon in the spot where alias rows show their arrow.
- **Order:** folders rank by the same score as notes. When a folder and a note tie (`People/` and
  `People.md`), the note comes first. Same-named folders keep path order.
- **Picking a row:** inserts the folder link (above) in place of the typed text.

The vault's folders are read once into a `FolderIndex` (`src/folders/folder-index.ts`), sorted by
path, and kept until a folder changes; the folder rows are kept until a folder or the scope
settings change. Typing never walks the vault for folders.

## Known gaps in phase 1

Shipped and documented in the README, fixed in phase 2:

- Obsidian still records `[[Clients/]]` as an unresolved link: it appears under "Unresolved" in the
  outgoing links pane and as a ghost node in the graph.
- An embedded folder link (`![[Clients/]]`) still shows Obsidian's "not created yet" box, though
  clicking it creates nothing.
- Renaming a folder leaves its links pointing at the old path.

## Release

- README: a "Folder links" section (syntax, click behaviour, the toggle, the known gaps) and a
  troubleshooting line.
- i18n: new strings in `en.json` with `_comment` siblings; `sample_lang.json` carries the keys.
- Dependencies: `monkey-around`; `@codemirror/state`, `@codemirror/view` and `@codemirror/language`
  as dev dependencies for their types, external in the bundle like every CodeMirror package.
- Tests:
  - unit (117): resolving, writing link text in all three formats with the round-trip check, the
    lookup's speed on a large vault, folder scope, the note-before-folder tie, the folder index,
    finding wikilinks on one line;
  - e2e (23 for folder links, 93 in all): folder rows and what picking one writes; clicking in live
    preview and reading view reveals the folder; a missing folder shows the notice and creates
    nothing; the Files plugin turned off; the plugin turned off and on; no hover popup; nothing
    created from embeds or the outgoing links pane; drawing in both views, in table cells and as a
    link is typed; redraws when a folder appears or goes; code, math and source mode left alone.

Checked by hand in the harness, not pinned by a test: Obsidian's mobile emulation reveals the
folder in the left drawer; the settings toggle's layout. Not checked: a real mobile device.
