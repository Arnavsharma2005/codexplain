import "server-only";
import { z } from "zod";

// Kept apart from src/lib/env.ts so the feature can ship dark: with
// INTEL_ENABLED unset, every intel route and page answers 404.
const schema = z.object({
  INTEL_ENABLED: z
    .enum(["true", "false", "1", "0"])
    .default("false")
    .transform((v) => v === "true" || v === "1"),
  GEMINI_EMBEDDING_MODEL: z.string().min(1).default("gemini-embedding-001"),
  // Hard caps that keep one index inside a single serverless invocation and
  // inside the free Neon and Gemini quotas.
  INTEL_MAX_FILES: z.coerce.number().int().positive().default(2500),
  INTEL_MAX_TOTAL_BYTES: z.coerce.number().int().positive().default(20_000_000),
  INTEL_MAX_EMBEDDED_CHUNKS: z.coerce.number().int().nonnegative().default(1200),
  INTEL_DAILY_INDEX_LIMIT: z.coerce.number().int().positive().default(6),
});

export type IntelConfig = z.infer<typeof schema>;

let cached: IntelConfig | undefined;

export function intelConfig(): IntelConfig {
  cached ??= schema.parse(process.env);
  return cached;
}

export const intelEnabled = () => intelConfig().INTEL_ENABLED;

/** Dimensions requested from the embedding model; must match vector(768) in the schema. */
export const EMBEDDING_DIMS = 768;
