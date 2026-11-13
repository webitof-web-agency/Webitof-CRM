// Day codes and totals of the attendance calendar / chart. No database.
const test = require('node:test');
const assert = require('node:assert/strict');
const { dayCell, totals, monthRange, employeeIdList } = require('../services/hrm/attendanceMonth');

const TODAY = '2026-11-13';
const working = (date) => ({ date, kind: 'Working', hours: 8 });
const att = (extra = {}) => ({ status: 'Present', checkIn: '2026-11-10T04:30:00Z', checkOut: '2026-11-10T13:30:00Z', workedMinutes: 480, ...extra });

test('codes for the usual days', () => {
  assert.equal(dayCell(working('2026-11-10'), att(), [], TODAY).code, 'P');
  assert.equal(dayCell(working('2026-11-10'), att({ status: 'WFH' }), [], TODAY).code, 'P');
  assert.equal(dayCell(working('2026-11-10'), att({ status: 'Half Day' }), [], TODAY).code, 'HD');
  assert.equal(dayCell(working('2026-11-10'), att({ status: 'Absent', checkIn: null, checkOut: null }), [], TODAY).code, 'A');
  assert.equal(dayCell({ date: '2026-11-08', kind: 'Week off', hours: 0 }, null, [], TODAY).code, 'WO');
  assert.equal(dayCell({ date: '2026-11-10', kind: 'Holiday', hours: 0 }, null, [], TODAY).code, 'H');
});

test('working on a weekly off or holiday is SW', () => {
  assert.equal(dayCell({ date: '2026-11-08', kind: 'Week off', hours: 0 }, att(), [], TODAY).code, 'SW');
  assert.equal(dayCell({ date: '2026-11-10', kind: 'Holiday', hours: 0 }, att(), [], TODAY).code, 'SW');
});

test('nothing recorded: absent in the past, blank today and later', () => {
  const past = dayCell(working('2026-11-12'), null, [], TODAY);
  assert.equal(past.code, 'A');
  assert.equal(past.unmarked, true);
  assert.equal(dayCell(working('2026-11-13'), null, [], TODAY).code, null);
  assert.equal(dayCell(working('2026-11-20'), null, [], TODAY).code, null);
  assert.equal(dayCell({ date: '2026-11-01', kind: 'Outside employment', hours: 0 }, null, [], TODAY).code, null);
});

test('clocked in without clocking out: missing punch in the past, working today', () => {
  const mp = dayCell(working('2026-11-12'), att({ checkOut: null }), [], TODAY);
  assert.equal(mp.code, 'MP');
  assert.equal(mp.punchError, true);
  const now = dayCell(working('2026-11-13'), att({ checkOut: null }), [], TODAY);
  assert.equal(now.code, 'P');
  assert.equal(now.live, true);
});

test('leave: full day L, half day L½ or HD when the other half was worked', () => {
  const full = [{ startDate: '2026-11-12', endDate: '2026-11-12', details: { fraction: 1, paid: true } }];
  const half = [{ startDate: '2026-11-12', endDate: '2026-11-12', details: { fraction: 0.5, paid: true } }];
  assert.equal(dayCell(working('2026-11-12'), null, full, TODAY).code, 'L');
  assert.equal(dayCell(working('2026-11-12'), null, half, TODAY).code, 'L½');
  assert.equal(dayCell(working('2026-11-12'), att(), half, TODAY).code, 'HD');
});

test('flags: late, early checkout, after shift, auto clock-out as punch error', () => {
  const d = dayCell(working('2026-11-10'), att({ lateMinutes: 12, earlyMinutes: 30, overtimeMinutes: 45, autoCheckoutAt: '2026-11-10T18:29:00Z' }), [], TODAY);
  assert.deepEqual([d.late, d.early, d.afterShift, d.punchError], [true, true, true, true]);
  const clean = dayCell(working('2026-11-10'), att(), [], TODAY);
  assert.deepEqual([clean.late, clean.early, clean.afterShift, clean.punchError], [false, false, false, false]);
});

test('totals: present counts half days as half and off-day work as a day; leave leaves the denominator', () => {
  const days = [
    dayCell(working('2026-11-02'), att(), [], TODAY),
    dayCell(working('2026-11-03'), att({ status: 'Half Day' }), [], TODAY),
    dayCell(working('2026-11-04'), null, [], TODAY), // A (unmarked)
    dayCell(working('2026-11-05'), null, [{ startDate: '2026-11-05', endDate: '2026-11-05', details: { fraction: 1 } }], TODAY),
    dayCell({ date: '2026-11-08', kind: 'Week off', hours: 0 }, att(), [], TODAY), // SW
    dayCell({ date: '2026-11-10', kind: 'Holiday', hours: 0 }, null, [], TODAY),
    dayCell(working('2026-11-20'), null, [], TODAY), // future
  ];
  const t = totals(days, TODAY);
  assert.equal(t.present, 2.5);
  assert.equal(t.absent, 1);
  assert.equal(t.leave, 1);
  assert.equal(t.offDayWorked, 1);
  assert.equal(t.holidays, 1);
  assert.equal(t.workingDays, 3);
});

test('employee column filter: comma list, trimmed, unique, capped', () => {
  assert.deepEqual(employeeIdList('a, b,,a'), ['a', 'b']);
  assert.deepEqual(employeeIdList(['x', ' y ']), ['x', 'y']);
  assert.deepEqual(employeeIdList(undefined), []);
  assert.throws(() => employeeIdList(Array.from({ length: 501 }, (_, i) => `e${i}`)));
});

test('month must be YYYY-MM', () => {
  assert.deepEqual(monthRange('2026-02'), { start: '2026-02-01', end: '2026-02-28' });
  assert.deepEqual(monthRange('2028-02'), { start: '2028-02-01', end: '2028-02-29' });
  assert.throws(() => monthRange('2026-13'));
  assert.throws(() => monthRange('nov'));
});
