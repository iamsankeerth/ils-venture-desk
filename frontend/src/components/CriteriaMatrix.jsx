import { useMemo, useState } from "react";
import { ChevronDown, PlusCircle, Settings2 } from "lucide-react";
import { apiRequest } from "../api/client.js";
import { can, canConfigure } from "../utils/status.js";
import { parseJSON } from "../utils/format.js";
import { configurationSchema, PILOT_QUALIFICATION_OPTIONS } from "../utils/criteria.js";
import { evalFor } from "../utils/normalizeState.js";
import Button from "./ui/Button.jsx";
import StatusBadge from "./ui/StatusBadge.jsx";
import { EmptyState } from "./ui/EmptyState.jsx";
import SectionHeader from "./ui/SectionHeader.jsx";
import { modelsForLine } from "./BusinessLineTabs.jsx";

const GATES = [
  ["L0_QUALITATIVE_CHECKLIST", "L0 qualitative requirements"],
  ["L0_TO_L1_DEMAND_BAR", "L0 → L1 demand bars"],
  ["L1_TO_L2_TRACTION_TARGET", "L1 → L2 traction targets"],
  ["MSL_COMMON", "MSL common requirements"],
  ["MSL_MODEL_SPECIFIC", "MSL model-specific requirements"],
];

function relatedEvidence(norm, ventureId, lineId, criterionId, evaluation = null) {
  const obs = norm.observations.filter(
    (o) =>
      o.venture_id === ventureId &&
      o.criterion_id === criterionId &&
      (!lineId || !o.business_line_id || o.business_line_id === lineId)
  );
  const obsEvIds = new Set(obs.map((o) => o.evidence_id).filter(Boolean));
  const evaluatedEvIds = new Set(evaluation?.related_evidence_ids ?? []);
  const rel = [];
  for (const e of norm.evidence) {
    if (e.venture_id !== ventureId) continue;
    if (lineId && e.business_line_id && e.business_line_id !== lineId) continue;
    if (e.criterion_id === criterionId || obsEvIds.has(e.id) || evaluatedEvIds.has(e.id)) {
      rel.push(e);
    }
  }
  return { rel, obs };
}

