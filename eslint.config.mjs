// eslint.config.mjs
import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

export default defineConfig([
  { ignores: ["main.js", "node_modules/**", "*.config.mjs", "*.config.js"] },
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: "./tsconfig.json" },
      globals: {
        ...globals.browser
      },
    },

    rules: {
      "obsidianmd/sample-names": "off",
      // The obsidianmd preset passes only { args: "none" }, which resets
      // ignoreRestSiblings back to the rule default (false). Re-enable it so
      // `const { dropMe, ...rest } = obj` — the standard omit-a-key idiom —
      // isn't flagged, and honour the `_name` convention for deliberate
      // discards.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { args: "none", ignoreRestSiblings: true, varsIgnorePattern: "^_" },
      ],
      "obsidianmd/prefer-file-manager-trash-file": "error",
      "obsidianmd/ui/sentence-case": [
        "warn",
        {
          brands: ["Littera Nexa"],
          acronyms: [],
          ignoreWords: [],
          enforceCamelCaseLower: true
        },
      ],
    },
  },
]);
