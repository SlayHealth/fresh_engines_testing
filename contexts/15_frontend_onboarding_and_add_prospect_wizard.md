# Frontend: Onboarding & Add-Prospect Wizard

**Doc 15 of 22** · Audience: a solo full‑stack successor · Prerequisite: `14_frontend_core_state_and_app_shell.md`, `01_product_overview_and_mental_model.md`.

Goal of this doc: understand the **intake flow** — how SlayHealth collects everything both engines need (identity, body, lifestyle, the 27‑item mental survey, and lab/scan uploads) for **both** people before a match can run. The star of the show is `add-prospect/page.js`, a **1,838‑line single component** with a homegrown state machine, a step‑builder DSL, journey‑aware self‑vs‑partner copy, a weighted confidence score, and the two partner journeys (enter‑yourself vs. send‑a‑link). Read doc 14 first — this page is almost entirely a consumer of `CompatibilityContext`, and the draft/hydration model there is load‑bearing here.

---

## 1. The two entry points

There are **two** intake pages, and they do very different jobs. Don't confuse them.

| Page | File | LOC | When it shows | What it collects | Where it goes |
|---|---|---|---|---|---|
| **Onboarding** | `frontend/src/app/onboarding/page.js` | 147 | A returning, authenticated user who somehow has **no name on file** | `userName` → `userRelation` → `marriageTimeline` (3 steps) | `POST /api/auth/profile` (name only) → `/dashboard` |
| **Add‑Prospect** | `frontend/src/app/add-prospect/page.js` | 1,838 | The real intake — reached from a dashboard CTA or a deep‑link | Self + partner: About, Lifestyle, Mental, Pathology, Radiology; then the routing fork | `/core-engine/story` (a computed match) |

### 1a. `onboarding/page.js` — the minimal returning‑user page

This is a thin 3‑step `QuestionScreen` wizard. The redirect guard (`onboarding/page.js:29-41`) is the whole point: if `localStorage.slayhealth_user` has a `name`, it bounces to `/dashboard`; only a **nameless** user falls through to `setOnboardingStep(1)`. `finishOnboarding` (`onboarding/page.js:46`) POSTs **only the name** to `/api/auth/profile`; `userRelation` and `marriageTimeline` are merged into the local `slayhealth_user` object and set on the context user but are **never persisted server‑side** (`onboarding/page.js:57-64`). Setting `userRelation === 'Self'` auto‑copies `userName` into `candidateName` (`onboarding/page.js:107`).

> **Gotcha (UX9‑07, `review/ux_WS9_copy.md`):** this page **duplicates** the identical name/relation/ETA trio that `login/page.js` also renders, and the two have already drifted (straight vs. curly apostrophes). A copy change to one must be mirrored in the other or they diverge further. Consider extracting the trio into one shared step array.

### 1b. `add-prospect/page.js` — the real wizard, and the deep‑link path

`add-prospect/page.js` is wrapped in `<Suspense>` (`:171-177`) because its inner component reads `useSearchParams()` — an App Router requirement (`frontend/AGENTS.md`: "this is NOT the Next.js you know," check `node_modules/next/dist/docs/` before touching routing). The **deep‑link path** is the second way in: the dashboard's health‑profile cards link to `/add-prospect?enter=<category>`. The effect at `:670-680` reads `?enter`, forces `activePerson='self'`, sets `cameFromDeepLink=true`, jumps straight into that category (skipping the routing screen), then `router.replace('/add-prospect')` to consume the param so it can't re‑fire. `cameFromDeepLink` later routes `exitToHub` back to `/dashboard` rather than the hub (`:388-391`).

---

## 2. The flow‑state machine

There is **no router‑driven navigation inside the wizard** — the entire multi‑screen flow is six pieces of `useState` in one component, and a big `if/else` chain at the bottom of the file (`:1567-1820`) picks what to render. Read these six fields first; everything else is a function of them.

| State field | Init line | Values | Meaning |
|---|---|---|---|
| `activePerson` | `:188` | `'self'` \| `'prospect'` | Whose profile is being filled |
| `activeCategory` | `:197` | `null` \| `'about'`\|`'lifestyle'`\|`'mental'`\|`'pathology'`\|`'radiology'`\|`'genomics'` | `null` = hub view; else in a category's steps |
| `showRouting` | `:200` | `bool` | The "Add Your Partner" transition screen |
| `prospectMode` | `:206` | `'self'` \| `'invite'` \| `null` | Which partner journey (enter‑yourself vs. link) |
| `stepIndex` | `:220` | `int` | Index within the active category / routing sub‑flow |
| `activeMentalSubcategory` | `:222` | `null` \| one of 5 keys | `null` = show the mental sub‑hub cards |

