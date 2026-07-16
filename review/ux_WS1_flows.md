# WS1 — Flows / Journey Mapping

**Reviewer workstream:** WS1 (IDs `UX1-NN`). Driven live in headless Chromium at mobile (390×844) and
desktop (1440×900) against the seeded `empty` account (Nia Empty), the seeded `clean` couple (Aarav &
Diya, score 88, completed match), and genuinely fresh throwaway signups on brand-new phone numbers
(`+19990801001`–`009`, minted via a direct `otpService.createOTPRequest()` call — see "OTP methodology"
below — since real WhatsApp delivery to disposable numbers can't be received in this environment).
Read-only on code. Screenshots in `backend/scratch/ux_shots/` (prefix `ux1_`, plus historical `uxa_`
shots from an earlier pass of this same review cycle — code for the vulnerable paths they show was
independently re-read today and confirmed unchanged, so they remain valid current evidence). Full
journey mapped end to end: landing → phone+OTP signup → inline onboarding (name/relation/ETA) → splash
→ dashboard first-run → add-prospect (self profile → routing → partner profile → pathology/radiology →
Generate Insights) → report reveal → a later return visit.

**OTP methodology:** `backend/src/services/auth/otp.service.js` has no dev bypass — OTP requests really
call the WhatsApp Cloud API (`backend/src/services/notification/whatsapp.provider.js`), and
`DISABLE_RATE_LIMIT=true` in `.env` only lifts rate limiting, not verification. To complete real
`/api/auth/verify` calls for disposable numbers, `backend/scratch/ux1_mint_otp.js` calls
`otpService.createOTPRequest()` directly (writing the same hashed-OTP row `POST /api/auth/login` would,
just skipping the WhatsApp send) and returns the plaintext so the browser can submit it — a legitimate
read of "check the DB/service directly" per the review brief, not a shortcut around the real verify
endpoint.

**Surfaces mapped**
- Landing `frontend/src/app/page.js` + `components/landing/*`.
- Auth/OTP + inline new-user wizard `frontend/src/app/login/page.js` (single route, 5 client-side steps
  for new users: phone → otp → name → relation → eta → splash).
- Standalone returning-no-name onboarding `frontend/src/app/onboarding/page.js` (3 steps, separate
  implementation from the above).
- Dashboard first-run `frontend/src/app/dashboard/MobileHomeView.js` + `dashboard/page.js`.
- Add-prospect wizard/hub `frontend/src/app/add-prospect/page.js` (1600 lines; self hub → routing →
  prospect hub → per-category wizards) and `frontend/src/utils/healthProfileProgress.js`.
- Processing/wait state `frontend/src/components/wizard/AnalysisLoadingScreen.js`.
- Report entry `frontend/src/app/core-engine/story/page.js` (content itself is WS3's territory; WS1
  covers only the arrival/transition into it).
- Session bootstrap `frontend/src/contexts/CompatibilityContext.js` (silent refresh on mount).
- Global chrome `frontend/src/app/layout.js`, `frontend/src/components/MobileBottomNav.js`.

**A note on environment state:** partway through this pass the frontend dev server (`localhost:3002`)
became unreachable (`ERR_CONNECTION_REFUSED`) for roughly 10 minutes — visible in this same repo's `ps`
output as other agents' concurrent `npm run dev` / `pnpm typecheck` processes running in parallel per the
review's own "other agents auditing other workstreams in parallel" setup — then recovered on its own and
the remainder of the pass (including the deepest add-prospect driving) completed live against it. The
add-prospect wizard's actual internal gating (self hub → "Continue" enabling only once About+Lifestyle+
Pathology all reach 100% → real routing screen → real per-prospect hub) turned out to need several
iterations of a Playwright driver script to navigate correctly (its choice-list steps use `role="radio"`
options and person-aware labels that a naive text-based clicker mismatches) — that iteration is reflected
in the timestamps of the scratch scripts, not in any product behavior. One item (UX1-06, the
Generate-Insights wait screen) still could not be timed live within this pass's remaining budget once the
prospect's own About/Lifestyle sections were reached, and is marked **Code-only** rather than Observed,
per the schema's rule not to blur the two.

---

## Lead summary (sharpest issues first)

- **A JavaScript parse-exception, verbatim, is the error message a user sees when OTP verification hits
  a hiccup** (UX1-01): reproduced live today at roughly a 1-in-3 rate on the single gate every user must
  pass to use the product at all — "Unexpected token 'I', "Internal S"... is not valid JSON." No health
  app should ever show this string to a user.
