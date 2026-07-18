import { useMemo, useState } from 'react';
import { ArrowUpRight, Bell, CheckCheck, Clock3, Filter, Mail, RefreshCcw, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { useNotifications } from '../context/NotificationContext';

function formatTime(value) {
  if (!value) return 'Just now';
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

function severityTone(severity = 'info') {
  if (severity === 'success') return 'success';
  if (severity === 'warning') return 'warning';
  if (severity === 'danger') return 'danger';
  return 'info';
}

function NotificationRow({ item, onOpen, onMarkRead }) {
  const unread = !item.isRead;
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
      className={`w-full cursor-pointer text-left rounded-2xl border p-4 transition ${
        unread
          ? 'border-[color-mix(in_srgb,var(--primary)_25%,#dbe4f0)] bg-[color-mix(in_srgb,var(--primary)_4%,white)]'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${unread ? 'bg-[color-mix(in_srgb,var(--primary)_12%,white)] text-[var(--primary)]' : 'bg-slate-100 text-slate-500'}`}>
          {item.severity === 'danger' ? <ShieldAlert size={18} /> : item.emailTo ? <Mail size={18} /> : <Bell size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--text-main)]">{item.title || 'Notification'}</h3>
            <Badge tone={severityTone(item.severity)} className="border-transparent bg-slate-900/5 text-slate-600">{item.moduleName || 'system'}</Badge>
            {!item.isRead ? <Badge tone="info" className="border-transparent bg-[color-mix(in_srgb,var(--primary)_12%,white)] text-[var(--primary)]">Unread</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-slate-600">{item.message || ''}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Clock3 size={12} />
              {formatTime(item.createdAt)}
            </span>
            {item.routePath ? (
              <span className="inline-flex items-center gap-1 text-[var(--primary)]">
                Open record
                <ArrowUpRight size={12} />
              </span>
            ) : null}
          </div>
        </div>
        {unread ? (
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                onMarkRead(item);
              }}
              className="h-9 px-3"
            >
              Mark read
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, refresh, markRead, markAllRead } = useNotifications();
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false);

  const stats = useMemo(() => {
    const unread = notifications.filter((item) => !item.isRead).length;
    const today = notifications.filter((item) => {
      const created = item.createdAt ? new Date(item.createdAt) : null;
      if (!created || Number.isNaN(created.getTime())) return false;
      const now = new Date();
      return created.toDateString() === now.toDateString();
    }).length;
    const high = notifications.filter((item) => ['warning', 'danger'].includes(String(item.severity || '').toLowerCase())).length;
    return { unread, today, high };
  }, [notifications]);

  const visibleNotifications = useMemo(() => {
    let rows = notifications;
    if (filter === 'unread') rows = rows.filter((item) => !item.isRead);
    if (filter === 'read') rows = rows.filter((item) => item.isRead);
    if (filter === 'high') rows = rows.filter((item) => ['warning', 'danger'].includes(String(item.severity || '').toLowerCase()));
    return rows;
  }, [filter, notifications]);

  async function handleRefresh() {
    setBusy(true);
    try {
      await refresh();
      toast.success('Notifications refreshed');
    } catch (error) {
      toast.error(error.message || 'Unable to refresh notifications');
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkRead(item) {
    try {
      const next = await markRead(item.id);
      if (next?.routePath) {
        navigate(next.routePath);
      }
      toast.success('Marked as read');
    } catch (error) {
      toast.error(error.message || 'Unable to update notification');
    }
  }

  async function handleOpen(item) {
    try {
      if (!item.isRead) {
        await markRead(item.id);
      }
      if (item.routePath) {
        navigate(item.routePath);
      }
    } catch (error) {
      toast.error(error.message || 'Unable to open notification');
    }
  }

  async function handleMarkAll() {
    setBusy(true);
    try {
      await markAllRead();
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error(error.message || 'Unable to update notifications');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">Notifications</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Real-time alerts for admin activity, client updates, and automation events.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={handleRefresh} disabled={busy} className="bg-white shadow-sm border-slate-200 hover:bg-slate-50 gap-2">
            <RefreshCcw size={16} />
            Refresh
          </Button>
          <Button onClick={handleMarkAll} disabled={busy || unreadCount === 0} className="gap-2">
            <CheckCheck size={16} />
            Mark all read
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: 'Unread', value: stats.unread, helper: 'Bell count in header', bg: 'bg-indigo-50/80 text-indigo-500', Icon: Bell },
          { label: 'Today', value: stats.today, helper: 'Created in last 24 hours', bg: 'bg-emerald-50/80 text-emerald-500', Icon: Clock3 },
          { label: 'High Priority', value: stats.high, helper: 'Warnings and critical events', bg: 'bg-rose-50/80 text-rose-500', Icon: ShieldAlert }
        ].map((item) => (
          <Card key={item.label} className="px-4 py-5 flex items-center gap-3 shadow-sm border border-slate-100 rounded-[16px]">
            <div className={`shrink-0 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full ${item.bg}`}>
              <item.Icon size={20} strokeWidth={2} />
            </div>
            <div className="overflow-hidden min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1 truncate">{item.label}</p>
              <h3 className="text-base md:text-lg font-bold text-slate-800 leading-tight truncate">{loading ? '...' : String(item.value)}</h3>
              <p className="mt-1 text-[10px] text-slate-400 truncate">{item.helper}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="flex flex-col border-b border-slate-200">
          <div className="px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Inbox</h2>
            <p className="mt-1 text-sm text-slate-500">Showing {visibleNotifications.length} of {notifications.length} notifications</p>
          </div>
          <div className="flex w-full overflow-x-auto hide-scrollbar px-2">
            {[
              { key: 'all', label: 'All' },
              { key: 'unread', label: 'Unread' },
              { key: 'read', label: 'Read' },
              { key: 'high', label: 'Priority' }
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`whitespace-nowrap px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                  filter === item.key
                    ? 'border-[var(--primary)] text-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_5%,transparent)]'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 p-4 md:p-5">
          {visibleNotifications.length ? (
            visibleNotifications.map((item) => (
              <NotificationRow key={item.id} item={item} onOpen={handleOpen} onMarkRead={handleMarkRead} />
            ))
          ) : (
            <EmptyState
              title="No notifications yet"
              description="When invoices, payments, projects, AMC, renewals, or automation jobs fire, they will appear here in real time."
            />
          )}
        </div>
      </Card>
    </div>
  );
}
