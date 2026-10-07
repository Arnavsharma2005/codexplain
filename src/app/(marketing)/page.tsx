import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  Bug,
  Database,
  FolderTree,
  Link2,
  MousePointerClick,
  Share2,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { RepoSearch } from "@/components/repo-search";

const EXAMPLES = [
  { owner: "vercel", repo: "next.js", note: "React framework" },
  { owner: "fastapi", repo: "fastapi", note: "Python web API" },
  { owner: "sindresorhus", repo: "got", note: "HTTP client" },
  { owner: "charmbracelet", repo: "bubbletea", note: "Go TUI library" },
];

const FEATURES = [
  { icon: FolderTree, title: "Browse any repo instantly", body: "Paste a URL and get the full file tree, branch and tag switching, and fuzzy file search." },
  { icon: Sparkles, title: "Three analysis modes", body: "A quick Overview, a section-by-section Deep dive, or a severity-ranked Code review." },
  { icon: MousePointerClick, title: "Clickable line references", body: "Every claim cites lines like L42-L57. Click one and the code view jumps straight there." },
  { icon: Zap, title: "Streams in real time", body: "Results stream as they are written. Repeat views of the same file version load instantly from cache." },
  { icon: Share2, title: "Share and keep history", body: "Every analysis is saved to your dashboard. Share a read-only link with your team in one click." },
  { icon: ShieldCheck, title: "Private by design", body: "Read-only GitHub sign-in with public scopes only. Your GitHub token is never stored in our database." },
];

const STEPS = [
  { icon: Link2, title: "Paste a link", body: "Any github.com repository, branch, folder or file URL works." },
  { icon: BookOpenText, title: "Open a file", body: "Explore the tree and read syntax-highlighted code with line numbers." },
  { icon: Bug, title: "Get the analysis", body: "Pick a mode and get an explanation or a review in seconds." },
];

const FAQ = [
  {
    q: "Which repositories can I analyze?",
    a: "Any public GitHub repository. Private repositories are not supported, and we only ever request read access to public data.",
  },
  {
    q: "Which AI model powers Codexplain?",
    a: "Google's Gemini. Each mode is tuned differently: Overview favours speed, while Deep dive and Code review think harder.",
  },
  {
    q: "Is it free?",
    a: "Yes. Every account gets a daily allowance of new analyses. Opening an analysis someone already generated for the same file version is always free.",
  },
  {
    q: "Is my code sent anywhere?",
    a: "Only the public file you choose to analyze is sent to the Gemini API, together with a short list of file paths for context.",
  },
];

export default function LandingPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-6 pb-20 pt-20 text-center sm:pt-28">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" /> AI code explanations, powered by Gemini
          </span>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            Understand any GitHub repository <span className="text-primary">in minutes</span>
          </h1>
          <p className="mt-5 max-w-2xl text-pretty text-lg text-muted-foreground">
            Paste a link, open any file, and get a clear explanation or a rigorous code review, with every claim linked
            to the exact lines it describes.
          </p>
          <div className="mt-10 w-full max-w-2xl">
            <RepoSearch autoFocus />
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="text-muted-foreground">Try:</span>
            {EXAMPLES.map((e) => (
              <Link
                key={`${e.owner}/${e.repo}`}
                href={`/r/${e.owner}/${e.repo}`}
                className="rounded-lg border border-border bg-card px-2.5 py-1 font-mono text-[13px] text-foreground/90 transition-colors hover:border-primary/50 hover:text-primary"
                title={e.note}
              >
                {e.owner}/{e.repo}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-muted/30">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="flex gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <s.icon className="size-5" />
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Step {i + 1}</div>
                <h3 className="mt-1 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">Everything you need to read code faster</h2>
          <p className="mt-3 text-muted-foreground">
            Built for onboarding onto new codebases, studying open source, and reviewing code before you depend on it.
          </p>
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40">
              <f.icon className="size-5 text-primary" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-24 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Questions, answered</h2>
            <p className="mt-3 text-muted-foreground">Something else on your mind? Open an issue on GitHub.</p>
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Database className="size-4" /> Analyses are cached per file version, so results stay consistent.
            </div>
          </div>
          <dl className="divide-y divide-border rounded-2xl border border-border bg-card">
            {FAQ.map((item) => (
              <div key={item.q} className="p-6">
                <dt className="font-medium">{item.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h2 className="text-3xl font-semibold tracking-tight">Start with a repository you&apos;re curious about</h2>
        <p className="mt-3 text-muted-foreground">No setup. Sign in with GitHub when you&apos;re ready to generate analyses.</p>
        <div className="mx-auto mt-8 max-w-xl">
          <RepoSearch />
        </div>
        <Link href="/r/vercel/next.js" className="mt-6 inline-flex items-center gap-1 text-sm text-primary hover:underline">
          Or open a sample repository <ArrowRight className="size-4" />
        </Link>
      </section>
    </>
  );
}
