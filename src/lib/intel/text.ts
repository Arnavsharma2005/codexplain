/** Splits identifiers into words: "getGitHubToken" → get git hub token, "MAX_FILE" → max file. */
export function splitIdentifiers(text: string): string[] {
  const words: string[] = [];
  for (const token of text.match(/[A-Za-z][A-Za-z0-9]*/g) ?? []) {
    const parts = token.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2").split(" ");
    if (parts.length > 1) for (const p of parts) if (p.length > 1) words.push(p.toLowerCase());
  }
  return words;
}

/** Extra words added to a chunk's search document so natural-language queries match code. */
export function searchDocument(path: string, symbols: string[], text: string): string {
  const pathWords = path.split(/[/._-]+/).filter(Boolean).join(" ");
  const extra = splitIdentifiers(`${symbols.join(" ")} ${text}`);
  // Cap the document so to_tsvector stays well under Postgres' 1 MB tsvector limit.
  return `${path} ${pathWords} ${symbols.join(" ")} ${[...new Set(extra)].join(" ")} ${text}`.slice(0, 60_000);
}

const STOP = new Set(
  "a an and are as at be but by can do does for from how i if in into is it its me my of on or our so that the their them then there these this to us was we what when where which who why will with you your use used using code file files function functions repo repository work works".split(
    " ",
  ),
);

/** Query words for an OR-style tsquery: stop words dropped, identifiers split, at most 16 terms. */
export function queryTerms(query: string): string[] {
  const raw = (query.match(/[A-Za-z0-9_]+/g) ?? []).map((t) => t.toLowerCase());
  const terms = new Set<string>();
  for (const t of raw) if (t.length > 1 && !STOP.has(t)) terms.add(t);
  for (const t of splitIdentifiers(query)) if (!STOP.has(t)) terms.add(t);
  return [...terms].slice(0, 16);
}

/** Builds a safe to_tsquery() string: only [a-z0-9_] terms, OR-ed, with prefix matching. */
export function toTsQuery(query: string): string | null {
  const terms = queryTerms(query).map((t) => t.replace(/[^a-z0-9_]/g, "")).filter(Boolean);
  return terms.length ? terms.map((t) => `${t}:*`).join(" | ") : null;
}

/** Reciprocal rank fusion: merges ranked lists without needing comparable scores. */
export function fuseRankings<T extends string>(lists: T[][], k = 60): Map<T, number> {
  const scores = new Map<T, number>();
  for (const list of lists) list.forEach((id, rank) => scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank + 1)));
  return scores;
}
