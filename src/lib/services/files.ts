import "server-only";
import { getFile } from "@/lib/github/client";
import { highlight } from "@/lib/highlight";
import { detectLanguage } from "@/lib/languages";
import type { FileResponse } from "@/lib/api-types";

/** One file at a ref, highlighted, as the workspace shows it. Used by the file API and the workspace page. */
export async function loadFile(owner: string, repo: string, ref: string, path: string, token: string | null | undefined): Promise<FileResponse> {
  const file = await getFile(owner, repo, ref, path, { token });
  const language = detectLanguage(path);
  const html = file.content != null ? await highlight(file.content, language, { cacheKey: file.sha }) : null;
  return {
    path: file.path,
    sha: file.sha,
    size: file.size,
    language,
    htmlUrl: file.htmlUrl,
    lineCount: file.content != null ? file.content.replace(/\r?\n$/, "").split(/\r?\n/).length : 0,
    content: file.content,
    html,
    ...(file.reason ? { reason: file.reason } : {}),
  };
}
