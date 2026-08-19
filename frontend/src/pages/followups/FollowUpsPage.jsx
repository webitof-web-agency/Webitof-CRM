import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, ArrowRight, BarChart3, BellRing, CalendarDays, CheckCircle2,
  ChevronRight, CircleAlert, Clock3, Columns3, ExternalLink, Filter, Flame, LayoutList,
  Loader2, Mail, MessageCircle, MoreHorizontal, Phone, Play, Plus, RefreshCcw, Search,
  Settings2, ShieldAlert, Sparkles, TimerReset, UserRound, UsersRound, Workflow
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input, Textarea } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { CompleteFollowUpModal, FollowUpFormModal, RescheduleFollowUpModal } from '../../components/followups/FollowUpModals';

const tabs = [
  { id: 'today', label: 'Today', icon: Clock3 },
  { id: 'list', label: 'List', icon: LayoutList },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'kanban', label: 'Kanban', icon: Columns3 },
  { id: 'attention', label: 'Attention', icon: ShieldAlert },
  { id: 'workload', label: 'Workload', icon: UsersRound },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'automation', label: 'Automation', icon: Workflow },
  { id: 'settings', label: 'Settings', icon: Settings2 }
];

const terminalStatuses = new Set(['Completed', 'Cancelled', 'Failed', 'Auto-Closed']);

