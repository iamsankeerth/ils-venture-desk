import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { apiRequest } from "../api/client.js";
import Button from "./ui/Button.jsx";
import Modal from "./ui/Modal.jsx";

const MODELS = ["", "Consumer", "Services", "AI_B2C", "AI_B2B"];
const LEVELS = ["", "Level 0", "Level 1", "Level 2"];
const UNRESOLVED_ROLES = ["ASSIGNED_IN_TRACKER", "CANDIDATE", "PROVISIONAL", "HISTORICAL_PRESERVED"];
const CONFIRMED_ROLES = ["ACTIVE_GOVERNING", "ASSIGNED_IN_TRACKER", "CANDIDATE", "PROVISIONAL", "HISTORICAL_PRESERVED"];

function field(label, control, hint) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-nav">{label}</span>
      {control}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

const inputCls = "w-full rounded-lg border border-border-ui bg-white px-3 py-2 text-sm text-nav placeholder:text-muted";

export default function ImportVentureModal({ role, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: "",
    activity: "",
    source_type: "Imported from tracker",
    tracker_sector: "",
    primary_business_model: "",
    model_resolution_status: "UNRESOLVED",
    programme_level: "",
    development_stage: "",
    fundraising_preference: "",
  });
  const [lines, setLines] = useState([
    { line_name: "", model: "", track_role: "ASSIGNED_IN_TRACKER" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => {
    const val = e.target.value;
    setForm((f) => {
      const next = { ...f, [k]: val };
      if (k === "model_resolution_status" && val === "UNRESOLVED") {
        next.primary_business_model = "";
        setLines((prev) =>
          prev.map((l) => ({
            ...l,
            track_role: l.track_role === "ACTIVE_GOVERNING" ? "ASSIGNED_IN_TRACKER" : l.track_role,
          }))
        );
      } else if (k === "model_resolution_status" && val === "CONFIRMED") {
        setLines((prev) => {
          if (!prev.length) return [{ line_name: "Primary line", model: next.primary_business_model || "Services", track_role: "ACTIVE_GOVERNING" }];
          return prev.map((l, idx) => (idx === 0 ? { ...l, track_role: "ACTIVE_GOVERNING", model: l.model || next.primary_business_model } : l));
        });
      }
      return next;
    });
  };

  function validateForm() {
    const trimmedName = form.name.trim();
    if (!trimmedName || trimmedName.toLowerCase() === "untitled venture") {
      return "Venture name is required.";
    }
    if (!form.activity.trim()) {
      return "Activity is required for an imported or manually entered venture.";
    }
    if (!form.source_type.trim()) {
      return "Source reference / provenance is required (e.g. Imported from tracker or Manual entry).";
    }
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const hasAny = l.line_name.trim() || l.model;
      if (!hasAny && lines.length === 1 && form.model_resolution_status === "UNRESOLVED") {
        continue;
      }
      if (!l.line_name.trim()) {
        return `Business line ${i + 1} requires a line name (or remove the empty row).`;
      }
      if (!l.model) {
        return `Business line "${l.line_name.trim()}" requires a business model.`;
      }
    }
    const nonEmptyLines = lines.filter((l) => l.line_name.trim() && l.model);
    if (form.model_resolution_status === "UNRESOLVED") {
      if (form.primary_business_model) {
        return "When model resolution is UNRESOLVED, governing business model must remain Unresolved.";
      }
      if (nonEmptyLines.some((l) => l.track_role === "ACTIVE_GOVERNING")) {
        return "When model resolution is UNRESOLVED, no business line may be ACTIVE_GOVERNING.";
      }
    } else {
      if (!form.primary_business_model) {
        return "When model resolution is CONFIRMED, select the confirmed governing business model.";
      }
      const govLines = nonEmptyLines.filter((l) => l.track_role === "ACTIVE_GOVERNING");
      if (govLines.length !== 1) {
        return "When model resolution is CONFIRMED, exactly one business line must be ACTIVE_GOVERNING.";
      }
      if (govLines[0].model !== form.primary_business_model) {
        return `The ACTIVE_GOVERNING line model (${govLines[0].model}) must match the confirmed governing model (${form.primary_business_model}).`;
      }
    }
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        activity: form.activity.trim(),
        programme_level_provenance: form.source_type.trim(),
        model_resolution_status: form.model_resolution_status,
      };
      if (form.model_resolution_status === "CONFIRMED" && form.primary_business_model) {
        body.primary_business_model = form.primary_business_model;
      }
      for (const k of ["tracker_sector", "programme_level", "development_stage", "fundraising_preference"]) {
        if (form[k]?.trim()) body[k] = form[k].trim();
      }
      const bl = lines
        .filter((l) => l.line_name.trim() && l.model)
        .map((l) => ({
          line_name: l.line_name.trim(),
          approved_model: form.model_resolution_status === "CONFIRMED" && l.track_role === "ACTIVE_GOVERNING" ? l.model : null,
          track_role: l.track_role,
          candidate_models: [l.model],
        }));
      if (bl.length) body.business_lines = bl;
      const created = await apiRequest("/ventures", { method: "POST", body, role });
      onCreated(created.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const allowedRoles = form.model_resolution_status === "CONFIRMED" ? CONFIRMED_ROLES : UNRESOLVED_ROLES;

  return (
    <Modal title="Import Venture" onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {field("Venture name *", <input value={form.name} onChange={set("name")} required placeholder="e.g. Case D — Industrial Vision" className={inputCls} />)}
          {field("Activity *", <input value={form.activity} onChange={set("activity")} required placeholder="What the venture does" className={inputCls} />)}
          {field("Source / Provenance *", <input value={form.source_type} onChange={set("source_type")} required placeholder="e.g. Imported from tracker or Manual entry" className={inputCls} />, "Preserved alongside Unknown fields.")}
          {field("Tracker sector (legacy label)", <input value={form.tracker_sector} onChange={set("tracker_sector")} placeholder="Leave blank → Unknown" className={inputCls} />)}
          {field("Model resolution", (
            <select value={form.model_resolution_status} onChange={set("model_resolution_status")} className={inputCls}>
              <option value="UNRESOLVED">UNRESOLVED (Owner clarification required)</option>
              <option value="CONFIRMED">CONFIRMED</option>
            </select>
          ))}
          {field("Governing business model", (
            <select
              value={form.model_resolution_status === "UNRESOLVED" ? "" : form.primary_business_model}
              onChange={set("primary_business_model")}
              disabled={form.model_resolution_status === "UNRESOLVED"}
              className={`${inputCls} disabled:bg-slate-100 disabled:text-muted`}
            >
              {MODELS.map((m) => (
                <option key={m} value={m}>
                  {m || (form.model_resolution_status === "UNRESOLVED" ? "— Unresolved (locked until CONFIRMED) —" : "— Select confirmed model —")}
                </option>
              ))}
            </select>
          ), "Criteria attach to models, never to tracker sectors.")}
          {field("Programme level", (
            <select value={form.programme_level} onChange={set("programme_level")} className={inputCls}>
              {LEVELS.map((l) => <option key={l} value={l}>{l || "— Unknown —"}</option>)}
            </select>
          ))}
          {field("Development stage", <input value={form.development_stage} onChange={set("development_stage")} placeholder="Leave blank → Unknown" className={inputCls} />)}
          {field("Fundraising preference", <input value={form.fundraising_preference} onChange={set("fundraising_preference")} placeholder="Leave blank → Unknown" className={inputCls} />, "Never affects MSL eligibility.")}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-nav">Business lines</p>
          <div className="flex flex-col gap-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_10rem_12rem_auto]">
                <input value={l.line_name} onChange={(e) => setLines((p) => p.map((x, j) => j === i ? { ...x, line_name: e.target.value } : x))} placeholder="Line name (e.g. AI B2C Assigned)" aria-label={`Business line ${i + 1} name`} className={inputCls} />
                <select value={l.model} onChange={(e) => setLines((p) => p.map((x, j) => j === i ? { ...x, model: e.target.value } : x))} aria-label={`Business line ${i + 1} model`} className={inputCls}>
                  {MODELS.map((m) => <option key={m} value={m}>{m || "— model —"}</option>)}
                </select>
                <select value={l.track_role} onChange={(e) => setLines((p) => p.map((x, j) => j === i ? { ...x, track_role: e.target.value } : x))} aria-label={`Business line ${i + 1} role`} className={inputCls}>
                  {allowedRoles.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <button type="button" onClick={() => setLines((p) => p.filter((_, j) => j !== i))} aria-label={`Remove line ${i + 1}`} className="rounded-lg p-2 text-muted hover:bg-slate-100">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <Button type="button" onClick={() => setLines((p) => [...p, { line_name: "", model: "", track_role: form.model_resolution_status === "CONFIRMED" && p.length === 0 ? "ACTIVE_GOVERNING" : "ASSIGNED_IN_TRACKER" }])} className="mt-2">
            <Plus size={15} aria-hidden /> Add line
          </Button>
        </div>

        {error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving}>{saving ? "Importing…" : "Import Venture"}</Button>
        </div>
      </form>
    </Modal>
  );
}
