import { getGitHubToken, getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getRepo } from "@/lib/github/client";
import { ApiError, assertSameOrigin, handler } from "@/lib/http";
import { searchParamsObject } from "@/lib/api-schemas";
import { rateLimit } from "@/lib/rate-limit";
import { upsertRepository, findRepository } from "@/lib/services/repos";
import { intelConfig } from "@/lib/intel/config";
import { resolveCommit } from "@/lib/intel/github";
import { buildIndex, claimIndex, type IndexProgress } from "@/lib/intel/indexer";
import { indexBodySchema, ndjsonStream, requireIntel, summarize, type IndexSummary } from "@/lib/intel/http";

// Indexing a mid-size repository takes 10–60s; allow the full Vercel limit.
export const maxDuration = 300;

export type IndexEvent =
  | ({ type: "progress" } & IndexProgress)
  | { type: "done"; index: IndexSummary; cached: boolean }
  | { type: "error"; message: string };

/** Status of the index for a ref's current commit, plus the newest older snapshot. */
export const GET = handler(async (req: Request) => {
  requireIntel();
  const { owner, repo, ref } = indexBodySchema.parse(searchParamsObject(req));
  const token = await getGitHubToken();
  const [sha, repository] = await Promise.all([resolveCommit(owner, repo, ref, token), findRepository(owner, repo)]);
  const [current, latest] = repository
    ? await Promise.all([
        db.intelIndex.findUnique({ where: { repositoryId_commitSha: { repositoryId: repository.id, commitSha: sha } } }),
        db.intelIndex.findFirst({ where: { repositoryId: repository.id, status: "READY" }, orderBy: { createdAt: "desc" } }),
      ])
    : [null, null];
  return Response.json(
    { commitSha: sha, current: current ? summarize(current) : null, latest: latest ? summarize(latest) : null },
    { headers: { "Cache-Control": "no-store" } },
  );
});

export const POST = handler(async (req: Request) => {
  requireIntel();
  assertSameOrigin(req);
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) throw new ApiError(401, "UNAUTHORIZED", "Sign in with GitHub to index a repository.");
  rateLimit(`intel-index:${userId}`, 3, 60_000);

  const { owner, repo, ref } = indexBodySchema.parse(await req.json().catch(() => ({})));
  const token = await getGitHubToken();
  const [info, sha] = await Promise.all([getRepo(owner, repo, { token }), resolveCommit(owner, repo, ref, token)]);
  const repository = await upsertRepository(info);

  const { index, fresh } = await claimIndex(repository.id, sha, ref, userId);
  if (!fresh) {
    return ndjsonStream<IndexEvent>(
      async (emit) => emit({ type: "done", index: summarize(index), cached: true }),
      () => ({ type: "error", message: "Something went wrong." }),
    );
  }

  // Count today's builds by this user (cached hits above are free).
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const built = await db.intelIndex.count({ where: { createdById: userId, createdAt: { gte: since } } });
  if (built > intelConfig().INTEL_DAILY_INDEX_LIMIT) {
    await db.intelIndex.delete({ where: { id: index.id } }).catch(() => undefined);
    throw new ApiError(429, "QUOTA_EXCEEDED", "You've reached today's indexing limit. Try again tomorrow.");
  }

  return ndjsonStream<IndexEvent>(
    async (emit) => {
      const done = await buildIndex(
        { indexId: index.id, repositoryId: repository.id, owner: info.owner, repo: info.name, sha, token },
        (p) => emit({ type: "progress", ...p }),
      );
      emit({ type: "done", index: summarize(done), cached: false });
    },
    (err) => ({
      type: "error",
      message: err instanceof ApiError || (err instanceof Error && err.name === "GitHubError") ? err.message : "Indexing failed. Please try again.",
    }),
  );
});
