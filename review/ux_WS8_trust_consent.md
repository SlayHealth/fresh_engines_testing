# WS8 — Trust, Privacy & Consent UX

**Reviewer workstream:** WS8 (IDs `UX8-NN`). Driven live in headless Chromium at mobile (390×844) and
desktop (1440×900). The invited-partner flow was walked **end-to-end, unauthenticated, in a fresh
browser context** — no session injection — exactly as a real invited partner would experience it:
real invites created through the actual `POST /api/invite/send` API (not fabricated DB rows), opened
by token, consent accepted/rejected, the full 33-step questionnaire completed with the product's own
"mock report" checkboxes, and the resulting submission/reload/re-consent behavior observed and, where
surprising, verified again directly against the database. The account-holder side was walked
authenticated (session-injected) against the seeded `clean`/`partial`/`empty` couples per the recipe.
Screenshots in `backend/scratch/ux_shots/` (prefix `ux8_`). Read-only on code; all mutations were made
through the product's own real endpoints (invite creation, consent, submission), never by hand-editing
rows to fake a state.

This workstream sits directly on top of **Finding #0** in the master doc (the asymmetric
single-account/pairing model) and the **REG-06 DPDP substantiation audit** — neither is re-diagnosed
here; this file supplies the concrete, live UX texture: what a real invited partner reads and clicks,
what the account holder is (and isn't) ever told about handling someone else's sensitive health data,
and whether today's trust/privacy copy holds up against what the code actually does.

**A note on environment noise, for honesty:** this backend runs under `nodemon` with an unscoped
watch (`nodemon src/server.js`, no `nodemonConfig`), so every scratch-script write under
`backend/scratch/` restarts the whole API for a few seconds. Two early test runs hit that restart
window and produced a transient `ECONNREFUSED` / non-JSON 500. Those specific failures are **not**
filed as defects — they were self-induced by this review's own tooling. However, chasing them down
surfaced a **permanent, code-level gap** that is filed below (UX8-09): the invited-partner page never
guards against a non-JSON error body, so *any* transient 5xx (from any cause, including the ones this
review accidentally created) renders a raw JavaScript parse error directly to the user. That code gap
is real regardless of what triggered it today.

**Surfaces mapped**
- Invite creation: `backend/src/controllers/invite.controller.js` (`createInvite`, `validateToken`,
  `updateConsent`, `submitQuestionnaire`), routes at `backend/src/routes/invite.routes.js`.
- Invited-partner flow: `frontend/src/app/invite/[token]/page.js` (consent screen, 33-step wizard,
  submission outcome).
- Account-holder flow: `frontend/src/app/add-prospect/page.js` (self-fill vs. invite-link routing
  choice, live invite timeline).
- Rotating "why this matters" trust copy: `frontend/src/constants/trustMessages.js`, rendered by
  `frontend/src/components/wizard/QuestionScreen.js`.
- Trust/compliance copy: `frontend/src/app/dashboard/MobileHomeView.js`,
  `frontend/src/app/dashboard/page.js`, `frontend/src/app/profile/page.js`,
  `frontend/src/app/core-engine/layout.js`, `frontend/src/app/core-engine/story/page.js`,
  `frontend/src/components/landing/TrustSignals.js`.

---

## Lead summary (sharpest findings first)

- **A first-class path exists to submit a third party's full health + mental-health profile with
  *zero* consent capture at all** (UX8-01) — "I'll enter their details myself" bypasses the invite/
  consent machinery entirely.
- **The product's own rotating trust copy repeatedly promises the invited partner their data "stays
  private to the two of you" / "just to you and your match"** — demonstrably false: the invited
  partner never sees the compiled report, confirmed live (UX8-02).
- **Reloading the invite link after the partner has already submitted re-shows the original
  Accept/Reject screen; clicking Reject at that point is accepted by the server, flips the invite to
  "rejected," and shows "SlayHealth will not collect your health details" — while the pathology
  report and full profile the partner already submitted remain in the database, unchanged** (UX8-03).
  Verified against Postgres directly, not just the UI.
- **The optional mental-health section's "Skip this section" escape hatch is wired on the object but
  never passed as a prop** on the invited-partner's page — confirmed by querying every button on the
  screen — so the partner is forced through all 21 questions with no way to decline just that part,
  even though the identical mechanism works correctly on the account holder's own equivalent flow
  (UX8-04).
- **The literal link the real `createInvite` API hands the account holder to copy/share is dead**
  right now — `APP_URL` in `backend/.env` points at a stale LAN IP and the wrong port; live-reproduced
  connection failure (UX8-05).
- No UI moment, anywhere, tells the account holder they are viewing another person's sensitive health
  data on that person's behalf; the one dashboard trust line is framed backwards (about the account
  holder's *own* data going outward, not the partner's data already sitting in the account holder's
  hands) (UX8-06).
- The "Privacy & data" row in the profile is a dead end dressed as a real settings page (UX8-07), and
  the already-"fixed" doctor-review trust badge (REG-03) has an unfixed sibling still live today on
  the same landing page (UX8-08).

---

### [P0] UX8-01 — "I'll enter their details myself" lets the account holder submit a third party's full clinical + psychological profile with zero consent capture
- Flow / Screen: Add-prospect routing choice → `frontend/src/app/add-prospect/page.js:65-68`
  (`PROSPECT_MODE_OPTIONS`), `:1399` (`choiceStep('How will your prospect share their details?', ...)`);
  self-mode data entry `:1250-1347` (`isSelfTurn` branches: "Upload prospect's Pathology Report",
  "Upload prospect's Radiology Report", `prospectMentalAnswers`).
