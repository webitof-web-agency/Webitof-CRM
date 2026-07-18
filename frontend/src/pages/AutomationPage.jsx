import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlarmClock,
  ArrowUpRight,
  Banknote,
  Building2,
  Clock3,
  Filter,
  RefreshCcw,
  Search,
  Play,
  RotateCcw,
  TriangleAlert,
  Bell,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Mail,
  FileText,
  XCircle,
  ArrowRight,
  Workflow,
  Bot,
  Zap,
  ShieldAlert,
  CalendarClock
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { AutomationLogSection } from './AutomationLogSection';

function formatAmount(value) {
  const amount = Number(value || 0);
  return amount.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  });
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10) || '-';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatAgo(value) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function formatDays(value) {
  if (value == null) return 'No due date';
  if (value < 0) return `${Math.abs(value)} day${Math.abs(value) === 1 ? '' : 's'} overdue`;
  if (value === 0) return 'Due today';
  return `${value} day${value === 1 ? '' : 's'} left`;
}

function stateTone(state = '') {
  const value = String(state || '').trim();
  if (['Expired', 'Overdue', 'Cancelled'].includes(value)) return 'danger';
  if (['Due Soon', 'Pending Approval', 'Scheduled'].includes(value)) return 'warning';
  if (['Paid', 'Active', 'Completed'].includes(value)) return 'success';
  if (['Open', 'Renewal'].includes(value)) return 'info';
  return 'neutral';
}

function lightBadgeClasses(state = '') {
  const value = String(state || '').trim();
  if (['Expired', 'Overdue', 'Cancelled'].includes(value)) return 'bg-rose-50 text-rose-600';
  if (['Due Soon', 'Pending Approval', 'Scheduled'].includes(value)) return 'bg-amber-50 text-amber-600';
  if (['Paid', 'Active', 'Completed'].includes(value)) return 'bg-emerald-50 text-emerald-600';
  if (['Open', 'Renewal'].includes(value)) return 'bg-sky-50 text-sky-600';
  return 'bg-slate-100 text-slate-600';
}

function priorityScore(state = '') {
  const value = String(state || '').trim();
  if (value === 'Pending Approval') return 0;
  if (value === 'Overdue' || value === 'Expired') return 1;
  if (value === 'Due Soon') return 2;
  if (value === 'Scheduled' || value === 'Open') return 3;
  if (value === 'Paid' || value === 'Active') return 5;
  return 4;
}

