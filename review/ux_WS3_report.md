# WS3 — The Report Experience (Comprehension & Emotional Design)

**Reviewer workstream:** WS3 (IDs `UX3-NN`). Driven live in headless Chromium at mobile (390×844) and
desktop (1440×900) against seeded couples `clean` (score 85, all-clear), `sti` (score 50, `sti_gate`
triggered on a reactive Hepatitis B screen, male side), and `severe` (score 42, both partners confirmed
thalassemia carriers). Screenshots in `backend/scratch/ux_shots/` (prefix `ux3_`). Read-only on code.
Governing rule honoured: mobile is the locked reference; nothing below is filed as a "reconcile desktop
to mobile" item because every defect found here is byte-for-byte identical on both viewports (the
components involved carry no responsive branching for the classes/strings in question) or was directly
re-verified on mobile (`ux3_sti_story_mobile.png`, `ux3_sti_usg_mobile.png`).

**Corrections to the briefing, verified live rather than assumed:**
- The five "already fixed" engine-adjacent bugs (WS6-01 fabricated radiology reads, WS6-02 ungated
  client headline, WS1D01 unscanned-organ-100, WS0-09 DPDP claim, WS0-07 Sachin/Swati fallback) are
  confirmed fixed in the code actually running: `story/page.js` now reads the one gated
  `relationship_snapshot.score`, null-guards every domain, and `usg/page.js` blocks uploads without a
  real sex/DOB rather than defaulting them. Not re-filed.
- **The OpenRouter key is NOT dead right now** — contrary to the environment recipe. Direct calls to
  `POST /api/chat/message` (bypassing the UI) twice returned real, high-quality, engine-context-aware
  replies (see UX3-07/UX3-13). Narrative generation for the seeded matches themselves can't be judged
  from these seeds — `ai_narrative` for `clean`/`sti`/`severe` was hand-authored by `ux_seed.js`, not
  LLM-generated (seed limitation, not a defect).
- The active PDF renderer is `backend/src/services/pdfReport.service.js` (confirmed via
  `compatibility.controller.js:4,167`) — the sibling `pdfReport2.service.js` is not wired to the
  download route and was not evaluated further.
