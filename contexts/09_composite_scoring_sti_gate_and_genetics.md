# Composite Scoring, STI Safety Gate & Risk Flags

**Doc 09 of 22** · Audience: a solo full‑stack successor · Prerequisite: `07_medical_engines_chronic_and_fertility.md`, `08_medical_engine_mental_wellbeing.md` (and `06_extraction_pipelines_pathology_and_radiology.md` for how the radiology data this doc scores is produced).

Goal of this doc: document the layer that turns five domain results into the **single number a couple actually sees** — the per‑organ/per‑modality radiology scorers, the three‑layer critical‑domain cap, `computeGatedComposite` (the sole writer of `matches.compatibility_score`), the un‑bypassable STI clinical safety gate, thalassemia carrier genetics, and the categorical risk‑flag catalog. Two contracts run through everything here and you must internalize both before touching a line: **`null` means "not assessed" (never a fabricated healthy 100)**, and **the compatibility score has exactly one writer**. A divergent legacy scoring twin still ships and is the *only* thing the test suite exercises — that landmine gets its own section.

> **Clinical‑constant caveat (applies to this entire doc):** every threshold, deduction magnitude, weight, and band below is tagged `[interim]` unless the code cites a real external source (ISCD, WHO, ATP‑III, NACO, ADA, Misra/JAPI). `[interim]` means *house value, pending clinical review* — a product‑owner decision, not a validated clinical standard. Docs 07–09 are the canonical home for these numbers; other docs reference them.

---

## 1. Where the score actually lives (and the one rule that matters most)

The single most important fact in this doc, and one the source maps get **wrong**: `computeGatedComposite` lives in **`backend/src/services/compatibility/reportGeneration.service.js`**, *not* `reportSummary.service.js`. Get this straight before you go looking for it.

The two files split responsibilities like this:

| File | What it owns |
|---|---|
| `reportGeneration.service.js` | `computeGatedComposite` — the **authoritative** composite; the single writer of `matches.compatibility_score`. Also `_fetchRadiologyScore`, `compileMatchReport` (DB persistence). |
| `reportSummary.service.js` | The STI safety gate (`checkSTISafetyGate`), the serology classifier (`classifySerologyResult`), the thalassemia evaluator (`evaluateThalassemiaCarrierRisk`), and the deterministic presentation mapper (`mapPresentation`) — which applies its **own defensive** STI cap on the *display* copy. |

`computeGatedComposite` is defined at `reportGeneration.service.js:45`. It has **exactly two callers**, and there must never be a third:

```
compileMatchReport (reportGeneration.service.js:209)  ── initial match compile
                                                        └─▶ computeGatedComposite ──▶ matches.compatibility_score
analyzeMental      (mental.controller.js:535)          ── recompute once mental answers arrive later
```

Why two callers and one function: the initial "Generate Insights" run (doc 10) often happens *before* the mental‑wellbeing questionnaire is answered. When those answers arrive later, `mental.controller.analyzeMental` recomputes the score — and it **must** go back through the exact same gated path (`mental.controller.js:527-543`), not an ad‑hoc re‑blend. A previous version did a naive 70/30 re‑blend that (a) never re‑checked the STI gate and (b) let `matches.compatibility_score` drift out of sync with `presentation_json.relationship_snapshot.score`. Both bugs are called out verbatim in the comment at `mental.controller.js:527-534`.

**The rule:** never compute a couple‑level compatibility score anywhere else. If you do, the DB column and the presentation JSON drift, and — worse — your new path bypasses the STI gate. This is warning #3 in doc 00.

---

## 2. The radiology scoring path (per‑partner, 0–30 contribution)

Radiology is scored **per person**, persisted per person, and only *later* joined into the couple composite (§10). The live orchestration is `runRadiologyAnalysis` at `radiology.controller.js:80` — this is the **mounted, production path**. `server.js:87-88` mounts `radiology.routes` at **both** `/api/radiology` and `/api/usg` (the `/api/usg` mount is a backwards‑compat alias; the legacy `usg.routes` is **not** mounted anywhere — see §13).

```
OCR text (PyMuPDF fast path │ OCR.space fallback │ mock)
   │
   ▼
classifier.classify → splitter.split → extractor.extractAll (LLM, per‑section, parallel)
   │
   ▼
aggregator.aggregate → aggregated.unified   (keyed by modality:
                                             USG_ABDOMEN, USG_TVS, USG_SCROTUM_DOPPLER,
                                             ECHO, ECG, DEXA, USG_PELVIS, …)
   │
   ├─▶ calculateRadiologyNuptiaContribution(aggregated, sex, age)  → radiology_nuptia_contribution (0–30)
   └─▶ generateRiskFlags(unified, sex, age)                        → categorical flag array
                                             │
                                             ▼
                        radiology_reports  (findings_json, scores_json, risk_flags_json,
                                            keyed by patient_slay_id / name; is_mock)
```

