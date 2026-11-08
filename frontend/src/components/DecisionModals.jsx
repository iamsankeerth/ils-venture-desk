import { useState } from "react";
import { apiRequest } from "../api/client.js";
import { parseJSON } from "../utils/format.js";
import Button from "./ui/Button.jsx";
import Modal from "./ui/Modal.jsx";
import Drawer from "./ui/Drawer.jsx";
import StatusBadge from "./ui/StatusBadge.jsx";
import { modelsForLine } from "./BusinessLineTabs.jsx";

const inputCls = "w-full rounded-lg border border-border-ui bg-white px-3 py-2 text-sm text-nav placeholder:text-muted";
const LEVELS = ["Level 0", "Level 1", "Level 2"];

function BlockerList({ reasons }) {
  if (!reasons?.length) return null;
  return (
    <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      <p className="font-medium">Blocked by programme rules:</p>
      <ul className="mt-1 list-disc pl-5 font-mono text-xs">
        {reasons.map((r, i) => <li key={i}>{r}</li>)}
      </ul>
    </div>
  );
}

function requiredForStandard(norm, venture) {
  // Display-only selection of the backend's required set (results come from the server).
  const gov = venture.primary_business_model;
  const lines = norm.linesByVenture[venture.id] ?? [];
  const out = [];
  const lineIds = lines.filter((l) => l.track_role === "ACTIVE_GOVERNING" && l.approved_model === gov).map((l) => l.id);
  if (venture.programme_level === "Level 0") {
    for (const c of norm.catalog) {
      if (c.transition_gate === "L0_TO_L1_DEMAND_BAR" && c.criterion_scope === "BUSINESS_LINE" && c.business_model === gov) {
        for (const lid of lineIds) out.push({ criterion: c, lineId: lid });
      }
      if (c.transition_gate === "L0_QUALITATIVE_CHECKLIST") out.push({ criterion: c, lineId: null });
    }
  } else if (venture.programme_level === "Level 1") {
    for (const c of norm.catalog) {
      if (c.transition_gate === "L1_TO_L2_TRACTION_TARGET" && c.criterion_scope === "BUSINESS_LINE" && c.business_model === gov) {
        for (const lid of lineIds) out.push({ criterion: c, lineId: lid });
      }
    }
  }
  return out;
}

