# WS4 — Evidence-grounded ideation: add / update / remove WITHIN the existing engines

Scope: concrete, evidence-grounded proposals to improve the *existing* engines (chronic, MFR,
mental, composite, reportSummary presentation) — not new engines (that is WS5). Every proposal
cites `file:line` for the current-state evidence it builds on and states whether the inputs are
**already extracted** (present in `ontologyMapper.service.js`'s ontology and read from
`extracted_json`) or need **new capture**.

Method: cross-referenced the ~156 canonical params in
`backend/src/services/parser/ontologyMapper.service.js` against what each engine actually consumes,
confirmed by grep that AST, eGFR, uric acid, ferritin/transferrin, B12, rubella IgG, TMSC and
leukocytospermia markers are read by **zero** scoring paths (only presence-checked in
`testCoverage.service.js`). Builds on confirmed WS0/WS1A/WS1B/WS1C findings rather than repeating
them; where a proposal resolves a confirmed defect it names the finding ID.

Schema: OPP entries per `review/_review_schema.md`. Guideline refs are marked where a validation
pass must confirm exact editions/cutoffs — WS4 proposes the *shape*, not the final numbers.

---

## Cross-reference table: canonical params extracted but NOT consumed by any score/card

Consumers audited: `chronic.controller.js` (waist, SBP, DBP, HbA1c, TC, LDL, TG — plus HDL/BMI/HOMA/CRP
captured to `rawValues` but never read after, chronic.controller.js:143-146); `mfr.controller.js`
(AMH, AFC, and 8 semen params); `reportSummary.service.js` body-health cards (HbA1c/eAG, LDL, ALT,
creatinine, BUN, TSH, AMH, vitamin D, HbA2, + STI params). Everything below is in the ontology and
shown to users in raw extract, but feeds **no** score or health card (blood group / Rh excluded —
reserved for WS5):

| Domain | Extracted-but-unused canonical params (ontology line) | Nearest engine that could use them |
|---|---|---|
| Glucose | `fasting_blood_glucose_fbg` (315), `random_blood_sugar_rbs` (325) | chronic diabetic gate (see WS1A03) |
| Lipids | `total_cholesterol_hdl_ratio_tc_hdl` (853), `non_hdl_cholesterol` (844), `ldl_hdl_ratio` (863), `very_low_density_lipoprotein_vldl_c` (825), `high_density_lipoprotein_cholesterol_hdl_c` (805, captured-unused) | chronic lipids LR / heart card |
| Kidney | `estimated_glomerular_filtration_rate_egfr` (483), `serum_uric_acid` (465), `bun_creatinine_ratio` (456) | reportSummary kidney card / chronic |
| Liver | `aspartate_aminotransferase_sgot_ast` (425), `total_bilirubin` (385) | reportSummary liver card |
| CBC/anemia | `mean_corpuscular_volume_mcv` (60), `mean_corpuscular_hemoglobin_mch` (70), `red_cell_distribution_width_cv_rdw_cv` (90), `hemoglobin_hb` (39) | thalassemia pre-screen / new anemia card |
| Iron studies | `serum_ferritin` (576), `transferrin_saturation` (566), `serum_iron` (537), `total_iron_binding_capacity_tibc` (546) | anemia / iron-status card; disambiguates low MCV |
| Hb fractions | `hemoglobin_s_hbs` (616/725), `hemoglobin_f_hbf_fetal_hemoglobin` (605/715), `hemoglobin_e_hbe` (646), `hemoglobin_c_hbc` (626/695), `hemoglobin_d_hbd` (636/705) | carrier-pair screen (currently "not assessed", reportSummary:100-108) |
| Thyroid | `free_t4_ft4` (776), `free_t3_ft3` (766), `triiodothyronine_t3_total` (746), `thyroxine_t4_total` (756) | reportSummary hormones card (TSH-only today) |
| Vitamins | `vitamin_b12_cobalamin_serum` (786) | new deficiency card; fertility/emotional narrative |
| Immunity | `rubella_igg_interpretation_immune_non_immune` (1010), `rubella_igg_antibody_quantitative_iu_ml` (1000) | new pregnancy-safety flag (extracted + in testCoverage, read by no engine) |
| Urinalysis | `urinary_protein` (1056), `urinary_glucose` (1065), `urinary_ketones` (1074), `nitrites` (1110), `leukocyte_esterase` (1119), `pus_cells_wbcs_per_hpf` (1128), `blood_haemoglobin_in_urine` (1101) | kidney/diabetes cards + new UTI flag |
| Semen extras | `total_motile_sperm_count_tmsc` (1314), `round_cells_per_ml` (1385), `pus_cells_leucocytes_per_hpf` (1374), `progressive_motility_pr` (1284, partially), `sperm_agglutination` (1394), head/mid/tail defects (1334-1361) | MFR semen classification |
| Metabolic (captured-unused) | `hs_crp` (371), HOMA-IR (read as `homa_ir`, absent from ontology → always null) | chronic (WS1A11) |

Note (input the engine reads but the ontology never emits): `mfr.controller.js:234` reads
`findExtractedParam(parsedFemaleData, 'afc')` but there is **no `afc` canonical_name in the
ontology** — AFC is never populated from a real report, so `classifyOvarianReserve` runs AMH-only in
practice. Adding an `afc` ontology entry is a prerequisite for any AFC-based proposal below.

