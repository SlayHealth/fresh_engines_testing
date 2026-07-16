# WS5 — Ideation: entirely NEW engines

Scope: evidence-grounded ideation only (READ-ONLY, no implementation). Every proposal is anchored to
data the repo **already captures** (ontology / radiology schemas) or to a specific, low-lift new-capture
field, with `file:line` citations. Opportunity entries use the OPP-W5-NN format from `_review_schema.md`.
A later validation pass verifies the named guidelines — guideline names here are the *basis to check*,
not asserted fact.

Two tiers:
- **Tier 1 — captured-but-unscored → new engine** (lowest lift, highest confidence). Systematic sweep of
  the ~156 pathology params (`ontologyMapper.service.js`) and the radiology schemas, keeping only signals
  that are extracted, displayed, or otherwise in-hand but turned into **no couple-relevant insight**.
- **Tier 2 — adjacent engines that fit the premarital/couple framing** (may need new capture).

### Method / how "unscored" was confirmed
For each Tier-1 signal I grepped the whole `backend/src` tree for consumers and excluded the three
non-scoring layers (`ontologyMapper.service.js` = extraction, `testCoverage.service.js` = the
did-this-PDF-contain-it map, `sectionDetector.service.js` = section routing). A param that appears ONLY
in those three (or nowhere) is captured-but-unscored. Commands and results are summarized inline per entry.

### What is ALREADY consumed (so it is NOT re-proposed here)
- Chronic engine (`chronic.controller.js`): age, waist, activity, BP, glucose(HbA1c only), lipids(TC/LDL/TG),
  parentDiabetes, 5 lifestyle factors. (HDL/HOMA/hs-CRP captured into `rawValues` but never read — WS1A11.)
- Fertility engine (`mfr.controller.js`): ages, AMH/AFC, semen (conc/count/motility/progressive/vitality/
  morphology/pH), Tier-2 radiology (USG pelvis/scrotum/abdomen), Tier-3 genomics (yDeletion AZFa/b/c,
  male+female karyotype, MTHFR, CFTR/CBAVD).
- Mental engine (`mental.controller.js`): 21-item questionnaire.
- Genetics: `evaluateThalassemiaCarrierRisk` consumes **HbA2 only** (`reportSummary.service.js:54-88`).
- STI safety gate: VDRL/RPR, HIV Ab, HIV p24, HBsAg, anti-HCV (`reportSummary.service.js:125-207`).
- Radiology composite (`nuptia.composite.score.js`): USG abdomen/pelvis/TVS/scrotum, ECHO, ECG, DEXA.
- Body-health cards (`reportSummary.service.js:497-508`): HbA1c, LDL, ALT, creatinine/BUN, TSH(+AMH), Vit D.

---

## TIER 1 — EXEMPLAR (fully specified)

