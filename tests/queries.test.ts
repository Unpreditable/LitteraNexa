import { findQueries, QueryOptions } from "../src/suggest/queries";

const opts: QueryOptions = { capitalOnly: true, minCharacters: 3, maxWords: 3, inlineCode: false, inlineMath: false };
const q = (before: string, after = "", o: QueryOptions = opts) => findQueries(before, after, o);

describe("findQueries", () => {
  it("offers every capitalized word in range as a start", () => {
    expect(q("Then I deci")).toEqual([
      { text: "Then I deci", startCh: 0 },
      { text: "I deci", startCh: 5 },
    ]);
  });

  it("needs at least minLetters letters per query", () => {
    expect(q("John")).toEqual([{ text: "John", startCh: 0 }]);
    expect(q("Jo")).toEqual([]);
    expect(q("I d")).toEqual([]);
    expect(q("Then I")).toEqual([{ text: "Then I", startCh: 0 }]);
  });

  it("ignores lowercase starts when capitalOnly", () => {
    expect(q("the quick brown")).toEqual([]);
  });

  it("treats every word as a start when not capitalOnly", () => {
    expect(q("the quick", "", { ...opts, capitalOnly: false })).toEqual([
      { text: "the quick", startCh: 0 },
      { text: "quick", startCh: 4 },
    ]);
  });

  it("looks back at most maxWords words, current word included", () => {
    expect(q("Alpha beta gamma")).toEqual([{ text: "Alpha beta gamma", startCh: 0 }]);
    expect(q("Alpha beta gamma delta")).toEqual([]);
  });

  it("stops the lookback at punctuation", () => {
    expect(q("said, John Sm")).toEqual([{ text: "John Sm", startCh: 6 }]);
    expect(q("[[A]] John")).toEqual([{ text: "John", startCh: 6 }]);
  });

  it("skips leading punctuation", () => {
    expect(q("(John")).toEqual([{ text: "John", startCh: 1 }]);
  });

  it("keeps apostrophes and hyphens inside words", () => {
    expect(q("met O'Brien")).toEqual([{ text: "O'Brien", startCh: 4 }]);
    expect(q("met O’Brien")).toEqual([{ text: "O’Brien", startCh: 4 }]);
    expect(q("Jean-Luc")).toEqual([{ text: "Jean-Luc", startCh: 0 }]);
  });

  it("recognizes non-Latin capitals", () => {
    expect(q("Виталий")).toEqual([{ text: "Виталий", startCh: 0 }]);
  });

  it("does not trigger inside an open [[", () => {
    expect(q("[[John")).toEqual([]);
  });

  it("does not trigger inside inline code", () => {
    expect(q("`John")).toEqual([]);
    expect(q("`a` John")).toEqual([{ text: "John", startCh: 4 }]);
  });

  it("triggers inside inline code when that is allowed", () => {
    expect(q("`John", "", { ...opts, inlineCode: true })).toEqual([{ text: "John", startCh: 1 }]);
    expect(q("$x John", "", { ...opts, inlineCode: true })).toEqual([]);
  });

  it("triggers inside inline math when that is allowed", () => {
    expect(q("$x John", "", { ...opts, inlineMath: true })).toEqual([{ text: "John", startCh: 3 }]);
    expect(q("`John", "", { ...opts, inlineMath: true })).toEqual([]);
  });

  it("does not trigger mid-word", () => {
    expect(q("Joh", "n")).toEqual([]);
    expect(q("John", " x")).toEqual([{ text: "John", startCh: 0 }]);
    expect(q("John", ".")).toEqual([{ text: "John", startCh: 0 }]);
  });

  it("stays open after trailing whitespace, which is not part of the query", () => {
    expect(q("John ")).toEqual([{ text: "John", startCh: 0 }]);
    expect(q("Then I ")).toEqual([{ text: "Then I", startCh: 0 }]);
  });

  it("does not trigger on trailing whitespace after punctuation or nothing", () => {
    expect(q("said, ")).toEqual([]);
    expect(q("   ")).toEqual([]);
  });

  it("handles an empty line", () => {
    expect(q("")).toEqual([]);
  });

  it("treats a word starting with a digit as a start, digit included", () => {
    expect(q("3Mxx")).toEqual([{ text: "3Mxx", startCh: 0 }]);
    expect(q("met 3Mxx")).toEqual([{ text: "3Mxx", startCh: 4 }]);
  });

  it("counts digits towards the minimum length", () => {
    expect(q("3Mx")).toEqual([{ text: "3Mx", startCh: 0 }]);
    expect(q("R2D")).toEqual([{ text: "R2D", startCh: 0 }]);
    expect(q("3M")).toEqual([]);
  });

  it("does not trigger on a tag", () => {
    expect(q("#Project")).toEqual([]);
    expect(q("#tag John")).toEqual([{ text: "John", startCh: 5 }]);
  });

  it("does not trigger inside a URL", () => {
    expect(q("https://x.com/John")).toEqual([]);
  });

  it("does not trigger inside a markdown link's text", () => {
    expect(q("[met John")).toEqual([]);
    expect(q("- [ ] John")).toEqual([{ text: "John", startCh: 6 }]);
  });

  it("does not trigger inside inline math", () => {
    expect(q("$x John")).toEqual([]);
    expect(q("$x$ John")).toEqual([{ text: "John", startCh: 4 }]);
    expect(q("\\$x John")).toEqual([{ text: "John", startCh: 4 }]);
  });
});
