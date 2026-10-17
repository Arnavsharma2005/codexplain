import "server-only";
import path from "node:path";
import { readFile } from "node:fs/promises";
import TreeSitter from "@vscode/tree-sitter-wasm";
import { GRAMMAR_FOR } from "./files";
import { QUERIES } from "./queries";

export type ParsedSymbol = { name: string; kind: string; startLine: number; endLine: number; exported: boolean };
export type ParsedFile = { imports: string[]; symbols: ParsedSymbol[] };

type Language = TreeSitter.Language;
type Query = TreeSitter.Query;

const WASM_DIR = () => path.join(process.cwd(), "node_modules", "@vscode", "tree-sitter-wasm", "wasm");

let init: Promise<void> | null = null;
const languages = new Map<string, Promise<{ language: Language; query: Query }>>();

function ready() {
  init ??= TreeSitter.Parser.init({ locateFile: (file: string) => path.join(WASM_DIR(), file) });
  return init;
}

function loadGrammar(grammar: string) {
  let entry = languages.get(grammar);
  if (!entry) {
    entry = (async () => {
      await ready();
      const bytes = await readFile(path.join(WASM_DIR(), `tree-sitter-${grammar}.wasm`));
      const language = await TreeSitter.Language.load(new Uint8Array(bytes));
      return { language, query: new TreeSitter.Query(language, QUERIES[grammar]) };
    })();
    languages.set(grammar, entry);
    entry.catch(() => languages.delete(grammar));
  }
  return entry;
}

const QUOTES = /^['"`]|['"`]$/g;
const C_INCLUDE = /^\s*#\s*include\s+"([^"]+)"/gm;

/**
 * Extracts import specifiers and top-level definitions. Languages without a
 * shipped grammar return what a regex can find safely (C/C++ includes) or nothing.
 */
export async function parseSource(lang: string, source: string): Promise<ParsedFile> {
  const grammar = GRAMMAR_FOR[lang];
  if (!grammar) {
    if (lang === "c" || lang === "cpp") return { imports: [...source.matchAll(C_INCLUDE)].map((m) => m[1]), symbols: [] };
    return { imports: [], symbols: [] };
  }

  const { language, query } = await loadGrammar(grammar);
  const parser = new TreeSitter.Parser();
  parser.setLanguage(language);
  const tree = parser.parse(source);
  if (!tree) {
    parser.delete();
    return { imports: [], symbols: [] };
  }

  try {
    const imports = new Set<string>();
    const symbols: ParsedSymbol[] = [];
    const seen = new Set<string>();
    // Long files can have tens of thousands of matches; cap work per file.
    for (const match of query.matches(tree.rootNode, { matchLimit: 20_000 })) {
      const imp = match.captures.find((c) => c.name === "import");
      if (imp) {
        const spec = imp.node.text.replace(QUOTES, "").trim();
        if (spec && spec.length < 300) imports.add(spec);
        continue;
      }
      const name = match.captures.find((c) => c.name === "name");
      const def = match.captures.find((c) => c.name.startsWith("def."));
      if (!name || !def) continue;
      const startLine = def.node.startPosition.row + 1;
      const key = `${name.node.text}:${startLine}`;
      if (seen.has(key)) continue;
      seen.add(key);
      symbols.push({
        name: name.node.text.slice(0, 200),
        kind: def.name.slice(4),
        startLine,
        endLine: def.node.endPosition.row + 1,
        exported: isExported(def.node),
      });
      if (symbols.length >= 2000) break;
    }
    symbols.sort((a, b) => a.startLine - b.startLine);
    return { imports: [...imports], symbols };
  } finally {
    tree.delete();
    parser.delete();
  }
}

function isExported(node: TreeSitter.Node): boolean {
  for (let n: TreeSitter.Node | null = node; n; n = n.parent) {
    const t = n.type;
    if (t === "export_statement") return true;
    if (t === "program" || t === "module" || t === "source_file") break;
  }
  // Go: capitalised identifiers are exported. Python/Ruby: everything is public by convention.
  return false;
}
