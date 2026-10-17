import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExternalLink, GitPullRequest } from "lucide-react";
import { getGitHubToken, getSession } from "@/lib/auth";
import { GitHubError, getRepo } from "@/lib/github/client";
import { ownerSchema, repoNameSchema } from "@/lib/github/validation";
import { intelConfig, intelEnabled } from "@/lib/intel/config";
import { getPull, type PullInfo } from "@/lib/intel/github";
import { pullNumberSchema } from "@/lib/intel/http";
import { renderDiff } from "@/lib/intel/pulls/render";
import type { WalkthroughData } from "@/lib/intel/pulls/types";
import { findWalkthroughs, isGenerating } from "@/lib/intel/pulls/queries";
import { formatNumber } from "@/lib/utils";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RepoError } from "@/components/workspace/repo-error";
import { Button } from "@/components/ui/button";
import { GeneratePanel } from "@/components/intel/pr/generate-panel";
import { LayerSheet } from "@/components/intel/pr/layer-sheet";
import { ShareButton } from "@/components/intel/pr/share-button";
import { layerColor, plural } from "@/components/intel/pr/shared";
import { WalkthroughView } from "@/components/intel/pr/walkthrough-view";

type Props = PageProps<"/r/[owner]/[repo]/pull/[number]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo, number } = await params;
  return { title: `PR #${number} walkthrough · ${decodeURIComponent(owner)}/${decodeURIComponent(repo)}` };
}

const RISK = { low: "Low", medium: "Medium", high: "High" } as const;

