# PDF Report Generation

**Doc 13 of 22** · Audience: a solo full‑stack successor · Prerequisite: `10_match_orchestration_generate_insights.md`, `09_composite_scoring_sti_gate_and_genetics.md`.

Goal of this doc: understand the **downloadable PDF report** end‑to‑end — which of the two sibling renderers is real and which is dead, the two endpoints (`/pdf` and the unlinked `/ai-pdf`), the fixed 6‑page layout page‑by‑page, the shared `presentation_json` contract it consumes, the base‑14 font/emoji limitation, which copy is data‑driven vs hardcoded, and the open trust/regulatory bugs a print‑and‑show‑a‑doctor artefact makes worse.

The PDF is the single artefact a couple is most likely to **save, print, or hand to a clinician**. That makes every bug in it higher‑stakes than the same bug on screen: an on‑screen "Excellent" is transient; a printed one lives in a folder. Read this doc with that framing.

---

## 1. Two services, one canonical, one dead

There are two files with the **identical export name** `generatePDFReportStream(matchData)`. Only one is wired to anything.

| File | Status | Theme | Pages | Wired? |
|---|---|---|---|---|
| `backend/src/services/pdfReport.service.js` (1041 LOC) | **CANONICAL** | Light "luxury" — cream `#FBF9F4` / gold `#B38E36` / forest‑green `#0E3B2F` (`pdfReport.service.js:11`) | Fixed **6 pages** A4 | **Yes** — imported at `compatibility.controller.js:4` |
| `backend/src/services/pdfReport2.service.js` (~614 LOC) | **ORPHAN / dead code** | Dark — navy `#07090f` / gold / purple | **1 page only** (a cover, then `doc.end()`) | **No** — grep of backend + frontend finds zero imports |

**The trap:** the two files look like siblings you can edit interchangeably. They are not. **Editing `pdfReport2.service.js` changes nothing any user ever sees.** If a change to the PDF "isn't taking effect", the first thing to check is whether you edited the wrong file.

`pdfReport2` is not worthless — it holds the *richer future* clinical extractor set the canonical file lacks: `getUSGText`, `getOrganVolumesText`, `getEchoText`, `getDexaText`, `getXrayText`, `getNeckText`, `getMTHFRText`, `getCFTRText`, `getKaryotypeText`, plus `idrsBand` and `bmiBand`. It is also the **only** file that references the logo asset `frontend/assets/logo (1).png`. But it renders **only a single cover page** — if someone naively swaps the controller import to point at it, they lose pages 2–6 entirely.

**Decided direction (product owner):** this is a *decide‑and‑act* orphan — either wire `pdfReport2`'s radiology/karyotype/MTHFR/CFTR/DEXA extractors into the canonical renderer, or delete `pdfReport2` outright. Do not leave it sitting as a booby‑trap. This is tracked as debt, not yet actioned (doc 21).

---

## 2. The two endpoints and their auth

Both endpoints live in `compatibility.controller.js` and both call the **same canonical** `generatePDFReportStream`. They differ only in **how `presentation_json` is produced** before the renderer runs.

| Endpoint | Handler | Auth | Presentation source | Frontend trigger |
|---|---|---|---|---|
| `GET /api/compatibility/matches/:matchId/pdf` | `generatePDFReport` (`compatibility.controller.js:115`) | `authenticateOrShareToken` — **session OR 48h share token** | Stored `presentation_json`, else live `mapPresentation` | **Yes** — two places (below) |
| `GET /api/compatibility/matches/:matchId/ai-pdf` | `generateAIPDFReport` (`compatibility.controller.js:320`) | `authenticateToken` (blanket) | DeepSeek via `aiPresentationService.generateAIPresentationMap` | **None** — orphaned endpoint |

### The `/pdf` share‑token reachability (treat the PDF as externally reachable)

Route order matters. In `compatibility.routes.js:10` the `/pdf` route is registered **before** the blanket `router.use(authenticateToken)` at line 13, and uses `authenticateOrShareToken` instead:

```
routes:  GET /matches/:id/pdf   → authenticateOrShareToken   ← session OR ?shareToken=
         router.use(authenticateToken)   ← everything below needs a real session
         GET /matches/:id/ai-pdf → generateAIPDFReport
```

