"use client";

import { memo } from "react";
import type { LineRange } from "@/lib/line-refs";
import { MarkdownView } from "@/components/markdown-view";

type Props = {
  content: string;
  onLineClick?: (range: LineRange) => void;
  className?: string;
  streaming?: boolean;
};

/** Analysis Markdown whose line references call `onLineClick` instead of navigating. */
export const Markdown = memo(function Markdown({ content, onLineClick, className, streaming }: Props) {
  return (
    <MarkdownView
      content={content}
      className={className}
      streaming={streaming}
      renderLineRef={(range, href, children) => (
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
      )}
    />
  );
});
