"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, Loader2, Search } from "lucide-react";
import { parseGitHubUrl } from "@/lib/github/parse-url";
import { cn } from "@/lib/utils";

/** Turns any GitHub URL (or owner/repo) into a workspace URL. */
export function workspaceHref(input: string): string | null {
  const parsed = parseGitHubUrl(input);
  if (!parsed) return null;
  const base = `/r/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`;
  const params = new URLSearchParams();
  if (parsed.refAndPath?.length) params.set("at", parsed.refAndPath.join("/"));
  if (parsed.kind) params.set("kind", parsed.kind);
  const hash = parsed.line ? `#L${parsed.line}${parsed.lineEnd ? `-L${parsed.lineEnd}` : ""}` : "";
  // The ?at= form is canonicalised by a server redirect, which can't see the
  // URL hash, so carry the line range in the query for that hop.
  if (hash && params.has("at")) params.set("L", hash.slice(1));
  const qs = params.toString();
  return `${base}${qs ? `?${qs}` : ""}${hash}`;
}

export function RepoSearch({ size = "lg", autoFocus, className }: { size?: "lg" | "sm"; autoFocus?: boolean; className?: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) {
      setError("Paste a GitHub repository URL to get started.");
      return;
    }
    const href = workspaceHref(value);
    if (!href) {
      setError("That doesn't look like a GitHub repository. Try github.com/owner/repo.");
      return;
    }
    setError(null);
    startTransition(() => router.push(href));
  }

  const large = size === "lg";
  return (
    <form onSubmit={submit} className={cn("w-full", className)} noValidate>
      <div
        className={cn(
          "group flex items-center gap-2 rounded-xl border bg-card transition-shadow focus-within:ring-2 focus-within:ring-ring/50",
          error ? "border-destructive/70" : "border-border",
          large ? "h-14 pl-4 pr-2 shadow-lg shadow-primary/5" : "h-9 pl-3 pr-1",
        )}
      >
        <Search className={cn("shrink-0 text-muted-foreground", large ? "size-5" : "size-4")} />
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          autoFocus={autoFocus}
          spellCheck={false}
          autoComplete="off"
          aria-label="GitHub repository URL"
          aria-invalid={!!error}
          aria-describedby={error ? "repo-search-error" : undefined}
          placeholder={large ? "Paste a GitHub URL, e.g. github.com/vercel/next.js" : "Open another repository…"}
          className={cn("min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground/70", large ? "text-base" : "text-sm")}
        />
        <button
          type="submit"
          disabled={pending}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-70",
            large ? "h-10 px-4 text-sm" : "h-7 px-2.5 text-xs",
          )}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : large ? <>Explore <ArrowRight className="size-4" /></> : "Go"}
        </button>
      </div>
      {error ? (
        <p id="repo-search-error" role="alert" className={cn("mt-2 text-destructive", large ? "text-sm" : "text-xs")}>
          {error}
        </p>
      ) : null}
    </form>
  );
}
