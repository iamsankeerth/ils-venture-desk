import { useEffect, useState } from "react";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { apiRequest } from "../api/client.js";
import { parseJSON } from "../utils/format.js";
import { blankQualitative, isQualitativeCriterion, qualitativeFields, qualitativeValues } from "../utils/criteria.js";
import { sourcePolicy, unitLabel } from "../utils/evidence.js";
import { isQaOnly } from "../utils/qa.js";
import Button from "./ui/Button.jsx";
import Modal from "./ui/Modal.jsx";

const inputCls = "w-full rounded-lg border border-border-ui bg-white px-3 py-2 text-sm text-nav placeholder:text-muted";
const LEDGERS = ["", "COMMERCIAL_INTENT", "BILLED", "EARNED", "COLLECTED", "USAGE_METRIC"];
const UNIT_OPTIONS = ["", "INR_PAISE", "COUNT", "PERCENT", "QUALITATIVE"];

function blankMetric(criterionId = "") {
  return { criterion_id: criterionId, period_label: "", period_sequence: "", numeric_value: "", qualifier_status: "", supersedes_observation_id: "" };
}

function hasMetricContent(metric) {
  return metric.numeric_value !== ""
    || Boolean(String(metric.period_label ?? "").trim())
    || Boolean(metric.qualifier_status)
    || Boolean(metric.supersedes_observation_id);
}

