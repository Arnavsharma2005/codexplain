import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getGitHubToken, getSession } from "@/lib/auth";
import { GitHubError, getRefs, getRepo } from "@/lib/github/client";
import { splitRefAndPath } from "@/lib/github/parse-url";
import { ownerSchema, pathSchema, refSchema, repoNameSchema } from "@/lib/github/validation";
import { recordVisit } from "@/lib/services/repos";
import { db } from "@/lib/db";
import { Workspace } from "@/components/workspace/workspace";
import { RepoError } from "@/components/workspace/repo-error";

type Props = PageProps<"/r/[owner]/[repo]">;

function str(v: string | string[] | undefined) {
  return typeof v === "string" ? v : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo } = await params;
  return { title: `${decodeURIComponent(owner)}/${decodeURIComponent(repo)}` };
}

export default async function RepoPage({ params, searchParams }: Props) {
  const { owner: rawOwner, repo: rawRepo } = await params;
  const sp = await searchParams;
  const owner = decodeURIComponent(rawOwner);
  const repo = decodeURIComponent(rawRepo);

  if (!ownerSchema.safeParse(owner).success || !repoNameSchema.safeParse(repo).success) {
    return <RepoError owner={owner} repo={repo} code="INVALID" message="That isn't a valid GitHub repository name." />;
  }

  const token = await getGitHubToken();
  let info, refs;
  try {
    [info, refs] = await Promise.all([getRepo(owner, repo, { token }), getRefs(owner, repo, { token })]);
  } catch (err) {
    if (err instanceof GitHubError) {
      return <RepoError owner={owner} repo={repo} code={err.code} message={err.message} signedIn={!!token} />;
    }
    throw err;
  }

  // Canonicalise GitHub-style "?at=<ref>/<path>" links into "?ref=&path=".
  const at = str(sp.at);
  if (at) {
    const split = splitRefAndPath(at.split("/").filter(Boolean), [...refs.branches, ...refs.tags]);
    const qs = new URLSearchParams();
    if (split) {
      qs.set("ref", split.ref);
      if (split.path) qs.set(str(sp.kind) === "tree" ? "dir" : "path", split.path);
    }
    redirect(`/r/${encodeURIComponent(info.owner)}/${encodeURIComponent(info.name)}${qs.size ? `?${qs}` : ""}`);
  }

  const refParam = str(sp.ref);
  const ref = refParam && refSchema.safeParse(refParam).success ? refParam : info.defaultBranch;
  const pathParam = str(sp.path);
  const path = pathParam && pathSchema.safeParse(pathParam).success ? pathParam : null;
  const dirParam = str(sp.dir);
  const dir = dirParam && pathSchema.safeParse(dirParam).success ? dirParam : null;

  const session = await getSession();
  let starred = false;
  if (session?.user?.id) {
    const repository = await recordVisit(session.user.id, info).catch(() => null);
    if (repository) {
      const visit = await db.repoVisit.findUnique({
        where: { userId_repositoryId: { userId: session.user.id, repositoryId: repository.id } },
        select: { starred: true },
      });
      starred = visit?.starred ?? false;
    }
  }

  return (
    <Workspace
      key={`${info.fullName}@${ref}`}
      repo={info}
      refs={refs}
      initialRef={ref}
      initialPath={path}
      initialDir={dir}
      signedIn={!!session?.user}
      initialStarred={starred}
    />
  );
}
