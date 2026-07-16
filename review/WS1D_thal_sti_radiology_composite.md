# WS1D — Thalassemia, STI Gate, Radiology/USG Scoring, Overall Composite

Deep review of the medical engine's genetics screen, infectious-disease safety gate, radiology
scorers, and the single gated composite. All findings empirically probed unless marked otherwise.
Scratch probes listed at the bottom. Files reviewed (all under
`/Users/pranavsingh/Desktop/untitled folder/fresh_build_slayHealth/backend/`):

- `src/services/compatibility/reportGeneration.service.js` — `computeGatedComposite()` (lines 45-145)
- `src/services/compatibility/reportSummary.service.js` — `evaluateThalassemiaCarrierRisk()` (54-111), `checkSTISafetyGate()` (125-207)
- `src/services/scoring/abdomen.score.js`, `nuptia.composite.score.js`, `riskFlags.service.js`

---

## Two questions answered definitively (per the brief)

**Q1 — "Does a radiology scorer default to 100 when a section is simply UNSCANNED?"**
**CONFIRMED (reproduced).** Every per-organ scorer and the composite return 100 for an absent
section. `compositeAbdominalScore({}, 'Male', 40)` returns **100** — a scan whose findings object
is empty scores a perfect 100. This propagates into the composite's radiology domain (see WS1D01).

**Q2 — "Can the STI ≤50 cap be bypassed to leak a >50 score past a positive STI flag?"**
**Split answer, both definitive:**
- **Arithmetic gate: un-bypassable (CONFIRMED).** Once `checkSTISafetyGate().triggered === true`,
  `crossDomainScore = Math.min(raw ?? 50, 50)` (reportGeneration.service.js:124-126). Probed with
  all-domains-95, single-domain, and zero-domain inputs — every case returned exactly ≤50 (50, 50,
  50, 30). No arithmetic path leaks >50 past a triggered flag.
- **Detection gate: bypassable (CONFIRMED, WS1D02).** The leak is not in the math — it is that a
  genuinely positive result phrased "Positive"/"Detected" is never recognized as a flag, so the cap
  never fires and the couple keeps a full score. This is the real, exploitable STI bypass.

---

### [P1] WS1D01 — Radiology scorers fabricate perfect health for unscanned organs (missing = 100)
- Area:        engine
- Location:    `abdomen.score.js` — `liverScore` L3, `gallbladderScore` L57, `kidneyScore` L66, `bladderScore` L86, `pancreasScore` L99, `spleenScore` L109, `prostateScore` L19, `femaleReproductiveScore` L33, `compositeAbdominalScore` L123; chain via `nuptia.composite.score.js` L34/L102 → `reportGeneration.service.js` L27
- Status:      Confirmed (reproduced)
- Evidence:    `ws1d_abdomen_probe.js` — each organ scorer returns 100 for `undefined`; `compositeAbdominalScore({}, 'Male', 40) => 100`; a scan imaging **only** the kidneys (normal) → composite **100** (indistinguishable from a full normal abdomen). `ws1d_radiology_chain_probe.js` proves it propagates: `USG_ABDOMEN = {}` → `radiology_nuptia_contribution = 30` (the max) → rescaled `radScore = 100` fed into the composite's 10% radiology domain. Same for "only kidneys present".
- Root cause: Every scorer conflates "section absent from findings" with "section scanned and normal." There is no per-organ "scanned?" flag; absence is scored as normality (100), not abstained.
- Impact:      clinical-safety / correctness — a partial or near-empty ultrasound is presented as a fully-cleared abdomen and lifts the radiology domain to ~100. The reassurance is fabricated: an organ that was never imaged is reported as healthy.
- Best-fit fix (hint): distinguish "not present in findings" from "present and normal". Only score organs actually reported; compute the composite over scanned organs only (renormalize weights over present organs, as the composite blend itself already does for domains), and surface unscanned organs as "not assessed" rather than folding a 100 into the average. Mirror the domain-level renormalization pattern already used in `computeGatedComposite`.
- Effort:      M
- Blast radius / dependencies: `nuptia.composite.score.js`, stored `radiology_nuptia_contribution`, the 10% radiology domain of every composite, PDF/report radiology tiles. Changing organ handling shifts stored radiology scores; sequence with a re-score/backfill consideration.
- Guideline ref: General imaging-reporting principle (RSNA/ACR structured-reporting): unimaged structures are reported as "not evaluated," never as normal.

