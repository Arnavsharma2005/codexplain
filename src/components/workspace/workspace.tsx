"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { Code2, ExternalLink, FileText, FolderTree, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
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

const PANELS = [
  ["files", "Files", FolderTree],
  ["code", "Code", Code2],
  ["analysis", "Analysis", FileText],
] as const;

function errorMessage(err: unknown) {
  return err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.";
}

const isDesktop = () => window.matchMedia("(min-width: 1024px)").matches;
const isWide = () => window.matchMedia("(min-width: 1280px)").matches;

function readFolded(): boolean {
  try {
    return localStorage.getItem("cx-tree") === "folded";
  } catch {
    return false;
  }
}

export function Workspace({ repo, refs, initialRef, initialPath, initialDir, signedIn, initialStarred }: Props) {
  const router = useRouter();
  const gitRef = initialRef;
  const [path, setPath] = useState<string | null>(initialPath);
  const [revealDir, setRevealDir] = useState<string | null>(initialDir);
  const [treeResult, setTreeResult] = useState<Result<RepoTree> | null>(null);
  const [fileResult, setFileResult] = useState<Result<FileResponse> | null>(null);
  const [highlight, setHighlight] = useState<LineRange | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>(initialPath ? "code" : "files");
  const [folded, setFolded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fromAnalysis, setFromAnalysis] = useState(false);
  const [treeAttempt, setTreeAttempt] = useState(0);
  const [fileAttempt, setFileAttempt] = useState(0);
  const pendingHash = useRef<LineRange | null>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const treePanelRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const panelTabRefs = useRef<Partial<Record<MobileTab, HTMLButtonElement | null>>>({});

  const repoQs = useMemo(() => new URLSearchParams({ owner: repo.owner, repo: repo.name, ref: gitRef }), [repo, gitRef]);

  // Line anchor from the URL (e.g. shared links ending in #L42-L50), and the remembered tree fold.
  useEffect(() => {
    pendingHash.current = parseLineHash(window.location.hash);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a browser-only preference, read once after hydration
    setFolded(readFolded());
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
      setDrawerOpen(false);
      setFromAnalysis(false);
      if (p === path) return;
      setPath(p);
      setHighlight(null);
      window.history.pushState(null, "", urlFor(p));
    },
    [path, urlFor],
  );

  const goToRoot = useCallback(() => {
    setPath(null);
    setHighlight(null);
    setMobileTab("files");
    window.history.pushState(null, "", urlFor(null));
  }, [urlFor]);

  const selectLines = useCallback(
    (range: LineRange) => {
      setHighlight(range);
      setMobileTab("code");
      window.history.replaceState(null, "", urlFor(path, formatLineHash(range)));
    },
    [path, urlFor],
  );

  const selectLinesFromAnalysis = useCallback(
    (range: LineRange) => {
      selectLines(range);
      setFromAnalysis(true);
    },
    [selectLines],
  );

  const switchRef = useCallback(
    (ref: string) => {
      const qs = new URLSearchParams({ ref });
      if (path) qs.set("path", path);
      router.push(`/r/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}?${qs}`);
    },
    [path, repo, router],
  );

  /** With a file open, the tree is a drawer at 1024-1279px, or at 1280+ when folded. */
  const treeIsDrawer = useCallback(() => !!path && isDesktop() && (folded || !isWide()), [path, folded]);

  /** Makes the tree visible: the drawer on desktop, the Files tab on mobile. */
  const revealTree = useCallback(() => {
    if (!isDesktop()) setMobileTab("files");
    else if (treeIsDrawer()) setDrawerOpen(true);
  }, [treeIsDrawer]);

  const revealInTree = useCallback(
    (dir: string) => {
      setRevealDir(dir);
      revealTree();
    },
    [revealTree],
  );

  const focusFilter = useCallback(() => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Commit the reveal synchronously so the filter is focusable before the next keystroke arrives.
    flushSync(revealTree);
    filterRef.current?.focus();
  }, [revealTree]);

  // "/" opens "Go to file" from anywhere in the workspace.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        focusFilter();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusFilter]);

  // The drawer closes on Escape (focus returns to its opener) and on a click outside it.
  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setDrawerOpen(false);
      (returnFocus.current ?? railRef.current?.querySelector<HTMLElement>("button"))?.focus();
    }
    function onDown(e: PointerEvent) {
      const t = e.target as Node;
      if (treePanelRef.current?.contains(t) || railRef.current?.contains(t)) return;
      setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [drawerOpen]);

  function toggleFold() {
    setFolded((f) => {
      try {
        localStorage.setItem("cx-tree", f ? "open" : "folded");
      } catch {
        /* storage unavailable */
      }
      return !f;
    });
    setDrawerOpen(false);
  }

  function onFilterEscape() {
    const back = returnFocus.current;
    returnFocus.current = null;
    if (drawerOpen) setDrawerOpen(false);
    if (back && back !== filterRef.current) back.focus();
    else filterRef.current?.blur();
  }

  function onPanelTabKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const i = PANELS.findIndex(([k]) => k === mobileTab);
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % PANELS.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + PANELS.length) % PANELS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = PANELS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const key = PANELS[next][0];
    setMobileTab(key);
    panelTabRefs.current[key]?.focus();
  }

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

  const facts = [`${formatNumber(repo.stars)} stars`, `${formatNumber(repo.forks)} forks`, repo.language].filter(Boolean).join(" · ");

  return (
    <div className="workspace-root flex h-dvh flex-col overflow-hidden">
      <SiteHeader />

      {/* Running head */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-hairline bg-paper px-3 sm:gap-3 sm:px-4">
        {path ? (
          <Tooltip content={folded ? "Show files" : "Hide files"}>
            <Button
              variant="ghost"
              size="icon-sm"
              className="hidden xl:inline-flex"
              aria-label={folded ? "Show file tree" : "Hide file tree"}
              aria-expanded={!folded}
              aria-controls="file-tree-panel"
              onClick={toggleFold}
            >
              {folded ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
          </Tooltip>
        ) : null}
        <a
          href={urlFor(null)}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
            e.preventDefault();
            goToRoot();
          }}
          className="min-w-0 truncate font-mono text-[15px] leading-5 hover:underline hover:decoration-orange hover:decoration-2 hover:underline-offset-4"
        >
          <span className="text-ink-muted">{repo.owner}/</span>
          <span className="text-ink">{repo.name}</span>
        </a>
        <RefSwitcher refs={refs} current={gitRef} defaultBranch={repo.defaultBranch} onSelect={switchRef} />
        <p className="caption hidden truncate md:block">{facts}</p>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <StarButton owner={repo.owner} repo={repo.name} initial={initialStarred} signedIn={signedIn} />
          <Button variant="secondary" size="sm" asChild className="px-2 sm:px-3">
            <a href={repo.htmlUrl} target="_blank" rel="noopener noreferrer">
              GitHub <ExternalLink className="hidden sm:block" aria-hidden />
            </a>
          </Button>
        </div>
      </div>

      {/* Mobile panel switcher */}
      <div className="tab-strip shrink-0 lg:hidden" role="tablist" aria-label="Workspace panels" onKeyDown={onPanelTabKey}>
        {PANELS.map(([key, label, Icon]) => (
          <button
            key={key}
            ref={(el) => {
              panelTabRefs.current[key] = el;
            }}
            id={`panel-tab-${key}`}
            role="tab"
            aria-selected={mobileTab === key}
            aria-controls={`panel-${key}`}
            tabIndex={mobileTab === key ? 0 : -1}
            onClick={() => setMobileTab(key)}
            className="tab-btn flex-1 justify-center"
          >
            <Icon className="size-4" aria-hidden /> {label}
          </button>
        ))}
      </div>

      <div className="ws-grid" data-layout={path ? "file" : "root"} data-folded={folded} data-drawer={drawerOpen}>
        <div ref={railRef} className="ws-rail flex-col items-center gap-2 border-r border-hairline bg-paper-sunk py-2">
          <Tooltip content="Files  /">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Show file tree"
              aria-expanded={drawerOpen}
              aria-controls="file-tree-panel"
              onClick={(e) => {
                returnFocus.current = e.currentTarget;
                setDrawerOpen((o) => !o);
              }}
              data-tip-start=""
            >
              <PanelLeftOpen />
            </Button>
          </Tooltip>
          <Tooltip content="Go to file">
            <Button
              data-tip-start=""
              variant="ghost"
              size="icon"
              aria-label="Go to file"
              onClick={(e) => {
                returnFocus.current = e.currentTarget;
                flushSync(() => setDrawerOpen(true));
                filterRef.current?.focus();
              }}
            >
              <Search />
            </Button>
          </Tooltip>
        </div>

        <aside
          ref={treePanelRef}
          id="file-tree-panel"
          className="ws-tree flex flex-col border-hairline lg:border-r"
          data-active={mobileTab === "files"}
          >
          <div id="panel-files" role="tabpanel" aria-labelledby="panel-tab-files" className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-hairline p-3 md:hidden">
              <RepoSearch size="sm" />
            </div>
            <div className="min-h-0 flex-1">
              <FileTree
                entries={tree.data?.entries ?? null}
                loading={tree.status === "loading"}
                error={tree.error}
                truncated={tree.data?.truncated ?? false}
                activePath={path}
                revealDir={revealDir}
                onSelect={selectFile}
                onRetry={() => setTreeAttempt((n) => n + 1)}
                inputRef={filterRef}
                onEscape={onFilterEscape}
              />
            </div>
          </div>
        </aside>

        <section
          id="panel-analysis"
          role="tabpanel"
          aria-labelledby="panel-tab-analysis"
          className="ws-doc"
          data-active={mobileTab === "analysis"}
        >
          {path ? (
            <AnalysisPanel
              key={file.data ? `${file.data.path}@${file.data.sha}` : "none"}
              owner={repo.owner}
              repo={repo.name}
              gitRef={gitRef}
              path={path}
              file={file.data}
              fileLoading={file.status === "loading"}
              signedIn={signedIn}
              onLineClick={selectLinesFromAnalysis}
              onRevealDir={revealInTree}
            />
          ) : (
            <RepoOverview repo={repo} suggested={suggested} onOpen={selectFile} />
          )}
        </section>

        <section id="panel-code" role="tabpanel" aria-labelledby="panel-tab-code" className="ws-code" data-active={mobileTab === "code"}>
          {path ? (
            <CodeViewer
              path={path}
              file={file.data}
              loading={file.status === "loading"}
              error={file.error}
              highlight={highlight}
              onLineSelect={selectLines}
              onRetry={() => setFileAttempt((n) => n + 1)}
              onBackToAnalysis={
                fromAnalysis
                  ? () => {
                      setFromAnalysis(false);
                      setMobileTab("analysis");
                    }
                  : undefined
              }
            />
          ) : (
            <div className="px-4 py-6">
              <p>No file open. Choose one in Files.</p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={() => setMobileTab("files")}>
                Open the file list
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function RepoOverview({ repo, suggested, onOpen }: { repo: RepoInfo; suggested: string[]; onOpen: (p: string) => void }) {
  return (
    <div className="h-full overflow-auto">
      <article className="max-w-[calc(68ch+80px)] px-4 pt-5 pb-12 lg:px-10 lg:pt-8">
        <h1 className="doc-title font-mono font-normal">{repo.fullName}</h1>
        {repo.description ? <p className="mt-3 text-ink-muted">{repo.description}</p> : null}
        <p className="caption mt-3">
          {[`${formatNumber(repo.stars)} stars`, `${formatNumber(repo.forks)} forks`, repo.license].filter(Boolean).join(" · ")}
        </p>
        <hr className="accent-rule" />
        {repo.topics.length ? (
          <p className="caption">
            <span className="mr-3">Topics</span>
            <span className="font-mono font-normal normal-case tracking-normal text-ink-muted">{repo.topics.slice(0, 10).join(" · ")}</span>
          </p>
        ) : null}

        <section className="section-ruled mt-8">
          <h2 className="section-label">Where to start</h2>
          {suggested.length ? (
            <ol className="ruled-list">
              {suggested.map((p, i) => (
                <li key={p}>
                  <button
                    onClick={() => onOpen(p)}
                    className="row-hover grid w-full cursor-pointer grid-cols-[40px_20px_minmax(0,1fr)] items-center gap-x-2 py-3 text-left"
                  >
                    <span aria-hidden className="font-mono text-[13px] text-label tabular">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <FileIcon path={p} />
                    <span className="row-name truncate font-mono text-[15px]">{p}</span>
                  </button>
                </li>
              ))}
            </ol>
          ) : null}
          <p className={cn("text-ink-muted", suggested.length ? "mt-4" : "")}>
            Pick any file in the tree. The analysis opens here, the code on the right.
          </p>
        </section>
      </article>
    </div>
  );
}
