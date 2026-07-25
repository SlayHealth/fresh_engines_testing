# Frontend: Mobile Report & Dashboard (the COMPLETE reference UI)

**Doc 16 of 22** · Audience: a solo full‑stack successor · Prerequisite: `14_frontend_core_state_and_app_shell.md`, `10_match_orchestration_generate_insights.md` (the score this UI renders comes from there).

Goal of this doc: give you the finished, locked mobile‑first surface — the home dashboard with its weighted confidence gauge and the multi‑tab "Premarital Sync" report — in enough depth that you can change it without breaking the two score paths, the null‑vs‑0 guards, or the deep‑link hydration that hold it together. This is the **design reference the web must reconcile to** (doc 17), so read it before you touch anything on the desktop side.

---

## 0. Orientation — what "this subsystem" is

Everything a fully‑onboarded user sees **after login** splits into two surfaces:

1. **Home / dashboard** (`app/dashboard/`) — quota chips, a resumable‑draft banner, recent matches, and a **health‑profile completeness gauge**. On mobile this is the signature multi‑arc `WeightedGauge`; on desktop it's a flat inline tree.
2. **The report** (`app/core-engine/`) — a completed compatibility match presented across a **Story tab** (the narrative "Premarital Sync" headline, the Health Together Index ring, a timeline scrubber, and Tracked Markers) plus **six per‑engine tabs** (Chronic, Fertility/MFR, Mental, Organ‑Wellness/USG, Genomics, and the Story hub itself).

The whole thing is a faithful port of a hand‑authored mockup (`contexts/ui_mobile_update.html`). **Functionally it is built and shipping end‑to‑end** — gauge, section list, bottom nav, report shell, Story tab, all six engine tabs, recharts/SVG visualizations, deep‑link hydration, PDF download, chat entry. What remains is a documented backlog of **trust / consistency / a11y / regulatory** items (§11) that live in exactly these files. "Core experience complete; production‑clean it is not."

```
        LOGIN ─┬─▶ /dashboard ──(useIsMobile 767px)──┬─▶ MobileHomeView.js   (mobile tree)
               │                                       └─▶ inline desktop JSX  (desktop tree)
               │                                            └ two UNRELATED trees, not a reflow
               │
               └─▶ tap a Recent match / bottom-nav ──▶ restoreMatchSession() / hydrateFromMatchId()
                        │  (populates CompatibilityContext)
                        ▼
                   /core-engine/layout.js  ──▶ story | chronic | mfr | mental | usg | genomics
                        (returns null unless user && chronicResult && mfrResult)
```

All clinical numbers surfaced here — IDRS bands, MFR cumulative curves, thalassemia status→score maps, USG organ thresholds — are **`[interim]`** house values pending clinical review. The canonical constant homes are docs 07–09; this doc restates only what the UI itself hardcodes.

---

## 1. The mobile‑vs‑desktop split (the single most important structural fact)

`useIsMobile()` (`hooks/useIsMobile`) is a `matchMedia('(max-width: 767px)')` hook that returns **`undefined` on the server** (no `matchMedia` in SSR), then `true`/`false` after first client paint. `dashboard/page.js` hard‑branches on it:

| Line | Guard | Why |
|---|---|---|
| `dashboard/page.js:152` | `if (!user) return null;` | No session → render nothing (context redirects). |
| `dashboard/page.js:168` | `if (isMobile === undefined) return null;` | Undetermined on first paint — render nothing rather than flash one layout then swap, **and never mount both trees at once** (five pages' worth of double SVG/data‑fetching is real cost). |
| `dashboard/page.js:170‑188` | `if (isMobile) return <MobileHomeView … />` | The mobile tree. |
| `dashboard/page.js:190‑448` | else → a full inline desktop dashboard | The desktop tree (ambient art, quota strip, CTA, `CategoryHub`, support). |

**These are two unrelated render trees, not a responsive reflow** (UX4‑08/09). A change to one does **not** affect the other. If you "fix" a mobile card to match desktop, you have changed nothing on desktop — and you're fixing the wrong direction anyway (mobile is the reference).

Consequences you will trip over:

- **`NotificationBell` exists only on mobile** — `MobileHomeView.js:87`. The desktop dashboard never renders it, so an invite‑pending signal is invisible on desktop (UX7‑06).
- **768–1023px is a dead‑zone** (UX5‑01): the desktop tree renders, but the global mobile bottom nav (`.mnav`) only hides at `≥1024px` (`mobile-shell.css:381`), so the bar overlaps the desktop layout at tablet widths. The hide depends on `mobile-shell.css` loading **after** Tailwind's `globals.css` — see the cascade note at `mobile-shell.css:372‑380`; the two `.mnav` rules have equal specificity, so source order decides.
- Per‑section **time estimates and the privacy line** are present on the mobile tree, absent on desktop (UX5‑02/03).

---

## 2. The confidence / gauge math, end to end

This is the home gauge's whole reason to exist: turn real health‑profile progress into one motivating number, sliced by how much each section moves it.

### 2.1 The weights (verbatim)

`utils/healthProfileProgress.js:12‑18`:

| Section key | Weight | Notes |
|---|---|---|
| `about` | 20 | `[interim]` display heuristic |
| `lifestyle` | 15 | `[interim]` |
| `mental` | 20 | `[interim]` |
| `pathology` | 35 | `[interim]` — the heaviest slice |
| `radiology` | 10 | `[interim]`, locked/paid |
| `genomics` | **(absent)** | Deliberately excluded — not launched. If it were weighted, everyone's achievable confidence would cap below 100% with no way to close the gap. |

`RELIABLE_THRESHOLD = 70` (`healthProfileProgress.js:79`) — a real, enforced threshold (the gauge's "Reliable at 70%" eyebrow, `ProvisionalBadge` usages), not decorative. `MENTAL_QUESTION_COUNT = 27` (`:3`).

These weights **only roughly mirror** the backend engine weights (chronic+fertility ~60% combined, mental 20%, radiology 10%). About/Lifestyle/Pathology all feed the same chronic+fertility engines rather than being separate scored domains, so the split here is a UI story, not the composite formula (that's doc 09).

### 2.2 The one confidence formula, computed two ways that must agree

`computeConfidence(categories)` (`healthProfileProgress.js:23‑32`) = `Σ (progress/100 × weight)`, rounded. The desktop resume‑draft % and any server‑adjacent consumer call this.

`MobileHomeView.js:32` recomputes the **same** number inline so the gauge arcs and centre number can never disagree:

```js
const conf = Math.round(weighted.reduce((a, s) => a + (s.weight * s.pct) / 100, 0));
```

`weighted` = `weightedSections(sections)` = sections with `weight > 0` (`utils/mobileSections.js:77‑79`) — i.e. genomics excluded from gauge, centre number, and "N of M sections" count. `done = weighted.filter(s => s.pct > 0).length` (`MobileHomeView.js:33`).

### 2.3 The adapter: real category → mockup section shape

`toMobileSection(cat)` (`mobileSections.js:46‑69`) maps a real `healthProfileCategories[]` entry into `{ id, title, sub, tone, icon, duration, weight, pct, answered, total, state, price, tests }`. The `META` map (`:7‑14`) carries the mockup's fixed tone/title/sub/icon per key. **Gotcha:** the `about` section's title is dynamic (`cat.label` → "About You" vs "About \<partner\>" on the partner journey, `:56`); every other section keeps META's fixed wording. `stateOf()` (`:39‑43`) resolves `soon | locked | progress | todo`.

### 2.4 The WeightedGauge arc math (verbatim)

`components/mobile/WeightedGauge.js` — a hand‑rolled multi‑arc SVG donut. Constants at `:8‑10`:

| Symbol | Value | Meaning |
|---|---|---|
| `R` | `54` | ring radius |
| `C` | `2πR` | circumference |
| `GAP` | `16` | gap between arcs |

Per section (`:43‑61`): arc **length** `len = (weight/100) × C` encodes the weight; `seg = max(len − GAP, 2)`; the **fill** `fill = max((seg × pct)/100, 1)` encodes real progress; stroke is `var(--r-<tone>)`. So a bigger weight = a longer arc; a fuller section = more of that arc coloured in. `useCountUp` animates the centre number and respects `prefers-reduced-motion` (`dur=0`, `:16‑21`).

**Why the legend exists** (`:84‑92`): because arc length encodes weight, the biggest slice (Pathology 35%) visually dominates, and a QA reviewer read the donut *by slice size as if it were a sequence* ("Pathology first"). The legend names each colour → section → weight so it reads as "one weighted slice per section," not an order.

### 2.5 The identity‑tone vs status‑tone rule (do NOT collapse these)

This is the load‑bearing two‑colour system in `MobileSectionList.js` and `MobileMiniRing.js`:

- **`s.tone`** = the section's brand **identity** hue (pink for About, teal for Lifestyle, …). Used for the **icon tile** — it answers *"which section is this."*
- **`statusTone`** = **completion** state. `statusToneFor(pct) = pct >= 100 ? 'moss' : 'gold'` (`MobileSectionList.js:20‑22`) — amber while in progress, green once done. Used for the **progress ring / bar**.

If you reuse the identity tone for the completion ring, a fully‑completed "About You" (identity = magenta/pink) renders a **red ring + checkmark that reads as an error state** rather than success. That regression already happened once; the comment at `MobileSectionList.js:11‑19` is the tombstone. `MobileMiniRing` (`components/mobile/MobileMiniRing.js`) reinforces it: at `pct ≥ 100` it draws a **checkmark** (not "100%", which overflows the `r=17` ring), and it prefers a concrete `answered/total` label (e.g. `3/6`, `20/21`) over an abstract `%` — font shrinks to 9px when counts are present (`:28‑33`).

`RowEnd` (`MobileSectionList.js:24‑29`) picks the trailing widget by state: `locked` → "Locked" pill, `soon` → "Notify me", `pct > 0` → `MobileMiniRing`, else → "Start" pill.

### 2.6 Next‑best‑action logic

`MobileHomeView.js:55‑60`: `next` = heaviest **unlocked**, non‑`soon` section with `pct < 100` (note `< 100`, not `=== 0`, so a half‑done Mental at 40% still surfaces). `addOn` = set only when nothing unlocked remains but a locked/paid weighted section (Radiology) does — the caption then flips from "biggest lever" to "optional add‑on for the final +N%." The eyebrow reads **"Your Full Picture"** (`:110`) to disambiguate the account holder's own 0% gauge from a partner draft % sitting in the resume banner below — a QA reader took those two different people's numbers as a contradiction.

---

## 3. How a report is opened and hydrated

### 3.1 The entry points

A report is opened by one of:
- Tapping a **Recent match** on Home → `restoreMatchSession(match)` then `router.push('/core-engine/story')` (`dashboard/page.js:376`, `MobileHomeView.js:181`).
- The bottom nav's **Analysis** or **Chat AI** tab (`MobileBottomNav.js` §7).

`restoreMatchSession` / `hydrateFromMatchId` (both in `CompatibilityContext`) populate the in‑memory spine: `chronicResult`, `mfrResult`, `mentalResult`, `userReport`, `prospectReport`, `activeMatchId`, `prospectForm`, `activeMatchDetails`.

### 3.2 The report shell's null‑guard and deep‑link recovery (WS8‑01)

`core-engine/layout.js:168` hard‑returns `null` unless `user && chronicResult && mfrResult`. But before it bounces you to `/dashboard`, the hydration effect (`:70‑93`) tries to **recover** from an empty context:

```
context has chronic+mfr?  ── yes ─▶ render report
        │ no
        ▼
already tried hydrating?  ── yes ─▶ push('/dashboard')
        │ no
        ▼
matchId = searchParams 'match' || activeMatchId
        │ none ─▶ push('/dashboard')
        ▼
hydrateFromMatchId(matchId).then(ok => ok ? render : push('/dashboard'))
```

This is the WS8‑01 fix: previously a hard refresh, deep‑link, or shared URL always lost the in‑memory data and bounced to `/dashboard` **before** any hydration was attempted. Now the redirect only fires if hydration also has nothing. A second effect (`:100‑106`) keeps `?match=<id>` in the URL synced with `activeMatchId` from **any** tab, so a refresh/bookmark/share survives via the path above without threading a query param through every navigation call.

**What is lost on refresh without `?match=`:** everything living only in `CompatibilityContext` and never persisted to the URL. The mental/pathology *home‑gauge* progress in particular is not rehydrated from the backend on a fresh session (see §2 / §8) — a returning user on a new device would see "Start" on those cards even with real data on file, which is why `dashboard/page.js:86‑90` falls back to durable `matchesList` evidence.

### 3.3 `Suspense` wrapper

`CoreEngineLayout` wraps `CoreEngineLayoutInner` in `<Suspense fallback={null}>` (`:21‑27`) because it reads `useSearchParams()` — a Next 16 App Router requirement.

---

## 4. The Story tab in depth (`core-engine/story/page.js`, ~1204 lines)

The flagship tab. Everything below anchors to `story/page.js`.

### 4.1 The TWO score paths — never confuse them

This is the highest‑stakes gotcha on the tab.

| Path | Source | Drives | Anchor |
|---|---|---|---|
| **Server `baselineScore`** | `activeMatchDetails.presentation_json.relationship_snapshot.score` | The **headline ring**, the status band, `actions[]`, and (indirectly) thread urgency | `:224` |
| **Client `calculateDynamicScore(year, actBranch)`** | Live recompute over context results | **Only** the hypothetical timeline‑scrubber tooltip for future years | `:151‑216`, consumed at `:232` |

The `relationship_snapshot.score` is the one **STI‑gate‑checked, renormalized** score that the dashboard, PDF, and DB column all derive from (`computeGatedComposite`, doc 10). The client recompute has **no knowledge of the STI gate** and could show a healthy ring while the real score is capped. Letting the client recompute drive the headline was exactly the WS6‑02 bug. At Year 0 the tooltip deliberately shows the same real baseline (`targetScore = selectedYear === 0 ? baselineScore : calculateDynamicScore(...)`, `:232`) rather than a second, possibly‑divergent "today" number.

### 4.2 The client recompute's cross‑domain weights (verbatim)

`calculateDynamicScore` (`:151‑216`) — `[interim]` weights:

| Domain | Weight | Sub‑score derivation |
|---|---|---|
| Chronic | 0.35 | curve value at `year` (act→optimized, else current), `?? 85` |
| Fertility (MFR) | 0.25 | monthly curve → cumulative `(1 − (1 − m)^12) × 100`, `?? 15` |
| Mental | 0.20 | `overall_readiness.score ?? 80` |
| Radiology | 0.10 | `nuptia_score_usg_contribution / 30 × 100` |
| Genetics | 0.10 | thalassemia: red→50, yellow→75, else 100 |

Result = `Math.round(sumScores / sumWeights)` or **`null`** when no domain produced a result (`:215`) — never a fabricated number.

### 4.3 The null‑vs‑0 guards (preserve these exactly)

These exist so a genuine catastrophic **0** is never coerced to a reassuring default:

- **Mental** `?? 80` (`:179`) — a real `0` (mental.controller's `compatibilityIndex` is legitimately 0 for `avgDiff ≥ 5`) must not be treated as falsy. `??` (not `||`) is deliberate.
- **Radiology** `typeof rawRadContribution === 'number' ? rawRadContribution : 25` (`:194‑195`, and again at `:655`, `:664`) — the backend reports a catastrophic finding as a real `0`, and `|| 25` would silently substitute a much better‑looking 25. Field is `nuptia_score_usg_contribution`, **flat on the partner object** (legacy‑mapped shape) — not nested under `scores_json`, which does not exist on this response.
- **Genetics `genomicsReveal()`** (`:136‑148`): red→`{50,'Needs attention'}`, yellow→`{75,'Worth a look'}`, **gray→`{null,'Not fully assessed'}`**, else→`{100,'Clear'}`. The `null` case renders plain text, not the animated `RevealedCount` (which would coerce to "0"), guarded at `:1129‑1134`.

### 4.4 The score band and the status‑pill contradiction (UX3‑08, OPEN)

`scoreBand` (`:295‑307`), `[interim]` thresholds: `displayScore ≥ 80` → "Strong" / teal `#18CC96`; `< 60` → "Worth attention" / danger `#E0555B`; else → "Steady" / amber `#F4A100`. The **ring stroke** honors this.

But the **status pill** below the ring (`:862‑866`) hardcodes `bg-(--soft-teal) … text-(--teal-d)` regardless of severity — only the *text* changes ("Excellent/Moderate/Watch Synergy"), the colour stays teal. So a "Worth attention" red ring sits above a reassuring teal pill. **UX3‑08, still open.**

### 4.5 `generateChapterProse` and the cheerful‑default sentence (UX3‑09, OPEN)

`generateChapterProse(year, actBranch)` (`:310‑407`) builds the drop‑cap narrative by branching each domain on its result (`mfrResult.state`, `chronicResult.state`, `mentalResult.overall_readiness.label`, radiology `risk_flags`, thalassemia overlap). The Year‑0 opener is **hardcoded**: *"…your paths converge at a healthy and cooperative starting point"* (`:315`) — no severity branch, so it stays cheerful even when the ring is red. **UX3‑09, still open.** Prose cross‑dissolves via a 150ms fade (`:415‑422`).

### 4.6 The `threads[]` state machine (Tracked Markers)

`threads[]` (`:553‑698`) is seven domains, each with `plain`/`clinical` copy (toggled by "Clinical terms," `:1050`). `getThreadState(id, year, actBranch)` (`:474‑535`) resolves each to `Pending | Resolved | Improving | Steady watch | Needs attention | Not scored`, styled by `getThreadBadgeStyle` (`:537‑550`). `Pending` threads render nothing (`:1075`); "Needs attention" threads are sorted to the top (`:1068‑1072`).

| Thread `id` | Bound to | Notes |
|---|---|---|
| `infection` | `presentation_json.sti_gate.{triggered,narrative,headline,clinical_footnote,findings}` | **UX3‑01 fix**: the STI gate already caps the headline server‑side but was never surfaced; now it is, verbatim from the gate. `triggered` → "Needs attention". |
| `fertility` | `mfrResult.state` | Aligned→Resolved; Specialist→Needs attention; else Steady watch / (act→) Improving. |
| `chronic` | `chronicResult.state` | Same shape as fertility. |
| `mental` | `mentalResult.overall_readiness.label` | No label → "Not scored" (must not fail open to "Highly Aligned", `:504‑505`). |
| `radiology` | `radiologyData.partner_A/B.risk_flags[].severity` | severe→Needs attention, mild→Steady watch, else Resolved. |
| `genetics` | `carrier_pair_risk.thalassemia.{male,female}_status` | red→Needs attention. Real finding lives HERE, not on the genomics tab. |

`actions[]` (`:704‑712`) keys off the **gated** `baselineScore` (`< 80` → book a session), same reasoning as the ring — a client recompute could under‑flag a couple the gate already capped. `pendingDomains[]` (`:715‑723`) lists any null‑result domain in the closing card. **UX7‑09:** the pending‑domain copy is identical for three different underlying causes.

### 4.7 Data fetches on the tab

Two fetches: `fetchActiveMatchDetails(activeMatchId)` (presentation_json, `:72‑76`) and a separate `GET /api/compatibility/matches/:id/radiology` (`:79‑99`). The radiology fetch failing surfaces a non‑blocking `radError` banner (*"Your other results are unaffected."*, `:1057‑1062`) — it does not crash the tab. PDF download is a blob fetch (`:101‑121`). The footer privacy claim was softened (UX8‑02, `:1196‑1199`): *"Your data stays private and confidential"* — but note the mobile Home trust line is a stronger, still‑unsubstantiated claim (REG‑01, §11).

---

## 5. Each engine tab's data source & rendering approach

Six tabs, three different rendering strategies (recharts, bespoke SVG, styled divs). **There is no single charting abstraction.**

### 5.1 Chronic (`core-engine/chronic/page.js`, recharts `LineChart`)

`chronicTimeline` (`useMemo`, `:34‑103`) recomputes everything from `chronicResult.projection` + `selectedProjYear`. Reads chronic helpers `getDriftedBiomarkers / getRiskDrivers / idrsBand / SEV / fmt / clamp` from `CompatibilityContext` (`:12‑20`).

`[interim]` math (verbatim):

- `coupleIdx(protA, protB, w) = w·min + (1−w)·max` (`:77‑80`), evaluated at `w=0.7` (bandLo), `0.6` (central), `0.5` (bandHi). `protA = 100 − sA`.
- `HbA1c ≥ 6.5` = diabetic range (`:57`).
- State (`:65‑70`): `gateFired || currentScenario < 50` → "Specialist conversation"; `< 75` → "Plan together"; else "Aligned". Tier escalated if `diabeticCount === 2 || markersFlagged ≥ 5` (`:73‑75`).
- Chart `ReferenceLine`s at `y=60` ("high risk ≥60") and `y=30` ("mod risk ≥30") (`:367‑368`); IDRS drawn as `stepAfter` lines that only step at age bands **35, 50** (`:379‑380`, disclaimer `:384`).

**The Demo scaffold that must be removed before this ships as a paid report (UX3‑11 / UX9‑04, OPEN):** the "Calibration scaffold" section + the "Log assessment (Demo)" button + a `pending`‑row table (`:397‑430`), plus unexplained "IDRS" / "Uncalibrated · relative ordering" jargon (`:264`) in the couple‑influence card. The disclaimer at `:392‑394` correctly frames the score as a wellness heuristic on a validated screening tool (IDRS) plus **reasoned‑but‑not‑independently‑validated** multipliers (WS3B04/05) — keep that framing.

### 5.2 Fertility / MFR (`core-engine/mfr/page.js`, ~733 lines, **bespoke SVG**)

The only engine tab with a hand‑rolled SVG chart (`renderSvgChart`, `:64+`), **not recharts**. `viewBox` is `800×420` (~1.9:1); the container uses `aspectRatio: '800 / 420'` (`:599`) to avoid dead space on phones.

`[interim]` math (`mfrTimeline` `useMemo`, `:35‑61`):
- Cumulative 12‑month = `(1 − (1 − MFR_Y)^12) × 100`, where `MFR_Y = curve value / 100` (`:42`, `:44`, `:67‑68`).
- Time‑to‑conceive `~ max(1, round(1 / MFR_Y))` months (`:50`), or **"Blocked"** when `mfrResult.details.gate` is set (`:47‑48`); `monthlyChance` then shows `0%` (`:54`).
- Female age bands at **40** (premenopause) and **45** (menopause) shade the chart (`:91‑92`, `femaleBaseAge` default 30).
- Chart zones (from the map/domain constants): `≥85` "Good to Go", `60–85` "Consultation Advised", `<60` "IVF/Egg Freezing".

Reads `projection.optimised || projection.optimized` (British/American drift guard, `:39`). The "increase intercourse frequency" suggestion was **removed** (backend `freq` was hardcoded 0.92, never real). An "In‑depth Calculations Trace" (`:628+`) exposes lambda/AMH internals.

### 5.3 Mental (`core-engine/mental/page.js`, ~170 lines)

Pillar bars per partner. `PILLARS[]` (`:11‑18`) **must mirror `mental.controller.js` `computeMentalResult` exactly** — order, labels, and `[interim]` weights (sum = 100):

| Pillar | Weight |
|---|---|
| Emotional Health | 15 |
| Personality & Attachment | 20 |
| Marriage Readiness | 25 |
| Life & Career Alignment | 15 |
| Family & Parenting | 15 |
| Risk Factors | 10 |

When `mentalResult` is null it shows a "complete the questionnaire" CTA routing to `/add-prospect?enter=mental` (`:44‑64`) — **UX2‑03:** a report‑nav item that silently dumps the user out of the report into an intake form.

### 5.4 Organ Wellness / USG (`core-engine/usg/page.js`, ~615 lines)

Fetches `GET /api/compatibility/matches/:id/radiology` (`:66‑80`). Empty state offers **PDF upload + a "Trigger Mock Report" link** (§5.6, §6). Partner A = account holder, Partner B = prospect, mapped to male/female by `user.gender` (`:44‑45`) — never the dev's own test names.

Response shape it reads: `data.partner_A` / `partner_B`, each carrying `nuptia_score_usg_contribution`, `scores.{metabolic_index,…}`, `modalities_detected`, `risk_flags[]`, `findings_all.<MODALITY>` (e.g. `USG_SCROTUM_DOPPLER`, `ECHO`, `DEXA`), and `raw_data.findings.<organ>` / `raw_data.patient.age_years`. Renders a 12‑column grid of ~13 panel components (§6). `data.ai_summary` (good/minor/major) and `data.shared_insights` drive the couple summary.

**Upload safety (WS6‑04/05 fix):** `calculateAge` returns `null` for a missing DOB and `resolveSex` returns `null` for a missing gender (`:50‑64`); uploads and mock generation **block** with a toast rather than fabricating a default (`:100‑103`, `:147‑150`), because sex/age gate real age‑banded organ scoring server‑side (prostate/DEXA thresholds), not just display.

### 5.5 Genomics (`core-engine/genomics/page.js`, 20 lines)

A static **"Coming Soon"** stub ("Genetics & Infection Carrier Risk"). No data. It looks fully functional in the nav but is an empty shell (**UX2‑01**). The real genetics finding is surfaced on the **Story tab** (§4.6), not here.

### 5.6 `core-engine/error.js` (route‑segment error boundary, 48 lines)

Catches the seed‑shape crashes (§8). **Off‑brand:** it uses indigo/red/slate Tailwind (`:31`), not the report's token palette — visually inconsistent with the rest of the report.

---

## 6. The USG component inventory

`components/usg/` mixes two rendering kinds. Only **three** use recharts; the rest are styled‑div clinical readout cards.

| Component | Kind | `[interim]` thresholds / notes |
|---|---|---|
| `CoupleRadarComparison.jsx` | recharts `RadarChart` | 7 organ‑system scores, both partners. Uses `--partner-a/--partner-b/--line/--muted` CSS vars from `globals.css` (glass‑panel theme), **not** mshell tokens. |
| `RiskMatrix.jsx` | recharts `ScatterChart` | risk flags by fertility‑relevance (x) × severity (y); circle=A, triangle=B. |
| `OrganStatusGrid.jsx` | styled divs | `getStatusColor`: `≥85` normal, `≥70` mild, `≥50` moderate, else severe. **UX6‑05:** status is an 8px colour dot only — no text label (a11y fail). |
| `EchoPanel.jsx` | styled divs | LVEF: `≥55` normal, `≥45` mild, `≥35` moderate, else severe. Carries the `justifyContent:'between'` copy‑paste bug (invalid CSS value — cosmetic). |
| `DexaPanel.jsx` | styled divs | T‑score `≤ −2.5` osteoporosis, `≤ −1.0` osteopenia. |
| `ScrotalHealthPanel.jsx` | styled divs | Male‑only; from `findings_all.USG_SCROTUM_DOPPLER`. |
| `MetabolicHealthDashboard.jsx` | styled divs | `≥8` normal, `≥5` moderate, else severe (/10). Explicit `!== null` guard (Pending vs real 0). |
| `NuptiaScoreUSGSlice.jsx` | styled divs | contribution /30 (`max_possible = 30`). |
| `FattyLiverVisual.jsx` | styled divs | grade 0–III silhouettes. |
| `ModalityBadgeRow.jsx` | styled divs | modality pills. |
| `SharedRiskIntelligence.jsx` | styled divs | shared‑risk list. |
| `FemaleReproductivePanel.jsx` / `MaleReproductivePanel.jsx` | styled divs | the two reproductive‑organ cards. |

**Two orphans** — `OrganHealthRadar.jsx` (recharts single‑series Radar) and `PDFUploader.jsx`. Neither is imported by `core-engine/usg/page.js`; both are used **only** by the legacy standalone `app/usg/page.js` (a ~26KB pre‑consolidation test harness, doc 17). A new dev will mistake them for live report components — they are dead in the report flow. `PDFUploader` uses raw `fetch()` (no auth wrapper) and a **different** endpoint (`/api/usg/upload`) than the report's `/api/radiology/upload`.

---

## 7. Navigation model — three navs, one destination set, many names

### 7.1 `MobileBottomNav.js` (global, ~238 lines)

The fixed bottom tab bar (Home / Health / Chat AI / Analysis) on **all authenticated pages except** a deny‑list. Gated on `user.name` (fully onboarded) **plus** a route deny‑list — **not** an allow‑list (`:131`):

```js
if (!user?.name || pathname === '/' || pathname.startsWith('/invite/')
    || pathname.startsWith('/add-prospect') || pathname.startsWith('/core-engine')) return null;
```

Rationale (`:112‑130`): the name‑gate alone naturally covers every authenticated page, but three surfaces must read as "outside the app" or own their nav — the public landing (`/`), the invite link (opened by the *other* person), and the report (`/core-engine`, which renders its own nav, §7.2).

Behaviors:
- `hasActiveAnalysis = chronicResult && mfrResult`; `hasCompletedAnalysis = hasActiveAnalysis || matchesList.length > 0` (`:134‑140`).
- **FAB treatment** (elevated, coloured Chat button) only when `hasCompletedAnalysis` (`:203`) — before that it's a plain tab, so it still works but doesn't visually promise a conversation that can't happen.
- The **Analysis tab is muted** (`opacity .42`) when there's nothing to analyze but is **deliberately NOT `aria-disabled`** (`:212‑216`) — an `aria-disabled` control would tell screen readers and Playwright it's inert and swallow the one tap that's supposed to explain *why* it's muted (a toast, `:173‑175`).
- A **chat‑match‑picker** bottom sheet (`ChatMatchPicker`, `:10‑90`) opens when Chat is tapped with no active analysis.

### 7.2 The report's own three navs (`core-engine/layout.js`)

The report replaces `MobileBottomNav` with its **own** navigation, in three forms:
1. **Desktop sidebar** (`:190‑259`).
2. **Mobile hamburger drawer** (`:262‑330`).
3. **Mobile bottom bar** (`:471‑558`) — three parts: Dashboard and Chat AI as standalone always‑reachable buttons, and the **six engines grouped behind one collapsible toggle** (`grid-template-rows 0fr→1fr` animation, `:498`) rather than each getting a slot.

**Per‑context label renaming (UX2‑04):** `menuItems` (`:143‑155`) renames routes for display — sidebar/drawer say **Partner Sync / Fertility Timeline / Chronic Risk / Stress Resilience / Organ Wellness / Genetics Risk**, but the routes are `story / mfr / chronic / mental / usg / genomics`. One destination, many names. Add the two stacked mobile navs and the fact that the current tab isn't visible without opening the drawer (UX2‑05/06), and IA is a known rough edge. `selectedTab` is derived from `pathname` (`:109‑116`). The chronic/mfr tabs share a **Timeline Projection scrubber** over `PROJECTION_YEARS = [0,3,5,7,10]` (`:19`, `:385‑417`).

---

## 8. Score‑scale & null‑vs‑0 traps to preserve; spelling drift

- **null‑vs‑0 is load‑bearing** across the subsystem. `?? 80` (mental), `typeof x === 'number' ? x : 25` (radiology), `!== null` checks (USG panels), `{null,'Not fully assessed'}` (genetics) all exist so a genuine catastrophic **0** isn't replaced by a reassuring default (WS6‑03). When refactoring, do **not** swap `??` for `||` — a real 0 is falsy and `||` would erase it.
- **Projection spelling drift:** curves are read with both spellings throughout mfr/chronic/story — `projection.optimised || projection.optimized`, and `projection.currentLifestyle || projection.current`. A **seed‑shape mismatch** (flat `projection_current` vs nested `projection.{current}`) crashes mfr to `error.js` and blanks chronic (ux_WS3 seed note) — so QA using hand‑written seeds can see **false crashes** that don't happen with real engine output.
- **Home mental/pathology progress is not rehydrated** from the backend on a fresh session/new device; it falls back to `matchesList` evidence (`dashboard/page.js:86‑90`). A returning user with real data but no completed match sees "Start."

---

## 9. External surface (endpoints, auth, presentation_json fields)

`API_URL` comes from `config/api.js`: `NEXT_PUBLIC_API_URL` or `''` (relative URLs proxied through Next rewrites, to survive phone‑on‑LAN firewall blocks on :3001 — doc 03 §4). All authed fetches go through `utils/api.apiFetch` / `getAccessToken`.

| Endpoint | Method | Called from |
|---|---|---|
| `/api/compatibility/matches/:id/radiology` | GET | story (`:85`), usg (`:71`) |
| `/api/compatibility/matches/:id/pdf` (`?token=` on the anchor variant) | GET | layout anchor (`:355‑363`), story blob (`:105`) |
| `/api/radiology/upload` | POST (multipart) | usg (`:119`) |
| `/api/radiology/report` | POST (JSON) | usg **mock** (`:242`) |
| `/api/chat/message` | POST | `ReportChatDrawer` (doc 11) |

`presentation_json` fields this UI reads: `relationship_snapshot.score`; `sti_gate.{triggered,headline,narrative,clinical_footnote,findings}`; `carrier_pair_risk.thalassemia.{male_status,female_status,narrative,clinical_footnote}`; `report_confidence.domains.genetic.covered`. Chat context is assembled in `layout.js` `combinedContextMetadata` (`:124‑135`) and passed to the drawer.

**Two design‑token systems collide here** (doc 18): Tailwind/`globals.css` (desktop, report, usg glass‑panels — `--partner-a/--partner-b/--glass-bg/--color-normal`) vs the scoped `mobile-shell.css` `.mshell`/`.mnav` tokens (mobile home/profile). "The brand teal" is three different greens (UX4‑01). A fully‑authored **dark palette** at `mobile-shell.css:35‑52` is **dead** — gated on `data-mtheme="auto"`, but `MobileHomeView.js:72` hardcodes `data-mtheme="light"` (UX4‑04). Don't assume dark mode works.

---

## 10. The mobile shell CSS in one line

`app/mobile-shell.css` (~390 lines) is a port of the mockup, scoped under `.mshell` (page) and `.mnav` (bottom bar): all mobile tokens, the gauge/hero/match/card/list/report/story/chat/profile styles, and the bottom‑nav layout. The icons here are `components/mobile/Ico.js` — an inline SVG sprite ported verbatim from the mockup (stroke 1.7, 30+ named line icons), a **separate icon system from `lucide-react`** used everywhere else. That's deliberate: the mobile shell uses the exact mockup shapes, not lucide approximations.

---

## 11. Open items (see doc 21 for the authoritative list)

- **UX3‑05 / UX9‑04 [P1]:** the "Trigger Mock Report" debug affordance is **ungated in the live paid report** (`core-engine/usg/page.js:311‑317`, `:332‑338`, `:369‑383`) — it POSTs **fabricated clinical findings** into a real match record (`triggerMockRadiology`, hardcoding e.g. `radiology_nuptia_contribution` 18.71/27.5 `[interim]`). Gate behind `NODE_ENV`/a flag or remove before ship‑verifying.
- **UX3‑08 / UX3‑09 [P2]:** the Story status pill is hardcoded teal regardless of ring severity (`story/page.js:862‑866`), and the Year‑0 opening prose is always "healthy and cooperative" (`:315`) — either can contradict a severe result.
- **UX3‑11 / UX9‑04 [P1/P2]:** the Chronic tab still ships the "Calibration scaffold" + "Log assessment (Demo)" panel and unexplained IDRS/"Uncalibrated" jargon in the paid report (`chronic/page.js:397‑430`, `:264`).
- **a11y UX6‑01..08 [P0/P1/P2]:** report‑scrubber has no visible focus ring; the hamburger strips focus and lacks an accessible name; the closed chat drawer intercepts Tab; `OrganStatusGrid` status is colour‑only; the active nav‑tab state isn't exposed to AT; the white‑on‑pink active pill is 4.0:1 and the emerald thread badge 2.41:1.
- **REG‑01 [P1]:** the mobile Home trust line *"Encrypted end to end. Nothing is shared…"* (`MobileHomeView.js:230`) is an unsubstantiated privacy claim, contradicted by the app's own "DPDP coming soon" copy — the regulatory posture is an open risk (REG‑06 audit). A general informational disclaimer *has* since been added to dashboard/MobileHomeView/story footer/layout, partially addressing REG‑02/04; keep every "confirm with a qualified doctor" line intact.

**Confirmed fixed — do NOT re‑file:** WS8‑01 (deep‑link/refresh now hydrates via `?match=` before redirect), WS6‑01 (story reads correct radiology keys), WS6‑02 (headline uses gated `relationship_snapshot.score`), WS6‑04/05 (usg blocks upload without real sex/DOB), WS1D01 (0‑vs‑null class guards). UX3‑01 partially addressed (the sti_gate Infection thread now exists in `threads[]`).

*Next: `18_design_system_and_styling.md` — the tokens, the three‑greens palette, typography, and the dead dark mode behind everything you just read (read it before doc 17 so you know what the web must reconcile to).*