### [P1] WS1D02 — STI safety gate misses "Positive"/"Detected" spellings → active infection keeps a full score
- Area:        engine / clinical-safety
- Location:    `reportSummary.service.js` — reactive-marker checks L145, L157, L179, L190 (`/reactive/i && !/non/i`); P24 L168 (`/detected/i && !/not/i`)
- Status:      Confirmed (reproduced)
- Evidence:    `ws1d_sti_probe.js` — for the reactive-marker fields (Syphilis VDRL, HIV-1&2 Ab, HBsAg, Anti-HCV), values `"Positive"`, `"POSITIVE"`, `"Detected"`, `"Seropositive"`, `"Present"`, `"+"` all return **triggered=false**. The gate only matches the literal `reactive`. Confirmed these spellings are real, not hypothetical: `parameterExtractor.service.js:41` explicitly recognizes and stores `Positive`/`Detected`/`Present` as verbatim qualitative value tokens, and the ontology (`ontologyMapper.service.js:872-940`) puts **no enum constraint** on the value — the stored value is whatever the report/OCR/LLM emitted (rapid immunochromatographic HIV/HBsAg/HCV and many RPR reports say "Positive/Negative", not "Reactive/Non-Reactive").
- Root cause: Detection is a narrow substring match on one vocabulary (`reactive`/`detected`) while the upstream extractor deliberately preserves an open qualitative vocabulary including `Positive`/`Detected`/`Present`.
- Impact:      clinical-safety — a partner with an active, report-positive HIV/HBsAg/HCV/syphilis whose result is written "Positive" bypasses the safety gate; the ≤50 cap never fires and the couple can receive a 90s "Excellent" score. This is the couple-facing failure mode the gate exists to prevent.
- Best-fit fix (hint): centralize a single `isReactivePositive(value)` helper matching `/reactive|positive|detected|present|seroposit|\breactive\b/i` while excluding negations (`non`, `not`, `\bneg`), and a matching `isNegative` allow-list; apply per-field with the correct negation guard. Reuse the same helper in `pdfReport.service.js:731-734` and `aiPresentation.service.js:114-119` which share the same paramKeys.
- Effort:      S
- Blast radius / dependencies: touches only the gate's predicates; low risk. Pair with WS1D03 (fix negation handling at the same time).
- Guideline ref: NACO/WHO premarital screening — a reactive OR positive HIV/HBsAg/HCV/VDRL screen must trigger the same downstream action regardless of the lab's wording.

