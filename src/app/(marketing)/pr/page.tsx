import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getGitHubToken } from "@/lib/auth";
import { GitHubError } from "@/lib/github/client";
import { ownerSchema, repoNameSchema } from "@/lib/github/validation";
import { intelEnabled } from "@/lib/intel/config";
import { listOpenPulls, type PullSummary } from "@/lib/intel/github";
import { recentWalkthroughs } from "@/lib/intel/pulls/queries";
import { formatNumber, timeAgo } from "@/lib/utils";
import { Masthead } from "@/components/masthead";
import { PullForm } from "@/components/intel/pr/pull-form";

export const metadata: Metadata = {
  title: "PR walkthrough",
  description: "Any public pull request, read as a story: ordered layers, plain summaries and what it could break.",
};

const STEPS: [string, string, string][] = [
  ["No. 01", "Order", "Files are grouped into layers and ordered by the import graph, so you read foundations before the code that uses them."],
  ["No. 02", "Explain", "Each layer gets a plain summary with line references, and a diagram when a flow changes."],
  ["No. 03", "Impact", "Blast radius shows which code outside the pull request depends on each layer, so you know where to look hardest."],
];

/** "owner/name" from ?repo=, when it names a valid repository. */
function repoParam(v: string | string[] | undefined) {
  const [owner, name, ...rest] = typeof v === "string" ? v.split("/") : [];
  if (rest.length || !ownerSchema.safeParse(owner).success || !repoNameSchema.safeParse(name).success) return null;
  return { owner, name };
}

export default async function PullEntryPage({ searchParams }: PageProps<"/pr">) {
  // Checked per request, so the flag can change without a rebuild.
  await connection();
  if (!intelEnabled()) notFound();
  const repo = repoParam((await searchParams).repo);
  const [recent, open] = await Promise.all([
    recentWalkthroughs(6).catch(() => []),
    repo ? openPulls(repo.owner, repo.name) : null,
  ]);

  return (
    <div className="page">
      <Masthead title="PR walkthrough" blurb="Any public pull request, read as a story: ordered layers, plain summaries and what it could break." />
      <PullForm />
      <p className="meta mt-2 max-w-[760px]">
        Anyone can read a saved walkthrough. Signing in with GitHub is only needed to create one, and each is saved so the next
        visitor gets it instantly.
      </p>

      {repo && open ? (
        <section className="section-ruled mt-12" aria-label={`Open pull requests in ${repo.owner}/${repo.name}`}>
          <h2 className="section-label marker-orange">
            Open in <span className="ml-1.5 font-mono normal-case tracking-normal">{repo.owner}/{repo.name}</span>
          </h2>
          {"error" in open ? (
            <p className="text-danger">{open.error}</p>
          ) : open.pulls.length ? (
            <ul>
              {open.pulls.map((p) => (
                <li key={p.number}>
                  <Link
                    href={`/r/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/pull/${p.number}`}
                    className="wt-try is-num row-hover"
                  >
                    <span className="truncate font-mono text-[14px] text-ink-muted">
                      #{p.number}
                    </span>
                    <span className="row-name text-[17px] font-semibold">{p.title}</span>
                    <span className="meta whitespace-nowrap">
                      {p.draft ? "draft · " : ""}by {p.author} · {timeAgo(p.updatedAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-muted">No open pull requests right now. Paste a link to a closed or merged one above.</p>
          )}
        </section>
      ) : null}

      {recent.length ? (
        <section className="section-ruled mt-12" aria-label="Recent walkthroughs">
          <h2 className="section-label marker-teal">Try one</h2>
          <ul>
            {recent.map((w) => (
              <li key={`${w.repository.owner}/${w.repository.name}#${w.number}`}>
                <Link
                  href={`/r/${encodeURIComponent(w.repository.owner)}/${encodeURIComponent(w.repository.name)}/pull/${w.number}`}
                  className="wt-try row-hover"
                >
                  <span className="truncate font-mono text-[14px] text-ink-muted">
                    {w.repository.owner}/{w.repository.name}
                  </span>
                  <span className="row-name text-[17px] font-semibold">{w.title}</span>
                  <span className="meta whitespace-nowrap">
                    #{w.number} · {formatNumber(w.changedFiles)} files · {timeAgo(w.updatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="section-ruled mt-12 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <h2 className="section-label marker-orange">How it reads</h2>
          <ol>
            {STEPS.map(([n, t, d]) => (
              <li key={n} className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 border-b border-hairline py-3">
                <span className="caption pt-1">{n}</span>
                <span>
                  <span className="block text-[17px] font-bold">{t}</span>
                  <span className="text-ink-muted">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h2 className="section-label marker-moon">Also works from</h2>
          <ul>
            <li className="border-b border-hairline py-3">
              The search box in the header: paste a <span className="font-mono">/pull/</span> link instead of a repository.
            </li>
            <li className="border-b border-hairline py-3">
              Your agent: the Codexplain MCP server has a <span className="font-mono">walk_pull_request</span> tool.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}

async function openPulls(owner: string, name: string): Promise<{ pulls: PullSummary[] } | { error: string }> {
  try {
    return { pulls: await listOpenPulls(owner, name, await getGitHubToken()) };
  } catch (err) {
    if (err instanceof GitHubError && err.code === "NOT_FOUND") return { error: "That repository was not found, or it is private." };
    if (err instanceof GitHubError) return { error: err.message };
    throw err;
  }
}
