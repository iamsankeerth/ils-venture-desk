import { useState } from "react";
import { ArrowRight, PlusCircle } from "lucide-react";
import { parseJSON } from "../utils/format.js";
import { can } from "../utils/status.js";
import Button from "./ui/Button.jsx";
import StatusBadge, { ProvenanceLabel } from "./ui/StatusBadge.jsx";
import SectionHeader from "./ui/SectionHeader.jsx";
import SevenStateCards from "./SevenStateCards.jsx";
import BusinessLineTabs from "./BusinessLineTabs.jsx";
import CriteriaMatrix from "./CriteriaMatrix.jsx";
import FinancialLedger from "./FinancialLedger.jsx";
import DecisionHistoryTimeline from "./DecisionHistoryTimeline.jsx";

const TABS = [
  ["overview", "Overview"],
  ["requirements", "Requirements"],
  ["evidence", "Evidence & Financials"],
  ["history", "Decision History"],
];

function lineRoleSummary(line) {
  const models = line.approved_model ? [line.approved_model] : (parseJSON(line.candidate_models_json, []) ?? []);
  const modelText = models.length ? models.join(", ") : "Model pending";
  if (line.track_role === "ACTIVE_GOVERNING") {
    return `${modelText} · Confirmed governing`;
  }
  if (line.track_role === "ASSIGNED_IN_TRACKER") {
    return `${modelText} · Assigned in tracker · Not confirmed governing`;
  }
  if (line.track_role === "CANDIDATE") {
    return `${modelText} · Candidate`;
  }
  if (line.track_role === "PROVISIONAL") {
    return `${modelText} · Provisional · Pending owner confirmation`;
  }
  if (line.track_role === "HISTORICAL_PRESERVED") {
    return `${modelText} · Historical track preserved`;
  }
  return `${modelText} · ${line.track_role}`;
}

function IssueChips({ norm, ventureId }) {
  const chips = [];
  const v = norm.venturesById[ventureId];
  if (v?.model_resolution_status !== "CONFIRMED") {
    chips.push("1 model decision required");
  }
  const unconfiguredProgRules = (norm.catalog ?? []).filter(
    (c) => c.is_configurable_range && c.configured_value == null
  ).length;
  if (unconfiguredProgRules > 0) {
    chips.push(`${unconfiguredProgRules} programme rules awaiting configuration`);
  }
  const unrev = (norm.staffQueue.unreviewed_evidence ?? []).filter((e) => e.venture_id === ventureId).length;
  if (unrev > 0) {
    chips.push(`${unrev} evidence review${unrev === 1 ? "" : "s"} pending`);
  }
  if (!chips.length) chips.push("No open issues");
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <span key={c} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-muted">{c}</span>
      ))}
    </div>
  );
}

function LatestUpdate({ norm, ventureId, role, onReview }) {
  const updates = [...(norm.updatesByVenture[ventureId] ?? [])].sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)));
  const u = updates[0];
  if (!u) {
    return (
      <div className="rounded-xl border border-border-ui bg-white px-4 py-3 text-sm">
        <p className="text-muted">No updates submitted yet.</p>
      </div>
    );
  }
  const claimed = parseJSON(u.claimed_metrics_json, null);
  const metrics = Array.isArray(claimed?.metrics) ? claimed.metrics : Array.isArray(claimed?.wau) ? claimed.wau : null;
  return (
    <div className="rounded-xl border border-border-ui bg-white px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-mono text-xs font-semibold text-nav">{u.id}</p>
        <span className="text-xs text-muted">{u.summary_period ?? ""}</span>
        {u.evidence_id ? (
          <Button onClick={() => onReview(u.evidence_id)}>
            {can(role, "review_evidence") ? `Review ${u.evidence_id}` : `View ${u.evidence_id}`}
          </Button>
        ) : null}
      </div>
      {u.summary_metric ? <p className="mt-1 text-nav">{u.summary_metric}</p> : null}
      {metrics ? (
        <ul className="mt-1 list-disc pl-5 text-muted">
          {metrics.slice(0, 6).map((m, i) => (
            <li key={i} className="font-mono text-xs">{m.criterion ?? m.period ?? ""} {m.period ? `· ${m.period}` : ""} {m.value ?? m.value === 0 ? `· ${m.value}` : ""}</li>
          ))}
        </ul>
      ) : claimed ? <p className="mt-1 font-mono text-xs text-muted">{JSON.stringify(claimed).slice(0, 220)}</p> : null}
      {u.blocker ? <p className="mt-1 text-nav"><span className="font-medium">Blocker:</span> {u.blocker}</p> : null}
      {u.next_action ? <p className="text-nav"><span className="font-medium">Next:</span> {u.next_action}</p> : null}
    </div>
  );
}

