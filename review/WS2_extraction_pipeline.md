# WS2 — Extraction & Mapping Pipeline Review

Scope: pathology OCR→extractor→ontology pipeline and radiology LLM extractor.
Method: static read of every file in the two pipelines + empirical probes driving the real
`parameterExtractor`, `ontologyMapper`, and `checkSTISafetyGate` modules with crafted OCR
snippets (scratch scripts listed at bottom, runnable with `node`). No production code modified.

---

## Ground-truth map confirmation (brief item 1)

**OCR two-tier flow — CONFIRMED.** `backend/src/services/ocr/ocrProvider.js`:
- Tier 1 (local, first): PyMuPDF via `execFileSync('python3', [extract_pdf_text.py, filePath], {timeout:10000})` — `ocrProvider.js:24-45`. Accepts the local result only if `result.success && pages.length>0 && totalTextLength>100` (`:32-36`); a scanned/near-empty PDF (`<=100` chars) logs "PDF might be scanned" and falls through (`:37-39`).
- Tier 2 (fallback): `ocrSpace.service.js` in real mode, `ocrMock.service.js` only in explicit mock/dev mode — `ocrProvider.js:52-55`.
- `extract_pdf_text.py` is a 25-line PyMuPDF `get_text("text")` per page returning `{success, pages}` JSON — no OCR of raster content, so image-only PDFs correctly fall through to tier 2.

**Fail-loud — CONFIRMED.** The guard is the mode check at `ocrProvider.js:52-55`, documented by the comment at `:47-51`: *"A real OCR failure … must NOT silently become mock canned text … Let it throw so the caller can mark the report as genuinely failed."* In real mode (`useMock=false`) the code path is `return await ocrSpaceService.process(filePath)` with no try/catch, and `ocrSpace.service.js` throws on missing key (`:9-11`), on `IsErroredOnProcessing` (`:31-33`), and rethrows any axios error (`:42-45`). The throw propagates to `pathology.controller.js:121-133`, which marks the report `failed` and calls `next(error)`. Mock text is reachable **only** when `useMock` is already true at startup (no API key or `USE_MOCK_OCR=true`), never as a silent substitute for a live failure. Behavior matches the brief.

**Pathology upload PDF-only — CONFIRMED.** `pathology.controller.js:28-34`:
```js
fileFilter: (req, file, cb) => {
  if (file.mimetype === 'application/pdf') { cb(null, true); }
  else { cb(new Error('Only PDF files are allowed'), false); }
}
```
See WS2-09 for the resulting image-report UX gap.

---

### [P1] WS2-01 — No unit conversion or unit validation: a value in the wrong unit is accepted and fed to scoring as a bare number
- Area: pipeline / engine
- Location: `backend/src/services/parser/parameterExtractor.service.js:71-77` (writeParam) and `:227-235` (unit capture); consumers `backend/src/services/compatibility/reportSummary.service.js:23-24` (`getPartnerNumeric`) and `:230-251`
- Status: Confirmed (reproduced)
- Evidence: `scratch/probe1_alias_units.js`. Fasting glucose row `"...\t5.5\t3.9-5.5\tmmol/L"` extracts to `{value: 5.5, unit: 'mmol/L'}`. Total cholesterol `"...\t5.2\t<5.2\tmmol/L"` → `{value: 5.2, unit: 'mmol/L'}`. `grep` for `mmol|convertUnit|*18|/18` across `src/services/scoring` and `src/services/parser` returns **nothing** — no conversion exists anywhere. `grep '\.unit'` across `src/services/scoring` returns nothing — scoring never inspects the unit. The consumer at `reportSummary.service.js:23-24` is `parseFloat(findPartnerParam(...).value)` — value only, unit discarded. So `5.5 mmol/L` glucose (≈99 mg/dL, normal) is consumed as the number `5.5` (a critically low mg/dL glucose); a cholesterol/LDL/creatinine/vitamin-D reported in SI units is off by 2.5×–88× with no signal.
- Root cause: `expected_units` is used only to *accept* a candidate unit token (`:227`), never to reject a value whose unit contradicts the engine's assumed unit; and 150 of ~156 ontology entries have `expected_units: []`, so even that weak signal is absent for most params. There is no canonical-unit normalization layer between extraction and scoring.
- Impact: clinical-safety / correctness — a scoring engine silently consumes numbers in the wrong unit system.
- Best-fit fix: add a per-canonical `canonical_unit` + conversion table; at writeParam time, if the captured unit is a known convertible variant, convert the value; if the unit is unrecognized/contradictory, store value as-is but attach a `unit_mismatch` flag so downstream can withhold rather than mis-score. Alternatively normalize in a dedicated post-extract pass.
- Effort: M
- Blast radius / dependencies: touches every numeric consumer (reportSummary body-health cards, chronic/mfr engines — WS3). Sequence before any unit-sensitive threshold work.
- Guideline ref: unit factors — glucose mg/dL = mmol/L × 18.0; cholesterol mg/dL = mmol/L × 38.67; creatinine mg/dL = µmol/L ÷ 88.4; 25-OH vit D ng/mL = nmol/L ÷ 2.5.

