# LLM Integration & AI Chat Assistant

**Doc 11 of 22** · Audience: a solo full‑stack successor · Prerequisite: `10_match_orchestration_generate_insights.md`, `09_composite_scoring_sti_gate_and_genetics.md`.

Goal of this doc: give you a complete, code‑anchored map of **every place SlayHealth talks to a large language model**. There are three product surfaces (the in‑report AI counselor chat, the grounded suggested‑question chips, and the AI‑authored report narrative/presentation), **two different OpenRouter client implementations** that behave differently, one recursive number‑rounding guard, a family of deliberately non‑clinical fallbacks, and a small set of real reliability/quota gaps you should know before you touch anything here. Read doc 10 first — the narrative/presentation generators are called *inside* the Generate‑Insights save‑match flow — and doc 09 for the STI gate and carrier‑pair rules the prompts enforce.

---

## 1. The three AI surfaces at a glance

Every LLM call in the product belongs to one of three surfaces. Keep them separate in your head — they use different clients, different models, different prompts, and different fallbacks.

| # | Surface | Where it runs | Entry point | Client used | Model (default) | Fallback |
|---|---|---|---|---|---|---|
| 1 | **AI Counselor chat** — warm premarital counselor answering questions about a specific couple's report | Interactive, per user message in the report drawer | `chat.controller.sendChatMessage` `backend/src/controllers/chat.controller.js:215` | `llm/openrouter.service.js` (axios) | `deepseek/deepseek-v4-flash` → `deepseek/deepseek-chat` | error surfaced to UI (no static reply) |
| 2 | **Suggested‑question chips** — 3 grounded, premarital‑framed, never‑repeat tap chips | Regenerated on session create, history load, AND every message | `chat.controller.generateSuggestions` `backend/src/controllers/chat.controller.js:83` | `llm/openrouter.service.js` (axios) `extractJSON` | `meta-llama/llama-3.3-70b-instruct` | `SUGGESTION_FALLBACKS[engineType]` (static, still premarital‑framed) |
| 3a | **Report narrative** — Spotify‑Wrapped‑style hero/insights/body‑card copy | Save‑match (Generate Insights, doc 10) | `narrative.service.generateNarratives` `backend/src/services/llm/narrative.service.js:8` | `llm/openrouter.service.js` (axios) `extractJSON` | `DEEPSEEK_MODEL` \|\| `deepseek/deepseek-chat` | `safeFallback` + `narrative_generation_failed:true` |
| 3b | **Report presentation** — Apple‑Health‑style layout JSON that drives the PDF/web report | AI‑PDF generation | `aiPresentation.service.generateAIPresentationMap` `backend/src/services/compatibility/aiPresentation.service.js:178` | `llm.service.js` (fetch, Redis) `generateStructuredInsight` | `deepseek/deepseek-chat` | `fallbackPresentation` + `_llm_fallback:true` |
| 3c | **Engine dynamic insights** — per‑domain LLM commentary blocks | Inside chronic/mfr/mental engines | `chronic.controller.js:513`, `mfr.controller.js:665`, `mental.controller.js:422` | `llm.service.js` (fetch, Redis) `generateStructuredInsight` | `openai/gpt-4o-mini` (DEFAULT_MODEL) | per‑caller `fallbackObj` + `_llm_fallback:true` |

The single most important structural fact: **surfaces 1–3a go through the axios client (`openrouter.service.js`); surfaces 3b–3c go through the fetch client (`llm.service.js`).** The two clients are config‑divergent (§2). The clinical constants that matter (STI gate, star bands, carrier HbA2 threshold) are enforced almost entirely **by prompt text**, and the LLM is trusted to obey — with two exceptions that are re‑computed in JS (§8, §9). Every surface degrades to **flagged, deliberately non‑clinical fallback copy** rather than fail or fabricate (§10), because these outputs are shown to couples making marriage and family‑planning decisions.

---

## 2. The two OpenRouter clients (a real maintenance hazard)

There are **two independent OpenRouter client files** living side by side. They were written at different times, and they diverge on model, referer, caching, and — most dangerously — **what they do when the API key is missing.** Know which one you're editing.

