"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
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

type Props = {
  size?: "lg" | "sm";
  /** "header": the 36px field in the site header. */
  variant?: "page" | "header";
  autoFocus?: boolean;
  hint?: boolean;
  className?: string;
};

export function RepoSearch({ size = "lg", variant = "page", autoFocus, hint, className }: Props) {
  const router = useRouter();
  const errorId = useId();
  const hintId = useId();
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
  const height = large ? "h-14" : variant === "header" ? "h-9" : "h-10";
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <form onSubmit={submit} className={cn("w-full", className)} noValidate>
      <div
        className={cn(
          "repo-field flex items-stretch border-2 bg-paper-raised",
          error ? "border-danger" : "border-ink",
          height,
        )}
      >
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
          aria-describedby={describedBy}
          placeholder={large ? "github.com/owner/repo" : "Open another repository…"}
          className={cn(
            "min-w-0 flex-1 bg-transparent font-medium text-ink outline-none focus-visible:outline-none",
            large ? "pl-4 text-[18px]" : "pl-3 text-[15px]",
          )}
        />
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending || undefined}
          className={cn(
            "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 bg-orange font-bold uppercase leading-none tracking-[.1em] text-on-orange transition-colors duration-[120ms] hover:bg-ink hover:text-paper disabled:opacity-70",
            large ? "min-w-[120px] px-5 text-[14px] max-[400px]:min-w-[96px] max-[400px]:px-3" : "min-w-12 px-3 text-[14px]",
          )}
        >
          {pending ? (
            <Loader2 className="size-4 motion-safe:animate-spin" aria-label="Opening" />
          ) : large ? (
            <>
              Explore <span aria-hidden>→</span>
            </>
          ) : (
            "Go"
          )}
        </button>
      </div>
      {hint ? (
        <p id={hintId} className="meta mt-2">
          Repository, branch, folder and file links all work.
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="mt-2 flex items-start gap-2 text-[14px] font-semibold text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </form>
  );
}