### The render branches (bottom of file)

The selection at `:1567-1820` resolves to exactly one `body`, in this priority order:

```
add-prospect render decision (top wins)
────────────────────────────────────────────────────────────────
fillByProspect && activeInvite   → invite-status timeline      (:1545)
isLoadingResults                 → <AnalysisLoadingScreen>     (:1569)
showRouting                      → "Add Your Partner" routing  (:1571)
activeCategory==='mental'
   && !activeMentalSubcategory   → <MentalSubHub> (5 cards)    (:1664)
activeCategory (any other)       → <QuestionScreen> steps      (:1684)
else (activeCategory === null)   → the Category Hub            (:1716)
                                    ├─ isMobile → MobileSectionList render (:1752)
                                    └─ desktop  → <CategoryHub>          (:1807)
```

`headerTitle` is chosen alongside `body` in the same chain (`'New Compatibility Check'` default `:1568`, `'Add Your Partner'` `:1575`, `'Mental Wellbeing'` `:1665`, category label `:1689-1691`, `'Your Health Profile'` / `"<name>'s Health Profile"` `:1721`). `isLoadingResults = isSavingProfile || isMatching` (`:1542`).

> **Gotcha:** because the flow is component‑local state, a **hard refresh mid‑match‑result loses the computed match** (WS8‑01, `review/WS8_edge_cases.md`) — `/core-engine/*` is Context‑only. The three drafts (§8) rescue the *wizard's* position and answers, but not a finished match.

---

## 3. The two forks: self‑vs‑partner, and self‑vs‑invite

Two orthogonal forks live here. Keep them straight:

- **`activePerson`** — whose data (`'self'` = the account holder, `'prospect'` = the partner). This drives the *copy* and *which form* is edited.
- **`prospectMode`** — how the partner's data arrives (`'self'` = account holder types it, `'invite'` = partner self‑reports via a link). This drives the *routing fork* after "Continue."

### The routing screen (`showRouting`)

Entered from the self hub's **Continue** (`:1729-1748`) when `!partnerRoutingDataComplete`. `partnerRoutingDataComplete(mode, form)` (`:111-113`) returns true once `mode && form.name && form.meetingSource` are all set — its job is to **never re‑ask** a completed "Add Your Partner" flow on resume or on a second Continue (the "Partner Journey Redirects Incorrectly" bug it guards against). The routing steps are built inline (`:1576-1605`): mode choice (`PROSPECT_MODE_OPTIONS`, `:115-118`) → partner name → "How did you meet?" (`MEETING_SOURCES`) → optional matrimonial platform → a mode‑specific terminal step.

> **UX1‑05 (largely fixed, `review/ux_WS1_flows.md`):** "How did you meet?" moved here — *after* the partner is named — so it has a referent (`:1580-1589`); "Relationship Status" was removed entirely.

### `prospectMode === 'self'` — the consent gate

Before the account holder can type someone else's clinical/psychological data, an **explicit, logged consent step** is appended (`:1618-1644`). It renders a checkbox and calls `handleConfirmSelfEntryConsent(advanceToProspectHub)` (`:850`), which POSTs `/api/invite/self-entry-consent` with `prospectName`. On success `advanceToProspectHub` (`:1607-1612`) flips `activePerson='prospect'`. This closes **UX8‑01** (`review/ux_WS8_trust_consent.md`) — the path previously had **zero** consent artifact.

