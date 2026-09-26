const { createCrudController } = require('./crudController');
const invoiceModel = require('../models/invoice.model');
const clientModel = require('../models/client.model');
const bankAccountModel = require('../models/bankAccount.model');
const paymentModel = require('../models/payment.model');
const masterItemModel = require('../models/masterItem.model');
const { getSettings } = require('../models/settings.model');
const { calculateInvoiceTotals, getDefaultInvoiceTypeForClient, getPlaceOfSupplyForClient } = require('../utils/finance');
const { generateInvoiceNumber, getFinancialYear, normalizeInvoiceNumber } = require('../utils/invoice');
const { getInvoiceSnapshot, syncInvoiceFinancialState } = require('../services/finance.service');
const { notifyBusinessEvent } = require('../services/notification.service');
const { hasPermission } = require('../middlewares/auth');
const { withTransaction } = require('../config/db');
const followUpEngine = require('../services/followUpEngine.service');

function buildPaymentMap(payments = []) {
  const map = new Map();
  payments.forEach((payment) => {
    const key = String(payment.invoiceId || '');
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(payment);
  });
  return map;
}

function resolveInvoiceTemplate(settings = {}, invoice = {}) {
  const templates = Array.isArray(settings?.invoiceTemplates) ? settings.invoiceTemplates : [];
  return templates.find((template) => String(template.id) === String(invoice?.templateId)) || templates.find((template) => template.isDefault) || templates[0] || null;
}

async function getNextInvoiceSequence(currentId = null) {
  const records = await invoiceModel.list({ orderBy: 'invoice_date ASC, created_at ASC' });
  const maxSequence = records.reduce((max, record) => {
    if (currentId && String(record.id) === String(currentId)) return max;
    const match = String(record.invoiceNumber || '').match(/(\d+)\s*$/);
    const sequence = match ? Number(match[1]) : 0;
    return Number.isFinite(sequence) && sequence > max ? sequence : max;
  }, 0);
  return maxSequence + 1;
}

async function enrichInvoices(rows = []) {
  const [settings, clients, payments] = await Promise.all([
    getSettings(),
    clientModel.list(),
    paymentModel.list()
  ]);
  const clientMap = new Map(clients.map((client) => [String(client.id), client]));
  const paymentMap = buildPaymentMap(payments);
  return rows.map((row) => getInvoiceSnapshot(row, paymentMap.get(String(row.id)) || [], settings || {}, clientMap.get(String(row.clientId)) || {}));
}

function normalizeServiceCatalogRecord(record = {}, categoryMap = new Map()) {
  const payload = record.payload || {};
  const categoryId = record.categoryId || payload.categoryId || payload.category_id || '';
  const categoryName = record.categoryName || payload.categoryName || payload.category || categoryMap.get(String(categoryId)) || '';
  const sacCode = record.sacCode || record.sac || payload.sacCode || payload.sac || '';
  const defaultPrice = Number(record.defaultPrice ?? payload.defaultPrice ?? 0);
  const gstRate = Number(record.gstRate ?? payload.gstRate ?? 18);
  return {
    id: record.id,
    name: record.name,
    categoryId,
    categoryName,
    sacCode,
    unit: record.unit || payload.unit || 'Nos',
    defaultPrice,
    gstRate,
    isRecurring: Boolean(record.isRecurring ?? payload.isRecurring),
    isActive: record.isActive !== false,
    sortOrder: Number(record.sortOrder || 0),
    description: record.description || payload.description || '',
    priceHistory: Array.isArray(record.priceHistory) ? record.priceHistory : (Array.isArray(payload.priceHistory) ? payload.priceHistory : []),
    lastPriceChangeAt: record.lastPriceChangeAt || payload.lastPriceChangeAt || '',
    lastPriceChangeBy: record.lastPriceChangeBy || payload.lastPriceChangeBy || null,
    payload: {
      ...payload,
      defaultPrice,
      gstRate,
      categoryId,
      categoryName,
      sacCode,
      unit: record.unit || payload.unit || 'Nos',
      isRecurring: Boolean(record.isRecurring ?? payload.isRecurring),
      description: record.description || payload.description || '',
      priceHistory: Array.isArray(record.priceHistory) ? record.priceHistory : (Array.isArray(payload.priceHistory) ? payload.priceHistory : []),
      lastPriceChangeAt: record.lastPriceChangeAt || payload.lastPriceChangeAt || '',
      lastPriceChangeBy: record.lastPriceChangeBy || payload.lastPriceChangeBy || null
    }
  };
}

