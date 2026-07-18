import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  FileText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Building2,
  BriefcaseBusiness,
  IndianRupee,
  AlarmClock
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { PageLoader } from '../../components/ui/Loader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/Table';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { formatDateOnlyDisplay } from '../../lib/dateOnly';

function formatMoney(value) {
  return Number(value || 0).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  });
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 19);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function computeDaysRemaining(amc = {}) {
  if (typeof amc.daysRemaining === 'number') return amc.daysRemaining;
  const target = amc.nextInvoiceDate || amc.endDate;
  if (!target) return null;
  const end = new Date(target);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
}

function getStatusTone(status = '') {
  const value = String(status || '').trim().toLowerCase();
  if (!value) return 'neutral';
  if (value === 'active' || value === 'renewed') return 'success';
  if (value === 'due soon' || value === 'on hold') return 'warning';
  if (value === 'expired' || value === 'cancelled') return 'danger';
  return 'info';
}

function getAutomationTone(amc = {}, daysRemaining = null) {
  if (String(amc.status || '').trim() === 'Cancelled') return 'danger';
  if (amc.autoInvoice && daysRemaining != null && daysRemaining <= 0) return 'warning';
  if (amc.autoInvoice && daysRemaining != null && daysRemaining <= (Number(amc.reminderDays) || 7)) return 'info';
  if (amc.autoInvoice) return 'success';
  return 'neutral';
}

function resolveLookupLabel(items = [], value = '') {
  const needle = String(value || '').trim();
  if (!needle) return '-';
  const match = items.find((item) => String(item.id || '').trim() === needle || String(item.name || '').trim() === needle);
  return match?.name || needle;
}

