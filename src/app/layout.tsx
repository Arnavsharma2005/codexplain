import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Sarabun } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const sarabun = Sarabun({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  preload: true,
  variable: "--font-sarabun",
  fallback: ["Bahnschrift", "DIN Alternate", "Avenir Next Condensed", "Roboto Condensed", "Arial Narrow", "system-ui", "sans-serif"],
});
const plexMono = IBM_Plex_Mono({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  preload: false, // code is never the LCP on the landing page
  adjustFontFallback: false, // fall back to a real monospace, not Arial
  variable: "--font-plex-mono",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
});

const siteUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Codexplain: understand any GitHub repository", template: "%s · Codexplain" },
  description:
    "Paste a GitHub URL, browse the code, and get clear AI explanations and code reviews of any file, with clickable line references.",
  openGraph: {
    title: "Codexplain",
    description: "AI explanations and code reviews for any file in any public GitHub repository.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2e5c3" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

// Marks the first visit of this tab session so the landing intro plays once (docs/DESIGN.md §2.9).
const INTRO_SCRIPT = `try{if(!sessionStorage.getItem("cx-intro")){document.documentElement.dataset.intro="1";sessionStorage.setItem("cx-intro","1")}}catch(e){}`;

// Mockup only: picks one of the two night palettes for comparison, from ?night= or the saved choice.
// <html data-night="ink"> (default) or "charcoal"; only matters when the dark theme is on.
const NIGHT_SCRIPT = `try{var n=new URLSearchParams(location.search).get("night");if(n==="ink"||n==="charcoal")localStorage.setItem("cx-night",n);else n=localStorage.getItem("cx-night");document.documentElement.dataset.night=n==="charcoal"?"charcoal":"ink"}catch(e){document.documentElement.dataset.night="ink"}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sarabun.variable} ${plexMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: INTRO_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: NIGHT_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
