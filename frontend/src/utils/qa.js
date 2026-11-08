export function isQaOnly() {
  if (typeof window === "undefined") return false;
  if (window.__ILS_QA_ONLY__ === true) return true;
  try {
    return new URLSearchParams(window.location.search).get("qa") === "1";
  } catch {
    return false;
  }
}
