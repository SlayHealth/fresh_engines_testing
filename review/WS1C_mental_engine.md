# WS1C — Mental Wellbeing Engine Review

Scope: `backend/src/controllers/mental.controller.js` (`computeMentalResult`, 6-pillar
weighted score, `REQUIRED_MENTAL_FIELDS`, 18-question similarity index),
`frontend/src/constants/mentalHealthQuestions.js` (21 questions / option `val` ordering),
cross-referenced against `contexts/mental_questionnaire_research_backing.md`.

Method: READ + EMPIRICAL PROBE only. Two throwaway scripts under `backend/scratch/`
(listed at bottom) require the real controller and call `computeMentalResult` with crafted
answer sets; the LLM narrative call is forced into its offline fallback
(`OPENROUTER_API_KEY=''`), so all scoring below is the deterministic engine, no network.

---

## 0. What the engine ACTUALLY computes (restated, with line-cited constants)

Likert rescale: `scaleTo100(x) = clamp((x−1)×25, 0..100)` — mental.controller.js:6. So val
1/2/3/4/5 → 0/25/50/75/100.

**Six pillars, per-partner, and their overall weights** (`weightSum`, lines 189–196):

| # | Pillar | Weight | Fields → pillar | Code |
|---|--------|--------|-----------------|------|
| 1 | emotionalHealth | **0.15** | avg(emotional_wellbeing, stress_worry, life_stress_capacity) | 56–65, weight 190 |
| 2 | personalityAttachment | **0.20** | `avg(5 Big Five)×0.6 + attachmentCompatibility×0.4` | 87–123, weight 191 |
| 3 | marriageReadiness | **0.25** | avg(readiness_communication, _conflict, _trust, _commitment, _support) | 129–142, weight 192 |
| 4 | lifeCareerAlignment | **0.15** | avg(career_alignment, financial_alignment, lifestyle_alignment) | 147–156, weight 193 |
| 5 | familyParentingAlignment | **0.15** | avg(family_expectations, parenting_alignment) | 161–168, weight 194 |
| 6 | riskFactors | **0.10** | avg(subMap[substance_concern], scaleTo100(anger_regulation)) | 173–184, weight 195 |

Attachment matrix (lines 106–120): Secure+Secure → **100**; exactly one Secure → **75**;
any two non-Secure → **50** (flat, regardless of which two). This is a *couple-level* number
folded into *each* partner's Pillar-2 score, so both partners share the same attachment term
(lines 122–123). Substance map (line 173): `Low→100, Moderate→50, Elevated→10`.

**Per-partner overall** = `emo×.15 + pers×.20 + read×.25 + life×.15 + fam×.15 + risk×.10`
(lines 189–214), returned as `overall_readiness.partner_A_overall` / `_B_overall`.

**Headline "Compatibility Index"** (`overall_readiness.score`, lines 217–237) is NOT that
weighted quality number. It is a pure partner-*agreement* metric over **18** fields
(`fieldsToCompare`, lines 217–223 — the numeric items **minus** `attachment_style`,
`substance_concern`, **and** `anger_regulation`): `totalDiff = Σ|valA−valB|`;
`avgDiff = totalDiff/18` (max 4); `compatibilityIndex = round(max(0, 100 − avgDiff×20))`.
Label bands (235–237): `<60` "Discussion Recommended", `<80` "Moderate Alignment", else
"Highly Aligned".

**This headline index is what leaves the engine into the overall match score**:
reportGeneration.service.js:101–103 blends `mentalResult.overall_readiness.score × 0.20` into
the cross-domain composite (Chronic 35 / Fertility 25 / **Mental 20** / Radiology 10 /
Genetics 10). So the 20% mental contribution is driven by answer *similarity*, never by
either partner's health *quality*.

---

## 1. Findings

