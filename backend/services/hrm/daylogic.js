// Pure workday calculations shared by the API, automation and tests.
// All instants are server-side Date/ISO values; device clocks are never trusted.
const calc = require("./calculations");
const MINUTE = 60000;
const ms = (v) => (v == null ? null : new Date(v).getTime());
function distanceMeters(a, b) {
  const rad = (d) => (Number(d) * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}
// Nearest fence and whether the point is inside it. GPS jitter is forgiven up
// to the reported accuracy, capped by policy, so a weak fix cannot widen a fence.
function nearest(point, fences, policy) {
  let best = null;
  for (const f of fences) {
    const distance = distanceMeters(point, f);
    if (!best || distance - f.radiusMeters < best.distance - best.fence.radiusMeters)
      best = { fence: f, distance };
  }
  if (!best) return null;
  const tolerance = Math.min(
    Number(policy.gpsToleranceMeters || 0),
    Number(point.accuracy || 0),
  );
  return { ...best, inside: best.distance <= best.fence.radiusMeters + tolerance };
}
function localMinutes(instant, timezone) {
  const p = calc.timeParts(instant, timezone);
  return Number(p.hour) * 60 + Number(p.minute);
}
const hhmm = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
function inWindow(instant, start, end, timezone) {
  const m = localMinutes(instant, timezone);
  return m >= hhmm(start) && m < hhmm(end);
}
// Lunch (one per day) overlapping [from, to], in milliseconds.
function lunchOverlap(att, from, to, now) {
  const ls = ms(att.lunchStartedAt);
  if (!ls) return 0;
  const le = ms(att.lunchEndedAt) || ms(now);
  return Math.max(0, Math.min(le, to) - Math.max(ls, from));
}
// Current reporting slot. A slot starts at job start or the previous slot's
// end and is due after `reportIntervalMinutes` of working time (lunch pauses it).
function slotState(att, entries, policy, now = new Date()) {
  if (!att?.jobStartedAt) return null;
  const n = ms(now);
  const slotEnds = entries.filter((x) => x.slotEnd).map((x) => ms(x.slotEnd));
  const start = Math.max(ms(att.jobStartedAt), ...slotEnds);
  const end = ms(att.jobEndedAt) || n;
  const interval = Number(policy.reportIntervalMinutes) * MINUTE;
  let due = start + interval;
  const ls = ms(att.lunchStartedAt);
  if (ls && ls < due) due += lunchOverlap(att, start, Infinity, now);
  const onLunch = Boolean(att.lunchStartedAt && !att.lunchEndedAt);
  const workedMs = Math.max(0, end - start - lunchOverlap(att, start, end, now));
  const graceEnd = due + Number(policy.slotGraceMinutes) * MINUTE;
  return {
    slotStart: new Date(start).toISOString(),
    dueAt: new Date(due).toISOString(),
    graceEndsAt: new Date(graceEnd).toISOString(),
    workedMinutes: Math.floor(workedMs / MINUTE),
    onLunch,
    overdue: !onLunch && !att.jobEndedAt && n > graceEnd,
    // Minutes between the end of the grace period and now count as idle.
    lateMinutes: onLunch ? 0 : Math.max(0, Math.floor((Math.min(n, end) - graceEnd) / MINUTE)),
  };
}
function workedMinutes(att, now = new Date()) {
  if (!att?.jobStartedAt) return 0;
  const start = ms(att.jobStartedAt);
  const end = ms(att.jobEndedAt) || ms(now);
  return Math.max(0, Math.floor((end - start - lunchOverlap(att, start, end, now)) / MINUTE));
}
function lunchMinutes(att, now = new Date()) {
  const ls = ms(att?.lunchStartedAt);
  if (!ls) return 0;
  return Math.floor(((ms(att.lunchEndedAt) || ms(now)) - ls) / MINUTE);
}
function summarize(att, entries = [], events = [], policy, now = new Date()) {
  if (!att) return null;
  const worked = workedMinutes(att, now);
  const lunch = lunchMinutes(att, now);
  let offline = Number(att.offlineMinutes || 0);
  const lastPing = ms(att.lastPingAt);
  // A silent device during an active job (not on lunch) is offline time.
  const live = att.checkIn && !att.checkOut && !att.jobEndedAt;
  if (
    live &&
    att.jobStartedAt &&
    !(att.lunchStartedAt && !att.lunchEndedAt) &&
    lastPing &&
    ms(now) - lastPing > Number(policy.offlineAfterMinutes) * MINUTE
  )
    offline += Math.floor((ms(now) - lastPing) / MINUTE);
  offline = Math.min(offline, worked);
  const slotEntries = entries.filter((x) => x.source === "slot");
  const reported = entries.reduce((s, x) => s + Number(x.minutes || 0), 0);
  const idle = Math.min(Number(att.idleMinutes || 0), worked);
  return {
    workMode: att.workMode,
    status: att.status,
    clockIn: att.checkIn,
    jobStart: att.jobStartedAt,
    jobEnd: att.jobEndedAt,
    clockOut: att.checkOut,
    workedMinutes: worked,
    productiveMinutes: Math.max(0, worked - idle),
    lunchMinutes: lunch,
    lunchOverrunMinutes: Math.max(0, lunch - Number(policy.lunchMaxMinutes)),
    lunchStart: att.lunchStartedAt,
    lunchEnd: att.lunchEndedAt,
    onlineMinutes: Math.max(0, worked - offline),
    offlineMinutes: offline,
    outsideMinutes: Number(att.outsideMinutes || 0),
    idleMinutes: idle,
    slotsSubmitted: slotEntries.length,
    slotsMissed: events.filter((e) => e.kind === "slot_missed").length,
    slotsExpected: Math.floor(worked / Number(policy.reportIntervalMinutes)),
    reportedMinutes: reported,
    entries: entries.length,
    edits: entries.reduce((s, x) => s + Number(x.editCount || 0), 0),
    breaches: events.filter((e) => e.kind === "exit").length,
  };
}
const normalizeText = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
module.exports = {
  distanceMeters,
  nearest,
  localMinutes,
  inWindow,
  lunchOverlap,
  slotState,
  workedMinutes,
  lunchMinutes,
  summarize,
  normalizeText,
  MINUTE,
};
