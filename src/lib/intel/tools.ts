import "server-only";
import { z } from "zod";
import { findSymbols, impactOf, loadGraph, overview, readLines } from "./repo-index";
import { hybridSearch } from "./search";

/**
 * The repository tools, defined once and shared by the Q&A agent (Gemini
 * function calling) and the MCP server, so both see the same capabilities.
 */

export type ToolSource = { path: string; startLine: number; endLine: number };
export type ToolResult = { output: unknown; sources: ToolSource[]; label: string };

const pathArg = z.string().min(1).max(500);

const defs = {
  search_code: {
    description:
      "Hybrid keyword + semantic search over the repository's code and docs. Returns the best matching snippets with file paths and line ranges. Use natural language or identifiers.",
    schema: z.object({
      query: z.string().min(1).max(500).describe("What to look for"),
      path_prefix: z.string().max(300).optional().describe("Only search under this directory, e.g. 'src/lib/'"),
    }),
  },
  read_file: {
    description: "Reads lines of a file in the repository (at most 400 lines per call), each prefixed with its line number.",
    schema: z.object({
      path: pathArg.describe("Repository-relative file path"),
      start_line: z.number().int().min(1).optional(),
      end_line: z.number().int().min(1).optional(),
    }),
  },
  find_symbol: {
    description: "Finds where functions, classes, methods, types or interfaces with this name (or name prefix) are defined.",
    schema: z.object({ name: z.string().min(1).max(200) }),
  },
  impact_of_change: {
    description:
      "Blast radius of changing a file: every file that imports it directly or transitively (with hop distance), and what it depends on.",
    schema: z.object({ path: pathArg }),
  },
  repo_overview: {
    description: "Size, languages, the most central files (the ones the most code transitively depends on) and any import cycles.",
    schema: z.object({}),
  },
} as const;

export type ToolName = keyof typeof defs;
export const TOOL_NAMES = Object.keys(defs) as ToolName[];

export function toolDefinitions() {
  return TOOL_NAMES.map((name) => ({
    name,
    description: defs[name].description,
    inputSchema: z.toJSONSchema(defs[name].schema, { target: "draft-7" }) as Record<string, unknown>,
  }));
}

const trim = (text: string, max = 2400) => (text.length > max ? `${text.slice(0, max)}\n…` : text);

export async function runTool(indexId: string, name: string, rawArgs: unknown): Promise<ToolResult> {
  if (!(name in defs)) return { output: { error: `Unknown tool ${name}` }, sources: [], label: name };
  const parsed = defs[name as ToolName].schema.safeParse(rawArgs ?? {});
  if (!parsed.success) return { output: { error: parsed.error.issues[0]?.message ?? "Invalid arguments" }, sources: [], label: name };
  const args = parsed.data as Record<string, unknown>;

  switch (name as ToolName) {
    case "search_code": {
      const { query, path_prefix } = args as { query: string; path_prefix?: string };
      const { hits, semantic } = await hybridSearch(indexId, query, { limit: 8, pathPrefix: path_prefix });
      return {
        label: `Searched “${query}”`,
        output: {
          retrieval: semantic ? "hybrid" : "keyword",
          results: hits.map((h) => ({ path: h.path, lines: `L${h.startLine}-L${h.endLine}`, defines: h.symbols, snippet: trim(h.text) })),
        },
        sources: hits.map((h) => ({ path: h.path, startLine: h.startLine, endLine: h.endLine })),
      };
    }
    case "read_file": {
      const { path, start_line, end_line } = args as { path: string; start_line?: number; end_line?: number };
      const res = await readLines(indexId, path, start_line ?? 1, end_line ?? (start_line ?? 1) + 199);
      if (!res) return { label: `Tried to read ${path}`, output: { error: `No indexed file at ${path}` }, sources: [] };
      return {
        label: `Read ${path} L${res.startLine}-L${res.endLine}`,
        output: res,
        sources: [{ path, startLine: res.startLine, endLine: res.endLine }],
      };
    }
    case "find_symbol": {
      const { name: sym } = args as { name: string };
      const matches = await findSymbols(indexId, sym);
      return {
        label: `Looked up ${sym}`,
        output: { matches },
        sources: matches.slice(0, 5).map((m) => ({ path: m.path, startLine: m.startLine, endLine: m.endLine })),
      };
    }
    case "impact_of_change": {
      const { path } = args as { path: string };
      const impact = impactOf(await loadGraph(indexId), path);
      if (!impact) return { label: `Checked impact of ${path}`, output: { error: `No indexed file at ${path}` }, sources: [] };
      return {
        label: `Traced what depends on ${path}`,
        output: { ...impact, dependents: impact.dependents.slice(0, 60), dependencies: impact.dependencies.slice(0, 40) },
        sources: [],
      };
    }
    case "repo_overview":
      return { label: "Read the repository overview", output: overview(await loadGraph(indexId)), sources: [] };
  }
}
