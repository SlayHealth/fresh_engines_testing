# WS3B — Medical validation: Chronic disease, IDRS, biomarker cutoffs, DEXA/radiology thresholds

Scope: validate coded clinical thresholds/formulae against current (2026) authoritative guidelines.
READ-ONLY on code. Method per item: extract coded value (file:line) → find current authoritative
source via web → compare → verdict (MATCH / DRIFT / EDITION-LAG / PROVENANCE-GAP) with source name +
edition + date. All searches run July 2026.

Files inspected:
- `backend/src/controllers/chronic.controller.js` (IDRS, biomarker LRs, category detectors)
- `backend/src/services/radiology/schemas/dexa.schema.js`
- `backend/src/services/scoring/dexa.score.js`
- `backend/src/services/scoring/riskFlags.service.js`
- `backend/src/services/scoring/abdomen.score.js` (metabolic health index / BMI)

Reference instrument for IDRS: **Mohan V et al., "A simplified Indian Diabetes Risk Score for screening
for undiagnosed diabetic subjects," J Assoc Physicians India (JAPI) 2005;53:759–763** — Madras Diabetes
Research Foundation (MDRF). Re-affirmed table in **ICMR-INDIAB (INDIAB-15) validation, Indian J Med Res
2023;157(4):327** and multiple 2024–2025 validation studies. Published table:
| Parameter | Category | Points |
|---|---|---|
| Age | <35 / 35–49 / ≥50 | 0 / 20 / 30 |
| Waist (M) | <90 / 90–99 / ≥100 cm | 0 / 10 / 20 |
| Waist (F) | <80 / 80–89 / ≥90 cm | 0 / 10 / 20 |
| Physical activity | vigorous·strenuous / moderate / mild / none·sedentary | 0 / 10 / 20 / 30 |
| Family history | none / one parent / both parents | 0 / 10 / 20 |
| Risk bands | <30 low · 30–50 moderate · ≥60 high | (max 100) |

---

### [P2] WS3B01 — IDRS family-history component caps at 10; "both parents diabetic" (20 pts) never awarded
- Area:        validation
- Location:    `backend/src/controllers/chronic.controller.js:47-48` (`if (familyHistory.parentDiabetes) score += 10;`)
- Status:      Confirmed (static-only, code read)
- Evidence:    `calculateIDRS` adds a flat +10 for `parentDiabetes` and has no branch for both parents. The
  in-code comment concedes: "Assuming 'bothParentsDiabetes' isn't explicitly captured, we give 10 for one
  parent." Only `manual_data.parentDiabetes` (boolean) is ever read (`chronic.controller.js:163`).
- Root cause: Binary family-history capture; the validated instrument uses a 3-level ordinal (0/10/20).
- Impact:      correctness / clinical-safety — the highest-genetic-risk subgroup (both parents T2DM) is
  under-scored by 10 points, and the theoretical maximum IDRS becomes 90, not 100 (UI still labels it "/100",
  `chronic.controller.js:364`). Can shunt a genuinely high-risk person from the ≥60 band into 30–50 moderate,
  softening the downstream IDRS likelihood ratio (1.82 → 1.1).
- Best-fit fix: capture both-parents status and award 20; keep 10 for a single parent, 0 for none.
- Effort:      S
- Blast radius / dependencies: needs a frontend capture field; touches `idrsLr` banding and IDRS projections.
- Guideline ref: Mohan et al., MDRF-IDRS, JAPI 2005;53:759 (family history: none 0 / one parent 10 / both 20).

### [P2] WS3B02 — IDRS physical-activity point values drift from the validated instrument
- Area:        validation
- Location:    `backend/src/controllers/chronic.controller.js:42-44`
- Status:      Confirmed (static-only)
- Evidence:    Code: `if (activity === 'Sedentary') score += 30; else if (activity === 'Moderate') score += 20;`
  (else 0). Only three outcomes (0/20/30) exist; there is no 10-point band.
