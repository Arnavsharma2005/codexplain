import { describe, expect, it } from "vitest";
import { MODES, numberLines, selectTreeContext, systemPrompt, userPrompt } from "@/lib/analysis/prompts";
import { detectLanguage } from "@/lib/languages";
import { isProbablyBinary } from "@/lib/github/binary";

describe("prompts", () => {
  it("numbers lines with aligned gutters", () => {
    const out = numberLines(Array.from({ length: 10 }, (_, i) => `l${i + 1}`).join("\r\n"));
    expect(out.split("\n")[0]).toBe(" 1 | l1");
    expect(out.split("\n")[9]).toBe("10 | l10");
  });

  it("prioritises sibling files and manifests in tree context", () => {
    const paths = ["README.md", "package.json", "src/a.ts", "src/b.ts", "docs/x/y/z.md", ...Array.from({ length: 50 }, (_, i) => `vendor/deep/f${i}.js`)];
    const picked = selectTreeContext(paths, "src/a.ts", 5);
    expect(picked).toEqual(expect.arrayContaining(["src/a.ts", "src/b.ts", "package.json", "README.md"]));
    expect(picked).toHaveLength(5);
  });

  it("every mode has instructions that require line references and untrusted-data handling", () => {
    for (const mode of Object.keys(MODES) as (keyof typeof MODES)[]) {
      const p = systemPrompt(mode);
      expect(p).toContain("L12-L30");
      expect(p).toContain("untrusted");
    }
  });

  it("wraps the file in delimiters", () => {
    const p = userPrompt({
      owner: "o", repo: "r", ref: "main", path: "a.ts", language: "TypeScript", description: null,
      content: "const a = 1;", treePaths: ["a.ts"], treeTruncated: false,
    });
    expect(p).toContain('<file path="a.ts"');
    expect(p).toContain("1 | const a = 1;");
  });
});

describe("languages and binary detection", () => {
  it.each([
    ["src/app.tsx", "tsx"],
    ["Dockerfile", "docker"],
    ["Dockerfile.prod", "docker"],
    ["Makefile", "makefile"],
    [".env.local", "dotenv"],
    ["x/y/main.go", "go"],
    ["LICENSE", "text"],
  ])("%s → %s", (path, lang) => expect(detectLanguage(path)).toBe(lang));

  it("detects binaries by extension and NUL bytes", () => {
    expect(isProbablyBinary("a.png")).toBe(true);
    expect(isProbablyBinary("a.txt", new Uint8Array([104, 105, 0, 1]))).toBe(true);
    expect(isProbablyBinary("a.txt", new TextEncoder().encode("hello"))).toBe(false);
  });
});
