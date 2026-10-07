import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic({ apiKey: env().ANTHROPIC_API_KEY, maxRetries: 2, timeout: 5 * 60 * 1000 });
  return client;
}

export type AnalysisEvent =
  | { type: "delta"; text: string }
  // A safety decline was routed to a fallback model mid-stream; discard text received so far.
  | { type: "reset" };

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

/**
 * Streams an analysis from Claude. Uses server-side fallbacks so a safety
 * decline is retried on Anthropic's recommended fallback model in the same call.
 */
export async function streamAnalysis(
  params: { system: string; user: string; effort: "low" | "medium" | "high"; maxTokens: number },
  onEvent: (event: AnalysisEvent) => void,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  const stream = getClient().beta.messages.stream(
    {
      model: env().ANTHROPIC_MODEL,
      max_tokens: params.maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: params.effort },
      // Stable system prompt per mode → cacheable prefix across requests.
      system: [{ type: "text", text: params.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: params.user }],
    },
    { signal },
  );

  let text = "";
  for await (const event of stream) {
    if (event.type === "content_block_start" && event.content_block.type === "fallback") {
      text = "";
      onEvent({ type: "reset" });
    } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      text += event.delta.text;
      onEvent({ type: "delta", text: event.delta.text });
    }
  }

  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") throw new AnalysisRefusedError();

  return {
    text,
    model: final.model,
    inputTokens:
      final.usage.input_tokens +
      (final.usage.cache_read_input_tokens ?? 0) +
      (final.usage.cache_creation_input_tokens ?? 0),
    outputTokens: final.usage.output_tokens,
    truncated: final.stop_reason === "max_tokens",
  };
}
