// notifications.idempotency_key is protected by a PARTIAL unique index
// (database/follow-up-engine.sql: ... WHERE idempotency_key IS NOT NULL). Postgres only accepts
// ON CONFLICT (idempotency_key) for such an index when the statement repeats that condition;
// without it every follow-up automation run fails with "there is no unique or exclusion constraint
// matching the ON CONFLICT specification". This checks the SQL text, so it needs no database.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'services', 'followUpEngine.service.js'), 'utf8');
const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'follow-up-engine.sql'), 'utf8');

test('the notifications idempotency index is the partial one this test assumes', () => {
  assert.match(schema, /CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_idempotency_key\s+ON notifications\(idempotency_key\)\s+WHERE idempotency_key IS NOT NULL/i);
});

test('every insert into notifications with ON CONFLICT (idempotency_key) repeats the index condition', () => {
  const statements = source.match(/insert into notifications[\s\S]*?do nothing/gi) || [];
  const upserts = statements.filter((sql) => /on conflict \(idempotency_key\)/i.test(sql));
  assert.ok(upserts.length >= 2, 'expected the two follow-up notification upserts');
  for (const sql of upserts) {
    assert.match(sql, /on conflict \(idempotency_key\)\s+where idempotency_key is not null\s+do nothing/i);
  }
});
