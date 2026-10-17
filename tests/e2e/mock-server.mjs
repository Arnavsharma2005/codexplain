// Local stand-ins for the GitHub REST API and the Gemini API, so the
// end-to-end suite is deterministic, offline and free.
import http from "node:http";
import { gzipSync } from "node:zlib";

const PORT = Number(process.env.MOCK_PORT ?? 4010);
// Simulated GitHub API round-trip time, used by scripts/bench.mjs. Off for the e2e suite.
const LATENCY_MS = Number(process.env.MOCK_LATENCY_MS ?? 0);

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

// A ustar archive shaped like GitHub's: everything under "<owner>-<repo>-<sha7>/".
function tarball(files, root) {
  const blocks = [];
  const header = (name, size) => {
    const h = Buffer.alloc(512);
    h.write(name, 0, 100, "utf8");
    h.write("0000644\0", 100);
    h.write("0000000\0", 108);
    h.write("0000000\0", 116);
    h.write(size.toString(8).padStart(11, "0") + "\0", 124);
    h.write("00000000000\0", 136);
    h.write("        ", 148);
    h.write("0", 156);
    h.write("ustar\0", 257);
    h.write("00", 263);
    let sum = 0;
    for (const b of h) sum += b;
    h.write(sum.toString(8).padStart(6, "0") + "\0 ", 148);
    return h;
  };
  for (const [path, content] of Object.entries(files)) {
    const body = Buffer.from(content, "latin1");
    blocks.push(header(`${root}/${path}`, body.length), body, Buffer.alloc((512 - (body.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks));
}

// Deterministic bag-of-words vectors, so semantic search ranks related text together.
function embed(text) {
  const v = new Array(768).fill(0);
  for (const w of text.toLowerCase().match(/[a-z]{3,}/g) ?? []) {
    let h = 0;
    for (const c of w) h = (h * 31 + c.charCodeAt(0)) % 768;
    v[h] += 1;
  }
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
}

export const ANSWER_TEXT =
  "`createWidget` builds a widget from a name [src/index.ts:L6-L9]. It slugifies the name with `slugify` [src/utils/slugify.ts:L1] and rejects empty names. See also [src/missing.ts:L1].";

// The repository Q&A agent: first a tool call, then (once the tool answered) a cited answer.
function geminiAgent(res, model, body) {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
  const send = (data) => res.write(`data: ${JSON.stringify({ modelVersion: model, ...data })}\r\n\r\n`);
  const answered = body.contents.some((c) => c.parts?.some((p) => p.functionResponse));
  if (!answered) {
    send({
      candidates: [
        {
          content: { role: "model", parts: [{ functionCall: { name: "find_symbol", args: { name: "createWidget" } }, thoughtSignature: "c2ln" }] },
          finishReason: "STOP",
          index: 0,
        },
      ],
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 10 },
    });
    return res.end();
  }
  for (const chunk of ANSWER_TEXT.match(/[\s\S]{1,40}/g)) send({ candidates: [{ content: { role: "model", parts: [{ text: chunk }] }, index: 0 }] });
  send({ candidates: [{ content: { role: "model", parts: [{ text: "" }] }, finishReason: "STOP", index: 0 }], usageMetadata: { promptTokenCount: 200, candidatesTokenCount: 50 } });
  res.end();
}

// Pull request #7: tightens slugify, validates names, rewords the README. Its head is the
// commit the tarball above serves, so the import graph matches the diff.
const PULL_FILES = [
  {
    filename: "src/utils/slugify.ts",
    status: "modified",
    additions: 1,
    deletions: 1,
    patch: '@@ -1 +1 @@\n-export const slugify = (s: string) => s.toLowerCase().replace(/\\s+/g, "-");\n+export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");',
  },
  {
    filename: "src/index.ts",
    status: "modified",
    additions: 1,
    deletions: 0,
    patch: [
      "@@ -5,5 +5,6 @@ export type Widget = { id: string; name: string };",
      " /** Creates a widget with a URL-safe id. */",
      " export function createWidget(name: string): Widget {",
      '+  if (!name.trim()) throw new Error("name is required");',
      "   return { id: slugify(name), name };",
      " }",
      " ",
    ].join("\n"),
  },
  { filename: "README.md", status: "modified", additions: 1, deletions: 1, patch: "@@ -1,3 +1,3 @@\n # Widgets\n \n-A demo library.\n+A tiny demo library." },
];

const pull = (number, extra = {}) => ({
  number,
  title: "Add name checks to widgets",
  body: "Rejects blank names and makes slugs URL-safe.",
  user: { login: "ada" },
  state: "open",
  merged: false,
  draft: false,
  html_url: `https://github.com/acme/widgets/pull/${number}`,
  updated_at: new Date(Date.now() - 3_600_000).toISOString(),
  head: { sha: sha("widgets-head") },
  base: { sha: sha("widgets-base"), ref: "main", repo: { private: false } },
  additions: 3,
  deletions: 2,
  changed_files: PULL_FILES.length,
  commits: 2,
  ...extra,
});

export const WALKTHROUGH = {
  story: "Widget ids become URL-safe and blank names are rejected before a widget is made.",
  risk: "low",
  layers: [
    {
      title: "Safer slugs",
      files: ["src/utils/slugify.ts"],
      summary: "`slugify` now turns every run of characters that are not letters or digits into one dash [src/utils/slugify.ts:L1].",
      impact: "Every widget id goes through this function.",
      notes: [{ tone: "fine", text: "Input is lowercased first, so capitals cannot slip through.", path: "src/utils/slugify.ts", start: 1, end: 1 }],
    },
    {
      title: "Validate widget names",
      files: ["src/index.ts"],
      summary: "`createWidget` throws on blank names before it slugifies them [src/index.ts:L7].",
      flow: {
        title: "Creating a widget",
        before: { note: "", stages: [["createWidget"], ["slugify"]] },
        after: { note: "blank names stop here", stages: [["createWidget"], ["name check"], ["slugify"]] },
      },
      notes: [{ tone: "warn", text: "No test covers the new error.", path: "src/index.ts", start: 7, end: 7 }],
    },
    { title: "Readme wording", files: ["README.md"], summary: "Calls the library tiny.", notes: [] },
  ],
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

// Mimics Gemini's streamGenerateContent?alt=sse: a thought chunk (which must
// never reach the user), then the answer in small text chunks, then usage.
function gemini(req, res, model, body) {
  if (!body.systemInstruction || !body.contents?.length) return json(res, 400, { error: { code: 400, message: "bad request" } });
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
  const send = (data) => res.write(`data: ${JSON.stringify({ modelVersion: model, ...data })}\r\n\r\n`);
  send({ candidates: [{ content: { role: "model", parts: [{ text: "SECRET THOUGHT", thought: true }] }, index: 0 }] });
  const chunks = ANALYSIS_TEXT.match(/[\s\S]{1,24}/g);
  let i = 0;
  const timer = setInterval(() => {
    if (i < chunks.length) {
      send({ candidates: [{ content: { role: "model", parts: [{ text: chunks[i++] }] }, index: 0 }] });
      return;
    }
    clearInterval(timer);
    const promptTokenCount = Math.round(JSON.stringify(body.contents).length / 4);
    send({
      candidates: [{ content: { role: "model", parts: [{ text: "" }] }, finishReason: "STOP", index: 0 }],
      usageMetadata: { promptTokenCount, candidatesTokenCount: 120, thoughtsTokenCount: 40, totalTokenCount: promptTokenCount + 160 },
    });
    res.end();
  }, 15);
  res.on("close", () => clearInterval(timer));
}

const server = http.createServer((req, res) => {
  if (LATENCY_MS) setTimeout(() => handle(req, res), LATENCY_MS);
  else handle(req, res);
});

function handle(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = decodeURIComponent(url.pathname);

  const generate = p.match(/^\/v1beta\/models\/([^/:]+):streamGenerateContent$/);
  if (req.method === "POST" && generate) {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = JSON.parse(raw);
      return body.tools ? geminiAgent(res, generate[1], body) : gemini(req, res, generate[1], body);
    });
    return;
  }

  // PR walkthroughs: one JSON-mode generateContent call.
  const oneShot = p.match(/^\/v1beta\/models\/([^/:]+):generateContent$/);
  if (req.method === "POST" && oneShot) {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = JSON.parse(raw);
      const config = body.generationConfig ?? {};
      if (config.responseMimeType !== "application/json" || !config.responseJsonSchema) return json(res, 400, { error: { code: 400, message: "JSON mode expected" } });
      json(res, 200, {
        modelVersion: oneShot[1],
        candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(WALKTHROUGH) }] }, finishReason: "STOP", index: 0 }],
        usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 300 },
      });
    });
    return;
  }

  const embedCall = p.match(/^\/v1beta\/models\/([^/:]+):(batchEmbedContents|embedContent)$/);
  if (req.method === "POST" && embedCall) {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = JSON.parse(raw);
      const requests = body.requests ?? [body];
      const text = (r) => (r.content?.parts ?? []).map((part) => part.text ?? "").join(" ");
      if (embedCall[2] === "embedContent") return json(res, 200, { embedding: { values: embed(text(requests[0])) } });
      return json(res, 200, { embeddings: requests.map((r) => ({ values: embed(text(r)) })) });
    });
    return;
  }

  const HEAD = sha("widgets-head");
  if (/^\/repos\/acme\/widgets\/commits\/.+$/.test(p)) {
    res.writeHead(200, { "Content-Type": "application/vnd.github.sha" });
    return res.end(HEAD);
  }
  if (p === `/repos/acme/widgets/tarball/${HEAD}`) {
    res.writeHead(200, { "Content-Type": "application/x-gzip" });
    return res.end(tarball(FILES, `acme-widgets-${HEAD.slice(0, 7)}`));
  }

  if (p === "/repos/acme/widgets/pulls") return json(res, 200, [pull(7), pull(9, { title: "Draft: dark mode", draft: true })]);
  if (p === "/repos/acme/widgets/pulls/7") return json(res, 200, pull(7));
  if (p === "/repos/acme/widgets/pulls/7/files") return json(res, 200, url.searchParams.get("page") === "1" ? PULL_FILES : []);
  // Too big to walk through.
  if (p === "/repos/acme/widgets/pulls/8") return json(res, 200, pull(8, { title: "Rewrite everything", changed_files: 4000 }));
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
}

server.listen(PORT, "127.0.0.1", () => console.log(`mock server on :${PORT}`));
