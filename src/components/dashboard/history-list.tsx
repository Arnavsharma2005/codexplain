"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Link2, Link2Off, Loader2, MoreHorizontal, Search, Sparkles, Trash2 } from "lucide-react";
import { ApiClientError, apiGet, apiSend } from "@/lib/api-client";
import type { AnalysisModeKey } from "@/lib/api-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileIcon } from "@/components/workspace/file-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { timeAgo } from "@/lib/utils";

type Item = {
  id: string;
  viewId: string;
  owner: string;
  repo: string;
  path: string;
  ref: string;
  mode: AnalysisModeKey;
  language: string | null;
  shareSlug: string | null;
  updatedAt: string;
  preview: string;
};

const MODE_LABEL: Record<AnalysisModeKey, string> = { OVERVIEW: "Overview", DEEP_DIVE: "Deep dive", REVIEW: "Review" };

async function fetchPage(q: string, after: string | null, signal?: AbortSignal) {
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (after) qs.set("cursor", after);
  return apiGet<{ items: Item[]; nextCursor: string | null }>(`/api/analyses?${qs}`, signal);
}

export function HistoryList() {
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const requestKey = `${debounced}#${reloadTick}`;
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  // First page for the current search; stale responses are dropped via abort.
  useEffect(() => {
    const ctrl = new AbortController();
    fetchPage(debounced, null, ctrl.signal)
      .then((res) => {
        setItems(res.items);
        setCursor(res.nextCursor);
        setError(null);
        setLoadedKey(requestKey);
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        setError(err instanceof ApiClientError ? err.message : "Couldn't load your history.");
        setLoadedKey(requestKey);
      });
    return () => ctrl.abort();
  }, [debounced, requestKey]);

  const reload = useCallback(() => setReloadTick((n) => n + 1), []);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const res = await fetchPage(debounced, cursor);
      setItems((prev) => [...prev, ...res.items]);
      setCursor(res.nextCursor);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Couldn't load more.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function remove(item: Item) {
    setItems((prev) => prev.filter((i) => i.viewId !== item.viewId));
    try {
      await apiSend(`/api/analyses/${item.id}`, "DELETE");
      toast.success("Removed from history");
    } catch {
      toast.error("Couldn't remove it. Please try again.");
      reload();
    }
  }

  async function toggleShare(item: Item) {
    try {
      if (item.shareSlug) {
        await apiSend(`/api/analyses/${item.id}/share`, "DELETE");
        setItems((prev) => prev.map((i) => (i.viewId === item.viewId ? { ...i, shareSlug: null } : i)));
        toast.success("Share link revoked");
      } else {
        const { slug, url } = await apiSend<{ slug: string; url: string }>(`/api/analyses/${item.id}/share`, "POST");
        setItems((prev) => prev.map((i) => (i.viewId === item.viewId ? { ...i, shareSlug: slug } : i)));
        await navigator.clipboard.writeText(url).catch(() => undefined);
        toast.success("Share link copied", { description: url });
      }
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="mt-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by repository or file path"
          aria-label="Search history"
          className="h-10 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      </div>

      <div className="mt-4 space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : error ? (
          <div className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
            {error}{" "}
            <button className="text-primary underline" onClick={reload}>
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-14 text-center">
            <Sparkles className="mx-auto size-6 text-primary" />
            <p className="mt-3 font-medium">{debounced ? "No analyses match your search" : "No analyses yet"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {debounced ? "Try a different repository or file name." : "Open a repository, pick a file and generate your first analysis."}
            </p>
            {!debounced ? (
              <Button asChild size="sm" className="mt-5">
                <Link href="/r/vercel/next.js">Try a sample repository</Link>
              </Button>
            ) : null}
          </div>
        ) : (
          items.map((item) => {
            const href = `/r/${item.owner}/${item.repo}?${new URLSearchParams({ ref: item.ref, path: item.path })}`;
            return (
              <div key={item.viewId} className="group relative rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50">
                <div className="flex items-start gap-3">
                  <FileIcon path={item.path} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <Link href={href} className="block truncate font-mono text-[13px] after:absolute after:inset-0">
                      <span className="text-muted-foreground">{item.owner}/{item.repo}/</span>
                      <span className="font-semibold">{item.path}</span>
                    </Link>
                    <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{item.preview}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{MODE_LABEL[item.mode]}</Badge>
                      {item.shareSlug ? <Badge variant="success"><Link2 /> Shared</Badge> : null}
                      <span>{timeAgo(item.updatedAt)}</span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" className="relative z-10" aria-label="More actions">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {item.shareSlug ? (
                        <DropdownMenuItem asChild>
                          <a href={`/a/${item.shareSlug}`} target="_blank" rel="noreferrer"><Link2 /> Open shared page</a>
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem onSelect={() => void toggleShare(item)}>
                        {item.shareSlug ? <><Link2Off /> Revoke share link</> : <><Link2 /> Create share link</>}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => void remove(item)} className="text-destructive">
                        <Trash2 className="!text-destructive" /> Remove from history
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })
        )}
      </div>

      {cursor && !loading ? (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore ? <Loader2 className="animate-spin" /> : null} Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
