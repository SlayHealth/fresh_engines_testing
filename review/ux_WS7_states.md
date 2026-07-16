# WS7 — States, Feedback & Error UX

**Reviewer workstream:** WS7 (IDs `UX7-NN`). Driven live in headless Chromium at mobile (390×844) and
desktop (1440×900) against the seeded couples `clean` / `sti` / `severe` / `partial` / `empty`, plus two
disposable throwaway accounts created for this workstream (`+19990807001` "Rahul Timing" for invite-link
states, `+19990807002` "Vikram Timing" for a live, end-to-end walkthrough of upload → match generation) —
both deleted at the end of this session. Screenshots in `backend/scratch/ux_shots/` (prefix `ux7_`, plus
shared `ux_`/`ux9_`/`uxa_` shots already on disk from earlier review passes, cited by filename where reused).
Read-only on code. Mobile is the locked reference; no mobile-vs-desktop divergence is filed here since every
state covered renders the same underlying copy/logic on both viewports — the defects are in what the app
*says*, not in per-viewport layout.

**A note on environment conditions, because it matters for two findings below:** partway through this
session the shared dev frontend (port 3002) went fully unreachable for several minutes under concurrent
review-agent load, and even before that, individual requests were intermittently failing with plain-text
502/500-style bodies from the Next.js dev proxy. That instability is **not** filed as a defect (it is
infrastructure, not product code) — but it repeatedly, "for free," exercised exactly the error paths this
workstream exists to audit, and the screenshots it produced are used as evidence below. Separately: the
brief states the OpenRouter key is currently dead; my own live chat test (below, UX7-04) got a real,
coherent, personalized reply, i.e. the key answered successfully at the time I tested it. I report that
honestly rather than forcing a failure that didn't occur — the code-level fragility around a chat failure
is still real and still verified from source, so it's written up as such (Status: Code-only), not as
something I watched happen.

**Surfaces covered:** login/OTP send + verify (`frontend/src/app/login/page.js`), invite link validate/
consent/submit (`frontend/src/app/invite/[token]/page.js`), pathology + radiology upload
(`frontend/src/app/add-prospect/page.js`, `backend/src/controllers/pathology.controller.js`,
`backend/src/routes/radiology.routes.js`), match generation (`frontend/src/contexts/
CompatibilityContext.js`, `frontend/src/components/wizard/AnalysisLoadingScreen.js`), the compiled report's
per-domain "pending" state (`frontend/src/app/core-engine/story/page.js`), the AI chat drawer
(`frontend/src/components/ReportChatDrawer.js`, `backend/src/controllers/chat.controller.js`,
`backend/src/services/llm/openrouter.service.js`), and the dashboard (`frontend/src/app/dashboard/page.js`,
`MobileHomeView.js`).

---

## Lead summary (most important first)

- **A whole class of errors renders as a raw JavaScript parse exception on-screen** (UX7-01): "Unexpected
  token 'I', "Internal S"... is not valid JSON" shown to a user on the invite-link screen; the identical
  bug class hit the login OTP screen with a rate-limit response. This is not one bug in one place — it's
  the same missing guard (`res.json()` called without checking the response is actually JSON) repeated
  across at least 4 call sites.
- **Uploading your own lab report can fail, and when it does, the real reason is always thrown away**
  (UX7-02): both a genuine transient 500 and a genuine oversized-file 500 land on the identical hardcoded
  string "Pathology extraction failed" — even though the backend sent back a specific, useful message both
  times ("Internal Server Error" / "File too large").
- **The match-generation wait genuinely takes ~20–26 seconds, but the "progress" animation is a fixed
  8-second timer that then freezes** (UX7-03): measured live, the six-step checklist finishes and sits
  static on "Formatting your report" for 12+ additional seconds with zero further motion before the real
  work completes.
- **The AI chat's "Retry" button doesn't retry anything** (UX7-04): it just reloads chat history, which —
  since the failed reply was never saved — looks identical to the screen the user was already looking at.
  Worse, the message quota (5 free chats) is decremented *before* the AI call runs, so a failure this
  silent still costs the user one of their five.
- **A prospect's "Details Submitted!" success screen is erased by a reload** (UX7-05): refreshing at any
  point after consenting — mid-form, after rejecting, or after full submission — drops the person back on
  the Accept/Reject Consent screen with no visible trace their sensitive health data was already received.
- Positives worth keeping: the wrong-OTP ladder (attempts remaining, explicit lock duration, live resend
  countdown) is clear and honest; the questionnaire wizard's live "~N sec left" countdown is a genuinely
  good pattern that the rest of the app's waits should borrow; client-side wrong-file-type rejection is
  instant and copy-clear.

---

### [P1] UX7-01 — Non-JSON error responses crash to a raw JavaScript parse error shown to the user
- Flow / Screen: Login → phone-number step under a tripped rate limit; Invite link → `/invite/:token`
  validation under a transient proxy hiccup. `frontend/src/app/login/page.js:196,221`;
  `frontend/src/app/invite/[token]/page.js:88-90`.
