# Extraction Pipelines: Pathology (deterministic) & Radiology (LLM)

**Doc 06 of 22** · Audience: a solo full‑stack successor · Prerequisite: `02_architecture_and_backend_core.md`, `05_data_model_and_storage.md`.

Goal of this doc: fully explain the **two PDF → structured‑data pipelines** that feed every scoring engine downstream. They are built on **opposite philosophies** — pathology is deterministic and offline‑testable; radiology is LLM‑driven and non‑deterministic. Understand both before you touch docs 07–10, because a renamed `canonical_name` or a mis‑shaped radiology record silently corrupts the whole composite score.

---

## 1. Why two pipelines with opposite philosophies

Both pipelines answer the same question — *"turn one person's uploaded medical PDF into structured JSON the engines can score by key"* — but they answer it in fundamentally different ways, on purpose.

| | **Pathology** (bloodwork) | **Radiology** (scans) |
|---|---|---|
| Core method | Deterministic parser (PyMuPDF/OCR text → regex/fuzzy extraction) | LLM extraction (llama‑3.3‑70b) against per‑modality schemas |
| Determinism | Same OCR text → **byte‑identical** JSON | Same PDF → **slightly different** JSON per run |
| Testable offline | **Yes** — `node backend/tests/parser.test.js`, no network | **No** — needs a paid OpenRouter call; CI can't cover it |
| Failure mode | Missed/mis‑mapped alias (silent, but reproducible) | Hallucinated field / dropped modality (silent, non‑reproducible) |
| Guard against fabrication | Fail‑loud OCR; value‑first guard; never invents a value | `coerceAndValidate` drops invented fields + out‑of‑vocab enums |
| Output contract | `extractedData[section][canonical_name]` in `reports.extracted_json` (TEXT) | `findings_json`/`scores_json`/`risk_flags_json` (JSONB) in `radiology_reports` |

The *why*: real Indian lab reports are wildly inconsistent (varied labels, abbreviations, unit systems, comma grouping, H/L flags, multi‑line wraps, columnar vs inline layouts), but a **CBC value is a CBC value** — a deterministic parser keyed to a fixed ontology is the right, auditable, unit‑testable tool, and it can never fabricate a number. Radiology narratives are free prose describing dozens of organs across 14 modalities; no regex grammar survives that, so an LLM constrained by a schema is the pragmatic choice — at the cost of determinism, which is why every LLM output is passed through a validator before it is trusted.

Keep this contrast in your head: **when pathology breaks, it breaks the same way every time and you can reproduce it locally. When radiology breaks, it may break once and never again.**

---

## 2. PATHOLOGY — request lifecycle

**Entry:** `POST /api/pathology/extract`, auth‑gated for the whole router (`backend/src/routes/pathology.routes.js:8` does `router.use(authenticateToken)`; the route is defined at `pathology.routes.js:11`).

The multipart field name is hardcoded **`pdf`** (`upload.single('pdf')`). A client that sends any other field name gets `req.file === undefined` → `400 "No PDF file uploaded"` (`pathology.controller.js:45‑47`). Multer config (`pathology.controller.js:17‑35`):

| Property | Value | Consequence |
|---|---|---|
| Storage | `diskStorage` → `backend/src/temp/uploads/` | Physical file on disk, cleaned up in `finally` |
| Disk filename | `` `${uuidv4()}-${file.originalname}` `` (`:22`) | **NOT** the report id — see the two‑uuid gotcha below |
| `limits.fileSize` | `25 * 1024 * 1024` (25 MB) (`:27`) | Larger uploads rejected by Multer |
| `fileFilter` | `mimetype === 'application/pdf'` only (`:29`) | **Rejects photographed jpg/png reports (WS2‑09, open)** |

**Two distinct uuids per request** — do not conflate them:
- `reportId = uuidv4()` (`pathology.controller.js:42`) — the DB primary key and the value returned as `report_metadata.report_id`.
- Multer's disk filename `` `${uuidv4()}-${originalname}` `` — a *different* uuid, only ever a temp‑file name. There is no correlation to reconstruct.

**DB row lifecycle** (`reports` table, doc 05):

```
POST /extract
  │
  ├─ INSERT reports {id:reportId, processing_status:'processing', confidence_score:0}   (:53)
  │
  ├─ ocrProvider.process(filePath)  ──►  ocr_pages batch INSERT (one row/page)          (:60,:71)
  │
  ├─ parameterExtractor.extract(ocrPages)  ──►  extractedData                            (:79)
  │
  ├─ UPDATE reports SET processing_status='completed', confidence_score, extracted_json  (:97)
  │        (extracted_json is JSON.stringify'd TEXT, not JSONB — consumers JSON.parse it)
  │
  └─ finally: fs.unlinkSync(temp file)   (best-effort)                                    (:137)

on any throw ──► UPDATE reports SET processing_status='failed'  (:126)  then next(error)
```

**Confidence is a plain unweighted mean over *all* extracted params** (`pathology.controller.js:84‑93`): `sum(param.confidence) / totalParams`, `toFixed(2)`. A page full of low‑confidence junk drags the whole report's number down — it is **not** a per‑parameter reliability signal, and you must not treat it as one.

**Response contract** (`pathology.controller.js:102‑116`):

```json
{
  "success": true,
  "report_metadata": {
    "report_id": "<uuid>",
    "processing_time_ms": 1234,
    "parameters_extracted": 42,
    "confidence_score": 0.91,
    "raw_ocr_text": "<all pages joined by '\\n\\n--- PAGE BREAK ---\\n\\n'>"
  },
  "sections": { /* extractedData: section → canonical_name → {value,unit,...} */ },
  "testCoverage": { "available": [...], "missing": [...] }
}
```

> `raw_ocr_text` echoes the **entire report's OCR text** back in the response (`:109`). That is sensitive health data; the same verbatim text is persisted in `ocr_pages`. Flag it for any DPDP/retention work (§14).

