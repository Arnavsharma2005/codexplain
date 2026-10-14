# Codexplain redesign: build spec

**Codexplain is a printed field guide for code.** Pages look like grained cream paper with navy ink. Orange is the lead accent, with three poster accents (teal, moon yellow, jungle green) used only as small markers and chips. Corners are square, the type is bold and compact, and rules are either thick or hairline. Code sits in a navy, VS Code-style editor with a file tab strip. The workspace uses ZedBit's split: the analysis reads as a solid ivory sheet on the left, the editor sits on the right, and the file tree folds into a slim rail. The landing page carries flat screen-printed poster illustrations in the wavz.us style. Dark mode is a single charcoal-and-ember theme. The behaviour stays the same as the app's today.

This file is the build spec. Each section says what to build, in which file, and with exact values. Where the six analyst reports disagreed, §0 records the decision; follow §0 over any analyst note.

- Repo: `/home/claude/codexplain` (Next.js 16.4, React 19.3, Tailwind 4, shiki 4.5, sonner 2, Radix).
- Next.js docs for this version: `node_modules/next/dist/docs/` (read `01-app/03-api-reference/02-components/font.md`, `03-file-conventions/not-found.md`, `03-file-conventions/loading.md` → "Status codes", `02-guides/view-transitions.md`).
- Tests that must keep passing unchanged: `tests/e2e/anonymous.spec.ts`, `signed-in.spec.ts`, `mobile.spec.ts`. Section 5 lists every hook they use.

---

## 0. Decisions on analyst conflicts

