# ILS Stage Mock Test Pack

This is a **QA-only** companion to the supplied Mesa ILS assignment and application. It is not new venture evidence or a replacement for `backend/seed_data.json`.

## Safety and authenticity boundary

- Official seed remains **exactly Cases A, B and C and their seven supplied mock evidence IDs** (A-E01; B-E01–B-E03; C-E01–C-E03).
- No communication with students, mentors or external account links is performed.
- Tests S01–S14 use **only the supplied records**, plus review/decision actions on disposable copies.
- Tests N01–N08 use **QA-only negative probes**; N06–N08 modify/create an explicitly synthetic counterfactual **inside a temporary test database**. They never represent actual traction.
- Some N tests are **expected to fail on the current code**. Failures indicate known validation problems that should be fixed, not a failed source dataset.
- Do not import this pack into the production demo or use any synthetic observations for readiness certification.

## Run on extracted ZIP source

```bash
cd '/path/to/extracted/Mesa Venture Building'
PYTHONPATH="$PWD" pytest -q '/path/to/ILS_Stage_Mock_Test_Pack/test_stage_scenarios.py'
```

If you place the file inside the project directory, `pytest -q test_stage_scenarios.py` is sufficient.

Every test creates its own SQLite DB in pytest's `tmp_path`, seeded from the original `backend/seed_data.json`; the normal application DB is never used.

## Understanding programme stages

**Do not merge the following separate dimensions**:

- Venture **Development Stage**: e.g. Case A `MVP Developed`, not the formal ILS level.
- Formal **Programme Level**: `Unknown`, `Level 0`, `Level 1`, `Level 2`.
- Evidence status: `UNREVIEWED`, `APPROVED`, `CHANGES_REQUESTED`.
- Individual criterion result: `UNKNOWN`, `IN_PROGRESS`, `MET`, `NOT_MET`, `BLOCKED`.
- Existing **MSL eligibility**, separate from ILS level and from MSL acceptance/handover.

### Stage pathways demonstrated without fabricating additional evidence

| Situation | Starting state | QA action | Expected understanding |
|---|---|---|---|
| Case A: baseline | MVP Developed; ILS level Unknown; model unresolved | Open venture | MVP is not Level 0; owner must resolve model |
| Case A: update | A-E01 unreviewed; 32 sign-ups / 12,8 WAU | No approval yet | Submitted claim is not proof |
| Case A: review | A-E01 unreviewed | Approve supplied A-E01 in disposable copy | Evidence Approved; 10-WAU-for-2-weeks criterion Not Met; segment sign-ups Unknown |
| Case A: correction requested | A-E01 unreviewed | Request Changes instead of approve | Queue follow-up; no verified progress |
| Case A: advance | ILS level Unknown | Request standard Level 1 | Blocked; no invented placement or unverified advancement |
| Case B: imported decision | ILS level Unknown; MSL Eligible (imported); no equity preference | Open venture | MSL eligibility is not formal ILS level or acceptance |
| Case B: commercial intent | B-E01 unreviewed | Approve LOI | One signed LOI supported, not a pilot or payment |
| Case B: services finances | B-E02 and B-E03 unreviewed | Approve invoice and receipt | ₹100,000 billed; ₹60,000 received; ₹40,000 arithmetic difference; do not add to ₹12 lakh historical baseline |
| Case C: historic pathway | ILS level 2 via Demo Day; MSL Eligible imported | Open history | Direct entry is allowed without earlier level attendance |
| Case C: streaming | C-E01 and C-E02 unreviewed | Approve statement and payout | ₹80,000 September earned; ₹70,000 October payout linked to September; ₹10,000 unreconciled difference |
| Case C: sponsorship | C-E03 unreviewed; ₹120,000 invoice | Open document | Billed does not imply Collected |

### What cannot be demonstrated as an actual venture achievement from supplied evidence

The source provides **no completed five-item L0 qualitative checklist** for any supplied case. Thus a true, source-supported *standard* Level 0 → Level 1 advancement cannot be demonstrated by simply toggling reviews. To unit-test the success branch, use a separately labeled synthetic *test fixture*, as the existing `test_acceptance.py` does, not an altered official Case A/B/C record.

Likewise, the source does not establish new full MSL checklist certification for the supplied cases. Historical Eligible for MSL labels must be preserved, not recomputed from partial metrics.

## Known risk cases covered by N tests

- N01: Reject incomplete student update
- N02: Reject blank reviewer and reason
- N03: Reject blank Direct Entry justification
- N04: Disallow reusing an evidence ID from another venture
- N05: Reject incomplete import and preserve seeded data
- N06: Enforce truly consecutive WAU weeks
- N07: Enforce L0-Q3 numeric discovery subconditions
- N08: Avoid double-counting the same receipt as record and observation

Fix the API/evaluation logic, then rerun the N tests until they pass. They are regression guards against false progression.

## Optional full-state JSON snapshots (for visual stage walkthrough)

The `snapshots_qa_only/` folder contains **seven complete nine-table exports** with exactly three original cases and seven original supplied evidence records, at different **simulated review** states:

| Snapshot | What changes compared with original |
|---|---|
| `00_original_seed.json` | Nothing; raw seed baseline |
| `01_case_a_evidence_approved.json` | Review A-E01 Approved (simulation) |
| `02_case_a_changes_requested.json` | Review A-E01 Changes Requested (alternative branch, not after approval) |
| `03_case_b_loi_approved.json` | Review B-E01 Approved (simulation) |
| `04_case_b_financial_records_approved.json` | Review B-E02 and B-E03 Approved (simulation) |
| `05_case_c_streaming_records_approved.json` | Review C-E01 and C-E02 Approved (simulation) |
| `06_all_supplied_evidence_approved.json` | All seven reviewed Approved (simulation); **does not** imply any level/eligibility transition |

Each file is a full export, **not a partial import payload**. These are QA demonstration snapshots; do not import them into the official application database. If visualizing in the UI, start a disposable local app/database, back it up, and import only into that test copy. All evidence approval events in these files are simulated and not real programme review decisions.

You can regenerate the snapshots from the original source seed with:

```bash
PYTHONPATH=/path/to/extracted/project python generate_source_snapshots.py
```
