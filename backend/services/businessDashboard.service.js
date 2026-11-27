// Business overview (GET /dashboard/business): one call with every block the signed-in user may
// see. Admins get all of it; other roles get the blocks their permissions open (an accountant the
// money blocks, a sales manager the sales blocks...). Each block is built on its own, so one that
// fails comes back as { error } and the rest still loads. Money figures reuse the Finance report's
// functions, so the dashboard and the reports always agree.
const { query } = require('../config/db');
const { hasPermission } = require('../middlewares/auth');
const { loadBusinessState } = require('./analytics.service');
const {
  buildFinanceSummary,
  buildProfitLoss,
  filterStateByPeriod,
  getInvoiceSnapshot,
  getPaymentAppliedAmount,
  groupCreditNotesByInvoice,
  isIssuedInvoice
} = require('./finance.service');
const { countProjectsByPhase, projectPhase } = require('../config/pipelineFields');
const { getSettings } = require('../models/settings.model');
const { businessDate, round2, toNumber } = require('../utils/format');

const TIMEZONE = 'Asia/Kolkata';
const CLOSED_FOLLOW_UP = ['Completed', 'Cancelled', 'Failed', 'Auto-Closed'];
const OPEN_QUOTATION = ['sent', 'viewed', 'under review', 'revision requested'];

function isAdmin(user) {
  return Boolean(user?.isSuperAdmin) || (user?.roles || []).some((role) => String(role?.code || '').toLowerCase() === 'admin');
}

function can(user, ...permissions) {
  return isAdmin(user) || permissions.some((permission) => hasPermission(user, permission));
}

async function block(name, run) {
  try {
    return await run();
  } catch (error) {
    console.error(`Business dashboard block ${name} failed:`, error.message);
    return { error: 'Could not load' };
  }
}

const sum = (items, pick) => round2(items.reduce((total, item) => total + toNumber(pick(item)), 0));
const day = (value) => String(value || '').slice(0, 10);

function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function monthBounds(date, back = 0) {
  const d = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - back);
  const from = d.toISOString().slice(0, 10);
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return { from, to: end.toISOString().slice(0, 10), label: d.toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' }) };
}

const inRange = (value, { from, to }) => {
  const d = day(value);
  return Boolean(d) && d >= from && d <= to;
};

function leadStates(settings) {
  const statuses = settings?.statuses?.leads || [];
  const byState = (state) => statuses
    .filter((item) => item && typeof item === 'object' && String(item.state || '').toLowerCase() === state)
    .map((item) => String(item.label));
  const won = byState('won').length ? byState('won') : ['Won'];
  const lost = [...byState('lost'), 'Lost'];
  return { won, lost, closed: [...won, ...lost] };
}

// Invoice snapshots (balance, overdue days...) for every issued invoice, with client names.
function invoiceSnapshots(state) {
  const clientById = new Map((state.clients || []).map((client) => [String(client.id), client]));
  const paymentsByInvoice = new Map();
  (state.payments || []).forEach((payment) => {
    const key = String(payment.invoiceId || '');
    paymentsByInvoice.set(key, [...(paymentsByInvoice.get(key) || []), payment]);
  });
  const credits = groupCreditNotesByInvoice(state.creditNotes || []);
  return (state.invoices || [])
    .filter(isIssuedInvoice)
    .map((invoice) => {
      const client = clientById.get(String(invoice.clientId)) || {};
      const snapshot = getInvoiceSnapshot(invoice, paymentsByInvoice.get(String(invoice.id)) || [], state.settings || {}, client, credits.get(String(invoice.id)) || []);
      return { ...snapshot, id: invoice.id, invoiceDate: invoice.invoiceDate || invoice.createdAt, dueDate: invoice.dueDate, clientId: invoice.clientId, clientName: client.name || client.companyName || 'Unknown client' };
    });
}

