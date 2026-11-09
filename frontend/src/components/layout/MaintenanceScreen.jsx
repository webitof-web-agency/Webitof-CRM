import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, DatabaseBackup, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { api, clearApiCache } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';

const POLL_MS = 5000;
const RESULT_KEY = 'webitof-restore-result';

const PHASES = {
  'enter-maintenance': 'Starting',
  drain: 'Waiting for open requests to finish',
  'safety-backup': 'Taking a safety backup of the current data',
  'preserve-settings': 'Saving the Google Drive connection',
  download: 'Downloading the backup from Google Drive',
  restore: 'Restoring the database',
  migrate: 'Updating the database structure',
  'reapply-settings': 'Reconnecting Google Drive'
};

const STOPPED = new Set(['interrupted', 'failed', 'aborted']);

function formatIst(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
}

function readResult() {
  try {
    const raw = window.sessionStorage.getItem(RESULT_KEY);
    window.sessionStorage.removeItem(RESULT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Covers the whole app while a database restore runs. Shown when any API call answers 503
// MAINTENANCE, when the socket announces it, or when the site is already in maintenance on load.
export function MaintenanceScreen() {
  const { token, hasPermission } = useAuth();
  const [state, setState] = useState(null);
  const [clearing, setClearing] = useState(false);
  const shownRef = useRef(false);

  const finish = useCallback((result) => {
    try {
      window.sessionStorage.setItem(RESULT_KEY, JSON.stringify({ outcome: result.outcome, error: result.error }));
    } catch {
      // Private mode: the reload still happens, only the result toast is lost.
    }
    clearApiCache();
    window.location.reload();
  }, []);

  const check = useCallback(async () => {
    try {
      const response = await api.maintenance.status();
      const next = response.data;
      if (next?.active) {
        shownRef.current = true;
        setState(next);
      } else if (shownRef.current) {
        finish(next || {});
      }
    } catch {
      // Server restarting: keep showing the screen and try again on the next tick.
    }
  }, [finish]);

  useEffect(() => {
    const result = readResult();
    if (result?.outcome === 'success') toast.success('The backup was restored.');
    else if (result?.outcome === 'restored-with-warnings') toast.warning(`The backup was restored with warnings: ${result.error}`);
    else if (result?.outcome) toast.error(`The restore did not complete: ${result.error || result.outcome}`);
    check();
  }, [check]);

  useEffect(() => {
    const onMaintenance = (event) => {
      shownRef.current = true;
      setState((current) => ({ ...(current || {}), ...(event.detail || {}), active: true }));
    };
    window.addEventListener('system:maintenance', onMaintenance);
    return () => window.removeEventListener('system:maintenance', onMaintenance);
  }, []);

  useEffect(() => {
    if (!state?.active) return undefined;
    const timer = window.setInterval(check, POLL_MS);
    return () => window.clearInterval(timer);
  }, [state?.active, check]);

  const exitMaintenance = async () => {
    setClearing(true);
    try {
      const response = await api.maintenance.clear(token);
      finish({ ...(state || {}), ...(response.data || {}) });
    } catch (error) {
      toast.error(error.message || 'Could not exit maintenance');
      setClearing(false);
    }
  };

  if (!state?.active) return null;

  const stopped = STOPPED.has(state.outcome);
  const canExit = stopped && Boolean(token) && hasPermission('backups.restore');

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-50/95 dark:bg-slate-950/95 px-4 backdrop-blur-sm" role="alertdialog" aria-live="polite" aria-label="Under maintenance">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
        <div className="flex items-center gap-3">
          {stopped ? (
            <AlertTriangle size={28} className="shrink-0 text-amber-500" />
          ) : (
            <DatabaseBackup size={28} className="shrink-0 animate-pulse text-[var(--primary)]" />
          )}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Under maintenance</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {stopped ? 'The data restore stopped before it finished.' : 'Data is being restored from a backup. Please wait.'}
            </p>
          </div>
        </div>

        <dl className="mt-5 space-y-2 text-sm">
          {state.startedAt ? (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">Started</dt>
              <dd className="text-slate-800 dark:text-slate-100">{formatIst(state.startedAt)} IST</dd>
            </div>
          ) : null}
          {!stopped && state.phase ? (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">Step</dt>
              <dd className="text-right text-slate-800 dark:text-slate-100">{PHASES[state.phase] || state.phase}</dd>
            </div>
          ) : null}
        </dl>

        {stopped && state.error ? (
          <p className="mt-4 rounded-lg bg-amber-50 dark:bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200 break-words">{state.error}</p>
        ) : null}

        {!stopped ? (
          <p className="mt-5 text-xs text-slate-500 dark:text-slate-400">This page reloads by itself when the site is back.</p>
        ) : null}

        {canExit ? (
          <Button className="mt-5 w-full" onClick={exitMaintenance} loading={clearing} disabled={clearing}>
            <LogOut size={14} />
            Exit maintenance
          </Button>
        ) : null}
        {stopped && !canExit ? (
          <p className="mt-5 text-xs text-slate-500 dark:text-slate-400">An administrator needs to check the data and reopen the site.</p>
        ) : null}
      </div>
    </div>
  );
}
