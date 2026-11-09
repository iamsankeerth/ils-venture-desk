# ILS Venture Progress & Readiness Workflow

**Live demo:** <https://ils-venture-desk.vercel.app/>  
**Demo video:** <https://www.loom.com/share/3da814ebe2bb4620a10dc82c2759641e>  
**Submission note:** [SUBMISSION_NOTE.pdf](./SUBMISSION_NOTE.pdf)

Working prototype for the Mesa Idea Lab Sprint (ILS) Tech Associate assignment.

Tracks three anonymised ventures (Case A, B, C), preserves `Unknown` values, separates submitted claims from verified evidence, evaluates 38 requirement rows across four business models, records reviewer decisions with reviewer/timestamp/reason, and keeps level transitions, MSL eligibility, fundraising preference, MSL handover and MSL acceptance as independent state dimensions.

## Stack

- Backend: Python 3.13, FastAPI, SQLite (stdlib `sqlite3`), Pydantic
- Frontend: React JSX source, offline React compatibility runtime, prebuilt static assets, vendored Tailwind compiler, local SVG icons (no Vite or npm registry required)
- Tests: pytest + FastAPI `TestClient` (131 backend/stage tests, 23 frontend browser tests, 124 extended audit cases)
- Money: stored and transported as integer paise (`INR_PAISE`), formatted to rupees only in the UI

## Quick Start: Vite-free (Windows PowerShell / macOS / Linux)

The compiled frontend is included in `frontend/dist/` and served by FastAPI at the same port as the API. **No npm installation or Vite server is needed.**

```bash
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

Open <http://127.0.0.1:8000/>.

To rebuild the frontend after changing JSX source (requires Node.js 20+ but **no npm install**):

```bash
cd frontend
npm run build
```

For a separate frontend development server with an API proxy, keep FastAPI on port 8000 and run `cd frontend && npm run dev`. Open <http://127.0.0.1:5173/>. The development server is a small Node built-in HTTP program, not Vite. It builds at start. See `frontend/README.md` for details and limitations of the offline-compatible React runtime.

### Database

The local SQLite database is `backend/ils.db` (generated at first run and not tracked in this repository). It is seeded from `backend/seed_data.json` on first start. `Reset to seed data` in the header recreates it. To reseed manually, delete `backend/ils.db` and restart the backend, or call `POST /api/reset`.

## Vercel demo deployment

Live demo: <https://ils-venture-desk.vercel.app/>

Import this repository at <https://vercel.com/new>. Vercel detects the FastAPI app from `index.py`; use the repository root and leave the build and output settings at their defaults. No frontend build is required because `frontend/dist/` is prebuilt.

`index.py` sets `ILS_DB=/tmp/ils.db`. Vercel Functions have an ephemeral filesystem: submitted updates and reviews persist while the function instance remains warm, but reset when the instance is recycled. For persistent local data, run the app locally using the database instructions above.

## Running the Tests

Run all tests from the project root:

```bash
python -m pytest -q backend qa_stage_tests
PYTHONPATH=. python -m pytest -q frontend/tests/test_offline_ui.py
PYTHONPATH=. python audit_results/run_extended_audit.py
```

Latest final verification: **131 backend/stage and 23 frontend browser tests** plus **124 extended audit cases**, **278/278 pass**. Browser evidence also includes 44 P1, 19 claim-boundary, 25 W01/W05 and 28 P2 checks. The 31 focused final-correction tests are included in the 131. The UI browser test uses an offline asset injection harness and real FastAPI TestClient; a standalone Node proxy was also checked by HTTP. The stage tests use explicitly QA-only counterfactuals; see `qa_stage_tests/STAGE_TEST_GUIDE.md`.

## How to interact with updates

1. **Choose the role.** Use the Role (Demo Seam) selector in the header. Submissions use `STUDENT_FOUNDER`; reviews, transitions and MSL certification use `PROGRAMME_REVIEWER`; model clarification and rule configuration use `PROGRAMME_OWNER`.
2. **Submit an update as a founder.** Open **Ventures → Case A/B/C → Requirements**, choose the relevant criterion, and click **Submit Update**. Alternatively use the workspace Submit Update button on Overview. Select the business line and criterion, enter the summary metric and verbatim period, record the reported value or qualitative checklist, provide the evidence source type/ledger bucket/unit, and enter a blocker and next action.
3. **Understand the saved state.** Submission creates an `UNREVIEWED` progress update and evidence record. It is a claim, not proof; it does not yet change the criterion result.
4. **Review as a Programme Reviewer.** Open **Work Queue → Review Evidence**. Inspect the submitted measurements, enter a review reason, then choose **Approve Evidence** or **Request Changes**. Approval activates the observation and recomputes the criterion; requested changes do not count toward it.
5. **Configure unresolved rules as a Programme Owner.** Open **Requirements → the configurable criterion → Configure Rule**. Invalid configurations are rejected and an unconfigured rule remains `BLOCKED`.
6. **Record advancement as a Programme Reviewer.** Open **Decision History → Record Transition**. A standard advancement requires the applicable criteria to be met; direct entry records a justified placement and its criteria snapshot.
7. **Use the Work Queue for follow-up.** It surfaces unreviewed evidence, model decisions, configuration gaps, mentor follow-ups and pending transition/handover items.

## Demo Walkthrough

Recorded walkthrough: <https://www.loom.com/share/3da814ebe2bb4620a10dc82c2759641e>

Use the **Role (Demo Seam)** selector in the header. Roles simulate `PROGRAMME_OWNER`, `PROGRAMME_REVIEWER`, `MENTOR`, and `STUDENT_FOUNDER` through the `X-ILS-Role` request header. This is a demonstration seam, not production authentication.

1. **Work Queue** shows 7 evidence items, 2 model decisions and 8 configurable rules.
2. Open **Case A**. Confirm the governing model is `Unresolved` and both `AI B2C (Assigned in Tracker)` and `AI B2B (Candidate)` remain visible.
3. **Requirements** lists the L0 qualitative checklist and model-specific demand bars. Click `Submit Update` on any row.
4. **Evidence & Financials** shows the dual `Claimed (Submitted)` and `Verified (Approved)` ledgers. Case B shows `₹100,000` billed and `₹60,000` collected as claims, never as verified balance.
5. Open `Review evidence` for `A-E01`. Measurements are grouped per criterion. Approve or request changes; reviewer, timestamp and reason are retained.
6. **Decision History** records transitions and MSL decisions. Record a transition to demonstrate immediate advancement after approval.
7. Switch to **Student Founder**: Import, Export, Reset, Review, Transition, Clarify and Certify controls disappear. The command palette follows the same capability matrix. Missing or unknown roles are rejected by the API; all four recognized demo roles may submit updates.
8. Use `Reset to seed data` to return to the initial state.

## Mesa W01-W05 acceptance

- **W01 Import existing venture.** Use `Import venture` with the supplied tracker record. The original level, development stage, Unknown values, historical provenance, business lines and imported MSL eligibility remain. Omitted advancement becomes `Unknown`; no transition is invented.
- **W02 Submit progress update.** A founder selects a criterion, records metric, verbatim period, evidence reference, blocker and next action. The evidence is created `UNREVIEWED`; it is a claim, not proof.
- **W03 Reviewer decision.** A Programme Reviewer approves or requests changes with reviewer, server timestamp and reason. The review history is retained and the criterion is recomputed only from approved evidence.
- **W04 Current level and staff queue.** The workspace shows programme level, unmet and Unknown requirements, pending evidence and actionable staff follow-ups.
- **W05 Advancement and direct entry.** Unsupported standard advancement is blocked with reasons. A fully met standard advancement is recorded immediately. A justified direct entry to Level 2 is recorded. A direct target below the known current level is rejected by the API and absent from the Direct Entry target list. Case C keeps its historical Level 2 `HISTORICAL_IMPORTED` record and Unknown historical reviewer/date.

Same-level direct entry remains allowed; the approved correction covers only downward direct entry. No separate downgrade workflow was added.

## Project Map

```
backend/
  app.py, db.py, evaluation.py, rules.py
  seed_data.json      Canonical 38-criterion seed and Cases A/B/C
  requirements.txt
  test_*.py

