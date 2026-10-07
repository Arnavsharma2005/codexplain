import "server-only";
import { ApiError as GenAIApiError, FinishReason, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { env } from "@/lib/env";

let client: GoogleGenAI | null = null;
function getClient() {
  const { GEMINI_API_KEY, GEMINI_BASE_URL } = env();
  client ??= new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
    httpOptions: { timeout: 5 * 60 * 1000, ...(GEMINI_BASE_URL ? { baseUrl: GEMINI_BASE_URL } : {}) },
  });
  return client;
}

export type AnalysisEvent = { type: "delta"; text: string };

export type AnalysisResult = {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  truncated: boolean;
};

export class AnalysisRefusedError extends Error {
  constructor() {
    super("The model declined to analyze this file.");
    this.name = "AnalysisRefusedError";
  }
}

/** The model provider is rate limiting us (the free tier allows only a few requests a minute). */
export class ModelBusyError extends Error {
  constructor() {
    super("The AI model is busy.");
    this.name = "ModelBusyError";
  }
}

const THINKING: Record<"low" | "medium" | "high", ThinkingLevel> = {
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

const BLOCKED = new Set<FinishReason | undefined>([
  FinishReason.SAFETY,
  FinishReason.RECITATION,
  FinishReason.BLOCKLIST,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.SPII,
]);

/** Streams an analysis from Gemini, forwarding answer text (never thoughts) as it arrives. */
export async function streamAnalysis(
  params: { system: string; user: string; effort: "low" | "medium" | "high"; maxTokens: number },
  onEvent: (event: AnalysisEvent) => void,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  const model = env().GEMINI_MODEL;
  let text = "";
  let finishReason: FinishReason | undefined;
  let modelVersion = model;
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const stream = await getClient().models.generateContentStream({
      model,
      contents: [{ role: "user", parts: [{ text: params.user }] }],
      config: {
        systemInstruction: params.system,
        maxOutputTokens: params.maxTokens,
        thinkingConfig: { thinkingLevel: THINKING[params.effort] },
        abortSignal: signal,
      },
    });

    for await (const chunk of stream) {
      if (chunk.promptFeedback?.blockReason) throw new AnalysisRefusedError();
      const candidate = chunk.candidates?.[0];
      for (const part of candidate?.content?.parts ?? []) {
        if (part.thought || !part.text) continue;
        text += part.text;
        onEvent({ type: "delta", text: part.text });
      }
      finishReason = candidate?.finishReason ?? finishReason;
      modelVersion = chunk.modelVersion ?? modelVersion;
      if (chunk.usageMetadata) {
        inputTokens = chunk.usageMetadata.promptTokenCount ?? inputTokens;
        outputTokens = (chunk.usageMetadata.candidatesTokenCount ?? 0) + (chunk.usageMetadata.thoughtsTokenCount ?? 0);
      }
    }
  } catch (err) {
    if (err instanceof GenAIApiError && err.status === 429) throw new ModelBusyError();
    throw err;
  }

  if (BLOCKED.has(finishReason)) throw new AnalysisRefusedError();

  return { text, model: modelVersion, inputTokens, outputTokens, truncated: finishReason === FinishReason.MAX_TOKENS };
}
