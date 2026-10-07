import type { TreeEntry } from "@/lib/github/types";

export type TreeIndex = {
  /** directory path ("" = root) → sorted child entries */
  children: Map<string, TreeEntry[]>;
  files: string[];
};

function parentOf(path: string) {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export function buildTreeIndex(entries: TreeEntry[]): TreeIndex {
  const children = new Map<string, TreeEntry[]>();
  const files: string[] = [];
  const dirs = new Set<string>();
  for (const e of entries) {
    if (e.type === "tree") dirs.add(e.path);
    else files.push(e.path);
  }
  // Truncated trees can miss intermediate directories; synthesize them.
  for (const f of files) {
    let p = parentOf(f);
    while (p && !dirs.has(p)) {
      dirs.add(p);
      p = parentOf(p);
    }
  }
  const all: TreeEntry[] = [
    ...[...dirs].map((path) => ({ path, type: "tree" as const })),
    ...entries.filter((e) => e.type === "blob"),
  ];
  for (const e of all) {
    const parent = parentOf(e.path);
    const list = children.get(parent);
    if (list) list.push(e);
    else children.set(parent, [e]);
  }
  for (const list of children.values()) {
    list.sort((a, b) => {
      if (a.type !== b.type) return a.type === "tree" ? -1 : 1;
      return collator.compare(baseName(a.path), baseName(b.path));
    });
  }
  return { children, files };
}

export function baseName(path: string) {
  return path.slice(path.lastIndexOf("/") + 1);
}

export function ancestorsOf(path: string): string[] {
  const parts = path.split("/");
  const out: string[] = [];
  for (let i = 1; i < parts.length; i++) out.push(parts.slice(0, i).join("/"));
  return out;
}

/**
 * Fuzzy subsequence match, scored so that matches in the file name, at word
 * boundaries and in consecutive runs rank higher. Returns null on no match.
 */
export function fuzzyScore(query: string, path: string): number | null {
  const q = query.toLowerCase().replace(/\s+/g, "");
  if (!q) return 0;
  const p = path.toLowerCase();
  const nameStart = p.lastIndexOf("/") + 1;
  let score = 0;
  let qi = 0;
  let prev = -2;
  for (let i = 0; i < p.length && qi < q.length; i++) {
    if (p[i] !== q[qi]) continue;
    let s = 1;
    if (i === prev + 1) s += 4;
    if (i === nameStart || /[/._-]/.test(p[i - 1] ?? "/")) s += 3;
    if (i >= nameStart) s += 2;
    score += s;
    prev = i;
    qi++;
  }
  if (qi < q.length) return null;
  if (p.slice(nameStart).includes(q)) score += 20;
  return score - p.length * 0.05;
}
