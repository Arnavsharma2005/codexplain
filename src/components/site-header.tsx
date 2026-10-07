import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { cn } from "@/lib/utils";

export function SiteHeader({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6",
        className,
      )}
    >
      <Logo />
      <div className="flex min-w-0 flex-1 items-center justify-center">{children}</div>
      <nav className="flex items-center gap-1">
        <Link
          href="/dashboard"
          className="hidden rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground sm:block"
        >
          Dashboard
        </Link>
        <ThemeToggle />
        <UserMenu />
      </nav>
    </header>
  );
}
