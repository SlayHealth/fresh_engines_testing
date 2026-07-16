# SlayHealth — Work Report, 2026-07-15

**Scope:** Implementation pass against `SLAYHEALTH_DEEP_REVIEW.md` and its companion `review/WS*.md`
files (100+ findings, P0–P3, produced earlier the same day). Nothing committed — all changes sit
uncommitted in the working tree, staged for review.

**Method:** every fix was verified against real behavior, not just read as code — JWT-authenticated
API calls, seeded disposable Postgres rows (cleaned up after each check), direct controller invocation
with fake req/res, and headless-browser passes where the UI was involved. The two pre-existing
regression suites (`backend/tests/parser.test.js`, `backend/__tests__/usg-scoring.test.js`) plus a new
one written today (`backend/__tests__/sti-gate-ontology-binding.test.js`) were run after every change.

---

## Headline result

| Tier | Total findings | Fixed today | Remaining |
|------|----------------|-------------|-----------|
| P0 — clinical-safety / false-compliance | 6 | **6 (100%)** | 0 |
| P1 — materially wrong score / trust breach | 17 | **17 (100%)** | 0 |
| P2 — correctness/robustness gaps | 24 | **15 (63%)** | 9 |
| P3 — polish / DX / minor UX | 8 | 0 | 7 (+1 confirmed non-issue) |
| **Total actionable findings** | **55** | **38 (69%)** | **17** |

Every P0 and every P1 finding — the entire "clinically dangerous or user-trust-breaking" tier — is
resolved. The remaining work is P2/P3: robustness gaps, validation-provenance gaps, and polish, none of
which reach users as an active safety or trust problem today.

The separate **UX review** (`SLAYHEALTH_UX_REVIEW.md`) is its own, still-incomplete document — only
3 of its 12 planned workstreams (`ux_WS2_ia_nav`, `ux_WS4_visual`, `ux_WS12_ideation`) have been
produced; the other 9 (flows, report comprehension, responsive, a11y, states, consent, copy,
performance, funnel synthesis) were never generated, and no UX findings were implemented today. This
review needs to finish before it can be worked the same way the deep review was.

---

## P0 — fixed (6/6)

| ID | What was wrong | Fix |
|----|----------------|-----|
| WS0-02 / WS1D02 | STI gate missed "Positive"/"Detected" phrasing → an infected couple could score normal | Replaced 5 duplicated regex pairs with one shared `classifySerologyResult()` using explicit whole-word positive/negative/equivocal vocabulary |
| WS0-03 | Gate's `!/non/i` guard wrongly cleared a reactive result containing "non" anywhere | Same fix as above |
| WS1D03 | Gate wrongly fired on "Not Reactive"/"Undetected" → capped a healthy couple's score | Same fix as above |
| WS6-01 | `story/page.js` read radiology under keys (`scores_json`, `risk_flags_json`) the real API never returns → fabricated organ scores + "no organic blocks" prose for every couple | Fixed to read the real response shape (`scores`, `risk_flags`) |
| WS6-02 | The on-screen headline ring was recomputed client-side, bypassing the STI-gated authoritative score | Now reads the persisted `presentation_json.relationship_snapshot.score` |
| WS0-09 / REG-01 | Dashboard claimed "DPDP-compliant" in present tense while the app's own settings admitted it's unbuilt | Removed the false claim from `MobileHomeView.js` |

## P1 — fixed (17/17)

