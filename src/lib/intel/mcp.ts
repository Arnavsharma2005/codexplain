import "server-only";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ownerSchema, refSchema, repoNameSchema } from "@/lib/github/validation";
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

/** Adds the repo/ref selector to each shared tool's JSON schema. */
function mcpTools() {
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
        "Read-only code intelligence for public GitHub repositories indexed on Codexplain: hybrid code search, file reads, symbol lookup, and change blast radius over the import graph. Start with repo_overview.",
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: mcpTools() }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
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
