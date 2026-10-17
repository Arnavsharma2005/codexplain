import "server-only";
import { ApiError as GenAIApiError, FinishReason, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { Prisma, type PrWalkthrough } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/http";
import { detectLanguage } from "@/lib/languages";
import { ModelBusyError } from "@/lib/analysis/model";
import { isTransientStatus, planAttempts, withModelRetries } from "@/lib/analysis/retry";
import { intelConfig } from "../config";
import { listPullFiles, type PullInfo } from "../github";
import { parseSource } from "../parse";
import { resolveImport } from "../resolve";
import { scanRepository } from "../scan";
import { removedContent, trimPatch } from "./diff";
import { buildPrGraph, classifyFile, defaultLayers, finalizeLayers, heuristicRisk, readingLevels, totalBlast, type PrGraph } from "./layers";
import { SYSTEM_PROMPT, WALKTHROUGH_SCHEMA, parseWalkthrough, walkthroughPrompt, type ModelWalkthrough } from "./prompt";
import { STALE_MS } from "./queries";
import type { WalkFile, WalkLayer, WalkthroughData } from "./types";

export type WalkStage = "pull" | "download" | "parse" | "model" | "save";
export type WalkProgress = { stage: WalkStage; message: string; done?: number; total?: number };

/** Snapshots kept per pull request (one per head commit). */
const KEEP_PER_PR = 3;
/** Diff lines stored per file, and in total, so one row stays small. */
const MAX_PATCH_LINES = 800;
const MAX_GENERATED_LINES = 120;
const MAX_STORED_PATCH_CHARS = 1_500_000;

let client: GoogleGenAI | null = null;
function getClient() {
  const { GEMINI_API_KEY, GEMINI_BASE_URL } = env();
  client ??= new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
    httpOptions: { timeout: 4 * 60 * 1000, ...(GEMINI_BASE_URL ? { baseUrl: GEMINI_BASE_URL } : {}) },
  });
  return client;
}

const inProgress = () => new ApiError(409, "WALKTHROUGH_IN_PROGRESS", "This walkthrough is already being written. It will be ready shortly.");

/** Walkthroughs whose summaries failed can be written again; finished ones are served from the cache. */
const complete = (w: PrWalkthrough) => w.status === "READY" && !(w.data as WalkthroughData | null)?.aiError;

/**
 * Claims the (pull request, head commit) slot. Returns `fresh: false` with the
 * saved walkthrough when one already exists, so callers can answer instantly.
 */
export async function claimWalkthrough(repositoryId: string, pull: PullInfo, userId: string) {
  const where = { repositoryId_number_headSha: { repositoryId, number: pull.number, headSha: pull.headSha } };
  const existing = await db.prWalkthrough.findUnique({ where });
  if (existing && complete(existing)) return { walkthrough: existing, fresh: false, previous: existing };
  if (existing?.status === "INDEXING" && Date.now() - existing.updatedAt.getTime() < STALE_MS) throw inProgress();
  const meta = {
    baseSha: pull.baseSha,
    title: pull.title.slice(0, 300),
    author: pull.author,
    state: pull.state,
    additions: pull.additions,
    deletions: pull.deletions,
    changedFiles: pull.changedFiles,
    createdById: userId,
    status: "INDEXING" as const,
    error: null,
  };
  if (existing) {
    const walkthrough = await db.prWalkthrough.update({ where: { id: existing.id }, data: meta });
    return { walkthrough, fresh: true, previous: existing };
  }
  try {
    const walkthrough = await db.prWalkthrough.create({ data: { repositoryId, number: pull.number, headSha: pull.headSha, ...meta } });
    return { walkthrough, fresh: true, previous: null };
  } catch {
    // Lost a race with another request creating the same row.
    throw inProgress();
  }
}

