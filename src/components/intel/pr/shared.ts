/** Small helpers shared by the walkthrough's server and client components. */

/** Six layer colours (--layer-1..6 in globals.css), repeated for longer walkthroughs. */
export const layerColor = (k: number) => `var(--layer-${(k % 6) + 1})`;

export const two = (n: number) => String(n).padStart(2, "0");

export const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

/** The file and its folder ("login/page.tsx"), enough to tell same-named files apart. */
export const shortPath = (path: string) => path.split("/").slice(-2).join("/");

/** Id of a file's header, or of one of its new-file lines, in the diff. */
export const rowId = (file: number, line?: number) => (line ? `f${file}L${line}` : `f${file}`);

/** Link to a file (and lines) in the layer that holds it; `layer` is 0-based. */
export function refHref(layer: number, file: number, start?: number, end?: number) {
  const lines = start ? `L${start}${end && end !== start ? `-L${end}` : ""}` : "";
  return `?layer=${layer + 1}#f${file}${lines}`;
}

export type RefTarget = { file: number; start: number; end: number };

/** Parses "#f3", "#f3L12" or "#f3L12-L20". */
export function parseRefHash(hash: string): RefTarget | null {
  const m = /^#?f(\d{1,4})(?:L(\d{1,6})(?:-L(\d{1,6}))?)?$/.exec(hash);
  if (!m) return null;
  const start = m[2] ? Number(m[2]) : 0;
  const end = m[3] ? Number(m[3]) : start;
  return { file: Number(m[1]), start: Math.min(start, end), end: Math.max(start, end) };
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
