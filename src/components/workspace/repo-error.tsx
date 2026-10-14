import Link from "next/link";
import { Masthead } from "@/components/masthead";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { RepoSearch } from "@/components/repo-search";
import { Button } from "@/components/ui/button";

export function RepoError({
  owner,
  repo,
  code,
  message,
  signedIn,
}: {
  owner: string;
  repo: string;
  code: string;
  message: string;
  signedIn?: boolean;
}) {
  const title =
    code === "NOT_FOUND"
      ? "Repository not found"
      : code === "RATE_LIMITED"
        ? "GitHub is rate limiting us"
        : code === "INVALID"
          ? "Invalid repository"
          : "Couldn't load this repository";
  return (
    <>
      <SiteHeader search={false} />
      <main className="page flex-1">
        <Masthead variant="numeral" title={title} />
        <p className="mt-2 break-all font-mono text-[15px] text-label">
          {owner}/{repo}
        </p>
        <p className="mt-3 max-w-[60ch] text-ink-muted">{message}</p>
        {code === "RATE_LIMITED" && !signedIn ? (
          <Button asChild className="mt-6">
            <Link href={`/login?callbackUrl=${encodeURIComponent(`/r/${owner}/${repo}`)}`}>Sign in with GitHub</Link>
          </Button>
        ) : null}
        <div className="mt-8 max-w-[560px]">
          <RepoSearch size="sm" />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
