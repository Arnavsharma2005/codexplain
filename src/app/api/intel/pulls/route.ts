import { getGitHubToken, getSession } from "@/lib/auth";
import { GitHubError, getRepo } from "@/lib/github/client";
import { ApiError, assertSameOrigin, handler } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { refundAnalysis, reserveAnalysis } from "@/lib/services/quota";
import { upsertRepository } from "@/lib/services/repos";
import { intelConfig } from "@/lib/intel/config";
import { getPull } from "@/lib/intel/github";
import { ndjsonStream, pullBodySchema, requireIntel } from "@/lib/intel/http";
import { claimWalkthrough, generateWalkthrough, releaseWalkthrough, tooLarge, type WalkProgress } from "@/lib/intel/pulls/walkthrough";

// The graph scan plus one long model call; allow the full Vercel limit.
export const maxDuration = 300;

export type PullWalkEvent =
  | ({ type: "progress" } & WalkProgress)
  | { type: "done"; cached: boolean; aiError: string | null }
  | { type: "error"; message: string };

/** Writes (or returns the saved) walkthrough for a pull request's current head commit. */
export const POST = handler(async (req: Request) => {
  requireIntel();
  assertSameOrigin(req);
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) throw new ApiError(401, "UNAUTHORIZED", "Sign in with GitHub to create a walkthrough.");
  rateLimit(`intel-pr:${userId}`, 3, 60_000);

  const { owner, repo, number } = pullBodySchema.parse(await req.json().catch(() => ({})));
  const token = await getGitHubToken();
  const [info, pull] = await Promise.all([getRepo(owner, repo, { token }), getPull(owner, repo, number, token, 0)]);
  // getRepo already refuses private repositories; the pull's base repo is checked too.
  if (pull.isPrivate) throw new GitHubError("NOT_FOUND", "Private repositories are not supported yet.");
  const max = intelConfig().INTEL_PR_MAX_FILES;
  if (pull.changedFiles > max) throw tooLarge(max);
  const repository = await upsertRepository(info);

  const claim = await claimWalkthrough(repository.id, pull, userId);
  if (!claim.fresh) {
    return ndjsonStream<PullWalkEvent>(
      async (emit) => emit({ type: "done", cached: true, aiError: null }),
      () => ({ type: "error", message: "Something went wrong." }),
    );
  }

  // Walkthroughs share the daily AI allowance with file analyses and questions.
  if ((await reserveAnalysis(userId)) === null) {
    await releaseWalkthrough(claim);
    throw new ApiError(429, "QUOTA_EXCEEDED", "You've used today's AI allowance. It resets at midnight UTC.");
  }

  return ndjsonStream<PullWalkEvent>(
    async (emit) => {
      try {
        const { walkthrough, aiFailed } = await generateWalkthrough(
          { id: claim.walkthrough.id, repositoryId: repository.id, owner: info.owner, repo: info.name, pull, token },
          (p) => emit({ type: "progress", ...p }),
        );
        if (aiFailed) await refundAnalysis(userId).catch(() => undefined);
        const data = walkthrough.data as { aiError?: string | null } | null;
        emit({ type: "done", cached: false, aiError: data?.aiError ?? null });
      } catch (err) {
        await refundAnalysis(userId).catch(() => undefined);
        // A failed retry keeps the earlier walkthrough (ordered, without summaries) on show.
        if (claim.previous?.status === "READY") await releaseWalkthrough(claim);
        throw err;
      }
    },
    (err) => ({
      type: "error",
      message:
        err instanceof ApiError || (err instanceof Error && err.name === "GitHubError")
          ? err.message
          : "The walkthrough failed. Please try again.",
    }),
  );
});