> **Observed copy bug (~`:1635`):** the checkbox reads `` I confirm I have {prospectForm.name || "my partner's"}'s permission… `` — when the name is blank this renders **"my partner's's permission"** (double possessive). Fix by dropping the trailing `'s` from the fallback string.

> **Trust‑asymmetry gap still open (UX8‑06):** the consent gate is a **one‑time entry checkbox**. Nothing on the prospect hub ever reminds the account holder they're viewing/controlling a **third party's** sensitive data; `consent_timestamp` is captured server‑side but never surfaced. See doc 12 (invite/consent) and doc 21.

### `prospectMode === 'invite'` — the invite lifecycle

The full invite/consent state machine, its SSE stream, WhatsApp text, and backend rows are **doc 12's** subject. What lives *here*:

- **Generate:** `handleCreateInviteLink` (`:810`) POSTs `/api/invite/send` with the partner name, the account holder's own mental answers (so they aren't re‑asked), and — critically — `appOrigin: window.location.origin` (`:829`). This is the **UX8‑05 fix**: the backend used to build the link from a stale `APP_URL` env value and hand out dead links (doc 03 §10).
- **Timeline:** `renderTimeline` (`:948`) shows copy/share/revoke and a 5‑stage progress rail (`timelineSteps`, `:953-959`). Live status arrives via **two** channels that both fire: an `EventSource` on `/api/invite/stream` (`:724-762`) and a **3 s polling fallback** on `/api/invite/status` (`:765-801`).
- **Completion:** on `status === 'completed'`, **both** channels `setTimeout(…, 2500)` then call `loadCompletedInviteMatch()` + `router.push('/core-engine/story')`. `loadCompletedInviteMatch` (`:689`) fetches the **most‑recent** match (`prospect_invites` has no `match_id` column, so it can't return one) and `restoreMatchSession`s it.
- **Run match:** `handleRunMatch` (`:926`) POSTs `/api/invite/run-match/:id` with the inviter's pathology `report_id`.

> **Gotcha:** SSE **and** polling can each trigger the 2500 ms→navigate on `completed`. If you touch this, guard against double navigation.

---

## 4. Journey‑aware copy

The self‑entry partner journey (`activePerson='prospect'`, `prospectMode='self'`) is the **same code path** as the self journey, parameterized by an **adapter** plus a name that switches copy to third person. **Do not fork the builders per person.**

| Mechanism | Where | What it does |
|---|---|---|
| `selfAdapter` / `prospectAdapter` | `:1408-1421` | Field‑name maps: `{form,setForm,nameField,genderField,dobField,cityField,isSelfPerson,needsNameStep}`. Self uses `candidate*`; prospect uses `name`/`gender`/`dob`/`city`. |
| `L(base)` label helper | `:1352` (About), `:1373` (Lifestyle) | Returns `base` for self, `` `${name}'s ${base}` `` for the partner — "Priya's Gender". |
| `framePerson(q, name)` | `mentalHealthQuestions.js:329` | Swaps in the hand‑authored `titleP`/`descP`/`optionsP` third‑person variants; with no name returns the question untouched. `optionsP` is **positional** over `options` (relabel only — `val`/order preserved). |
| `subjectName` | `:1491` | `null` for self, the partner's name for the prospect; passed into `buildMentalSteps`/`buildLifestyleSteps`. |
| `MentalSubHub` `descP` | `MentalSubHub.js:100` | Card subtitles use `cat.descP.replace('{name}', subjectName)` in the partner journey. |
| Mobile About‑label override | `utils/mobileSections.js` | `META.about` title is overridden by the dynamic `cat.label` so it reads "About &lt;partner&gt;"; every other section keeps META's fixed wording. |
| Trust whispers | `constants/trustMessages.js` | `getTrustMessage(name,category,index,title)` resolves **by exact question title → by category → general**, personalized with the first name. |

> **Gotcha (trustMessages):** `TRUST_MESSAGES_BY_QUESTION` keys must match on‑screen titles **verbatim**. Several mental keys no longer match the current (reworded) titles, so they silently fall back to the category pool. Several strings also carry `UX8‑02` fix comments (false "private to the two of you" mutual‑access claims were removed).

---

## 5. The step‑builder DSL

Every screen in a category is a plain object `{ title, subtitle?, kind, content, canAdvance, onNext?, onSkip?, section? }`. Small factory functions build them; `getCategorySteps` assembles a category's array; `QuestionScreen` renders one at `stepIndex`.

