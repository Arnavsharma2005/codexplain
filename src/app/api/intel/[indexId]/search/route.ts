import { z } from "zod";
import { getSession } from "@/lib/auth";
import { searchParamsObject } from "@/lib/api-schemas";
import { clientIp, handler } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { readyIndex, requireIntel } from "@/lib/intel/http";
import { hybridSearch } from "@/lib/intel/search";

const querySchema = z.object({ q: z.string().trim().min(1).max(500) });

export const GET = handler(async (req: Request, ctx: RouteContext<"/api/intel/[indexId]/search">) => {
  requireIntel();
  const session = await getSession();
  rateLimit(`intel-search:${session?.user?.id ?? clientIp(req)}`, 30, 60_000);
  const { indexId } = await ctx.params;
  const index = await readyIndex(indexId);
  const { q } = querySchema.parse(searchParamsObject(req));
  // Semantic search spends embedding quota, so it is for signed-in users only.
  const result = await hybridSearch(index.id, q, { limit: 12, semantic: !!session?.user });
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
});
