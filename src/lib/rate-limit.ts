import "server-only";
import { ApiError } from "@/lib/http";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

/**
 * Fixed-window limiter kept in memory. On serverless this is per instance, so it
 * is a burst guard against scripted abuse, not an accounting system. Expensive
 * operations (AI analysis) are additionally metered in Postgres per user.
 */
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (now - lastSweep > 60_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    lastSweep = now;
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  bucket.count++;
  if (bucket.count > limit) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    throw new ApiError(429, "RATE_LIMITED", "Too many requests. Please slow down for a moment.", {
      "Retry-After": String(retryAfter),
    });
  }
}
