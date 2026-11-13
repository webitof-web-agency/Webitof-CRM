// Finance end to end: client -> invoice (GST) -> payments -> credit notes -> reports, with the edge
// cases that corrupt books: overpayment by every route, rounding, negative/odd line values,
// status forging, duplicate numbers and two requests racing for the same balance.
// Run: QA_API_URL=... QA_DATABASE_URL=... node --test --test-concurrency=1 tests/e2e/finance.e2e.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { api, ok, closeDb, fixtures, tag } = require('./lib');

let f;
let local; // client in Chhattisgarh (company state) -> CGST + SGST
let other; // client in Maharashtra -> IGST
const today = new Date().toISOString().slice(0, 10);
const money = (v) => Math.round(Number(v) * 100) / 100;

async function invoice(body, token = f.adminToken) {
  return api('/invoices', {
    method: 'POST',
    token,
    body: { clientId: local.id, invoiceDate: today, dueDate: today, amountType: 'GST Extra', status: 'Sent', ...body }
  });
}
const line = (rate, extra = {}) => ({ description: 'Website build', quantity: 1, rate, gstRate: 18, ...extra });

test.before(async () => {
  f = await fixtures();
  local = ok(await api('/clients', { method: 'POST', token: f.adminToken, body: { name: `Local Client ${tag}`, companyName: `Local ${tag}`, state: 'Chhattisgarh', country: 'India', mobile: '9811100010' } }), 'local client');
  other = ok(await api('/clients', { method: 'POST', token: f.adminToken, body: { name: `Other Client ${tag}`, companyName: `Other ${tag}`, state: 'Maharashtra', country: 'India', gstin: '27AAACR5055K1Z7' } }), 'other client');
});
test.after(closeDb);

test('client phone numbers are stored as +91 E.164', () => {
  assert.equal(local.mobile, '+919811100010');
});

test('intra-state invoice splits 18% into CGST 9% + SGST 9%', async () => {
  const inv = ok(await invoice({ items: [line(10000)] }), 'invoice');
  assert.equal(money(inv.taxableAmount), 10000);
  assert.equal(money(inv.cgst), 900);
  assert.equal(money(inv.sgst), 900);
  assert.equal(money(inv.igst || 0), 0);
  assert.equal(money(inv.totalAmount), 11800);
});

test('inter-state invoice charges IGST 18%', async () => {
  const inv = ok(await invoice({ clientId: other.id, items: [line(10000)] }), 'invoice');
  assert.equal(money(inv.igst), 1800);
  assert.equal(money((inv.cgst || 0) + (inv.sgst || 0)), 0);
  assert.equal(money(inv.totalAmount), 11800);
});

test('GST inclusive pricing backs the tax out of the price', async () => {
  const inv = ok(await invoice({ amountType: 'GST Inclusive', items: [line(11800)] }), 'invoice');
  assert.equal(money(inv.totalAmount), 11800);
  assert.equal(money(inv.taxableAmount), 10000);
});

test('rounding: 3 x 33.33 at 18% stays consistent to the paisa', async () => {
  const inv = ok(await invoice({ items: [line(33.33, { quantity: 3 })] }), 'invoice');
  assert.equal(money(inv.taxableAmount), 99.99);
  assert.equal(money(inv.taxableAmount + inv.gstAmount), money(inv.totalAmount));
  assert.equal(money(inv.cgst + inv.sgst), money(inv.gstAmount));
});

test('a line cannot go negative or be inflated by a negative discount', async () => {
  const cases = [
    [line(1000, { quantity: -2 })],
    [line(-1000)],
    [line(1000, { discount: -50 })],
    [line(1000, { discount: 150 })],
    [line(1000, { gstRate: -18 })]
  ];
  for (const items of cases) {
    const res = await invoice({ items });
    if (res.status >= 400 && res.status < 500) continue; // rejected: fine
    const inv = ok(res, JSON.stringify(items));
    assert.ok(inv.totalAmount >= 0, `negative total for ${JSON.stringify(items)}`);
    assert.ok(inv.totalAmount <= 1180.001, `inflated total ${inv.totalAmount} for ${JSON.stringify(items)}`);
  }
});

test('invoice-level discount or advance larger than the bill never makes a negative invoice', async () => {
  for (const extra of [{ discountAmount: 50000 }, { advanceAmount: 50000 }, { discount: 500, discountType: 'percent' }]) {
    const res = await invoice({ items: [line(1000)], ...extra });
    if (res.status >= 400 && res.status < 500) continue;
    const inv = ok(res);
    assert.ok(inv.totalAmount >= 0, `negative total with ${JSON.stringify(extra)}: ${inv.totalAmount}`);
  }
});

test('an invoice cannot be created already "Paid" with nothing received', async () => {
  const res = await invoice({ items: [line(1000)], status: 'Paid' });
  if (res.status >= 400 && res.status < 500) return;
  const inv = ok(res);
  const fresh = ok(await api(`/invoices/${inv.id}`, { token: f.adminToken }));
  assert.notEqual(fresh.status, 'Paid', 'invoice marked Paid with zero payments');
  assert.ok(money(fresh.balanceDue ?? fresh.outstandingAmount) > 0);
});

