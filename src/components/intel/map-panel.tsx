"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { RepoInfo } from "@/lib/github/types";
import type { GraphResponse } from "@/app/api/intel/[indexId]/graph/route";
import { adjacency, blastRadius } from "@/lib/intel/graph";
import { workspaceHref } from "@/lib/intel/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { computeLayout } from "./layout";

// Group colours: the lead accent, the poster accents, then neutrals.
const GROUP_COLORS = ["var(--orange)", "var(--teal)", "var(--jungle)", "var(--moon)", "var(--label)", "var(--ink-muted)"];
const OTHER = "var(--hairline)";

type View = { x: number; y: number; k: number };

export function MapPanel({ graph, repo, sha, onAsk }: { graph: GraphResponse; repo: RepoInfo; sha: string; onAsk: (q: string) => void }) {
  const adj = useMemo(() => adjacency(graph.files.length, graph.edges), [graph]);
  const layout = useMemo(
    () => computeLayout(graph.files, graph.edges, adj.in.map((l) => l.length), adj.out.map((l) => l.length)),
    [graph, adj],
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const impact = useMemo(() => (selected === null ? null : blastRadius(selected, adj, graph.files.length)), [selected, adj, graph]);
  const depthOf = useMemo(() => {
    const m = new Map<number, { kind: "dep" | "uses"; depth: number }>();
    impact?.dependents.forEach((d) => m.set(d.node, { kind: "dep", depth: d.depth }));
    impact?.dependencies.forEach((d) => m.has(d.node) || m.set(d.node, { kind: "uses", depth: d.depth }));
    return m;
  }, [impact]);

  const colorOf = useMemo(() => {
    const idx = new Map(layout.groups.map((g, i) => [g, i]));
    return (group: string) => GROUP_COLORS[idx.get(group) ?? 99] ?? OTHER;
  }, [layout.groups]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return graph.files
      .map((f, i) => ({ f, i }))
      .filter(({ f }) => f.path.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, graph]);

  const [cx, cy, side] = layout.frame;
  const span = side / view.k;
  const viewBox = `${cx + view.x - span / 2} ${cy + view.y - span / 2} ${span} ${span}`;
  const nodeById = useMemo(() => new Map(layout.nodes.map((n) => [n.id, n])), [layout]);
  const labelled = useMemo(() => {
    const top = [...layout.nodes].sort((a, b) => b.r - a.r).slice(0, 6).map((n) => n.id);
    return new Set(selected === null ? top : [selected, ...(impact?.dependents.filter((d) => d.depth === 1).map((d) => d.node) ?? [])].slice(0, 14));
  }, [layout, selected, impact]);

  const file = selected === null ? null : graph.files[selected];
  const name = (p: string) => p.slice(p.lastIndexOf("/") + 1);
  const toWorld = (dx: number) => (dx / (svgRef.current?.clientWidth || side)) * span;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Legend">
          {layout.groups.slice(0, GROUP_COLORS.length).map((g) => (
            <span key={g} className="meta flex items-center gap-1.5">
              <span aria-hidden className="inline-block size-2.5" style={{ background: colorOf(g) }} />
              <span className="font-mono text-[13px]">{g}</span>
            </span>
          ))}
          <span className="meta">
            {layout.visible.length} of {graph.files.length} files
            {layout.isolated ? ` · ${layout.isolated} with no imports hidden` : ""}
          </span>
        </div>
        <div className="mt-3 border-2 border-ink bg-sheet dark:border-edge">
          <svg
            ref={svgRef}
            role="img"
            aria-label={`Import graph of ${repo.fullName}. Use the file search beside it to select a file.`}
            viewBox={viewBox}
            className="block aspect-square max-h-[72vh] w-full touch-none select-none"
            onWheel={(e) => {
              const k = Math.min(8, Math.max(0.5, view.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
              setView((v) => ({ ...v, k }));
            }}
            onPointerDown={(e) => {
              drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
              (e.target as Element).setPointerCapture?.(e.pointerId);
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d) return;
              const dx = e.clientX - d.x;
              const dy = e.clientY - d.y;
              if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
              if (d.moved) setView((v) => ({ ...v, x: d.vx - toWorld(dx), y: d.vy - toWorld(dy) }));
            }}
            onPointerUp={(e) => {
              const d = drag.current;
              drag.current = null;
              if (d?.moved) return;
              const id = (e.target as Element).getAttribute("data-node");
              setSelected(id === null ? null : Number(id));
            }}
          >
            <g>
              {layout.links.map(([a, b], i) => {
                const s = nodeById.get(a)!;
                const t = nodeById.get(b)!;
                const hot = selected !== null && (a === selected || b === selected || (depthOf.get(a)?.kind === "dep" && depthOf.has(b)));
                const stroke = !hot ? "var(--ink-muted)" : b === selected || depthOf.get(a)?.kind === "dep" ? "var(--orange)" : "var(--teal)";
                return (
                  <line
                    key={i}
                    x1={s.x}
                    y1={s.y}
                    x2={t.x}
                    y2={t.y}
                    stroke={stroke}
                    strokeWidth={(hot ? 1.6 : 0.8) / view.k}
                    opacity={hot ? 1 : selected === null ? 0.3 : 0.12}
                  />
                );
              })}
            </g>
            <g>
              {layout.nodes.map((n) => {
                const rel = depthOf.get(n.id);
                const isSel = n.id === selected;
                const dim = selected !== null && !isSel && !rel;
                const fill = isSel ? "var(--ink)" : rel ? (rel.kind === "dep" ? "var(--orange)" : "var(--teal)") : colorOf(n.group);
                return (
                  <circle
                    key={n.id}
                    data-node={n.id}
                    cx={n.x}
                    cy={n.y}
                    r={isSel ? n.r + 3 : n.r}
                    fill={fill}
                    opacity={dim ? 0.25 : rel ? Math.max(0.45, 1 - (rel.depth - 1) * 0.2) : 1}
                    stroke="var(--sheet)"
                    strokeWidth={1 / view.k}
                    className="cursor-pointer"
                  >
                    <title>{graph.files[n.id].path}</title>
                  </circle>
                );
              })}
            </g>
            <g className="pointer-events-none">
              {layout.nodes
                .filter((n) => labelled.has(n.id))
                .map((n) => (
                  <text
                    key={n.id}
                    x={n.x! + n.r + 3}
                    y={n.y! + 4}
                    fontSize={12 / view.k}
                    fill="var(--ink)"
                    paintOrder="stroke"
                    stroke="var(--sheet)"
                    strokeWidth={3 / view.k}
                    className="font-mono"
                  >
                    {name(graph.files[n.id].path)}
                  </text>
                ))}
            </g>
          </svg>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setView((v) => ({ ...v, k: Math.min(8, v.k * 1.3) }))} aria-label="Zoom in">
            +
          </Button>
          <Button variant="outline" size="sm" onClick={() => setView((v) => ({ ...v, k: Math.max(0.5, v.k / 1.3) }))} aria-label="Zoom out">
            −
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setView({ x: 0, y: 0, k: 1 })}>
            Reset view
          </Button>
          <span className="meta">Scroll to zoom, drag to pan, click a file to see its blast radius.</span>
        </div>
      </div>

      <aside className="min-w-0" aria-label="File details">
        <label htmlFor="intel-file-search" className="caption">
          Find a file
        </label>
        <Input
          id="intel-file-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. auth"
          className="mt-2"
          autoComplete="off"
        />
        {matches.length ? (
          <ul className="ruled-list mt-2" aria-label="Matching files">
            {matches.map(({ f, i }) => (
              <li key={f.path} className="border-b border-hairline">
                <button
                  type="button"
                  className="w-full truncate py-2 text-left font-mono text-[13px] hover:bg-paper-sunk"
                  onClick={() => {
                    setSelected(i);
                    setQuery("");
                  }}
                >
                  {f.path}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {file && impact ? (
          <div className="mt-6">
            <p className="caption flex items-center gap-1.5">
              <span aria-hidden className="swatch marker-orange" />
              Blast radius
            </p>
            <Link
              href={workspaceHref(repo.owner, repo.name, sha, file.path)}
              className="mt-1 block break-all font-mono text-[15px] leading-5 text-ink hover:text-label"
            >
              {file.path}
            </Link>
            <p className="mt-3 text-[17px] font-semibold leading-6">
              {impact.dependents.length === 0
                ? "Nothing imports this file."
                : `${impact.dependents.length} file${impact.dependents.length === 1 ? " depends" : "s depend"} on it (${impact.dependents.filter((d) => d.depth === 1).length} directly), ${Math.round(impact.reachShare * 100)}% of the repository.`}
            </p>
            <p className="meta mt-1">
              {file.lines} lines · {file.symbols} definitions · imports {adj.out[selected!].length} file{adj.out[selected!].length === 1 ? "" : "s"}
            </p>
            <Button
              className="mt-4"
              size="sm"
              onClick={() => onAsk(`I want to change ${file.path}. What does it do, what depends on it, and what could break?`)}
            >
              Ask about changing it
            </Button>
            <ImpactList title="Depends on it" marker="marker-orange" items={impact.dependents} files={graph.files} repo={repo} sha={sha} />
            <ImpactList title="It depends on" marker="marker-teal" items={impact.dependencies} files={graph.files} repo={repo} sha={sha} />
          </div>
        ) : (
          <div className="mt-6">
            <p className="caption flex items-center gap-1.5">
              <span aria-hidden className="swatch marker-teal" />
              Start here: what most code depends on
            </p>
            <ol className="ruled-list mt-2">
              {graph.overview.central.slice(0, 8).map((c) => (
                <li key={c.path} className="flex items-baseline justify-between gap-3 border-b border-hairline py-2">
                  <button
                    type="button"
                    className="min-w-0 truncate text-left font-mono text-[13px] hover:text-label"
                    onClick={() => setSelected(graph.files.findIndex((f) => f.path === c.path))}
                  >
                    {c.path}
                  </button>
                  <span className="meta shrink-0">{c.dependents} depend on it</span>
                </li>
              ))}
            </ol>
            {graph.overview.cycles.length ? (
              <>
                <p className="caption mt-6 flex items-center gap-1.5">
                  <span aria-hidden className="swatch marker-moon" />
                  Import cycles
                </p>
                <ul className="mt-2 space-y-2">
                  {graph.overview.cycles.map((c, i) => (
                    <li key={i} className="meta break-all font-mono text-[13px]">
                      {c.map(name).join(" → ")} → {name(c[0])}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        )}
      </aside>
    </div>
  );
}

function ImpactList({
  title,
  marker,
  items,
  files,
  repo,
  sha,
}: {
  title: string;
  marker: string;
  items: { node: number; depth: number }[];
  files: GraphResponse["files"];
  repo: RepoInfo;
  sha: string;
}) {
  if (!items.length) return null;
  const shown = items.slice(0, 40);
  return (
    <div className="mt-6">
      <p className="caption flex items-center gap-1.5">
        <span aria-hidden className={`swatch ${marker}`} />
        {title} · {items.length}
      </p>
      <ul className="ruled-list mt-2">
        {shown.map((d) => (
          <li key={d.node} className="flex items-baseline justify-between gap-3 border-b border-hairline py-1.5">
            <Link
              href={workspaceHref(repo.owner, repo.name, sha, files[d.node].path)}
              className="min-w-0 truncate font-mono text-[13px] hover:text-label"
            >
              {files[d.node].path}
            </Link>
            <span className="meta shrink-0">{d.depth === 1 ? "direct" : `${d.depth} hops`}</span>
          </li>
        ))}
      </ul>
      {items.length > shown.length ? <p className="meta mt-1">and {items.length - shown.length} more</p> : null}
    </div>
  );
}
