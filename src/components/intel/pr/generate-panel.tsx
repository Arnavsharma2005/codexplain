"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PullWalkEvent } from "@/app/api/intel/pulls/route";
import { ApiClientError } from "@/lib/api-client";
import { postNdjson } from "@/lib/intel/client";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";

type Progress = Extract<PullWalkEvent, { type: "progress" }>;

const STAGES: Record<Progress["stage"], string> = {
  pull: "Reading the pull request",
  download: "Downloading the head commit",
  parse: "Reading the import graph",
  model: "Writing the walkthrough",
  save: "Saving",
};

type Props = { owner: string; repo: string; number: number; signedIn: boolean; label: string; variant?: "default" | "link" };

/** Starts a walkthrough and shows its progress; the page reloads its data when it is saved. */
export function GeneratePanel({ owner, repo, number, signedIn, label, variant = "default" }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  if (!signedIn) {
    const back = `/r/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pull/${number}`;
    return (
      <Button asChild variant={variant} size={variant === "link" ? "sm" : "default"}>
        <Link href={`/login?callbackUrl=${encodeURIComponent(back)}`}>Sign in to {label.charAt(0).toLowerCase()}{label.slice(1)}</Link>
      </Button>
    );
  }

  async function run() {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setError(null);
    setProgress({ type: "progress", stage: "pull", message: "" });
    try {
      for await (const e of postNdjson<PullWalkEvent>("/api/intel/pulls", { owner, repo, number }, ctrl.signal)) {
        if (e.type === "progress") setProgress(e);
        else if (e.type === "error") setError(e.message);
        else if (e.type === "done") router.refresh();
      }
    } catch (err) {
      if (!ctrl.signal.aborted) setError(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const pct = progress?.total ? Math.round(((progress.done ?? 0) / progress.total) * 100) : null;
  return (
    <div>
      <Button variant={variant} size={variant === "link" ? "sm" : "default"} onClick={run} disabled={busy}>
        {busy ? "Working" : label}
      </Button>
      {busy && progress ? (
        <div className="mt-5 max-w-[560px]" role="status" aria-live="polite">
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
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