- **Seed-data-shape limitation (not a filed defect, per the recipe's carve-out):** `ux_seed.js` writes
  `mfrResult`/`chronicResult` with flat `projection_current`/`projection_optimised` keys, but
  `mfr/page.js` and `chronic/page.js` (and the real `mfr.controller.js:708-710`) expect a nested
  `projection: {current, optimised}` object. Result: the **Fertility Timeline tab hard-crashes** to the
  generic error boundary ("Something went wrong!") for all three couples, and the **Chronic Risk tab
  renders its shell with an empty content well** for all three. Confirmed by reading `mfr.controller.js`
  (real shape) against the seed (flat shape) — this is a fixture gap, not independently verified as a
  production bug, so it is not filed below; it does mean this review could not observe the live
  Fertility Timeline tab's per-couple content, which is a real gap in this pass's coverage.

**Surfaces mapped**
- Report shell tabs: `frontend/src/app/core-engine/story/page.js` (headline ring, narrative, "Tracked
  Markers", "Path Forward"), `mfr/page.js`, `chronic/page.js` (both seed-limited, see above),
  `usg/page.js` (Organ Wellness / radiology), `genomics/page.js` (stub, ref WS2-01, not re-diagnosed).
- AI Counselor: `frontend/src/components/ReportChatDrawer.js`, `backend/src/controllers/chat.controller.js`,
  `backend/src/services/llm/openrouter.service.js`.
- Downloadable report: `backend/src/services/pdfReport.service.js` (6-page PDF, `/api/compatibility/matches/:id/pdf`).
- Backend scoring/gating read for root-cause tracing only (not re-diagnosed):
  `backend/src/services/compatibility/reportGeneration.service.js` (`computeGatedComposite`),
  `backend/src/services/compatibility/reportSummary.service.js` (`mapPresentation`, `checkSTISafetyGate`).

---

## Lead summary (crux findings first)

- **The single richest, most clinically important content in the whole product — the STI safety-gate
  finding and the confirmed-both-carrier genetic finding — is computed correctly on the backend and then
  never shown anywhere in the interactive web report** (UX3-01). A user looking at the `sti` or `severe`
  couple's Story/Chronic/Fertility/Organ tabs sees a capped number and generic template prose; nothing
  names Hepatitis B, "reactive," "confirmatory testing," or "thalassemia" anywhere on screen.
- **The downloadable PDF — the one artefact couples are most likely to save, print, or show a doctor or
  family member — directly contradicts itself for the severe couple**: cover page shows "42" next to
  "**Excellent**" (UX3-02), and page 6 labels the confirmed both-carrier genetic finding "**Genetic Trait
  Check Complete · STRONG**" (UX3-02/UX3-12). Page 4's own "Genetic Carrier‑Pair Overlap" card uses the
  **identical heading and template** ("CARRIER TRAIT OVERLAP OBSERVED") for a couple that was never even
  tested (`clean`, both **gray**) as for a couple with a confirmed real risk (`severe`, both **red**) —
  and leaks raw internal status tokens ("Male status is RED... Hb Variant Male is GRAY") straight into
  customer-facing copy (UX3-03).
- **A visible, unlabelled "Trigger Mock Report" link sits inside the live report** next to the real
  "Upload PDF" button on both partners' cards (UX3-05) — a debug affordance with no gate, on both
  viewports, for every couple without radiology data.
- The AI Counselor, when directly tested, is genuinely good — it named the exact reactive Hepatitis B
  finding and the shared thalassemia carrier risk unprompted, in a warm, clinically-appropriate tone
  (UX3-13, positive) — but nothing in the UI hints a user should ask, and the suggested-question chips
  never mention it (UX3-07).
- Two small, low-effort, systemic tone problems recur across every couple regardless of severity: the
  score status pill is hardcoded to the same calm teal regardless of how bad the ring says things are
  (UX3-08), and the Story tab's opening sentence always claims "your paths converge at a healthy and
  cooperative starting point" (UX3-09) — even for the couple whose children face a real inherited-disease
  risk.

---

### [P0] UX3-01 — The STI-gate and confirmed-genetic-carrier findings are computed correctly but never surface in the interactive web report
- Flow / Screen: Report → Partner Sync (Story) tab, and by extension Fertility/Chronic/Organ tabs, for
  the `sti` and `severe` couples. `frontend/src/app/core-engine/story/page.js` (whole page; score at
  L224-225, threads at L547-664, actions at L666-678).
- Viewport: both (identical markup; re-verified on `sti` at 390×844).
- Status: Observed — `ux3_sti_story_desktop.png`, `ux3_sti_story_mobile.png`,
  `ux3_severe_story_desktop.png`; full page-text dumps in `backend/scratch/ux3_sti_desktop_full.log` and
  `ux3_severe_desktop_full.log`. Cross-checked against the live API: `GET
  /api/compatibility/matches/a07722ff.../` returns `presentation_json.sti_gate = {triggered: true,
  headline: "Reactive Screening Result — Confirmation Needed", findings: [{sti: "Hepatitis B", detail:
  "HBsAg is Reactive for Partner (Male)..."}]}` and `severe`'s match returns
  `carrier_pair_risk.thalassemia = {male_status: "red", female_status: "red", narrative: "Both partners
  show an elevated HbA2 level (Male: 4.1%, Female: 4.4%)... please discuss this with a genetic
  counselor."}` — both fields exist, are correct, and are simply never read by any of the four tabs
  except the one collapsed "Future kids' genetic baseline" row (see UX3-04) and the PDF (see UX3-02/03).
- Evidence: On the `sti` couple's Story tab the full visible text is: a "50 PTS / WATCH SYNERGY" ring, a
  "Your Health Story" paragraph that only discusses fertility/metabolic/mental topics, a "Tracked
  Markers" list with exactly three rows ("Starting a family: Resolved", "Blood sugar & metabolic health:
  Resolved", "Psychometric alignment: Resolved" — no infection/STI row exists at all, because the
  `threads` array in `story/page.js:547-664` has no infection-screening entry), and a "What to do next"
  list reading only "Book a professional clinical session to review metabolic and reproductive markers"
  and "Establish a couple-centered tracking timeline." Nowhere does the word "Hepatitis," "reactive," or
  "screening" appear. The same is true on Fertility, Chronic, and Organ Wellness tabs. A first-time user
  has no way to learn *why* their score is capped at 50, or that the specific, named next step is
  confirmatory Hepatitis B testing plus specialist consultation — information the backend already wrote
  in plain English and simply never ships to this surface.
- UX impact: comprehension + trust, at the highest stakes this app has. This is the exact scenario the
  brief's "sensitive-result" lens exists for: a couple could reasonably read "50, Watch Synergy, book a
  session sometime" as low-urgency admin, not "one of you needs confirmatory testing for a reactive
  infectious-disease screen before you have unprotected sex or plan a family." For `severe`, the couple
  never learns from this screen that their children face a real, named inherited-disease risk unless they
  open the PDF or ask the right question in chat.
- Heuristic: match between system and real world (the system knows the real reason; the user is shown a
  number); visibility of system status; error prevention in a high-stakes domain.
- Root cause: IA/code — the Story tab's `threads` array (`story/page.js:547-664`) was authored against
  fertility/chronic/mental/radiology/genetics domains only; `sti_gate` was never wired to a UI element on
  this surface (only to the score cap and the PDF).
- Best-fit direction: add a first-class "Infection screening" thread bound directly to
  `activeMatchDetails.presentation_json.sti_gate`, and promote (not bury) the existing genetics thread
  when `carrier_pair_risk` is red — both using the `sti_gate.headline`/`narrative`/`clinical_footnote`
  and `carrier_pair_risk.thalassemia.narrative` strings that already exist server-side, not new copy.
  See OPP-UX-31.
- Effort: M
- Blast radius: `story/page.js` threads array + "Path Forward" actions list; the same gap likely applies
  to `mfr.page.js`/`chronic.page.js` once their seed-data crash is fixed (out of this pass's observable
  scope).

### [P0] UX3-02 — PDF cover page and "upsell" page contradict the couple's own score for the severe couple
- Flow / Screen: Downloaded PDF report, pages 1 and 6. `backend/src/services/pdfReport.service.js:395-436`
  (snapshot fallback + `hasHealthFlag` override), `:514-519` (score/status render), `:955-959` (page 6
  genetic upsell badge).
- Viewport: both (PDF is viewport-independent; generated via the same "Download PDF Report" button
  present on every report tab at both breakpoints).
- Status: Observed — rendered and screenshotted directly: `ux3_severe_pdf_cover.png` (page 1),
  `ux3_severe_pdf_p6.png` (page 6). Verified against the live API response for this match (`compatibility_score:
  0.417`, `relationship_snapshot: {score: 42, status: "Excellent", color: "green"}`,
  `carrier_pair_risk.thalassemia: {male_status: "red", female_status: "red"}`).
- Evidence: Page 1's "WHAT THIS MEANS FOR YOU TWO" panel prints, side by side: **"42 / COMPATIBILITY"**,
  **"Excellent / OVERALL RATING"**, "Good start / CONFIDENCE IN THE GOOD NEWS" — a couple with a
  sub-50-percent-equivalent score is told their overall rating is "Excellent" in the same large serif
  type used for every genuinely healthy couple's page 1 (compare `ux3_clean_pdf_p1.png`: 85/Excellent,
  internally consistent). Page 6's "Completing your premarital health profile" upsell section then labels
  the "GENETIC CARRIER-PAIR" module **"Genetic Trait Check Complete"** with badge **"STRONG"** —
  the same word ("Strong") the same page uses for a genuinely good fertility result on page 1
  ("Frt · STRONG · Strong odds when you're ready"). Root cause, precisely: `pdfReport.service.js:426-436`
  only downgrades `snapshot.status`/`color` when it finds a `yellow`/`red` flag inside
  `presentation.body_health` — it never checks `presentation.sti_gate.triggered` or
  `presentation.carrier_pair_risk`, so a couple whose *worst* finding is a confirmed genetic carrier
  overlap (not a body_health card) sails through this override untouched. Separately, page 6's
  `isGenCompleted`/`"Strong"` badge at `:955-959` is driven purely by `report_confidence.domains.genetic.covered`
  (did we get enough data to score this domain at all) — a data-completeness flag with zero awareness of
  whether the result inside that domain was good or catastrophic.
