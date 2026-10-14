import { cn } from "@/lib/utils";

/** Left-aligned empty or error state: a label, one sentence, then at most one action. */
export function EmptyState({
  title,
  icon,
  children,
  action,
  className,
}: {
  title: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("py-8", className)}>
      <h3 className="flex items-center gap-2 text-[17px] font-semibold leading-6 text-ink">
        {icon ? <span className="text-ink-muted [&_svg]:size-5" aria-hidden>{icon}</span> : null}
        {title}
      </h3>
      {children ? <div className="mt-2 max-w-[46ch] text-ink-muted">{children}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
