# WS10 — Performance & Perceived Performance

**Reviewer workstream:** WS10 (IDs `UX10-NN`). Measured live against the running app
(frontend `http://localhost:3002`, backend `http://localhost:3001`) using Playwright's
own navigation timing (`performance.getEntriesByType('navigation')`, `PerformanceObserver`
for LCP/CLS/long-tasks) plus `Date.now()` wall-clock deltas around real user actions, and
direct, authenticated calls to the real backend endpoints (bypassing only the *browser*,
never the app logic) where that gave cleaner, more precise timing than driving the UI —
every number below is either a live "Observed" browser measurement (screenshot referenced
where one was captured) or a live "Observed" direct-API measurement against the same running
backend (script referenced), or, where marked, a "Code-only" bound read from source, with the
schema's Observed/Suspected/Code-only distinction kept explicit per finding rather than
blurred. Screenshots in
`backend/scratch/ux_shots/`, prefix `ux10_`. Driver scripts in `backend/scratch/ux10_*.js`.
Read-only on code throughout — no production files changed.

**Seeded couples used:** `clean` (score 88), `sti`, `severe`, `empty` (`/tmp/ux_couples.json`,
per `review/_ux_env_recipe.md`). One additional throwaway account was created for
timing tests that needed a clean, unshared quota/session: `+19990810001` (WS10's reserved
`+1999081 0XXX` range), seeded via `backend/scratch/ux10_seed_throwaway.js`, already
onboarded (name/gender/dob set) so its login round-trip lands straight on `/dashboard`
without conflating auth timing with onboarding-form timing.

**A note on environment noise:** this review ran concurrently with several other
workstream agents driving the same two shared dev processes. Mid-session both
`:3002` (frontend) and, briefly, `:3001` (backend) became intermittently unreachable
(`ECONNREFUSED`/socket resets) for stretches of several seconds at a time — `ps aux`
showed a large number of accumulated `nodemon`/`next dev`/Playwright-driver processes
left over from this and prior review passes on this machine. Where a measurement run
hit this, it was retried until a clean, uncontended sample was captured; every timing
number below is from a run that completed against a *responsive* server, not one
stalled by that contention. This is called out because it means the *floor* below is
trustworthy, but it also means a lightly-loaded solo dev box is not a realistic proxy
for how the single-process backend (see UX10-03) behaves under real concurrent load —
if anything, this session was a live demonstration of exactly that risk. Separately, `git
status` shows a broad set of backend/frontend source files under concurrent modification by
other workstreams during this same session (nodemon watches `backend/src`, so the running
process reflects whatever was on disk at each moment). Every source-line citation in this
document was verified against the on-disk file *at the time it's cited* (grep/read
immediately before writing the finding), not from memory of an earlier read, specifically to
guard against this; every timing number is from a request this reviewer issued and timestamped
directly, not inferred from logs another process could have influenced.

**Calibration note on the brief's "dead OpenRouter key":** the environment brief states
the OpenRouter key is dead (401) and asks this workstream to measure the resulting
failure/timeout state. Directly testing the live backend's chat and narrative-generation
endpoints multiple times this session, the key was **not** dead — it returned real,
on-topic, billed completions every time it was reached (see UX10-05). This is reported
plainly rather than forcing the brief's premise; the code-level failure/timeout *mechanism*
(UX10-05, UX10-06) is documented fully regardless, since it's a real, latent risk
independent of whether the key happens to be valid at any given moment.

---

## Lead summary (longest real waits first)

- **Finalizing a compatibility match is a ~50+ second single, synchronous wait** — a real,
  directly measured `POST /api/compatibility/save-match` call took **53.2 seconds**
  end-to-end (UX10-01) — and the loading screen shown for it is a **choreographed 6-step
  animation that completes itself in ~8.4 seconds** and then sits pulsing on the final step
  for the remaining ~45 seconds with no further signal, no elapsed-time indicator, and no
  expectation-setting copy for "this can take up to a minute." This is the single biggest
  perceived-performance gap found in the app.
