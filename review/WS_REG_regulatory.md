# WS_REG — Regulatory / Claim-Framing sub-track

Deep-review workstream: regulatory exposure and claim-framing risk for SlayHealth (India-focused
premarital health-compatibility app). Schema per `review/_review_schema.md`. IDs prefixed `REG`.

> **Framing disclaimer (applies to every finding below).** The author is **not a lawyer**. Nothing
> here is a legal conclusion or a compliance determination. Each item is **risk identification that
> requires qualified legal / regulatory review** by counsel competent in Indian medical-device
> (CDSCO / MDR 2017) and data-protection (DPDP Act 2023 / DPDP Rules 2025) law. Statements about
> what the code/UI *says* are grounded in cited `file:line`; statements about the *regulatory
> framework* are grounded in cited web sources with dates. The mapping from one to the other is
> exactly what needs professional adjudication.

Regulatory context sources (retrieved 2026-07-15):
- CDSCO **Draft Guidance on Medical Device Software** issued **2025-10-21**; SaMD = standalone
  software performing a medical purpose; "standalone clinical decision support tools … and software
  that synthesizes or interprets patient data" are cited examples that may qualify; risk-based
  Class A–D driven by (1) significance of the information the software provides and (2) seriousness
  of the healthcare situation. Sources: Cyril Amarchand India Corporate Law (2026-01), Asia Actual,
  Business Law Chamber, Freyr — all 2025-26.
- **DPDP Act 2023** enacted 2023-08-11; **DPDP Rules 2025** notified by MeitY **2025-11-13**, phased:
  Phase I immediate, consent-manager provisions by 2026-11-13, substantive compliance obligations
  (Phase III) from **2027-05-13**. Seven principles: consent & transparency, purpose limitation,
  data minimisation, accuracy, storage limitation, security safeguards, accountability. Sources:
  PIB DPDP Rules 2025 PDF, EY India DPDPA guide, Cyril Shroff FAQs — all 2025.

---

### [P0] REG-01 — False present-tense "DPDP-compliant" claim shown to users, contradicted by the app's own "coming soon" admission
- Area:        regulatory / frontend
- Location:    `frontend/src/app/dashboard/MobileHomeView.js:169` (claim); contradicted by
  `frontend/src/app/profile/page.js:394` and `frontend/src/app/profile/page.js:250` (admission)
- Status:      Confirmed (static — exact strings read)
- Evidence:    Dashboard trust line renders, present tense, to every logged-in user:
  `"Encrypted end to end. Nothing is shared with your partner or family until you say so. DPDP-compliant."`
  (`MobileHomeView.js:169`). The **same app's** profile page states DPDP compliance is a future item:
  `"DPDP compliance and HIPAA compliance coming soon"` (`profile/page.js:394`) and a toast reading
  `"DPDP compliance and HIPAA compliance coming soon."` (`profile/page.js:250`). The two screens
  directly contradict each other; the second is an in-product admission that the state asserted by
  the first does not yet exist. No compliance/consent/retention implementation was found in the repo
  to substantiate the assertion (no privacy-policy page, terms, retention config, or consent ledger
  surfaced in searches).
- Root cause: A hard-coded marketing/trust string asserting statutory compliance the product's own
  UI says is not yet built.
- Impact:      legal-regulatory / user-trust. Publicly asserting compliance with a named statute you
  do not have is the archetypal misrepresentation exposure — and it concerns **health data**, the
  most sensitive processing context. Per the review brief, a false statutory-compliance claim shown
  to users is **P0**. Note also the substantive DPDP compliance obligations are themselves only in
  force from 2027-05-13 (DPDP Rules 2025 phasing), so a present-tense 2026 "compliant" claim asserts
  conformance with a regime that is not yet fully operative *and* that the app concedes it has not
  implemented.
- Best-fit fix (hint for implementer): Remove the unqualified "DPDP-compliant" assertion at
  `MobileHomeView.js:169`. If any privacy posture is to be stated, use factual, non-conclusory
  language about what is actually implemented (e.g. "encrypted in transit and at rest") and reconcile
  it with `profile/page.js:394` so the app makes one consistent statement. Any retained compliance
  claim should be reviewed and signed off by qualified counsel before shipping.
