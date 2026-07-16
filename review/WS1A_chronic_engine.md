# WS1A — Chronic Disease Engine Review

Target: `backend/src/controllers/chronic.controller.js` (440 lines).
Method: full read + empirical probing. Scoring functions are **module-private** (only `analyzeChronic`,
the Express handler, is exported — line 438-440), so probes copy the exact constants/functions verbatim
into `backend/scratch/chronic_probe.js` and run them under `node`. Every LR/odds/score number below is
reproduced from those scripts. Category detectors and the core odds pipeline were replicated 1:1 and
cross-checked against the source lines cited.

Reproduction environment: node v22.14.0, cwd `backend/`, run `node scratch/chronic_probe.js` and
`node scratch/chronic_probe2.js`.

---

## What the engine ACTUALLY computes (from code, not comments)

**Bayesian likelihood-ratio model** (lines 5-28, 219-249):
- `BASELINE_RISK_PROB = 0.10` → `ODDS_0 = 0.10/0.90 = 0.1111…` (line 5-6). A single fixed 10% pre-test
  probability for everyone, independent of age/sex/ethnicity. What disease this 10% is the prior *for* is
  never defined (diabetes? "chronic/metabolic"? the prompt to the LLM at line 364 calls it "chronic/metabolic profile").
- `currentOdds = ODDS_0 × idrsLR × lifestyleLR × bioLR` (lines 245-246); `p = odds/(1+odds)` (248-249).
- `bioLR = BP_LR × glucose_LR × lipids_LR`, each looked up in `BIOMARKER_LRS` with `|| 1.0` fallback
  (lines 237-242). Values: BP {High 1.5, Elevated 1.2, Normal 1.0}, glucose {Borderline 1.5, Normal 1.0,
  **High 1.0** — deliberately neutral, "gated" instead}, lipids {High 1.5, Borderline 1.2, Normal 1.0}.
  Max bioLR = 1.5³ = **3.375**.
- `lifestyleLR` = product over {diet, sleep, smoking, alcohol, stress} of `ownLR × partnerLR^sharedness`
  (`getEffectiveLifestyleLR`, lines 53-70). `LIFESTYLE_LRS` lines 14-20. Note **activity is NOT in the
  lifestyle LR loop** (it lives in IDRS instead) — so no double-count there.

**IDRS** (`calculateIDRS`, lines 31-51): additive — age (≥50 →30, ≥35 →20, else 0), waist category
(High →20, Borderline →10, else 0), activity (Sedentary →30, Moderate →20, else 0), family history
(parentDiabetes →10). `sex` is a parameter but **never used** (dead param). IDRS is then bucketed to an LR
(lines 222-230): ≥60 →1.82, ≥30 →1.1, else →**0.46** (protective).

**Shared-lifestyle discount / SHAREDNESS** (lines 22-28, 63-64): `effectiveLR_f = ownLR_f × partnerLR_f^{s_f}`
with s = {diet 1.0, sleep 1.0, smoking 0.2, alcohol 0.0, stress 0.0}. Diet and sleep apply the partner's
LR at **full strength** (exponent 1.0 → straight multiplication).

**Couple index** (OWA, line 270): `coupleIndex = 0.6·min(gA,gB) + 0.4·max(gA,gB)` where
`gX = 100·(1−pX)` is the "protective score", capped at 25 when that partner is diabetic (lines 261-268).

**Diabetic gate** (lines 261-268): `partnerXDiabetic = (glucose === 'High')`; if so, `gX = min(100(1−pX), 25)`.
The gate caps only the protective score `gX`, **not** the displayed radar risk `uiRiskX = min(60, pX·100)`
(lines 335-336), and `pX` itself excludes glucose (glucose High LR = 1.0).

**10-year projection** (lines 272-315): `oddsY = currentOdds × 1.05^y`, y=0..10. A fixed exponential drift;
the same 1.05/yr shape for everyone. Separately, `idrsProjectionA/B` (lines 307-312) recompute IDRS with
`age + y` — a *different* aging model that the odds curve does not use.

---

### [P1] WS1A01 — Naive multiplication of physiologically correlated biomarker LRs overstates combined risk
- Area: engine
- Location: chronic.controller.js:237-242 (bioLR product); constants 8-12
- Status: Confirmed (reproduced)
- Evidence: `scratch/chronic_probe.js` "Naive LR multiplication" block.
  BP High(1.5) × glucose Borderline(1.5) × lipids High(1.5) = **bioLR 3.375**. With ODDS_0:
  odds = 0.375 → **p = 0.2727**. If the true *combined* LR for a correlated metabolic-syndrome cluster is
  ~1.8 (near the strongest single marker, since fasting glucose, HbA1c-driven glucose, triglycerides and BP
  co-move in insulin resistance), odds = 0.20 → **p = 0.1667**. The independence assumption inflates the
  probability by 0.273 vs 0.167 = **+63% relative** overstatement, which flows straight into `uiRisk`
  (higher) and the protective score `g` (lower).
