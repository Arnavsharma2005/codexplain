import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { chunkFile } from "./chunk";
import { intelConfig } from "./config";
import { embedDocuments, embeddingModel } from "./embed";
import { adjacency, pageRank } from "./graph";
import { scanRepository } from "./scan";
import { existingEmbeddings, insertChunks, insertEmbeddings, type ChunkRow } from "./store";
import { searchDocument } from "./text";

export type IndexStage = "queued" | "download" | "parse" | "store" | "embed";
export type IndexProgress = { stage: IndexStage; message: string; done?: number; total?: number };

/** An index stuck in INDEXING longer than this is treated as crashed and rebuilt. */
const STALE_MS = 6 * 60 * 1000;
/** How many snapshots to keep per repository (older ones are deleted to save space). */
const KEEP_SNAPSHOTS = 3;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

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
    // 1–3. Download, parse with tree-sitter and resolve imports into edges.
    const { files, edges, skipped, totalBytes } = await scanRepository(
      { owner: params.owner, repo: params.repo, sha: params.sha, token: params.token },
      onProgress,
    );

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
      f.parsed.symbols.map((s) => ({ indexId, fileId: fileIds[i], ...s })),
    );
    for (let i = 0; i < symbols.length; i += 5000) await db.intelSymbol.createMany({ data: symbols.slice(i, i + 5000) });
    for (let i = 0; i < edges.length; i += 5000)
      await db.intelEdge.createMany({
        data: edges.slice(i, i + 5000).map(([a, b]) => ({ indexId, fromFileId: fileIds[a], toFileId: fileIds[b] })),
      });

    const rank = pageRank(adjacency(files.length, edges));
    const chunks: (ChunkRow & { priority: number; embedText: string })[] = [];
    files.forEach((f, i) => {
      const isCode = f.parsed.symbols.length > 0 || f.parsed.imports.length > 0;
      for (const c of chunkFile(f.text, f.parsed.symbols)) {
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
