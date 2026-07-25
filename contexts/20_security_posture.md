# Security Posture & Exposures (Consolidated Triage)

**Doc 20 of 22** · Audience: a solo full‑stack successor · Prerequisite: `04_auth_session_and_security.md`, `02_architecture_and_backend_core.md` (and keep `21_known_issues_review_corpus_and_roadmap.md` open).

Goal of this doc: give you **one place to see every known security exposure**, ranked, with a pointer to the doc that owns the fix detail. It is a **triage index, not a replacement** for the owning docs — read it to prioritise, then jump to the deep doc for the how. It also states plainly **what is already sound** so you don't waste a hardening budget re‑securing things that are fine.

---

## 1. How to use this doc

This is a **map, not a ledger**. Each exposure below has:

- a **severity** (my house rating — treat as a starting point, not gospel),
- a **one‑line "where"** with a real `file:line` anchor,
- an **owning doc** where the mechanism is explained in full, and
- a **fix direction**.

The single **severity‑ranked backlog of everything still open** (security + clinical + UX + reg) is **doc 21** — that's the authoritative status ledger. When this doc and doc 21 disagree on whether something is fixed, **doc 21 wins**. Finding IDs like `WS8‑02`, `UX3‑05`, `REG‑06`, `UX7‑02` point into the self‑review corpus (repo‑root `SLAYHEALTH_DEEP_REVIEW.md` / `SLAYHEALTH_UX_REVIEW.md` / `REG-06_DPDP_SUBSTANTIATION_AUDIT.md` / `WORKREPORT_2026-07-*.md`, plus `review/*.md` — all present in the working tree; verify with `ls`).

One framing note before the list: **the auth foundation is genuinely good.** The exposures below are overwhelmingly **authorization** gaps (who may touch *which* object), not **authentication** gaps (proving *who you are*). Don't let the length of the list convince you the login system is broken — it isn't.

---

## 2. What is SOUND — do not "fix" these

These are load‑bearing and correct. Changing them without cause will *introduce* risk. Detail lives in doc 04 (auth) and doc 09 (scoring gate).

| Sound property | Where | Why it's right |
|---|---|---|
| **Phone + WhatsApp OTP identity** (no passwords) | `otp.service.js` (`createOTPRequest`/`verifyOTPRequest`) | 6‑digit `crypto.randomInt` OTP, bcrypt‑hashed (rounds 10), 5‑min expiry, 3/min + 5/hr send limits, 15‑min lockout after 5 bad tries. No password store to leak. |
| **JWT rotate‑and‑revoke sessions** | `jwt.service.js:189` `rotateSession` | Refresh token is bcrypt‑hashed into `user_sessions`, and every `/refresh` **revokes the old session then mints a new one** — a stolen refresh token dies the instant the real client next refreshes. |
| **httpOnly refresh cookie, env‑gated** | `auth.controller.js` cookie flags | `{ httpOnly:true, secure: NODE_ENV==='production', sameSite: prod?'none':'lax', maxAge 7d }`. Correct for the cross‑origin prod split; not JS‑readable. (Caveat: a copy is *also* mirrored to localStorage — see §3.) |
| **Single‑flight refresh** | `frontend/src/utils/api.js` `refreshAuthSession` | Coalesces all callers in one browser context onto ONE `/refresh`, so the no‑grace‑window rotation doesn't self‑DoS a single tab. |
| **Production JWT boot‑guard** | `jwt.service.js:7` | In `production` the module **throws at load** if `JWT_SECRET`/`JWT_REFRESH_SECRET` are unset — it refuses to boot on forgeable fallback secrets. |
| **CORS allowlist + `trust proxy 1`** | `server.js:29`, `server.js:36-59` | Hardcoded allowlist (`localhost:3000/3001`, `https://demo.slay.health`) + `ALLOWED_ORIGINS` CSV; `credentials:true`; dev‑only LAN regex. `trust proxy 1` keys the rate limiter off the real client IP through exactly one hop. |
| **Global 60 req/min/IP limiter** | `server.js:64-78` | Covers all `/api/*`. Its `message` is a **JSON object on purpose** (UX7‑01) so a tripped limit doesn't crash the frontend's JSON parser. |
| **Engine `/analyze` routes are auth‑gated** | `WS8‑02` (confirmed good) | Every clinical engine route 401s anonymously. Do **not** add redundant guards. |
| **The STI score cap is un‑bypassable in the stored path** | `reportGeneration.service.js:182-184` | `computeGatedComposite` is the ONLY writer of `matches.compatibility_score`; a positive serology result forces `Math.min(score,50)` before persistence. See doc 09 — and the AI‑PDF caveat in §3. |

