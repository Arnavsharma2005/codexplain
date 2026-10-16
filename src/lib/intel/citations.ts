export type Citation = { path: string; startLine: number; endLine: number };

// [src/lib/auth.ts:L12-L30], [src/lib/auth.ts:L12] or [src/lib/auth.ts]
const CITE = /\[([A-Za-z0-9_.\-/@+ ]+?\.[A-Za-z0-9]+|[A-Za-z0-9_.\-/@+]+\/[A-Za-z0-9_.\-@+]+)(?::L(\d{1,6})(?:-L?(\d{1,6}))?)?\](?!\()/g;

/** Finds citation markers in an answer. Validation against the index happens separately. */
export function extractCitations(text: string): (Citation & { raw: string })[] {
  const out: (Citation & { raw: string })[] = [];
  for (const m of text.matchAll(CITE)) {
    const a = m[2] ? Number(m[2]) : 1;
    const b = m[3] ? Number(m[3]) : m[2] ? a : 1;
    out.push({ raw: m[0], path: m[1], startLine: Math.min(a, b), endLine: Math.max(a, b) });
  }
  return out;
}

/**
 * Rewrites citation markers into Markdown links to the workspace, keeping
 * only citations of files that exist in the index. Unknown paths are left
 * as plain text so a hallucinated path never becomes a link.
 */
export function linkCitations(text: string, known: (path: string) => boolean, href: (c: Citation) => string): string {
  return text.replace(CITE, (raw, path: string, a?: string, b?: string) => {
    if (!known(path)) return raw;
    const start = a ? Number(a) : 1;
    const end = b ? Number(b) : start;
    const c = { path, startLine: Math.min(start, end), endLine: Math.max(start, end) };
    const label = a ? `${path}:L${c.startLine}${c.endLine !== c.startLine ? `-L${c.endLine}` : ""}` : path;
    return `[${label}](${href(c)})`;
  });
}
