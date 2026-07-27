# System Architecture, Backend Bootstrap & Request Lifecycle

**Doc 02 of 22** · Audience: a solo full‑stack successor · Prerequisite: `01_product_overview_and_mental_model.md`, `03_setup_deployment_and_environment.md`.

Goal of this doc: the technical **"how it fits together"** layer. The two‑package split, the dev‑vs‑prod API wiring, and the Express 5 backend spine — `server.js` boot order, CORS, the global rate limiter, the **complete route registry with middleware chains**, the JSON error contract, and the hourly cleanup job. Every backend feature doc (04–13) hangs off this map, so read it before them.

---

## 1. High‑level topology

Two independently‑deployed processes, one shared Postgres, plus soft‑dependency external services. Nothing here is a monolith or a serverless split — it's two long‑running Node servers.

```
                         ┌───────────────────────────────────────────┐
   browser               │                BACKEND (Express 5, :3001)  │
 ┌─────────┐             │  server.js  (trust proxy → CORS → json →   │
 │ Next 16 │  /api/*     │   cookie-parser → rate-limit → routes →    │
 │ :3000   │────────────▶│   errorHandler)                            │
 │(App Rtr)│  (dev: Next │      │                                     │
 └─────────┘   rewrite   │      ▼                                     │
      │        proxy;    │  controllers ─► services                   │
      │        prod:     │      │            │  │  │  │                │
      │   NEXT_PUBLIC_   │      │            │  │  │  └─▶ WhatsApp Cloud API
      │   API_URL direct)│      │            │  │  └────▶ OpenRouter / DeepSeek (LLM)
      │                  │      │            │  └───────▶ OCR.space (+ local python/PyMuPDF)
      │                  │      │            └──────────▶ Upstash Redis (locks/cache/OTP-limit)
      │                  │      ▼                                     │
      │                  │  Postgres (Supabase, SSL)  ◀── initDB()    │
      └──────────────────┘                                           │
                         └───────────────────────────────────────────┘
```

| Tier | What it is | Port / host | Notes |
|---|---|---|---|
| Frontend | Next.js 16 App Router, React 19, Tailwind v4 | `:3000` dev / `https://demo.slay.health` prod | Static bundle + Node render server. See doc 14–18. |
| Backend | Express 5 + CommonJS | `:3001` dev / Render (PM2 `slayhealth-backend`) prod | The subject of this doc. |
| Primary datastore | PostgreSQL via Supabase pooler | `DATABASE_URL`, SSL | 14 tables, created idempotently by `initDB()` (doc 05). |
| Redis | Upstash REST | env | Locks, 30‑day LLM cache, OTP‑send rate‑limit. Fails soft. |
| LLM | OpenRouter → DeepSeek | env | Narrative + AI chat. **Key currently dead (401)** → template fallback (docs 10, 11). |
| OCR | OCR.space + local python3/PyMuPDF | env / host binary | Pathology text extraction (doc 06). |
| Messaging | WhatsApp Business Cloud API | env | OTP + invites (doc 12). |

Everything except Postgres degrades gracefully when its key is unset (doc 03 §8) — the backend still boots. If `initDB()` rejects, the process **exits 1** (`server.js:118`).

---

## 2. The two‑package layout

The repo root holds **two independent npm packages** — there is **no** workspaces / turbo / lerna / pnpm tooling. Each has its own `package.json`, lockfile, and `node_modules`.

| | `backend/` | `frontend/` |
|---|---|---|
| Module system | CommonJS (`require`) | ESM / App Router |
| Runtime | Express 5.2.1 on Node (no `engines` pin) | Next 16.2.9 + React 19.2.4 + Tailwind v4 |
| Entry | `src/server.js` (note: `package.json main` wrongly says `index.js`) | `next dev` / `next build` |
| Native modules | `better-sqlite3`, `bcrypt` (need a build toolchain) | none |
| Tests | `npm test` is a **stub that exits 1**; real files exist unwired (doc 19) | eslint only, zero tests |