frontend/
  src/
  dist/               Prebuilt UI served by FastAPI
  public/
  tools/
  tests/
  package.json
  index.html
  README.md

docs/
qa_stage_tests/
audit_results/run_extended_audit.py

index.py              Vercel ASGI entrypoint; sets /tmp/ils.db
requirements.txt      Vercel runtime dependencies
vercel.json           Bundles frontend/dist
.vercelignore         Excludes non-runtime files from Vercel
.python-version       Python runtime version
README.md
CONTEXT.md
```

## API Summary

- `GET /api/state` returns a complete joined snapshot: ventures, business lines, 38 criteria, evaluations, updates, evidence, observations, review history, transitions, MSL decisions, ledgers and staff queue.
- `POST /api/updates` submits a short claim, observations, blocker, next action and evidence reference.
- `POST /api/evidence/{id}/review` approves or requests changes with a required reason.
- `POST /api/ventures/{id}/transitions` records standard advancement or direct entry. A direct target below the known current level returns `400` before any write. `POST /api/ventures/{id}/msl-eligibility` and `POST /api/ventures/{id}/seam-actions` record programme decisions.
- `POST /api/criteria/{id}/configure` validates the criterion-specific aggregation method, value bounds, measurement basis and period, cohort and window, pilot qualification, or COUNT range. Invalid configurations return `422` and write nothing; imported incomplete rules stay `BLOCKED`. `POST /api/import`, `POST /api/reset`, and `GET /api/export` handle validated import/reset and complete JSON export. Export requires a Programme Owner or Programme Reviewer role; progress-update submission requires any recognized demo role.
- `POST /api/ventures` imports a venture with strict validation; malformed records return `422`.
- `POST /api/reset` reseeds; `GET /api/export` exports the whole database.

## Access Control Note

The role header is an exercise seam. Production would replace it with Mesa identity (SSO), server-side programme-role membership, and route-level authorisation. Mentor pre/post-work and MSL handover are represented as status and context panels; scheduling, messaging and production authentication are intentionally out of scope.

## Known non-production limitations

- `X-ILS-Role` is not authentication.
- The offline React compatibility runtime is not a production React replacement.
- The configure API validates active rules but has no separate draft-configuration workflow.
- POST /api/import is a complete nine-table restore and can set a level as part of that restore; the direct-entry guard covers the transition API.
- Same-level direct entry remains allowed; the correction covers only downward direct entry.
- QA verification scripts and QA-only fixtures are not part of the official venture evidence.
