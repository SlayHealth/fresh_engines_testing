# WS4 — Visual design system & consistency

**Reviewer:** WS4 (visual system). **Date:** 2026-07-15. **Method:** drove the seeded `clean` couple
(Aarav & Diya) across dashboard, questionnaire, report and profile at mobile (390×844) and desktop
(1440×900); screenshots in `backend/scratch/ux_shots/` (prefix `ux4_`). Token claims cite source lines
in `frontend/src/app/globals.css` and `frontend/src/app/mobile-shell.css`. Font loading was verified at
runtime (`document.fonts.check`), not eyeballed. Colour claims cite literal hex token definitions.

**Governing rule applied:** the **mobile UI is the locked reference.** Mobile↔desktop divergences are
one-directional *"reconcile desktop to mobile"* items (never "restyle mobile"). Genuine inconsistency
*within* a single system, or global token problems that affect all surfaces, are logged as defects.
The `core-engine/story` report renders the deliberate desktop "Premarital Sync" ring UI on all viewports
(per Finding #0 Report-UI note) — that ring is **not** filed as a reconcile item; the report is assessed
only on its own internal consistency.

---

## What is already right (acknowledge before the defects)

- **Typography is correctly loaded and used.** Runtime probe on the live mobile home:
  `document.fonts.check('16px "Hanken Grotesk"') === true`, `…"Source Serif 4"… === true`. Computed
  `body` font = `"Hanken Grotesk", system-ui, sans-serif`; `.serif` / the gauge number resolve to
  `"Source Serif 4", "Iowan Old Style", Georgia, serif`. Across every surface the split holds:
  **Source Serif 4** for display/headings/narrative (report "Your Health Story", question stems, card
  titles, the drop-cap), **Hanken Grotesk** for UI/body. No surface was observed falling back to a
  system font, and serif/grotesk are not misused. This is a genuine strength. (Loading *method* is
  flagged in UX4-05.)
- **`pink = navigation/brand` is honoured consistently across viewports.** The mobile bottom-nav active
  tab (`.mnav .tab.on { color:var(--h-mag) }`, `mobile-shell.css:345`) and the desktop sidebar active
  item ("Partner Sync", a magenta pill) are *both* pink — same semantic, different chrome. Good.
  (`ux4_report_top_desktop.png`, `ux4_dashboard_mobile.png`.)
- **The questionnaire wizard is the one surface that is consistent across viewports** — same
  `.wizard-bg`, serif question stem, white radio cards, green progress bar and reassurance pill; desktop
  just centres the column. (`ux4_questionnaire_mobile.png` / `ux4_questionnaire_desktop.png`.)
- **The report is internally coherent** (ring KPI + serif narrative + sidebar), as intended.

---

## A. Global / internal-system defects (not viewport divergence — these affect the design language itself)

### [P1] UX4-01 — "The brand teal" is three different greens; two parallel token systems exist
- Flow / Screen: every surface; token defs `globals.css:9,35-37,50,62` + `mobile-shell.css:14-24`
- Viewport: both
- Status: Observed (`ux4_dashboard_mobile.png`, `ux4_dashboard_desktop.png`, `ux4_report_top_desktop.png`) + code-verified hexes
- Evidence: the app runs **two unreconciled palettes**. `globals.css` (desktop + report + wizard):
  `--teal:#18CC96` / `--primary:#18CC96` (`:9,36`), `--pink:#DE457D` (`:31`), paper `#F7F8FA` (`:26`),
  radius 8/10/12 (`:55-57`). `mobile-shell.css` (mobile dashboard/profile/add-prospect), scoped to
  `.mshell`/`.mnav`, redefines the whole world: teal is a **pine** `--h-teal:#0D7365` / `--teal-500:#14A38F`
  (`:14,23`), magenta is `--mag-500:#DC2A76` / `--mag-600:#B8175F` (`:15`), background is a **warm**
  `#F2F0EB` (`:10`), radius 20/26 (`:29`). On top of that, Tailwind **`emerald-*`** utilities are used
  **41×** (emerald-500 `#10b981`, emerald-600 `#059669`) plus `--color-normal:#10b981` (`globals.css:62`).
  Net: the single most important brand colour renders as **#18CC96 vs #10b981/#059669 vs #0D7365**
  depending on which file styled the element (the mobile hero gauge arcs, the desktop pale-green progress
  bar, and the report mint ring are visibly three different greens). The brand pink is likewise **#DE457D
  vs #DC2A76/#B8175F**.
- UX impact: consistency / brand coherence / trust. A health product asking for bloodwork and STI data
  reads as more credible when its signature colour is exactly one colour. Three greens make it feel
  assembled from parts.
- Root cause: design/code — a newer "mshell" system was layered over an older globals+emerald system
  without collapsing tokens.
- Best-fit direction: define ONE brand ramp (pick the mshell values, since mobile is the reference:
  teal `#0D7365`/`#14A38F`, magenta `#B8175F`/`#DC2A76`) as the canonical `--teal-*`/`--pink-*` in
  `globals.css`, map `--primary` to it, and **ban raw `emerald-*` / `#18CC96` literals**. The desktop and
  report surfaces then inherit the mobile hues rather than mint/emerald.
- Effort: L · Blast radius: every surface (this is the spine of WS4).

### [P2] UX4-02 — The brand hue is referenced 4+ inconsistent ways in code (token indirection)
- Flow / Screen: app-wide; `globals.css:9,36`, `dashboard/page.js:180-357`
- Viewport: both · Status: Code-verified
- Evidence: for the *same* green the codebase uses `var(--teal)` (29 files), Tailwind `emerald-*`
  (41 occurrences), `var(--primary)` (3 files), `#18CC96` literals (3 files), `var(--success)` (0), and
  mshell `--h-teal`/`--teal-500`. There is no single source of truth, so UX4-01 is guaranteed to recur on
  any new screen. Pink is healthier but still split (`var(--pink)` 28×, `#DE457D` 4×, `var(--magenta)`
  `globals.css:22`, mshell `--mag-*`).
- UX impact: consistency; maintainability (a brand-colour change can't be made in one place).
- Root cause: code.
- Best-fit direction: one semantic token each (`--brand`, `--brand-2`), delete `--magenta`/`--primary`
  aliases and emerald usage. Fixing this operationalises UX4-01.
- Effort: M · Blast radius: shared — all button/badge/progress styling.

### [P2] UX4-03 — Border-radius scale is fragmented across three overlapping systems
- Flow / Screen: app-wide; `globals.css:55-58`, `mobile-shell.css:29`, Tailwind utilities
- Viewport: both · Status: Code-verified (corroborated in every screenshot)
- Evidence: three radius vocabularies coexist — globals tokens `--radius-sm/md/lg/pill = 8/10/12/999`
  (barely consumed in JS), Tailwind defaults which dominate (`rounded-xl` 12px **88×**, `rounded-lg` 8px
  38×, `rounded-2xl` 16px 37×, `rounded-3xl` 24px, `rounded-md` 6px), and mshell `--r/--r-lg = 20/26`.
  Consequence: an equivalent "primary card" is **16px on desktop** (`rounded-2xl`) but **20–26px on
  mobile** (mshell `.card`/`.hero`), and `--radius-md:10px` is an orphan matching no Tailwind step.
- UX impact: consistency / rhythm.
- Root cause: design tokens never adopted; Tailwind defaults + mshell filled the vacuum.
- Best-fit direction: adopt the mshell ramp (radius `20`/`26`, pill `999`, small `12`) as the canonical
  scale and route Tailwind `--radius-*` theme keys to it so `rounded-2xl` == mobile card.
- Effort: M · Blast radius: shared.

### [P2] UX4-04 — No dark mode anywhere; the mobile shell's dark palette is authored but dead
- Flow / Screen: `mobile-shell.css:35-52`; `MobileHomeView.js:55`, `profile/page.js:201`, `add-prospect/page.js:1518`
- Viewport: both · Status: Code-verified
- Evidence: `mobile-shell.css:35` gates a **complete, well-considered dark palette** on
  `[data-mtheme="auto"]`, but all three mount points hardcode `data-mtheme="light"`, so the dark branch
  can never activate. `globals.css` has **no** `prefers-color-scheme` rule at all. Net: the app is
  light-only, and a finished dark theme sits unreachable.
- UX impact: aesthetic / accessibility (night use of a health app); wasted authored work.
- Root cause: code (the toggle was never wired).
- Best-fit direction: either set `data-mtheme="auto"` (or wire it to a user toggle) to switch the
  already-written mshell dark tokens on, and author matching dark tokens for globals; or, if dark mode is
  out of scope, delete the dead `mobile-shell.css:35-52` block so it isn't mistaken for live support.
  Low effort for the mobile half since the palette already exists.
- Effort: S–M · Blast radius: mshell surfaces.

### [P3] UX4-05 — Real UI fonts load via a render-blocking `@import`; the `next/font` Geist is dead weight
- Flow / Screen: `globals.css:1`, `layout.js:9-17,36`
- Viewport: both · Status: Observed (runtime probe) + code
- Evidence: `layout.js` loads **Geist + Geist_Mono** via `next/font/google` and puts
  `--font-geist-sans`/`--font-geist-mono` on `<html>` — but nothing consumes them and the runtime probe
  returns `document.fonts.check('16px "Geist"') === false`; the body uses Hanken. The **actual** UI fonts
  (Hanken Grotesk + Source Serif 4) are pulled by a Google Fonts **`@import`** at `globals.css:1`, which
  is render-blocking and, if the Fonts CDN is slow/blocked, silently falls the whole app back to
  `system-ui`/`Georgia` (the fallbacks declared at `globals.css:20-21`). So the typography is correct but
  the delivery is fragile and carries an unused font.
- UX impact: perceived performance (FOUT/FOIT), robustness of the branded look; minor payload waste
  (overlaps WS10).
- Root cause: code.
- Best-fit direction: delete the Geist import; self-host Hanken Grotesk + Source Serif 4 via
  `next/font/google` and bind them to `--font-sans`/`--font-serif`, removing the `@import`.
- Effort: S · Blast radius: global (font pipeline only).

### [P3] UX4-06 — The two-colour semantic is diluted where teal/magenta become 2-of-5 category hues
- Flow / Screen: mobile home gauge + section list; report "Tracked Markers"; `mobile-shell.css:17-24`
- Viewport: both · Status: Observed (`ux4_dashboard_mobile.png`)
- Evidence: the section system assigns five arbitrary hues — `--h-mag`, `--h-teal`, `--h-sea`, `--h-moss`,
  `--h-gold` — one per health section (About You reads blue/`sea`, Lifestyle green/`moss`, etc.). In this
  context teal no longer means "verified/real data" and magenta no longer means "brand/nav"; they are
  decorative categories sitting beside sea/moss/gold. The signature two-colour story is strongest on the
  hero/nav/match band and weakest here.
- UX impact: consistency / the "pink=brand, teal=verified" semantic is not load-bearing where colour is
  used categorically.
- Note: this is a **deliberate, locked** mobile design choice, so it is logged as an observation, **not**
  a defect demanding a mobile restyle. Raised because the brief asked where the semantic is decorative.
- Best-fit direction (if ever revisited): give the five sections a **neutral/single-hue** ring set and
  reserve teal+magenta exclusively for verified-data and brand/nav, so the two signature colours keep
  meaning. Treat as opportunity, not fix.
- Effort: M · Blast radius: mobile section list + report markers.

---

## B. Desktop-reconcile items (mobile is the reference; desktop diverges — one-directional)

### [P1] UX4-07 — Headline-KPI language: mobile's weighted arc-gauge vs desktop's flat progress bar
- Flow / Screen: home; mobile `MobileHomeView.js:85-90` + `WeightedGauge.js` + `mobile-shell.css:119-143`; desktop `dashboard/page.js` ("THE FULL PICTURE" bar)
- Viewport: both (divergence) · Status: Observed (`ux4_dashboard_mobile.png` vs `ux4_dashboard_desktop.png`)
- Evidence: the **same metric** ("The Full Picture", 88% data-confidence) is rendered two entirely
  different ways. Mobile: a **multi-arc WeightedGauge** where each arc's length encodes a section's weight
  and fill encodes progress, in a large serif number on a **dark teal hero** card. Desktop: a **flat green
  linear progress bar** on a pale-green panel with a small "88%". These share no visual DNA.
- UX impact: consistency / brand coherence — the desktop headline throws away the product's signature
  visualisation.
- Root cause: design/IA — desktop dashboard predates and was never reconciled to the mobile home.
- Best-fit direction: port the mobile `WeightedGauge` (hero card + arcs + serif number) to the desktop
  dashboard as the headline KPI; retire the linear bar.
- Effort: M · Blast radius: desktop dashboard.

### [P1] UX4-08 — The desktop dashboard is a different design, not a responsive reflow
- Flow / Screen: home; `dashboard/page.js` (desktop branch) vs `MobileHomeView.js` (mobile branch, chosen at `dashboard/page.js:146`)
- Viewport: both · Status: Observed (`ux4_dashboard_desktop.png` vs `ux4_dashboard_mobile.png`)
- Evidence: `dashboard/page.js:126,146` hard-branches on `useIsMobile()` and renders two unrelated trees.
  Order + components differ: **mobile** = gauge hero → magenta "Start a compatibility check" band →
  recent mini-ring → mshell section cards (20–26px) → dark serif "care" card ("AI assistant… human
  consults coming soon"). **Desktop** = magenta "1 match available" band on top → "Recent Activity" flat
  chip → linear "Full Picture" bar → section cards (16px) → a dark **"Need Help? — Our medical team is
  here to assist you"** card. Beyond styling, the desktop help card asserts a **"medical team"** the
  mobile care card was deliberately reworded to avoid (trust/copy — cross-ref WS9; not re-filed here).
- UX impact: consistency / brand coherence / trust (two products in one skin).
- Root cause: IA/design.
- Best-fit direction: rebuild the desktop dashboard as the mobile layout on a wider grid (same section
  order, mshell cards, gauge hero, matching care-card copy) rather than a parallel design.
- Effort: L · Blast radius: desktop dashboard (umbrella for UX4-07/09/10/11).

### [P1] UX4-09 — Profile is a different screen, language and IA per viewport
- Flow / Screen: profile; mobile `profile/page.js:201` (mshell) vs desktop branch (plain form)
- Viewport: both · Status: Observed (`ux4_profile_mobile.png` vs `ux4_profile_desktop.png`)
- Evidence: **mobile** = a curated "**Account**" hub — serif title, magenta gradient rounded-square
  avatar, a magenta plan card with white meter bars ("Scans · 1 of 1 left"), and two tidy list cards
  (Personal details / Reports / Privacy / Settings; Sign out / Delete). **Desktop** = a raw "**Profile**"
  **edit form** — flat pink circle avatar, native `<select>` gender, native date input, an open
  autocomplete, ungrouped height/weight fields, green+amber quota pills, then "Unlock more…", Compliance,
  "WhatsApp Messages (Admin)", Log Out, Delete. Different title, different avatar, different visual
  language, and a different information architecture (curated hub vs settings dump).
- UX impact: consistency / trust / comprehension — the same destination feels like two apps.
- Root cause: IA/design (desktop profile never adopted mshell).
- Best-fit direction: reconcile desktop to the mobile "Account" hub (drill-in sub-pages rather than one
  flat form), reuse the mshell avatar/plan/list components, and unify the title.
- Effort: L · Blast radius: desktop profile.

### [P2] UX4-10 — Recent-match KPI: stroked mini-ring (mobile) vs flat filled chip (desktop)
- Flow / Screen: home recent card; mobile `MobileMiniRing.js` (`MobileHomeView.js:121`) vs desktop `dashboard/page.js:329`
- Viewport: both · Status: Observed (`ux4_dashboard_mobile.png` vs `ux4_dashboard_desktop.png`)
- Evidence: the 85% match score is a **stroked progress ring** (tone `moss`) on mobile but a **flat
  soft-teal filled circle with "85%"** (no ring stroke) on desktop. Different KPI grammar for the same
  datum on the same card.
- UX impact: consistency.
- Best-fit direction: use `MobileMiniRing` on desktop too.
- Effort: S · Blast radius: desktop dashboard recent card.

### [P2] UX4-11 — Identity avatar: magenta gradient rounded-square (mobile) vs flat pink circle (desktop)
- Flow / Screen: appbar + profile; mobile `mobile-shell.css:85-86` vs desktop avatars
- Viewport: both · Status: Observed (`ux4_profile_mobile.png` vs `ux4_profile_desktop.png`, `ux4_dashboard_*`)
- Evidence: mobile avatar = `linear-gradient(150deg,var(--mag-500),var(--mag-700))`, 14px radius, with a
  magenta glow shadow; desktop avatar = a flat solid-pink **circle**. Two treatments for the same
  identity element (shape, fill and radius all differ).
- UX impact: consistency / brand coherence.
- Best-fit direction: adopt the mshell gradient rounded-square avatar everywhere.
- Effort: S · Blast radius: any surface showing the user avatar.

### [P2] UX4-12 — Quota-chip colour diverges and misuses the warning hue on desktop
- Flow / Screen: home + profile quota chips; mobile `mobile-shell.css:114-115` vs desktop pills
- Viewport: both · Status: Observed (`ux4_dashboard_desktop.png`, `ux4_profile_desktop.png`, `ux4_dashboard_mobile.png`)
- Evidence: mobile encodes quota with **teal dots for scans** and **magenta dots for chats**
  (`.chip .meter i.f` / `.meter.m i.f`). Desktop renders a **green "1/1 scan" pill and an amber "5/5
  chats" pill**. Amber is the palette's **warning** colour (`--warning:#F4A100`, `globals.css:18`;
  `--amber`, `:39`) yet here it marks a perfectly healthy, full "5/5 chats" — a mild semantic misuse — and
  it also fails to match mobile's magenta.
- UX impact: consistency + a small semantic-colour error (amber = caution shouldn't flag a full quota).
- Best-fit direction: mirror mobile — teal for scans, magenta for chats; never amber for a non-warning
  state.
- Effort: S · Blast radius: desktop dashboard + profile chips.

---

## Opportunities

### ★ OPP-UX-W4-1 — Collapse to one tokenised design system (fixes UX4-01/02/03)
- Rationale: one palette (mshell hues), one radius ramp, one green sourced one way.
- User benefit: the product reads as a single, credible, premium health brand at every touchpoint —
  material for a sensitive-data product where polish underwrites trust.
- Effort: L · Impact: high (removes the root cause of most WS4 findings).

### OPP-UX-W4-2 — Ship the already-authored dark theme (fixes UX4-04)
- Rationale: the mshell dark palette exists; only the `data-mtheme` wiring is missing.
- User benefit: comfortable night use of a health app; modern expectation.
- Effort: S–M (mobile half) · Impact: medium.

### OPP-UX-W4-3 — Componentise the mobile KPI/avatar/quota primitives and reuse on desktop (fixes UX4-07/10/11/12)
- Rationale: `WeightedGauge`, `MobileMiniRing`, the mshell avatar and chip meters are already built;
  desktop reinvents each as a one-off.
- User benefit: instant cross-viewport consistency; less code.
- Effort: M · Impact: high.

---

## Screenshot index (`backend/scratch/ux_shots/`)
- `ux4_dashboard_mobile.png` / `ux4_dashboard_desktop.png` — home, both viewports (UX4-01/07/08/10/12)
- `ux4_report_story_mobile.png` / `ux4_report_story_desktop.png` / `ux4_report_top_desktop.png` — report (intended ring UI)
- `ux4_profile_mobile.png` / `ux4_profile_desktop.png` — profile (UX4-09/11)
- `ux4_questionnaire_mobile.png` / `ux4_questionnaire_desktop.png` — wizard (consistent surface)
