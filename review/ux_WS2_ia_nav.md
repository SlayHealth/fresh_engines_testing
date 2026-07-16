# WS2 — Information Architecture & Navigation

**Reviewer workstream:** WS2 (IDs `UX2-NN`). Driven live in headless Chromium at mobile (390×844) and
desktop (1440×900) against seeded couples `clean` (score 88, full report) and `empty` (first-run).
Screenshots in `backend/scratch/ux_shots/` (prefix `ux2_`, plus shared `ux_` dashboard/report shots).
Read-only on code. Governing rule honoured: mobile is the locked reference; the `core-engine/story`
"Premarital Sync" narrative rendering on mobile is the **deliberate report UI** (per Report-UI note) and
is NOT filed as a reconcile defect.

**Surfaces mapped**
- Global bottom nav `frontend/src/components/MobileBottomNav.js` (mobile only; `lg:hidden`).
- Report tab shell `frontend/src/app/core-engine/layout.js` — desktop left sidebar (l.130-199) + mobile
  top-header hamburger drawer (l.116-127, 202-270); 7 nav items (l.96-108).
- Dashboard→report entry points: mobile Recent card (`dashboard/MobileHomeView.js:119-132`), desktop
  Recent Activity list + "View Reports" (`dashboard/page.js:291-349`).
- Genomics stub `frontend/src/app/core-engine/genomics/page.js`.

---

## Lead summary (dead-ends first)
- **Genomics tab reads as a broken/dead tab** (UX2-01): the nav item looks identical to working tabs,
  and the placeholder sits inside the full report shell.
- **"Support" nav button is dead** on both sidebar and drawer (UX2-02).
- **"Stress Resilience" report-nav item silently exits the report into a questionnaire** (UX2-03).
- **One destination, 5+ names** — "Analysis" / "Premarital Sync" / "Partner Sync" / "Your Health Story"
  / "View Reports" (UX2-04): no coherent mental model of "the report."
- **Refresh inside the report dumps a logged-in user on the public marketing landing page** (UX2-05, ref
  WS8-01).
- Bottom-nav touch targets are well-sized (91×62, measured); the Analysis disabled state is legible and
  well-explained (UX2-09, positive).

---

### [P2] UX2-01 — Genomics tab looks fully functional but is an empty "Coming Soon" shell
- Flow / Screen: Report → Genetics Risk tab. `core-engine/genomics/page.js:1-20`; nav item
  `core-engine/layout.js:107`.
- Viewport: both
- Status: Observed — `ux_report_genomics_mobile.png`, `ux_report_genomics_desktop.png`,
  `ux_report_genomics_desktop_full.png`.
- Evidence: In the desktop sidebar and mobile drawer, "Genetics Risk" is rendered with the exact same
  affordance as the working tabs (Chronic Risk, Organ Wellness, etc.) — no lock icon, no "Soon" badge,
  no dimming — and it even takes the active pink highlight when selected. Clicking it lands on a
  near-empty page: one sparkle icon, a heading, two sentences, and "Currently Coming Soon under Premium
  plans." Critically, that placeholder inherits the **entire report chrome**: the "Premarital Sync" H1 +
  subtitle "A comprehensive, projected view of your joint health trajectory…", "Back to Dashboard",
  **"Download PDF Report"**, the quota strip, "Scan Another Prospect", and "Consult AI Counselor". On
  desktop the vast empty white area below the short centred text reinforces "unfinished / broken."
- UX impact: comprehension + trust. In a health product, a tab that presents as live but yields nothing
  invites "is my genetic/carrier data being analysed or not?" The surrounding "Download PDF Report"
  button implies content that isn't there. Compounded by naming drift (see below).
