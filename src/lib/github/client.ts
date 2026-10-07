import "server-only";
import { env } from "@/lib/env";
import type { RepoFile, RepoInfo, RepoRefs, RepoTree, TreeEntry } from "./types";
import { isProbablyBinary } from "./binary";

export type GitHubErrorCode = "NOT_FOUND" | "RATE_LIMITED" | "FORBIDDEN" | "UPSTREAM" | "UNAVAILABLE";

export class GitHubError extends Error {
  constructor(
    public code: GitHubErrorCode,
    message: string,
    public resetAt?: Date,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

/** Max file size we will fetch and display (GitHub's contents API limit is 1 MB for inline content). */
export const MAX_DISPLAY_BYTES = 1_000_000;

type Opts = { token?: string | null; revalidate?: number };

function enc(...segments: string[]) {
  return segments.map(encodeURIComponent).join("/");
}

function encPath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function gh<T>(endpoint: string, { token, revalidate = 60 }: Opts = {}): Promise<T> {
  const base = env().GITHUB_API_URL.replace(/\/$/, "");
  const authToken = token ?? env().GITHUB_SERVER_TOKEN;
  let res: Response;
  try {
    res = await fetch(`${base}${endpoint}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "codexplain",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      next: { revalidate },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new GitHubError("UNAVAILABLE", "GitHub could not be reached. Please try again.");
  }

  if (res.ok) return (await res.json()) as T;

  const remaining = res.headers.get("x-ratelimit-remaining");
  const reset = res.headers.get("x-ratelimit-reset");
  if (res.status === 429 || (res.status === 403 && remaining === "0")) {
    const resetAt = reset ? new Date(Number(reset) * 1000) : undefined;
    throw new GitHubError(
      "RATE_LIMITED",
      authToken
        ? "GitHub's rate limit was reached. Please try again shortly."
        : "GitHub's rate limit for anonymous visitors was reached. Sign in with GitHub to keep browsing.",
      resetAt,
    );
  }
  if (res.status === 404) throw new GitHubError("NOT_FOUND", "Not found. The repository may be private, renamed or deleted.");
  if (res.status === 401 || res.status === 403)
    throw new GitHubError("FORBIDDEN", "GitHub denied access to this resource.");
  if (res.status === 409) throw new GitHubError("NOT_FOUND", "This repository is empty.");
  throw new GitHubError("UPSTREAM", `GitHub returned an unexpected error (${res.status}).`);
}

type RawRepo = {
  name: string;
  full_name: string;
  owner: { login: string; avatar_url: string };
  private: boolean;
  description: string | null;
  default_branch: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  topics?: string[];
  license: { spdx_id: string | null; name: string } | null;
  html_url: string;
  pushed_at: string | null;
};

export async function getRepo(owner: string, repo: string, opts?: Opts): Promise<RepoInfo> {
  const r = await gh<RawRepo>(`/repos/${enc(owner, repo)}`, { revalidate: 300, ...opts });
  // Defence in depth: we only request public scopes, but never surface private code.
  if (r.private) throw new GitHubError("NOT_FOUND", "Private repositories are not supported yet.");
  return {
    owner: r.owner.login,
    name: r.name,
    fullName: r.full_name,
    description: r.description,
    defaultBranch: r.default_branch,
    stars: r.stargazers_count,
    forks: r.forks_count,
    language: r.language,
    topics: r.topics ?? [],
    license: r.license?.spdx_id && r.license.spdx_id !== "NOASSERTION" ? r.license.spdx_id : (r.license?.name ?? null),
    htmlUrl: r.html_url,
    ownerAvatarUrl: r.owner.avatar_url,
    pushedAt: r.pushed_at,
  };
}

export async function getRefs(owner: string, repo: string, opts?: Opts): Promise<RepoRefs> {
  const [branches, tags] = await Promise.all([
    gh<{ name: string }[]>(`/repos/${enc(owner, repo)}/branches?per_page=100`, { revalidate: 300, ...opts }),
    gh<{ name: string }[]>(`/repos/${enc(owner, repo)}/tags?per_page=100`, { revalidate: 300, ...opts }).catch(
      () => [],
    ),
  ]);
  return { branches: branches.map((b) => b.name), tags: tags.map((t) => t.name) };
}

type RawTree = {
  sha: string;
  truncated: boolean;
  tree: { path: string; type: "blob" | "tree" | "commit"; size?: number }[];
};

export async function getTree(owner: string, repo: string, ref: string, opts?: Opts): Promise<RepoTree> {
  const raw = await gh<RawTree>(`/repos/${enc(owner, repo)}/git/trees/${encodeURIComponent(ref)}?recursive=1`, {
    revalidate: 120,
    ...opts,
  });
  const entries: TreeEntry[] = raw.tree
    // Submodules ("commit") point at other repositories; skip them.
    .filter((e) => e.type === "blob" || e.type === "tree")
    .map((e) => ({ path: e.path, type: e.type as "blob" | "tree", ...(e.size != null ? { size: e.size } : {}) }));
  return { ref, sha: raw.sha, truncated: raw.truncated, entries };
}

type RawContent = {
  type: "file" | "dir" | "symlink" | "submodule";
  path: string;
  sha: string;
  size: number;
  encoding?: "base64" | "none";
  content?: string;
  html_url: string;
};

export async function getFile(owner: string, repo: string, ref: string, path: string, opts?: Opts): Promise<RepoFile> {
  const raw = await gh<RawContent | RawContent[]>(
    `/repos/${enc(owner, repo)}/contents/${encPath(path)}?ref=${encodeURIComponent(ref)}`,
    { revalidate: 120, ...opts },
  );
  if (Array.isArray(raw) || raw.type !== "file") {
    throw new GitHubError("NOT_FOUND", "That path is not a file.");
  }

  const base = { path: raw.path, sha: raw.sha, size: raw.size, htmlUrl: raw.html_url };
  if (raw.size > MAX_DISPLAY_BYTES || raw.encoding !== "base64" || raw.content == null) {
    return { ...base, content: null, reason: "too_large" };
  }

  const bytes = Buffer.from(raw.content, "base64");
  if (isProbablyBinary(path, bytes)) return { ...base, content: null, reason: "binary" };

  return { ...base, content: new TextDecoder("utf-8", { fatal: false }).decode(bytes) };
}
