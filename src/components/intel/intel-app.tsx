"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { RepoInfo } from "@/lib/github/types";
import type { IndexSummary } from "@/lib/intel/http";
import type { IndexEvent } from "@/app/api/intel/index/route";
import type { GraphResponse } from "@/app/api/intel/[indexId]/graph/route";
import { ApiClientError, apiGet } from "@/lib/api-client";
import { postNdjson } from "@/lib/intel/client";
import { Masthead } from "@/components/masthead";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";
import { AskPanel } from "./ask-panel";
import { MapPanel } from "./map-panel";
import { McpPanel } from "./mcp-panel";

type Status = { commitSha: string; current: IndexSummary | null; latest: IndexSummary | null };
type Progress = Extract<IndexEvent, { type: "progress" }>;
type Tab = "ask" | "map" | "mcp";

const STAGES: Record<Progress["stage"], string> = {
  queued: "Queued",
  download: "Downloading the repository",
  parse: "Parsing with tree-sitter",
  store: "Saving the code graph",
  embed: "Embedding code for semantic search",
};

const TABS: [Tab, string, string][] = [
  ["ask", "Ask", "mode-overview"],
  ["map", "Map & impact", "mode-deep"],
  ["mcp", "Use from your agent", "mode-review"],
];

function errorText(err: unknown) {
  return err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.";
}

