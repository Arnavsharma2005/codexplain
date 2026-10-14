import { File, FileCode2, FileImage, FileJson, FileLock2, FileText, FileTerminal, FileCog } from "lucide-react";
import { extensionOf } from "@/lib/github/binary";
import { cn } from "@/lib/utils";

const CODE = new Set(["ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "go", "rs", "java", "kt", "rb", "php", "cs", "c", "cpp", "h", "hpp", "swift", "scala", "dart", "vue", "svelte", "lua", "ex", "exs", "hs", "zig", "sql", "prisma", "graphql", "css", "scss", "html"]);
const DOCS = new Set(["md", "mdx", "txt", "rst", "adoc"]);
const DATA = new Set(["json", "jsonc", "json5"]);
const CONFIG = new Set(["yml", "yaml", "toml", "ini", "cfg", "conf", "env", "xml", "lock"]);
const IMAGES = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "avif"]);
const SHELL = new Set(["sh", "bash", "zsh", "fish", "ps1", "bat"]);

/** One monochrome icon per kind of file; the shape carries the meaning, not colour. */
export function FileIcon({ path, className }: { path: string; className?: string }) {
  const ext = extensionOf(path);
  const name = path.split("/").pop()?.toLowerCase() ?? "";
  const cls = cn("size-4 shrink-0 text-ink-muted", className);
  if (name.endsWith("lock") || name.endsWith(".lock") || name === "package-lock.json") return <FileLock2 className={cls} aria-hidden />;
  if (CODE.has(ext)) return <FileCode2 className={cls} aria-hidden />;
  if (DATA.has(ext)) return <FileJson className={cls} aria-hidden />;
  if (DOCS.has(ext)) return <FileText className={cls} aria-hidden />;
  if (IMAGES.has(ext)) return <FileImage className={cls} aria-hidden />;
  if (SHELL.has(ext)) return <FileTerminal className={cls} aria-hidden />;
  if (CONFIG.has(ext) || name.startsWith(".") || name === "dockerfile" || name === "makefile") return <FileCog className={cls} aria-hidden />;
  return <File className={cls} aria-hidden />;
}