export default async function PullWalkthroughPage({ params, searchParams }: Props) {
  const { owner: rawOwner, repo: rawRepo, number: rawNumber } = await params;
  const owner = decodeURIComponent(rawOwner);
  const repo = decodeURIComponent(rawRepo);
  if (!ownerSchema.safeParse(owner).success || !repoNameSchema.safeParse(repo).success) notFound();
  const repoHref = `/r/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  if (!intelEnabled()) redirect(repoHref);
  const parsedNumber = pullNumberSchema.safeParse(rawNumber);
  if (!parsedNumber.success) notFound();
  const number = parsedNumber.data;

  const token = await getGitHubToken();
  let info;
  let pull: PullInfo | null = null;
  let githubError: GitHubError | null = null;
  try {
    info = await getRepo(owner, repo, { token });
    pull = await getPull(info.owner, info.name, number, token);
  } catch (err) {
    if (err instanceof GitHubError && err.code === "NOT_FOUND") notFound();
    if (!(err instanceof GitHubError)) throw err;
    githubError = err;
  }
  if (pull?.isPrivate) notFound();

  const [{ latest, current }, session] = await Promise.all([findWalkthroughs(owner, repo, number, pull?.headSha ?? null), getSession()]);
  // With GitHub unreachable, a saved walkthrough can still be shown.
  if (!info || (!pull && !latest)) {
    return <RepoError owner={owner} repo={repo} code={githubError!.code} message={githubError!.message} signedIn={!!token} />;
  }
  const signedIn = !!session?.user;
  const pullHref = `${repoHref}/pull/${number}`;
  const githubUrl = pull?.htmlUrl ?? `https://github.com/${info.owner}/${info.name}/pull/${number}`;
  const title = pull?.title ?? latest!.title;
  const state = pull?.state ?? latest!.state;
  const max = intelConfig().INTEL_PR_MAX_FILES;
  const tooLarge = !!pull && pull.changedFiles > max;
  const data = latest?.data as WalkthroughData | null | undefined;

  const header = (
    <>
      <p className="caption flex flex-wrap items-center gap-2">
        <GitPullRequest className="size-4" aria-hidden /> PR walkthrough ·{" "}
        <Link href={repoHref} className="font-mono normal-case tracking-normal hover:underline">
          {info.fullName}
        </Link>{" "}
        #{number} · {state}
        {pull?.draft ? " · draft" : ""}
      </p>
      <div className="masthead-row mt-3">
        <h1 className="wt-title">{title}</h1>
        <div className="ml-auto flex flex-col items-end gap-3 text-right">
          <p className="meta">
            by <span className="font-mono text-ink">{pull?.author ?? latest!.author}</span>
            {pull ? ` · ${plural(pull.commits, "commit")}` : ""}
            {latest ? (
              <>
                {" "}
                · walkthrough of <span className="font-mono text-ink">{latest.headSha.slice(0, 7)}</span>
              </>
            ) : null}
          </p>
          <div className="flex gap-3">
            <Button asChild variant="outline" size="sm">
              <a href={githubUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> GitHub
              </a>
            </Button>
            {data ? <ShareButton path={pullHref} /> : null}
          </div>
        </div>
      </div>
      <hr className="accent-rule" />
    </>
  );

  if (!latest || !data) {
    const generating = isGenerating(current);
    return (
      <>
        <SiteHeader />
        <main className="flex-1">
          <div className="wt-wide">
            {header}
            <section aria-label="Create the walkthrough" className="section-ruled max-w-[68ch]">
              <h2 className="section-label marker-orange">{tooLarge ? "Too large to walk through" : generating ? "Being written" : "No walkthrough yet"}</h2>
              {tooLarge ? (
                <p className="text-ink-muted">
                  This pull request changes {pull!.changedFiles.toLocaleString("en-US")} files. Walkthroughs cover up to{" "}
                  {max.toLocaleString("en-US")}, so this one is better read on GitHub.
                </p>
              ) : (
                <>
                  <p className="text-ink-muted">
                    Codexplain reads the diff and the repository&apos;s import graph at{" "}
                    <span className="font-mono text-ink">{pull!.headSha.slice(0, 7)}</span>, orders the {plural(pull!.changedFiles, "changed file")}{" "}
                    into layers, foundations first, and writes a short guide to each. It is saved, so everyone after you gets it instantly.
                  </p>
                  {generating ? (
                    <p className="meta mt-3">Someone started this walkthrough a moment ago. Reload the page in a minute.</p>
                  ) : current?.status === "FAILED" && current.error ? (
                    <p className="mt-3 text-danger">The last attempt failed: {current.error}</p>
                  ) : null}
                  {!generating ? (
                    <div className="mt-5">
                      <GeneratePanel owner={info.owner} repo={info.name} number={number} signedIn={signedIn} label="Write the walkthrough" />
                    </div>
                  ) : null}
                </>
              )}
            </section>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  const sp = await searchParams;
  const requested = Number(typeof sp.layer === "string" ? sp.layer : 1);
  const active = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), data.layers.length) - 1 : 0;
  const layer = data.layers[active];
  const fileLayer: number[] = [];
  data.layers.forEach((l, k) => l.files.forEach((i) => (fileLayer[i] = k)));
  const diffs = await Promise.all(
    layer.files.map(async (i) => {
      const f = data.files[i];
      return { file: i, lines: f.patch ? await renderDiff(f.patch, f.language) : null, truncated: f.truncated };
    }),
  );
  const lines = (k: number) => data.layers[k].files.reduce((n, i) => n + data.files[i].additions + data.files[i].deletions, 0);
  const total = data.layers.reduce((n, _, k) => n + lines(k), 0);
  const adds = data.files.reduce((n, f) => n + f.additions, 0);
  const dels = data.files.reduce((n, f) => n + f.deletions, 0);
  const stale = !!pull && pull.headSha !== latest.headSha;
  const question = `In pull request #${number}, the layer "${layer.title}" changes ${layer.files
    .slice(0, 8)
    .map((i) => data.files[i].path)
    .join(", ")}. What do these files do, and what else in the repository depends on them?`;
  const askHref = `${repoHref}/intel?${new URLSearchParams({ ref: latest.headSha, q: question })}`;

  const cells: [string, string, string][] = [
    ["Files", formatNumber(data.files.length), "marker-orange"],
    ["Layers", String(data.layers.length), "marker-teal"],
    ["Lines", `+${formatNumber(adds)} −${formatNumber(dels)}`, "marker-jungle"],
    ["Blast radius", data.graphFiles ? plural(data.blastTotal, "file") : "Unknown", "marker-moon"],
    ["Review risk", RISK[data.risk], "marker-orange"],
  ];

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="wt-wide">
          {header}

          {stale || data.aiError ? (
            <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-l-[6px] border-moon bg-paper-sunk px-4 py-3">
              <p className="text-[15px]">
                {stale ? (
                  <>
                    The pull request has new commits since this walkthrough (now at{" "}
                    <span className="font-mono">{pull!.headSha.slice(0, 7)}</span>).
                  </>
                ) : (
                  <>Summaries are missing: {data.aiError} The layers are ordered by the import graph alone.</>
                )}
              </p>
              {!tooLarge && !isGenerating(current) ? (
                <GeneratePanel
                  owner={info.owner}
                  repo={info.name}
                  number={number}
                  signedIn={signedIn}
                  label={stale ? "Update the walkthrough" : "Write the summaries again"}
                  variant="link"
                />
              ) : null}
            </div>
          ) : null}

          <section aria-label="Pull request" className="grid grid-cols-2 border-t-2 border-b border-ink border-b-hairline sm:grid-cols-5">
            {cells.map(([label, value, marker]) => (
              <div key={label} className="py-3 pr-4">
                <p className="caption flex items-center gap-1.5">
                  <span aria-hidden className={`swatch ${marker}`} />
                  {label}
                </p>
                <p className="mt-1 text-[32px] font-bold leading-9 tabular">{value}</p>
              </div>
            ))}
            <div className="col-span-full border-t border-hairline py-2.5">
              <nav className="wt-seg" aria-label="Lines changed per layer">
                {data.layers.map((l, k) => (
                  <Link
                    key={k}
                    href={`?layer=${k + 1}`}
                    scroll={false}
                    aria-current={k === active ? "step" : undefined}
                    aria-label={`Layer ${k + 1}: ${l.title}, ${formatNumber(lines(k))} lines`}
                    style={{ flex: Math.max(lines(k), total * 0.02, 1), background: layerColor(k) }}
                  />
                ))}
              </nav>
              <p className="meta mt-2 max-w-[110ch]">
                {data.story ? `${data.story} ` : ""}Read it in {plural(data.layers.length, "layer")}, foundations first.
              </p>
            </div>
          </section>

          <WalkthroughView
            id={latest.id}
            files={data.files.map((f) => ({
              path: f.path,
              ...(f.previousPath ? { previousPath: f.previousPath } : {}),
              status: f.status,
              kind: f.kind,
              additions: f.additions,
              deletions: f.deletions,
            }))}
            layers={data.layers.map((l) => ({ title: l.title, files: l.files, after: l.after }))}
            active={active}
            diffs={diffs}
            githubFilesUrl={`${githubUrl}/files`}
            sheet={<LayerSheet data={data} active={active} fileLayer={fileLayer} askHref={askHref} />}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
