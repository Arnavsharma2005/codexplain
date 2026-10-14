import { cn } from "@/lib/utils";

export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center border border-ink-muted px-1 font-mono text-[12px] leading-none text-ink-muted",
        className,
      )}
      {...props}
    />
  );
}
