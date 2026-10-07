import { describe, expect, it } from "vitest";
import { ownerSchema, pathSchema, refSchema, repoNameSchema } from "@/lib/github/validation";

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: string) => schema.safeParse(v).success;

describe("validation", () => {
  it("validates owners", () => {
    expect(ok(ownerSchema, "vercel")).toBe(true);
    expect(ok(ownerSchema, "a-b-c")).toBe(true);
    expect(ok(ownerSchema, "-abc")).toBe(false);
    expect(ok(ownerSchema, "abc-")).toBe(false);
    expect(ok(ownerSchema, "a--b")).toBe(false);
    expect(ok(ownerSchema, "a".repeat(40))).toBe(false);
    expect(ok(ownerSchema, "a/b")).toBe(false);
  });

  it("validates repo names", () => {
    expect(ok(repoNameSchema, "next.js")).toBe(true);
    expect(ok(repoNameSchema, "..")).toBe(false);
    expect(ok(repoNameSchema, "a b")).toBe(false);
  });

  it("validates refs", () => {
    for (const r of ["main", "feature/login", "v1.2.3", "release-2026"]) expect(ok(refSchema, r)).toBe(true);
    for (const r of ["", "a..b", "a b", "/main", "main/", "a~1", "a^", "a:b", "x.lock", "a//b", "a@{1}", "a\\b"])
      expect(ok(refSchema, r)).toBe(false);
  });

  it("rejects path traversal", () => {
    expect(ok(pathSchema, "src/index.ts")).toBe(true);
    expect(ok(pathSchema, ".github/workflows/ci.yml")).toBe(true);
    for (const p of ["../etc/passwd", "a/../b", "/abs", "a//b", "a/", "./a", "a/\0b"]) expect(ok(pathSchema, p)).toBe(false);
  });
});
