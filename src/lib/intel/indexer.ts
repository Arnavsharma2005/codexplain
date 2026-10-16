import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { detectLanguage } from "@/lib/languages";
import { ApiError } from "@/lib/http";
import { chunkFile } from "./chunk";
import { intelConfig } from "./config";
import { embedDocuments, embeddingModel } from "./embed";
import { looksGenerated, wantFile } from "./files";
import { readTarball } from "./github";
import { adjacency, pageRank, type GraphEdge } from "./graph";
import { parseSource, type ParsedFile } from "./parse";
import { buildContext, resolveImport } from "./resolve";
import { existingEmbeddings, insertChunks, insertEmbeddings, type ChunkRow } from "./store";
import { searchDocument } from "./text";

export type IndexStage = "queued" | "download" | "parse" | "store" | "embed";
export type IndexProgress = { stage: IndexStage; message: string; done?: number; total?: number };

type SourceFile = { path: string; lang: string; text: string; bytes: number; parsed?: ParsedFile };

/** An index stuck in INDEXING longer than this is treated as crashed and rebuilt. */
const STALE_MS = 6 * 60 * 1000;
/** How many snapshots to keep per repository (older ones are deleted to save space). */
const KEEP_SNAPSHOTS = 3;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const yieldToLoop = () => new Promise<void>((r) => setImmediate(r));

/** Text sent to the embedding model; its hash is the embedding cache key. */
export function embeddingText(path: string, symbols: string[], text: string) {
  return `File: ${path}${symbols.length ? `\nDefines: ${symbols.join(", ")}` : ""}\n\n${text}`.slice(0, 8000);
}

/**
 * Claims the (repository, commit) slot. Returns null when a finished index
 * already exists, so callers can answer instantly from the cache.
 */
export async function claimIndex(repositoryId: string, commitSha: string, ref: string, userId: string) {
  const existing = await db.intelIndex.findUnique({ where: { repositoryId_commitSha: { repositoryId, commitSha } } });
  if (existing?.status === "READY") return { index: existing, fresh: false };
  if (existing?.status === "INDEXING" && Date.now() - existing.updatedAt.getTime() < STALE_MS) {
    throw new ApiError(409, "INDEX_IN_PROGRESS", "This repository is already being indexed. It will be ready shortly.");
  }
  if (existing) {
    await db.$transaction([
      db.intelFile.deleteMany({ where: { indexId: existing.id } }),
      db.intelIndex.update({ where: { id: existing.id }, data: { status: "INDEXING", error: null, ref, createdById: userId } }),
    ]);
    return { index: existing, fresh: true };
  }
  try {
    const index = await db.intelIndex.create({ data: { repositoryId, commitSha, ref, createdById: userId } });
    return { index, fresh: true };
  } catch {
    // Lost a race with another request creating the same row.
    throw new ApiError(409, "INDEX_IN_PROGRESS", "This repository is already being indexed. It will be ready shortly.");
  }
}

