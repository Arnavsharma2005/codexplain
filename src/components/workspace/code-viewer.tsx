"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, Copy, ExternalLink, FileQuestion, Link2, WrapText } from "lucide-react";
import type { FileResponse } from "@/lib/api-types";
import type { LineRange } from "@/lib/line-refs";
import { languageLabel } from "@/lib/languages";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { formatBytes, plural } from "@/lib/utils";
import { FileIcon } from "./file-icon";
import { useCopy } from "./use-copy";

type Props = {
  path: string;
  file: FileResponse | null;
  loading: boolean;
  error: string | null;
  highlight: LineRange | null;
  onLineSelect: (range: LineRange) => void;
  onRetry: () => void;
  /** Mobile only: shown after a line-ref jump from the analysis. */
  onBackToAnalysis?: () => void;
};

function readWrap(): boolean {
  try {
    const saved = localStorage.getItem("cx-wrap");
    if (saved === "1" || saved === "0") return saved === "1";
  } catch {
    /* storage unavailable */
  }
  return window.matchMedia("(max-width: 767px)").matches;
}

/** The code editor: a file tab strip with quiet tools, then the highlighted source on navy. */
export function CodeViewer({ path, file, loading, error, highlight, onLineSelect, onRetry, onBackToAnalysis }: Props) {
  const codeRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastClicked = useRef<number | null>(null);
  const copyCode = useCopy();
  const copyLink = useCopy();
  // Files load on the client, so the wrap toggle and the code never render on the server.
  const [wrap, setWrap] = useState(() => (typeof window === "undefined" ? false : readWrap()));

  function toggleWrap() {
    setWrap((w) => {
      try {
        localStorage.setItem("cx-wrap", w ? "0" : "1");
      } catch {
        /* storage unavailable */
      }
      return !w;
    });
  }

  // Apply the highlighted range, scroll it into view and move focus to the code.
  useEffect(() => {
    const root = codeRef.current;
    if (!root || !file?.html) return;
    root.querySelectorAll(".line.highlighted").forEach((el) => el.classList.remove("highlighted"));
    if (!highlight) return;
    const end = Math.min(highlight.end, file.lineCount);
    for (let n = highlight.start; n <= end; n++) root.querySelector(`#L${n}`)?.classList.add("highlighted");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.querySelector(`#L${highlight.start}`)?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    scrollRef.current?.focus({ preventScroll: true });
  }, [highlight, file]);

  // Clicking a line number selects it; shift-click extends the selection.
  function onCodeClick(e: React.MouseEvent<HTMLDivElement>) {
    const line = (e.target as HTMLElement).closest<HTMLElement>(".line");
    if (!line) return;
    const rect = line.getBoundingClientRect();
    if (e.clientX - rect.left > 72) return; // only the gutter (56px numbers + 16px gap)
    const n = Number(line.dataset.line);
    if (!n) return;
    if (e.shiftKey && lastClicked.current) {
      onLineSelect({ start: Math.min(lastClicked.current, n), end: Math.max(lastClicked.current, n) });
    } else {
      lastClicked.current = n;
      onLineSelect({ start: n, end: n });
    }
  }

  const name = path.split("/").pop() ?? path;
  const text = !!file && file.content != null;
  const rangeLabel = highlight
    ? highlight.start === highlight.end
      ? `Line ${highlight.start}`
      : `Lines ${highlight.start} to ${highlight.end}`
    : "Code";

  return (
    <section className="on-plate flex h-full min-h-0 flex-col border border-plate-border bg-plate text-plate-fg">
      <div className="plate-tabstrip shrink-0 flex-wrap pr-1.5">
        <span className="plate-tab" title={path}>
          <FileIcon path={path} className="size-3.5" />
          <span className="truncate">{name}</span>
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-1 pl-3">
          <span className="plate-meta hidden truncate sm:inline">
            <b>Code</b>
            {file ? (
              <>
                {languageLabel(file.language)}
                {text ? ` · ${plural(file.lineCount, "line")}` : ""} · {formatBytes(file.size)}
              </>
            ) : null}
          </span>
          <span className="flex-1" />
          {onBackToAnalysis ? (
            <Button variant="plate-outline" size="sm" className="my-1 lg:hidden" onClick={onBackToAnalysis}>
              <ArrowLeft aria-hidden /> Back to analysis
            </Button>
          ) : null}
          {file ? (
            <span className="plate-tools flex shrink-0 items-center gap-0.5">
              {text ? (
                <Tooltip content="Wrap lines">
                  <Button variant="plate-quiet" size="icon-sm" aria-label="Wrap" aria-pressed={wrap} onClick={toggleWrap} className="size-7">
                    <WrapText />
                  </Button>
                </Tooltip>
              ) : null}
              {text ? (
                <Tooltip content={copyCode.copied ? "Copied" : "Copy file"}>
                  <Button variant="plate-quiet" size="icon-sm" aria-label="Copy file contents" onClick={() => copyCode.copy(file.content!)} className="size-7">
                    {copyCode.copied ? <Check /> : <Copy />}
                  </Button>
                </Tooltip>
              ) : null}
              <Tooltip content={copyLink.copied ? "Copied" : "Copy link"}>
                <Button variant="plate-quiet" size="icon-sm" aria-label="Copy link to this file" onClick={() => copyLink.copy(window.location.href)} className="size-7">
                  {copyLink.copied ? <Check /> : <Link2 />}
                </Button>
              </Tooltip>
              <Button variant="plate-quiet" size="icon-sm" asChild className="size-7">
                <a href={file.htmlUrl} target="_blank" rel="noopener noreferrer" aria-label="View on GitHub" data-tip="View on GitHub" data-tip-end="">
                  <ExternalLink />
                </a>
              </Button>
            </span>
          ) : null}
        </span>
      </div>

      <div
        ref={scrollRef}
        tabIndex={-1}
        role="region"
        aria-label={rangeLabel}
        className="plate-scroll relative min-h-0 flex-1 overflow-auto outline-none"
      >
        {loading ? (
          <CodeSkeleton />
        ) : error ? (
          <PlateNotice icon={<AlertTriangle />} message={error}>
            <Button size="sm" variant="plate-outline" onClick={onRetry}>
              Retry
            </Button>
          </PlateNotice>
        ) : file && file.html ? (
          <div ref={codeRef} className="code-view" data-wrap={wrap} onClick={onCodeClick} dangerouslySetInnerHTML={{ __html: file.html }} />
        ) : file ? (
          <PlateNotice
            icon={<FileQuestion />}
            message={
              file.reason === "binary"
                ? "This is a binary file, so it can't be displayed here."
                : `This file is ${formatBytes(file.size)}, which is too large to display.`
            }
          >
            <Button size="sm" variant="plate-outline" asChild>
              <a href={file.htmlUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> Open on GitHub
              </a>
            </Button>
          </PlateNotice>
        ) : null}
      </div>
    </section>
  );
}

function PlateNotice({ icon, message, children }: { icon: React.ReactNode; message: string; children: React.ReactNode }) {
  return (
    <div className="p-8">
      <span className="text-plate-muted [&_svg]:size-4" aria-hidden>
        {icon}
      </span>
      <p className="mt-3 max-w-[46ch] text-[15px] text-plate-fg">{message}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function CodeSkeleton() {
  const widths = [40, 62, 55, 30, 0, 70, 48, 66, 35, 0, 58, 44, 72, 38, 52, 60, 25, 0, 46, 64];
  return (
    <div className="pt-3" aria-busy="true" aria-label="Loading file">
      {widths.map((w, i) => (
        <div key={i} className="flex h-6 items-center">
          <div className="flex w-14 justify-end pr-3">
            <Skeleton className="h-2.5 w-4" />
          </div>
          <div className="ml-4 flex-1">{w ? <Skeleton className="h-2.5" style={{ width: `${w}%` }} /> : null}</div>
        </div>
      ))}
    </div>
  );
}
