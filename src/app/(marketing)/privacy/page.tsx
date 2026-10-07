import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <article className="prose-analysis mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy policy</h1>
      <p className="text-muted-foreground">Last updated October 2026</p>
      <h2>What we collect</h2>
      <ul>
        <li>Your GitHub profile name, username, avatar and primary email, provided when you sign in.</li>
        <li>The public repositories you open and the analyses you generate, so they can appear in your dashboard.</li>
        <li>A daily count of analyses you run, used to enforce fair-use limits.</li>
      </ul>
      <h2>What we don&apos;t collect</h2>
      <ul>
        <li>We request only public, read-only GitHub permissions and never access private repositories.</li>
        <li>Your GitHub access token is kept only inside an encrypted session cookie. It is never written to our database.</li>
        <li>We do not sell your data or use third-party advertising trackers.</li>
      </ul>
      <h2>Third parties</h2>
      <p>
        When you request an analysis, the contents of that public file and a list of file paths from the same repository
        are sent to Google&apos;s Gemini API to generate the result. On Gemini&apos;s free tier, Google may use that content to
        improve its products, so only public code is ever sent. Code is fetched from GitHub&apos;s public API.
      </p>
      <h2>Sharing</h2>
      <p>Analyses are private to your history unless you create a share link. You can revoke a share link at any time.</p>
      <h2>Deletion</h2>
      <p>You can remove analyses from your history in the dashboard. To delete your account entirely, open an issue on GitHub.</p>
    </article>
  );
}
