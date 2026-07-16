# WS3A — Medical validation: FERTILITY, THALASSEMIA, STI thresholds

Scope: validate coded clinical thresholds in the MFR fertility engine
(`backend/src/controllers/mfr.controller.js`) and the compatibility report summary
(`backend/src/services/compatibility/reportSummary.service.js`) against current (2026)
authoritative guidelines. READ-ONLY. Method per threshold: extract coded value (file:line)
→ find current authoritative source (web search) → compare → verdict (match / drift /
edition-lag / over-claim) with source NAME + EDITION + DATE.

Verdict legend: **match** = agrees with current authority · **drift** = disagrees with no
edition explanation · **edition-lag** = matches a superseded edition · **over-claim** =
code asserts more diagnostic certainty than the test supports.

---

### [P2] WS3A01 — Semen reference limits MATCH WHO 6th ed, but composite "Deficit" grading is uncited house nomenclature
- Area:        validation
- Location:    `backend/src/controllers/mfr.controller.js:113-188` (`classifySemen`)
- Status:      Static-only (thresholds cross-checked against WHO 6th ed table)
- Evidence:    Coded lower limits — volume `< 1.4` (L138), concentration `< 16` (L122),
  total count `< 39` (L131), total motility `< 42` (L144), progressive `< 30` (L150),
  vitality `< 54` (L156), morphology `< 4` (L162), pH `< 7.2` (L168). Every value matches
  the WHO 6th-ed 5th-centile lower reference limits exactly: volume 1.4 mL, concentration
  16 M/mL, total number 39 M/ejaculate, total motility 42%, progressive 30%, vitality 54%,
  normal forms 4%, pH ≥7.2. **No edition-lag** — these are NOT the WHO 5th-ed (2010) values
  (which were 1.5 / 15 / 39 / 40 / 32 / 58 / 4 / 7.2); the concentration, volume, total
  motility, progressive and vitality figures are all the newer 6th-ed numbers. This is the
  clean win of WS3A.
- Root cause:  n/a (thresholds correct). The concern is downstream: the code then buckets
  results into `Severe / Moderate / Mild Deficit` via `belowCount >= 3`, `=== 2`, `=== 1`
  and a `concentration < 5 ⇒ Severe Deficit` rule (L174-180). None of these composite
  categories, the count-based tiering, nor the `<5 M/mL` severe cutoff exist in WHO 6th ed —
  WHO deliberately abandoned pass/fail thresholds in the 6th ed in favour of "decision
  limits" and uses descriptive nomenclature (oligo-/astheno-/terato-zoospermia, OAT,
  azoospermia), not a numeric deficit ladder. Azoospermia is only detected on
  `concentration === 0` / `totalCount === 0` (L121, L130); a report extracted as `<0.1` or
  `0.01` would miss the azoospermia label and fall to the `<5` severe branch instead.
- Impact:      correctness / user-trust — thresholds are right; the severity labels shown to
  users are an unreferenced internal scheme presented with clinical authority.
- Best-fit fix (hint for implementer): keep the (correct) WHO 6th-ed limits; relabel outputs
  in standard WHO descriptive terms, or explicitly disclose the deficit ladder as a
  product heuristic, not a WHO grade. Treat `<0.1`/near-zero extractions as azoospermia.
- Effort:      S
- Blast radius / dependencies: `semenModifiers` map (L270) and the azoospermia hard-gate
  (`calculatedSemen?.details === 'Azoospermia'`, L455) both consume these categories.
- Guideline ref: WHO Laboratory Manual for the Examination and Processing of Human Semen,
  6th edition, WHO Geneva, July 2021 (lower reference limits = 5th centile of ~3,500 fertile
  men). Prior: WHO 5th ed, 2010.

---

