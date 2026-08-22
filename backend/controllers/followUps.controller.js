const { query, withTransaction } = require('../config/db');
const { createId } = require('../utils/format');
const { hasPermission } = require('../middlewares/auth');
const engine = require('../services/followUpEngine.service');

function notFound(res) {
  return res.status(404).json({ success: false, message: 'Follow-up not found' });
}

async function list(req, res, next) {
  try {
    const result = await engine.listFollowUps(req.query || {}, req.user);
    res.json({ success: true, data: result.rows, meta: { total: result.total, limit: result.limit, offset: result.offset } });
  } catch (error) { next(error); }
}

async function getById(req, res, next) {
  try {
    const record = await engine.getFollowUp(req.params.id, req.user);
    if (!record) return notFound(res);
    res.json({ success: true, data: record });
  } catch (error) { next(error); }
}

async function create(req, res, next) {
  try {
    const result = await engine.createFollowUp(req.body || {}, req.user);
    res.status(201).json({ success: true, data: result.record, warnings: result.warnings });
  } catch (error) { next(error); }
}

async function update(req, res, next) {
  try {
    const record = await engine.updateFollowUp(req.params.id, req.body || {}, req.user, req.body?.version);
    if (!record) return notFound(res);
    res.json({ success: true, data: record });
  } catch (error) { next(error); }
}

async function start(req, res, next) {
  try {
    const record = await engine.markInProgress(req.params.id, req.user);
    if (!record) return notFound(res);
    res.json({ success: true, data: record });
  } catch (error) { next(error); }
}

async function complete(req, res, next) {
  try {
    const result = await engine.completeFollowUp(req.params.id, req.body || {}, req.user);
    if (!result) return notFound(res);
    res.json({ success: true, data: result.followUp, nextFollowUp: result.nextFollowUp });
  } catch (error) { next(error); }
}

async function reschedule(req, res, next) {
  try {
    const record = await engine.rescheduleFollowUp(req.params.id, req.body || {}, req.user, 'reschedule');
    if (!record) return notFound(res);
    res.json({ success: true, data: record });
  } catch (error) { next(error); }
}

async function snooze(req, res, next) {
  try {
    const record = await engine.rescheduleFollowUp(req.params.id, req.body || {}, req.user, 'snooze');
    if (!record) return notFound(res);
    res.json({ success: true, data: record });
  } catch (error) { next(error); }
}

async function reassign(req, res, next) {
  try {
    const record = await engine.reassignFollowUp(req.params.id, req.body || {}, req.user);
    if (!record) return notFound(res);
    res.json({ success: true, data: record });
  } catch (error) { next(error); }
}

async function escalate(req, res, next) {
  try {
    const record = await engine.escalateFollowUp(req.params.id, req.body || {}, req.user);
    if (!record) return notFound(res);
    res.json({ success: true, data: record });
  } catch (error) { next(error); }
}

async function acknowledge(req, res, next) {
  try {
    const record = await engine.acknowledgeReminder(req.params.id, req.user);
    if (!record) return notFound(res);
    res.json({ success: true, data: record });
  } catch (error) { next(error); }
}

async function remove(req, res, next) {
  try {
    const record = await engine.softDeleteFollowUp(req.params.id, req.user);
    if (!record) return notFound(res);
    res.json({ success: true, message: 'Follow-up archived safely' });
  } catch (error) { next(error); }
}

async function restore(req, res, next) {
  try {
    const record = await engine.restoreFollowUp(req.params.id, req.user);
    if (!record) return notFound(res);
    res.json({ success: true, data: record });
  } catch (error) { next(error); }
}

async function today(req, res, next) {
  try {
    res.json({ success: true, data: await engine.getCommandCenter(req.user, req.query?.date) });
  } catch (error) { next(error); }
}

async function attentionRequired(req, res, next) {
  try {
    res.json({ success: true, data: await engine.getAttentionRequired(req.user) });
  } catch (error) { next(error); }
}

async function analytics(req, res, next) {
  try {
    res.json({ success: true, data: await engine.getAnalytics(req.query || {}, req.user) });
  } catch (error) { next(error); }
}

