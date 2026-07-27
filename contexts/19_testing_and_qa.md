# Testing, QA & What Is (and Isn't) Tested

**Doc 19 of 22** · Audience: a solo full‑stack successor · Prerequisite: `03_setup_deployment_and_environment.md`, `09_composite_scoring_sti_gate_and_genetics.md`.

Goal of this doc: give you the **one honest map of verification** on this codebase — the five backend test suites and exactly what each one guards, the fact that `npm test` is a stub and there are **zero** frontend tests, the one **safety‑critical gap** (production radiology scoring is untested while a dead legacy twin is what the suite exercises), how to run everything, the disposable‑data live‑verification discipline used this cycle, and the regression protocol you must run **before** touching any clinical constant.

Read this before you change an engine. The single biggest trap on this repo is reading a green test run as "the production math is covered." It is not.

---

## 1. Testing reality at a glance

Three facts, up front, because they invert the assumptions most people bring:

1. **`npm test` is a stub that always fails.** `backend/package.json:7` is literally `"test": "echo \"Error: no test specified\" && exit 1"`. There is **no wired test runner** — no Jest, no Mocha, no `node --test` glob. The real test files exist on disk but nothing runs them for you. Run each suite **directly** with `node <file>` (the two `assert`‑based scripts) or `node --test <file>` (the three `node:test` suites). §4 has the exact commands.
2. **The frontend has ZERO automated tests.** `frontend/package.json` has `dev`/`build`/`lint` and **no `test` script at all** — the only automated check on the entire Next.js app is `eslint` (`frontend/package.json:9`). Every frontend behavior — the wizard, the mobile report, `CompatibilityContext`, `apiFetch` — is verified by eye or by the live‑browser discipline in §6, never by a unit test.
3. **There is no CI.** No `.github/`, no pipeline, no pre‑commit hook. Nothing runs any of this on push. Verification is a manual act you must remember to perform.

So the "test suite" is five hand‑run backend scripts. Here's what they actually cover — and, more importantly, what they don't.

```
 npm test ─────────────▶  echo "no test specified" && exit 1     (a stub; ignore it)

 REAL suites (run by hand):
   backend/tests/parser.test.js .............. node backend/tests/parser.test.js
   backend/__tests__/mental-engine-v2.test.js  node --test
   backend/__tests__/lifestyle-lr-mapping...    node --test
   backend/__tests__/sti-gate-ontology-...      node --test
   backend/__tests__/usg-scoring.test.js .....  node --test   ⚠ tests DEAD code
```

---

## 2. The five backend suites — inventory

Two live in `backend/tests/`, three in `backend/__tests__/`. Two are plain `assert` scripts (run with bare `node`); three use the built‑in `node:test` runner. Each guards a different subsystem — mostly a *contract between two independently‑maintained pieces of code* that would otherwise drift silently.

| Suite | Runner | Subsystem it guards | What it actually asserts |
|---|---|---|---|
| `backend/tests/parser.test.js` | `node` (`assert`) | Pathology extraction (doc 06) | `detectSection()` maps CBC/Thyroid/LFT headers to canonical section keys and returns `null` for noise; `parameterExtractor.extract()` pulls value+unit+reference‑range for tab‑delimited **and** columnar layouts (RBC, SGPT, columnar Creatinine). |
| `backend/__tests__/mental-engine-v2.test.js` | `node --test` | Mental wellbeing v2.0 engine (doc 08) | The engine's own **§5 acceptance checks** — 27 items, six pillar weights summing to 100, `attachment_style` fully removed, family‑clarity scoring, pursue‑withdraw attachment penalty, agreeableness/conscientiousness peaking at option 4, the 20‑item agreement denominator, and **fail‑closed** on missing attachment/substance data. |
| `backend/__tests__/lifestyle-lr-mapping.test.js` | `node --test` | Chronic engine lifestyle LRs (doc 07) | The frontend's real alcohol/smoking option **values** (`Never/Quit/Occasionally/Frequently|Regularly`) each resolve to a **real** `LIFESTYLE_LRS` entry, not the silent `|| 1.0` fallback — the exact bug where habits scored risk‑neutral regardless of the user's answer. |
| `backend/__tests__/sti-gate-ontology-binding.test.js` | `node --test` | STI safety gate ↔ extraction ontology (doc 09) | Every one of the gate's five hardcoded canonical param names still exists in the ontology (`hasCanonical`), the gate **fires end‑to‑end** for each marker via that key, and the `classifySerologyResult` vocabulary matrix stays correct. |
| `backend/__tests__/usg-scoring.test.js` | `node --test` | USG/radiology organ scoring — **but the DEAD legacy copy** (see §3) | Per‑organ scorers (liver/prostate/female‑reproductive/gallbladder/kidney/bladder), composite, metabolic index, PCOS risk flag, couple insights — **all imported from `usg.controller.js`, which no route mounts.** |