---

# Category 1 — Extracted-but-underused parameters

### OPP-W4-01 — Feed fasting/random glucose into the diabetic gate and the sugar card
- Rationale: The chronic diabetic gate and the reportSummary sugar card both key off HbA1c only
  (`chronic.controller.js:101-106,126,133`; `reportSummary.service.js:38-42,497`). FBS/PPBS-only
  panels are extremely common in Indian labs, so a fasting-glucose-diagnosed diabetic is scored
  non-diabetic and shown a reassuring result (confirmed WS1A03). `fasting_blood_glucose_fbg` and
  `random_blood_sugar_rbs` are already in the ontology (315, 325) and read by no engine.
- Inputs needed: **already extracted** — add reads for the two glucose params; no new capture.
- Benefit: Closes the single most clinically-unsafe extracted-but-unused gap; takes the worst
  category across HbA1c / FBS / RBS so a diabetic can't slip through on a panel that omitted HbA1c.
- Effort: S
- Risk / claim considerations: Must guard units (FBS mg/dL vs HbA1c %, see WS1A10) so the two are
  never numerically confused; convert to a shared category, not a shared number.
- Guideline basis: ADA FPG thresholds (FBS ≥126 diabetic, 100-125 impaired; RBS ≥200 with symptoms)
  — validation pass to confirm edition.

### OPP-W4-02 — Use TC:HDL ratio and low HDL in the lipid LR / heart card
- Rationale: The lipids LR uses only TC/LDL/TG (`chronic.controller.js:108-116`); HDL is captured to
  `rawValues.hdl` (143) and then never read (confirmed WS1A11). `total_cholesterol_hdl_ratio_tc_hdl`
  (ontology:853) and `high_density_lipoprotein_cholesterol_hdl_c` (805) are extracted and unused. Low
  HDL is a core metabolic-syndrome criterion and TC:HDL is a stronger single CV-risk marker than LDL
  alone. The heart card also uses LDL-only (`reportSummary.service.js:499`).
- Inputs needed: **already extracted**.
- Benefit: A person with normal LDL but HDL 28 / TC:HDL 6.5 (clear dyslipidemia) currently scores
  "Healthy Lipids Baseline"; folding in HDL/ratio fixes that false reassurance.
- Effort: S/M
- Risk / claim considerations: Adds a genuine signal already in hand; low regression risk if the new
  criterion only *worsens* an otherwise-normal category (fail-safe direction).
- Guideline basis: NCEP ATP-III metabolic-syndrome (HDL <40 M / <50 F), TC:HDL risk bands.

### OPP-W4-03 — Make eGFR the primary kidney measure (creatinine/BUN as fallback)
- Rationale: The kidney card classifies purely on raw creatinine >1.2/2.0 and BUN >25/50
  (`reportSummary.service.js:478-485`). eGFR (`estimated_glomerular_filtration_rate_egfr`,
  ontology:483) is the actual reported measure of kidney function, is age/sex/race-adjusted, is
  extracted, and is read by no engine. A young woman with creatinine 1.1 but eGFR 55 (real CKD stage
  3a) reads "green" today.
- Inputs needed: **already extracted**.
- Benefit: Clinically correct kidney staging; eGFR bands (≥90 / 60-89 / 30-59 / <30) are the standard
  clinicians read, so the card matches the lab's own interpretation line.
- Effort: S
- Risk / claim considerations: Prefer eGFR when present, fall back to creatinine/BUN; keep the
  gray/untested state.
- Guideline basis: KDIGO CKD staging by eGFR.

### OPP-W4-04 — CBC red-cell indices (MCV, MCH, RDW) as a thalassemia/anemia pre-screen
- Rationale: The carrier-pair screen relies solely on HbA2 (`reportSummary.service.js:54-99`) and
  honestly reports hemoglobin-variant screening as "not assessed" (100-108). But `mean_corpuscular_
  volume_mcv` (ontology:60), `mch` (70), `rdw_cv` (90) and `hemoglobin_hb` (39) are all extracted and
  unused. Microcytosis (MCV <80, MCH <27) with a normal/high RBC and low RDW is the classic red flag
  that prompts HbA2/electrophoresis in the first place — a couple with no HbA2 but two microcytic CBCs
  is exactly the pair the carrier screen most wants to flag for confirmatory HPLC.
- Inputs needed: **already extracted**.
- Benefit: Turns "carrier screening incomplete" into an actionable "both partners microcytic — HPLC
  strongly recommended before family planning," recovering signal from panels that skipped HbA2. Also
  supports a standalone anemia card (Hb + MCV) for general blood health.
- Effort: M
- Risk / claim considerations: This is a *pre-screen prompt*, not a diagnosis — must be worded as
  "warrants confirmatory testing," never "you are a carrier." Low MCV has non-thalassemia causes
  (iron deficiency) — pair with OPP-W4-05 to disambiguate.
- Guideline basis: Mentzer index / microcytosis thalassemia-trait screening conventions.

