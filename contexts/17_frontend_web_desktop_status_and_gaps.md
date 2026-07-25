# Frontend: Web/Desktop UI Status & What Remains (WEB NEEDS WORK)

**Doc 17 of 22** · Audience: a solo full‑stack successor · Prerequisite: `16_frontend_mobile_report_and_dashboard.md`, `18_design_system_and_styling.md` (read the finished mobile reference and the token system first, so you know what you are reconciling *to*).

Goal of this doc: give you a **precise, file‑anchored picture of what desktop/web work remains** — the product owner asked for this one by name. It covers the polished‑vs‑unfinished split, the orphaned legacy standalone engine pages, the P1 breakpoint dead‑zone, the desktop‑lags‑mobile divergences, the `/db` authorization exposure, and a prioritized backlog with a keep/delete decision on the legacy pages.

---

## 0. The one sentence to keep in your head

> **The mobile UI is the locked, finished design reference (doc 16). Everything on the desktop/web axis is either (a) a one‑directional "reconcile desktop *to* mobile" task, or (b) stale legacy nobody navigates to.** Never change a mobile screen to match a desktop one — it is always the other way round.

There is exactly **one exception** to "mobile is the reference," and it is deliberate: the `core-engine` **report shell renders the desktop "Premarital Sync" layout on all viewports** by product decision (doc 16, and §3 below). That is *not* a responsive defect — do not "fix" it.

---

## 1. The two‑generation split (the single most important mental model)

There are **two entirely separate generations of UI** in this codebase, built on **two different data models**, and they coexist in the same `frontend/src/app/` tree. Confusing them is the #1 way a successor wastes a day.

| | **OLD — standalone engine pages** | **NEW — single‑account app** |
|---|---|---|
| Routes | `/chronic`, `/mfr`, `/usg`, `/db` | `/` → `/login` → `/dashboard` → `/add-prospect` → `/core-engine/*` |
| Account model | **None.** Session‑less, unauthenticated | Single logged‑in account + partner invite |
| Upload model | **Dual "Prospect 1 / Prospect 2"** side‑by‑side PDF upload | One user profile; partner added by self‑entry or invite |
| Persistence | **None** — result lives in a local `useState` only | Persisted `matches` row (doc 10) |
| State store | None (no `CompatibilityContext`) | `CompatibilityContext` (doc 14) |
| Clinical logic | **Duplicated client‑side** (see §9) | Backend engines are source of truth (docs 07–09) |
| Linked from | **Nothing** — orphaned (see below) | The whole app |
| Status | Legacy / orphaned; delete candidate | The product |

**The name collision that will bite you:** `frontend/src/app/mfr/page.js` (OLD standalone, 1,943 LOC) is a completely different file from `frontend/src/app/core-engine/mfr/page.js` (NEW report tab). Same for `chronic` and `usg`. When someone says "the fertility page," ask *which generation*.

### Grep evidence that the standalone pages are orphaned

Nothing in the running app links to `/chronic`, `/mfr`, `/usg`, or `/db`. The only inbound links are the four pages **cross‑linking each other** through a shared top tab‑bar (Home / USG / Chronic / Fertility):

- `frontend/src/app/chronic/page.js:603` `<Link href="/usg">`, `:606` `/chronic`, `:609` `/mfr`
- `frontend/src/app/mfr/page.js:1223` `/usg`, `:1226` `/chronic`, `:1229` `/mfr`
- `frontend/src/app/usg/page.js:87` `/usg`, `:90` `/chronic`, `:93` `/mfr`
- `/db` has **no inbound link at all** — it is reachable *only* by typing the URL.

No `MobileBottomNav`, dashboard, or report nav references any of them. They are dead ends you can only reach by hand.

```
NEW APP (linked, authenticated, persisted)
  /  ──▶ /login ──▶ /dashboard ──▶ /add-prospect ──▶ /core-engine/{story,chronic,mfr,usg,mental,genomics}
                        │
                        └── MobileBottomNav (Home / Health / Chat / Analysis)

OLD STANDALONE (orphaned island — only cross-link each other)
  /chronic ◀──▶ /usg ◀──▶ /mfr        /db  (no inbound link at all)
     └── dual "Prospect 1 / Prospect 2" upload, no auth, no persistence
```

