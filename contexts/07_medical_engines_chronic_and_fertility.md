# Medical Engines (Deep): Chronic Disease Risk & Fertility Timeline

**Doc 07 of 22** · Audience: a solo full‑stack successor · Prerequisite: `02_architecture_and_backend_core.md`, `06_extraction_pipelines_pathology_and_radiology.md` (the extractors that feed these engines).

Goal of this doc: the **verbatim clinical reference** for two of the three medical engines — chronic/cardiometabolic risk and fertility (MFR). Every threshold, likelihood ratio, band, modifier, and formula is transcribed **exactly as it exists in code**, anchored to `file.js:LINE`, with its provenance/validation status and whether each review finding is **fixed** or **still open**. Read doc 08 for the third engine (mental wellbeing) and doc 09 for how these outputs are combined into the gated composite.

---

## 1. How to read this doc

These two engines are each **one Express controller with all math inline** — there is no separate scoring service module. That has three consequences you must internalize before touching anything:

1. **Constants are load‑bearing and versioned only by comment tags.** Every threshold lives as a literal in the controller, annotated with the review finding it addresses (`WS1A0x`, `WS3B0x`, `WS1B0x`, `WS3A0x`). There is **no `clinicalConstants` module, no version field, no date**. Changing any number silently re‑scores every historical match — there is no snapshotting (DEEP_REVIEW `OPP-W4-15` proposes one versioned module; not done).
2. **Code wins over the review corpus.** The review docs (`review/WS1A_chronic_engine.md`, `review/WS1B_mfr_engine.md`, `review/WS3A_*`, `review/WS3B_*`) were written against an **earlier** revision and cite **stale line numbers and stale constant values** (e.g. MFR `semenModifiers` Severe `-30`, `FEM[40]=38`, a `fa>=45` hard‑zero). Most of those findings are **already fixed** in the code you read. When a review number disagrees with the controller, **the controller is truth.** This doc is transcribed from the controllers at HEAD.
3. **`[interim]` means house value, pending clinical review.** Per product‑owner decision, every clinical constant that is not backed by a cited source is tagged `[interim]`. Even where the code cites a real instrument (ADA, WHO 2021, MDRF‑IDRS, NCEP ATP III), the *way* it is repurposed (a screening score as a longitudinal risk LR; fixed lipid strata as engine input) is not itself validated — those carry a cited‑but‑repurposed caveat noted inline.

> **Regulatory posture (open risk — REG‑06 / REG‑02/04/05).** Both engines emit patient‑specific, diagnostic‑grade outputs (a 10‑year metabolic projection, a 12‑month conception probability, "ART required" routing) with **no "not a diagnosis / informational only" disclaimer anywhere in the repo**, and the MFR LLM prompt personas the model as a "specialized reproductive endocrinologist AI." This doc records that gap **factually**; it takes **no** position on wellness‑vs‑SaMD. That determination is pending your decision + legal counsel (doc 21).

---

## 2. CHRONIC — request / response contract

`POST /analyze` on the chronic router, mounted under `/api/chronic`. The chain is `authenticateToken → checkMatchQuota → analyzeChronic` (`backend/src/routes/chronic.routes.js:8`).

### Request body

| Field | Required | Type | Notes |
|---|---|---|---|
| `male_report_id` | **yes** | id | Missing → **HTTP 400** (`chronic.controller.js:311`). Row missing in Postgres → **404** (`:320`). |
| `female_report_id` | **yes** | id | Same 400/404 rules (`:311`, `:321`). |
| `male_manual_data` | no | object | Defaults `{}` (`:305`). Overrides extracted values when a value is a valid enum member. |
| `female_manual_data` | no | object | Defaults `{}` (`:306`). |
| `shared_lifestyle_data` | no | object\|null | Defaults `null` (`:307`). Second‑priority lifestyle source. |
| `match_id` | no | id | Only used to key the 30‑day LLM insight cache (`:512`). |

There is **no request‑body schema validation** — `manual_data` is trusted as‑is (`chronic.routes.js` gotcha). The reports are read from Postgres as `SELECT extracted_json FROM reports WHERE id = $1` and `JSON.parse`d (`:315‑324`).

### Response shape (`res.json` at `chronic.controller.js:525‑568`)

| Field | Meaning |
|---|---|
| `partnerARisk` / `partnerBRisk` | UI radar risk, `min(60, 100 - gX)`, rounded 1dp (`:463`, `:527`). |
| `childrenPredisposition` | `'Low'`/`'Moderate'`/`'High'` (`:449`). |
| `lifestyleDividend` | `optimizedCurve[10] - currentCurve[10]`, rounded 1dp (`:431`). |
| `diabeticRangeDetected` | `gateOpen` boolean (`:373`). |
| `state` | `'Aligned'` / `'Plan together'` / `'Specialist conversation'` (`:434`). |
| `projection` | `{ years[0..10], currentLifestyle[], optimizedLifestyle[], idrsA[], idrsB[] }` (`:533`). |
| `partner_A` / `partner_B` | Full `extractPatientData` profile **plus** `pathologyScore` (=`gX`, 1dp) and `risk` (=`uiRiskX`, 1dp) (`:549`). Downstream code (chat LLM context) treats these as display‑ready. |
| `dynamic_insights` | LLM object or tagged fallback (§17). |
| `calculations` | Full numeric trace: per‑partner `{idrs, idrsLR, bioLR, lifestyleLR, odds, prob, protectiveScore}` + `coupleIndex`, `w`, `baselineProb` (`:466`). |
| `details` | Raw echoed inputs (`male_data`, `female_data`, both `manual_data`, `shared_lifestyle_data`) (`:561`). |

---

## 3. Chronic odds pipeline (verbatim)

The engine is branded **"HSP v2.1"** in an in‑file comment (`:4`) — that name has **no external referent**; treat it as an internal label, not a published model. The whole pipeline is a Bayesian odds chain: a flat prior, multiplied by three independent evidence channels (IDRS band, lifestyle, biomarkers), converted to a probability, then to a "protective score."

```
ODDS_0 ──▶ × idrsLR ──▶ × lifestyleLR ──▶ × bioLR ──▶ currentOdds
                                                          │
                                          p = odds/(1+odds)
                                                          │
                                    g = 100·(1−p)  ──(if glucose High)──▶ min(g, 25)
                                                          │
                              coupleIndex = 0.6·min(gA,gB) + 0.4·max(gA,gB)
```