async function options(req, res, next) {
  try {
    const [templates, sequences, escalationRules, settings, typeResult] = await Promise.all([
      engine.listConfig('templates'), engine.listConfig('sequences'), engine.listConfig('escalationRules'), engine.getSettings(),
      query(`select name from master_items where type='follow_up_type' and is_active=true order by sort_order,name`)
    ]);
    res.json({
      success: true,
      data: {
        statuses: [...engine.ACTIVE_FOLLOW_UP_STATUSES, ...engine.CLOSED_FOLLOW_UP_STATUSES],
        priorities: engine.PRIORITIES,
        followUpTypes: typeResult.rows.length ? typeResult.rows.map((row) => row.name) : engine.FOLLOW_UP_TYPES,
        outcomes: engine.OUTCOMES,
        entityTypes: ['Lead', 'Contact', 'Client', 'Opportunity', 'Deal', 'Quotation', 'Proposal', 'Invoice', 'Payment', 'Project', 'Task', 'Support ticket', 'AMC', 'Renewal', 'Custom'],
        templates, sequences, escalationRules, settings
      }
    });
  } catch (error) { next(error); }
}

const SEARCH_TARGETS = {
  Lead: {
    table: 'leads',
    permission: 'leads.read',
    label: `coalesce(nullif(contact_person, ''), nullif(name, ''), nullif(company_name, ''), lead_number, id)`,
    subtitle: `coalesce(nullif(phone, ''), nullif(alternate_phone, ''), nullif(whatsapp_number, ''), nullif(email, ''), nullif(company_name, ''), '')`,
    search: `concat_ws(' ', lead_number, name, company_name, contact_person, email, phone, alternate_phone, whatsapp_number)`
  },
  Contact: {
    table: 'lead_contacts',
    permission: 'leads.read',
    label: `coalesce(nullif(trim(concat_ws(' ', first_name, last_name)), ''), nullif(email, ''), id)`,
    subtitle: `coalesce(nullif(phone, ''), nullif(email, ''), nullif(job_title, ''), '')`,
    search: `concat_ws(' ', first_name, last_name, email, phone, job_title)`
  },
  Client: {
    table: 'clients',
    permission: 'clients.read',
    label: `coalesce(nullif(company_name, ''), nullif(name, ''), id)`,
    subtitle: `coalesce(nullif(mobile, ''), nullif(email, ''), '')`,
    search: `concat_ws(' ', name, company_name, email, mobile, gstin)`
  },
  Opportunity: {
    table: 'leads',
    permission: 'leads.read',
    label: `coalesce(nullif(contact_person, ''), nullif(name, ''), nullif(company_name, ''), lead_number, id)`,
    subtitle: `coalesce(nullif(phone, ''), nullif(whatsapp_number, ''), nullif(status, ''), '')`,
    search: `concat_ws(' ', lead_number, name, company_name, contact_person, email, phone, alternate_phone, whatsapp_number)`
  },
  Deal: {
    table: 'leads',
    permission: 'leads.read',
    label: `coalesce(nullif(contact_person, ''), nullif(name, ''), nullif(company_name, ''), lead_number, id)`,
    subtitle: `coalesce(nullif(phone, ''), nullif(whatsapp_number, ''), nullif(status, ''), '')`,
    search: `concat_ws(' ', lead_number, name, company_name, contact_person, email, phone, alternate_phone, whatsapp_number)`
  },
  Quotation: {
    table: 'lead_events',
    permission: 'leads.read',
    label: `coalesce(nullif(title, ''), nullif(payload->>'quotationNumber', ''), id)`,
    subtitle: `coalesce(nullif(payload->>'quotationNumber', ''), description, '')`,
    search: `concat_ws(' ', title, description, payload->>'quotationNumber')`,
    extra: `event_type='quotation'`
  },
  Proposal: {
    table: 'lead_events',
    permission: 'leads.read',
    label: `coalesce(nullif(title, ''), nullif(payload->>'proposalNumber', ''), id)`,
    subtitle: `coalesce(nullif(payload->>'proposalNumber', ''), description, '')`,
    search: `concat_ws(' ', title, description, payload->>'proposalNumber')`,
    extra: `(event_type='proposal' or event_type='quotation')`
  },
  Invoice: {
    table: 'invoices',
    permission: 'invoices.read',
    label: `coalesce(nullif(invoice_number, ''), id)`,
    subtitle: `coalesce(status, '')`,
    search: `concat_ws(' ', invoice_number, status)`
  },
  Payment: {
    table: 'payments',
    permission: 'payments.read',
    label: `coalesce(nullif(transaction_id, ''), id)`,
    subtitle: `coalesce(payment_status, '')`,
    search: `concat_ws(' ', transaction_id, payment_mode, payment_status)`
  },
  Project: {
    table: 'projects',
    permission: 'projects.read',
    label: `coalesce(nullif(title, ''), id)`,
    subtitle: `coalesce(project_type, status, '')`,
    search: `concat_ws(' ', title, project_type, status)`
  },
  Task: {
    table: 'lead_events',
    permission: 'leads.read',
    label: `coalesce(nullif(title, ''), id)`,
    subtitle: `coalesce(description, '')`,
    search: `concat_ws(' ', title, description)`
  },
  AMC: {
    table: 'amcs',
    permission: 'amc.read',
    label: `coalesce(nullif(title, ''), id)`,
    subtitle: `coalesce(status, '')`,
    search: `concat_ws(' ', title, status)`
  },
  Renewal: {
    table: 'renewals',
    permission: 'renewals.read',
    label: `coalesce(nullif(domain_name, ''), nullif(hosting_name, ''), nullif(package_name, ''), nullif(software_name, ''), category, id)`,
    subtitle: `coalesce(provider, status, '')`,
    search: `concat_ws(' ', domain_name, hosting_name, package_name, software_name, category, provider, status)`
  }
};

