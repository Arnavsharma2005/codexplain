import "server-only";
import { detectLanguage } from "@/lib/languages";
import { ApiError } from "@/lib/http";
import { intelConfig } from "./config";
import { looksGenerated, wantFile } from "./files";
import { readTarball } from "./github";
import type { GraphEdge } from "./graph";
import { parseSource, type ParsedFile } from "./parse";
import { buildContext, resolveImport, type ResolveContext } from "./resolve";

export type SourceFile = { path: string; lang: string; text: string; bytes: number; parsed: ParsedFile };

export type ScanProgress = { stage: "download" | "parse"; message: string; done?: number; total?: number };

export type RepositoryScan = {
  /** Sorted by path; edges index into this array. */
  files: SourceFile[];
  edges: GraphEdge[];
  /** Resolves an import the way the edges were built (used for files that only exist in a diff). */
  context: ResolveContext;
  skipped: number;
  totalBytes: number;
};

const yieldToLoop = () => new Promise<void>((r) => setImmediate(r));

/**
 * Downloads one commit as a tarball, parses every source file with tree-sitter
 * and resolves imports into file → file edges. Shared by the persistent index
 * and PR walkthroughs, which only need the graph in memory.
 */
export async function scanRepository(
  params: { owner: string; repo: string; sha: string; token: string | null },
  onProgress: (p: ScanProgress) => void,
): Promise<RepositoryScan> {
  const cfg = intelConfig();

  // 1. Download: one tarball, filtered as it streams.
  onProgress({ stage: "download", message: "Downloading repository" });
  const files: Omit<SourceFile, "parsed">[] = [];
  let totalBytes = 0;
  let skipped = 0;
  const decoder = new TextDecoder("utf-8", { fatal: false });
  await readTarball(
    params.owner,
    params.repo,
    params.sha,
    params.token,
    (path, size) => {
      const wanted = path.endsWith("go.mod") || wantFile(path, size);
      if (!wanted) return false;
      if (files.length >= cfg.INTEL_MAX_FILES || totalBytes + size > cfg.INTEL_MAX_TOTAL_BYTES) {
        skipped++;
        return false;
      }
      totalBytes += size;
      return true;
    },
    ({ path, data }) => {
      if (data.subarray(0, 8000).includes(0)) return;
      const text = decoder.decode(data);
      if (looksGenerated(text)) {
        skipped++;
        return;
      }
      files.push({ path, lang: detectLanguage(path), text, bytes: data.length });
    },
  );
  if (!files.length) throw new ApiError(422, "NOTHING_TO_INDEX", "No source files were found in this repository.");
  files.sort((a, b) => a.path.localeCompare(b.path));

  // 2. Parse with tree-sitter.
  const parsed: SourceFile[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    parsed.push({ ...f, parsed: await parseSource(f.lang, f.text).catch(() => ({ imports: [], symbols: [] })) });
    if (i % 50 === 0) {
      onProgress({ stage: "parse", message: "Parsing files", done: i, total: files.length });
      await yieldToLoop();
    }
  }
  onProgress({ stage: "parse", message: "Parsing files", done: files.length, total: files.length });

  // 3. Resolve imports into file → file edges.
  const context = buildContext(
    parsed.map((f) => f.path),
    {
      tsconfigs: new Map(parsed.filter((f) => /(^|\/)[tj]sconfig(\.[\w-]+)?\.json$/.test(f.path)).map((f) => [f.path, f.text])),
      goMod: parsed.find((f) => f.path === "go.mod")?.text ?? null,
    },
  );
  const position = new Map(parsed.map((f, i) => [f.path, i]));
  const edgeKeys = new Set<string>();
  const edges: GraphEdge[] = [];
  parsed.forEach((f, i) => {
    for (const spec of f.parsed.imports)
      for (const target of resolveImport(context, f.path, f.lang, spec)) {
        const j = position.get(target)!;
        const key = `${i}:${j}`;
        if (!edgeKeys.has(key)) {
          edgeKeys.add(key);
          edges.push([i, j]);
        }
      }
  });

  return { files: parsed, edges, context, skipped, totalBytes };
}
