import { ArrowRight, CircleAlert, FileSearch, FileText, Settings2, Stethoscope, Truck } from "lucide-react";
import { can } from "../utils/status.js";
import Button from "./ui/Button.jsx";
import { EmptyState } from "./ui/EmptyState.jsx";

function ventureName(norm, id) {
  return norm.venturesById[id]?.name ?? id;
}

function Row({ title, meta, context, actionLabel, onAction, icon: Icon }) {
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <span className="hidden rounded-lg bg-slate-100 p-2 text-muted sm:block" aria-hidden>
        <Icon size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-medium text-nav">{title}</p>
        <p className="mt-0.5 break-words text-sm text-muted">{meta}</p>
        {context ? <p className="mt-0.5 font-mono text-xs text-muted">{context}</p> : null}
      </div>
      <Button onClick={onAction} className="shrink-0 self-start sm:self-center">
        {actionLabel}
        <ArrowRight size={15} aria-hidden />
      </Button>
    </li>
  );
}

function Section({ title, count, children, emptyHint }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border-ui bg-white">
      <div className="flex items-center justify-between border-b border-border-ui px-4 py-3">
        <h2 className="text-sm font-semibold text-nav">{title}</h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{count}</span>
      </div>
      {count === 0 ? (
        <div className="px-4 py-2"><EmptyState bare title="All clear" hint={emptyHint} /></div>
      ) : (
        <ul className="divide-y divide-border-ui">{children}</ul>
      )}
    </section>
  );
}

export default function StaffQueueView({ norm, role, onOpenVenture, onReview, onClarify, onMentor, onImport, canImport, onSubmitUpdate }) {
  const q = norm.staffQueue;
  const unreviewed = q.unreviewed_evidence ?? [];
  const clarifs = q.owner_clarifications ?? [];
  const followups = q.mentor_followups ?? [];
  const pending = q.pending_actions ?? [];
  const unresolved = q.unresolved_criteria ?? [];

  const allowReview = can(role, "review_evidence");
  const allowClarify = can(role, "clarify_model");
  const allowMentor = can(role, "record_mentor");

  const modelClarifsCount = clarifs.filter((c) => c.venture_id).length;
  const ruleClarifsCount = clarifs.filter((c) => c.criterion_id).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-nav">Work Queue</h1>
          <p className="mt-1 text-sm text-muted">
            {unreviewed.length} evidence review{unreviewed.length === 1 ? "" : "s"} pending ·{" "}
            {modelClarifsCount} model decision{modelClarifsCount === 1 ? "" : "s"} required ·{" "}
            {ruleClarifsCount} programme rule{ruleClarifsCount === 1 ? "" : "s"} awaiting configuration
          </p>
        </div>
        {canImport ? <Button variant="primary" onClick={onImport}>Import Venture</Button> : null}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Section title="Evidence requiring review" count={unreviewed.length} emptyHint="No evidence awaiting review.">
          {unreviewed.map((item) => (
            <Row
              key={item.id}
              icon={FileSearch}
              title={`${item.id} · ${item.source_type ?? "Evidence"}`}
              meta={`${ventureName(norm, item.venture_id)} · ${item.detail ?? "Submitted measurements awaiting review"}`}
              context={item.venture_id}
              actionLabel={allowReview ? "Review evidence" : "View details"}
              onAction={() => onReview(item.id)}
            />
          ))}
        </Section>

        <Section title="Reviewed criteria needing follow-up" count={unresolved.length} emptyHint="No reviewed criteria remain unresolved.">
          {unresolved.map((item) => {
            const canSubmit = can(role, "submit_update");
            return (
              <Row
                key={`${item.venture_id}-${item.business_line_id ?? "venture"}-${item.criterion_id}`}
                icon={FileText}
                title={`${item.criterion_id} - ${item.criterion_name ?? "Requirement"}`}
                meta={`${ventureName(norm, item.venture_id)} - ${item.line_name ?? "Venture level"} - ${item.criterion_result}`}
                context={item.detail}
                actionLabel={canSubmit ? "Submit follow-up" : "Open venture"}
                onAction={() => canSubmit
                  ? onSubmitUpdate?.({ ventureId: item.venture_id, lineId: item.business_line_id ?? "", criterionId: item.criterion_id })
                  : onOpenVenture(item.venture_id, "requirements")}
              />
            );
          })}
        </Section>

        <Section
          title={`Owner clarification (${modelClarifsCount} models, ${ruleClarifsCount} rules)`}
          count={clarifs.length}
          emptyHint="No unresolved models or rules."
        >
          {clarifs.map((item, i) => (
            <Row
              key={`${item.venture_id ?? item.criterion_id ?? i}`}
              icon={item.criterion_id ? Settings2 : CircleAlert}
              title={item.venture_id ? `${ventureName(norm, item.venture_id)} · Business model unresolved` : `Rule configuration · ${item.criterion_id}`}
              meta={item.reason}
              context={item.venture_id ?? item.criterion_id}
              actionLabel={
                item.venture_id
                  ? (allowClarify ? "Clarify model" : "Open venture")
                  : "View catalogue"
              }
              onAction={() =>
                item.venture_id
                  ? (allowClarify ? onClarify(item.venture_id) : onOpenVenture(item.venture_id, "overview"))
                  : onOpenVenture(null)
              }
            />
          ))}
        </Section>

        <Section title="Mentor & participant follow-up" count={followups.length} emptyHint="No follow-ups outstanding.">
          {followups.map((item, i) => (
            <Row
              key={`${item.venture_id}-${i}`}
              icon={Stethoscope}
              title={`${ventureName(norm, item.venture_id)} · Follow-up required`}
              meta={item.note}
              context={item.venture_id}
              actionLabel={allowMentor ? "Record outcome" : "Open venture"}
              onAction={() => allowMentor ? onMentor(item.venture_id) : onOpenVenture(item.venture_id, "overview")}
            />
          ))}
        </Section>

        <Section title="Transition & handover" count={pending.length} emptyHint="No pending transitions or handovers.">
          {pending.map((item, i) => (
            <Row
              key={`${item.id ?? item.venture_id}-${i}`}
              icon={Truck}
              title={item.id ? `${item.id} · Changes requested` : `${ventureName(norm, item.venture_id)} · MSL handover context`}
              meta={item.reason ?? item.note ?? ""}
              context={item.venture_id}
              actionLabel={item.id ? (allowReview ? "Re-review" : "View details") : "Inspect handover"}
              onAction={() => item.id ? onReview(item.id) : onOpenVenture(item.venture_id, "history")}
            />
          ))}
        </Section>
      </div>
    </div>
  );
}
