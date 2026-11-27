import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
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
  Clock,
  FileSignature,
  Gauge,
  HardDrive,
  Landmark,
  ListChecks,
  Mail,
  Pencil,
  PieChart,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
  Target,
  Timer,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserX,
  Users,
  Wallet,
  Waves
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { cn } from '../../lib/cn';
import { Approvals, Alerts } from '../../pages/hrm/HrmAdminOverview';
import { BarList, ComboChart, Donut, Funnel, Legend, Ring, SEQUENTIAL, SERIES, STATUS, Sparkline, StackBar, scoreColor } from './dashboardCharts';

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
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}), timeZone: 'Asia/Kolkata' });
}
// By the viewer's clock: morning 5–12, afternoon 12–17, evening 17–22, night 22–5.
export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 22) return 'Good evening';
  return 'Good night';
}

// Re-reads the clock every minute so the greeting changes while the page stays open.
function useGreeting() {
  const [text, setText] = useState(() => greeting());
  useEffect(() => {
    const id = setInterval(() => setText(greeting()), 60000);
    return () => clearInterval(id);
  }, []);
  return text;
}

function Panel({ title, icon: Icon, to, linkLabel = 'Open', action, className = '', children }) {
  return (
    <Card className={cn('flex min-w-0 flex-col p-4', className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
          {Icon ? (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
              <Icon size={14} />
            </span>
          ) : null}
          <span className="truncate">{title}</span>
        </h3>
        {action ||
          (to ? (
            <Link to={to} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline">
              {linkLabel} <ArrowRight size={12} />
            </Link>
          ) : null)}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </Card>
  );
}
const Failed = () => <p className="text-xs text-rose-600">Could not load this section.</p>;
const Empty = ({ children }) => <p className="rounded-xl border border-dashed border-[var(--border)] px-3 py-4 text-center text-xs text-[var(--text-muted)]">{children}</p>;

// Change vs the comparison period: arrow and %, green when the move is good for this number.
function Delta({ value, goodWhenUp = true }) {
  if (value == null) return <span className="text-[11px] text-[var(--text-muted)]">new</span>;
  if (value === 0) return <span className="text-[11px] text-[var(--text-muted)]">no change</span>;
  const good = goodWhenUp ? value > 0 : value < 0;
  return (
    <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold', good ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-700 dark:text-rose-400')}>
      {value > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {Math.abs(value)}%
    </span>
  );
}

function Kpi({ label, value, sub, icon: Icon, delta, goodWhenUp, spark, series, to, tone }) {
  const body = (
    <Card className="group h-full overflow-hidden p-3.5 transition hover:-translate-y-0.5 hover:border-[var(--primary)]/40 hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-[var(--text-muted)]">{label}</p>
        {Icon ? <Icon size={15} className={cn('shrink-0', tone || 'text-[var(--primary)]')} /> : null}
      </div>
      <p className="mt-1 truncate text-xl font-bold tabular-nums text-[var(--text-main)]">{value}</p>
      <div className="mt-0.5 flex min-h-[18px] items-center gap-1.5">
        {delta !== undefined ? <Delta value={delta} goodWhenUp={goodWhenUp} /> : null}
        {sub ? <span className="truncate text-[11px] text-[var(--text-muted)]">{sub}</span> : null}
      </div>
      {spark ? <div className="-mx-3.5 -mb-3.5 mt-2"><Sparkline values={spark} series={series} /></div> : null}
    </Card>
  );
  return to ? <Link to={to} className="block min-w-0">{body}</Link> : <div className="min-w-0">{body}</div>;
}

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

const PERIOD_SHORT = { today: 'Today', week: 'Week', month: 'Month', quarter: 'Quarter', fy: 'FY' };

// ─── Hero: greeting, period, health score ──────────────────────────────────────
function Hero({ data, period, setPeriod, loading, onRefresh, compact, onDigest, sending }) {
  const { user } = useAuth();
  const hello = useGreeting();
  const health = data.health;
  const options = data.period?.options || {};
  return (
    <div className={cn('relative overflow-hidden rounded-3xl p-5 text-white shadow-lg', compact ? 'bg-gradient-to-r from-slate-700 to-slate-900' : 'bg-gradient-to-br from-[#4f46e5] via-[#4338ca] to-[#0ea5e9]')}>
      <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-sky-300/20 blur-3xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div className="min-w-0">
          <p className="text-xs text-white/80">
            {new Date(`${data.today}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight">
            {compact ? 'Business' : `${hello}${user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}`}
          </h1>
          <p className="text-xs text-white/80">
            {data.period?.label} · compared with {data.period?.compareLabel} · refreshes every 2 minutes
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex flex-wrap rounded-xl bg-white/15 p-1 backdrop-blur" role="tablist" aria-label="Period">
              {Object.keys(options).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={period === key}
                  onClick={() => setPeriod(key)}
                  title={options[key]}
                  className={cn('rounded-lg px-2.5 py-1 text-xs font-semibold transition', period === key ? 'bg-white text-[#4338ca] shadow' : 'text-white/90 hover:bg-white/15')}
                >
                  {PERIOD_SHORT[key] || options[key]}
                </button>
              ))}
            </div>
            <button type="button" onClick={onRefresh} disabled={loading} className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur hover:bg-white/25 disabled:opacity-60">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            {onDigest ? (
              <button type="button" onClick={onDigest} disabled={sending} className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur hover:bg-white/25 disabled:opacity-60">
                <Mail size={13} /> {sending ? 'Sending…' : 'Email me the summary'}
              </button>
            ) : null}
          </div>
        </div>
        {health && health.score != null ? (
          <div className="flex items-center gap-4 rounded-2xl bg-white/95 p-3 pr-4 text-slate-900 shadow-md dark:bg-slate-900/90 dark:text-white">
            <Ring value={health.score} size={92} stroke={10} label={health.score} sub="of 100" />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400"><Gauge size={13} /> Business health</p>
              <p className="text-lg font-bold" style={{ color: scoreColor(health.score) }}>{health.grade}</p>
              <ul className="mt-1 space-y-0.5 text-[11px]">
                {health.parts.slice(0, 3).map((part) => (
                  <li key={part.key} className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: scoreColor(part.score) }} />
                    <span className="text-slate-600 dark:text-slate-300">{part.label}</span>
                    <span className="font-semibold tabular-nums">{part.score}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Targets editor (admins) ───────────────────────────────────────────────────
function TargetsModal({ open, onClose, token, people, onSaved }) {
  const [company, setCompany] = useState('');
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    api.dashboard
      .targets(token)
      .then((response) => {
        setCompany(response.data?.company ? String(response.data.company) : '');
        setValues(Object.fromEntries(Object.entries(response.data?.people || {}).map(([id, v]) => [id, String(v)])));
      })
      .catch(() => {});
  }, [open, token]);
  async function save() {
    setSaving(true);
    try {
      await api.dashboard.saveTargets(token, { company, people: values });
      toast.success('Targets saved');
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error.message || 'Could not save targets');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open={open} title="Monthly sales targets" subtitle="Value of leads won each month (₹). Leave a box empty for no target." onClose={onClose}>
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Company target</span>
          <input type="number" min="0" value={company} onChange={(e) => setCompany(e.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2" placeholder="e.g. 500000" />
        </label>
        {people.map((person) => (
          <label key={person.id} className="flex items-center gap-3 text-sm">
            <span className="w-40 truncate text-[var(--text-main)]">{person.name}</span>
            <input type="number" min="0" value={values[person.id] || ''} onChange={(e) => setValues((v) => ({ ...v, [person.id]: e.target.value }))} className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2" placeholder="No target" />
          </label>
        ))}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-xl px-3 py-2 text-sm font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-2)]">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save targets'}</button>
        </div>
      </div>
    </Modal>
  );
}

const KIND_STYLE = {
  'Follow-up': { icon: ListChecks, cls: 'bg-sky-500/15 text-sky-600' },
  Meeting: { icon: CalendarClock, cls: 'bg-violet-500/15 text-violet-600' },
  'Invoice due': { icon: ReceiptText, cls: 'bg-amber-500/15 text-amber-600' },
  AMC: { icon: CalendarCheck, cls: 'bg-emerald-500/15 text-emerald-600' },
  Renewal: { icon: RefreshCw, cls: 'bg-rose-500/15 text-rose-600' }
};
const marginColor = (margin) => (margin == null ? '#94a3b8' : margin < 0 ? STATUS.critical : margin < 25 ? STATUS.warning : STATUS.good);

/**
 * Business overview from GET /dashboard/business. Shows whatever blocks the server sent: an admin
 * gets everything; other roles get their own blocks (`compact` = under a personal dashboard).
 */
export function BusinessDashboard({ token, compact = false }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(() => {
    try {
      return localStorage.getItem('webitof-dashboard-period') || 'month';
    } catch {
      return 'month';
    }
  });
  const [editTargets, setEditTargets] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.dashboard
      .business(token, period)
      .then((response) => {
        setData(response.data || {});
        setError('');
      })
      .catch((e) => setError(e.message || 'Could not load the dashboard'))
      .finally(() => setLoading(false));
  }, [token, period]);
  useEffect(() => {
    load();
    const id = setInterval(() => !document.hidden && load(), 120000);
    return () => clearInterval(id);
  }, [load]);
  function choosePeriod(key) {
    setPeriod(key);
    try {
      localStorage.setItem('webitof-dashboard-period', key);
    } catch {
      // Private windows may refuse storage; the choice still applies now.
    }
  }
  async function sendDigest() {
    setSending(true);
    try {
      const response = await api.dashboard.sendDigest(token);
      toast.success(response.message || 'Summary sent');
    } catch (e) {
      toast.error(e.message || 'Could not send the summary');
    } finally {
      setSending(false);
    }
  }

  if (error && !data) return <Card className="p-5 text-sm text-rose-600">{error}</Card>;
  if (!data) return <div className="grid gap-3 sm:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Card key={i} className="h-24 animate-pulse bg-[var(--surface-2)]" />)}</div>;

  const { money, expenses, clients, projects, amc, leads, quotations, followUps, team, hrm, system, sales, targets, projectProfit, todayList } = data;
  const anything = [money, expenses, clients, projects, amc, leads, quotations, followUps, team, hrm, system, sales].some(Boolean);
  if (!anything) return null;
  const m = usable(money) ? money : null;
  const p = m?.period;
  const trend = m?.trend || [];
  const spark = (key) => trend.map((row) => row[key]);
  const att = usable(hrm) ? hrm.attendance : null;
  const s = usable(sales) ? sales : null;
  const t = usable(targets) ? targets : null;
  const leadDelta = usable(leads) ? (leads.newPrevious ? Math.round(((leads.newInPeriod - leads.newPrevious) / leads.newPrevious) * 100) : leads.newInPeriod ? null : 0) : 0;

  return (
    <div className="space-y-4">
      <Hero data={data} period={period} setPeriod={choosePeriod} loading={loading} onRefresh={load} compact={compact} onDigest={data.admin ? sendDigest : null} sending={sending} />

      {/* Headline numbers for the chosen period, with change and a 12-month trend line */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8">
        {p ? (
          <>
            <Kpi label="Received" value={inr(p.current.received)} delta={p.change.received} sub={`Today ${inr(m.receivedToday)}`} icon={ArrowDownToLine} spark={spark('received')} series={SERIES.received} to="/app/payments" tone="text-emerald-600" />
            <Kpi label="Revenue" value={inr(p.current.revenue)} delta={p.change.revenue} sub={`Billed ${inr(p.current.invoiced)}`} icon={CircleDollarSign} spark={spark('revenue')} series={SERIES.revenue} to="/app/finance" />
            <Kpi label="Expense" value={inr(p.current.expense)} delta={p.change.expense} goodWhenUp={false} icon={Wallet} spark={spark('expense')} series={SERIES.expense} to="/app/expenses" tone="text-amber-600" />
            <Kpi label="Profit" value={inr(p.current.profit)} delta={p.change.profit} icon={TrendingUp} spark={spark('profit')} series={SERIES.profit} to="/app/finance" tone={p.current.profit < 0 ? 'text-rose-600' : 'text-emerald-600'} />
            <Kpi label="Outstanding" value={inr(m.outstanding)} sub={`${inr(m.overdueOutstanding)} overdue`} icon={ReceiptText} to="/app/invoices" tone="text-amber-600" />
          </>
        ) : null}
        {usable(leads) ? <Kpi label="New leads" value={count(leads.newInPeriod)} delta={leadDelta} sub={`${count(leads.wonInPeriod)} won`} icon={Target} to="/app/leads" /> : null}
        {usable(followUps) ? <Kpi label="Late follow-ups" value={count(followUps.overdue)} sub={`${count(followUps.dueToday)} due today`} icon={AlarmClock} tone={followUps.overdue ? 'text-rose-600' : 'text-emerald-600'} to="/app/follow-ups?view=today" /> : null}
        {att ? <Kpi label="Present today" value={`${count(att.counts?.present)} / ${count(att.total)}`} sub={`${count(att.counts?.late)} late · ${count(att.counts?.leave)} on leave`} icon={CalendarCheck} to="/app/hrm/attendance" /> : null}
      </div>

      {/* Today: one list, money due this week, leads with no next step */}
      {todayList || m?.dueThisWeek || s?.noNextStep ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {todayList ? (
            <Panel title={`Today's list (${todayList.length})`} icon={ListChecks} to="/app/follow-ups?view=today" linkLabel="Follow-ups">
              {todayList.length ? (
                <ol className="relative ml-3 space-y-2.5 border-l border-[var(--border)] pl-5">
                  {todayList.map((item) => {
                    const style = KIND_STYLE[item.kind] || KIND_STYLE['Follow-up'];
                    const Icon = style.icon;
                    const inner = (
                      <>
                        <span className={cn('absolute -left-[33px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-[var(--surface)]', style.cls)}>
                          <Icon size={12} />
                        </span>
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate font-semibold text-[var(--text-main)]">{item.title}</span>
                          <span className="shrink-0 tabular-nums text-[var(--text-muted)]">{item.time}</span>
                        </span>
                        <span className="block truncate text-[var(--text-muted)]">{item.kind}{item.sub ? ` · ${item.sub}` : ''}</span>
                      </>
                    );
                    return (
                      <li key={`${item.kind}${item.id}`} className="relative text-xs">
                        {item.to ? <Link to={item.to} className="block hover:opacity-80">{inner}</Link> : inner}
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <Empty>Nothing scheduled for today.</Empty>
              )}
            </Panel>
          ) : null}
          {m?.dueThisWeek ? (
            <Panel title="Money coming this week" icon={Waves} to="/app/invoices" linkLabel="Invoices">
              <p className="text-2xl font-bold tabular-nums text-[var(--text-main)]">{inr(m.dueThisWeek.total)}</p>
              <p className="mb-3 text-[11px] text-[var(--text-muted)]">{count(m.dueThisWeek.count)} invoice(s) due in the next 7 days · {inr(m.cashFlow?.overdueIn)} already overdue</p>
              {m.dueThisWeek.items.length ? (
                <ul className="space-y-1.5 text-xs">
                  {m.dueThisWeek.items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-2">
                      <Link to={`/app/invoices/${item.id}`} className="min-w-0 truncate text-[var(--text-main)] hover:text-[var(--primary)]">{item.client} <span className="text-[var(--text-muted)]">· {when(item.dueDate, false)}</span></Link>
                      <span className="shrink-0 font-semibold tabular-nums">{inr(item.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No invoices fall due this week.</Empty>
              )}
            </Panel>
          ) : null}
          {s?.noNextStep ? (
            <Panel title={`Leads with no next step (${s.noNextStep.count})`} icon={UserX} to="/app/leads" linkLabel="Leads">
              {s.noNextStep.items.length ? (
                <ul className="space-y-2 text-xs">
                  {s.noNextStep.items.map((lead) => (
                    <li key={lead.id}>
                      <Link to={`/app/leads/${lead.id}`} className="block truncate font-semibold text-[var(--text-main)] hover:text-[var(--primary)]">{lead.name}</Link>
                      <span className="block truncate text-[var(--text-muted)]">{[lead.status, lead.owner, when(lead.createdAt, false)].filter(Boolean).join(' · ')}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>Every open lead has a next follow-up. 👍</Empty>
              )}
            </Panel>
          ) : null}
        </div>
      ) : null}

      {/* Money over time and the next two months */}
      {money ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Revenue, expense & profit · 12 months" icon={TrendingUp} to="/app/finance" linkLabel="Finance" className="lg:col-span-2">
            {m ? <ComboChart months={trend} format={inr} /> : <Failed />}
          </Panel>
          <Panel title="Cash flow forecast" icon={Landmark} to="/app/finance" linkLabel="Finance">
            {m?.cashFlow ? (
              <div className="space-y-4">
                <Legend items={[{ label: 'Money in', className: SERIES.revenue.bg }, { label: 'Money out', className: SERIES.received.bg }]} />
                {m.cashFlow.windows.map((w) => {
                  const max = Math.max(1, w.inflow, w.outflow);
                  const rows = [
                    ['In', w.inflow, SERIES.revenue.bg, `Invoices ${inr(w.parts.invoicesIn)} · AMC billing ${inr(w.parts.amcIn)}`],
                    ['Out', w.outflow, SERIES.received.bg, `Expenses ${inr(w.parts.expensesOut)} · Vendors ${inr(w.parts.vendorsOut)} · Payroll ~${inr(w.parts.payrollOut)}`]
                  ];
                  return (
                    <div key={w.days}>
                      <div className="mb-1 flex items-baseline justify-between text-xs">
                        <span className="font-semibold text-[var(--text-main)]">Next {w.days} days</span>
                        <span className={cn('font-bold tabular-nums', w.net < 0 ? 'text-rose-600' : 'text-emerald-600')}>Net {inr(w.net)}</span>
                      </div>
                      {rows.map(([label, value, bg, title]) => (
                        <div key={label} className="mb-1 flex items-center gap-2 text-[11px]" title={title}>
                          <span className="w-7 text-[var(--text-muted)]">{label}</span>
                          <span className="h-3 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                            <span className={cn('block h-full rounded-full', bg)} style={{ width: `${Math.max(value ? 3 : 0, (value / max) * 100)}%` }} />
                          </span>
                          <span className="w-20 text-right font-semibold tabular-nums">{inr(value)}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
                <p className="text-[10px] text-[var(--text-muted)]">In: invoices falling due and AMC billing. Out: unpaid expenses, vendor bills and payroll at last month&apos;s level. Already-overdue invoices ({inr(m.cashFlow.overdueIn)}) are left out.</p>
              </div>
            ) : (
              <Failed />
            )}
          </Panel>
        </div>
      ) : null}

      {/* Sales insights */}
      {s ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title={`Sales funnel · ${data.period?.label}`} icon={Target} to="/app/leads" linkLabel="Leads">
            {s.funnel[0].count ? <Funnel steps={s.funnel} /> : <Empty>No leads in this period.</Empty>}
          </Panel>
          <Panel title="Lead sources · what they won" icon={PieChart} to="/app/leads" linkLabel="Leads">
            {s.sources.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                      <th className="pb-2 font-semibold">Source</th>
                      <th className="pb-2 font-semibold">Leads</th>
                      <th className="pb-2 text-right font-semibold">Won</th>
                      <th className="pb-2 text-right font-semibold">Won value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.sources.map((row) => {
                      const max = Math.max(1, ...s.sources.map((r) => r.leads));
                      return (
                        <tr key={row.source} className="border-t border-[var(--border)]">
                          <td className="py-1.5 pr-2 font-semibold text-[var(--text-main)]">{row.source}</td>
                          <td className="py-1.5 pr-2">
                            <span className="flex items-center gap-1.5">
                              <span className="h-1.5 w-14 overflow-hidden rounded-full bg-[var(--surface-2)]"><span className={cn('block h-full rounded-full', SERIES.revenue.bg)} style={{ width: `${(row.leads / max) * 100}%` }} /></span>
                              <span className="tabular-nums">{row.leads}</span>
                            </span>
                          </td>
                          <td className="py-1.5 text-right tabular-nums">{row.won}{row.conversion != null ? <span className="text-[var(--text-muted)]"> · {row.conversion}%</span> : null}</td>
                          <td className="py-1.5 text-right font-semibold tabular-nums">{inr(row.wonValue)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>No leads in this period.</Empty>
            )}
          </Panel>
          <Panel title="Why leads were lost" icon={ShieldAlert} to="/app/leads" linkLabel="Leads">
            {s.lostReasons.length ? <BarList items={s.lostReasons.map((row) => ({ label: row.reason, value: row.count, color: STATUS.serious }))} /> : <Empty>No leads lost in this period. 🎉</Empty>}
          </Panel>
        </div>
      ) : null}

      {/* Targets and response time */}
      {t || s ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {t ? (
            <Panel
              title={`Targets · ${t.month}`}
              icon={Trophy}
              className="lg:col-span-2"
              action={
                data.admin ? (
                  <button type="button" onClick={() => setEditTargets(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline">
                    <Pencil size={12} /> Set targets
                  </button>
                ) : null
              }
            >
              <div className="flex flex-wrap items-center gap-5">
                <div className="flex items-center gap-3">
                  <Ring value={t.company.percent} size={96} stroke={10} label={t.company.percent == null ? '—' : `${t.company.percent}%`} sub="company" />
                  <div className="text-xs">
                    <p className="text-[var(--text-muted)]">Won this month</p>
                    <p className="text-lg font-bold tabular-nums text-[var(--text-main)]">{inr(t.company.achieved)}</p>
                    <p className="text-[var(--text-muted)]">{t.company.target ? `of ${inr(t.company.target)} target` : 'No company target set'}</p>
                  </div>
                </div>
                <div className="flex flex-1 flex-wrap gap-4">
                  {t.people.length ? (
                    t.people.map((person) => (
                      <div key={person.id} className="flex w-[8.5rem] flex-col items-center text-center">
                        <Ring value={person.percent} size={64} stroke={7} label={person.percent == null ? '—' : `${person.percent}%`} />
                        <p className="mt-1 w-full truncate text-xs font-semibold text-[var(--text-main)]">{person.name}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">{inr(person.achieved)}{person.target ? ` / ${inr(person.target)}` : ''} · {person.deals} won</p>
                      </div>
                    ))
                  ) : (
                    <Empty>No deals won this month yet{data.admin ? ' — set targets to track progress.' : '.'}</Empty>
                  )}
                </div>
              </div>
            </Panel>
          ) : null}
          {s ? (
            <Panel title="First response time" icon={Timer} to="/app/call-history" linkLabel="Calls">
              <div className="mb-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums text-[var(--text-main)]">{s.response.averageHours == null ? '—' : `${s.response.averageHours} h`}</span>
                <span className="text-[11px] text-[var(--text-muted)]">average from a new lead to the first call or meeting</span>
              </div>
              {s.response.people.length ? (
                <BarList
                  items={s.response.people.map((row) => ({ label: row.name, value: row.averageHours ?? 0, color: row.averageHours == null ? '#94a3b8' : row.averageHours <= 2 ? STATUS.good : row.averageHours <= 24 ? STATUS.warning : STATUS.critical }))}
                  format={(v) => `${v} h`}
                />
              ) : null}
              {s.response.notContacted ? <p className="mt-2 text-[11px] text-rose-600">{s.response.notContacted} lead(s) in this period not contacted yet.</p> : null}
            </Panel>
          ) : null}
        </div>
      ) : null}

      {/* Receivables, biggest clients, GST */}
      {m ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Receivables aging" icon={ReceiptText} to="/app/invoices" linkLabel="Invoices">
            <StackBar parts={m.aging.map((b, i) => ({ label: b.label, value: b.amount, display: inr(b.amount), color: SEQUENTIAL[i] }))} />
            <ul className="mt-3 space-y-1 text-xs">
              {m.aging.map((b, i) => (
                <li key={b.key} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[var(--text-muted)]"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SEQUENTIAL[i] }} />{b.label}</span>
                  <span className="font-semibold tabular-nums">{inr(b.amount)} <span className="font-normal text-[var(--text-muted)]">· {b.count}</span></span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Top clients · this FY" icon={Building2} to="/app/clients" linkLabel="Clients">
            {m.topClients?.length ? (
              <div className="space-y-2">
                <Legend items={[{ label: 'Paid', className: SERIES.expense.bg }, { label: 'Due', className: SERIES.due.bg }]} />
                {m.topClients.map((row) => (
                  <Link key={row.clientId} to={`/app/clients/${row.clientId}`} className="block text-xs hover:opacity-80">
                    <span className="flex justify-between gap-2"><span className="truncate font-semibold text-[var(--text-main)]">{row.name}</span><span className="shrink-0 tabular-nums">{inr(row.billed)}</span></span>
                    <StackBar height={6} parts={[{ label: 'Paid', value: row.paid, display: inr(row.paid), className: SERIES.expense.bg }, { label: 'Due', value: row.due, display: inr(row.due), className: SERIES.due.bg }]} />
                  </Link>
                ))}
              </div>
            ) : (
              <Empty>No invoices this financial year yet.</Empty>
            )}
          </Panel>
          <Panel title={`GST · ${m.gst.month}`} icon={Landmark} to="/app/finance" linkLabel="Finance">
            <div className="flex items-center gap-4">
              <Ring
                value={Math.max(0, Math.min(100, Math.round(((30 - Math.max(0, m.gst.daysLeft)) / 30) * 100)))}
                color={m.gst.daysLeft <= 5 ? STATUS.critical : m.gst.daysLeft <= 10 ? STATUS.warning : STATUS.good}
                size={84}
                stroke={9}
                label={`${Math.max(0, m.gst.daysLeft)}d`}
                sub="left"
              />
              <div className="min-w-0 text-xs">
                <p className="text-[var(--text-muted)]">Net GST to pay</p>
                <p className="text-xl font-bold tabular-nums text-[var(--text-main)]">{inr(Math.max(0, m.gst.net))}</p>
                <p className="text-[var(--text-muted)]">GSTR-3B due {when(m.gst.dueDate, false)}</p>
              </div>
            </div>
            <div className="mt-3 border-t border-[var(--border)] pt-2">
              <Stats rows={[['Output GST', inr(m.gst.output)], ['Input credit', inr(m.gst.input)]]} />
            </div>
          </Panel>
        </div>
      ) : null}

      {/* Every module at a glance */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {leads ? (
          <Panel title="Leads" icon={Target} to="/app/leads">
            {usable(leads) ? <Stats rows={[['Open', count(leads.open)], ['New this month', count(leads.newThisMonth)], ['Won this month', count(leads.wonThisMonth), 'text-emerald-600'], ['Conversion', leads.conversionRate == null ? '—' : `${leads.conversionRate}%`], ['Hot', count(leads.hot), leads.hot ? 'text-rose-600' : ''], ['Pipeline value', inr(leads.pipelineValue)]]} /> : <Failed />}
          </Panel>
        ) : null}
        {followUps ? (
          <Panel title="Follow-ups" icon={ListChecks} to="/app/follow-ups?view=today">
            {usable(followUps) ? <Stats rows={[['Overdue', count(followUps.overdue), followUps.overdue ? 'text-rose-600' : ''], ['Due today', count(followUps.dueToday)], ['Upcoming', count(followUps.upcoming)], ['Open', count(followUps.open)], ['Done this week', count(followUps.doneThisWeek), 'text-emerald-600']]} /> : <Failed />}
          </Panel>
        ) : null}
        {quotations ? (
          <Panel title="Quotations" icon={FileSignature} to="/app/quotations">
            {usable(quotations) ? <Stats rows={[['Total', count(quotations.total)], ['This month', count(quotations.thisMonth)], ['Awaiting reply', count(quotations.awaiting)], ['Awaiting value', inr(quotations.awaitingValue)], ['Accepted value', inr(quotations.acceptedValue), 'text-emerald-600']]} /> : <Failed />}
          </Panel>
        ) : null}
        {clients ? (
          <Panel title="Clients" icon={Building2} to="/app/clients">
            {usable(clients) ? <Stats rows={[['Total', count(clients.total)], ['New this month', count(clients.newThisMonth)], ['With dues', count(clients.withDues), clients.withDues ? 'text-amber-600' : '']]} /> : <Failed />}
          </Panel>
        ) : null}
        {projects ? (
          <Panel title="Projects" icon={BriefcaseBusiness} to="/app/projects">
            {usable(projects) ? <Stats rows={[['Active', count(projects.active)], ['Completed', count(projects.completed), 'text-emerald-600'], ['Past deadline', count(projects.overdue), projects.overdue ? 'text-rose-600' : ''], ['Active value', inr(projects.activeValue)]]} /> : <Failed />}
          </Panel>
        ) : null}
        {m ? (
          <Panel title="Invoices" icon={ReceiptText} to="/app/invoices">
            <Stats rows={[['This month', count(m.invoices.thisMonth)], ['Invoiced (month)', inr(m.invoicedThisMonth)], ['Unpaid', `${count(m.invoices.unpaid)} · ${inr(m.invoices.unpaidAmount)}`], ['Overdue', count(m.invoices.overdue), m.invoices.overdue ? 'text-rose-600' : ''], ['Partly paid', count(m.invoices.partiallyPaid)], ['Drafts', count(m.invoices.drafts)]]} />
          </Panel>
        ) : null}
        {m ? (
          <Panel title="Payments" icon={Wallet} to="/app/payments">
            <Stats rows={[['Today', inr(m.receivedToday)], ['This month', inr(m.receivedThisMonth)], ['Payments (month)', count(m.payments.thisMonth)], ['Last month', inr(m.receivedLastMonth)]]} />
          </Panel>
        ) : null}
        {m ? (
          <Panel title="Finance" icon={CircleDollarSign} to="/app/finance">
            <Stats rows={[['Cash in bank', inr(m.cashInBank)], ['Payables', inr(m.payables)], ['Revenue (month)', inr(m.revenueThisMonth)], ['Profit (month)', inr(m.profitThisMonth), m.profitThisMonth < 0 ? 'text-rose-600' : 'text-emerald-600']]} />
          </Panel>
        ) : null}
        {expenses ? (
          <Panel title="Expenses" icon={ClipboardList} to="/app/expenses">
            {usable(expenses) ? (
              <>
                <Stats rows={[['This month', inr(expenses.thisMonth)], ['Entries', count(expenses.count)], ['Awaiting approval', count(expenses.pendingApproval), expenses.pendingApproval ? 'text-amber-600' : ''], ['Unpaid', inr(expenses.unpaid)]]} />
                {expenses.byType?.length ? <div className="mt-3 border-t border-[var(--border)] pt-2"><BarList items={expenses.byType.map((row) => ({ label: row.type, value: row.amount }))} format={inr} className={SERIES.expense.bg} /></div> : null}
              </>
            ) : (
              <Failed />
            )}
          </Panel>
        ) : null}
        {amc ? (
          <Panel title="AMC & renewals" icon={CalendarClock} to="/app/amc" linkLabel="AMC">
            {usable(amc) ? <Stats rows={[['Active AMC', count(amc.active)], ['AMC value', inr(amc.value)], ['Expiring in 30 days', count(amc.expiringSoon), amc.expiringSoon ? 'text-amber-600' : ''], ['Expired', count(amc.expired), amc.expired ? 'text-rose-600' : ''], ['Renewals due (30d)', count(amc.renewalsDueSoon)], ['Renewals overdue', count(amc.renewalsOverdue), amc.renewalsOverdue ? 'text-rose-600' : '']]} /> : <Failed />}
          </Panel>
        ) : null}
      </div>

      {/* HR: attendance, people, approvals, alerts */}
      {usable(hrm) ? (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            {att ? (
              <Panel title="Attendance today" icon={CalendarCheck} to="/app/hrm/attendance">
                <Donut
                  items={[
                    { label: 'On time', value: Math.max(0, (att.counts?.present || 0) - (att.counts?.late || 0)), color: STATUS.good },
                    { label: 'Late', value: att.counts?.late || 0, color: STATUS.warning },
                    { label: 'On leave', value: att.counts?.leave || 0, color: '#519ced' },
                    { label: 'Absent', value: att.counts?.absent || 0, color: STATUS.critical },
                    { label: 'Not clocked in', value: att.counts?.notIn || 0, color: '#94a3b8' }
                  ]}
                  centerLabel={`${att.counts?.present || 0}/${att.total || 0}`}
                  centerSub="present"
                />
              </Panel>
            ) : null}
            {hrm.utilization ? (
              <Panel title="Team utilization" icon={Users} to="/app/hrm/allocations" linkLabel="Allocations">
                <div className="flex items-center gap-4">
                  <Ring value={hrm.utilization.average} size={84} stroke={9} color="#257de0" />
                  <div className="text-xs">
                    <p className="text-[var(--text-muted)]">Average allocation</p>
                    <p className="font-semibold text-[var(--text-main)]">{hrm.utilization.total} people · {hrm.utilization.benchCount} free</p>
                    <p className="text-[var(--text-muted)]">{hrm.utilization.over.length} over-booked</p>
                  </div>
                </div>
                {hrm.utilization.over.length || hrm.utilization.bench.length ? (
                  <ul className="mt-3 space-y-1 border-t border-[var(--border)] pt-2 text-xs">
                    {hrm.utilization.over.map((row) => <li key={row.employeeId} className="flex justify-between"><span>{row.employee}</span><span className="font-semibold text-rose-600">{row.percent}%</span></li>)}
                    {hrm.utilization.bench.map((row) => <li key={row.employeeId} className="flex justify-between"><span>{row.employee}</span><span className="text-[var(--text-muted)]">free</span></li>)}
                  </ul>
                ) : null}
              </Panel>
            ) : null}
            {hrm.reports ? (
              <Panel title="Work reports · yesterday" icon={ClipboardList} to="/app/hrm/work-reports" linkLabel="Reports">
                <div className="flex items-center gap-4">
                  <Ring value={hrm.reports.percent} size={84} stroke={9} />
                  <div className="text-xs">
                    <p className="text-lg font-bold tabular-nums text-[var(--text-main)]">{hrm.reports.reported} / {hrm.reports.worked}</p>
                    <p className="text-[var(--text-muted)]">people who worked on {when(hrm.reports.date, false)} sent their report</p>
                  </div>
                </div>
              </Panel>
            ) : null}
          </div>
          {hrm.approvals || hrm.alerts ? (
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
        </>
      ) : null}

      {/* Sales team and pipeline */}
      {team || leads ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {team ? (
            <Panel title={`Team performance · ${data.period?.label}`} icon={Users} to="/app/leads" linkLabel="Leads" className="lg:col-span-2">
              {usable(team) ? (
                team.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[30rem] text-xs">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                          <th className="pb-2 font-semibold">Person</th>
                          <th className="pb-2 text-right font-semibold">Open leads</th>
                          <th className="pb-2 text-right font-semibold">New</th>
                          <th className="pb-2 text-right font-semibold">Won</th>
                          <th className="pb-2 text-right font-semibold">Follow-ups late</th>
                          <th className="pb-2 text-right font-semibold">Done (7 days)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {team.map((row) => (
                          <tr key={row.id}>
                            <td className="py-1.5">
                              <span className="flex items-center gap-2 font-semibold text-[var(--text-main)]">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[10px] font-bold text-[var(--primary)]">
                                  {String(row.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2)}
                                </span>
                                {row.name}
                              </span>
                            </td>
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
                  <Empty>No assigned leads or follow-ups in this period.</Empty>
                )
              ) : (
                <Failed />
              )}
            </Panel>
          ) : null}
          {usable(leads) ? (
            <Panel title="Leads by status" icon={PieChart} to="/app/leads" className={team ? '' : 'lg:col-span-3'}>
              <Donut items={(leads.byStatus || []).map((row) => ({ label: row.status, value: row.count, color: row.color || '#94a3b8' }))} centerSub="leads" />
            </Panel>
          ) : null}
        </div>
      ) : null}

      {/* Project profitability */}
      {usable(projectProfit) && projectProfit.length ? (
        <Panel title="Project profitability" icon={BriefcaseBusiness} to="/app/projects" linkLabel="Projects">
          <Legend items={[{ label: 'Value', className: SERIES.revenue.bg }, { label: 'Cost (expenses, vendors, team time)', className: SERIES.received.bg }]} />
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {projectProfit.map((project) => {
              const max = Math.max(1, project.value, project.cost);
              const color = marginColor(project.margin);
              return (
                <Link key={project.id} to={`/app/projects/${project.id}`} className="block rounded-xl border border-[var(--border)] p-3 text-xs hover:border-[var(--primary)]/40">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-[var(--text-main)]">{project.title}</span>
                    <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${color}22`, color }}>
                      {project.margin == null ? 'no value set' : `${project.margin}% margin`}
                    </span>
                  </span>
                  {[['Value', project.value, SERIES.revenue.bg], ['Cost', project.cost, SERIES.received.bg]].map(([label, value, bg]) => (
                    <span key={label} className="mt-1.5 flex items-center gap-2">
                      <span className="w-9 text-[var(--text-muted)]">{label}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]"><span className={cn('block h-full rounded-full', bg)} style={{ width: `${Math.max(value ? 3 : 0, (value / max) * 100)}%` }} /></span>
                      <span className="w-16 text-right tabular-nums">{inr(value)}</span>
                    </span>
                  ))}
                  <span className="mt-1 block text-[10px] text-[var(--text-muted)]">{project.hours} team hours logged</span>
                </Link>
              );
            })}
          </div>
        </Panel>
      ) : null}

      {/* What is late, what is coming, system */}
      {followUps || projects || amc || system ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {usable(followUps) ? (
            <Panel title="Overdue follow-ups" icon={AlarmClock} to="/app/follow-ups?view=today">
              {followUps.overdueItems?.length ? (
                <ul className="space-y-2 text-xs">
                  {followUps.overdueItems.map((item) => (
                    <li key={item.id} className="flex gap-2">
                      <Clock size={13} className="mt-0.5 shrink-0 text-rose-500" />
                      <span className="min-w-0">
                        <Link to={`/app/follow-ups?focus=${item.id}`} className="block truncate font-semibold text-[var(--text-main)] hover:text-[var(--primary)]">{item.title}</Link>
                        <span className="block truncate text-[var(--text-muted)]">{[item.related, item.assignedTo, when(item.dueAt)].filter(Boolean).join(' · ')}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>Nothing overdue. 🎉</Empty>
              )}
            </Panel>
          ) : null}
          {usable(projects) || usable(amc) ? (
            <Panel title="Coming due" icon={CalendarClock}>
              {[
                ...(usable(projects) ? projects.late.map((pr) => ({ key: `p${pr.id}`, to: `/app/projects/${pr.id}`, title: pr.title, meta: `Deadline ${pr.deadline}`, late: true })) : []),
                ...(usable(amc) ? amc.upcoming.map((a) => ({ key: `${a.kind}${a.id}`, to: a.kind === 'AMC' ? `/app/amc/${a.id}` : '/app/renewals', title: `${a.kind}: ${a.title}`, meta: `${a.date} · ${inr(a.amount)}`, late: a.date < data.today })) : [])
              ]
                .slice(0, 6)
                .map((row, index, list) => (
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
                  <span className="text-[var(--text-main)]">Database backup: {system.backup.healthy ? 'OK' : 'needs attention'}</span>
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

      {t && data.admin ? (
        <TargetsModal open={editTargets} onClose={() => setEditTargets(false)} token={token} people={(usable(team) ? team : []).map((row) => ({ id: row.id, name: row.name }))} onSaved={load} />
      ) : null}
    </div>
  );
}