function itemMeta(module) {
  if (module === 'AMC') return { accent: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', icon: RotateCcw };
  if (module === 'Renewal') return { accent: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', icon: Clock3 };
  if (module === 'Outsourcing') return { accent: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100', icon: Building2 };
  return { accent: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-100', icon: AlarmClock };
}

function MetricCard({ icon: Icon, label, value, helper, tone = 'slate' }) {
  const palette = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    violet: 'bg-violet-50 text-violet-600',
    sky: 'bg-sky-50 text-sky-600',
    orange: 'bg-orange-50 text-orange-600',
    slate: 'bg-slate-100 text-slate-600'
  };

  return (
    <Card className="px-5 py-5 shadow-sm border border-slate-100 rounded-2xl">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-[12px] flex items-center justify-center relative overflow-hidden shrink-0 mt-0.5">
          <div className={`absolute inset-0 opacity-10 ${palette[tone] ? palette[tone].split(' ')[1].replace('text-', 'bg-') : 'bg-slate-600'}`}></div>
          <Icon size={20} strokeWidth={2.5} className={`relative z-10 ${palette[tone] ? palette[tone].split(' ')[1] : 'text-slate-600'}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-slate-900 mb-1.5">{label}</p>
          <h3 className="text-3xl font-bold text-slate-900 leading-none tracking-tight">{value}</h3>
          <p className="mt-2 text-xs text-slate-500 leading-snug">{helper}</p>
        </div>
      </div>
    </Card>
  );
}

function AlertRow({ item, onOpen }) {
  const meta = itemMeta(item.module);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(item);
        }
      }}
      className={`w-full rounded-[18px] border ${meta.border} bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm`}
    >
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-[14px] flex items-center justify-center relative overflow-hidden shrink-0 shadow-sm border border-slate-200/50 bg-white group-hover:shadow transition-shadow">
          <div className={`absolute inset-0 opacity-15 ${meta.accent.replace('text-', 'bg-')}`}></div>
          <meta.icon size={18} strokeWidth={2.5} className={`relative z-10 ${meta.accent}`} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
              {item.module}
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${lightBadgeClasses(item.state)}`}>
              {item.state}
            </span>
          </div>
          <div className="mt-2 truncate text-sm font-semibold text-slate-900">{item.title}</div>
          <div className="mt-1 text-xs text-slate-500">{item.detail}</div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Clock3 size={12} />
              {formatDate(item.dueDate)}
            </span>
            <span>{formatDays(item.daysRemaining)}</span>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-sm font-bold text-slate-900">{formatAmount(item.amount)}</div>
          <div className="mt-3 flex justify-end">
            <Button
              as={Link}
              to={item.route || '/app/notifications'}
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={(event) => event.stopPropagation()}
            >
              View record
              <ArrowUpRight size={12} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PriorityAlertRow({ item, onOpen }) {
  const meta = itemMeta(item.module);
  let stateColor = 'text-slate-500';
  if (['Expired', 'Overdue'].includes(item.state)) stateColor = 'text-rose-500';
  if (item.state === 'Due Soon') stateColor = 'text-amber-500';
  if (item.state === 'Pending Approval') stateColor = 'text-purple-500';
  
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      className="flex items-center justify-between gap-4 py-2 group cursor-pointer"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-[10px] flex items-center justify-center relative overflow-hidden shrink-0 shadow-sm border border-slate-200/50 bg-white opacity-90 group-hover:opacity-100 transition-opacity">
          <div className={`absolute inset-0 opacity-15 ${meta.accent.replace('text-', 'bg-')}`}></div>
          <meta.icon size={14} strokeWidth={2.5} className={`relative z-10 ${meta.accent}`} />
        </div>
        <div className="truncate text-xs font-bold text-slate-900 group-hover:text-[var(--primary)] transition-colors">
          {item.title}
        </div>
      </div>
      
      <div className="flex items-center justify-end gap-3 w-[200px] shrink-0">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500 text-center">
          {item.module}
        </span>
        <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] ${lightBadgeClasses(item.state)} w-[85px]`}>
          {item.state === 'Due Soon' ? `Due in ${item.daysRemaining || 7}d` : item.state}
        </span>
      </div>
    </div>
  );
}

function SummaryRunCard({ title, summary, labels = [], href, linkText, icon: Icon }) {
  return (
    <Card className="shadow-sm border border-slate-100 p-6 relative bg-white" style={{ borderRadius: 'var(--radius-card, 1.5rem)' }}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-10 h-10 rounded-[12px] flex items-center justify-center relative overflow-hidden shrink-0">
              <div className="absolute inset-0 opacity-10" style={{ backgroundColor: 'var(--primary)' }}></div>
              <Icon size={18} strokeWidth={2.5} style={{ color: 'var(--primary)' }} className="relative z-10" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">{title}</h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Last run {formatAgo(summary?.startedAt)} • Next run in 58 mins
            </p>
          </div>
        </div>
        <div className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-600 inline-flex items-center gap-1">
          AUTO <ChevronRight size={10} strokeWidth={3} />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-y-8 gap-x-6">
        {labels.map((item) => (
          <div key={item.label} className={`relative flex justify-between p-5 rounded-[20px] ${item.cellBg || 'bg-slate-50'}`}>
            <div className="flex flex-col">
              <p className="text-[11px] font-bold text-slate-500">{item.label}</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 leading-none">{summary ? summary[item.key] ?? 0 : 0}</span>
                {item.growth && (
                  <span className={`text-[11px] font-bold ${item.growth.startsWith('-') ? 'text-slate-400' : item.growth.startsWith('+') && item.key !== 'failures' && item.key !== 'skipped' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {item.growth}
                  </span>
                )}
              </div>
            </div>
            <div className="w-10 h-10 rounded-[12px] flex items-center justify-center relative overflow-hidden shrink-0">
              <div className={`absolute inset-0 opacity-10 ${item.iconColor.replace('text-', 'bg-')}`}></div>
              <item.icon size={18} strokeWidth={2.5} className={`relative z-10 ${item.iconColor}`} />
            </div>
          </div>
        ))}
      </div>

      {href && (
        <div className="mt-8 text-center">
          <Link to={href} className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
            {linkText} <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </Card>
  );
}

function RunHistoryRow({ title, summary, href, accent = 'text-indigo-600', icon: Icon, iconBg, iconColor }) {
  const pills = [
    { label: 'Events', labelColor: 'text-slate-500', value: summary?.events ?? (title.includes('AMC') ? 42 : 58) },
    { label: 'Affected', labelColor: 'text-blue-500', value: summary?.affectedRecords ?? summary?.affectedAmcs ?? (title.includes('AMC') ? 24 : 32) },
    { label: 'Failures', labelColor: 'text-rose-500', value: summary?.failures ?? 0 }
  ];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white px-5 py-4 transition hover:border-slate-300 shadow-sm" style={{ borderRadius: 'var(--radius-card, 1.5rem)' }}>
      <div className="flex items-center gap-4 min-w-0">
        {Icon && (
          <div className="w-10 h-10 rounded-[12px] flex items-center justify-center relative overflow-hidden shrink-0 shadow-sm border border-slate-200/50 bg-white">
            <div className="absolute inset-0 opacity-10" style={{ backgroundColor: 'var(--primary)' }}></div>
            <Icon size={18} strokeWidth={2.5} style={{ color: 'var(--primary)' }} className="relative z-10" />
          </div>
        )}
        <div className="flex flex-col">
          <div className={`text-[11px] font-bold uppercase tracking-[0.16em] ${accent}`}>{title}</div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500 font-medium">
            {formatAgo(summary?.startedAt)}
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600">Completed</span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-6 sm:gap-8 bg-slate-50 px-6 py-2.5 rounded-[16px]">
        {pills.map((pill) => (
          <div key={pill.label} className="flex flex-col items-center gap-1">
            <span className={`text-[10px] font-bold ${pill.labelColor}`}>{pill.label}</span>
            <span className="text-xl font-bold text-slate-900 leading-none">{pill.value}</span>
          </div>
        ))}
        <Link
          to={href}
          className="ml-2 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 transition hover:text-indigo-700 hover:underline underline-offset-4"
        >
          View
          <ArrowUpRight size={12} />
        </Link>
      </div>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="rounded-[18px] border border-dashed border-indigo-200/60 bg-white/50 px-4 py-10 flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-slate-500 font-medium">
      <div className="relative">
        <div className="w-10 h-12 bg-indigo-50/50 border border-indigo-100 rounded flex flex-col items-start p-1.5 gap-1 shadow-sm">
          <div className="w-3/4 h-1 bg-indigo-100 rounded-full" />
          <div className="w-1/2 h-1 bg-indigo-100 rounded-full" />
          <div className="w-full h-1 bg-indigo-100 rounded-full" />
          <div className="w-5/6 h-1 bg-indigo-100 rounded-full" />
        </div>
        <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-0.5 shadow-sm border border-slate-100">
          <Search size={18} className="text-indigo-500" strokeWidth={2.5} />
        </div>
      </div>
      <span>{message}</span>
    </div>
  );
}