A 48‑hour, match‑scoped `?shareToken=` (minted by `createShareLink`, `expiresInHours:48`) grants **full clinical PDF download** to anyone holding the link. This is **by design** — the couple is meant to be able to share their report — but it means the PDF is not behind a login wall. Treat the full clinical PDF as externally reachable to anyone with the token. (Auth/share‑token internals: doc 04; share‑link minting: doc 10.)

### Frontend triggers (`/pdf` only)

| Location | Mechanism | Note |
|---|---|---|
| `frontend/src/app/core-engine/layout.js:356` | Direct `<a href>` to `…/pdf?token=${getAccessToken()}` | **Puts the raw access token in the URL query string** — it lands in browser history, referrer headers, and any proxy log. Flag for security review (doc 20). |
| `frontend/src/app/core-engine/story/page.js:105` | `apiFetch(…/pdf)` with an `isPdfDownloading` state (button at `story/page.js:1186`) | Uses the normal auth header path, not a query‑string token. |

**No frontend surface calls `/ai-pdf`.** It is routed, functional, and reachable via a session, but nothing in the UI links to it. Because it invokes DeepSeek before rendering, it adds latency + LLM cost and carries a **second copy of the confidence‑uplift math** (§4) that must stay in sync. If you don't intend to ship it, consider removing it; if you do, wire a button and load‑test the DeepSeek round‑trip.

---

## 3. The 6‑page layout, page by page

All pages are **A4 (595×842 pt)** drawn with **absolute x/y coordinates** — there is no flow layout. The document is created with `bufferPages:true` (`pdfReport.service.js:349`), which is **mandatory**: the global header bar and footer are stamped in a post‑hoc loop at the very end (see below). The main render function is `generatePDFReportStream` (`pdfReport.service.js:348`).

```
Page 1  COVER + KEY NARRATIVES
        ├─ title block "Your Health & Compatibility Profile"      (:444-449)
        ├─ confidence meter card (forest-green, HOW SURE ARE WE?) (:452-484)
        ├─ "WHAT THIS MEANS FOR YOU TWO" synthesis + 3 columns    (:486-525)
        │        (score · overall rating · confidence band)
        └─ "YOUR FINDINGS — THE GOOD NEWS": 3 narrative cards      (:527-550)
                 Fertility · Blood Sugar · Heart

Page 2  FINDINGS CONTINUED + VERIFICATION
        ├─ Infection Screening card                               (:560-566)
        ├─ "TWO SMALL THINGS TO TIDY UP": Vitamins + Sleep        (:568-581)
        ├─ "Everyday life" lifestyle card                         (:583-588)
        └─ "MAKE YOUR BLOOD TESTS COUNT" verification upsell      (:590-628)

Page 3  PARTNER HEALTH COMPARISON  (11-row side-by-side table)   (:630-719)

Page 4  INFECTIOUS DISEASE & GENETIC RISK
        ├─ STI panel: tested markers (side-by-side badges)        (:729-779)
        ├─ untested markers block                                 (:781-800)
        └─ genetic carrier-pair (thalassemia) card               (:802-853)

Page 5  LIFESTYLE & 90-DAY IMPROVEMENT PLAN
        ├─ 4 lifestyle cards (comm/conflict/stress/habits)        (:863-889)
        ├─ Psychological Harmony Analysis paragraph               (:896-907)
        └─ 90-Day Roadmap: 4 step cards + closing banner          (:909-949)

Page 6  "SEE THE FULLER PICTURE" UPSELL
        ├─ 3 module upsell cards (Genetic/Radiology/Mental)       (:960-992)
        └─ dark-green "96%" banner                                (:994-1014)

(after doc.end setup) GLOBAL HEADER + FOOTER stamped on every page (:1016-1035)
```

### The buffered header/footer loop

After all six pages are drawn, `pdfReport.service.js:1019-1035` walks `doc.bufferedPageRange()` and, on **every** page, stamps:
- **Header** (`drawHeaderBar`, `:242`): `SLAY.HEALTH · PREMARITAL HEALTH INTELLIGENCE` (left) and `CONFIDENTIAL · N / total` (right).
- **Footer** (`:1029-1032`): `CONFIDENTIAL — SLAYHEALTH PREMARITAL PROFILE | Values extracted from uploaded lab reports on: {date} | Shared only with report holders.` plus `PAGE n OF total`.