- Root cause: Simplified 3-tier activity input mapped onto a 4-tier validated scale, and the "Moderate"
  tier is scored as the published *mild* value.
- Impact:      correctness — the validated instrument scores **moderate activity = 10** and **mild = 20**;
  the code scores its "Moderate" tier at 20, i.e. a moderately-active person is over-penalised by 10 points,
  while the true 10-point "moderate" band and 20-point "mild" band are not represented. `activity` defaults
  to `'Moderate'` (`chronic.controller.js:174`), so the default path already adds +20. Input strings are not
  enum-validated, so any non-`Sedentary`/non-`Moderate` value silently scores 0.
- Best-fit fix: map to the 4-band scale (vigorous/strenuous 0, moderate 10, mild 20, sedentary/none 30) and
  validate the incoming enum.
- Effort:      S
- Blast radius / dependencies: shifts IDRS totals and banding; coordinate with the activity capture UI.
- Guideline ref: Mohan et al., MDRF-IDRS, JAPI 2005;53:759 (activity 0/10/20/30, four bands).

### [MATCH] WS3B03 — IDRS age & waist bands and the low/moderate/high category cutoffs are correct
- Area:        validation
- Location:    age `chronic.controller.js:35-36`; waist detector `:85-92` + band map `:39-40`; risk bands `:222-230`
- Status:      Confirmed (static-only)
- Evidence:    Age ≥50→30, ≥35→20, else 0 — matches published <35/35–49/≥50 = 0/20/30. `detectWaistCategory`
  uses M 90/100, F 80/90 → Borderline(10)/High(20), matching the MDRF waist bands (these are the Asian-Indian
  cut-offs — correct for this population). IDRS→LR banding gates at ≥60 (high) / ≥30 (moderate) / <30 (low),
  which aligns with the published <30 / 30–50 / ≥60 categories. Because every component scores in multiples of
  10, no achievable total lands in the 51–59 gap, so the ≥30-covers-30–59 branch is safe.
- Impact:      none (informational — these are correct)
- Guideline ref: Mohan et al., MDRF-IDRS, JAPI 2005;53:759; risk bands confirmed in ICMR INDIAB-15, Indian J
  Med Res 2023;157(4):327.

### [P2] WS3B04 — IDRS→likelihood-ratio multipliers (1.82 / 1.1 / 0.46) have no documented provenance
- Area:        validation / engine
- Location:    `backend/src/controllers/chronic.controller.js:222-230`
- Status:      Confirmed (static-only)
- Evidence:    `if (idrsA >= 60) idrsLrA = 1.82; else if (idrsA >= 30) idrsLrA = 1.1; else idrsLrA = 0.46;`
  These likelihood ratios feed the Bayesian odds product (`:245`) that produces the headline protective score.
  No citation, derivation, or source appears in the file or repo for these three values.
- Root cause: Bespoke "HSP v2.1" model layered on top of IDRS; the LR calibration is un-sourced.
- Impact:      user-trust / correctness — the numbers that convert an IDRS band into the displayed risk are
  invented constants presented as clinical output. The IDRS itself is a *screening* score for *prevalent
  undiagnosed* diabetes, not a validated 10-year incidence LR, so repurposing it as a longitudinal risk
  multiplier is an off-label use that at minimum needs disclosure.
- Best-fit fix: either cite a peer-reviewed source for band-specific LRs/relative risks, or relabel the output
  as a heuristic index (not a validated probability) and document the derivation.
- Effort:      M
- Blast radius / dependencies: central to the whole chronic score; changing values changes every result.
- Guideline ref: IDRS is validated as a cross-sectional screening tool (sensitivity 72.5%/specificity 60.1% at
  ≥60 for undiagnosed diabetes) — Mohan et al. JAPI 2005; INDIAB-15, Indian J Med Res 2023. No published LR
  table by IDRS band was located; treat coded LRs as unsourced.

