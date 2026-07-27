# Medical Engine (Deep): Mental Wellbeing v2.0

**Doc 08 of 22** · Audience: a solo full‑stack successor · Prerequisite: `07_medical_engines_chronic_and_fertility.md`, `05_data_model_and_storage.md`.

Goal of this doc: give you the **complete, verifiable reference** for the 27‑item mental‑wellbeing engine — the field‑name contract, the three distinct scoring functions, dimensional attachment, the couple headline, the fail‑closed defaults, and how its single number feeds 20% of the composite. It is a sibling of doc 07: same "every clinical constant is `[interim]`" convention, same "the code is the spec" reality. **The two spec docs the code cites (`contexts/mental_health_engine_update.md`, `contexts/mental_questionnaire_research_backing.md`) are not in the repo** (§13), so the engine's own acceptance‑test suite (§11) is the ground truth here — not those absent files.

The whole engine is one file: `backend/src/controllers/mental.controller.js` (575 lines). Read it alongside this doc; every claim below is anchored to it.

---

## 0. Orientation: what this engine is, in one breath

Each partner answers the same **27‑question self‑report survey**. The engine turns those two answer sets into:

1. **Per‑partner quality** across **6 weighted pillars** (0–100 each) → a per‑partner `overall`.
2. A **dimensional attachment profile** (anxiety / avoidance / security) per partner, plus a **couple‑level attachment compatibility** with a pursue‑withdraw penalty.
3. A **couple headline** — `overall_readiness.score` — that is the **minimum** of couple agreement and couple quality.
4. An **LLM narrative** (strengths / discussion areas / risk factors / recommendations), with a hardcoded fallback.

That single headline number is blended at **20% weight** into the cross‑domain composite (doc 09, doc 10). Everything else in the payload is presentation.

> **v2.0 was a psychologist‑review‑driven rewrite.** The original v1 engine had six named defects (WS1C01–06): an agreement‑only headline, monotonic Big‑Five scoring, attachment/substance/anger invisible to the headline, and fail‑open categorical defaults. v2.0 fixed all six. The in‑code comments carry the `WS1Cxx` tags marking each fix — leave them; they are the "why is it like this" trail.

---

## 1. The 27‑item model and the field‑name contract

### 1.1 The single most important rule

**A question's `id` in the frontend constants file IS the backend field name.** There is no mapping table, no translation layer. `mentalHealthQuestions.js:59` declares `id: 'emotional_wellbeing'`; `mental.controller.js:48` reads `pA.emotional_wellbeing`. Rename one without the other and the field silently falls to its `|| 4` / `|| 3` / `|| 'Low'` default — **no error, no warning, just a quietly fabricated above‑average score.**

```
frontend/src/constants/mentalHealthQuestions.js   backend/src/controllers/mental.controller.js
  MENTAL_HEALTH_QUESTIONS[i].id  ═══════════════▶  REQUIRED_MENTAL_FIELDS[j]   (must match exactly)
        (option .val 1..5)                                pA[field] / pB[field]
```

