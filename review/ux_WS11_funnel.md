# WS11 — Friction & Drop-off Inventory (Funnel Synthesis)

**Reviewer workstream:** WS11 (synthesis; no new finding IDs minted). **Method:** this workstream did not
re-drive the app as its primary method — it read all 11 completed workstream files
(`review/ux_WS1_flows.md` … `review/ux_WS10_perf.md`, `review/ux_WS12_ideation.md`) and the master spine
(`SLAYHEALTH_UX_REVIEW.md`, `review/_ux_schema.md`) in full, then re-assembled every friction/drop-off
signal along the actual user funnel: landing → signup/OTP → onboarding → dashboard first-run →
add-prospect/invite → upload → wait/processing → report reveal → return visit → account management.
Four load-bearing cross-workstream claims that this synthesis's headline convergences depend on were
spot-checked directly against the live source tree before writing (not re-driven in a browser, since the
underlying live evidence was already gathered by the cited workstreams): `frontend/src/app/login/page.js`
(unguarded `res.json()` at lines 196, 221, 244), `frontend/src/app/invite/[token]/page.js` (same pattern
at 89, 92, 237), `frontend/src/components/wizard/AnalysisLoadingScreen.js:8` (`STEP_INTERVAL_MS = 1400`),
`backend/src/services/compatibility/reportSummary.service.js:354` (`coupleStatus = 'Excellent'` default
for any non-null score), and `frontend/src/app/dashboard/page.js:384` (the dead "Contact Support" button
independently caught by both WS7 and WS9). All five confirmed exactly as cited. No production code was
read for any other purpose and none was modified.

Every finding below is attributed to its origin workstream by ID; nothing here is a new, independently
observed defect — this document's only original content is the funnel framing, the severity-weighted
per-stage risk call, the convergence analysis, and the compounding-path/systemic-pattern sections.

---

## Quick-reference: risk by funnel stage