| Constant / formula | Value | Source at | Provenance |
|---|---|---|---|
| `BASELINE_RISK_PROB` | `0.10` | `:5` | `[interim]` — flat prior for **all** ages/sexes; the disease it is a prior *for* is never defined. |
| `ODDS_0` | `0.10/0.90 = 0.111…` | `:6` | Derived from the above. |
| `p = odds/(1+odds)` | — | `:357‑358` | Standard odds→prob. |
| `protectiveScore gX = 100·(1−pX)` | — | `:376‑377` | House transform; higher = "more protected." `[interim]`. |
| `BIOMARKER_LR_SHRINKAGE_EXPONENT` | `0.7` | `:25` | `[interim]` — **explicitly uncited** in the comment; a reasoned estimate, no published correlation coefficient for this 3‑marker cluster (WS3B04/WS1A01). |

### `shrinkCorrelatedLRs(lrs, exponent)` (`:34‑39`)

BP, glucose, and lipids co‑move in metabolic syndrome, so multiplying their LRs as if independent overstates combined risk (~63% relative for a fully‑elevated couple). The fix damps only the *compounding*:

```js
const max = Math.max(...lrs);
if (max <= 1.0) return 1.0;
const product = lrs.reduce((acc, v) => acc * v, 1);
return max * Math.pow(product / max, exponent);   // exponent = 0.7
```

The **dominant single LR passes through unshrunk** — a lone elevated marker's own LR is exactly unchanged (with the rest at 1.0, `product/max = 1`, `1^0.7 = 1`). Worked max: all three `High` → `1.5 · (1.5·1.5·1.5/1.5)^0.7 = 1.5·2.25^0.7 ≈ 2.63` (vs naive `3.375`). This is `WS1A01` — **partially** mitigated; the dedicated validation pass is still owed.

### `getEffectiveLifestyleLR(ownLifestyle)` (`:135‑146`)

Multiplies `LIFESTYLE_LRS[factor][ownLifestyle[factor]] || 1.0` across all five factors (`diet, smoking, alcohol, sleep, stress`). **Own habits only** — the old cross‑partner "sharedness" term was removed (`WS1A07`, comment `:79‑84`). Note the `|| 1.0`: any key miss silently scores neutral — this is exactly the trap that hides the sleep bug (§9).

---

## 4. `calculateIDRS` + `idrsToLR` (verbatim)

The **Indian Diabetes Risk Score** is the age/anthropometry/activity/family channel. `calculateIDRS(age, waistCat, activity, familyHistory, sex)` at `:87‑124`.

| Axis | Condition | Points | Anchor |
|---|---|---|---|
| Age | `≥ 50` | +30 | `:91` |
| | `≥ 35` (and <50) | +20 | `:92` |
| | `< 35` | +0 | — |
| Waist | `High` | +20 | `:95` |
| | `Borderline` | +10 | `:96` |
| Activity | `Sedentary` | +30 | `:109` |
| | `Moderate` | +20 | `:110` |
| | `Active` | +10 | `:111` |
| | `Athletic` | +0 | `:112` |
| Family history | `parentDiabetes === 'Both'` | +20 | `:120` |
| | `=== 'One'` or `=== true` | +10 | `:121` |
| | `'None'` | +0 | — |

Max achievable **100**. Provenance: the axes mirror the validated **MDRF‑IDRS** instrument (comments `:98`, `:114` cite it), and activity is now a correct 4‑tier scale (`WS1A05/WS3B02`, fixed) and family history a 3‑level ordinal (`WS1A04/WS3B01`, fixed). But the **repurposing** — a cross‑sectional screening score used as a longitudinal risk input — is `[interim]` and off‑label (WS3B04).

Two gotchas baked into this function:
- **The `sex` parameter is dead** — never read. Waist sex‑adjustment happens earlier, in `detectWaistCategory`, not here.
- **Activity lives inside IDRS, not the lifestyle LR loop.** `getEffectiveLifestyleLR` iterates `LIFESTYLE_LRS` keys, which are `diet/smoking/alcohol/sleep/stress` — **no `activity`**. Do not "add" activity to the lifestyle product; it is already scored here.

### `idrsToLR(idrs)` (`:129‑133`)

| Band | LR | Anchor |
|---|---|---|
| `idrs ≥ 60` | `1.82` | `:130` |
| `idrs ≥ 30` | `1.1` | `:131` |
| `else` (`<30`) | `0.46` (protective) | `:132` |

All three values are **`[interim]`, no documented provenance** (WS3B04). Because it is a 3‑bucket step function, it produces **score cliffs**: IDRS 29 vs 30 is a ~6‑point discontinuity in the couple index for a single IDRS point, and the `0.46` "low" LR strongly inflates anyone under 30 (`WS1A06`, **still open**).

---

## 5. The four category detectors (verbatim)

`extractPatientData` (`:217`) pulls raw values via `findExtractedParam` (which walks every section of the parsed `extracted_json` for a canonical key, `:149‑158`), runs the four detectors, then lets a valid `manual_data` enum override the detected category (`:250‑261`).

### Canonical parameter names looked up (`:222‑247`)

`waist`, `systolic_blood_pressure`, `diastolic_blood_pressure`, `hba1c`, `fasting_blood_glucose_fbg`, `total_cholesterol`, `low_density_lipoprotein_cholesterol_ldl_c` (fallback `ldl_cholesterol`), `triglycerides`, `high_density_lipoprotein_cholesterol_hdl_c` (fallback `hdl_cholesterol`), `bmi`, `homa_ir`, `hs_crp`.

> **Captured‑but‑unused:** `hdl`, `bmi`, `homa`, `crp` are parsed into `rawValues` (`:244‑247`) but **never consumed by any score**, and `detectLipidsCategory` ignores low HDL entirely (`WS1A11`, **still open**).

### `detectWaistCategory(waistVal, gender)` (`:161‑168`) — Asian‑Indian cut‑offs

| Gender | Borderline (θ0) | High (θ1) |
|---|---|---|
| male | `≥ 90` | `≥ 100` |
| female | `≥ 80` | `≥ 90` |