function canOverrideServiceRates(user = null) {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  if (hasPermission(user, 'masters.write') || hasPermission(user, 'settings.write')) return true;
  return Array.isArray(user.roles) && user.roles.some((role) => {
    const code = String(role?.code || '').trim().toLowerCase();
    return code === 'admin' || code === 'accountant';
  });
}

async function loadServiceCatalog() {
  const [services, serviceCategories] = await Promise.all([
    masterItemModel.listByType('service'),
    masterItemModel.listByType('service_category')
  ]);
  const categoryMap = new Map(serviceCategories.map((category) => [String(category.id), category.name]));
  const serviceMap = new Map(
    services.map((service) => {
      const normalized = normalizeServiceCatalogRecord(service, categoryMap);
      return [String(normalized.id), normalized];
    })
  );
  return serviceMap;
}

function normalizeInvoiceItems(items = [], serviceMap = new Map(), user = null) {
  const allowOverride = canOverrideServiceRates(user);
  return items.map((item = {}) => {
    const current = { ...item };
    const serviceId = String(current.serviceId || '').trim();
    if (!serviceId) {
      return current;
    }

    const service = serviceMap.get(serviceId);
    if (!service) {
      return current;
    }

    const hasRateValue = current.rate !== undefined && current.rate !== null && String(current.rate).trim() !== '';
    const currentRate = Number(current.rate ?? 0);
    const defaultRate = Number(service.defaultPrice ?? 0);
    const currentGstRate = Number(current.gstRate ?? current.taxRate ?? service.gstRate ?? 18);
    const serviceGstRate = Number(service.gstRate ?? currentGstRate ?? 18);
    const nextRate = current.quotedRateLocked
      ? currentRate
      : allowOverride
      ? ((current.manualRateOverride || (hasRateValue && currentRate !== defaultRate)) ? currentRate : defaultRate)
      : defaultRate;
    const nextGstRate = Number.isFinite(serviceGstRate) ? serviceGstRate : currentGstRate;

    return {
      ...current,
      serviceId: service.id,
      serviceName: service.name || current.serviceName || '',
      serviceCategoryId: service.categoryId || current.serviceCategoryId || '',
      serviceCategoryName: service.categoryName || current.serviceCategoryName || '',
      description: current.description || service.name || '',
      hsnCode: current.hsnCode || service.sacCode || '',
      unit: current.unit || service.unit || 'Nos',
      rate: nextRate,
      gstRate: nextGstRate,
      taxRate: nextGstRate,
      manualRateOverride: current.quotedRateLocked || (allowOverride ? Boolean(current.manualRateOverride && hasRateValue) : false),
      serviceSnapshot: {
        id: service.id,
        name: service.name || '',
        categoryId: service.categoryId || '',
        categoryName: service.categoryName || '',
        sacCode: service.sacCode || '',
        unit: service.unit || 'Nos',
        defaultPrice: defaultRate,
        gstRate: Number(service.gstRate ?? 18)
      }
    };
  });
}

