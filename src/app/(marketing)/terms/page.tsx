import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <article className="prose-analysis mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Terms of use</h1>
      <p className="text-muted-foreground">Last updated October 2026</p>
      <h2>The service</h2>
      <p>
        Codexplain provides AI-generated explanations of public source code. Analyses are produced by a language model and
        can be incomplete or wrong. Verify important conclusions against the code itself.
      </p>
      <h2>Acceptable use</h2>
      <ul>
        <li>Don&apos;t attempt to bypass rate limits or quotas, or automate requests at scale.</li>
        <li>Respect the licenses of the repositories you analyze.</li>
        <li>Don&apos;t use the service to find and exploit vulnerabilities in systems you don&apos;t own.</li>
      </ul>
      <h2>Availability</h2>
      <p>The service is provided as is, without warranties. Limits and features may change.</p>
    </article>
  );
}
