import StatusBadge, { ProvenanceLabel } from "./ui/StatusBadge.jsx";

const DIMS = [
  ["Development stage", "development_stage", null],
  ["Programme level", "programme_level", "programme_level_provenance"],
  ["MSL eligibility", "msl_eligibility", "msl_eligibility_provenance"],
  ["Advancement", "advancement_status", null],
  ["Fundraising", "fundraising_preference", null],
  ["MSL handover", "msl_handover_status", null],
  ["MSL acceptance", "msl_acceptance_status", null],
];

export default function SevenStateCards({ venture }) {
  if (!venture) return null;
  const resolved = venture.model_resolution_status === "CONFIRMED";
  const modelDisplay = resolved ? (venture.primary_business_model ?? "Unknown") : "Unresolved";
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {DIMS.map(([label, key, provKey]) => (
        <div key={key} className="min-w-0 rounded-xl border border-border-ui bg-white px-3 py-2.5">
          <p className="text-xs text-muted">{label}</p>
          <p className="mt-0.5 break-words text-sm font-semibold text-nav">
            {venture[key] ?? "Unknown"}
          </p>
          {provKey && venture[provKey] ? (
            <div className="mt-1"><ProvenanceLabel text={venture[provKey]} /></div>
          ) : null}
        </div>
      ))}
      <div className="min-w-0 rounded-xl border border-border-ui bg-white px-3 py-2.5">
        <p className="text-xs text-muted">Governing business model</p>
        <p className="mt-0.5 break-words text-sm font-semibold text-nav">{modelDisplay}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {resolved ? (
            <span className="text-xs font-medium text-teal-800">Confirmed governing</span>
          ) : (
            <StatusBadge status="UNRESOLVED" title="Owner clarification required" />
          )}
          {!resolved ? (
            <span className="text-xs text-muted">Owner clarification required</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
