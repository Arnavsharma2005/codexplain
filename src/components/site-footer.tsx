import Link from "next/link";

const REPO_URL = "https://github.com/Arnavsharma2005/codexplain";
const link = "border-b-[3px] border-orange pb-0.5 text-label transition-colors duration-[120ms] hover:text-ink";

export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-[1180px] px-[clamp(16px,4vw,44px)]">
      <div className="flex flex-col gap-4 border-t-2 border-ink pt-6 pb-8 text-[13px] font-semibold uppercase leading-5 tracking-[.08em] text-label sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:text-[15px]">
        <p>Codexplain · Built with Next.js and Gemini · © 2026</p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-3">
          <Link href="/privacy" prefetch={false} className={link}>
            Privacy
          </Link>
          <Link href="/terms" prefetch={false} className={link}>
            Terms
          </Link>
          <a href={REPO_URL} rel="noreferrer" className={link}>
            Source
          </a>
          <a href={`${REPO_URL}/issues`} rel="noreferrer" className={link}>
            Report an issue
          </a>
        </nav>
      </div>
    </footer>
  );
}
