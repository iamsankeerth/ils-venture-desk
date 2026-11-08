export function formatINRPaise(value) {
  if (value == null) return "Unknown";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function parseJSON(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function formatDateTime(value) {
  if (!value || value === "Unknown") return "Unknown";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function shortId(value, n = 8) {
  if (!value) return "—";
  return String(value).length > n + 3 ? `${String(value).slice(0, n)}…` : String(value);
}