`runRadiologyAnalysis` calls `calculateRadiologyNuptiaContribution` at `radiology.controller.js:99` and `generateRiskFlags` at `:100`. Note `saveReport` (`radiology.controller.js:192`) **recomputes** scores/flags server‑side (`:200-201`) and always marks `is_mock = TRUE` (`:204`) — its only caller is the frontend mock‑report opt‑in, so anything it writes is flagged synthetic.

### The blend: `calculateRadiologyNuptiaContribution`

`nuptia.composite.score.js:8`. For each *present* modality it calls the matching scorer (each returning 0–100 **or `null`**), accumulates `score × weight`, applies a worst‑modality cap, and scales to 0–30.

Three gotchas live in this one function:

1. **`null` skip is load‑bearing** (`:25-30`). `addModalityScore` explicitly returns early on `null`/`undefined`. In JS `null * weight === 0`, so a not‑assessed modality would otherwise be scored as a *catastrophic 0* — the exact fabrication (inverted) that the WS1D01 fix exists to remove. Never fold a `null` into the blend.
2. **`USG_PELVIS` only when there is no `USG_ABDOMEN`** (`:32-47`). A full abdomen scan already covers the same bladder/reproductive organs via the same `compositeAbdominalScore` call, so scoring a standalone pelvis on top would double‑count under two weights.
3. **Worst‑modality cap** (`:99-104`): if any modality score `< 30`, `weightedAverage = min(avg, worst + 20)`. Then `× 0.30` → the 0–30 `radiology_nuptia_contribution` (`:107`). Radiology is **30% of the standalone NuptiaScore** but only **10% of the couple composite** — a scale trap that bites people (§10).

Note the non‑abdominal modalities (`USG_SCROTUM_DOPPLER`, `ECHO`, `ECG`) are added *inline* (`:50-92`) rather than through `addModalityScore`, because their scorers are called only when the modality key exists and they return a real number in that path — but be aware they don't get the same explicit null‑guard, so if you refactor a scorer to return `null` there, wire it through `addModalityScore`.

---

## 3. Weight tables (verbatim)

### 3a. Modality weights — `schemaRegistry.js:19-37` `[interim]`

Absolute fractions of the standalone NuptiaScore; radiology module totals 30%.

| Modality | Weight | Note |
|---|---|---|
| `USG_ABDOMEN` | 0.08 | |
| `USG_ABDOMEN_PELVIS` | 0.08 | |
| `USG_SCROTUM_DOPPLER` | 0.10 | male only |
| `USG_TVS` | 0.10 | female only |
| `USG_PELVIS` | 0.05 | only scored when no abdomen scan |
| `ECHO` | 0.05 | |
| `ECG` | 0.05 | **provisional** — comment at `schemaRegistry.js:26-28` flags it needs clinical weighting sign‑off, "not an engineering guess" `[interim]` |
| `XRAY_CHEST` | 0.03 | |
| `USG_NECK` | 0.02 | |
| `DEXA` | 0.02 | |
| `MRI_BRAIN` | 0.00 | informational |
| `MRA_BRAIN` | 0.00 | informational |
| `MRI_RENAL` | 0.01 | |
| `MRA_AORTA` | 0.01 | |

`getWeight` returns **0** for an unknown modality (`schemaRegistry.js:41`) — a silent drop, not an error.

### 3b. Abdominal organ weights — `abdomen.score.js:175-183` `[interim]`

Renormalized over **assessed** organs only (`:198-208`).

| Organ | Weight |
|---|---|
| liver | 0.22 |
| reproductive (prostate ♂ / uterus+ovaries ♀) | 0.25 |
| kidneys | 0.18 |
| gallbladder | 0.10 |
| bladder | 0.10 |
| pancreas | 0.08 |
| spleen | 0.07 |

### 3c. Composite domain weights — `computeGatedComposite`, `reportGeneration.service.js:116-146` `[interim]`

Renormalized over **present** domains (`sumScores / sumWeights`, `:150`).