test('a manually typed invoice number cannot be used twice', async () => {
  const number = `QA/${tag}/0001`;
  ok(await invoice({ items: [line(100)], invoiceNumber: number }));
  const dup = await invoice({ items: [line(100)], invoiceNumber: number });
  assert.ok([400, 409].includes(dup.status), `duplicate invoice number accepted (${dup.status})`);
});

test('invalid calendar dates are rejected', async () => {
  const res = await invoice({ items: [line(100)], invoiceDate: '2026-02-30' });
  assert.ok(res.status >= 400 && res.status < 500, `2026-02-30 accepted (${res.status})`);
});

test('20 invoices created at once get 20 different numbers', async () => {
  const results = await Promise.all(Array.from({ length: 20 }, () => invoice({ items: [line(100)] })));
  const numbers = results.map((r) => ok(r, 'parallel invoice').invoiceNumber);
  assert.equal(new Set(numbers).size, 20, `duplicates: ${numbers.sort().join(', ')}`);
});

test('payments: partial -> Partially Paid, rest -> Paid, more -> refused', async () => {
  const inv = ok(await invoice({ items: [line(10000)] }));
  ok(await api('/payments', { method: 'POST', token: f.adminToken, body: { invoiceId: inv.id, amountReceived: 5000, paymentDate: today } }));
  let fresh = ok(await api(`/invoices/${inv.id}`, { token: f.adminToken }));
  assert.equal(fresh.status, 'Partially Paid');
  ok(await api('/payments', { method: 'POST', token: f.adminToken, body: { invoiceId: inv.id, amountReceived: 6000, tdsDeducted: 800, paymentDate: today } }));
  fresh = ok(await api(`/invoices/${inv.id}`, { token: f.adminToken }));
  assert.equal(fresh.status, 'Paid');
  const over = await api('/payments', { method: 'POST', token: f.adminToken, body: { invoiceId: inv.id, amountReceived: 1, paymentDate: today } });
  assert.equal(over.status, 409);
});

test('the overpayment check cannot be dodged by naming the invoice by its number', async () => {
  const inv = ok(await invoice({ items: [line(1000)] }));
  ok(await api('/payments', { method: 'POST', token: f.adminToken, body: { invoiceId: inv.id, amountReceived: 1180, paymentDate: today } }));
  const byNumber = await api('/payments', { method: 'POST', token: f.adminToken, body: { invoiceId: inv.invoiceNumber, amountReceived: 1180, paymentDate: today } });
  assert.ok(byNumber.status >= 400, `second full payment via invoice number accepted (${byNumber.status})`);
});

test('two payments racing for the same balance: only one is accepted', async () => {
  const inv = ok(await invoice({ items: [line(1000)] }));
  const race = await Promise.all([1, 2, 3, 4, 5].map(() => api('/payments', {
    method: 'POST', token: f.adminToken, body: { invoiceId: inv.id, amountReceived: 1180, paymentDate: today }
  })));
  assert.equal(race.filter((r) => r.status === 201 || r.status === 200).length, 1, race.map((r) => r.status).join(','));
});

test('deleting a payment puts the invoice back to outstanding', async () => {
  const inv = ok(await invoice({ items: [line(1000)] }));
  const pay = ok(await api('/payments', { method: 'POST', token: f.adminToken, body: { invoiceId: inv.id, amountReceived: 1180, paymentDate: today } }));
  assert.equal(ok(await api(`/invoices/${inv.id}`, { token: f.adminToken })).status, 'Paid');
  ok(await api(`/payments/${pay.id}`, { method: 'DELETE', token: f.adminToken }));
  const fresh = ok(await api(`/invoices/${inv.id}`, { token: f.adminToken }));
  assert.notEqual(fresh.status, 'Paid');
  assert.equal(money(fresh.balanceDue), 1180);
});

test('a paid invoice cannot be edited down below what was received', async () => {
  const inv = ok(await invoice({ items: [line(1000)] }));
  ok(await api('/payments', { method: 'POST', token: f.adminToken, body: { invoiceId: inv.id, amountReceived: 1180, paymentDate: today } }));
  const res = await api(`/invoices/${inv.id}`, { method: 'PUT', token: f.adminToken, body: { items: [line(100)] } });
  if (res.status >= 400 && res.status < 500) return;
  const fresh = ok(await api(`/invoices/${inv.id}`, { token: f.adminToken }));
  assert.ok(money(fresh.balanceDue) >= 0, `invoice edited below receipts: balance ${fresh.balanceDue}`);
});