- Viewport: both (root cause is server-response shape, not layout)
- Status: Observed — `uxa_login_ratelimit_mobile.png` (rate-limit case, plain-text 429 body);
  `ux7_invite_expired_desktop.png` (proxy-hiccup case, plain-text 500 body). Reproduced live twice more this
  session on `/api/invite/validate/...` and `/api/pathology/mock-extract` (see UX7-02) with the identical
  `"Unexpected token 'I', "Internal S"... is not valid JSON"` text, confirming this is a repeatable class,
  not a one-off.
- Evidence: on the login screen, tripping the global 60-req/min IP rate limiter shows the raw string
  `Unexpected token 'T', "Too many r"... is not valid JSON` inside the normal red error banner where "Enter
  a valid phone number" or similar would normally appear. On the invite screen under a proxy hiccup, the
  "Invalid Link" card's reason line reads `Unexpected token 'I', "Internal S"... is not valid JSON` instead
  of a sentence. Root cause confirmed end-to-end: `backend/src/server.js:55-64`'s global `express-rate-limit`
  middleware is configured with a plain string `message`, which the library sends via `res.send(message)` —
  `Content-Type: text/html`, not JSON. Separately, when the Next.js dev proxy itself fails to reach the
  backend, it serves its own plain "Internal Server Error" page. In both cases the frontend does
  `const data = await res.json(); throw new Error(data.error || ...)` with no guard — `login/page.js:196`
  (send OTP), `login/page.js:221` (resend), `invite/[token]/page.js:89` (validate token),
  `invite/[token]/page.js:237` (submit) — and the resulting `SyntaxError`'s own message (`"Unexpected
  token..."`) is what ends up rendered to the user.
- UX impact: trust — in a health-data product, a user's very first or most stressful moments (signing in,
  opening a partner's invite) can show what unmistakably reads as an internal software crash. It also
  actively teaches nothing: it doesn't say "try again," "wait a minute," or "contact support."
  comprehension: a rate limit and a proxy outage are both real, everyday conditions, not edge cases.
- Heuristic: help users recognize/diagnose/recover from errors (Nielsen); error messages should be
  expressed in plain language (never a stack/parse artifact).
- Root cause: code — every one of these 4 call sites calls `.json()` on a response without first checking
  `response.ok` and/or `Content-Type`. Notably, the codebase already has the fix for this pattern
  elsewhere: `frontend/src/contexts/CompatibilityContext.js:534-536`'s `responseJson()` helper
  (`try { return await res.json(); } catch (e) { return {}; }`) guards exactly this failure mode for the
  chronic/mfr match calls — it's just not used by the other ~4+ sites that parse JSON directly.
- Best-fit direction: promote `responseJson()` (or an equivalent that also checks `Content-Type` before
  parsing) into the shared `apiFetch` wrapper itself (`frontend/src/utils/api.js`) so every caller gets a
  safe parse automatically, paired with one generic "Something went wrong on our end — please try again in
  a moment" fallback string instead of a raw exception message. Separately, give the global rate limiter a
  JSON `message` object so at least that one source stops emitting HTML/plain text in the first place
  (`server.js:55-64`).
- Effort: S (shared helper + 4-6 call-site swaps) for the frontend guard; S for the rate-limiter message.
- Blast radius: `apiFetch`/`api.js` is imported everywhere, so fixing it there fixes every current and
  future call site at once — the single highest-leverage change in this workstream.

### [P1] UX7-02 — Upload failures always show a generic hardcoded string, discarding the backend's real (and correct) reason
- Flow / Screen: Add Prospect → Pathology Reports upload step. `frontend/src/app/add-prospect/page.js:
  402-404` (radiology), `:967-969` (pathology).
- Viewport: both
- Status: Observed — `ux7_self_pathology_retry_end.png` (live 500 under environment instability) and
  `ux7_upload_oversized_mobile.png` (live 500 from a genuinely oversized file, reproduced deliberately —
  see below). Also reproduced on the "Use a mock report instead" path
  (`ux7_self_pathology_mock_done.png` shows the same raw-JSON-crash variant of this failure, UX7-01).
- Evidence: I built a 26 MB PDF (over the backend's 25 MB cap) and uploaded it through the real UI. The
  browser spent **~20.7 seconds** transmitting the entire file over the network before the server rejected
  it — there is no client-side size check anywhere (confirmed by code search: no `file.size` / `MB` /
  `maxSize` reference exists in any upload handler) — only a client-side *type* check
  (`file.type !== 'application/pdf'`). The backend correctly identified the problem and returned a
  perfectly good, specific message: `{"success":false,"error":"File too large", ...}` (confirmed via direct
  API call, `curl` against `/api/pathology/extract`). None of that reaches the user: `add-prospect/page.js`'s
  `handleFileUpload`/`handleRadiologyUpload` do `if (!response.ok) { throw new Error('Pathology extraction
  failed'); }` — a fixed string, never reading `data.error` — so the screen shows only "Pathology extraction
  failed" no matter whether the real cause was a bad file, a 26 MB file, or (as happened live twice this
  session) a transient server/proxy failure with nothing wrong with the file at all.
