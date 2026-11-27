// The deeper dashboard blocks: period ranges, sales insights (funnel, sources, lost reasons,
// response time, leads without a next step, targets), cash-flow forecast, GST due, top clients,
// project profitability, today's combined list and the business health score. Used by
// businessDashboard.service (the page) and dailyDigest.service (the morning email).
const { query } = require('../config/db');
const { getPaymentAppliedAmount, buildProfitLoss, filterStateByPeriod, getPayrollExpenseTotal } = require('./finance.service');
const { getSetting, setSetting } = require('../models/systemSetting.model');
const { round2, toNumber } = require('../utils/format');

const TIMEZONE = 'Asia/Kolkata';
const TARGETS_KEY = 'dashboard_sales_targets';
const day = (value) => String(value || '').slice(0, 10);
const sum = (items, pick) => round2(items.reduce((total, item) => total + toNumber(pick(item)), 0));

function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}
function shiftMonths(date, months) {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

// The selected period "to date", and the same span one period earlier (fair comparison).
const PERIODS = {
  today: 'Today',
  week: 'Last 7 days',
  month: 'This month',
  quarter: 'This quarter',
  fy: 'This financial year'
};
function periodRange(key, today) {
  const k = PERIODS[key] ? key : 'month';
  if (k === 'today') {
    const y = addDays(today, -1);
    return { key: k, label: PERIODS[k], compareLabel: 'yesterday', from: today, to: today, prevFrom: y, prevTo: y };
  }
  if (k === 'week') return { key: k, label: PERIODS[k], compareLabel: 'previous 7 days', from: addDays(today, -6), to: today, prevFrom: addDays(today, -13), prevTo: addDays(today, -7) };
  if (k === 'month') {
    const from = `${today.slice(0, 7)}-01`;
    return { key: k, label: PERIODS[k], compareLabel: 'same days last month', from, to: today, prevFrom: shiftMonths(from, -1), prevTo: shiftMonths(today, -1) };
  }
  const month = Number(today.slice(5, 7));
  const year = Number(today.slice(0, 4));
  if (k === 'quarter') {
    // Indian financial quarters: Apr–Jun, Jul–Sep, Oct–Dec, Jan–Mar.
    const startMonth = [1, 4, 7, 10].filter((m) => m <= month).pop();
    const from = `${year}-${String(startMonth).padStart(2, '0')}-01`;
    return { key: k, label: PERIODS[k], compareLabel: 'same days last quarter', from, to: today, prevFrom: shiftMonths(from, -3), prevTo: shiftMonths(today, -3) };
  }
  const fyStart = month >= 4 ? year : year - 1;
  const from = `${fyStart}-04-01`;
  return { key: k, label: PERIODS[k], compareLabel: 'same days last year', from, to: today, prevFrom: shiftMonths(from, -12), prevTo: shiftMonths(today, -12) };
}
const within = (value, from, to) => {
  const d = day(value);
  return Boolean(d) && d >= from && d <= to;
};
function change(current, previous) {
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

// Money for a period and the one before: billed, received, revenue / expense / profit, GST.
function periodMoney(state, snapshots, range) {
  const figures = (from, to) => {
    const pl = buildProfitLoss(filterStateByPeriod(state, { active: true, from, to }));
    const billed = snapshots.filter((item) => within(item.invoiceDate, from, to));
    const outputGst = round2(sum(billed, (item) => item.gstAmount) - sum((state.creditNotes || []).filter((note) => String(note.status || 'Issued') === 'Issued' && within(note.issueDate || note.createdAt, from, to)), (note) => note.gstAmount));
    return {
      invoiced: sum(billed, (item) => item.totalAmount),
      received: sum((state.payments || []).filter((payment) => within(payment.paymentDate || payment.createdAt, from, to)), getPaymentAppliedAmount),
      revenue: pl.revenue,
      expense: pl.expense,
      profit: pl.profit,
      outputGst,
      inputGst: round2(pl.totalInputGst)
    };
  };
  const current = figures(range.from, range.to);
  const previous = figures(range.prevFrom, range.prevTo);
  const changes = Object.fromEntries(Object.keys(current).map((key) => [key, change(current[key], previous[key])]));
  return { current, previous, change: changes };
}

// GSTR-3B for the current month is due on the 20th of the next month.
function gstDue(state, snapshots, today) {
  const from = `${today.slice(0, 7)}-01`;
  const { current } = periodMoney(state, snapshots, { from, to: today, prevFrom: from, prevTo: from });
  const dueDate = `${shiftMonths(from, 1).slice(0, 7)}-20`;
  return {
    month: new Date(`${from}T00:00:00Z`).toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    output: current.outputGst,
    input: current.inputGst,
    net: round2(current.outputGst - current.inputGst),
    dueDate,
    daysLeft: daysBetween(today, dueDate)
  };
}

// Money expected in and out over the next 30 and 60 days.
function cashFlow(state, snapshots, today) {
  const open = snapshots.filter((item) => item.balanceDue > 0);
  const overdue = sum(open.filter((item) => item.isOverdue), (item) => item.balanceDue);
  const activeAmc = (state.amcs || []).filter((item) => !['Cancelled', 'Expired', 'Completed'].includes(String(item.status || '').trim()));
  const unpaidExpenses = (state.expenses || []).filter((expense) => toNumber(expense.balanceDue) > 0 && !['Draft', 'Cancelled', 'Rejected'].includes(String(expense.status || '').trim()));
  const unpaidOutsourcing = (state.outsourcingExpenses || []).filter((item) => !['Paid', 'Cancelled'].includes(String(item.paymentStatus || '').trim()) && String(item.approvalStatus || '').trim() !== 'Rejected');
  // Payroll: last full month's payroll repeats each month.
  const lastMonthFrom = shiftMonths(`${today.slice(0, 7)}-01`, -1);
  const lastMonthTo = addDays(`${today.slice(0, 7)}-01`, -1);
  const monthlyPayroll = round2(getPayrollExpenseTotal(filterStateByPeriod(state, { active: true, from: lastMonthFrom, to: lastMonthTo })));
  const windowFor = (days) => {
    const end = addDays(today, days);
    const invoicesIn = sum(open.filter((item) => !item.isOverdue && day(item.dueDate) <= end), (item) => item.balanceDue);
    const amcIn = sum(activeAmc.filter((item) => day(item.nextInvoiceDate) && day(item.nextInvoiceDate) >= today && day(item.nextInvoiceDate) <= end), (item) => item.amcAmount);
    const expensesOut = sum(unpaidExpenses.filter((expense) => !expense.dueDate || day(expense.dueDate) <= end), (expense) => expense.balanceDue);
    const vendorsOut = sum(unpaidOutsourcing.filter((item) => !item.dueDate || day(item.dueDate) <= end), (item) => item.totalAmount);
    const payrollOut = round2(monthlyPayroll * (days / 30));
    const inflow = round2(invoicesIn + amcIn);
    const outflow = round2(expensesOut + vendorsOut + payrollOut);
    return { days, inflow, outflow, net: round2(inflow - outflow), parts: { invoicesIn, amcIn, expensesOut, vendorsOut, payrollOut } };
  };
  return { overdueIn: overdue, windows: [windowFor(30), windowFor(60)], monthlyPayroll };
}

function dueThisWeek(snapshots, today) {
  const end = addDays(today, 7);
  const rows = snapshots
    .filter((item) => item.balanceDue > 0 && !item.isOverdue && day(item.dueDate) && day(item.dueDate) <= end)
    .sort((a, b) => day(a.dueDate).localeCompare(day(b.dueDate)));
  return {
    total: sum(rows, (item) => item.balanceDue),
    count: rows.length,
    items: rows.slice(0, 6).map((item) => ({ id: item.id, number: item.invoiceNumber, client: item.clientName, dueDate: day(item.dueDate), amount: item.balanceDue }))
  };
}

// Biggest clients this financial year by billing, with what they paid and still owe.
function topClients(snapshots, today) {
  const { from } = periodRange('fy', today);
  const byClient = new Map();
  for (const item of snapshots.filter((s) => within(s.invoiceDate, from, today))) {
    const row = byClient.get(String(item.clientId)) || { clientId: item.clientId, name: item.clientName, billed: 0, paid: 0, due: 0 };
    row.billed = round2(row.billed + toNumber(item.totalAmount));
    row.paid = round2(row.paid + toNumber(item.amountPaid));
    row.due = round2(row.due + toNumber(item.balanceDue));
    byClient.set(String(item.clientId), row);
  }
  return [...byClient.values()].sort((a, b) => b.billed - a.billed).slice(0, 8);
}

// Value vs cost for active projects: linked expenses, vendor work and team time at salary cost.
async function projectProfit(state, settings, projectPhase) {
  const open = (state.projects || []).filter((project) => projectPhase(project.status, settings) !== 'cancelled');
  if (!open.length) return [];
  const { rows } = await query(
    `with cost as (
       select distinct on (employee_id) employee_id, monthly_cost from hrm_salary_history order by employee_id, effective_date desc
     )
     select we.project_id, sum(we.minutes)::numeric as minutes, sum(we.minutes / 60.0 * coalesce(c.monthly_cost, 0) / 176.0)::numeric as labour
       from hrm_work_entries we join hrm_work_reports wr on wr.id = we.report_id left join cost c on c.employee_id = wr.employee_id
      where we.project_id = any($1::text[]) group by we.project_id`,
    [open.map((project) => String(project.id))]
  ).catch(() => ({ rows: [] }));
  const labour = new Map(rows.map((row) => [row.project_id, row]));
  return open
    .map((project) => {
      const id = String(project.id);
      const expense = sum((state.expenses || []).filter((e) => String(e.projectId) === id && !['Draft', 'Cancelled', 'Rejected'].includes(String(e.status || '').trim())), (e) => e.totalAmount);
      const vendor = sum((state.outsourcingExpenses || []).filter((e) => String(e.projectId) === id), (e) => e.totalAmount);
      const team = round2(Number(labour.get(id)?.labour || 0));
      const value = toNumber(project.value);
      const cost = round2(expense + vendor + team);
      return {
        id: project.id,
        title: project.title,
        status: project.status,
        value,
        cost,
        hours: Math.round(Number(labour.get(id)?.minutes || 0) / 60),
        margin: value ? Math.round(((value - cost) / value) * 100) : null
      };
    })
    .filter((project) => project.value || project.cost)
    .sort((a, b) => (a.margin ?? 999) - (b.margin ?? 999))
    .slice(0, 6);
}

function leadStateLists(settings, PIPELINE_STATUSES) {
  const statuses = (settings?.statuses?.leads?.length ? settings.statuses.leads : PIPELINE_STATUSES.leads).filter((item) => item && typeof item === 'object');
  const of = (state) => statuses.filter((item) => String(item.state || '').toLowerCase() === state).map((item) => String(item.label));
  return { statuses, won: of('won').length ? of('won') : ['Won'], lost: [...of('lost'), 'Lost'] };
}

// Sales for the period: funnel, sources with what they won, lost reasons, response time,
// leads with no next step, and targets per person.
async function sales(settings, range, today, PIPELINE_STATUSES) {
  const { statuses, won, lost } = leadStateLists(settings, PIPELINE_STATUSES);
  const order = statuses.map((item) => String(item.label));
  const quoteIndex = Math.max(0, order.findIndex((label) => /quotation sent/i.test(label)));
  const firstStatus = order[0] || 'New';
  const createdLocal = `(l.created_at at time zone '${TIMEZONE}')::date`;
  const inPeriod = `${createdLocal} between $1::date and $2::date`;
  const [leadRows, lostRows, response, noNext] = await Promise.all([
    query(
      `select l.id, coalesce(nullif(l.status, ''), $3) as status, coalesce(nullif(l.source, ''), 'Unknown') as source,
              coalesce(l.value, l.estimated_budget, 0)::numeric as value, l.assigned_to,
              exists (select 1 from lead_events q where q.lead_id = l.id and lower(q.event_type) = 'quotation') as quoted
         from leads l where ${inPeriod}`,
      [range.from, range.to, firstStatus]
    ),
    query(
      `select coalesce(nullif(l.lost_reason, ''), 'Not given') as reason, count(*)::int as count
         from leads l where coalesce(l.status, '') = any($3::text[]) and (coalesce(l.lost_at, l.last_status_changed_at, l.updated_at) at time zone '${TIMEZONE}')::date between $1::date and $2::date
        group by 1 order by 2 desc limit 6`,
      [range.from, range.to, lost]
    ),
    // First contact: the earliest call, completed follow-up or logged meeting/call after the lead arrived.
    query(
      `with firsts as (
         select l.id, l.assigned_to, l.created_at,
                least(
                  (select min(c.started_at) from call_logs c where c.lead_id = l.id and c.started_at >= l.created_at),
                  (select min(f.completed_at) from follow_ups f where f.lead_id = l.id and f.deleted_at is null and f.completed_at is not null),
                  (select min(e.created_at) from lead_events e where e.lead_id = l.id and lower(e.event_type) not in ('system', 'reminder', 'quotation'))
                ) as first_contact
           from leads l where ${inPeriod}
       )
       select f.assigned_to, u.full_name, count(*)::int as leads,
              count(f.first_contact)::int as contacted,
              avg(extract(epoch from (f.first_contact - f.created_at)) / 3600.0) filter (where f.first_contact is not null)::numeric as avg_hours
         from firsts f left join users u on u.id = f.assigned_to group by 1, 2 order by 3 desc`,
      [range.from, range.to]
    ),
    query(
      `select l.id, l.name, l.company_name, l.status, u.full_name as owner, l.created_at
         from leads l left join users u on u.id = l.assigned_to
        where not (coalesce(l.status, '') = any($1::text[]))
          and coalesce(l.next_follow_up_time, '') = ''
          and not exists (select 1 from follow_ups f where f.lead_id = l.id and f.deleted_at is null and f.status not in ('Completed', 'Cancelled', 'Failed', 'Auto-Closed'))
        order by l.created_at desc`,
      [[...won, ...lost]]
    )
  ]);

  const leadsInPeriod = leadRows.rows;
  const isWon = (row) => won.includes(row.status);
  const isLost = (row) => lost.includes(row.status);
  const reached = (row, index) => !isLost(row) && (isWon(row) || order.indexOf(row.status) >= index);
  const funnel = [
    { stage: 'Leads', count: leadsInPeriod.length },
    { stage: 'Contacted', count: leadsInPeriod.filter((row) => isWon(row) || (row.status !== firstStatus && !isLost(row)) || (isLost(row) && row.quoted)).length },
    { stage: 'Quotation sent', count: leadsInPeriod.filter((row) => row.quoted || reached(row, quoteIndex)).length },
    { stage: 'Won', count: leadsInPeriod.filter(isWon).length }
  ].map((step, index, steps) => ({ ...step, rate: index ? (steps[index - 1].count ? Math.round((step.count / steps[index - 1].count) * 100) : 0) : 100 }));

  const bySource = new Map();
  for (const row of leadsInPeriod) {
    const entry = bySource.get(row.source) || { source: row.source, leads: 0, won: 0, wonValue: 0, lost: 0 };
    entry.leads += 1;
    if (isWon(row)) {
      entry.won += 1;
      entry.wonValue = round2(entry.wonValue + Number(row.value || 0));
    }
    if (isLost(row)) entry.lost += 1;
    bySource.set(row.source, entry);
  }
  const sources = [...bySource.values()]
    .map((entry) => ({ ...entry, conversion: entry.won + entry.lost ? Math.round((entry.won / (entry.won + entry.lost)) * 100) : null }))
    .sort((a, b) => b.wonValue - a.wonValue || b.leads - a.leads)
    .slice(0, 8);

  const responseRows = response.rows.filter((row) => row.assigned_to);
  const contacted = response.rows.reduce((total, row) => total + row.contacted, 0);
  const weightedHours = response.rows.reduce((total, row) => total + Number(row.avg_hours || 0) * row.contacted, 0);

  return {
    funnel,
    sources,
    lostReasons: lostRows.rows,
    response: {
      averageHours: contacted ? Math.round((weightedHours / contacted) * 10) / 10 : null,
      notContacted: response.rows.reduce((total, row) => total + (row.leads - row.contacted), 0),
      people: responseRows.map((row) => ({
        id: row.assigned_to,
        name: row.full_name || 'Unassigned',
        leads: row.leads,
        contacted: row.contacted,
        averageHours: row.avg_hours == null ? null : Math.round(Number(row.avg_hours) * 10) / 10
      }))
    },
    noNextStep: {
      count: noNext.rowCount,
      items: noNext.rows.slice(0, 6).map((row) => ({ id: row.id, name: row.name || row.company_name || 'Lead', status: row.status, owner: row.owner || '', createdAt: row.created_at }))
    }
  };
}

// Monthly sales targets (₹ of won leads) per person and for the company, set from the dashboard.
async function getTargets() {
  const stored = await getSetting(TARGETS_KEY, {});
  return { company: toNumber(stored.company), people: stored.people && typeof stored.people === 'object' ? stored.people : {} };
}
async function saveTargets(body = {}) {
  const clean = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 1e11) throw Object.assign(new Error('Targets must be amounts between 0 and 10,000 crore'), { status: 400 });
    return Math.round(n);
  };
  const people = {};
  Object.entries(body.people || {}).forEach(([id, value]) => {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw Object.assign(new Error('Unknown person'), { status: 400 });
    if (value !== '' && value != null) people[id] = clean(value);
  });
  const next = { company: body.company === '' || body.company == null ? 0 : clean(body.company), people };
  await setSetting(TARGETS_KEY, next);
  return next;
}
async function targets(settings, today, PIPELINE_STATUSES) {
  const { won } = leadStateLists(settings, PIPELINE_STATUSES);
  const from = `${today.slice(0, 7)}-01`;
  const [config, achieved] = await Promise.all([
    getTargets(),
    query(
      `select l.assigned_to, u.full_name, count(*)::int as deals, coalesce(sum(coalesce(l.value, l.estimated_budget, 0)), 0)::numeric as amount
         from leads l left join users u on u.id = l.assigned_to
        where coalesce(l.status, '') = any($1::text[]) and (coalesce(l.converted_at, l.last_status_changed_at, l.updated_at) at time zone '${TIMEZONE}')::date >= $2::date
        group by 1, 2`,
      [won, from]
    )
  ]);
  const people = new Map(achieved.rows.filter((row) => row.assigned_to).map((row) => [row.assigned_to, { id: row.assigned_to, name: row.full_name, deals: row.deals, achieved: Number(row.amount) }]));
  const ids = Object.keys(config.people);
  if (ids.length) {
    const { rows } = await query('select id, full_name from users where id = any($1::text[])', [ids]);
    rows.forEach((row) => people.set(row.id, { id: row.id, name: row.full_name, deals: 0, achieved: 0, ...people.get(row.id) }));
  }
  const list = [...people.values()].map((row) => {
    const target = toNumber(config.people[row.id]);
    return { ...row, target, percent: target ? Math.round((row.achieved / target) * 100) : null };
  });
  const companyAchieved = round2(achieved.rows.reduce((total, row) => total + Number(row.amount || 0), 0));
  return {
    month: new Date(`${from}T00:00:00Z`).toLocaleString('en-IN', { month: 'long', timeZone: 'UTC' }),
    company: { target: config.company, achieved: companyAchieved, percent: config.company ? Math.round((companyAchieved / config.company) * 100) : null },
    people: list.sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1) || b.achieved - a.achieved)
  };
}

