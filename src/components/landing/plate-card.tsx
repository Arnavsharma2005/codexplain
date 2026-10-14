import Link from "next/link";
import { catalogNo } from "@/components/caption";
import { cn } from "@/lib/utils";

/** An example repository drawn as a navy plate with a caption on paper (wavz poster row). */
export function PlateCard({ owner, repo, note, n, intro }: { owner: string; repo: string; note: string; n: number; intro?: boolean }) {
  return (
    <Link
      href={`/r/${owner}/${repo}`}
      prefetch={false}
      aria-label={`${owner}/${repo}, Example ${catalogNo(n)}`}
      className={cn("plate-card block", intro && "is-intro")}
      style={{ "--i": n - 1 } as React.CSSProperties}
    >
      <div className="plate-face flex aspect-[4/3] flex-col justify-between border border-plate-border bg-plate p-5 text-plate-fg">
        <span className="font-mono text-[13px] text-plate-muted">{owner}</span>
        <span className="text-[32px] font-bold leading-[34px] break-words">{repo}</span>
        <span className="text-[12px] font-bold uppercase tracking-[.14em] text-plate-label">Open →</span>
      </div>
      <div className="mt-3">
        <div className="plate-name font-mono text-[15px] leading-5 text-ink">
          {owner}/{repo}
        </div>
        <p className="caption mt-1">
          {note} · {catalogNo(n)}
        </p>
      </div>
    </Link>
  );
}
