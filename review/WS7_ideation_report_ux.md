# WS7 — Ideation: Engaging & Interactive Report Experience

**Scope:** Evidence-grounded UX/product ideation for the SlayHealth premarital "Partner Sync" report
surfaces. READ-ONLY. Every idea is anchored to code that exists today (`file:line`) and to data the
engines already compute. Audience is **the couple together** (Partner Sync framing) — there is no
clinician/counselor view, so sensitive findings must be presentable to two people looking at one screen.

**Stack reality (per `frontend/AGENTS.md`):** Next.js 16.2.9 / React 19.2.4 / Tailwind 4. All report
surfaces are `'use client'` components driven by `useState`/`useEffect` and a shared
`CompatibilityContext`. Interactivity below is proposed as client-side state recomputing from
already-fetched projection curves (no server round-trips) unless explicitly marked "needs new backend".
Tailwind 4 arbitrary-property syntax (`bg-(--teal)`, `text-(--amber-d)`) is already the house style and
is reused in every proposal.

**ID scheme:** `OPP-W7-NN` per `review/_review_schema.md`. Each entry carries the schema's opportunity
fields plus the fields the brief asked for: real page/data `Location`, `Impact`, `Effort (S/M/L)`,
`Reskin vs. New backend`, and a rank.

---

## Cross-cutting finding that drives half of these ideas

The report already generates a warm, couple-facing, safety-aware narrative layer, but **the interactive
web report throws almost all of it away.**

- The AI presentation (`backend/src/services/compatibility/aiPresentation.service.js:22-91`) produces
  `relationship_snapshot.description`, `couple_synthesis`, `strengths[]`, `opportunities[]` (STI findings
  forced first), per-organ `body_health` cards with `headline`/`narrative`/`clinical_footnote`/`badge`,
  `carrier_pair_risk`, and a dedicated **`sti_gate` object** with a responsibly-worded
  `headline`/`narrative`/`clinical_footnote`/`badge` ("All clear" | "Worth a look").
- `backend/src/controllers/compatibility.controller.js:370-391` wraps this into `ai_narrative.hero`,
  `top_insights[]`, `body_cards`, `recommendations`, `closing_message`.
- A `grep` across `frontend/src/app/core-engine/**` for `ai_narrative | couple_synthesis |
  relationship_snapshot | strengths | opportunities | body_health | sti_gate` returns **nothing.** Only
  the PDF (`backend/src/services/pdfReport2.service.js:457`) consumes them.
- Instead, `frontend/src/app/core-engine/story/page.js:291-389` (`generateChapterProse`) **hand-writes
  prose from string templates** and only reads `presentation_json.carrier_pair_risk` +
  `report_confidence.domains.genetic.covered` from the rich object.

Consequence for a couple: the interactive report can never tell them about a reactive STI (the PDF does),
and the whole "story" is generic template copy rather than the couple-specific AI synthesis that already
exists in `activeMatchDetails.presentation_json`. Most WS7 wins are therefore **reskins that surface data
already fetched**, not new modeling.

A second structural issue: the headline KPI on the story page is computed **client-side and independently**
of the server's gated composite. `story/page.js:151-211` (`calculateDynamicScore`) blends chronic 35% /
MFR 25% / mental 20% / radiology 10% / genetics 10% and **never applies the STI safety gate**, whereas the
authoritative `compiled_compatibility_score` is capped at 50 on a reactive STI in
`backend/src/services/compatibility/reportGeneration.service.js:118-126`. So the big "Health Together Index"
ring (`story/page.js:767-800`) can read "Strong / 85" while the real gated score is 50. That is both a
correctness bug (out of WS7 scope) and the single most important KPI-hierarchy fix below.

---

## Ranked master list (impact × effort)

Rank = impact-first, then effort (a high-impact reskin outranks a high-impact new-backend build).

