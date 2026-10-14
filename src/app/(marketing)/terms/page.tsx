import type { Metadata } from "next";
import Link from "next/link";
import { Masthead } from "@/components/masthead";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <div className="page">
      <Masthead title="Terms of use" blurb={<span className="meta text-[15px]">Last updated October 2026</span>} />
      <article className="legal-doc mt-10">
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
      <p className="mt-10 max-w-[66ch] border-t border-hairline pt-4">
        See also:{" "}
        <Link href="/privacy" prefetch={false} className="chrome-link font-semibold">
          Privacy policy →
        </Link>
      </p>
    </div>
  );
}
