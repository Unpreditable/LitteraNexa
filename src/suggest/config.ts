// Hardcoded for v1. Each of these becomes a setting once the plugin has a settings tab.

/** Folder whose notes are suggested. */
export const FOLDER = "People";
/** Whether notes in subfolders of FOLDER are suggested too. */
export const INCLUDE_SUBFOLDERS = true;
/** Only words starting with an uppercase letter can start a query. */
export const CAPITAL_ONLY = true;
/** Fewest letters and digits a query needs before suggestions appear. */
export const MIN_LETTERS = 3;
/** Most words a query may span, counting the one at the cursor. */
export const MAX_WORDS = 3;