This is the **only place a global disclaimer could be injected once** and reach all pages — relevant to REG‑02 (§10). Note what the footer says and, more importantly, **what it does not**: there is no "not a diagnosis / consult a clinician" line anywhere.

---

## 4. The `presentation_json` contract and its two producers

The renderer is a **pure presentation layer** over one JSON structure. Whether that structure comes from the deterministic engine path or from DeepSeek, the renderer draws it the same way.

### The contract fields the renderer reads

| Field | Consumed on page(s) | Renderer default if absent (`pdfReport.service.js`) |
|---|---|---|
| `report_confidence` `{overall, band, domains_covered, blood_verified, domains{...}}` | 1 (meter), 6 (upsell "completed" flags) | `{overall:58, band:'Good start', domains_covered:2, …}` (`:400-412`) |
| `couple_synthesis` (string) | 1 ("WHAT THIS MEANS") | hardcoded warm fallback (`:489`) |
| `relationship_snapshot` `{score, status, color}` | 1 (3 columns) | `{score:null, status:'Pending', color:'gray'}` (`:395`) |
| `family_planning` `{stars, rating, annualChance, monthsToConceive, details}` | 1 (fertility card), 3 (conception bar) | `{stars:null, rating:'Not yet assessed', annualChance:null, …}` (`:396`) |
| `sti_gate` `{triggered, headline, narrative, clinical_footnote, badge, findings}` | 2 (infection card) | honest "Infection screening unavailable / not confirmation of a clear result" (`:397`) |
| `body_health` `{sugar, heart, liver, kidney, hormones, vitamins}` per‑card `{headline, narrative, clinical_footnote, badge, male_status, female_status, male_value, female_value}` | 1, 2, 3 | per‑card inline literals (`:543`, `:548`, `:573`) |
| `carrier_pair_risk` `{thalassemia, hemoglobin_variant, genetic_note}` | 4 (genetic card) | `{}` → "All clear" branch |
| `lifestyle` `{communication, conflict, stress, habits}` | 5 | per‑card `'Aligned'/'Healthy'/…` literals (`:865-868`) |
| `improvement_plan` `{sleep, diet, exercise, retests}` | 5 (roadmap) | generic literals (`:919-922`) |

### The two producers

| Producer | File | Used by | Notes |
|---|---|---|---|
| `mapPresentation(chronicResult, mfrResult, mentalResult, details)` | `reportSummary.service.js:275` | `/pdf` (live, when no `presentation_json` persisted) | The **canonical** builder. Also the on‑screen report's source, so PDF and web stay consistent. Owns the clinical thresholds (§8). |
| `PRESENTATION_SCHEMA` + `generateAIPresentationMap` | `aiPresentation.service.js:8` | `/ai-pdf` | DeepSeek authors the same shape. `PRESENTATION_SCHEMA` (`:8-91`) is the authoritative JSON contract prompt. |

> **Confidence math is duplicated in THREE places and must stay in sync:** the live formula in `reportSummary.service.js:315-348`, the prose‑encoded rule in `aiPresentation.service.js` `PRESENTATION_SCHEMA` (`:10`: "starting from 58 … Add 16 … Add 11 … Add 6 … Add 5 … Max is 96"), and the renderer's hardcoded fallback in `pdfReport.service.js:400-412`. Change one, change all three, or the number on the cover drifts from the modules on page 6. (Formula's canonical home and rationale: doc 09.)

Normal path (`/pdf`): the match already carries `presentation_json` produced by the same gated computation `computeGatedComposite` used at save‑match (doc 10), so the renderer just reads it. The live `mapPresentation` fallback only fires if that field was never persisted, and if `mapPresentation` itself **throws**, the code falls to the honest "unavailable / Not assessed" defaults above — it does **not** fabricate a confident result. Those defaults were deliberately rewritten after past bugs fabricated an 85/Good score and a false "STD non‑reactive" claim (in‑code comments at `pdfReport.service.js:387-397`). **Preserve the honest nulls when refactoring.**

---

## 5. Data flow: from the `matches` row to the drawn page