/** Undoes a claim that will not be generated (the user is out of allowance). */
export async function releaseWalkthrough(claim: Awaited<ReturnType<typeof claimWalkthrough>>) {
  const { walkthrough, previous } = claim;
  await (previous
    ? db.prWalkthrough.update({ where: { id: walkthrough.id }, data: { status: previous.status, error: previous.error, createdById: previous.createdById } })
    : db.prWalkthrough.delete({ where: { id: walkthrough.id } })
  ).catch(() => undefined);
}

/**
 * Builds a walkthrough: fetches the diff, orders the files with the import
 * graph, asks Gemini for summaries, repairs its answer and saves the result.
 * When the model fails the walkthrough is still saved, ordered by the graph
 * alone, and `aiFailed` tells the caller to refund the user's allowance.
 */
export async function generateWalkthrough(
  params: { id: string; repositoryId: string; owner: string; repo: string; pull: PullInfo; token: string | null },
  onProgress: (p: WalkProgress) => void,
): Promise<{ walkthrough: PrWalkthrough; aiFailed: boolean }> {
  const started = Date.now();
  const { owner, repo, pull, token } = params;
  try {
    onProgress({ stage: "pull", message: "Reading the pull request" });
    const max = intelConfig().INTEL_PR_MAX_FILES;
    const raw = await listPullFiles(owner, repo, pull.number, token, max + 1);
    if (raw.length > max) throw tooLarge(max);
    if (!raw.length) throw new ApiError(422, "EMPTY_PULL", "This pull request has no changed files.");

    let stored = 0;
    const files: WalkFile[] = raw.map((f) => {
      const kind = classifyFile(f.path);
      let patch = f.patch;
      let truncated = false;
      if (patch) {
        const t = trimPatch(patch, kind === "generated" ? MAX_GENERATED_LINES : MAX_PATCH_LINES);
        truncated = t.truncated;
        patch = stored + t.patch.length > MAX_STORED_PATCH_CHARS ? null : t.patch;
        if (patch) stored += patch.length;
        else truncated = true;
      }
      return {
        path: f.path,
        ...(f.previousPath ? { previousPath: f.previousPath } : {}),
        status: f.status,
        kind,
        language: detectLanguage(f.path),
        additions: f.additions,
        deletions: f.deletions,
        patch,
        truncated,
        dependents: 0,
      };
    });

    const graph = await prGraph(params, raw, onProgress);
    if (graph) files.forEach((f, i) => (f.dependents = graph.dependents[i].size));
    const levels = graph ? readingLevels(graph.deps, (i) => files[i].kind === "source") : files.map(() => 0);
    const suggested = defaultLayers(files, graph);

    onProgress({ stage: "model", message: "Writing the walkthrough" });
    let ai: ModelWalkthrough | null = null;
    let aiError: string | null = null;
    let model: string | null = null;
    try {
      const out = await askModel(walkthroughPrompt({ repo: `${owner}/${repo}`, pull, files, graph, levels, suggested }));
      model = out.model;
      ai = parseWalkthrough(out.text, files);
      if (!ai) aiError = out.cut ? "The AI answer was cut short." : "The AI answer could not be read.";
    } catch (err) {
      aiError = err instanceof ModelBusyError ? "The AI model was busy." : "The AI step failed.";
      if (!(err instanceof ModelBusyError)) console.error("[intel] walkthrough model failed", { id: params.id, err });
    }

    onProgress({ stage: "save", message: "Saving" });
    const proposed = ai
      ? ai.layers.map((l) => ({ title: l.title, files: l.files }))
      : suggested.map((l) => ({ title: l.title, files: l.files.map((i) => files[i].path) }));
    const layers: WalkLayer[] = finalizeLayers(proposed, files, graph).map((l) => {
      const m = ai && l.source >= 0 ? ai.layers[l.source] : null;
      return {
        title: l.title,
        files: l.files,
        summary: m?.summary ?? null,
        impact: m?.impact ?? null,
        flow: m?.flow ?? null,
        notes: m?.notes ?? [],
        after: l.after,
        blast: l.blast,
      };
    });
    const blastTotal = totalBlast(graph);
    const data: WalkthroughData = {
      version: 1,
      story: ai?.story ?? null,
      risk: ai?.risk ?? heuristicRisk(files, blastTotal, graph?.graphFiles ?? 0),
      files,
      layers,
      blastTotal,
      graphFiles: graph?.graphFiles ?? 0,
      aiError,
    };
    const walkthrough = await db.prWalkthrough.update({
      where: { id: params.id },
      data: {
        status: "READY",
        error: null,
        model,
        data: data as unknown as Prisma.InputJsonValue,
        durationMs: Date.now() - started,
      },
    });
    await prune(params.repositoryId, pull.number);
    return { walkthrough, aiFailed: !ai };
  } catch (err) {
    const message = err instanceof Error && (err instanceof ApiError || err.name === "GitHubError") ? err.message : "The walkthrough failed.";
    console.error("[intel] walkthrough failed", { id: params.id, err });
    await db.prWalkthrough
      .update({ where: { id: params.id }, data: { status: "FAILED", error: message, durationMs: Date.now() - started } })
      .catch(() => undefined);
    throw err;
  }
}

