# Authentication, Sessions, Quota & Security Model

**Doc 04 of 22** · Audience: a solo full‑stack successor · Prerequisite: `02_architecture_and_backend_core.md`, `03_setup_deployment_and_environment.md`.

Goal of this doc: give you the **complete auth picture** — how a phone number becomes a trusted `req.user.id`, the three‑token model and the DB‑backed rotate‑and‑revoke sessions behind it, why the frontend needs a single‑flight refresh, how OTPs and quota are metered, who counts as an admin, and the security debt you are inheriting. There are **no passwords anywhere in this system**; if you internalize one thing, make it the no‑grace‑window rotation rule in §6.

---

## 1. Overview: no passwords, identity = phone + WhatsApp OTP

SlayHealth has **no password field, no email/password login, no OAuth**. Identity is proven exactly one way: a user enters a phone number, receives a **6‑digit OTP over WhatsApp**, and types it back. A successful verify **upserts a `users` row keyed on `phone_number`** and issues tokens. Everything downstream — the clinical engines, the match orchestration, the AI chat — trusts `req.user.id` set by the JWT middleware and never re‑checks the phone.

That design has three consequences you will feel immediately:

1. **You cannot log in locally without a way to receive (or read) the OTP.** WhatsApp delivery is a hard dependency — `whatsapp.provider.js` throws (→ HTTP 500) if its creds are missing (§5). Your three escape hatches are the **bypass phone `+917063992027`**, the **`DISABLE_RATE_LIMIT` flag** + reading the OTP hash‑source from the DB, or minting a session directly (doc 19). There is **no dev console OTP printer**.
2. **The `users` row is created lazily at first successful verify**, not at some separate signup step. A brand‑new phone becomes a real (if nameless) account the instant it verifies an OTP — `is_new_user` in the login response just tells the client to collect a name afterward.
3. **The phone number is the whole identity and the whole recovery story.** Lose the number, lose the account. There is no secondary factor and no reset flow.

```
        ┌─────────┐  POST /login {phone}   ┌──────────────┐  template msg   ┌──────────┐
 user ─▶│ frontend │ ─────────────────────▶ │  backend      │ ──────────────▶ │ WhatsApp │─▶ user's phone
        └─────────┘                         │ otp.service   │                 │ Cloud API│
             │                              └──────────────┘                 └──────────┘
             │  POST /verify {phone, otp}          │
             ▼                                      ▼
        setAccessToken(access 15m)  ◀── {accessToken, refreshToken, user} + httpOnly cookie
        localStorage refresh + user       users UPSERT ON CONFLICT(phone_number)
```

---

## 2. The token model

Three distinct JWTs, all minted in `backend/src/services/auth/jwt.service.js`. Know which secret signs which and where each lives on the client — mixing them up is the root of most auth confusion.

| Token | TTL | Where minted | Signed with | Payload | Lives on client as | Purpose |
|---|---|---|---|---|---|---|
| **Access** | `15m` | `generateTokens` `jwt.service.js:24` | `JWT_SECRET` | `{ sub: userId, phone, type: 'access' }` | **in‑memory JS module var** (`utils/api.js:3`) | Bearer credential on every API call |
| **Refresh** | `7d` | `generateTokens` `jwt.service.js:31` | `JWT_REFRESH_SECRET` | `{ sub: userId, phone, type: 'refresh' }` | **httpOnly cookie `refreshToken`** *and* **`localStorage.slayhealth_refresh_token`** | Rotate a new access token without re‑OTP |
| **Share** | `48h` | `generateShareToken` `jwt.service.js:84` | `JWT_SECRET` *(the access secret)* | `{ matchId, type: 'match_share' }` | in a share URL query param | Public, match‑scoped read of the PDF route (§11) |

Constants verbatim (`jwt.service.js:14‑16`): `ACCESS_EXPIRY = '15m'`, `REFRESH_EXPIRY = '7d'`, `SHARE_EXPIRY = '48h'`.

Key facts:

- **Two secrets, not one.** Access and refresh are signed with *different* secrets so a leaked/forgeable access token can't be replayed as a refresh token. But note the **share token reuses `JWT_SECRET`** (the access secret) — see §11 for why that couples share‑link validity to access‑key rotation.
- **`verifyAccessToken` / `verifyRefreshToken` / `verifyShareToken` all check `decoded.type`** (`jwt.service.js:48`, `:66`, `:100`) and return `null` on any failure. A refresh token presented as an access token fails the `type !== 'access'` guard even though the signature is valid — type confusion is closed.
- **The access token does not survive a hard page refresh.** It lives only in `accessToken` (a module‑level variable, `utils/api.js:3`). Session continuity after a reload depends entirely on the **mount silent‑refresh** (§8) reconstructing it from the cookie / localStorage refresh token. Do **not** assume `getAccessToken()` is populated on first render.
- **Production boot‑guard:** `jwt.service.js:7‑9` throws at module load if `JWT_SECRET` or `JWT_REFRESH_SECRET` is unset while `NODE_ENV==='production'`. In dev it silently falls back to hardcoded secrets `'fallback_jwt_access_secret_key_12345'` / `'fallback_jwt_refresh_secret_key_12345'` (`jwt.service.js:11‑12`). **Dev‑signed tokens are forgeable — never point a dev client at a prod DB or vice versa.** (Also covered in doc 03 §7.)

---

## 3. Cookie flags verbatim and the NODE_ENV dependency

The refresh cookie is set **identically in three places** — `verifyOtp` (`auth.controller.js:121`), `refreshSession` (`auth.controller.js:190`), and cleared with the same flag set in `logoutUser` (`auth.controller.js:243`). Verbatim:

```js
res.cookie('refreshToken', tokens.refreshToken, {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge:   7 * 24 * 60 * 60 * 1000  // 7 days
});
```

| Flag | Dev (`NODE_ENV≠production`) | Prod (`NODE_ENV==='production'`) |
|---|---|---|
| `httpOnly` | `true` | `true` |
| `secure` | `false` | `true` |
| `sameSite` | `'lax'` | `'none'` |
| `maxAge` | 7 days | 7 days |
| name | `refreshToken` | `refreshToken` |

**Why `NODE_ENV` is load‑bearing:** in prod the frontend (`https://demo.slay.health`) and backend (Render) are **different origins**, so the refresh cookie is a *cross‑site* cookie. Browsers only send a cross‑site cookie when `sameSite:'none'` **and** `secure:true` **and** the connection is HTTPS. If the deployed backend has `NODE_ENV` anything other than `production`, the cookie is minted `sameSite:'lax'; secure:false`, the browser silently refuses to send it cross‑site, and **every user is logged out on the next reload**. This is the single most common "why won't sessions persist in prod" failure and it is invisible in the logs. (Doc 03 §6 lists it as a topology requirement; this is the code that enforces it.)

> Gotcha: `cookie-parser` is mounted in `server.js` with **no secret**, so signed cookies are unavailable — the refresh cookie is unsigned. Its integrity comes entirely from the JWT signature inside it, not the cookie layer.

---

## 4. OTP flow end‑to‑end

All OTP logic lives in `backend/src/services/auth/otp.service.js`; the HTTP handlers are `loginUser` / `verifyOtp` in `auth.controller.js`.

### Request an OTP — `POST /api/auth/login`

1. **Normalize** the phone to E.164 via `normalizePhone` (`otp.service.js:20`). Rules: strip spaces/dashes/parens; a leading `+` is kept; **exactly 10 digits → prefix `+91`** (India default, `otp.service.js:28`); `91`+12 digits → `+`‑prefixed as‑is. A `null`/non‑string returns `null` → 400.
2. **Rate‑limit check** `checkRateLimit` (`otp.service.js:51`) against Redis.
3. **`createOTPRequest`** (`otp.service.js:112`): invalidate all prior active OTPs for the phone (`UPDATE otp_requests SET used_at = NOW() WHERE ... used_at IS NULL`), generate a fresh 6‑digit code, **bcrypt‑hash it (saltRounds 10)**, insert an `otp_requests` row with `expires_at = now + 5 min`.
4. **Deliver** via `notificationService.sendOTP` → WhatsApp (§5).
5. Respond `{ success, phone_number, is_new_user }`. `is_new_user` is `true` when there's no `users` row *or* the row has no `name` yet (`auth.controller.js:49`).

