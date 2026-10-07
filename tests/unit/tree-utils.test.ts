import { describe, expect, it } from "vitest";
import { ancestorsOf, buildTreeIndex, fuzzyScore } from "@/components/workspace/tree-utils";

describe("buildTreeIndex", () => {
  it("sorts folders first, then files naturally", () => {
    const idx = buildTreeIndex([
      { path: "b.ts", type: "blob" },
      { path: "src", type: "tree" },
      { path: "a10.ts", type: "blob" },
      { path: "a2.ts", type: "blob" },
      { path: "src/z.ts", type: "blob" },
    ]);
    expect(idx.children.get("")!.map((e) => e.path)).toEqual(["src", "a2.ts", "a10.ts", "b.ts"]);
    expect(idx.files).toHaveLength(4);
  });

  it("synthesises missing directories from truncated trees", () => {
    const idx = buildTreeIndex([{ path: "a/b/c.ts", type: "blob" }]);
    expect(idx.children.get("")!.map((e) => e.path)).toEqual(["a"]);
    expect(idx.children.get("a")!.map((e) => e.path)).toEqual(["a/b"]);
  });
});

describe("ancestorsOf", () => {
  it("lists parent directories", () => {
    expect(ancestorsOf("a/b/c.ts")).toEqual(["a", "a/b"]);
    expect(ancestorsOf("c.ts")).toEqual([]);
  });
});

describe("fuzzyScore", () => {
  it("matches subsequences and ranks file-name hits higher", () => {
    expect(fuzzyScore("xyz", "src/index.ts")).toBeNull();
    const nameHit = fuzzyScore("route", "src/app/api/route.ts")!;
    const dirHit = fuzzyScore("route", "src/routes/x/index.ts")!;
    expect(nameHit).toBeGreaterThan(dirHit);
  });
});