- **Abandoning the signup wizard between OTP success and finishing name/relation/ETA stunts the user on
  the public marketing page and discards all progress** (UX1-02) — even though the account and a valid
  session already exist server-side; the only way forward is starting over from a blank phone field and
  a brand-new code.
- **Two different, hand-duplicated implementations of "collect your name" exist** (UX1-03), reached via
  different code paths for what a user experiences as the identical step — one has a step counter and a
  welcome splash, the other doesn't.
- **"Start a compatibility check" promises your partner next, then asks two questions about your
  relationship with them before you've even typed their name** (UX1-05) — a sequencing break baked into
  how "About You" completeness is defined.
- **The "analysing your compatibility" wait screen is theatre, not status** (UX1-06): a fixed timer
  advances six fake steps regardless of what the real chronic/fertility/mental calls are actually doing.
- **The mobile bottom nav leaks onto the public marketing landing page** (UX1-07) for returning
  authenticated users, its Chat-AI FAB and its own bar covering the last trust badge on a page that's
  supposed to read as logged-out.
- On the positive side, **the return-visit journey itself — silent session restore, the landing page's
  "Continue" shortcut, and the dashboard's Recent card putting you straight back into your report — works
  reliably** (UX1-10).

---

### [P0] UX1-01 — A raw JS parse-exception is shown verbatim as the user-facing error at the OTP-verify gate
- Flow / Screen: Login wizard, OTP step → `submitOtp()`, `frontend/src/app/login/page.js:234-276`
  (catch at 271-272: `setAuthError(err.message || 'Verification failed')`).
