import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Code2 } from "lucide-react";
import { formatLineHash } from "@/lib/line-refs";
import { getSharedAnalysis } from "@/lib/services/analyses";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { MarkdownView } from "@/components/markdown-view";

const MODE_LABEL = { OVERVIEW: "Overview", DEEP_DIVE: "Deep dive", REVIEW: "Code review" } as const;

async function load(slug: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(slug)) return null;
  return getSharedAnalysis(slug);
}

export async function generateMetadata({ params }: PageProps<"/a/[slug]">): Promise<Metadata> {
  const view = await load((await params).slug);
  if (!view) return { title: "Analysis not found" };
  const a = view.analysis;
  return {
    title: `${MODE_LABEL[a.mode]} of ${a.path}`,
    description: `${MODE_LABEL[a.mode]} of ${a.repository.owner}/${a.repository.name}/${a.path}, generated with Codexplain.`,
    robots: { index: false },
  };
}

export default async function SharedAnalysisPage({ params }: PageProps<"/a/[slug]">) {
  const view = await load((await params).slug);
  if (!view) notFound();
  const a = view.analysis;
  const codeHref = `/r/${a.repository.owner}/${a.repository.name}?${new URLSearchParams({ ref: a.ref, path: a.path })}`;
  const sharer = view.user.githubLogin ?? view.user.name;

  return (
    <>
      <SiteHeader />
      <main className="page flex-1">
        <header>
          <p className="caption">
            {MODE_LABEL[a.mode]} ·{" "}
            <span className="font-mono normal-case tracking-normal">
              {a.repository.owner}/{a.repository.name}
            </span>{" "}
            · <span className="font-mono normal-case tracking-normal">{a.ref}</span>
          </p>
          <h1 className="mt-2 break-all font-mono text-[20px] leading-[26px] sm:text-[26px] sm:leading-8">{a.path}</h1>
          <p className="meta mt-2">
            {sharer ? <>Shared by @{sharer} · </> : null}
            {a.createdAt.toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" })}
          </p>
          <hr className="accent-rule" />
        </header>
        <Button asChild>
          <Link href={codeHref}>
            <Code2 /> Open with the code
          </Link>
        </Button>

        <div className="mt-10">
          {/* Line references open the workspace at those lines. */}
          <MarkdownView
            className="is-reading"
            content={a.content}
            renderLineRef={(range, _href, children) => (
              <Link href={`${codeHref}${formatLineHash(range)}`} className="line-ref">
                {children}
              </Link>
            )}
          />
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t-2 border-ink pt-4">
          <p className="meta">Made with Codexplain. Paste any GitHub link and read it like this.</p>
          <Link href="/" className="chrome-link font-bold uppercase tracking-[.08em]">
            Try Codexplain →
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