function money(state, today, range = null) {
  const month = monthBounds(today);
  const lastMonth = monthBounds(today, 1);
  const monthState = filterStateByPeriod(state, { active: true, ...month });
  const lastMonthState = filterStateByPeriod(state, { active: true, ...lastMonth });
  const all = buildFinanceSummary(state);
  const monthSummary = buildFinanceSummary(state, month);
  const pl = buildProfitLoss(monthState);
  const lastPl = buildProfitLoss(lastMonthState);
  const payments = state.payments || [];
  const snapshots = invoiceSnapshots(state);
  const open = snapshots.filter((item) => item.balanceDue > 0);

  // Outstanding money by how late it is (days past the due date).
  const buckets = [
    { key: 'current', label: 'Not due yet', amount: 0, count: 0 },
    { key: 'd30', label: '1–30 days', amount: 0, count: 0 },
    { key: 'd60', label: '31–60 days', amount: 0, count: 0 },
    { key: 'd90', label: '61–90 days', amount: 0, count: 0 },
    { key: 'd90plus', label: '90+ days', amount: 0, count: 0 }
  ];
  for (const item of open) {
    // The snapshot's overdueDays is already "days late" (0 when not overdue).
    const late = item.isOverdue ? Number(item.overdueDays || 0) : 0;
    const bucket = late === 0 ? buckets[0] : late <= 30 ? buckets[1] : late <= 60 ? buckets[2] : late <= 90 ? buckets[3] : buckets[4];
    bucket.amount = round2(bucket.amount + item.balanceDue);
    bucket.count += 1;
  }
  const byClient = new Map();
  for (const item of open) {
    const row = byClient.get(String(item.clientId)) || { clientId: item.clientId, name: item.clientName, amount: 0, invoices: 0 };
    row.amount = round2(row.amount + item.balanceDue);
    row.invoices += 1;
    byClient.set(String(item.clientId), row);
  }

  // Twelve months of billed / received / revenue / spent / profit, oldest first.
  const trend = [];
  for (let back = 11; back >= 0; back -= 1) {
    const bounds = monthBounds(today, back);
    const pl = buildProfitLoss(filterStateByPeriod(state, { active: true, ...bounds }));
    trend.push({
      month: bounds.label,
      from: bounds.from,
      invoiced: sum(snapshots.filter((item) => inRange(item.invoiceDate, bounds)), (item) => item.totalAmount),
      received: sum(payments.filter((payment) => inRange(payment.paymentDate || payment.createdAt, bounds)), getPaymentAppliedAmount),
      revenue: pl.revenue,
      expense: pl.expense,
      profit: pl.profit
    });
  }
  const insight = require('./dashboardInsights.service');

  return {
    month: { from: month.from, to: month.to },
    period: range ? insight.periodMoney(state, snapshots, range) : null,
    gst: insight.gstDue(state, snapshots, today),
    cashFlow: insight.cashFlow(state, snapshots, today),
    dueThisWeek: insight.dueThisWeek(snapshots, today),
    topClients: insight.topClients(snapshots, today),
    receivedToday: sum(payments.filter((payment) => day(payment.paymentDate || payment.createdAt) === today), getPaymentAppliedAmount),
    invoicedThisMonth: monthSummary.totalInvoiceAmount,
    receivedThisMonth: monthSummary.totalReceived,
    receivedLastMonth: buildFinanceSummary(state, lastMonth).totalReceived,
    revenueThisMonth: pl.revenue,
    expenseThisMonth: pl.expense,
    profitThisMonth: pl.profit,
    profitLastMonth: lastPl.profit,
    outstanding: all.totalOutstanding,
    overdueOutstanding: all.totalOverdueOutstanding,
    overdueInvoices: all.overdueInvoiceCount,
    cashInBank: all.cashInBank,
    payables: all.totalPayables,
    aging: buckets,
    topDue: [...byClient.values()].sort((a, b) => b.amount - a.amount).slice(0, 5),
    trend,
    invoices: {
      total: snapshots.length,
      thisMonth: snapshots.filter((item) => inRange(item.invoiceDate, month)).length,
      unpaid: open.length,
      unpaidAmount: sum(open, (item) => item.balanceDue),
      overdue: open.filter((item) => item.isOverdue).length,
      partiallyPaid: snapshots.filter((item) => item.computedStatus === 'Partially Paid').length,
      drafts: (state.invoices || []).filter((invoice) => String(invoice.status || '').trim() === 'Draft').length
    },
    payments: {
      thisMonth: payments.filter((payment) => inRange(payment.paymentDate || payment.createdAt, month)).length,
      recent: [...payments]
        .sort((a, b) => String(b.paymentDate || b.createdAt).localeCompare(String(a.paymentDate || a.createdAt)))
        .slice(0, 5)
        .map((payment) => ({
          id: payment.id,
          date: day(payment.paymentDate || payment.createdAt),
          amount: getPaymentAppliedAmount(payment),
          mode: payment.paymentMode || '',
          client: (state.clients || []).find((client) => String(client.id) === String(payment.clientId))?.name || ''
        }))
    }
  };
}