// Has every employee who worked yesterday sent yesterday's work report?
async function reportCompliance(today) {
  const yesterday = addDays(today, -1);
  const { rows } = await query(
    `select count(distinct a.employee_id)::int as worked,
            count(distinct r.employee_id) filter (where r.status in ('Submitted', 'Reviewed', 'Approved'))::int as reported
       from hrm_attendance a left join hrm_work_reports r on r.employee_id = a.employee_id and r.work_date = a.work_date
      where a.work_date = $1::date and a.check_in is not null`,
    [yesterday]
  ).catch(() => ({ rows: [] }));
  const row = rows[0] || {};
  return { date: yesterday, worked: row.worked || 0, reported: row.reported || 0, percent: row.worked ? Math.round((row.reported / row.worked) * 100) : null };
}

// One list for today: follow-ups due, meetings, invoices due, AMCs and renewals expiring.
function todayList({ followUps, agenda, snapshots, amcs, renewals, today }) {
  const items = [];
  (followUps?.todayItems || []).forEach((item) => items.push({ kind: 'Follow-up', id: item.id, title: item.title, sub: [item.related, item.assignedTo].filter(Boolean).join(' · '), time: item.dueAt ? new Date(item.dueAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TIMEZONE }) : '', to: `/app/follow-ups?focus=${item.id}` }));
  (agenda || []).forEach((item) => items.push({ kind: 'Meeting', id: item.id, title: item.title, sub: item.location || item.type || '', time: item.time || '', to: item.leadId ? `/app/leads/${item.leadId}` : null }));
  (snapshots || []).filter((s) => s.balanceDue > 0 && day(s.dueDate) === today).forEach((s) => items.push({ kind: 'Invoice due', id: s.id, title: `${s.invoiceNumber || 'Invoice'} · ${s.clientName}`, sub: `₹${Math.round(s.balanceDue).toLocaleString('en-IN')} to collect`, time: '', to: `/app/invoices/${s.id}` }));
  (amcs || []).filter((a) => day(a.endDate) === today || day(a.nextInvoiceDate) === today).forEach((a) => items.push({ kind: 'AMC', id: a.id, title: a.title || 'AMC', sub: day(a.endDate) === today ? 'Ends today' : 'Bill today', time: '', to: `/app/amc/${a.id}` }));
  (renewals || []).filter((r) => day(r.renewalDate || r.expiryDate) === today && !['Cancelled', 'Renewed'].includes(String(r.status || ''))).forEach((r) => items.push({ kind: 'Renewal', id: r.id, title: r.domainName || r.softwareName || r.hostingName || 'Renewal', sub: 'Expires today', time: '', to: '/app/renewals' }));
  return items.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99')).slice(0, 12);
}

