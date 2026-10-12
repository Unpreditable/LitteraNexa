# End-to-end tests

These tests drive a real Obsidian with real key presses, and check what a person typing would see.
They run on your own machine only; they are not part of `release-check` or CI.

The code that runs them is not here. It is the
[ObsidianE2EHarness](https://github.com/Unpreditable/ObsidianE2EHarness) repo, checked out in the
folder beside this one (`../ObsidianE2EHarness`) with `npm install` run in it once. Its README has
the helpers a spec can use and what to look at when a test fails.

```bash
npm run test:e2e                    # build the plugin, then run every spec
npm run test:e2e -- --spec menus    # only the spec files whose path contains "menus"
npm run test:all                    # the unit tests, then every spec
```

Each ends with a line to read at a glance; `test:all` with two:

```
unitTests: 85/85 pass; 15s
e2e: 44/44 pass; 1m 28s
```

An Obsidian window opens and takes the keyboard until the run ends, so leave the machine alone
meanwhile.

## What is here

| Path | What |
|---|---|
| `e2e.config.json` | The Obsidian version, and Tasks and Kalendae at pinned versions |
| `vault/` | The notes and third-party plugin settings every run starts from |
| `specs/menus.e2e.ts` | How the list behaves beside Tasks', Kalendae's and Obsidian's own menus |
| `specs/suggest.e2e.ts` | What the plugin does by itself: when the list appears, and what picking a row writes |
| `tsconfig.json` | Type-checks the specs |
| `harness.d.ts` | The harness's declarations of everything a spec can use. A copy: do not edit it |

The spec files have no imports, and must stay that way: `describe`, `it`, `expect`, `browser` and
the helpers (`type`, `menu`, `press` and the rest) are globals the harness provides. Obsidian's
plugin review reads every TypeScript file in this repo as plugin code, and objects to an import of
anything that is not a dependency of the plugin.

`harness.d.ts` is here, and not only in the harness's repo, for the same review: it type-checks the
specs with no harness beside them, and without the declarations every helper call is a warning. A
run refuses to start while the copy differs from the harness's own; refresh it with
`node ../ObsidianE2EHarness/bin/obsidian-e2e.mjs --update-types`.