async function searchRelated(req, res, next) {
  try {
    const type = engine.normalizeEntityType(req.query?.type || 'Lead');
    const target = SEARCH_TARGETS[type] || SEARCH_TARGETS.Lead;
    if (!target) return res.json({ success: true, data: [] });
    const allowed = req.user?.isSuperAdmin
      || hasPermission(req.user, target.permission)
      || hasPermission(req.user, `${type.toLowerCase()}s.read`)
      || hasPermission(req.user, `${type.toLowerCase()}s.view`)
      || hasPermission(req.user, `${type.toLowerCase()}s.view_all`)
      || hasPermission(req.user, 'followups.create')
      || hasPermission(req.user, 'followups.view_all')
      || hasPermission(req.user, 'leads.read')
      || hasPermission(req.user, 'leads.view');
    if (!allowed) {
      return res.status(403).json({ success: false, message: `Missing permission: ${target.permission}` });
    }
    const searchRaw = String(req.query?.search || '').trim().toLowerCase();
    const search = `%${searchRaw}%`;
    const result = await query(
      `select id, ${target.label} as label, ${target.subtitle || "''"} as subtitle from ${target.table}
       where lower(${target.search}) like $1 ${target.extra ? `and ${target.extra}` : ''}
       order by label asc limit 30`,
      [search]
    );
    res.json({
      success: true,
      data: result.rows.map((row) => ({
        id: row.id,
        label: row.label,
        subtitle: row.subtitle,
        type
      }))
    });
  } catch (error) {
    // Graceful fallback if table is empty or column differs
    console.error('searchRelated error:', error.message);
    res.json({ success: true, data: [] });
  }
}

async function bulk(req, res, next) {
  try {
    const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map(String).filter(Boolean))];
    if (!ids.length) return res.status(400).json({ success: false, message: 'Select at least one follow-up' });
    if (ids.length > 200) return res.status(400).json({ success: false, message: 'Bulk actions are limited to 200 records' });
    const action = String(req.body?.action || '').trim();
    const payload = req.body?.payload || {};
    const results = [];
    const errors = [];
    for (const id of ids) {
      try {
        let record = null;
        if (action === 'assign' || action === 'reassign') record = await engine.reassignFollowUp(id, payload, req.user);
        else if (action === 'priority') record = await engine.updateFollowUp(id, { priority: payload.priority }, req.user);
        else if (action === 'status') record = await engine.updateFollowUp(id, { status: payload.status }, req.user);
        else if (action === 'tag') {
          const current = await engine.getFollowUp(id, req.user, { includeHistory: false });
          record = current ? await engine.updateFollowUp(id, { tags: [...new Set([...(current.tags || []), payload.tag].filter(Boolean))] }, req.user) : null;
        } else if (action === 'reschedule') record = await engine.rescheduleFollowUp(id, payload, req.user);
        else if (action === 'escalate') record = await engine.escalateFollowUp(id, payload, req.user);
        else if (action === 'startSequence') {
          const current = await engine.getFollowUp(id, req.user, { includeHistory: false });
          record = current ? await engine.startSequence({ sequenceId: payload.sequenceId, relatedEntityType: current.relatedEntityType, relatedEntityId: current.relatedEntityId, actor: req.user }) : null;
        } else if (action === 'stopSequence') {
          const current = await engine.getFollowUp(id, req.user, { includeHistory: false });
          record = current ? await engine.stopSequences(current.relatedEntityType, current.relatedEntityId, payload.reason || 'Bulk stop', req.user) : null;
        } else {
          return res.status(400).json({ success: false, message: 'Unsupported bulk action' });
        }
        if (record) results.push({ id, record }); else errors.push({ id, message: 'Not found' });
      } catch (error) {
        errors.push({ id, message: error.message, details: error.details || null });
      }
    }
    res.status(errors.length && !results.length ? 400 : 200).json({ success: results.length > 0, data: results, errors, count: results.length });
  } catch (error) { next(error); }
}