### [P1] WS1C01 — Headline index rewards agreement over health; a maximally-unhealthy couple scores "100/100 Highly Aligned" and that 100 feeds the composite
- Area:        engine
- Location:    mental.controller.js:217–237 (index) → reportGeneration.service.js:101–103 (composite)
- Status:      Confirmed (reproduced)
- Evidence:    `scratch/ws1c_mental_probe.js`. Both partners answer every item all-`1`,
  `attachment_style='Fearful'`, `substance_concern='Elevated'` (worst possible):
  `overall_readiness = {"score":100,"label":"Highly Aligned","partner_A_overall":5,"partner_B_overall":5}`.
  Pillars all 0/20/0/0/0/5. So the number surfaced as the headline and pushed into the 20%
  composite slice is **100 "Highly Aligned"** for a couple whose every individual pillar is
  floored. Contrast: A-all-5 vs B-all-1 → headline `20 "Discussion Recommended"`.
- Root cause: The index measures |answerA−answerB| only. Two people who agree that they are
  both severely struggling look identical to two people who agree they are both thriving.
  The research-backing doc explicitly acknowledges this (§5.4: "measures agreement, not
  quality") — but the code nonetheless routes *this* number, not the per-partner quality
  numbers, to the user-facing headline and the composite blend.
- Impact:      user-trust / clinical-safety — a couple who should be steered toward
  counseling can be shown "Highly Aligned, 100/100" as their marriage-readiness headline.
- Best-fit fix: feed a blend of agreement AND per-partner quality into the composite (e.g.
  `min(compatibilityIndex, mean(overall_A, overall_B))`, or gate the "Highly Aligned" label
  on both partners' overall being above a floor). At minimum, never let a high similarity
  score with low per-partner overalls render as an unqualified positive headline.
- Effort:      M
- Blast radius: changes `overall_readiness.score` semantics → touches composite
  (reportGeneration 101–103), presentation/PDF, and any dashboard reading the headline.
- Guideline ref: research doc §5.4, §6 (Luo & Klohnen 2005: individual trait level predicts
  marital quality more consistently than partner similarity).

### [P1] WS1C02 — Big Five items scored monotonically "higher = healthier"; extreme agreeableness/conscientiousness treated as the best possible answer
- Area:        engine / validation
- Location:    mental.controller.js:87–103 (Big Five → scaleTo100, averaged);
  frontend/src/constants/mentalHealthQuestions.js:56–89 (option wording)
- Status:      Confirmed (static + hand-trace)
- Evidence:    Pillar-2 does `average(scaleTo100(openness..stability))` — a strictly
  increasing function of each raw val. The `val=5` labels are: agreeableness "Always put
  others first" (mentalHealthQuestions.js:81), conscientiousness "Everything scheduled, no
  surprises" (67), openness "Always chasing something new" (60), extraversion "The more
  people, the better" (74), stability "Nothing really shakes me" (88). Each maps to the
  maximum pillar contribution (100).
- Root cause: The engine conflates "more of the trait" with "healthier/more marriage-ready."
  For openness and extraversion the research the doc itself cites (§Q6, §6; Malouff et al.
  2010) finds *no* robust monotonic link to marital satisfaction; for agreeableness and
  conscientiousness the extreme pole is arguably a relationship *risk* (extreme deference /
  rigidity), not the optimum. NB this is NOT an ordering inversion — the val order is
  internally consistent with "more of the trait"; the defect is treating that as a health
  gradient.
- Impact:      correctness — Pillar-2 (20% weight) systematically over-credits personality
  extremes and biases the per-partner overall.
- Best-fit fix: for Big Five, score toward a mid/desirable band rather than linearly to the
  max, or drop O/E from the "quality" contribution and keep them only for the similarity
  index; keep A/C/stability but cap the top. Needs product/psych sign-off.
- Effort:      M
- Blast radius: Pillar-2 per-partner scores, per-partner overall; similarity index unaffected.
- Guideline ref: research doc §Q4–Q8, §6; Malouff JM et al. J Res Pers. 2010;44(1):124-127.

### [P2] WS1C03 — `computeMentalResult` does not self-guard missing answers; a blank/partial submission fabricates an above-average score
- Area:        engine / validation
- Location:    mental.controller.js:48–50 + every `|| 4` / `|| 'Secure'` / `|| 'Low'` default
  (56–184); gate lives only in callers
- Status:      Confirmed (reproduced)
- Evidence:    `scratch/ws1c_missing_and_defaults_probe.js`. `computeMentalResult({}, {})`
  returns a full payload: `overall_readiness={"score":100,...,"partner_A_overall":78,...}`,
  pillars 75/85/75/75/75/88. A 2-of-21 partial likewise scores. `isMentalQuestionnaireComplete({})`
  = `false` and `isMentalQuestionnaireComplete(2-of-21)` = `false`, i.e. the gate works — but
  it is applied *outside* the scoring function.
- Root cause: The `|| 4` (→75/100), `|| 'Secure'` (→best attachment term), `|| 'Low'` (→100
  risk) defaults exist "only as a math safety net" (comment lines 11–16) yet numerically bias
  a missing field to a healthy answer. Both current callers do gate —
  analyzeMental (353–358, 400s on incomplete) and invite.controller.js:504–510 (checks both
  sides, NULLs answers if incomplete) — so this is not currently reaching users. It is a
  latent P0-class hazard: any future caller that forgets the gate silently emits fabricated
  above-average scores instead of failing.
- Impact:      data-integrity (latent) — fabricated pillar/overall values indistinguishable
  from real ones.
- Best-fit fix: call `isMentalQuestionnaireComplete` inside `computeMentalResult` and throw
  on incomplete, making the safety net unreachable-by-construction rather than
  unreachable-by-convention.
- Effort:      S
- Blast radius: both callers already pre-check, so adding the guard is behavior-preserving.

### [P2] WS1C04 — Attachment mismatch is invisible to the headline index (Anxious+Avoidant scores same as Secure+Secure)
- Area:        engine
- Location:    mental.controller.js:217–223 (attachment_style excluded from `fieldsToCompare`)
- Status:      Confirmed (reproduced)
- Evidence:    `scratch/ws1c_mental_probe.js`. Two couples, identical numeric answers (all 3):
  Anxious+Avoidant → `compatibilityIndex=100`; Secure+Secure → `compatibilityIndex=100`
  (identical). The mismatch only moves the per-partner Pillar-2 term (personalityAttachment.A
  = 50 pursue-withdraw vs 70 secure), which feeds `overall_A/B` — not the headline and not the
  composite driver.
- Root cause: `attachment_style` is (correctly) kept out of the numeric |A−B| subtraction, but
  nothing replaces it with a category-aware couple penalty in the headline index. So the
  best-replicated relationship predictor in the doc (§Q9, Li & Chan 2012) does not move the
  number users see or the one blended into the match score.
- Impact:      correctness / user-trust — classic pursue-withdraw pairing shows no headline
  signal.
- Best-fit fix: fold the existing `attachmentCompatibility` (100/75/50) into the headline
  index (e.g. treat it as one more agreement term), so a mismatched pair is penalized in the
  surfaced number, not only in a buried per-partner pillar.
- Effort:      S–M
- Blast radius: changes headline index distribution; re-check label bands.

### [P2] WS1C05 — Substance & anger differences also invisible to the headline index
- Area:        engine
- Location:    mental.controller.js:217–223 (`substance_concern` and `anger_regulation` both
  excluded from the 18-field compare)
- Status:      Confirmed (reproduced)
- Evidence:    `scratch/ws1c_mental_probe.js`. Elevated-drinker + Low-drinker (identical
  numeric) → `compatibilityIndex=100`, identical to two Low-drinkers; riskFactors pillar moves
  (A=30 vs B=75) but the headline does not. `anger_regulation` is numeric yet is deliberately
  left out of `fieldsToCompare` (research doc §5.4 notes this), so a calm partner + an
  explosive partner get no headline agreement penalty for that either.
- Root cause: The similarity index intentionally spans only 18 of the 21 items; the 3 most
  risk-laden items (attachment, substance, anger) are all excluded, concentrating the headline
  on lifestyle/personality agreement.
- Impact:      correctness — the domains most predictive of harm are the ones with zero weight
  in the surfaced number.
- Best-fit fix: include anger as a numeric agreement term; add a category-distance term for
  substance (and attachment, per WS1C04).
- Effort:      S–M

### [P2] WS1C06 — Categorical defaults fail OPEN: unrecognized/wrong-case values score as the healthiest option
- Area:        engine / edge-case
- Location:    mental.controller.js:174–175 (`subMap[...] || 100`), 106–107 (`|| 'Secure'`)
- Status:      Confirmed (reproduced)
- Evidence:    `scratch/ws1c_missing_and_defaults_probe.js`. With all numeric = 3:
  `substance_concern='Elevated'` → riskFactors.A = 30; `'low'` (wrong case) → **75**;
  `'Heavy user'` (not in map) → **75** — i.e. an unrecognized substance value scores as
  `100` (lowest risk / best), same as if the user had said "Low". Missing `attachment_style`
  → Secure/Secure term (personalityAttachment.A = 70).
- Root cause: `subMap['Elevated']=10` is truthy so `|| 100` is normally harmless, but any
  key-miss (typo, casing, future enum drift, a differently-cased client payload) yields
  `undefined || 100` = best score. All `||` defaults bias toward the healthiest answer.
- Impact:      data-integrity — a malformed risk answer is silently upgraded to "no risk".
  Frontend currently sends canonical `Low/Moderate/Elevated` (mentalHealthQuestions.js:181–184)
  so not live today, but brittle.
- Best-fit fix: validate categorical values against the known enum and reject/flag on miss
  instead of defaulting to best; or map unknown → worst (fail-safe) for a risk field.
- Effort:      S

### [P2] WS1C07 — Pillar weights: Marriage Readiness (25%) dominates; Risk (10%) barely registers; Personality & Risk pillars have compressed floors
- Area:        engine
- Location:    mental.controller.js:189–196 (weights); 122–123 (0.6/0.4 split); 173–184 (risk)
- Status:      Confirmed (reproduced via dominance sweep)
- Evidence:    `scratch/ws1c_mental_probe.js` dominance sweep (hold all-max, drop one pillar's
  inputs to min, measure `overall_A`, baseline 100):
  marriageReadiness −25, emotionalHealth −15, lifeCareer −15, familyParenting −15,
  personalityAttachment(Big Five only) −12, riskFactors(anger) −5, attachment(Secure→Fearful)
  −4, substance(Low→Elevated) −4. Pillar floors: personalityAttachment can never fall below
  **20** (attachment floor 50 × 0.4), riskFactors never below **5** (`(10+0)/2`) — confirmed
  by probe (`worst personalityAttachment=20`, `worst riskFactors=5`).
- Root cause: Weights are hard-coded literals with no derivation in code (doc §3 states they
  mirror `mental_engine.md`'s judgement that readiness "should be the most important pillar").
  Defensible as a design choice, but (a) risk-related signals move the per-partner overall by
  at most ~9 points combined and (b) the 50/0.4 attachment floor and 10-min substance map
  compress two pillars' dynamic range so a "worst" answer still yields a non-trivial score.
- Impact:      correctness / user-trust — the two pillars framed to the user as safety-relevant
  (risk factors, attachment) have the least numerical leverage, and none on the headline
  (WS1C01/04/05).
- Best-fit fix: document the weight rationale in code; consider widening risk/attachment
  dynamic range; and (the larger lever) surface the per-partner overall, not just the
  agreement index, since that is where the weights actually act.
- Effort:      M

### [P3] WS1C08 — Planned DAST (drug-use) item and ACE/"Personal Background" section never built; Risk pillar is alcohol-only
- Area:        engine / validation
- Location:    mental.controller.js:17–25 (`REQUIRED_MENTAL_FIELDS` — only `substance_concern`
  + `anger_regulation` for risk); no DAST/ACE fields in mentalHealthQuestions.js
- Status:      Confirmed (static, vs research doc §Q20 "Known gap" lines 395–400 and §7.4
  lines 537–547)
- Evidence:    The doc states plainly that the spec's DAST recreational-drug item and the
  non-scored ACE/"Personal Background & Life Experiences" section "were never implemented."
  Code confirms: risk pillar = `average(subMap[substance_concern], scaleTo100(anger_regulation))`
  — `substance_concern` maps only alcohol tiers (mentalHealthQuestions.js:176–184, "How would
  you describe your drinking habits?"). No illicit-drug or trauma field exists.
- Root cause: spec/implementation drift, transparently documented.
- Impact:      Assessment coverage narrower than designed, but NOT a math defect: the 10% risk
  weight is applied to the surviving 2-item average as-is, not reweighted, so the pillar is not
  "under-powered" numerically. Practical impact on surfaced scores is near-zero because risk
  never touches the headline index (WS1C01/05) and the ACE section was designed non-scored
  anyway. Real cost is qualitative: recreational-drug use and trauma history are entirely
  uncaptured by an engine positioned as a marriage-readiness screen.
- Best-fit fix: if the coverage matters to the product claim, add the DAST tier item under the
  existing risk pillar; otherwise update the spec docs to drop it. Either way stop implying the
  spec and shipped product match.
- Effort:      S (add one categorical item) / docs-only

### [P3] WS1C09 — Compatibility index floors at 20 (never 0); label bands collapse 20–59 into one bucket; composite falsy-guard is unreachable-but-fragile
- Area:        engine / edge-case
- Location:    mental.controller.js:233 (`max(0, 100 − avgDiff×20)`), 235–237 (bands);
  reportGeneration.service.js:101 (`if (mentalResult?.overall_readiness?.score)`)
- Status:      Confirmed (reproduced)
- Evidence:    Max per-question |diff| is `|5−1|=4`, so max `avgDiff=4` → index min
  `round(100−80)=20`; probe A-all-5 vs B-all-1 → `20`. So the "0–100" index actually spans
  20–100, and every couple in 20–59 shows the same "Discussion Recommended" label. Separately,
  the composite guard keys off truthiness of `score`; since `score` can never be 0, the mental
  slice is never silently dropped — but if the floor were ever lowered to allow 0 the slice
  would vanish without warning.
- Impact:      UX / minor correctness — the index's usable range and label granularity are
  narrower than the "/100" presentation implies.
- Best-fit fix: rescale so the reported range genuinely spans 0–100, or relabel; make the
  composite check `!= null` rather than truthy.
- Effort:      S

### [Cleared / P3] WS1C10 — Option `val` ordering is consistently worst-to-best; no inverted question found
- Area:        validation
- Location:    frontend/src/constants/mentalHealthQuestions.js:16 (`scale()`), all 19 numeric
  items; categoricals 95–100 (attachment), 180–184 (substance)
- Status:      Confirmed (static, exhaustive read)
- Evidence:    All 19 numeric questions build options via `scale(labels)` = `val:i+1`, index 0 =
  val 1 = the worst/least-healthy label, ascending to val 5 = healthiest. Spot-checked the
  brief's flagged items: `anger_regulation` (191) "I get loud / say things I regret"(1) →
  "Nothing really gets me angry"(5) — consistent. `attachment_style` (95–100) and
  `substance_concern` (180–184) are categorical strings, and both are correctly **excluded**
  from the numeric `fieldsToCompare` (mental.controller.js:217–223) — so there is NO nonsensical
  numeric subtraction of category indices, and "Anxious vs Avoidant" is never computed as a
  numeric distance. Attachment is instead scored via the pair-lookup matrix (106–120), and
  substance via `subMap` (173).
- Note:        This is a *negative* finding: the silent-signal-flip the brief worried about is
  not present. The only orientation concern is conceptual, not an inversion — see WS1C02 (Big
  Five monotonicity). The one asymmetry worth flagging: "Anxious+Avoidant" and "Anxious+Anxious"
  and "Avoidant+Fearful" are all scored a flat 50 (mental.controller.js:117–120), so the
  pair-matrix does NOT treat "Anxious vs Avoidant" as *more* distant than any other non-secure
  pair even though the narrative text singles out pursue-withdraw (doc §5.2 flags this too).

---

## 2. Cross-reference: research-backing doc's stated limitations vs. what the code does

| Doc claim / limitation | Code reality | Verdict |
|---|---|---|
| §2, §5.4: headline `overall_readiness.score` = 0–100 *agreement* index, feeds 20% of match score | Confirmed. reportGeneration.service.js:101–103 blends `overall_readiness.score × 0.20`. | **Accurate** — and the doc is candid that this measures agreement not quality (WS1C01 is the code consequence). |
| §3: weights 15/20/25/15/15/10 | Match exactly (lines 190–195). | **Accurate.** |
| §5.1: `scaleTo100(x)=(x−1)×25` | Confirmed line 6 (plus a clamp the doc omits). | **Accurate.** |
| §5.2: attachment 100/75/50, flat 50 for all non-secure pairs | Confirmed lines 106–120. | **Accurate** — doc explicitly owns the flat-50 simplification. |
| §5.4: index excludes attachment_style, substance_concern, AND anger_regulation (18 fields) | Confirmed `fieldsToCompare` 217–223 = 18 fields, those three absent. | **Accurate** — doc even flags anger's odd exclusion. |
| §7.4 / §Q20: DAST drug item + ACE section "never implemented" | Confirmed absent from `REQUIRED_MENTAL_FIELDS` and questions file. | **Accurate** (WS1C08). |
| §7.1–7.3: single-item proxies, no cutoffs, no psychometric validation of the 21-item set | Code applies plain averages, no cutoffs — consistent. | **Accurate.** |
| §5.5: per-partner overall = weighted sum, "not what drives the headline" | Confirmed 189–214; headline is the index. | **Accurate.** |

The doc is unusually honest and matches the implementation closely. What it does *not* draw out
(and this review adds): the agreement-only headline is not just a stated property but produces an
actively **misleading positive** for a jointly-unhealthy couple (WS1C01); risk/attachment/anger
carry zero headline weight (WS1C04/05); the categorical defaults fail *open* (WS1C06); and the
Big Five monotonic scoring contradicts the doc's own §6/Malouff caveats (WS1C02).

---

## 3. Scratch scripts (throwaway, `backend/scratch/`, run with `node`)

- `backend/scratch/ws1c_mental_probe.js` — max-good/max-bad/identical-bad/max-disagree answer
  sets; attachment- and substance-mismatch invisibility; pillar-dominance sweep; pillar floors.
  Run: `cd backend && node scratch/ws1c_mental_probe.js`.
- `backend/scratch/ws1c_missing_and_defaults_probe.js` — empty/partial fabrication vs
  `isMentalQuestionnaireComplete` gate; substance fail-open on unrecognized/wrong-case values;
  missing-attachment default. Run: `cd backend && node scratch/ws1c_missing_and_defaults_probe.js`.

Both force `OPENROUTER_API_KEY=''` (offline LLM fallback) and set a dummy `DATABASE_URL`; they
only call `computeMentalResult` / `isMentalQuestionnaireComplete` and never touch the DB.