### Verify — `POST /api/auth/verify`

`verifyOTPRequest` (`otp.service.js:145`): re‑check lockout → select the latest unexpired, unused row (`ORDER BY created_at DESC LIMIT 1`) → `bcrypt.compare`. On mismatch, increment the Redis attempt counter and the DB `attempts` column; at `MAX_VERIFY_ATTEMPTS` (5) it invalidates the OTP and locks the phone for 15 min. On match it marks the row `used_at = NOW()` and clears the Redis attempt counter. Then `verifyOtp` upserts the user, mints tokens, saves a session, sets the cookie, and returns the body.

### Constants (verbatim, `otp.service.js:9‑13`) — all `[interim]` house values

| Constant | Value | Meaning |
|---|---|---|
| `OTP_EXPIRY_MINUTES` | `5` | OTP row valid 5 minutes `[interim]` |
| `MINUTE_LIMIT` | `3` | Max 3 OTP sends / minute / phone `[interim]` |
| `HOUR_LIMIT` | `5` | Max 5 OTP sends / hour / phone `[interim]` |
| `LOCKOUT_SECONDS` | `900` | 15‑minute lockout on limit breach or 5 bad verifies `[interim]` |
| `MAX_VERIFY_ATTEMPTS` | `5` | Bad‑OTP tries before lockout `[interim]` |
| bcrypt saltRounds | `10` | OTP hash cost (also the refresh‑token hash cost) `[interim]` |

Redis keys used: `otp:lockout:{phone}`, `otp:limit:min:{phone}`, `otp:limit:hour:{phone}`, `otp:attempts:{phone}`.

### The three escape hatches (and their traps)

- **Bypass phone `+917063992027`** — hardcoded at `otp.service.js:53` and `:147`/`:183`. It **skips rate‑limit, lockout, AND the max‑attempt lock everywhere**. This is a compiled‑in backdoor identity; it is also the value that has historically been the sole entry in `ADMIN_PHONE_NUMBERS` (§10). Treat its presence in source as security debt (§12).
- **`DISABLE_RATE_LIMIT='true'`** — disables **OTP‑send and OTP‑verify** limiting only (`otp.service.js:53`, `:147`). It does **not** touch the global 60‑req/min IP limiter in `server.js` (doc 02, doc 03 §5). The `.env.example` comment overstates it.
- **Redis fail‑open** — if the Redis client is `null` (unavailable), `checkRateLimit` **logs a warning and returns `{ allowed: true }`** (`otp.service.js:56‑61`). So with Redis down there is **no OTP rate limiting at all**. This is a deliberate local‑resilience choice with a real production abuse implication (§12).

> Cosmetic note: `generateOTP` uses `crypto.randomInt(100000, 999999)` (`otp.service.js:43`); the upper bound is exclusive, so `999999` is never generated. Harmless, but don't be surprised.

---

## 5. WhatsApp OTP delivery dependency

Delivery goes `notification.service.sendOTP` → `WhatsAppProvider.sendOTP` (`backend/src/services/notification/whatsapp.provider.js:22`). It POSTs a **template** message to the Graph API `https://graph.facebook.com/v22.0/{PHONE_NUMBER_ID}/messages`.

| Env var | Default | Role |
|---|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | — (required) | Sender id in the Graph URL |
| `WHATSAPP_ACCESS_TOKEN` | — (required) | Bearer for the Graph call |
| `WHATSAPP_TEMPLATE_NAME` | `'slay_otp_authentication'` | Template name, lang `en_US` |
| `WHATSAPP_SUPPORT_NUMBER` | `'+91 92172 46727'` | 2nd body param shown to the user |

**Template shape:** a `body` component with two text params `[otp, supportNumber]`, plus a `button` (sub_type `url`, index `0`) carrying the `otp` again (`whatsapp.provider.js:33‑70`).

**Hard‑500 on missing creds:** if `phoneNumberId` or `accessToken` is falsy, `sendOTP` **throws** (`whatsapp.provider.js:25‑29`); that propagates to `loginUser`'s catch → **HTTP 500** to the client. There is **no console/dev fallback that prints the OTP** — this is exactly why local login needs one of the §4 escape hatches.

