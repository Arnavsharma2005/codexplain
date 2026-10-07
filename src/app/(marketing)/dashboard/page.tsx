import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bookmark, Clock, Gauge, Star } from "lucide-react";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUsage } from "@/lib/services/quota";
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
  const recent = visits.slice(0, 8);
  const pct = Math.min(100, Math.round((usage.used / usage.limit) * 100));

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back{session.user.name ? `, ${session.user.name.split(" ")[0]}` : ""}</h1>
          <p className="mt-1 text-muted-foreground">Pick up where you left off, or open a new repository.</p>
        </div>
        <div className="w-full md:max-w-md">
          <RepoSearch size="sm" />
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard icon={<Gauge className="size-4" />} label="Analyses left today">
          <div className="text-2xl font-semibold">
            {usage.remaining}
            <span className="text-sm font-normal text-muted-foreground"> / {usage.limit}</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={usage.used} aria-valuemin={0} aria-valuemax={usage.limit} aria-label="Daily analyses used">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Resets daily at midnight UTC. Cached results are free.</p>
        </StatCard>
        <StatCard icon={<Clock className="size-4" />} label="Analyses in history">
          <div className="text-2xl font-semibold">{analysisCount}</div>
        </StatCard>
        <StatCard icon={<Bookmark className="size-4" />} label="Saved repositories">
          <div className="text-2xl font-semibold">{saved.length}</div>
        </StatCard>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_320px]">
        <section>
          <h2 className="text-lg font-semibold">Analysis history</h2>
          <HistoryList />
        </section>

        <aside className="space-y-10">
          <RepoList title="Saved" empty="Save repositories from the workspace to pin them here." items={saved} />
          <RepoList title="Recently viewed" empty="Repositories you open will show up here." items={recent} />
        </aside>
      </div>
    </div>
  );
}

function StatCard({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

type VisitWithRepo = {
  id: string;
  lastVisited: Date;
  repository: { owner: string; name: string; description: string | null; stars: number; language: string | null };
};

function RepoList({ title, empty, items }: { title: string; empty: string; items: VisitWithRepo[] }) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((v) => (
            <li key={v.id}>
              <Link
                href={`/r/${v.repository.owner}/${v.repository.name}`}
                className="block rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/50"
              >
                <div className="truncate font-mono text-[13px]">
                  <span className="text-muted-foreground">{v.repository.owner}/</span>
                  <span className="font-semibold">{v.repository.name}</span>
                </div>
                {v.repository.description ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{v.repository.description}</p>
                ) : null}
                <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Star className="size-3" />{formatNumber(v.repository.stars)}</span>
                  {v.repository.language ? <span>{v.repository.language}</span> : null}
                  <span className="ml-auto">{timeAgo(v.lastVisited)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