Any new question must be added to **both** the questions file **and** the relevant backend arrays (`REQUIRED_MENTAL_FIELDS`, and — if it's a numeric Likert item that should count toward agreement — `NUMERIC_AGREEMENT_FIELDS`). This is the number‑one way a well‑meaning edit breaks scoring undetectably.

### 1.2 The 27 required fields, their pillar, and their scoring function

`REQUIRED_MENTAL_FIELDS` (`mental.controller.js:47-56`) is the canonical list of all 27. The table below maps every field to its pillar, its UI sub‑category (§2), and which of the three scoring functions (§3) processes it:

| # | Field (`id` === backend name) | UI category | Scoring pillar | Scoring fn | Value type |
|---|---|---|---|---|---|
| 1 | `emotional_wellbeing` | feelings | P1 Emotional Health | `scaleTo100` | 1–5 |
| 2 | `stress_worry` | feelings | P1 Emotional Health | `scaleTo100` | 1–5 |
| 3 | `life_stress_capacity` | feelings | P1 Emotional Health | `scaleTo100` | 1–5 |
| 4 | `personality_openness` | personality | *(agreement only — dropped from quality)* | — | 1–5 |
| 5 | `personality_conscientiousness` | personality | P2 Personality & Attachment | `scaleAgreeablenessConscientiousness` | 1–5 |
| 6 | `personality_extraversion` | personality | *(agreement only — dropped from quality)* | — | 1–5 |
| 7 | `personality_agreeableness` | personality | P2 Personality & Attachment | `scaleAgreeablenessConscientiousness` | 1–5 |
| 8 | `personality_stability` | personality | P2 Personality & Attachment | `scaleTo100` | 1–5 |
| 9 | `attachment_anxiety_1` | personality | P2 (via security) | attachment mean | 1–5 |
| 10 | `attachment_anxiety_2` | personality | P2 (via security) | attachment mean | 1–5 |
| 11 | `attachment_anxiety_3` | personality | P2 (via security) | attachment mean | 1–5 |
| 12 | `attachment_avoidance_1` | personality | P2 (via security) | attachment mean | 1–5 |
| 13 | `attachment_avoidance_2` | personality | P2 (via security) | attachment mean | 1–5 |
| 14 | `attachment_avoidance_3` | personality | P2 (via security) | attachment mean | 1–5 |
| 15 | `readiness_communication` | together | P3 Marriage Readiness | `scaleTo100` | 1–5 |
| 16 | `readiness_conflict` | together | P3 Marriage Readiness | `scaleTo100` | 1–5 |
| 17 | `readiness_trust` | together | P3 Marriage Readiness | `scaleTo100` | 1–5 |
| 18 | `readiness_commitment` | together | P3 Marriage Readiness | `scaleTo100` | 1–5 |
| 19 | `readiness_support` | together | P3 Marriage Readiness | `scaleTo100` | 1–5 |
| 20 | `career_alignment` | lifeGoals | P4 Life & Career | `clarity` | 1–5 |
| 21 | `relocation_openness` | lifeGoals | P4 Life & Career | `clarity` | 1–5 |
| 22 | `financial_alignment` | lifeGoals | P4 Life & Career | `clarity` | 1–5 |
| 23 | `lifestyle_alignment` | lifeGoals | P4 Life & Career | `clarity` | 1–5 |
| 24 | `family_expectations` | lifeGoals | P5 Family & Parenting | `clarity` | 1–5 |
| 25 | `parenting_alignment` | lifeGoals | P5 Family & Parenting | `clarity` | 1–5 |
| 26 | `substance_concern` | habits | P6 Risk Factors | `subMap` lookup | **`'Low'`/`'Moderate'`/`'Elevated'`** |
| 27 | `anger_regulation` | habits | P6 Risk Factors | `scaleTo100` | 1–5 |

> **`substance_concern` is the one non‑numeric field.** It carries string values `'Low'`/`'Moderate'`/`'Elevated'`, NOT 1–5 (`mentalHealthQuestions.js:297-301`). It is handled by `subMap`/`SUBSTANCE_RANK` (§3.4, §5), is **excluded** from the numeric agreement diff, and must never be "cleaned up" to a 1–5 scale.

### 1.3 The completeness contract: `REQUIRED_MENTAL_FIELDS === 27`

`isMentalQuestionnaireComplete(answers)` (`mental.controller.js:74-80`) returns true only when **every one of the 27** fields is present and non‑empty (`!== undefined && !== null && !== ''`). This constant must stay **27** — the acceptance test `§5.1` (`mental-engine-v2.test.js:45`) hard‑locks `REQUIRED_MENTAL_FIELDS.length === 27`. Add a question, and this count moves; the test tells you.

### 1.4 The agreement contract: `NUMERIC_AGREEMENT_FIELDS === 20`, exactly

`NUMERIC_AGREEMENT_FIELDS` (`mental.controller.js:65-72`) is the set of items whose raw `|A − B|` difference feeds the couple **agreement** index. It is **exactly 20**: every 1–5 Likert item **except the 6 attachment items** (compared dimensionally instead) **and except `substance_concern`** (categorical, compared via `substanceAgreement`).

| Contributes to the 20 | Count |
|---|---|
| Emotional (`emotional_wellbeing`, `stress_worry`, `life_stress_capacity`) | 3 |
| Personality (openness, conscientiousness, extraversion, agreeableness, stability) | 5 |
| Readiness (communication, conflict, trust, commitment, support) | 5 |
| Life & Career (career, relocation, financial, lifestyle) | 4 |
| Family (family_expectations, parenting_alignment) | 2 |
| Anger (`anger_regulation`) | 1 |
| **Total** | **20** |
| *Excluded:* 6 attachment items + `substance_concern` | (7) |

> **Why this count is load‑bearing.** The agreement denominator is `NUMERIC_AGREEMENT_FIELDS.length`. If this list drifts to 19 or 21, **every couple's agreement score silently mis‑weights** — no crash, just wrong numbers everywhere. Acceptance test `§5.7` (`mental-engine-v2.test.js:133-135`) locks the length at 20 and asserts `relocation_openness` (the v2.0‑new item) is in it and the attachment/substance items are not. Note the interesting asymmetry: **openness and extraversion are in the 20 agreement fields but NOT in the P2 quality average** (§3.5) — "how similarly did the two answer" is a different question from "is one answer better."

---

## 2. The 6 scoring pillars vs the 5 visible UI sub‑categories

The user never sees "6 pillars." They see **5 tappable sub‑hub cards** (`MENTAL_HEALTH_CATEGORIES`, `mentalHealthQuestions.js:47-53`), each with its own progress ring, answerable in any order. The engine, meanwhile, computes **6 weighted pillars**. The two do not line up one‑to‑one — this trips people up.

| UI sub‑category (`key`) | Card label | Maps to scoring pillar(s) |
|---|---|---|
| `feelings` | Feelings & Energy | P1 Emotional Health |
| `personality` | Your Personality | P2 Personality & Attachment (traits + the 6 attachment items) |
| `together` | Building Together | P3 Marriage Readiness |
| `lifeGoals` | Life & Family Goals | **splits into** P4 Life & Career **and** P5 Family & Parenting |
| `habits` | Habits & Calm | P6 Risk Factors |

The split: `lifeGoals` holds 6 questions that the engine divides — career/relocation/financial/lifestyle → P4, family_expectations/parenting_alignment → P5. So 5 cards → 6 pillars.

The **6 pillars and their weights** (`weightSum`, `mental.controller.js:292-299`):

| Pillar | Weight `[interim]` | Fields | Scoring |
|---|---|---|---|
| P1 Emotional Health | **0.15** | emotional_wellbeing, stress_worry, life_stress_capacity | avg of `scaleTo100` |
| P2 Personality & Attachment | **0.20** | conscientiousness, agreeableness, stability + 6 attachment items | `traitQuality*0.5 + security*0.5` |
| P3 Marriage Readiness | **0.25** | 5 readiness items | avg of `scaleTo100` |
| P4 Life & Career | **0.15** | career, relocation, financial, lifestyle | avg of `clarity` |
| P5 Family & Parenting | **0.15** | family_expectations, parenting_alignment | avg of `clarity` |
| P6 Risk Factors | **0.10** | substance_concern, anger_regulation | avg of `subMap` + `scaleTo100` |
| | **Σ = 1.00** | | |

The weights **sum to exactly 1.00** — verified behaviorally by test `§5.1` (`mental-engine-v2.test.js:49-71`): a couple maxed on every pillar's quality must round to `partner_A_overall === 100`. If the weights didn't sum to 1.00, an all‑100 input couldn't produce 100.

> **`[interim]` — all six weights are house values pending clinical review.** They are hard‑coded literals (`0.15/0.20/0.25/0.15/0.15/0.10`) with **no in‑code derivation** from the cited research. This is finding **WS1C07** (still open, §13): risk and attachment carry the least numerical leverage, and their dynamic ranges are compressed (risk floors near 5, substance min is 10), so the two most safety‑relevant pillars move the headline the least. Retune from real outcome data before treating any of these as validated.

> The frontend report page keeps its own hand‑maintained mirror of this table — `PILLARS` array in `frontend/src/app/core-engine/mental/page.js:11`. It must be kept in sync with the engine's pillar keys/labels/weights by hand; there is no shared source. Drift here means the bars on the report don't match the math.

---

## 3. The three scoring functions (verbatim), and which items use each

This is the conceptual heart of v2.0. **Three different item types get three different scoring functions**, because "higher = healthier" is only true for *some* questions. Using the wrong function silently distorts a pillar.

### 3.1 `scaleTo100` — higher‑is‑healthier (the default)

```js
// mental.controller.js:6
const scaleTo100 = (val) => Math.max(0, Math.min(100, (parseFloat(val) - 1) * 25));
```

Linear: `1→0, 2→25, 3→50, 4→75, 5→100`. Used where more genuinely is better: **emotional** (all 3), **readiness** (all 5), **personality_stability**, and **anger_regulation**. A `NaN` input maps to a clamped 0 — but real submissions never reach that because of the `|| 4` math‑safety default at each call site.

### 3.2 `scaleAgreeablenessConscientiousness` — peaked personality

```js
// mental.controller.js:16-21
const scaleAgreeablenessConscientiousness = (val) => {
  const v = parseFloat(val);
  if (isNaN(v)) return 75;              // matches the old || 4 fallback's scaleTo100(4)=75
  if (v <= 4) return Math.max(0, Math.min(100, (v - 1) * (100 / 3)));
  return 70;                            // v === 5: extreme pole, below the v=4 peak
};
```

**Peaks at 4 (= 100), then dips to 70 at the extreme 5.** Mapping: `1→0, 2→33.3, 3→66.7, 4→100, 5→70`. Used for **`personality_conscientiousness`** and **`personality_agreeableness`** only.

*Why:* the research doc this app cites (Malouff et al. 2010, per the comment at `:8-15`) frames the extreme pole of these two traits as a relationship *risk* — over‑deference on agreeableness, rigidity on conscientiousness — not the optimum. A strong‑but‑balanced 4 is healthiest; the maximal 5 is scored above average (70) but below the peak. This was **WS1C02**: v1 scored these monotonically to 100, treating "always put others first" / "everything tightly scheduled" as ideal. Test `§5.6` (`mental-engine-v2.test.js:128-131`) locks `scaleAgreeablenessConscientiousness(4) === 100` and `(5) === 70`.

> `[interim]` — the peak location (4) and the extreme‑pole score (70) are house values, no cited threshold.

### 3.3 `clarity` — preference / distance‑from‑midpoint

```js
// mental.controller.js:34-38
const clarity = (val) => {
  const v = parseFloat(val ?? 3);
  if (isNaN(v)) return 0;
  return Math.max(0, Math.min(100, (Math.abs(v - 3) / 2) * 100));
};
```

Scores **distance from the undecided midpoint (3)**: `1→100, 2→50, 3→0, 4→50, 5→100`. A confident stance in *either* direction scores full quality; genuine "still figuring it out" scores 0. Used for the **preference items**: P4 (career, relocation, financial, lifestyle) and P5 (family_expectations, parenting_alignment).

*Why:* someone firmly career‑first and someone firmly not are **both making a clear, legitimate choice** — neither is "unhealthy." What predicts friction isn't the direction, it's not having settled a stance at all. Direction is left entirely to the couple‑agreement `|A − B|` diff (§5), never baked into individual quality. This is why test `§5.3` (`mental-engine-v2.test.js:80-86`) can assert that *both* partners answering `parenting_alignment=1` ("don't want children") scores **100 family quality and high agreement** — a firm shared "no" is a strong match, not a failure. Test `§5.4` shows the same firm‑but‑*opposite* stances keep individual clarity at 100 while agreement drops (because they genuinely disagree).

> **Gotcha:** never swap `clarity` for `scaleTo100` on a preference item. Doing so would score a validly non‑career‑focused person as "low quality," then — via the `min()` in the headline (§5) — unfairly cap the couple's whole result.

### 3.4 The substance map (P6)

```js
// mental.controller.js:271
const subMap = { 'Low': 100, 'Moderate': 50, 'Elevated': 10 };
const subValA = subMap[pA.substance_concern] ?? 10;   // :277 — fail-CLOSED to worst
```

`substance_concern` isn't scored by any of the three numeric functions; it's a direct tier lookup. **`?? 10`** is the fail‑closed default (§7). Combined with `scaleTo100(anger_regulation)`, it forms P6 (risk floor ≈ 5, since even `Low`+worst‑anger = avg(100, 0) = 50, and `Elevated`+worst = avg(10,0) = 5). `[interim]` — the 100/50/10 tier values are house values.

### 3.5 Pillar assembly (verbatim intent)

- **P1** = `avg(scaleTo100 × emotional_wellbeing, stress_worry, life_stress_capacity)` (`:103-112`).
- **P2** = `traitQuality*0.5 + security*0.5` (`:206-207`), where `traitQuality = avg(scaleAC(conscientiousness), scaleAC(agreeableness), scaleTo100(stability))` (`:140-149`). **openness and extraversion are dropped from quality** — the cited research finds no robust link from either to marital satisfaction (comment `:134-139`, WS1C02). They still count in agreement (§1.4).
- **P3** = `avg(scaleTo100 × 5 readiness items)` (`:213-226`).
- **P4** = `avg(clarity × career, relocation, financial, lifestyle)` (`:238-249`).
- **P5** = `avg(clarity × family_expectations, parenting_alignment)` (`:259-266`).
- **P6** = `avg(subVal, scaleTo100(anger_regulation))` (`:280-287`).

Per‑partner overall = `weightSum(...)` (`:301-317`) → rounded into `partner_A_overall` / `partner_B_overall`.

---

## 4. Dimensional attachment (replaced the old forced category)

### 4.1 What changed and why

v1 asked a single `attachment_style` question and forced one of Secure/Anxious/Avoidant/Disorganized. That couldn't tell a mildly anxious partner from a severely anxious one, collapsed two independent axes into one label, and (WS1C04) never touched the headline. v2.0 replaced it entirely with **6 indirect agree/disagree statements** (ECR‑style) scored as **two continuous dimensions** — anxiety and avoidance. Test `§5.2` (`mental-engine-v2.test.js:74-78`) enforces the removal by grepping the controller source for the literal string `attachment_style` and asserting it's gone.

The 6 items (all `agreementScale()`, 1–5, "Not like me at all → Very like me"):

| Field | Dimension | Statement gist |
|---|---|---|
| `attachment_anxiety_1` | anxiety | worries others care less than they do |
| `attachment_anxiety_2` | anxiety | uneasy when a close person needs space |
| `attachment_anxiety_3` | anxiety | wants more closeness/reassurance than the other |
| `attachment_avoidance_1` | avoidance | hard to fully open up |
| `attachment_avoidance_2` | avoidance | keeps emotional distance, pulls back when intense |
| `attachment_avoidance_3` | avoidance | would rather rely on self than depend on another |

### 4.2 Per‑partner formulas (`mental.controller.js:171-179`)

```js
anxietyA    = scaleTo100(average([anx1||3, anx2||3, anx3||3]));
avoidanceA  = scaleTo100(average([avo1||3, avo2||3, avo3||3]));
insecurityA = (anxietyA + avoidanceA) / 2;
securityA   = 100 - insecurityA;   // per-partner attachment quality → feeds P2
```

**A missing attachment item defaults to 3 (midpoint), never 1.** 1 ("not like me at all") is the *most secure‑reading* answer — defaulting there would fail open, scoring an unanswered question as the best possible case. Midpoint fails closed (§7). Test `§5.8` proves a partner with all 6 attachment items deleted scores `security === 50` (from midpoint), not 100.

### 4.3 Couple attachment compatibility + pursue‑withdraw penalty (`:190-193`)

```js
const ATTACHMENT_PURSUE_WITHDRAW_WEIGHT = 0.25;                       // [interim]
const baseSecurity   = 100 - (insecurityA + insecurityB) / 2;
const pursueWithdraw = Math.max(anxietyA * avoidanceB, anxietyB * avoidanceA) / 100;
const attachmentCompatibility = Math.max(0, Math.min(100,
                                  baseSecurity - 0.25 * pursueWithdraw));
```

`baseSecurity` is mutual security. The **pursue‑withdraw** term penalizes the specific friction pattern where one partner runs **anxious** while the other runs **avoidant** — one chases closeness, the other creates distance. Using `Math.max(anxA·avoidB, anxB·avoidA)` makes it **order‑independent** (either partner can be the pursuer), which is why the engine is symmetric in A/B (§9). Two partners who are *both* simply anxious in the same way are not penalized by this term — only the *complementary* mismatch is. Test `§5.5` (`mental-engine-v2.test.js:103-126`) isolates exactly this: a both‑anxious pair and an anxious+avoidant pair have *identical individual security*, but the anxious+avoidant pair scores visibly lower couple agreement.

> `[interim]` — the `0.25` pursue‑withdraw weight and the `/100` normalization are house tuning values, kept as named constants precisely so they can be retuned from outcome data without hunting through the formula.

### 4.4 Attachment insight ladder (`:195-204`)

A single narrative string is chosen by thresholds `[interim]`:

| Condition | Insight |
|---|---|
| `pursueWithdraw >= 50` | pursue‑withdraw pattern text (name it, reassurance one side, agreed space the other) |
| else `baseSecurity >= 75` | "both lean secure" |
| else `baseSecurity >= 55` | "mostly secure, some room to build consistency" |
| else | "elevated attachment insecurity on one or both sides" |

Rendered on the report as `couple_analysis.attachment_insight` (`core-engine/mental/page.js:99-104`).

---

## 5. The couple headline

Four numbers combine into the one number that matters. All in `mental.controller.js:319-383`.

### 5.1 Numeric agreement index (`:331-340`)

```js
const fieldsToCompare = NUMERIC_AGREEMENT_FIELDS;         // exactly 20
let totalDiff = 0;
fieldsToCompare.forEach(f => { totalDiff += Math.abs(parseFloat(pA[f]||4) - parseFloat(pB[f]||4)); });
const avgDiff = totalDiff / 20;
const numericAgreementIndex = Math.max(0, 100 - avgDiff * 20);
```

Max per‑item diff on a 1–5 scale is 4, so `avgDiff ∈ [0,4]` and `numericAgreementIndex ∈ [20, 100]` — it **floors at 20**, never 0, for maximally‑opposed 1–5 answers.

### 5.2 Substance agreement (`:358-362`)

```js
const SUBSTANCE_RANK = { Low: 0, Moderate: 1, Elevated: 2 };
const MAX_SUBSTANCE_RANK_DIFF = 2;
const subRankA = SUBSTANCE_RANK[pA.substance_concern] ?? SUBSTANCE_RANK.Elevated;  // fail-closed
const substanceAgreement = 100 - (Math.abs(subRankA - subRankB) / 2) * 100;
```

Same tier → 100, adjacent → 50, opposite ends (Low vs Elevated) → 0. Unknown/missing ranks as **Elevated** (WS1C06 fail‑closed).

### 5.3 Compatibility index — the 0.70 / 0.15 / 0.15 blend (`:364-368`)

```js
const compatibilityIndex = Math.round(
  numericAgreementIndex * 0.70 +          // [interim]
  attachmentCompatibility * 0.15 +        // [interim] — WS1C04 folds attachment in
  substanceAgreement * 0.15               // [interim] — WS1C05 folds substance in
);
```

This is a pure **agreement** construct — how *similarly* the two answered, plus the two couple‑level constructs (attachment, substance) that couldn't join the raw `|A−B|` diff. `[interim]` weights.

### 5.4 Quality mean and the `min()` headline (`:378-379`)

```js
const qualityMean = (overallScoreA + overallScoreB) / 2;
const overallReadinessScore = Math.round(Math.min(compatibilityIndex, qualityMean));
```

**This is WS1C01, the single most important v2.0 fix.** In v1, the headline was agreement alone — two partners who both floor every answer "agree perfectly" and scored 100, identical to two partners who both max out. By taking the **minimum** of agreement and quality, the headline can never exceed what per‑partner quality justifies: real agreement still matters (it's the other side of the `min`), but can no longer stand alone as an unqualified positive.

### 5.5 Label bands (`:381-383`)

| `overallReadinessScore` | Label `[interim]` |
|---|---|
| `< 60` | Discussion Recommended |
| `< 80` | Moderate Alignment |
| `>= 80` | Highly Aligned |

```
27 answers ×2 ─┬─▶ 6 pillars/partner ─▶ overallScoreA, overallScoreB ─▶ qualityMean ─┐
               │                                                                       ├─▶ min() ─▶ overall_readiness.score ─▶ ×0.20 composite
               └─▶ numericAgreementIndex(20) ┐                                         │
                   attachmentCompatibility   ├─▶ compatibilityIndex (=agreement_index)─┘
                   substanceAgreement        ┘
```

---

## 6. `score` vs `agreement_index` — two numbers in one payload

The payload (`mental.controller.js:439-445`) exposes **both**, and they are different numbers. Conflating them is a real reporting bug:

| Field | Equals | Meaning | Feeds the 20% composite? |
|---|---|---|---|
| `overall_readiness.score` | `round(min(compatibilityIndex, qualityMean))` | The **headline** — agreement capped by quality | **YES** (§7, doc 09) |
| `overall_readiness.agreement_index` | raw `compatibilityIndex` | Agreement‑only, uncapped | No — display only |
| `overall_readiness.partner_A_overall` | `round(overallScoreA)` | Partner A's own quality | No |
| `overall_readiness.partner_B_overall` | `round(overallScoreB)` | Partner B's own quality | No |
| `overall_readiness.label` | band of `.score` | Highly Aligned / Moderate / Discussion | — |

The composite blend and the label bands both use **`.score`**. The report page shows `agreement_index` and the two per‑partner overalls as secondary context (`core-engine/mental/page.js:91`). If you're wiring anything to "the mental score," it is `.score`.

The full payload shape you'll consume:

```
{ schema_version: "v1",            // ⚠ MISLABELED — this is the v2.0 engine (§13)
  overall_readiness: { score, label, agreement_index, partner_A_overall, partner_B_overall },
  pillar_scores: { emotionalHealth:{A,B}, personalityAttachment:{A,B}, marriageReadiness:{A,B},
                   lifeCareerAlignment:{A,B}, familyParentingAlignment:{A,B}, riskFactors:{A,B} },
  individual_profiles: { partner_A:{ emotional_health, personality, attachment:{anxiety,avoidance,security}, raw_answers },
                         partner_B:{ ... } },
  couple_analysis: { strengths[], discussion_areas[], risk_factors[], attachment_insight, recommendations[] } }
```

Rendered by `core-engine/mental/page.js` (pillars, attachment insight, couple analysis) and `core-engine/story/page.js` (headline reveal — see the `?? 80` hazard, §13).

---

## 7. The 20% composite weight — where it actually applies

The engine does **not** compute the 20% blend itself. The single source of truth is `computeGatedComposite` in `backend/src/services/compatibility/reportGeneration.service.js` (doc 09, doc 10). The mental slice:

```js
// reportGeneration.service.js:132-136
if (typeof mentalResult?.overall_readiness?.score === 'number') {
  sumScores += mentalResult.overall_readiness.score * 0.20;
  sumWeights += 0.20;
  domainScores.push(mentalResult.overall_readiness.score);
}
```

Full domain weight table `[interim]` (`reportGeneration.service.js:111`, `:116-146`):

| Domain | Weight | Source |
|---|---|---|
| Chronic / cardiometabolic | 0.35 | `chronicResult.calculations.coupleIndex` |
| Fertility | 0.25 | `mfrResult.p_12m_current` |
| **Mental wellbeing** | **0.20** | **`mentalResult.overall_readiness.score`** |
| Radiology | 0.10 | `radScore` |
| Genetics (thalassemia) | 0.10 | `genScore` |

> **The `typeof === 'number'` guard is deliberate, not truthiness.** A legitimate, maximally‑incompatible couple can score `overall_readiness.score === 0` (`avgDiff` large → `numericAgreementIndex` at its floor, then capped by quality). A `if (mentalResult?.overall_readiness?.score)` truthy check would drop a real 0 out of the composite as if the domain were *absent* — erasing the couple's worst finding. That was **WS1C09**; the fixed guard is `typeof === 'number'` (comment `:127-131`). Don't "simplify" it back.

The composite then applies a **critical‑domain floor** (worst domain < 30 caps the headline near `worst + 20`, `:157-165`) and the **STI safety gate** (`:182-185`, doc 09). Mental participates in both like any other domain — a very low mental score can itself trigger the critical‑domain cap.

---

## 8. Fail‑closed default policy — and why it must never fail‑open

Every per‑field default in `computeMentalResult` exists **only as a math safety net** so the arithmetic doesn't throw on a missing key. Two of them are deliberately biased toward the *worst* reading, not a neutral or best one:

| Missing field | Default | Direction | Effect |
|---|---|---|---|
| Any 1–5 quality item | `|| 4` | neutral‑ish | `scaleTo100(4)=75` (a math net; never reached for real data) |
| Attachment item | `|| 3` (midpoint) | **fail‑closed** | security → 50, not 100 |
| `substance_concern` | `subMap[x] ?? 10` (Elevated) | **fail‑closed** | worst risk tier |
| `substance_concern` rank | `?? SUBSTANCE_RANK.Elevated` | **fail‑closed** | worst agreement tier |

This is **WS1C06**. In v1, `subMap[key] || 100` failed open *twice*: a missing value AND any unrecognized/mis‑cased value both fell through to 100 — the best possible score, on a *risk* field. `?? 10` makes both cases land on the worst reading. Test `§5.8` (`mental-engine-v2.test.js:152-172`) locks this: missing attachment → `security === 50`; missing substance → `riskFactors.A === 30` (= avg(10, 50)), never 75.

> **Do not "clean up" these defaults to `1` / `'Low'`.** That reintroduces the exact WS1C06 bug — an unanswered safety question scoring as best‑case. For a risk‑bearing survey, an absent answer must read as concern, not reassurance.

---

## 9. The completeness gate lives in the caller, not the engine (WS1C03)

Here is the **latent‑by‑construction** risk. `computeMentalResult` does **not** validate completeness. Called with `({}, {})`, it happily returns a *fabricated above‑average* result — every field hits its healthy‑biased `|| 4` default, no error thrown. The docstring (`:82-94`) says so explicitly: callers are responsible for gating.

Both current callers do gate:
- `analyzeMental` checks `isMentalQuestionnaireComplete` on both sides and returns **400** ("all 27 questions") before calling the engine (`:500-505`).
- `invite.controller` checks both `stored.inviter` and `stored.prospect` before scoring (`:607`).

So it doesn't reach users **today**. But **any future caller that forgets the gate silently manufactures scores.** The review's recommended fix — `throw` inside `computeMentalResult` when a side is incomplete — was **not applied** (WS1C03, still open). If you add a third caller, gate it or the engine will lie.

```
✅ analyzeMental ─── isMentalQuestionnaireComplete(A) && (B) ──▶ computeMentalResult
✅ invite.controller ─ isMentalQuestionnaireComplete(inviter)&&(prospect) ─▶ computeMentalResult
❌ any future caller ─ (forgets) ──────────────────────────────▶ computeMentalResult({},{}) → fabricated ~above-average score, no error
```

---

## 10. The two callers and A/B mapping

The engine is **symmetric** — A/B identity is assigned by the caller, and the pursue‑withdraw `Math.max(...)` (§4.3) makes it order‑independent, so which partner is A vs B never changes the couple result.

### 10.1 Caller 1 — `analyzeMental` (route `POST /api/mental/analyze`)

Mounted behind `authenticateToken` (`mental.routes.js:7`). Called by the frontend `handleMentalAnalysis` in `CompatibilityContext.js`, which POSTs `{ partner_A_answers, partner_B_answers, match_id }` — mapping **self → partner_A, prospect → partner_B**. Two branches:

- **No `match_id`:** compute and return `mentalResult` inline (used for a live preview).
- **With `match_id`:** merge `mentalResult` into `matches.analysis_json`, then **re‑run the exact same `computeGatedComposite`** the initial compile used — not an ad‑hoc re‑blend (`:512-551`). This re‑applies the STI gate and critical‑domain floor and writes `matches.compatibility_score` + `presentation_json` in lock‑step. This is why "the score has one source of truth" (doc 00, warning 3) holds even on the mental recompute path.

The `cacheKey` passed to the LLM is `mental_insights_${match_id}` (or `null` if no match) (`:508`).

### 10.2 Caller 2 — `invite.controller` (async invite‑match pipeline)

Maps **inviter → partner_A, prospect → partner_B** (`:606-610`). Answers live server‑side in `prospect_invites.mental_answers_json` under `{ inviter, prospect }` (doc 05, doc 12). Two things to internalize:

1. **`mental_answers_json` is JSONB — pg returns it already parsed.** Do **NOT** `JSON.parse` it again. A prior version did, and it threw on every couple where the inviter had already answered, silently discarding both sides via the surrounding `catch` (comment `:598-602`). The same bug class was fixed a second time in `submitQuestionnaire`'s merge step (`:819-827`).
2. **Answers are NULLed after scoring** — `UPDATE prospect_invites SET mental_answers_json = NULL` (`:613`), a data‑minimization step: the score survives in the match; the raw per‑question answers don't need to persist.

This path feeds `mentalResult` into `reportGenerationService.compileMatchReport` (`:623-635`), which reaches the same `computeGatedComposite`. Both callers converge on the one composite function.

---

## 11. The LLM narrative integration (pointer to doc 11)

After the deterministic math, the engine builds a prompt from the *rounded* pillar/attachment numbers and calls `generateStructuredInsight` (`mental.controller.js:388-434`) to produce `strengths` / `discussion_areas` / `risk_factors` / `recommendations`. Key facts (full detail in doc 11):

- **Model call:** `temperature: 0.3, max_tokens: 500`, OpenRouter/DeepSeek via `backend/src/services/llm.service.js`.
- **Cache:** `cacheKey = mental_insights_${match_id}`, Redis **TTL 2,592,000s = 30 days**. **Re‑scoring the same match returns the SAME narrative text until the key expires or is cleared** — don't chase "why won't the AI copy update."
- **No `OPENROUTER_API_KEY` (currently dead, 401 — doc 03):** `generateStructuredInsight` returns the hardcoded `fallbackObj` (`:415-420`) — generic canned strengths/discussion. **This is the current normal**, not a bug. Don't mistake the fallback for real analysis.
- **Hard failure:** the `try/catch` (`:428-434`) substitutes an even more minimal set of strings, so the engine never throws on LLM trouble — the deterministic scores are always returned.

The tone constraint is baked into the system prompt: *"objective, non‑diagnostic, and constructive"* (`:399`). Keep that framing intact — see the regulatory posture note (§13).

---

## 12. Journey‑aware copy (`framePerson`)

The 27 questions carry **two voices**. The default `title`/`desc`/`options` are first/second person ("how has *your* energy been"). Each question also carries a hand‑authored **third‑person** variant — `titleP`/`descP`/`optionsP` — that names the partner via a `{name}` token.

`framePerson(q, name)` (`mentalHealthQuestions.js:329-346`) resolves the right copy:

| Journey | Who answers | `name` passed? | Voice |
|---|---|---|---|
| Account holder's own onboarding | self | no | first person |
| Invite link (partner self‑reports) | the partner | no | first person |
| **Self‑enter partner** ("I'll enter their details myself") | account holder, about the partner | **yes** | third person |

`optionsP` is **positional over `options`** — a string relabels the option at that index, an object can patch `label`/`desc`, and `val`/order are always preserved (so scoring is untouched — you may reword, never reorder). A `null` entry keeps the base label. This copy system is only about presentation; it never touches the field‑name contract. (More on the wizards: doc 15.)

> **Never reorder options or change a `val` when rewording.** The engine treats a higher `val` as "more of what's asked"; whether more/less/middle is healthy is decided *only* in scoring (§3). Reordering silently inverts a pillar (`mentalHealthQuestions.js:1-11`).

---

## 13. The regression suite as ground truth

Because the two spec docs are absent (below), the acceptance tests in `backend/__tests__/mental-engine-v2.test.js` are the **authoritative behavioral spec**. Run them:

```bash
cd backend && node --test __tests__/mental-engine-v2.test.js
```

(`npm test` is a stub that exits 1 — doc 19.) The suite stubs `llmService.generateStructuredInsight` to return its fallback untouched, so only deterministic math is tested. **Gotcha:** the stub monkey‑patches the singleton export (`:14-16`); if that export shape ever changes, the stub silently no‑ops and the tests hit the network.

| Check | Proves | Anchor |
|---|---|---|
| §5.1 | 27 items; pillar weights sum to exactly 1.00 (all‑maxed → 100) | `:44-72` |
| §5.2 | `attachment_style` fully removed (source grep) | `:74-78` |
| §5.3 | Both `parenting_alignment=1` → high family quality (clarity) AND high agreement | `:80-86` |
| §5.4 | `=1` vs `=5` keeps individual clarity high but drops agreement via `|A−B|` | `:88-101` |
| §5.5 | Anxious+avoidant (pursue‑withdraw) scores lower than equally‑insecure non‑complementary | `:103-126` |
| §5.6 | Peaked personality: `scaleAC(4)=100`, `scaleAC(5)=70` | `:128-131` |
| §5.7 | Agreement denominator is exactly the 20 non‑attachment items; `relocation_openness` wired in | `:133-150` |
| §5.8 | Missing attachment → security 50; missing substance → riskFactors 30 (fail‑closed) | `:152-172` |

If you change any scoring behavior, these tests are your safety net — and your documentation.

---

## Open items (see doc 21 for the authoritative list)

- **WS1C03 (latent):** `computeMentalResult` still doesn't self‑guard completeness — the `|| 4`/`|| 3`/`|| 'Low'` defaults bias a missing field toward a healthy answer. Both current callers pre‑gate, so users aren't affected today, but the recommended `throw`‑inside‑the‑function fix was never applied. Any new caller that skips the gate silently fabricates above‑average scores (§9).
- **WS1C07 / WS1C08 (open):** the 6 pillar weights are un‑derived literals with risk/attachment carrying the least leverage and compressed ranges; the planned DAST recreational‑drug item and the ACE/"Personal Background" section were never built — the risk pillar is alcohol + anger only (§2).
- **Frontend `?? 80` fabrications:** `core-engine/story/page.js` still has four `?? 80` fallbacks (`:179`, `:376`, `:636`, `:641`) that invent an 80% mental score / "highly compatible" copy when `overall_readiness.score` is missing — the unfixed WS6‑03/WS8‑04 remnant. `mental/page.js` and the story *label* path were fixed to a neutral state; these numeric reveals were not. Do not copy this pattern.
- **UX8‑01 / UX8‑04 (consent gaps):** the self‑enter‑partner journey lets the account holder submit a third party's full 27‑question mental‑health answers with **zero consent capture** (UX8‑01, P0); the invited‑partner page's "Skip this section" control was found wired on the step object but not threaded through as a prop, forcing the partner through the whole block (UX8‑04) — re‑verify against `invite/[token]/page.js:627` after the recent edits.
- **`schema_version: "v1"` mislabel** (`mental.controller.js:438`) despite this being the v2.0 engine — a misleading version stamp any consumer keying off it will get wrong.
- **DOC GAP:** the code, tests, and constants all cite `contexts/mental_health_engine_update.md` (the v2 spec / "§5 acceptance checks") and `contexts/mental_questionnaire_research_backing.md` (PHQ‑9/GAD‑7/PSS, Gottman, ECR, Malouff 2010, Li & Chan 2012, Luo & Klohnen 2005) — **neither is present in the repo.** The regression suite (§11) is the working ground truth. If you recover those specs, drop them into `contexts/` and this doc can be enriched. (REG‑06's DPDP audit surfaced no mental‑specific findings.)

*Next: `09_composite_scoring_sti_gate_and_genetics.md` — how this engine's 20% slice, the other four domains, the STI safety gate, and carrier genetics collapse into the one gated headline score.*
