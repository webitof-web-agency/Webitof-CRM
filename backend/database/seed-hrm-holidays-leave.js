// Webitof HR calendar 2026-2030 and the leave policy (decided 2026-11-13):
//
// Holidays: the usual Indian IT-company list for Raipur. 11 fixed holidays a year (office closed)
// and 6 optional / restricted holidays (an employee may take one; attendance treats them as normal
// working days). Festival dates come from timeanddate.com/holidays/india/<year>, cross-checked with
// calendarlabs.com and drikpanchang.com where those list them. Eid-ul-Fitr is tentative (moon
// sighting). Govardhan Puja 2028-2030 is the day after Diwali (the sites list only Bhai Dooj);
// 2026 uses Drik Panchang's 10 Nov. Dussehra 2027 is listed 9 Oct by timeanddate and 10 Oct by
// calendarlabs: confirm with the office calendar before October 2027.
//
// Leave: one paid leave a month for every employee, credited once they complete 45 days, unused
// leave carried into the next year up to 12 days. "Casual Leave" becomes "Paid Leave" with that
// policy. Sick and Earned leave are switched off; maternity, paternity, bereavement, comp-off and
// leave without pay stay available but are granted by HR, never credited automatically.
//
// Safe to re-run: a holiday is added only when that date has no holiday of the same name.
// Usage: node database/seed-hrm-holidays-leave.js --yes   (writes to the database in DATABASE_URL)
const { withTransaction, closePool } = require('../config/db');

const FIXED = 'fixed';
const OPTIONAL = 'optional';

// [name, kind, { year: 'MM-DD' }]; fixed-date holidays use one MM-DD for every year.
const HOLIDAYS = [
  ["New Year's Day", FIXED, '01-01'],
  ['Republic Day', FIXED, '01-26'],
  ['Holi', FIXED, { 2026: '03-04', 2027: '03-22', 2028: '03-11', 2029: '03-01', 2030: '03-20' }],
  ['Independence Day', FIXED, '08-15'],
  ['Raksha Bandhan', FIXED, { 2026: '08-28', 2027: '08-17', 2028: '08-05', 2029: '08-23', 2030: '08-13' }],
  ['Janmashtami', FIXED, { 2026: '09-04', 2027: '08-25', 2028: '08-13', 2029: '09-01', 2030: '08-21' }],
  ['Gandhi Jayanti', FIXED, '10-02'],
  ['Dussehra', FIXED, { 2026: '10-20', 2027: '10-09', 2028: '09-27', 2029: '10-16', 2030: '10-06' }],
  ['Diwali', FIXED, { 2026: '11-08', 2027: '10-29', 2028: '10-17', 2029: '11-05', 2030: '10-26' }],
  ['Govardhan Puja', FIXED, { 2026: '11-10', 2027: '10-30', 2028: '10-18', 2029: '11-06', 2030: '10-27' }],
  ['Christmas', FIXED, '12-25'],
  ['Makar Sankranti', OPTIONAL, { 2026: '01-14', 2027: '01-14', 2028: '01-15', 2029: '01-14', 2030: '01-14' }],
  ['Good Friday', OPTIONAL, { 2026: '04-03', 2027: '03-26', 2028: '04-14', 2029: '03-30', 2030: '04-19' }],
  ['Eid-ul-Fitr (tentative)', OPTIONAL, { 2026: '03-21', 2027: '03-10', 2028: '02-27', 2029: '02-15', 2030: '02-05' }],
  ['Ganesh Chaturthi', OPTIONAL, { 2026: '09-14', 2027: '09-04', 2028: '08-23', 2029: '09-11', 2030: '09-01' }],
  ['Chhattisgarh Rajyotsava', OPTIONAL, '11-01'],
  ['Bhai Dooj', OPTIONAL, { 2026: '11-11', 2027: '10-31', 2028: '10-19', 2029: '11-07', 2030: '10-28' }]
];
const YEARS = [2026, 2027, 2028, 2029, 2030];

