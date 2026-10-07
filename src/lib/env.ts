import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(32, "NEXTAUTH_SECRET must be at least 32 characters"),
  GITHUB_ID: z.string().min(1),
  GITHUB_SECRET: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-opus-5-5"),
  // Optional server token so signed-out visitors can browse public repos
  // without hitting GitHub's 60 requests/hour anonymous limit.
  GITHUB_SERVER_TOKEN: z.string().optional(),
  // Overridable for tests (pointed at a local mock server).
  GITHUB_API_URL: z.url().default("https://api.github.com"),
  DAILY_ANALYSIS_LIMIT: z.coerce.number().int().positive().default(25),
  MAX_ANALYZABLE_BYTES: z.coerce.number().int().positive().default(150_000),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Validated server environment. Throws a readable error on misconfiguration. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