```
click "Download PDF"  (layout.js:356 ?token=  OR  story/page.js:105 apiFetch)
   │
GET /matches/:id/pdf ──authenticateOrShareToken──▶ generatePDFReport (controller:115)
   │
   ├─ SELECT * FROM matches WHERE id = $1                          (:122)
   ├─ parse analysis_json → {chronicResult, mfrResult, mentalResult, details}
   ├─ derive male/female patient_slay_id
   ├─ fetchRadiologyReport(both) → match.maleRadiology/femaleRadiology  (:150-156)
   │        ⚠ MOSTLY UNUSED by the canonical renderer (see gotcha below)
   ├─ ensure frontend/pdf_reports/ exists                          (:158-162)
   └─ generatePDFReportStream(match)                               (:167)
          │
          ├─ re-parse analysis_json                                (pdf:351-358)
          ├─ presentation = match.presentation_json ?? mapPresentation(...)  (:366-385)
          ├─ gender alignment: isA_Female = partner_A.sex==='F' || partner_B.sex==='M'  (:415)
          ├─ hasHealthFlag pass over body_health → maybe green→yellow  (:426-436)
          ├─ draw 6 pages (absolute coords; STI/comparison read RAW pathology)
          └─ buffered loop stamps header/footer on every page      (:1019-1035)
          │
   ├─ stream piped to disk (SlayHealth_Premarital_Report_{id}.pdf) AND to res  (:170-176)
   └─ doc.end()
```

### Gender alignment (a silent mislabel risk)

`pdfReport.service.js:415`: `isA_Female = chronic.partner_A?.sex === 'F' || chronic.partner_B?.sex === 'M'`. This routes which partner's pathology/manual data/raw values fill the "MALE" vs "FEMALE" columns and headers. **If `sex` is missing on both**, it defaults to partner A = male — silently mislabelling the comparison columns. The product is structurally one‑male‑one‑female (doc 01), so this usually resolves, but a data‑quality gap here corrupts pages 3 and 4.

### The `hasHealthFlag` override — and its blind spot

`pdfReport.service.js:426-436` scans **only** `presentation.body_health` cards; if any is `yellow`/`red` it downgrades the cover snapshot (`green→yellow`, `Excellent→Good`). **It never inspects `sti_gate.triggered` or `carrier_pair_risk.*_status==='red'`.** This is the mechanical root of the UX3‑02 P0 bug (§10): a couple whose *only* severe finding is a confirmed both‑carrier overlap or a reactive STI still prints **Excellent / green** on the cover.

### The raw‑pathology extraction path (why pages 3–4 can disagree with 1–2)

Pages 3 (comparison) and 4 (STI panel) do **not** read the presentation cards. They read the **raw pathology objects** via `flattenPathologyParameters` (`:267`) → `findExtractedParam` (`:291`), which canonicalise every key to `lower_snake_case`. So the two data pages can **disagree** with pages 1–2 if the raw extraction and the presentation summary diverge. When a value looks wrong on page 3 but right on page 1 (or vice versa), that's the reason — two different data paths.

### Gotcha: the fetched radiology is (mostly) wasted work

The controller fetches `maleRadiology`/`femaleRadiology` (`:150-156`) and attaches them to `match`, but the **canonical renderer never reads those fields**. Radiology only reaches the presentation via the `radiology_report_id: matchData.female_report_id` passed into `mapPresentation` (`pdfReport.service.js:376`). `fetchRadiologyReport` can also **404** against the radiology engine when a `report_id` is stale (handled gracefully — recent commit "Recover gracefully when a pathology report_id is stale"). Net: a network round‑trip whose result is largely discarded. Confusing, and a candidate for removal.

---

## 6. Font & emoji limitation, and overflow risk

**Base‑14 fonts only.** The renderer uses just the pdfkit built‑ins: `Helvetica`, `Helvetica-Bold`, `Helvetica-Oblique`, `Times-Bold`, `Times-BoldItalic`, `Times-Italic`. **No fonts are embedded.** Consequently `cleanPDFText` (`pdfReport.service.js:34-51`) **strips every emoji and non‑ASCII glyph** before drawing: emoji ranges are removed, curly quotes/dashes/ellipsis are down‑mapped to ASCII, and a final `replace(/[^\x00-\x7F]/g, '')` deletes anything left. **Do not expect Unicode to render** — an emoji in a narrative string silently vanishes. (Note the AI‑PDF path builds an `ai_narrative` full of emoji at `compatibility.controller.js:371-374`; those are stripped at draw time, which is fine, just know it.)

