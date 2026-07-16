# WS6 — Accessibility (WCAG 2.x AA, measured contrast)

**Reviewer workstream:** WS6 (IDs `UX6-NN`). Driven live in headless Chromium at mobile (390×844) and
desktop (1440×900) against the seeded `clean` couple, plus three disposable throwaway accounts created
for this workstream in the assigned `+19990806xxx` range (`WS6 Tester` ×2, one per viewport, taken all
the way through a **real** phone→OTP→name→relation→ETA signup; `WS6 Bare`, a name-only account used to
walk the add-prospect "About You" wizard from a genuinely empty state). OTP codes were minted directly
via `otpService.createOTPRequest` (same dev pattern as `scratch/uxa_mint_otp.js`) so the real
`/api/auth/verify` endpoint was exercised, not bypassed. Screenshots in `backend/scratch/ux_shots/`
(prefix `ux6_`). Driver/measurement scripts in `backend/scratch/ux6_*.js` (read-only; no production code
touched). Contrast is **measured**, not eyeballed: a Playwright helper (`backend/scratch/ux6_lib.js`)
reads `getComputedStyle` on the live element, walks up the DOM for the first non-transparent background,
and computes the WCAG relative-luminance contrast ratio in-page. Where the app's Tailwind v4 tokens made
Chromium serialize colors as `lab(...)` instead of `rgb(...)`, the helper runs a standard
Lab(D50)→XYZ→Bradford-D65→linear-sRGB conversion before the contrast math (validated against Tailwind's
published `slate-500` hex, ~2‑unit round-trip error) rather than falling back to guessed hex values.
Keyboard checks pressed real `Tab`/`Space`/`Enter` and read `document.activeElement`'s computed
`outline`/`box-shadow` at each stop — "no visible focus ring" claims below are computed-style facts, not
impressions.

