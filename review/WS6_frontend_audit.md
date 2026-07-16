# WS6 — Frontend dummy / static-data audit (post-match "Partner Sync" report surfaces)

Scope: `frontend/src/app/core-engine/{layout,story,mfr,chronic,usg,genomics}` plus the
state source `frontend/src/contexts/CompatibilityContext.js`. Read-only. Next.js 16.2.9 / React 19.

## Guard model (established once, referenced by every finding below)

`core-engine/layout.js:52-60,110` — the shared shell hard-guards on **both** `chronicResult`
AND `mfrResult`: the `useEffect` redirects to `/dashboard` if either is missing, and the render
returns `null` unless `user && chronicResult && mfrResult` are all present. Therefore every page
renders only with those two engine results loaded.

- `chronicResult` / `mfrResult` are **always fully populated** when a page renders: they come
  either from `/api/chronic/analyze` + `/api/mfr/analyze` (fresh match, `CompatibilityContext.js:623-709`)
  or from `restoreMatchSession` (`CompatibilityContext.js:722-737`, reading the saved
  `match.analysis.*`). Both projection curves are built server-side with a fixed
  `for (y=0; y<11)` loop → **always 11 entries, indices 0-10**
  (`backend/src/controllers/chronic.controller.js:277-304`, `mfr.controller.js:481-489`).
  `PROJECTION_YEARS = [0,3,5,7,10]` (all ≤10) → every `curve[year]` read is in-range.
- `mentalResult` is **optional** (may be `null`; `handleCompatibilityMatch` sets it null on every
  new scan, `CompatibilityContext.js:710`).
- `radiologyData` is **optional** — fetched per-page from `/matches/:id/radiology`.
- `activeMatchDetails` (= raw `matches` DB row incl. `compatibility_score` + `presentation_json`)
  is fetched via `fetchActiveMatchDetails` (`CompatibilityContext.js:466-479`).

This split is the crux: fallbacks fed only by `chronicResult`/`mfrResult` curves are
structurally unreachable (→ P3); fallbacks fed by the optional `mentalResult`/`radiologyData`,
or that read the wrong field name, fire on real data (→ P1/P2).

---

### [P1] WS6-01 — Story tab reads radiology via non-existent keys (`scores_json` / `risk_flags_json`); every couple silently gets a fabricated 25/30 organ score and a "completely standard organ anatomy" all-clear
- Area: frontend
- Location: `frontend/src/app/core-engine/story/page.js:189-190, 368, 488, 598-599, 607-608`
- Status: Confirmed (static trace across FE read + BE response shape)
- Evidence:
  - Story reads `radiologyData.partner_A.scores_json?.radiology_nuptia_contribution` (l.189, 598, 607)
    and `radiologyData.partner_A.risk_flags_json` (l.368, 488).
  - The `/matches/:id/radiology` response is built by
    `backend/src/controllers/compatibility.controller.js:237-243` → each partner is
    `mapRadiologyToLegacyFormat(...)`, whose returned object keys are
    `nuptia_score_usg_contribution`, `scores`, `risk_flags`, `raw_data`, `findings_all`,
    `scores_all` (`backend/src/controllers/radiology.controller.js:54-76`). There is **no
    `scores_json` and no `risk_flags_json` key** on the response.
  - Consequence, every time both partners have radiology:
    - `radScore = (typeof undefined === 'number' ? … : 25)/30*100` = **83.3%** injected into the
      headline "Health Together Index" (l.184-191), regardless of the real contribution.
    - `allFlags = [...(undefined || []), ...(undefined || [])] = []` (l.368, 488) → prose asserts
      *"Your structural wellness scans … show completely standard organ anatomy, verifying there
      are no organic blocks or anatomical issues"* (l.370) and `getThreadState('radiology')`
      returns **'Resolved'** (green) for everyone — even the exact demo couple whose mock report
      carries a `severity:'severe'` Grade II varicocele + Grade II fatty liver + osteopenia
      (`usg/page.js:209-217`).
    - The reveal number always renders `25/30` (l.599, 608).
  - Note this is NOT a fallback that "occasionally" fires — the field name is simply wrong, so the
    fabricated branch is taken **100% of the time**, on genuinely real data.
  - The `usg/page.js` tab reads the correct keys (`scores`, `risk_flags`,
    `nuptia_score_usg_contribution` — l.397-399, 537, 414-416), so the two tabs disagree.
