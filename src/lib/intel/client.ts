import { ApiClientError } from "@/lib/api-client";

/** POSTs JSON and yields newline-delimited JSON events as they arrive. */
export async function* postNdjson<E>(url: string, body: unknown, signal?: AbortSignal): AsyncGenerator<E> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status}). Please try again.`;
    let code = "HTTP_ERROR";
    try {
      const err = (await res.json()) as { error?: { code: string; message: string } };
      if (err.error) ({ code, message } = err.error);
    } catch {
      /* non-JSON error */
    }
    throw new ApiClientError(res.status, code, message);
  }
  if (!res.body) throw new ApiClientError(500, "NO_BODY", "The server returned an empty response.");
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) yield JSON.parse(line) as E;
    }
  }
  if (buffer.trim()) yield JSON.parse(buffer) as E;
}

export function workspaceHref(owner: string, repo: string, sha: string, path: string, start?: number, end?: number) {
  const qs = new URLSearchParams({ ref: sha, path });
  const hash = start ? (end && end !== start ? `#L${start}-L${end}` : `#L${start}`) : "";
  return `/r/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}?${qs}${hash}`;
}