### [P1] WS2-02 — Comma-grouped numbers and trailing H/L flags cause the reference range to be stored as the value; parseFloat then salvages a plausible-but-wrong number
- Area: pipeline
- Location: `backend/src/services/parser/parameterExtractor.service.js:25-47` (`isValueStr` — no comma/flag handling) and `:261-265` (columnar heuristic pops next value-shaped token); salvage at `reportSummary.service.js:24`
- Status: Confirmed (reproduced)
- Evidence: `scratch/probe2_qualitative_numeric.js` + `scratch/probe3_edgecases.js`:
  - Platelet `"Platelet Count\t1,50,000\t150000-410000\t/cmm"` → `{value: "150000-410000"}` (the reference range, not the count).
  - Platelet `"...\t150,000\t150000-410000\t..."` → `{value: "150000-410000"}`.
  - Ferritin `"Serum Ferritin\t1,200\t20-250\tng/mL"` → `{value: "20-250"}`.
  - Hemoglobin `"Hemoglobin (Hb)\t14.2 H\t13.5-17.5\tg/dL"` → `{value: "13.5-17.5"}`.
  - Hemoglobin `"Hemoglobin (Hb)\t14.2 H\tg/dL"` (no range) → parameter **dropped entirely** (`{}`).
  - Then `parseFloat` salvages the low bound: `parseFloat("150000-410000")=150000`, `parseFloat("13.5-17.5")=13.5`, `parseFloat("20-250")=20`. So a ferritin of 1200 (iron overload) is read as **20** (near-deficient) — a clinical inversion, not a NaN drop.
- Root cause: `isValueStr` recognizes `\d+(\.\d+)?`, ranges, titres, comparators and qualitatives, but not (a) thousands/lakh commas or (b) a numeric followed by an `H`/`L`/`*` flag. The real value token therefore fails `isValueStr`, the parameter stays pending, and the next value-shaped token — usually the reference range — is popped as its value.
- Impact: clinical-safety / correctness / user-trust — wrong-but-plausible numbers reach scoring; H/L flags and comma grouping are ubiquitous on real Indian lab reports.
- Best-fit fix: in `isValueStr` and the value-capture step, strip grouping commas (`/(?<=\d),(?=\d)/`) and a trailing single-letter flag / asterisk before the numeric test; keep the original as `raw_value`. Guard the columnar heuristic so a token that also matches the reference-range shape is not consumed as a value when a range column is expected.
- Effort: M
- Blast radius / dependencies: pure parser change; re-run the qualitative/titre probes to confirm no regression on Reactive/1:320 handling.

