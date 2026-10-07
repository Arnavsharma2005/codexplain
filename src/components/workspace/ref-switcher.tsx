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
      <Popover.Trigger className="inline-flex h-8 max-w-56 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[13px] font-medium hover:bg-muted">
        {isTag ? <Tag className="size-3.5 shrink-0" /> : <GitBranch className="size-3.5 shrink-0" />}
        <span className="truncate">{current}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-72 overflow-hidden rounded-xl border border-border bg-card shadow-lg animate-fade-in"
        >
          <div className="border-b border-border p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={`Find a ${tab === "branches" ? "branch" : "tag"}…`}
              aria-label="Filter refs"
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
            <div className="mt-2 flex gap-1 text-xs">
              {(["branches", "tags"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "rounded-md px-2 py-1 font-medium capitalize",
                    tab === t ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t} <span className="text-muted-foreground">{t === "branches" ? refs.branches.length : refs.tags.length}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-72 overflow-auto p-1">
            {list.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">Nothing found.</p>
            ) : (
              list.map((r) => (
                <Popover.Item
                  key={r}
                  onSelect={() => r !== current && onSelect(r)}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] outline-none data-[highlighted]:bg-muted"
                >
                  <Check className={cn("size-3.5 shrink-0", r === current ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{r}</span>
                  {r === defaultBranch ? (
                    <span className="ml-auto rounded border border-border px-1 text-[10px] text-muted-foreground">default</span>
                  ) : null}
                </Popover.Item>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