export function TransitionModal({ norm, ventureId, role, onClose, onDone }) {
  const venture = norm.venturesById[ventureId];
  const [toLevel, setToLevel] = useState(venture?.programme_level === "Level 0" ? "Level 1" : "Level 2");
  const [type, setType] = useState("STANDARD_ADVANCEMENT");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [blockers, setBlockers] = useState([]);

  const required = requiredForStandard(norm, venture);
  const results = required.map(({ criterion, lineId }) =>
    norm.evalMap.get(`${ventureId}|${lineId ?? ""}|${criterion.id}`)?.criterion_result ?? "UNKNOWN"
  );
  const order = { "Level 0": 0, "Level 1": 1, "Level 2": 2 };
  const currentRank = order[venture?.programme_level];
  const directTargets = LEVELS.filter(
    (level) => level !== "Level 0" && (currentRank === undefined || order[level] >= currentRank)
  );
  const targetLevels = type === "DIRECT_ENTRY" ? directTargets : LEVELS;
  const directTargetInvalid = type === "DIRECT_ENTRY" && !directTargets.includes(toLevel);
  const sequential = order[toLevel] - (order[venture?.programme_level] ?? -99) === 1;
  const modelOk = venture?.model_resolution_status === "CONFIRMED";
  const unmet = results.some((r) => r !== "MET");
  const standardBlocked = type === "STANDARD_ADVANCEMENT" && (!sequential || !modelOk || !required.length || unmet);

  function chooseType(nextType) {
    setType(nextType);
    if (nextType === "DIRECT_ENTRY" && !directTargets.includes(toLevel)) {
      setToLevel(directTargets[0]);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setBlockers([]);
    try {
      await apiRequest(`/ventures/${ventureId}/transitions`, {
        method: "POST",
        body: { to_level: toLevel, transition_type: type, approved_by: "Demo Programme Reviewer", reason },
        role,
      });
      onDone();
    } catch (err) {
      setError(err.message);
      setBlockers(err.blockingReasons ?? []);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Record Transition · ${venture?.name ?? ventureId}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-slate-50 p-2.5">
            <p className="text-xs text-muted">Current level</p>
            <p className="font-semibold text-nav">{venture?.programme_level}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2.5">
            <p className="text-xs text-muted">Governing model</p>
            <p className="font-semibold text-nav">{venture?.primary_business_model ?? "Unknown"} {modelOk ? "" : "(unresolved)"}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className={`block rounded-xl border p-3 ${type === "STANDARD_ADVANCEMENT" ? "border-brand bg-teal-50/40" : "border-border-ui"}`}>
            <span className="flex items-center gap-2 text-sm font-medium text-nav">
              <input type="radio" checked={type === "STANDARD_ADVANCEMENT"} onChange={() => setType("STANDARD_ADVANCEMENT")} className="h-4 w-4 accent-brand" />
              Standard Advancement
            </span>
            <span className="mt-1 block text-xs text-muted">Sequential step only, after every applicable requirement is met.</span>
          </label>
          <label className={`block rounded-xl border p-3 ${type === "DIRECT_ENTRY" ? "border-brand bg-teal-50/40" : "border-border-ui"}`}>
            <span className="flex items-center gap-2 text-sm font-medium text-nav">
              <input type="radio" checked={type === "DIRECT_ENTRY"} onChange={() => chooseType("DIRECT_ENTRY")} className="h-4 w-4 accent-brand" />
              Direct Entry
            </span>
            <span className="mt-1 block text-xs text-muted">Placement at Level 1/2 on prior work with justification.</span>
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-nav">Target level</span>
          <select value={toLevel} onChange={(e) => setToLevel(e.target.value)} className={inputCls}>
            {targetLevels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          {directTargetInvalid ? <p className="mt-1 text-xs text-red-700">Direct entry cannot target a level below the current level.</p> : null}
        </label>

        {type === "STANDARD_ADVANCEMENT" ? (
          <div>
            <p className="mb-1 text-sm font-medium text-nav">Required criteria (backend verdicts, display only)</p>
            {!sequential ? <p className="mb-1 text-xs text-red-700">Not a single sequential step from {venture?.programme_level}.</p> : null}
            {!modelOk ? <p className="mb-1 text-xs text-red-700">Governing model is unresolved — clarify it first.</p> : null}
            <ul className="flex max-h-44 flex-col gap-1 overflow-y-auto">
              {required.map(({ criterion, lineId }) => {
                const r = norm.evalMap.get(`${ventureId}|${lineId ?? ""}|${criterion.id}`)?.criterion_result ?? "UNKNOWN";
                return (
                  <li key={`${lineId ?? "v"}-${criterion.id}`} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs">
                    <span className="truncate font-mono text-muted">{criterion.id}{lineId ? ` · ${lineId}` : ""}</span>
                    <StatusBadge status={r} />
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-muted">
            Direct entry records reviewer-approved placement with a criteria snapshot. It does not certify MSL eligibility.
          </p>
        )}

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-nav">Reviewer reason</span>
          <textarea required value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Justification for this decision…" className={inputCls} />
        </label>

        {error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <BlockerList reasons={blockers} />
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy || (type === "STANDARD_ADVANCEMENT" && standardBlocked) || directTargetInvalid} title={standardBlocked ? "Blocked: the UI can already see unmet requirements (the server validates too)" : undefined}>
            {busy ? "Recording…" : "Record Transition"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function ClarifyModal({ norm, ventureId, role, onClose, onDone }) {
  const venture = norm.venturesById[ventureId];
  const lines = norm.linesByVenture[ventureId] ?? [];
  const [model, setModel] = useState(venture?.primary_business_model ?? "");
  const [lineId, setLineId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const compatibleLines = model ? lines.filter((line) => modelsForLine(line).includes(model)) : [];
  const selectedLineId = compatibleLines.some((line) => line.id === lineId)
    ? lineId
    : (compatibleLines.length === 1 ? compatibleLines[0].id : "");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/ventures/${ventureId}/seam-actions`, {
        method: "POST",
        body: { action: "CLARIFY_MODEL", approved_model: model, business_line_id: selectedLineId || undefined, note: note || undefined },
        role,
      });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Clarify Governing Model · ${venture?.name ?? ventureId}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-sm text-muted">Prior tracks stay visible as historical records — clarification never deletes review history.</p>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-nav">Governing model</span>
          <select value={model} onChange={(e) => setModel(e.target.value)} className={inputCls} required>
            <option value="">— Select —</option>
            {["Consumer", "Services", "AI_B2C", "AI_B2B"].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-nav">Governing business line</span>
          <select value={selectedLineId} onChange={(e) => setLineId(e.target.value)} className={inputCls} disabled={!model || !compatibleLines.length}>
            <option value="">— Select a compatible line —</option>
            {compatibleLines.map((l) => <option key={l.id} value={l.id}>{l.line_name}</option>)}
          </select>
        </label>
        {model && !compatibleLines.length ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">No business line is compatible with {model}. Select a different model or clarify the line data first.</p> : null}
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-nav">Note</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Programme owner clarification" className={inputCls} />
        </label>
        {error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy || !selectedLineId}>{busy ? "Saving…" : "Confirm Model"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export function MentorModal({ norm, ventureId, role, onClose, onDone }) {
  const venture = norm.venturesById[ventureId];
  const [f, setF] = useState({ mentor_goal: venture?.mentor_goal ?? "", mentor_status: venture?.mentor_status ?? "", next_update_date: venture?.next_update_date ?? "", follow_up_note: venture?.follow_up_note ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/ventures/${ventureId}/seam-actions`, { method: "POST", body: { action: "LOG_MENTOR_OUTCOME", ...f }, role });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Record Mentor Outcome · ${venture?.name ?? ventureId}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="block"><span className="mb-1 block text-sm font-medium text-nav">Mentor goal</span><input value={f.mentor_goal} onChange={set("mentor_goal")} className={inputCls} /></label>
        <label className="block"><span className="mb-1 block text-sm font-medium text-nav">Mentor status</span><input value={f.mentor_status} onChange={set("mentor_status")} className={inputCls} /></label>
        <label className="block"><span className="mb-1 block text-sm font-medium text-nav">Next update date</span><input value={f.next_update_date} onChange={set("next_update_date")} placeholder="e.g. 2026-11-20" className={inputCls} /></label>
        <label className="block"><span className="mb-1 block text-sm font-medium text-nav">Follow-up note</span><textarea value={f.follow_up_note} onChange={set("follow_up_note")} rows={2} className={inputCls} /></label>
        {error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? "Saving…" : "Save Outcome"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export function MslModal({ norm, ventureId, role, onClose, onDone }) {
  const venture = norm.venturesById[ventureId];
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [blockers, setBlockers] = useState([]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setBlockers([]);
    try {
      await apiRequest(`/ventures/${ventureId}/msl-eligibility`, {
        method: "POST",
        body: { approved_by: "Demo Programme Reviewer", reason },
        role,
      });
      onDone();
    } catch (err) {
      setError(err.message);
      setBlockers(err.blockingReasons ?? []);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Certify MSL Eligibility · ${venture?.name ?? ventureId}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          New certification needs a confirmed model and every MSL checklist item met.
          Imported eligibility on other ventures is preserved regardless.
        </p>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-nav">Reviewer reason</span>
          <textarea required value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Verified complete MSL checklist…" className={inputCls} />
        </label>
        {error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <BlockerList reasons={blockers} />
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? "Certifying…" : "Certify Eligible"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export function CriterionDrawer({ norm, criterionId, onClose }) {
  const c = norm.catalogById[criterionId];
  if (!c) return null;
  const subconds = parseJSON(c.subconditions_json, null)?.subconditions ?? null;
  return (
    <Drawer title={`${c.id} · ${c.name}`} subtitle={c.transition_gate} onClose={onClose}>
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-nav">{c.threshold_description ?? c.name}</p>
        <dl className="rounded-xl border border-border-ui bg-white px-4 py-2">
          <div className="flex justify-between py-1"><dt className="text-muted">Scope</dt><dd className="text-nav">{c.criterion_scope} · {c.business_model}</dd></div>
          <div className="flex justify-between py-1"><dt className="text-muted">Unit</dt><dd className="font-mono text-xs text-nav">{c.unit}</dd></div>
          {c.threshold_value != null ? <div className="flex justify-between py-1"><dt className="text-muted">Threshold</dt><dd className="text-nav">{c.threshold_value}{c.window_length ? ` × ${c.window_length}` : ""}</dd></div> : null}
          {c.is_configurable_range ? <div className="flex justify-between py-1"><dt className="text-muted">Configurable</dt><dd className="text-nav">{c.configured_value ?? "Unconfigured (BLOCKED)"}</dd></div> : null}
        </dl>
        {subconds ? (
          <ul className="list-disc pl-5 text-muted">
            {subconds.map((s) => <li key={s.id}>{s.description}</li>)}
          </ul>
        ) : null}
      </div>
    </Drawer>
  );
}
