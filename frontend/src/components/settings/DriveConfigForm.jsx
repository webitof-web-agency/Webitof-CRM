import { useEffect, useState } from 'react';
import { Copy, KeyRound, Server } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

const TEXT_FIELDS = [
  { key: 'clientId', label: 'OAuth client ID', placeholder: '1234567890-abc.apps.googleusercontent.com' },
  { key: 'redirectUri', label: 'Redirect URI', placeholder: '', help: 'Add this exact URL under "Authorized redirect URIs" in Google Cloud.' },
  { key: 'parentFolderId', label: 'Parent folder (optional)', placeholder: 'Folder id or https://drive.google.com/drive/folders/…', help: 'Both app folders are created inside it. Leave empty for My Drive. With the drive.file scope only folders this app created are visible.' },
  { key: 'uploadsFolderName', label: 'Uploads folder name' },
  { key: 'backupFolderName', label: 'Backup folder name' }
];

const SECRET_FIELDS = [
  { key: 'clientSecret', setKey: 'clientSecretSet', label: 'OAuth client secret' },
  { key: 'refreshToken', setKey: 'refreshTokenSet', label: 'Refresh token (optional)', help: 'Connects without the Google sign-in screen. Usually you use Connect Google Drive instead.' }
];

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
    clientId: values.clientId || '',
    redirectUri: values.redirectUri || '',
    parentFolderId: values.parentFolderId || '',
    uploadsFolderName: values.uploadsFolderName || '',
    backupFolderName: values.backupFolderName || '',
    backupKeep: String(values.backupKeep ?? ''),
    backupHourIst: String(values.backupHourIst ?? '2'),
    clientSecret: '',
    refreshToken: ''
  };
}

export function DriveConfigForm({ token, canWrite, onSaved }) {
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState(null);
  const [initial, setInitial] = useState(null);
  const [cleared, setCleared] = useState({});
  const [saving, setSaving] = useState(false);

  function apply(data) {
    const next = toForm(data.values);
    setConfig(data);
    setForm(next);
    setInitial(next);
    setCleared({});
  }

  useEffect(() => {
    api.googleDrive.getConfig(token)
      .then((response) => apply(response.data))
      .catch((error) => toast.error(error.message || 'Google Drive settings could not be loaded'));
  }, [token]);

  if (!config || !form) return null;

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  // Only fields that were changed are sent, so values coming from the server env are not copied into settings.
  function buildPatch() {
    const patch = {};
    for (const key of ['clientId', 'redirectUri', 'parentFolderId', 'uploadsFolderName', 'backupFolderName', 'backupKeep', 'backupHourIst']) {
      if (form[key] !== initial[key]) patch[key] = form[key].trim();
    }
    for (const { key } of SECRET_FIELDS) {
      if (cleared[key]) patch[key] = '';
      else if (form[key].trim()) patch[key] = form[key].trim();
    }
    return patch;
  }

  const patch = buildPatch();
  const dirty = Object.keys(patch).length > 0;

  async function save() {
    setSaving(true);
    try {
      const response = await api.googleDrive.saveConfig(token, patch);
      apply(response.data);
      toast.success('Google Drive settings saved');
      onSaved?.();
    } catch (error) {
      toast.error(error.message || 'Google Drive settings could not be saved');
    } finally {
      setSaving(false);
    }
  }

  async function copyRedirect() {
    try {
      await navigator.clipboard.writeText(form.redirectUri || config.values.defaultRedirectUri);
      toast.success('Redirect URI copied');
    } catch {
      toast.error('Copy failed');
    }
  }

  const disabled = !canWrite || saving;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        {TEXT_FIELDS.map((field) => (
          <div key={field.key} className={field.key === 'redirectUri' || field.key === 'parentFolderId' ? 'md:col-span-2' : ''}>
            <div className="mb-1.5 flex items-center gap-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">{field.label}</label>
              <SourceBadge source={config.sources[field.key]} />
            </div>
            <div className="flex gap-2">
              <Input
                value={form[field.key]}
                onChange={(event) => set(field.key, event.target.value)}
                placeholder={field.key === 'redirectUri' ? config.values.defaultRedirectUri : field.placeholder}
                disabled={disabled}
              />
              {field.key === 'redirectUri' ? (
                <Button type="button" size="icon" variant="outline" onClick={copyRedirect} title="Copy redirect URI">
                  <Copy size={14} />
                </Button>
              ) : null}
            </div>
            {field.help ? <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{field.help}</p> : null}
          </div>
        ))}

        {SECRET_FIELDS.map((field) => {
          const isSet = config.values[field.setKey] && !cleared[field.key];
          return (
            <div key={field.key} className="md:col-span-2">
              <div className="mb-1.5 flex items-center gap-2">
                <KeyRound size={14} className="text-slate-500" />
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">{field.label}</label>
                {isSet ? <Badge tone="success">saved</Badge> : null}
                {isSet ? <SourceBadge source={config.sources[field.key]} /> : null}
              </div>
              <div className="flex gap-2">
                <Input
                  type="password"
                  autoComplete="off"
                  value={form[field.key]}
                  onChange={(event) => {
                    set(field.key, event.target.value);
                    setCleared((current) => ({ ...current, [field.key]: false }));
                  }}
                  placeholder={isSet ? '•••••••• (leave blank to keep)' : 'Not set'}
                  disabled={disabled || !config.canStoreSecrets}
                />
                {config.values[field.setKey] && config.sources[field.key] === 'settings' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled}
                    onClick={() => {
                      set(field.key, '');
                      setCleared((current) => ({ ...current, [field.key]: !current[field.key] }));
                    }}
                  >
                    {cleared[field.key] ? 'Undo clear' : 'Clear'}
                  </Button>
                ) : null}
              </div>
              {field.help ? <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{field.help}</p> : null}
            </div>
          );
        })}

        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Daily backup time</label>
            <SourceBadge source={config.sources.backupHourIst} />
          </div>
          <select
            value={form.backupHourIst}
            onChange={(event) => set('backupHourIst', event.target.value)}
            disabled={disabled}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            {HOURS.map((hour) => <option key={hour.value} value={hour.value}>{hour.label}</option>)}
          </select>
        </div>
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Backups to keep</label>
            <SourceBadge source={config.sources.backupKeep} />
          </div>
          <Input type="number" min="1" max="100" value={form.backupKeep} onChange={(event) => set('backupKeep', event.target.value)} disabled={disabled} />
        </div>
      </div>

      {!config.canStoreSecrets ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          Secrets can't be saved here until SETTINGS_ENCRYPTION_KEY is set on the server.
        </p>
      ) : null}

      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        Values saved here override the server env. Empty a field and save to go back to the env value or default.
        Changing the client ID disconnects the current Google account until you reconnect.
      </p>

      {canWrite ? (
        <Button size="sm" onClick={save} loading={saving} disabled={!dirty || saving}>
          Save Google Drive settings
        </Button>
      ) : null}

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
          <Server size={14} />
          Server-only settings (env)
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