There is also `GET /api/pathology/mock-extract` (`mockExtract`, `pathology.controller.js:153`) — inserts a canned two‑param report flagged `is_mock=TRUE` for exercising the response contract without a real PDF or OCR key. **Gotcha:** it keys its sample under the *short* section `cbc` (`:159`), unlike real extraction which uses the long `sectionDetector` ids — harmless only because `testCoverage` scans every section (§5).

---

## 3. Two‑tier OCR strategy (fail‑loud)

Everything text‑related routes through a single singleton: `backend/src/services/ocr/ocrProvider.js`. The controller calls only `ocrProvider.process(filePath)` — it never picks a tier itself.

```
ocrProvider.process(filePath)
  │
  ├─ TIER 1: local PyMuPDF  (execFileSync 'python3' extract_pdf_text.py, timeout 10s)   (:29)
  │     accept ONLY if result.success && pages.length>0 && Σ text length > 100 chars    (:32-34)
  │        │ accepted → return result.pages
  │        └ rejected (scanned / near-empty / python or fitz missing) → fall through
  │
  └─ TIER 2:
        if this.useMock ──► ocrMockService.process()   (canned CBC+LFT text)            (:52-53)
        else            ──► ocrSpaceService.process()   (real OCR.space HTTP, 30s)       (:55)
```

**Tier 1 — `extract_pdf_text.py`** (`backend/src/services/ocr/extract_pdf_text.py`): `fitz.open(argv[1])` → `get_text('text')` per page → prints a **single JSON line** `{success, pages}`. It does **no raster OCR** — an image‑only (scanned) PDF returns ~empty text, so the `>100‑char` guard is the *entire* scanned‑PDF detection heuristic. Any stray `print` in that script would break the `JSON.parse` in `ocrProvider`.

**The `>100‑char` guard** (`ocrProvider.js:34`) is hardcoded — there is no env var for it. It is the seam between "this PDF has extractable text" and "this is a scan, send it to real OCR."

**Tier 2 real — `ocrSpace.service.js`**: reads `OCR_API_KEY || OCR_SPACE_API_KEY`, throws if missing. POSTs multipart to `https://api.ocr.space/parse/image` with `language=eng, isTable=true, scale=true`, 30 s timeout. **OCR.space natively accepts images** (jpg/png) — a capability the pathology `fileFilter` blocks (WS2‑09).

**Tier 2 mock — `ocrMock.service.js`**: reachable **only when `useMock` was true at startup** — never as a silent fallback for a live OCR failure.

**The fail‑loud philosophy is load‑bearing** (`ocrProvider.js:47‑55`, with a paragraph comment). A real OCR failure (timeout, quota, bad scan) is allowed to **throw**, which marks the report genuinely `failed`. It must NEVER fall back to `ocrMock`, because that would inject someone else's placeholder lab values into a report the DB marks `completed`, with nothing flagging it as fake. **Do not "fix" this by adding a mock fallback.**

**`useMock` is frozen at module load** (`ocrProvider.js:8‑10`): `this.useMock = !apiKey || process.env.USE_MOCK_OCR === 'true'`, evaluated once in the constructor of the singleton. Flipping `USE_MOCK_OCR` at runtime does nothing — you must restart. **No OCR key at all ⇒ mock mode automatically.**

**Deploy prerequisite:** `python3` + PyMuPDF (`import fitz`; env pins PyMuPDF 1.27.2.3) must be on `PATH` in every environment. It is an `execFileSync` subprocess, **not an npm dependency**, so a `node_modules` install does not provide it. If it is missing, `execFileSync` throws, the `catch` logs a warning (`:44`), and every PDF silently routes to OCR.space (cost + latency) — or throws if no OCR key is set. (Cross‑ref doc 03 §8.)

---

## 4. The pathology parser algorithm, in order

`backend/src/services/parser/parameterExtractor.service.js` (`extract(pages)`) is the deterministic core. It runs, **per page**, in this exact order.

### 4a. Bounded vertical line‑join preprocessor (`:147‑213`)
Real reports wrap a parameter name across two lines (e.g. `TSH` / `(uTSH)`, or `Non-` / `Reactive`). The preprocessor fuses a single‑cell non‑value line with the **next** line (max 1‑line lookahead, so no runaway merging) when any of these fire:
- **A1 structural:** current line ends with `/` (`:181`).
- **A2 structural:** next line is a bracketed suffix `^\(.*\)$` (`:183`).
- **A3 ontology:** `combined` text maps to a known alias, `length>5`, not a bare number (`:185‑186`).
- **A4 value fusion:** `combined` is itself a valid value string (`:189`).
- **B split‑value:** non‑value prefix + value next cell → join, hyphen‑preserving if the prefix ends `-` (`:201‑208`).

### 4b. Cell tokenization (`:220`)
Each line is split into cells by **tab or 2+ spaces**: `line.split(/\t|\s{2,}/)`. Single spaces stay inside a cell (so multi‑word parameter names survive).

### 4c. Section detection + context reset (`:226‑242`)
`sectionDetector.detectSection(cell)`. A detected section only becomes the new `currentSection` **if it differs** from the one already active (`:234`) — otherwise a parameter row whose name repeats the section title (e.g. section `ESR (Erythrocyte Sedimentation Rate)` followed by a row literally named `ESR - Erythrocyte Sedimentation Rate`) would re‑trigger detection, wipe `pendingParams`, and orphan the value that follows. On a genuine new section: reset `pendingParams = []` and `continue` (headers set context only, never queue as params).

### 4d. Skip legend/column markers (`:253`)
`^(Parameter|Result|Reference|Unit|Interpretation):?$` are skipped. `Interpretation:` is the dangerous one — it fuzzy‑matches the real canonical `interpretation_diagnosis`, and every page ends with an "Interpretation:" free‑text legend that often prints *both* possible results ("Reactive … Non‑Reactive …"). Without this skip, that queued entry steals the next qualitative word as the "result" — confirmed to invert real **NON‑REACTIVE HBsAg/HIV** results to `Reactive`.

