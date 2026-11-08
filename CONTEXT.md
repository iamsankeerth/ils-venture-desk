# Idea Lab Sprint (ILS) Venture Progress & Readiness

This context governs how Idea Lab Sprint (ILS) programme staff, reviewers, mentors, and student founders track venture validation, evaluate traction evidence against business-model criteria, and record level advancement and Mesa Startup Lab (MSL) readiness decisions without losing provenance or conflating unverified claims with proof.

## Language

### Ventures & Classification

**Venture**:
A student-led startup participating in or assessed by ILS, represented across seven independent state dimensions: **Development Stage**, **Programme Level**, **MSL Eligibility**, **Advancement History**, **Fundraising Preference**, **MSL Handover Status**, and **MSL Acceptance Status**.
_Avoid_: Account, project, team, single-status row

**Business Model**:
The canonical commercial archetype (**Consumer**, **Services**, **AI B2C**, or **AI B2B**) to which transition criteria attach. When a **Venture**'s archetype is ambiguous, its **Model Resolution Status** remains **Unresolved** until a **Programme Owner** clarifies it.
_Avoid_: Tracker Sector (`AI/Product`), industry vertical

**Business Line**:
A distinct commercial stream operated by a **Venture** (for example, a **Services** line alongside a **SaaS / AI B2B** line in Case B). Every **Progress Update** and **Evidence Record** belongs to a specific **Business Line** so traction from separate streams is never combined.
_Avoid_: Sub-project, department

**Development Stage**:
The product maturity state of a **Venture** (such as `MVP Developed`), tracked independently from its **Programme Level**.
_Avoid_: Level, readiness

**Fundraising Preference**:
A founder's stated capital path (for example, `Grants; does not want equity funding` or `No, per tracker`). It never invalidates or erases **MSL Eligibility**.
_Avoid_: Disqualification flag

### Programme Levels, Criteria & Readiness

**Programme Level**:
A **Venture**'s formal placement in ILS (`Level 0`, `Level 1`, `Level 2`, or `Unknown`). Ventures do not need to progress sequentially through every **Programme Level**.
_Avoid_: Product stage, cohort tier

**Transition Gate**:
The complete set of requirements supporting movement between levels (`L0 Qualitative Checklist`, `L0 → L1 Demand Bar`, `L1 → L2 Traction Target`, or `MSL Readiness Checklist`). Requirements are named by the **Transition Gate** they support rather than ambiguous spreadsheet headings.
_Avoid_: Tracker column, milestone bucket

**Demand Bar**:
The quantitative traction threshold within the `L0 → L1` **Transition Gate** for a specific **Business Model**. Satisfying a **Demand Bar** does not complete `Level 0`, which also requires completing the **L0 Qualitative Checklist**.
_Avoid_: L0 completion, level pass

**L0 Qualitative Checklist**:
The five non-revenue discovery and validation requirements for `Level 0`: an evidence-backed canvas with mentor sign-off, a reachable target customer, 55 unique discovery conversations across at least 3 weeks (including at least 40 target-segment participants and 10 workaround users), dated problem-validation findings, and a predeclared riskiest-assumption test with its result and decision.
_Avoid_: Soft criteria, optional notes

**Configurable Threshold**:
A requirement parameter whose exact target or period is expressed as an open range in programme guidelines (such as `10–20 customers`, `30–40% repeat/retention`, or `1–2 customers` for MSL). It remains flagged for **Programme Owner** configuration and cannot be used to auto-certify a **Venture**.
_Avoid_: Hardcoded midpoint, default cutoff

### Epistemic States, Updates & Evidence Reconciliation

**Unknown**:
The explicit epistemic state for any metric, period, level, or requirement that was not supplied in the source record. **Unknown** is never coerced to `0`, `False`, or `Failed`.
_Avoid_: Zero, null, N/A, rejected

**Progress Update**:
A short submission by a student founder against a specific **Transition Gate** criterion, capturing a metric, count/amount, period, **Business Line**, **Evidence Record** reference, current **Blocker**, and **Next Action**. A submitted **Progress Update** is a claim awaiting review, not verified proof.
_Avoid_: P&L statement, verified milestone

**Evidence Record**:
A minimum useful artefact (such as a `Signed LOI`, `Invoice`, `Payment Receipt`, `Streaming Statement`, `Streaming Payout`, `Shopify Export`, or `Analytics Excerpt`) submitted to substantiate a **Progress Update**, carrying an **Evidence Status** (`Unreviewed`, `Approved`, or `Changes Requested`), reviewer identity, timestamp, and reason.
_Avoid_: Financial statement, self-certified proof

**Ledger Bucket**:
The commercial nature of an **Evidence Record**: **Commercial Intent** (e.g., `Signed LOI`—never revenue, payment, or a completed pilot), **Billed** (`Invoice`), **Earned** (`Streaming Statement`), **Collected** (`Payment Receipt` or `Streaming Payout`), or **Usage Metric** (`Analytics Excerpt`).
_Avoid_: Total revenue, gross sales

