# Frontend Core: Central State, API Client & App Shell

**Doc 14 of 22** · Audience: a solo full‑stack successor · Prerequisite: `04_auth_session_and_security.md`, `03_setup_deployment_and_environment.md` (and skim `01_product_overview_and_mental_model.md` for the one‑male‑one‑female framing that this file's gender routing depends on).

Goal of this doc: give you the **frontend spine** — the single `CompatibilityContext` "God" store that every authenticated page reads from, the `apiFetch` client and its single‑flight silent refresh, the dev‑vs‑prod API base‑URL switch, the root app shell, and the two mobile viewport hooks. Read it before docs 15/16/17, because every screen those docs describe is a consumer of what's here.

The five files in scope:

| File | LOC | Role |
|---|---|---|
| `frontend/src/contexts/CompatibilityContext.js` | ~1000 | The central store + session lifecycle + match orchestration; also the (misfiled) home of the frontend clinical display constants. |
| `frontend/src/utils/api.js` | 137 | The single API client: attaches the in‑memory access token, does single‑flight refresh + retry on 401, dispatches `auth_session_expired` on terminal failure. |
| `frontend/src/config/api.js` | 11 | Resolves the API base URL (empty string in dev → Next rewrite proxy). |
| `frontend/src/app/layout.js` | 49 | Root app shell (Server Component); mounts the provider + global singletons. |
| `frontend/src/hooks/useIsMobile.js` | 28 | SSR‑safe tri‑state viewport hook. |
| `frontend/src/hooks/useKeyboardInset.js` | 34 | On‑screen‑keyboard overlap measurement. |

One thing to internalize before anything else: **`CompatibilityProvider` is a ~40‑slot single store that hands a fresh object literal to `Context.Provider value={{…}}` on every render** (`CompatibilityContext.js:945`). There is no memoization and no context splitting, so **every consumer (13+ files) re‑renders on any state change anywhere**. That's the defining architectural fact of the frontend, and it's called out again at the end.

---

## 1. The central store: full state inventory

`CompatibilityProvider` (`CompatibilityContext.js:209`) declares ~40 `useState` slots and exposes them — plus their setters and a handful of action functions — through one context object. Here is the complete inventory grouped by concern, with where each is declared and who reads/writes it.

### Auth & profile

| Slot | Decl | Written by | Read by |
|---|---|---|---|
| `user` | `:211` | `login/page.js` (verify/signup), `silentRefresh`, `handleResetQuota`, `clearAllSessionStates` | Nearly every page; the object that says "who is logged in" |
| `authPhone` | `:212` | `login/page.js` | `login/page.js` |
| `authOtp` | `:213` | `login/page.js` | `login/page.js` |
| `authStep` | `:214` (`'phone'`) | `login/page.js`, `handleLogout` | `login/page.js` |
| `isAuthLoading` | `:215` | `login/page.js` | `login/page.js` |
| `authError` | `:216` | `login/page.js` | `login/page.js` |

> **Gotcha (UX1‑04):** `authPhone`/`authOtp`/`authStep` live **only** in context state — they are never mirrored to `localStorage` (unlike the profile draft). A reload mid‑OTP loses the number and step. Low severity, but surprising given how carefully the profile draft is persisted.

### Quota

| Slot | Decl | Notes |
|---|---|---|
| `runsUsed` | `:219` | Seeded from `user.runs_used` on refresh; bumped locally after a match (`:813`). Free tier = 1 match. |
| `chatsUsed` | `:220` | Seeded from `user.chats_used`. Free tier = 5 counselor chats. |
| `isUpgradingQuota` | `:221` | Spinner flag for `handleResetQuota`. |

### Matches list

| Slot | Decl | Notes |
|---|---|---|
| `matchesList` | `:224` | Filled by `fetchRecentMatches(userId)` (`:491`) → `GET /api/compatibility/matches?userId=`. Read by dashboard + `MobileBottomNav`. |
| `isMatchesLoading` | `:225` | Spinner flag. |

### Forms (self vs partner)

| Slot | Decl | Notes |
|---|---|---|
| `onboardingStep` | `:228` | Wizard step index. `silentRefresh` sets it to `1` if the saved user is missing name/gender/activity (`:477`). |
| `onboardingForm` | `:229` | **The self profile.** Lazy‑seeded from `loadDraft()?.onboardingForm`. See §2. |
| `prospectForm` | `:248` | **The partner profile.** Lazy‑seeded from `loadDraft()?.prospectForm`. See §2. |

### Uploads (pathology)

| Slot | Decl | Notes |
|---|---|---|
| `userReport` | `:268` | Self's parsed pathology report object (carries `report_metadata.report_id`). Seeded from draft. |
| `prospectReport` | `:269` | Partner's parsed pathology report. Seeded from draft. |
| `isUserUploading` / `isProspectUploading` | `:270`–`:271` | Upload spinners. |
| `userUploadError` / `prospectUploadError` | `:272`–`:273` | Upload error strings. |

### Mental wellbeing answers

| Slot | Decl | Notes |
|---|---|---|
| `selfMentalAnswers` | `:278` (`{}`) | Answer map, seeded from draft. Entering the category is the opt‑in (no yes/no gate). |
| `prospectMentalAnswers` | `:279` (`{}`) | Partner's answer map, seeded from draft. |

### Results (the report reads these)

| Slot | Decl | Notes |
|---|---|---|
| `isMatching` | `:282` | True while `handleCompatibilityMatch` runs. |
| `matchError` | `:283` | Validation/engine error string shown by the run UI. |
| `chronicResult` | `:284` | Chronic engine output. **`core-engine/layout.js` hard‑guards on this being present.** |
| `mfrResult` | `:285` | Fertility engine output. Also guarded. |
| `mentalResult` | `:286` | Mental engine output (null until the mental questionnaire is analyzed). |
| `activeMatchId` | `:287` | The saved `matches` row id; drives the `?match=` URL sync and PDF link. |
| `activeMatchDetails` | `:288` | Full match row from `fetchActiveMatchDetails` (`:510`). |
| `selectedTab` | `:289` (`'story'`) | Legacy tab state; `core-engine/layout.js` derives its own tab from the pathname instead. |
| `selectedProjYear` | `:290` (`0`) | Timeline scrubber checkpoint (0/3/5/7/10). |

### Chat / misc

| Slot | Decl | Notes |
|---|---|---|
| `chatSessionId` | `:293` | AI counselor session id; reset on match restore. |
| `isChatOpen` | `:294` | Report chat drawer open flag. |
| `showCalculations` | `:295` | "In‑depth Calculations" trace toggle. |

**Consumer note:** every one of the above is spread into the single `value={{…}}` object at `:945`–`:988` alongside every setter plus the actions `fetchActiveMatchDetails`, `fetchRecentMatches`, `restoreMatchSession`, `hydrateFromMatchId`, `handleResetQuota`, `handleLogout`, `handleCompatibilityMatch`, `handleMentalAnalysis`. `useCompatibility()` (`:994`) throws if used outside the provider.

---

## 2. `onboardingForm` vs `prospectForm` — why two, and how they map into scoring

There are two form objects because the product is structurally **one account holder ("self") + one partner ("prospect")** (doc 01). They have deliberately different shapes.

### `onboardingForm` (self) — declared `:229`

```
userName, userRelation, candidateName, candidateGender, candidateDob,
candidateCity, marriageTimeline, activity_level, drinking_habits,
smoking_habits, sleep_cycle, height, weight, waist, menstrualCycle
```

The `candidate*` fields are a historical naming artifact from when onboarding described "the person you're screening." `buildOnboardingFormFromUser(user)` (`:145`) is the canonical mapper from a persisted `user` row back into this shape.

### `prospectForm` (partner) — declared `:248`

```
name, gender, dob, city, meetingSource, platformName, meetingStory,
activity_level, drinking_habits, smoking_habits, sleep_cycle, height,
weight, waist, menstrualCycle
```

The extra `meetingSource`/`platformName`/`meetingStory` fields capture the couple's origin story (used by the narrative/story tab, doc 11), which the self form doesn't need.

### Mapping into the engines (`handleCompatibilityMatch`, `:580`)

At match time both forms are collapsed into the engine payload. The pivot is **which person is male** — because the chronic and fertility engines are sex‑specific and the DB stores `male_report_id` / `female_report_id` (doc 10):

```
isUserMale = selfUser.gender?.toLowerCase() === 'male'      // :623
                          │
        ┌─────────────────┴─────────────────┐
   isUserMale = true                    isUserMale = false
   maleManual  ← self                   maleManual  ← prospect
   femaleManual← prospect               femaleManual← self
   male_report_id  ← userReport         male_report_id  ← prospectReport
   female_report_id← prospectReport     female_report_id← userReport
```

> **The single most load‑bearing line in this file is `:623`** — `selfUser.gender?.toLowerCase() === 'male'`. The gender picker (`GENDERS` in `lifestyleOptions.js`) stores capitalized `'Male'`/`'Female'` and the profile round‑trip never normalizes case. A prior bare `=== 'male'` was **always false for every real user**, silently swapping which partner's manual data *and* which partner's uploaded report fed which sex‑specific scoring path. The same case‑insensitive fix exists in `restoreMatchSession` (`:850`). If you ever refactor gender handling, this comparison is where couples get mis‑scored.

The two manual blocks (`maleManual` `:624`, `femaleManual` `:647`) each carry `name`, `age = calculateAge(dob)`, `bmi`, `waist = classifyWaist(...)`, and `history.parentDiabetes` (from the wizard's Family History answer, defaulting to `'None'`). `bloodPressure`/`glucose`/`lipids` are literal `'Normal'` here — the real values come from the uploaded pathology report on the backend.

`sharedLifestyle` (`:673`) is a couple‑level object whose **key names and values must exactly match the backend's `LIFESTYLE_LRS` maps** (doc 07). Two traps live in the inline comments:
- The alcohol key must be **`alcohol`** (not the legacy `drinking`) — `chronic.controller.js`'s `getEffectiveLifestyleLR` reads `shared_lifestyle_data?.alcohol` (`:688`). The old `drinking` key was never read.
- The values must be **`'Never'`/`'Occasionally'`**, not the now‑dead `'Occasional'` — `'Occasional'` is no longer a key in `LIFESTYLE_LRS` (`:680`, `:688`).

The MFR call (`:707`) sends a **numeric** `shared_lifestyle` object instead: `smoke 0/0.5`, `bmi 0/0.5` (>25), `act 0/0.5`, `alc 0/0.5`, `stress 0.2`, `freq 0.92`, `lifestyle_index 85` default (`:732`). Note also that `semenQuality`/`ovarianReserve` are **deliberately omitted** from the MFR manual data (`:713` comment) so the backend's real per‑couple classification from the uploaded report reaches scoring instead of a hardcoded `'Normal'` literal winning outright.

---

## 3. Every localStorage key — owner, format, lifecycle

There are **five** keys. Three are owned by this context; two are owned by `add-prospect/page.js` and the context knows nothing about them — that split is a real trap.

| Key | Owner | Format | Written | Cleared |
|---|---|---|---|---|
| `slayhealth_user` | context + `login/page.js` | JSON `user` row | on login/verify, `silentRefresh` (`:424`), `handleResetQuota` (`:535`) | `clearAllSessionStates` (`:310`), `apiFetch` terminal 401 (`utils/api.js:125`) |
| `slayhealth_refresh_token` | context + `refreshAuthSession` | opaque JWT string | on verify, rotated every refresh (`utils/api.js:52`) | `clearAllSessionStates` (`:311`), `apiFetch` terminal 401 (`utils/api.js:126`) |
| `slayhealth_profile_draft_<uid>` | context | JSON `{onboardingForm, prospectForm, userReport, prospectReport, selfMentalAnswers, prospectMentalAnswers}` | the mirror effect on every change (`:367`) | **NEVER by the context** — see §7 |
| `slayhealth_prospect_wizard_position_<uid>` | `add-prospect/page.js:78` | wizard step position | by add‑prospect | by add‑prospect only |
| `slayhealth_radiology_draft_<uid>` | `add-prospect/page.js:52` | radiology upload draft | by add‑prospect | by add‑prospect only |

The `<uid>` suffix comes from `getStoredUserId()` (`:185`), which reads `slayhealth_user` **directly out of localStorage** (not from the async `user` state, which is null right after mount), falling back to `'anon'` when logged out. `draftStorageKey()` (`:194`) builds the namespaced key. Because keys are per‑uid, **no draft can ever cross‑hydrate between accounts on the same device**.

> **Trap:** `add-prospect/page.js` re‑implements its own `getStoredUserId()` and reads `slayhealth_profile_draft_<uid>` inline (`:98`), *and* owns two additional draft keys the context never touches. If you're chasing a "why didn't my draft save/clear" bug, remember there are two owners with partially duplicated logic.

The access token is **not** in this table on purpose — see §4.

---

## 4. The access‑token model: in‑memory only

The access token lives **only** in a module‑level variable in `utils/api.js`:

```js
let accessToken = null;                       // utils/api.js:3
export function setAccessToken(token) { accessToken = token; }  // :6
export function getAccessToken() { return accessToken; }        // :10
```

It is **never written to localStorage**. Consequences you must internalize:

- **Every hard refresh starts tokenless.** After an F5, `accessToken` is `null`; the very first authenticated call would 401. The app relies on **silent refresh on mount** (§5) to repopulate it before (or lazily during) the first call.
- **Why not persist it?** An access token in localStorage is XSS‑exfiltratable and long‑lived‑by‑accident. Keeping it in memory means the durable credential is the `httpOnly` refresh cookie (unreadable by JS) plus the rotating `slayhealth_refresh_token`. Do **not** "fix" the tokenless‑on‑reload behavior by persisting the access token — that reintroduces the exact exposure this design avoids.
- `getAccessToken()` is used in exactly one place outside the client: the PDF download link (`core-engine/layout.js:356`), which appends `?token=` to the href because an `<a target="_blank">` can't set an Authorization header.

Silent refresh repopulates it: `silentRefresh` (`:414`) → `refreshAuthSession()` → on success `setAccessToken(data.accessToken)` (`utils/api.js:51`). From then on `apiFetch` attaches `Authorization: Bearer <accessToken>` (`utils/api.js:101`).

---

## 5. The single‑flight refresh contract

This is the most subtle and most important machinery in the frontend. Read `04_auth_session_and_security.md` for the backend rotate‑and‑revoke side; here is the client contract.

`refreshAuthSession()` (`utils/api.js:30`) is **single‑flight**: a module‑level `refreshPromise` (`:4`) coalesces every concurrent caller onto **one** `POST /api/auth/refresh`.

```
Why it must be single-flight — the backend rotates AND revokes the
refresh token on EVERY use:

  caller A ──┐
  caller B ──┼──▶ refreshAuthSession() ──▶ ONE POST /api/auth/refresh
  caller C ──┘        (shared promise)        │
                                              ▼
                                   new token rotated in, old REVOKED

  Without coalescing: A rotates+revokes the token, then B POSTs the
  now-revoked token → 401 → spurious logout.
```

The three concurrent callers that this collapses are: (1) `apiFetch`'s own 401 handler, (2) the `CompatibilityContext` mount `silentRefresh`, and (3) a React StrictMode double‑mounted effect. Before this existed, `silentRefresh` did a *separate raw fetch* that didn't share `apiFetch`'s guard, and the two raced (`:416` comment).

**`err.status` semantics** (`utils/api.js:44`): on a non‑OK refresh, the thrown error carries the HTTP status so callers can distinguish an **expected** logged‑out state (`401` = no/expired session — normal for a visitor) from a **genuine** failure (5xx/network). The mount effect uses this to keep `console.error` for real failures only (`:443`–`:448`), so Next's dev overlay doesn't scream "Console Error" on every plain landing‑page load (that's commit `e5aabb9`).

**The `apiFetch` 401 → refresh → retry → expire flow** (`utils/api.js:113`):

```
apiFetch(url):
  attach Bearer <accessToken>, credentials:'include'
  response = fetch(url)
  if response.status === 401:
    try:
      data = await refreshAuthSession()      # shared single-flight
      re-attach Bearer <data.accessToken>
      return await fetch(url)                # ONE retry
    catch refreshErr:
      setAccessToken(null)
      remove slayhealth_user, slayhealth_refresh_token   # NOT the draft
      window.dispatchEvent(new Event('auth_session_expired'))
      throw 'Session expired. Please log in again.'
  return response
```

`refreshPromise` is cleared via `p.then(clearSlot, clearSlot)` (not `.finally()`) so a rejection doesn't spawn an unhandled rejection on the finally‑chain (`:57`–`:62`).

**The `auth_session_expired` event** is the decoupling seam: `apiFetch` (a non‑React module) can't call React state setters, so it dispatches a window event. The provider's mount effect registers `handleSessionExpired` (`:457`) which runs `clearAllSessionStates()` and redirects **only if not on a public path** — `isPublicPath` (`:454`) allows `/`, `''`, `/login`, and `/invite/*`. On those, an expired session leaves the user where they are; anywhere else it hard‑navigates to `/`.

---

## 6. Two‑phase draft hydration — why both exist

The profile draft is rehydrated by **two** independent mechanisms, and you must understand both before touching draft loading.

**Phase 1 — lazy `useState` initializers.** `onboardingForm` (`:229`), `prospectForm` (`:248`), the two reports (`:268`–`:269`), and the two mental answer maps (`:278`–`:279`) all seed from `loadDraft()` (`:198`, memoized in the module var `cachedDraft` at `:183`). **These run only on the single real mount of the provider.**

**Phase 2 — rehydrate‑on‑auth effect.** A separate effect keyed on `user?.id` (`:390`) re‑reads the draft whenever a session is (re‑)established.

Why both? Because **the provider is mounted once at the true root** (`layout.js:40`) and **survives all client‑side navigations**. Login navigates via `router.push` — the provider is *not* re‑mounted, so the Phase‑1 initializers don't re‑run. Meanwhile `clearAllSessionStates` (called on the prior logout) already blanked the in‑memory forms. Without Phase 2, a user logging back in would see a fresh 0% profile even though the draft still sits in localStorage (§7).

Phase 2's guards:
- It forces a fresh read scoped to the current uid (`cachedDraft = undefined; loadDraft()`, `:398`).
- The `isBlank` guard (`:402`) only fills forms **still at empty defaults**, so it never clobbers edits made this session.
- A `hydratedDraftUserId` ref (`:389`) prevents re‑running for the same uid, and **resets to `null` on logout** (`:394`) so a re‑login (even as the same uid) rehydrates instead of being skipped.

---

## 7. `clearAllSessionStates` — and the deliberate keep‑the‑draft decision

`clearAllSessionStates` (`:297`) resets the session to logged‑out. It:

- sets `cachedDraft = undefined` (so the next `loadDraft()` re‑reads storage, `:308`);
- `setAccessToken(null)` (`:309`);
- removes `slayhealth_user` and `slayhealth_refresh_token` (`:310`–`:311`);
- blanks `user`, `runsUsed`, `chatsUsed`, `matchesList`, `chronicResult`, `mfrResult`, `mentalResult`, `activeMatchId`, `activeMatchDetails`, `chatSessionId`, `userReport`, `prospectReport`, `selfMentalAnswers`, `prospectMentalAnswers`, and both forms (`:312`–`:359`).

> **The deliberate omission:** it does **NOT** delete `slayhealth_profile_draft_<uid>` (`:298`–`:307`). It used to (`removeItem(draftStorageKey())`), which meant any logout — *including a spurious one from a transient token‑refresh failure* — permanently destroyed the user's in‑progress profile; on logging back in they saw a fresh 0% onboarding with no recovery. The key is already per‑uid namespaced, so leaving it can't leak across accounts. **Do not "clean it up" — deleting it reintroduces a real data‑loss bug.** `apiFetch`'s terminal‑401 path echoes the same discipline (`utils/api.js:122` comment).

---

## 8. Report deep‑link recovery

The `/core-engine/*` report pages have **no state of their own** — they read `chronicResult`/`mfrResult`/`mentalResult` straight from context. So a hard refresh, deep link, or shared URL lands with empty context and would bounce to `/dashboard`. The WS8‑01 recovery path fixes that.

**The guard sequence** (`core-engine/layout.js:70`–`93`):

```
on mount / deps change:
  savedUser = localStorage['slayhealth_user']
  if !savedUser            → router.push('/')            # not even logged in
  if chronicResult && mfrResult → return                # context already hot
  if hydrationAttempted    → router.push('/dashboard')  # we already tried, nothing
  matchIdToTry = ?match= param || activeMatchId
  if !matchIdToTry         → set hydrationAttempted; push('/dashboard')
  hydrateFromMatchId(matchIdToTry).then(ok =>
     set hydrationAttempted; if !ok push('/dashboard'))
```

The final render guard `if (!user || !chronicResult || !mfrResult) return null;` (`layout.js:168`) keeps the report blank until hydration resolves.

**`?match=` URL sync** (`layout.js:100`): a second effect keeps `?match=<activeMatchId>` in the URL from *any* tab via `router.replace`, so refreshing/bookmarking/sharing survives without threading a query param through every navigation call site.

**`hydrateFromMatchId(matchId)`** (`CompatibilityContext.js:890`): fetches `GET /api/compatibility/matches/:id`, parses `analysis_json` (tolerant of a stringified body, `:900`), bails if `chronicResult`/`mfrResult` are absent, then delegates to `restoreMatchSession` rather than duplicating restoration logic.

**`restoreMatchSession(match)`** (`:824`) rehydrates field‑by‑field:

| Field | Behavior | Line |
|---|---|---|
| `chronicResult` / `mfrResult` | set if present | `:827`, `:830` |
| `mentalResult` | set if present, else null | `:833` |
| `activeMatchId` + details | set + fetch | `:838` |
| prospect **name** | conditional: from `*_manual_data.name`, else `match.prospect.name` **only if ≠ `'Partner B'`** | `:851`–`:859` |
| prospect **gender** | **unconditional mirror** of the user's gender (`isUserMale ? 'Female' : 'Male'`) | `:875` |
| prospect **DOB** | **deliberately NOT restored** | `:861` comment |

> **Why DOB is not restored (WS6‑05):** only a *derived age number* was ever persisted (`age = calculateAge(dob)` at match time), never the real DOB. Synthesizing a fake DOB from the age would be a subtler version of the same fabrication the fix removes. Gender, by contrast, is knowable with certainty (it's the mirror of the current user's gender — which `manual_data` slot the prospect's data lives in *is* that mirror), so it's restored unconditionally rather than left at a stale value. The upload‑time guard in `usg/page.js` blocks with an actionable message when DOB is genuinely unknown.

Related open item: `restoreMatchSession` only rehydrates the prospect name when it isn't the placeholder `'Partner B'`, so the **usg tab still has hardcoded `'Sachin'`/`'Swati'` name fallbacks** reachable when the name stays blank (WS6‑04).

Also note `calculateAge(dob)` (`:137`) **returns `30` when the DOB is missing or unparseable** — a fabricated default. Every age that flows into scoring can silently be this house value if upstream guards are bypassed. Treat `30` `[interim]` as a red flag, not a real age.

---

## 9. API base‑URL resolution (`config/api.js`)

`getApiUrl()` (`config/api.js:1`) is an 11‑line switch that decides where every fetch goes:

```js
if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
return '';                    // dev: relative URLs → Next rewrite proxy
export const API_URL = getApiUrl();
```

- **Dev:** `NEXT_PUBLIC_API_URL` unset → `API_URL = ''` → all calls are same‑origin (`/api/...`). `next.config.mjs` `rewrites()` proxies `/api/:path*` → `http://localhost:3001` (`next.config.mjs:10`). This dodges phone‑on‑LAN firewalls blocking port 3001, so you can test on a real phone against your laptop. `allowedDevOrigins` (`next.config.mjs:20`) whitelists LAN IPs for HMR — machine‑specific, meaningless in prod.
- **Prod:** `rewrites()` returns `[]` when `NODE_ENV==='production'` (`next.config.mjs:11`) — **the proxy does not exist in prod.** You **must** set `NEXT_PUBLIC_API_URL` to the absolute backend URL, and it is **inlined at build time** (changing it needs a rebuild, not a restart). Forgetting it → `API_URL=''` → every call 404s against the frontend origin. This is the #1 prod failure mode (doc 03 §4).

---

## 10. App shell composition (`layout.js`)

`RootLayout` (`layout.js:32`) is a **Server Component** — the true root of the tree. Composition:

```
<html suppressHydrationWarning>          # :34
  <body>                                 # :39
    <CompatibilityProvider>              # :40  ← mounts ONCE, survives all nav
      {children}
      <MobileBottomNav />                # :42  ← inside provider (needs useCompatibility)
    </CompatibilityProvider>
    <ToastContainer />                   # :44  ← outside provider (imperative toast())
    <ConfirmDialogContainer />           # :45  ← outside provider
  </body>
</html>
```

Key facts:
- **The provider is at the true root, so it mounts once and survives `router.push`.** This is *the* reason the Phase‑2 rehydrate‑on‑auth effect (§6) exists.
- `Toast`/`ConfirmDialog` sit **outside** the provider because they're driven by imperative module‑level singletons (`toast()`), not context — so they work even on error/logged‑out screens.
- `viewport` (`:24`) sets `maximumScale:1`, `userScalable:false`, `interactiveWidget:'resizes-content'` — the mobile UI is a fixed‑scale app shell, not a zoomable document.
- `suppressHydrationWarning` on `<html>`/`<body>` (`:37`, `:39`) absorbs the expected server/client mismatch from font‑variable classes and the mobile hooks.

**`MobileBottomNav` gating** (`MobileBottomNav.js:131`) is the one piece of shell logic worth memorizing:

```js
if (!user?.name || pathname === '/' || pathname.startsWith('/invite/')
    || pathname.startsWith('/add-prospect') || pathname.startsWith('/core-engine'))
  return null;
```

It gates on a **saved name** (fully onboarded) rather than a route allow‑list, so it shows on every authenticated app page while staying off login/onboarding. The four excluded route prefixes each own their own viewport or nav: `/add-prospect` (full‑viewport wizard), `/invite/*` (a different person entirely), `/core-engine/*` (its own scrollable section nav), and — importantly — **`/`**, the public marketing page, because a returning authenticated visitor still lands there first.

> **Open item UX1‑07:** confirm this gate stays correct. The bug it fixed was the account holder's Home/Health/Chat/Analysis tabs rendering on top of the public landing page and the invite page. Any new "outside the app" route needs adding to this list.

---

## 11. The mobile viewport hooks

### `useIsMobile()` — tri‑state SSR contract (`useIsMobile.js`)

Built on `useSyncExternalStore` over `matchMedia('(max-width: 767px)')`. Its contract is **tri‑state**: `true | false | undefined`.

- `getServerSnapshot()` returns `undefined` on the server / first paint by design (`:22`).
- **Consumers must render nothing until it resolves**, then mount **EITHER** the mobile **OR** the desktop tree — never both. Rendering both double‑mounts heavy per‑page components (SVG score bars, chat drawers) just to CSS‑hide one side.

This is the frontend's answer to the "mobile is the locked reference, web needs work" split (doc 01) — the two trees are genuinely different component subtrees, selected at runtime, not one responsive tree.

### `useKeyboardInset()` — on‑screen‑keyboard overlap (`useKeyboardInset.js`)

Returns a px number: how much of the viewport's bottom is covered by the on‑screen keyboard. Computes `innerHeight - vv.height - vv.offsetTop` over `visualViewport` (`:20`), clamped to `≥0`. Returns `0` where the browser already shrank the viewport (desktop, well‑behaved iOS) and the **real keyboard height** inside in‑app webviews (WhatsApp/Instagram) where the layout viewport never resizes. Used to push bottom‑anchored elements (primary action buttons, chat composer) up so they stay visible either way. Returns `undefined`‑free `0` when `visualViewport` is absent (`:18`).

---

## 12. The misfiled clinical constants (exported from the context)

A large block of **clinical display constants and helpers lives in `CompatibilityContext.js`** and is exported for the report pages — even though they conceptually belong with the engines (docs 07–09). Grep here when hunting frontend threshold logic. **All thresholds below are `[interim]` house values pending clinical review** unless a cited source is noted.

### Severity + band display

| Symbol | Line | Value |
|---|---|---|
| `SEV` | `:16` | `ok→'Normal'`, `borderline→'Borderline'`, `high→'High'` (+ tailwind dot/text classes) |
| `BAND` (IDRS) | `:22` | `low`: "Under 30 — high negative predictive value (95.1%); undiagnosed diabetes unlikely." · `mod`: "30–50 — elevated; warrants confirmatory glucose testing." · `high`: "≥ 60 — CURES screening cut‑off. ~1 in 6 carry undiagnosed diabetes (PPV 17%)." |
| `idrsBand(s)` | `:28` | `s<30→low`, `s<60→mod`, else `high` |

The BAND notes cite the Indian Diabetes Risk Score / CURES cut‑off narrative; still treat the exact percentages as `[interim]` display copy — verify against the engine (doc 07) before relying on them as validated.

### Biomarker flag thresholds — return `'high'|'borderline'|'ok'|null` (`[interim]`)

| Fn | Line | Thresholds |
|---|---|---|
| `flagHbA1c(v)` | `:34` | ≥6.5 high · ≥5.7 borderline |
| `flagBP(s,d)` | `:35` | s≥140 \|\| d≥90 high · s≥130 \|\| d≥85 borderline |
| `flagBMI(v)` | `:36` | ≥25 high · ≥23 borderline (Asian cutoffs) |
| `flagTG(v)` | `:37` | ≥200 high · ≥150 borderline |
| `flagHDL(v,sex)` | `:38` | `low = sex==='male'?40:50`; v<low high · v<low+10 borderline |
| `flagHOMA(v)` | `:39` | ≥2.5 high · ≥2.0 borderline (premium only) |
| `flagCRP(v)` | `:40` | ≥3 high · ≥1 borderline (premium only) |

`biomarkerFlags(p, premium)` (`:42`) assembles the row set (HbA1c, Blood pressure, BMI, Triglycerides, HDL, + HOMA‑IR/hs‑CRP when premium) and returns `{rows, flagged, high, count}`.

### Other helpers (`[interim]`)

- **`classifyWaist(waistVal, gender)`** (`:163`): male ≥90 High / ≥85 Borderline / else Normal; female ≥80 High / ≥75 Borderline / else Normal. `NaN → 'Normal'`.
- **`calculateAge(dob)`** (`:137`): **returns `30` when DOB is missing/unparseable** — a fabricated default (WS6‑05, §8). `[interim]` and dangerous.
- **`getDriftedBiomarkers(raw, lifestyle, years, sex)`** (`:60`): applies per‑year drift then re‑flags. All rates `[interim]`:

| Marker | Base drift/yr | Adverse | Protective |
|---|---|---|---|
| BMI | +0.03 | +0.15 (Sedentary or Poor diet) | −0.05 (Active + Healthy) |
| SBP / DBP | +0.5 / +0.3 | +1.2 / +0.7 (High stress or Regular smoking) | — |
| HbA1c | +0.015 | +0.04 (Poor diet or Sedentary) | −0.01 (Healthy + Active) |
| TG | +1.5 | +3.5 (Poor diet) | — |
| HDL | −0.2 | −0.5 (Regular smoking) | +0.1 (Active) |

- **`getRiskDrivers(data, age)`** (`:117`): age≥50 "age progression (over 50)", ≥35 "age category (35‑49)"; waist High/Borderline; activity Sedentary/Moderate; `parentDiabetes === 'One' || 'Both' || true` → "family history". Note the explicit guard (`:128` comment) that `'None'` — itself a truthy non‑empty string — must **not** trigger "family history". Empty → "No primary clinical drivers detected at this baseline."

> Regulatory note (REG‑06, doc 21): these helpers render diagnostic‑style bands ("High", "undiagnosed diabetes unlikely", "warrants confirmatory glucose testing") directly in the UI. The docs take **no** position on wellness‑vs‑SaMD; the report layout keeps the "always confirm results with a qualified doctor" disclaimer (`core-engine/layout.js:378`) and you should not add clinical authority the product hasn't earned.

---

## Open items (see doc 21 for the authoritative list)

- **The God‑context re‑render debt (architectural, not a review finding):** `CompatibilityContext.js:945` passes a fresh object literal to `value={{…}}` every render, so all 13+ consumers re‑render on any state change. Splitting the context (auth / forms / results) or memoizing the value is the highest‑leverage structural refactor in the frontend. The misfiled clinical constants (§12) and the duplicated draft logic in `add-prospect` (§3) belong to the same cleanup.
- **UX7‑01 — `safeJson` exists but `apiFetch` doesn't apply it.** `safeJson`/`responseJson` are defined (`utils/api.js:75`, `CompatibilityContext.js:575`) but `apiFetch` still returns a raw `Response`; login/invite/add‑prospect call sites do bare `res.json()` and can render a raw `SyntaxError` from a non‑JSON body (rate‑limiter HTML, dev‑proxy 500). Highest‑leverage fix: fold safe parse into `apiFetch`.
- **UX10‑05 — no timeout/AbortController anywhere.** `apiFetch` waits the full backend worst case (~90s on chat retry‑with‑fallback) with no cancel.
- **UX1‑02 [P0] — login/silent‑refresh race.** `login/page.js`'s mount effect reads `slayhealth_user` synchronously and races the context's async `silentRefresh`; an interrupted signup (OTP verified, name not yet set) can show a fully logged‑out UI even though the session silently recovered.
- **WS6‑04 / WS6‑05 — usg tab name fallbacks + DOB/age fabrication.** Hardcoded `'Sachin'`/`'Swati'` fallbacks reachable when `restoreMatchSession` leaves the name blank; `calculateAge` still fabricates `30` on missing DOB — upload‑time guards must block scoring inputs.

---

*Next: `15_frontend_onboarding_and_add_prospect_wizard.md` — the intake wizard that writes into the `onboardingForm`/`prospectForm` and draft keys documented here.*