**Note on environment:** partway through this pass, the shared frontend dev server (port 3002) went down
for several minutes (no live process, connection refused) — almost certainly load from the several other
UX-review agents driving Playwright against the same shared instance concurrently, not a WS6 action, and
outside the "don't restart" boundary; it came back on its own and every finding below was captured from
the **restored, real server**, not cached data. A couple of report-tab probes (mfr/chronic risk-badge
element selectors) didn't resolve cleanly before/after that outage; where I could not get a clean live
DOM read I fell back to computing contrast from the **literal authored values in source** (the app's own
CSS variables, or Tailwind's own published token hex) rather than guessing, and I've marked those specific
sub-claims "Code-verified" rather than "Observed" so the two evidence tiers are never blurred.

**Governing rule honoured:** mobile is the locked design reference; a11y issues present on both viewports
count regardless, and no fix below proposes changing mobile visuals to match desktop.

**Surfaces mapped**
- Login/OTP + inline new-user signup: `frontend/src/app/login/page.js`, shared step shell
  `frontend/src/components/wizard/QuestionScreen.js`.
- Onboarding (same steps, standalone route): `frontend/src/app/onboarding/page.js`.
- Add-prospect "About You" multi-step form: `frontend/src/app/add-prospect/page.js` +
  `frontend/src/components/wizard/{ChoiceList,CityInput,MeasurementSlider}.js`.
- Report tab shell + tabs: `frontend/src/app/core-engine/layout.js`, `story/page.js`, `chronic/page.js`,
  `mfr/page.js`, `usg/page.js` + `frontend/src/components/usg/OrganStatusGrid.jsx`.
- Global nav: `frontend/src/components/MobileBottomNav.js`; chat drawer:
  `frontend/src/components/ReportChatDrawer.{js,module.css}`.
- Cross-ref only, not re-diagnosed: WS4 visual-system findings (`review/ux_WS4_visual.md`, esp. UX4-01/02
  token fragmentation) explain *why* some report-surface text renders in a different color family than the
  app's own `--muted`/`--teal`/`--pink` tokens — cited below only where it changes a measured ratio.

---

## Lead summary (highest-stakes first)

- **Every text/date/range field in login, OTP, onboarding, and add-prospect has zero visible keyboard
  focus indicator** (UX6-01) — measured `outline-style: none` at focus, no replacement, on the single
  highest-stakes flow in the app (the one that gets a user into their account at all).
- **The USG "Organ Health Status" grid conveys Normal/Mild/Moderate/Severe organ health purely by the
  color of an 8px dot** next to a bare number — live-measured rgb dot colors confirm no text label is ever
  rendered (UX6-05). This is precisely the "green vs. red pill with no text difference" pattern the brief
  called out, on the report's actual highest-stakes surface.
- **The report's own chat drawer, while closed, still swallows five consecutive keyboard-Tab stops**
  off-screen before any visible control is reached (UX6-03) — to a keyboard user, focus appears to vanish
  entirely for several presses.
- **White text on the brand pink measures 4.0:1**, failing AA's 4.5:1, on both the report sidebar's active
  nav pill and the shared wizard's single "hero" call-to-action button style (UX6-07).
- Positives worth banking up front: buttons (as opposed to text fields) keep their native focus ring
  everywhere tested; the two real modals in the app (`ConfirmDialog`, the chat drawer while open) implement
  genuine focus-trap/Escape/aria-modal patterns; icon-only buttons are labeled correctly almost everywhere
  *except* the report's hamburger; and most status/error text passes AA comfortably once measured.

---

### [P0] UX6-01 — No visible keyboard focus indicator on any text/date/range/select field in login, OTP, onboarding, or add-prospect
- Flow / Screen: Login phone step (`login/page.js:352-372`), OTP step (`:430-443`), name step
  (`:382-392`), onboarding (`onboarding/page.js:85-94`), add-prospect About-You fields — gender `ChoiceList`
  is unaffected (see positives) but DOB/City (`CityInput.js:31-43`) and Height/Weight/Waist
  (`MeasurementSlider.js:93-102`, `wizard.module.css:1-7`) all fail — plus the report's shared timeline
  scrubber (`core-engine/layout.js:381-392`).
- Viewport: both (mobile + desktop identical; verified on each)
- Status: **Observed** — measured via `getComputedStyle(document.activeElement)` after real `Tab`
  key-presses. Screenshots `ux6_focus_phoneinput_mobile.png` / `ux6_focus_phoneinput_desktop.png` show the
  phone-number input focused (confirmed via `document.activeElement`) with **no visible ring, glow, or
  border change whatsoever**.
- Evidence: every one of these controls carries a literal `outline-none` (Tailwind) or `outline: none`
  (raw CSS) declaration with **no replacement focus style**: `fieldInputClass = '... outline-none ...'`
  is shared verbatim by `login/page.js:23`, `onboarding/page.js:13`, and `add-prospect/page.js:70`; the
  country-code `<select>` on the phone step carries the same class (`login/page.js:355`);
  `CityInput.js:41` uses the identical class; `MeasurementSlider`'s `wizard.module.css:7` sets
  `outline: none` unconditionally (not even scoped to `:focus`), and no `:focus`/`:focus-visible` rule
  exists anywhere in that stylesheet. Measured trace (`ux6_login_flow.js`) confirms it directly: tabbing
  onto the country select, the phone `<input>`, the OTP `<input>`, and the name `<input>` each reports
  `outlineStyle: "none", boxShadow: "none"` — while the surrounding **buttons** (Back, Paste code, Next,
  ChoiceList options) on the very same screens report `outlineStyle: "auto"` in the same trace, proving
  the browser's own default focus ring is available and would render fine if not explicitly suppressed.
  Root cause of the gap: the app's *only* focus-visible fallback is `.mshell :focus-visible { outline:2px
  solid var(--h-teal) }` (`mobile-shell.css:69`) — but login, onboarding, and the wizard steps in
  add-prospect are **not** wrapped in `.mshell` (only the mobile Account/profile hub and mobile section
  list are), so none of these screens inherit that fallback either.
- UX impact: accessibility — a keyboard-only or motor-impaired user (or anyone using a screen magnifier who
  needs the ring to relocate their cursor) filling in phone → OTP → name has **no way to see which field is
  about to receive input** at any point in the account-creation flow, and the same is true for
  date-of-birth/city/height/weight/waist immediately afterward in add-prospect. This is the literal
  "a11y barrier excluding users from a critical action" case in the severity rubric — it sits on the one
  flow every single user must complete once.
- Heuristic: WCAG 2.4.7 Focus Visible (AA); visibility of system status.
- Root cause: code — a shared input-styling class strips the native outline without ever defining a
  replacement, and the one place a replacement *does* exist (`.mshell`) doesn't cover these screens.
- Best-fit direction: promote the `.mshell :focus-visible` recipe to a single **global** rule (e.g. on
  `:root` or `body`) so every surface gets a visible ring by default, then delete the redundant
  `outline-none` from `fieldInputClass`/`CityInput`/`MeasurementSlider` (the global rule supersedes it) —
  one CSS change fixes every instance in this finding plus UX6-02 below.
- Effort: S (see OPP-UX-61) · Blast radius: every text/date/tel/number/range/select field in the app,
  since `fieldInputClass` and `wizard.module.css` are the shared primitives for all of them.

### [P1] UX6-02 — Report hamburger menu button and the shared timeline slider explicitly strip focus with no fallback, and the hamburger has no accessible name
- Flow / Screen: Mobile report top header hamburger (`core-engine/layout.js:166-171`); shared
  chronic/fertility timeline scrubber (`:381-392`).
- Viewport: mobile (hamburger only exists on mobile); slider both.
- Status: Observed — code (`className="p-1 rounded-lg hover:bg-slate-100 text-slate-600
  focus:outline-none"`, no `aria-label`, no `aria-expanded`) + measured (`ux6_focus_shots.js` tab trace on
  `/core-engine/story`).
