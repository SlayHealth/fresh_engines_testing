# WS0 — Lead reviewer's own inline empirical probes

These are findings the lead reviewer confirmed by directly running probe scripts (not delegated). They
may overlap with the parallel WS1/WS2 agent files — where they do, this file holds the primary
reproduction evidence. Schema per `review/_review_schema.md`.

Probe scripts live in `backend/scratch/` (throwaway, gitignored-intent, listed in the master appendix).

---

## Composite engine (`computeGatedComposite`) — empirical confirmation

### [P2→resolved] WS0-01 — Composite renormalization is mathematically correct (CONFIRMED GOOD)
- Area: engine
- Location: `backend/src/services/compatibility/reportGeneration.service.js:88-142`
- Status: Confirmed (reproduced)
- Evidence: `node backend/scratch/probe_composite_sti.js`:
  - all three domains = 80 → crossDomain **80** (weighted mean of equal values).
  - chronic=90 (w .35) + mental=60 (w .20), no others → crossDomain **79.09**, exactly matching `(90*.35+60*.20)/(.35+.20)`. Renormalization over present domains is correct and always sums weights properly.
  - no domains present → crossDomain **null** (pending), not a fabricated number.
- Root cause: n/a — this is a *negative* finding: the prior-audit concern about composite single-sourcing/renormalization is resolved. `computeGatedComposite` is the sole writer and its weighted-mean-over-present-domains is sound.
- Impact: correctness (positive)
- Best-fit fix: none needed. Recorded so the implementer does NOT waste a phase "fixing" this.
- Effort: —

### [P0] WS0-02 — STI safety gate misses "Positive"/"Detected"-vocabulary lab results (false negative → clinically unsafe)
- Area: engine (clinical safety gate)
- Location: `backend/src/services/compatibility/reportSummary.service.js:145,157,168,179,190` (the `/reactive/i` and `/detected/i` matchers)
- Status: **Confirmed (reproduced)**
- Evidence: `node backend/scratch/probe_composite_sti.js` — feeding `hbsag_qualitative_result_reactive_non_reactive`:
  - `"REACTIVE"` → triggered **true** ✓
  - `"Weakly Reactive"` → triggered **true** ✓
  - `"Positive"` → triggered **FALSE** ✗ — a lab that reports HBsAg/HIV as "Positive"/"Negative" (extremely common in real Indian lab reports for qualitative serology) is silently treated as clear.