### [P2] WS3A02 — AMH ovarian-reserve cutoffs are uncited age-banded values; ASRM/ESHRE absent; "Normal for age" can mask clinically diminished reserve
- Area:        validation / engine
- Location:    `backend/src/controllers/mfr.controller.js:41-64` (`classifyByAmh`)
- Status:      Static-only
- Evidence:    Four age bands with AMH (ng/mL) boundaries — e.g. <30: VeryLow `<1.0` /
  Low `≤1.5` / Normal `≤4.0`; 35-39: VeryLow `<0.5` / Low `≤0.9` / Normal `≤2.5`;
  ≥40: VeryLow `<0.3` / Low `≤0.6` / Normal `≤1.5`. No source is cited anywhere in the repo.
  The single flat clinical cutoff for diminished ovarian reserve (DOR) in the literature is
  AMH < ~1.0-1.1 ng/mL (ASRM/ACOG use <1 ng/mL; ESHRE Bologna uses 0.5-1.1 ng/mL; POSEIDON
  uses <1.2 ng/mL). The age-banded design is defensible in principle (AMH is age-dependent)
  BUT because the "Normal" ceiling floats DOWN with age while the "Low" floor also drops, an
  AMH of e.g. 0.7-1.4 ng/mL at age 40+ is scored **"Normal"** here, whereas ASRM/Bologna/
  POSEIDON would flag the same value as diminished reserve. So the engine can report
  "Strong Ovarian Reserve" (reportSummary L381-382) for a value clinicians call DOR.
- Root cause:  Custom age-percentile-style bands substituted for the published flat DOR
  cutoff, with no citation and no note of which framework (if any) they track. ASRM — the
  headline fertility authority — is entirely absent from the repo despite fertility being a
  flagship engine. **Citation gap flagged explicitly.**
- Impact:      clinical-safety / user-trust — a 40+ woman with clinically low AMH may be
  told her reserve is normal/strong, softening a real referral signal.
- Best-fit fix (hint for implementer): either (a) cite the source these bands come from, or
  (b) cross-flag any AMH < ~1.0-1.1 ng/mL as at-least-"Low" regardless of age band so the
  age-relative label never overrides the absolute DOR threshold, and surface an ASRM/ESHRE
  citation in the UI.
- Effort:      M
- Blast radius / dependencies: `reserveModifiers` (L267), the `Very Low ⇒ hard gate`
  promotion (L456-459), and reportSummary's reuse of `classifyOvarianReserve`
  (reportSummary.service.js:247-249).
- Guideline ref: ESHRE Bologna criteria (Ferraretti et al., Hum Reprod 2011; AMH 0.5-1.1
  ng/mL, AFC 5-7); POSEIDON criteria (Alviggi et al., 2016; AMH <1.2 ng/mL / AFC <5);
  ASRM/ACOG DOR reference AMH <1 ng/mL (ASRM committee opinions, current). ASRM 2026: no
  single universal AMH threshold — value is method-dependent — which itself argues for an
  explicit, cited assay/framework rather than bare numbers.

---

### [P3] WS3A03 — AFC band boundaries uncited; young-age "Low ≤11" is slightly aggressive vs. published normal AFC
- Area:        validation
- Location:    `backend/src/controllers/mfr.controller.js:66-88` (`classifyByAfc`)
- Status:      Static-only
- Evidence:    e.g. <30: VeryLow `<8` / Low `≤11` / Normal `≤20`; ≥40: VeryLow `<3` /
  Low `≤5` / Normal `≤10`. The poor-responder AFC threshold in the literature is <5-7
  follicles (Bologna/POSEIDON). Normal AFC is generally quoted ~10-20 (some 8-25). The
  older-age bands (VeryLow<3 / Low≤5) align well with Bologna (<5-7). The young-age band
  calls AFC ≤11 "Low", which is stricter than most references would (11 is low-normal at
  <30, not clearly "low"). Not materially unsafe, but uncited and slightly conservative for
  young women.
- Root cause:  Custom bands, no citation.
- Impact:      correctness — minor; may over-flag young women with low-normal AFC.
- Best-fit fix (hint for implementer): cite the source or widen the young-age "Normal" floor
  toward the ~10-12 boundary; anchor VeryLow/Low to the Bologna <5-7 evidence.
- Effort:      S
- Blast radius / dependencies: combined with AMH via `rank` min-of-two (L94-98).
- Guideline ref: ESHRE Bologna criteria (Hum Reprod 2011): abnormal ovarian reserve = AFC
  <5-7. POSEIDON (2016): AFC <5.

---

### [P1] WS3A04 — Age-fertility curve is materially optimistic ages ~38-44 (≈2× published monthly fecundability); hard 0 at 45 is a cliff and the 50:4 anchor is dead code
- Area:        engine
- Location:    `backend/src/controllers/mfr.controller.js:22-23` (FEM/MAL tables),
  `:28-35` (`mfrAt`), `:29` (`if (fa >= 45) return 0.0`)
