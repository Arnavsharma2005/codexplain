import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { getSession } from "@/lib/auth";
import { Masthead } from "@/components/masthead";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SignInButton } from "./sign-in-button";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  OAuthAccountNotLinked: "This email is already linked to another sign-in method.",
  AccessDenied: "GitHub sign-in was cancelled.",
  Callback: "GitHub sign-in failed. Please try again.",
  OAuthCallback: "GitHub sign-in failed. Please try again.",
  default: "Sign-in failed. Please try again.",
};

/** Only allow redirects back into this site. */
function safeCallback(url: string | undefined) {
  if (!url || !url.startsWith("/") || url.startsWith("//")) return "/dashboard";
  return url;
}

const legalLink = "border-b-2 border-orange text-ink";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const callbackUrl = safeCallback(typeof params.callbackUrl === "string" ? params.callbackUrl : undefined);
  const session = await getSession();
  if (session?.user) redirect(callbackUrl);
  const errorKey = typeof params.error === "string" ? params.error : null;
  const error = errorKey ? (ERRORS[errorKey] ?? ERRORS.default) : null;

  return (
    <>
      <SiteHeader />
      <main className="page flex-1">
        <Masthead title="Sign in to Codexplain" blurb="Generate analyses, keep your history and share results." />
        <section className="max-w-[60ch]">
          <h2 className="section-label mt-10">What GitHub shares with us</h2>
          <p>Your name, username, avatar and primary email. Read-only, public scopes.</p>
          <p className="mt-2 text-ink-muted">Your GitHub token stays in an encrypted session cookie, never in our database.</p>
        </section>
        <div className="mt-8 max-w-[360px]">
          {error ? (
            <p role="alert" className="mb-4 flex items-start gap-2 border-l-2 border-danger bg-paper-raised px-4 py-3 font-semibold text-danger">
              <AlertTriangle className="mt-1 size-4 shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}
          <SignInButton callbackUrl={callbackUrl} />
          <p className="meta mt-4">
            By continuing you agree to our{" "}
            <Link href="/terms" prefetch={false} className={legalLink}>
              terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" prefetch={false} className={legalLink}>
              privacy policy
            </Link>
            .
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