### [P1] WS2-03 — "Blood Urea" mis-maps to the BUN canonical (urea ≠ BUN), and that canonical is a live scoring consumer
- Area: pipeline / engine
- Location: ontology entries `ontologyMapper.service.js:446-454` (`blood_urea_nitrogen_bun`) vs `:474-481` (`serum_urea`); consumer `reportSummary.service.js:236-237` (`getPartnerNumeric(..., 'blood_urea_nitrogen_bun')`)
- Status: Confirmed (reproduced)
- Evidence: `scratch/probe1_alias_units.js` and `probe3_edgecases.js`: `mapParameter('Blood Urea','kft')` → `blood_urea_nitrogen_bun (score≈0.968)`; full extract of a "Blood Urea 28 mg/dL" row stores it under `blood_urea_nitrogen_bun`. A separate `serum_urea` canonical exists but the fuzzy match to BUN wins. Urea and BUN differ by ~2.14× (Urea mg/dL = BUN × 2.14), so a blood-urea of 28 read as BUN=28 misrepresents renal status; `reportSummary.service.js:236-237` reads exactly this canonical for the body-health card.
- Root cause: `serum_urea` has only the alias `"serum urea"`; the common label "Blood Urea" fuzzy-matches the longer "blood urea nitrogen (bun)" alias below Fuse's 0.15 gate and no alias claims "blood urea" for the urea canonical.
- Impact: correctness / clinical-safety.
- Best-fit fix: add `"blood urea"`, `"urea"` aliases to `serum_urea`, and (defensively) an exact-index entry so the fuzzy path can't steal it for BUN.
- Effort: S
- Blast radius / dependencies: verify no report legitimately labels BUN as "blood urea"; low risk.

### [P2] WS2-04 — Broad alias-coverage gap: extremely common plain labels silently drop (or feed a consumer nothing)
- Area: pipeline
- Location: `ontologyMapper.service.js` alias lists; length gate `:1594` (fuzzy requires `normalized.length >= 4`); consumers e.g. `reportSummary.service.js:230-231` (LDL)
- Status: Confirmed (reproduced)
- Evidence: `scratch/probe1_alias_units.js` (mapParameter) + `probe3_edgecases.js` (full extract). MISS/UNMAPPED for: `FBS`, `Fasting Blood Sugar`, `LDL`, `LDL Cholesterol`, `HDL Cholesterol`, `WBC Count`, `Total Leucocyte Count`, `Sodium`, `Potassium`, `Uric Acid`, `Sperm Count`, `T. Cholesterol`, `S. Creatinine`, `Creatinine, Serum`. Full-extract rows for `LDL Cholesterol` and `Fasting Blood Sugar` both produce `{}` (dropped). `LDL` alone returns null because it is 3 chars and the fuzzy gate requires ≥4 (`:1594`). Consumer `reportSummary.service.js:230-231` reads `low_density_lipoprotein_cholesterol_ldl_c` — so the LDL card silently has no data whenever the report labels it "LDL Cholesterol".
- Root cause: ontology aliases skew to one canonical spelling (e.g. only `"fasting blood glucose (fbg)"`/`"fbg"`, only `"ldl-c"`, only `"serum sodium (na⁺)"`/`"na⁺"`); very common plain/British/prefixed labels aren't registered, and short forms (`LDL`, `FBS`, `Na`, `K`) fall below the fuzzy length gate with no exact-index entry.
- Impact: correctness / data-integrity — parameters missing from the composite with no user-visible "not assessed" for many of them.
- Best-fit fix: expand alias coverage for the high-frequency labels above (esp. `FBS`, `Fasting Blood Sugar`, `LDL`, `LDL Cholesterol`, `HDL Cholesterol`, `WBC Count`, `Total Leucocyte Count`, `Sodium`, `Potassium`, `Uric Acid`, `Sperm Count`); register short abbreviations in the exact-index so they bypass the length gate. A one-time pass over a corpus of real report headers is the durable fix.
- Effort: M
- Blast radius / dependencies: adding aliases can create new fuzzy collisions — re-run the section/param probes after each batch. Sequence with WS2-03.