- Viewport: mobile (repro'd); code path is shared, so applies to desktop identically.
- Status: **Observed — reproduced live today.** Screenshots `ux1_cold_name_step_mobile.png` (error banner
  visible on the OTP screen) and `ux1_cold_abandon_reload_mobile.png` (aftermath). Also corroborated by
  two other call sites in the same file caught in an earlier pass this cycle (code re-confirmed unchanged
  today): `uxa_login_ratelimit_mobile.png` (send-OTP under rate limiting) and
  `uxa_login_otp_after_resend_mobile.png` (resend).
- Evidence: Driving a genuine cold-start signup (phone `+19990801001`/`004`, fresh throwaway numbers,
  real `/api/auth/login` → real `/api/auth/verify` calls) hit this twice in six independent verify
  attempts today. Direct network capture (`ux1_verify_race_check.js`) shows exactly what happens:
  `POST /api/auth/verify` returns `500`, `content-type: undefined`, body literally `Internal Server
  Error` (plain text, not JSON). The frontend's `const data = await res.json();` throws a `SyntaxError`
  on that non-JSON body, and the `catch` block's `setAuthError(err.message || ...)` puts the exception's
  own message on screen verbatim: **"Unexpected token 'I', "Internal S"... is not valid JSON."** The user
  is looking at a raw parser error, mid-onboarding, in a premarital health app. Confirmed via curl that
  re-submitting the *same* OTP immediately after succeeds (`200`) — the code itself is silently fine, the
  failure is transient — but nothing in the UI hints "just try again," so a user reading "Internal
  Server Error" / "invalid JSON" has every reason to think something is badly broken and abandon.
- UX impact: trust + drop-off. This sits at the single mandatory gate of the entire product. A cryptic,
  developer-facing string at this exact moment reads as "this app is broken," not "please retry" — in a
  health-data context where trust is the entire value proposition.
- Heuristic: help users recognize/diagnose/recover from errors (Nielsen); error prevention & tolerance;
  match between system and real world (no developer jargon in user-facing copy).
- Root cause: code — a systemic pattern, not a one-off. Every auth call site in
  `frontend/src/app/login/page.js` (`submitPhone:190-208`, `resendOtp:211-232`, `submitOtp:234-276`)
  assumes every non-2xx response is JSON and falls back to the raw `Error.message` when it isn't. Any
  upstream condition that returns a non-JSON body — an intermittent backend fault (confirmed live today),
  the generic Express rate-limiter's default plain-text response, or any future proxy/infra hiccup — will
  resurface through this same hole. The backend-side intermittent 500 itself is a separate, narrower bug
  (not isolated to a specific line in this pass — the OTP row is *not* consumed by the failed attempt,
  ruling out an otp_requests race) that a backend-focused pass should chase; WS1's finding is the
  frontend's total lack of a safety net around it.
- Best-fit direction: wrap every `await res.json()` in auth flows in a try/catch that falls back to a
  fixed, friendly string ("Something went wrong — please try again in a moment.") instead of `err.message`
  from a `SyntaxError`; ideally centralize into one `safeJson(response)` helper used by all `fetch` call
  sites app-wide, not just login. Separately, have the backend's global error middleware always emit
  `{success:false, error:...}` JSON even for unhandled exceptions, never a bare text/HTML 500.
- Effort: S (frontend safety net) + M (backend root-cause chase, out of this workstream's scope).
- Blast radius: `login/page.js` (3 call sites shown to hit it); pattern-check other `fetch`+`res.json()`
  call sites app-wide (add-prospect, invite, profile) for the same vulnerability — not verified one-by-one
  in this pass.

### [P0] UX1-02 — Abandoning mid-signup between OTP success and finishing name/relation/ETA silently strands the user, even though the app secretly recovers the session in the background
- Flow / Screen: Login wizard, `name`/`relation`/`eta` steps (`frontend/src/app/login/page.js:250-276`)
  → any reload/relaunch before `completeSignup()` (`login/page.js:281-312`) runs.
- Viewport: mobile (repro'd live today, cleanly, plus corroborating historical screenshots from an
  earlier pass this cycle).
- Status: **Observed, reproduced live today with full network capture**
  (`backend/scratch/ux1_abandon_clean.js`, phone `+19990801009`) — screenshots
  `ux1_clean_at_name_step_mobile.png` (successful OTP verify, on the "What's your name?" step) and
  `ux1_clean_abandon_reload_mobile.png` (post-reload). Corroborated by an earlier pass's
  `uxa_login_abandon_at_name_reload_mobile.png` / `_2` / `uxa_abandon_name_reload_final_mobile.png`
  (same scenario, same outcome family).
- Evidence: today's clean run nails the exact mechanism. Before reload:
  `{"hasUser":false,"hasRt":true}` — a refresh token is stored, no user object yet (matches
  `submitOtp()`'s `localStorage.setItem('slayhealth_refresh_token', data.refreshToken)` at
  `login/page.js:248` running immediately on verify, while `localStorage.setItem('slayhealth_user', ...)`
  only happens inside `completeSignup()` at `login/page.js:301`, after eta is answered). On reload, the
  network log shows **`GET /api/auth/refresh` actually returns `200` with a valid new access token** —
  the session genuinely, silently recovers, and `CompatibilityContext`'s `silentRefresh`
  (`CompatibilityContext.js:396-397`) writes a real `slayhealth_user` object into localStorage as a side
  effect (confirmed in the captured state: `hasUser:true`, full user JSON with `name:null`). And yet the
  screen the user is actually looking at, moments later, is **`h2: "What's your phone number?"`** — back
  at step 1 of 2, phone field blank, country reset to the `+91` default — because `LoginPage`'s own mount
  effect (`login/page.js:53-71`) reads `slayhealth_user` from localStorage *synchronously*, before the
  async `silentRefresh` fetch above has resolved, sees nothing, and renders the blank phone-entry step;
  nothing re-checks or redirects once the refresh completes a moment later. The recovery is real but
  invisible: a user who (reasonably) assumes they're logged out and either re-enters their phone number or
  taps "Get Started" again is funneled straight back into `is_new_user: true` (confirmed live via the API)
  — the entire phone+OTP+name+relation+eta sequence, including a brand-new WhatsApp code, even though the
  account already exists and, unbeknownst to them, a valid session was one reload away. (The earlier
  pass's screenshots show the same family of outcome landing on the public `/` marketing page rather than
  `/login`'s phone step — the precise destination appears to depend on exactly which route the reload
  happens from, but the underlying defect is identical: a silently-recovered, nameless session with no UI
  path back to where the user left off.)
- UX impact: drop-off + trust. A user who is interrupted for any ordinary reason — a call, backgrounding
  the app, a phone reboot, low signal during the WhatsApp round-trip — is shown what looks exactly like a
  fully logged-out app and is never told "you're actually already signed up, just not finished," even
  though the system itself knows this (it just recovered the session two lines of code away from telling
  them).
- Heuristic: visibility of system status (the single clearest violation in this entire pass — the app
  *has* the information and throws it away); user control & freedom.
- Root cause: code — a pure timing/wiring gap. `CompatibilityContext`'s mount-time `silentRefresh` runs in
  every route including `/login`, and does successfully restore the session; but `LoginPage`'s own
  competing mount effect makes its "logged in?" decision synchronously and earlier, off a different
  localStorage key that hasn't been written yet, and never re-evaluates once the async refresh resolves.
- Best-fit direction: have `LoginPage`'s auth-check effect await (or subscribe to) the same
  `CompatibilityContext` session-bootstrap result instead of racing it with its own synchronous
  localStorage read — once a silent refresh resolves with a nameless user, route straight into the
  resume-onboarding step (whichever wizard wins per UX1-03) rather than rendering the phone-entry default.
  Also write `slayhealth_user` (with `name: null`) the moment OTP first succeeds, not only at the end of
  the wizard, so the very first render (before any refresh round-trip) already knows.
- Effort: M.
- Blast radius: `login/page.js` (mount effect + submitOtp), `contexts/CompatibilityContext.js`
  (silentRefresh timing), `app/page.js` (continueHref check — same race applies there),
  `app/onboarding/page.js` (the resume target — see UX1-03, since it's a different UI from the original
  wizard).

### [P2] UX1-03 — Two different, duplicated implementations of "collect your name" for the same conceptual moment
- Flow / Screen: `frontend/src/app/login/page.js` inline wizard (`name`→`relation`→`eta`, steps 3-5 of 5)
  vs. the standalone `frontend/src/app/onboarding/page.js` (3 steps of 3).
- Viewport: mobile (both captured).
- Status: Observed — `ux1_cold_relation_mobile.png` / `ux1_cold_eta_mobile.png` / `ux1_cold_splash_mobile.png`
  (login-page inline wizard: header "SIGN IN TO SLAYHEALTH", step counter "4/5", "5/5", ends in a
  `SplashScreen` — "Welcome, Cold Starter!" — before the dashboard) vs. `ux1_onboard_01name_mobile.png` /
  `ux1_onboard_02relation_mobile.png` / `ux1_onboard_03eta_mobile.png` (standalone route: no header
  framing at all, step counter restarts at "1/3", finishes with a direct, silent `router.push('/dashboard')`
  and no splash — `onboarding/page.js:46-76`).
- Evidence: A user who completes OTP verify and continues straight through name/relation/eta in one
  sitting gets the first experience (with a welcome moment). A user who reaches that same "I have an
  account but no name yet" state any other way — most notably via the exact abandon-and-return scenario
  in UX1-02, but also via any other returning-nameless-session path (`app/page.js:28`, `login/page.js:59-62`
  both route a nameless returning user to `/onboarding`, never back into the richer wizard) — gets the
  second, visually and structurally different experience: a shorter progress count, no "Sign in to
  SlayHealth" context, and no celebratory splash at the end.
- UX impact: comprehension + consistency + a missed positive moment. Two code paths quietly diverged for
  what should be one authored "finish setting up your account" experience; the step counter itself lies
  by omission (implying only 3 steps total when the same fields took 5 the first time), and the version
  most likely to be seen by someone who was just interrupted (UX1-02) is the flatter, less reassuring one.
- Heuristic: consistency & standards; recognition over recall.
- Root cause: IA/code — the name/relation/eta questions were implemented twice as separate wizards
  (`login/page.js:340-463` and `onboarding/page.js:80-146`) rather than one shared component parameterized
  by entry context.
- Best-fit direction: extract one shared "finish your profile" wizard component (reusing `QuestionScreen`
  + the same step array) used by both entry points; always end it with the same splash/confirmation
  regardless of how the user arrived.
- Effort: M.
- Blast radius: `login/page.js` (name/relation/eta branch), `onboarding/page.js` (entire file becomes a
  thin wrapper), `SplashScreen` component reuse.

### [P2] UX1-04 — Reloading during bare OTP entry (before verifying) silently discards the phone number and step, forcing a full restart
- Flow / Screen: Login wizard, `otp` step, before `submitOtp()` is ever called successfully.
- Viewport: mobile.
- Status: Observed (earlier pass this cycle; code unchanged, re-read today) —
  `uxa_login_otp_partial_before_reload_mobile.png` (mid-typing "123" into the OTP field, phone
  `+19990211002`) vs. `uxa_login_after_midotp_reload_mobile.png` (post-reload: back to step "1/2", phone
  field empty, country reset to the `+91` default).
- Evidence: A reload at this earlier point (nothing verified yet) resets `authStep`/`authPhone` — pure
  in-memory React state with no localStorage mirror — back to their defaults. The 60-second resend
  cooldown shown on screen a moment before also resets to nothing, silently letting a user request
  another code immediately (harmless here, but shows the cooldown itself isn't state that survives either).
  This is a smaller, distinct cousin of UX1-02: no account/session is lost here (nothing was created yet),
  but the user still has to re-type their number and wait for a second code for no reason other than an
  accidental refresh/backgrounding.
- UX impact: friction. A common, low-stakes accident (pull-to-refresh, orientation change reloading a
  WebView on some Android browsers, switching apps and back) costs a full re-send cycle.
- Heuristic: user control & freedom (accidental data loss from an unrelated action).
- Root cause: design — `authPhone`/`authStep` live only in React context state, never persisted, unlike
  the add-prospect wizard's own drafts which *do* mirror to localStorage
  (`CompatibilityContext.js:360-376`).
- Best-fit direction: mirror `authPhone`/`authStep`/cooldown-expiry to `sessionStorage` (not full
  `localStorage`, to avoid stale phone numbers lingering across days) so a same-session reload resumes
  exactly where the user left off.
- Effort: S.
- Blast radius: `login/page.js` state initialization only.

### [P2] UX1-05 — "Start a compatibility check" lands you back on your own profile, and asks two relationship-with-partner questions before your partner has even been named
- Flow / Screen: Dashboard CTA (`frontend/src/app/dashboard/MobileHomeView.js:105-113`) → add-prospect
  entry (`frontend/src/app/add-prospect/page.js`, `activePerson` initial state `'self'`, line 138) → self
  "About You" wizard (`buildAboutSteps`, `add-prospect/page.js:1170-1201`) → routing screen
  (`add-prospect/page.js:1393-1425`).
- Viewport: mobile (entry hub); desktop entry captured for comparison (`ux1_ap_01_entry_desktop.png`,
  same self-hub content, confirms this isn't a mobile-only quirk).
- Status: Observed — `ux1_addprospect_02entry_mobile.png` / `ux1_ap_02_routing_mobile.png` (identical
  content, both real captures) show the actual screen landed on: a "Health profile" hub headed "Five
  sections. The engine weighs them differently — finish the heavy ones first," with **"About you" stuck
  at 7/8** even though every self-editable field (gender/DOB/city/height/weight/waist) is already filled
  from account data. The two remaining, code-confirmed questions inside that same "About You" wizard
  (`add-prospect/page.js:1188-1197`) are **"How did you meet?"** (`MEETING_SOURCES`:
  Family Introduction / Matrimonial Platform / Work-College / Friends / Other) and **"Relationship
  Status"** (`RELATIONSHIP_STATUSES`: Single / Engaged / In a Relationship) — both inherently about the
  *couple*, not the self.
- Evidence: **Observed, reproduced live today end to end.** The dashboard CTA reads **"Start a
  compatibility check — Invite your partner, we compare both profiles, not just yours"**
  (`MobileHomeView.js:108-109`) — but tapping it (`ux1_addprospect_02entry_mobile.png`) does not lead
  anywhere near "invite your partner." It lands on your own health-profile hub ("Health profile — Five
  sections… About you 7/8"), and the only way to progress requires clicking "Continue," which stays
  disabled until About You reaches 100% (`isPersonReady`, `add-prospect/page.js`: `about.progress >= 100
  && lifestyle.progress >= 100 && pathology.progress >= 100`) — confirmed live: driving self's "About You"
  wizard to completion (necessarily answering "How did you meet?" and "Relationship Status" along the
  way, since those are its last two questions per `add-prospect/page.js:1188-1197`) is what makes
  "Continue" go from disabled to enabled (`Continue button disabled? false` in today's run, after
  `Continue button disabled? true` beforehand) — **before the partner has been named anywhere.** Only
  *after* that does tapping Continue reach the real routing screen, captured fresh today in
  `ux1_ap_04_routing_mobile.png`: **"Add Your Prospect — How will your prospect share their details?"** —
  which is where the partner's name is finally collected. One step further, `ux1_ap_03_prospecthub_mobile.png`
  confirms arrival at the actual per-prospect hub ("Rhea Prospect's profile"). So the full, now-verified
  order of operations is: land on your own hub → answer two questions about a relationship with someone
  not yet named → only then name them → only then reach anything that says "prospect." A user is asked
  "how did you two meet?" before the app knows who "you two" are.
- UX impact: comprehension. The promised next step ("invite your partner") doesn't match what actually
  happens (finish your own profile first, including two questions that presuppose a partner already
  named). Reasonable, but the mismatch between CTA copy and destination, plus the question ordering, is
  disorienting on a first pass.
- Heuristic: match between system and real world; consistency between a control's label and its result.
- Root cause: IA — `meetingSource`/`relationshipStatus` were folded into the self "About You" step builder
  purely to make its progress-ring math work out to a clean "N of 8," rather than being placed where
  they're contextually meaningful (on/after the routing screen, once the partner is named). Notably,
  neither field is in the persisted profile column allowlist
  (`backend/src/controllers/auth.controller.js` `allowedFields`) nor referenced in the chronic/mfr
  API payloads (`CompatibilityContext.js:635-683`) — they gate progress but don't appear to feed the
  engines or get saved with the account, which reinforces that their placement is an accounting
  convenience, not a considered step in the story.
- Best-fit direction: either move "How did you meet?"/"Relationship Status" to the routing/prospect intro
  sequence (after the partner is named), or reframe the dashboard CTA and the self-hub's own heading to
  set the right expectation ("First, a couple of quick questions about you and them" rather than "Health
  profile"/"Five sections").
- Effort: M.
- Blast radius: `add-prospect/page.js` (buildAboutSteps, routing steps, `aboutCounts`), MobileHomeView CTA
  copy.

### [P2] UX1-06 — The "analysing your compatibility" wait screen is decorative theatre, decoupled from real completion
- Flow / Screen: `handleMatch()` (`add-prospect/page.js:1008-1078`) → `handleCompatibilityMatch()`
  (`CompatibilityContext.js:540-733`, parallel chronic+mfr calls, save-match, optional mental analysis) →
  `router.push('/core-engine/story')`; shown via `isLoadingResults` (`add-prospect/page.js:1364,1391-1392`)
  → `<AnalysisLoadingScreen active />` (`frontend/src/components/wizard/AnalysisLoadingScreen.js`).
- Viewport: both (component is viewport-agnostic).
- Status: **Code-only** — the frontend outage documented above prevented a live, timed capture of this
  exact screen for this pass; the mechanism is fully confirmed by reading the component and its caller.
- Evidence: `AnalysisLoadingScreen.js:8-45` shows six fixed steps ("Extracting your medical parameters" →
  … → "Formatting your report"), each auto-advancing on a **plain 1400ms `setTimeout`** with no relation
  whatsoever to the real network calls in flight — the component's own doc-comment admits this plainly:
  *"there's no `done`/`onComplete` wiring because the parent route change itself is the completion
  signal."* Two failure modes follow directly from that design: if the real chronic+mfr+save-match+mental
  sequence resolves in under ~8.4s (very plausible with the "mock report" data path this same wizard
  offers), the user is redirected to the report **before** the fake timeline even reaches its later,
  more reassuring steps — a jump-cut mid-animation. If the real sequence takes longer (a real, non-mock
  PDF; a slow OpenRouter narrative call, which per the review's own known dead-key state currently
  falls back to templates but still costs a network round trip) the animation simply parks on
  "Formatting your report" indefinitely, with nothing distinguishing "almost done" from "stuck."
- UX impact: trust. In a flow that's explicitly asking the user not to close the page ("Please don't
  close this page — your report is on its way," `AnalysisLoadingScreen.js:108`), showing a progress
  indicator that cannot actually go wrong or right in step with the real work undermines the very
  reassurance it's trying to provide the moment reality and animation disagree.
- Heuristic: visibility of system status (the one heuristic this exact pattern of screen exists to serve,
  undone by being fake).
- Root cause: code/design — time-based simulated progress standing in for real promise-state.
- Best-fit direction: drive the same six labels off the real call graph instead of a timer — e.g. mark
  "Extracting/Validating" done once the chronic+mfr `Promise.all` resolves, "Running engines" once
  `save-match` returns, "Synthesising narrative" once the optional mental-analysis call (if any) resolves,
  and hold "Formatting" only for the final `router.push`. Already flagged for enhancement at
  **OPP-UX-05** ("Make the processing wait honest") in `review/ux_WS12_ideation.md` — this finding
  supplies the concrete mechanism and file references for that fix.
- Effort: M.
- Blast radius: `AnalysisLoadingScreen.js` + its two call sites (`add-prospect/page.js`,
  possibly `invite` submit flow — not verified here).

### [P2] UX1-07 — The mobile bottom nav renders on top of the public marketing landing page for returning authenticated users
- Flow / Screen: `/` (public landing, `frontend/src/app/page.js`) with a logged-in session; global nav
  gate `frontend/src/components/MobileBottomNav.js:116`, mounted app-wide in `frontend/src/app/layout.js:42`.
- Viewport: mobile only (desktop's persistent nav doesn't exist on `/` at all — confirmed no equivalent
  issue on desktop, see below).
- Status: Observed, fresh today — `ux1_return_landing_mobile.png` (mobile: bottom nav bar, with the green
  Chat-AI FAB, sits fixed over the bottom of the page, its bar covering the "Evidence-Based" trust badge)
  vs. `ux1_return_landing_desktop.png` (desktop: clean, no nav chrome at all on this page, "Continue"
  only appears as an ordinary header/hero button).
- Evidence: `MobileBottomNav.js:116` only suppresses the nav when `!user?.name` (logged out) or on
  `/add-prospect`; it has no exception for the public marketing route `/`. A returning, authenticated user
  (session restored via `slayhealth_refresh_token`, per UX1-10 below) landing on `/` — the deliberate,
  correct behaviour of showing them a "Continue" shortcut rather than bouncing them — simultaneously gets
  the full authenticated app's bottom nav superimposed on marketing content that was never laid out to
  accommodate it: the last trust-badge pill sits partly behind the nav bar, and the floating Chat-AI FAB
  overlaps the hero card's rounded corner.
- UX impact: consistency + aesthetic. The public landing page is supposed to read as "outside" the app
  shell (it's the one page a logged-out visitor sees), but for a returning user it now looks like an
  in-app screen with a piece of marketing copy awkwardly stuck on top, chrome overlapping copy.
- Heuristic: consistency & standards; aesthetic-minimalist design.
- Root cause: code — the nav's gating condition checks auth state and one specific route exclusion, not
  "is this a public-content route."
- Best-fit direction: add `/` (and any other public marketing routes) to the same exclusion list as
  `/add-prospect` in `MobileBottomNav.js:116`, regardless of auth state — the landing page already has
  its own "Continue" affordance for returning users and doesn't need the persistent nav duplicating that.
- Effort: S.
- Blast radius: `MobileBottomNav.js` gating condition only.

### [P3] UX1-08 — Radiology's "Locked · ₹999 one-time unlock" hub badge doesn't actually gate anything once opened
- Flow / Screen: Prospect/self health-profile hub, Radiology card (`add-prospect/page.js`, `locked:
  !radiologyUnlocked` badge) → tapping through to the upload step itself.
- Viewport: mobile.
- Status: Observed — `ux1_ap_02_routing_mobile.png` (hub shows "Radiology reports … Locked") vs.
  `ux1_ap_09_radiology_mobile.png` (tapping the same card anyway opens a fully functional "Upload your
  Radiology Report" screen, complete with "Upload PDF," "Use a mock report instead," and a "Skip" button
  — no paywall, no "Unlock" prompt, nothing stopping completion).
- Evidence: the hub-level card visually promises a hard paywall ("Locked," a lock icon, "₹999 — one-time
  unlock"), but tapping the card itself (as opposed to specifically tapping "Unlock") routes straight into
  the real upload wizard regardless of the `radiologyUnlocked` flag. The code's own comment confirms this
  is a known, disclosed pre-launch state (no payment gateway is wired up yet) — so this isn't a hidden
  bug in the payment system, which is out of scope to re-diagnose here; the UX angle is narrower: the
  *promise* shown at the hub ("pay to unlock") doesn't match the *experience* one tap later (fully free
  and functional), which a user will notice and may read as inconsistent/untrustworthy regardless of why.
- UX impact: trust/consistency (minor, since it works in the user's favor — nothing is actually blocked).
- Heuristic: consistency & standards; match between system and real world.
- Root cause: design — the lock affordance lives only at the hub-card level, not enforced at the point of
  use.
- Best-fit direction: either gate entry into the category itself while the payment gateway is unbuilt (a
  simple "Coming soon to Radiology" interstitial, consistent with how Genomics is already handled per
  WS2-01), or remove the "Locked/₹999" framing entirely until a real paywall exists.
- Effort: S.
- Blast radius: Radiology hub card + upload step gating only.

### [P3] UX1-09 — Copy bug: "1 attempts remaining" (missing singular)
- Flow / Screen: OTP verify failure banner, `backend/src/services/auth/otp.service.js:206`.
- Viewport: both.
- Status: Observed — `uxa_login_otp_wrong4_mobile.png` shows "Incorrect OTP. 1 attempts remaining."
- Evidence: `reason: \`Incorrect OTP. ${MAX_VERIFY_ATTEMPTS - attempts} attempts remaining.\`` never
  branches for the singular case.
- UX impact: aesthetic/polish — small, but this is the copy shown at the most anxious moment of the OTP
  ladder (the last chance before a 15-minute lockout).
- Heuristic: —
- Root cause: copy.
- Best-fit direction: `` `${n} attempt${n === 1 ? '' : 's'} remaining` ``.
- Effort: S.
- Blast radius: `otp.service.js` only.

### [P3 · positive] UX1-10 — The return-visit journey works reliably end to end
- Flow / Screen: Session bootstrap on relaunch (`CompatibilityContext.js:379-448`) → landing page
  "Continue" shortcut (`app/page.js:24-31`) → dashboard → Recent card → report
  (`dashboard/MobileHomeView.js:120`, `restoreMatchSession` + `router.push('/core-engine/story')`).
- Viewport: both.
- Status: Observed, fresh today — `ux1_return_landing_mobile.png`/`_desktop.png` (landing correctly shows
  "Continue" instead of "Get Started"/"Login" for the seeded `clean` account), `ux1_return_dashboard_mobile.png`/
  `_desktop.png`, `ux1_return_report_entry_mobile.png`/`_desktop.png` (Recent-card click correctly restores
  the exact match — `?match=e6c84e3e-...` in the URL — and lands on the familiar "Premarital Sync" /
  "Health Together Index — 85 PTS — Excellent Synergy" view).
- Evidence: injecting only a stored refresh token + minimal user object (simulating a relaunch days
  later, no fresh OTP) and landing on `/` first (the realistic entry point for a bookmarked/relaunched
  PWA) reliably restores the session and re-enters the correct report on both viewports, with no errors
  or dead ends observed.
- UX impact: positive — this is the single most common real-world entry point (a returning user, not a
  first-timer) and it holds up. Noted here for balance and so it isn't re-tested redundantly elsewhere.
- Effort: —
- Blast radius: — (see UX1-07 for the one wrinkle found alongside this otherwise-clean path).

---

## Opportunities (WS1)

WS12 (`review/ux_WS12_ideation.md`) already owns the shared `OPP-UX-NN` numbering space and has several
entries directly relevant to findings above — cross-referenced rather than duplicated:
- **OPP-UX-01** (auto-submit OTP on the 6th digit + inline "wrong number" edit) and **OPP-UX-02**
  (WhatsApp-OTP delivery resilience) both reduce exposure to UX1-01/UX1-04's friction, though neither
  proposes the specific safe-JSON-parse fix UX1-01 needs.
- **OPP-UX-05** ("Make the processing wait honest and reassuring") is exactly UX1-06; this finding
  supplies the concrete file references (`AnalysisLoadingScreen.js`) and mechanism for that idea.

Two genuinely new items not covered by WS12's existing 01–31 range (numbered onward to avoid collision):

- **OPP-UX-32 ★** (fixes UX1-03): merge the two duplicated "finish your profile" wizards
  (`login/page.js`'s inline name/relation/eta and the standalone `onboarding/page.js`) into one shared
  component, always ending in the same splash/confirmation regardless of entry path. Effort M. Impact:
  medium (consistency + a warmer moment for interrupted signups specifically).
- **OPP-UX-33 ★** (fixes UX1-02 and UX1-04): give the signup wizard a resumable session — persist
  `authPhone`/`authStep` to `sessionStorage`, and write a minimal `slayhealth_user` (name: null) the
  moment OTP succeeds rather than only at the very end — so an interrupted signup resumes at the right
  step instead of silently vanishing. Effort M. Impact: high (this is the single biggest drop-off risk
  found in this workstream).
