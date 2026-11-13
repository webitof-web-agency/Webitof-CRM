// Leave accrual eligibility (45 days after joining) and the 2026-2030 holiday seed. No database.
const test = require('node:test');
const assert = require('node:assert/strict');
const { accrualEntitlement } = require('../services/hrm/automation');
const { holidayRows, YEARS } = require('../database/seed-hrm-holidays-leave');

const PAID = { paid: true, accrual: 'monthly', annualDays: 12, eligibleAfterDays: 45, autoCredit: true };
const joinedNov2 = { joiningDate: '2026-11-02' };

test('nothing is credited before 45 days of service', () => {
  assert.equal(accrualEntitlement(PAID, joinedNov2, '2026-11-13'), 0);
  assert.equal(accrualEntitlement(PAID, joinedNov2, '2026-12-16'), 0); // day 44
});

test('one leave from the month the 45 days complete, then one more each month', () => {
  assert.equal(accrualEntitlement(PAID, joinedNov2, '2026-12-17'), 1); // eligible 17 Dec
  assert.equal(accrualEntitlement(PAID, joinedNov2, '2026-12-31'), 1);
  assert.equal(accrualEntitlement(PAID, joinedNov2, '2027-01-01'), 1); // new year starts at January
  assert.equal(accrualEntitlement(PAID, joinedNov2, '2027-06-15'), 6);
  assert.equal(accrualEntitlement(PAID, joinedNov2, '2027-12-01'), 12);
});

test('a long-serving employee earns from January each year', () => {
  assert.equal(accrualEntitlement(PAID, { joiningDate: '2020-05-10' }, '2027-03-01'), 3);
});

test('HR-granted, unpaid and zero-day types are never auto-credited', () => {
  assert.equal(accrualEntitlement({ ...PAID, autoCredit: false }, joinedNov2, '2027-06-01'), 0);
  assert.equal(accrualEntitlement({ ...PAID, paid: false }, joinedNov2, '2027-06-01'), 0);
  assert.equal(accrualEntitlement({ ...PAID, annualDays: 0 }, joinedNov2, '2027-06-01'), 0);
});

test('without a waiting period the old behaviour is unchanged', () => {
  const policy = { paid: true, accrual: 'monthly', annualDays: 12 };
  assert.equal(accrualEntitlement(policy, joinedNov2, '2026-11-13'), 1);
  assert.equal(accrualEntitlement({ paid: true, accrual: 'yearly', annualDays: 12 }, { joiningDate: '2026-07-01' }, '2026-07-02'), 6);
});

test('holiday seed: 11 fixed + 6 optional per year, real dates, no clashes', () => {
  const rows = holidayRows();
  assert.equal(rows.length, YEARS.length * 17);
  for (const year of YEARS) {
    const ofYear = rows.filter((r) => r.workDate.startsWith(`${year}-`));
    assert.equal(ofYear.filter((r) => !r.optional).length, 11, `${year} fixed`);
    assert.equal(ofYear.filter((r) => r.optional).length, 6, `${year} optional`);
    const dates = ofYear.map((r) => r.workDate);
    assert.equal(new Set(dates).size, dates.length, `${year} has two holidays on one date`);
  }
  for (const r of rows) {
    const d = new Date(`${r.workDate}T00:00:00Z`);
    assert.equal(d.toISOString().slice(0, 10), r.workDate, `invalid calendar date ${r.workDate}`);
  }
  assert.equal(new Set(rows.map((r) => r.id)).size, rows.length);
  // Diwali before Govardhan Puja before Bhai Dooj, every year.
  for (const year of YEARS) {
    const at = (name) => rows.find((r) => r.name === name && r.workDate.startsWith(`${year}-`)).workDate;
    assert.ok(at('Diwali') < at('Govardhan Puja') && at('Govardhan Puja') < at('Bhai Dooj'), `${year} Diwali order`);
  }
});
