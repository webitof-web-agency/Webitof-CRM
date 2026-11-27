import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, ChevronDown, CloudUpload, DatabaseBackup, Download, ExternalLink, FolderOpen,
  HardDrive, History, Link2, RefreshCw, Settings2, ShieldCheck, Unplug
} from 'lucide-react';
import { toast } from 'sonner';
import { api, downloadWithAuth } from '../../api/client';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ConfirmDialog } from '../overlays/ConfirmDialog';
import { DriveConfigForm } from './DriveConfigForm';
import { DriveFolderTreeModal } from './DriveFolderTreeModal';
import { SimpleTable } from '../ui/SimpleTable';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';

// Settings → Storage & Backup. Compact layout: an overview strip, notices, Google Drive + upload
// storage on the left, backups on the right, and the read-only health and server settings folded.

const PROVIDERS = [
  { id: 'local', label: 'Local server', description: 'Saved on the ERP server disk.', icon: HardDrive },
  { id: 'gdrive', label: 'Google Drive', description: 'Saved in the connected Google Drive.', icon: CloudUpload }
];

const BACKUPS_SHOWN = 6;

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

const BACKUP_KINDS = {
  scheduled: { label: 'Daily', tone: 'neutral' },
  manual: { label: 'Manual', tone: 'info' },
  'pre-restore': { label: 'Before restore', tone: 'warning' }
};

// Card title row: icon, title, optional one-line hint and actions on the right.
function SectionHeader({ icon: Icon, title, hint, children }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Icon size={16} className="shrink-0 text-slate-700 dark:text-slate-200" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
        </div>
        {hint ? <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{hint}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-1.5">{children}</div> : null}
    </div>
  );
}

// One tile of the overview strip.
function StatTile({ icon: Icon, label, children, sub }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-3 py-2.5">
      <Icon size={16} className="mt-0.5 shrink-0 text-slate-500 dark:text-slate-400" />
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-800 dark:text-slate-100">{children}</div>
        {sub ? <div className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400" title={sub}>{sub}</div> : null}
      </div>
    </div>
  );
}

const NOTICE_TONES = {
  danger: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
};