- Evidence: the hamburger `<button>` (`<Menu>`/`<X>` icon only, toggled by `isMobileMenuOpen`) carries
  `focus:outline-none` with nothing replacing it, and has no `aria-label` or `aria-expanded` — a screen
  reader hits an unnamed, state-less "button." It is also the **only** way to reach 6 of the report's 7
  tabs on mobile (per WS2 UX2-05/06), so an AT user who can't identify or operate it loses access to most
  of the report. Separately, the shared timeline slider (`layout.js:381-392`, used on the Chronic Risk and
  Fertility Timeline tabs) has neither `aria-label` nor `aria-valuetext`, and also carries
  `focus:outline-none` with no replacement — confirmed by measurement: tabbing onto it in the add-prospect
  height-slider probe (identical unstyled-range pattern) returned `outlineStyle: "none"`. **Contrast worth
  noting**: the *story tab's own* timeline scrubber (`story/page.js:873-886`) does the opposite correctly
  — real `aria-label="Select projection checkpoint, from today to 10 years out"` and
  `aria-valuetext={... 'Today (Baseline)' : 'Year N'}` (line 880-881) — so the labeling gap is not a
  blanket product decision, just inconsistent between the two sliders (it still shares the same
  focus-visibility bug as its sibling, since it also carries `focus:outline-none`, `:882`).
- UX impact: accessibility — the report's primary mobile navigation entry point is both unlabeled for AT
  and invisible-when-focused for sighted keyboard users; the un-labeled slider means a screen-reader user
  hears a bare "slider" with a raw 0-4 index value instead of "Year 3" / "Today (Baseline)".
- Heuristic: WCAG 4.1.2 Name, Role, Value; 2.4.7 Focus Visible; 2.4.6 (informative labels).
- Root cause: code.
- Best-fit direction: add `aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}` +
  `aria-expanded={isMobileMenuOpen}` to the hamburger button; copy the story tab's `aria-label`/
  `aria-valuetext` pattern onto the shared `layout.js` slider; apply the same global focus-visible fix as
  UX6-01 to both.
- Effort: S · Blast radius: `layout.js` header + shared slider (2 tabs).

### [P1] UX6-03 — The closed report chat drawer still intercepts multiple keyboard-Tab stops, entirely off-screen
- Flow / Screen: `frontend/src/components/ReportChatDrawer.js` mounted inside every `/core-engine/*` tab;
  visibility toggled purely by CSS in `ReportChatDrawer.module.css:22-40`.
- Viewport: mobile (verified); the same CSS pattern (`transform` only, no `visibility`/`inert`) is
  viewport-independent so desktop is at equal risk, not separately re-verified.
- Status: Observed — measured tab trace (`ux6_focus_shots.js`) landing on `/core-engine/story` (mobile,
  390px viewport) and pressing `Tab` repeatedly from a fresh route load.
- Evidence: the **first five** Tab presses on the report all land on elements belonging to the *closed*
  `ReportChatDrawer` — four `suggestionChip` buttons ("Explain my glycemic risk simply", etc.) then the
  chat `<input>` — each measured at `rectX: 406-410` while the mobile viewport is **390px wide**
  (`onScreen: false` on every one), before Tab #6 finally reaches the visible bottom-nav "Home" button.
  Root cause is precise: `.drawer` (closed state, `ReportChatDrawer.module.css:22-36`) hides the panel with
  **only** `transform: translateX(100%)` — there is no `visibility: hidden`, no `display: none`, and no
  `aria-hidden`/`inert` toggling anywhere in `ReportChatDrawer.js` — so its interactive children stay fully
  in the tab order and keep `outlineStyle: "auto"` (would even show a focus ring, just off-screen and
  invisible) while the chat `<input>` itself additionally measures `outlineStyle: "none"` (same
  `fieldInputClass`-style gap as UX6-01). The component's own Tab-trap logic (`ReportChatDrawer.js:83-114`)
  is real and correctly implemented, but is gated on `isOpen` — it does nothing to remove the closed
  drawer from the ambient tab order.
