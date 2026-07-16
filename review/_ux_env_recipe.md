# UX review — shared environment recipe (all UX agents read this first)

## Servers (already running — do NOT start/stop/restart anything)
- **Frontend: `http://localhost:3010`** — NOT 3000. Port 3000 hosts an UNRELATED project (raindeer); never touch it.
- Backend API: `http://localhost:3001` (frontend proxies `/api/*` to it).
- Next.js dev indicators are disabled; ignore `/dev-sw.js` 404 noise in logs.

## Browser driving (Playwright)
- Playwright is NOT in the repo's node_modules. Run driver scripts with:
  `NODE_PATH=/Users/pranavsingh/.npm/_npx/361ceb562f3b3235/node_modules node <script>`
- Viewports: mobile `{width:390,height:844}`, desktop `{width:1440,height:900}`. Do flows at BOTH.
- Screenshots: save to `backend/scratch/ux_shots/` (create it; `backend/scratch/` is gitignored).
  Name them `<agentPrefix>_<flow>_<step>_<viewport>.png` and reference filenames in findings.

## Auth bypass / seeding (Postgres, disposable only)
Pattern (run from `backend/`, scripts in `backend/scratch/`, require paths `../src/...`):
```js
require('dotenv').config();
const { db } = require('../src/services/storage/postgres.service');
const jwt = require('../src/services/auth/jwt.service');
// users table has NO is_onboarded column. Positional args for tokens:
const uid = require('crypto').randomUUID();
await db.query(`INSERT INTO users (id, phone_number, name, gender, dob, city, height, weight, waist,
  activity_level, drinking_habits, smoking_habits, sleep_cycle, created_at)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())`, [...]);
const t = jwt.generateTokens(uid, phone);      // (userId, phone) — NOT an object
await jwt.saveSession(uid, t.refreshToken);
```
Browser session injection (BEFORE first goto, via addInitScript):
```js
localStorage.setItem('slayhealth_refresh_token', rt);
localStorage.setItem('slayhealth_user', JSON.stringify({ id: uid, name, phone_number }));
```
First load may race the silent refresh → retry loop: goto, wait ~2.5s, if page shows the marketing
landing ("Your Future Is") goto again (≤3 tries).

## Critical navigation caveat (known finding WS8-01 — do not re-diagnose, work around)
`/core-engine/*` report pages are CONTEXT-ONLY: a hard `goto('/core-engine/story')` bounces to
`/dashboard`. To reach a report: land on `/dashboard`, click the **Recent** match card, then navigate
tabs via in-app clicks. Refresh inside the report will bounce — that's documented; observe UX around
it but don't file it as new.

## Seeded couples (already created by `backend/scratch/ux_seed.js`; coordinates in `/tmp/ux_couples.json`)
Each entry: `{ key, uid, phone, name, refreshToken, matchId? }`
- `clean` — healthy couple, high score (~88), all badges Good.
- `sti` — STI-capped couple (score 45, sti_gate triggered, Hep B finding male side).
- `severe` — severe-findings couple (varicocele + PCOS badges, low fertility odds, both-carrier genetics 50).
- `partial` — has a pending invite (partner hasn't submitted); NO match row.
- `empty` — brand-new bare account (first-run).
Re-mint fresh tokens if yours expire: `node backend/scratch/ux_seed.js` is idempotent and reprints the JSON.
NOTE: presentation_json for clean/sti/severe is hand-seeded (best-effort realistic). If a render
depends on a field the seed lacks, note it as "seed-limited" rather than filing a UX defect.

## Phone-number allocation (avoid collisions between agents)
- Seed couples: `+199902 0x xx` (managed by ux_seed.js — do not delete mid-review)
- UX-A: create your own users only under `+1999021xxx`
- UX-B: `+1999022xxx` · UX-C: extra users `+1999023xxx` · UX-D: `+1999024xxx` · UX-E: `+1999025xxx` · UX-F: `+1999026xxx`
- Final cleanup is centralized (lead purges `+199902%` at the end) — but delete any mess you make beyond that range yourself.

## Hard rules
- READ-ONLY on production code. No commits. Probe scripts only in `backend/scratch/` (or `frontend/scratch/` if you must; prefer backend/scratch).
- **Mobile UI is the LOCKED design reference.** Any mobile↔desktop divergence = a one-directional
  "reconcile desktop to mobile" item. NEVER propose changing mobile visuals to match desktop or your
  own taste. Mobile is still in scope for substantive defects (a11y, comprehension, states, copy, flows).
- Do NOT re-diagnose engine/medical findings — `SLAYHEALTH_DEEP_REVIEW.md` + `review/WS*.md` already
  cover them (STI-gate regex, radiology key bug, ungated client headline, Sachin/Swati fallbacks,
  fabricated prose, genomics stub existence). Reference their IDs; write up only the UX/trust angle.
- OpenRouter LLM key is currently DEAD (401) — AI chat replies fail and narrative generation falls
  back to templates. Observe the resulting UX honestly (it's a real state), but attribute the root
  cause to the known dead key, not new code bugs.
- Known session flakiness: silent-refresh races cause transient 401s in console on first load; only
  file console errors that persist/affect UX.
- Findings schema + severity: use `review/_ux_schema.md`.