---

## 3. Exposure table — the whole surface at a glance

Severity is: **High** = an authenticated user can reach another user's PII / corrupt data today; **Med** = real weakness needing a specific precondition or with a partial mitigation; **Low** = hygiene / defense‑in‑depth.

| Sev | Exposure | Where (`file:line`) | Owning doc |
|---|---|---|---|
| **High** | **IDOR: match reads/PDF have no ownership filter** — `getMatch`, `generatePDFReport`, `getMatchRadiology`, `compileInfographicsData` all `SELECT * FROM matches WHERE id = $1` with no `user_id` check | `compatibility.controller.js:122, 193, 253, 268` | 10 |
| **High** | **`listMatches` trusts the `userId` QUERY PARAM**, not `req.user.id` — pass any user's id, list their matches | `compatibility.controller.js:48-51` | 10 |
| **High** | **`/db` table editor: authenticated but not authorized** — `router.use(authenticateToken)` is present, yet ANY logged‑in user gets read + single‑column write + row delete on ANY public table | `db.routes.js:8`, `db.controller.js:37-131` | 05, 17 |
| **Med** | **Share token signed with the ACCESS secret** (`JWT_SECRET`), not a distinct key | `jwt.service.js:84-89` | 04, 10 |
| **Med** | **WhatsApp inbound webhook signature not verified** — no `X-Hub-Signature-256` check; POST body trusted on shape alone | `invite.controller.js:934-1014` | 12 |
| **Med** | **Access token accepted via `?token=` query param** — leaks into logs, referrers, proxy access logs | `auth.middleware.js:17-19` | 04 |
| **Med** | **Fail‑open metering** — quota is charged *before* the op and never refunded; and it `next()`s unmetered if no userId resolves | `quota.js` (`checkMatchQuota`/`checkChatQuota`) | 04 |
| **Med** | **Fail‑open Redis** — if `UPSTASH_*` unset, `redis` is `null` → OTP rate‑limiting silently skipped, LLM cache skipped | `redis.service.js:4-20`, `otp.service.js` | 05 |
| **Med** | **Ungated "Trigger Mock Report" button** injects fabricated radiology into real records, in the shipped build | `frontend/src/app/core-engine/usg/page.js:316, 337, 372` | 16, 17 |
| **Low** | **No `helmet` / security headers** — no CSP, HSTS, X‑Content‑Type‑Options, frame options | `server.js` (absent) | 02 |
| **Low** | **AI‑PDF bypasses the gated composite** — `generateAIPDFReport` regenerates a presentation via DeepSeek, skipping `computeGatedComposite`, so its STI/genetics logic lives only in a prompt | `compatibility.controller.js:320-367` | 10, 11 |
| **Low** | **Plaintext live secrets in `backend/.env`** + a **dead OpenRouter key** (401) | `backend/.env` (on disk) | 03 |
| **Low** | **cookie‑parser mounted with no secret** — signed cookies unavailable | `server.js:61` | 02 |

The rest of this section expands each row a security reviewer will want the reasoning on.

---

### 3.1 IDOR on match reads, PDF, radiology, infographics (High)

Five controllers fetch a match **by id alone** and return it (or stream its PDF) with **no check that the match belongs to the caller**:

```
getMatch                 compatibility.controller.js:253   SELECT * FROM matches WHERE id = $1   → returns raw row
generatePDFReport        compatibility.controller.js:122   SELECT * FROM matches WHERE id = $1   → streams full PDF
getMatchRadiology        compatibility.controller.js:193   SELECT * FROM matches WHERE id = $1   → maps radiology
compileInfographicsData  compatibility.controller.js:268   SELECT * FROM matches WHERE id = $1   → recompiles presentation
```

