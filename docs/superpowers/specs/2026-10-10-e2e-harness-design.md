# End-to-end tests: design

Date: 2026-10-10, brought up to date with what was built on 2026-10-11

## Goal

Confirm behaviour in a real Obsidian without doing it by hand. A general harness that scripts any
behaviour, with the manual checklist for other plugins' menus as its first suite. It runs on the
developer's Windows machine only, and other plugins must be able to use it.

## Approach

WebdriverIO with `wdio-obsidian-service`. It downloads its own Obsidian, launches it sandboxed
beside whatever Obsidian is already open, loads this build and a vault, and drives it with real key
events. Real keys matter: pasted or dispatched text does not open a suggester's menu the way typing
does.

Rejected: Playwright attached to the installed Obsidian (we would write and own the vault
registration, the trust prompt, the downloads, the resets and the restarts, and it tests whichever
version happens to be installed), and a runner inside Obsidian driven by the Obsidian CLI (simulated
typing, and it needs the developer's own running Obsidian).

## Two repos

The harness is a repo of its own, `ObsidianE2EHarness`, checked out in the folder beside each
plugin. This repo holds only what is Littera Nexa's:

```
e2e/
  e2e.config.json      Obsidian version, third-party plugins and their versions
  tsconfig.json        so the specs are type-checked
  harness.d.ts         a copy of the harness's declarations of what a spec can use
  vault/               notes and third-party plugin settings
  specs/               the suites
  README.md
  .output/             gitignored: what a failed test leaves behind
```

and one script, `"test:e2e": "npm run build && node ../ObsidianE2EHarness/bin/obsidian-e2e.mjs"`.

It was first built as a folder to copy into each plugin. That was given up for one reason:
Obsidian's plugin review reads every TypeScript file in a plugin's repo as plugin code. It warned
about each Node import, each import of a test package (none is a dependency of the plugin), the
console capture and the fixture's `.obsidian` path, and none of that can be written another way.
What the review does not object to is a test file that imports nothing, as the Jest tests under
`tests/` already showed. So:

- The harness, with all its imports and all the test tooling, lives where the review never looks.
- A spec here has no imports. `describe`, `it`, `expect`, `browser` and the helpers are globals the
  harness provides.
- Their types are in `e2e/harness.d.ts`, a copy kept in this repo. The review type-checks the specs
  with no harness beside them; typed from the sibling checkout, every helper call was a warning
  there. The file depends on nothing but `obsidian`. A run refuses to start while the copy differs
  from the harness's own.
- This repo installs no test tooling: its `package.json` is as it was before, but for the script.

The harness repo is private, so it is not an npm dependency: CI and the Release workflow run
`npm ci` and could not fetch it. A plugin uses whichever version is checked out beside it; nothing
pins one to the other yet.

`npm test` stays as it is. `test:e2e` is not part of `release-check` or of CI. `eslint.config.mjs`
names `e2e/tsconfig.json` and `tsconfig.test.json` as projects, so files outside `src/` show no
parsing error in the editor; `npm run lint` still covers `src/` only.

## What the harness gives a spec

Its README is the reference. In short:

- `openEmptyNote()`, `type(text)`, `press(key)` with real key events; `line()`, `noteText()`.
- `menu()`: `null` when no menu shows, otherwise `{ owner, rows }`, once the menu has stopped
  changing. The owner is found by matching the open suggester's source text against each known
  plugin's `main.js`; anything else is `"obsidian"`.
- `setPluginSettings(id, patch)`, `togglePlugin(id)`, `restartObsidian()`, `suggesters()`.
- Before each `describe`, vault files and plugin settings go back to the fixture.
- After each test, any error in Obsidian's console fails it, unless the test called
  `allowConsoleErrors()`. Errors from setup and from Obsidian starting count against the next test.
- A failed test or hook leaves a screenshot, the console log and the suggester order in
  `e2e/.output/`.
- The plugin under test is installed from its build alone, so the `data.json` at this repo's root
  never reaches the test vault.

## Pinned versions

In `e2e/e2e.config.json`: Obsidian 1.14.4 (app and installer), Tasks 8.5.0, Kalendae 1.4.0. The
harness downloads them once into its own `.obsidian-cache/`, shared by every plugin it tests.

## Vault

`e2e/vault/` is checked in. Each run opens a copy of it. It holds only what the specs name:

- the notes: *Jane* and *Monica* in `People/`, *Robert Stone* there too with the alias *Bob*,
  *Zelda* in `Archive/`, and nothing starting with `Zzz`;
- a `data.json` for each third-party plugin with the settings the suites rely on: Tasks' minimum
  match length at 0, Kalendae's type-to-insert on with trigger `@`;
- no `data.json` for Littera Nexa, so it starts at its defaults;
- `.obsidian/.gitkeep`: the vault must have its `.obsidian` folder, or the harness stops the run.

## The suites

`e2e/specs/menus.e2e.ts` is the manual checklist for other plugins' menus, which it replaced, one
test per row and carrying the row's number:

| Checklist section | In the suite | Note |
|---|---|---|
| 1. Plain text | All 4 rows | |
| 2. Kalendae | All 6 rows, and the `@@` repeat | Trigger changed through `setPluginSettings` |
| 3. Tasks | 3.1 to 3.6 | |
| 3.7 `call @Jan` | Reported, not asserted | No fixed answer. As built: Tasks at `call @Ja`, Littera Nexa at `call @Jan` |
| 4. The setting | All 4 rows, and "applies without a reload" | |
| 5. Load order | All 4 steps | The part that restarts Obsidian |
| 6.1 Table cell | In | |
| 6.2 Two panes | In | |
| 6.3 Console errors | Covered by every test | |

`e2e/specs/suggest.e2e.ts` covers what Littera Nexa does by itself and only inside Obsidian: the
link a picked row writes (Enter, click, a name of several words, an alias, a table cell), when the
list appears (minimum characters, the capital rule, the matching rule, the note being written in),
inline code and code blocks, and folder scope.

## Known gaps

- No suite covers frontmatter, comments, math, the extra-aliases setting, the settings tab's own
  controls, or mobile.
- Only the type file ties this repo to a version of the harness: a helper that keeps its shape but
  changes what it does can break these suites without anything here changing.
- A run is sensitive to the Obsidian window losing focus. Leave the machine alone while it runs.

## Out of scope

- `README.md`: user-facing, not touched.
- CI and `release-check`.