- Root cause: LRs are multiplied under a false conditional-independence assumption; the three biomarkers are
  strongly positively correlated, so their joint LR is far below the product of marginals.
- Impact: correctness / clinical-safety (systematically overstates risk / understates protective score for
  exactly the metabolically-abnormal couples the tool is meant to serve).
- Best-fit fix: either (a) use a single composite metabolic-syndrome LR instead of multiplying, (b) dampen
  the product (e.g. geometric mean, or apply a correlation-shrinkage exponent <1), or (c) replace the ad-hoc
  LR stack with a validated multivariable model. Non-obvious call — flag for the validation pass.
- Effort: M
- Blast radius: changes every score; couple index, projection, state pill, children tier all downstream.
- Guideline ref: (validation pass) — the LR magnitudes 1.2/1.5 are uncited; independence needs review vs IDF/ATP-III metabolic-syndrome clustering.

### [P1] WS1A02 — A diagnosed diabetic can be shown a LOW risk on the radar (uiRisk ignores glucose)
- Area: engine / frontend-contract
- Location: chronic.controller.js:262-268 (cap on gX only) vs 335-336 (uiRisk from pX); glucose High LR=1.0 at line 10
- Status: Confirmed (reproduced)
- Evidence: `scratch/chronic_probe2.js` "LEAN DIABETIC" block. Input: age 28, normal waist/BP/lipids,
  perfect lifestyle, **glucose='High' (diagnosed T2DM)**. Output: `idrsLR 0.46, bioLR 1.0` (glucose High
  contributes nothing), `pA = 0.049` → **`partnerARisk` (uiRiskA) = 4.86%** rendered on the radar. The gate
  correctly caps `gA` (protectiveScore) to 25 and sets `diabeticRangeDetected=true` / state="Specialist
  conversation", but the headline risk number and the protective score now **contradict each other** (5%
  risk vs a "diabetic-capped" protective score of 25). A lean/well-controlled diabetic sees a reassuring
  radar.
- Root cause: the diabetic gate was bolted onto `gX` only; `pX`/`uiRiskX` still treat glucose High as neutral
  (LR 1.0) by design (comment lines 251-260), so the risk channel never learns the person is diabetic.
- Impact: clinical-safety / user-trust (mutually contradictory numbers; a diabetic can read "~5% risk").
- Best-fit fix: make glucose High drive the risk channel too (e.g. force `uiRisk` to a floor / distinct
  "already diagnosed" display state), or suppress the numeric radar risk entirely when
  `diabeticRangeDetected`. Reconcile the two displayed quantities.
- Effort: S
- Blast radius: display contract with `partner_A.risk` / radar; coordinate with frontend.

### [P1] WS1A03 — Diabetic gate only reads HbA1c; fasting/random glucose never consulted
- Area: engine / validation
- Location: chronic.controller.js:101-106 (`detectGlucoseCategory(hba1c)`), 126 & 133 (only `hba1c` pulled)
- Status: Confirmed (code path) / Suspected (real-world trigger rate)
- Evidence: `grep` of the controller shows glucose is detected solely from canonical `hba1c` (line 126).
  The extraction layer *does* capture fasting/average glucose —
  `src/services/parser/ontologyMapper.service.js:315` `fasting_blood_glucose_fbg`,
  `:361` `average_blood_glucose_abg`, `src/services/parser/sectionDetector.service.js:39`
  `blood_sugar_fasting_fbs_fbg` — but the chronic engine never reads them. A panel with FBS 250 mg/dL and no
  HbA1c → `detectGlucoseCategory(undefined)` → **'Normal'** → no gate, no cap, no "diabetic" flag, full
  protective score, state can be "Aligned". FBS/PPBS-only panels are extremely common in Indian labs.
- Root cause: single-source glucose detection; the cheaper and more commonly ordered fasting sugar is ignored.
- Impact: clinical-safety (a fasting-glucose-diagnosed diabetic is scored as non-diabetic and shown a
  reassuring result).
- Best-fit fix: also detect glucose from `fasting_blood_glucose_fbg` (≥126 →High, 100-125 →Borderline) and
  random/PP where available; take the worst category across available glucose measures.
