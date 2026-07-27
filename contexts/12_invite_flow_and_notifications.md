# Invite Flow, Consent & WhatsApp Notifications

**Doc 12 of 22** · Audience: a solo full‑stack successor · Prerequisite: `10_match_orchestration_generate_insights.md`, `04_auth_session_and_security.md`.

Goal of this doc: fully map how a second person's health data enters a couple match — the two account‑holder paths (self‑entry vs invite link), the 11‑status invite state machine, the prospect's un‑authenticated self‑fill wizard, the background match it kicks off, the real post‑submission erasure path, and the WhatsApp Cloud API layer (which today carries **only OTPs** — invite delivery is dead code). It also documents the admin message board and the open consent/DPDP gaps.

This subsystem is the **only** way a couple gets two sides of data without both partners having full accounts. It is small in code but dense in consent/privacy semantics, so read it before touching anything that writes `prospect_invites`, `reports`, or `radiology_reports`.

---

## 1. The two account‑holder paths

An authenticated account holder (the "inviter") brings their partner ("the prospect") into a match in one of two ways. The choice is made in the add‑prospect wizard (`frontend/src/app/add-prospect/page.js`), and the two paths differ in **who enters the data** and **what consent artifact is written**.

| | **Self‑entry ("self mode")** | **Invite link** |
|---|---|---|
| Who fills the form | The account holder, on the partner's behalf | The partner, un‑authenticated, in their own browser |
| Entry point | `handleConfirmSelfEntryConsent` → `POST /api/invite/self-entry-consent` (`add-prospect/page.js:850`, `:1624`) | `handleCreateInviteLink` → `POST /api/invite/send` (`add-prospect/page.js:810`, `:1600`) |
| Consent artifact | One row in `self_entry_consents` (acknowledgment: who, prospect name, ip, UA, timestamp) | `prospect_invites` row + the prospect's own `consent_timestamp`/`consent_ip`/`consent_user_agent` stamped at accept time |
| State machine | None — no invite row, no token; the account holder just proceeds into the normal add‑prospect data entry | Full 11‑status machine (§2), surfaced live to the inviter via SSE + polling |
| Backend controller | `logSelfEntryConsent` (`invite.controller.js:170`) | `createInvite` (`invite.controller.js:104`) → later `submitQuestionnaire`, `runInviteMatch` |

The self‑entry consent log (`self_entry_consents`) exists because that path **previously had zero consent artifact at all** — no token, no accept/reject record — even though the account holder is entering a third party's clinical and psychological data. It was added under **UX8‑01** to mirror the audit trail the invite path already kept (`postgres.service.js:266‑283`). It is a **logged acknowledgment only** — there is no UI moment that tells the account holder they are controlling someone else's sensitive data (that is the still‑open **UX8‑06**, §13).

The rest of this doc concerns the **invite‑link** path, which owns the state machine, the wizard, and the notification plumbing.

```
                 add-prospect wizard (account holder, authenticated)
                        │
          ┌─────────────┴─────────────┐
          │                           │
     "I'll enter it"              "Invite my partner"
     self-entry-consent           POST /invite/send
     → self_entry_consents        → prospect_invites (status 'sent')
     → normal data entry          → copy/share link  ──▶  prospect opens /invite/{token}
                                                          (un-authenticated, §4)
```

---

## 2. The invite status state machine

`prospect_invites.status` is a free‑text column with a schema default of `'created'`. There is **no DB enum and no transition guard** — the legal transitions live only in the controller functions below. Learn the emitted set; a new dev who trusts the frontend timeline will chase two statuses that don't exist.

### Statuses the backend actually emits