const PAID_LEAVE_ID = 'hrm-it-leave-type-casual-leave';
const PAID_LEAVE = {
  name: 'Paid Leave',
  payload: {
    paid: true,
    accrual: 'monthly',
    annualDays: 12,
    eligibleAfterDays: 45,
    autoCredit: true,
    carryForward: true,
    carryForwardLimit: 12,
    halfDayAllowed: true,
    probationAllowed: true,
    sandwich: false,
    encashmentAllowed: false,
    employmentTypeIds: [],
    description: 'One paid leave credited every month after 45 days of joining; up to 12 unused days carry into next year.'
  }
};
const SWITCHED_OFF = ['hrm-it-leave-type-sick-leave', 'hrm-it-leave-type-earned-privilege-leave'];
const HR_GRANTED_ONLY = [
  'hrm-it-leave-type-maternity-leave',
  'hrm-it-leave-type-paternity-leave',
  'hrm-it-leave-type-bereavement-leave',
  'hrm-it-leave-type-compensatory-off',
  'hrm-it-leave-type-leave-without-pay'
];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function holidayRows() {
  const rows = [];
  for (const year of YEARS) {
    for (const [name, kind, when] of HOLIDAYS) {
      const md = typeof when === 'string' ? when : when[year];
      if (!md) throw new Error(`No ${year} date for ${name}`);
      const workDate = `${year}-${md}`;
      if (Number.isNaN(Date.parse(`${workDate}T00:00:00Z`))) throw new Error(`Bad date ${workDate} for ${name}`);
      rows.push({ id: `hrm-holiday-${workDate}-${slug(name)}`, name, workDate, optional: kind === OPTIONAL });
    }
  }
  return rows;
}

async function seed(db) {
  const counts = { holidaysAdded: 0, holidaysSkipped: 0, leaveTypesUpdated: 0 };
  for (const h of holidayRows()) {
    const exists = await db.query(
      'select 1 from hrm_holidays where id = $1 or (work_date = $2 and lower(name) = lower($3))',
      [h.id, h.workDate, h.name]
    );
    if (exists.rowCount) {
      counts.holidaysSkipped += 1;
      continue;
    }
    await db.query(
      'insert into hrm_holidays (id, name, work_date, location_id, optional) values ($1, $2, $3, null, $4)',
      [h.id, h.name, h.workDate, h.optional]
    );
    counts.holidaysAdded += 1;
  }

  const paid = await db.query(
    `update master_items set name = $2, payload = payload || $3::jsonb, is_active = true, updated_at = now()
      where id = $1 and type = 'hrm_leave_type'`,
    [PAID_LEAVE_ID, PAID_LEAVE.name, JSON.stringify(PAID_LEAVE.payload)]
  );
  if (!paid.rowCount) throw new Error(`Leave type ${PAID_LEAVE_ID} not found`);
  counts.leaveTypesUpdated += paid.rowCount;
  const off = await db.query(
    `update master_items set is_active = false, payload = payload || '{"autoCredit": false}'::jsonb, updated_at = now()
      where type = 'hrm_leave_type' and id = any($1::text[])`,
    [SWITCHED_OFF]
  );
  counts.leaveTypesUpdated += off.rowCount;
  const manual = await db.query(
    `update master_items set payload = payload || '{"autoCredit": false}'::jsonb, updated_at = now()
      where type = 'hrm_leave_type' and id = any($1::text[])`,
    [HR_GRANTED_ONLY]
  );
  counts.leaveTypesUpdated += manual.rowCount;
  return counts;
}

if (require.main === module) {
  if (!process.argv.includes('--yes')) {
    console.error('Adds holidays 2026-2030 and sets the leave policy in the database in DATABASE_URL. Re-run with --yes to continue.');
    process.exit(1);
  }
  const target = (() => {
    try {
      const u = new URL(String(process.env.DATABASE_URL || require('dotenv').config().parsed?.DATABASE_URL || '').replace(/^"|"$/g, ''));
      return `${u.hostname}:${u.port || 5432}/${u.pathname.slice(1)}`;
    } catch {
      return 'DATABASE_URL';
    }
  })();
  withTransaction(seed)
    .then((counts) => {
      console.log(`HR calendar and leave policy written to ${target}:`);
      for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(20)} ${v}`);
    })
    .catch((e) => {
      console.error('Seeding failed, nothing was changed:', e.message);
      process.exitCode = 1;
    })
    .finally(closePool);
}

module.exports = { seed, holidayRows, HOLIDAYS, YEARS };