| Builder | Line | `kind` | `canAdvance` rule |
|---|---|---|---|
| `choiceStep` | `:1223` | `choice` | `!!value` |
| `fieldStep` | `:1232` | `field` | value is non‑empty trimmed |
| `dobStep` | `:1256` | `field` | `!!value && !tooYoung` (legal‑age gated) |
| `measurementStep` | `:1284` | `measurement` | **always `true`** (see hazard §9) |
| `cityStep` | `:1291` | `city` | value non‑empty trimmed |
| `uploadStep` | `:1308` | `upload` | `required ? !!hasReport : true` |
| `finalizeSteps(arr, advance)` | `:1300` | — | Rewires the **last** step's `onNext` to `advance` so Next returns to the hub instead of walking off the array's end |

**Category builders** compose these:

- `buildAboutSteps(adapter, advance)` (`:1349`): (Name if `needsNameStep`) → Gender → DOB → City → Height → Weight → Waist. `needsNameStep` is true only when the self journey is filled by a non‑Self relation (`:1414`).
- `buildLifestyleSteps(form, setForm, advance, subjectName)` (`:1371`): Activity → Drinking → Smoking → Sleep → Family‑Diabetes, **plus Menstrual (Optional)** appended when `gender==='Female'` (`:1381`).
- `buildMentalSteps(categoryKey, answers, setAnswers, advance, subjectName)` (`:1390`): filters `MENTAL_HEALTH_QUESTIONS` to one subcategory, maps each through `framePerson`, walks only those, then returns to the sub‑hub.

**Conditional steps** to know: Name (non‑Self relation), Menstrual (female), matrimonial platform (`meetingSource==='Matrimonial Platform'`, `:1590`), and the mode‑terminal routing steps.

`getCategorySteps(key, person)` (`:1485`) is the switchboard: pathology/radiology each return a **single** `uploadStep` (`:1501-1527`), mental delegates to `buildMentalSteps` with a `returnToSubHub` advance.

---

## 6. The Category Hub + confidence model

The hub (desktop `CategoryHub.js`; mobile the inline `MobileSectionList` branch at `:1752`) is the resumable home the user returns to between categories. `buildCategories(person)` (`:1423`) produces **six** category objects (`:1446-1482`); `computeConfidence` turns their `progress` into one weighted score.

### The confidence weights (canonical home: `utils/healthProfileProgress.js`)

`CONFIDENCE_WEIGHTS` (`healthProfileProgress.js:12-18`) — **must sum to 100** across weighted categories; genomics is deliberately **excluded** (weight 0) so it can't cap everyone at 90% while unlaunched. All values are product‑UX weights, not clinical weights — `[interim]`, and they only *roughly* mirror the real backend engine weights (see doc 09 for the authoritative composite).

| Category | Weight | Required for match? | Progress source |
|---|---|---|---|
| `about` | **20** `[interim]` | ✅ | `aboutProgress(adapter)` — 6 fields (7 if name) |
| `lifestyle` | **15** `[interim]` | — | `lifestyleProgress` — 4 fields (+1 menstrual if female) |
| `mental` | **20** `[interim]` | — | `mentalProgress` (answered / 27) |
| `pathology` | **35** `[interim]` | ✅ | report present ? 100 : 0 |
| `radiology` | **10** `[interim]` | — | radiology report present ? 100 : 0 |
| `genomics` | **0** (excluded) | — | Coming Soon, always locked |

`computeConfidence(categories)` (`healthProfileProgress.js:23`) = `round(Σ (progress/100 × weight))`, skipping any category without a weight. `RELIABLE_THRESHOLD = 70` (`healthProfileProgress.js:79`) — the mobile hub draws a "Target 70%" marker (`:1771-1777`); below it the composite is flagged as guesswork (a **real enforced threshold**, not just a label).

### Gating and tone

`isPersonReady(person)` (`:1531`) is the match gate: `about`, `lifestyle`, **and** `pathology` must all be `progress >= 100`. Radiology, mental, and genomics are optional and never gate. The self hub's **Continue** enables on `isPersonReady('self')`; the prospect hub's **Generate Insights** enables on `isPersonReady('prospect') && !quotaExceeded` (`:1718-1725`).

`categoryTone(category)` (`healthProfileProgress.js:85`) derives color from **state, not identity**: locked/comingSoon → `neutral`, `progress>0` → `teal`, else `pink`. Every consumer (hub cards, mini‑rings, the dead `ScoreBar`) must key off this, never `category.key`.

> **UX5‑04 / UX5‑02 (open):** the **desktop** hub has no back‑to‑dashboard control (the mobile branch adds one at `:1758-1766`), and the strong "time left" estimate (§below) is mobile‑only.

