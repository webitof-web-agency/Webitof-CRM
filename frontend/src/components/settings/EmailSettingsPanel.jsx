import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Mail, RefreshCw, Send, Server } from 'lucide-react';
import { toast } from 'sonner';
import { request } from '../../api/client';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';

// The five outgoing mailboxes (backend/config/mailSenders.js). Logins live in the server env only,
// so this panel is read-only apart from sending a test mail.
const SOURCE_BADGE = {
  own: { tone: 'success', label: 'Connected' },
  default: { tone: 'warning', label: 'Using default account' },
  none: { tone: 'danger', label: 'Not set' }
};

function EnvName({ children }) {
  return (
    <code className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[11px] font-mono text-slate-700 dark:text-slate-200">
      {children}
    </code>
  );
}

function MailboxCard({ box, canWrite, testTo, sending, onTest }) {
  const badge = SOURCE_BADGE[box.source] || SOURCE_BADGE.none;
  return (
    <Card className="flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Mail size={17} className="text-slate-800 dark:text-slate-100" />
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">{box.label}</h3>
          </div>
          <p className="mt-0.5 break-all text-sm text-slate-600 dark:text-slate-300">
            {box.address || <span className="text-slate-400">{box.suggestedAddress} (not set)</span>}
          </p>
        </div>
        <Badge tone={badge.tone} dot>{badge.label}</Badge>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">{box.purpose}</p>

      <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-slate-500 dark:text-slate-400">From name</dt>
        <dd className="text-slate-700 dark:text-slate-200">{box.fromName}</dd>
        {box.replyTo ? (
          <>
            <dt className="text-slate-500 dark:text-slate-400">Reply-To</dt>
            <dd className="break-all text-slate-700 dark:text-slate-200">{box.replyTo}</dd>
          </>
        ) : null}
        {box.host ? (
          <>
            <dt className="text-slate-500 dark:text-slate-400">Server</dt>
            <dd className="text-slate-700 dark:text-slate-200">{box.host}:{box.port}{box.secure ? ' (SSL)' : ''}</dd>
          </>
        ) : null}
      </dl>

      <div>
        <p className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">Sends</p>
        <div className="flex flex-wrap gap-1.5">
          {box.mailTypes.length ? (
            box.mailTypes.map((type) => <Badge key={type.key} tone="neutral">{type.label}</Badge>)
          ) : (
            <span className="text-xs text-slate-400">Reserved for upcoming mails</span>
          )}
        </div>
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400">
        Server .env: <EnvName>{box.envPrefix}_USER</EnvName> <EnvName>{box.envPrefix}_PASSWORD</EnvName>
      </div>

      {canWrite ? (
        <div className="mt-auto pt-1">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onTest(box.key)}
            disabled={box.source === 'none' || Boolean(sending) || !testTo}
          >
            {sending === box.key ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
            Send test mail
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

export function EmailSettingsPanel({ token, canWrite, defaultTestTo = '' }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [testTo, setTestTo] = useState(defaultTestTo);
  const [sending, setSending] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await request('/settings/email', { token, skipCache: true });
      setStatus(res?.data || null);
    } catch (err) {
      setError(err.message || 'Could not load email settings');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const sendTest = async (mailbox) => {
    setSending(mailbox);
    try {
      const res = await request('/settings/email/test', { method: 'POST', token, body: { mailbox, to: testTo.trim() } });
      toast.success(res?.message || 'Test mail sent');
    } catch (err) {
      toast.error(err.message || 'Test mail failed');
    } finally {
      setSending('');
    }
  };

  const mailboxes = status?.mailboxes || [];
  const missing = mailboxes.filter((box) => box.source !== 'own').length;

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Server size={18} className="text-slate-800 dark:text-slate-100" />
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Mailboxes</h3>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Mailbox logins are set in the server <EnvName>backend/.env</EnvName> only (see <EnvName>backend/.env.example</EnvName>).
              Edit them there and restart the backend; they cannot be changed here.
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </Button>
        </div>

        {status ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span>Default account (<EnvName>SMTP_USER</EnvName>):</span>
            {status.defaultAccount.configured ? (
              <Badge tone="neutral">{status.defaultAccount.address}</Badge>
            ) : (
              <Badge tone="neutral">Not set</Badge>
            )}
            <span className="text-slate-400">A mailbox without its own login sends through this account.</span>
          </div>
        ) : null}

        {status && missing ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{missing} of {mailboxes.length} mailboxes have no login of their own yet.</span>
          </div>
        ) : null}

        {canWrite ? (
          <div className="mt-4 max-w-md">
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Send test mails to</label>
            <Input type="email" value={testTo} onChange={(event) => setTestTo(event.target.value)} placeholder="you@webitof.com" />
          </div>
        ) : null}
      </Card>

      {error ? <Card className="p-4 text-sm text-rose-600">{error}</Card> : null}

      <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
        {mailboxes.map((box) => (
          <MailboxCard key={box.key} box={box} canWrite={canWrite} testTo={testTo.trim()} sending={sending} onTest={sendTest} />
        ))}
      </div>
    </div>
  );
}
