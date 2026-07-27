# Data Model & Storage (Postgres, Redis, legacy SQLite)

**Doc 05 of 22** · Audience: a solo full‑stack successor · Prerequisite: `02_architecture_and_backend_core.md`, `04_auth_session_and_security.md`.

Goal of this doc: be the **authoritative data dictionary** — every one of the 14 Postgres tables (columns, types, defaults, PK/FK/`ON DELETE`, and which columns were bolted on by `ALTER`), the three‑store topology, the exact JSON shapes stored in `matches`, the id‑vs‑`report_id` and radiology‑by‑identity traps that have already caused a silent all‑couples bug, what gets cleaned up (almost nothing), and how the two erasure cascades actually work. When you need to know "what is stored, where, in what shape, and what deletes it," this is the doc.

---

## 1. The three‑store topology

There are **three** storage services in `backend/src/services/storage/`, but only **two are live**, and only **one is the system of record.**

| Store | File | Role | Live? | Optional? |
|---|---|---|---|---|
| **PostgreSQL** (Supabase) | `postgres.service.js` | **Sole system‑of‑record.** All durable state — accounts, auth, reports, radiology, matches, invites, WhatsApp log. | yes | **no** — `initDB()` failure exits the process |
| **Redis** (Upstash REST) | `redis.service.js` | **Nullable side‑cache only:** LLM output cache (30‑day TTL) + OTP send rate‑limit/lockout counters. Holds **no durable product data**. | yes when configured | **yes** — degrades fail‑open when absent |
| **SQLite** (better‑sqlite3) | `sqlite.service.js` | **Dead legacy.** A fossil single‑file store from an earlier era. Never imported by `backend/src/`. Stale subset schema. | **no** | n/a — should be deleted |

The mental model: **Postgres is truth. Redis is a speed/safety accessory you can unplug. SQLite is a corpse still in the room** — a service file, a `better-sqlite3 ^12.11.1` production dependency, and **two git‑tracked binary `.db` files** (§11). Never treat anything in SQLite as authoritative, and never let a new dev "fix" a bug by editing the wrong store.

```
                    ┌─────────────────────────────────────────────┐
 every controller   │  Postgres (Supabase)  — SYSTEM OF RECORD     │
 & service ────────▶│  14 tables · pg.Pool · initDB on boot        │
   db.query()       └─────────────────────────────────────────────┘
                          ▲                         ▲
   llm.service ───────────┘ (30d cache)             │ (OTP counters)
   otp.service ───────────────────────────────────┘
        │
        ▼
   ┌─────────────────────┐        ┌──────────────────────────────────┐
   │ Redis (Upstash)     │        │ SQLite (better-sqlite3)          │
   │ nullable side-cache │        │ DEAD — only test scripts import  │
   │ LLM cache + OTP RL  │        │ stale subset schema, 2 binary DBs│
   └─────────────────────┘        └──────────────────────────────────┘
```

---

## 2. Connection & boot

### Postgres pool

`postgres.service.js:6` builds **one** `pg.Pool` from `DATABASE_URL` with `ssl.rejectUnauthorized: false` (`postgres.service.js:9`) — Supabase requires SSL, and the pool **accepts any cert** (a mild MITM exposure flagged in doc 20). Everyone imports `{ db }` and calls `db.query(text, params)` (`postgres.service.js:17‑25`); `db.pool` is used directly **only** for a transaction (the `deleteAccount` `BEGIN/COMMIT`, §8). In `NODE_ENV=development` every query (text + params) is logged (`postgres.service.js:19‑21`) — noisy, and it prints parameter values, so don't ship dev logging to prod.

### Idempotent in‑boot "migrations" — there is no migration framework

`server.js:110` does `initDB().then(() => app.listen(...))` and `.catch(() => process.exit(1))` — **a schema init failure is fatal.** `initDB()` (`postgres.service.js:27`) runs the **entire** schema on **every boot**:

1. one big `CREATE TABLE IF NOT EXISTS …` block for the original tables (`postgres.service.js:30‑167`),
2. then a sequence of idempotent `ALTER TABLE … ADD COLUMN IF NOT EXISTS …` / `CREATE TABLE IF NOT EXISTS …` / `CREATE INDEX IF NOT EXISTS …` statements that layer on everything added since (`postgres.service.js:170‑283`).

