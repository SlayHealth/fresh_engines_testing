# Bedrock / Kimi K2.5 Integration — Change & Test Notes

> **Temp doc** (untracked, not committed). Delete when you're done, or tell me to commit it.
> Date: 2026‑07‑30 · Author: automated pairing session

---

## TL;DR

- Your key is an **Anthropic Bedrock *Mantle* key** (`MantleApiKey-…-at-317751830506`), but it **also authenticates against the standard `bedrock-runtime` Converse API** — and that's where **Kimi** lives.
- **Kimi K2.5 works with this key** — verified live via **`bedrock-runtime` Converse** in **`ap-south-1` (Mumbai)** and `us-east-1`.
- The working model id is **`moonshotai.kimi-k2.5`** (bare `moonshotai.kimi-k2` is *not* a valid Bedrock id; `moonshot.kimi-k2-thinking` is the reasoning variant).
- Wired behind an **`LLM_PROVIDER` switch**: `bedrock` routes **all** AI (counselor chat, report narrative, structured clinical insights, radiology/USG extractors) to Kimi; unset/`openrouter` keeps the old behavior **byte-identical**.
- Auth is a plain **`Authorization: Bearer`** token — **no SigV4, no AWS SDK dependency added.**
- Verified on **real report PDFs** through the genuine service paths (see Test Results).

---

## How to switch providers

In `backend/.env` (already set):

```
LLM_PROVIDER="bedrock"                     # "openrouter" (or unset) = old behavior
BEDROCK_API_KEY="ABSK…"                     # the Bedrock (Mantle) key — Bearer token
BEDROCK_REGION="ap-south-1"                # Kimi K2.5 is also in us-east-1, us-west-2, …
BEDROCK_MODEL_ID="moonshotai.kimi-k2.5"    # or moonshot.kimi-k2-thinking
```

Flip back to OpenRouter any time by setting `LLM_PROVIDER=openrouter` (or removing it) — **zero code changes.**

---

## Files changed

| File | Change |
|---|---|
| `backend/src/services/llm/bedrock.service.js` | **NEW.** Bedrock Converse provider (Bearer auth). OpenAI→Converse message mapping, `chatCompletion` / `extractJSON` / `generateChat`, empty-response + blank-ContentBlock guards. |
| `backend/src/services/llm/openrouter.service.js` | `LLM_PROVIDER=bedrock` delegates `extractJSON` + `chatCompletion` to Kimi, **with a Bedrock→OpenRouter fallback** when an OpenRouter key exists. |
| `backend/src/services/llm.service.js` | `generateInsight` dispatches to Bedrock or OpenRouter; Redis caching + fallback‑text safety + `_llm_fallback` tagging preserved. Guard now allows a Bedrock‑only setup (no OpenRouter key). |
| `backend/.env` | Added `LLM_PROVIDER`, `BEDROCK_API_KEY`, `BEDROCK_REGION`, `BEDROCK_MODEL_ID` (gitignored — **key never committed**). |
| `backend/.env.example` | Added the 4 keys as a **no‑secret template**. |

### What `bedrock.service.js` does
- **`converse({messages, model, maxTokens, temperature})`** — POSTs to `https://bedrock-runtime.{region}.amazonaws.com/model/{model}/converse` with `Authorization: Bearer`, 45–60 s abort timeout.
- **Message mapping (`toConverse`)** — hoists `system` turns into Converse's top‑level `system`, merges consecutive same‑role turns, forces a leading user turn, and **drops empty/whitespace turns** (Converse rejects blank content blocks).
- **Adapters** mirror the existing OpenRouter client signatures so **no consumer code changed**:
  - `chatCompletion(messages, model)` → text
  - `extractJSON(prompt, systemInstruction, model)` → parsed JSON (same `LLM_MALFORMED_JSON` contract callers already handle)
  - `generateChat(messages, options)` → text (keeps the original temp `0.3` / 300‑token clinical defaults)

### Consumers now routed to Kimi (unchanged code)
`chat.controller` (AI counselor) · `narrative` / report narrative · `radiologyExtractor` + `usgExtractor` (`extractJSON`) · `mental` / `mfr` / `chronic` controllers + `aiPresentation` (`generateStructuredInsight`).

---

## Test results