- UX impact: accessibility + orientation — a sighted keyboard-only user tabbing through the report hits
  five phantom stops with literally nothing visible reacting on screen, indistinguishable from "focus is
  broken," before reaching real navigation.
- Heuristic: WCAG 2.4.3 Focus Order; 2.1.2-adjacent (content hidden only visually remains operable, which
  here works against the user rather than for them).
- Root cause: code — closed state is CSS-only (`transform`), not removed from the accessibility tree.
- Best-fit direction: toggle `aria-hidden="true"` and set every focusable descendant's `tabIndex={-1}` (or
  use the `inert` attribute on the drawer root) when `!isOpen`, in addition to the existing transform.
- Effort: S · Blast radius: `ReportChatDrawer` only (single shared component, mounted on every report tab).

### [P1] UX6-04 — Systemic missing programmatic label association across every wizard field, plus a near-miss in Profile
- Flow / Screen: Login phone/OTP/name (`login/page.js:352-392,430-443`), onboarding (`onboarding/page.js:
  85-94`), add-prospect gender/DOB/city/height/weight/waist (`add-prospect/page.js` via `ChoiceList.js:22`,
  native `<input type="date">`, `CityInput.js:31-43`, `MeasurementSlider.js:93-102`); related near-miss in
  `profile/page.js:70-77` (mobile branch `:223-237`, desktop branch `:308-335`).
- Viewport: both.
- Status: Observed — measured via an in-page label audit (`auditLabels` in `ux6_lib.js`: checks
  `label[for]`, wrapping `<label>`, `aria-label`, `aria-labelledby` — placeholder text does **not**
  count) run at every step of both the login/onboarding flow and the add-prospect About-You wizard.
  Every single field tested (country select, phone, OTP, name, DOB, city, height/weight/waist sliders)
  returned `hasProgrammaticLabel: false`.
- Evidence: all of these fields rely solely on (a) `placeholder` text, which disappears the moment a user
  types and is not a substitute for a label per WCAG 3.3.2, and/or (b) a nearby `<h2>` question title
  (`QuestionScreen.js:141`) that has no `id` and is never wired via `aria-labelledby` to the field below it.
  `ChoiceList`'s `role="radiogroup"` wrapper (`ChoiceList.js:22`) likewise carries no `aria-label`, so even
  the *group* (e.g. "What's your gender?") has no accessible name independent of the on-screen heading — a
  screen-reader user entering the group hears only "radio group," not what it's asking. Separately, and
  worth flagging as a different failure mode: `profile/page.js`'s `Field` helper (`:70-77`) **does** render
  a real `<label>` element with visible text — but never pairs it via `htmlFor`/`id`, nor wraps the input —
  so despite looking correct in the DOM inspector, it is exactly as unassociated as the wizard's
  placeholder-only fields, in **both** the mobile inline-edit branch (`:223-237`) and the desktop "Personal
  Details" branch (`:308-335`).
- UX impact: accessibility — screen readers do fall back to `placeholder` as a weak accessible name where
  nothing else exists (so these fields are not silent), but that name vanishes from a sighted user's view
  the instant they start typing, and doesn't exist at all as a *group* name for the ChoiceList questions —
  a real comprehension/verification gap for anyone re-checking what they're editing, on the very form used
  to enter a phone number, a verification code, and a legal name.
- Heuristic: WCAG 1.3.1 Info and Relationships; 3.3.2 Labels or Instructions; 4.1.2 Name, Role, Value.
- Root cause: code — shared field/`Field`/`ChoiceList` primitives never generate or accept an `id`/`for`
  pair or a group `aria-label`.
- Best-fit direction: give `fieldInputClass` consumers (and `Field`) an auto-generated `id` wired to a real
  `<label htmlFor>` (visually can stay exactly as-is — a small caption above the field, matching current
  design — this is a wiring fix, not a redesign); add an `aria-label` prop to `ChoiceList` sourced from the
  step's own question title.
- Effort: M (touches a shared primitive, but mechanically the same change repeated) · Blast radius: every
  form field in login/onboarding/add-prospect/profile.

### [P1] UX6-05 — USG "Organ Health Status" conveys Normal/Mild/Moderate/Severe purely by the color of an 8px dot
- Flow / Screen: Report → Organ Wellness tab → `usg/page.js:454` mounts
  `components/usg/OrganStatusGrid.jsx:13-19` (`getStatusColor`) and `:33-58` (render).