function csvEscape(value) {
  const text = value == null ? '' : Array.isArray(value) ? value.join(', ') : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

async function exportCsv(req, res, next) {
  try {
    const result = await engine.listFollowUps({ ...req.query, limit: 200 }, req.user);
    const columns = ['followUpNumber', 'title', 'relatedEntityType', 'relatedEntityLabel', 'followUpType', 'purpose', 'dueAt', 'effectiveStatus', 'priority', 'assigneeName', 'actualOutcome', 'nextAction'];
    const csv = [columns.join(','), ...result.rows.map((row) => columns.map((key) => csvEscape(row[key])).join(','))].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="follow-ups-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(`\uFEFF${csv}`);
  } catch (error) { next(error); }
}

async function runAutomation(req, res, next) {
  try {
    res.json({ success: true, data: await engine.runAutomationCycle({ runSource: 'manual' }) });
  } catch (error) { next(error); }
}

async function getSettings(req, res, next) {
  try { res.json({ success: true, data: await engine.getSettings() }); } catch (error) { next(error); }
}

async function updateSettings(req, res, next) {
  try { res.json({ success: true, data: await engine.updateSettings(req.body || {}, req.user?.id) }); } catch (error) { next(error); }
}

function configHandlers(kind) {
  return {
    list: async (req, res, next) => {
      try { res.json({ success: true, data: await engine.listConfig(kind) }); } catch (error) { next(error); }
    },
    create: async (req, res, next) => {
      try { res.status(201).json({ success: true, data: await engine.saveConfig(kind, req.body || {}, req.user) }); } catch (error) { next(error); }
    },
    update: async (req, res, next) => {
      try { res.json({ success: true, data: await engine.saveConfig(kind, req.body || {}, req.user, req.params.id) }); } catch (error) { next(error); }
    }
  };
}

async function listPaymentPromises(req, res, next) {
  try {
    const result = await query(`select pp.*, i.invoice_number from payment_promises pp join invoices i on i.id=pp.invoice_id order by pp.promise_date desc limit 200`);
    res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
}

async function createPaymentPromise(req, res, next) {
  try {
    const body = req.body || {};
    if (!body.invoiceId || !body.promiseDate || Number(body.promisedAmount || 0) <= 0) {
      return res.status(400).json({ success: false, message: 'Invoice, promised amount and promise date are required' });
    }
    const record = await withTransaction(async (db) => {
      const invoice = await db.query('select id, client_id, invoice_number from invoices where id=$1 limit 1', [body.invoiceId]);
      if (!invoice.rows[0]) return null;
      const id = createId('promise');
      const result = await db.query(
        `insert into payment_promises (id,invoice_id,client_id,promised_amount,promise_date,promised_by,note,status,created_by,updated_by,payload)
         values ($1,$2,$3,$4,$5,$6,$7,'Pending',$8,$8,$9::jsonb) returning *`,
        [id, body.invoiceId, invoice.rows[0].client_id, Number(body.promisedAmount), body.promiseDate, body.promisedBy || '', body.note || '', req.user?.id || null, JSON.stringify(body.payload || {})]
      );
      await engine.ensureEntityFollowUp('Invoice', body.invoiceId, {
        title: `Payment promise: ${invoice.rows[0].invoice_number}`, followUpType: 'Payment follow-up', purpose: 'Payment promise',
        dueAt: engine.parseDateTime('', body.promiseDate, body.time || '10:00', 'Asia/Kolkata'), priority: 'High',
        description: body.note || '', assignedTo: body.assignedTo || req.user?.id
      }, req.user, { db });
      return result.rows[0];
    });
    if (!record) return res.status(404).json({ success: false, message: 'Invoice not found' });
    res.status(201).json({ success: true, data: record });
  } catch (error) { next(error); }
}

module.exports = {
  acknowledge, analytics, attentionRequired, bulk, complete, create, createPaymentPromise,
  escalationRules: configHandlers('escalationRules'), exportCsv, getById, getSettings, list,
  listPaymentPromises, options, reassign, remove, reschedule, restore, runAutomation, searchRelated,
  sequences: configHandlers('sequences'), snooze, start, templates: configHandlers('templates'),
  automationRules: configHandlers('automationRules'), today, update, updateSettings, escalate
};
