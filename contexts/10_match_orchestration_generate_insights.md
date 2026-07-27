# Match Orchestration — "Generate Insights" End-to-End

**Doc 10 of 22** · Audience: a solo full‑stack successor · Prerequisite: `07_medical_engines_chronic_and_fertility.md`, `09_composite_scoring_sti_gate_and_genetics.md`.

Goal of this doc: trace the product's core value moment — the **"Generate Insights"** button — from the frontend click all the way to the persisted `matches` row, and show how the engines (docs 07–08), the gated composite + STI gate + genetics (doc 09), storage (doc 05), and the LLM (doc 11) are stitched together. This is the doc that ties the clinical block into one flow. Read it after you understand the engines and the composite, because this is where they meet.

---

## 1. The whole flow on one page

The user has already uploaded both partners' pathology PDFs and filled the add‑prospect wizard (docs 06, 15). Pressing **Generate Insights** runs this exact sequence:

```
FRONTEND  CompatibilityContext.handleCompatibilityMatch (CompatibilityContext.js:580)
  │  validate inputs (both reports present + 12 prospectForm fields)
  │  derive isUserMale → slot the two uploads into male/female
  ▼
  ├─ Promise.all ────────────────────────────────────────────────┐
  │   POST /api/chronic/analyze        POST /api/mfr/analyze      │  (parallel; doc 07)
  └───────────────────────────────────────────────────────────────┘
  │  cData, mData
  ▼
  POST /api/compatibility/save-match  ── ~53 s synchronous wait ──►
                                                                  │
BACKEND  compatibility.controller.saveMatch (compatibility.controller.js:12)
  │  mint matchId = uuidv4(); resolve male/female report ids + names
  ▼
  reportGeneration.compileMatchReport (reportGeneration.service.js:209)
    ├─ computeGatedComposite (reportGeneration.service.js:45)   ◄── THE single score
    │    ├─ _fetchRadiologyScore  (by NAME, /30*100)
    │    ├─ evaluateThalassemiaCarrierRisk → genScore (100/75/50)
    │    ├─ weighted blend over PRESENT domains (35/25/20/10/10)
    │    ├─ critical-domain floor (worst<30 → cap worst+20)
    │    ├─ STI gate → min(score,50)
    │    └─ reportSummary.mapPresentation → presentation JSON
    ├─ assemble analysis_json  (score, chronic, mfr, mental=null, details{…})
    ├─ narrative.generateNarratives  ── DeepSeek prose  ── (inline, slow)
    └─ UPSERT matches row (status='completed')
  ▼
  { success, match_id }  →  frontend setActiveMatchId, fetchActiveMatchDetails
                            router.push('/core-engine/story')

LATER (optional)  POST /api/mental/analyze  { …, match_id }
  mental.controller.analyzeMental (mental.controller.js:496)
    computeMentalResult → merge into analysis_json
    RE-RUN computeGatedComposite  ← same gated path, now with mental
    UPDATE matches SET analysis_json, compatibility_score, presentation_json
```

The single most important structural fact: **`computeGatedComposite` is the only function that ever writes a compatibility score.** It runs at save‑match and again at the mental recompute. Nothing else — not a display component, not the AI‑PDF path — is allowed to derive a score, or the DB column and the presentation JSON drift apart. That was a real bug the current design closed (WS1D09).

---

## 2. Frontend input derivation (`CompatibilityContext.handleCompatibilityMatch`)

`frontend/src/contexts/CompatibilityContext.js:580`. Everything here is client‑side prep before the network calls.

### 2.1 The two guards

| Guard | Code | Behavior on failure |
|---|---|---|
| Both pathology reports uploaded | `CompatibilityContext.js:581` | `toast.error(...)`, return (no `matchError` set) |
| 12 required `prospectForm` fields | `CompatibilityContext.js:586‑603` | `setMatchError("Please fill in the following columns…")`, return |

The 12 fields collected into `missing[]` (`:587‑598`): Partner's Name, DOB, City, Activity Level, Drinking habits, Smoking & Tobacco habits, Sleep cycle, Height, Weight, Waist size, "How you met" (`meetingSource`), and — conditionally — Matrimonial platform name when `meetingSource === 'Matrimonial Platform'`. A missing field aborts before any network call, so you never get a half‑built match.