A little more on each, because the *why* matters:

### 2.1 `parser.test.js` — the only extraction test

`backend/tests/parser.test.js:1‑63`. It requires `sectionDetector.service` and `parameterExtractor.service` directly and runs four section‑detection cases plus a mock‑pages extraction. It is a plain `assert` script — no runner, no `describe`. It's a genuinely useful smoke test of the deterministic pathology path (doc 06), but it covers only a handful of parameters against one synthetic page. The LLM radiology extractor (doc 06) has **no** analogous test — it's non‑deterministic and only integration‑testable against a paid API.

### 2.2 `mental-engine-v2.test.js` — the acceptance harness

`backend/__tests__/mental-engine-v2.test.js`. This is the best test on the repo. Each `test(...)` is **named after the §5 acceptance check it verifies** (`§5.1`–`§5.8`) from the mental‑engine spec (doc 08). It stubs `llmService.generateStructuredInsight` to return its fallback object untouched (`:16`) so the tests exercise **only the deterministic scoring math**, never a live `OPENROUTER_API_KEY`, and restores the real function in `test.after` (`:17‑19`). Highlights you'll rely on when you touch the engine:

| Check | Line | Guards |
|---|---|---|
| `§5.1` | `:44` | `REQUIRED_MENTAL_FIELDS.length === 27`; a maxed couple scores exactly `100` (proves the six pillar weights sum to 1.00). |
| `§5.2` | `:74` | `attachment_style` is gone from `REQUIRED_MENTAL_FIELDS` **and** absent from the controller source text. |
| `§5.6` | `:128` | `scaleAgreeablenessConscientiousness(4) === 100` and `(5) === 70` — the "moderation beats extremity" curve. |
| `§5.7` | `:133` | `NUMERIC_AGREEMENT_FIELDS.length === 20`; attachment + substance excluded; disagreement on `relocation_openness` actually moves the agreement index. |
| `§5.8` | `:152` | Missing attachment → security `50` (not `100`); missing substance tier → risk `30` (not `75`). **Fail‑closed**, never best‑case. |

Every numeric threshold this suite pins (`100`, `70`, `92`, `89`, `50`, `30`, `20`) is an **`[interim]`** house value — the acceptance checks lock the *current* engine behavior, not a clinically validated target. If you re‑tune a pillar weight, these numbers change and this suite is where you find out.

### 2.3 `lifestyle-lr-mapping.test.js` — a real bug's headstone

`backend/__tests__/lifestyle-lr-mapping.test.js`. This exists because of a genuine, previously‑shipped bug: `LIFESTYLE_LRS.alcohol`/`.smoking` keys never matched the frontend's actual option strings, so `getEffectiveLifestyleLR`'s `LIFESTYLE_LRS[factor][value] || 1.0` lookup fell through to neutral **for every real answer** — smoking and drinking contributed nothing to chronic risk no matter what the user picked. The test binds the frontend's real values to the backend map. **Gotcha to internalize** (`:16‑23`): the frontend value lists (`FRONTEND_ALCOHOL_VALUES`, `FRONTEND_SMOKING_VALUES`) are **copied by hand**, because the source (`lifestyleOptions.js`) pulls in `lucide-react`/JSX and can't be `require`d from a plain Node test. That hand‑copy is the one manual step standing between this test and the same silent drift it exists to catch — if you rename an option on the frontend, update this list too. The LR magnitudes it asserts (`alcohol` `1.1`/`1.2`, `smoking` `1.25`/`1.5`) are **`[interim]`**.