async function normalizeInvoice(body = {}, current = null, user = null) {
  const settings = (await getSettings()) || {};
  const clientId = body.clientId || current?.clientId || null;
  const client = clientId ? await clientModel.findById(clientId) : null;
  const base = current ? { ...current, ...body } : { ...body };
  const items = Array.isArray(body.items) ? body.items : Array.isArray(current?.items) ? current.items : [];
  const serviceMap = await loadServiceCatalog();
  const normalizedItems = normalizeInvoiceItems(items, serviceMap, user);
  const totals = calculateInvoiceTotals(base, normalizedItems, settings, client || {});
  const invoiceDate = base.invoiceDate || current?.invoiceDate || new Date().toISOString().slice(0, 10);
  const sequence = await getNextInvoiceSequence(current?.id || null);
  const generatedInvoiceNumber = generateInvoiceNumber(settings, sequence, invoiceDate);
  const invoiceNumber = normalizeInvoiceNumber(base.invoiceNumber || current?.invoiceNumber || '') || generatedInvoiceNumber;

  return {
    ...base,
    invoiceDate,
    invoiceNumber,
    clientId,
    projectId: base.projectId || current?.projectId || null,
    placeOfSupply: base.placeOfSupply || getPlaceOfSupplyForClient(client || {}, settings),
    invoiceType: settings?.gst?.autoDetectTax !== false && (base.invoiceType || 'Regular') === 'Regular'
      ? getDefaultInvoiceTypeForClient(client || {}, settings)
      : (base.invoiceType || current?.invoiceType || 'Regular'),
    amountType: base.amountType || current?.amountType || 'GST Extra',
    status: base.status || current?.status || 'Sent',
    recurringInterval: base.recurringInterval || current?.recurringInterval || 'None',
    isRecurring: Boolean(base.isRecurring ?? current?.isRecurring),
    financialYear: getFinancialYear(invoiceDate),
    items: normalizedItems.map((item, index) => ({
      ...item,
      ...totals.items[index],
      rate: totals.items[index]?.rate ?? item.rate,
      manualRateOverride: item.manualRateOverride
    })),
    taxableAmount: totals.taxableAmount,
    cgst: totals.cgst,
    sgst: totals.sgst,
    utgst: totals.utgst,
    igst: totals.igst,
    gstAmount: totals.gstAmount,
    totalAmount: totals.totalAmount,
    discountAmount: totals.discountAmount,
    advanceAmount: totals.advanceAmount,
    taxType: totals.taxType,
    taxRate: totals.taxRate
  };
}

const invoicesController = createCrudController(invoiceModel, {
  defaultOrder: 'invoice_date DESC'
});