### 4e. The value‑first guard (`:255‑262`) — load‑bearing
If `isValueStr(cell)` is true, the cell is routed **straight to the columnar heuristic** and NEVER sent to the ontology mapper. Rationale: short value strings fuzzy‑map to unrelated params (`"Reactive"` → `hs_crp` at score 0.12) and poison `pendingParams`. **Preserve this guard if you refactor `extract()`.**

### 4f. Inline vs columnar extraction (`:262‑329`)
- **Inline** (same‑line column layout): a mapped name looks ahead on the same line for `value → reference_range → unit` and calls `writeParam` immediately with `confidence = mapping.match_score` (`:305`).
- **Columnar** (name and value on different lines): a mapped name with no inline value is queued in `pendingParams` (deduped by canonical_name, `:313`). A later value cell **pops the earliest** pending param (`pendingParams.shift()`, `:326`) and writes it with `confidence = match_score * 0.9` (`:328`).

### 4g. `writeParam` — noise strip, coercion, SI conversion, BP split (`:103‑142`)
1. **BP special case:** a `blood_pressure_combined` mapping with a `130/80`‑shaped value is split into `systolic_blood_pressure` + `diastolic_blood_pressure` (`:105‑116`) — the two canonicals the chronic engine actually reads.
2. **`stripValueNoise`** (`:43‑46`): removes **all** grouping commas and a **trailing** single‑letter `H`/`L`/`*` flag, then `Number()`‑coerces (`:120‑121`). This is WS2‑02 — without it a ferritin of `1,200` was read as `20` (a clinical inversion, not a dropped value).
3. **SI‑unit conversion** (`:129‑133`) — see §6.
4. Store `extractedData[section][canonical_name] = {original_name, value, unit, reference_range, confidence}`.

### 4h. `isValueStr` value grammar (`:68‑93`)
Accepts: numerics with optional leading `<`/`>` comparator; double‑sided ranges (`0.4-4.0`); BP slash pairs (`120/80`); titres (`1:16`); a fixed qualitative set (`Clear|Absent|Present|Positive|Negative|Reactive|Non[-\s]Reactive|Detected|Not Detected|Immune|Non[-\s]Immune|Normal|Abnormal|Rare|Pale Yellow|Pale|Not Applicable`); blood groups `A|B|AB|O`; semen categories `Normo|Oligo|Azoo|Astheno|Terato‑zoospermia`. The `Non[-\s]` variants exist because rapid cards print `NON REACTIVE` unhyphenated.

---

## 5. The ontology & the `canonical_name` contract

`backend/src/services/parser/ontologyMapper.service.js` (~1738 LOC) holds `parametersOntology` (`:3`) — **~156 canonical parameter definitions**, each `{canonical_name, section, aliases[], expected_units[], normal_range_type}`. `canonical_name` is the **silent cross‑system contract**: every downstream consumer (§ below) looks parameters up by it. **Rename a canonical or drop an alias and scoring silently breaks — there are almost no binding tests** (only the new `hasCanonical` hook, `:1638`).

### Match algorithm (`mapParameter`, `:1642`)
1. **normalize** `normalizeParamName` — unwrap parens, `-`/`/` → space.
2. **exact index** (`exactAliasIndex` Map) → `match_score` = **1.0**.
3. **fuzzy** only if `normalized.length >= 4`, via Fuse (`threshold: 0.3`, `:1629`), accept if:
   - `result.score <= 0.15` **with section gating** (`:1670`), OR
   - `result.score <= 0.1` **section‑agnostic** (`:1676` — score ≤0.1 or no current section or `general` or section overlap).

Because short abbreviations (`PCV`, `MCV`, `Hb`, `Na`, `K`, `TLC`) fall under the `length>=4` fuzzy gate, they rely **entirely on the exact index** — which is why the alias corpus is hand‑curated and why the parser's own name gate was lowered to `cell.length >= 2` (`parameterExtractor.service.js:270`).

### Two section taxonomies — the mixed‑key gotcha
There are **two** different section vocabularies, and `extractedData`'s top‑level keys mix them:

| Taxonomy | Where | Example ids |
|---|---|---|
| `sectionDetector` long ids | `sectionDetector.service.js` | `complete_blood_count_cbc_hemogram`, `liver_function_test_lft_total_bilirubin`, `kidney_function_test_kft` |
| ontology short `section` | `ontologyMapper` `parametersOntology[].section` | `cbc`, `lft`, `kft`, `general` |

A param's top‑level key is: the long `currentSection` id if a header was seen, else the ontology short `mapping.section`, else `'general'` (`parameterExtractor.service.js:304`, `:327`). So **key style is not uniform within a single report**. The **rule for every consumer:** scan *all* sections by `canonical_name` (the `findExtractedParam` / `hasParameter` pattern), never a fixed section key. `testCoverage.hasParameter` does exactly this (`testCoverage.service.js:123‑126`).

### False‑positive guards (do not remove casually)
`sectionDetector` accepts fuzzy at `score <= 0.4` and `length >= 4` (`sectionDetector.service.js:347`, threshold 0.3 at `:302`), and carries **hardcoded collision guards** — each with a paragraph comment — because bare `Hemoglobin` / `Hemoglobin (Hb)` / `Hemoglobin A` / `HbA` fuzzy‑collide with the `Hemoglobin A2` header (`:316‑329`) and silently swallow whole CBC panels; `2.4`→`24` collided with `p24 combo`. Removing one silently re‑breaks a real report. Note `urine_routine` is defined **twice** in the array (`:257`, `:273`, first‑wins), and several ontology canonicals are duplicated (first‑wins in `exactAliasIndex`) — intentional.

