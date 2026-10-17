import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGitHubToken, getSession } from "@/lib/auth";
import { GitHubError, getRepo } from "@/lib/github/client";
import { ownerSchema, refSchema, repoNameSchema } from "@/lib/github/validation";
import { intelEnabled } from "@/lib/intel/config";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RepoError } from "@/components/workspace/repo-error";
import { IntelApp } from "@/components/intel/intel-app";

type Props = PageProps<"/r/[owner]/[repo]/intel">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo } = await params;
  return { title: `Intelligence · ${decodeURIComponent(owner)}/${decodeURIComponent(repo)}` };
}

export default async function IntelPage({ params, searchParams }: Props) {
  if (!intelEnabled()) notFound();
  const { owner: rawOwner, repo: rawRepo } = await params;
  const sp = await searchParams;
  const owner = decodeURIComponent(rawOwner);
  const repo = decodeURIComponent(rawRepo);
  if (!ownerSchema.safeParse(owner).success || !repoNameSchema.safeParse(repo).success) notFound();

  const token = await getGitHubToken();
  let info;
  try {
    info = await getRepo(owner, repo, { token });
  } catch (err) {
    if (err instanceof GitHubError && err.code === "NOT_FOUND") notFound();
    if (err instanceof GitHubError) return <RepoError owner={owner} repo={repo} code={err.code} message={err.message} signedIn={!!token} />;
    throw err;
  }
  const refParam = typeof sp.ref === "string" && refSchema.safeParse(sp.ref).success ? sp.ref : null;
  const session = await getSession();

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <IntelApp
          repo={info}
          gitRef={refParam ?? info.defaultBranch}
          signedIn={!!session?.user}
          initialQuestion={typeof sp.q === "string" ? sp.q.slice(0, 2000) : null}
        />
      </main>
      <SiteFooter />
    </>
  );
}
