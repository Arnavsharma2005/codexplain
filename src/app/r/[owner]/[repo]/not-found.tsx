"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Masthead } from "@/components/masthead";
import { RepoSearch } from "@/components/repo-search";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export default function RepoNotFound() {
  const pathname = usePathname();
  const [, , owner, repo] = pathname.split("/").map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });
  return (
    <>
      <SiteHeader search={false} />
      <main className="page flex-1">
        <Masthead variant="numeral" title="Repository not found" />
        {owner && repo ? (
          <p className="mt-2 break-all font-mono text-[15px] text-label">
            {owner}/{repo}
          </p>
        ) : null}
        <p className="mt-3 max-w-[60ch] text-ink-muted">
          It may be private, renamed, or never have existed. Codexplain opens public repositories only.
        </p>
        <div className="mt-8 max-w-[560px]">
          <RepoSearch size="sm" />
        </div>
        <Button asChild variant="secondary" className="mt-6">
          <Link href="/">Back to home</Link>
        </Button>
      </main>
      <SiteFooter />
    </>
  );
}