| Domain | Weight | Source score | Scale gotcha |
|---|---|---|---|
| Chronic / cardiometabolic | 0.35 | `chronicResult.calculations.coupleIndex` | 0–100 |
| Fertility | 0.25 | `mfrResult.p_12m_current` | **already 0–100 — do NOT ×100** (`:122`) |
| Mental wellbeing | 0.20 | `mentalResult.overall_readiness.score` | 0–100; guarded by `typeof === 'number'` so a legit **0** isn't dropped (`:132`) |
| Radiology | 0.10 | `radScore` (rescaled, §10) | `radiology_nuptia_contribution` is 0–30, rescaled `(c/30)*100` |
| Genetics | 0.10 | `genScore` (§9) | 100/75/50 tiers |

Weights sum to 1.0; each is only added to `sumScores`/`sumWeights` when its domain is actually present, so a couple missing (say) radiology and genetics blends chronic/fertility/mental over renormalized 0.35/0.25/0.20.

---

## 4. Per‑organ / per‑modality deduction tables (verbatim)

Every scorer starts at **100** and subtracts; every scorer returns **`null`** when `hasSignal` (`abdomen.score.js:10`) finds no real value in any of its keys — *not* a fabricated 100. All magnitudes below are `[interim]` unless a source is named.

### 4a. Abdomen organs — `abdomen.score.js`

| Scorer | Deduction rules |
|---|---|
| `liverScore` (`:15`) | fatty_grade 1 → −15, 2 → −30, 3 → −50; hepatomegaly −10; ihbr_dilated −20; focal lesion `simple_cyst` −5, `mass` −40 |
| `prostateScore` (`:34`) | `_applicable===false` → 100 (confirmed female, N/A). Age‑normal volumes (cc): {40:20, 50:25, 60:30, 70:40, 80:45}; `ratio = vol/normal`: ≤1.2 → 100, ≤1.5 → 80 (Gr I), ≤2.0 → 55 (Gr II), else 30 (Gr III). `null` if never assessed or no measurement |
| `femaleReproductiveScore` (`:54`) | `_applicable===false` → 100 (confirmed male). fibroid −15; collection_in_cavity −10; PCOS bilateral −35 / unilateral −20; each ovary vol >10 → −10; each ovary cyst −8; vaginal_cyst_collection −8; pouch_of_douglas_free_fluid −5 |
| `gallbladderScore` (`:93`) | `present===false` → 100 (post‑cholecystectomy, nothing to score); calculi −30; wall_thickness_normal===false −15; polyp −10 |
| `kidneyScore` (`:104`, per side) | calculi −20; cysts present −5; hydronephrosis grade 1 −15 else −30; corticomedullary 'poor'/'lost' −30 |
| `bladderScore` (`:126`) | wall_thickness_normal===false −15; calculi −30; mass −50; PVR >100 −20 / >50 −10 |
| `pancreasScore` (`:139`) | size_normal===false −15; echotexture_normal===false −15; focal_lesion −40; calcifications −20 |
| `spleenScore` (`:149`) | size_category 'small' −10 / other‑non‑normal −15; focal_lesion −30 |

### 4b. `compositeAbdominalScore` (`abdomen.score.js:163`)

Renormalizes the organ weights (§3b) over assessed organs (`:198-208`); returns `null` if `totalWeight===0` (nothing assessed, `:206`). Applies the organ‑layer critical cap: `worstOrganScore < 30` → `min(total, worst + 20)` (`:213-216`). `CRITICAL_ORGAN_SCORE_THRESHOLD = 30` at `:161`.

### 4c. Metabolic Health Index — `calculateMetabolicHealthIndex` (`abdomen.score.js:221`)

A separate 0–10 index (not part of the NuptiaScore blend). Starts at 10: fatty_grade 1 → −1, 2 → −2.5, 3 → −4; hepatomegaly‑without‑fatty −1; cholelithiasis −1. BMI penalties use **Asian‑Indian bands** (WS3B09, per WHO Asia‑Pacific / Misra et al. JAPI 2009 — a *cited* source, not interim): BMI ≥32.5 → −2, ≥25 → −1, ≥23 → −0.5 (`:244-246`). Signature is `(findings, bmi)` — **different from the legacy 4‑arg twin** (§13).

### 4d. ECHO — `echoScore` (`echo.score.js:1`) `[interim]`

LVEF <35 → −50, <50 → −25, <55 → −10; per valve grade (mr/ar/tr/pr) mild −5 / moderate −15 / severe −35; PAH mild −10 / moderate −25 / severe −45; diastolic dysfunction grade 1 −5 / 2 −15 / 3 −30; pericardial_effusion −10; rwma −20; thrombus‖vegetation −40. Deduction magnitudes are the uncited house values the ECG comment refers to; **pending clinical sign‑off**.