- Effort: S
- Blast radius: adds inputs; interacts with WS1A02 gate.
- Guideline ref: (validation pass) ADA FPG thresholds 100/126.

### [P2] WS1A04 — IDRS "both parents diabetic" 20-point band is unreachable; max IDRS = 90 not 100
- Area: engine
- Location: chronic.controller.js:46-49 (only `parentDiabetes → 10`); the code/UI advertise "IDRS /100" (line 364)
- Status: Confirmed (reproduced)
- Evidence: `scratch/chronic_probe.js` — `calculateIDRS(50,'High','Sedentary',{parentDiabetes:true})` = **90**.
  There is no branch that adds 20 for both parents (comment at line 47 admits it). The canonical MDRF IDRS
  family-history axis is 0/10/20 (none/one/both). The instrument is reported as "/100" to the LLM and UI but
  can never exceed 90.
- Root cause: only a single `parentDiabetes` boolean is captured; no both-parents input exists.
- Impact: correctness (systematic under-scoring for the highest-genetic-load families; also skews the ≥60
  band eligibility).
- Best-fit fix: capture both-parents and add the +20 tier; or renormalize denominator honestly.
- Effort: S (backend) / M (needs a new capture field).
- Guideline ref: (validation pass) MDRF/IDRS instrument.

### [P2] WS1A05 — IDRS physical-activity 10-point tier unreachable end-to-end; 4-tier instrument collapsed to 3
- Area: engine / validation
- Location: chronic.controller.js:42-45 (only Sedentary→30, Moderate→20; all else→0); frontend `chronic/page.js:736-739`
- Status: Confirmed (reproduced)
- Evidence: `scratch/chronic_probe.js` IDRS block — activity 'Active'/'Vigorous'/'Light' all → 0, 'Moderate'
  →20, 'Sedentary' →30. The frontend dropdown offers only `Active`/`Moderate`/`Sedentary`
  (`frontend/src/app/chronic/page.js:736-739`), so the values that reach the engine are exactly those three,
  mapping to {0, 20, 30}. The canonical MDRF activity axis has four levels (0/10/20/30); the **+10 tier can
  never be produced** by any input path. Separately, whether "Moderate exercise" should score 20 (as here)
  vs 10 is a validation-pass question.
- Root cause: 3-option UI + 2-branch backend collapse the 4-level instrument.
- Impact: correctness (mis-scores the middle-activity population).
- Best-fit fix: align UI options and backend bands to the canonical 4 levels.
- Effort: S/M.
- Guideline ref: (validation pass) MDRF/IDRS instrument.

### [P2] WS1A06 — IDRS→LR step function creates score cliffs at IDRS 30 and 60
- Area: engine
- Location: chronic.controller.js:222-230
- Status: Confirmed (reproduced)
- Evidence: `scratch/chronic_probe2.js` "IDRS -> LR step cliff". LR(29)=0.46, LR(30)=1.1 →
  **2.39× odds jump for a single IDRS point**; LR(59)=1.1, LR(60)=1.82 → 1.65× jump. Translated to the
  baseline-only protective score: IDRS 29 → 95.1, IDRS 30 → 89.1 — a **6-point discontinuity** for +1 IDRS
  point (which itself can be a single yes/no answer like family history).
- Root cause: coarse 3-bucket step mapping of a continuous score, with the "low" bucket set to a strongly
  protective 0.46.
- Impact: correctness / user-trust (two near-identical people land on opposite sides of a cliff; and the
  0.46 low-risk LR halves odds, materially inflating the protective score of anyone scoring <30).
- Best-fit fix: monotone continuous mapping (e.g. logistic in IDRS) or finer bands; re-examine the 0.46
  choice.
- Effort: M.

### [P2] WS1A07 — Shared-lifestyle discount is an unvalidated invention that inflates a healthy partner's risk from the OTHER partner's habits
- Area: engine
- Location: chronic.controller.js:22-28 (SHAREDNESS constants), 53-70 (`getEffectiveLifestyleLR`), 233-234
- Status: Confirmed (reproduced)
- Evidence: `scratch/chronic_probe.js` shared-lifestyle blocks.
  - A with a **perfect** lifestyle, partner **terrible**: A's `lifestyleLR = 1.6918` (vs 1.0 if partner also
    perfect). Breakdown: diet mult 1.3 (partner Poor applied at full strength, s=1.0), sleep 1.2 (partner
    Night-owl, s=1.0), smoking 1.084 (partner Regular^0.2). alcohol/stress s=0 → no effect. Score impact at
    baseline (idrsLR 0.46, bio 1.0): partner-perfect g = 95.1 vs partner-terrible g = **92.0** — a ~3-point
    drop purely from the partner; larger for higher-risk A because the LR is multiplicative.
  - Reassuring finding: the discount **cannot push A below A's own standalone lifestyle** (partner-perfect =
    all partner^s = 1.0 → effectiveLR reduces to A's own product). And IDRS + biomarkers carry **no
    sharedness**, so a partner's good habits can never lower A's *biomarker/genetic* risk. So the specific
    "good partner erases my genetic risk" failure does NOT occur — but the inverse (bad partner inflates a
    healthy person, at full diet/sleep strength) does.
