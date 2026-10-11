import { leavesAlone, OpenMenu } from "../src/suggest/menus";

const atCaret: OpenMenu = { sameEditor: true, line: 4, ch: 12 };
const lineWide: OpenMenu = { sameEditor: true, line: 4, ch: 0 };

describe("leavesAlone", () => {
  it("leaves a menu opened at the caret alone, whatever the setting", () => {
    expect(leavesAlone(atCaret, 4, true)).toBe(true);
    expect(leavesAlone(atCaret, 4, false)).toBe(true);
  });

  it("replaces a menu claiming the line from its first character", () => {
    expect(leavesAlone(lineWide, 4, true)).toBe(false);
  });

  it("leaves a line-wide menu alone when replacing is switched off", () => {
    expect(leavesAlone(lineWide, 4, false)).toBe(true);
  });

  it("ignores a menu on another line", () => {
    expect(leavesAlone(atCaret, 5, true)).toBe(false);
    expect(leavesAlone(lineWide, 5, false)).toBe(false);
  });

  it("ignores a menu in another editor", () => {
    expect(leavesAlone({ ...atCaret, sameEditor: false }, 4, true)).toBe(false);
    expect(leavesAlone({ ...lineWide, sameEditor: false }, 4, false)).toBe(false);
  });
});
