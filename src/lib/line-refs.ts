export type LineRange = { start: number; end: number };

const LINE_REF = /(?<![\w#[/])L(\d{1,6})(?:\s*(?:-|–|to)\s*L?(\d{1,6}))?(?![\w\]])/g;
// Fenced code blocks and inline code spans are left untouched.
const CODE_SEGMENTS = /(```[\s\S]*?(?:```|$)|`[^`\n]*`)/g;

/** Turns "L12" / "L12-L30" mentions into markdown links "#L12-L30", skipping code. */
export function linkifyLineRefs(markdown: string): string {
  return markdown
    .split(CODE_SEGMENTS)
    .map((segment, i) => {
      if (i % 2 === 1) return segment; // captured code segment
      return segment.replace(LINE_REF, (_m, a: string, b?: string) => {
        const start = Number(a);
        const end = b ? Number(b) : start;
        const [lo, hi] = start <= end ? [start, end] : [end, start];
        const label = lo === hi ? `L${lo}` : `L${lo}-L${hi}`;
        return `[${label}](#${label})`;
      });
    })
    .join("");
}

/** Parses "#L12" or "#L12-L30" (also without the leading '#'). */
export function parseLineHash(hash: string): LineRange | null {
  const m = hash.replace(/^#/, "").match(/^L(\d+)(?:-L?(\d+))?$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  if (a < 1 || b < 1) return null;
  return { start: Math.min(a, b), end: Math.max(a, b) };
}

export function formatLineHash(range: LineRange): string {
  return range.start === range.end ? `#L${range.start}` : `#L${range.start}-L${range.end}`;
}