| Topic | Options on the table | Decision |
|---|---|---|
| Muted ink | #5e626a / #47506a / #525863 | **#4d5468** (6.03:1 on paper, 5.39:1 on sunk paper) |
| Dark theme | several candidates | **Charcoal and ember** (`.dark`, §2.1), the only dark theme. Neutral greys, no grain, hairline rules; the accents fold into orange and teal. |
| Dark label colour | several | **#f0a06c** (8.79:1 on charcoal paper) |
| Focus ring | 2px ink / 3px rust / 2px ink | **2px solid `--focus`, offset 2px.** `--focus` is ink on paper and orange in dark mode and in the editor. |
| Header bottom edge | 1px hairline / 2px ink | **2px ink** |
| Fonts | Plex 400 only / 400+500 / 400+600; Google vs Fontsource | **next/font/google: Sarabun 500/600/700 + IBM Plex Mono 400.** 4 files, 48.6 KiB. Reasons are in §2.2. |
| Grain | inline canvas script / static PNG / SVG turbulence | **Static 128px indexed PNG, 4 alpha levels, 4.1 KB**, painted on `html` in light mode only. The cream-speck tile is reused as the print texture on posters. No grain in dark mode. No JS. |
| Shiki theme | css-variables theme / github-dark-default only | **`createCssVariablesTheme({ fontStyle: false })`**, one theme, with colours from our tokens (§2.1 Syntax) |
| Analysis surface | cream paper / near-white code sheet / ivory sheet | **A solid ivory sheet** (`--sheet` #faf5e8, no grain, 1px `--sheet-edge` sides) for the analysis column; the tree and running head stay on grained paper. |
| Code surface | navy plate / light code sheet / editor | **A navy VS Code-style editor** (`--plate` #0f1a30) with a 40px file tab strip, quiet icon tools and a full-width current-line band. Navy in light mode, near-black neutral in dark mode. |
| Illustrations | none / posters | **Flat screen-printed posters** on the landing masthead and the try-a-repository cards (§3.24). Nowhere else. |
| Code line height | 20.8px / 21px / 1.65 / 24px | **14px/24px** code, 13px line numbers (whole pixels) |
| Gutter | 40px+16 / 3.5rem | **56px number column + 16px gap = 72px**, so the 72px click zone in `code-viewer.tsx` stays correct |
| Tree active row | inverse fill / orange bar | **`--paper-sunk` fill + 3px orange left bar + ink text** |
| Toast | plate block / inverse ink / paper + border | **Inverse ink block**: navy with cream text in light mode, cream with charcoal text in dark mode, and a 3px orange rule under the title |
| Tooltips | Radix / remove | **Remove Radix Tooltip.** A CSS `data-tip` tooltip goes only on controls that already have an `aria-label`. |
| Landing order | specimen first / try first | **Masthead → Try a repository → Specimen → How it reads → Fine print.** The primary task comes first, and the plates are the wavz poster row. |
| Landing h1 | giant wordmark / headline | **The h1 is the headline "Understand any GitHub repository"**, set big in uppercase. The wordmark lives in the header. |
| Intro motion | letters rise ≤1.4s / rule only | **Only the rule draws and the try plates deal in, 600ms in total, once per session.** The h1 and blurb never animate, because they are the LCP element. |
| `loading.tsx` for `/r/...` | add / not | **Do not add it at the route segment.** It starts streaming before `notFound()` and turns the 404 into a 200 (`loading.md` → Status codes). Stream inside the page with `<Suspense>` instead (§6). |
| Workspace chrome | merged 56px bar / header + running head | **Header 56 + running head 44** on desktop. On mobile it is 48 + 44 + 44 tabs = 136px. |
| Badges | Shared ink / rust outline / poster fills | NEW: orange fill. CACHED: moon fill. SHARED: teal fill. |

---

## 1. Principles and anti-patterns

### 1.1 Principles

1. **Paper, ink, one lead accent.** Every surface is paper (grained cream in light mode, charcoal in dark mode), the ivory analysis sheet, or the navy editor. Text uses exactly two inks, `--ink` and `--ink-muted`, plus `--label` for small uppercase labels. Orange is the lead accent: a fill, rule or marker on paper, never text on paper (2.23:1). Teal, moon and jungle are poster accents for small markers, chips and badge fills only, never for text on paper (their `*-ink` variants are the text versions).
2. **Printed, not floating.** Square corners, solid fills, and solid 1, 2, 4 and 6px rules. There are no shadows, gradients, blur, translucent fills or hover lifts.
3. **Type does the work.** Sarabun 700 uppercase for headings and labels, Sarabun 500 for reading, and IBM Plex Mono for code identity (paths, repo names, refs, line refs). Code identity always keeps its original case.
4. **Left-aligned and ruled.** Each page opens with a masthead: a big left-aligned title, a short blurb on the right (on the landing page, a poster on the right and the blurb under the title), then one 6px orange rule. Below that come sections, each with an uppercase rust label led by a 12px colour marker. Lists are ruled rows, not cards.
5. **Caption everything like a plate.** Name line + catalog line, e.g. `index.ts` / `SRC/ · TYPESCRIPT · 13 LINES · 382 B`, and `No. 01` numbering.
6. **Posters are the only pictures.** The landing masthead and the try-a-repository cards carry flat screen-printed poster scenes (§3.24). Everywhere else the editor is the only picture. There are no stock images, screenshots, emoji or icon tiles.
7. **Motion is feedback.** A 120ms colour change on hover and focus. One short intro on the landing page, once per session. Nothing moves while you scroll. Nothing moves at all under reduced motion.
8. **Same app underneath.** Every route, parameter, accessible name and test hook stays the same (§5).

### 1.2 Anti-patterns (remove on sight)

- Purple, blue or violet UI colour, including the `oklch(... 268)` primaries, `#4f5ee0` and the `text-primary` blue links. (Poster skies and the editor's constant and link tokens are the only blues.)
- Gradients, including `bg-grid`, `mask-image: radial-gradient`, `linear-gradient` and `color-mix` fades. Posters are flat shapes too.
- Shadows of any kind: `shadow-*`, `box-shadow`, and `filter: brightness`.
- `rounded-*` other than the allowed pill and circle exceptions (§2.6).
- Translucent or blurred chrome: `bg-background/80`, `backdrop-blur`, `bg-card/40`, `bg-primary/10`.
- A centred hero, a pill badge above the h1, a row of three step boxes, a six-card feature grid, or a second CTA section.
- Tinted icon tiles in empty states, the `Sparkles` and `Zap` icons, rainbow file icons, and emoji.
- Centred empty states. Empty and error states are left-aligned.
- Spinners next to static text. A status line plus the caret is enough.
- Text under 12px. Placeholders lighter than `--ink-muted`.
- Hiding a button's only text with `display:none` (`hidden sm:inline`).
- Body text wider than 68ch. The current analysis runs at about 90–100 characters per line.

---

## 2. Tokens

All tokens live in `src/app/globals.css`. §2.10 has the full block to paste.

### 2.1 Colour

#### Light theme (`:root`, the default; `providers.tsx` `defaultTheme="light"`)

| Token | Hex | Use |
|---|---|---|
| `--paper` | `#f2e5c3` | page background (under the grain), site header, running head, tree |
| `--paper-raised` | `#faf3e0` | inputs, menus, drawer, popovers (solid, no grain) |
| `--paper-sunk` | `#e9d9b0` | inline code, row hover, active tree row, skeleton bars |
| `--sheet` | `#faf5e8` | **the ivory analysis sheet**: the workspace document column, the colophon bar and the landing specimen document. Solid, no grain. |
| `--sheet-edge` | `#d6cdb4` | 1px left and right edge of the sheet (decoration only) |
| `--panel` | `transparent` | tree column and running head, so the paper grain shows through |
| `--ink` | `#0e1c3a` | all content text, control borders |
| `--ink-muted` | `#4d5468` | secondary text, placeholders, inactive tabs |
| `--hairline` | `#c0b9a5` | 1px decorative dividers only (never the only edge of a control) |
| `--rule` / `--rule-w` | `#0e1c3a` / `2px` | structural rules: section tops, ruled lists, mode tab strip, analysis h2, drawer edge |
| `--edge` | `#0e1c3a` | control borders (`border-ink` resolves to this in dark mode) |
| `--orange` | `#f07a2e` | lead accent: primary fill, 6px rule, tab bar, line-ref underline, markers, meter fill |
| `--on-orange` | `#0e1c3a` | text on orange |
| `--label` | `#8f4520` | small uppercase labels, captions, numbers |
| `--focus` | `#0e1c3a` | focus outline |
| `--danger` | `#9b2a1a` | error text and borders |
| `--success` | `#2d6a3a` | success text (rare; the Copied check) |
| `--warning` | `#7a4d00` | warning text (truncated tree note) |
| `--ref-hover` | `#f7cfa6` | line-ref hover and focus fill |
| `--selection` | `#f6d98a` | `::selection` |
| `--row-bar` | `#0e1c3a` | selected tree / filter row bar (orange fails 1.4.11 on sunk paper) |

**Poster accents.** Fills carry text only in their `on-*` colour; the `*-ink` variants are the text versions that pass 4.5:1 on paper and on the sheet.

| Accent | Fill | `on-*` | `*-ink` | Used for |
|---|---|---|---|---|
| teal | `#2f7f86` | `#fffdf7` (4.59) | `#1f5f66` | Deep dive tab/chip, SHARED badge, Specimen and Saved markers, h2 chip 2 |
| moon | `#f2c14e` | `#0e1c3a` (10.04) | `#6e4e00` | CACHED badge, Fine print and In history markers, plate-card hover, h2 chip 4 |
| jungle | `#3d7a45` | `#fffdf7` (5.07) | `#2f6136` | Code review tab/chip, How it reads and Recently viewed markers, h2 chip 3 |

Orange stays the lead: Overview tab/chip, NEW badge, the accent rule, the default marker and h2 chip 1.

#### Dark theme: charcoal and ember (`.dark` on `<html>`)

The only dark theme. Neutral charcoal greys, cream ink, and only two accents: orange (ember) and teal. Moon and jungle fold into a light ember and a light teal so every marker still reads. No grain; structural rules drop to 1px `--rule`, and controls get a quiet `--edge` instead of a 2px cream line (`.dark .border-ink { border-color: var(--edge) }`). The site header and running head sit on `--panel`. `themeColor` for `prefers-color-scheme: dark` is `#131316`.

| Token | Hex | Note |
|---|---|---|
| `--paper` | `#131316` | page background |
| `--paper-raised` | `#232329` | inputs, menus, drawer |
| `--paper-sunk` | `#26262d` | hover, active rows, inline code |
| `--sheet` | `#1b1b20` | analysis sheet |
| `--sheet-edge` | `#2a2a31` | |
| `--panel` | `#1b1b20` | site header, running head, tree |
| `--ink` | `#f2e5c3` | cream |
| `--ink-muted` | `#b2aa98` | |
| `--hairline` | `#2a2a31` | |
| `--rule` / `--rule-w` | `#34343c` / `1px` | |
| `--edge` | `#77777f` | control borders, ≥3:1 on every dark surface (3.38 on sunk) |
| `--orange` | `#f07a2e` | unchanged; may be text in dark mode (6.65:1) |
| `--on-orange` | `#131316` | |
| `--label` | `#f0a06c` | (rust is too dark on charcoal) |
| `--focus` | `#f07a2e` | |
| `--danger` | `#f39c84` | |
| `--success` | `#7fcac4` | light teal |
| `--warning` | `#f5b47e` | light ember |
| `--ref-hover` | `#4a3326` | |
| `--selection` | `#3d3d47` | |
| `--row-bar` | `#f07a2e` | |
| `--teal` / `--on-teal` / `--teal-ink` | `#2f7f86` / `#fffdf7` / `#7fcac4` | |
| `--moon` / `--on-moon` / `--moon-ink` | `#f5b47e` / `#131316` / `#f5b47e` | moon becomes light ember |
| `--jungle` / `--on-jungle` / `--jungle-ink` | `#7fcac4` / `#131316` / `#7fcac4` | jungle becomes light teal |
| `--toast-bg` / `--toast-fg` | `#f2e5c3` / `#131316` | the toast inverts to a cream block |
| `--toast-hover` / `--toast-icon` / `--toast-focus` | `#e2d2a8` / `#a33d12` / `#131316` | |

#### Code editor (navy, VS Code-style, in both themes)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--plate` | `#0f1a30` | `#0e0e11` | editor background, active tab |
| `--plate-tabs` | `#0b1426` | `#161619` | tab strip background |
| `--plate-border` | `#0b1426` | `#2a2a31` | 1px editor edge |
| `--plate-fg` | `#e3ddcd` | `#e3ddcd` | code and tab text |
| `--plate-muted` | `#7c88a0` | `#7c88a0` | line numbers, tool icons at rest, editor meta |
| `--plate-label` | `#f2955a` | `#f2955a` | "CODE" label, active tab file icon |
| `--plate-rule` | `#1d2a44` | `#222228` | tab strip bottom edge, skeleton bars, scrollbar thumb |
| `--plate-hover` | `#1a2742` | `#202026` | tool hover and pressed fill |
| `--plate-hl` | `#172440` | `#1a1a20` | current-line band (full width, gutter included) |
| `--plate-selection` | `#2a3d63` | `#34343e` | `::selection` in the editor |
| `--plate-focus` | `#f2955a` | `#f2955a` | focus ring in the editor |
| `--plate-bar` | `#f07a2e` | `#f07a2e` | 2px active-tab top bar and current-line gutter marker |

#### Syntax (`--shiki-*` from the css-variables theme; same values in both themes)

A calm poster palette: orange keywords, sand strings, teal functions, sky constants. Every token passes 4.5:1 on the editor, the tab strip and the current-line band in both themes.

| Variable | Hex | on `#0f1a30` | on hl `#172440` | on `#0e0e11` | on hl `#1a1a20` |
|---|---|---|---|---|---|
| `--shiki-foreground` | `#e3ddcd` | 12.79 | 11.37 | 14.22 | 12.78 |
| `--shiki-token-keyword` | `#f2955a` | 7.62 | 6.77 | 8.46 | 7.61 |
| `--shiki-token-string`, `--shiki-token-string-expression` | `#e9cf8a` | 11.36 | 10.09 | 12.63 | 11.35 |
| `--shiki-token-function` | `#6cc8cf` | 8.92 | 7.93 | 9.91 | 8.91 |
| `--shiki-token-constant` | `#89c2f0` | 9.12 | 8.10 | 10.13 | 9.10 |
| `--shiki-token-parameter` | `#c9d3e6` | 11.52 | 10.23 | 12.80 | 11.50 |
| `--shiki-token-comment` | `#8794ab` | 5.66 | 5.03 | 6.29 | 5.65 |
| `--shiki-token-punctuation` | `#a3adc0` | 7.68 | 6.82 | 8.53 | 7.67 |
| `--shiki-token-link` | `#89c2f0` | 9.12 | 8.10 | 10.13 | 9.10 |
| `--shiki-token-inserted` | `#8fd19e` | 9.73 | 8.65 | 10.81 | 9.72 |
| `--shiki-token-deleted` | `#f28b7b` | 7.23 | 6.42 | 8.03 | 7.22 |
| `--shiki-token-changed` | `#e9cf8a` | 11.36 | 10.09 | 12.63 | 11.35 |
| `--shiki-background` | `transparent` | (the editor shows through) | | | |

#### Toast

| Token | Light | Dark |
|---|---|---|
| `--toast-bg` | `#0e1c3a` | `#f2e5c3` |
| `--toast-fg` | `#f2e5c3` | `#131316` |
| `--toast-hover` | `#22335a` | `#e2d2a8` |
| `--toast-icon` | `#f07a2e` | `#a33d12` |
| `--toast-focus` | `#f07a2e` | `#131316` |

#### Allowed text/background pairs (WCAG 2.x contrast, computed)

| Theme | Text | Background | Ratio |
|---|---|---|---|
| Light | ink #0e1c3a | paper #f2e5c3 / sheet #faf5e8 | 13.46 / 15.48 |
| Light | ink | paper-raised #faf3e0 / paper-sunk #e9d9b0 | 15.22 / 12.05 |
| Light | ink-muted #4d5468 | paper / sheet / sunk | 6.03 / 6.93 / 5.39 |
| Light | label #8f4520 | paper / sheet / sunk | 5.52 / 6.35 / 4.94 |
| Light | danger #9b2a1a | paper / sheet | 6.12 / 7.04 |
| Light | success #2d6a3a | paper / sheet | 5.19 / 5.96 |
| Light | warning #7a4d00 | paper / sheet | 5.81 / 6.68 |
| Light | teal-ink / moon-ink / jungle-ink | paper | 5.81 / 6.09 / 5.82 |
| Light | on-orange #0e1c3a | orange #f07a2e | 6.04 |
| Light | on-teal / on-moon / on-jungle | teal / moon / jungle | 4.59 / 10.04 / 5.07 |
| Light | ink | ref-hover #f7cfa6 / selection #f6d98a | 11.58 / 12.21 |
| Dark | ink #f2e5c3 | paper #131316 / sheet #1b1b20 | 14.81 / 13.70 |
| Dark | ink | paper-raised #232329 / paper-sunk #26262d | 12.48 / 12.00 |
| Dark | ink-muted #b2aa98 | paper / sheet / sunk | 8.03 / 7.43 / 6.51 |
| Dark | label #f0a06c | paper / sheet / sunk | 8.79 / 8.13 / 7.12 |
| Dark | orange #f07a2e (text allowed in dark) | paper / sunk | 6.65 / 5.39 |
| Dark | danger #f39c84 | paper / sunk | 8.74 / 7.08 |
| Dark | success, teal-ink, jungle #7fcac4 | paper / sunk | 9.84 / 7.98 |
| Dark | warning, moon #f5b47e | paper / sunk | 10.34 / 8.38 |
| Dark | on-orange #131316 | orange | 6.65 |
| Dark | on-teal / on-moon / on-jungle | teal / moon / jungle | 4.59 / 10.34 / 9.84 |
| Dark | ink | ref-hover #4a3326 / selection #3d3d47 | 9.36 / 8.57 |
| Editor | plate-fg #e3ddcd | plate light / dark | 12.79 / 14.22 |
| Editor | plate-muted #7c88a0 | plate light / dark | 4.86 / 5.40 |
| Editor | plate-label #f2955a | plate / tabs, light | 7.62 / 8.07 |
| Editor | plate-fg | plate-selection light / dark | 7.96 / 9.08 |
| Toast | toast-fg | toast-bg, light / dark | 13.46 / 14.81 |

**Forbidden for text or meaningful icons:** orange on paper (2.23) or on the sheet (2.56), paper on orange, the poster fills (teal, moon, jungle) as text on light paper, hairline as text, and plate-muted on the current-line band (4.32). A highlighted line's number switches to plate-fg.

**Non-text contrast (WCAG 1.4.11):**

| Element | Pair | Ratio |
|---|---|---|
| Focus ring, light | ink on paper | 13.46 |
| Focus ring, dark | orange on charcoal | 6.65 |
| Focus ring, editor | `#f2955a` on plate | 7.62 / 8.46 |
| Control borders, light | 2px ink on paper | 13.46 |
| Control borders, dark | `--edge` #77777f on paper / sunk | 4.18 / 3.38 |
| Active mode tab bar | 4px mode colour on the strip rule | the selected state is also carried by ink vs muted text and `aria-selected` |
| Quota meter | orange fill inside a 2px ink (dark: edge) outline | the value is also printed as text |
| Current line | 2px `--plate-bar` gutter marker on the band | 5.52 / 6.21; also carried by the band and the number colour |

Hairlines, `--sheet-edge` and the dark `--rule` (1.5) are decoration only.

### 2.2 Fonts

**Approach: `next/font/google`. Do not use `@fontsource`.**
- It is already the loading path (Geist), so there is no new dependency. Files self-host from `/_next/static/media`, which keeps CSP `font-src 'self' data:`.
- It generates `size-adjust` fallback metrics for Sarabun, which stops layout shift on swap.
- It injects preload links per subset.
- Fontsource would add two packages, ship CSS for every subset, and need `next/font/local` wiring by hand to get the same preload and fallback behaviour.

Measured latin woff2 sizes: Sarabun 500 = 11.7 KB, 600 = 11.7 KB, 700 = 11.6 KB, Plex Mono 400 = 14.7 KB. Total **48.6 KiB in 4 files**, within the 52 KB / 4-file budget. Do not add Sarabun 400, Plex 500/600, or any italic. Every weight is a separate file.

`src/app/layout.tsx`:
```tsx
import { Sarabun, IBM_Plex_Mono } from "next/font/google";

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
  preload: false,            // code is never the LCP on landing; avoids a 4th preload
  adjustFontFallback: false, // fall back to a real monospace, not Arial
  variable: "--font-plex-mono",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
});
// <html className={`${sarabun.variable} ${plexMono.variable}`}>
```
Remove `Geist` and `Geist_Mono`. Never use `display: "block"` or `"optional"`.

Weight usage:
- Sarabun **500**: body and meta.
- Sarabun **600**: blurb, h3, footer links, tab labels.
- Sarabun **700**: display, titles, uppercase labels, buttons, badges.
- Plex **400**: all mono. There is no bold mono; use colour, a bar or a fill for emphasis instead.

### 2.3 Type scale

All sizes are px. Tracking is in em. Uppercase comes only from CSS `text-transform`; DOM text stays in sentence case (§5).

| Role | Family / weight | Size / line-height | Tracking | Case | Where |
|---|---|---|---|---|---|
| `display` | Sarabun 700 | `clamp(36px, 6.4vw, 92px)` / 0.88; `clamp(36px, 5.6vw, 80px)` beside the landing poster | -0.01 | upper | landing h1 only |
| `numeral` | Sarabun 700 | `clamp(96px, 20vw, 200px)` / 0.82 | -0.02 | n/a | 404 "404" |
| `page-title` | Sarabun 700 | `clamp(32px, 5vw, 56px)` / 0.95 | -0.01 | upper | dashboard, login, legal, error h1 |
| `doc-title` | Sarabun 700 | 28/32 (24/28 under 640) | -0.01 | **original** | workspace file name, repo title page h1 |
| `path-title` | Plex 400 | 26/32 (20/26 under 640) | 0 | original | shared page h1 (the path), `break-all` |
| `h2-label` (section label) | Sarabun 700 | 15/20 (13/18 under 640) | 0.14 | upper | every section label, analysis h2, colour `--label` |
| `h3` | Sarabun 600 | 17/24 | 0 | sentence | analysis h3, row titles |
| `blurb` | Sarabun 600 | `clamp(17px, 2vw, 22px)` / 1.3 | 0 | sentence | masthead blurb, max-width 21em |
| `body` | Sarabun 500 | 16/26 | 0 | sentence | everything readable |
| `body-read` | Sarabun 500 | 17/28 | 0 | sentence | shared page and legal documents |
| `meta` | Sarabun 500 | 13/18 | 0 | sentence | times, sizes, helper text, `--ink-muted` |
| `ui` | Sarabun 700 | 14/16 | 0.08 (buttons 0.10) | upper | buttons, nav, tabs |
| `caption` | Sarabun 700 | 12/16 | 0.12 | upper | catalog lines, plate captions, colour `--label` |
| `badge` | Sarabun 700 | 12/12 | 0.10 | upper | New / Cached / Shared |
| `wordmark` | Sarabun 700 | 22/1 (18 under 640) | 0.02 | upper | header "Codexplain" |
| `footer` | Sarabun 600 | 15/20 (13 under 640) | 0.08 | upper | footer row, colour `--label` |
| `code` | Plex 400 | 14/24 (line numbers 13px) | 0 | original | code editor and landing specimen |
| `code-fenced` | Plex 400 | 13/21 | 0 | original | fenced code inside the analysis |
| `mono-ui` | Plex 400 | 13/18 | 0 | original | tree rows, paths in lists and captions, breadcrumbs |
| `mono-name` | Plex 400 | 15/20 | 0 | original | repo name in running head, list row names |
| `inline-code` | Plex 400 | 0.88em | 0 | original | in prose |
| `line-ref` | Plex 400 | 0.85em | 0 | original | `L6-L9` chips |

Rules:
- The minimum size anywhere is **12px**.
- Numbers (quota, counts, line numbers, `No. 01`) use `font-variant-numeric: tabular-nums`.
- `text-wrap: balance` on display and page titles. `text-wrap: pretty` on blurbs.

### 2.4 Spacing

Use the Tailwind 4px scale, allowed steps only: **4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 72, 96**.
- Page column (`.page`): `max-width: 1180px; margin-inline: auto; padding: clamp(20px,4vw,48px) clamp(16px,4vw,44px) 56px;`. Side gutter is 16px at 412px.
- Section rhythm: 72px between landing sections (48 under 640). 40px between dashboard sections. Label to content is 12px.
- List row padding is 16px block. Document padding is 32px 40px on desktop and 20px 16px on mobile.
- The workspace is full-bleed under the header and does not use `.page`.

### 2.5 Layout sizes

| Part | Desktop | Mobile (<1024) |
|---|---|---|
| Site header | 56px (incl. 2px rule) | 48px |
| Workspace running head | 44px | 44px |
| Mobile panel tabs | n/a | 44px |
| File rail | 48px | n/a |
| Tree column (in flow) | 264px | full width in the Files panel |
| Editor inset | 12px padding around the editor in its column (≥1024) | none |
| Tree drawer (overlay) | 320px | n/a |
| Editor tab strip | 40px (min) | 40px (min; wraps for Back to analysis) |
| Analysis colophon bar | 48px | ≥48px (wraps) |
| Mode tab strip | 44px | 44px |

Breakpoints are Tailwind's defaults (`sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536), plus `max-[560px]` for the masthead blurb.

### 2.6 Radius

- `border-radius: 0` on every surface: inputs, buttons, menus, tooltips, badges, skeletons, meter, plates, toasts, logo mark, `icon.svg`.
- **Exceptions:**
  - The **pill**: `rounded-full` 42×38px with a 2px ink border. It is used only for the theme toggle, the account trigger and the snap-row arrow buttons.
  - **Avatars** are circles.
- Enforce it in `@theme` with `--radius-*: initial`. In Tailwind 4.3 this removes `rounded-sm` through `rounded-3xl`; `rounded-none` and `rounded-full` remain. Then delete the leftover `rounded-*` classes (49 of them in `src/**/*.tsx`) so the markup is honest.

### 2.7 Borders and rules

| Width | Colour | Use |
|---|---|---|
| 6px | `--orange` | **the accent rule**: at most once per page, under the masthead or document title, full content width, margin `clamp(14px,2vw,22px) 0` |
| 4px | `--orange` (or the mode colour) | active mode tab (orange, teal or jungle) and mobile panel tab bar |
| 3px | `--orange` | link underline in page chrome (`border-bottom`, padding-bottom 2px), toast title bar, active tree row left bar |
| 2px | `--plate-bar` | active editor tab top bar (inset), current-line gutter marker |
| `--rule-w` (2px light, 1px dark) | `--rule` | under the site header, top of each dashboard/landing section list, analysis h2 top rule, mode tab strip baseline, drawer edge, table header, blockquote |
| 2px | `--ink` (dark: `--edge`) | control borders (inputs, secondary buttons, menus, pills), specimen frame |
| 2px | `--orange` | prose link underline, line-ref underline |
| 1.5px | currentColor | badges |
| 1px | `--hairline` | between list rows, rail edge, under the running head, table cells, `hr` |
| 1px | `--sheet-edge` | left and right of the analysis sheet, top of the colophon bar |
| 1px | `--plate-rule` | under the editor tab strip |
| 1px | `--plate-border` | around the editor |

No dashed or dotted borders.

### 2.8 Grain

- **What:** a static 128×128 indexed PNG with 4 alpha levels (0, 13, 27, 40 out of 255; max about 0.16, about half of wavz's strength). Two files are generated from the same noise:
  - `grain-paper.png`: navy specks, rgb 14,28,58. The light-mode page grain.
  - `grain-night.png`: cream specks, rgb 242,229,195. Now used only as the print texture over posters (`.poster::after`, opacity .55); the dark theme has no page grain.
  - Each is 4,131 bytes.
- **Where:** `src/app/_assets/grain-paper.png` and `src/app/_assets/grain-night.png` (`_` keeps the folder private to the router). They are referenced with `url()` from `globals.css` so the bundler fingerprints them. Commit the generator as `scripts/make-grain.py` (below).
- **How:** paint the grain on `html` as `background: var(--paper) url(...) repeat; background-size: 128px` (64px at ≥2dppx, so one tile pixel equals one device pixel). `html.dark` sets `background-image: none`. It sits under content, never in an overlay, never `position: fixed`, and uses no blend modes or filters. `body` must have **no background**.
- **Not on:** the editor, the ivory analysis sheet and colophon bar, inputs, menus, drawer, toasts or dialogs. Their solid fills cover it. It is dropped under `@media print` and `(forced-colors: active)` (posters drop their speck layer too).

```python
# scripts/make-grain.py  — run: python3 scripts/make-grain.py src/app/_assets
import random, struct, sys, zlib
N, LEVELS, MAX_ALPHA = 128, 4, 40
def png(rows, rgb):
    def chunk(t, d): return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    trns = bytes(round(i * MAX_ALPHA / (LEVELS - 1)) for i in range(LEVELS))
    raw = b"".join(b"\x00" + bytes(r) for r in rows)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", N, N, 8, 3, 0, 0, 0))
            + chunk(b"PLTE", bytes(rgb) * LEVELS) + chunk(b"tRNS", trns)
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))
random.seed(1)
rows = [[min(LEVELS - 1, int(abs((random.random() + random.random() + random.random()) / 3 - 0.5) * 2 * LEVELS))
         for _ in range(N)] for _ in range(N)]
out = sys.argv[1] if len(sys.argv) > 1 else "."
for name, rgb in (("grain-paper.png", (14, 28, 58)), ("grain-night.png", (242, 229, 195))):
    open(f"{out}/{name}", "wb").write(png(rows, rgb))
```

### 2.9 Motion

| Token | Value | Use |
|---|---|---|
| `--dur-fast` | 120ms | colour and background on hover, focus and press |
| `--dur-base` | 200ms | tree drawer slide (transform only), tab panel crossfade (optional) |
| `--dur-rule` | 600ms | masthead rule draw |
| `--dur-deal` | 420ms | try-plate deal-in |
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | deal-in, drawer |
| `--ease-draw` | `cubic-bezier(.6,0,.2,1)` | rule draw |
| caret blink | `1s steps(2, start) infinite` | streaming caret |
| skeleton pulse | opacity .55 → 1, 1.4s ease-in-out infinite alternate | skeletons |

**Intro (landing only, first visit per tab session):**
- An inline `<head>` script in `layout.tsx` runs before paint: `try{if(!sessionStorage.getItem("cx-intro")){document.documentElement.dataset.intro="1";sessionStorage.setItem("cx-intro","1")}}catch(e){}`. CSP already allows inline scripts, and `<html suppressHydrationWarning>` is already set.
- Under `html[data-intro] ` and `@media (prefers-reduced-motion: no-preference)`:
  - The `.accent-rule` on `/` draws from `scaleX(0)` to `1` from the left over 600ms with `--ease-draw`.
  - The 4 try plates deal in from `opacity:0; translateY(24px); clip-path: inset(0 0 100%)` to none over 420ms with `--ease-out`, staggered 60ms (the last ends at 600ms).
- The h1, blurb and input never animate. They are the LCP, and must paint on frame one.
- The intro never runs in the workspace, the dashboard or on any other route.

**After the intro:**
- Only colour and background transitions at `--dur-fast`.
- The drawer uses a `--dur-base` transform.
- No scale, lift, glow, parallax or scroll reveals. All scroll and touch listeners are passive.

**`prefers-reduced-motion: reduce`:**
- No intro.
- The caret is static (no blink).
- No skeleton pulse.
- The drawer opens instantly.
- `scrollIntoView({ behavior: "auto" })`; `code-viewer.tsx` currently hard-codes `"smooth"`.
- `::view-transition-*(*)` get `animation-duration: 0s`.

**View transitions:** optional and phase 6 only. Use React 19.3 `<ViewTransition>` (no config needed per `02-guides/view-transitions.md`) on the analysis body when switching mode tabs, 200ms crossfade at most, with `::view-transition { pointer-events: none }`. Never wrap the workspace root. Do not rely on CSS `@view-transition`: it covers only full page loads.

### 2.10 `globals.css`

`src/app/globals.css` is the source of truth for every value in §2.1; this spec no longer carries a copy to paste. Its order:

1. `@import "tailwindcss"` and `@custom-variant dark (&:where(.dark, .dark *))`.
2. `@theme` that strips Tailwind's colours, radii, shadows and blurs (`--color-*: initial`, and so on).
3. `:root`: the light tokens, poster accents, workspace surfaces (`--sheet`, `--panel`, `--rule`, `--edge`), editor tokens, `--shiki-*` syntax tokens, toast tokens and motion tokens.
4. `.dark`: the charcoal-and-ember overrides, the only dark theme. `next-themes` toggles the `.dark` class on `<html>`; `layout.tsx` carries no theme script of its own (only the intro script).
5. `@theme inline`: maps each token to a Tailwind colour (`bg-sheet`, `text-teal-ink`, `border-rule`, `bg-plate-tabs`, …) plus the font stacks.
6. `@layer base`: grain on `html` (none in dark), body type, selection and focus.
7. `@layer components`: page chrome, labels and markers, lists, tooltip, toast, skeleton, the editor (`.plate-tabstrip`, `.plate-tab`, `.plate-meta`, `.code-view`, `.specimen-code`), the analysis document, tabs and mode chips, the landing snap row, plate cards, posters and the hero masthead, the workspace grid, and the tree.
8. Unlayered: `.dark .border-ink { border-color: var(--edge) }`.

---

## 3. Components

Every component lists its file, anatomy, sizes, states, and light vs dark behaviour. "Ink", "paper", "rule" and "edge" mean the tokens, so the charcoal dark colours follow automatically unless a dark value is stated.

### 3.1 Site header (`src/components/site-header.tsx`)

**Anatomy:** `[wordmark] [compact repo input (md+, some routes)] [nav: How it works · Dashboard] [theme pill] [auth slot]`

- **Bar:**
  - 56px tall (48 under 1024).
  - `position: sticky; top: 0; z-index: 40`.
  - Solid `bg-paper` with no grain, because it would scroll over the grain. Wavz has no bar, so a solid paper bar is the closest equivalent.
  - `border-bottom: var(--rule-w) solid var(--rule)` (2px ink in light mode).
  - Padding 0 16px (24px at `sm`).
  - Remove `bg-background/80 backdrop-blur`.
- **Wordmark** (`src/components/logo.tsx` `Logo`):
  - The text "Codexplain" in `wordmark` style (700 22px uppercase .02em; 18px under 640).
  - It is a Link to `/` with `aria-label="Codexplain home"`.
  - Drop the `LogoMark` from the header; the wordmark is enough.
- **Compact repo input** (`RepoSearch size="sm"`):
  - Shown at ≥768px on every route except `/`, `/dashboard` and `/login`.
  - Render it through a tiny client `HeaderSearch` that reads `usePathname()` and returns `null` on those routes.
  - Max-width 420px, centred in the free space.
  - Workspace passes nothing special.
- **Nav links:**
  - Each is `ui` style, `--ink`, 32px min height, padding 0 8px.
  - Hover and active: `border-bottom: 3px solid var(--orange)` with padding-bottom 2px.
  - "How it works" goes to `/#how` and shows at ≥768px only.
  - "Dashboard" goes to `/dashboard` and shows **at every width** (remove `hidden sm:block`), with `prefetch={false}` on `/` only.
  - Under 640: 13px, letter-spacing .06em, gap 6px.
- **Theme toggle** (`theme-toggle.tsx`):
  - A pill: 42×38, `rounded-full`, 2px ink border, transparent fill, 16px Sun/Moon icon in ink.
  - Hover: `bg-paper-sunk`. Focus: ring.
  - `aria-label="Toggle color theme"` is kept.
- **Auth slot** (`user-menu.tsx`):
  - A fixed box (`width: 92px` desktop, 76px under 640; `display:flex; justify-content:flex-end`) so the session fetch never moves the nav.
  - **Loading:** an empty pill outline, 42×38.
  - **Signed out:** a secondary sm button "Sign in" (32px; GitHub icon at ≥640 only).
  - **Signed in:** a pill trigger, 42×38, 2px ink border, `aria-label="Account menu"`, holding a 24px **circle** avatar requested at `&s=48`.
  - The account dropdown (Radix) loads with `next/dynamic` only when `status === "authenticated"`.
- **Dark:** the bar is `--panel` (#1b1b20) with a 1px `--rule` and cream text.

**Mobile at 412px:** `CODEXPLAIN` (≈122px) · `DASHBOARD` (≈82px) · pill 42 · auth 76 · gaps 3×6 = 340px. That fits the 380px content width. On `/` and `/dashboard` the repo input is in the page, not the header. In the workspace on mobile, the Files panel carries it (§4.3).

### 3.2 Site footer (`src/components/site-footer.tsx`)

**Anatomy:** one row, wrapping on mobile.
- Left: `Codexplain · Built with Next.js and Gemini · © 2026`.
- Right: links `Privacy` · `Terms` · `Source` (https://github.com/Arnavsharma2005/codexplain) · `Report an issue` (…/codexplain/issues).

**Style and states:**
- `footer` style (600 15px uppercase .08em, `--label`).
- Top border 2px ink.
- Padding 24px 0 32px inside `.page` width.
- Links: `--label` text, `border-bottom: 3px solid var(--orange)`, padding-bottom 2px. On hover the text turns `--ink`.
- External links use `rel="noreferrer"`. Legal links use `prefetch={false}`.
- No logo mark.

**Rendered on:** every page, including `/login`, `app/not-found.tsx`, `app/error.tsx`, the repo not-found and repo-error pages, and `/a/[slug]`. **Not** on the workspace, which is full height.

### 3.3 Masthead (new `src/components/masthead.tsx`)

**Anatomy:** `<header class="masthead">` holding a flex row (`h1` + optional blurb), then children (input, meta), then `<hr class="accent-rule">`. Variants:
- `display`: landing.
- `page`: dashboard, login, legal, error.
- `numeral`: 404, with a big numeral above the h1.
- `poster` prop (landing only): the title row becomes `.masthead-hero`, a grid of `[h1 + blurb] [poster]`. At ≥900px the poster column is `minmax(0, 420px)` with a 40px gap and a 4/3 poster; below that the poster stacks under the title at 5/2 (`preserveAspectRatio="xMidYMid slice"`). The blurb sits under the h1, left-aligned, max 24em, and the display h1 shrinks to `clamp(36px, 5.6vw, 80px)`. The landing passes `<LighthouseScene slice />` (§3.24).

**Row** (no poster):
- `display:flex; flex-wrap:wrap; align-items:flex-end; justify-content:space-between; gap:24px`.
- Blurb: max-width 21em, right-aligned.
- At `max-[560px]` the blurb sits under the title, left-aligned.

**Order (wavz):** title row → accent rule → input (landing). The dashboard puts its input between the title row and the rule.

```css
.accent-rule { height: 6px; border: 0; background: var(--orange); margin: clamp(14px,2vw,22px) 0; transform-origin: left; }
@media (prefers-reduced-motion: no-preference) {
  html[data-intro] .accent-rule.is-intro { animation: rule-draw 600ms var(--ease-draw) both; }
  html[data-intro] .plate-card.is-intro { animation: deal-in 420ms var(--ease-out) both; animation-delay: calc(var(--i) * 60ms); }
}
@keyframes rule-draw { from { transform: scaleX(0); } }
@keyframes deal-in { from { opacity: 0; transform: translateY(24px); clip-path: inset(0 0 100%); } }
```
Only the landing masthead's rule and plates get `.is-intro`.

### 3.4 Section label (`.section-label`)

- An `h2` (or `p` when it is not a heading), in `h2-label` style: 700 15px uppercase .14em `--label`, `margin: 0 0 12px`.
- A 12px square **marker** precedes the text (`::before`, margin-right 10px), filled with `--marker`. Pick it with `.marker-orange` (default), `.marker-teal`, `.marker-moon` or `.marker-jungle`. As built: Try a repository orange, Specimen teal, How it reads jungle, Fine print moon; dashboard Analysis history orange, Saved teal, Recently viewed jungle.
- `.swatch` is the 10px inline version for captions and catalog lines (dashboard ledger, history mode).
- An optional right-aligned slot holds scroll arrows or a "N items" count (caption style).
- On landing and dashboard sections, a `--rule-w` `--rule` rule sits above the label (`.section-ruled`), with padding-top 12px.

### 3.5 Plate caption (`src/components/caption.tsx`)

**Anatomy:** a **name line** plus a **catalog line**.
- Name line: `h3` style, or `mono-name` when it is a path or repo (original case).
- Catalog line: `caption` style, parts joined by `" · "`, the number written `No. 01` (two digits).

**Examples:**
- `vercel/next.js` / `React framework · No. 01`
- `index.ts` / `src/ · TypeScript · 13 lines · 382 B`. Under CSS uppercase this prints `SRC/ · TYPESCRIPT · 13 LINES · 382 B`. Paths keep their case via `<span class="normal-case font-mono">`.
- `1 line` for single-line files (helper `plural(n, "line")`).

**Light vs dark:** the name is ink and the catalog is `--label` in both.

### 3.6 Buttons (`src/components/ui/button.tsx`)

Base, replacing the cva base:
```
inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap border-2 font-sans font-bold uppercase
tracking-[.1em] text-[14px] leading-none transition-colors duration-[120ms] cursor-pointer
disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0
```

| Variant | Rest | Hover | Active | Dark |
|---|---|---|---|---|
| `default` (primary) | bg + border `--orange`, text `--on-orange` | bg + border `--ink`, text `--paper` | same as hover | hover: cream fill, charcoal text (14.81) |
| `secondary` | transparent, 2px `--ink` border, ink text | ink fill, paper text | same | `--edge` border, cream text; hover cream fill, charcoal text |
| `outline` | alias of `secondary` (keep the name so callers don't change) | | | |
| `ghost` | no border (border-transparent), ink text | `border-bottom-color: var(--orange)` (3px bottom), text ink | | same |
| `ghost` icon sizes | 32×32 square, no border | `bg-paper-sunk` | | `bg-paper-sunk` (#26262d) |
| `plate` (buttons on the editor) | transparent, `--plate-fg` icon | `bg-plate-hover` | | same in both |
| `plate-quiet` (editor tab-strip tools) | transparent, `--plate-muted` icon | `bg-plate-hover`, `--plate-fg` icon | `aria-pressed`: same as hover | same in both |
| `plate-outline` | transparent, 2px `--plate-fg` border | `--plate-fg` fill, `--plate` text | | same in both |
| `destructive` | transparent, 2px `--danger` border, danger text | danger fill, paper text | | |
| `link` | ink text, 3px orange bottom border | text `--label` | | |

**Sizes:**
- `sm`: h-8 (32), px-3.
- `default`: h-10 (40), px-4.
- `lg`: h-12 (48), px-5.
- `hero`: h-14 (56), px-5, butts against the hero input.
- `icon`: 40×40.
- `icon-sm`: 32×32.
- Add `pointer-coarse:min-h-11 pointer-coarse:min-w-11` (44px) on all sizes.

**States:**
- `focus-visible`: the global ring (2px `--focus`, offset 2px). Inside `.on-plate` the ring is `--plate-focus`; on toasts it is `--toast-focus`.
- `disabled`: opacity .4 and `aria-disabled`. When a reason exists, print it as visible text next to the button, never in a tooltip.
- `loading`: keep the label and put a 16px `Loader2` before it, static under reduced motion. Set `aria-busy="true"` and `disabled` within 100ms of the click.
- **One primary per view:**
  - Landing: Explore.
  - Workspace document: Generate or Sign in to analyze.
  - Login: Continue with GitHub.
  - 404: Back to home.
  - Shared page: Open with the code.
  - Header Sign in is always secondary.

### 3.7 Input with button: repo search (`src/components/repo-search.tsx`)

**Anatomy:** `<form>` → `.repo-field` (input + flush submit button) → optional hint `<p>` → error `<p role="alert">`.

| | `lg` (landing hero) | `sm` (header, dashboard, 404, Files panel) |
|---|---|---|
| Height | 56px | 40px (36 in the header) |
| Field | `bg-paper-raised`, 2px ink border, no radius, Sarabun 500 18px, padding-left 16px | same, 15px, padding-left 12px |
| Search icon | removed | removed |
| Placeholder | `github.com/owner/repo` (fits 412px) | `Open another repository…` |
| Button | `hero` primary, flush on the right edge inside the border (no gap): `Explore →` | primary `sm` 32px inset (or flush 40px): `Go` |
| Hint | `meta` text under the field: "Repository, branch, folder and file links all work." | none |

**States:**
- `focus-within`: a 2px `--focus` outline at offset 2px around the whole field. The input itself has `outline: none`.
- `pending`: the button is disabled with `aria-busy` and the label is replaced by a 16px `Loader2` (static under reduced motion). The width is kept by a fixed `min-width: 120px` on lg and 48px on sm.
- `error`:
  - The border turns 2px `--danger`.
  - The message goes in `<p role="alert">`, 14px 600 `--danger`, 8px below the field, prefixed by a 16px `AlertTriangle` icon (`aria-hidden`).
  - The copy stays: "That doesn't look like a GitHub repository. Try github.com/owner/repo." and "Paste a GitHub repository URL to get started."
  - `aria-invalid` and `aria-describedby` point at an id from **`useId()`** (fixes the duplicate `repo-search-error`).

**Accessibility:**
- `aria-label="GitHub repository URL"` is kept.
- Keep `workspaceHref()` exactly as is.

**Dark:** field `--paper-raised` #232329, 2px `--edge` border.

### 3.8 Analysis mode tabs (`analysis-panel.tsx`)

**Anatomy:** `role="tablist"` `aria-label="Analysis mode"` → 3 × `button role="tab"`. Each tab has:
- an `aria-hidden` number chip `01` / `02` / `03` (`.mode-chip`: Plex 13/20, padding 0 5px, filled with the mode colour and its `on-*` text),
- the label `Overview` / `Deep dive` / `Code review` (the `ui` style, uppercase by CSS),
- a status mark.

**Sizes:**
- Strip height 44px. The strip sits on a **`--rule-w` `--rule` baseline** (2px ink in light mode, 1px in dark).
- Each tab: min-height 44px, padding 0 16px, `ui` style at 600 weight. The bar is drawn with `border-bottom: 4px solid transparent; margin-bottom: calc(-1 * var(--rule-w))` so the 4px bar sits over the baseline.
- **Mode colours** (`.mode-overview`, `.mode-deep`, `.mode-review` set `--mode` / `--on-mode`): Overview orange, Deep dive teal, Code review jungle (light teal in dark mode).
- No pill backgrounds, no radius.

**States:**
- Inactive: `--ink-muted`.
- Hover: `--ink`.
- Active (`aria-selected=true`): `--ink` text and a 4px bar in the mode colour.
- Focus-visible: ring, inset by `outline-offset: -4px` so it isn't clipped.
- Status marks are `aria-hidden` and do not change the name:
  - Streaming: a 6px orange square that blinks 1s steps(2) (static under reduced motion).
  - Done: a 6px ink square.
  - Remove `aria-label="ready"` and the spinner.

**Keyboard:** roving tabindex. Left/Right move and select, Home/End jump. Each tab has `id` and `aria-controls="analysis-panel-<mode>"`, and the body is `role="tabpanel"` with `aria-labelledby`.

**Rendering:** only when a **text** file is open, so not at the repo root, not for binary or too-large files, and not while the file loads. Accessible names stay exactly `Overview`, `Deep dive`, `Code review`.

**Dark:** a 1px `--rule` baseline; chips and bars keep the mode colours.

### 3.9 Badges and meta (`src/components/ui/badge.tsx`)

**Base:** `inline-flex items-center border-[1.5px] px-1.5 pt-[3px] pb-[2px] text-[12px] font-bold uppercase tracking-[.1em] leading-none`. No icons. Fills are solid poster colours, never tints.

| Variant | Use | Style |
|---|---|---|
| `new` | fresh analysis | bg + border `--orange`, text `--on-orange` |
| `cached` | from cache | bg + border `--moon`, text `--on-moon` |
| `shared` | history row has a share link | bg + border `--teal`, text `--on-teal` |
| `outline` | on the editor (optional) | transparent, `--plate-muted` border and text |

DOM text stays `New`, `Cached`, `Shared`. The `success`, `warning` and `default` variants are deleted.

**Meta line:**
- `meta` style in `--ink-muted` with `tabular-nums`, parts joined by ` · `.
- Times come from `timeAgo()` and must not include digits that precede the dashboard quota number (§5).

### 3.10 List rows (`src/components/list-row.tsx`, used by history, saved, recent, FAQ, "How it reads", "Where to start")

**Anatomy (grid):** `[number 40px] [content 1fr] [action 32px?]`.
- Number: Plex 13px `--label`, tabular, `01`. `aria-hidden` when decorative.
- Content: name line (`mono-name` 15px ink, or `h3`), then preview (15px/22px `--ink-muted`, `line-clamp-2`), then catalog line (`caption`).
- Action: a "More actions" ghost icon 32×32, `position:relative; z-index:10`.

**Rules:**
- The list has `border-top: var(--rule-w) solid var(--rule)`.
- Each row has `border-bottom: 1px solid var(--hairline)` and padding 16px 0.
- No cards, no radius, no background.

**States:**
- Hover (when the row is a link): `bg-paper-sunk` on the row, and the name gets a 2px orange `border-bottom`.
- Focus-visible on the link: the ring is drawn around the whole row. Put `outline` on the `::after` overlay via `.row-link:focus-visible::after { outline: 2px solid var(--focus); outline-offset: -2px }`.
- The whole row is the link through the existing `after:absolute after:inset-0` pattern. The link's accessible name must contain `owner/repo/path` with no spaces.

**Dark:** hover fill #26262d.

### 3.11 Dropdown menu (`src/components/ui/dropdown-menu.tsx`; also `ref-switcher.tsx`)

- **Content:**
  - `bg-paper-raised`, `border-2 border-ink`, no radius, no shadow, padding 4px, min-width 208px.
  - Animation: 120ms opacity only (`data-[state=open]:animate-[fade_120ms]`), none under reduced motion.
  - Delete `animate-fade-in` and its translateY.
- **Item:**
  - 36px tall (44 under coarse pointer), padding 0 12px, Sarabun 600 14px ink, 16px icon in `--ink-muted`.
  - `data-[highlighted]`: `bg-paper-sunk`, ink icon.
  - `data-[disabled]`: opacity .4.
  - Destructive ("Remove from history"): `--danger` text and icon.
- **Label:** `caption` style. **Separator:** 1px hairline, margin 4px 0.
- **Ref switcher:**
  - Trigger: a 32px secondary button style with Plex 13px ref name, branch/tag 14px icon, and a chevron.
  - The Branches/Tags toggle becomes two `ui` text tabs with a 3px orange active bar.
  - The filter input uses the sm field style (36px).
  - The `default` marker becomes the `caption` text "default".
  - `aria-label="Filter refs"` is kept.
- **Dark:** #232329 fill, 2px `--edge` border.

### 3.12 Tooltip (`src/components/ui/tooltip.tsx`, replace)

- Remove `@radix-ui/react-tooltip` and `TooltipProvider` (from `providers.tsx`).
- The new `Tooltip({ content, children })` clones its single child and adds `data-tip={content}`. It renders nothing else.
- CSS:
```css
[data-tip] { position: relative; }
@media (hover: hover) {
  [data-tip]:hover::after, [data-tip]:focus-visible::after {
    content: attr(data-tip); position: absolute; top: calc(100% + 6px); left: 50%; translate: -50% 0;
    z-index: 50; white-space: nowrap; pointer-events: none;
    background: var(--ink); color: var(--paper); font: 600 12px/16px var(--font-sans); padding: 4px 8px;
  }
}
```
- Use it **only on elements that have an `aria-label`**, so the pseudo-content never reaches the accessible name. The Save button gets no tooltip.
- Inside `.on-plate` the tooltip is cream on navy, and it keeps the same inverse in dark mode.
- Tooltips never carry information that isn't already in the visible label or `aria-label`. On coarse pointers they don't show at all.

### 3.13 Toast (`src/components/providers.tsx` → sonner)

```tsx
<Toaster
  position="bottom-center"
  offset={{ bottom: "calc(var(--toast-bottom, 14px) + env(safe-area-inset-bottom))" }}
  mobileOffset={{ bottom: "calc(var(--toast-bottom, 12px) + env(safe-area-inset-bottom))" }}
  toastOptions={{ unstyled: true, classNames: { toast: "cx-toast on-plate", title: "cx-toast-title", description: "cx-toast-desc", actionButton: "cx-toast-action", closeButton: "cx-toast-close" } }}
  closeButton
/>
```
Remove `richColors`.

- **Style:**
  - Width `min(430px, 100vw - 24px)`, `--toast-bg` fill with a 2px border in the same colour, `--toast-fg` text, padding 14px 16px, no radius, no shadow. Light: navy block, cream text. Dark: cream block, charcoal text. `.cx-toast` remaps the `--plate*` tokens to the toast tokens so `plate` buttons inside it follow.
  - Title: 700 14px uppercase .1em, with `::after` a 3px × 40px orange bar 7px below.
  - Description: 14px 500 at `opacity:.86`. URLs inside are in Plex Mono.
  - Action ("Undo"): primary `sm`. Close: a `plate` icon button.
  - Error toasts: same block, with a 16px `AlertTriangle` in `--toast-icon` before the title.
- **Position:** the workspace root sets `--toast-bottom: 62px` so toasts sit above the 48px colophon bar. Elsewhere 14px keeps them clear of the footer's text row, because pages end with 56px bottom padding.
- **Copy is kept:** "Share link copied", "Share link revoked", "Saved to your dashboard", "Removed from saved repositories", "Removed from history".
- **Remove from history:** shows "Removed from history" with an **Undo** action for 5s. The row is removed optimistically. The `DELETE` is sent when the toast closes without Undo, and on `pagehide` via `fetch(..., { method: "DELETE", keepalive: true })`. Undo restores the row in place.

### 3.14 Skeleton (`src/components/ui/skeleton.tsx`)

- Square bars, `bg-paper-sunk`. In the editor they use `--plate-rule` (class `.on-plate` swaps it).
- Height is 0.75× the text it stands for. Widths come from the existing fixed arrays.
- Pulse: `animation: pulse-op 1.4s ease-in-out infinite alternate` (.55 → 1). None under reduced motion.
- Keep `aria-busy="true"` and the labels "Loading files" and "Loading file".
- **Code skeleton:** rows at the code line-height of exactly 24px. A 56px gutter bar plus a 16px gap so the real code lands with no shift.
- **Tree skeleton:** rows at the tree row height (32 / 44 coarse).

### 3.15 Empty state (`src/components/empty-state.tsx`, replacing the private one in `analysis-panel.tsx` and the ones in `history-list.tsx` and `repo-error.tsx`)

- **Anatomy:** left-aligned. A section label (or `h3`), one sentence (16px `--ink-muted`, max 46ch), then one action: a primary only when it is the view's main action, otherwise a secondary button or a link.
- An optional 20px lucide icon may sit inline before the label in `--ink-muted`. **No tiles, no centring.** Padding: 32px 0 inside the document padding.
- **Titles keep their test text:** "This file can't be analyzed" (ASCII apostrophe), "Where to start", "No analyses yet", "No analyses match your search". "Pick a file to analyze" stays as copy, but is only shown on the mobile Analysis panel when no file is open.

### 3.16 File tree, rail and drawer (`file-tree.tsx`, `workspace.tsx`)

**Rail** (desktop 1024+, only when the tree is folded):
- 48px wide, `bg-paper-sunk`, 1px hairline right edge. Buttons top-aligned, 40×40 square ghost buttons, 8px gap.
  1. Tree toggle: `aria-label="Show file tree"`, `aria-expanded=false`, `aria-controls="file-tree-panel"`, `data-tip="Files  /"`. Icon `PanelLeftOpen`.
  2. "Go to file": `aria-label="Go to file"`, `data-tip`. Icon `Search`. It opens the drawer and focuses the filter.
- Below 1024 the rail does not exist. The Files tab replaces it.

**Tree column vs drawer:**
- **In flow (264px column)** when the viewport is ≥1280px and the user has not folded it, **or whenever no file is open** (repo root) at any desktop width.
- **Drawer (320px overlay)** at 1024–1279px with a file open, or ≥1280 when folded:
  - Starts at the left edge of the document column.
  - `bg-paper-raised`, `border-right: 2px solid var(--ink)`, no shadow.
  - `transform: translateX(-100%)` → 0 over 200ms `--ease-out` (instant under reduced motion).
  - Esc closes it and returns focus to the button that opened it. Clicking outside closes it. Choosing a file closes it.
- The running-head toggle (`Hide file tree` / `Show file tree`, `aria-expanded`) folds and unfolds the column at ≥1280. Remember the choice in `localStorage["cx-tree"]` inside try/catch.
- `FileTree` **stays mounted** when folded (the class `hidden`).

**`/` shortcut:**
- Move the global `/` listener from `FileTree` to `Workspace`.
- If the tree is not visible, open the drawer (desktop) or select the Files tab (mobile), then focus `Filter files` in the next frame (`requestAnimationFrame`).
- It still ignores typing targets and modifier keys.

**Filter field:**
- 36px, `bg-paper-raised`, 2px ink border, Plex 13px, placeholder `Go to file` in `--ink-muted`, `aria-label="Filter files"`.
- A `Kbd` `/` sits right (square, 1px ink-muted border, Plex 12px).
- The clear button is `aria-label="Clear filter"`, 24×24 minimum (44 coarse).

**Results:**
- `role="listbox"` `aria-label="Matching files"` with the input as `aria-controls` / `aria-activedescendant` target. Each result is `role="option"` `aria-selected` and `id`.
- Rows are 32px: name in ink, dir in `--ink-muted`.
- Cursor row: `bg-paper-sunk` + 3px orange left bar.
- Esc clears the filter and returns focus to the element that had it before `/`.
- Empty: `meta` "No files match “slug”."

**Tree rows:**
- `role="tree"` `aria-label="Repository files"` (keep).
- Rows are 32px fine pointer / 44px coarse, Plex 13px ink, indent 14px per level + 8px.
- Folder: `div role="treeitem" aria-expanded` containing a `button` (keep this structure; the tests click `treeitem "src" → button`). It shows a 12px `ChevronRight` in `--ink-muted` that rotates 90° (no transition under reduced motion), plus a `Folder` / `FolderOpen` 16px icon in `--ink-muted`.
- File: `button role="treeitem" aria-selected` with a `FileIcon` in `--ink-muted`.
- Hover: `bg-paper-sunk`.
- Active (`aria-selected=true`): `bg-paper-sunk`, `border-left: 3px solid var(--orange)` (rows carry `border-left: 3px solid transparent` so nothing shifts), ink icon.
- Focus-visible: ring at offset -2px.
- **`file-icon.tsx`:** keep the shape mapping and drop all colour classes. Every icon is `text-ink-muted`; the active row's icon is `text-ink`. `folder` icons lose `text-primary/80`.
- **Truncated note:** `meta` in `--warning` on the hairline-topped footer of the tree.
- **Errors:** left-aligned. The message is `--ink`, prefixed by a 16px `AlertTriangle` in `--danger`, then a secondary sm button "Retry".
- **Keyboard (phase 6):** a single Tab stop with roving tabindex. Up/Down move, Right expands or moves to the first child, Left collapses or moves to the parent, Enter/Space opens or toggles, Home/End jump. Keep the current markup and names.

**Light:** the tree column sits on `--panel` (transparent, so the paper grain shows); it has no right border, the ivory sheet's edge separates it. The drawer is `--paper-raised` with a `--rule-w` `--rule` edge.

**Dark:** the tree and rail sit on `--panel` #1b1b20, the drawer is #232329 with a 1px `--rule` edge, and the active row is #26262d with an orange bar (`--row-bar`).

### 3.17 Code editor (`code-viewer.tsx`, `src/lib/highlight.ts`)

A navy, VS Code-style editor in both themes (near-black neutral in dark mode).

**Container:** `section.on-plate` with `bg-plate text-plate-fg` and a 1px `--plate-border`. No radius, no shadow, no grain. At ≥1024 it sits inside the code column with 12px padding around it (`.ws-code { padding: 12px }`), so the paper shows as a frame.

**Tab strip** (`.plate-tabstrip`, min-height 40px, `--plate-tabs` background, 1px `--plate-rule` bottom edge; wraps on mobile). Left to right:
- **The file tab** (`.plate-tab`): `--plate` background (it merges with the editor below via `margin-bottom: -1px`), a 2px `--plate-bar` orange bar on its top edge (`box-shadow: inset 0 2px 0`), a 14px `FileIcon` in `--plate-label`, and the base name in Plex 13/18 `--plate-fg` (truncate, max 60%). The full path is in `title`; the directory breadcrumb lives in the document head (§3.18).
- **Meta** (`.plate-meta`, ≥640 only): `CODE` in 700 12px uppercase .14em `--plate-label`, then `TypeScript · 13 lines · 382 B` in Sarabun 500 12px `--plate-muted`, tabular. Use **`1 line`** for single-line files and `toLocaleString()` for counts.
- Spacer.
- On mobile after a line-ref jump: a `plate-outline` sm button **"Back to analysis"**.
- **Tools** (`.plate-tools`): `plate-quiet` icon buttons, 28×28 (44 coarse), icons only, each with a tooltip:
  - Wrap (`aria-label="Wrap"`, `aria-pressed`, tip "Wrap lines"). The default is **on below 768px** and off above. Remember it in `localStorage["cx-wrap"]` (try/catch).
  - `Copy file contents`, `Copy link to this file`, `View on GitHub` (names kept). The copied state swaps the icon to `Check` in `--plate-fg` (not green) and the tip to "Copied".

**Body:** `overflow:auto`, `scrollbar-width: thin; scrollbar-color: var(--plate-rule) transparent`. When not wrapping, a long line scrolls inside the editor and is never silently clipped. No right-edge fade (it would be a gradient).

**Shiki** (`src/lib/highlight.ts`):
```ts
import { createCssVariablesTheme, createHighlighter, ... } from "shiki";
const plateTheme = createCssVariablesTheme({ name: "codexplain-plate", variablePrefix: "--shiki-", fontStyle: false });
// createHighlighter({ themes: [plateTheme], ... })
// codeToHtml(normalized, { lang, theme: "codexplain-plate", transformers: [...] })   // no `themes`, no `defaultColor`
```
- Colours come from the syntax tokens in §2.1, the same in both themes.
- Keep the `line()` transformer (`id="L{n}"`, `data-line`) and the plain-text fallback.
- Lower the highlight cap to **2,500 lines or 150 KB** (perf), and cache the HTML in memory keyed by `sha + lang` (LRU, 200 entries).
- `highlight(code, lang, { anchors: false })` serves the landing specimen. In that mode the transformer sets `class="s-line"` (replacing Shiki's `line`) and omits `id` / `data-line`, so the specimen never collides with `.code-view .line` or `#L{n}`.

**CSS** (as built in `globals.css`):
```css
.plate-tabstrip { display: flex; align-items: stretch; min-height: 40px; background: var(--plate-tabs); border-bottom: 1px solid var(--plate-rule); }
.plate-tab { display: flex; align-items: center; gap: 8px; min-width: 0; max-width: 60%; padding: 0 16px 0 14px;
  background: var(--plate); color: var(--plate-fg); font: 400 13px/18px var(--font-mono);
  box-shadow: inset 0 2px 0 var(--plate-bar); margin-bottom: -1px; }
.plate-tab svg { color: var(--plate-label); }
.plate-meta { font: 500 12px/16px var(--font-sans); letter-spacing: .04em; color: var(--plate-muted); font-variant-numeric: tabular-nums; }
.plate-meta b { font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--plate-label); margin-right: 6px; }

.code-view pre.shiki { margin: 0; padding: 10px 0 40px; background: transparent !important; color: var(--plate-fg) !important;
  font: 400 14px/24px var(--font-mono); counter-reset: line; min-width: max-content; tab-size: 4; }
.code-view .line { display: inline-block; min-width: 100%; padding-right: 24px; scroll-margin-top: 30vh; }
.code-view .line::before {
  counter-increment: line; content: counter(line); display: inline-block; box-sizing: border-box;
  width: 56px; margin-right: 16px; padding-right: 14px; border-left: 2px solid transparent;
  text-align: right; color: var(--plate-muted); font-size: 13px; font-variant-numeric: tabular-nums; user-select: none;
  vertical-align: top; position: sticky; left: 0; background: var(--plate);
}
.code-view .line.highlighted, .code-view .line.highlighted::before { background: var(--plate-hl); }
.code-view .line.highlighted::before { color: var(--plate-fg); border-left-color: var(--plate-bar); }
.code-view[data-wrap="true"] pre.shiki { min-width: 0; }
.code-view[data-wrap="true"] .line { width: 100%; white-space: pre-wrap; overflow-wrap: anywhere; padding-left: 72px; text-indent: -72px; }
.code-view[data-wrap="true"] .line::before { text-indent: 0; position: static; }
```
- **Current-line band:** a highlighted range fills the whole line width, gutter included, with `--plate-hl`; the number turns `--plate-fg` and a 2px orange `--plate-bar` marker sits at the gutter's left edge.
- 56px + 16px = **72px**, which matches the gutter click zone (`e.clientX - rect.left > 72`).
- The line-number column, `#L{n}` ids, `.line`, `data-line` and the `.highlighted` class are unchanged.

**Highlight behaviour:**
- The range gets `.highlighted` and scrolls to centre with `behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"`.
- Then focus moves to the scroll container (`tabIndex={-1}`, `aria-label="Lines 6 to 9"`, `preventScroll: true`).
- On mobile the tab strip shows the **"Back to analysis"** button after a line-ref jump. It selects the Analysis tab.

**Non-text states** (binary, too large, error):
- Left-aligned inside the editor, padding 32px.
- 16px icon in `--plate-muted`.
- Message in `--plate-fg` 15px. Keep "This is a binary file, so it can't be displayed here." and "This file is N KB, which is too large to display."
- Then a `plate-outline` button (transparent, 2px `--plate-fg` border, `--plate-fg` text) labelled "Open on GitHub" or "Retry".

**Root (no file):**
- Desktop: the editor column is not rendered.
- Mobile Code panel: a left-aligned note on paper, "No file open. Choose one in Files.", with a secondary button that selects the Files tab.

### 3.18 Analysis document typography (`analysis-panel.tsx`, `markdown.tsx`)

**The ivory sheet.** The whole document column (`.ws-doc`) is a solid `--sheet` (#faf5e8, no grain) with 1px `--sheet-edge` borders left and right at ≥1024, so it reads as a printed page laid on the grained paper. In dark mode it is `--sheet` #1b1b20. The landing specimen's document half uses the same `bg-sheet`.

**Document head** (left column; `analysis-panel.tsx` gains a head, the body keeps `.prose-analysis`). Padding is 32px 40px on desktop and 20px 16px on mobile. In order:

1. **Breadcrumb**: `nav aria-label="File path"`, Plex 13px `--label`, original case. Each directory segment is a button that reveals it in the tree (it lives here, not in the editor; same `onRevealDir`). `/` separators in `--ink-muted`.
2. **H1**: the file name in `doc-title` (Sarabun 700 28/32, original case, `break-all`).
3. **Facts line**: `caption` → `TypeScript · 13 lines · 382 B · ` + ref in Plex original case.
4. **Accent rule**: 6px orange (the workspace's single accent rule).
5. **Mode tabs** (§3.8).
6. **Body** (`role="tabpanel"`), then the **colophon bar**.

**Body states:**
- **Idle, signed in:**
  - Mode blurb (16px `--ink-muted`).
  - Primary `Generate overview` (text: "Generate " + lowercased label; **no Sparkles icon**).
  - Under it, a `meta` line `5 left today · Each new analysis uses 1` (fetch `GET /api/me/usage` on mount).
  - Only one node in the DOM may contain "N left today" at a time (§5).
- **Idle, signed out:** primary `Sign in to analyze` (GitHub icon) and the `meta` line "Free, with read-only access to your public GitHub profile."
- **Idle, quota exhausted:** the Generate button is disabled with the visible text "Resets at midnight UTC". Do **not** repeat "Daily limit reached" here.
- **Checking cache:** the document skeleton.
- **Streaming:**
  - The status line (below) says `Generating overview…` and a secondary sm **Stop** sits right of it.
  - The text streams in with the caret.
  - Before the first delta, show the status line only (no spinner).
  - **Regenerate keeps the previous content** on screen with a `Regenerating…` status until the first new delta.
- **Stopped:**
  - Keep the partial text.
  - Add a notice line above it: `Stopped. Not saved, not charged.`
  - The colophon offers a ghost `Generate again`.
  - Today `stop()` resets to idle; change it to a `stopped` state that holds `content`.
- **Done:** the body plus the colophon.
- **Error:**
  - A notice **above** the previous result, which stays visible. The `error` state already allows `content`; populate it from the prior `done` or `streaming` state.
  - Notice anatomy: `role="alert"`, 2px `--danger` left border, padding 12px 16px, `bg-paper-raised`.
  - Title (16px 700 `--danger`, with an icon):
    - `Daily limit reached` for `QUOTA_EXCEEDED`.
    - `The model is busy` for `MODEL_BUSY`.
    - `Analysis failed` otherwise.
  - Message in `--ink`. `MODEL_BUSY` adds "Your quota was not charged."
  - Then a secondary sm button: `Try again`, `Sign in again` (UNAUTHORIZED), or nothing (QUOTA, NOT_ANALYZABLE, REFUSED).
  - For QUOTA, the message includes "resets at midnight UTC".

**Status line:** exactly one `<p role="status" aria-live="polite">` per panel, never on the markdown. It is visible (`meta`, beside Stop) while streaming and `sr-only` otherwise, so there is never a visible copy plus a hidden twin. Strings:
- `Generating overview…`
- `Regenerating…`
- `Overview ready`
- `Stopped`
- `Generation failed`
- `Limit reached for today`

Other modes use their lowercased label (`Generating deep dive…`). These strings are fixed so they never duplicate a tested string.

**Colophon bar** (48px, sticky at the bottom of the document column, `bg-sheet` solid, `border-top: 1px solid var(--sheet-edge)`, padding 0 16px, wraps on mobile):
- `[New|Cached badge] [just now] [· 4 left today]`, all `meta` tabular, visible at every width (drop `hidden sm:inline`).
- On the right, ghost sm buttons with icon + visible label:
  - `Copy` (`aria-label="Copy analysis as Markdown"`)
  - `Share` (`aria-label="Share analysis"`)
  - `Regenerate` (`aria-label="Regenerate analysis"`)
- Signed out shows Copy only.
- Each button shows its four states: pending (disabled + `aria-busy`), success (label "Copied" / toast), error (toast with the reason), and retry where useful. The Cached badge drops its Tooltip; its `title` attribute says "Loaded from a previous analysis of this exact file version".

**`.prose-analysis` CSS** (keep the class name; exactly one per workspace and shared page; `globals.css` shares these rules with `.specimen-doc` and `.legal-doc` through `:is()`):
```css
.prose-analysis { font: 500 16px/26px var(--font-sans); color: var(--ink); max-width: 68ch; counter-reset: sec; }
.prose-analysis > * + * { margin-top: 12px; }
.prose-analysis h2 { counter-increment: sec; font: 700 15px/20px var(--font-sans); text-transform: uppercase; letter-spacing: .14em;
  color: var(--label); margin-top: 40px; padding-top: 12px; border-top: var(--rule-w) solid var(--rule); }
.prose-analysis h2:first-child { margin-top: 0; }
/* Section numbers are solid poster chips, cycling orange, teal, jungle, moon. */
.prose-analysis h2::before { content: counter(sec, decimal-leading-zero); content: counter(sec, decimal-leading-zero) / "";
  display: inline-block; font: 400 13px/20px var(--font-mono); letter-spacing: 0; margin-right: 12px; padding: 0 6px;
  background: var(--chip, var(--orange)); color: var(--on-chip, var(--on-orange)); }
.prose-analysis h2:nth-of-type(4n+2) { --chip: var(--teal); --on-chip: var(--on-teal); }
.prose-analysis h2:nth-of-type(4n+3) { --chip: var(--jungle); --on-chip: var(--on-jungle); }
.prose-analysis h2:nth-of-type(4n+4) { --chip: var(--moon); --on-chip: var(--on-moon); }
.prose-analysis h3 { font: 600 17px/24px var(--font-sans); margin-top: 24px; }
.prose-analysis strong { font-weight: 700; }
.prose-analysis ul { list-style: square; padding-left: 20px; }
.prose-analysis ul > li::marker { color: var(--orange); }
.prose-analysis ol { list-style: decimal-leading-zero; padding-left: 32px; }
.prose-analysis ol > li::marker { color: var(--label); font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.prose-analysis li + li { margin-top: 6px; }
.prose-analysis li > p { margin: 0; }
.prose-analysis a:not(.line-ref) { color: var(--ink); text-decoration: none; border-bottom: 2px solid var(--orange); }
.prose-analysis :not(pre) > code { font: 400 .88em/1 var(--font-mono); background: var(--paper-sunk); padding: 1px 4px; }
.prose-analysis pre { background: var(--plate); color: var(--plate-fg); border: 1px solid var(--plate-border);
  font: 400 13px/21px var(--font-mono); padding: 12px 16px; overflow-x: auto; scrollbar-width: thin; }
.prose-analysis table { width: 100%; border-collapse: collapse; display: block; overflow-x: auto; font-size: 14px; }
.prose-analysis th, .prose-analysis td { border-bottom: 1px solid var(--hairline); padding: 8px 12px 8px 0; text-align: left; vertical-align: top; }
.prose-analysis th { font: 700 12px/16px var(--font-sans); text-transform: uppercase; letter-spacing: .08em; color: var(--label); border-bottom: var(--rule-w) solid var(--rule); }
.prose-analysis blockquote { border-left: var(--rule-w) solid var(--rule); padding-left: 14px; color: var(--ink-muted); }
.prose-analysis hr { border: 0; border-top: 1px solid var(--hairline); }
.prose-analysis .line-ref { font: 400 .85em/1 var(--font-mono); color: var(--ink); text-decoration: none; white-space: nowrap;
  padding: 0 2px; border-bottom: 2px solid var(--orange); transition: background-color var(--dur-fast); }
.prose-analysis .line-ref:hover, .prose-analysis .line-ref:focus-visible { background: var(--ref-hover); }
.prose-analysis.is-reading, .legal-doc { font-size: 17px; line-height: 28px; max-width: 66ch; }
.streaming-caret::after { content: ""; display: inline-block; width: .55em; height: 1.05em; margin-left: 2px; vertical-align: -.15em;
  background: var(--orange); animation: blink 1s steps(2, start) infinite; }
@keyframes blink { to { visibility: hidden; } }
@media (prefers-reduced-motion: reduce) { .streaming-caret::after { animation: none; } }
```

**Line refs:**
- The text stays exactly `L6-L9` (ASCII hyphen), with `href="#L6-L9"` and `class="line-ref"`.
- A click calls `onLineClick` → highlight, then `replaceState` to `…#L6-L9`. On mobile the Code tab is selected.

**Streaming performance** (phase 6):
- Flush at most every 50ms inside `startTransition`, instead of once per animation frame.
- Split `content` at the last blank line outside a code fence. Render the finished head as memoised blocks and re-parse only the tail.

### 3.19 Dashboard rows (`dashboard/page.tsx`, `history-list.tsx`)

**Quota ledger** (replaces the three `StatCard`s): one row, ≤72px tall on desktop.
- `border-top: 2px solid var(--ink)` (dark: `--edge`); `border-bottom: 1px solid var(--hairline)`.
- Three cells divided by 1px hairlines. Each cell has a `caption` label, led by a 10px `.swatch` (orange, moon, teal), above a number in 700 40px/40px ink tabular. Under 640 the cells stack 2 + 1.

| Cell | Label (DOM text) | Value |
|---|---|---|
| 1 | `Analyses left today` (exactly once on the page) | `4` + ` / 5` in `meta` + the meter + "Resets at midnight UTC. Cached results are free." in `meta` |
| 2 | `In history` | `N` |
| 3 | `Saved` (plain text, **not** a heading) | `N` |

**Meter:**
- 8px tall, `border: 2px solid var(--ink)`, track transparent, fill `--orange`, square ends, no transition.
- Keep `role="progressbar"`, the `aria-valuenow`/`min`/`max` values and `aria-label="Daily analyses used"`.

**Rule:** no digits in any DOM text before the quota number (§5).

**History list** (left column):
- Section label `Analysis history`.
- The search field (sm style, `aria-label="Search history"`, placeholder `Search by repository or file path`).
- Rows per §3.10:
  - Number `01`… (decorative).
  - Link text `<span class="text-ink-muted">acme/widgets/</span><span>src/index.ts</span>` (Plex 15px; the accessible name stays `acme/widgets/src/index.ts`).
  - Preview line.
  - Catalog: a 10px swatch in the mode colour (Overview orange, Deep dive teal, Code review jungle) + `Overview` in `caption` + `[Shared]` badge + `2 hours ago`.
  - "More actions" ghost button.
- Menu items are kept exactly: `Open shared page` (an `<a href="/a/<slug>">`), `Create share link` / `Revoke share link`, separator, `Remove from history` (danger).
- Load more: a secondary sm button "Load more".

**Saved / Recently viewed** (right column, 320px):
- Each is a `<section>` whose `h2.section-label` is `Saved` (teal marker) / `Recently viewed` (jungle marker). The `ul` is a sibling inside the same section.
- Rows: name `owner/` (muted) + `repo` in Plex 15px, description (2 lines), catalog `TypeScript · 2 days ago` (stars are optional, written `1.2K stars`, no icons).
- Recently viewed leaves out repos that are already in Saved.
- Empty text stays as today, as `meta`.

**Empty history:** an empty state with title "No analyses yet", the sentence, and a secondary button "Try a sample repository" linking to `/r/vercel/next.js`.

**Errors:** an inline notice ("Couldn't load your history.") plus a secondary sm "Retry". No dashed boxes.

### 3.20 Share page (`src/app/a/[slug]/page.tsx`)

A "poster detail" page in the wavz style: one document on paper, no card.

1. **Running head** (a `p`, not a heading): `caption` → `Overview · ` + `acme/widgets` (Plex, original case) + ` · ` + ref (Plex).
2. **H1** = the exact path (`path-title`, Plex 26/32, `break-all`). It is the only heading containing the path.
3. **Meta:** `Shared by @login · October 13, 2026` (`meta`).
4. **Accent rule.**
5. **Primary:** `Open with the code` (Code2 icon) → `codeHref`.
6. **Document:** `<div class="prose-analysis is-reading">`. No border or card.
7. **Colophon:**
   - A `border-top: 2px solid var(--ink)` row.
   - In `meta`: "Made with Codexplain. Paste any GitHub link and read it like this." The link "Try Codexplain" uses the page-frame underline and goes to `/`.
   - It replaces the promo card.

**Phase 6:** render the Markdown in a **Server Component** (react-markdown runs fine in RSC). Line refs become `<Link href={codeHref + "#L12-L30"} className="line-ref" prefetch={false}>` with the same text. Delete `shared-markdown.tsx` from the client bundle.

### 3.21 Error pages

**Root 404** (`src/app/not-found.tsx`):
- SiteHeader + `.page` + SiteFooter.
- Masthead `numeral` variant: `404` (`numeral` style, ink, `aria-hidden`), accent rule, h1 `This page doesn't exist` (28/32 700, sentence case, ASCII apostrophe), the sentence "The link may be broken, or the page may have been removed."
- Then primary `Back to home` + `RepoSearch size="sm"`.
- Must return HTTP 404 (already does).

**Repo not found** (new `src/app/r/[owner]/[repo]/not-found.tsx`, `"use client"`):
- Read owner and repo from `usePathname()`.
- Same layout: h1 `Repository not found`, the path in Plex `--label`, the sentence "It may be private, renamed, or never have existed. Codexplain opens public repositories only.", then `RepoSearch size="sm"` and secondary `Back to home`.
- In `r/[owner]/[repo]/page.tsx`, call `notFound()` when `GitHubError.code === "NOT_FOUND"` (before anything streams) so the response is a real 404. Missing and private repos both arrive as NOT_FOUND.

**Repo errors** (`repo-error.tsx`: RATE_LIMITED, FORBIDDEN, INVALID, other):
- The same page frame with SiteHeader + SiteFooter.
- Left-aligned title (`GitHub is rate limiting us`, …), the repo path, the message.
- RATE_LIMITED signed-out keeps a primary `Sign in with GitHub` link to `/login?callbackUrl=…`.
- Ends with `RepoSearch size="sm"`. No icon tile.

**Runtime error** (`src/app/error.tsx`):
- The same frame: h1 `Something went wrong`, the sentence with a real link "Report an issue" (to …/issues), `Reference: <digest>` in Plex `meta`.
- Primary `Try again` (reset) + secondary `Home`.

### 3.22 Mobile panel switcher (`workspace.tsx`)

- `role="tablist"` `aria-label="Workspace panels"`, 44px, `lg:hidden` (display:none on desktop; keep).
- Three equal tabs, `role="tab"`, names exactly `Files`, `Code`, `Analysis`, `aria-selected`, `aria-controls`.
- Style as mode tabs: `ui` style, a 2px ink baseline, active ink + 4px orange bar, inactive `--ink-muted`.
- 16px icons: `FolderTree`, `Code2`, and `FileText` (replacing `Sparkles`).
- Panels are `role="tabpanel"`. Inactive panels are `hidden` (display:none) under 1024 and always visible at `lg`.
- Defaults: repo root opens on `Files`. Choosing a file or clicking a line ref selects `Code`.
- Arrow-key behaviour as §3.8.

### 3.23 Example plate (landing try row), `src/components/landing/plate-card.tsx`

**Anatomy:** `<a class="plate-card">` with `aria-label="vercel/next.js, Example No. 01"` and `prefetch={false}`.
- A **poster face** (`.plate-face.poster`): aspect 4/3, no radius or shadow. It draws `PLATE_SCENES[(n-1) % 4]` (§3.24). Inside:
  - top-left, on a block of the scene's own flat sky (`PLATE_SKIES`, so it always reads): `owner` in Plex 13/18 `--moon`, then the repo name in Sarabun 700 26/28 `#fffdf7`, original case;
  - bottom-left: an `OPEN →` tab, 700 12px .14em, cream `#f2e5c3` on navy `#0e1c3a`.
- A **caption** on paper below it: `vercel/next.js` (Plex 15 ink) and `React framework · No. 01` (`caption`).

**States:**
- Hover: the `OPEN →` tab turns `--moon` with `--on-moon` text, and the caption name gets a 2px orange underline.
- Focus-visible: a 2px `--focus` ring at offset 4px around the poster.
- Dark: posters are identical in both themes (they are pictures, not chrome); only the caption below follows the tokens.

**Snap row** (`.snap-row`):
- `display:flex; gap: clamp(10px,2vw,24px); overflow-x:auto; scroll-snap-type:x mandatory; overscroll-behavior-x:contain; scrollbar-width:none`.
- Items: `flex: 0 0 clamp(230px,72vw,300px); scroll-snap-align:start`.
- At ≥1024 the row becomes a 4-column grid with no scrolling.
- Arrow buttons in the section label's right slot: pills 42×38, 2px ink border, `←` / `→` in Sarabun 700 18px, `aria-label="Earlier"` / `"More"`, `disabled` + opacity .25 at the ends, hidden under `@media (hover: none)` and at ≥1024. Scroll by one item width.

### 3.24 Posters (`src/components/landing/posters.tsx`)

Flat, screen-printed scenes in the wavz.us style: solid SVG shapes only, no gradients, blur, strokes-as-shading or photos. Each scene is drawn in a 400×300 viewBox, `aria-hidden`, `focusable="false"`, and leaves its top-left corner as flat sky so a caption can sit there.

| Scene | Where | Palette |
|---|---|---|
| `LighthouseScene` | landing masthead (`slice`) | night blue `#13315c`, teal halo, moon-yellow beam and moon, sea blues |
| `MoonpathScene` | try plate 01 | sky `#13315c`, teal and night-blue sea, sand orange, moon path |
| `HiddenFallsScene` | try plate 02 | sky `#123d33`, jungle greens, moon, orange flowers |
| `HarbourScene` | try plate 03 | sky `#0e1c3a`, navy, lantern orange and yellow |
| `AuroraScene` | try plate 04 | sky `#23173a`, plum night, aurora greens, a lit cabin |

- `PLATE_SCENES` and `PLATE_SKIES` export the plate order and each scene's sky colour (for the caption block).
- Shared helpers: `wave()` (hump rows), `Stars`, `Sparkle` (four-point star), `Streaks` (light on water).
- **Print texture:** `.poster::after` lays the cream-speck `grain-night.png` tile over the scene at opacity .55 (64px tile at ≥2dppx). It is dropped under print and forced colours.
- **Accents tie back to the UI:** the poster palette is where teal, moon and jungle come from; in the UI those colours appear only as markers, chips, swatches and badge fills (§2.1).
- Posters are the same in light and dark mode. They appear on the landing page only; nowhere in the workspace, dashboard or documents.

---

## 4. Page blueprints

Legend: `▬▬▬` 6px orange rule, `═══` structural rule (2px ink light, 1px dark), `───` 1px hairline, `███` navy editor, `▓▓▓` poster, `[ BUTTON ]` secondary, `[■ BUTTON ]` primary, `(◐)` pill.

### 4.1 Landing `/` (`src/app/(marketing)/page.tsx`)

Desktop 1440:
```
CODEXPLAIN                                         HOW IT WORKS  DASHBOARD  (◐)  [ SIGN IN ]
════════════════════════════════════════════════════════════════════════════════════════════
   UNDERSTAND ANY                                       ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
   GITHUB                                               ▓▓  lighthouse poster, 4/3   ▓▓
   REPOSITORY                       h1 display, left    ▓▓  max 420px wide           ▓▓
   Paste a GitHub link, open any file, and read         ▓▓                           ▓▓
   what it does, with every claim tied to its lines.    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
                                                 blurb under the h1
   ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
   ┃ github.com/owner/repo                                                ┃■ EXPLORE →  ┃ 56px
   Repository, branch, folder and file links all work.                              (meta)

   ════════════════════════════════════════════════════════════════════════════════════
   ■ TRY A REPOSITORY                                         (section label + marker)
   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
   │ vercel      ▓│ │ fastapi     ▓│ │ sindresorhus▓│ │ charmbracel.▓│   4 posters, 4/3
   │ next.js     ▓│ │ fastapi     ▓│ │ got         ▓│ │ bubbletea   ▓│   moonpath, falls,
   │▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ │▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ │▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ │▓▓▓▓▓▓▓▓▓▓▓▓▓▓│   harbour, aurora
   │OPEN →▓▓▓▓▓▓▓▓│ │OPEN →▓▓▓▓▓▓▓▓│ │OPEN →▓▓▓▓▓▓▓▓│ │OPEN →▓▓▓▓▓▓▓▓│
   └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
   vercel/next.js   fastapi/fastapi  sindresorhus/got charmbracelet/bubbletea
   REACT FRAMEWORK  PYTHON WEB API   HTTP CLIENT      GO TUI LIBRARY
   · NO. 01         · NO. 02         · NO. 03         · NO. 04

   ════════════════════════════════════════════════════════════════════════════════════
   SPECIMEN                                    GOT · SOURCE/… · OVERVIEW · OCT 2026
   ┌───────────────────────────────────┬────────────────────────────────────────┐
   │ source/core/        (ivory sheet) │██[▌options.ts]  CODE 42 LINES  (tabs)██│
   │ options.ts                        │███  1  import …                      ███│
   │ TYPESCRIPT · 42 LINES             │███  2  …                             ███│
   │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬                    │███ ...  (14 lines max, static)       ███│
   │ 01 SUMMARY                        │███                                   ███│
   │ Real overview text with  L6-L9    │███                                   ███│
   └───────────────────────────────────┴────────────────────────────────────────┘
   The specimen is an Overview generated by Codexplain; line refs open the file.  (meta)

   ════════════════════════════════════════════════════════════════════════════════════
   HOW IT READS                                                          id="how"
   01  Paste a link        Any github.com repository, branch, folder or file URL.
   ──────────────────────────────────────────────────────────────────────────────────
   02  Open a file         Browse the tree; code sits on the plate with line numbers.
   ──────────────────────────────────────────────────────────────────────────────────
   03  Pick a reading      Overview · Deep dive · Code review (the three MODES blurbs)
   ──────────────────────────────────────────────────────────────────────────────────
   04  Follow line refs    Every claim cites lines like L42-L57. Click to jump.
   ──────────────────────────────────────────────────────────────────────────────────
   05  Keep and share      History on your dashboard; read-only share links.

   ════════════════════════════════════════════════════════════════════════════════════
   FINE PRINT
   Which repositories can I analyze?     Any public GitHub repository…
   ──────────────────────────────────────────────────────────────────────────────────
   … (4 FAQ rows as dl/dt/dd)  +  "Your GitHub token is never stored in our database."
   Something else? Report an issue →    (real link to …/issues)
════════════════════════════════════════════════════════════════════════════════════════════
CODEXPLAIN · BUILT WITH NEXT.JS AND GEMINI · © 2026      PRIVACY  TERMS  SOURCE  REPORT AN ISSUE
```

Phone 412:
```
CODEXPLAIN        DASHBOARD (◐) [SIGN IN]
═════════════════════════════════════════
UNDERSTAND ANY
GITHUB
REPOSITORY                      (36–40px)
Paste a GitHub link, open any file,
and read what it does…   (left-aligned)
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
▓▓ lighthouse poster, 5/2, sliced    ▓▓
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
┃ github.com/owner/repo  ┃■ EXPLORE → ┃
Repository, branch, folder and file links…
═════════════════════════════════════════
TRY A REPOSITORY
┌───────────────┐ ┌───────     ← scroll-snap,
│ vercel       ▓│ │ fast…        bleeds to edge
│ next.js      ▓│ │ (posters)
└───────────────┘ └───────
vercel/next.js
REACT FRAMEWORK · NO. 01
═════════════════════════════════════════
SPECIMEN   (document stacked above editor;
            editor max 10 lines)
═════════════════════════════════════════
HOW IT READS   01…05 rows (number on top)
FINE PRINT     dt/dd stacked
═════════════════════════════════════════
CODEXPLAIN · © 2026
PRIVACY  TERMS  SOURCE  REPORT AN ISSUE
```

**Content and behaviour notes:**
- **Delete:** the AI pill, the blue "in minutes" span, `STEPS`, `FEATURES`, the bottom CTA section with its second `RepoSearch` and the "Or open a sample repository" link, and `bg-grid`.
- **Exactly one** `RepoSearch` on `/`: the hero. It is the first `GitHub repository URL` input in the DOM. Dropping `autoFocus` on touch devices is optional.
- **h1 DOM text:** `Understand any GitHub repository`. Use spaces, not `<br>`; uppercase comes from CSS.
- **Specimen:**
  - Data lives in `src/content/specimen.ts`: `{ owner, repo, ref, sha, path, language, lineCount, generatedAt, overviewMarkdown, code }`.
  - It must be a **real** Overview generated once by the app for a 20–40 line file from one of the EXAMPLES repos, committed as-is.
  - Render it in a Server Component. Code goes through `highlight(code, lang, { anchors: false })` and shows the first 14 lines (10 on phone) inside `.specimen-code` (never `.code-view`).
  - The analysis is a server-rendered markdown in `.specimen-doc`, which shares the `.prose-analysis` CSS through a selector list but **not** the class name.
  - L-refs are `<Link prefetch={false} href="/r/owner/repo?path=…#L6-L9">`.
  - No client fetch, no `role="alert"`.
- **Prefetch:** example plates, specimen refs, and footer and legal links all use `prefetch={false}`. The landing page makes ≤4 RSC prefetches.

### 4.2 Login `/login` (`src/app/login/page.tsx`)

Desktop:
```
CODEXPLAIN                                              DASHBOARD  (◐)  [ SIGN IN ]
═══════════════════════════════════════════════════════════════════════════════════
   SIGN IN TO                                   Generate analyses, keep your history
   CODEXPLAIN                                   and share results.          (blurb)
   ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
   WHAT GITHUB SHARES WITH US                              (section label)
   Your name, username, avatar and primary email. Read-only, public scopes.
   Your GitHub token stays in an encrypted session cookie, never in our database.

   ┃ ⚠ GitHub sign-in was cancelled.    ┃   role=alert (only when ?error=)
   [■  CONTINUE WITH GITHUB  ]              48px primary, max-width 360px
   By continuing you agree to our terms and privacy policy.   (meta, underlined links)
═══════════════════════════════════════════════════════════════════════════════════
footer
```
Phone: the same column at 16px gutters. The button is full width.

- **Keep:** `safeCallback`, the `ERRORS` map, the redirect when signed in, `SignInButton` (rename nothing; it already shows the pending state).
- **Remove:** `bg-grid`, the card, the shadow and the `Logo`.
- **Header on `/login`:** hide the header "Sign in" button (via `usePathname`) so the page has a single sign-in action. The auth slot keeps its width.
- The terms and privacy links use `next/link` with `prefetch={false}`.

### 4.3 Workspace `/r/[owner]/[repo]` (`workspace.tsx`, `analysis-panel.tsx`, `code-viewer.tsx`, `file-tree.tsx`)

The root element gets `className="workspace-root"`, `h-dvh` flex column, `overflow:hidden`, and `style={{"--toast-bottom":"62px"}}`.

**Desktop 1440, file open, tree in flow (≥1280):**
```
CODEXPLAIN        ┃ Open another repository…  ┃■GO┃      HOW IT WORKS DASHBOARD (◐) (●)   56
═══════════════════════════════════════════════════════════════════════════════════════════
[⇤] acme/widgets  [⎇ main ▾]  1.2K STARS · 56 FORKS · TYPESCRIPT          [ SAVE ] [ GITHUB ↗ ]  44
───────────────────────────────────────────────────────────────────────────────────────────
┃ Go to file   / ┃│ src /            (ivory sheet) │ ▔▔▔▔▔▔▔▔▔▔▔                           
─────────────────│ index.ts             (doc-title)│ [▌ index.ts ] CODE TS · 13 LINES ⤶⧉🔗↗  tabs 40
▸ assets         │ TYPESCRIPT · 13 LINES · 382 B · │███───────────────────────────────────███
▾ src            │ main                            │███  1  import { slugify } from …   ███
  ▸ utils        │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │███  2                             ███
 ▌ index.ts      │ 01 OVERVIEW  02 DEEP DIVE  03 … │███  3  export type Widget = …      ███
  package.json   │ ═════▀▀▀▀▀▀▀═══════════════════ │███  5  /** Creates a widget …      ███
  README.md      │ ════════════════════════════════│▌██  6  export function createW…   ███ ← hl
                 │ 01  SUMMARY                     │▌██  7    if (!name.trim()) …       ███
                 │ src/index.ts is the public      │▌██  8    return { id: … };         ███
                 │ entry point …                   │▌██  9  }                          ███
                 │ ════════════════════════════════│███ 10                             ███
                 │ 02  KEY PARTS                   │███ 11  export function renameW…    ███
                 │ ▪ createWidget (L6-L9) …        │███ 12    return { ...w, name };    ███
                 │                                 │███ 13  }                          ███
                 │─────────────────────────────────│███                                ███
                 │ NEW  just now · 4 left today    │███                                ███
                 │          [⧉ COPY][↗ SHARE][↻ RE…]│███                                ███
 264px            doc minmax(420px,1fr) ≈ 560px     editor minmax(480px,1.1fr) ≈ 616px, 12px inset
```
- **Grid:** `grid-template-columns: [tree] 264px [doc] minmax(420px,1fr) [code] minmax(480px,1.1fr)`. When folded, `48px` replaces the 264px column (the rail).
- **Surfaces:** tree and running head on grained paper (`--panel`), the document column on the solid ivory sheet with 1px `--sheet-edge` sides, the code column on paper with the navy editor inset 12px. In dark mode: panel #1b1b20, sheet #1b1b20, page #131316, editor #0e0e11.
- **Running head** (44px, `border-bottom` 1px hairline, `bg-paper` solid; `bg-panel` in dark mode). Left to right:
  - Tree toggle 32×32 ghost (`Hide file tree` / `Show file tree`, `aria-expanded`).
  - `owner/` muted + `repo` ink in Plex 15. It is a **`<Link href="/r/owner/repo">`**, replacing the `<button>`.
  - Ref switcher.
  - Caption `1.2K stars · 56 forks · TypeScript` (md+).
  - Spacer.
  - `Save`/`Saved` secondary sm, with a visible label at every width (`aria-pressed`, `Bookmark`/`BookmarkCheck` icon, no tooltip, accessible name exactly `Save` / `Saved`).
  - `GitHub` secondary sm with a visible label at every width.
  - **The 24px owner avatar is removed** (it was a 277 KB image).
- The document column scrolls independently. The colophon is sticky at its bottom. The editor scrolls independently.

**Desktop, repo root (no file), any width ≥1024:**
```
═══════════════════════════════════════════════════════════════════════════════════════════
[⇤] acme/widgets  [⎇ main ▾]  1.2K STARS · 56 FORKS · TYPESCRIPT          [ SAVE ] [ GITHUB ↗ ]
───────────────────────────────────────────────────────────────────────────────────────────
┃ Go to file   / ┃│ acme/widgets                                   (doc-title)
▸ assets         │ A tiny widget library.                         (body, ink-muted)
▸ src            │ 1.2K STARS · 56 FORKS · MIT                    (caption)
  package.json   │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  README.md      │ TOPICS  react · widgets · ui                   (caption list, no pills)
                 │ ════════════════════════════════════════════════
                 │ WHERE TO START                                 (section label, once)
                 │ 01  README.md                                  ← buttons, not treeitems
                 │ ───────────────────────────────────────────────
                 │ 02  package.json
                 │ ───────────────────────────────────────────────
                 │ 03  src/index.ts
                 │ Pick any file in the tree. The analysis opens here, the code on the right.
 264px (in flow)   document 1fr, max 68ch          (no plate column, no mode tabs)
```
- The tree is **in flow at the root** at every desktop width; the tests click treeitems with no extra click.
- `RepoOverview` moves from the code column into the document column. Its avatar is dropped. Topics are a caption line. Suggestions are a list-row `ol` of buttons (`FileIcon` + Plex 15 path).

**Desktop 1024–1279, file open:** `[rail 48][doc][editor]`. The tree opens as a 320px drawer from the rail (§3.16).

**Phone 412 (Pixel 7), chrome 48 + 44 + 44 = 136px:**
```
Files tab (root default)        Code tab (after picking a file)   Analysis tab
CODEXPLAIN  DASHBOARD (◐)(●)    CODEXPLAIN  DASHBOARD (◐)(●)      CODEXPLAIN  DASHBOARD (◐)(●)
════════════════════════════    ════════════════════════════      ════════════════════════════
acme/widgets [main▾] [SAVE][GH] acme/widgets [main▾] [SAVE][GH]   acme/widgets [main▾] [SAVE][GH]
────────────────────────────    ────────────────────────────      ────────────────────────────
 FILES ▀▀▀   CODE    ANALYSIS     FILES   CODE ▀▀▀  ANALYSIS        FILES   CODE   ANALYSIS ▀▀▀
════════════════════════════    ════════════════════════════      ════════════════════════════
┃Open another repository…┃GO┃   [▌README.md]        ⤶ ⧉ 🔗 ↗      README.md
┃ Go to file           / ┃     ███████████████████████████████    MARKDOWN · 12 LINES · …
▸ assets                       ███ 1  # Widgets             ███    ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
▸ src                          ███ 2  A tiny widget library ███    01 OVERVIEW 02 DEEP 03 CODE…
  package.json                 ███ …  (wrap on by default)  ███    ════▀▀▀▀════════════════
  README.md   (44px rows)      ███                          ███    A quick summary of what …
                                                                   [■ SIGN IN TO ANALYZE ]
                                                                   Free, with read-only access…
```
- The mode tabs on phone are 13px. The labels may abbreviate visually with CSS, never in the DOM; if 3 tabs don't fit 380px, the strip scrolls horizontally inside itself (`overflow-x:auto`), never the page.
- The running head on phone: repo name truncates first. Save and GitHub keep their labels (32px tall, 44px touch target via padding).
- Nothing may make `documentElement.scrollWidth > innerWidth`:
  - the editor and tables scroll inside themselves;
  - long paths use `overflow-wrap:anywhere`;
  - the display h1 has `overflow-wrap: anywhere` as a safety net.
- At the root on phone, the Analysis panel holds the title page (the same single "Where to start" node). The Code panel shows the "No file open" note.

### 4.4 Dashboard `/dashboard` (`src/app/(marketing)/dashboard/page.tsx`)

Desktop:
```
CODEXPLAIN                                              HOW IT WORKS DASHBOARD (◐) (●)
════════════════════════════════════════════════════════════════════════════════════════
   WELCOME BACK, ARNAV                           Pick up where you left off, or open a
                                                 new repository.              (blurb)
   ┃ Open another repository…                         ┃■ GO ┃   (sm, max 560px)
   ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
   ════════════════════════════════════════════════════════════════════════════════════
   ANALYSES LEFT TODAY          │ IN HISTORY        │ SAVED                         ≤72px
   4 / 5  ┃▓▓▓▓▓▓▓▓▓▓▓▓░░░░┃     │ 12                │ 3
   Resets at midnight UTC. Cached results are free.
   ────────────────────────────────────────────────────────────────────────────────────
   ANALYSIS HISTORY                                        │ SAVED              (h2)
   ┃ Search by repository or file path ┃                    │ ══════════════════════
   ═════════════════════════════════════════════════════   │ vercel/next.js
   01  acme/widgets/src/index.ts                     [⋯]   │ The React framework…
       src/index.ts is the public entry point of the…      │ TYPESCRIPT · 2 DAYS AGO
       OVERVIEW  [SHARED]  2 HOURS AGO                     │ ──────────────────────
   ─────────────────────────────────────────────────────   │ RECENTLY VIEWED
   02  acme/widgets/src/utils/slugify.ts             [⋯]   │ ══════════════════════
       …                                                   │ fastapi/fastapi …
   ─────────────────────────────────────────────────────   │
   [ LOAD MORE ]                                           │          320px
════════════════════════════════════════════════════════════════════════════════════════
footer
```
Phone order: masthead → ledger (cells stack 2 + 1) → **Saved** → History → Recently viewed. Use CSS grid areas with DOM order `ledger, history, aside(saved, recent)`, and `order` on phone so Saved shows above History. The DOM keeps Saved after the ledger, so no digits come before the quota.

- **Masthead:** `page` variant. The h1 is `Welcome back, <first name>` (uppercase by CSS) with a blurb. `RepoSearch size="sm"` sits between the title row and the rule.
- **No digits** anywhere in the DOM before the ledger's `4`: header, h1, blurb, input placeholder, hidden nodes.

### 4.5 Shared analysis `/a/[slug]`

Desktop (reading column 66ch, left-aligned within `.page`):
```
CODEXPLAIN    ┃ Open another repository… ┃■GO┃              HOW IT WORKS DASHBOARD (◐) [SIGN IN]
═══════════════════════════════════════════════════════════════════════════════════════════
   OVERVIEW · acme/widgets · main                                      (caption running head)
   src/index.ts                                                       (h1, Plex 26, break-all)
   Shared by @arnav · October 13, 2026                                                 (meta)
   ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
   [■ OPEN WITH THE CODE ]
   ════════════════════════════════════════════════════════
   01  SUMMARY                                       .prose-analysis.is-reading, 17/28
   src/index.ts is the public entry point …  (L6-L9) …
   ════════════════════════════════════════════════════════
   02  KEY PARTS …
   ═══════════════════════════════════════════════════════════════════════════════════════
   Made with Codexplain. Paste any GitHub link and read it like this.  TRY CODEXPLAIN →
═══════════════════════════════════════════════════════════════════════════════════════════
footer
```
Phone: identical stack, 16px gutters. The h1 breaks anywhere.

### 4.6 Legal `/privacy`, `/terms`

```
═══════════════════════════════════════════════════════════════════════════════════
   PRIVACY POLICY                                    Last updated October 2026 (meta)
   ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
   ═══════════════════════════════════════════════════
   01  WHAT WE COLLECT                                 (section label with number)
   ▪ Your GitHub profile name, username, avatar …     (.legal-doc 17/28, 66ch)
   ═══════════════════════════════════════════════════
   02  WHAT WE DON'T COLLECT …
   …
   ───────────────────────────────────────────────────
   See also: Terms of service →                         (page-frame link)
```
- Use a new `.legal-doc` class (same rules as `.prose-analysis.is-reading`, including the numbered h2 counter). Do **not** reuse `.prose-analysis` (`privacy/page.tsx:7`, `terms/page.tsx:7`).
- "open an issue on GitHub" becomes a real link to `…/issues`.
- The header shows the compact repo input at md+.
- Phone: the same stack. The "Last updated" meta wraps under the title.

### 4.7 Not found and errors

Root 404 (desktop; phone stacks the same):
```
CODEXPLAIN   ┃ Open another repository… ┃■GO┃                 DASHBOARD (◐) [SIGN IN]
═══════════════════════════════════════════════════════════════════════════════════
   404                                                   (numeral, 200px, aria-hidden)
   ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
   This page doesn't exist                                    (h1 28/32, sentence)
   The link may be broken, or the page may have been removed.
   [■ BACK TO HOME ]
   OR OPEN A REPOSITORY            ┃ Open another repository…              ┃■ GO ┃
═══════════════════════════════════════════════════════════════════════════════════
footer
```
- **Repo not found:** the same frame without the numeral. The h1 is `Repository not found` and the path `acme/private` appears in Plex `--label`. HTTP 404.
- **Repo error:** the same frame and title per code. The RATE_LIMITED signed-out case gets a primary `Sign in with GitHub`.
- **Runtime error:** the same frame. The h1 is `Something went wrong`, with the digest in Plex, `[■ TRY AGAIN] [ HOME ]` and a "Report an issue" link.
- **Phone:** the numeral is `clamp(96px,20vw,200px)`, so it is about 96px at 412.

---

## 5. KEEP: hooks the e2e tests rely on

These were checked against `tests/e2e/anonymous.spec.ts`, `signed-in.spec.ts` and `mobile.spec.ts`. Projects: `desktop` = Desktop Chrome 1440×900 (all specs except mobile); `mobile` = Pixel 7 412×839 (`mobile.spec.ts` only).

Playwright `getByText` / `getByRole({name})` with a string are **case-insensitive substring** matches unless `exact: true`. `getByText` also matches hidden nodes, so strict mode fails on any duplicate, even an `sr-only` twin.

### 5.1 Landing and routing (`anonymous.spec.ts`)

- `/` has an h1 (`getByRole("heading", { level: 1 })`) whose text contains `Understand any GitHub repository` (anonymous:6). There is one h1 on `/`. Use spaces, no `<br>`; uppercase by CSS only.
- `getByLabel("GitHub repository URL").first()` is the hero input on `/`. Enter submits (8-10, 21-23). The header has no repo input on `/`.
- Invalid input: `getByRole("alert").first()` contains `doesn't look like a GitHub repository` (ASCII `'`) (11). **No other `role="alert"` may come before it in the DOM on `/`.** The specimen and toasts have none.
- `https://github.com/acme/widgets` lands on `/r/acme/widgets` (15).
- `github.com/acme/widgets/blob/main/src/index.ts#L6-L9` lands on `/r/acme/widgets?ref=main&path=src%2Findex.ts#L6-L9` (24). Keep `workspaceHref()` and the server `?at=&kind=&L=` redirect in `r/[owner]/[repo]/page.tsx`.

### 5.2 Workspace (`anonymous.spec.ts`, `signed-in.spec.ts`)

**Repo root:**
- `getByText("Where to start")` is visible at the repo root on desktop (16). The text is **exactly one node** in the DOM. The suggestion buttons are not `role=treeitem`.

**Code view:**
- `.code-view #L6`, `#L9` have class `highlighted`; `#L10` does not (25-27). **Exactly one `.code-view` per page.**
- Each line is `<span class="line" id="L{n}" data-line="{n}">`.
- `src/index.ts` renders exactly **13** `.code-view .line` (36): no wrap duplicates. The specimen never uses `.code-view` or `.line`.
- `.code-view` contains `export function createWidget`, then `export const slugify`, then `createWidget` again after `goBack()` (37, 43, 46). Keep the popstate restore.

**Tree:**
- `getByRole("tree", { name: "Repository files" })` (32).
- Its `treeitem` `src` contains a `button` that toggles (33).
- `treeitem` `index.ts` is clickable and opens the file (34).
- The tree is visible on `/r/acme/widgets` at 1440×900 with no extra click.
- **Folded state must not apply at the root.**

**Keyboard:**
- Keyboard `/` (no modifier, not while typing) focuses `Filter files`. Typing `slug` + Enter opens `src/utils/slugify.ts` (40-43). If the tree is hidden, `/` must reveal it first.

**Binary file:**
- `getByText("This is a binary file")` and `getByText("This file can't be analyzed")` are both **visible** at 1440 (51-52). The plate and the document show side by side. Each text occurs once.

**Signed out:**
- `getByRole("button", { name: "Sign in to analyze" })` is visible for `src/index.ts` on desktop (57).
- On mobile it is visible on the Analysis tab for `README.md` (mobile:10). One such button only.

**Signed in, generation:**
- `getByRole("button", { name: "Generate overview" })` (signed-in:8).
- `new RegExp("Generate Deep dive"|"Generate Code review", "i")` (74): the button text is `Generate ` + lowercased label. No extra words before it.
- `.prose-analysis` is exactly one element on the workspace. It contains `getByRole("heading", { name: "Summary" })` (a real `h2`), `renameWidget`, `createWidget`, and not `SECRET THOUGHT` (10-13, 25, 75).
- The h2 counter must not break the name. Use `content: counter() / ""`; even the fallback "01 Summary" still matches the substring.

**Badges and quota:**
- `getByText("New", { exact: true })` is visible after generation (14, 79). `getByText("Cached", { exact: true })` is visible on revisit (24). One node each. The DOM text is mixed case and the uppercase comes from CSS.
- `getByText("4 left today")` (15) and `getByText("0 left today")` (81) are visible on desktop.
- **At most one node containing `N left today` exists at any time.** The idle meta line and the colophon never coexist. Status strings never contain "left today".

**Line refs:**
- `panel.getByRole("link", { name: "L6-L9" })`: the text is exactly `L6-L9` (ASCII hyphen), with `href="#L6-L9"`.
- A click sets the URL to end with `#L6-L9`, and `.code-view #L7` gets `highlighted` (17-19).

**Mode tabs:**
- `getByRole("tab", { name: "Deep dive" | "Code review" })` (73). Tabs are named `Overview`, `Deep dive`, `Code review`. The number prefix and status marks are `aria-hidden`.

**Regenerate and quota limit:**
- `getByRole("button", { name: "Regenerate analysis" })` is a **visible button** after a result. It is not in a menu and has a visible label "Regenerate" (78-82).
- `getByText("Daily limit reached")` is visible after the quota runs out (83). It is **exactly one node.** The disabled-reason text and the status line use other words.

**Save:**
- `getByRole("button", { name: "Save", exact: true })` posts `/api/repos/star` (63-64), then `getByRole("button", { name: "Saved" })` is visible (65).
- The name comes from the visible text, **with no longer `aria-label` and no tooltip pseudo-content.**
- No other visible button name may contain "saved" (substring), so the ledger's "Saved" is not a button.

### 5.3 Mobile (`mobile.spec.ts`)

- `getByRole("tab", { name: "Files" })` has `aria-selected="true"` on `/r/acme/widgets` with no path.
- Clicking `getByRole("treeitem", { name: "README.md" })` makes `tab "Code"` `aria-selected="true"`, and `.code-view` contains `Widgets`.
- `tab "Analysis"` click shows `Sign in to analyze`.
- `document.documentElement.scrollWidth > window.innerWidth` must be `false` with the Analysis tab open at 412px.
- **Inactive panels are `display:none` on mobile** (so `tab "Code"` doesn't also match the hidden `Code review` tab). The mobile tablist is `display:none` on desktop.

### 5.4 Errors and auth (`anonymous.spec.ts`)

- `/r/acme/private` and `/r/acme/does-not-exist` show `getByRole("heading", { name: "Repository not found" })` (62, 64).
- `/dashboard` signed out redirects to `/login?callbackUrl=%2Fdashboard` or `/dashboard`, which shows `getByRole("button", { name: "Continue with GitHub" })` (69-70). Keep the redirect string in `dashboard/page.tsx`.
- `/this/does/not/exist` returns **HTTP 404** and shows `getByText("This page doesn't exist")` (ASCII `'`) (75-76). The text occurs once.
- **Headers:** CSP contains `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and there is no `x-powered-by` (83-86). Do not touch `next.config.ts` headers. The images CSP stays `self data: blob: avatars.githubusercontent.com`. Fonts stay self-hosted (`font-src 'self' data:`).

### 5.5 Dashboard and sharing (`signed-in.spec.ts`)

- `getByText("Analyses left today")` is visible and occurs exactly once (27).
- `locator("text=4").first()` must be visible (28). **No DOM text containing a digit (hidden or not) may precede the quota number**: header, masthead h1, blurb, input placeholder, `sr-only` nodes, captions, `No. 01`, dates.
- `getByRole("link", { name: /acme\/widgets\/src\/index\.ts/ })`: each history row has exactly one link, and its name is `owner/repo/path` with no spaces (33).
- `getByRole("button", { name: "More actions" }).first()` opens menuitems `Create share link`, `Open shared page` (an `<a>` whose `href` matches `^/a/[A-Za-z0-9_-]{20,}$`), and `Revoke share link`. Escape closes the menu (36-44).
- `getByText("Shared", { exact: true })` is visible after sharing (38). It is one node.
- `getByText("Share link revoked")` is visible as a toast (53). The revoked slug returns 404 (55).
- `getByRole("heading", { name: "Saved" })` must match **exactly one heading** (substring, case-insensitive, so no "Saved repositories" heading). Its **parent element** contains `widgets` (67).
- Shared page: `getByRole("heading", { name: "src/index.ts" })` is exactly one heading (the h1 path; the running head is not a heading). `.prose-analysis` is one element containing `renameWidget` (48-49).

### 5.6 Accessible names that work today and must stay (not all tested)

- `Codexplain home`, `Toggle color theme`, `Account menu`
- `Hide file tree` / `Show file tree`, `Filter files`, `Clear filter`, `Filter refs`, `Search history`
- `Copy analysis as Markdown`, `Share analysis`, `Regenerate analysis`
- `Copy file contents`, `Copy link to this file`, `View on GitHub`
- the progressbar `Daily analyses used`
- tablists `Analysis mode` and `Workspace panels`
- `File path` (nav)

There are **no `data-testid`s**. Tests rely on roles, names, text, the classes `.code-view`, `.line`, `.highlighted` and `.prose-analysis`, and the `L{n}` ids.

---

## 6. Performance budgets

Measure with the existing harness (`scratchpad/capture/perf.mjs`) after **every** phase, on the same profiles (desktop unthrottled; phone Slow 4G + 4× CPU). A phase that breaks a budget is not done. Log LCP, CLS and INP in development with `useReportWebVitals` (`next/web-vitals`).

| Metric | Now (measured) | Budget |
|---|---|---|
| JS gzip, landing / login / privacy / terms | 251 KB | **≤ 200 KB** |
| JS gzip, dashboard | 257 KB | **≤ 225 KB** |
| JS gzip, workspace | 319 KB | **≤ 290 KB** |
| JS gzip, `/a/[slug]` | ≈ 250 KB | **≤ 200 KB** |
| CSS | 10.4 KB, 1 file | **≤ 12 KB gzip, 1 external file** (do **not** enable `experimental.inlineCss`) |
| Grain tiles | n/a | 4.1 KB each; only the active theme's tile loads |
| Fonts | 2 files, 52.8 KB | **≤ 4 files, ≤ 52 KB** per page (planned: 48.6 KiB) |
| Images, workspace | 278 KB | **≤ 20 KB** (avatars at 2×: `&s=48` for 24px, `&s=80` for 40px; owner avatar removed from the running head) |
| LCP, landing / dashboard, phone throttled | 776 / 788 ms | **≤ 800 ms** |
| LCP, workspace, phone throttled | 3,360 ms | **≤ 2,000 ms** |
| LCP, desktop | 152–368 ms | **≤ 400 ms** |
| CLS, every page | ≤ 0.0011 | **≤ 0.01** |
| INP at 4× CPU (open file, line-ref click, mode switch, Stop) | not measured | **≤ 200 ms** |
| RSC prefetches on `/` | 13 | **≤ 4** |

**How to stay inside the budgets:**

1. **Fonts.** Use exactly the §2.2 setup. Sarabun preloads; Plex does not. No 5th file, no italics, no `display: block`.
2. **No layout shift.**
   - The display h1 is a single text run with a fixed line-height and a `clamp()` size. It has no per-letter spans and no JS measuring.
   - The auth slot is fixed width (§3.1).
   - The code line-height is a fixed 24px and the skeleton uses the same rhythm.
   - `scrollbar-gutter: stable` on content pages.
3. **Never animate the LCP.** The h1, blurb and first analysis paragraph are never faded or clipped. The intro is limited to the rule and the plates, 600ms, once per session, and off under reduced motion.
4. **Grain** is a static PNG via `url()` on `html`. No canvas script, no overlay, no `position: fixed`, no blend.
5. **No shadows, gradients, `backdrop-filter` or blur** anywhere (they are also stripped from the theme, §2.10).
6. **Client JS cuts:**
   - Client code never imports `zod`. Move the owner, repo, ref and path checks used by `parse-url.ts` and `validation.ts` into a zod-free `src/lib/github/patterns.ts` (plain regex). Server schemas in `api-schemas.ts`, `env.ts` and the route handlers wrap them.
   - Remove the Radix Tooltip and `TooltipProvider` (§3.12).
   - Load the account dropdown with `next/dynamic` only when signed in.
   - Render the `/a/[slug]` Markdown on the server (no `react-markdown` on that route's client).
   - `prefetch={false}` on example plates, specimen refs, and footer and legal links.
7. **Workspace data:**
   - `page.tsx` awaits `getRepo` / `getRefs`, calls `notFound()` for NOT_FOUND **before** anything streams (this keeps the 404 status), then renders the frame.
   - When `?path=` is set, start `getFile` and the cached-analysis lookup on the server and pass the promises to client components that read them with `use()` inside `<Suspense>` boundaries placed **inside** the workspace frame. This drops the client file → sha → cached waterfall for deep links.
   - **Do not add `r/[owner]/[repo]/loading.tsx`.** Its fallback would start the stream and turn repo 404s into 200s (`loading.md` → Status codes). The in-page Suspense fallbacks draw the exact frame: same grid, rail width, header and toolbar heights, paper, sheet and editor.
8. **Shiki.** It stays server-only with the JS regex engine. Use one css-variables theme. Plain text above 2,500 lines or 150 KB. In-memory HTML cache keyed by `sha + lang` (about 200 entries). Measured: one theme cut a 345-line file's HTML from 145 KB to 93 KB and highlighting from 236 ms to 107 ms.
9. **Streaming.** Flush every 50ms or less in `startTransition`, memoise finished blocks, re-parse only the tail. One CSS caret, no spinners or shimmer.
10. **Scrolling.** Nothing animates on scroll. All scroll and touch listeners are passive. There is no scroll-linked JS.
11. **View transitions** (optional): React `<ViewTransition>` on small named elements only, ≤200ms, zero duration under reduced motion.

---

## 7. File map and phases

| Phase | Files | Done when |
|---|---|---|
| **1. Tokens and fonts** | `globals.css` (§2.10, §3.17, §3.18 CSS), `layout.tsx` (fonts, themeColor `#f2e5c3` / `#131316`, intro head script only), `providers.tsx` (`defaultTheme="light"`, Toaster §3.13, drop TooltipProvider), `highlight.ts` (css-variables theme, caps, cache, `anchors:false`), `src/app/_assets/grain-*.png`, `scripts/make-grain.py`, `icon.svg` (square `#0e1c3a`, cream chevrons, 4px `#f07a2e` centre square, rx 0) | e2e green; app is cream/navy everywhere via aliases; perf run logged |
| **2. Primitives** | `ui/button.tsx`, `ui/badge.tsx`, `ui/input.tsx`, `ui/dropdown-menu.tsx`, `ui/tooltip.tsx` (CSS), `ui/skeleton.tsx`, `ui/kbd.tsx`, `ui/avatar.tsx` (circle, `&s=` sizing), `logo.tsx` (wordmark; square `LogoMark` for the footer if used), `theme-toggle.tsx`, `user-menu.tsx` (auth slot + dynamic menu), `site-header.tsx`, `site-footer.tsx`, `repo-search.tsx` (`useId`, placeholder, hint), new `masthead.tsx`, `caption.tsx`, `list-row.tsx`, `empty-state.tsx` | no `rounded-*` (except pill/avatars), no `shadow-*`, no `/NN` opacity colours in `src/` |
| **3. Content pages** | `(marketing)/page.tsx` + `components/landing/*` + `src/content/specimen.ts`, `login/page.tsx`, `privacy/page.tsx`, `terms/page.tsx`, `not-found.tsx`, `error.tsx`, `a/[slug]/page.tsx`, `(marketing)/dashboard/page.tsx`, `dashboard/history-list.tsx` | §4 wireframes match at 1440 and 412, light and dark |
| **4. Workspace** | `workspace.tsx` (grid, running head, rail/drawer, `/` listener, mobile tabs, `RepoOverview` → document), `file-tree.tsx`, `file-icon.tsx`, `ref-switcher.tsx`, `star-button.tsx` (visible label, no tooltip), `code-viewer.tsx` (editor tab strip, wrap, reduced-motion scroll, focus), `analysis-panel.tsx` (head, tabs, states, colophon), `markdown.tsx`, `r/[owner]/[repo]/page.tsx` (`notFound()`), new `r/[owner]/[repo]/not-found.tsx`, `repo-error.tsx` | §5 all green; mobile chrome 136px; no horizontal overflow at 412 |
| **5. Clean-up** | delete legacy aliases in `globals.css`, `.bg-grid`, `animate-fade-in`, `Sparkles`/`Zap` imports, the `@radix-ui/react-tooltip` dependency | CSS ≤ 12 KB |
| **6. Behaviour and performance** | quota/regenerate/stop states, history Undo, tablist and tree keyboard, listbox filter, server `use()` data for deep links, server Markdown on `/a/[slug]`, zod-free client validation, streaming tail-parse, optional `<ViewTransition>` | §6 budgets met |

Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run test:e2e` at the end of every phase.
