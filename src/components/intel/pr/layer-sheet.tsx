import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowRight } from "lucide-react";
import { linkCitations } from "@/lib/intel/citations";
import type { NoteTone, WalkthroughData } from "@/lib/intel/pulls/types";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";
import { FlowDiagram } from "./flow-diagram";
import { baseName, layerColor, plural, refHref, shortPath, two } from "./shared";

const TONE: Record<NoteTone, string> = { warn: "Worth a look", fine: "Looks right", info: "Heads up" };

type Props = {
  data: WalkthroughData;
  /** 0-based. */
  active: number;
  /** For each file, the layer that holds it. */
  fileLayer: number[];
  askHref: string;
};

/** The ivory sheet beside the diff: what the layer does, how it flows, what it reaches and what to check. */
export function LayerSheet({ data, active, fileLayer, askHref }: Props) {
  const layer = data.layers[active];
  const index = new Map(data.files.map((f, i) => [f.path, i]));
  const adds = layer.files.reduce((n, i) => n + data.files[i].additions, 0);
  const dels = layer.files.reduce((n, i) => n + data.files[i].deletions, 0);
  const generated = layer.files.every((i) => data.files[i].kind === "generated");
  const href = (path: string, start?: number, end?: number) => {
    const i = index.get(path)!;
    return refHref(fileLayer[i], i, start, end);
  };
  const summary = layer.summary
    ? linkCitations(layer.summary, (p) => index.has(p), (c) => href(c.path, c.startLine, c.endLine), baseName)
    : null;
  const shown = layer.blast.direct.length + layer.blast.more.length;
  const last = active === data.layers.length - 1;

  return (
    <aside className="wt-sheet self-start px-6 pt-5 pb-6" aria-label="Layer summary">
      <p className="caption flex items-center gap-1.5">
        <span aria-hidden className="inline-block size-2.5" style={{ background: layerColor(active) }} /> Layer {two(active + 1)} of{" "}
        {two(data.layers.length)}
      </p>
      <h2 className="doc-title mt-2">{layer.title}</h2>
      <p className="meta mt-1">
        {plural(layer.files.length, "file")} · +{formatNumber(adds)} −{formatNumber(dels)}
        {layer.after.length ? ` · builds on ${layer.after.map((a) => two(a + 1)).join(" and ")}` : active ? " · stands on its own" : " · read this first"}
      </p>

      {summary ? (
        <div className="prose-analysis mt-4 text-[16px] leading-[26px]">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            disallowedElements={["img"]}
            unwrapDisallowed
            components={{
              // Only links to code in this walkthrough survive; the PR text is untrusted.
              a({ href: to, children }) {
                return to?.startsWith("?layer=") ? (
                  <a href={to} className="line-ref" data-walk-ref="">
                    {children}
                  </a>
                ) : (
                  <>{children}</>
                );
              },
            }}
          >
            {summary}
          </ReactMarkdown>
        </div>
      ) : (
        <p className="meta mt-4">
          {generated
            ? "Lockfiles and generated code. They are listed so nothing is hidden, but they are not explained."
            : `No summary for this layer${data.aiError ? `: ${data.aiError.replace(/\.$/, "").toLowerCase()}` : ""}. The files are still in reading order.`}
        </p>
      )}

      {layer.flow ? (
        <div className="mt-2">
          <p className="caption flex items-center gap-1.5">
            <span aria-hidden className="swatch marker-teal" /> {layer.flow.title}
          </p>
          <div className="on-plate mt-2 bg-plate px-3 pt-3 pb-2">
            <FlowDiagram flow={layer.flow} id={`flow-${active}`} />
          </div>
        </div>
      ) : null}

      {!generated ? (
        <div className="mt-6">
          <p className="caption flex items-center gap-1.5">
            <span aria-hidden className="swatch marker-orange" /> Blast radius
          </p>
          <p className="mt-1 text-[17px] font-semibold leading-6">
            {!data.graphFiles
              ? "Unknown: the import graph could not be built for this commit."
              : layer.blast.total
                ? `${plural(layer.blast.total, "file")} outside this PR ${layer.blast.total === 1 ? "depends" : "depend"} on this layer.`
                : "Nothing outside this PR depends on this layer."}
          </p>
          {layer.impact ? <p className="meta mt-1">{layer.impact}</p> : null}
          {layer.blast.direct.length ? (
            <ul className="mt-3">
              {layer.blast.direct.map((d) => (
                <li key={d} className="flex items-baseline justify-between gap-3 border-b border-hairline py-1.5">
                  <span className="min-w-0 truncate font-mono text-[13px]" title={d}>
                    {d}
                  </span>
                  <span className="meta shrink-0">direct</span>
                </li>
              ))}
              {layer.blast.more.length || layer.blast.total > shown ? (
                <li className="meta py-1.5">
                  then {[...layer.blast.more.map(shortPath), ...(layer.blast.total > shown ? [`+${formatNumber(layer.blast.total - shown)}`] : [])].join(", ")}
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
      ) : null}

      {layer.notes.length ? (
        <div className="mt-6">
          <p className="caption flex items-center gap-1.5">
            <span aria-hidden className="swatch marker-moon" /> Review notes
          </p>
          <ul className="mt-2">
            {layer.notes.map((n) => (
              <li key={n.text} className="wt-note">
                <span className={`wt-chip is-${n.tone}`}>{TONE[n.tone]}</span>
                <span className="text-[15px] leading-[22px]">
                  {n.text}{" "}
                  {n.ref ? (
                    <a href={href(n.ref.path, n.ref.start, n.ref.end)} className="line-ref font-mono text-[13px]" data-walk-ref="">
                      {baseName(n.ref.path)}
                      {n.ref.start ? `:L${n.ref.start}${n.ref.end !== n.ref.start ? `-L${n.ref.end}` : ""}` : ""}
                    </a>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        {!generated ? (
          <Button asChild size="sm">
            <Link href={askHref}>Ask about this layer</Link>
          </Button>
        ) : null}
        {!last ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`?layer=${active + 2}`} scroll={false}>
              Next layer <ArrowRight />
            </Link>
          </Button>
        ) : null}
      </div>
    </aside>
  );
}