Cited as Asian‑Indian abdominal‑obesity cut‑offs (standard for this population). `[interim]` as an engine input.

### `detectBPCategory(sbp, dbp)` (`:170‑175`) — Indian/ESC, **not** ACC/AHA

| Category | Rule |
|---|---|
| High | `sbp ≥ 140 \|\| dbp ≥ 90` |
| Elevated | `sbp ≥ 130 \|\| dbp ≥ 85` |
| Normal | else |

Uses the **140/90** hypertension threshold (Indian/ESC), **not** the 2017 ACC/AHA 130/80. A deliberate choice, but note it if you compare against a US‑guideline UI elsewhere. `[interim]` as engine input.

### `detectGlucoseCategory(hba1c, fbg)` (`:182‑199`) — ADA, worst‑wins

Both measures checked when present; the **worst category wins** (`:196‑198`). This fixed the very common Indian‑panel case of FBS‑only reports being scored `Normal` (`WS1A03/WS3B06`, fixed).

| Measure | High | Borderline | Anchor |
|---|---|---|---|
| HbA1c (%) | `≥ 6.5` | `≥ 5.7` | `:185‑186` |
| FBG (mg/dL) | `≥ 126` | `≥ 100` (100–125) | `:191‑192` |

Cited ADA thresholds. **Caveat (WS3B06, open):** a single abnormal HbA1c/FPG is treated as "already diagnosed" (drives the gate, §6) with **no confirmatory‑test requirement** — ADA requires a second test.

### `detectLipidsCategory(tc, ldl, tg)` (`:207‑215`) — NCEP ATP III, edition‑lagged

| Category | Rule |
|---|---|
| High | `TC ≥ 240 \|\| LDL ≥ 160 \|\| TG ≥ 200` |
| Borderline | `TC 200–239 \|\| LDL 130–159 \|\| TG 150–199` |
| Normal | else |

Verbatim **NCEP ATP III (2001/2004)** fixed strata. The comment (`:201‑206`) acknowledges this is edition‑lagged — current guidance (2018 ACC/AHA, 2019 ESC/EAS) uses risk‑stratified LDL goals, not these bands (`WS3B08`, **acknowledged, not changed**). `[interim]` as engine input.

**Detector robustness gap (`WS1A10`, still open):** all detectors use truthiness guards (`!val || isNaN`), so a legitimate `0` or a negative resolves to `Normal`; there is **no upper plausibility clamp** and **no unit tagging** (HbA1c assumed %, glucose assumed mg/dL). A mis‑OCR'd or mis‑unit'd value silently yields a wrong category.

---

## 6. The diabetic gate

A partner whose glucose is `High` isn't at elevated *risk* of diabetes — they already have it. The engine handles this with a **cap, not an LR**:

- `BIOMARKER_LRS.glucose.High = 1.0` — **deliberately neutral** (`:10`, comment). Glucose does **not** raise the biomarker channel.
- `DIABETIC_SCORE_CAP = 25` (`:370`). `partnerXDiabetic = (glucose === 'High')` (`:371‑372`).
- `gX = diabetic ? Math.min(100·(1−pX), 25) : 100·(1−pX)` (`:376‑377`).
- `gateOpen = partnerADiabetic || partnerBDiabetic` (`:373`) → forces `state = 'Specialist conversation'` (`:435`).
- `uiRiskX = min(60, 100 − gX)` (`:463‑464`) — **derived from the capped `gX`**, so the cap propagates to the radar. This is `WS1A02`, fixed: previously `uiRisk` came straight from `pA·100` (which excludes glucose), so a lean diagnosed diabetic could show a reassuring ~5% radar risk next to a capped protective score of ≤25 — "risk 5% / protective 25" is a contradiction, not a state.

> **Do not "fix" the glucose `1.0` LR.** It is intentionally neutral because the gate does the work. Raising it would double‑count the diagnosis.

---

## 7. Couple index, state pill, children predisposition

**Couple index (OWA)** (`:378‑379`): `w = 0.6`; `coupleIndex = 0.6·min(gA,gB) + 0.4·max(gA,gB)`. Ordered weighted average biased toward the weaker partner. `w = 0.6` is `[interim]`.

**State pill** (`:434‑439`) from `gateOpen` and `currentLifestyleCurve[0]`:

| State | Condition |
|---|---|
| `Specialist conversation` | `gateOpen \|\| curve[0] < 50` |
| `Plan together` | `curve[0] < 75` |
| `Aligned` | else |

Thresholds `50` / `75` are `[interim]`.

**Children predisposition** (`:445‑451`): `isLoadedX = parentDiabetes !== 'None' || glucose === 'High'`; `loadedCount` of 0/1/2 → `Low`/`Moderate`/`High`. Note the explicit `!== 'None'` check — a bare truthy test would treat the string `'None'` as loaded (any non‑empty string is truthy in JS).

---

## 8. The 10‑year projection semantics

Loop `y = 0..10` (11 entries, `:396‑428`). At each year:

- **Only IDRS ages.** `calculateIDRS(age + y, waist, activity, history, sex)` is re‑derived, then `idrsToLR` (`:399‑404`). `lifestyleLR` and `bioLR` are **frozen at year 0** — biomarkers and lifestyle never drift over the projection. The only movement is IDRS **age‑band crossings**, so a curve is piecewise‑flat with steps where a partner crosses 35 or 50.
- **Current curve:** `oddsY = ODDS_0 · idrsLrY · lifestyleLR · bioLR` (`:406`).
- **Optimized curve:** the **lifestyle LR is dropped** (forced to 1.0) — `optOddsY = ODDS_0 · idrsLrY · bioLR` (`:419`). It models "same person, ideal lifestyle."
- **Diabetic cap re‑applied each year** on both curves (`:411‑412`, `:424‑425`) — a diagnosed partner stays diagnosed in the idealized branch too.
- `lifestyleDividend = optimizedCurve[10] − currentCurve[10]` (`:431`) — the year‑10 headroom from lifestyle alone.

At `y=0` the projection reduces exactly to `idrsA`/`idrsLrA`, so the curve's start point matches the headline score. This is `WS1A09`, fixed — the old version compounded a cosmetic `1.05^y` drift that disagreed with the IDRS‑vs‑age graph.

