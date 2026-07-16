# WS1B — MFR / Fertility Timeline engine review

Target: `backend/src/controllers/mfr.controller.js` (628 lines). Single exported entrypoint
`analyzeMfr` (POST `/mfr/analyze`, auth-gated — `mfr.routes.js:7`), plus `classifyOvarianReserve`
re-exported for reuse. All findings below were reproduced by driving `analyzeMfr` end-to-end with the
real controller code (DB + LLM stubbed; see scratch scripts at bottom). Numbers quoted are actual
observed outputs, not hand-guesses, except where explicitly labelled hand-trace.

---

## What it ACTUALLY computes (map, with line refs)

1. **Age → biological fertility score** via linear interpolation over two hard-coded tables:
   - `FEM` = `{18:97, 24:97, 25:94 … 44:11, 45:7, 50:4}` (line 22)
   - `MAL` = `{18:97, 25:97, 30:95 … 50:62, 55:55}` (line 23)
   - `interp()` (lines 9-20): clamps to nearest endpoint outside the table range; linear between keys.
   - `fScore`/`mScore` (lines 25-26) add the reserve/semen adjustment then clamp to `[2,100]`
     (`Math.max(2, Math.min(100, …))`). **Floor is 2, never 0.**
2. **Ovarian-reserve classification** `classifyOvarianReserve(amh, afc, age)` (lines 38-99): four age
   bands (`<30`, `<35`, `<40`, `40+`), each with AMH cutoffs (lines 43-63) and AFC cutoffs (lines
   68-88) producing `Very Low / Low / Normal / High for age`. When both AMH and AFC classify, it
   returns the **worse** (lower-ranked) of the two (line 96).
3. **Semen classification** `classifySemen(...)` (lines 113-188), WHO-2021 limits. `concentration===0`
   or `totalCount===0` → immediate `{category:'Severe Deficit', details:'Azoospermia'}` (lines
   121,130). `belowCount>=3` OR `concentration<5` → Severe; `==2` Moderate; `==1` Mild (lines
   173-180). Guarded by `isRealNumber` (line 111) so a genuinely absent param (NaN) no longer counts.
4. **Category → point adjustments**: `reserveModifiers` `{High for age:+5, Normal:0, Low:-10, Very
   Low:-20}` (line 267); `semenModifiers` `{Normal:0, Mild:-8, Moderate:-18, Severe:-30}` (line 270).
5. **Tier-2 radiology modifiers** (lines 280-396): female USG/HSG (uterine lining, fibroids, tubal
   patency, PCOS, ovarian volume, pelvic fluid, fatty liver) adjust `fReserveAdj`; male scrotal/abdo
   (varicocele, testicular volume, scrotal obstruction, prostate, PVR, fatty liver) adjust `mSemenAdj`.
   `Both blocked` tubal (line 307) and `scrotalObstruction==='Yes'` (line 364) set `physicalBlock=true`.
6. **Tier-3 genomic modifiers** (lines 402-442): `yDeletion` AZFa/AZFb → `geneticBlock=true` (line
   408); AZFc → `mSemenAdj-=25`; abnormal male karyotype → `geneticBlock` (line 416); MTHFR homo/hetero
   → `fReserveAdj -8/-3`; abnormal female karyotype → `fReserveAdj-=20`; CFTR+CBAVD → warning only.
7. **Absolute-barrier gate** (lines 455-459): `gate = b_tubal || b_azoo || b_uterus || CBAVD ||
   physicalBlock || geneticBlock || serverDetectedAzoospermia || severeOvarianReserve`.
8. **Blend → probability**: `mfrAt` (lines 28-35) — if `fa>=45` returns 0; else
   `combined = 0.6*min(f,m) + 0.4*max(f,m)`, `bio = combined/100 * 0.25`. Then `p_monthly = gate ? 0 :
   bio * lambda * freq` (lines 477-478), and `p_12m = gate ? 0 : 1-(1-p_monthly)^12` (lines 492-493).
   Lifestyle index `L=max(0,100-penalties)` (line 470), `lambda_current=0.55+0.45*(L/100)` (line 472).

Unused constants: `FEMALE_AGE_LIMIT=45` and `MALE_AGE_LIMIT=55` (lines 5-6) are declared but never
referenced — the 45 cutoff is hard-coded in `mfrAt` (line 29) and there is **no** male equivalent.

---

