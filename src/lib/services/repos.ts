import "server-only";
import { db } from "@/lib/db";
import type { RepoInfo } from "@/lib/github/types";

/** Keeps a local copy of public repo metadata for history and dashboard views. */
export async function upsertRepository(info: RepoInfo) {
  const data = {
    description: info.description?.slice(0, 500) ?? null,
    defaultBranch: info.defaultBranch,
    stars: info.stars,
    language: info.language,
  };
  return db.repository.upsert({
    where: { owner_name: { owner: info.owner.toLowerCase(), name: info.name.toLowerCase() } },
    create: { owner: info.owner.toLowerCase(), name: info.name.toLowerCase(), ...data },
    update: data,
  });
}

export async function recordVisit(userId: string, info: RepoInfo) {
  const repo = await upsertRepository(info);
  await db.repoVisit.upsert({
    where: { userId_repositoryId: { userId, repositoryId: repo.id } },
    create: { userId, repositoryId: repo.id },
    update: { lastVisited: new Date(), visitCount: { increment: 1 } },
  });
  return repo;
}

export async function findRepository(owner: string, name: string) {
  return db.repository.findUnique({
    where: { owner_name: { owner: owner.toLowerCase(), name: name.toLowerCase() } },
  });
}