---

## 9. Chronic frontend↔backend key‑matching contract

The scoring hinges on a **case‑sensitive string match** between the frontend option `val`s (`frontend/src/constants/lifestyleOptions.js`) and the backend `LIFESTYLE_LRS` keys (`chronic.controller.js:49‑77`). A miss silently falls to `|| 1.0` — no error, just a wrong (neutral) score.

### `LIFESTYLE_LRS` (verbatim, `:49‑77`)

| Factor | Keys → LR |
|---|---|
| `diet` | `Poor:1.3, Mixed:1.15, Healthy:1.0` |
| `smoking` | `Regularly:1.5, Occasionally:1.25, Quit:1.0, Never:1.0` |
| `alcohol` | `Frequently:1.2, Occasionally:1.1, Quit:1.0, Never:1.0` |
| `sleep` | `'Night owl':1.2, Irregular:1.1, 'Early bird':1.0` |
| `stress` | `High:1.2, Moderate:1.1, Normal:1.0` |

All values `[interim]`. `Quit` is intentionally `1.0` (not a penalized tier) for both smoking and alcohol — past‑exposure organ damage is captured by the pathology panels, not re‑inferred here (comments `:56‑73`).

### Match status per factor

| Factor | Frontend `val`s (constant) | Backend keys | Match? |
|---|---|---|---|
| smoking | `Never/Quit/Occasionally/Regularly` (`LIFESTYLE_SMOKING_TOBACCO`, `lifestyleOptions.js:80`) | `Regularly/Occasionally/Quit/Never` | ✅ **fixed** — guarded by test |
| alcohol | `Never/Quit/Occasionally/Frequently` (`LIFESTYLE_DRINKING`, `:64`) | `Frequently/Occasionally/Quit/Never` | ✅ **fixed** — guarded by test |
| **sleep** | `'Early Bird'/'night owl'/'irregular'/'insomniac'` (`LIFESTYLE_SLEEP`, `:87‑92`) | `'Night owl'/'Irregular'/'Early bird'` | ❌ **STILL DRIFTED** |

**The alcohol/smoking bug is fixed** (they previously read `socially`/`regularly`/`heavily` and lowercase `never`/`occasion`/`regular`/`chain`, matching nothing) and is now guarded by `backend/__tests__/lifestyle-lr-mapping.test.js` — the **only** regression net on this engine, and it covers **alcohol + smoking only**.

**The sleep drift is STILL OPEN.** Every `LIFESTYLE_SLEEP` val differs from every `LIFESTYLE_LRS.sleep` key by case or wording (`'Early Bird'` vs `'Early bird'`, `'night owl'` vs `'Night owl'`, `'irregular'` vs `'Irregular'`, and `'insomniac'` has no key at all). So **sleep scores `1.0` for every user regardless of their answer.** It is acknowledged in an in‑file comment (`chronic.controller.js:41‑48`) but **not fixed** — and **not** covered by the one unit test.

### Two frontend entry points diverge on `parentDiabetes`

| Path | `parentDiabetes` sent | Reaches +20 "Both" tier? |
|---|---|---|
| `CompatibilityContext.js` (the real couple flow) | `'None'`/`'One'`/`'Both'` string (`:635‑664`) | ✅ yes |
| `app/chronic/page.js` (legacy standalone) | **boolean** (`false` at `:158,:170`, `true` at `:234`), and its driver check is bare‑truthy `if (data.parentDiabetes)` (`:140`) | ❌ no — backend only maps `true`→+10 |

So via the **legacy page** the +20 "Both parents" IDRS tier is **unreachable** (`WS1A04/WS3B01` fixed in the backend + add‑prospect flow, but this page was never migrated). That legacy page also leaks QA scaffolding into the paid report: an "Uncalibrated · relative ordering" chip (`app/chronic/page.js:979`) and a "Calibration scaffold" panel with a literal "Log assessment (Demo)" button (`:1053‑1064`) — `UX9‑04`, still open. The product‑owner decision (doc 17) is to **delete the legacy standalone engine pages** (`/chronic`, `/mfr`, `/usg`); a separate code change, not yet done.

---

## 10. FERTILITY (MFR) — request / response contract and the two client surfaces

`POST /analyze` on the MFR router, mounted under `/api/mfr`. Chain is `authenticateToken → analyzeMfr` (`backend/src/routes/mfr.routes.js:7`). **Note the asymmetry with chronic: there is NO `checkMatchQuota` on MFR** — the free‑run cap is enforced on the chronic call only.

### Request body (`mfr.controller.js:257‑265`)

| Field | Type | Notes |
|---|---|---|
| `male_report_id` / `female_report_id` | id | **Optional** here (unlike chronic). If present, `extracted_json` is loaded; if the row is missing, it's silently skipped (`:270‑279`) — no 404. |
| `male_manual_data` / `female_manual_data` | object | Default `{}`. Carries age, manual `semenQuality`/`ovarianReserve`, and all Tier‑2/3 radiology/genomic fields. |
| `shared_lifestyle` | object | Default `{}`. Coarse penalty numbers + `freq`. |
| `barriers` | object | Default `{}`. `b_tubal`, `b_azoo`, `b_uterus` booleans. |
| `evaluationTier` | int | `parseInt(...) || 1` (`:378`). Gates Tier‑2 (`≥2`) and Tier‑3 (`===3`) modifier blocks. |
| `match_id` | id | Keys the 30‑day LLM cache. |

### Age guard (clinical‑safety‑relevant)

`plausibleAge(raw)` accepts a finite number in **[18, 60]**, else `null` (`:297`). If **both** ages are null → **HTTP 422 `insufficient_data`** (`:300‑306`). This is `WS1B05`, fixed. **But the guard is partial (`WS1B02`, residual):** it fires only when *both* ages are unusable — a request with **one** valid age still computes, defaulting the missing partner to `30` (`:309`, `:324`). The comment claims "both ages required"; the code requires only one.

### Response shape (`res.json` at `:695‑724`)

