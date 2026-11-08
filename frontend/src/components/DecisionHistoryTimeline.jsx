import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { parseJSON, formatDateTime } from "../utils/format.js";
import Button from "./ui/Button.jsx";
import StatusBadge, { ProvenanceLabel } from "./ui/StatusBadge.jsx";
import { EmptyState } from "./ui/EmptyState.jsx";
import SectionHeader from "./ui/SectionHeader.jsx";
import { can, canReview, canLogMentor } from "../utils/status.js";

function Snapshot({ data }) {
  const [open, setOpen] = useState(false);
  const snap = parseJSON(data, null);
  if (!snap || typeof snap !== "object") return null;
  const entries = Object.entries(snap);
  if (!entries.length) return null;
  return (
    <div className="mt-2">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-1 text-xs font-medium text-muted hover:text-nav">
        <ChevronDown size={14} aria-hidden className={open ? "" : "-rotate-90"} />
        Criteria snapshot ({entries.length})
      </button>
      {open ? (
        <ul className="mt-1.5 flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg bg-slate-50 p-2">
          {entries.map(([id, r]) => (
            <li key={id} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-mono text-muted">{id}</span>
              <StatusBadge status={r} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function DecisionHistoryTimeline({ norm, ventureId, role, onTransition, onClarify, onMentor, onCertifyMsl }) {
  const transitions = [...(norm.transitionsByVenture[ventureId] ?? [])].reverse();
  const msl = [...(norm.mslByVenture[ventureId] ?? [])].reverse();

  return (
    <div className="flex flex-col gap-5">
      <section>
        <SectionHeader
          title="Level transitions"
          subtitle="Standard advancement and direct-entry placements. MSL eligibility is separate."
          action={canReview(role) ? <Button onClick={() => onTransition(ventureId)}>Record Transition</Button> : null}
        />
        {transitions.length === 0 ? (
          <EmptyState title="No transitions recorded" hint="This venture has no level transitions yet." />
        ) : (
          <ol className="relative ml-2 flex flex-col gap-3 border-l-2 border-border-ui pl-5">
            {transitions.map((t) => (
              <li key={t.id} className="rounded-xl border border-border-ui bg-white px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-nav">{t.from_level} → {t.to_level}</span>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-muted">{t.transition_type}</span>
                  {t.transition_type === "HISTORICAL_IMPORTED" ? <ProvenanceLabel text="Historical" /> : null}
                </div>
                <p className="mt-1 text-nav">{t.reason}</p>
                <p className="mt-0.5 text-xs text-muted">
                  by {t.approved_by} · {formatDateTime(t.approved_at)}
                  {t.provenance_note ? ` · ${t.provenance_note}` : ""}
                </p>
                <Snapshot data={t.criteria_snapshot_json} />
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <SectionHeader
          title="MSL eligibility"
          subtitle="Preserved imports stay intact; new certification needs the full checklist met."
          action={canReview(role) ? <Button onClick={() => onCertifyMsl(ventureId)}>Certify Eligible</Button> : null}
        />
        {msl.length === 0 ? (
          <EmptyState title="No MSL decisions" hint="Eligibility is Unknown until certified or imported." />
        ) : (
          <ol className="relative ml-2 flex flex-col gap-3 border-l-2 border-border-ui pl-5">
            {msl.map((m) => (
              <li key={m.id} className="rounded-xl border border-border-ui bg-white px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-nav">{m.decision_status}</span>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-muted">{m.decision_type}</span>
                  {m.provenance_source ? <ProvenanceLabel text={m.provenance_source} /> : null}
                </div>
                <p className="mt-1 text-nav">{m.reason}</p>
                <p className="mt-0.5 text-xs text-muted">by {m.approved_by} · {formatDateTime(m.approved_at)}</p>
                <Snapshot data={m.msl_criteria_snapshot_json} />
              </li>
            ))}
          </ol>
        )}
      </section>

      {(can(role, "clarify_model") || canLogMentor(role)) ? (
        <section>
          <SectionHeader title="Model & mentor actions" />
          <div className="flex flex-wrap gap-2">
            {can(role, "clarify_model") ? <Button onClick={() => onClarify(ventureId)}>Clarify Model</Button> : null}
            {canLogMentor(role) ? <Button onClick={() => onMentor(ventureId)}>Record Mentor Outcome</Button> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