### 2.2 `isUserMale` — the case‑insensitive slotting (read this twice)

```js
const isUserMale = selfUser.gender?.toLowerCase() === 'male';   // :623
```

This one boolean decides **which uploaded report becomes `male_report_id` vs `female_report_id`** and **which manual data becomes `maleManual` vs `femaleManual`**. The `.toLowerCase()` is load‑bearing, not stylistic: the real gender picker stores capitalized `'Male'`/`'Female'` (from `lifestyleOptions.js`), and `auth.controller.js`'s `updateProfile` never normalizes it. The original code did a bare `=== 'male'`, which was **always false for every real user**, silently swapping both partners' report and manual‑data slots into the wrong sex‑specific engine path for every match created through the live UI. If you ever see scores that look sex‑transposed, this is the first line to check.

The same fix exists in `restoreMatchSession` (`:850`) — keep both in sync.

### 2.3 Manual data + shared lifestyle mapping

`maleManual` / `femaleManual` (`:624‑665`) are built by picking `selfUser` vs `prospectForm` according to `isUserMale`:

| Field | Source | Notes |
|---|---|---|
| `name` | user or prospect | |
| `age` | `calculateAge(dob)` (`:137`) | **Only derived age is persisted, never the raw DOB** — see §10 |
| `bmi` | `userBmi` / `prospectBmi` computed at `:609‑614` | `weight / (height/100)²`, defaults 70 kg / 170 cm |
| `waist` | `classifyWaist(waist, 'male'\|'female')` (`:163`) | sex‑specific waist band |
| `bloodPressure` / `glucose` / `lipids` | literal `'Normal'` | the real values come from the parsed pathology on the backend; these are placeholders the chronic engine overrides |
| `history.parentDiabetes` | `selfUser.parentDiabetes` / `prospectForm.parentDiabetes` `\|\| 'None'` | WS1A04/WS3B01 fix — was hardcoded `false` regardless of the wizard answer |

`sharedLifestyle` (`:673‑691`) collapses both partners' wizard answers into a single couple‑level object (`diet`, `activity`, `smoking`, `alcohol`, `sleep`, `stress`). Two gotchas baked in as comments:
- The alcohol key is `alcohol`, not `drinking` — `chronic.controller.js`'s `getEffectiveLifestyleLR` reads `shared_lifestyle_data?.alcohol`; the old `drinking` key was never read (`:681‑688`).
- Values must be real `LIFESTYLE_LRS` keys: `'Occasionally'` not the now‑dead `'Occasional'`; `'Never'` not lowercase `'never'` (`:676‑680`). If you rename a lifestyle enum in the engine, this mapping breaks silently — the value just stops matching and the LR falls to neutral.

### 2.4 The two engine calls (parallel) and the MFR omission

`Promise.all` of `POST /api/chronic/analyze` and `POST /api/mfr/analyze` (`:694‑749`). Both receive the same `male_report_id`/`female_report_id` (slotted by `isUserMale`), the manual data, and `match_id: activeMatchId`.

The **deliberate MFR omission** (`:713‑731`): the MFR call sends only `{ name, age }` for each partner and **does not send `semenQuality` / `ovarianReserve`**. This is intentional. `mfr.controller.js` resolves those as `male_manual_data.semenQuality || calculatedSemen?.category || 'Not Assessed'` — manual data is checked *first*, so a hardcoded `'Normal'` would always beat the real classification the backend computes from this couple's actual uploaded pathology. Omitting the fields lets the real per‑couple classification (or an honest `'Not Assessed'`) win. **Do not "helpfully" add these fields back to the payload** — you'd re‑introduce the exact bug the comment is warning about.

### 2.5 Error handling on the engine responses

| Condition | Code | User sees |
|---|---|---|
| `chronicResponse.status === 403` | `:751` | "Quota exceeded… 1 free compatibility match run…" (doc 04) |
| `404` + `/report not found/i` | `:766‑778` | Clears the stale side's report (`setUserReport(null)`/`setProspectReport(null)`) and asks the user to re‑upload |
| any other non‑ok | `:779` | "Clinical engines evaluation failed." |

