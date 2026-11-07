import { API_BASE_URL, request } from "../../api/client";
export function hrm(token, path, options = {}) {
  return request(`/hrm${path}`, { token, skipCache: true, ...options }).then(
    (r) => r.data,
  );
}
export async function downloadHrm(token, path, name) {
  const response = await fetch(
    `${API_BASE_URL}/hrm${path}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    // Error bodies are not always JSON (a proxy 502, for example).
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Download failed (${response.status})`);
  }
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function queryString(values) {
  return new URLSearchParams(
    Object.entries(values).filter(([, v]) => v !== "" && v != null),
  ).toString();
}
export function localDay(timezone = "Asia/Kolkata") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export const label = (key) =>
  key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (s) => s.toUpperCase());