function Notice({ tone = 'warning', children, action }) {
  const Icon = tone === 'success' ? CheckCircle2 : AlertTriangle;
  return (
    <div role={tone === 'success' ? 'status' : 'alert'} className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-xs ${NOTICE_TONES[tone]}`}>
      <Icon size={14} className="shrink-0" />
      <div className="min-w-0 flex-1 break-words">{children}</div>
      {action}
    </div>
  );
}

// A Drive folder as a small chip: opens it in Drive once it exists, else just its name.
function FolderChip({ folder, strong = false }) {
  if (!folder?.name) return null;
  const base = 'inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-0.5 text-[11px]';
  if (!folder.link) return <span className={`${base} text-slate-500`}>{folder.name}</span>;
  return (
    <a
      href={folder.link}
      target="_blank"
      rel="noreferrer"
      className={`${base} text-[var(--primary)] hover:border-[var(--primary)]/40 ${strong ? 'font-semibold' : ''}`}
      title="Open in Google Drive"
    >
      {folder.name} <ExternalLink size={10} />
    </a>
  );
}

function InfoRow({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="min-w-0 truncate text-right text-xs text-slate-800 dark:text-slate-100" title={typeof children === 'string' ? children : undefined}>{children}</dd>
    </div>
  );
}

function HealthRow({ label, ok, children }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[11px] text-slate-500 dark:text-slate-400">{label}</span>
      <span className="flex min-w-0 items-center gap-2 text-right text-xs text-slate-800 dark:text-slate-100">
        <span className="min-w-0 break-words">{children}</span>
        {ok === undefined ? null : <Badge tone={ok ? 'success' : 'warning'}>{ok ? 'OK' : 'Check'}</Badge>}
      </span>
    </div>
  );
}

// A card that folds: the title row is always visible, the body opens on click.
function FoldCard({ icon: Icon, title, summary, defaultOpen = false, children }) {
  return (
    <Card as="details" className="group p-0" open={defaultOpen || undefined}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <Icon size={16} className="shrink-0 text-slate-700 dark:text-slate-200" />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</span>
        </span>
        <span className="flex items-center gap-2">
          {summary}
          <ChevronDown size={16} className="text-slate-400 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="border-t border-[var(--border)] px-4 pb-4 pt-3">{children}</div>
    </Card>
  );
}

// Read-only readiness report from GET /google-drive/status (backupHealth): nothing here changes the server.
function BackupHealthBody({ health }) {
  const tools = health.tools || [];
  return (
    <>
      {health.problems?.length ? (
        <ul className="mb-3 list-disc space-y-0.5 rounded-xl border border-amber-500/30 bg-amber-500/10 py-2 pl-7 pr-3 text-xs text-amber-800 dark:text-amber-300">
          {health.problems.map((problem) => <li key={problem}>{problem}</li>)}
        </ul>
      ) : null}
      <div className="grid gap-x-8 md:grid-cols-2">
        <div className="divide-y divide-[var(--border)]">
          <HealthRow label="Database server" ok={health.server ? !health.server.error : undefined}>
            {health.server?.error || (health.server?.version ? `PostgreSQL ${health.server.version}` : '—')}
          </HealthRow>
          {tools.map((tool) => (
            <HealthRow key={tool.name} label={tool.name} ok={tool.ok}>{tool.error || tool.version || '—'}</HealthRow>
          ))}
          <HealthRow label="Backup connection" ok={health.connection ? !health.connection.transactionPooler : undefined}>
            {health.connection ? `${health.connection.source} · ${health.connection.host}:${health.connection.port}` : '—'}
          </HealthRow>
        </div>
        <div className="divide-y divide-[var(--border)]">
          <HealthRow label="Schedule" ok={health.schedule?.enabled}>{health.schedule?.label || '—'}</HealthRow>
          <HealthRow label="Google Drive" ok={health.drive?.connected}>
            {health.drive?.connected ? 'Connected' : health.drive?.needsReconnect ? 'Needs reconnect' : 'Not connected'}
          </HealthRow>
          <HealthRow label="Last successful backup" ok={health.lastSuccessAt ? !health.overdue : undefined}>
            {health.lastSuccessAt ? `${formatDate(health.lastSuccessAt)} (${health.hoursSinceSuccess} h ago)` : 'None yet'}
          </HealthRow>
          <HealthRow label="Checked">{formatDate(health.checkedAt)}</HealthRow>
        </div>
      </div>
    </>
  );
}

export function StorageSettingsPanel({ token, canWrite, canRestore = false }) {
  const [status, setStatus] = useState(null);
  const [backups, setBackups] = useState([]);
  const [backupsError, setBackupsError] = useState('');
  const [showAllBackups, setShowAllBackups] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('local');
  const [busy, setBusy] = useState('');
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoreConfirm, setRestoreConfirm] = useState('');
  const [checkResult, setCheckResult] = useState(null);
  const [treeOpen, setTreeOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Back from Google sign-in: the API redirects here with ?gdrive=connected|error.
  useEffect(() => {
    const result = searchParams.get('gdrive');
    if (!result) return;
    if (result === 'connected') {
      const account = searchParams.get('account');
      const message = `Google Drive connected${account ? `: ${account}` : ''}`;
      toast.success(message);
      setCheckResult({ ok: true, message: `${message}. Uploads and backups use this account now.` });
    } else {
      const message = searchParams.get('message') || 'Google Drive could not be connected';
      toast.error(message);
      setCheckResult({ ok: false, message });
    }
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const drive = status?.drive;
  const backup = status?.backup;
  const health = status?.backupHealth;
  const activeProvider = status?.storage?.activeProvider || 'local';
  const driveUsable = Boolean(drive?.connected && !drive?.needsReconnect);

  const loadStatus = useCallback(async () => {
    const response = await api.googleDrive.status(token);
    setStatus(response.data);
    return response.data;
  }, [token]);

  const loadBackups = useCallback(async () => {
    try {
      const response = await api.googleDrive.backups(token);
      setBackups(response.data || []);
      setBackupsError('');
    } catch (error) {
      setBackups([]);
      setBackupsError(error.message || 'Backups could not be listed');
    }
  }, [token]);

  useEffect(() => {
    loadStatus()
      .then((data) => {
        setSelectedProvider(data?.storage?.activeProvider || 'local');
        if (data?.drive?.connected && !data?.drive?.needsReconnect) loadBackups();
      })
      .catch((error) => toast.error(error.message || 'Storage status could not be loaded'));
  }, [loadStatus, loadBackups]);

  // Poll while a backup runs.
  useEffect(() => {
    if (!backup?.running) return undefined;
    const timer = setInterval(async () => {
      try {
        const data = await loadStatus();
        if (!data?.backup?.running) loadBackups();
      } catch {
        // Keep polling; a transient error should not stop the status updates.
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [backup?.running, loadStatus, loadBackups]);

  async function run(label, work) {
    setBusy(label);
    try {
      await work();
    } catch (error) {
      toast.error(error.message || 'Something went wrong');
    } finally {
      setBusy('');
    }
  }

  // Proves the account and folders work (and applies a fallback refresh token from the server env).
  const check = () => run('check', async () => {
    setCheckResult(null);
    try {
      const { data } = await api.googleDrive.check(token);
      setCheckResult({
        ok: true,
        message: `Connected to ${data.accountEmail || 'Google Drive'}. Folders ready in "${data.rootFolder?.name}".`
      });
      loadBackups();
    } catch (error) {
      setCheckResult({ ok: false, message: error.message || 'Google Drive could not be reached' });
    }
    await loadStatus().catch(() => {});
  });

  // Opens Google sign-in; Google sends the browser back to this page with the result.
  const connect = () => run('connect', async () => {
    const { data } = await api.googleDrive.connect(token);
    window.location.assign(data.url);
  });

  const disconnect = () => run('disconnect', async () => {
    await api.googleDrive.disconnect(token);
    setConfirmDisconnect(false);
    setBackups([]);
    await loadStatus();
    toast.success('Google Drive disconnected');
  });

  const saveProvider = () => run('save', async () => {
    await api.storage.save(token, selectedProvider);
    await loadStatus();
    toast.success(selectedProvider === 'gdrive' ? 'New uploads go to Google Drive' : 'New uploads go to the local server');
  });

  const testProvider = () => run('test', async () => {
    const response = await api.storage.test(token, selectedProvider);
    toast.success(response.data?.message || 'Storage test passed');
  });

  const backUpNow = () => run('backup', async () => {
    await api.googleDrive.runBackup(token);
    await loadStatus();
    toast.success('Backup started');
  });

  const downloadDriveBackup = (file) => run(`download-${file.id}`, () =>
    downloadWithAuth(`/google-drive/backups/${encodeURIComponent(file.id)}/download`, token, file.name)
  );

  const openRestore = (file) => {
    setRestoreConfirm('');
    setRestoreTarget(file);
  };

  const startRestore = () => run('restore', async () => {
    const response = await api.googleDrive.restore(token, restoreTarget.id);
    setRestoreTarget(null);
    // The person restoring sees the maintenance screen too, without waiting for the socket.
    window.dispatchEvent(new CustomEvent('system:maintenance', { detail: response.data?.maintenance || { active: true } }));
  });

  const downloadFreshBackup = () => run('fresh', () =>
    downloadWithAuth('/backup/download', token, 'crm-backup.dump')
  );

  if (!status) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  const last = backup?.last;
  const driveBadge = drive.needsReconnect
    ? <Badge tone="danger" dot>Needs reconnect</Badge>
    : drive.connected ? <Badge tone="success" dot>Connected</Badge> : <Badge tone="neutral" dot>Not connected</Badge>;
  const lastBadge = backup.running
    ? <Badge tone="info" dot>Running…</Badge>
    : last?.status === 'FAILED' ? <Badge tone="danger" dot>Failed</Badge>
      : last?.status === 'SUCCESS' ? <Badge tone="success" dot>OK</Badge> : null;
  const healthIssues = health?.problems?.length || 0;
  const visibleBackups = showAllBackups ? backups : backups.slice(0, BACKUPS_SHOWN);
  const connectButton = canWrite ? (
    <Button
      size="xs"
      variant={driveUsable ? 'outline' : drive.needsReconnect ? 'danger' : 'primary'}
      onClick={connect}
      loading={busy === 'connect'}
      disabled={Boolean(busy) || !drive.configured}
      title={drive.configured ? 'Sign in to Google and give the ERP access to Drive' : 'Finish the server configuration first'}
    >
      {drive.connected ? <RefreshCw size={12} /> : <CloudUpload size={12} />}
      {drive.connected ? 'Reconnect' : 'Connect Google Drive'}
    </Button>
  ) : null;

  return (
    <div className="space-y-3">
      {/* Overview */}
      <Card className="p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <StatTile icon={CloudUpload} label="Google Drive" sub={drive.accountEmail || drive.allowedEmail || 'No account connected'}>
            {driveBadge}
          </StatTile>
          <StatTile icon={HardDrive} label="New uploads go to" sub={activeProvider === 'gdrive' ? 'Webitof ERP Data in Drive' : 'Server disk'}>
            {activeProvider === 'gdrive' ? 'Google Drive' : 'Local server'}
          </StatTile>
          <StatTile
            icon={DatabaseBackup}
            label="Last backup"
            sub={backup.lastSuccess ? `Last OK ${formatDate(backup.lastSuccess.finishedAt)} · ${formatBytes(backup.lastSuccess.size)}` : backup.schedule.label}
          >
            {lastBadge}
            <span>{last ? formatDate(last.finishedAt || last.startedAt) : 'No backup yet'}</span>
          </StatTile>
          <StatTile icon={ShieldCheck} label="Backup health" sub={health?.schedule?.label || backup.schedule.label}>
            {health ? (healthIssues ? <Badge tone="warning" dot>{healthIssues} to check</Badge> : <Badge tone="success" dot>All checks passed</Badge>) : '—'}
          </StatTile>
        </div>
      </Card>

      {/* Notices */}
      {drive.needsReconnect ? (
        <Notice
          tone="danger"
          action={canWrite ? (
            <Button size="xs" variant="danger" onClick={connect} loading={busy === 'connect'} disabled={Boolean(busy)}>
              <RefreshCw size={12} />
              Reconnect Google Drive
            </Button>
          ) : null}
        >
          Google stopped accepting the Drive access{drive.accountEmail ? ` of ${drive.accountEmail}` : ''}
          {drive.needsReconnectSince ? ` (since ${formatDate(drive.needsReconnectSince)})` : ''}. Uploads to Drive and the daily backup are paused.
        </Notice>
      ) : null}
      {backup.alert ? (
        <Notice tone="danger">
          {backup.alert.message} Admins were alerted{backup.alert.alertedAt ? ` (${formatDate(backup.alert.alertedAt)})` : ''}; this clears after the next successful backup.
        </Notice>
      ) : null}
      {drive.problems?.length ? (
        <Notice tone="warning">
          <span className="font-semibold">Server configuration is incomplete: </span>
          {drive.problems.join('; ')}
        </Notice>
      ) : null}
      {drive.envTokenError ? (
        <Notice tone="danger">
          The fallback refresh token in the server env (GOOGLE_OAUTH_REFRESH_TOKEN) was not accepted: {drive.envTokenError}. Click Connect Google Drive instead, or remove that env value.
        </Notice>
      ) : null}
      {checkResult ? <Notice tone={checkResult.ok ? 'success' : 'danger'}>{checkResult.message}</Notice> : null}

      {/* Both columns stretch to the same height (grid rows stretch by default). */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        {/* Left: Drive + upload storage */}
        <div className="flex min-w-0 flex-col gap-3 lg:col-span-2">
          <Card className="p-4">
            <SectionHeader icon={CloudUpload} title="Google Drive" hint="Holds uploads (when chosen below) and the daily backups." />
            <dl className="divide-y divide-[var(--border)]">
              <InfoRow label="Account">{drive.accountEmail || '—'}</InfoRow>
              <InfoRow label="Connected">{formatDate(drive.connectedAt)}</InfoRow>
              {drive.allowedEmail ? <InfoRow label="Allowed account">{drive.allowedEmail}</InfoRow> : null}
            </dl>
            {drive.rootFolder?.link ? (
              <div className="mt-3">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    <FolderOpen size={12} /> Folders in Drive
                  </span>
                  {driveUsable ? (
                    <button
                      type="button"
                      onClick={() => setTreeOpen(true)}
                      className="text-[11px] font-medium text-[var(--primary)] hover:underline"
                    >
                      View all
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <FolderChip folder={drive.rootFolder} strong />
                  <FolderChip folder={drive.backupFolder} />
                </div>
              </div>
            ) : null}
            {canWrite || canRestore ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {connectButton}
                {drive.connected ? (
                  <Button size="xs" variant="outline" onClick={check} loading={busy === 'check'} disabled={Boolean(busy)}>
                    <Link2 size={12} />
                    Check connection
                  </Button>
                ) : null}
                {canWrite && drive.connected ? (
                  <Button size="xs" variant="ghost" onClick={() => setConfirmDisconnect(true)} disabled={Boolean(busy)}>
                    <Unplug size={12} />
                    Disconnect
                  </Button>
                ) : null}
              </div>
            ) : null}
          </Card>

          <Card className="flex-1 p-4">
            <SectionHeader icon={HardDrive} title="Upload storage" hint="Where new uploads go; old files keep opening from where they are." />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PROVIDERS.map((provider) => {
                const Icon = provider.icon;
                const disabled = !canWrite || (provider.id === 'gdrive' && !driveUsable);
                const selected = selectedProvider === provider.id;
                return (
                  <label
                    key={provider.id}
                    className={`flex items-start gap-2 rounded-xl border px-3 py-2 transition ${selected ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-[var(--border)]'} ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                  >
                    <input
                      type="radio"
                      name="storage-provider"
                      className="mt-0.5"
                      checked={selected}
                      disabled={disabled}
                      onChange={() => setSelectedProvider(provider.id)}
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100">
                        <Icon size={13} />
                        {provider.label}
                        {activeProvider === provider.id ? <Badge tone="success">Active</Badge> : null}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
                        {provider.id === 'gdrive' && !driveUsable ? 'Connect Google Drive first.' : provider.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            {canWrite ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Button size="xs" onClick={saveProvider} loading={busy === 'save'} disabled={selectedProvider === activeProvider || Boolean(busy)}>
                  Save
                </Button>
                <Button size="xs" variant="outline" onClick={testProvider} loading={busy === 'test'} disabled={Boolean(busy)}>
                  Test {selectedProvider === 'gdrive' ? 'Google Drive' : 'local storage'}
                </Button>
              </div>
            ) : null}
          </Card>
        </div>

        {/* Right: backups */}
        <Card className="flex min-w-0 flex-col p-4 lg:col-span-3">
          <SectionHeader
            icon={DatabaseBackup}
            title="Database backups"
            hint={`${backup.schedule.label} · keeps ${backup.keep} daily, ${backup.keepManual ?? 5} manual, ${backup.keepPreRestore ?? 5} before-restore`}
          >
            {canWrite && backup.manualAllowed ? (
              <Button size="xs" onClick={backUpNow} loading={busy === 'backup'} disabled={Boolean(busy) || backup.running || !driveUsable}>
                <CloudUpload size={12} />
                Back up now
              </Button>
            ) : null}
            {canWrite && driveUsable ? (
              <Button
                size="xs"
                variant="outline"
                onClick={() => downloadDriveBackup(backups[0])}
                loading={busy === `download-${backups[0]?.id}`}
                disabled={Boolean(busy) || !backups.length}
                title={backups.length ? `Download the newest backup in Drive (${formatDate(backups[0].createdTime)})` : 'No backup in Drive yet'}
              >
                <Download size={12} />
                Download latest
              </Button>
            ) : null}
            {canWrite ? (
              <Button size="xs" variant="ghost" onClick={downloadFreshBackup} loading={busy === 'fresh'} disabled={Boolean(busy)} title="Makes a fresh dump now and saves it to this computer; nothing is sent to Drive">
                <DatabaseBackup size={12} />
                Fresh dump
              </Button>
            ) : null}
          </SectionHeader>

          {last?.status === 'FAILED' ? <Notice tone="danger">Last run failed: {last.error}</Notice> : null}
          {last?.retentionError ? <div className="mt-2"><Notice tone="warning">Old backups could not be pruned: {last.retentionError}</Notice></div> : null}

          {driveUsable ? (
            <div className={`flex-1 ${last?.status === 'FAILED' || last?.retentionError ? 'mt-3' : ''}`}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  In Google Drive{backups.length ? ` · ${backups.length}` : ''}
                </span>
                <Button size="xs" variant="ghost" onClick={loadBackups}>
                  <RefreshCw size={12} />
                  Refresh
                </Button>
              </div>
              {backupsError ? <p className="text-xs text-rose-600 dark:text-rose-400">{backupsError}</p> : null}
              {!backupsError && !backups.length ? <p className="text-xs text-slate-500">No backups in Drive yet.</p> : null}
              {backups.length ? (
                <SimpleTable
                  compact
                  rows={visibleBackups}
                  columns={[
                    {
                      key: 'created',
                      label: 'Backup',
                      render: (file) => (
                        <span className="flex flex-col" title={file.name}>
                          <span className="whitespace-nowrap font-medium text-slate-800 dark:text-slate-100">{formatDate(file.createdTime)}</span>
                          <span className="text-[10px] text-[var(--text-muted)]">{formatBytes(file.size)}</span>
                        </span>
                      )
                    },
                    {
                      key: 'kind',
                      label: 'Type',
                      nowrap: true,
                      render: (file) => {
                        const kind = BACKUP_KINDS[file.kind] || BACKUP_KINDS.scheduled;
                        return <Badge tone={kind.tone}>{kind.label}</Badge>;
                      }
                    },
                    {
                      key: 'verified',
                      label: 'Check',
                      nowrap: true,
                      render: (file) => (file.verified
                        ? <Badge tone="success" title="Matched the local dump when uploaded; checked again before a restore">Verified</Badge>
                        : <Badge tone="neutral" title="Older backup: checked against Drive's MD5 before a restore">Not verified</Badge>)
                    },
                    ...(canWrite || canRestore
                      ? [{
                          key: 'actions',
                          label: '',
                          align: 'right',
                          render: (file) => (
                            <div className="flex justify-end gap-1">
                              {canWrite ? (
                                <Button size="xs" variant="ghost" onClick={() => downloadDriveBackup(file)} loading={busy === `download-${file.id}`} disabled={Boolean(busy)} title="Download">
                                  <Download size={12} />
                                </Button>
                              ) : null}
                              {canRestore ? (
                                <Button size="xs" variant="outline" onClick={() => openRestore(file)} disabled={Boolean(busy) || backup.running}>
                                  <History size={12} />
                                  Restore
                                </Button>
                              ) : null}
                            </div>
                          )
                        }]
                      : [])
                  ]}
                />
              ) : null}
              {backups.length > BACKUPS_SHOWN ? (
                <button
                  type="button"
                  onClick={() => setShowAllBackups((value) => !value)}
                  className="mt-2 text-[11px] font-medium text-[var(--primary)] hover:underline"
                >
                  {showAllBackups ? 'Show fewer' : `Show all ${backups.length}`}
                </button>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">Connect Google Drive to see and restore backups.</p>
          )}
        </Card>
      </div>

      {/* Folded: health details and server settings */}
      {health ? (
        <FoldCard
          icon={ShieldCheck}
          title="Backup health"
          defaultOpen={healthIssues > 0}
          summary={healthIssues ? <Badge tone="warning">{healthIssues} to check</Badge> : <Badge tone="success">All OK</Badge>}
        >
          <BackupHealthBody health={health} />
        </FoldCard>
      ) : null}
      <FoldCard
        icon={Settings2}
        title="Drive & backup settings"
        summary={<span className="hidden text-[11px] text-slate-500 dark:text-slate-400 sm:inline">{backup.schedule.label} · keep {backup.keep}</span>}
      >
        <p className="mb-3 text-[11px] text-slate-500 dark:text-slate-400">
          The Google client, allowed account and folders come from the server env and are read-only here. Only the backup schedule can be changed.
        </p>
        <DriveConfigForm token={token} canWrite={canWrite} onSaved={() => loadStatus().catch(() => {})} />
      </FoldCard>

      <Modal
        open={Boolean(restoreTarget)}
        onClose={() => (busy === 'restore' ? null : setRestoreTarget(null))}
        title="Restore this backup?"
        subtitle={restoreTarget ? `${restoreTarget.name} · ${formatDate(restoreTarget.createdTime)}` : ''}
        width="min(520px, 95vw)"
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRestoreTarget(null)} disabled={busy === 'restore'}>
              Cancel
            </Button>
            <Button variant="danger" onClick={startRestore} loading={busy === 'restore'} disabled={restoreConfirm !== 'RESTORE' || busy === 'restore'}>
              <History size={14} />
              Restore
            </Button>
          </div>
        )}
      >
        <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
          <p className="flex gap-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 p-3 text-rose-800 dark:text-rose-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              The whole database goes back to {restoreTarget ? formatDate(restoreTarget.createdTime) : 'this backup'}. Everything entered after that time is lost.
            </span>
          </p>
          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500 dark:text-slate-400">
            <li>The backup file is checked against its checksum first; a damaged file is not restored.</li>
            <li>The site goes into maintenance and everyone is locked out until the restore finishes.</li>
            <li>A safety backup of the current data is taken first, so this can be undone.</li>
            <li>The Google Drive connection and storage settings stay as they are now.</li>
          </ul>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300" htmlFor="restore-confirm">
            Type RESTORE to confirm
          </label>
          <Input
            id="restore-confirm"
            value={restoreConfirm}
            onChange={(event) => setRestoreConfirm(event.target.value)}
            placeholder="RESTORE"
            autoComplete="off"
          />
        </div>
      </Modal>

      {treeOpen ? <DriveFolderTreeModal open={treeOpen} onClose={() => setTreeOpen(false)} token={token} /> : null}

      <ConfirmDialog
        open={confirmDisconnect}
        title="Disconnect Google Drive?"
        description="Automatic backups stop and the Google access is revoked; click Connect Google Drive to connect again. Backups already in Drive are kept."
        confirmLabel={busy === 'disconnect' ? 'Disconnecting...' : 'Disconnect'}
        onConfirm={disconnect}
        onClose={() => setConfirmDisconnect(false)}
        busy={busy === 'disconnect'}
      />
    </div>
  );
}
