/** Unified-diff helpers for GitHub's per-file `patch` strings. Pure; shared by the server and tests. */

export type DiffRow =
  | { kind: "hunk"; text: string }
  | { kind: "ctx"; text: string; old: number; new: number }
  | { kind: "add"; text: string; new: number }
  | { kind: "del"; text: string; old: number };

const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export function parsePatch(patch: string): DiffRow[] {
  const rows: DiffRow[] = [];
  let oldLine = 0;
  let newLine = 0;
  for (const line of patch.split("\n")) {
    const m = HUNK.exec(line);
    if (m) {
      oldLine = Number(m[1]);
      newLine = Number(m[2]);
      rows.push({ kind: "hunk", text: line });
    } else if (line.startsWith("+")) rows.push({ kind: "add", text: line.slice(1), new: newLine++ });
    else if (line.startsWith("-")) rows.push({ kind: "del", text: line.slice(1), old: oldLine++ });
    else if (line.startsWith(" ") || (line === "" && rows.length)) rows.push({ kind: "ctx", text: line.slice(1), old: oldLine++, new: newLine++ });
    // "\ No newline at end of file" and anything unrecognised is dropped.
  }
  // A trailing empty string from a final newline is not a context line.
  const last = rows.at(-1);
  if (last?.kind === "ctx" && last.text === "" && patch.endsWith("\n")) rows.pop();
  return rows;
}

/** Keeps the first `maxLines` lines of a patch, cut at a line boundary. */
export function trimPatch(patch: string, maxLines: number): { patch: string; truncated: boolean } {
  const lines = patch.split("\n");
  if (lines.length <= maxLines) return { patch, truncated: false };
  return { patch: lines.slice(0, maxLines).join("\n"), truncated: true };
}

/**
 * The patch as the model sees it: new-file line numbers on the left so it can
 * cite them, deleted lines marked with "-" and no number.
 */
export function numberedPatch(patch: string, maxChars: number): string {
  const out: string[] = [];
  let size = 0;
  const rows = parsePatch(patch);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line =
      r.kind === "hunk" ? r.text : r.kind === "add" ? `${r.new} + ${r.text}` : r.kind === "del" ? `   - ${r.text}` : `${r.new}   ${r.text}`;
    if (size + line.length + 1 > maxChars) {
      out.push(`… (${rows.length - i} more diff lines not shown)`);
      break;
    }
    out.push(line);
    size += line.length + 1;
  }
  return out.join("\n");
}

/** The old content of a deleted file, rebuilt from its all-minus patch (for parsing its imports). */
export function removedContent(patch: string): string {
  return parsePatch(patch)
    .filter((r) => r.kind === "del")
    .map((r) => r.text)
    .join("\n");
}

/** The new-file line numbers a patch shows, for checking that a citation points at visible code. */
export function visibleNewLines(patch: string): Set<number> {
  const lines = new Set<number>();
  for (const r of parsePatch(patch)) if (r.kind === "add" || r.kind === "ctx") lines.add(r.new);
  return lines;
}
