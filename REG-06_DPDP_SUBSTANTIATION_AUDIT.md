# REG-06 — DPDP Substantiation Audit (internal, not for publication)

**Purpose:** REG-06 found no visible substantiation behind the app's DPDP-compliance framing.
Per the review's own instruction, this is *not* a compliance plan and *not* new user-facing
copy — it is a factual, code-grounded inventory of what already exists vs. what's missing
against the DPDP Act 2023 / DPDP Rules 2025's seven principles, so whoever owns the actual
compliance work (product + counsel) isn't starting from zero. **Do not publish any of this
to users without legal review** — describing what code does today is not the same as a
legally binding compliance representation.

**Method:** every claim below is either a direct code citation or an explicit "not found."
Nothing here is invented.

---

## 1. Valid, informed, itemised consent

- **Invited partner**: a real, itemised consent screen exists —
  `frontend/src/app/invite/[token]/page.js:299-336` — naming the inviter, what's collected
  (clinical details, lifestyle habits, pathology/radiology PDFs), and how it's used
  (biomarker extraction, compatibility matching). Acceptance/rejection is recorded with
  timestamp + IP + user-agent (`backend/src/controllers/invite.controller.js:280-291`,
  `prospect_invites.consent_timestamp/consent_ip/consent_user_agent`).
- **Gap**: the notice states you can withdraw "at any time before clicking Submit Form" —
  there is no visible post-submission withdrawal path for the partner (see §3 rights, below).
- **Account holder (inviter)**: no equivalent itemised consent/data-handling notice found at
  signup (`frontend/src/app/onboarding`) or first data entry (`frontend/src/app/add-prospect`).
  The inviter enters their own clinical data with no comparable disclosure screen.

## 2. Purpose limitation & data minimisation

- Not separately evidenced. The invite consent notice states a purpose (compatibility
  matching); no code enforces that data collected for one purpose isn't reused for another
  (e.g. AI narrative generation, LLM extraction calls to third-party providers — OpenRouter/
  OCR.space — aren't disclosed to either party in the consent copy).

## 3. Data-principal rights (access, correction, erasure, grievance, nomination)

- **Erasure — account holder**: a real, working endpoint exists —
  `DELETE /api/auth/account` → `backend/src/controllers/auth.controller.js:393-430`. It
  deletes the user's own `reports`, `chat_sessions` tied to those reports, and the `users`
  row itself; `matches`/`prospect_invites` rows cascade-delete via
  `ON DELETE CASCADE` foreign keys (`backend/src/services/storage/postgres.service.js:56-65,
  150-165`). This is genuine, non-trivial erasure machinery already in place for the account
  holder.
- **Erasure — invited partner: a real gap.** The partner is a placeholder `users` row (no
  login), referenced by `prospect_invites.prospect_user_id` with `ON DELETE SET NULL` — so
  when an account holder deletes their own account, the partner's placeholder row (name,
  DOB, gender, and whatever manual data/reports they submitted) is **not** deleted; it
  becomes orphaned rather than erased. The partner also has no account of their own, so they
  have no self-service path to request deletion at all — the only lever they had was
  declining consent *before* submission.
- **Access/correction**: `GET /api/auth/profile` and `updateProfile` exist for the account
  holder's own fields (`auth.controller.js`); no equivalent for the invited partner's
  submitted data, and no access/correction path for either party into the compiled
  `matches.analysis_json`/`presentation_json` beyond viewing the report itself.
- **Grievance redressal / nomination**: not found.

## 4. Storage limitation / retention

- No general retention policy or scheduled deletion job found.
- Narrow, real exceptions exist: OTP requests expire (`otp_requests.expires_at`,
  `backend/src/services/auth/otp.service.js:129,158`), invite tokens expire
  (`prospect_invites.expires_at`, `invite.controller.js:222,559`), and LLM extraction
  results are cached with a 30-day Redis/JSON TTL (`backend/src/services/llm.service.js:68,
  134`) — but these are functional caches/token lifetimes, not a data-retention policy for
  health records, matches, or reports, which persist indefinitely until the account-holder-
  initiated deletion above.

## 5. Security safeguards

- Out of this audit's scope (not re-assessed here); the deep review's auth/JWT findings
  (WS8-02: engines correctly auth-gated) are the closest existing evidence and are positive.

## 6. Personal-data-breach notification

- Not found. No breach-detection, notification template, or Board/principal notification
  mechanism exists in the repo.

## 7. Children's data / verifiable parental consent

- Relevant because the landing page's "Concerned Parents" persona
  (`frontend/src/constants/landingContent.js:209-219`) markets sharing data about a
  prospective match/"your child." No age-gate, verifiable-parental-consent flow, or
  minor-specific handling was found anywhere in the signup or invite flows.

---

## What this actually substantiates

- Two principles have **real, working, non-trivial code**: informed consent for the invited
  partner (§1), and erasure for the account holder (§3) — these are genuine, citable
  building blocks, not vapourware.
- One **specific, well-defined gap** stands out above the rest: the invited partner —
  the *other* data principal in every match, and the one whose health data is often the
  more sensitive side of the report — has no erasure path and no path to control their own
  data after the one-time submission-time consent. This is the single most concrete,
  fixable finding in this audit and is worth prioritizing over the broader "build a full
  DPDP program" scope.
- Retention, breach-notification, purpose-limitation enforcement, grievance redressal, and
  children's-data handling are genuinely unbuilt — consistent with the review's own
  characterization, not worse or better than expected.

## Recommended next step

Do not turn this into user-facing copy. The one item worth a product decision soon (not
gated on full legal sign-off) is the partner-erasure gap in §3 — closing it doesn't require
new legal positioning, just a real deletion path for the partner's placeholder data. Everything
else here should wait for counsel to scope against the DPDP Rules 2025 phase-in schedule
(through 2027-05-13) before any implementation or claim is made.