### 4e. ECG — `ecgScore(ecgData, sex)` (`ecg.score.js:6`) `[interim]`

Rhythm atrial_fibrillation −40 / 'other' −20; QTc >500 −40, >prolonged −20 (**sex‑specific threshold: 460 female / 450 male** — a cited standard), <350 −10; QRS >120 −15; PR >200 −10 or (0<PR<120) −10; axis left/right deviation −10; lvh_voltage_criteria −15; HR <50 or >100 −10. The **thresholds** are standard cited values; the **point deductions are explicitly NOT signed off** — the top‑of‑file comment (`ecg.score.js:1-5`) says they follow `echo.score.js`'s style and must get the same clinical sign‑off before being treated as final.

### 4f. Scrotum — `scrotum.score.js` `[interim]`

`scrotalScore` (`:3`, 0–100): varicocele grade 1 −15 / 2 −30 / 3 −45 / ungraded −20; hydrocele bilateral −15 / significant −10 / other −5; focal_lesion −40; vascularity_normal===false −20; inguinal_hernia −5. `scrotalFertilityRelevanceScore` (`:40`, capped 0–10): varicocele g3 = 9 / g2 = 7 / other = 5; significant hydrocele +4; focal_lesion +9. Only called for `patientSex === 'Male'`.

### 4g. DEXA — `dexaScore(dexaData, age)` (`dexa.score.js:19`)

