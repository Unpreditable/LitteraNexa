# End-to-end test harness: design

Date: 2026-10-10

## Goal

Confirm behaviour in a real Obsidian without doing it by hand. A general harness that scripts any
behaviour, with the menus checklist (`docs/manual-tests/other-plugins-menus.md`) as its first suite.
It runs on the developer's Windows machine only, and it must be easy to copy into another plugin.

## Approach

WebdriverIO with `wdio-obsidian-service`. It downloads its own Obsidian, launches it sandboxed
beside whatever Obsidian is already open, loads this build and a vault, and drives it with real key
events. Real keys matter: pasted or dispatched text does not open a suggester's menu the way typing
does.

Rejected: Playwright attached to the installed Obsidian (we would write and own the vault
registration, the trust prompt, the downloads, the resets and the restarts, and it tests whichever
version happens to be installed), and a runner inside Obsidian driven by the Obsidian CLI (simulated
typing, and it needs the developer's own running Obsidian).

## Layout

One folder, copied whole into another plugin:

```
e2e/
  wdio.conf.mts        generic: reads e2e.config.ts, nothing plugin-specific
  tsconfig.json        generic
  support/             generic helpers
  e2e.config.ts        plugin-specific: third-party plugins and versions, Obsidian version, vault
  vault/               plugin-specific: notes and third-party plugin settings
  specs/               plugin-specific: the suites
  README.md            how to run, and the steps to copy it into another plugin
  .output/             gitignored: what a failed test leaves behind
.obsidian-cache/       gitignored: Obsidian and third-party plugin downloads
```

- The generic files are never edited per plugin. Copying means copying `e2e/`, emptying `vault/` and
  `specs/`, and editing `e2e.config.ts`.
- The plugin under test is the one at the repo root, its id read from `manifest.json`. No generic
  file names it.
- Portability is by copying the folder, not by a shared npm package.

Outside the folder, and listed in `e2e/README.md` as the copy checklist:

- the dev dependencies;
- a `test:e2e` script in `package.json` that builds, then runs the suites;
- `.gitignore`: `.obsidian-cache/` and `e2e/.output/` ignored, and `e2e/vault/` exempted from the
  existing `data.json` and `.obsidian/` rules, which would otherwise drop the fixture's settings;
- `e2e/` kept out of Jest and of the main `tsconfig`.

`npm test` stays as it is. `test:e2e` is not part of `release-check` or of CI.

## Third-party plugins

`e2e.config.ts` names each plugin by its community id and a pinned version. The service downloads
them into `.obsidian-cache/` and reuses them, so a run touches the network only when something is
missing or its version changed. To confirm when planning: the field that pins a community plugin's
version. If the service cannot pin one, that is raised before going further.

The Obsidian app and installer versions are pinned in the same file.

## Vault

`e2e/vault/` is checked in. Each run opens a copy of it, so a failed run cannot leave the fixture
changed. It holds only what the specs name:

- the notes: *Jane* and *Monica* in a folder in scope, and nothing starting with `Zzz`;
- a `data.json` for each third-party plugin with the settings the suite relies on: Tasks' minimum
  match length at 0, Kalendae's type-to-insert on with trigger `@`;
- no `data.json` for the plugin under test, so it starts at its defaults.

## Helpers

A small fixed set in `support/`, none of which knows the plugin under test. A helper specific to
one plugin goes beside its specs.

| Helper | What it does |
|---|---|
| `openEmptyNote()` | Creates a scratch note, opens it, puts the caret in the editor |
| `type(text)`, `press(key)` | Sends real key events, one character at a time |
| `menu()` | `null` when no menu shows, otherwise `{ owner, rows }` |
| `line()`, `noteText()` | Reads the caret's line, or the whole note |
| `setPluginSettings(id, patch)` | Changes a plugin's settings through its own save path, no restart |
| `togglePlugin(id)`, `restartObsidian()` | For load order |
| `consoleErrors()` | The errors logged since the test began |

- `menu()` polls until the menu state stops changing; no spec sleeps for a fixed time. "No menu" is
  the state staying empty for the settle period.
- Every test fails on a console error unless it opts out.

### Naming the owner of a menu

Obsidian does not record which plugin registered a suggester, and third-party class names are
minified. The plan starts with a spike to prove one of these, in order:

1. match the open suggester against the suggesters each plugin registered, read from Obsidian's
   internals at startup;
2. a per-plugin recogniser in `e2e.config.ts`, such as a CSS class on the menu's rows.

If neither holds, specs assert on `rows` alone, and that is raised before it is settled for.

## A spec

One `it` per checklist row, carrying the row's number:

```ts
describe("Tasks: a line-wide menu is replaced while a note matches", () => {
  beforeEach(() => openEmptyNote());

  it("3.2 replaces Tasks' menu at the n", async () => {
    await type("- [ ] call Ja");
    expect(await menu()).toMatchObject({ owner: "obsidian-tasks-plugin" });
    await type("n");
    expect(await menu()).toMatchObject({ owner: "littera-nexa", rows: ["Jane"] });
  });
});
```

## State between tests

| Level | When | Cost |
|---|---|---|
| Fresh scratch note | Before every test | Milliseconds |
| Vault files and plugin settings back to the fixture | Before every `describe` | Under a second |
| Obsidian restarted on a new copy of the vault | Only in suites that ask for it | 10–20 s |

A test that changes a setting does not undo it. Suites run one after another in a single window:
parallel windows would take keyboard focus from each other.

## Failures

A failed test leaves in `e2e/.output/`: a screenshot from the moment of failure, the console log of
that test, and the registered suggesters in asking order.

## Running

- `npm run test:e2e` builds, then runs everything.
- `npm run test:e2e -- --spec menus` runs one file.
- The Obsidian window is visible and takes keyboard focus for the length of the run. The first run
  also downloads Obsidian and the plugins.

## The first suite

`e2e/specs/menus.e2e.ts`, from `docs/manual-tests/other-plugins-menus.md`:

| Checklist section | In the suite | Note |
|---|---|---|
| 1. Plain text | All 4 rows | |
| 2. Kalendae | All 6 rows, and the `@@` repeat | Trigger changed through `setPluginSettings` |
| 3. Tasks | 3.1 to 3.6 | |
| 3.7 `call @Jan` | Reported, not asserted | No fixed answer: prints which menu showed, always passes |
| 4. The setting | All 4 rows, and "applies without a reload" | |
| 5. Load order | All 4 steps | The part that restarts Obsidian |
| 6.1 Table cell | In | If it proves unreliable, that is raised, not dropped |
| 6.2 Two panes | In | |
| 6.3 Console errors | Covered by every test | |

No other suite is written now.

## Also in scope

- `CLAUDE.md`: `test:e2e` added to the Commands block, with a note that it runs on this machine only
  and is not part of `release-check`.
- `docs/manual-tests/other-plugins-menus.md` deleted once the suite passes.

## Out of scope

- `README.md`: user-facing, not touched.
- CI, `release-check`, a shared npm package, any suite beyond the menus checklist.
