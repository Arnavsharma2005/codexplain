import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M12.5 10.5 7 16l5.5 5.5M19.5 10.5 25 16l-5.5 5.5"
        fill="none"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-primary-foreground"
      />
      <circle cx="16" cy="16" r="1.8" className="fill-primary-foreground" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 font-semibold tracking-tight", className)} aria-label="Codexplain home">
      <LogoMark />
      <span className="text-[15px]">Codexplain</span>
    </Link>
  );
}
