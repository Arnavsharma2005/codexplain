import type { RepoInfo, RepoRefs } from "@/lib/github/types";

export type RepoResponse = { repo: RepoInfo; refs: RepoRefs };

export type FileResponse = {
  path: string;
  sha: string;
  size: number;
  language: string;
  htmlUrl: string;
  lineCount: number;
  content: string | null;
  html: string | null;
  reason?: "binary" | "too_large";
};

export type AnalysisModeKey = "OVERVIEW" | "DEEP_DIVE" | "REVIEW";

export type CachedAnalysis = { id: string; content: string; model: string; createdAt: string };
export type CachedResponse = { analyses: Partial<Record<AnalysisModeKey, CachedAnalysis>> };

/** Newline-delimited JSON events streamed by POST /api/analyze. */
export type AnalyzeEvent =
  | { type: "meta"; cached: boolean; remaining: number | null }
  | { type: "delta"; text: string }
  | { type: "reset" }
  | { type: "done"; id: string; model: string; createdAt: string; truncated: boolean }
  | { type: "error"; code: string; message: string };

export type ApiErrorBody = { error: { code: string; message: string; resetAt?: string } };
