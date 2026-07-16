# SlayHealth — Frontend UX / UI / Flow Review

**Type:** Review-and-document pass (NO production code modified). **Date:** 2026-07-15.
**Method:** the real app was driven in a headless browser at mobile (390×844) and desktop (1440×900)
across every flow, against five disposable seeded couples (clean / STI-capped / severe-findings /
partial / empty). Screenshots back every "Observed" claim (in `backend/scratch/ux_shots/`, gitignored).
Contrast was measured on rendered pixels, not eyeballed. Engine/medical correctness is NOT re-diagnosed
here — where a known bug has a UX manifestation, the existing ID from `SLAYHEALTH_DEEP_REVIEW.md` is
referenced and only the experience angle is written up.

**Governing design rule:** the **mobile UI is the locked design reference.** Every mobile↔desktop
divergence is logged as a one-directional *"reconcile desktop to mobile"* item; mobile is never treated
as wrong for differing, and is never restyled to taste — but mobile IS still in scope for substantive
defects (accessibility, comprehension, states, copy, flows).

This master doc is the **spine**: finding #0, executive summary, prioritized roadmap, journey maps,
cross-cutting themes, opportunity index, links. Full per-workstream detail lives in `review/ux_WS*.md`.

> **Severity:** **P0** blocks a core flow / actively erodes trust in a health context / a11y barrier
> excluding users from a critical action · **P1** major friction or confusion likely to cause drop-off
> or sensitive-result misunderstanding · **P2** notable rough edge / inconsistency / comprehension gap ·
> **P3** polish. **OPP** = opportunity (★ if it also fixes a defect).

---

## Finding #0 — The account / pairing model (foundational; frames everything)

**SlayHealth is an asymmetric single-account product, not a two-account couple app.** Confirmed from
code + the live invite flow:

- **One person owns the account** (the "inviter" / account holder). They onboard with phone+OTP and a
  name (`frontend/src/app/onboarding`), then create a "prospect."
- **The partner is a placeholder row, not a login.** `createInvite`
  (`backend/src/controllers/invite.controller.js:95-104`) inserts a `users` row with a **synthetic
  phone** `invite-<inviteId>` and no auth — `prospect_user_id` is a shadow record
  (`postgres.service.js:153`, `ON DELETE SET NULL`). The partner never gets an account, password, or
  login.
- **Two ways the partner's data arrives:** (a) the account holder enters it themselves in add-prospect,
  or (b) they generate a tokenized link `/invite/:token` and send it manually; the partner opens it
  **unauthenticated** (`invite.routes.js:58-60` — `validateToken`/`consent`/`submit` are NOT behind
  `authenticateToken`), gives an explicit **consent accept/reject** (`consent_accepted` /
  `consent_rejected`, with timestamp+IP+user-agent captured, `invite.controller.js:262-291`), and
  submits their own details + PDF reports.
- **Only the account holder sees the report.** The compiled "Partner Sync" report renders on the
  inviter's dashboard/`core-engine`. There is **no partner-facing view** of the finished report, and no
  partner control over it after the one-time consent at submission.

**Why this frames the whole review:** the brief's premise — "two autonomous people each with a right to
control their own information, reading the report together" — is **only half-realized**. Consent exists
but is **one-time and coarse** (accept-all / reject-all at submission; no per-section control, no
retraction, no partner view). The "together" moment is **one device, the account holder's** — so the
sensitive-data presentation (STI cap, carrier status) is shown by the account holder to the partner, not
independently controlled by the person whose result it is. This is the single most important lens for
WS3 (report) and WS8 (consent/trust), and several P0/P1 findings below trace back to it. See
[`review/ux_WS8_trust_consent.md`](review/ux_WS8_trust_consent.md).

**Report-UI note (do not mis-file):** the `core-engine/story` report renders the **desktop "Premarital
Sync" narrative on all viewports** (ring KPI + tab shell + timeline slider), NOT the mobile score-bar
design language. This is a **deliberate, explicit product decision** made earlier (the mobile analysis
view was intentionally removed in favour of the previous report UI) — it is therefore **NOT a
"reconcile desktop to mobile" defect** and must not be filed as one. The report is still fully in scope
for comprehension / emotional-design / sensitive-data / a11y findings on its own terms.

---

## Executive summary

SlayHealth's frontend is substantially built, and on the fundamentals it works: no horizontal-overflow or
scrollbar bug was found anywhere across ~40 page loads at five breakpoints (WS5), the report tab does
genuine responsive re-layout rather than hide/show (WS5), typography is correctly loaded and consistently
applied (WS4), the questionnaire wizard's live "~N sec left" estimator is a genuinely good pattern (WS7),
and the AI Counselor — when a user actually reaches it — explains sensitive findings accurately and with
appropriate gravity (WS3-13). But the 12 workstreams also logged **11 P0 and 27 P1 findings**, and their
severity is concentrated, not scattered: they cluster almost entirely around the exact moments this
review's "two autonomous people, high-stakes, sensitive health data" lens exists to test, and a
disproportionate share trace back to a small number of shared code paths — one unguarded JSON parse
pattern, one status-derivation function, one missing focus-outline rule — that, fixed once, retire large
blocks of the list at a stroke.