| Status | Set by | File:line | Meaning / transition |
|---|---|---|---|
| `created` | schema default only — **never written by code** | `postgres.service.js:158` | Vestigial; `createInvite` inserts `'sent'` directly, so no live row is ever `created`. |
| `sent` | `createInvite` | `invite.controller.js:141` | Link generated, ready to share. Initial live state. |
| `delivered` | webhook status mapping | `invite.controller.js:977` | From `sent` on a WhatsApp `delivered` event. **Unreachable today** — invites are never sent over WhatsApp (§9). |
| `opened` | `validateToken` (and webhook `read`) | `invite.controller.js:297`, `:979` | Prospect opened the link (GET flips `sent`/`delivered` → `opened`). |
| `consent_accepted` | `updateConsent` | `invite.controller.js:363` | Prospect accepted the consent disclosure. |
| `consent_rejected` | `updateConsent` | `invite.controller.js:363` | Prospect declined — **or** withdrew after submission (§7). |
| `questionnaire_submitted` | `submitQuestionnaire` | `invite.controller.js:838` | Self‑fill + PDFs ingested; report rows exist. |
| `processing` | `runInviteMatch` (atomic CAS) | `invite.controller.js:889` | Match worker claimed and running. |
| `completed` | `processCompatibilityBackground` (success) | `invite.controller.js:638` | Match compiled; `matchId` broadcast. Terminal (happy path). |
| `failed` | `processCompatibilityBackground` (catch) | `invite.controller.js:643` | Background match threw. Re‑runnable (CAS allows `failed` → `processing`). |
| `expired` | `validateToken` past `expires_at` | `invite.controller.js:281` | 24h TTL elapsed; set lazily on the next validate. |
| `revoked` | `revokeInvite` | `invite.controller.js:922` | Inviter cancelled the invite. |

### The two phantom states — do not rely on them

The inviter's timeline (`add-prospect/page.js:948` `renderTimeline`) lists `consent_pending` and `questionnaire_started` in its `activeStates` arrays (`:954‑957`). **The backend never sets either.** They are dead placeholders in the frontend that happen to be harmless because they only appear as *members* of `activeStates` OR‑lists, never as an actual `status` value. If you add real "consent pending"/"filling form" tracking, you must emit these from the controller — right now the "Consent Decision" and "Filling Form" timeline rows only light up once `consent_accepted`/`questionnaire_submitted` land.

```
created(default,never live)
   └▶ sent ──validate/GET──▶ opened ──consent──▶ consent_accepted ──submit──▶ questionnaire_submitted
        │                       │                    │                              │
        │(delivered: dead)      │                    └▶ consent_rejected            └▶ run-match (CAS)
        │                       │                                                      │
        └────── expired / revoked (from most non-terminal states) ─────┐              ▼
                                                                        │          processing
   withdrawal after submit: consent_rejected + purge (§7) ─────────────┘         ┌───┴───┐
                                                                             completed  failed──▶(re-run)
```

### Legal‑transition gotchas

- **`validateToken` mutates on a GET.** A plain `GET /api/invite/validate/{token}` flips `sent`/`delivered` → `opened` and broadcasts (`invite.controller.js:296‑300`). Any **link‑preview bot** (WhatsApp/Signal/iMessage unfurl, Slack unfurl) that fetches the page will mark the invite `opened` before a human ever sees it. Treat `opened` as "the URL was dereferenced", not "a human opened it".
- **`runInviteMatch` only accepts `questionnaire_submitted` or `failed`** (`:877`, `:890`) — this is the re‑run affordance for a failed match.
- **Terminal‑ish guards:** `updateConsent` and `submitQuestionnaire` reject `completed`/`revoked` (`:358`, `:666`). `validateToken` 410s on expiry, 403s on `revoked`, 400s on `completed` (`:279‑293`).

---

## 3. Token & link generation

`createInvite` (`invite.controller.js:104‑162`) is the entry point for the invite path.

| Constant | Value | Where |
|---|---|---|
| Token | `crypto.randomBytes(32).toString('hex')` → **64 hex chars**, `UNIQUE` | `invite.controller.js:117`, `postgres.service.js:156` |
| Expiry | `now + 24 * 60 * 60 * 1000` → **24 hours** | `invite.controller.js:119` |
| Placeholder prospect | A real `users` row is inserted up front with `phone_number = 'invite-{inviteId}'` and the prospect's name | `invite.controller.js:123‑131` |
| Initial status | `'sent'` (link is ready to share immediately) | `invite.controller.js:141` |
| Inviter mental answers | If passed, stored as `mental_answers_json = {"inviter": {...}}` (JSONB) | `invite.controller.js:133‑135` |
| Returned link | `` `${resolveAppOrigin(appOrigin)}/invite/${token}` `` | `invite.controller.js:144` |

