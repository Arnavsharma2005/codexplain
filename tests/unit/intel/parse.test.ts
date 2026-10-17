import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { parseSource } = await import("@/lib/intel/parse");

describe("parseSource", () => {
  it("finds TypeScript imports and definitions", async () => {
    const src = [
      'import { a } from "./a";',
      'export { b } from "../b";',
      'const c = require("./c");',
      'const d = await import("./d");',
      "export function top() {}",
      "export const arrow = () => 1;",
      "class Box { open() {} }",
      "export interface Shape { x: number }",
      "type Id = string;",
      "enum Color { Red }",
    ].join("\n");
    const out = await parseSource("typescript", src);
    expect(out.imports.sort()).toEqual(["../b", "./a", "./c", "./d"]);
    const byName = Object.fromEntries(out.symbols.map((s) => [s.name, s]));
    expect(byName.top).toMatchObject({ kind: "function", exported: true, startLine: 5 });
    expect(byName.arrow).toMatchObject({ kind: "function", exported: true });
    expect(byName.Box).toMatchObject({ kind: "class", exported: false });
    expect(byName.open.kind).toBe("method");
    expect(byName.Shape.kind).toBe("interface");
    expect(byName.Id.kind).toBe("type");
    expect(byName.Color.kind).toBe("enum");
  });

  it("parses TSX and JavaScript", async () => {
    const tsx = await parseSource("tsx", 'import x from "./x";\nexport default function App() { return <div />; }');
    expect(tsx.imports).toEqual(["./x"]);
    expect(tsx.symbols[0]).toMatchObject({ name: "App", exported: true });
    const js = await parseSource("javascript", 'const m = require("m");\nfunction f() {}');
    expect(js.imports).toEqual(["m"]);
    expect(js.symbols.map((s) => s.name)).toEqual(["f"]);
  });

  it("parses Python", async () => {
    const out = await parseSource(
      "python",
      "import os\nimport a.b as ab\nfrom .sib import x\nfrom ..pkg.mod import y\n\nclass K:\n    def m(self):\n        pass\n\ndef f():\n    return 1\n",
    );
    expect(out.imports.sort()).toEqual(["..pkg.mod", ".sib", "a.b", "os"]);
    expect(out.symbols.map((s) => `${s.kind}:${s.name}`)).toEqual(["class:K", "function:m", "function:f"]);
    expect(out.symbols[0]).toMatchObject({ startLine: 6, endLine: 8 });
  });

  it("parses Go, Rust, Java, Ruby, PHP and C#", async () => {
    const go = await parseSource("go", 'package m\nimport (\n  "fmt"\n  "example.com/m/util"\n)\nfunc F() {}\ntype T struct{}\nfunc (t T) M() {}\n');
    expect(go.imports.sort()).toEqual(["example.com/m/util", "fmt"]);
    expect(go.symbols.map((s) => s.name)).toEqual(["F", "T", "M"]);

    const rs = await parseSource("rust", "mod util;\nuse crate::util::helper;\nfn main() {}\nstruct S;\n");
    expect(rs.imports.sort()).toEqual(["crate::util::helper", "util"]);
    expect(rs.symbols.map((s) => s.name)).toEqual(["main", "S"]);

    const java = await parseSource("java", "import com.acme.Util;\nclass A { void run() {} }\n");
    expect(java.imports).toEqual(["com.acme.Util"]);
    expect(java.symbols.map((s) => s.name)).toEqual(["A", "run"]);

    const rb = await parseSource("ruby", "require_relative 'lib/x'\nclass A\n  def go; end\nend\n");
    expect(rb.imports).toEqual(["lib/x"]);
    expect(rb.symbols.map((s) => s.name)).toEqual(["A", "go"]);

    const php = await parseSource("php", "<?php\nfunction f() {}\nclass C { function m() {} }\n");
    expect(php.symbols.map((s) => s.name)).toEqual(["f", "C", "m"]);

    const cs = await parseSource("csharp", "class C { void M() {} }");
    expect(cs.symbols.map((s) => s.name)).toEqual(["C", "M"]);
  });

  it("reads C includes with a regex and ignores languages without a grammar", async () => {
    expect((await parseSource("c", '#include "util.h"\n#include <stdio.h>\n')).imports).toEqual(["util.h"]);
    expect(await parseSource("markdown", "# hi")).toEqual({ imports: [], symbols: [] });
  });
});
