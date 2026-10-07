# Settings page: design

Date: 2026-10-04

## Goal

Replace the constants in `src/suggest/config.ts` with a settings page, so the scope of suggested
notes, the trigger rules, the places suggestions appear and the alias rows are all the user's
choice. Changes apply on the next keystroke, with no reload.

Built on Obsidian 1.13's declarative settings (`getSettingDefinitions`), which the plugin's
`minAppVersion` already requires. There is no fallback for older versions.

## Defaults

Everything behaves as before the page existed, with one exception: the scope defaults to the entire
vault instead of the `People/` folder, which was one user's structure.

## The page

### Group: Notes to suggest

- **Suggest notes from** — dropdown: "Entire vault, except…" (default) or "Selected folders". No
  description of its own.
- **Large-vault warning** — the dropdown row's description while "Entire vault, except…" is
  selected, in the warning colour after a warning icon: `Consider using "Selected folders". The
  "Entire vault, except…" option is not optimized yet for larger vaults.` The two quoted names are
  the dropdown's own labels, inserted from their keys, so they cannot drift apart in a translation.
  Temporary; it goes when the index (TODO item 3) lands. It does not count notes. The row is drawn
  by hand: Obsidian does not redraw a declarative row while its own control has focus, so a
  declarative description would not follow the dropdown.
- **Folder list** — Obsidian's native `list` for the heading ("Excluded folders" / "Folders"), the
  add affordance ("Exclude folder" / "Add folder") and the empty state; the rows are drawn by hand,
  as Kalendae's format list does, because the built-in row types cannot carry a field, a checkbox
  and a delete button together. Each row:
  - a folder icon, or a warning icon with "Folder not found" when the path no longer resolves;
  - a path field with folder autocomplete, saved when a suggestion is picked or the field loses
    focus;
  - an "Include subfolders" checkbox, ticked on a new row;
  - a remove button.

  Editing a row saves it and repaints its icon in place. Only adding a row, removing one and
  switching mode redraw the list: a redraw replaces every row, and would swallow the click that
  took focus out of the field.

Each mode has its own list, kept while the other mode is active. An empty "Selected folders"
list shows "No folders selected. Nothing will be suggested." An empty exclusion list shows nothing.
A blank row is ignored. A renamed folder is not followed; its row shows the warning icon.

**Scope rule.** An entry covers a note when the note sits directly in the entry's folder, or, with
"Include subfolders" ticked, anywhere below it. `/` means the vault root. "Entire vault, except…"
suggests a note unless an excluded entry covers it; "Selected folders" suggests it only if an
included entry covers it. So an excluded folder with the box unticked still lets its subfolders
through. Folder names are compared whole: `People` does not cover `People2/`.

### Group: When to suggest

- **Starts with a capital** — toggle, on. Off: every word can start a suggestion.
- **Minimum characters** — slider 1–6, default 3.
- **Maximum words** — slider 1–5, default 3.
- **Matching rule** (added 2026-10-06) — dropdown: "Start of word", "First letter, then letters in
  order" (default), "Part of word", "Letters in order", "Start of word, allowing typos". How a typed
  word must fit a word of a note's name; the rule applies to each typed word separately, and the
  matching itself is described in the note-suggest design. The row's description is the selected
  option's own line with an example ("jn sm" finds Jane Smith; "an mit" does not), so the row is
  drawn by hand like "Suggest notes from".
- **Where suggestions appear** — a row showing the enabled sections ("Text · Code blocks") that
  opens a sub-page. The page lists "Text" (on, locked) and toggles for code blocks, inline code,
  math blocks, inline math, comments and frontmatter, all off by default. Tags, URLs and the inside
  of `[`…`]` have no toggle: a link there would break what it sits in.

**Layout.** Rows within a group have no rules between them and less vertical padding than
Obsidian's default; a rule sits above the heading of the second and third groups. The folder list
belongs to the first group and has no rule above it: it is indented under the dropdown, sits close
below it, and its title is set like a muted row label rather than a section heading. The sub-page uses the same compact rows.

### Group: What to show

- **Extra aliases per note** — dropdown: None / 1 / 2 / 3 or more. Default "3 or more", which shows
  them all.

**Alias rule.** For each matching note:
1. The name row always shows.
2. Of the aliases the typed text matches, only the closest shows as the matched alias row.
3. Every other alias is an extra: the ones that matched first, keeping their highlight, then the
   rest in frontmatter order. The setting limits how many extras show.

The better of the name row and the matched alias row comes first, then the other, then the extras.

## Storage

`data.json`, through `loadData`/`saveData`. `mergeSettings(stored)` builds the settings from
whatever was saved: each field is taken if it has the right type and range, and falls back to its
default otherwise, so a hand-edited or older file cannot break the plugin.

```ts
interface FolderEntry { path: string; subfolders: boolean }

interface LitteraNexaSettings {
  scopeMode: "vault" | "folders";
  includedFolders: FolderEntry[];
  excludedFolders: FolderEntry[];
  capitalOnly: boolean;
  minCharacters: number;
  maxWords: number;
  inCodeBlocks: boolean;
  inInlineCode: boolean;
  inMathBlocks: boolean;
  inInlineMath: boolean;
  inComments: boolean;
  inFrontmatter: boolean;
  matchRule: "prefix" | "anchored" | "substring" | "subsequence" | "typos";
  extraAliases: "0" | "1" | "2" | "all";
}
```

## Components

| File | Kind | Responsibility |
|---|---|---|
| `src/settings.ts` | pure | Settings type, `DEFAULT_SETTINGS`, `mergeSettings`, `extraAliasLimit`. |
| `src/suggest/scope.ts` | pure | `inScope(notePath, settings)`. |
| `src/settings/host.ts` | type | What the settings UI needs of the plugin (`settings`, `saveSettings`). |
| `src/settings/settings-tab.ts` | Obsidian | The tab: `getSettingDefinitions`, control storage. |
| `src/settings/folder-list.ts` | Obsidian | A folder row and its folder autocomplete. |
| `src/settings/sections-page.ts` | Obsidian | The "Where suggestions appear" page and its summary. |

Changed:
- `src/main.ts` — loads and saves settings, registers the tab, hands the suggester a settings getter.
- `src/suggest/NoteSuggest.ts` — reads live settings; collects candidates from
  `vault.getMarkdownFiles()` filtered by `inScope`; block and frontmatter checks follow the toggles.
- `src/suggest/queries.ts` — `QueryOptions` gains `inlineCode` and `inlineMath`; `minLetters`
  becomes `minCharacters`.
- `src/suggest/rank.ts` — takes the extra-alias limit and applies the alias rule.
- `src/suggest/config.ts` — deleted.
- `src/i18n/locales/en.json` — every label and description, each with a `_comment`.
- `styles.css` — the folder row, the warning line, the sections page.

## Testing

Jest: `mergeSettings` (defaults, bad values, ranges, folder entries), `inScope` (both modes,
subfolders on and off, root, nested and look-alike folder names, blank rows), the two new query
switches, and the alias rule with each limit. The page itself is checked by hand in Obsidian.

## Out of scope

- The in-memory index for large vaults (TODO item 3).
- Tab to accept (TODO item 4).
- Following a folder when it is renamed.