### [P2] WS3B05 — BIOMARKER_LRS / LIFESTYLE_LRS / SHAREDNESS / baseline prob / ageing drift are undocumented constants
- Area:        validation / engine
- Location:    `chronic.controller.js:5-28` (BASELINE_RISK_PROB 0.10, BIOMARKER_LRS, LIFESTYLE_LRS, SHAREDNESS),
  `:261` (DIABETIC_SCORE_CAP 25), `:269` (couple weight w 0.6), `:274` (AGE_COMPOUND_FACTOR 1.05)
- Status:      Confirmed (static-only)
- Evidence:    Every multiplier (e.g. `bloodPressure.High 1.5`, `glucose.Borderline 1.5`, `lipids.High 1.5`,
  `smoking.Regular 1.5`, `sleep 'Night owl' 1.2`), the 10% baseline prevalence, the 1.05/yr odds compounding,
  and the diabetic score cap of 25 are hard-coded with no source annotation anywhere in the repo. Per the WS3
  brief the task is to check whether provenance exists — it does not.
- Root cause: Model constants authored without a citation layer.
- Impact:      user-trust / correctness — these directly scale a medical-looking risk percentage and 10-year
  projection curve. Invented LR values are a validation finding in themselves.
- Best-fit fix: add a provenance table (source + effect size + population) per constant, or downgrade the
  presentation to an explicitly non-diagnostic wellness index. The abnormal-threshold cutoffs that *feed* these
  LRs are separately assessed below (WS3B06–B09).
- Effort:      M
- Blast radius / dependencies: pervasive; do alongside WS3B04.
- Guideline ref: n/a (finding is the absence of any cited basis).

### [MATCH] WS3B06 — Glucose (HbA1c) abnormal cutoffs are current, but the detector ignores fasting glucose
- Area:        validation
- Location:    `backend/src/controllers/chronic.controller.js:101-106` (`detectGlucoseCategory`)
- Status:      Confirmed (static-only)
- Evidence:    HbA1c ≥6.5 → High; ≥5.7 → Borderline; else Normal. This matches ADA diagnostic thresholds
  exactly (diabetes A1c ≥6.5%; prediabetes 5.7–6.4%). Caveat: the function is named for "glucose" but reads
  **only HbA1c** — fasting plasma glucose is captured into `rawValues` (`:137`) but never classified, so a
  patient with FPG ≥126 mg/dL and A1c <6.5% is not flagged as diabetic, and the "diabetic gate" (`:262-264`)
  can be missed. Also, ADA requires a confirmatory second test before diagnosis; a single extracted A1c ≥6.5
  here directly caps the score as "already diagnosed."
- Impact:      correctness (cutoffs correct); clinical-safety (isolated fasting hyperglycaemia missed) — low-moderate.
- Best-fit fix: add FPG ≥126 / 100–125 and OGTT 2-h ≥200 / 140–199 branches; treat a single abnormal value as
  "screen-positive, needs confirmation" rather than "diagnosed."
- Effort:      S
- Guideline ref: **ADA, "2. Diagnosis and Classification of Diabetes: Standards of Care in Diabetes—2026,"
  Diabetes Care 2026;49(Suppl 1):S27** (A1c ≥6.5%; FPG ≥126 mg/dL; 2-h PG ≥200 mg/dL; prediabetes A1c 5.7–6.4%,
  IFG 100–125 mg/dL). Concordant with ICMR/RSSDI Indian T2DM guidance.

### [MATCH/context] WS3B07 — Blood-pressure category cutoffs (140/90 High, 130/85 Elevated) are edition-appropriate for India, but diverge from ACC/AHA
- Area:        validation
- Location:    `backend/src/controllers/chronic.controller.js:94-99` (`detectBPCategory`)
- Status:      Confirmed (static-only)
- Evidence:    `sbp ≥140 || dbp ≥90 → High`; `sbp ≥130 || dbp ≥85 → Elevated`. The 140/90 hypertension
  threshold and the 130–139/85–89 "high-normal" band match the 2018 ESC/ESH guideline and the Indian
  Guidelines on Hypertension IV (2019), which both retain 140/90. They do **not** match ACC/AHA 2017, where
  ≥130/80 is already Stage-1 hypertension and 120–129/<80 is "Elevated."
