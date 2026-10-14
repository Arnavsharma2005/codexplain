"use client";

import { useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, GitBranch, Tag } from "lucide-react";
import type { RepoRefs } from "@/lib/github/types";
import { cn } from "@/lib/utils";

export function RefSwitcher({
  refs,
  current,
  defaultBranch,
  onSelect,
}: {
  refs: RepoRefs;
  current: string;
  defaultBranch: string;
  onSelect: (ref: string) => void;
}) {
  const [tab, setTab] = useState<"branches" | "tags">(refs.tags.includes(current) ? "tags" : "branches");
  const [query, setQuery] = useState("");
  const list = useMemo(() => {
    const items = tab === "branches" ? refs.branches : refs.tags;
    const q = query.toLowerCase();
    return items.filter((r) => r.toLowerCase().includes(q)).slice(0, 100);
  }, [refs, tab, query]);
  const isTag = refs.tags.includes(current);

  return (
    <Popover.Root onOpenChange={(open) => !open && setQuery("")}>
      <Popover.Trigger className="inline-flex h-8 max-w-32 shrink-0 cursor-pointer items-center gap-1.5 border-2 border-ink px-2 font-mono text-[13px] text-ink transition-colors duration-[120ms] hover:bg-paper-sunk sm:max-w-56 pointer-coarse:min-h-11">
        {isTag ? <Tag className="size-3.5 shrink-0" aria-hidden /> : <GitBranch className="size-3.5 shrink-0" aria-hidden />}
        <span className="truncate">{current}</span>
        <ChevronDown className="size-3.5 shrink-0 text-ink-muted" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className="z-50 w-72 max-w-[calc(100vw-24px)] border-2 border-ink bg-paper-raised text-ink">
          <div className="border-b border-hairline p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={`Find a ${tab === "branches" ? "branch" : "tag"}…`}
              aria-label="Filter refs"
              className="h-9 w-full border-2 border-ink bg-paper-raised px-2.5 font-mono text-[13px] outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
            />
            <div className="mt-2 flex gap-4">
              {(["branches", "tags"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  aria-pressed={tab === t}
                  className={cn(
                    "cursor-pointer border-b-[3px] pb-1 text-[13px] font-bold uppercase tracking-[.08em]",
                    tab === t ? "border-orange text-ink" : "border-transparent text-ink-muted hover:text-ink",
                  )}
                >
                  {t} <span className="font-mono font-normal tabular">{t === "branches" ? refs.branches.length : refs.tags.length}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-72 overflow-auto p-1">
            {list.length === 0 ? (
              <p className="meta px-3 py-4">Nothing found.</p>
            ) : (
              list.map((r) => (
                <Popover.Item
                  key={r}
                  onSelect={() => r !== current && onSelect(r)}
                  className="flex h-9 cursor-pointer items-center gap-2 px-3 font-mono text-[13px] outline-none data-[highlighted]:bg-paper-sunk pointer-coarse:h-11"
                >
                  <Check className={cn("size-3.5 shrink-0", r === current ? "opacity-100" : "opacity-0")} aria-hidden />
                  <span className="truncate">{r}</span>
                  {r === defaultBranch ? <span className="caption ml-auto">default</span> : null}
                </Popover.Item>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