function expenses(state, today) {
  const month = monthBounds(today);
  const rows = (state.expenses || []).filter((expense) => !['Draft', 'Cancelled', 'Rejected'].includes(String(expense.status || '').trim()));
  const thisMonth = rows.filter((expense) => inRange(expense.expenseDate || expense.createdAt, month));
  const byType = new Map();
  for (const expense of thisMonth) {
    const key = expense.expenseType || expense.payeeType || 'Other';
    byType.set(key, round2((byType.get(key) || 0) + toNumber(expense.totalAmount)));
  }
  return {
    thisMonth: sum(thisMonth, (expense) => expense.totalAmount),
    count: thisMonth.length,
    pendingApproval: (state.expenses || []).filter((expense) => String(expense.approvalStatus || '').trim() === 'Pending').length,
    unpaid: sum(rows, (expense) => expense.balanceDue),
    byType: [...byType.entries()].map(([type, amount]) => ({ type, amount })).sort((a, b) => b.amount - a.amount).slice(0, 5)
  };
}

function clients(state, today) {
  const month = monthBounds(today);
  const snapshots = invoiceSnapshots(state);
  const withDues = new Set(snapshots.filter((item) => item.balanceDue > 0).map((item) => String(item.clientId)));
  return {
    total: (state.clients || []).length,
    newThisMonth: (state.clients || []).filter((client) => inRange(client.createdAt, month)).length,
    withDues: withDues.size
  };
}

function projects(state, today) {
  const settings = state.settings || {};
  const list = state.projects || [];
  const phases = countProjectsByPhase(list, settings);
  const late = list.filter((project) => projectPhase(project.status, settings) === 'open' && project.deadline && day(project.deadline) < today);
  const byStatus = new Map();
  list.forEach((project) => byStatus.set(project.status || 'Unknown', (byStatus.get(project.status || 'Unknown') || 0) + 1));
  const colors = Object.fromEntries((settings.statuses?.projects || []).filter((item) => item && typeof item === 'object').map((item) => [item.label, item.color]));
  return {
    total: list.length,
    active: phases.open,
    completed: phases.completed,
    overdue: late.length,
    activeValue: sum(list.filter((project) => projectPhase(project.status, settings) === 'open'), (project) => project.value),
    byStatus: [...byStatus.entries()].map(([status, count]) => ({ status, count, color: colors[status] || null })).sort((a, b) => b.count - a.count),
    late: late
      .sort((a, b) => day(a.deadline).localeCompare(day(b.deadline)))
      .slice(0, 5)
      .map((project) => ({ id: project.id, title: project.title, deadline: day(project.deadline), status: project.status }))
  };
}