The single sharpest cluster is the invited partner's journey (WS8), where four of this review's eleven P0s
sit back-to-back on one path (WS11 calls it "Path C" and names it the starkest trust failure in the whole
series). The literal link the product hands the account holder to send is dead right now — `APP_URL` in
`backend/.env` points at a stale LAN IP and nothing answers on that host:port (UX8-05) — which is upstream
of everything else on this path, since if the link doesn't resolve, no real partner ever reaches the
findings below. Separately, the account holder can bypass consent entirely: "I'll enter their details
myself" (UX8-01) lets them submit a third party's full STI, fertility, and 21-question mental-health
profile with zero consent artifact of any kind — no token, no accept/reject record, no notification to the
person whose data it is. If a partner does reach the real link, the product's own rotating trust copy
personally and repeatedly promises them their data "stays private to the two of you" / "just to you and
your match" (UX8-02) — demonstrably false, confirmed live: the invited partner never sees the compiled
report. And if that partner ever reloads after submitting and tries to withdraw, the app accepts a
post-submission "Reject," displays a false "SlayHealth will not collect your health details" message, and
leaves their pathology report and full profile sitting untouched in the database — verified directly
against Postgres, not just the UI (UX8-03). This is not a rough edge; it is the review's clearest instance
of the product's stated promises about consent not matching what the code actually does.

The second cluster was found independently, through different lenses, by two workstreams — which is why
it is treated as high-confidence rather than a single reviewer's read. The report's overall status text is
hardcoded to sound reassuring regardless of clinical severity. WS3 (comprehension/emotional design) found
that the downloadable PDF's cover page prints "42 / **Excellent**" for the seeded couple with a confirmed
both-carrier thalassemia finding, and its closing page labels that same finding "Genetic Trait Check
Complete · **STRONG**" (UX3-02, UX3-03). WS9 (copy/tone) independently reached the identical PDF for the
identical couple and described the same bug as "Nothing here should give you pause about building a life
together" at a score of 42/100, alongside a raw, untranslated "Male status is RED | Female is RED"
disclosure with no plain-language translation and no child-risk figure (UX9-01, UX9-02). Both trace to one
line — `reportSummary.service.js:354` sets `coupleStatus = 'Excellent'` for any non-null score, checking
only 2 of the 5 scored domains before ever downgrading it — which means the live web report (which
correctly renders off the properly-gated score) is measurably **more honest** than the PDF, the one
artifact a couple is most likely to save, print, or show a doctor or family member. Compounding this: for
the same couples, the STI-gate and confirmed-carrier findings are computed correctly on the backend and
never surface anywhere in the interactive web report at all (UX3-01) — a user reads "50, Watch Synergy"
with no way to learn the actual, named clinical reason their score was capped.

The remaining P0s sit at the account-creation gate every single user must pass, plus one structurally
distinct accessibility barrier. A raw JavaScript parse exception — `"Unexpected token 'I', "Internal
S"... is not valid JSON."` — renders verbatim as the OTP-verify error, reproduced live at roughly 1-in-3
odds in six independent attempts (UX1-01); a related timing bug means a user interrupted between OTP
success and finishing their profile is silently stranded on a blank, logged-out-looking sign-up screen even
though their session secretly, successfully recovers server-side (UX1-02). Separately, every text/date/
range/select field across login, OTP, onboarding, and add-prospect renders with **zero visible keyboard
focus indicator** (UX6-01) — a hard accessibility barrier sitting on the one flow every user must complete
at least once. Finally, worth naming even though no single workstream rated it above P1: three
workstreams, using three different methods, independently converged on the finding that match-generation's
real wait is measured at **53.2 seconds** while its six-step "progress" animation completes and freezes
after **8.4 seconds** (UX1-06 code-trace, UX7-03 live timed screenshots, UX10-01's precise direct-API
measurement) — the single highest-confidence convergence in the entire review, and, per WS10's own framing,
a genuine and avoidable drop-off risk: a user who closes the tab during the ~45 silent seconds abandons a
match that, per direct measurement, usually completes successfully. Full detail for all 11 P0 and 27 P1
findings, plus the ~45 P2 and ~15 P3 findings this summary does not have room for, is in the roadmap below.

---

## Prioritized roadmap

Sorted by severity, then grouped by theme so dependencies read naturally. Full per-finding detail
(reproduction evidence, `file:line`, best-fit direction) is in the linked workstream file. Effort:
S (<½ day) / M (½–2 days) / L (multi-day or cross-cutting). "Depends-on / Notes" flags where one fix
should land before another, or where two IDs share a root cause and are cheapest fixed together.

### P0 — blocks a core flow / actively erodes trust in a health context / a11y barrier excluding users from a critical action

