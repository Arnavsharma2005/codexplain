import { NextResponse } from "next/server";
import { getGitHubToken } from "@/lib/auth";
import { getTree } from "@/lib/github/client";
import { clientIp, handler } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { searchParamsObject, treeQuerySchema } from "@/lib/api-schemas";

export const GET = handler(async (req: Request) => {
  rateLimit(`gh:${clientIp(req)}`, 120, 60_000);
  const { owner, repo, ref } = treeQuerySchema.parse(searchParamsObject(req));
  const tree = await getTree(owner, repo, ref, { token: await getGitHubToken() });
  return NextResponse.json(tree, { headers: { "Cache-Control": "private, max-age=60" } });
});
