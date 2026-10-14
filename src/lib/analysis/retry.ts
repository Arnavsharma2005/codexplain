/** HTTP statuses that mean the model provider is temporarily unavailable, not that our request is wrong. */
const TRANSIENT = new Set([429, 500, 502, 503, 504]);

export function isTransientStatus(status: number | undefined) {
  return status !== undefined && TRANSIENT.has(status);
}

export type Attempt = { model: string; delayMs: number };

/** Two tries on the primary model, then one on the fallback (skipped when it is the same model). */
export function planAttempts(primary: string, fallback: string | undefined): Attempt[] {
  const attempts: Attempt[] = [
    { model: primary, delayMs: 0 },
    { model: primary, delayMs: 1500 },
  ];
  if (fallback && fallback !== primary) attempts.push({ model: fallback, delayMs: 1500 });
  return attempts;
}

/**
 * Runs `run` against each planned model until one succeeds. Only retries while
 * nothing has been streamed to the client, since a half-sent answer can't be replayed.
 */
export async function withModelRetries<T>(
  attempts: Attempt[],
  run: (model: string) => Promise<T>,
  opts: { isRetryable: (err: unknown) => boolean; hasStreamed: () => boolean; signal?: AbortSignal; sleep?: (ms: number) => Promise<void> },
): Promise<T> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let lastError: unknown;
  for (const [i, attempt] of attempts.entries()) {
    if (i > 0) {
      if (opts.signal?.aborted || opts.hasStreamed() || !opts.isRetryable(lastError)) break;
      await sleep(attempt.delayMs);
    }
    try {
      return await run(attempt.model);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
