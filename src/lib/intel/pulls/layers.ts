/**
 * Turns a pull request's changed files into ordered review layers: foundations
 * first, then the code that uses them. Pure, so the ordering rules are unit
 * tested apart from GitHub and the model.
 */
import { adjacency, reach, type GraphEdge } from "../graph";
import type { FileKind, LayerBlast, Risk, WalkFile } from "./types";

export type PrFileRef = { path: string; /** Head paths a deleted file used to import (it has no head node). */ removedImports?: string[] };

export type PrGraph = {
  /** Per PR file: other PR files it depends on, directly or through unchanged files. */
  deps: Set<number>[];
  /** Per PR file: files outside the PR that depend on it, with hop distance. */
  dependents: Map<string, number>[];
  /** Files in the import graph the ordering used. */
  graphFiles: number;
};

/** Projects the whole-repository import graph onto the files a PR changes. */
export function buildPrGraph(repoFiles: string[], edges: GraphEdge[], prFiles: PrFileRef[]): PrGraph {
  const adj = adjacency(repoFiles.length, edges);
  const position = new Map(repoFiles.map((p, i) => [p, i]));
  const prIndex = new Map(prFiles.map((f, i) => [f.path, i]));
  const deps: Set<number>[] = [];
  const dependents: Map<string, number>[] = [];

  const prDepsFrom = (nodes: Iterable<number>, self: number) => {
    const out = new Set<number>();
    for (const n of nodes) {
      const j = prIndex.get(repoFiles[n]);
      if (j !== undefined && j !== self) out.add(j);
    }
    return out;
  };

  prFiles.forEach((f, i) => {
    const node = position.get(f.path);
    if (node !== undefined) {
      deps.push(prDepsFrom(reach(node, adj.out).keys(), i));
      const outside = new Map<string, number>();
      for (const [n, depth] of reach(node, adj.in)) if (!prIndex.has(repoFiles[n])) outside.set(repoFiles[n], depth);
      dependents.push(outside);
      return;
    }
    // Deleted (or unparsed) file: follow what it used to import.
    const reached = new Set<number>();
    for (const target of f.removedImports ?? []) {
      const t = position.get(target);
      if (t === undefined) continue;
      reached.add(t);
      for (const n of reach(t, adj.out).keys()) reached.add(n);
    }
    deps.push(prDepsFrom(reached, i));
    dependents.push(new Map());
  });
  return { deps, dependents, graphFiles: repoFiles.length };
}

