# Known Issues & Roadmap

**Doc 21 of 22** · Audience: a solo full‑stack successor · Prerequisite: `00_index.md`, `20_security_posture.md` (and keep this doc open alongside whichever engine/frontend doc you're working in).

Goal of this doc: this is the **authoritative ledger** of what's still broken and what's planned. Every other doc ends with a short "Open items" tail that *points here*; this file consolidates the whole still‑open backlog grouped by severity, lists what is **already fixed** so you don't re‑report it and what is **confirmed‑correct** so you don't "fix" working code, states the DPDP/regulatory posture factually, and keeps the ideation roadmap separate from the defect backlog.

---

## 1. About the finding‑IDs (WSxx / UXxx / OPP‑*)

Before this handoff the codebase went through an internal engineering review, a UX review, and one regulatory sub‑audit. Each produced stable, uniquely‑IDed findings, and dated remediation passes then crossed them off **by ID**. **That review corpus has since been actioned and removed from the repo.** The finding‑IDs you still see in code comments and throughout docs 01–20 — `WSxx` (engine), `UXxx` (UX), `OPP‑*` (ideation opportunities), `REG‑xx` (regulatory) — are therefore **historical breadcrumbs, not files**: you cannot open them, and you should treat them as stable labels for the issues catalogued below, not as pointers to a document. The two reviews used **different** P0–P3 severity scales, so the "Sev" column below is always "each review's own scale" — don't conflate a UX P1 with an engine P1 when triaging.

The **one surviving review artifact** is `REG-06_DPDP_SUBSTANTIATION_AUDIT.md` at the repo root — a code‑grounded DPDP Act 2023 / Rules 2025 posture across 7 principles, whose findings are **still open** (see §6). It is **not** a compliance plan and **not** user‑facing copy. Keep and reference it.

Current state is exactly what this ledger records below: the still‑open backlog (§2), the already‑fixed items you should not re‑report (§4), the confirmed‑correct code you should not "fix" (§5), the regulatory posture (§6), and the roadmap (§7). Anything committed after the last remediation pass — including the uncommitted `M frontend/src/constants/mentalHealthQuestions.js` in the working tree — has no note of its own; verify it against `git log` and the code directly, never off memory.

---

## 2. The consolidated STILL‑OPEN Known‑Issues table

This is the backlog — the still‑open issues after every remediation pass. Grouped by severity within each track. "Sev" uses each review's own scale.

### 2a. Deep‑Review engine backlog (P0/P1 are 100% closed — see §4)

| ID | Sev | Title | Anchor | Why still open |
|---|---|---|---|---|
| `WS8-03` | P2 (L) | **Systemic fabrication‑on‑absence.** The proposed single unified `not_assessed` state threaded through all 3 engines + composite was never built; only piecemeal per‑field fixes landed | composite `reportGeneration.service.js:117-134` | Needs a cross‑engine contract, not a local patch (theme, §3) |
| `WS8-01` | P2 (M) | Report `/core-engine/*` pages are **context‑only** — hard nav/refresh/deep‑link bounces to `/dashboard`; blocks any shareable report URL. Also surfaces as `UX2-09` | `app/core-engine/*` route guards | Architectural: report state lives only in `CompatibilityContext`, never hydrated from a URL |
| `WS1D05`/`WS1D06`/`WS3A05` | P2 (M) | Thalassemia **HbA2 > 3.5% is a hard carrier binary** `[interim]`; no 3.5–4.0% borderline band; an untested partner is scored a non‑carrier; MCV/HPLC context ignored | genetics scorer (genScore 100/75/50 `[interim]`) | No borderline band or "unknown" state designed |
| `WS3B04`/`WS3B05` | P2 (L) | **All likelihood ratios / constants are unsourced.** IDRS→LR `1.82 / 1.1 / 0.46` `[interim]`, baseline odds `ODDS_0`, ageing drift, diabetic cap all hardcoded with zero provenance | `controllers/chronic.controller.js:130` (`if (idrs >= 60) return 1.82`) and the `idrsToLR` function | The versioned/dated `clinicalConstants` module (`OPP-W4-15`) was never built |
| `WS3B12` | P2 (M) | DEXA reads **T‑score as primary for a premenopausal cohort**; ISCD 2023 wants Z‑score there; Z‑score is extracted but unused `[interim]` | `dexa.score.js` | Population‑appropriateness call pending clinical review |
| `WS1A09` | P2 (M) | "10‑year projection" is a **fixed `1.05^y` curve identical for everyone** `[interim]` | `controllers/chronic.controller.js` projection loop (~L391–407) | No per‑person drift model designed |
| `WS3A02` | P2 (M) | **AMH ovarian‑reserve cutoffs uncited** `[interim]`; ASRM/POSEIDON diminished‑reserve thresholds absent | fertility engine (doc 07) | Needs sourced thresholds |
| `WS1C02` | P2 (M) | Big Five monotonic scoring — **LIKELY RESOLVED** by the mental v2.0 peaked‑scale change (07‑17) but never explicitly reconciled against this ID | `mentalHealthQuestions.js` | **VERIFY & close** — do not re‑implement blind |
| `WS1A06` | P3 | IDRS→LR step‑function **score cliffs at IDRS 30/60**; smoothing deliberately deferred (only P3 explicitly left out) | `chronic.controller.js:130` | Intentional deferral |
| `WS1C08` | P3 | **DAST drug‑use item + ACE/"Personal Background" section never built** — 07‑16 only documented it as a tracked gap; the Risk pillar is still alcohol‑only in structure | mental engine (doc 08) | Feature not built; documented only |
| `WS2-09` | P3 | Pathology **rejects image (jpg/png) lab reports** though OCR.space + `ocrProvider` support images | doc 06 | Real still‑open UX gap |

### 2b. UX‑Review backlog (all 11 P0 closed — see §4; 27 P1 declared "unstarted" 07‑16, only incidentally touched later)

| ID | Sev | Title | Anchor | Note |
|---|---|---|---|---|
| `UX3-04` | P1 | The single most severe Tracked‑Markers finding is styled **identically to a routine caution** (severity‑blind styling — theme §3) | — | |
| `UX3-05` | P1 | **"Trigger Mock Report" debug affordance ungated inside the live report** — injects fabricated radiology into real records (`OPP-UX-04`, also doc 03 §10) | `app/usg/page.js` | Gate behind `NODE_ENV`/flag or remove |
| `UX3-06` | P1 | PDF side‑by‑side comparison table marks **untested parameters "HEALTHY"** | doc 13 | Fabrication‑on‑absence (theme §3) |
| `UX9-02` | P1 | Double‑carrier genetic finding disclosed as **raw status codes**, no plain‑language translation/child‑risk figure | — | Same PDF card as fixed `UX3-03` — **VERIFY** partial resolution |
| `UX9-04` | P1 | Chronic‑Risk tab exposes an **internal QA/calibration panel** incl. a button literally labelled "(Demo)" in the paid report | — | Raw internals leaking (theme §3) |
| `UX7-02` | P1 | Upload failures always show a **generic hardcoded string**, discarding the backend's real reason | — | |
| `UX7-03`/`UX10-01` | P1 | Match generation shows an **8.4 s fake‑progress animation over a real ~53.2 s wait** — the review's highest‑confidence, triple‑converged finding; drop‑off risk | — | See doc 10 |
| `UX7-04` | P1 | Chat AI **"Retry" doesn't retry**, and a failed reply still **burns free quota** | doc 11 | |
| `UX10-02` | P1 | PDF upload gives **no spinner/progress** and doesn't disable the button during a ~40 s worst case | — | |
| `UX8-04` | P1 | Invited‑partner mental‑health **"Skip this section" control set on the step object but never wired** to the component | — | |
| `UX8-06` | P1 | **No UI tells the account holder they're the custodian** of a third party's sensitive data | — | Finding #0 (§6) |
| `UX8-07` | P1 | "Privacy & data" profile row is a **dead end** dressed as a real settings destination | — | Dead affordance (theme §3) |
| `UX8-08` | P1 | REG‑03 "Doctor Reviewed" fix **didn't fully propagate** — an unfixed sibling badge is still live | doc 20 | |
| `UX6-03` | P1 | Closed report chat drawer still **intercepts off‑screen keyboard‑Tab stops** | — | |
| `UX6-04` | P1 | **Systemic missing programmatic label association** across every wizard field | — | a11y |
| `UX6-05` | P1 | USG "Organ Health Status" conveyed purely by an **8px dot's colour** (WCAG 1.4.1) | — | |
| `UX4-01` | P1 | **"Brand teal" is three different greens**; two parallel token systems | doc 18 | |
| `UX4-07`/`08`/`09` | P1 | Desktop dashboard/KPI/profile are a **separately‑authored design, not a responsive reflow** — permanent structural lag until componentized | doc 17 | Desktop‑lags‑mobile (theme §3) |
| `UX5-01` | P1 | **768–1023px breakpoint dead‑zone**: desktop tree renders under the mobile bottom nav | doc 17 | |
| `UX2-09` | P1 | Refreshing inside the report drops the user on the public marketing landing (= `WS8-01`) | — | Same root as WS8-01 |

**UX P1 — LIKELY RESOLVED by later work, VERIFY before touching:** `UX6-02` (hamburger/slider a11y, fixed 07‑16 P0 batch); `UX2-03` (Stress‑Resilience results page, 07‑20); `UX2-05`/`UX2-06` (dual nav / no current‑tab, mobile report nav overhaul 07‑20); `UX3-07` (nothing prompts asking the AI → Suggested Questions, 07‑20); `UX7-05` (invite state wiped by reload, shares root with fixed `UX8-03`).

### 2c. UX P2/P3 (~45 P2 + ~15 P3, mostly open) — notable clusters

| Cluster | IDs | One line |
|---|---|---|
| Dead "get help" affordances | `UX2-02`, `UX7-10`, `UX9-08` | Contact Support / Support buttons do nothing — **no working path to human help anywhere** |
| Genomics stub | `UX2-01` / `OPP-UX-29` | "Coming Soon" with an unwired "Notify me" pill |
| Dead dark mode | `UX4-04` | Mobile shell's dark palette authored but dead (doc 18) |
| Buried disclaimer | `UX8-10` | "Not a diagnosis" + DPDP line are the smallest/lowest‑contrast/worst‑placed text on their screens |
| Consent burden | `UX8-11` | A 33‑step one‑sitting questionnaire is a heavy ask for someone who may feel pressured into consenting |
| Silent personalization miss | `UX8-13` | Per‑question trust message never fires (title‑key mismatch) |
| Backend isolation | `UX10-03` (suspected) | PDF text extraction blocks the single‑threaded backend (no isolation/timeout) |
| Chat timeout | `UX10-05` | AI chat has no client‑side timeout; ~90 s worst‑case silence before failure (doc 11) |
| Fake gate | `UX1-08` | Radiology "Locked · ₹999" badge doesn't actually gate once opened |
| Naming drift | `UX2-04`, `UX9-06`, `UX9-03` | One report artifact has 5+ names; the core CTA has 5+ phrasings; "Prospect"→"Partner" globally renamed 07‑17 |

### 2d. Non‑roadmap open bugs (surfaced in remediation passes, not in either review index)

| Bug | Source | State |
|---|---|---|
| **Sleep LR‑key mismatch** — a lifestyle answer silently scoring risk‑neutral because the `LIFESTYLE_LRS.sleep` key never matches the frontend value; same class as the fixed alcohol/smoking bugs | 07‑17 verification note | Flagged in a **code comment**, NOT fixed. Real production scoring gap (doc 07) |
| **Refresh‑token rotation race** — the backend hard rotate‑and‑revokes the refresh token on every `/api/auth/refresh` with **no grace window**; two‑tab / separate‑context concurrent refresh can still spuriously log the user out. The 07‑22 single‑flight (`refreshAuthSession()` in `api.js`) only coalesces within one context | 07‑22 session‑resilience pass | Frontend mitigated; **backend fix flagged, not done** — needs a security‑reviewed server‑side rotation‑family grace (doc 04, doc 20) |

---

## 3. Cross‑cutting themes = the efficient fix strategy

These share root causes: fixing the theme once retires many open IDs. Fix at the theme level, not per‑symptom.

| Theme | Retires | The one fix |
|---|---|---|
| **Fabrication‑on‑absence** | `WS8-03`, `UX3-06`, `UX9-02`, parts of the composite | A single unified `not_assessed` state threaded through all 3 engines + composite (`reportGeneration.service.js:117-134`), so an unimaged/untested/unanswered domain renders "not assessed", never a fabricated "Normal"/"HEALTHY"/93.7% |
| **Unsourced constants** | `WS3B04`, `WS3B05`, `WS1A09`, and every `[interim]` tag in docs 07–09 | Build the versioned/dated `clinicalConstants` module (`OPP-W4-15`): one home for every LR/threshold/band with a `source` field. Until then, treat all engine numbers as `[interim]` |
| **Raw internals leaking to users** | `UX9-02`, `UX9-04`, `UX3-06` | A presentation layer that never renders internal status codes / QA panels / "(Demo)" buttons in the paid report |
| **Severity‑blind status** | `UX3-04`, `UX6-05` | A single severity→style map so the worst finding never looks like a routine caution and status is never colour‑only |
| **Dead help affordances** | `UX2-02`, `UX7-10`, `UX8-07`, `UX9-08` | One real support destination (WhatsApp support number already exists — `WHATSAPP_SUPPORT_NUMBER`) wired to every "Support"/"Privacy & data" control |
| **Desktop lags mobile** | `UX4-07/08/09`, `UX5-01`, `UX2-09` | Componentize the mobile report/dashboard and reflow desktop **to** it (mobile is the locked reference — doc 16, doc 17), rather than maintaining a second hand‑authored desktop design |
| **Session/refresh races** | refresh‑token rotation race, `UX7-05` | Server‑side rotation‑family grace window + draft‑survives‑logout (frontend half shipped 07‑22) |

---

## 4. Already fixed — do NOT re‑report

These are closed. If you "discover" one, you're re‑deriving from an older note without accounting for the remediation pass that already shipped the fix. Verify against `git log` and the code before re‑opening.

| Batch | Count | Closed in |
|---|---|---|
| **Deep‑Review P0** | 6/6 | 07‑15 pass |
| **Deep‑Review P1** | 17/17 | 07‑15 pass |
| **Deep‑Review P2** | 15 of 24 | 07‑15 pass (9 remain → §2a) |
| **Deep‑Review P3** | 6 of 8 | 07‑16 pass (`WS1A06`, `WS1C08` remain; `WS2-09` also open → §2a) |
| **UX P0** | 11/11 | 07‑16 pass (with commit hashes) |
| **Regulatory REG‑01/02/03/04/05/07** | 6 | 07‑15/16 passes (REG‑06 remains → §6) |

Representative closed fixes so you recognize them in the code and don't re‑file: `classifySerologyResult()` replacing 5 STI regex pairs (`reportSummary.service.js:149`); organ scorers returning `null` when unimaged; `detectGlucoseCategory` reading HbA1c+FBG; `shrinkCorrelatedLRs()`; SI unit conversions + `stripValueNoise()`; the `isUserMale === 'male'` always‑false bug and the `parentDiabetes` hardcoded‑false bug (both non‑roadmap, found 07‑15); the two lifestyle scoring bugs (alcohol + smoking silently risk‑neutral, 07‑17); the mental v2.0 rewrite 21→27 items (07‑17); the `handleCompatibilityMatch` hardcoded `semenQuality:'Normal'`/`ovarianReserve:'Normal'` override of real pathology (07‑20, commit `aa7062d`); the DEXA boundary bug `< -2.5` → `<= -2.5` (07‑16, `WS3B11`); legal marriage age 18F/21M (`legalMarriageAge.js`, 07‑16); single‑flight `refreshAuthSession()` + draft‑survives‑logout (07‑22).

---

## 5. Confirmed‑correct — do NOT touch

These were **investigated and found correct**. They are recorded here specifically so you don't "fix" working code. Several look like bugs.

| ID | What it is | Why it's correct |
|---|---|---|
| `WS0-01` | Composite renormalization | Weighted mean over **present** domains, re‑normalized; proven with `probe_composite_sti.js` |
| `WS0-06` / `WS1B01` | MFR absolute‑barrier gate | A blocking barrier cannot be diluted by a healthy partner — non‑leak proven |
| `WS1D09` | STI cap arithmetic + single score writer | The gate caps correctly and only one place writes the score (`computeGatedComposite`) |
| `WS3A01` | Semen reference limits | **Match WHO 6th ed 2021** (cited source, not `[interim]`) |
| `WS3B03` | IDRS bands | Match MDRF |
| `WS3B06` | HbA1c thresholds (6.5 / 5.7) | Match ADA Diabetes Care 2026;49(Suppl 1):S27 (cited source) |
| `WS3B07` | BP thresholds for India | Correct |
| `WS8-02` | Engines are auth‑gated | Correct — the clinical engine routes require a token |
| `WS1C10` | Mental item ordering | Correct |
| `WS2-06` | STI "Non‑Reactive" spelling | Correct |
| `WS6-06` | Chronic/MFR chart fallbacks (`?? 85` / `?? 15` / `|| 80`) | **Structurally unreachable** — looks like a fabricated‑fallback bug but the code path can't be hit |

---

## 6. DPDP / regulatory posture (REG‑06)

Read `REG-06_DPDP_SUBSTANTIATION_AUDIT.md` in full before touching anything consent‑ or claim‑related. Its hard rules and factual findings:

**Rule 1 — do not publish the audit to users.** It is a code‑grounded inventory, **not** a compliance plan and **not** user‑facing copy. Describing what code does today is not a legally binding compliance representation. Any user‑facing DPDP/compliance claim needs counsel first.

**Rule 2 — take no position on wellness‑vs‑SaMD.** These docs document the gap factually and add no clinical authority the product hasn't earned. Keep every "confirm with a qualified doctor" framing intact. REG‑02 added a disclaimer; the **SaMD positioning is a legal track, not a code fix** and remains open.

Of the 7 DPDP principles, only **2 have real, working, non‑trivial code**; **5 are unbuilt**:

| Principle | Status | Anchor |
|---|---|---|
| Informed itemised consent (invited partner) | **Coded** — itemised consent screen; acceptance recorded with timestamp+IP+user‑agent | `app/invite/[token]/page.js:299-336`; `invite.controller.js:280-291` |
| Erasure (account holder) | **Coded** — real `DELETE /api/auth/account` deletes own reports/chats/user row; matches & invites cascade | `auth.controller.js:393-430`; `postgres.service.js:56-65,150-165` |
| Erasure (**invited partner**) | **GAP** — partner is an `ON DELETE SET NULL` placeholder row; deleting the account **orphans** rather than erases the partner's data, and the partner has no self‑service deletion path. The audit's single most concrete, fixable finding | REG‑06 §3 |
| Purpose limitation / minimisation | **Unbuilt** — third‑party LLM/OCR calls (OpenRouter, OCR.space) undisclosed to either party | REG‑06 §2 |
| Retention / storage limitation | **Unbuilt** — no retention policy or scheduled deletion; health records persist indefinitely | REG‑06 §4 |
| Breach notification | **Unbuilt** — no detection/notification mechanism | REG‑06 §6 |
| Grievance redressal / nomination | **Unbuilt** — not found | REG‑06 §3 |
| Children's data / verifiable parental consent | **Unbuilt** — the landing "Concerned Parents" persona markets sharing a child's data with no age‑gate | REG‑06 §7; `landingContent.js:209-219` |

**Where the account‑holder's own itemised consent is missing:** there is no equivalent disclosure at signup (`app/onboarding`) or first data entry (`app/add-prospect`) — the inviter enters their own clinical data with no comparable notice.

The one item worth a **product decision soon** (not gated on full legal sign‑off): close the **partner‑erasure gap** — a real deletion path for the partner placeholder row. Everything else waits for counsel against the DPDP Rules 2025 phase‑in (through 2027‑05‑13). See also doc 20.

---

## 7. The ideation roadmap — kept separate from defects

Ideation (`OPP-*`) is **future value**, not broken behavior. Never let it leak into the defect backlog — a P2 you must fix and an OPP you might build are different currencies.

| Index | Count | What it proposes |
|---|---|---|
| `OPP-W4-01..25` | 25 | Feed **already‑extracted‑but‑unused** params (eGFR, TC:HDL, MCV/RDW, ferritin, Hb variants, rubella IgG, uric acid) into scoring; the versioned `clinicalConstants` module (`OPP-W4-15`); STI screening→confirmatory model (`OPP-W4-25`) |
| `OPP-W5-01..16` | 16 | Entirely‑new engines: Rh/HDN, rubella immunity, pre‑conception nutrition/anemia/thyroid/glycemic, hemoglobinopathy, consanguinity, expanded carrier panel, teratogen check |
| `OPP-W7-01..20` | 20 | Surface the computed‑but‑PDF‑only AI narrative/STI‑gate in the web report; gate the interactive index; scenario toggles; private‑first sensitive‑finding reveal; confidence‑uplift ladder; 90‑day recompute |
| `OPP-UX-01..31` | 31 | Onboarding, report KPI hierarchy, trust/consent, delight, retention, first‑run/genomics |

Two structural insights to carry:

- **★ items also close a P0/P1.** `OPP-W4-01` (FBG into the diabetic gate) landed via `WS1A03`. `OPP-W5-05` (hemoglobinopathy) would close `WS2-10`. `OPP-W7-01/02` became `UX3-01`/the gate fix (landed 07‑16). `OPP-UX-16` (a real **partner‑facing view** of their own results) is the durable fix for `UX8-02` and is **not built** — so the Finding #0 asymmetric‑account trust gap persists behind a copy‑only P0 patch. `OPP-W4-15` (the constants module) not being built is exactly why `WS3B04/05` are still open.
- **Extracted‑but‑unused params.** Many biomarkers the extraction pipeline already parses feed **zero** scoring path today (eGFR, TC:HDL, MCV/RDW, ferritin, Hb variants, rubella IgG, uric acid). That's the cheapest value on the board — the data is already in the report row.

**Claim‑risk watch items** flagged by the ideation itself: `OPP-W5-14` (teratogen check) is the highest SaMD/legal exposure of any proposal; `OPP-W5-08/14/16` all carry claim risk. Don't build these without the regulatory decision in §6.

---

## 8. Environment / onboarding gotchas you'll trip on immediately

| Gotcha | Reality |
|---|---|
| Reproduction evidence off‑disk | Probe scripts + UX screenshots live under **gitignored** `backend/scratch/` and are not in the repo. |
| Mental spec docs off‑disk | `contexts/mental_questionnaire_research_backing.md` and `contexts/mental_health_engine_update.md` are gitignored local‑only. Doc 08 uses acceptance tests as ground truth. Ask the owner. |
| `npm test` is a stub | It exits 1 (`echo "Error: no test specified" && exit 1`). No CI, no frontend tests. Run suites **individually**: `node backend/tests/parser.test.js`, `node backend/__tests__/<name>.test.js` (`sti-gate-ontology-binding`, `lifestyle-lr-mapping`, `mental-engine-v2`, `usg-scoring`). `node --test <dir>` throws MODULE_NOT_FOUND. (Doc 19.) |
| Context‑only report pages | `/core-engine/*` bounce to `/dashboard` on hard nav/refresh/deep‑link (`WS8-01`, open). Reach a report by landing on `/dashboard` and clicking the Recent‑match card — you cannot deep‑link one for testing. |
| Drifted ports | During the review the frontend ran on **:3010** (`:3000` hosted an unrelated "raindeer" project on the review machine); the 07‑22 pass says frontend **:3000**. Confirm live before trusting any doc's port. |
| Drifted LLM key | The OpenRouter key was **dead (401)** during the review (AI fell back to templates); it was evidently working again by 07‑20 (Suggested Questions relies on it). Confirm live. (Doc 03, doc 11.) |
| Post‑07‑22 uncovered changes | Commits after the last remediation pass and the uncommitted `M frontend/src/constants/mentalHealthQuestions.js` have **no note** — verify against `git log`/the file directly. |
| The `/db` admin route | `/db` is **not** an open/unauthenticated door — `backend/src/routes/db.routes.js:8` does `router.use(authenticateToken)`. It is an **authorization** gap: any *logged‑in* user can CRUD any table row (`GET/PUT/DELETE /api/db/tables/:tableName/:id`, lines 10–13). The decided direction (doc 17) is to **re‑home `/db` behind the `ADMIN_PHONE_NUMBERS` allowlist** and **delete the duplicate legacy engine pages** (`/chronic`, `/mfr`, `/usg`) — a separate code change, not yet done. Frame it as an authZ gap, not an open door. (Doc 20.) |

---

## 9. How to keep this doc current

This is the ledger; keep it honest with one convention:

- **When you fix something, record it by ID** in a dated note and move the row out of §2 into §4. The ID is the join key — prose drifts, IDs don't.
- **When you confirm a "likely resolved" item** (`WS1C02`, `UX9-02`, the VERIFY batch in §2b), either close it into §4 or restate why it's still open. Don't leave "VERIFY" rotting.
- **When you find something new**, mint an ID in the same grammar (`WSxx` / `UXxx` / `OPP-*`), not free prose, and slot it into §2 with a `file:line` anchor and a "why open" clause.
- **Never** promote an `OPP-*` ideation item into the defect table without a real severity — keep §7 and §2 as separate currencies.
- Re‑derive current state from the code, not from memory: this ledger minus every shipped fix minus any post‑pass commit. If a claim can't survive that check against `git log` and the code, it's stale.

---

## Open items (this doc **is** the authoritative list)

The biggest still‑open findings, as pointers:

- **Fabrication‑on‑absence** (`WS8-03`, `UX3-06`) — the unified `not_assessed` state is the single highest‑leverage engine fix and is unbuilt.
- **Unsourced clinical constants** (`WS3B04/05`, `OPP-W4-15`) — every engine number is `[interim]` until the versioned `clinicalConstants` module exists.
- **Partner‑erasure gap** (REG‑06 §3) — the most concrete DPDP fix; and the broader SaMD positioning question stays open pending counsel.
- **Refresh‑token rotation race** (07‑22) — frontend mitigated, backend grace window flagged‑not‑done; needs a security review.
- **`/db` authZ + legacy engine pages** — re‑home `/db` behind `ADMIN_PHONE_NUMBERS` and delete `/chronic`,`/mfr`,`/usg` (doc 17); an authorization gap, not an open door.

---

*This is the last doc in the set. Loop back to `00_index.md` for the reading map, and keep this ledger open in every session — every other doc's "Open items" tail points here, and here is where you record what you close.*