function formatDateTime(value) {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatRelativeSeconds(seconds = 0) {
  const value = Number(seconds || 0);
  if (value < 60) return `${value}s`;
  if (value < 3600) return `${Math.floor(value / 60)}m`;
  if (value < 86400) return `${Math.floor(value / 3600)}h ${Math.floor((value % 3600) / 60)}m`;
  return `${Math.floor(value / 86400)}d ${Math.floor((value % 86400) / 3600)}h`;
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

function priorityClasses(priority) {
  if (priority === 'Critical') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (priority === 'High') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (priority === 'Low') return 'border-slate-200 bg-slate-50 text-slate-600';
  return 'border-blue-200 bg-blue-50 text-blue-700';
}

function statusClasses(status) {
  if (status === 'Overdue' || status === 'Escalated') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (status === 'Completed' || status === 'Auto-Closed') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Due Today' || status === 'In Progress') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (status.startsWith('Waiting')) return 'border-violet-200 bg-violet-50 text-violet-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function entityRoute(item) {
  const type = String(item.relatedEntityType || '').toLowerCase();
  if (['lead', 'opportunity', 'deal'].includes(type)) return `/app/leads/${item.relatedEntityId}`;
  if (type === 'quotation' || type === 'proposal') return item.leadId ? `/app/leads/${item.leadId}` : '/app/leads';
  if (type === 'client') return `/app/clients/${item.relatedEntityId}`;
  if (type === 'project') return `/app/projects/${item.relatedEntityId}`;
  if (type === 'invoice') return `/app/invoices/${item.relatedEntityId}`;
  if (type === 'payment') return `/app/payments/${item.relatedEntityId}`;
  if (type === 'amc') return `/app/amc/${item.relatedEntityId}`;
  if (type === 'renewal') return '/app/renewals';
  return '';
}

function Metric({ label, value, helper, icon: Icon, tone = 'blue', onClick }) {
  const tones = { blue: 'bg-blue-50 text-blue-600', rose: 'bg-rose-50 text-rose-600', amber: 'bg-amber-50 text-amber-600', emerald: 'bg-emerald-50 text-emerald-600', violet: 'bg-violet-50 text-violet-600' };
  return (
    <button type="button" onClick={onClick} className="text-left disabled:cursor-default" disabled={!onClick}>
      <Card className="h-full min-w-[170px] rounded-2xl border-slate-100 p-4 shadow-sm transition hover:border-slate-200">
        <div className="flex items-center gap-3"><span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tones[tone]}`}><Icon size={19} /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">{label}</p><p className="text-2xl font-bold text-slate-900">{value ?? 0}</p></div></div>
        {helper ? <p className="mt-2 text-xs text-slate-400">{helper}</p> : null}
      </Card>
    </button>
  );
}

function FollowUpActions({ item, onAction, compact = false }) {
  const navigate = useNavigate();
  const closed = terminalStatuses.has(item.status);
  const route = entityRoute(item);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {item.relatedPhone ? <Button as="a" href={`tel:${item.relatedPhone}`} size="sm" variant="outline" title="Call" className={compact ? 'h-8 w-8 p-0' : ''}><Phone size={14} />{compact ? null : 'Call'}</Button> : null}
      {item.relatedPhone ? <Button as="a" href={`https://wa.me/${String(item.relatedPhone).replace(/\D/g, '')}`} target="_blank" rel="noreferrer" size="sm" variant="outline" title="WhatsApp" className={compact ? 'h-8 w-8 p-0' : ''}><MessageCircle size={14} />{compact ? null : 'WhatsApp'}</Button> : null}
      {item.relatedEmail ? <Button as="a" href={`mailto:${item.relatedEmail}`} size="sm" variant="outline" title="Email" className={compact ? 'h-8 w-8 p-0' : ''}><Mail size={14} />{compact ? null : 'Email'}</Button> : null}
      {route ? <Button size="sm" variant="outline" onClick={() => navigate(route)} title="Open related record" className={compact ? 'h-8 w-8 p-0' : ''}><ExternalLink size={14} />{compact ? null : 'Open'}</Button> : null}
      {!closed && item.status !== 'In Progress' ? <Button size="sm" variant="outline" onClick={() => onAction('start', item)} title="Mark in progress" className={compact ? 'h-8 w-8 p-0' : ''}><Play size={14} />{compact ? null : 'Start'}</Button> : null}
      {!closed ? <Button size="sm" onClick={() => onAction('complete', item)} title="Complete"><CheckCircle2 size={14} />{compact ? null : 'Complete'}</Button> : null}
      {!closed ? <Button size="sm" variant="outline" onClick={() => onAction('reschedule', item)} title="Reschedule" className={compact ? 'h-8 w-8 p-0' : ''}><TimerReset size={14} />{compact ? null : 'Reschedule'}</Button> : null}
      {!closed ? <Button size="sm" variant="outline" onClick={() => onAction('more', item)} title="More actions" className="h-8 w-8 p-0"><MoreHorizontal size={14} /></Button> : null}
    </div>
  );
}

function FollowUpCard({ item, onAction, dense = false }) {
  return (
    <article className={`rounded-2xl border bg-white ${item.effectiveStatus === 'Overdue' ? 'border-rose-200 shadow-[0_8px_30px_rgba(244,63,94,0.08)]' : 'border-slate-200'} ${dense ? 'p-3' : 'p-4'}`}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <button type="button" className="min-w-0 text-left" onClick={() => onAction('details', item)}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={priorityClasses(item.priority)}>{item.priority}</Badge>
            <Badge className={statusClasses(item.effectiveStatus)}>{item.effectiveStatus}</Badge>
            <span className="text-xs font-medium text-slate-400">{item.followUpNumber}</span>
          </div>
          <h3 className="mt-2 truncate text-sm font-semibold text-slate-900">{item.title}</h3>
          <p className="mt-1 text-sm text-slate-600">{item.relatedEntityLabel || item.relatedEntityId}<span className="text-slate-400"> · {item.relatedEntityType}</span></p>
          {item.companyName ? <p className="mt-0.5 text-xs text-slate-400">{item.companyName}</p> : null}
        </button>
        <div className="shrink-0 text-left xl:text-right">
          <p className={`text-sm font-semibold ${item.effectiveStatus === 'Overdue' ? 'text-rose-600' : 'text-slate-700'}`}>{formatDateTime(item.dueAt)}</p>
          {item.overdueDurationSeconds ? <p className="mt-1 text-xs font-medium text-rose-500">Overdue {formatRelativeSeconds(item.overdueDurationSeconds)}</p> : null}
        </div>
      </div>
      {!dense ? <div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 sm:grid-cols-2 xl:grid-cols-4"><span><b className="text-slate-700">Assignee:</b> {item.assigneeName || 'Unassigned'}</span><span><b className="text-slate-700">Purpose:</b> {item.purpose || '—'}</span><span><b className="text-slate-700">Last outcome:</b> {item.actualOutcome || '—'}</span><span><b className="text-slate-700">Value:</b> {item.businessValue ? formatMoney(item.businessValue) : '—'}</span><span className="sm:col-span-2"><b className="text-slate-700">Next action:</b> {item.nextAction || 'Not captured'}</span><span><b className="text-slate-700">Stage:</b> {item.leadStage || item.relatedStatus || '—'}</span><span><b className="text-slate-700">Last activity:</b> {formatDateTime(item.lastActivityAt)}</span></div> : null}
      <div className="mt-3"><FollowUpActions item={item} onAction={onAction} compact={dense} /></div>
    </article>
  );
}

function TodayView({ data, loading, onAction }) {
  const sections = [
    ['overdue', 'Overdue', 'Immediate recovery required', 'rose'], ['dueNow', 'Due now', 'Within 30 minutes', 'amber'],
    ['dueToday', 'Due today', 'Today’s action queue', 'blue'], ['critical', 'Critical', 'Highest business risk', 'rose'],
    ['waitingForClient', 'Waiting for client', 'Needs a timed response check', 'violet'], ['missingNextAction', 'Missing next action', 'Action must be clarified', 'amber'],
    ['upcoming', 'Upcoming', 'Next items in the queue', 'emerald']
  ];
  if (loading) return <div className="space-y-4">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-40 rounded-2xl" />)}</div>;
  return <div className="space-y-5">{sections.map(([key, title, description]) => {
    const rows = data?.sections?.[key] || [];
    if (!rows.length && !['overdue', 'dueToday', 'upcoming'].includes(key)) return null;
    return <Card key={key} className="rounded-2xl border-slate-100 p-4"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-semibold text-slate-900">{title}</h2><p className="text-xs text-slate-400">{description}</p></div><Badge className={key === 'overdue' || key === 'critical' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-600'}>{rows.length}</Badge></div><div className="space-y-3">{rows.length ? rows.slice(0, key === 'upcoming' ? 8 : 50).map((item) => <FollowUpCard key={item.id} item={item} onAction={onAction} />) : <EmptyState title={`No ${title.toLowerCase()} follow-ups`} description="The queue is clear for this section." />}</div></Card>;
  })}</div>;
}

function ListView({ rows, meta, filters, setFilters, loading, onAction, onRefresh }) {
  return (
    <Card className="rounded-2xl border-slate-100 p-0 overflow-hidden">
      <div className="grid gap-3 border-b border-slate-100 p-4 lg:grid-cols-[minmax(240px,1fr)_180px_160px_160px_auto]">
        <div className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><Input className="pl-9" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value, page: 1 }))} placeholder="Search name, phone, invoice, purpose or ID" /></div>
        <Select value={filters.status} onChange={(value) => setFilters((current) => ({ ...current, status: value, page: 1 }))} options={[{ value: '', label: 'All statuses' }, 'Scheduled', 'Due Today', 'In Progress', 'Waiting for Client', 'Waiting for Internal Team', 'No Response', 'Escalated', 'Completed'].map((item) => typeof item === 'string' ? { value: item, label: item } : item)} />
        <Select value={filters.priority} onChange={(value) => setFilters((current) => ({ ...current, priority: value, page: 1 }))} options={[{ value: '', label: 'All priorities' }, ...['Low', 'Medium', 'High', 'Critical'].map((value) => ({ value, label: value }))]} />
        <Select value={filters.overdue} onChange={(value) => setFilters((current) => ({ ...current, overdue: value, page: 1 }))} options={[{ value: '', label: 'All due dates' }, { value: 'true', label: 'Overdue only' }]} />
        <Button variant="outline" onClick={onRefresh}><RefreshCcw size={15} />Refresh</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-500"><tr>{['Record', 'Purpose', 'Due', 'Priority', 'Status', 'Assignee', 'Next action', 'Actions'].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? <tr><td colSpan="8" className="p-6"><Skeleton className="h-28" /></td></tr> : rows.map((item) => <tr key={item.id} className="align-top hover:bg-slate-50/60"><td className="px-4 py-4"><button className="font-semibold text-slate-900 hover:text-[var(--primary)]" onClick={() => onAction('details', item)}>{item.relatedEntityLabel}</button><p className="mt-1 text-xs text-slate-400">{item.followUpNumber} · {item.relatedEntityType}</p></td><td className="max-w-[220px] px-4 py-4"><p className="font-medium text-slate-700">{item.title}</p><p className="mt-1 truncate text-xs text-slate-400">{item.purpose || item.followUpType}</p></td><td className="px-4 py-4"><p className={item.effectiveStatus === 'Overdue' ? 'font-semibold text-rose-600' : 'text-slate-700'}>{formatDateTime(item.dueAt)}</p>{item.overdueDurationSeconds ? <p className="mt-1 text-xs text-rose-500">{formatRelativeSeconds(item.overdueDurationSeconds)} late</p> : null}</td><td className="px-4 py-4"><Badge className={priorityClasses(item.priority)}>{item.priority}</Badge></td><td className="px-4 py-4"><Badge className={statusClasses(item.effectiveStatus)}>{item.effectiveStatus}</Badge></td><td className="px-4 py-4 text-slate-600">{item.assigneeName || 'Unassigned'}</td><td className="max-w-[220px] px-4 py-4 text-slate-600">{item.nextAction || '—'}</td><td className="px-4 py-4"><FollowUpActions item={item} onAction={onAction} compact /></td></tr>)}
          </tbody>
        </table>
      </div>
      {!loading && !rows.length ? <div className="p-8"><EmptyState title="No follow-ups match" description="Change filters or schedule a new follow-up." /></div> : null}
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500"><span>{meta.total || 0} total</span><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}><ArrowLeft size={14} />Previous</Button><span>Page {filters.page}</span><Button size="sm" variant="outline" disabled={(filters.page * 25) >= (meta.total || 0)} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next<ArrowRight size={14} /></Button></div></div>
    </Card>
  );
}