- Impact:      none-to-low — for an India-focused product the ESC/Indian 140/90 convention is defensible and
  current. Flag only as a documented design choice; if the product ever claims ACC/AHA alignment it would drift.
- Best-fit fix: none required; document which hypertension guideline the app follows.
- Effort:      S
- Guideline ref: **2018 ESC/ESH Hypertension Guideline (Williams et al., Eur Heart J 2018;39:3021)**; **Indian
  Guidelines on Hypertension (IGH) IV, 2019** — both define HTN ≥140/90. Contrast: **2017 ACC/AHA (Whelton et
  al., Hypertension 2018;71:e13)** Stage-1 ≥130/80.

### [P3/EDITION-LAG] WS3B08 — Lipid abnormal-cutoffs use NCEP ATP III (2001/2004) strata, superseded by risk-based guidance
- Area:        validation
- Location:    `backend/src/controllers/chronic.controller.js:108-116` (`detectLipidsCategory`)
- Status:      Confirmed (static-only)
- Evidence:    High: TC ≥240 or LDL ≥160 or TG ≥200. Borderline: TC 200–239 or LDL 130–159 or TG 150–199.
  These are verbatim NCEP ATP III category boundaries.
- Root cause: Thresholds anchored to the 2001 ATP III framework.
- Impact:      correctness (low) — ATP III fixed "borderline/high" strata are ~20 years old. Current lipid
  guidance (2018 ACC/AHA cholesterol; 2019 ESC/EAS dyslipidaemia) has largely abandoned fixed LDL/TC bands in
  favour of risk-stratified LDL goals (e.g. <100/<70/<55 mg/dL by risk), and now treats TG ≥150 as the elevated
  threshold. The coded bands remain acceptable as coarse lab reference ranges but are not current treatment
  thresholds; the LDL 130/160 "borderline/high" split in particular no longer maps to any actionable category.
- Best-fit fix: keep the strata only as descriptive lab ranges (label them as such), or move to risk-based LDL
  targets and flag TG ≥150.
- Effort:      S (labelling) / M (risk-based redesign)
- Guideline ref: **NCEP ATP III (JAMA 2001;285:2486; full report Circulation 2002;106:3143; 2004 update Grundy
  et al. Circulation 2004;110:227)** — source of coded values. Superseding: **2018 ACC/AHA Cholesterol
  (Grundy et al., Circulation 2019;139:e1082)**; **2019 ESC/EAS Dyslipidaemia (Mach et al., Eur Heart J
  2020;41:111)**.

### [P2] WS3B09 — Metabolic-health-index BMI penalties use Western WHO cut-offs on an India-focused product
- Area:        validation
- Location:    `backend/src/services/scoring/abdomen.score.js:178-180`
- Status:      Confirmed (static-only)
- Evidence:    `if (bmi > 35) score -= 2; else if (bmi > 30) score -= 1; else if (bmi >= 25) score -= 0.5;`
  First penalty at BMI ≥25 (WHO international overweight) and next at >30 (WHO obese).
- Root cause: Generic WHO cut-offs applied to an Asian-Indian population.
- Impact:      correctness / clinical-safety — for Asian Indians the WHO Asia-Pacific consultation and the 2009
  Indian consensus define **overweight ≥23** and **obesity ≥25** kg/m². The code's first penalty only triggers
  at ≥25, so the 23–24.9 at-risk band scores clean, and the 25–29.9 range (already *obese* by Indian criteria)
  is penalised as merely mild. This under-flags central adiposity in exactly the population the product targets.
  Note the internal inconsistency: IDRS waist already uses the Asian-Indian cut-offs (M90/F80, WS3B03), so BMI
  here is out of step with the app's own waist logic.
