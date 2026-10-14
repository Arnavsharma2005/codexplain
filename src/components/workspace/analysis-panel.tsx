"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { AlertTriangle, Check, Copy, Loader2, RotateCcw, Share2, Square } from "lucide-react";
import type { AnalysisModeKey, CachedResponse, FileResponse } from "@/lib/api-types";
import { ApiClientError, apiGet, apiSend, streamNdjson } from "@/lib/api-client";
import type { LineRange } from "@/lib/line-refs";
import { languageLabel } from "@/lib/languages";
import { Markdown } from "@/components/markdown";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { GitHubIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatBytes, plural, timeAgo } from "@/lib/utils";
import { useCopy } from "./use-copy";

const MODES: { key: AnalysisModeKey; label: string; blurb: string }[] = [
  { key: "OVERVIEW", label: "Overview", blurb: "A quick summary of what this file does and how it fits in." },
  { key: "DEEP_DIVE", label: "Deep dive", blurb: "A section-by-section walkthrough of the logic and data flow." },
  { key: "REVIEW", label: "Code review", blurb: "Bugs, security, performance and readability, ranked by severity." },
];

type Done = { status: "done"; content: string; id: string; cached: boolean; createdAt: string; model: string };
type ModeState =
  | { status: "idle" }
  /** `regenerating`: the previous result stays on screen until the first new text arrives. */
  | { status: "streaming"; content: string; regenerating: boolean; prev?: Done }
  | Done
  | { status: "stopped"; content: string }
  /** `content`/`prev`: the previous result stays visible under the notice. */
  | { status: "error"; code: string; message: string; content?: string; prev?: Done };

type Props = {
  owner: string;
  repo: string;
  gitRef: string;
  path: string;
  file: FileResponse | null;
  fileLoading: boolean;
  signedIn: boolean;
  onLineClick: (range: LineRange) => void;
  onRevealDir: (dir: string) => void;
};

const EMPTY: Record<AnalysisModeKey, ModeState> = {
  OVERVIEW: { status: "idle" },
  DEEP_DIVE: { status: "idle" },
  REVIEW: { status: "idle" },
};

function statusText(state: ModeState, label: string) {
  const lower = label.toLowerCase();
  switch (state.status) {
    case "streaming":
      return state.regenerating ? "Regenerating…" : `Generating ${lower}…`;
    case "done":
      return `${label} ready`;
    case "stopped":
      return "Stopped";
    case "error":
      return state.code === "QUOTA_EXCEEDED" ? "Limit reached for today" : "Generation failed";
    default:
      return "";
  }
}