### OPP-W4-05 — Iron studies (ferritin, transferrin saturation) → iron-status card + MCV disambiguation
- Rationale: `serum_ferritin` (ontology:576), `transferrin_saturation` (566), `serum_iron` (537),
  `tibc` (546) are extracted and consumed by nothing. Iron deficiency (low ferritin/TSAT) is the most
  common cause of anemia and of low MCV — it is the necessary disambiguator for OPP-W4-04 (microcytic
  + low ferritin = iron deficiency, not thalassemia; microcytic + normal/high ferritin = escalate to
  HPLC). High ferritin/TSAT flags iron overload (relevant pre-pregnancy).
- Inputs needed: **already extracted**.
- Benefit: A real "iron status" body-health card, and a materially better thalassemia pre-screen when
  combined with OPP-W4-04.
- Effort: M
- Risk / claim considerations: Ferritin is an acute-phase reactant (rises with inflammation) — note
  the caveat where hs-CRP is also present (OPP-W4-13).
- Guideline basis: WHO ferritin cutoffs (<15-30 ng/mL deficiency); TSAT <20% deficiency, >45% overload.

### OPP-W4-06 — Hemoglobin variant fractions (HbS, HbF, HbE, HbC, HbD) into the carrier-pair screen
- Rationale: The carrier screen explicitly hardcodes hemoglobin-variant status to "gray / not
  assessed" (`reportSummary.service.js:100-108`) with the comment that variant screening "isn't
  currently extractable." That is now outdated: `hemoglobin_s_hbs`, `hemoglobin_f_hbf`,
  `hemoglobin_e_hbe`, `hemoglobin_c_hbc`, `hemoglobin_d_hbd` are all in the ontology (605-654,
  695-733) and read by no engine. Elevated HbS (sickle trait), HbE (common in East India / NE),
  raised HbF are exactly the variants an HPLC report gives numerically.
- Inputs needed: **already extracted** (when an HPLC report was uploaded).
- Benefit: Extends the carrier-pair logic from beta-thalassemia (HbA2) to the sickle/E/C/D variants —
  a materially more complete premarital genetic-carrier screen, and stops asserting "not assessed"
  when the data is present.
- Effort: M
- Risk / claim considerations: Same "prompt, don't diagnose; both-carriers-matters" framing the
  existing HbA2 logic already uses (reportGeneration.service.js:77-86 scores both-carriers 50 vs one
  75). Needs per-variant thresholds validated (HbS trait ~35-40%, HbF adult >2%).
- Guideline basis: HPLC variant-fraction reference ranges — validation pass.

### OPP-W4-07 — Full thyroid interpretation (TSH + FT4) instead of TSH-only band
- Rationale: The hormones card uses TSH alone with a flat 0.35-5.0 band
  (`reportSummary.service.js:486-491`). `free_t4_ft4` (ontology:776), `free_t3_ft3` (766) and total
  T3/T4 (746/756) are extracted and unused. TSH+FT4 together separate subclinical (abnormal TSH,
  normal FT4) from overt thyroid dysfunction — a distinction that matters for fertility counselling
  and is a single logical step from what's already read.
- Inputs needed: **already extracted**.
- Benefit: Subclinical-vs-overt classification; more accurate "hormone balance" status; supports a
  pre-conception TSH target note for the female partner.
- Effort: S/M
- Risk / claim considerations: Keep non-diagnostic wording. Pre-pregnancy TSH targets (<2.5) are a
  narrative note, not a hard gate.
- Guideline basis: ATA thyroid-in-pregnancy TSH targets; subclinical hypothyroidism definition.

### OPP-W4-08 — Rubella IgG immunity → a real pregnancy-safety flag
- Rationale: `rubella_igg_interpretation_immune_non_immune` (ontology:1010) and the quantitative IgG
  (1000) are extracted, are listed in `testCoverage.service.js:113-116` as a "Pregnancy-safety
  immunity check," and are read by **no scoring engine or card** (grep confirms zero consumers).
  Rubella non-immunity in the female partner is a clean, actionable premarital finding (vaccinate ≥1
  month pre-conception) — a natural fit for the family-planning section.
- Inputs needed: **already extracted** (female-only marker; `resolveGenderRole` already treats it as
  a female marker, ontologyMapper.service.js:1646).
- Benefit: Converts a captured-but-silent test into a concrete, high-value, low-controversy
  recommendation; strengthens the "pregnancy safety" story the product already claims to check.
- Effort: S
- Risk / claim considerations: Very low — it's a vaccination-status advisory, not a diagnosis.
- Guideline basis: Standard preconception rubella-immunity screening.

### OPP-W4-09 — Vitamin B12 (± folate) deficiency card
- Rationale: `vitamin_b12_cobalamin_serum` (ontology:786) is extracted and unused. B12 deficiency is
  highly prevalent in the Indian (esp. vegetarian) population, is cheap to correct, and is relevant to
  fatigue/mood (feeds the emotional-health narrative) and to preconception homocysteine (feeds the
  MTHFR/fertility story the MFR engine already touches, mfr.controller.js:425-430).
- Inputs needed: **already extracted** for B12. (Folate has no ontology entry — new capture if wanted.)
- Benefit: A second real "vitamins" signal alongside vitamin D (currently the only vitamin scored,
  reportSummary.service.js:492-495); low-cost, high-relevance.
