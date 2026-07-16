# Shared schema for SLAYHEALTH_DEEP_REVIEW workstream files

Every workstream deep-dive file in this folder uses this schema. IDs are global and unique across
files: `WS<area><NN>` (e.g. `WS1A03`, `WS2-07`, `REG-02`, `OPP-W5-04`).

## Per-problem entry

```
### [SEVERITY] ID — Title
- Area:        engine / pipeline / validation / frontend / regulatory / edge-case
- Location:    file:line(s)
- Status:      Confirmed (reproduced) | Suspected (needs repro) | Static-only
- Evidence:    exactly what was run / observed (commands, inputs, outputs) or the exact code read
- Root cause:
- Impact:      clinical-safety / correctness / user-trust / legal-regulatory / data-integrity / UX
- Best-fit fix (hint for implementer): concrete direction; alternatives where the call is non-obvious
- Effort:      S / M / L
- Blast radius / dependencies: what else this touches; safe sequencing notes
- Guideline ref: (medical items only) source + edition + date
```

## Severity scale

- **P0** — clinically unsafe output, false regulatory/compliance claim shown to users, or data corruption.
- **P1** — materially wrong score, or a user-trust breach (fabricated value shown as real).
- **P2** — correctness/robustness gap not yet reaching users, or missing safeguard.
- **P3** — polish, DX, or minor UX.

## Opportunity entries (WS4/WS5/WS7)

```
### OPP-<ws>-<NN> — Title
- Rationale:
- Inputs needed:   already available vs. new capture
- Benefit:
- Effort:          S / M / L
- Risk / claim considerations:
- Guideline basis: (clinical opportunities only)
```

## Rules

- Cite `file:line` for every claim. No vague locations.
- Confirmed vs. Suspected is never blurred. Static-only reading is marked as such.
- Real risk vs. theoretical is distinguished explicitly.
- Discrepancies against the ground-truth map in the brief are themselves findings.
