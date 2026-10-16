import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { linkifyLineRefs, parseLineHash, type LineRange } from "@/lib/line-refs";
import { cn } from "@/lib/utils";

type Props = {
  content: string;
  /** Renders a line reference such as "L12-L20". */
  renderLineRef: (range: LineRange, href: string, children: ReactNode) => ReactNode;
  className?: string;
  streaming?: boolean;
};

/**
 * Renders analysis Markdown safely (no raw HTML). Has no client-only code, so the
 * share page renders it on the server and ships no Markdown parser to the browser.
 */
export function MarkdownView({ content, renderLineRef, className, streaming }: Props) {
  return (
    <div className={cn("prose-analysis", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children }) {
            const range = href ? parseLineHash(href) : null;
            if (range && href) return renderLineRef(range, href, children);
            return (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                {children}
              </a>
            );
          },
        }}
      >
        {linkifyLineRefs(content)}
      </ReactMarkdown>
      {streaming ? <span className="streaming-caret" aria-hidden /> : null}
    </div>
  );
}