### 2.4 `sti-gate-ontology-binding.test.js` — the safety‑critical binding

`backend/__tests__/sti-gate-ontology-binding.test.js`. This guards the WS0‑05 finding (doc 09, doc 21): the STI gate reads **five hardcoded canonical param names** and the ontology extractor produces them — two independently‑maintained string contracts. If the ontology ever renames, drops, or fuzzy‑loses one, the gate **silently stops firing for that marker** with no error anywhere — a clinical‑safety bypass, not just a broken test. The suite (`:12‑39`) asserts (a) every gate canonical exists in the ontology via `ontologyMapper.hasCanonical`, (b) the gate genuinely triggers end‑to‑end for each marker with an injected `Reactive` value, and (c) the `classifySerologyResult` vocabulary matrix (`Reactive/Positive/Detected` → positive, `Non‑Reactive/Not Reactive/Undetected` → negative, `Equivocal` → equivocal). **Keep this green** — it is the only automated thing preventing a reactive HIV/HBsAg/HCV/syphilis screen from silently failing to cap the couple score at ≤50.

### 2.5 `usg-scoring.test.js` — green, and lying to you

`backend/__tests__/usg-scoring.test.js`. It imports **from `../src/controllers/usg.controller`** (`:3‑15`) and runs six patient fixtures (`F_KARTIKAY`…`F_RIYAZ`) through the per‑organ scorers, composite, metabolic index, risk flags and couple insights. It passes. It is also testing **dead code** — see §3, which is the single most important thing in this document.

---

## 3. CRITICAL SAFETY GAP — the tested scorer is not the production scorer

Read this section twice.

There are **two complete, divergent USG/radiology scoring implementations** in this repo:

| | **Production** (live) | **Legacy** (dead) |
|---|---|---|
| Scorer code | `backend/src/services/scoring/*` (`abdomen.score.js`, `nuptia.composite.score.js`, `dexa.score.js`, `echo.score.js`, `ecg.score.js`, `scrotum.score.js`, `riskFlags.service.js`) | `backend/src/controllers/usg.controller.js` (own inline copies of every scorer) |
| Reached via | `radiology.controller.js` → `radiology.routes.js`, mounted at **both** `/api/radiology` **and** `/api/usg` (`server.js:87‑88`) | `usg.routes.js` — **never mounted** (no `require`/`app.use` in `server.js`) |
| Missing‑organ behavior | returns `null` = "not assessed" (WS1D01 fix; renormalizes weights, skips nulls) | returns a fabricated **`100`** = "assessed and normal" (the un‑fixed bug) |
| BMI bands | Asian‑Indian (`≥23/≥25/≥32.5`) **`[interim]`** | WHO (`≥25/>30/>35`) **`[interim]`** |
| Radiology NuptiaScore weight | 30% model | old 15% model |
| **Test coverage** | **NONE** | `usg-scoring.test.js` ✅ |

`server.js:88` even carries the comment `// Backwards compatibility redirect` — `/api/usg` points at the **radiology** controller. So `usg.controller.js` is genuinely dead: no route reaches it, and it still carries the old fabricate‑`100`‑for‑missing‑organs bug that the production path was explicitly fixed to remove (doc 09, WS1D01).

**The consequence:** the only "scoring" test on the repo exercises the wrong file. Every function that computes a number a couple actually sees has **zero** automated coverage:

- `calculateRadiologyNuptiaContribution` (`services/scoring/nuptia.composite.score.js`) — the 0–30 radiology blend, the worst‑modality `<30 → +20` cap, the `null`‑skip guard.
- `compositeAbdominalScore` + the eight production organ scorers (`services/scoring/abdomen.score.js`) — the *fixed* twins with the `null`‑vs‑`100` contract.
- `computeGatedComposite` (`reportGeneration.service.js:45`) — **the single writer of `matches.compatibility_score`** (doc 09, doc 10). Its domain weights (chronic .35 / fertility .25 / mental .20 / radiology .10 / genetics .10), the three‑layer critical floor (`CRITICAL_DOMAIN_SCORE_THRESHOLD=30`, `CRITICAL_DOMAIN_CAP_BUFFER=20`, `reportGeneration.service.js:157‑158`), the genetics tiers, and the STI `Math.min(score ?? 50, 50)` cap — **none of it is tested.**
- `_fetchRadiologyScore` (`reportGeneration.service.js:13`) — the by‑name radiology join that has silently dropped the whole radiology domain in past bugs.

