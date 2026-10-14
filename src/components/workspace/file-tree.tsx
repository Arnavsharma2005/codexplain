"use client";

import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronRight, Folder, FolderOpen, X } from "lucide-react";
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
  /** The "Go to file" input, focused by the workspace's "/" shortcut. */
  inputRef?: React.RefObject<HTMLInputElement | null>;
  /** Escape in the filter: the workspace returns focus to where it was before "/". */
  onEscape?: () => void;
};

const MAX_RESULTS = 100;

export function FileTree({ entries, loading, error, truncated, activePath, revealDir, onSelect, onRetry, inputRef, onEscape }: Props) {
  const index = useMemo(() => (entries ? buildTreeIndex(entries) : null), [entries]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const ownInputRef = useRef<HTMLInputElement>(null);
  const filterRef = inputRef ?? ownInputRef;
  const listRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

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
      if (onEscape) onEscape();
      else e.currentTarget.blur();
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

  const optionId = (i: number) => `${listboxId}-opt-${i}`;
  const showingResults = !!results && results.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-hairline p-3">
        <div className="relative">
          <input
            ref={filterRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={onFilterKey}
            placeholder="Go to file"
            aria-label="Filter files"
            role="combobox"
            aria-expanded={showingResults}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={showingResults ? optionId(cursor) : undefined}
            disabled={!index}
            className="h-9 w-full border-2 border-ink bg-paper-raised pl-3 pr-9 font-mono text-[13px] text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
          />
          {query ? (
            <button
              aria-label="Clear filter"
              onClick={() => setQuery("")}
              className="absolute right-1 top-1/2 inline-flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center text-ink-muted hover:text-ink pointer-coarse:size-11"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : (
            <Kbd className="absolute right-2 top-1/2 -translate-y-1/2" aria-hidden>
              /
            </Kbd>
          )}
        </div>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-auto py-1">
        {loading ? (
          <TreeSkeleton />
        ) : error ? (
          <div className="px-4 py-6">
            <p className="flex items-start gap-2 text-ink">
              <AlertTriangle className="mt-1 size-4 shrink-0 text-danger" aria-hidden />
              {error}
            </p>
            <Button size="sm" variant="secondary" className="mt-4" onClick={onRetry}>
              Retry
            </Button>
          </div>
        ) : results ? (
          results.length === 0 ? (
            <p className="meta px-4 py-6">No files match “{query}”.</p>
          ) : (
            <div id={listboxId} role="listbox" aria-label="Matching files">
              {results.map((path, i) => (
                <div
                  key={path}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === cursor}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSelect(path);
                    setQuery("");
                  }}
                  onMouseEnter={() => setCursor(i)}
                  className={cn("tree-row pl-3")}
                >
                  <FileIcon path={path} />
                  <span className="min-w-0 truncate">
                    <span>{baseName(path)}</span>
                    <span className="ml-2 text-ink-muted">{path.slice(0, -baseName(path).length - 1)}</span>
                  </span>
                </div>
              ))}
            </div>
          )
        ) : index ? (
          <div role="tree" aria-label="Repository files">
            <TreeLevel dir="" depth={0} index={index} expanded={expanded} activePath={activePath} onToggle={toggle} onSelect={onSelect} />
          </div>
        ) : (
          <div role="tree" aria-label="Repository files" />
        )}
      </div>

      {truncated ? (
        <p className="meta border-t border-hairline px-3 py-2 text-warning">
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
              <button onClick={() => onToggle(item.path)} style={pad} className="tree-row">
                <ChevronRight className={cn("size-3 shrink-0 text-ink-muted motion-safe:transition-transform", open && "rotate-90")} aria-hidden />
                {open ? (
                  <FolderOpen className="size-4 shrink-0 text-ink-muted" aria-hidden />
                ) : (
                  <Folder className="size-4 shrink-0 text-ink-muted" aria-hidden />
                )}
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
            className="tree-row"
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
    <div className="px-3" aria-busy="true" aria-label="Loading files">
      {widths.map((w, i) => (
        <div key={i} className="flex h-8 items-center gap-2 pointer-coarse:h-11" style={{ paddingLeft: i % 3 === 0 ? 0 : 16 }}>
          <Skeleton className="size-3.5" />
          <Skeleton className="h-2.5" style={{ width: `${w}%` }} />
        </div>
      ))}
    </div>
  );
}
