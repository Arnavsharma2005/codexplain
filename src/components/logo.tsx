import Link from "next/link";
import { cn } from "@/lib/utils";

/** The square mark (also used as the favicon). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <rect width="32" height="32" fill="#0e1c3a" />
      <path d="M12.5 10.5 7 16l5.5 5.5M19.5 10.5 25 16l-5.5 5.5" fill="none" stroke="#f2e5c3" strokeWidth="2.6" />
      <rect x="14" y="14" width="4" height="4" fill="#f07a2e" />
    </svg>
  );
}

/** The header wordmark: "Codexplain" set in uppercase by CSS. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Codexplain home"
      className={cn("shrink-0 text-[18px] font-bold uppercase leading-none tracking-[.02em] text-ink sm:text-[22px]", className)}
    >
      Codexplain
    </Link>
  );
}
