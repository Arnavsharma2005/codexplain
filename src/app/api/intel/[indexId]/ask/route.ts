import { getSession } from "@/lib/auth";
import { ModelBusyError } from "@/lib/analysis/model";
import { ApiError, assertSameOrigin, handler } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { refundAnalysis, reserveAnalysis } from "@/lib/services/quota";
import { runAgent, type AgentEvent } from "@/lib/intel/agent";
import { askBodySchema, ndjsonStream, readyIndex, requireIntel } from "@/lib/intel/http";

export const maxDuration = 300;

export type AskEvent = AgentEvent | { type: "meta"; remaining: number } | { type: "error"; message: string };

export const POST = handler(async (req: Request, ctx: RouteContext<"/api/intel/[indexId]/ask">) => {
  requireIntel();
  assertSameOrigin(req);
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) throw new ApiError(401, "UNAUTHORIZED", "Sign in with GitHub to ask questions.");
  rateLimit(`intel-ask:${userId}`, 6, 60_000);

  const { indexId } = await ctx.params;
  const index = await readyIndex(indexId);
  const { question, history } = askBodySchema.parse(await req.json().catch(() => ({})));

  // Questions share the daily AI allowance with file analyses.
  const remaining = await reserveAnalysis(userId);
  if (remaining === null) throw new ApiError(429, "QUOTA_EXCEEDED", "You've used today's AI allowance. It resets at midnight UTC.");

  return ndjsonStream<AskEvent>(
    async (emit) => {
      emit({ type: "meta", remaining });
      let produced = false;
      try {
        await runAgent(
          { indexId: index.id, repo: `${index.repository.owner}/${index.repository.name}`, sha: index.commitSha, question, history },
          (e) => {
            if (e.type === "delta") produced = true;
            emit(e);
          },
          req.signal,
        );
      } catch (err) {
        if (!produced) await refundAnalysis(userId).catch(() => undefined);
        throw err;
      }
    },
    (err) => {
      if (err instanceof ModelBusyError) return { type: "error", message: "The AI model is busy right now. Please try again in a minute." };
      console.error("[intel] ask failed", err);
      return { type: "error", message: "Something went wrong while answering. Please try again." };
    },
  );
});
