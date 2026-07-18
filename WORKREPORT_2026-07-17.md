# SlayHealth — Work Report, 2026-07-17

**Scope:** Eleven separate items, all committed today: eight UX/product bug reports submitted
in Observation/Recommendation/Why format, a paired Lifestyle & Habits feature addition that
surfaced and fixed two independent, previously-undetected production scoring bugs along the way,
and a full v2.0 rewrite of the mental wellbeing questionnaire and scoring engine against an
external psychologist-reviewed spec.

**Method:** unchanged from previous days — every fix verified against real behavior, not just
read as code. Live browser sessions against seeded couples/throwaway users, direct
controller/service invocation (`computeMentalResult`, `analyzeChronic`) with real seeded report
IDs to confirm actual score movement, DOM/`getComputedStyle` checks where a visual state was the
point, and the backend regression suite run after every backend-touching change. Two genuine
product/terminology judgment calls (Health Profile module order vs. the PRD; replacing
"Prospect" with a less transactional term) were surfaced to the user for a decision rather than
picked unilaterally. Every commit is authored solely as `Pranav-Singh-Devloper
<pranavsinghprimo@gmail.com>` — no co-author trailers.

---

## Headline result

| Strand | Items | Fixed today |
|---|---|---|
| UX/product bug reports (Observation/Recommendation/Why) | 8 | **8** |
| Lifestyle & Habits options + scoring-engine fixes | 2 | **2** |
| Mental wellbeing engine v2.0 (spec-driven rewrite, 21→27 items) | 1 | **1** |

The lifestyle work is the day's most consequential finding: two independent, compounding bugs
meant alcohol and smoking answers were **silently contributing nothing to chronic risk scoring in
production**, regardless of what a user actually selected — found while investigating an
unrelated "add an option" request, not from a report about scoring itself.

---

## 1. UX/product bug reports (8 commits)

| Commit | Report | What was wrong | Fix |
|---|---|---|---|
| `8525249` | Bottom nav visible before authentication | The nav's own gate correctly hid it through login/signup, but two routes meant to read as "outside the authenticated app" — the public landing page and an invite link opened by the invited partner — weren't excluded, so an already-logged-in browser leaked authenticated nav onto both | Added `/` and `/invite/*` to the existing exclusion list alongside `/add-prospect` |
| `57d8383` | Stray "." before the approximate sign | A `" · "` separator was glued directly onto `~`/`≈` durations in two places ("...context · ≈1 min"), reading as a stray dot in front of the glyph | Dropped the separator, kept the leading space, in both `MobileSectionList` and `MentalSubHub` |
| `eb996f6` | "About You" completion ring stays red after finishing | Each section's ring/bar was colored by its fixed brand-identity hue at every completion level — About You's magenta read as an error state even at 100% | Decoupled the two concerns: the icon tile keeps its identity color, the ring/bar now derive color from completion state (amber in-progress, green done) |
| `8c8a63c` | Health Profile order doesn't match PRD | `add-prospect/page.js` rendered Mental Wellbeing 5th; the PRD and `dashboard/page.js`'s own list both specify 3rd | User chose "align to PRD" via `AskUserQuestion`; reordered to About → Lifestyle → Mental → Pathology → Radiology → Genomics |
| `e769cf4` | "How did you meet?" asked too early | Fired inside the individual About You wizard, before any partner existed — assumed a partner even for a user just exploring | Moved (with its conditional platform follow-up) into the "Add Your Prospect" routing flow, right after the partner's name is entered; fixed a resulting stuck-at-99% bug in `aboutCounts`/`aboutProgress` |
| `f107f95` | Prospects are not auto-saved | Answers already persisted, but *where in the wizard* the user was (person/category/step) was plain component state — Back or a reload dumped the user back on their own hub with no trace they'd started | Added a wizard-position draft mirroring the existing radiology-upload draft pattern, namespaced per user, rehydrated on mount |
| `1924d0a` | Poor discoverability of saved prospects | Nothing on Home told a returning user a draft existed | Added a "Continue Your Last Draft / Partner: [name] / [N]% Complete" resume banner to both mobile and desktop Home, using the existing weighted-confidence formula; caught and fixed a real reference bug in the desktop banner during verification before it shipped |
| `08aef33` | "Prospects" terminology feels transactional | Sales/CRM-coded language, out of step with a personal, culturally-sensitive premarital context | User chose "Partner" via `AskUserQuestion`; replaced every user-visible instance app-wide (routing flow, validation messages, hub headers, resume banner, chart labels, radiology screen) while deliberately leaving internal variable/table names untouched |

---

## 2. Lifestyle & Habits: "Previously, but quit" + scoring-engine fixes (2 commits)

