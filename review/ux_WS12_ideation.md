# WS12 — Redesign & Enhancement Ideation

**Scope:** Generative-but-grounded UX opportunity ideation across the whole SlayHealth journey —
onboarding/activation, report comprehension, trust/consent, delight, retention, and empty/first-run
states. READ-ONLY. Every idea is anchored to code that exists today (`file:line`) and evaluated through
the **two-people / high-stakes / premarital** lens of Finding #0 (asymmetric single-account model).

**Governing rule honored:** the **mobile UI is the locked visual reference.** Nothing here restyles the
mobile design. Where an idea touches the report (which deliberately renders the desktop "Premarital Sync"
narrative on all viewports — a locked product decision per the Finding #0 Report-UI note, *not* a
reconcile item), it proposes bringing the **mobile design *language*** (WeightedGauge, ScoreBar,
MobileMiniRing, "Reliable at 70%", "biggest lever") into the report as the comprehension layer —
consistent with mobile, never a re-skin of it.

**Extends, does not duplicate WS7.** The prior pass (`review/WS7_ideation_report_ux.md`, OPP-W7-*) already
covered report interactivity: gating the interactive index (W7-02), surfacing the AI narrative + `sti_gate`
(W7-01), the confidence-uplift ladder (W7-07), current-vs-optimised dividend (W7-04), scenario toggles
(W7-03), private-first reveal (W7-11), reveal-together (W7-12), consent-gated section sharing (W7-14), and
the 90-day recompute loop (W7-08). Entries below that touch the same area say **"extends OPP-W7-xx"** and
state what is new; the rest are directions WS7 did not cover (onboarding, pairing, partner autonomy,
warmth, retention channels, first-run, the genomics stub).

**ID scheme:** `OPP-UX-NN`. Each carries rationale / user benefit / **effort (S/M/L)** / **impact**, the real
surface it builds on, **★** if it also fixes a logged defect, a reconcile-to-mobile note where relevant, and
a WS7-relationship note where relevant.

---

## Ranked master menu (impact × effort)

Rank = impact-first, then effort (a high-impact small reskin outranks a high-impact new build).