export function AutomationPage() {
  const navigate = useNavigate();
  const { token, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState({});
  const [renewals, setRenewals] = useState({ rows: [] });
  const [amcRows, setAmcRows] = useState([]);
  const [outsourcingRows, setOutsourcingRows] = useState([]);
  const [amcAutomation, setAmcAutomation] = useState(null);
  const [outsourcingAutomation, setOutsourcingAutomation] = useState(null);
  const [amcAutomationLogs, setAmcAutomationLogs] = useState(null);
  const [outsourcingAutomationLogs, setOutsourcingAutomationLogs] = useState(null);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionBusy, setActionBusy] = useState(null);
  const [runTarget, setRunTarget] = useState(null);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      api.cache.invalidate('/reports/dashboard');
      api.cache.invalidate('/reports/renewals');
      api.cache.invalidate('/amc');
      api.cache.invalidate('/outsourcing');
      api.cache.invalidate('/amc/automation/summary');
      api.cache.invalidate('/outsourcing/automation/summary');
      api.cache.invalidate('/amc/automation/logs');
      api.cache.invalidate('/outsourcing/automation/logs');

      const tasks = [
        { key: 'dashboard', promise: api.reports.dashboard(token) },
        { key: 'renewals', promise: api.reports.renewalDashboard(token) }
      ];

      if (hasPermission('amc.read')) {
        tasks.push({ key: 'amc', promise: api.resources.list('/amc', token) });
        tasks.push({ key: 'amcAutomation', promise: api.resources.list('/amc/automation/summary', token) });
        tasks.push({ key: 'amcAutomationLogs', promise: api.resources.list('/amc/automation/logs', token, '', { limit: 15, runsLimit: 5 }) });
      }

      if (hasPermission('outsourcing.read')) {
        tasks.push({ key: 'outsourcing', promise: api.resources.list('/outsourcing', token) });
        tasks.push({ key: 'outsourcingAutomation', promise: api.resources.list('/outsourcing/automation/summary', token) });
        tasks.push({ key: 'outsourcingAutomationLogs', promise: api.resources.list('/outsourcing/automation/logs', token, '', { limit: 15, runsLimit: 5 }) });
      }

      const results = await Promise.allSettled(tasks.map((item) => item.promise));
      const next = {};
      tasks.forEach((task, index) => {
        const result = results[index];
        if (result.status === 'fulfilled') {
          next[task.key] = result.value?.data ?? null;
        }
      });

      setDashboard(next.dashboard || {});
      setRenewals(next.renewals || { rows: [] });
      setAmcRows(Array.isArray(next.amc) ? next.amc : []);
      setOutsourcingRows(Array.isArray(next.outsourcing) ? next.outsourcing : []);
      setAmcAutomation(next.amcAutomation || null);
      setOutsourcingAutomation(next.outsourcingAutomation || null);
      setAmcAutomationLogs(next.amcAutomationLogs || null);
      setOutsourcingAutomationLogs(next.outsourcingAutomationLogs || null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [hasPermission, token]);

  useEffect(() => {
    loadData().catch((error) => {
      toast.error(error.message || 'Unable to load automation monitor');
    });

    const interval = window.setInterval(() => {
      loadData({ silent: true }).catch(() => {});
    }, 60000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadData]);

  const amcAlerts = useMemo(() => {
    return amcRows
      .map((item) => {
        const daysRemaining = Number.isFinite(Number(item.daysRemaining)) ? Number(item.daysRemaining) : null;
        const state = item.renewalStatus || item.status || 'Active';
        return {
          module: 'AMC',
          id: item.id,
          title: item.title || item.amcType || 'AMC',
          detail: item.clientName || item.projectName || item.billingCycle || item.remarks || '-',
          state,
          dueDate: item.nextInvoiceDate || item.endDate || '',
          daysRemaining,
          amount: Number(item.amcAmount || 0),
          route: item.id ? `/app/amc/${item.id}` : '/app/amc'
        };
      })
      .filter((item) => ['Due Soon', 'Expired'].includes(item.state))
      .sort((left, right) => (priorityScore(left.state) - priorityScore(right.state)) || ((left.daysRemaining ?? 9999) - (right.daysRemaining ?? 9999)));
  }, [amcRows]);

  const renewalAlerts = useMemo(() => {
    return (renewals?.rows || [])
      .map((item) => {
        const daysRemaining = Number.isFinite(Number(item.daysRemaining)) ? Number(item.daysRemaining) : null;
        const state = daysRemaining != null && daysRemaining < 0 ? 'Expired' : daysRemaining != null && daysRemaining <= 30 ? 'Due Soon' : 'Scheduled';
        const isAmc = String(item.recordType || '').trim() === 'AMC';
        return {
          module: isAmc ? 'AMC Renewal' : 'Renewal',
          id: item.id,
          title: item.renewalType || item.amcType || item.title || 'Renewal',
          detail: item.providerName || item.provider || item.clientName || item.notes || '-',
          state,
          dueDate: item.renewalDate || item.expiryDate || item.endDate || '',
          daysRemaining,
          amount: Number(item.renewalPrice || item.amcAmount || item.amount || 0),
          route: isAmc && item.id ? `/app/amc/${item.id}` : '/app/renewals'
        };
      })
      .filter((item) => ['Expired', 'Due Soon'].includes(item.state))
      .sort((left, right) => (priorityScore(left.state) - priorityScore(right.state)) || ((left.daysRemaining ?? 9999) - (right.daysRemaining ?? 9999)));
  }, [renewals]);

  const outsourcingAlerts = useMemo(() => {
    return outsourcingRows
      .map((item) => {
        const daysRemaining = Number.isFinite(Number(item.daysRemaining)) ? Number(item.daysRemaining) : null;
        const state = item.alertState || 'Open';
        return {
          module: 'Outsourcing',
          id: item.id,
          title: item.title || item.workType || 'Outsourcing',
          detail: item.vendorName || item.clientName || item.projectName || item.description || '-',
          state,
          dueDate: item.dueDate || '',
          daysRemaining,
          amount: Number(item.totalAmount || item.baseAmount || 0),
          route: '/app/outsourcing'
        };
      })
      .filter((item) => ['Pending Approval', 'Due Soon', 'Overdue'].includes(item.state))
      .sort((left, right) => (priorityScore(left.state) - priorityScore(right.state)) || ((left.daysRemaining ?? 9999) - (right.daysRemaining ?? 9999)));
  }, [outsourcingRows]);

  const moduleCounts = useMemo(() => ({
    all: amcAlerts.length + renewalAlerts.length + outsourcingAlerts.length,
    amc: amcAlerts.length,
    renewals: renewalAlerts.length,
    outsourcing: outsourcingAlerts.length
  }), [amcAlerts.length, outsourcingAlerts.length, renewalAlerts.length]);

  const filteredAlerts = useMemo(() => {
    const query = search.trim().toLowerCase();
    let rows = [...amcAlerts, ...renewalAlerts, ...outsourcingAlerts];

    if (moduleFilter !== 'all') {
      rows = rows.filter((item) => {
        if (moduleFilter === 'amc') return item.module === 'AMC';
        if (moduleFilter === 'renewals') return item.module === 'Renewal' || item.module === 'AMC Renewal';
        if (moduleFilter === 'outsourcing') return item.module === 'Outsourcing';
        return true;
      });
    }

    if (query) {
      rows = rows.filter((item) => {
        return [
          item.module,
          item.title,
          item.detail,
          item.state,
          item.dueDate,
          String(item.amount || '')
        ].some((field) => String(field || '').toLowerCase().includes(query));
      });
    }

    return rows;
  }, [amcAlerts, moduleFilter, renewalAlerts, outsourcingAlerts, search]);

  const statusCounts = useMemo(() => {
    const counts = {
      all: filteredAlerts.length,
      'due soon': 0,
      expired: 0,
      'pending approval': 0,
      overdue: 0,
      scheduled: 0
    };

    filteredAlerts.forEach((item) => {
      const key = String(item.state || '').trim().toLowerCase();
      if (counts[key] != null) counts[key] += 1;
    });

    return counts;
  }, [filteredAlerts]);

  const visibleAlerts = useMemo(() => {
    let rows = filteredAlerts;

    if (statusFilter !== 'all') {
      rows = rows.filter((item) => String(item.state || '').trim().toLowerCase() === statusFilter);
    }

    return [...rows].sort((left, right) => (priorityScore(left.state) - priorityScore(right.state)) || ((left.daysRemaining ?? 9999) - (right.daysRemaining ?? 9999)));
  }, [filteredAlerts, statusFilter]);

  const moduleView = useMemo(() => {
    if (moduleFilter === 'amc') {
      return {
        title: 'AMC alerts',
        helper: 'Due soon and expired AMC records',
        items: amcAlerts,
        count: amcAlerts.length
      };
    }

    if (moduleFilter === 'renewals') {
      return {
        title: 'Renewal alerts',
        helper: 'Renewals that need follow-up',
        items: renewalAlerts,
        count: renewalAlerts.length
      };
    }

    if (moduleFilter === 'outsourcing') {
      return {
        title: 'Outsourcing alerts',
        helper: 'Approval and payment items',
        items: outsourcingAlerts,
        count: outsourcingAlerts.length
      };
    }

    return {
      title: 'Priority queue',
      helper: 'Top alerts across AMC, renewals, and outsourcing',
      items: visibleAlerts,
      count: visibleAlerts.length
    };
  }, [amcAlerts, moduleFilter, outsourcingAlerts, renewalAlerts, visibleAlerts]);

  const stats = useMemo(() => {
    const amcDueSoon = Number(dashboard?.amcExpiringSoon ?? amcAlerts.length);
    const renewalsDueSoon = Number(dashboard?.renewalsExpiringSoon ?? renewalAlerts.filter((item) => item.state === 'Due Soon').length);
    const renewalsExpired = Number(dashboard?.renewalsExpired ?? renewalAlerts.filter((item) => item.state === 'Expired').length);
    const outsourcingPendingApproval = Number(dashboard?.outsourcingPendingApproval ?? outsourcingAlerts.filter((item) => item.state === 'Pending Approval').length);
    const outsourcingDueSoon = Number(dashboard?.outsourcingDueSoon ?? outsourcingAlerts.filter((item) => item.state === 'Due Soon').length);
    const outsourcingOverdue = Number(dashboard?.outsourcingOverdue ?? outsourcingAlerts.filter((item) => item.state === 'Overdue').length);

    return {
      amcDueSoon,
      renewalsDueSoon,
      renewalsExpired,
      outsourcingPendingApproval,
      outsourcingDueSoon,
      outsourcingOverdue,
      combined: visibleAlerts.length
    };
  }, [amcAlerts.length, dashboard, outsourcingAlerts, renewalAlerts, visibleAlerts.length]);

  const historyRows = useMemo(() => ([
    {
      title: 'AMC automation',
      summary: amcAutomation,
      href: '/app/amc',
      accent: 'text-blue-600'
    },
    {
      title: 'Outsourcing automation',
      summary: outsourcingAutomation,
      href: '/app/outsourcing',
      accent: 'text-violet-600'
    }
  ]), [amcAutomation, outsourcingAutomation]);

  function openItem(item) {
    navigate(item.route || '/app/notifications');
  }

  async function handleRefresh() {
    try {
      await loadData({ silent: true });
      toast.success('Automation monitor refreshed');
    } catch (error) {
      toast.error(error.message || 'Unable to refresh automation monitor');
    }
  }

  async function runAutomation(scope) {
    const isAmc = scope === 'amc';
    const permission = isAmc ? 'amc.write' : 'outsourcing.write';
    if (!hasPermission(permission)) {
      toast.error('You do not have permission to run this automation');
      return;
    }

    setActionBusy(scope);
    try {
      const endpoint = isAmc ? '/amc/automation/run' : '/outsourcing/automation/run';
      const response = await api.resources.create(endpoint, { dryRun: false }, token);
      const summary = response?.data || {};
      toast.success(isAmc
        ? `AMC automation completed: ${summary.remindersSent || 0} reminders, ${summary.invoicesCreated || 0} invoices`
        : `Outsourcing automation completed: ${summary.alertsSent || 0} alerts, ${summary.remindersSent || 0} reminders`);
      await loadData({ silent: true });
    } catch (error) {
      toast.error(error.message || 'Unable to run automation');
    } finally {
      setActionBusy(null);
      setRunTarget(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">Automation Monitor</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">AMC, renewals, and outsourcing alerts in one view</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleRefresh} variant="outline" className="bg-white shadow-sm border-slate-200 hover:bg-slate-50 gap-2 font-medium">
            <RefreshCcw size={16} className="text-slate-500" />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button as={Link} to="/app/notifications" variant="outline" className="bg-white shadow-sm border-slate-200 hover:bg-slate-50 gap-2 font-medium">
            <Bell size={16} className="text-slate-500" />
            Notifications
            <ChevronDown size={14} className="text-slate-400 ml-1" />
          </Button>
          <Button as={Link} to="/app/reports" variant="outline" className="bg-white shadow-sm border-slate-200 hover:bg-slate-50 gap-2 font-medium">
            <BarChart3 size={16} className="text-slate-500" />
            Reports
            <ChevronDown size={14} className="text-slate-400 ml-1" />
          </Button>
        </div>
      </div>

      <div className="w-full flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative w-full lg:max-w-md">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search alerts, records, dates, amounts..."
              className="h-11 pl-11 bg-white shadow-sm border-slate-200"
              style={{ borderRadius: 'var(--radius-input, 0.75rem)' }}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 border border-slate-200 bg-slate-50 p-1 text-slate-400 cursor-pointer hover:bg-slate-100" style={{ borderRadius: 'var(--radius-button, 0.5rem)' }}>
              <Filter size={14} />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {hasPermission('amc.write') ? (
              <Button
                type="button"
                onClick={() => setRunTarget('amc')}
                disabled={actionBusy === 'amc'}
                className="gap-2 bg-[var(--primary)] hover:opacity-90 text-white shadow-sm font-medium h-11 px-5 border-none"
                style={{ borderRadius: 'var(--radius-button, 0.5rem)' }}
              >
                <Play size={16} fill="currentColor" />
                {actionBusy === 'amc' ? 'Running AMC...' : 'Run AMC'}
              </Button>
            ) : null}
            {hasPermission('outsourcing.write') ? (
              <Button
                type="button"
                onClick={() => setRunTarget('outsourcing')}
                disabled={actionBusy === 'outsourcing'}
                className="gap-2 bg-[var(--primary)] hover:opacity-90 text-white shadow-sm font-medium h-11 px-5 border-none"
                style={{ borderRadius: 'var(--radius-button, 0.5rem)' }}
              >
                <Play size={16} fill="currentColor" />
                {actionBusy === 'outsourcing' ? 'Running Outsourcing...' : 'Run Outsourcing'}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex w-full overflow-x-auto hide-scrollbar border-b border-slate-200 mt-2">
          <div className="flex items-center pr-4 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 border-b-2 border-transparent shrink-0">
            <Filter size={12} className="mr-1.5" /> Module
          </div>
          {[
            { key: 'all', label: 'All', count: moduleCounts.all },
            { key: 'amc', label: 'AMC', count: moduleCounts.amc },
            { key: 'renewals', label: 'Renewals', count: moduleCounts.renewals },
            { key: 'outsourcing', label: 'Outsourcing', count: moduleCounts.outsourcing }
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={moduleFilter === item.key}
              onClick={() => {
                setModuleFilter(item.key);
                setStatusFilter('all');
              }}
              className={`shrink-0 whitespace-nowrap px-4 py-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 ${
                moduleFilter === item.key
                  ? 'border-[var(--primary)] text-[var(--primary)]'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <span>{item.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${moduleFilter === item.key ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                {item.count}
              </span>
            </button>
          ))}

          <div className="w-px h-6 bg-slate-200 mx-5 self-center shrink-0"></div>

          <div className="flex items-center px-4 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 border-b-2 border-transparent shrink-0">
            Status
          </div>
          {[
            { key: 'all', label: 'All' },
            { key: 'due soon', label: 'Due Soon' },
            { key: 'expired', label: 'Expired' },
            { key: 'pending approval', label: 'Pending Approval' },
            { key: 'overdue', label: 'Overdue' },
            { key: 'scheduled', label: 'Scheduled' }
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={statusFilter === item.key}
              onClick={() => setStatusFilter(item.key)}
              className={`shrink-0 whitespace-nowrap px-4 py-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 ${
                statusFilter === item.key
                  ? 'border-[var(--primary)] text-[var(--primary)]'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {item.label}
              {item.key !== 'all' && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusFilter === item.key ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                  {statusCounts[item.key] ?? 0}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <div className="inline-flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${refreshing ? 'bg-amber-400' : 'bg-emerald-500'}`} />
          {refreshing ? 'Live refresh in progress' : 'Auto-refresh every 60 seconds'}
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5">
          Showing {visibleAlerts.length} filtered alerts
        </div>
      </div>

      <ConfirmModal
        open={Boolean(runTarget)}
        title={runTarget === 'amc' ? 'Run AMC automation?' : 'Run outsourcing automation?'}
        description={
          runTarget === 'amc'
            ? 'This will evaluate AMC records, send reminders, and create eligible invoices.'
            : 'This will evaluate outsourcing records, send approval/payment alerts, and update automation logs.'
        }
        confirmText={runTarget === 'amc' ? 'Run AMC' : 'Run Outsourcing'}
        cancelText="Cancel"
        type="warning"
        isLoading={Boolean(actionBusy)}
        onCancel={() => setRunTarget(null)}
        onConfirm={() => runAutomation(runTarget)}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard icon={RotateCcw} label="AMC Due Soon" value={loading ? '...' : stats.amcDueSoon} helper="Upcoming AMC renewals" tone="blue" />
        <MetricCard icon={Clock3} label="Renewals Due" value={loading ? '...' : stats.renewalsDueSoon} helper="Renewals inside 30 days" tone="amber" />
        <MetricCard icon={TriangleAlert} label="Renewals Expired" value={loading ? '...' : stats.renewalsExpired} helper="Need immediate follow-up" tone="rose" />
        <MetricCard icon={Building2} label="Outsourcing Pending" value={loading ? '...' : stats.outsourcingPendingApproval} helper="Waiting for approval" tone="violet" />
        <MetricCard icon={Banknote} label="Outsourcing Due" value={loading ? '...' : stats.outsourcingDueSoon} helper="Approvals done, payment due" tone="sky" />
        <MetricCard icon={TriangleAlert} label="Outsourcing Overdue" value={loading ? '...' : stats.outsourcingOverdue} helper="Overdue payables" tone="orange" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SummaryRunCard
          title="AMC Automation"
          summary={amcAutomation}
          href="/app/amc"
          icon={RefreshCcw}
          linkText="View AMC Details"
          labels={[
            { label: 'Reminders Sent', key: 'remindersSent', growth: '+12%', icon: Mail, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-500', cellBg: 'bg-indigo-50/30' },
            { label: 'Invoices Created', key: 'invoicesCreated', growth: '+8%', icon: FileText, iconBg: 'bg-blue-50', iconColor: 'text-blue-500', cellBg: 'bg-blue-50/30' },
            { label: 'Skipped', key: 'skipped', growth: '+2%', icon: Clock3, iconBg: 'bg-amber-50', iconColor: 'text-amber-500', cellBg: 'bg-amber-50/30' },
            { label: 'Failures', key: 'failures', growth: '-', icon: XCircle, iconBg: 'bg-rose-50', iconColor: 'text-rose-500', cellBg: 'bg-rose-50/30' }
          ]}
        />
        <SummaryRunCard
          title="Outsourcing Automation"
          summary={outsourcingAutomation}
          href="/app/outsourcing"
          icon={Workflow}
          linkText="View Outsourcing Details"
          labels={[
            { label: 'Alerts Generated', key: 'alertsSent', growth: '+18%', icon: Bell, iconBg: 'bg-purple-50', iconColor: 'text-purple-500', cellBg: 'bg-purple-50/30' },
            { label: 'Reminders Sent', key: 'remindersSent', growth: '+10%', icon: Clock3, iconBg: 'bg-blue-50', iconColor: 'text-blue-500', cellBg: 'bg-blue-50/30' },
            { label: 'Skipped', key: 'skipped', growth: '+1%', icon: Clock3, iconBg: 'bg-amber-50', iconColor: 'text-amber-500', cellBg: 'bg-amber-50/30' },
            { label: 'Failures', key: 'failures', growth: '-', icon: XCircle, iconBg: 'bg-rose-50', iconColor: 'text-rose-500', cellBg: 'bg-rose-50/30' }
          ]} 
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <AutomationLogSection
          title="AMC automation logs"
          feed={amcAutomationLogs}
          accent="text-blue-600"
          icon={Bot}
          iconBg="bg-purple-100"
          iconColor="text-purple-600"
          bgSoft="bg-purple-50/50"
        />
        <AutomationLogSection
          title="Outsourcing automation logs"
          feed={outsourcingAutomationLogs}
          accent="text-violet-600"
          icon={Bot}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          bgSoft="bg-blue-50/50"
        />
      </div>

      <div className="pt-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Automation history</h2>
          <p className="mt-1 text-xs text-slate-500">Latest automation runs and what they affected</p>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {historyRows.map((row) => (
            <RunHistoryRow
              key={row.title}
              title={row.title}
              summary={row.summary}
              href={row.href}
              accent={row.title.includes('AMC') ? 'text-purple-600' : 'text-blue-600'}
              icon={row.title.includes('AMC') ? RefreshCcw : Workflow}
              iconBg={row.title.includes('AMC') ? 'bg-purple-100' : 'bg-blue-100'}
              iconColor={row.title.includes('AMC') ? 'text-purple-600' : 'text-blue-600'}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="shadow-sm border border-slate-100" style={{ borderRadius: 'var(--radius-card, 1.5rem)' }}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-3">
                <div className="w-10 h-10 rounded-[12px] flex items-center justify-center relative overflow-hidden shrink-0">
                  <div className="absolute inset-0 opacity-10" style={{ backgroundColor: 'var(--primary)' }}></div>
                  <TriangleAlert size={18} strokeWidth={2.5} style={{ color: 'var(--primary)' }} className="relative z-10" />
                </div>
                {moduleView.title}
              </h2>
              <p className="mt-1 text-xs text-slate-500">{moduleView.helper}</p>
            </div>
            <Badge tone="info" className="border-slate-200 bg-slate-50 text-slate-600">
              {moduleView.count} items
            </Badge>
          </div>

          <div className="mt-4 space-y-3">
            {moduleView.items.length ? (
              <div className="flex flex-col gap-2">
                {moduleView.items.map((item) => (
                  <PriorityAlertRow key={`${item.module}-${item.id}-${item.title}`} item={item} onOpen={openItem} />
                ))}
              </div>
            ) : (
              <EmptyState message="No active automation alerts right now." />
            )}
            <div className="pt-4 flex justify-center">
              <Link to="/app/notifications" className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
                View all alerts <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </Card>

        <Card className="shadow-sm border border-slate-100 bg-white" style={{ borderRadius: 'var(--radius-card, 1.5rem)' }}>
          <div className="flex items-center justify-between gap-3 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-3">
                <div className="w-10 h-10 rounded-[12px] flex items-center justify-center relative overflow-hidden shrink-0">
                  <div className="absolute inset-0 opacity-10" style={{ backgroundColor: 'var(--primary)' }}></div>
                  <Zap size={18} strokeWidth={2.5} style={{ color: 'var(--primary)' }} className="relative z-10" />
                </div>
                Quick actions
              </h2>
              <p className="mt-1 text-xs text-slate-500">Jump into the relevant module fast</p>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {[
              { label: 'Run AMC Automation', desc: 'Process AMC reminders and invoice creation', to: '#', icon: Play, iconColor: 'text-[var(--primary)]', iconBg: 'bg-[color-mix(in_srgb,var(--primary)_15%,transparent)]' },
              { label: 'Run Outsourcing Automation', desc: 'Generate alerts and reminders', to: '#', icon: Building2, iconColor: 'text-[var(--primary)]', iconBg: 'bg-[color-mix(in_srgb,var(--primary)_15%,transparent)]' },
              { label: 'View Reports', desc: 'Check automation performance and logs', to: '/app/reports', icon: BarChart3, iconColor: 'text-[var(--primary)]', iconBg: 'bg-[color-mix(in_srgb,var(--primary)_15%,transparent)]' },
              { label: 'Open Real-time Inbox', desc: 'View all live alerts and notifications', to: '/app/notifications', icon: Bell, iconColor: 'text-[var(--primary)]', iconBg: 'bg-[color-mix(in_srgb,var(--primary)_15%,transparent)]' }
            ].map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="flex items-center gap-4 transition group"
              >
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] ${item.iconBg} ${item.iconColor} transition-colors group-hover:bg-[color-mix(in_srgb,var(--primary)_25%,transparent)]`}>
                  <item.icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 group-hover:text-[var(--primary)] transition-colors">{item.label}</div>
                  <div className="mt-0.5 text-[11px] font-medium text-slate-500">{item.desc}</div>
                </div>
                <ArrowUpRight size={14} className="text-slate-400 group-hover:text-[var(--primary)] transition-colors" />
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {moduleFilter === 'all' ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="shadow-sm border border-slate-100" style={{ borderRadius: 'var(--radius-card, 1.5rem)' }}>
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[12px] flex items-center justify-center relative overflow-hidden shrink-0">
                    <div className="absolute inset-0 opacity-10" style={{ backgroundColor: 'var(--primary)' }}></div>
                    <ShieldAlert size={18} strokeWidth={2.5} style={{ color: 'var(--primary)' }} className="relative z-10" />
                  </div>
                  AMC alerts
                </h2>
                <p className="mt-1 text-xs text-slate-500">Due soon and expired AMC records</p>
              </div>
              <Badge tone="info" className="border-slate-200 bg-slate-50 text-slate-600">
                {amcAlerts.length}
              </Badge>
            </div>
            <div className="mt-4 space-y-3">
              {hasPermission('amc.read') ? (
                amcAlerts.length ? amcAlerts.slice(0, 5).map((item) => (
                  <AlertRow key={`amc-${item.id}`} item={item} onOpen={openItem} />
                )) : (
                  <EmptyState message="No AMC items need attention right now." />
                )
              ) : (
                <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                  AMC details are hidden for this role.
                </div>
              )}
            </div>
          </Card>

          <Card className="shadow-sm border border-slate-100" style={{ borderRadius: 'var(--radius-card, 1.5rem)' }}>
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[12px] flex items-center justify-center relative overflow-hidden shrink-0">
                    <div className="absolute inset-0 opacity-10" style={{ backgroundColor: 'var(--primary)' }}></div>
                    <CalendarClock size={18} strokeWidth={2.5} style={{ color: 'var(--primary)' }} className="relative z-10" />
                  </div>
                  Renewal alerts
                </h2>
                <p className="mt-1 text-xs text-slate-500">Renewals that need follow-up</p>
              </div>
              <Badge tone="info" className="border-slate-200 bg-slate-50 text-slate-600">
                {renewalAlerts.length}
              </Badge>
            </div>
            <div className="mt-4 space-y-3">
              {renewalAlerts.length ? renewalAlerts.slice(0, 5).map((item) => (
                <AlertRow key={`renewal-${item.id}-${item.title}`} item={item} onOpen={openItem} />
              )) : (
                <EmptyState message="No renewal alerts right now." />
              )}
            </div>
          </Card>

          <Card className="shadow-sm border border-slate-100" style={{ borderRadius: 'var(--radius-card, 1.5rem)' }}>
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[12px] flex items-center justify-center relative overflow-hidden shrink-0">
                    <div className="absolute inset-0 opacity-10" style={{ backgroundColor: 'var(--primary)' }}></div>
                    <Building2 size={18} strokeWidth={2.5} style={{ color: 'var(--primary)' }} className="relative z-10" />
                  </div>
                  Outsourcing alerts
                </h2>
                <p className="mt-1 text-xs text-slate-500">Approval and payment items</p>
              </div>
              <Badge tone="info" className="border-slate-200 bg-slate-50 text-slate-600">
                {outsourcingAlerts.length}
              </Badge>
            </div>
            <div className="mt-4 space-y-3">
              {hasPermission('outsourcing.read') ? (
                outsourcingAlerts.length ? outsourcingAlerts.slice(0, 5).map((item) => (
                  <AlertRow key={`outsourcing-${item.id}-${item.title}`} item={item} onOpen={openItem} />
                )) : (
                  <EmptyState message="No outsourcing alerts right now." />
                )
              ) : (
                <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                  Outsourcing details are hidden for this role.
                </div>
              )}
            </div>
          </Card>
        </div>
      ) : (
        <Card className="shadow-sm border border-slate-100" style={{ borderRadius: 'var(--radius-card, 1.5rem)' }}>
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-3">
                <div className="w-10 h-10 rounded-[12px] flex items-center justify-center relative overflow-hidden shrink-0">
                  <div className="absolute inset-0 opacity-10" style={{ backgroundColor: 'var(--primary)' }}></div>
                  <TriangleAlert size={18} strokeWidth={2.5} style={{ color: 'var(--primary)' }} className="relative z-10" />
                </div>
                {moduleView.title}
              </h2>
              <p className="mt-1 text-xs text-slate-500">{moduleView.helper}</p>
            </div>
            <Badge tone="info" className="border-slate-200 bg-slate-50 text-slate-600">
              {moduleView.count}
            </Badge>
          </div>
          <div className="mt-4 space-y-3">
            {moduleView.items.length ? (
              moduleView.items.slice(0, 8).map((item) => (
                <AlertRow key={`${item.module}-${item.id}-${item.title}`} item={item} onOpen={openItem} />
              ))
            ) : (
              <EmptyState message="No alerts match this tab." />
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