function CalendarView({ rows, month, setMonth, onAction, loading }) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const first = new Date(year, monthIndex, 1);
  const startOffset = first.getDay();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [...Array(startOffset).fill(null), ...Array.from({ length: days }, (_, index) => index + 1)];
  const byDay = rows.reduce((map, item) => {
    const date = new Date(item.dueAt);
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
    if (!map[key]) map[key] = [];
    map[key].push(item);
    return map;
  }, {});
  return <Card className="rounded-2xl border-slate-100 p-0 overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 p-4"><Button variant="outline" size="sm" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}><ArrowLeft size={15} /></Button><h2 className="font-semibold text-slate-900">{month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h2><Button variant="outline" size="sm" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}><ArrowRight size={15} /></Button></div>{loading ? <div className="p-6"><Skeleton className="h-[520px]" /></div> : <div className="grid grid-cols-7 bg-slate-100 gap-px">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => <div key={label} className="bg-slate-50 p-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>)}{cells.map((day, index) => { const key = day ? `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : ''; const items = byDay[key] || []; return <div key={`${day}-${index}`} className="min-h-28 bg-white p-2">{day ? <><span className="text-xs font-semibold text-slate-500">{day}</span><div className="mt-2 space-y-1">{items.slice(0, 3).map((item) => <button key={item.id} onClick={() => onAction('details', item)} className={`block w-full truncate rounded-lg px-2 py-1 text-left text-[10px] font-medium ${item.effectiveStatus === 'Overdue' ? 'bg-rose-50 text-rose-700' : item.priority === 'Critical' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>{new Date(item.dueAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} {item.title}</button>)}{items.length > 3 ? <p className="text-[10px] text-slate-400">+{items.length - 3} more</p> : null}</div></> : null}</div>; })}</div>}</Card>;
}

function KanbanView({ rows, onAction }) {
  const columns = [
    ['Scheduled', (item) => item.effectiveStatus === 'Scheduled'], ['Due Today', (item) => item.effectiveStatus === 'Due Today' || item.effectiveStatus === 'Overdue'],
    ['In Progress', (item) => item.status === 'In Progress'], ['Waiting', (item) => item.status.startsWith('Waiting') || item.status === 'No Response'],
    ['Completed', (item) => terminalStatuses.has(item.status)], ['Escalated', (item) => item.status === 'Escalated']
  ];
  return <div className="grid gap-4 overflow-x-auto pb-3 xl:grid-cols-6">{columns.map(([label, predicate]) => { const items = rows.filter(predicate); return <section key={label} className="min-w-[280px] rounded-2xl bg-slate-100/80 p-3"><div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">{label}</h3><Badge className="border-slate-200 bg-white text-slate-500">{items.length}</Badge></div><div className="space-y-3">{items.map((item) => <FollowUpCard key={item.id} item={item} dense onAction={onAction} />)}{!items.length ? <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">No items</p> : null}</div></section>; })}</div>;
}

