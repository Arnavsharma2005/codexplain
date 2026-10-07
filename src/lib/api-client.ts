import type { AnalyzeEvent, ApiErrorBody } from "@/lib/api-types";

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function toError(res: Response): Promise<ApiClientError> {
  let body: ApiErrorBody | null = null;
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    /* non-JSON error */
  }
  return new ApiClientError(
    res.status,
    body?.error.code ?? "HTTP_ERROR",
    body?.error.message ?? `Request failed (${res.status}). Please try again.`,
  );
}

export async function apiGet<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw await toError(res);
  return (await res.json()) as T;
}

export async function apiSend<T = unknown>(url: string, method: "POST" | "DELETE" | "PATCH", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** POSTs and yields newline-delimited JSON events as they arrive. */
export async function* streamNdjson(url: string, body: unknown, signal: AbortSignal): AsyncGenerator<AnalyzeEvent> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw await toError(res);
  if (!res.body) throw new ApiClientError(500, "NO_BODY", "The server returned an empty response.");

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) yield JSON.parse(line) as AnalyzeEvent;
    }
  }
  if (buffer.trim()) yield JSON.parse(buffer) as AnalyzeEvent;
}