**Why a placeholder `users` row?** The prospect has no account. The system needs a `users` row to hang their demographics/lifestyle on and to key report ownership, so `createInvite` mints one immediately with a synthetic phone. The FK `prospect_invites.prospect_user_id → users(id)` is `ON DELETE SET NULL` (`postgres.service.js:153`) — deleting that placeholder user (as erasure does, §7) nulls the pointer rather than cascading the invite away.

### `resolveAppOrigin` — the trust chain that fixed the dead‑link bug

`resolveAppOrigin(candidateOrigin)` (`invite.controller.js:17‑33`) decides the origin the invite link is built on, in this fallback order:

1. `candidateOrigin` — the `appOrigin` from the request body, **only if** it parses as an `http(s)` URL.
2. `process.env.APP_URL` — same validity check.
3. `'http://localhost:3000'` — last resort, with a `logger.warn` that links will likely be unreachable.

The account‑holder page sends `appOrigin: window.location.origin` (`add-prospect/page.js:829`). This is the **UX8‑05** fix: `APP_URL` in `backend/.env` is a **stale LAN IP** (`http://192.168.1.45:3000`, see doc 03 §10), so every invite link built from the static env value was **dead on arrival** with no error surfaced anywhere. Trusting the browser's own `window.location.origin` here is safe because it only affects a link shown back to the same authenticated caller — it is **not** an authorization decision. `APP_URL` remains the fallback for non‑browser callers.

> **Gotcha:** the dead `whatsappInvite.service.js` still builds its link from the raw `process.env.APP_URL` (`whatsappInvite.service.js:77`) — the un‑fixed variant of exactly this bug. If anyone ever wires WhatsApp invite delivery up, they must route it through `resolveAppOrigin`, not re‑introduce the stale‑env link (§9).

---

## 4. The prospect's un‑authenticated journey

The prospect opens `/invite/{token}` (`frontend/src/app/invite/[token]/page.js`, `ProspectOnboardingPage`). They have **no session** — the 64‑hex token is the *only* credential.

```
GET /validate/:token ──▶ Consent gate ──accept──▶ ~39-step wizard ──▶ POST /submit ──▶ thank-you
   (public)              POST /consent           (about+lifestyle+       (multipart)     │
   flips → opened         (public)                pathology+radiology+                    ▼
                                                  27 mental)              "Delete my submitted data"
                                                                          → POST /consent {accepted:false} → erasure (§7)
```

### Public, token‑only endpoints

`invite.routes.js` splits the routes into authenticated (inviter) and **public** (prospect + webhook):

| Method | Path | Auth | Handler |
|---|---|---|---|
| GET | `/api/invite/validate/:token` | **public** | `validateToken` |
| POST | `/api/invite/consent` | **public** | `updateConsent` |
| POST | `/api/invite/submit` | **public** (multer `pathologyReport`/`radiologyReport`) | `submitQuestionnaire` |
| GET/POST | `/api/invite/webhook/whatsapp` | **public** | `handleWhatsAppWebhook` |
| POST | `/api/invite/send` | authenticateToken | `createInvite` |
| POST | `/api/invite/self-entry-consent` | authenticateToken | `logSelfEntryConsent` |
| GET | `/api/invite/status` | authenticateToken | `getInvites` |
| GET | `/api/invite/stream` | authenticateToken (SSE) | `streamInviteStatus` |
| POST | `/api/invite/revoke/:id` | authenticateToken | `revokeInvite` |
| POST | `/api/invite/run-match/:id` | authenticateToken | `runInviteMatch` |

> **Security note (carried to doc 20):** because `/consent`, `/submit`, and `/validate` are token‑only, **anyone holding the link** can accept, reject, submit, or trigger data deletion. The token is unguessable (256 bits of entropy), but it travels in a URL — it can leak via referrer headers, shared screenshots, or a forwarded message. There is no second factor.

### Multer upload config (`invite.routes.js:30‑49`)

- Disk storage in `backend/src/temp/uploads`, filename `{uuid}-{originalname}`.
- **25 MB** max (`fileSize: 25 * 1024 * 1024`).
- `application/pdf` **only** — other mimetypes are rejected with `Error('Only PDF files are allowed')`.

### Legal marriage‑age gate

The prospect's DOB step caps the date picker and blocks submit below the **Indian legal marriage age — 18 for women, 21 for men** (`invite/[token]/page.js:232`, `:482‑509`, via `utils/legalMarriageAge.js`). This is a hard client‑side gate on `handleSubmit`; the backend does not independently re‑validate age. `[interim]` — these ages are a jurisdiction assumption (India), not a configurable policy.

