import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlarmClock,
  ArrowDownToLine,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  FileSignature,
  HardDrive,
  ListChecks,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet
} from 'lucide-react';
import { api } from '../../api/client';
import { Card } from '../ui/Card';
import { cn } from '../../lib/cn';
import { Approvals, Alerts } from '../../pages/hrm/HrmAdminOverview';

// ₹ with Indian grouping; lakh / crore once the number gets long.
export function inr(value) {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

const count = (value) => Number(value || 0).toLocaleString('en-IN');
const usable = (block) => block && !block.error;

function when(iso, withTime = true) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
    timeZone: 'Asia/Kolkata'
  });
}

function Panel({ title, icon: Icon, to, linkLabel = 'Open', className = '', children }) {
  return (
    <Card className={cn('flex min-w-0 flex-col p-4', className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
          {Icon ? <Icon size={15} className="shrink-0 text-[var(--primary)]" /> : null}
          <span className="truncate">{title}</span>
        </h3>
        {to ? (
          <Link to={to} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline">
            {linkLabel} <ArrowRight size={12} />
          </Link>
        ) : null}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </Card>
  );
}

function Failed() {
  return <p className="text-xs text-rose-600">Could not load this section.</p>;
}

function Empty({ children }) {
  return <p className="rounded-xl border border-dashed border-[var(--border)] px-3 py-4 text-center text-xs text-[var(--text-muted)]">{children}</p>;
}

// One headline number with an optional sub-line and trend arrow.
function Kpi({ label, value, sub, icon: Icon, tone = 'text-[var(--primary)]', trend = null, to }) {
  const body = (
    <Card className="h-full p-3.5 transition hover:border-[var(--primary)]/40">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-[var(--text-muted)]">{label}</p>
        {Icon ? <Icon size={15} className={cn('shrink-0', tone)} /> : null}
      </div>
      <p className="mt-1.5 truncate text-lg font-bold tabular-nums text-[var(--text-main)]">{value}</p>
      {sub ? (
        <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-[var(--text-muted)]">
          {trend === 'up' ? <TrendingUp size={12} className="text-emerald-600" /> : trend === 'down' ? <TrendingDown size={12} className="text-rose-600" /> : null}
          {sub}
        </p>
      ) : null}
    </Card>
  );
  return to ? <Link to={to} className="block min-w-0">{body}</Link> : <div className="min-w-0">{body}</div>;
}

// A module's numbers as label/value rows.
function Stats({ rows }) {
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
      {rows.filter(Boolean).map(([label, value, tone]) => (
        <div key={label} className="min-w-0">
          <dt className="truncate text-[11px] text-[var(--text-muted)]">{label}</dt>
          <dd className={cn('truncate text-sm font-semibold tabular-nums text-[var(--text-main)]', tone)}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// Horizontal bars for one measure across a few categories (lead status, aging...).
function BarList({ items, format = count, color = 'bg-[#257de0] dark:bg-[#338ced]' }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  if (!items.length) return null;
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-2 text-xs" title={`${item.label}: ${format(item.value)}`}>
          <span className="truncate text-[var(--text-muted)]">{item.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
            <span
              className={cn('block h-full rounded-full', !item.color && color)}
              style={{ width: `${Math.max(item.value ? 4 : 0, (item.value / max) * 100)}%`, ...(item.color ? { background: item.color } : {}) }}
            />
          </span>
          <span className="tabular-nums font-semibold text-[var(--text-main)]">{format(item.value)}</span>
        </li>
      ))}
    </ul>
  );
}

// Six months of invoiced / received / spent as grouped bars on one ₹ axis, with a hover tooltip.
const SERIES = [
  { key: 'invoiced', label: 'Invoiced', className: 'bg-[#257de0] dark:bg-[#338ced]' },
  { key: 'received', label: 'Received', className: 'bg-[#f47230] dark:bg-[#e76624]' },
  { key: 'expense', label: 'Expense', className: 'bg-[#00b894] dark:bg-[#00a888]' }
];
function TrendChart({ trend }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...trend.flatMap((month) => SERIES.map((s) => Number(month[s.key] || 0))));
  const empty = trend.every((month) => SERIES.every((s) => !Number(month[s.key])));
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-muted)]">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className={cn('h-2.5 w-2.5 rounded-sm', s.className)} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="relative">
        <div className="flex h-40 items-end gap-2 border-b border-[var(--border)] sm:gap-4">
          {trend.map((month, index) => (
            <div
              key={month.from}
              className="flex h-full flex-1 items-end justify-center gap-[2px] rounded-md hover:bg-[var(--surface-2)]/60"
              onMouseEnter={() => setHover({ ...month, index })}
              onMouseLeave={() => setHover(null)}
            >
              {SERIES.map((s) => (
                <span
                  key={s.key}
                  className={cn('w-full max-w-[14px] rounded-t-[4px]', s.className)}
                  style={{ height: `${Math.max(Number(month[s.key]) ? 2 : 0, (Number(month[s.key] || 0) / max) * 100)}%` }}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-2 text-center text-[11px] text-[var(--text-muted)] sm:gap-4">
          {trend.map((month) => (
            <span key={month.from} className="flex-1">{month.month}</span>
          ))}
        </div>
        {hover ? (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs shadow-lg"
            // Above the hovered month, kept inside the chart at both ends.
            style={{ left: `${Math.min(88, Math.max(12, ((hover.index + 0.5) / trend.length) * 100))}%` }}
          >
            <p className="mb-1 font-semibold text-[var(--text-main)]">{hover.month}</p>
            {SERIES.map((s) => (
              <p key={s.key} className="flex items-center gap-1.5 text-[var(--text-muted)]">
                <span className={cn('h-2 w-2 rounded-sm', s.className)} />
                {s.label}: <span className="font-semibold tabular-nums text-[var(--text-main)]">{inr(hover[s.key])}</span>
              </p>
            ))}
          </div>
        ) : null}
        {empty ? <p className="absolute inset-x-0 top-14 text-center text-xs text-[var(--text-muted)]">No invoices, payments or expenses in the last 6 months.</p> : null}
      </div>
    </div>
  );
}

/**
 * Business overview from GET /dashboard/business. Shows whatever blocks the server sent: an admin
 * gets every block on one screen; other roles get their own blocks (`compact` drops the page
 * heading when it sits under a personal dashboard).
 */
export function BusinessDashboard({ token, compact = false }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    api.dashboard
      .business(token)
      .then((response) => {
        setData(response.data || {});
        setError('');
      })
      .catch((e) => setError(e.message || 'Could not load the dashboard'))
      .finally(() => setLoading(false));
  }, [token]);
  useEffect(() => {
    load();
    // Keep the overview current while it is open.
    const id = setInterval(() => !document.hidden && load(), 120000);
    return () => clearInterval(id);
  }, [load]);

  if (error && !data) return <Card className="p-5 text-sm text-rose-600">{error}</Card>;
  if (!data) return <div className="grid gap-3 sm:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Card key={i} className="h-24 animate-pulse bg-[var(--surface-2)]" />)}</div>;

  const { money, expenses, clients, projects, amc, leads, quotations, followUps, team, agenda, hrm, system } = data;
  const anything = [money, expenses, clients, projects, amc, leads, quotations, followUps, team, agenda, hrm, system].some(Boolean);
  if (!anything) return null;
  const m = usable(money) ? money : null;
  const att = usable(hrm) ? hrm.attendance : null;
  const receivedTrend = m ? (m.receivedThisMonth >= m.receivedLastMonth ? 'up' : 'down') : null;

  return (
    <div className="space-y-4">
      {!compact ? (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-main)]">Business overview</h1>
            <p className="text-xs text-[var(--text-muted)]">
              {new Date(`${data.today}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · updates every 2 minutes
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-main)] hover:border-[var(--primary)]/40 disabled:opacity-60"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      ) : (
        <h2 className="pt-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Business</h2>
      )}

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {m ? (
          <>
            <Kpi label="Received today" value={inr(m.receivedToday)} sub="Payments credited today" icon={ArrowDownToLine} tone="text-emerald-600" to="/app/payments" />
            <Kpi label="Month receipts" value={inr(m.receivedThisMonth)} sub={`Last month ${inr(m.receivedLastMonth)}`} trend={receivedTrend} icon={Wallet} to="/app/payments" />
            <Kpi label="Month revenue" value={inr(m.revenueThisMonth)} sub={`Expense ${inr(m.expenseThisMonth)}`} icon={CircleDollarSign} to="/app/finance" />
            <Kpi
              label="Month profit"
              value={inr(m.profitThisMonth)}
              sub={`Last month ${inr(m.profitLastMonth)}`}
              trend={m.profitThisMonth >= m.profitLastMonth ? 'up' : 'down'}
              icon={TrendingUp}
              tone={m.profitThisMonth < 0 ? 'text-rose-600' : 'text-emerald-600'}
              to="/app/finance"
            />
            <Kpi label="Outstanding" value={inr(m.outstanding)} sub={`${inr(m.overdueOutstanding)} overdue`} icon={ReceiptText} tone="text-amber-600" to="/app/invoices" />
          </>
        ) : null}
        {usable(leads) ? <Kpi label="New leads" value={count(leads.newThisMonth)} sub={`This month · ${count(leads.newToday)} today`} icon={Target} to="/app/leads" /> : null}
        {usable(followUps) ? (
          <Kpi
            label="Late follow-ups"
            value={count(followUps.overdue)}
            sub={`${count(followUps.dueToday)} due today`}
            icon={AlarmClock}
            tone={followUps.overdue ? 'text-rose-600' : 'text-emerald-600'}
            to="/app/follow-ups?view=today"
          />
        ) : null}
        {att ? (
          <Kpi
            label="Present today"
            value={`${count(att.counts?.present)} / ${count(att.total)}`}
            sub={`${count(att.counts?.late)} late · ${count(att.counts?.leave)} on leave`}
            icon={CalendarCheck}
            to="/app/hrm/attendance"
          />
        ) : null}
      </div>

      {/* Money: trend and who owes what */}
      {money ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Invoiced vs received vs expense · last 6 months" icon={TrendingUp} to="/app/finance" linkLabel="Finance" className="lg:col-span-2">
            {m ? <TrendChart trend={m.trend || []} /> : <Failed />}
          </Panel>
          <Panel title="Receivables aging" icon={ReceiptText} to="/app/invoices" linkLabel="Invoices">
            {m ? (
              <div className="space-y-4">
                <BarList items={(m.aging || []).map((b) => ({ label: b.label, value: b.amount }))} format={inr} />
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Top dues</p>
                  {m.topDue?.length ? (
                    <ul className="space-y-1 text-xs">
                      {m.topDue.map((row) => (
                        <li key={row.clientId} className="flex justify-between gap-2">
                          <Link to={`/app/clients/${row.clientId}`} className="truncate text-[var(--text-main)] hover:text-[var(--primary)]">{row.name}</Link>
                          <span className="shrink-0 font-semibold tabular-nums">{inr(row.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty>Nothing outstanding.</Empty>
                  )}
                </div>
              </div>
            ) : (
              <Failed />
            )}
          </Panel>
        </div>
      ) : null}

      {/* Every module at a glance */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {leads ? (
          <Panel title="Leads" icon={Target} to="/app/leads">
            {usable(leads) ? (
              <Stats
                rows={[
                  ['Open', count(leads.open)],
                  ['New this month', count(leads.newThisMonth)],
                  ['Won this month', count(leads.wonThisMonth), 'text-emerald-600'],
                  ['Conversion', leads.conversionRate == null ? '—' : `${leads.conversionRate}%`],
                  ['Hot', count(leads.hot), leads.hot ? 'text-rose-600' : ''],
                  ['Pipeline value', inr(leads.pipelineValue)]
                ]}
              />
            ) : <Failed />}
          </Panel>
        ) : null}
        {followUps ? (
          <Panel title="Follow-ups" icon={ListChecks} to="/app/follow-ups?view=today">
            {usable(followUps) ? (
              <Stats
                rows={[
                  ['Overdue', count(followUps.overdue), followUps.overdue ? 'text-rose-600' : ''],
                  ['Due today', count(followUps.dueToday)],
                  ['Upcoming', count(followUps.upcoming)],
                  ['Open', count(followUps.open)],
                  ['Done this week', count(followUps.doneThisWeek), 'text-emerald-600']
                ]}
              />
            ) : <Failed />}
          </Panel>
        ) : null}
        {quotations ? (
          <Panel title="Quotations" icon={FileSignature} to="/app/quotations">
            {usable(quotations) ? (
              <Stats
                rows={[
                  ['Total', count(quotations.total)],
                  ['This month', count(quotations.thisMonth)],
                  ['Awaiting reply', count(quotations.awaiting)],
                  ['Awaiting value', inr(quotations.awaitingValue)],
                  ['Accepted value', inr(quotations.acceptedValue), 'text-emerald-600']
                ]}
              />
            ) : <Failed />}
          </Panel>
        ) : null}
        {clients ? (
          <Panel title="Clients" icon={Building2} to="/app/clients">
            {usable(clients) ? (
              <Stats rows={[['Total', count(clients.total)], ['New this month', count(clients.newThisMonth)], ['With dues', count(clients.withDues), clients.withDues ? 'text-amber-600' : '']]} />
            ) : <Failed />}
          </Panel>
        ) : null}
        {projects ? (
          <Panel title="Projects" icon={BriefcaseBusiness} to="/app/projects">
            {usable(projects) ? (
              <Stats
                rows={[
                  ['Active', count(projects.active)],
                  ['Completed', count(projects.completed), 'text-emerald-600'],
                  ['Past deadline', count(projects.overdue), projects.overdue ? 'text-rose-600' : ''],
                  ['Active value', inr(projects.activeValue)]
                ]}
              />
            ) : <Failed />}
          </Panel>
        ) : null}
        {m ? (
          <Panel title="Invoices" icon={ReceiptText} to="/app/invoices">
            <Stats
              rows={[
                ['This month', count(m.invoices.thisMonth)],
                ['Invoiced (month)', inr(m.invoicedThisMonth)],
                ['Unpaid', `${count(m.invoices.unpaid)} · ${inr(m.invoices.unpaidAmount)}`],
                ['Overdue', count(m.invoices.overdue), m.invoices.overdue ? 'text-rose-600' : ''],
                ['Partly paid', count(m.invoices.partiallyPaid)],
                ['Drafts', count(m.invoices.drafts)]
              ]}
            />
          </Panel>
        ) : null}
        {m ? (
          <Panel title="Payments" icon={Wallet} to="/app/payments">
            <Stats rows={[['Today', inr(m.receivedToday)], ['This month', inr(m.receivedThisMonth)], ['Payments (month)', count(m.payments.thisMonth)], ['Last month', inr(m.receivedLastMonth)]]} />
            {m.payments.recent?.length ? (
              <ul className="mt-3 space-y-1 border-t border-[var(--border)] pt-2 text-xs">
                {m.payments.recent.slice(0, 3).map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <span className="truncate text-[var(--text-muted)]">{p.client || p.mode || 'Payment'} · {p.date}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{inr(p.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Panel>
        ) : null}
        {m ? (
          <Panel title="Finance" icon={CircleDollarSign} to="/app/finance">
            <Stats
              rows={[
                ['Cash in bank', inr(m.cashInBank)],
                ['Payables', inr(m.payables)],
                ['Revenue (month)', inr(m.revenueThisMonth)],
                ['Profit (month)', inr(m.profitThisMonth), m.profitThisMonth < 0 ? 'text-rose-600' : 'text-emerald-600']
              ]}
            />
          </Panel>
        ) : null}
        {expenses ? (
          <Panel title="Expenses" icon={ClipboardList} to="/app/expenses">
            {usable(expenses) ? (
              <>
                <Stats
                  rows={[
                    ['This month', inr(expenses.thisMonth)],
                    ['Entries', count(expenses.count)],
                    ['Awaiting approval', count(expenses.pendingApproval), expenses.pendingApproval ? 'text-amber-600' : ''],
                    ['Unpaid', inr(expenses.unpaid)]
                  ]}
                />
                {expenses.byType?.length ? (
                  <div className="mt-3 border-t border-[var(--border)] pt-2">
                    <BarList items={expenses.byType.map((row) => ({ label: row.type, value: row.amount }))} format={inr} />
                  </div>
                ) : null}
              </>
            ) : <Failed />}
          </Panel>
        ) : null}
        {amc ? (
          <Panel title="AMC & renewals" icon={CalendarClock} to="/app/amc" linkLabel="AMC">
            {usable(amc) ? (
              <Stats
                rows={[
                  ['Active AMC', count(amc.active)],
                  ['AMC value', inr(amc.value)],
                  ['Expiring in 30 days', count(amc.expiringSoon), amc.expiringSoon ? 'text-amber-600' : ''],
                  ['Expired', count(amc.expired), amc.expired ? 'text-rose-600' : ''],
                  ['Renewals due (30d)', count(amc.renewalsDueSoon)],
                  ['Renewals overdue', count(amc.renewalsOverdue), amc.renewalsOverdue ? 'text-rose-600' : '']
                ]}
              />
            ) : <Failed />}
          </Panel>
        ) : null}
        {att ? (
          <Panel title="Attendance today" icon={CalendarCheck} to="/app/hrm/attendance">
            <Stats
              rows={[
                ['Present', `${count(att.counts?.present)} / ${count(att.total)}`, 'text-emerald-600'],
                ['Late', count(att.counts?.late), att.counts?.late ? 'text-amber-600' : ''],
                ['Working now', count(att.counts?.working)],
                ['Remote / WFH', count(att.counts?.remote)],
                ['On leave', count(att.counts?.leave)],
                ['Not clocked in', count(att.counts?.notIn), att.shiftStarted && att.counts?.notIn ? 'text-rose-600' : '']
              ]}
            />
          </Panel>
        ) : null}
      </div>

      {/* HR actions, straight from the dashboard */}
      {usable(hrm) && (hrm.approvals || hrm.alerts) ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {hrm.approvals ? (
            <Panel title={`Waiting for your approval (${count(hrm.approvals.total)})`} icon={ClipboardList} to="/app/hrm/overview" linkLabel="HRM">
              <Approvals approvals={hrm.approvals} token={token} onChanged={load} />
            </Panel>
          ) : null}
          {hrm.alerts ? (
            <Panel title={`Attendance alerts (${count(hrm.alerts.total)})`} icon={ShieldAlert} to="/app/hrm/overview" linkLabel="HRM">
              <Alerts alerts={hrm.alerts} token={token} onChanged={load} tz="Asia/Kolkata" />
            </Panel>
          ) : null}
        </div>
      ) : null}

      {/* Sales: who is doing what, and where leads stand */}
      {team || leads ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {team ? (
            <Panel title="Team performance" icon={Users} to="/app/leads" linkLabel="Leads" className="lg:col-span-2">
              {usable(team) ? (
                team.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[30rem] text-xs">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                          <th className="pb-2 font-semibold">Person</th>
                          <th className="pb-2 text-right font-semibold">Open leads</th>
                          <th className="pb-2 text-right font-semibold">New (month)</th>
                          <th className="pb-2 text-right font-semibold">Won (month)</th>
                          <th className="pb-2 text-right font-semibold">Follow-ups overdue</th>
                          <th className="pb-2 text-right font-semibold">Done (7 days)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {team.map((row) => (
                          <tr key={row.id}>
                            <td className="py-1.5 font-semibold text-[var(--text-main)]">{row.name}</td>
                            <td className="py-1.5 text-right tabular-nums">{count(row.openLeads)}</td>
                            <td className="py-1.5 text-right tabular-nums">{count(row.newLeads)}</td>
                            <td className="py-1.5 text-right tabular-nums text-emerald-600">{count(row.won)}</td>
                            <td className={cn('py-1.5 text-right tabular-nums', row.overdue && 'font-semibold text-rose-600')}>{count(row.overdue)}</td>
                            <td className="py-1.5 text-right tabular-nums">{count(row.doneThisWeek)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty>No assigned leads or follow-ups yet.</Empty>
                )
              ) : <Failed />}
            </Panel>
          ) : null}
          {leads ? (
            <Panel title="Lead pipeline" icon={Target} to="/app/leads" className={team ? '' : 'lg:col-span-3'}>
              {usable(leads) ? (
                <div className="space-y-4">
                  <BarList items={(leads.byStatus || []).map((row) => ({ label: row.status, value: row.count, color: row.color }))} />
                  {leads.bySource?.length ? (
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">By source</p>
                      <BarList items={leads.bySource.map((row) => ({ label: row.source, value: row.count }))} />
                    </div>
                  ) : null}
                </div>
              ) : <Failed />}
            </Panel>
          ) : null}
        </div>
      ) : null}

      {/* Today and what needs attention next */}
      {followUps || agenda || projects || amc || system ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {usable(followUps) ? (
            <Panel title="Overdue follow-ups" icon={AlarmClock} to="/app/follow-ups?view=today">
              {followUps.overdueItems?.length ? (
                <ul className="space-y-2 text-xs">
                  {followUps.overdueItems.map((item) => (
                    <li key={item.id}>
                      <Link to={`/app/follow-ups?focus=${item.id}`} className="block truncate font-semibold text-[var(--text-main)] hover:text-[var(--primary)]">{item.title}</Link>
                      <span className="block truncate text-[var(--text-muted)]">{[item.related, item.assignedTo, when(item.dueAt)].filter(Boolean).join(' · ')}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>Nothing overdue.</Empty>
              )}
            </Panel>
          ) : null}
          {usable(agenda) ? (
            <Panel title="Today's meetings & calls" icon={CalendarClock}>
              {agenda.length ? (
                <ul className="space-y-2 text-xs">
                  {agenda.map((item) => (
                    <li key={item.id} className="flex gap-2">
                      <span className="w-11 shrink-0 tabular-nums text-[var(--text-muted)]">{item.time || 'All day'}</span>
                      {item.leadId ? (
                        <Link to={`/app/leads/${item.leadId}`} className="truncate font-semibold text-[var(--text-main)] hover:text-[var(--primary)]">{item.title}</Link>
                      ) : (
                        <span className="truncate font-semibold text-[var(--text-main)]">{item.title}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No meetings or calls today.</Empty>
              )}
            </Panel>
          ) : null}
          {usable(projects) || usable(amc) ? (
            <Panel title="Coming due" icon={CalendarClock}>
              {[...(usable(projects) ? projects.late.map((p) => ({ key: `p${p.id}`, to: `/app/projects/${p.id}`, title: p.title, meta: `Deadline ${p.deadline}`, late: true })) : []),
                ...(usable(amc) ? amc.upcoming.map((a) => ({ key: `${a.kind}${a.id}`, to: a.kind === 'AMC' ? `/app/amc/${a.id}` : '/app/renewals', title: `${a.kind}: ${a.title}`, meta: `${a.date} · ${inr(a.amount)}`, late: a.date < data.today }))
                : [])].slice(0, 6).map((row, index, list) => (
                <Link key={row.key} to={row.to} className={cn('block py-1.5 text-xs', index < list.length - 1 && 'border-b border-[var(--border)]')}>
                  <span className="block truncate font-semibold text-[var(--text-main)]">{row.title}</span>
                  <span className={cn('block truncate', row.late ? 'text-rose-600' : 'text-[var(--text-muted)]')}>{row.meta}</span>
                </Link>
              ))}
              {!(usable(projects) && projects.late.length) && !(usable(amc) && amc.upcoming.length) ? <Empty>No late projects, AMCs or renewals in the next 30 days.</Empty> : null}
            </Panel>
          ) : null}
          {usable(system) && system.backup ? (
            <Panel title="System health" icon={HardDrive} to="/app/settings/storage" linkLabel="Storage">
              <ul className="space-y-2 text-xs">
                <li className="flex items-center gap-2">
                  {system.backup.healthy ? <CheckCircle2 size={14} className="text-emerald-600" /> : <ShieldAlert size={14} className="text-rose-600" />}
                  <span className="text-[var(--text-main)]">
                    Database backup: {system.backup.healthy ? 'OK' : 'needs attention'}
                  </span>
                </li>
                <li className="pl-6 text-[var(--text-muted)]">Last success: {system.backup.lastSuccessAt ? when(system.backup.lastSuccessAt) : 'never'}</li>
                {system.backup.problem ? <li className="pl-6 text-rose-600">{system.backup.problem}</li> : null}
                <li className="flex items-center gap-2">
                  {system.backup.driveConnected ? <CheckCircle2 size={14} className="text-emerald-600" /> : <ShieldAlert size={14} className="text-rose-600" />}
                  <span className="text-[var(--text-main)]">Google Drive {system.backup.driveConnected ? 'connected' : 'not connected'}</span>
                </li>
              </ul>
            </Panel>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
