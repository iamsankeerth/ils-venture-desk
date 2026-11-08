import { useMemo, useState } from "react";
import { apiRequest } from "../api/client.js";
import { canReview } from "../utils/status.js";
import { formatINRPaise, formatDateTime } from "../utils/format.js";
import Button from "./ui/Button.jsx";
import Drawer from "./ui/Drawer.jsx";
import StatusBadge from "./ui/StatusBadge.jsx";
import SectionHeader from "./ui/SectionHeader.jsx";

function KV({ k, v, mono }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 text-sm">
      <dt className="shrink-0 text-muted">{k}</dt>
      <dd className={`min-w-0 text-right text-nav ${mono ? "font-mono text-xs" : ""}`}>{v ?? "—"}</dd>
    </div>
  );
}

export default function ReviewModal({ evidenceId, norm, role, onClose, onDecided, onOpenCriterion }) {
  const ev = norm.evidenceById[evidenceId];
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  const obs = useMemo(() => norm.obsByEvidence[evidenceId] ?? [], [norm, evidenceId]);
  const history = useMemo(() => norm.historyByEvidence[evidenceId] ?? [], [norm, evidenceId]);

  const obsByCriterion = useMemo(() => {
    const groups = new Map();
    for (const o of obs) {
      const cid = o.criterion_id || "UNLINKED";
      if (!groups.has(cid)) groups.set(cid, []);
      groups.get(cid).push(o);
    }
    return [...groups.entries()];
  }, [obs]);

  const pendingAgainst = useMemo(() => {
    const mine = new Set(obs.map((o) => o.id));
    return norm.observations.filter(
      (o) => o.supersedes_observation_id && mine.has(o.supersedes_observation_id)
        && (norm.evidenceById[o.evidence_id]?.evidence_status ?? "UNREVIEWED") !== "APPROVED"
    );
  }, [norm, obs]);

  const hints = useMemo(() => {
    const out = [];
    for (const o of obs) {
      const cat = norm.catalogById[o.criterion_id];
      if (!cat) continue;
      if (o.criterion_id === "L0L1-AIB2C-2" && o.numeric_value != null && o.numeric_value < 10) {
        out.push(`Week “${o.period_label}” WAU (${o.numeric_value}) is below the 10 threshold.`);
      }
      if (o.criterion_id === "L0L1-AIB2C-1" && (o.qualifier_status ?? "").includes("unrecorded")) {
        out.push("Target-segment membership of the sign-ups is not recorded — sign-up criterion cannot verify.");
      }
      if (cat.unit === "INR_PAISE" && o.numeric_value == null) {
        out.push(`${cat.id}: amount observation missing; cash criteria evaluate from approved COLLECTED records.`);
      }
    }
    return [...new Set(out)];
  }, [obs, norm]);

  if (!ev) return null;
  const venture = norm.venturesById[ev.venture_id];
  const reasonInvalid = touched && !reason.trim();
  const reviewerAllowed = canReview(role);

  async function decide(decision) {
    setTouched(true);
    if (!reason.trim() || !reviewerAllowed) return;
    setSaving(decision);
    setError("");
    try {
      const res = await apiRequest(`/evidence/${evidenceId}/review`, {
        method: "POST",
        body: { decision, reviewer: "Demo Programme Reviewer", reason: reason.trim() },
        role,
      });
      setDone(res);
      onDecided(res);
    } catch (err) {
      setError(err.blockingReasons?.length ? `${err.message} — ${err.blockingReasons.join("; ")}` : err.message);
    } finally {
      setSaving(null);
    }
  }

  const allCriteriaMeasured = obsByCriterion
    .map(([cid]) => cid)
    .filter((cid) => cid !== "UNLINKED");
  if (ev.criterion_id && !allCriteriaMeasured.includes(ev.criterion_id)) {
    allCriteriaMeasured.push(ev.criterion_id);
  }

  return (
    <Drawer
      title={`${reviewerAllowed ? "Review Evidence" : "Evidence Details"} · ${ev.id}`}
      subtitle={`${venture?.name ?? ev.venture_id} · ${ev.source_type ?? "Evidence"}`}
      onClose={onClose}
      footer={
        reviewerAllowed ? (
          <div className="flex flex-col gap-2">
            {error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
            {done ? (
              <p role="status" className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">
                Saved: {done.evidence_status} by {done.reviewer} at {formatDateTime(done.reviewed_at)}. Criterion results refreshed from the server.
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                disabled={saving !== null}
                onClick={() => decide("CHANGES_REQUESTED")}
              >
                {saving === "CHANGES_REQUESTED" ? "Saving…" : "Request Changes"}
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                disabled={saving !== null}
                onClick={() => decide("APPROVED")}
              >
                {saving === "APPROVED" ? "Saving…" : "Approve Evidence"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted">
              Read-only inspection for current role. Programme Reviewer role is required to record review decisions.
            </p>
            <Button onClick={onClose}>Close</Button>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={ev.evidence_status} />
          {ev.reviewer ? <span className="text-xs text-muted">by {ev.reviewer} · {formatDateTime(ev.reviewed_at)}</span> : null}
        </div>

        <section>
          <SectionHeader
            title="Submitted measurements by criterion"
            subtitle="Each measurement is evaluated strictly against its own criterion threshold."
          />
          {obsByCriterion.length === 0 ? (
            <p className="text-sm text-muted">No period observations attached{ev.amount_minor_or_count != null ? " — amount recorded on the evidence itself" : ""}.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {obsByCriterion.map(([cid, groupObs]) => {
                const cat = norm.catalogById[cid];
                const ordered = [...groupObs].sort((a, b) => (a.period_sequence ?? 0) - (b.period_sequence ?? 0));
                return (
                  <div key={cid} className="rounded-xl border border-border-ui bg-white p-3.5 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-nav">{cat?.name ?? cid}</p>
                      {cid !== "UNLINKED" ? (
                        <button
                          type="button"
                          onClick={() => onOpenCriterion?.(cid)}
                          className="font-mono text-xs text-brand hover:underline"
                        >
                          {cid}
                        </button>
                      ) : null}
                    </div>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {ordered.map((o) => (
                        <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs">
                          <span className="text-nav">
                            <span className="font-medium">{o.period_label ?? "Reported"}:</span>{" "}
                            <span className="font-mono font-bold">{o.numeric_value ?? "qualitative"}</span>{" "}
                            {o.unit === "COUNT" && cid === "L0L1-AIB2C-1" ? "claimed sign-ups" : o.metric_type === "WAU" ? "WAU" : ""}
                          </span>
                          {o.qualifier_status ? (
                            <span className="font-mono text-[11px] text-amber-800">
                              {o.qualifier_status.includes("unrecorded")
                                ? "Target-segment membership: Unknown"
                                : o.qualifier_status}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    {cat?.threshold_description ? (
                      <p className="mt-2 text-xs text-muted">
                        Threshold: <span className="font-medium text-nav">{cat.threshold_description}</span>
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
          {ev.amount_minor_or_count != null ? (
            <p className="mt-2 text-sm text-nav">Recorded amount: <span className="font-semibold">{ev.unit === "INR_PAISE" ? formatINRPaise(ev.amount_minor_or_count) : ev.amount_minor_or_count}</span></p>
          ) : null}
        </section>

        {pendingAgainst.length > 0 ? (
          <section className="rounded-xl border border-amber-300 bg-amber-50 p-3">
            <p className="text-sm font-semibold text-amber-900">Pending correction (unreviewed) — not counted</p>
            {pendingAgainst.map((o) => (
              <p key={o.id} className="mt-1 text-sm text-amber-800">
                {o.numeric_value} · {o.period_label} · from {o.evidence_id} (supersedes {o.supersedes_observation_id})
              </p>
            ))}
          </section>
        ) : null}

        {hints.length > 0 ? (
          <section>
            <SectionHeader title="Automated diagnostics" subtitle="Preliminary hints — official criterion verdict is computed by the backend." />
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
              {hints.map((h, i) => <li key={i}>{h}</li>)}
            </ul>
          </section>
        ) : null}

        <section>
          <SectionHeader title="Record metadata" />
          <dl className="rounded-xl border border-border-ui bg-white px-4 py-2">
            <KV k="Ledger bucket" v={ev.ledger_bucket} />
            <KV k="Measured criteria" v={allCriteriaMeasured.length ? allCriteriaMeasured.join(", ") : "Ledger-only"} mono />
            <KV k="Period" v={ev.period_label} />
            <KV k="Earned period" v={ev.earned_period} />
            <KV k="Payment date" v={ev.payment_date} />
            <KV k="Counterparty" v={ev.counterparty} />
            <KV k="Parent record" v={ev.parent_evidence_id} mono />
            <KV k="Detail" v={ev.detail_note} />
          </dl>
        </section>

        <section>
          <SectionHeader title="Review history" />
          {history.length === 0 ? (
            <p className="text-sm text-muted">No reviews recorded yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {history.map((h) => (
                <li key={h.id} className="rounded-xl border border-border-ui bg-white px-4 py-2.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={h.decision} />
                    <span className="text-xs text-muted">{formatDateTime(h.reviewed_at)}</span>
                  </div>
                  <p className="mt-1 text-nav">{h.reason}</p>
                  <p className="text-xs text-muted">by {h.reviewer}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {reviewerAllowed ? (
          <section>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-nav">Reviewer reason (required)</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onBlur={() => setTouched(true)}
                rows={3}
                placeholder="Explain what was checked before approving or requesting changes…"
                aria-invalid={reasonInvalid}
                className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-nav placeholder:text-muted ${reasonInvalid ? "border-red-400" : "border-border-ui"}`}
              />
              {reasonInvalid ? <span className="mt-1 block text-xs text-red-700">A reason is required to record a decision.</span> : null}
            </label>
          </section>
        ) : null}
      </div>
    </Drawer>
  );
}
