// Display helpers for the location-verified workday.
export function hm(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}
export function clock(iso, timezone = "Asia/Kolkata") {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  });
}
export const EVENT_LABELS = {
  clock_in: "Clocked in",
  job_start: "Job started",
  lunch_prompt: "Lunch reminder",
  lunch_start: "Lunch started",
  lunch_end: "Lunch ended",
  lunch_end_prompt: "Lunch-over reminder",
  slot_prompt: "Report reminder",
  slot_submitted: "Slot report submitted",
  slot_late: "Slot report late (idle counted)",
  slot_missed: "Slot report missed",
  exit: "Left work zone",
  return: "Back in work zone",
  offline: "App went offline",
  online: "App back online",
  job_end: "Job ended",
  clock_out: "Clocked out",
  auto_checkout: "Auto clock-out",
};
export const ALERT_LABELS = {
  geofence_breach: "Left zone",
  offline: "Offline",
  mock_location: "Fake GPS",
  client_visit: "Client visit",
  lunch_overrun: "Long lunch",
  absent: "Auto absent",
};