---

## 7. The mental sub‑hub and substance autofill

Mental Wellbeing is **not** a flat 27‑question walk. Opening the category lands on `MentalSubHub` (`:1664`, `MentalSubHub.js`) — a 5‑card grid, one per `MENTAL_HEALTH_CATEGORIES`, each showing a `SubRing` count (e.g. "3/5") and a per‑card ETA. Cards can be done in **any order**; finishing a subcategory returns to the sub‑hub (`returnToSubHub`, `:1496`), it does **not** auto‑advance.

The 27 questions split as: **Feelings & Energy** 3, **Your Personality** 11 (5 traits + 6 dimensional attachment items), **Building Together** 5, **Life & Family Goals** 6, **Habits & Calm** 2 (`mentalHealthQuestions.js:55-318`).

> **The scoring invariant (verbatim intent, `mentalHealthQuestions.js:1-11`):** "Option ORDER must stay worst‑to‑best (index 0 = val 1) since the scoring engine treats a higher value as more of what's asked… Rewrite the wording, never the order or the `val`." `id`s must match the backend `partner_A_answers`/`partner_B_answers` field names. `substance_concern` uses **string** vals (`Low`/`Moderate`/`Elevated`), not the 1–5 scale (`:297-306`). See doc 08 for how these feed the mental engine. All mental scoring bands are `[interim]`.

### `substance_concern` autofill

`handleEnterMentalSubcategory('habits')` (`:349-361`) pre‑derives the drinking question from Lifestyle's already‑answered drinking+smoking, so it isn't asked a third time. `deriveSubstanceConcern` (`utils/mentalAutofill.js:26`): `DRINKING_RANK = {never:0, quit:0, occasionally:1, frequently:2}`, `SMOKING_RANK = {never:0, quit:0, occasionally:1, regularly:2}`; `combined = max(dRank,sRank)` → `0='Low'`, `1='Moderate'`, else `'Elevated'`. It only pre‑fills when `substance_concern` is still `undefined`, only on first open of Habits & Calm, and stays fully editable. `'quit'` ranks with `'never'` (measures **current** use). Ranking thresholds are `[interim]`.

### The `hasEvidence` display hack

Raw per‑question answers live **only** in session/Context/draft — a fresh session has an empty answers object even after a real completed match. So a completed match with a `mentalResult` is treated as "all done" for display: `hasMentalEvidence` (`:450`, `:1672`) forces every sub‑card and the hub tile to 100%. It's **self‑only** — a match proves *self's* mental data existed, never a different, not‑yet‑matched prospect's (`:1443`).

---

## 8. The three localStorage drafts

Answer data survives reloads via three separate, per‑user‑id‑namespaced drafts with module‑level caches. Know which owns what:

| Draft | Owner | Key | Persists | Module cache |
|---|---|---|---|---|
| **Profile draft** | `CompatibilityContext` (doc 14) | `slayhealth_profile_draft_<uid>` | `onboardingForm`, `prospectForm`, mental answers, reports | in Context |
| **Radiology draft** | this page | `slayhealth_radiology_draft_<uid>` (`:51`) | `userRadiology`, `prospectRadiology` | `cachedRadiologyDraft` (`:40`) |
| **Wizard‑position draft** | this page | `slayhealth_prospect_wizard_position_<uid>` (`:77`) | `activePerson, activeCategory, showRouting, prospectMode, stepIndex, activeMentalSubcategory` | `cachedWizardPositionDraft` (`:75`) |

Radiology lives here (not Context) because radiology upload state is page‑local (`:35-39`). The wizard‑position draft exists so an accidental Back / reload / tab‑backgrounding lands the user **where they left off**, not on their own already‑complete hub (`:66-74`). It's mirrored on every change by the effects at `:297-303` and `:312-320`. `loadProfileDraftForResume` (`:96`) reads just enough of the Context‑owned profile draft at init to run `partnerRoutingDataComplete` and skip a done routing flow (`:194`, `:203`).

> **Deliberate exclusion:** `selfEntryConsentConfirmed` is **intentionally not** in the position draft (`:308-311`) — consent is a trust gate that must be re‑confirmed after a session gap, never silently carried over.

---

## 9. Report uploads and the age/sex hazard