There is **no version table, no migration tool (no Prisma/Knex/Flyway), no down‑migrations.** The consequence you must internalize: **the column set from the fresh `CREATE TABLE` can drift from the `ALTER`‑added set.** A brand‑new database gets the base columns from the `CREATE` plus everything from the `ALTER`s; but the `CREATE` blocks were never back‑filled, so (e.g.) `matches` in the `CREATE` has no `user_id`/`presentation_json`/`ai_narrative` — those exist **only** because the `ALTER`s at `postgres.service.js:223‑230` add them. **To add a column, you add an `ALTER … IF NOT EXISTS`** at the bottom of `initDB()`; do not edit the `CREATE` block (existing DBs won't re‑run it).

---

## 3. Full data dictionary — 14 tables

Columns are verbatim from `initDB()` (`postgres.service.js`). **[ALTER]** marks a column/table added by a post‑`CREATE` migration rather than the original `CREATE TABLE` (this is exactly the drift from §2 — on a fresh DB these still exist; on the code they live in a different statement). All timestamps default `CURRENT_TIMESTAMP` unless noted.

### 3.1 Pathology ingest tables

**`reports`** — one uploaded pathology PDF. `reports.id` is what the API/frontend call **`report_id`** (§5). Line refs: `postgres.service.js:31‑39`, `:204`.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | **PK** (`uuidv4` at upload) |
| `file_name` | TEXT | `'mock_report.pdf'` for mock path |
| `upload_timestamp` | TIMESTAMP | |
| `processing_status` | TEXT | `'processing'` → `'completed'` |
| `confidence_score` | REAL | 0 at insert, set after parse |
| `extracted_json` | TEXT | parsed labs (stringified JSON) |
| `created_at` | TIMESTAMP | used by the 24h cleanup (§7) |
| `is_mock` | BOOLEAN DEFAULT FALSE | **[ALTER]** explicit mock flag (was inferred from filename) |

**`ocr_pages`** (`postgres.service.js:41‑46`) — raw OCR text, one row per page.

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL | **PK** |
| `report_id` | TEXT | **FK → `reports(id)` ON DELETE CASCADE** |
| `page_number` | INTEGER | |
| `raw_text` | TEXT | |

**`extraction_logs`** (`postgres.service.js:48‑54`) — per‑step extraction audit.

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL | **PK** |
| `report_id` | TEXT | **FK → `reports(id)` ON DELETE CASCADE** |
| `step` | TEXT | |
| `message` | TEXT | |
| `created_at` | TIMESTAMP | |

### 3.2 The core result table

**`matches`** — the couple‑level compatibility result, the product's core output. `CREATE` at `postgres.service.js:56‑65`; the four result columns + `user_id` are **[ALTER]** at `postgres.service.js:223‑230`. Deep‑dived in §4.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | **PK** |
| `user_id` | TEXT | **[ALTER]** **FK → `users(id)` ON DELETE CASCADE** (the account holder) |
| `male_report_id` | TEXT | **FK → `reports(id)` ON DELETE CASCADE** |
| `female_report_id` | TEXT | **FK → `reports(id)` ON DELETE CASCADE** |
| `status` | TEXT | `'completed'` / `'failed'` |
| `compatibility_score` | REAL | **0–1 FRACTION** (`crossDomainScore/100`) — see §4/§5 trap |
| `analysis_json` | **TEXT** | `JSON.stringify`'d — callers must `JSON.parse` |
| `presentation_json` | **JSONB** DEFAULT NULL | **[ALTER]** pg returns it already parsed |
| `ai_narrative` | **JSONB** DEFAULT NULL | **[ALTER]** pg returns it already parsed |
| `presentation_version` | TEXT DEFAULT NULL | **[ALTER]** hardcoded `'v2.0'` at write |
| `ai_prompt_version` | TEXT DEFAULT NULL | **[ALTER]** hardcoded `'v5.0'` at write |
| `created_at` | TIMESTAMP | |

> **Two `ON DELETE CASCADE`s point *into* `matches`:** deleting a referenced `reports` row destroys the match. This is exactly why the cleanup job (§7) refuses to prune any report a match references.

### 3.3 Radiology / ultrasound tables (a separate id space — §5)

**`radiology_reports`** — the current radiology/USG store. `CREATE` at `postgres.service.js:75‑87`; `is_mock` + `user_id` are **[ALTER]** at `:205`, `:237`.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | **PK** |
| `patient_slay_id` | VARCHAR(255) | identity key (not an FK) |
| `sex` | VARCHAR(10) | |
| `age` | INTEGER | |
| `modalities_detected` | TEXT[] | Postgres array |
| `findings_json` | JSONB **NOT NULL** | per‑modality findings |
| `scores_json` | JSONB | organ scores + `radiology_nuptia_contribution` |
| `risk_flags_json` | JSONB | |
| `raw_ocr_text` | TEXT | |
| `created_at` / `updated_at` | TIMESTAMP | |
| `is_mock` | BOOLEAN DEFAULT FALSE | **[ALTER]** |
| `user_id` | TEXT | **[ALTER]** **FK → `users(id)` ON DELETE CASCADE** — *going‑forward only*, pre‑migration rows are unlinked (§8) |

**`usg_reports`** — **legacy** ultrasound store, now a read‑only fallback (§11). `CREATE` at `postgres.service.js:67‑73`; `user_id` **[ALTER]** at `:238`.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | **PK** |
| `patient_slay_id` | TEXT | identity key (not an FK) |
| `extracted_json` | TEXT | |
| `analyzed_results` | TEXT | |
| `user_id` | TEXT | **[ALTER]** **FK → `users(id)` ON DELETE CASCADE** |
| `created_at` | TIMESTAMP | |

### 3.4 Chat tables

**`chat_sessions`** (`postgres.service.js:89‑96`) — **the `report_id` columns have NO FK** (§6).

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | **PK** |
| `report_id` | TEXT | **NO FK** — plain text |
| `partner_report_id` | TEXT | **NO FK** — plain text |
| `engine_type` | TEXT NOT NULL | which engine's chat |
| `context_metadata` | TEXT | |
| `created_at` | TIMESTAMP | |

**`chat_messages`** (`postgres.service.js:98‑104`).

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL | **PK** |
| `session_id` | TEXT | **FK → `chat_sessions(id)` ON DELETE CASCADE** |
| `role` | TEXT NOT NULL | |
| `content` | TEXT NOT NULL | |
| `created_at` | TIMESTAMP | |

### 3.5 Identity & auth tables

**`users`** (`postgres.service.js:106‑126`) — account holder **and** invited‑partner placeholder rows (§8/§9). Free‑tier counters `runs_used`/`chats_used` drive quota (§12).

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | **PK** |
| `phone_number` | TEXT **UNIQUE NOT NULL** | placeholder invitees use `invite-<inviteId>` |
| `name`, `gender`, `dob`, `city` | TEXT | profile |
| `activity_level`, `daily_steps`, `occupation_style` | TEXT | lifestyle |
| `drinking_habits`, `smoking_habits`, `tobacco_habits`, `sleep_cycle` | TEXT | lifestyle |
| `height`, `weight`, `waist` | REAL | anthropometrics |
| `runs_used` | INTEGER DEFAULT 0 | match quota counter (§12) |
| `chats_used` | INTEGER DEFAULT 0 | chat quota counter (§12) |
| `created_at` | TIMESTAMP | |

**`otp_requests`** (`postgres.service.js:128‑137`) — OTP lifecycle rows. **Never garbage‑collected** (§7).

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | **PK** |
| `phone` | TEXT NOT NULL | |
| `otp_hash` | TEXT NOT NULL | bcrypt (saltRounds 10) |
| `purpose` | TEXT DEFAULT `'login'` | |
| `expires_at` | TIMESTAMP NOT NULL | `now + 5min` |
| `attempts` | INTEGER DEFAULT 0 | |
| `used_at` | TIMESTAMP DEFAULT NULL | set on success |
| `created_at` | TIMESTAMP | |

**`user_sessions`** (`postgres.service.js:139‑148`) — hashed refresh tokens. Validity is enforced **in SQL** (§12), not by a stored `expires_at`. **Never purged** (§7).

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | **PK** |
| `user_id` | TEXT | **FK → `users(id)` ON DELETE CASCADE** |
| `refresh_token_hash` | TEXT NOT NULL | bcrypt |
| `device_info` | TEXT | |
| `ip_address` | TEXT | |
| `created_at` / `last_used_at` | TIMESTAMP | |
| `revoked_at` | TIMESTAMP DEFAULT NULL | revoke = set this, not delete |

### 3.6 Invite / consent tables

**`prospect_invites`** (`postgres.service.js:150‑166`) — the invite‑a‑partner state machine + consent audit (§9). Heavily migrated: `pathology_report_id`/`radiology_report_id` **[ALTER]** `:170`, `erased_after_submission` **[ALTER]** `:181`, `prospect_phone` **NOT NULL dropped** `:188`, `mental_answers_json` **[ALTER]** `:194`.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | **PK** |
| `user_id` | TEXT | **FK → `users(id)` ON DELETE CASCADE** (the inviter) |
| `prospect_user_id` | TEXT | **FK → `users(id)` ON DELETE SET NULL** (placeholder invitee) |
| `prospect_name` | TEXT NOT NULL | |
| `prospect_phone` | TEXT | **NOT NULL dropped** [ALTER] (invites are now copied links, not WhatsApp sends) |
| `token` | TEXT **UNIQUE NOT NULL** | invite link token |
| `whatsapp_message_id` | TEXT | |
| `status` | TEXT DEFAULT `'created'` | state machine (§9) — but `createInvite` inserts `'sent'` |
| `consent_timestamp` | TIMESTAMP DEFAULT NULL | consent audit |
| `consent_ip` | TEXT DEFAULT NULL | consent audit |
| `consent_user_agent` | TEXT DEFAULT NULL | consent audit |
| `pathology_report_id` | TEXT DEFAULT NULL | **[ALTER]** **NO FK** — plain text (§6) |
| `radiology_report_id` | TEXT DEFAULT NULL | **[ALTER]** **NO FK** — plain text (§6) |
| `created_at` | TIMESTAMP | |
| `expires_at` | TIMESTAMP NOT NULL | |
| `erased_after_submission` | BOOLEAN DEFAULT FALSE | **[ALTER]** true after post‑submit erasure (§8) |
| `mental_answers_json` | JSONB DEFAULT NULL | **[ALTER]** optional mental questionnaire answers |

**`self_entry_consents`** (**[ALTER]** table, `postgres.service.js:272‑281`) — the consent artifact for the "I'll enter my partner's data myself" path (UX8‑01). Before this table, self‑entry left **zero** consent record.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | **PK** |
| `user_id` | TEXT | **FK → `users(id)` ON DELETE CASCADE** |
| `prospect_name` | TEXT NOT NULL | |
| `confirmed_at` | TIMESTAMP | |
| `ip` / `user_agent` | TEXT DEFAULT NULL | consent audit |
| `created_at` | TIMESTAMP | |

### 3.7 WhatsApp audit log

**`whatsapp_messages`** (**[ALTER]** table, `postgres.service.js:248‑260`) — append‑only send/receive log; the **only** source of truth for the admin message viewer (the Cloud API has no fetch‑history endpoint). Writes are best‑effort (errors swallowed, `whatsappMessageLog.service.js:11‑14`) so a log failure never blocks a send. **Has no `user_id` → unreachable by any erasure path** (§8).

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL | **PK** |
| `direction` | TEXT NOT NULL | `'outbound'` / `'inbound'` |
| `phone_number` | TEXT NOT NULL | |
| `message_type` | TEXT | |
| `template_name` | TEXT | |
| `body_text` | TEXT | |
| `status` | TEXT DEFAULT `'sent'` | updated via webhook |
| `wa_message_id` | TEXT | |
| `raw_payload` | JSONB | |
| `created_at` / `updated_at` | TIMESTAMP | |

### 3.8 The 17 indexes

All `CREATE INDEX IF NOT EXISTS`, from `initDB()`.

| Index | Table (column) | Line |
|---|---|---|
| `idx_usg_reports_patient_slay_id` | `usg_reports(patient_slay_id)` | `:210` |
| `idx_radiology_patient_slay_id` | `radiology_reports(patient_slay_id)` | `:211` |
| `idx_radiology_created_at` | `radiology_reports(created_at DESC)` | `:212` |
| `idx_chat_messages_session_id` | `chat_messages(session_id)` | `:213` |
| `idx_users_phone_number` | `users(phone_number)` | `:214` |
| `idx_otp_requests_phone` | `otp_requests(phone)` | `:215` |
| `idx_user_sessions_user` | `user_sessions(user_id)` | `:216` |
| `idx_prospect_invites_user_id` | `prospect_invites(user_id)` | `:217` |
| `idx_prospect_invites_token` | `prospect_invites(token)` | `:218` |
| `idx_prospect_invites_msg_id` | `prospect_invites(whatsapp_message_id)` | `:219` |
| `idx_matches_user_id` | `matches(user_id)` | `:229` |
| `idx_radiology_reports_user_id` | `radiology_reports(user_id)` | `:239` |
| `idx_usg_reports_user_id` | `usg_reports(user_id)` | `:240` |
| `idx_whatsapp_messages_phone` | `whatsapp_messages(phone_number)` | `:261` |
| `idx_whatsapp_messages_wa_id` | `whatsapp_messages(wa_message_id)` | `:262` |
| `idx_whatsapp_messages_created_at` | `whatsapp_messages(created_at DESC)` | `:263` |
| `idx_self_entry_consents_user_id` | `self_entry_consents(user_id)` | `:282` |

---

## 4. The `matches` result columns in depth

`matches` is the one table whose contents are the product. It is written by **exactly two code paths** (§4.4), both routing through one scoring function. Get the column semantics wrong and the DB score and the UI score silently diverge — a bug this codebase has already had and fixed.

### 4.1 `compatibility_score` — a 0–1 fraction

`compatibility_score` (REAL) is stored as **`crossDomainScore / 100`** (`reportGeneration.service.js:201`), i.e. a **0–1 fraction**. The user‑facing 0–100 number lives in `presentation_json.relationship_snapshot.score`. **These are different units.** Conflating them is the "score‑unit trap" (§5). `null` is a legitimate value — if no domain produced a usable score, the composite stays `null` (pending) rather than fabricating a number (`reportGeneration.service.js:150`, `:201`).

### 4.2 `analysis_json` — **TEXT**, must be `JSON.parse`'d

`analysis_json` is a **TEXT** column written with `JSON.stringify` (`reportGeneration.service.js:293`). Every reader must `JSON.parse` it (e.g. `mental.controller.js:518`: `JSON.parse(matchRow.analysis_json || '{}')`). Shape (`reportGeneration.service.js:234‑248`):

```
{
  score,                       // 0-1 fraction (or null)
  chronicResult,               // full chronic engine output
  mfrResult,                   // full fertility engine output
  mentalResult | null,         // null until mental answers arrive
  details: {
    male_report_id, female_report_id,
    male_manual_data, female_manual_data,
    shared_lifestyle,
    inviterName, prospectName
  }
}
```

### 4.3 `presentation_json` & `ai_narrative` — **JSONB**, do NOT re‑parse

Both are **JSONB**; `pg` returns them **already parsed as objects.** Writers `JSON.stringify` on the way in (`reportGeneration.service.js:294‑295`); readers use them as‑is. **Parsing a JSONB column again throws.** You'll see defensive `typeof x === 'string' ? JSON.parse(x) : x` guards scattered around because the two column types are mixed within the same row — that guard is load‑bearing, keep it.

`presentation_json` is built by `reportSummaryService.mapPresentation(...)` and then decorated in `computeGatedComposite`/`compileMatchReport`:
- `presentation.report_assets = assets` (`reportGeneration.service.js:195`)
- `presentation.genetic_score = hasGenetic ? genScore : null` (`reportGeneration.service.js:199`)
- `presentation.versions = { clinical_engine_version:'v1.2', presentation_mapper_version:'v2.0', narrative_prompt_version:'v5.0', pdf_template_version:'v2.0' }` (`reportGeneration.service.js:253‑258`)
- key sub‑objects: `relationship_snapshot.score` (**0–100**), `couple_synthesis`, `strengths`, `opportunities`, `sti_gate`, `body_health`.

> **Version stamp gotcha:** the row‑level columns `presentation_version`/`ai_prompt_version` are hardcoded `'v2.0'`/`'v5.0'` at write (`reportGeneration.service.js:296‑297`, `:317‑318`) — a **separate** value from the richer `presentation.versions` block above. If you bump one, bump both, or provenance drifts.

### 4.4 The two writers and the single scoring path

Only two places write the result columns, and **both must go through `computeGatedComposite`** (`reportGeneration.service.js:45`) or the score and the STI gate drift:

1. **Initial compile** — `compileMatchReport(...)` (`reportGeneration.service.js:209`): computes, builds `analysis_json`/`presentation_json`/`ai_narrative`, then `SELECT id FROM matches`; **UPDATE if present else INSERT** (`reportGeneration.service.js:271‑320`). On any failure it sets `status='failed'` (`reportGeneration.service.js:334`).
2. **Late mental recompute** — `mental.controller.js` `analyzeMental` (`~:513‑548`): when mental answers arrive after the match already ran, it `JSON.parse`s `analysis_json`, re‑runs the **same** `computeGatedComposite` (`mental.controller.js:535`), and `UPDATE matches SET analysis_json=$1, compatibility_score=$2, presentation_json=$3` (`mental.controller.js:547‑548`). The inline comment there documents a prior bug where an ad‑hoc 70/30 blend let the DB score drift out of sync with the presentation score — the fix was funnelling both writers through this one gated function.

The scoring constants live verbatim in **doc 09** (the canonical home) and in `reportGeneration.service.js`. In brief, all **[interim]**: weights **Chronic 35% / Fertility 25% / Mental 20% / Radiology 10% / Genetics 10%** (`:111`); `CRITICAL_DOMAIN_SCORE_THRESHOLD = 30`, `CRITICAL_DOMAIN_CAP_BUFFER = 20` (`:157‑158`); thalassemia `genScore` both‑carriers→50 / one‑red→75 / one‑red+one‑untested→excluded / borderline→excluded / else 100 (`:77‑109`); STI gate caps the composite at 50 when triggered (`:182‑185`); radiology per‑partner contribution `(radiology_nuptia_contribution / 30) * 100`, averaged across partners (`:27`). Treat every one of these as a house value pending clinical review.

---

## 5. The id‑vs‑`report_id` trap and radiology‑by‑identity

Two id spaces exist and they do **not** connect by foreign key:

- **`reports.id`** — this is what the API and frontend call **`report_id`.** It's what `matches.male_report_id`/`female_report_id` FK to.
- **`radiology_reports.id` / `usg_reports.id`** — a **completely separate id space.** These rows are **not** FK‑linked to `matches` or `reports`. They are joined to a person by **identity** — `patient_slay_id` **or** `LOWER(name)` — **never by any report id.**

The one correct way to fetch a person's radiology is `radiologyLookup.fetchRadiologyByIdentity(slayId, name)` (`radiologyLookup.service.js:10`):

```
SELECT * FROM radiology_reports
WHERE (patient_slay_id = $1 OR LOWER(patient_slay_id) = LOWER($2))
ORDER BY created_at DESC LIMIT 1          -- radiologyLookup.service.js:22-25
   ↓ (no row?)
SELECT * FROM usg_reports  (same identity predicate)   -- :42-45  (legacy fallback)
```

It also **normalizes the JSONB column names**: the raw DB columns `findings_json`/`scores_json`/`risk_flags_json` are re‑emitted as unprefixed `findings`/`scores`/`risk_flags` (`radiologyLookup.service.js:33‑35`), because the downstream mapper (`mapRadiologyToLegacyFormat`) reads the unprefixed keys.

**The historical all‑couples bug (documented in‑code):** a previous version resolved radiology by the **pathology `report_id`** — a different table's id space that essentially never matched — and, separately, the lookup used to return the raw `*_json` column names and omit `sex`/`age`/`id`. The mapper then read **all‑undefined** and silently fell back to **default/100 organ scores and empty risk flags for every couple**, quietly dropping the entire radiology domain out of the composite. Both traps are called out in the comments at `radiologyLookup.service.js:13‑21` and `reportGeneration.service.js:8‑12`. If you ever "simplify" radiology to join by report id, you will reintroduce this exact silent failure.

---

## 6. No‑FK relationships that don't cascade

Some report references are **plain TEXT with no foreign key**, so deleting a `reports`/`radiology_reports` row does **not** cascade to them:

| Referencing column | Points at | FK? | Consequence |
|---|---|---|---|
| `chat_sessions.report_id` | a report | **no** | must delete `chat_sessions` explicitly on erasure |
| `chat_sessions.partner_report_id` | a report | **no** | same |
| `prospect_invites.pathology_report_id` | a `reports` row | **no** | dangles unless nulled/erased explicitly |
| `prospect_invites.radiology_report_id` | a `radiology_reports` row | **no** | dangles unless nulled/erased explicitly |

This is **why the deletion code deletes `chat_sessions` by hand** (§8) instead of relying on cascade. `deleteAccount` runs `DELETE FROM chat_sessions WHERE report_id = ANY($1) OR partner_report_id = ANY($1)` before deleting the reports (`auth.controller.js:428‑429`); `purgeSubmittedProspectData` does the same by single id (`invite.controller.js:327`). If you add a new deletion path, you must remember these no‑FK links — the database will not clean them up for you.

---

## 7. Retention & cleanup — almost nothing is pruned

The only automatic deletion of durable data is **`cleanupOldReports`**, and it touches **one table.**

```
DELETE FROM reports
WHERE created_at < NOW() - INTERVAL '1 day'          -- postgres.service.js:298-305
  AND id NOT IN (
    SELECT male_report_id  FROM matches WHERE male_report_id  IS NOT NULL
    UNION
    SELECT female_report_id FROM matches WHERE female_report_id IS NOT NULL
  )
```

So it prunes **only orphan pathology `reports` older than 24h**, and deliberately **excludes any report a match references** — because the `matches → reports` FK is `ON DELETE CASCADE`, deleting a referenced report would destroy the couple's completed result (comment at `postgres.service.js:294‑296`).

**How it runs is fragile:** it's an **in‑process `setInterval(…, 60*60*1000)`** in `server.js:99‑107` — **not a cron.** It only fires while the process is up, starting from process start; frequent restarts or a serverless model can stop it ever firing, and **every running instance runs its own copy.**

**Everything else grows unbounded.** No auto‑purge exists for:

| Table | Cleaned up? |
|---|---|
| `radiology_reports`, `usg_reports` | **never** |
| `matches` | **never** |
| `otp_requests` | **never** (expired/used rows accumulate) |
| `user_sessions` | **never** (revoked/expired rows accumulate) |
| `chat_sessions`, `chat_messages` | **never** (except via erasure paths) |
| `whatsapp_messages` | **never** |
| `prospect_invites`, `self_entry_consents` | **never** |

The Redis LLM cache has a real **30‑day TTL** (`llm.service.js:72`, `setex(..., 2592000, ...)`) and OTP counters have short TTLs — but those are **functional caches, not a retention policy.** The absence of a general health‑record retention/deletion policy is the core of the REG‑06 finding (§8, doc 21).

---

## 8. Deletion / DPDP erasure cascades

There are exactly two real erasure paths. Both matter for the (open) DPDP posture — see REG‑06 (doc 21).

### 8.1 Account‑holder erasure — `deleteAccount` (transactional)

`auth.controller.js:402‑449`. Self‑only (`req.user.id`, never a client‑supplied id, `:406`). Runs in a **transaction** on a dedicated `db.pool.connect()` client:

```
BEGIN                                                          -- auth.controller.js:408
  ├─ collect prospect_user_id[]  from prospect_invites          -- :410-415
  ├─ collect report ids from this user's matches                -- :417-424
  ├─ DELETE chat_sessions WHERE report_id|partner_report_id ∈ ids  (no FK)  -- :428
  ├─ DELETE reports WHERE id ∈ ids                              -- :431
  ├─ DELETE users WHERE id = userId                             -- :434
  │     └─ cascades: matches, user_sessions, prospect_invites,
  │                  radiology_reports, usg_reports  (user_id FKs)
  └─ DELETE users WHERE id ∈ prospectUserIds  (placeholder partners)  -- :437
COMMIT                                                          -- :440
```

The subtlety: `reports` and `chat_sessions` have **no FK to `users`**, so they're gathered via the user's matches and deleted **explicitly** first. Deleting the `users` row then cascades everything with a `user_id` FK. The **placeholder partner** rows (§9) are collected before the delete and removed separately — because `prospect_invites.prospect_user_id` is `ON DELETE SET NULL` (not a cascade onto the placeholder), so cascading the invite away would otherwise **orphan** the partner's `users` row and anything hanging off its `user_id` (comment at `auth.controller.js:387‑395`).

### 8.2 Reject‑after‑submit erasure — `purgeSubmittedProspectData`

`invite.controller.js:325‑338`. When an invited partner submits real data and then **declines consent**, this erases what was collected:

| Step | SQL | Line |
|---|---|---|
| delete chat sessions (no FK) | `DELETE FROM chat_sessions WHERE report_id = $1 OR partner_report_id = $1` | `:327` |
| delete pathology report | `DELETE FROM reports WHERE id = $1` | `:328` |
| delete radiology report | `DELETE FROM radiology_reports WHERE id = $1` | `:331` |
| delete placeholder user | `DELETE FROM users WHERE id = $1` | `:335` |
| tombstone the invite | `UPDATE prospect_invites SET pathology_report_id=NULL, radiology_report_id=NULL, mental_answers_json=NULL, erased_after_submission=TRUE` | `:338` |

`erased_after_submission=TRUE` is what lets the inviter's UI honestly say "data was submitted and has now been erased" instead of the false "nothing was shared" it used to show for both decline cases (comment at `postgres.service.js:176‑180`, UX8‑03).

### 8.3 Rows no erasure path can reach

| Unreachable data | Why |
|---|---|
| **Pre‑migration radiology/USG rows** | uploaded before the `user_id` stamp shipped (`:236`); only free‑text patient name from the PDF links them — no account handle. A **disclosed** limitation (`auth.controller.js:397‑400`); the frontend confirmation copy says so rather than claiming a complete purge. |
| **`whatsapp_messages`** | table has **no `user_id`** — not reachable by account deletion; rows persist forever. |
| **`whatsapp_messages` / logs after delete** | append‑only audit, outside the cascade. |

These gaps, plus the no‑general‑retention‑policy point (§7) and an in‑product "DPDP‑compliant" claim shown while the consent‑ledger/DSAR/retention/breach machinery is unbuilt, are the substance of **REG‑06** (`REG-06_DPDP_SUBSTANTIATION_AUDIT.md §3‑§4`). This doc states them factually; it takes **no** wellness‑vs‑SaMD position — that's pending your decision and legal counsel (doc 21).

---

## 9. The `prospect_invites` status state machine & consent audit

The `status` column default is `'created'` (`postgres.service.js:158`), but `createInvite` inserts a row already at **`'sent'`** because the copyable link is ready immediately (`invite.controller.js:139`, comment `:137`). `createInvite` also inserts the **placeholder `users` row** with `phone_number = 'invite-<inviteId>'` (`invite.controller.js:124‑126`) — that's the login‑less partner identity everything else references.

Observed status values (verbatim, from `invite.controller.js`):

```
 created ─▶ sent ─▶ (delivered | opened | read)          [WhatsApp/link lifecycle]
                        │
                        ▼
              questionnaire_submitted ─▶ processing ─▶ (completed | failed)
                        │
   consent branch:  consent_accepted | consent_rejected
   out-of-band:     revoked | expired
```

| Status | Meaning | Line ref |
|---|---|---|
| `created` | column default; rarely the live value | `postgres.service.js:158` |
| `sent` | link generated / ready to share | `invite.controller.js:139`, `:154` |
| `delivered` / `opened` / `read` | delivery + open tracking | `:296‑299`, `:964‑978` |
| `questionnaire_submitted` | prospect submitted data | `:838`, `:842` |
| `processing` | engines running | `:886‑889` |
| `completed` | match compiled | `:638‑639`, `:748` |
| `failed` | compile failed | `:643‑644`, `:877‑890` |
| `consent_accepted` / `consent_rejected` | consent decision | `:363` |
| `revoked` | inviter/prospect revoked | `:922‑923` |
| `expired` | past `expires_at` | `:281‑282` |

**Consent audit fields** on the invite: `consent_timestamp`, `consent_ip`, `consent_user_agent` (`postgres.service.js:159‑161`) — the who/when/where of the accept/reject. The parallel `self_entry_consents` table (§3.6) is the equivalent artifact for the "I'll enter my partner's data myself" path, which previously had no consent record at all (UX8‑01).

---

## 10. The admin DB browser (`/api/db`)

`db.controller.js` + `db.routes.js` back a generic per‑table browser/editor. **Correction to some source maps: it is mounted at `/api/db` (`server.js:83`), not `/api/admin`.** (The `/api/admin` router is the separate WhatsApp viewer, which *does* add `requireAdmin`.)

**It is authenticated, not open.** `db.routes.js:8` does `router.use(authenticateToken)` on the whole router. The problem is **authorization, not authentication**: there is **no role/admin check** beyond a valid JWT, so **any logged‑in user** can hit these endpoints. Frame it accurately in any writeup — this is a **privilege/authorization gap** (a logged‑in user can CRUD any table row), **not** an unauthenticated open door.

| Endpoint | Handler | Capability |
|---|---|---|
| `GET /api/db/tables` | `getTables` | list all `public` tables + columns via `information_schema` (`db.controller.js:9`) |
| `GET /api/db/tables/:tableName` | `getTableData` | `SELECT *` ordered by `created_at` (else `id`), **LIMIT 100** (`db.controller.js:37`, `:59`) |
| `PUT /api/db/tables/:tableName/:id` | `updateTableRow` | update **exactly one column** (`WHERE id = $2`) (`db.controller.js:68`, `:95`) |
| `DELETE /api/db/tables/:tableName/:id` | `deleteTableRow` | delete one row by id (`db.controller.js:109`, `:121`) |

**Injection posture:** table and column names are **string‑interpolated** into SQL (`"${tableName}"`, `"${columnName}"`, e.g. `db.controller.js:59`, `:95`). The mitigation is that both are **validated to exist** against `information_schema` first (`db.controller.js:42‑49`, `:84‑89`, `:114‑119`), and a Zod schema (`updateRowSchema`, `db.controller.js:5‑7`) forces **exactly one** column per `PUT`. Values are properly parameterized. **Assumptions to note:** `updateTableRow`/`deleteTableRow` assume every table has an `id` column (`WHERE id = …`) — tables keyed on `SERIAL id` are fine, but the `WHERE id = $` string will fail on any table without an `id`. **Decided direction (product owner):** re‑home this behind the `ADMIN_PHONE_NUMBERS` allowlist (doc 04) rather than plain `authenticateToken`; documented in doc 17 as a pending code change, not yet done.

---

## 11. Legacy / cleanup hazards

**SQLite is dead but still shipped.** `sqlite.service.js` runs a `better-sqlite3` `initDB()` at import time against `backend/src/database/slayhealth.db`, but **nothing in `backend/src/` imports it** — only test scripts and scratch seeders do. Its schema is a **stale subset** of Postgres (its `matches` has no `user_id`/`presentation_json`/`ai_narrative`; its `reports` has no `is_mock`; it lacks `users`/`otp_requests`/`user_sessions`/`prospect_invites`/`whatsapp_messages` entirely). Confirmed on disk:

| Artifact | Status |
|---|---|
| `backend/slayhealth.db` | git‑tracked, **0 bytes** |
| `backend/src/database/slayhealth.db` | git‑tracked, **~2.9 MB binary** |
| `better-sqlite3 ^12.11.1` | still a **production dependency** (and a native module — a build‑break risk, doc 03 §1) |

The hazard is twofold: a new dev editing the wrong store, and a **PII‑laden binary DB committed to git**. Decided direction: delete the service, the dependency, and both binaries (doc 03 §10, doc 21). *(This doc changes no files — that's a separate code change.)*

**`usg_reports` / `usg.routes.js` are legacy too.** `usg.controller.js` writes `usg_reports`, but **`usg.routes.js` is not mounted** — `server.js:88` remaps `/api/usg` to `radiologyRoutes` ("Backwards compatibility redirect"). So **new ultrasound data lands in `radiology_reports`**, and `usg_reports` survives only as the **read‑only fallback** inside `fetchRadiologyByIdentity` (`radiologyLookup.service.js:42‑65`) for pre‑migration USG‑only rows.

---

## 12. All TTL / lifetime constants in one place

Verbatim from source. Auth/session details live in **doc 04**; this table is the storage‑lens summary. All non‑auth product thresholds elsewhere are **[interim]**; the values here are operational, not clinical.

| Constant | Value | Where |
|---|---|---|
| OTP expiry | **5 min** (`OTP_EXPIRY_MINUTES=5`) | `otp.service.js:9` |
| OTP lockout | **900 s** (`LOCKOUT_SECONDS=900`) | `otp.service.js:10` |
| OTP send limit / minute | **3** (`MINUTE_LIMIT=3`) | `otp.service.js:11` |
| OTP send limit / hour | **5** (`HOUR_LIMIT=5`) | `otp.service.js:12` |
| OTP max verify attempts | **5** (`MAX_VERIFY_ATTEMPTS=5`) | `otp.service.js:13` |
| OTP/RL bypass phone | `+917063992027` (and `DISABLE_RATE_LIMIT=true`) | `otp.service.js:53` |
| bcrypt salt rounds | **10** (OTP hash & refresh hash) | `otp.service.js`, `jwt.service.js:121` |
| Refresh‑session validity | **7 days** — `created_at + INTERVAL '7 days' AND revoked_at IS NULL` (no `expires_at` column) | `jwt.service.js:146` |
| LLM cache TTL | **2 592 000 s (30 days)** | `llm.service.js:72` |
| Report cleanup age | **> 1 day**, hourly, orphan pathology reports only | `postgres.service.js:299`, `server.js:107` |
| Free match quota | `runs_used >= 1` blocks | `quota.js:18` |
| Free chat quota | `chats_used >= 5` blocks | `quota.js:49` |

**Quota gotcha:** `checkMatchQuota`/`checkChatQuota` **fail open** when no `userId` resolves (dev convenience, `quota.js:9`, `:39`) and **increment the counter as a side effect of the check** (`quota.js:26`, `:57`) — a request that later errors out has still spent the quota. **Redis nullability gotcha:** if `UPSTASH_REDIS_REST_URL`/`_TOKEN` are unset, `redis.service.js` exports **`null`** (`redis.service.js:16‑20`); OTP rate‑limiting then **fails open** (`otp.service.js:56‑60`) and LLM caching is skipped. Every Redis consumer null‑checks — you must too.

---

## Open items (see doc 21 for the authoritative list)

- **DPDP / retention debt (REG‑06):** no general retention policy — only orphan pathology reports are pruned (§7); `radiology_reports`, `usg_reports`, `matches`, `otp_requests`, `user_sessions`, `whatsapp_messages` grow unbounded. Partner‑erasure gaps for pre‑`user_id` radiology/USG rows and `whatsapp_messages` (§8). An in‑product "DPDP‑compliant" claim is shown while the consent‑ledger/DSAR/retention machinery is unbuilt.
- **`/api/db` authorization gap:** authenticated but **not** admin‑gated — any logged‑in user gets per‑table read / single‑column write / row delete (§10). Decided fix: re‑home behind `ADMIN_PHONE_NUMBERS` (doc 04, doc 17).
- **Legacy SQLite to remove:** dead `sqlite.service.js`, the `better-sqlite3` prod dependency, and **two git‑tracked binary `.db` files** (one ~2.9 MB, PII risk) (§11).
- **Stored‑but‑unrendered content (OPP‑W7‑01):** `presentation_json.couple_synthesis/strengths/opportunities/sti_gate` and `ai_narrative` are persisted but currently render only in the PDF; the interactive web story uses hardcoded prose (doc 16/17).
- **Cleanup fragility & no session/OTP GC:** the hourly cleanup is an in‑process `setInterval`, not a cron (§7); expired `otp_requests`/`user_sessions` are never purged.

---

*Next: `06_extraction_pipelines_pathology_and_radiology.md` — how a raw PDF becomes the `reports.extracted_json` and `radiology_reports.findings_json` this doc catalogs.*
