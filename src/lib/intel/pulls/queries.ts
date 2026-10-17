import "server-only";
import type { PrWalkthrough } from "@prisma/client";
import { db } from "@/lib/db";
import { findRepository } from "@/lib/services/repos";

/** A walkthrough stuck generating longer than this is treated as crashed and redone. */
export const STALE_MS = 6 * 60 * 1000;

/**
 * What the pull request page shows: the newest finished walkthrough (any head
 * commit) and the row for the current head, which may be generating or failed.
 */
export async function findWalkthroughs(owner: string, repo: string, number: number, headSha: string | null) {
  const repository = await findRepository(owner, repo);
  if (!repository) return { latest: null, current: null };
  const [latest, current] = await Promise.all([
    db.prWalkthrough.findFirst({ where: { repositoryId: repository.id, number, status: "READY" }, orderBy: { updatedAt: "desc" } }),
    headSha
      ? db.prWalkthrough.findUnique({ where: { repositoryId_number_headSha: { repositoryId: repository.id, number, headSha } } })
      : null,
  ]);
  return { latest, current };
}

export const isGenerating = (w: PrWalkthrough | null) => w?.status === "INDEXING" && Date.now() - w.updatedAt.getTime() < STALE_MS;

/** The latest finished walkthrough of each recently walked pull request, newest first. */
export async function recentWalkthroughs(take = 6) {
  return db.prWalkthrough.findMany({
    where: { status: "READY" },
    orderBy: { updatedAt: "desc" },
    distinct: ["repositoryId", "number"],
    take,
    select: {
      number: true,
      title: true,
      author: true,
      state: true,
      additions: true,
      deletions: true,
      changedFiles: true,
      updatedAt: true,
      repository: { select: { owner: true, name: true } },
    },
  });
}