| Commit | Request | What was wrong | Fix |
|---|---|---|---|
| `7d0eb45` | Add a "Previously, but quit" alcohol option | Former drinkers were forced into "Never" (untrue) or a current-use tier (also untrue). Investigating the wiring found the *existing* scoring already broken two independent ways: (1) `LIFESTYLE_LRS.alcohol`'s keys never matched the frontend's real option values, so every non-abstinent answer silently fell back to risk-neutral; (2) separately, the match-creation payload sent the value under key `drinking` while the backend read `shared_lifestyle_data?.alcohol` — the value never reached scoring at all, regardless of bug #1 | Added the new 4-tier option set (Never/Quit/Occasionally/Frequently); fixed both bugs; fixed the same key mismatch in `mentalAutofill.js`'s autofill and the MFR "reduce alcohol" suggestion |
| `bae6f18` | Same treatment for smoking/tobacco | Pulling the same thread found smoking's scoring was broken *worse* — a casing mismatch meant not even `'Never'` matched `'never'`, so every answer including the default silently scored risk-neutral | Added the new 4-tier option set (Never/Quit/Occasionally/Regularly); fixed the LR key mapping, `mentalAutofill.js`'s `SMOKING_RANK`, both `sharedLifestyle` payload constructions, and the MFR "quit smoking" suggestion |

Both verified end-to-end via real `analyzeChronic` calls against real seeded report IDs, confirming
actual `coupleIndex` movement per tier (not just unit-level LR lookups) — before either fix, every
tier of both habits would have produced the identical score, since the value never reached scoring
in the first place. `backend/__tests__/lifestyle-lr-mapping.test.js` added as a permanent
regression net (10 assertions, all passing).

---

## 3. Mental wellbeing engine v2.0 (commit `0a34151`)

Implemented `contexts/mental_health_engine_update.md` — an external psychologist review's full
v2.0 spec for the mental wellbeing questionnaire, taking it from 21 items to 27:

- **Attachment, fully reworked:** the old single forced-choice `attachment_style` question
  (Secure/Anxious/Avoidant/Disorganized) is replaced by 6 indirect agree/disagree items, scored
  as two continuous dimensions (anxiety, avoidance) rather than a category. Couple-level
  attachment compatibility now applies a pursue-withdraw penalty specifically when one partner
  runs anxious while the other runs avoidant, instead of a flat secure/insecure lookup.
- **New item:** `relocation_openness`, split out of the old combined `career_alignment` question
  so career focus and willingness to relocate can be judged — and mismatched — independently.
- **Preference pillars rescored:** Life & Career and Family & Parenting now score *clarity*
  (distance from the undecided midpoint) rather than treating one direction as healthier — a
  partner who is validly, firmly not career-focused or doesn't want children no longer scores as
  "low quality" and gets unfairly capped by the headline's `min()`.
- **Couple agreement widened** to the 20 non-attachment Likert items (including the new
  `relocation_openness`), with attachment agreement now sourced from the new dimensional model
  instead of a 3-tier lookup.
- Headline scoring, the six pillar weights, and the outer `mentalResult` payload shape are all
  **unchanged** — confirmed via grep that no downstream consumer (report generation, PDF
  rendering) reaches into the restructured internals, so nothing else needed to change.

Verified via a new `backend/__tests__/mental-engine-v2.test.js` covering all 8 of the spec's own
acceptance checks (27-item count, weights summing to 100, `attachment_style` fully removed,
clarity not penalizing firm preferences, agreement correctly dropping on real disagreement,
pursue-withdraw scoring lower than non-complementary insecurity, peaked-scale correctness, the
exact 20-item agreement denominator, fail-closed defaults on missing data) — all pass, plus a
live browser walkthrough against a real logged-in session confirming the sub-hub renders all 27
items across 5 categories with the correct counts and wording.

Deliberately not built, per the spec's own instructions: the optional positive-wellbeing item for
Pillar 1, and a separate Hinglish/plain-language copy pass.

---

## Verification & safety notes

- Every backend-touching change was checked against the full backend regression suite
  (`parser.test.js`, `usg-scoring.test.js`, `sti-gate-ontology-binding.test.js`,
  `lifestyle-lr-mapping.test.js`, `mental-engine-v2.test.js`) — all green after every commit
  today.
- Two real, independent production scoring bugs (alcohol and smoking both silently defaulting to
  risk-neutral regardless of the user's actual answer) were found and fixed with real, reproducible
  before/after score evidence, not left as a unit-test-only fix.
- One real reference bug (a desktop banner crashing on an undefined prop) was self-caught during
  the resume-banner verification's own screenshot check, before it shipped.
- Two genuine product/terminology judgment calls were surfaced to the user via `AskUserQuestion`
  rather than decided unilaterally: Health Profile module ordering, and the "Prospect" → "Partner"
  rename.
- Adjacent findings noticed but deliberately not touched, per explicit scoping: sleep's
  LR-key mismatch (same bug class as alcohol/smoking, flagged in a code comment, not yet fixed);
  the legacy, unlinked `/chronic`/`/mfr`/`/usg` debug pages (confirmed disconnected from the live
  user journey via link-graph search).
- 11 commits total today, each scoped to one fix (or an explicitly tightly-bundled pair sharing
  one root cause), all authored solely as the user's own git identity with no co-author trailer.