---

## 2. What actually renders on desktop TODAY, per surface

This is the honest inventory. "Polished" means a real design pass; "needs‑work" means it renders but was never designed for desktop.

| Surface | File | Desktop state today |
|---|---|---|
| Marketing landing | `app/page.js` + `components/landing/*` | **Polished.** Fully responsive (desktop bento grid vs mobile photo backdrop), scroll‑reveal, overflow‑free at all widths (WS5 positive finding). |
| Login / OTP wizard | `app/login/page.js` | **Polished.** Viewport‑identical mobile↔desktop (WS5 positive). |
| Dashboard (home) | `app/dashboard/page.js` | **Mostly done, minus micro‑copy.** Desktop tree has ambient‑art bg, `max-w-5xl`, quota strip, CTA, CategoryHub — but drops mobile‑only durations + the "Encrypted end to end" trust line (UX5‑02/03). |
| Profile / account | `app/profile/page.js` | **Bare — the worst surface.** Desktop branch is a `max-w-lg` (512px) form adrift in flat 1440px paper, no ambient bg (UX5‑05). The clearest "no desktop design pass." |
| Core‑engine report | `app/core-engine/layout.js` | **Desktop‑styled by design on all viewports** (left sidebar). Intentional, locked (doc 16). |
| Standalone engines | `app/{chronic,mfr,usg,db}/page.js` | **Orphaned.** Render only via direct URL; `usg` is visually broken (§9). |

**The critical P1 caveat over all of this:** the desktop dashboard/profile trees only render cleanly **≥1024px**. Between **768–1023px** you get the desktop tree *under* the mobile bottom nav — see §4.

---

## 3. The rule: mobile is the locked reference (and the one exception)

Every desktop divergence in §5 is a **reconcile‑to‑mobile** task. The mobile screen is correct; the desktop one is behind. This is a product‑owner decision, stated in `00_index.md` day‑one warning #2 and doc 16.

The switch that picks which tree renders is `useIsMobile()` (`frontend/src/hooks/useIsMobile.js`). Its contract matters:

- It returns **`undefined` during SSR/first paint** (`getServerSnapshot` at `useIsMobile.js:22`). Consumers **must render `null` until it resolves**, then mount **EITHER the mobile OR the desktop tree — never both**. `profile/page.js:202` does exactly this (`if (isMobile === undefined) return null;` then the fork at `:204`). Double‑mounting is real cost — heavy SVG score bars and chat drawers would instantiate twice just to be CSS‑hidden.
- Its query is `'(max-width: 767px)'` (`useIsMobile.js:5`). **Remember this number — it is half of the P1 bug.**

**The exception:** `core-engine/layout.js` renders the desktop "Premarital Sync" report shell (`layout.js:339` `<h2>Premarital Sync</h2>`, left sidebar at `:215`) on **all** viewports, with a mobile hamburger drawer over the *same* desktop content. It does **not** fork to a different mobile layout. That is the locked Report‑UI decision. Do not treat it as a responsive gap.

---

## 4. The P1 breakpoint dead‑zone (UX5‑01)

This is the highest‑severity desktop bug and it is a **two‑constant mismatch** — the JS tree‑switch and the CSS nav‑hide point were never reconciled.

| Mechanism | Breakpoint | Where |
|---|---|---|
| React tree switch (`useIsMobile`) | **767px** | `useIsMobile.js:5` — `QUERY = '(max-width: 767px)'` |
| Bottom‑nav hide (Tailwind utility) | **1024px** | `MobileBottomNav.js:196` — `<nav className="mnav lg:hidden">` |
| Bottom‑nav hide (CSS override) | **1024px** | `mobile-shell.css:380` — `@media (min-width:1024px){ .mnav{display:none} }` |

**The consequence:** at any viewport width **768–1023px**, `useIsMobile` returns `false` (so `dashboard`/`profile` mount the **desktop** tree), but `.mnav` is still ≥767px so the **mobile bottom nav is still visible**. You get **two chrome systems on screen at once** — a desktop page under a floating mobile tab bar. Live‑measured at 800/900/1000px in the review (`review/ux_WS5_responsive.md:48`).