- Status:      Confirmed (arithmetic traced through the model)
- Evidence:    FEM biological scores → monthly probability via `combined/100 * 0.25`
  (L34), then `× lambda(≤1) × freq(0.92)`. Tracing age-only (matched partner, no
  adjustments), monthly conception chance the engine SHOWS the user vs. published natural
  monthly fecundability:
    - age 30: score 86 → ~19.8% (lit ~20%) — OK
    - age 35: score 67 → ~15.4% (lit ~12%) — mildly high
    - age 38: score 50 → ~11.5% (lit ~5%) — **~2× high**
    - age 40: score 38 → ~8.7% (lit ~3-5%) — **~2× high**
    - age 42: score 24 → ~5.5% (lit <2-3%) — **~2× high**
    - age 43: score 17 → ~3.9% (lit ~1-2%) — high
    - age 44: score 11 → ~2.5%, then age 45: hard **0.0**
  The jump from ~2.5% at 44 to exactly 0 at 45 is a discontinuity, and at 45 the engine
  emits "Natural conception blocked. ART or medical intervention required" (L498) for every
  woman — an over-claim, since natural conception at 45-46 is rare but not zero. The
  `50: 4` entry in the FEM table (L22) is unreachable dead code: `mfrAt` returns 0 for any
  `fa >= 45` (L29), so nothing past 45 is ever interpolated.
- Root cause:  The tables are labelled "illustrative curves" in-code (L8) yet drive a
  concrete "Monthly Conception Chance: X%" and "~N months to conceive" shown to users
  (L500, L536, response L588). The late-30s-to-mid-40s slope decays too slowly relative to
  published fecundability data.
- Impact:      user-trust / clinical-safety — a 40-year-old couple can be shown ~9% monthly
  / a short time-to-conceive when reality is ~3-5%, understating urgency of evaluation; and
  a 45-year-old is absolutely told conception is "blocked."
- Best-fit fix (hint for implementer): re-anchor FEM ages 37-44 to published fecundability
  (roughly halve the 38-44 scores), replace the hard 45 cliff with a steep-but-continuous
  low tail (make the existing `50:4` anchor actually reachable), and soften the "blocked /
  ART required" copy at 45+ to "very low; specialist evaluation strongly advised."
- Effort:      M
- Blast radius / dependencies: feeds `p_monthly_current`, `p_12m`, `time_to_conceive`, the
  10-yr projection arrays, the status pill, and reportSummary family-planning stars.
- Guideline ref: ASRM "Optimizing natural fertility: a committee opinion" (Fertil Steril,
  2022 revision) and standard fecundability-by-age data: ~20-25%/cycle <30, ~12% at 35,
  ~5% at 38, ~3-5% at 40, <2-3% ≥42.

---

### [P2] WS3A05 — Thalassemia HbA2 > 3.5% treated as a hard binary carrier/non-carrier; ignores the 3.5-4.0% borderline grey zone and the required RBC-index/HPLC context
- Area:        validation
- Location:    `backend/src/services/compatibility/reportSummary.service.js:54-111`
  (`evaluateThalassemiaCarrierRisk`), classifier at `:60-63` (`val > 3.5 ? 'red' : 'green'`)
- Status:      Static-only
- Evidence:    Single cutoff: HbA2 `> 3.5%` ⇒ carrier ("red"), else non-carrier ("green").
  3.5% is a genuinely used screening cutoff, so the number itself is not wrong. But the
  literature is explicit that (a) many labs use ≥4.0% as *definite* trait, with 3.5-4.0%
  (some say 3.2-3.9%) a **borderline grey zone** needing further workup — one screen of
  23,485 found ~17% of people landed in this borderline band; (b) HbA2 should be interpreted
  alongside MCV <80 fL, MCH <27 pg, RBC count and iron status (co-existing iron deficiency
  can falsely LOWER HbA2 and hide a true carrier — a false "green"), and (c) the accepted
  method is CE-HPLC / capillary electrophoresis, not a bare percentage. Binary red/green at
  a single 3.5% point discloses more certainty than the assay supports in the grey zone and
  can both over-call (3.5-4.0% borderline reported as definite carrier) and under-call
  (iron-deficient true carrier with HbA2 pulled below 3.5%).
