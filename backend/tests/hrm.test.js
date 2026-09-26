const test = require("node:test");
const assert = require("node:assert/strict");
const calc = require("../services/hrm/calculations");
const c = require("../services/hrm/core");
const { DEFAULT_POLICY: p } = require("../config/hrm");
test("capacity excludes leave, holidays, weekly offs and time outside employment", () => {
  const e = { joiningDate: "2026-08-04", exitDate: "2026-08-07" };
  const days = calc.calendar(e, "2026-08-03", "2026-08-09", p, {
    holidays: [{ workDate: "2026-08-05" }],
    leave: [
      {
        startDate: "2026-08-06",
        endDate: "2026-08-06",
        status: "Approved",
        details: { fraction: 0.5 },
      },
    ],
  });
  assert.deepEqual(
    days.map((d) => d.hours),
    [0, 8, 0, 4, 8, 0, 0],
  );
  assert.equal(calc.utilization(5, 0, p).percent, null);
});
test("effective history uses the salary at the work date", () => {
  const history = [
    { effectiveDate: "2026-01-01", monthlyCost: 30000 },
    { effectiveDate: "2026-04-01", monthlyCost: 40000 },
    { effectiveDate: "2026-10-01", monthlyCost: 50000 },
  ];
  assert.equal(calc.effective(history, "2026-02-10").monthlyCost, 30000);
  assert.equal(calc.effective(history, "2026-07-10").monthlyCost, 40000);
  assert.equal(calc.effective(history, "2025-12-31"), null);
});
test("overnight attendance and local dates do not depend on server timezone", () => {
  const start = calc.localInstant("2026-08-03", "22:00", "Asia/Kolkata");
  assert.equal(new Date(start).toISOString(), "2026-08-03T16:30:00.000Z");
  const m = calc.attendanceMetrics(
    {
      workDate: "2026-08-03",
      checkIn: "2026-08-03T16:30:00Z",
      checkOut: "2026-08-04T01:30:00Z",
      breakMinutes: 60,
    },
    { start: "22:00", end: "07:00" },
    p,
  );
  assert.equal(m.workedMinutes, 480);
  assert.equal(m.earlyMinutes, 0);
  assert.equal(m.lateMinutes, 0);
});
test("strict dates, pagination and input allowlists reject malformed data", () => {
  assert.throws(() => c.date("2026-02-30"));
  assert.throws(() =>
    c.range({ startDate: "2020-01-01", endDate: "2026-01-01" }, p),
  );
  assert.throws(() => c.page({ limit: "Infinity" }));
  assert.throws(() => c.allow({ salary: 100 }, ["name"]));
  assert.throws(() => c.boolean("false"));
});
test("scope is deny-by-default and never interpolates supplied identity", () => {
  const values = [];
  const s = c.scope(
    { id: "user'; DROP", permissions: ["hrm.view_own"] },
    values,
  );
  assert.equal(s, "(e.user_id=$1)");
  assert.deepEqual(values, ["user'; DROP"]);
  assert.equal(c.scope({ id: "x", permissions: [] }, []), "FALSE");
  assert.throws(() => c.permit({ permissions: [] }, "view_salary"));
});
