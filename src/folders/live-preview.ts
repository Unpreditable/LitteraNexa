import { syntaxTree } from "@codemirror/language";
import { EditorState, Prec, Range } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { editorInfoField, editorLivePreviewField } from "obsidian";
import { FolderIndex } from "./folder-index";
import { findWikilinks, folderLinkPath, resolveFolder } from "./folder-links";
import { FOLDER_LINK_CLASS } from "./reading-view";

const mark = Decoration.mark({ class: FOLDER_LINK_CLASS });

/**
 * Live preview: wraps each link to a folder that exists in a span whose class cancels the
 * unresolved look of Obsidian's own span inside it. Lowest precedence, because CodeMirror nests a
 * lower-precedence mark outside a higher one; the look is cancelled through CSS variables, which
 * only reach inward. Source mode draws links as plain text, so nothing is marked there.
 */
export function folderLinkExtension(index: FolderIndex<{ path: string }>) {
  return Prec.lowest(
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
          this.decorations = buildVisible(index, view);
        }

        update(update: ViewUpdate): void {
          const live = update.state.field(editorLivePreviewField, false) ?? false;
          const wasLive = update.startState.field(editorLivePreviewField, false) ?? false;
          // A reconfigure is how the plugin redraws open notes after a folder is created or renamed.
          const reconfigured = update.transactions.some((tr) => tr.reconfigured);
          if (!live) this.decorations = Decoration.none;
          else if (!wasLive || reconfigured || update.viewportChanged) this.decorations = buildVisible(index, update.view);
          else if (update.docChanged) this.decorations = rescanEdited(index, update, this.decorations);
        }
      },
      { decorations: (plugin) => plugin.decorations },
    ),
  );
}

/** Marks for the whole visible text. */
function buildVisible(index: FolderIndex<{ path: string }>, view: EditorView): DecorationSet {
  if (!(view.state.field(editorLivePreviewField, false) ?? false)) return Decoration.none;
  const marks = view.visibleRanges.flatMap(({ from, to }) => scan(index, view.state, from, to));
  return Decoration.set(marks, true);
}

/**
 * After an edit: the existing marks move with the text, and only the lines the edit touched are
 * read again, so a keystroke costs one line, not the whole screen.
 */
function rescanEdited(index: FolderIndex<{ path: string }>, update: ViewUpdate, marks: DecorationSet): DecorationSet {
  let next = marks.map(update.changes);
  const doc = update.state.doc;
  update.changes.iterChangedRanges((_fromA, _toA, fromB, toB) => {
    const from = doc.lineAt(fromB).from;
    const to = doc.lineAt(toB).to;
    next = next.update({
      filterFrom: from,
      filterTo: to,
      filter: (markFrom, markTo) => markTo < from || markFrom > to,
      add: scan(index, update.state, from, to),
      sort: true,
    });
  });
  return next;
}

function scan(index: FolderIndex<{ path: string }>, state: EditorState, from: number, to: number): Range<Decoration>[] {
  const source = state.field(editorInfoField, false)?.file?.path ?? "";
  const marks: Range<Decoration>[] = [];
  for (const link of findWikilinks(state.doc.sliceString(from, to))) {
    const linkPath = folderLinkPath(link.inner);
    if (linkPath === null) continue;
    const start = from + link.start;
    if (inCode(state, start) || resolveFolder(linkPath, source, index.lookup()) === null) continue;
    marks.push(mark.range(start, from + link.end));
  }
  return marks;
}

/**
 * Whether a position is inside code or math, where `[[…]]` is not a link. Obsidian's token names
 * there are "inline-code", "hmd-codeblock" and "math…"; a link's own contain neither.
 */
function inCode(state: EditorState, pos: number): boolean {
  // Just inside the brackets: the token there is the link's, or the code's that holds it.
  const name = syntaxTree(state).resolveInner(pos + 2, 1).name;
  return /code|math/i.test(name);
}
