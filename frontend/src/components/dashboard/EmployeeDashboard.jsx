import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlarmClock,
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  CalendarHeart,
  CalendarOff,
  CheckCircle2,
  ClipboardList,
  Flame,
  ListChecks,
  PhoneCall,
  RefreshCw,
  Target,
  Trophy,
  UserPlus,
  Users
} from 'lucide-react';
import { api } from '../../api/client';
import { Card } from '../ui/Card';
import { cn } from '../../lib/cn';
import { HrmMyDay } from '../../pages/hrm/HrmMyDay';

const TZ = 'Asia/Kolkata';

function greeting() {
  const hour = Number(new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: 'numeric', hour12: false }).format(new Date()));
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function longDate() {
  return new Intl.DateTimeFormat('en-IN', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
}

function timeOf(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(date);
}

function dayOf(value) {
  if (!value) return '';
  const date = new Date(String(value).length === 10 ? `${value}T00:00:00+05:30` : value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: 'numeric', month: 'short', weekday: 'short' }).format(date);
}

function ago(value) {
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms)) return '';
  const min = Math.round(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function Panel({ title, icon: Icon, action, className = '', children }) {
  return (
    <Card className={cn('flex min-w-0 flex-col p-4', className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
          {Icon ? <Icon size={15} className="text-[var(--primary)]" /> : null}
          {title}
        </h3>
        {action}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </Card>
  );
}

function MoreLink({ to, children = 'View all' }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline">
      {children} <ArrowRight size={12} />
    </Link>
  );
}

function Empty({ children }) {
  return <p className="rounded-xl border border-dashed border-[var(--border)] px-3 py-5 text-center text-xs text-[var(--text-muted)]">{children}</p>;
}

function Stat({ label, value, tone = 'default', to }) {
  const tones = {
    default: 'text-[var(--text-main)]',
    danger: 'text-rose-600 dark:text-rose-400',
    warning: 'text-amber-600 dark:text-amber-400',
    success: 'text-emerald-600 dark:text-emerald-400',
    primary: 'text-[var(--primary)]'
  };
  const body = (
    <>
      <div className={cn('text-xl font-bold tabular-nums', tones[tone])}>{value ?? 0}</div>
      <div className="text-[11px] text-[var(--text-muted)]">{label}</div>
    </>
  );
  const className = 'rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2';
  return to ? <Link to={to} className={cn(className, 'hover:border-[var(--primary)]')}>{body}</Link> : <div className={className}>{body}</div>;
}

// Follow-ups, HRM tasks and meetings in one time-ordered list.
function Agenda({ data }) {
  const rows = [];
  for (const item of data.followUps?.items || []) {
    rows.push({
      key: `f-${item.id}`,
      icon: AlarmClock,
      title: item.title,
      sub: [item.relatedLabel, item.priority].filter(Boolean).join(' · '),
      when: timeOf(item.dueAt),
      sort: item.dueAt || '',
      overdue: item.status === 'Overdue',
      to: '/app/follow-ups?view=today'
    });
  }
  for (const item of data.meetings || []) {
    rows.push({
      key: `m-${item.id}`,
      icon: CalendarDays,
      title: item.title,
      sub: [item.type, item.location].filter(Boolean).join(' · '),
      when: item.startTime || 'Today',
      sort: `${data.date}T${item.startTime || '23:59'}`,
      to: item.leadId ? `/app/leads/${item.leadId}` : item.projectId ? `/app/projects/${item.projectId}` : item.clientId ? `/app/clients/${item.clientId}` : '/app/follow-ups?view=today'
    });
  }
  for (const item of data.tasks?.items || []) {
    const due = item.deadline ? String(item.deadline).slice(0, 10) : '';
    rows.push({
      key: `t-${item.id}`,
      icon: ListChecks,
      title: item.title,
      sub: [item.projectTitle, item.priority, item.status].filter(Boolean).join(' · '),
      when: due ? dayOf(due) : 'No deadline',
      sort: due ? `${due}T23:59` : '9999',
      overdue: Boolean(due && due < data.date),
      to: item.projectId ? `/app/projects/${item.projectId}` : '/app/projects'
    });
  }
  rows.sort((a, b) => Number(b.overdue) - Number(a.overdue) || String(a.sort).localeCompare(String(b.sort)));
  if (!rows.length) return <Empty>Nothing due today. 🎉</Empty>;
  return (
    <ul className="max-h-[22rem] divide-y divide-[var(--border)] overflow-y-auto pr-1">
      {rows.map((row) => (
        <li key={row.key}>
          <Link to={row.to} className="flex items-center gap-3 py-2 hover:bg-[var(--hover-bg)] rounded-lg px-1.5">
            <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', row.overdue ? 'bg-rose-500/10 text-rose-600' : 'bg-[var(--primary-subtle)] text-[var(--primary)]')}>
              <row.icon size={15} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-[var(--text-main)]">{row.title}</span>
              {row.sub ? <span className="block truncate text-[11px] text-[var(--text-muted)]">{row.sub}</span> : null}
            </span>
            <span className={cn('shrink-0 text-[11px] font-semibold tabular-nums', row.overdue ? 'text-rose-600' : 'text-[var(--text-muted)]')}>
              {row.overdue ? 'Overdue' : row.when}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Leads({ leads }) {
  const max = Math.max(1, ...leads.byStatus.map((row) => row.count));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="My leads" value={leads.total} to="/app/leads" />
        <Stat label="Hot" value={leads.hot} tone="danger" />
        <Stat label="New today" value={leads.newToday} tone="primary" />
        <Stat label="No follow-up set" value={leads.noFollowUp} tone={leads.noFollowUp ? 'warning' : 'default'} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">By status</div>
          {leads.byStatus.length ? (
            <ul className="space-y-1.5">
              {leads.byStatus.slice(0, 8).map((row) => (
                <li key={row.status} className="flex items-center gap-2 text-[12px]">
                  <span className="w-28 shrink-0 truncate text-[var(--text-main)]">{row.status}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                    <span className="block h-full rounded-full" style={{ width: `${(row.count / max) * 100}%`, backgroundColor: row.color || 'var(--primary)' }} />
                  </span>
                  <span className="w-6 text-right tabular-nums text-[var(--text-muted)]">{row.count}</span>
                </li>
              ))}
            </ul>
          ) : <Empty>No leads assigned to you yet.</Empty>}
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Needs attention</div>
          {leads.items.length ? (
            <ul className="space-y-1">
              {leads.items.map((lead) => (
                <li key={lead.id}>
                  <Link to={`/app/leads/${lead.id}`} className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-[var(--hover-bg)]">
                    {String(lead.temperature || '').toLowerCase() === 'hot' ? <Flame size={13} className="shrink-0 text-rose-500" /> : <Target size={13} className="shrink-0 text-[var(--text-muted)]" />}
                    <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--text-main)]">{lead.company || lead.name}</span>
                    <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{lead.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <Empty>All caught up.</Empty>}
        </div>
      </div>
    </div>
  );
}

function LeaveHolidays({ hrm }) {
  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          <span>Leave balance</span>
          <span className="normal-case tracking-normal">{hrm.leave?.balance ?? 0} days</span>
        </div>
        {/* Only leave the employee can still take; zero-balance types would just fill the card. */}
        {hrm.leave?.types?.some((type) => Number(type.balance) > 0) ? (
          <div className="flex flex-wrap gap-1.5">
            {hrm.leave.types.filter((type) => Number(type.balance) > 0).map((type) => (
              <span key={type.name} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-[11px] text-[var(--text-main)]">
                {type.name} <b className="tabular-nums">{type.balance}</b>
              </span>
            ))}
          </div>
        ) : <p className="text-xs text-[var(--text-muted)]">No leave balance left.</p>}
        {hrm.pendingRequests ? (
          <p className="mt-2 text-[11px] text-amber-600">{hrm.pendingRequests} request{hrm.pendingRequests === 1 ? '' : 's'} waiting for approval</p>
        ) : null}
      </div>
      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Upcoming holidays</div>
        {hrm.holidays?.length ? (
          <ul className="space-y-1">
            {hrm.holidays.map((holiday) => (
              <li key={`${holiday.date}-${holiday.name}`} className="flex items-center justify-between gap-2 text-[12px]">
                <span className="flex min-w-0 items-center gap-1.5 text-[var(--text-main)]">
                  <CalendarHeart size={13} className="shrink-0 text-rose-500" />
                  <span className="truncate">{holiday.name}</span>
                  {holiday.optional ? <span className="text-[10px] text-[var(--text-muted)]">(optional)</span> : null}
                </span>
                <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{dayOf(holiday.date)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-xs text-[var(--text-muted)]">No upcoming holidays.</p>}
      </div>
      <Link to="/app/hrm/leave" className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90">
        <CalendarOff size={14} /> Apply leave
      </Link>
    </div>
  );
}

function ThisMonth({ hrm, performance }) {
  const month = hrm?.month;
  const reports = hrm?.workReports || {};
  return (
    <div className="space-y-3">
      {month ? (
        <div className="grid grid-cols-4 gap-2">
          <Stat label="Present" value={month.present} tone="success" />
          <Stat label="Absent" value={month.absent} tone={month.absent ? 'danger' : 'default'} />
          <Stat label="Leave" value={month.leave} />
          <Stat label="Half day" value={month.halfDay} />
        </div>
      ) : null}
      {performance && !performance.error ? (
        <ul className="space-y-1.5 text-[12px]">
          {performance.leadsWon != null ? (
            <li className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-[var(--text-main)]"><Trophy size={13} className="text-amber-500" /> Leads won</span><b className="tabular-nums">{performance.leadsWon}</b></li>
          ) : null}
          {performance.leadsAssigned != null ? (
            <li className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-[var(--text-main)]"><Users size={13} className="text-[var(--primary)]" /> New leads assigned</span><b className="tabular-nums">{performance.leadsAssigned}</b></li>
          ) : null}
          {performance.followUpsDone != null ? (
            <li className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-[var(--text-main)]"><CheckCircle2 size={13} className="text-emerald-500" /> Follow-ups done</span><b className="tabular-nums">{performance.followUpsDone}{performance.followUpsDone ? <span className="font-normal text-[var(--text-muted)]"> · {Math.round((performance.followUpsOnTime / performance.followUpsDone) * 100)}% on time</span> : null}</b></li>
          ) : null}
          {performance.calls != null ? (
            <li className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-[var(--text-main)]"><PhoneCall size={13} className="text-sky-500" /> Calls</span><b className="tabular-nums">{performance.calls}<span className="font-normal text-[var(--text-muted)]"> · {performance.callMinutes} min</span></b></li>
          ) : null}
          {hrm ? (
            <li className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-[var(--text-main)]"><ClipboardList size={13} className="text-violet-500" /> Work reports</span><b className="tabular-nums">{reports.total || 0}{reports.pending ? <span className="font-normal text-amber-600"> · {reports.pending} awaiting review</span> : null}</b></li>
          ) : null}
        </ul>
      ) : null}
      {!month && (!performance || performance.error) ? <Empty>No activity this month yet.</Empty> : null}
    </div>
  );
}

function Notifications({ notifications }) {
  if (!notifications.items.length) return <Empty>No notifications.</Empty>;
  return (
    <ul className="space-y-1">
      {notifications.items.map((item) => (
        <li key={item.id} className="flex gap-2 rounded-lg px-1.5 py-1.5">
          <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', item.isRead ? 'bg-transparent' : 'bg-[var(--primary)]')} />
          <span className="min-w-0 flex-1">
            <span className={cn('block truncate text-[12px]', item.isRead ? 'text-[var(--text-muted)]' : 'font-medium text-[var(--text-main)]')}>{item.title}</span>
            {item.message ? <span className="block truncate text-[11px] text-[var(--text-muted)]">{item.message}</span> : null}
          </span>
          <span className="shrink-0 text-[10px] text-[var(--text-muted)]">{ago(item.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}

function QuickActions({ actions }) {
  if (!actions.length) return <Empty>No shortcuts for your role.</Empty>;
  return (
    <div className="grid grid-cols-3 gap-2">
      {actions.map((action) => (
        <Link
          key={action.label}
          to={action.link}
          className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2.5 text-center transition-all hover:border-[var(--primary)] hover:bg-[var(--hover-bg)]"
        >
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg border', action.bg, action.color)}>
            <action.icon size={15} />
          </span>
          <span className="text-[11px] font-semibold text-[var(--text-main)]">{action.label}</span>
        </Link>
      ))}
    </div>
  );
}

const usable = (section) => section && !section.error;

/**
 * Dashboard for users without report access: their own day, leads, leave and month.
 * Data: GET /dashboard/me (one call; each section is permission-checked on the server).
 */
export function EmployeeDashboard({ token, quickActions = [], hasPermission }) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await api.dashboard.me(token);
      setData(response.data);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const canSelfService = hasPermission('hrm.self_service');
  const showAttendance = Boolean(data?.user?.hasEmployeeProfile && canSelfService);
  const hrm = usable(data?.hrm) ? data.hrm : null;

  const actions = [
    ...quickActions,
    ...(hrm ? [
      { label: 'Apply leave', icon: CalendarOff, link: '/app/hrm/leave', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800' },
      { label: 'Work report', icon: ClipboardList, link: '/app/hrm/work-reports', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800' }
    ] : []),
    ...(hasPermission('calls.read') ? [
      { label: 'Log call', icon: PhoneCall, link: '/app/call-history', color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800' }
    ] : [])
  ];

  const agendaCounts = data ? {
    overdue: (data.followUps?.overdue || 0) + (data.tasks?.overdue || 0),
    today: (data.followUps?.dueToday || 0) + (data.meetings?.length || 0)
  } : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-main)]">
            {greeting()}{data?.user?.name ? `, ${data.user.name.split(' ')[0]}` : ''}
          </h2>
          <p className="text-xs text-[var(--text-muted)]">{longDate()}</p>
        </div>
        <div className="flex items-center gap-2">
          {agendaCounts?.overdue ? (
            <span className="rounded-full bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-600">{agendaCounts.overdue} overdue</span>
          ) : null}
          {agendaCounts ? (
            <span className="rounded-full bg-[var(--primary-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--primary)]">{agendaCounts.today} due today</span>
          ) : null}
          <button
            type="button"
            onClick={load}
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)]"
            title="Refresh"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {failed && !data ? (
        <Card className="p-4 text-sm text-rose-600">
          Your dashboard could not be loaded. <button type="button" className="font-semibold underline" onClick={load}>Retry</button>
        </Card>
      ) : null}

      {!data && !failed ? (
        <div className="grid gap-4 lg:grid-cols-12">
          {[4, 8, 8, 4].map((span, index) => (
            <Card key={index} className={cn('h-44 animate-pulse bg-[var(--surface-2)]', span === 4 ? 'lg:col-span-4' : 'lg:col-span-8')} />
          ))}
        </div>
      ) : null}

      {data ? (
        <div className="grid items-start gap-4 lg:grid-cols-12">
          {showAttendance ? (
            <div className="space-y-2 lg:col-span-4">
              <HrmMyDay token={token} compact />
              <div className="text-right"><MoreLink to="/app/hrm/my-day">Open My day</MoreLink></div>
            </div>
          ) : null}

          <Panel
            title="Today's work"
            icon={BriefcaseBusiness}
            className={showAttendance ? 'lg:col-span-8' : 'lg:col-span-12'}
            action={data.followUps ? <MoreLink to="/app/follow-ups?view=today">Follow-ups</MoreLink> : null}
          >
            <Agenda data={data} />
          </Panel>

          {usable(data.leads) ? (
            <Panel title="My leads" icon={Target} className={hrm ? 'lg:col-span-8' : 'lg:col-span-12'} action={<MoreLink to="/app/leads" />}>
              <Leads leads={data.leads} />
            </Panel>
          ) : null}

          {hrm ? (
            <Panel title="Leave & holidays" icon={CalendarOff} className={usable(data.leads) ? 'lg:col-span-4' : 'lg:col-span-6'} action={<MoreLink to="/app/hrm/leave" />}>
              <LeaveHolidays hrm={hrm} />
            </Panel>
          ) : null}

          <Panel title="This month" icon={Trophy} className="lg:col-span-4">
            <ThisMonth hrm={hrm} performance={data.performance} />
          </Panel>

          {usable(data.notifications) ? (
            <Panel
              title={`Notifications${data.notifications.unread ? ` (${data.notifications.unread})` : ''}`}
              icon={Bell}
              className="lg:col-span-4"
              action={<MoreLink to="/app/notifications" />}
            >
              <Notifications notifications={data.notifications} />
            </Panel>
          ) : null}

          <Panel title="Quick actions" icon={UserPlus} className="lg:col-span-4">
            <QuickActions actions={actions} />
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
