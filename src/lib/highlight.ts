import "server-only";
import { createHighlighter, type BundledLanguage, type Highlighter } from "shiki";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { bundledLanguages } from "shiki";

const THEMES = { light: "github-light", dark: "github-dark-default" } as const;

/** Above these limits we skip tokenizing and render escaped plain text (still line-numbered). */
const MAX_HIGHLIGHT_CHARS = 250_000;
const MAX_HIGHLIGHT_LINES = 6_000;

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter() {
  highlighterPromise ??= createHighlighter({
    themes: [THEMES.light, THEMES.dark],
    langs: [],
    // Pure-JS regex engine: no WASM to load in serverless functions.
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  });
  return highlighterPromise;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function plainHtml(code: string) {
  const lines = code.split("\n").map(
    (line, i) => `<span class="line" id="L${i + 1}" data-line="${i + 1}">${escapeHtml(line)}</span>`,
  );
  return `<pre class="shiki plain"><code>${lines.join("\n")}</code></pre>`;
}

/**
 * Returns highlighted HTML where every line is `<span class="line" id="L{n}">`.
 * Shiki escapes all source text, so the output is safe to inject.
 */
export async function highlight(code: string, lang: string): Promise<string> {
  const normalized = code.replace(/\r\n?/g, "\n");
  const lineCount = normalized.split("\n").length;
  if (lang === "text" || normalized.length > MAX_HIGHLIGHT_CHARS || lineCount > MAX_HIGHLIGHT_LINES) {
    return plainHtml(normalized);
  }
  if (!(lang in bundledLanguages)) return plainHtml(normalized);

  try {
    const highlighter = await getHighlighter();
    if (!highlighter.getLoadedLanguages().includes(lang)) {
      await highlighter.loadLanguage(lang as BundledLanguage);
    }
    return highlighter.codeToHtml(normalized, {
      lang,
      themes: THEMES,
      defaultColor: false,
      transformers: [
        {
          line(node, line) {
            node.properties.id = `L${line}`;
            node.properties["data-line"] = line;
          },
        },
      ],
    });
  } catch (err) {
    console.warn("[highlight] falling back to plain text", lang, err);
    return plainHtml(normalized);
  }
}
