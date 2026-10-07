import "server-only";
import { randomBytes } from "node:crypto";
import type { AnalysisMode } from "@prisma/client";
import { db } from "@/lib/db";

export async function findCachedAnalyses(repositoryId: string, path: string, fileSha: string) {
  return db.analysis.findMany({
    where: { repositoryId, path, fileSha },
    select: { id: true, mode: true, content: true, model: true, createdAt: true },
  });
}

export async function findCachedAnalysis(repositoryId: string, path: string, fileSha: string, mode: AnalysisMode) {
  return db.analysis.findUnique({
    where: { repositoryId_path_fileSha_mode: { repositoryId, path, fileSha, mode } },
  });
}

export async function saveAnalysis(input: {
  repositoryId: string;
  userId: string;
  path: string;
  ref: string;
  fileSha: string;
  language: string;
  mode: AnalysisMode;
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}) {
  const { repositoryId, path, fileSha, mode, userId, ...rest } = input;
  const data = {
    ref: rest.ref,
    language: rest.language,
    content: rest.content,
    model: rest.model,
    inputTokens: rest.inputTokens,
    outputTokens: rest.outputTokens,
    durationMs: rest.durationMs,
  };
  return db.analysis.upsert({
    where: { repositoryId_path_fileSha_mode: { repositoryId, path, fileSha, mode } },
    create: { repositoryId, path, fileSha, mode, createdById: userId, ...data },
    update: data,
  });
}

/** Adds (or bumps) an analysis in the user's history. */
export async function recordAnalysisView(userId: string, analysisId: string) {
  return db.analysisView.upsert({
    where: { userId_analysisId: { userId, analysisId } },
    create: { userId, analysisId },
    update: { updatedAt: new Date() },
  });
}

export async function createShareLink(userId: string, analysisId: string) {
  const view = await db.analysisView.findUnique({ where: { userId_analysisId: { userId, analysisId } } });
  if (!view) return null;
  if (view.shareSlug) return view.shareSlug;
  // 16 random bytes → 22 url-safe chars; unguessable.
  const slug = randomBytes(16).toString("base64url");
  await db.analysisView.update({ where: { id: view.id }, data: { shareSlug: slug } });
  return slug;
}

export async function revokeShareLink(userId: string, analysisId: string) {
  await db.analysisView.updateMany({ where: { userId, analysisId }, data: { shareSlug: null } });
}

export async function getSharedAnalysis(slug: string) {
  return db.analysisView.findUnique({
    where: { shareSlug: slug },
    include: {
      analysis: { include: { repository: true } },
      user: { select: { name: true, githubLogin: true, image: true } },
    },
  });
}
