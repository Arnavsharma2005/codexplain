import { cn } from "@/lib/utils";

/** Two-digit catalog number: `No. 01`. */
export function catalogNo(n: number) {
  return `No. ${String(n).padStart(2, "0")}`;
}

/** Plate caption: a name line plus an uppercase catalog line, parts joined by " · ". */
export function Caption({
  name,
  parts,
  mono,
  className,
  nameClassName,
}: {
  name: React.ReactNode;
  parts: React.ReactNode[];
  mono?: boolean;
  className?: string;
  nameClassName?: string;
}) {
  const shown = parts.filter((p) => p !== null && p !== undefined && p !== false && p !== "");
  return (
    <div className={className}>
      <div className={cn(mono ? "font-mono text-[15px] leading-5" : "text-[17px] font-semibold leading-6", "text-ink", nameClassName)}>{name}</div>
      {shown.length ? (
        <p className="caption mt-1">
          {shown.map((p, i) => (
            <span key={i}>
              {i > 0 ? " · " : null}
              {p}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}