### [P1] WS1D03 — STI gate false-positive on negatives phrased without the "non" substring ("Not Reactive", "Undetected")
- Area:        engine / user-trust
- Location:    `reportSummary.service.js` L145/157/179/190 (`!/non/i` guard); P24 L168 (`!/not/i` guard)
- Status:      Confirmed (reproduced)
- Evidence:    `ws1d_sti_probe.js` — `"Not Reactive"` and `"Not-Reactive"` → **triggered=true** (the `/non/i` guard does not match "not"). For P24, `"Undetected"` and `"Non-detected"` → **triggered=true** (the `/not/i` guard does not match "undetected"/"non-detected"). All are negative results wrongly read as active infection. (Equivocal/grey-zone terms — `Equivocal`, `Indeterminate`, `Borderline`, `Inconclusive` — correctly do NOT trigger, so the brief's specific equivocal-false-positive worry is REFUTED; the false-positive vector is asymmetric negation handling instead.)
- Root cause: The negation guard is a single hardcoded substring per field (`non` for reactive fields, `not` for P24) that does not cover the other's phrasing; "Not Reactive" and "Undetected" slip through as positives.
- Impact:      user-trust (P1) — a fully healthy couple whose report says "Not Reactive"/"Undetected" is capped to ≤50 and shown an "Active Screening Alert," a fabricated serious finding.
- Best-fit fix (hint): normalize once and test negation with a unified `/(^|\b)(non|not|un)[-\s]?(reactive|detected|reactiv)/i` plus a positive allow-list, rather than per-field ad-hoc guards. Fold into the WS1D02 helper.
- Effort:      S
- Blast radius / dependencies: same predicates as WS1D02; fix together.

### [P2] WS1D04 — STI finding language over-claims from a single screening test
- Area:        engine / regulatory
- Location:    `reportSummary.service.js` L150 (syphilis "Active Syphilis … detected"), L183 (HBsAg "indicating active Hepatitis B infection")
- Status:      Confirmed (reproduced) — probe printed the exact strings
- Evidence:    `ws1d_sti_probe.js` detail output: syphilis → "Active Syphilis (VDRL Reactive) detected"; HBsAg → "indicating active Hepatitis B infection". By contrast HCV (L194 "possible … exposure … HCV RNA confirmatory testing required") and HIV-Ab (L161 "Confirmatory testing … required") are appropriately hedged.
- Root cause: A single non-treponemal VDRL/RPR reactive (biological false positives: pregnancy, autoimmune, other infections) does not establish active syphilis; a single HBsAg cannot distinguish acute vs chronic vs false-positive. The copy asserts a confirmed active infection.
- Impact:      user-trust / legal-regulatory — asserting a specific active infection from a screening test shown directly to users is a defensible over-claim risk; inconsistent hedging across the five markers.
- Best-fit fix (hint): reword syphilis/HBsAg to "reactive screening result — requires confirmatory testing" mirroring the HCV/HIV wording; keep the ≤50 cap and "seek specialist consultation" action.
- Effort:      S
- Blast radius / dependencies: copy-only; also surfaced verbatim in `sti_gate.findings[].detail` on the report and PDF.
- Guideline ref: CDC STI Tx Guidelines 2021 (syphilis: reactive non-treponemal requires treponemal confirmation); WHO Hepatitis B guidance (single HBsAg ≠ active-infection staging).

### [P2] WS1D05 — Thalassemia: no borderline band; HbA2 just over 3.5 flagged as definite carrier; "All clear" over-reassures
- Area:        engine / edge-case
- Location:    `reportSummary.service.js` — `classify` L60-63 (`val > 3.5 ? 'red' : 'green'`), narratives L72-88
- Status:      Confirmed (reproduced)
- Evidence:    `ws1d_thal_probe.js` — HbA2 3.6/3.7 (both) → `red/red`, headline "Both of you may carry the same trait", badge "Discuss with a specialist", genScore 50. Exactly 3.5/3.5 → `green/green` "All clear". No grey-zone tier anywhere between normal and definite-carrier.
- Root cause: A single strict `> 3.5` split with no borderline band (3.5-4.0 is a recognized indeterminate zone at many labs, and iron deficiency / alpha-thalassemia can suppress HbA2 and mask beta-thal trait — so a normal HbA2 is not a full "All clear").
- Impact:      correctness / user-trust — over-calls borderline values as definite both-carrier risk ("discuss with specialist") and under-caveats the normal result. Both directions are shown to users and feed the genetics sub-score.
- Best-fit fix (hint): add a borderline band (e.g. 3.5-4.0 → "borderline, repeat/confirm, correlate with CBC indices & ferritin") distinct from ≥4.0 definite; add an iron-deficiency caveat to the normal-result copy; scope "All clear" to "beta-thalassemia trait by HbA2, other conditions not assessed."
- Effort:      M
- Blast radius / dependencies: genScore tiers (L77-86) would need a borderline mapping; carrier_pair_risk presentation copy.
- Guideline ref: Common lab practice / ICSH: HbA2 3.5-3.9% borderline for beta-thal trait; iron deficiency lowers HbA2 (false-negative screen).

### [P2] WS1D06 — Genetics sub-score scores an UNTESTED partner as a non-carrier (optimistic)
- Area:        engine / edge-case
- Location:    `reportGeneration.service.js` L71-86 (`hasGenetic = covered = hasMale || hasFemale`; genScore 75 when only one `red`); `reportSummary.service.js` L98 (`covered: hasMale || hasFemale`)
- Status:      Confirmed (reproduced)
- Evidence:    `ws1d_thal_probe.js` — male HbA2=4.2, female untested → `red/gray`, `covered:true`, "One of you may carry this trait", and (per L82-85) genScore 75. The genetics domain is included in the composite as mildly reassuring (75) even though the second partner — the one who determines whether this is a both-carrier high-risk pairing — was never tested.
- Root cause: `covered` is true if *either* partner has HbA2, and the genScore branch treats a `gray` (untested) partner as not-`red`, i.e. as a non-carrier, rather than as unknown.
- Impact:      correctness — incomplete carrier screening is scored as a partial-clear (75) instead of "cannot assess couple risk." Biases the genetics domain optimistically exactly when the missing test is the decisive one.
- Best-fit fix (hint): when either partner is `gray`, either exclude genetics from the composite (treat like "not assessed") or carry an explicit "incomplete — retest" state rather than defaulting the untested partner to non-carrier.
- Effort:      S
- Blast radius / dependencies: composite weighting for couples with one-sided HbA2; carrier_pair_risk copy.

### [P2] WS1D07 — Composite has no critical-domain floor: one catastrophic domain is averaged away
- Area:        engine
- Location:    `reportGeneration.service.js` L89-116 (pure weighted mean; no worst-domain cap)
- Status:      Confirmed (reproduced)
- Evidence:    `ws1d_composite_probe.js` — chronic=10 with fert/mental/rad=90 and gen=100 → composite **63** ("Good/Excellent"-range). By linear extension a chronic score of 0 with the other four at 100 yields ~65. Unlike `abdomen.score.js` (L155-158) and `nuptia.composite.score.js` (L94-99), which both cap the blended result near the worst component, the top-level composite applies no such floor.
- Root cause: The domain blend is a plain renormalized weighted average with no minimum-domain guard, so a single domain reflecting a serious incompatibility cannot pull the headline into a cautionary band on its own.
- Impact:      correctness / clinical-safety-adjacent — a couple with one severe-risk domain still shows a reassuring headline. Inconsistent with the safety-cap philosophy applied one layer down in the organ/modality scorers.
- Best-fit fix (hint): consider a worst-domain cap analogous to the organ scorers (e.g. cap the composite near the lowest present domain when that domain is below a critical threshold), or route a critical domain into the existing status-downgrade path. Requires product/clinical sign-off on thresholds.
- Effort:      M
- Blast radius / dependencies: changes headline scores broadly; needs clinical calibration before enabling.

### [P3] WS1D08 — Radiology & Genetics (10% each) are near-constant signal, meaningful only at the severe tail
- Area:        engine (assessment)
- Location:    `reportGeneration.service.js` L105-112; radScore rescale L27
- Status:      Confirmed (reproduced) — assessment backed by probes
- Evidence:    Radiology: because unscanned organs score 100 (WS1D01), `radScore ≈ 100` for typical/partial scans (`ws1d_radiology_chain_probe.js`: empty & kidney-only abdomens both → radScore 100). Genetics: genScore is 100 (both normal), 75 (one carrier), or 50 (both carriers) only — `ws1d_composite_probe.js` shows an all-95 couple with **both-carrier** thalassemia (genScore 50) still headlines **91** (a 5-point move: `(100−50)·0.10`). So for the overwhelming majority of couples both domains contribute a near-constant ~10-point baseline lift, deviating only when a severe finding exists.
- Root cause: Coarse 3-value sub-scores at 10% weight; combined with the missing-organ inflation, radiology rarely leaves ~100.
- Impact:      correctness / UX — the two domains mostly add fixed baseline rather than discriminating between couples; the single most clinically important premarital finding (both-carrier thalassemia) barely moves the headline.
- Best-fit fix (hint): either raise weight/granularity for a positive genetics finding (both-carrier is arguably a status-downgrade event, not a −5), fix WS1D01 so radiology reflects real coverage, or route both through the status/cap path rather than the linear blend.
- Effort:      M
- Blast radius / dependencies: reweighting shifts all headline scores; calibrate with WS1D07.

---

## Confirmed-correct (no defect — verified so the claims in the brief are not left ambiguous)

### WS1D09 — Composite weights, renormalization, and the STI arithmetic gate are all correct
- Status:      Confirmed (reproduced) via `ws1d_composite_probe.js`
- Weights sum to 100: 0.35 chronic + 0.25 fertility + 0.20 mental + 0.10 radiology + 0.10 genetics = 1.00 (L92-112). `chronic80·.35 + fert60·.25 + mental40·.20 + rad20·.10 + gen100·.10 = 63.000` — each domain contributes exactly its intended share, and all-100 → 100.
- Renormalization over present domains preserves relative weighting and re-sums to 100: only chronic(80)+mental(40) present → `(80·.35 + 40·.20)/.55 = 65.455` (chronic 63.6% / mental 36.4%, exactly the intended ratio). Single-domain inputs return that domain unchanged (chronic-only 80 → 80; fertility-only 60 → 60). `rawCrossDomainScore = null` when zero domains produce a score (L114-116) — pending, not fabricated.
- STI arithmetic gate un-bypassable (L123-126): all-95 + STI → **50**; single-domain + STI → **50**; zero-domain + STI → **50** (not null, not >50); chronic-30 + STI → **30** (`min(30,50)`). No arithmetic path leaks >50 past a triggered flag.
- Single source of truth verified: `matches.compatibility_score` is written only by `computeGatedComposite` — via `compileMatchReport` (reportGeneration.service.js:233/255) and the mental recompute (`mental.controller.js:388-401`), which re-runs the same gated path. `grep` found no other writer. The gate reads `chronicResult.details.male_data/female_data` (L55-56), which is the same object persisted in `analysis_json.chronicResult`, so the recompute path sees the same STI data (no drift).
- Note: the one real STI bypass is detection, not arithmetic — see WS1D02/WS1D03.

---

## Scratch probe scripts (throwaway, `backend/scratch/`, run with `node`)
- `scratch/ws1d_require_test.js` — sanity: modules load without a DB connection
- `scratch/ws1d_abdomen_probe.js` — WS1D01: per-organ & composite "missing = 100" reproduction
- `scratch/ws1d_radiology_chain_probe.js` — WS1D01/WS1D08: inflation propagates to `radiology_nuptia_contribution`/radScore
- `scratch/ws1d_thal_probe.js` — WS1D05/WS1D06: HbA2 pairs, borderline, untested handling
- `scratch/ws1d_sti_probe.js` — WS1D02/WS1D03/WS1D04: reactive/positive/negated/equivocal detection + detail wording
- `scratch/ws1d_composite_probe.js` — WS1D07/WS1D09: weights, renormalization, single-weak-domain, STI un-bypassability