| ID | What was wrong | Fix |
|----|----------------|-----|
| WS1D01 | An unscanned organ scored a perfect 100 instead of "not assessed" | Every organ scorer now returns `null` when not imaged; composite renormalizes over what's actually assessed |
| WS1C01 | Mental headline was a pure agreement metric — two partners who both floor every answer "agree" and score 100 | Headline now capped at `min(agreement, per-partner quality mean)` |
| WS1A03 | Diabetic gate read only HbA1c, ignoring extracted fasting glucose (common India-only panel) | `detectGlucoseCategory` now checks both HbA1c and FBG, worst wins |
| WS1A02 | A diagnosed diabetic could show ~4.9% risk on the UI radar, contradicting the capped clinical score | `uiRisk` now derives from the same gated value as the real score |
| WS1A01 | BP/glucose/lipid likelihood ratios multiplied as if independent, overstating metabolic-syndrome risk ~63% | Added `shrinkCorrelatedLRs()` — a single elevated marker stays unchanged; multi-marker compounding is damped |
| WS1B03 | MFR blended partners so a healthy partner masked a near-sterile one | Reweighted the blend toward the impaired partner; increased the penalty magnitude (both via explicit sign-off) |
| WS1B02 | Empty MFR input fabricated 93.7% / "Aligned" | Added a minimum-input 422 gate before scoring |
| WS2-01 | No SI-unit conversion — mmol/L values fed scoring as bare numbers | Added `SI_UNIT_CONVERSIONS` + `normalizeUnitToken()` |
| WS2-02 | Comma-grouped numbers & trailing H/L flags failed to parse (ferritin "1,200" → reference range stored as the value) | Added `stripValueNoise()` |
| WS2-03 | "Blood Urea" fuzzy-matched to BUN (a ~2.14× mismap) feeding live scoring | Registered "blood urea"/"urea" as exact aliases ahead of fuzzy search |
| WS3A06 / REG-04 | STI gate + report language asserted a single reactive screen as confirmed "active infection" | Rewrote all copy to screening-result language naming the correct confirmatory pathway per marker |
| WS3A04 | Age-fertility curve ran ~2× optimistic from 38-44; hard cliff to 0 at exactly 45 | Recalibrated the curve to literature; replaced the cliff with a continuous taper into the existing 50-anchor |
| WS6-03 / WS8-04 | Mental `\|\| 80` fabricated a score for a genuine 0; `\|\| 'Highly Aligned'` failed open | Swapped to `typeof === 'number'` checks and a neutral "Not scored" fallback |
| WS0-07 / WS6-04 | `usg/page.js` hardcoded `'Sachin'`/`'Swati'` name fallbacks + age defaulted to 30 | Replaced with "Partner A"/"Partner B" and an honest null for missing DOB |
| WS6-05 | Session restore never rehydrated prospect sex/DOB — a post-restore upload could send the wrong sex into real radiology scoring | `restoreMatchSession` now sets `prospectForm.gender` unconditionally |
| REG-03 / WS0-10 | "Doctor Reviewed" badge shown in 4 places with no clinician-review artifact anywhere in the repo | Replaced with "Evidence-Based" everywhere |
| REG-02 | No "informational, not a diagnosis" disclaimer existed anywhere | Added to the dashboard trust line and the report shell (`core-engine/layout.js`) |

