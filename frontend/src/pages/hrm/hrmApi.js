import { request } from "../../api/client";
export function hrm(token, path, options = {}) {
  return request(`/hrm${path}`, { token, skipCache: true, ...options }).then(
    (r) => r.data,
  );
}
export async function downloadHrm(token, path, name) {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL || "/api"}/hrm${path}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Download failed");
  }
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
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