| Field | Meaning |
|---|---|
| `state` | `'Aligned'`/`'Plan together'`/`'Specialist conversation'` (`:617`). |
| `monthly_chance_current` / `_optimised` | `p_monthly·100` (`:698`). |
| `p_12m_current` / `_optimised` | Cumulative 12‑month, `·100` (`:700`). |
| `time_to_conceive` | ART‑blocked string, `~N mo`, or specialist string (`:606`). |
| `positive_findings`, `summary` | LLM or fallback (§17). |
| `validation_issue` | Set if progressive motility > total motility (`:349`). |
| `rad_warnings`, `genomic_warnings` | Tier‑2/3 warning arrays. |
| `projection` | `{ current[], optimised[], years[0..10] }` (`:708`). |
| `calculations` | Full trace (base scores, adjustments, final scores, `bio_mfr`, lambdas, freq, monthly/12m). |
| `details` | `female_age`, `female_ovarian_reserve`, `male_age`, `male_semen_quality`, `lifestyle_score`, `gate`, `detected_reserve_from_pathology`, `detected_semen_from_pathology` (`:714`). |

### The two client surfaces (this matters enormously)

Two frontends hit the **same endpoint** with **very different payloads**:

| Surface | Sends | Effect |
|---|---|---|
| **Couple flow** — `CompatibilityContext.js` → `/core-engine/mfr` (`:707‑748`) | only `{name, age}` per partner; coarse binary lifestyle; `freq: 0.92` hardcoded (`:738`); `barriers` all false; **no `evaluationTier`**; **omits** `semenQuality`/`ovarianReserve` (`:713‑715`) | Tier‑2/3 modifiers, `physicalBlock`/`geneticBlock`, and manual overrides **never fire**. Only age + report‑derived AMH/AFC/semen + the server‑side azoospermia/severe‑reserve gates are effective. |
| **Standalone tool** — `app/mfr/page.js` | full `evaluationTier` 1/2/3, USG/radiology fields, genomics, manual `semenQuality`/`ovarianReserve`, barriers | The **only** surface that exercises Tier‑2/3 controller code. |

**Consequence:** in the shipping product, the entire Tier‑2 radiology and Tier‑3 genomic modifier layer (§16) is **dead code**. It is reachable only from the standalone `/mfr` tool — one of the pages the product owner has decided to delete (doc 17). The couple flow **deliberately omits** `semenQuality`/`ovarianReserve` so the backend's report‑derived classification wins — **do not "helpfully" re‑add them** or you clobber real per‑couple data with a literal.

---

## 11. Fertility data‑resolution precedence

Verbatim, for both markers (`:321`, `:345`):

```
ovarianReserve = female_manual_data.ovarianReserve || calculatedReserve || 'Not Assessed'
semenQuality   = male_manual_data.semenQuality     || calculatedSemen?.category || 'Not Assessed'
```

**Manual always beats report‑derived.** `'Not Assessed'` (the absent case) carries the same neutral 0‑point modifier as `'Normal'` (neither has a modifier entry), but it can **no longer** trip the fallback's positive findings ("✓ Ovarian reserve appropriate for age" / "✓ Semen parameters meet WHO reference values") — those fire only on literal `'Normal'`/`'High for age'` (`WS1B06`, fixed; `:316‑320`, `:342‑344`).

Report markers are read via `findExtractedParam` (`:243‑252`, same walk‑every‑section logic as chronic) using canonical names that **must match `ontologyMapper.service.js` exactly** — `amh`, `afc` (both recently **added** to the ontology to fix dead reads, `WS0‑11/WS4`), and eight semen params (§13). `parseFloat(findExtractedParam(...)?.value)` yields **`NaN`, not `undefined`**, when a param is absent — which is why the `isRealNumber`/`isNaN` guards throughout exist (a bare `NaN < 16` is always false and would fabricate `Normal`).

---

## 12. Ovarian‑reserve classifier (verbatim)

`classifyOvarianReserve(amh, afc, age)` at `:59‑151`. Also **re‑exported** and reused by `reportSummary.service.js` (§17).

**Plausibility guards** (`:70‑82`, `:113`):
- `AMH_MAX_PLAUSIBLE = 20` ng/mL; `classifyByAmh` rejects `val <= 0 || val > 20` → `null`.
- `AFC_MAX_PLAUSIBLE = 50`; `classifyByAfc` rejects `val < 0 || val > 50` → `null`.
- These reject the classic OCR glitch (misread minus sign, misplaced decimal) that otherwise hard‑gated a couple to "blocked" from one bad number (`WS1B04`, fixed).

**Absolute DOR floor** (`:79`, `:106‑108`): `ABSOLUTE_DOR_THRESHOLD = 1.0` ng/mL. If `val < 1.0` and the age‑relative band came out `Normal` or `High for age`, it is **downgraded to `Low`**. Cites ASRM/ACOG DOR <1.0 (`WS3A02`, **partial** — the floor was added, but the bands themselves remain uncited, residual).

### AMH bands (ng/mL, verbatim `:84‑104`)

| Age band | Very Low | Low | Normal | High for age |
|---|---|---|---|---|
| `< 30` | `< 1.0` | `≤ 1.5` | `≤ 4.0` | else |
| `< 35` | `< 0.8` | `≤ 1.2` | `≤ 3.5` | else |
| `< 40` | `< 0.5` | `≤ 0.9` | `≤ 2.5` | else |
| `≥ 40` | `< 0.3` | `≤ 0.6` | `≤ 1.5` | else |

### AFC bands (verbatim `:120‑140`)

| Age band | Very Low | Low | Normal | High for age |
|---|---|---|---|---|
| `< 30` | `< 6` | `≤ 9` | `≤ 20` | else |
| `< 35` | `< 6` | `≤ 9` | `≤ 18` | else |
| `< 40` | `< 4` | `≤ 7` | `≤ 14` | else |
| `≥ 40` | `< 3` | `≤ 5` | `≤ 10` | else |

**Combination:** `rank = {Very Low:0, Low:1, Normal:2, High for age:3}` (`:146`). When both AMH and AFC classify, return the **worse (lower‑ranked)** (`:147‑149`); else whichever is non‑null; else `null`. All band boundaries are `[interim]` — **uncited in repo and UI** (`WS3A02`/`WS3A03` residual; the under‑30 AFC Normal floor was widened to 10, `WS3A03` fixed).

---

## 13. Semen classifier (verbatim)