function amc(state, today) {
  const in30 = addDays(today, 30);
  const active = (state.amcs || []).filter((item) => !['Cancelled', 'Expired', 'Completed'].includes(String(item.status || '').trim()));
  const amcDue = (item) => day(item.endDate);
  const renewals = (state.renewals || []).filter((item) => !['Cancelled', 'Renewed'].includes(String(item.status || '').trim()));
  const renewalDue = (item) => day(item.renewalDate || item.expiryDate);
  return {
    active: active.length,
    value: sum(active, (item) => item.amcAmount),
    expiringSoon: active.filter((item) => amcDue(item) && amcDue(item) >= today && amcDue(item) <= in30).length,
    expired: active.filter((item) => amcDue(item) && amcDue(item) < today).length,
    invoiceDue: active.filter((item) => day(item.nextInvoiceDate) && day(item.nextInvoiceDate) <= in30).length,
    renewalsDueSoon: renewals.filter((item) => renewalDue(item) && renewalDue(item) >= today && renewalDue(item) <= in30).length,
    renewalsOverdue: renewals.filter((item) => renewalDue(item) && renewalDue(item) < today).length,
    upcoming: [
      ...active.map((item) => ({ kind: 'AMC', id: item.id, title: item.title || item.amcType || 'AMC', date: amcDue(item), amount: toNumber(item.amcAmount) })),
      ...renewals.map((item) => ({ kind: 'Renewal', id: item.id, title: item.domainName || item.softwareName || item.hostingName || item.packageName || item.category || 'Renewal', date: renewalDue(item), amount: toNumber(item.clientCharge || item.renewalPrice) }))
    ]
      .filter((item) => item.date && item.date <= in30)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 6)
  };
}

async function leads(settings, today, range) {
  const { won, lost, closed } = leadStates(settings);
  const month = monthBounds(today);
  const local = `(l.created_at at time zone '${TIMEZONE}')::date`;
  const [totals, byStatus, bySource] = await Promise.all([
    query(
      `select count(*)::int as total,
              count(*) filter (where not (coalesce(l.status, '') = any($1::text[])))::int as open,
              count(*) filter (where ${local} = $3::date)::int as new_today,
              count(*) filter (where ${local} >= $4::date)::int as new_month,
              count(*) filter (where coalesce(l.status, '') = any($2::text[]))::int as won,
              count(*) filter (where coalesce(l.status, '') = any($5::text[]))::int as lost,
              count(*) filter (where coalesce(l.status, '') = any($2::text[]) and (coalesce(l.converted_at, l.last_status_changed_at, l.updated_at) at time zone '${TIMEZONE}')::date >= $4::date)::int as won_month,
              count(*) filter (where lower(coalesce(l.lead_temperature, '')) = 'hot' and not (coalesce(l.status, '') = any($1::text[])))::int as hot,
              count(*) filter (where coalesce(l.next_follow_up_time, '') = '' and not (coalesce(l.status, '') = any($1::text[])))::int as no_follow_up,
              coalesce(sum(coalesce(l.value, l.estimated_budget)) filter (where not (coalesce(l.status, '') = any($1::text[]))), 0)::numeric as pipeline_value,
              count(*) filter (where ${local} between $6::date and $7::date)::int as new_period,
              count(*) filter (where ${local} between $8::date and $9::date)::int as new_previous,
              count(*) filter (where coalesce(l.status, '') = any($2::text[]) and (coalesce(l.converted_at, l.last_status_changed_at, l.updated_at) at time zone '${TIMEZONE}')::date between $6::date and $7::date)::int as won_period
         from leads l`,
      [closed, won, today, month.from, lost, range.from, range.to, range.prevFrom, range.prevTo]
    ),
    query(`select coalesce(nullif(status, ''), 'New') as status, count(*)::int as count from leads group by 1 order by 2 desc`),
    query(`select coalesce(nullif(source, ''), 'Unknown') as source, count(*)::int as count from leads group by 1 order by 2 desc limit 6`)
  ]);
  const t = totals.rows[0] || {};
  const colors = Object.fromEntries((settings?.statuses?.leads || []).filter((item) => item && typeof item === 'object').map((item) => [item.label, item.color]));
  const decided = (t.won || 0) + (t.lost || 0);
  return {
    total: t.total || 0,
    open: t.open || 0,
    newToday: t.new_today || 0,
    newThisMonth: t.new_month || 0,
    newInPeriod: t.new_period || 0,
    newPrevious: t.new_previous || 0,
    wonInPeriod: t.won_period || 0,
    wonThisMonth: t.won_month || 0,
    won: t.won || 0,
    lost: t.lost || 0,
    conversionRate: decided ? Math.round(((t.won || 0) / decided) * 100) : null,
    hot: t.hot || 0,
    noFollowUp: t.no_follow_up || 0,
    pipelineValue: Number(t.pipeline_value || 0),
    byStatus: byStatus.rows.map((row) => ({ ...row, color: colors[row.status] || null })),
    bySource: bySource.rows
  };
}

