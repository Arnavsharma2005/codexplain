"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  Copy,
  Loader2,
  RotateCcw,
  Share2,
  Sparkles,
  Square,
  Zap,
} from "lucide-react";
import type { AnalysisModeKey, CachedResponse, FileResponse } from "@/lib/api-types";
import { ApiClientError, apiGet, apiSend, streamNdjson } from "@/lib/api-client";
import type { LineRange } from "@/lib/line-refs";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { GitHubIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { cn, timeAgo } from "@/lib/utils";
import { useCopy } from "./use-copy";

const MODES: { key: AnalysisModeKey; label: string; blurb: string }[] = [
  { key: "OVERVIEW", label: "Overview", blurb: "A quick summary of what this file does and how it fits in." },
  { key: "DEEP_DIVE", label: "Deep dive", blurb: "A section-by-section walkthrough of the logic and data flow." },
  { key: "REVIEW", label: "Code review", blurb: "Bugs, security, performance and readability, ranked by severity." },
];

type ModeState =
  | { status: "idle" }
  | { status: "streaming"; content: string }
  | { status: "done"; content: string; id: string; cached: boolean; createdAt: string; model: string }
  | { status: "error"; code: string; message: string; content?: string };

type Props = {
  owner: string;
  repo: string;
  gitRef: string;
  file: FileResponse | null;
  fileLoading: boolean;
  signedIn: boolean;
  onLineClick: (range: LineRange) => void;
};

const EMPTY: Record<AnalysisModeKey, ModeState> = {
  OVERVIEW: { status: "idle" },
  DEEP_DIVE: { status: "idle" },
  REVIEW: { status: "idle" },
};

export function AnalysisPanel({ owner, repo, gitRef, file, fileLoading, signedIn, onLineClick }: Props) {
  const [mode, setMode] = useState<AnalysisModeKey>("OVERVIEW");
  const [states, setStates] = useState<Record<AnalysisModeKey, ModeState>>(EMPTY);
  const [checkingCache, setCheckingCache] = useState(() => !!file && file.content != null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const controllers = useRef<Partial<Record<AnalysisModeKey, AbortController>>>({});
  const copy = useCopy();

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

  useEffect(() => () => Object.values(controllers.current).forEach((c) => c?.abort()), []);

  const analyze = useCallback(
    async (m: AnalysisModeKey, force = false) => {
      if (!file) return;
      controllers.current[m]?.abort();
      const ctrl = new AbortController();
      controllers.current[m] = ctrl;

      let content = "";
      let frame = 0;
      const flush = () => {
        frame = 0;
        setModeState(m, { status: "streaming", content });
      };
      setModeState(m, { status: "streaming", content: "" });

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
            setModeState(m, { status: "error", code: event.code, message: event.message });
            return;
          }
        }
        if (frame) cancelAnimationFrame(frame);
        if (!ctrl.signal.aborted) {
          setModeState(m, { status: "error", code: "INTERRUPTED", message: "The connection was interrupted. Please try again." });
        }
      } catch (err) {
        if (frame) cancelAnimationFrame(frame);
        if (ctrl.signal.aborted) return;
        const e = err instanceof ApiClientError ? err : null;
        setModeState(m, {
          status: "error",
          code: e?.code ?? "NETWORK",
          message: e?.message ?? "Network error. Check your connection and try again.",
        });
      } finally {
        if (controllers.current[m] === ctrl) delete controllers.current[m];
      }
    },
    [file, owner, repo, gitRef, setModeState],
  );

  function stop(m: AnalysisModeKey) {
    controllers.current[m]?.abort();
    setModeState(m, { status: "idle" });
  }

  async function share(id: string) {
    try {
      const { url } = await apiSend<{ url: string }>(`/api/analyses/${id}/share`, "POST");
      await navigator.clipboard.writeText(url).catch(() => undefined);
      toast.success("Share link copied", { description: url });
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Couldn't create a share link.");
    }
  }

  const state = states[mode];
  const current = MODES.find((x) => x.key === mode)!;
  const streaming = state.status === "streaming";
  const analyzable = file && file.content != null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-border px-2" role="tablist" aria-label="Analysis mode">
        {MODES.map((m) => {
          const s = states[m.key];
          return (
            <button
              key={m.key}
              role="tab"
              aria-selected={mode === m.key}
              onClick={() => setMode(m.key)}
              className={cn(
                "relative flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors",
                mode === m.key ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m.label}
              {s.status === "streaming" ? <Loader2 className="size-3 animate-spin text-primary" /> : null}
              {s.status === "done" ? <span className="size-1.5 rounded-full bg-success" aria-label="ready" /> : null}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {!file ? (
          fileLoading ? (
            <PanelSkeleton />
          ) : (
            <EmptyState icon={<Sparkles className="size-5" />} title="Pick a file to analyze">
              Choose a file from the tree, then generate an overview, a deep dive or a code review.
            </EmptyState>
          )
        ) : !analyzable ? (
          <EmptyState icon={<AlertTriangle className="size-5" />} title="This file can't be analyzed">
            Only text files can be analyzed.
          </EmptyState>
        ) : state.status === "idle" ? (
          checkingCache ? (
            <PanelSkeleton />
          ) : (
            <EmptyState icon={<Sparkles className="size-5" />} title={current.label}>
              <p>{current.blurb}</p>
              {signedIn ? (
                <Button className="mt-5" onClick={() => analyze(mode)}>
                  <Sparkles /> Generate {current.label.toLowerCase()}
                </Button>
              ) : (
                <>
                  <Button className="mt-5" onClick={() => signIn("github", { callbackUrl: window.location.href })}>
                    <GitHubIcon /> Sign in to analyze
                  </Button>
                  <p className="mt-3 text-xs">Free, with read-only access to your public GitHub profile.</p>
                </>
              )}
            </EmptyState>
          )
        ) : state.status === "error" ? (
          <div className="p-5">
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">
                    {state.code === "QUOTA_EXCEEDED" ? "Daily limit reached" : "Analysis failed"}
                  </p>
                  <p className="mt-1 text-muted-foreground">{state.message}</p>
                </div>
              </div>
              {state.code === "UNAUTHORIZED" ? (
                <Button size="sm" className="mt-4" onClick={() => signIn("github", { callbackUrl: window.location.href })}>
                  <GitHubIcon /> Sign in again
                </Button>
              ) : state.code !== "QUOTA_EXCEEDED" && state.code !== "NOT_ANALYZABLE" && state.code !== "REFUSED" ? (
                <Button size="sm" variant="outline" className="mt-4" onClick={() => analyze(mode)}>
                  <RotateCcw /> Try again
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="p-5">
            {streaming && !state.content ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" /> Reading the file and thinking…
              </div>
            ) : (
              <Markdown content={state.content} onLineClick={onLineClick} streaming={streaming} />
            )}
          </div>
        )}
      </div>

      {analyzable && (state.status === "streaming" || state.status === "done") ? (
        <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
          {state.status === "streaming" ? (
            <>
              <Loader2 className="size-3.5 animate-spin text-primary" /> Generating…
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => stop(mode)}>
                <Square className="size-3 fill-current" /> Stop
              </Button>
            </>
          ) : (
            <>
              {state.cached ? (
                <Tooltip content="Loaded instantly from a previous analysis of this exact file version">
                  <Badge variant="success">
                    <Zap /> Cached
                  </Badge>
                </Tooltip>
              ) : (
                <Badge variant="default">
                  <Check /> New
                </Badge>
              )}
              <span className="truncate">{timeAgo(state.createdAt)}</span>
              {remaining !== null ? <span className="hidden sm:inline">· {remaining} left today</span> : null}
              <div className="ml-auto flex items-center gap-1">
                <Tooltip content={copy.copied ? "Copied" : "Copy as Markdown"}>
                  <Button variant="ghost" size="icon-sm" aria-label="Copy analysis as Markdown" onClick={() => copy.copy(state.content)}>
                    {copy.copied ? <Check className="text-success" /> : <Copy />}
                  </Button>
                </Tooltip>
                {signedIn ? (
                  <>
                    <Tooltip content="Create a share link">
                      <Button variant="ghost" size="icon-sm" aria-label="Share analysis" onClick={() => share(state.id)}>
                        <Share2 />
                      </Button>
                    </Tooltip>
                    <Tooltip content="Regenerate (uses one analysis from your daily quota)">
                      <Button variant="ghost" size="icon-sm" aria-label="Regenerate analysis" onClick={() => analyze(mode, true)}>
                        <RotateCcw />
                      </Button>
                    </Tooltip>
                  </>
                ) : null}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 py-12 text-center">
      <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon}</div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <div className="mt-1.5 max-w-xs text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="space-y-3 p-5" aria-busy="true">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-11/12" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="mt-6 h-4 w-1/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  );
}
