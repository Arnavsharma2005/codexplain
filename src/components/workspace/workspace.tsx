"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Code2, ExternalLink, FolderTree, GitFork, PanelLeftClose, PanelLeftOpen, Scale, Sparkles, Star } from "lucide-react";
import type { FileResponse } from "@/lib/api-types";
import { ApiClientError, apiGet } from "@/lib/api-client";
import type { RepoInfo, RepoRefs, RepoTree } from "@/lib/github/types";
import { formatLineHash, parseLineHash, type LineRange } from "@/lib/line-refs";
import { SiteHeader } from "@/components/site-header";
import { RepoSearch } from "@/components/repo-search";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn, formatNumber } from "@/lib/utils";
import { AnalysisPanel } from "./analysis-panel";
import { CodeViewer } from "./code-viewer";
import { FileIcon } from "./file-icon";
import { FileTree } from "./file-tree";
import { RefSwitcher } from "./ref-switcher";
import { StarButton } from "./star-button";

type Props = {
  repo: RepoInfo;
  refs: RepoRefs;
  initialRef: string;
  initialPath: string | null;
  initialDir: string | null;
  signedIn: boolean;
  initialStarred: boolean;
};

type Load<T> = { status: "idle" | "loading" | "ready" | "error"; data: T | null; error: string | null };
/** A fetch result tagged with the request it answers, so stale or pending state is derived, not stored. */
type Result<T> = { key: string; data: T | null; error: string | null };

function toLoad<T>(key: string | null, result: Result<T> | null): Load<T> {
  if (!key) return { status: "idle", data: null, error: null };
  if (!result || result.key !== key) return { status: "loading", data: null, error: null };
  return result.error ? { status: "error", data: null, error: result.error } : { status: "ready", data: result.data, error: null };
}

type MobileTab = "files" | "code" | "analysis";

function errorMessage(err: unknown) {
  return err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.";
}

