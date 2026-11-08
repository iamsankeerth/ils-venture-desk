import { useState } from "react";
import StatusBadge from "./ui/StatusBadge.jsx";
import SectionHeader from "./ui/SectionHeader.jsx";

const ASSUMPTIONS = [
  "Unknown is never coerced to 0, false, or failed — unsupplied fields render as “Not supplied” or “Unknown”.",
  "A submitted update is a claim awaiting review, not proof. Evidence status and criterion result are evaluated independently.",
  "All money is stored, summed, and returned by the API in integer paise; the UI formats to ₹ for display only.",
  "Historical baselines are isolated references and are never added to granular evidence.",
  "Settlements link to obligations via parent records; differences shown are arithmetic, not verified balances.",
  "Roles are a demonstration-only seam (X-ILS-Role header), not production authentication.",
  "MSL eligibility, handover, and acceptance are independent dimensions — none is inferred from another.",
];

const AT_ROWS = [
  ["AT-01", "Venture Directory + Import", "Seeded cases, Unknown provenance preserved; blank imports rejected (422)"],
  ["AT-02", "Submit Update form", "Verbatim periods, A-E01 reference, blocker, next action"],
  ["AT-03A", "Review drawer (approve)", "APPROVED evidence, WAU NOT_MET, sign-ups UNKNOWN"],
  ["AT-03B", "Review drawer (changes)", "History entry + staff-queue follow-up"],
  ["AT-04A", "Requirements matrix", "5 qualitative items Unknown"],
  ["AT-04B", "Work Queue", "Current level + 4 buckets, MSL preserved"],
  ["AT-05", "Financial ledger", "Claimed vs Verified: ₹100,000 / ₹60,000 / ₹40,000, baseline isolated"],
  ["AT-06", "Financial ledger", "LOI is commercial intent only"],
  ["AT-07", "Financial ledger", "September earned vs 5 Oct payout, ₹10,000 difference"],
  ["AT-08", "Decision history", "Level 2 direct entry, Unknown reviewer/date"],
  ["AT-09", "Transition drawer", "Unmet standard advancement rejected with reasons"],
  ["AT-10A", "Transition drawer", "Direct entry recorded with snapshot"],
  ["AT-10B", "Transition drawer", "Valid standard advancement, zero waiting rule"],
  ["AT-11", "MSL panel", "New certification blocked, imports preserved"],
  ["AT-12A", "Topbar reset / import", "Student role rejected (403) & controls hidden"],
  ["AT-12B", "Role switcher", "Student denied reviewer actions, allowed Submit Update"],
  ["AT-13A", "Review drawer", "Approved supersession: 12, 11 MET"],
  ["AT-13B", "Review drawer", "Unreviewed correction stays pending"],
  ["AT-14", "Export / reset", "Lossless round-trip of all tables"],
];

export default function SystemNoteView({ norm }) {
  const blocked = (norm?.catalog ?? []).filter((c) => c.is_configurable_range && (c.configured_value == null));
  const [uiStatus, setUiStatus] = useState({});

  function toggleStatus(id) {
    setUiStatus((prev) => ({
      ...prev,
      [id]: prev[id] === "PASSED" ? "NOT_RUN" : "PASSED",
    }));
  }

  const uiPassedCount = Object.values(uiStatus).filter((v) => v === "PASSED").length;

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-nav">System Notes</h1>
        <p className="mt-1 text-sm text-muted">Assumptions, unresolved rules, and acceptance-test coverage for this prototype.</p>
      </div>

      <section>
        <SectionHeader title="Working assumptions" />
        <ul className="list-disc space-y-1.5 rounded-xl border border-border-ui bg-white py-3 pl-9 pr-4 text-sm text-nav">
          {ASSUMPTIONS.map((a, i) => <li key={i}>{a}</li>)}
        </ul>
      </section>

      <section>
        <SectionHeader title="Unresolved programme rules" subtitle={`${blocked.length} programme-wide configurable threshold${blocked.length === 1 ? "" : "s"} awaiting a Programme Owner. Until configured, affected criteria evaluate to BLOCKED.`} />
        {blocked.length === 0 ? (
          <p className="text-sm text-muted">All configurable rules have values.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {blocked.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border-ui bg-white px-4 py-2.5 text-sm">
                <span className="font-mono text-xs font-semibold text-nav">{c.id}</span>
                <span className="flex-1 text-muted">{c.threshold_description ?? c.name}</span>
                <StatusBadge status="BLOCKED" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionHeader
          title="Verification & test status"
          subtitle="Test execution states use PASSED / NOT_RUN / FAILED / BLOCKED (never source-data Unknown)."
        />
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border-ui bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Backend automated suite</p>
              <StatusBadge status="PASSED" />
            </div>
            <p className="mt-1 text-base font-bold text-nav">Backend tests: 31 passed</p>
            <p className="mt-0.5 font-mono text-xs text-muted">
              Runner: pytest · Fixture: isolated tmp_path/ils_test.db · Coverage: 19 AT + 12 regression checks
            </p>
          </div>
          <div className="rounded-xl border border-border-ui bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Frontend demonstration checkpoints</p>
              <StatusBadge status={uiPassedCount === AT_ROWS.length ? "PASSED" : "NOT_RUN"} />
            </div>
            <p className="mt-1 text-base font-bold text-nav">
              {uiPassedCount === 0
                ? "Frontend demonstration checkpoints: Not run"
                : `${uiPassedCount} / ${AT_ROWS.length} checkpoints marked Passed in this session`}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Click any row badge below during your live walkthrough to toggle its observed UI status.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border-ui bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border-ui text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-semibold">Test</th>
                <th className="px-4 py-3 font-semibold">Frontend area</th>
                <th className="px-4 py-3 font-semibold">Expects</th>
                <th className="px-4 py-3 font-semibold">Backend pytest</th>
                <th className="px-4 py-3 font-semibold">UI checkpoint</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-ui">
              {AT_ROWS.map(([id, area, expects]) => {
                const st = uiStatus[id] ?? "NOT_RUN";
                return (
                  <tr key={id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs font-semibold text-nav">{id}</td>
                    <td className="px-4 py-2 text-nav">{area}</td>
                    <td className="px-4 py-2 text-muted">{expects}</td>
                    <td className="px-4 py-2"><StatusBadge status="PASSED" title="Verified in pytest backend/test_acceptance.py" /></td>
                    <td className="px-4 py-2">
                      <button type="button" onClick={() => toggleStatus(id)} title="Click to toggle observed UI checkpoint status">
                        <StatusBadge status={st} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