The 404 path is subtle and worth understanding: because the profile draft (`slayhealth_profile_draft_<uid>`) survives logout (doc 14), a `report_id` persisted in the draft can outlive the report itself on the server. Rather than dead‑ending, the code maps the missing side (male/female, from the error string) back to whose report it is via `isUserMale` (`:771‑772`) and clears exactly that side so the Pathology step resets to "upload".

### 2.6 save‑match and post‑success

On both engines OK, `POST /api/compatibility/save-match` (`:788‑799`) sends `{ userId, chronicResult, mfrResult, maleManual, femaleManual, maleReportId, femaleReportId }`. **Note `mentalResult` is NOT in this payload** — mental is layered on later (§4). On `{ success, match_id }`: `setActiveMatchId`, `fetchActiveMatchDetails`, then `setChronicResult`/`setMfrResult`/`setMentalResult(null)` (reset for the new scan, `:812`), `runsUsed++`, `fetchRecentMatches`. Returns `{ success, matchId }` to the wizard caller, which then optionally runs mental analysis and `router.push('/core-engine/story')`.

---

## 3. Backend `save-match` and the single‑source‑of‑truth design

### 3.1 The controller (`compatibility.controller.saveMatch`, `compatibility.controller.js:12`)

Thin by design. It:
1. Requires `userId` (400 otherwise, `:15`).
2. Mints `matchId = uuidv4()` (`:17`) — unguessable, which partially mitigates the IDOR gaps in §9.
3. Resolves the report ids, falling back to `chronicResult?.details?.*` (`:18‑19`).
4. Resolves display names from `chronicResult.partner_A/B.name || maleManual/femaleManual.name || 'Partner A/B'` (`:21‑22`).
5. Delegates everything real to `reportGenerationService.compileMatchReport(matchId, {…})` (`:24‑36`), passing `sharedLifestyle: chronicResult?.details?.shared_lifestyle || {}`.

Gotcha: `saveMatch` destructures `mentalResult` from the body (`:14`) but the frontend never sends it on the initial call, so it's always `undefined` here. The first `matches` row is always written with `mentalResult = null`.

### 3.2 Why one source of truth

Both writers of `matches.compatibility_score` funnel through `computeGatedComposite`:
- `compileMatchReport` at save‑match (`reportGeneration.service.js:225`), and
- `analyzeMental` at the later mental recompute (`mental.controller.js:535`).

The docstring on `computeGatedComposite` (`reportGeneration.service.js:36‑44`) spells out why: so the DB's `compatibility_score` column and `presentation_json.relationship_snapshot.score` "can never again be computed independently, drift apart, or bypass the STI safety gate the way they previously could when each caller re‑derived its own number." **If you add a domain or change a weight, change it here once.** Recomputing a score anywhere else is the bug this design exists to prevent.

---

## 4. `compileMatchReport` → `computeGatedComposite` in detail

`reportGeneration.service.js`. This is the heart. Doc 09 owns the composite math canonically; here we anchor it to the orchestration.

### 4.1 The gated composite steps (`computeGatedComposite`, `:45`)

| Step | Code | What it does |
|---|---|---|
| Radiology | `_fetchRadiologyScore` (`:13`, called `:53`) | Looks up each partner's latest radiology **by name** (not FK), rescales `(radiology_nuptia_contribution / 30) * 100` (`:27`), averages present partners |
| Genetics | `evaluateThalassemiaCarrierRisk` (`:70`) → `genScore` (`:77‑109`) | both red → **50** + `bothConfirmedCarriers=true` (`:90`); one red + one untested → **excluded** (`:99`); one red only → **75** (`:101`); either borderline → **excluded** (`:107`); else **100** `[interim]` |
| Weighted blend | `:111‑146` | Over PRESENT domains only, renormalized by `sumWeights` |
| Critical floor | `:157‑175` | worst domain `< 30` → cap at `worst + 20`; `bothConfirmedCarriers` → also cap at `genScore + 20` |
| STI gate | `:182‑185` | `checkSTISafetyGate` triggered → `min(score, 50)` |
| Presentation | `mapPresentation` (`:189`) | Builds the deterministic presentation JSON |
| Return | `:201‑203` | `compatibilityScore = crossDomainScore / 100` (0‑1), plus `crossDomainScore` (0‑100), `presentation`, `assets` |

### 4.2 The weights (verbatim, all `[interim]`)

From `reportGeneration.service.js:111` and the domain blocks `:116‑146`:

| Domain | Weight | Source field | Scale |
|---|---|---|---|
| Chronic | **0.35** | `chronicResult.calculations.coupleIndex` | 0‑100 |
| Fertility (MFR) | **0.25** | `mfrResult.p_12m_current` | **already 0‑100** — do not ×100 (`:122`) |
| Mental | **0.20** | `mentalResult.overall_readiness.score` | 0‑100 |
| Radiology | **0.10** | `radScore` (rescaled) | 0‑100 |
| Genetics | **0.10** | `genScore` (100/75/50) | 0‑100 |

Two guards to know:
- **Present‑domain renormalization**: only domains that produced a usable score contribute; `rawCrossDomainScore = sumScores / sumWeights` (`:150`), or `null` if no domain. A mental‑less match is scored purely on chronic/fertility/(radiology)/(genetics).
- **`typeof … === 'number'` on mental** (`:132`): a truthy check would drop a *legitimate* mental score of 0 (a maximally‑incompatible couple, WS6‑03/WS8‑04) out of the composite entirely — erasing the couple's worst real finding. The explicit `typeof` guard makes a real 0 count.

All five weights and the thresholds below are **house values pending clinical review** — `[interim]`.

### 4.3 The critical‑domain floor and the both‑carrier cap

```
CRITICAL_DOMAIN_SCORE_THRESHOLD = 30   [interim]   (:157)
CRITICAL_DOMAIN_CAP_BUFFER      = 20   [interim]   (:158)
```

A plain weighted average lets one catastrophic domain (chronic=10, others=90 → 63) hide behind a reassuring headline. So if `min(domainScores) < 30`, the composite is capped at `worst + 20` (`:160‑164`). Additionally, because `genScore`'s both‑carrier value (50) sits *above* the 30 threshold, a confirmed both‑carrier couple would otherwise keep an "Excellent"‑adjacent headline despite the single most significant premarital finding this app can surface — so `bothConfirmedCarriers` forces an extra cap at `genScore + 20` (`:173‑175`). These reuse the same threshold/buffer `abdomen.score.js` uses one layer down, deliberately, rather than inventing a new uncited cap.

### 4.4 The STI gate cap

`checkSTISafetyGate(detailsForPresentation)` (`:182`). If triggered, `crossDomainScore = min(flooredScore ?? 50, 50)` (`:183‑185`) — applied to the **real** composite, not a display copy, so no positive/reactive infectious‑disease result can be diluted downstream. Full gate mechanics (the 5 canonical params, the negative/equivocal‑before‑positive ordering, ontology‑binding fragility) live in doc 09; the narrative override it triggers is in §5.2 below.

### 4.5 Assembling and persisting (`compileMatchReport`, `:209`)

After `computeGatedComposite` returns, `compileMatchReport`:

1. Builds `analysisJson` (`:234‑248`):
   ```
   { score, chronicResult, mfrResult, mentalResult|null,
     details: { male_report_id, female_report_id,
                male_manual_data, female_manual_data,
                shared_lifestyle, inviterName, prospectName } }
   ```
2. Stamps `presentation.versions` (`:253‑258`): `clinical_engine_version 'v1.2'`, `presentation_mapper_version 'v2.0'`, `narrative_prompt_version 'v5.0'`, `pdf_template_version 'v2.0'`.
3. Calls `narrativeService.generateNarratives(presentation, inviterName, prospectName)` (`:261`) — **DeepSeek, inline, ~a major slice of the 53 s wait** (§8).
4. UPSERTs the `matches` row (`:271‑320`): `SELECT id` then UPDATE‑if‑exists else INSERT, writing `status='completed'`, `compatibility_score` (0‑1), `analysis_json` (`JSON.stringify` → TEXT), `presentation_json` (JSONB), `ai_narrative` (JSONB), `presentation_version='v2.0'`, `ai_prompt_version='v5.0'`.
5. On any error, sets `status='failed'` (`:334`) and rethrows.

### 4.6 The `matches` row anatomy

DDL in `postgres.service.js`. Base table `:56‑65`; the JSONB/version columns and `user_id` are ALTER‑added `:224‑228` (so an old DB that predates them still works).

