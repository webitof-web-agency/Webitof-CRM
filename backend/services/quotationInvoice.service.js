const invoiceModel = require('../models/invoice.model');
const leadEventModel = require('../models/leadEvent.model');
const leadModel = require('../models/lead.model');
const { getSettings } = require('../models/settings.model');
const { calculateInvoiceTotals, getDefaultInvoiceTypeForClient, getPlaceOfSupplyForClient } = require('../utils/finance');
const { generateInvoiceNumber } = require('../utils/invoice');
const { round2, toNumber } = require('../utils/format');

function getStructuredField(text, label) {
  const needle = String(label || '').trim().toLowerCase();
  const line = String(text || '')
    .split(/\r?\n/)
    .find((item) => item.trim().toLowerCase().startsWith(`${needle}:`));
  return line ? line.slice(line.indexOf(':') + 1).trim() : '';
}

function readQuotationField(event = {}, key, fallback = undefined) {
  if (event[key] !== undefined && event[key] !== null && event[key] !== '') return event[key];
  if (event.payload?.[key] !== undefined && event.payload?.[key] !== null && event.payload?.[key] !== '') {
    return event.payload[key];
  }
  return fallback;
}

function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['true', 'yes', '1', 'on', 'gst'].includes(normalized)) return true;
  if (['false', 'no', '0', 'off', 'none', 'no tax'].includes(normalized)) return false;
  return fallback;
}