- Root cause: field-name drift — the story page reads the raw DB column names (`*_json`) instead of
  the mapped API field names. (Compounded by a parallel backend mismatch: `radiologyLookup.service.js`
  returns `findings_json/scores_json/risk_flags_json` but `mapRadiologyToLegacyFormat` reads
  `report.findings/.scores/.risk_flags` — flagged for the backend workstream; either way the FE
  read is wrong.)
- Impact: clinical-safety + user-trust — a fabricated organ all-clear ("no organic blocks or
  anatomical issues") shown to a couple who has real flagged findings, plus an inflated headline score.
- Best-fit fix: read `partner_A.nuptia_score_usg_contribution` (top-level, already a number) and
  `partner_A.risk_flags`; preserve the deliberate `typeof === 'number' ? x : 25` guard so a real 0
  is not coerced. Separately fix the backend lookup→mapper key mismatch.
- Effort: S (FE); M (with backend mapper)
- Blast radius: the combined score ring, the story prose radiology paragraph, the radiology thread
  state/badge, and the radiology reveal — all on the primary landing tab. PDF path is separate.

### [P1] WS6-02 — Headline "Health Together Index" is recomputed client-side and bypasses the backend's authoritative STI-gated compatibility score (two sources of truth)
- Area: frontend
- Location: `frontend/src/app/core-engine/story/page.js:151-213, 646` (`calculateDynamicScore`), vs
  `backend/src/services/compatibility/reportGeneration.service.js:44-144` (`computeGatedComposite`)
- Status: Confirmed (static)
- Evidence:
  - Backend computes the one authoritative composite in `computeGatedComposite` and then applies an
    STI safety gate: `crossDomainScore = stiGate.triggered ? Math.min(raw ?? 50, 50) : raw`
    (`reportGeneration.service.js:123-126`). This is persisted to `matches.compatibility_score` and
    `presentation_json.relationship_snapshot.score`, and the comment at l.36-43 states this is the
    single place the score may be computed so it can "never … bypass the STI safety gate."
  - `activeMatchDetails` (from `getMatch`, `compatibility.controller.js:250-262`) carries both
    `compatibility_score` and `presentation_json.relationship_snapshot.score`, but `story/page.js`
    **never reads either**. It only reads `activeMatchDetails.presentation_json.carrier_pair_risk`
    and `.report_confidence` (l.137, 196, 377, 498, 618, 663).
  - The on-screen ring uses `targetScore = calculateDynamicScore(selectedYear, isAct)` (l.213), a
    client re-blend with **no STI gate**. A couple with a reactive HIV/HepB/HepC/syphilis result
    would have a persisted score capped ≤50 (shown in the PDF/match list) yet the story ring could
    render a "Strong / Excellent Synergy" ≥80 (l.281-289, 804-806).
  - Additional divergence: the client blends the **chronic/mfr projection-curve values** (l.159,
    168-170) rather than the backend's `calculations.coupleIndex` / `p_12m_current`
    (`reportGeneration.service.js:92-99`), and the default view is `isAct=true` (l.62) → the ring
    shows the **optimized "if you act on this"** branch as the year-0 baseline, systematically
    rosier than the real current baseline. Together with WS6-01 (fabricated 25/30 radiology) and
    WS6-03 (mental `||80`), the headline number is unmoored from the persisted gated value.
- Root cause: the report surface re-derives a headline number client-side instead of displaying the
  persisted gated `relationship_snapshot.score`.
- Impact: correctness + clinical-safety — a materially different, ungated score shown as the primary
  result; STI gate is defeated on the screen users actually look at.
- Best-fit fix: render `activeMatchDetails.presentation_json.relationship_snapshot.score` (or
  `Math.round(compatibility_score*100)`) as the headline; keep the client year-scrubbing math only
  for the projection sub-cards, clearly labeled as a projection, not "your combined score."
- Effort: M
- Blast radius: index ring, status band/tag, the `flaggedCount` action list (l.646). Depends on
  `presentation_json` being present (it is, for any saved match).

### [P2] WS6-03 — Mental `|| 80` coerces a genuine compatibility score of 0 into a fabricated "80%"
- Area: frontend
- Location: `frontend/src/app/core-engine/story/page.js:176, 580, 585` (also prose l.358)
- Status: Confirmed (static)
- Evidence: `mentalResult.overall_readiness?.score || 80`. Backend sets
  `overall_readiness.score = compatibilityIndex = Math.round(Math.max(0, 100 - avgDiff*20))`
  (`backend/src/controllers/mental.controller.js:233, 293-294`) — this is legitimately **0** for a
  maximally-incompatible couple (avgDiff ≥ 5). `|| 80` treats that real 0 as falsy and substitutes
  80 into (a) the headline blend `mentalScore*0.20` (l.176) and (b) the thread reveal
  *"Overall psychometric compatibility score: 80%"* (l.580) / *"Compatibility index resolves to
  80"* (l.585). This is exactly the "real 0 → falsy → fabricated substitute" trap the radiology code
  explicitly guards against at l.188-190 with `typeof === 'number'`, but mental does not.
  Reachability: fires whenever a real `mentalResult` is present and its score is 0 (extreme but a
  legitimate real value; also fires if a restored older result lacks `overall_readiness.score`).
  The prose at l.358 is inside the `label === 'Highly Aligned'` branch, so `||80` there is latent
  only (a Highly-Aligned couple won't score 0).
- Root cause: `||` fallback on a numeric that can be legitimately 0.
- Impact: user-trust — the worst-case couple is shown a reassuring fabricated 80%.
- Best-fit fix: use `?? ` on a value that's known-present, or gate on
  `typeof score === 'number'`; render "—" when absent rather than 80.
- Effort: S
- Blast radius: mental contribution to headline + mental thread reveal (both display surfaces).

### [P2] WS6-04 — Hardcoded `'Sachin'` / `'Swati'` partner-name fallbacks (developer test names) can be shown as the couple's identity
- Area: frontend
- Location: `frontend/src/app/core-engine/usg/page.js:41-42` (also used across the whole tab:
  l.278-279, 299, 349-360, 371-548)
- Status: Confirmed present (static)
- Evidence: `maleName = isUserMale ? (user?.name || 'Sachin') : (prospectForm?.name || 'Sachin')`;
  `femaleName = … || 'Swati'`. `user.name` is effectively always present (onboarding forces it —
  `CompatibilityContext.js:433`). `prospectForm.name` is the exposed one: `restoreMatchSession`
  restores it only from `details.*_manual_data.name` or `match.prospect.name` when that name is not
  the literal `'Partner B'` (`CompatibilityContext.js:742-750`) — so a match saved without a captured
  prospect name (older/invite-path match), then reopened, leaves `prospectForm.name === ''` and the
  organ panels label the partner **"Swati"** (or "Sachin"). A freshly-run match cannot hit this
  (`handleCompatibilityMatch` requires `prospectForm.name`, `CompatibilityContext.js:543`), but the
  restore path can. These are specific plausible-looking names (matching the dev's own test data /
  session email), which is a worse trust breach than a neutral "Partner B".
- Root cause: placeholder test names used as string fallbacks instead of a neutral label.
- Impact: user-trust — someone else's/fake name shown as the couple's identity across an entire tab.
- Best-fit fix: fall back to a neutral label ("Partner", "Your prospect") and/or ensure
  `restoreMatchSession` always rehydrates the prospect name.
- Effort: S
- Blast radius: whole USG tab labeling; also the mock-trigger buttons quote these names.

### [P2] WS6-05 — `calculateAge` returns a fabricated 30, and prospect sex/DOB are never rehydrated, feeding real radiology scoring on upload after a restore
- Area: frontend / data-integrity
- Location: `frontend/src/app/core-engine/usg/page.js:44-50, 88-97, 129-134`; restore gap at
  `frontend/src/contexts/CompatibilityContext.js:739-751`
- Status: Confirmed present; Suspected on live impact (needs upload-after-restore repro)
- Evidence: `calculateAge(dob)` returns `30` when `dob` is missing (l.44-49). On the USG upload
  path, `ageVal = calculateAge(prospectForm.dob)` and `sexVal = prospectForm.gender === 'Male' ?
  'Male' : 'Female'` are sent to `/api/radiology/upload` (l.91-97) and to the mock endpoint
  (l.132-134, 219-231) as the real `age`/`sex` used for organ scoring (prostate/DEXA/reproductive
  logic is age- and sex-gated). But `restoreMatchSession` restores **only** `prospectForm.name`
  (l.746-749) — never `gender` or `dob`. So after reopening a saved match and uploading the
  prospect's radiology PDF, a real male prospect can be scored as Female/age 30. Unlike the story
  `??`-guards, these are not display-only — they corrupt a persisted clinical score.
- Root cause: `|| 30` fabricated age + incomplete prospect rehydration in restore.
- Impact: data-integrity → downstream clinical-safety (wrong organ panel / age-band scoring).
- Best-fit fix: block upload when `dob`/`gender` are absent (or rehydrate them in
  `restoreMatchSession`); never silently default age to 30 for a scoring input.
- Effort: S–M
- Blast radius: radiology scoring rows for restored-then-uploaded prospects.

### [P3] WS6-06 — `?? 85` (chronic) and `?? 15` (mfr) fallbacks in `calculateDynamicScore` and the prose/sub-card generators are chart-interpolation-only / structurally unreachable
- Area: frontend
- Location: `frontend/src/app/core-engine/story/page.js:159, 168, 308-337, 421-438, 535, 559, 568`
- Status: Confirmed unreachable-with-real-data (static)
- Evidence: every one of these reads `chronicResult`/`mfrResult` projection curves. Per the guard
  model above, both results are always loaded (layout guard) and both curves are always 11 entries
  (backend fixed `y<11` loops), and `year ∈ {0,3,5,7,10}` is always in range. The only path to the
  `?? 85`/`?? 15` fallback is a malformed `projection` object missing **both** the primary and the
  aliased key (`currentLifestyle`/`current`, `optimised`/`optimized`), which the backend never
  emits. So these fire only if a curve were literally absent — not with genuine incomplete data.
  They are cosmetic interpolation guards. (If ever reachable they'd be P1 — the value 85/100 or
  15% monthly is a plausible-looking fake — so they should still be hardened to render "—", but the
  reachability today is nil.)
- Root cause: defensive `??` on values that are, given the guards, always present.
- Impact: none currently (UX only if guards ever change).
- Best-fit fix: optional — render "—"/skip the domain if a curve is missing, rather than 85/15.
- Effort: S
- Blast radius: none today; note as a latch that would become P1 if the layout guard or backend
  curve shape changed.

### [P3] WS6-07 — Minor canned/static fallbacks and cosmetic defaults
- Area: frontend
- Location:
  - `chronic/page.js:129-131` — generic canned clinical sentence ("Your health profiles show
    variations that warrant attention…") when `dynamic_insights.conversation_needed_summary` is
    absent; non-numeric, low reachability (backend normally provides it).
  - `chronic/page.js:39-40, 62-63, 99-100` and `mfr/page.js:41, 43, 387, 393` — `?? 0` curve
    guards. Honest by construction (they show a visible 0, not a plausible fake); unreachable with
    real backend data anyway.
  - `mfr/page.js:90, 287, 312` — hover-tooltip ages `female_age || 30`, `male_age || 32`. Fires
    only if `mfrResult.details.*_age` is missing; affects the chart hover label only (cosmetic).
  - `story/page.js:430-432, 442-445` — sub-card copy when `mfrResult`/`chronicResult` absent; those
    branches are dead under the layout guard.
- Status: Static-only
- Impact: UX polish.
- Best-fit fix: prefer "—"/omit over invented numbers/ages where any could ever surface.
- Effort: S

---

## Confirmations requested by the brief

- **`genomics/page.js` is a stub** — Confirmed: 20 lines, a "Currently Coming Soon under Premium
  plans" card, no data (`genomics/page.js:6-20`). Note: despite the dedicated tab being a stub, the
  genetics **thread** on the story tab surfaces real carrier-pair data from
  `presentation_json.carrier_pair_risk` and is handled correctly (see below), so genetics is not
  "missing," only its own tab is a placeholder.
- **Genetics handling is correct (not a finding)** — `genomicsReveal()` and the genetics thread
  (`story/page.js:136-148, 196-207, 377-386, 497-504, 618-640`) read real gated
  `carrier_pair_risk.thalassemia` statuses (red/yellow/gray/clear) and correctly render `null` /
  "Not fully assessed" for gray, avoiding the animated-counter coercion (l.1056-1067). The inline
  comment at l.130-135 documents a *prior* hardcoded "100%/Clear" bug that is now fixed.
- **usg `'Sachin'/'Swati'` + `calculateAge`→30** — Confirmed present, see WS6-04 / WS6-05.
- **story `?? 85 / ?? 15`** — Confirmed present; reachability = chart-interpolation-only, see WS6-06.
- **story mental `|| 80`** — Confirmed present; reachable at a real score of 0, see WS6-03.