---

## 5. Consent as a first‑class artifact

Consent here is auditable, not just a boolean. Two tables carry it.

### `prospect_invites` consent columns (`postgres.service.js:150‑166`)

| Column | Written by | Purpose |
|---|---|---|
| `consent_timestamp` | `updateConsent` (`invite.controller.js:371`) | When the prospect decided. |
| `consent_ip` | `updateConsent` | `req.ip` (or `x-forwarded-for`) at decision. |
| `consent_user_agent` | `updateConsent` | UA string at decision. |
| `erased_after_submission` | `purgeSubmittedProspectData` (`:338`) | `TRUE` iff a post‑submission withdrawal actually deleted data (§7). |
| `mental_answers_json` (JSONB) | create/submit/background | Optional mental answers, keyed `{inviter, prospect}`; **nulled after scoring** (data minimization, §6). |

### `self_entry_consents` (`postgres.service.js:273‑283`)

`id, user_id (→ users, ON DELETE CASCADE), prospect_name, ip, user_agent, confirmed_at`. One row per self‑mode acknowledgment. `logSelfEntryConsent` always uses the **acting user's own id** — never a client‑supplied one (`invite.controller.js:171`, `:184`).

**Data minimization already implemented:** no prospect phone number is collected anymore (invites are copy‑link, so `prospect_phone`'s `NOT NULL` was dropped, `postgres.service.js:189`); mental answers are erased once scored; and a real erasure path exists. This is **partial DPDP substantiation** — see §13 for what's still missing.

---

## 6. The background match pipeline

Clicking **Run Match** on the inviter side calls `POST /api/invite/run-match/:id` with `{ inviterPathologyId }` (`add-prospect/page.js:926‑935`). Two functions do the work.

### `runInviteMatch` — the atomic anti‑double‑run guard (`invite.controller.js:866‑906`)

After a preliminary status check, it does an **atomic compare‑and‑swap**:

```sql
UPDATE prospect_invites SET status = 'processing'
WHERE id = $1 AND status IN ('questionnaire_submitted', 'failed')
RETURNING id
```

If `rowCount === 0`, it returns **409** — a double‑click, a client retry, or two racing tabs cannot both pass the plain status check and both kick off a **separately billable** background match. Only the request that actually flips the row proceeds. It then broadcasts `processing` and calls `processCompatibilityBackground(invite, inviterPathologyId)` **without awaiting it** (`:900`).

> **Fire‑and‑forget gotcha:** the HTTP response returns `200 { success: true }` immediately; the worker runs detached. **Failures never reach the HTTP response** — they only surface as an SSE `failed` event (`:644`) and a server log line (`:642`). When debugging a "match never completed", watch the SSE stream and server logs, not the run‑match response.

### `processCompatibilityBackground` — the worker (`invite.controller.js:391‑646`)

The pipeline, in order:

1. **Resolve inviter pathology.** Uses the explicit `inviterPathologyId`, else the latest **non‑mock** report from the inviter's completed matches (`:407‑416`). If none, it **throws** rather than fabricate — "your pathology report must be uploaded and completed before you can run a compatibility match" (`:418‑423`). A couple's real result must never be partly computed from invented labs.
2. **Content‑driven gender resolution** (`:431‑463`). Rather than trust profile `gender` (stale/misconfigured), it parses both reports' `extracted_json` and calls `resolveGenderRoleFromReport` → `ontologyMapper.resolveGenderRole`. If both/either resolve, it assigns male/female roles from content; otherwise it **falls back to profile gender** (`inviter.gender`). The product is structurally one‑male‑one‑female (doc 01), so this yields `maleReportId`/`femaleReportId`.
3. **Build `maleManual` / `femaleManual`** (`:478‑490`): `name`, `age` (`calculateAge`), `bmi` (computed from height/weight), `waist` (`classifyWaist`). **Deliberately omits** `bloodPressure`/`glucose`/`lipids`/`history` — `chronic.controller.js`'s `extractPatientData()` treats **any truthy manual value as an override** that beats the real category auto‑detected from the parsed report. Hard‑coding `bloodPressure:'Normal'` here would silently mask a real elevated reading. Same reasoning drops `semenQuality`/`scrotalFinding`/`ovarianReserve` from the MFR manual data (`:544‑557`).
4. **Build `sharedLifestyle`** (`:498‑514`) — see the constant table below.
5. **Run engines via mock req/res** — `chronicController.analyzeChronic` (`:539`) then `mfrController.analyzeMfr` (`:586`), invoked directly with fabricated `req`/`res` objects that capture the JSON payload. If either returns empty, it throws (`:588`).
6. **Both‑sides‑complete mental gate** (`:603‑620`): mental scoring runs **only if** `isMentalQuestionnaireComplete(stored.inviter) && isMentalQuestionnaireComplete(stored.prospect)`. A partial/missing side must not silently score as if everyone answered positively (same as "didn't opt in"). On success it computes with `cacheKey: mental_insights_${matchId}` and then **nulls `mental_answers_json`** (data minimization, `:613`).
7. **Compile** via `reportGenerationService.compileMatchReport` (`:623`) — the single source of truth for the score (doc 10). Then set `completed` + broadcast `matchId` (`:638‑639`).

#### `sharedLifestyle` construction — verbatim (`invite.controller.js:498‑514`)

All `[interim]` — house rules for collapsing two partners' lifestyle answers into the shared inputs the engines expect; none are clinically validated.

| Field | Rule |
|---|---|
| `diet` | `'Healthy'` iff **both** `drinking_habits === 'Never'`, else `'Mixed'` |
| `activity` | `'Sedentary'` if **either** is `Sedentary`, else `'Active'` |
| `smoking` | `'Never'` iff **both** not‑currently‑smoking (`Never`\|`Quit`), else `'Occasionally'` |
| `alcohol` | `'Never'` iff **both** not‑currently‑drinking (`Never`\|`Quit`), else `'Occasionally'` |
| `sleep` | `'Irregular'` if **either** `sleep_cycle === 'irregular'`, else `'Normal'` |
| `stress` | hardcoded `'Moderate'` |

> **Two subtle bug‑fixes baked in here** (`:501‑511`, don't regress them): the alcohol key was renamed from `drinking` → **`alcohol`** because `chronic.controller.js` reads `shared_lifestyle_data?.alcohol` specifically — the old key was **never read**, so the fallback never reached scoring. And the else‑value moved from the now‑dead `'Occasional'` to `'Occasionally'` to match `LIFESTYLE_LRS`.

#### MFR `shared_lifestyle` numeric mapping (`invite.controller.js:558‑566`) — `[interim]`

`smoke` `0`\|`0.5`; `bmi` `0.5` if BMI > 25 else `0`; `act` `0.5` if Sedentary else `0`; `alc` `0`\|`0.5`; `stress` `0.2`; `freq` `0.92`; `lifestyle_index` `85`. Barriers `b_tubal`/`b_azoo`/`b_uterus` all `false` (`:567‑571`).

#### `classifyWaist` thresholds (`invite.controller.js:56‑68`) — `[interim]`

| Sex | High | Borderline | Normal |
|---|---|---|---|
| male | `≥ 90` cm | `≥ 85` | else |
| female | `≥ 80` cm | `≥ 75` | else |

`calculateAge` defaults to **30** on a missing/invalid DOB (`:48‑54`).

> **JSONB double‑parse gotcha (fixed twice — do not reintroduce):** `mental_answers_json` is a JSONB column; `pg` returns it **already parsed**. Calling `JSON.parse` on it throws, and the surrounding `catch` **silently discarded a whole side's answers**. It was fixed in both `submitQuestionnaire`'s merge (`:822`) and this worker's mental gate (`:606`). Never `JSON.parse` that column again.

---

## 7. Post‑submission data withdrawal / erasure

Rejecting consent **after** submission is semantically different from declining up front — the prospect is asking for what they already gave to be **taken back**. Both land on `consent_rejected`, but only the post‑submission case actually deletes data.

`updateConsent` (`invite.controller.js:346‑386`) detects `alreadySubmitted = status ∈ {questionnaire_submitted, processing}` (`:362`). If `!accepted && alreadySubmitted`, it calls `purgeSubmittedProspectData(invite)` **before** stamping the status.

### `purgeSubmittedProspectData` — hard‑delete cascade (`invite.controller.js:325‑341`)

```
if pathology_report_id:  DELETE FROM chat_sessions WHERE report_id=$1 OR partner_report_id=$1
                         DELETE FROM reports WHERE id=$1
if radiology_report_id:  DELETE FROM radiology_reports WHERE id=$1
if prospect_user_id:     DELETE FROM users WHERE id=$1        (nulls prospect_user_id via SET NULL FK)
always:                  UPDATE prospect_invites SET pathology_report_id=NULL,
                                radiology_report_id=NULL, mental_answers_json=NULL,
                                erased_after_submission=TRUE
```

This is a **real** hard delete, not a status flip — so the prospect's post‑delete confirmation ("Your data has been permanently removed", `invite/[token]/page.js:334`) is true, not a false positive. It mirrors the account‑holder cascade in `auth.controller.js`'s `deleteAccount`.

> **Why some deletes are manual:** `reports` has **no `user_id` column** (ownership is via `matches.male/female_report_id`), and `chat_sessions` have no FK back to a prospect, so those rows must be deleted explicitly here — a plain `DELETE FROM users` would not cascade to them. Note also that the prospect's **`radiology_reports.user_id` holds the INVITER's id**, not the prospect's (`invite.controller.js:782`, `:814`) — deletion here is keyed on `radiology_report_id`, not `user_id`, precisely because of that. Keep this in mind for any account‑deletion cascade work (doc 05).

The inviter's UI reads `erased_after_submission` back through the `consent_rejected` broadcast (`:379`) so it can show "their submitted data was erased" instead of the misleading "nothing was shared" (**UX8‑03**, now fixed).

---

## 8. The WhatsApp OTP delivery layer

This is the **only live WhatsApp send path** in the product. It carries login OTPs, nothing else.

### Provider abstraction

```
auth.controller.loginUser (auth.controller.js:42)
   └▶ notificationService.sendOTP(cleanPhone, otp, {correlationId})   (notification.service.js:14)
        └▶ new WhatsAppProvider().sendOTP(...)                        (whatsapp.provider.js:22)
             └▶ POST graph.facebook.com/v22.0/{phoneNumberId}/messages
             └▶ messageLog.logOutbound({...redacted...})              (whatsappMessageLog.service.js:4)
```

`notification.provider.js` defines an abstract base whose **only** contract method is `sendOTP` (`:9`) — there is deliberately no `sendInvite` in the contract, underscoring that invite delivery was never wired into this abstraction. `notification.service.js` is hardwired to `WhatsAppProvider`; the "pluggable provider" comment is aspirational.

### Template shape & constants (`whatsapp.provider.js`) — all `[interim]` house defaults

| Thing | Value | Line |
|---|---|---|
| Endpoint | `graph.facebook.com/**v22.0**/{phoneNumberId}/messages` | `:31` |
| OTP template | `WHATSAPP_TEMPLATE_NAME` → default `slay_otp_authentication` | `:11` |
| Language | `en_US` | `:41` |
| Body params | `[otp, supportNumber]` | `:45‑55` |
| Button (URL sub_type) param | `[otp]` (index `0`) | `:57‑67` |
| Support number | `WHATSAPP_SUPPORT_NUMBER` → default `+91 92172 46727` | `:12` |

### OTP redaction before logging

Before the outbound row is written, **every text parameter is rewritten to `'[redacted]'`** in a deep copy of the payload (`whatsapp.provider.js:88‑99`), so the live OTP never lingers in the `whatsapp_messages.raw_payload` table past its ~5‑minute validity. Preserve this if you touch the send path. The provider **throws** (not returns `false`) when creds are missing or the API errors (`:28`, `:107`).

> When `WHATSAPP_ACCESS_TOKEN`/`_PHONE_NUMBER_ID` are unset the send throws — see doc 04/19 for the dev local‑login workarounds (OTP printed to logs / direct session mint).

---

## 9. DEAD CODE: `whatsappInvite.service.js`

`backend/src/services/notification/whatsappInvite.service.js` is a fully‑built WhatsApp **invite‑link** sender (`sendInvite(to, prospectName, inviterName, inviteToken)`, default template `slay_prospect_invite`, `language en`) with **zero callers anywhere in the codebase.** Invites are shared as **manually‑copied links** (`navigator.clipboard` / `navigator.share` in `add-prospect/page.js`) — no WhatsApp send ever happens on the invite path.

Consequences a new dev must internalize:

- **No invite ever gets a `whatsapp_message_id`.** The column exists (`prospect_invites.whatsapp_message_id`, indexed at `postgres.service.js:219`) but is never populated on the invite path.
- **The webhook's invite‑status mapping branch is therefore unreachable** for invites: it looks up an invite by `whatsapp_message_id` (`invite.controller.js:970`) that no invite has, so `delivered`/`opened`/`failed` transitions from WhatsApp **never fire for invites**. This is why the `delivered` status (§2) is effectively dead.
- The service **still hardcodes the stale `process.env.APP_URL`** link (`whatsappInvite.service.js:77`) — the un‑fixed dead‑link bug. If invite delivery is ever revived, route it through `resolveAppOrigin` (§3).

Do **not** build new invite features assuming a WhatsApp send occurs. Either wire this service up properly (through the provider abstraction, with `resolveAppOrigin`, writing back `whatsapp_message_id`) or delete it — right now it is a trap.

---

## 10. The webhook handler

`handleWhatsAppWebhook` (`invite.controller.js:934‑1019`) is **public** and handles both verbs:

- **GET (verify challenge):** Meta's subscription handshake. Checks `hub.mode === 'subscribe'` and `hub.verify_token === WHATSAPP_WEBHOOK_VERIFY_TOKEN` (default `slayhealth_webhook_verify_token`, `:944`), echoes `hub.challenge` on success, else 403 (`:939‑955`).
- **POST — `statuses`:** updates `whatsapp_messages.status` via `updateStatusByWaMessageId` (`:967`), then attempts the (dead‑for‑invites) invite‑status mapping (`:970‑988`).
- **POST — `messages`:** logs **inbound** replies via `logInbound` (`:995‑1011`). These were previously received and **silently dropped** (only `statuses` was handled), so nothing sent to the business number was visible anywhere. Nothing acts on the content — it is purely for the admin board.

> **No HMAC / signature verification.** The handler does **not** validate Meta's `X-Hub-Signature-256`. The GET verify token is the only gate, and POSTs are unauthenticated beyond being well‑formed. Anyone who knows the URL can POST fabricated status/message events. Flagged to doc 20. There is also **no WhatsApp "history" API** — the log is populated **going forward only**.

---

## 11. The admin WhatsApp message board

A read‑only board of all logged WhatsApp traffic.

| Layer | File | Notes |
|---|---|---|
| Route | `backend/src/routes/admin.routes.js:8` | `GET /whatsapp/messages` → `authenticateToken` → `requireAdmin` → `listWhatsAppMessages` |
| Gate | `backend/src/middleware/admin.middleware.js:7` | `requireAdmin`: `req.user.phone` must be in the `ADMIN_PHONE_NUMBERS` CSV allowlist. **No role system on users** — admin is purely this env allowlist. Must run **after** `authenticateToken`. |
| Controller | `backend/src/controllers/admin.controller.js:4` | Passes `{ phone, before, limit=50 }` to `listMessages`. |
| Query | `whatsappMessageLog.service.js:41` | Phone filter is `ILIKE '%phone%'`; limit capped at `min(limit, 200)`; ordered `created_at DESC`. Writes swallow errors so logging never blocks a send. |
| UI | `frontend/src/app/admin/whatsapp/page.js` | Inbound/outbound rows, status pills, phone filter, **10s auto‑refresh** (`:68`). |

> **The client‑side gate is cosmetic.** The page only checks for a `localStorage 'slayhealth_user'` presence before rendering (`admin/whatsapp/page.js:57‑63`) — that is not security, just a redirect convenience. The **real** gate is the server‑side `requireAdmin` returning 403, which the page catches to show a "forbidden" screen (`:43‑46`, `:72`). Because only OTP sends are logged outbound (invite sends are dead, §9), the board today shows **OTP outbound + inbound replies + status transitions only**, all captured since the board shipped.

---

## 12. Real‑time delivery to the inviter

The account‑holder page keeps a live view of the invite via **SSE plus a polling fallback**.

- **SSE:** `GET /api/invite/stream` (`streamInviteStatus`, `invite.controller.js:198‑240`). On connect it pushes the latest status immediately (race‑guard), then streams `invite_update` events. The frontend opens an `EventSource` (`add-prospect/page.js:728`) and, on a `completed` event, loads the match and routes to `/core-engine/story` after a 2.5s beat (`:746‑751`).
- **Polling fallback:** every 3s the page also `GET /api/invite/status` and reconciles (`add-prospect/page.js`, `getInvites` → returns the user's latest 20 invites).
- **Broadcast mechanism:** `broadcastInviteUpdate(userId, ...)` (`invite.controller.js:91‑99`) writes to every `res` in an **in‑process `Map`** `activeConnections` keyed by `userId` (`:86`).

> **Single‑instance limitation:** `activeConnections` is an in‑memory Map — there is **no Redis pub/sub or shared bus**. Under multiple backend instances (or a future horizontal scale on Render), an SSE client connected to instance A will **never receive** a broadcast emitted on instance B; the match completes but that inviter's stream stays silent (the 3s polling fallback is what saves them today). Any move beyond one backend process must add a shared pub/sub, or the SSE layer becomes a correctness bug, not just a nicety.

---

## 13. Open compliance / UX debt

Pointers only — doc 21 is the authoritative ledger. The corpus lives at repo‑root `REG-06_DPDP_SUBSTANTIATION_AUDIT.md`.

| ID | Status | The gap |
|---|---|---|
| **UX8‑02** | open | Trust copy tells the prospect their data "stays private to the two of you," but the invite page's **only** post‑submission state is a static thank‑you (`invite/[token]/page.js:345‑360`) — the prospect **never sees the compiled report**. A false‑privacy / one‑sided‑value promise. |
| **UX8‑04** | **verified open** | The mental section's "Skip this section" (`mentalSteps[0].onSkip = handleSubmit`), the radiology step's `onSkip`, and the pink final‑Submit **`nextVariant`** are all set on the step objects (`invite/[token]/page.js:578`, `:626‑631`) but the `<QuestionScreen>` render **never forwards `onSkip`/`skipLabel`/`nextVariant`** (`:661‑676`). `QuestionScreen` *supports* them — the add‑prospect page wires them correctly. Net effect: once in the mental section, a prospect must answer **all 27 questions** to submit. Fix = thread those three props through the render call. |
| **UX8‑06** | open | No UI moment tells the account holder (self mode) they are controlling a **third party's** sensitive health data. The consent is logged (`self_entry_consents`) but never surfaced. |
| **UX8‑11** | open | The ~39‑step one‑sitting questionnaire (6 about + lifestyle + pathology + radiology + 27 mental) under social pressure. Mitigated cross‑reload by `localStorage` (`slayhealth_invite_progress_{token}`) but **not cross‑device**; compounded by UX8‑04. |
| **REG‑01 / REG‑06** | open (**REG posture is an open risk**) | An unqualified present‑tense **"DPDP‑compliant"** claim shown to users, with no privacy policy, consent‑manager, or retention config behind it. The `prospect_invites` consent audit trail + `self_entry_consents` + the withdrawal/erasure path are **partial** substantiation only. These docs state this **factually** and take no wellness‑vs‑SaMD position — coordinate any compliance‑copy change with legal. |

---

## Open items (see doc 21 for the authoritative list)

- **UX8‑04** (unwired skip / mandatory 27‑question mental section) is the highest‑leverage code fix here: forward `onSkip`/`skipLabel`/`nextVariant` to `<QuestionScreen>` in `invite/[token]/page.js`.
- **Dead WhatsApp invite delivery** (`whatsappInvite.service.js`): decide to wire it up (through the provider abstraction + `resolveAppOrigin`, writing back `whatsapp_message_id`) or delete it. Until then `delivered` is a phantom transition and the webhook invite branch is unreachable.
- **SSE single‑instance** (`activeConnections` Map): needs shared pub/sub before the backend scales past one process.
- **Webhook has no signature/HMAC verification** and the public token‑only `/consent`/`/submit`/`/validate` surface — both to doc 20.
- **REG‑01/REG‑06 DPDP** claim is unsubstantiated; the consent tables are partial evidence only. Open regulatory risk pending your/legal decision.

---

*Next: `13_pdf_report_generation.md` — the pdfkit downloadable report (and the divergent AI‑PDF) the completed match feeds into.*