> Why two hide mechanisms for the nav? `mobile-shell.css:373-379` documents it: `.mnav { display:grid }` (unconditional) and Tailwind's `lg:hidden` have **equal selector specificity**, and `mobile-shell.css` is imported *after* globals.css in `app/layout.js`, so `.mnav` was silently winning and the bar stayed visible on desktop. The explicit `@media (min-width:1024px)` override at `:380` was added so hiding no longer depends on import order. Net effect: **1024px is the authoritative nav breakpoint.**

**The fix (effort S, per `review/ux_WS5_responsive.md:85`):** widen `useIsMobile` to `'(max-width: 1023px)'` so the tree switch agrees with the nav. `.mnav` already treats 1024 as the boundary, so aligning the JS to it closes the dead‑zone with one constant change. Verify no desktop‑only surface assumes ≥768.

---

## 5. The desktop‑lags‑mobile divergences (the reconcile backlog)

All of these are one‑directional "bring desktop up to the mobile design," none touch mobile. Sourced from `review/ux_WS5_responsive.md` and `review/ux_WS2_ia_nav.md`.

| ID | Sev | Surface | Gap | Anchor |
|---|---|---|---|---|
| UX5‑01 | **P1** | dashboard/profile | 768–1023px dead‑zone (§4) | `useIsMobile.js:5` vs `mobile-shell.css:380` |
| UX5‑02 | P2 | dashboard CategoryHub | Per‑section time estimates ("≈1 min") shown on mobile cards, absent on desktop | `dashboard/page.js` desktop tree |
| UX5‑03 | P2 | dashboard | Mobile "Encrypted end to end…" trust line dropped on desktop | `dashboard/page.js` |
| UX5‑04 | P2 | add‑prospect hub | Desktop "Health Profile" hub has **no back‑to‑dashboard** control | `app/add-prospect/*` |
| UX5‑05 | P2 | profile | Desktop column is 512px in bare 1440px canvas, no ambient bg (dashboard has one) | `profile/page.js:275` (`max-w-lg`) |
| UX5‑06 | P2 | shared nav | Recurring sub‑44px tap targets (report nav rows 208×36, wizard back 32×32) | multiple |
| UX2‑07 | P2 | global | **No persistent desktop global nav** outside the report — desktop users have no app‑wide chrome | `review/ux_WS2_ia_nav.md:158` |

UX5‑05 is worth calling out: it is the single clearest "nobody did a desktop pass here." The profile desktop branch (`profile/page.js:275`, `max-w-lg mx-auto`) is a narrow form floating in undecorated paper while the dashboard next door has a full ambient‑art background. Measured: `dash_desktop_colW {w:1024}` vs `profile_desktop_colW {w:512}` (`review/ux_WS5_responsive.md:182`).

