import { describe, expect, it } from "vitest";
import { isTransientStatus, planAttempts, withModelRetries } from "@/lib/analysis/retry";

class StatusError extends Error {
  constructor(public status: number) {
    super(`status ${status}`);
  }
}

const opts = (streamed = false) => ({
  isRetryable: (err: unknown) => err instanceof StatusError && isTransientStatus(err.status),
  hasStreamed: () => streamed,
  sleep: async () => {},
});

describe("planAttempts", () => {
  it("retries the primary once, then falls back", () => {
    expect(planAttempts("a", "b").map((a) => a.model)).toEqual(["a", "a", "b"]);
  });

  it("skips a fallback that matches the primary", () => {
    expect(planAttempts("a", "a").map((a) => a.model)).toEqual(["a", "a"]);
  });
});

describe("withModelRetries", () => {
  it("falls back after repeated 503s", async () => {
    const tried: string[] = [];
    const result = await withModelRetries(planAttempts("a", "b"), async (model) => {
      tried.push(model);
      if (model === "a") throw new StatusError(503);
      return "ok";
    }, opts());
    expect(result).toBe("ok");
    expect(tried).toEqual(["a", "a", "b"]);
  });

  it("does not retry errors that are not transient", async () => {
    let calls = 0;
    await expect(withModelRetries(planAttempts("a", "b"), async () => {
      calls++;
      throw new StatusError(400);
    }, opts())).rejects.toThrow("status 400");
    expect(calls).toBe(1);
  });

  it("does not retry once text has been streamed", async () => {
    let calls = 0;
    await expect(withModelRetries(planAttempts("a", "b"), async () => {
      calls++;
      throw new StatusError(503);
    }, opts(true))).rejects.toThrow("status 503");
    expect(calls).toBe(1);
  });

  it("throws the last error when every attempt fails", async () => {
    await expect(withModelRetries(planAttempts("a", "b"), async () => {
      throw new StatusError(503);
    }, opts())).rejects.toThrow("status 503");
  });
});
