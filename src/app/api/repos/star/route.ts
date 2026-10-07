import { NextResponse } from "next/server";
import { getGitHubToken, getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getRepo } from "@/lib/github/client";
import { ApiError, assertSameOrigin, handler } from "@/lib/http";
import { starBodySchema } from "@/lib/api-schemas";
import { recordVisit } from "@/lib/services/repos";

export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const session = await getSession();
  if (!session?.user?.id) throw new ApiError(401, "UNAUTHORIZED", "Sign in to save repositories.");
  const { owner, repo, starred } = starBodySchema.parse(await req.json());
  const info = await getRepo(owner, repo, { token: await getGitHubToken() });
  const repository = await recordVisit(session.user.id, info);
  await db.repoVisit.update({
    where: { userId_repositoryId: { userId: session.user.id, repositoryId: repository.id } },
    data: { starred },
  });
  return NextResponse.json({ starred });
});
