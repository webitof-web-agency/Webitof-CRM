import { useEffect, useState } from 'react';
import { ExternalLink, Lock, Server } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ThemedSelect } from '../ui/ThemedSelect';

const HOURS = [{ value: '-1', label: 'Off (manual only)' }].concat(
  Array.from({ length: 24 }, (_, hour) => ({ value: String(hour), label: `${String(hour).padStart(2, '0')}:00 IST` }))
);

function SourceBadge({ source }) {
  if (source === 'environment') return <Badge tone="info">from server env</Badge>;
  if (source === 'default') return <Badge tone="neutral">default</Badge>;
  return null;
}

function toForm(values) {
  return {
    backupKeep: String(values.backupKeep ?? ''),
    backupHourIst: String(values.backupHourIst ?? '2')
  };
}

// What the server env holds for one Drive setting. Secrets only say set / not set.
function EnvValue({ item }) {
  if (item.secret) return item.set ? <Badge tone="success">set</Badge> : <Badge tone="danger">not set</Badge>;
  if (!item.value) {
    return <span className="text-slate-500 dark:text-slate-400">{item.emptyMeans || 'not set'}</span>;
  }
  if (item.key === 'parentFolderId') {
    return (
      <a
        href={`https://drive.google.com/drive/folders/${item.value}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-w-0 items-center gap-1 text-[var(--primary)] hover:underline"
      >
        <span className="truncate font-mono">{item.value}</span>
        <ExternalLink size={12} className="shrink-0" />
      </a>
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className={`truncate text-slate-800 dark:text-slate-100 ${item.key === 'clientId' ? 'font-mono' : ''}`}>{item.value}</span>
      {!item.set ? <Badge tone="neutral">default</Badge> : null}
    </span>
  );
}

export function DriveConfigForm({ token, canWrite, onSaved }) {
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState(null);
  const [initial, setInitial] = useState(null);
  const [saving, setSaving] = useState(false);

  function apply(data) {
    const next = toForm(data.values);
    setConfig(data);
    setForm(next);
    setInitial(next);
  }

  useEffect(() => {
    api.googleDrive.getConfig(token)
      .then((response) => apply(response.data))
      .catch((error) => toast.error(error.message || 'Google Drive settings could not be loaded'));
  }, [token]);

  if (!config || !form) return null;

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  // Only fields that were changed are sent, so values coming from the server env are not copied into settings.
  const patch = {};
  for (const key of ['backupKeep', 'backupHourIst']) {
    if (form[key] !== initial[key]) patch[key] = form[key].trim();
  }
  const dirty = Object.keys(patch).length > 0;

  async function save() {
    setSaving(true);
    try {
      const response = await api.googleDrive.saveConfig(token, patch);
      apply(response.data);
      toast.success('Backup schedule saved');
      onSaved?.();
    } catch (error) {
      toast.error(error.message || 'Backup schedule could not be saved');
    } finally {
      setSaving(false);
    }
  }

  const disabled = !canWrite || saving;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
          <Lock size={14} />
          Google account & folders (server env, read-only)
        </div>
        <dl className="divide-y divide-slate-100 dark:divide-slate-800">
          {config.env.map((item) => (
            <div key={item.key} className="grid gap-1 px-3 py-2 text-xs sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center sm:gap-3">
              <dt className="min-w-0">
                <div className="font-medium text-slate-700 dark:text-slate-200">{item.label}</div>
                <code className="text-[11px] text-slate-500 dark:text-slate-400">{item.name}</code>
              </dt>
              <dd className="min-w-0"><EnvValue item={item} /></dd>
            </div>
          ))}
        </dl>
        <p className="border-t border-slate-200 px-3 py-2 text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
          To change these, edit the backend <code>.env</code> on the server and restart it, then click Check connection.
          The refresh token comes from the Google OAuth 2.0 Playground (scope https://www.googleapis.com/auth/drive) and must
          be made with the same client ID.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Daily backup time</label>
            <SourceBadge source={config.sources.backupHourIst} />
          </div>
          <ThemedSelect
            value={form.backupHourIst}
            onChange={(event) => set('backupHourIst', event.target.value)}
            disabled={disabled}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            {HOURS.map((hour) => <option key={hour.value} value={hour.value}>{hour.label}</option>)}
          </ThemedSelect>
        </div>
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Backups to keep</label>
            <SourceBadge source={config.sources.backupKeep} />
          </div>
          <Input type="number" min="1" max="100" value={form.backupKeep} onChange={(event) => set('backupKeep', event.target.value)} disabled={disabled} />
        </div>
      </div>

      {canWrite ? (
        <Button size="sm" onClick={save} loading={saving} disabled={!dirty || saving}>
          Save backup schedule
        </Button>
      ) : null}

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
          <Server size={14} />
          Other server-only settings (env)
        </div>
        <ul className="space-y-1.5">
          {config.envOnly.map((item) => (
            <li key={item.name} className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <code className="text-slate-700 dark:text-slate-200">{item.name}</code>
              {item.set ? <Badge tone="success">set</Badge> : <Badge tone="neutral">not set</Badge>}
              <span>{item.reason}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