| Column | Type | Origin | Contents |
|---|---|---|---|
| `id` | TEXT PK | `uuidv4()` | match id |
| `user_id` | TEXT FK → users, CASCADE | ALTER `:224` | owning user |
| `male_report_id` | TEXT FK → reports, CASCADE | base `:59` | male pathology report |
| `female_report_id` | TEXT FK → reports, CASCADE | base `:60` | female pathology report |
| `status` | TEXT | base `:61` | `'completed'` / `'failed'` |
| `compatibility_score` | **REAL** | base `:62` | **0‑1** scale (`crossDomainScore/100`) |
| `analysis_json` | **TEXT** | base `:63` | JSON string — **must `JSON.parse`** |
| `presentation_json` | **JSONB** | ALTER `:225` | already parsed by pg |
| `ai_narrative` | **JSONB** | ALTER `:226` | already parsed |
| `presentation_version` | TEXT | ALTER `:227` | `'v2.0'` |
| `ai_prompt_version` | TEXT | ALTER `:228` | `'v5.0'` |
| `created_at` | TIMESTAMP | base `:64` | |

`presentation_json` shape (from `mapPresentation`, doc 09): `report_confidence`, `relationship_snapshot`, `couple_synthesis`, `strengths`, `opportunities`, `sti_gate`, `carrier_pair_risk`, `family_planning`, six `body_health` cards (sugar/heart/liver/kidney/hormones/vitamins), `lifestyle`, `improvement_plan`, `versions`, `report_assets`, `genetic_score`.

---

## 5. The narrative layer (`narrative.service.generateNarratives`)

`backend/src/services/llm/narrative.service.js:8`. Turns the deterministic `presentation` into warm prose (`hero`, `top_insights[]`, `body_cards{}`, `recommendations{}`, `closing_message`) via DeepSeek. Full LLM plumbing is doc 11; two things matter to the orchestration:

### 5.1 It never fabricates, and it flags degradation

The system prompt forbids inventing facts or altering scores (`:36‑37`). On any missing field or a failed call, a `safeFallback` (`:81‑103`) supplies generic copy that **points to the detailed panels rather than asserting a clinical claim**. A per‑field `pick()` sets `usedFallback`, surfaced as `narrative_generation_failed` (`:142`, `:149`) so a caller can tell "fully AI" from "partially degraded." With the OpenRouter key currently dead (401, doc 03), **this fallback is the current normal** — a template narrative is expected, not a bug you introduced.

### 5.2 STI‑gate narrative override

If `presentation.sti_gate.triggered === true` (`:12`), an override block is injected into the system prompt (`:17‑31`): the hero must not be purely celebratory, `top_insights[0]` must be prefixed `"🚨 Critical Finding: "` and name the STI, and no "you're doing great" while an active marker is present. This is the prose‑layer echo of the numeric `min(score,50)` cap — both driven off the same gate result, so they can't disagree.

---

## 6. The mental layer (post‑hoc recompute)

Mental wellbeing is **optional and always arrives after the initial match.** The engine itself is doc 08; here's the orchestration timing.

`POST /api/mental/analyze` with `{ partner_A_answers, partner_B_answers, match_id }` → `mental.controller.analyzeMental` (`mental.controller.js:496`):

1. Requires all 27 questions for both partners (`isMentalQuestionnaireComplete`, 400 otherwise, `:500`).
2. `computeMentalResult(...)` — the 6‑pillar model (`:507`).
3. **If `match_id` present** (`:512`): fetch the existing `analysis_json`, merge `mentalResult` in (`:524`), then **re‑run the same `computeGatedComposite`** (`:535‑542`) with the stored chronic/mfr + the new mental + the stored manual data/lifestyle, and `UPDATE matches SET analysis_json, compatibility_score, presentation_json` (`:547‑548`).

Why re‑run the whole gated path instead of a cheap local blend? Because a local `70/30` blend against the previous number (the old approach) would (a) never re‑apply the STI gate, and (b) update `compatibility_score` while leaving `presentation_json.relationship_snapshot.score` stale — the exact drift the single‑source‑of‑truth design forbids. The comment at `:526‑533` says this explicitly. Note the recompute writes `analysis_json`, `compatibility_score`, and `presentation_json` but **not** `ai_narrative` — the narrative is not regenerated on mental arrival.

