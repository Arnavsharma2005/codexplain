import Link from "next/link";
import { catalogNo } from "@/components/caption";
import { PLATE_SCENES, PLATE_SKIES } from "@/components/landing/posters";
import { cn } from "@/lib/utils";

/** An example repository drawn as a flat night poster with a caption on paper (wavz poster row). */
export function PlateCard({ owner, repo, note, n, intro }: { owner: string; repo: string; note: string; n: number; intro?: boolean }) {
  const Scene = PLATE_SCENES[(n - 1) % PLATE_SCENES.length];
  const sky = PLATE_SKIES[(n - 1) % PLATE_SKIES.length];
  return (
    <Link
      href={`/r/${owner}/${repo}`}
      prefetch={false}
      aria-label={`${owner}/${repo}, Example ${catalogNo(n)}`}
      className={cn("plate-card block", intro && "is-intro")}
      style={{ "--i": n - 1 } as React.CSSProperties}
    >
      <div className="plate-face poster aspect-[4/3]">
        <Scene />
        {/* The caption sits on a block of the scene's own flat sky, so it always reads. */}
        <div className="absolute top-0 left-0 max-w-[calc(100%-24px)] px-4 pt-3.5 pb-2.5" style={{ background: sky }}>
          <span className="block font-mono text-[13px] leading-[18px] text-moon">{owner}</span>
          <span className="block text-[26px] font-bold leading-[28px] break-words text-[#fffdf7]">{repo}</span>
        </div>
        <span className="plate-open absolute bottom-0 left-0 bg-[#0e1c3a] px-3 py-2 text-[12px] font-bold uppercase leading-4 tracking-[.14em] text-[#f2e5c3]">
          Open →
        </span>
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
