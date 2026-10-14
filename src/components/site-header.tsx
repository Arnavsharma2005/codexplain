import Link from "next/link";
import { HeaderSearch } from "@/components/header-search";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { cn } from "@/lib/utils";

const navLink =
  "inline-flex min-h-8 items-center border-b-[3px] border-transparent px-1 pt-[3px] pb-[2px] text-[13px] font-bold uppercase leading-none tracking-[.06em] text-ink transition-colors duration-[120ms] hover:border-orange sm:px-2 sm:text-[14px] sm:tracking-[.08em]";

/** `search={false}` on pages that already show a repository field (404s). */
export function SiteHeader({ className, search = true }: { className?: string; search?: boolean }) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-12 shrink-0 items-center gap-1.5 border-b-2 border-rule bg-paper px-4 dark:border-b dark:bg-panel sm:gap-4 sm:px-6 lg:h-14",
        className,
      )}
    >
      <Logo />
      <div className="flex min-w-0 flex-1 items-center justify-center">{search ? <HeaderSearch /> : null}</div>
      <nav aria-label="Main" className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        <Link href="/#how" className={cn(navLink, "hidden md:inline-flex")}>
          How it works
        </Link>
        <Link href="/dashboard" className={navLink}>
          Dashboard
        </Link>
        <ThemeToggle />
        <UserMenu />
      </nav>
    </header>
  );
}
