import { NextResponse } from "next/server";
import { getGitHubToken } from "@/lib/auth";
import { clientIp, handler } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { fileQuerySchema, searchParamsObject } from "@/lib/api-schemas";
import { loadFile } from "@/lib/services/files";

export const GET = handler(async (req: Request) => {
  rateLimit(`gh:${clientIp(req)}`, 120, 60_000);
  const { owner, repo, ref, path } = fileQuerySchema.parse(searchParamsObject(req));
  const body = await loadFile(owner, repo, ref, path, await getGitHubToken());
  return NextResponse.json(body, { headers: { "Cache-Control": "private, max-age=60" } });
});