### [P1] WS1B01 — Absolute-barrier gate does NOT leak: positive modifiers cannot add probability back (the critical question, answered)
- Area:        engine
- Location:    mfr.controller.js:457-459, 477-478, 487-488, 492-493
- Status:      Confirmed (reproduced) — reassuring result
- Evidence:    `scratch/ws1b_probe.js`, cases A1-A5. Each pairs a hard barrier with maximally positive
  modifiers (female age 24, `High for age` reserve, zero lifestyle penalty, `freq 0.99`):
  - A1 `barriers.b_azoo` → `monthly 0`, `p_12m_current 0`, `p_12m_optimised 0`, `state Specialist`.
  - A2 server-detected azoospermia (report `sperm_concentration=0`) → semenQ `Severe Deficit`, gate,
    `monthly 0`, `p_12m 0` (internal `mfin=67` computed but discarded).
  - A3 `tubalPatency:'Both blocked'` (Tier-2 physicalBlock) → `0`.
  - A4 `yDeletion:'AZFa'` (Tier-3 geneticBlock) → `0`.
  - A5 `ovarianReserve:'Very Low'` (severeOvarianReserve) → `0`.
- Root cause:  The gate is a boolean applied as a terminal short-circuit (`gate ? 0 : …`) on
  `p_monthly_current`, `p_monthly_optimised`, every `projection[]` element, and both `p_12m`. Positive
  modifiers only feed `fReserveAdj`/`mSemenAdj`/`bio`, which are all upstream of the multiply-by-zero.
  There is no additive term after the gate, so nothing can "add back." Definitively: **no leak.**
- Impact:      clinical-safety (this is the safety-critical invariant and it holds).
- Best-fit fix (hint): none required for the leak itself. Keep as a regression guard — add a test that
  asserts every barrier drives all four probability outputs to exactly 0.
- Effort:      S (test only)
- Blast radius / dependencies: none.
- Guideline ref: ESHRE/ASRM — bilateral tubal occlusion & azoospermia are absolute indications for ART, not natural-conception counselling.

---

### [P1] WS1B02 — Engine fabricates a specific 93.7% 12-month conception probability from an empty request body
- Area:        engine / validation
- Location:    mfr.controller.js:230, 240, 237, 258, 467-493
- Status:      Confirmed (reproduced)
- Evidence:    `scratch/ws1b_probe.js` case E1, body `{}`:
  `state='Aligned'`, `monthly_chance_current=20.61%`, `p_12m_current=93.73%`, `p_12m_optimised=93.73%`,
  `calculations={fbase:86, ffin:86, mbase:95, mfin:95, bio:0.224}`.
- Root cause:  Every input silently defaults to a favourable value: `fAge`/`mAge` → 30 (lines 230,240,
  via `parseFloat(...)||30`), `ovarianReserve` → `'Normal'` (line 237), `semenQuality` → `'Normal'`
  (line 258), lifestyle penalties → 0 so `L=100` (lines 462-470), `freq` → 0.92 (line 467). The result
  is a precise, highly-favourable number presented via `res.json` as a real assessment with no
  "insufficient data" signal.
- Impact:      user-trust / clinical-safety — a couple who submitted nothing (or whose data failed to
  load) is told they have a 94% annual chance and are "Aligned."
- Best-fit fix (hint): require a minimum input set (at least both ages) before computing; otherwise
  return an explicit `insufficient_data` state instead of a probability. Track a `data_completeness`
  flag and surface it. Do not let categorical defaults masquerade as measured values.
- Effort:      M
- Blast radius / dependencies: frontend must render the new "insufficient data" state; touches the
  same default-on-absence pattern as WS1B06.

---

### [P1] WS1B03 — Weighted-average blend lets a healthy partner mask a near-sterile (sub-gate) partner
- Area:        engine
- Location:    mfr.controller.js:26 (floor of 2), 33 (0.6·min + 0.4·max)
- Status:      Confirmed (reproduced)
- Evidence:    Two paths, both real inputs:
  - `scratch/ws1b_probe4.js` (report path): `sperm_concentration=2` M/mL (cryptozoospermia, near-
    sterile but NOT azoospermic) → `Severe Deficit`, `mSemenAdj=-30`, `mfin=57`, healthy `ffin=86` →
    **`monthly 15.78%`, `p_12m 87.3%`, `state 'Plan together'`, `gate=false`.**
  - `scratch/ws1b_probe3.js` (worst-case): male age 54 + `Severe Deficit` + `AZFc` + `Grade 3
    varicocele` → `mSemenAdj=-67`, `mfin` clamped to floor **2** → still `monthly 8.19%`, `gate=false`.
- Root cause:  `combined = 0.6*min(f,m) + 0.4*max(f,m)` is a weighted average, so the healthy partner's
  score always contributes `0.4*max`. With the `Math.max(2,…)` floor (line 26) the weak partner can
  never fall below 2. Hand-trace worst case: `0.6*2 + 0.4*86 = 35.6` → `bio=0.089` → `p_monthly=0.089*
  1.0*0.92=0.0819` → `p_12m=1-(1-0.0819)^12≈0.64`. Conception requires both gametes viable; a weighted
  average lets one strong partner compensate for a functionally sterile one, which is biologically wrong.