`classifySemen(volume, concentration, totalCount, totalMotility, progressive, vitality, morphology, ph)` at `:165‑240`. Guard: if none of volume/conc/count/totalMotility is a real number → `null` (`:166`). `isRealNumber = typeof x === 'number' && !isNaN(x)` (`:163`).

**Azoospermia short‑circuit** (`:173`, `:182`): `concentration === 0` **or** `totalCount === 0` → immediate `{category:'Severe Deficit', details:'Azoospermia'}`. This `'Azoospermia'` detail is later an absolute‑barrier gate trigger (§14).

**`belowCount` ladder** — WHO 2021 (6th ed.) lower reference limits, one increment each (`:172‑223`):

| Parameter | Below‑threshold rule | Anchor |
|---|---|---|
| Concentration | `< 16` (M/mL) | `:174` |
| Total sperm count | `< 39` (M/ejac) | `:183` |
| Volume | `< 1.4` (mL) | `:190` |
| Total motility | `< 42` (%) | `:196` |
| Progressive motility | `< 30` (%) | `:202` |
| Vitality | `< 54` (%) | `:208` |
| Morphology (normal forms) | `< 4` (%) | `:214` |
| pH | `< 7.2` | `:220` |

The 8 thresholds are **WHO 2021‑correct** (`WS3A01`, confirmed exact).

**Category** (`:225‑232`):

| Category | Rule |
|---|---|
| Severe Deficit | `belowCount ≥ 3` **or** `concentration < 5` |
| Moderate Deficit | `belowCount === 2` |
| Mild Deficit | `belowCount === 1` |
| Normal | else |

> **Two open caveats.** (1) The **Severe/Moderate/Mild "Deficit" ladder + the `concentration < 5` rule are uncited house nomenclature** — WHO's 6th ed. deliberately dropped pass/fail grades (`WS3A01` residual, `[interim]`). (2) **Near‑zero azoospermia miss (`WS3A01` residual):** the hard azoospermia gate fires **only** on `=== 0`. A near‑zero extraction like `0.01` or a parsed `'<0.1'` becomes `Severe Deficit` via the `<5` branch but is **NOT** flagged as an absolute barrier — so it still yields a small non‑zero probability. If you tighten this, do it at the classifier, not the gate.

---

## 14. The absolute‑barrier gate (clinical‑safety‑critical)

All conditions OR‑ed (`:559‑563`):

```js
const serverDetectedAzoospermia = calculatedSemen?.details === 'Azoospermia';
const severeOvarianReserve = calculatedReserve === 'Very Low' || ovarianReserve === 'Very Low';
const gate = barriers.b_tubal || barriers.b_azoo || barriers.b_uterus ||
             male_manual_data.scrotalFinding === 'Obstruction / CBAVD' ||
             physicalBlock || geneticBlock || serverDetectedAzoospermia || severeOvarianReserve;
```

| Trigger | Source |
|---|---|
| `barriers.b_tubal` / `b_azoo` / `b_uterus` | client barrier flags |
| `scrotalFinding === 'Obstruction / CBAVD'` | male manual |
| `physicalBlock` | Tier‑2: bilateral tubal block or scrotal obstruction (§16) |
| `geneticBlock` | Tier‑3: AZFa/AZFb Y‑deletion or abnormal male karyotype (§16) |
| `serverDetectedAzoospermia` | **server‑computed** from the report — fires even if the client never sent `b_azoo` (`WS1B01/WS0‑06` hardening) |
| `severeOvarianReserve` | `'Very Low'` reserve, promoted from a flat −20 to a hard gate |

**The invariant:** `gate` is a **terminal `gate ? 0 : ...` multiply applied to every probability output** — monthly (`:587‑588`), each of the 11 projection years (`:597‑598`), and the 12‑month cumulative (`:602‑603`). **Positive modifiers feed only the upstream `bio` term and can never add probability back** once the gate is open. This is the single most important safety property of the engine — `WS1B01/WS0‑06` confirmed un‑leakable. **If you touch the probability math, add a regression test that asserts every output is 0 when `gate` is true.**

---

## 15. Fertility probability & projection math (verbatim)

### Age→score tables (`:35‑36`) — labelled "illustrative curves"

```
FEM = {18:97, 24:97, 25:94, 26:92, 27:90, 28:88, 29:87, 30:86, 31:83, 32:80,
       33:76, 34:72, 35:52, 36:38, 37:28, 38:21, 39:19, 40:17, 41:14, 42:11,
       43:9, 44:7, 45:5, 50:4}
MAL = {18:97, 25:97, 30:95, 32:91, 34:89, 35:87, 37:83, 40:80, 42:76, 45:71,
       48:66, 50:62, 55:55}
```

`interp(table, age)` linearly interpolates between adjacent keys and **clamps** to the nearest endpoint outside range (`:11‑22`): `age < 18` → `table[18]`; `age > 50` → `FEM[50] = 4`; `age > 55` → `MAL[55] = 55`.

The FEM table's 35–44 rows were **re‑anchored to published fecundability** (ASRM 2022; ~12%/cycle at 35, ~5% at 38, ~3–5% at 40), fixing a prior ~2× overstatement (`WS3A04`, fixed). The old `fa >= 45` hard‑zero cliff was **removed** — rows 45:5 and 50:4 are now reachable and taper continuously. **But (`WS3A04` residual):** the tables are still self‑labelled "illustrative" while driving concrete user‑facing percentages, the **MAL curve was NOT re‑anchored and is uncited**, and no citation surfaces to the user. All values `[interim]`.

### Scores and blend (`:38‑56`)

- `fScore = Math.max(2, Math.min(100, interp(FEM, age) + reserveAdj))` — **floor is 2, never 0** (`:38`). Same for `mScore` (`:39`). A partner is never worth 0; near‑sterility is expressed via the −95 Severe modifier + the severe‑factor blend, **not** a 0 score. Only the boolean `gate` produces an actual 0 probability.
- `mfrAt(fa, ma, reserveAdj, semenAdj, isSevere)` (`:41‑56`):
  - `minWeight = isSevere ? 0.9 : 0.6` — when either partner is severe, the weaker partner **dominates** (0.9/0.1) so a healthy partner can't mask them (`WS1B03`, fixed).
  - `combined = minWeight·min(f,m) + (1−minWeight)·max(f,m)`.
  - `return (combined/100)·0.25` — **`0.25` = the max biological MFR as a monthly probability** (`[interim]`).