- Effort:      S
- Blast radius / dependencies: Single string; but the fix should be coordinated with REG-03 (whether
  the underlying obligations are actually met) and REG-04 (the paired HIPAA "coming soon" wording).
- Guideline ref: n/a (regulatory, not clinical) — DPDP Act 2023 / DPDP Rules 2025 (MeitY, notified
  2025-11-13).

---

### [P1] REG-02 — Diagnostic/clinical-decision functionality plausibly within CDSCO SaMD scope, with no wellness/informational positioning anywhere to distinguish it
- Area:        regulatory / engine / frontend
- Location:    conception-probability engine `backend/src/controllers/mfr.controller.js:491-503`
  (`p_12m_current`), `:585-592` (API emits `p_12m_current`, `time_to_conceive`); STI safety gate
  `backend/src/services/compatibility/reportSummary.service.js:125-207`, `:311-340`; thalassemia
  carrier-pair engine `reportSummary.service.js:54-111`; couple/compatibility score
  `reportSummary.service.js:288-296`, surfaced e.g. `frontend/src/app/core-engine/story/page.js:580`;
  PDF "12-Month Conception Probability" `backend/src/services/pdfReport.service.js:656`. **Absence of
  any informational/wellness disclaimer** — see Evidence.
- Status:      Confirmed (static) for what the code produces; **Suspected** for the classification
  conclusion (requires qualified regulatory review — not adjudicated here).
- Evidence:    The product computes and displays, as apparently patient-specific clinical outputs:
  (1) a cumulative **12-month conception probability** `1 - (1 - p_monthly)^12` (`mfr…:492`) plus a
  `time_to_conceive` string that routes to "Assisted Reproductive Technology (ART) or medical
  intervention required" when a barrier gate fires (`mfr…:498`); (2) an **STI "safety gate"** that
  scans lab markers and **caps the couple score at 50** (`reportSummary…:324`) while asserting active
  infection (see REG-06); (3) **thalassemia carrier-pair risk** with genetic-counsellor referral
  language (`reportSummary…:74`); (4) a headline **compatibility score**. CDSCO's 2025-10-21 draft
  guidance lists "standalone clinical decision support tools … and software that synthesizes or
  interprets patient data" as examples that may qualify as SaMD, classified A–D by the significance
  of the information and the seriousness of the healthcare situation. Interpreting lab reports,
  flagging "active infection," recommending "immediate specialist consultation … before marriage,"
  and quantifying conception odds are functions that a reviewer could read as synthesis/interpretation
  of patient data for a clinical purpose — i.e., pushing away from "wellness/informational" and toward
  the SaMD/CDS end of the spectrum. **Materially, the repo contains no positioning that would pull it
  back:** a full-repo search for `"not a diagnosis" | "informational purposes" | "educational
  purposes" | "not medical advice" | "does not constitute" | "consult your doctor" (as a disclaimer)`
  returned **zero** disclaimer text. The only "disclaimer" in the PDF is a technical footnote —
  `"…The 12-month conception probability bar reflects age-graded biological baseline statistics."`
  (`pdfReport.service.js:716-717`) — not a medical/diagnostic disclaimer. There is no Terms of Service
  or medical-purpose statement in the repo.
- Root cause: Diagnostic-grade outputs are presented directly to consumers with no explicit
  informational/wellness framing, no "not a substitute for professional diagnosis" disclaimer, and no
  stated intended-use / medical-purpose boundary — the exact distinctions that drive SaMD scope.
- Impact:      legal-regulatory. Whether MDR 2017 / CDSCO SaMD licensing (State for Class A/B, CDSCO
  central for Class C/D) applies is a determination for qualified regulatory counsel; this finding
  only flags that the current functionality and framing plausibly raise that question and that the
  product has done nothing textually to position itself out of scope.