| Rank | ID | Title | Area | Impact | Effort | ★ | WS7 |
|---|---|---|---|---|---|---|---|
| 1 | OPP-UX-01 | Auto-submit OTP on 6th digit + inline "wrong number" edit | Onboarding | High | S | ★ | — |
| 2 | OPP-UX-09 | Index caption + "Reliable at N%" confidence chip on the ring | Report KPI | High | S | | extends W7-06 |
| 3 | OPP-UX-02 | WhatsApp-OTP resilience (delivery state, earlier resend, masked #) | Onboarding | High | S–M | | — |
| 4 | OPP-UX-14 | Partner "data receipt" + revoke-by-link at submit-success | Trust/consent | High | M | ★ | new (Finding #0) |
| 5 | OPP-UX-03 | Accept photos/images of reports, not PDF-only | Onboarding | High | M | ★ | — |
| 6 | OPP-UX-27 | Guided first-run empty state (3 steps to first check) | First-run | High | M | ★ | — |
| 7 | OPP-UX-16 | Partner-facing view of their *own* results (no account) | Trust/consent | High | M–L | ★ | new (Finding #0 + safety) |
| 8 | OPP-UX-10 | Self-explaining ring: mobile WeightedGauge breakdown on tap | Report KPI | High | M | | extends W7-06 |
| 9 | OPP-UX-15 | Granular per-data-type consent at submission | Trust/consent | High | M | | new (Finding #0) |
| 10 | OPP-UX-26 | Auto-nudge stalled invites (partner + inviter) | Retention | High | M | ★ | extends W7-16 |
| 11 | OPP-UX-23 | Turn NotificationBell into a real re-engagement channel | Retention | High | M | | extends W7-07/08 |
| 12 | OPP-UX-08 | Provisional (lifestyle-only) match before pathology upload | Onboarding | High | M | | — |
| 13 | OPP-UX-04 | De-emphasize + relabel the "use a mock report" escape hatch | Onboarding | Med-High | S | ★ | — |
| 14 | OPP-UX-07 | One-tap prefilled WhatsApp send of the invite link | Onboarding | Med-High | S | | — |
| 15 | OPP-UX-11 | Surface the "biggest lever" line in the report | Report KPI | Med-High | S | | — |
| 16 | OPP-UX-17 | Legible consent: "what {inviter} sees / what stays private" | Trust/consent | Med-High | S | ★ | — |
| 17 | OPP-UX-05 | Make the processing wait honest (real milestones, no scare copy) | Onboarding | Med-High | M | | — |
| 18 | OPP-UX-13 | Report disclosure order: verdict → confidence → number → detail | Report KPI | Med-High | M | | extends W7-06 |
| 19 | OPP-UX-29 | Genomics "Coming Soon" → credible teaser + working waitlist | First-run | Med-High | M | ★ | distinct from W7-18 |
| 20 | OPP-UX-24 | Post-marriage annual couple-health re-check opt-in | Retention | Med-High | M | | new |
| 21 | OPP-UX-06 | Surface "you must upload your own bloodwork" up front | Onboarding | Med | S | ★ | — |
| 22 | OPP-UX-12 | Replace opaque band words with a plain-language legend | Report KPI | Med | S | ★ | relates W7-02 |
| 23 | OPP-UX-30 | First-class "Waiting on {partner}" card for partial pairings | First-run | Med | S | ★ | — |
| 24 | OPP-UX-31 | Report empty-states name the gap + its confidence cost | First-run | Med | S | | extends W7-07 |
| 25 | OPP-UX-28 | One-time coach-mark explaining the confidence gauge | First-run | Med | S | | — |
| 26 | OPP-UX-19 | "Take a breath" pacing before a sensitive reveal | Delight | Med | S | | extends W7-12 |
| 27 | OPP-UX-20 | Extend the warmth/trust-message voice into report + dashboard | Delight | Med | S | | — |
| 28 | OPP-UX-21 | Celebrate the *act* of checking together (not the numbers) | Delight | Med | S | | distinct from W7-15 |
| 29 | OPP-UX-25 | Life-event recompute triggers (trying-to-conceive, diagnosis) | Retention | Med | M | | extends W7-08 |
| 30 | OPP-UX-18 | Consent expiry + "still ok?" re-confirmation for stored data | Trust/consent | Med | M | | new (Finding #0) |
| 31 | OPP-UX-22 | Reward section completion via the existing gauge animation | Delight | Low-Med | S | | — |

---

# 1. Onboarding / activation — reduce funnel drop-off

**Funnel reality (grounded):** the activation path is `landing → phone → WhatsApp OTP → name/relation/ETA →
splash → dashboard → add-prospect (profile + PDF upload) → pair (self-entry or invite link) → processing
wait → report`. The fragile joints are the **OTP step** (WhatsApp-only, no auto-submit), the **PDF-only
upload wall**, the **decoupled processing wait**, and **pairing** (manual link, late-discovered
"upload-your-own-first" gate).

### OPP-UX-01 — Auto-submit OTP on the 6th digit + inline "wrong number" edit ★
- **Builds on:** `login/page.js` — `submitOtp` fires only on the button (`:234`), yet the field is already
  populated by paste (`handleOtpPaste :130`), the "Paste code" button (`:444`), and a silent clipboard read
  on tab-focus (`:144-161`). The back button on the OTP step *wipes* the entered code
  (`onBack :425 → setAuthOtp('')`).
- **Idea:** when `authOtp.length === 6 && !isAuthLoading`, verify automatically (the WhatsApp code is
  already auto-read on focus, so this closes the loop to zero taps). Render the field as a 6-box segmented
  input for legibility. Replace the code-wiping back button with an inline "Wrong number? Edit" that returns
  to the phone step **preserving** the number.
- **Benefit:** removes a tap and a foot-gun at the single highest-abandonment step; a returning user who
  copies the code from a WhatsApp notification is verified the instant they switch back.
- **Effort:** S. **Impact:** High (activation). **★** addresses OTP friction + the code-wipe defect.
- **Reconcile:** mobile-native; no divergence.

### OPP-UX-02 — WhatsApp-OTP delivery resilience
- **Builds on:** OTP is delivered over **WhatsApp, not SMS** (`login/page.js:99-104`, subtitle "Sent via
  WhatsApp to {phone}" `:421`), so OS SMS-autofill can never see it, and the resend is locked for a full
  **60 s** (`setCooldown(60) :199,:223`) with no channel choice and the number not shown for correction.
- **Idea:** (a) show a clear "Sent to WhatsApp · {masked number}" state with an "Open WhatsApp" affordance;
  (b) surface a lightweight "Didn't get it?" reassurance before the 60 s elapses (keep the resend rate-limit,
  but don't leave the user staring at a dead 60 s counter with no code); (c) note an alternate path if
  WhatsApp is unavailable.
- **Benefit:** WhatsApp-only delivery is a silent drop-off — a user with no code and a locked resend simply
  leaves. This is acute for the two-person case where *both* people must clear OTP.
- **Effort:** S–M. **Impact:** High.

### OPP-UX-03 — Accept photos / images of reports, not PDF-only ★
- **Builds on:** both upload paths hard-reject anything but `application/pdf` — account-holder
  `handleFileUpload` (`add-prospect/page.js:945-948`) and `handleRadiologyUpload` (`:358`), the invite
  `handleSubmit` gate (`invite/[token]/page.js:191`), and every file input is `accept=".pdf"`
  (`add-prospect/page.js:1561-1564`, `invite/[token]/page.js:593,605`). OCR already exists
  (`backend/src/services/ocr/ocrProvider.js`).
- **Idea:** accept JPG/PNG/HEIC and multi-image capture (phone camera), routed through the existing OCR
  pipeline; keep PDF as the happy path.
- **Benefit:** the target audience routinely holds a *paper* lab report and photographs it. PDF-only is a
  hard activation wall precisely at the most valuable input (bloodwork). Removing it likely lifts completion
  more than any copy change.
- **Effort:** M (OCR infra exists for PDFs; add image intake + camera affordance). **Impact:** High.
- **★** addresses the PDF-only upload barrier. **Reconcile:** camera-first capture suits the mshell; mobile-consistent.

### OPP-UX-04 — De-emphasize and relabel the "use a mock report" escape hatch ★
- **Builds on:** the upload step offers "Use a mock report instead" as a visible underline directly under the
  primary upload on the account-holder path (`add-prospect/page.js:1154-1161`, wired to `triggerMockData` /
  `triggerMockRadiology`) and as a peer checkbox on the invite path (`invite/[token]/page.js:463-475,501-513`).
- **Idea:** for a health product, a one-tap path to *fabricated* clinical data both corrupts the couple's
  report and — if a partner notices "mock" data on a shared screen — torches trust. Move it behind a small
  "Don't have it handy?" disclosure, label it unambiguously as **sample/demo data that won't reflect real
  health**, and never present it as a peer of the real upload.
- **Benefit:** protects data integrity and the credibility of the result the couple is about to make life
  decisions on.
- **Effort:** S. **Impact:** Med-High. **★** mock-data prominence is a trust defect.

### OPP-UX-05 — Make the processing wait honest and reassuring
- **Builds on:** `AnalysisLoadingScreen` advances 6 hard-coded steps on a fixed 1400 ms timer, decoupled from
  real work, holding on the last step until navigation (`AnalysisLoadingScreen.js:8-17,35-45`), and warns
  **"Please don't close this page — your report is on its way."** (`:107`) with no time estimate — for a wait
  that can outrun or underrun the fake steps.
- **Idea:** tie step advancement to real backend milestones (the invite path already streams status via SSE,
  `add-prospect/page.js:624-658`); add an honest "~30–60 sec" range; and replace the alarming "don't close"
  with "This keeps running even if you step away — we'll notify you when it's ready" (leaning on
  NotificationBell, OPP-UX-23).
- **Benefit:** the wait is a fragile moment (two people watching one spinner); honesty + a real ETA + a
  "you can leave" release reduce abandonment.
- **Effort:** M. **Impact:** Med-High.

### OPP-UX-06 — Surface the "you must upload your own bloodwork" requirement up front ★
- **Builds on:** in the invite flow the account holder only discovers they must upload their *own* pathology
  PDF at the very end — as an amber warning under a disabled Run-match button
  (`add-prospect/page.js:923-927`: "⚠️ Please upload your own Pathology PDF first to run the scan").
- **Idea:** move this to the moment they pick "Generate a link" — a two-person checklist ("You: bloodwork ⬜ ·
  {partner}: bloodwork ⬜") that stays visible while they wait for the partner, so the requirement is known
  early, not discovered at the finish line.
- **Benefit:** prevents the dead-end where the partner has finished but the match can't run because the
  inviter never uploaded — a common two-person stall.
- **Effort:** S. **Impact:** Med. **★** addresses the late-surfaced requirement.

### OPP-UX-07 — One-tap prefilled WhatsApp send of the invite link
- **Builds on:** sharing is manual copy/paste or a generic `navigator.share` with a fixed string
  (`add-prospect/page.js:747-767`, `getInviteLink :738`).
- **Idea:** add a "Send on WhatsApp" button using a `wa.me` deep link with a warm, prefilled message naming
  the partner and explaining what the link is. WhatsApp is already the product's trusted channel (it's the
  OTP transport), so this meets the couple where they are.
- **Benefit:** cuts pairing to one tap on the channel the audience actually uses; fewer links lost in
  copy/paste.
- **Effort:** S. **Impact:** Med-High. (New vs W7-16, which surfaced invite CTAs *in the report*; this is the
  send mechanism itself.)

### OPP-UX-08 — Provisional (lifestyle-only) match before the pathology upload
- **Builds on:** a match cannot be created until About + Lifestyle + Pathology are all 100%
  (`add-prospect/page.js:1351-1357` `isPersonReady`; primary button disabled on `!ready`). Pathology (a PDF)
  is the hardest step and gates *all* output. A `ProvisionalBadge` component already exists
  (`frontend/src/components/ProvisionalBadge.js`).
- **Idea:** offer a "Preview your compatibility (lifestyle-only)" provisional result computed from
  About + Lifestyle, with bloodwork honestly flagged pending, that upgrades to the full gated composite on
  upload.
- **Benefit:** delivers a taste of value *before* the highest-friction step — a classic drop-off reducer for
  a couple who aren't sure the effort is worth it yet.
- **Effort:** M (needs a provisional compute path + clear "provisional" framing). **Impact:** High.
- **Reconcile:** use the mobile confidence gauge + ProvisionalBadge to keep "provisional" honest.

---

# 2. KPI hierarchy & report comprehension (in the mobile design language)

**What the report leads with today:** a bare **"Health Together Index"** ring, 0–100 with a "pts" label and
one of three opaque band chips — **"Excellent Synergy / Moderate Synergy / Watch Synergy"**
(`story/page.js:759-807`) — captioned only "Combined vitality score based on current data" (`:764`). The
**mobile** surfaces already speak a far more self-explaining KPI dialect: the WeightedGauge (arc length =
each section's weight, fill = progress, center confidence %, `WeightedGauge.js`), the ScoreBar
(`ScoreBar.js`), the "Reliable at 70%" threshold and "N of 5 sections" (`MobileHomeView.js:88-90`), and
"{lever} is your biggest lever" (`:91`). **The opportunity is to import that mobile *vocabulary* into the
report as the explanatory layer around the (kept, locked) ring** — this is exactly the area-2 brief and is
consistent with the mobile design language, not a re-skin of mobile.

### OPP-UX-09 — Index caption + "Reliable at N%" confidence chip on the ring (extends OPP-W7-06)
- **Builds on:** the ring renders a naked number and band with no meaning line (`story/page.js:797-807`);
  the mobile hero already pairs its score with a "Reliable at 70%" honesty chip (`MobileHomeView.js:88`,
  `RELIABLE_THRESHOLD`).
- **What's new vs W7-06:** W7-06 proposed *restructuring* the hierarchy to lead with meaning and demote the
  number. Because Finding #0 locks the report layout, this keeps the ring exactly where it is and just adds,
  directly beneath "pts", (a) a single plain-language verdict sentence and (b) the **mobile confidence-band
  chip** ("Reliable at N%") as the honesty signal — the smallest change that makes the number legible without
  moving it.
- **Benefit:** the ring stops being an anxiety-inducing bare score; the couple immediately reads what it
  means and how much to trust it.
- **Effort:** S. **Impact:** High. **Reconcile:** imports the mobile confidence chip verbatim.

### OPP-UX-10 — Self-explaining ring: mobile WeightedGauge breakdown on tap (extends OPP-W7-06)
- **Builds on:** the report ring is a single opaque figure (`story/page.js:774-799`); the mobile WeightedGauge
  already shows *which* sections drive a score and by how much (arc length = weight, `WeightedGauge.js:41-61`).
- **What's new vs W7-06:** rather than re-authoring the narrative, add an expand-on-tap "How is this
  calculated?" that renders the **existing mobile WeightedGauge / ScoreBar** components inside the report,
  decomposing the index into per-domain weight + fill.
- **Benefit:** turns "why is our number 62?" into an inspectable answer ("fertility is 25% of the score and
  it's the low arc") — comprehension and trust in one move.
- **Effort:** M (reuse `WeightedGauge.js` / `ScoreBar.js` in the report). **Impact:** High.
- **Reconcile:** this is the area-2 instruction — bring the mobile design language into the report; consistent, not a restyle.

### OPP-UX-11 — Surface the "biggest lever" line in the report
- **Builds on:** the mobile home already computes and shows "{leverName} is your biggest lever"
  (`MobileHomeView.js:42-43,91`). The report never names the single highest-impact action for the couple.
- **Idea:** add a one-line "Your biggest lever together: X" to the report, derived from domain weights /
  the improvement dividend (which W7-04 surfaces).
- **Benefit:** gives the couple one clear focus instead of a wall of domains — the mobile app's best
  orientation device, missing from the report.
- **Effort:** S. **Impact:** Med-High. (Complements W7-04's dividend; this is the mobile lever framing.)

### OPP-UX-12 — Replace the opaque band words with a plain-language legend ★
- **Builds on:** the status chip reads "Excellent Synergy / Moderate Synergy / **Watch Synergy**"
  (`story/page.js:805`). "Watch Synergy" is jargon, and on an STI-capped report it can read as reassuring
  next to a capped 50.
- **Idea:** pair each band with a plain sentence and align its color to the mobile TONE_COLORS system; on a
  gated/critical result the band copy must not sound like praise.
- **Benefit:** comprehension + safety (a couple should never misread a capped, serious result as "excellent").
- **Effort:** S. **Impact:** Med. **★** band opacity is a comprehension defect. (Relates to W7-02, which gates
  the *number*; this fixes the *label*.)

### OPP-UX-13 — Report disclosure order: verdict → confidence → number → domains → detail (extends OPP-W7-06)
- **Builds on:** the report presents the ring, timeline, and cards roughly co-equally
  (`story/page.js:750-889`). The mobile home models a clean hierarchy: headline + "Reliable at 70%" + "N of 5
  sections" + biggest lever, then the section list (`MobileHomeView.js:85-152`).
- **What's new vs W7-06:** a concrete *ordering spec* expressed in the mobile vocabulary that the existing
  report cards can be reflowed into **without** changing the locked visual language: (1) one-line verdict,
  (2) confidence chip, (3) the ring (kept, gated per W7-02), (4) per-domain WeightedGauge breakdown
  (OPP-UX-10), (5) tracked-marker detail on demand.
- **Benefit:** a legible reading path instead of a flat dashboard; matches the mental model the mobile app
  already teaches.
- **Effort:** M. **Impact:** Med-High.

---

# 3. Trust & consent — closing the Finding #0 partner-autonomy gap

**The gap (Finding #0):** consent is **one-time and coarse** — a single accept/reject covering metrics +
pathology + radiology + mental (`invite/[token]/page.js:337-353`), after which the partner has **no view and
no control**: their flow terminates at a static "Details Submitted!" screen (`:277-297`) and only the account
holder ever sees output. WS7 addressed how the *report* presents sensitive findings (W7-11 private-first,
W7-12 reveal-together, W7-14 inviter-side section sharing). The entries here address the *partner's* side —
the smallest changes that materially improve partner autonomy **without building full second accounts.**

### OPP-UX-14 — Partner "data receipt" + revoke-by-link at submit-success ★
- **Builds on:** the prospect's journey ends at a static confirmation with zero ongoing visibility or control
  (`invite/[token]/page.js:277-297`); the token still exists, and the invite already carries consent
  metadata + `expires_at` (per Finding #0 invite infra).
- **Idea:** extend that screen to (a) summarize exactly what they shared (which metrics + which reports),
  (b) restate plainly that results go to {inviter}'s dashboard, and (c) give a persistent, token-scoped
  "Manage / withdraw my data" link that lets them request deletion later.
- **Benefit:** the cheapest single step toward real partner autonomy — converts a one-time "accept" into a
  standing, revocable relationship, with **no login to build**.
- **Effort:** M (add a withdraw endpoint + a token-scoped manage view; the token/expiry plumbing exists).
- **Impact:** High. **★** directly addresses Finding #0's "no retraction, no partner control."

### OPP-UX-15 — Granular per-data-type consent at submission
- **Builds on:** consent is all-or-nothing (`invite/[token]/page.js:337-353`); the submission already sends
  metrics, pathology, optional radiology, and optional mental as separable fields
  (`handleSubmit :199-228`).
- **Idea:** let the partner tick what they will share (e.g. bloodwork + lifestyle yes; mental-wellbeing
  answers no). The report then shows those domains as **"withheld by {partner}"** — an honest, partner-chosen
  gap — rather than silently missing.
- **Benefit:** genuine section-level control by the person whose data it is; a partner uneasy about the
  21-question psychometric can still contribute the clinical essentials.
- **Effort:** M. **Impact:** High. (Distinct from W7-14, which is the *inviter* sharing outward; this is the
  *partner* controlling inward at capture.)

### OPP-UX-16 — Partner-facing view of their *own* results (lightweight, no account) ★
- **Builds on:** only the account holder sees output (Finding #0); the STI gate and thalassemia carrier
  status are *partner-attributed* and severe (per WS7 cross-cutting note). The OTP/WhatsApp transport and
  token pattern already exist (`login/page.js`, invite tokens).
- **Idea:** at submission, let the partner optionally enter their own phone to receive a WhatsApp link to a
  private, token-scoped view of **their own domain results only** — not the couple composite, not the
  inviter's data.
- **Benefit:** the highest-stakes autonomy + safety fix — the person whose bloodwork surfaced a reactive STI
  or carrier status learns it **themselves**, privately, rather than first hearing it from a prospective
  in-law reading the shared dashboard.
- **Effort:** M–L. **Impact:** High (Finding #0 + safety). **★**. (Complements W7-11's private-first *rendering*;
  this is the *delivery channel to the partner*, which WS7 did not cover.)

### OPP-UX-17 — Legible consent: "what {inviter} sees / what stays private" ★
- **Builds on:** the consent copy states data is matched "against {inviter}'s records"
  (`invite/[token]/page.js:330`) but never says plainly who sees the *results*; it reads as disclosure
  legalese (`:320-334`).
- **Idea:** add a compact two-column "What {inviter} will see / What stays private to you" visual on the
  consent screen, before the accept/reject buttons.
- **Benefit:** informed consent that's actually *legible*; it names the asymmetry at the exact decision point
  instead of burying it.
- **Effort:** S. **Impact:** Med-High. **★** addresses the coarse/opaque-consent gap.

### OPP-UX-18 — Consent expiry + "still ok?" re-confirmation for stored partner data
- **Builds on:** invites carry `expires_at` (Finding #0 infra) but consent, once given, is permanent — a
  prospect who didn't marry the inviter has sensitive data lingering with no re-check.
- **Idea:** a periodic (or pre-recompute, tie to W7-08 / OPP-UX-24) re-consent ping to the partner, with an
  easy "withdraw" (reuses OPP-UX-14's handle).
- **Benefit:** DPDP-aligned data minimization and partner dignity; the trust copy already promises
  DPDP-compliance (`MobileHomeView.js:169`) — this makes it real.
- **Effort:** M. **Impact:** Med.

---

# 4. Delight without trivializing sensitive content

The product already has an unusually strong warmth system to extend — the witty, name-personalized,
**category-sensitivity-dialed** trust whispers (`trustMessages.js:7-13` explicitly keeps
pathology/genomics/mental sincere and reserves wit for low-stakes sections), the Sparkles micro-card
(`QuestionScreen.js:151-163`), the branded SplashScreen fade (`SplashScreen.js:39-49`), and reduced-motion-
aware count-ups (`WeightedGauge.js:16-22`). The rule: warmth and pacing, **never gamification of a health
result** (no confetti/points/streaks on an STI or carrier finding).

### OPP-UX-19 — "Take a breath" pacing before a sensitive reveal (extends OPP-W7-12)
- **Builds on:** sensitive findings currently render immediately alongside everything else; W7-12 proposed a
  reveal-together *gate* but not its *treatment*.
- **What's new:** specify the pacing — borrow the SplashScreen's slow fade (`SplashScreen.js:39-49`) for a
  brief, calm interstitial ("Take a moment — this next part is worth reading together"), with **no** score
  animation, confetti, or celebratory motion on STI/carrier tiles.
- **Benefit:** emotional pacing appropriate to a premarital health moment; slows a disclosure that shouldn't
  spring open.
- **Effort:** S. **Impact:** Med.

### OPP-UX-20 — Extend the warmth/trust-message voice into the report + dashboard
- **Builds on:** the trust whispers appear *only* during the questionnaire (`QuestionScreen.js:50,151-163`,
  `trustMessages.js`); the dashboard and report are comparatively cold.
- **Idea:** reuse the same voice — and the same category-sensitivity dialing — for one warm, name-personalized
  line on the dashboard hero and the report's closing card. Keep pathology/genomics contexts sincere per the
  existing rules.
- **Benefit:** consistent brand warmth across the whole journey, not just onboarding.
- **Effort:** S. **Impact:** Med. **Reconcile:** reuse the existing Sparkles card pattern.

### OPP-UX-21 — Celebrate the *act* of checking together, not the numbers
- **Builds on:** report arrival is abrupt (invite path routes straight in after a 2.5 s delay,
  `add-prospect/page.js:643-648`); the SplashScreen already models a warm branded moment.
- **Idea:** a brief "You did this together" moment on first report open, reusing the SplashScreen artwork/fade
  — explicitly scoped to the **act** of completing a premarital check, never the score or findings.
- **Benefit:** honors a real relationship milestone with warmth that can't be misread as celebrating a
  clinical result. (Distinct from W7-15, a shareable *artifact*; this is the in-app moment.)
- **Effort:** S. **Impact:** Med. **Reconcile:** reuse mobile splash design language.

### OPP-UX-22 — Reward section completion via the existing gauge animation
- **Builds on:** the WeightedGauge already animates its arcs and count-up and honors
  `prefers-reduced-motion` (`WeightedGauge.js:16-22,33-61`).
- **Idea:** replay that same tasteful arc-fill when a section reaches 100% in add-prospect, so progress feels
  rewarding — momentum, not points/badges/streaks.
- **Benefit:** funnel momentum without any gamification of health data.
- **Effort:** S. **Impact:** Low-Med.

---

# 5. Retention / re-engagement (a mostly one-time report)

WS7 owns the confidence-uplift ladder (W7-07) and the 90-day "recompute after you act" loop (W7-08). These
extend those with **delivery channels** and **cadences** WS7 didn't cover, and address the biggest silent
leak in a two-person product: stalled pairings.

### OPP-UX-23 — Turn NotificationBell into a real re-engagement channel (extends OPP-W7-07/08)
- **Builds on:** the bell is deliberately limited to *invite-status* events, with a comment ruling out
  "fabricated notification types" (`NotificationBell.js:8-22`) — so there is a notification surface but
  **no reason to reopen the app** after the report.
- **What's new:** feed it a small set of honest, data-grounded nudges that already have backing numbers:
  "Add radiology to raise your confidence +6" (from `report_confidence`, the W7-07 ladder), "It's been 90 days
  since your check — retest?" (the W7-08 loop needs a *push channel*; this is it), "{partner}'s mental section
  is still pending." Deliver via the bell + optional WhatsApp.
- **Benefit:** gives W7-07/W7-08 a way to actually reach the user instead of waiting for them to return.
- **Effort:** M (derived/scheduled notifications + WhatsApp send). **Impact:** High.

### OPP-UX-24 — Post-marriage annual couple-health re-check opt-in
- **Builds on:** the product is framed premarital and simply ends after the report; the ETA-for-marriage
  field is already collected at signup (`login/page.js:406-418` `marriageTimeline`).
- **Idea:** an opt-in "first-anniversary check-up" (and annually after) that re-runs the same engines on fresh
  inputs and shows movement vs the prior baseline.
- **Benefit:** converts a one-time premarital tool into a recurring couple-health ritual — the natural
  long-horizon retention arc for this audience. (W7-08 is a 90-day *act-then-retest*; this is a lifecycle cadence.)
- **Effort:** M. **Impact:** Med-High.

### OPP-UX-25 — Life-event recompute triggers (extends OPP-W7-08)
- **Builds on:** W7-08 anchors recompute to a fixed 90-day timer; the engines already model fertility
  trajectories the couple cares about at specific life moments.
- **What's new:** trigger recompute by *relevance*, not the calendar — "Planning to start trying? Re-check your
  fertility projection with current numbers," or "New diagnosis or medication? Update your report." The app can
  ask these lightweight life-event questions and prompt at the right moment.
- **Benefit:** relevance-driven return outperforms a calendar reminder for a one-time report.
- **Effort:** M. **Impact:** Med.

### OPP-UX-26 — Auto-nudge stalled invites (extends OPP-W7-16) ★
- **Builds on:** an invite can sit indefinitely in `opened` / `consent_pending` / `questionnaire_started`
  (statuses in `add-prospect/page.js:821-825`); nothing nudges the partner *or* tells the inviter it has
  stalled. W7-16 surfaced invite CTAs in the report but not an automated recovery path.
- **Idea:** after N hours in a non-terminal state, send a gentle automatic reminder to the partner (WhatsApp)
  and a "your invite to {partner} is waiting" nudge to the inviter (NotificationBell, OPP-UX-23).
- **Benefit:** recovers the large share of two-person pairings that stall mid-flow — the single biggest silent
  funnel leak in the product.
- **Effort:** M. **Impact:** High. **★** addresses invisible invite abandonment.

---

# 6. First-run / empty-state guidance + the genomics "Coming Soon" stub

### OPP-UX-27 — Guided first-run empty state (3 steps to your first check) ★
- **Builds on:** a brand-new account (seeded `empty`) lands on the mobile home with a 0-filled WeightedGauge
  and a bare "No compatibility checks yet · Start your first check" row (`MobileHomeView.js:133-141`) — no
  orientation, no stated payoff, no sequencing.
- **Idea:** a first-run checklist/overlay — "3 steps to your first compatibility check": complete your profile
  → add your bloodwork → invite your partner — reusing the existing section list and the "biggest lever"
  framing.
- **Benefit:** first-run orientation is the highest-leverage activation fix; today the empty state is a dead
  end that assumes the user already knows the model.
- **Effort:** M. **Impact:** High. **★** addresses the unguided empty state. **Reconcile:** build in the
  mshell/section-list language.

### OPP-UX-28 — One-time coach-mark explaining the confidence gauge
- **Builds on:** the signature WeightedGauge ("Reliable at 70%", arcs sized by lever,
  `MobileHomeView.js:85-91`, `WeightedGauge.js`) is powerful but unexplained on first encounter — a new user
  sees an empty ring at a low % with no idea what "70%" or the arc sizes mean.
- **Idea:** a one-time coach-mark on first view: "Each arc is a section, sized by how much it moves your score;
  fill it to 70% for a reliable read." (The hero copy already says the first half, `:91`.)
- **Benefit:** the gauge is the product's core mental model; teaching it once pays off on every later screen.
- **Effort:** S. **Impact:** Med.

### OPP-UX-29 — Genomics "Coming Soon" → credible teaser + working waitlist ★
- **Builds on:** `core-engine/genomics/page.js` is a static dead box ("Currently Coming Soon under Premium
  plans"), and the hubs render genomics as `comingSoon: true, locked: true`
  (`add-prospect/page.js:1301-1305`, `dashboard/page.js` `healthProfileCategories`), whose "Notify me" pill
  in the section list (`MobileSectionList.js:12`) **is not wired to anything.** Meanwhile the engine already
  computes thalassemia `carrier_pair_risk` elsewhere (per WS7 cross-cutting note).
- **Idea:** make the tab a real teaser — a sample carrier-pair explainer, a plain list of what it will screen
  for (the `SUGGESTED_GENOMICS_TESTS` already exist), and a **working** "Notify me / join the waitlist" that
  captures intent (reuse the notification/consent infra).
- **Benefit:** converts a dead-end tab into demand capture + education for an audience where premarital carrier
  screening (thalassemia especially) is highly salient in India.
- **Effort:** M. **Impact:** Med-High. **★** wires the currently-inert "Notify me" pill. (Distinct from W7-18,
  which is a Punnett explainer inside an *existing* carrier result.)

### OPP-UX-30 — First-class "Waiting on {partner}" card for partial pairings ★
- **Builds on:** the `partial` seeded couple has a live pending invite and no match row, yet the dashboard's
  recent slot still shows the generic "No compatibility checks yet" (`MobileHomeView.js:133-141`) — as if
  nothing is happening.
- **Idea:** when an active invite exists, replace that empty slot with a "Waiting on {partner}" card carrying
  the live status timeline (already built, `add-prospect/page.js:815-888`) and the WhatsApp re-nudge
  (OPP-UX-26).
- **Benefit:** the most motivated users (they've already invited someone) get a real status home instead of an
  empty state implying they haven't started.
- **Effort:** S. **Impact:** Med. **★** addresses the misleading empty state for in-flight pairings.

### OPP-UX-31 — Report empty-states name the gap + its confidence cost (extends OPP-W7-07)
- **Builds on:** when a domain is missing (partner skipped mental, no radiology), the report tends to omit it
  silently; the mobile app already speaks in "N of 5 sections · +X% confidence" (`MobileHomeView.js:90,97`).
- **What's new vs W7-07:** apply the confidence-ladder vocabulary specifically to *report empty-states* — each
  absent domain shows precisely what's missing and what completing it is worth ("Radiology not added · +6%
  confidence"), turning a silent gap into an actionable, honest next step.
- **Benefit:** gaps become momentum instead of mystery; reinforces the W7-07 uplift ladder at the point of
  confusion.
- **Effort:** S. **Impact:** Med.

---

## Stack constraints honored

- Every report-facing idea respects the **locked** report layout (Finding #0 Report-UI note): it adds the
  mobile design *language* as a comprehension layer (OPP-UX-09/10/11/13/31) rather than restyling either
  surface. No mobile visual is proposed for change.
- Reuse-first: OPP-UX-10/22 reuse `WeightedGauge`/`ScoreBar`; OPP-UX-19/21 reuse `SplashScreen`; OPP-UX-20
  reuses `trustMessages` + the Sparkles card; OPP-UX-23/26/29 reuse `NotificationBell` + the invite
  SSE/token/consent infra; OPP-UX-03 reuses the OCR provider; OPP-UX-08 reuses `ProvisionalBadge`.
- New-backend items are isolated and named: OPP-UX-03 (image OCR intake), OPP-UX-08 (provisional compute),
  OPP-UX-14 (withdraw endpoint + manage view), OPP-UX-15 (per-type consent fields), OPP-UX-16 (partner
  self-view token route), OPP-UX-23/24/25/26 (scheduled/derived notifications + WhatsApp send). Everything
  else is client-side reskin/reflow over data and components already present.
