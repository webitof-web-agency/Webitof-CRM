const { ensureDatabase } = require('../config/initDb');
const { query, closePool } = require('../config/db');
const { createId } = require('../utils/format');
const engine = require('../services/followUpEngine.service');

async function main() {
  if (!process.argv.includes('--yes-seed-followups')) throw new Error('Pass --yes-seed-followups to seed development follow-ups.');
  await ensureDatabase();
  const [userResult, leadResult, invoiceResult, renewalResult] = await Promise.all([
    query(`select id from users where is_active=true order by created_at asc limit 3`),
    query(`select id from leads order by created_at asc limit 5`),
    query(`select id from invoices order by created_at asc limit 2`),
    query(`select id from renewals order by created_at asc limit 2`)
  ]);
  const users = userResult.rows.map((row) => row.id);
  const seeds = [];
  leadResult.rows.forEach((row, index) => seeds.push({ entityType: 'Lead', entityId: row.id, title: ['Overdue discovery call', 'Due today proposal discussion', 'Critical lead decision', 'Waiting for client content', 'Completed discovery call'][index] || 'Lead follow-up', type: index === 3 ? 'Document follow-up' : 'Call', purpose: `Demo seed ${index + 1}`, dueAt: new Date(Date.now() + [-48, 3, 8, 18, -2][index] * 3600000).toISOString(), priority: ['High', 'Medium', 'Critical', 'Medium', 'Low'][index], assignedTo: users[index % Math.max(1, users.length)], seedStatus: index === 3 ? 'Waiting for Client' : index === 4 ? 'Completed' : '' }));
  invoiceResult.rows.forEach((row, index) => seeds.push({ entityType: 'Invoice', entityId: row.id, title: 'Payment promise follow-up', type: 'Payment follow-up', purpose: 'Demo seed', dueAt: new Date(Date.now() + (index ? 24 : -24) * 3600000).toISOString(), priority: index ? 'High' : 'Critical', assignedTo: users[index % Math.max(1, users.length)] }));
  renewalResult.rows.forEach((row, index) => seeds.push({ entityType: 'Renewal', entityId: row.id, title: 'Upcoming renewal confirmation', type: 'Renewal follow-up', purpose: 'Demo seed', dueAt: new Date(Date.now() + (48 + index * 24) * 3600000).toISOString(), priority: 'High', assignedTo: users[index % Math.max(1, users.length)] }));
  let created = 0;
  for (const seed of seeds) {
    const actor = { id: seed.assignedTo || users[0] || null, isSuperAdmin: true, permissions: [] };
    const result = await engine.ensureEntityFollowUp(seed.entityType, seed.entityId, { title: seed.title, followUpType: seed.type, purpose: seed.purpose, dueAt: seed.dueAt, priority: seed.priority, assignedTo: seed.assignedTo, source: 'development_seed' }, actor);
    if (!result.existing) {
      created += 1;
      if (seed.seedStatus === 'Waiting for Client') await engine.updateFollowUp(result.record.id, { status: seed.seedStatus, nextAction: 'Receive client content' }, actor);
      if (seed.seedStatus === 'Completed') await engine.completeFollowUp(result.record.id, { actualOutcome: 'Connected', communicationResult: 'Connected', discussionNote: 'Development seed completion', nextActionRequired: false, noNextFollowUpReason: 'Development seed override example' }, actor);
    }
  }
  let paymentPromiseCreated = false;
  if (invoiceResult.rows[0] && users[0]) {
    const marker = 'advanced_follow_up_demo';
    const existingPromise = await query(`select id from payment_promises where payload->>'seedKey'=$1 limit 1`, [marker]);
    if (!existingPromise.rows[0]) {
      await query(
        `insert into payment_promises (id,invoice_id,promised_amount,promise_date,promised_by,note,status,missed,created_by,updated_by,payload)
         values ($1,$2,1000,current_date-1,$3,'Development seed missed promise','Missed',true,$3,$3,$4::jsonb)`,
        [createId('paypromise'), invoiceResult.rows[0].id, users[0], JSON.stringify({ seedKey: marker })]
      );
      paymentPromiseCreated = true;
    }
  }
  console.log(JSON.stringify({ created, considered: seeds.length, paymentPromiseCreated }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => closePool());
