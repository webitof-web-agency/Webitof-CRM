import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CloudUpload, DatabaseBackup, Download, ExternalLink, HardDrive, History, Link2, RefreshCw, Settings2, ShieldCheck, Unplug } from 'lucide-react';import { toast } from 'sonner';
import { api, downloadWithAuth } from '../../api/client';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ConfirmDialog } from '../overlays/ConfirmDialog';
import { DriveConfigForm } from './DriveConfigForm';
import { SimpleTable } from '../ui/SimpleTable';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';

const PROVIDERS = [
  { id: 'local', label: 'Local server', description: 'Files are saved on the CRM server disk.', icon: HardDrive },
  { id: 'gdrive', label: 'Google Drive', description: 'Files are saved in the connected Google Drive, in the Uploads folder.', icon: CloudUpload }
];

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

// A Drive folder: a link that opens it in Drive once it exists, else just its name.
function FolderLink({ folder, strong = false }) {
  if (!folder?.name) return null;
  const weight = strong ? 'font-medium' : '';
  if (!folder.link) return <span className={`text-slate-500 ${weight}`}>{folder.name}</span>;
  return (
    <a href={folder.link} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 text-[var(--primary)] hover:underline ${weight}`}>
      {folder.name} <ExternalLink size={12} />
    </a>
  );
}

function HealthRow({ label, ok, children }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <span className="flex min-w-0 items-center gap-2 text-right text-xs text-slate-800 dark:text-slate-100">
        <span className="min-w-0 break-words">{children}</span>
        {ok === undefined ? null : <Badge tone={ok ? 'success' : 'warning'}>{ok ? 'OK' : 'Check'}</Badge>}
      </span>
    </div>
  );
}

// Read-only readiness report from GET /google-drive/status (backupHealth): nothing here changes the server.
function BackupHealthCard({ health }) {
  const tools = health.tools || [];
  return (
    <Card className="p-4 sm:p-5 xl:order-5 xl:col-span-2">
      <SectionHeader icon={ShieldCheck} title="Backup health" description="Read-only checks that backups and restores will work on this server." />
      {health.problems?.length ? (
        <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          <ul className="list-disc space-y-0.5 pl-4">
            {health.problems.map((problem) => <li key={problem}>{problem}</li>)}
          </ul>
        </div>
      ) : (
        <div className="mb-3"><Badge tone="success" dot>All checks passed</Badge></div>
      )}
      <div className="grid gap-x-8 md:grid-cols-2 divide-y divide-slate-100 md:divide-y-0 dark:divide-slate-800">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <HealthRow label="Database server" ok={health.server ? !health.server.error : undefined}>
            {health.server?.error || (health.server?.version ? `PostgreSQL ${health.server.version}` : '—')}
          </HealthRow>
          {tools.map((tool) => (
            <HealthRow key={tool.name} label={tool.name} ok={tool.ok}>
              {tool.error || tool.version || '—'}
            </HealthRow>
          ))}
          <HealthRow label="Backup connection" ok={health.connection ? !health.connection.transactionPooler : undefined}>
            {health.connection ? `${health.connection.source} · ${health.connection.host}:${health.connection.port}` : '—'}
          </HealthRow>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
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
    </Card>
  );
}

function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div className="mb-3 border-b border-slate-100 dark:border-slate-800 pb-3">
      <div className="flex items-center gap-2">
        <Icon size={17} className="text-slate-800 dark:text-slate-100" />
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
    </div>
  );
}

export function StorageSettingsPanel({ token, canWrite, canRestore = false }) {
  const [status, setStatus] = useState(null);
  const [backups, setBackups] = useState([]);
  const [backupsError, setBackupsError] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('local');
  const [busy, setBusy] = useState('');
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoreConfirm, setRestoreConfirm] = useState('');
  const [checkResult, setCheckResult] = useState(null);
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

  // Applies the client id, secret and refresh token from the server env, and proves the account and folders work.
  const check = () => run('check', async () => {
    setCheckResult(null);
    try {
      const { data } = await api.googleDrive.check(token);
      setCheckResult({
        ok: true,
        message: `Connected to ${data.accountEmail || 'Google Drive'}. Folders ready in "${data.rootFolder?.name}": ${(data.categoryFolders || []).map((folder) => folder.name).join(', ')} and ${data.backupFolder?.name}.`
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

  return (
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <Card className="p-4 sm:p-5 xl:order-1">
        <SectionHeader icon={HardDrive} title="Upload storage" description="Where new uploads are saved. Files already uploaded keep opening from where they are." />
        <div className="grid gap-3 md:grid-cols-2">
          {PROVIDERS.map((provider) => {
            const Icon = provider.icon;
            const disabled = !canWrite || (provider.id === 'gdrive' && !driveUsable);
            return (
              <label
                key={provider.id}
                className={`flex gap-3 rounded-2xl border p-4 transition ${selectedProvider === provider.id ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-slate-200 dark:border-slate-700'} ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <input
                  type="radio"
                  name="storage-provider"
                  className="mt-1"
                  checked={selectedProvider === provider.id}
                  disabled={disabled}
                  onChange={() => setSelectedProvider(provider.id)}
                />
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <Icon size={16} />
                    {provider.label}
                    {activeProvider === provider.id ? <Badge tone="success" dot>Active</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {provider.id === 'gdrive' && !driveUsable ? 'Connect Google Drive below to use it.' : provider.description}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
        {canWrite ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={saveProvider} loading={busy === 'save'} disabled={selectedProvider === activeProvider || Boolean(busy)}>
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={testProvider} loading={busy === 'test'} disabled={Boolean(busy)}>
              Test {selectedProvider === 'gdrive' ? 'Google Drive' : 'local storage'}
            </Button>
          </div>
        ) : null}
      </Card>

      <Card className="p-4 sm:p-5 xl:order-3">
        <SectionHeader
          icon={Settings2}
          title="Google Drive settings"
          description="The Google client, allowed account and folders come from the server env and cannot be changed here. Only the backup schedule can be changed."
        />
        <DriveConfigForm token={token} canWrite={canWrite} onSaved={() => loadStatus().catch(() => {})} />
      </Card>

      <Card className="p-4 sm:p-5 xl:order-2">
        <SectionHeader icon={CloudUpload} title="Google Drive connection" description="One Google account holds uploaded files (when selected above) and the daily database backups. Connect signs in to Google; the access is kept encrypted in the database." />

        {drive.problems?.length ? (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
            <div className="font-semibold mb-1">Server configuration is incomplete</div>
            <ul className="list-disc pl-4 space-y-0.5">
              {drive.problems.map((problem) => <li key={problem}>{problem}</li>)}
            </ul>
          </div>
        ) : null}

        {drive.needsReconnect ? (
          <div className="mb-4 flex flex-wrap items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span className="min-w-0 flex-1">
              Google stopped accepting the Drive access{drive.accountEmail ? ` of ${drive.accountEmail}` : ''}
              {drive.needsReconnectSince ? ` (since ${formatDate(drive.needsReconnectSince)})` : ''}. Uploads to Drive and the
              daily backup are paused until it is reconnected.
            </span>
            {canWrite ? (
              <Button size="sm" variant="danger" onClick={connect} loading={busy === 'connect'} disabled={Boolean(busy)}>
                <RefreshCw size={14} />
                Reconnect Google Drive
              </Button>
            ) : null}
          </div>
        ) : null}

        {drive.envTokenError ? (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              The fallback refresh token in the server env (GOOGLE_OAUTH_REFRESH_TOKEN) was not accepted: {drive.envTokenError}.
              Click Connect Google Drive instead, or remove that env value.
            </span>
          </div>
        ) : null}

        <div className="grid gap-4 text-sm md:grid-cols-2">
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Status</div>
            <div className="mt-1">
              {drive.connected && !drive.needsReconnect ? <Badge tone="success" dot>Connected</Badge> : null}
              {drive.needsReconnect ? <Badge tone="danger" dot>Needs reconnect</Badge> : null}
              {!drive.connected ? <Badge tone="neutral" dot>Not connected</Badge> : null}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Account</div>
            <div className="mt-1 text-slate-800 dark:text-slate-100">{drive.accountEmail || '—'}</div>
            {drive.allowedEmail ? (
              <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Only {drive.allowedEmail} can be connected</div>
            ) : null}
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Connected</div>
            <div className="mt-1 text-slate-800 dark:text-slate-100">{formatDate(drive.connectedAt)}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Folders in Drive</div>
            <div className="mt-1 flex flex-col gap-1">
              <FolderLink folder={drive.rootFolder} strong />
              <div className="ml-3 flex flex-col gap-0.5 border-l border-slate-200 pl-2 text-xs dark:border-slate-700">
                {(drive.categoryFolders || []).map((folder) => <FolderLink key={folder.name} folder={folder} />)}
                <FolderLink folder={drive.backupFolder} />
              </div>
            </div>
          </div>
        </div>

        {canWrite || canRestore ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {canWrite ? (
              <Button
                size="sm"
                variant={drive.connected && !drive.needsReconnect ? 'outline' : 'primary'}
                onClick={connect}
                loading={busy === 'connect'}
                disabled={Boolean(busy) || !drive.configured}
                title={drive.configured ? 'Sign in to Google and give the ERP access to Drive' : 'Finish the server configuration first'}
              >
                <CloudUpload size={14} />
                {drive.connected ? 'Reconnect Google Drive' : 'Connect Google Drive'}
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={check} loading={busy === 'check'} disabled={Boolean(busy) || !drive.connected}>
              <Link2 size={14} />
              Check connection
            </Button>
            {drive.connected ? (
              <Button size="sm" variant="outline" onClick={() => setConfirmDisconnect(true)} disabled={Boolean(busy)}>
                <Unplug size={14} />
                Disconnect
              </Button>
            ) : null}
          </div>
        ) : null}
        {checkResult ? (
          <div
            role={checkResult.ok ? 'status' : 'alert'}
            className={`mt-3 rounded-xl border p-3 text-xs ${
              checkResult.ok
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
            }`}
          >
            {checkResult.message}
          </div>
        ) : null}
      </Card>

      <Card className="p-4 sm:p-5 xl:order-4">
        <SectionHeader
          icon={DatabaseBackup}
          title="Database backups"
          description={`${backup.schedule.label} to the Google Drive backup folder. Kept: newest ${backup.keep} daily, ${backup.keepManual ?? 5} manual and ${backup.keepPreRestore ?? 5} pre-restore backups.`}
        />

        {backup.alert ? (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              {backup.alert.message} Admins were alerted{backup.alert.alertedAt ? ` (${formatDate(backup.alert.alertedAt)})` : ''}; this clears after the next successful backup.
            </span>
          </div>
        ) : null}

        <div className="grid gap-4 text-sm md:grid-cols-2">
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Last run</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-slate-800 dark:text-slate-100">
              {backup.running ? <Badge tone="info" dot>Running…</Badge> : null}
              {!backup.running && last?.status === 'SUCCESS' ? <Badge tone="success" dot>Succeeded</Badge> : null}
              {!backup.running && last?.status === 'FAILED' ? <Badge tone="danger" dot>Failed</Badge> : null}
              {!last ? <span className="text-slate-500">No backup yet</span> : <span>{formatDate(last.finishedAt || last.startedAt)}</span>}
            </div>
            {last?.status === 'FAILED' ? <p className="mt-1 text-xs text-rose-600 dark:text-rose-400 break-words">{last.error}</p> : null}
            {last?.retentionError ? <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Old backups could not be pruned: {last.retentionError}</p> : null}
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Last successful backup</div>
            <div className="mt-1 text-slate-800 dark:text-slate-100">
              {backup.lastSuccess ? `${formatDate(backup.lastSuccess.finishedAt)} · ${formatBytes(backup.lastSuccess.size)}` : '—'}
            </div>
          </div>
        </div>

        {canWrite ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {backup.manualAllowed ? (
              <Button size="sm" onClick={backUpNow} loading={busy === 'backup'} disabled={Boolean(busy) || backup.running || !driveUsable}>
                <CloudUpload size={14} />
                Back up now to Drive
              </Button>
            ) : null}
            {canWrite ? (
              <Button size="sm" variant="outline" onClick={downloadFreshBackup} loading={busy === 'fresh'} disabled={Boolean(busy)}>
                <Download size={14} />
                Download backup
              </Button>
            ) : null}
          </div>
        ) : null}
        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          Download backup makes a fresh dump and saves it to this computer; nothing is sent to Drive. Daily backups in Drive are kept for {backup.keep} days; Back up now and the safety copy taken before a restore are counted separately. Any of them can be restored from the list below; it is checked against its checksum first.
        </p>

        {driveUsable ? (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Backups in Google Drive</h4>
              <Button size="xs" variant="ghost" onClick={loadBackups}>
                <RefreshCw size={12} />
                Refresh
              </Button>
            </div>
            {backupsError ? <p className="text-xs text-rose-600 dark:text-rose-400">{backupsError}</p> : null}
            {!backupsError && !backups.length ? <p className="text-xs text-slate-500">No backups in Drive yet.</p> : null}
            {backups.length ? (
              <SimpleTable
                rows={backups}
                columns={[
                  { key: 'name', label: 'File', className: 'font-medium break-all', render: (file) => file.name },
                  {
                    key: 'kind',
                    label: 'Type',
                    nowrap: true,
                    render: (file) => {
                      const kind = BACKUP_KINDS[file.kind] || BACKUP_KINDS.scheduled;
                      return <Badge tone={kind.tone}>{kind.label}</Badge>;
                    }
                  },
                  { key: 'created', label: 'Created', nowrap: true, className: 'text-[var(--text-muted)]', render: (file) => formatDate(file.createdTime) },
                  { key: 'size', label: 'Size', nowrap: true, className: 'text-[var(--text-muted)]', render: (file) => formatBytes(file.size) },
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
                          <div className="flex justify-end gap-2">
                            {canWrite ? (
                              <Button size="xs" variant="outline" onClick={() => downloadDriveBackup(file)} loading={busy === `download-${file.id}`} disabled={Boolean(busy)}>
                                <Download size={12} />
                                Download
                              </Button>
                            ) : null}
                            {canRestore ? (
                              <Button size="xs" variant="danger" onClick={() => openRestore(file)} disabled={Boolean(busy) || backup.running}>
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
          </div>
        ) : null}
      </Card>

      {status.backupHealth ? <BackupHealthCard health={status.backupHealth} /> : null}

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

      <ConfirmDialog
        open={confirmDisconnect}
        title="Disconnect Google Drive?"
        description="Automatic backups stop and the refresh token is revoked at Google; to connect again, create a new one in the OAuth Playground. Backups already in Drive are kept."
        confirmLabel={busy === 'disconnect' ? 'Disconnecting...' : 'Disconnect'}
        onConfirm={disconnect}
        onClose={() => setConfirmDisconnect(false)}
        busy={busy === 'disconnect'}
      />
    </div>
  );
}
