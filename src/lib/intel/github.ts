import "server-only";
import { createGunzip } from "node:zlib";
import { env } from "@/lib/env";
import { GitHubError } from "@/lib/github/client";
import { TarReader, stripRoot, type TarEntry } from "./tar";

function headers(token: string | null | undefined, accept: string) {
  const auth = token ?? env().GITHUB_SERVER_TOKEN;
  return {
    Accept: accept,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "codexplain",
    ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
  };
}

const base = () => env().GITHUB_API_URL.replace(/\/$/, "");
const enc = (owner: string, repo: string) => `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

function fail(status: number): never {
  if (status === 404 || status === 422) throw new GitHubError("NOT_FOUND", "That branch, tag or commit was not found.");
  if (status === 403 || status === 429) throw new GitHubError("RATE_LIMITED", "GitHub's rate limit was reached. Please try again shortly.");
  throw new GitHubError("UPSTREAM", `GitHub returned an unexpected error (${status}).`);
}

/** Resolves a branch, tag or SHA to the full commit SHA (one cheap API call). */
export async function resolveCommit(owner: string, repo: string, ref: string, token?: string | null): Promise<string> {
  const url = `${base()}/repos/${enc(owner, repo)}/commits/${encodeURIComponent(ref)}`;
  let res = await fetch(url, { headers: headers(token, "application/vnd.github.sha"), cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (res.status === 401 && token) res = await fetch(url, { headers: headers(null, "application/vnd.github.sha"), cache: "no-store" });
  if (!res.ok) fail(res.status);
  const sha = (await res.text()).trim();
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new GitHubError("UPSTREAM", "GitHub returned an unexpected commit id.");
  return sha;
}

/** Hard limit on the compressed download, so a giant monorepo fails fast instead of timing out. */
export const MAX_TARBALL_BYTES = 120_000_000;

/**
 * Streams the repository tarball at `sha` through gunzip and the tar reader.
 * One request replaces hundreds of contents-API calls and doesn't touch the
 * per-file rate limit.
 */
export async function readTarball(
  owner: string,
  repo: string,
  sha: string,
  token: string | null | undefined,
  want: (path: string, size: number) => boolean,
  onEntry: (entry: TarEntry) => void,
  signal?: AbortSignal,
): Promise<void> {
  const url = `${base()}/repos/${enc(owner, repo)}/tarball/${sha}`;
  let res = await fetch(url, { headers: headers(token, "application/vnd.github+json"), redirect: "follow", cache: "no-store", signal });
  if (res.status === 401 && token) res = await fetch(url, { headers: headers(null, "application/vnd.github+json"), cache: "no-store", signal });
  if (!res.ok || !res.body) fail(res.status);
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_TARBALL_BYTES) throw new GitHubError("UPSTREAM", "This repository is too large to index.");

  const reader = new TarReader({ want: (p, size) => want(stripRoot(p), size), onEntry: (e) => onEntry({ ...e, path: stripRoot(e.path) }) });
  const gunzip = createGunzip();
  const done = new Promise<void>((resolve, reject) => {
    gunzip.on("data", (chunk: Buffer) => reader.write(chunk));
    gunzip.on("end", resolve);
    gunzip.on("error", reject);
  });

  let received = 0;
  const body = res.body.getReader();
  try {
    for (;;) {
      const { value, done: finished } = await body.read();
      if (finished) break;
      received += value.length;
      if (received > MAX_TARBALL_BYTES) throw new GitHubError("UPSTREAM", "This repository is too large to index.");
      if (!gunzip.write(value)) await new Promise((r) => gunzip.once("drain", r));
    }
    gunzip.end();
    await done;
  } catch (err) {
    gunzip.destroy();
    await body.cancel().catch(() => undefined);
    throw err;
  }
}

export type PullInfo = {
  number: number;
  title: string;
  body: string;
  author: string;
  state: "open" | "closed" | "merged";
  draft: boolean;
  htmlUrl: string;
  headSha: string;
  baseSha: string;
  baseRef: string;
  isPrivate: boolean;
  additions: number;
  deletions: number;
  changedFiles: number;
  commits: number;
};

export type PullFile = {
  path: string;
  previousPath?: string;
  status: "added" | "removed" | "modified" | "renamed" | "copied" | "changed" | "unchanged";
  additions: number;
  deletions: number;
  /** GitHub leaves this out for binary files and very large diffs. */
  patch: string | null;
};

type RawPull = {
  number: number;
  title: string;
  body: string | null;
  user: { login: string } | null;
  state: "open" | "closed";
  merged?: boolean;
  merged_at?: string | null;
  draft?: boolean;
  html_url: string;
  head: { sha: string };
  base: { sha: string; ref: string; repo: { private: boolean } };
  additions?: number;
  deletions?: number;
  changed_files?: number;
  commits?: number;
};

async function getJson<T>(path: string, token: string | null | undefined, cacheSeconds: number): Promise<T> {
  const url = `${base()}${path}`;
  const init = (t: string | null | undefined): RequestInit => ({
    headers: headers(t, "application/vnd.github+json"),
    signal: AbortSignal.timeout(15_000),
    ...(cacheSeconds ? { next: { revalidate: cacheSeconds } } : { cache: "no-store" as const }),
  });
  let res: Response;
  try {
    res = await fetch(url, init(token));
    if (res.status === 401 && token) res = await fetch(url, init(null));
  } catch {
    throw new GitHubError("UNAVAILABLE", "GitHub could not be reached. Please try again.");
  }
  if (res.status === 404) throw new GitHubError("NOT_FOUND", "That pull request was not found. It may be in a private repository.");
  if (!res.ok) fail(res.status);
  return (await res.json()) as T;
}

/** One pull request's metadata. `cacheSeconds` 0 always asks GitHub (used before generating). */
export async function getPull(owner: string, repo: string, number: number, token: string | null | undefined, cacheSeconds = 60): Promise<PullInfo> {
  const p = await getJson<RawPull>(`/repos/${enc(owner, repo)}/pulls/${number}`, token, cacheSeconds);
  return {
    number: p.number,
    title: p.title,
    body: p.body ?? "",
    author: p.user?.login ?? "ghost",
    state: p.merged || p.merged_at ? "merged" : p.state,
    draft: !!p.draft,
    htmlUrl: p.html_url,
    headSha: p.head.sha,
    baseSha: p.base.sha,
    baseRef: p.base.ref,
    isPrivate: p.base.repo.private,
    additions: p.additions ?? 0,
    deletions: p.deletions ?? 0,
    changedFiles: p.changed_files ?? 0,
    commits: p.commits ?? 0,
  };
}

type RawPullFile = { filename: string; previous_filename?: string; status: PullFile["status"]; additions: number; deletions: number; patch?: string };

/** The changed files with their unified-diff patches, 100 per page, up to `max`. */
export async function listPullFiles(owner: string, repo: string, number: number, token: string | null | undefined, max: number): Promise<PullFile[]> {
  const out: PullFile[] = [];
  for (let page = 1; out.length < max; page++) {
    const batch = await getJson<RawPullFile[]>(`/repos/${enc(owner, repo)}/pulls/${number}/files?per_page=100&page=${page}`, token, 0);
    for (const f of batch) {
      out.push({
        path: f.filename,
        ...(f.previous_filename && f.previous_filename !== f.filename ? { previousPath: f.previous_filename } : {}),
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch ?? null,
      });
    }
    if (batch.length < 100) break;
  }
  return out.slice(0, max);
}