export const tooLarge = (max: number) =>
  new ApiError(422, "PULL_TOO_LARGE", `This pull request changes more than ${max} files, which is more than a walkthrough can explain well.`);

/** The import graph at the head commit, projected onto the changed files. Null when it can't be built. */
async function prGraph(
  params: { owner: string; repo: string; pull: PullInfo; token: string | null },
  raw: Awaited<ReturnType<typeof listPullFiles>>,
  onProgress: (p: WalkProgress) => void,
): Promise<PrGraph | null> {
  try {
    const scan = await scanRepository({ owner: params.owner, repo: params.repo, sha: params.pull.headSha, token: params.token }, (p) =>
      onProgress({ ...p, message: p.stage === "download" ? "Downloading the head commit" : "Reading the import graph" }),
    );
    const prFiles = await Promise.all(
      raw.map(async (f) => {
        if (f.status !== "removed" || !f.patch) return { path: f.path };
        // A deleted file has no node at the head commit; follow what it used to import.
        const lang = detectLanguage(f.path);
        const parsed = await parseSource(lang, removedContent(f.patch)).catch(() => ({ imports: [] }));
        return { path: f.path, removedImports: parsed.imports.flatMap((spec) => resolveImport(scan.context, f.path, lang, spec)) };
      }),
    );
    return buildPrGraph(
      scan.files.map((f) => f.path),
      scan.edges,
      prFiles,
    );
  } catch (err) {
    console.warn("[intel] walkthrough graph unavailable", { pull: params.pull.number, err });
    return null;
  }
}

async function askModel(prompt: string): Promise<{ text: string; model: string; cut: boolean }> {
  const { GEMINI_MODEL, GEMINI_FALLBACK_MODEL } = env();
  const attempt = async (model: string) => {
    const res = await getClient().models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseJsonSchema: WALKTHROUGH_SCHEMA,
        maxOutputTokens: 24_000,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
    const candidate = res.candidates?.[0];
    const text = (candidate?.content?.parts ?? [])
      .filter((p) => p.text && !p.thought)
      .map((p) => p.text)
      .join("");
    return { text, model, cut: candidate?.finishReason === FinishReason.MAX_TOKENS };
  };
  try {
    return await withModelRetries(planAttempts(GEMINI_MODEL, GEMINI_FALLBACK_MODEL), attempt, {
      isRetryable: (err) => err instanceof GenAIApiError && isTransientStatus(err.status),
      hasStreamed: () => false,
    });
  } catch (err) {
    if (err instanceof GenAIApiError && isTransientStatus(err.status)) throw new ModelBusyError();
    throw err;
  }
}

async function prune(repositoryId: string, number: number) {
  const old = await db.prWalkthrough.findMany({
    where: { repositoryId, number, status: { not: "INDEXING" } },
    orderBy: { updatedAt: "desc" },
    skip: KEEP_PER_PR,
    select: { id: true },
  });
  if (old.length) await db.prWalkthrough.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
}