```
save-match  ──►  matches row: mental=null, score=S1
                                   │
mental/analyze (match_id)  ──►  merge mental, RE-RUN computeGatedComposite
                                   │
                              matches row: mental=set, score=S2, presentation refreshed
```

Any consumer must tolerate a `matches` row with `mentalResult: null` (the window between the two calls, or a match where mental was never done).

---

## 7. The two divergent presentation pipelines

There are **two independent ways a presentation JSON gets produced**, and they can disagree. Know which one you're touching.

| | Deterministic (stored) | AI‑PDF (render‑time) |
|---|---|---|
| Function | `reportSummary.mapPresentation` via `computeGatedComposite` | `aiPresentation.generateAIPresentationMap` (`aiPresentation.service.js:178`) |
| When | save‑match + mental recompute → **stored** in `presentation_json` | only inside `generateAIPDFReport` (`compatibility.controller.js:320`), at PDF render time |
| Goes through `computeGatedComposite`? | **Yes** | **No** — bypasses it entirely |
| STI / genetics / critical‑floor | computed in code, capped structurally | live only in the DeepSeek **prompt** + a different post‑process |
| `hasGenetic`/`hasRadiology`/`hasMental` | from HbA2‑based `carrierRisk.covered`, radiology‑by‑name, `typeof` mental | different flags: `uterineLining`/`radiology_report_id` for radiology (`:352`), manual thalassemia/mthfr for genetics (`:353`), etc. |
| Model params | (narrative only) | `deepseek/deepseek-chat`, temp 0.3, max_tokens 8192 (`:344‑346`) |

Consequence: the AI‑PDF's score, confidence, and statuses **can differ from the stored, gated ones** a user sees on the report page and the normal PDF. This is a genuine divergence risk flagged in §11 — the AI‑PDF is not simply "a prettier render of the same numbers."

Both paths share one confidence formula and one dead‑uplift bug — §7.1.

### 7.1 The confidence formula (verbatim) and the `blood_verified` dead uplift

Identical in `reportSummary.service.js:316‑322` and `aiPresentation.service.js:364‑370`:

```
overall = 58                       (base: "Lifestyle + Blood tests")   [interim]
        + 16  if blood_verified                                        [interim]
        + 11  if genetic data present                                  [interim]
        + 6   if radiology present                                     [interim]
        + 5   if mental present                                        [interim]
bands:  >=90 'Near-complete' | >=70 'Solid' | else 'Good start'   (:324‑330)
domains_covered: starts at 2, +1 each for genetic/radiology/mental  (:337)
```

The schema promises a max of **96**. But `blood_verified` is **never set anywhere in the compile/analysis path** — it is only ever *read* (`const isBloodVerified = !!detailsFlat.blood_verified`, `reportSummary.service.js:317`; hardcoded `false` in every fallback). So the `+16` uplift never fires in the stored presentation, and `report_confidence.overall` really maxes at `58+11+6+5 = 80`, never 96. Anything you build that keys off "confidence approaching 96" is keying off a value the code can't produce. (Latent gap; see §11.)

---

## 8. Performance reality — the ~53 s synchronous wait

`save-match` is a **real ~53‑second synchronous request** (measured 53,234 ms twice). It is not a hang. Two inline costs inside `compileMatchReport`:

1. **Radiology lookups** — `_fetchRadiologyScore` does two DB identity lookups (`reportGeneration.service.js:17‑20`), and the PDF/AI‑PDF paths do more.
2. **The DeepSeek narrative call** — `narrativeService.generateNarratives` runs *inline* in the request (`reportGeneration.service.js:261`). Its underlying `openrouter.extractJSON` has **no fallback model and no retry**, with a **60 s single‑attempt timeout** — one slow call can stall save‑match up to a minute.

Meanwhile the loading UI is a **fake choreographed animation**. `AnalysisLoadingScreen.js` has 6 steps at `STEP_INTERVAL_MS = 1400` (`:8`), advancing on a `setTimeout` with **no `done`/`onComplete` wiring** (comment at `:24`; effect at `:35‑45`). It reaches the last step ("Formatting your report") in ~7 s and then just **parks there with a pulse for the remaining ~45 s**. This is the product's core moment, so the drop‑off risk is real (P1 `UX10-01`; also `UX1-06`). Fix directions: make progress honest/async (background the compile, poll for completion), or at minimum add an elapsed‑time counter so the bar isn't lying. **Do not ship a change that adds more inline work to this request** without accounting for the wait.