**OTP is redacted from the audit log:** the outbound payload copy stored in `whatsapp_messages` has every text param overwritten with `'[redacted]'` before logging (`whatsapp.provider.js:88‑91`), so the live code never lingers in a readable table past its 5‑minute life.

---

## 6. Session storage & the rotate‑AND‑revoke sequence

Every successful login and every refresh creates a **`user_sessions` row** holding a **bcrypt hash of the refresh token** (never the token itself). DDL (`postgres.service.js:139‑148`):

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | uuid v4, the session id |
| `user_id` | TEXT → `users(id)` **ON DELETE CASCADE** | sessions die with the user |
| `refresh_token_hash` | TEXT NOT NULL | bcrypt(refreshToken, rounds 10) |
| `device_info` | TEXT | `user-agent` at mint |
| `ip_address` | TEXT | `req.ip` (real client via `trust proxy 1`) |
| `created_at` | TIMESTAMP | **anchors the 7‑day validity window** |
| `last_used_at` | TIMESTAMP | updated on validate, but **does NOT extend the window** |
| `revoked_at` | TIMESTAMP NULL | non‑null = dead |

### The rotation sequence (this is the defining rule of the subsystem)

`rotateSession` (`jwt.service.js:189`) runs on every `/refresh`:

```
rotateSession(oldSessionId, ...):
   1. revokeSession(old)   → UPDATE user_sessions SET revoked_at = NOW()   ← OLD TOKEN DEAD NOW
   2. generateTokens()     → new access + new refresh
   3. saveSession(new)     → INSERT a fresh user_sessions row
```

**The old refresh token is revoked BEFORE the new one is minted — there is NO grace window.** The instant a refresh token is used, it is dead. `findAndValidateSession` (`jwt.service.js:142`) only accepts sessions where `revoked_at IS NULL AND (created_at + INTERVAL '7 days') > NOW()`, so a second presentation of the just‑rotated token returns `null` → 401.

Two structural costs baked into `findAndValidateSession`:

- **O(n) bcrypt scan.** There is no lookup key on the token; it `SELECT`s *all* of the user's active sessions and `bcrypt.compare`s them one by one (`jwt.service.js:150‑160`). Cost grows with the user's login history.
- **No cleanup job.** `postgres.service.js` prunes **only `reports`** (unreferenced, >1 day, `cleanupOldReports` `:292`). **Nothing prunes revoked/expired `user_sessions` or used/expired `otp_requests`** — both tables grow unbounded, which makes the O(n) scan steadily worse. Sessions are only ever deleted by the `ON DELETE CASCADE` when the whole user is deleted.

The refresh handler reads the token from **cookie → `body.refreshToken` → `x-refresh-token` header**, in that order (`auth.controller.js:152‑158`), so both cross‑site cookie clients and header/body clients work.

---

## 7. The frontend auth client — `frontend/src/utils/api.js`

This 137‑line file is the entire client‑side auth surface. Three exports matter:

- **`accessToken` (module var, line 3) + `setAccessToken`/`getAccessToken`.** The access token is deliberately *not* persisted — it's memory‑only, recovered after reload by the mount refresh (§8).
- **`refreshAuthSession()` — the single‑flight refresh (`utils/api.js:30`).** It holds one in‑flight promise in `refreshPromise` (line 4). The first caller starts a `POST /api/auth/refresh` (`credentials:'include'`, body `{ refreshToken: localStorage 'slayhealth_refresh_token' }`); every concurrent caller gets the **same promise** back (`if (refreshPromise) return refreshPromise`). On success it `setAccessToken` and overwrites the stored refresh token; on `!res.ok` it throws an `Error` carrying `.status` so callers can distinguish an **expected 401** (logged‑out) from a **genuine 5xx/network failure**. The slot is cleared with `p.then(clear, clear)` rather than `.finally()` — deliberately, so a rejection doesn't spawn an *unhandled* rejection on a finally‑chain (the real rejection is owned by awaiting callers). **This function exists solely because of the no‑grace‑window rule in §6:** if two client code paths each POST the same refresh token, the first rotates+revokes it and the second gets a 401 → spurious logout. Coalescing to one call removes that race *within a browser context.*
- **`apiFetch(url, opts)` (`utils/api.js:91`).** Attaches `Authorization: Bearer <accessToken>` and `credentials:'include'`. On a **401** it calls `refreshAuthSession()`, retries the original request **once** with the new token, and on refresh failure clears `accessToken` + `slayhealth_user` + `slayhealth_refresh_token`, dispatches the window `Event('auth_session_expired')`, and throws. Note it does **not** clear the profile draft (§8).
- **`safeJson(response)` (`utils/api.js:75`).** Reads the body as text and `JSON.parse`s it in a try/catch, returning a friendly `{ success:false, error:… }` on non‑JSON. It exists because of `UX1‑01/UX7‑01/UX8‑09`: a non‑JSON error body (rate limiter, dev‑proxy hiccup, unhandled 500) used to be `await res.json()`‑ed straight onto the screen as a raw `SyntaxError` at the OTP gate. New call sites should route responses through `safeJson`, not a bare `res.json()`. The deeper fix — backend endpoints that answer non‑JSON — is still open (§12).