- Impact:      clinical-safety / correctness — near-sterile couples receive optimistic natural-
  conception timelines and are steered away from timely ART referral.
- Best-fit fix (hint): make the joint score min-dominated or multiplicative (e.g. `bio ∝ (f/100)*(m/100)`
  or a much heavier min weight), and/or lower the per-partner floor so a Severe Deficit approaches 0.
  Consider promoting `Severe Deficit` (concentration<5) to a soft/hard specialist route.
- Effort:      M
- Blast radius / dependencies: changes headline probability for many couples; re-tune thresholds and
  the `state` pill cutoffs (lines 510-516) together; coordinate with WS1A composite if shared.
- Guideline ref: WHO 2021 semen limits; severe oligozoospermia (<5 M/mL) is a recognised ART indication.

---

### [P2] WS1B04 — No physiological-plausibility validation on AMH/AFC; a negative AMH hard-gates the couple
- Area:        validation / engine
- Location:    mfr.controller.js:41-64 (classifyByAmh), 233-234 (parse), 456 (severe-reserve gate)
- Status:      Confirmed (reproduced)
- Evidence:    `scratch/ws1b_probe2.js`: direct `classifyOvarianReserve(-5, undefined, 28)` → `'Very
  Low'`; `classifyOvarianReserve(-1, undefined, 42)` → `'Very Low'`. End-to-end with report
  `hormones.amh.value = '-5'` → `detected_reserve='Very Low'`, `gate=true`, `monthly 0%`.
- Root cause:  `classifyByAmh`/`classifyByAfc` guard only `undefined/null/isNaN` (lines 42,67); any
  finite value, including negatives and 0, falls into the `< threshold` → `Very Low` branch. A negative
  AMH is physically impossible and is a classic OCR/extraction glitch, yet it is accepted as a real "Very
  Low" and (via `severeOvarianReserve`, line 456) triggers the hard barrier → "natural conception
  blocked."
- Impact:      data-integrity → clinical-safety — a single mis-extracted lab value silently routes a
  couple to specialist/ART with a 0% probability and no flag.
- Best-fit fix (hint): reject non-positive / out-of-range AMH & AFC (e.g. AMH must be `>0` and below a
  sane ceiling; AFC an integer `>=0`) before classifying; treat implausible values as missing + emit a
  validation warning rather than a diagnosis.
- Effort:      S
- Blast radius / dependencies: interacts with WS1B02 (missing-vs-garbage handling); mirror the same
  guard anywhere `classifyOvarianReserve` is now reused (reportSummary.service.js).

---

### [P2] WS1B05 — No age-range validation: negative age → max fertility; "0" coerced to 30; garbage strings partially parsed
- Area:        validation / edge-case
- Location:    mfr.controller.js:230, 240 (`parseFloat(...)||30`), interp 11-12
- Status:      Confirmed (reproduced)
- Evidence:    `scratch/ws1b_probe.js` + `ws1b_probe3.js`:
  - `age=-3` → `fAge=-3`, `interp` clamps to table min → `Fbase=97`, `monthly 22.31%`, `state 'Aligned'`,
    `gate=false` (a negative age yields the best possible fertility).
  - `age=12` → `Fbase=97` (12-year-old gets max fertility; no lower bound).
  - `age='0'` and numeric `0` → `fAge=30` (because `0` is falsy, `||30` fires) — inconsistent with `-3`
    being kept.
  - `age='35abc'` → `35` (parseFloat is lenient); `age='thirty'`/`''`/`null`/`undefined` → `30`.
- Root cause:  `parseFloat(x) || 30` accepts any finite non-zero number (including negatives), silently
  defaults falsy/`0`/NaN to 30, and `parseFloat` tolerates trailing garbage. `interp` then clamps
  out-of-range ages to a table endpoint with no plausibility check.
- Impact:      correctness / clinical-safety — implausible ages produce confident, favourable outputs.
- Best-fit fix (hint): validate age is a finite number within a reproductive range (e.g. 18-60) and
  reject/flag otherwise; use `Number.isFinite` + explicit range check instead of `|| 30`.
- Effort:      S
- Blast radius / dependencies: none beyond input validation.

---

