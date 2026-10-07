import { getGitHubToken, getSession } from "@/lib/auth";
import { AnalysisRefusedError, streamAnalysis } from "@/lib/analysis/claude";
import { MODES, selectTreeContext, systemPrompt, userPrompt } from "@/lib/analysis/prompts";
import { analyzeBodySchema } from "@/lib/api-schemas";
import type { AnalyzeEvent } from "@/lib/api-types";
import { env } from "@/lib/env";
import { getFile, getRepo, getTree } from "@/lib/github/client";
import { ApiError, assertSameOrigin, handler } from "@/lib/http";
import { detectLanguage, languageLabel } from "@/lib/languages";
import { rateLimit } from "@/lib/rate-limit";
import { findCachedAnalysis, recordAnalysisView, saveAnalysis } from "@/lib/services/analyses";
import { refundAnalysis, reserveAnalysis } from "@/lib/services/quota";
import { upsertRepository } from "@/lib/services/repos";
import { formatBytes } from "@/lib/utils";

// Long analyses can take a while; allow up to 5 minutes on Vercel.
export const maxDuration = 300;

const TRUNCATION_NOTE =
  "\n\n> **Note:** this analysis reached its length limit and may be incomplete. Try the Overview mode for a shorter summary.";

function ndjson(events: AnalyzeEvent[]) {
  return events.map((e) => JSON.stringify(e)).join("\n") + "\n";
}

const STREAM_HEADERS = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) throw new ApiError(401, "UNAUTHORIZED", "Sign in with GitHub to generate analyses.");
  rateLimit(`analyze:${userId}`, 8, 60_000);

  const body = analyzeBodySchema.parse(await req.json().catch(() => ({})));
  const { owner, repo, ref, path, mode, force } = body;
  const token = await getGitHubToken();

  // Always re-read the file server-side: never trust code sent by the client.
  const [info, file] = await Promise.all([getRepo(owner, repo, { token }), getFile(owner, repo, ref, path, { token })]);
  if (file.content == null) {
    throw new ApiError(
      422,
      "NOT_ANALYZABLE",
      file.reason === "binary" ? "Binary files can't be analyzed." : "This file is too large to analyze.",
    );
  }
  const maxBytes = env().MAX_ANALYZABLE_BYTES;
  if (file.size > maxBytes) {
    throw new ApiError(422, "NOT_ANALYZABLE", `This file is ${formatBytes(file.size)}; the analysis limit is ${formatBytes(maxBytes)}.`);
  }
  if (!file.content.trim()) throw new ApiError(422, "NOT_ANALYZABLE", "This file is empty.");

  const repository = await upsertRepository(info);
  const encoder = new TextEncoder();

  // Cache hit: serve instantly and don't count it against the quota.
  if (!force) {
    const cached = await findCachedAnalysis(repository.id, file.path, file.sha, mode);
    if (cached) {
      await recordAnalysisView(userId, cached.id);
      return new Response(
        encoder.encode(
          ndjson([
            { type: "meta", cached: true, remaining: null },
            { type: "delta", text: cached.content },
            { type: "done", id: cached.id, model: cached.model, createdAt: cached.createdAt.toISOString(), truncated: false },
          ]),
        ),
        { headers: STREAM_HEADERS },
      );
    }
  }

  const remaining = await reserveAnalysis(userId);
  if (remaining === null) {
    throw new ApiError(
      429,
      "QUOTA_EXCEEDED",
      `You've used all ${env().DAILY_ANALYSIS_LIMIT} analyses for today. Your quota resets at midnight UTC.`,
    );
  }

  const tree = await getTree(owner, repo, ref, { token }).catch(() => null);
  const language = detectLanguage(file.path);
  const config = MODES[mode];
  const system = systemPrompt(mode);
  const user = userPrompt({
    owner: info.owner,
    repo: info.name,
    ref,
    path: file.path,
    language: languageLabel(language),
    description: info.description,
    content: file.content,
    treePaths: tree ? selectTreeContext(tree.entries.filter((e) => e.type === "blob").map((e) => e.path), file.path) : [],
    treeTruncated: tree?.truncated ?? false,
  });

  const upstream = new AbortController();
  req.signal.addEventListener("abort", () => upstream.abort(), { once: true });
  const startedAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: AnalyzeEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          closed = true; // client went away
        }
      };

      send({ type: "meta", cached: false, remaining });
      try {
        const result = await streamAnalysis(
          { system, user, effort: config.effort, maxTokens: config.maxTokens },
          (event) => send(event),
          upstream.signal,
        );
        if (!result.text.trim()) throw new Error("Empty analysis");

        let content = result.text;
        if (result.truncated) {
          content += TRUNCATION_NOTE;
          send({ type: "delta", text: TRUNCATION_NOTE });
        }
        const saved = await saveAnalysis({
          repositoryId: repository.id,
          userId,
          path: file.path,
          ref,
          fileSha: file.sha,
          language,
          mode,
          content,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          durationMs: Date.now() - startedAt,
        });
        await recordAnalysisView(userId, saved.id);
        send({ type: "done", id: saved.id, model: saved.model, createdAt: saved.createdAt.toISOString(), truncated: result.truncated });
      } catch (err) {
        await refundAnalysis(userId).catch(() => undefined);
        if (upstream.signal.aborted) {
          // Client cancelled; nothing to report.
        } else if (err instanceof AnalysisRefusedError) {
          send({ type: "error", code: "REFUSED", message: "This file couldn't be analyzed because it was flagged by a safety check." });
        } else {
          console.error("[analyze] failed", err);
          send({ type: "error", code: "ANALYSIS_FAILED", message: "The analysis failed. Your quota was not charged; please try again." });
        }
      } finally {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      }
    },
    cancel() {
      upstream.abort();
    },
  });

  return new Response(stream, { headers: STREAM_HEADERS });
});