---

## 9. Auth & IDOR gaps

`compatibility.routes.js`. Route order matters: the PDF route is registered **before** the blanket `authenticateToken` so it can accept a share token:

| Route | Auth | Ownership check? |
|---|---|---|
| `GET /matches/:id/pdf` (`:10`) | `authenticateOrShareToken` | No — share token is match‑scoped by design |
| `router.use(authenticateToken)` (`:13`) | — | (applies to all below) |
| `GET /matches` (`:16`) | session | **No — trusts `userId` query param** |
| `POST /save-match` (`:19`) | session | n/a (creates) |
| `POST /matches/:id/share-link` (`:22`) | session | **Yes** — `match.user_id !== req.user.id` → 403 |
| `GET /matches/:id/ai-pdf` (`:26`) | session | **No** |
| `GET /matches/:id/radiology` (`:30`) | session | **No** |
| `GET /matches/:id` (`:33`) | session | **No** |
| `POST /matches/:id/infographics-data` (`:36`) | session | **No** |

So the reality:
- **Only `createShareLink` checks ownership** (`compatibility.controller.js:103`). `getMatch`, `generatePDFReport`, `generateAIPDFReport`, `getMatchRadiology`, and `compileInfographicsData` all do a bare `SELECT * FROM matches WHERE id = $1` (e.g. `:122`, `:253`, `:268`, `:327`) with no `user_id` filter → **any authenticated user can read/PDF any match by id.**
- **`listMatches` trusts the `userId` *query param*** (`:48`), not `req.user.id`: `SELECT * FROM matches WHERE user_id = $1` (`:51`) → **any authenticated user can list another user's matches** by passing their id.

`matchId` being `uuidv4` (unguessable) mitigates but does **not close** this — a leaked/logged id is enough. Treat all of these as IDOR‑prone when you add features or expose ids. (Doc 20 owns the security triage; this is the owning subsystem.)

---

## 10. Restore / deep‑link / hydration

Three entry points reload a saved match into context state:

| Function | Trigger | Code |
|---|---|---|
| `restoreMatchSession(match)` | tapping a recent‑match card | `CompatibilityContext.js:824` |
| `hydrateFromMatchId(matchId)` | `?match=` URL / hard refresh / deep link (WS8‑01) | `:890` |
| `fetchActiveMatchDetails(matchId)` | post‑save + inside restore | `:510` |

`restoreMatchSession` rehydrates `chronicResult`/`mfrResult`/`mentalResult` from `match.analysis`, sets `activeMatchId`, and restores the prospect. Two behaviors to know:
- **Gender is restored unconditionally as the mirror of the user's** (`setProspectForm(prev => ({ ...prev, gender: isUserMale ? 'Female' : 'Male' }))`, `:875`). WS6‑05: it used to restore only the name, leaving gender/DOB stale — which could score a real male prospect as Female. Gender is always knowable (it's which manual‑data slot the prospect's data lives in), so it's forced.
- **DOB is not restored** (`:868‑874`). Only a derived `age` number was ever persisted at match time (`calculateAge(dob)`), never the raw DOB. Synthesizing a fake DOB from the age would be a subtler fabrication, so it's deliberately left blank; the upload‑time guard in `usg/page.js` blocks with an actionable message when DOB is genuinely needed.

`hydrateFromMatchId` fetches the raw row via `GET /matches/:id`, `JSON.parse`s `analysis_json`, bails if `chronicResult`/`mfrResult` are absent (`:903`), then reuses `restoreMatchSession` rather than duplicating its logic. This is what makes a shared/refreshed report URL survive instead of dumping the user back on `/dashboard` with the report silently gone.

---

## 11. Data‑shape hazards (the ones that bite)

