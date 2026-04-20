const DEFAULT_API_BASE_URL = "http://localhost:8000";

function resolveConfiguredBase() {
  if (
    typeof window !== "undefined" &&
    window.HAGBAD_CONFIG &&
    typeof window.HAGBAD_CONFIG.apiBaseUrl === "string" &&
    window.HAGBAD_CONFIG.apiBaseUrl.trim()
  ) {
    return window.HAGBAD_CONFIG.apiBaseUrl.trim();
  }

  const envBase = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
  return envBase || DEFAULT_API_BASE_URL;
}

const configuredBase = resolveConfiguredBase();

export const API_BASE_URL = configuredBase;
export const API_BASE_LABEL = configuredBase || "same-origin";

export function buildApiUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;

  const suffix = String(path).startsWith("/") ? path : `/${path}`;
  if (!configuredBase) return suffix;

  return `${configuredBase.replace(/\/+$/, "")}${suffix}`;
}