export function IntelApp({ repo, gitRef, signedIn }: { repo: RepoInfo; gitRef: string; signedIn: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [index, setIndex] = useState<IndexSummary | null>(null);
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [tab, setTab] = useState<Tab>("ask");
  // The force layout is computed on first visit to the map, not on page load.
  const [mapOpened, setMapOpened] = useState(false);
  const [draft, setDraft] = useState<{ text: string; at: number } | null>(null);
  const abort = useRef<AbortController | null>(null);

  const qs = new URLSearchParams({ owner: repo.owner, repo: repo.name, ref: gitRef }).toString();

  useEffect(() => {
    const ctrl = new AbortController();
    apiGet<Status>(`/api/intel/index?${qs}`, ctrl.signal)
      .then((s) => {
        setStatus(s);
        const ready = s.current?.status === "READY" ? s.current : s.latest;
        if (ready) setIndex(ready);
      })
      .catch((err) => {
        if (!ctrl.signal.aborted) setStatusError(errorText(err));
      });
    return () => ctrl.abort();
  }, [qs]);

  useEffect(() => {
    if (!index) return;
    const ctrl = new AbortController();
    apiGet<GraphResponse>(`/api/intel/${index.id}/graph`, ctrl.signal)
      .then(setGraph)
      .catch((err) => {
        if (!ctrl.signal.aborted) setBuildError(errorText(err));
      });
    return () => ctrl.abort();
  }, [index]);

  useEffect(() => () => abort.current?.abort(), []);

  const build = useCallback(async () => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBuilding(true);
    setBuildError(null);
    setProgress({ type: "progress", stage: "queued", message: "Queued" });
    try {
      for await (const e of postNdjson<IndexEvent>("/api/intel/index", { owner: repo.owner, repo: repo.name, ref: gitRef }, ctrl.signal)) {
        if (e.type === "progress") setProgress(e);
        else if (e.type === "error") setBuildError(e.message);
        else if (e.type === "done") {
          setGraph(null);
          setIndex(e.index);
          setStatus((s) => (s ? { ...s, current: e.index, latest: e.index } : s));
        }
      }
    } catch (err) {
      if (!ctrl.signal.aborted) setBuildError(errorText(err));
    } finally {
      setBuilding(false);
      setProgress(null);
    }
  }, [repo.owner, repo.name, gitRef]);

  const stale = !!(status && index && index.commitSha !== status.commitSha);
  const repoHref = `/r/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`;

  return (
    <div className="page">
      <Masthead
        title="Repo intelligence"
        blurb={
          <>
            A code graph, cited answers and change impact for{" "}
            <Link href={repoHref} className="chrome-link font-mono normal-case">
              {repo.fullName}
            </Link>
          </>
        }
      />

      {statusError ? <p className="text-danger">{statusError}</p> : null}

      {!index && status ? (
        <section aria-label="Build the index" className="section-ruled max-w-[68ch]">
          <h2 className="section-label marker-orange">
            Not indexed yet
          </h2>
          <p className="text-ink-muted">
            Indexing downloads <span className="font-mono text-ink">{gitRef}</span> once, parses every file with tree-sitter, maps
            the imports between files and embeds the code for semantic search. Most repositories take under a minute.
          </p>
          <BuildControls signedIn={signedIn} building={building} onBuild={build} label="Build the index" repoHref={repoHref} />
        </section>
      ) : null}

      {!status && !statusError ? <p className="meta">Checking for an index…</p> : null}

      {building && progress ? <ProgressLine progress={progress} /> : null}
      {buildError ? (
        <p role="alert" className="mt-4 text-danger">
          {buildError}
        </p>
      ) : null}

      {index ? (
        <>
          <Ledger index={index} />
          {stale && !building ? (
            <p className="meta mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span>
                Indexed at <span className="font-mono">{index.commitSha.slice(0, 7)}</span>; {gitRef} has moved to{" "}
                <span className="font-mono">{status!.commitSha.slice(0, 7)}</span>.
              </span>
              {signedIn ? (
                <Button variant="link" size="sm" onClick={build}>
                  Re-index (only changed code is re-embedded)
                </Button>
              ) : null}
            </p>
          ) : null}

          <div role="tablist" aria-label="Views" className="tab-strip mt-8">
            {TABS.map(([id, label, mode]) => (
              <button
                key={id}
                role="tab"
                type="button"
                id={`tab-${id}`}
                aria-controls={`panel-${id}`}
                aria-selected={tab === id}
                className={`tab-btn ${mode}`}
                onClick={() => {
                  setTab(id);
                  if (id === "map") setMapOpened(true);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Panels stay mounted so the conversation and map survive tab switches. */}
          <div role="tabpanel" id="panel-ask" aria-labelledby="tab-ask" hidden={tab !== "ask"} className="pt-6">
            <AskPanel index={index} repo={repo} graph={graph} signedIn={signedIn} draft={draft} />
          </div>
          <div role="tabpanel" id="panel-map" aria-labelledby="tab-map" hidden={tab !== "map"} className="pt-6">
            {mapOpened ? (
              graph ? (
                <MapPanel
                  graph={graph}
                  repo={repo}
                  sha={index.commitSha}
                  onAsk={(text) => {
                    setDraft({ text, at: Date.now() });
                    setTab("ask");
                  }}
                />
              ) : (
                <p className="meta">Loading the graph…</p>
              )
            ) : null}
          </div>
          <div role="tabpanel" id="panel-mcp" aria-labelledby="tab-mcp" hidden={tab !== "mcp"} className="pt-6">
            <McpPanel repo={repo} />
          </div>
        </>
      ) : null}
    </div>
  );
}

function BuildControls({
  signedIn,
  building,
  onBuild,
  label,
  repoHref,
}: {
  signedIn: boolean;
  building: boolean;
  onBuild: () => void;
  label: string;
  repoHref: string;
}) {
  if (!signedIn) {
    return (
      <Button asChild className="mt-5">
        <Link href={`/login?callbackUrl=${encodeURIComponent(`${repoHref}/intel`)}`}>Sign in to build the index</Link>
      </Button>
    );
  }
  return (
    <Button className="mt-5" onClick={onBuild} disabled={building}>
      {building ? "Indexing" : label}
    </Button>
  );
}

function ProgressLine({ progress }: { progress: Progress }) {
  const pct = progress.total ? Math.round(((progress.done ?? 0) / progress.total) * 100) : null;
  return (
    <div className="mt-6 max-w-[560px]" role="status" aria-live="polite">
      <p className="caption flex items-center gap-1.5">
        <span aria-hidden className="swatch marker-orange status-mark-live" />
        {STAGES[progress.stage]}
        {progress.total ? (
          <span className="tabular">
            {" "}
            · {formatNumber(progress.done ?? 0)} / {formatNumber(progress.total)}
          </span>
        ) : null}
      </p>
      {pct !== null ? (
        <div className="mt-2 h-2 border-2 border-ink" aria-hidden>
          <div className="h-full bg-orange transition-[width] duration-200" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function Ledger({ index }: { index: IndexSummary }) {
  const embeddedPct = index.chunkCount ? Math.round((index.embeddedCount / index.chunkCount) * 100) : 0;
  const cells: [string, string, string][] = [
    ["Files", formatNumber(index.fileCount), "marker-orange"],
    ["Definitions", formatNumber(index.symbolCount), "marker-teal"],
    ["Import edges", formatNumber(index.edgeCount), "marker-jungle"],
    ["Semantic coverage", `${embeddedPct}%`, "marker-moon"],
  ];
  return (
    <section aria-label="Index" className="grid grid-cols-2 border-t-2 border-b border-ink border-b-hairline sm:grid-cols-4">
      {cells.map(([label, value, marker]) => (
        <div key={label} className="py-3 pr-4">
          <p className="caption flex items-center gap-1.5">
            <span aria-hidden className={`swatch ${marker}`} />
            {label}
          </p>
          <p className="mt-1 text-[32px] font-bold leading-9 tabular">{value}</p>
        </div>
      ))}
      <p className="meta col-span-full border-t border-hairline py-2">
        Commit <span className="font-mono">{index.commitSha.slice(0, 7)}</span> · {formatNumber(index.chunkCount)} search chunks
        {index.skippedCount ? ` · ${formatNumber(index.skippedCount)} generated or oversized files skipped` : ""}
        {index.durationMs ? ` · indexed in ${(index.durationMs / 1000).toFixed(1)}s` : ""}
      </p>
    </section>
  );
}