| ID | Title | Workstream | Effort | Depends-on / Notes | File |
|----|-------|-----------|--------|---------------------|------|
| UX8-05 | The literal invite link handed to the account holder is dead (`APP_URL` points at a stale host:port) | WS8 | S | **Upstream of every other invite-flow finding below** — if the link doesn't resolve, a real partner never reaches UX8-01/02/03/04 | `review/ux_WS8_trust_consent.md` |
| UX8-01 | "I'll enter their details myself" lets the account holder submit a third party's full clinical + psychological profile with zero consent capture | WS8 | M | — | `review/ux_WS8_trust_consent.md` |
| UX8-02 | Rotating trust copy tells the invited partner their data "stays private to the two of you" — demonstrably false | WS8 | S (copy) / L (real partner view) | Copy fix is the immediate mitigation; durable fix is WS12's OPP-UX-16/17 (Opportunity Index, below) | `review/ux_WS8_trust_consent.md` |
| UX8-03 | Reloading the invite link after submission re-shows the consent gate; rejecting there falsely claims "no data collected" while the report and profile remain in the DB | WS8 | M | Same bug independently caught by WS7 as UX7-05 (P1) from the states/feedback lens | `review/ux_WS8_trust_consent.md` |
| UX3-01 | STI-gate and confirmed-genetic-carrier findings are computed correctly but never surface anywhere in the interactive web report | WS3 | M | — | `review/ux_WS3_report.md` |
| UX3-02 | PDF cover page and closing "upsell" page contradict the couple's own score for the severe couple ("42 / Excellent") | WS3 | S–M | **Shares one root cause with UX9-01** (`reportSummary.service.js:354`) — fix once, resolves both | `review/ux_WS3_report.md` |
| UX3-03 | PDF's Genetic Carrier-Pair card can't distinguish "never tested" from "confirmed risk," and leaks raw internal status tokens | WS3 | M | Same card also carries UX9-02 (P1) | `review/ux_WS3_report.md` |
| UX9-01 | PDF's overall status/synthesis text is hardcoded to "Excellent"/reassuring regardless of score, radiology, or genetic severity | WS9 | M | **Shares one root cause with UX3-02** — see above | `review/ux_WS9_copy.md` |
| UX1-01 | A raw JS parse-exception is shown verbatim as the user-facing error at the OTP-verify gate | WS1 | S (frontend safety net) + M (backend root-cause chase) | Same missing-guard pattern as UX7-01 (P1) and UX8-09 (P2) — one shared `apiFetch` safe-parse fix resolves all three at once | `review/ux_WS1_flows.md` |
| UX1-02 | Abandoning mid-signup between OTP success and finishing name/relation/eta silently strands the user, even though the session secretly recovers | WS1 | M | Same session-race class as UX2-09 (P1) | `review/ux_WS1_flows.md` |
| UX6-01 | No visible keyboard focus indicator on any text/date/range/select field in login, OTP, onboarding, or add-prospect | WS6 | S | Root-causes UX6-02's focus half too (single global CSS rule fixes both) | `review/ux_WS6_a11y.md` |

### P1 — major friction or confusion likely to cause drop-off or sensitive-result misunderstanding