| Rank | ID | Title | Impact | Effort | Reskin vs New |
|---|---|---|---|---|---|
| 1 | OPP-W7-02 | Gate the interactive Health Together Index (STI cap parity) | High (safety/trust) | S | Reskin |
| 2 | OPP-W7-01 | Surface the existing AI narrative + `sti_gate` in the web report | High (trust/safety) | M | Reskin |
| 3 | OPP-W7-07 | Confidence-uplift ladder as re-engagement engine | High (activation) | S | Reskin |
| 4 | OPP-W7-04 | Make the current-vs-optimised "dividend" the headline lever | High | S | Reskin |
| 5 | OPP-W7-06 | Restructure KPI hierarchy: lead with meaning, disclose the number | High | M | Reskin |
| 6 | OPP-W7-11 | Private-first reveal for STI / carrier-pair findings | High (safety) | M | Reskin |
| 7 | OPP-W7-03 | Named lifestyle scenario toggles on the projection | High | M | Reskin + small backend |
| 8 | OPP-W7-14 | Consent-gated section sharing (reuse invite/consent infra) | Med-High | M | Reuses backend, small new |
| 9 | OPP-W7-08 | "Recompute after you act" 90-day retest loop | Med-High | M | Reskin + small backend |
| 10 | OPP-W7-05 | Per-domain "what changes if…" mini-levers | Med | S | Reskin |
| 11 | OPP-W7-12 | Two-person consent-to-reveal gate ("reveal together") | Med | S | Reskin |
| 12 | OPP-W7-13 | Reframe blame-prone copy to shared, non-attributed language | Med | S | Reskin |
| 13 | OPP-W7-09 | Chaptered narrative pacing (scroll-driven reveal) | Med | M | Reskin |
| 14 | OPP-W7-16 | Partner-invite completion loop from the report | Med | S | Reskin |
| 15 | OPP-W7-10 | Animate/annotate the "cost of waiting" number | Med | S | Reskin |
| 16 | OPP-W7-15 | Post-report "share your win" (non-clinical) card | Low-Med | S | Reskin |
| 17 | OPP-W7-17 | Scenario compare mode (overlay two futures on one chart) | Med | M | Reskin |
| 18 | OPP-W7-18 | Genetics carrier-pair Punnett explainer (progressive) | Med | S | Reskin |
| 19 | OPP-W7-19 | "Log assessment" calibration → real recompute history | Low-Med | L | New backend |
| 20 | OPP-W7-20 | Unified year-scrubber + act/don't fork across all tabs | Med | M | Reskin |

---

# 1. KPI hierarchy — what should be headline vs progressively disclosed

### Current assessment (what the story page leads with vs buries)

- **Leads with:** a numeric "Health Together Index" ring, 0-100, band "Strong/Steady/Worth attention",
  as a sticky top-right card (`story/page.js:752-821`). It is the first thing the eye lands on and it is
  the *client-side, ungated* composite (`story/page.js:151-211`).
- **Buries:** the couple-specific meaning. `presentation_json.couple_synthesis` and
  `relationship_snapshot.description` (`aiPresentation.service.js:28,25`) — the two sentences that actually
  say "what this means for your marriage and starting a family" — are never shown. The generic
  `generateChapterProse` template runs instead (`story/page.js:291-389`).
- **Buries dangerously:** any reactive STI. The `sti_gate` object exists but is not rendered on web at all.
- **Under-uses:** `report_confidence.band`/`overall` (`reportSummary.service.js:274-286`) — the honesty
  signal ("Solid/…") — appears on the mobile dashboard hero but not on the story report.

### OPP-W7-02 — Gate the interactive Health Together Index to match the server composite
- **Rationale:** The headline KPI (`story/page.js:213` `targetScore`, rendered at `:797`) can show a
  reassuring "Strong 85 — Excellent Synergy" for a couple whose authoritative
  `compiled_compatibility_score` is capped at 50 by the STI gate
  (`reportGeneration.service.js:118-126`). A couple can literally read "Excellent Synergy" on the exact
  report that should be flagging a reactive HIV/HBV/HCV/syphilis result.
- **Inputs needed:** Already available. `activeMatchDetails.presentation_json.sti_gate.triggered` (and the
  gated `compiled_compatibility_score`) are already in the fetched match object
  (`CompatibilityContext.js:466-479`). Either read the server's gated score directly for the "Today"
  headline, or apply `Math.min(score, 50)` in `calculateDynamicScore` when `sti_gate.triggered`.
