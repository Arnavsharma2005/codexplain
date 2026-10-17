import "server-only";
import {
  ApiError as GenAIApiError,
  FunctionCallingConfigMode,
  GoogleGenAI,
  ThinkingLevel,
  type Content,
  type Part,
} from "@google/genai";
import { env } from "@/lib/env";
import { isTransientStatus, planAttempts, withModelRetries } from "@/lib/analysis/retry";
import { ModelBusyError } from "@/lib/analysis/model";
import { extractCitations, type Citation } from "./citations";
import { loadGraph, overview } from "./repo-index";
import { hybridSearch } from "./search";
import { runTool, toolDefinitions } from "./tools";

export type AgentEvent =
  | { type: "step"; label: string }
  | { type: "delta"; text: string }
  | { type: "done"; model: string; steps: number; citations: Citation[]; invalidCitations: number; retrieval: "hybrid" | "keyword" };

export type AgentTurn = { role: "user" | "assistant"; text: string };

let client: GoogleGenAI | null = null;
function getClient() {
  const { GEMINI_API_KEY, GEMINI_BASE_URL } = env();
  client ??= new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
    httpOptions: { timeout: 120_000, ...(GEMINI_BASE_URL ? { baseUrl: GEMINI_BASE_URL } : {}) },
  });
  return client;
}

/** Tool rounds before the model must answer. Pre-retrieval means most questions need 0–2. */
const MAX_ROUNDS = 5;

function systemPrompt(repo: string, sha: string) {
  return `You are Codexplain, a senior engineer answering questions about the GitHub repository ${repo} at commit ${sha.slice(0, 12)}.

You can call tools that search and read the indexed code. The user's message already includes the top search results for their question; call tools only when they are not enough.

Rules:
- Ground every claim in code you have seen. Cite it inline as [path:Lstart-Lend] using exact repository paths, e.g. [src/lib/auth.ts:L12-L30]. Cite a whole file as [path].
- If the code you saw does not answer the question, say so plainly and say what you checked. Never invent files, functions or behaviour.
- For "what breaks if I change X" questions use impact_of_change.
- Answer in GitHub-flavoured Markdown. Lead with the answer, then the explanation. Keep it tight: short paragraphs, bullets, and small code excerpts only when they help.`;
}

function contextBlock(hits: Awaited<ReturnType<typeof hybridSearch>>["hits"], ov: ReturnType<typeof overview>) {
  const central = ov.central.map((c) => `${c.path} (${c.dependents} files depend on it)`).join(", ");
  const snippets = hits
    .map((h) => `--- ${h.path}:L${h.startLine}-L${h.endLine}${h.symbols.length ? ` (defines ${h.symbols.join(", ")})` : ""}\n${h.text.slice(0, 3000)}`)
    .join("\n\n");
  return `Repository: ${ov.files} indexed files, ${ov.edges} import edges. Languages: ${ov.languages.map((l) => l.language).join(", ")}.
Most central files: ${central}.

Top search results for the question:
${snippets || "(no matches)"}`;
}

/**
 * Answers a question about an indexed repository with a tool-using Gemini
 * agent. Streams each tool step and the answer, then reports which
 * citations point at real indexed files.
 */
export async function runAgent(
  params: { indexId: string; repo: string; sha: string; question: string; history: AgentTurn[] },
  onEvent: (e: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<{ text: string; model: string; inputTokens: number; outputTokens: number }> {
  const { GEMINI_MODEL, GEMINI_FALLBACK_MODEL } = env();
  const [graph, search] = await Promise.all([loadGraph(params.indexId), hybridSearch(params.indexId, params.question, { limit: 6 })]);
  onEvent({ type: "step", label: `Searched the index (${search.semantic ? "keyword + semantic" : "keyword"})` });

  const contents: Content[] = [];
  for (const turn of params.history.slice(-6)) {
    contents.push({ role: turn.role === "user" ? "user" : "model", parts: [{ text: turn.text.slice(0, 4000) }] });
  }
  contents.push({
    role: "user",
    parts: [{ text: `${contextBlock(search.hits, overview(graph))}\n\nQuestion: ${params.question}` }],
  });

  const functionDeclarations = toolDefinitions().map((t) => ({
    name: t.name,
    description: t.description,
    parametersJsonSchema: t.inputSchema,
  }));

  let answer = "";
  let model = GEMINI_MODEL;
  let inputTokens = 0;
  let outputTokens = 0;
  let steps = 0;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const lastRound = round === MAX_ROUNDS - 1;
    let roundText = "";
    let parts: Part[] = [];

    const attempt = async (m: string) => {
      model = m;
      roundText = "";
      parts = [];
      const stream = await getClient().models.generateContentStream({
        model: m,
        contents,
        config: {
          systemInstruction: systemPrompt(params.repo, params.sha),
          maxOutputTokens: 4096,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          tools: [{ functionDeclarations }],
          toolConfig: { functionCallingConfig: { mode: lastRound ? FunctionCallingConfigMode.NONE : FunctionCallingConfigMode.AUTO } },
          abortSignal: signal,
        },
      });
      for await (const chunk of stream) {
        for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
          // Keep every part (thought signatures included) so the next round can replay it.
          parts.push(part);
          if (part.text && !part.thought) {
            roundText += part.text;
            onEvent({ type: "delta", text: part.text });
          }
        }
        if (chunk.usageMetadata) {
          inputTokens += chunk.usageMetadata.promptTokenCount ?? 0;
          outputTokens += (chunk.usageMetadata.candidatesTokenCount ?? 0) + (chunk.usageMetadata.thoughtsTokenCount ?? 0);
        }
      }
    };

    try {
      await withModelRetries(planAttempts(GEMINI_MODEL, GEMINI_FALLBACK_MODEL), attempt, {
        isRetryable: (err) => err instanceof GenAIApiError && isTransientStatus(err.status),
        hasStreamed: () => answer.length + roundText.length > 0,
        signal,
      });
    } catch (err) {
      if (err instanceof GenAIApiError && isTransientStatus(err.status)) throw new ModelBusyError();
      throw err;
    }

    answer += roundText;
    const calls = parts.filter((p) => p.functionCall);
    if (!calls.length) break;

    contents.push({ role: "model", parts });
    const responses: Part[] = [];
    for (const { functionCall } of calls) {
      const name = functionCall!.name ?? "";
      const result = await runTool(params.indexId, name, functionCall!.args).catch((err) => {
        console.error("[intel] tool failed", { name, err });
        return { label: `${name} failed`, output: { error: "Tool failed" }, sources: [] };
      });
      steps++;
      onEvent({ type: "step", label: result.label });
      responses.push({ functionResponse: { id: functionCall!.id, name, response: { output: result.output } } });
    }
    contents.push({ role: "user", parts: responses });
    if (answer && !answer.endsWith("\n")) {
      answer += "\n\n";
      onEvent({ type: "delta", text: "\n\n" });
    }
  }

  const found = extractCitations(answer);
  const valid = found.filter((c) => graph.byPath.has(c.path));
  const unique = new Map(valid.map((c) => [`${c.path}:${c.startLine}-${c.endLine}`, { path: c.path, startLine: c.startLine, endLine: c.endLine }]));
  onEvent({
    type: "done",
    model,
    steps,
    citations: [...unique.values()],
    invalidCitations: found.length - valid.length,
    retrieval: search.semantic ? "hybrid" : "keyword",
  });
  return { text: answer, model, inputTokens, outputTokens };
}
