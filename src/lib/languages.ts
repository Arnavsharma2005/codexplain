import { extensionOf } from "@/lib/github/binary";

/** Extension → Shiki language id. Covers what people actually open on GitHub. */
const BY_EXTENSION: Record<string, string> = {
  ts: "typescript", mts: "typescript", cts: "typescript", tsx: "tsx",
  js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "jsx",
  json: "json", jsonc: "jsonc", json5: "json5",
  py: "python", pyi: "python", ipynb: "json",
  rb: "ruby", go: "go", rs: "rust", java: "java", kt: "kotlin", kts: "kotlin",
  scala: "scala", swift: "swift", m: "objective-c", mm: "objective-cpp",
  c: "c", h: "c", cc: "cpp", cpp: "cpp", cxx: "cpp", hpp: "cpp", hh: "cpp",
  cs: "csharp", fs: "fsharp", vb: "vb", php: "php", pl: "perl", lua: "lua",
  r: "r", jl: "julia", dart: "dart", ex: "elixir", exs: "elixir", erl: "erlang",
  hs: "haskell", clj: "clojure", ml: "ocaml", zig: "zig", nim: "nim", v: "v", sol: "solidity",
  sh: "bash", bash: "bash", zsh: "bash", fish: "fish", ps1: "powershell", bat: "bat", cmd: "bat",
  html: "html", htm: "html", vue: "vue", svelte: "svelte", astro: "astro",
  css: "css", scss: "scss", sass: "sass", less: "less", styl: "stylus",
  md: "markdown", mdx: "mdx", rst: "rst", tex: "latex",
  yml: "yaml", yaml: "yaml", toml: "toml", ini: "ini", cfg: "ini", conf: "ini", env: "dotenv",
  xml: "xml", svg: "xml", plist: "xml", csproj: "xml",
  sql: "sql", prisma: "prisma", graphql: "graphql", gql: "graphql", proto: "proto",
  tf: "terraform", hcl: "hcl", nix: "nix", dockerfile: "docker",
  gradle: "groovy", groovy: "groovy", cmake: "cmake", mk: "makefile",
  diff: "diff", patch: "diff", csv: "csv", log: "log",
};

const BY_FILENAME: Record<string, string> = {
  dockerfile: "docker",
  makefile: "makefile",
  gnumakefile: "makefile",
  "cmakelists.txt": "cmake",
  gemfile: "ruby",
  rakefile: "ruby",
  podfile: "ruby",
  vagrantfile: "ruby",
  jenkinsfile: "groovy",
  ".bashrc": "bash",
  ".zshrc": "bash",
  ".env": "dotenv",
  ".env.example": "dotenv",
  ".gitignore": "text",
};

/** Human readable language label for UI badges and the AI prompt. */
const LABELS: Record<string, string> = {
  typescript: "TypeScript", tsx: "TSX", javascript: "JavaScript", jsx: "JSX", python: "Python",
  go: "Go", rust: "Rust", java: "Java", kotlin: "Kotlin", ruby: "Ruby", php: "PHP", csharp: "C#",
  cpp: "C++", c: "C", swift: "Swift", markdown: "Markdown", json: "JSON", yaml: "YAML",
  html: "HTML", css: "CSS", scss: "SCSS", bash: "Shell", sql: "SQL", docker: "Dockerfile",
  prisma: "Prisma", vue: "Vue", svelte: "Svelte", dart: "Dart", elixir: "Elixir", scala: "Scala",
};

export function detectLanguage(path: string): string {
  const name = (path.split("/").pop() ?? "").toLowerCase();
  if (BY_FILENAME[name]) return BY_FILENAME[name];
  if (name.startsWith("dockerfile")) return "docker";
  if (name.startsWith(".env")) return "dotenv";
  return BY_EXTENSION[extensionOf(name)] ?? "text";
}

export function languageLabel(lang: string): string {
  if (lang === "text") return "Plain text";
  return LABELS[lang] ?? lang.charAt(0).toUpperCase() + lang.slice(1);
}
