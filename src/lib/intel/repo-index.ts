import "server-only";
import { db } from "@/lib/db";
import { adjacency, blastRadius, cycles, pageRank, reach, type Adjacency, type GraphEdge } from "./graph";

export type GraphFile = { path: string; language: string | null; lines: number; bytes: number; symbols: number };
export type LoadedGraph = {
  indexId: string;
  files: GraphFile[];
  edges: GraphEdge[];
  adj: Adjacency;
  rank: number[];
  /** How many files transitively import each file: the size of its blast radius. */
  reachCount: number[];
  byPath: Map<string, number>;
};

// Snapshots never change once READY, so their graphs can be cached per instance.
const cache = new Map<string, Promise<LoadedGraph>>();
const MAX_CACHED = 20;

export function loadGraph(indexId: string): Promise<LoadedGraph> {
  let hit = cache.get(indexId);
  if (hit) {
    cache.delete(indexId);
    cache.set(indexId, hit); // refresh LRU position
    return hit;
  }
  hit = (async () => {
    const [files, edges, counts] = await Promise.all([
      db.intelFile.findMany({
        where: { indexId },
        select: { id: true, path: true, language: true, lines: true, bytes: true },
        orderBy: { path: "asc" },
      }),
      db.intelEdge.findMany({ where: { indexId }, select: { fromFileId: true, toFileId: true } }),
      db.intelSymbol.groupBy({ by: ["fileId"], where: { indexId }, _count: { _all: true } }),
    ]);
    const pos = new Map(files.map((f, i) => [f.id, i]));
    const symbolCount = new Map(counts.map((c) => [c.fileId, c._count._all]));
    const pairs: GraphEdge[] = edges.map((e) => [pos.get(e.fromFileId)!, pos.get(e.toFileId)!]);
    const adj = adjacency(files.length, pairs);
    return {
      indexId,
      files: files.map((f) => ({ path: f.path, language: f.language, lines: f.lines, bytes: f.bytes, symbols: symbolCount.get(f.id) ?? 0 })),
      edges: pairs,
      adj,
      rank: pageRank(adj),
      reachCount: adj.in.map((_, i) => reach(i, adj.in).size),
      byPath: new Map(files.map((f, i) => [f.path, i])),
    };
  })();
  cache.set(indexId, hit);
  hit.catch(() => cache.delete(indexId));
  while (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
  return hit;
}

/** Finds the newest finished snapshot of a repository, optionally for one ref or commit. */
export async function findReadyIndex(owner: string, repo: string, ref?: string | null) {
  return db.intelIndex.findFirst({
    where: {
      status: "READY",
      repository: { owner: { equals: owner, mode: "insensitive" }, name: { equals: repo, mode: "insensitive" } },
      ...(ref ? { OR: [{ ref }, { commitSha: ref }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { repository: { select: { owner: true, name: true } } },
  });
}

export function impactOf(graph: LoadedGraph, path: string) {
  const node = graph.byPath.get(path);
  if (node === undefined) return null;
  const impact = blastRadius(node, graph.adj, graph.files.length);
  const name = (n: number) => graph.files[n].path;
  return {
    path,
    dependents: impact.dependents.map((d) => ({ path: name(d.node), depth: d.depth })),
    dependencies: impact.dependencies.map((d) => ({ path: name(d.node), depth: d.depth })),
    directDependents: impact.dependents.filter((d) => d.depth === 1).length,
    reachShare: impact.reachShare,
  };
}

/** Repository overview the agent and MCP clients use to orient themselves. */
export function overview(graph: LoadedGraph) {
  // Central = the most code depends on it, transitively; direct importers break ties.
  const byReach = graph.reachCount
    .map((_, i) => i)
    .sort((a, b) => graph.reachCount[b] - graph.reachCount[a] || graph.adj.in[b].length - graph.adj.in[a].length);
  const languages = new Map<string, number>();
  for (const f of graph.files) if (f.language) languages.set(f.language, (languages.get(f.language) ?? 0) + f.lines);
  return {
    files: graph.files.length,
    edges: graph.edges.length,
    languages: [...languages].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([language, lines]) => ({ language, lines })),
    central: byReach
      .slice(0, 12)
      .filter((i) => graph.reachCount[i] > 0)
      .map((i) => ({ path: graph.files[i].path, importedBy: graph.adj.in[i].length, dependents: graph.reachCount[i] })),
    cycles: cycles(graph.adj).slice(0, 5).map((c) => c.map((i) => graph.files[i].path)),
  };
}

/** Reassembles line ranges of a file from its stored chunks. */
export async function readLines(indexId: string, path: string, start = 1, end = start + 199) {
  const file = await db.intelFile.findUnique({ where: { indexId_path: { indexId, path } }, select: { id: true, lines: true } });
  if (!file) return null;
  const from = Math.max(1, start);
  const to = Math.min(file.lines, Math.max(from, end), from + 399);
  const chunks = await db.intelChunk.findMany({
    where: { fileId: file.id, startLine: { lte: to }, endLine: { gte: from } },
    orderBy: { startLine: "asc" },
    select: { startLine: true, text: true },
  });
  const lines = new Map<number, string>();
  for (const c of chunks) c.text.split("\n").forEach((l, i) => lines.set(c.startLine + i, l));
  const out: string[] = [];
  for (let n = from; n <= to; n++) out.push(`${n}| ${lines.get(n) ?? ""}`);
  return { path, startLine: from, endLine: to, totalLines: file.lines, text: out.join("\n") };
}

export async function findSymbols(indexId: string, name: string, limit = 20) {
  const rows = await db.intelSymbol.findMany({
    where: { indexId, name: { startsWith: name, mode: "insensitive" } },
    take: limit * 3,
    select: { name: true, kind: true, startLine: true, endLine: true, exported: true, file: { select: { path: true } } },
  });
  // Exact matches first, then exported ones.
  return rows
    .map((r) => ({ name: r.name, kind: r.kind, path: r.file.path, startLine: r.startLine, endLine: r.endLine, exported: r.exported }))
    .sort((a, b) => Number(b.name === name) - Number(a.name === name) || Number(b.exported) - Number(a.exported))
    .slice(0, limit);
}
