import "server-only";
import { z } from "zod";
import type { IntelIndex } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { ownerSchema, refSchema, repoNameSchema } from "@/lib/github/validation";
import { intelEnabled } from "./config";

/** Every intel route is invisible until the feature flag is on. */
export function requireIntel() {
  if (!intelEnabled()) throw new ApiError(404, "NOT_FOUND", "Not found.");
}

export const indexBodySchema = z.object({ owner: ownerSchema, repo: repoNameSchema, ref: refSchema });
export const indexIdSchema = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);
export const pullNumberSchema = z.coerce.number().int().positive().max(1_000_000_000);
export const pullBodySchema = z.object({ owner: ownerSchema, repo: repoNameSchema, number: pullNumberSchema });

export const askBodySchema = z.object({
  question: z.string().trim().min(3, "Ask a longer question.").max(2000, "Keep questions under 2,000 characters."),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(20_000) }))
    .max(12)
    .default([]),
});

export type IndexSummary = {
  id: string;
  status: IntelIndex["status"];
  ref: string;
  commitSha: string;
  error: string | null;
  fileCount: number;
  symbolCount: number;
  edgeCount: number;
  chunkCount: number;
  embeddedCount: number;
  skippedCount: number;
  durationMs: number;
  createdAt: string;
};

export function summarize(i: IntelIndex): IndexSummary {
  return {
    id: i.id,
    status: i.status,
    ref: i.ref,
    commitSha: i.commitSha,
    error: i.error,
    fileCount: i.fileCount,
    symbolCount: i.symbolCount,
    edgeCount: i.edgeCount,
    chunkCount: i.chunkCount,
    embeddedCount: i.embeddedCount,
    skippedCount: i.skippedCount,
    durationMs: i.durationMs,
    createdAt: i.createdAt.toISOString(),
  };
}

export async function readyIndex(indexId: string) {
  const index = await db.intelIndex.findUnique({
    where: { id: indexIdSchema.parse(indexId) },
    include: { repository: { select: { owner: true, name: true } } },
  });
  if (!index || index.status !== "READY") throw new ApiError(404, "NOT_FOUND", "That index doesn't exist or isn't ready yet.");
  return index;
}

export const NDJSON_HEADERS = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

/** Runs `work` while streaming each emitted event as one JSON line. Errors become a final error event. */
export function ndjsonStream<E>(work: (emit: (event: E) => void) => Promise<void>, onError: (err: unknown) => E): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const emit = (event: E) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          open = false; // client went away; keep working so the result is still saved
        }
      };
      try {
        await work(emit);
      } catch (err) {
        emit(onError(err));
      } finally {
        if (open) controller.close();
      }
    },
  });
  return new Response(stream, { headers: NDJSON_HEADERS });
}