| Upload | Endpoint | Required? | Handler |
|---|---|---|---|
| Pathology | `/api/pathology/extract` (real) · `/api/pathology/mock-extract` (mock) | ✅ (gates match) | `handleFileUpload` (`:1084`), `triggerMockData` (`:1124`) |
| Radiology | `/api/radiology/upload` (real) · `/api/radiology/report` (mock) | Optional | `handleRadiologyUpload` (`:460`), `triggerMockRadiology` (`:523`) |

Pathology success renders `TestCoverageSummary` (`:127`) — the backend's real ontology‑based "which named tests were in this PDF vs. missing, and what each missing one costs the report" (doc 06). The mock radiology path builds a **large hardcoded** findings/scores/risk_flags payload inline (`:550-645`) — sex‑branched organ data, ECHO, DEXA, etc.

> **Hazard WS6‑05 (open, `review/WS6_frontend_audit.md`):** radiology upload requires Name/Gender/DOB first (`:467-477`), then computes `sex` and `age = calculateAge(dob)` (`:489-492`). `calculateAge` returns **30** when `dob` is missing, and `restoreMatchSession` never rehydrates `prospectForm.gender`/`dob`. So after a match restore, a radiology re‑upload can silently send **age 30 and the wrong sex** into real organ scoring. Validate `gender`/`dob` are actually populated before calling this path.

> **UX7‑02 (open):** `handleFileUpload` throws a generic hardcoded `'Pathology extraction failed'` / `'Radiology extraction failed'` (`:1107`, `:506`), discarding the backend's real reason. **UX1‑08 (open):** the radiology `Locked · ₹999 one‑time unlock` badge (`:1474`) gates **nothing** — `radiologyUnlocked` is a demo click (`:1784`), there's no payment gateway; tapping opens the full upload.

---

## 10. The match handoff

For the **self‑entry** partner journey, the prospect hub's **Generate Insights** calls `handleMatch` (`:1147`):

```
handleMatch  (self-entry partner path)                        (:1147)
 1. validate self fields present (missingSelf list)           (:1148-1164)
 2. isBelowLegalMarriageAge(self dob, gender)? → block        (:1166)
 3. POST /api/auth/profile (persist self's details)           (:1174)
 4. build mergedUser, save to localStorage + setUser          (:1196-1205)
 5. handleCompatibilityMatch(mergedUser)  ← Context, doc 10   (:1207)
 6. if any mental answers → handleMentalAnalysis(...)         (:1210-1212)
 7. router.push('/core-engine/story')                         (:1213)
```

The heavy lifting (parallel chronic + fertility, save‑match, the single gated composite) is **doc 10's** subject — this page only orchestrates the calls. `AnalysisLoadingScreen` (`:1570`) covers the wait.

A **second** merge path exists: `handleMentalCategoryAdvance` (`:419`) — when a match is **already active** and both people have finished all 27 mental questions, it merges mental into the existing match via `handleMentalAnalysis`, then `fetchActiveMatchDetails` to re‑read the re‑gated composite (the DB was just overwritten, so a re‑fetch is required or the screen shows the pre‑merge score, `:428-431`) before navigating.

> **UX1‑06 / UX7‑03 (open):** `AnalysisLoadingScreen` (`AnalysisLoadingScreen.js:8`) is a **decorative** `STEP_INTERVAL_MS=1400`/step timer with **no wiring to real completion** — the route change is the only "done" signal (`:19-26`). It jump‑cuts when the mock path finishes early and parks on "Formatting" forever when real work is slow. Note also its step copy ("proprietary compatibility engines," "medically validating") — see REG‑06 (doc 21) before leaning on that language.

---

## 11. Domain constants that feed the backends

These frontend constants are **literal lookup keys** the backend engines index by. Changing a `val` silently breaks scoring — this has happened before.

