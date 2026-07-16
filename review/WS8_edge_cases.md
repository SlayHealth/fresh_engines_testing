# WS8 — Edge cases, failure points, friction (lead's empirical probes)

Schema per `review/_review_schema.md`. Complements WS1*/WS2/WS6 (engine-internal edge behavior is in those files; this file holds cross-cutting flow/failure/auth findings the lead reproduced).

---

### [P2] WS8-01 — Report pages are context-only; a hard nav / refresh / deep-link bounces to /dashboard (data loss + no shareable report URL)
- Area: frontend / edge-case
- Location: `frontend/src/app/core-engine/layout.js:57` (redirect if `!chronicResult || !mfrResult`) and `:110` (returns null); state lives only in `CompatibilityContext` populated by `restoreMatchSession`, not refetched from a match id in the URL.
- Status: **Confirmed (reproduced)**
- Evidence: `backend/scratch/browser_ws8.js` — after seeding a completed match, a hard `page.goto('/core-engine/story')` did NOT render the report; the layout guard redirected to `/dashboard` (observed: story body was dashboard content; no mental/USG strings present; zero pageerrors). The report is only reachable by clicking through the SPA from the dashboard in the same session, because `chronicResult`/`mfrResult` are in-memory context with no URL-driven rehydration.
- Root cause: the report tabs read match data exclusively from client context; there is no `matchId`-param → fetch-and-hydrate path on mount (unlike a normal deep-linkable detail page).
- Impact: UX / data-integrity — a user who refreshes the report, or opens a bookmarked/shared report URL, silently loses the report and lands on the dashboard. Also blocks any genuine shareable-report-link feature (WS7) at the routing layer.
- Best-fit fix (hint): make `/core-engine/*` hydrate from the route (read `activeMatchId` or a `?match=<id>` param → call the existing match-details fetch → populate context) before falling back to the redirect. The fetch path already exists (`fetchActiveMatchDetails`); the gap is that the guard redirects before attempting a route-driven load.
- Effort: M
- Blast radius: touches layout guard + each report tab's mount; sequence carefully so the redirect only fires after a hydration attempt fails.

### WS8-02 — Engines are auth-gated (CONFIRMED GOOD)
- Area: edge-case / security
- Location: `backend/src/routes/{chronic,mfr,mental}.routes.js` — every `/analyze` is behind `authenticateToken` (chronic also behind `checkMatchQuota`).
- Status: Confirmed (reproduced)
- Evidence: `curl -X POST /api/{chronic,mfr,mental}/analyze -d '{}'` → all return **HTTP 401** "Access token is required." No engine is publicly invocable.
- Impact: positive — recorded so the implementer does not add redundant guards.

### [P1] WS8-03 — Every engine fabricates a favourable result from empty/absent input rather than refusing (cross-cutting; see WS1A08/WS1B02/WS1C03)
- Area: engine / edge-case
- Location: `mfr.controller.js` (empty body → 93.7%/"Aligned", per WS1B02), `chronic.controller.js` (missing `activity` → +20 IDRS best-case, missing biomarkers → Normal, per WS1A08/WS1A10), `mental.controller.js` (`computeMentalResult({})` → partner_overall 78 / headline 100, per WS1C03)
- Status: Confirmed (reproduced by the WS1 agents via direct function calls; HTTP path is auth-gated so not re-runnable anonymously)
- Root cause: pervasive "default missing input to the healthiest value" pattern across all three engines, with no "insufficient data → not assessed / pending" state.
- Impact: user-trust / clinical-safety — absence of data produces a confidently favourable number, the single most consistent systemic defect across the engines. A user who skips/partially-fills is shown an above-average result as if earned.
- Best-fit fix (hint): introduce an explicit `insufficient_data` / `not_assessed` return state per engine when required inputs are absent, and have `computeGatedComposite` treat a not-assessed domain as *absent* (already renormalizes correctly — WS0-01) rather than blending a fabricated favourable score. This is a large cross-cutting theme, best phased engine-by-engine.
- Effort: L (cross-cutting)

### WS8-04 — Mental fallback reachability on the story page (reachability determination)
- Area: frontend
- Location: `frontend/src/app/core-engine/story/page.js:176,358,580,585` (`mentalResult...score || 80`) vs `:477` (`|| 'Highly Aligned'`)
- Status: Confirmed (static guard-trace; browser hard-nav repro blocked by WS8-01)
- Evidence: grep + read — the four `|| 80` numeric fallbacks are all INSIDE `if (mentalResult) { … }` (lines 175, 355) or after `if (!mentalResult) return 'Pending'` (476), so an ABSENT mental domain does NOT reach them (it correctly shows "Pending" / adds to `pendingDomains` at :659). They only fire if a mental result EXISTS but a sub-field is falsy — e.g. a genuine `overall_readiness.score` of 0 renders as **80** (`0 || 80`), and a missing label at :477 fails **open** to the fabricated-positive **`'Highly Aligned'`**. Browser confirmation of the story render was blocked by WS8-01 (context-only pages don't survive hard nav), so reachability is established by guard-trace, not a live screenshot.
- Impact: user-trust — low-probability but real: a real worst-case mental score of 0 shows as 80; a mental result missing its label shows "Highly Aligned". The `:477` fail-open-to-positive is the more concerning of the two.
- Best-fit fix (hint): use `??` not `||` for the numeric score defaults (so a real 0 survives), and replace the `|| 'Highly Aligned'` label default with a neutral "Not scored" rather than a fabricated positive. Cross-ref WS6 for the full frontend fallback sweep.
- Effort: S

---

## Scratch scripts (this file)
- `backend/scratch/seed_ws8_incomplete.js` — seeds a completed match with chronic+fertility present, mental absent, blank prospect name (disposable, phone `+19990150001`).
- `backend/scratch/browser_ws8.js` — Playwright drive of dashboard→story→usg for the incomplete seed; established WS8-01.