function formatHistoryLabel(value = '') {
  return String(value || '-')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getHistoryTone(value = '') {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return 'neutral';
  if (text === 'success') return 'success';
  if (text === 'warning') return 'warning';
  if (text === 'error') return 'danger';
  if (text === 'skipped') return 'info';
  return 'neutral';
}

function getHistoryActionTone(action = '') {
  const text = String(action || '').trim().toLowerCase();
  if (text.includes('failed')) return 'danger';
  if (text.includes('skipped')) return 'info';
  if (text.includes('created')) return 'success';
  if (text.includes('sent')) return 'info';
  return 'neutral';
}

function getHistoryStatusTone(status = '') {
  const text = String(status || '').trim().toLowerCase();
  if (text === 'success') return 'success';
  if (text === 'warning') return 'warning';
  if (text === 'error') return 'danger';
  if (text === 'skipped') return 'info';
  return 'neutral';
}

function escapeCsvValue(value) {
  if (value == null) return '';
  const text = String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsvFile(filename, rows = []) {
  const headers = ['Time', 'Action', 'Status', 'Due Date', 'Invoice', 'Message', 'Run Source'];
  const lines = [
    headers.join(','),
    ...rows.map((row) => ([
      escapeCsvValue(formatDateTime(row.createdAt)),
      escapeCsvValue(String(row.action || '').replaceAll('_', ' ')),
      escapeCsvValue(row.status || ''),
      escapeCsvValue(row.dueDate ? formatDateOnlyDisplay(row.dueDate) : ''),
      escapeCsvValue(row.invoiceNumber || row.invoiceId || ''),
      escapeCsvValue(row.message || ''),
      escapeCsvValue(row.runSource || '')
    ].join(',')))
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export function AmcDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, hasPermission } = useAuth();

  const [amc, setAmc] = useState(null);
  const [client, setClient] = useState(null);
  const [project, setProject] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [history, setHistory] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyAction, setHistoryAction] = useState('all');
  const [historyStatus, setHistoryStatus] = useState('all');
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [lookups, setLookups] = useState({ amcTypes: [], billingCycles: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const [amcRes, amcTypesRes, billingCyclesRes] = await Promise.all([
          api.resources.get('/amc', id, token),
          api.resources.list('/masters/amc_type', token),
          api.resources.list('/masters/billing_cycle', token)
        ]);

        if (!active) return;

        const data = amcRes.data || null;
        setAmc(data);
        setLookups({
          amcTypes: amcTypesRes.data || [],
          billingCycles: billingCyclesRes.data || []
        });

        const extra = [];
        if (data?.clientId) {
          extra.push(api.resources.get('/clients', data.clientId, token).then((res) => { if (active) setClient(res.data || null); }).catch(() => {}));
        }
        if (data?.projectId) {
          extra.push(api.resources.get('/projects', data.projectId, token).then((res) => { if (active) setProject(res.data || null); }).catch(() => {}));
        }
        if (data?.lastGeneratedInvoiceId) {
          extra.push(api.resources.get('/invoices', data.lastGeneratedInvoiceId, token).then((res) => { if (active) setInvoice(res.data || null); }).catch(() => {}));
        }
        extra.push(
          api.resources.list(`/amc/${id}/automation-history`, token, '', { limit: 12 })
            .then((res) => {
              if (active) setHistory(res.data || []);
            })
            .catch(() => {
              if (active) setHistory([]);
            })
        );

        await Promise.allSettled(extra);
      } catch (error) {
        if (!active) return;
        toast.error(error.message || 'Unable to load AMC');
        navigate('/app/amc');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [id, navigate, token]);

  const dueDate = amc?.nextInvoiceDate || amc?.endDate || null;
  const daysRemaining = computeDaysRemaining(amc || {});
  const renewalStatus = amc?.renewalStatus || amc?.status || 'Active';
  const amcTypeLabel = useMemo(
    () => resolveLookupLabel(lookups.amcTypes, amc?.amcType),
    [amc?.amcType, lookups.amcTypes]
  );
  const billingCycleLabel = useMemo(
    () => resolveLookupLabel(lookups.billingCycles, amc?.billingCycle),
    [amc?.billingCycle, lookups.billingCycles]
  );
  const automationState = useMemo(() => {
    if (!amc) return 'Pending';
    if (String(amc.status || '').trim() === 'Cancelled') return 'Disabled';
    if (amc.autoInvoice && daysRemaining != null && daysRemaining <= 0) return 'Invoice due';
    if (amc.autoInvoice && daysRemaining != null && daysRemaining <= (Number(amc.reminderDays) || 7)) return 'Reminder window';
    if (amc.autoInvoice) return 'Scheduled';
    return 'Manual only';
  }, [amc, daysRemaining]);
  const automationHistoryColumns = useMemo(() => [
    { key: 'createdAt', label: 'Time', type: 'date' },
    {
      key: 'action',
      label: 'Action',
      type: 'badge',
      render: (row) => formatHistoryLabel(row.action)
    },
    { key: 'status', label: 'Status', type: 'badge' },
    { key: 'dueDate', label: 'Due Date', type: 'date' },
    {
      key: 'invoiceNumber',
      label: 'Invoice',
      render: (row) => row.invoiceNumber || row.invoiceId || '-'
    },
    {
      key: 'message',
      label: 'Message',
      render: (row) => row.message || '-',
      ellipsis: true
    }
  ], []);
  const historyActionOptions = useMemo(() => {
    const counts = history.reduce((acc, item) => {
      const key = String(item.action || '').trim();
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return [
      { label: `All (${history.length})`, value: 'all' },
      ...Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)).map(([value, count]) => ({
        label: `${formatHistoryLabel(value)} (${count})`,
        value
      }))
    ];
  }, [history]);
  const historyStatusOptions = useMemo(() => {
    const counts = history.reduce((acc, item) => {
      const key = String(item.status || '').trim();
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return [
      { label: 'All statuses', value: 'all' },
      ...Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)).map(([value, count]) => ({
        label: `${value} (${count})`,
        value
      }))
    ];
  }, [history]);
  const filteredHistory = useMemo(() => {
    const search = String(historySearch || '').trim().toLowerCase();
    return history.filter((item) => {
      const action = String(item.action || '').trim();
      const status = String(item.status || '').trim();
      const message = String(item.message || '').trim().toLowerCase();
      const invoiceNumber = String(item.invoiceNumber || '').trim().toLowerCase();
      if (historyAction !== 'all' && action !== historyAction) return false;
      if (historyStatus !== 'all' && status !== historyStatus) return false;
      if (search && !(`${action} ${status} ${message} ${invoiceNumber}`.includes(search))) return false;
      return true;
    });
  }, [history, historyAction, historySearch, historyStatus]);
  const historyActionChips = useMemo(() => historyActionOptions, [historyActionOptions]);
  const historyStatusChips = useMemo(() => {
    const counts = history.reduce((acc, item) => {
      const key = String(item.status || '').trim() || 'Unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return [
      { key: 'all', label: `All statuses (${history.length})`, value: 'all', tone: 'neutral' },
      ...Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)).map(([value, count]) => ({
        key: value,
        label: `${value} (${count})`,
        value,
        tone: getHistoryStatusTone(value)
      }))
    ];
  }, [history]);

  if (loading) return <PageLoader />;
  if (!amc) return null;

  const linkedInvoice = invoice?.id ? invoice : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/app/amc')}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800"
            >
              <ArrowLeft size={16} />
              Back to AMC
            </button>
            <span className="text-slate-300">/</span>
            <h1 className="text-base font-semibold tracking-tight text-[var(--text-main)]">
              {amc.title || amc.amcType || 'AMC'}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={getStatusTone(renewalStatus)}>{renewalStatus}</Badge>
            <Badge tone={getAutomationTone(amc, daysRemaining)}>{automationState}</Badge>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
              {amcTypeLabel}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
              {billingCycleLabel}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {linkedInvoice && hasPermission('invoices.read') ? (
            <Button variant="outline" onClick={() => navigate(`/app/invoices/${linkedInvoice.id}`)}>
              <FileText size={16} className="mr-2" />
              Open Invoice
            </Button>
          ) : null}
          {hasPermission('amc.write') ? (
            <Button
              variant="outline"
              onClick={async () => {
                setBusy(true);
                try {
                  const response = await api.resources.create('/amc/automation/run', { dryRun: true }, token);
                  const result = response.data || {};
                  toast.success(`Preview ready: ${result.remindersSent || 0} reminders, ${result.invoicesCreated || 0} invoices`);
                } catch (error) {
                  toast.error(error.message || 'Unable to preview automation');
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
            >
              <RefreshCw size={16} className={busy ? 'mr-2 animate-spin' : 'mr-2'} />
              Preview Automation
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="px-4 py-6 md:px-5 flex items-center gap-4 shadow-sm border border-slate-100 rounded-[16px]">
          <div className="shrink-0 w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-emerald-50/80 text-emerald-500">
            <IndianRupee size={24} strokeWidth={2} />
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">AMC Amount</p>
            <h3 className="text-lg md:text-xl font-bold text-slate-800 leading-tight truncate">{formatMoney(amc.amcAmount)}</h3>
            <p className="mt-1 text-xs text-slate-400 truncate">Recurring service value</p>
          </div>
        </Card>

        <Card className="px-4 py-6 md:px-5 flex items-center gap-4 shadow-sm border border-slate-100 rounded-[16px]">
          <div className="shrink-0 w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-blue-50/80 text-blue-500">
            <AlarmClock size={24} strokeWidth={2} />
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">Due In</p>
            <h3 className="text-lg md:text-xl font-bold text-slate-800 leading-tight truncate">
              {daysRemaining == null ? '—' : daysRemaining < 0 ? `Overdue ${Math.abs(daysRemaining)}d` : daysRemaining === 0 ? 'Due today' : `${daysRemaining}d`}
            </h3>
            <p className="mt-1 text-xs text-slate-400 truncate">{dueDate ? formatDateOnlyDisplay(dueDate) : 'No due date set'}</p>
          </div>
        </Card>

        <Card className="px-4 py-6 md:px-5 flex items-center gap-4 shadow-sm border border-slate-100 rounded-[16px]">
          <div className="shrink-0 w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-amber-50/80 text-amber-500">
            <Sparkles size={24} strokeWidth={2} />
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">Automation</p>
            <h3 className="text-lg md:text-xl font-bold text-slate-800 leading-tight truncate">{automationState}</h3>
            <p className="mt-1 text-xs text-slate-400 truncate">Auto invoice {amc.autoInvoice ? 'enabled' : 'disabled'}</p>
          </div>
        </Card>

        <Card className="px-4 py-6 md:px-5 flex items-center gap-4 shadow-sm border border-slate-100 rounded-[16px]">
          <div className="shrink-0 w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-purple-50/80 text-purple-500">
            <ShieldCheck size={24} strokeWidth={2} />
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">Reminder Window</p>
            <h3 className="text-lg md:text-xl font-bold text-slate-800 leading-tight truncate">{Number(amc.reminderDays || 0)} days</h3>
            <p className="mt-1 text-xs text-slate-400 truncate">Before due date</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h3 className="mb-4 text-lg font-semibold text-[var(--text-main)]">Automation Status</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-medium text-[var(--text-muted)]">Renewal Status</p>
                <p className="mt-1 text-base font-semibold text-[var(--text-main)]">{renewalStatus}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-medium text-[var(--text-muted)]">Next Invoice</p>
                <p className="mt-1 text-base font-semibold text-[var(--text-main)]">{dueDate ? formatDateOnlyDisplay(dueDate) : '-'}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-medium text-[var(--text-muted)]">Last Automation Run</p>
                <p className="mt-1 text-base font-semibold text-[var(--text-main)]">{formatDateTime(amc.lastAutomationRunAt)}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-medium text-[var(--text-muted)]">Last Reminder</p>
                <p className="mt-1 text-base font-semibold text-[var(--text-main)]">{formatDateTime(amc.lastReminderSentAt)}</p>
                <p className="mt-1 text-xs text-slate-400">{amc.lastReminderSentForDate ? `For ${formatDateOnlyDisplay(amc.lastReminderSentForDate)}` : 'No reminder sent yet'}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-medium text-[var(--text-muted)]">Last Invoice Generated</p>
                <p className="mt-1 text-base font-semibold text-[var(--text-main)]">{formatDateTime(amc.lastInvoiceGeneratedAt)}</p>
                <p className="mt-1 text-xs text-slate-400">{amc.lastInvoiceGeneratedForDate ? `For ${formatDateOnlyDisplay(amc.lastInvoiceGeneratedForDate)}` : 'No invoice generated yet'}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-medium text-[var(--text-muted)]">Last Generated Invoice</p>
                <p className="mt-1 text-base font-semibold text-[var(--text-main)]">{amc.lastGeneratedInvoiceNumber || linkedInvoice?.invoiceNumber || '-'}</p>
                <p className="mt-1 text-xs text-slate-400">{linkedInvoice ? 'Linked invoice available' : 'No linked invoice'}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="mb-4 text-lg font-semibold text-[var(--text-main)]">AMC Timeline</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-medium text-[var(--text-muted)]">Start Date</p>
                <p className="mt-1 text-base font-semibold text-[var(--text-main)]">{amc.startDate ? formatDateOnlyDisplay(amc.startDate) : '-'}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-medium text-[var(--text-muted)]">Renewal / End Date</p>
                <p className="mt-1 text-base font-semibold text-[var(--text-main)]">{amc.endDate ? formatDateOnlyDisplay(amc.endDate) : '-'}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-medium text-[var(--text-muted)]">Billing Cycle</p>
                <p className="mt-1 text-base font-semibold text-[var(--text-main)]">{billingCycleLabel}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-medium text-[var(--text-muted)]">Support Scope</p>
                <p className="mt-1 text-base font-semibold text-[var(--text-main)]">{amc.supportScope || '-'}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-medium text-[var(--text-muted)]">Support Hours</p>
                <p className="mt-1 text-base font-semibold text-[var(--text-main)]">{Number(amc.supportHours || 0)}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-medium text-[var(--text-muted)]">Response SLA</p>
                <p className="mt-1 text-base font-semibold text-[var(--text-main)]">{Number(amc.responseSlaHours || 0)} hrs</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-main)]">Automation History</h3>
                <p className="text-sm text-slate-500">Recent reminder, invoice, skip, and failure events for this AMC.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={history.length ? 'info' : 'neutral'}>{history.length} event{history.length === 1 ? '' : 's'}</Badge>
                <Button
                  variant="outline"
                  onClick={() => downloadCsvFile(`${(amc.title || amc.amcType || 'amc').replaceAll(' ', '_').toLowerCase()}-automation-history.csv`, filteredHistory)}
                  disabled={!filteredHistory.length}
                >
                  <Download size={16} className="mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
            <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.2fr)_220px_220px]">
              <Input
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder="Search action, message, invoice..."
              />
              <Select searchable={false} value={historyAction} onChange={setHistoryAction} options={historyActionOptions} />
              <Select searchable={false} value={historyStatus} onChange={setHistoryStatus} options={historyStatusOptions} />
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {historyActionChips.map((chip) => {
                const active = historyAction === chip.value;
                return (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => setHistoryAction(chip.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? 'border-[var(--primary)] bg-[var(--primary)] text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {historyStatusChips.map((chip) => {
                const active = historyStatus === chip.value;
                return (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => setHistoryStatus(chip.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? 'border-[var(--primary)] bg-[var(--primary)] text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
            <DataTable
              columns={automationHistoryColumns}
              rows={filteredHistory}
              selectable={false}
              emptyTitle="No automation history yet"
              emptyDescription="Adjust the filters or run AMC automation to create the first log entry."
              pageSize={5}
              onRowClick={(row) => setSelectedHistory(row)}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="mb-4 text-lg font-semibold text-[var(--text-main)]">Linked Records</h3>
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Building2 size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Client</p>
                    <p className="truncate text-sm font-semibold text-slate-900">{client?.companyName || client?.name || '-'}</p>
                  </div>
                </div>
                {client?.id ? (
                  <Button variant="ghost" className="mt-3 w-full justify-start px-0" onClick={() => navigate(`/app/clients/${client.id}`)}>
                    Open Client
                  </Button>
                ) : null}
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                    <BriefcaseBusiness size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Project</p>
                    <p className="truncate text-sm font-semibold text-slate-900">{project?.title || '-'}</p>
                  </div>
                </div>
                {project?.id ? (
                  <Button variant="ghost" className="mt-3 w-full justify-start px-0" onClick={() => navigate(`/app/projects/${project.id}`)}>
                    Open Project
                  </Button>
                ) : null}
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Last Invoice</p>
                    <p className="truncate text-sm font-semibold text-slate-900">{linkedInvoice?.invoiceNumber || amc.lastGeneratedInvoiceNumber || '-'}</p>
                    <p className="truncate text-xs text-slate-500">{linkedInvoice ? `Status: ${linkedInvoice.status || 'Draft'}` : 'No invoice linked yet'}</p>
                  </div>
                </div>
                {linkedInvoice?.id ? (
                  <Button variant="ghost" className="mt-3 w-full justify-start px-0" onClick={() => navigate(`/app/invoices/${linkedInvoice.id}`)}>
                    Open Invoice
                  </Button>
                ) : null}
              </div>
            </div>
          </Card>

          {amc.remarks ? (
            <Card className="p-6 bg-amber-50/60 border-amber-100">
              <h3 className="mb-2 text-sm font-semibold text-amber-800">Remarks</h3>
              <p className="whitespace-pre-wrap text-sm text-amber-900">{amc.remarks}</p>
            </Card>
          ) : null}
        </div>
      </div>

      <Modal
        open={Boolean(selectedHistory)}
        title="Automation Log Details"
        subtitle={selectedHistory ? `${formatHistoryLabel(selectedHistory.action)} · ${selectedHistory.status || 'Unknown status'}` : ''}
        onClose={() => setSelectedHistory(null)}
        width="min(880px, 96vw)"
      >
        {selectedHistory ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Time</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{formatDateTime(selectedHistory.createdAt)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Action</div>
                <div className="mt-2"><Badge tone={getHistoryActionTone(selectedHistory.action)}>{formatHistoryLabel(selectedHistory.action)}</Badge></div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Status</div>
                <div className="mt-2"><Badge tone={getHistoryTone(selectedHistory.status)}>{selectedHistory.status || '-'}</Badge></div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Due Date</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{selectedHistory.dueDate ? formatDateOnlyDisplay(selectedHistory.dueDate) : '-'}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Invoice</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{selectedHistory.invoiceNumber || selectedHistory.invoiceId || '-'}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Run Source</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{selectedHistory.runSource || '-'}</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Message</div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                {selectedHistory.message || 'No message stored for this event.'}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Payload</div>
              <pre className="max-h-72 overflow-auto rounded-2xl border border-slate-200 bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                {JSON.stringify(selectedHistory.payload || {}, null, 2)}
              </pre>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
