"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { linkifyLineRefs, parseLineHash, type LineRange } from "@/lib/line-refs";
import { cn } from "@/lib/utils";

type Props = {
  content: string;
  onLineClick?: (range: LineRange) => void;
  className?: string;
  streaming?: boolean;
};

/** Renders analysis Markdown safely (no raw HTML) with clickable line references. */
export const Markdown = memo(function Markdown({ content, onLineClick, className, streaming }: Props) {
  return (
    <div className={cn("prose-analysis", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children }) {
            const range = href ? parseLineHash(href) : null;
            if (range) {
              return (
                <a
                  href={href}
                  className="line-ref"
                  onClick={(e) => {
                    if (!onLineClick) return;
                    e.preventDefault();
                    onLineClick(range);
                  }}
                >
                  {children}
                </a>
              );
            }
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
});
