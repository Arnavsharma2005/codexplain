"use client";

import { useRouter } from "next/navigation";
import { Markdown } from "@/components/markdown";
import { formatLineHash } from "@/lib/line-refs";

/** On the shared page, line references open the workspace at those lines. */
export function SharedMarkdown({ content, codeHref }: { content: string; codeHref: string }) {
  const router = useRouter();
  return <Markdown content={content} onLineClick={(range) => router.push(`${codeHref}${formatLineHash(range)}`)} />;
}