- UX impact: friction + comprehension — after ~20 seconds of upload (a meaningful wait on mobile data,
  worse on a real lab-report-sized scan), the user learns nothing about what to do differently. "File too
  large" would have told them immediately to compress or split the PDF; instead they're left guessing
  whether their PDF is corrupt, unsupported, or whether the whole feature is broken. The oversized-file case
  is additionally mis-classified server-side as an HTTP 500 (server fault) rather than 4xx (client/input
  fault, e.g. 413) — a secondary, lower-priority correctness point worth fixing alongside the message itself.
- Heuristic: error messages should precisely indicate the problem and suggest a solution (Nielsen); match
  between system and real world.
- Root cause: code — two sibling issues compound: (1) no client-side file-size guard before the network
  round trip, and (2) the failure handler discards `data.error` in favor of a fixed string, at both the
  pathology and radiology call sites in `add-prospect/page.js` (contrast `frontend/src/app/chronic/page.js:
  291` and `frontend/src/app/mfr/page.js:299`'s pathology upload paths, which *do* read and surface
  `errorData.error` — the correct pattern already exists elsewhere in the codebase, again just not reused
  here).
- Best-fit direction: add a client-side size check (reject files over 25 MB before ever hitting the
  network, with an immediate, specific message: "This file is over 25 MB — try compressing it or exporting
  a smaller PDF"); and surface `data.error` from the response in the two `add-prospect/page.js` handlers,
  the same way `chronic/page.js`/`mfr/page.js` already do. Change the multer size-limit response to 413.
- Effort: S
- Blast radius: `add-prospect/page.js`'s 2 upload handlers; shared with UX7-01's `apiFetch` fix for the
  non-size-related failure cases.

### [P1] UX7-03 — Match-generation loading screen is a fixed decorative timer, not real progress, and the real wait is long
- Flow / Screen: Add Prospect (prospect hub) → "Generate Insights" → `AnalysisLoadingScreen`.
  `frontend/src/components/wizard/AnalysisLoadingScreen.js`; triggered from
  `frontend/src/app/add-prospect/page.js:1028-1076` (`handleMatch`) and
  `frontend/src/contexts/CompatibilityContext.js:539-...` (`handleCompatibilityMatch`).
- Viewport: both (`isLoadingResults` full-screen takeover behaves identically; verified on mobile)
- Status: Observed — live, end-to-end timed run (`ux7_matchgen_t500ms.png` through `ux7_matchgen_final.png`,
  screenshots at t=0.5/1.5/3/5/8/11/15/20s plus the final landed report). Real elapsed time from clicking
  "Generate Insights" to arriving at `/core-engine/story` was **between 20 and 26 seconds** (the poll
  resolved at the 26s checkpoint; the prior checkpoint at 20s was still mid-wait).
- Evidence: `AnalysisLoadingScreen.js:8` hardcodes `STEP_INTERVAL_MS = 1400` across 6 steps — the checklist
  reaches its final item ("Formatting your report") after `(6-1) × 1400ms = 7000ms`, i.e. **7 seconds**,
  entirely on a `setTimeout` chain with no relationship to the real network calls (`Promise.all` of
  `/api/chronic/analyze` + `/api/mfr/analyze`, then `/api/compatibility/save-match`, optionally
  `/api/mental/analyze`, then a route change). The screenshots at t=8s, t=11s, t=15s, and t=20s are
  **byte-identical** (confirmed by file size) — the UI is frozen on the same "5 done, 1 in-progress-looking"
  state for at least 12 straight seconds while the real work continues in the background, completing
  sometime in the following ~6 seconds. There is no elapsed-time counter, no "still working" pulse beyond
  the initial ring animation, and no signal distinguishing "3 more seconds" from "15 more seconds" — the
  screen the user sees at second 8 is pixel-identical to the screen at second 20.
- UX impact: this is very likely the single longest uninterruptible wait in the product (the task brief's
  own suspicion, confirmed) — for roughly 60-70% of the total wait, the UI is lying by omission: it looks
  finished-ish ("Formatting your report" implies "almost done") while genuinely unrelated backend work
  (2 parallel clinical-engine calls + a save + an AI narrative pass, the last of which is exactly the code
  path affected by the dead OpenRouter key per the brief) is still running. A user watching a static screen
  for 12+ seconds after every visible step went green has no way to know whether to keep waiting or that
  something's actually stuck.
- Heuristic: visibility of system status (Nielsen) — arguably the canonical violation of this heuristic:
  progress indicators must reflect real state, not a guessed animation.
- Root cause: design/code — a fixed timer was used in place of streaming real progress. Notably, the
  product already has the infrastructure to do this honestly: `backend/src/controllers/invite.controller.js`
  runs a Server-Sent-Events channel (`streamInviteStatus`/`broadcastInviteUpdate`) for the *invite* flow's
  background processing — the same pattern (or simpler, a poll of a status field) could drive this screen's
  steps for the *self* match-generation flow instead of a blind timer. Separately, the questionnaire wizard
  a few screens earlier already solves "how long will this take" honestly and well:
  `frontend/src/utils/estimateTime.js`'s `estimateTimeLeft()` gives a live, shrinking "~N sec left" based on
  the actual remaining steps — this screen has no equivalent.
- Best-fit direction: either (a) tie each checklist step to a real completion signal (resolve of each
  await in the Promise chain) so the UI never shows "done" before the real call returns, and add a
  live-elapsed or "still working, this can take up to ~25s" caption once the timer runs past the point where
  steps would normally have finished, or (b) at minimum stop pretending: once the fixed animation reaches
  its last step, replace the frozen state with a genuine indeterminate spinner + a time-based reassurance
  ("hang tight, almost there") rather than a static checklist that implies near-completion for 10+ seconds.
- Effort: M
- Blast radius: `AnalysisLoadingScreen.js` (shared by any other loading call site that imports it — grep
  before changing); `handleMatch`/`handleCompatibilityMatch` in the two files above.

### [P1] UX7-04 — Chat AI's "Retry" button doesn't retry, and a failed reply still burns the free quota
- Flow / Screen: Report → "Consult AI Counselor" / bottom-nav "Chat AI" →
  `frontend/src/components/ReportChatDrawer.js`; backend `backend/src/controllers/chat.controller.js`,
  `backend/src/services/llm/openrouter.service.js`, `backend/src/middleware/quota.js`.
- Viewport: both (drawer behavior identical; verified on mobile)
- Status: **Code-only** for the failure path itself (see the environment note at the top of this doc — my
  live send this session got a real, successful, well-personalized reply, so I did not witness a live
  failure to screenshot). Status: **Observed** for the quota mechanics and the successful-reply baseline —
  `ux7_chat_initial_mobile.png` (greeting), `ux7_chat_sending_mobile.png` (typing-dots while in flight),
  `ux7_chat_result_mobile.png` (reply landed, referencing the user's real waist/lifestyle/risk data) —
  "Counselor chat" quota visibly dropped from 5/5 to 4/5 after this one exchange
  (`ux7_story_full_desktop.png`).
- Evidence (code): `ReportChatDrawer.js:196-231`'s `handleSend` appends the user's message to local state
  immediately (line 206), then on any failure sets a fixed string
  `'Failed to send message or fetch AI reply. Please try again.'` (line 227) and renders a **"Retry"**
  button (line 313-319) whose `onClick` is `() => activeSessionId ? fetchChatHistory(activeSessionId) :
  initializeSession()` — i.e. it re-fetches the *stored* conversation history, not a resend of the failed
  message. Server-side, `chat.controller.js`'s `sendChatMessage` saves the user's message to the database
  *before* calling the LLM (so it's already in history) but never saves an assistant reply if the LLM call
  throws — so "Retry" reloads a conversation that looks exactly like it did the moment before, with no new
  information and no actual retry of the failed generation. Separately, `backend/src/routes/chat.routes.js:
  14` runs `checkChatQuota` *before* `sendChatMessage`, and `middleware/quota.js:57` increments
  `chats_used` unconditionally as soon as the request is under quota — before the OpenRouter call is even
  attempted. A chat request that fails for any reason (dead key, timeout, rate limit) still permanently
  costs one of the account's 5 free messages.
- UX impact: trust + fairness — a button labeled "Retry" that silently does nothing observable is worse
  than no retry button (it invites another click, another wait, another nothing). Combined with the quota
  debit, a user could lose most or all of their 5 free counselor chats to failures that returned them zero
  value, with the one visible recovery affordance never actually helping.
- Heuristic: user control & recovery from errors (Nielsen) — an action must do what its label promises.
- Root cause: code — `Retry`'s handler wires to the wrong function (history refetch instead of resend);
  quota debit happens in middleware ahead of the operation it's metering, with no compensating refund on
  failure.
- Best-fit direction: point "Retry" at re-invoking `handleSend(lastFailedMessageText)` so it actually
  re-attempts the same message; move the quota increment to *after* a confirmed successful reply (or add a
  refund path on any 4xx/5xx from the LLM call) so a failed exchange never debits the user's quota.
- Effort: S (retry wiring) + S (quota-timing fix, touches `quota.js` + `chat.controller.js`)
- Blast radius: `ReportChatDrawer.js` (single shared component for every chat entry point);
  `quota.js`'s `checkChatQuota` (shared by whichever routes use it — verify no other route depends on the
  current pre-debit ordering before moving it).

### [P1] UX7-05 — Invite success/consent state is wiped by a reload, regressing the prospect back to square one
- Flow / Screen: `/invite/:token` — consent screen, questionnaire, and the "Details Submitted!" success
  screen. `frontend/src/app/invite/[token]/page.js:84-108` (token validation/consent-state restore),
  `:277-297` (success screen).
- Viewport: mobile (existing evidence; logic is viewport-independent)
- Status: Observed — three separate existing screenshots each catch this at a different point:
  `ux8_reload_after_submit_shows_consent_again_mobile.png` (reload right after a successful "Details
  Submitted!"), `ux8_reload_after_submit_prematch_mobile.png`, and
  `ux8_post_submit_reject_screen_mobile.png` — all three land back on the full Accept/Reject Consent screen.
- Evidence: the success screen (`page.js:277-297`) tells the prospect, in terms clearly meant to be taken
  literally, **"You can close this tab now."** — but `submitSuccess` is plain component state, never
  restored from the server. If the prospect reloads instead of closing the tab (an entirely predictable
  thing to do — checking whether it "really worked," an accidental refresh, a browser back/forward), the
  page re-runs `validateToken` (`page.js:84-108`), which only recognizes `invite.status ===
  'consent_accepted'` or `'consent_rejected'` to skip re-showing the consent gate (`:94-99`). By the time
  the questionnaire has been submitted, the invite's real status has moved on to
  `'questionnaire_submitted'` (or later `'completed'` once the match runs) — neither of which matches
  either check — so `consentDecided` stays `false` and the **entire Consent & Data Handling Disclosure
  screen renders again from scratch**, with an "Accept Consent" / "Reject Consent" choice, as if nothing
  had ever happened.
- UX impact: trust, badly — this is a one-time, explicitly-worded, IP/timestamp-logged consent action
  about sharing personal health data, and the one moment meant to reassure the person that their data was
  received ("Details Submitted!... your reports have been successfully submitted") can vanish completely on
  a reload with zero remaining evidence on-screen that anything was ever sent. A person who reloads to
  double-check would reasonably conclude their submission failed and may re-enter data, or re-decide
  consent, against a system that already recorded their original decision and submission.
- Heuristic: visibility of system status; user control & freedom (a destructive-feeling state loss from an
  ordinary, expected action); consistency (the success screen's own instruction — "you can close this tab" —
  implicitly promises the alternative, staying/reloading, is safe, and it isn't).
- Root cause: code/IA — the reload gate checks only two of the invite's several post-consent statuses,
  and the client-only `submitSuccess` flag is never reconciled with the real, richer server-side state
  (`sent` → `opened` → `consent_accepted`/`rejected` → `questionnaire_submitted` → `completed`/`failed`) that
  the backend already tracks and broadcasts via SSE.
- Best-fit direction: on load, branch on the full status enum, not just the two consent sub-states — if
  status is `questionnaire_submitted` or `completed`, show the success screen (or a "you're all set,
  already submitted" variant) directly instead of falling through to consent; if `consent_rejected`, show a
  "you already declined" screen rather than consent again.
- Effort: S–M (the enum is already modeled server-side; this is additional client-side branching, not new
  backend work)
- Blast radius: `invite/[token]/page.js`'s validation branch only — self-contained to this one page.
  Likely relevant to WS8 (trust/consent) from the consent-durability angle as well as here from the
  states/feedback angle — cross-reference if WS8 also logs this.

### [P2] UX7-06 — Dashboard gives zero signal that an invite is pending; identical to a brand-new account
- Flow / Screen: Dashboard home, `partial` (invited, awaiting partner) account.
  `frontend/src/app/dashboard/MobileHomeView.js:133-141` (mobile "Recent" card),
  `frontend/src/app/dashboard/page.js` (desktop "Recent Activity" card, same fallback copy).
- Viewport: both
- Status: Observed — `ux7_dash_partial_mobile.png` / `ux7_dash_partial_desktop.png` vs.
  `ux7_dash_empty_mobile.png` / `ux7_dash_empty_desktop.png`: the "Recent"/"Recent Activity" block renders
  **byte-identical copy** — "No compatibility checks yet — Start your first check" — for both accounts,
  even though `partial` has a real, live, in-flight invite (status timeline: Link Generated → Opened →
  Consent Decision → Filling Form → Form Submitted) that the app tracks in detail.
- Evidence: that timeline *does* exist and is well-built — but it only surfaces if the account holder
  clicks "Start a compatibility check" again (which re-enters `/add-prospect` and, because an active invite
  is detected, shows an "Invite Status" screen instead of a fresh flow) — a strange place to have to look
  for the status of an invite you already sent. On mobile there is a secondary signal: `NotificationBell`
  (`components/NotificationBell.js`) shows a small red dot when unread invite events exist — but
  `NotificationBell` is **only ever imported in `MobileHomeView.js`**; the desktop dashboard
  (`app/dashboard/page.js`) never renders it. A `partial` user on desktop therefore has no indication
  anywhere on their main dashboard that anything is happening with the prospect they invited.
- UX impact: comprehension + trust — after sending an invite, the natural next visit is the dashboard; both
  viewports currently answer "did my invite go anywhere?" with the same message shown to someone who's
  never started at all, and desktop has no fallback signal even by clicking the bell (there is no bell).
- Heuristic: visibility of system status; consistency (mobile has a partial signal, desktop has none — a
  reconcile-to-mobile case, since mobile's bell is the closer-to-correct behavior, just not surfaced boldly
  enough even there).
- Root cause: IA — the "Recent" card is keyed only off `matchesList` (completed matches), never off active
  invites; the one place that does check invites (`NotificationBell`) isn't rendered on desktop at all.
- Best-fit direction: when an account has an active invite and no completed match, replace the generic
  "No compatibility checks yet" card with the real status ("Invite sent to {name} — waiting for them to
  fill in their details" / "{name} opened your invite" / etc., reusing the copy already written in
  `NotificationBell.js`'s `STATUS_TEXT`), on both viewports; add `NotificationBell` (or an equivalent) to
  the desktop dashboard header so desktop parity holds generally, not just for this one card.
- Effort: M
- Blast radius: `MobileHomeView.js` + `dashboard/page.js`'s Recent card; desktop header layout for the bell.

### [P2] UX7-07 — Invalid-link remediation copy is identical for every cause, including one where it's wrong
- Flow / Screen: `/invite/:token` — expired / revoked / already-submitted link.
  `frontend/src/app/invite/[token]/page.js:258-274`.
- Viewport: mobile (existing + this-session evidence; logic viewport-independent)
- Status: Observed — `ux7_invite_expired_mobile.png` ("Invitation has expired"),
  `ux7_invite_used_mobile.png` ("Invitation has already been submitted") — both under the same "Invalid
  Link" heading with the identical static footer line.
- Evidence: regardless of which of `validateToken`'s four rejection branches fired (expired, revoked,
  already-completed, not-found — `backend/src/controllers/invite.controller.js:218-236`), the frontend
  renders one hardcoded sentence underneath the specific reason: **"Please ask your partner to send a new
  invitation link."** (`page.js:269-271`). That's correct advice for expired/revoked/not-found — but for
  "already been submitted," nothing is actually wrong: the prospect's data was already received. Asking
  them to get a brand-new link implies they need to redo something, which isn't true and could prompt a
  confused re-submission request to their partner for no reason.
- UX impact: comprehension — the one-size-fits-all remediation line is actionable for 3 of 4 causes and
  actively misleading for the 4th.
- Heuristic: error messages should be precise and match the actual situation.
- Root cause: copy/code — the footer sentence is static markup, not derived from `validationError`'s cause.
- Best-fit direction: branch the footer copy by cause — for "already submitted," something like "Your
  details were already received — reach out to {inviterName} if you think this is a mistake," reusing the
  status value already available from the failed `validateToken` call before the generic error message
  replaced it (or have the backend return a `code` alongside `error` so the client can branch cleanly).
- Effort: S
- Blast radius: `invite/[token]/page.js`'s validation-error render only.

### [P2] UX7-08 — Accepting consent gives no confirmation feedback of its own
- Flow / Screen: `/invite/:token` consent screen → "Accept Consent".
  `frontend/src/app/invite/[token]/page.js:165-183` (`handleConsent`).
- Viewport: mobile (verified live this session)
- Status: Observed — driver script this session: clicking "Accept Consent" transitions directly and
  silently into "Premarital Onboarding Questionnaire · 1/33" with no toast, banner, or intermediate
  acknowledgment of any kind.
- Evidence: `handleConsent` (`:165-183`) does show a brief "Recording…" label on the button itself while
  the POST is in flight, but on success it only flips `consentDecided`/`consentAccepted` — no
  `toast.success(...)` or equivalent — so the very next paint is the first questionnaire question. The only
  error path is a toast ("Error recording consent. Please try again."); the success path is silent.
- UX impact: comprehension — for a one-time, explicitly-worded, logged (IP/timestamp) consent decision in a
  health-data context, there's no moment that says "got it, your choice is recorded" before moving on. Most
  users won't consciously miss this, but it's a mismatch with how deliberately the consent copy above it is
  written ("you can withdraw your consent at any time before clicking Submit Form") — the weight of the
  copy isn't matched by any weight in the confirmation.
- Heuristic: visibility of system status (asymmetric: failure gets a toast, success gets none).
- Root cause: code — a `toast.success(...)` call was simply never added to the success branch.
- Best-fit direction: a brief `toast.success('Consent recorded.')` (or similar) before the questionnaire
  appears — cheap, consistent with the error branch already having a toast, and closes the confirmation gap.
- Effort: S
- Blast radius: `invite/[token]/page.js`'s `handleConsent` only.

### [P2] UX7-09 — Identical "pending domain" copy hides that the three pending domains have three different fixes
- Flow / Screen: Report → Health Story tab → "Your Path Forward" card, `pendingDomains` footer.
  `frontend/src/app/core-engine/story/page.js:680-689` (list construction), `:1125-1131` (render).
- Viewport: mobile (existing evidence, `clean` and `severe` couples; logic/copy identical on desktop)
- Status: Observed — `ux9_story_clean_mobile.png` shows **"• Once your radiology results are in, we'll add
  that chapter." / "• Once your genetics results are in, we'll add that chapter."**;
  `ux9_story_severe_mobile.png` shows **"• Once your mental wellness results are in, we'll add that
  chapter." / "• Once your radiology results are in, we'll add that chapter."** for a different couple.
- Evidence: every pending domain gets the exact same templated line (`page.js:1128`:
  `` `• Once your {domain} results are in, we'll add that chapter.` ``) — but the three domains that can
  produce this line have three completely different paths to actually resolving:
  1. **mental wellness** — free, in-app, ~21 quick questions away; genuinely "pending" in the ordinary sense.
  2. **radiology** — gated behind a ₹999 one-time paid unlock (`add-prospect/page.js`'s "Radiology Reports…
     ₹999 one-time unlock") *and* an upload; without paying, this line is permanently true.
  3. **genetics** — resolves opportunistically only if the uploaded pathology PDF happens to include a
     haemoglobin electrophoresis / HbA2 test (confirmed by comparing the two couples: `severe`'s pathology
     data includes `hb_electrophoresis` values and its "genetics" thread shows **Resolved**, not pending,
     while `clean`'s pathology has no such values and it shows pending) — there is no upload step, nav item,
     or copy anywhere that tells a user this is what unlocks it.
  The user reading any of these three lines has no way to tell which kind of "pending" they're looking at —
  something to just go finish, something that costs money, or something they have no visible lever for at
  all.
- UX impact: comprehension + trust — a passive, uniform sentence sitting right next to an active
  "Download PDF Report" button reads as informative but isn't actionable for 2 of the 3 real cases; a user
  who wants their "genetics chapter" to appear has no way to learn that a specific lab test, not a specific
  in-app action, is what would do it.
- Heuristic: match between system and real world (the copy implies "in progress," but for radiology/genetics
  nothing is actually in progress); help users recognize a concrete next action.
- Root cause: copy/code — one shared template string applied to domains resolved through structurally
  different mechanisms, with no domain-specific CTA.
- Best-fit direction: branch the footer line by domain: mental → link straight to the mental questionnaire
  ("Finish your 21 quick questions →"); radiology → link to the ₹999 unlock ("Unlock Radiology Reports →");
  genetics → be honest that this depends on which lab tests were included in the uploaded pathology report,
  rather than implying it's simply "in progress."
- Effort: S–M
- Blast radius: `story/page.js`'s pending-domains render only.

### [P2] UX7-10 — "Contact Support" on the dashboard is a dead button
- Flow / Screen: Desktop dashboard → "Need Help?" card. `frontend/src/app/dashboard/page.js:383-385`.
- Viewport: desktop
- Status: Observed — `ux_dash_clean_desktop_full.png` shows the button rendered normally (dark card,
  "Contact Support" label, hover-ready styling) alongside "Our medical team is here to assist you..." copy;
  code confirms no `onClick` handler exists.
- Evidence: `<button className="bg-white/10 hover:bg-white/20 ...">Contact Support</button>` — no click
  handler, no `href`, nothing. This is the same class of issue as the already-logged report-sidebar
  "Support" button (WS2-02, `layout.js:186-189,255-258`) but a **separate instance on a separate surface**
  (the main dashboard, reachable by every user, not only inside an active report).
- UX impact: friction + trust — a support affordance that visibly invites a click and does nothing is worse
  than not offering one, particularly framed as "our medical team is here to assist you" right above it.
- Heuristic: help & documentation; error prevention (dead controls).
- Root cause: code — missing handler, same pattern as WS2-02.
- Best-fit direction: same remediation as WS2-02 — wire to a real channel (the profile page's existing
  "WhatsApp Messages (Admin)" surface, or a mailto/contact route) — and do it once, reused by both this
  button and the two WS2-02 instances, rather than three independent fixes.
- Effort: S
- Blast radius: `dashboard/page.js`'s Need Help card; shared fix opportunity with WS2-02's `layout.js`
  instances.

### [P3] UX7-11 — Report-narrative fallback is honest in the report UI, but silently indistinguishable in the exported PDF
- Flow / Screen: Report tabs (live) vs. downloaded PDF report.
  `backend/src/services/compatibility/aiPresentation.service.js:293-335` (live-report fallback);
  `backend/src/services/llm/narrative.service.js:81-150` (PDF-narrative fallback), consumed by
  `backend/src/services/pdfReport2.service.js:457`.
- Viewport: n/a (backend/content)
- Status: Code-only (not independently re-verified live this session; based on code reading + the prior
  research pass's citations, consistent with everything else observed about this app's LLM-fallback
  behavior).
- Evidence: when the structured-insight LLM call fails, `aiPresentation.service.js` returns a clearly
  distinct, honestly-labeled fallback (`status: 'gray'`, headline "Summary unavailable," body text "We
  couldn't generate a written summary for this section — see your actual lab values below") — this **is**
  visibly different from a real result in the live report (e.g. the genomics "Not fully assessed" label).
  That's a good pattern. But the separate fallback used for the PDF export's narrative sections
  (`narrative.service.js:81-150`) sets a flag, `narrative_generation_failed: true` (lines 142, 149) — and
  that flag is never read anywhere in `pdfReport2.service.js` or the frontend. The PDF's fallback copy
  ("Your personalized summary is being finalized — see the detailed panels below") is soft enough to read
  as normal filler text, with no visible marker distinguishing it from genuine AI-written narrative.
- UX impact: trust — a downloaded PDF is the artifact most likely to be kept, shared with a partner's
  family, or referenced later; if its "personalized" narrative sections were actually boilerplate fallback
  text with no disclosure, that's a quiet trust gap the code already has the information to close and
  doesn't.
- Heuristic: visibility of system status; honesty about AI-generated vs. templated content.
- Root cause: code — a correctly-computed flag (`narrative_generation_failed`) is discarded rather than
  read.
- Best-fit direction: thread `narrative_generation_failed` through to the PDF renderer and either show a
  small "standard summary" footnote on affected sections, or reuse the live-report's honest
  "gray/unavailable" treatment in the PDF too, so the two fallback paths are consistent with each other.
- Effort: S
- Blast radius: `narrative.service.js` output shape + `pdfReport2.service.js`'s consumption of it.

---

## Positive findings (things already working well)

### [Positive] UX7-P1 — The wrong-OTP ladder is clear, honest, and well-paced
- Evidence: `uxa_login_otp_wrong1_mobile.png` ("Incorrect OTP. 4 attempts remaining."),
  `uxa_login_otp_locked_mobile.png` ("Too many invalid attempts. Your number has been locked for 15
  minutes."), plus a live resend countdown ("Resend available in 59s"). Each state tells the user exactly
  what happened, how many chances remain, and how long a lockout lasts — no ambiguity, no generic "error
  occurred." This is the bar the rest of the app's error copy should be held to.

### [Positive] UX7-P2 — The questionnaire wizard's live "time left" estimate is a strong, reusable pattern
- Evidence: `frontend/src/utils/estimateTime.js` — a real, shrinking "~N sec/min left" computed from the
  actual remaining steps' typical answer time, framed as a concrete countdown rather than an abstract
  percentage. This is precisely the honesty UX7-03's fixed timer lacks, and it already exists in the same
  codebase — extending it (or an equivalent real-progress signal) to the upload/match-generation waits is
  the most direct fix for UX7-03.

### [Positive] UX7-P3 — Client-side wrong-file-type rejection is instant and clearly worded
- Evidence: `ux7_upload_wrongtype_mobile.png` — selecting a non-PDF file surfaces "Please upload a valid
  pathology report (PDF)." immediately, with no network round trip. Good, fast, specific feedback — the
  contrast with the oversized-file case (UX7-02), which *does* round-trip and *doesn't* explain itself, is
  informative: the team clearly knows how to do this well when they check for it client-side.

---

## Opportunities (WS7)

- **OPP-UX-71 ★** (fixes UX7-01, materially reduces UX7-02/04's failure-message quality): move the
  already-written-once `responseJson()` safe-parse pattern (`CompatibilityContext.js:534-536`) into the
  shared `apiFetch` wrapper (`utils/api.js`) so no caller can ever again render a raw `SyntaxError` to a
  user; pair with one shared "Something went wrong — please try again" fallback component. Effort S.
  Impact: high — this is a single change that inoculates every current and future fetch call in the app.
- **OPP-UX-72 ★** (fixes UX7-03): extend the honest, already-built "~N sec left" countdown pattern from the
  questionnaire (`estimateTime.js`) to the two long waits that currently fake it — PDF upload/parsing and
  match generation — ideally by tying visible steps to real promise resolution rather than a timer, using
  the SSE pattern already built for invite-status broadcasting as a model. Effort M. Impact: high (this is
  explicitly the longest wait in the app).
- **OPP-UX-73** (fixes UX7-06): give the dashboard's "Recent" card and the desktop header the same
  invite-awareness the mobile `NotificationBell` already has, so "I sent an invite, what's happening with
  it?" is answerable from the main dashboard on both viewports, not buried behind "start a new check" or a
  mobile-only bell. Effort M. Impact: medium-high (a real, common early-funnel moment).
- **OPP-UX-74** (fixes UX7-05 and touches WS8's territory): drive every post-consent screen of the invite
  flow off the invite's full server-side status enum, not just two of its ~6 values, so no ordinary reload
  can ever regress a prospect back to a consent screen they already answered. Effort S–M. Impact: high in a
  sensitive-data context.