**Absolute‑coordinate, fixed‑height overflow.** Every card sits at a hardcoded `x/y` with a mostly **fixed height**. The one exception is `drawNarrativeCard` (`:190-239`), which measures its own text height via `heightOfString`. Everywhere else, an unusually long narrative — especially a DeepSeek‑authored one on the `/ai-pdf` path — can **overflow its card or collide with the next section** on pages 2, 5, and 6. There is no reflow. If you add or lengthen copy, verify the render at the extremes.

---

## 7. Data‑driven vs hardcoded copy, per page

The single most common false assumption here is "the report says X, so the engine computed X." Often it didn't — the string is a **static literal in the renderer** that prints identically for every couple. Check the file before hunting in the engines.

| Page | Data‑driven (from `presentation_json` / raw pathology) | Hardcoded literal (same for every couple) |
|---|---|---|
| 1 | confidence `overall`/`band`/`domains_covered`; `couple_synthesis`; snapshot score/status; fertility card headline/narrative branches on `fp.rating` | the two fertility narrative sentences themselves (`:532-537`); sugar/heart card **defaults** if `body_health` absent (`:543`, `:548`) |
| 2 | infection card (from `sti_gate`); vitamins card (from `body_health.vitamins`) | **Sleep card entirely** (`:577-579`); **"Everyday life" card entirely** (`:584-586`); **verification upsell copy + "+16%" figures** (`:603-626`) |
| 3 | all 11 rows (glucose/lipids/waist/BP/AMH/semen/liver/kidney/hormones/vitamins/conception) from raw pathology + `body_health` | the bottom disclaimer sentence (`:716-718`); the `'HEALTHY'`/`'Normal'` **fallback defaults** (see UX3‑06, §10) |
| 4 | STI badges (from raw pathology); genetic card headline/narrative/badge (from `carrier_pair_risk.thalassemia`) | untested‑block explanatory copy (`:784-785`); "Talk to a genetic counselor…" line (`:847`) |
| 5 | lifestyle card values (from `lifestyle`); roadmap steps (from `improvement_plan`); psychological summary (from `mental.overall_readiness`) | lifestyle card **defaults** (`:865-868`); roadmap **defaults** (`:919-922`); closing banner (`:948`) |
| 6 | the three "completed" flags (`reportConfidence.domains.*.covered`) toggle headline/badge | **all upsell body copy**; **the "96%" banner and its "Near‑complete" label are 100% hardcoded** (`:1003-1013`) |

The page‑6 **96%** is *not* this couple's projected score — it is a fixed marketing literal representing "everything verified & added." Don't read it as computed.

---

## 8. Clinical constants surfaced in the PDF (verbatim)

Every value below is **`[interim]`** — a house value pending clinical review — unless a real source is cited in code (none are). These flow into a print‑and‑show‑a‑doctor artefact, so they carry more weight than their validation level supports. Their canonical homes are docs 07–09; reproduced here because they render directly into the PDF.

### Report confidence formula (`reportSummary.service.js:315-348`; mirrored in `PRESENTATION_SCHEMA`; hardcoded fallback `pdfReport.service.js:400-412`)

| Component | Value | `[interim]` |
|---|---|---|
| Base confidence | `58` | `[interim]` |
| + blood verified | `+16` | `[interim]` |
| + genetic present | `+11` | `[interim]` |
| + radiology present | `+6` | `[interim]` |
| + mental present | `+5` | `[interim]` |
| Max | `96` | `[interim]` |
| Bands | `≥90` Near‑complete · `≥70` Solid · else Good start | `[interim]` |
| `domains_covered` | base `2` (blood + lifestyle always) + genetic/radiology/mental if present → cover text "Built on {n} of 5 health areas" | `[interim]` |

### Thalassemia carrier (HbA2) — `evaluateThalassemiaCarrierRisk` (`reportSummary.service.js:51-105`)

| Constant / rule | Value | `[interim]` |
|---|---|---|
| `HBA2_BORDERLINE_LOW` | `3.5` | `[interim]` |
| `HBA2_DEFINITE_CARRIER` | `4.0` | `[interim]` |
| `classify(val)` | NaN→`gray`; `>4.0`→`red`; `>3.5`→`yellow`; else `green` | `[interim]` |
| both red → badge | `Discuss with a specialist` | `[interim]` |
| either red → badge | `Worth a look` | `[interim]` |
| either yellow → badge | `Confirm with repeat test` | `[interim]` |
| either gray → badge | `Needs testing` | `[interim]` |
| else → badge | `All clear` | `[interim]` |

