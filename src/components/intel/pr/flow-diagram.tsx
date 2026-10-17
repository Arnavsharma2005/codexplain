import { BOX_HEIGHT, FLOW_WIDTH, describeFlow, layoutLane, type LaneLayout } from "@/lib/intel/pulls/flow-layout";
import type { Flow } from "@/lib/intel/pulls/types";

const LABEL_H = 22; // lane title above the boxes
const NOTE_H = 22; // lane note below them
const LANE_GAP = 26;

/** A before/after flow drawn on the code plate. Server-safe: no client code. */
export function FlowDiagram({ flow, id }: { flow: Flow; id: string }) {
  const lanes: { name: string; note: string; layout: LaneLayout; hot: boolean }[] = [];
  if (flow.before) lanes.push({ name: "Before", note: flow.before.note, layout: layoutLane(flow.before, false), hot: false });
  lanes.push({ name: flow.before ? "After" : "How it works", note: flow.after.note, layout: layoutLane(flow.after, true), hot: true });

  let y = 0;
  const placed = lanes.map((l) => {
    const top = y;
    y += LABEL_H + l.layout.height + (l.note ? NOTE_H : 4) + LANE_GAP;
    return { ...l, top };
  });
  const height = y - LANE_GAP;

  return (
    <svg viewBox={`-2 0 ${FLOW_WIDTH + 4} ${height}`} className="block w-full" role="img" aria-label={describeFlow(flow)}>
      <defs>
        {(["cool", "hot"] as const).map((k) => (
          <marker key={k} id={`${id}-${k}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0 L8 4 L0 8 z" fill={k === "hot" ? "var(--map-dep)" : "var(--plate-muted)"} />
          </marker>
        ))}
      </defs>
      {placed.map((l) => (
        <g key={l.name} transform={`translate(0 ${l.top})`}>
          <text x={0} y={12} className="wt-svg-label">
            {l.name.toUpperCase()}
          </text>
          <g transform={`translate(0 ${LABEL_H})`}>
            {l.layout.arrows.map((a, i) => (
              <line
                key={i}
                x1={a.x1}
                y1={a.y1}
                x2={a.x2}
                y2={a.y2}
                stroke={l.hot ? "var(--map-dep)" : "var(--plate-muted)"}
                strokeWidth={1.5}
                markerEnd={`url(#${id}-${l.hot ? "hot" : "cool"})`}
              />
            ))}
            {l.layout.boxes.map((b, i) => (
              <g key={i}>
                <rect x={b.x} y={b.y} width={b.w} height={BOX_HEIGHT} fill="var(--plate)" stroke={b.hot ? "var(--map-dep)" : "var(--plate-muted)"} strokeWidth={1.5} />
                <text x={b.x + b.w / 2} y={b.y + 16} textAnchor="middle" className="wt-svg-text">
                  {b.label}
                  {b.label !== b.full ? <title>{b.full}</title> : null}
                </text>
              </g>
            ))}
          </g>
          {l.note ? (
            <text x={0} y={LABEL_H + l.layout.height + 17} className="wt-svg-meta">
              {l.note}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}
