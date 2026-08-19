const assert = require('node:assert/strict');
const { pool, query, closePool } = require('../config/db');
const leadModel = require('../models/lead.model');

async function run() {
  const counts = await query(`
    select count(*)::int as total,
           count(lead_number)::int as numbered,
           count(*) filter (where converted_client_id is not null)::int as converted
    from leads
  `);
  const mapping = await query(`select to_regclass('public.lead_conversion_mappings') as mapping_table`);
  assert.equal(counts.rows[0].total, counts.rows[0].numbered, 'Every existing lead must have a generated lead number');
  assert.equal(mapping.rows[0].mapping_table, 'lead_conversion_mappings');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lead = await leadModel.create({
      name: 'Rollback Test Lead',
      companyName: 'Rollback Test Lead',
      contactPerson: 'Test Contact',
      phone: '+919999990001',
      requiredServices: ['CRM Development'],
      source: 'Website',
      status: 'New',
      estimatedBudget: 25000,
      leadTemperature: 'Warm',
      priority: 'Medium'
    }, client);
    const updated = await leadModel.update(lead.id, {
      requirementSummary: 'Transaction-only verification',
      followUpDate: '2026-08-15'
    }, client);
    assert.ok(updated.leadNumber);
    assert.deepEqual(updated.requiredServices, ['CRM Development']);
    assert.equal(updated.requirementSummary, 'Transaction-only verification');
    assert.equal(updated.followUpDate, '2026-08-15');
    await client.query('ROLLBACK');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  console.log(JSON.stringify({
    existingLeads: counts.rows[0].total,
    generatedLeadNumbers: counts.rows[0].numbered,
    convertedLeads: counts.rows[0].converted,
    transactionRolledBack: true
  }));
}

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(closePool);
