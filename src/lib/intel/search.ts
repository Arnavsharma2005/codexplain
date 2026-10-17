import "server-only";
import { db } from "@/lib/db";
import { embedQuery, embeddingModel, toVectorLiteral } from "./embed";
import { fuseRankings, queryTerms, toTsQuery } from "./text";

export type SearchHit = {
  path: string;
  startLine: number;
  endLine: number;
  symbols: string[];
  text: string;
  score: number;
  /** Which retrievers found it: keyword, semantic, or both. */
  via: ("keyword" | "semantic")[];
};

type Row = { id: string; path: string; startLine: number; endLine: number; symbols: string[]; text: string };

const CANDIDATES = 40;

/**
 * Hybrid retrieval: Postgres full-text search and pgvector cosine search run
 * in parallel, then merge with reciprocal rank fusion. Either side can be
 * empty (no embeddings yet, or quota spent) and search still answers.
 */
export async function hybridSearch(
  indexId: string,
  query: string,
  opts: { limit?: number; pathPrefix?: string; semantic?: boolean } = {},
): Promise<{ hits: SearchHit[]; semantic: boolean }> {
  const limit = Math.min(opts.limit ?? 8, 25);
  const prefix = opts.pathPrefix ? `${opts.pathPrefix.replace(/[%_\\]/g, "\\$&")}%` : "%";
  const tsq = toTsQuery(query);

  const keyword = tsq
    ? db.$queryRaw<Row[]>`
        SELECT c."id", f."path", c."startLine", c."endLine", c."symbols", c."text"
        FROM "IntelChunk" c JOIN "IntelFile" f ON f."id" = c."fileId"
        WHERE c."indexId" = ${indexId} AND f."path" LIKE ${prefix} AND c."tsv" @@ to_tsquery('simple', ${tsq})
        ORDER BY ts_rank_cd(c."tsv", to_tsquery('simple', ${tsq}), 32) DESC
        LIMIT ${CANDIDATES}`
    : Promise.resolve([] as Row[]);

  const semantic = (async () => {
    if (opts.semantic === false) return null;
    const vector = await embedQuery(query);
    if (!vector) return null;
    return db.$queryRaw<Row[]>`
      SELECT c."id", f."path", c."startLine", c."endLine", c."symbols", c."text"
      FROM "IntelChunk" c
      JOIN "IntelFile" f ON f."id" = c."fileId"
      JOIN "IntelEmbedding" e ON e."hash" = c."hash" AND e."model" = ${embeddingModel()}
      WHERE c."indexId" = ${indexId} AND f."path" LIKE ${prefix}
      ORDER BY e."vector" <=> ${toVectorLiteral(vector)}::vector
      LIMIT ${CANDIDATES}`;
  })();

  const [kw, sem] = await Promise.all([keyword, semantic]);
  const rows = new Map<string, Row>();
  for (const r of [...kw, ...(sem ?? [])]) rows.set(r.id, r);
  const kwIds = kw.map((r) => r.id);
  const semIds = (sem ?? []).map((r) => r.id);
  const scores = fuseRankings([kwIds, semIds]);

  // Exact symbol-name matches are the strongest signal for code questions.
  const words = new Set(query.match(/[A-Za-z_][A-Za-z0-9_]{2,}/g) ?? []);
  // A query word in the file name ("retry", "auth") is the next strongest.
  const terms = queryTerms(query);
  for (const [id, r] of rows) {
    let boost = r.symbols.some((s) => words.has(s)) ? 0.02 : 0;
    const name = r.path.slice(r.path.lastIndexOf("/") + 1).toLowerCase();
    for (const t of terms) if (t.length > 2 && name.includes(t)) boost += 0.008;
    if (boost) scores.set(id, (scores.get(id) ?? 0) + boost);
  }

  const kwSet = new Set(kwIds);
  const semSet = new Set(semIds);
  const hits = [...scores]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, score]) => {
      const r = rows.get(id)!;
      return {
        path: r.path,
        startLine: r.startLine,
        endLine: r.endLine,
        symbols: r.symbols,
        text: r.text,
        score: Math.round(score * 10_000) / 10_000,
        via: [...(kwSet.has(id) ? ["keyword" as const] : []), ...(semSet.has(id) ? ["semantic" as const] : [])],
      };
    });
  return { hits, semantic: sem !== null };
}