- Heuristic: match between system and real world; visibility of system status; consistency.
- Root cause: IA/design — a not-built feature is exposed as a first-class, identical-looking nav
  destination (the stub existence itself is the known engine finding; here it's the nav/trust angle).
- Naming inconsistency (part of this finding): the same feature is called **"Genomics Report"** on the
  dashboard hub (`dashboard/page.js:120`) and profile (`profile/page.js`), **"Genetics Risk"** in the
  report nav (`layout.js:107`), and **"Genetics & Infection Carrier Risk"** on the page heading — three
  names for one thing.
- Best-fit direction: mark the nav item as not-yet-available (lock/"Soon" pill + muted styling, matching
  how Radiology reads "Locked" on the health hub), and when opened suppress the report chrome that
  implies a live report (hide "Download PDF Report", "Consult AI Counselor" on this tab). Unify the label
  to one name across all surfaces.
- Effort: S
- Blast radius: `layout.js` nav rendering + genomics page; label constants shared with dashboard/profile.

### [P2] UX2-02 — "Support" nav button is a dead-end (no action)
- Flow / Screen: Report sidebar (`layout.js:186-189`) and mobile drawer (`layout.js:255-258`).
- Viewport: both
- Status: Observed — driver `ux_nav3.js`: clicking Support leaves the URL unchanged
  (`/core-engine/story` → `/core-engine/story`), and the button has no `onClick` in code.
- Evidence: The Support button renders with icon + label like the adjacent working "Profile" button, but
  nothing happens on click — no route, no modal, no toast.
- UX impact: friction + trust — a visible "get help" affordance that does nothing is worse than none,
  especially in a health context where users may be anxious about a result.
- Heuristic: help & documentation; error prevention (dead controls).
- Root cause: code — missing handler.
- Best-fit direction: wire to a real support surface (mailto, WhatsApp — note the profile page already
  exposes "WhatsApp Messages (Admin)"), or remove until built.
- Effort: S
- Blast radius: `layout.js` (two instances).

### [P2] UX2-03 — "Stress Resilience" report-nav item silently leaves the report into a form
- Flow / Screen: Report nav item "Stress Resilience" → `router.push('/add-prospect?enter=mental')`
  (`layout.js:105`).
- Viewport: both
- Status: Observed — `ux_nav3.js`: clicking "Stress Resilience" in the sidebar lands on `/add-prospect`;
  `ux2_stress_resilience_lands_desktop.png`.
- Evidence: Six of the seven items in the report nav (Partner Sync / Fertility Timeline / Chronic Risk /
  Organ Wellness / Genetics Risk, plus Dashboard) are in-shell tabs. The seventh, "Stress Resilience,"
  routes OUT of the report into the mental-wellbeing questionnaire — even when mental is already complete
  there is no results view; it always opens the form. The user is dumped out of the report chrome into a
  full-screen wizard with no bottom nav.
- UX impact: mental-model break + friction. Items grouped as peers behave in two different ways (view vs
  fill-a-form), with no signal which is which.
- Heuristic: consistency & standards; user control (unexpected context switch).
- Root cause: IA — a data-entry entry point is placed in a results-navigation list.
- Best-fit direction: if mental is incomplete, badge the item ("Add Stress Resilience →") so the context
  switch is expected; once complete, route to an actual results tab, not back into the form.
- Effort: M
- Blast radius: `layout.js` menuItems + add-prospect mental sub-hub.

### [P2] UX2-04 — One destination, five-plus names (no coherent "report" mental model)
- Flow / Screen: cross-surface. Bottom nav "Analysis" (`MobileBottomNav.js:208`) → page H1 "Premarital
  Sync" (`layout.js:279`) → sidebar active item "Partner Sync" (`layout.js:98`) → story content "Your
  Health Story" / "Health Together Index" (`story/page.js`) → dashboard entry "View Reports"
  (`dashboard/page.js:293`) and the mobile Recent card.
- Viewport: both
- Status: Observed — `ux_report_story_mobile.png`, `ux_report_story_desktop.png`, `ux_dash_clean_*`.
- Evidence: To reach and name the same artefact the user must reconcile: Analysis (nav) = Premarital Sync
  (title) = Partner Sync (first tab) = Health Story (body) = "Reports" (dashboard). The page H1 stays
  "Premarital Sync" on every tab, so it never confirms which sub-view you opened either.
- UX impact: comprehension — hard to form "where the report lives / what it's called," and hard to refer
  to it ("open your Analysis? your Sync? your Report?").
- Heuristic: consistency & standards; recognition over recall.
- Root cause: copy/IA — labels authored per-surface without a shared vocabulary.
- Best-fit direction: pick one product name for the compiled report and use it in the bottom nav, the
  dashboard CTA, and the H1; let the H1 reflect the active tab ("Premarital Sync · Fertility Timeline").
- Effort: M
- Blast radius: bottom nav, layout header, dashboard, story tab — shared label set.

### [P2] UX2-05 — Two parallel navigations stacked on the mobile report (bottom nav + hamburger drawer)
- Flow / Screen: Mobile report — global bottom nav (`MobileBottomNav.js`, visible because
  `!pathname.startsWith('/add-prospect')`) coexists with the report's own hamburger drawer
  (`layout.js:202-270`).
- Viewport: mobile
- Status: Observed — `ux2_report_drawer_mobile.png`.
- Evidence: On the report, the bottom nav (Home / Health / Chat AI / Analysis) stays pinned AND the
  report exposes its own 7-item drawer. Two active indicators light at once — "Analysis" is pink/active
  in the bottom nav while "Partner Sync" is pink/active in the drawer. The relationship between the
  bottom-nav "Analysis" tab and the drawer's tabs is never explained. Additionally the drawer's own
  footer ("Support", under "Upgrade Plan") is clipped behind the floating bottom nav.
- UX impact: comprehension + friction — competing nav systems on one screen; unclear which controls the
  report; a clipped drawer footer.
- Heuristic: consistency; minimalist design (two navs where one suffices).
- Root cause: IA — the report layout ships a full nav system while the global bottom nav is not
  suppressed on `/core-engine`.
- Best-fit direction: on `/core-engine`, either suppress the global bottom nav (let the report own its
  chrome) or drop the report's redundant drawer and drive tabs from a single system; ensure the drawer
  footer clears the bottom nav.
- Effort: M
- Blast radius: bottom-nav gating + report layout.

### [P2] UX2-06 — Mobile report gives no visible "current tab" without opening the drawer
- Flow / Screen: Mobile report tab shell (`layout.js` mobile header/drawer).
- Viewport: mobile
- Status: Observed — `ux_report_story_mobile.png` vs `ux_report_genomics_mobile.png` (H1 identical on
  both).
- Evidence: The drawer is closed by default and the H1 "Premarital Sync" is constant across tabs, so on
  any given report screen there is no persistent indicator of which of the 7 sections you are viewing —
  you must open the hamburger to see the highlighted item. Desktop shows this clearly in the sidebar.
- UX impact: orientation/wayfinding — "where am I in the report?" is unanswerable at a glance on mobile.
- Heuristic: visibility of system status.
- Root cause: design — no on-screen active-tab breadcrumb on mobile.
- Best-fit direction: show the active section name near the header (e.g. subtitle or a compact tab strip)
  so the current tab is visible without opening the drawer.
- Effort: S
- Blast radius: report layout mobile header.

### [P2] UX2-07 — No persistent global navigation on desktop outside the report
- Flow / Screen: Desktop dashboard, profile, questionnaire vs the report's left sidebar.
- Viewport: desktop
- Status: Observed — `ux_dash_clean_desktop.png`, `ux5_profile_desktop_full.png`, `ux5_quest_about_desktop.png`
  (no nav chrome) vs `ux_report_story_desktop.png` (sidebar present).
- Evidence: The bottom nav is `lg:hidden`, and the left sidebar exists only inside `/core-engine`. On the
  desktop dashboard/profile/questionnaire there is no persistent nav at all — movement relies entirely on
  in-page buttons (avatar→profile, Recent Activity→report, CTA→new check, back arrows). Mobile, by
  contrast, carries the bottom nav on every authenticated surface.
- UX impact: consistency + findability — desktop users get weaker, surface-dependent wayfinding than
  mobile; e.g. from the desktop profile the only way back is a single back arrow.
- Heuristic: consistency & standards; user control & freedom.
- Root cause: IA — global nav implemented mobile-only; desktop nav implemented only within the report.
- Best-fit direction: give desktop a persistent nav shell (reuse the report sidebar, or a top bar) across
  dashboard/profile/questionnaire so the four primary destinations are always reachable.
- Effort: M
- Blast radius: app-level layout / shared shell.

### [P2] UX2-08 — Bottom-nav "Health" tab routes to a screen where the bottom nav disappears
- Flow / Screen: Bottom nav "Health" → `/add-prospect` (`MobileBottomNav.js:185-187`); nav returns null
  on `/add-prospect` (`MobileBottomNav.js:116`).
- Viewport: mobile
- Status: Observed — `ux_nav2.js`/`ux_deeplink.js`: after tapping Health, `bottomNavPresent === false`;
  `ux2_health_tab_landing_mobile.png`, `ux5_quest_hub_mobile.png`.
- Evidence: Tapping "Health" opens the "Health profile" hub, on which `MobileBottomNav` deliberately
  renders nothing (the whole-viewport wizard rule). So the persistent anchor vanishes on the very surface
  one of its own tabs points to; the active-Health-tab styling (`isActive('/add-prospect')`, l.185) can
  never actually render. The only way back is the small top "‹ Dashboard" link.
- UX impact: consistency + minor disorientation — the nav that got you there is gone, and there's no
  active-state confirmation you're on "Health."
- Heuristic: consistency; visibility of status.
- Root cause: IA — the persistent tab targets a route that intentionally suppresses the persistent tab.
- Best-fit direction: keep the bottom nav on the health-profile hub (`/add-prospect` landing, distinct
  from the per-question step screens where hiding it is justified), or route "Health" to a hub that
  retains the nav.
- Effort: S
- Blast radius: `MobileBottomNav` gating logic.

### [P1] UX2-09 — Refreshing inside the report drops the user on the public marketing landing (ref WS8-01)
- Flow / Screen: Report page reload; auth/data guard `core-engine/layout.js:53-60`.
- Viewport: both (verified mobile)
- Status: Observed — `ux_deeplink.js`: `/core-engine/story` reload → final URL `/`;
  `ux2_refresh_report_mobile.png` shows the "Your Future Is Everything!" marketing landing with a
  "Continue" CTA.
- Evidence: A hard `goto` of a report URL bounces *softly* to `/dashboard`
  (`ux2_deeplink_story_desktop.png`), but a **refresh while inside the report** lands the authenticated
  user on the public marketing/landing page — i.e. it looks like being logged out. This is the known
  context-only behaviour (WS8-01); the UX angle logged here is the *destination*: the landing page, not
  the dashboard.
- UX impact: drop-off + trust — losing your place mid-report and being shown a signup pitch is
  disorienting and undermines "my data/session is stable."
- Heuristic: user control & freedom; consistency (deep-link bounce goes to dashboard, refresh to
  landing).
- Root cause: IA/state — report state is context-only and not rehydrated on reload (root cause owned by
  WS8-01; do not re-diagnose).
- Best-fit direction: on report reload, rehydrate from the last active match (or redirect to
  `/dashboard`, never `/`), so a refresh never surfaces the logged-out landing.
- Effort: M (overlaps WS8-01 remediation)
- Blast radius: report layout guard + session rehydration.

### [P3 · positive] UX2-10 — Analysis disabled/enabled state is legible and well-explained
- Flow / Screen: Bottom nav "Analysis" (`MobileBottomNav.js:154-209`).
- Viewport: mobile
- Status: Observed — `ux_dash_empty_mobile.png` (disabled, dimmed), `ux_dash_clean_mobile.png` (enabled),
  `ux2_analysis_disabled_toast.png`.
- Evidence: In first-run (`empty`), the Analysis tab is visibly dimmed (`disabled` class) and Chat AI
  renders as a plain tab rather than the elevated green FAB. Tapping the disabled Analysis fires a clear,
  well-written toast: "Your analysis will show up here once you've completed a compatibility check —
  finish your details and add a prospect first." Once a match exists (`clean`), Analysis brightens and
  Chat AI becomes the FAB. The control stays a real button (not `aria-disabled`), so the explanation is
  reachable by keyboard/AT.
- UX impact: positive — the locked state is understandable and actionable.
- Minor watch-outs (P3): (a) the nav *layout* shifts between states — a flat 4-tab bar (empty) vs a
  centre FAB popping up (clean) — a small consistency wobble; (b) the disabled affordance leans on
  opacity/colour alone (verify contrast — hand to WS6). Not defects; noted for completeness.
- Effort: —
- Blast radius: —

---

## Opportunities (WS2)
- **OPP-UX-21 ★** (fixes UX2-04): adopt a single product name for the compiled report and thread it
  through bottom nav → dashboard CTA → report H1 → PDF. Benefit: users can find, name, and re-find the
  report. Effort S–M. Impact: high (comprehension backbone).
- **OPP-UX-22 ★** (fixes UX2-05/UX2-07): unify navigation into one system per viewport — a persistent
  desktop shell reusing the report sidebar, and a single mobile system (bottom nav OR report drawer, not
  both stacked). Effort M. Impact: high (consistency across the whole app).
- **OPP-UX-23** (fixes UX2-01): a shared "not yet available" nav treatment (lock/"Soon" pill + muted
  styling + chrome suppression) reusable by Genomics now and any future locked tab. Effort S. Impact:
  medium (trust).
