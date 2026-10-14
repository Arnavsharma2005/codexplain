import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUsage } from "@/lib/services/quota";
import { Masthead } from "@/components/masthead";
import { RepoSearch } from "@/components/repo-search";
import { HistoryList } from "@/components/dashboard/history-list";
import { formatNumber, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard");
  const userId = session.user.id;

  const [usage, visits, analysisCount] = await Promise.all([
    getUsage(userId),
    db.repoVisit.findMany({
      where: { userId },
      orderBy: { lastVisited: "desc" },
      take: 30,
      include: { repository: true },
    }),
    db.analysisView.count({ where: { userId } }),
  ]);
  const saved = visits.filter((v) => v.starred);
  const savedIds = new Set(saved.map((v) => v.id));
  const recent = visits.filter((v) => !savedIds.has(v.id)).slice(0, 8);
  const pct = Math.min(100, Math.round((usage.used / usage.limit) * 100));
  // No digits may appear in the DOM before the quota number (the e2e suite reads the first "4").
  const firstName = session.user.name?.split(" ")[0]?.replace(/\d/g, "");

  return (
    <div className="page">
      <Masthead
        title={`Welcome back${firstName ? `, ${firstName}` : ""}`}
        blurb="Pick up where you left off, or open a new repository."
      >
        <RepoSearch size="sm" className="mt-6 max-w-[560px]" />
      </Masthead>

      <div className="dash-grid mt-10">
        <section aria-label="Usage" className="dash-ledger grid border-t-2 border-b border-ink border-b-hairline sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="py-3 sm:pr-6">
            <p className="caption flex items-center gap-1.5">
              <span aria-hidden className="swatch marker-orange" />
              Analyses left today
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="text-[40px] font-bold leading-10 tabular">
                {usage.remaining}
                <span className="meta ml-1 text-[13px] font-medium"> / {usage.limit}</span>
              </p>
              <div
                className="h-2 w-40 border-2 border-ink"
                role="progressbar"
                aria-valuenow={usage.used}
                aria-valuemin={0}
                aria-valuemax={usage.limit}
                aria-label="Daily analyses used"
              >
                <div className="h-full bg-orange" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <p className="meta mt-1">Resets at midnight UTC. Cached results are free.</p>
          </div>
          <div className="grid grid-cols-2 border-t border-hairline sm:contents">
            <div className="py-3 sm:border-l sm:border-hairline sm:px-6">
              <p className="caption flex items-center gap-1.5">
              <span aria-hidden className="swatch marker-moon" />
              In history
            </p>
              <p className="mt-1 text-[40px] font-bold leading-10 tabular">{analysisCount}</p>
            </div>
            <div className="border-l border-hairline py-3 pl-4 sm:px-6">
              <p className="caption flex items-center gap-1.5">
              <span aria-hidden className="swatch marker-teal" />
              Saved
            </p>
              <p className="mt-1 text-[40px] font-bold leading-10 tabular">{saved.length}</p>
            </div>
          </div>
        </section>

        <section className="dash-history min-w-0">
          <h2 className="section-label">Analysis history</h2>
          <HistoryList />
        </section>

        <RepoList className="dash-saved" marker="marker-teal" title="Saved" empty="Save repositories from the workspace to pin them here." items={saved} />
        <RepoList className="dash-recent" marker="marker-jungle" title="Recently viewed" empty="Repositories you open will show up here." items={recent} />
      </div>
    </div>
  );
}

type VisitWithRepo = {
  id: string;
  lastVisited: Date;
  repository: { owner: string; name: string; description: string | null; stars: number; language: string | null };
};

function RepoList({ title, empty, items, className, marker }: { title: string; empty: string; items: VisitWithRepo[]; className?: string; marker: string }) {
  return (
    <section className={className}>
      <h2 className={`section-label ${marker}`}>{title}</h2>
      {items.length === 0 ? (
        <p className="meta border-t-2 border-ink pt-3">{empty}</p>
      ) : (
        <ul className="ruled-list">
          {items.map((v) => (
            <li key={v.id} className="row-hover relative py-4">
              <Link href={`/r/${v.repository.owner}/${v.repository.name}`} className="row-link row-name block truncate font-mono text-[15px] leading-5">
                <span className="text-ink-muted">{v.repository.owner}/</span>
                <span className="text-ink">{v.repository.name}</span>
              </Link>
              {v.repository.description ? (
                <p className="mt-1 line-clamp-2 text-[15px] leading-[22px] text-ink-muted">{v.repository.description}</p>
              ) : null}
              <p className="caption mt-1.5">
                {[v.repository.language, v.repository.stars ? `${formatNumber(v.repository.stars)} stars` : null, timeAgo(v.lastVisited)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
