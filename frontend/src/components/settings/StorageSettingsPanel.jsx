import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CloudUpload, DatabaseBackup, Download, ExternalLink, HardDrive, Link2, RefreshCw, Settings2, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { api, downloadWithAuth } from '../../api/client';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ConfirmDialog } from '../overlays/ConfirmDialog';
import { DriveConfigForm } from './DriveConfigForm';

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

function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div className="mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
      <div className="flex items-center gap-2">
        <Icon size={20} className="text-slate-800 dark:text-slate-100" />
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>
    </div>
  );
}

export function StorageSettingsPanel({ token, canWrite, oauthResult = null, onOauthResultShown }) {
  const [status, setStatus] = useState(null);
  const [backups, setBackups] = useState([]);
  const [backupsError, setBackupsError] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('local');
  const [busy, setBusy] = useState('');
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

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

  // Result of the Google sign-in redirect (?gdrive=connected|error&message=…).
  useEffect(() => {
    if (!oauthResult?.gdrive) return;
    if (oauthResult.gdrive === 'connected') toast.success('Google Drive connected');
    else toast.error(oauthResult.message || 'Google Drive could not be connected');
    onOauthResultShown?.();
  }, [oauthResult, onOauthResultShown]);

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

  const connect = () => run('connect', async () => {
    const response = await api.googleDrive.connect(token);
    window.location.assign(response.data.url);
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
    <div className="space-y-6">
      <Card className="p-6">
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

      <Card className="p-6">
        <SectionHeader icon={Settings2} title="Google Drive settings" description="OAuth app, folders and backup schedule. Create the OAuth client (type Web application, Drive API enabled) in Google Cloud." />
        <DriveConfigForm token={token} canWrite={canWrite} onSaved={() => loadStatus().catch(() => {})} />
      </Card>

      <Card className="p-6">
        <SectionHeader icon={CloudUpload} title="Google Drive connection" description="One Google account holds uploaded files (when selected above) and the daily database backups." />

        {drive.problems?.length ? (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
            <div className="font-semibold mb-1">Server configuration is incomplete</div>
            <ul className="list-disc pl-4 space-y-0.5">
              {drive.problems.map((problem) => <li key={problem}>{problem}</li>)}
            </ul>
          </div>
        ) : null}

        {drive.needsReconnect ? (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            Google access was revoked or expired. Uploads to Drive and backups are paused until you reconnect the same account.
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
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Connected</div>
            <div className="mt-1 text-slate-800 dark:text-slate-100">{formatDate(drive.connectedAt)}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Folders</div>
            <div className="mt-1 flex flex-col gap-1">
              {[drive.uploadsFolder, drive.backupFolder].map((folder) => (
                folder?.link ? (
                  <a key={folder.name} href={folder.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline">
                    {folder.name} <ExternalLink size={12} />
                  </a>
                ) : (
                  <span key={folder?.name} className="text-slate-500">{folder?.name}</span>
                )
              ))}
            </div>
          </div>
        </div>

        {canWrite ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="sm" onClick={connect} loading={busy === 'connect'} disabled={Boolean(busy) || Boolean(drive.problems?.length)}>
              <Link2 size={14} />
              {drive.connected ? 'Reconnect Google Drive' : 'Connect Google Drive'}
            </Button>
            {drive.connected ? (
              <Button size="sm" variant="outline" onClick={() => setConfirmDisconnect(true)} disabled={Boolean(busy)}>
                <Unplug size={14} />
                Disconnect
              </Button>
            ) : null}
          </div>
        ) : null}
        <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
          Google redirect URI to register: <code className="break-all">{drive.redirectUri}</code>
        </p>
      </Card>

      <Card className="p-6">
        <SectionHeader icon={DatabaseBackup} title="Database backups" description={`${backup.schedule.label} to the Google Drive backup folder, keeping the newest ${backup.keep}.`} />

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
            <Button size="sm" variant="outline" onClick={downloadFreshBackup} loading={busy === 'fresh'} disabled={Boolean(busy)}>
              <Download size={14} />
              Download backup
            </Button>
          </div>
        ) : null}
        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          Download backup makes a fresh dump and saves it to this computer; nothing is sent to Drive. Restore with <code>pg_restore --clean --if-exists --no-owner --no-privileges -d &lt;database&gt; &lt;file&gt;.dump</code>.
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
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">File</th>
                      <th className="px-3 py-2 font-semibold">Created</th>
                      <th className="px-3 py-2 font-semibold">Size</th>
                      {canWrite ? <th className="px-3 py-2" /> : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {backups.map((file) => (
                      <tr key={file.id}>
                        <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100 break-all">{file.name}</td>
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{formatDate(file.createdTime)}</td>
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{formatBytes(file.size)}</td>
                        {canWrite ? (
                          <td className="px-3 py-2 text-right">
                            <Button size="xs" variant="outline" onClick={() => downloadDriveBackup(file)} loading={busy === `download-${file.id}`} disabled={Boolean(busy)}>
                              <Download size={12} />
                              Download
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>

      <ConfirmDialog
        open={confirmDisconnect}
        title="Disconnect Google Drive?"
        description="Automatic backups stop until you connect again. Backups already in Drive are kept."
        confirmLabel={busy === 'disconnect' ? 'Disconnecting...' : 'Disconnect'}
        onConfirm={disconnect}
        onClose={() => setConfirmDisconnect(false)}
        busy={busy === 'disconnect'}
      />
    </div>
  );
}
