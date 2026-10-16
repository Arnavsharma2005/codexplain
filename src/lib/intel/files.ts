import { extensionOf, isProbablyBinary } from "@/lib/github/binary";
import { detectLanguage } from "@/lib/languages";

/** Largest single file we index; bigger files are almost always generated or data. */
export const MAX_FILE_BYTES = 256_000;

const SKIP_DIRS = new Set([
  "node_modules", "vendor", "third_party", "third-party", "bower_components", "dist", "build", "out",
  ".next", ".nuxt", ".svelte-kit", ".turbo", ".cache", "coverage", "target", "bin", "obj",
  "__pycache__", ".venv", "venv", "env", ".tox", ".mypy_cache", ".pytest_cache", ".gradle", "Pods",
  ".git", ".idea", ".vscode", ".yarn", "storybook-static", "public/vendor",
]);

const SKIP_FILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lock", "bun.lockb", "composer.lock",
  "Gemfile.lock", "Cargo.lock", "poetry.lock", "uv.lock", "go.sum", "Pipfile.lock", "flake.lock",
]);

// Languages that are worth searching even without a grammar (docs, config, schemas).
const TEXT_LANGUAGES = new Set([
  "markdown", "mdx", "rst", "yaml", "toml", "json", "jsonc", "prisma", "graphql", "proto", "sql",
  "docker", "makefile", "terraform", "hcl", "html", "vue", "svelte", "astro", "css", "scss", "bash",
  "kotlin", "swift", "scala", "dart", "elixir", "lua", "r", "julia", "haskell", "clojure", "ocaml",
  "zig", "nim", "solidity", "perl", "fsharp", "objective-c", "objective-cpp", "groovy", "cmake", "ini",
  "powershell", "c", "cpp",
]);

export function shouldSkipPath(path: string): boolean {
  const parts = path.split("/");
  const name = parts[parts.length - 1];
  if (!name || SKIP_FILES.has(name)) return true;
  for (let i = 0; i < parts.length - 1; i++) if (SKIP_DIRS.has(parts[i])) return true;
  if (/\.(min|bundle|chunk)\.(js|css)$/.test(name) || name.endsWith(".map") || name.endsWith(".snap")) return true;
  return isProbablyBinary(path);
}

/** Cheap pre-check from the tar header alone, before any bytes are buffered. */
export function wantFile(path: string, size: number): boolean {
  if (size === 0 || size > MAX_FILE_BYTES || shouldSkipPath(path)) return false;
  const lang = detectLanguage(path);
  return lang !== "text" ? isIndexableLanguage(lang) : extensionOf(path) === "txt";
}

export function isIndexableLanguage(lang: string): boolean {
  return GRAMMAR_FOR[lang] !== undefined || TEXT_LANGUAGES.has(lang) || lang === "text";
}

/** Shiki language id → tree-sitter grammar we ship (see parse.ts). */
export const GRAMMAR_FOR: Record<string, string | undefined> = {
  typescript: "typescript",
  tsx: "tsx",
  javascript: "javascript",
  jsx: "javascript",
  python: "python",
  go: "go",
  rust: "rust",
  java: "java",
  ruby: "ruby",
  php: "php",
  csharp: "c-sharp",
};

/** A file is generated or minified when its lines are absurdly long on average. */
export function looksGenerated(text: string): boolean {
  if (text.length < 4000) return false;
  const lines = text.split("\n").length;
  return text.length / lines > 400 || /^\s*(\/\/|#|\/\*)\s*(@generated|Code generated|DO NOT EDIT)/m.test(text.slice(0, 500));
}
