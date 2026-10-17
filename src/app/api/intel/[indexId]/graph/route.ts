import { handler } from "@/lib/http";
import { readyIndex, requireIntel } from "@/lib/intel/http";
import { loadGraph, overview } from "@/lib/intel/repo-index";

export type GraphResponse = {
  files: { path: string; language: string | null; lines: number; symbols: number; rank: number }[];
  edges: [number, number][];
  overview: ReturnType<typeof overview>;
};

/** The whole import graph of a snapshot. Immutable, so browsers and the CDN may cache it. */
export const GET = handler(async (_req: Request, ctx: RouteContext<"/api/intel/[indexId]/graph">) => {
  requireIntel();
  const { indexId } = await ctx.params;
  const index = await readyIndex(indexId);
  const graph = await loadGraph(index.id);
  const body: GraphResponse = {
    files: graph.files.map((f, i) => ({
      path: f.path,
      language: f.language,
      lines: f.lines,
      symbols: f.symbols,
      rank: Math.round(graph.rank[i] * graph.files.length * 1000) / 1000,
    })),
    edges: graph.edges,
    overview: overview(graph),
  };
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=3600, immutable" } });
});