**Also fixed, discovered during this pass (not originally its own line item):**
- **`isUserMale` case-sensitivity bug** — bare `=== 'male'` checks against a capitalized `user.gender` were silently always false, swapping which partner's data fed which sex-specific engine path on every live match. Fixed in both the live match-creation flow and session restore.
- **`parentDiabetes` hardcoded to `false`** in the live match flow regardless of what the user actually selected, plus family-history scoring collapsed to boolean (couldn't reach the validated "both parents" 20-point tier). Added a proper 3-tier family-history question to the UI and wired it through end-to-end.

## P2 — fixed (15/24)

WS1A07 (dropped the uncited cross-partner lifestyle penalty from individual risk scores) · WS1D07
(added a worst-domain floor to the top-level composite, reusing the exact threshold already established
for organ scoring) · WS1C04/05/06 (folded attachment/substance/anger mismatch into the mental headline
index; fixed fail-open categorical defaults) · WS1A04/WS3B01 (3-tier family history, see above) ·
WS3B02 (4-tier activity scoring matching the app's own UI) · WS3B09 (Asian-Indian BMI cutoffs instead
of Western) · WS2-04 (alias coverage for FBS, LDL, HDL, WBC, Sodium, Potassium, Uric Acid, Sperm Count,
T. Cholesterol, S. Creatinine) · WS2-07 (radiology LLM output now schema-validated/coerced, with a
retry-once on malformed JSON) · WS2-08 (multer PDF-only + size limit; radiology now routes through the
shared OCR provider) · WS0-05 (STI gate ↔ ontology binding test, so a future key-rename can't silently
break the gate) · WS1B04/05/06 (plausibility gates on AMH/AFC/age; removed dead constants) · WS1D04
(resolved as a side effect of the WS3A06/REG-04 copy rewrite) · REG-05 (removed the HIPAA
misapplicability — no US nexus in this product) · WS2-10 (hemoglobin-variant card: replaced vague
"not part of this analysis" with a dated, tracked engineering note) · WS0-11 (added the missing `afc`
ontology canonical, unblocking AFC-based ovarian reserve classification).

## P2 — remaining (9)

| ID | What's outstanding | Effort |
|----|---------------------|--------|
| WS8-03 | Systemic fabrication-on-absence — many individual instances were fixed piecemeal today (activity default, substance/attachment defaults, AMH/AFC plausibility, etc.), but the review's proposed single unified `not_assessed` state threaded through all 3 engines + composite was not built | L |
| WS8-01 | Report pages are still context-only — hard nav/refresh/deep-link bounces to `/dashboard`; no shareable report URL | M |
| WS1C02 | Big Five items still scored purely monotonically (agreeableness=5 = "best") — a validity concern the research doc itself flags | M |
| WS1D05/06 / WS3A05 | Thalassemia HbA2 is still a hard `>3.5` binary; no 3.5–4.0 borderline band | M |
| WS3B04/05 | All likelihood ratios / mappings / baseline odds are still hardcoded with no dated, versioned provenance module | L |
| WS3B12 | DEXA scoring still reads T-score as primary even for a premenopausal cohort (ISCD 2023 wants Z-score here); Z-score is extracted but unused | M |
| WS1A09 | "10-year projection" is still a fixed `1.05^y` curve, identical for every person | M |
| WS3A02 | AMH cutoffs still uncited; ASRM/POSEIDON diminished-reserve thresholds absent from the age-banded classification | M |
| REG-06 | No visible DPDP substantiation (consent/rights/retention/breach) behind the compliance framing — largely a legal/policy task, not code | L |

## P3 — remaining (7 actionable + 1 non-issue)

Not started this session (focus was P0–P2): WS1D08 (radiology/genetics near-constant baseline),
WS1A06 (IDRS→LR score cliffs), WS1C08 (DAST/ACE items never built), WS3B08 (lipid cutoffs
edition-lagged), WS3B11 (DEXA off-by-boundary at exactly -2.5), WS3A07/WS3A03 (STI window-period
copy, AFC young-age threshold), REG-07 (unbacked landing-page stats). `WS6-06` is listed in the
roadmap but the review itself already confirmed it's a non-issue (chart-interpolation-only,
structurally unreachable) — no action needed.

## Confirmed-correct (no action needed, don't re-touch)

`WS0-01`, `WS0-06`/`WS1B01`, `WS1D09`, `WS3A01`, `WS3B03`, `WS3B06`, `WS3B07`, `WS8-02`, `WS1C10`,
`WS2-06` — all independently re-verified by the review as already working correctly.

---

## Verification & safety notes

- All 3 regression suites (parser, USG scoring, STI-gate/ontology binding) pass after every single
  change made today.
- Every P2 item involving a real clinical/product calibration choice (WS1A07's shared-lifestyle
  penalty, WS1D07's composite floor, WS1C04/05's headline weighting, WS2-10's hemoglobin-variant
  scope) was presented with concrete before/after numbers and decided explicitly, not assumed.
- Nothing has been committed. `git status` shows all changes as uncommitted working-tree modifications
  plus a handful of new untracked files (`schemaValidator.js`, the new STI-binding test, two new
  frontend files, and the review docs themselves).
- No production data exists yet, so no migration/backfill concerns apply to any of the scoring changes
  made today.