### Round 1 — service‑layer smoke (all 4 entry points, real Kimi)
```
chatCompletion            -> "I am Kimi, developed by Moonshot AI."
extractJSON               -> {"name":"John Doe","age":30}
generateStructuredInsight -> real JSON (not fallback)
generateInsight           -> "Bedrock wired."
```

### Round 2 — adversarial review + fixes (see below), re‑verified
```
chatCompletion              -> "OK"                     PASS
extractJSON                 -> {"name":"Jane","age":28} PASS
empty-assistant-in-history  -> "RECOVERED"              PASS   (was a 400 before the fix)
system + multi-turn         -> "Tokyo."                 PASS
generateStructuredInsight   -> {"status":"ok"} REAL     PASS
```

### Round 3 — REAL report PDFs through the genuine Kimi paths ✅

**`extractJSON` on real `Female_Prediabetes.pdf`** (Apex Diagnostics lab panel) — 1.7 s:
```json
{
  "patient": {"name":"Ms. Rekha Reddy","age":"25 Yrs","sex":"F"},
  "abnormal_findings": [
    {"test":"MCHC","result":"38.7","unit":"g/dL","reference":"32.0-36.0","flag":"high"},
    {"test":"Fasting Blood Glucose","result":"113.8","unit":"mg/dL","reference":"70-100","flag":"high"},
    {"test":"HbA1c","result":"6.4","unit":"%","reference":"4.0-5.6","flag":"high"},
    {"test":"Estimated Average Glucose","result":"137.0","unit":"mg/dL","reference":"70-126","flag":"high"},
    {"test":"Average Blood Glucose","result":"128.8","unit":"mg/dL","reference":"< 117","flag":"high"}
  ]
}
```
→ Correctly detected **prediabetes** and returned only the out‑of‑range values.

**`generateStructuredInsight` on the same report** — 2.3 s, `REAL: true`:
> headline: *"25‑year‑old female with prediabetes (HbA1c 6.4%) and elevated fasting glucose; otherwise healthy premarital profile"* · key findings: prediabetes confirmed, normal CBC (no anemia/thalassemia), O positive, normal thyroid, excellent lipids, **negative hep B/C/syphilis**, normal iron studies.

**`chatCompletion` on real `sti_report.pdf`** — 0.8 s:
> *"You've got a solid foundation—strong fertility outlook and well‑matched daily habits—with one important next step: a reactive screening marker showed up, so please see a specialist soon for confirmatory testing; this is screening, not diagnosis…"*
→ Correct **screening‑vs‑diagnosis** framing, matching the app's clinical tone.

---

## Adversarial review — findings & fixes

A parallel review (9 raw findings → **4 confirmed** after independent verification). All fixed:

| # | Sev | Finding | Fix |
|---|---|---|---|
| 1 | **high** | Empty/whitespace turn → blank Converse ContentBlock → HTTP 400 ValidationException (could break a counselor session on replay). | `toConverse()` now **drops empty turns of any role**. Verified with an empty‑assistant‑in‑history test. |
| 2, 4 | low | Reasoning‑only / empty Converse response silently returned & stored as the reply → blank reply + poisons next turn. | `converse()` now **throws `LLM_EMPTY_RESPONSE`** on empty text instead of returning `''`. |
| 3 | low | Bedrock delegation had no fallback → a Bedrock timeout/5xx would 500 the chat. | Added **Bedrock→OpenRouter fallback** in `chatCompletion` + `extractJSON` (only when an OpenRouter key is present; else the Bedrock error surfaces). |

Default (OpenRouter) path is unaffected by all of the above.

---

## Open items / recommendations

- **Data residency:** `ap-south-1` (Mumbai) keeps inference in‑region for Indian users — good for the DPDP posture. `us-east-1` also works if you prefer.
- **Not committed yet.** Say the word and I'll commit (as `Pranav-Singh-Devloper`, no co‑author trailer). This temp doc is untracked — I'll leave it out of the commit unless you want it in.
- **Cost/latency:** Kimi K2.5 responses above were ~0.8–2.3 s. Bedrock billing is per‑token on your AWS account (separate from OpenRouter).
- **If you meant a different Kimi:** only `moonshotai.kimi-k2.5` and `moonshot.kimi-k2-thinking` exist on Bedrock today — there's no plain `kimi-k2`. Change `BEDROCK_MODEL_ID` to switch.
