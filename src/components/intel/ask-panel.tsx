"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { RepoInfo } from "@/lib/github/types";
import type { IndexSummary } from "@/lib/intel/http";
import type { AskEvent } from "@/app/api/intel/[indexId]/ask/route";
import type { GraphResponse } from "@/app/api/intel/[indexId]/graph/route";
import { ApiClientError } from "@/lib/api-client";
import { linkCitations, type Citation } from "@/lib/intel/citations";
import { postNdjson, workspaceHref } from "@/lib/intel/client";
import { Button } from "@/components/ui/button";

type Turn = {
  question: string;
  answer: string;
  steps: string[];
  status: "streaming" | "done" | "error";
  error?: string;
  citations?: Citation[];
  invalid?: number;
  retrieval?: "hybrid" | "keyword";
};

type Props = {
  index: IndexSummary;
  repo: RepoInfo;
  graph: GraphResponse | null;
  signedIn: boolean;
  /** A question handed over from another tab; replaces the input when it changes. */
  draft: { text: string; at: number } | null;
};

export function AskPanel({ index, repo, graph, signedIn, draft }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const busy = turns.at(-1)?.status === "streaming";

  const [seenDraft, setSeenDraft] = useState(draft);
  if (draft !== seenDraft) {
    setSeenDraft(draft);
    if (draft) setQuestion(draft.text);
  }
  useEffect(() => {
    if (draft) input.current?.focus();
  }, [draft]);
  useEffect(() => () => abort.current?.abort(), []);

  const known = useMemo(() => new Set(graph?.files.map((f) => f.path) ?? []), [graph]);
  const suggestions = useMemo(() => {
    const central = graph?.overview.central[0]?.path;
    return [
      "Give me a tour: what does this project do and where should I start reading?",
      "How does a request flow through the code, end to end?",
      central ? `What would break if I changed ${central}?` : "Which files are the riskiest to change?",
      "Where is authentication or configuration handled?",
    ];
  }, [graph]);

  const update = (fn: (t: Turn) => Turn) => setTurns((ts) => [...ts.slice(0, -1), fn(ts[ts.length - 1])]);

  async function ask(q: string) {
    const text = q.trim();
    if (!text || busy) return;
    const history = turns
      .filter((t) => t.status === "done")
      .slice(-3)
      .flatMap((t) => [
        { role: "user" as const, text: t.question },
        { role: "assistant" as const, text: t.answer },
      ]);
    setQuestion("");
    setTurns((ts) => [...ts, { question: text, answer: "", steps: [], status: "streaming" }]);
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      for await (const e of postNdjson<AskEvent>(`/api/intel/${index.id}/ask`, { question: text, history }, ctrl.signal)) {
        if (e.type === "meta") setRemaining(e.remaining);
        else if (e.type === "step") update((t) => ({ ...t, steps: [...t.steps, e.label] }));
        else if (e.type === "delta") update((t) => ({ ...t, answer: t.answer + e.text }));
        else if (e.type === "done")
          update((t) => ({ ...t, status: "done", citations: e.citations, invalid: e.invalidCitations, retrieval: e.retrieval }));
        else if (e.type === "error") update((t) => ({ ...t, status: "error", error: e.message }));
      }
      update((t) => (t.status === "streaming" ? { ...t, status: "done" } : t));
    } catch (err) {
      if (ctrl.signal.aborted) return;
      const message = err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.";
      update((t) => ({ ...t, status: "error", error: message }));
    }
  }

  const href = (c: Citation) => workspaceHref(repo.owner, repo.name, index.commitSha, c.path, c.startLine, c.endLine);

  return (
    <div className="max-w-[820px]">
      {turns.length === 0 ? (
        <div>
          <h2 className="section-label marker-orange">
            Ask the codebase
          </h2>
          <p className="max-w-[60ch] text-ink-muted">
            An agent searches the index, reads files and walks the import graph, then answers with citations you can click
            through to the exact lines.
          </p>
          <ul className="ruled-list mt-5">
            {suggestions.map((s) => (
              <li key={s} className="border-b border-hairline">
                <button
                  type="button"
                  disabled={!signedIn}
                  onClick={() => ask(s)}
                  className="w-full py-3 text-left text-[16px] font-semibold transition-colors duration-[120ms] hover:bg-paper-sunk disabled:cursor-default disabled:hover:bg-transparent"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ol className="space-y-10">
        {turns.map((t, i) => (
          <li key={i} className="section-ruled">
            <p className="caption">Question {String(i + 1).padStart(2, "0")}</p>
            <h3 className="mt-1 text-[20px] font-bold leading-7">{t.question}</h3>
            {t.steps.length ? (
              <ul className="mt-3 space-y-0.5" aria-label="What the agent did">
                {t.steps.map((s, j) => (
                  <li key={j} className="meta flex items-baseline gap-2">
                    <span aria-hidden className="swatch marker-teal" />
                    <span className="font-mono text-[13px]">{s}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-4 bg-sheet px-5 py-4 dark:border dark:border-sheet-edge">
              {t.answer ? (
                <AnswerMarkdown
                  content={known.size ? linkCitations(t.answer, (p) => known.has(p), href) : t.answer}
                  streaming={t.status === "streaming"}
                />
              ) : t.status === "streaming" ? (
                <p className="meta">
                  Thinking<span className="streaming-caret" aria-hidden />
                </p>
              ) : null}
              {t.status === "error" ? (
                <p role="alert" className="mt-2 text-danger">
                  {t.error}
                </p>
              ) : null}
            </div>
            {t.status === "done" && t.citations ? (
              <p className="meta mt-2">
                {t.citations.length} verified citation{t.citations.length === 1 ? "" : "s"}
                {t.invalid ? ` · ${t.invalid} unverifiable left unlinked` : ""} ·{" "}
                {t.retrieval === "hybrid" ? "hybrid retrieval" : "keyword retrieval"}
              </p>
            ) : null}
          </li>
        ))}
      </ol>

      {signedIn ? (
        <form
          className="sticky bottom-0 mt-8 border-t-2 border-ink bg-paper py-4"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(question);
          }}
        >
          <label htmlFor="intel-question" className="caption">
            {turns.length ? "Follow-up question" : "Your question"}
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start">
            <textarea
              id="intel-question"
              ref={input}
              value={question}
              rows={2}
              maxLength={2000}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void ask(question);
                }
              }}
              placeholder="How does caching work here?"
              className="min-h-14 flex-1 resize-y border-2 border-ink bg-paper-raised px-3 py-2 text-[16px] leading-6 text-ink"
            />
            <Button type="submit" size="lg" disabled={busy || question.trim().length < 3}>
              Ask
            </Button>
          </div>
          {remaining !== null ? <p className="meta mt-2">{remaining} AI requests left today</p> : null}
        </form>
      ) : (
        <p className="mt-6 text-ink-muted">
          <Link href={`/login?callbackUrl=${encodeURIComponent(`/r/${repo.owner}/${repo.name}/intel`)}`} className="chrome-link">
            Sign in with GitHub
          </Link>{" "}
          to ask questions.
        </p>
      )}
    </div>
  );
}

const AnswerMarkdown = memo(function AnswerMarkdown({ content, streaming }: { content: string; streaming: boolean }) {
  return (
    <div className="prose-analysis">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children }) {
            if (href?.startsWith("/r/")) {
              return (
                <Link href={href} className="line-ref">
                  {children}
                </Link>
              );
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
      {streaming ? <span className="streaming-caret" aria-hidden /> : null}
    </div>
  );
});
