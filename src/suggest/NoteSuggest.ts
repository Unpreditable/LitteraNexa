import {
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  parseFrontMatterAliases,
  prepareFuzzySearch,
  renderResults,
  SearchResult,
  SectionCache,
  setIcon,
  TFile,
  Vault,
} from "obsidian";
import { CAPITAL_ONLY, FOLDER, INCLUDE_SUBFOLDERS, MAX_WORDS, MIN_LETTERS } from "./config";
import { buildLink, isLinkableAlias } from "./links";
import { findQueries, Query } from "./queries";
import { rank } from "./rank";

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

// Sections where a link makes no sense.
const EXCLUDED_SECTIONS = new Set(["code", "math", "comment"]);

const OPTIONS = { capitalOnly: CAPITAL_ONLY, minLetters: MIN_LETTERS, maxWords: MAX_WORDS };

export class NoteSuggest extends EditorSuggest<NoteMatch> {
  /** Queries found by the last onTrigger; the context has no room for them. */
  private queries: Query[] = [];

  onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null): EditorSuggestTriggerInfo | null {
    if (!file) return null;
    const line = editor.getLine(cursor.line);
    const queries = findQueries(line.slice(0, cursor.ch), line.slice(cursor.ch), OPTIONS);
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
    for (const query of this.queries) {
      const search = prepareFuzzySearch(query.text);
      for (const candidate of candidates) {
        const result = search(candidate.text);
        if (result) matches.push({ ...candidate, query, result });
      }
    }
    return rank(matches, candidates);
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
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatterPosition;
    if (fm && line >= fm.start.line && line <= fm.end.line) return true;
    return EXCLUDED_SECTIONS.has(this.sectionAt(file, line)?.type ?? "");
  }

  private sectionAt(file: TFile, line: number): SectionCache | undefined {
    return this.app.metadataCache
      .getFileCache(file)
      ?.sections?.find((s) => line >= s.position.start.line && line <= s.position.end.line);
  }

  private collectCandidates(current: TFile): Candidate[] {
    const folder = this.app.vault.getFolderByPath(FOLDER);
    if (!folder) return [];

    const files: TFile[] = [];
    const add = (f: unknown) => {
      if (f instanceof TFile && f.extension === "md" && f !== current) files.push(f);
    };
    if (INCLUDE_SUBFOLDERS) Vault.recurseChildren(folder, add);
    else folder.children.forEach(add);

    const candidates: Candidate[] = [];
    for (const file of files) {
      candidates.push({ file, text: file.basename, alias: null, note: `${file.parent?.path ?? ""}/` });
      const path = file.path.slice(0, -file.extension.length - 1);
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      for (const alias of parseFrontMatterAliases(frontmatter) ?? []) {
        if (isLinkableAlias(alias)) candidates.push({ file, text: alias, alias, note: path });
      }
    }
    return candidates;
  }
}