Contrast with the **one** controller that does it right — `createShareLink` at `compatibility.controller.js:103` explicitly rejects when `match.user_id !== req.user.id`. That check is the template; the four reads above are missing it.

**Impact:** any logged‑in user who learns (or guesses — see §4) a `matchId` can read the couple's full clinical analysis, download their PDF, and pull their radiology. This is the couple's most sensitive data.

**Fix direction:** add the same `match.user_id !== req.user.id → 403` guard to all four. The PDF route is subtle — it's reachable via `authenticateOrShareToken` (a valid `?shareToken` sets `req.viaShareLink` and never sets `req.user`), so the guard must be "share‑link OR owner", not a bare `req.user.id` compare. (Owning detail: doc 10.)

### 3.2 `listMatches` trusts a query param (High)

`listMatches` (`compatibility.controller.js:48-51`) reads `const { userId } = req.query` and runs `WHERE user_id = $1`. It **never consults `req.user.id`.** Any authenticated caller can enumerate another account's match list by changing the query string. Fix: derive `userId` from `req.user.id` and ignore the param (or 403 on mismatch).

### 3.3 The `/db` admin editor — an AUTHORIZATION gap, framed accurately (High)

Be precise about this one, because the source maps mis‑state it. **It is NOT an open/unauthenticated door.** `db.routes.js:8` does `router.use(authenticateToken)` — every `/api/db/*` endpoint requires a valid access token.

The gap is **authorization, one rung up**: there is **no admin/role check**. `authenticateToken` only proves you're *some* logged‑in user; it doesn't prove you're staff. So **any logged‑in user** can:

- `GET /api/db/tables` — reflect the whole schema (`db.controller.js:9`),
- `GET /api/db/tables/:tableName` — read up to 100 rows of ANY public table (`:37`),
- `PUT /api/db/tables/:tableName/:id` — write one column of any row (`:68`),
- `DELETE /api/db/tables/:tableName/:id` — delete any row by id (`:109`).

Injection is *mitigated but not eliminated*: table/column names are string‑interpolated into SQL (`"${tableName}"`, `"${columnName}"`) but validated against `information_schema` first, and `updateRowSchema` (Zod) forces exactly one column per PUT. The real problem isn't injection — it's that **a non‑admin can CRUD every row in the database**, including `users`, `matches`, and `user_sessions`.

Compare the **correct** pattern next door: the admin WhatsApp board runs `authenticateToken → requireAdmin` (`admin.routes.js`), where `requireAdmin` (`admin.middleware.js`) checks `req.user.phone` against the `ADMIN_PHONE_NUMBERS` CSV allowlist. `/db` simply doesn't chain that second middleware.

**Decided fix (this handoff):** re‑home `/db` behind the `ADMIN_PHONE_NUMBERS` allowlist (add `requireAdmin` after `authenticateToken`). This is documented as a direction in doc 17 and is a **separate code change, not yet done**. (Owning detail: doc 05 for the CRUD surface, doc 17 for the re‑home decision.)

### 3.4 Share token signed with the access secret (Med)