**Positive findings (don't "fix" these):** zero horizontal‑overflow bugs anywhere; the login wizard is viewport‑identical; the story tabs do true responsive reflow (`review/ux_WS5_responsive.md`).

---

## 6. The landing / marketing architecture

The landing page is the most polished web surface and is **entirely data‑driven** — copy is separated from composition, which makes it easy to edit but also easy to ship unsubstantiated claims (see §6.2).

### 6.1 Composition

`app/page.js` (`LandingPage`, `page.js:19`) composes the `components/landing/*` atoms in order: `LandingHeader` → `HeroSection` → Stories (`StoryTabs` + `StoryVisuals`) → CTA strip → `PersonaSection` → `TestimonialCard`s → Positioning → Analysis Areas `Accordion` → `PricingCard`s → Final CTA → footer. Scroll‑in is via `Reveal` (IntersectionObserver).

Returning logged‑in visitors still see the **full** marketing page by design; only the header/hero CTA swaps to "Continue." `page.js:24-33` reads `localStorage.slayhealth_user` and sets `continueHref = parsed.name ? '/dashboard' : '/onboarding'` (`:29`). Every other CTA hardcodes `href='/login'`.

| Component | Role | Anchor |
|---|---|---|
| `HeroSection.js` | Desktop 4×4 bento image grid vs mobile dimmed photo backdrop; rotating health‑topic word (2.2s) | needs `/images/hs-1..7.png` + `hero-image4.png` in `public/` |
| `StoryTabs.js` | 4‑story selector, Overview/Reality/Prevention sub‑tabs; `VISUALS_BY_ID` maps story→visual | pairs with `StoryVisuals.js` |
| `StoryVisuals.js` | Bar charts / info boxes / cost comparisons per story (Punnett square for genetic) | all numbers hardcoded copy |
| `PersonaSection.js` | 5‑persona selector (Arranged/Love/Planning/Remarriage/Concerned Parents) | all CTAs → `/login` |
| `PricingCard.js` | 3‑tier pricing, `COLLAPSED_COUNT=3` expand‑more | ₹799 / ₹1,499 / ₹2,499 |
| `Accordion.js` | Single‑open Analysis‑Areas accordion | `AREA_ICONS` map at `page.js:17` |
| `Reveal.js` | IntersectionObserver scroll‑reveal wrapper | — |
| `TrustSignals.js` | Trust badges — **hardcodes unsubstantiated claims** (§6.2) | `TrustSignals.js:6-7` |

All copy lives in `frontend/src/constants/landingContent.js` (`HEALTH_TOPICS`, `STORIES`, `TESTIMONIALS`, `PRICING_PLANS`, `PERSONAS`, `ANALYSIS_AREAS`).

### 6.2 Unsubstantiated marketing claims (REG/DPDP lane)

These are presented as fact and were flagged by the regulatory review (see `REG-06_DPDP_SUBSTANTIATION_AUDIT.md` at repo root, and `review/WS_REG_regulatory.md`). Treat every number here as `[interim]` marketing copy pending substantiation — do not add clinical authority the product has not earned:

| Claim | Where | Note |
|---|---|---|
| "450+ Verified Reviews" | `TrustSignals.js:6` | unsubstantiated |
| "4.8/5 rating from couples" | `TrustSignals.js:6` | unsubstantiated |
| "Doctor Verified · All reports reviewed by MDs" | `TrustSignals.js:7` | unsubstantiated; **conflicts with the app's own "confirm with a qualified doctor" framing** — keep that framing intact |
| Score‑weight percentages Genetic 25% / Fertility 25% / Chronic 20% / Infection 10% / Mental 10% / Lifestyle 10% | `landingContent.js:230,237,…` | **marketing copy — must be reconciled against the real engine weights in doc 09**, or the landing lies about how the score is built |
| Pricing ₹799 / ₹1,499 / ₹2,499 | `landingContent.js:95,113,136` | product decision, not clinical |

Precedent is set: `landingContent.js:127` carries a **REG‑07** comment documenting the removal of a fabricated "Join 2,847 Couples Who Know" stat. Other numbers remain unaudited. Coordinate with the REG lane (doc 20, doc 21) before adding any claim.

---

## 7. The auth / OTP flow on desktop (`login/page.js`)

The login wizard is 501 LOC and works identically on both viewports (a WS5 positive). Two implementation facts shape it, and both matter on desktop:

- **OTP arrives over WhatsApp, not SMS.** Because it is not an SMS, the OS **cannot auto‑fill** it — there is no `<input autocomplete="one-time-code">` magic. The page compensates with **extensive clipboard‑paste plumbing** (`extractOtpDigits`, `pasteOtpFromClipboard`, `handleOtpPaste`). Gotcha: `maxLength=6` on the input truncates a pasted string *before* the digit filter runs, so pasted text is de‑digited in the `onPaste` handler rather than read off the field. On desktop this is the primary entry path (no phone keyboard suggestions).
- **Nameless‑user resume trick.** Right after OTP verify, the wizard writes a **nameless** `slayhealth_user` to localStorage so a reload mid‑signup resumes at `/onboarding` rather than dumping the user back to the start (UX1‑02). This is why `page.js:29` on the landing branches on `parsed.name` — a nameless user means "signup in progress → /onboarding," a named user means "done → /dashboard."
- Step orders are `STEP_ORDER_NEW` / `STEP_ORDER_RETURNING`; resend has a 60s cooldown; there is deliberately **no auto‑submit on the 6th digit** (OPP‑UX‑01 proposes adding it). Token wiring: `/api/auth/verify` returns access+refresh, stored via `setAccessToken` + localStorage; state then lives in `CompatibilityContext` (doc 14).

Note the **profile** screen (`profile/page.js`) uses the same `useIsMobile` fork (`:87`, `:204`) and a **per‑user localStorage draft** pattern (`loadProfileEditDraft`/`clearProfileEditDraft`). Gotcha for `handleSave`: it must pass through existing lifestyle fields or they **null out server‑side**.

---

## 8. The orphaned legacy pages: verdict, recommendation, and the `/db` exposure

### 8.1 What they are

`/chronic`, `/mfr`, `/usg`, `/db` are the product's **original UI** — direct‑URL, unauthenticated, dual‑"Prospect" test harnesses. They still function (you can upload two PDFs and get a full analysis) but they are visually and architecturally stale, and **nothing links to them** (§1).

### 8.2 The `/db` route — an AUTHORIZATION gap, not an open door

Be precise here, because the frontend map overstates it. **The backend `/db` route IS authenticated:** `backend/src/routes/db.routes.js:8` does `router.use(authenticateToken)` across all four endpoints (`GET /tables`, `GET /tables/:name`, `PUT /tables/:name/:id`, `DELETE /tables/:name/:id`). A logged‑out visitor typing `/db` gets 401s, not data.

The real problem is **authorization**: there is **no admin check** — *any* logged‑in user can `GET`/`PUT`/`DELETE` **any row in any table**. Combined with the frontend `app/db/page.js` (inline double‑click cell edit + delete, hitting `${API_URL}/api/db/tables/...` at `db/page.js:36,58,86,113`), that is destructive full‑DB CRUD available to the entire authenticated user base. Frame it as an **authorization gap**, not an unauthenticated door.

### 8.3 The decided direction (product owner, this handoff)

| Page | Decision |
|---|---|
| `/db` | **Re‑home behind the `ADMIN_PHONE_NUMBERS` allowlist** (doc 04). Keep it as an internal admin tool, but gate the route to admins so it stops being CRUD‑for‑everyone. |
| `/chronic`, `/mfr`, `/usg` | **Delete.** They duplicate the `core-engine` engine tabs, carry the dual‑Prospect model that no longer matches the product, duplicate clinical logic client‑side (§9), and `/usg` is already visually broken (§9). |

Both are **separate code changes not yet done** — this doc records the decision; the work is on the backlog (§11). Until then, treat the standalone pages as landmines: do not build on them, and do not assume their client‑side clinical numbers match the backends.

---

## 9. Client‑side clinical‑logic duplication in the standalone pages

This is the load‑bearing reason to delete `/chronic`, `/mfr`, `/usg`: they each **re‑implement clinical thresholds in the browser**, separate from the backend engines (docs 07–09). If either side changes, they **silently drift**. Every value below is `[interim]` (house value, pending clinical review) unless noted; **the backend engines — not these pages — are the source of truth.**

### 9.1 `chronic/page.js` — IDRS bands, biomarker flags, drift model

IDRS risk bands (`chronic/page.js:29` `BAND`, `:35` `idrsBand`) `[interim]`:

| Band | Cutoff | Note (verbatim in `BAND`) |
|---|---|---|
| low | score < 30 | "Under 30 — high negative predictive value (95.1%); undiagnosed diabetes unlikely." |
| mod | 30 ≤ score < 60 | "30–50 — elevated; warrants confirmatory glucose testing." |
| high | score ≥ 60 | "≥ 60 — CURES screening cut‑off. ~1 in 6 carry undiagnosed diabetes (PPV 17%)." |

Biomarker flag thresholds (`ok|borderline|high`) `[interim]`:

| Marker | high | borderline | Anchor |
|---|---|---|---|
| HbA1c | ≥ 6.5 | ≥ 5.7 | `chronic/page.js:41` (`flagHbA1c`) |
| BP | sbp≥140 or dbp≥90 | ≥130 or ≥85 | `flagBP` |
| BMI | ≥ 25 | ≥ 23 | `flagBMI` |
| Triglycerides | ≥ 200 | ≥ 150 | `flagTG` |
| HDL | < low (M 40 / F 50) | < low+10 | `flagHDL` |
| HOMA‑IR (premium) | ≥ 2.5 | ≥ 2.0 | `flagHOMA` |
| hs‑CRP (premium) | ≥ 3 | ≥ 1 | `flagCRP` |

Client‑side **drift model** (`getDriftedBiomarkers`, `chronic/page.js:67`, per projected year) `[interim]`: BMI +0.03/yr (0.15 if Sedentary/Poor diet, −0.05 if Active+Healthy); SBP +0.5 / DBP +0.3 (1.2/0.7 if high stress or regular smoking); HbA1c +0.015 (0.04 if Poor/Sedentary, −0.01 if Healthy+Active); TG +1.5 (3.5 if Poor diet); HDL −0.2 (−0.5 if regular smoking, +0.1 if Active). Couple index `coupleIdx(a,b,w)=w·min+(1−w)·max` (`:558`): `bandLo` w=0.7 (`:566`), `bandHi` w=0.5 (`:567`), `central` w=0.6 (`:568`). This is the **only** page using Recharts (LineChart with ReferenceLines at y=60 and y=30). It re‑derives drifted biomarkers per selected timeline year entirely client‑side — none of it is persisted.

### 9.2 `mfr/page.js` — WHO‑style semen classification + conception formula

`belowCount` thresholds (`mfr/page.js:378-385`) `[interim]`: concentration<16, totalCount<39, volume<1.4, totalMotility<42, progressive<30, vitality<54, morphology<4, pH<7.2. Verdict (`:387-391`): `concentration==0||count==0` → "Severe Deficit" (+azoospermia); `belowCount≥3` or `concentration<5` → "Severe Deficit"; ==2 Moderate; ==1 Mild; else Normal.

Cumulative‑conception chart formula, **verbatim** `[interim]`:

```js
(1.0 - Math.pow(1.0 - val/100, 12)) * 100   // monthly rate → 12-month cumulative
```

Fertility zones `[interim]`: ≥85% green "Good to Go", 60–85% amber "Consultation Advised", <60% red "IVF / Egg Freezing". Female age bands: Reproductive (<40) / Premenopause (40–45) / Menopause (≥45). This is the **largest file in the area** (1,943 LOC) and the entire conception‑projection chart is **hand‑built inline SVG** (no chart lib), auto‑analyzing via a big‑dependency `useEffect` that can double‑fire.

### 9.3 `usg/page.js` — NuptiaScore composite weights + broken theming

USG composite weights, verbatim in the on‑page calculations trace (`usg/page.js:319,323,325`) `[interim]`: Liver ×0.22, Gallbladder ×0.10, Pancreas ×0.08, Spleen ×0.07, Kidneys ×0.18, Bladder ×0.10, Reproductive ×0.25 → `composite_abdominal`. Nuptia USG slice: Metabolic (/10×30%) + Reproductive (/100×35%) + Renal (kidneys/100×15%) + Abdominal (composite/100×20%), Sum ×15 (max 15 pts).

**`usg` is additionally visually broken.** It styles against **dark‑theme tokens that no longer exist** in the current light `globals.css`: `var(--primary)`, `--glass-border`, `--glass-bg`, `--color-severe`, `--error` (e.g. `usg/page.js:87,90`). Those resolve to nothing, so colors fall back or break. It is also the only place the `components/usg/*` panel library is used outside `core-engine/usg`.

---

## 10. IA / naming debt (from `review/ux_WS2_ia_nav.md`)

Mostly lives in the report shell, which — being desktop‑styled everywhere — is a web concern too.

| ID | Issue | Anchor |
|---|---|---|
| UX2‑04 | **One report, 5+ names**: "Analysis" / "Premarital Sync" / "Partner Sync" / "Your Health Story" / "View Reports" — no coherent "the report" model | `layout.js:145` ("Partner Sync"), `:339` ("Premarital Sync") |
| UX2‑02 | **"Support" nav button is dead** — renders like adjacent working buttons but has no action, on both sidebar and drawer | `layout.js:248`, `:317` |
| UX2‑03 | **"Stress Resilience" nav item exits the report** into the mental questionnaire, even when already complete | `layout.js:152` |
| UX2‑01 | **Genomics tab looks live but is a "Coming Soon" stub** — inherits full report chrome incl. "Download PDF"; naming drifts ("Genomics Report" / "Genetics Risk" / "Genetics & Infection Carrier Risk") | `core-engine/genomics/page.js` |
| UX2‑05/06 | Two parallel navs stack on the mobile report; no visible current‑tab without opening the drawer | `MobileBottomNav.js` + `layout.js` drawer |
| — | **Refresh inside the report bounces a logged‑in user to the PUBLIC landing** (ref WS8‑01) | hydration guard in `layout.js` |

The MobileBottomNav gate is worth internalizing (`MobileBottomNav.js:131`): it returns `null` unless `user.name` is set AND the path is not `/`, `/invite/*`, `/add-prospect`, or `/core-engine*`. So the "Health" tab (`:200`) routes to `/add-prospect`, **where the nav then hides itself** (UX2‑08) — a small dead‑feeling transition.

---

## 11. The prioritized web‑work backlog

What to fix first, roughly in order. Severities from the review corpus; doc 21 is the authoritative ledger.

| # | Item | Sev / Effort | Pointer |
|---|---|---|---|
| 1 | **Close the 768–1023px dead‑zone** — widen `useIsMobile` to `max-width:1023px` | P1 / S | §4, `useIsMobile.js:5` |
| 2 | **Re‑home `/db` behind `ADMIN_PHONE_NUMBERS`** (fix the authorization gap) | High / S–M | §8.2, `db.routes.js:8` |
| 3 | **Delete `/chronic`, `/mfr`, `/usg`** (kill the duplicate client‑side clinical logic) | Med / M | §8.3, §9 |
| 4 | **Give the desktop profile a real design pass** (UX5‑05) — widen + add ambient bg | P2 / M | §5, `profile/page.js:275` |
| 5 | **Restore dropped desktop micro‑copy** — durations + "Encrypted end to end" trust line (UX5‑02/03) | P2 / S | §5 |
| 6 | **Add a persistent desktop global nav** outside the report (UX2‑07) | P2 / M | §5 |
| 7 | **Add back‑to‑dashboard on the desktop add‑prospect hub** (UX5‑04) | P2 / S | §5 |
| 8 | **Fix report IA**: rename to one report name, wire/remove "Support", stop "Stress Resilience" exiting, mark Genomics as coming‑soon honestly (UX2‑01/02/03/04) | P2 / M | §10 |
| 9 | **Substantiate or soften landing claims** — "Doctor Verified," review counts, score weights vs doc 09 | REG / M | §6.2 |
| 10 | **Enlarge sub‑44px tap targets** (UX5‑06) | P2 / S | §5 |

---

## Open items (see doc 21 for the authoritative list)

- **UX5‑01 (P1)** breakpoint dead‑zone (768–1023px) is the top desktop bug and a one‑constant fix — do it first.
- **Legacy pages**: decision is re‑home `/db` behind `ADMIN_PHONE_NUMBERS` and delete `/chronic`/`/mfr`/`/usg`; **both are separate code changes not yet done.** Until then, the client‑side clinical constants in §9 can silently drift from the backend engines (docs 07–09).
- **`/db` authorization gap**: authenticated but not admin‑gated → any logged‑in user can CRUD any table row (`db.routes.js:8`). Owned by doc 20.
- **Desktop profile (UX5‑05)** and **no desktop global nav (UX2‑07)** are the two "never had a desktop design pass" surfaces.
- **REG/DPDP**: unsubstantiated landing claims ("Doctor Verified," 450+ reviews, 4.8/5) and the score‑weight percentages that must match doc 09 — regulatory posture is an open risk; take no wellness‑vs‑SaMD position here.

*Next: `19_testing_and_qa.md` — the backend suites, why `npm test` is a stub, and the total absence of frontend tests over everything this doc describes.*