async function quotations(today) {
  const month = monthBounds(today);
  const amount = `coalesce(nullif(regexp_replace(coalesce(payload->>'totalAmount', payload->>'amount', payload->>'subtotal', ''), '[^0-9.]', '', 'g'), '')::numeric, 0)`;
  const { rows } = await query(
    `select coalesce(nullif(payload->>'status', ''), 'Draft') as status, count(*)::int as count, sum(${amount})::numeric as amount,
            count(*) filter (where (created_at at time zone '${TIMEZONE}')::date >= $1::date)::int as this_month
       from lead_events where lower(event_type) = 'quotation' group by 1 order by 2 desc`,
    [month.from]
  );
  const open = rows.filter((row) => OPEN_QUOTATION.includes(String(row.status).toLowerCase()));
  const accepted = rows.filter((row) => ['accepted', 'approved', 'won'].includes(String(row.status).toLowerCase()));
  return {
    total: rows.reduce((total, row) => total + row.count, 0),
    thisMonth: rows.reduce((total, row) => total + row.this_month, 0),
    awaiting: open.reduce((total, row) => total + row.count, 0),
    awaitingValue: round2(open.reduce((total, row) => total + Number(row.amount || 0), 0)),
    acceptedValue: round2(accepted.reduce((total, row) => total + Number(row.amount || 0), 0)),
    byStatus: rows.map((row) => ({ status: row.status, count: row.count, amount: Number(row.amount || 0) }))
  };
}

async function followUps(user, today) {
  const center = await require('./followUpEngine.service').getCommandCenter(user);
  const weekStart = addDays(today, -6);
  const { rows } = await query(
    `select count(*) filter (where status = 'Completed' and (coalesce(completed_at, updated_at) at time zone '${TIMEZONE}')::date >= $1::date)::int as done_week,
            count(*) filter (where not (status = any($2::text[])))::int as open
       from follow_ups where deleted_at is null`,
    [weekStart, CLOSED_FOLLOW_UP]
  );
  const names = new Map((await query('select id, full_name from users')).rows.map((user) => [user.id, user.full_name]));
  const pick = (row) => ({
    id: row.id,
    title: row.title,
    dueAt: row.dueAt,
    priority: row.priority,
    assignedTo: names.get(row.assignedTo) || '',
    related: row.relatedEntityLabel || ''
  });
  return {
    overdue: center.counts.overdue || 0,
    dueToday: center.counts.dueToday || 0,
    upcoming: center.counts.upcoming || 0,
    open: rows[0]?.open || 0,
    doneThisWeek: rows[0]?.done_week || 0,
    overdueItems: (center.sections.overdue || []).slice(0, 5).map(pick),
    todayItems: (center.sections.dueToday || []).slice(0, 5).map(pick)
  };
}

