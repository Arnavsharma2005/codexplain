import "server-only";
import { highlightLines } from "@/lib/highlight";
import { parsePatch } from "./diff";
import type { DiffLine } from "./types";

/**
 * Highlights a patch the way GitHub does: the old and new sides are each
 * tokenized as one piece of code, so strings and comments that span lines
 * keep their colours.
 */
export async function renderDiff(patch: string, lang: string): Promise<DiffLine[]> {
  const rows = parsePatch(patch);
  const oldSide: string[] = [];
  const newSide: string[] = [];
  for (const r of rows) {
    if (r.kind === "ctx" || r.kind === "del") oldSide.push(r.text);
    if (r.kind === "ctx" || r.kind === "add") newSide.push(r.text);
  }
  const [oldHtml, newHtml] = await Promise.all([highlightLines(oldSide.join("\n"), lang), highlightLines(newSide.join("\n"), lang)]);
  let o = 0;
  let n = 0;
  return rows.map((r): DiffLine => {
    if (r.kind === "hunk") return r;
    if (r.kind === "del") return { kind: "del", old: r.old, html: oldHtml[o++] ?? "" };
    if (r.kind === "add") return { kind: "add", new: r.new, html: newHtml[n++] ?? "" };
    o++;
    return { kind: "ctx", old: r.old, new: r.new, html: newHtml[n++] ?? "" };
  });
}