| ID | Title | Workstream | Effort | Depends-on / Notes | File |
|----|-------|-----------|--------|---------------------|------|
| UX3-04 | The single most severe finding in "Tracked Markers" is styled identically to a routine caution | WS3 | M | Same severity-blind-styling pattern as UX9-01/UX3-02 | `review/ux_WS3_report.md` |
| UX3-05 | A "Trigger Mock Report" debug affordance is exposed, ungated, inside the live report | WS3 | S | Also addressed by WS12's OPP-UX-04 (Opportunity Index) | `review/ux_WS3_report.md` |
| UX3-06 | PDF's side-by-side comparison table marks untested parameters "HEALTHY" | WS3 | S–M | — | `review/ux_WS3_report.md` |
| UX3-07 | The AI Counselor can explain the sensitive finding well, but nothing prompts a user to ask | WS3 | S | — | `review/ux_WS3_report.md` |
| UX9-02 | A real double-carrier genetic finding is disclosed as raw, unexplained status codes with no plain-language translation or child-risk figure | WS9 | S–M | Same PDF card as UX3-03 (P0) | `review/ux_WS9_copy.md` |
| UX9-04 | Chronic Risk tab exposes an internal QA/calibration panel — including a button literally labelled "(Demo)" — in the paid consumer report | WS9 | S–M | — | `review/ux_WS9_copy.md` |
| UX7-01 | Non-JSON error responses crash to a raw JavaScript parse error shown to the user | WS7 | S | Same root pattern as UX1-01 (P0) and UX8-09 (P2) — fix once in shared `apiFetch` | `review/ux_WS7_states.md` |
| UX7-02 | Upload failures always show a generic hardcoded string, discarding the backend's real (and correct) reason | WS7 | S | — | `review/ux_WS7_states.md` |
| UX7-03 | Match-generation loading screen is a fixed decorative timer, not real progress, and the real wait is long | WS7 | M | Convergence with UX1-06 (P2) and UX10-01 (P1) — see Journey maps | `review/ux_WS7_states.md` |
| UX7-04 | Chat AI's "Retry" button doesn't retry anything, and a failed reply still burns the free quota | WS7 | S + S | — | `review/ux_WS7_states.md` |
| UX7-05 | Invite success/consent state is wiped by a reload, regressing the prospect back to square one | WS7 | S–M | Same bug as UX8-03 (P0) from the states/feedback lens | `review/ux_WS7_states.md` |
| UX10-01 | Finalizing a match is a real ~53-second synchronous wait behind a progress animation that finishes itself in 8.4 seconds | WS10 | S (elapsed-time fix) – M (schedule-aware timing) | Convergence with UX1-06 (P2) and UX7-03 (P1) | `review/ux_WS10_perf.md` |
| UX10-02 | PDF upload/parsing gives no spinner, no progress, and doesn't even disable the button during a wait that can run to ~40s | WS10 | S | — | `review/ux_WS10_perf.md` |
| UX8-04 | The optional mental-health section's "Skip this section" control is set on the step object but never wired to the component on the invited-partner's page | WS8 | S | Sits on the same journey as the UX8-05/01/02/03 P0 cluster — fix alongside it | `review/ux_WS8_trust_consent.md` |
| UX8-06 | No UI moment ever tells the account holder they are viewing/controlling a third party's sensitive data on that person's behalf | WS8 | S–M | — | `review/ux_WS8_trust_consent.md` |
| UX8-07 | "Privacy & data" in the profile is a dead end dressed as a real settings destination | WS8 | S (demote) / M (build real page) | — | `review/ux_WS8_trust_consent.md` |
| UX8-08 | REG-03's "Doctor Reviewed" fix did not fully propagate — an unfixed sibling badge is still live today | WS8 | S | — | `review/ux_WS8_trust_consent.md` |
| UX6-02 | Report hamburger menu button and the shared timeline slider explicitly strip focus with no fallback; the hamburger has no accessible name | WS6 | S | — | `review/ux_WS6_a11y.md` |
| UX6-03 | The closed report chat drawer still intercepts multiple keyboard-Tab stops, entirely off-screen | WS6 | S | — | `review/ux_WS6_a11y.md` |
| UX6-04 | Systemic missing programmatic label association across every wizard field, plus a near-miss in Profile | WS6 | M | — | `review/ux_WS6_a11y.md` |
| UX6-05 | USG "Organ Health Status" conveys Normal/Mild/Moderate/Severe purely by the color of an 8px dot | WS6 | S | Part of the color-only-severity theme with UX6-06/UX6-08 and UX3-04 | `review/ux_WS6_a11y.md` |
| UX4-01 | "The brand teal" is three different greens; two parallel token systems exist | WS4 | L | — | `review/ux_WS4_visual.md` |
| UX4-07 | Headline-KPI language: mobile's weighted arc-gauge vs. desktop's flat progress bar | WS4 | M | — | `review/ux_WS4_visual.md` |
| UX4-08 | The desktop dashboard is a different design, not a responsive reflow | WS4 | L | Umbrella for UX4-07/UX4-09 and the P2 KPI/avatar/quota gaps | `review/ux_WS4_visual.md` |
| UX4-09 | Profile is a different screen, language, and IA per viewport | WS4 | L | — | `review/ux_WS4_visual.md` |
| UX5-01 | 768–1023px is a real breakpoint dead-zone: desktop tree renders under the mobile bottom nav | WS5 | S | — | `review/ux_WS5_responsive.md` |
| UX2-09 | Refreshing inside the report drops the user on the public marketing landing page | WS2 | M | Same session-race class as UX1-02 (P0) | `review/ux_WS2_ia_nav.md` |

### P2 / P3 — notable rough edges, inconsistencies, and polish (not exhaustively listed here)

Roughly **45 P2** and **15 P3** findings exist across the 12 workstream files — full detail in each
`review/ux_WS*.md`. The ones with outsized leverage (because they recur across workstreams, or sit
directly on a Critical-rated funnel stage) are already named in the Cross-cutting themes section below
rather than repeated in a table here; notable examples include the three independently-filed dead "Support"
buttons (UX2-02 ×2, UX7-10/UX9-08), the genomics stub's identical-to-working-tabs affordance (UX2-01), the
duplicated-and-drifted onboarding wizard (UX1-03/UX9-07), and the five-plus names for the same report
artifact (UX2-04) and the same core CTA (UX9-06). Per-workstream P2/P3 counts: WS1 5+2, WS2 8, WS3 4+1,
WS4 6+2, WS5 5, WS6 3+1, WS7 5+1, WS8 3+2, WS9 5+1, WS10 1+5 (WS10's five P3s are mostly positive findings
with caveats, not defects).

---

## Journey maps