test('payment edge values: zero, negative, NaN, negative TDS, wrong client, draft invoice', async () => {
  const inv = ok(await invoice({ items: [line(1000)] }));
  const draft = ok(await invoice({ items: [line(1000)], status: 'Draft' }));
  const bad = [
    { invoiceId: inv.id, amountReceived: 0 },
    { invoiceId: inv.id, amountReceived: -100 },
    { invoiceId: inv.id, amountReceived: 'abc' },
    { invoiceId: inv.id, amountReceived: 100, tdsDeducted: -5 },
    { invoiceId: inv.id, amountReceived: 100, clientId: other.id },
    { invoiceId: draft.id, amountReceived: 100 },
    { invoiceId: 'does-not-exist', amountReceived: 100 }
  ];
  for (const body of bad) {
    const res = await api('/payments', { method: 'POST', token: f.adminToken, body: { paymentDate: today, ...body } });
    assert.ok(res.status >= 400 && res.status < 500, `${JSON.stringify(body)} gave ${res.status}`);
  }
});

test('the same UTR cannot be recorded twice', async () => {
  const inv = ok(await invoice({ items: [line(1000)] }));
  const utr = `UTR${tag}`.toUpperCase();
  ok(await api('/payments', { method: 'POST', token: f.adminToken, body: { invoiceId: inv.id, amountReceived: 100, transactionId: utr, paymentDate: today } }));
  const dup = await api('/payments', { method: 'POST', token: f.adminToken, body: { invoiceId: inv.id, amountReceived: 100, transactionId: utr.toLowerCase(), paymentDate: today } });
  assert.equal(dup.status, 409);
});

test('invoices: a draft can be deleted, an issued invoice with payments cannot', async () => {
  const draft = ok(await invoice({ items: [line(100)], status: 'Draft' }));
  ok(await api(`/invoices/${draft.id}`, { method: 'DELETE', token: f.adminToken }));
  const issued = ok(await invoice({ items: [line(100)] }));
  ok(await api('/payments', { method: 'POST', token: f.adminToken, body: { invoiceId: issued.id, amountReceived: 50, paymentDate: today } }));
  const del = await api(`/invoices/${issued.id}`, { method: 'DELETE', token: f.adminToken });
  assert.equal(del.status, 409);
  const cancel = await api(`/invoices/${issued.id}`, { method: 'PUT', token: f.adminToken, body: { status: 'Cancelled' } });
  assert.equal(cancel.status, 409, 'cancelled an invoice that has money received');
});

test('credit notes cannot exceed what is left to credit, and reduce the balance', async () => {
  const inv = ok(await invoice({ items: [line(10000)] }));
  const tooBig = await api('/credit-notes', { method: 'POST', token: f.adminToken, body: { invoiceId: inv.id, amount: 20000, reason: 'Too much', creditNoteDate: today, items: [line(20000)] } });
  assert.ok(tooBig.status >= 400 && tooBig.status < 500, `credit note above the invoice accepted (${tooBig.status})`);
  const okNote = await api('/credit-notes', { method: 'POST', token: f.adminToken, body: { invoiceId: inv.id, reason: 'Scope cut', creditNoteDate: today, items: [line(2000)] } });
  if (okNote.status >= 400) {
    assert.fail(`a valid credit note was refused: ${okNote.status} ${okNote.body?.message}`);
  }
  const fresh = ok(await api(`/invoices/${inv.id}`, { token: f.adminToken }));
  assert.equal(money(fresh.balanceDue), money(11800 - 2360));
});

test('reports agree with the books and validate their period', async () => {
  for (const path of ['/reports/dashboard', '/reports/profit-loss', '/reports/gst', '/reports/pending-payables', '/reports/ca-audit', '/reports/payroll', '/reports/renewals', '/finance/summary', '/finance/ledger', '/finance/reconciliation']) {
    for (const q of ['', '?period=thisFy', '?period=lastMonth', '?fy=2025-26', `?from=${today}&to=${today}`]) {
      const res = await api(`${path}${q}`, { token: f.tokens.accountant });
      assert.equal(res.status, 200, `${path}${q} -> ${res.status} ${res.body?.message}`);
    }
  }
  for (const q of ['?fy=2025-27', '?from=2026-02-30', '?from=2026-05-01&to=2026-04-01']) {
    const res = await api(`/reports/profit-loss${q}`, { token: f.tokens.accountant });
    assert.equal(res.status, 400, `profit-loss${q} -> ${res.status}`);
  }
  // Output GST on the dashboard = issued invoice GST - issued credit note GST, same as the GST report.
  const dash = ok(await api('/reports/dashboard', { token: f.adminToken }));
  const gst = ok(await api('/reports/gst', { token: f.adminToken }));
  const gstOut = gst.outputGst ?? gst.totals?.outputGst ?? gst.summary?.outputGst;
  if (gstOut !== undefined) assert.equal(money(dash.outputGst), money(gstOut));
});

test('sales can raise invoices but not take payments or see banking', async () => {
  assert.ok([200, 201].includes((await invoice({ items: [line(100)] }, f.tokens.sales)).status));
  assert.equal((await api('/payments', { method: 'POST', token: f.tokens.sales, body: { amountReceived: 1 } })).status, 403);
  assert.equal((await api('/banking/accounts', { token: f.tokens.sales })).status, 403);
  assert.equal((await api('/reports/profit-loss', { token: f.tokens.sales })).status, 403);
});
