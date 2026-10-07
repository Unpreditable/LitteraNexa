# Note suggest: design

Date: 2026-10-03

## Goal

While typing prose, suggest notes from a known set and turn the chosen one into a wikilink, without
typing `[[` first. This saves the brackets (and the `[{` typo from pressing Shift too early), and it
surfaces notes the writer may have forgotten exist.

Obsidian's native `[[` suggester is not changed or replaced.

## Scope and tunables

Which notes are suggested, the trigger rules, the places suggestions appear and the alias rows are
settings; see `2026-10-04-settings-design.md`. This document describes the behaviour at the
defaults. Where it names a constant, read the setting of the same meaning: `CAPITAL_ONLY` is
"Capital letters only", `MIN_LETTERS` "Minimum characters", `MAX_WORDS` "Maximum words", and
`People/` whatever the scope covers (the entire vault by default).

- A note matches on its name or on any of its frontmatter aliases.

## Behaviour

### Triggering

On every keystroke, the text on the current line before the cursor is examined from scratch. No
state is kept between keystrokes, so backspacing after the popup closed brings it back.

- Look back at most `MAX_WORDS` (3) words from the cursor, the word at the cursor included.
- Every word in that range starting with an uppercase letter (`\p{Lu}`, so any script) or a digit
  is a possible start (`CAPITAL_ONLY`; when false, every word is). The query for a start is the
  text from that character up to the cursor, so `3Mxx` searches for "3Mxx".
- A query needs at least `MIN_LETTERS` (3) letters or digits, counted per query.
- All queries are searched and their results combined.

Example: with the cursor after `Then I deci`, the queries are `Then I deci` (start 0) and `I deci`
(start 5). Notes "Then I decided" and "I decided" both appear.

### Words and boundaries

- Words are split on whitespace.
- Leading punctuation is skipped: in `(John` the query starts at `J`.
- Any other punctuation ends the lookback: in `said, John Sm` the only start is `John`.
- Apostrophes and hyphens stay inside words (`O'Brien`, `Jean-Luc`).
- Whitespace between the last word and the cursor keeps the popup open but is not part of the
  query: `John ` shows the same rows as `John`. Picking a row there replaces the whitespace too.
- Apart from that whitespace, the text must end in a word character: `said, ` does not trigger.
- If the character after the cursor is a letter or digit (cursor mid-word), there is no trigger.

### Where it never triggers

Checked on the current line:
- After an unclosed `[`. This covers an open `[[` (native suggestions own that space) and the text
  of a markdown link.
- Inside inline code: an odd number of backticks before the cursor.
- Inside inline math: an odd number of `$` before the cursor, `\$` not counted. A lone currency
  sign (`costs $5 John`) therefore also suppresses the popup. Accepted.
- A word right after `#` (a tag).
- A word glued to preceding text that contains `/` (a URL or path).

Checked against `metadataCache.getFileCache(file)`:
- Frontmatter (`frontmatterPosition`).
- Sections of type `code`, `math` or `comment`.

The cache updates shortly after typing, so a block opened a moment ago may briefly show the popup.
Accepted for v1.

In live preview Obsidian edits a table cell in a small editor of its own, whose line numbers are the
cell's, not the note's. The cache checks are skipped there (detected as an editor other than
`workspace.activeEditor.editor`); the current-line checks still apply.

### Matching

- Word-by-word matching by the plugin's own `matchWords` (since 2026-10-06; before that, Obsidian's
  `prepareFuzzySearch`, which let typed letters match across a space: `js mi` found "Jane Smith").
  - Words are split on whitespace only, in the typed text and in the name. Case and accents are
    ignored.
  - Every typed word must fit a different word of the name, in the name's order. Words of the name
    may be skipped: `ja sm` finds "Jane Marie Smith", `smith jane` finds nothing.
  - What fitting a word means is the "Matching rule" setting, applied to each word on its own:

    | Rule | Fits "Smith" | Does not |
    |---|---|---|
    | Start of word | `smi` | `smt`, `mit` |
    | First letter, then letters in order (default) | `smi`, `smt` | `mit` |
    | Part of word | `smi`, `mit` | `smt` |
    | Letters in order | `smi`, `smt`, `mit`, `mth` | |
    | Start of word, allowing typos | `smi`, `smyt`, `smtih` | `smt`, `mith` |

  - A typo is one wrong, missing, extra or swapped letter, counted against the start of the word.
    A typed word of up to three letters may have none, up to seven one, eight or more two, and its
    first letter must be right.
  - The score orders tighter fits first — exact word, start of word, then a run of letters inside
    the word or one typo, then scattered letters or two typos — then names with fewer unmatched
    words, then shorter names. When a name can be fitted more than one way, the tightest is taken
    and highlighted, the earlier words on a tie.