| Hazard | Reality | Where it trips you |
|---|---|---|
| Score scale | `matches.compatibility_score` is **0‑1** (REAL); `presentation.relationship_snapshot.score` is **0‑100** | `listMatches` multiplies by 100 for display (`compatibility.controller.js:63`) |
| MFR scale | `mfrResult.p_12m_current` is **0‑100** at top level, but 0‑1 under `.calculations` | composite uses the top‑level and must **not** ×100 (`reportGeneration.service.js:122`) |
| JSON columns | `analysis_json` is **TEXT** (must `JSON.parse`, guard `typeof === 'string'`); `presentation_json`/`ai_narrative` are **JSONB** (already parsed) | mixing these up is the most common trip — see the guarded parses at `compatibility.controller.js:131`, `:201`, `:275`, `:335` |
| Radiology join | Radiology is looked up **by patient name / slay‑id, never by report FK** (`_fetchRadiologyScore`; `radiologyLookup.fetchRadiologyByIdentity`) | if the name stored at radiology upload ≠ the match name, the whole 10% radiology domain silently drops out |
| Confidence ceiling | Real max is **80**, not the schema's 96 (`blood_verified` never set) | §7.1 |

---

## 12. External deps & graceful degradation

| Dependency | Env | Degraded behavior |
|---|---|---|
| Postgres (Supabase) | `DATABASE_URL` | hard requirement — `initDB` failure exits the process |
| OpenRouter / DeepSeek | `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `DEEPSEEK_MODEL`, `APP_URL` | narrative + AI‑PDF fall back to tagged templates (`narrative_generation_failed`), never fabricated clinical claims. **Key currently dead (401)** → this is the current normal (doc 03, 11) |
| Upstash Redis | `UPSTASH_REDIS_REST_URL`/`_TOKEN` | LLM response cache (30‑day TTL) + locks degrade; fail‑open in places (doc 20) |
| JWT | `JWT_SECRET` (+ refresh) | share‑token minting (`SHARE_EXPIRY = '48h'`, `jwt.service.js:16`, `generateShareToken` `:84`) |

Models per caller (doc 11 owns this): `narrative.service` uses `DEEPSEEK_MODEL || 'deepseek/deepseek-chat'`; `aiPresentation` uses `deepseek/deepseek-chat`; `llm.service` `DEFAULT_MODEL` is `openai/gpt-4o-mini` but callers override to deepseek; `openrouter.chatCompletion` defaults `deepseek/deepseek-v4-flash` with a `deepseek-chat` fallback.

---

## 13. The one‑male‑one‑female structural assumption

Everything in this flow is keyed to exactly one male + one female: the `matches` table has `male_report_id`/`female_report_id` columns; `isUserMale` slots the two uploads into those two slots; `prospectForm.gender` is pre‑filled as the **opposite** of the user's; `restoreMatchSession` mirrors it unconditionally; the engines are sex‑specific (MFR needs a female ovarian reserve + a male semen quality; body_health/carrier‑pair/STI all read `male_data` vs `female_data`). **There is no same‑sex representation** — two same‑gender uploads would collide into one slot and leave the other empty, breaking scoring. This is an architectural constraint, not a small tweak (doc 01).

---

## Open items (see doc 21 for the authoritative list)

- **`UX10-01` / `UX1-06` — the ~53 s save‑match wait behind a fake progress bar.** The compile does inline radiology + DeepSeek narrative synchronously; `AnalysisLoadingScreen` finishes its animation in ~7 s and parks for ~45 s. Highest‑impact UX fix in this area. **Open.**
- **`blood_verified` dead uplift** — never set in the compile path, so `report_confidence.overall` caps at 80, not the schema's 96 (§7.1). Latent; decide whether to wire it or correct the schema/UI.
- **IDOR / ownership gaps** — only `createShareLink` checks ownership; `getMatch`/`PDF`/`ai-pdf`/`radiology`/`infographics` read any match by id, and `listMatches` trusts a `userId` query param (§9). Owned here, triaged in doc 20.
- **AI‑PDF divergence** — `generateAIPDFReport` regenerates a presentation via DeepSeek and skips `computeGatedComposite`, so its numbers/statuses can differ from the stored gated ones (§7). Decide whether the AI‑PDF should render the stored presentation instead of re‑deriving one.
- **Restore placeholder names** (finding `WS6-05`) — an older/invite‑path match saved without a captured prospect name can fall back to literal test names ("Swati"/"Sachin") when reopened; `handleCompatibilityMatch` itself can't hit this (it requires `prospectForm.name`).

---

*Next: `11_llm_integration_and_ai_chat.md` — the OpenRouter clients, the AI chat drawer, and the narrative/presentation generation this doc calls inline.*
