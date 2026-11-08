import { statusMeta } from "../../utils/status.js";

export default function StatusBadge({ status, title }) {
  const meta = statusMeta(status);
  return (
    <span
      title={title ?? meta.label}
      className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${meta.classes}`}
    >
      {meta.label}
    </span>
  );
}

export function ProvenanceLabel({ text }) {
  if (!text) return null;
  return (
    <span
      title={`Provenance: ${text}`}
      className="inline-flex max-w-full shrink-0 items-center truncate rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 ring-1 ring-inset ring-slate-500/20"
    >
      {text}
    </span>
  );
}