Practical consequence: you install and run each package separately (or via `./run.sh`, doc 03 §3). There is no root `package.json` orchestrating them. The **CommonJS backend is not the same mental model as the ESM frontend** — don't copy import styles across the boundary.

Backends everyone hits early: this doc's spine lives entirely under `backend/src/` — `server.js`, `middleware/`, `routes/`, with controllers/services one layer deeper.

---

## 3. The dev‑vs‑prod API wiring model

This is covered in depth in doc 03 §4; repeated here in brief because it's the frame for every request the backend sees.

- **Dev:** `NEXT_PUBLIC_API_URL` unset → `frontend/src/config/api.js` returns `''` → API calls are **relative** (`/api/...`). `frontend/next.config.mjs` `rewrites()` proxies `/api/:path*` → `http://localhost:3001/api/:path*`. The browser only ever talks to its own origin, so **no CORS, no cross‑site cookies** in dev.
- **Prod:** `rewrites()` returns `[]` (proxy is dev‑only). You **must** bake an absolute `NEXT_PUBLIC_API_URL` at build time; the browser then calls the Render backend **cross‑origin**, activating CORS + cross‑site cookies (§6).
- **Why the proxy exists:** it dodges phone‑on‑LAN firewalls that block port 3001, so a real phone can hit your laptop backend through the frontend origin.
- **The #1 prod failure mode:** forget `NEXT_PUBLIC_API_URL` at build → calls go relative to `demo.slay.health`, the prod rewrite is gone, and **every API call 404s** against the frontend host.

From the backend's point of view: in dev every request arrives same‑origin with no `Origin` header (CORS auto‑allows it); in prod every request carries `Origin: https://demo.slay.health` and must pass the allowlist.

---

## 4. `server.js` boot sequence

`backend/src/server.js` is the composition root. The **order is load‑bearing** — middleware runs in registration order, so CORS must precede body parsing, the rate limiter must precede routes, and the error handler must come last.