- Root cause: the gate only recognizes the "Reactive"/"Detected" vocabulary. Syphilis/HBsAg/HCV/HIV-antibody results are frequently reported as "Positive"/"Negative" or "Present"/"Absent" depending on the lab and assay, none of which match `/reactive/i` or `/detected/i`.
- Impact: **clinical-safety** — a couple where one partner has active, lab-confirmed Hepatitis B/C, HIV, or syphilis reported with "Positive" phrasing receives a normal (un-capped, potentially >90) compatibility score and no safety warning. This is the exact failure the gate exists to prevent.
- Best-fit fix (hint): broaden each matcher to a positive-result vocabulary — `/reactive|positive|present|detected/i` with the negative guard `!/non[- ]?reactive|negative|not[- ]?detected|absent/i`. BUT this is coupled to WS2: the real fix must be coordinated with what `parameterExtractor.service.js` actually emits for qualitative serology (if the extractor already normalizes "Positive"→"Reactive", the gate is fine and the bug is only for un-normalized values — verify the extractor's qualitative normalization first). Consider centralizing a single `isReactivePositive(str)` helper used by both extractor and gate so they can never drift.
- Effort: S (matcher) / M (if extractor normalization must change too)
- Blast radius: touches the one gate function; low risk, but MUST be regression-tested against the "Non-Reactive" negatives below so the broadened matcher doesn't start false-positiving.
- Guideline ref: qualitative serology reporting conventions — NACO (India) HIV testing uses "Reactive/Non-Reactive"; many private labs use "Positive/Negative" for HBsAg/anti-HCV. (validation-pass to confirm exact current conventions.)

### [P0] WS0-03 — STI gate's `!/non/i` guard is over-greedy → a genuinely reactive result containing the substring "non" is wrongly cleared (false negative)
- Area: engine (clinical safety gate)
- Location: `backend/src/services/compatibility/reportSummary.service.js:145` (`/reactive/i.test(x) && !/non/i.test(x)`) — same pattern at 157, 168 (`!/not/i`), 179, 190
- Status: **Confirmed (reproduced)**
- Evidence: `node backend/scratch/probe_composite_sti.js` — `hbsag = "Reactive (non-specific pattern)"` → triggered **FALSE**. The `!/non/i` guard, intended to exclude "Non-Reactive", also excludes ANY string containing "non" anywhere — so a reactive result annotated with "non-specific", "nonreactive controls valid", etc. is silently dropped.
- Root cause: the negative-guard regex `/non/i` is an unanchored substring test rather than matching the specific token "non-reactive". Any incidental "non" in the free-text result cancels a true positive.
- Impact: **clinical-safety** — same as WS0-02: real reactive result → normal high score, no warning.
- Best-fit fix (hint): replace `!/non/i` with a precise negative match `!/non[- ]?reactive/i` (and the HIV-P24 `!/not/i` with `!/not[- ]?detected/i`). Better: the centralized `isReactivePositive()` helper from WS0-02 with a whitelist of positive tokens and a precise negative-token exclusion, tested against a fixture table of real result strings.
- Effort: S
- Blast radius: same gate function; regression-test against "Non-Reactive"/"Nonreactive" (must stay false) and "Weakly Reactive" (must stay true).

### [P2] WS0-04 — STI gate silently treats equivocal/indeterminate as clear (defensible default, but undocumented and unsurfaced)
- Area: engine
- Location: same matchers, `reportSummary.service.js:145-197`
- Status: Confirmed (reproduced)
- Evidence: probe — `"Equivocal"` and `"Indeterminate"` → triggered **false**. These grey-zone serology results (which clinically warrant repeat/confirmatory testing) neither trip the gate nor surface any "needs retest" flag.
- Root cause: only exact-positive vocabulary trips the gate; everything else is treated as pass.
- Impact: correctness / user-trust — a couple with an equivocal HIV/HCV result is shown a clean score with no prompt to confirm. Lower severity than WS0-02/03 (equivocal ≠ confirmed positive) but a real gap in a safety feature.
- Best-fit fix (hint): add a third state to the gate — `equivocal`/`indeterminate`/`borderline` → don't cap the score, but attach a non-blocking "confirmatory testing recommended" advisory to the report. Ties into the WS4 opportunity for confirmatory-test logic.
- Effort: M

### [P2] WS0-05 — STI gate is silently coupled to exact canonical param keys; an extractor key drift = total gate bypass
- Area: engine / pipeline seam
- Location: `reportSummary.service.js:143,156,167,178,189` (hardcoded param names like `vdrl_rpr_result_reactive_non_reactive`) vs. `backend/src/services/parser/ontologyMapper.service.js`
- Status: Suspected (needs WS2 corroboration — flagged to WS2 agent)
- Evidence: static — the gate reads five exact canonical keys; if `ontologyMapper` maps a lab's syphilis/HIV line to any other key (or fails to map it), `getVal` returns null and the gate never fires. No test asserts the gate's keys match the ontology's emitted keys.
- Root cause: two independently-maintained string contracts (extractor output keys ↔ gate input keys) with no shared constant or test binding them.
- Impact: clinical-safety (potential total bypass) / data-integrity
- Best-fit fix (hint): share the five canonical STI param names as exported constants consumed by both the ontology map and the gate; add a test asserting every gate key exists as a `canonical_name` in the ontology. See WS2 for the extractor side.
- Effort: S

---

## MFR absolute-barrier gate — empirical confirmation

### WS0-06 — MFR absolute-barrier gate is NOT leakable by positive modifiers (CONFIRMED GOOD)
- Area: engine
- Location: `backend/src/controllers/mfr.controller.js:457-459` (gate composition), applied at `477,478,487,488,492,493`
- Status: Confirmed (static, structurally exhaustive)
- Evidence: `gate` is a single boolean OR of all barrier conditions (b_tubal/b_azoo/b_uterus/CBAVD/physicalBlock/geneticBlock/serverDetectedAzoospermia/severeOvarianReserve). It is applied as `gate ? 0 : (...)` at **every** probability output — monthly current/optimised, each of the 11 projection years, and both 12-month cumulatives. Modifiers only affect `bioNow`/`bioY`, which are multiplied by the zeroed path when gate is true. There is no code path where a modifier is added after the gate. The brief's single highest-priority clinical-safety question is answered: **no leak**.
- Root cause: n/a (positive finding).
- Best-fit fix: none. NOTE the *detection* completeness is a separate concern — `serverDetectedAzoospermia = calculatedSemen?.details === 'Azoospermia'` (line 455) is an exact-string match; if the semen classifier emits a different label the gate won't fire. That detection-seam is delegated to the WS1B agent to confirm.
- Effort: —

---

## §5 prior-audit items — empirical re-verification

### [P1] WS0-07 — `usg/page.js` still ships hardcoded fake partner names + age fallback (user-trust)
- Area: frontend
- Location: `frontend/src/app/core-engine/usg/page.js:41-42` (`|| 'Sachin'` / `|| 'Swati'`), `:45` (`return 30`)
- Status: **Confirmed (static)** — re-verified current state, NOT parroting the old audit.
- Evidence: lines 41-42 read `const maleName = isUserMale ? (user?.name || 'Sachin') : (prospectForm?.name || 'Sachin');` and the female equivalent with `'Swati'`. `calculateAge` returns `30` when `dobString` is missing (line 45).
- Root cause: leftover dev placeholders never wired to a "not available" state.
- Impact: user-trust — if a real report loads with a missing name/DOB, the USG tab shows a stranger's name ("Sachin"/"Swati") and a fabricated age of 30 as if real.
- Best-fit fix (hint): fall back to a neutral label ("Partner A"/"Partner B", already the app's convention elsewhere) and render age as "—"/"Age not provided" instead of 30. Confirm whether these fallbacks are even reachable given upstream guards (needs the browser repro in WS6/WS8) — severity is P1 if reachable with real data, P3 if structurally unreachable.
- Effort: S

### [P1/P2] WS0-08 — `story/page.js` `calculateDynamicScore` local fallbacks (`?? 85`, `?? 15`, `|| 80`) — reachability determines severity
- Area: frontend
- Location: `frontend/src/app/core-engine/story/page.js:159,168,176,308,310,312,335-337,358,421,424,437,438,535,559,568,580,585` (numerous `?? 85` / `?? 15` / `|| 80`)
- Status: Suspected (needs browser repro — delegated to WS6 agent + lead browser pass)
- Evidence: static grep confirms the fallbacks are present and numerous. Two distinct classes: (a) `currentCurve[year] ?? 85|15` — array-index fallbacks on the projection curves, likely only hit during chart-year interpolation when a curve is short; (b) `mentalResult.overall_readiness?.score || 80` at 176/358/580/585 — renders "80% attachment alignment" as **narrative prose** and headline reveal values. Class (b) is the concern: if a real match has chronic+fertility but no mental domain, does the story tab still reach these lines and show a fabricated 80? Line 176 also does `mentalResult.overall_readiness?.score` which would throw if `mentalResult` is null — so there's likely an upstream guard; that guard's exact condition determines whether (b) is reachable.
- Root cause: display-layer recomputation (`calculateDynamicScore`) with silent numeric defaults, separate from the backend's authoritative gated composite.
- Impact: user-trust (fabricated value shown as real) IF class (b) is reachable with real incomplete data; otherwise cosmetic (chart interpolation only).
- Best-fit fix (hint): replace `|| 80` narrative defaults with an explicit "mental wellbeing not completed — add it to see this" state (the app already has an "Add Mental Wellbeing" CTA pattern). For the curve `?? 85|15` interpolation defaults, confirm they only ever fill a genuinely-absent projection year and never a real datapoint.
- Effort: M

### [P0] WS0-09 — "DPDP-compliant" asserted present-tense to users while the app admits compliance is unbuilt (false compliance claim)
- Area: regulatory / frontend
- Location: claim at `frontend/src/app/dashboard/MobileHomeView.js:169` ("…DPDP-compliant."); contradiction at `frontend/src/app/profile/page.js:250,394` ("DPDP compliance and HIPAA compliance coming soon")
- Status: **Confirmed (static)**
- Evidence: MobileHomeView line 169 renders, as a user-facing trust line, "Encrypted end to end. Nothing is shared with your partner or family until you say so. DPDP-compliant." Profile page line 394 renders "DPDP compliance and HIPAA compliance coming soon" and line 250 toasts the same. The two live user-facing surfaces directly contradict; per the brief, one is false — and the profile "coming soon" is the honest one, making the dashboard claim the false statement.
- Root cause: aspirational marketing copy shipped as present-tense fact.
- Impact: **legal-regulatory** — a false statutory-compliance claim about sensitive health data under the DPDP Act 2023, shown to every user on the home screen.
- Best-fit fix (hint): remove "DPDP-compliant" from the dashboard trust line (and audit all other surfaces for the same claim — landing pages included) until compliance is actually substantiated and legally reviewed. This is copy-only and low-effort to remove; the underlying compliance work is a separate, large track. Frame downstream as "requires qualified legal/regulatory review, not a code fix alone."
- Effort: S (remove claim) / L (actually achieve compliance)
- Blast radius: copy change only; but coordinate with a claims sweep (WS-REG) so all instances go together.

### [P1] WS0-10 — "Doctor Reviewed" trust badge with no clinician-review artifact anywhere in repo
- Area: regulatory / frontend
- Location: `frontend/src/app/page.js:89`, `frontend/src/components/landing/TrustSignals.js:67` (both render "Doctor Reviewed"); the only "psychologist"/"doctor" reference in backend is an LLM system-prompt persona string at `backend/src/controllers/mental.controller.js:253`
- Status: **Confirmed (static)** — grep across repo finds the badge in 2 live JSX locations and no supporting documentation of any actual clinician review of the engines/reports/content.
- Impact: legal-regulatory / user-trust — an unsubstantiated "Doctor Reviewed" claim on a health product's landing page.
- Best-fit fix (hint): either obtain and document a genuine clinical review and cite it, or remove/soften the badge (e.g. "Built on published clinical guidelines" — which is at least partially true given the WHO/IDRS references). Legal/regulatory review required. Note the scoping doc mentioned up to 4 files; grep confirms 2 in `src/` — verify whether `landingContent.js`/`PersonaSection.js` also carry it before a removal sweep.
- Effort: S (remove) / external (obtain real review)

---

### [P2] WS0-11 — AFC ovarian-reserve path is dead for report data: MFR reads canonical `'afc'` which the ontology never defines
- Area: engine / pipeline seam
- Location: `backend/src/controllers/mfr.controller.js:234` (`findExtractedParam(parsedFemaleData, 'afc')`) vs `backend/src/services/parser/ontologyMapper.service.js` (no `canonical_name: 'afc'` among the 156 canonicals)
- Status: **Confirmed (static, grep-verified)** — surfaced by the WS4 ideation pass, verified here.
- Evidence: `grep -c canonical_name ontologyMapper.service.js` = 156; `grep "canonical_name.*afc"` = none. `'afc'` appears only in a FEMALE_MARKERS *expectation* array (`ontologyMapper.service.js:1646`), never as an extractable canonical with aliases/section. So `findExtractedParam(femaleData,'afc')` returns undefined for all real report data, and `classifyOvarianReserve(amh, undefined, age)` runs AMH-only. `classifyByAfc` and the AFC bands (which WS3A validated) are effectively dead for report-sourced inputs.
- Root cause: the MFR controller consumes a canonical the ontology never learned to extract — an extractor/consumer contract gap (same family as WS0-05, WS2-03, WS6-01).
- Impact: correctness — ovarian-reserve classification silently degrades to single-marker (AMH-only) whenever AFC would have come from a report; a woman with a normal AMH but low AFC (a real discordance pattern) is mis-classified. AFC can still arrive via manual entry if the client sends it, but never via the pathology extraction path.
- Best-fit fix (hint): add an `afc` canonical to the ontology (aliases: "AFC", "Antral Follicle Count", "antral follicles") OR, if AFC is only ever manual, remove the dead report-extraction read and document AFC as manual-only. Confirm which via the client's AFC capture path.
- Effort: S

---

## Scratch scripts (this file)
- `backend/scratch/probe_composite_sti.js` — composite renormalization + STI gate cap + STI vocabulary/false-negative matrix.