Hemoglobin variant (HbS/C/D/E) is **always "Not assessed"** today (WS2‑10 gap) — it is noted informationally on page 4 and never folds into thalassemia severity. The page‑4 card branches on `thal.badge`: `isConfirmedConcern` = badge ∈ {`Discuss with a specialist`, `Worth a look`, `Confirm with repeat test`}; `isUntested` = `Needs testing` (`pdfReport.service.js:820-821`).

### Fertility stars (`reportSummary.service.js:527-542`), from 12‑month conception probability `p12`

| `p12` | Stars | Rating | `[interim]` |
|---|---|---|---|
| (no real score) | `null` | `Not yet assessed` | `[interim]` |
| `< 0.3` | 2 | Requires Guidance | `[interim]` |
| `< 0.5` | 3 | Fair | `[interim]` |
| `< 0.8` | 4 | Very Good | `[interim]` |
| else | 5 | Excellent | `[interim]` |

`annualChance = round(p12*100)` only when a real fertility score exists, else `null`. `p12` itself is `1-(1-p_monthly)^12` upstream (`mfr.controller.js`, doc 07). Page‑3 conception bar fill = `(fp.annualChance||0)/100`.

### Serology classification — **the divergence (WS1D)**

The **centralized** patterns (`reportSummary.service.js:145-147`) — used by `mapPresentation` and shared with `aiPresentation`:

| Pattern | Regex |
|---|---|
| `NEGATIVE_SEROLOGY_PATTERN` | `/\b(?:non[- ]?reactive\|not[- ]?reactive\|not[- ]?detected\|undetected\|negative\|absent)\b/i` |
| `EQUIVOCAL_SEROLOGY_PATTERN` | `/\b(?:equivocal\|indeterminate\|borderline)\b/i` |
| `POSITIVE_SEROLOGY_PATTERN` | `/\b(?:reactive\|positive\|detected\|present)\b/i` |

**But the PDF page‑4 STI panel does NOT use these.** `pdfReport.service.js:761-765` uses its **own cruder local** `isReactive`:

```js
const isReactive = (val) => {
  if (!val) return false;
  const str = String(val).toLowerCase();
  return str.includes('reactive') && !str.includes('non');
};
```

This misses plain `Positive` / `Detected` phrasing and mishandles `Reactive (non-specific)`. On a print‑and‑show artefact, a genuinely positive result phrased as "Positive" would badge **"All clear"**. See WS1D open finding (§10).

### Comparison‑table status heuristics & STI paramKeys (`pdfReport.service.js:645-676`, `:730-734`)

| Rule | Value | `[interim]` |
|---|---|---|
| BP flagged yellow | `sbp > 130 \|\| dbp > 85` (per partner, from `rawValues`) | `[interim]` |
| Waist flagged yellow | manual waist set and `!== 'Normal'` | `[interim]` |
| STI badge | `isReactive` → `Worth a look`, else `All clear` | `[interim]` |
| Syphilis paramKey | `vdrl_rpr_result_reactive_non_reactive` | — |
| HIV 1&2 paramKey | `hiv_1_2_antibody_result_reactive_non_reactive` | — |
| Hep B paramKey | `hbsag_qualitative_result_reactive_non_reactive` | — |
| Hep C paramKey | `anti_hcv_antibody_qualitative_result_reactive_non_reactive` | — |

Verification/upsell figures (page 2: "Verified lab test +16%", "Doctor review +16%"; page 6: Genetic +11%, Radiology +6%, Mental +5%) are **hardcoded literals** that mirror the confidence formula — if the formula changes, these strings do not update automatically.

(For completeness: `pdfReport2.service.js`, dead code, additionally carries `idrsBand` <30 Low / 30–59 Moderate / 60+ High and `bmiBand` <18.5 / <23 / <27.5 / else — all `[interim]`, and unreachable today.)

---

## 9. Operational side effects