### Consumers keyed by `canonical_name`
| Consumer | File | Uses |
|---|---|---|
| Body‑health cards + STI safety gate | `services/compatibility/reportSummary.service.js` | reads canonicals for body/family/carrier dimensions (doc 09) |
| Chronic engine | `controllers/chronic.controller.js` (`findExtractedParam`) | glucose, HbA1c, lipids, creatinine, BP (doc 07) |
| Fertility engine | `controllers/mfr.controller.js` | AMH, AFC, semen params (doc 07) |
| PDF report | `services/pdfReport*.service.js` | prints values by canonical (doc 13) |
| Invite gender resolve | `invite.controller.js` → `ontologyMapper.resolveGenderRole` (`:1698`) | infers male/female from present canonicals (doc 12) |

> **Latent bug:** `resolveGenderRole`'s `MALE_MARKERS`/`FEMALE_MARKERS` contain **dead keys** that match no real canonical — `total_sperm_count` (real: `total_sperm_count_per_ejaculate`), `total_sperm_motility_`, `progressive_motility_pr_` (trailing underscores), `anti_mullerian_hormone` (real: `amh`). Only `sperm_concentration`/`semen_volume`/`amh`/`afc`/rubella markers actually fire. Harmless today but a trap when you edit that map.

---

## 6. SI‑unit conversion scope (WS2‑01, partial)

`SI_UNIT_CONVERSIONS` (`parameterExtractor.service.js:14‑25`) is a **targeted patch, not a general unit system.** It fires only for a recognized canonical AND when the captured unit's normalized token equals the known `fromUnit` (`:130`). Converted value = `parseFloat(convert(value).toFixed(2))`, `resolvedUnit = toUnit`.

| Canonical(s) | fromUnit | toUnit | Factor | Tag |
|---|---|---|---|---|
| `fasting_blood_glucose_fbg`, `random_blood_sugar_rbs`, `average_blood_glucose_abg`, `estimated_average_glucose_eag` | `mmol/l` | `mg/dl` | `× 18.0` | `[interim]` |
| `total_cholesterol`, `low_density_lipoprotein_cholesterol_ldl_c`, `high_density_lipoprotein_cholesterol_hdl_c`, `non_hdl_cholesterol` | `mmol/l` | `mg/dl` | `× 38.67` | `[interim]` |
| `serum_creatinine` | `umol/l` | `mg/dl` | `÷ 88.4` | `[interim]` |
| `vitamin_d_3_25_hydroxy` | `nmol/l` | `ng/ml` | `÷ 2.5` | `[interim]` |

`normalizeUnitToken` (`:28‑31`) lower‑cases, strips spaces, maps `µ`→`u` so `µmol/L`/`umol/l`/`u mol / L` all match. These four families are the only ones the deep review validated; the conversion factors are house values pending clinical review — `[interim]`.

**The residual WS2‑01 risk (open):** the other **~150 ontology entries have `expected_units: []`** and there is **no unit‑mismatch flag or rejection anywhere.** A value reported in an unexpected but clinically valid unit for any non‑glucose/cholesterol/creatinine/vitD parameter is consumed as a bare number by scoring, silently mis‑scoring. The comment at `:5‑13` spells out the original failure (a normal `5.5 mmol/L` glucose scored as a critically‑low `5.5 mg/dL`); the fix closes it only for the four families above.

---

## 7. Test coverage summary — the 21 named premarital tests

`backend/src/services/pathology/testCoverage.service.js` maps canonical params → the **21 named tests** a premarital panel is built from, each tagged with the one report dimension it feeds (`TEST_COVERAGE_MAP`, `:16‑117`).

| Test | Any‑of canonical params | `impacts` |
|---|---|---|
| Blood Group — ABO | `blood_group_a_b_ab_o` | Blood group compatibility |
| Blood Group — Rh | `rh_factor_positive_negative` | Rh compatibility (pregnancy) |
| CBC / Hemogram | `hemoglobin_hb`, `total_white_blood_cell_count_wbc_tlc`, `platelet_count` | General blood health |
| FBS / FBG | `fasting_blood_glucose_fbg` | Metabolic — sugar |
| HbA1c | `hba1c` | Metabolic — sugar |
| LFT | `alanine_aminotransferase_sgpt_alt`, `aspartate_aminotransferase_sgot_ast`, `total_bilirubin` | Metabolic — liver |
| KFT | `serum_creatinine`, `serum_urea`, `blood_urea_nitrogen_bun` | Metabolic — kidney |
| Hemoglobin HPLC | `hemoglobin_a2_hba2`, `hemoglobin_s_hbs`, `hemoglobin_f_hbf_fetal_hemoglobin`, `hemoglobin_e_hbe` | Carrier risk (thalassemia) |
| Vitamin B12 | `vitamin_b12_cobalamin_serum` | General baseline |
| Vitamin D (25‑OH) | `vitamin_d_3_25_hydroxy` | Metabolic — vitamins |
| Thyroid | `thyroid_stimulating_hormone_tsh_utsh`, `free_t3_ft3`, `free_t4_ft4` | Metabolic — hormones |
| Lipid Profile | `total_cholesterol`, `low_density_lipoprotein_cholesterol_ldl_c`, `high_density_lipoprotein_cholesterol_hdl_c`, `triglycerides` | Metabolic — heart |
| Semen Analysis (male) | `sperm_concentration`, `total_sperm_count_per_ejaculate`, `total_motile_sperm_count_tmsc` | Fertility (male) |
| AMH (female) | `amh` | Fertility (female) |
| Urine Routine | `specific_gravity`, `ph`, `urinary_protein`, `pus_cells_leucocytes_per_hpf` | General baseline |
| Syphilis VDRL/RPR | `vdrl_rpr_result_reactive_non_reactive` | STI safety |
| HBsAg | `hbsag_qualitative_result_reactive_non_reactive` | STI safety |
| Anti‑HCV | `anti_hcv_antibody_qualitative_result_reactive_non_reactive` | STI safety |
| HIV Combo | `hiv_1_2_antibody_result_reactive_non_reactive`, `hiv_combo_assay_od_value_s_co_ratio` | STI safety |
| Rubella IgG (female) | `rubella_igg_antibody_quantitative_iu_ml`, `rubella_igg_interpretation_immune_non_immune` | Pregnancy immunity |

