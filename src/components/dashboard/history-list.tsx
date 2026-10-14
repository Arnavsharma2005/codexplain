"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, Link2, Link2Off, Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import { ApiClientError, apiGet, apiSend } from "@/lib/api-client";
import type { AnalysisModeKey } from "@/lib/api-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
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

const MODE_LABEL: Record<AnalysisModeKey, string> = { OVERVIEW: "Overview", DEEP_DIVE: "Deep dive", REVIEW: "Code review" };
const UNDO_MS = 5000;

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
  /** Removals waiting out their Undo window: analysis id → commit. */
  const pendingRemovals = useRef(new Map<string, () => void>());

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  // First page for the current search; stale responses are dropped via abort.
  useEffect(() => {
    const ctrl = new AbortController();
    fetchPage(debounced, null, ctrl.signal)
      .then((res) => {
        setItems(res.items.filter((i) => !pendingRemovals.current.has(i.id)));
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

  // Removals still inside their Undo window are sent when the page goes away.
  useEffect(() => {
    const pending = pendingRemovals.current;
    function flush() {
      for (const id of pending.keys()) {
        void fetch(`/api/analyses/${id}`, { method: "DELETE", keepalive: true }).catch(() => undefined);
      }
      pending.clear();
    }
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

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

  function remove(item: Item) {
    const index = items.findIndex((i) => i.viewId === item.viewId);
    setItems((prev) => prev.filter((i) => i.viewId !== item.viewId));
    let settled = false;
    const commit = () => {
      if (settled) return;
      settled = true;
      pendingRemovals.current.delete(item.id);
      apiSend(`/api/analyses/${item.id}`, "DELETE").catch(() => {
        toast.error("Couldn't remove it. Please try again.");
        reload();
      });
    };
    pendingRemovals.current.set(item.id, commit);
    toast("Removed from history", {
      duration: UNDO_MS,
      action: {
        label: "Undo",
        onClick: () => {
          if (settled) return;
          settled = true;
          pendingRemovals.current.delete(item.id);
          setItems((prev) => {
            if (prev.some((i) => i.viewId === item.viewId)) return prev;
            const next = [...prev];
            next.splice(Math.min(index, next.length), 0, item);
            return next;
          });
        },
      },
      onAutoClose: commit,
      onDismiss: commit,
    });
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
        toast.success("Share link copied", { description: <span className="font-mono">{url}</span> });
      }
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Something went wrong.");
    }
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by repository or file path"
        aria-label="Search history"
        className="h-10 w-full border-2 border-ink bg-paper-raised px-3 text-[15px] text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
      />

      <div className="mt-4">
        {loading ? (
          <div className="ruled-list" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2 py-4 pl-10">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-2.5 w-1/4" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-wrap items-center gap-3 border-t-2 border-ink py-4">
            <AlertTriangle className="size-4 text-danger" aria-hidden />
            <p>{error}</p>
            <Button variant="secondary" size="sm" onClick={reload}>
              Retry
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="border-t-2 border-ink">
            <EmptyState
              title={debounced ? "No analyses match your search" : "No analyses yet"}
              action={
                !debounced ? (
                  <Button asChild variant="secondary">
                    <Link href="/r/vercel/next.js">Try a sample repository</Link>
                  </Button>
                ) : null
              }
            >
              {debounced ? "Try a different repository or file name." : "Open a repository, pick a file and generate your first analysis."}
            </EmptyState>
          </div>
        ) : (
          <ol className="ruled-list">
            {items.map((item, i) => {
              const href = `/r/${item.owner}/${item.repo}?${new URLSearchParams({ ref: item.ref, path: item.path })}`;
              return (
                <li key={item.viewId} className="row-hover relative grid grid-cols-[40px_minmax(0,1fr)_32px] gap-x-1 py-4">
                  <span aria-hidden className="font-mono text-[13px] leading-5 text-label tabular">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    {/* The link's children stay inline spans so its accessible name has no spaces. */}
                    <Link href={href} className="row-link row-name block truncate font-mono text-[15px] leading-5">
                      <span className="text-ink-muted">
                        {item.owner}/{item.repo}/
                      </span>
                      <span className="text-ink">{item.path}</span>
                    </Link>
                    <p className="mt-1 line-clamp-2 text-[15px] leading-[22px] text-ink-muted">{item.preview}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="caption">{MODE_LABEL[item.mode]}</span>
                      {item.shareSlug ? <Badge variant="shared">Shared</Badge> : null}
                      <span className="meta">{timeAgo(item.updatedAt)}</span>
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
                          <a href={`/a/${item.shareSlug}`} target="_blank" rel="noreferrer">
                            <Link2 /> Open shared page
                          </a>
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem onSelect={() => void toggleShare(item)}>
                        {item.shareSlug ? (
                          <>
                            <Link2Off /> Revoke share link
                          </>
                        ) : (
                          <>
                            <Link2 /> Create share link
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => remove(item)} className="text-danger [&_svg]:!text-danger">
                        <Trash2 /> Remove from history
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {cursor && !loading ? (
        <div className="mt-4">
          <Button variant="secondary" size="sm" disabled={loadingMore} aria-busy={loadingMore || undefined} onClick={() => void loadMore()}>
            {loadingMore ? <Loader2 className="motion-safe:animate-spin" /> : null} Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