- Root cause: sharedness exponents {diet 1.0, sleep 1.0, smoking 0.2, alcohol 0.0, stress 0.0} are arbitrary
  and uncited; s=1.0 asserts a partner's diet affects your diabetes risk as much as your own diet does.
- Impact: correctness / user-trust (an individually-healthy person is penalized for their partner via an
  invented mechanism presented as clinical; magnitude modest at baseline, grows with own risk).
- Best-fit fix: either drop the cross-partner term from the individual score (keep it only as an explicit
  "household drift" narrative), or cap total sharedness contribution and cite a source for the exponents.
- Effort: M.
- Guideline ref: none exists — flag as unvalidated modeling.

### [P2] WS1A08 — Missing activity silently defaults to 'Moderate' (+20 IDRS) while every other missing lifestyle defaults to best-case
- Area: engine / data-integrity
- Location: chronic.controller.js:168-179 (`getLifestyleFactor` defaults)
- Status: Confirmed (reproduced)
- Evidence: `scratch/chronic_probe2.js` "ACTIVITY DEFAULT PENALTY". Defaults: diet 'Healthy', smoking
  'Never', alcohol 'Never', sleep 'Early bird', stress 'Normal' (all LR 1.0 — best case), but
  **activity 'Moderate'** which is +20 IDRS. So a caller who omits activity is penalized 20 IDRS points (can
  push IDRS across the 30 cliff → LR 0.46→1.1, see WS1A06), while omitting any other lifestyle field is
  treated as ideal. Inconsistent missing-data policy. (Frontend marks activity required at
  `chronic/page.js:425`, but the backend API is an independent surface with no such guard.)
- Root cause: an inconsistent default chosen per-field.
- Impact: data-integrity / correctness (missing-data direction is not neutral and differs by field).
- Best-fit fix: pick one policy (either explicit "unknown" handling or a documented neutral default) and
  apply uniformly; validate required fields server-side.
- Effort: S.

### [P2] WS1A09 — 10-year projection is a fixed 1.05^y exponential; two inconsistent aging models are shown
- Area: engine / user-trust
- Location: chronic.controller.js:272-315
- Status: Confirmed (reproduced)
- Evidence: `scratch/chronic_probe2.js` "PROJECTION CURVE SHAPE". A healthy couple at age 22 and age 30
  produce **identical** curves `[95,95,95,94,94,94,94,93,93,93,92]` (both IDRS<30 → same starting odds), and
  every curve is the same `1.05^y`-shaped decay regardless of the person's actual risk trajectory. Ageing
  *within* the 10-year window never crosses an IDRS band in the odds curve (idrsLR is fixed at y=0). Yet the
  UI is simultaneously handed `idrsProjectionA/B` (lines 307-312) which **do** recompute IDRS at `age+y` —
  so the IDRS-vs-age graph and the protective-score-vs-age curve are driven by two different, mutually
  inconsistent aging models (e.g. someone crossing age 50 mid-window jumps +10 IDRS on one graph while the
  score curve slope is unchanged).
- Root cause: `1.05^y` drift is a cosmetic constant; the odds curve doesn't re-derive odds from the aged IDRS/biomarkers.
- Impact: user-trust (a "personalized 10-year projection" is essentially the same curve for everyone,
  scaled; and the two displayed curves can visibly disagree).
- Best-fit fix: recompute odds each year from aged inputs (age-updated IDRS band, drift on biomarkers), or
  drop the projection's precision claims.
- Effort: M.