### [P2] WS2-05 — Comparator values ("<5", ">90") stored as strings → parseFloat → NaN → silently dropped from numeric scoring
- Area: pipeline
- Location: `parameterExtractor.service.js:73` (`isNaN(Number(rawValue)) ? rawValue : Number(rawValue)`); consumer `reportSummary.service.js:24`
- Status: Confirmed (reproduced)
- Evidence: `scratch/probe2_qualitative_numeric.js`: CRP `"<5"` stores `{value: "<5"}`; `node -e parseFloat('<5')` → `NaN`. Whereas `parseFloat` salvages ranges (WS2-02), it cannot salvage a leading comparator, so the value is treated as missing.
- Root cause: comparator-prefixed values are recognized by `isValueStr` (so extraction "succeeds") but never coerced to a usable number.
- Impact: correctness — "<5 mg/L CRP" (a normal result) becomes missing rather than a low value; inconsistent with the range-salvage behavior.
- Best-fit fix: strip a leading `<`/`>` and coerce (optionally retaining a `bound` marker), or normalize comparator handling centrally alongside WS2-02.
- Effort: S

### [P2] WS2-06 — CONFIRMED-SAFE: STI qualitative parsing and `checkSTISafetyGate` are correctly coordinated (hypothesized "Non Reactive" seam does NOT exist)
- Area: validation
- Location: extractor `isValueStr` `parameterExtractor.service.js:41` (`Non[-\s]Reactive`); gate `reportSummary.service.js:145,157,168,179,190`
- Status: Confirmed (reproduced)
- Evidence: `scratch/probe2_qualitative_numeric.js`. Extractor emits `"Non-Reactive"` (hyphen) and `"Non Reactive"` (space) identically as the param value. Feeding both straight into `checkSTISafetyGate`: hyphen → `triggered=false`, space → `triggered=false`, `Reactive` → `triggered=true (Hepatitis B)`, HIV `Reactive` → `triggered=true (HIV)`, P24 `Detected` handled. The gate matches with `/reactive/i.test(x) && !/non/i.test(x)` (and `/detected/ && !/not/`), which is robust to hyphen-vs-space and case. The brief's hypothesized seam is not a bug — this is a genuine strength; recording it so it isn't "fixed" into fragility. Titre `1:320` also parses correctly to `{value: "1:320"}`.
- Impact: n/a (positive finding). Note the residual dependency: the gate keys on exact canonical names (`hbsag_qualitative_result_reactive_non_reactive`, etc.); if an alias gap (WS2-04 class) ever dropped one of these params, the gate would see "no result" — currently those STI aliases are present, but this coupling is worth a regression test.

### [P2] WS2-07 — Radiology LLM output is consumed with no schema validation: malformed JSON silently drops the modality; invented/extra fields and hallucinated values pass through unchecked
- Area: pipeline / validation
- Location: `radiologyExtractor.service.js:39-47`; JSON parse `llm/openrouter.service.js` `extractJSON` (`JSON.parse(cleanContent.trim())`); aggregation `reportAggregator.service.js:9-17`; prompt `radiologyExtractor.service.js:5-15`
- Status: Static-only (LLM not invoked; consuming code traced)
- Evidence: Anti-hallucination defense is prompt-only — `BASE_SYSTEM_PROMPT` lines: *"Your output MUST be ONLY valid JSON matching the exact schema provided"*, rule 2 *"If a field is not mentioned, set it to null"*, rule 6 *"NEVER hallucinate measurements not present in the text"* (`:9-15`). Request sets `response_format:{type:'json_object'}` and strips markdown fences. Failure modes traced:
  - **Malformed JSON**: `JSON.parse` throws → caught in `extractSection` `try/catch` (`:43-46`) → returns `{extracted:null, error}` → `reportAggregator.service.js:10-13` pushes to `modalities_failed` and continues. Result: that modality silently vanishes from `findings`; the only signal is the `modalities_failed` array. No retry, no user-facing error.
  - **Invented field not in schema**: there is **no** validation of `jsonResponse` against `schema.jsonSchema` — it is returned as-is (`:42`) and stored verbatim at `reportAggregator.service.js:16`. Extra fields are kept; scorers simply ignore unknown keys.
  - **Right key, wrong type / hallucinated value**: accepted verbatim. E.g. `fatty_grade: "2"` (string) or a fabricated `volume_cc` flows into the abdominal scorer unchecked; nothing cross-checks values against `sectionText`.