function AttentionView({ data, loading, onCreate }) {
  const labels = { missingNextAction: 'Missing Next Action', overdue: 'Overdue', unassigned: 'Unassigned', highValueAtRisk: 'High-Value At Risk', waitingTooLong: 'Waiting Too Long', repeatedlyRescheduled: 'Repeatedly Rescheduled', promiseDateMissed: 'Promise Date Missed', renewalRisk: 'Renewal Risk', assignmentRisk: 'Assignment Risk' };
  if (loading) return <Skeleton className="h-96 rounded-2xl" />;
  return <div className="grid gap-4 lg:grid-cols-2">{Object.entries(data?.categories || {}).map(([key, rows]) => <Card key={key} className="rounded-2xl border-slate-100 p-4"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><CircleAlert size={17} className={rows.length ? 'text-rose-500' : 'text-emerald-500'} /><h3 className="font-semibold text-slate-900">{labels[key] || key}</h3></div><Badge className={rows.length ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}>{rows.length}</Badge></div><div className="space-y-2">{rows.slice(0, 8).map((row) => <div key={row.id || `${row.entityType}-${row.entityId}`} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-700">{row.relatedEntityLabel || row.label || row.title || row.follow_up_number}</p><p className="text-xs text-slate-400">{row.entityType || row.relatedEntityType || row.status}</p></div>{row.entityType && row.entityId ? <Button size="sm" variant="outline" onClick={() => onCreate({ relatedEntityType: row.entityType, relatedEntityId: row.entityId, relatedEntityLabel: row.label || '', title: `${labels[key]} follow-up`, priority: key.includes('Risk') || key === 'promiseDateMissed' ? 'Critical' : 'High' })}>Create</Button> : null}</div>)}{!rows.length ? <p className="py-5 text-center text-sm text-slate-400">No records need attention.</p> : null}</div></Card>)}</div>;
}

function AnalyticsView({ data, loading, workloadOnly = false }) {
  if (loading) return <Skeleton className="h-96 rounded-2xl" />;
  const assignees = Object.entries(data?.byAssignee || {});
  if (workloadOnly) return <Card className="rounded-2xl border-slate-100 p-0 overflow-hidden"><div className="border-b border-slate-100 p-4"><h2 className="font-semibold text-slate-900">Employee workload</h2><p className="text-xs text-slate-400">Assigned, completed and overdue follow-ups</p></div><div className="divide-y divide-slate-100">{assignees.map(([name, values]) => <div key={name} className="grid items-center gap-3 p-4 sm:grid-cols-[1fr_100px_100px_100px]"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600"><UserRound size={16} /></span><span className="font-medium text-slate-800">{name}</span></div><span className="text-sm text-slate-500">{values.total} assigned</span><span className="text-sm text-emerald-600">{values.completed} completed</span><span className="text-sm text-rose-600">{values.overdue} overdue</span></div>)}</div></Card>;
  return <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Total" value={data?.total} helper="Visible workload" icon={LayoutList} /><Metric label="Completed" value={data?.completed} helper={`${data?.completionRate || 0}% completion`} icon={CheckCircle2} tone="emerald" /><Metric label="Overdue" value={data?.overdue} helper={`${data?.averageOverdueHours || 0} avg hours`} icon={AlertTriangle} tone="rose" /><Metric label="Critical" value={data?.critical} helper="Priority risk" icon={Flame} tone="amber" /><Metric label="Unassigned" value={data?.unassigned} helper="Ownership gap" icon={UserRound} tone="violet" /></div><div className="grid gap-5 lg:grid-cols-2"><Distribution title="Status distribution" data={data?.byStatus} /><Distribution title="Outcome distribution" data={data?.byOutcome} /><Distribution title="Priority distribution" data={data?.byPriority} /><Distribution title="Type effectiveness base" data={data?.byType} /></div></div>;
}

function Distribution({ title, data = {} }) {
  const rows = Object.entries(data || {}).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map(([, value]) => value));
  return <Card className="rounded-2xl border-slate-100 p-4"><h3 className="font-semibold text-slate-900">{title}</h3><div className="mt-4 space-y-3">{rows.map(([label, value]) => <div key={label}><div className="mb-1 flex justify-between text-xs"><span className="text-slate-600">{label}</span><span className="font-semibold text-slate-700">{value}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${Math.max(4, value / max * 100)}%` }} /></div></div>)}{!rows.length ? <p className="text-sm text-slate-400">No data yet.</p> : null}</div></Card>;
}

function AutomationView({ options, onRefresh }) {
  const { token, hasPermission } = useAuth();
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState({ kind: '', record: null });
  const sequences = options.sequences || [];
  const templates = options.templates || [];
  const automationRules = options.automationRules || [];
  const escalationRules = options.escalationRules || [];
  async function run() { setBusy(true); try { const response = await api.followUps.runAutomation(token); toast.success(`Processed ${response.data.remindersSent} reminders and ${response.data.escalations} escalations`); onRefresh(); } catch (error) { toast.error(error.message); } finally { setBusy(false); } }
  return <div className="space-y-5">
    <Card className="rounded-2xl border-slate-100"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><h2 className="font-semibold text-slate-900">Automation control</h2><p className="mt-1 text-sm text-slate-500">Idempotent reminder, escalation, sequence, payment-promise and renewal processing.</p></div>{hasPermission('followups.manage_automation') ? <Button onClick={run} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}Run cycle</Button> : null}</div></Card>
    <div className="grid gap-5 lg:grid-cols-2">
      <ConfigList title="Templates" rows={templates} empty="No templates configured" canManage={hasPermission('followups.manage_templates')} onCreate={() => setEditor({ kind: 'template', record: null })} onEdit={(record) => setEditor({ kind: 'template', record })} />
      <ConfigList title="Sequences" rows={sequences} empty="No sequences configured" canManage={hasPermission('followups.manage_sequences')} onCreate={() => setEditor({ kind: 'sequence', record: null })} onEdit={(record) => setEditor({ kind: 'sequence', record })} renderMeta={(row) => `${row.trigger_key || row.triggerKey} · ${row.steps?.length || 0} steps · v${row.version || 1}`} />
      <ConfigList title="Automation rules" rows={automationRules} empty="No automation rules configured" canManage={hasPermission('followups.manage_automation')} onCreate={() => setEditor({ kind: 'automation', record: null })} onEdit={(record) => setEditor({ kind: 'automation', record })} renderMeta={(row) => `When ${row.trigger_key || row.triggerKey || 'manual'} · priority ${row.priority || 100}`} />
      <ConfigList title="Escalation rules" rows={escalationRules} empty="No escalation rules configured" canManage={hasPermission('followups.manage_escalations')} onCreate={() => setEditor({ kind: 'escalation', record: null })} onEdit={(record) => setEditor({ kind: 'escalation', record })} renderMeta={(row) => `${(row.levels || []).length} escalation levels`} />
    </div>
    <ConfigEditorModal open={Boolean(editor.kind)} kind={editor.kind} record={editor.record} onClose={() => setEditor({ kind: '', record: null })} onSaved={() => { setEditor({ kind: '', record: null }); onRefresh(); }} />
  </div>;
}

function ConfigList({ title, rows, empty, renderMeta, canManage = false, onCreate, onEdit }) {
  return <Card className="rounded-2xl border-slate-100 p-4"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><h3 className="font-semibold text-slate-900">{title}</h3><Badge className="border-slate-200 bg-slate-50 text-slate-600">{rows.length}</Badge></div>{canManage ? <Button size="sm" variant="outline" onClick={onCreate}><Plus size={14} />New</Button> : null}</div><div className="space-y-2">{rows.map((row) => <button type="button" onClick={() => canManage && onEdit?.(row)} key={row.id} className="block w-full rounded-xl border border-slate-100 p-3 text-left transition hover:border-slate-200 hover:bg-slate-50"><div className="flex items-center justify-between gap-3"><p className="font-medium text-slate-700">{row.name}</p><Badge className={row.is_active === false || row.isActive === false ? 'border-slate-200 bg-slate-50 text-slate-500' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}>{row.is_active === false || row.isActive === false ? 'Inactive' : 'Active'}</Badge></div><p className="mt-1 text-xs text-slate-400">{renderMeta ? renderMeta(row) : `${row.category || 'General'} · ${row.follow_up_type || row.followUpType || ''}`}</p></button>)}{!rows.length ? <p className="py-6 text-center text-sm text-slate-400">{empty}</p> : null}</div></Card>;
}

function ConfigEditorModal({ open, kind, record, onClose, onSaved }) {
  const { token } = useAuth();
  const [form, setForm] = useState({ name: '', description: '', category: 'General', followUpType: 'Call', defaultTitle: '', defaultPriority: 'Medium', triggerKey: 'manual', applicableEntityType: 'Quotation', priority: 100, conditionsText: '{}', actionsText: '[]', levelsText: '[]', isActive: true, steps: [] });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setForm({
      name: record?.name || '', description: record?.description || '', category: record?.category || 'General',
      followUpType: record?.follow_up_type || record?.followUpType || 'Call', defaultTitle: record?.default_title || record?.defaultTitle || '',
      defaultPriority: record?.default_priority || record?.defaultPriority || 'Medium', triggerKey: record?.trigger_key || record?.triggerKey || 'quotation_sent',
      applicableEntityType: record?.applicable_entity_type || record?.applicableEntityType || 'Quotation', isActive: record?.is_active !== false && record?.isActive !== false,
      priority: Number(record?.priority || 100), conditionsText: JSON.stringify(record?.conditions || {}, null, 2),
      actionsText: JSON.stringify(record?.actions || [], null, 2), levelsText: JSON.stringify(record?.levels || [], null, 2),
      steps: (record?.steps || []).map((step) => ({ id: step.id, name: step.name || '', delayHours: Number(step.delay_minutes || step.delayMinutes || 0) / 60, actionType: step.action_type || step.actionType || 'create_follow_up', followUpType: step.follow_up_type || step.followUpType || 'Call', titleTemplate: step.title_template || step.titleTemplate || '' }))
    });
  }, [open, record]);
  function set(key, value) { setForm((current) => ({ ...current, [key]: value })); }
  function updateStep(index, key, value) { setForm((current) => ({ ...current, steps: current.steps.map((step, stepIndex) => stepIndex === index ? { ...step, [key]: value } : step) })); }
  async function save(event) {
    event.preventDefault();
    if (!form.name.trim()) return toast.error('Name is required');
    setBusy(true);
    try {
      const paths = { template: '/follow-up-templates', sequence: '/follow-up-sequences', automation: '/follow-up-automation-rules', escalation: '/follow-up-escalation-rules' };
      const path = paths[kind];
      let payload = form;
      if (kind === 'sequence') payload = { ...form, steps: form.steps.map((step, index) => ({ ...step, stepOrder: index + 1, delayMinutes: Math.max(0, Number(step.delayHours || 0) * 60) })) };
      if (kind === 'automation') payload = { ...form, conditions: JSON.parse(form.conditionsText || '{}'), actions: JSON.parse(form.actionsText || '[]'), priority: Number(form.priority || 100) };
      if (kind === 'escalation') payload = { ...form, conditions: JSON.parse(form.conditionsText || '{}'), levels: JSON.parse(form.levelsText || '[]') };
      if (record?.id) await api.followUps.updateConfig(token, path, record.id, payload);
      else await api.followUps.createConfig(token, path, payload);
      toast.success(`${kind[0].toUpperCase()}${kind.slice(1)} saved`);
      onSaved();
    } catch (error) { toast.error(error instanceof SyntaxError ? 'Conditions, actions and levels must be valid JSON' : error.message || 'Unable to save configuration'); }
    finally { setBusy(false); }
  }
  return <Modal open={open} onClose={onClose} title={`${record ? 'Edit' : 'New'} ${kind}`} width="min(760px, 96vw)" footer={<div className="flex justify-end gap-3"><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="config-editor-form" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />}Save</Button></div>}>
    <form id="config-editor-form" onSubmit={save} className="grid gap-4 md:grid-cols-2">
      <label className="text-xs font-semibold text-slate-600">Name<Input className="mt-1.5" value={form.name} onChange={(event) => set('name', event.target.value)} /></label>
      <label className="text-xs font-semibold text-slate-600">Active<span className="mt-3 flex items-center gap-2 text-sm font-normal"><input type="checkbox" checked={form.isActive} onChange={(event) => set('isActive', event.target.checked)} />Available for use</span></label>
      <label className="md:col-span-2 text-xs font-semibold text-slate-600">Description<Textarea className="mt-1.5" value={form.description} onChange={(event) => set('description', event.target.value)} rows={2} /></label>
      {kind === 'template' ? <>
        <label className="text-xs font-semibold text-slate-600">Category<Input className="mt-1.5" value={form.category} onChange={(event) => set('category', event.target.value)} /></label>
        <label className="text-xs font-semibold text-slate-600">Type<Input className="mt-1.5" value={form.followUpType} onChange={(event) => set('followUpType', event.target.value)} /></label>
        <label className="md:col-span-2 text-xs font-semibold text-slate-600">Default title<Input className="mt-1.5" value={form.defaultTitle} onChange={(event) => set('defaultTitle', event.target.value)} /></label>
      </> : null}
      {kind === 'sequence' ? <>
        <label className="text-xs font-semibold text-slate-600">Trigger<Input className="mt-1.5" value={form.triggerKey} onChange={(event) => set('triggerKey', event.target.value)} /></label>
        <label className="text-xs font-semibold text-slate-600">Entity type<Input className="mt-1.5" value={form.applicableEntityType} onChange={(event) => set('applicableEntityType', event.target.value)} /></label>
        <div className="md:col-span-2 rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between"><div><h4 className="text-sm font-semibold text-slate-800">Sequence steps</h4><p className="text-xs text-slate-400">Ordered delays are measured from the previous step.</p></div><Button type="button" size="sm" variant="outline" onClick={() => set('steps', [...form.steps, { name: `Step ${form.steps.length + 1}`, delayHours: 24, actionType: 'create_follow_up', followUpType: 'Call', titleTemplate: '' }])}><Plus size={14} />Step</Button></div><div className="mt-3 space-y-3">{form.steps.map((step, index) => <div key={step.id || index} className="grid gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-[1fr_100px_150px_auto]"><Input value={step.name} onChange={(event) => updateStep(index, 'name', event.target.value)} placeholder="Step name" /><Input type="number" min="0" value={step.delayHours} onChange={(event) => updateStep(index, 'delayHours', event.target.value)} title="Delay hours" /><Select value={step.actionType} onChange={(value) => updateStep(index, 'actionType', value)} options={[{ value: 'create_follow_up', label: 'Create follow-up' }, { value: 'escalate', label: 'Escalate' }]} /><Button type="button" variant="outline" size="sm" onClick={() => set('steps', form.steps.filter((_, stepIndex) => stepIndex !== index))}>Remove</Button></div>)}</div></div>
      </> : null}
      {kind === 'automation' ? <>
        <label className="text-xs font-semibold text-slate-600">When (trigger)<Input className="mt-1.5" value={form.triggerKey} onChange={(event) => set('triggerKey', event.target.value)} placeholder="lead_created" /></label>
        <label className="text-xs font-semibold text-slate-600">Execution priority<Input className="mt-1.5" type="number" value={form.priority} onChange={(event) => set('priority', event.target.value)} /></label>
        <label className="md:col-span-2 text-xs font-semibold text-slate-600">Conditions (JSON object)<Textarea className="mt-1.5 font-mono text-xs" value={form.conditionsText} onChange={(event) => set('conditionsText', event.target.value)} rows={5} /></label>
        <label className="md:col-span-2 text-xs font-semibold text-slate-600">Actions (JSON array)<Textarea className="mt-1.5 font-mono text-xs" value={form.actionsText} onChange={(event) => set('actionsText', event.target.value)} rows={6} /></label>
      </> : null}
      {kind === 'escalation' ? <>
        <label className="md:col-span-2 text-xs font-semibold text-slate-600">Conditions (JSON object)<Textarea className="mt-1.5 font-mono text-xs" value={form.conditionsText} onChange={(event) => set('conditionsText', event.target.value)} rows={5} /></label>
        <label className="md:col-span-2 text-xs font-semibold text-slate-600">Escalation levels (JSON array)<Textarea className="mt-1.5 font-mono text-xs" value={form.levelsText} onChange={(event) => set('levelsText', event.target.value)} rows={7} /></label>
      </> : null}
    </form>
  </Modal>;
}

function SettingsView({ settings, onSaved }) {
  const { token, hasPermission } = useAuth();
  const [form, setForm] = useState({ timezone: 'Asia/Kolkata', businessHours: {}, protectionThresholds: {}, defaultReminders: [], escalationSchedule: [], retryPolicy: {}, featureFlags: {} });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (settings) setForm(settings); }, [settings]);
  function threshold(key, value) { setForm((current) => ({ ...current, protectionThresholds: { ...(current.protectionThresholds || {}), [key]: Number(value) } })); }
  async function save() { setBusy(true); try { const response = await api.followUps.saveSettings(token, form); toast.success('Follow-up settings saved'); setForm(response.data); onSaved?.(response.data); } catch (error) { toast.error(error.message); } finally { setBusy(false); } }
  return <div className="grid gap-5 lg:grid-cols-[1fr_360px]"><Card className="rounded-2xl border-slate-100"><h2 className="font-semibold text-slate-900">Protection thresholds</h2><p className="mt-1 text-sm text-slate-500">Configure risk detection without changing existing business records.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-600">High-value lead (₹)<Input className="mt-1.5" type="number" value={form.protectionThresholds?.highValueLead || 250000} onChange={(event) => threshold('highValueLead', event.target.value)} /></label><label className="text-xs font-semibold text-slate-600">Untouched hours<Input className="mt-1.5" type="number" value={form.protectionThresholds?.untouchedHours || 24} onChange={(event) => threshold('untouchedHours', event.target.value)} /></label><label className="text-xs font-semibold text-slate-600">Waiting-too-long hours<Input className="mt-1.5" type="number" value={form.protectionThresholds?.waitingHours || 48} onChange={(event) => threshold('waitingHours', event.target.value)} /></label><label className="text-xs font-semibold text-slate-600">Maximum reschedules<Input className="mt-1.5" type="number" value={form.protectionThresholds?.maxReschedules || 3} onChange={(event) => threshold('maxReschedules', event.target.value)} /></label><label className="text-xs font-semibold text-slate-600">Daily workload warning<Input className="mt-1.5" type="number" value={form.protectionThresholds?.dailyWorkloadWarning || 12} onChange={(event) => threshold('dailyWorkloadWarning', event.target.value)} /></label><label className="text-xs font-semibold text-slate-600">Critical snooze limit<Input className="mt-1.5" type="number" value={form.protectionThresholds?.maxCriticalSnoozes || 1} onChange={(event) => threshold('maxCriticalSnoozes', event.target.value)} /></label><label className="text-xs font-semibold text-slate-600">Renewal window days<Input className="mt-1.5" type="number" value={form.protectionThresholds?.renewalWindowDays || 90} onChange={(event) => threshold('renewalWindowDays', event.target.value)} /></label></div>{hasPermission('followups.manage_settings', 'settings.write') ? <div className="mt-5 flex justify-end"><Button onClick={save} disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />}Save settings</Button></div> : null}</Card><Card className="rounded-2xl border-slate-100"><h3 className="font-semibold text-slate-900">Business calendar</h3><label className="mt-4 block text-xs font-semibold text-slate-600">Time zone<Select className="mt-1.5" value={form.timezone} onChange={(value) => setForm((current) => ({ ...current, timezone: value }))} options={[{ value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' }]} /></label><div className="mt-4 grid grid-cols-2 gap-3"><label className="text-xs font-semibold text-slate-600">Starts<Input className="mt-1.5" type="time" value={form.businessHours?.start || '09:30'} onChange={(event) => setForm((current) => ({ ...current, businessHours: { ...(current.businessHours || {}), start: event.target.value } }))} /></label><label className="text-xs font-semibold text-slate-600">Ends<Input className="mt-1.5" type="time" value={form.businessHours?.end || '18:30'} onChange={(event) => setForm((current) => ({ ...current, businessHours: { ...(current.businessHours || {}), end: event.target.value } }))} /></label></div><div className="mt-5 rounded-xl bg-amber-50 p-3 text-xs text-amber-700"><b>Customer safety:</b> automatic client messages remain disabled unless an approved rule explicitly enables them.</div></Card></div>;
}

function DetailsModal({ item, open, onClose, onAction }) {
  return <Modal open={open} onClose={onClose} title={item?.title || 'Follow-up'} subtitle={item?.followUpNumber} width="min(860px, 96vw)">{item ? <div className="space-y-5"><div className="flex flex-wrap gap-2"><Badge className={priorityClasses(item.priority)}>{item.priority}</Badge><Badge className={statusClasses(item.effectiveStatus || item.status)}>{item.effectiveStatus || item.status}</Badge><Badge className="border-slate-200 bg-slate-50 text-slate-600">{item.followUpType}</Badge></div><div className="grid gap-4 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2"><Detail label="Related record" value={`${item.relatedEntityLabel} · ${item.relatedEntityType}`} /><Detail label="Due" value={formatDateTime(item.dueAt)} /><Detail label="Assignee" value={item.assigneeName || 'Unassigned'} /><Detail label="Purpose" value={item.purpose || '—'} /><Detail label="Expected outcome" value={item.expectedOutcome || '—'} /><Detail label="Next action" value={item.nextAction || 'Not captured'} /></div>{item.description ? <div><h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Description</h4><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{item.description}</p></div> : null}{item.priorityReason ? <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800"><b>Priority reason:</b> {item.priorityReason}</div> : null}<FollowUpActions item={item} onAction={onAction} /></div> : null}</Modal>;
}

function Detail({ label, value }) { return <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p><p className="mt-1 text-sm font-medium text-slate-700">{value}</p></div>; }

function MoreActionsModal({ item, open, onClose, onAction }) {
  return <Modal open={open} onClose={onClose} title="More follow-up actions" subtitle={item?.followUpNumber} width="min(520px, 96vw)"><div className="grid gap-3 sm:grid-cols-2"><Button variant="outline" onClick={() => onAction('snooze', item)}><BellRing size={16} />Snooze with reason</Button><Button variant="outline" onClick={() => onAction('escalate', item)}><ShieldAlert size={16} />Escalate</Button><Button variant="outline" onClick={() => onAction('acknowledge', item)}><CheckCircle2 size={16} />Acknowledge reminder</Button><Button variant="outline" onClick={() => onAction('edit', item)}><Settings2 size={16} />Edit follow-up</Button></div></Modal>;
}

export function FollowUpsPage() {
  const { token, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('view') || 'today';
  const [activeTab, setActiveTab] = useState(tabs.some((item) => item.id === initialTab) ? initialTab : 'today');
  const [options, setOptions] = useState({});
  const [todayData, setTodayData] = useState(null);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [attention, setAttention] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', status: '', priority: '', overdue: '', page: 1 });
  const debouncedSearch = useDebouncedValue(filters.search, 300);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [formState, setFormState] = useState({ open: false, initial: null });
  const [completeItem, setCompleteItem] = useState(null);
  const [rescheduleState, setRescheduleState] = useState({ item: null, mode: 'reschedule' });
  const [details, setDetails] = useState(null);
  const [more, setMore] = useState(null);

  const loadOptions = useCallback(async () => { try { const response = await api.followUps.options(token); setOptions(response.data || {}); } catch (error) { toast.error(error.message || 'Unable to load follow-up options'); } }, [token]);
  const loadToday = useCallback(async () => { const response = await api.followUps.today(token); setTodayData(response.data); }, [token]);
  const loadRows = useCallback(async () => {
    const query = { search: debouncedSearch, status: filters.status, priority: filters.priority, overdue: filters.overdue, page: filters.page, limit: 25 };
    if (activeTab === 'calendar') { query.from = new Date(month.getFullYear(), month.getMonth(), 1).toISOString(); query.to = new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString(); query.limit = 200; }
    if (activeTab === 'kanban' || activeTab === 'workload') query.limit = 200;
    const response = await api.followUps.list(token, query); setRows(response.data || []); setMeta(response.meta || { total: 0 });
  }, [activeTab, debouncedSearch, filters.overdue, filters.page, filters.priority, filters.status, month, token]);
  const loadAttention = useCallback(async () => { const response = await api.followUps.attention(token); setAttention(response.data); }, [token]);
  const loadAnalytics = useCallback(async () => { const response = await api.followUps.analytics(token); setAnalytics(response.data); }, [token]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'today') await loadToday();
      else if (['list', 'calendar', 'kanban'].includes(activeTab)) await loadRows();
      else if (activeTab === 'attention') await loadAttention();
      else if (['analytics', 'workload'].includes(activeTab)) await Promise.all([loadAnalytics(), activeTab === 'workload' ? loadRows() : Promise.resolve()]);
      else if (['automation', 'settings'].includes(activeTab)) await loadOptions();
    } catch (error) { toast.error(error.message || 'Unable to load follow-ups'); }
    finally { setLoading(false); }
  }, [activeTab, loadAnalytics, loadAttention, loadOptions, loadRows, loadToday]);

  useEffect(() => { loadOptions(); }, [loadOptions]);
  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const focus = searchParams.get('focus');
    if (!focus || !token) return;
    api.followUps.get(token, focus).then((response) => setDetails(response.data)).catch(() => {});
  }, [searchParams, token]);

  function changeTab(tab) { setActiveTab(tab); setSearchParams({ view: tab }); }

  async function handleAction(action, item) {
    try {
      if (action === 'details') { const response = await api.followUps.get(token, item.id); setDetails(response.data); return; }
      if (action === 'complete') { setDetails(null); setMore(null); setCompleteItem(item); return; }
      if (action === 'reschedule' || action === 'snooze') { setDetails(null); setMore(null); setRescheduleState({ item, mode: action }); return; }
      if (action === 'more') { setMore(item); return; }
      if (action === 'edit') { setMore(null); setFormState({ open: true, initial: item }); return; }
      if (action === 'start') { await api.followUps.start(token, item.id); toast.success('Follow-up marked in progress'); }
      if (action === 'escalate') { await api.followUps.escalate(token, item.id, { reason: 'Manually escalated from command center' }); toast.success('Follow-up escalated'); setMore(null); }
      if (action === 'acknowledge') { await api.followUps.acknowledge(token, item.id); toast.success('Reminder acknowledged'); setMore(null); }
      await refresh();
    } catch (error) { toast.error(error.message || 'Action failed'); }
  }

  const counts = todayData?.counts || {};
  const visibleTabs = tabs.filter((item) => !['analytics'].includes(item.id) || hasPermission('followups.analytics', 'followups.view_all'));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]"><Sparkles size={14} />Advanced Follow-up Engine</div><h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">No business record left unattended</h1><p className="mt-1 text-sm text-slate-500">Every active record gets an owner, current status, next action and due date.</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={refresh} disabled={loading}><RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />Refresh</Button>{hasPermission('followups.create') ? <Button onClick={() => setFormState({ open: true, initial: null })}><Plus size={16} />Add follow-up</Button> : null}</div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6"><Metric label="Overdue" value={counts.overdue || analytics?.overdue} helper="Needs recovery" icon={AlertTriangle} tone="rose" onClick={() => changeTab('today')} /><Metric label="Due today" value={counts.dueToday} helper="Today’s queue" icon={Clock3} tone="blue" onClick={() => changeTab('today')} /><Metric label="Critical" value={counts.critical || analytics?.critical} helper="Highest risk" icon={Flame} tone="amber" onClick={() => changeTab('today')} /><Metric label="Waiting" value={(counts.waitingForClient || 0) + (counts.waitingForInternalTeam || 0)} helper="External + internal" icon={TimerReset} tone="violet" onClick={() => changeTab('today')} /><Metric label="Unassigned" value={counts.unassigned || analytics?.unassigned} helper="Ownership gap" icon={UserRound} tone="violet" onClick={() => changeTab('attention')} /><Metric label="Missing action" value={attention?.counts?.missingNextAction || counts.missingNextAction} helper="Protection engine" icon={ShieldAlert} tone="rose" onClick={() => changeTab('attention')} /></div>

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">{visibleTabs.map((tab) => <button key={tab.id} type="button" onClick={() => changeTab(tab.id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${activeTab === tab.id ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}><tab.icon size={16} />{tab.label}{tab.id === 'attention' && (attention?.counts?.overdue || counts.overdue) ? <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] text-white">{(attention?.counts?.overdue || 0) + (attention?.counts?.missingNextAction || 0)}</span> : null}</button>)}</div>

      {activeTab === 'today' ? <TodayView data={todayData} loading={loading} onAction={handleAction} /> : null}
      {activeTab === 'list' ? <ListView rows={rows} meta={meta} filters={filters} setFilters={setFilters} loading={loading} onAction={handleAction} onRefresh={refresh} /> : null}
      {activeTab === 'calendar' ? <CalendarView rows={rows} month={month} setMonth={setMonth} onAction={handleAction} loading={loading} /> : null}
      {activeTab === 'kanban' ? (loading ? <Skeleton className="h-96 rounded-2xl" /> : <KanbanView rows={rows} onAction={handleAction} />) : null}
      {activeTab === 'attention' ? <AttentionView data={attention} loading={loading} onCreate={(initial) => setFormState({ open: true, initial })} /> : null}
      {activeTab === 'analytics' ? <AnalyticsView data={analytics} loading={loading} /> : null}
      {activeTab === 'workload' ? <AnalyticsView data={analytics} loading={loading} workloadOnly /> : null}
      {activeTab === 'automation' ? <AutomationView options={options} onRefresh={() => { loadOptions(); refresh(); }} /> : null}
      {activeTab === 'settings' ? <SettingsView settings={options.settings} onSaved={(settings) => setOptions((current) => ({ ...current, settings }))} /> : null}

      <FollowUpFormModal open={formState.open} initialValue={formState.initial} options={options} onClose={() => setFormState({ open: false, initial: null })} onSaved={refresh} />
      <CompleteFollowUpModal open={Boolean(completeItem)} followUp={completeItem} options={options} onClose={() => setCompleteItem(null)} onSaved={refresh} />
      <RescheduleFollowUpModal open={Boolean(rescheduleState.item)} followUp={rescheduleState.item} mode={rescheduleState.mode} onClose={() => setRescheduleState({ item: null, mode: 'reschedule' })} onSaved={refresh} />
      <DetailsModal item={details} open={Boolean(details)} onClose={() => { setDetails(null); if (searchParams.get('focus')) { searchParams.delete('focus'); setSearchParams(searchParams); } }} onAction={handleAction} />
      <MoreActionsModal item={more} open={Boolean(more)} onClose={() => setMore(null)} onAction={handleAction} />
    </div>
  );
}