- UX impact: trust, catastrophically — this is the exact kind of internal contradiction that makes a
  health report feel unreliable or algorithmically broken the moment a reader notices it (and the
  contradiction sits on the two pages most likely to be read: the cover and the closing summary).
- Heuristic: consistency & internal contradiction; match between system and real world.
- Root cause: code — the "does this couple have a real flag" check at `pdfReport.service.js:426-436`
  is scoped to `body_health` only; the page-6 upsell badge conflates "data coverage" with "good result."
- Best-fit direction: extend the override loop to also treat `sti_gate.triggered` and any
  `carrier_pair_risk.*_status === 'red'` as a reason to downgrade `snapshot.status`/`color`; on page 6,
  replace the reused "Strong" label with data-completeness-specific language (e.g. "Data received") and
  only call out "Strong" when the *underlying finding*, not the domain's data completeness, is good. See
  OPP-UX-32.
- Effort: S (the override-loop fix) – M (page 6 relabel + verifying no other domain has the same gap).
- Blast radius: `pdfReport.service.js` cover + upsell page; same class of bug worth auditing across all
  five domain badges in that file.

### [P0] UX3-03 — PDF's Genetic Carrier-Pair card can't tell "never tested" from "confirmed risk," and leaks raw status tokens
- Flow / Screen: Downloaded PDF, page 4, "Genetic Carrier-Pair Overlap" card.
  `backend/src/services/pdfReport.service.js:810-843`.
- Viewport: both (PDF).
- Status: Observed — `ux3_severe_pdf_p4.png` (both partners **red**, confirmed carrier overlap) vs.
  `ux3_clean_pdf_p4.png` (both partners **gray**, i.e. never tested at all — DB-confirmed via direct
  query: `carrier_pair_risk.thalassemia.covered: false`).
