import { Masthead } from "@/components/masthead";
import { RepoSearch } from "@/components/repo-search";
import { PlateCard } from "@/components/landing/plate-card";
import { SnapSection } from "@/components/landing/snap-row";
import { Specimen } from "@/components/landing/specimen";
import { LighthouseScene } from "@/components/landing/posters";

const EXAMPLES = [
  { owner: "vercel", repo: "next.js", note: "React framework" },
  { owner: "fastapi", repo: "fastapi", note: "Python web API" },
  { owner: "sindresorhus", repo: "got", note: "HTTP client" },
  { owner: "charmbracelet", repo: "bubbletea", note: "Go TUI library" },
];

const STEPS = [
  { title: "Paste a link", body: "Any github.com repository, branch, folder or file URL." },
  { title: "Open a file", body: "Browse the tree. The code sits on the plate with line numbers, in any branch or tag." },
  {
    title: "Pick a reading",
    body: "Overview for a quick summary, Deep dive for a section-by-section walkthrough, Code review for issues ranked by severity.",
  },
  { title: "Follow line refs", body: "Every claim cites lines like L42-L57. Click one and the code jumps straight there." },
  { title: "Keep and share", body: "Every analysis lands in your dashboard history. Share a read-only link in one click." },
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
    a: "Only the public file you choose to analyze is sent to the Gemini API, together with a short list of file paths for context. Your GitHub token is never stored in our database.",
  },
];

export default function LandingPage() {
  return (
    <div className="page flex flex-col gap-12 sm:gap-[72px]">
      <Masthead
        variant="display"
        intro
        title="Understand any GitHub repository"
        blurb="Paste a GitHub link, open any file, and read what it does, with every claim tied to its lines."
        poster={<LighthouseScene slice />}
        after={<RepoSearch autoFocus hint />}
      />

      <SnapSection label="Try a repository">
        {EXAMPLES.map((e, i) => (
          <PlateCard key={`${e.owner}/${e.repo}`} {...e} n={i + 1} intro />
        ))}
      </SnapSection>

      <Specimen />

      <section id="how" className="section-ruled scroll-mt-20">
        <h2 className="section-label marker-jungle">How it reads</h2>
        <ol className="ruled-list">
          {STEPS.map((s, i) => (
            <li key={s.title} className="grid gap-1 py-4 sm:grid-cols-[40px_minmax(0,220px)_minmax(0,1fr)] sm:gap-6">
              <span aria-hidden className="font-mono text-[13px] leading-6 text-label tabular">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="text-[17px] font-semibold leading-6">{s.title}</h3>
              <p className="max-w-[60ch] text-ink-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section-ruled">
        <h2 className="section-label marker-moon">Fine print</h2>
        <dl className="ruled-list">
          {FAQ.map((item) => (
            <div key={item.q} className="grid gap-1 py-4 sm:grid-cols-[minmax(0,320px)_minmax(0,1fr)] sm:gap-6">
              <dt className="text-[17px] font-semibold leading-6">{item.q}</dt>
              <dd className="max-w-[62ch] text-ink-muted">{item.a}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6">
          Something else?{" "}
          <a href="https://github.com/Arnavsharma2005/codexplain/issues" rel="noreferrer" className="chrome-link font-semibold">
            Report an issue →
          </a>
        </p>
      </section>
    </div>
  );
}
