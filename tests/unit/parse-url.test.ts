import { describe, expect, it } from "vitest";
import { parseGitHubUrl, splitRefAndPath } from "@/lib/github/parse-url";

describe("parseGitHubUrl", () => {
  it.each([
    ["vercel/next.js", { owner: "vercel", repo: "next.js" }],
    ["github.com/vercel/next.js", { owner: "vercel", repo: "next.js" }],
    ["https://github.com/vercel/next.js", { owner: "vercel", repo: "next.js" }],
    ["https://www.github.com/vercel/next.js/", { owner: "vercel", repo: "next.js" }],
    ["https://github.com/vercel/next.js.git", { owner: "vercel", repo: "next.js" }],
    ["git@github.com:vercel/next.js.git", { owner: "vercel", repo: "next.js" }],
    ["  https://github.com/a-b/c_d  ", { owner: "a-b", repo: "c_d" }],
    ["https://github.com/vercel/next.js/issues/123", { owner: "vercel", repo: "next.js" }],
    ["https://github.com/vercel/next.js?tab=readme", { owner: "vercel", repo: "next.js" }],
  ])("parses %s", (input, expected) => {
    expect(parseGitHubUrl(input)).toEqual(expected);
  });

  it("captures blob URLs with ref, path and line anchor", () => {
    expect(parseGitHubUrl("https://github.com/vercel/next.js/blob/canary/packages/next/src/server/app.ts#L42-L50")).toEqual({
      owner: "vercel",
      repo: "next.js",
      kind: "blob",
      refAndPath: ["canary", "packages", "next", "src", "server", "app.ts"],
      line: 42,
      lineEnd: 50,
    });
  });

  it("captures tree URLs", () => {
    expect(parseGitHubUrl("github.com/o/r/tree/feature/x/src")).toMatchObject({ kind: "tree", refAndPath: ["feature", "x", "src"] });
  });

  it("decodes percent-encoded path segments", () => {
    expect(parseGitHubUrl("https://github.com/o/r/blob/main/docs/my%20file.md")?.refAndPath).toEqual(["main", "docs", "my file.md"]);
  });

  it.each([
    "",
    "   ",
    "not a url",
    "https://gitlab.com/o/r",
    "https://github.com/onlyowner",
    "https://evil.com/github.com/o/r",
    "https://github.com.evil.com/o/r",
    "https://github.com/-bad/repo",
    "https://github.com/o/..",
    "javascript:alert(1)",
    "o/r/../x",
  ])("rejects %j", (input) => {
    expect(parseGitHubUrl(input)).toBeNull();
  });
});

describe("splitRefAndPath", () => {
  const refs = ["main", "feature/login", "v1.0.0"];

  it("prefers the longest matching ref", () => {
    expect(splitRefAndPath(["feature", "login", "src", "a.ts"], refs)).toEqual({ ref: "feature/login", path: "src/a.ts" });
  });

  it("handles refs without a path", () => {
    expect(splitRefAndPath(["v1.0.0"], refs)).toEqual({ ref: "v1.0.0", path: "" });
  });

  it("accepts commit SHAs", () => {
    expect(splitRefAndPath(["a1b2c3d", "README.md"], refs)).toEqual({ ref: "a1b2c3d", path: "README.md" });
  });

  it("returns null for unknown refs", () => {
    expect(splitRefAndPath(["nope", "file.ts"], refs)).toBeNull();
  });
});
