import { NextResponse } from "next/server";
import { getGitHubToken, getSession } from "@/lib/auth";
import { getRefs, getRepo } from "@/lib/github/client";
import { clientIp, handler } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { repoQuerySchema, searchParamsObject } from "@/lib/api-schemas";
import { recordVisit } from "@/lib/services/repos";

export const GET = handler(async (req: Request) => {
  rateLimit(`gh:${clientIp(req)}`, 120, 60_000);
  const { owner, repo } = repoQuerySchema.parse(searchParamsObject(req));
  const token = await getGitHubToken();
  const [info, refs] = await Promise.all([getRepo(owner, repo, { token }), getRefs(owner, repo, { token })]);

  const session = await getSession();
  if (session?.user?.id) await recordVisit(session.user.id, info).catch(() => undefined);

  return NextResponse.json({ repo: info, refs });
});
