"use client";

import { useEffect, useRef, useState } from "react";

const pill =
  "inline-flex h-[38px] w-[42px] cursor-pointer items-center justify-center rounded-full border-2 border-ink text-[18px] font-bold leading-none text-ink transition-colors duration-[120ms] hover:bg-paper-sunk disabled:cursor-default disabled:opacity-25 disabled:hover:bg-transparent";

/** A labelled section whose items scroll-snap on small screens, with arrow pills in the label's right slot. */
export function SnapSection({ label, children }: { label: string; children: React.ReactNode }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const update = () =>
      setEdges({ start: row.scrollLeft <= 2, end: row.scrollLeft + row.clientWidth >= row.scrollWidth - 2 });
    update();
    row.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      row.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  function scrollBy(dir: 1 | -1) {
    const row = rowRef.current;
    const item = row?.firstElementChild as HTMLElement | null;
    if (!row || !item) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollBy({ left: dir * (item.offsetWidth + 16), behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <section className="section-ruled">
      <h2 className="section-label flex items-center justify-between gap-4">
        {label}
        <span className="snap-arrows flex gap-2">
          <button type="button" className={pill} aria-label="Earlier" disabled={edges.start} onClick={() => scrollBy(-1)}>
            ←
          </button>
          <button type="button" className={pill} aria-label="More" disabled={edges.end} onClick={() => scrollBy(1)}>
            →
          </button>
        </span>
      </h2>
      <div ref={rowRef} className="snap-row -mx-4 px-4 sm:mx-0 sm:px-0">
        {children}
      </div>
    </section>
  );
}
