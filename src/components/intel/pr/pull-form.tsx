"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { parseGitHubUrl } from "@/lib/github/parse-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Paste a pull request link (or owner/repo#123) to open its walkthrough. */
export function PullForm() {
  const router = useRouter();
  const errorId = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="max-w-[760px]"
      onSubmit={(e) => {
        e.preventDefault();
        const short = /^\s*([^/\s#]+)\/([^/\s#]+)#(\d{1,9})\s*$/.exec(value);
        const parsed = short ? parseGitHubUrl(`${short[1]}/${short[2]}`) : parseGitHubUrl(value);
        const pull = short ? Number(short[3]) : parsed?.pull;
        if (!parsed || !pull) {
          setError("Paste a pull request link, like https://github.com/owner/repo/pull/123.");
          return;
        }
        setError(null);
        startTransition(() => router.push(`/r/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/pull/${pull}`));
      }}
    >
      <div className="flex">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://github.com/owner/repo/pull/123"
          aria-label="Pull request link"
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          autoComplete="off"
          spellCheck={false}
          className="h-14 flex-1 border-r-0 font-mono text-[15px]"
        />
        <Button size="hero" type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null} Walk me through <ArrowRight />
        </Button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="mt-2 text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}
