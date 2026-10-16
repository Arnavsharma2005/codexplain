import { describe, expect, it } from "vitest";
import { adjacency, blastRadius, cycles, isolated, pageRank, reach } from "@/lib/intel/graph";

// 0 ← 1 ← 2 ← 3, and 4 → 0; 5 and 6 import each other; 7 is alone. (a → b means a imports b.)
const edges: [number, number][] = [
  [1, 0],
  [2, 1],
  [3, 2],
  [4, 0],
  [5, 6],
  [6, 5],
];
const adj = adjacency(8, edges);

describe("graph", () => {
  it("measures blast radius with hop distance", () => {
    const impact = blastRadius(0, adj, 8);
    expect(impact.dependents).toEqual([
      { node: 1, depth: 1 },
      { node: 4, depth: 1 },
      { node: 2, depth: 2 },
      { node: 3, depth: 3 },
    ]);
    expect(impact.dependencies).toEqual([]);
    expect(impact.reachShare).toBeCloseTo(4 / 7);
    expect(blastRadius(3, adj, 8).dependencies.map((d) => d.node)).toEqual([2, 1, 0]);
  });

  it("limits reach by depth and terminates on cycles", () => {
    expect([...reach(0, adj.in, 1).keys()]).toEqual([1, 4]);
    expect([...reach(5, adj.out).keys()]).toEqual([6]);
  });

  it("finds import cycles and isolated files", () => {
    expect(cycles(adj)).toEqual([[5, 6]]);
    expect(isolated(adj)).toEqual([7]);
  });

  it("ranks the most imported file highest", () => {
    const rank = pageRank(adjacency(5, edges.slice(0, 4)));
    expect(rank.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(rank.indexOf(Math.max(...rank))).toBe(0);
  });

  it("handles a deep chain without overflowing the stack", () => {
    const n = 50_000;
    const chain = adjacency(n, Array.from({ length: n - 1 }, (_, i) => [i + 1, i] as [number, number]));
    expect(cycles(chain)).toEqual([]);
    expect(reach(0, chain.in).size).toBe(n - 1);
  });
});