| Trait | `llm/openrouter.service.js` (client #1) | `llm.service.js` (client #2) |
|---|---|---|
| HTTP library | `axios` | native `fetch` (Node 18+) |
| Instantiation | class singleton (`module.exports = new OpenRouterService()`) | bare exported functions |
| Methods | `extractJSON()`, `chatCompletion()` | `generateInsight()`, `generateStructuredInsight()` |
| Callers | chat replies, suggestion chips, narrative | AI presentation, engine dynamic_insights |
| **Missing `OPENROUTER_API_KEY`** | **THROWS** `openrouter.service.js:8` / `:64` | **Returns fallback** (never throws) `llm.service.js:22` |
| `HTTP-Referer` | `process.env.APP_URL \|\| 'http://localhost:3000'` `openrouter.service.js:26,78` | **hardcoded** `'https://slayhealth.com'` `llm.service.js:46` |
| `X-Title` | `'SlayHealth USG Engine'` (extractJSON) / `'SlayHealth AI Counselor'` (chatCompletion) | `'SlayHealth Compatibility'` |
| Base URL | hardcoded `https://openrouter.ai/api/v1` | `OPENROUTER_BASE_URL` env, default same |
| Redis caching | **none** | 30‑day TTL when `options.cacheKey` present |
| Default temperature | not sent (provider default) | `0.3` `llm.service.js:52` |
| Default max_tokens | not sent | `300` `llm.service.js:53` |
| Timeout | `extractJSON` 60s (no retry) / `chatCompletion` 45s ×2 | none set (relies on fetch default) |
| JSON handling | strips ```` ```json ```` fences, `JSON.parse`, throws tagged `LLM_MALFORMED_JSON` | strips fences, `JSON.parse`, tags fallback `_llm_fallback:true` |

The missing‑key divergence is the trap. If the key is absent, an engine dynamic‑insight call **quietly renders its fallback** and the report still generates; but a chat message or a suggestion‑chip request **throws**, and the chat surface shows an error (chat) or drops to `SUGGESTION_FALLBACKS` (chips). This is why, with the currently dead key (doc 03 §8, §10), narrative/presentation degrade *silently* while chat visibly falls back.

> **Recommendation for your successor self:** unify these two into one client with one config. The divergent referer (`slayhealth.com` vs `APP_URL`), the split model defaults, and the asymmetric error handling are all latent bugs waiting for the next person who assumes "the OpenRouter client" is one thing. This is not yet in the review corpus as a numbered finding — it was surfaced during the mapping pass — so log it in doc 21 when you consolidate.

```
                       ┌────────────────────────────────────────────┐
  CHAT / SUGGESTIONS   │  openrouter.service.js  (axios)             │
  / NARRATIVE          │  • THROWS on missing key                   │──▶ OpenRouter
                       │  • HTTP-Referer = APP_URL                   │    api/v1
                       │  • no cache, per-method timeouts            │
                       └────────────────────────────────────────────┘
                       ┌────────────────────────────────────────────┐
  PRESENTATION /       │  llm.service.js  (fetch)                    │
  ENGINE INSIGHTS      │  • RETURNS fallback on missing key          │──▶ OpenRouter
                       │  • HTTP-Referer = slayhealth.com (hardcoded)│    api/v1
                       │  • Redis 30-day cache, temp 0.3, 300 tok    │
                       └────────────────────────────────────────────┘
```

---

## 3. The complete model map & env vars

Five distinct model strings are in play. Two of them (`deepseek-v4-flash`, and the stale comment `deepseek-v4-pro`) look like **placeholder / possibly‑nonexistent OpenRouter model IDs** — verify they resolve on the OpenRouter catalog. If `deepseek-v4-flash` does **not** resolve, every chat reply silently 4xx's and falls through to the `deepseek-chat` retry, **doubling latency on every message** (§2, §12).

| Model string | Used by | Set at | Overridable? |
|---|---|---|---|
| `openai/gpt-4o-mini` | engine dynamic_insights (chronic/mfr/mental) | `llm.service.js:8` `DEFAULT_MODEL` | per‑call `options.model` |
| `meta-llama/llama-3.3-70b-instruct` | suggestion chips (`extractJSON`) | `openrouter.service.js:5` default arg | per‑call `model` arg |
| `deepseek/deepseek-v4-flash` | chat replies (primary) | `openrouter.service.js:61` default arg | per‑call `model` arg |
| `deepseek/deepseek-chat` | chat replies (fallback retry); narrative; presentation | `openrouter.service.js:92`; `narrative.service.js:107`; `aiPresentation.service.js:344` | narrative honors `DEEPSEEK_MODEL` |
| `deepseek/deepseek-chat` (presentation) | AI presentation map | `aiPresentation.service.js:344` (literal) | not env‑overridable |

**Env vars that steer LLM behavior:**

| Var | Read where | Effect | Missing behavior |
|---|---|---|---|
| `OPENROUTER_API_KEY` | both clients | Bearer auth for every call | client #1 throws; client #2 returns fallback |
| `OPENROUTER_BASE_URL` | `llm.service.js:5` only | overrides base URL for the fetch client only | defaults `https://openrouter.ai/api/v1` |
| `APP_URL` | `openrouter.service.js:26,78` | `HTTP-Referer` attribution header for the axios client | defaults `http://localhost:3000`; note it's **stale in prod** (doc 03 §10, `UX8‑05`) |
| `DEEPSEEK_MODEL` | `narrative.service.js:107` only | overrides the narrative model | defaults `deepseek/deepseek-chat` |

Note the asymmetry: `OPENROUTER_BASE_URL` is honored **only** by the fetch client, and `DEEPSEEK_MODEL` **only** by the narrative call. The chat/suggestion models are hardcoded default arguments with no env override. Doc 03 §5 has the full env table; this is the LLM‑relevant subset.

---

## 4. Chat session lifecycle

The chat surface is three endpoints, all under `/api/chat`, all requiring auth (`router.use(authenticateToken)` `backend/src/routes/chat.routes.js:9`); only `/message` is quota‑gated.

| Method + path | Controller | Quota gate? | Calls LLM? |
|---|---|---|---|
| `POST /api/chat/session` | `createChatSession` `chat.controller.js:119` | no | yes (suggestions) |
| `GET /api/chat/session/:sessionId/history` | `getChatHistory` `chat.controller.js:174` | no | yes (suggestions) |
| `POST /api/chat/message` | `checkChatQuota` → `sendChatMessage` `chat.controller.js:215` | **yes** | yes (reply + suggestions) |

### Schema

Two tables, created via `CREATE TABLE IF NOT EXISTS` at startup (`backend/src/services/storage/postgres.service.js:89` and `:98`):

| Table | Column | Type | Notes |
|---|---|---|---|
| `chat_sessions` | `id` | `TEXT PK` | a `uuidv4()` |
| | `report_id` | `TEXT` | nullable |
| | `partner_report_id` | `TEXT` | nullable |
| | `engine_type` | `TEXT NOT NULL` | `chronic` \| `mfr` \| `usg` |
| | `context_metadata` | `TEXT` | **stringified JSON**, `JSON.parse`'d on read with try/catch → `{}` |
| | `created_at` | `TIMESTAMP` | |
| `chat_messages` | `id` | `SERIAL PK` | **canonical message order is `ORDER BY id ASC`** everywhere |
| | `session_id` | `TEXT` | `REFERENCES chat_sessions(id) ON DELETE CASCADE` |
| | `role` | `TEXT NOT NULL` | `user` \| `assistant` |
| | `content` | `TEXT NOT NULL` | |
| | `created_at` | `TIMESTAMP` | |

There is an index on `chat_messages(session_id)` (`postgres.service.js:213`) but **none on `chat_sessions.report_id`/`partner_report_id`**, which the dedup query below filters on.

### The dedup pitfall

`createChatSession` tries to resume an existing session before creating one, using a **loose OR‑NULL match** (`chat.controller.js:128`):

```sql
SELECT id FROM chat_sessions
WHERE (report_id = $1 OR report_id IS NULL)
  AND (partner_report_id = $2 OR partner_report_id IS NULL)
  AND engine_type = $3
ORDER BY created_at DESC LIMIT 1
```

Because a stored session with `report_id IS NULL` matches **any** incoming `report_id` for the same `engine_type`, this can **resume an unrelated (or generic) session** and replay its transcript to a different couple's report. In practice the frontend usually passes concrete `reportId`/`partnerReportId`, but a NULL‑keyed row created once (e.g. a legacy/standalone engine page) becomes a sticky catch‑all for that engine type. Tighten this if you touch it.

### Sliding window & suggestion regeneration

`sendChatMessage` reads **all** messages ordered by `id ASC`, then keeps only the **last 10** (`fullHistory.slice(-10)` `chat.controller.js:252`). Older turns are silently dropped from the model's view — but the **full report metadata is re‑sent every turn** in the system prompt (`chat.controller.js:261`), so the model never loses the report, only the early conversation. The window is `[system, ...last10]`.

**Suggestions are regenerated on three occasions** — session create (`:140`, `:160`), history load (`:198`), and every message (`:297`). That means opening a drawer and sending one message is **at minimum 3 separate LLM round‑trips** on the suggestion path alone, on top of the reply itself. None of the suggestion calls are quota‑gated (§12).

---

## 5. Suggestion‑generation contract (verbatim)

`generateSuggestions({ metadata, transcriptMessages, engineType })` (`chat.controller.js:83`) builds a system instruction with **8 grounding rules** and calls `openRouter.extractJSON(prompt, systemInstruction)` (llama‑3.3‑70b, `json_object`). The rules, verbatim from `chat.controller.js:87‑103`:

1. **Ground every question in a REAL, SPECIFIC value or finding** from the report JSON — never a generic "What does my report mean?". Name the actual metric, organ, or number.
2. **Every question must be framed around the MARRIAGE/COUPLE/FAMILY decision** in front of them, not generic personal‑health curiosity — *"this is the single most important rule."* Ask what a finding means for the two of them, their marriage timeline, having kids, or what to do together.
3. **Write natural, complete, tempting sentences** — not clipped keyword fragments. Keep subject and verb.
4. **"Aim for roughly 6‑14 words"** — long enough to read as a real question, short enough for one tappable chip.
5. **Never invent a data point** that isn't present in the JSON provided.
6. If a transcript exists: **"every question must be a genuinely NEW angle — never repeat or lightly reword anything already asked."** If not: these are the opening chips; lead with whatever is most likely to make someone want an explanation.
7. When citing a number, **round it the way a person would say it out loud** (e.g. `"118"`, `"92.5"`) — never a long raw decimal.
8. **Return ONLY valid JSON** `{"suggestions": ["...", "...", "..."]}` **with exactly 3 items.**

The controller then filters to strings, `slice(0, 3)`, and returns them **only if non‑empty** (`chat.controller.js:109‑112`). On any throw or empty array it returns `SUGGESTION_FALLBACKS[engineType]` (`chat.controller.js:116`), a static per‑engine list (`chat.controller.js:15‑34`) that is **still premarital‑framed** ("What should we both work on before the wedding?") but generic.

### The context_metadata dependency (root of UX3‑07)

Grounding is only as good as the `context_metadata` blob the frontend passes at session create. The LLM cannot cite an STI or carrier finding that isn't in that blob. That is the mechanism behind `UX3‑07` (`review/ux_WS3_report.md`): the counselor **explains** a reactive‑STI or shared‑carrier finding well when asked, but the opening chips and welcome message never *surface* it, so the best explanatory channel is undiscoverable. The fix (`OPP‑UX‑31`) is to seed the opening message and lead chip from `sti_gate`/`carrier_pair_risk` — and to make sure those findings are actually in `context_metadata`.

---

## 6. Counselor persona prompt (verbatim)

`sendChatMessage` builds the persona system prompt at `chat.controller.js:257‑276`. It embeds `JSON.stringify(roundNumbersForPrompt(metadata), null, 2)` (§7) as the report data. The **8 strict guidelines**, verbatim:

1. **Always positive but nuanced regarding marriage** — the graded rule:
   - completely healthy (green): **enthusiastically say yes**;
   - minor issues: say yes, but gently suggest fixing minor tweaks;
   - severe/major flaws: **"Do NOT explicitly say yes or no… advise them warmly that they have significant health challenges to address first… before finalizing major life decisions. NEVER advise against marriage."**
2. **Human‑like & conversational** — reference their specific names, ages, exact data points naturally; don't sound like an AI.
3. **Specific & actionable** — steps based on exact biomarkers, not vague "eat healthy".
4. **Clear & plain language** — no scary jargon; explain terms simply.
5. **Short & concise** — **"Aim for 2 to 3 short, friendly sentences."** Don't dump the whole report.
6. **"NO EM DASHES ('—'): Do NOT use the em dash character '—' under any circumstances."**
7. **No made‑up medical values** not present in the JSON.
8. **Round numbers as spoken** (e.g. `"118"`, `"92.5"`), never a long raw decimal.

> **Gotcha (consistency, not yet a numbered finding):** rule 6 forbids em dashes, yet the system prompt itself and several fallback strings **contain em dashes** (`chat.controller.js:274`, and the `safeFallback`/`fallbackPresentation` copy in `narrative.service.js`/`aiPresentation.service.js`). The rule is about *model output*, but the inconsistency is worth cleaning up so the codebase practices what it preaches.

The graded "NEVER advise against marriage" rule is a **product/clinical posture decision, not a neutral one** — it constrains the model away from ever recommending against marriage even on severe findings. Combined with the "confirm with a qualified doctor" framing elsewhere, this is part of the REG‑06 open risk (doc 21): the product emits diagnostic‑grade guidance while steering the counselor's conclusion. Keep the "seek specialist consultation" / "confirm with a qualified doctor" framing intact; do not add clinical authority the product hasn't earned.

---

## 7. `roundNumbersForPrompt` — the 2‑decimal boundary guard

`roundNumbersForPrompt(value)` (`chat.controller.js:60`) recursively walks any value and applies `Math.round(value * 100) / 100` to every finite number, mapping arrays and objects through itself. It runs **at the prompt boundary** — right before metadata enters the suggestion prompt (`:105`) and the persona prompt (`:261`).

Why it exists (verbatim from the code comment at `chat.controller.js:47‑59`): the engines' full result objects carry **raw double‑precision intermediates** (odds ratios, probability chains) next to properly‑rounded display fields. A real bug this guards against: `chronic.controller.js` once merged an unrounded `pathologyScore` like `92.52239170382555` next to already‑rounded siblings. That specific field is fixed at source, but the whole `chronicResult`/`mfrResult`/`mentalResult` blob is `JSON.stringify`'d straight into every prompt — so **any** not‑yet‑rounded intermediate is one "ground this in a real number" generation away from being shown to a user verbatim.

> **Do not remove this thinking it's redundant.** It is the *last* line of defense; the engines still emit raw doubles upstream. It is a boundary guard, not a source fix — the correct long‑term fix is to round at the engines, but until then this is what keeps `92.52239170382555` off a user's screen.

---

## 8. Narrative & presentation generation

Two separate generators produce the AI‑authored report content. Both are called from the Generate‑Insights flow (doc 10), both degrade to flagged fallbacks.

### 8a. `generateNarratives` (Spotify‑Wrapped copy)

`narrative.service.generateNarratives(presentation, inviterName='Partner A', prospectName='Partner B')` (`narrative.service.js:8`), called from `reportGeneration.service.js:261` during save‑match. It calls `openRouter.extractJSON(userPrompt, systemPrompt, DEEPSEEK_MODEL || 'deepseek/deepseek-chat')` (`narrative.service.js:107,110`) and returns a JSON object with keys `hero`, `top_insights[]`, `body_cards{sugar,heart,liver,kidney,hormones,vitamins}`, `recommendations{sleep,diet,exercise,retests}`, `closing_message`.

**STI gate override injection.** When `presentation.sti_gate.triggered === true` and there are findings (`narrative.service.js:12‑17`), a mandatory `stiGateInstruction` block is appended to the system prompt (`:19‑30`) that forces:
- the `hero` greeting to **not** be purely celebratory — it must acknowledge critical findings upfront;
- `top_insights[0]` prefixed with **"🚨 Critical Finding: "** naming the STI(s) explicitly, urging immediate specialist consultation;
- no generic "you're doing great" while an active STI is present;
- compassionate‑but‑clinically‑urgent tone.

**Per‑field fallback + flag.** After the call, each field is passed through `pick(val, fallbackVal)` (`narrative.service.js:116`), which substitutes `safeFallback` copy when a field is `undefined`/`null`/`''` and sets `usedFallback = true`. The returned object always carries **`narrative_generation_failed`** — `true` if *any* field was patched, or `true` wholesale if `extractJSON` threw (`:142`, `:149`). The `safeFallback` copy (`:81‑103`) is deliberately generic — it points the reader at the real panels ("See the detailed panel below…") and asserts **no** clinical claim.

> **Stale comment:** `narrative.service.js:106` says *"Use the deepseek-v4-pro model"* but the actual default is `deepseek/deepseek-chat`. Ignore the comment; trust `DEEPSEEK_MODEL || 'deepseek/deepseek-chat'`.

### 8b. `generateAIPresentationMap` (Apple‑Health layout)

`aiPresentation.service.generateAIPresentationMap(chronicResult, mfrResult, mentalResult, details, {maleName, femaleName})` (`aiPresentation.service.js:178`), called from `compatibility.controller.js:360` during AI‑PDF generation. This is the **largest, most rule‑dense prompt in the codebase.** It:

1. Builds an STI status block from raw pathology via `extractSTIStatus(details)` (`:97`), which scans **6 named STI params** in `male_data`/`female_data`.
2. Serializes and strips clinical data via `serializeClinicalData()` (`:138`), removing `raw_text`/`raw_pdf_text` and cutting off at `depth > 8` to save tokens.
3. Calls `llmService.generateStructuredInsight([system, user], fallbackPresentation, { model: 'deepseek/deepseek-chat', temperature: 0.3, max_tokens: 8192 })` (`:337‑348`).

The output must match `PRESENTATION_SCHEMA` (`aiPresentation.service.js:8‑91`), a verbatim strict‑JSON schema string covering `report_confidence`, `relationship_snapshot`, `couple_synthesis`, `strengths[]`, `opportunities[]`, `family_planning`, `body_health{6 systems}`, `lifestyle`, `improvement_plan`, `carrier_pair_risk`, `sti_gate`, `report_assets.colors`.

**Deterministic post‑processing (the LLM's values are overwritten).** Two fields the schema *asks* the LLM to produce are **recomputed in JS after the call** — editing the prompt schema alone will not change them:

- **`report_confidence`** is fully rebuilt (`aiPresentation.service.js:384‑396`) from JS‑detected domain presence (`hasRadiology`, `hasGenetic`, `hasMental`, `isBloodVerified` at `:352‑365`). See §9 for the exact formula.
- **`family_planning.annualChance`** is normalized (`:405‑412`): if the value is `≤ 1` it's multiplied by 100 (the LLM often echoes the raw MFR decimal, e.g. `0.85`), then clamped to `0‑100` and rounded. The `report_assets.colors` block is also force‑filled if the LLM omitted it (`:398‑403`).

Everything else in the presentation — STI gate scoring, star ratings, carrier statuses, body‑health colors — is **trusted from the LLM output** (§9).

---

## 9. Clinical constants — enforced by prompt, verified in code only in two places

This is the safety‑critical section. **Mark every value below `[interim]`** — these are house values pending clinical review (product‑owner decision), not validated clinical standards. The canonical home for the composite/confidence weights is doc 09; they are reproduced here as they appear *in the presentation prompt/post‑process*.

| Constant / rule | Value | Where | Re‑verified in code? |
|---|---|---|---|
| Confidence base | `58` (Lifestyle + Blood) `[interim]` | `aiPresentation.service.js:364` | **Yes** (recomputed) |
| Confidence uplifts | `+16` blood_verified, `+11` genetic, `+6` radiology, `+5` mental `[interim]` | `:367‑370` | **Yes** |
| Confidence cap | `96` (sum of base+all uplifts) `[interim]` | implicit (58+16+11+6+5) | **Yes** |
| Confidence bands | `≥90` Near‑complete / `≥70` Solid / else Good start `[interim]` | `:372‑377` | **Yes** |
| `domains_covered` | `2 + genetic + radiology + mental` | `:379‑382` | **Yes** |
| `annualChance` | decimal ≤1 → ×100, clamp 0‑100 `[interim]` | `:405‑412` | **Yes** (post‑normalized) |
| Star rating bands | `≥80%`=5, `60‑79%`=4, `40‑59%`=3, `20‑39%`=2, `<20%`=1 `[interim]` | prompt `:209` | **No — prompt only** |
| STI gate score | any reactive Syphilis/HIV/HepB/HepC or detected HIV P24 → `relationship_snapshot.score ≤ 50`, status "Action Advised", color "red", STI first in `opportunities` (severity "critical"), `sti_gate.triggered=true`, footnote starts "In your report: ", next_action "Seek specialist consultation immediately" `[interim]` | prompt `:194‑204` | **No — prompt only** (but see below) |
| Carrier‑pair rule | HbA2 `> 3.5%` or any hemoglobin variant trait → partner status yellow/red under `carrier_pair_risk` `[interim]` | prompt `:225‑227` | **No — prompt only** |
| Body‑health colors | green = in range, yellow = borderline/monitor, red = significantly abnormal `[interim]` | prompt `:211‑214` | **No — prompt only** |
| Badge set | Strong / Healthy / All clear / Worth a look / Well matched | prompt `:235` | **No — prompt only** |
| Clinical footnote convention | must start `"In your report: "` | prompt `:234` | **No — prompt only** |

**The safety implication:** the STI safety gate, star bands, carrier HbA2 threshold, and every body‑health color are enforced **only by instructing the LLM** — a model that ignores the instruction produces an unsafe report, and nothing in `aiPresentation.service.js` re‑validates it. Only `report_confidence` and `annualChance` are recomputed. This is the sharpest open risk in the subsystem (§13).

There is one partial mitigation: `narrative.service.js` **does** hard‑inject the STI override block into its own prompt whenever `presentation.sti_gate.triggered` (§8a) — but that reads the gate flag *from the presentation the LLM already produced*, so if the presentation LLM failed to set `triggered`, the narrative override never fires either. The gate's true source of truth is the deterministic scoring layer (doc 09), which is where the presentation's STI status *should* be reconciled — not here.

---

## 10. The fallback + flag system (render layer MUST honor)

Every AI surface fails soft into copy that never asserts a clinical claim it didn't compute. Three distinct flag mechanisms exist — the PDF/web render layer must check them so degraded copy is never shown as genuine AI output.

| Flag / marker | Set by | Meaning | Render obligation |
|---|---|---|---|
| `_llm_fallback: true` | `llm.service.js:120` (`generateStructuredInsight`) | the structured call failed/was malformed; object is safe filler | treat as "AI unavailable", not a real result |
| `narrative_generation_failed: true` | `narrative.service.js:142,149` | any narrative field (or all) was patched with `safeFallback` | show generic copy; don't present as authored narrative |
| `'gray'` status + `'See report'` / `'Summary unavailable'` | `aiPresentation.service.js` `fallbackPresentation` (`:252‑335`) | presentation LLM failed; no color/value was computed | render neutral gray, point to raw values |

The `fallbackPresentation` is carefully written to **never** assert `green`/`Normal`/`All clear` for data it hasn't seen (see the comment at `aiPresentation.service.js:293‑297`); it uses `'gray'`, `'See report'`, and `'See details'` everywhere, and only reflects deterministic values that already exist (`coupleIndex`, `p_12m_current`). This is a deliberate, correct design — the danger is a render layer that **ignores** the flags and shows fallback filler styled identically to real output. Audit the PDF/web templates (doc 13, doc 16) for honoring these three markers.

---

## 11. Caching & degradation

Only the **fetch client** (`llm.service.js`) caches. The axios client (chat/suggestions/narrative) does **not** — every chat message and every suggestion regeneration is a fresh, uncached round‑trip.

| Aspect | Behavior | Where |
|---|---|---|
| Cache store | Upstash Redis, optional | `llm.service.js:10` (`require('./storage/redis.service')`) |
| TTL | `2592000s` = **30 days** `[interim]` | `llm.service.js:72,137` (`setex`) |
| Key | `options.cacheKey` (caller‑supplied) | e.g. `chronic_insights_${match_id}` `chronic.controller.js:512`; `mfr_insights_${match_id}` `:664`; `mental_insights_${match_id}` `mental.controller.js:508` |
| Text vs JSON | `generateInsight` caches the raw string; `generateStructuredInsight` caches the **parsed object** (`:137`) and does not pass `cacheKey` down to the inner text call (`:126`) | `llm.service.js` |
| No Redis | caching silently skipped; every call hits OpenRouter | `if (redis && options.cacheKey)` guards |
| No `cacheKey` | not cached (e.g. presentation passes no cacheKey → never cached) | `aiPresentation.service.js:342‑348` |

Degradation summary: **no key** → fetch‑client callers return fallback, axios‑client callers throw (§2); **no Redis** → no caching, everything else works; **dead key (current state)** → 401 in ~466ms, so it *fails fast* (chat shows error quickly, engines render fallback). The slow‑path risk is a **hanging** provider, not a dead key (§12).

---

## 12. Chat quota & frontend drawer mechanics

### Quota

`checkChatQuota` (`backend/src/middleware/quota.js:34`) gates **only** `POST /api/chat/message`:

| Rule | Value | Where |
|---|---|---|
| Free chat messages | **5 lifetime** (`chats_used >= 5` → HTTP 403) `[interim]` | `quota.js:49‑53` |
| Increment | `chats_used = chats_used + 1` on each allowed message | `quota.js:57` |
| Counterpart | `checkMatchQuota`: **1 free run** (`runs_used >= 1` → 403) `[interim]` | `quota.js:18‑23` |

**Two failure modes to know:**
- **FAIL‑OPEN on missing userId.** `userId` is resolved from `req.user` → `x-user-id` header → `body.userId`; if **all three are absent**, the request proceeds ungated (`quota.js:39‑41`, comment "developer testing"). `checkChatQuota` also proceeds if the user row is missing (`:44‑46`). A missing or forged userId **bypasses the 5‑message cap entirely**. (Auth is applied on the router — `chat.routes.js:9` — so in practice `req.user` is set; but the middleware's own fallback is fail‑open, so any path that reaches it without a populated `req.user` is uncapped.)
- **Only `/message` counts.** Session‑create and history‑load both call the LLM (for suggestions) but are **not** quota‑gated, so a user can trigger unlimited suggestion‑generation LLM calls by repeatedly opening/reloading the drawer.

### Drawer mechanics

`frontend/src/components/ReportChatDrawer.js`:

| Mechanic | Detail | Where |
|---|---|---|
| Props | `isOpen, onClose, sessionId, onSessionCreated, reportId, partnerReportId, engineType, contextMetadata` | `:44‑53` |
| Init | `POST /api/chat/session` with report ids + `context_metadata` | `initializeSession` `:140` |
| History | `GET /api/chat/session/:id/history` | `fetchChatHistory` `:183` |
| Send | `POST /api/chat/message` | `handleSend` `:227` |
| **`justInitializedRef` guard** | after init, `setActiveSessionId` re‑fires the open effect → would re‑call `fetchChatHistory` (also LLM‑backed). The ref suppresses that one re‑fire, preventing **two sequential LLM round‑trips per open** and a stuck "Analyzing reports…" spinner. | `:79‑100` |
| `DEFAULT_SUGGESTIONS` | static per‑engine placeholder chips, shown only until the first backend response lands | `:12‑31` |
| `getWelcomeMessage` | static per‑engine welcome text (chronic/mfr/usg/default) — **never mentions a couple's actual STI/carrier finding** (`UX3‑07`) | `:214‑225` |
| `parseMarkdown` | bold‑only (`**…**` → `<strong>`); no other markdown | `:33‑42` |
| Focus trap | Escape‑to‑close, focus close button on open, Tab wraps within drawer | `:108‑138` |
| **No client timeout / no cancel** | `apiFetch` is a plain `fetch` with **no AbortController**. The UI waits exactly as long as the backend's worst case, with locked input and animated typing dots, and **no cancel button** (`UX10‑05`) | `handleSend` `:242`, no timeout anywhere |

### The ~90s worst case

The chat reply model chains **primary (45s) + hardcoded fallback retry (45s)** on any error (`openrouter.service.js:82,89‑96`) — a **code‑verified ~90s worst case** before the generic "Failed to send message" error. Measured happy‑path replies were **3.9–9.1s** (`review/ux_WS10_perf.md`, `UX10‑05`), and a genuinely dead key 401s in ~466ms (fails fast). The 90s risk is a **slow/hanging provider**, not a dead key. There is no client‑side timeout to cut it short. Recommended fix (`UX10‑05`): client‑side 15‑20s timeout + "taking longer than usual" + a cancel affordance, and shorter per‑attempt backend timeouts.

Separately, `extractJSON` (narrative/suggestions) has a **single 60s timeout and NO fallback‑model retry** (`openrouter.service.js:30`), so a hang blocks report‑narrative generation up to 60s before `narrative.service` returns flagged safe copy (`UX10‑06`).

---

## 13. Open findings (see doc 21 for the authoritative list)

- **`UX10‑05` (P2, `review/ux_WS10_perf.md`):** no client‑side chat timeout + a ~90s backend worst case (45s primary + 45s hardcoded fallback) with locked input and no cancel button. Add a 15‑20s client timeout, a "taking longer than usual" state, and a cancel affordance; shorten backend per‑attempt timeouts.
- **`UX3‑07` (P1, `review/ux_WS3_report.md`):** the drawer's static `DEFAULT_SUGGESTIONS` and `getWelcomeMessage` never surface a couple's actual reactive‑STI or shared‑carrier finding, making the counselor (which explains them well when asked) undiscoverable and rate‑limited into a "lucky escape hatch." Seed the opening message + lead chip from `sti_gate`/`carrier_pair_risk` (`OPP‑UX‑31`) — and ensure those findings are actually inside `context_metadata`.
- **Clinical thresholds enforced by prompt only:** STI gate (score ≤50), star bands, carrier HbA2 >3.5%, and body‑health colors are trusted from the LLM and not re‑validated in code (only `report_confidence` and `annualChance` are). On a health product this is a correctness/trust risk — reconcile the gate against the deterministic scoring layer (doc 09).
- **Two config‑divergent OpenRouter clients** and **placeholder‑looking model names** (`deepseek/deepseek-v4-flash`, stale `deepseek-v4-pro` comment): unify the clients; verify the model IDs resolve on OpenRouter or chat silently doubles latency via the fallback path. (Not yet a numbered finding — log it in doc 21.)
- **Fail‑open chat quota** (`quota.js:39‑46`): a missing/forged userId bypasses the 5‑message lifetime cap; session‑create and history‑load make LLM calls but aren't gated. Env ambiguity: `review/_ux_env_recipe.md` flags the OpenRouter key as DEAD (401) while `ux_WS3` found it working — the key state is environment‑dependent (doc 03 §10).

---

*Next: `12_invite_flow_and_notifications.md` — the partner invite/consent state machine, self‑fill, and WhatsApp delivery.*