- **PDF upload + parsing is real, synchronous, and un-timeboxed on the UI side**: measured
  1.2s–6.7s per file for genuine sample reports, with a code-verified worst case near 40
  seconds (10s local-extraction timeout + 30s OCR fallback timeout) — and the only feedback
  is a static button-label swap, no spinner, no progress, and the button isn't even disabled
  during the wait (UX10-02).
- **The single Node backend process blocks synchronously on local PDF text extraction**
  (`execFileSync`, no timeout-safe isolation) — a real architecture risk for cross-user
  stalls under concurrent load, consistent with (but not cleanly provable as the sole cause
  of) the connection instability observed this session (UX10-03, Suspected/Code-only).
- **Report tab-switching is excellent** — 60–174ms client-side route changes on both
  mobile and desktop, no network wait, no flash of loading state (UX10-04, positive).
- **Login/OTP round-trip and dashboard load are both fast and well-communicated** — real
  external WhatsApp-API latency (~2.3s) is covered by clear button-state copy; dashboard
  LCP ~1.4–1.5s (UX10-07, UX10-08, positive with minor caveats).
- **AI counselor chat has a good happy-path (typing indicator, locked input, 4–9s real
  replies) but a code-verified, un-timeboxed worst case of up to ~90 seconds** (two serial
  45s timeouts, no client-side abort, no cancel affordance) if the provider ever truly hangs
  rather than cleanly rejecting (UX10-05, UX10-06).

---

## Findings

### [P1] UX10-01 — Finalizing a match is a real ~53-second synchronous wait behind a progress animation that finishes itself in 8 seconds
- Flow / Screen: add-prospect → prospect hub → "Generate Insights" (self-serve mode) or
  "Run Compatibility Match Scan" (invite mode) → `POST /api/compatibility/save-match`
  (`backend/src/controllers/compatibility.controller.js:12-44`) →
  `reportGenerationService.compileMatchReport` →
  `narrativeService.generateNarratives()` (`backend/src/services/llm/narrative.service.js:8-151`)
  → `openRouter.extractJSON()` (`backend/src/services/llm/openrouter.service.js:5-59`, 60s
  timeout, single attempt, no fallback model). Loading UI:
  `frontend/src/components/wizard/AnalysisLoadingScreen.js`, mounted at
  `frontend/src/app/add-prospect/page.js:1391` (`isLoadingResults = isSavingProfile || isMatching`).