export default function SubmitUpdateModal({ norm, ventureId, initialLineId = "", initialCriterionId = "", role, onClose, onSubmitted }) {
  const venture = norm.venturesById[ventureId];
  const lines = norm.linesByVenture[ventureId] ?? [];
  const initialCriterion = initialCriterionId ? norm.catalogById[initialCriterionId] : null;
  const [businessLineId, setBusinessLineId] = useState(
    initialLineId || (initialCriterion?.criterion_scope === "VENTURE" ? "" : (lines[0]?.id ?? ""))
  );
  const [criterionId, setCriterionId] = useState(initialCriterionId || "");
  const [summaryMetric, setSummaryMetric] = useState("");
  const [summaryPeriod, setSummaryPeriod] = useState("");
  const [metrics, setMetrics] = useState([blankMetric(initialCriterionId || "")]);
  const [qualitative, setQualitative] = useState({});
  const [useExisting, setUseExisting] = useState(false);
  const [existingId, setExistingId] = useState("");
  const [ev, setEv] = useState({ id: "", source_type: "", ledger_bucket: "", unit: "", display_amount: "", earned_period: "", payment_date: "", counterparty: "", detail_note: "", parent_evidence_id: "" });
  const [amountInr, setAmountInr] = useState("");
  const [blocker, setBlocker] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedCriterion = norm.catalogById[criterionId] ?? null;
  const fields = qualitativeFields(selectedCriterion);
  const qualitativeMode = isQualitativeCriterion(selectedCriterion);
  const isVentureCriterion = selectedCriterion?.criterion_scope === "VENTURE";
  const metricCatalog = selectedCriterion?.criterion_scope
    ? norm.catalog.filter((criterion) => criterion.criterion_scope === selectedCriterion.criterion_scope)
    : norm.catalog;
  const policy = sourcePolicy(norm, ev.source_type);
  const allowedUnits = (policy?.units ?? UNIT_OPTIONS).map((unitValue) => unitValue ?? "");
  const defaultUnit = policy?.allow_amount ? "INR_PAISE" : "";
  const effectiveUnit = ev.unit && allowedUnits.includes(ev.unit) ? ev.unit : defaultUnit;
  const amountPaise = amountInr === "" ? null : Math.round(Number(amountInr) * 100);
  const ventureEvidence = norm.evidence.filter((e) => e.venture_id === ventureId);
  const prefillEnabled = ventureId === "case-a" && isQaOnly();

  useEffect(() => {
    const selected = norm.catalogById[criterionId];
    setBusinessLineId(selected?.criterion_scope === "VENTURE" ? "" : (initialLineId || lines[0]?.id || ""));
    setQualitative(blankQualitative(selected));
  }, [criterionId]);

  function prefillA01() {
    setBusinessLineId(lines.find((l) => l.approved_model === "AI_B2C")?.id ?? lines[0]?.id ?? "");
    setCriterionId("L0L1-AIB2C-2");
    setSummaryMetric("32 sign-ups; 12 WAU then 8 WAU");
    setSummaryPeriod("Week ending 4 October; Week ending 11 October");
    setMetrics([
      { ...blankMetric("L0L1-AIB2C-1"), numeric_value: "32", qualifier_status: "target_segment_membership_unrecorded", period_label: "", period_sequence: "1" },
      { ...blankMetric("L0L1-AIB2C-2"), numeric_value: "12", period_label: "Week ending 4 October", period_sequence: "1" },
      { ...blankMetric("L0L1-AIB2C-2"), numeric_value: "8", period_label: "Week ending 11 October", period_sequence: "2" },
    ]);
    setEv((previous) => ({ ...previous, source_type: "Analytics Excerpt", ledger_bucket: "USAGE_METRIC", unit: "", detail_note: "WAU excerpt; target-segment membership of sign-ups not recorded" }));
    setAmountInr("");
    setBlocker("Target-segment membership of sign-ups not recorded");
    setNextAction("Record target-segment membership and re-verify WAU");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (!blocker.trim() || !nextAction.trim()) {
        throw new Error("Enter a blocker (or 'No blocker') and a concrete next action.");
      }
      if (!useExisting && !ev.source_type.trim()) {
        throw new Error("Provide a supporting evidence source type, or select an existing evidence record.");
      }
      if (!summaryPeriod.trim() && !metrics.some((m) => m.period_label.trim()) && !qualitativeMode) {
        throw new Error("At least one reporting period is required.");
      }
      if (!useExisting && policy?.amount_required && amountInr === "") {
        throw new Error(`${ev.source_type} requires a monetary amount.`);
      }
      if (amountInr !== "" && (!Number.isFinite(Number(amountInr)) || Number(amountInr) < 0)) {
        throw new Error("Amount must be a nonnegative number.");
      }

      const submittedMetrics = metrics.filter(hasMetricContent);
      const numericObservations = submittedMetrics.map((m, i) => ({
        criterion_id: m.criterion_id || criterionId || undefined,
        metric_type: undefined,
        period_label: m.period_label || undefined,
        period_sequence: m.period_sequence === "" ? i + 1 : Number(m.period_sequence),
        numeric_value: m.numeric_value === "" ? undefined : Number(m.numeric_value),
        unit: undefined,
        qualifier_status: m.qualifier_status || undefined,
        supersedes_observation_id: m.supersedes_observation_id || undefined,
      }));
      const qualitativeObservation = qualitativeMode ? {
        criterion_id: criterionId,
        metric_type: selectedCriterion.metric_type,
        period_label: summaryPeriod || "Qualitative review",
        period_sequence: 1,
        unit: selectedCriterion.unit,
        qualifier_status: "met",
        qualitative_value_json: qualitativeValues(selectedCriterion, qualitative),
      } : null;
      const observations = qualitativeObservation ? [...numericObservations, qualitativeObservation] : numericObservations;
      const body = {
        venture_id: ventureId,
        business_line_id: isVentureCriterion ? undefined : (businessLineId || undefined),
        criterion_id: criterionId || undefined,
        summary_metric: summaryMetric || undefined,
        summary_period: summaryPeriod || undefined,
        claimed_metrics_json: { metrics: submittedMetrics.map((m) => ({ criterion: m.criterion_id, period: m.period_label, value: m.numeric_value === "" ? undefined : Number(m.numeric_value), qualifier: m.qualifier_status || undefined })) },
        blocker: blocker || undefined,
        next_action: nextAction || undefined,
      };
      if (useExisting) {
        if (!existingId) throw new Error("Select an existing evidence record.");
        body.evidence_id = existingId;
      } else {
        body.evidence = {
          ...(ev.id ? { id: ev.id } : {}),
          source_type: ev.source_type || undefined,
          ledger_bucket: ev.ledger_bucket || undefined,
          amount_minor_or_count: amountPaise === null ? undefined : amountPaise,
          unit: effectiveUnit || undefined,
          display_amount: ev.display_amount || undefined,
          period_label: summaryPeriod || undefined,
          earned_period: ev.earned_period || undefined,
          payment_date: ev.payment_date || undefined,
          counterparty: ev.counterparty || undefined,
          detail_note: ev.detail_note || undefined,
          parent_evidence_id: ev.parent_evidence_id || undefined,
        };
      }
      body.observations = observations;
      await apiRequest("/updates", { method: "POST", body, role });
      onSubmitted();
    } catch (err) {
      setError(err.blockingReasons?.length ? `${err.message} - ${err.blockingReasons.join("; ")}` : err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Submit Progress Update - ${venture?.name ?? ventureId}`} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="block">
            <span className="mb-1 block text-sm font-medium text-nav">Business line</span>
            {isVentureCriterion ? (
              <p className="rounded-lg border border-border-ui bg-slate-50 px-3 py-2 text-sm text-muted">
                Venture-level criterion. No business line is required.
              </p>
            ) : (
              <select
                value={businessLineId}
                onChange={(e) => setBusinessLineId(e.target.value)}
                aria-label="Business line"
                className={inputCls}
              >
                <option value="">- Select a business line -</option>
                {lines.map((l) => <option key={l.id} value={l.id}>{l.line_name}</option>)}
              </select>
            )}
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-nav">Primary criterion</span>
            <select value={criterionId} onChange={(e) => setCriterionId(e.target.value)} className={inputCls}>
              <option value="">- None -</option>
              {norm.catalog.map((c) => <option key={c.id} value={c.id}>{c.id} - {c.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-nav">Summary metric</span>
            <input value={summaryMetric} onChange={(e) => setSummaryMetric(e.target.value)} placeholder="e.g. 32 sign-ups; 12 then 8 WAU" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-nav">Summary period (verbatim)</span>
            <input value={summaryPeriod} onChange={(e) => setSummaryPeriod(e.target.value)} placeholder="Keep source wording, no invented years" className={inputCls} />
          </label>
        </div>

        {qualitativeMode ? (
          <div className="rounded-lg border border-border-ui bg-slate-50 p-3">
            <p className="mb-2 text-sm font-medium text-nav">Qualitative evidence</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {fields.map((field) => (
                field.kind === "number" ? (
                  <label key={field.key} className="block text-xs text-nav">
                    <span className="mb-1 block">{field.label}</span>
                    <input
                      type="number"
                      min="0"
                      value={qualitative[field.key] ?? ""}
                      onChange={(e) => setQualitative((previous) => ({ ...previous, [field.key]: e.target.value }))}
                      aria-label={field.label}
                      className={inputCls}
                    />
                    {field.threshold != null ? <span className="mt-0.5 block text-muted">Required: at least {field.threshold}</span> : null}
                  </label>
                ) : (
                  <label key={field.key} className="flex items-center gap-2 rounded-lg border border-border-ui bg-white px-3 py-2 text-sm text-nav">
                    <input
                      type="checkbox"
                      checked={Boolean(qualitative[field.key])}
                      onChange={(e) => setQualitative((previous) => ({ ...previous, [field.key]: e.target.checked }))}
                      aria-label={field.label}
                      className="h-4 w-4 accent-brand"
                    />
                    <span>{field.label}</span>
                  </label>
                )
              ))}
            </div>
          </div>
        ) : null}

        {!qualitativeMode ? (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-nav">Reported metrics</p>
            <Button type="button" onClick={() => setMetrics((previous) => [...previous, blankMetric(criterionId)])}><Plus size={15} aria-hidden /> Add row</Button>
          </div>
          <div className="flex flex-col gap-2">
            {metrics.map((m, i) => {
              const qualifierOptions = norm.qualifierOptions?.[m.criterion_id || criterionId] ?? [];
              return (
                <div key={i} className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2 sm:grid-cols-[1fr_1fr_5rem_1fr_auto]">
                  <select value={m.criterion_id} onChange={(e) => setMetrics((previous) => previous.map((x, j) => j === i ? { ...x, criterion_id: e.target.value } : x))} aria-label={`Metric ${i + 1} criterion`} className={inputCls}>
                    <option value="">- criterion -</option>
                    {metricCatalog.map((c) => <option key={c.id} value={c.id}>{c.id}</option>)}
                  </select>
                  <input value={m.period_label} onChange={(e) => setMetrics((previous) => previous.map((x, j) => j === i ? { ...x, period_label: e.target.value } : x))} placeholder="Period (verbatim)" aria-label={`Metric ${i + 1} period`} className={inputCls} />
                  <input value={m.numeric_value} onChange={(e) => setMetrics((previous) => previous.map((x, j) => j === i ? { ...x, numeric_value: e.target.value } : x))} placeholder="Value" inputMode="numeric" aria-label={`Metric ${i + 1} value`} className={inputCls} />
                  {qualifierOptions.length ? (
                    <select value={m.qualifier_status} onChange={(e) => setMetrics((previous) => previous.map((x, j) => j === i ? { ...x, qualifier_status: e.target.value } : x))} aria-label={`Metric ${i + 1} qualifier`} className={inputCls}>
                      <option value="">- qualifier -</option>
                      {qualifierOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : (
                    <input value={m.qualifier_status} onChange={(e) => setMetrics((previous) => previous.map((x, j) => j === i ? { ...x, qualifier_status: e.target.value } : x))} placeholder="Qualifier (optional)" aria-label={`Metric ${i + 1} qualifier`} className={inputCls} />
                  )}
                  <button type="button" onClick={() => setMetrics((previous) => previous.filter((_, j) => j !== i))} aria-label={`Remove metric ${i + 1}`} className="col-span-2 rounded-lg p-2 text-muted hover:bg-slate-200 sm:col-span-1">
                    <Trash2 size={16} />
                  </button>
                  <input value={m.supersedes_observation_id} onChange={(e) => setMetrics((previous) => previous.map((x, j) => j === i ? { ...x, supersedes_observation_id: e.target.value } : x))} placeholder="Supersedes observation ID (corrections only)" aria-label={`Metric ${i + 1} supersedes`} className={`${inputCls} col-span-2 font-mono text-xs sm:col-span-5`} />
                </div>
              );
            })}
          </div>
        </div>
        ) : null}

        <div className="rounded-lg border border-border-ui p-3">
          <label className="mb-2 flex items-center gap-2 text-sm text-nav">
            <input type="checkbox" checked={useExisting} onChange={(e) => setUseExisting(e.target.checked)} className="h-4 w-4 accent-brand" />
            Attach to an existing evidence record
          </label>
          {useExisting ? (
            <select value={existingId} onChange={(e) => setExistingId(e.target.value)} className={inputCls} aria-label="Existing evidence record">
              <option value="">- Select record -</option>
              {ventureEvidence.map((e) => <option key={e.id} value={e.id}>{e.id} - {e.source_type} - {e.evidence_status}</option>)}
            </select>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input value={ev.id} onChange={(e) => setEv((previous) => ({ ...previous, id: e.target.value }))} placeholder="Evidence ID (blank = auto)" aria-label="New evidence ID" className={`${inputCls} font-mono`} />
              <input value={ev.source_type} onChange={(e) => setEv((previous) => ({ ...previous, source_type: e.target.value }))} placeholder="Source type (Invoice, LOI...)" aria-label="Source type" className={inputCls} />
              <select value={ev.ledger_bucket} onChange={(e) => setEv((previous) => ({ ...previous, ledger_bucket: e.target.value }))} aria-label="Ledger bucket" className={inputCls}>
                {LEDGERS.map((l) => <option key={l} value={l}>{l || "- ledger bucket -"}</option>)}
              </select>
              <label className="block text-xs text-nav">
                <span className="mb-1 block">Evidence unit</span>
                <select value={effectiveUnit} onChange={(e) => setEv((previous) => ({ ...previous, unit: e.target.value }))} aria-label="Evidence unit" className={inputCls}>
                  {allowedUnits.map((unitValue) => <option key={unitValue || "none"} value={unitValue}>{unitLabel(unitValue)}</option>)}
                </select>
              </label>
              {effectiveUnit === "INR_PAISE" ? (
                <label className="block text-xs text-nav">
                  <span className="mb-1 block">Amount (INR)</span>
                  <input value={amountInr} onChange={(e) => setAmountInr(e.target.value)} placeholder="e.g. 20000" inputMode="decimal" aria-label="Amount (INR)" className={inputCls} />
                  <span className="mt-0.5 block text-muted">{amountPaise === null || !Number.isFinite(amountPaise) ? "Stored as integer paise" : `Stored as ${amountPaise} paise`}</span>
                </label>
              ) : null}
              <input value={ev.detail_note} onChange={(e) => setEv((previous) => ({ ...previous, detail_note: e.target.value }))} placeholder="Detail note" aria-label="Detail note" className={`${inputCls} sm:col-span-2`} />
              <input value={ev.parent_evidence_id} onChange={(e) => setEv((previous) => ({ ...previous, parent_evidence_id: e.target.value }))} placeholder="Parent evidence ID (settlements only)" aria-label="Parent evidence ID" className={`${inputCls} font-mono`} />
              <input value={ev.counterparty} onChange={(e) => setEv((previous) => ({ ...previous, counterparty: e.target.value }))} placeholder="Counterparty" aria-label="Counterparty" className={inputCls} />
              <input value={ev.earned_period} onChange={(e) => setEv((previous) => ({ ...previous, earned_period: e.target.value }))} placeholder="Earned period (verbatim)" aria-label="Earned period" className={inputCls} />
              <input value={ev.payment_date} onChange={(e) => setEv((previous) => ({ ...previous, payment_date: e.target.value }))} placeholder="Payment date (verbatim)" aria-label="Payment date" className={inputCls} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-nav">Blocker</span>
            <input required value={blocker} onChange={(e) => setBlocker(e.target.value)} placeholder="If none, enter 'No blocker'" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-nav">Next action</span>
            <input required value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="What happens next?" className={inputCls} />
          </label>
        </div>

        {error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <div className="flex flex-wrap justify-between gap-2">
          {prefillEnabled ? (
            <Button type="button" onClick={prefillA01}><Wand2 size={15} aria-hidden /> Prefill Mock A-01 (QA only)</Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving}>{saving ? "Submitting..." : "Submit Update"}</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
