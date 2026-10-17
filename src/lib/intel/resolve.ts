/**
 * Maps import specifiers to files inside the repository. Anything that does
 * not land on an indexed file (packages, the standard library) is dropped:
 * the graph only holds edges between the repository's own files.
 */

export type Alias = { prefix: string; targets: string[] };

export type ResolveContext = {
  files: Set<string>;
  /** tsconfig/jsconfig "paths", with "*" stripped, relative to the repo root. */
  aliases: Alias[];
  /** go.mod module path, e.g. "github.com/acme/app". */
  goModule: string | null;
  /** Lowercased path suffix → paths, for Java/C# style package lookups. */
  bySuffix: Map<string, string[]>;
  /** Directory → the files directly inside it. */
  byDir: Map<string, string[]>;
};

const JS_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts", ".d.ts"];
const JS_LANGS = new Set(["typescript", "tsx", "javascript", "jsx"]);

export function dirname(path: string) {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

/** Joins and normalises "a/b" + "../c" → "a/c". Returns null when it climbs above the root. */
export function joinPath(base: string, rel: string): string | null {
  const out = base ? base.split("/") : [];
  for (const part of rel.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (!out.length) return null;
      out.pop();
    } else out.push(part);
  }
  return out.join("/");
}

export function buildContext(files: Iterable<string>, configs: { tsconfigs: Map<string, string>; goMod: string | null }): ResolveContext {
  const set = new Set(files);
  const bySuffix = new Map<string, string[]>();
  const byDir = new Map<string, string[]>();
  for (const f of set) {
    const dir = dirname(f);
    byDir.set(dir, [...(byDir.get(dir) ?? []), f]);
    const parts = f.toLowerCase().split("/");
    // Index the last three segments; enough for "com/acme/Util.java" style lookups.
    for (let i = Math.max(0, parts.length - 3); i < parts.length; i++) {
      const key = parts.slice(i).join("/");
      const list = bySuffix.get(key);
      if (list) list.push(f);
      else bySuffix.set(key, [f]);
    }
  }
  const aliases: Alias[] = [];
  for (const [path, text] of configs.tsconfigs) aliases.push(...tsconfigAliases(dirname(path), text));
  const goModule = configs.goMod?.match(/^\s*module\s+(\S+)/m)?.[1] ?? null;
  return { files: set, aliases, goModule, bySuffix, byDir };
}

/** Reads compilerOptions.paths from a tsconfig that may contain comments and trailing commas. */
export function tsconfigAliases(dir: string, text: string): Alias[] {
  let json: { compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> } };
  try {
    json = JSON.parse(stripJsonComments(text));
  } catch {
    return [];
  }
  const opts = json.compilerOptions;
  if (!opts?.paths) return [];
  const base = joinPath(dir, opts.baseUrl ?? ".") ?? "";
  return Object.entries(opts.paths).flatMap(([key, targets]) =>
    Array.isArray(targets)
      ? [
          {
            prefix: key.replace(/\*$/, ""),
            targets: targets.map((t) => joinPath(base, t.replace(/\*$/, "")) ?? "").map((t) => t),
          },
        ]
      : [],
  );
}

function stripJsonComments(text: string) {
  let out = "";
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (ch === "\\") out += text[++i] ?? "";
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
      out += ch;
    } else if (ch === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else if (ch === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i++;
    } else out += ch;
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}

function firstExisting(ctx: ResolveContext, candidates: (string | null)[]): string | null {
  for (const c of candidates) if (c != null && c !== "" && ctx.files.has(c)) return c;
  return null;
}

function resolveJsPath(ctx: ResolveContext, target: string): string | null {
  // TypeScript ESM imports name the emitted ".js" file; try the source extensions too.
  const stem = target.replace(/\.(js|jsx|mjs|cjs)$/, "");
  return firstExisting(ctx, [
    target,
    ...JS_EXTS.map((e) => stem + e),
    ...JS_EXTS.map((e) => `${target}/index${e}`),
  ]);
}

function resolveJs(ctx: ResolveContext, from: string, spec: string): string | null {
  if (spec.startsWith(".")) {
    const target = joinPath(dirname(from), spec);
    return target == null ? null : resolveJsPath(ctx, target);
  }
  for (const alias of ctx.aliases) {
    if (!spec.startsWith(alias.prefix) || !alias.prefix) continue;
    for (const t of alias.targets) {
      const target = joinPath(t, spec.slice(alias.prefix.length));
      const hit = target == null ? null : resolveJsPath(ctx, target);
      if (hit) return hit;
    }
  }
  // Common conventions when no tsconfig was found.
  const m = spec.match(/^[@~]\/(.*)$/);
  if (m) return resolveJsPath(ctx, `src/${m[1]}`) ?? resolveJsPath(ctx, m[1]);
  return null;
}

