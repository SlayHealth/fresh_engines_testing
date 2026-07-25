# Local Dev Setup, Deployment & Environment

**Doc 03 of 22** · Audience: a solo full‑stack successor · Prerequisite: `00_index.md`, `01_product_overview_and_mental_model.md`.

Goal of this doc: get the app **running locally in one sitting**, and understand **how it's deployed** and **every environment variable**. Read this before the deeper backend docs — you want a running app to poke at.

---

## 1. Prerequisites

- **Node.js** — the repo does **not** pin a version (`no engines`, no `.nvmrc`). It ships **native modules** (`better-sqlite3`, `bcrypt`) and **Express 5**, so use a recent LTS (Node 20 or 22) with a working build toolchain (Xcode CLT on macOS / `build-essential` on Linux). A mismatched Node is the most likely "npm install fails" cause.
- **PostgreSQL** — the app uses a hosted **Supabase** Postgres (via `DATABASE_URL`). You don't run Postgres locally; you point `DATABASE_URL` at the Supabase instance (get it from the team). SSL is required and the pool accepts the Supabase cert (`ssl.rejectUnauthorized:false`).
- **python3 + PyMuPDF (`fitz`)** — an *optional but recommended* host dependency. The pathology OCR path tries `python3 backend/src/services/ocr/extract_pdf_text.py` **first**; without it, extraction falls back to the OCR.space HTTP API (needs `OCR_API_KEY`) or to canned mock text. (Doc 06.)
- **Upstash Redis, OpenRouter, WhatsApp Business, OCR.space** — external services configured by env vars (§5). All degrade gracefully when unset (§9), so you can boot without them.

---

## 2. Repo layout

The repo root holds **two independent npm packages** — there is **no** workspaces/turbo/lerna/pnpm monorepo tooling; each package has its own `package.json`, lockfile, and `node_modules`.

```
fresh_build_slayHealth/
├── backend/            Express 5 + CommonJS API  (port 3001)
│   ├── src/            server.js, controllers/, routes/, middleware/, services/
│   ├── tests/ __tests__/   test files (not wired to `npm test` — doc 19)
│   ├── .env            REAL secrets (gitignored, on disk)
│   └── .env.example    template
├── frontend/           Next.js 16 App Router + React 19 + Tailwind v4  (port 3000)
│   ├── src/app/        routes; src/components/, contexts/, utils/, constants/
│   ├── AGENTS.md       "This is NOT the Next.js you know"  (imported by CLAUDE.md)
│   └── .env.example    template (NEXT_PUBLIC_API_URL only)
├── contexts/           ← these handoff docs live here
├── review/             the self-review corpus (doc 21)
├── SLAYHEALTH_*.md, REG-06_*.md, WORKREPORT_*.md   review summaries + fix logs
└── run.sh              one-command dev launcher
```

---

## 3. Running it locally

### The one‑command way

```bash
./run.sh
```

`run.sh` (repo root) does exactly this: `cd backend && npm install && npm run dev &` (nodemon on **:3001**), then `cd frontend && npm install && npm run dev &` (Next on **:3000**), prints both URLs, and `wait`s. **Ctrl+C stops both** (it traps `EXIT` and `kill 0`s the process group). Open **http://localhost:3000**.

Caveats:
- It runs `npm install` **every** invocation (slow but safe).
- It **hardcodes** frontend :3000 / backend :3001. If **:3000 is already taken**, Next silently picks another port (the review machine ran it on :3010 behind an unrelated app). If that happens, the dev proxy still targets :3001, so the backend side is fine — just use whatever port Next prints.

### Running each package alone

```bash
# backend  (auto-restarts on change)
cd backend && npm run dev        # nodemon src/server.js  → :3001

# frontend
cd frontend && npm run dev       # next dev → :3000
```

There is **no `.env.local` in the frontend** and dev intentionally runs **without** `NEXT_PUBLIC_API_URL` — that's correct (see §4). Backend reads `backend/.env` via `dotenv`; you need at least `DATABASE_URL` set to boot.

### Logging in locally

Auth is **phone + WhatsApp OTP** (no passwords). The full local‑login recipe — how the OTP is delivered in dev, the `DISABLE_RATE_LIMIT` flag, the admin/backdoor phone (`+917063992027`), and how to mint a session directly for automated testing — is in **doc 04** (auth) and **doc 19** (testing). For a first boot, the fastest path to a logged‑in session is usually the direct‑mint approach in doc 19.