function parseServiceNames(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function getQuotationSnapshot(event = {}, lead = {}, settings = {}) {
  const description = String(event.description || '');
  const serviceNames = parseServiceNames(
    readQuotationField(event, 'serviceNames', getStructuredField(description, 'Service'))
  );
  const amount = Math.max(0, toNumber(
    readQuotationField(event, 'amount', getStructuredField(description, 'Amount'))
  ));
  const discountType = String(
    readQuotationField(event, 'discountType', getStructuredField(description, 'Discount Type') || 'percent')
  ).trim().toLowerCase() === 'flat' ? 'flat' : 'percent';
  const discountValue = Math.max(0, toNumber(
    readQuotationField(event, 'discountValue', getStructuredField(description, 'Discount Value'))
  ));
  const leadWantsGst = toBoolean(lead.gstInvoiceRequired, false);
  const gstApplicable = toBoolean(
    readQuotationField(event, 'gstApplicable', getStructuredField(description, 'GST Applicable')),
    leadWantsGst
  );
  const gstRate = gstApplicable
    ? Math.max(0, toNumber(
      readQuotationField(event, 'gstRate', getStructuredField(description, 'GST Rate')),
      settings?.gst?.defaultRate ?? 18
    ))
    : 0;
  const status = String(
    readQuotationField(event, 'status', getStructuredField(description, 'Status') || 'Draft')
  ).trim() || 'Draft';

  return {
    title: String(event.title || 'Quotation').trim() || 'Quotation',
    serviceNames,
    amount,
    discountType,
    discountValue,
    gstApplicable,
    gstRate,
    status
  };
}

function validateApprovedQuotation(snapshot) {
  if (!snapshot.serviceNames.length) {
    const error = new Error('Select at least one service before approving the quotation');
    error.statusCode = 400;
    throw error;
  }
  if (!(snapshot.amount > 0)) {
    const error = new Error('Enter a quotation amount greater than zero before approval');
    error.statusCode = 400;
    throw error;
  }
  if (snapshot.discountType === 'percent' && snapshot.discountValue > 100) {
    const error = new Error('Quotation discount percentage cannot exceed 100');
    error.statusCode = 400;
    throw error;
  }
  if (snapshot.discountType === 'flat' && snapshot.discountValue > snapshot.amount) {
    const error = new Error('Flat quotation discount cannot exceed the quotation amount');
    error.statusCode = 400;
    throw error;
  }
}

function normalizeServiceRecord(row = {}) {
  const payload = row.payload || {};
  return {
    id: row.id,
    name: row.name || '',
    sacCode: row.sac_code || row.sacCode || payload.sacCode || payload.sac || '',
    unit: row.unit || payload.unit || 'Nos',
    gstRate: toNumber(row.gst_rate ?? row.gstRate ?? payload.gstRate, 18),
    payload
  };
}

function buildQuotationInvoiceDraft({ quotation, lead, client, services = [], settings = {}, invoiceDate, dueDate }) {
  validateApprovedQuotation(quotation);
  const serviceMap = new Map(services.map((service) => [String(service.name || '').trim().toLowerCase(), service]));
  let allocated = 0;
  const items = quotation.serviceNames.map((serviceName, index) => {
    const cleanName = String(serviceName || '').trim();
    const lookupName = cleanName.toLowerCase().startsWith('other:') ? 'other' : cleanName.toLowerCase();
    const service = serviceMap.get(lookupName) || serviceMap.get(cleanName.toLowerCase()) || null;
    const rate = index === quotation.serviceNames.length - 1
      ? round2(quotation.amount - allocated)
      : round2(quotation.amount / quotation.serviceNames.length);
    allocated = round2(allocated + rate);
    return {
      serviceId: service?.id || '',
      serviceName: cleanName,
      description: cleanName,
      quantity: 1,
      qty: 1,
      unit: service?.unit || 'Nos',
      rate,
      discount: 0,
      hsnCode: service?.sacCode || '',
      gstRate: quotation.gstApplicable ? quotation.gstRate : 0,
      taxRate: quotation.gstApplicable ? quotation.gstRate : 0,
      manualRateOverride: true,
      quotedRateLocked: true,
      serviceSnapshot: service ? {
        id: service.id,
        name: service.name,
        sacCode: service.sacCode,
        unit: service.unit,
        defaultPrice: rate,
        gstRate: quotation.gstApplicable ? quotation.gstRate : 0
      } : null
    };
  });
  const invoiceType = getDefaultInvoiceTypeForClient(client || {}, settings);
  const placeOfSupply = getPlaceOfSupplyForClient(client || {}, settings);
  const base = {
    invoiceDate,
    dueDate,
    clientId: client?.id || null,
    projectId: lead?.convertedProjectId || null,
    placeOfSupply,
    invoiceType,
    amountType: quotation.gstApplicable ? 'GST Extra' : 'No Tax',
    status: 'Draft',
    discountType: quotation.discountType,
    discountValue: quotation.discountValue,
    advanceAmount: 0,
    taxRate: quotation.gstApplicable ? quotation.gstRate : 0,
    notes: `Automatically created from approved quotation: ${quotation.title}`,
    items
  };
  const totals = calculateInvoiceTotals(base, items, settings, client || {});
  return {
    ...base,
    items: totals.items,
    taxableAmount: totals.taxableAmount,
    cgst: totals.cgst,
    sgst: totals.sgst,
    utgst: totals.utgst,
    igst: totals.igst,
    gstAmount: totals.gstAmount,
    totalAmount: totals.totalAmount,
    discountAmount: totals.discountAmount,
    taxType: totals.taxType,
    taxRate: totals.taxRate
  };
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

async function getNextInvoiceNumber(db, settings, invoiceDate) {
  await db.query(`select pg_advisory_xact_lock(hashtext('webitof-invoice-number'))`);
  const result = await db.query('select invoice_number from invoices');
  const sequence = result.rows.reduce((max, row) => {
    const match = String(row.invoice_number || '').match(/(\d+)\s*$/);
    const value = match ? Number(match[1]) : 0;
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0) + 1;
  return generateInvoiceNumber(settings, sequence, invoiceDate);
}

async function ensurePaymentReminder({ db, lead, invoice, quotation, req }) {
  const existingResult = await db.query(
    `select id from lead_events
     where event_type = 'reminder' and payload->>'sourceInvoiceId' = $1
     limit 1`,
    [invoice.id]
  );
  const payload = {
    kind: 'invoice_payment_reminder',
    status: 'scheduled',
    sourceInvoiceId: invoice.id,
    sourceQuotationId: invoice.sourceQuotationId,
    invoiceNumber: invoice.invoiceNumber,
    amount: invoice.totalAmount
  };
  const reminderData = {
    leadId: lead.id,
    scopeType: 'lead',
    scopeId: lead.id,
    ownerUserId: lead.assignedTo || req?.user?.id || null,
    visibility: 'all_team',
    eventType: 'reminder',
    title: `Collect payment for ${invoice.invoiceNumber}`,
    description: `Payment collection for approved quotation ${quotation.title}. Amount: ${invoice.totalAmount}`,
    startDate: invoice.dueDate,
    startTime: '10:00',
    endDate: invoice.dueDate,
    endTime: '10:00',
    labels: ['Payment', 'Invoice'],
    color: '#f59e0b',
    payload
  };

  if (existingResult.rows[0]?.id) {
    return leadEventModel.update(existingResult.rows[0].id, reminderData, db);
  }
  return leadEventModel.create(reminderData, db);
}

async function ensureInvoiceForApprovedQuotation({ event, req, db }) {
  if (String(event?.eventType || '').trim().toLowerCase() !== 'quotation') {
    return { quotation: event, invoice: null, reminder: null, created: false };
  }

  const leadId = event.leadId || event.scopeId;
  const lead = await leadModel.findById(leadId, db);
  if (!lead) {
    const error = new Error('Lead not found for quotation approval');
    error.statusCode = 404;
    throw error;
  }
  const settings = (await getSettings()) || {};
  const quotation = getQuotationSnapshot(event, lead, settings);
  if (quotation.status.toLowerCase() !== 'approved') {
    return { quotation: event, invoice: null, reminder: null, created: false };
  }
  validateApprovedQuotation(quotation);

  const existingResult = await db.query(
    'select id from invoices where source_quotation_id = $1 limit 1',
    [event.id]
  );
  let existingInvoice = existingResult.rows[0]?.id
    ? await invoiceModel.findById(existingResult.rows[0].id, db)
    : null;

  const { convertLeadRecord } = require('../controllers/leads.controller');
  const converted = await convertLeadRecord(lead.id, settings, db, req, {
    useExistingClient: true,
    createProject: false
  });
  const convertedLead = converted?.lead || lead;
  const client = converted?.client || null;
  if (!client) {
    const error = new Error('A client is required before an invoice can be created');
    error.statusCode = 409;
    throw error;
  }

  const servicesResult = await db.query(`select * from master_items where type = 'service' and is_active = true`);
  const services = servicesResult.rows.map(normalizeServiceRecord);
  const invoiceDate = existingInvoice?.invoiceDate || new Date().toISOString().slice(0, 10);
  const dueDate = existingInvoice?.dueDate || addDays(invoiceDate, settings?.invoice?.defaultDueDays ?? 15);
  const invoiceDraft = buildQuotationInvoiceDraft({
    quotation,
    lead: convertedLead,
    client,
    services,
    settings,
    invoiceDate,
    dueDate
  });

  let invoice = existingInvoice;
  let created = false;
  if (!invoice) {
    invoice = await invoiceModel.create({
      ...invoiceDraft,
      invoiceNumber: await getNextInvoiceNumber(db, settings, invoiceDate),
      sourceQuotationId: event.id
    }, db);
    created = true;
  } else if (String(invoice.status || '').toLowerCase() === 'draft') {
    invoice = await invoiceModel.update(invoice.id, {
      ...invoiceDraft,
      invoiceNumber: invoice.invoiceNumber,
      sourceQuotationId: event.id
    }, db);
  }

  const reminder = await ensurePaymentReminder({ db, lead: convertedLead, invoice, quotation, req });
  const quotationRecord = await leadEventModel.update(event.id, {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceCreatedAt: readQuotationField(event, 'invoiceCreatedAt', new Date().toISOString())
  }, db);

  return { quotation: quotationRecord, invoice, reminder, created };
}

module.exports = {
  buildQuotationInvoiceDraft,
  ensureInvoiceForApprovedQuotation,
  getQuotationSnapshot,
  validateApprovedQuotation
};