export async function buildIndex(
  params: { indexId: string; repositoryId: string; owner: string; repo: string; sha: string; token: string | null },
  onProgress: (p: IndexProgress) => void,
) {
  const started = Date.now();
  const cfg = intelConfig();
  const { indexId } = params;

  try {
    // 1. Download: one tarball, filtered as it streams.
    onProgress({ stage: "download", message: "Downloading repository" });
    const files: SourceFile[] = [];
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
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      f.parsed = await parseSource(f.lang, f.text).catch(() => ({ imports: [], symbols: [] }));
      if (i % 50 === 0) {
        onProgress({ stage: "parse", message: "Parsing files", done: i, total: files.length });
        await yieldToLoop();
      }
    }
    onProgress({ stage: "parse", message: "Parsing files", done: files.length, total: files.length });

    // 3. Resolve imports into file → file edges.
    const ctx = buildContext(
      files.map((f) => f.path),
      {
        tsconfigs: new Map(files.filter((f) => /(^|\/)[tj]sconfig(\.[\w-]+)?\.json$/.test(f.path)).map((f) => [f.path, f.text])),
        goMod: files.find((f) => f.path === "go.mod")?.text ?? null,
      },
    );
    const position = new Map(files.map((f, i) => [f.path, i]));
    const edgeKeys = new Set<string>();
    const edges: GraphEdge[] = [];
    files.forEach((f, i) => {
      for (const spec of f.parsed!.imports)
        for (const target of resolveImport(ctx, f.path, f.lang, spec)) {
          const j = position.get(target)!;
          const key = `${i}:${j}`;
          if (!edgeKeys.has(key)) {
            edgeKeys.add(key);
            edges.push([i, j]);
          }
        }
    });

    // 4. Store files, symbols, edges and search chunks.
    onProgress({ stage: "store", message: "Saving the code graph" });
    const fileIds = files.map(() => randomUUID());
    await db.intelFile.createMany({
      data: files.map((f, i) => ({
        id: fileIds[i],
        indexId,
        path: f.path,
        language: f.lang,
        bytes: f.bytes,
        lines: f.text.split("\n").length,
      })),
    });
    const symbols = files.flatMap((f, i) =>
      f.parsed!.symbols.map((s) => ({ indexId, fileId: fileIds[i], ...s })),
    );
    for (let i = 0; i < symbols.length; i += 5000) await db.intelSymbol.createMany({ data: symbols.slice(i, i + 5000) });
    for (let i = 0; i < edges.length; i += 5000)
      await db.intelEdge.createMany({
        data: edges.slice(i, i + 5000).map(([a, b]) => ({ indexId, fromFileId: fileIds[a], toFileId: fileIds[b] })),
      });

    const rank = pageRank(adjacency(files.length, edges));
    const chunks: (ChunkRow & { priority: number; embedText: string })[] = [];
    files.forEach((f, i) => {
      const isCode = f.parsed!.symbols.length > 0 || f.parsed!.imports.length > 0;
      for (const c of chunkFile(f.text, f.parsed!.symbols)) {
        const embedText = embeddingText(f.path, c.symbols, c.text);
        chunks.push({
          id: randomUUID(),
          fileId: fileIds[i],
          ...c,
          hash: sha256(embedText),
          doc: searchDocument(f.path, c.symbols, c.text),
          embedText,
          // Central code first, then other code, then docs and config.
          priority: rank[i] * (isCode ? 1 : 0.25) + (isCode ? 1 : 0),
        });
      }
    });
    await insertChunks(indexId, chunks);

    // 5. Embeddings: reuse cached vectors, embed only new content, most central first.
    const model = embeddingModel();
    const byPriority = [...chunks].sort((a, b) => b.priority - a.priority);
    const unique = new Map<string, string>();
    for (const c of byPriority) {
      if (unique.size >= cfg.INTEL_MAX_EMBEDDED_CHUNKS) break;
      if (!unique.has(c.hash)) unique.set(c.hash, c.embedText);
    }
    const cached = await existingEmbeddings(model, [...unique.keys()]);
    const missing = [...unique].filter(([h]) => !cached.has(h));
    onProgress({ stage: "embed", message: "Embedding code", done: cached.size, total: unique.size });
    const { embedded, stoppedBy } = await embedDocuments(
      missing.map(([, t]) => t),
      async (start, vectors) => {
        await insertEmbeddings(model, missing.slice(start, start + vectors.length).map(([h]) => h), vectors);
        onProgress({ stage: "embed", message: "Embedding code", done: cached.size + start + vectors.length, total: unique.size });
      },
    );
    if (stoppedBy) console.warn("[intel] embeddings stopped early", { indexId, status: stoppedBy.status, embedded });

    const index = await db.intelIndex.update({
      where: { id: indexId },
      data: {
        status: "READY",
        fileCount: files.length,
        symbolCount: symbols.length,
        edgeCount: edges.length,
        chunkCount: chunks.length,
        embeddedCount: cached.size + embedded,
        skippedCount: skipped,
        bytes: totalBytes,
        durationMs: Date.now() - started,
      },
    });
    await pruneSnapshots(params.repositoryId);
    return index;
  } catch (err) {
    const message = err instanceof Error && (err instanceof ApiError || err.name === "GitHubError") ? err.message : "Indexing failed.";
    console.error("[intel] index failed", { indexId, err });
    await db.intelIndex
      .update({ where: { id: indexId }, data: { status: "FAILED", error: message, durationMs: Date.now() - started } })
      .catch(() => undefined);
    throw err;
  }
}

async function pruneSnapshots(repositoryId: string) {
  const old = await db.intelIndex.findMany({
    where: { repositoryId, status: { not: "INDEXING" } },
    orderBy: { createdAt: "desc" },
    skip: KEEP_SNAPSHOTS,
    select: { id: true },
  });
  if (!old.length) return;
  await db.intelIndex.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  // Vectors no snapshot uses any more (the hash index keeps this cheap).
  await db.$executeRaw`
    DELETE FROM "IntelEmbedding" e
    WHERE NOT EXISTS (SELECT 1 FROM "IntelChunk" c WHERE c."hash" = e."hash")`;
}
