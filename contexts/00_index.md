# SlayHealth — Developer Handoff

**Doc 00 of 22 · Index & Reading Guide** · Audience: a solo full‑stack successor · Mapped from git `HEAD`, 2026‑07.

---

## What SlayHealth is, in one paragraph

SlayHealth is a **premarital couple health‑compatibility platform**. One person creates an account, fills in their own health profile, adds a partner (either by entering the partner's details themselves or by sending an invite link the partner fills in), and both upload lab/scan reports. The product's core value moment — the **"Generate Insights"** button — combines five clinical domains (chronic/cardiometabolic risk, fertility, mental wellbeing, radiology, and thalassemia carrier genetics) into **one couple‑level compatibility result** with a single headline score, a per‑domain report, an AI chat assistant, and a downloadable PDF. The stack is a **Next.js 16 App Router frontend** (React 19, Tailwind v4) talking to an **Express 5 / PostgreSQL backend**, with OCR + LLM services feeding the extraction and narrative layers.

The **mobile UI is complete and is the locked design reference; the web/desktop UI still needs work** (see docs 16 and 17). That split is the single most important thing to know before touching the frontend.

---

## How this documentation set is organized

These 22 documents live in `contexts/`. They are numbered in **reading order** (which is also roughly dependency order). Each doc is self‑contained but cross‑links the others.

| # | File | What it covers | Priority |
|---|------|----------------|----------|
| 00 | `00_index.md` | This file — map, reading order, day‑one warnings, conventions | read‑first |
| 01 | `01_product_overview_and_mental_model.md` | The product, and the two structural facts (asymmetric account, one‑male‑one‑female) that frame everything | read‑first |
| 02 | `02_architecture_and_backend_core.md` | Express spine: bootstrap, middleware, full route registry, request lifecycle | core |
| 03 | `03_setup_deployment_and_environment.md` | Run it locally in one sitting; every env var; prod topology (Render/PM2/demo.slay.health) | read‑first |
| 04 | `04_auth_session_and_security.md` | OTP login, JWT rotate‑and‑revoke, single‑flight refresh, quota, admin allowlist | core |
| 05 | `05_data_model_and_storage.md` | The 14‑table data dictionary; Postgres / Redis / legacy SQLite | core |
| 06 | `06_extraction_pipelines_pathology_and_radiology.md` | PDF → structured data: deterministic pathology + LLM radiology (14 scan schemas) | core |
| 07 | `07_medical_engines_chronic_and_fertility.md` | **Deep**: chronic risk + fertility engines, every threshold/formula verbatim | core |
| 08 | `08_medical_engine_mental_wellbeing.md` | **Deep**: the 27‑item mental wellbeing v2.0 engine | core |
| 09 | `09_composite_scoring_sti_gate_and_genetics.md` | The single gated headline score, the STI safety gate, carrier genetics, risk flags | core |
| 10 | `10_match_orchestration_generate_insights.md` | "Generate Insights" end‑to‑end, button → persisted `matches` row | core |
| 11 | `11_llm_integration_and_ai_chat.md` | OpenRouter clients, the AI chat, narrative & presentation generation | core |
| 12 | `12_invite_flow_and_notifications.md` | Partner invite/consent state machine, self‑fill, WhatsApp | core |
| 13 | `13_pdf_report_generation.md` | The pdfkit downloadable report (and the divergent AI‑PDF) | core |
| 14 | `14_frontend_core_state_and_app_shell.md` | `CompatibilityContext` store, `apiFetch`, draft hydration, app shell | core |
| 15 | `15_frontend_onboarding_and_add_prospect_wizard.md` | The intake wizard, journey‑aware copy, self‑entry vs invite | core |
| 16 | `16_frontend_mobile_report_and_dashboard.md` | **The COMPLETE mobile reference UI** | core |
| 17 | `17_frontend_web_desktop_status_and_gaps.md` | **WEB NEEDS WORK** — what remains, the reconcile‑to‑mobile backlog | core |
| 18 | `18_design_system_and_styling.md` | Design tokens, the three‑greens palette issue, typography, dead dark mode | reference |
| 19 | `19_testing_and_qa.md` | The 5 backend suites, `npm test` is a stub, zero frontend tests, **what's untested** | core |
| 20 | `20_security_posture.md` | One‑page consolidated triage of exposures with pointers to owning docs | core |
| 21 | `21_known_issues_and_roadmap.md` | Consolidated still‑open known‑issues backlog by severity + roadmap + DPDP posture | reference (consult throughout) |

---

## Recommended reading order

1. **00** (this) → **01** (product & mental model) → **03** (get it running locally) — do these first, in this order.
2. Then the backend spine: **02** → **04** → **05** → **06**.
3. Then the clinical core: **07** → **08** → **09** → **10** — this is the heart of the product; read it as a block.
4. Then the AI and peripheral backend: **11** → **12** → **13**.
5. Then the frontend: **14** → **15** → **16** (the complete mobile UI) → **18** (design tokens) → **17** (what remains on web — read after mobile + design so you know what to reconcile *to*).
6. **19**, **20**, **21** are cross‑cutting — skim **21** early, then keep all three open as reference while you work.

If you only have an afternoon: **00 → 01 → 03 → 10 → 16/17**. That gives you the product, a running app, the core value flow, and the mobile‑done/web‑todo picture.

---

## Subsystem → doc lookup

If you're staring at a file and want the doc that explains it:

| You're looking at… | Doc |
|---|---|
| `backend/src/server.js`, `middleware/`, `routes/` | 02 |
| `services/auth/`, `auth.controller.js`, `middleware/auth.middleware.js`, `quota.js`, frontend `utils/api.js` | 04 |
| `services/storage/*`, `db.controller.js`, any table | 05 |
| `services/ocr/*`, `services/parser/*`, `services/radiology/*` (extractors, schemas) | 06 |
| `controllers/chronic.controller.js`, `mfr.controller.js` + their scoring | 07 |
| `controllers/mental.controller.js`, `constants/mentalHealthQuestions.js` | 08 |
| `services/scoring/*`, `services/compatibility/reportSummary.service.js` (STI gate, genetics) | 09 |
| `controllers/compatibility.controller.js`, `services/compatibility/reportGeneration.service.js` | 10 |
| `services/llm*`, `chat.controller.js`, `services/compatibility/aiPresentation.service.js`, `components/ReportChatDrawer.js` | 11 |
| `controllers/invite.controller.js`, `services/notification/*`, `app/invite/[token]/page.js` | 12 |
| `services/pdfReport*.service.js` | 13 |
| `contexts/CompatibilityContext.js`, `utils/api.js`, `config/api.js`, `app/layout.js` | 14 |
| `app/onboarding/`, `app/add-prospect/`, `components/wizard/*`, `constants/*` | 15 |
| `app/dashboard/`, `app/core-engine/*`, `components/mobile/*`, `components/usg/*` | 16 |
| `app/chronic/`, `app/mfr/`, `app/usg/`, `app/db/`, `components/landing/*` | 17 |
| `app/globals.css`, `app/mobile-shell.css`, `components/mobile/Ico.js` | 18 |
| `backend/tests/`, `backend/__tests__/` | 19 |

---

## Day‑one warnings — read before you touch anything

1. **This is NOT the Next.js you know.** The frontend runs **Next 16.2.9 + React 19.2.4 + Tailwind v4** — materially different from older versions. `frontend/AGENTS.md` (imported by `frontend/CLAUDE.md`) says to verify every Next/React/Tailwind API against `node_modules/next/dist/docs/` rather than memory. **Tailwind v4 has no `tailwind.config.js`** — the theme is CSS‑first in `frontend/src/app/globals.css` `:root` variables. (Details: doc 03, doc 18.)

2. **Mobile is the locked design reference; web needs work.** Do not "fix" a mobile screen to look like the desktop one — it's the other way round. The finished surface is the mobile report/dashboard (doc 16); the desktop/web surfaces are the backlog (doc 17).

3. **The score has ONE source of truth: `computeGatedComposite`** in `reportGeneration.service.js`. It runs at save‑match *and* at the later mental recompute. Never compute a compatibility score anywhere else, or the DB score and the presentation JSON will drift. (Doc 10.)

4. **The product is structurally one‑male‑one‑female.** `matches.male_report_id` / `female_report_id`, sex‑specific engines, and a partner‑gender pre‑fill are all baked in. There is **no same‑sex representation** — it's an architectural constraint, not a small tweak. (Doc 01, doc 10.)

5. **Secrets in `backend/.env` are live plaintext, and the OpenRouter key is currently dead (401).** So AI chat/narrative silently falls back to templates — that's expected, not a bug you introduced. Rotate all credentials on handoff. (Doc 03, doc 20.)

6. **All clinical constants are interim/unvalidated.** Every threshold, likelihood ratio, and band in the engines is a *house value pending clinical review* — treat none of them as a validated clinical standard. Each is tagged as such in docs 07–09.

7. **Regulatory posture is an open risk.** The engines emit diagnostic‑grade outputs and the UI has carried "DPDP‑compliant"/"Doctor Verified"‑style claims the REG‑06 audit found largely unsubstantiated. These docs document that gap factually and take **no** position on wellness‑vs‑SaMD — that's pending your decision/legal counsel. (Doc 21.)

---

## Conventions used across these docs

- **`file.js:123`** means that exact file and line (relative to repo root or an obvious package root). Line numbers are from git `HEAD` at mapping time and may drift slightly as the code changes — treat them as strong hints, not guarantees.
- **`[interim]`** next to a clinical number means "house value, no cited source — pending clinical review."
- **Finding IDs** like `WS1D02`, `UX8‑05`, `OPP‑W4‑15` are **historical markers** from a prior internal engineering/UX review that has since been actioned and **removed from the repo**. You'll still meet these codes in **code comments** (e.g. `WS1D02` in `reportSummary.service.js`) — they explain *why* a line exists. Treat them as breadcrumbs, not links: there are no review files to open anymore. (`REG‑06` is the one still‑live one — see below.)
- Each doc ends with an **"Open items"** tail. The **single source of truth for what's still open is doc 21** — the per‑doc tails are pointers, not their own status ledgers.
- Clinical constants have **one canonical home** to prevent drift: e.g. the composite weights and the confidence formula live verbatim in doc 09; other docs reference them.

---

## History: the self‑review corpus (removed)

Before this handoff the codebase was put through a deep engineering + UX review whose findings were **actioned and then deleted from the repo** (the two summary spines, their 29 detailed `WS*`/`ux_WS*` workstream files, and the daily work‑report logs). You may still see their finding‑IDs (`WS1D02`, `UX8‑05`, …) in code comments and in these docs — those are **historical breadcrumbs**, not links to files.

The **one surviving review artifact** is `REG-06_DPDP_SUBSTANTIATION_AUDIT.md` (repo root): the regulatory/DPDP claim audit, kept because its findings are **not yet resolved** — the platform's regulatory posture is still an open risk (see warning #7 above and doc 21). Doc 21 carries forward the consolidated, still‑open known‑issues backlog and the roadmap.

> **Note:** the `contexts/` folder these handoff docs live in also historically held mental‑engine spec docs (`mental_health_engine_update.md`, `mental_questionnaire_research_backing.md`) that the code cites but which are **no longer present**. Doc 08 therefore uses the engine's own acceptance tests as ground truth. If you have those specs, drop them back in `contexts/` and doc 08 can be enriched.

---

*Next: `01_product_overview_and_mental_model.md` — the product and the two structural facts that frame every other doc.*
