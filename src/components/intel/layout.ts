import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationNodeDatum } from "d3-force";

export type LayoutNode = SimulationNodeDatum & { id: number; group: string; r: number };
export type Layout = {
  nodes: LayoutNode[];
  links: [number, number][];
  groups: string[];
  /** Square that fits every node, as [centreX, centreY, side]. */
  frame: [number, number, number];
};

/** Files are grouped by top-level folder, or by the folder under src/ when nearly everything lives there. */
export function groupOf(path: string, underSrc: boolean): string {
  const parts = path.split("/");
  if (parts.length === 1) return "(root)";
  if (underSrc && parts[0] === "src" && parts.length > 2) return `src/${parts[1]}`;
  return parts[0];
}

/**
 * Lays out up to `max` files with a force simulation, run to completion up
 * front (no animation), so the map appears settled and costs nothing after.
 */
export function computeLayout(
  files: { path: string; rank: number }[],
  edges: [number, number][],
  inDegree: number[],
  outDegree: number[],
  max = 700,
): Layout & { visible: number[]; isolated: number } {
  // Files with no imports in or out (docs, config, scripts) carry no structure; leave them off the map.
  const connected = files.map((_, i) => i).filter((i) => inDegree[i] + outDegree[i] > 0);
  const order = connected;
  const visible =
    order.length <= max
      ? order
      : order.sort((a, b) => files[b].rank + inDegree[b] * 0.2 - (files[a].rank + inDegree[a] * 0.2)).slice(0, max).sort((a, b) => a - b);
  const keep = new Set(visible);
  const srcShare = files.filter((f) => f.path.startsWith("src/")).length / Math.max(files.length, 1);
  const underSrc = srcShare > 0.6;

  const counts = new Map<string, number>();
  const nodes: LayoutNode[] = visible.map((i) => {
    const group = groupOf(files[i].path, underSrc);
    counts.set(group, (counts.get(group) ?? 0) + 1);
    return { id: i, group, r: Math.min(14, 3 + Math.sqrt(inDegree[i]) * 1.8) };
  });
  const groups = [...counts].sort((a, b) => b[1] - a[1]).map(([g]) => g);
  const links = edges.filter(([a, b]) => keep.has(a) && keep.has(b));

  const size = Math.max(600, Math.sqrt(nodes.length) * 70);
  // Each group pulls toward its own anchor on a circle, so folders read as regions.
  const anchor = new Map(
    groups.map((g, k) => {
      const angle = (k / Math.max(groups.length, 1)) * Math.PI * 2;
      const radius = groups.length > 1 ? size * 0.32 : 0;
      return [g, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }];
    }),
  );
  const sim = forceSimulation(nodes)
    .force("charge", forceManyBody<LayoutNode>().strength(-40).distanceMax(size / 2))
    .force(
      "link",
      forceLink<LayoutNode, { source: number; target: number }>(links.map(([a, b]) => ({ source: a, target: b })))
        .id((d) => d.id)
        .distance(40)
        .strength(0.25),
    )
    .force("x", forceX<LayoutNode>((d) => anchor.get(d.group)!.x).strength(0.08))
    .force("y", forceY<LayoutNode>((d) => anchor.get(d.group)!.y).strength(0.08))
    .force("collide", forceCollide<LayoutNode>((d) => d.r + 2))
    .force("center", forceCenter(0, 0))
    .stop();
  const ticks = Math.min(300, Math.ceil(Math.log(sim.alphaMin()) / Math.log(1 - sim.alphaDecay())));
  for (let i = 0; i < ticks; i++) sim.tick();
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const n of nodes) {
    x0 = Math.min(x0, n.x! - n.r);
    y0 = Math.min(y0, n.y! - n.r);
    x1 = Math.max(x1, n.x! + n.r);
    y1 = Math.max(y1, n.y! + n.r);
  }
  const side = nodes.length ? Math.max(x1 - x0, y1 - y0, 120) * 1.12 : size;
  const frame: [number, number, number] = nodes.length ? [(x0 + x1) / 2, (y0 + y1) / 2, side] : [0, 0, size];
  return { nodes, links, groups, frame, visible, isolated: files.length - connected.length };
}
