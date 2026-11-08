export function sourcePolicy(norm, sourceType) {
  const policy = norm?.evidenceTypePolicy ?? {};
  const wanted = String(sourceType ?? "").trim().toLowerCase();
  if (!wanted) return null;
  const key = Object.keys(policy).find((name) => name.toLowerCase() === wanted);
  return key ? policy[key] : null;
}

const UNIT_LABELS = {
  INR_PAISE: "INR_PAISE (paise)",
  COUNT: "COUNT",
  PERCENT: "PERCENT",
  QUALITATIVE: "QUALITATIVE",
};

export function unitLabel(unit) {
  if (!unit) return "None";
  return UNIT_LABELS[unit] ?? unit;
}
