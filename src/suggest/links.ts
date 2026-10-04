/**
 * The wikilink for a note. It displays the alias if one was picked, and the bare name when the
 * target had to be a path to tell same-named notes apart.
 */
export function buildLink(target: string, name: string, alias: string | null, inTable: boolean): string {
  const display = alias ?? (target === name ? null : name);
  if (!display) return `[[${target}]]`;
  // A bare | would split the table cell, so tables get the escaped form, as Obsidian's own [[ does.
  return `[[${target}${inTable ? "\\|" : "|"}${display}]]`;
}

/** Whether a frontmatter alias can be shown and inserted as a link's display text. */
export function isLinkableAlias(alias: unknown): alias is string {
  return typeof alias === "string" && alias.trim() !== "" && !/\[\[|\]\]|\|/.test(alias);
}
