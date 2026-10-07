import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { GitHubError } from "@/lib/github/client";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public headers?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiErrorBody = { error: { code: string; message: string; resetAt?: string } };

export function errorResponse(err: unknown): NextResponse<ApiErrorBody> {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status, headers: err.headers });
  }
  if (err instanceof ZodError) {
    const message = err.issues[0]?.message ?? "Invalid request";
    return NextResponse.json({ error: { code: "BAD_REQUEST", message } }, { status: 400 });
  }
  if (err instanceof GitHubError) {
    const status = { NOT_FOUND: 404, RATE_LIMITED: 429, FORBIDDEN: 403, UPSTREAM: 502, UNAVAILABLE: 503 }[err.code];
    return NextResponse.json(
      { error: { code: `GITHUB_${err.code}`, message: err.message, resetAt: err.resetAt?.toISOString() } },
      { status },
    );
  }
  console.error("[api] unhandled error", err);
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Something went wrong on our side. Please try again." } },
    { status: 500 },
  );
}

/** Wraps a route handler so every thrown error becomes a consistent JSON response. */
export function handler<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/**
 * CSRF defence for state-changing requests: browsers always send Origin on
 * cross-site POST/PATCH/DELETE, so reject any request whose Origin is not ours.
 */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return; // Same-origin fetches from some browsers and non-browser clients omit it; auth still applies.
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, "FORBIDDEN", "Cross-site request blocked.");
  }
  if (!host || originHost !== host) throw new ApiError(403, "FORBIDDEN", "Cross-site request blocked.");
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}