- Effort: S
- Risk / claim considerations: Advisory only.
- Guideline basis: B12 deficiency cutoff (~<200 pg/mL) — validation pass.

### OPP-W4-10 — Serum uric acid as a metabolic-syndrome / gout signal in chronic
- Rationale: `serum_uric_acid` (ontology:465) is extracted and unused. Hyperuricemia clusters with
  insulin resistance and hypertension and is an independent metabolic-risk marker — it fits the
  chronic engine's metabolic remit and could nudge the metabolic category or drive a narrative flag.
- Inputs needed: **already extracted**.
- Benefit: Adds a cheap, commonly-ordered metabolic marker to a chronic engine that currently ignores
  it; useful gout/renal-stone advisory.
- Effort: S
- Risk / claim considerations: Modest independent weight — better as a narrative/secondary flag than
  a heavy LR term, to avoid the correlated-multiplication overstatement of WS1A01.
- Guideline basis: Sex-specific hyperuricemia cutoffs (>7 M / >6 F mg/dL).

### OPP-W4-11 — Urinalysis panel → kidney, diabetes and a UTI flag
- Rationale: A full urinalysis panel is in the ontology and consumed by nothing: `urinary_protein`
  (1056), `urinary_glucose` (1065), `urinary_ketones` (1074), `nitrites` (1110),
  `leukocyte_esterase` (1119), `pus_cells_wbcs_per_hpf` (1128), `blood_haemoglobin_in_urine` (1101).
  Proteinuria strengthens the kidney card (OPP-W4-03); glucosuria/ketonuria corroborate the sugar
  card; nitrites + leukocyte esterase + pus cells are the classic UTI triad worth a gentle "possible
  UTI — recheck" flag.
- Inputs needed: **already extracted** (dipstick strings; will need value normalization — many are
  categorical "Nil/Trace/1+").
- Benefit: Three domains gain corroborating signal from a test almost every panel includes; a UTI
  advisory is genuinely useful and low-risk.
- Effort: M (categorical dipstick parsing / normalization is the real work)
- Risk / claim considerations: Dipstick UTI is a *screen* — word as "consider a recheck," never
  "you have a UTI." Isolated trace proteinuria is common and benign; require it to co-occur with an
  abnormal creatinine/eGFR before escalating the kidney card.
- Guideline basis: Standard urinalysis interpretation.

### OPP-W4-12 — Enrich semen classification with TMSC, leukocytospermia and defect localization
- Rationale: `classifySemen` (`mfr.controller.js:113-188`) uses concentration/count/motility/volume/
  progressive/vitality/morphology/pH but never uses `total_motile_sperm_count_tmsc` (ontology:1314) —
  the single best-validated predictor of natural-conception and IUI success — nor `round_cells_per_ml`
  /`pus_cells_leucocytes_per_hpf` (1385/1374) for leukocytospermia (infection/inflammation, a
  correctable cause), nor the head/mid/tail defect breakdown (1334-1361). All are extracted and
  unused.
- Inputs needed: **already extracted**.
- Benefit: TMSC bands give a far more meaningful male-fertility read than a binary "Severe Deficit,"
  and could soften the weighted-blend masking problem (WS1B03) by grading severity more finely.
  Leukocytospermia surfaces a treatable finding the current model is blind to.
- Effort: M
- Risk / claim considerations: TMSC thresholds for natural vs IUI vs ICSI are well-established; use as
  a graded modifier, not a new hard gate.
- Guideline basis: WHO 2021 semen; TMSC natural-conception / IUI thresholds (~>5-9 M).

### OPP-W4-13 — Score the already-captured HOMA-IR and hs-CRP in chronic
- Rationale: `chronic.controller.js:145-146` already parses `homa` and `crp` into `rawValues` and
  never reads them again (confirmed WS1A11). HOMA-IR is a direct insulin-resistance measure (pre-
  diabetes signal independent of HbA1c); hs-CRP is an inflammatory CV-risk marker. Note `homa_ir` is
  not in the ontology (line 145 reads a non-existent key → always null), so HOMA needs an ontology
  entry; hs-CRP *is* in the ontology (371) and even has units declared.
- Inputs needed: hs-CRP **already extracted**; HOMA-IR needs an ontology entry (new mapping, not new
  user capture).
- Benefit: Two metabolic markers already 90% wired; hs-CRP also lets OPP-W4-05 caveat ferritin
  correctly.
- Effort: S (hs-CRP) / M (HOMA-IR ontology + scoring)
- Risk / claim considerations: hs-CRP is non-specific — narrative/secondary weight only.
- Guideline basis: HOMA-IR IR cutoffs; hs-CRP AHA CV-risk tertiles (<1 / 1-3 / >3 mg/L).

### OPP-W4-14 — AST and AST:ALT ratio into the liver card
- Rationale: The liver card uses ALT only (`reportSummary.service.js:501-502`). `aspartate_
  aminotransferase_sgot_ast` (ontology:425) and `total_bilirubin` (385) are extracted and unused.
  AST:ALT ratio >2 flags a different (alcoholic/advanced) pattern than isolated ALT elevation (fatty
  liver), and bilirubin adds cholestatic context.