- **Benefit:** Closes a safety/trust gap; the headline number can never contradict the STI finding.
- **Effort:** S — a few lines in `calculateDynamicScore` + a band recolor.
- **Reskin vs new:** Reskin (data already fetched).
- **Risk / claim considerations:** Must keep the projection-year branch honest — a future-year projection
  shouldn't imply an STI "heals" by Year 3. Cap should hold across all slider positions while the finding
  stands.

### OPP-W7-06 — Restructure the KPI hierarchy: lead with meaning, progressively disclose the number
- **Rationale:** For a couple, "what does this mean for us" beats a bare 0-100. Today the number is
  primary and the meaning is templated.
- **Inputs needed:** Already available in `presentation_json`: `relationship_snapshot`
  (score/status/description/color), `couple_synthesis`, `strengths[]`, `opportunities[]`
  (`aiPresentation.service.js:22-36`), and `report_confidence.band` (`reportSummary.service.js:274-286`).
- **Benefit:** Headline becomes a one-line human verdict + confidence band; the numeric ring becomes a
  supporting detail the couple can expand. Reduces "score anxiety," raises comprehension.
- **Proposed hierarchy (tier order):**
  1. Headline: `relationship_snapshot.description` (one warm sentence) + status chip + confidence band.
  2. Secondary: the Health Together Index ring (`story/page.js:767-800`) — kept, demoted, gated per W7-02.
  3. Progressive: `strengths` (3) shown; `opportunities` collapsed behind "What's worth a conversation"
     with STI/critical items pinned first (they already sort first in the array).
  4. Detail-on-demand: the existing `tracked markers` list (`story/page.js:980-1079`).
- **Effort:** M — new top section on the story page; the tracked-markers accordion pattern already exists
  to copy.
- **Reskin vs new:** Reskin.
- **Risk / claim considerations:** Keep the "estimate, not a verdict" footer (`story/page.js:1127-1129`)
  adjacent to the demoted number.

### OPP-W7-04 — Make the current-vs-optimised "dividend" the headline lever, not a buried subcard
- **Rationale:** The most motivating number the engines produce is *the gap you can close*. It already
  exists but is understated: MFR `dividend = cumOptY - cumCurY` (`mfr/page.js:59`), chronic
  "How much you can improve together: +N points potential" (`chronic/page.js:293-303`), and
  `improvement_plan.expectedScoreImprovement` 1-15 (`aiPresentation.service.js:68`).
- **Inputs needed:** Already available (all three computed client-side / in presentation).
- **Benefit:** Turns a static ring into a "you can gain +X" call-to-action — the single strongest hook for
  a one-time report ("here's what acting is worth to you two").
- **Effort:** S — surface an existing computed delta as a headline stat with the existing `RevealedCount`
  animator (`story/page.js:18-47`).
- **Reskin vs new:** Reskin.
- **Risk / claim considerations:** Label as potential/modelled, not a guarantee; the chronic layer is
  already flagged "Uncalibrated · relative ordering" (`chronic/page.js:264`) — carry that caveat.

---

# 2. Static → interactive

The scaffolding for interactivity is already rich: a shared year scrubber
(`layout.js:319-351`, `story/page.js:848-894`), an "If you act on this / If you don't" fork
(`story/page.js:896-929`, state `isAct` at `:62`), an MFR current-vs-optimised SVG chart with hover
tooltips (`mfr/page.js:64-370`), and a chronic dual-trajectory Recharts chart (`chronic/page.js:309-376`).
What's missing is **named, causal levers** the couple can toggle.

### OPP-W7-03 — Named lifestyle scenario toggles on the projection ("if you both quit smoking / lose weight / start now vs wait")
- **Rationale:** The MFR engine already derives the exact levers from the couple's inputs
  (`mfr/page.js:374-382`: "Quit smoking" if `smoking_habits !== 'never'`, "Optimise body weight/BMI" if
  BMI>25, "Increase physical activity" if `Sedentary`, "Reduce alcohol", "Increase intercourse
  frequency"), and it already computes the fully-optimised curve (`projection.optimised`,
  `p_12m_optimised` at `mfr/page.js:665`). The chronic engine exposes a shared lifestyle index `L`
  (`mfr/page.js:646` `lifestyle_index`) and a `lambda_current` vs `lambda_optimised` frequency modifier
  (`mfr/page.js:647`). The "act / don't act" binary fork (`story/page.js:896-929`) is the crude version of
  this; toggles make it granular and personal.
