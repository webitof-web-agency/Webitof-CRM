// Mounted on the API prefix before every route. While a restore runs, every API call gets 503
// except the few the maintenance screen needs. Also counts requests in progress so a restore
// can wait for them to finish before replacing the database.
const maintenance = require('../services/maintenance.service');

const ALLOWED = new Set(['GET /health', 'GET /maintenance/status', 'POST /maintenance/clear']);
// Once a restore has stopped (nothing is running), an admin must be able to sign in, possibly on
// another device or after the session expired, to read the error and exit maintenance.
const ALLOWED_WHEN_STOPPED = new Set(['POST /auth/login', 'GET /auth/me', 'GET /maintenance/details']);

let active = 0;

function trackRequest(res) {
  active += 1;
  let done = false;
  const release = () => {
    if (done) return;
    done = true;
    active -= 1;
  };
  res.once('finish', release);
  res.once('close', release);
}

function maintenanceGate(req, res, next) {
  const route = `${req.method} ${String(req.path || '').replace(/\/+$/, '') || '/'}`;
  if (ALLOWED.has(route)) return next();
  if (maintenance.isStopped() && ALLOWED_WHEN_STOPPED.has(route)) return next();
  if (maintenance.isActive()) {
    return res.status(503).json({
      success: false,
      code: 'MAINTENANCE',
      message: 'Under maintenance',
      maintenance: maintenance.publicState()
    });
  }
  trackRequest(res);
  return next();
}

function inFlight() {
  return active;
}

async function waitForDrain(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (active > 0) {
    if (Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return true;
}

module.exports = {
  inFlight,
  maintenanceGate,
  waitForDrain
};