---

## 4. The dev‑vs‑prod API wiring model (the #1 thing to internalize)

How the frontend finds the backend is different in dev and prod, and getting this wrong is the most common "why does nothing work" on a new machine or a new deploy.

`frontend/src/config/api.js` is the switch:

```js
// getApiUrl(): returns process.env.NEXT_PUBLIC_API_URL if set, else '' (relative URLs)
export const API_URL = getApiUrl();
```

### Dev (same‑origin proxy)

- `NEXT_PUBLIC_API_URL` is **unset** → `API_URL = ''` → all API calls are **relative** (`/api/auth/...`).
- `frontend/next.config.mjs` `rewrites()` proxies `/api/:path*` → `http://localhost:3001/api/:path*`.
- The browser only ever talks to its own origin (`localhost:3000`), so **there is no CORS and no cross‑origin cookie handling in dev**. Cookies are set `secure:false; sameSite:'lax'`.
- **Why the proxy exists:** it dodges phone‑on‑LAN firewalls that block port 3001, so you can test on a real phone against your laptop. (`next.config.mjs` also lists `allowedDevOrigins` LAN IPs for HMR — those are machine‑specific and meaningless in prod.)

### Prod (cross‑origin, direct)

- `next.config.mjs` `rewrites()` returns **`[]`** when `NODE_ENV==='production'` — **the proxy does not exist in prod.**
- You **must** set `NEXT_PUBLIC_API_URL` to the **absolute** backend URL (the Render backend), and it is **inlined at BUILD time** (`NEXT_PUBLIC_*` vars are baked into the bundle by `next build`). Changing it requires a **rebuild**, not just a restart.
- The browser calls the backend **cross‑origin**, so CORS + cross‑site cookies are now in play (§7).

> ⚠️ **The #1 prod failure mode:** forgetting `NEXT_PUBLIC_API_URL` at build time. Then `API_URL=''`, calls go to `https://demo.slay.health/api/*`, the prod rewrite is gone, and **every API call 404s** against the frontend origin.

```
DEV:   browser → localhost:3000  ──(Next rewrite /api/*)──▶  localhost:3001   [same-origin, no CORS]
PROD:  browser → demo.slay.health ──(NEXT_PUBLIC_API_URL)──▶  <render backend> [cross-origin, CORS + cookies]
```

---

## 5. Environment variables

`backend/.env` (gitignored) is your single source of runtime config in dev, loaded by `dotenv`. In prod the same vars come from the **Render dashboard**. Frontend `NEXT_PUBLIC_*` vars are **build‑time inlined**.

### Backend (`backend/.env`)

| Variable | Required? | What it switches on |
|---|---|---|
| `NODE_ENV` | yes | `production` turns on secure/`sameSite:none` cookies, disables the dev proxy, tightens CORS, and **enables the JWT boot‑guard** (§8). **Must be `production` in the deployed backend or cross‑site login breaks.** |
| `PORT` | no (default 3001) | Backend listen port. |
| `DATABASE_URL` | **yes** | Supabase Postgres connection string (with password). Primary datastore. If `initDB()` fails, the process **exits 1**. |
| `JWT_SECRET` | prod: **yes** | Access‑token signing secret. |
| `JWT_REFRESH_SECRET` | prod: **yes** | Refresh‑token signing secret. In prod, the app **refuses to boot** without both (§8); in dev it silently uses insecure fallbacks. |
| `ALLOWED_ORIGINS` | prod: recommended | Comma‑separated **extra** CORS origins appended to the hardcoded allowlist (§7). |
| `APP_URL` | yes (invites/LLM) | Public frontend URL. Used to build **invite links** (WhatsApp invite text) and as the OpenRouter attribution `HTTP-Referer`. **Currently stale** (§11). |
| `OPENROUTER_API_KEY` | no (degrades) | LLM (DeepSeek via OpenRouter) for narrative + chat. **Currently dead (401)** → template fallback (§9, §11). |
| `OPENROUTER_BASE_URL` | no | Default `https://openrouter.ai/api/v1`. |
| `DEEPSEEK_MODEL` | no | Default `deepseek/deepseek-chat`. |
| `OCR_API_KEY` / `OCR_SPACE_API_KEY` | no (degrades) | OCR.space fallback for PDF/image text (after python/PyMuPDF). |
| `USE_MOCK_OCR` | no | `true` forces canned mock OCR text (also auto‑used when no OCR key). |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | no (degrades) | Redis for locks, LLM response caching (30‑day TTL), and OTP send rate‑limiting. |
| `WHATSAPP_ACCESS_TOKEN` | no (degrades) | WhatsApp Business Cloud API — OTP delivery + prospect invites. |
| `WHATSAPP_PHONE_NUMBER_ID` | no | WhatsApp sender id. |
| `WHATSAPP_TEMPLATE_NAME` | no | OTP message template. |
| `WHATSAPP_INVITE_TEMPLATE_NAME` | no | Invite message template. |
| `WHATSAPP_SUPPORT_NUMBER` | no | Support number shown to users. |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | no | Verifies inbound WhatsApp webhook (doc 12). |
| `DISABLE_RATE_LIMIT` | no | **Read the gotcha below.** |
| `ADMIN_PHONE_NUMBERS` | no | Comma‑separated admin allowlist (doc 04). **Absent from `.env.example`** — a template‑drift trap. Real value has been the single backdoor phone `+917063992027`. |

