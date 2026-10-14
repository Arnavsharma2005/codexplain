import Link from "next/link";
import { Masthead } from "@/components/masthead";
import { RepoSearch } from "@/components/repo-search";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <>
      <SiteHeader search={false} />
      <main className="page flex-1">
        <Masthead
          variant="numeral"
          numeral="404"
          title="This page doesn't exist"
          blurb="The link may be broken, or the page may have been removed."
        />
        <Button asChild className="mt-8">
          <Link href="/">Back to home</Link>
        </Button>
        <div className="mt-10 grid max-w-[720px] items-center gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-6">
          <p className="caption">Or open a repository</p>
          <RepoSearch size="sm" />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
