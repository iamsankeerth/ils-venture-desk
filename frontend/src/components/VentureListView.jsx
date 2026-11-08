import { useMemo, useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import Button from "./ui/Button.jsx";
import { EmptyState } from "./ui/EmptyState.jsx";
import SectionHeader from "./ui/SectionHeader.jsx";
import StatusBadge, { ProvenanceLabel } from "./ui/StatusBadge.jsx";

function attentionFor(norm, venture) {
  const flags = [];
  const unrev = (norm.staffQueue.unreviewed_evidence ?? []).filter((e) => e.venture_id === venture.id).length;
  if (unrev > 0) flags.push(`Evidence ×${unrev}`);
  if (venture.model_resolution_status !== "CONFIRMED") flags.push("Model");
  if ((norm.staffQueue.mentor_followups ?? []).some((f) => f.venture_id === venture.id)) flags.push("Follow-up");
  return flags.length ? flags.join(" + ") : "—";
}

export default function VentureListView({ norm, search, onOpen, onImport, canImport }) {
  const [level, setLevel] = useState("all");
  const [model, setModel] = useState("all");
  const [review, setReview] = useState("all");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return norm.ventures.filter((v) => {
      if (q && !`${v.name ?? ""} ${v.id} ${v.activity ?? ""}`.toLowerCase().includes(q)) return false;
      if (level !== "all" && v.programme_level !== level) return false;
      if (model !== "all" && v.primary_business_model !== model) return false;
      if (review === "attention" && attentionFor(norm, v) === "—") return false;
      if (review === "unreviewed" && !(norm.staffQueue.unreviewed_evidence ?? []).some((e) => e.venture_id === v.id)) return false;
      return true;
    });
  }, [norm, search, level, model, review]);

  const levels = [...new Set(norm.ventures.map((v) => v.programme_level))];
  const models = [...new Set(norm.ventures.map((v) => v.primary_business_model).filter(Boolean))];

  const selectCls = "rounded-lg border border-border-ui bg-white px-2 py-1.5 text-sm text-nav";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-nav">Ventures</h1>
          <p className="mt-1 text-sm text-muted">Seeded cases plus any imported venture records.</p>
        </div>
        {canImport ? <Button variant="primary" onClick={onImport}><Plus size={16} aria-hidden /> Add Venture</Button> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Venture filters">
        <label className="text-sm text-muted">Level
          <select value={level} onChange={(e) => setLevel(e.target.value)} className={`${selectCls} ml-1.5`} aria-label="Filter by programme level">
            <option value="all">All</option>
            {levels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="text-sm text-muted">Model
          <select value={model} onChange={(e) => setModel(e.target.value)} className={`${selectCls} ml-1.5`} aria-label="Filter by business model">
            <option value="all">All</option>
            {models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className="text-sm text-muted">Review
          <select value={review} onChange={(e) => setReview(e.target.value)} className={`${selectCls} ml-1.5`} aria-label="Filter by review status">
            <option value="all">All</option>
            <option value="unreviewed">Has unreviewed</option>
            <option value="attention">Needs attention</option>
          </select>
        </label>
      </div>

      <section className="overflow-x-auto rounded-xl border border-border-ui bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-border-ui text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-semibold">Venture</th>
              <th className="px-4 py-3 font-semibold">Programme level</th>
              <th className="px-4 py-3 font-semibold">Business model</th>
              <th className="px-4 py-3 font-semibold">MSL status</th>
              <th className="px-4 py-3 font-semibold">Attention</th>
              <th className="px-4 py-3 font-semibold"><span className="sr-only">Action</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-ui">
            {rows.map((v) => (
              <tr key={v.id} className="h-12 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <p className="font-medium text-nav">{v.name}</p>
                  <p className="font-mono text-xs text-muted">{v.id}</p>
                </td>
                <td className="px-4 py-2 text-nav">{v.programme_level}</td>
                <td className="px-4 py-2">
                  {v.model_resolution_status === "CONFIRMED" ? (
                    <span className="mr-1.5 font-medium text-nav">{v.primary_business_model}</span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge status="UNRESOLVED" title="Owner clarification required" />
                      <span className="text-xs text-muted">Owner clarification required</span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-2">
                  <span className="mr-1.5 text-nav">{v.msl_eligibility}</span>
                  <ProvenanceLabel text={v.msl_eligibility_provenance} />
                </td>
                <td className="px-4 py-2 text-muted">{attentionFor(norm, v)}</td>
                <td className="px-4 py-2 text-right">
                  <Button onClick={() => onOpen(v.id)}>View <ArrowRight size={15} aria-hidden /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <div className="px-4 py-4"><EmptyState title="No ventures match" hint="Clear search or filters to see all records." /></div>
        ) : null}
      </section>

      <SectionHeader title="Programme catalogue" subtitle={`${norm.catalog.length} criteria across five gates (reference, programme-wide).`} />
      <section className="overflow-x-auto rounded-xl border border-border-ui bg-white">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead>
            <tr className="border-b border-border-ui text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-semibold">Criterion</th>
              <th className="px-4 py-3 font-semibold">Gate</th>
              <th className="px-4 py-3 font-semibold">Scope</th>
              <th className="px-4 py-3 font-semibold">Definition</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-ui">
            {norm.catalog.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-nav">{c.id}</td>
                <td className="whitespace-nowrap px-4 py-2 text-xs text-muted">{c.transition_gate}</td>
                <td className="whitespace-nowrap px-4 py-2 text-xs text-muted">{c.criterion_scope} · {c.business_model}</td>
                <td className="px-4 py-2 text-nav">{c.threshold_description ?? c.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