- Each query is run against each note's name and each alias.
- Aliases are read with `parseFrontMatterAliases` (handles a string, a list, and legacy `alias:`).
  An alias is skipped if it is not text, is blank, or contains `[[`, `]]` or `|`.
- The note being edited is excluded.
- A missing or empty `People/` folder yields no suggestions and no error.

### Rows and ranking

- A note that matches at all gets a row for every name or alias that matched, followed by a row for
  each of its other names and aliases. The unmatched rows are offered so that, for example, typing
  `Smith` still lets the writer pick the alias `Jane` of "Jane Smith".
- When one name matches several queries, the longer query wins, so picking it replaces all the
  typed text it covers — but only if every query word except the last starts a word of the name, in
  order. `Met Anna` against "Margaret Annabel" therefore keeps the `Anna` match, and "Met" stays.
  Otherwise the better score wins.
- An unmatched row uses the query of its note's best row.
- A note's rows stay together, best row first.
- Notes are ordered by how much typed text their best row covers (longer query first); the match
  score only settles notes found by queries of the same length, since scores from queries of
  different lengths are not comparable.

### Popup rows

Rows use Obsidian's own suggestion markup and classes (`mod-complex`, `suggestion-content`,
`suggestion-title`, `suggestion-note`, `suggestion-aux`, `suggestion-flair`), so every theme styles
them like native `[[` rows. The plugin adds no CSS.

- Name row: the note name as title, its folder (`People/Work/`) as the small line under it.
- Alias row: the alias as title, the note's path without extension (`People/John Smith`) under it,
  and a `forward` icon on the right.
- Matched letters are highlighted with `renderResults`; unmatched rows have no highlight.
- No instructions footer and no fixed UI text, so no locale changes.

### Selection

- Enter accepts (the `EditorSuggest` default). Escape closes.
- Enter at a line end while the popup is open inserts the link, not a line break. Accepted.
- `editor.replaceRange` replaces the text from the selected row's own query start up to the cursor.
  Picking "I decided" in the example above replaces `I deci` and leaves `Then ` alone.
- Inserted text: `[[target]]` for a name row, `[[target|Alias]]` for an alias row, where the alias
  is written as it appears in frontmatter and `target` comes from
  `metadataCache.fileToLinktext(file, currentFile.path)` (shortest unambiguous link, as native).
- When the target has to be a path because another note shares the name, a name row displays the
  bare name: `[[People/Test Sub/Olivia Brandt|Olivia Brandt]]`, as native does.
- In a table (a `table` section in the cache, or a line starting with `|`) the `|` separator is
  written `\|`, as native does, so the cell is not split. Inside a live-preview cell editor a plain
  `|` is inserted and Obsidian escapes it when it writes the cell back to the note.
- The cursor ends right after `]]`, with no trailing space.

## Components

All in `src/suggest/`.

| File | Kind | Responsibility |
|---|---|---|
| `queries.ts` | pure | `findQueries(before, after, opts) → { text, startCh }[]`, including every current-line check. |
| `match.ts` | pure | `matchWords(query, text, rule) → { score, matches } \| null`: the word-by-word match. |
| `rank.ts` | pure | `rank(matches, candidates)`: choose, group and order the rows. |
| `links.ts` | pure | `buildLink(target, alias, inTable)` and `isLinkableAlias(alias)`. |
| `NoteSuggest.ts` | Obsidian | `EditorSuggest` subclass: `onTrigger`, `getSuggestions`, `renderSuggestion`, `selectSuggestion`. |

`onTrigger` returns a trigger range starting at the earliest query start (where Obsidian anchors the
popup) and keeps the queries in a private field, because `EditorSuggestContext` has no room for
them. `getSuggestions` walks the folder subtree via `vault.getFolderByPath(FOLDER)` — only that
subtree, not the whole vault — collects names and aliases, runs `matchWords` per query, and
passes the matches and all candidates to `rank`.

`main.ts` registers it: `this.registerEditorSuggest(new NoteSuggest(this.app))`.

## Testing

Jest covers the pure units: `tests/queries.test.ts`, `tests/match.test.ts`, `tests/rank.test.ts`, `tests/links.test.ts`.
`NoteSuggest.ts` is API glue and is checked by hand in Obsidian.

## Later

1. Vault-wide index (keep names and aliases in memory, updated on vault and metadata events) for
   scopes with thousands of files.
2. Tab to accept.