- Viewport: both (routing screen is the standard wizard shell used everywhere else)
- Status: Code-only (traced precisely; the frontend crashed — see environment note at the end of this
  file — before a same-session screenshot of this exact screen could be captured; the strings below
  are exact, verified source, and the surrounding wizard shell renders identically to every other
  screenshot in this review).
- Evidence: The very first screen of "add a prospect" offers two co-equal options, same size, same
  styling, no supporting copy distinguishing their consent implications:
  `{ val: 'self', label: "I'll enter their details myself", desc: 'Fill in your prospect's information
  right now' }` vs. `{ val: 'invite', label: 'Generate a link to send them', desc: "They fill in their
  own details — you copy and send the link yourself" }`. Choosing "self" routes into a parallel data-
  entry flow (`activePerson === 'prospect'`) where the account holder personally fills in the
  prospect's DOB/height/weight/waist, uploads the **prospect's own pathology and radiology PDFs**, and
  answers the **21-question mental-wellbeing survey on the prospect's behalf** — all without a
  `prospect_invites` row, without a token, without an accept/reject record, without the prospect ever
  being aware a health-compatibility scan is being run using their (possibly guessed) blood work and
  psychological profile. This is not a lesser version of consent — it is the complete absence of any
  consent artifact for the majority-sensitive half of the report (STI markers, carrier status, mental
  health).
- UX impact: trust / comprehension — this is the single sharpest instance of the brief's core
  question ("is the account holder ever made aware they're handling a third party's sensitive data").
  The answer here is not just "no acknowledgment" — the product actively offers, at equal visual
  weight, a path that removes the other person from the loop altogether.
