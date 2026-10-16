import { NextResponse } from "next/server";
import { cachedQuerySchema, searchParamsObject } from "@/lib/api-schemas";
import { clientIp, handler } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { loadCachedAnalyses } from "@/lib/services/analyses";

/**
 * Returns analyses already generated for this exact file version. Public repos
 * only, so cached results are visible to signed-out visitors too.
 */
export const GET = handler(async (req: Request) => {
  rateLimit(`cached:${clientIp(req)}`, 120, 60_000);
  const { owner, repo, path, sha } = cachedQuerySchema.parse(searchParamsObject(req));
  const body = await loadCachedAnalyses(owner, repo, path, sha);
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
});
