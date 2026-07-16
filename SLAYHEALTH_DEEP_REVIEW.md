# SlayHealth — Deep Review, Medical Validation & Ideation

**Type:** Review-and-document pass (NO production code was modified). **Date:** 2026-07-15.
**Method:** Every load-bearing claim was re-verified against the code; engines were probed by directly
invoking their logic with crafted inputs; the composite/STI/MFR gates were run end-to-end; the two
orphaned test suites were executed; medical thresholds were validated against current (2026)
guidelines via web search; regulatory posture was assessed as *risk identification requiring qualified
legal review* (not legal conclusions).

This master doc is the **spine**. Each workstream's full per-finding detail (with reproduction
evidence, `file:line`, and fix hints) lives in a companion file under [`review/`](review/). This spine
carries the executive summary, the prioritized roadmap, test results, cross-cutting themes, the
opportunity index, and the scratch-script appendix. Problem IDs are stable and unique across files so
the phased implementation pass can chunk them.

> **Severity:** **P0** clinically-unsafe output / false regulatory claim shown to users / data
> corruption · **P1** materially wrong score or user-trust breach (fabricated value shown as real) ·
> **P2** correctness/robustness gap not yet reaching users, or missing safeguard · **P3** polish / DX /
> minor UX. **OPP** = opportunity (ideation), tracked separately so it never dilutes the problem roadmap.

---

## 1. Executive summary

The engines are **real and mostly well-built** — the composite's weighted renormalization is
mathematically sound (`WS0-01`), the MFR absolute-barrier gate is genuinely un-leakable (`WS0-06`,
`WS1B01`), the STI score-cap arithmetic is un-bypassable (`WS1D09`), semen thresholds match WHO 6th ed
2021 exactly (`WS3A01`), and `computeGatedComposite` is confirmed the single writer of the persisted
score. The prior audit's "score computed in three places" concern is resolved. This is not a broken
product; it is a substantially-correct one with a cluster of sharp, mostly-fixable defects.