### OPP-W5-01 — Rh-incompatibility / Hemolytic Disease of the Newborn (HDN) risk engine
- **Rationale:** Rh factor is extracted for both partners (`ontologyMapper.service.js:18` `rh_factor_positive_negative`)
  and is explicitly a suggested premarital test (`frontend/src/constants/suggestedTests.js:3` "Blood Group — Rh
  (Rhesus) Typing") and listed in the coverage map as *"Rh compatibility — relevant for pregnancy planning"*
  (`testCoverage.service.js:22-26`). Yet **no engine consumes it** — grep for `rh_factor_positive_negative`
  across `backend/src` (excluding ontology/testCoverage) returns zero hits. This is the calibration shape
  exactly: a real, low-lift, couple-framed signal that is captured, displayed as a checkbox in the coverage
  UI, and then dropped.
  The clinical model is simple and well-established: if the **prospective mother is Rh-negative and the
  prospective father is Rh-positive**, a future fetus can be Rh-positive, risking maternal alloimmunization
  and Hemolytic Disease of the Fetus/Newborn (HDFN) in the *second and subsequent* Rh-positive pregnancies.
  This is precisely a premarital/pre-conception planning insight (it changes antenatal management — anti-D
  immunoglobulin prophylaxis), and it is a *couple*-level fact (needs both partners' types), which is the
  product's entire framing.
- **Inputs needed:**
  - **Already available:** `rh_factor_positive_negative` for each partner (`ontologyMapper.service.js:18`);
    the gender/role resolver already exists (`ontologyMapper.service.js:1627 resolveGenderRole`) so the
    engine can identify which partner is the prospective mother. Values arrive as "Positive"/"Negative"
    (with the same "Positive/Negative vs Reactive/Non-Reactive" vocabulary caveat WS0-02/03 raised — reuse
    a single normalizer). Optional strengthening: `blood_group_a_b_ab_o` (`:5`) for ABO co-assessment
    (see OPP-W5-08).
  - **New capture (optional, for depth):** whether this is a first pregnancy / prior pregnancies / prior
    anti-D — improves specificity but is NOT required for the core "at-risk couple" flag.
- **Benefit:** A genuinely actionable, guideline-backed pregnancy-planning insight for the ~5-10% of Indian
  couples who are Rh-discordant in the at-risk direction; fills a gap the product already advertises
  ("relevant for pregnancy planning") but does not deliver. Slots cleanly into the existing
  `carrier_pair_risk`/`family_planning` presentation sections and could contribute a small weighted term or
  (better) a non-scoring advisory card so it never dilutes the composite.
- **Effort: S.** Pure function over two already-extracted string values; add a presentation card and (if
  desired) a boolean advisory. No new extraction, no new UI capture for the core flag.
- **Risk / claim considerations:** Frame as **planning guidance, not diagnosis** — "If you plan a pregnancy,
  discuss Rh status and anti-D prophylaxis with your obstetrician." Must NOT be framed as a
  marriage-compatibility barrier (an Rh-discordant couple is perfectly compatible; HDN is fully managed
  clinically) — mis-framing here is a real user-harm/anxiety risk in the Indian matchmaking context where
  "blood group compatibility" is already a superstition magnet. Does not push SaMD classification if kept as
  a "talk to your doctor" advisory rather than a management instruction. Only the *mother-Rh-negative +
  father-Rh-positive* direction is at-risk; do not flag the reverse.
- **Guideline basis (validate):** RCOG Green-top Guideline No. 22 (anti-D prophylaxis); ACOG Practice
  Bulletin on prevention of Rh alloimmunization; NICE guidance on routine antenatal anti-D. Core biology:
  Rh(D) alloimmunization / HDFN.

---

## TIER 1 — RANKED MENU (captured-but-unscored)

### OPP-W5-02 — Rubella immunity / pre-conception vaccination-gap engine (prospective mother)
- **Rationale:** Rubella IgG is extracted as **both** a quantitative titre and an immune/non-immune
  interpretation (`ontologyMapper.service.js:1000 rubella_igg_antibody_quantitative_iu_ml`, `:1010
  rubella_igg_interpretation_immune_non_immune`), is a suggested test (`suggestedTests.js:23` "Rubella Virus
  IgG Antibody — Female Only"), and the coverage map labels it *"Pregnancy-safety immunity check"*
  (`testCoverage.service.js:113-116`). **No engine consumes it** (grep `rubella_igg` outside ontology/
  testCoverage = 0 hits). A **non-immune** prospective mother should receive MMR vaccination and then avoid
  conception for ~1 month — this is one of the highest-yield pre-conception actions in existence and is
  time-sensitive relative to a wedding date, making it a perfect premarital insight. Congenital Rubella
  Syndrome is severe and entirely preventable.
- **Inputs needed — already available:** `rubella_igg_interpretation_immune_non_immune` (categorical) as
  primary; `rubella_igg_antibody_quantitative_iu_ml` with the standard ≥10 IU/mL immune threshold as
  fallback when only the number is present. Female-role detection already exists (`resolveGenderRole`).
- **Benefit:** Converts an already-captured, currently-inert value into a concrete, urgent, dated action
  ("vaccinate before trying to conceive"). Fits `family_planning` / a pre-conception checklist card.
- **Effort: S.** One categorical/threshold read + one advisory card.
- **Risk / claim considerations:** Advisory framing ("discuss MMR with your doctor before conceiving").
  Applies to the prospective mother only. Low SaMD exposure. Do **not** present as a compatibility penalty.
- **Guideline basis (validate):** ACOG / CDC ACIP pre-conception rubella immunity & MMR timing; WHO CRS
  prevention. ≥10 IU/mL conventional immunity cutoff.

### OPP-W5-03 — Pre-conception nutrition engine (B12 + Vitamin D + iron stores)
- **Rationale:** Vitamin B12 (`ontologyMapper.service.js:786 vitamin_b12_cobalamin_serum`) is captured, is a
  suggested test flagged *"Essential for DNA synthesis"* (`suggestedTests.js:10`), and is **never consumed**
  (grep = 0 hits outside ontology/testCoverage). Vitamin D (`:1507`) *is* read for a single body-health card
  (`reportSummary.service.js:250-251,492-495`) but only as an isolated green/yellow tile — not framed for
  pre-conception. Iron stores (`serum_ferritin :576`, `serum_iron :537`, `transferrin_saturation :566`,
  `total_iron_binding_capacity_tibc :546`) are captured and **never scored**. India has extremely high
  prevalence of B12 deficiency (vegetarian-dominant diet), vitamin D deficiency, and low iron stores —
  precisely the couple-nutrition optimization window before pregnancy. Low periconceptional B12 (like low
  folate) is associated with neural-tube-defect and adverse-pregnancy risk and with elevated homocysteine.
- **Inputs needed — already available:** B12, Vit D, ferritin, transferrin saturation, TIBC per partner
  (all above). **New capture (optional):** serum folate is **not** in the ontology today — a genuine gap; the
  engine can be built on B12+D+iron now and folate added later (see note). Both partners assessed; the
  prospective mother's values carry pregnancy weight.
- **Benefit:** A "couple nutrition readiness" card with specific, cheap, correctable actions
  (supplementation) — high perceived value, strong India fit, and it reuses the exact same per-partner-null
  honesty pattern the body-health cards already use (`getPartnerNumeric`, `reportSummary.service.js:23-26`).
- **Effort: S/M.** Three threshold reads + a combined card; M if a small weighted contribution is wanted.
- **Risk / claim considerations:** Nutritional advisory, low SaMD risk. Avoid over-claiming NTD prevention
  from B12 alone (folate is the primary NTD lever and is not yet captured) — frame as general
  pre-conception nutrition optimization, not a fetal-outcome guarantee.
- **Guideline basis (validate):** FIGO pre-conception nutrition recommendations; ICMR-NIN RDA (India);
  WHO/ICMR B12 & vitamin D deficiency cutoffs; periconceptional folate/B12 and NTD literature.

### OPP-W5-04 — Anemia engine (CBC-driven; pregnancy-relevant, esp. prospective mother)
- **Rationale:** Hemoglobin (`ontologyMapper.service.js:39 hemoglobin_hb`), MCV (`:60`), MCH, MCHC, RDW, plus
  the iron studies above are all captured. The CBC is a suggested test (`suggestedTests.js:4`) whose coverage
  label is only *"General blood health baseline"* (`testCoverage.service.js:28-31`) and **no engine scores
  it** (grep `hemoglobin_hb`/`mean_corpuscular_volume_mcv` outside ontology/testCoverage = 0). India has
  >50% anemia prevalence in women of reproductive age; anemia is a leading modifiable pre-pregnancy risk
  (maternal morbidity, low birth weight). Critically, **MCV lets the engine distinguish causes**: microcytic
  (MCV<80) + low ferritin → iron-deficiency (correctable); microcytic + *normal/high* ferritin → screen for
  thalassemia trait (hands the thalassemia carrier engine a second, cheaper trigger); macrocytic (MCV>100)
  → B12/folate deficiency (ties to OPP-W5-03).
- **Inputs needed — already available:** Hb, MCV, ferritin, transferrin saturation, RDW per partner. WHO Hb
  cutoffs (non-pregnant women <12 g/dL, men <13 g/dL) for anemia; MCV 80/100 for morphology.
- **Benefit:** A clinically standard, high-prevalence, correctable finding with a clear couple/pregnancy
  narrative and cross-links to nutrition (OPP-W5-03) and thalassemia (carrier engine). Natural new
  body-health card ("Iron & Blood").
- **Effort: S/M.** Threshold + morphology classifier; M if it feeds the composite.
- **Risk / claim considerations:** Advisory. A microcytic-with-normal-ferritin flag should say "consider
  thalassemia screening," not assert thalassemia. Low SaMD.
- **Guideline basis (validate):** WHO Haemoglobin thresholds (2011/2024); ICMR "Anemia Mukt Bharat"; standard
  microcytic/macrocytic MCV workup.

### OPP-W5-05 — Hemoglobinopathy carrier extension (HbS / HbE / HbD / HbC) — fixes a live data discrepancy
- **Rationale:** The genetics engine's `evaluateThalassemiaCarrierRisk` **hardcodes** a
  `hemoglobin_variant` card to gray/"Not assessed" with the comment *"Hemoglobin variant (sickle/C/D/E)
  screening requires an HPLC report that was not part of this analysis"* and *"isn't currently extractable
  from our pathology ontology"* (`reportSummary.service.js:47-52, 100-108`). **This is factually wrong given
  the ontology:** `hemoglobin_s_hbs` (`ontologyMapper.service.js:616,725`), `hemoglobin_e_hbe` (`:646`),
  `hemoglobin_d_hbd` (`:636,705`), `hemoglobin_c_hbc` (`:626,695`), and HbF (`:605,715`) are all canonical
  params — they ARE extractable. So this is both a **finding** (a self-described-as-impossible card that the
  data would support) and an engine opportunity. Sickle-cell trait is highly prevalent in central/tribal
  India and in specific communities; HbE trait is common in the east/northeast. Carrier-pair genetics for
  these is the same autosomal-recessive couple logic already used for beta-thalassemia (both partners
  trait-positive → 25% affected child), and clinically important compound states exist (HbS/β-thal, HbE/β-thal,
  HbS/HbC).
- **Inputs needed — already available:** the five variant fractions + HbA2 (already used) per partner from an
  HPLC report. The extractor's own gender/section handling already routes these to the `cbc` section.
- **Benefit:** Extends the *existing* carrier-pair engine to the variants the product's genomics list already
  advertises (`suggestedTests.js:38` "Sickle Cell / HbS", `:39` alpha-thal), and removes a currently-shipped
  false "not extractable" statement. Highest-value genetics upgrade for the India context.
- **Effort: M.** Reuse `evaluateThalassemiaCarrierRisk`'s red/green/gray + both-carriers pattern per variant;
  add compound-heterozygote logic (HbS+β-thal, HbE+β-thal). Coordinate with the WS composite genScore
  (`reportGeneration.service.js:77-86`) which currently keys only on thalassemia status.
- **Risk / claim considerations:** Carrier screening is a recognized, non-diagnostic premarital use;
  present with "confirm with a genetic counselor," matching the existing thalassemia narrative. A both-carriers
  finding is high-stakes — keep the counselor-referral framing the existing engine already uses. Watch
  variant-threshold definitions (trait vs disease) in the validation pass.
- **Guideline basis (validate):** ACOG Committee Opinion on hemoglobinopathy carrier screening; Indian
  premarital thalassemia/sickle-cell screening programs (ICMR); compound-heterozygote clinical genetics.

### OPP-W5-06 — Thyroid–fertility / pre-conception thyroid engine
- **Rationale:** TSH (`ontologyMapper.service.js:735`) is read only for a generic "hormones" body-health card
  with a **wide 0.35–5.0 mIU/L abnormal band** (`reportSummary.service.js:488`). FT4 (`:776`), FT3 (`:766`),
  total T4 (`:756`), total T3 (`:746`) are **entirely unconsumed** (grep = 0 outside ontology). But
  pre-conception/early-pregnancy thyroid targets are much tighter than 5.0: subclinical hypothyroidism
  (TSH above ~2.5–4.0 depending on trimester/guideline) is linked to reduced fertility, miscarriage, and
  impaired fetal neurodevelopment, and is trivially treatable. The current wide band means a prospective
  mother with TSH 4.5 (clinically relevant pre-conception) reads "balanced/green."
- **Inputs needed — already available:** TSH primary; FT4 to distinguish overt vs subclinical; optional TPO
  antibody is NOT in the ontology (a gap to note). Female-role detection exists.
- **Benefit:** A tighter, pregnancy-aware thyroid read for the prospective mother, plus a fertility tie-in
  (could feed `mfr` as a soft modifier). Reuses existing TSH extraction.
- **Effort: S/M.** Re-band TSH by pre-conception targets + read FT4; S if standalone card, M if it modifies
  the fertility engine.
- **Risk / claim considerations:** Advisory; "discuss thyroid optimization before conceiving." Do not
  auto-diagnose hypothyroidism. Note the current 0.35–5.0 band is itself arguably too lax for the
  pre-conception claim (candidate correction, cross-ref reportSummary hormones card).
- **Guideline basis (validate):** ATA 2017 Guidelines for thyroid disease in pregnancy/pre-conception
  (trimester-specific TSH); Endocrine Society; ICMR.

### OPP-W5-07 — Pre-conception glycemic optimization (beyond the diabetes gate)
- **Rationale:** The chronic engine *gates* frank diabetes but produces **no pre-conception glycemic
  narrative**, and (WS1A03) reads glucose from HbA1c only — it never reads `fasting_blood_glucose_fbg`
  (`ontologyMapper.service.js:315`) or `estimated_average_glucose_eag` (`:351`). Separately, HbA1c 5.7–6.4%
  (prediabetes) carries **no** couple insight today. For a prospective mother, periconceptional
  hyperglycemia (even HbA1c in the high-normal/prediabetic range) raises congenital-malformation and
  miscarriage risk, and pre-conception HbA1c reduction (<6.5%, ideally <6.0%) is a first-line intervention.
  This is a distinct engine from cardiovascular diabetes risk: same input, different (pregnancy-outcome)
  question.
- **Inputs needed — already available:** HbA1c, FBG, eAG per partner. `getPartnerHba1c`
  (`reportSummary.service.js:37-42`) already converts eAG→HbA1c-equivalent — reuse it, and add FBG (≥126
  diabetic / 100–125 prediabetic thresholds) to close the WS1A03 single-source gap at the same time.
- **Benefit:** Turns an already-common lab into a targeted pre-pregnancy action for the woman, and
  incidentally strengthens the diabetes detection the chronic engine misses.
- **Effort: M.** New pregnancy-framed classifier + card; coordinate with chronic engine glucose detection.
- **Risk / claim considerations:** Advisory; "optimize sugars before conceiving." Malformation-risk language
  must be gentle and doctor-referred, not alarmist. Keep separate from the diabetes *compatibility* gate so
  it never double-penalizes.
- **Guideline basis (validate):** ADA Standards of Care — Management of Diabetes in Pregnancy /
  pre-conception; congenital-anomaly vs periconceptional HbA1c evidence.

### OPP-W5-08 — ABO blood-group + ABO-HDN engine (careful-framing companion to OPP-W5-01)
- **Rationale:** ABO group is extracted (`ontologyMapper.service.js:5 blood_group_a_b_ab_o`), suggested
  (`suggestedTests.js:2`), coverage-labeled *"Blood group compatibility"* (`testCoverage.service.js:17-21`),
  and **unconsumed**. There is real but *modest* signal: an **O-group mother with an A/B/AB father** can have
  ABO-HDN (typically mild, unlike Rh). Pairs naturally with OPP-W5-01 into one "Blood & pregnancy" card.
- **Inputs needed — already available:** ABO group both partners (+ Rh from OPP-W5-01).
- **Benefit:** Completes the "Blood Group compatibility" coverage claim the app already makes, with a real
  (if minor) mechanism instead of leaving the extracted value inert.
- **Effort: S.**
- **Risk / claim considerations: HIGH framing risk.** "Blood group compatibility for marriage" is a
  widespread pseudoscience in the Indian matchmaking market. This engine must **actively debunk** the myth
  (ABO/Rh discordance does **not** affect marriage suitability) while surfacing the narrow, real ABO/Rh-HDN
  planning point. Getting this wrong would lend the app's authority to a superstition — a user-trust and
  arguably ethical hazard. Recommend building ONLY alongside OPP-W5-01's obstetric framing, never as a
  standalone "compatibility" score.
- **Guideline basis (validate):** ABO hemolytic disease of the newborn literature; blood-group genetics.

### OPP-W5-09 — Maternal cardiac-risk surfacing from ECHO/ECG (data scored, insight buried)
- **Rationale:** ECHO and ECG are scored into the radiology composite (`nuptia.composite.score.js:63-78`)
  but individual high-stakes findings are **not surfaced as a discrete pre-marriage/pregnancy risk**. The
  ECHO schema captures valve grades, LVEF, PAH severity, diastolic dysfunction
  (`schemas/echo.schema.js:12-41`) and ECG captures rhythm incl. atrial fibrillation, QTc
  (`schemas/ecg.schema.js:18-29`). Moderate/severe mitral stenosis, low LVEF, pulmonary hypertension, or
  AFib materially change pregnancy risk (mWHO maternal cardiac risk class) and even marriage-planning
  counseling — yet today they only nudge a blended 10%-weight number.
- **Inputs needed — already available:** the ECHO/ECG structured fields above.
- **Benefit:** Elevates genuinely serious, already-extracted cardiac findings into an explicit advisory
  instead of averaging them into a radiology score. Especially relevant for the prospective mother.
- **Effort: M.** A rules layer over existing ECHO/ECG JSON mapping to mWHO-style bands + advisory card.
- **Risk / claim considerations:** Advisory + strong "see a cardiologist/obstetrician" referral. Avoid
  quantitative pregnancy-risk percentages (SaMD territory) — categorical "higher-risk, get specialist
  review" only.
- **Guideline basis (validate):** WHO modified (mWHO) maternal cardiovascular risk classification;
  ESC Guidelines on cardiovascular disease in pregnancy.

### OPP-W5-10 — Bone-health / osteoporosis pre-conception flag (DEXA) + calcium/Vit-D tie-in
- **Rationale:** DEXA T-scores are captured (`schemas/dexa.schema.js`) and scored for the radiology
  composite (`dexa.score.js`), but osteopenia/osteoporosis in a young prospective mother (relevant to
  lactation-associated bone loss and long-term risk) gets no couple/pre-conception narrative. Cross-links to
  Vitamin D (OPP-W5-03).
- **Inputs needed — already available:** `lowest_t_score_value`, `overall_who_classification` (dexa schema).
- **Benefit:** Small but real; a "bone & vitamin D" advisory. Lower prevalence in the target age band, so
  lower priority.
- **Effort: S/M.**
- **Risk / claim considerations:** Advisory; DEXA is uncommon in this population so mostly a "not assessed"
  card. Low SaMD.
- **Guideline basis (validate):** ISCD / WHO T-score classification; osteoporosis pre-conception counseling.

### OPP-W5-11 — Fold-ins: HDL / hs-CRP / uric acid (already captured, discarded)
- **Rationale:** HDL, HOMA-IR, hs-CRP are stored into chronic `rawValues` but never read (WS1A11,
  `chronic.controller.js:143-146`); `serum_uric_acid` (`ontologyMapper.service.js:465`) and `hs_crp` (`:371`)
  are otherwise unconsumed. Low HDL is a core metabolic-syndrome criterion; hs-CRP is an independent
  cardiometabolic signal; uric acid ties to metabolic/renal risk. These are enhancements to the *existing*
  chronic engine rather than standalone engines.
- **Inputs needed — already available:** all above.
- **Benefit:** Cheap accuracy gains for the chronic/metabolic read using data already in hand.
- **Effort: S.**
- **Risk / claim considerations:** None beyond existing chronic-engine framing. Listed for completeness;
  lower clinical-value-per-effort than OPP-W5-01..07 because it's an enhancement, not a new couple insight.
- **Guideline basis (validate):** ATP-III / IDF metabolic syndrome (HDL criterion); standard uric-acid ranges.

---

## TIER 2 — ADJACENT NEW ENGINES (may need new capture)

### OPP-W5-12 — Consanguinity input → genetic-risk amplifier
- **Rationale:** Consanguineous marriage (first/second-cousin unions) is common in several Indian
  communities and materially raises autosomal-recessive disorder risk in offspring — the single highest-yield
  *question* for genetic counseling, and one the app captures nowhere (grep `consanguin` across the repo = 0
  hits; only `parentDiabetes` family history exists). One self-report question ("Are you and your partner
  related by blood, e.g. cousins?") turns the existing carrier engines (thalassemia OPP-W5-05, expanded panel
  OPP-W5-13) from "screen if flagged" into a properly risk-stratified narrative and justifies recommending
  broader carrier screening.
- **Inputs needed — NEW capture:** one categorical question (unrelated / second cousins / first cousins /
  closer). No lab. Feeds the genetics narrative and the carrier-screening recommendation strength.
- **Benefit:** Very high cultural relevance and clinical leverage for near-zero capture cost; makes the
  genetics story real rather than lab-only.
- **Effort: S** (capture) / **M** (integrate into genetics narrative + recommendation logic).
- **Risk / claim considerations:** Sensitive topic — neutral, non-judgmental wording; frame as "helps us
  tailor genetic screening advice," never as a compatibility penalty. Purely informational → low SaMD.
- **Guideline basis (validate):** Clinical genetics coefficient-of-relationship / inbreeding coefficient (F)
  and AR-disorder risk; WHO/March-of-Dimes consanguinity counseling.

### OPP-W5-13 — Expanded recessive carrier-screening panel (SMA, Fragile X, CFTR panel, G6PD, CAH)
- **Rationale:** The product already *advertises* these in `SUGGESTED_GENOMICS_TESTS`
  (`suggestedTests.js:34-53`: SMA carrier, Fragile X FMR1, CFTR, G6PD, CAH, hemophilia, Wilson, GJB2…) but
  the fertility engine's Tier-3 only consumes yDeletion, karyotype, MTHFR, CFTR/CBAVD. A structured
  couple-carrier engine over an expanded panel is the natural extension, especially combined with
  consanguinity (OPP-W5-12). G6PD is additionally India-relevant (neonatal jaundice, drug/fava-bean
  reactions).
- **Inputs needed — NEW capture:** structured extraction of expanded carrier-panel reports (currently only
  free-text/karyotype-style inputs exist in the mfr genomics UI). Non-trivial extraction work.
- **Benefit:** Rounds out the genetics domain the app already promises; both-carrier detection is the
  highest-stakes couple insight.
- **Effort: L.** New extraction schema + per-condition carrier-pair logic + counselor-referral narratives.
- **Risk / claim considerations:** High-stakes results → mandatory genetic-counselor framing (as existing
  thalassemia card does). Reporting a both-carrier result is defensible as screening, not diagnosis, if
  worded carefully. Watch for over-reach into diagnostic claims (SaMD).
- **Guideline basis (validate):** ACMG/ACOG expanded carrier screening recommendations; condition-specific
  carrier genetics.

### OPP-W5-14 — Medication / teratogen-exposure pre-conception check
- **Rationale:** No capture today of current medications. A prospective mother on a known teratogen
  (isotretinoin, sodium valproate, warfarin, ACE inhibitors/ARBs, methotrexate, lithium, certain
  anticonvulsants) needs pre-conception medication review — a high-value, time-sensitive premarital/pre-pregnancy
  action. A curated list check against a self-reported medication field is feasible.
- **Inputs needed — NEW capture:** self-reported current medications (free text or picklist).
- **Benefit:** Prevents a serious, common, and entirely avoidable pregnancy exposure; strong pre-conception
  fit.
- **Effort: M/L.** Medication capture + a maintained teratogen list + matching + advisory.
- **Risk / claim considerations: HIGHEST claim risk in this document.** Any "your medication is unsafe"
  output edges toward medical advice / SaMD and could be dangerous if a user stops a needed drug. Must be
  strictly "discuss these medications with your doctor before conceiving — do not stop anything on your own,"
  with a maintained, validated list and clear disclaimers. Recommend legal/clinical sign-off before build.
- **Guideline basis (validate):** FDA pregnancy labeling / known-teratogen lists; UK Teratology Information
  Service; ACOG pre-conception medication review.

### OPP-W5-15 — Pre-conception readiness composite (ties existing + new engines into one score/checklist)
- **Rationale:** Several of the above (Rh/HDN, rubella immunity, thyroid, glycemic, nutrition, anemia) are
  individually small but collectively define "how ready is this couple to conceive." A composite
  **checklist** (not a single opaque number) — e.g. "5 of 7 pre-conception items green; rubella + thyroid
  need attention" — is a compelling, coherent product surface that reuses each Tier-1 engine's output.
- **Inputs needed — already available** once OPP-W5-01/02/03/04/06/07 exist; no new lab capture.
- **Benefit:** Ties the premarital→pregnancy story together; high narrative value; naturally couple- and
  woman-focused.
- **Effort: M.** Aggregation + presentation; depends on the Tier-1 engines landing first.
- **Risk / claim considerations:** Prefer a **checklist of advisories** over a scored index, to avoid a
  precise "readiness %" that implies clinical prediction (echoes WS1B02's fabricated-precision hazard). Keep
  it qualitative.
- **Guideline basis (validate):** CDC/ACOG pre-conception care recommendations (the "pre-conception checklist"
  concept is itself guideline-endorsed).

### OPP-W5-16 — Serodiscordant-couple protection engine (extends the STI gate from "cap score" to "act")
- **Rationale:** The STI safety gate (`reportSummary.service.js:125-207`) currently only *caps* the composite
  and warns. But the couple framing enables genuinely useful, already-supported guidance: a HBsAg-positive
  partner → **vaccinate the HBsAg-negative partner** (HBV is vaccine-preventable); an HIV-positive partner →
  PrEP / U=U counseling; hepatitis C → treatment-as-cure counseling. All keyed off values **already
  extracted** by the gate — this is protection guidance, not just a red flag.
- **Inputs needed — already available:** the five STI params the gate already reads; optionally anti-HBs
  (Hep B surface *antibody* / immunity) which is **not** in the ontology today (only HBsAg antigen) — a
  small capture gap to note.
- **Benefit:** Turns a blunt score-cap into constructive, couple-specific harm-reduction — high public-health
  value and a differentiated, compassionate framing.
- **Effort: M.**
- **Risk / claim considerations:** Sensitive; must be non-stigmatizing and strictly refer to specialists
  (never dose/prescribe). Coordinate with the WS0-02/03 gate-vocabulary fixes so it triggers on
  "Positive"/"Reactive" alike. Moderate SaMD exposure — keep to "these protections exist, see a specialist."
- **Guideline basis (validate):** NACO (India) serodiscordant-couple guidance; WHO HBV vaccination of
  contacts; U=U / PrEP evidence.

---

## Priority summary (clinical value × low lift)

| Rank | ID | Engine | Tier | Data status | Effort |
|---|---|---|---|---|---|
| 1 | OPP-W5-01 | Rh / HDN risk (**exemplar**) | 1 | captured, unscored | S |
| 2 | OPP-W5-02 | Rubella immunity / vaccination gap | 1 | captured, unscored | S |
| 3 | OPP-W5-03 | Pre-conception nutrition (B12/VitD/iron) | 1 | captured, unscored | S/M |
| 4 | OPP-W5-04 | Anemia (CBC/MCV/ferritin) | 1 | captured, unscored | S/M |
| 5 | OPP-W5-06 | Thyroid–fertility (tighten TSH + FT4/T3) | 1 | partly captured | S/M |
| 6 | OPP-W5-05 | Hemoglobinopathy ext. (HbS/E/D/C) + fixes false "not extractable" | 1 | captured, unscored | M |
| 7 | OPP-W5-07 | Pre-conception glycemic optimization | 1 | captured, unscored | M |
| 8 | OPP-W5-12 | Consanguinity input → genetic amplifier | 2 | 1 new question | S/M |
| 9 | OPP-W5-08 | ABO/Rh-HDN + myth-debunk (careful framing) | 1 | captured, unscored | S |
| 10 | OPP-W5-09 | Maternal cardiac-risk surfacing (ECHO/ECG) | 1 | scored, not surfaced | M |
| 11 | OPP-W5-15 | Pre-conception readiness checklist | 2 | reuses Tier-1 | M |
| 12 | OPP-W5-16 | Serodiscordant-couple protection | 2 | mostly captured | M |
| 13 | OPP-W5-10 | Bone health / DEXA pre-conception | 1 | scored, not framed | S/M |
| 14 | OPP-W5-11 | Fold-ins: HDL / hs-CRP / uric acid | 1 | captured, discarded | S |
| 15 | OPP-W5-13 | Expanded carrier panel (SMA/FraX/G6PD/CAH) | 2 | new capture | L |
| 16 | OPP-W5-14 | Teratogen / medication check | 2 | new capture | M/L |

## Cross-cutting notes for implementers
- **Reuse the honesty pattern.** Every Tier-1 engine should adopt `getPartnerNumeric`'s null-vs-zero
  discipline (`reportSummary.service.js:23-26`) and the "gray / Not assessed" card state — do NOT default a
  missing value to healthy (the WS1B02/WS1B06/WS1C03 fabrication-on-absence failure mode).
- **Reuse one qualitative-result normalizer.** OPP-W5-01/02/08/16 all read "Positive/Reactive/Immune"-style
  strings; build the single `isPositive/isReactive` helper WS0-02/03 already recommends and share it, so the
  new engines never inherit the same false-negative gap.
- **Prefer advisories over new composite weights.** The composite is already a renormalized weighted mean
  (WS0-01); adding many small clinical terms risks diluting real signals and inflating fabricated precision.
  Most Tier-1 engines are best as **non-scoring, doctor-referred cards** in `family_planning` /
  `carrier_pair_risk` / a new "pre-conception" section, contributing at most a soft gate (like the STI gate),
  not a weighted number.
- **Discrepancy logged (also an engine trigger):** `reportSummary.service.js:47-52,100-108` asserts
  hemoglobin variants are "not extractable," contradicting `ontologyMapper.service.js:616-654`. Fixing that
  card IS OPP-W5-05.
- **SaMD watch:** OPP-W5-14 (medication) and OPP-W5-16 (serodiscordant) carry the most regulatory/claim
  exposure; OPP-W5-08 (blood-group) carries the most *cultural mis-framing* exposure. Everything else is
  low-risk if kept advisory and doctor-referred.