WS1 ([`review/ux_WS1_flows.md`](review/ux_WS1_flows.md)) mapped the individual journey end to end — landing
→ phone+OTP signup → inline onboarding → dashboard first-run → add-prospect (self profile → routing →
partner profile → pathology/radiology → Generate Insights) → report reveal → a later return visit — driven
live on genuinely fresh throwaway signups where possible. WS11
([`review/ux_WS11_funnel.md`](review/ux_WS11_funnel.md)) then took a second pass as a **pure synthesis**: it
re-read all 11 other workstreams plus this spine and re-assembled every logged friction/drop-off signal
along that same real funnel, spot-checking five load-bearing cross-workstream claims directly against
source before writing rather than re-driving the app. Both are summarized here rather than re-derived; see
the linked files for full detail.

**Risk by funnel stage** (WS11's own table):

| Stage | Risk | Primary driver |
|---|---|---|
| 1. Landing | Low–Moderate | Chrome bleed for returning users (UX1-07); one unfixed trust badge (UX8-08) |
| 2. Signup / OTP | **Critical** | Raw JS parse-exception at the one mandatory gate, ~1-in-3 repro (UX1-01) |
| 3. Onboarding (name/relation/eta) | Moderate | Duplicated, drifted "collect your name" implementation (UX1-03/UX9-07); no focus ring or labels (UX6-01/UX6-04) |
| 4. Dashboard first-run | Moderate | An in-flight invite looks byte-identical to a never-started account (UX7-06) |
| 5. Add-prospect / invite | **Critical** | Zero-consent self-entry path (UX8-01); dead invite link (UX8-05); false privacy promise (UX8-02) |
| 6. Upload | High | A generic error masks the real cause after a long, silent wait; no client-side size guard (UX7-02, UX10-02) |
| 7. Wait / processing | High | Real ~53s wait vs. an 8.4s fake-progress animation that then freezes (UX1-06/UX7-03/UX10-01) |
| 8. Report reveal | **Critical** | The couple's most severe, most sensitive finding never surfaces on the surface they're actually looking at (UX3-01); the PDF self-contradicts (UX3-02/UX9-01) |
| 9. Return visit | Low | Core path is a genuine, verified strength (UX1-10); one known regression (UX2-09) |
| 10. Account management | Moderate | Dead "Privacy & data" row (UX8-07); desktop profile is a different, undecorated product (UX4-09) |

Three stages are rated **Critical** — a P0 sits directly on the only path through that stage, not merely
nearby: Signup/OTP, Add-prospect/invite, and Report reveal. These are the same three clusters named in the
executive summary above; the funnel view is what confirms they aren't just severe in isolation, they also
sit at the exact points in the journey most likely to cause abandonment or lasting mistrust.

WS11 additionally documents **eight cross-workstream convergences** (findings reached independently, via
different methods, by 2–3 different workstreams — treated as materially higher-confidence than any single
workstream's finding alone) and **five "compounding paths"** — sequences where friction points logged by
different workstreams sit back-to-back on the same real journey and combine into something worse than
either alone. The starkest of these, **Path C — "the invited partner's entire journey"** — chains
UX8-05 (dead link) → UX8-02 (false privacy promise) → UX8-04/UX8-11 (broken skip, forced 33-step flow) →
UX7-05/UX8-03 (reload lies about erasure) in strict sequence for the same, least-empowered party in the
transaction; WS11 names it "the review's starkest trust failure." The other four paths — **A** (OTP crash
→ silent stranding), **B** (long silent wait → arrival at an unexplained result), **D** (chat as the one
good explanation channel, then failed twice over by a broken retry and a pre-debited quota), and **E**
(upload — wasted time, then a lie about why it failed) — are documented in full in WS11 and not re-derived
here.

---

## Cross-cutting themes

WS11's convergence analysis already identifies eight specific same-finding convergences at the ID level
(reproduced in Journey maps above). The patterns below group those, plus additional repeating shapes
visible once all 12 workstream files are read together, at a level above any single finding.

1. **Raw internals leak straight to the user.** A JavaScript `SyntaxError` from an unguarded `res.json()`
   call renders verbatim as the on-screen error at the one gate every user must pass (UX1-01, P0), and the
   identical missing guard recurs on the invite page (UX8-09, P2), the login rate-limiter response and the
   invite-page validate/submit calls (UX7-01, P1), and the upload-failure path, which discards the
   backend's own correct error string for a fixed generic one instead (UX7-02, P1). At least 6+ call sites
   are confirmed in source; the fix (`responseJson()`/`apiFetch`, already written once in
   `CompatibilityContext.js`) is not reused anywhere else.
2. **Severity-blind, self-contradicting status text and color recur on the report's own highest-stakes
   surfaces.** The PDF's "Excellent" survives a 42-score, both-carrier-thalassemia couple (UX9-01, P0;
   UX3-02, P0) via a status function that checks only 2 of 5 domains; the single most severe finding
   inside the web report shares a badge style with a routine "steady watch" caution (UX3-04, P1); organ
   health is conveyed purely by an 8px dot's color with no text label at all (UX6-05, P1); nav active-state
   and biomarker flags are likewise color-only or reachable only via a hover-only `title` (UX6-06, UX6-08,
   P2). Two different audits — comprehension/hierarchy and WCAG 1.4.1 Use of Color — independently
   converge on the same conclusion (WS11's convergence #8): this product has no reliable, consistent,
   accessible way to say "this one is serious," anywhere on its highest-stakes surfaces.
3. **Every "get help" affordance in the product is a dead end.** The report sidebar's "Support" button
   (UX2-02, P2, both the desktop sidebar and mobile drawer instance) and the dashboard's "Contact Support"
   card were independently filed twice, by two workstreams that never cross-referenced each other (UX7-10
   and UX9-08, both P2, both citing `dashboard/page.js:384` — WS11's convergence #7). Taken together with a
   third debug-style affordance living where a real control should be — the "Trigger Mock Report" link
   sitting under the real upload button (UX3-05, P1) — there is currently **no working path to human help
   anywhere in the app**, for a user who hits any other finding in this document.
4. **Fake or decoupled progress indicators mask the app's two longest real waits.** Match-generation's real
   ~53.2s wait sits behind a 6-step animation that completes and freezes after 8.4s (UX1-06, P2; UX7-03,
   P1; UX10-01, P1 — WS11's convergence #2, this review's single highest-confidence finding of any kind);
   PDF upload/parsing gives only a static button-label swap for a wait that can legitimately run to ~40s
   worst case, with no `disabled` state to stop a duplicate submit (UX10-02, P1). The fix pattern already
   exists in the same codebase (the questionnaire wizard's honest, shrinking "~N sec left" estimator,
   `estimateTime.js`) and simply isn't reused for either wait.
5. **Consent and trust copy were authored for a symmetric two-account product the codebase doesn't actually
   build.** The invited partner is personally, repeatedly told their data "stays private to the two of you"
   (UX8-02, P0) though they never see the compiled report; a parallel path skips consent for them entirely
   (UX8-01, P0); a post-submission "reject" falsely claims erasure while their data sits untouched in the
   database (UX8-03, P0); and the account holder is never told, anywhere, that they are the custodian of
   someone else's sensitive health and mental-health data (UX8-06, P1). All four trace directly back to
   Finding #0's asymmetric single-account model.
6. **Desktop is a systematically lagging, separately-authored product rather than a responsive reflow of
   mobile.** The dashboard's headline KPI, its whole component tree, and profile are each a parallel design
   rather than a reflow of the mobile original (UX4-07/UX4-08/UX4-09, P1); a real breakpoint dead-zone
   (768–1023px) runs the desktop content tree underneath the mobile bottom nav (UX5-01, P1); and smaller
   gaps recur underneath that pattern — per-section time estimates, a privacy/trust reassurance line, a
   "back to dashboard" control, and a decorative background all exist on mobile and are simply absent on
   desktop (UX5-02/UX5-03/UX5-04/UX5-05, P2). WS5 names the shared root cause directly: "desktop components
   lagging behind mobile-authored enhancements" — a permanent structural lag, not a one-time gap, unless
   the componentization WS4 and WS5 both recommend happens once at the root.
7. **Session/silent-refresh races repeatedly strand authenticated users on screens that look logged-out.**
   Abandoning mid-signup shows a blank phone-entry step despite a real, successful background session
   refresh (UX1-02, P0); refreshing while already inside the report bounces an authenticated user onto the
   public marketing landing page (UX2-09, P1); and WS5's own methodology notes independently caught the
   same class recurring on two more surfaces during ordinary driving (WS11's convergence #5) — three
   workstreams, three different lenses, the same underlying gap: the app's state genuinely recovers, but
   the UI never re-checks before rendering a false "start over" screen.
8. **No shared vocabulary exists for the product's own core nouns, and the one place duplication was tried
   has already visibly drifted.** The compiled report is "Analysis" / "Premarital Sync" / "Partner Sync" /
   "Health Story" / "Reports" depending on which surface authored the label (UX2-04, P2); the CTA to start
   a new check has five-plus phrasings across two screens (UX9-06, P2); the same person is "Partner" on one
   screen and "Prospect" on the next, inside the same report (UX9-03, P2); and the name/relation/eta
   onboarding trio, hand-implemented twice in two files, has already drifted apart (a curly vs. a straight
   apostrophe) — WS9 independently and empirically confirmed the exact risk WS1 had only flagged as
   structural (UX1-03/UX9-07, P2, WS11's convergence #6).

---

## Workstream files

- [`review/ux_WS1_flows.md`](review/ux_WS1_flows.md) — journey mapping (landing→signup→OTP→pairing→add-prospect→upload→wait→report→return).
- [`review/ux_WS2_ia_nav.md`](review/ux_WS2_ia_nav.md) — information architecture & navigation.
- [`review/ux_WS3_report.md`](review/ux_WS3_report.md) — the report experience (comprehension & emotional design).
- [`review/ux_WS4_visual.md`](review/ux_WS4_visual.md) — visual design system & consistency.
- [`review/ux_WS5_responsive.md`](review/ux_WS5_responsive.md) — responsive / mobile-reference audit + desktop reconciliation.
- [`review/ux_WS6_a11y.md`](review/ux_WS6_a11y.md) — accessibility (WCAG 2.x AA, measured contrast).
- [`review/ux_WS7_states.md`](review/ux_WS7_states.md) — states, feedback & error UX.
- [`review/ux_WS8_trust_consent.md`](review/ux_WS8_trust_consent.md) — trust, privacy & consent UX.
- [`review/ux_WS9_copy.md`](review/ux_WS9_copy.md) — copy, microcopy & tone.
- [`review/ux_WS10_perf.md`](review/ux_WS10_perf.md) — performance & perceived performance.
- [`review/ux_WS11_funnel.md`](review/ux_WS11_funnel.md) — friction & drop-off inventory (synthesis).
- [`review/ux_WS12_ideation.md`](review/ux_WS12_ideation.md) — redesign & enhancement opportunities.

---

## Opportunity index

Full detail (rationale, user benefit, effort, impact, `file:line`) for every idea below is in
[`review/ux_WS12_ideation.md`](review/ux_WS12_ideation.md), which ranks 31 ideas by impact × effort across
six areas: onboarding/activation, report KPI hierarchy, trust & consent, delight, retention, and
first-run/genomics. Each workstream file also carries its own smaller, locally-scoped opportunity list tied
directly to that workstream's own findings (e.g. WS3's OPP-UX-31/32/33, WS6's OPP-UX-61–65, WS7's
OPP-UX-71–74, WS8's OPP-UX-81–87, WS9's OPP-UX-91–94) — those are already cited inline in the roadmap table
above next to the findings they fix, rather than repeated here; this index covers WS12's cross-cutting
ideation only.

**★ marks an idea that directly fixes — not merely relates to — a P0/P1 finding in this doc's own roadmap
above**, cross-checked independently against that roadmap rather than copied from WS12's own star key (WS12
stars against "any logged defect" more broadly, including several P2-level or unfiled friction points that
are left unstarred here on this document's stricter, P0/P1-only basis).

### Onboarding / activation
- **OPP-UX-01** (S, High impact) — auto-submit OTP on the 6th digit + inline "wrong number" edit; closes
  the single highest-friction step in the funnel without fixing any one catalogued defect directly.
- **OPP-UX-02** (S–M, High) — WhatsApp-OTP delivery resilience (masked-number state, an "Open WhatsApp"
  affordance, earlier reassurance before the 60s resend lock).
- **★ OPP-UX-04** (S, Med-High) — de-emphasize and relabel the "use a mock report" escape hatch. This is
  the same debug-affordance-in-a-live-report shape as **UX3-05 (P1)** — the same underlying
  `triggerMockData`/`triggerMockRadiology` mechanism, just reached via a different UI element; fixing its
  framing/prominence is effectively the same fix.
- **OPP-UX-03** (M, High) — accept photos of a paper lab report, not PDF-only; OCR infra already exists,
  and the target audience routinely photographs a paper report rather than owning a PDF.
- **★ OPP-UX-05** (M, Med-High) — make the processing wait honest: tie steps to real backend milestones
  (the invite flow's own SSE infra is the in-house model) instead of a fixed timer, and drop the alarming
  "don't close this page" for "this keeps running even if you step away." This is the direct fix for
  **UX7-03 (P1)** and **UX10-01 (P1)** — the review's highest-confidence P1 convergence.

### Report KPI hierarchy & comprehension
- **OPP-UX-09** (S, High) — a plain-language verdict sentence + the mobile "Reliable at N%" confidence chip
  directly beneath the ring, without moving the (locked) ring itself.
- **OPP-UX-10** (M, High) — reuse the mobile `WeightedGauge` as an expand-on-tap "how is this calculated?"
  breakdown of the headline score.
- **OPP-UX-12** (S, Med) — replace opaque band words ("Watch Synergy") with a plain-language legend whose
  tone can never read as praise on a capped or serious result. Adjacent to, but not the authoritative fix
  for, this doc's theme #2 (severity-blind status language) — the authoritative fix for the PDF specifically
  is WS9's own OPP-UX-91, cited in the roadmap above.

### Trust & consent — closing the Finding #0 partner-autonomy gap
- **★ OPP-UX-14** (M, High) — a partner "data receipt" + revoke-by-link at submit-success. The most
  directly buildable step toward closing **UX8-02 (P0)**'s false privacy promise, and gives **UX8-03
  (P0)**'s currently-broken "reject" flow an actual mechanism to point at instead of a silent status flip.
- **★ OPP-UX-16** (M–L, High) — a lightweight, no-account partner-facing view of the partner's *own*
  results only. This is **UX8-02 (P0)**'s own named "durable fix" — the promise becomes true instead of
  needing to be walked back to something more honest.
- **★ OPP-UX-17** (S, Med-High) — legible consent copy ("what {inviter} will see / what stays private to
  you") at the actual decision point, before Accept/Reject. This is the direct copy-level fix
  **UX8-02 (P0)**'s remediation explicitly calls for as the low-effort interim step.
- **OPP-UX-15** (M, High) — granular per-data-type consent at submission, so a partner can decline the
  psychometric section specifically instead of all-or-nothing — complements but does not replace UX8-04's
  fix (the currently-broken single skip control).

### Delight, retention, first-run
- **OPP-UX-27** (M, High) — a guided "3 steps to your first check" first-run empty state, replacing today's
  bare "start your first check" dead end.
- **OPP-UX-23 / OPP-UX-26** (M, High) — turn `NotificationBell` into a real re-engagement channel and
  auto-nudge stalled invites — the two biggest available levers against the silent invite-abandonment
  problem WS7 also names (UX7-06, P2).
- **OPP-UX-29** (M, Med-High) — turn the dead Genomics "Coming Soon" stub into a credible teaser with a
  *working* waitlist (its "Notify me" pill is currently unwired to anything).

Five ideas above carry this document's own ★ (OPP-UX-04, OPP-UX-05, OPP-UX-14, OPP-UX-16, OPP-UX-17) — three
of them (14/16/17) all attack the same P0 (UX8-02) from three different angles (data + copy + delivery
mechanism), which is why WS8's own remediation for UX8-02 explicitly names both the cheap copy fix and the
durable partner-view build as options rather than picking one.

---

## Appendix — screenshots & scripts

All review evidence lives under `backend/scratch/` (confirmed **gitignored** — no review artifacts pollute
the tracked tree) and was produced by driving the real, running app end to end — never by hand-editing
database rows to fake a state, except where a workstream file explicitly says otherwise and flags it as
such.

- **Screenshots:** `backend/scratch/ux_shots/`, one filename prefix per workstream (`ux1_` … `ux10_`, plus
  shared historical `ux_`/`ux9_`/`uxa_` shots from earlier passes in this same review cycle — reused only
  where the underlying code was independently re-read and confirmed unchanged) — mobile (390×844) and
  desktop (1440×900) pairs for essentially every surface in the app, plus WS5's targeted breakpoint probes
  at 360/430/800/900/1000px, and full 6-page PDF renders per seeded couple (WS3, WS9).
- **Seeded couples** (`/tmp/ux_couples.json`, per `review/_ux_env_recipe.md`): `clean` (score 88, all-clear),
  `sti` (score 50, Hepatitis B reactive screen, STI gate triggered), `severe` (score 42, both partners
  confirmed thalassemia carriers, plus radiology findings), `partial` (pending invite, awaiting partner),
  `empty` (first-run, no data). Several workstreams additionally seeded their own disposable, reserved
  throwaway phone-number ranges to reach flows the five fixtures above can't (a genuinely cold signup, a
  real OTP round-trip, a real unauthenticated invite-consent/reject run) — e.g. WS1 `+19990801xxx`, WS6
  `+19990806xxx`, WS7 `+19990807xxx`, WS8's real invite created and walked through the live, unauthenticated
  API (no session injection), WS10 `+19990810xxx`. All disposable accounts were either deleted at the end of
  their session or are isolated to their workstream's reserved number range.
- **Driver/measurement scripts** (one or more per workstream, all under `backend/scratch/`): notably
  `ux1_mint_otp.js`/`ux1_abandon_clean.js` (real OTP minting via `otpService.createOTPRequest()` + timed
  abandon-flow capture), `ux3_drive.js`/`ux3_mint_sessions.js`/`ux3_pdf_shot.js` (full report-tab + AI-chat
  drive and PDF rendering via PyMuPDF/`qlmanage`), `ux6_lib.js` (in-page WCAG contrast measurement with a
  Lab(D50)→XYZ→Bradford-D65→sRGB conversion for Tailwind v4's `lab()` color output, plus real keyboard
  Tab/Space/Enter focus-and-label auditing), `ux7_matchgen_*` (timed screenshots at t=0.5…20s through the
  real match-generation wait), the WS8 invite-flow scripts (driving `POST /api/invite/send` for real, then
  the full unauthenticated consent/questionnaire/submit sequence), and `ux10_*probe.js` (direct authenticated
  timing against the live backend for match-generation, PDF upload/OCR, and AI chat).
- **Known environment caveats, disclosed by their own workstreams rather than hidden:** the shared frontend
  dev server (port 3002) went unreachable for several minutes at least twice under concurrent multi-agent
  review load, affecting WS1, WS3, WS6, WS8, and WS10 to varying degrees — every finding that could only be
  traced from source rather than re-observed live after recovery is marked **Code-only** in its own
  workstream file, never blurred into **Observed**. Two seed-data shape gaps (flat `projection_current`/
  `projection_optimised` keys vs. the real, nested `projection: {current, optimised}` the live engines and
  frontend expect) prevented live rendering of the Fertility Timeline and Chronic Risk tabs' content wells
  on the seeded fixtures specifically (WS3, WS10) — noted as fixture limitations, not filed as product
  defects, per the review's own methodology rule of not blurring a seed gap into an observed bug.