- Modalities covered (schemaRegistry): USG_ABDOMEN, USG_ABDOMEN_PELVIS, USG_PELVIS, USG_TVS, USG_SCROTUM_DOPPLER, ECHO, ECG, XRAY_CHEST, USG_NECK, DEXA, MRI_BRAIN, MRA_BRAIN, MRI_RENAL, MRA_AORTA (14 keys, 13 schema files). Prompt adequacy: the "null if not mentioned / never hallucinate" rules are reasonable but unenforced.
- Impact: correctness / data-integrity — a bad LLM turn either drops a whole modality or injects unvalidated values with no coercion.
- Best-fit fix: validate `jsonResponse` against the declared schema (types + allowed enums like `corticomedullary_differentiation`) before accepting; coerce numerics; on parse failure, retry once then record a typed failure. Consider `ajv` with a generated JSON-Schema per modality.
- Effort: M

### [P3] WS2-08 — Inconsistent upload gating & OCR path between the two pipelines
- Area: pipeline
- Location: `backend/src/routes/radiology.routes.js:26` (`multer({ storage: storage })` — no `fileFilter`); `radiology.controller.js:136` (`ocrSpaceService.process` directly)
- Status: Confirmed (read)
- Evidence: Radiology `/upload` uses `multer({ storage })` with **no** `fileFilter` and no `limits` (accepts any type/size), whereas pathology enforces PDF-only + 25 MB (`pathology.controller.js:25-35`). Radiology also calls `ocrSpaceService.process` directly (`:136`), bypassing `ocrProvider`'s tier-1 PyMuPDF fast path **and** the mock-mode guard — so radiology has no local-extraction path and, if no OCR key is set, throws immediately (fail-loud, acceptable) rather than falling back.
- Impact: UX / robustness — divergent behavior for equivalent uploads; radiology pays OCR.space cost/latency even for text PDFs it could parse locally.
- Best-fit fix: route radiology through `ocrProvider` too; add a shared multer config (type + size) used by both controllers.
- Effort: S/M

### [P3] WS2-09 — Pathology rejects image (jpg/png) lab reports although OCR.space + ocrProvider both support images (real UX gap)
- Area: UX
- Location: `pathology.controller.js:28-34`; capability at `ocrProvider.js:19` doc ("Process a PDF or Image file"), `ocrMock.service.js`/`ocrSpace.service.js` both accept image streams
- Status: Confirmed (read)
- Evidence: `fileFilter` allows only `application/pdf`. OCR.space's `/parse/image` endpoint (used at `ocrSpace.service.js:23`) natively accepts JPG/PNG. Users very commonly photograph a paper lab report; those uploads are rejected with "Only PDF files are allowed" even though the downstream OCR would handle them. (Note: tier-1 PyMuPDF is PDF-only, but an image would simply fall through to tier-2 OCR.space, which is the exact designed fallback.)
- Impact: UX — avoidable friction / drop-off for a common real-world input.
- Best-fit fix: allow `image/jpeg`, `image/png` (and `image/heic` if feasible) in the fileFilter; images skip tier-1 and go straight to OCR.space. Keep the 25 MB limit.
- Effort: S — verify tier-1's `<=100` char fall-through fires cleanly for image inputs (it should, since PyMuPDF returns little/no text or errors, both of which already fall through).

### [P3] WS2-10 — Prose-only gaps not tracked by any TODO/FIXME
- Area: engine / regulatory
- Location: `reportSummary.service.js:50-52` and `:100-108`; `schemaRegistry.js:26-29`
- Status: Static-only (read)
- Evidence: No `TODO/FIXME` markers exist in the extraction code, but two known limitations live only in prose:
  1. **Hemoglobin variant screening hardcoded "not assessed"** despite the ontology supporting the fractions. `evaluateThalassemiaCarrierRisk` reads only `hemoglobin_a2_hba2` (`:55-56`) and returns a hardcoded `hemoglobin_variant {status:'gray', covered:false}` block (`:100-108`) with narrative *"…requires an HPLC report that was not part of this analysis."* — yet `ontologyMapper.service.js` DOES define `hemoglobin_s_hbs`, `hemoglobin_c_hbc`, `hemoglobin_d_hbd`, `hemoglobin_e_hbe`, `hemoglobin_f_*` canonicals (`:594-733`). So HbS/C/D/E values that CAN be extracted are never read; the sickle/variant sub-check is permanently stubbed. Honest to the user, but a real coverage gap presented as an inherent limitation.
  2. **ECG NuptiaScore weight is a provisional engineering guess** — `schemaRegistry.js:26-29`: *"Provisional — same weight as ECHO … needs real clinical-weighting sign-off, not an engineering guess."* Feeds the 30% radiology contribution.
