import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Logo } from "@/components/logo";
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

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const callbackUrl = safeCallback(typeof params.callbackUrl === "string" ? params.callbackUrl : undefined);
  const session = await getSession();
  if (session?.user) redirect(callbackUrl);
  const errorKey = typeof params.error === "string" ? params.error : null;
  const error = errorKey ? (ERRORS[errorKey] ?? ERRORS.default) : null;

  return (
    <main className="bg-grid flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-xl shadow-black/5">
        <Logo />
        <h1 className="mt-8 text-xl font-semibold">Sign in to Codexplain</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Generate analyses, keep your history and share results. We only request read access to your public profile.
        </p>
        {error ? (
          <p role="alert" className="mt-5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <SignInButton callbackUrl={callbackUrl} />
        <p className="mt-6 text-xs text-muted-foreground">
          By continuing you agree to our <a className="underline" href="/terms">terms</a> and{" "}
          <a className="underline" href="/privacy">privacy policy</a>.
        </p>
      </div>
    </main>
  );
}
