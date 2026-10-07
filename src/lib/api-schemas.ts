import { z } from "zod";
import { analysisModeSchema, ownerSchema, pathSchema, refSchema, repoNameSchema } from "@/lib/github/validation";

export const repoQuerySchema = z.object({ owner: ownerSchema, repo: repoNameSchema });
export const treeQuerySchema = repoQuerySchema.extend({ ref: refSchema });
export const fileQuerySchema = treeQuerySchema.extend({ path: pathSchema });

export const analyzeBodySchema = fileQuerySchema.extend({
  mode: analysisModeSchema,
  /** Regenerate even if a cached analysis exists. */
  force: z.boolean().optional().default(false),
});

export const cachedQuerySchema = fileQuerySchema.extend({ sha: z.string().regex(/^[0-9a-f]{40}$/) });

export const starBodySchema = repoQuerySchema.extend({ starred: z.boolean() });

export function searchParamsObject(req: Request) {
  return Object.fromEntries(new URL(req.url).searchParams);
}
