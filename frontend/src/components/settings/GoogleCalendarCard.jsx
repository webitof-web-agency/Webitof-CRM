import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeftRight, ArrowRight, CalendarDays, CheckCircle2, Link2Off, Loader2, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { confirmAction } from '../../lib/confirm';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { cn } from '../../lib/cn';

const MODES = [
  {
    value: 'one_way',
    icon: ArrowRight,
    title: 'One-way: ERP → Google',
    text: 'Meetings, reminders, follow-ups and todos go into your Google Calendar. Changes made in Google stay there.'
  },
  {
    value: 'two_way',
    icon: ArrowLeftRight,
    title: 'Two-way: ERP ↔ Google',
    text: 'Also brings changes made in Google back to the ERP, and your own Google events show in the ERP (only to you).'
  }
];

function formatTime(value) {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

// Profile → each user links their own Google Calendar and picks one-way or two-way sync.
export function GoogleCalendarCard() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await api.googleCalendar.status(token);
      setStatus(response.data);
    } catch (error) {
      toast.error(error.message || 'Could not load Google Calendar status');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // Back from Google's sign-in page: ?gcal=connected|error
  useEffect(() => {
    const result = searchParams.get('gcal');
    if (!result) return;
    if (result === 'connected') toast.success(`Google Calendar connected${searchParams.get('account') ? ` (${searchParams.get('account')})` : ''}. Your items are being added now.`);
    else toast.error(searchParams.get('message') || 'Google Calendar could not be connected');
    const next = new URLSearchParams(searchParams);
    ['gcal', 'account', 'message'].forEach((key) => next.delete(key));
    setSearchParams(next, { replace: true });
    load();
  }, [load, searchParams, setSearchParams]);

  async function run(kind, work) {
    setBusy(kind);
    try {
      await work();
    } catch (error) {
      toast.error(error.message || 'Something went wrong');
    } finally {
      setBusy('');
    }
  }

  const connect = () => run('connect', async () => {
    const response = await api.googleCalendar.connect(token);
    window.location.href = response.data.url;
  });

  const setMode = (mode) => run('mode', async () => {
    if (mode === status?.syncMode) return;
    const response = await api.googleCalendar.setSyncMode(token, mode);
    setStatus(response.data);
    toast.success(mode === 'two_way' ? 'Two-way sync is on' : 'One-way sync is on');
  });

  const syncNow = () => run('sync', async () => {
    const response = await api.googleCalendar.syncNow(token);
    setStatus(response.data);
    toast.success('Calendar synced');
  });

  const disconnect = () => run('disconnect', async () => {
    const ok = await confirmAction({
      title: 'Disconnect Google Calendar?',
      description: 'Events already in your calendar stay there, but the ERP stops updating them. Events that came from Google into the ERP are removed from the ERP.',
      confirmText: 'Disconnect',
      type: 'warning'
    });
    if (!ok) return;
    const response = await api.googleCalendar.disconnect(token);
    setStatus(response.data);
    toast.success('Google Calendar disconnected');
  });

  const connected = Boolean(status?.connected);

  return (
    <Card className="p-6 shadow-sm h-full flex flex-col">
      <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
        <div className="flex h-10 w-10 items-center justify-center bg-sky-50 text-sky-600" style={{ borderRadius: 'var(--radius-button, 0.5rem)' }}>
          <CalendarDays size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-slate-800">Google Calendar</h3>
          <p className="text-sm text-slate-500">Keep your meetings, follow-ups and todos in your own calendar.</p>
        </div>
        {connected && !status?.needsReconnect ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 size={12} /> Connected
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center py-8 text-sm text-slate-500"><Loader2 size={16} className="mr-2 animate-spin" /> Loading…</div>
      ) : !status?.configured ? (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-800">
          <p className="font-semibold">Google Calendar is not set up on the server yet.</p>
          <ul className="mt-1 list-disc pl-5 text-xs">{(status?.problems || []).map((problem) => <li key={problem}>{problem}</li>)}</ul>
        </div>
      ) : !connected ? (
        <div className="flex flex-1 flex-col gap-4">
          <ul className="space-y-1.5 text-sm text-slate-600">
            <li>• Every meeting, reminder, follow-up and todo assigned to you appears in your Google Calendar.</li>
            <li>• Clients and colleagues you add to a meeting get a Google invite in their own calendar.</li>
            <li>• You choose one-way or two-way sync after connecting.</li>
          </ul>
          <div className="mt-auto">
            <Button onClick={connect} loading={busy === 'connect'} className="gap-2">
              <CalendarDays size={16} /> Connect Google Calendar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4">
          {status.needsReconnect ? (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">Google stopped accepting the access of {status.accountEmail}.</p>
                <p className="text-xs">Nothing reaches your calendar until you reconnect.</p>
              </div>
              <Button size="sm" onClick={connect} loading={busy === 'connect'}>Reconnect</Button>
            </div>
          ) : null}

          <div className="text-sm text-slate-600">
            Linked account: <span className="font-semibold text-slate-800">{status.accountEmail || 'Google account'}</span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {MODES.map((mode) => {
              const Icon = mode.icon;
              const active = status.syncMode === mode.value;
              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setMode(mode.value)}
                  disabled={busy === 'mode'}
                  className={cn(
                    'rounded-xl border p-3 text-left transition cursor-pointer',
                    active ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-500/30' : 'border-slate-200 bg-white hover:border-slate-300'
                  )}
                >
                  <span className={cn('flex items-center gap-1.5 text-sm font-semibold', active ? 'text-sky-700' : 'text-slate-800')}>
                    <Icon size={15} /> {mode.title}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">{mode.text}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <span className="block font-semibold text-slate-800">{status.eventsInCalendar}</span> items in your calendar
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <span className="block font-semibold text-slate-800">{status.eventsFromCalendar}</span> Google events in the ERP
            </div>
            <div className="col-span-2">Last sent: {formatTime(status.lastPushAt)} · Last read from Google: {formatTime(status.lastPullAt)}</div>
            {status.lastError ? <div className="col-span-2 text-rose-600">Last problem: {status.lastError}</div> : null}
          </div>

          <div className="mt-auto flex flex-wrap justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={disconnect} loading={busy === 'disconnect'} className="gap-1.5 text-rose-600">
              <Link2Off size={14} /> Disconnect
            </Button>
            <Button size="sm" onClick={syncNow} loading={busy === 'sync'} disabled={status.needsReconnect} className="gap-1.5">
              <RefreshCcw size={14} /> Sync now
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