- Heuristic: user control & freedom (for the *absent* party, who has none); error prevention (no
  safeguard against unilateral entry of someone else's clinical/psychological data).
- Root cause: design/IA — a first-class routing choice presents two data-entry paths as
  interchangeable conveniences when only one of them involves the actual data subject at all.
- Best-fit direction: at minimum, require an explicit, logged acknowledgment when choosing "self" mode
  (e.g., "I confirm I have [prospect name]'s permission to enter their health information") rather than
  a bare convenience label; consider notifying the prospect (SMS/WhatsApp, since that channel already
  exists per `whatsappInvite.service.js`) that a compatibility scan using their name has been run, with
  a path to object. This does not need to force the full invite-link flow, but zero acknowledgment is
  the wrong floor for a product processing STI, fertility, and mental-health data.
- Effort: M
- Blast radius: add-prospect routing + self-mode data entry (the largest structural item in this
  review; likely warrants its own follow-up beyond WS8).

### [P0] UX8-02 — The product's own rotating "trust" copy tells the invited partner their data "stays private to the two of you" — demonstrably false
- Flow / Screen: Invited-partner wizard, every step — reassurance bubble rendered by
  `frontend/src/components/wizard/QuestionScreen.js:151-163` via
  `frontend/src/constants/trustMessages.js`. Compiled-report access model per Finding #0, confirmed
  live in this review (see UX8-03's submission screenshot).
- Viewport: mobile (primary reference); mechanism is viewport-independent.
- Status: Observed (mechanism + several rendered examples) + Code (the specific "private to the two
  of you" wording, confirmed present in the same pools that render on this exact page, was not the
  specific line drawn on this run's random rotation — cited by file:line below; kept distinct from
  Observed per the schema's Observed/Suspected discipline).
- Evidence: **Observed live**, rendered to "Rhea" (the seeded `partial` invite's real prospect name)
  during this review's actual run (`ux8_wizard_step1_gender_mobile.png`,
  `ux8_wizard_pathology_upload_mobile.png`): *"Rhea, we ask this to route the right reference ranges…"*,
  *"Rhea, that pathology report is basically your body's tell-all memoir — minus the drama."* These
  confirm the mechanism: a personalized, rotating reassurance bubble shown to the invited partner on
  every step. **Code-cited**, same pools, same page, different rotation index than what happened to
  render this run: `trustMessages.js:86` ("This upload stays encrypted and private, {name} — locked up
  tighter than your group chat"), `:99` ("This stays private and is only used for your own
  compatibility analysis, {name}"), `:131` ("{name}, your answers stay private between you and your
  match — always"), `:142` ("{name}, your data is encrypted and never shared without your say-so"),
  `:24` ("{name}, your data isn't going on a billboard — just to you and your match, promise"), `:74`
  ("{name}, this stays between us and your match — not even our engineers are nosy enough to peek"),
  `:121` ("However your prospect shares their side, {name}, it's Fort Knox either way"); the sharpest
  version, `:110` ("Genetic screening like this stays completely private to the two of you, {name}"),
  lives in the `genomics` pool, which this particular page doesn't tag any step with, but is one
  category swap away from being shown verbatim on this exact screen to this exact audience. Separately,
  the report itself closes with **the identical claim in the account holder's own report**
  (`frontend/src/app/core-engine/story/page.js:1153`): *"Your data stays private to the two of you."*
  **This is false for the invited partner on both ends.** Confirmed live in this review: the
  submission-success screen the partner sees (`ux8_submit_success_mobile.png`) states *"Your partner
  will receive the compatibility insights directly on their dashboard in real-time"* — with no mention
  of the submitter ever seeing anything — and the code contains no route, view, or link anywhere that
  would ever let the invited partner see the compiled report (confirmed by a full read of
  `frontend/src/app/invite/[token]/page.js`, which has exactly one post-submission state: a static
  "close this tab" card).
- UX impact: trust — this is not a vague comprehension gap, it is a specific, repeated, personalized,
  first-person promise ("private to the two of you," "just to you and your match") made to the person
  it is false for, at the exact moment they are asked to hand over STI, fertility, and mental-health
  data. If a partner ever discovers this (e.g., asks their fiancé "can I see my results?" and the
  answer is no), the retroactive read on every one of these reassurance bubbles is that the app lied
  to get the data.
- Heuristic: trust/credibility (Nielsen's honesty principle); match between system and real world.
- Root cause: copy — a shared reassurance-copy library was authored around a "two symmetric partners"
  mental model that does not match the actual one-account/one-report architecture (Finding #0).
- Best-fit direction: either (a) rewrite this copy family to state the real access model accurately
  (e.g., "this goes toward your joint compatibility report, viewable on {inviterName}'s account"), or
  (b) — the more durable fix — actually build a partner-facing summary view so the promise becomes
  true. Do not ship "private to the two of you" language until one of these is done; audit
  `trustMessages.js` for the full family before shipping any fix (this file lists at least 7 instances
  across 5 categories).
- Effort: S (copy-only fix) / L (build a real partner view)
- Blast radius: `trustMessages.js` (shared between the invite wizard and add-prospect's self-mode
  wizard — the "just to you and your match" framing is equally wrong in self-mode, where there is no
  "match" consent at all, compounding UX8-01), `core-engine/story/page.js:1153`.

### [P0] UX8-03 — Reloading the invite link after submission re-shows the consent gate; rejecting there falsely claims "no data collected" while the submitted report and profile remain in the database
- Flow / Screen: `frontend/src/app/invite/[token]/page.js:84-108` (`validate()` only sets
  `consentDecided=true` for the literal statuses `'consent_accepted'`/`'consent_rejected'`; any later
  lifecycle status — `questionnaire_submitted`, `processing`, `failed` — falls through to the
  `!consentDecided` branch, i.e. the original consent screen, `:299-357`); backend guard
  `backend/src/controllers/invite.controller.js:264-298` (`updateConsent` only blocks
  `'completed'`/`'revoked'`, not `'questionnaire_submitted'`); decline copy `:360-377`
  ("SlayHealth will not collect your health details or run compatibility testing").
- Viewport: mobile (primary reference, reproduced live)
- Status: Observed, and independently confirmed against the database (not just the UI).
- Evidence: Using the seeded `partial` invite (Rhea Partial), this review accepted consent, completed
  the entire 33-step questionnaire with the mock-pathology option, and reached the real "Details
  Submitted!" screen (`ux8_submit_success_mobile.png`; server status confirmed via direct API call:
  `"status":"questionnaire_submitted"`). **Reloading that same link** then re-rendered the original
  "SlayHealth Premarital Portal … Accept Consent / Reject Consent" screen from scratch
  (`ux8_reload_after_submit_shows_consent_again_mobile.png`), exactly as if nothing had happened.
  Clicking **Reject Consent** at that point succeeded (`ux8_post_submit_reject_screen_mobile.png`) and
  flipped the invite to `consent_rejected`, showing: *"You rejected the consent terms. SlayHealth will
  not collect your health details or run compatibility testing."* A direct Postgres query immediately
  after confirms this is false for this invite: `prospect_invites.pathology_report_id` still points at
  a real, `processing_status: "completed"` row in `reports` (`mock_pathology.pdf`), and the prospect's
  `users` row still holds the full submitted profile (DOB `1996-03-12`, city `Mumbai`, height/weight/
  waist, activity level) — none of it was deleted or ever touched by `updateConsent`, which only
  writes `status`/`consent_timestamp`/`consent_ip`/`consent_user_agent`. The account holder's own view
  of this state (`add-prospect/page.js:897-901`) compounds it: *"Invitation Declined: The prospect has
  rejected consent to share their health data"* — telling the account holder, too, that nothing was
  shared, when it was.
- UX impact: trust — this is the single moment in the product where a user actively tries to exercise
  a withdrawal right, and the UI affirmatively lies to them about the outcome. This is worse than REG-
  06's "no erasure path" gap (which is an absence); this is a **false positive confirmation of
  erasure that didn't happen**.
- Heuristic: trust/credibility; visibility of true system status; error prevention (no guard stops a
  decision from being re-litigated after the thing it purports to prevent has already occurred).
- Root cause: code — (1) `validate()`'s status check only recognizes two exact strings instead of "has
  a consent decision already been made," so any later lifecycle state regresses the UI to the original
  gate; (2) `updateConsent` has no guard against being called again once real data has been collected
  (only `completed`/`revoked` are blocked); (3) neither path triggers any compensating deletion when a
  post-submission "reject" is recorded, and the copy shown doesn't distinguish "rejected before
  anything was collected" from "rejected after full submission."
- Best-fit direction: broaden `validate()`'s check to treat any status past `sent`/`opened` as
  "decision already made" (or explicitly branch on `questionnaire_submitted`/`processing`/`completed`
  to show a distinct "already submitted" state, never the original consent gate); once
  `questionnaire_submitted` or later, `updateConsent` should either be blocked entirely or rerouted to
  a real "request deletion" flow that actually purges the `reports` row(s) and profile fields and only
  then shows the "we will not [continue to] collect/use your data" message.
- Effort: M
- Blast radius: `invite/[token]/page.js` validate/consent logic, `invite.controller.js`'s
  `updateConsent`, the account holder's invite-timeline copy (`add-prospect/page.js:897-901`).

### [P0] UX8-05 — The literal invite link the real API hands the account holder is dead (stale host:port in `APP_URL`)
- Flow / Screen: `backend/src/controllers/invite.controller.js:118`
  (`` `${process.env.APP_URL || 'http://localhost:3000'}/invite/${token}` ``); value read from
  `backend/.env:10` (`APP_URL="http://192.168.1.45:3000"`); rendered/copied at
  `frontend/src/app/add-prospect/page.js:739-745` (`getInviteLink()` — prefers `activeInvite.link`,
  i.e. this exact string, over `window.location.origin`) and shown to the account holder at `:832-835`
  ("Your invite link — copy and send it to …").
- Viewport: both (this is a backend string, not a rendering difference)
- Status: Observed — live-reproduced. Calling the real `POST /api/invite/send` endpoint returned
  `"link":"http://192.168.1.45:3000/invite/<token>"`. This machine's actual LAN address is
  `192.168.1.13` (confirmed via `ifconfig`), not `.45`, and nothing answers on port 3000 at all right
  now (`curl` to both `localhost:3000` and `192.168.1.45:3000` return connection failures). Opening
  this exact link in a fresh browser context times out with no connection
  (`ux8_broken_literal_link_mobile.png`).
- UX impact: drop-off — this is the literal string the "Copy Link" / native Share button hands the
  account holder to send to their partner. If a real invited partner receives and taps this link, the
  flow never begins; there is no error screen, no fallback, nothing — the request never completes. All
  of this review's other invite/consent findings assume the partner *can* reach the token page; this
  finding is upstream of all of them.
- Heuristic: this is the most literal possible violation of "help users recognize/diagnose/recover
  from errors" — there is no error to recognize because the link fails to connect at all.
- Root cause: config/deployment — `APP_URL` is a static, hand-set env value with no validation against
  the frontend's actual serving origin, and no fallback derived from the incoming request
  (`req.protocol`/`req.get('host')`) when it drifts.
- Best-fit direction: stop hardcoding `APP_URL`; derive the invite link's origin from the actual
  incoming request (or, at minimum, validate `APP_URL` against a health check at boot and warn loudly
  if it doesn't resolve). Same string is reused for the WhatsApp invite notification
  (`backend/src/services/notification/whatsappInvite.service.js:71`), so a WhatsApp-delivered invite
  would carry the identical dead link.
- Effort: S
- Blast radius: `invite.controller.js:118`, `whatsappInvite.service.js:71`, `add-prospect/page.js`'s
  link display/copy/share affordances.

### [P1] UX8-04 — The optional mental-health section's "Skip this section" control is set on the step object but never wired to the component on the invited-partner's page
- Flow / Screen: `frontend/src/app/invite/[token]/page.js:534-535`
  (`mentalSteps[0].onSkip = handleSubmit; mentalSteps[0].skipLabel = '...'`) vs. the `<QuestionScreen>`
  invocation at `:569-586`, which passes `onNext`, `nextLabel`, `nextDisabled` but **never** `onSkip` or
  `skipLabel`. Compare the working equivalent: `frontend/src/app/add-prospect/page.js:1483`
  (`onSkip={step.onSkip}` — correctly wired) and `:1140` (`onSkip: required ? undefined : advance`).
- Viewport: mobile (primary reference; the bug is a missing prop, not styling, so it affects desktop
  identically)
- Status: Observed — confirmed by querying every button on the rendered mental-intro screen live:
  `["", "Pretty low most days", "Runs out of steam sometimes", "Feels normal, ups and downs", "Good
  energy most days", "Full of drive, always going", "Next"]` (`ux8_mental_intro_no_skip_mobile.png`).
  No skip control exists in the DOM at all, matching the code trace.
- Evidence: the code's own comment at `:518-520` describes the intended design: *"Optional mental
  health block — no separate opt-in screen; the first question itself offers a 'Skip this section' out
  (straight to submit)."* That is the documented mechanism by which this section stays genuinely
  optional for the invited partner. It does not render. The only way to avoid the 21-question mental-
  health battery, once past the pathology/radiology upload steps, is to answer all 21 questions or
  abandon the browser tab entirely (which, per `handleSubmit`'s all-or-nothing single POST, would also
  discard the pathology/radiology data already staged in that session).
- UX impact: friction + autonomy — this is a "respects the user's right to decline" question the brief
  specifically asks about, and today the answer is no, for the more psychologically sensitive half of
  the questionnaire, specifically on the flow used by the less-empowered party (the invited partner,
  who may already feel pressure from a partner/family member having sent them this link). The identical
  mechanism works correctly for the account holder's own equivalent flow.
- Heuristic: user control & freedom; consistency (same component, same intended behavior, silently
  broken on one call site only).
- Root cause: code — a missing prop pass-through, not a design decision.
- Best-fit direction: pass `onSkip={currentStep.onSkip}` and `skipLabel={currentStep.skipLabel}` to
  `<QuestionScreen>` in `invite/[token]/page.js`, mirroring `add-prospect/page.js:1483` exactly.
- Effort: S
- Blast radius: `invite/[token]/page.js` render call only; also restores the (currently equally dead)
  optional-skip on the radiology step (`:486`, `onSkip: goNext`).

### [P1] UX8-06 — No UI moment ever tells the account holder they are viewing/controlling a third party's sensitive health data on that person's behalf
- Flow / Screen: cross-surface — dashboard trust line `frontend/src/app/dashboard/MobileHomeView.js:169`
  ("Encrypted end to end. Nothing is shared with your partner or family until you say so."); report
  shell and story narrative `frontend/src/app/core-engine/layout.js`, `frontend/src/app/core-engine/
  story/page.js`; account-holder invite timeline `add-prospect/page.js:816-940`.
- Viewport: both
- Status: Observed/Code-confirmed — a targeted search of the entire report shell
  (`frontend/src/app/core-engine`) for "consent," "on behalf," "their behalf," "permission," "gave
  permission" returns **zero** matches. The invite timeline the account holder sees while their
  partner is filling out the form (`ux8_inviter_addprospect_mobile.png` and code at `:816-940`) is
  purely operational status ("Opened" → "Consent Decision" → "Filling Form" → "Form Submitted") with no
  language framing what is being received as another person's sensitive medical/psychological
  disclosure.
- Evidence: the one explicit trust statement that does exist —
  *"Encrypted end to end. Nothing is shared with your partner or family until you say so"*
  (`MobileHomeView.js:169`) — is framed in exactly the wrong direction for half of what the product
  does. It reassures the account holder that **their own** data won't go **outward** to a partner or
  family without permission. It says nothing about the fact that, for every invited-partner submission,
  the account holder is the one holding **incoming** sensitive data — STI markers, carrier status,
  fertility metrics, mental-health answers — that belongs to someone else, with no reciprocal promise
  made to that someone else about what the account holder can do with it (screenshot, forward the PDF,
  show a parent). The report narrative itself uses only symmetric, joint-ownership language — "your
  combined picture," "Health Together Index," "captured today at your premarital baseline" — which
  reads as if the whole dataset is equally "yours," never surfacing that roughly half of it arrived via
  someone else's one-time, now-exhausted consent.
- UX impact: trust/comprehension — this is the brief's central question for the account-holder side,
  and the product currently has no answer to it. In a health product handling STI and genetic data,
  the party with access and the party with the data are different people, and nothing on screen ever
  says so.
- Heuristic: match between system and real world (the mental model implied is "my data," the actual
  model is "my data + a consenting-but-absent third party's data").
- Root cause: copy/design — trust and privacy messaging was authored around a single-user mental
  model.
- Best-fit direction: add one clear, quiet line to the report shell acknowledging the asymmetry — e.g.
  "{prospectName} shared this with you after reviewing and accepting the consent notice on
  {date}" — sourced from the real `consent_timestamp` already captured
  (`invite.controller.js:284`), which the product has never surfaced anywhere despite recording it.
  This is low-effort because the data already exists; it's just never shown to anyone.
- Effort: S–M
- Blast radius: report shell header/footer, dashboard trust line copy.

### [P1] UX8-07 — "Privacy & data" in the profile is a dead end dressed as a real settings destination
- Flow / Screen: Mobile profile list, `frontend/src/app/profile/page.js:246-251`.
- Viewport: mobile (this row doesn't exist at all on the desktop profile branch — see note below)
- Status: Observed — `ux8_profile_compliance_mobile.png`.
- Evidence: the profile's "Account" list renders four rows with **identical affordance** — icon, bold
  label, trailing chevron (`<Ico name="chev" className="chevron" />`) — implying all four navigate
  somewhere: "Personal details" (opens a real inline edit form), "Reports & downloads" (routes to
  `/dashboard`), **"Privacy & data"** (`:249` — `onClick={() => toast.info('Your data is encrypted and
  never shared without your consent.')}`), **"Settings"** (`:250` — toast: "DPDP compliance coming
  soon."). Tapping either of the last two produces only a toast; there is no privacy policy, no data
  inventory, no control of any kind behind the row a concerned user would tap first. Unlike "Settings,"
  which at least admits incompleteness ("coming soon"), "Privacy & data" states a present-tense
  reassurance ("is encrypted and never shared without your consent") with a chevron implying there's a
  page behind it to verify that claim — there isn't.
- UX impact: trust — this is precisely the control a user alarmed by their STI/carrier/genetic
  results would look for. Finding an active-looking row that only pops a canned toast, with the exact
  same visual affordance as rows that do work, reads as evasive once discovered, even though it likely
  isn't intentional.
- Heuristic: visibility of system status; honesty (an affordance implying navigation should navigate).
- Root cause: code/design — a not-yet-built settings destination given the same chevron treatment as
  working rows, rather than the muted/"coming soon" treatment already used elsewhere in this same
  product (e.g., the Genomics tab pattern flagged in UX2-01/OPP-UX-23 — the same fix pattern applies
  here).
- Best-fit direction: either build a minimal real "Privacy & data" page (even just the consent
  timestamp, what's collected, and a delete-my-data action reusing the existing account-deletion
  endpoint) or visually demote the row to match "coming soon" styling so the chevron stops implying a
  destination that isn't there.
- Effort: S (demote styling) / M (build a minimal real page)
- Blast radius: `profile/page.js` mobile branch only (the desktop branch has no "Privacy & data" row at
  all — only the equivalent "Compliance: DPDP compliance coming soon" — a mobile/desktop content
  difference noted here for completeness, not filed as a reconcile item since that call belongs to
  WS4/WS5).

### [P1] UX8-08 — REG-03's "Doctor Reviewed" fix did not fully propagate: an unfixed sibling badge is still live today
- Flow / Screen: Landing page, `frontend/src/components/landing/TrustSignals.js` — two sibling
  components in the same file: `QuickTrustBadges` (`:54-71`, correctly fixed, "Evidence-Based" at
  `:67`) vs. `TrustSignals`'s `SIGNALS` array (`:3-8`), rendered via
  `<TrustSignals variant="detailed" />` (`frontend/src/app/page.js:208`) and
  `<TrustSignals variant="compact" />` (`:247`).
- Viewport: both — confirmed rendered on both (`ux8_landing_trust_signals_mobile.png`,
  `ux8_landing_trust_signals_desktop.png`).
- Status: Observed — live on the current app today.
- Evidence: `TrustSignals.js:7`: `{ icon: Award, text: 'Doctor Verified', detail: 'All reports
  reviewed by MDs', color: 'var(--amber-d)' }`. This is functionally identical to the "Doctor Reviewed"
  claim REG-03 already found unsubstantiated (no clinician-review artifact anywhere in the repo — the
  only "clinicians" are LLM system-prompt personas) and which this review's brief states was fixed
  everywhere. It was fixed in `QuickTrustBadges` (same file, "Evidence-Based") but the sibling
  `TrustSignals` component's badge grid — rendered under the landing page's own **"Why Couples Trust
  SlayHealth"** heading — still reads **"Doctor Verified / All reports reviewed by MDs"** on both
  viewports right now.
- UX impact: trust — an unsubstantiated clinical-authority claim sitting directly beside the correctly
  fixed "Evidence-Based" badge, in the exact section titled "Why Couples Trust SlayHealth," undermines
  confidence in the fix itself once anyone notices both badges say different things about the same
  underlying claim.
- Heuristic: consistency (within a single file, let alone a single trust section); honesty.
- Root cause: code — the REG-03 remediation touched one of two sibling trust-badge components in the
  same file and missed the other.
- Best-fit direction: apply the same fix to `TrustSignals.js:7` — replace with "Evidence-Based" (or
  remove the badge) to match `QuickTrustBadges`; consider collapsing the two components into one source
  of truth so this class of miss can't recur (they render near-identical badge sets from two separate
  arrays today).
- Effort: S
- Blast radius: `TrustSignals.js` only; rendered at `page.js:208,247`.

### [P2] UX8-09 — No defensive handling of non-JSON error responses on the invited-partner's page; a raw JS parse error can render verbatim to a real user
- Flow / Screen: `frontend/src/app/invite/[token]/page.js` — `validate()` (`:84-108`),
  `handleConsent()` (`:165-183`), `handleSubmit()` (`:185-247`); all three call `res.json()` (or throw
  its result) with no guard for a non-JSON body.
- Viewport: mobile (observed); code path is viewport-independent.
- Status: Observed, multiple times, in this review's own testing — with an honest caveat on cause (see
  the environment note at the top of this file: this review's own scratch-file writes intermittently
  restarted the backend via its unscoped `nodemon` watch, and separately this shared dev environment
  showed proxy-layer hiccups under concurrent load). Attribution: the *trigger* seen today was
  transient/environmental, not a claimed frequent production bug — but the *code gap* itself is
  permanent and independent of cause.
- Evidence: when any of the three fetch calls received a non-2xx, non-JSON body during this review's
  testing, the user-visible result was the literal string **"Unexpected token 'I', "Internal S"... is
  not valid JSON"** — rendered as the entire body of the "Invalid Link" screen (in place of
  `validationError`) and, once, injected inline mid-questionnaire between a question's options and its
  trust bubble. This is a raw `JSON.parse` `SyntaxError` message, not a product-authored string,
  because none of the three handlers wrap `res.json()` in a way that falls back gracefully when the
  body isn't JSON (e.g. checking `res.headers.get('content-type')` or `.catch()`-ing the parse).
- UX impact: trust — in the single most sensitive moment of the flow (deciding whether to share health
  data, or finding out whether a submission worked), any transient backend hiccup — of which there are
  many plausible causes in a real deployment (a redeploy, a brief outage, a proxy timeout) — surfaces
  raw JavaScript internals instead of a calm, human "Something went wrong — please try again" message.
- Heuristic: help users recognize, diagnose, and recover from errors; error prevention.
- Root cause: code — missing defensive parsing around three `fetch`/`res.json()` call sites.
- Best-fit direction: wrap each `res.json()` call in a helper that falls back to a generic message
  (`res.json().catch(() => ({}))`, then apply `data.error || 'Something went wrong — please try again.'`)
  everywhere on this page.
- Effort: S
- Blast radius: `invite/[token]/page.js` only (all three handlers).

### [P2] UX8-10 — The "not a diagnosis" disclaimer and the DPDP line are legible but consistently the smallest, lowest-contrast, worst-placed text on their screens
- Flow / Screen: Dashboard `frontend/src/app/dashboard/MobileHomeView.js:170-172` (10px,
  `text-[10px]`, color `var(--ink-3)`) and `frontend/src/app/dashboard/page.js:389`; report shell
  `frontend/src/app/core-engine/layout.js:362-364` (`text-[10px] text-slate-400`); profile compliance
  line `frontend/src/app/profile/page.js:394` (`text-xs`, `var(--muted)`).
- Viewport: both — `ux8_dashboard_trust_mobile.png`, `ux8_dashboard_trust_desktop.png`,
  `ux8_report_shell_mobile.png`, `ux8_report_shell_desktop.png`, `ux8_profile_compliance_mobile.png`.
- Status: Observed.
- Evidence: on the dashboard, the disclaimer is the very last thing on the page, below a dark "care
  card" with two CTA buttons, in 10px muted-gray text — easy to never scroll to, and easy to skip even
  if scrolled past. On the report shell, the identical sentence is placed much earlier (right under the
  quota strip, near the top), in the same small/muted styling but in a position a user is far more
  likely to actually see. The same one safety-relevant sentence — informational/not-a-diagnosis — gets
  materially different real-world visibility depending only on which screen it's copy-pasted onto, with
  no apparent reasoning behind the difference. The DPDP compliance line in profile reads the same way:
  small, muted, and sitting in a settings list next to rows that otherwise look identical in weight.
- UX impact: comprehension — this is a legibility/placement judgment, not a legal one (out of scope):
  the sentence a user most needs to see consistently ("this isn't a diagnosis," "here's what we
  actually have implemented so far") is styled to be the easiest thing on the page to miss, and its
  prominence is inconsistent across the two surfaces that carry it.
- Heuristic: visibility of system status; consistency.
- Root cause: design — disclaimer treated as legal boilerplate/footer rather than a comprehension aid,
  with no shared placement rule across surfaces.
- Best-fit direction: keep the disclaimer's tone but standardize placement near the top of any screen
  presenting a score/result (matching the report shell's better placement) rather than the dashboard's
  bottom-of-page treatment, and consider a slightly higher-contrast treatment than the current
  10px/muted styling given what it's saying.
- Effort: S
- Blast radius: `MobileHomeView.js`, `dashboard/page.js`, `core-engine/layout.js` (copy positioning
  only, no wording change needed).

### [P2] UX8-11 — A 33-step, one-sitting questionnaire is a substantial ask for someone who may feel pressured into consenting
- Flow / Screen: `frontend/src/app/invite/[token]/page.js` — steps array assembled at `:420-552`
  (10 demographic/lifestyle fields + 2 upload steps + 21 mental-health questions = 33 total, confirmed
  live: `"1/33"` progress readout, `ux8_wizard_step1_gender_mobile.png`).
- Viewport: mobile (primary reference)
- Status: Observed.
- Evidence: the invited partner — who, per the brief, may be a fiancé(e) or prospective match feeling
  social/family pressure to comply once handed this link — faces a single continuous 33-question flow
  with no visible "save and finish later" framing beyond client-side `localStorage` persistence (which
  a different device/browser wouldn't have), and, compounding UX8-04, no way to shorten it by
  legitimately skipping the optional mental-health third of it. The rotating trust bubbles
  (`~4 min left` → `~2 min left`) do a good job of managing expectations about length, but the length
  itself, combined with the broken skip, is a real completion-pressure point.
- UX impact: friction/emotional weight — directly the brief's "does the UI respect the partner's
  autonomy" question; a long, effectively-mandatory-once-started flow for someone who may already feel
  they can't easily say no to the person who sent the link.
- Heuristic: flexibility & efficiency of use; user control & freedom.
- Root cause: design/IA — optional content (mental wellbeing) not actually optional in practice
  (UX8-04 is the proximate code cause; this entry is the standalone length/pressure concern even if
  UX8-04 were fixed).
- Best-fit direction: once UX8-04 is fixed, this is substantially mitigated; separately, consider
  surfacing an explicit "you can close this and finish later — we'll keep your place" reassurance
  given the invite's 24-hour token expiry is never mentioned anywhere on the consent or wizard screens.
- Effort: S (once UX8-04 lands) / M (broader pacing changes)
- Blast radius: invite wizard only.

### [P3 · positive] UX8-12 — The consent screen's Accept/Reject buttons are genuinely equal in size and position; only color/icon nudge toward Accept
- Flow / Screen: Consent screen, `frontend/src/app/invite/[token]/page.js:337-353`.
- Viewport: mobile (primary reference) — `ux8_consent_pending_partial_mobile.png`.
- Status: Observed.
- Evidence: both buttons sit in a `grid-cols-2 gap-4` row, identical padding, identical `font-bold
  text-sm` sizing, identical corner radius — "Reject Consent" is not a de-emphasized ghost link tucked
  below a giant "Accept" button, which is the more common dark pattern this brief was watching for.
  The one asymmetry: Accept Consent carries the brand pink fill, a drop shadow (`shadow-pink-500/20`),
  and a `ShieldCheck` icon, while Reject Consent is a plain white/outlined button with no icon — a mild
  visual-weight nudge toward acceptance via color/iconography, but not a structural one (size,
  position, and click-target are equal).
- UX impact: positive, with a minor watch-out. The brief specifically asks whether the consent moment
  "subtly pushes toward acceptance" — the honest answer is: not structurally, only cosmetically.
- Best-fit direction (minor, not a defect): if this is ever revisited, an equally neutral treatment for
  both buttons (or an icon on Reject too) would remove even the cosmetic nudge — optional polish, not a
  fix.
- Effort: — · Blast radius: —

### [P3] UX8-13 — Mental-health per-question trust-message personalization silently never fires (title-key mismatch)
- Flow / Screen: `frontend/src/constants/trustMessages.js:161,239-322`
  (`TRUST_MESSAGES_BY_QUESTION`) vs. the actual rendered question titles from
  `MENTAL_HEALTH_QUESTIONS`.
- Viewport: mobile (observed)
- Status: Observed — live text capture of the first mental question showed the **category-pool**
  message (`mental[0]`: "there's no wrong answer here — only an honest one…") rather than the
  **per-question** entry keyed `'Daily energy & motivation'` (which reads differently, e.g. "your
  typical energy level says a lot about emotional resilience day to day"). The actual on-screen title
  was "How's your everyday energy?" — a different string than the map's key — so
  `TRUST_MESSAGES_BY_QUESTION[title]` never matches and every mental question silently falls back to
  the generic category pool.
- UX impact: minor comprehension/polish — the more carefully-written, question-specific reassurance
  copy for the entire mental-health section is dead code; users get the generic pool instead. Not
  incorrect or false, just less considered than intended.
- Root cause: copy/code — key strings in `TRUST_MESSAGES_BY_QUESTION` don't match the live question
  titles they were meant to target.
- Best-fit direction: align the map's keys to the actual rendered titles (or vice versa) for the mental
  section.
- Effort: S · Blast radius: `trustMessages.js` mental section only.

---

## Opportunities (WS8)

- **OPP-UX-81 ★** (fixes UX8-01): require an explicit, logged acknowledgment (or a lightweight
  prospect notification) before "self" mode collects a third party's clinical/psychological data, so
  no path exists with literally zero consent artifact. Effort M. Impact: high (closes the single
  largest trust gap in this review).
- **OPP-UX-82 ★** (fixes UX8-02): rewrite the "stays private to the two of you / just to you and your
  match" trust-copy family to reflect the real one-account access model, or build a genuine
  partner-facing summary view so the promise becomes true. Effort S (copy) / L (real view). Impact:
  high.
- **OPP-UX-83 ★** (fixes UX8-03): treat any post-consent invite status as "decision already made" so
  reload never re-shows the Accept/Reject gate after real data has been submitted; route any
  post-submission "I want to withdraw" request to an actual deletion flow instead of a silent status
  flip. Effort M. Impact: high (this is a live, reproducible false-confirmation bug).
- **OPP-UX-84** (fixes UX8-04): thread `onSkip`/`skipLabel` through to `<QuestionScreen>` in the invite
  page, mirroring the already-correct wiring in `add-prospect/page.js`. Effort S. Impact: medium-high
  (restores an already-designed autonomy mechanism).
- **OPP-UX-85** (fixes UX8-05): derive the invite link's origin from the real serving request instead
  of a static `APP_URL` env value, or validate it at boot. Effort S. Impact: high where it applies (a
  total flow blocker).
- **OPP-UX-86** (fixes UX8-07 + UX8-08): give "Privacy & data" a real minimal destination (consent
  timestamp + what's collected + a delete action reusing the existing account-deletion endpoint), and
  finish the REG-03 badge fix by aligning `TrustSignals.js` with `QuickTrustBadges`. Effort S–M. Impact:
  medium (trust-signal integrity).
- **OPP-UX-87** (fixes UX8-06): surface the real, already-captured `consent_timestamp` on the report
  shell as a quiet acknowledgment line, since the data exists today and is simply never shown to
  anyone. Effort S. Impact: medium (comprehension of the actual custody model).

---

## Screenshot index (`backend/scratch/ux_shots/`, prefix `ux8_`)
- `ux8_consent_pending_partial_mobile.png` — full consent/disclosure screen, both buttons visible
  (UX8-02, UX8-12).
- `ux8_consent_pending_reject_mobile.png`, `ux8_consent_rejected_mobile.png`,
  `ux8_consent_rejected_reload_mobile.png` — clean pre-submission reject path.
- `ux8_wizard_step1_gender_mobile.png`, `ux8_wizard_pathology_upload_mobile.png` — live trust-bubble
  copy rendered to the invited partner (UX8-02).
- `ux8_mental_intro_no_skip_mobile.png` — confirms no skip control on the mental-health intro (UX8-04).
- `ux8_submit_success_mobile.png` — "Your partner will receive the compatibility insights…" success
  screen (UX8-02, Finding #0 live confirmation).
- `ux8_reload_after_submit_shows_consent_again_mobile.png`,
  `ux8_post_submit_reject_screen_mobile.png` — the consent-gate regression and false "will not
  collect" claim (UX8-03).
- `ux8_broken_literal_link_mobile.png` — the dead literal invite link (UX8-05).
- `ux8_inviter_addprospect_mobile.png` — account holder's invite timeline, purely operational copy
  (UX8-06).
- `ux8_dashboard_trust_mobile.png` / `_desktop.png` — dashboard trust line + disclaimer placement
  (UX8-06, UX8-10).
- `ux8_report_shell_mobile.png` / `_desktop.png` — report shell disclaimer placement + "private to the
  two of you" closing line (UX8-02, UX8-10).
- `ux8_profile_compliance_mobile.png` / `_desktop.png` — "Privacy & data" / "Compliance" rows (UX8-07,
  UX8-10).
- `ux8_landing_trust_signals_mobile.png` / `_desktop.png` — the unfixed "Doctor Verified" badge
  (UX8-08).

**Environment note for the lead:** the frontend dev server (port 3002) went down partway through this
review's final capture pass and did not recover after ~2 minutes of polling; per the hard rule against
starting/stopping either server, it was left alone rather than restarted. This blocked one supplementary
(non-essential) screenshot for UX8-01 — the finding itself is fully supported by exact source citations
and is not weakened by the missing screenshot, but flagging the outage in case it affects other
in-flight workstreams.
