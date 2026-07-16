# WS5 — Responsive / Mobile-Reference Audit

**Reviewer workstream:** WS5 (IDs `UX5-NN`). Driven live in headless Chromium at mobile (390×844) and
desktop (1440×900), plus targeted probes at 360/430/800/900/1000px to check breakpoint behaviour, against
seeded couples `clean` (score 88), `sti` (STI-capped), `severe` (severe findings), `partial` (pending
invite) and `empty` (first-run), plus one throwaway no-name account (`+19990805001`) seeded to reach the
onboarding wizard. Screenshots in `backend/scratch/ux_shots/` (prefix `ux5_`). Read-only on code.

**Governing rule honoured:** the mobile UI is the **locked design reference**; every divergence below is
written as a one-directional *"reconcile desktop to mobile"* item — none propose changing mobile. The
`core-engine/story` report's desktop-style "Premarital Sync" ring/tab UI rendering on all viewports is the
**deliberate Report-UI decision** (per the master doc's Report-UI note) and is **not** filed here as a
reconcile defect; the report shell was still checked for overflow/breakage/touch-target problems on its
own terms. Engine/medical findings and IA/navigation findings already logged by other workstreams
(`SLAYHEALTH_DEEP_REVIEW.md`, `review/WS*.md`, `review/ux_WS2_ia_nav.md`, `review/ux_WS4_visual.md`) are
referenced, not re-diagnosed — WS4 already covers palette/radius/typography/dark-mode and the "desktop
dashboard/profile is a different design" framing (UX4-07/08/09/10/11/12); this workstream focuses on
**layout mechanics**: overflow/breakage, breakpoint correctness, touch-target sizing, and content parity
between viewports.

**Surfaces mapped:** landing (`frontend/src/app/page.js` + `components/landing/*`), login/OTP + onboarding
(`app/login/page.js`, `app/onboarding/page.js`), dashboard (`app/dashboard/page.js` +
`dashboard/MobileHomeView.js`), profile (`app/profile/page.js`), add-prospect hub + 5 category steps
(`app/add-prospect/page.js`), and all 5 report tabs (`app/core-engine/{story,mfr,chronic,usg,genomics}`).

---

## Lead summary (breadth-first: what actually breaks vs. what's just different)

- **A real breakpoint bug, not just a style gap:** the JS tree-switch (`useIsMobile`, 767px) and the
  floating bottom nav's hide point (1024px) disagree, so **every viewport from 768–1023px renders the
  desktop-designed dashboard/profile tree underneath the mobile bottom nav** — two chrome systems that
  were never designed to coexist, live-measured at 800/900/1000px (UX5-01, P1).
- **Zero horizontal-overflow/scrollbar bugs anywhere tested** — a genuine strength, stated up front so the
  findings below read as real gaps, not a fishing expedition (see positive callout at the end).
- Two clean **content-parity gaps**, same shape both times: a mobile-only micro-enhancement (per-section
  time estimates; a privacy/trust line) that was simply never ported to the desktop components that render
  the same information (UX5-02, UX5-03).
- The desktop **add-prospect hub has no way back to the dashboard at all** — mobile has an explicit link
  (UX5-04).
- **Profile is the one surface where "no real desktop design pass" is measurable, not just a feeling:** a
  512px column adrift in 1440px of flat, undecorated paper (UX5-05).
- Recurring **small tap targets** across shared components — report nav rows, the wizard back arrow, and
  two tertiary text links all land under the ~44px comfortable minimum (UX5-06).

---

### [P1] UX5-01 — 768–1023px is a real breakpoint dead-zone: desktop tree renders under the mobile bottom nav
- Flow / Screen: Dashboard and Profile at "tablet"/small-laptop widths. `frontend/src/hooks/useIsMobile.js:5`
  (`const QUERY = '(max-width: 767px)'`) drives the React tree switch at
  `frontend/src/app/dashboard/page.js:126,144,146` and `frontend/src/app/profile/page.js:86,197,199`. The
  floating bottom nav only hides at 1024px, via **two** independent mechanisms that happen to agree with
  each other but not with `useIsMobile`: Tailwind `lg:hidden` on `frontend/src/components/MobileBottomNav.js:181`,
  and an explicit override at `frontend/src/app/mobile-shell.css:369-371` (`@media (min-width:1024px){ .mnav{display:none} }`
  — the accompanying comment at `:362-368` explains this rule was added because the Tailwind class alone
  was silently losing a CSS-specificity/order fight, i.e. this exact mismatch has already bitten the
  codebase once).
- Viewport: both (specifically the 768–1023px band, real widths: iPad portrait 768, common small-laptop/
  split-screen widths 800/900/1000, Surface-class devices, browser windows snapped to half a 1440–1920
  display)
- Status: Observed — live-measured at 800/900/1000px on both routes:
  `tablet_w800_dashboard_bottomNav:{present:true,display:"grid",visible:true,h:64}` +
  `tablet_w800_dashboard_isMobileTree:false` (no `.mshell` in the DOM), identical results at 900 and 1000,
  and identically on `/profile`. Screenshots `ux5_tablet_w800_dashboard.png`, `ux5_tablet_w900_dashboard.png`,
  `ux5_tablet_w1000_dashboard.png`, `ux5_tablet_w800_profile.png`, `ux5_tablet_w900_profile.png`,
  `ux5_tablet_w1000_profile.png`.
- Evidence: at 800px the dashboard renders the **desktop** tree — flat "1 match available" banner, linear
  "Recent Activity" list, "THE FULL PICTURE" progress bar, 16px-radius `CategoryHub` cards (no gauge hero,
  no mshell styling) — while the **mobile** floating pill nav (Home / Health / Chat AI FAB / Analysis)
  still renders fixed at the bottom, because it isn't gated by the same 768px signal the page content is.
  The result is a page that is unambiguously "the desktop design" wearing "the mobile nav" at once — two
  chrome systems stitched together that were never designed, or QAed, to appear on the same screen. (The
  `.mnav` CSS additionally caps its own width at `calc(768px - 24px)` — `mobile-shell.css:340` — so even
  the nav itself assumes it will only ever appear alongside the narrow mshell column, not the wide desktop
  tree it's actually sitting on top of in this band.)
- UX impact: consistency + comprehension. A meaningful, common device-width range gets a page that looks
  assembled from two different products. This isn't cosmetic drift between viewports — it's two navigation
  paradigms (desktop's "no persistent nav, in-page buttons" and mobile's "persistent bottom tab bar")
  overlapping on one screen.
- Heuristic: consistency & standards; match between system and real world (the chrome promises "this is
  the mobile app" while the content underneath is the desktop layout).
- Root cause: code — the page-tree switch and the nav-visibility switch are two independently-authored
  breakpoints (767px vs 1024px) that were never reconciled.
- Best-fit direction: make `useIsMobile`'s query and `.mnav`'s hide breakpoint the same value (recommend
  1024px, i.e. widen `useIsMobile` to `max-width: 1023px`, since `.mnav` already treats 1024 as authoritative
  in two places) so the content tree and the nav always flip together.
- Effort: S (single constant change + verification the desktop tree tolerates 768–1023px widths)
- Blast radius: `useIsMobile.js` is imported by dashboard, profile, and add-prospect — widening its query
  changes the tree-switch point for all three; add-prospect is unaffected in practice since
  `MobileBottomNav` already self-suppresses on `/add-prospect` regardless of width.

### [P2] UX5-02 — Per-section time estimates exist on mobile section cards, are absent everywhere on desktop
- Flow / Screen: Health-profile section list — mobile `dashboard/MobileHomeView.js:148` (`MobileSectionList`)
  and the add-prospect mobile hub `add-prospect/page.js:1544-1549` vs. desktop `CategoryHub`
  (`dashboard/page.js:370-374`, `add-prospect/page.js:1571-1583`).
- Viewport: both (divergence)
- Status: Observed — `ux5_addp_hub_mobile.png` vs `ux5_addp_hub_desktop.png` (same account, same data, same
  screen, side by side).
- Evidence: on mobile, every section card shows a duration estimate appended to its description — "Basics,
  body & relationship context · ≈1 min", "Activity, sleep, drinking & more · ≈25 sec", "Bloodwork — upload
  or book at home · ≈2 min", "Optional · 21 quick questions · ≈2 min". These come from a real, populated
  field: `duration` is computed per category in `frontend/src/utils/mobileSections.js:11` (e.g.
  `pathology: {..., duration: '2 min'}`) and surfaced at `:32,54`, consumed only by `MobileSectionList`. The
  desktop `CategoryHub` component (`frontend/src/components/wizard/CategoryHub.js`) has no `duration` prop
  and no time-estimate rendering anywhere in the file — the identical cards on desktop show only the label,
  the `+N% CONFIDENCE` pill and the description, with the time-to-complete information simply dropped.
- UX impact: friction — "how long will this take" is exactly the hesitation-reducing information a busy
  user needs before starting a section, especially on a health-data form; desktop users lose it for no
  reason tied to screen size.
- Heuristic: consistency & standards; recognition over recall (mobile users can gauge effort at a glance,
  desktop users cannot).
- Root cause: code — `duration` was added to the mobile-only data-shaping utility and consumed only by the
  mobile-only list component; the desktop-shared `CategoryHub` was never updated to accept or render it.
- Best-fit direction: thread `duration` through to `CategoryHub`'s card (it already receives the full
  category object) and render it next to the description on desktop too, exactly as mobile does.
- Effort: S
- Blast radius: `CategoryHub.js` (used by both the dashboard-embedded hub and the add-prospect hub on
  desktop) — one shared component fix covers both call sites.

### [P2] UX5-03 — Desktop dashboard has no privacy/trust reassurance line; mobile has one, consistently
- Flow / Screen: Dashboard — mobile `dashboard/MobileHomeView.js:169` vs. desktop
  `dashboard/page.js:163-391` (full desktop return block).
- Viewport: both (divergence)
- Status: Observed — measured `hasTrustLine` (regex `/Encrypted end to end/i` against `document.body.innerText`)
  across 4 of 5 seeded couples at both viewports (the 5th, `severe`/mobile, hit a transient session bounce
  to the public landing page mid-check — see Methodology note — and was excluded rather than counted either
  way): `clean`, `sti`, `partial`, `empty` all **true** on mobile, **false** on desktop, every time.
  Screenshots `ux5_dash_clean_mobile.png` / `ux5_dash_clean_desktop.png` (and the `_sti`/`_partial`/`_empty`
  pairs).
- Evidence: mobile's dashboard ends with `<p className="trust"><Ico name="lock"/> Encrypted end to end.
  Nothing is shared with your partner or family until you say so.</p>` — a one-line reassurance that sits
  above the medical disclaimer on every load. The desktop tree's equivalent trailing content
  (`dashboard/page.js:378-390`, the "Need Help?" card + medical disclaimer) has no privacy/encryption
  statement anywhere on the page, at any state, for any of the 5 seeded accounts.
- UX impact: trust. Through the "sensitive-data, two-people, high-stakes" lens this brief calls for: a
  reassurance that the user's data isn't shared with their prospect's family without consent is exactly the
  kind of line that matters most right before a "Start a compatibility check" CTA — mobile users get it,
  desktop users (arguably the users with more screen space to spare for it) don't.
- Heuristic: consistency & standards; visibility of system status (the system's data-handling posture
  should be equally visible regardless of device).
- Root cause: copy/design — the line was authored directly into the mobile-only `MobileHomeView` and never
  ported to the desktop tree.
- Best-fit direction: add the identical line to the bottom of the desktop dashboard, near the existing
  medical disclaimer, verbatim.
- Effort: S
- Blast radius: desktop dashboard only.

### [P2] UX5-04 — Desktop add-prospect "Health Profile" hub has no way back to the dashboard
- Flow / Screen: `/add-prospect` hub (no `?enter=` param) — mobile branch
  `frontend/src/app/add-prospect/page.js:1516-1568` vs. shared/desktop wrapper `:1586-1601`.
- Viewport: desktop (divergence — mobile has the control, desktop doesn't)
- Status: Observed — `ux5_addp_hub_mobile.png` vs `ux5_addp_hub_desktop.png`; code-confirmed no back
  affordance exists in the desktop render path.
- Evidence: the mobile hub renders its own explicit control at the top: `<button onClick=
  {handleBackToDashboard} aria-label="Back to Dashboard">‹ Dashboard</button>` (`page.js:1522-1530`),
  visible as "‹ Dashboard" above the "Health profile" title in the screenshot. The desktop/shared wrapper
  that renders the same hub (`body = <CategoryHub .../>` at `:1571-1583`, wrapped by the `<main>` at
  `:1586-1601`) contains **only** `<span>{headerTitle}</span>` (`:1590`) — plain text, no button, no link.
  There is no `add-prospect/layout.js` and no other persistent chrome on this route, so on desktop the only
  way out of the hub is the browser's own Back button; there is no in-app affordance at all. Every
  individual category step (About/Lifestyle/Pathology/…) does get a working back arrow via
  `QuestionScreen`'s `onBack` — it's specifically the **hub itself** that has nothing.
- UX impact: friction — a page whose entire purpose is "resume health-profile progress and jump between
  sections" is, on desktop, a one-way door once you land there from anywhere other than in-app navigation
  (e.g. a bookmark, a refresh, or arriving via a section deep-link and then wanting to return to base).
- Heuristic: user control & freedom.
- Root cause: IA/code — the mobile hub was given a bespoke header with a back link; the desktop/shared
  wrapper reused only the generic step-header `<span>`, which was never designed to also cover the hub
  case.
- Best-fit direction: give the desktop hub the same "‹ Dashboard" control mobile has (or, if consolidating,
  make the shared header component at `:1586-1601` render a back-to-dashboard link whenever there's no
  active category, i.e. whenever `onBack` isn't otherwise supplied).
- Effort: S
- Blast radius: `add-prospect/page.js` header wrapper only.

### [P2] UX5-05 — Profile's desktop column is measurably narrower and undecorated versus dashboard's
- Flow / Screen: Profile desktop (`frontend/src/app/profile/page.js:265`, `max-w-lg mx-auto`) vs. Dashboard
  desktop (`frontend/src/app/dashboard/page.js:189`, `max-w-5xl mx-auto`, with a decorative fixed background
  at `:168-187` — radial dot-grid + three blurred colour blooms + two dashed SVG paths).
- Viewport: desktop
- Status: Observed — measured column geometry at 1440px viewport width:
  `dash_desktop_colW:{w:1024,x:208,sideGutter:208}` vs. `profile_desktop_colW:{w:512,x:464,sideGutter:464}`.
  Screenshots `ux5_dash_clean_desktop.png` vs `ux5_profile2_desktop.png`.
- Evidence: the dashboard's content column already runs noticeably narrower than the viewport (1024px of
  1440px, 208px empty on each side) — but that gutter is filled with an ambient, on-brand background
  (confirmed the ONLY surface with this treatment). Profile's column is **half again narrower still**
  (512px, i.e. exactly the mobile/wizard width, per WS4's UX4-09), and its gutter — 464px per side, 43% more
  empty space than the dashboard's — has **no decorative treatment at all**: `profile/page.js:264`'s
  `<main>` is just `background: var(--paper)`, flat and empty on both sides. Visually this reads as the
  clearest "this screen never got a desktop design pass" moment in the whole app: a settings form floating
  in the middle of an otherwise-bare 1440px canvas.
- UX impact: aesthetic/consistency. Doesn't block anything, but is the single most literal instance of the
  brief's "unused whitespace that suggests no real desktop design pass happened."
- Heuristic: aesthetic & minimalist design (in the negative sense — this is *unintentional* empty space, not
  restraint).
- Root cause: design — profile's desktop branch reused the mobile/wizard container width (`max-w-lg`,
  matching the onboarding/login/add-prospect wizard's `max-w-md`-ish family) without adopting either the
  dashboard's wider column or its decorative fill.
- Best-fit direction: widen the desktop profile column toward the dashboard's `max-w-5xl` (or a purpose-fit
  intermediate width) and reuse the same ambient background treatment, so profile stops reading as an
  orphaned settings form; this can be done independently of WS4's IA recommendation (rebuilding profile as
  the mobile "Account" hub) as a lower-effort intermediate fix.
- Effort: S (background reuse) – M (column width + reflow of the two 3-field grids)
- Blast radius: desktop profile only.

### [P2] UX5-06 — Small, inconsistent tap targets recur across shared navigation controls
- Flow / Screen: Report nav rows (`frontend/src/app/core-engine/layout.js:203-215` desktop sidebar button,
  `:272-284` mobile drawer button — identical classes, `px-4 py-2.5` on 12px/`text-xs` labels); wizard back
  arrow (`frontend/src/components/wizard/QuestionScreen.js:63-71`, `w-8 h-8`); add-prospect mobile hub's
  "‹ Dashboard" link (`add-prospect/page.js:1522-1530`); "Use a mock report instead" / "Suggested tests"
  tertiary links (`add-prospect/page.js:1155-1162`, `CategoryHub.js:132`).
- Viewport: both (these are not mobile/desktop divergences — the same small size recurs everywhere the
  component is used; most consequential for touch on mobile)
- Status: Observed — measured bounding boxes: report nav rows **208×36** (mobile drawer,
  `ux5_report_drawer_mobile.png`) and **207×36** (desktop sidebar); wizard back button **32×32**
  (`ux5_addp_about_mobile.png`, `ux5_addp_about_desktop.png`); mobile hub "‹ Dashboard" **86×19**
  (`ux5_addp_hub_mobile.png`); "Use a mock report instead" **152×16** and "Suggested tests" **117×16**
  (`ux5_addp_pathology_mobile.png`, `ux5_addp_hub_desktop.png`).
- Evidence: for comparison, this same app's bottom-nav tabs measure a comfortable **91×62**
  (`clean_mobile_drawerTargets`, confirming WS2's UX2-09 measurement still holds) — so the product already
  knows how to size a primary tap target correctly. Against that baseline, the report's own in-report
  navigation (drawer on mobile, sidebar on desktop) is little more than half as tall at 36px; the back arrow
  that appears on literally every onboarding/login/add-prospect wizard step is a 32×32 circle; the one link
  back to the dashboard from the mobile health-profile hub is a 19px-tall text row; and two "secondary
  action" links use an unpadded 12px text line (~16px tap height) as their entire hit target.
- UX impact: friction/accessibility — these are all **repeat-use, high-traffic** controls (every wizard
  step, every report-tab switch, every "I don't have this file yet" moment), not one-off edge cases, so
  mis-taps here compound across a session.
- Heuristic: Fitts's law / touch-target sizing (WCAG 2.5.5's 44×44 target as a reference point, not cited as
  a formal a11y audit — that's WS6's lane).
- Root cause: design/code — no shared minimum-tap-height convention; each component was sized to its visual
  content rather than to a tap-target floor.
- Best-fit direction: establish one minimum interactive-row height (44px, matching the bottom nav's own
  62px-tall precedent at the top end) and apply it to the report nav rows and the hub back-link; for the
  two tertiary text links, keep the small visual footprint but wrap them in a button with invisible padding
  so the *hit area* clears ~40px even though the *visible* text stays compact.
- Effort: S–M (padding/hit-area only, no visual redesign needed)
- Blast radius: `core-engine/layout.js` nav buttons (2 call sites), `add-prospect/page.js` hub back-link and
  mock-report link, `CategoryHub.js` "Suggested tests" toggle.

---

## Positive findings (acknowledge what's working before the roadmap)

- **No horizontal-overflow or scrollbar bugs found anywhere in the tested surface.** Measured
  `document.documentElement.scrollWidth` vs `clientWidth` (0px difference in every case) across: landing,
  login phone/OTP, onboarding (name/relation/eta), dashboard for all 5 seeded couples, profile, all 6
  add-prospect steps (hub/about/lifestyle/pathology/radiology/mental), and all 5 report tabs — at 390px and
  1440px, plus explicit checks at 360/430/800/900/1000px. For a codebase running two largely-separate
  design systems (mshell vs. Tailwind/globals, per WS4), this is a real, verified absence of the most common
  class of responsive bug.
- **The report's "Partner Sync" (story) tab does genuine responsive re-layout, not hide/show.**
  `core-engine/story/page.js:775` (`grid grid-cols-1 lg:grid-cols-[1fr_340px]`) reorders three cards via
  `order-1/2/3` and `lg:col-start/row-start` so the desktop's sticky right-rail "Health Together Index" card
  becomes mobile's first card, with no content ever hidden — confirmed overflow-free at both viewports
  (`ux5_report_story_mobile.png`, `ux5_report_story_desktop.png`). This is the right way to reconcile a
  layout across breakpoints and is a useful in-house reference for fixing UX5-01/04/05 above.
- The onboarding/login wizard (name → relation → ETA) is pixel-identical in structure at both viewports —
  extending WS4's observation that "the questionnaire wizard is the one surface consistent across
  viewports" to the auth/onboarding wizard as well (`ux5_onboard_name_mobile.png` /
  `ux5_onboard_name_desktop.png`).

---

## Methodology note — what was investigated and ruled out (not filed as defects)

In the course of driving ~40 page loads across 5 seeded accounts, three anomalies appeared that looked at
first like responsive-specific bugs but did not hold up under a repeat test, and are recorded here for
transparency rather than filed as findings, per the "Observed vs Suspected never blurred" rule:
- One `severe`/mobile dashboard load, and one `radiology`(desktop)/`mental`(mobile) add-prospect deep-link
  mid a long automated session, bounced to the public marketing landing page (`/`) instead of the expected
  screen — the same known session/silent-refresh-race class of issue as WS8-01/UX2-09, not a new
  viewport-specific bug (both directions of viewport showed both outcomes across retries).
- The `severe` couple's "Organ Wellness" tab showed a polished "Radiology Analysis Inactive" empty state on
  one run and a raw red "Failed to load radiology data" error banner on another, for the same account —
  looked like a mobile-vs-desktop divergence in one pass, but a 4-run repeat test
  (`desktop→error, mobile→ok, desktop→ok, mobile→ok`) showed both viewports get either outcome
  interchangeably; the code (`core-engine/usg/page.js:66-80`) confirms there is only one, viewport-agnostic
  fetch/error path. This is a real error-state quality gap (the error banner has no retry and no guidance,
  unlike the component's own empty state a few lines below) but it's a states/error-UX finding, not a
  responsive one — flagged here for WS7 rather than filed under WS5.

---

## Opportunities (WS5)

- **OPP-UX-51** (fixes UX5-01): unify `useIsMobile`'s breakpoint with `.mnav`'s 1024px hide-point so the
  page tree and the nav always change together; add a CI/visual-regression check at 768/900/1023/1024px so
  this class of drift can't silently reappear. Effort S. Impact: high (removes an entire device-width band
  of mismatched chrome).
- **OPP-UX-52 ★** (fixes UX5-02/UX5-03): audit `MobileHomeView`/`MobileSectionList` for every mobile-only
  micro-copy/data affordance (time estimates, trust line, others not yet caught) and port each to the
  desktop-shared components (`CategoryHub`, desktop dashboard tree) in one pass, rather than one-off patches
  — these two findings share the exact same root cause (desktop components lagging behind mobile-authored
  enhancements) and are likely not the only two instances. Effort M. Impact: medium-high (comprehension +
  trust).
- **OPP-UX-53** (fixes UX5-06): define one shared minimum tap-target height (44px) as a design token and
  apply it to `core-engine/layout.js`'s nav buttons and any other compact interactive row going forward, so
  new report tabs/nav items don't reintroduce 36px rows.

---

## Screenshot index (`backend/scratch/ux_shots/`, prefix `ux5_`)
- Landing/login/onboarding: `ux5_landing_{mobile,desktop}(_full)`, `ux5_login_phone_{mobile,desktop}`,
  `ux5_login_otp_{mobile,desktop}`, `ux5_onboard_{name,relation,eta}_{mobile,desktop}`.
- Dashboard (5 couples × 2 viewports): `ux5_dash_{clean,sti,severe,partial,empty}_{mobile,desktop}`.
- Profile: `ux5_profile2_{mobile,desktop}(_full)`.
- Tablet dead-zone: `ux5_tablet_w{800,900,1000}_{dashboard,profile}` (UX5-01).
- Add-prospect (6 steps × 2 viewports): `ux5_addp_{hub,about,lifestyle,pathology,radiology,mental}_{mobile,desktop}`
  (UX5-02, UX5-04, UX5-06).
- Report (5 tabs × 2 viewports, `clean`): `ux5_report_{story,mfr,chronic,usg,genomics}_{mobile,desktop}`;
  drawer open: `ux5_report_drawer_mobile.png` (UX5-06); content-parity spot check on `severe`:
  `ux5_report_severe_{chronic,usg}_{mobile,desktop}` (see Methodology note).
