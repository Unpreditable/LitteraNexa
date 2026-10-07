import {
  App,
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  parseFrontMatterAliases,
  renderResults,
  SearchResult,
  SectionCache,
  setIcon,
  TFile,
} from "obsidian";
import { extraAliasLimit, LitteraNexaSettings } from "../settings";
import { buildLink, isLinkableAlias } from "./links";
import { matchWords } from "./match";
import { findQueries, Query } from "./queries";
import { rank } from "./rank";
import { inScope } from "./scope";

interface Candidate {
  file: TFile;
  /** The note name or the alias the query is matched against. */
  text: string;
  alias: string | null;
  /** Small line under the title: the folder for a name, the note's path for an alias. */
  note: string;
}

interface NoteMatch extends Candidate {
  query: Query;
  result: SearchResult;
}

export class NoteSuggest extends EditorSuggest<NoteMatch> {
  /** Queries found by the last onTrigger; the context has no room for them. */
  private queries: Query[] = [];

  constructor(
    app: App,
    /** Read on every keystroke, so a changed setting applies at once. */
    private readonly settings: () => LitteraNexaSettings,
  ) {
    super(app);
  }

  onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null): EditorSuggestTriggerInfo | null {
    if (!file) return null;
    const settings = this.settings();
    const line = editor.getLine(cursor.line);
    const queries = findQueries(line.slice(0, cursor.ch), line.slice(cursor.ch), {
      capitalOnly: settings.capitalOnly,
      minCharacters: settings.minCharacters,
      maxWords: settings.maxWords,
      inlineCode: settings.inInlineCode,
      inlineMath: settings.inInlineMath,
    });
    if (queries.length === 0 || (this.isNoteEditor(editor) && this.isExcluded(file, cursor.line))) return null;

    this.queries = queries;
    const startCh = queries[0].startCh;
    return {
      start: { line: cursor.line, ch: startCh },
      end: cursor,
      query: line.slice(startCh, cursor.ch),
    };
  }

  getSuggestions(context: EditorSuggestContext): NoteMatch[] {
    const candidates = this.collectCandidates(context.file);
    const matches: NoteMatch[] = [];
    const rule = this.settings().matchRule;
    for (const query of this.queries) {
      for (const candidate of candidates) {
        const result = matchWords(query.text, candidate.text, rule);
        if (result) matches.push({ ...candidate, query, result });
      }
    }
    return rank(matches, candidates, extraAliasLimit(this.settings().extraAliases));
  }

  renderSuggestion(match: NoteMatch, el: HTMLElement): void {
    // Obsidian's own suggestion classes, so rows look like the native [[ ones in every theme.
    el.addClass("mod-complex");
    const content = el.createDiv({ cls: "suggestion-content" });
    renderResults(content.createDiv({ cls: "suggestion-title" }), match.text, match.result);
    content.createDiv({ cls: "suggestion-note", text: match.note });
    if (match.alias) setIcon(el.createDiv({ cls: "suggestion-aux" }).createSpan({ cls: "suggestion-flair" }), "forward");
  }

  selectSuggestion(match: NoteMatch, evt: MouseEvent | KeyboardEvent): void {
    const context = this.context;
    if (!context) return;
    const target = this.app.metadataCache.fileToLinktext(match.file, context.file.path);
    const line = context.start.line;
    // A live-preview cell needs no escaping here: Obsidian escapes the | when it writes the cell back.
    const inTable =
      this.isNoteEditor(context.editor) &&
      (this.sectionAt(context.file, line)?.type === "table" || context.editor.getLine(line).trimStart().startsWith("|"));
    const link = buildLink(target, match.file.basename, match.alias, inTable);
    const start = { line: context.start.line, ch: match.query.startCh };
    context.editor.replaceRange(link, start, context.end);
    context.editor.setCursor({ line: start.line, ch: start.ch + link.length });
  }

  /**
   * False inside a live-preview table cell, which Obsidian edits in a small editor of its own. Line
   * numbers there are the cell's, so they can't be looked up in the note's metadata cache.
   */
  private isNoteEditor(editor: Editor): boolean {
    return this.app.workspace.activeEditor?.editor === editor;
  }

  private isExcluded(file: TFile, line: number): boolean {
    const settings = this.settings();
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatterPosition;
    if (!settings.inFrontmatter && fm && line >= fm.start.line && line <= fm.end.line) return true;
    const type = this.sectionAt(file, line)?.type;
    return (
      (type === "code" && !settings.inCodeBlocks) ||
      (type === "math" && !settings.inMathBlocks) ||
      (type === "comment" && !settings.inComments)
    );
  }

  private sectionAt(file: TFile, line: number): SectionCache | undefined {
    return this.app.metadataCache
      .getFileCache(file)
      ?.sections?.find((s) => line >= s.position.start.line && line <= s.position.end.line);
  }

  private collectCandidates(current: TFile): Candidate[] {
    const settings = this.settings();
    const files = this.app.vault.getMarkdownFiles().filter((file) => file !== current && inScope(file.path, settings));

    const candidates: Candidate[] = [];
    for (const file of files) {
      // The root's own path is already "/".
      const folder = !file.parent || file.parent.isRoot() ? "/" : `${file.parent.path}/`;
      candidates.push({ file, text: file.basename, alias: null, note: folder });
      const path = file.path.slice(0, -file.extension.length - 1);
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      for (const alias of parseFrontMatterAliases(frontmatter) ?? []) {
        if (isLinkableAlias(alias)) candidates.push({ file, text: alias, alias, note: path });
      }
    }
    return candidates;
  }
}