**Evidence Chain**:
A parent-child relationship linking a settlement **Evidence Record** (`Payment Receipt` or `Streaming Payout`) to its originating obligation (`Invoice` or `Streaming Statement`). An **Evidence Chain** reconciles billed/earned amounts against collected cash and preserves the parent's earned period so settlements are never double-counted or misattributed to a later earning period.
_Avoid_: Additive revenue rows

**Historical Baseline**:
An imported aggregate traction or financial statement (such as Case B's `₹12 lakh for services` or Case C's `₹1.3 crore; 25+ sponsored events`) whose period and underlying source breakdown are **Unknown**. A **Historical Baseline** is preserved as an isolated reference and is never mathematically summed with new **Evidence Records**.
_Avoid_: Opening balance, running cumulative total

### Decisions, Transitions & Queue

**Preserved Programme Decision**:
An existing programme status imported from historical records or owner clarification (such as `Eligible for MSL` or Case C's `Level 2` placement) stored alongside its **Provenance**. Because underlying historical evidence is **Unknown**, the system neither erases a **Preserved Programme Decision** nor newly certifies a **Venture** as satisfying the full MSL checklist from partial metrics alone.
_Avoid_: Auto-computed badge, system certification

**Transition Decision**:
An immutable audit record created when a **Programme Reviewer** approves an immediate level advancement (`Standard Advancement`) or places a **Venture** directly into an advanced level based on prior work (`Direct Entry`), retaining the reviewer, timestamp, reason, and criteria snapshot.
_Avoid_: Status overwrite

**MSL Handover Status** & **MSL Acceptance Status**:
Two distinct post-eligibility states tracking whether a **Venture**'s dossier has been handed over to Mesa Startup Lab and whether MSL has accepted the **Venture**. Neither is inferred automatically from **MSL Eligibility**.
_Avoid_: Graduated, auto-admitted

**Staff Next-Action Queue**:
A live triage view surfacing items requiring immediate staff attention across five categories: **Unreviewed Evidence**, **Owner Model/Rule Clarifications**, **Mentor & Participant Follow-ups**, **Pending Transition/Handover Actions**, and **Reviewed Criteria Needing Follow-up** for approved evidence that remains unresolved.
_Avoid_: Static backlog

## Flagged Ambiguities

- **"AI/Product" Sector vs. Business Model**: In the legacy tracker, Cases A and B are labelled `AI/Product`. This is a sector tag, not a **Business Model**. Criteria only attach to `Consumer`, `Services`, `AI B2C`, or `AI B2B`.
- **"Revenue"**: In legacy spreadsheets, LOIs, unpaid invoices, partial receipts, and historical lump sums were frequently conflated as "revenue". In this context, every financial claim must be classified into a specific **Ledger Bucket** and reconciled within an **Evidence Chain** or isolated as a **Historical Baseline**.
- **"Eligible for MSL"**: Used in the legacy tracker as an existing programme decision (`Imported status: Eligible for MSL`). It must be treated as a **Preserved Programme Decision** with provenance—not as proof that every item on the MSL checklist has been verified in the system, and not as **MSL Acceptance Status**.

## Example Dialogue

**Dev**: In Case B, the venture has `₹12 lakh` in the tracker for Services, plus `INV-01` for `₹1,00,000` and `PAY-01` for `₹60,000`. Should I show their cumulative Services traction as `₹13,60,000` once the reviewer approves both records?

**Domain Expert**: Definitely not. First, `₹12 lakh` is a **Historical Baseline** with an **Unknown** period and no source breakdown—we have no idea if October's invoices overlap with it, so never add new **Evidence Records** to a **Historical Baseline**. Second, `PAY-01` (`₹60,000`) is a partial settlement linked to `INV-01` (`₹1,00,000`) in the same **Evidence Chain**. Once approved, that chain represents `₹1,00,000` **Billed**, `₹60,000` **Collected**, and `₹40,000` unpaid—not `₹1,60,000`.

**Dev**: Got it. What about `B-E01`, the signed LOI from a prospective SaaS customer? Does that count toward their Services traction or as a completed pilot for AI B2B?

**Domain Expert**: Neither. `B-E01` belongs to the `SaaS / AI B2B` **Business Line**, not the `Services` **Business Line**. And its **Ledger Bucket** is **Commercial Intent**—a signed LOI supports the L0→L1 LOI requirement, but it is not revenue, payment, or a completed pilot.

**Dev**: And since Case C has `Fundraising Preference: No` and missing MSL checklist evidence, should the system strip their `Eligible for MSL` status or mark them as accepted into MSL?

**Domain Expert**: Neither! `Eligible for MSL` on Case C is a **Preserved Programme Decision** imported after their Demo Day **Direct Entry** into `Level 2`. We keep it with its provenance, never revoke it over **Fundraising Preference**, and keep **MSL Handover Status** and **MSL Acceptance Status** explicitly **Unknown** until recorded.
