/*
 * Safe existing-data backfill for the Advanced Follow-up Engine.
 * Default mode is report-only. Pass --apply only after an administrator reviews the report.
 * This script never sends customer messages.
 */
const { query, closePool } = require('../config/db');
const engine = require('../services/followUpEngine.service');

const apply = process.argv.includes('--apply');

async function loadCandidates() {
  const [leads, quotations, invoices, renewals] = await Promise.all([
    query(
      `select id, follow_up_date, next_follow_up_time, assigned_to, priority
       from leads l where status not in ('Won','Lost','Not Interested','Invalid Lead','Duplicate')
       and not exists (select 1 from follow_ups f where f.related_entity_type='Lead' and f.related_entity_id=l.id and f.deleted_at is null and f.status not in ('Completed','Cancelled','Failed','Auto-Closed'))`
    ),
    query(
      `select id, owner_user_id, updated_at from lead_events e where event_type='quotation'
       and lower(coalesce(payload->>'status','')) in ('sent','viewed','under review','revision requested')
       and not exists (select 1 from follow_ups f where f.related_entity_type='Quotation' and f.related_entity_id=e.id and f.deleted_at is null and f.status not in ('Completed','Cancelled','Failed','Auto-Closed'))`
    ),
    query(
      `select i.id, i.due_date, i.total_amount, greatest(i.total_amount-coalesce(sum(p.amount_received+p.tds_deducted),0),0) as outstanding
       from invoices i left join payments p on p.invoice_id=i.id where lower(i.status) not in ('paid','cancelled','void')
       group by i.id having greatest(i.total_amount-coalesce(sum(p.amount_received+p.tds_deducted),0),0)>0
       and not exists (select 1 from follow_ups f where f.related_entity_type='Invoice' and f.related_entity_id=i.id and f.deleted_at is null and f.status not in ('Completed','Cancelled','Failed','Auto-Closed'))`
    ),
    query(
      `select id, coalesce(renewal_date,expiry_date,reminder_date) as due_date from renewals r
       where lower(status) not in ('renewed','cancelled') and coalesce(renewal_date,expiry_date,reminder_date) <= current_date+90
       and not exists (select 1 from follow_ups f where f.related_entity_type='Renewal' and f.related_entity_id=r.id and f.deleted_at is null and f.status not in ('Completed','Cancelled','Failed','Auto-Closed'))`
    )
  ]);
  return { leads: leads.rows, quotations: quotations.rows, invoices: invoices.rows, renewals: renewals.rows };
}

async function applyCandidates(candidates) {
  const summary = { leads: 0, quotations: 0, invoices: 0, renewals: 0, errors: [] };
  for (const lead of candidates.leads) {
    try {
      const dueAt = engine.parseDateTime('', lead.follow_up_date, lead.next_follow_up_time || '09:30', 'Asia/Kolkata') || new Date(Date.now() + 15 * 60000).toISOString();
      const result = await engine.ensureEntityFollowUp('Lead', lead.id, { title: 'Lead follow-up review', followUpType: 'Call', purpose: 'Backfill review', dueAt, assignedTo: lead.assigned_to, priority: lead.priority || 'High', source: 'backfill_review' }, null);
      if (!result.existing) summary.leads += 1;
    } catch (error) { summary.errors.push({ type: 'Lead', id: lead.id, message: error.message }); }
  }
  for (const quotation of candidates.quotations) {
    try {
      const result = await engine.ensureEntityFollowUp('Quotation', quotation.id, { title: 'Quotation response follow-up', followUpType: 'Quotation follow-up', purpose: 'Backfill review', dueAt: new Date(Date.now() + 24 * 3600000).toISOString(), assignedTo: quotation.owner_user_id, priority: 'High', source: 'backfill_review' }, null);
      if (!result.existing) summary.quotations += 1;
    } catch (error) { summary.errors.push({ type: 'Quotation', id: quotation.id, message: error.message }); }
  }
  for (const invoice of candidates.invoices) {
    try {
      const result = await engine.ensureEntityFollowUp('Invoice', invoice.id, { title: 'Outstanding invoice follow-up', followUpType: 'Payment follow-up', purpose: 'Backfill review', dueAt: engine.parseDateTime('', invoice.due_date || new Date().toISOString().slice(0, 10), '10:00', 'Asia/Kolkata'), priorityContext: { outstandingAmount: invoice.outstanding }, source: 'backfill_review' }, null);
      if (!result.existing) summary.invoices += 1;
    } catch (error) { summary.errors.push({ type: 'Invoice', id: invoice.id, message: error.message }); }
  }
  for (const renewal of candidates.renewals) {
    try {
      const result = await engine.ensureEntityFollowUp('Renewal', renewal.id, { title: 'Renewal review', followUpType: 'Renewal follow-up', purpose: 'Backfill review', dueAt: engine.parseDateTime('', renewal.due_date, '10:00', 'Asia/Kolkata'), priority: 'High', source: 'backfill_review' }, null);
      if (!result.existing) summary.renewals += 1;
    } catch (error) { summary.errors.push({ type: 'Renewal', id: renewal.id, message: error.message }); }
  }
  return summary;
}

async function main() {
  const schema = await query(`select to_regclass('public.follow_ups') as table_name`);
  if (!schema.rows[0]?.table_name) {
    throw new Error('Follow-up schema is not installed. Run "npm run migrate:follow-up-schema" first.');
  }
  const candidates = await loadCandidates();
  const report = Object.fromEntries(Object.entries(candidates).map(([key, rows]) => [key, { count: rows.length, ids: rows.slice(0, 50).map((row) => row.id) }]));
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', clientMessagesSent: false, report }, null, 2));
  if (!apply) {
    console.log('Review the report, then rerun with --apply to create internal follow-up records.');
    return;
  }
  console.log(JSON.stringify({ applied: await applyCandidates(candidates) }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => closePool());
