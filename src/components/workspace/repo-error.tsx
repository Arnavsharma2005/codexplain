import Link from "next/link";
import { AlertTriangle, Lock, SearchX, Timer } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { RepoSearch } from "@/components/repo-search";
import { Button } from "@/components/ui/button";

const ICONS = { NOT_FOUND: SearchX, RATE_LIMITED: Timer, FORBIDDEN: Lock } as const;

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
  const Icon = ICONS[code as keyof typeof ICONS] ?? AlertTriangle;
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
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-6 py-20">
        <div className="w-full max-w-lg text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted">
            <Icon className="size-6 text-muted-foreground" />
          </div>
          <h1 className="mt-5 text-xl font-semibold">{title}</h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            {owner}/{repo}
          </p>
          <p className="mt-4 text-muted-foreground">{message}</p>
          {code === "RATE_LIMITED" && !signedIn ? (
            <Button asChild className="mt-6">
              <Link href={`/login?callbackUrl=${encodeURIComponent(`/r/${owner}/${repo}`)}`}>Sign in with GitHub</Link>
            </Button>
          ) : null}
          <div className="mt-10">
            <RepoSearch />
          </div>
        </div>
      </main>
    </>
  );
}
