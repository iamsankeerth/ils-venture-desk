import { formatINRPaise, formatDateTime } from "../utils/format.js";
import { can } from "../utils/status.js";
import Button from "./ui/Button.jsx";
import StatusBadge from "./ui/StatusBadge.jsx";
import { EmptyState } from "./ui/EmptyState.jsx";
import SectionHeader from "./ui/SectionHeader.jsx";

function DualLedgerRow({ label, claimedDisplay, verifiedDisplay, verifiedFallback = "Unknown", highlightDiff = false }) {
  return (
    <tr className={highlightDiff ? "border-t border-border-ui bg-slate-50/70 font-medium" : "border-t border-slate-100"}>
      <th scope="row" className="py-2 pr-3 text-left font-normal text-nav">{label}</th>
      <td className="py-2 px-3 text-right font-mono text-xs font-semibold text-amber-900">
        {claimedDisplay ?? "Unknown"}
      </td>
      <td className="py-2 pl-3 text-right font-mono text-xs font-semibold text-nav">
        {verifiedDisplay ?? <span className="font-sans font-normal text-muted">{verifiedFallback}</span>}
      </td>
    </tr>
  );
}

function EvidenceCard({ ev, history, role, onReview }) {
  const children = history?._children ?? [];
  const canDecide = can(role, "review_evidence");
  return (
    <article className="rounded-xl border border-border-ui bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-mono text-xs font-semibold text-nav">{ev.id}</p>
        <StatusBadge status={ev.evidence_status} />
        <span className="text-xs text-muted">{ev.source_type} · {ev.ledger_bucket ?? "no bucket"}</span>
        <span className="ml-auto" />
        <Button onClick={() => onReview(ev.id)}>{canDecide ? "Review" : "View details"}</Button>
      </div>
      {ev.detail_note ? <p className="mt-1.5 text-sm text-nav">{ev.detail_note}</p> : null}
      <dl className="mt-1 text-xs text-muted">
        {ev.amount_minor_or_count != null ? <p>Amount: <span className="font-mono">{ev.unit === "INR_PAISE" ? formatINRPaise(ev.amount_minor_or_count) : ev.amount_minor_or_count}</span></p> : null}
        {ev.period_label ? <p>Period: {ev.period_label}</p> : null}
        {ev.earned_period ? <p>Earned: {ev.earned_period}</p> : null}
        {ev.payment_date ? <p>Paid: {ev.payment_date}</p> : null}
        {ev.parent_evidence_id ? <p className="font-mono">↳ settles {ev.parent_evidence_id}</p> : null}
        {children.length ? <p className="font-mono">↳ settled by {children.map((c) => c.id).join(", ")}</p> : null}
        {ev.reviewer ? <p>Last review: {ev.reviewer} · {formatDateTime(ev.reviewed_at)}</p> : null}
      </dl>
      {history?.items?.length ? (
        <ul className="mt-2 flex flex-col gap-1 border-t border-border-ui pt-2">
          {history.items.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-2 text-xs">
              <StatusBadge status={h.decision} />
              <span className="text-muted">{h.reviewer} · {formatDateTime(h.reviewed_at)}</span>
              <span className="w-full text-nav">{h.reason}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export default function FinancialLedger({ norm, ventureId, role, onReview }) {
  const lines = norm.linesByVenture[ventureId] ?? [];
  const venture = norm.venturesById[ventureId];
  const evidence = norm.evidence.filter((e) => e.venture_id === ventureId);
  const byParent = {};
  for (const e of evidence) {
    if (e.parent_evidence_id) (byParent[e.parent_evidence_id] ??= []).push(e);
  }
  const roots = evidence.filter((e) => !e.parent_evidence_id);
  const histOf = (id) => ({ items: norm.historyByEvidence[id] ?? [], _children: byParent[id] ?? [] });

  return (
    <div className="flex flex-col gap-5">
      <section>
        <SectionHeader
          title="Reconciled ledgers (Claimed vs. Verified)"
          subtitle="Submitted claims are shown beside verified (Approved) figures. Arithmetic differences in claims are never certified as verified balances."
        />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {lines.map((l) => {
            const led = norm.ledgerByLine[`${ventureId}|${l.id}`];
            if (!led) return null;
                const hasEarned = led.claimed_earned_paise != null || led.earned_paise != null;
                const hasBilled = led.claimed_billed_paise != null || led.billed_paise != null;
            const verifiedPeriod = led.earned_period && led.earned_period !== "Unknown" ? led.earned_period : "Unknown";
            const claimedPeriod = led.claimed_earned_period && led.claimed_earned_period !== "Unknown" ? led.claimed_earned_period : "Unknown";
            const earnedLabel = verifiedPeriod === claimedPeriod
              ? (verifiedPeriod === "Unknown" ? "Earned (period Unknown)" : `${verifiedPeriod} earned`)
              : `Earned (claimed ${claimedPeriod}; verified ${verifiedPeriod})`;
            const receivedLabel = verifiedPeriod === claimedPeriod
              ? (verifiedPeriod === "Unknown" ? "Received against Unknown" : `Received against ${verifiedPeriod}`)
              : `Received (claimed ${claimedPeriod}; verified ${verifiedPeriod})`;
            const diffFallback = led.verified_balance_note ?? (hasEarned ? "Not a verified receivable" : "Not a verified outstanding balance");
            return (
              <div key={l.id} className="rounded-xl border border-border-ui bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-nav">{l.line_name}</p>
                  <span className="font-mono text-xs text-muted">{l.track_role}</span>
                </div>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-muted">
                        <th className="pb-1.5 text-left font-semibold">Value</th>
                        <th className="pb-1.5 px-3 text-right font-semibold">Claimed (Submitted)</th>
                        <th className="pb-1.5 pl-3 text-right font-semibold">Verified (Approved)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hasBilled || !hasEarned ? (
                        <DualLedgerRow
                          label={hasEarned && hasBilled ? "Sponsorship billed (invoice)" : "Billed"}
                          claimedDisplay={led.claimed_billed_display}
                          verifiedDisplay={led.billed_display}
                        />
                      ) : null}
                      {hasEarned ? (
                        <DualLedgerRow
                          label={earnedLabel}
                          claimedDisplay={led.claimed_earned_display}
                          verifiedDisplay={led.earned_display}
                        />
                      ) : null}
                      <DualLedgerRow
                          label={hasEarned ? receivedLabel : "Collected"}
                        claimedDisplay={led.claimed_collected_display}
                        verifiedDisplay={led.collected_display}
                      />
                      <DualLedgerRow
                        label="Arithmetic difference"
                        claimedDisplay={led.claimed_arithmetic_difference_display}
                        verifiedDisplay={led.arithmetic_difference_display}
                        verifiedFallback={diffFallback}
                        highlightDiff
                      />
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 space-y-1 text-xs text-muted">
                  {(led.claimed_signed_lois || led.signed_lois) ? (
                    <p className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                      Commercial intent: <span className="font-semibold text-nav">{led.claimed_signed_lois ?? 0} claimed LOI(s)</span> ·{" "}
                      <span className="font-semibold text-nav">{led.signed_lois ?? 0} verified LOI(s)</span> — ₹0 revenue contribution.
                    </p>
                  ) : null}
                  <p className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                    <span className="font-semibold text-nav">{led.completed_pilots == null ? "Unknown completed pilots" : `${led.completed_pilots} completed pilot(s)`}</span>.
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        {venture?.historical_traction_text ? (
          <div className="mt-3 rounded-xl border border-dashed border-border-ui bg-white px-4 py-3 text-sm">
            <p className="font-semibold text-nav">Imported historical statement: {venture.historical_traction_text}</p>
            <p className="mt-0.5 text-muted">
              Period unknown · isolated from granular evidence · never summed into the ledgers above.
            </p>
          </div>
        ) : null}
      </section>

      <section>
        <SectionHeader title="Evidence records" subtitle={`${evidence.length} record${evidence.length === 1 ? "" : "s"} · settlements nested under their obligations.`} />
        {evidence.length === 0 ? (
          <EmptyState title="No evidence yet" hint="Submit a progress update to create the first record." />
        ) : (
          <div className="flex flex-col gap-3">
            {roots.map((e) => (
              <div key={e.id} className="flex flex-col gap-2">
                <EvidenceCard ev={e} history={histOf(e.id)} role={role} onReview={onReview} />
                {(byParent[e.id] ?? []).map((c) => (
                  <div key={c.id} className="ml-4 border-l-2 border-border-ui pl-3 sm:ml-8">
                    <EvidenceCard ev={c} history={histOf(c.id)} role={role} onReview={onReview} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