**The `.some` rule** (`computeTestCoverage`, `:132`): a test counts as **available if *any one* of its listed params is present**, so a partial panel still shows as covered. **Deliberately excluded:** PSA and Nicotine/Cotinine — they're in the frontend's `SUGGESTED_PATHOLOGY_TESTS` but have no ontology entry, so the extractor genuinely can't detect them; listing them as "missing" would misrepresent a product gap as a report defect (`:11‑15`).

**Test coverage of *this subsystem*** is thin: `backend/tests/parser.test.js` (64 LOC, a bare `node`‑runnable assert script — **not Jest**, and `npm test` is a stub per doc 03 §9). It asserts a few happy‑path mappings + basic value extraction, and **none** of the WS2 hardening (unit conversion, comma/flag cleanup, Blood‑Urea mismap, comparator handling). Those regressions are unguarded in CI — add cases whenever you touch aliases or the parser.

---

## 8. RADIOLOGY — the 5‑step pipeline

**Entry (new pipeline):** `POST /api/radiology/upload` (`backend/src/routes/radiology.routes.js`, `authenticateToken` + multer PDF‑only 25 MB, field `pdf`). `uploadReport` (`radiology.controller.js:128`) OCRs via **`ocrProvider`** (the WS2‑08 fix), joins pages with `\n\n` into `rawText`, then calls `runRadiologyAnalysis` (`radiology.controller.js:80`).

```
runRadiologyAnalysis(rawText, sex, age, patientSlayId, bmi)
  │
  1. classifier.classify(rawText)      reportClassifier.service.js  ── regex modality detection
  │     └ throws 'No recognized radiology report sections' if none        (controller :86)
  2. splitter.split(rawText, detected) reportSplitter.service.js   ── positional section slicing
  3. extractor.extractAll(sections,…)  radiologyExtractor.service.js ── per-section LLM extract (parallel)
  │     └ each result passed through schemaValidator.coerceAndValidate BEFORE return
  4. aggregator.aggregate(results)     reportAggregator.service.js  ── merge → {unified, modalities_detected, modalities_failed}
  5a. calculateRadiologyNuptiaContribution(aggregated, sex, age)   nuptia.composite.score.js
  5b. generateRiskFlags(aggregated.unified, sex, age)             riskFlags.service.js
  │
  └ INSERT radiology_reports {findings_json, scores_json, risk_flags_json (JSONB), modalities_detected TEXT[], raw_ocr_text, user_id}
```

| Step | File | Function | Output shape |
|---|---|---|---|
| 1 classify | `services/radiology/reportClassifier.service.js` | `classify(rawText)` (`:127`) | `[{key, matchIndex, matchText}]` sorted by document position |
| 2 split | `services/radiology/reportSplitter.service.js` | `split(rawText, classified)` | `[{modalityKey, rawSectionText, charStart, charEnd}]` |
| 3 extract | `services/radiology/radiologyExtractor.service.js` | `extractSection` (`:19`) / `extractAll` (`:70`) | per‑section validated JSON (or `{error}`) |
| 4 aggregate | `services/radiology/reportAggregator.service.js` | `aggregate(results)` | `{modalities_detected[], modalities_failed[{key,reason}], unified{key:extracted}}` |
| 5a score | `services/scoring/nuptia.composite.score.js` | `calculateRadiologyNuptiaContribution` (`:8`) | `{organ_scores, radiology_nuptia_contribution, max_possible:0.30, modalities_scored}` |
| 5b flags | `services/scoring/riskFlags.service.js` | `generateRiskFlags` (`:314` LOC) | `[{flag_id,flag_label,organ,severity,fertility_relevance,clinical_note,recommended_action}]` |

**Classification is regex + document position** (`reportClassifier.service.js:1` `MODALITY_PATTERNS`, 14 keys). One regex hit per modality is enough (`break`). Fragility to know: scrotum patterns include a bare `/TESTIS|TESTES|TESTICULAR/i` (`:16`) and ECG includes `/LVEF/i` (`:47`) and `/Sinus\s+Rhythm/i` (`:63`) — an *incidental mention* elsewhere can mis‑trigger a modality. If `USG_ABDOMEN_PELVIS` matched, standalone `ABDOMEN`/`PELVIS` are dropped (`:149‑150`). **The splitter is purely positional** — section = text from this modality's `matchIndex` to the next one's; interleaved sections or a header printed *after* its findings produce wrong boundaries, and everything before the first detected header is discarded.