- Root cause:  One threshold, no borderline band, no MCV/MCH/RBC/iron cross-check, no method
  qualifier.
- Impact:      clinical-safety / user-trust — premarital carrier calls drive genetic-
  counselling decisions; a false binary in either direction has real consequences.
- Best-fit fix (hint for implementer): introduce a borderline band (e.g. 3.5-4.0% → "further
  workup / repeat HPLC + RBC indices" rather than definite carrier), and where MCV/MCH are
  available, flag microcytosis with low-normal HbA2 as possible masked carrier. State that
  the result is HPLC-dependent.
- Effort:      M
- Blast radius / dependencies: feeds `carrier_pair_risk` presentation and the
  `bothCarriers` counselling headline (L72-75).
- Guideline ref: ICMR-NIIH "Guidelines for screening, diagnosis and management of
  hemoglobinopathies" (India) — CE-HPLC quantification of HbA2/HbF, HbA2 ~3.5% cutoff with
  MCV<80/MCH<27; literature on borderline HbA2 3.2-3.9% grey zone (Mosca et al.; Sci Rep
  2022, PMC8969165; Clin Epidemiol Glob Health 2022). Definite-trait cutoff ≥4.0% widely
  used.

---

### [P1] WS3A06 — STI gate treats a single reactive SCREENING result as a definitive "Active infection detected" — diagnostic over-claim on every marker
- Area:        validation / regulatory
- Location:    `backend/src/services/compatibility/reportSummary.service.js:114-207`
  (`checkSTISafetyGate`) and its presentation wrap at `:311-340, :724-738`
- Status:      Confirmed (code paths + copy read directly)
- Evidence:    A single reactive/positive screen fires a "critical" finding with definitive
  language:
    - Syphilis: `Reactive` VDRL/RPR ⇒ "**Active Syphilis** (VDRL Reactive) detected"
      (L150). VDRL/RPR are NON-treponemal — they require a confirmatory treponemal test
      (TPHA/TPPA/FTA-ABS) and can be biological false positives (pregnancy, autoimmune) or
      serofast/treated old infection. "Active Syphilis detected" from RPR alone is a
      diagnostic over-claim.
    - HIV: `Reactive` Ab ⇒ detail says confirmatory testing needed (L161, careful) BUT the
      presentation layer titles it "**Active HIV Detected**" (L334-337) and the gate
      narrative says "active infectious disease markers have been found" (L330). NACO
      requires a **three-test** algorithm (Strategy III) before an HIV diagnosis; one
      reactive screen (esp. rapid) is not diagnostic and has false positives.
    - Hepatitis B: `Reactive` HBsAg ⇒ "indicating **active** Hepatitis B infection" (L183).
      FDA-approved HBsAg inserts require a **neutralization confirmatory** test on
      repeatedly-reactive samples before a patient is told they are HBsAg-positive; low-titre
      reactives have a high false-positive rate. "Active" also overstates vs. acute/chronic.
    - Hepatitis C: detail is careful ("possible ... HCV RNA confirmatory testing required",
      L194) — anti-HCV+ can be cleared/past infection — yet the presentation still titles it
      "**Active Hepatitis C Detected**" (L334). Contradiction between careful detail and
      over-claiming headline.
  All findings are marked `severity: 'critical'` and cap the couple score at 50 with copy
  "One or more **active** infectious disease markers were detected" (L324-330).
- Root cause:  Screening reactivity is conflated with confirmed active infection; no
  window-period or confirmatory-test gating; the presentation headline ("Active {sti}
  Detected", "active markers") over-claims even where the underlying detail text is careful.
- Impact:      clinical-safety / user-trust / legal-regulatory — a false "Active Syphilis/
  HIV/HepB detected" shown to a couple pre-marriage from an unconfirmed screen is a
  high-harm over-claim (relationship, psychological, stigma consequences from a false
  positive). Borders P0 (false clinical claim shown to users) for the syphilis and HBsAg
  "active infection" wording specifically.
- Best-fit fix (hint for implementer): reframe uniformly as "reactive SCREENING result —
  requires confirmation" with the specific confirmatory pathway per marker (RPR/VDRL →
  treponemal TPHA/TPPA; HIV Ab → NACO 3-test algorithm; HBsAg → neutralization confirmation;
  anti-HCV → HCV RNA). Remove "Active ... Detected" / "active infection" from the headlines;
  keep the specialist-referral urgency without asserting a diagnosis.
- Effort:      M
- Blast radius / dependencies: `checkSTISafetyGate` is also exported and reused by
  reportGeneration.service.js / mental.controller.js recompute (L759); copy changes must
  propagate to both the gate object and the presentation `sti_gate` block.
- Guideline ref: CDC/standard syphilis testing algorithm (non-treponemal RPR/VDRL →
  confirmatory treponemal TPHA/TPPA/FTA-ABS); NACO National HIV Testing algorithm (Strategy
  III, three reactive assays required for diagnosis); FDA-approved HBsAg package inserts —
  neutralization confirmation of repeatedly-reactive samples (see PMC33629106, 2021);
  anti-HCV reactive requires HCV RNA to confirm active infection (CDC HCV testing guidance).

---

### [P2] WS3A07 — "All clear / tested negative" STI copy ignores window periods
- Area:        validation
- Location:    `backend/src/services/compatibility/reportSummary.service.js:315-318`
  (default non-triggered STI copy)
- Status:      Static-only
- Evidence:    When no marker is reactive, the report states "Both of you tested negative for
  the standard premarital infectious disease screens" and "HIV, Syphilis, and Hepatitis B/C
  are non-reactive" as an unqualified all-clear. A non-reactive result inside the window
  period does not exclude infection (HIV Ab-only up to ~3 months, HIV Ag/Ab ~2-4 wks; HCV
  ~8-11 wks; HBsAg ~4 wks; syphilis ~3-6 wks). No recency/window caveat is present.
- Root cause:  Negative screen equated with true negative regardless of exposure timing.
- Impact:      user-trust / clinical-safety — over-reassurance if a partner tested within a
  window after recent exposure.
- Best-fit fix (hint for implementer): add a brief window-period caveat to the all-clear
  copy (e.g. "based on tests done ≥3 months after any potential exposure").
- Effort:      S
- Blast radius / dependencies: presentation `sti_gate` non-triggered branch only.
- Guideline ref: Standard test window periods — CDC HIV/HCV testing guidance; NACO HIV
  testing guidelines (India).

---

## Sources
- WHO Laboratory Manual for the Examination and Processing of Human Semen, 6th ed., WHO, July 2021 — [ScienceDirect summary](https://www.sciencedirect.com/science/article/pii/S0015028221022986), [NHS lower-reference-limits sheet](https://mft.nhs.uk/app/uploads/sites/4/2023/01/Lower-reference-limits-2021.pdf), [WHO 2021 values table](https://www.fertility-smart.net/knowledge-center/normal-semen-analysis-who-2021/)
- ESHRE Bologna criteria — [Ferraretti et al., Hum Reprod 2011](https://academic.oup.com/humrep/article/26/7/1616/2913872); POSEIDON — [Humaidan et al., 2016 (PMC6107695)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6107695/)
- ASRM Optimizing natural fertility (2022) & fecundability-by-age — [ASRM](https://www.asrm.org/practice-guidance/practice-committee-documents/optimizing-natural-fertility-a-committee-opinion-2021/), [fecundability by age](https://pubmed.ncbi.nlm.nih.gov/34065492/)
- Beta-thalassemia HbA2 borderline — [Sci Rep 2022 (PMC8969165)](https://pmc.ncbi.nlm.nih.gov/articles/PMC8969165/), [Borderline HbA2 dilemma (PubMed 34893152)](https://pubmed.ncbi.nlm.nih.gov/34893152/), [ICMR-NIIH hemoglobinopathy guidelines (PMC4228561)](https://pmc.ncbi.nlm.nih.gov/articles/PMC4228561/)
- Syphilis algorithm (non-treponemal → treponemal) — [NM Health guide](https://www.nmhealth.org/publication/view/guide/8166/), [Medscape workup](https://emedicine.medscape.com/article/229461-workup)
- NACO HIV three-test algorithm — [ResearchGate NACO Strategy III](https://www.researchgate.net/figure/NACO-strategy-algorithm-III-B-for-HIV-testing_fig1_345240125), [PMC6896380](https://pmc.ncbi.nlm.nih.gov/articles/PMC6896380/)
- HBsAg confirmatory neutralization — [PMC33629106 (2021)](https://pubmed.ncbi.nlm.nih.gov/33629106/)
</content>
</invoke>