- **Streams to disk AND response simultaneously** (`compatibility.controller.js:170-176`): the same stream is piped to `frontend/pdf_reports/SlayHealth_Premarital_Report_{matchId}.pdf` **and** to the HTTP response. A **disk permission/space error can surface mid‑response**, corrupting the download. The on‑disk copies also **accumulate unbounded** — one file per generation, never cleaned up. (`/ai-pdf` writes `SlayHealth_AI_Report_{matchId}.pdf`.)
- **Access token in the query string** (`layout.js:356`): the `/pdf` direct‑link trigger embeds `?token=${getAccessToken()}`, exposing the token to history/referrer/proxy logs. The `story/page.js` trigger does not. (Doc 20.)
- **Radiology 404 handling**: `fetchRadiologyReport` can 404 on a stale `report_id`; it degrades gracefully (recent commit), but the fetched result is mostly unused anyway (§5).

---

## 10. Open findings (see doc 21 for the authoritative list)

Cross‑referenced against `review/ux_WS3_report.md`, `review/WS_REG_regulatory.md`, and `review/WS1D_thal_sti_radiology_composite.md`. (The root‑level `SLAYHEALTH_UX_REVIEW.md`, `SLAYHEALTH_DEEP_REVIEW.md`, and `REG-06_DPDP_SUBSTANTIATION_AUDIT.md` also exist in the working tree and summarize these.)

| ID | Sev | Status | One‑line |
|---|---|---|---|
| **UX3‑02** | P0 | **OPEN** | Cover + page‑6 print **Excellent / green** for a couple whose only severe finding is a confirmed carrier overlap or reactive STI. `hasHealthFlag` (`pdfReport.service.js:426-436`) scans only `body_health`, never `sti_gate.triggered` or `carrier_pair_risk` red. Upstream cause: `coupleStatus` defaults to `Excellent` whenever a score exists (`reportSummary.service.js:354`). Page‑6 "Strong" genetic badge (`:965`) is driven purely by data *coverage*, not by whether the result was good or catastrophic. On a printed artefact this is the highest‑stakes bug in the subsystem. |
| **UX3‑06** | P1 | **OPEN** | Comparison table (`:645-676`) defaults absent domains to `male_status||'green'` + value `||'Normal'`, and `getBadgeLabel` then renders **`HEALTHY`** — so "Liver / Kidney / Hormonal / Vitamins / Waist = Not tested" each sit next to a green "HEALTHY" badge. Fabricate‑a‑default shape (cf. engine finding WS1D01). |
| **WS1D serology** | — | **OPEN** | PDF's local `isReactive` (`:761-765`) diverges from the centralized serology patterns; misses `Positive`/`Detected`. Recommendation: one shared `isReactivePositive` helper reused across `reportSummary`, `aiPresentation`, and the renderer. |
| **REG‑02** | P1 | **OPEN (needs counsel)** | The PDF surfaces **diagnostic‑grade outputs** — 12‑month conception probability, STI reactive status, thalassemia carrier risk with genetic‑counselor referral language — with **no "not a diagnosis / consult a clinician" disclaimer** anywhere. The only footnote (`:716-718`) is a technical note about age‑graded baselines. This is a regulatory posture question (plausible CDSCO SaMD scope), an **open risk pending legal/clinical counsel — not a code fix to make unilaterally**. If/when a disclaimer is added, the buffered footer loop (`:1019-1035`) is the one place it reaches every page; the fertility/STI/genetic cards are where per‑finding qualifiers would go. Keep existing "confirm with your doctor" framing intact. |
| **UX3‑12** | P3 | **OPEN** | "Strong" / "Confidence in the good news" labels are overloaded across pages 1/2/6 — mixing a data‑completeness meaning with a good‑result meaning. |
| **UX3‑03** | P0 | **FIXED (verify)** | Genetic card previously couldn't distinguish "never tested" (gray) from "confirmed risk" (red) and leaked raw `RED`/`GRAY` tokens. Rewritten (`:810-853`, in‑code comment cites UX3‑03) to branch on `thal.badge`. Confirm with a fresh render of a gray/gray and a red/red couple. |

Plus the debt items: the **orphan `pdfReport2.service.js`** (decide wire‑vs‑delete), the **unlinked `/ai-pdf` endpoint** (+ its duplicated confidence math + DeepSeek cost), the **unused radiology fetch**, the **unbounded `pdf_reports/` disk writes**, and the **large volume of hardcoded per‑couple copy** on pages 2/5/6.

---

*Next: `14_frontend_core_state_and_app_shell.md` — the `CompatibilityContext` store, `apiFetch`, draft hydration, and app shell that drive the button you just followed into this PDF.*
