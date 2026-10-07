# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working agreement

**Only explicit acceptance is acceptance.** Nothing else counts — not a correction, not a question,
not feedback on a draft, not silence, not "that reads better". If the user critiques a proposal and
you incorporate the critique, the result is a *new proposal* that also needs acceptance. Two rounds
of feedback are still zero approvals.

**Show, don't write.** When asked to show, propose, draft, or explain a change, put it in the reply
as text. Do not touch a file. An instruction to show something is never also an instruction to
apply it, however clear the resulting change seems.

**One asked-for thing at a time.** Do what was requested, not the adjacent work you noticed while
doing it. Surface the rest as a list and let the user pick. Finding a real problem is a reason to
mention it, never a licence to fix it uninvited.

**English only until the end.** While the work is in progress, `en.json` is the only locale to
touch. Translating the others is the second-to-last step before a commit, once the English has
stopped moving. Run `npm run build` and `npm test` during the work; `npm run validate-translations`
fails on a key the locales do not have yet, so leave `npm run release-check` for after the
translation pass.

**Ask when uncertain, before acting.** If a request could mean two things, say so and wait. Do not
pick the likelier reading and proceed. Guessing wrong wastes more of the user's time than asking.

## Commands

```bash
npm run dev                    # esbuild watch mode (rebuilds on save — use with Hot Reload plugin)
npm run build                  # TypeScript check + eslint + production bundle → main.js
npm test                       # Jest unit tests (pure logic only, no Obsidian API)
npm run validate-translations  # every locale has exactly en.json's keys, none blank
npm run release-check          # all three, in the order the Release workflow runs them
```

**During development**: symlink this folder into `<vault>/.obsidian/plugins/littera-nexa/` and
install the [Hot Reload](https://github.com/pjeby/hot-reload) community plugin. With `npm run dev`
running, any source change auto-reloads the plugin without restarting Obsidian.

## Architecture

**Purpose**: suggest notes while typing in the editor, and turn the chosen one into a wikilink.

### Key files

| File | Role |
|---|---|
| [src/main.ts](src/main.ts) | Plugin entry point |
| [src/i18n/i18n.ts](src/i18n/i18n.ts) | i18next init; every user-visible string goes through `t()` |
| [src/suggest/NoteSuggest.ts](src/suggest/NoteSuggest.ts) | `EditorSuggest` subclass: triggers on typed text, collects notes and aliases, renders rows, inserts the link |
| [src/suggest/queries.ts](src/suggest/queries.ts) | Pure: which search texts the text before the cursor yields |
| [src/suggest/match.ts](src/suggest/match.ts) | Pure: whether typed text matches a name or alias, word by word under the matching rule, with score and highlight ranges |
| [src/suggest/rank.ts](src/suggest/rank.ts) | Pure: which rows to show and in what order |
| [src/suggest/links.ts](src/suggest/links.ts) | Pure: wikilink text and alias filtering |
| [src/suggest/scope.ts](src/suggest/scope.ts) | Pure: whether a note is in the suggested scope |
| [src/settings.ts](src/settings.ts) | Pure: settings type, defaults, validation of saved data |
| [src/settings/settings-tab.ts](src/settings/settings-tab.ts) | Settings tab (Obsidian 1.13 declarative definitions); `folder-list.ts` draws the folder rows, `sections-page.ts` the sub-page |

### i18n

Every user-visible string lives in `src/i18n/locales/`. `en.json` is the source of truth and
carries a `<key>_comment` sibling for each key explaining its context to translators. It is also
the only one to write while a change is still being worked on — see "English only until the end"
above. Every other locale must have exactly en's key set with no blank values —
`npm run validate-translations` enforces this, and the Release workflow gates on it.
`sample_lang.json` is the template for adding a language: it carries every key, and only it may
leave values blank.

### Releases

`.github/workflows/release.yml` is run by hand (Actions → Release → Patch/Minor/Major). It owns the
version in all three files — `manifest.json`, `versions.json`, `package.json` — so never bump them
by hand. It gates on translations, build and tests, commits and tags the bump, and creates a
**draft** GitHub release with `main.js`, `styles.css` and `manifest.json` attached.

## CSS rules

- **No `!important`** — increase selector specificity or use CSS variables instead.
- **No inline styles** — style through `styles.css` and class names, never `style=""`.
- **No partially-supported CSS properties** — Obsidian's embedded Chromium lags behind the latest
  spec. Known problematic properties: `text-decoration-color`, `text-decoration-thickness`,
  `text-decoration-skip-ink`. Use `text-decoration: underline` without sub-properties; style links
  via `color` and the shorthand only.
- **No `column-gap`** — it belongs to the multi-column spec, so Obsidian flags it as partially
  supported even inside a grid. Use the `gap` shorthand, and `gap: <row> <column>` when the two
  values differ.
- **Use Obsidian CSS variables** for all colors, fonts, spacing — never hardcode values that themes
  should control.
