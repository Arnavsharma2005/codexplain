import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { highlight } from "@/lib/highlight";
import { languageLabel } from "@/lib/languages";
import { linkifyLineRefs, parseLineHash } from "@/lib/line-refs";
import { specimen } from "@/content/specimen";
import { formatBytes } from "@/lib/utils";
import { FileIcon } from "@/components/workspace/file-icon";

/** A static analysis next to its code, rendered on the server (no client fetch, no live model call). */
export async function Specimen() {
  const { owner, repo, ref, path, language, code, overviewMarkdown } = specimen;
  const html = await highlight(code, language, { anchors: false });
  const lines = code.replace(/\n$/, "").split("\n").length;
  const slash = path.lastIndexOf("/");
  const dir = path.slice(0, slash + 1);
  const name = path.slice(slash + 1);
  const fileHref = `/r/${owner}/${repo}?${new URLSearchParams({ ref, path })}`;
  const bytes = new TextEncoder().encode(code).length;

  return (
    <section className="section-ruled" aria-labelledby="specimen-label">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="specimen-label" className="section-label marker-teal">
          Specimen
        </h2>
        <p className="caption mb-3">
          {repo} · <span className="font-mono normal-case tracking-normal">{dir}</span> · Overview
        </p>
      </div>
      <div className="grid border-2 border-ink lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="min-w-0 bg-sheet px-4 py-5 sm:px-8 sm:py-7">
          <p className="font-mono text-[13px] text-label">{dir}</p>
          <p className="doc-title mt-1">{name}</p>
          <p className="caption mt-2">
            {languageLabel(language)} · {lines} lines · {formatBytes(bytes)} ·{" "}
            <span className="font-mono normal-case tracking-normal">{ref}</span>
          </p>
          <div aria-hidden className="my-4 h-1.5 bg-orange" />
          <div className="specimen-doc">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a({ href, children }) {
                  const range = href ? parseLineHash(href) : null;
                  if (range && href) {
                    return (
                      <Link href={`${fileHref}${href}`} prefetch={false} className="line-ref">
                        {children}
                      </Link>
                    );
                  }
                  return <a href={href}>{children}</a>;
                },
              }}
            >
              {linkifyLineRefs(overviewMarkdown)}
            </ReactMarkdown>
          </div>
        </div>
        <div className="on-plate min-w-0 border-t-2 border-ink bg-plate text-plate-fg lg:border-t-0 lg:border-l-2">
          <div className="plate-tabstrip pr-4">
            <span className="plate-tab">
              <FileIcon path={path} className="size-3.5" />
              <span className="truncate">{name}</span>
            </span>
            <span className="plate-meta ml-auto self-center truncate pl-3">
              <b>Code</b>
              {lines} lines
            </span>
          </div>
          <div className="specimen-code" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
      <p className="meta mt-3">
        A sample Overview of a real file from {owner}/{repo}. Line refs open the file in the workspace.
      </p>
    </section>
  );
}