`generateShareToken` (`jwt.service.js:84`) mints a 48h `{matchId, type:'match_share'}` token signed with **`JWT_SECRET` — the same key that signs access tokens.** The `type` field keeps the two apart functionally (`verifyShareToken` at `:97` rejects anything that isn't `match_share`), so it isn't exploitable today. But it **couples share‑link validity to access‑token key rotation**: rotate `JWT_SECRET` to respond to an access‑token incident and you silently invalidate every outstanding share link — and vice‑versa, you can't revoke share links independently. Fix: sign share tokens with a dedicated `JWT_SHARE_SECRET`. (Owning detail: doc 04.)

### 3.5 WhatsApp webhook signature unverified (Med)

`handleWhatsAppWebhook` (`invite.controller.js:934`) is fully **public** (no `authenticateToken` — correct, Meta calls it). The GET verify challenge checks `hub.verify_token` against `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (`:944`, with an insecure default fallback). But the **POST handler trusts the body on shape alone** — there is **no `X-Hub-Signature-256` HMAC verification** against the app secret. A forged POST matching the `whatsapp_business_account` shape can drive `updateStatusByWaMessageId` and write inbound rows to `whatsapp_messages`.

Blast radius is currently small — the handler only updates message‑status and appends to the log; nothing security‑critical branches on it, and invite‑status mapping is dead anyway (invites are copy‑link, so they never get a `whatsapp_message_id` — see doc 12). But it's still an unauthenticated write path. Fix: verify the Meta signature header before processing. (Owning detail: doc 12.)

### 3.6 Query‑param access tokens (Med)

`auth.middleware.js:17-19` accepts the access token from `?token=` when there's no `Authorization: Bearer` header. Query strings leak into server logs, the `Referer` header on outbound links, and any intermediary proxy's access log. Access tokens are short‑lived (15m) which limits the window, but it's still a needless credential‑in‑URL. Fix: drop the query‑param path (the share‑PDF route uses the distinct `?shareToken`, not `?token`, so removing `?token` doesn't break sharing).

### 3.7 Fail‑open metering and fail‑open Redis (Med)

Two independent fail‑open behaviours, both in the "degrade toward *allowing*" direction:

- **Quota** (`quota.js`): `userId` resolves as `req.user?.id || x-user-id header || body.userId`; if **none** resolves, the middleware `next()`s **unmetered**. It's only safe because both mounts sit behind `authenticateToken` — do not reuse these on an unauthenticated route. Separately, the counter is **incremented before** the match/chat runs and **never refunded** on failure (`UX7‑02`/`UX7‑04`), so a failed op still burns a free run/chat. And `reset-quota` is self‑serve, so the paywall is voluntary anyway.
- **Redis** (`redis.service.js:4-20`): if `UPSTASH_*` env is missing, the module exports `null` and **OTP rate‑limiting silently fails open** (`otp.service.js` allows), plus the 30‑day LLM cache is skipped. In prod with Redis configured this is moot; the risk is a misconfigured deploy quietly removing the OTP brute‑force / send‑spam brake with only a log line.

Fix direction: fail *closed* on OTP rate‑limiting when Redis is unavailable (or at least alert loudly), and move the quota increment to *after* success. (Owning detail: doc 04 for quota, doc 05 for Redis.)

### 3.8 Ungated "Trigger Mock Report" button (Med)

`frontend/src/app/core-engine/usg/page.js` renders **"Trigger Mock Report"** controls (`:316, :337, :372, :381, :478, :499`) that inject fabricated radiology (`is_mock` rows, e.g. `radiology_nuptia_contribution:27.5`) into **real** records used by real scoring. It ships in the production build ungated (`UX3‑05`, P1). This is a data‑integrity exposure, not an access one: a curious user can pollute their own couple's clinical result with invented findings. Fix: gate behind `NODE_ENV`/a flag, or remove. (Owning detail: doc 16/17.)

### 3.9 No security headers (Low)

`server.js` mounts `cors`, `express.json`, `cookie-parser`, and the rate limiter — but **no `helmet`**. There is no CSP, no HSTS, no `X-Content-Type-Options: nosniff`, no frame‑ancestors. HTTPS is terminated at Render's proxy, not enforced in‑app. Low severity for a JSON API behind a proxy, but `helmet()` is a one‑line defense‑in‑depth win. Fix: `app.use(helmet())` early in the chain. (Owning detail: doc 02.)

### 3.10 AI‑PDF diverges from the gated score (Low, but know it)

The stored, gated composite is un‑bypassable (§2). But `generateAIPDFReport` (`compatibility.controller.js:320-367`) is a **second presentation pipeline**: it calls `aiPresentationService.generateAIPresentationMap` (DeepSeek) at render time and **does not run `computeGatedComposite`**. Its STI‑safety, genetics, and critical‑floor logic live only in the prompt + a different post‑process. So the AI‑PDF's numbers/statuses **can differ from the stored, gated ones**, including the STI cap. It's "Low" as a *security* item (it's an output rendering, not an access hole) but a reviewer must know the gate's guarantee holds for the stored path and the normal PDF, **not** for the AI‑PDF. Fix direction: route the AI‑PDF through the gated composite, or clearly scope it as illustrative. (Owning detail: docs 10, 11.)

### 3.11 Plaintext secrets + dead OpenRouter key (Low)

`backend/.env` holds **live plaintext credentials** — Supabase DB password, WhatsApp access token, JWT secrets, Upstash token. The **OpenRouter key is currently dead (401)**, which is why AI narrative/chat silently falls back to templates (expected, not a bug — doc 11). Rotate **everything** on handoff and move to the platform secret store. This is item §10.4 in doc 03. (Owning detail: doc 03.)

---

## 4. Why match‑id unguessability only *partially* covers the IDOR reads

Match ids are `uuidv4()` (`compatibility.controller.js:17`) — 122 bits of randomness, not sequential. So an attacker can't just iterate `1,2,3…` to walk every couple's report. That's a **real mitigating factor** and it's why these IDOR reads haven't been an incident.

But unguessability is **secrecy, not authorization** — it reduces the gap, it does not close it. A `matchId` is not a secret in practice: it appears in URLs, is handed to `navigator.share`/copy‑link flows, sits in browser history and server logs, and is embedded in generated PDF filenames (`SlayHealth_Premarital_Report_${matchId}.pdf`, `:164`). Anywhere a `matchId` leaks, the missing ownership check means the holder gets the full report. **Treat the uuid as a speed bump, and still add the `user_id` guard.** (This is exactly the "IDOR‑prone when adding features or exposing ids" warning in doc 10.)

```
Guessable id (sequential)   → attacker enumerates ALL matches         [not the case here]
Unguessable id (uuidv4)     → attacker needs the id to leak first     [current state]
Unguessable id + ownership  → leaked id is still useless to a stranger [the fix]
```

---

## 5. Data‑protection posture (what exists, what's absent)

The subsystem docs (04, 05, 12) own the mechanics; here's the security‑relevant summary.

**What's implemented (genuine, citable):**

| Control | Where | Note |
|---|---|---|
| Draft survives logout, namespaced per uid | `CompatibilityContext.clearAllSessionStates` keeps `slayhealth_profile_draft_<uid>` | Deliberate (fix `4457b90`) — a spurious logout used to wipe in‑progress work. |
| Account‑holder erasure (DPDP right) | `auth.controller.deleteAccount` (transactional) | Real cascade: explicit `chat_sessions`+`reports` delete, then `DELETE users` cascades matches/sessions/invites/radiology. |
| Post‑submission partner withdrawal | `invite.controller.purgeSubmittedProspectData` | Hard‑deletes the prospect's reports/radiology/placeholder user; sets `erased_after_submission=TRUE`. |
| Consent audit trail | `prospect_invites.consent_*`, `self_entry_consents` | Timestamp/IP/user‑agent captured for both invite and self‑entry paths. |
| Orphan‑report prune (1 day) | `postgres.service.cleanupOldReports`, hourly `setInterval` (`server.js:99`) | Deletes unreferenced `reports` >24h. **In‑process interval, not a cron** — dies with the process, double‑runs under multiple instances. Aggressive + undocumented (a test upload can vanish overnight). |
| LLM cache TTL | `llm.service` `setex` 2592000s (30 days) | A cache, not a retention policy. |
| OTP redaction | `whatsapp.provider.js` | OTP text redacted to `[redacted]` before it hits the `whatsapp_messages` log. |

**What's absent (the REG‑06 / `WS_REG` open risk):** there is **no DPDP consent ledger, no general retention/deletion policy or configurable retention window, no DSAR access/portability flow, and no breach‑notification machinery.** `cleanupOldReports` prunes *only* orphan pathology reports; `radiology_reports`, `usg_reports`, `matches`, `otp_requests`, `user_sessions`, and `whatsapp_messages` **grow unbounded**. There are also two disclosed erasure gaps: the **invited partner's** pre‑`user_id`‑migration radiology/usg rows (linked only by free‑text name) are unreachable by any erasure path, and `whatsapp_messages` has no `user_id` so it survives account deletion.

**Regulatory posture is an open risk, and this doc takes no position on it.** REG‑06 found the in‑product "DPDP‑compliant" framing largely unsubstantiated against the DPDP Act 2023 / Rules 2025. State that factually; do **not** assert a wellness‑vs‑SaMD classification, and keep any "confirm with a qualified doctor" framing intact — that's pending your decision and legal counsel. The full REG‑06 ledger is doc 21.

---

## 6. Suggested triage order for a production launch

Ranked by exposure‑to‑effort. This is a recommendation, not a mandate — reconcile against doc 21 before committing a sprint.

```
1. CLOSE THE IDOR + /db AUTHZ  ── highest exposure, smallest diff
   • Add user_id/share-link ownership guard to getMatch / generatePDFReport /
     getMatchRadiology / compileInfographicsData (copy createShareLink's check).
   • Derive listMatches userId from req.user.id, not the query param.
   • Chain requireAdmin after authenticateToken on /api/db/* (re-home decision, doc 17).

2. WEBHOOK SIGNATURE + SHARE-TOKEN KEY  ── close the two crypto/trust gaps
   • Verify X-Hub-Signature-256 on the WhatsApp webhook POST.
   • Sign share tokens with a dedicated JWT_SHARE_SECRET.

3. HEADERS + FAIL-OPEN HARDENING  ── defense in depth
   • app.use(helmet()).
   • Fail closed on OTP rate-limit when Redis is down; drop ?token= query auth.
   • Move quota increment to after success; gate/remove the Mock Report button.

4. SECRETS ROTATION  ── do on handoff regardless
   • Rotate every credential in backend/.env; replace the dead OpenRouter key;
     move to the platform secret store.
```

Do **not** reorder (1) behind (4) — the IDOR/authz gaps are reachable by any logged‑in user *today*, whereas plaintext‑secrets exposure requires filesystem/repo access you control.

---

## 7. The decided cleanup this handoff carries

Two product‑owner decisions touch this area (both documented in doc 17, both **separate code changes not yet done**):

1. **Re‑home `/db` behind the `ADMIN_PHONE_NUMBERS` allowlist** — closes §3.3 by adding the same `requireAdmin` gate the admin WhatsApp board already uses.
2. **Delete the orphaned `/chronic`, `/mfr`, `/usg` duplicate engine pages** — these legacy standalone pages (including the ungated Mock Report affordance in `core-engine/usg`) shrink the attack surface once removed.

Neither is implemented yet; both are on the roadmap in doc 21.

---

## Open items (see doc 21 for the authoritative list)

- **IDOR on `getMatch`/`generatePDFReport`/`getMatchRadiology`/`compileInfographicsData` + query‑param trust in `listMatches`** (High) — the single highest‑exposure cluster; `createShareLink` already has the pattern to copy. (Doc 10.)
- **`/db` authorization gap** (High) — authenticated but not admin‑gated; decided fix is re‑home behind `ADMIN_PHONE_NUMBERS`. (Docs 05, 17.)
- **Unsigned WhatsApp webhook + share token on the access secret** (Med) — add HMAC verification and a dedicated share‑signing key. (Docs 12, 04.)
- **Fail‑open OTP rate‑limiting (Redis‑down) and fail‑open/charge‑before quota** (Med) — the OTP brute‑force brake silently disappears on a misconfigured deploy. (Docs 04, 05.)
- **DPDP substantiation gap (REG‑06 / `WS_REG`)** — no consent ledger, retention policy, DSAR flow, or breach machinery; partner‑erasure and `whatsapp_messages` gaps; unsubstantiated in‑product compliance claim. Regulatory posture remains an open risk for your decision + counsel. (Doc 21.)

---

*Next: `21_known_issues_review_corpus_and_roadmap.md` — the authoritative severity‑ranked backlog and how to read the `review/` corpus behind every finding ID cited here.*
