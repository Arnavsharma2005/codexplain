"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronRight, CornerDownRight } from "lucide-react";
import type { DiffLine, FileKind, FileStatus } from "@/lib/intel/pulls/types";
import { formatNumber } from "@/lib/utils";
import { baseName, layerColor, parseRefHash, plural, rowId, two, type RefTarget } from "./shared";
import { useHash, useStored } from "./use-stored";

export type ViewFile = { path: string; previousPath?: string; status: FileStatus; kind: FileKind; additions: number; deletions: number };
export type ViewLayer = { title: string; files: number[]; after: number[] };
export type ViewDiff = { file: number; lines: DiffLine[] | null; truncated: boolean };

type Props = {
  /** Walkthrough id: viewed files are remembered per walkthrough. */
  id: string;
  files: ViewFile[];
  layers: ViewLayer[];
  /** 0-based. */
  active: number;
  diffs: ViewDiff[];
  githubFilesUrl: string;
  /** The server-rendered layer sheet. */
  sheet: ReactNode;
};

const STATUS: Partial<Record<FileStatus, string>> = { added: "Added", removed: "Deleted", renamed: "Renamed", copied: "Copied" };

const parseList = (raw: string): string[] => {
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

/** Layers rail, the diff plate and the sheet, with J/K/V keys and remembered "viewed" files. */
export function WalkthroughView({ id, files, layers, active, diffs, githubFilesUrl, sheet }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rawViewed, setRawViewed] = useStored(`cx-walk-viewed:${id}`, "[]");
  const [mode, setMode] = useStored("cx-diff-mode", "unified");
  const [hash, replaceHash] = useHash();
  const [opened, setOpened] = useState<Set<number>>(new Set());
  const scroller = useRef<HTMLDivElement>(null);

  const viewed = useMemo(() => new Set(parseList(rawViewed)), [rawViewed]);
  const layer = layers[active];
  const target = useMemo(() => {
    const t = parseRefHash(hash);
    return t && layer.files.includes(t.file) ? t : null;
  }, [hash, layer]);

  const lines = (k: number) => layers[k].files.reduce((n, i) => n + files[i].additions + files[i].deletions, 0);
  const totalLines = layers.reduce((n, _, k) => n + lines(k), 0);
  const layerViewed = (k: number) => layers[k].files.every((i) => viewed.has(files[i].path));
  const viewedLayers = layers.filter((_, k) => layerViewed(k)).length;
  const viewedLines = layers.reduce((n, _, k) => n + (layerViewed(k) ? lines(k) : 0), 0);

  const saveViewed = useCallback((next: Set<string>) => setRawViewed(JSON.stringify([...next])), [setRawViewed]);

  const go = useCallback(
    (href: string) => {
      const url = new URL(href, window.location.href);
      const k = Number(url.searchParams.get("layer") ?? active + 1) - 1;
      if (k === active) replaceHash(`${url.pathname}${url.search}${url.hash}`);
      else startTransition(() => router.push(`${url.pathname}${url.search}${url.hash}`, { scroll: false }));
    },
    [active, replaceHash, router],
  );

  const toggleLayer = useCallback(() => {
    const next = new Set(viewed);
    const paths = layer.files.map((i) => files[i].path);
    if (paths.every((p) => next.has(p))) paths.forEach((p) => next.delete(p));
    else {
      paths.forEach((p) => next.add(p));
      if (active < layers.length - 1) go(`?layer=${active + 2}`);
    }
    saveViewed(next);
  }, [viewed, layer, files, active, layers.length, go, saveViewed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable='true']")) return;
      const key = e.key.toLowerCase();
      if (key === "j" && active < layers.length - 1) go(`?layer=${active + 2}`);
      else if (key === "k" && active > 0) go(`?layer=${active}`);
      else if (key === "v") toggleLayer();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, layers.length, go, toggleLayer]);

  // A new layer starts at its top unless a link pointed at a line in it.
  useEffect(() => {
    if (target) {
      const el = document.getElementById(rowId(target.file, target.start || undefined)) ?? document.getElementById(rowId(target.file));
      el?.scrollIntoView({ block: target.start ? "center" : "start" });
    } else scroller.current?.scrollTo({ top: 0 });
  }, [active, target]);

  useEffect(() => {
    if (active < layers.length - 1) router.prefetch(`?layer=${active + 2}`);
  }, [active, layers.length, router]);

  return (
    <div
      className="mt-6 grid gap-6 xl:grid-cols-[264px_minmax(0,1fr)_380px]"
      onClickCapture={(e) => {
        const a = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>("a[data-walk-ref]") : null;
        if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        go(a.getAttribute("href")!);
      }}
    >
      <nav aria-label="Layers" className="xl:sticky xl:top-[76px] xl:self-start">
        <p className="caption flex items-center gap-1.5">
          <span aria-hidden className="swatch marker-orange" /> Layers · read in order
        </p>
        <ol className="mt-2">
          {layers.map((l, k) => (
            <li key={k}>
              <Link
                href={`?layer=${k + 1}`}
                scroll={false}
                aria-current={k === active ? "step" : undefined}
                className={`wt-layer ${k === active ? "is-active" : ""}`}
              >
                <span className="num flex items-center gap-1.5">
                  <span aria-hidden className="inline-block size-2.5" style={{ background: layerColor(k) }} />
                  {two(k + 1)}
                </span>
                <span className="name">{l.title}</span>
                <span />
                <span className="meta flex items-center gap-2">
                  <span className="tabular">{`${plural(l.files.length, "file")} · ${formatNumber(lines(k))} lines`}</span>
                  {layerViewed(k) ? <Check className="ml-auto size-4 text-teal-ink" aria-label="Viewed" /> : null}
                </span>
                {l.after.length ? (
                  <>
                    <span />
                    <span className="meta flex items-center gap-1">
                      <CornerDownRight className="size-3.5" aria-hidden /> after {l.after.map((a) => two(a + 1)).join(", ")}
                    </span>
                  </>
                ) : null}
              </Link>
            </li>
          ))}
        </ol>
        <p className="wt-keys meta mt-4">
          <kbd>J</kbd> next <kbd>K</kbd> back <kbd>V</kbd> viewed
        </p>
        <p className="meta mt-3" aria-live="polite">
          {pending
            ? "Opening the layer…"
            : `${viewedLayers} of ${layers.length} viewed · ${totalLines ? Math.round((viewedLines / totalLines) * 100) : 0}% of lines`}
        </p>
      </nav>

      <div className="wt-plate on-plate order-2 min-w-0 self-start xl:sticky xl:top-[76px] xl:order-none">
        <div className="plate-tabstrip overflow-x-auto">
          {layer.files.map((i, k) => (
            <a
              key={i}
              href={`?layer=${active + 1}#${rowId(i)}`}
              data-walk-ref=""
              className={(target ? target.file === i : k === 0) ? "plate-tab shrink-0" : "wt-tab"}
              title={files[i].path}
            >
              {baseName(files[i].path)}
            </a>
          ))}
          <span className="ml-auto flex shrink-0 items-center gap-1 pr-2" role="group" aria-label="Diff layout">
            {(["unified", "split"] as const).map((m) => (
              <button key={m} type="button" className="wt-mode" aria-pressed={mode === m} onClick={() => setMode(m)}>
                {m === "unified" ? "Unified" : "Split"}
              </button>
            ))}
          </span>
        </div>
        <div ref={scroller} className="plate-scroll max-h-[75vh] overflow-auto xl:max-h-[calc(100vh-136px)]">
          {diffs.map((d) => {
            const f = files[d.file];
            const isViewed = viewed.has(f.path);
            const open = !isViewed || opened.has(d.file) || target?.file === d.file;
            return (
              <section key={d.file} id={rowId(d.file)} className="wt-file" aria-label={f.path}>
                <header className="wt-filehead">
                  <button
                    type="button"
                    className="wt-fold"
                    aria-expanded={open}
                    aria-label={open ? `Collapse ${f.path}` : `Expand ${f.path}`}
                    onClick={() =>
                      setOpened((s) => {
                        const next = new Set(s);
                        if (open) next.delete(d.file);
                        else next.add(d.file);
                        return next;
                      })
                    }
                  >
                    {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </button>
                  <span className="min-w-0 truncate font-mono text-[13px] text-plate-fg" title={f.path}>
                    {f.previousPath ? <span className="text-plate-muted">{f.previousPath} → </span> : null}
                    {f.path}
                  </span>
                  {STATUS[f.status] ? <span className={`wt-status is-${f.status}`}>{STATUS[f.status]}</span> : null}
                  <span className="wt-stat">
                    <span className="wt-plus">+{formatNumber(f.additions)}</span> <span className="wt-minus">−{formatNumber(f.deletions)}</span>
                  </span>
                  <label className="wt-viewed">
                    <input
                      type="checkbox"
                      checked={isViewed}
                      onChange={(e) => {
                        const next = new Set(viewed);
                        if (e.target.checked) next.add(f.path);
                        else next.delete(f.path);
                        saveViewed(next);
                        setOpened((s) => {
                          const o = new Set(s);
                          o.delete(d.file);
                          return o;
                        });
                      }}
                    />
                    Viewed
                  </label>
                </header>
                {open ? (
                  d.lines ? (
                    <>
                      <DiffRows file={d.file} lines={d.lines} split={mode === "split"} target={target?.file === d.file ? target : null} />
                      {d.truncated ? (
                        <p className="wt-cut">
                          The diff is cut short here.{" "}
                          <a href={githubFilesUrl} target="_blank" rel="noopener noreferrer">
                            See the rest on GitHub
                          </a>
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="wt-cut">
                      No text diff: the file is binary or too large to show.{" "}
                      <a href={githubFilesUrl} target="_blank" rel="noopener noreferrer">
                        Open it on GitHub
                      </a>
                    </p>
                  )
                ) : null}
              </section>
            );
          })}
        </div>
      </div>

      {/* Below the three-column width the summary comes before the diff. */}
      <div className="order-1 min-w-0 xl:order-none">{sheet}</div>
    </div>
  );
}

type Side = Exclude<DiffLine, { kind: "hunk" }>;

/** Pairs deletions with the additions that replace them, GitHub-style. */
function splitRows(lines: DiffLine[]): ({ hunk: string } | { left: Side | null; right: Side | null })[] {
  const out: ({ hunk: string } | { left: Side | null; right: Side | null })[] = [];
  let dels: Side[] = [];
  let adds: Side[] = [];
  const flush = () => {
    for (let i = 0; i < Math.max(dels.length, adds.length); i++) out.push({ left: dels[i] ?? null, right: adds[i] ?? null });
    dels = [];
    adds = [];
  };
  for (const l of lines) {
    if (l.kind === "hunk") {
      flush();
      out.push({ hunk: l.text });
    } else if (l.kind === "del") {
      if (adds.length) flush();
      dels.push(l);
    } else if (l.kind === "add") adds.push(l);
    else {
      flush();
      out.push({ left: l, right: l });
    }
  }
  flush();
  return out;
}

const hitClass = (target: RefTarget | null, line: number | undefined) =>
  target && target.start && line !== undefined && line >= target.start && line <= target.end ? " is-hit" : "";

const DiffRows = memo(function DiffRows({ file, lines, split, target }: { file: number; lines: DiffLine[]; split: boolean; target: RefTarget | null }) {
  if (split) {
    return (
      <div className="wt-rows">
        {splitRows(lines).map((r, k) =>
          "hunk" in r ? (
            <div key={k} className="wt-row is-hunk">
              <span className="col-span-3" />
              <span className="truncate">{r.hunk}</span>
            </div>
          ) : (
            <div key={k} className="wt-split">
              <Half side={r.left} which="old" />
              <Half side={r.right} which="new" id={r.right && r.right.kind !== "del" ? rowId(file, r.right.new) : undefined} hit={hitClass(target, r.right && r.right.kind !== "del" ? r.right.new : undefined)} />
            </div>
          ),
        )}
      </div>
    );
  }
  return (
    <div className="wt-rows">
      {lines.map((l, k) => {
        if (l.kind === "hunk") {
          return (
            <div key={k} className="wt-row is-hunk">
              <span className="col-span-3" />
              <span className="truncate">{l.text}</span>
            </div>
          );
        }
        const n = l.kind === "del" ? undefined : l.new;
        return (
          <div key={k} id={n ? rowId(file, n) : undefined} className={`wt-row is-${l.kind}${hitClass(target, n)}`}>
            <span className="wt-num">{l.kind === "add" ? "" : l.old}</span>
            <span className="wt-num">{n ?? ""}</span>
            <span className="wt-sign">{l.kind === "add" ? "+" : l.kind === "del" ? "−" : ""}</span>
            <span className="wt-code" dangerouslySetInnerHTML={{ __html: l.html }} />
          </div>
        );
      })}
    </div>
  );
});

function Half({ side, which, id, hit = "" }: { side: Side | null; which: "old" | "new"; id?: string; hit?: string }) {
  if (!side) return <div className="wt-half is-empty" />;
  const n = which === "old" ? (side.kind === "add" ? undefined : side.old) : side.kind === "del" ? undefined : side.new;
  const kind = side.kind === "ctx" ? "ctx" : side.kind;
  return (
    <div id={id} className={`wt-half is-${kind}${hit}`}>
      <span className="wt-num">{n ?? ""}</span>
      <span className="wt-sign">{kind === "add" ? "+" : kind === "del" ? "−" : ""}</span>
      <span className="wt-code" dangerouslySetInnerHTML={{ __html: side.html }} />
    </div>
  );
}