### Lifestyle, frequency, gate application (`:566‑588`)

- Penalties `smoke/bmi/act/alc/stress` (each default 0); `L = max(0, 100 − Σpenalties)` (`:573‑574`).
- `lambda_current = 0.55 + 0.45·(L/100)`; `lambda_optimised = 1.00` (`:576‑577`). Both `[interim]`.
- `freqVal = shared_lifestyle.freq ?? 0.92` (`:571`) — coitus‑frequency factor, default "twice/wk." **The couple flow hardcodes this to the same 0.92 (`CompatibilityContext.js:738`), so frequency is never a real user input anywhere** — treat "optimised" curves and frequency effects as model illustration, not personalization.
- `isSevereFactor = ovarianReserve === 'Very Low' || semenQuality === 'Severe Deficit'` (`:583`).
- `bioNow = mfrAt(fAge, mAge, fReserveAdj, mSemenAdj, isSevereFactor)` (`:586`).
- `p_monthly_current = gate ? 0 : bioNow·lambda_current·freqVal` (`:587`); optimised uses `lambda = 1.0` (`:588`).

### 12‑month compound and projection (`:591‑603`)

- `p_12m = gate ? 0 : 1 − (1 − p_monthly)^12` (`:602‑603`).
- **11‑point projection**, `y = 0..10` (`:595‑599`): both partners age `+y` together; `bioY = mfrAt(fAge+y, mAge+y, …)`; each year `gate ? 0 : bioY·lambda·freq·100`.

### Derived (`:606‑626`)

- `time_to_conceive`: gate → the ART‑blocked string (`:608`); else if `p_monthly > 0` → `~round(1/p_monthly) mo` (`:610`); else the specialist string (`:613`). The pluralization ternary `medianMonths === 1 ? 'mo' : 'mo'` is a **no‑op** — both branches identical (`:611`, cosmetic bug).
- **State pill** (`:617‑626`): `gate` → `'Specialist conversation'`; else `monthly·100 ≥ 18` → `'Aligned'`; `≥ 12` → `'Plan together'`; else `'Specialist conversation'`. Cutoffs `18`/`12` are `[interim]`.

---

## 16. Tier‑2 radiology + Tier‑3 genomic modifier tables

**Reminder: dead in the shipping couple flow** (§10) — reachable only from the standalone `/mfr` tool. `evaluationTier >= 2` runs Tier‑2 (`:384‑500`); `=== 3` also runs Tier‑3 (`:506‑546`). All point values `[interim]`.

### Tier‑2 female USG → `fReserveAdj`

| Field | Value → adj |
|---|---|
| `uterineLining` | Thin −8 / Thick −3 |
| `fibroids` | Submucosal −15 / Intramural −6 |
| `tubalPatency` | One blocked −12 / **Both blocked → `physicalBlock`** |
| `pcosMorphology` | Bilateral −15 / Unilateral −8 |
| `ovarianVolume` | Enlarged −5 |
| `pelvicFluid` | Yes −5 |
| `fattyLiverGrade` | Grade I −2 / II −5 / III −10 |

### Tier‑2 male scrotal/abdominal → `mSemenAdj`

| Field | Value → adj |
|---|---|
| `varicoceleGrade` | Grade 1 −3 / Grade 2 −7 / Grade 3 −12 |
| `testicularVolume` | Low −5 |
| `scrotalObstruction` | **Yes → `physicalBlock`** |
| `prostateGrade` | Grade I −3 / II −6 / III −12 |
| `pvrVolume` | Borderline −2 / Significant −5 |
| `fattyLiverGrade` | Grade I −2 / II −5 / III −10 |

### Tier‑3 genomics

| Field | Value → effect |
|---|---|
| `yDeletion` | AZFa/AZFb → **`geneticBlock`**; AZFc → `mSemenAdj −25` |
| `maleKaryotype` | ≠ `Normal 46,XY` → **`geneticBlock`** |
| `mthfr` | Homozygous `fReserveAdj −8` / Heterozygous −3 |
| `femaleKaryotype` | ≠ `Normal 46,XX` → `fReserveAdj −20` |
| `cftrCarrier` + male CBAVD | warning only (no block) |

`physicalBlock` and `geneticBlock` both flow into the absolute‑barrier gate (§14).

---

## 17. Shared LLM insight / narrative layer

Both engines call `generateStructuredInsight(messages, fallbackObj, options)` from `services/llm.service.js` — OpenRouter, `DEFAULT_MODEL = "openai/gpt-4o-mini"` (`llm.service.js:8`), `temperature 0.3, max_tokens 400`. Full detail is in **doc 11**; the engine‑specific facts you need here:

| Aspect | Chronic | MFR |
|---|---|---|
| Cache key | `chronic_insights_${match_id}` (`:512`) | `mfr_insights_${match_id}` (`:664`) |
| Cache TTL | 30 days (`llm.service.js:72`, `:137`, `2592000`s) | same |
| Output fields | `dynamic_insights` | `positive_findings`, `summary` |
| Fallback tag | `_llm_fallback: true` (`llm.service.js:121`) — chronic does **not** read it | MFR does **not** read it either |
| System persona | "expert cardiometabolic clinician" (`:486`) | **"specialized reproductive endocrinologist AI"** (`:636`) — REG overclaim, §18 |

Two consequences: **insight text is frozen per `match_id` for 30 days** — editing the prompt or scoring won't change an already‑cached couple's narrative until TTL expiry or a cache flush; and with **no `OPENROUTER_API_KEY` (currently dead, 401 — doc 03), every call returns the deterministic fallback.** The MFR fallback's positive findings fire only on literal `'Normal'`/`'High for age'`, never `'Not Assessed'` (`:653‑658`).

---

## 18. Validation & provenance status per engine

### Chronic — constant provenance

