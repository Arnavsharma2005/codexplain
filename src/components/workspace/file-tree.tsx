"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronRight, Folder, FolderOpen, RefreshCw, Search, X } from "lucide-react";
import type { TreeEntry } from "@/lib/github/types";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileIcon } from "./file-icon";
import { ancestorsOf, baseName, buildTreeIndex, fuzzyScore, type TreeIndex } from "./tree-utils";

type Props = {
  entries: TreeEntry[] | null;
  loading: boolean;
  error: string | null;
  truncated: boolean;
  activePath: string | null;
  revealDir: string | null;
  onSelect: (path: string) => void;
  onRetry: () => void;
};

const MAX_RESULTS = 100;

export function FileTree({ entries, loading, error, truncated, activePath, revealDir, onSelect, onRetry }: Props) {
  const index = useMemo(() => (entries ? buildTreeIndex(entries) : null), [entries]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the active file's (or revealed folder's) ancestors expanded. Adjusting
  // state during render when inputs change avoids an extra effect pass.
  const revealKey = `${activePath ?? ""}|${revealDir ?? ""}`;
  const [lastRevealKey, setLastRevealKey] = useState<string | null>(null);
  if (revealKey !== lastRevealKey) {
    setLastRevealKey(revealKey);
    const targets = [
      ...(activePath ? ancestorsOf(activePath) : []),
      ...(revealDir ? [...ancestorsOf(revealDir), revealDir] : []),
    ];
    if (targets.some((t) => !expanded.has(t))) {
      const next = new Set(expanded);
      targets.forEach((t) => next.add(t));
      setExpanded(next);
    }
  }

  // "/" focuses the file filter from anywhere in the workspace.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!activePath || query) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-path="${CSS.escape(activePath)}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activePath, expanded, query]);

  const results = useMemo(() => {
    if (!index || !query.trim()) return null;
    const scored: { path: string; score: number }[] = [];
    for (const path of index.files) {
      const score = fuzzyScore(query, path);
      if (score !== null) scored.push({ path, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, MAX_RESULTS).map((s) => s.path);
  }, [index, query]);

  function toggle(dir: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(dir)) next.delete(dir);
      else next.add(dir);
      return next;
    });
  }

  function onFilterKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setQuery("");
      e.currentTarget.blur();
    } else if (results?.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const pick = results[cursor] ?? results[0];
        if (pick) {
          onSelect(pick);
          setQuery("");
        }
      }
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={onFilterKey}
            placeholder="Go to file"
            aria-label="Filter files"
            disabled={!index}
            className="h-8 w-full rounded-lg border border-input bg-background pl-8 pr-8 text-[13px] outline-none placeholder:text-muted-foreground/80 focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          {query ? (
            <button
              aria-label="Clear filter"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          ) : (
            <Kbd className="absolute right-2 top-1/2 -translate-y-1/2">/</Kbd>
          )}
        </div>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-auto py-1 text-[13px]" role="tree" aria-label="Repository files">
        {loading ? (
          <TreeSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center text-sm text-muted-foreground">
            <AlertTriangle className="size-5 text-warning" />
            <p>{error}</p>
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RefreshCw /> Retry
            </Button>
          </div>
        ) : results ? (
          results.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No files match “{query}”.</p>
          ) : (
            results.map((path, i) => (
              <button
                key={path}
                onClick={() => {
                  onSelect(path);
                  setQuery("");
                }}
                onMouseEnter={() => setCursor(i)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1 text-left",
                  i === cursor ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                )}
              >
                <FileIcon path={path} />
                <span className="min-w-0 truncate">
                  <span className="font-medium">{baseName(path)}</span>
                  <span className="ml-2 text-muted-foreground">{path.slice(0, -baseName(path).length - 1)}</span>
                </span>
              </button>
            ))
          )
        ) : index ? (
          <TreeLevel dir="" depth={0} index={index} expanded={expanded} activePath={activePath} onToggle={toggle} onSelect={onSelect} />
        ) : null}
      </div>

      {truncated ? (
        <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          This repository is very large, so GitHub returned a partial file list.
        </p>
      ) : null}
    </div>
  );
}

const TreeLevel = memo(function TreeLevel({
  dir,
  depth,
  index,
  expanded,
  activePath,
  onToggle,
  onSelect,
}: {
  dir: string;
  depth: number;
  index: TreeIndex;
  expanded: Set<string>;
  activePath: string | null;
  onToggle: (dir: string) => void;
  onSelect: (path: string) => void;
}) {
  const items = index.children.get(dir) ?? [];
  return (
    <>
      {items.map((item) => {
        const pad = { paddingLeft: 8 + depth * 14 };
        if (item.type === "tree") {
          const open = expanded.has(item.path);
          return (
            <div key={item.path} role="treeitem" aria-expanded={open} aria-selected={false}>
              <button
                onClick={() => onToggle(item.path)}
                style={pad}
                className="flex w-full items-center gap-1.5 py-[3px] pr-2 text-left hover:bg-muted"
              >
                <ChevronRight className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
                {open ? <FolderOpen className="size-4 shrink-0 text-primary/80" /> : <Folder className="size-4 shrink-0 text-primary/80" />}
                <span className="truncate">{baseName(item.path)}</span>
              </button>
              {open ? (
                <div role="group">
                  <TreeLevel
                    dir={item.path}
                    depth={depth + 1}
                    index={index}
                    expanded={expanded}
                    activePath={activePath}
                    onToggle={onToggle}
                    onSelect={onSelect}
                  />
                </div>
              ) : null}
            </div>
          );
        }
        const active = item.path === activePath;
        return (
          <button
            key={item.path}
            role="treeitem"
            aria-selected={active}
            data-path={item.path}
            onClick={() => onSelect(item.path)}
            style={{ paddingLeft: 8 + depth * 14 + 18 }}
            className={cn(
              "flex w-full items-center gap-1.5 py-[3px] pr-2 text-left",
              active ? "bg-accent font-medium text-accent-foreground" : "hover:bg-muted",
            )}
          >
            <FileIcon path={item.path} />
            <span className="truncate">{baseName(item.path)}</span>
          </button>
        );
      })}
    </>
  );
});

function TreeSkeleton() {
  const widths = [60, 45, 70, 50, 38, 64, 55, 42, 68, 48, 58, 36];
  return (
    <div className="space-y-2 px-3 py-2" aria-busy="true" aria-label="Loading files">
      {widths.map((w, i) => (
        <div key={i} className="flex items-center gap-2" style={{ paddingLeft: i % 3 === 0 ? 0 : 16 }}>
          <Skeleton className="size-4" />
          <Skeleton className="h-3.5" style={{ width: `${w}%` }} />
        </div>
      ))}
    </div>
  );
}