- Best-fit fix: use Asian-Indian BMI bands (≥23 overweight, ≥25 obese, and a higher-obesity tier ~≥30/≥32.5).
- Effort:      S
- Blast radius / dependencies: affects `calculateMetabolicHealthIndex`; keep consistent with IDRS waist bands.
- Guideline ref: **WHO Expert Consultation, Lancet 2004;363:157** (Asia-Pacific lower cut-offs); **Consensus
  Statement for Diagnosis of Obesity/Abdominal Obesity for Asian Indians — Misra et al., JAPI 2009;57:163**
  (overweight 23–24.9, obesity ≥25; waist M≥90/F≥80). Reaffirmed by 2023 Indian obesity redefinition consensus.

### [MATCH] WS3B10 — DEXA WHO T-score bands (normal / osteopenia / osteoporosis) are correct
- Area:        validation
- Location:    `backend/src/services/radiology/schemas/dexa.schema.js:6-8`; `backend/src/services/scoring/dexa.score.js:6-10`
- Status:      Confirmed (static-only)
- Evidence:    Schema prompt: T ≥ -1 → normal; -1 to -2.5 → osteopenia; ≤ -2.5 → osteoporosis. `dexa.score.js`
  awards 100/80/60/40/20 across T ≥-1, -1.5, -2.0, -2.5, and below. The band structure matches WHO.
- Impact:      none (informational — bands are correct); but see the boundary and population caveats in WS3B11–B12.
- Guideline ref: **WHO 1994 (WHO Technical Report Series 843; Kanis et al. J Bone Miner Res 1994;9:1137)** — normal
  T ≥ -1.0, osteopenia -1.0 to -2.5, osteoporosis ≤ -2.5. Endorsed by **ISCD 2019/2023 Adult Official Positions**.

### [P3] WS3B11 — DEXA osteoporosis boundary is off-by-one at exactly T = -2.5 (code excludes it; WHO includes it)
- Area:        edge-case / validation
- Location:    `backend/src/services/scoring/dexa.score.js:9` (`if (lowestT >= -2.5) return 40;`);
  `backend/src/services/scoring/riskFlags.service.js:222,227` (`dexaData.lowest_t_score_value < -2.5 ? 'Osteoporosis' : 'Osteopenia'`)
- Status:      Confirmed (static-only)
- Evidence:    Both the score and the risk-flag use strict `< -2.5` for osteoporosis, so a T-score of exactly
  -2.5 is classified/scored as osteopenia (score 40, flag "Osteopenia", severity moderate). WHO defines
  osteoporosis as T ≤ -2.5, i.e. -2.5 itself is osteoporosis. This also contradicts the app's own DEXA schema
  prompt text (`dexa.schema.js:7`), which correctly says "≤ -2.5 → osteoporosis" — deterministic code and the
  LLM instruction disagree at the boundary.
- Impact:      clinical-safety (low, boundary-only) — a patient at precisely -2.5 is under-classified one tier
  and given a moderate (not high) severity flag.
- Best-fit fix: change the osteoporosis test to `<= -2.5` in both files (and `> -2.5` for the osteopenia band
  in dexa.score.js).
- Effort:      S
- Guideline ref: WHO 1994 (TRS 843); ISCD 2019/2023 — osteoporosis T ≤ -2.5.

### [P2] WS3B12 — DEXA applies T-score (WHO) classification to a young/premenopausal population; ISCD requires Z-score there
- Area:        validation
- Location:    `backend/src/services/scoring/riskFlags.service.js:214-232`; `dexa.score.js:1-11`; `dexa.schema.js` (no Z-score decision path)
- Status:      Confirmed (static-only)
- Evidence:    Risk-flag and score classify osteopenia/osteoporosis purely from `lowest_t_score_value`. The
  schema extracts Z-scores but no code branch ever uses them for classification. This is a **premarital
  screening** product, so its cohort is dominated by adults typically <50 and premenopausal women.