/** The analysis document: file head, mode tabs, the reading itself and its colophon bar. */
export function AnalysisPanel({ owner, repo, gitRef, path, file, fileLoading, signedIn, onLineClick, onRevealDir }: Props) {
  const [mode, setMode] = useState<AnalysisModeKey>("OVERVIEW");
  const [states, setStates] = useState<Record<AnalysisModeKey, ModeState>>(EMPTY);
  const [checkingCache, setCheckingCache] = useState(() => !!file && file.content != null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);
  const controllers = useRef<Partial<Record<AnalysisModeKey, AbortController>>>({});
  const statesRef = useRef(states);
  const tabRefs = useRef<Partial<Record<AnalysisModeKey, HTMLButtonElement | null>>>({});
  const copy = useCopy();

  useEffect(() => {
    statesRef.current = states;
  }, [states]);

  const setModeState = useCallback((m: AnalysisModeKey, s: ModeState) => {
    setStates((prev) => ({ ...prev, [m]: s }));
  }, []);

  // The parent remounts this panel per file version (key), so state starts fresh.
  // Load analyses already generated for this exact file version.
  useEffect(() => {
    if (!file || file.content == null) return;
    const ctrl = new AbortController();
    const qs = new URLSearchParams({ owner, repo, ref: gitRef, path: file.path, sha: file.sha });
    apiGet<CachedResponse>(`/api/analyze/cached?${qs}`, ctrl.signal)
      .then(({ analyses }) => {
        setStates((prev) => {
          const next = { ...prev };
          for (const [m, a] of Object.entries(analyses) as [AnalysisModeKey, NonNullable<(typeof analyses)[AnalysisModeKey]>][]) {
            if (next[m].status === "idle") {
              next[m] = { status: "done", content: a.content, id: a.id, cached: true, createdAt: a.createdAt, model: a.model };
            }
          }
          return next;
        });
      })
      .catch(() => undefined)
      .finally(() => {
        if (!ctrl.signal.aborted) setCheckingCache(false);
      });
    return () => ctrl.abort();
  }, [file, owner, repo, gitRef]);

  // Today's quota, for the "N left today" line under the Generate button.
  useEffect(() => {
    if (!signedIn || !file || file.content == null) return;
    const ctrl = new AbortController();
    apiGet<{ remaining: number }>("/api/me/usage", ctrl.signal)
      .then((u) => setRemaining((r) => r ?? u.remaining))
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [signedIn, file]);

  useEffect(() => () => Object.values(controllers.current).forEach((c) => c?.abort()), []);

  const analyze = useCallback(
    async (m: AnalysisModeKey, force = false) => {
      if (!file) return;
      controllers.current[m]?.abort();
      const ctrl = new AbortController();
      controllers.current[m] = ctrl;

      const before = statesRef.current[m];
      const prev = before.status === "done" ? before : before.status === "error" ? before.prev : undefined;

      let content = "";
      let frame = 0;
      const flush = () => {
        frame = 0;
        if (ctrl.signal.aborted) return;
        setModeState(m, { status: "streaming", content, regenerating: false, prev });
      };
      setModeState(m, { status: "streaming", content: prev?.content ?? "", regenerating: !!prev, prev });

      const fail = (code: string, message: string) =>
        setModeState(m, { status: "error", code, message, content: content || prev?.content, prev });

      try {
        let cached = false;
        for await (const event of streamNdjson(
          "/api/analyze",
          { owner, repo, ref: gitRef, path: file.path, mode: m, force },
          ctrl.signal,
        )) {
          if (event.type === "meta") {
            cached = event.cached;
            if (event.remaining !== null) setRemaining(event.remaining);
          } else if (event.type === "delta") {
            content += event.text;
            // Batch renders to one per animation frame while streaming.
            if (!frame) frame = requestAnimationFrame(flush);
          } else if (event.type === "reset") {
            content = "";
          } else if (event.type === "done") {
            if (frame) cancelAnimationFrame(frame);
            setModeState(m, { status: "done", content, id: event.id, cached, createdAt: event.createdAt, model: event.model });
            return;
          } else if (event.type === "error") {
            if (frame) cancelAnimationFrame(frame);
            if (event.code === "QUOTA_EXCEEDED") setRemaining(0);
            fail(event.code, event.message);
            return;
          }
        }
        if (frame) cancelAnimationFrame(frame);
        if (!ctrl.signal.aborted) fail("INTERRUPTED", "The connection was interrupted. Please try again.");
      } catch (err) {
        if (frame) cancelAnimationFrame(frame);
        if (ctrl.signal.aborted) return;
        const e = err instanceof ApiClientError ? err : null;
        if (e?.code === "QUOTA_EXCEEDED") setRemaining(0);
        fail(e?.code ?? "NETWORK", e?.message ?? "Network error. Check your connection and try again.");
      } finally {
        if (controllers.current[m] === ctrl) delete controllers.current[m];
      }
    },
    [file, owner, repo, gitRef, setModeState],
  );

  function stop(m: AnalysisModeKey) {
    controllers.current[m]?.abort();
    const s = statesRef.current[m];
    if (s.status !== "streaming") return;
    // Stopping a regenerate before any new text arrived simply keeps the previous result.
    if (s.regenerating && s.prev) setModeState(m, s.prev);
    else if (s.content) setModeState(m, { status: "stopped", content: s.content });
    else setModeState(m, { status: "idle" });
  }

  async function share(id: string) {
    setSharing(true);
    try {
      const { url } = await apiSend<{ url: string }>(`/api/analyses/${id}/share`, "POST");
      await navigator.clipboard.writeText(url).catch(() => undefined);
      toast.success("Share link copied", { description: <span className="font-mono">{url}</span> });
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Couldn't create a share link.");
    } finally {
      setSharing(false);
    }
  }

  function onTabKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const i = MODES.findIndex((x) => x.key === mode);
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % MODES.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + MODES.length) % MODES.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = MODES.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const key = MODES[next].key;
    setMode(key);
    tabRefs.current[key]?.focus();
  }

  const state = states[mode];
  const current = MODES.find((x) => x.key === mode)!;
  const analyzable = !!file && file.content != null;
  const shownDone: Done | undefined = state.status === "done" ? state : state.status === "error" ? state.prev : undefined;
  const bodyContent =
    state.status === "streaming" || state.status === "stopped" || state.status === "done" ? state.content : state.status === "error" ? state.content : undefined;
  const quotaOut = remaining === 0;

  const segments = path.split("/");
  const name = segments[segments.length - 1];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <article className="px-4 pt-5 pb-10 lg:px-10 lg:pt-8">
          <header>
            {segments.length > 1 ? (
              <nav aria-label="File path" className="flex flex-wrap items-center font-mono text-[13px] leading-5 text-label">
                {segments.slice(0, -1).map((seg, i) => {
                  const dir = segments.slice(0, i + 1).join("/");
                  return (
                    <span key={dir} className="flex items-center">
                      <button onClick={() => onRevealDir(dir)} className="cursor-pointer break-all hover:text-ink hover:underline">
                        {seg}
                      </button>
                      <span className="px-1 text-ink-muted">/</span>
                    </span>
                  );
                })}
              </nav>
            ) : null}
            <h1 className="doc-title mt-1">{name}</h1>
            <p className="caption mt-2">
              {file ? (
                <>
                  {languageLabel(file.language)}
                  {file.content != null ? ` · ${plural(file.lineCount, "line")}` : ""} · {formatBytes(file.size)} ·{" "}
                </>
              ) : null}
              <span className="font-mono normal-case tracking-normal">{gitRef}</span>
            </p>
            <hr className="accent-rule" />
          </header>

          {analyzable ? (
            <div role="tablist" aria-label="Analysis mode" className="tab-strip mb-6" onKeyDown={onTabKey}>
              {MODES.map((m, i) => {
                const s = states[m.key];
                const selected = mode === m.key;
                return (
                  <button
                    key={m.key}
                    ref={(el) => {
                      tabRefs.current[m.key] = el;
                    }}
                    id={`analysis-tab-${m.key}`}
                    role="tab"
                    aria-selected={selected}
                    aria-controls={`analysis-panel-${m.key}`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setMode(m.key)}
                    className="tab-btn first:pl-0"
                  >
                    <span aria-hidden className="font-mono text-[13px] font-normal tracking-normal text-label">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {m.label}
                    {s.status === "streaming" ? (
                      <span aria-hidden className="status-mark-live size-1.5 bg-orange" />
                    ) : s.status === "done" ? (
                      <span aria-hidden className="size-1.5 bg-ink" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div
            role={analyzable ? "tabpanel" : undefined}
            id={analyzable ? `analysis-panel-${mode}` : undefined}
            aria-labelledby={analyzable ? `analysis-tab-${mode}` : undefined}
          >
            {!file ? (
              fileLoading ? (
                <DocSkeleton />
              ) : (
                <p className="meta">The file didn&apos;t load. Retry from the code panel.</p>
              )
            ) : !analyzable ? (
              <EmptyState title="This file can't be analyzed" className="pt-0">
                Only text files can be analyzed.
              </EmptyState>
            ) : state.status === "idle" ? (
              checkingCache ? (
                <DocSkeleton />
              ) : (
                <div className="max-w-[60ch]">
                  <p className="text-ink-muted">{current.blurb}</p>
                  {signedIn ? (
                    <>
                      <Button className="mt-5" disabled={quotaOut} onClick={() => analyze(mode)}>
                        Generate {current.label.toLowerCase()}
                      </Button>
                      {quotaOut ? (
                        <p className="meta mt-3">Resets at midnight UTC</p>
                      ) : remaining !== null ? (
                        <p className="meta mt-3">{remaining} left today · Each new analysis uses 1</p>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <Button className="mt-5" onClick={() => signIn("github", { callbackUrl: window.location.href })}>
                        <GitHubIcon /> Sign in to analyze
                      </Button>
                      <p className="meta mt-3">Free, with read-only access to your public GitHub profile.</p>
                    </>
                  )}
                </div>
              )
            ) : (
              <>
                {state.status === "error" ? <ErrorNotice state={state} onRetry={() => analyze(mode)} /> : null}
                {state.status === "stopped" ? (
                  <p className="mb-6 border-l-2 border-ink bg-paper-raised px-4 py-3 font-semibold">Stopped. Not saved, not charged.</p>
                ) : null}
                {bodyContent ? (
                  <Markdown
                    content={bodyContent}
                    onLineClick={onLineClick}
                    streaming={state.status === "streaming" && !state.regenerating}
                  />
                ) : null}
              </>
            )}
          </div>
        </article>
      </div>

      {analyzable ? (
        <Colophon
          visible={state.status !== "idle" && !(state.status === "error" && !shownDone)}
          status={<p role="status" aria-live="polite" className={cn("meta", state.status !== "streaming" && "sr-only")}>{statusText(state, current.label)}</p>}
        >
          {state.status === "streaming" ? (
            <Button variant="secondary" size="sm" className="ml-auto" onClick={() => stop(mode)}>
              <Square className="size-3 fill-current" aria-hidden /> Stop
            </Button>
          ) : state.status === "stopped" ? (
            <div className="ml-auto flex items-center gap-1">
              <CopyButton copied={copy.copied} onCopy={() => copy.copy(state.content)} />
              {signedIn ? (
                <Button variant="ghost" size="sm" onClick={() => analyze(mode)}>
                  Generate again
                </Button>
              ) : null}
            </div>
          ) : shownDone ? (
            <>
              {shownDone.cached ? (
                <Badge variant="cached" title="Loaded from a previous analysis of this exact file version">
                  Cached
                </Badge>
              ) : (
                <Badge variant="new">New</Badge>
              )}
              <span className="meta">{timeAgo(shownDone.createdAt)}</span>
              {remaining !== null ? <span className="meta">· {remaining} left today</span> : null}
              <div className="ml-auto flex items-center gap-1">
                <CopyButton copied={copy.copied} onCopy={() => copy.copy(shownDone.content)} />
                {signedIn ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Share analysis"
                      disabled={sharing}
                      aria-busy={sharing || undefined}
                      onClick={() => share(shownDone.id)}
                    >
                      {sharing ? <Loader2 className="motion-safe:animate-spin" aria-hidden /> : <Share2 aria-hidden />} Share
                    </Button>
                    {/* Never disabled for quota: a Regenerate at 0 must reach the server and show the limit notice. */}
                    <Button variant="ghost" size="sm" aria-label="Regenerate analysis" onClick={() => analyze(mode, true)}>
                      <RotateCcw aria-hidden /> Regenerate
                    </Button>
                  </>
                ) : null}
              </div>
            </>
          ) : null}
        </Colophon>
      ) : null}
    </div>
  );
}

function Colophon({ visible, status, children }: { visible: boolean; status: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex min-h-12 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-hairline bg-paper px-4 py-1.5",
        !visible && "sr-only",
      )}
    >
      {status}
      {visible ? children : null}
    </div>
  );
}

function CopyButton({ copied, onCopy }: { copied: boolean; onCopy: () => void }) {
  return (
    <Button variant="ghost" size="sm" aria-label="Copy analysis as Markdown" onClick={onCopy}>
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function ErrorNotice({ state, onRetry }: { state: Extract<ModeState, { status: "error" }>; onRetry: () => void }) {
  const quota = state.code === "QUOTA_EXCEEDED";
  const busy = state.code === "MODEL_BUSY";
  const title = quota ? "Daily limit reached" : busy ? "The model is busy" : "Analysis failed";
  let message = state.message;
  if (quota && !/midnight UTC/i.test(message)) message = `${message.replace(/\.?$/, ".")} It resets at midnight UTC.`;
  if (busy && !/not charged/i.test(message)) message = `${message.replace(/\.?$/, ".")} Your quota was not charged.`;
  return (
    <div role="alert" className="mb-6 max-w-[68ch] border-l-2 border-danger bg-paper-raised px-4 py-3">
      <p className="flex items-center gap-2 font-bold text-danger">
        <AlertTriangle className="size-4 shrink-0" aria-hidden />
        {title}
      </p>
      <p className="mt-1 text-ink">{message}</p>
      {state.code === "UNAUTHORIZED" ? (
        <Button size="sm" variant="secondary" className="mt-3" onClick={() => signIn("github", { callbackUrl: window.location.href })}>
          <GitHubIcon /> Sign in again
        </Button>
      ) : !quota && state.code !== "NOT_ANALYZABLE" && state.code !== "REFUSED" ? (
        <Button size="sm" variant="secondary" className="mt-3" onClick={onRetry}>
          <RotateCcw aria-hidden /> Try again
        </Button>
      ) : null}
    </div>
  );
}

function DocSkeleton() {
  return (
    <div className="max-w-[60ch] space-y-3" aria-busy="true">
      <Skeleton className="h-3 w-1/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-11/12" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="mt-8 h-3 w-1/5" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  );
}
