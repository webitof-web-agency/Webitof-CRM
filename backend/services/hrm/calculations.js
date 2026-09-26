const c = require("./core");
const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const rate = (a, b) => (b > 0 ? round((a / b) * 100) : null);
function effective(history, date) {
  return (
    history
      .filter((h) => h.effectiveDate <= date)
      .sort(
        (a, b) =>
          b.effectiveDate.localeCompare(a.effectiveDate) ||
          String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
      )[0] || null
  );
}
function schedule(employee, date, policy, masters = [], history = []) {
  const snap = effective(history, date)?.snapshot || employee;
  const shift =
    masters.find((m) => m.id === (snap.shiftId || policy.defaultShiftId))
      ?.payload || {};
  return {
    ...policy,
    ...shift,
    weeklyOffs: shift.weeklyOffs || policy.weeklyOffs,
    standardDailyHours: shift.minimumHours ?? policy.standardDailyHours,
    locationId: snap.locationId,
  };
}
function calendar(
  employee,
  start,
  end,
  policy,
  { holidays = [], leave = [], masters = [], history = [] } = {},
) {
  return c.days(start, end).map((date) => {
    const s = schedule(employee, date, policy, masters, history);
    let hours = Number(s.standardDailyHours);
    let kind = "Working";
    if (
      date < employee.joiningDate ||
      (employee.exitDate && date > employee.exitDate)
    ) {
      hours = 0;
      kind = "Outside employment";
    } else if (
      s.weeklyOffs.includes(new Date(`${date}T00:00:00Z`).getUTCDay())
    ) {
      hours = 0;
      kind = "Week off";
    } else if (
      holidays.some(
        (h) =>
          h.workDate === date &&
          !h.optional &&
          (!h.locationId || h.locationId === s.locationId),
      )
    ) {
      hours = 0;
      kind = "Holiday";
    } else {
      const fraction = Math.min(
        1,
        leave
          .filter(
            (l) =>
              l.startDate <= date &&
              l.endDate >= date &&
              l.status === "Approved",
          )
          .reduce((sum, l) => sum + Number(l.details.fraction || 1), 0),
      );
      hours *= 1 - fraction;
      if (fraction) kind = fraction === 1 ? "Leave" : "Half day leave";
    }
    return { date, hours: round(hours), kind };
  });
}
function utilization(hours, available, p) {
  const percent = rate(hours, available);
  return {
    percent,
    context:
      percent == null
        ? "No available capacity"
        : percent > p.overloadUtilization
          ? "Overloaded"
          : percent >= p.highUtilization
            ? "Highly utilized"
            : percent < p.underUtilization
              ? "Under-utilized"
              : "Normal",
  };
}
function timeParts(instant, timezone) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return Object.fromEntries(
    f.formatToParts(new Date(instant)).map((p) => [p.type, p.value]),
  );
}
function localInstant(date, time, timezone) {
  const target = Date.parse(`${date}T${time}:00Z`);
  let guess = target;
  for (let i = 0; i < 4; i++) {
    const p = timeParts(guess, timezone);
    const local = Date.parse(
      `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`,
    );
    guess += target - local;
  }
  return guess;
}
function attendanceMetrics(row, shift, policy) {
  if (!row.checkOut)
    return {
      workedMinutes: 0,
      lateMinutes: 0,
      earlyMinutes: 0,
      overtimeMinutes: 0,
    };
  const worked =
    Math.floor((Date.parse(row.checkOut) - Date.parse(row.checkIn)) / 60000) -
    Number(row.breakMinutes || 0);
  if (worked < 0) c.fail("Break duration exceeds attendance duration");
  const start = localInstant(
    row.workDate,
    shift.start || policy.shiftStart,
    policy.timezone,
  );
  let end = localInstant(
    row.workDate,
    shift.end || policy.shiftEnd,
    policy.timezone,
  );
  if (end <= start) end += 86400000;
  const late = Math.max(
    0,
    Math.floor((Date.parse(row.checkIn) - start) / 60000) -
      Number(shift.graceMinutes ?? policy.graceMinutes),
  );
  return {
    workedMinutes: worked,
    lateMinutes: late,
    earlyMinutes: Math.max(
      0,
      Math.floor((end - Date.parse(row.checkOut)) / 60000),
    ),
    overtimeMinutes: Math.max(
      0,
      worked - Number(shift.minimumHours ?? policy.standardDailyHours) * 60,
    ),
  };
}
module.exports = {
  round,
  rate,
  effective,
  schedule,
  calendar,
  utilization,
  timeParts,
  localInstant,
  attendanceMetrics,
};