**Extraction retries exactly once, only on malformed JSON** (`radiologyExtractor.service.js:53`: `if (err.code !== 'LLM_MALFORMED_JSON' || attempt === 1) break`). Auth/network/timeout failures are not retried (retrying won't fix them); those drop the whole modality into `modalities_failed` — **the only signal a modality silently vanished.** Output is passed through `coerceAndValidate` before return (`:65`). An unsupported `modalityKey` returns `{error:'unsupported_modality'}` (`:23`). `patientName` gating is how a combined couple report is split by person (multi‑patient disambiguation block).

**`saveReport`** (`radiology.controller.js:192`) is a *separate* path — the frontend "use a mock report" opt‑in. It **always forces `is_mock=TRUE`** and **server‑recomputes** scores/flags from supplied findings (`:200‑201`). It is not a real upload path.

---

## 9. The pseudo‑schema DSL (not JSON‑Schema)

The schema files under `backend/src/services/radiology/schemas/` are **NOT JSON‑Schema / ajv.** Each exports `{modalityKey, label, systemPromptAdditions, jsonSchema}`, where `jsonSchema` is a bespoke pseudo‑DSL of **type strings**:
- Leaves are type strings: `'number | null'`, `'boolean | null'`, `'string'`.
- Closed enums are pipe‑joined vocabularies: `'normal | poor | lost'`, `'null | 1 | 2 | 3'`, `'PA | AP | lateral | unknown'`.
- Arrays are `[itemSchema]`; objects are walked key‑by‑key.

**How it becomes the prompt** (`radiologyExtractor.service.js:26`): `systemPrompt = BASE_SYSTEM_PROMPT (6 rules incl. "null if not mentioned", "NEVER hallucinate") + schema.systemPromptAdditions + JSON.stringify(schema.jsonSchema)`, then `openRouter.extractJSON(...)` with `response_format:{type:'json_object'}`.

**How it coerces/rejects** (`schemaValidator.js:coerceAndValidate`, `:53`) — walks the *same* DSL against the LLM's actual output:
- **Primitive decl** (all tokens in `['number','string','boolean','null']`): coerce type; non‑coercible → `null` (`:18‑37`).
- **Closed enum:** value must be in the vocabulary, else → `null` (`:43‑47`). A numeric‑literal enum member (`grade '2'`) is **re‑cast to a real number** (`:50`) — critical because scorers compare with `===`/`>=`.
- **Only keys present in `schemaNode` survive** (`:67`) — every invented LLM key is dropped.

This is the WS2‑07 fix: previously the LLM's JSON was stored verbatim, so a `fatty_grade: "2"` string or a hallucinated out‑of‑vocab enum flowed unchecked into scorers.

### Adding a modality end‑to‑end
1. **Classifier:** add a `MODALITY_PATTERNS` entry (key + regexes) in `reportClassifier.service.js`.
2. **Schema:** add `schemas/<name>.schema.js` (`{modalityKey,label,systemPromptAdditions,jsonSchema}` in the DSL — every leaf must be a valid type‑string form or validation drops it).
3. **Registry:** add the key to `schemas{}` and a weight to `nuptiaWeights{}` in `schemaRegistry.js`.
4. **Scorer:** add a branch in `nuptia.composite.score.js` (else the weight is dead — see §10).
5. **Flags:** add a branch in `riskFlags.service.js` if it should surface clinical flags.

---

## 10. The 14‑modality inventory — scored vs flagged vs store‑only

`schemaRegistry.js:19‑37` holds the NuptiaScore weights (radiology total = **30% of NuptiaScore**). **A non‑zero weight does NOT mean the modality is scored** — the score only happens if `nuptia.composite.score.js` has a branch for it. All weights are `[interim]` (house values; ECG explicitly flagged provisional in the code comment `:26‑28`).

| Modality key | Weight `[interim]` | Schema file | Scored? (composite branch) | Risk flags? |
|---|---|---|---|---|
| `USG_ABDOMEN` | 0.08 | `usg.abdomen.schema` | ✅ `compositeAbdominalScore` | ✅ |
| `USG_ABDOMEN_PELVIS` | 0.08 | `usg.abdomen.schema` (reused) | ✅ (as USG_ABDOMEN) | ✅ |
| `USG_PELVIS` | 0.05 | `usg.pelvis.schema` | ✅ only if no abdomen scan | ✅ |
| `USG_TVS` | 0.10 | `usg.tvs.schema` | ✅ female only, `femaleReproductiveScore` | ✅ |
| `USG_SCROTUM_DOPPLER` | 0.10 | `usg.scrotum.schema` | ✅ male only, `scrotalScore` | ✅ |
| `ECHO` | 0.05 | `echo.schema` | ✅ `echoScore` | ⚠️ partial (valve severity scored but **never flagged**) |
| `ECG` | 0.05 (provisional) | `ecg.schema` | ✅ `ecgScore` | ✅ |
| `XRAY_CHEST` | **0.03** | `xray.chest.schema` | ❌ **no scorer branch** | ❌ |
| `USG_NECK` | **0.02** | `usg.neck.schema` | ❌ **no scorer branch** (spurious `smoke_free` field) | ❌ |
| `DEXA` | 0.02 | `dexa.schema` | ✅ `dexaScore` | ✅ |
| `MRI_BRAIN` | 0.00 | `mri.brain.schema` | ❌ informational | ❌ |
| `MRA_BRAIN` | 0.00 | `mra.brain.schema` | ❌ informational | ❌ |
| `MRI_RENAL` | 0.01 | `mri.renal.schema` | ❌ (read only for `SHARED_RENAL` couple insight) | ❌ |
| `MRA_AORTA` | 0.01 | `mra.aorta.schema` | ❌ informational | ❌ |

**The trap:** `XRAY_CHEST` (0.03) and `USG_NECK` (0.02) carry **non‑zero weights but have no scorer branch** in `nuptia.composite.score.js` — they are extracted, validated, and stored, yet contribute **nothing** to the score. Six of 14 modalities are effectively extract‑and‑store‑only.

**Sex‑gating** (`nuptia.composite.score.js`): scrotum scored only if `patientSex === 'Male'` (`:50`), TVS only if `'Female'` (`:59`). Risk flags are generated regardless of sex.

### Verbatim scored constants (all `[interim]` unless a source is cited)

**Composite blend** (`nuptia.composite.score.js:99‑107`): `weightedAverage = Σ(score×weight)/Σ(weight)` over *assessed* modalities; **worst‑modality cap** — if `min(modalityScores) < 30` then `weightedAverage = min(weightedAverage, worst + 20)`; `radiology_nuptia_contribution = weightedAverage × 0.30` (`max_possible 0.30`). `[interim]`

**Abdomen organ weights** (`abdomen.score.js:176‑182`, renormalized over assessed organs; `CRITICAL_ORGAN_SCORE_THRESHOLD = 30`, `:161`): liver 0.22, gallbladder 0.10, pancreas 0.08, spleen 0.07, kidneys 0.18, bladder 0.10, reproductive 0.25. `[interim]`

**Per‑organ deductions** (`abdomen.score.js`, `[interim]`): liver fatty_grade 1/2/3 = −15/−30/−50, hepatomegaly −10, ihbr_dilated −20, focal simple_cyst −5 / mass −40; prostate age‑normals cc `{40:20,50:25,60:30,70:40,80:45}` (`:42`), ratio ≤1.2→100, ≤1.5→80 (Gr I), ≤2.0→55 (Gr II), else 30 (Gr III); female repro pcos bilateral −35 / unilateral −20, ovary vol>10cc −10 each, cyst −8 each, fibroid −15, collection −10, vaginal_cyst −8, POD fluid −5; gallbladder calculi −30, wall −15, polyp −10; kidney calculi −20, cysts −5, hydronephrosis grade1 −15 else −30, corticomedullary poor/lost −30; bladder wall −15, calculi −30, mass −50, PVR>100 −20 / >50 −10; pancreas size −15, echotexture −15, focal_lesion −40, calcifications −20; spleen small −10, other −15, focal −30.

**Metabolic Health Index** (0–10, `abdomen.score.js:221`): base 10; fatty 1/2/3 −1/−2.5/−4; hepatomegaly‑without‑fatty −1; cholelithiasis −1; **BMI Asian‑Indian bands (WS3B09, cites JAPI 2009 consensus, `:238`)** ≥32.5 −2, ≥25 −1, ≥23 −0.5.

**Scrotum** (`scrotum.score.js`, `[interim]`): varicocele grade 1/2/3 = −15/−30/−45, ungraded −20; hydrocele bilateral −15 / significant −10 / else −5; focal_lesion −40; vascularity abnormal −20; inguinal_hernia −5. Grades from schema `systemPromptAdditions` (I palpable only, II palpable+visible, III visible w/o palpation); volume V = 0.523×L×W×H.

**Echo** (`echo.score.js`, `[interim]`): LVEF <35/<50/<55 = −50/−25/−10; valve mild/mod/severe = −5/−15/−35; PAH severity bands (PASP <30 none / 30‑50 mild / 50‑70 mod / >70 severe → −10/−25/−45); diastolic grade 1/2/3 = −5/−15/−30; pericardial_effusion −10; rwma −20; thrombus|vegetation −40.

**ECG** (`ecg.score.js`, `[interim]`, code notes need clinical sign‑off): afib −40; other rhythm −20; QTc >500 −40 / >threshold −20 / <350 −10; QRS>120 −15; PR>200 or <120 −10; axis deviation −10; LVH −15; HR<50 or >100 −10.

**DEXA** (`dexa.score.js`, ISCD/WHO logic): `Z_SCORE_BELOW_EXPECTED_THRESHOLD = -2.0`; **age<50 → ISCD Z‑score** (Z≤−2.0 → 60 flag "below expected range for age", else 100; null Z → 80); **age≥50 → WHO T‑score** (≥−1 → 100, ≥−1.5 → 80, ≥−2.0 → 60, >−2.5 → 40 osteopenia, else 20 osteoporosis). Schema WHO bands (`systemPromptAdditions`): T≥−1 normal, −1..−2.5 osteopenia, ≤−2.5 osteoporosis. `[interim]` bands; WHO/ISCD framework is a real source.

**Risk‑flag thresholds** (`riskFlags.service.js`): QTc prolonged 460ms (F) / 450ms (M), >500 high; DEXA age<50 Z≤−2.0, else T≤−2.5 osteoporosis; prostate grade normalized from free text (strips `GRADE`/underscores, `1`→`I`). No flags for xray/neck/MRI/MRA/echo‑valves/hydrocele.

---

## 11. The `null = 'not assessed'` contract (WS1D01) — safety‑critical

Every scorer in `abdomen.score.js` returns **`null`** when a modality was detected but nothing in it was actually assessed (via `hasSignal(obj, keys)`, `:10`, which checks whether any diagnostic field is present, not merely truthy). Examples: `liverScore` returns `null` if none of `fatty_grade/hepatomegaly/ihbr_dilated` and no focal lesions (`:16`); prostate/gallbladder/kidney/bladder/pancreas/spleen/reproductive all have the same `hasSignal` gate.

**Why `null` vs a real 0 is safety‑critical:** `null * weight` silently evaluates to **0** in JS. If a not‑assessed modality were folded in, it would count as a **confirmed catastrophic (score‑0) finding** — exactly the fabrication this fix removes, just inverted. So the composite's `addModalityScore` **explicitly skips `null`/`undefined`** (`nuptia.composite.score.js:25‑30`) and never includes it in `totalWeight`. And a genuine score of 0 (real worst‑case finding) is preserved as 0, not coerced to null by a falsy check (`:111‑115`). **Preserve the null‑vs‑0 distinction anywhere you touch scoring.** This is the WS1D01 fix.

Before this fix, missing organs scored **100** ("healthy"), so a report that assessed only the liver looked fully healthy across every unassessed organ — inflating the radiology domain toward a near‑constant ~100 for most couples (the residual WS1D08 signal‑flatness point in §14).

---

## 12. The legacy‑vs‑new radiology duplication — do not edit the wrong twin

There are **two live radiology pipelines**, and this is the single most important radiology gotcha.

| | **NEW (canonical)** | **LEGACY (deprecated‑but‑live)** |
|---|---|---|
| Controller | `controllers/radiology.controller.js` (441 LOC) | `controllers/usg.controller.js` (539 LOC) |
| Mounted at | `/api/radiology/*` | `/api/usg/*` |
| Extractor | `services/radiology/*` schema‑driven + `coerceAndValidate` | `services/parser/usgExtractor.service.js` (inline prompt, **no validation**) |
| OCR | `ocrProvider` (two‑tier, fail‑loud) | `ocrSpaceService` **directly** (bypasses ocrProvider) |
| Organ scorers | `services/scoring/abdomen.score.js` — **FIXED** (`null` = not assessed) | **inline copies inside `usg.controller.js`** — **BUGGY** |
| Missing‑organ behavior | `null`, excluded from blend | **returns `100`** (`usg.controller.js:3,20,34,58,67,87,100,110`) — the un‑fixed WS1D01 bug |
| NuptiaScore model | 30% domain, per‑modality weights | **OLD 15% model** (`calculateNuptiaScoreContribution`, `usg.controller.js:322‑333`): USG total 15%, sub‑weights Metabolic 30 / Reproductive 35 / Renal 15 / Abdominal 20 |
| Route gating | PDF‑only + 25 MB (WS2‑08 fix, `radiology.routes.js`) | `multer({storage})` **no type/size filter** (`usg.routes.js`) |

`usg.controller.js` is the **stale twin**: it carries its own duplicated copies of every organ scorer, `generateRiskFlags`, `generateCoupleInsights`, `generateCoupleSummary`, and the OLD Nuptia math — **none** with the WS1D01 null‑safety fix. It stays alive as a fallback data source for older `usg_reports` rows (`fetchReportWithFallback` synthesizes a `{USG_ABDOMEN}` shape from them when a `radiology_reports` row is absent).

**The rule:** `services/scoring/abdomen.score.js` is the **source of truth** for organ scoring. If you edit a scorer, edit it there — do **not** edit the inline copy in `usg.controller.js` and assume the other changed, and do not "fix" the legacy `100`‑for‑missing behaviour without understanding it feeds only legacy rows. The **product‑owner direction** (doc 17) is to delete the duplicate legacy engine pages/controllers; that is a separate code change, not yet done.

---

## 13. OCR/LLM external deps, env, pinned models, mock/dev mode

**LLM client** — `backend/src/services/llm/openrouter.service.js`:
- `extractJSON(prompt, systemInstruction, model = 'meta-llama/llama-3.3-70b-instruct')` (`:5`) — **model pinned** for extraction; `response_format:{type:'json_object'}` (`:21`); **60 s timeout** (`:30`); strips markdown fences; tags parse failures with `err.code = 'LLM_MALFORMED_JSON'` (`:49`) — the tag the extractor's one‑retry logic keys on.
- `chatCompletion(messages, model = 'deepseek/deepseek-v4-flash')` (`:61`) — used by AI chat (doc 11); **that default model id may not exist (WS2‑11)**.
- Requires `OPENROUTER_API_KEY`; the extractor throws immediately if it's missing. **The key is currently dead (401)** (doc 03 §8) — radiology upload will therefore fail extraction, not silently template‑fall‑back the way narrative does.

**Env vars** (this subsystem): `OCR_API_KEY` or `OCR_SPACE_API_KEY` (either satisfies both ocrProvider mode selection and ocrSpace); `USE_MOCK_OCR=true` forces mock OCR (frozen at startup); `OPENROUTER_API_KEY` (+ `OPENROUTER_BASE_URL`, `APP_URL` as `HTTP-Referer`) for radiology extraction; `DATABASE_URL` for persistence. There is **no** env var for the PyMuPDF path or the 100‑char threshold — both hardcoded.

**Mock/dev mode:** with no OCR key (or `USE_MOCK_OCR=true`), pathology returns canned CBC+LFT text and `GET /api/pathology/mock-extract` exercises the contract without any external call. Radiology extraction has **no** offline mock — it needs a live LLM key. The frontend "use a mock report" opt‑in hits `saveReport` (`is_mock=TRUE`, §8), and the invite flow has a `useMockRadiology` branch with hardcoded `USG_ABDOMEN` findings (`invite.controller.js:787`).

**Data model** (doc 05): `radiology_reports` stores `findings_json`/`scores_json`/`risk_flags_json` as **JSONB**, `modalities_detected` as `TEXT[]`, plus `is_mock`, `user_id`, `raw_ocr_text`. Legacy `usg_reports` stores `extracted_json`/`analyzed_results` as **TEXT** (callers must `JSON.parse`). Radiology joins to a couple by **`patient_slay_id`/name string match, NOT a foreign key** (`radiologyLookup.fetchRadiologyByIdentity`) — its return shape must stay byte‑identical to `fetchReportWithFallback` because both feed `mapRadiologyToLegacyFormat`, which reads unprefixed keys (`findings`/`scores`/`risk_flags`, not the `*_json` column names).

---

## 14. Open items (see doc 21 for the authoritative list)

- **Pathology unit handling is a 4‑family patch, not general (WS2‑01 residual).** ~150 canonicals have empty `expected_units` and no mismatch validation — any non‑glucose/cholesterol/creatinine/vitD parameter in an unexpected unit silently mis‑scores. `parameterExtractor.service.js:14‑25`.
- **Comparator values dropped (WS2‑05, open).** `<5`/`>90` are recognized by `isValueStr` but `stripValueNoise` does not strip a *leading* `<`/`>`; `Number('<5')=NaN` → stored as a raw string → later `parseFloat`→NaN→silently dropped from numeric scoring (a normal CRP `<5` becomes missing). Fix belongs in `stripValueNoise` (`:43`).
- **Image uploads rejected (WS2‑09, open) & hemoglobin‑variant hardcode (WS2‑10, open).** Pathology `fileFilter` allows only `application/pdf` though OCR.space handles images; and the carrier card in `reportSummary.service.js` still reads "not assessed" for HbS/C/D/E despite those canonicals existing and being extractable.
- **Two live radiology pipelines (§12).** The legacy `/api/usg/*` twin still returns `100` for missing organs (un‑fixed WS1D01) and uses the OLD 15% Nuptia model — a second source of truth. Direction: delete it (doc 17); not yet done.
- **`invite.controller.js:758` bypasses `ocrProvider`** (calls `ocrSpaceService.process` directly) — the WS2‑08 OCR‑routing fix was applied to `radiology.controller` but not propagated here.
- **`raw_ocr_text` retained verbatim** in `ocr_pages` / `radiology_reports` / `usg_reports` and echoed in pathology responses — sensitive health data in scope for the REG‑06 DPDP retention audit (`REG-06_DPDP_SUBSTANTIATION_AUDIT.md`).
- **Non‑determinism + zero CI (WS2‑11).** Radiology extraction is LLM‑based, integration‑testable only against a paid API; pathology's only test (`parser.test.js`) guards none of the WS2 hardening.

---

*Next: `07_medical_engines_chronic_and_fertility.md` — the chronic/cardiometabolic and fertility engines that consume these extracted canonicals, with every threshold and formula verbatim.*