invoicesController.list = async (req, res, next) => {
  try {
    const { search, limit, offset, orderBy, ...filters } = req.query || {};
    let rows = await invoiceModel.list({
      where: filters,
      search,
      orderBy: orderBy || 'invoice_date DESC'
    });
    rows = await enrichInvoices(rows);

    if (limit || offset) {
      const start = Number(offset || 0);
      const end = limit ? start + Number(limit) : undefined;
      rows = rows.slice(start, end);
    }

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

invoicesController.getById = async (req, res, next) => {
  try {
    const record = await invoiceModel.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    const [settings, clients, payments] = await Promise.all([
      getSettings(),
      clientModel.list(),
      paymentModel.list()
    ]);
    const client = clients.find((item) => String(item.id) === String(record.clientId)) || null;
    const bankAccount = record.bankAccountId ? await bankAccountModel.findById(record.bankAccountId) : null;
    const snapshot = getInvoiceSnapshot(record, payments.filter((payment) => String(payment.invoiceId) === String(record.id)), settings || {}, client || {});
    res.json({
      success: true,
      data: {
        ...snapshot,
        bankAccount,
        template: resolveInvoiceTemplate(settings || {}, record)
      }
    });
  } catch (error) {
    next(error);
  }
};

invoicesController.create = async (req, res, next) => {
  try {
    const body = await normalizeInvoice(req.body || {}, null, req.user);
    const result = await withTransaction(async (db) => {
      const record = await invoiceModel.create(body, db);
      const snapshot = await syncInvoiceFinancialState(record.id, db);
      const nextRecord = snapshot || record;
      if (!['draft', 'paid', 'cancelled', 'void'].includes(String(nextRecord.status || '').toLowerCase())) {
        await followUpEngine.ensureEntityFollowUp('Invoice', record.id, {
          title: `Payment follow-up for ${nextRecord.invoiceNumber}`,
          followUpType: 'Payment follow-up',
          purpose: 'Invoice payment',
          dueAt: followUpEngine.parseDateTime('', nextRecord.dueDate || nextRecord.invoiceDate, '10:00', 'Asia/Kolkata'),
          priorityContext: { outstandingAmount: nextRecord.outstandingAmount ?? nextRecord.totalAmount },
          assignedTo: req.user?.id,
          templateId: 'futpl-payment',
          source: 'invoice_created'
        }, req.user, { db });
      }
      await followUpEngine.handleBusinessTrigger('invoice_created', 'Invoice', record.id, req.user, {
        db, eventId: record.id, payload: nextRecord
      });
      return { record, snapshot, nextRecord };
    });
    const { record, snapshot, nextRecord } = result;
    notifyBusinessEvent({
      moduleName: 'invoices',
      eventKey: 'created',
      entity: nextRecord,
      clientId: nextRecord?.clientId || null,
      title: 'Invoice created',
      message: `Invoice ${nextRecord?.invoiceNumber || record.invoiceNumber} was created.`,
      actorUserId: req.user?.id || null,
      notifyClient: Boolean(nextRecord?.clientId),
      routePath: `/app/invoices/${record.id}`
    }).catch(() => {});
    res.status(201).json({ success: true, data: snapshot || record });
  } catch (error) {
    next(error);
  }
};

invoicesController.update = async (req, res, next) => {
  try {
    const current = await invoiceModel.findById(req.params.id);
    if (!current) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    const body = await normalizeInvoice(req.body || {}, current, req.user);
    await invoiceModel.update(current.id, body);
    const snapshot = await syncInvoiceFinancialState(current.id);
    const nextRecord = snapshot || (await invoiceModel.findById(current.id));
    notifyBusinessEvent({
      moduleName: 'invoices',
      eventKey: 'updated',
      entity: nextRecord,
      clientId: nextRecord?.clientId || null,
      title: 'Invoice updated',
      message: `Invoice ${nextRecord?.invoiceNumber || current.invoiceNumber} was updated.`,
      actorUserId: req.user?.id || null,
      notifyClient: Boolean(nextRecord?.clientId),
      routePath: `/app/invoices/${current.id}`
    }).catch(() => {});
    res.json({ success: true, data: snapshot || nextRecord });
  } catch (error) {
    next(error);
  }
};

// Public endpoint — no auth required
invoicesController.getPublic = async (req, res, next) => {
  try {
    const invoice = await invoiceModel.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    const [client, settings, bankAccount] = await Promise.all([
      invoice.clientId ? clientModel.findById(invoice.clientId) : Promise.resolve(null),
      getSettings(),
      invoice.bankAccountId ? bankAccountModel.findById(invoice.bankAccountId) : Promise.resolve(null)
    ]);
    const snapshot = getInvoiceSnapshot(invoice, [], settings || {}, client || {});
    res.json({
      success: true,
      data: {
        invoice: snapshot,
        client,
        company: settings?.company || {},
        logos: settings?.logos || {},
        branding: settings?.branding || {},
        invoiceSettings: settings || {},
        bank: settings?.bank || {},
        bankAccount,
        template: resolveInvoiceTemplate(settings || {}, invoice)
      }
    });
  } catch (error) {
    next(error);
  }
};

invoicesController.listServiceCatalog = async (req, res, next) => {
  try {
    const [services, serviceCategories] = await Promise.all([
      masterItemModel.listByType('service', { search: req.query.search }),
      masterItemModel.listByType('service_category', { search: req.query.search })
    ]);
    const categoryMap = new Map(serviceCategories.map((category) => [String(category.id), category.name]));
    const activeOnly = String(req.query.activeOnly || 'true').toLowerCase() !== 'false';
    const rows = services
      .filter((service) => (activeOnly ? service.isActive !== false : true))
      .map((service) => normalizeServiceCatalogRecord(service, categoryMap))
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true, sensitivity: 'base' }));

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

// Send invoice via email
invoicesController.sendEmail = async (req, res, next) => {
  try {
    const invoice = await invoiceModel.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    const client = invoice.clientId ? await clientModel.findById(invoice.clientId) : null;
    const settings = await getSettings();
    const smtp = settings?.smtp || {};

    if (!smtp.host || !smtp.username) {
      return res.status(400).json({ success: false, message: 'SMTP not configured. Please configure it in Settings → Email.' });
    }

    const { to, subject, body: emailBody } = req.body || {};
    const recipient = to || client?.email;
    if (!recipient) {
      return res.status(400).json({ success: false, message: 'No recipient email address provided.' });
    }

    // Try to use nodemailer if available
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: Number(smtp.port) || 465,
        secure: smtp.secure !== false,
        auth: { user: smtp.username, pass: smtp.password }
      });

      await transporter.sendMail({
        from: `"${smtp.fromName || settings?.company?.name || 'CRM'}" <${smtp.fromEmail || smtp.username}>`,
        to: recipient,
        subject: subject || `Invoice ${invoice.invoiceNumber}`,
        html: emailBody || `<p>Please find your invoice <strong>${invoice.invoiceNumber}</strong> attached.</p><p>Total: ₹${Number(invoice.totalAmount || 0).toLocaleString('en-IN')}</p>`
      });

      res.json({ success: true, message: 'Email sent successfully' });
    } catch (mailErr) {
      res.status(500).json({ success: false, message: mailErr.message || 'Failed to send email' });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = invoicesController;
