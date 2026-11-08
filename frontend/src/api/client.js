const API_BASE = "/api";

function extractMessage(result, fallback) {
  const d = result?.detail;
  if (typeof d === "string" && d) return d;
  if (d && typeof d === "object" && typeof d.error === "string") return d.error;
  if (typeof result?.message === "string") return result.message;
  return fallback;
}

function extractBlockers(result) {
  return (
    result?.detail?.blocking_reasons ??
    result?.blocking_reasons ??
    result?.blockingReasons ??
    []
  );
}

export async function apiRequest(path, { method = "GET", body, role = "PROGRAMME_REVIEWER" } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-ILS-Role": role,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    const status = response.status;
    const error = new Error(
      status === 403
        ? "Action unavailable for the selected demonstration role."
        : status === 400
          ? extractMessage(result, "Request rejected by programme rules.")
          : status === 422
            ? extractMessage(result, "Some fields are invalid or missing.")
            : extractMessage(result, "Request failed.")
    );
    error.status = status;
    error.blockingReasons = extractBlockers(result);
    throw error;
  }

  return result;
}

export async function downloadExport(role = "PROGRAMME_REVIEWER") {
  const response = await fetch(`${API_BASE}/export`, {
    headers: { "X-ILS-Role": role },
  });
  if (!response.ok) throw new Error("Export failed.");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ils-export.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