function CriterionRow({ norm, ventureId, lineId, criterion, role, onReviewed, onSubmitUpdate, onReview, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const schema = configurationSchema(criterion);
  const existingRule = parseJSON(criterion.configured_rule_json, {}) ?? {};
  const [cfg, setCfg] = useState(() => ({
    value: criterion.configured_value == null
      ? ""
      : String(criterion.unit === "INR_PAISE" ? criterion.configured_value / 100 : criterion.configured_value),
    method: existingRule.aggregation_method ?? schema?.defaultMethod ?? "SUM",
    basis: existingRule.metric_basis ?? schema?.defaultBasis ?? "COLLECTED",
    period: existingRule.period ?? (schema?.fields.includes("period") ? "All supplied periods" : ""),
    window: existingRule.window_weeks ?? criterion.window_length ?? "",
    cohort: existingRule.cohort_definition ?? "",
    pilot: existingRule.pilot_qualification ?? PILOT_QUALIFICATION_OPTIONS[0],
    rangeLow: existingRule.range_low ?? "",
    rangeHigh: existingRule.range_high ?? "",
    note: "",
  }));
  const [cfgBusy, setCfgBusy] = useState(false);
  const [cfgError, setCfgError] = useState("");

  const ev = evalFor(norm, ventureId, criterion.criterion_scope === "VENTURE" ? null : lineId, criterion.id);
  const result = ev?.criterion_result ?? "UNKNOWN";
  const { rel, obs } = useMemo(
    () => relatedEvidence(norm, ventureId, criterion.criterion_scope === "VENTURE" ? null : lineId, criterion.id, ev),
    [norm, ventureId, lineId, criterion, ev]
  );
  const latestStatus = ev?.latest_evidence_status ?? (rel.length ? rel[rel.length - 1].evidence_status : null);
  const subconds = parseJSON(criterion.subconditions_json, null)?.subconditions ?? null;

  function updateCfg(key) {
    return (event) => setCfg((previous) => ({ ...previous, [key]: event.target.value }));
  }

  async function configure(e) {
    e.preventDefault();
    setCfgBusy(true);
    setCfgError("");
    try {
      const rule = { aggregation_method: cfg.method };
      if (schema.fields.includes("basis")) {
        rule.metric_basis = cfg.basis;
        rule.period = cfg.period;
      }
      if (schema.fields.includes("window")) {
        rule.window_weeks = cfg.window === "" ? null : Number(cfg.window);
      }
      if (schema.fields.includes("cohort")) {
        rule.cohort_definition = cfg.cohort;
      }
      if (schema.fields.includes("pilot")) {
        rule.pilot_qualification = cfg.pilot;
      }
      if (schema.fields.includes("range")) {
        if (cfg.rangeLow !== "") rule.range_low = Number(cfg.rangeLow);
        if (cfg.rangeHigh !== "") rule.range_high = Number(cfg.rangeHigh);
      }
      const value = cfg.value === ""
        ? null
        : (criterion.unit === "INR_PAISE" ? Math.round(Number(cfg.value) * 100) : Number(cfg.value));
      await apiRequest(`/criteria/${criterion.id}/configure`, {
        method: "POST",
        body: {
          actor: "Demo Programme Owner",
          configured_value: value,
          configured_rule: rule,
          configured_rule_note: cfg.note || undefined,
        },
        role,
      });
      onReviewed();
    } catch (err) {
      setCfgError(err.message);
    } finally {
      setCfgBusy(false);
    }
  }

  return (
    <li className="border-b border-border-ui last:border-0">
      <div className="flex flex-col gap-2 px-4 py-3 hover:bg-slate-50 sm:flex-row sm:items-center sm:gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-start gap-2.5 text-left sm:items-center"
        >
          <ChevronDown size={16} aria-hidden className={`mt-0.5 shrink-0 text-muted transition-transform sm:mt-0 ${open ? "" : "-rotate-90"}`} />
          <span className="min-w-0 flex-1">
            <span className="block break-words text-sm font-medium text-nav">{criterion.name}</span>
            <span className="block break-words font-mono text-xs text-muted">{criterion.id} · {criterion.threshold_description ?? ""}</span>
          </span>
        </button>
        <div className="flex flex-wrap items-center gap-2 pl-6 sm:pl-0">
          {latestStatus ? (
            <StatusBadge status={latestStatus} title="Evidence review status" />
          ) : (
            <span className="text-xs text-muted">No evidence</span>
          )}
          <StatusBadge status={result} title={ev?.detail ?? result} />
          {can(role, "submit_update") ? (
            <button
              type="button"
              onClick={() => onSubmitUpdate?.({ ventureId, lineId, criterionId: criterion.id })}
              className="inline-flex items-center gap-1 rounded-lg border border-border-ui bg-white px-2.5 py-1 text-xs font-medium text-nav hover:bg-slate-100"
            >
              <PlusCircle size={13} aria-hidden /> Submit Update
            </button>
          ) : null}
        </div>
      </div>
      {open ? (
        <div className="flex flex-col gap-3 bg-slate-50/60 px-4 py-3 sm:pl-9 text-sm">
          <p className="text-muted">{criterion.threshold_description ?? criterion.name}</p>
          {subconds ? (
            <ul className="list-disc pl-5 text-muted">
              {subconds.map((s) => <li key={s.id}>{s.description}{s.threshold != null ? ` (≥ ${s.threshold})` : ""}</li>)}
            </ul>
          ) : null}
          {ev ? (
            <div className="rounded-lg bg-white p-3 ring-1 ring-inset ring-border-ui">
              <p className="text-nav"><span className="font-semibold">Computed result: {result}.</span> {ev.detail}</p>
              {ev.verified_readings?.length ? <p className="mt-1 font-mono text-xs text-muted">Verified readings: {JSON.stringify(ev.verified_readings)}</p> : null}
              {ev.pending_corrections?.length ? (
                <div className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                  Pending correction (unreviewed): {ev.pending_corrections.map((p) => `${p.numeric_value} · ${p.period_label}`).join("; ")}
                </div>
              ) : null}
            </div>
          ) : <p className="text-muted">No evaluation for this scope yet.</p>}
          {obs.length > 0 ? (
            <div>
              <p className="mb-1 font-medium text-nav">Claimed measurements ({obs.length})</p>
              <ul className="flex flex-col gap-1">
                {obs.map((o) => (
                  <li key={o.id} className="font-mono text-xs text-muted">
                    {o.id} · {o.period_label ?? "—"} · value: {o.numeric_value ?? "qualitative"} · {o.qualifier_status ?? "no qualifier"} ·
                    evidence {(norm.evidenceById[o.evidence_id]?.evidence_status) ?? "?"}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {rel.length > 0 ? (
            <div>
              <p className="mb-1 font-medium text-nav">Evidence references</p>
              <ul className="flex flex-wrap gap-2">
                {rel.map((e) => (
                  <li key={e.id} className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onReview?.(e.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border-ui bg-white px-2.5 py-1 text-xs font-medium text-nav hover:bg-slate-100"
                    >
                      <span className="font-mono">{e.id}</span>
                      <StatusBadge status={e.evidence_status} title={`${e.id} · ${e.source_type}`} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {criterion.is_configurable_range ? (
            <div className="rounded-lg bg-amber-50 p-3 ring-1 ring-inset ring-amber-200">
              <p className="flex items-center gap-1.5 font-medium text-amber-900"><Settings2 size={15} aria-hidden /> {result === "BLOCKED" ? "Configuration required" : "Programme rule configuration"}</p>
              <p className="mt-0.5 text-xs text-amber-800">
                {criterion.configured_value == null
                  ? "This rule has no valid configuration yet. Only a Programme Owner can configure it."
                  : `Current configured value: ${criterion.configured_value}. Only a Programme Owner can change it.`}
              </p>
              {canConfigure(role) ? (
                <form onSubmit={configure} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {schema.fields.includes("threshold") ? (
                    <label className="block text-xs text-amber-900">
                      <span className="mb-1 block">{schema.thresholdLabel}</span>
                      <input value={cfg.value} onChange={updateCfg("value")} inputMode="decimal" className="w-full rounded-md border border-amber-300 bg-white px-2 py-1 text-sm text-nav" />
                    </label>
                  ) : null}
                  {schema.fields.includes("aggregation") ? (
                    <label className="block text-xs text-amber-900">
                      <span className="mb-1 block">Aggregation method</span>
                      <select value={cfg.method} onChange={updateCfg("method")} className="w-full rounded-md border border-amber-300 bg-white px-2 py-1 text-sm text-nav">
                        {schema.methods.map((method) => <option key={method} value={method}>{method}</option>)}
                      </select>
                    </label>
                  ) : null}
                  {schema.fields.includes("basis") ? (
                    <label className="block text-xs text-amber-900">
                      <span className="mb-1 block">Measurement basis</span>
                      <select value={cfg.basis} onChange={updateCfg("basis")} className="w-full rounded-md border border-amber-300 bg-white px-2 py-1 text-sm text-nav">
                        <option value="COLLECTED">COLLECTED</option>
                        <option value="EARNED">EARNED</option>
                        <option value="BILLED">BILLED</option>
                      </select>
                    </label>
                  ) : null}
                  {schema.fields.includes("period") ? (
                    <label className="block text-xs text-amber-900">
                      <span className="mb-1 block">Measurement period</span>
                      <input value={cfg.period} onChange={updateCfg("period")} placeholder="Verbatim period" className="w-full rounded-md border border-amber-300 bg-white px-2 py-1 text-sm text-nav" />
                    </label>
                  ) : null}
                  {schema.fields.includes("window") ? (
                    <label className="block text-xs text-amber-900">
                      <span className="mb-1 block">{schema.windowLabel ?? "Window weeks"}</span>
                      <input type="number" min="1" value={cfg.window} onChange={updateCfg("window")} className="w-full rounded-md border border-amber-300 bg-white px-2 py-1 text-sm text-nav" />
                    </label>
                  ) : null}
                  {schema.fields.includes("cohort") ? (
                    <label className="block text-xs text-amber-900">
                      <span className="mb-1 block">Cohort definition</span>
                      <input value={cfg.cohort} onChange={updateCfg("cohort")} placeholder="Named cohort" className="w-full rounded-md border border-amber-300 bg-white px-2 py-1 text-sm text-nav" />
                    </label>
                  ) : null}
                  {schema.fields.includes("pilot") ? (
                    <label className="block text-xs text-amber-900">
                      <span className="mb-1 block">Pilot qualification</span>
                      <select value={cfg.pilot} onChange={updateCfg("pilot")} className="w-full rounded-md border border-amber-300 bg-white px-2 py-1 text-sm text-nav">
                        {PILOT_QUALIFICATION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                  ) : null}
                  {schema.fields.includes("range") ? (
                    <>
                      <label className="block text-xs text-amber-900">
                        <span className="mb-1 block">Range low</span>
                        <input type="number" min="0" value={cfg.rangeLow} onChange={updateCfg("rangeLow")} className="w-full rounded-md border border-amber-300 bg-white px-2 py-1 text-sm text-nav" />
                      </label>
                      <label className="block text-xs text-amber-900">
                        <span className="mb-1 block">Range high</span>
                        <input type="number" min="0" value={cfg.rangeHigh} onChange={updateCfg("rangeHigh")} className="w-full rounded-md border border-amber-300 bg-white px-2 py-1 text-sm text-nav" />
                      </label>
                    </>
                  ) : null}
                  <label className="block text-xs text-amber-900">
                    <span className="mb-1 block">Configuration note</span>
                    <input value={cfg.note} onChange={updateCfg("note")} className="w-full rounded-md border border-amber-300 bg-white px-2 py-1 text-sm text-nav" />
                  </label>
                  <div className="flex items-end sm:col-span-2">
                    <Button type="submit" disabled={cfgBusy}>{cfgBusy ? "Saving..." : "Configure Rule"}</Button>
                  </div>
                </form>
              ) : <p className="mt-1 text-xs text-amber-800">Switch to the Programme Owner role to configure.</p>}
              {cfgError ? <p role="alert" className="mt-1 text-xs text-red-700">{cfgError}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export default function CriteriaMatrix({ norm, ventureId, line, role, onChanged, onSubmitUpdate, onReview, openCriterionId }) {
  const models = modelsForLine(line);
  const sections = GATES.map(([gate, title]) => {
    const rows = norm.catalog.filter((c) => {
      if (c.transition_gate !== gate) return false;
      if (c.criterion_scope === "VENTURE") return true;
      return models.includes(c.business_model);
    });
    return { gate, title, rows };
  }).filter((s) => s.rows.length > 0);

  const rollup = norm.rollupByVenture[ventureId];
  if (!sections.length) return <EmptyState title="No applicable criteria" hint="The selected business line has no mapped model yet." />;

  return (
    <div className="flex flex-col gap-5">
      {rollup ? (
        <div className="rounded-xl border border-border-ui bg-white px-4 py-3 text-sm">
          <p className="text-nav">
            <span className="font-semibold">
              Demand bar ({rollup.governing_model ?? "Governing model unresolved"}): {rollup.demand_bar}.
            </span>{" "}
            <span className="text-muted">Full level status: {rollup.full_level_status}</span>
          </p>
        </div>
      ) : null}
      {sections.map((s) => (
        <section key={s.gate}>
          <SectionHeader title={s.title} subtitle={`${s.rows.length} requirement${s.rows.length === 1 ? "" : "s"}`} />
          <ul className="overflow-hidden rounded-xl border border-border-ui bg-white">
            {s.rows.map((c) => (
              <CriterionRow
                key={`${line?.id ?? "venture"}-${c.id}`}
                norm={norm}
                ventureId={ventureId}
                lineId={c.criterion_scope === "VENTURE" ? null : line?.id ?? null}
                criterion={c}
                role={role}
                onReviewed={onChanged}
                onSubmitUpdate={onSubmitUpdate}
                onReview={onReview}
                defaultOpen={openCriterionId === c.id}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
