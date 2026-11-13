// Volume + concurrency check (a script, not a test): seeds a realistic book through the API, then
// times the heavy list/report endpoints one at a time and with 20 users at once.
// Run: QA_API_URL=... QA_DATABASE_URL=... node tests/e2e/load.js [--seed] [--users=20]
const { api, ok, fixtures, closeDb, tag } = require('./lib');

const args = process.argv.slice(2);
const SEED = args.includes('--seed');
const USERS = Number((args.find((a) => a.startsWith('--users=')) || '--users=20').split('=')[1]);

async function pool(items, size, work) {
  const results = [];
  let next = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index], index);
    }
  }));
  return results;
}

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

async function timed(path, token) {
  const start = performance.now();
  const res = await api(path, { token });
  return { ms: performance.now() - start, status: res.status, bytes: res.text.length };
}

async function seed(f) {
  const t = f.adminToken;
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  console.log('seeding clients...');
  const clients = await pool(range(300), 8, async (i) => ok(await api('/clients', { method: 'POST', token: t, body: { name: `Load Client ${tag} ${String.fromCharCode(97 + (i % 26))}${i}`, state: i % 3 ? 'Chhattisgarh' : 'Maharashtra', mobile: `98${String(10000000 + i).slice(-8)}` } })));
  console.log('seeding leads...');
  await pool(range(1500), 8, async (i) => api('/leads', { method: 'POST', token: t, body: { contactPerson: `Load Lead ${tag}`, phone: `97${String(10000000 + i).slice(-8)}`, requiredServices: ['Website Development'], source: 'Website', status: 'New' } }));
  console.log('seeding invoices...');
  const invoices = await pool(range(1000), 8, async (i) => ok(await api('/invoices', { method: 'POST', token: t, body: { clientId: clients[i % clients.length].id, status: 'Sent', items: [{ description: 'Work', quantity: 1 + (i % 3), rate: 1000 + i, gstRate: 18 }] } })));
  console.log('seeding payments...');
  await pool(range(500), 8, async (i) => api('/payments', { method: 'POST', token: t, body: { invoiceId: invoices[i].id, amountReceived: 500 } }));
}

async function main() {
  const f = await fixtures();
  if (SEED) await seed(f);
  const paths = [
    '/leads', '/leads?limit=50', '/clients', '/invoices', '/invoices?limit=50', '/payments', '/follow-ups',
    '/reports/dashboard', '/reports/profit-loss', '/reports/gst', '/finance/summary', '/finance/ledger',
    '/dashboard/me', '/leads/search/global?q=load', '/hrm/dashboard/overview', '/notifications'
  ];
  console.log(`\nendpoint                               single(ms)  ${USERS} users p50/p95/max (ms)  errors  size(KB)`);
  for (const path of paths) {
    const single = await timed(path, f.adminToken);
    const runs = await Promise.all(Array.from({ length: USERS }, () => timed(path, f.adminToken)));
    const ms = runs.map((r) => r.ms).sort((a, b) => a - b);
    const errors = runs.filter((r) => r.status >= 400).length + (single.status >= 400 ? 1 : 0);
    console.log(`${path.padEnd(38)} ${single.ms.toFixed(0).padStart(9)}   ${pct(ms, 0.5).toFixed(0).padStart(6)}/${pct(ms, 0.95).toFixed(0).padStart(6)}/${ms[ms.length - 1].toFixed(0).padStart(6)}        ${String(errors).padStart(4)}  ${(single.bytes / 1024).toFixed(0).padStart(7)}`);
  }
  // Mixed burst: 60 writes + reads at once must all answer (no pool starvation).
  const burst = await Promise.all(Array.from({ length: 60 }, (_, i) => (i % 3 === 0
    ? api('/invoices', { method: 'POST', token: f.adminToken, body: { status: 'Draft', items: [{ description: 'Burst', quantity: 1, rate: 10, gstRate: 18 }] } })
    : api(i % 3 === 1 ? '/reports/dashboard' : '/leads?limit=20', { token: f.adminToken }))));
  const codes = burst.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {});
  console.log(`\nmixed burst of 60 (20 invoice creates + 40 reads): ${JSON.stringify(codes)}`);
  await closeDb();
}

main().catch(async (error) => { console.error(error); await closeDb(); process.exit(1); });