// 0–100 from what can be measured; the weakest parts are listed so the score explains itself.
function healthScore({ money, followUps, hrm, system, sales }) {
  const parts = [];
  if (money && !money.error) {
    parts.push({ key: 'collections', label: 'Collections on time', score: money.outstanding ? Math.round(100 - (money.overdueOutstanding / money.outstanding) * 100) : 100 });
    const p = money.period?.current;
    if (p && (p.revenue || p.expense)) parts.push({ key: 'profit', label: 'Profit', score: p.profit >= 0 ? Math.min(100, 60 + Math.round((p.profit / Math.max(1, p.revenue)) * 100)) : Math.max(0, 40 + Math.round((p.profit / Math.max(1, p.expense)) * 40)) });
  }
  if (followUps && !followUps.error && followUps.open) parts.push({ key: 'followups', label: 'Follow-ups on time', score: Math.round(100 - (followUps.overdue / followUps.open) * 100) });
  if (sales && !sales.error && sales.noNextStep && sales.openLeads) parts.push({ key: 'pipeline', label: 'Leads with a next step', score: Math.round(100 - (sales.noNextStep.count / sales.openLeads) * 100) });
  const att = hrm && !hrm.error ? hrm.attendance : null;
  if (att && att.shiftStarted && att.total) {
    const expected = att.total - (att.counts?.leave || 0);
    if (expected > 0) parts.push({ key: 'attendance', label: 'Attendance today', score: Math.round(((att.counts?.present || 0) / expected) * 100) });
  }
  if (system?.backup) parts.push({ key: 'backup', label: 'Backups', score: system.backup.healthy ? 100 : 30 });
  const clamped = parts.map((part) => ({ ...part, score: Math.max(0, Math.min(100, part.score)) }));
  const score = clamped.length ? Math.round(clamped.reduce((total, part) => total + part.score, 0) / clamped.length) : null;
  return {
    score,
    grade: score == null ? null : score >= 80 ? 'Good' : score >= 60 ? 'Fair' : 'Needs attention',
    parts: clamped.sort((a, b) => a.score - b.score)
  };
}

module.exports = {
  PERIODS,
  periodRange,
  periodMoney,
  gstDue,
  cashFlow,
  dueThisWeek,
  topClients,
  projectProfit,
  sales,
  targets,
  getTargets,
  saveTargets,
  reportCompliance,
  todayList,
  healthScore,
  _private: { addDays, shiftMonths, change }
};