const GENERATED = [
  /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|Cargo\.lock|poetry\.lock|Pipfile\.lock|uv\.lock|Gemfile\.lock|composer\.lock|go\.sum|flake\.lock)$/,
  /\.(min\.(js|css)|map|snap)$/,
  /(^|\/)(dist|build|vendor|node_modules|__generated__|generated)\//,
  /(\.generated\.|\.pb\.go$|_pb2\.py$|\.g\.dart$)/,
];
const TEST = [/(^|\/)(tests?|__tests__|spec|specs|e2e|cypress|testdata|fixtures)\//, /\.(test|spec)\.[a-z0-9]+$/i, /_test\.go$/, /(^|\/)test_[^/]+\.py$/];
const DOCS = [/\.(md|mdx|rst|adoc|txt)$/i, /(^|\/)docs?\//, /(^|\/)(LICENSE|CHANGELOG|AUTHORS)(\.|$)/];
const CONFIG = [
  /(^|\/)(package\.json|tsconfig[^/]*\.json|jsconfig\.json|Dockerfile|Makefile|\.gitignore|\.dockerignore|\.editorconfig|\.npmrc|\.nvmrc|\.env\.example)$/,
  /(^|\/)[^/]+\.config\.(js|cjs|mjs|ts)$/,
  /(^|\/)\.(eslintrc|prettierrc|babelrc)[^/]*$/,
  /^\.github\//,
  /\.(ya?ml|toml|ini)$/i,
];

export function classifyFile(path: string): FileKind {
  if (GENERATED.some((r) => r.test(path))) return "generated";
  if (TEST.some((r) => r.test(path))) return "test";
  if (DOCS.some((r) => r.test(path))) return "docs";
  if (CONFIG.some((r) => r.test(path))) return "config";
  return "source";
}

/**
 * Reading level of each file: 0 for files that depend on no other changed
 * file, otherwise one more than the deepest file they depend on. Files that
 * depend on each other (an import cycle) share a level.
 */
export function readingLevels(deps: Set<number>[], include: (i: number) => boolean = () => true): number[] {
  const n = deps.length;
  const level = new Array<number>(n).fill(-1);
  const visiting = new Array<boolean>(n).fill(false);
  const mutual = (a: number, b: number) => deps[a].has(b) && deps[b].has(a);
  const visit = (i: number): number => {
    if (level[i] >= 0) return level[i];
    if (visiting[i]) return 0;
    visiting[i] = true;
    let l = 0;
    for (const j of deps[i]) if (include(j) && !mutual(i, j)) l = Math.max(l, visit(j) + 1);
    visiting[i] = false;
    level[i] = l;
    return l;
  };
  for (let i = 0; i < n; i++) if (include(i)) visit(i);
  return level;
}

export type ProposedLayer = { title: string; files: number[] };

const commonDir = (paths: string[]) => {
  const parts = paths.map((p) => p.split("/").slice(0, -1));
  const first = parts[0] ?? [];
  let n = 0;
  while (n < first.length && parts.every((p) => p[n] === first[n])) n++;
  return first.slice(0, n).join("/");
};

const MAX_DEFAULT_LAYERS = 6;

/** Layers from the graph alone: one per reading level, then tests, docs and config, then generated files. */
export function defaultLayers(files: { path: string; kind: FileKind }[], graph: PrGraph | null): ProposedLayer[] {
  const source = files.map((f, i) => (f.kind === "source" ? i : -1)).filter((i) => i >= 0);
  const levels = graph ? readingLevels(graph.deps, (i) => files[i].kind === "source") : files.map(() => 0);
  const byLevel = new Map<number, number[]>();
  for (const i of source) byLevel.set(levels[i], [...(byLevel.get(levels[i]) ?? []), i]);
  const groups = [...byLevel.entries()].sort((a, b) => a[0] - b[0]).map(([, g]) => g);
  while (groups.length > MAX_DEFAULT_LAYERS) {
    let best = 0;
    for (let k = 1; k < groups.length - 1; k++) if (groups[k].length + groups[k + 1].length < groups[best].length + groups[best + 1].length) best = k;
    groups.splice(best, 2, [...groups[best], ...groups[best + 1]]);
  }
  const layers: ProposedLayer[] = groups.map((g, k) => {
    const dir = commonDir(g.map((i) => files[i].path));
    return { title: dir ? `Changes in ${dir}` : k === 0 ? "Foundations" : "Code built on them", files: g };
  });
  const ofKind = (...kinds: FileKind[]) => files.map((f, i) => (kinds.includes(f.kind) ? i : -1)).filter((i) => i >= 0);
  const tests = ofKind("test");
  const docs = ofKind("docs", "config");
  const generated = ofKind("generated");
  if (tests.length) layers.push({ title: "Tests", files: tests });
  if (docs.length) layers.push({ title: "Docs and config", files: docs });
  if (generated.length) layers.push({ title: "Lock and generated files", files: generated });
  return layers;
}

/** `source` is the index of the proposed layer it came from, or -1 for one added here. */
export type OrderedLayer = ProposedLayer & { after: number[]; blast: LayerBlast; source: number };

/**
 * Takes layers from the model (or `defaultLayers`), repairs them and puts
 * them in an order where no layer comes before one it depends on:
 * unknown and duplicate files are dropped, missing files are placed next to
 * files in the same folder, generated files go last.
 */
export function finalizeLayers(
  proposed: { title: string; files: string[] }[],
  files: Pick<WalkFile, "path" | "kind">[],
  graph: PrGraph | null,
): OrderedLayer[] {
  const index = new Map(files.map((f, i) => [f.path, i]));
  const placed = new Set<number>();
  const layers: (ProposedLayer & { source: number })[] = [];
  for (const [source, p] of proposed.entries()) {
    const own: number[] = [];
    for (const path of p.files) {
      const i = index.get(path);
      if (i === undefined || placed.has(i) || files[i].kind === "generated") continue;
      placed.add(i);
      own.push(i);
    }
    layers.push({ title: p.title, files: own, source });
  }

  const dirOf = (p: string) => p.slice(0, p.lastIndexOf("/") + 1);
  let other: (ProposedLayer & { source: number }) | null = null;
  files.forEach((f, i) => {
    if (placed.has(i) || f.kind === "generated") return;
    const home =
      layers.find((l) => l.files.some((j) => dirOf(files[j].path) === dirOf(f.path))) ??
      layers.findLast((l) => graph && l.files.some((j) => graph.deps[i].has(j)));
    if (home) home.files.push(i);
    else (other ??= { title: "Other changes", files: [], source: -1 }).files.push(i);
    placed.add(i);
  });
  if (other) layers.push(other);

  const kept = layers.filter((l) => l.files.length);
  const deps = (a: ProposedLayer, b: ProposedLayer) => !!graph && a.files.some((i) => b.files.some((j) => graph.deps[i].has(j)));
  const layerDeps = kept.map((a, ai) => new Set(kept.flatMap((b, bi) => (bi !== ai && deps(a, b) ? [bi] : []))));

  // Kahn's algorithm, preferring the proposed order; a cycle falls back to it.
  const order: number[] = [];
  const done = new Set<number>();
  while (order.length < kept.length) {
    const ready = kept.findIndex((_, i) => !done.has(i) && [...layerDeps[i]].every((d) => done.has(d)));
    const next = ready >= 0 ? ready : kept.findIndex((_, i) => !done.has(i));
    order.push(next);
    done.add(next);
  }

  const levels = graph ? readingLevels(graph.deps) : files.map(() => 0);
  const position = new Map(order.map((li, k) => [li, k]));
  const closure = (li: number, seen = new Set<number>()): Set<number> => {
    for (const d of layerDeps[li]) if (!seen.has(d)) closure(d, seen.add(d));
    return seen;
  };

  const result: OrderedLayer[] = order.map((li) => {
    const l = kept[li];
    const earlier = [...layerDeps[li]].filter((d) => position.get(d)! < position.get(li)!);
    const reduced = earlier.filter((b) => !earlier.some((c) => c !== b && closure(c).has(b)));
    return {
      title: l.title,
      files: [...l.files].sort((a, b) => levels[a] - levels[b] || files[a].path.localeCompare(files[b].path)),
      after: reduced.map((d) => position.get(d)!).sort((a, b) => a - b),
      blast: layerBlast(l.files, graph),
      source: l.source,
    };
  });

  const generated = files.map((f, i) => (f.kind === "generated" ? i : -1)).filter((i) => i >= 0);
  if (generated.length)
    result.push({ title: "Lock and generated files", files: generated, after: [], blast: { total: 0, direct: [], more: [] }, source: -1 });
  return result;
}

export function layerBlast(fileIdx: number[], graph: PrGraph | null): LayerBlast {
  if (!graph) return { total: 0, direct: [], more: [] };
  const depth = new Map<string, number>();
  for (const i of fileIdx) for (const [p, d] of graph.dependents[i]) depth.set(p, Math.min(d, depth.get(p) ?? Infinity));
  const sorted = [...depth].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  return {
    total: sorted.length,
    direct: sorted.filter(([, d]) => d === 1).slice(0, 8).map(([p]) => p),
    more: sorted.filter(([, d]) => d > 1).slice(0, 4).map(([p]) => p),
  };
}

/** Everything outside the PR that depends on any changed file. */
export function totalBlast(graph: PrGraph | null): number {
  if (!graph) return 0;
  const all = new Set<string>();
  for (const m of graph.dependents) for (const p of m.keys()) all.add(p);
  return all.size;
}

const SENSITIVE = /(^|\/)(auth|security|session|crypto|permissions?|billing|payments?|migrations?)(\/|\.|$)/i;

/** Review risk when the model gives none: size, reach and sensitive paths. */
export function heuristicRisk(files: Pick<WalkFile, "path" | "kind" | "additions" | "deletions">[], blastTotal: number, graphFiles: number): Risk {
  const lines = files.filter((f) => f.kind !== "generated").reduce((n, f) => n + f.additions + f.deletions, 0);
  const share = graphFiles ? blastTotal / graphFiles : 0;
  if (share > 0.3 || lines > 1500) return "high";
  if (share > 0.05 || lines > 300 || files.some((f) => SENSITIVE.test(f.path))) return "medium";
  return "low";
}