export default function VentureWorkspace(props) {
  const { norm, ventureId, tab, onTab, role } = props;
  const venture = norm.venturesById[ventureId];
  const lines = norm.linesByVenture[ventureId] ?? [];
  const [lineId, setLineId] = useState(
    lines.find((l) => l.track_role === "ACTIVE_GOVERNING")?.id
      ?? lines.find((l) => l.track_role === "ASSIGNED_IN_TRACKER")?.id
      ?? lines[0]?.id
      ?? null
  );
  const line = norm.linesById[lineId] ?? lines[0] ?? null;
  if (!venture) return null;

  const isConfirmedModel = venture.model_resolution_status === "CONFIRMED";
  const modelHeaderLabel = isConfirmedModel
    ? venture.primary_business_model
    : "Unresolved · Owner clarification required";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="break-words text-xs text-muted">
            {venture.id} · Governing model: {modelHeaderLabel} · Venture workspace
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-nav">{venture.name}</h1>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-lg bg-nav px-2.5 py-1 text-xs font-semibold text-white">{venture.programme_level}</span>
            <span className="text-nav">{venture.msl_eligibility}</span>
            <ProvenanceLabel text={venture.msl_eligibility_provenance} />
            {venture.advancement_status && venture.advancement_status !== "No transition recorded" ? (
              <span className="text-xs text-muted">{venture.advancement_status}</span>
            ) : null}
          </div>
        </div>
        {can(role, "submit_update") ? (
          <Button
            variant="primary"
            onClick={() => props.onSubmitUpdate({ ventureId, lineId: line?.id })}
            className="shrink-0"
          >
            <PlusCircle size={15} aria-hidden /> Submit Update
          </Button>
        ) : null}
      </div>

      <SevenStateCards venture={venture} />
      {venture.programme_level_provenance ? (
        <p className="text-xs text-muted">Programme level provenance: {venture.programme_level_provenance}</p>
      ) : null}

      <div className="relative">
        <div className="flex gap-1 overflow-x-auto border-b border-border-ui pb-px" role="tablist" aria-label="Venture workspace tabs">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => onTab(id)}
              className={`shrink-0 whitespace-nowrap px-3 py-2 text-sm font-medium ${tab === id ? "border-b-2 border-brand text-nav" : "text-muted hover:text-nav"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" ? (
        <div className="flex flex-col gap-5">
          <section>
            <SectionHeader title="Key issues" />
            <IssueChips norm={norm} ventureId={ventureId} />
          </section>
          {venture.recorded_update ? (
            <section>
              <SectionHeader title="Recorded update" />
              <div className="rounded-xl border border-border-ui bg-white px-4 py-3 text-sm text-nav">
                {venture.recorded_update}
              </div>
            </section>
          ) : null}
          <section>
            <SectionHeader
              title="Latest update"
              action={
                can(role, "submit_update") ? (
                  <Button onClick={() => props.onSubmitUpdate({ ventureId, lineId: line?.id })}>Submit Update</Button>
                ) : null
              }
            />
            <LatestUpdate
              norm={norm}
              ventureId={ventureId}
              role={role}
              onReview={props.onReview}
            />
          </section>
          <section>
            <SectionHeader
              title="Business-model context"
              subtitle={
                isConfirmedModel
                  ? `Governing business model: ${venture.primary_business_model} (Confirmed)`
                  : "Governing business model: Unresolved · Owner clarification required"
              }
            />
            <ul className="flex flex-col gap-2">
              {lines.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border-ui bg-white px-4 py-2.5 text-sm">
                  <span className="font-medium text-nav">{l.line_name}</span>
                  <span className="font-mono text-xs text-muted">{l.id}</span>
                  {l.track_role === "ACTIVE_GOVERNING" && l.approved_model ? (
                    <StatusBadge status="MET" title={`Confirmed governing model ${l.approved_model}`} />
                  ) : null}
                  <span className="text-xs text-muted">{lineRoleSummary(l)}</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <SectionHeader title="Next actions" />
            <div className="flex flex-wrap gap-2">
              {can(role, "submit_update") ? (
                <Button variant="primary" onClick={() => props.onSubmitUpdate({ ventureId, lineId: line?.id })}>
                  Submit Update <ArrowRight size={15} aria-hidden />
                </Button>
              ) : null}
              {can(role, "record_transition") ? (
                <Button onClick={() => props.onTransition(ventureId)}>Record Transition</Button>
              ) : null}
              {can(role, "clarify_model") && venture.model_resolution_status !== "CONFIRMED" ? (
                <Button onClick={() => props.onClarify(ventureId)}>Clarify Model</Button>
              ) : null}
              {can(role, "record_mentor") ? (
                <Button onClick={() => props.onMentor(ventureId)}>Record Mentor Outcome</Button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {tab === "requirements" ? (
        <div className="flex flex-col gap-4">
          <BusinessLineTabs lines={lines} selectedId={line?.id} onSelect={setLineId} />
          <CriteriaMatrix
            norm={norm}
            ventureId={ventureId}
            line={line}
            role={role}
            onChanged={props.onChanged}
            onSubmitUpdate={props.onSubmitUpdate}
            onReview={props.onReview}
            openCriterionId={props.openCriterionId}
          />
        </div>
      ) : null}

      {tab === "evidence" ? <FinancialLedger norm={norm} ventureId={ventureId} role={role} onReview={props.onReview} /> : null}

      {tab === "history" ? (
        <DecisionHistoryTimeline
          norm={norm}
          ventureId={ventureId}
          role={role}
          onTransition={props.onTransition}
          onClarify={props.onClarify}
          onMentor={props.onMentor}
          onCertifyMsl={props.onCertifyMsl}
        />
      ) : null}
    </div>
  );
}
