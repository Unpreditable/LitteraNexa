# Contributing

Thanks for your interest in Littera Nexa! There are four ways to contribute:

- [Report a bug](#report-a-bug)
- [Request a feature](#request-a-feature)
- [Submit a translation](#submit-a-translation)
- [Submit a code change](#submit-a-code-change)

---

## Report a Bug

[Open an issue](https://github.com/Unpreditable/LitteraNexa/issues) — check for duplicates first.

A useful report includes:

- **Obsidian version** — Settings → About
- **Littera Nexa version** — Settings → Community plugins
- **Steps to reproduce** — what you did, what you expected, what happened instead

---

## Request a Feature

[Open an issue](https://github.com/Unpreditable/LitteraNexa/issues) and label it `enhancement`.

Describe the problem you are trying to solve rather than the specific solution — this helps
evaluate whether the request fits the plugin's direction. Feature implementation is handled by the
maintainer.

---

## Submit a Translation

The plugin uses Obsidian's interface language setting and defaults to English for unsupported
languages.

### Improve an existing translation

1. Browse to the [locales folder](https://github.com/Unpreditable/LitteraNexa/tree/main/src/i18n/locales)
   and open your language file.
2. Click the pencil icon to edit on GitHub (fork when prompted).
3. Fix or fill in any strings. For context on what each key means, refer to the `_comment` fields
   in [`en.json`](https://github.com/Unpreditable/LitteraNexa/blob/main/src/i18n/locales/en.json).
4. Open a pull request.

### Add a new language

1. Open [`sample_lang.json`](https://github.com/Unpreditable/LitteraNexa/blob/main/src/i18n/locales/sample_lang.json)
   — it contains every translatable key with blank values.
2. Click the pencil icon to edit on GitHub (fork when prompted).
3. Fill in every blank value with your translation. For context on what each key means, refer to
   the `_comment` fields in `en.json`.
4. Save the file as `<locale>.json`, where `<locale>` is the BCP 47 language tag for your language
   — typically a two-letter [ISO 639-1 code](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes)
   such as `fr`, `de`, or `zh`. For regional variants add a subtag: `zh-TW` for Traditional
   Chinese, `pt-BR` for Brazilian Portuguese, and so on.
5. Optionally, register the language in `src/i18n/i18n.ts` by adding an import line and an entry in
   the `resources` object. This step is optional — if you would rather skip it, submit the JSON
   file and the maintainer will wire it up.

Every locale must carry exactly the keys in `en.json`, with no blank values.
`npm run validate-translations` checks this, and a release cannot ship without it passing.

---

## Submit a Code Change

```bash
git clone https://github.com/Unpreditable/LitteraNexa.git
cd LitteraNexa
npm install
npm run dev
```

Symlink the folder into `<vault>/.obsidian/plugins/littera-nexa/` and install
[Hot Reload](https://github.com/pjeby/hot-reload) so changes apply without restarting Obsidian.

Before opening a pull request, run:

```bash
npm run release-check
```

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
(`feat:`, `fix:`, `docs:`, `chore:`, …).