| Constant | Provenance | Status |
|---|---|---|
| `BASELINE_RISK_PROB 0.10`, `ODDS_0` | none | `[interim]` |
| `idrsToLR` 1.82/1.1/0.46 | none (WS3B04) | `[interim]`, step‑function cliffs open (WS1A06) |
| `BIOMARKER_LRS`, `LIFESTYLE_LRS` | none | `[interim]` |
| shrinkage exponent 0.7 | none (WS3B04/WS1A01) | `[interim]`, partial mitigation |
| `DIABETIC_SCORE_CAP 25`, couple `w 0.6`, state 50/75 | none | `[interim]` |
| IDRS axes | MDRF‑IDRS (cited) | axes fixed; repurposing off‑label |
| detectors: waist / BP / glucose / lipids | Asian‑Indian / Indian‑ESC / ADA / NCEP ATP III | cited but edition‑lagged (lipids, WS3B08) / no confirmatory test (glucose, WS3B06) |

**Chronic fixed‑in‑code** (comment‑cited): WS1A02 (uiRisk from capped gX), WS1A03/WS3B06 (FBG worst‑wins), WS1A04/WS3B01 (family history 3‑tier, backend + add‑prospect), WS1A05/WS3B02 (4‑tier activity), WS1A07 (sharedness removed), WS1A08 (activity defaults to zero‑penalty Athletic), WS1A09 (projection re‑derives IDRS per year), alcohol/smoking val↔key drift + guard test. **Chronic still‑open:** WS1A06 (LR cliffs), WS1A10 (detector 0/negative/unit robustness), WS1A11 (unused HDL/HOMA‑IR/CRP), WS1A12 (private untested math, dead `sex` param), WS3B04/05 (uncited constants), WS3B08 (lipid edition‑lag), **sleep LR key drift**, legacy‑page boolean `parentDiabetes`, UX9‑04 (Demo scaffold in paid UI).

> DEXA/BMI validation items in WS3B (WS3B09 Western BMI cut‑offs, WS3B10/11/12 DEXA T/Z‑score) live in `services/scoring/{abdomen,dexa}.score.js` + `radiology/schemas/dexa.schema.js` — a **sibling radiology subsystem (doc 06), not this controller** — and are open there.

### MFR — constant provenance

| Constant | Provenance | Status |
|---|---|---|
| WHO‑2021 semen thresholds (8) | WHO 2021 6th ed. (cited) | ✅ exact (WS3A01) |
| Severe/Moderate/Mild "Deficit" ladder + `conc<5` | house nomenclature | `[interim]`, uncited (WS3A01 residual) |
| AMH/AFC age bands | none in repo/UI (WS3A02/03) | `[interim]`, uncited |
| `ABSOLUTE_DOR_THRESHOLD 1.0` | ASRM/ACOG (cited) | ✅ floor added |
| FEM/MAL age→score tables | FEM 35‑44 re‑anchored (ASRM 2022, cited); MAL uncited | `[interim]`, "illustrative" but user‑facing |
| blend 0.9/0.6, `·0.25`, lambda 0.55+0.45, freq 0.92, modifiers (incl. Severe −95), state 18/12 | none | `[interim]` |

**MFR fixed‑in‑code:** WS1B04 (AMH/AFC plausibility guards), WS1B05 (plausibleAge 18‑60), WS1B06 ('Not Assessed' not 'Normal'), WS1B07/WS3A04 (45+ cliff removed, FEM re‑anchored), WS3A02 (DOR floor), WS3A03 (AFC young floor), WS1B03 (severe‑factor blend + Severe −95), WS0‑11/WS4 (amh/afc canonicals added), WS1B01/WS0‑06 (gate un‑leakable). **MFR still‑open:** the **regulatory** cluster (REG‑02/04/05 — no disclaimer, SaMD scope, clinician persona), uncited AMH/AFC bands + illustrative curves + un‑re‑anchored MAL, near‑zero azoospermia miss, freq/lifestyle never real inputs, Tier‑2/3 dead in main flow, WS8‑01 (report tabs context‑only — a hard refresh on `/core-engine/mfr` bounces to `/dashboard`, results non‑shareable), the `time_to_conceive` no‑op ternary, and reportSummary reusing `classifyOvarianReserve` AMH‑only (`afc` undefined, `reportSummary.service.js:310`).

**The regulatory/disclaimer gap (REG‑02, MFR):** the only text near the PDF conception bar is a technical footnote ("age‑graded biological baseline statistics") — **not** a medical/not‑a‑diagnosis disclaimer. Combined with the "reproductive endocrinologist AI" persona and hard "ART required" copy, this is the highest‑priority open item for this engine. **Do not "fix" it unilaterally** — it needs a qualified regulatory assessment and an explicit wellness‑vs‑SaMD positioning decision (doc 21).

---

## Open items (see doc 21 for the authoritative list)

- **Every clinical constant in both engines is uncited/`[interim]`** — the IDRS→LR multipliers, all biomarker/lifestyle LRs, the shrinkage exponent, the AMH/AFC bands, the FEM/MAL "illustrative" curves, and the MAL curve that was never re‑anchored. A versioned `clinicalConstants` module (OPP‑W4‑15) plus a validation pass is owed before any of these should be treated as clinical standards.
- **Sleep LR key drift (chronic, still open):** sleep scores 1.0 for every user because `LIFESTYLE_SLEEP` vals don't match `LIFESTYLE_LRS.sleep` keys — acknowledged in‑file, not fixed, not covered by the one unit test.
- **Near‑zero azoospermia miss (MFR, still open):** the absolute‑barrier gate fires only on `concentration/totalCount === 0`; a `0.01`/`'<0.1'` extraction escapes the hard gate.
- **Regulatory posture (REG‑02/04/05/06, open risk):** patient‑specific diagnostic outputs, an "ART required" routing, and a clinician‑persona LLM with **no disclaimer anywhere** — factual gap, awaiting legal/regulatory decision.
- **Near‑zero regression coverage on safety‑critical math:** only alcohol/smoking LR mapping is unit‑tested (`__tests__/lifestyle-lr-mapping.test.js`); IDRS, the detectors, the diabetic gate, and the entire MFR gate/probability chain are untested (WS1A12). Add a gate‑zeroing invariant test to MFR before touching its math.

---

*Next: `08_medical_engine_mental_wellbeing.md` — the third engine, the 27‑item mental wellbeing v2.0 scorer, its item bank, and its recompute path.*
