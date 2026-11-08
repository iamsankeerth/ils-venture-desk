# Preserve Historical Programme Decisions and Support Dual Transition Modes

Ventures arrive with existing programme decisions (such as `Eligible for MSL` in Cases B and C, or Case C's `Level 2` placement from Demo Day) where the underlying checklist evidence is missing (`Unknown`), and ventures do not need to progress sequentially through every ILS level. We decided to decouple **Checklist Verification State** (computed strictly from verified evidence) from **Programme Decision State** (stored with explicit provenance), block the system from *newly* certifying any venture as satisfying the full MSL checklist when any common, model-specific, or configurable-range item is `Unknown`, and support two explicit transition modes in the reviewer console: **Standard Verified Advancement** and **Direct Entry** (which records immediate placement at an advanced level based on prior work with a full audit snapshot of verified vs. unknown criteria).

## Consequences

- Imported statuses like `Eligible for MSL` remain intact with a provenance badge (`Imported from tracker` / `Programme owner clarification`) even when underlying checklist items are `Unknown`.
- Seven state dimensions (`development_stage`, `programme_level`, `msl_eligibility`, `advancement_approval`, `fundraising_preference`, `msl_handover`, `msl_acceptance`) are stored in separate columns with separate provenance fields so changes to one dimension never implicitly mutate another.
