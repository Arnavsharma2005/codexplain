import { cn } from "@/lib/utils";

type Props = {
  title: React.ReactNode;
  blurb?: React.ReactNode;
  variant?: "display" | "page" | "numeral";
  numeral?: string;
  /** Rendered between the title row and the accent rule (e.g. the dashboard's repo field). */
  children?: React.ReactNode;
  /** Rendered after the accent rule (e.g. the landing hero field). */
  after?: React.ReactNode;
  intro?: boolean;
  className?: string;
};

/** Big left-aligned title, short blurb on the right, then the single 6px orange rule. */
export function Masthead({ title, blurb, variant = "page", numeral, children, after, intro, className }: Props) {
  return (
    <header className={cn("masthead", className)}>
      {numeral ? (
        <p aria-hidden className="numeral text-ink">
          {numeral}
        </p>
      ) : null}
      {variant === "numeral" ? (
        <>
          <hr className="accent-rule" />
          <h1 className="text-[28px] font-bold leading-8 tracking-[-0.01em]">{title}</h1>
          {blurb ? <p className="mt-3 max-w-[46ch] text-ink-muted">{blurb}</p> : null}
          {children}
        </>
      ) : (
        <>
          <div className="masthead-row">
            <h1 className={variant === "display" ? "display-title" : "page-title"}>{title}</h1>
            {blurb ? <div className="masthead-blurb">{blurb}</div> : null}
          </div>
          {children}
          <hr className={cn("accent-rule", intro && "is-intro")} />
        </>
      )}
      {after}
    </header>
  );
}