Age‑branched (menopausal status isn't collected, so **age<50 is the ISCD proxy** for premenopausal/men‑<50). This one is largely *cited*, not interim:

| Cohort | Model | Bands |
|---|---|---|
| age < 50 (`:22-29`) | Z‑score (ISCD 2019/2023, "below expected range for age") | missing → 80; ≤ −2.0 → 60; else 100. Single decision point, not WHO tiers. `Z_SCORE_BELOW_EXPECTED_THRESHOLD = -2.0` (`:9`) |
| age ≥ 50 (`:31-43`) | WHO T‑score | missing → 80; ≥ −1.0 → 100; ≥ −1.5 → 80; ≥ −2.0 → 60; > −2.5 → 40 (osteopenia); ≤ −2.5 → 20 (osteoporosis) |

The −2.5 boundary is **`<=`** (osteoporosis), fixed under WS3B11 (`:37-43`) — a T‑score of exactly −2.5 is osteoporosis, not one tier too lenient. The point values (100/80/60/40/20) are house calibration `[interim]`; the *classification boundaries* are cited.

---

## 5. The three‑layer critical cap (why one bad finding can't be averaged away)

The same pattern — **threshold 30, buffer 20, cap at `worst + 20`** — is applied at three layers. They intentionally mirror each other; if you touch one, understand which layer you're in.

| Layer | Where | Cap |
|---|---|---|
| **Organ** | `compositeAbdominalScore`, `abdomen.score.js:213-216` | worst organ < 30 → `min(total, worst+20)` |
| **Modality** | `calculateRadiologyNuptiaContribution`, `nuptia.composite.score.js:102-104` | worst modality < 30 → `min(avg, worst+20)` |
| **Domain** | `computeGatedComposite`, `reportGeneration.service.js:157-165` | worst domain < 30 → `min(raw, worst+20)`. `CRITICAL_DOMAIN_SCORE_THRESHOLD = 30`, `CRITICAL_DOMAIN_CAP_BUFFER = 20` |

**Why it exists (WS1D07):** a plain weighted average lets one catastrophic domain get diluted — chronic=10 with everything else at 90 averages to ~63, still a reassuring headline. The cap pins the blended result close to the worst finding so a severe result stays visible. The domain‑layer comment (`reportGeneration.service.js:152-156`) explicitly says it reuses the organ‑layer's threshold/buffer "rather than inventing a new, separately‑uncited cap." All three constants are `[interim]`.

---

## 6. The `null` / `100` / `_applicable===false` contract

This is the WS1D01 fix and the semantic spine of the whole scoring layer. Three distinct states, three distinct meanings — never collapse them:

| Value | Meaning | Behavior |
|---|---|---|
| `null` | **not assessed** — organ/modality never imaged or nothing in it carried a real value (`hasSignal` false) | **excluded** from the blend; weights renormalize over what remains |
| `100` | assessed and **normal** | contributes as a real 100 |
| `_applicable===false` → 100 | **confirmed opposite sex** (e.g. prostate on a female) — genuinely N/A | scored 100 |

The trap: `null * weight === 0` in JS. If you ever let a `null` reach the accumulator, a not‑assessed organ silently scores as a catastrophic 0 — the WS1D01 fabrication, inverted. `prostateScore`/`femaleReproductiveScore` depend on the `_applicable===false` vs *absent* distinction: absence means "unknown → null" because callers only invoke these for the matching sex in the first place (`abdomen.score.js:34-41`, `:54-59`). Do not "simplify" the two into one 100.

---

## 7. The STI clinical safety gate (in full)

`checkSTISafetyGate` lives in `reportSummary.service.js:194`. It scans both partners' extracted pathology for a **reactive** infectious‑disease screen and, if found, forces the couple score to ≤50.

### 7a. The five canonical params — `STI_GATE_CANONICAL_PARAMS` (`reportSummary.service.js:166-172`)

| Key | Canonical param name | STI |
|---|---|---|
| `syphilis` | `vdrl_rpr_result_reactive_non_reactive` | Syphilis (VDRL/RPR, non‑treponemal) |
| `hivAntibody` | `hiv_1_2_antibody_result_reactive_non_reactive` | HIV 1&2 antibody |
| `hivP24` | `hiv_p24_antigen_result_detected_not_detected` | HIV P24 antigen |
| `hepatitisB` | `hbsag_qualitative_result_reactive_non_reactive` | Hepatitis B (HBsAg) |
| `hepatitisC` | `anti_hcv_antibody_qualitative_result_reactive_non_reactive` | Hepatitis C (anti‑HCV) |

**Binding fragility (WS0‑05):** the gate and the ontology are two independently‑maintained string contracts bound by nothing but convention. If the extractor/ontology renames or drops one of these five canonicals, `getVal` (`:200-209`) silently returns `null` and the gate **never fires for that marker again — with no error anywhere.** The *only* thing preventing this is `backend/__tests__/sti-gate-ontology-binding.test.js`, which asserts each canonical still exists in the ontology (`ontologyMapper.hasCanonical`). Keep it green; it is a genuine clinical‑safety tripwire, not a nice‑to‑have.

### 7b. `classifySerologyResult` — order matters (`reportSummary.service.js:149-157`)

Three whole‑word regexes, tested in a **deliberate order**:

```
NEGATIVE  /\b(?:non[- ]?reactive|not[- ]?reactive|not[- ]?detected|undetected|negative|absent)\b/i   (:145)
EQUIVOCAL /\b(?:equivocal|indeterminate|borderline)\b/i                                               (:146)
POSITIVE  /\b(?:reactive|positive|detected|present)\b/i                                               (:147)
```

Two things you must not break:

1. **Negative before positive.** "Non‑Reactive" and "Not Reactive" both *contain* the substring "reactive", so the negative check has to win first or every non‑reactive result would trip the gate. A prior bare `/non/i` guard wrongly cleared "Reactive (non‑specific pattern)" and never recognized plain "Positive"/"Detected" (common phrasing in Indian lab reports) — the exact history in the comment at `:136-144`.
2. **`\b` word boundaries.** Don't loosen them; they're what makes the substring problem tractable. This is the WS0‑02/WS0‑03/WS1D02/WS1D03 fix.

### 7c. Positive‑only trigger, and the WS0‑04 advisory gap

The loop at `reportSummary.service.js:250-259` pushes a finding **only** when `classifySerologyResult(...) === 'positive'`. `equivocal` and `unknown` deliberately do **not** gate — but they don't *clear* the couple either. The problem (WS0‑04, **still open**): an equivocal/indeterminate/borderline serology currently produces **no user‑facing "confirmatory testing recommended" advisory** at all. The in‑code comment (`:189-192`) confirms this is deferred by design — a confirmatory‑testing flow for equivocal results is "tracked separately, not built into this gate." Flag it before you assume equivocal is handled.

The detail strings (`:218-248`) were reworded under WS3A06/WS1D04/REG‑04 to frame each reactive result as a **screening result requiring confirmation** (TPHA/TPPA for syphilis, NACO 3‑test algorithm for HIV, neutralization for HBsAg, HCV RNA for HCV) — *not* a confirmed diagnosis. Keep that framing intact; do not let any narrative assert "active infection" from a screen alone.

---

## 8. Why the ≤50 cap is applied twice (un‑bypassable)

The gate caps the score in **two independent places**, both via the same `checkSTISafetyGate`:

| Where | Line | What it caps | Nature |
|---|---|---|---|
| `computeGatedComposite` | `reportGeneration.service.js:182-185` | the **real** score written to `matches.compatibility_score` | **authoritative** — `Math.min(flooredScore ?? 50, 50)` |
| `mapPresentation` | `reportSummary.service.js:386-392` | the **display copy** in `relationship_snapshot.score` | **defensive** — `coupleScore = Math.min(coupleScore, 50)` (or 50 if null) |

```
computeGatedComposite
  ├─ raw weighted blend → critical-domain floor
  ├─ STI gate ─▶ crossDomainScore = min(floored ?? 50, 50)   ← AUTHORITATIVE (writes DB)
  ├─ writes crossDomainScore onto detailsForPresentation.compiled_compatibility_score
  └─ mapPresentation
        ├─ reads compiled_compatibility_score
        ├─ re-runs STI gate for the sti_gate presentation object
        └─ min(coupleScore, 50) again                          ← DEFENSIVE (display)
```

Because the authoritative cap sits on the *single* value everything downstream derives from (DB column, report page, PDF, match list — all trace to `crossDomainScore`), a reactive STI screen is **structurally impossible to dilute or bypass**. The presentation‑layer cap is belt‑and‑suspenders: even a caller that hand‑built a `compiled_compatibility_score` and skipped the composite would still be capped at display time. When a gate fires, `mapPresentation` also forces `coupleStatus = 'Action Advised'`, red color, and a reactive‑screening synthesis line (`reportSummary.service.js:393-408`, `:789-790`).

There is also an **Excellent‑status downgrade** independent of STI (`reportSummary.service.js:420-428`): if the final gated score is `< 60` → "Action Advised", `< 80` → "Good". This (UX3‑02/UX9‑01) closes a gap where the status label only escalated off chronic/fertility state and ignored radiology/genetic severity that had *already* lowered the score — so a couple capped for a severe organ finding or a confirmed carrier pair could still read "Excellent — nothing here should give you pause." Falling back to the already‑gated score itself fixes it for every present and future severity source.

---

## 9. Thalassemia carrier genetics scoring

`evaluateThalassemiaCarrierRisk(maleData, femaleData)` at `reportSummary.service.js:63`. It reads each partner's own extracted **HbA2** (`hemoglobin_a2_hba2`) and classifies (`:69-74`):

| HbA2 | Status | Meaning |
|---|---|---|
| > 4.0% | `red` | definite carrier trait |
| 3.5–4.0% | `yellow` | borderline / indeterminate zone (repeat HPLC + RBC indices) |
| ≤ 3.5% | `green` | normal *by HbA2* |
| NaN / absent | `gray` | not tested |

`HBA2_BORDERLINE_LOW = 3.5`, `HBA2_DEFINITE_CARRIER = 4.0` (`:51-52`). The bands are cited to common lab practice / ICSH (WS1D05/WS3A05) — the borderline zone exists because a single strict >3.5% cutoff over‑called carriers, and iron deficiency can *lower* HbA2 and mask a true carrier, so a normal result is honestly scoped to "by HbA2 only" (`:44-50`, narrative at `:103`).

### The `genScore` tiers — `computeGatedComposite` (`reportGeneration.service.js:77-109`)

Carrier‑pair risk only matters clinically when **both** partners carry the trait (autosomal recessive), so the score is asymmetric:

| Carrier pair | genScore | In composite? |
|---|---|---|
| both `red` | **50** | yes — sets `bothConfirmedCarriers = true` |
| one `red`, other `gray` (untested) | — | **excluded** (`hasGenetic = false`) — WS1D06: an untested partner alongside a confirmed carrier is "not assessed", not "probably fine" |
| one `red`, other tested non‑carrier | **75** | yes |
| either `yellow` (borderline, no confirmed carrier) | — | **excluded** — WS1D05: genuinely unresolved pending repeat HPLC, not a number the review specifies |
| both normal | **100** | yes |

**`bothConfirmedCarriers` extra cap** (WS1D08, `reportGeneration.service.js:167-175`): genScore=50 sits *above* the generic 30‑point critical‑domain threshold, so a confirmed both‑carrier couple could otherwise stay in an Excellent‑adjacent band (e.g. 91) despite the single most clinically significant premarital finding this app can surface. So when `bothConfirmedCarriers`, an *additional* cap `min(floored, genScore + 20)` (i.e. ≤70) is forced regardless of whether genScore crossed the generic threshold. `genScore` is also surfaced onto `presentation.genetic_score` (`:199`) for a "Genetic carrier risk" tile.

**Hemoglobin‑variant screening (WS2‑10):** sickle/C/D/E variants are *extractable* (the ontology defines the canonicals) but have **no signed‑off interpretation thresholds**, so they're honestly reported as "not assessed" (`reportSummary.service.js:117-131`), never fabricated clear. Open item.

---

## 10. Genetics/radiology join‑by‑name fragility and the `(c/30)*100` rescale

`_fetchRadiologyScore` (`reportGeneration.service.js:13-34`) joins each partner's radiology **by patient NAME identity** (`radiologyLookupService.fetchRadiologyByIdentity(null, maleManual?.name)`), *not* by report_id. This is deliberate and hard‑won: radiology reports live in a **different ID space** from pathology reports, and a prior version queried `radiology_reports` with a *pathology* `report_id` — which essentially never matched, silently dropping the entire radiology domain out of the score. The comment at `:8-12` is the tombstone for that bug.

The flip side: **a name mismatch silently drops the whole radiology domain** for that couple, with no error. If radiology "isn't showing up," check name identity first.

The rescale (`:22-28`): each partner's `radiology_nuptia_contribution` is 0–30, so it's rescaled `(c/30)*100` back to 0–100, then **averaged across present partners** into `radScore`. Only partners with a numeric contribution count (`typeof c === 'number'`, `:24`) — so radiology contributes even if only one partner has a scan. Remember the double‑scale: radiology is 30% of the *standalone* NuptiaScore but 10% of the *couple* composite.

---

## 11. The categorical risk‑flag catalog

`generateRiskFlags(findings, sex, age)` at `riskFlags.service.js:3`. Runs alongside scoring, off the same aggregated `unified` findings, and persists to `radiology_reports.risk_flags_json`. Every flag carries a fixed schema:

```
{ flag_id, flag_label, organ, severity, fertility_relevance, clinical_note, recommended_action }
```

Catalog (all severity/relevance assignments are `[interim]`):

| flag_id | Trigger | severity | fertility_relevance |
|---|---|---|---|
| `PCOS_BILATERAL` | ovaries.pcos_morphology_bilateral | high | critical |
| `PCOS_UNILATERAL` | ovaries.pcos_morphology_unilateral | moderate | high |
| `FATTY_LIVER_3/2/1` | liver.fatty_grade 3/2/1 | high/moderate/low | age<30 ? moderate : low (grade 1 → low) |
| `BPH_I` | normalized prostate grade `I` | moderate | moderate |
| `BPH_SEVERE` | normalized grade `II`/`III` | high | high |
| `RENAL_CALCULUS` | kidney calculi either side | low | ♀ moderate / ♂ low |
| `LIVER_CYST` | liver focal simple_cyst | low | none |
| `VAGINAL_CYST` | ovaries.vaginal_cyst_collection | low | moderate |
| `PCOS_BILATERAL_TVS` | TVS PCOS morphology | high | critical |
| `UTERINE_FIBROID_TVS` | TVS uterus.fibroid_present | moderate | high |
| `VARICOCELE_GR{n}/UNGRADED` | scrotum varicocele present | grade≥2 high else moderate | grade≥2 high else moderate |
| `ECHO_DIASTOLIC_DYSFUNCTION_G2` | diastolic_dysfunction_grade ≥2 | grade≥3 high else moderate | moderate |
| `PAH_ELEVATED` | pah.present && pasp_mmhg >35 | pasp>50 high else moderate | high |
| `DEXA_BELOW_EXPECTED_RANGE_FOR_AGE` | age<50 & lowest Z ≤ −2.0 | moderate | low |
| `DEXA_OSTEOPENIA` | age≥50 branch, T < −1.0 (label Osteoporosis if T ≤ −2.5) | T≤−2.5 high else moderate | low |
| `ECG_AFIB` / `ECG_ARRHYTHMIA` | rhythm afib / other | high / moderate | moderate / low |
| `ECG_QTC_PROLONGED` | QTc > sex threshold (460♀/450♂) | >500 high else moderate | low |
| `ECG_LVH_VOLTAGE` | lvh_voltage_criteria===true | low | low |

Two normalization details worth knowing:

- **BPH grade normalization** (`riskFlags.service.js:73-80`): the LLM extractor is *not* enum‑constrained for prostate grade, so it can emit "II", "Grade II", "Grade_II", "grade 2", etc. The code strips `GRADE`/underscores/spaces, uppercases, and maps numerals 1/2/3 → I/II/III before comparing. Without this the highest‑severity prostate flag would silently drop on plain "II"/"III".
- **Age‑branched DEXA flag** (`:224-257`): mirrors `dexaScore` exactly — Z‑score "below expected range for age" flag for age<50 (ISCD, avoids falsely diagnosing a healthy 28‑year‑old with osteoporosis, WS3B12); WHO osteopenia/osteoporosis for age≥50 with the classification derived **locally from the T‑score** (`:247`), *not* from the possibly‑null LLM `overall_who_classification` field — a prior unguarded `.toUpperCase()` on that null crashed the entire risk‑flag pass. The −2.5 boundary is `<=` (WS3B11).

---

## 12. The confidence‑band math (shared with presentation)

`mapPresentation` computes a report‑confidence figure (`reportSummary.service.js:315-348`):

```
base 58
 + 16  if blood_verified
 + 11  if hasGenetic
 +  6  if hasRadiology
 +  5  if hasMental
```

Bands: ≥90 "Near‑complete", ≥70 "Solid", else "Good start" (`:324-329`). All values `[interim]`.

**The ceiling gotcha:** `blood_verified` is read from `detailsFlat.blood_verified` (`:317`), and **nothing in the current pipeline ever sets it** — `detailsForPresentation` in `computeGatedComposite` never populates it. So the +16 never fires, and confidence effectively **caps at 58+11+6+5 = 80** ("Solid"), never reaching "Near‑complete". Treat this as a known ceiling, not a bug you introduced; wiring a real `blood_verified` signal is an open item.

---

## 13. The divergent legacy USG scoring twin — a landmine

`backend/src/controllers/usg.controller.js` (~530 LOC) is a **second, complete, divergent** USG scoring implementation. Its route file `usg.routes.js` is **not mounted anywhere** (`grep` confirms nothing requires it; `server.js:88` points `/api/usg` at `radiology.routes`, not `usg.routes`). So the legacy controller is **effectively dead code** — *except* that `backend/__tests__/usg-scoring.test.js` imports it directly and tests it.

The divergences that make it dangerous to trust:

| Behavior | Production (`services/scoring/*`) | Legacy (`usg.controller.js`) |
|---|---|---|
| Unassessed organ | `null` (not assessed) | **fabricated 100** — the exact WS1D01 bug |
| BMI bands | Asian‑Indian (≥23/≥25/≥32.5) | WHO international (≥25/>30/>35) |
| Radiology NuptiaScore weight | 30% | 15% |
| Metabolic signature | `(findings, bmi)` | `(4‑arg)` |

**The trap:** `usg-scoring.test.js` passes green, but it tests the **dead** twin. There is **zero automated coverage** of the production path — no test exercises `calculateRadiologyNuptiaContribution`, `compositeAbdominalScore`, or `computeGatedComposite`. A green suite here is **false confidence**. Per doc 17's decided direction, the legacy standalone engine pages are slated for deletion; when you remove `usg.controller.js`, re‑point or rewrite the tests against `services/scoring/*` first so you don't lose the only scoring tests you have. (See doc 19 for the test‑suite reality, doc 17 for the deletion plan.)

Two other tests *are* relevant and worth keeping green: `sti-gate-ontology-binding.test.js` (the WS0‑05 guard, §7a) and `lifestyle-lr-mapping.test.js` (guards the same class of silent extractor↔consumer key‑drift bug, though it targets the chronic engine).

---

## Open items (see doc 21 for the authoritative list)

- **WS0‑04** — equivocal/indeterminate/borderline serology is deliberately un‑gated *and* surfaces no confirmatory‑testing advisory to the user; the retest flow is deferred, not built (§7c).
- **ECG/ECHO deduction magnitudes and the ECG modality weight (0.05)** are uncited house values explicitly pending clinical sign‑off (`ecg.score.js:1-5`, `schemaRegistry.js:26-28`) — as are essentially all `[interim]` constants in this doc.
- **Zero test coverage of production scoring** — `usg-scoring.test.js` exercises the divergent dead twin (§13); `calculateRadiologyNuptiaContribution` / `compositeAbdominalScore` / `computeGatedComposite` are untested. Highest‑leverage debt to repay.
- **WS1D08 low granularity** — radiology (10%) and genetics (10%) are near‑constant coarse signal for typical couples; reweighting/granularity is unresolved and needs clinical calibration.
- **WS2‑10** — hemoglobin‑variant (sickle/C/D/E) interpretation thresholds unsigned; extractable but honestly reported "not assessed" (§9). And the `blood_verified` confidence uplift never fires, capping confidence at 80 (§12).

---

*Next: `10_match_orchestration_generate_insights.md` — how the "Generate Insights" button drives all five engines and this composite into a single persisted `matches` row.*
