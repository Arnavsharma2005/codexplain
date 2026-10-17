/**
 * Lays out a before/after flow as boxes and arrows for a small SVG. Stages
 * run left to right when they fit the width, otherwise top to bottom; boxes
 * in one stage sit side by side. Pure, so the geometry is unit tested.
 */
import type { Flow, FlowLane } from "./types";

export const FLOW_WIDTH = 320;
const CHAR = 7.2; // 12px monospace advance
const PAD = 7;
const BOX_H = 24;
const GAP_X = 22; // room for an arrow between stages
const GAP_Y = 6; // between boxes stacked in one stage
const ROW_GAP = 20; // between stages in a vertical lane
const MIN_BOX = 40;

export type FlowBox = { x: number; y: number; w: number; label: string; full: string; hot: boolean };
export type FlowArrow = { x1: number; y1: number; x2: number; y2: number };
export type LaneLayout = { boxes: FlowBox[]; arrows: FlowArrow[]; height: number; direction: "across" | "down" };

const fit = (label: string, w: number) => {
  const max = Math.max(3, Math.floor((w - 2 * PAD) / CHAR));
  return label.length <= max ? label : `${label.slice(0, max - 1)}…`;
};

/** Which boxes of one stage connect to which of the next: one-to-many fans, equal counts pair up. */
export function links(from: number, to: number): [number, number][] {
  if (from === 1 || to === 1 || from === to) {
    const n = Math.max(from, to);
    return Array.from({ length: n }, (_, i) => [from === 1 ? 0 : i, to === 1 ? 0 : i]);
  }
  const out = new Set<string>();
  for (let i = 0; i < from; i++) out.add(`${i}:${Math.round((i * (to - 1)) / (from - 1))}`);
  for (let j = 0; j < to; j++) out.add(`${Math.round((j * (from - 1)) / (to - 1))}:${j}`);
  return [...out].map((k) => k.split(":").map(Number) as [number, number]);
}

export function layoutLane(lane: FlowLane, hot: boolean, width = FLOW_WIDTH): LaneLayout {
  const natural = (s: string) => Math.max(MIN_BOX, Math.ceil(s.length * CHAR + 2 * PAD));
  const stageW = lane.stages.map((s) => Math.max(...s.map(natural)));
  const across = stageW.reduce((a, b) => a + b, 0) + GAP_X * (lane.stages.length - 1) <= width;
  const last = lane.stages.length - 1;
  const boxes: FlowBox[][] = [];

  if (across) {
    const stackH = (n: number) => n * BOX_H + (n - 1) * GAP_Y;
    const height = Math.max(...lane.stages.map((s) => stackH(s.length)));
    let x = 0;
    lane.stages.forEach((stage, k) => {
      const top = (height - stackH(stage.length)) / 2;
      boxes.push(
        stage.map((label, i) => ({
          x,
          y: top + i * (BOX_H + GAP_Y),
          w: stageW[k],
          label: fit(label, stageW[k]),
          full: label,
          hot: hot && (k === 0 || k === last),
        })),
      );
      x += stageW[k] + GAP_X;
    });
    const arrows = boxes.slice(1).flatMap((next, k) =>
      links(boxes[k].length, next.length).map(([a, b]) => {
        const from = boxes[k][a];
        const to = next[b];
        return { x1: from.x + from.w + 2, y1: from.y + BOX_H / 2, x2: to.x - 3, y2: to.y + BOX_H / 2 };
      }),
    );
    return { boxes: boxes.flat(), arrows, height, direction: "across" };
  }

  let y = 0;
  lane.stages.forEach((stage, k) => {
    const gap = 8;
    const w = Math.min(Math.max(...stage.map(natural)), (width - gap * (stage.length - 1)) / stage.length);
    const rowW = w * stage.length + gap * (stage.length - 1);
    const left = (width - rowW) / 2;
    boxes.push(stage.map((label, i) => ({ x: left + i * (w + gap), y, w, label: fit(label, w), full: label, hot: hot && (k === 0 || k === last) })));
    y += BOX_H + ROW_GAP;
  });
  const arrows = boxes.slice(1).flatMap((next, k) =>
    links(boxes[k].length, next.length).map(([a, b]) => {
      const from = boxes[k][a];
      const to = next[b];
      return { x1: from.x + from.w / 2, y1: from.y + BOX_H + 2, x2: to.x + to.w / 2, y2: to.y - 3 };
    }),
  );
  return { boxes: boxes.flat(), arrows, height: y - ROW_GAP, direction: "down" };
}

export const BOX_HEIGHT = BOX_H;

/** A sentence a screen reader can use in place of the drawing. */
export function describeFlow(flow: Flow): string {
  const lane = (l: FlowLane) => l.stages.map((s) => s.join(" and ")).join(", then ");
  return `${flow.before ? `Before: ${lane(flow.before)}. ` : ""}After: ${lane(flow.after)}.`;
}
