import { describe, expect, it } from "vitest";
import { buildContext, joinPath, resolveImport, tsconfigAliases } from "@/lib/intel/resolve";

const files = [
  "tsconfig.json",
  "src/index.ts",
  "src/lib/db.ts",
  "src/lib/util/index.ts",
  "src/components/button.tsx",
  "src/esm.ts",
  "pkg/__init__.py",
  "pkg/core.py",
  "pkg/sub/helpers.py",
  "go.mod",
  "internal/store/store.go",
  "internal/store/store_test.go",
  "src/main.rs",
  "src/net/mod.rs",
  "src/net/http.rs",
  "app/src/main/java/com/acme/Util.java",
  "lib/thing.rb",
  "native/util.h",
  "native/main.c",
];

const ctx = buildContext(files, {
  tsconfigs: new Map([["tsconfig.json", `{ // comment\n "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["./src/*"], }, }, }`]]),
  goMod: "module example.com/app\n\ngo 1.22\n",
});

describe("joinPath", () => {
  it("normalises and refuses to climb above the root", () => {
    expect(joinPath("src/lib", "../components/x")).toBe("src/components/x");
    expect(joinPath("src", "../../x")).toBeNull();
  });
});

describe("tsconfigAliases", () => {
  it("reads paths from JSON with comments and trailing commas", () => {
    expect(tsconfigAliases("", '{"compilerOptions":{"paths":{"~/*":["app/*"]}}}')).toEqual([{ prefix: "~/", targets: ["app"] }]);
    expect(tsconfigAliases("", "not json")).toEqual([]);
  });
});

describe("resolveImport", () => {
  const r = (from: string, lang: string, spec: string) => resolveImport(ctx, from, lang, spec);

  it("resolves JS/TS relative, index, alias and .js-to-.ts imports", () => {
    expect(r("src/index.ts", "typescript", "./lib/db")).toEqual(["src/lib/db.ts"]);
    expect(r("src/index.ts", "typescript", "./lib/util")).toEqual(["src/lib/util/index.ts"]);
    expect(r("src/lib/db.ts", "typescript", "@/components/button")).toEqual(["src/components/button.tsx"]);
    expect(r("src/index.ts", "typescript", "./esm.js")).toEqual(["src/esm.ts"]);
    expect(r("src/index.ts", "typescript", "react")).toEqual([]);
  });

  it("resolves Python absolute and relative modules", () => {
    expect(r("main.py", "python", "pkg.core")).toEqual(["pkg/core.py"]);
    expect(r("pkg/core.py", "python", ".sub.helpers")).toEqual(["pkg/sub/helpers.py"]);
    expect(r("pkg/sub/helpers.py", "python", "..core")).toEqual(["pkg/core.py"]);
    expect(r("pkg/core.py", "python", "os")).toEqual([]);
  });

  it("maps Go package imports to the package's non-test files", () => {
    expect(r("cmd/main.go", "go", "example.com/app/internal/store")).toEqual(["internal/store/store.go"]);
    expect(r("cmd/main.go", "go", "fmt")).toEqual([]);
  });

  it("resolves Rust mod declarations and crate paths", () => {
    expect(r("src/main.rs", "rust", "net")).toEqual(["src/net/mod.rs"]);
    expect(r("src/main.rs", "rust", "crate::net::http::Client")).toEqual(["src/net/http.rs"]);
  });

  it("resolves Java, Ruby and C includes", () => {
    expect(r("app/src/main/java/com/acme/App.java", "java", "com.acme.Util")).toEqual(["app/src/main/java/com/acme/Util.java"]);
    expect(r("bin/run.rb", "ruby", "thing")).toEqual(["lib/thing.rb"]);
    expect(r("native/main.c", "c", "util.h")).toEqual(["native/util.h"]);
  });
});
