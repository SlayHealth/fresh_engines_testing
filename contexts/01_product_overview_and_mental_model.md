# Product Overview & Core Mental Model

**Doc 01 of 22** · Audience: a solo full‑stack successor · Prerequisite: `00_index.md`.

This doc gives you the *shape* of the product and the two non‑negotiable structural facts that every later doc assumes. Read it before any code doc — several things in the codebase only make sense once you hold these in your head.

---

## 1. What the product does

SlayHealth helps a **couple considering marriage** understand their combined health picture. The journey:

1. A person signs up (phone + WhatsApp OTP — no passwords) and fills in **their own** profile: basics (gender, DOB, city), body metrics (height/weight/waist), lifestyle (activity, drinking, smoking, sleep, family history), an optional 27‑question mental‑wellbeing questionnaire, and uploads of their **pathology** (bloodwork) and optionally **radiology** (scans) reports.
2. They **add a partner** ("prospect"), via one of two journeys (see §3).
3. Once both people have the required inputs, they press **"Generate Insights."** The backend runs the clinical engines and produces one **couple‑level compatibility result**.
4. They land on the **report** — a mobile‑first "Premarital Sync" experience with a headline score, per‑domain tabs, an **AI chat assistant** that answers questions grounded in their real data, and a downloadable **PDF**.

The end goal is a single trustworthy headline plus enough per‑domain detail that a couple can have an informed conversation (and know when to see a real doctor).

---

## 2. The five clinical domains

Everything the product measures rolls up from five domains. You'll meet each in depth later; here's the conceptual map and where each is scored.

| Domain | What it assesses | Weight in the headline | Deep doc |
|---|---|---|---|
| **Chronic / cardiometabolic** | Diabetes & metabolic risk (IDRS + bloodwork: HbA1c, lipids, BP, kidney/liver markers) | 35% | 07 |
| **Fertility (MFR)** | Conception likelihood & fertility timeline (semen quality, ovarian reserve, age curves, barriers) | 25% | 07 |
| **Mental wellbeing** | Relationship readiness across 6 pillars (mood, personality, attachment, life goals, family, habits) | 20% | 08 |
| **Radiology** | Organ‑level findings from scans (USG, echo, DEXA, etc.) | 10% | 06 (extraction), 09 (scoring) |
| **Genetics (thalassemia)** | Carrier‑pair risk from HbA2 | 10% | 09 |

Two of these domains have hard **safety gates** that can override the weighted average:

- **STI safety gate** — if either partner's serology screens **positive** for syphilis / HIV / hepatitis B / hepatitis C, the couple score is capped at **≤ 50**, un‑bypassably. (Doc 09.)
- **Both‑carrier genetics** — if both partners are confirmed thalassemia carriers, the score is additionally capped. (Doc 09.)

The weighting, renormalization over "present" domains, and the gates all live in **one function** (`computeGatedComposite`) — see doc 10. This is the "one source of truth" rule from doc 00.

> **Domain weights are the canonical property of doc 09.** They're repeated here for the mental model only; if they ever change, they change in `reportGeneration.service.js` and doc 09 — not here.

---

## 3. Structural fact #1 — the asymmetric single‑account model

There is **one account holder** and a **placeholder partner** ("prospect"). The partner is *not* a full separate account — they're a record attached to the account holder's session. This asymmetry is everywhere in the frontend (doc 14, doc 15), so internalize it now:

- The account holder has a real user row, a session, and a health profile.
- The partner is captured in one of **two journeys**:
  - **Self‑entry** ("I'll enter their details myself") — the account holder fills in the partner's data on their behalf. Because they're answering *about* someone else, the questionnaire copy switches to **third person** ("How does *Priya* feel about…?", "*Priya's* Gender") — this journey‑aware copy is a real, wired feature (doc 15).
  - **Invite** ("Generate a link to send them") — the partner opens a tokenized link (`/invite/[token]`) and fills in **their own** details, where first/second‑person copy is correct. This path has its own consent + state machine (doc 12).
- Draft state is namespaced per account‑holder user id (`slayhealth_profile_draft_<uid>`) and **survives logout** so in‑progress work isn't lost (doc 14).

**Why it matters:** a lot of "why is there a self version and a prospect version of this?" in the frontend traces back to this one‑holder‑plus‑placeholder model. When you see `onboardingForm` vs `prospectForm`, or `selfMentalAnswers` vs `prospectMentalAnswers`, this is why.

---

## 4. Structural fact #2 — the product is one‑male‑one‑female

This is the single most consequential architectural assumption in the codebase. **It is structural, not incidental — you cannot add same‑sex support with a small tweak.**

Concretely, everything downstream is keyed to *exactly one male and one female*:

- The `matches` table has **`male_report_id`** and **`female_report_id`** columns (doc 05).
- The frontend derives `isUserMale = user.gender?.toLowerCase() === 'male'` and uses it to slot the two uploaded reports into the male/female positions (`CompatibilityContext.handleCompatibilityMatch`, doc 10). The partner's gender is **pre‑filled as the opposite** of the account holder's.
- The engines are **sex‑specific**: MFR needs a *female* ovarian reserve and a *male* semen quality; chronic risk uses sex‑specific cutoffs; the body‑health / carrier‑pair / STI logic reads `male_data` vs `female_data`.
- On reopening a saved match, `restoreMatchSession` sets the prospect's gender to the *mirror* of the account holder's, unconditionally.

**Failure mode if ignored:** two same‑gender uploads would collide into one slot and leave the other empty, breaking scoring. If same‑sex / non‑binary support is ever on the roadmap, it's a data‑model + engine change, documented as such in doc 21's roadmap.

*(This document takes no position on whether one‑male‑one‑female is a permanent product decision or a limitation — that's a product call. It's documented here as the current, load‑bearing reality.)*

---

## 5. The product surfaces — what's done, what isn't

There are three tiers of UI maturity. Knowing which tier a screen is in tells you whether you're maintaining, finishing, or deleting it.

| Tier | Surfaces | Status | Doc |
|---|---|---|---|
| **Complete (reference)** | Mobile dashboard + the "Premarital Sync" report under `app/core-engine/*`; the onboarding wizard; the landing page | **Done — the locked design reference** | 15, 16 |
| **Needs work** | The desktop/web rendering of the report & dashboard; responsive reconciliation to the mobile reference | **Backlog** | 17 |
| **Legacy / orphaned** | Standalone `app/chronic`, `app/mfr`, `app/usg` pages and the `app/db` table editor | Superseded by `core-engine/*`; **decision: re‑home `/db` behind admin auth, delete the duplicate engine pages** | 17 |

**The mobile report is the source of truth for what the product should look and feel like.** When doc 17 talks about "reconcile web to mobile," this table is what it means.

---

## 6. Glossary of product terms

You'll see these words in code, UI, and these docs:

- **Prospect / partner** — the account holder's other half; a placeholder record, not a full account (§3).
- **Generate Insights** — the button/flow that runs the engines and produces the match (doc 10).
- **Match** — one persisted couple result (a `matches` row: score, per‑domain analysis, presentation, narrative). Doc 05, doc 10.
- **Premarital Sync** — the branded name of the mobile report experience (doc 16).
- **NuptiaScore / compatibility score** — the single 0–100 couple headline (stored 0–1 in the DB; doc 09/10 explain the scale hazards).
- **Confidence** — a *separate* meter from the compatibility score: how complete the inputs are (more reports → higher confidence), shown as the weighted gauge on the dashboard (doc 16) and `report_confidence` in the presentation (doc 09).
- **Domain** — one of the five clinical areas (§2).
- **The gate / STI gate** — the safety cap that overrides the weighted score (§2, doc 09).
- **Self‑entry vs invite** — the two partner journeys (§3).
- **Report id vs match id** — a *report* is one uploaded/parsed lab or scan; a *match* is the couple result built from two reports. Don't conflate them (doc 05 covers the `id` vs `report_id` trap).

---

## 7. Framing & posture (informational, not a diagnosis)

Per the handoff decision, these docs treat the product's regulatory positioning as an **open risk**, not a settled fact:

- The engines emit **diagnostic‑grade outputs** (conception probability, "reactive" STI status, carrier risk) and the report/PDF/LLM layers have at times framed the product as clinician‑verified.
- The **REG‑06 audit** (`REG-06_DPDP_SUBSTANTIATION_AUDIT.md`) found the "DPDP‑compliant" and "Doctor Verified" style claims **largely unsubstantiated**, and a recent fix already removed a false "DPDP‑compliant" line from the dashboard and added an "informational, not a diagnosis" disclaimer in places.
- These docs **do not assert** a wellness‑vs‑SaMD (Software as a Medical Device) positioning — that's a product/legal decision. They flag every place the code or copy makes a clinical claim so you can align it once the positioning is set (doc 21).

Practical rule for now: when you touch report/PDF/LLM copy, **don't add clinical authority the product hasn't earned** (no "verified by doctors," no "compliant with X") — and keep the "confirm results with a qualified doctor" disclaimer intact.

---

## Open items (see doc 21 for the authoritative list)

- Same‑sex / non‑binary couples have no representation — permanent constraint vs roadmap item is a product decision (§4).
- Regulatory positioning is unresolved; REG‑06 claims remain to be reconciled (§7).
- The legacy standalone engine pages and `/db` editor await the decided cleanup (re‑home `/db` behind admin auth, delete the duplicates — §5, doc 17).

---

*Next: `03_setup_deployment_and_environment.md` — get the app running locally, then understand how it's deployed. (Doc 02 is the backend architecture; the reading order does 03 before 02 so you have a running app first.)*