// Per salesperson: open leads, new and won this month, follow-ups overdue and done this week.
async function team(settings, today, range) {
  const { won, closed } = leadStates(settings);
  const month = monthBounds(today);
  const { rows } = await query(
    `with people as (
       select u.id, u.full_name from users u where coalesce(u.is_active, true)
     ), lead_stats as (
       select assigned_to as id,
              count(*) filter (where not (coalesce(status, '') = any($1::text[])))::int as open_leads,
              count(*) filter (where (created_at at time zone '${TIMEZONE}')::date between $3::date and $6::date)::int as new_leads,
              count(*) filter (where coalesce(status, '') = any($2::text[]) and (coalesce(converted_at, last_status_changed_at, updated_at) at time zone '${TIMEZONE}')::date between $3::date and $6::date)::int as won
         from leads where assigned_to is not null group by 1
     ), fu as (
       select assigned_to as id,
              count(*) filter (where not (status = any($4::text[])) and due_at < now())::int as overdue,
              count(*) filter (where status = 'Completed' and (coalesce(completed_at, updated_at) at time zone '${TIMEZONE}')::date >= $5::date)::int as done_week
         from follow_ups where deleted_at is null and assigned_to is not null group by 1
     )
     select p.id, p.full_name, coalesce(l.open_leads, 0) as open_leads, coalesce(l.new_leads, 0) as new_leads, coalesce(l.won, 0) as won,
            coalesce(f.overdue, 0) as overdue, coalesce(f.done_week, 0) as done_week
       from people p left join lead_stats l on l.id = p.id left join fu f on f.id = p.id
      where coalesce(l.open_leads, 0) + coalesce(l.new_leads, 0) + coalesce(l.won, 0) + coalesce(f.overdue, 0) + coalesce(f.done_week, 0) > 0
      order by won desc, open_leads desc
      limit 10`,
    [closed, won, range.from, CLOSED_FOLLOW_UP, addDays(today, -6), range.to]
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.full_name,
    openLeads: row.open_leads,
    newLeads: row.new_leads,
    won: row.won,
    overdue: row.overdue,
    doneThisWeek: row.done_week
  }));
}

async function agenda(today) {
  const { rows } = await query(
    `select id, title, event_type, start_time, location, lead_id
       from lead_events where start_date = $1::date
        and lower(coalesce(event_type, '')) not in ('task', 'quotation', 'system', 'note', 'email', 'whatsapp', 'activity')
      order by coalesce(start_time, '99:99') limit 6`,
    [today]
  );
  return rows.map((row) => ({ id: row.id, title: row.title, type: row.event_type, time: row.start_time, location: row.location, leadId: row.lead_id }));
}

async function system() {
  const backup = await require('./googleDrive/backup.service').getBackupHealth().catch(() => null);
  return {
    backup: backup
      ? {
          healthy: Boolean(backup.ok),
          lastSuccessAt: backup.lastSuccessAt || null,
          overdue: Boolean(backup.overdue),
          driveConnected: Boolean(backup.drive?.connected),
          problem: (backup.problems || [])[0] || ''
        }
      : null
  };
}

