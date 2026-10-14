"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Masthead } from "@/components/masthead";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <>
      <SiteHeader search={false} />
      <main className="page flex-1">
        <Masthead title="Something went wrong" />
        <p className="max-w-[60ch]">
          An unexpected error occurred. Please try again. If it keeps happening,{" "}
          <a href="https://github.com/Arnavsharma2005/codexplain/issues" rel="noreferrer" className="chrome-link">
            Report an issue
          </a>
          .
        </p>
        {error.digest ? <p className="meta mt-3 font-mono">Reference: {error.digest}</p> : null}
        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button variant="secondary" asChild>
            <Link href="/">Home</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
