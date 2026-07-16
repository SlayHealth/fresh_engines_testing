# SlayHealth — Frontend UX / UI / Flow Review

**Type:** Review-and-document pass (NO production code modified). **Date:** 2026-07-15.
**Method:** the real app was driven in a headless browser at mobile (390×844) and desktop (1440×900)
across every flow, against five disposable seeded couples (clean / STI-capped / severe-findings /
partial / empty). Screenshots back every "Observed" claim (in `backend/scratch/ux_shots/`, gitignored).
Contrast was measured on rendered pixels, not eyeballed. Engine/medical correctness is NOT re-diagnosed
here — where a known bug has a UX manifestation, the existing ID from `SLAYHEALTH_DEEP_REVIEW.md` is
referenced and only the experience angle is written up.

**Governing design rule:** the **mobile UI is the locked design reference.** Every mobile↔desktop
divergence is logged as a one-directional *"reconcile desktop to mobile"* item; mobile is never treated
as wrong for differing, and is never restyled to taste — but mobile IS still in scope for substantive
defects (accessibility, comprehension, states, copy, flows).

This master doc is the **spine**: finding #0, executive summary, prioritized roadmap, journey maps,
cross-cutting themes, opportunity index, links. Full per-workstream detail lives in `review/ux_WS*.md`.

> **Severity:** **P0** blocks a core flow / actively erodes trust in a health context / a11y barrier
> excluding users from a critical action · **P1** major friction or confusion likely to cause drop-off
> or sensitive-result misunderstanding · **P2** notable rough edge / inconsistency / comprehension gap ·
> **P3** polish. **OPP** = opportunity (★ if it also fixes a defect).

---

## Finding #0 — The account / pairing model (foundational; frames everything)

**SlayHealth is an asymmetric single-account product, not a two-account couple app.** Confirmed from
code + the live invite flow:

- **One person owns the account** (the "inviter" / account holder). They onboard with phone+OTP and a
  name (`frontend/src/app/onboarding`), then create a "prospect."
- **The partner is a placeholder row, not a login.** `createInvite`
  (`backend/src/controllers/invite.controller.js:95-104`) inserts a `users` row with a **synthetic
  phone** `invite-<inviteId>` and no auth — `prospect_user_id` is a shadow record
  (`postgres.service.js:153`, `ON DELETE SET NULL`). The partner never gets an account, password, or
  login.
- **Two ways the partner's data arrives:** (a) the account holder enters it themselves in add-prospect,
  or (b) they generate a tokenized link `/invite/:token` and send it manually; the partner opens it
  **unauthenticated** (`invite.routes.js:58-60` — `validateToken`/`consent`/`submit` are NOT behind
  `authenticateToken`), gives an explicit **consent accept/reject** (`consent_accepted` /
  `consent_rejected`, with timestamp+IP+user-agent captured, `invite.controller.js:262-291`), and
  submits their own details + PDF reports.
- **Only the account holder sees the report.** The compiled "Partner Sync" report renders on the
  inviter's dashboard/`core-engine`. There is **no partner-facing view** of the finished report, and no
  partner control over it after the one-time consent at submission.

**Why this frames the whole review:** the brief's premise — "two autonomous people each with a right to
control their own information, reading the report together" — is **only half-realized**. Consent exists
but is **one-time and coarse** (accept-all / reject-all at submission; no per-section control, no
retraction, no partner view). The "together" moment is **one device, the account holder's** — so the
sensitive-data presentation (STI cap, carrier status) is shown by the account holder to the partner, not
independently controlled by the person whose result it is. This is the single most important lens for
WS3 (report) and WS8 (consent/trust), and several P0/P1 findings below trace back to it. See
[`review/ux_WS8_trust_consent.md`](review/ux_WS8_trust_consent.md).

**Report-UI note (do not mis-file):** the `core-engine/story` report renders the **desktop "Premarital
Sync" narrative on all viewports** (ring KPI + tab shell + timeline slider), NOT the mobile score-bar
design language. This is a **deliberate, explicit product decision** made earlier (the mobile analysis
view was intentionally removed in favour of the previous report UI) — it is therefore **NOT a
"reconcile desktop to mobile" defect** and must not be filed as one. The report is still fully in scope
for comprehension / emotional-design / sensitive-data / a11y findings on its own terms.

---

## Executive summary

_(assembled after workstreams land — see roadmap below)_

---

## Prioritized roadmap

_(assembled from workstream files)_

---

## Journey maps

_(from WS1 — see [`review/ux_WS1_flows.md`](review/ux_WS1_flows.md))_

---

## Cross-cutting themes

_(assembled after workstreams)_

---

## Workstream files

- [`review/ux_WS1_flows.md`](review/ux_WS1_flows.md) — journey mapping (landing→signup→OTP→pairing→add-prospect→upload→wait→report→return).
- [`review/ux_WS2_ia_nav.md`](review/ux_WS2_ia_nav.md) — information architecture & navigation.
- [`review/ux_WS3_report.md`](review/ux_WS3_report.md) — the report experience (comprehension & emotional design).
- [`review/ux_WS4_visual.md`](review/ux_WS4_visual.md) — visual design system & consistency.
- [`review/ux_WS5_responsive.md`](review/ux_WS5_responsive.md) — responsive / mobile-reference audit + desktop reconciliation.
- [`review/ux_WS6_a11y.md`](review/ux_WS6_a11y.md) — accessibility (WCAG 2.x AA, measured contrast).
- [`review/ux_WS7_states.md`](review/ux_WS7_states.md) — states, feedback & error UX.
- [`review/ux_WS8_trust_consent.md`](review/ux_WS8_trust_consent.md) — trust, privacy & consent UX.
- [`review/ux_WS9_copy.md`](review/ux_WS9_copy.md) — copy, microcopy & tone.
- [`review/ux_WS10_perf.md`](review/ux_WS10_perf.md) — performance & perceived performance.
- [`review/ux_WS11_funnel.md`](review/ux_WS11_funnel.md) — friction & drop-off inventory (synthesis).
- [`review/ux_WS12_ideation.md`](review/ux_WS12_ideation.md) — redesign & enhancement opportunities.

---

## Opportunity index

_(assembled from WS12 + enhancement ideas across workstreams)_

---

## Appendix — screenshots & scripts

_(assembled at the end; all under `backend/scratch/`, gitignored)_
