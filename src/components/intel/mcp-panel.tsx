"use client";

import { useSyncExternalStore } from "react";
import type { RepoInfo } from "@/lib/github/types";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/components/workspace/use-copy";

const subscribe = () => () => {};

export function McpPanel({ repo }: { repo: RepoInfo }) {
  const origin = useSyncExternalStore(subscribe, () => window.location.origin, () => "https://codexplain.app");
  const { copied, copy } = useCopy();
  const command = `claude mcp add --transport http codexplain ${origin}/api/mcp`;
  const tools = [
    ["repo_overview", "Size, languages, most central files and import cycles"],
    ["search_code", "Hybrid keyword + semantic search with line ranges"],
    ["read_file", "Numbered lines of any indexed file"],
    ["find_symbol", "Where a function, class or type is defined"],
    ["impact_of_change", "Every file that transitively imports a file"],
  ];
  return (
    <div className="max-w-[760px]">
      <h2 className="section-label marker-jungle">
            Give your coding agent this index
      </h2>
      <p className="max-w-[60ch] text-ink-muted">
        Codexplain is also a remote MCP server. Claude Code, Cursor or any MCP client can query{" "}
        <span className="font-mono text-ink">{repo.fullName}</span> through the same tools the Ask agent uses, read-only.
      </p>
      <div className="on-plate mt-5 flex items-center gap-3 bg-plate px-4 py-3">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[14px] text-plate-fg">{command}</code>
        <Button variant="plate-outline" size="sm" onClick={() => copy(command)}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <ul className="ruled-list mt-6">
        {tools.map(([name, desc]) => (
          <li key={name} className="grid gap-1 border-b border-hairline py-2 sm:grid-cols-[200px_minmax(0,1fr)]">
            <span className="font-mono text-[14px]">{name}</span>
            <span className="text-ink-muted">{desc}</span>
          </li>
        ))}
      </ul>
      <p className="meta mt-3">
        Every tool takes <span className="font-mono">repo: &quot;{repo.fullName}&quot;</span> and an optional ref.
      </p>
    </div>
  );
}