- Viewport: both (loading screen renders full-bleed, same component both viewports)
- Status: **Observed** — direct authenticated call to the live, running backend
  (`backend/scratch/ux10_savematch_probe.js`, real chronic/mfr/mental result shapes matching
  what the wizard itself sends), reproduced twice: **53,234ms** and a second consistent run
  in the same range (both HTTP 200, both produced a real match + real AI narrative — this is
  not a failure path, it's the *successful* case). The animation's own timing is **Code-only**
  (read directly from source, not stopwatched, since it's a fixed `setTimeout` loop).
- Evidence: `AnalysisLoadingScreen.js:8` — `STEP_INTERVAL_MS = 1400`; 6 steps
  (`DEFAULT_ANALYSIS_STEPS`, lines 10-17): "Extracting your medical parameters" →
  "Medically validating your inputs" → "Running proprietary compatibility engines" →
  "Modeling your 10-year health trajectory" → "Synthesising your personalised narrative" →
  "Formatting your report." The component's own comment (lines 19-26) is explicit about what
  this is: *"Full-bleed **dummy** multi-step progress shown while the real
  chronic/fertility/mental engines + AI narrative call are in flight. Steps auto-advance on a
  timer and **hold on the final one** until the caller unmounts this... there's no
  `done`/`onComplete` wiring."* Doing the arithmetic: 5 transitions × 1400ms = **8.4 seconds**
  to reach and freeze on step 6 ("Formatting your report," with only a small `animate-ping`
  pulse on its icon). The real backend work measured above is **53.2 seconds** — roughly
  **6.3× longer** than the choreographed sequence that is supposed to represent it. For at
  least ~45 of those seconds, the user is looking at a screen that has already told a
  complete, plausible "your report is basically done, just formatting" story, with nothing
  left to signal continued progress except one small pulsing ring — while the real work
  (three clinical engines plus a live LLM call synthesizing the whole presentation JSON into
  prose) is often still only partway through.
- The persistent reassurance line **"Please don't close this page — your report is on its
  way"** (line 107-109) is a good instinct, but it's static the entire time and never adjusts
  for how much longer that actually is.
- UX impact: trust + drop-off risk. This is exactly the two-people/high-stakes moment the
  product is built around — a couple sitting together waiting for their joint health result.
  A progress narrative that finishes talking after 8 seconds and then goes quiet for another
  45+ with no acknowledgment ("this step can take up to a minute") reads as stalled or broken,
  not as "still working as expected." A user closing the tab or navigating away mid-wait would
  abandon a match that (per the measurement above) usually *does* complete successfully —
  turning a perceived-performance problem into a real, avoidable drop-off.
- Heuristic: visibility of system status (Nielsen) — the system's stated status ("Formatting
  your report") stops being true almost immediately and nothing replaces it.
- Root cause: design/code — the loading screen's step timer is fully decoupled from the real
  request lifecycle (fire-and-forget `setTimeout` chain vs. the actual `await` chain in
  `CompatibilityContext.js` around `handleCompatibilityMatch`, lines 635-720+, which itself
  chains two parallel engine calls and then a *third*, sequential, LLM-backed `save-match`
  call after they resolve — i.e., the real critical path is `max(chronic, mfr)` *then*
  `save-match`, not a single lump sum).
- Best-fit direction: decouple truthfulness from choreography without needing real granular
  server progress: (a) stretch the step timer to a duration in the same order of magnitude as
  the real 95th-percentile wait (or drive steps from an estimated schedule that intentionally
  leaves 60-70% of the expected total time on the last 1-2 steps, so "stuck on step 6" reads
  as normal, not broken); (b) once past the choreographed window, swap the static pulse for
  copy that explicitly resets the expectation ("Almost there — final AI write-up can take up
  to a minute"); (c) cheapest fix with the highest trust payoff: add a visible elapsed-time
  or "still working…" tick (even a plain running seconds counter) so the screen visibly
  updates every second regardless of real backend progress, which is the single strongest
  known mitigation for "is this frozen?" anxiety on long waits.
- Effort: S (elapsed-time/copy fix) – M (schedule-aware step timing)
- Blast radius: `AnalysisLoadingScreen.js` (shared by both the self-serve and invite-mode
  match-run entry points), `CompatibilityContext.js` `handleCompatibilityMatch`.

### [P1] UX10-02 — PDF upload/parsing gives no spinner, no progress, and doesn't even disable the button during a multi-second (up to ~40s worst case) synchronous wait
- Flow / Screen: add-prospect → pathology (and radiology) upload step →
  `POST /api/pathology/extract` (`backend/src/controllers/pathology.controller.js:40-141`).
  Button: `frontend/src/app/add-prospect/page.js:1134-1167` (`uploadStep` builder), handler
  `handleFileUpload` (`:945-982`).
- Viewport: both
- Status: **Observed** (timings) — direct authenticated multipart upload of five real sample
  pathology PDFs from `contexts/` against the live backend
  (`backend/scratch/ux10_pdf_upload_probe.js`); **Code-only** (worst-case bound) — read from
  `backend/src/services/ocr/ocrProvider.js` and `ocrSpace.service.js`.
- Evidence — measured server-reported `processing_time_ms` (the exact figure the endpoint
  itself returns, `report_metadata.processing_time_ms`), five different real reports:
  | File | Size | Round-trip | Server processing_time_ms | Params extracted |
  |---|---|---|---|---|
  | Male_Report_08_Hypercholesterolemia.pdf | 45KB | 2571–2717ms | 2372–2503ms | 137 |
  | Female_Report_09_Syphilis.pdf | 43KB | 1395ms | 1201ms | 118 |
  | sample_report.pdf | 43KB | 1457ms | 1238ms | 118 |
  | Prathibha_V_25_Female.pdf | 2.85MB | 6972ms | 6746ms | 43 |
  | Manas_K_B_24_Male.pdf | 3.1MB | 4458–5811ms | 4262–5606ms | 43 |

  All five stayed on the fast, local PyMuPDF-extraction path (`ocrProvider.js:23-45`). None of
  these samples triggered the real OCR.space network fallback (which only fires when local
  text extraction yields under 100 characters, e.g. a genuinely scanned/image PDF —
  `ocrProvider.js:32-39`), but the code sets that path's own timeout at **30 seconds**
  (`ocrSpace.service.js:27`), stacked after the local path's own **10-second** `execFileSync`
  timeout (`ocrProvider.js:29`) — i.e. a single upload can legitimately take **up to ~40
  seconds** before the endpoint responds at all, worst case.
  Perceived-performance side, from source (`add-prospect/page.js:1143-1154`): the button's
  *only* state change while uploading is its own label, `'Upload PDF'` → `'Parsing PDF…'` →
  `'Report uploaded ✓'` — no spinner icon, no percentage, no elapsed-time text. And the
  button has **no `disabled` attribute tied to the upload state** (`:1143-1154`,
  `handleFileUpload` also doesn't guard re-entry at `:945-982`) — a user can tap "Parsing
  PDF…" again mid-upload and fire a second, fully duplicate `/api/pathology/extract` request
  for the same file.
- UX impact: comprehension/friction. Real observed waits (1.2-6.7s) are short enough that a
  static label is a minor rough edge on their own — but the code-verified worst case (~40s,
  the same order of magnitude as UX10-01) has *zero* indication of ongoing work beyond a word
  of text that hasn't visibly changed in half a minute. Combined with the missing disabled
  state, an anxious user is invited to do exactly the wrong thing (tap again).
- Heuristic: visibility of system status; error prevention (missing re-entrancy guard).
- Root cause: code — no loading affordance beyond a label swap; no `disabled` binding on the
  upload button.
- Best-fit direction: add a spinner/progress affordance to the upload button matching the one
  already used elsewhere in this same file for the invite-mode match button
  (`RefreshCw`+`animate-spin`, `add-prospect/page.js:915`, so there's already an established,
  reusable pattern) and bind `disabled={isUploading}` on both the self and prospect upload
  buttons.
- Effort: S
- Blast radius: `uploadStep` builder in `add-prospect/page.js` (both pathology and radiology
  upload instances reuse it).

### [P2 · Suspected] UX10-03 — PDF text extraction blocks the whole single-threaded backend process (no isolation, no timeout-safe execution)
- Flow / Screen: `backend/src/services/ocr/ocrProvider.js:23-45`.
- Viewport: n/a (backend architecture)
- Status: **Code-only** (mechanism) / **Suspected** (real-world cross-user impact) — the
  code fact is certain; the live-impact claim is not, and is disclosed as such.
- Evidence: `ocrProvider.process()` runs local text extraction via
  `execFileSync('python3', [scriptPath, filePath], { encoding: 'utf8', timeout: 10000 })`
  (`:29`) — Node's `execFileSync` is **synchronous and blocks the entire event loop** for
  its duration (up to 10s per call by its own timeout) on this single-process Express
  server (`server.js` — one `app.listen`, no worker pool/cluster). While it runs, the
  process cannot service *any* other request — not just the uploading user's own next
  action, but every other concurrent user's dashboard load, login, or chat message. During
  this review session, repeated polling of the unrelated `/health` endpoint showed exactly
  this signature under load — clustered runs of `ECONNREFUSED`/timeouts followed by
  recovery — but with multiple other review-agent processes also hammering the same shared
  dev server at the same time, this could not be cleanly isolated to a single upload's
  extraction window specifically (see the environment-noise note at the top of this doc), so
  it is reported as a credible, code-verified risk rather than a proven live incident.
- UX impact: reliability/performance for *every concurrent user*, not just the uploader —
  the worst possible profile for a shared architecture (one person's PDF stalls everyone).
- Heuristic: performance/scalability (not a classic Nielsen heuristic, but directly in scope
  for this workstream).
- Root cause: code — synchronous child-process call on the request-handling thread with no
  isolation (worker thread/child process pool, queue, or async spawn) between concurrent
  requests.
- Best-fit direction: move local PDF extraction off the main event loop (Node `worker_threads`,
  a small job queue, or simply `child_process.execFile` — the async variant — instead of
  `execFileSync`) so one upload's processing time never blocks unrelated requests.
- Effort: M
- Blast radius: `ocrProvider.js` only; call site (`pathology.controller.js:60`) is a single
  `await`, so an async-safe replacement is a drop-in.

### [P3 · positive] UX10-04 — Report tab-switching is fast and clean (client-side navigation)
- Flow / Screen: `/core-engine/*` sidebar (desktop) / hamburger drawer (mobile) — Chronic
  Risk / Fertility Timeline / Organ Wellness / Genetics Risk tabs,
  `frontend/src/app/core-engine/layout.js:116-119` (`handleTabClick` → `router.push`, no
  re-fetch — data already lives in `CompatibilityContext`).
- Viewport: both
- Status: **Observed** — `backend/scratch/ux10_dashboard_tabs.js`,
  `ux10_tab_chronic_clean_desktop.png`, `ux10_tab_usg_clean_desktop.png`,
  `ux10_tab_genomics_clean_desktop.png` (+ `_mobile` variants).
- Evidence: measured click-to-pathname-change times for the `clean` couple —
  desktop: Chronic Risk **108ms**, Organ Wellness **91ms**, Genetics Risk **59ms**; mobile
  (via the hamburger drawer, `core-engine/layout.js:246-274` — opened fresh each time since
  `handleTabClick` auto-closes it, `:117`): Chronic Risk **174ms**, Organ Wellness **122ms**,
  Genetics Risk **128ms**. All comfortably under any perceptible-delay threshold on both
  viewports, with no loading flash between tabs because the underlying engine results are
  already resident in context from the initial report load. This is a strong,
  worth-preserving pattern, and one of the few places in the app where mobile and desktop
  perform identically well.
- Methodology note (not a defect): the Fertility Timeline tab could not be cleanly timed for
  its *content* render on any of the three seeded couples with matches (`clean`/`sti`/`severe`)
  — clicking it (itself fast, 67ms to route) surfaces the app's real crash boundary
  ("Something went wrong! ... Don't worry, your data is safe," already logged positively for
  its copy in `review/ux_WS9_copy.md`'s "Positive notes," `core-engine/error.js:20-26`) because
  the hand-seeded `mfrResult` in `backend/scratch/ux_seed.js` uses flat keys
  (`projection_current`/`projection_optimised`) while the real MFR engine
  (`backend/src/controllers/mfr.controller.js:708-710`) — and the frontend page that reads it
  (`frontend/src/app/core-engine/mfr/page.js:38,384`) — both expect a **nested**
  `projection: { current, optimised }` shape. Per `review/_ux_env_recipe.md`'s explicit
  guidance ("if a render depends on a field the seed lacks, note it as seed-limited rather
  than filing a UX defect"), this is **not** filed as a live defect — a real, live-generated
  match (the actual code path exercised in UX10-01's direct `save-match` probe, which used
  the correct nested shape) would not hit this. It's noted here only so the tab-switch timing
  table above is understood as chronic/usg/genomics-only, and so a future pass knows *why*
  mfr couldn't be timed on the seeded fixtures.
- Effort: —
- Blast radius: —

### [P2] UX10-05 — AI counselor chat has no client-side timeout and a code-verified worst case of ~90 seconds of silence before it fails
- Flow / Screen: Report → "Consult AI Counselor" (desktop floating button,
  `core-engine/layout.js:425-432`) / mobile bottom-nav "Chat AI" FAB
  (`MobileBottomNav.js:127-134`, same `ReportChatDrawer` component and same
  `POST /api/chat/message` call either way) → `chat.controller.js:78-168` →
  `openRouter.chatCompletion()` (`backend/src/services/llm/openrouter.service.js:61-96`).
- Viewport: both (same component/API both viewports)
- Status: **Observed** (happy-path timings, measured directly against the live, running
  backend's real `/api/chat/session` + `/api/chat/message` endpoints — authenticated,
  end-to-end, real OpenRouter completions, not mocked: `backend/scratch/ux10_chat_probe.js`)
  for four different seeded/throwaway users; **Code-only** (the UI feedback mechanics — typing
  indicator, disabled input, absence of a client-side timeout or cancel control — and the
  worst-case timeout bound) — read directly from `ReportChatDrawer.js` and
  `openrouter.service.js` source. A live in-browser capture of the wait state was attempted
  (`backend/scratch/ux10_chat_browser.js`) but did not complete cleanly this session (the
  driver script's own long `waitForFunction` window kept exceeding the harness's command
  timeout under the shared-environment contention described above); the UI-feedback claims
  below are therefore Code-only, not Observed-via-screenshot, and are flagged as such.
- Evidence: four separate real, successful chat completions were measured this session (all
  HTTP 200, all real on-topic AI replies, not fallback text): **5,456ms**, **3,893ms*** (this
  one's HTTP layer was interrupted by the environment contention noted above — excluded from
  the clean sample), **4,008ms**, **9,098ms** — plus session-creation overhead of 200ms-1.8s
  on top. Per source, the wait is well-handled for these real durations: a 3-dot
  `typingIndicator` animates (`ReportChatDrawer.js:296-306`) and both the text input and send
  button are `disabled` for the duration (`:350,355`), preventing double-sends.
  What is **not** handled: `frontend/src/utils/api.js`'s `apiFetch` wrapper (`:30-48`) issues
  a plain `fetch(url, options)` with **no `AbortController`/timeout of its own** — so the
  frontend will wait exactly as long as the backend takes. On the backend,
  `openRouter.chatCompletion()` sets a **45,000ms** timeout on the first model attempt
  (`openrouter.service.js:82`), and on **any** failure (auth, network, malformed response,
  timeout — all treated identically) automatically retries the **entire request** against a
  second, hardcoded fallback model with its own independent **45,000ms** timeout (`:88-95`)
  before finally throwing. That is a code-verified **worst case of ~90 seconds** of the same 3-dot animation,
  fully locked input, no elapsed-time indicator, and no cancel button anywhere in
  `ReportChatDrawer.js`, before the user ever sees the generic
  `'Failed to send message or fetch AI reply. Please try again.'` error state.
  Separately, the quota-exhausted path (5 free messages/user, `middleware/quota.js:34-60`)
  fails **fast and clearly**: measured **182ms**, HTTP 403, a specific, honest message
  ("You have used your 5 free AI counselor messages...") — this path is fine and is called
  out as a positive contrast to the open-ended failure path above.
- On the brief's "dead key" scenario specifically: tested directly (see calibration note
  above) — a genuinely invalid/dead OpenRouter key is rejected by OpenRouter itself in
  **~466ms** (HTTP 401, confirmed via a direct call with a deliberately invalid bearer token),
  so a truly *dead* key would in practice surface an error to the user in roughly 1-2 seconds
  (two fast sequential 401s), not the 90-second bound above. The 90-second worst case is real
  and code-verified, but the failure mode it actually protects against is a **slow/hanging**
  provider connection, not an outright-invalid key — this distinction matters for prioritizing
  a fix (a client-side timeout matters most for network degradation, not credential issues).
- UX impact: for the common case, this is a well-handled multi-second wait. For the tail case
  (any provider slowdown, rate-limiting-with-delay, or network path degradation), a
  minute-and-a-half of unexplained silence with the input locked and no way to cancel is
  exactly the kind of wait a user reasonably concludes has hung the app.
- Heuristic: visibility of system status; user control & freedom (no cancel).
- Root cause: code — no client-side request timeout/AbortController in `apiFetch`; backend
  retry-with-second-model logic doubles the worst case instead of failing faster.
- Best-fit direction: add a client-side timeout (e.g. 15-20s) with a distinct "this is taking
  longer than usual" message before the hard failure, so the UI never has to sit fully silent
  for the backend's full worst case; on the backend, consider a shorter per-attempt timeout
  now that two attempts are chained serially (e.g. 20s+20s rather than 45s+45s), and add a
  cancel affordance in `ReportChatDrawer.js`.
- Effort: S–M
- Blast radius: `utils/api.js` `apiFetch` (shared by every API call in the app, so a timeout
  added there benefits every long-wait finding in this doc, not just chat) and
  `openrouter.service.js`'s `chatCompletion`.

### [P3] UX10-06 — Report/narrative generation (`extractJSON`) shares the same no-fallback-shorter-path issue as chat, at an even longer single-attempt bound
- Flow / Screen: `backend/src/services/llm/openrouter.service.js:5-59`
  (`extractJSON`, used by `narrative.service.js` inside UX10-01's `save-match` call).
- Viewport: n/a
- Status: **Code-only**.
- Evidence: `extractJSON` sets `timeout: 60000` (`:30`) and has **no** fallback-model retry
  (unlike `chatCompletion`) — so its own worst case is a single 60-second hang before
  `narrative.service.js`'s own try/catch (`:105-150`) falls back to the safe static narrative
  copy (which is itself well-designed and clearly flagged internally via
  `narrative_generation_failed: true`, not presented as if it were personalized AI output).
  This 60s bound is *part of* UX10-01's measured 53.2s real-world figure (the real call in
  that measurement completed well inside this ceiling), so it is not a second independent
  wait stacked on top of it — noted here only because it's a distinct timeout value worth
  having on record for whoever picks up UX10-01.
- UX impact: same family as UX10-01/UX10-05 — folded into UX10-01's fix recommendation rather
  than treated as a separate action item.
- Root cause: code.
- Best-fit direction: see UX10-01.
- Effort: —
- Blast radius: see UX10-01.

### [P3 · positive] UX10-07 — Login/OTP round-trip is fast, and the real external network wait is well-covered by clear button copy
- Flow / Screen: `/login` → phone entry → `POST /api/auth/request-otp` (real WhatsApp Cloud
  API call via `backend/src/services/notification/whatsapp.provider.js:22-109`, `graph.facebook.com`)
  → OTP screen → `POST /api/auth/verify` → `/dashboard`.
- Viewport: both
- Status: **Observed** — `backend/scratch/ux10_login_otp.js`, real phone→OTP round trip and
  real OTP verification (via a server-side-minted, genuinely valid OTP, not a bypass of the
  verify endpoint itself) for the WS10 throwaway account, both viewports.
  Screenshots: `ux10_login_00phone_mobile.png`, `ux10_login_01otpscreen_mobile.png`,
  `ux10_login_02dashboard_mobile.png` (+ `_desktop` variants).
- Evidence: phone submit → OTP screen: **2,284ms** (mobile) / **2,350ms** (desktop) — this
  includes a genuine, real network round trip to Meta's WhatsApp Graph API
  (`whatsapp.provider.js:75-80`, no mock in this environment), not a simulated delay. OTP
  submit → `/dashboard` rendered: **1,680ms** (mobile) / **1,603ms** (desktop). Both waits are
  covered by clear, specific button-label feedback (`frontend/src/app/login/page.js:346,423`:
  `'Send OTP Code'` → `'Sending code…'`, `'Verify & Continue'` → `'Verifying…'`), and the
  button is disabled during each (`:347,424`), preventing double-submits. This is a
  well-handled multi-second external-dependency wait and is called out as a pattern worth
  reusing (see UX10-02's recommendation, which points back at this same file's *other*
  button, `:915`, for the spinner treatment).
- Effort: —
- Blast radius: —

### [P3 · positive, with caveats] UX10-08 — Dashboard load is fast (dev-mode LCP ~1.4-1.5s)
- Flow / Screen: `/dashboard` for a couple with an existing match (`clean`).
- Viewport: both
- Status: **Observed** — `backend/scratch/ux10_dashboard_tabs.js`,
  `ux10_dashboard_clean_mobile.png`, `ux10_dashboard_clean_desktop.png`.
- Evidence: navigation timing on a warm session: TTFB ~21ms, DOMContentLoaded ~29-35ms, load
  event ~61-133ms, **LCP ~1,456ms (mobile) / ~1,532ms (desktop)**. Clicking into the report
  from the dashboard's Recent card/row to report content visible: **183ms (mobile) / 157ms
  (desktop)** — fast, since the click reuses already-fetched match data rather than
  re-querying.
- Caveat: measured against the Next.js **dev** server (`next dev`, unminified bundles, no
  production optimizations) — a production build's LCP could differ meaningfully in either
  direction (smaller/compressed bundles typically help; dev-only overhead like React
  refresh/HMR client code typically hurts dev numbers specifically) — this figure is a
  reasonable floor/shape check, not a production SLA.
- Effort: —
- Blast radius: —

### [P3 · positive, with caveats] UX10-09 — Initial (unauthenticated) landing page load is very fast
- Flow / Screen: `/` (public marketing landing).
- Viewport: both
- Status: **Observed** — `backend/scratch/ux10_landing.js`, `ux10_landing_mobile.png`,
  `ux10_landing_desktop.png`.
- Evidence: fresh browser context, no prior session. Wall-clock `page.goto` to `load`:
  **243ms (mobile) / 160ms (desktop)**. `performance` timing: TTFB 28-55ms, DOMContentLoaded
  80-124ms, load event 160-242ms, **LCP 172-184ms**, CLS **0**, ~15KB transferred, 733 DOM
  nodes.
- Caveat: this is a Next.js **dev**-server route that had already been compiled/warmed by
  the large amount of traffic this shared review session generated before this measurement
  ran — a genuinely cold first request (or a production build's actual bundle weight, which
  a marketing landing page with hero imagery/animation often carries more of than these
  bare timing numbers suggest) could look different. Reported as a floor/shape check, not a
  production guarantee.
- Effort: —
- Blast radius: —

---

## Opportunities (WS10)

- **OPP-UX-101 ★** (fixes UX10-01, and generalizes UX10-02/UX10-05): a single shared
  "long-wait" UI primitive — an elapsed-time or estimated-time-remaining readout, reusable
  across the match-generation loading screen, the pathology upload button, and the AI chat
  typing indicator — so every wait in the app that can legitimately run past ~10 seconds
  gets the same trust-preserving "still working, here's roughly how long" treatment instead
  of three independently-authored (and independently silent) waits. Effort M. Impact: high —
  this is the same underlying gap (a real wait with no ongoing, truthful status signal)
  showing up in the three most expensive operations in the app.
- **OPP-UX-102** (fixes UX10-02, UX10-05): a shared client-side request-timeout/abort
  utility added once to `apiFetch` (`frontend/src/utils/api.js`), with a distinct
  "this is taking longer than expected" UI state between "normal wait" and "hard failure" —
  benefits every long-running call in the app, not just the ones logged here. Effort S-M.
  Impact: medium-high (safety net under every other perceived-performance fix).
- **OPP-UX-103** (fixes UX10-03): move the local PDF text-extraction step off the main event
  loop (async `execFile`/worker thread/queue) so one user's upload can never stall every
  other concurrent user's requests — cheap structural fix with outsized reliability payoff
  for a single-process backend. Effort M. Impact: medium (only manifests under concurrent
  load, but severe when it does).