- **What it is:** Replace the binary fork with per-lever chips ("Quit smoking", "Reach healthy BMI",
  "Start trying now vs wait 3 years") that interpolate between the `current` and `optimised` curves and
  redraw the ring/chart live. "Start now vs wait" reuses the existing year scrubber semantics (the
  "cost of waiting" is already `cumCur0 - cumCurY`, `mfr/page.js:391`).
- **Inputs needed:** *Mostly available.* Current and optimised endpoints already exist; a first version can
  linearly blend between them per number of levers enabled — no backend. *Needs new backend* only if you
  want a physically-correct per-lever recompute (each lever's individual effect on `L`/`lambda`), which
  means exposing the engine's per-factor decomposition.
- **Benefit:** Converts a passive chart into a "what if we…" simulator — the strongest engagement mechanic
  for a report a couple opens once. Directly ties to modifiable inputs the engine already accepts.
- **Effort:** M (blend version) / L (true per-lever recompute).
- **Reskin vs new:** Reskin for the blend; small new backend for exact per-lever deltas.
- **Risk / claim considerations:** If using a blend approximation, label the intermediate states as
  "illustrative"; only the fully-current and fully-optimised endpoints are engine-exact.

### OPP-W7-05 — Per-domain "what changes if…" mini-levers inside each tracked-marker card
- **Rationale:** The tracked-markers accordions (`story/page.js:1005-1077`) already reveal a per-domain
  number via `revealDetail()`. Chronic's recoverable "dividend" (`chronic/page.js:293-303`) and MFR's
  optimised delta are per-domain and already computed.
- **What it is:** Inside each expanded marker, a single toggle "show optimised path" that swaps the revealed
  number between `current[selectedYear]` and `optimised[selectedYear]` (the code already branches on `isAct`
  at `story/page.js:534,558`) — but expose it as a local per-card control, not just the global fork.
- **Inputs needed:** Already available.
- **Benefit:** Localizes agency ("for *our fertility*, quitting smoking is worth +X%") without leaving the
  card.
- **Effort:** S.
- **Reskin vs new:** Reskin.

### OPP-W7-17 — Scenario compare mode: overlay two chosen futures on one chart
- **Rationale:** The MFR chart already draws two polylines (current dashed + optimised solid,
  `mfr/page.js:205-219`) and the chronic chart draws four lines (`chronic/page.js:365-369`). The rendering
  supports overlays already.
- **What it is:** Let the couple pin "Scenario A" (e.g. wait 3 years, no change) vs "Scenario B" (start now,
  optimised) and render both as labelled overlays with the delta called out — reusing the existing hover
  tooltip infra (`mfr/page.js:322-367`).
- **Inputs needed:** Already available (both curves + year index).
- **Benefit:** Makes the trade-off visceral and comparative rather than a single toggled state.
- **Effort:** M.
- **Reskin vs new:** Reskin.

### OPP-W7-10 — Animate and annotate the "cost of waiting"
- **Rationale:** `mfr/page.js:557-568` already shows "Loss in success rate by waiting N years: -X%" as a
  static card, and the formula trace is spelled out (`mfr/page.js:697-701`).
- **What it is:** Tie that number to the year scrubber with the existing `RevealedCount` counter
  (`story/page.js:18-47`) so dragging the slider visibly "burns down" the couple's conception chance —
  a concrete, honest urgency cue.
- **Inputs needed:** Already available.
- **Effort:** S.
- **Reskin vs new:** Reskin.
- **Risk / claim considerations:** Keep it factual; avoid alarmist color until the value crosses the
  engine's own thresholds (85 / 60, already encoded at `mfr/page.js:229-233`).

---

# 3. Responsible presentation of sensitive findings to a couple on one screen

Three sensitivities: (a) the **STI safety gate** (`reportSummary.service.js:125-207`), which flags a
*specific partner* as reactive and caps the score; (b) **thalassemia carrier-pair** status
(`story/page.js:136-148`, `presentation_json.carrier_pair_risk`); (c) **chronic risk asymmetry** — the
chronic page already literally plots "how far apart your health baselines are" with each partner's initial
on a red-amber gradient (`chronic/page.js:214-229`), which can single out the less-healthy partner in
front of the other.

### OPP-W7-11 — Private-first reveal for partner-attributed sensitive findings (STI, carrier status)
- **Rationale:** The STI gate finding is *partner-specific* (`detail: "…Reactive for ${partnerLabel}"`,
  `reportSummary.service.js:147-197`) and severity `critical`. Showing "Partner (Male): HIV Reactive" on a
  shared screen is a disclosure event that can cause harm. The AI layer already prepared a gentler,
  non-attributed couple-facing wrapper (`sti_gate.headline`/`narrative`/`badge`,
  `aiPresentation.service.js:75-82`) — but nothing renders it.
- **What it is:** For any `severity: critical` / STI finding, the shared report shows only the
  *non-attributed* couple-level message ("One screening needs a specialist conversation before you plan
  next steps — details are private to the person it concerns") and routes the *attributed clinical detail*
  to that partner's private surface (their own login / the private mobile view, whose trust copy already
  promises "Nothing is shared with your partner or family until you say so", `MobileHomeView.js:169`).
- **Inputs needed:** Mostly available — `sti_gate` + per-partner `findings[].partner`. *Needs* a per-viewer
  identity check on the report (which partner is looking) to decide attributed vs non-attributed; the app
  already knows `user` vs `prospectForm` (`layout.js:90-91`).
- **Benefit:** Lets the couple see *that* something needs a doctor without forcing an involuntary
  disclosure of *whose* result it is on a shared screen.
- **Effort:** M.
- **Reskin vs new:** Reskin for the copy; small new logic for viewer-aware gating.
- **Risk / claim considerations:** This is the highest-stakes screen in the product. Never auto-share the
  attributed finding; make disclosure an explicit action by the affected partner. Keep "Seek specialist
  consultation immediately" wording the engine already mandates (`aiPresentation.service.js:203`).

### OPP-W7-12 — Two-person "reveal together" consent gate before opening sensitive sections
- **Rationale:** The report is designed to be viewed jointly; sensitive sections shouldn't spring open by
  accident. The accordion pattern (`story/page.js:1022-1038`) already gates content behind a click.
- **What it is:** Sensitive tiles (STI, carrier-pair) render collapsed with a neutral badge and a
  "Reveal — we'll open this together" tap, plus a one-line context ("This section discusses screening
  results. Open it when you're both ready."). Reuses the existing `expandedThreads` state.
- **Inputs needed:** Available.
- **Effort:** S.
- **Reskin vs new:** Reskin.

### OPP-W7-13 — Reframe blame-prone copy to shared, non-attributed language
- **Rationale:** Several surfaces attribute risk to a named individual in front of the partner: the chronic
  "how far apart your baselines are" gradient with partner initials on a red end (`chronic/page.js:221-227`),
  and per-partner IDRS/"what drove it" cards (`chronic/page.js:190-206`). For a couple, "your habits pull
  the household down" reads as blame.
- **What it is:** Default the shared view to *couple-level* framing ("your shared household trajectory",
  which the couple-influence band already uses, `chronic/page.js:271-307`) and move per-person attribution
  behind an opt-in "see individual breakdown" toggle. The `sti_gate`/`carrier_pair_risk` narratives from
  the AI layer are already written in warm, non-blaming second person — reuse them verbatim.
- **Inputs needed:** Available (`presentation_json` narratives; couple-band already computed).
- **Effort:** S (copy + one toggle).
- **Reskin vs new:** Reskin.
- **Risk / claim considerations:** Preserve clinical accuracy — non-attribution is a *presentation* default,
  not data suppression; the individual breakdown stays one tap away.

### OPP-W7-18 — Carrier-pair explainer as progressive disclosure (not a bare percentage)
- **Rationale:** `genomicsReveal()` (`story/page.js:136-148`) already maps thalassemia status to
  50/75/100 with labels ("Needs attention"/"Worth a look"/"Clear"), and `carrier_pair_risk.thalassemia`
  carries a `narrative` + `clinical_footnote` (`aiPresentation.service.js:71`). Showing "50%" cold to a
  couple invites misreading it as "50% our child is affected."
- **What it is:** Reveal in layers — badge → one-sentence plain narrative → optional "what carrier-pair
  means" (the existing `genetic_note`, `aiPresentation.service.js:73`) → optional 1-in-4 Punnett visual
  only when both are red.
- **Inputs needed:** Available.
- **Effort:** S.
- **Reskin vs new:** Reskin.

---

# 4. Progressive disclosure & narrative pacing

The report already has the raw material for a paced narrative: `ai_narrative.hero`, `top_insights[]`,
`body_cards`, `recommendations`, `closing_message` (`compatibility.controller.js:370-391`), plus a
chapter-ish structure in `generateChapterProse` (baseline → Year N → per-domain paragraphs,
`story/page.js:291-389`).

### OPP-W7-01 — Surface the existing AI narrative + `sti_gate` in the interactive report
- **Rationale:** (See cross-cutting finding.) The couple-specific `ai_narrative.hero` /
  `couple_synthesis` / `strengths` / `opportunities` / per-organ `body_health` cards / `sti_gate` are
  computed and stored (`reportGeneration.service.js:224,245`) but only the PDF renders them
  (`pdfReport2.service.js:457`). The web "story" instead shows generic templates.
- **What it is:** Replace / augment `generateChapterProse` with the real AI content already present in
  `activeMatchDetails.presentation_json` / `ai_narrative`:
  - Hero paragraph → `ai_narrative.hero` (`compatibility.controller.js:371`).
  - "Your Health Story" chapters → `couple_synthesis` + `body_health.*.narrative` per domain.
  - Strengths/opportunities lists → `strengths[]` / `opportunities[]` (STI pinned first).
  - A rendered STI-gate block → `sti_gate` (subject to the private-first rule, W7-11).
- **Inputs needed:** Already available — the story page already fetches the whole `presentation_json`
  (it reads `carrier_pair_risk` and `report_confidence` from it, `story/page.js:137,196`).
- **Benefit:** The interactive report finally reflects the couple's actual data in warm language, and the
  STI finding stops being web-invisible. Highest trust/quality lift for the least modeling work.
- **Effort:** M — wiring existing fields into existing card components; keep template prose as fallback
  when `presentation_json` is absent (older matches).
- **Reskin vs new:** Reskin.
- **Risk / claim considerations:** Guard for matches created before `presentation_json` existed
  (`reportGeneration.service.js` sets it, but the DB column defaults NULL,
  `postgres.service.js:216`) — fall back to the current templates.

### OPP-W7-09 — Chaptered, scroll-driven narrative pacing
- **Rationale:** The five story sections already animate in with staggered `animationDelay`
  (`story/page.js:757,826,950,983,1084`), but everything renders at once. A one-time premarital report is a
  moment; pacing the reveal raises comprehension and emotional weight.
- **What it is:** Turn the sections into sequential "chapters" (Snapshot → Family planning → Body health →
  Genetics → Path forward) that reveal on scroll or a "Next chapter" tap, each capped by its own
  `top_insight`. Reuse the existing `fadeInUp` keyframes and `displayedProse` cross-dissolve
  (`story/page.js:394-404`).
- **Inputs needed:** Available.
- **Effort:** M.
- **Reskin vs new:** Reskin.
- **Risk / claim considerations:** Keep an "expand all / skip to summary" affordance — some couples want the
  bottom line immediately; don't trap the composite behind scrolling.

---

# 5. Shareability with consent

There is already a robust consent + share-link substrate to build on: token invites with an explicit
consent screen (`invite/[token]/page.js:299-357`, `POST /api/invite/consent`,
`invite.controller.js:265`), a copy/share-link UI with `navigator.share` fallback
(`add-prospect/page.js:830-854`, `getInviteLink()` at `:740-742`), a live status timeline
(`add-prospect/page.js:820-888`), revoke (`/api/invite/revoke/:id`), and a PDF export already token-gated
(`layout.js:294-304`).

### OPP-W7-14 — Consent-gated sharing of *specific* report sections
- **Rationale:** Today sharing is all-or-nothing at onboarding; there is no way to share, say, only the
  "family planning" chapter with a parent or a doctor while keeping STI/mental sections private. The
  couple owns the data ("private to the two of you", `story/page.js:1128`), so section-level consent is the
  natural next step.
- **What it is:** A "Share report" action on the story page that lets the couple tick which sections to
  include (Snapshot / Family planning / Body health / Genetics — **STI and mental default OFF**), then mints
  a scoped, expiring read-only link — reusing the token + `expires_at` machinery already in
  `prospect_invites` (`invite.controller.js:111-118`) and the copy/share UI at
  `add-prospect/page.js:835-854`.
- **Inputs needed:** *Reuses* the invite/token/consent backend; *needs* a small new "shared_report" record
  (section allowlist + token) and a public read-only render route. The section content all comes from the
  existing `presentation_json`.
- **Benefit:** Safe sharing with family/doctor without exposing sensitive sections; a natural virality loop
  that stays consent-first.
- **Effort:** M.
- **Reskin vs new:** Reuses backend patterns; small new endpoint + public view.
- **Risk / claim considerations:** STI/carrier/mental must be excludable and off by default; log consent;
  honor revoke; expire links. Do not put clinical PII in the URL.

### OPP-W7-15 — Post-report "share your win" card (non-clinical)
- **Rationale:** The `strengths[]` and `relationship_snapshot.status` are positive, non-sensitive, and
  couple-flattering ("Excellent Synergy", `story/page.js:805`).
- **What it is:** An opt-in shareable image/card summarizing *only* the non-clinical positive framing
  ("We did our premarital health check together"), no scores/markers. Reuses `navigator.share`
  (`add-prospect/page.js:844`).
- **Inputs needed:** Available (`strengths`, snapshot status).
- **Effort:** S.
- **Reskin vs new:** Reskin.
- **Risk / claim considerations:** Zero clinical values on the shared artifact; strictly opt-in.

### OPP-W7-16 — Partner-invite completion loop surfaced from the report
- **Rationale:** When one partner's domain is missing, the report already lists `pendingDomains`
  (`story/page.js:656-664`) and the closing card says "Once your {domain} results are in, we'll add that
  chapter." (`story/page.js:1100-1105`). The invite mechanism to get the partner to contribute already
  exists end-to-end.
- **What it is:** Turn each pending-domain line into an actionable "Invite {partner} to add this" CTA that
  deep-links into the existing invite flow (`/add-prospect`), or a "Copy their link" if an invite is already
  active (`add-prospect/page.js:740`).
- **Inputs needed:** Available.
- **Effort:** S.
- **Reskin vs new:** Reskin.

---

# 6. Engagement mechanics appropriate to a one-time premarital report

The right frame: this is **not** a daily-habit app. Mechanics should drive (a) completing the picture,
(b) acting on advice then recomputing, and (c) looping the partner in — not streaks.

### OPP-W7-07 — Confidence-uplift ladder as the re-engagement engine
- **Rationale:** The backend already computes exactly the "add this to raise your confidence by N points"
  ladder: `report_confidence.domains` with `blood_tests.uplift_if_verified: 16`, `genetic.uplift: 11`,
  `radiology.uplift: 6`, `mental.uplift: 5` and an `overall`/`band`
  (`reportSummary.service.js:274-286`). The dashboard already has the CTA pattern — "Add Mental
  Wellbeing"/"Stress Resilience" routing to `/add-prospect?enter=mental` (`layout.js:105`), the mobile
  "next best action = heaviest untouched section" (`MobileHomeView.js:40-43`), and the "Reliable at 70%"
  gauge (`MobileHomeView.js:88`).
- **What it is:** On the story report, a compact "Make this report more confident" strip showing the
  current band and the ranked missing domains with their exact point uplift ("Add radiology: +6",
  "Verify bloodwork: +16"), each linking to its capture flow (`?enter=radiology`, etc., pattern at
  `MobileHomeView.js:151`).
- **Inputs needed:** Already available (`report_confidence` is in `presentation_json`).
- **Benefit:** Concrete, honest completion driver tied to real numbers — the best re-engagement lever for a
  one-time report, and it doubles as an upsell surface (radiology is a paid domain, `dashboard/page.js:116`
  `price: '₹999'`).
- **Effort:** S.
- **Reskin vs new:** Reskin.
- **Risk / claim considerations:** Frame as "confidence in the estimate", not "your health improved by N".

### OPP-W7-08 — "Recompute after you act" 90-day retest loop
- **Rationale:** The report already promises a retest ("Track your progress with a retest in 90 days",
  `compatibility.controller.js:390`; `improvement_plan.retests`, `aiPresentation.service.js:66`) and
  quantifies the payoff (`improvement_plan.expectedScoreImprovement` 1-15,
  `aiPresentation.service.js:68`). The chronic page even has a "Log assessment (Demo)" calibration scaffold
  (`chronic/page.js:378-411`).
- **What it is:** A "Come back after you act" module: set a 90-day reminder, and on return let the couple
  re-upload fresh bloodwork/lifestyle → recompute → show *actual* movement vs the predicted
  `expectedScoreImprovement`. Reuses the existing PDF/match compile path.
- **Inputs needed:** *Mostly available* — recompute reuses existing match creation; *needs* a lightweight
  reminder + a "previous vs now" delta store (the calibration scaffold anticipates this,
  `chronic/page.js:386-389`).
- **Benefit:** Converts a one-shot report into a two-touch loop with a built-in payoff metric; strongest
  retention mechanic that fits the premarital context.
- **Effort:** M.
- **Reskin vs new:** Reskin for recompute; small new backend for reminder + delta.
- **Risk / claim considerations:** Compare like-for-like inputs; label predicted vs actual clearly.

### OPP-W7-19 — Turn the "Log assessment" calibration scaffold into a real recompute history
- **Rationale:** `chronic/page.js:378-411` already renders a calibration table (IDRS A/B, Index, State,
  Flagged, Outcome=pending) with a disabled "Log assessment (Demo)" button and honest copy that the couple
  layer "earns calibration only by capturing inputs against outcomes over time".
- **What it is:** Make it real — persist each assessment's de-identified feature set + index, and show the
  couple their own history/trend across visits.
- **Inputs needed:** *Needs new backend* (persistence + outcome capture).
- **Benefit:** Long-term model credibility + a reason to return; but it's the heaviest lift here.
- **Effort:** L.
- **Reskin vs new:** New backend.
- **Risk / claim considerations:** De-identification and consent for outcome tracking; this is a data-model
  commitment, not a UI tweak.

### OPP-W7-20 — Unify the year-scrubber + act/don't fork as one persistent control across all tabs
- **Rationale:** There are currently *two* separate scrubbers with different stop sets: the layout's shared
  scrubber for chronic/mfr uses `selectedProjYear` over `[0,3,5,7,10]` (`layout.js:319-351`), while the
  story page has its own `selectedYear` (`story/page.js:63`) and its own act/don't fork
  (`story/page.js:896-929`). They don't sync, so a couple's "what if" choice resets between tabs.
- **What it is:** Promote year + scenario (act/levers) into `CompatibilityContext` as shared state so a
  choice made on the story page persists into the fertility/chronic detail tabs — one coherent "future"
  the couple carries through the whole report.
- **Inputs needed:** Available (`selectedProjYear` is already in context, `layout.js:41`; the story page
  just uses a local copy).
- **Benefit:** Coherent, continuous interactive experience instead of per-tab resets.
- **Effort:** M.
- **Reskin vs new:** Reskin.
- **Risk / claim considerations:** Keep the story page's 5-stop set and the layout's aligned.

---

## Notes on stack constraints honored

- All interactive proposals are client-side `useState`/`useEffect` recomputations over already-fetched
  curves (`projection.current` / `projection.optimised` / `idrsA/B`) inside existing `'use client'`
  components — no assumptions about App-Router server components or data-fetching idioms that changed in
  Next.js 16.
- No proposal depends on deprecated React patterns; the existing counters/animations
  (`RevealedCount`, `fadeInUp`) and Recharts/SVG renderers are reused as-is.
- New-backend items are explicitly isolated (W7-14 share record, W7-08 reminder/delta, W7-19 calibration
  persistence, W7-03 exact per-lever recompute). Everything else is a reskin over data already present in
  `activeMatchDetails.presentation_json` / `ai_narrative` / the engine results in context.
