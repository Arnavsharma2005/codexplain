import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Code2 } from "lucide-react";
import { getSharedAnalysis } from "@/lib/services/analyses";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SharedMarkdown } from "./shared-markdown";

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
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge>{MODE_LABEL[a.mode]}</Badge>
            <span>
              {a.repository.owner}/{a.repository.name}
            </span>
            <span>·</span>
            <span className="font-mono">{a.ref}</span>
          </div>
          <h1 className="mt-3 break-all font-mono text-2xl font-semibold">{a.path}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {sharer ? <>Shared by @{sharer} · </> : null}
            {a.createdAt.toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" })}
          </p>
          <div className="mt-6 flex gap-2">
            <Button asChild>
              <Link href={codeHref}>
                <Code2 /> Open with the code
              </Link>
            </Button>
          </div>

          <div className="mt-10 rounded-2xl border border-border bg-card p-6 sm:p-8">
            <SharedMarkdown content={a.content} codeHref={codeHref} />
          </div>

          <div className="mt-10 rounded-2xl border border-border bg-muted/40 p-6 text-center">
            <p className="font-medium">Understand any GitHub repository</p>
            <p className="mt-1 text-sm text-muted-foreground">Paste a link and get explanations like this for any file.</p>
            <Link href="/" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
              Try Codexplain <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
