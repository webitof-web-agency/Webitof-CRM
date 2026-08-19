const assert = require('node:assert/strict');
const { pool, closePool } = require('../config/db');
const leadModel = require('../models/lead.model');
const leadEventModel = require('../models/leadEvent.model');
const { ensureInvoiceForApprovedQuotation } = require('../services/quotationInvoice.service');

async function run() {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const userResult = await db.query('select id, full_name, username, email from users where is_active = true order by created_at asc limit 1');
    const user = userResult.rows[0];
    assert.ok(user?.id, 'An active user is required for the integration test');

    const suffix = Date.now();
    const lead = await leadModel.create({
      name: `Quotation Test ${suffix}`,
      companyName: `Quotation Test ${suffix}`,
      contactPerson: 'Test Contact',
      type: 'Organization',
      email: `quotation-${suffix}@example.test`,
      phone: `+9198${String(suffix).slice(-8)}`,
      status: 'Qualified',
      requiredServices: ['Website Development', 'Website AMC'],
      country: 'India',
      state: 'Chhattisgarh',
      currency: 'INR',
      assignedTo: user.id,
      createdBy: user.id
    }, db);

    const quotation = await leadEventModel.create({
      leadId: lead.id,
      scopeType: 'lead',
      scopeId: lead.id,
      ownerUserId: user.id,
      visibility: 'all_team',
      eventType: 'quotation',
      title: 'Integration quotation',
      description: 'Service: Website Development, Website AMC\nAmount: 10000\nStatus: Approved',
      serviceNames: ['Website Development', 'Website AMC'],
      amount: 10000,
      discountType: 'percent',
      discountValue: 10,
      gstApplicable: true,
      gstRate: 18,
      status: 'Approved',
      startDate: '2026-07-31',
      endDate: '2026-08-30',
      labels: ['Quotation', 'Approved']
    }, db);

    const result = await ensureInvoiceForApprovedQuotation({
      event: quotation,
      req: { user: { id: user.id, fullName: user.full_name, username: user.username, email: user.email } },
      db
    });

    assert.equal(result.created, true);
    assert.ok(result.invoice?.id);
    assert.equal(result.invoice.sourceQuotationId, quotation.id);
    assert.equal(result.invoice.items.length, 2);
    assert.equal(Number(result.invoice.discountAmount), 1000);
    assert.equal(Number(result.invoice.gstAmount), 1620);
    assert.equal(Number(result.invoice.totalAmount), 10620);
    assert.equal(result.reminder?.eventType, 'reminder');
    assert.equal(result.reminder?.sourceInvoiceId, result.invoice.id);
    assert.equal(result.quotation?.invoiceId, result.invoice.id);

    const duplicateCheck = await ensureInvoiceForApprovedQuotation({
      event: result.quotation,
      req: { user: { id: user.id, fullName: user.full_name, username: user.username, email: user.email } },
      db
    });
    assert.equal(duplicateCheck.created, false);
    assert.equal(duplicateCheck.invoice.id, result.invoice.id);

    console.log(`Integration verified: ${result.invoice.invoiceNumber}, 2 services, total ${result.invoice.totalAmount}, reminder ${result.reminder.startDate}`);
  } finally {
    await db.query('ROLLBACK');
    db.release();
    await closePool();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