- Root cause: One-size T-score pipeline; no age/menopausal/sex gating to select Z-score.
- Impact:      clinical-safety / user-trust — per ISCD Official Positions, in men <50, premenopausal women, and
  children the **Z-score (not T-score)** must be reported, the WHO T-score classification **must not be applied
  to premenopausal women**, and osteoporosis **cannot be diagnosed on BMD alone** in men <50. Labeling a
  healthy 28-year-old as "osteoporosis/osteopenia" from a T-score is a false, alarming diagnosis for exactly
  the app's target users. A Z-score ≤ -2.0 should instead be reported as "below expected range for age."
- Best-fit fix: gate on age/sex/menopausal status; for men <50 and premenopausal women use Z-score with the
  "within / below expected range for age" language (Z ≤ -2.0 = below) and suppress T-score-based osteoporosis
  labels.
- Effort:      M
- Blast radius / dependencies: needs age/sex (already available in `generateRiskFlags(findings, sex, age)`), so
  the inputs exist; touches flag text and severity.
- Guideline ref: **ISCD 2019 & 2023 Adult Official Positions** — Z-score for men <50, premenopausal women,
  children; WHO T-score classification not to be applied to premenopausal women; osteoporosis not diagnosable
  on BMD alone in men <50. (iscd.org Official Positions 2023.)

---

## Verdict summary
| ID | Item | Verdict |
|---|---|---|
| WS3B01 | IDRS family history (both-parents = 20) | DRIFT — caps at 10, max score = 90 |
| WS3B02 | IDRS physical-activity points | DRIFT — moderate scored 20 (should be 10); no mild band |
| WS3B03 | IDRS age/waist bands + risk cutoffs | MATCH |
| WS3B04 | IDRS→LR multipliers 1.82/1.1/0.46 | PROVENANCE-GAP (unsourced) |
| WS3B05 | Biomarker/lifestyle LRs, baseline, drift, caps | PROVENANCE-GAP (unsourced/invented) |
| WS3B06 | HbA1c cutoffs (6.5 / 5.7) | MATCH ADA 2026 (FPG path missing) |
| WS3B07 | BP cutoffs 140/90, 130/85 | MATCH for ESC/Indian context (≠ ACC/AHA) |
| WS3B08 | Lipid cutoffs | EDITION-LAG (ATP III 2001/2004) |
| WS3B09 | BMI penalties ≥25/>30 | DRIFT — Western cut-offs on Indian cohort |
| WS3B10 | DEXA WHO T-score bands | MATCH |
| WS3B11 | DEXA osteoporosis boundary at -2.5 | DRIFT (off-by-one, excludes -2.5) |
| WS3B12 | DEXA T-score on young/premenopausal cohort | DRIFT — ISCD requires Z-score |

Sources (edition + date):
- Mohan V et al., simplified MDRF Indian Diabetes Risk Score, JAPI 2005;53:759–763; ICMR-INDIAB (INDIAB-15) validation, Indian J Med Res 2023;157(4):327.
- ADA, Standards of Care in Diabetes—2026, Diabetes Care 2026;49(Suppl 1):S27 (Jan 2026).
- NCEP ATP III, JAMA 2001;285:2486 / Circulation 2002;106:3143 / 2004 update Circulation 2004;110:227. Superseded by 2018 ACC/AHA Cholesterol (Circulation 2019;139:e1082) and 2019 ESC/EAS Dyslipidaemia (Eur Heart J 2020;41:111).
- 2018 ESC/ESH Hypertension (Eur Heart J 2018;39:3021); Indian Guidelines on Hypertension IV, 2019; 2017 ACC/AHA (Hypertension 2018;71:e13).
- WHO Expert Consultation on Asian BMI, Lancet 2004;363:157; Misra et al. Consensus for Asian Indians, JAPI 2009;57:163.
- WHO 1994 (TRS 843; Kanis JBMR 1994;9:1137); ISCD 2019 & 2023 Adult Official Positions.
