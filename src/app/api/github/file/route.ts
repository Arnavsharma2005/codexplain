import { NextResponse } from "next/server";
import { getGitHubToken } from "@/lib/auth";
import { getFile } from "@/lib/github/client";
import { highlight } from "@/lib/highlight";
import { clientIp, handler } from "@/lib/http";
import { detectLanguage } from "@/lib/languages";
import { rateLimit } from "@/lib/rate-limit";
import { fileQuerySchema, searchParamsObject } from "@/lib/api-schemas";
import type { FileResponse } from "@/lib/api-types";


export const GET = handler(async (req: Request) => {
  rateLimit(`gh:${clientIp(req)}`, 120, 60_000);
  const { owner, repo, ref, path } = fileQuerySchema.parse(searchParamsObject(req));
  const file = await getFile(owner, repo, ref, path, { token: await getGitHubToken() });
  const language = detectLanguage(path);
  const html = file.content != null ? await highlight(file.content, language) : null;

  const body: FileResponse = {
    path: file.path,
    sha: file.sha,
    size: file.size,
    language,
    htmlUrl: file.htmlUrl,
    lineCount: file.content != null ? file.content.split("\n").length : 0,
    content: file.content,
    html,
    ...(file.reason ? { reason: file.reason } : {}),
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "private, max-age=60" } });
});
