import { Query } from "../src/suggest/queries";
import { rank } from "../src/suggest/rank";

const q = (text: string): Query => ({ text, startCh: 0 });
const m = (file: string, score: number, query: Query, text = file, alias: string | null = null) =>
  ({ file, text, query, alias, result: { score, matches: [] as [number, number][] } });

describe("rank", () => {
  it("returns nothing for no matches", () => {
    expect(rank([])).toEqual([]);
  });

  it("shows a row per matching name and alias of a note, best first", () => {
    const query = q("John");
    const byAlias = m("john", -1, query, "Johnny", "Johnny");
    const byName = m("john", -3, query);
    expect(rank([byName, byAlias])).toEqual([byAlias, byName]);
  });

  it("keeps a note's rows together", () => {
    const query = q("John");
    const a1 = m("a", -1, query, "John A");
    const b = m("b", -2, query, "John B");
    const a2 = m("a", -3, query, "Johnny", "Johnny");
    expect(rank([a1, b, a2])).toEqual([a1, a2, b]);
  });

  it("offers a matching note's other names and aliases, unhighlighted, with the same query", () => {
    const query = q("Smith");
    const byName = m("jane", -1, query, "Jane Smith");
    const name = { file: "jane", text: "Jane Smith", alias: null };
    const alias = { file: "jane", text: "Jane", alias: "Jane" };
    const other = { file: "bob", text: "Bob", alias: null };
    expect(rank([byName], [name, alias, other])).toEqual([
      byName,
      { ...alias, query, result: { score: -Infinity, matches: [] } },
    ]);
  });

  it("per note, prefers the longer query over a better score", () => {
    const long = m("then", -5, q("Then I deci"), "Then I decided");
    const short = m("then", -1, q("I deci"), "Then I decided");
    expect(rank([short, long])).toEqual([long]);
  });

  it("per note, ignores a longer query whose leading words are not name-word prefixes", () => {
    const long = m("margaret", -1, q("Met Anna"), "Margaret Annabel");
    const short = m("margaret", -5, q("Anna"), "Margaret Annabel");
    expect(rank([long, short])).toEqual([short]);
  });

  it("puts the note covering more of the typed text first, whatever the scores", () => {
    const john = m("john", -1, q("Smi"), "John Smith");
    const jane = m("jane", -5, q("Jane Smi"), "Jane Smith");
    expect(rank([john, jane])).toEqual([jane, john]);
  });

  it("sorts notes by score, best first", () => {
    const query = q("John");
    const a = m("a", -3, query);
    const b = m("b", -1, query);
    expect(rank([a, b])).toEqual([b, a]);
  });

  it("breaks score ties across notes with the longer query", () => {
    const a = m("a", -2, q("I deci"));
    const b = m("b", -2, q("Then I deci"));
    expect(rank([a, b])).toEqual([b, a]);
  });

  describe("extra aliases", () => {
    const query = q("Jo");
    const name = { file: "joseph", text: "Joseph Park", alias: null };
    const jo = m("joseph", -1, query, "Jo", "Jo");
    const joey = m("joseph", -3, query, "Joey", "Joey");
    const seph = { file: "joseph", text: "Seph", alias: "Seph" };
    const candidates = [name, { ...jo }, { ...joey }, seph];
    const offered = (c: typeof name | typeof seph) => ({ ...c, query, result: { score: -Infinity, matches: [] } });

    it("shows the closest alias as the match and the rest as extras", () => {
      expect(rank([joey, jo], candidates)).toEqual([jo, offered(name), joey, offered(seph)]);
    });

    it("limits the extras, matched ones first", () => {
      expect(rank([joey, jo], candidates, 1)).toEqual([jo, offered(name), joey]);
      expect(rank([joey, jo], candidates, 0)).toEqual([jo, offered(name)]);
    });

    it("counts every alias as an extra when only the name matched", () => {
      const byName = m("joseph", -1, q("Park"), "Joseph Park");
      const all = rank([byName], candidates);
      expect(all.map((row) => row.text)).toEqual(["Joseph Park", "Jo", "Joey", "Seph"]);
      expect(rank([byName], candidates, 0)).toEqual([byName]);
    });

    it("keeps both rows when an alias has the same text as the name", () => {
      const byName = m("ann", -1, q("Ann"), "Ann");
      const byAlias = m("ann", -1, q("Ann"), "Ann", "Ann");
      expect(rank([byName, byAlias])).toHaveLength(2);
    });
  });
});