localStorage keys owned here: `slayhealth_refresh_token`, `slayhealth_user`. (`slayhealth_profile_draft_<uid>` is owned by the context.)

---

## 8. Mount silent‑refresh & session bootstrap — `CompatibilityContext.js`

On mount, `CompatibilityProvider` runs `silentRefresh()` (`contexts/CompatibilityContext.js:414`) which calls the **shared** `refreshAuthSession()` (line 422) — it used to be a separate raw `fetch`, and that duplication was exactly the double‑refresh race the single‑flight now prevents (fix `8856e83`). On success it repopulates `user`, `runsUsed`, `chatsUsed` and stores `slayhealth_user`; on failure off a public path it clears state and redirects.

- **`isPublicPath` (`CompatibilityContext.js:454`):** `/`, `/login`, `/invite/*`. The mount refresh runs on **every** page including the public landing, so an expected 401 for a logged‑out visitor is normal — it's logged at debug/warn, not error (fix `e5aabb9`), and only redirects when *not* on a public path.
- **`clearAllSessionStates()` (`CompatibilityContext.js:297`)** clears `accessToken`, removes `slayhealth_user` + `slayhealth_refresh_token`, and resets in‑memory state — but **deliberately KEEPS `slayhealth_profile_draft_<uid>`** (fix `4457b90`). A spurious/transient logout used to wipe a user's in‑progress intake; now the draft survives so the work isn't destroyed. Do not "tidy this up" by deleting the draft here.
- **`auth_session_expired`** window Event is the cross‑cutting logout signal: `apiFetch` dispatches it on refresh failure, the context listens (`:463`) → clear + conditional redirect. New code should dispatch/listen to this event rather than calling logout directly.
- **`handleLogout` (`:555`)** POSTs `/api/auth/logout` with the stored refresh token then `clearAllSessionStates()`. **`handleResetQuota` (`:525`)** POSTs `/api/auth/reset-quota` — see §9.

---

## 9. The quota system — `backend/src/middleware/quota.js`

The only "paywall." Two counters on `users`: `runs_used` (compatibility match runs) and `chats_used` (AI counselor messages), both default 0 (`postgres.service.js:123‑124`).

| Middleware | Blocks when | Error copy (verbatim, 403) | Mounted at |
|---|---|---|---|
| `checkMatchQuota` (`quota.js:4`) | `runs_used >= 1` | *"Quota exceeded. You have used your 1 free compatibility match run. Please upgrade to Premium."* | `chronic.routes.js:8` — `POST /api/chronic/analyze`, **after** `authenticateToken` |
| `checkChatQuota` (`quota.js:34`) | `chats_used >= 5` | *"Quota exceeded. You have used your 5 free AI counselor messages. Please upgrade to Premium."* | `chat.routes.js:13` — `POST /api/chat/message`, under router‑level `authenticateToken` |

All quota values are `[interim]` product settings (1 run, 5 chats), not clinical.

Four behaviors to know:

1. **Increment‑before‑operation, no refund.** Both middlewares `UPDATE ... + 1` **before** the controller/LLM runs (`quota.js:26`, `:57`). A failed match or a failed chat reply (e.g. the dead OpenRouter key, doc 11) **still burns quota** — finding **`UX7‑04`/`UX7‑02`**.
2. **Fail‑open on missing userId.** `userId` resolves `req.user?.id → x-user-id header → body.userId`; if none, both call `next()` unmetered (`quota.js:9`, `:39`). It's only safe because both mounts sit behind `authenticateToken`, so `req.user` is always present in practice. **Never reuse these on an unauthenticated route.**
3. **Inconsistent user‑not‑found handling.** `checkMatchQuota` returns **404** on a missing user row; `checkChatQuota` just `next()`s. Cosmetic today, but don't rely on symmetry.
4. **Self‑serve reset makes the paywall voluntary.** `POST /api/auth/reset-quota` → `resetQuota` (`auth.controller.js:317`) zeroes **both** counters for the caller's own id and responds *"Quota limits reset successfully (Premium Demo Upgrade Active)"*. Any logged‑in user can reset their own quota for free, so the 1‑run/5‑chat limit is not actually enforced. This is a **demo‑stage decision**, not a bug — but it means "monetization" does not exist yet.

---

## 10. The admin model — `backend/src/middleware/admin.middleware.js`

**There is no role or permission column on `users`.** Admin = your phone number appearing in the `ADMIN_PHONE_NUMBERS` env CSV. `requireAdmin` (`admin.middleware.js:7`) splits that CSV, trims, and checks `req.user.phone` against it; 403 on miss.

- **Ordering matters:** `requireAdmin` reads `req.user.phone`, so it **must run after `authenticateToken`**. Its only consumer is `admin.routes.js` — `GET /api/admin/whatsapp/messages → authenticateToken → requireAdmin → listWhatsAppMessages`.
- `ADMIN_PHONE_NUMBERS` is **absent from `.env.example`** (template drift, doc 03 §10) and its real value has historically been the single bypass phone `+917063992027` (§4) — i.e. the backdoor identity and the admin identity have been the same number.
- **The `/db` admin editor is NOT unauthenticated.** `db.routes.js:8` does `router.use(authenticateToken)`, so `GET/PUT/DELETE /api/db/tables/*` require a valid access token. But it applies **`authenticateToken` only — not `requireAdmin`** — so **any logged‑in user can read, update, and delete any row in any table.** This is an **authorization (IDOR/privilege) gap, not an open door.** The decided direction (product owner, doc 17) is to **re‑home `/db` behind the `ADMIN_PHONE_NUMBERS` allowlist** (add `requireAdmin`) — a code change not yet done. Frame it accurately: authenticated, but under‑authorized.

---

## 11. The share‑token side‑channel

The one route that a non‑logged‑in party can hit with a credential other than an access token: `GET /api/compatibility/matches/:matchId/pdf`.

- `generateShareToken(matchId)` (`jwt.service.js:84`) mints a **48h** token `{ matchId, type: 'match_share' }` signed with **`JWT_SECRET`** (the *access* secret). It carries **no `sub`/`phone`** — deliberately, so it can never authenticate any other endpoint even while valid.
- `authenticateOrShareToken` (`auth.middleware.js:57`): if `?shareToken=` is present it `verifyShareToken`s and requires `decoded.matchId === req.params.matchId`; on success it sets **`req.viaShareLink = true`** and **never sets `req.user`**. If no `shareToken`, it falls through to normal `authenticateToken`.
- **Route ordering is load‑bearing.** In `compatibility.routes.js` the PDF route (`:10`) is registered **before** the blanket `router.use(authenticateToken)` (`:13`), so it can accept the share token. Moving that line under the blanket guard breaks share links.

Two consequences: (a) share‑link validity **bypasses the DB session check entirely** — it's purely JWT signature + matchId match, so a leaked share URL is valid for the full 48h with no server‑side revocation; (b) because it's signed with `JWT_SECRET`, **rotating the access secret invalidates every outstanding share link** as a side effect (§12).

---

## 12. Open security backlog (pointers — doc 21 is the authoritative ledger)

