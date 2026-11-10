const test = require('node:test');
const assert = require('node:assert/strict');
const queries = require('../services/hrm/queries');

function fakeTx(existing = null) {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      if (/FROM master_items WHERE id=\$1 AND type=\$2/.test(sql)) return { rows: existing ? [existing] : [] };
      if (/^UPDATE master_items/.test(sql.trim()) || /^INSERT INTO master_items/.test(sql.trim())) return { rows: [{ id: 'm1' }] };
      if (/INSERT INTO hrm_audit/.test(sql)) return { rows: [{ id: 'a1' }] };
      return { rows: [], rowCount: 0 };
    }
  };
}
const admin = { id: 'u1', permissions: ['hrm.manage_settings'] };
const save = (type, body, id, tx) => queries.masters(admin, type, body, id, tx);
const savedPayload = (tx) => {
  const write = tx.calls.find((c) => /^(UPDATE|INSERT INTO) master_items/.test(c.sql));
  return write.params.map((p) => (typeof p === 'string' && p.startsWith('{') ? JSON.parse(p) : null)).find(Boolean);
};

test('a salary structure keeps its components', async () => {
  const tx = fakeTx();
  const components = [
    { name: 'Basic', type: 'earning', amount: 30000 },
    { name: 'PF', type: 'deduction', amount: 1800 }
  ];
  await save('salary_structure', { name: 'Engineer', payload: { components } }, null, tx);
  assert.deepEqual(savedPayload(tx).components, components);
});

test('invalid salary components are rejected', async () => {
  const bad = [
    [{ name: 'Basic', type: 'bonus', amount: 1 }],
    [{ name: 'Basic', type: 'earning', amount: -5 }],
    [{ name: '', type: 'earning', amount: 5 }],
    [{ name: 'Basic', type: 'earning', amount: 5, extra: true }]
  ];
  for (const components of bad)
    await assert.rejects(save('salary_structure', { name: 'X', payload: { components } }, null, fakeTx()), (e) => e.statusCode === 400);
  await assert.rejects(
    save('salary_structure', { name: 'X', payload: { components: 'nope' } }, null, fakeTx()),
    (e) => e.statusCode === 400
  );
});

test('editing a built-in master keeps its protected system flag', async () => {
  const existing = { id: 'm1', type: 'hrm_document_type', name: 'Profile Photo', is_active: true, payload: { system: true, hasExpiry: false } };
  const tx = fakeTx(existing);
  await save('document_type', { name: 'Profile Photo', payload: { hasExpiry: true } }, 'm1', tx);
  const payload = savedPayload(tx);
  assert.equal(payload.system, true);
  assert.equal(payload.hasExpiry, true);
});

test('a client cannot add the system flag to an ordinary master', async () => {
  await assert.rejects(
    save('document_type', { name: 'PAN', payload: { system: true } }, null, fakeTx()),
    (e) => e.statusCode === 400
  );
});

test('an edit that does not mention isActive keeps the record deactivated', async () => {
  const existing = { id: 'm1', type: 'hrm_team', name: 'Platform', is_active: false, payload: {} };
  const tx = fakeTx(existing);
  await save('team', { name: 'Platform team', payload: {} }, 'm1', tx);
  const write = tx.calls.find((c) => /^UPDATE master_items/.test(c.sql));
  assert.ok(write.params.includes(false), 'is_active stays false');
});

test('a document type can require front and back uploads (Aadhaar)', async () => {
  const tx = fakeTx();
  await save('document_type', { name: 'Voter ID', payload: { frontBack: true, hasExpiry: false } }, null, tx);
  assert.equal(savedPayload(tx).frontBack, true);
  await assert.rejects(save('document_type', { name: 'Voter ID', payload: { frontBack: 'yes' } }, null, fakeTx()), /frontBack/);
});