export function Workspace({ repo, refs, initialRef, initialPath, initialDir, signedIn, initialStarred }: Props) {
  const router = useRouter();
  const gitRef = initialRef;
  const [path, setPath] = useState<string | null>(initialPath);
  const [revealDir, setRevealDir] = useState<string | null>(initialDir);
  const [treeResult, setTreeResult] = useState<Result<RepoTree> | null>(null);
  const [fileResult, setFileResult] = useState<Result<FileResponse> | null>(null);
  const [highlight, setHighlight] = useState<LineRange | null>(null);
  const [treeOpen, setTreeOpen] = useState(true);
  const [mobileTab, setMobileTab] = useState<MobileTab>(initialPath ? "code" : "files");
  const [treeAttempt, setTreeAttempt] = useState(0);
  const [fileAttempt, setFileAttempt] = useState(0);
  const pendingHash = useRef<LineRange | null>(null);

  const repoQs = useMemo(() => new URLSearchParams({ owner: repo.owner, repo: repo.name, ref: gitRef }), [repo, gitRef]);

  // Line anchor from the URL (e.g. shared links ending in #L42-L50).
  useEffect(() => {
    pendingHash.current = parseLineHash(window.location.hash);
  }, []);

  // Back/forward navigation between files.
  useEffect(() => {
    function onPop() {
      const sp = new URLSearchParams(window.location.search);
      setPath(sp.get("path"));
      setHighlight(parseLineHash(window.location.hash));
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const treeKey = `${repoQs}#${treeAttempt}`;
  const fileKey = path ? `${path}#${repoQs}#${fileAttempt}` : null;
  const tree = toLoad(treeKey, treeResult);
  const file = toLoad(fileKey, fileResult);

  useEffect(() => {
    const ctrl = new AbortController();
    apiGet<RepoTree>(`/api/github/tree?${repoQs}`, ctrl.signal)
      .then((data) => setTreeResult({ key: treeKey, data, error: null }))
      .catch((err) => {
        if (!ctrl.signal.aborted) setTreeResult({ key: treeKey, data: null, error: errorMessage(err) });
      });
    return () => ctrl.abort();
  }, [repoQs, treeKey]);

  useEffect(() => {
    if (!path || !fileKey) return;
    const ctrl = new AbortController();
    const qs = new URLSearchParams(repoQs);
    qs.set("path", path);
    apiGet<FileResponse>(`/api/github/file?${qs}`, ctrl.signal)
      .then((data) => {
        setFileResult({ key: fileKey, data, error: null });
        if (pendingHash.current) {
          setHighlight(pendingHash.current);
          pendingHash.current = null;
        }
      })
      .catch((err) => {
        if (!ctrl.signal.aborted) setFileResult({ key: fileKey, data: null, error: errorMessage(err) });
      });
    return () => ctrl.abort();
  }, [path, repoQs, fileKey]);

  const urlFor = useCallback(
    (p: string | null, hash = "") => {
      const qs = new URLSearchParams();
      if (gitRef !== repo.defaultBranch) qs.set("ref", gitRef);
      if (p) qs.set("path", p);
      const s = qs.toString();
      return `/r/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}${s ? `?${s}` : ""}${hash}`;
    },
    [gitRef, repo],
  );

  const selectFile = useCallback(
    (p: string) => {
      setMobileTab("code");
      if (p === path) return;
      setPath(p);
      setHighlight(null);
      window.history.pushState(null, "", urlFor(p));
    },
    [path, urlFor],
  );

  const selectLines = useCallback(
    (range: LineRange) => {
      setHighlight(range);
      setMobileTab("code");
      window.history.replaceState(null, "", urlFor(path, formatLineHash(range)));
    },
    [path, urlFor],
  );

  const switchRef = useCallback(
    (ref: string) => {
      const qs = new URLSearchParams({ ref });
      if (path) qs.set("path", path);
      router.push(`/r/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}?${qs}`);
    },
    [path, repo, router],
  );

  const revealInTree = useCallback((dir: string) => {
    setRevealDir(dir);
    setTreeOpen(true);
    setMobileTab("files");
  }, []);

  const suggested = useMemo(() => {
    const files = tree.data?.entries.filter((e) => e.type === "blob").map((e) => e.path) ?? [];
    const wanted = [/^readme(\.\w+)?$/i, /^package\.json$/, /^pyproject\.toml$/, /^go\.mod$/, /^cargo\.toml$/i, /^(src\/)?(index|main|app)\.\w+$/i, /^dockerfile$/i];
    const picks: string[] = [];
    for (const re of wanted) {
      const hit = files.find((f) => re.test(f));
      if (hit && !picks.includes(hit)) picks.push(hit);
    }
    return picks.slice(0, 6);
  }, [tree.data]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <SiteHeader>
        <RepoSearch size="sm" className="hidden max-w-md md:block" />
      </SiteHeader>

      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-3 py-2 sm:px-4">
        <Tooltip content={treeOpen ? "Hide files" : "Show files"}>
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden lg:inline-flex"
            aria-label={treeOpen ? "Hide file tree" : "Show file tree"}
            onClick={() => setTreeOpen((o) => !o)}
          >
            {treeOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
          </Button>
        </Tooltip>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={repo.ownerAvatarUrl} alt="" className="size-6 rounded-md" width={24} height={24} />
        <button onClick={() => { setPath(null); setHighlight(null); window.history.pushState(null, "", urlFor(null)); }} className="min-w-0 truncate text-[15px] hover:underline">
          <span className="text-muted-foreground">{repo.owner}/</span>
          <span className="font-semibold">{repo.name}</span>
        </button>
        <RefSwitcher refs={refs} current={gitRef} defaultBranch={repo.defaultBranch} onSelect={switchRef} />
        <div className="hidden items-center gap-3 text-xs text-muted-foreground md:flex">
          <span className="flex items-center gap-1"><Star className="size-3.5" />{formatNumber(repo.stars)}</span>
          <span className="flex items-center gap-1"><GitFork className="size-3.5" />{formatNumber(repo.forks)}</span>
          {repo.language ? <span>{repo.language}</span> : null}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <StarButton owner={repo.owner} repo={repo.name} initial={initialStarred} signedIn={signedIn} />
          <Button variant="outline" size="sm" asChild>
            <a href={repo.htmlUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink /> <span className="hidden sm:inline">GitHub</span>
            </a>
          </Button>
        </div>
      </div>

      <div className="flex shrink-0 border-b border-border lg:hidden" role="tablist" aria-label="Workspace panels">
        {([
          ["files", "Files", FolderTree],
          ["code", "Code", Code2],
          ["analysis", "Analysis", Sparkles],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            role="tab"
            aria-selected={mobileTab === key}
            onClick={() => setMobileTab(key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-medium",
              mobileTab === key ? "border-b-2 border-primary text-foreground" : "text-muted-foreground",
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            "min-h-0 w-full shrink-0 border-r border-border bg-card/40 lg:w-64 xl:w-72",
            mobileTab === "files" ? "block" : "hidden",
            treeOpen ? "lg:block" : "lg:hidden",
          )}
        >
          <FileTree
            entries={tree.data?.entries ?? null}
            loading={tree.status === "loading"}
            error={tree.error}
            truncated={tree.data?.truncated ?? false}
            activePath={path}
            revealDir={revealDir}
            onSelect={selectFile}
            onRetry={() => setTreeAttempt((n) => n + 1)}
          />
        </aside>

        <section className={cn("min-h-0 min-w-0 flex-1", mobileTab === "code" ? "block" : "hidden", "lg:block")}>
          {path ? (
            <CodeViewer
              path={path}
              file={file.data}
              loading={file.status === "loading"}
              error={file.error}
              highlight={highlight}
              onLineSelect={selectLines}
              onRevealDir={revealInTree}
              onRetry={() => setFileAttempt((n) => n + 1)}
            />
          ) : (
            <RepoOverview repo={repo} suggested={suggested} onOpen={selectFile} />
          )}
        </section>

        <aside
          className={cn(
            "min-h-0 w-full shrink-0 border-l border-border bg-card/40 lg:w-[400px] xl:w-[480px] 2xl:w-[560px]",
            mobileTab === "analysis" ? "block" : "hidden",
            "lg:block",
          )}
        >
          <AnalysisPanel
            key={file.data ? `${file.data.path}@${file.data.sha}` : "none"}
            owner={repo.owner}
            repo={repo.name}
            gitRef={gitRef}
            file={file.data}
            fileLoading={file.status === "loading"}
            signedIn={signedIn}
            onLineClick={selectLines}
          />
        </aside>
      </div>
    </div>
  );
}

function RepoOverview({ repo, suggested, onOpen }: { repo: RepoInfo; suggested: string[]; onOpen: (p: string) => void }) {
  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={repo.ownerAvatarUrl} alt="" className="size-10 rounded-xl" width={40} height={40} />
          <div>
            <h1 className="text-xl font-semibold">{repo.fullName}</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Star className="size-3.5" />{formatNumber(repo.stars)} stars</span>
              <span className="flex items-center gap-1"><GitFork className="size-3.5" />{formatNumber(repo.forks)} forks</span>
              {repo.license ? <span className="flex items-center gap-1"><Scale className="size-3.5" />{repo.license}</span> : null}
            </div>
          </div>
        </div>
        {repo.description ? <p className="mt-5 text-muted-foreground">{repo.description}</p> : null}
        {repo.topics.length ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {repo.topics.slice(0, 10).map((t) => (
              <span key={t} className="rounded-full bg-accent px-2.5 py-0.5 text-xs text-accent-foreground">{t}</span>
            ))}
          </div>
        ) : null}

        <div className="mt-10 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 font-medium">
            <BookOpen className="size-4 text-primary" /> Where to start
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a file from the tree, or open one of these. Then choose an analysis mode on the right.
          </p>
          {suggested.length ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {suggested.map((p) => (
                <button
                  key={p}
                  onClick={() => onOpen(p)}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-left font-mono text-[13px] hover:border-primary/50 hover:bg-muted"
                >
                  <FileIcon path={p} />
                  <span className="truncate">{p}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