### [P2] WS1B06 — Absent labs silently default to "Normal" (fabrication-on-absence), and MALE_AGE_LIMIT is dead code
- Area:        engine / validation
- Location:    mfr.controller.js:237, 258 (defaults); 5-6, 29 (age limits)
- Status:      Confirmed (reproduced)
- Evidence:
  - `scratch/ws1b_probe2.js`: report with no semen keys → `detected_semen=null` → `semenQuality`
    defaults to `'Normal'` (line 258) → male treated as fully normal (adj 0). Same for absent
    reserve → `'Normal'` (line 237). (classifySemen itself now correctly returns `null` on all-absent —
    the regression noted in the code comment lines 101-111 is fixed; the leak is the downstream default.)
  - `scratch/ws1b_probe3.js`: male age 60 (female 30) → `Mbase=55` (clamped to MAL max key 55),
    `monthly 15.5%`, `gate=false`. `MALE_AGE_LIMIT=55` (line 6) is never referenced; only the female
    `fa>=45→0` cutoff (line 29) exists. `FEMALE_AGE_LIMIT` (line 5) is likewise unused.
- Root cause:  `x || 'Normal'` treats "no data" identically to "measured normal"; and the intended male
  age ceiling was never wired in, so male fertility is only ever floored by the table (55 at 55+).
- Impact:      user-trust / correctness — missing male labs read as a clean bill of health; very old
  males keep a materially positive score with no upper-age attenuation.
- Best-fit fix (hint): distinguish `null` (no data) from `Normal` in the output and in the LLM prompt;
  either enforce `MALE_AGE_LIMIT` as a soft attenuation/gate or delete the misleading dead constants.
- Effort:      S/M
- Blast radius / dependencies: shares the missing-data theme with WS1B02.

---

### [P3] WS1B07 — Age-45 probability cliff + dead FEM table rows create a base-score/probability inconsistency
- Area:        engine / edge-case
- Location:    mfr.controller.js:29 (`fa>=45` → 0), 22 (FEM has 45:7, 50:4), 567 (female_base_score display)
- Status:      Confirmed (reproduced)
- Evidence:    `scratch/ws1b_probe.js` age sweep: `age 44.5 → monthly 7.85%`; `age 45.0 → monthly 0%`
  (discontinuous cliff). Yet `calculations.female_base_score` still interpolates the 45/50 table rows
  (e.g. `Fbase=7` at 45, `4` at 50), so the response can show a positive female base score alongside a
  0% probability.
- Root cause:  Hard `fa>=45` cut in `mfrAt` vs. the smoothly-decaying FEM table used for the displayed
  `female_base_score`; the 45/50 table entries never influence probability.
- Impact:      UX / user-trust — a visible base score contradicts the 0% headline; sharp cliff at an
  arbitrary integer boundary.
- Best-fit fix (hint): either taper female contribution smoothly toward 0 across 44-46 or suppress the
  displayed base score once the age gate fires, so the two numbers agree.
- Effort:      S
- Blast radius / dependencies: display-only unless the cliff itself is softened.

---

### Confirmed-correct (positive findings — verified, not bugs)

- **WS1B-OK1 — AMH/AFC band boundaries are clean.** `scratch/ws1b_probe2.js` full sweep across all four
  age bands: consistent `<` (Very Low) then `<=` (Low, Normal) operators, no overlap, no unreachable
  band, monotonic. Combination returns the worse of AMH/AFC (line 96) — conservative and sound.
- **WS1B-OK2 — 12-month compounding is mathematically correct.** `p_12m = 1-(1-p_monthly)^12` (line
  492). Verified: `p_monthly=0.20608` → `1-(1-0.20608)^12 = 0.93729` = reported `p_12m_current`. Correct
  independent-monthly compounding.
- **WS1B-OK3 — `interp` has no divide-by-zero / NaN path.** Table keys are distinct sorted numbers so
  `ks[i+1]-ks[i] > 0` always; out-of-range ages clamp to endpoints (lines 11-12) rather than extrapolate.
- **WS1B-OK4 — classifySemen partial-data degrades gracefully.** Only-concentration-present (=10) →
  `Mild Deficit`; all-absent → `null`. The `isRealNumber` guard (line 111) prevents the NaN-passes-every-
  check fabrication described in the code comment (lines 101-110).

Minor: `time_to_conceive` pluralization ternary `medianMonths === 1 ? 'mo' : 'mo'` (line 501) — both
branches identical, a no-op (P3 polish).

---

## Scratch scripts (all under `backend/scratch/`, run with `node`, read-only; DB+LLM stubbed)
- `ws1b_harness.js` — stubs `postgres.service` + `llm.service` via `require.cache`, exposes
  `runMfr(body, reports)` that drives the real `analyzeMfr` and captures `res.json`.
- `ws1b_probe.js` — barrier-leak cases A1-A5, age-band interp sweep, empty-body case.
- `ws1b_probe2.js` — AMH/AFC boundary sweep, negative-AMH gate, partial semen, age parseFloat quirks.
- `ws1b_probe3.js` — age remainder + negative-age output, count=0 gate, male-age-60, 12m blend, worst-case blend.
- `ws1b_probe4.js` — report-path cryptozoospermia (concentration=2) sub-gate masking.