async function businessDashboard(user, options = {}) {
  const insight = require('./dashboardInsights.service');
  const { PIPELINE_STATUSES } = require('../config/pipelineFields');
  const today = businessDate();
  const range = insight.periodRange(options.period, today);
  const settings = (await getSettings()) || {};
  const admin = isAdmin(user);
  const finance = can(user, 'reports.view');
  const needsState = finance || can(user, 'clients.read', 'projects.read', 'amc.read', 'renewals.read');
  const state = needsState ? await loadBusinessState({ includeCrm: false }) : null;
  const hrmAdmin = require('./hrm/adminDashboard');
  const hrmCore = require('./hrm/core');
  const hrmApprover = admin || hrmCore.can(user, 'approve') || hrmCore.can(user, 'hr_approve');
  const salesView = can(user, 'leads.view_all');

  const [moneyBlock, expenseBlock, clientBlock, projectBlock, amcBlock, leadBlock, quoteBlock, followBlock, teamBlock, agendaBlock, hrmBlock, systemBlock, salesBlock, targetBlock, profitBlock] = await Promise.all([
    finance ? block('money', () => money(state, today, range)) : null,
    can(user, 'reports.view', 'expenses.read') && state ? block('expenses', () => expenses(state, today)) : null,
    can(user, 'clients.read') && state ? block('clients', () => clients(state, today)) : null,
    can(user, 'projects.read') && state ? block('projects', () => projects(state, today)) : null,
    can(user, 'amc.read', 'renewals.read', 'reports.view') && state ? block('amc', () => amc(state, today)) : null,
    salesView ? block('leads', () => leads(settings, today, range)) : null,
    salesView ? block('quotations', () => quotations(today)) : null,
    can(user, 'followups.view_all', 'followups.view_team') ? block('followUps', () => followUps(user, today)) : null,
    salesView ? block('team', () => team(settings, today, range)) : null,
    admin ? block('agenda', () => agenda(today)) : null,
    hrmApprover ? block('hrm', () => hrmOverview(user, hrmAdmin, hrmCore)) : null,
    admin ? block('system', system) : null,
    salesView ? block('sales', () => insight.sales(settings, range, today, PIPELINE_STATUSES)) : null,
    salesView ? block('targets', () => insight.targets(settings, today, PIPELINE_STATUSES)) : null,
    // Project cost includes team time at salary cost, so it needs the money permission.
    finance && state ? block('projectProfit', () => insight.projectProfit(state, settings, projectPhase)) : null
  ]);

  const sales = usableBlock(salesBlock) && usableBlock(leadBlock) ? { ...salesBlock, openLeads: leadBlock.open } : salesBlock;
  const snapshots = state && finance ? invoiceSnapshots(state) : [];
  return {
    today,
    admin,
    period: { key: range.key, label: range.label, compareLabel: range.compareLabel, from: range.from, to: range.to, options: insight.PERIODS },
    money: moneyBlock,
    expenses: expenseBlock,
    clients: clientBlock,
    projects: projectBlock,
    amc: amcBlock,
    leads: leadBlock,
    quotations: quoteBlock,
    followUps: followBlock,
    team: teamBlock,
    agenda: agendaBlock,
    hrm: hrmBlock,
    system: systemBlock,
    sales,
    targets: targetBlock,
    projectProfit: profitBlock,
    todayList: admin
      ? insight.todayList({
          followUps: usableBlock(followBlock) ? followBlock : null,
          agenda: usableBlock(agendaBlock) ? agendaBlock : null,
          snapshots,
          amcs: state?.amcs || [],
          renewals: state?.renewals || [],
          today
        })
      : null,
    health: admin ? insight.healthScore({ money: moneyBlock, followUps: followBlock, hrm: hrmBlock, system: systemBlock, sales }) : null
  };
}

const usableBlock = (value) => value && !value.error;

// Attendance today plus the HRM approval queue and open alerts, exactly as on the HRM overview.
async function hrmOverview(user, hrmAdmin, hrmCore) {
  const db = hrmCore.dbDefault;
  const policy = await hrmCore.policy(db);
  const today = hrmCore.today(policy);
  const { todayBoard, approvals, alerts } = hrmAdmin._blocks;
  const { utilization } = hrmAdmin._blocks;
  const [board, queue, open, util, reports] = await Promise.all([
    todayBoard(db, user, policy, today).catch(() => null),
    approvals(db, user).catch(() => null),
    alerts(db, user, today).catch(() => null),
    utilization(db, user, today).catch(() => null),
    require('./dashboardInsights.service').reportCompliance(today)
  ]);
  return {
    attendance: board ? { date: board.date, total: board.total, counts: board.counts, shiftStarted: board.shiftStarted } : null,
    approvals: queue,
    alerts: open,
    utilization: util ? { average: util.average, total: util.total, benchCount: util.benchCount, over: util.over.slice(0, 5), bench: util.bench.slice(0, 5) } : null,
    reports
  };
}

module.exports = { businessDashboard, _private: { monthBounds, isAdmin, invoiceSnapshots, money } };
