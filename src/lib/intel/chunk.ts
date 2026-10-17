import type { ParsedSymbol } from "./parse";

export type Chunk = { startLine: number; endLine: number; symbols: string[]; text: string };

const TARGET = 60;
const MAX = 120;
const MIN = 15;

/**
 * Splits a file into search chunks of roughly 60 lines, cutting at definition
 * boundaries where possible so a function usually lands in one chunk whole.
 */
export function chunkFile(source: string, symbols: ParsedSymbol[]): Chunk[] {
  const lines = source.split("\n");
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  const total = lines.length;
  if (!total) return [];

  const starts = [...new Set(symbols.map((s) => s.startLine))].sort((a, b) => a - b);
  const chunks: Chunk[] = [];
  let start = 1;
  while (start <= total) {
    let end = Math.min(total, start + MAX - 1);
    if (end < total) {
      // A definition that starts here and fits whole wins.
      const own = symbols.filter((s) => s.startLine === start && s.endLine - start < MAX).sort((a, b) => b.endLine - a.endLine)[0];
      if (own && own.endLine - start + 1 >= MIN) end = own.endLine;
      else {
        // Otherwise cut just before the last definition start between MIN and MAX lines in.
        const cut = starts.filter((l) => l > start + MIN && l <= start + MAX).filter((l) => l <= start + TARGET + 20).pop();
        end = cut ? cut - 1 : Math.min(total, start + TARGET - 1);
      }
    }
    const names = symbols.filter((s) => s.startLine >= start && s.startLine <= end).map((s) => s.name);
    const text = lines.slice(start - 1, end).join("\n");
    if (text.trim()) chunks.push({ startLine: start, endLine: end, symbols: [...new Set(names)].slice(0, 20), text });
    start = end + 1;
  }
  return chunks;
}