- Inputs needed: **already extracted**.
- Benefit: More clinically-meaningful liver read at near-zero cost.
- Effort: S
- Risk / claim considerations: Advisory; keep gray/untested state.
- Guideline basis: AST:ALT ratio interpretation conventions.

---

# Category 2 — Thresholds that should be configurable / versioned

### OPP-W4-15 — Extract all hardcoded clinical cutoffs into one versioned, dated config module
- Rationale: Clinical cutoffs are scattered as inline literals across the engines with no version,
  date, or citation, so any guideline update is a code change (and a silent one). A single
  `clinicalThresholds.v1.js` (or JSON) module — each constant tagged `{ value, source, edition,
  effective_date }` and imported everywhere — turns guideline updates into a reviewed data change and
  gives the "clinical engine version" metadata (already stamped at
  `reportGeneration.service.js:194-199`) something real to point at. Constants to move, with current
  locations:
  - **WHO 2021 semen limits** — `mfr.controller.js:122-171` (conc <16, count <39, vol <1.4, motility
    <42, progressive <30, vitality <54, morphology <4, pH <7.2; Severe <5).
  - **Diabetic HbA1c gate + glucose bands** — `chronic.controller.js:103-104` (6.5 / 5.7); duplicated
    in `reportSummary.service.js:497` (classifyLevel 5.7/6.5).
  - **HbA2 thalassemia cutoff 3.5%** — `reportSummary.service.js:63`.
  - **IDRS band → LR mapping** — `chronic.controller.js:222-230` (≥60→1.82, ≥30→1.1, else 0.46) and
    the IDRS point bands `chronic.controller.js:35-48`.
  - **DEXA T-score bands** — `dexa.score.js` (−1.0 / −1.5 / −2.0 / −2.5 → 100/80/60/40/20).
  - **Ovarian-reserve AMH/AFC age-band cutoffs** — `mfr.controller.js:41-88` (four age bands × four
    tiers, the largest single block of magic numbers in the repo).
  - **Lipid ATP-III bands** — `chronic.controller.js:108-116` and the LDL bands in
    `reportSummary.service.js:363,499`.
  - **BP bands** — `chronic.controller.js:94-99`; **waist bands** — `chronic.controller.js:87-88`.
  - **Vitamin D <30** — `reportSummary.service.js:494`; **TSH 0.35-5.0** —
    `reportSummary.service.js:488`; **kidney creatinine/BUN** — `reportSummary.service.js:483-484`.
  - **Radiology organ deductions & modality weights** — `abdomen.score.js`, `dexa.score.js`,
    `schemaRegistry` nuptiaWeights.
- Inputs needed: none (pure refactor); no new capture.
- Benefit: Guideline updates become a single reviewed diff with provenance; kills the current
  duplication drift (HbA1c 5.7/6.5 is hardcoded in two files that must be kept in sync by hand);
  makes the "Doctor Reviewed"/version claims substantiable; enables A/B or region-specific cutoff
  sets later.
- Effort: M (mechanical but touches every engine — sequence carefully with a test snapshot first)
- Risk / claim considerations: Behaviour-preserving if values are copied verbatim; add a golden-master
  test that asserts identical outputs before/after the extraction so the refactor can't silently
  change a score. This is a prerequisite that makes every other threshold proposal here cheap.
- Guideline basis: n/a (infrastructure) — but it is what lets the medical items carry real refs.

---

# Category 3 — Sub-scores that add noise; remove or reweight

### OPP-W4-16 — Re-examine the 10% genetics slice built on a single coarse 100/75/50 HbA2 read
- Rationale: The genetics composite contribution is `100 / 75 / 50` by carrier-pair status computed
  from HbA2 alone (`reportGeneration.service.js:77-86`), weighted 10% (109-112). Three problems: (a)
  the sub-score has only three possible values, so its 10% slice moves the composite in ~5-point
  quanta regardless of the actual clinical picture; (b) it fires only when HbA2 is present, and when
  it doesn't fire the 10% is renormalized away — so the "10% genetics" is illusory for most couples;
  (c) it ignores the variant fractions and CBC indices (OPP-W4-04/06) that would make it a real
  screen. Options: fold OPP-W4-04/06 in to give the sub-score real resolution, OR drop it from the
  numeric composite entirely and surface carrier risk as a **standalone gate/flag** (like the STI
  gate) rather than a diluted 10% average — a both-carriers pairing is a discrete "see a counsellor"
  finding, not a −25-point score nudge.
- Inputs needed: already-extracted (see OPP-W4-04/06).
- Benefit: Either a genetics slice that carries real signal, or an honest removal of a slice that
  currently adds quantization noise while pretending to be a tenth of the score.
- Effort: M
- Risk / claim considerations: A carrier-pair finding is clinically a flag, not a score decrement —
  the flag framing is both more correct and lower claim-risk than averaging it into a compatibility %.
- Guideline basis: autosomal-recessive carrier-pair counselling (both-carriers = 25% affected/child).

