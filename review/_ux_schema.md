# UX review — shared finding schema

IDs globally unique: `UX<workstream-letter><NN>` (e.g. `UXA03`, `UXC-STI-02`) or `OPP-UX-<NN>` for
opportunities. One finding per entry.

```
### [SEVERITY] ID — Title
- Flow / Screen:   journey + surface + file:line
- Viewport:        mobile / desktop / both
- Status:          Observed (screenshot ref) | Suspected (needs check) | Code-only
- Evidence:        what the user sees/does; screenshot filename(s) in backend/scratch/ux_shots/
- UX impact:       comprehension / trust / friction / drop-off / accessibility / aesthetic / consistency
- Heuristic:       (optional) usability or a11y principle violated
- Root cause:      code / design / copy / IA
- Best-fit direction: concrete redesign/fix; alternatives where the call is non-obvious
- Effort:          S / M / L
- Blast radius:    shared components / other surfaces the change touches
```

Severity: **P0** blocks a core flow, actively erodes trust in a health context, or an a11y barrier
excluding users from a critical action · **P1** major friction/confusion likely to cause drop-off or
sensitive-result misunderstanding · **P2** notable rough edge/inconsistency/comprehension gap ·
**P3** polish.

Opportunities: `OPP-UX-NN` with `rationale / user benefit / effort / impact`, own section, ★ if it
also fixes a logged defect.

Rules: Observed vs Suspected never blurred; every P0/P1 "Observed" carries a screenshot filename;
measure (don't eyeball) contrast and quantitative claims; mobile↔desktop divergences are
one-directional "reconcile desktop to mobile" items per the governing rule; evaluate through the
two-people / sensitive-data / high-stakes lens, not just generic heuristics.
