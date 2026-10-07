import { File, FileCode2, FileImage, FileJson, FileLock2, FileText, FileTerminal, FileCog } from "lucide-react";
import { extensionOf } from "@/lib/github/binary";
import { cn } from "@/lib/utils";

const CODE = new Set(["ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "go", "rs", "java", "kt", "rb", "php", "cs", "c", "cpp", "h", "hpp", "swift", "scala", "dart", "vue", "svelte", "lua", "ex", "exs", "hs", "zig", "sql", "prisma", "graphql", "css", "scss", "html"]);
const DOCS = new Set(["md", "mdx", "txt", "rst", "adoc"]);
const DATA = new Set(["json", "jsonc", "json5"]);
const CONFIG = new Set(["yml", "yaml", "toml", "ini", "cfg", "conf", "env", "xml", "lock"]);
const IMAGES = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "avif"]);
const SHELL = new Set(["sh", "bash", "zsh", "fish", "ps1", "bat"]);

export function FileIcon({ path, className }: { path: string; className?: string }) {
  const ext = extensionOf(path);
  const name = path.split("/").pop()?.toLowerCase() ?? "";
  const cls = cn("size-4 shrink-0", className);
  if (name.endsWith("lock") || name.endsWith(".lock") || name === "package-lock.json") return <FileLock2 className={cn(cls, "text-muted-foreground")} />;
  if (CODE.has(ext)) return <FileCode2 className={cn(cls, "text-sky-500 dark:text-sky-400")} />;
  if (DATA.has(ext)) return <FileJson className={cn(cls, "text-amber-500")} />;
  if (DOCS.has(ext)) return <FileText className={cn(cls, "text-emerald-500")} />;
  if (IMAGES.has(ext)) return <FileImage className={cn(cls, "text-pink-500")} />;
  if (SHELL.has(ext)) return <FileTerminal className={cn(cls, "text-lime-600 dark:text-lime-400")} />;
  if (CONFIG.has(ext) || name.startsWith(".") || name === "dockerfile" || name === "makefile")
    return <FileCog className={cn(cls, "text-violet-500 dark:text-violet-400")} />;
  return <File className={cn(cls, "text-muted-foreground")} />;
}