- Best-fit fix (hint for implementer): This is a positioning + counsel question, not a code bug. (a)
  Obtain a qualified CDSCO/SaMD classification assessment for the conception-probability, STI-gate,
  carrier-risk, and compatibility-score features. (b) If the intended posture is wellness/
  informational, make that explicit and consistent (intended-use statement, prominent "not a
  diagnosis / consult a qualified clinician" disclaimer on report + PDF, softened imperative language)
  — noting that a disclaimer does not by itself determine classification. (c) Do not ship diagnostic
  imperatives ("treatment is required before marriage") without that review.
- Effort:      M (code framing) / L (regulatory assessment, external)
- Blast radius / dependencies: Touches report UI, PDF, and marketing copy; interacts with REG-05
  ("Doctor Reviewed") and REG-06 (diagnostic assertions), which compound the diagnostic read.
- Guideline ref: CDSCO Draft Guidance on Medical Device Software (2025-10-21); Medical Devices Rules
  2017. Requires qualified legal/regulatory review.

---

### [P1] REG-03 — "Doctor Reviewed" trust badge with no clinician-review artifact anywhere in the repo (the only "clinicians" are LLM system-prompt personas)
- Area:        regulatory / frontend
- Location:    `frontend/src/app/page.js:89`; `frontend/src/components/landing/TrustSignals.js:67`;
  `frontend/src/components/landing/PersonaSection.js:80` ("Doctor-reviewed");
  `frontend/src/constants/landingContent.js:216` ("Confidential doctor-reviewed risk report").
  LLM personas (not real clinicians): `backend/src/controllers/mental.controller.js:253`
  ("expert premarital counselor and psychologist"), `backend/src/controllers/mfr.controller.js:526`
  ("specialized reproductive endocrinologist AI"), `backend/src/services/radiology/
  radiologyExtractor.service.js:5` and `backend/src/services/parser/usgExtractor.service.js:6`
  ("specialized medical AI").
- Status:      Confirmed (static) — badges present; repo-wide search found no sign-off artifact.
- Evidence:    "Doctor Reviewed" / "Doctor-reviewed" appears as a general product trust badge in ≥4
  places (above). A search for any clinician-review artifact (files matching `*clinic* / *review* /
  *signoff*` and terms "psychologist", "doctor reviewed") surfaced **no** record of a named clinician,
  medical-review log, credential, or sign-off anywhere in the codebase. The only clinician references
  are **LLM system-prompt personas** that instruct the model to *act as* an endocrinologist /
  psychologist / "medical AI" (`mfr…:526`, `mental…:253`, `usgExtractor…:6`). Reports and PDFs are
  generated deterministically plus LLM narrative; nothing indicates a human doctor reviews any user's
  report. (Distinct from the paid ₹2,499 tier at `landingContent.js:135-139` which *offers* a personal
  doctor review as a service — that is a purchasable consult, not substantiation of a blanket badge
  shown to all visitors.)
- Root cause: A trust badge asserting human clinical review where the pipeline is software + LLM only.
- Impact:      user-trust / legal-regulatory. An unsubstantiated "Doctor Reviewed" badge is a
  misleading-advertising / consumer-protection exposure on its own, and it **compounds** REG-02 and
  REG-06: a diagnostic-sounding output ("active infection detected") wrapped in a "Doctor Reviewed"
  badge reads as a clinician-endorsed diagnosis. Requires qualified legal review under advertising /
  consumer-protection norms.
- Best-fit fix (hint for implementer): Either (a) substantiate — introduce genuine, logged clinician
  review with credentials and retain the artifact — or (b) remove/replace the badge with accurate
  language (e.g. "AI-assisted analysis"). Do not describe LLM output as "Doctor Reviewed."
- Effort:      S (remove) / L (stand up real clinical review)
- Blast radius / dependencies: Landing + persona components; pairs with REG-06.
- Guideline ref: n/a clinical — advertising/consumer-protection framing; requires legal review.

---

### [P1] REG-04 — Diagnostic-grade assertions ("Active … Detected", "active Hepatitis B infection", carrier-trait, conception odds) stated as fact without clinician sign-off or disclaimer
- Area:        regulatory / engine / pipeline
- Location:    `backend/src/services/compatibility/reportSummary.service.js:150` ("Active Syphilis
  (VDRL Reactive) detected. Immediate clinical consultation and treatment is required before
  marriage."), `:183` ("indicating active Hepatitis B infection"), `:326` ("active infectious disease
  markers were detected. Immediate specialist consultation is required before proceeding."), `:330`,
  `:335` / `:734` ("Active {sti} Detected"), `:702` ("An active infectious-disease marker was
  detected"), `:74` ("consistent with beta-thalassemia carrier trait"); conception odds
  `mfr.controller.js:492`,`:498`,`:585-592`; PDF surfaces the same (`pdfReport.service.js:656`,
  STI panel `:731-776`).
- Status:      Confirmed (static — exact strings read)
- Evidence:    The STI gate converts a single reactive screening marker directly into fact-stated
  disease language: e.g. HBsAg reactive → "indicating active Hepatitis B infection" (`:183`); VDRL
  reactive → "Active Syphilis … detected" (`:150`) with the imperative "treatment is required before
  marriage." Screening assays (VDRL/RPR, antibody EIAs) are, clinically, *screening* results that
  require confirmatory testing and can be false-positive; the code's own detail strings elsewhere
  acknowledge confirmation is needed (`:161` "Confirmatory testing … required", `:194` "confirmatory
  testing required") yet the headline/status language asserts "Active … Detected" as established
  diagnosis. Thalassemia carrier trait is likewise asserted from a single HbA2 value (`:74`). These
  fact-stated diagnoses are generated by software (plus LLM narrative), carry no "screening result —
  confirm with a clinician" disclaimer at the assertion site, and — per REG-03 — sit under a "Doctor
  Reviewed" badge with no actual clinician in the loop. (Note: the LLM personas are instructed to be
  "non-diagnostic" `mental…:253` and to "avoid definitive guarantees" `mfr…:526`, but the deterministic
  STI/carrier strings are not gated by those instructions.)
- Root cause: Screening-marker positivity is rendered as definitive diagnosis in user- and PDF-facing
  copy, without confirmatory-testing framing at the point of assertion.
- Impact:      clinical-safety / legal-regulatory / user-trust. Telling a user they have an "active
  infection" or are a "carrier" as settled fact — from an un-reviewed screen — is both a potential
  clinical-safety harm and a claim-of-certainty the engine cannot support. Requires substantiation
  (confirmatory workflow + clinician review) or reframing.
- Best-fit fix (hint for implementer): Reframe all fact-stated diagnosis strings to screening
  language ("screening result reactive — requires confirmatory testing and clinician evaluation"),
  attach a disclaimer at the assertion site, and align with REG-02/REG-03. Coordinate with the
  clinical-accuracy workstream on whether a single reactive screen should ever be surfaced as
  "Active … Detected."
- Effort:      M
- Blast radius / dependencies: Report summary service + PDF; pairs with REG-02, REG-03.
- Guideline ref: Clinical framing is out of this sub-track's scope; the *claim* framing requires
  legal/regulatory review. Confirmatory-testing norms per standard STI screening guidance (to be
  set by the clinical workstream).

---

### [P2] REG-05 — HIPAA applicability: no US nexus found; advertising future "HIPAA compliance" is a mild misframing
- Area:        regulatory / frontend
- Location:    `frontend/src/app/profile/page.js:394` and `:250` ("… and HIPAA compliance coming soon")
- Status:      Confirmed (static) — applicability determination based on repo evidence
- Evidence:    Applicability search across `frontend/src` + `backend/src` for US nexus returned **no**
  evidence of US users, US data flows, US-hosted infrastructure, or US-facing marketing: the only
  "US" hit is a phone country-code option `{ code: '+1', flag: '🇺🇸', name: 'USA/Canada' }` in a
  generic dropdown (`frontend/src/app/login/page.js:16`, `frontend/src/constants/lifestyleOptions.js:132`).
  All pricing is INR (₹799/₹1,499/₹2,499/₹2,999 — `landingContent.js`), and the product is built around
  Indian frameworks (DPDP, ICMR, NACO, Indian lab report formats). No AWS/GCP US-region, `us-east`/
  `us-west`, or US-hosting config was found. **Determination (for counsel to confirm, not a legal
  conclusion):** HIPAA is a US statute binding "covered entities" (US health plans/providers/
  clearinghouses) and their business associates; on the repo evidence there is no apparent US nexus,
  so HIPAA appears **out of scope** for this product as built. If so, advertising future "HIPAA
  compliance" (`profile/page.js:394`) misframes an inapplicable US regime as a relevant future
  benchmark — a minor accuracy issue, and it rides alongside the P0 DPDP misstatement in the same
  string (REG-01).
- Root cause: HIPAA name-dropped as an aspirational compliance target for a market where it does not
  apply.
- Impact:      user-trust / legal-regulatory (minor). Not a false present-tense claim (it says "coming
  soon"), so lower severity than REG-01, but it signals compliance framing not grounded in the
  applicable legal regime.
- Best-fit fix (hint for implementer): Drop "HIPAA" from the compliance copy unless a genuine US
  offering is planned; anchor compliance messaging to DPDP (and any other in-scope Indian frameworks)
  and have counsel confirm applicability.
- Effort:      S
- Blast radius / dependencies: Same strings as REG-01; fix together.
- Guideline ref: n/a — US HIPAA scope; requires legal review to confirm non-applicability.

---

### [P2] REG-06 — DPDP substantive obligations not evidenced anywhere in the repo (backing needed before any compliance claim)
- Area:        regulatory
- Status:      Static-only (absence of evidence — high-level, per brief)
- Location:    Repo-wide — no privacy policy, consent ledger, retention config, DSAR/erasure flow, or
  breach-notification mechanism surfaced. Compliance UI is a single "coming soon" row
  (`frontend/src/app/profile/page.js:386-398`).
- Evidence:    A health app of this kind processing personal health data would, under DPDP Act 2023 /
  DPDP Rules 2025 (seven principles), typically need to substantiate — before asserting compliance —
  at least: (1) **valid consent** (clear, informed, itemised notice, withdrawable) for each processing
  purpose; (2) **purpose limitation & data minimisation**; (3) **data-principal rights** (access,
  correction, erasure, grievance redressal, nomination); (4) **storage limitation / retention** with
  deletion on withdrawal or purpose completion; (5) **security safeguards**; (6) **personal-data-breach
  notification** to the Board and affected principals; (7) processing of **children's data** with
  verifiable parental consent (relevant given "Concerned Parents" persona sharing data about a
  prospective match / "your child" — `landingContent.js:209-219`). None of these were found
  implemented. This is deliberately high-level: the point is that the P0 "DPDP-compliant" claim
  (REG-01) has no visible substantiation, **not** to author a compliance plan.
- Root cause: Compliance asserted (REG-01) ahead of implementation.
- Impact:      legal-regulatory. The specific asserting-what-you-don't-have exposure lives in REG-01;
  this entry records the substantiation gap behind it.
- Best-fit fix (hint for implementer): Do not make DPDP compliance claims until counsel confirms the
  above obligations are met; build consent/notice/rights/retention/breach machinery under legal
  guidance. Note substantive DPDP obligations are phased in through 2027-05-13 (DPDP Rules 2025).
- Effort:      L
- Blast radius / dependencies: Cross-cutting (auth, storage, consent, data lifecycle). Coordinate with
  the data-handling / storage workstream.
- Guideline ref: DPDP Act 2023; DPDP Rules 2025 (notified 2025-11-13). Requires qualified legal review.

---

### [P2] REG-07 — Landing statistics cited to bare "WHO/ICMR/JAMA" source tags with no verifiable links; several stats have no source at all; outcome/guarantee-adjacent copy
- Area:        regulatory / frontend
- Location:    `frontend/src/constants/landingContent.js` — source tags at `:15`
  ("JAMA Network Open 2024 · PMC Reproductive Biology Study · ICMR"), `:28` ("WHO 2023 · NACO India ·
  CDC STI Surveillance"), `:41` ("ICMR 2023 · Lancet India · WHO NCD Report"), `:54` ("National Health
  Mission · Indian Thalassemia Society"); **unsourced** stats at `:26` ("80% of STI carriers show zero
  symptoms"), `:39` ("1 in 3 will develop a chronic disease before age 40"), `:52` ("4 Crore Indians
  silently carry the Thalassemia gene"), `:162` ("72% of hereditary conditions go undisclosed…"),
  `:176` ("43%…"), `:204` ("3x more likely…"), `:218` ("82% of parents…"); user-count claim `:127`
  ("Join 2,847 Couples Who Know"); outcome copy `:106` ("Sleep better knowing YOUR health status"),
  `:126` ("Make your decision with complete clarity"), `:144` ("Expert validation").
- Status:      Confirmed (static — exact strings read); numeric accuracy of each stat **not verified**
  here (flagged for substantiation).
- Evidence:    Health/epidemiological statistics are presented with attribution to authoritative
  bodies (WHO, ICMR, JAMA, Lancet, CDC, NACO) as **bare text tags** — no citation, DOI, or link a
  reader can verify — and several headline "warningStat" figures carry **no source at all**
  (`:162`,`:176`,`:204`,`:218`). Named-source attribution lends borrowed authority to figures that
  cannot be traced; if any figure is inaccurate or misattributed, that is a misleading-claim exposure.
  "Join 2,847 Couples Who Know" (`:127`) is a specific social-proof/user-count claim not backed by
  anything in the repo. Outcome lines ("complete clarity," "Sleep better") edge toward promising
  results the screening cannot guarantee.
- Root cause: Marketing statistics and social proof presented without verifiable substantiation.
- Impact:      user-trust / legal-regulatory. Advertising-accuracy exposure; requires each figure to
  be verified against, and linked to, its cited source, and unsupported figures/claims removed.
- Best-fit fix (hint for implementer): For every statistic, verify the number against a real,
  linkable source and cite it (or remove it). Remove or substantiate the "2,847 couples" count. Have
  marketing/legal review outcome-promise language.
- Effort:      M
- Blast radius / dependencies: Landing content only; independent of the engine findings.
- Guideline ref: n/a — advertising-accuracy framing; requires legal/marketing review. Individual
  epidemiological figures should be checked by the clinical workstream.

---

## Sharpest-exposures summary

1. **[P0] REG-01** — Live, present-tense **"DPDP-compliant"** claim on the dashboard
   (`MobileHomeView.js:169`) is flatly contradicted by the app's own **"DPDP compliance … coming
   soon"** (`profile/page.js:394`). Asserting statutory compliance you concede you don't have, over
   **health data**, is the single sharpest exposure.
2. **[P1] REG-02** — Conception-probability (`mfr.controller.js:492`), the score-capping **STI gate**
   (`reportSummary.service.js:324`), carrier-pair risk, and a headline compatibility score are
   diagnostic/CDS-flavored functions that CDSCO's 2025-10-21 SaMD draft guidance could read as SaMD —
   and there is **no** informational/wellness disclaimer anywhere in the repo to position out of scope.
3. **[P1] REG-03** — **"Doctor Reviewed"** badge in ≥4 places (`page.js:89`, `TrustSignals.js:67`,
   `PersonaSection.js:80`, `landingContent.js:216`) with **no clinician-review artifact in the repo**;
   the only "clinicians" are LLM personas (`mental.controller.js:253`, `mfr.controller.js:526`).
4. **[P1] REG-04** — Screening markers rendered as settled diagnosis: **"Active Syphilis … detected"**
   (`reportSummary.service.js:150`), **"active Hepatitis B infection"** (`:183`), "Active … Detected"
   (`:335`) — no confirmatory-testing disclaimer at the assertion site; compounds REG-03.
5. **[P2] REG-05** — **HIPAA determination: no US nexus found** (only a "+1 USA/Canada" phone code;
   all-INR pricing; Indian frameworks). HIPAA appears out of scope, so advertising "HIPAA compliance
   coming soon" (`profile/page.js:394`) is a mild misframing (counsel to confirm).
6. **[P2] REG-06** — No visible DPDP substantiation (consent/rights/retention/breach) behind the
   REG-01 claim; children's-data angle via the "Concerned Parents" persona.
7. **[P2] REG-07** — Landing stats attributed to **WHO/ICMR/JAMA as bare tags with no verifiable
   links** (`landingContent.js:15,28,41,54`); several warningStats unsourced; unbacked "2,847 couples"
   count.

**Every item above is risk identification requiring qualified legal/regulatory review — not a legal
conclusion.**
