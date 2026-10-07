import { MatchRule } from "../src/settings";
import { matchWords } from "../src/suggest/match";

const RULES: MatchRule[] = ["prefix", "anchored", "substring", "subsequence"];
const hit = (query: string, text: string, rule: MatchRule = "anchored") => matchWords(query, text, rule) !== null;
const ranges = (query: string, text: string, rule: MatchRule = "anchored") => matchWords(query, text, rule)?.matches;
const score = (query: string, text: string, rule: MatchRule = "anchored") => {
  const result = matchWords(query, text, rule);
  if (!result) throw new Error(`${query} does not match ${text}`);
  return result.score;
};

describe("matchWords", () => {
  it("applies the rule to each word on its own", () => {
    const fits = (typed: string) => RULES.filter((rule) => hit(typed, "Smith", rule));
    expect(fits("smi")).toEqual(["prefix", "anchored", "substring", "subsequence"]);
    expect(fits("smt")).toEqual(["anchored", "subsequence"]);
    expect(fits("mit")).toEqual(["substring", "subsequence"]);
    expect(fits("mth")).toEqual(["subsequence"]);
    expect(fits("smithy")).toEqual([]);
  });

  it("never matches letters across a space", () => {
    for (const rule of RULES) {
      expect(hit("js mi", "Jane Smith", rule)).toBe(false);
      expect(hit("js", "Jane Smith", rule)).toBe(false);
      expect(hit("janes", "Jane Smith", rule)).toBe(false);
    }
  });

  it("accepts short versions of every word", () => {
    expect(hit("jn sm", "Jane Smith")).toBe(true);
    expect(hit("ja smi", "Jane Smith")).toBe(true);
    expect(hit("j s", "Jane Smith")).toBe(true);
    expect(hit("jn sm", "Jane Smith", "prefix")).toBe(false);
  });

  it("needs a word of the name for every typed word", () => {
    expect(hit("jane smith x", "Jane Smith")).toBe(false);
    expect(hit("jane jane", "Jane Smith")).toBe(false);
    expect(hit("jane", "")).toBe(false);
    expect(hit("  ", "Jane Smith")).toBe(false);
  });

  it("keeps the typed words in the name's order, skipping words of the name", () => {
    expect(hit("ja sm", "Jane Marie Smith")).toBe(true);
    expect(hit("marie", "Jane Marie Smith")).toBe(true);
    expect(hit("smith jane", "Jane Smith")).toBe(false);
  });

  it("splits words on whitespace only", () => {
    expect(hit("luc", "Jean-Luc Picard")).toBe(false);
    expect(hit("luc", "Jean-Luc Picard", "substring")).toBe(true);
    expect(hit("jean-l pic", "Jean-Luc Picard")).toBe(true);
    expect(hit("jane   smith", "Jane \t Smith")).toBe(true);
  });

  it("ignores case and accents", () => {
    expect(hit("JANE", "jane")).toBe(true);
    expect(hit("jose", "José")).toBe(true);
    expect(hit("josé", "Jose")).toBe(true);
    expect(hit("zoe", "Zoë")).toBe(true);
  });

  it("reports the matched letters as ranges of the original text", () => {
    expect(ranges("ja sm", "Jane Marie Smith")).toEqual([
      [0, 2],
      [11, 13],
    ]);
    expect(ranges("jn", "Jane")).toEqual([
      [0, 1],
      [2, 3],
    ]);
    expect(ranges("mit", "Smith", "substring")).toEqual([[1, 4]]);
    // A decomposed accent is highlighted with its letter.
    expect(ranges("jose", "José X")).toEqual([[0, 5]]);
  });

  it("picks the tightest way to fit a name", () => {
    expect(ranges("sm", "Sam Smith")).toEqual([[4, 6]]);
    expect(ranges("ann", "Anna Ann")).toEqual([[5, 8]]);
    // Equally tight: the earlier word.
    expect(ranges("an", "Anna Ann")).toEqual([[0, 2]]);
  });

  describe("allowing typos", () => {
    it("accepts a wrong, missing, extra or swapped letter at the start of a word", () => {
      expect(hit("jnae smtih", "Jane Smith", "typos")).toBe(true);
      expect(hit("jane smyth", "Jane Smith", "typos")).toBe(true);
      expect(hit("jane smth", "Jane Smith", "typos")).toBe(true);
      expect(hit("janee", "Jane Smith", "typos")).toBe(true);
      expect(hit("jane smit", "Jane Smith", "typos")).toBe(true);
      expect(hit("smyt", "Smithson", "typos")).toBe(true);
    });

    it("needs the first letter right and never leaves letters out or crosses a space", () => {
      expect(hit("hane", "Jane Smith", "typos")).toBe(false);
      expect(hit("ajne", "Jane Smith", "typos")).toBe(false);
      expect(hit("jn sm", "Jane Smith", "typos")).toBe(false);
      expect(hit("js mi", "Jane Smith", "typos")).toBe(false);
      expect(hit("mith", "Jane Smith", "typos")).toBe(false);
    });

    it("allows no typo up to three letters, one up to seven, two from eight", () => {
      expect(hit("jne", "Jane", "typos")).toBe(false);
      expect(hit("jnae", "Jane", "typos")).toBe(true);
      expect(hit("elziabt", "Elizabeth", "typos")).toBe(false);
      expect(hit("elziabte", "Elizabeth", "typos")).toBe(true);
      expect(hit("elziabteh", "Elizabeth", "typos")).toBe(true);
      expect(hit("ezliabteh", "Elizabeth", "typos")).toBe(false);
    });

    it("leaves the other rules without typos", () => {
      for (const rule of RULES) expect(hit("jame", "Jane", rule)).toBe(false);
    });

    it("highlights the start of the word the typed one was compared with", () => {
      expect(ranges("smtih", "Smith", "typos")).toEqual([[0, 5]]);
      expect(ranges("smyt", "Smith", "typos")).toEqual([[0, 4]]);
      expect(ranges("jnae smyth", "Jane Marie Smith", "typos")).toEqual([
        [0, 4],
        [11, 16],
      ]);
    });

    it("scores fewer typos higher, and any typo below a word start", () => {
      expect(score("smith", "Smith", "typos")).toBeGreaterThan(score("smit", "Smith", "typos"));
      expect(score("smit", "Smith", "typos")).toBeGreaterThan(score("smyt", "Smith", "typos"));
      expect(score("elziabeth", "Elizabeth", "typos")).toBeGreaterThan(score("elziabteh", "Elizabeth", "typos"));
      // A plain start of a later word beats a typo in an earlier one.
      expect(ranges("mara", "Mary Mara", "typos")).toEqual([[5, 9]]);
    });
  });

  it("scores a tighter match higher", () => {
    expect(score("smith", "Smith")).toBeGreaterThan(score("smith", "Smithson"));
    expect(score("smi", "Smith")).toBeGreaterThan(score("smi", "Sami"));
    expect(score("smt", "Smith", "subsequence")).toBeLessThan(score("mit", "Smith", "subsequence"));
    expect(score("mit", "Smith", "subsequence")).toBeLessThan(score("smi", "Smith", "subsequence"));
  });

  it("then prefers fewer unmatched words, then the shorter name", () => {
    expect(score("ja", "Jane Smith")).toBeGreaterThan(score("ja", "Jane Marie Smith"));
    expect(score("ja", "Jane Li")).toBeGreaterThan(score("ja", "Jane Smith"));
    // Tightness still comes first.
    expect(score("jane", "Jane Marie Smith")).toBeGreaterThan(score("jane", "Janet"));
  });
});
