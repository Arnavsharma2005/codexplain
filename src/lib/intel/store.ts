import "server-only";
import { db } from "@/lib/db";
import { toVectorLiteral } from "./embed";

export type ChunkRow = {
  id: string;
  fileId: string;
  startLine: number;
  endLine: number;
  symbols: string[];
  text: string;
  hash: string;
  doc: string;
};

const SEP = "\u001f";

/** Bulk-inserts chunks and builds their full-text vectors in the same statement. */
export async function insertChunks(indexId: string, rows: ChunkRow[]) {
  for (let i = 0; i < rows.length; i += 400) {
    const batch = rows.slice(i, i + 400);
    await db.$executeRaw`
      INSERT INTO "IntelChunk" ("id", "indexId", "fileId", "startLine", "endLine", "symbols", "text", "hash", "tsv")
      SELECT c.id, ${indexId}, c.file_id, c.start_line, c.end_line,
             CASE WHEN c.syms = '' THEN ARRAY[]::text[] ELSE string_to_array(c.syms, ${SEP}) END,
             c.body, c.hash, to_tsvector('simple', c.doc)
      FROM unnest(
        ${batch.map((r) => r.id)}::text[], ${batch.map((r) => r.fileId)}::text[],
        ${batch.map((r) => r.startLine)}::int[], ${batch.map((r) => r.endLine)}::int[],
        ${batch.map((r) => r.symbols.join(SEP))}::text[], ${batch.map((r) => r.text)}::text[],
        ${batch.map((r) => r.hash)}::text[], ${batch.map((r) => r.doc)}::text[]
      ) AS c(id, file_id, start_line, end_line, syms, body, hash, doc)`;
  }
}

/** Which of these content hashes already have an embedding for this model. */
export async function existingEmbeddings(model: string, hashes: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < hashes.length; i += 5000) {
    const rows = await db.$queryRaw<{ hash: string }[]>`
      SELECT "hash" FROM "IntelEmbedding" WHERE "model" = ${model} AND "hash" = ANY(${hashes.slice(i, i + 5000)}::text[])`;
    for (const r of rows) found.add(r.hash);
  }
  return found;
}

export async function insertEmbeddings(model: string, hashes: string[], vectors: number[][]) {
  await db.$executeRaw`
    INSERT INTO "IntelEmbedding" ("hash", "model", "vector")
    SELECT h, ${model}, v::vector
    FROM unnest(${hashes}::text[], ${vectors.map(toVectorLiteral)}::text[]) AS e(h, v)
    ON CONFLICT DO NOTHING`;
}
