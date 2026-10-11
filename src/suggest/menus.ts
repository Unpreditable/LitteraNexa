/** Another suggester's open menu, as far as it matters to this one. */
export interface OpenMenu {
  /** Whether it is open in the editor being typed in. */
  sameEditor: boolean;
  /** Where the text it claims starts. */
  line: number;
  ch: number;
}

/**
 * Whether a menu open on the line being typed in is to be left alone.
 *
 * A menu claiming the line from its first character, like Tasks', is there all the time and may be
 * replaced, unless replacing is switched off. One opened at the caret was asked for, and never is.
 */
export function leavesAlone(menu: OpenMenu, line: number, replaceLineMenus: boolean): boolean {
  if (!menu.sameEditor || menu.line !== line) return false;
  return menu.ch > 0 || !replaceLineMenus;
}
