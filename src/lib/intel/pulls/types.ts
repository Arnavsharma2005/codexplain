/** Shapes stored in PrWalkthrough.data and sent to the walkthrough page. Safe to import from client code. */

export type FileStatus = "added" | "removed" | "modified" | "renamed" | "copied" | "changed" | "unchanged";

export type FileKind = "source" | "test" | "docs" | "config" | "generated";

export type WalkFile = {
  path: string;
  previousPath?: string;
  status: FileStatus;
  kind: FileKind;
  language: string;
  additions: number;
  deletions: number;
  /** Unified diff hunks, trimmed for storage; null when GitHub sent none (binary or huge). */
  patch: string | null;
  /** True when the stored patch was cut short. */
  truncated: boolean;
  /** Files outside the PR that import this one, directly or through others. */
  dependents: number;
};

export type FlowLane = { note: string; stages: string[][] };

/** A small before/after pipeline diagram, drawn by our own SVG (no Mermaid runtime). */
export type Flow = { title: string; before: FlowLane | null; after: FlowLane };

export type NoteTone = "warn" | "fine" | "info";

/** `start` 0 points at the whole file. */
export type LineRef = { path: string; start: number; end: number };

export type ReviewNote = { tone: NoteTone; text: string; ref: LineRef | null };

export type LayerBlast = {
  /** Files outside the PR that depend on this layer's files. */
  total: number;
  /** Up to 8 of them that import a layer file directly. */
  direct: string[];
  /** Up to 4 further ones reached through those. */
  more: string[];
};

export type WalkLayer = {
  title: string;
  /** Indices into WalkthroughData.files, in reading order. */
  files: number[];
  /** Markdown with [path:Lx-Ly] citations; null when the AI step was skipped. */
  summary: string | null;
  /** One sentence on what the blast radius means, when it is worth saying. */
  impact: string | null;
  flow: Flow | null;
  notes: ReviewNote[];
  /** Earlier layers (0-based) this one builds on, transitively reduced. */
  after: number[];
  blast: LayerBlast;
};

export type Risk = "low" | "medium" | "high";

export type WalkthroughData = {
  version: 1;
  story: string | null;
  risk: Risk;
  files: WalkFile[];
  layers: WalkLayer[];
  /** Files outside the PR that depend on anything it changes. */
  blastTotal: number;
  /** Size of the import graph the ordering used; 0 when the graph could not be built. */
  graphFiles: number;
  /** Why summaries are missing, when they are. */
  aiError: string | null;
};

/** A diff row ready to draw: `html` is escaped, highlighted code. */
export type DiffLine =
  | { kind: "hunk"; text: string }
  | { kind: "ctx"; old: number; new: number; html: string }
  | { kind: "add"; new: number; html: string }
  | { kind: "del"; old: number; html: string };
