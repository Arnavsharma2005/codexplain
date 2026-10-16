import "server-only";
import { ApiError as GenAIApiError, GoogleGenAI } from "@google/genai";
import { env } from "@/lib/env";
import { EMBEDDING_DIMS, intelConfig } from "./config";

let client: GoogleGenAI | null = null;
function getClient() {
  const { GEMINI_API_KEY, GEMINI_BASE_URL } = env();
  client ??= new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
    httpOptions: { timeout: 60_000, ...(GEMINI_BASE_URL ? { baseUrl: GEMINI_BASE_URL } : {}) },
  });
  return client;
}

export const embeddingModel = () => intelConfig().GEMINI_EMBEDDING_MODEL;

/** The free tier ran out (429) or the model is down; callers degrade to keyword search. */
export class EmbeddingUnavailableError extends Error {
  constructor(public status?: number) {
    super("Embeddings are unavailable right now.");
    this.name = "EmbeddingUnavailableError";
  }
}

const BATCH = 100; // batchEmbedContents accepts at most 100 inputs per call

async function embedBatch(texts: string[], taskType: string): Promise<number[][]> {
  try {
    const res = await getClient().models.embedContent({
      model: embeddingModel(),
      contents: texts,
      config: { taskType, outputDimensionality: EMBEDDING_DIMS },
    });
    const vectors = res.embeddings?.map((e) => e.values ?? []) ?? [];
    if (vectors.length !== texts.length || vectors.some((v) => v.length !== EMBEDDING_DIMS)) {
      throw new EmbeddingUnavailableError();
    }
    return vectors;
  } catch (err) {
    if (err instanceof EmbeddingUnavailableError) throw err;
    // Quota, outages and network failures all degrade to keyword search rather than failing the caller.
    console.warn("[intel] embedding request failed", err instanceof GenAIApiError ? err.status : err);
    throw new EmbeddingUnavailableError(err instanceof GenAIApiError ? err.status : undefined);
  }
}

/**
 * Embeds documents in batches, reporting each finished batch. Stops at the
 * first quota or availability error and returns what it has, so a partly
 * embedded index still works (unembedded chunks are found by keyword search).
 */
export async function embedDocuments(
  texts: string[],
  onBatch: (start: number, vectors: number[][]) => Promise<void>,
): Promise<{ embedded: number; stoppedBy: EmbeddingUnavailableError | null }> {
  let embedded = 0;
  for (let i = 0; i < texts.length; i += BATCH) {
    try {
      const vectors = await embedBatch(texts.slice(i, i + BATCH), "RETRIEVAL_DOCUMENT");
      await onBatch(i, vectors);
      embedded += vectors.length;
    } catch (err) {
      if (err instanceof EmbeddingUnavailableError) return { embedded, stoppedBy: err };
      throw err;
    }
  }
  return { embedded, stoppedBy: null };
}

/** Embeds a search query, or returns null so search falls back to keywords alone. */
export async function embedQuery(query: string): Promise<number[] | null> {
  try {
    const [vector] = await embedBatch([query.slice(0, 2000)], "CODE_RETRIEVAL_QUERY");
    return vector;
  } catch (err) {
    if (err instanceof EmbeddingUnavailableError) return null;
    throw err;
  }
}

/** pgvector literal: "[0.1,0.2,...]". Values are finite numbers from the API, never user input. */
export function toVectorLiteral(v: number[]): string {
  return `[${v.map((x) => (Number.isFinite(x) ? x.toFixed(6) : "0")).join(",")}]`;
}