The **highest-severity findings cluster in three places.** (1) **The STI safety gate — the product's
one hard clinical safeguard — has a regex-defect cluster**: it silently misses lab-positive results
written "Positive"/"Detected" instead of "Reactive" (`WS0-02`, `WS1D02`, false-negative → an infected
couple gets a normal high score), misses reactive results containing an incidental "non" (`WS0-03`),
AND wrongly fires on "Not Reactive"/"Undetected" (`WS1D03`, false-positive → caps a healthy couple),
while its extractor emits those exact un-normalized strings (`WS2` corroborates). (2) **The primary
report tab fabricates data structurally, for every couple**: `story/page.js` reads radiology with the
wrong object keys (`scores_json` vs the API's `scores`), so 100% of couples with radiology get a
fabricated organ score injected into the headline and prose that always asserts "no organic blocks" —
even the demo couple with a severe varicocele (`WS6-01`); and the on-screen "Health Together Index" is
recomputed client-side, **bypassing the STI-gated authoritative score** entirely (`WS6-02`). (3) **A
false statutory-compliance claim** ("DPDP-compliant") is shown present-tense on the dashboard while the
app's own settings admit compliance is "coming soon" (`WS0-09`, `REG-01`).

Cross-cutting themes: **fabrication-on-absence** (every engine defaults missing input to the healthiest
value and emits a confident favourable score rather than "not assessed" — `WS8-03`, `WS1A08`, `WS1B02`,
`WS1C03`); **the "unscanned organ = perfect 100" bug is real and still present** (`WS1D01`); **the
mental headline is an agreement metric, so a jointly-unhealthy couple scores "100 Highly Aligned"**
(`WS1C01`); **India-focused product using Western cutoffs** for BMI and applying DEXA T-scores to a
premenopausal cohort (`WS3B09`, `WS3B12`); and **pervasive unsourced clinical constants** (all
likelihood ratios, the age-fertility curve which runs ~2× optimistic, and the diabetic gate that reads
only HbA1c and ignores fasting glucose entirely — `WS1A03`, `WS3B04`, `WS3A04`). Finally, **no "not a
diagnosis / informational only" disclaimer exists anywhere in the repo** (`REG-02`), while the reports
assert screening results as "active infection" (`WS3A06`, `REG-04`) under an unsubstantiated "Doctor
Reviewed" badge (`WS0-10`, `REG-03`).

**Recommended first implementation phase (all P0/P1, mostly S/M effort):** fix the STI gate regex
cluster behind a single shared `isReactivePositive()` helper bound to the extractor; fix the
`story/page.js` radiology key mismatch and route the headline ring through the persisted gated score;
remove the false "DPDP-compliant" claim; and add a global "informational, not a diagnosis" disclaimer.

---

## 2. Prioritized roadmap

Sorted by severity, then by dependency order so phases fall out naturally. Full detail per ID is in the
linked workstream file. Effort: S (<½ day) / M (½–2 days) / L (multi-day or cross-cutting).

### P0 — clinical-safety / false-compliance / corruption

| ID | Title | Area | Effort | Depends-on | File |
|----|-------|------|--------|-----------|------|
| WS0-02 / WS1D02 | STI gate misses "Positive"/"Detected" vocabulary → infected couple scored normal (false-negative) | engine | S–M | coordinate w/ WS2 extractor normalization | WS0, WS1D |
| WS0-03 | STI gate `!/non/i` over-greedy → reactive result with incidental "non" wrongly cleared | engine | S | same helper as WS0-02 | WS0 |
| WS1D03 | STI gate wrongly fires on "Not Reactive"/"Undetected" → healthy couple capped ≤50 (false-positive) | engine | S | same helper | WS1D |
| WS6-01 | Story tab reads radiology with wrong keys (`scores_json`≠`scores`) → fabricated organ score + "no organic blocks" prose for **every** couple, 100% fire | frontend | M | — | WS6 |
| WS6-02 | Headline "Health Together Index" recomputed client-side, **bypasses STI-gated authoritative score** | frontend | M | WS8-01 (routing) | WS6 |
| WS0-09 / REG-01 | Present-tense "DPDP-compliant" claim shown to users while app admits it's unbuilt (false statutory claim) | regulatory | S (remove) / L (achieve) | claims sweep | WS0, WS_REG |

### P1 — materially wrong score / user-trust breach

| ID | Title | Area | Effort | Depends-on | File |
|----|-------|------|--------|-----------|------|
| WS1D01 | Unscanned organ scores a perfect 100 (not "not assessed") → healthy radiology 10% for unimaged organs | engine | M | — | WS1D |
| WS1C01 | Mental headline is a partner-*agreement* metric → jointly-unhealthy couple scores "100 Highly Aligned"; feeds 20% composite | engine | M | — | WS1C |
| WS1A03 | Diabetic gate reads only HbA1c; fasting glucose extracted but never consumed → FBS-only panel (common in India) misses diabetes | engine | S–M | WS2-04 (FBS alias gap) | WS1A |
| WS1A02 | Diagnosed diabetic shown ~4.9% risk — headline `uiRisk` derives from ungated `pA`, contradicts capped `gA` | engine | M | — | WS1A |
| WS1A01 | Correlated biomarker LRs multiplied under false independence → ~+63% relative risk overstatement for metabolic-syndrome couples | engine | M | WS3B04 (LR provenance) | WS1A |
| WS1B03 | MFR blends partners so a healthy partner masks a near-sterile one (sperm conc 2 → 87% annual); conception needs both gametes | engine | M | — | WS1B |
| WS1B02 | MFR empty body fabricates 93.7% / "Aligned"; no insufficient-data signal | engine | S | part of WS8-03 | WS1B |
| WS2-01 | No unit conversion/validation — SI-unit values (mmol/L, etc.) feed scoring as bare numbers | pipeline | M | — | WS2 |
| WS2-02 | Comma-grouped numbers & trailing flags fail parse → reference range stored as the value (ferritin 1200 → 20) | pipeline | M | — | WS2 |
| WS2-03 | "Blood Urea" fuzzy-maps to `blood_urea_nitrogen_bun` (urea≠BUN, ~2.14×), feeding a live scoring consumer | pipeline | S | — | WS2 |
| WS3A06 / REG-04 | STI gate + report assert a single reactive **screen** as confirmed "active infection" (VDRL/HBsAg/HIV need confirmation) | validation/regulatory | M | STI helper | WS3A, WS_REG |
| WS3A04 | Age-fertility curve ~2× too optimistic (≈9% at 40 vs ~3-5% literature); hard 0-cut at exactly 45 | validation | M | threshold config | WS3A |
| WS6-03 / WS8-04 | Mental `|| 80` coerces a real score of 0 → fabricated "80%"; `|| 'Highly Aligned'` label fails open to positive | frontend | S | — | WS6, WS8 |
| WS0-07 / WS6-04 | `usg/page.js` hardcoded `'Sachin'`/`'Swati'` names + `calculateAge`→30 fallback, reachable via restore path | frontend | S | — | WS0, WS6 |
| WS6-05 | Restore never rehydrates prospect sex/DOB → upload-after-restore sends age 30 / wrong sex into real radiology scoring | frontend/data | M | WS8-01 | WS6 |
| REG-03 / WS0-10 | "Doctor Reviewed" badge (≥4 places) with no clinician-review artifact anywhere in repo | regulatory | S (remove) / ext | claims sweep | WS_REG, WS0 |
| REG-02 | No "not a diagnosis / informational only" disclaimer anywhere; diagnostic-flavored outputs → SaMD exposure | regulatory | S (disclaimer) / L (positioning) | — | WS_REG |

### P2 — correctness/robustness gaps not yet reaching users, or missing safeguards

| ID | Title | Area | Effort | File |
|----|-------|------|--------|------|
| WS8-03 | Systemic fabrication-on-absence across all 3 engines (no not-assessed state) | engine | L | WS8 |
| WS8-01 | Report pages are context-only → hard nav/refresh/deep-link bounces to /dashboard; blocks shareable report URL | frontend | M | WS8 |
| WS1A07 | Shared-lifestyle "discount" is an uncited invention; inflates a healthy person's lifestyle LR | engine | M | WS1A |
| WS1D07 | Composite has no critical-domain floor (chronic=10 + others ~90 → 63) unlike the organ scorers | engine | M | WS1D |
| WS1C02 | Big Five items scored monotonically (agreeableness=5 "always put others first" = best) — validity defect vs research doc's own caveat | engine | M | WS1C |
| WS1C04/05/06 | Attachment mismatch, substance mismatch, anger all excluded from the headline index; categorical defaults fail open to healthiest | engine | M | WS1C |
| WS1D05/06 / WS3A05 | Thalassemia HbA2 >3.5% hard binary; no 3.5–4.0 borderline band; untested partner scored as non-carrier; ignores MCV/iron context | engine/validation | M | WS1D, WS3A |
| WS1A04 / WS3B01 | IDRS caps family history +10; "both parents diabetic" (+20) unreachable; max score 90 not the "/100" shown | engine/validation | S | WS1A, WS3B |
| WS3B02 | IDRS physical-activity points drift (Moderate=20 vs validated 10); no enum validation | validation | S | WS3B |
| WS3B04/05 | ALL likelihood ratios, IDRS→LR mapping, baseline odds, ageing drift, diabetic cap hard-coded with zero provenance | validation | L | WS3B |
| WS3B09 | Western BMI cutoffs (≥25/≥30) on India-focused product; should be Asian-Indian (≥23/≥25); inconsistent w/ app's own waist logic | validation | S | WS3B |
| WS3B12 | DEXA T-scores applied to premenopausal/young cohort; ISCD 2023 requires Z-scores → false "osteoporotic" labels; Z-scores extracted but unused | validation | M | WS3B |
| WS2-04 | Broad alias gap — FBS, LDL, WBC, Sodium, Potassium, Uric Acid, Sperm Count all drop entirely | pipeline | M | WS2 |
| WS2-07 | Radiology LLM output has zero schema validation; malformed JSON drops whole modality; invented fields pass through | pipeline | M | WS2 |
| WS2-08 | Radiology `/upload` has no multer fileFilter (inconsistent with pathology) and bypasses `ocrProvider` | pipeline | S | WS2 |
| WS0-05 | STI gate silently coupled to exact canonical keys; extractor key drift = total gate bypass; no binding test | engine/pipeline | S | WS0 |
| WS1A09 | "10-year projection" is a fixed 1.05^y curve identical for everyone; a second inconsistent aging model shown alongside | engine | M | WS1A |
| WS1B04/05/06 | No plausibility checks — negative AMH triggers hard gate; negative age → max fertility; dead MALE/FEMALE age-limit constants | engine | S | WS1B |
| WS3A02 | AMH cutoffs uncited; age-banded "Normal for age" can mask diminished reserve (ASRM/POSEIDON <1.0-1.2); ASRM absent from repo | validation | M | WS3A |
| WS1D04 | Report over-claims "Active Syphilis/Hep B detected" from single screen (HCV/HIV correctly hedged) | validation | S | WS1D |
| REG-05 | HIPAA out of scope (no US nexus) — advertising "HIPAA compliance coming soon" is a misframing | regulatory | S | WS_REG |
| REG-06 | No visible DPDP substantiation (consent/rights/retention/breach) behind the REG-01 claim; children's-data angle | regulatory | L | WS_REG |
| WS2-10 | Hemoglobin-variant card hardcoded "not assessed" though HbS/C/D/E canonicals exist in the ontology | pipeline | S | WS2 |
| WS0-11 | AFC ovarian-reserve path dead for report data — MFR reads canonical `'afc'` the ontology never defines (156 canonicals, no `afc`) → AMH-only classification | engine/pipeline | S | WS0 |

### P3 — polish / DX / minor UX

| ID | Title | Area | File |
|----|-------|------|------|
| WS6-06 | Chronic `?? 85` / MFR `?? 15` curve fallbacks — **chart-interpolation-only, structurally unreachable** (reachability resolved) | frontend | WS6 |
| WS1D08 | Radiology & genetics (10% each) near-constant ~100 for most couples; move headline ≤5 pts | engine | WS1D |
| WS1A06 | IDRS→LR step mapping creates score cliffs (+1 IDRS point at 30 = ~6-pt discontinuity) | engine | WS1A |
| WS1C08 | DAST drug item + ACE section confirmed never built; risk pillar is alcohol-only | engine | WS1C |
| WS3B08 | Lipid cutoffs edition-lagged (NCEP ATP III 2001; superseded by 2018 ACC/AHA, 2019 ESC/EAS) | validation | WS3B |
| WS3B11 | DEXA `< -2.5` off-by-boundary — exactly −2.5 mis-scored as osteopenia (WHO: T ≤ −2.5) | validation | WS3B |
| WS3A07 / WS3A03 | STI "all clear" copy ignores window periods; AFC young-age "Low ≤11" slightly aggressive/uncited | validation | WS3A |
| REG-07 | Landing stats cited to WHO/ICMR/JAMA as bare tags without links; unbacked "2,847 couples" social proof | regulatory | WS_REG |

### Confirmed-correct (recorded so the implementer does NOT "fix" working code)

`WS0-01` composite renormalization sound · `WS0-06`/`WS1B01` MFR barrier gate un-leakable · `WS1D09`
STI cap arithmetic un-bypassable + single score writer · `WS3A01` semen thresholds match WHO 6th ed
2021 · `WS3B03` IDRS age/waist bands + risk cutoffs match MDRF · `WS3B06` HbA1c 6.5/5.7 match ADA 2026 ·
`WS3B07` BP 140/90 correct for context · `WS8-02` engines auth-gated · `WS1C10` mental item ordering
consistent (no silent flip) · `WS2-06` STI "Non-Reactive"/"Non Reactive" spelling handled (the gate's
defect is the *other* vocabularies, above).

---

## 3. Test-run results

Two orphaned suites exist; neither is wired to `npm test` (which is the stub
`echo "no test specified" && exit 1`) and no test framework is installed.

| Suite | Command that works | Result | Covers | Does NOT cover |
|-------|-------------------|--------|--------|----------------|
| Parser | `node backend/tests/parser.test.js` | **PASS** (section detector + parameter extractor) | a handful of section-name → canonical mappings and basic value extraction | the alias gaps (WS2-04), unit mis-accepts (WS2-01), comma/flag parse failures (WS2-02), Blood-Urea mismap (WS2-03) — none are asserted |
| USG scoring | `node backend/__tests__/usg-scoring.test.js` (NOT `node --test __tests__/` — that path-form throws MODULE_NOT_FOUND) | **8/8 PASS** | per-organ scorers against 4 real patient fixtures | the "unscanned = 100" default (WS1D01) — fixtures always supply findings, so the fabrication path is never exercised |

**Test-infra findings:** (a) the brief's suggested `node --test backend/__tests__` invocation is itself
broken — Node's test runner needs the file, not the bare dir; use the file path. (b) Neither suite runs
in CI (there is none) and both are disconnected from `npm test`. (c) No frontend test suite exists at
all. Recommend, in a later pass, wiring both suites into `npm test` and adding regression fixtures for
every P0/P1 above (especially an STI-vocabulary table and an "unscanned organ" fixture).

---

## 4. Cross-cutting themes (read these before phasing)

1. **Fabrication-on-absence is the systemic root pattern.** Every engine (`WS1A08`, `WS1B02`,
   `WS1C03`) and several frontend fallbacks (`WS6-03`, `WS0-07`) default missing data to the
   *healthiest* value and emit a confident favourable number. A single principled fix — an explicit
   `not_assessed` state that `computeGatedComposite` already knows how to exclude (`WS0-01`) — resolves
   a whole column of findings. Phase this as one theme, not N point-fixes.
2. **String-contract drift between extractor and consumers.** The STI gate (`WS0-05`), the Blood-Urea
   mismap (`WS2-03`), and the radiology key mismatch (`WS6-01`) are all the same shape: two sides of a
   string/key contract maintained independently with no shared constant or binding test. Introduce
   shared constants + contract tests.
3. **Unsourced clinical constants + no versioning.** LRs, the fertility curve, the diabetic cap, HbA2
   cutoff, IDRS→LR mapping — all hard-coded, undated, un-cited (`WS3B04`, `WS3A02/04`). Extract to one
   versioned, dated `clinicalConstants` module (WS4 proposes this) so guideline updates are data
   changes and provenance is auditable.
4. **India-focus vs Western defaults.** The product is India-targeted (IDRS, ICMR, NACO, INR, Indian lab
   formats) yet uses Western BMI cutoffs (`WS3B09`) and applies DEXA T-scores to a young cohort
   (`WS3B12`). Population-appropriate thresholds are a coherent mini-theme.
5. **Two sources of truth on the headline.** The backend computes an STI-gated composite; the story tab
   recomputes its own ungated ring (`WS6-02`) and reads stale radiology keys (`WS6-01`). The report
   should render the persisted `presentation_json`, not recompute.
6. **Claim-framing risk is concentrated and mostly copy-level to de-risk.** The false DPDP claim
   (`REG-01`), the Doctor-Reviewed badge (`REG-03`), screening-as-diagnosis language (`REG-04`), and
   the missing disclaimer (`REG-02`) are individually small edits that together materially lower
   exposure — worth doing as one "claims & disclaimers" sweep. Underlying compliance/positioning is a
   separate large track requiring qualified legal/regulatory review.

---

## 5. Workstream files (full detail)

- [`review/WS0_inline_probes.md`](review/WS0_inline_probes.md) — lead's own reproduced probes (composite, STI gate cluster, MFR gate, §5 items).
- [`review/WS1A_chronic_engine.md`](review/WS1A_chronic_engine.md) — chronic disease engine.
- [`review/WS1B_mfr_engine.md`](review/WS1B_mfr_engine.md) — MFR / fertility timeline engine.
- [`review/WS1C_mental_engine.md`](review/WS1C_mental_engine.md) — mental wellbeing engine + research-doc cross-ref.
- [`review/WS1D_thal_sti_radiology_composite.md`](review/WS1D_thal_sti_radiology_composite.md) — thalassemia, STI gate, radiology scorers, composite.
- [`review/WS2_extraction_pipeline.md`](review/WS2_extraction_pipeline.md) — pathology regex/ontology + radiology LLM extraction.
- [`review/WS3A_validation_fertility_thal_sti.md`](review/WS3A_validation_fertility_thal_sti.md) — WHO/ASRM/ICMR/NACO validation of fertility, thalassemia, STI.
- [`review/WS3B_validation_chronic_idrs_dexa.md`](review/WS3B_validation_chronic_idrs_dexa.md) — MDRF/ADA/ISCD validation of chronic, IDRS, DEXA.
- [`review/WS6_frontend_audit.md`](review/WS6_frontend_audit.md) — frontend dummy/static-data audit with reachability determinations.
- [`review/WS8_edge_cases.md`](review/WS8_edge_cases.md) — cross-cutting flow/failure/auth edge cases.
- [`review/WS_REG_regulatory.md`](review/WS_REG_regulatory.md) — CDSCO SaMD / DPDP / HIPAA / claim-framing risk.
- **Ideation:** [`review/WS4_ideation_within_engines.md`](review/WS4_ideation_within_engines.md) · [`review/WS5_ideation_new_engines.md`](review/WS5_ideation_new_engines.md) · [`review/WS7_ideation_report_ux.md`](review/WS7_ideation_report_ux.md) — see §6.

---

## 6. Opportunity index (ideation — WS4 / WS5 / WS7)

Ranked highlights only; full per-OPP detail (rationale, inputs, benefit, effort, risk, guideline basis,
`file:line`) is in [`WS4`](review/WS4_ideation_within_engines.md) (25 entries),
[`WS5`](review/WS5_ideation_new_engines.md) (16 entries), [`WS7`](review/WS7_ideation_report_ux.md) (20
entries). Several opportunities **also resolve a confirmed problem** — those are the highest-leverage
because they pay down a P0/P1 and add value in one move; they are marked ★.

**Structural insight (WS4/WS5):** a large set of clinically meaningful params are extracted and shown
in the raw report but feed **zero** scoring path (grep-confirmed): TC:HDL ratio, eGFR, uric acid, AST,
MCV/RDW, ferritin/transferrin, Hb variants (HbS/E/D/C), FT4/FT3, B12, rubella IgG, TMSC, full
urinalysis. The single biggest opportunity theme is turning already-captured data into couple-relevant
insight at near-zero capture cost.

### WS4 — within existing engines (top picks)
- **★ OPP-W4-01 (S)** — Feed already-extracted `fasting_blood_glucose_fbg`/`random_blood_sugar_rbs` into the diabetic gate → resolves the FBS-only-diabetic miss (**WS1A03**).
- **★ OPP-W4-25 (M)** — Rewrite STI gate as screening→confirmatory ("reactive screen — confirmatory testing recommended", + equivocal state) → resolves **WS3A06/REG-04/WS0-04**, biggest single claim-risk reduction.
- **OPP-W4-15 (M)** — Extract every hardcoded cutoff (WHO semen, HbA1c, HbA2, IDRS, DEXA, AMH/AFC, lipids) into one **versioned, dated `clinicalConstants` module** → the enabler for cross-cutting theme #3; makes every threshold change a provenance-tagged data change.
- **★ OPP-W4-19 (M)** — Blend per-partner mental *quality* into the headline instead of pure answer-agreement → resolves **WS1C01**.
- **★ OPP-W4-04/05/06 (M)** — Recover MCV/RDW + iron studies + Hb-variant fractions (extracted, unused) into a real carrier/anemia pre-screen → also fixes **WS2-10** (hardcoded "not assessed").
- **OPP-W4-03 (S)** eGFR as primary kidney measure · **OPP-W4-08 (S)** rubella IgG → pregnancy-safety flag · **OPP-W4-16/17/18** reweight/remove the noise slices (**WS1D08**, **WS1A09**) · **OPP-W4-20/21** build the never-shipped DAST + ACE items (**WS1C08**) · **OPP-W4-22/23/24** explicit borderline states (HbA2 3.5–4.0, ovarian-reserve, prediabetes).

### WS5 — entirely new engines (ranked by clinical-value × low-lift)
- **OPP-W5-01 (S) — Rh / HDN risk [EXEMPLAR]** — `rh_factor_positive_negative` captured, advertised "relevant for pregnancy," zero consumers; Rh-neg mother + Rh-pos father → hemolytic disease of the newborn. Fully specified in the file.
- **OPP-W5-02 (S)** rubella immunity gap (non-immune woman → MMR before conceiving) · **OPP-W5-03 (S/M)** pre-conception nutrition (B12+VitD+iron; high India prevalence) · **OPP-W5-04 (S/M)** anemia engine (Hb/MCV/ferritin; >50% Indian women) · **OPP-W5-06 (S/M)** thyroid–fertility (FT4/FT3 unused; TSH band too wide for pre-conception).
- **★ OPP-W5-05 (M)** — Hemoglobinopathy extension (HbS/E/D/C canonicals exist) → also fixes the live "not extractable" hardcode (**WS2-10**).
- **★ OPP-W5-07 (M)** pre-conception glycemic optimization → also closes **WS1A03** FBG gap · **OPP-W5-12 (S/M)** consanguinity input (one new question, high India relevance, amplifies carrier engines).
- **Claim-risk watch:** OPP-W5-08 (ABO/Rh with myth-debunking), OPP-W5-14 (teratogen/medication check — highest SaMD exposure), OPP-W5-16 (serodiscordant protection) all need careful framing / legal review.

### WS7 — engaging & interactive report (impact × effort)
- **★ OPP-W7-02 (S)** — Gate the interactive Health Together Index (currently ungated client recompute) → same fix as **WS6-02**, a safety fix in a few lines.
- **★ OPP-W7-01 (M)** — Surface the AI narrative + `couple_synthesis`/`strengths`/`opportunities`/`sti_gate` in the WEB report. **Key finding: these are computed and stored in `presentation_json` but render only in the PDF (`pdfReport2.service.js:457`); the interactive story uses hardcoded template prose (`story/page.js:291-389`) and the STI finding is web-invisible.** High-value, and reduces the WS6-01 fabricated-prose surface by rendering real content.
- **OPP-W7-07 (S)** confidence-uplift ladder ("Add radiology +6, verify bloodwork +16") reusing `report_confidence.domains` + the existing `?enter=` CTA — best re-engagement lever for a one-time report.
- **OPP-W7-04 (S)** make the already-computed current-vs-optimised "dividend" the headline lever · **OPP-W7-03 (M)** named lifestyle scenario toggles tied to the engine's real `p_12m_optimised`/lifestyle-index levers · **OPP-W7-11 (M)** private-first, viewer-aware reveal for partner-attributed STI/carrier findings (responsible two-people-one-screen disclosure) · **OPP-W7-14 (M)** consent-gated section sharing reusing invite/token infra · **OPP-W7-08 (M)** 90-day recompute loop.

**Two ideation findings that are effectively latent bugs** (folded into the roadmap): the client-side
ungated headline (OPP-W7-02 = WS6-02), and rich couple-facing AI content computed but discarded by the
interactive report (OPP-W7-01) — the report shows *template* prose while real per-couple narrative sits
unused in `presentation_json`.

---

## 7. Appendix — throwaway probe scripts

All lead + agent probe scripts live under `backend/scratch/` (confirmed **gitignored** — nothing
pollutes the tracked tree). None are integrated into production code. Review-created scripts:

- `probe_composite_sti.js` (WS0) — composite renorm + STI cap + STI vocabulary matrix
- `seed_ws8_incomplete.js`, `browser_ws8.js` (WS8) — incomplete-data match seed + Playwright report-page drive
- `chronic_probe.js`, `chronic_probe2.js` (WS1A)
- `ws1b_harness.js`, `ws1b_probe.js`..`ws1b_probe4.js` (WS1B)
- `ws1c_mental_probe.js`, `ws1c_missing_and_defaults_probe.js` (WS1C)
- `ws1d_abdomen_probe.js`, `ws1d_composite_probe.js`, `ws1d_radiology_chain_probe.js`, `ws1d_require_test.js`, `ws1d_sti_probe.js`, `ws1d_thal_probe.js` (WS1D)
- `probe1_alias_units.js`, `probe2_qualitative_numeric.js`, `probe3_edgecases.js` (WS2)

(Pre-existing scratch files unrelated to this review — `merge_pdfs.js`, `test_*.js`, `verify_*.js`,
`check_*.js`, `clear_redis_lock.js` — were left untouched.)

Disposable Postgres rows (phone pattern `+19990150001`) seeded during WS8 were deleted after use;
`git status` was confirmed clean of tracked-file changes.