- Evidence: Both screenshots show the **identical** card: heading "CARRIER TRAIT OVERLAP OBSERVED" in
  bold black on a plain white card with a muted gold left border, followed by the sentence "Thalassemia:
  Male status is RED | Female is RED." (severe) or "...Male status is GRAY | Female is GRAY." (clean) —
  i.e. a couple that was **never tested** gets a card literally titled "OVERLAP OBSERVED," worded and
  styled identically to a couple with a **confirmed, real, both-carrier risk**. The text also prints raw
  internal enum tokens ("RED"/"GRAY") verbatim instead of the polished, plain-language narrative that
  already exists in the same JSON (`carrier_pair_risk.thalassemia.narrative`: "Both partners show an
  elevated HbA2 level (Male: 4.1%, Female: 4.4%), consistent with beta-thalassemia carrier trait... please
  discuss this with a genetic counselor" — visible only via the raw API response, never rendered here).
  Root cause, precisely: `pdfReport.service.js:814` — `const isRealNonGreen = (status) => !!status &&
  status !== 'green'` — this treats `'gray'` (not-yet-assessed) exactly the same as `'red'`/`'yellow'`
  (an actual finding), so both trigger the same `hasGen` branch and the same "OVERLAP OBSERVED" heading
  at `:831`.
- UX impact: comprehension + trust — a couple who never got tested is handed a document that reads as if
  a genetic overlap was found in them; a couple with the single most serious finding in the report reads
  a one-line, jargon-coded sentence with no more visual weight than the untested case, and no plain-English
  translation of what "RED" means for their future children (the good narrative text exists, it is simply
  not the text printed here).
- Heuristic: match between system and real world; recognition over recall (no one should have to know
  that "RED" means "confirmed carrier" and "GRAY" means "not tested").
- Root cause: code — `isRealNonGreen` (`:814`) conflates two categorically different states; the card
  body at `:825/828` interpolates raw `.toUpperCase()` status enums instead of the existing narrative
  field.
- Best-fit direction: split into three distinct card treatments — a neutral "not yet assessed" state for
  gray/gray, the existing "ALL CLEAR" green state, and a genuinely alarming (bold red border, warning
  icon, plain-language narrative pulled from `carrier_pair_risk.thalassemia.narrative`, explicit "talk to
  a genetic counselor" CTA) state for red — never a shared heading across all three.
- Effort: M
- Blast radius: same file's hemoglobin-variant card (identical pattern, `:827-828`) and any other domain
  using a similar tri-state (`green`/`yellow or red`/`gray`) status vocabulary.

### [P1] UX3-04 — The single most severe finding in "Tracked Markers" is styled identically to a routine caution
- Flow / Screen: Story tab, "Tracked Markers" sidebar. `story/page.js:519-526` (`getThreadState` for
  `'genetics'`), `:531-544` (`getThreadBadgeStyle`).
- Viewport: both.
- Status: Observed — `ux3_severe_story_desktop.png` (right sidebar, third row).
- Evidence: For the `severe` couple, "Future kids' genetic baseline" correctly shows state "Needs
  attention" (the only thread state this component ever assigns to a real red flag). But
  `getThreadBadgeStyle('Needs attention')` (`:539-540`) returns the **same** `bg-amber-50
  text-(--amber-d)` badge and amber dot as `'Steady watch'` (`:537-538`) — the mild, generic "keep an eye
  on it" tier used elsewhere for things like a borderline cholesterol trend. There is no red/critical
  tier anywhere in this function. The row itself is collapsed by default (`expandedThreads: {}`), sits
  third in a plain vertical list next to two green "Resolved" rows, and requires a click to reveal even
  the (correct, well-written) narrative text. Nothing about its position, color, icon, or default state
  signals "this is the most important thing on this page."
- UX impact: visual hierarchy — exactly the brief's concern: a severe result can get visually buried
  among routine-looking cards. Here it does, one component away from a couple who will decide whether to
  have children based partly on this report.
- Heuristic: visibility of system status; recognition over recall; visual hierarchy / emphasis.
- Root cause: design/code — `getThreadBadgeStyle` (`:531-544`) has only four tiers (Resolved/Improving/
  Steady watch/Needs attention/default), and the worst two share one visual treatment.
- Best-fit direction: add a fifth, genuinely critical tier (rose/red background + bold border + warning
  icon) reserved for `sti_gate.triggered`-class and confirmed-both-carrier-class findings; auto-expand
  that row by default and float it to the top of the list regardless of alphabetical/insertion order.
- Effort: M
- Blast radius: `getThreadBadgeStyle` (shared by every thread row) + thread ordering logic.

### [P1] UX3-05 — A "Trigger Mock Report" debug affordance is exposed, ungated, inside the live report
- Flow / Screen: Report → Organ Wellness tab, empty state. `frontend/src/app/core-engine/usg/page.js:311-317,
  332-338` (buttons), `:142-268` (`triggerMockRadiology`, the handler they call).
- Viewport: both — re-verified on `sti` mobile (`ux3_sti_usg_mobile.png`) and desktop
  (`ux3_sti_usg_desktop.png`, `ux3_severe_usg_desktop.png`).
- Status: Observed — both screenshots above show, directly under each partner's real "Upload PDF" button,
  a plain underlined text link reading "Trigger Mock Report." Clicking it (per code) POSTs a
  fully-fabricated radiology payload (hardcoded varicocele/PCOS/fatty-liver findings, `usg/page.js:158-240`)
  straight into that couple's real match record via `/api/radiology/report`.
- UX impact: trust — in a health product, any visible control that can inject synthetic clinical
  findings into a real report — with no lock icon, no "dev only" label, no confirmation dialog, styled as
  a normal secondary link — undermines "is this my actual data" for the exact couples (any couple with no
  radiology yet, which includes all three seeded couples here) who are most likely to encounter it.
- Heuristic: error prevention; match between system and real world (a real health record with a one-click
  fake-data injector inside it).
- Root cause: code — no environment gate (`process.env.NODE_ENV`/feature flag) around the button render
  at `usg/page.js:311-317, 332-338`.
- Best-fit direction: remove from the shipped build, or gate behind an explicit internal/QA flag so it
  cannot render for a real user session.
- Effort: S
- Blast radius: `usg/page.js` only.

### [P1] UX3-06 — PDF's side-by-side comparison table marks untested parameters "HEALTHY"
- Flow / Screen: Downloaded PDF, page 3, "Partner Health Comparison" table.
  `backend/src/services/pdfReport.service.js:645-676`.
- Viewport: both (PDF).
- Status: Observed — `ux3_severe_pdf_p3.png`: "Liver Health Enzymes / Not tested / **HEALTHY**", "Kidney
  Function / Not tested / **HEALTHY**", "Hormonal Baseline / Not tested / **HEALTHY**", "Vitamins &
  Micronutrients / Not tested / **HEALTHY**", "Waist Circumference / Not Uploaded / **HEALTHY**" — five
  rows in one table where the visible text says the parameter was never measured, immediately next to a
  green "HEALTHY" badge implying it was checked and came back fine.
- Evidence / root cause, precisely: each row default at `:652-655` reads
  `mStatus: bh.liver?.male_status || 'green'` and `mText: bh.liver?.male_value || 'Normal'` — when the
  domain object (`bh.liver`, etc.) is simply absent because nothing was uploaded, the code silently
  substitutes `'green'`/`'Normal'` rather than a distinct "not assessed" state, and `getBadgeLabel`
  (`:670-676`) then renders that defaulted green as "Healthy." This is the same fabricate-a-default-for-
  missing-data shape as the already-known engine finding WS1D01 (unscanned organ scores 100) — cited by
  ID only; this instance is a separate, presentation-layer occurrence in the PDF template, not the same
  code path.
- UX impact: comprehension + trust — a reader skimming this table for reassurance sees five "HEALTHY"
  badges in a row that are actually "we don't know," which is the opposite of what a premarital health
  screen exists to surface.
- Heuristic: match between system and real world; error prevention (silent defaults masquerading as data).
- Root cause: code — `:652-655` defaults absent status/value to green/"Normal" instead of a "Not
  assessed" status distinct from a real green.
- Best-fit direction: default missing domains to a `'gray'`/"Not assessed" status and route them through
  the same gray badge already used correctly two rows below for "Sugar levels not yet tested" / "Not
  Assessed" (page 1 and 2 already do this right for two other domains — this table just needs to match
  that existing pattern).
- Effort: S-M
- Blast radius: `pdfReport.service.js` comparison table rows for liver/kidney/hormones/vitamins/waist.

### [P1] UX3-07 — The AI Counselor can explain the sensitive finding well, but nothing prompts a user to ask
- Flow / Screen: Report → "Consult AI Counselor" drawer, all tabs. `frontend/src/components/ReportChatDrawer.js:7-26`
  (`DEFAULT_SUGGESTIONS`), `:183-194` (`getWelcomeMessage`).
- Viewport: both (drawer chrome identical; desktop floating trigger vs. mobile bottom-nav "Chat AI" tab
  per the existing nav system, ref WS2).
- Status: Observed (drawer chrome + welcome message: `ux3_severe_chat_open_desktop.png`); Observed via
  direct backend call for reply quality — see UX3-13.
- Evidence: For every engine tab, the welcome message and the four suggested-question chips are static
  and generic ("Explain my glycemic risk simply," "Is my cholesterol level alarming?" for `chronic`;
  fertility/AMH-themed for `mfr`; liver/kidney-themed for `usg`). None of the four chips, on any tab,
  reference the couple's actual reactive screening result or carrier finding — a user has to
  independently think to type something like "should we be worried about anything" to ever reach the
  content demonstrated in UX3-13. The quota banner ("Counselor chat: 5/5 left") gives no signal that this
  is where the report's most important unexplained information lives.
- UX impact: comprehension/friction — the one place in the product that *does* communicate the sensitive
  finding well is opt-in, undiscoverable, and rate-limited (5 messages), so it functions as a lucky
  escape hatch rather than a reliable communication channel.
- Heuristic: help & documentation should be discoverable, not just present; recognition over recall.
- Root cause: IA/copy — `DEFAULT_SUGGESTIONS` (`ReportChatDrawer.js:7-26`) is hardcoded per `engineType`
  and has no awareness of `sti_gate`/`carrier_pair_risk` at all.
- Best-fit direction: when `sti_gate.triggered` or a red carrier status exists, replace the welcome
  message and lead suggested-question chip with one that names the specific finding
  ("Ask about your Hepatitis B screening result"), so discovery isn't dependent on guessing. See
  OPP-UX-31.
- Effort: S
- Blast radius: `ReportChatDrawer.js` suggestion/welcome logic; `layout.js`'s `combinedContextMetadata`
  (`:122-133`) already contains the raw finding, so no new plumbing is needed.

### [P2] UX3-08 — Score status pill color is hardcoded regardless of the ring's own severity color
- Flow / Screen: Story tab, "Health Together Index" card. `story/page.js:294-307` (`scoreBand`/
  `ringStrokeColor`), `:826-832` (status pill).
- Viewport: both.
- Status: Observed — `ux3_severe_story_desktop.png`: the progress ring is drawn in the red/danger stroke
  color (`#E0555B`, correct for a 42 score, `scoreBand === 'Worth attention'`), but the pill directly
  beneath it, "WATCH SYNERGY," is rendered in the calm mint/teal palette
  (`bg-(--soft-teal) border border-(--teal)/25 text-(--teal-d)`) used for every band.
- UX impact: aesthetic + comprehension — the two elements of the same small card disagree with each
  other at a glance; a user scanning quickly (the ring) gets the correct alarm signal, then the label
  right under it visually contradicts it.
- Heuristic: consistency; visibility of system status.
- Root cause: code — the pill's className at `:828` is a static string; only its text content
  (`scoreBand === 'Strong' ? ... : ...`) varies with severity, not its color classes.
- Best-fit direction: derive the pill's background/text/border classes from the same `scoreBand`/
  `ringStrokeColor` logic already computed one function up.
- Effort: S
- Blast radius: `story/page.js` score card only.

### [P2] UX3-09 — "Your Health Story" always opens by calling the couple's starting point "healthy and cooperative"
- Flow / Screen: Story tab narrative. `story/page.js:310-315` (`generateChapterProse`, `year === 0`
  branch).
- Viewport: both.
- Status: Observed — identical opening sentence confirmed verbatim across all three couples: "Right now,
  your paths converge at a healthy and cooperative starting point" appears in `ux3_clean_story_desktop.png`,
  `ux3_sti_story_desktop.png`, and `ux3_severe_story_desktop.png` alike (also in the corresponding
  `_full.log` text dumps).
- Evidence: `story/page.js:314-315` — `if (year === 0) { paragraphs.push(\`This is the story of
  ${namesText}... Right now, your paths converge at a healthy and cooperative starting point...\`); }` —
  this line is unconditional; every downstream sentence in the paragraph does branch on
  `isMfrGood`/`isChronicGood`/etc., but the opening line itself never does.
- UX impact: emotional design / tone — for the `severe` couple (score 42, confirmed genetic carrier
  overlap) the very first sentence of their "Health Story" flatly asserts the opposite of the report's
  own finding, directly ahead of the "Needs attention" thread three inches away on the same screen.
- Heuristic: match between system and real world.
- Root cause: copy — hardcoded opening sentence with no severity branch.
- Best-fit direction: branch the opening sentence on the same `baselineScore`/`scoreBand` already
  computed on this page, reserving "healthy and cooperative" language for genuinely high-scoring couples.
- Effort: S
- Blast radius: `story/page.js` `generateChapterProse` only.

### [P2] UX3-10 — The headline score card's loading state is gated on the wrong flag
- Flow / Screen: Story tab, "Health Together Index" card, first paint after navigating in.
  `story/page.js:71-76` (match-details fetch, no exposed loading flag), `:79-99` (`radLoading`, a
  *different* fetch), `:834-845` (score card empty/loading branch).
- Viewport: both.
- Status: Observed — reproduced twice live: a fresh `sti` load at a 2s wait, and a fresh `clean` load at a
  4s wait, both rendered "Complete an assessment to see your combined score." (with a plain info icon,
  not a spinner) for an already-completed match with a real stored score, before a longer wait resolved
  to the correct "50 PTS / WATCH SYNERGY" (`sti`, confirmed on retry with a 4s wait). Root cause
  confirmed in code, not just timing: the branch at `:836-843` shows a spinner and "Loading your
  results…" only `if (radLoading)` — a boolean that belongs to the separate radiology fetch
  (`:79-99`) — and otherwise falls straight to "Complete an assessment to see your combined score.",
  regardless of whether `activeMatchDetails` (the actual source of `baselineScore`, fetched at `:71-76`)
  has finished loading or genuinely has nothing to show. The Timeline Projection tooltip has the same
  symptom (renders "–" instead of a number) for the same root cause.
- UX impact: comprehension — for a couple checking a sensitive result, several seconds of "Complete an
  assessment to see your combined score" on a report that already has one is a plausible source of
  needless alarm ("did our data get lost?"), and is indistinguishable from the correct empty state for a
  couple that truly hasn't run an assessment yet.
- Heuristic: visibility of system status.
- Root cause: code — wrong loading flag referenced at `story/page.js:836`.
- Best-fit direction: expose a `matchDetailsLoading` flag from `fetchActiveMatchDetails` in
  `CompatibilityContext.js` and gate this card's spinner/copy on that instead of `radLoading`.
- Effort: S
- Blast radius: `story/page.js` score card + Timeline Projection tooltip; `CompatibilityContext.js`
  (`fetchActiveMatchDetails`, `:469-482`) needs the new state.

### [P2] UX3-11 — Chronic Risk tab is dense with unexplained jargon and demo-only affordances, shown identically to the healthy couple
- Flow / Screen: Report → Chronic Risk tab. `frontend/src/app/core-engine/chronic/page.js:141`
  ("Validated · CURES cohort" chip), `:264` ("Uncalibrated · relative ordering" chip), `:271`
  (dashed-amber "How much your routines shape each other" panel), `:386-419` ("Calibration scaffold" +
  "Log assessment (Demo)" button + a literal data table with column headers "IDRS A / IDRS B / Index /
  State / Flagged / Outcome").
- Viewport: both — confirmed present for `clean` (`ux3_clean_chronic_desktop.png`, content well was
  blank for this couple due to the seed-shape gap noted above, but the static jargon/demo elements around
  it render regardless of couple data since they don't depend on `chronicResult.projection`).
- Evidence: even before any data renders, the tab surfaces "IDRS" (never expanded/defined on-page),
  a chip reading "Uncalibrated · relative ordering" with a warning-triangle icon, a dashed amber-bordered
  box titled "How much your routines shape each other" that reads like a caution banner, and a literal
  "Log assessment (Demo)" button sitting in a "Calibration scaffold" section with an "Outcome: pending"
  table row — all of this is internal engineering/validation scaffolding (the tab's own adjacent
  disclosure at `chronic/page.js:376-383` already frames the score honestly as "a wellness heuristic...
  not independently validated," which is good; the scaffold/demo elements are a separate, rawer layer on
  top of that) exposed verbatim to a couple trying to read their health report.
- UX impact: comprehension — this is the brief's "unnecessary anxiety or confusion for the clean couple
  too" case: a healthy couple lands on amber warning-styled chips and a "Demo" button with no bearing on
  their actual result, adding cognitive load and a faint sense of unfinishedness without any payoff.
- Heuristic: recognition over recall; aesthetic and minimalist design; match between system and real
  world (a "Demo" control in a live report).
- Root cause: design/copy — internal validation/calibration language and controls were left in the
  couple-facing build.
- Best-fit direction: move the "Uncalibrated" methodology disclosure into a single, calmly-worded
  footnote (the tab already has one two lines below, `:381-383`, which is well-written) and remove the
  "Log assessment (Demo)" table/button from the shipped couple view entirely.
- Effort: M
- Blast radius: `chronic/page.js` only.

### [P3] UX3-12 — "Strong" and "confidence in the good news" overload two different meanings across the PDF
- Flow / Screen: Downloaded PDF, pages 1, 2, and 6. `pdfReport.service.js:523` (label),
  `:955-959, 965-969, 975-979` (three "Strong" badges).
- Viewport: both (PDF).
- Status: Observed — `ux3_clean_pdf_p1.png`/`ux3_sti_pdf_p1.png`/`ux3_severe_pdf_p1.png` all show the
  identical stat label "CONFIDENCE IN THE GOOD NEWS" regardless of whether the news is in fact good (the
  `sti` and `severe` covers both show it unchanged next to "Action Advised" and a 42/50 score); page 6
  (`ux3_severe_pdf_p6.png`) shows "Strong" as the badge for a data-completeness state (see UX3-02) while
  page 1 shows "STRONG" as the badge for a genuinely good fertility result on the same document.
  A reader has to infer from context which meaning is intended each time.
- UX impact: aesthetic/consistency — small on its own, but compounds the trust problem in UX3-02 by
  reusing positive-sounding vocabulary for a neutral, data-completeness meaning.
- Heuristic: consistency & standards.
- Root cause: copy — one label ("CONFIDENCE IN THE GOOD NEWS") and one badge word ("Strong") each carry
  two different meanings depending on context.
- Best-fit direction: rename the completeness label to something outcome-neutral ("Data completeness" /
  "How much we've checked"), and reserve "Strong" exclusively for a good clinical result, using a
  different word ("Complete"/"On file") for "we have this domain's data."
- Effort: S
- Blast radius: `pdfReport.service.js` labels only.

### [P3 · positive] UX3-13 — The AI Counselor, when reached, explains sensitive findings accurately and with appropriate gravity
- Flow / Screen: `POST /api/chat/message` (chat.controller.js:78-168), tested directly against the live
  `sti` and `severe` sessions (bypassing the UI send button, which did not register in headless
  automation — see caveat below).
- Viewport: n/a (backend-verified; drawer chrome itself confirmed on desktop, `ux3_severe_chat_open_desktop.png`).
- Status: Observed — two direct API calls, reusing the real session context each couple's report page had
  already built (via `combinedContextMetadata`, `layout.js:122-133`, which embeds the raw
  `chronicResult.details.male_data` including the reactive HBsAg field and both partners' HbA2 values).
  For `sti`, asked "What does my score actually mean?": reply named the couple by name, correctly stated
  the score, then: *"there's one important thing to mention: your HBsAg test came back 'Reactive,' which
  means you're carrying the hepatitis B virus... Isha should get tested and vaccinated if she hasn't
  already... Sharing this early shows trust and builds a stronger foundation."* For `severe`, asked "Be
  honest, should we be worried about anything before we get married?": reply correctly named the 6.9%
  HbA1c, both partners' elevated HbA2 (thalassemia trait risk to children), the lower fertility outlook,
  and closed with "I'd encourage you to tackle these as a team... before finalizing big decisions" —
  matching the system prompt's explicit instruction (`chat.controller.js:130-133`) to never explicitly
  advise against marriage while still being honest about severe findings.
- UX impact: positive — this is the one surface in the product that gets the sensitive-finding tone
  exactly right: specific, warm, honest, appropriately serious, and correctly avoids either false alarm
  or false reassurance.
- Caveat (Suspected, not filed as a defect): the first message sent in a fresh burst of requests failed
  with an immediately-reset connection twice during this session (once per couple tested); a same-session
  retry succeeded both times in under 10 seconds. Given this shared dev environment is under concurrent
  load from multiple parallel review agents, this could not be conclusively root-caused as a product bug
  vs. environment contention. Where it does happen, the drawer's existing error state ("Failed to send
  message or fetch AI reply. Please try again." + a Retry button, `ReportChatDrawer.js:313-320`) degrades
  gracefully rather than hanging silently — worth a backend follow-up, not a UX fix.
- Effort: — (positive finding; see UX3-07 for the actionable gap this highlights)
- Blast radius: —

---

## Opportunities (WS3)

- **OPP-UX-31 ★** (fixes UX3-01, UX3-04, UX3-07): give the STI-gate and confirmed-carrier findings one
  first-class, always-visible, correctly-tiered home in the Story tab's Tracked Markers — auto-expanded,
  genuinely red/critical styled — and use the same trigger to seed the AI Counselor's opening message and
  lead suggested-question chip. All the underlying data already exists in `presentation_json`; this is a
  wiring exercise, not new computation. Effort M. Impact: very high — closes the single biggest
  comprehension gap this workstream found.
- **OPP-UX-32** (fixes UX3-02, UX3-03, UX3-06, UX3-12): build one shared "domain status" resolver used by
  both the web report and the PDF that (a) always considers `sti_gate` and `carrier_pair_risk` alongside
  `body_health` when deciding whether to downgrade an overall status/color, and (b) gives "not yet
  tested" its own distinct neutral treatment instead of reusing the templates built for "confirmed good"
  or "confirmed bad." Effort M-L. Impact: high — fixes the internal contradictions at their structural
  root once, instead of patching each symptom (score/status mismatch, "overlap observed" on untested
  data, "HEALTHY" on untested parameters) separately.
- **OPP-UX-33** (fixes UX3-08, UX3-09): make the Story tab's score badge color and opening narrative
  sentence severity-aware by reusing the `scoreBand` the ring itself already computes, so the two most
  emotionally-loaded elements on the page (the badge under the ring, the first line of prose) can never
  again visually contradict the ring right next to them. Effort S. Impact: medium — a small, cheap fix
  that removes two of the clearest "cheerful default undercuts a serious finding" moments found in this
  pass.

---

## Appendix — screenshots & scripts (this workstream)
- Driver: `backend/scratch/ux3_drive.js` (dashboard → Recent card → story/mfr/chronic/usg/genomics tabs
  + AI Counselor open/send, both viewports); session helper `backend/scratch/ux3_mint_sessions.js`
  (mints fresh tokens for the existing seeded `uid`/`matchId` rows without touching `users`/`matches`,
  to avoid disturbing other agents mid-review); DB read-only inspector `backend/scratch/ux3_inspect_db.js`;
  PDF fetch + render `backend/scratch/ux3_pdf_shot.js` (PyMuPDF/`qlmanage`, since the available headless
  Chromium build has no PDF viewer and downloads instead of rendering PDFs inline).
- Full page-text dumps: `backend/scratch/ux3_{clean,sti,severe}_desktop_full.log`,
  `ux3_sti_mobile_full.log`.
- Screenshots: `backend/scratch/ux_shots/ux3_*` — dashboard, story, mfr, chronic, usg, genomics tabs for
  all three couples at both viewports (mfr/chronic content wells not evaluable, see seed-limitation note
  above); `ux3_{clean,sti,severe}_pdf_p1..p6.png` (full 6-page PDF renders, one per couple);
  `ux3_severe_chat_open_desktop.png` (AI Counselor drawer chrome).