> **`DISABLE_RATE_LIMIT` gotcha:** `.env.example` claims it "disables the global API rate limiter." **It does not.** Per the review corpus, `DISABLE_RATE_LIMIT=true` only lifts **OTP‑send** limiting (`otp.service.js`); the always‑on global **60 req/min/IP** limiter in `server.js` stays on, and OTP *verification* limiting stays on too. Verify against `otp.service.js`/`server.js` before relying on it. (Doc 04 has the exact behavior.)

### Frontend (`frontend/.env` / build env)

| Variable | Required? | What it does |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | **prod: yes** (build‑time) | Absolute backend URL. Unset in dev (relative + proxy). Inlined by `next build` — see §4. |
| `NODE_ENV` | (set by Next) | `next build`/`next start` set this to `production` automatically, which flips `next.config.mjs`'s `isProduction`. |

---

## 6. Production topology

**Only the following is evidenced *in the repo*** — there are **no deploy manifests committed** (no `render.yaml`, `ecosystem.config.js`, `Procfile`, `Dockerfile`, `.nvmrc`, `vercel.json`, no CI under `.github/`). The real Render/PM2/frontend‑host configuration lives **outside the repo** — get it from the team.

- **Backend:** runs on **Render** via `npm run start:prod` → `pm2 start src/server.js --name slayhealth-backend`, behind Render's proxy/load balancer. `server.js` does `app.set('trust proxy', 1)` so `req.ip` is the real client (correct rate‑limit keying + session IP logging). *(This `trust proxy` line is the only in‑repo evidence that the backend runs on Render.)*
- **Frontend:** served at **https://demo.slay.health** (`next build` + `next start` or an equivalent host), with `NEXT_PUBLIC_API_URL` baked to the absolute Render backend URL.
- **Cross‑origin auth:** because frontend and backend are different origins in prod, CORS + cross‑site cookies are required:
  - **CORS** (`server.js`): `allowedOrigins` **hardcodes** `http://localhost:3000`, `http://localhost:3001`, and `https://demo.slay.health`, then appends `ALLOWED_ORIGINS` (CSV). In non‑prod it also regex‑allows `localhost`/`127.0.0.1`/`192.168.x`/`10.x`/`172.16‑31.x` origins. `credentials: true`.
  - **Cookies** (`auth.controller.js`): the refresh cookie is `httpOnly`, and `secure` + `sameSite:'none'` **only when `NODE_ENV==='production'`**. So **`NODE_ENV` must be `production`** on the deployed backend, or the cross‑site login cookie is dropped and users can't stay logged in.

*(A recent commit already added `https://demo.slay.health` to the allowlist and set `trust proxy`; see doc 20 and the work reports.)*

---

## 7. JWT secrets & the production boot‑guard

`backend/src/services/auth/jwt.service.js`:

- **In production**, the module **throws at load** if `JWT_SECRET` or `JWT_REFRESH_SECRET` is missing: *"JWT_SECRET and JWT_REFRESH_SECRET must be set in production — refusing to start with an insecure fallback secret."* This is a feature: it refuses to boot on forgeable tokens.
- **In non‑prod**, it silently uses hardcoded fallback secrets (`fallback_jwt_access_secret_key_12345` / `…refresh…`). **Dev‑signed tokens are forgeable** — never reuse a dev DB/session against prod.
- Token lifetimes: **access 15m**, **refresh 7d**, **share 48h** (doc 04, doc 10).

---

## 8. External services & graceful degradation

Everything external fails soft, so you can develop offline‑ish. Know the degraded behavior so you don't chase phantom bugs:

| Service | Env keys | When missing/dead |
|---|---|---|
| **Postgres (Supabase)** | `DATABASE_URL` | **Hard requirement** — `initDB()` failure exits the process. |
| **OpenRouter (DeepSeek LLM)** | `OPENROUTER_API_KEY`, `_BASE_URL`, `DEEPSEEK_MODEL`, `APP_URL` | Narrative/chat/AI‑presentation silently return **tagged template fallbacks** (never fabricated clinical claims). **The key is currently dead (401)**, so this fallback is the *current normal*. (Docs 10, 11.) |
| **OCR.space** | `OCR_API_KEY` / `OCR_SPACE_API_KEY`, `USE_MOCK_OCR` | Pathology OCR falls back to python/PyMuPDF → OCR.space → mock. No key + no python → canned mock text. (Doc 06.) |
| **Upstash Redis** | `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Locks/caching/OTP‑rate‑limit degrade (fail‑open in places — flagged in doc 20). |
| **WhatsApp Business** | `WHATSAPP_*` | OTP + invite delivery don't send. (Doc 12; local‑login workarounds in doc 04/19.) |
| **python3 + PyMuPDF** | (host binary) | Pathology text extraction falls back to OCR.space/mock. (Doc 06.) |

---

## 9. Build / test / lint reality

- **Frontend:** `next build` / `next start` / `eslint`. It's a real Next 16 build — heed the "not the Next.js you know" note (doc 18).
- **Backend:** `npm test` is a **stub that always exits 1** — there is **no wired test runner**, even though `backend/tests/*.test.js` and `backend/__tests__/*.test.js` exist. Run them directly with `node <file>` / `node --test` (doc 19 lists all five and what they cover, plus the fact that **production radiology scoring is untested** while a dead twin is).
- **No CI, no Docker, no `.nvmrc`.** Combined with native modules + Express 5, expect build breakage on a mismatched Node — pin your local Node and document it.

---

## 10. Day‑one config defects to fix

These are known, real, and safe to address early (details/severity in doc 21):

1. **Stale `APP_URL`** (`http://192.168.1.45:3000`) → **invite links and WhatsApp invite text are dead** (`UX8‑05`). Set it to the real serving origin (`https://demo.slay.health`) in prod; there's no boot validation of it.
2. **Dead OpenRouter key (401)** → all AI narrative/chat is template fallback. Rotate/replace it to restore real AI output.
3. **Ungated "Trigger Mock Report" button** (`usg/page.js`) ships in the build and injects fabricated radiology into real records (`UX3‑05`). Gate behind `NODE_ENV`/a flag or remove.
4. **Rotate all secrets.** `backend/.env` holds live plaintext credentials (Supabase password, WhatsApp token, JWT secrets, Upstash token). Rotate everything on handoff and move to the platform's secret store.
5. **`.env.example` drift** — add `ADMIN_PHONE_NUMBERS`; fix the misleading `DISABLE_RATE_LIMIT` comment.
6. **Legacy SQLite leftovers** — `sqlite.service.js` + `slayhealth.db` files coexist with the real Postgres store. Ignore them; consider deleting to stop confusing the next person (doc 05).

---

## Open items (see doc 21 for the authoritative list)

- Deploy config (Render/PM2/frontend host) is **not in the repo** — reconstruct and commit a manifest (`render.yaml`/`ecosystem.config.js` + `.nvmrc`) so this isn't tribal knowledge.
- No CI; `npm test` stubbed; native‑module Node‑version risk (§9).
- The config defects in §10 (`APP_URL`, OpenRouter key, mock button, secrets, `.env.example` drift).

---

*Next: `02_architecture_and_backend_core.md` — the Express spine your running backend is built on (route registry, middleware chain, request lifecycle).*