### OPP-W4-17 — Re-examine the 10% radiology slice given its coarse modality sub-scores and double normalization
- Rationale: The radiology contribution is a weighted average of modality scores, several of which are
  coarse step functions — `dexaScore` returns 100/80/60/40/20 (`dexa.score.js`), `prostateScore`
  returns 100/80/55/30 (`abdomen.score.js:26-29`) — normalized to 0-30 (`nuptia.composite.score.js:102`)
  and then re-expanded back to 0-100 via `(c/30)*100` in `reportGeneration.service.js:27` before
  taking 10% (105-108). DEXA and USG_NECK each carry only 0.02 weight (`schemaRegistry` nuptiaWeights)
  — so a normal-vs-osteoporotic DEXA moves the couple's overall compatibility score by ~0.2×0.10 =
  ~0.02 points: statistically invisible, yet presented as if it counts. The double 0-30→0-100
  round-trip also adds no information. Proposal: keep the *worst-modality cap* (which is the real
  safety value, nuptia.composite:97-98 / abdomen:155-158) but reconsider whether the *averaged* 10%
  slice earns its place, or whether radiology should contribute only via (a) its severe-finding cap
  and (b) discrete flags, not a diluted average.
- Inputs needed: none new.
- Benefit: Removes false-precision (a 5-tier DEXA that can't move the needle) while preserving the
  genuinely protective worst-modality mechanism.
- Effort: M
- Risk / claim considerations: Do **not** touch the worst-modality caps (they're the WS0-confirmed
  safety behaviour) — only reconsider the averaged-slice contribution and the redundant renormalization.
- Guideline basis: n/a (modeling).

### OPP-W4-18 — Remove or rebuild the "10-year projection" curves (false precision)
- Rationale: Both projections are cosmetic. Chronic uses a fixed `1.05^y` odds drift identical in
  shape for everyone (`chronic.controller.js:272-315`), and simultaneously ships a *second*,
  inconsistent IDRS-vs-age curve recomputed at `age+y` (307-312) that the odds curve ignores — two
  aging models that visibly disagree (confirmed WS1A09). MFR projects with a hard `fa>=45→0` cliff
  (`mfr.controller.js:29,485-493`) while still displaying a positive `female_base_score` at 45+
  (confirmed WS1B07). Neither curve re-derives risk from aged inputs, so "personalized 10-year
  projection" is essentially one shape scaled. Options: (a) **remove** the year-by-year curves and
  show a single directional statement; or (b) **rebuild** them to recompute odds each year from the
  aged IDRS band, aged biomarker drift, and (MFR) the smoothly-decaying FEM table — and reconcile the
  two chronic curves onto one aging model.
- Inputs needed: none new (both rebuild options use existing inputs).
- Benefit: Stops presenting a per-couple projection that is the same curve for everyone; removes the
  two-disagreeing-graphs artifact and the base-score-vs-0%-probability contradiction.
- Effort: M
- Risk / claim considerations: "Projection" framing implies predictive validity the current curves
  don't have — a claim-risk reduction to either remove or genuinely derive them.
- Guideline basis: n/a (modeling / claims).

### OPP-W4-19 — Reweight/redesign the mental headline so it isn't pure answer-agreement; assess pillar redundancy
- Rationale: The 20% mental slice is driven by `overall_readiness.score`, a pure |A−B| agreement
  index over 18 items (`mental.controller.js:217-237`), which routes a *jointly-unhealthy* couple's
  100 "Highly Aligned" into the composite (confirmed WS1C01) while the per-partner quality scores
  (overall_A/overall_B) — the numbers the research doc §6 says actually predict outcomes — never reach
  the headline or the composite. Separately, two pillars look partly redundant: `lifestyle_alignment`
  (Q17, daily-rhythm) overlaps `personality_extraversion` (Q6, social energy) and the doc itself
  (§Q17) concedes they can diverge but are adjacent; and the risk/attachment/anger items carry zero
  headline weight (WS1C04/05). Proposal: feed a blend of agreement AND per-partner quality into the
  composite (e.g. `min(agreementIndex, mean(overall_A, overall_B))`, or gate the "Highly Aligned"
  label on both overalls clearing a floor); and reconsider whether extraversion and lifestyle both
  deserve full independent weight.
- Inputs needed: none new (all computed already; `pillar_scores` and `overall_A/B` are in the payload).
- Benefit: Fixes the actively-misleading positive for a struggling couple; makes the safety-relevant
  pillars (risk, attachment) actually move the surfaced number.
- Effort: M
- Risk / claim considerations: Changing `overall_readiness.score` semantics touches the composite
  (reportGeneration:101-103), PDF, and dashboard — sequence with WS1C01's fix. This is a
  user-trust/claim improvement, not just a tuning knob.
- Guideline basis: research doc §5.4, §6 (Luo & Klohnen 2005 — individual trait level predicts
  marital quality more consistently than partner similarity).

---

# Category 4 — The unbuilt mental items

### OPP-W4-20 — Build the DAST-based recreational-drug-use item under the Risk pillar
- Rationale: The Risk Factors pillar is alcohol-only: it averages `subMap[substance_concern]`
  (alcohol tiers, `mental.controller.js:173-175`) with anger regulation (177-184). The product spec
  called for a separate DAST-based recreational-drug item that was **never implemented** (research doc
  §Q20 lines 395-400, §7.4 lines 537-547; confirmed WS1C08). Without it the pillar — and the whole
  "risk" framing shown to users — is blind to illicit-substance use, arguably the higher-severity half
  of the substance-risk construct.
- Inputs needed: **new capture** — one categorical self-report item modeled on DAST-10 tiering (e.g.
  none / occasional / regular), added to `mentalHealthQuestions.js` under the `habits` category and to
  `REQUIRED_MENTAL_FIELDS` (mental.controller.js:17-25). No backend math change beyond adding a third
  term to the risk average.
- Benefit: Restores designed coverage; makes the "Composure & Substance Habits" screen honest about
  what it screens. Practically low score-impact today (risk never touches the headline — WS1C01/05),
  so this is coverage/claim honesty more than a score fix — but pairs naturally with OPP-W4-19
  (giving risk headline weight).
- Effort: S (one categorical item + one map entry)
- Risk / claim considerations: Frame informationally and non-judgmentally, matching the existing
  alcohol item's stance; a single self-report item is a *discussion prompt*, not a DAST diagnosis —
  don't imply the validated DAST-10's psychometrics (research doc §7.1).
- Guideline basis: Skinner HA, *The Drug Abuse Screening Test*, Addict Behav. 1982;7(4):363-371.

### OPP-W4-21 — Build the ACE / "Personal Background & Life Experiences" section
- Rationale: The spec also called for a non-scored "Personal Background & Life Experiences" section
  (family-conflict exposure, prior relationships, prior counselling — explicitly "instead of a full
  ACE trauma score"), likewise **never implemented** (research doc §7.4 lines 537-547). Trauma/adverse
  childhood experience history is entirely uncaptured by an engine positioned as a marriage-readiness
  screen — a genuine content gap in the risk-factors coverage.
- Inputs needed: **new capture** — a small set of self-report items presented as informational
  (explicitly non-scored, per the original design), surfaced only in the narrative/discussion layer.
- Benefit: Fills the designed-but-absent trauma/background coverage; gives the counselling-style
  narrative real material; closes the spec/shipped-product gap the research doc flags for transparency.
- Effort: M (new UI section; deliberately no scoring integration)
- Risk / claim considerations: **High sensitivity** — ACE-adjacent items must be optional,
  clearly-framed, non-diagnostic, and never scored into a compatibility number (the original design
  was explicit about "instead of a full ACE trauma score"). Needs product/clinical/privacy sign-off
  before build. Keep it a discussion aid, not a risk metric.
- Guideline basis: Felitti VJ et al., ACE Study, Am J Prev Med. 1998;14(4):245-258 (as the framing
  reference, not an instrument to score).

---

# Category 5 — Borderline / grey-zone handling

### OPP-W4-22 — Explicit HbA2 3.5–4.0% borderline zone in the thalassemia screen
- Rationale: `evaluateThalassemiaCarrierRisk` classifies HbA2 as a hard binary at 3.5%
  (`reportSummary.service.js:60-63`: `val > 3.5 ? 'red' : 'green'`). The 3.5–4.0% band is a
  recognised borderline zone (silent beta-thal, delta-beta interactions, concurrent iron deficiency
  can lower HbA2) where the correct action is repeat/co-interpret, not a firm "carrier" or "clear."
- Inputs needed: **already extracted** (HbA2 value; combine with iron status from OPP-W4-05).
- Benefit: Replaces a knife-edge red/green at 3.5 with red / **borderline** / green, and (with
  OPP-W4-05) can note when a low-borderline HbA2 co-occurs with iron deficiency (which masks
  thalassemia trait). More clinically correct and less over/under-calling.
- Effort: S/M
- Risk / claim considerations: Borderline → "confirmatory/repeat testing recommended," never a
  diagnosis. Lower claim-risk than the current binary assertion.
- Guideline basis: HbA2 thalassemia-trait interpretation incl. borderline 3.5-4.0 and iron-deficiency
  confounding — validation pass.

### OPP-W4-23 — Add borderline bands to ovarian-reserve classification
- Rationale: `classifyOvarianReserve` uses hard age-banded cutoffs producing four discrete tiers with
  a knife-edge at every boundary (`mfr.controller.js:41-88`), and "Very Low" is promoted straight to a
  hard gate (456). A value one decimal below a cutoff flips Normal→Low with no grey zone, and a
  borderline-low AMH near the Very-Low boundary hard-blocks natural conception. Proposal: add an
  explicit borderline/indeterminate band near each cutoff (or carry a confidence flag), and reserve
  the hard gate for genuinely very-low values rather than anything below a bright line.
- Inputs needed: **already extracted** (needs OPP-W4 AFC ontology entry to use AFC as designed).
- Benefit: Smooths score cliffs; prevents a single near-threshold AMH from hard-gating a couple to
  ART (severity-relevant given WS1B04's negative-AMH gate hazard); supports "borderline — repeat AMH /
  add AFC" advisories.
- Effort: M
- Risk / claim considerations: Combine with WS1B04's plausibility guard (reject negative/absurd AMH)
  so borderline logic never fires on garbage. Borderline → recommend confirmatory AFC/repeat, don't
  assert.
- Guideline basis: age-specific AMH/AFC reference bands — validation pass.

### OPP-W4-24 — Surface prediabetes/borderline in the sugar card (not just chronic's internal band)
- Rationale: The chronic engine already distinguishes a Borderline glucose category
  (`chronic.controller.js:104`, HbA1c 5.7-6.4), but the reportSummary sugar card collapses to a binary
  `<5.7` strength vs else opportunity (`reportSummary.service.js:350`) and its card status band
  `classifyLevel(hba1c,5.7,6.5)` (497) yellows the 5.7-6.4 range but the headline/next-action copy
  reads as a plain "borderline" without naming prediabetes or the reversibility window. Make the
  card's borderline state explicit and consistent with the chronic engine's own Borderline tier.
- Inputs needed: **already extracted**.
- Benefit: One consistent prediabetes story across the chronic engine and the presentation card; a
  clearer, more actionable message for the most common abnormal-sugar case.
- Effort: S
- Risk / claim considerations: Wording only; keep non-diagnostic.
- Guideline basis: ADA prediabetes HbA1c 5.7-6.4.

---

# Category 6 — Confirmatory-test logic for the STI gate

### OPP-W4-25 — Move the STI gate from "active infection asserted" to a screening→confirmatory model
- Rationale: A reactive premarital serology screen (VDRL/RPR, HBsAg, anti-HCV, HIV-Ab) is a
  *screening* result requiring confirmation (TPHA/FTA-ABS for syphilis, HBV DNA/repeat for HBsAg, HCV
  RNA for anti-HCV, Western blot / repeat-algorithm for HIV) — yet the gate currently emits definitive
  assertions like "Active Syphilis … detected" and "HBsAg is Reactive … indicating active Hepatitis B
  infection" (`reportSummary.service.js:150,183`; UI "Active {sti} Detected" at 334). This is both
  clinically overstated (a single reactive screen ≠ confirmed active infection; false positives occur,
  esp. VDRL biological false-positives) and a meaningful claim/liability exposure. In parallel, the
  gate silently treats equivocal/indeterminate results as *clear* (confirmed WS0-04) and can miss
  "Positive"/"Detected"-vocabulary results (confirmed WS0-02/03). Proposal: a three-state model —
  **non-reactive → clear**, **reactive/positive → "confirmatory testing recommended before
  marriage"** (still caps the score and flags, but asserts a *screen* not a diagnosis),
  **equivocal/indeterminate/borderline → "repeat/confirmatory testing recommended"** (non-blocking
  advisory, WS0-04). Optionally use the extracted OD/S-CO ratio params
  (`hbsag_od_value_signal_to_cutoff_ratio` 903, `anti_hcv_od_value...` 922, `hiv_combo_assay_od_value...`
  973) and `rpr_titre_if_reactive` (882) to grade screen strength.
- Inputs needed: **already extracted** (result strings + OD/titre params are all in the ontology and
  the gate already reads the result strings, reportSummary.service.js:143-197).
- Benefit: Clinically correct (screen vs confirmed), lowers claim/liability risk on the single
  highest-stakes assertion the product makes, and closes the equivocal-treated-as-clear gap — all
  while preserving the score cap and the safety flag (so it's not a safety regression).
- Effort: M (rewrite gate copy + add the equivocal state; coordinate with WS0-02/03's vocabulary fix
  and the shared `isReactivePositive()` helper proposed there so both land together)
- Risk / claim considerations: This is primarily a **claim-risk reduction**. Keep the score cap and
  the "seek specialist consultation" action; only the *diagnostic certainty* of the language changes
  (from "active infection detected" to "reactive screen — confirmatory testing required"). Sequence
  after WS0-02/03/05 (matcher breadth + shared constants) so the confirmatory wording sits on a gate
  that actually fires reliably.
- Guideline basis: NACO HIV testing algorithm (reactive screen → confirmatory); syphilis
  treponemal-confirmation of reactive non-treponemal; HCV RNA-confirmation of anti-HCV; HBsAg
  repeat/neutralization — validation pass to confirm exact current Indian conventions.

---

## Appendix — proposals that also resolve a confirmed WS0/WS1 finding (for the implementer's sequencing)

- OPP-W4-01 resolves **WS1A03** (fasting-glucose diabetic missed).
- OPP-W4-02 / OPP-W4-13 build on **WS1A11** (HDL/HOMA/CRP captured, unused).
- OPP-W4-18 resolves **WS1A09** (two inconsistent chronic aging models) and **WS1B07** (age-45 cliff
  vs displayed base score).
- OPP-W4-19 resolves **WS1C01** (agreement-index headline for unhealthy couples) and touches
  **WS1C04/05/07** (risk/attachment carry no headline weight).
- OPP-W4-20 / OPP-W4-21 resolve **WS1C08** (unbuilt DAST + ACE).
- OPP-W4-23 should be built alongside **WS1B04** (negative-AMH plausibility guard).
- OPP-W4-25 resolves **WS0-04** (equivocal treated as clear) and must be sequenced with
  **WS0-02/03/05** (STI matcher breadth + shared canonical constants).
- OPP-W4-15 (versioned thresholds) is the low-risk enabler that makes every other threshold proposal
  a cheap, provenance-tagged data change.
