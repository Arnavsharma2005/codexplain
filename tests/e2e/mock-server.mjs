// Local stand-ins for the GitHub REST API and the Anthropic Messages API, so the
// end-to-end suite is deterministic, offline and free.
import http from "node:http";

const PORT = Number(process.env.MOCK_PORT ?? 4010);

const FILES = {
  "README.md": "# Widgets\n\nA tiny demo library.\n",
  "package.json": JSON.stringify({ name: "widgets", version: "1.0.0", main: "src/index.ts" }, null, 2) + "\n",
  "src/index.ts": [
    'import { slugify } from "./utils/slugify";',
    "",
    "export type Widget = { id: string; name: string };",
    "",
    "/** Creates a widget with a URL-safe id. */",
    "export function createWidget(name: string): Widget {",
    "  if (!name.trim()) throw new Error(\"name is required\");",
    "  return { id: slugify(name), name };",
    "}",
    "",
    "export function renameWidget(w: Widget, name: string): Widget {",
    "  return { ...w, name };",
    "}",
    "",
  ].join("\n"),
  "src/utils/slugify.ts": 'export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");\n',
  "assets/logo.png": "\u0089PNG\u0000\u0000binary",
};

const sha = (s) => {
  let h = 0n;
  for (const c of s) h = (h * 131n + BigInt(c.codePointAt(0))) % (1n << 160n);
  return h.toString(16).padStart(40, "0");
};

const REPO = {
  name: "widgets",
  full_name: "acme/widgets",
  owner: { login: "acme", avatar_url: "https://avatars.githubusercontent.com/u/1?v=4" },
  private: false,
  description: "Demo repository for end-to-end tests",
  default_branch: "main",
  stargazers_count: 1234,
  forks_count: 56,
  language: "TypeScript",
  topics: ["demo", "testing"],
  license: { spdx_id: "MIT", name: "MIT License" },
  html_url: "https://github.com/acme/widgets",
  pushed_at: "2026-10-01T00:00:00Z",
};

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

export const ANALYSIS_TEXT = [
  "## Summary",
  "",
  "`src/index.ts` is the public entry point of the widgets library. It defines the `Widget` type and two factory helpers.",
  "",
  "## Key parts",
  "",
  "- `createWidget` (L6-L9) validates the name and builds an id with `slugify`.",
  "- `renameWidget` (L11-L13) returns a copy with a new name.",
  "",
  "## How it fits in",
  "",
  "It imports the slug helper from `src/utils/slugify.ts` (L1).",
].join("\n");

function anthropic(req, res, body) {
  const userText = JSON.stringify(body.messages ?? []);
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const model = body.model;
  send("message_start", {
    type: "message_start",
    message: { id: "msg_mock", type: "message", role: "assistant", model, content: [], stop_reason: null, stop_sequence: null,
      usage: { input_tokens: Math.round(userText.length / 4), output_tokens: 0 } },
  });
  send("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } });
  const chunks = ANALYSIS_TEXT.match(/[\s\S]{1,24}/g);
  let i = 0;
  const timer = setInterval(() => {
    if (i < chunks.length) {
      send("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: chunks[i++] } });
      return;
    }
    clearInterval(timer);
    send("content_block_stop", { type: "content_block_stop", index: 0 });
    send("message_delta", { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 120 } });
    send("message_stop", { type: "message_stop" });
    res.end();
  }, 15);
  res.on("close", () => clearInterval(timer));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = decodeURIComponent(url.pathname);

  if (req.method === "POST" && p === "/v1/messages") {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => anthropic(req, res, JSON.parse(raw)));
    return;
  }

  if (p === "/repos/acme/private") return json(res, 200, { ...REPO, name: "private", full_name: "acme/private", private: true });
  if (p === "/repos/acme/widgets") return json(res, 200, REPO);
  if (p === "/repos/acme/widgets/branches") return json(res, 200, [{ name: "main" }, { name: "feature/login" }]);
  if (p === "/repos/acme/widgets/tags") return json(res, 200, [{ name: "v1.0.0" }]);
  if (p === "/repos/acme/widgets/git/trees/main" || p === "/repos/acme/widgets/git/trees/feature/login") {
    const dirs = new Set();
    for (const f of Object.keys(FILES)) {
      const parts = f.split("/");
      for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join("/"));
    }
    return json(res, 200, {
      sha: sha("tree"),
      truncated: false,
      tree: [
        ...[...dirs].map((d) => ({ path: d, type: "tree", sha: sha(d) })),
        ...Object.entries(FILES).map(([path, c]) => ({ path, type: "blob", size: Buffer.byteLength(c), sha: sha(c) })),
      ],
    });
  }
  const contents = p.match(/^\/repos\/acme\/widgets\/contents\/(.+)$/);
  if (contents) {
    const content = FILES[contents[1]];
    if (content === undefined) return json(res, 404, { message: "Not Found" });
    const buf = Buffer.from(content, "latin1");
    return json(res, 200, {
      type: "file",
      path: contents[1],
      sha: sha(content),
      size: buf.length,
      encoding: "base64",
      content: buf.toString("base64"),
      html_url: `https://github.com/acme/widgets/blob/main/${contents[1]}`,
    });
  }
  return json(res, 404, { message: "Not Found" });
});

server.listen(PORT, "127.0.0.1", () => console.log(`mock server on :${PORT}`));
