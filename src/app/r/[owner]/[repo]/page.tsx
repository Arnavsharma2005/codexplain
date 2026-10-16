import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getGitHubToken, getSession } from "@/lib/auth";
import { GitHubError, getRefs, getRepo, getTree } from "@/lib/github/client";
import type { RepoInfo } from "@/lib/github/types";
import { splitRefAndPath } from "@/lib/github/parse-url";
import { ownerSchema, pathSchema, refSchema, repoNameSchema } from "@/lib/github/validation";
import { loadCachedAnalyses } from "@/lib/services/analyses";
import { loadFile } from "@/lib/services/files";
import { getUsage } from "@/lib/services/quota";
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
    // Missing and private repositories both arrive as NOT_FOUND; answer with a real 404 before anything streams.
    if (err instanceof GitHubError && err.code === "NOT_FOUND") notFound();
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
    const lines = str(sp.L);
    const hash = lines && /^L\d+(-L\d+)?$/.test(lines) ? `#${lines}` : "";
    redirect(`/r/${encodeURIComponent(info.owner)}/${encodeURIComponent(info.name)}${qs.size ? `?${qs}` : ""}${hash}`);
  }

  const refParam = str(sp.ref);
  const ref = refParam && refSchema.safeParse(refParam).success ? refParam : info.defaultBranch;
  const pathParam = str(sp.path);
  const path = pathParam && pathSchema.safeParse(pathParam).success ? pathParam : null;
  const dirParam = str(sp.dir);
  const dir = dirParam && pathSchema.safeParse(dirParam).success ? dirParam : null;

  // Everything the first paint needs, fetched here in parallel instead of by the
  // browser after hydration. A failed load is left to the client, which retries
  // it and shows the error in place.
  const session = await getSession();
  const userId = session?.user?.id;
  const filePromise = path ? loadFile(info.owner, info.name, ref, path, token).catch(() => null) : Promise.resolve(null);
  const [tree, file, cached, starred, remaining] = await Promise.all([
    getTree(info.owner, info.name, ref, { token }).catch(() => null),
    filePromise,
    filePromise.then((f) =>
      f && f.content != null ? loadCachedAnalyses(info.owner, info.name, f.path, f.sha).then((c) => c.analyses).catch(() => null) : null,
    ),
    userId ? loadStarred(userId, info) : false,
    userId ? getUsage(userId).then((u) => u.remaining).catch(() => null) : null,
  ]);

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
      initial={{ tree, file, cached, remaining }}
    />
  );
}

/** Records the visit for the dashboard and returns whether the user saved this repository. */
async function loadStarred(userId: string, info: RepoInfo) {
  const repository = await recordVisit(userId, info).catch(() => null);
  if (!repository) return false;
  const visit = await db.repoVisit.findUnique({
    where: { userId_repositoryId: { userId, repositoryId: repository.id } },
    select: { starred: true },
  });
  return visit?.starred ?? false;
}
