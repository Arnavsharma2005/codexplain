/** Pure graph helpers shared by the API, the MCP server and the map UI. */

export type GraphEdge = [from: number, to: number];

export type Adjacency = { out: number[][]; in: number[][] };

export function adjacency(nodeCount: number, edges: GraphEdge[]): Adjacency {
  const out = Array.from({ length: nodeCount }, () => [] as number[]);
  const inn = Array.from({ length: nodeCount }, () => [] as number[]);
  for (const [a, b] of edges) {
    out[a].push(b);
    inn[b].push(a);
  }
  return { out, in: inn };
}

/**
 * Breadth-first walk from `start` along `next`. Returns node → hop distance
 * (start excluded), so callers can show direct and transitive impact apart.
 */
export function reach(start: number, next: number[][], maxDepth = Infinity): Map<number, number> {
  const depth = new Map<number, number>([[start, 0]]);
  let frontier = [start];
  for (let d = 1; frontier.length && d <= maxDepth; d++) {
    const nextFrontier: number[] = [];
    for (const n of frontier)
      for (const m of next[n])
        if (!depth.has(m)) {
          depth.set(m, d);
          nextFrontier.push(m);
        }
    frontier = nextFrontier;
  }
  depth.delete(start);
  return depth;
}

export type Impact = {
  /** Files that import the target, directly or through other files, with hop count. */
  dependents: { node: number; depth: number }[];
  /** Files the target imports, directly or transitively. */
  dependencies: { node: number; depth: number }[];
  /** Share of the repository's files that could be affected by a change, 0–1. */
  reachShare: number;
};

/** "If I change this file, what can break?" — the reverse-dependency closure. */
export function blastRadius(target: number, adj: Adjacency, nodeCount: number): Impact {
  const toList = (m: Map<number, number>) =>
    [...m].map(([node, depth]) => ({ node, depth })).sort((a, b) => a.depth - b.depth || a.node - b.node);
  const dependents = toList(reach(target, adj.in));
  return {
    dependents,
    dependencies: toList(reach(target, adj.out)),
    reachShare: nodeCount > 1 ? dependents.length / (nodeCount - 1) : 0,
  };
}

/** Files nothing imports and that import nothing: often dead code or entry points. */
export function isolated(adj: Adjacency): number[] {
  return adj.out.flatMap((o, i) => (o.length === 0 && adj.in[i].length === 0 ? [i] : []));
}

/** Import cycles via Tarjan's SCC; returns components with more than one file. */
export function cycles(adj: Adjacency): number[][] {
  const n = adj.out.length;
  const index = new Array<number>(n).fill(-1);
  const low = new Array<number>(n).fill(0);
  const onStack = new Array<boolean>(n).fill(false);
  const stack: number[] = [];
  const out: number[][] = [];
  let counter = 0;

  // Iterative to survive deep graphs without blowing the call stack.
  for (let root = 0; root < n; root++) {
    if (index[root] !== -1) continue;
    const work: [node: number, edge: number][] = [[root, 0]];
    index[root] = low[root] = counter++;
    stack.push(root);
    onStack[root] = true;
    while (work.length) {
      const top = work[work.length - 1];
      const [v, i] = top;
      if (i < adj.out[v].length) {
        top[1]++;
        const w = adj.out[v][i];
        if (index[w] === -1) {
          index[w] = low[w] = counter++;
          stack.push(w);
          onStack[w] = true;
          work.push([w, 0]);
        } else if (onStack[w]) low[v] = Math.min(low[v], index[w]);
      } else {
        work.pop();
        if (work.length) {
          const parent = work[work.length - 1][0];
          low[parent] = Math.min(low[parent], low[v]);
        }
        if (low[v] === index[v]) {
          const comp: number[] = [];
          let w: number;
          do {
            w = stack.pop()!;
            onStack[w] = false;
            comp.push(w);
          } while (w !== v);
          if (comp.length > 1) out.push(comp.sort((a, b) => a - b));
        }
      }
    }
  }
  return out.sort((a, b) => b.length - a.length);
}

/**
 * PageRank over the import graph: a file imported by central files is
 * central itself. Used to rank "start here" files and embedding priority.
 */
export function pageRank(adj: Adjacency, iterations = 30, damping = 0.85): number[] {
  const n = adj.out.length;
  if (!n) return [];
  let rank = new Array<number>(n).fill(1 / n);
  for (let it = 0; it < iterations; it++) {
    const next = new Array<number>(n).fill((1 - damping) / n);
    let sinkMass = 0;
    for (let v = 0; v < n; v++) {
      // Rank flows from importer to imported file.
      const outs = adj.out[v];
      if (!outs.length) sinkMass += rank[v];
      else for (const w of outs) next[w] += (damping * rank[v]) / outs.length;
    }
    for (let v = 0; v < n; v++) next[v] += (damping * sinkMass) / n;
    rank = next;
  }
  return rank;
}