| # | Stage | Overall drop-off risk | Primary driver |
|---|---|---|---|
| 1 | Landing | Low–Moderate | Chrome bleed for returning users (UX1-07); one unfixed trust badge (UX8-08) |
| 2 | Signup / OTP | **Critical** | Raw JS parse-exception at the one mandatory gate, ~1-in-3 repro (UX1-01, convergence #1) |
| 3 | Onboarding (name/relation/eta) | Moderate | Duplicated, drifted implementation (UX1-03, convergence #6); no focus/labels (UX6-01/04) |
| 4 | Dashboard first-run | Moderate | No guidance for a blank state; invite-in-flight looks identical to never-started (UX7-06) |
| 5 | Add-prospect / invite | **Critical** | Zero-consent self-entry path (UX8-01); dead invite link (UX8-05); false privacy promise (UX8-02) |
| 6 | Upload | High | Generic error masks real cause after a long silent wait; no size guard (UX7-02, UX10-02) |
| 7 | Wait / processing | High | Real ~53s wait vs. an 8s fake-progress animation that freezes (convergence #2) |
| 8 | Report reveal | **Critical** | The couple's most severe, most sensitive finding never surfaces on the surface they're looking at (UX3-01); PDF self-contradicts (convergence #3) |
| 9 | Return visit | Low | Core path is solid (UX1-10); two known regressions (UX2-09, UX7-06) |
| 10 | Account management | Moderate | Dead "Privacy & data" row (UX8-07); desktop profile is a different, undecorated product (UX4-09) |

"Critical" stages are where a P0 (blocks a core flow / erodes trust in a health context / a11y barrier)
sits directly on the only path through that stage, not merely nearby.

---

## Cross-workstream convergences (high confidence)

Per the brief: where 2+ workstreams, working independently and through different lenses, landed on the
same or clearly related underlying defect, that convergence is treated as materially higher-confidence
evidence than any one workstream's finding alone — the bug reproduced under different methodologies,
different seeded accounts, and different review questions, and still came out the same. Eight such
convergences were found across the 11 workstreams; the first three recur throughout the funnel below and
are the headline evidence of this synthesis.

**1. Raw JavaScript parse-exception shown verbatim to the user on any non-JSON error response.**
Independently found by **WS1** (journey-mapping lens, `UX1-01`, reproduced live on OTP-verify at ~1-in-3
rate), **WS7** (states/error-UX lens, `UX7-01`, reproduced on both the login rate-limiter and the invite
page, explicitly identified as "the same missing guard... repeated across at least 4 call sites"), and
**WS8** (trust/consent lens, `UX8-09`, reproduced on the invite page and traced through to a real database
consequence). Three workstreams, three different investigative questions, same root cause: `login/page.js`
has three unguarded `res.json()` calls (196, 221, 244) and `invite/[token]/page.js` has three more (89, 92,
237) — six-plus call sites confirmed live in source. WS7 additionally notes the fix pattern
(`CompatibilityContext.js:534-536`'s `responseJson()`) already exists in the codebase and simply isn't
reused. **This is the single highest-confidence finding in the entire review series.**

**2. The match-generation "wait" screen is fake progress dressed as real progress, and the real wait is
long.** Independently found by **WS1** (`UX1-06`, code-only — the frontend outage during that pass
prevented a live timed capture, but the mechanism was fully traced from source), **WS7** (`UX7-03`, live
end-to-end timed run: screenshots at t=0.5/1.5/3/5/8/11/15/20s show the UI frozen, byte-identical, from
8s to past 20s while real work continues), and **WS10** (`UX10-01`, the most precise measurement — a
direct authenticated call to `POST /api/compatibility/save-match` took **53,234ms**, reproduced twice, while
`AnalysisLoadingScreen.js`'s own 6-step animation completes and freezes at **8.4 seconds** flat,
`STEP_INTERVAL_MS = 1400` confirmed in source). Escalating evidence quality across three workstreams (code
trace → live timed screenshots → precise direct-API measurement) all agree: for roughly 45 of the wait's
~53 seconds, the screen has already told a "just formatting" story that stopped being true.

**3. The downloadable PDF's overall status/synthesis text is hardcoded to sound reassuring regardless of
severity.** Independently found by **WS3** (report-comprehension/emotional-design lens, `UX3-02`/`UX3-03`
— the `severe` seeded couple's PDF cover reads "42 / Excellent" and page 6 labels a confirmed both-carrier
genetic finding "Genetic Trait Check Complete · STRONG") and **WS9** (copy/tone lens, `UX9-01`/`UX9-02` —
same couple, same PDF, describing the identical bug as "'Excellent' / 'very encouraging' / 'Nothing here
should give you pause'" at a score of 42/100, plus a raw-status-code disclosure "Male status is RED |
Female is RED"). Both trace to the same code: `reportSummary.service.js:354` — `coupleStatus =
coupleScore !== null ? 'Excellent' : 'Pending'`, confirmed live in source, only escalated away from
"Excellent" by two of the five scored domains, never by radiology or genetic carrier-pair severity. Two
workstreams, two different review questions (does the reader understand this? / is the tone honest?), one
answer: the artifact couples are most likely to save, print, or show a doctor is **less honest than the
live web report for the identical match.**

**4. Reloading the invited-partner's page after submission re-shows the original consent gate, and
rejecting there produces a false "nothing was collected" claim.** Independently found by **WS7**
(states/feedback lens, `UX7-05` — the reload wipes the "Details Submitted!" confirmation) and **WS8**
(trust/consent lens, `UX8-03` — the same reload/re-consent bug, additionally verified directly against
Postgres: the pathology report and full profile remain in the database, untouched, while the UI tells the
user "SlayHealth will not collect your health details"). WS7 itself flags this cross-reference
("Likely relevant to WS8... from the consent-durability angle as well as here"). WS8's independent,
DB-level verification upgrades this from "a state-loss bug" to "a **false confirmation of data erasure that
never happened**" — arguably the single worst individual finding in the whole review series once the two
lenses are combined.

**5. Session/silent-refresh races strand users on the wrong screen after an interruption.** Independently
found by **WS1** (`UX1-02` — abandoning mid-signup between OTP success and finishing name/relation/eta
silently strands the user on a blank phone-entry screen even though the session secretly recovered),
**WS2** (`UX2-09` — refreshing inside the report drops an authenticated user onto the public marketing
landing page), and corroborated as a recurring anomaly (not independently filed, but observed) by **WS5**'s
methodology note (a `severe`/mobile dashboard load and a radiology/mental deep-link both unexpectedly
bounced to `/` mid-session). Three workstreams hit the same underlying class — the app's own state
genuinely recovers in the background but the UI never re-checks and shows a false "you're logged out" or
"start over" state instead.

**6. The three-question "collect your name" step is implemented twice, and the duplication has already
visibly drifted.** Independently found by **WS1** (`UX1-03` — the structural finding: `login/page.js`'s
inline wizard and the standalone `onboarding/page.js` are hand-duplicated, different step counts, one ends
in a splash and one doesn't) and **WS9** (`UX9-07` — live proof the duplication has already decayed: the
name question renders with a curly apostrophe (`login/page.js:377`) in one file and a straight ASCII
apostrophe (`onboarding/page.js:82`) in the other). WS1 found the risk; WS9 independently found the
predicted consequence already manifesting — a rare case in this review series of one workstream's finding
being empirically confirmed by another's unrelated pass.

**7. The exact same dead "Contact Support" dashboard button was filed twice, by two workstreams that never
cross-referenced each other.** **WS7** (`UX7-10`) and **WS9** (`UX9-08`) both independently found
`frontend/src/app/dashboard/page.js`'s "Contact Support" button (`:383-385` per WS7, `:378-385` per WS9 —
same button, confirmed at `:384` in source) has no `onClick` handler at all. Neither finding mentions the
other. This is weaker evidence about the bug itself (both already knew the pattern from WS2-02's
report-sidebar Support button) but strong evidence of how conspicuous the gap is — two reviewers, working
independently through entirely different lenses (error-states vs. copy/tone), landed on the identical
15-line button without prompting.

**8. No reliable, accessible signal exists anywhere in the app for "this is the serious finding."**
Independently found by **WS3** (comprehension/hierarchy lens, `UX3-04` — the single most severe finding in
the whole report, a confirmed both-carrier genetic result, is styled with the exact same amber badge as a
routine "steady watch" caution, collapsed by default) and **WS6** (accessibility lens, `UX6-05` — the organ
health grid conveys Normal/Mild/Moderate/Severe purely by the color of an 8px dot with no text label at
all; `UX6-06` — active-nav-state and `UX6-08` — biomarker flags share the same color-only pattern). Two
different audits (visual hierarchy vs. WCAG 1.4.1 Use of Color) converge on one conclusion: severity
communication in this product is not just under-designed in one place, it structurally has no consistent,
non-color channel anywhere on the report's highest-stakes surfaces.

---

## Funnel-stage-by-stage friction inventory

### Stage 1 — Landing (pre-auth marketing page)
**Risk: Low–Moderate.** No P0s land here; nothing blocks entry.
- `UX1-07` (P2) — the mobile bottom nav (with its Chat-AI FAB) renders on top of the public marketing page
  for returning authenticated users, covering the last trust badge — the one page meant to read as
  "outside" the app looks like an in-app screen with chrome stacked on it.
- `UX8-08` (P1) — a "Doctor Verified / All reports reviewed by MDs" badge (`TrustSignals.js:7`) is still
  live on both viewports today, an unsubstantiated clinical-authority claim sitting directly beside the
  correctly-fixed "Evidence-Based" sibling badge in the same file, under the "Why Couples Trust
  SlayHealth" heading.
- `UX10-09` (positive) — first paint is genuinely fast (LCP 172–184ms, CLS 0).
**Biggest single reason a user would abandon here:** none reliably — this stage is not where the funnel
leaks. The one live trust-integrity issue (UX8-08) matters less for drop-off than for a user who *does*
proceed then later discovers the claim doesn't hold up (compounds with the DPDP/consent findings at
Stage 5/8, not a Stage-1 abandonment driver on its own).

### Stage 2 — Signup / OTP verification
**Risk: Critical.** This is the one mandatory gate every user must pass, and it carries this review
series' single highest-confidence P0.
- `UX1-01` / `UX7-01` / `UX8-09` (P0/P1, **convergence #1**) — a raw JS parse exception
  ("Unexpected token 'I', "Internal S"... is not valid JSON") renders verbatim as the user-facing error at
  OTP verify, reproduced live at roughly 1-in-3 in six independent attempts (`UX1-01`), and the identical
  bug class hits the same flow's rate-limiter response and the invite page (`UX7-01`, `UX8-09`).
- `UX1-02` (P0) — abandoning between OTP success and finishing name/relation/eta silently strands the user
  on a blank phone-entry screen; the session actually recovers in the background (a real refresh-token
  round trip succeeds) but nothing on screen ever says so — the user is funneled back into a full
  phone+OTP+name+relation+eta restart, new WhatsApp code included, for an account that already exists.
- `UX1-04` (P2) — reloading mid-OTP-entry (before verifying) silently discards the phone number and step.
- `UX1-09` (P3) — "1 attempts remaining" copy bug at the most anxious moment of the OTP ladder.
- `UX6-01` (P0, a11y) — zero visible keyboard focus indicator on the phone/OTP/name fields; every input
  carries `outline-none` with no `:focus-visible` fallback on this route.
- `UX6-04` (P1, a11y) — no programmatic label association on any of these fields (placeholder-only).
- `UX7-P1` / `UX10-07` (positive) — the wrong-OTP ladder is clear and honest, and the round-trip itself
  (including a real WhatsApp Cloud API call) is fast (~2.3s) with clear button-state copy.
**Biggest single reason a user would abandon here:** the raw parse-exception (convergence #1). It fires at
roughly 1-in-3 on live testing, on the one screen every user must pass, and reads unambiguously as "this
app is broken" with zero guidance to retry — in a health-data product where trust is the entire value
proposition. UX1-02 is a close second and compounds directly with it (see Path A below): a user rattled by
the parse error who reloads to "start fresh" lands in the silent-stranding trap.

### Stage 3 — Onboarding (name / relation / ETA)
**Risk: Moderate.** No drop-off blocker, but a real comprehension/consistency gap plus continuing a11y debt.
- `UX1-03` / `UX9-07` (P2, **convergence #6**) — two hand-duplicated implementations of the identical
  three-question step (`login/page.js` inline wizard vs. standalone `onboarding/page.js`), already visibly
  drifted (curly vs. straight apostrophe). The version most likely to be seen by someone who was just
  interrupted (UX1-02's exact scenario) is the flatter, less reassuring one with no splash/confirmation.
- `UX6-01` / `UX6-04` continue to apply here (no focus ring, no labels) — same shared `fieldInputClass`
  primitive as Stage 2.
- `UX6-09` (P3) — `ChoiceList`'s radio options are keyboard-operable but require Tab-per-option rather than
  the idiomatic roving-tabindex radiogroup pattern.
**Biggest single reason a user would get confused here:** the duplicated wizard (UX1-03) — a step counter
that silently lies by omission ("3/3" for a user who took 5 steps the first time through a different
entry path), landing precisely on the population most likely to already be uncertain whether they're
signing up fresh or resuming (per UX1-02).

### Stage 4 — Dashboard first-run
**Risk: Moderate.**
- `UX2-10` (positive) — the disabled "Analysis" tab state is legible, well-explained, and keyboard-reachable.
- `UX7-06` (P2) — the dashboard gives **zero** signal that an invite is pending; the "Recent" card renders
  byte-identical copy ("No compatibility checks yet — Start your first check") for a brand-new account and
  for an account with a real, live, in-flight invite tracked in detail server-side. The one partial signal
  (`NotificationBell`) is mobile-only; desktop has no fallback at all.
- `UX5-03` (P2) — desktop has no privacy/trust reassurance line at all; mobile has one on every load.
- `OPP-UX-27`/`OPP-UX-30` (WS12) — no guided first-run checklist and no "waiting on partner" card exist yet
  to address either gap.
**Biggest single reason a user would abandon/get confused here:** UX7-06. This is precisely the moment a
motivated user — someone who already invited their partner — checks back in, and the app tells them,
verbatim, "you haven't started," which is both false and demotivating for exactly the user segment closest
to converting.

### Stage 5 — Add-prospect / invite (self-fill vs. partner link)
**Risk: Critical.** This stage carries the most P0-severity trust/consent findings in the whole review, and
they sit on the path of the account holder's single core action ("invite your partner").
- `UX1-05` (P2) — "Start a compatibility check" promises "invite your partner" but instead routes into the
  self hub and asks two relationship-with-partner questions ("How did you meet?", "Relationship Status")
  before the partner has been named anywhere.
- `UX8-01` (P0) — "I'll enter their details myself" is offered at equal visual weight to the invite-link
  option and lets the account holder submit a third party's full clinical + psychological profile
  (STI markers, carrier status, 21-question mental-health survey) with **zero consent artifact of any kind**
  — no token, no accept/reject record, no notification to the prospect.
- `UX8-02` (P0) — the invited partner is repeatedly, personally told their data "stays private to the two
  of you" / "just to you and your match" (`trustMessages.js`, at least 7 instances across 5 categories) —
  demonstrably false: the partner never sees the compiled report, confirmed live.
- `UX8-05` (P0) — the literal invite link the real API hands the account holder is dead right now
  (`APP_URL` points at a stale LAN IP; nothing answers on that host:port) — this is upstream of every other
  invite finding, since if the link doesn't resolve, the partner never reaches any of the screens below.
- `UX8-04` (P1) — the mental-health section's "Skip this section" control is wired on the data object but
  never passed to the component on the invited-partner's page — the partner is forced through all 21
  questions with no way to decline, even though the identical mechanism works on the account holder's own
  equivalent flow.
- `UX8-11` (P2) — a 33-step, one-sitting questionnaire for someone who may feel social/family pressure to
  comply, compounded by UX8-04's broken skip.
- `UX5-04` (P2) — desktop's add-prospect hub has no way back to the dashboard at all (mobile has an
  explicit "‹ Dashboard" link).
- `UX1-08` (P3) — Radiology's "Locked · ₹999" hub badge doesn't gate anything once tapped through.
- `UX6-09` continues to apply (ChoiceList pattern).
**Biggest single reason a user would abandon/lose trust here:** for the account holder, UX1-05's
CTA/destination mismatch is the immediate friction; for the invited partner (the more vulnerable party in
this flow), the compounding sequence UX8-05 → UX8-02 → UX8-04/UX8-11 is categorically worse — see Path C
below. UX8-01 is arguably the single most consequential finding in the entire 12-workstream review: it is
not a UX rough edge, it is a **complete absence of consent** for the majority-sensitive half of the report,
offered as a co-equal convenience option.

### Stage 6 — Upload (pathology / radiology PDF)
**Risk: High.**
- `UX7-02` (P1) — both a transient 500 and a genuine oversized-file 500 land on the identical hardcoded
  string "Pathology extraction failed," discarding the backend's own specific, correct message
  ("File too large") every time; there is no client-side file-size check, so a 26MB file transmits for a
  measured ~20.7 seconds before failing anyway.
- `UX10-02` (P1) — no spinner, no progress, no `disabled` binding on the upload button during a wait that
  can legitimately run up to ~40 seconds worst case (10s local-extraction timeout + 30s OCR fallback); a
  user can tap "Parsing PDF…" again mid-upload and fire a duplicate request.
- `UX10-03` (P2, Suspected) — the single-threaded backend blocks synchronously on local PDF extraction
  (`execFileSync`, up to 10s), a real architectural risk that one user's slow upload stalls every other
  concurrent user's dashboard/login/chat requests.
- `UX3-05` (P1) — an unlabelled "Trigger Mock Report" debug link sits directly under the real "Upload PDF"
  button on both partners' cards, with no gate, capable of injecting fabricated clinical findings into a
  real match record.
- `UX7-P3` (positive) — wrong-file-type rejection is instant and clearly worded, proving the team knows how
  to do this well when it's checked client-side.
- `OPP-UX-03` (WS12) — PDF-only upload is a hard wall against the target audience's actual behavior
  (photographing a paper lab report).
**Biggest single reason a user would abandon here:** the compounding of UX7-02 and UX10-02 — a wait that
can run up to 40 seconds with zero progress feedback, ending (if it fails) in a generic message that
teaches the user nothing about what to do differently, after they've already spent real time and mobile
data on the upload.

### Stage 7 — Wait / processing ("Generate Insights")
**Risk: High.** This is the least-ambiguous convergence in the whole review (convergence #2 above) and,
per WS10's direct measurement, the single longest wait in the product.
- `UX1-06` / `UX7-03` / `UX10-01` (P1/P2, **convergence #2**) — the real wait measured at **53.2 seconds**
  against a fake 6-step animation that completes and freezes at **8.4 seconds**, leaving the user staring
  at a static, "almost done"-implying screen for roughly 45 additional seconds with zero further signal —
  while the copy on screen explicitly asks them not to close the tab.
- `OPP-UX-05` / `OPP-UX-72` / `OPP-UX-101` (WS7/WS10/WS12) — three independent workstreams all separately
  proposed essentially the same fix (tie steps to real promise resolution, or at minimum add a live
  elapsed-time counter), each citing the questionnaire wizard's own `estimateTime.js` "~N sec left" pattern
  as the in-house reference for how to do this honestly.
**Biggest single reason a user would abandon here:** the frozen animation itself. WS10 states it plainly —
a user closing the tab or navigating away during the ~45-second frozen window would abandon a match that,
per direct measurement, usually *does* complete successfully; this converts a purely perceived-performance
problem into a real, avoidable, and entirely preventable drop-off.

### Stage 8 — Report reveal (the compiled result)
**Risk: Critical.** This stage carries the review series' highest-stakes comprehension gap and the PDF
convergence (#3); it is where the entire two-person, sensitive-data premise of the product is either
honored or not.
- `UX3-01` (P0) — the STI safety-gate finding and the confirmed-both-carrier genetic finding are computed
  correctly on the backend and **never shown anywhere in the interactive web report**: no thread, no
  mention of "Hepatitis," "reactive," or "thalassemia" anywhere on the Story/Fertility/Chronic/Organ tabs
  for the `sti`/`severe` seeded couples. A user reads "50, Watch Synergy" with no way to learn the actual,
  named clinical reason.
- `UX9-01`/`UX9-02` / `UX3-02`/`UX3-03` (P0, **convergence #3**) — the PDF cover and closing pages
  contradict the couple's own score ("42 / Excellent"), and the actual carrier finding prints as raw
  internal status tokens ("Male status is RED | Female is RED") with no plain-language translation or
  child-risk figure, even though the app's own marketing copy explains the same concept well.
- `UX3-04` / `UX6-05`/`UX6-06`/`UX6-08` (P1, **convergence #8**) — no reliable, accessible way anywhere in
  the report to visually distinguish "this is the serious finding" from "this is routine," whether by
  color-only coding (a11y lens) or matching badge styling (comprehension lens).
- `UX2-09` (P1, part of **convergence #5**) — refreshing inside the report drops the authenticated user
  onto the public marketing landing page, i.e. it looks exactly like being logged out mid-report.
- `UX7-04` (P1) — the AI Counselor's "Retry" button doesn't retry anything (it re-fetches stored history,
  not the failed message), and the 5-message free quota is decremented **before** the LLM call runs, so a
  silent failure still costs the user one of their five chances — this matters acutely because (`UX3-07`)
  the chat is the *only* surface that actually explains the sensitive finding well, and nothing prompts a
  user to ask it the right question in the first place.
- `UX2-01`/`UX2-02`/`UX2-03`/`UX2-04`/`UX2-05`/`UX2-06` (P2, IA) — a dead-looking Genomics tab, two dead
  "Support" buttons, a nav item that silently exits the report into a form, five-plus names for the same
  artifact, and two navigation systems stacked on mobile with no signal which controls what.
- `UX9-03`/`UX9-04` (P2/P1, copy) — "Prospect" as the primary term for one's fiancé(e) even inside screens
  that otherwise say "Partner"; an internal QA/calibration panel including a button literally labelled
  "(Demo)" ships inside the paid consumer report.
- `UX9-05` (P2) — the Chronic Risk tab silently renders blank with zero message when its data can't compute.
- `UX7-09` (P2) — identical "pending domain" copy for three domains with three completely different real
  fixes (free/in-app, ₹999-gated, or opportunistic-lab-test-dependent) — a user has no way to tell which
  kind of "pending" they're looking at.
- `UX3-10` (P2) — the headline score card's loading state is gated on the wrong flag, so a completed match
  can briefly show "Complete an assessment to see your combined score."
- `UX3-13` (positive) — the AI Counselor, when reached, explains sensitive findings accurately and warmly.
**Biggest single reason a user would lose trust here:** UX3-01. The entire premise of the product is
delivering a sensitive, joint health result; the single most clinically important content the backend
computed is simply absent from the surface the couple is actually looking at, and the one artifact they're
likely to keep or share (the PDF) actively contradicts itself in its place. Everything else on this stage —
naming drift, dead nav items, color-only severity — compounds around that central gap rather than causing
it independently.

### Stage 9 — Return visit
**Risk: Low.** The core path here is a genuine, verified strength.
- `UX1-10` (positive) — silent session restore, the landing page's "Continue" shortcut, and the dashboard's
  Recent card putting a user straight back into their report all work reliably end to end, on both
  viewports, confirmed live.
- `UX2-09` (P1, **convergence #5**) — the one real regression: refreshing while already inside the report
  (as opposed to a fresh app relaunch) lands on the public landing page instead of the dashboard.
- `UX7-06` (P2) — continues to apply on return: a `partial`-status user gets no better signal on a second
  visit than a first.
**Biggest single reason a user would get confused here:** the refresh-inside-report case (UX2-09) — the one
crack in an otherwise reliable return-visit experience, and specifically jarring because it's the one path
that makes an authenticated user look logged-out mid-session.

### Stage 10 — Account management (profile / privacy)
**Risk: Moderate.**
- `UX8-07` (P1) — "Privacy & data" in the profile carries the identical chevron/row affordance as working
  rows but only pops a canned toast ("Your data is encrypted and never shared without your consent.") — no
  privacy policy, no data inventory, no control of any kind behind the exact row a concerned user (someone
  who just read an STI/carrier result) would tap first.
- `UX4-09` (P1) — desktop profile is a structurally different screen from mobile's curated "Account" hub —
  different title, different avatar, a raw settings-dump IA versus mobile's tidy list cards.
- `UX5-05` (P2) — desktop's profile column is measurably narrower (512px) than the dashboard's, with no
  decorative treatment at all — "the clearest 'this screen never got a desktop design pass' moment in the
  whole app," per WS5's own measurement.
- `UX8-10` (P2) — the "not a diagnosis" disclaimer and the DPDP compliance line are consistently the
  smallest, lowest-contrast, worst-placed text on their screens, with inconsistent placement across
  surfaces carrying the identical sentence.
- `UX6-04` (P1, a11y near-miss) — Profile's `Field` helper renders a real, visible `<label>` but never pairs
  it via `htmlFor`/`id`, so it looks correct on inspection while being exactly as unassociated as the
  wizard's placeholder-only fields, in both mobile and desktop branches.
**Biggest single reason a user would lose trust here:** UX8-07. This is the specific control a user alarmed
by a sensitive result would look for first, and it's the exact kind of dead end (an active-looking
affordance that silently does nothing) that, once discovered, reads as evasive regardless of intent.

---

## Most dangerous compounding paths

These are sequences where two or more friction points, each logged by a different workstream, sit
back-to-back on the same real user journey — where the combination is materially worse than either alone.

**Path A — OTP crash → silent stranding.** A user hits the raw parse-exception at OTP verify (`UX1-01`,
convergence #1) at roughly 1-in-3 odds. Rattled, a plausible reaction is to reload and "start fresh." If
they'd already gotten as far as the name/relation/eta steps before the crash (or on a retry, do so now),
that reload lands them on `UX1-02`'s trap: the session silently, successfully recovers server-side, but the
UI shows a blank phone-entry screen as if nothing exists, funneling them into a complete second OTP round
trip for an account that already exists. A user who survives the first bug is punished by the second one
for the exact recovery behavior (reload-and-retry) the first bug taught them to use.

**Path B — Long silent wait → arrival at an unexplained result.** The user sits through the real ~53-second
match-generation wait behind an animation that freezes at 8 seconds and implies near-completion for the
remaining ~45 (`UX1-06`/`UX7-03`/`UX10-01`, convergence #2) — already a drop-off risk on its own, per WS10.
If they don't abandon and the match happens to be the `sti`- or `severe`-shaped case, they land on a report
that never surfaces the actual reason their score is capped (`UX3-01`). The net experience for the couple
most likely to need clear communication (a couple with a real finding) is: an anxious, unexplained wait,
followed by an anxious, unexplained result. Two independent gaps compound into "we waited a long time for
an answer that still doesn't make sense" — precisely the two-people/high-stakes scenario this review's
governing lens exists to catch.

**Path C — The invited partner's entire journey.** This is the single worst compounding sequence found
across all 11 workstreams, because every link in the chain is P0/P1 and they occur in strict sequence for
the same, less-empowered party in the transaction:
1. The link the account holder is handed to send is dead right now (`UX8-05`) — if this isn't fixed, the
   partner never reaches step 2 at all.
2. If reached, every step of the questionnaire personally, repeatedly tells the partner their data "stays
   private to the two of you" (`UX8-02`) — false.
3. The one legitimate way to decline the most sensitive third of the questionnaire (mental health) is
   silently broken on this exact page, forcing all 21 questions (`UX8-04`), inside an already-long 33-step,
   one-sitting flow for someone who may feel social pressure to comply (`UX8-11`).
4. After finishing, a reload wipes the confirmation screen and re-shows the original consent gate; clicking
   Reject at that point is accepted by the server and displays a **false** "we will not collect your data"
   message while the pathology report and full profile remain in the database, verified directly
   (`UX7-05`/`UX8-03`, convergence #4).
A real invited partner who reaches this flow at all is misled about privacy going in, denied a documented
right to decline going through, and lied to about erasure coming out — and the account holder is separately
never told they're the custodian of someone else's sensitive data throughout (`UX8-06`). No single link in
this chain is described as a P0-in-isolation "abandonment" risk by its own workstream in every case — but
end to end, this is the review's starkest trust failure.

**Path D — Chat as last resort, then failed twice over.** `UX3-07` establishes that the AI Counselor is the
*only* surface in the product that actually explains a sensitive finding (STI gate, carrier status) well —
but nothing prompts a user to ask, so a worried user has to think to open it unprompted. If they do, and
the provider is slow rather than outright down, they face a code-verified worst case of **~90 seconds** of
silent, fully-locked-input waiting with no cancel affordance (`UX10-05`) before a generic failure message
appears. Clicking the labelled "Retry" button does not retry anything — it silently re-fetches stored
history (`UX7-04`) — and the quota (5 free messages) was already decremented before the failed attempt, so
the user has burned one of five chances for zero value, precisely at the moment they went looking for the
one explanation the product can actually give them.

**Path E — Upload: wasted time, then a lie about why it failed.** No client-side file-size check exists, so
a user's oversized PDF transmits for a genuine, measured ~20.7 seconds before the server rejects it
(`UX7-02`) — and the failure message is a hardcoded generic string that discards the backend's own correct,
specific reason ("File too large"), leaving the user to guess between "bad file," "unsupported," or "the
feature is broken." Independently, `UX10-03` documents that the backend blocks synchronously on local PDF
extraction with no isolation between requests — so under concurrent load (a real risk on this
single-process backend, as this review's own multi-agent environment incidentally demonstrated more than
once), one user's slow/failing upload can stall every other concurrent user's unrelated request at the
exact same moment this user is already confused about why their own upload failed.

---

## "Everything looks good in isolation but…" — systemic patterns from many small findings

**Every "get help" affordance in the product is a dead end.** `UX2-02` (report sidebar "Support," two
instances — desktop sidebar and mobile drawer), `UX7-10` and `UX9-08` (dashboard "Contact Support,"
independently filed for the identical button at `dashboard/page.js:384`, convergence #7) are each, alone, a
P2 "notable rough edge." Taken together: there is currently **no working path to human help anywhere in the
app**, on any surface, for a user who hits any of the many other friction points catalogued in this
document. Individually polish-tier; in aggregate, the escape valve for this entire review's worth of
findings does not exist.

**Color-only/inconsistent severity signaling recurs everywhere it matters most.** `UX3-04` (the single most
severe finding in the report styled identically to a routine caution), `UX6-05` (organ health conveyed
purely by an 8px dot's color), `UX6-06` (nav active-state is color-only, no `aria-current`), and `UX6-08`
(chronic biomarker flags reachable only via a hover-only `title` attribute) are four separate P1/P2 findings
from two different workstreams (comprehension and accessibility), on four different components. No single
instance blocks a user from eventually understanding their result if they look carefully enough — but
across the report's actual highest-stakes surfaces, the product has **no reliable, consistent, accessible
mechanism to say "this one is serious"** — precisely the failure mode this review's sensitive-data lens
exists to catch, and it is systemic rather than a single component bug (convergence #8).

**No coherent vocabulary exists for the product's own core artifact or core action.** `UX2-04` (the
compiled report is called "Analysis"/"Premarital Sync"/"Partner Sync"/"Health Story"/"Reports" depending on
which surface authored the label) and `UX9-06` (the CTA to start a new check is phrased five-plus different
ways across the same two screens) are each P2 copy-consistency findings. Combined with `UX9-03` ("Prospect"
vs. "Partner" for the same person) and the duplicated-and-drifting onboarding copy (convergence #6): this
product cannot currently be described consistently by its own users or in its own support conversations
("open your Analysis? Your Sync? Your Report?"), because no shared naming layer exists anywhere in the
codebase for any of its three most-referenced nouns (the report, the partner, the core CTA).

**Every wizard/form screen in the account-creation and profile paths shares the same small a11y/tap-target
debt.** `UX6-01` (no focus ring on any text/date/range field in login/OTP/onboarding/add-prospect), `UX6-04`
(no programmatic label association on the same fields, plus a near-miss in Profile), and `UX5-06` (report
nav rows, the wizard back arrow, and two tertiary links all under the ~44px comfortable tap-target minimum)
are three separate findings, each scoped to "one shared component." Because that shared component
(`fieldInputClass`, `QuestionScreen`) is reused on literally every screen in the single most-repeated
interaction sequence in the product — every wizard step in login, onboarding, and all five add-prospect
category flows — this is not three isolated component bugs but one **structural accessibility deficit
covering the entire account-creation and profile-completion path**, the flow every single user must
complete at least once and the invited partner must complete under real time/social pressure (Path C).

**Desktop is a systematically worse, less-informed version of every screen, one small gap at a time.**
`UX5-02` (time estimates on mobile section cards, absent on desktop), `UX5-03` (privacy/trust reassurance
line on mobile, absent on desktop), `UX4-07`/`UX4-08` (desktop dashboard is a parallel design, not a
responsive reflow, and even drops the mobile care-card's copy correction that removed an overclaimed
"medical team" line — WS4 flags the reintroduced overclaim but defers the copy angle to WS9), `UX4-09`/
`UX5-05` (desktop profile is a different, narrower, undecorated screen), and `UX4-10`/`UX4-11`/`UX4-12`
(desktop reuses different KPI/avatar/quota-chip visual grammar for the same data) are seven-plus findings
across two workstreams, each individually a P1–P2 "reconcile desktop to mobile" item. No single one of them
is drop-off-critical. But every one of them shares the identical root cause (WS5 names it directly: "desktop
components lagging behind mobile-authored enhancements") — meaning the desktop experience is not one
redesign away from parity, it is accumulating a *permanent structural lag* against every future
mobile-first enhancement unless the componentization WS4/WS5 both recommend (`OPP-UX-W4-3`, `OPP-UX-52`)
happens once, at the root, rather than being chased screen-by-screen.

---

## Cross-reference to Finding #0

Every stage above ultimately answers to the master doc's Finding #0: SlayHealth is an asymmetric,
single-account product wearing the UI of a symmetric two-person one. The funnel view makes concrete where
that asymmetry actually bites a real user: it is invisible at Landing and largely invisible through
Signup/Onboarding/Dashboard (Stages 1–4, where only the account holder exists yet), becomes acute and
compounding at Add-prospect/invite (Stage 5 — Path C is Finding #0 playing out in real time, screen by
screen), stays latent but present through Upload/Wait (Stages 6–7, still primarily the account holder's
experience), and resurfaces sharply at Report reveal (Stage 8 — the account holder is the only person who
will ever see this screen, and nothing on it ever says so, per `UX8-06`). The single highest-leverage fix
for the largest share of this document's Critical-rated stages is not any individual bug fix but closing
that structural gap — the direction WS8's own opportunities (`OPP-UX-81` through `OPP-UX-87`) and WS12's
Section 3 (`OPP-UX-14` through `OPP-UX-18`) already point toward.
