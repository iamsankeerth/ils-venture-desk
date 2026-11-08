import { parseJSON } from "../utils/format.js";

export function modelsForLine(line) {
  if (line?.approved_model) return [line.approved_model];
  const cand = parseJSON(line?.candidate_models_json, []);
  return Array.isArray(cand) ? cand : [];
}

export default function BusinessLineTabs({ lines, selectedId, onSelect }) {
  if (!lines?.length) return null;
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Business lines">
      {lines.map((l) => {
        const active = l.id === selectedId;
        return (
          <button
            key={l.id}
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(l.id)}
            className={`rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-inset transition-colors duration-150 ${
              active
                ? "bg-nav text-white ring-nav"
                : "bg-white text-nav ring-border-ui hover:bg-slate-50"
            }`}
          >
            {l.line_name}
            {l.track_role && l.track_role !== "ACTIVE_GOVERNING" ? (
              <span className={`ml-1.5 rounded px-1.5 py-0.5 font-mono text-[11px] ${active ? "bg-white/15 text-white" : "bg-slate-100 text-muted"}`}>
                {l.track_role}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