Do **not** read a green `usg-scoring.test.js` as "radiology scoring works." It means the *dead* scorer works. The live one is verified only by the manual live‑verification runs in §6. If you want real safety here, the first test you write should re‑point these fixtures at `services/scoring/abdomen.score.js` (whose signatures differ — production `calculateMetabolicHealthIndex` takes `(findings, bmi)`, not the legacy 4‑arg form) and add a direct `computeGatedComposite` case. See §8.

---

## 4. How to run each suite

All commands from `backend/` (they resolve `../src/...` relative to the test file). The three `node:test` suites can be run as a set with a single `node --test` invocation of the `__tests__` directory.

| Suite | Command | Expected output |
|---|---|---|
| Pathology parser | `node tests/parser.test.js` | `✓ Section Detector tests passed.` / `✓ Parameter Extractor tests passed.` / `All tests passed successfully! ✨` (throws on first failure) |
| Mental engine v2 | `node --test __tests__/mental-engine-v2.test.js` | `tests` count, `pass N`, `fail 0` |
| Lifestyle LR mapping | `node --test __tests__/lifestyle-lr-mapping.test.js` | `pass 8`, `fail 0` (2 groups × 4 subtests) |
| STI gate ↔ ontology | `node --test __tests__/sti-gate-ontology-binding.test.js` | `pass N`, `fail 0` |
| USG scoring (legacy) | `node --test __tests__/usg-scoring.test.js` | `pass N`, `fail 0` — green, but see §3 |
| **All three `node:test` suites** | `node --test __tests__/` | aggregate `pass`/`fail 0` |