| Constant | File | Value | Feeds |
|---|---|---|---|
| `LEGAL_MARRIAGE_AGE` | `utils/legalMarriageAge.js:6` | `{ Male: 21, Female: 18 }`; DEFAULT 21 | DOB step cap + `handleMatch` re‑check. Real law (PCMA 2006 / SMA 1954) — **not** interim. |
| `FAMILY_HISTORY_DIABETES` | `lifestyleOptions.js:52` | `None`/`One`/`Both` | IDRS family‑history axis: **none 0 / one 10 / both 20** (MDRF‑IDRS; WS1A04/WS3B01, doc 07). |
| `LIFESTYLE_DRINKING` | `lifestyleOptions.js:64` | `Never`/`Quit`/`Occasionally`/`Frequently` | `chronic.controller.js` `LIFESTYLE_LRS.alcohol` — likelihood ratios `[interim]` |
| `LIFESTYLE_SMOKING_TOBACCO` | `lifestyleOptions.js:80` | `Never`/`Quit`/`Occasionally`/`Regularly` | `chronic.controller.js` `LIFESTYLE_LRS.smoking` — LRs `[interim]` |
| `LIFESTYLE_SLEEP` | `lifestyleOptions.js:87` | `Early Bird`/`night owl`/`irregular`/`insomniac` | Lifestyle scoring — note **inconsistent casing** |
| Mental option `val`/order | `mentalHealthQuestions.js` | index 0 = val 1, worst→best | `mental.controller.js` (doc 08). Order is load‑bearing. |

> **The drift trap (`lifestyleOptions.js:58-79`):** the drinking/smoking `val`s here **must** stay in sync with `chronic.controller.js`'s `LIFESTYLE_LRS` maps. They previously drifted (`socially`/`heavily` vs. the map's `Occasional`/`Regular`) and **silently scored everyone risk‑neutral**. Both sides must move together. All chronic likelihood ratios and IDRS band contributions are `[interim]` (see doc 07 for the verbatim tables); the *questions* here just supply keys.

---

## 12. Dead code, orphans, and the confidence sub‑map

Two files in `components/wizard/` are **dead** — no importers, superseded by `components/mobile/*`:

- `ScoreBar.js` — orphan weighted bar; its `console.assert(sum(weights)===100)` is the only place that invariant is *runtime‑checked*, and it never mounts.
- `CategoryTileList.js` — orphan mobile tile list; its own comment claims Home+Questionnaire use it, but nothing does.

Both still reference `CONFIDENCE_WEIGHTS`/`TONE_COLORS` and will rot silently. Also note `SplashScreen.js` lives in `wizard/` but is consumed only by `login/page.js` — not part of this subsystem's runtime path.

The mobile bridge is real and live: `utils/mobileSections.js` (`toMobileSections`) adapts the shared category objects into `MobileSectionList`'s shape, consumed at `:1780`.

> **Stale comments:** `add-prospect/page.js:416` and `:1667`, and `MentalSubHub.js:41`, still say "21 questions." The **logic** reads `MENTAL_HEALTH_QUESTIONS.length` / `MENTAL_QUESTION_COUNT=27` so behavior is correct — the prose lies. Trust the constants.

---

## Open items (see doc 21 for the authoritative list)

- **Accessibility, this area's biggest gap:** `UX6‑01` [P0] no visible keyboard focus indicator on any field; `UX6‑04` [P1] no programmatic label association on any wizard field (radiogroup/date/city/measurement all label‑less); `UX6‑07` [P2] white‑on‑pink CTA at 4.0:1 fails AA; `UX6‑09` [P3] Tab‑stop options instead of roving‑tabindex. See `review/ux_WS6_a11y.md`.
- **Trust asymmetry `UX8‑06` [P1]:** no ongoing "you're holding someone else's data" acknowledgment beyond the one‑time entry checkbox; `consent_timestamp` never surfaced (`review/ux_WS8_trust_consent.md`, doc 12).
- **The `WS6‑05` age/sex hazard** (§9) — radiology upload can feed age 30 / wrong sex into real scoring after a match restore. Validate `prospectForm.gender`/`dob` before the upload path.
- **Fake progress + non‑gating unlock:** `AnalysisLoadingScreen` is a timer decoupled from real completion (`UX1‑06`/`UX7‑03`); the `₹999` radiology unlock (`UX1‑08`) gates nothing.
- **Observed code issues:** the double‑possessive consent copy (`~:1635`), `MeasurementSlider` auto‑committing defaults (170/65/32) on mount while its step is always `canAdvance:true` (`MeasurementSlider.js:52-55`) — body measurements the user never chose count as "answered" and feed BMI/waist classification — dead `ScoreBar`/`CategoryTileList`, and the stale "21" comments.

*Next: `16_frontend_mobile_report_and_dashboard.md` — the complete, locked mobile reference UI these wizard drafts hand off into.*