Route map recap for reference — public: `POST /api/auth/{login,verify,refresh,logout}`; `authenticateToken`‑gated: `POST /profile`, `POST /reset-quota`, `GET /profile/:userId`, `DELETE /account` (`auth.routes.js:16‑25`). `/refresh` is public by design — the refresh token *is* the credential.

The findings to carry forward (see the review corpus: `SLAYHEALTH_DEEP_REVIEW.md`, `SLAYHEALTH_UX_REVIEW.md`, `WORKREPORT_2026-07-22.md`, `review/ux_WS1_flows.md`, `review/ux_WS7_states.md`):

- **No‑grace‑window two‑tab race (the primary residual, flagged‑not‑done, `WORKREPORT_2026-07-22` commit `8856e83`).** The single‑flight `refreshAuthSession` only coalesces callers *within one browser context*. Two genuinely separate contexts (e.g. two tabs) can each POST the same refresh token — the first rotates+revokes it, the second hits a revoked token → 401 → spurious logout. The documented, un‑implemented mitigation is a short server‑side **rotation‑family grace** (accept the immediately‑prior token in a family for a few seconds) or **refresh‑token reuse detection**.
- **Refresh token duplicated into XSS‑readable `localStorage`.** It's returned in the JSON body of `/verify` and `/refresh` and mirrored to `localStorage.slayhealth_refresh_token` *in addition to* the httpOnly cookie (`auth.controller.js:133`, `utils/api.js:52`). The httpOnly protection is undermined by the readable copy; any XSS reads a valid 7‑day credential.
- **Access token accepted via `?token=` query param** (`auth.middleware.js:17`). Query strings leak into server logs, proxy access logs, and `Referer` headers — a credential‑leak surface. Prefer Bearer‑only.
- **`/db` authorization gap** (§10): any logged‑in user can CRUD any table row; add `requireAdmin`.
- **Self‑serve quota reset** (§9) nullifies the paywall — fine for demo, must change before monetization.
- **Redis fail‑open on OTP limiting** (§4): Redis down = no OTP throttling at all.
- **Unbounded `user_sessions` / `otp_requests` growth** (§6): no pruning job; every `/refresh` does an O(n) bcrypt scan.
- **Share token signed with the access secret** (§11): couples share‑link lifetime to access‑key rotation; no server‑side revocation.
- **Hardcoded bypass phone `+917063992027`** compiled into `otp.service.js` (§4).
- **UX session‑race items:** `UX1‑01` (non‑JSON error body rendered as raw `SyntaxError`, mitigated by `safeJson` but the backend non‑JSON responders are the deeper fix); `UX1‑02` (abandoning mid‑signup between OTP success and the name step strands a nameless session, `review/ux_WS1_flows.md`).

> **Regulatory note (REG‑06):** the DPDP substantiation audit explicitly **scoped auth/JWT findings OUT** and deferred them to the deep review; it only flags `otp_requests.expires_at` as a legitimate retention exception. A dedicated security pass on *this* subsystem is therefore still outstanding — treat the happy path as complete and the hardening as needs‑work. This doc states the gaps factually and takes no wellness‑vs‑SaMD position; that call is doc 21 / legal counsel's.

---

## Open items (see doc 21 for the authoritative list)

- **No‑grace‑window rotate‑and‑revoke** is the headline residual: needs a security‑reviewed server‑side rotation‑family grace or reuse‑detection before the two‑tab spurious‑logout can be called closed.
- **Refresh token in `localStorage`** duplicates the httpOnly cookie into XSS reach — decide cookie‑only vs. the current dual channel.
- **`/db` under‑authorization** and **self‑serve quota reset** are both "authenticated but not authorized/enforced" gaps with decided directions (add `requireAdmin`; gate reset) not yet coded.
- **No session/OTP pruning + O(n) bcrypt refresh scan** is a slow‑burn scale/cost problem — add a cleanup job alongside `cleanupOldReports`.
- **Redis fail‑open**, **`?token=` query leakage**, and the **compiled‑in bypass phone** round out the hardening backlog.

---

*Next: `05_data_model_and_storage.md` — the 14‑table data dictionary these sessions, users, and OTP rows live in, plus the Postgres / Redis / legacy‑SQLite storage split.*
