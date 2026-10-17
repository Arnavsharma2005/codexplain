import "server-only";
import { createCssVariablesTheme, createHighlighter, type BundledLanguage, type Highlighter } from "shiki";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { bundledLanguages } from "shiki";

/** One theme whose colours come from the --shiki-* tokens in globals.css (the navy code plate). */
const plateTheme = createCssVariablesTheme({ name: "codexplain-plate", variablePrefix: "--shiki-", fontStyle: false });

/** Above these limits we skip tokenizing and render escaped plain text (still line-numbered). */
const MAX_HIGHLIGHT_CHARS = 150_000;
const MAX_HIGHLIGHT_LINES = 2_500;
const CACHE_SIZE = 200;

let highlighterPromise: Promise<Highlighter> | null = null;
const cache = new Map<string, string>();

function getHighlighter() {
  highlighterPromise ??= createHighlighter({
    themes: [plateTheme],
    langs: [],
    // Pure-JS regex engine: no WASM to load in serverless functions.
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  });
  return highlighterPromise;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function plainHtml(code: string, anchors: boolean) {
  const lines = code
    .split("\n")
    .map((line, i) =>
      anchors
        ? `<span class="line" id="L${i + 1}" data-line="${i + 1}">${escapeHtml(line)}</span>`
        : `<span class="s-line">${escapeHtml(line)}</span>`,
    );
  return `<pre class="shiki plain"><code>${lines.join("\n")}</code></pre>`;
}

type Options = {
  /** false: no `#L{n}` ids or `.line` class (the landing specimen must never collide with the workspace). */
  anchors?: boolean;
  /** Cache key part identifying the exact content, e.g. the blob sha. */
  cacheKey?: string;
};

/**
 * Returns highlighted HTML where every line is `<span class="line" id="L{n}">`.
 * Shiki escapes all source text, so the output is safe to inject.
 */
export async function highlight(code: string, lang: string, { anchors = true, cacheKey }: Options = {}): Promise<string> {
  const key = cacheKey ? `${cacheKey}:${lang}:${anchors ? 1 : 0}` : null;
  if (key) {
    const hit = cache.get(key);
    if (hit !== undefined) {
      cache.delete(key);
      cache.set(key, hit);
      return hit;
    }
  }
  const html = await render(code, lang, anchors);
  if (key) {
    cache.set(key, html);
    if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
  }
  return html;
}

async function render(code: string, lang: string, anchors: boolean): Promise<string> {
  // Drop one trailing newline so the last line number matches GitHub.
  const normalized = code.replace(/\r\n?/g, "\n").replace(/\n$/, "");
  const lineCount = normalized.split("\n").length;
  if (lang === "text" || normalized.length > MAX_HIGHLIGHT_CHARS || lineCount > MAX_HIGHLIGHT_LINES) {
    return plainHtml(normalized, anchors);
  }
  if (!(lang in bundledLanguages)) return plainHtml(normalized, anchors);

  try {
    const highlighter = await getHighlighter();
    if (!highlighter.getLoadedLanguages().includes(lang)) {
      await highlighter.loadLanguage(lang as BundledLanguage);
    }
    return highlighter.codeToHtml(normalized, {
      lang,
      theme: "codexplain-plate",
      transformers: [
        {
          line(node, line) {
            if (anchors) {
              node.properties.id = `L${line}`;
              node.properties["data-line"] = line;
            } else {
              node.properties.class = "s-line";
            }
          },
        },
      ],
    });
  } catch (err) {
    console.warn("[highlight] falling back to plain text", lang, err);
    return plainHtml(normalized, anchors);
  }
}

/**
 * Highlights code and returns one HTML string per line, for views that lay
 * out lines themselves (diffs). Token colours come from the theme, and all
 * source text is escaped, so the strings are safe to inject.
 */
export async function highlightLines(code: string, lang: string): Promise<string[]> {
  const lines = code.replace(/\r\n?/g, "\n").split("\n");
  const plain = () => lines.map(escapeHtml);
  if (lang === "text" || !(lang in bundledLanguages) || code.length > MAX_HIGHLIGHT_CHARS || lines.length > MAX_HIGHLIGHT_LINES) return plain();
  try {
    const highlighter = await getHighlighter();
    if (!highlighter.getLoadedLanguages().includes(lang)) await highlighter.loadLanguage(lang as BundledLanguage);
    const { tokens } = highlighter.codeToTokens(lines.join("\n"), { lang: lang as BundledLanguage, theme: "codexplain-plate" });
    if (tokens.length !== lines.length) return plain();
    return tokens.map((line) =>
      line.map((t) => (t.color ? `<span style="color:${t.color}">${escapeHtml(t.content)}</span>` : escapeHtml(t.content))).join(""),
    );
  } catch (err) {
    console.warn("[highlight] falling back to plain text", lang, err);
    return plain();
  }
}