- Impact: user-trust / regulatory — undocumented scope limits and an unsigned-off clinical weight in a shipped composite.
- Best-fit fix: track both as explicit backlog items; for (1) either wire HbS/C/D/E into the variant card or keep it stubbed with a dated decision note; for (2) obtain clinical sign-off on the ECG weight.
- Effort: S (tracking) / M (wiring variants)

### [P3] WS2-11 — Architectural seam: two extraction philosophies (deterministic regex/ontology vs. LLM) feed one composite (brief item 4)
- Area: pipeline
- Location: pathology `parser/*` (deterministic) vs. radiology `radiologyExtractor.service.js` + `openrouter.service.js` (LLM); both converge at the NuptiaScore composite (`scoring/nuptia.composite.score.js`)
- Status: Static-only (analysis)
- Evidence & implications:
  - **Determinism/reproducibility**: pathology is pure and repeatable — same OCR text → identical JSON (verified across probes). Radiology is non-deterministic (LLM temperature/model drift; model pinned to `meta-llama/llama-3.3-70b-instruct` at `openrouter.service.js:5`), so the same report can score differently across runs, and a chat-path fallback references a possibly-nonexistent `deepseek/deepseek-v4-flash`/`deepseek-chat` (`:52,81`).
  - **Testability**: pathology is unit-testable offline (these probes need no network); radiology extraction can only be integration-tested against a live paid API, so its failure modes (WS2-07) are effectively untested in CI.
  - **Failure modes**: pathology fails *closed* per-parameter (drops/mis-maps individual fields — WS2-02/04); radiology fails *closed* per-modality (drops the whole modality on malformed JSON — WS2-07). Neither surfaces a strong user-facing "this value is uncertain" signal.
  - **Cost/latency**: pathology is CPU-only and instant; radiology adds OCR.space + a 60 s-timeout LLM call per modality (parallelized via `extractAll`), i.e. real per-report cost and tail latency, and a hard dependency on two external APIs.
  - **Correctness ceiling**: regex/ontology can't generalize to unseen phrasings (WS2-04) but never fabricates; the LLM generalizes but can hallucinate (only prompt-guarded, WS2-07). Feeding both into one score means the composite inherits *both* an alias-coverage floor and a hallucination risk with no unified confidence model.
  - Recommendation: define a shared post-extraction validation/confidence layer (units per WS2-01, schema-validation per WS2-07, and a per-field confidence the composite can weight) so both philosophies present a consistent contract to scoring.
- Impact: correctness / operational.
- Effort: L (architectural)

---

## Scratch scripts (throwaway, `backend/scratch/`, run with `node`)
- `backend/scratch/probe1_alias_units.js` — 25 real-world alias variants + mmol/L unit mis-accept (WS2-01, WS2-03, WS2-04).
- `backend/scratch/probe2_qualitative_numeric.js` — qualitative STI results (hyphen vs space), titre `1:320`, comma/flag/comparator numeric edge cases, and `checkSTISafetyGate` coordination (WS2-02, WS2-05, WS2-06).
- `backend/scratch/probe3_edgecases.js` — tightened trailing-flag drop, Western comma grouping, Blood Urea→BUN mis-map, LDL/FBS drop through full extract (WS2-02, WS2-03, WS2-04).
- (inline `node -e`) parseFloat salvage of range strings, confirming plausible-but-wrong numbers (WS2-02).
