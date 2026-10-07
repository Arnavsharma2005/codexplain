"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, Check, Copy, ExternalLink, FileQuestion, Link2, RefreshCw } from "lucide-react";
import type { FileResponse } from "@/lib/api-types";
import type { LineRange } from "@/lib/line-refs";
import { languageLabel } from "@/lib/languages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { cn, formatBytes } from "@/lib/utils";
import { useCopy } from "./use-copy";

type Props = {
  path: string;
  file: FileResponse | null;
  loading: boolean;
  error: string | null;
  highlight: LineRange | null;
  onLineSelect: (range: LineRange) => void;
  onRevealDir: (dir: string) => void;
  onRetry: () => void;
};

export function CodeViewer({ path, file, loading, error, highlight, onLineSelect, onRevealDir, onRetry }: Props) {
  const codeRef = useRef<HTMLDivElement>(null);
  const lastClicked = useRef<number | null>(null);
  const copyCode = useCopy();
  const copyLink = useCopy();

  // Apply the highlighted range and scroll it into view.
  useEffect(() => {
    const root = codeRef.current;
    if (!root || !file?.html) return;
    root.querySelectorAll(".line.highlighted").forEach((el) => el.classList.remove("highlighted"));
    if (!highlight) return;
    const end = Math.min(highlight.end, file.lineCount);
    for (let n = highlight.start; n <= end; n++) root.querySelector(`#L${n}`)?.classList.add("highlighted");
    root.querySelector(`#L${highlight.start}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlight, file]);

  // Clicking a line number selects it; shift-click extends the selection.
  function onCodeClick(e: React.MouseEvent<HTMLDivElement>) {
    const line = (e.target as HTMLElement).closest<HTMLElement>(".line");
    if (!line) return;
    const rect = line.getBoundingClientRect();
    if (e.clientX - rect.left > 72) return; // only the gutter
    const n = Number(line.dataset.line);
    if (!n) return;
    if (e.shiftKey && lastClicked.current) {
      onLineSelect({ start: Math.min(lastClicked.current, n), end: Math.max(lastClicked.current, n) });
    } else {
      lastClicked.current = n;
      onLineSelect({ start: n, end: n });
    }
  }

  const segments = path.split("/");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-3 border-b border-border px-3">
        <nav aria-label="File path" className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden font-mono text-[13px]">
          {segments.map((seg, i) => {
            const last = i === segments.length - 1;
            const dir = segments.slice(0, i + 1).join("/");
            return (
              <span key={dir} className={cn("flex min-w-0 items-center gap-1", !last && "shrink")}>
                {last ? (
                  <span className="truncate font-semibold text-foreground">{seg}</span>
                ) : (
                  <button onClick={() => onRevealDir(dir)} className="truncate text-muted-foreground hover:text-foreground hover:underline">
                    {seg}
                  </button>
                )}
                {!last ? <span className="text-muted-foreground/60">/</span> : null}
              </span>
            );
          })}
        </nav>
        {file ? (
          <div className="flex shrink-0 items-center gap-1">
            <span className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
              <Badge variant="outline">{languageLabel(file.language)}</Badge>
              {file.content != null ? <span>{file.lineCount.toLocaleString()} lines</span> : null}
              <span>{formatBytes(file.size)}</span>
            </span>
            {file.content != null ? (
              <Tooltip content={copyCode.copied ? "Copied" : "Copy file"}>
                <Button variant="ghost" size="icon-sm" aria-label="Copy file contents" onClick={() => copyCode.copy(file.content!)}>
                  {copyCode.copied ? <Check className="text-success" /> : <Copy />}
                </Button>
              </Tooltip>
            ) : null}
            <Tooltip content={copyLink.copied ? "Copied" : "Copy link"}>
              <Button variant="ghost" size="icon-sm" aria-label="Copy link to this file" onClick={() => copyLink.copy(window.location.href)}>
                {copyLink.copied ? <Check className="text-success" /> : <Link2 />}
              </Button>
            </Tooltip>
            <Tooltip content="View on GitHub">
              <Button variant="ghost" size="icon-sm" asChild>
                <a href={file.htmlUrl} target="_blank" rel="noopener noreferrer" aria-label="View on GitHub">
                  <ExternalLink />
                </a>
              </Button>
            </Tooltip>
          </div>
        ) : null}
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto bg-code-bg">
        {loading ? (
          <CodeSkeleton />
        ) : error ? (
          <Centered>
            <AlertTriangle className="size-6 text-warning" />
            <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RefreshCw /> Retry
            </Button>
          </Centered>
        ) : file && file.html ? (
          <div ref={codeRef} className="code-view" onClick={onCodeClick} dangerouslySetInnerHTML={{ __html: file.html }} />
        ) : file ? (
          <Centered>
            <FileQuestion className="size-6 text-muted-foreground" />
            <p className="max-w-sm text-sm text-muted-foreground">
              {file.reason === "binary"
                ? "This is a binary file, so it can't be displayed here."
                : `This file is ${formatBytes(file.size)}, which is too large to display.`}
            </p>
            <Button size="sm" variant="outline" asChild>
              <a href={file.htmlUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> Open on GitHub
              </a>
            </Button>
          </Centered>
        ) : null}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">{children}</div>;
}

function CodeSkeleton() {
  const widths = [40, 62, 55, 30, 0, 70, 48, 66, 35, 0, 58, 44, 72, 38, 52, 60, 25, 0, 46, 64];
  return (
    <div className="space-y-2.5 p-4 pl-6" aria-busy="true" aria-label="Loading file">
      {widths.map((w, i) => (
        <div key={i} className="flex items-center gap-6">
          <Skeleton className="h-3 w-6 opacity-50" />
          {w ? <Skeleton className="h-3" style={{ width: `${w}%` }} /> : <div className="h-3" />}
        </div>
      ))}
    </div>
  );
}
