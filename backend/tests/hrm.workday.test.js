const test = require("node:test");
const assert = require("node:assert/strict");
const d = require("../services/hrm/daylogic");
const calc = require("../services/hrm/calculations");
const { DEFAULT_POLICY: p } = require("../config/hrm");
const at = (hhmm) => `2026-10-30T${hhmm}:00+05:30`;
const office = { id: "o", label: "HQ", latitude: 28.6139, longitude: 77.209, radiusMeters: 150 };
test("geofence: inside, outside, and GPS tolerance is capped by policy", () => {
  assert.equal(d.nearest({ latitude: 28.6141, longitude: 77.2092, accuracy: 10 }, [office], p).inside, true);
  const far = d.nearest({ latitude: 28.6185, longitude: 77.214, accuracy: 10 }, [office], p);
  assert.equal(far.inside, false);
  assert.ok(far.distance > 690 && far.distance < 725);
  // ~160 m away: allowed only through tolerance, which never exceeds 25 m.
  const edge = { latitude: 28.61534, longitude: 77.209, accuracy: 500 };
  assert.equal(d.nearest(edge, [office], p).inside, true);
  assert.equal(d.nearest({ ...edge, latitude: 28.6156 }, [office], p).inside, false);
});
test("slot is due after the interval of working time and lunch pauses it", () => {
  const att = { jobStartedAt: at("10:00"), lunchStartedAt: at("10:30"), lunchEndedAt: at("11:00") };
  const s = d.slotState(att, [], p, new Date(at("11:20")));
  assert.equal(s.workedMinutes, 50);
  assert.equal(new Date(s.dueAt).toISOString(), new Date(at("11:30")).toISOString());
  assert.equal(s.overdue, false);
  const late = d.slotState(att, [], p, new Date(at("11:55")));
  assert.equal(late.overdue, true);
  assert.equal(late.lateMinutes, 15);
  const next = d.slotState(att, [{ slotEnd: at("11:30") }], p, new Date(at("12:00")));
  assert.equal(next.workedMinutes, 30);
  assert.equal(new Date(next.dueAt).toISOString(), new Date(at("12:30")).toISOString());
});
test("slot clock stops while on lunch", () => {
  const att = { jobStartedAt: at("10:00"), lunchStartedAt: at("10:40") };
  const s = d.slotState(att, [], p, new Date(at("11:30")));
  assert.equal(s.onLunch, true);
  assert.equal(s.workedMinutes, 40);
  assert.equal(s.lateMinutes, 0);
});
test("day summary: work, lunch overrun, offline, idle, edits", () => {
  const att = {
    status: "Present",
    workMode: "WFO",
    checkIn: at("09:50"),
    jobStartedAt: at("10:00"),
    lunchStartedAt: at("13:15"),
    lunchEndedAt: at("14:15"),
    jobEndedAt: at("19:00"),
    checkOut: at("19:05"),
    offlineMinutes: 20,
    idleMinutes: 15,
    outsideMinutes: 5,
  };
  const entries = [
    { source: "slot", minutes: 60, editCount: 2 },
    { source: "slot", minutes: 420, editCount: 0 },
  ];
  const s = d.summarize(att, entries, [{ kind: "slot_missed" }, { kind: "exit" }], p, new Date(at("20:00")));
  assert.equal(s.workedMinutes, 480);
  assert.equal(s.lunchMinutes, 60);
  assert.equal(s.lunchOverrunMinutes, 15);
  assert.equal(s.onlineMinutes, 460);
  assert.equal(s.productiveMinutes, 465);
  assert.equal(s.slotsExpected, 8);
  assert.equal(s.slotsMissed, 1);
  assert.equal(s.edits, 2);
  assert.equal(s.breaches, 1);
});
test("attendance metrics count job time, not time before Start job", () => {
  const m = calc.attendanceMetrics(
    {
      workDate: "2026-10-30",
      workMode: "WFO",
      checkIn: at("09:40"),
      jobStartedAt: at("10:00"),
      jobEndedAt: at("18:30"),
      checkOut: at("18:35"),
      breakMinutes: 30,
    },
    { start: "10:00", end: "19:00", graceMinutes: 15, minimumHours: 8 },
    p,
  );
  assert.equal(m.workedMinutes, 480);
  assert.equal(m.lateMinutes, 0);
  const none = calc.attendanceMetrics(
    { workDate: "2026-10-30", workMode: "WFO", checkIn: at("10:00"), checkOut: at("11:00"), breakMinutes: 0 },
    {},
    p,
  );
  assert.equal(none.workedMinutes, 0);
});
test("lunch window and duplicate detection helpers", () => {
  assert.equal(d.inWindow(at("13:10"), "13:00", "14:30", p.timezone), true);
  assert.equal(d.inWindow(at("14:31"), "13:00", "14:30", p.timezone), false);
  assert.equal(d.normalizeText("Fixed  the LOGIN bug!!"), d.normalizeText("fixed the login bug"));
});
