import "server-only";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ownerSchema, refSchema, repoNameSchema } from "@/lib/github/validation";
import { pullNumberSchema } from "./http";
import { findWalkthroughs } from "./pulls/queries";
import type { WalkthroughData } from "./pulls/types";
import { findReadyIndex } from "./repo-index";
import { runTool, toolDefinitions } from "./tools";

const repoArgs = z.object({
  repo: z
    .string()
    .regex(/^[^/\s]+\/[^/\s]+$/, "Use the form owner/name")
    .transform((s) => s.split("/") as [string, string])
    .refine(([o, n]) => ownerSchema.safeParse(o).success && repoNameSchema.safeParse(n).success, "Invalid repository"),
  ref: refSchema.optional(),
});

const REPO_PROPS = {
  repo: { type: "string", description: "GitHub repository as owner/name. It must have been indexed on Codexplain." },
  ref: { type: "string", description: "Branch, tag or commit SHA. Defaults to the newest indexed snapshot." },
};

const WALK_TOOL = {
  name: "walk_pull_request",
  description:
    "Get the saved Codexplain walkthrough of a public pull request: its files grouped into layers in reading order (foundations first), a summary and review notes per layer, and how many files outside the PR depend on each layer. Walkthroughs are created on the Codexplain website; if none exists the result links to the page that creates it.",
  inputSchema: {
    type: "object" as const,
    properties: {
      repo: { type: "string", description: "GitHub repository as owner/name." },
      number: { type: "integer", description: "Pull request number." },
    },
    required: ["repo", "number"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
};

const walkArgs = z.object({ repo: repoArgs.shape.repo, number: pullNumberSchema });

async function walkPullRequest(args: Record<string, unknown>, baseUrl: string) {
  const sel = walkArgs.safeParse(args);
  if (!sel.success) return { isError: true, content: [{ type: "text", text: sel.error.issues[0]?.message ?? "Invalid arguments" }] };
  const [owner, name] = sel.data.repo;
  const { number } = sel.data;
  const url = `${baseUrl}/r/${owner}/${name}/pull/${number}`;
  const { latest } = await findWalkthroughs(owner, name, number, null);
  const data = latest?.data as WalkthroughData | null | undefined;
  if (!latest || !data) {
    return { isError: true, content: [{ type: "text", text: `${owner}/${name}#${number} has no walkthrough yet. Create it at ${url}` }] };
  }
  const payload = {
    pull_request: `${owner}/${name}#${number}`,
    title: latest.title,
    state: latest.state,
    head_commit: latest.headSha,
    url,
    review_risk: data.risk,
    story: data.story,
    files_outside_pr_affected: data.graphFiles ? data.blastTotal : null,
    layers: data.layers.map((l, k) => ({
      layer: k + 1,
      title: l.title,
      builds_on: l.after.map((a) => a + 1),
      files: l.files.map((i) => {
        const f = data.files[i];
        return { path: f.path, status: f.status, additions: f.additions, deletions: f.deletions };
      }),
      summary: l.summary,
      review_notes: l.notes.map((n) => ({ tone: n.tone, text: n.text, ...(n.ref ? { path: n.ref.path, lines: n.ref.start ? `L${n.ref.start}-L${n.ref.end}` : null } : {}) })),
      blast_radius: { files: l.blast.total, direct_dependents: l.blast.direct },
    })),
  };
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 1) }] };
}

/** Adds the repo/ref selector to each shared tool's JSON schema. */
function mcpTools() {
  return [...indexTools(), WALK_TOOL];
}

function indexTools() {
  return toolDefinitions().map((t) => {
    const schema = t.inputSchema as { properties?: Record<string, unknown>; required?: string[] };
    return {
      name: t.name,
      description: t.description,
      inputSchema: {
        type: "object" as const,
        properties: { ...REPO_PROPS, ...(schema.properties ?? {}) },
        required: ["repo", ...(schema.required ?? [])],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    };
  });
}

function buildServer(baseUrl: string) {
  const server = new Server(
    { name: "codexplain", version: "0.1.0" },
    {
      capabilities: { tools: {} },
      instructions:
        "Read-only code intelligence for public GitHub repositories indexed on Codexplain: hybrid code search, file reads, symbol lookup, and change blast radius over the import graph. Start with repo_overview. walk_pull_request returns a saved pull request walkthrough.",
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: mcpTools() }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    if (request.params.name === WALK_TOOL.name) return walkPullRequest(args, baseUrl);
    const sel = repoArgs.safeParse(args);
    if (!sel.success) return { isError: true, content: [{ type: "text", text: sel.error.issues[0]?.message ?? "Invalid repo" }] };
    const [owner, name] = sel.data.repo;
    const index = await findReadyIndex(owner, name, sel.data.ref);
    if (!index) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `${owner}/${name} has no index${sel.data.ref ? ` for ${sel.data.ref}` : ""} yet. Index it at ${baseUrl}/r/${owner}/${name}/intel`,
          },
        ],
      };
    }
    const toolArgs = Object.fromEntries(Object.entries(args).filter(([k]) => k !== "repo" && k !== "ref"));
    const result = await runTool(index.id, request.params.name, toolArgs);
    const payload = { repository: `${index.repository.owner}/${index.repository.name}`, commit: index.commitSha, ...((result.output as object) ?? {}) };
    const isError = typeof result.output === "object" && result.output !== null && "error" in result.output;
    return { isError, content: [{ type: "text", text: JSON.stringify(payload, null, 1) }] };
  });

  return server;
}

/** Stateless Streamable HTTP: every request gets a fresh server, so it scales like any other route. */
export async function handleMcp(req: Request, baseUrl: string): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  const server = buildServer(baseUrl);
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    // The JSON response is fully built by now; release the per-request server.
    void server.close();
  }
}
