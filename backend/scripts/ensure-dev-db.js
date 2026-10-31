// Runs before `npm run dev` (npm "predev" hook). It makes local development start in one step:
//  1. refuses to run the dev server against a production or server-only database, because
//     startup runs migrations, default-data seeding and the automation crons (client emails);
//  2. starts the local dev Postgres cluster if it is not running, then waits until it accepts
//     queries (after an unclean shutdown Postgres first replays its WAL).
// Production uses `npm start`, which does not run this script.
require('dotenv').config();
const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const { Client } = require('pg');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const PG_CTL = process.env.DEV_PG_CTL || 'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_ctl.exe';
const PG_DATA = process.env.DEV_PG_DATA || path.join(process.env.LOCALAPPDATA || '', 'webitof-dev-pg', 'data');

function fail(message) {
  console.error(`\n[dev-db] ${message}\n`);
  process.exit(1);
}

function portOpen(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, host === 'localhost' ? '127.0.0.1' : host);
    socket.setTimeout(1500);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => resolve(false));
  });
}

async function acceptsQueries(connectionString) {
  const client = new Client({ connectionString, connectionTimeoutMillis: 3000 });
  try {
    await client.connect();
    await client.query('select 1');
    return true;
  } catch {
    return false;
  } finally {
    client.end().catch(() => {});
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const raw = String(process.env.DATABASE_URL || '').trim().replace(/^"|"$/g, '');
  if (!raw) fail('DATABASE_URL is not set in backend/.env.');

  let url;
  try {
    url = new URL(raw);
  } catch {
    fail('DATABASE_URL in backend/.env is not a valid postgres URL.');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const port = Number(url.port || 5432);
  const database = url.pathname.replace(/^\//, '');

  if (!LOCAL_HOSTS.has(host)) {
    fail(`DATABASE_URL points at "${host}", which is not this computer (a server-only/production host).\n` +
      '         Use the local dev line in backend/.env:\n' +
      '         DATABASE_URL="postgresql://webitof:<password>@localhost:55432/webitofcrm_dev"');
  }
  if (/prod/i.test(database) && process.env.ALLOW_PROD_DEV !== 'true') {
    fail(`DATABASE_URL uses the production database "${database}" (through a tunnel).\n` +
      '         The dev server would run migrations, seeding and client-email automation on it.\n' +
      '         Switch backend/.env back to the local dev DB, or set ALLOW_PROD_DEV=true if you really mean it.');
  }

  if (await acceptsQueries(raw)) {
    console.log(`[dev-db] ${database} on ${host}:${port} is ready.`);
    return;
  }

  if (!(await portOpen(host, port))) {
    if (!fs.existsSync(PG_CTL)) fail(`Postgres is not running on port ${port} and pg_ctl was not found at ${PG_CTL} (set DEV_PG_CTL).`);
    if (!fs.existsSync(PG_DATA)) fail(`Postgres is not running on port ${port} and the data folder ${PG_DATA} does not exist (set DEV_PG_DATA).`);
    console.log(`[dev-db] Starting local Postgres on port ${port}...`);
    // Detached with no inherited handles, so the cluster keeps running after npm exits.
    const child = spawn(PG_CTL, ['-D', PG_DATA, '-o', `-p ${port}`, '-l', path.join(path.dirname(PG_DATA), 'server.log'), '-W', 'start'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.unref();
  } else {
    console.log('[dev-db] Postgres is starting up (recovering after an unclean shutdown)...');
  }

  for (let attempt = 0; attempt < 60; attempt += 1) {
    await sleep(1000);
    if (await acceptsQueries(raw)) {
      console.log(`[dev-db] ${database} on ${host}:${port} is ready.`);
      return;
    }
  }
  fail(`Postgres did not become ready on port ${port} within 60 s. See ${path.join(path.dirname(PG_DATA), 'server.log')}.`);
}

main().catch((error) => fail(error.message));