| Step | Line | What | Why it's here |
|---|---|---|---|
| 1. `dotenv` | `server.js:1` | `require('dotenv').config()` | Populates `process.env` from `backend/.env` before anything reads it. **Must be first.** |
| 2. imports | `server.js:2‑19` | express, cors, cookie‑parser, 12 route modules, `healthCheck`, `initDB`/`cleanupOldReports`, logger, errorHandler | — |
| 3. `app` + `PORT` | `server.js:21‑22` | `express()`, `PORT = process.env.PORT \|\| 3001` | — |
| 4. **trust proxy** | `server.js:29` | `app.set('trust proxy', 1)` | Trust exactly ONE hop (Render's LB) so `req.ip` is the real client — correct rate‑limit keying + session IP logging. Comment names Render explicitly (only in‑repo evidence of the deploy). |
| 5. **CORS** | `server.js:45‑59` | `cors({ origin: fn, credentials: true })` | Cross‑origin gate for prod (§6). |
| 6. `express.json()` | `server.js:60` | JSON body parser | Malformed JSON → `entity.parse.failed`, handled as 400 by errorHandler (§10). |
| 7. `cookieParser()` | `server.js:61` | Populates `req.cookies` | Refresh‑token cookie read on `/api/auth/refresh` (doc 04). **Mounted with no secret** → no signed cookies. |
| 8. **rate limiter** | `server.js:64‑78` | `apiLimiter` on `/api/` | 60 req/min/IP (§7). `/health` is registered before nothing‑throttled — it's outside `/api/` so exempt. |
| 9. **routes** | `server.js:81‑93` | `/health` + 12 `/api/*` routers | The registry (§8). |
| 10. **errorHandler** | `server.js:96` | `app.use(errorHandler)` | Terminal responder. **Must be last** (§10). |
| 11. cleanup interval | `server.js:99‑107` | hourly `cleanupOldReports()` | In‑process `setInterval` (§11). |
| 12. `initDB()`→`listen` | `server.js:110‑119` | Open pool, create schema, then `app.listen(PORT)`; on DB failure `process.exit(1)` | Server never listens on an uninitialised DB. |

```
dotenv → express() → trust proxy 1 → CORS → express.json → cookieParser
   → apiLimiter('/api/') → [ /health, 12 × /api/* routers ] → errorHandler
   → setInterval(cleanupOldReports, 1h) → initDB().then(listen).catch(exit 1)
```

Gotcha: the cleanup interval is registered **before** `initDB()` resolves, so its first tick could theoretically fire against a not‑yet‑ready pool — in practice the 1‑hour delay makes that a non‑issue, but note it.

---

## 5. Express 5 caveats (this is not Express 4)

`backend/package.json` pins `express ^5.2.1`. Most tutorials, Stack Overflow answers, and LLM training assume Express **4**. Three differences will bite:

| Area | Express 4 | Express 5 (here) | Consequence |
|---|---|---|---|
| Async errors | A rejected promise in an `async` handler is **swallowed** unless you `try/catch` + `next(err)` | Rejections in async route handlers **auto‑forward** to the error handler | Controllers can `throw`/reject and the errorHandler catches it — several do. But **middleware** must still call `next(err)` explicitly (quota.js does, `quota.js:30/60`). |
| Route matching | `path-to-regexp` v0.x | `path-to-regexp` **v8** | Wildcard/optional/regex route syntax changed. `*` and unnamed params behave differently — verify any exotic pattern against v5 docs, not memory. This codebase uses only plain `:param` routes, so it's mostly latent risk. |
| Removed APIs | `app.del`, `res.sendfile`, `req.param()` etc. | removed | None used here, but don't reintroduce them. |

Rule of thumb for a successor: when a routing or error‑propagation thing "should work" per a tutorial and doesn't, suspect the v4/v5 gap first.

---

## 6. CORS model in full

`server.js:34‑59`. Three concentric allow rules plus `credentials: true`.

**The hardcoded allowlist** (`server.js:36‑43`):

| Origin | Source |
|---|---|
| `http://localhost:3000` | hardcoded (dev frontend) |
| `http://localhost:3001` | hardcoded (self / tooling) |
| `https://demo.slay.health` | **hardcoded** so cross‑origin auth survives even if `ALLOWED_ORIGINS` is unset |
| …`ALLOWED_ORIGINS` CSV | appended from env (`envOrigins`, `server.js:35`) |

**The origin function** (`server.js:46‑57`) decides in this order:
1. **No `Origin` header** → `callback(null, true)` — always allowed. (Same‑origin dev requests, curl, server‑to‑server.)
2. Origin **in `allowedOrigins`** → allowed.
3. **Dev only** (`!isProduction`): a regex allows any `http://` origin on `localhost` / `127.0.0.1` / `192.168.x.x` / `10.x.x.x` / `172.16‑31.x.x` (any port) — `server.js:51`. This is what lets a phone on your LAN hit the dev box.
4. Otherwise → `callback(new Error('Not allowed by CORS'))` → the request is rejected.

**`credentials: true`** (`server.js:58`) is mandatory: the auth model uses an httpOnly refresh cookie, and cross‑site cookies require both `credentials:true` here **and** `sameSite:'none'; secure:true` on the cookie — the latter is `NODE_ENV==='production'`‑gated in `auth.controller.js` (doc 04). So **`NODE_ENV` must be `production` on the deployed backend**, or the login cookie is dropped and users can't stay logged in. That coupling (CORS credentials ↔ cookie flags ↔ NODE_ENV) is the single most common cross‑origin auth breakage.

Gotcha: the dev LAN regex is **disabled in prod** (`!isProduction`), which is correct — but it means you cannot test a prod build against a LAN IP without adding it to `ALLOWED_ORIGINS`.

---

## 7. The global rate limiter

`server.js:64‑78`, `express-rate-limit@8`.

| Property | Value | Note |
|---|---|---|
| Window | `1 * 60 * 1000` (1 min) | `server.js:65` |
| Max | **60 requests / IP / window** | `server.js:66` — across **all `/api/*` combined**, login OTP included |
| Scope | `app.use('/api/', apiLimiter)` | `server.js:78` — `/health` is **exempt** (it's not under `/api/`) |
| Key | `req.ip` | correct because `trust proxy = 1` |
| Body | `{ success: false, error: 'Too many requests from this IP, please try again after a minute.' }` | `server.js:72` — a **JSON object, deliberately** |
| Headers | `standardHeaders: true` (`RateLimit-*`), `legacyHeaders: false` | `server.js:73‑74` |

**Why the JSON body matters (UX7‑01):** a bare string message makes `express-rate-limit` send `Content-Type: text/html`. The frontend's `apiFetch` blindly `.json()`‑parses every response, so a text/html 429 threw a raw `Unexpected token` error to the user instead of a clean "slow down" message. Keeping `message` a JSON object preserves the JSON contract on the limit path. The **frontend‑side guard** across the ~4 call sites may still be partial — see doc 14/19.

Gotchas:
- 60/min is **shared across every endpoint** — a burst of mixed API calls (dashboard load fanning out) can trip the *login* limit. Consider per‑route limits if you see spurious 429s.
- `DISABLE_RATE_LIMIT` does **not** touch this limiter. It only lifts **OTP‑send** limiting in `otp.service.js`. The `.env.example` comment claiming otherwise is wrong (doc 03 §5, doc 04).
- One trusted hop only. Add a second proxy/CDN in front without bumping `trust proxy` and either every user keys to the CDN IP (throttled as one) or `X-Forwarded-For` becomes spoofable.

---

## 8. The complete route registry

Mounted in `server.js:81‑93`. Twelve routers imported (`pathology, db, compatibility, chronic, mfr, radiology, chat, auth, mental, invite, admin`), with `radiology` mounted at **two** paths. `usg.routes.js` exists on disk but is **never imported** — dead code (§12).

Legend for middleware chain: **PUBLIC** = no auth · **AUTH** = `authenticateToken` · **SHARE** = `authenticateOrShareToken` · **ADMIN** = `authenticateToken → requireAdmin` · **+quota** = quota middleware.

### Public (no authenticateToken)

| Method | Path | Chain | Controller | File:line |
|---|---|---|---|---|
| GET | `/health` | (none — also **not** rate‑limited) | `healthCheck` → `{status:'ok',timestamp}` | `server.js:81`, `pathology.controller.js:146` |
| POST | `/api/auth/login` | PUBLIC | `loginUser` | `auth.routes.js:16` |
| POST | `/api/auth/verify` | PUBLIC | `verifyOtp` | `auth.routes.js:17` |
| POST | `/api/auth/refresh` | PUBLIC (reads refresh cookie/body/`x-refresh-token`) | `refreshSession` | `auth.routes.js:18` |
| POST | `/api/auth/logout` | PUBLIC | `logoutUser` | `auth.routes.js:19` |
| GET | `/api/invite/validate/:token` | PUBLIC | `validateToken` | `invite.routes.js:60` |
| POST | `/api/invite/consent` | PUBLIC | `updateConsent` | `invite.routes.js:61` |
| POST | `/api/invite/submit` | PUBLIC + multer (`pathologyReport`+`radiologyReport`, 25 MB, PDF‑only) | `submitQuestionnaire` | `invite.routes.js:62‑65` |
| GET | `/api/invite/webhook/whatsapp` | PUBLIC (verifies `hub.verify_token`) | `handleWhatsAppWebhook` | `invite.routes.js:68` |
| POST | `/api/invite/webhook/whatsapp` | **PUBLIC, no HMAC** | `handleWhatsAppWebhook` | `invite.routes.js:69` |

### Auth‑gated (`authenticateToken`)

| Method | Path | Chain | Controller | File:line |
|---|---|---|---|---|
| POST | `/api/auth/profile` | AUTH | `updateProfile` | `auth.routes.js:22` |
| POST | `/api/auth/reset-quota` | AUTH | `resetQuota` | `auth.routes.js:23` |
| GET | `/api/auth/profile/:userId` | AUTH | `getUserProfile` | `auth.routes.js:24` |
| DELETE | `/api/auth/account` | AUTH (DPDP erasure) | `deleteAccount` | `auth.routes.js:25` |
| POST | `/api/pathology/extract` | AUTH + multer.single('pdf') | `extractPathology` | `pathology.routes.js:8,11` |
| GET | `/api/pathology/mock-extract` | AUTH | `mockExtract` | `pathology.routes.js:14` |
| GET | `/api/db/tables` | **AUTH** (`router.use`) | `getTables` | `db.routes.js:8,10` |
| GET | `/api/db/tables/:tableName` | AUTH | `getTableData` | `db.routes.js:11` |
| PUT | `/api/db/tables/:tableName/:id` | AUTH | `updateTableRow` | `db.routes.js:12` |
| DELETE | `/api/db/tables/:tableName/:id` | AUTH | `deleteTableRow` | `db.routes.js:13` |
| POST | `/api/chronic/analyze` | AUTH **+ checkMatchQuota** | `analyzeChronic` | `chronic.routes.js:8` |
| POST | `/api/mfr/analyze` | AUTH (no quota) | `analyzeMfr` | `mfr.routes.js:7` |
| POST | `/api/mental/analyze` | AUTH (no quota) | `analyzeMental` | `mental.routes.js:7` |
| POST | `/api/radiology/upload` · `/api/usg/upload` | AUTH + multer PDF‑only 25 MB | `uploadReport` | `radiology.routes.js:11,42` |
| POST | `…/analyze` | AUTH | `analyze` | `radiology.routes.js:43` |
| POST | `…/report` | AUTH | `saveReport` | `radiology.routes.js:44` |
| GET | `…/report/:id` | AUTH | `getReport` | `radiology.routes.js:45` |
| POST | `…/couple` | AUTH | `analyzeCouple` | `radiology.routes.js:46` |
| POST | `…/couple-summary` | AUTH | `getCoupleSummary` | `radiology.routes.js:47` |
| POST | `/api/chat/session` | AUTH | `createChatSession` | `chat.routes.js:11` |
| GET | `/api/chat/session/:sessionId/history` | AUTH | `getChatHistory` | `chat.routes.js:12` |
| POST | `/api/chat/message` | AUTH **+ checkChatQuota** | `sendChatMessage` | `chat.routes.js:13` |
| POST | `/api/invite/send` | AUTH | `createInvite` | `invite.routes.js:52` |
| POST | `/api/invite/self-entry-consent` | AUTH | `logSelfEntryConsent` | `invite.routes.js:53` |
| GET | `/api/invite/status` | AUTH | `getInvites` | `invite.routes.js:54` |
| GET | `/api/invite/stream` | AUTH (SSE) | `streamInviteStatus` | `invite.routes.js:55` |
| POST | `/api/invite/revoke/:id` | AUTH | `revokeInvite` | `invite.routes.js:56` |
| POST | `/api/invite/run-match/:id` | AUTH | `runInviteMatch` | `invite.routes.js:57` |

> **Map correction:** an earlier source map grouped `/api/mfr/analyze` and `/api/mental/analyze` under `checkMatchQuota`. They are **not** quota‑gated — only `/api/chronic/analyze` carries `checkMatchQuota` (`chronic.routes.js:8`). The other two engines are auth‑only. Verified against source.

### Share‑token capable

| Method | Path | Chain | Controller | File:line |
|---|---|---|---|---|
| GET | `/api/compatibility/matches/:matchId/pdf` | **SHARE** (`authenticateOrShareToken`) | `generatePDFReport` | `compatibility.routes.js:10` |

This route is registered **before** the blanket `router.use(authenticateToken)` at `compatibility.routes.js:13`, so it can accept a `?shareToken=` alternative. **Order matters** — moving line 10 below line 13 breaks share links.

### Compatibility (rest, `authenticateToken` via `router.use` at line 13)

| Method | Path | Controller | File:line |
|---|---|---|---|
| GET | `/api/compatibility/matches` | `listMatches` | `compatibility.routes.js:16` |
| POST | `/api/compatibility/save-match` | `saveMatch` | `compatibility.routes.js:19` |
| POST | `…/matches/:matchId/share-link` | `createShareLink` | `compatibility.routes.js:22` |
| GET | `…/matches/:matchId/ai-pdf` | `generateAIPDFReport` | `compatibility.routes.js:26` |
| GET | `…/matches/:matchId/radiology` | `getMatchRadiology` | `compatibility.routes.js:30` |
| GET | `…/matches/:matchId` | `getMatch` | `compatibility.routes.js:33` |
| POST | `…/matches/:matchId/infographics-data` | `compileInfographicsData` | `compatibility.routes.js:36` |

### Admin

| Method | Path | Chain | Controller | File:line |
|---|---|---|---|---|
| GET | `/api/admin/whatsapp/messages` | **ADMIN** (`authenticateToken → requireAdmin`) | `listWhatsAppMessages` | `admin.routes.js:8` |

> **`/db` posture (map correction):** `/api/db/*` **is authenticated** — `db.routes.js:8` does `router.use(authenticateToken)`. It is **not** an open/unauthenticated door. It **is** an **authorization** gap: it has no `requireAdmin`, so **any logged‑in user can read/update/delete any table row** via `/api/db/tables/*`. The decided direction (doc 17) is to **re‑home `/db` behind the `ADMIN_PHONE_NUMBERS` allowlist** and delete the duplicate standalone engine pages — a code change not yet done. Frame it as authZ, not authN.

---

## 9. Middleware inventory & ordering rules

| Middleware | File | Sets / does | Ordering rule |
|---|---|---|---|
| `authenticateToken` | `auth.middleware.js:8` | Injects `req.correlationId` + `x-correlation-id` header; extracts `Authorization: Bearer` **or `?token=`**; `verifyAccessToken`; sets `req.user = {id, phone}` or 401 | Must precede any controller needing `req.user`, and precede `requireAdmin`/quota |
| `authenticateOrShareToken` | `auth.middleware.js:57` | If `?shareToken=` present, `verifyShareToken` and require `decoded.matchId === req.params.matchId`; sets `req.viaShareLink=true` and **never `req.user`**; else falls through to `authenticateToken` | Must be registered **before** the blanket `router.use(authenticateToken)` |
| `requireAdmin` | `admin.middleware.js:7` | Reads `req.user.phone`, checks against `ADMIN_PHONE_NUMBERS` CSV; 403 on miss | Must run **after** `authenticateToken` (reads `req.user`) |
| `checkMatchQuota` | `quota.js:4` | If `runs_used >= 1` → 403; else `runs_used++` then `next()` | After auth (needs `req.user.id`); before the engine controller |
| `checkChatQuota` | `quota.js:34` | If `chats_used >= 5` → 403; else `chats_used++` then `next()` | After auth; before `sendChatMessage` |
| `errorHandler` | `errorHandler.js:6` | Terminal JSON responder | **Must be the last `app.use`** |

Auth details worth internalising (full treatment in doc 04):
- **`?token=` query‑param acceptance** (`auth.middleware.js:17`) is a credential‑leak risk — tokens land in access logs, referrers, proxy logs. Backlog item.
- Correlation ID is injected **only on authenticated routes**. Public routes (login/verify/invite‑public/webhook) get **no** correlation id from middleware — a tracing blind spot.
- Expired access token → 401 with `code: 'TOKEN_EXPIRED'` (`auth.middleware.js:36`). The frontend keys off this exact code to trigger a single‑flight refresh (doc 04, doc 14).
- Admin is a **phone allowlist, not a DB role** — there is no role column on `users`. `requireAdmin` reading `req.user.phone` is the whole model (`admin.middleware.js:13`).

### The quota debt (UX7‑02)

`quota.js` has three sharp edges a successor must know:

1. **Fail‑open:** if no `userId` is resolvable (`req.user.id || x-user-id header || body.userId`), the request proceeds **unmetered** (`quota.js:9`, `quota.js:39`). All quota tables are marked `[interim]` house limits pending a real billing model.
2. **Debit before work, never refunded:** the counter is incremented **before** the controller/LLM runs (`quota.js:26`, `quota.js:57`) and never refunded on downstream failure — a dead OpenRouter key, timeout, or 500 still burns 1 of the 5 free chats / 1 free match.
3. **Inconsistent user‑not‑found:** `checkMatchQuota` returns **404** on a missing user (`quota.js:14`); `checkChatQuota` just `next()`s (`quota.js:45`). Harmless today but a latent surprise.

Quota constants `[interim]` (house values, pending a billing decision):

| Constant | Value | File:line |
|---|---|---|
| Free match runs | block when `runs_used >= 1` | `quota.js:18` |
| Free chat messages | block when `chats_used >= 5` | `quota.js:49` |

---

## 10. The error‑handling contract

`errorHandler.js:6` is a 4‑arg Express error middleware. Every response the API emits — success or failure — uses the same envelope shape: `{ success: boolean, error?: string }` (plus `code`/`stack` in specific cases).

| Rule | Behaviour | File:line |
|---|---|---|
| Position | Registered **last** (`app.use(errorHandler)`) so all `next(err)` funnels here | `server.js:96` |
| Malformed JSON | `err.type === 'entity.parse.failed'` → **400** `{success:false, error:'Invalid JSON payload'}` | `errorHandler.js:14‑19` |
| Status code | `err.statusCode || 500` — **controllers must set `err.statusCode`** for any non‑500 to surface correctly | `errorHandler.js:21` |
| 500 masking | In production a 500's message is replaced with `'Internal Server Error'` | `errorHandler.js:22‑24` |
| Stack leak | `err.stack` included in the JSON body **only when `NODE_ENV !== 'production'`** | `errorHandler.js:29` |
| Logging | Always logs `method url message` + stack via winston | `errorHandler.js:7‑11` |

So: throw a plain `Error` in a controller and it becomes a masked 500 in prod; attach `err.statusCode = 400/403/404` for a client‑meaningful status. Because Express 5 auto‑forwards async rejections from **route handlers**, controllers can simply `throw`; middleware must `next(err)` (both quota fns do).

---

## 11. The hourly `cleanupOldReports` job

`server.js:99‑107` registers `setInterval(cleanupOldReports, 60*60*1000)` — every hour. The job (`postgres.service.js:292‑312`) runs:

```sql
DELETE FROM reports
WHERE created_at < NOW() - INTERVAL '1 day'
  AND id NOT IN (
    SELECT male_report_id   FROM matches WHERE male_report_id   IS NOT NULL
    UNION
    SELECT female_report_id FROM matches WHERE female_report_id IS NOT NULL
  )
```

| Fact | Detail |
|---|---|
| What it deletes | Rows in `reports` older than **1 day** that **no match references** |
| Why the guard | `matches` cascades to `reports` (`ON DELETE CASCADE`, `postgres.service.js:59‑60`) — pruning a referenced report would silently destroy a couple's completed result |
| Cadence | hourly, in‑process (`server.js:99`) |
| Return | `result.rowCount`, logged |

Two caveats a successor must hold:

1. **In‑process `setInterval`** — it lives and dies with the Node process. Run **multiple backend instances** and the job **double‑runs** (each instance ticks its own timer). For a single Render dyno that's fine; the moment you scale horizontally, move this to an external scheduler / a leader‑elected job.
2. **REG‑06 discrepancy:** the DPDP audit states *"No general retention policy or scheduled deletion job found."* That **under‑reports reality** — this job **is** an aggressive, undocumented 1‑day retention prune. A test report you uploaded yesterday can silently vanish. It also does **not** cover the broader DPDP gaps (no consent ledger, no DSAR/erasure flow beyond `DELETE /api/auth/account`, partner placeholder rows left behind). Treat retention/consent as an **open regulatory risk** (product‑owner decision), not a solved problem — see `REG-06_DPDP_SUBSTANTIATION_AUDIT.md` and doc 20/21. Do **not** assert a wellness‑vs‑SaMD posture; document the gap factually and keep "confirm with a qualified doctor" framing intact where the UI already carries it.

---

## 12. Logging reality & the hardening backlog

**Logging** (`utils/logger.js`): winston, `level: 'info'`, **Console transport only** — no file or remote sink. The JSON format is defined (`logger.js:5‑8`) but the Console transport overrides it with `colorize + simple` (`logger.js:11‑14`), so lines are human pretty‑printed, not structured JSON. `logger.debug` calls (e.g. in `jwt.service`) are effectively **suppressed** at `info` level. There is **no correlation‑id binding** into log lines — the `correlationId` exists on `req` but each log call must interpolate it by hand (most middleware do, controllers vary). On Render, `stdout` is your only log store; there's no rotation or shipping.

**Hardening backlog** (cross‑referenced in doc 20):

| Item | Where | Risk |
|---|---|---|
| No `helmet` / security headers | `server.js` (absent) | No HSTS/CSP/X‑Frame‑Options from the app (relies on Render's proxy) |
| `?token=` query‑param auth accepted | `auth.middleware.js:17` | Access token leaks into logs/referrer/proxy access logs |
| `cookie-parser` mounted **without a secret** | `server.js:61` | Signed cookies unavailable; refresh cookie relies on httpOnly + `sameSite` only |
| WhatsApp webhook fully public, **no HMAC** | `invite.routes.js:68‑69` | POST endpoint unauthenticated + unsigned; GET verifies only `hub.verify_token` (insecure fallback) |
| `/api/db/*` authZ gap | `db.routes.js` | Any logged‑in user can CRUD any table row (§8) |
| Orphaned `usg.routes.js` | `routes/usg.routes.js` | **Dead code** — never imported; `/api/usg` re‑uses `radiologyRoutes` as a "backwards compatibility redirect" (`server.js:88`). Editing `usg.routes.js` changes nothing. |
| Console‑only, no‑correlation logging | `utils/logger.js` | No structured logs, no trace continuity across services |
| In‑process cleanup timer | `server.js:99` | Double‑runs under multiple instances (§11) |

---

## Open items (see doc 21 for the authoritative list)

- **`/api/db/*` authorization gap** — authenticated but not admin‑gated; any logged‑in user can CRUD any row. Decided direction: re‑home behind `ADMIN_PHONE_NUMBERS` (doc 17). Not yet done.
- **Quota debit‑without‑refund + fail‑open** (UX7‑02, `quota.js`) — free allowance burns on downstream failures; unmetered when `userId` is absent.
- **REG‑06 retention/consent** — the hourly 1‑day report prune is real but undocumented (audit says it doesn't exist), and broader DPDP machinery (consent ledger, DSAR/erasure, partner placeholder cleanup) is absent. Open regulatory risk.
- **Hardening pass** — no helmet, `?token=` query auth, secret‑less cookie‑parser, public unsigned WhatsApp webhook, console‑only logging, orphaned `usg.routes.js`.
- **Express 5 latent risk** — path‑to‑regexp v8 route syntax; safe today (plain `:param` routes only) but any exotic pattern must be verified against v5 docs.

---

*Next: `04_auth_session_and_security.md` — OTP login, JWT rotate‑and‑revoke, the single‑flight refresh, quota, and the admin allowlist that this spine's middleware enforces.*