Notes:
- The two `node:test` suites that call `computeMentalResult` **stub the LLM**, so they run offline. The `assert` parser script and the ontology‑binding test are pure and offline too. **You do not need a live `OPENROUTER_API_KEY` or network to run any of the five.** (`test_auth_flow.js` in `tests/scripts/`, by contrast, calls `initDB()` and needs `DATABASE_URL` — it's a DB‑touching probe, not part of the five.)
- The `parser.test.js` script **throws** (non‑zero exit) on first failed `assert` — there's no summary line if it fails, just the assertion error. The `node:test` suites print a proper `tests/pass/fail` TAP summary.
- Wiring these into `npm test` is a five‑minute change; see §8.

---

## 5. What is untested — the full picture

Beyond the radiology gap in §3, here is the honest coverage boundary. Treat everything in the right column as "verify by hand or by §6, because nothing else will."

| Area | Covered by a suite? | Reality |
|---|---|---|
| Pathology section detection + param extraction | Partial (`parser.test.js`) | One synthetic page, a few params. LLM radiology extractor untested (non‑deterministic). |
| Mental engine scoring math | **Yes** (`mental-engine-v2.test.js`) | The one well‑tested engine. |
| Chronic engine | Partial (`lifestyle-lr-mapping.test.js`) | Only the lifestyle‑LR key binding. IDRS/DEXA arithmetic, most of the engine — untested. |
| Fertility (MFR) engine | **No** | Zero coverage. |
| STI gate binding + serology vocab | **Yes** (`sti-gate-ontology-binding.test.js`) | Binding + firing + vocab. Does not test the composite cap application. |
| **Production radiology/USG scoring** | **No** (§3) | Dead twin is tested; live `services/scoring/*` is not. |
| **`computeGatedComposite` / composite orchestration** | **No** | The single score writer, the STI cap, the critical floor, genetics tiers — untested end‑to‑end. |
| Auth / JWT / OTP | Script only (`tests/scripts/test_auth_flow.js`, DB‑touching, not in the five) | Phone normalization + OTP invalidation asserted there; not part of `node --test`. |
| PDF report generation (doc 13) | **No** | Manual only. |
| Invite/notification flow (doc 12) | **No** | Manual only. |
| **Entire frontend** | **No** | Only `eslint`. No component/integration/e2e tests. |

The two structural holes that would hurt most in a refactor: **the composite orchestration** (change a weight, nothing catches drift between `matches.compatibility_score` and the presentation JSON) and **the frontend** (change `CompatibilityContext` hydration, nothing catches a broken report render).

---

## 6. The live‑verification discipline (real evidence over code‑reading)

Because the automated net has holes this wide, the fixes shipped **this cycle** were validated by a repeatable **seed → mint → drive → screenshot → delete** loop against a real running stack, not by reading code. The scaffolding lives in `backend/scratch/` (browser drivers) and `backend/tests/scripts/` (DB seed/inspect/cleanup helpers). The pattern:

```
 1. SEED    insert a disposable Postgres row (a mock report for "Sachin"/"Swati")
              → backend/tests/scripts/insert_mock_radiology.js  (dotenv → initDB → db.query INSERT)
 2. MINT     bypass OTP entirely: sign a session directly and inject it into the browser
              → jwtService (see tests/scripts/test_auth_flow.js) + a refreshToken written to
                localStorage('slayhealth_refresh_token') via page.addInitScript(...)
 3. DRIVE    real headless Chromium (Playwright) navigates the actual app on :3010
              → backend/scratch/browser_verify_*.js  (goto /dashboard, click tabs, wait for hydration)
 4. CAPTURE  screenshot before/after at mobile (390×844) AND desktop (1440×1000) viewports
              → page.screenshot({ path: 'scratch/shots_*/...' })
 5. DELETE   remove every disposable row so the shared DB is left clean
              → backend/tests/scripts/delete_seeded_radiology.js
                (DELETE FROM radiology_reports/usg_reports WHERE patient_slay_id IN (...))
```

Why it's built this way:
- **Direct JWT mint bypasses OTP.** `browser_verify_*.js` writes the refresh token straight into `localStorage` via `page.addInitScript` (`browser_verify_1d.js:5‑11`) — no WhatsApp OTP round‑trip. This is the fastest path to a logged‑in session for automated checks (doc 04 has the auth details; doc 03 §3 points here for first‑boot login).
- **:3010, not :3000.** The review machine ran the frontend on **3010** (an unrelated app held 3000 — the caveat in doc 03 §3). The scripts hardcode `http://localhost:3010`; adjust the port to wherever Next actually printed.
- **Both viewports, every time.** Mobile is the locked design reference and web is the backlog (doc 16, doc 17), so a fix isn't "verified" until it's screenshotted at both widths.
- **Disposable data, on the *shared* Supabase Postgres.** There is no separate test DB — `DATABASE_URL` points at the real Supabase instance (doc 03, doc 05). That's why the **delete step is mandatory**: seed with obviously‑disposable identities (`Sachin`/`Swati`), verify, then `DELETE ... WHERE patient_slay_id IN (...)`. Leaving seed rows behind pollutes the one shared datastore for everyone.

These scripts are **not** a test suite — they're single‑use probes named after the finding they validated (`browser_verify_1d`, `browser_verify_ux8_01`, …), the evidence trail behind the fixes made during that work. Keep the *pattern* (seed → mint → drive → screenshot → delete); don't expect the individual scripts to be re‑runnable regression tests.

---

## 7. Regression protocol BEFORE changing any clinical constant

Every threshold, weight, likelihood ratio and band in the engines is an **`[interim]`** house value pending clinical review (doc 00 §6; docs 07–09 carry them verbatim). When you change one — a pillar weight, an LR, an organ deduction, a domain weight, a gate canonical — run this **before and after**, and confirm all green both times so you know exactly what your change moved:

```
cd backend
node       tests/parser.test.js                              # pathology extraction still parses
node --test __tests__/mental-engine-v2.test.js               # mental §5 acceptance still holds
node --test __tests__/lifestyle-lr-mapping.test.js           # chronic lifestyle LR binding intact
node --test __tests__/sti-gate-ontology-binding.test.js      # ← MUST stay green if you touch extraction/ontology
node --test __tests__/usg-scoring.test.js                    # legacy scorer (green ≠ production covered — §3)
```

Specific rules:

- **Touching the extraction ontology or any canonical param name → `sti-gate-ontology-binding.test.js` is the one that must not break.** A rename that this test doesn't catch is a silent clinical‑safety bypass (the gate stops capping the couple score for that marker). If it goes red, you've decoupled the gate from the extractor — fix the binding, don't delete the test.
- **Touching a mental pillar weight or item → expect `mental-engine-v2.test.js` numbers to change.** Update the asserted values *deliberately* (they encode the §5 spec), and re‑confirm the maxed‑couple case still lands on exactly `100` (proves your new weights still sum to 1.00).
- **Touching a frontend lifestyle option value → update `FRONTEND_ALCOHOL_VALUES`/`FRONTEND_SMOKING_VALUES` in `lifestyle-lr-mapping.test.js` by hand** (they can't be cross‑imported — §2.3) or the test guards a stale contract.
- **Touching production radiology/composite scoring → you have no net.** `usg-scoring.test.js` will stay green because it tests the *dead* twin (§3). Verify with the §6 live loop, and strongly consider writing the missing `computeGatedComposite` test first (§8).
- **Changing a clinical constant is also a regulatory‑posture act.** Regulatory/clinical positioning is an **open risk** on this product (doc 00 §7, REG‑06, doc 21) — the docs take no wellness‑vs‑SaMD stance. Keep the "confirm with a qualified doctor" framing intact and don't let a constant change quietly upgrade the product's implied clinical authority.

---

## 8. Adding tests

Where new suites should live and how to make the runner real:

- **Location & runner.** Put new backend tests in `backend/__tests__/` and use the built‑in **`node:test`** convention (`const test = require('node:test'); const assert = require('node:assert');`), matching the three existing suites. No dependency to add — it's built into Node. Use nested `await t.test(...)` for grouped subtests (as `lifestyle-lr-mapping.test.js` does).
- **Stub the LLM.** For any engine test, follow `mental-engine-v2.test.js:14‑19`: monkey‑patch the LLM service to return its fallback object and restore it in `test.after`. Tests must not depend on a live `OPENROUTER_API_KEY` or make a network call per assertion.
- **The first two tests worth writing** (highest safety‑value gap, §3):
  1. Re‑point the `usg-scoring.test.js` fixtures at `services/scoring/abdomen.score.js` (the production, `null`‑safe twin) — mind the changed signatures (`calculateMetabolicHealthIndex(findings, bmi)`), and assert that a **missing** organ yields `null`, not `100`.
  2. A direct `computeGatedComposite` suite: feed known domain sub‑scores, assert the 35/25/20/10/10 blend, the `<30 → worst+20` floor, and — critically — that a `Reactive` serology input forces the result to `≤50`. This is the untested guarantee the whole STI gate exists to provide.
- **Wire `npm test` to actually run.** Replace `backend/package.json:7` with something like `"test": "node --test __tests__/ && node tests/parser.test.js"`. Once that's real, add a CI job (there is none — doc 21) so the suites run on push instead of relying on a human to remember §7.
- **Frontend.** There is no test harness at all. If you add one, ESLint is already wired (`frontend/package.json:9`); a component/e2e layer (the §6 Playwright pattern is the natural seed) would close the largest single hole in §5.

---

## Open items (see doc 21 for the authoritative list)

- **Production radiology + composite scoring is untested** while its dead legacy twin (`usg.controller.js`) is what `usg-scoring.test.js` exercises — a green suite gives false confidence. Re‑point the fixtures and add a `computeGatedComposite` test (§3, §8).
- **`npm test` is a stub (`exit 1`) and there is no CI** — the five suites only run if a human remembers to run them by hand. Wire the runner and add a pipeline (§1, §8).
- **Zero frontend tests** — the entire Next.js app is covered only by `eslint`; regressions in the wizard/report/context are caught only by eye or the §6 live loop (§5).
- **Live verification depends on the shared Supabase DB and disposable‑data hygiene** — there is no isolated test database, so the seed→verify→**delete** discipline (§6) is load‑bearing; a forgotten cleanup pollutes production data.
- **`sti-gate-ontology-binding.test.js` is the sole automated guard on a clinical‑safety bypass** — if extraction/ontology work lets it drift, the STI ≤50 cap silently stops firing (§2.4, §7).

---

*Next: `20_security_posture.md` — the one‑page consolidated triage of exposures (auth, the authenticated‑but‑unauthorized `/db` route, fail‑open Redis, plaintext secrets) with pointers to each owning doc.*
