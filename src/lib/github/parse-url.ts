import { ownerSchema, repoNameSchema } from "./validation";

export type ParsedGitHubUrl = {
  owner: string;
  repo: string;
  /** "tree" or "blob" when the URL pointed inside the repo. */
  kind?: "tree" | "blob";
  /**
   * Everything after /tree/ or /blob/. Branch names may contain slashes, so
   * the split between ref and path is resolved later against the repo's refs.
   */
  refAndPath?: string[];
  /** First line from a #L42 or #L42-L50 anchor. */
  line?: number;
  /** Last line when the anchor was a range (#L42-L50). */
  lineEnd?: number;
};

const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);

/**
 * Parses anything a user is likely to paste: `owner/repo`, `github.com/owner/repo`,
 * full https URLs, `.git` clone URLs, and tree/blob URLs with line anchors.
 * Returns null when the input is not a GitHub repository reference.
 */
export function parseGitHubUrl(input: string): ParsedGitHubUrl | null {
  let raw = input.trim();
  if (!raw) return null;

  // git@github.com:owner/repo.git
  const ssh = raw.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  if (ssh) return validate({ owner: ssh[1], repo: ssh[2] });

  // Bare "owner/repo" shorthand.
  if (/^[^/\s:]+\/[^/\s:]+$/.test(raw) && !raw.includes(".com")) {
    const [owner, repo] = raw.split("/");
    return validate({ owner, repo: repo.replace(/\.git$/i, "") });
  }

  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!GITHUB_HOSTS.has(url.hostname.toLowerCase())) return null;

  const segments = url.pathname
    .split("/")
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
  if (segments.length < 2) return null;

  const [owner, repoRaw, kind, ...rest] = segments;
  const result: ParsedGitHubUrl = { owner, repo: repoRaw.replace(/\.git$/i, "") };

  if ((kind === "tree" || kind === "blob") && rest.length > 0) {
    result.kind = kind;
    result.refAndPath = rest;
  }

  const lineMatch = url.hash.match(/^#L(\d+)(?:-L?(\d+))?/);
  if (lineMatch) {
    result.line = Number(lineMatch[1]);
    const end = lineMatch[2] ? Number(lineMatch[2]) : undefined;
    if (end && end > result.line) result.lineEnd = end;
  }

  return validate(result);
}

function validate(p: ParsedGitHubUrl): ParsedGitHubUrl | null {
  if (!ownerSchema.safeParse(p.owner).success) return null;
  if (!repoNameSchema.safeParse(p.repo).success) return null;
  return p;
}

/**
 * Splits `["feature", "login", "src", "app.ts"]` into ref + path using the
 * repository's known branch and tag names, preferring the longest match.
 */
export function splitRefAndPath(
  segments: string[],
  knownRefs: Iterable<string>,
): { ref: string; path: string } | null {
  const refs = new Set(knownRefs);
  for (let i = segments.length; i >= 1; i--) {
    const candidate = segments.slice(0, i).join("/");
    if (refs.has(candidate)) return { ref: candidate, path: segments.slice(i).join("/") };
  }
  // Commit SHAs are valid refs too.
  if (segments[0] && /^[0-9a-f]{7,40}$/i.test(segments[0])) {
    return { ref: segments[0], path: segments.slice(1).join("/") };
  }
  return null;
}