function resolvePython(ctx: ResolveContext, from: string, spec: string): string | null {
  const dots = spec.match(/^\.+/)?.[0].length ?? 0;
  const mod = spec.slice(dots).split(".").filter(Boolean).join("/");
  const roots: string[] = [];
  if (dots) {
    let base: string | null = dirname(from);
    for (let i = 1; i < dots && base != null; i++) base = base ? dirname(base) : null;
    if (base == null) return null;
    roots.push(base);
  } else {
    roots.push("", "src", "lib", "app");
  }
  for (const root of roots) {
    const target = joinPath(root, mod);
    if (target == null) continue;
    const hit = firstExisting(ctx, [`${target}.py`, `${target}/__init__.py`, `${target}.pyi`]);
    if (hit) return hit;
  }
  return null;
}

function resolveGo(ctx: ResolveContext, spec: string): string[] {
  if (!ctx.goModule || !spec.startsWith(ctx.goModule)) return [];
  const dir = spec.slice(ctx.goModule.length).replace(/^\//, "");
  return (ctx.byDir.get(dir) ?? []).filter((f) => f.endsWith(".go") && !f.endsWith("_test.go"));
}

function resolveRust(ctx: ResolveContext, from: string, spec: string): string | null {
  const dir = dirname(from);
  if (!spec.includes("::")) {
    // `mod foo;` → foo.rs or foo/mod.rs next to this file (or under its own dir for non-mod.rs files).
    const own = from.replace(/\.rs$/, "");
    const bases = /(^|\/)(main|lib|mod)\.rs$/.test(from) ? [dir] : [own, dir];
    return firstExisting(ctx, bases.flatMap((b) => [joinPath(b, `${spec}.rs`), joinPath(b, `${spec}/mod.rs`)]));
  }
  const parts = spec.replace(/\{.*$/, "").split("::").filter(Boolean);
  let root: string | null;
  if (parts[0] === "crate") {
    const src = from.indexOf("src/");
    root = src === -1 ? "src" : from.slice(0, src + 3);
    parts.shift();
  } else if (parts[0] === "super") {
    root = dirname(dir);
    parts.shift();
  } else if (parts[0] === "self") {
    root = dir;
    parts.shift();
  } else return null;
  for (let n = parts.length; n > 0; n--) {
    const target = joinPath(root, parts.slice(0, n).join("/"));
    const hit = firstExisting(ctx, [target && `${target}.rs`, target && `${target}/mod.rs`]);
    if (hit) return hit;
  }
  return null;
}

function bySuffix(ctx: ResolveContext, suffix: string, from: string): string | null {
  const list = ctx.bySuffix.get(suffix.toLowerCase());
  if (!list?.length) return null;
  if (list.length === 1) return list[0];
  // Prefer the candidate sharing the longest directory prefix with the importer.
  const score = (p: string) => {
    let i = 0;
    while (i < p.length && p[i] === from[i]) i++;
    return i;
  };
  return [...list].sort((a, b) => score(b) - score(a))[0];
}

/** Returns the repository files a specifier points at (usually zero or one). */
export function resolveImport(ctx: ResolveContext, from: string, lang: string, spec: string): string[] {
  let hit: string | null = null;
  if (JS_LANGS.has(lang)) hit = resolveJs(ctx, from, spec);
  else if (lang === "python") hit = resolvePython(ctx, from, spec);
  else if (lang === "go") return resolveGo(ctx, spec);
  else if (lang === "rust") hit = resolveRust(ctx, from, spec);
  else if (lang === "java") {
    const parts = spec.split(".");
    hit = bySuffix(ctx, `${parts.slice(-2).join("/")}.java`, from);
  } else if (lang === "ruby") {
    const target = spec.endsWith(".rb") ? spec : `${spec}.rb`;
    hit =
      firstExisting(ctx, [joinPath(dirname(from), target), joinPath("lib", target), target]) ??
      null;
  } else if (lang === "c" || lang === "cpp") {
    hit = firstExisting(ctx, [joinPath(dirname(from), spec)]) ?? bySuffix(ctx, spec, from);
  }
  return hit && hit !== from ? [hit] : [];
}
