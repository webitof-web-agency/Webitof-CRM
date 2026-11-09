// Maintenance mode for database restores. The state lives in memory and in a small JSON file
// under uploads/ (deploys never touch it), never in the database: a restore replaces the database.
const fs = require('fs');
const path = require('path');

const DEFAULT_STATE_FILE = path.join(__dirname, '..', 'uploads', '.state', 'maintenance.json');
const INACTIVE = Object.freeze({ active: false });

let stateFile = DEFAULT_STATE_FILE;
let state = { ...INACTIVE };

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = true;
  return error;
}

function writeState(next) {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  const tmp = `${stateFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
  fs.renameSync(tmp, stateFile);
}

// Leaving or progressing must never fail because the disk is unhappy: memory wins, the file is best effort.
function persist() {
  try {
    writeState(state);
  } catch (error) {
    console.error('Maintenance state could not be saved:', error.message);
  }
}

// Short, safe text for the public status and 503 bodies; the full error stays private.
const PUBLIC_ERRORS = {
  failed: 'The restore failed. The database was not changed.',
  aborted: 'The safety backup failed, so the restore did not start. Nothing was changed.',
  'restored-with-warnings': 'The backup was restored, with warnings for the administrator.',
  interrupted: 'The server stopped during the restore. An administrator needs to check the data and exit maintenance.'
};

function stateDir() {
  return path.dirname(stateFile);
}

function setStateFileForTests(file) {
  stateFile = file || DEFAULT_STATE_FILE;
  state = { ...INACTIVE };
}

function enter({ reason = 'restore', startedBy = null, backupFile = null } = {}) {
  if (state.active) throw httpError('The site is already in maintenance.', 409);
  const next = {
    active: true,
    reason,
    phase: 'enter-maintenance',
    startedAt: new Date().toISOString(),
    startedBy,
    backupFile,
    outcome: null,
    error: null,
    finishedAt: null
  };
  // Saved before it takes effect: if the file cannot be written, maintenance never starts.
  writeState(next);
  state = next;
  return get();
}

function setPhase(phase) {
  state = { ...state, phase };
  persist();
}

// Every finished restore leaves maintenance; the database is either the old data or the backup.
function finish(outcome, error = '') {
  state = { ...state, active: false, outcome, error: error || null, finishedAt: new Date().toISOString() };
  persist();
  return get();
}

// force: from the server shell (npm run maintenance:clear) for a restore that is truly stuck.
function clear(actor = null, { force = false } = {}) {
  if (state.active && !state.outcome && !force) {
    throw httpError('A restore is still running. Wait for it to finish.', 409);
  }
  state = { ...state, active: false, outcome: state.outcome || 'cleared', clearedAt: new Date().toISOString(), clearedBy: actor?.id || null };
  persist();
  return get();
}

// A file that says a restore was running means the server stopped mid-restore. Stay closed
// until an admin has looked; --single-transaction means the data is not half restored.
function loadOnStartup() {
  try {
    state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Maintenance state could not be read:', error.message);
    state = { ...INACTIVE };
    return get();
  }
  if (state.active && !state.outcome) {
    state = {
      ...state,
      outcome: 'interrupted',
      error: 'The server stopped during the restore. The database is either fully the old data or fully the backup; check it, then exit maintenance.',
      finishedAt: new Date().toISOString()
    };
    persist();
  }
  if (state.active) console.warn(`Maintenance mode is ON (${state.outcome || state.phase}). Exit it from Settings once the data is checked.`);
  return get();
}

function get() {
  return JSON.parse(JSON.stringify(state));
}

function publicState() {
  const { active, reason, phase, startedAt, finishedAt, outcome, error } = state;
  return {
    active: Boolean(active),
    reason: reason || null,
    phase: phase || null,
    startedAt: startedAt || null,
    finishedAt: finishedAt || null,
    outcome: outcome || null,
    error: error ? PUBLIC_ERRORS[outcome] || 'See the server log for details.' : null
  };
}

// A restore has stopped (any outcome) but the site may still be closed: nothing is running.
function isStopped() {
  return Boolean(state.active && state.outcome);
}

function isActive() {
  return Boolean(state.active);
}

// For cron callbacks: true means "do nothing this tick".
function skipDuringMaintenance(jobName) {
  if (!state.active) return false;
  console.log(`[${jobName}] Skipped: site is in maintenance`);
  return true;
}

module.exports = {
  clear,
  enter,
  finish,
  get,
  isActive,
  isStopped,
  loadOnStartup,
  publicState,
  setPhase,
  setStateFileForTests,
  skipDuringMaintenance,
  stateDir
};
