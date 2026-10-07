import { NextResponse } from "next/server";
import { cachedQuerySchema, searchParamsObject } from "@/lib/api-schemas";
import type { CachedResponse } from "@/lib/api-types";
import { clientIp, handler } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { findCachedAnalyses } from "@/lib/services/analyses";
import { findRepository } from "@/lib/services/repos";

/**
 * Returns analyses already generated for this exact file version. Public repos
 * only, so cached results are visible to signed-out visitors too.
 */
export const GET = handler(async (req: Request) => {
  rateLimit(`cached:${clientIp(req)}`, 120, 60_000);
  const { owner, repo, path, sha } = cachedQuerySchema.parse(searchParamsObject(req));
  const repository = await findRepository(owner, repo);
  const body: CachedResponse = { analyses: {} };
  if (repository) {
    const rows = await findCachedAnalyses(repository.id, path, sha);
    for (const row of rows) {
      body.analyses[row.mode] = { id: row.id, content: row.content, model: row.model, createdAt: row.createdAt.toISOString() };
    }
  }
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
});
