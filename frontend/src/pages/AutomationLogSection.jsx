import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Bot, Bell, AlertCircle, Clock3, XCircle, Search } from 'lucide-react';

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

function logTone(status = '') {
  const value = String(status || '').trim().toLowerCase();
  if (value.includes('error')) return 'danger';
  if (value.includes('warning')) return 'warning';
  if (value.includes('success') || value.includes('done') || value.includes('sent')) return 'success';
  return 'neutral';
}

function LogEntry({ entry, index, accent = 'text-slate-600' }) {
  const actionText = String(entry?.action || '-').replaceAll('_', ' ');
  const meta = [
    entry?.referenceName || entry?.invoiceNumber || entry?.referenceId || entry?.invoiceId || '',
    entry?.dueDate ? `Due ${entry.dueDate}` : '',
    entry?.runSource || ''
  ].filter(Boolean);

  return (
    <div className="rounded-[16px] border border-slate-100 bg-white px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs font-bold uppercase tracking-[0.16em] ${accent}`}>
              #{index + 1}
            </span>
            <Badge tone={logTone(entry?.status)} className="border-transparent">
              {entry?.status || 'Success'}
            </Badge>
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              {formatDateTime(entry?.createdAt)}
            </span>
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{actionText}</div>
          <div className="mt-1 text-xs text-slate-500">{entry?.message || 'No message recorded'}</div>
          {meta.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {meta.map((value) => (
                <span key={value} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {value}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="rounded-full bg-slate-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {entry?.runId || '-'}
        </div>
      </div>
    </div>
  );
}

export function AutomationLogSection({ title, feed, accent = 'text-slate-600', icon: Icon = Bot, iconBg = 'bg-slate-100', iconColor = 'text-slate-500', bgSoft = 'bg-slate-50' }) {
  const latestRun = feed?.latestRun || null;
  const entries = latestRun?.entries || [];
  const recentRuns = feed?.recentRuns || [];
  const affected = latestRun?.affectedAmcs ?? latestRun?.affectedRecords ?? 0;

  return (
    <Card className="shadow-sm border border-slate-100" style={{ borderRadius: 'var(--radius-card, 1.5rem)' }}>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[12px] flex items-center justify-center relative overflow-hidden shrink-0">
            <div className="absolute inset-0 opacity-10" style={{ backgroundColor: 'var(--primary)' }}></div>
            <Icon size={18} strokeWidth={2.5} style={{ color: 'var(--primary)' }} className="relative z-10" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            <p className="mt-0.5 text-xs font-medium text-slate-500">Latest run entries, shown line by line</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral" className="border-transparent bg-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px] px-3 py-1">
            {latestRun?.runId || 'No run'}
          </Badge>
          <Badge tone="neutral" className="border-transparent bg-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px] px-3 py-1">
            Events: {latestRun?.events ?? 0}
          </Badge>
          <Badge tone="neutral" className="border-transparent bg-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px] px-3 py-1">
            Affected: {affected}
          </Badge>
        </div>
      </div>

      <div className="mt-2 rounded-[20px] border border-slate-100 px-6 py-6 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[12px] flex items-center justify-center relative overflow-hidden shrink-0 shadow-sm border border-slate-200/50 bg-white">
              <div className="absolute inset-0 opacity-10 bg-slate-500"></div>
              <Clock3 size={18} strokeWidth={2.5} className="text-slate-500 relative z-10" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-indigo-600 mb-1">Latest run</div>
              <div className="text-sm font-bold text-slate-900">
                {latestRun?.runSource || 'Manual'} - {formatAgo(latestRun?.startedAt)}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-6 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            <div className="flex flex-col items-center gap-1.5 border-b-[3px] border-indigo-500 pb-2 min-w-[60px]">
              <div className="w-10 h-10 rounded-[12px] flex items-center justify-center relative overflow-hidden mb-1">
                <div className="absolute inset-0 opacity-10 bg-indigo-500"></div>
                <Bell size={18} strokeWidth={2.5} className="text-indigo-500 relative z-10" />
              </div>
              <span>Reminders</span>
              <span className="text-2xl font-bold text-slate-900 leading-none">{latestRun?.remindersSent ?? 0}</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 border-b-[3px] border-blue-500 pb-2 min-w-[60px]">
              <div className="w-10 h-10 rounded-[12px] flex items-center justify-center relative overflow-hidden mb-1">
                <div className="absolute inset-0 opacity-10 bg-blue-500"></div>
                <AlertCircle size={18} strokeWidth={2.5} className="text-blue-500 relative z-10" />
              </div>
              <span>Alerts</span>
              <span className="text-2xl font-bold text-slate-900 leading-none">{latestRun?.alertsSent ?? 0}</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 border-b-[3px] border-orange-400 pb-2 min-w-[60px]">
              <div className="w-10 h-10 rounded-[12px] flex items-center justify-center relative overflow-hidden mb-1">
                <div className="absolute inset-0 opacity-10 bg-orange-400"></div>
                <Clock3 size={18} strokeWidth={2.5} className="text-orange-400 relative z-10" />
              </div>
              <span>Skipped</span>
              <span className="text-2xl font-bold text-slate-900 leading-none">{latestRun?.skipped ?? 0}</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 border-b-[3px] border-rose-500 pb-2 min-w-[60px]">
              <div className="w-10 h-10 rounded-[12px] flex items-center justify-center relative overflow-hidden mb-1">
                <div className="absolute inset-0 opacity-10 bg-rose-500"></div>
                <XCircle size={18} strokeWidth={2.5} className="text-rose-500 relative z-10" />
              </div>
              <span>Failures</span>
              <span className="text-2xl font-bold text-slate-900 leading-none">{latestRun?.failures ?? 0}</span>
            </div>
          </div>
        </div>

        <div className="mt-6">
          {entries.length ? (
            <div className="space-y-2">
              {entries.map((entry, index) => (
                <LogEntry
                  key={`${entry?.id || entry?.runId || index}`}
                  entry={entry}
                  index={index}
                  accent={accent}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[20px] border border-dashed border-indigo-200/60 bg-white/50 px-4 py-10 flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-slate-500 font-medium">
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
              <span>No automation logs found for the latest run.</span>
            </div>
          )}
        </div>

        {recentRuns.length ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {recentRuns.slice(0, 3).map((run) => (
              <span key={run.runId || `${title}-run`} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {run.runId || 'Run'} - {formatAgo(run.startedAt)}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
