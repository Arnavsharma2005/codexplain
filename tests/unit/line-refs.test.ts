import { describe, expect, it } from "vitest";
import { formatLineHash, linkifyLineRefs, parseLineHash } from "@/lib/line-refs";

describe("linkifyLineRefs", () => {
  it("links single lines and ranges", () => {
    expect(linkifyLineRefs("See L12 and L20-L30.")).toBe("See [L12](#L12) and [L20-L30](#L20-L30).");
  });

  it("normalises en dashes, missing L and reversed ranges", () => {
    expect(linkifyLineRefs("L5–L9, L40-45, L9-L3")).toBe("[L5-L9](#L5-L9), [L40-L45](#L40-L45), [L3-L9](#L3-L9)");
  });

  it("leaves code untouched", () => {
    const md = "Inline `L12` and\n```ts\nconst L3 = 1; // L4\n```\nbut L5 links";
    expect(linkifyLineRefs(md)).toBe("Inline `L12` and\n```ts\nconst L3 = 1; // L4\n```\nbut [L5](#L5) links");
  });

  it("does not touch identifiers or existing anchors", () => {
    expect(linkifyLineRefs("HTML5 URL1 xL2 #L3 [L4](#L4)")).toBe("HTML5 URL1 xL2 #L3 [L4](#L4)");
  });

  it("handles an unterminated fence while streaming", () => {
    expect(linkifyLineRefs("L1\n```js\nL2")).toBe("[L1](#L1)\n```js\nL2");
  });
});

describe("parseLineHash / formatLineHash", () => {
  it("round-trips", () => {
    expect(parseLineHash("#L7")).toEqual({ start: 7, end: 7 });
    expect(parseLineHash("#L9-L3")).toEqual({ start: 3, end: 9 });
    expect(formatLineHash({ start: 3, end: 9 })).toBe("#L3-L9");
    expect(formatLineHash({ start: 4, end: 4 })).toBe("#L4");
  });

  it("rejects junk", () => {
    expect(parseLineHash("#foo")).toBeNull();
    expect(parseLineHash("#L0")).toBeNull();
    expect(parseLineHash("")).toBeNull();
  });
});