### [P2] WS1A10 — Detectors treat 0/negatives as Normal and accept absurd values with no clamping; unit-confusion unguarded
- Area: engine / edge-case
- Location: chronic.controller.js:85-116 (all four detectors)
- Status: Confirmed (reproduced)
- Evidence: `scratch/chronic_probe.js` boundary blocks.
  - Falsy guards misfire on legitimate 0 and reject negatives silently:
    `detectGlucoseCategory(0)='Normal'`, `detectGlucoseCategory(-5)='Normal'`, `detectBPCategory(0,0)='Normal'`,
    `detectWaistCategory(0,'male')='Normal'`, `detectWaistCategory(-30,'male')='Normal'`.
  - No upper plausibility bound: `detectGlucoseCategory(2000)='High'`, `detectBPCategory(2000,5)='High'`,
    `detectWaistCategory(5000,'male')='High'` — absurd OCR values pass straight through.
  - Unit confusion: `detectGlucoseCategory` assumes **HbA1c %**. A fasting glucose in mg/dL (95, normal) →
    `'High'`; HbA1c reported as mmol/mol (48 = 6.5%) → `'High'` (right category, wrong scale by luck); glucose
    in mmol/L (5.5 = 99 mg/dL, normal) → `'Normal'`. No unit tagging or range sanity check anywhere.
  - Garbage category strings (not in the LR table) silently fall to LR 1.0 via `|| 1.0`
    (`bioLR=1.0` for `bloodPressure:'CATASTROPHIC', glucose:'zzz', lipids:'42'`).
- Root cause: `!val || isNaN(val)` truthiness guards; no plausibility clamps; no unit metadata.
- Impact: robustness / clinical-safety (a mis-unit'd or mis-OCR'd value silently produces a wrong category
  with no error surfaced).
- Best-fit fix: validate numeric ranges per analyte (reject/flag out-of-range), use `Number.isFinite` +
  explicit null handling rather than truthiness, and carry units from extraction.
- Effort: M.

### [P3] WS1A11 — HDL, HOMA-IR, hs-CRP captured but never used in scoring; low HDL ignored
- Area: engine
- Location: chronic.controller.js:143-146 (rawValues.hdl/homa/crp) — never read after capture
- Status: Confirmed (static)
- Evidence: `rawValues` stores `hdl`, `homa` (HOMA-IR), `crp` (hs-CRP) but no later line consumes them; the
  lipids category (108-116) uses only TC/LDL/TG. Low HDL is a core metabolic-syndrome criterion and an
  independent cardiac risk, and HOMA-IR is a direct insulin-resistance measure — all discarded.
- Impact: correctness (missed signal already in hand).
- Best-fit fix: fold low HDL into the lipids/metabolic category; consider HOMA-IR for pre-diabetes.
- Effort: S/M.

### [P3] WS1A12 — Scoring logic is not unit-testable; only the DB+LLM-coupled handler is exported
- Area: engine / testability
- Location: chronic.controller.js:438-440 (exports only `analyzeChronic`); `analyzeChronic` does
  `db.query` (204-205) and `generateStructuredInsight` (385)
- Status: Confirmed (static)
- Evidence: `calculateIDRS`, `getEffectiveLifestyleLR`, the detectors, and the odds pipeline are all
  module-private; the only export is the async Express handler which requires a live Postgres row and an LLM
  call, so none of the math can be exercised without standing up infrastructure. (This review had to copy
  the functions verbatim into `scratch/` to test them.) Also `calculateIDRS`'s `sex` parameter (line 31) is
  never used.
- Impact: correctness/maintainability (no regression guard on safety-critical scoring; every change is
  untested).
- Best-fit fix: extract the pure scoring into a separate module and export it; unit-test the LR/IDRS/gate
  math directly.
- Effort: M.

---

## Notes / lower-confidence observations
- BASELINE_RISK_PROB = 0.10 is a single flat prior for all ages/sexes/ethnicities (line 5). For an
  Indian-population diabetes-risk tool this is a strong, uncited simplification (pre-test probability should
  rise with age and family history — some of which IDRS then re-adds, risking partial double-representation
  of age). Flag for the validation pass.
- The couple index weights the *lower* (worse) protective score at 0.6 (line 270) — conservative and
  sensible; not a defect.
- `childrenPredisposition` (lines 325-332) is a plausible heuristic (parent diabetic or diabetic-range) but
  uncited and ignores biomarkers/IDRS — acceptable as narrative, not as a clinical claim.

## Scratch scripts created (throwaway, under backend/scratch/)
- `backend/scratch/chronic_probe.js` — verbatim constants + functions; probes IDRS bands, LR multiplication
  overstatement, shared-lifestyle discount, and all boundary/garbage/unit cases. `module.exports` used by probe2.
- `backend/scratch/chronic_probe2.js` — lean-diabetic display contradiction, projection curve shape, IDRS→LR
  cliffs, activity default penalty, family-history unreachable band.