- Viewport: both (component has no viewport branching).
- Status: Observed — live-triggered via the page's own "Trigger Mock Report" dev affordance
  (`usg/page.js:311-316`, real API call to `/api/radiology/report`) on the `clean` couple, then measured
  directly: `ux6_report_usg_after_mobile.png` + a computed-style scan of every small circular `<div>` on
  the page.
- Evidence: each organ row renders one plain number (e.g. `100`, `80`, or `N/A`) next to an **8×8px circle**
  whose `background-color` is the *only* thing indicating severity. Measured live: a row scoring 100
  renders the dot at `rgb(16, 185, 129)` (`--color-normal`); a row scoring 80 (Kidneys, in the `clean`
  couple's triggered data) renders `rgb(245, 158, 11)` (`--color-mild`) — a materially different clinical
  bucket from the 100 rows — and an untested partner's column renders `rgb(107, 114, 128)`
  (`--color-not-assessed`, a third, similarly desaturated gray). At no point does the UI render the word
  "Normal," "Mild," "Not assessed," or any icon shape difference — the number alone doesn't communicate the
  qualitative bucket either, since the 85/70/50 thresholds (`OrganStatusGrid.jsx:14-18`) aren't shown
  anywhere on screen. A colorblind user, or anyone viewing in grayscale/high-contrast mode, cannot tell
  "Kidneys: 80" apart from "Bladder: 100" — i.e. cannot tell a flagged organ from a clean one.
- UX impact: accessibility + comprehension of a **sensitive medical result** — this is the exact "color pill
  with no text/icon difference" failure mode named in the brief, and it sits on the report's own organ-risk
  summary, the highest-stakes surface in the product per the brief's framing.
- Heuristic: WCAG 1.4.1 Use of Color.
- Root cause: code — `getStatusColor` returns a bare CSS color with no accompanying label prop.
- Best-fit direction: add a short text label (or a Lucide check/triangle/x icon swapped by band) next to
  each dot — "Normal" / "Mild" / "Moderate" / "Severe" / "Not assessed" — reusing the qualitative names
  `getStatusColor`'s thresholds already imply.
- Effort: S · Blast radius: `OrganStatusGrid.jsx` only (single shared component for both partners' organ
  rows).

### [P2] UX6-06 — Active nav-tab state is never exposed to assistive tech, and the bottom nav's sighted cue is functionally color-only
- Flow / Screen: Bottom nav (`MobileBottomNav.js:181-209`, active styling `mobile-shell.css:343-346`);
  report sidebar + mobile drawer (`core-engine/layout.js:200-216`, `:268-285`).
- Viewport: both (bottom nav mobile-only; sidebar desktop, drawer mobile).
- Status: Observed — code (no `aria-current` anywhere `isActive`/`.on` classes are applied) +
  screenshots already on file from prior WS2 driving (`ux_dash_clean_mobile.png` etc. — same nav, no new
  shots needed for this code-level fact).
- Evidence: none of the three nav implementations ever set `aria-current="page"` (or any
  `aria-current` value) on the active item — only a CSS class toggle (`.on` / conditional `bg-(--pink)`).
  For the **bottom nav** specifically, the sighted cue for "active" is `.mnav .tab.on { color: var(--h-mag)
  }` (`mobile-shell.css:345`) plus a 1px `translateY` nudge on the icon (`:346`) — a hue change and a
  barely-perceptible shift, with the icon itself unchanged (Lucide-style stroke icons, `stroke: currentColor`
  either way) and no underline/weight/fill difference. The report sidebar/drawer's active state
  (`bg-(--pink) text-white` vs. plain text) is a stronger, non-color-only cue (a filled pill vs. plain
  text) — flagged only for the missing `aria-current`, not as color-only.
- UX impact: accessibility + orientation — a screen-reader user tabbing the bottom nav or sidebar cannot
  tell which destination is the current one; a low-vision or colorblind user relying on the bottom nav's
  hue-only cue has a materially harder time telling "Home" from "Analysis" as active.
- Heuristic: WCAG 1.4.1 Use of Color (bottom nav); 4.1.2 Name, Role, Value (all three navs, missing state).
- Root cause: code.
- Best-fit direction: add `aria-current={isActive ? 'page' : undefined}` to all three; for the bottom nav
  specifically, pair the color change with a weight/fill change (e.g. switch the icon from outline to a
  filled variant, matching the report sidebar's stronger pill pattern) so the active tab reads without
  color.
- Effort: S · Blast radius: `MobileBottomNav.js`, `core-engine/layout.js` (2 nav instances).

### [P2] UX6-07 — White-on-brand-pink text measures 4.0:1, failing AA, on the sidebar's active pill and the wizard's one "hero" CTA style
- Flow / Screen: Report sidebar active nav item ("Partner Sync," `core-engine/layout.js:206-209`); shared
  wizard CTA button when `nextVariant === 'pink'` (`QuestionScreen.js:46-49,172-176` — used for the single
  "one true final/hero action" per step, e.g. the "Let's go" button ending onboarding).
- Viewport: both.
- Status: Observed — measured directly (`getComputedStyle`, plain `rgb()`, no color-space conversion
  needed): active sidebar item = `color: rgb(255,255,255)` on `background-color: rgb(222,69,125)`
  (`var(--pink)` / `#DE457D`, exact match) → **contrast ratio 4.0:1**, fontSize 12px/700 weight (not "large
  text" under WCAG's 14pt-bold/18pt threshold, so the required minimum is 4.5:1, not 3:1).
  `ux6_report_story_desktop.png` shows the pill in context.
- Evidence: `#DE457D` (the app's `--pink` token, `globals.css:31`) is simply too light a hue to clear 4.5:1
  against pure white text at any weight — this isn't a one-off styling mistake but the token itself,
  reused as the wizard's one designated "hero" CTA background (`QuestionScreen.js:46`) with the same
  white-text treatment.
- UX impact: accessibility — text is legible to most sighted users but fails the AA minimum a low-vision
  user is entitled to rely on, on both a persistent nav indicator and the app's single highest-emphasis
  button style.
- Heuristic: WCAG 1.4.3 Contrast (Minimum).
- Root cause: design/code — the brand pink token itself, at 12-14px white-on-fill, undershoots AA.
- Best-fit direction: darken the fill for text-bearing white-on-pink uses only (e.g. the mshell system's
  own darker magenta, `--mag-700:#8E1049` per WS4's UX4-01, already measured elsewhere in the app) rather
  than changing the brand hue globally; alternatively keep `#DE457D` but drop to a darker/bolder text
  treatment only where it's a small pill, not the full CTA.
- Effort: S · Blast radius: `QuestionScreen`'s pink-variant button (used in every wizard) + report sidebar
  active state.

### [P2] UX6-08 — Biomarker/thread status severity is color-coded with the text label reachable only via a hover-only `title`
- Flow / Screen: Chronic tab flagged-biomarker dots (`chronic/page.js:247-249`, `SEV` defined in
  `CompatibilityContext.js:16-20`); related, smaller note on the story tab's thread-badge icon swatch
  (`story/page.js:531-544` `getThreadBadgeStyle`, rendered `:1054`).
- Viewport: both.
- Status: Observed (chronic dot, code + `ux6_report_chronic_*.png` context) / Code-verified (icon-swatch
  contrast ratio, computed from the literal authored Tailwind values since the live selector for this
  specific sub-element wasn't reliably isolated after the mid-session frontend outage).
- Evidence: each flagged biomarker row renders a bare `<span className="w-2 h-2 rounded-full
  {SEV[row.f]?.dot}" title={SEV[row.f]?.lab} />` (`chronic/page.js:248`) — a 2×2 unit (≈8px) colored dot
  whose only textual equivalent ("Normal"/"Borderline"/"High") lives in a native `title` attribute on a
  plain `<span>` with no ARIA role. `title` tooltips don't appear on touch (the app's primary, locked
  reference viewport is mobile) and aren't reliably exposed to screen readers on an unstyled `<span>` —
  functionally, mobile and AT users get color only, same failure mode as UX6-05, just smaller-radius.
  Separately (lower severity): the story tab's thread badges do the right thing for their *primary* signal
  — the actual state word ("Resolved"/"Steady watch"/"Needs attention") is real on-page text in a neutral
  slate color that measures a healthy 4.77:1 (see positives) — but the small icon swatch next to it
  (`bg-emerald-50 text-[#10b981]`, `story/page.js:534`) computes to only **2.41:1** against its own
  background using the literal hex values in source (`#ECFDF5`/`#10B981`, Tailwind's published
  `emerald-50`/`emerald-500`), failing even WCAG 1.4.11's lower 3:1 bar for meaningful non-text graphics —
  though since the adjacent text label is the actual signal-of-record here, this is a minor polish item,
  not a comprehension blocker like the chronic dot.
- UX impact: accessibility — the chronic dot is a real color-only signal on mobile (the locked reference
  viewport) for a clinical biomarker flag; the badge-icon contrast is a smaller, cosmetic-tier gap.
- Heuristic: WCAG 1.4.1 Use of Color (dot); 1.4.11 Non-text Contrast (icon swatch).
- Root cause: code.
- Best-fit direction: render `SEV[row.f]?.lab` as a small visible text chip next to the dot (mirroring how
  the chronic tab's own risk-band `Chip` component already does this correctly elsewhere, per the
  positives below) rather than only in `title`; low-priority, bump the icon-swatch's icon color one step
  darker if convenient.
- Effort: S · Blast radius: chronic biomarker table only.

### [P3] UX6-09 — ChoiceList's `role="radio"` options are keyboard-operable but deviate from the standard radiogroup pattern
- Flow / Screen: Every `ChoiceList` usage (gender, relation, marriage timeline, meeting source, etc.),
  `frontend/src/components/wizard/ChoiceList.js:16-67`.
- Viewport: both.
- Status: Observed — measured keyboard trace (`ux6_login_flow.js`): tabbing through the "relation" step
  landed sequentially on each option as an **independent Tab stop**, and `Space` correctly toggled
  `aria-checked` on whichever option currently had focus (confirmed: `ux6_onboarding_relation_selected_
  mobile.png`).
- Evidence: each option is a separate focusable `<button role="radio">`; real radiogroups (per the ARIA
  Authoring Practices) expect **one** Tab stop into the group, with Arrow keys moving selection among
  options (roving `tabindex`). Here, a screen-reader or keyboard user must Tab past every single option
  one at a time (5 stops for the "relation" question) rather than Tab once and Arrow through — functional,
  just slower and not the pattern AT users are trained to expect from an announced "radio group."
- UX impact: friction, not a blocker — the control is fully operable, just non-idiomatic.
- Heuristic: ARIA Authoring Practices — Radio Group pattern.
- Root cause: code — no `onKeyDown` arrow-key handler or roving `tabIndex` in `ChoiceList`.
- Best-fit direction: add Up/Down (or Left/Right) arrow handling that moves focus + selection together,
  with only the selected (or first) option in the Tab sequence — standard roving-tabindex recipe.
- Effort: S · Blast radius: `ChoiceList.js` only (single shared component, every usage inherits the fix).

---

## What's already right (measured, not assumed)

- **Buttons keep their native focus ring everywhere tested** — the defect in UX6-01 is narrowly confined to
  text/date/range/select-style fields (all sharing `fieldInputClass`/`wizard.module.css`'s `outline-none`);
  Back/Next/Skip buttons, `ChoiceList` options, and `MeasurementSlider`'s unit-toggle buttons all measured
  `outlineStyle: "auto"` at focus, in the *same* trace runs that caught the field failures — the browser
  default is available and simply isn't being suppressed for these.
- **Real modal a11y exists in two places**: `ConfirmDialog` (`aria-labelledby`) and `ReportChatDrawer` while
  *open* (`aria-label` on the panel, `aria-modal` implied via the same drawer pattern, Escape-to-close,
  auto-focus onto the close button, and a genuine Tab focus-trap loop, `ReportChatDrawer.js:83-114`) — the
  team clearly knows this pattern; UX6-03 is only about the drawer's *closed*-state DOM presence, not its
  open-state behavior, which is solid.
- **Icon-only buttons are labeled correctly almost everywhere** — `NotificationBell` (`aria-label`
  reflecting live unread count), bottom-nav's Chat FAB (`aria-label="Chat with AI assistant"`), the
  disabled Analysis tab (`aria-label="Analysis — locked until your first compatibility check is complete"`,
  deliberately kept a real, non-`aria-disabled` button per its own code comment), `ConfirmDialog`'s close
  button, `ReportChatDrawer`'s close/send buttons, Profile's back button (`aria-label="Back to dashboard"`),
  and the mobile home's avatar/plus buttons (`aria-label="Open profile"` / `"Start a compatibility check"`)
  all carry proper accessible names. The report hamburger (UX6-02) is the one real gap found.
- **Images have real alt text** — the logo (`alt="SlayHealth"`), decorative hero fill images
  (`alt=""`, correctly marking them non-content), and content hero images (`alt={img.alt}`) all follow
  correct practice; no missing-alt defects found anywhere in the app.
- **Most status/error text passes AA comfortably once measured**: the OTP wrong-code error banner measured
  **5.65:1**; the OTP subtitle/resend-hint text measured **5.63:1**; the story tab's thread-state label
  ("Resolved" etc.) measured **4.77:1**; the report header's quota strip ("Free Plan Active…") measured
  **4.55:1**; and the standard risk-chip family used across chronic/mfr/usg (`emerald-700`/`amber-700`/
  `rose-700` text on their respective `-50` backgrounds) computes to **4.84–5.72:1** using Tailwind's own
  published token values. None of these needed a second look once actually measured.
- **The story tab's own timeline slider is properly labeled** (`aria-label` + dynamic `aria-valuetext`,
  `story/page.js:880-881`) — a genuinely good pattern, undercut only by sharing the same
  `focus:outline-none` gap as its sibling slider (see UX6-02).
- **`ChoiceList`'s persistent radio-style indicator (empty ring vs. filled dot) is a real, non-color shape
  cue**, not just a hue change — a user who can't perceive the pink hue can still see "hollow" vs. "solid"
  on every option, so option *selection* itself (as opposed to nav *active-state*, UX6-06) is not a
  color-only signal.

---

## Opportunities (WS6)

- **OPP-UX-61 ★** (fixes UX6-01, UX6-02's focus half): promote the `.mshell :focus-visible` recipe
  (`outline: 2px solid var(--h-teal); outline-offset: 2px`) to a single global rule, then delete the
  now-redundant `outline-none`/`focus:outline-none` overrides in `fieldInputClass`, `CityInput`,
  `MeasurementSlider`, the hamburger button, and both timeline sliders. Benefit: every keyboard user gets a
  visible ring everywhere, in one CSS change. Effort S. Impact: high (root-causes the single biggest a11y
  gap found).
- **OPP-UX-62** (fixes UX6-04): a shared accessible field wrapper — auto-generated `id` wired to a real
  `<label htmlFor>` (visual design unchanged), plus an `aria-label` prop threaded onto `ChoiceList`'s
  `radiogroup` — adopted by login/onboarding/add-prospect/profile instead of each hand-rolling
  `fieldInputClass`/`Field`. Effort M. Impact: high (closes the label gap everywhere it currently exists,
  and prevents it recurring on the next new form).
- **OPP-UX-63** (fixes UX6-05, UX6-08): a shared status-dot/badge primitive that renders color **and** a
  short text label (or distinct icon) by default, retrofitted onto `OrganStatusGrid` and the chronic `SEV`
  dots. Effort S–M. Impact: medium-high (protects the report's actual risk indicators, the highest-stakes
  text in the app per the brief).
- **OPP-UX-64** (fixes UX6-03): toggle `aria-hidden`/`inert` (or unmount) on `ReportChatDrawer` while
  closed, not just `transform` it off-screen. Effort S. Impact: medium (removes an invisible keyboard trap
  on every report tab).
- **OPP-UX-65** (fixes UX6-06): add `aria-current` wherever an active-nav class is toggled (bottom nav,
  sidebar, drawer) — small, mechanical, and immediately gives every nav a real "current page" signal to AT.
  Effort S. Impact: medium.

---

## Screenshot index (`backend/scratch/ux_shots/`, prefix `ux6_`)
- `ux6_login_phone_mobile/desktop.png`, `..._filled_...` — phone step (UX6-01, UX6-04)
- `ux6_focus_phoneinput_mobile/desktop.png` — phone input focused via real Tab, zero visible ring (UX6-01)
- `ux6_login_otp_mobile/desktop.png`, `..._error_...` — OTP step + wrong-code error banner (UX6-01,
  positives contrast)
- `ux6_onboarding_name_/relation_/relation_selected_/eta_/splash_or_dash_mobile/desktop.png` — new-user
  signup steps (UX6-01, UX6-04, UX6-09)
- `ux6_addprospect_hub_mobile/desktop.png`, `..._about_step0..6_mobile/desktop.png` — About-You wizard from
  a genuinely empty account (UX6-01, UX6-04)
- `ux6_slider_step_mobile.png` — height `MeasurementSlider` focused, zero visible ring (UX6-01)
- `ux6_report_story_mobile/desktop.png` — thread badges + sidebar active pill (UX6-06, UX6-07, UX6-08)
- `ux6_report_chronic_mobile/desktop.png` — flagged-biomarker dots (UX6-08)
- `ux6_report_mfr_mobile/desktop.png` — fertility-timeline risk badge context
- `ux6_report_usg_after_mobile.png` — Organ Health Status grid with mock data triggered, colour-only dots
  (UX6-05)
- `ux6_focus_hamburger_mobile.png` — tab trace landing inside the closed chat drawer (UX6-02, UX6-03)
