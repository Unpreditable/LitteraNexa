import { buildLink, isLinkableAlias } from "../src/suggest/links";

describe("buildLink", () => {
  it("links by name", () => {
    expect(buildLink("John Smith", "John Smith", null, false)).toBe("[[John Smith]]");
  });

  it("links by alias", () => {
    expect(buildLink("John Smith", "John Smith", "Johnny", false)).toBe("[[John Smith|Johnny]]");
  });

  it("hides the path a same-named note needs behind its name", () => {
    expect(buildLink("People/Sub/John Smith", "John Smith", null, false)).toBe("[[People/Sub/John Smith|John Smith]]");
    expect(buildLink("People/Sub/John Smith", "John Smith", "Johnny", false)).toBe("[[People/Sub/John Smith|Johnny]]");
  });

  it("escapes the pipe inside a table", () => {
    expect(buildLink("John Smith", "John Smith", "Johnny", true)).toBe("[[John Smith\\|Johnny]]");
    expect(buildLink("Sub/John Smith", "John Smith", null, true)).toBe("[[Sub/John Smith\\|John Smith]]");
  });
});

describe("isLinkableAlias", () => {
  it("accepts plain text", () => {
    expect(isLinkableAlias("Johnny")).toBe(true);
  });

  it("rejects non-text and blank aliases", () => {
    expect(isLinkableAlias(2024)).toBe(false);
    expect(isLinkableAlias(null)).toBe(false);
    expect(isLinkableAlias("  ")).toBe(false);
  });

  it("rejects aliases that would break the link", () => {
    expect(isLinkableAlias("a]]b")).toBe(false);
    expect(isLinkableAlias("a[[b")).toBe(false);
    expect(isLinkableAlias("a|b")).toBe(false);
  });
});
