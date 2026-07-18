const amcModel = require('../models/amc.model');
const invoiceModel = require('../models/invoice.model');
const amcAutomationLogModel = require('../models/amcAutomationLog.model');
const clientModel = require('../models/client.model');
const projectModel = require('../models/project.model');
const masterItemModel = require('../models/masterItem.model');
const { getSettings } = require('../models/settings.model');
const {
  calculateInvoiceTotals,
  getDefaultInvoiceTypeForClient,
  getPlaceOfSupplyForClient
} = require('../utils/finance');
const { generateInvoiceNumber, getFinancialYear } = require('../utils/invoice');
const { createId, round2, toNumber } = require('../utils/format');
const { resolveSmtpConfig, sendMail } = require('./mailer.service');
const { syncInvoiceFinancialState } = require('./finance.service');

function normalizeDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  return text ? text.slice(0, 10) : null;
}

function parseBillingCycleMonths(value, master = null) {
  const masterMonths = toNumber(master?.payload?.months ?? master?.payload?.billingMonths, 0);
  if (masterMonths > 0) return masterMonths;

  const text = String(value || '').trim().toLowerCase();
  if (!text) return null;
  if (text.includes('quarter')) return 3;
  if (text.includes('half')) return 6;
  if (text.includes('year')) return 12;
  if (text.includes('month')) return 1;
  return null;
}

function addMonths(dateValue, months = 0) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  date.setMonth(date.getMonth() + Number(months || 0));
  return date.toISOString().slice(0, 10);
}

function addDays(dateValue, days = 0) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function daysUntil(dateValue, fromDate = new Date()) {
  if (!dateValue) return null;
  const target = new Date(dateValue);
  const base = new Date(fromDate);
  if (Number.isNaN(target.getTime()) || Number.isNaN(base.getTime())) return null;
  target.setHours(0, 0, 0, 0);
  base.setHours(0, 0, 0, 0);
  return Math.ceil((target - base) / (1000 * 60 * 60 * 24));
}

function extractSequence(invoiceNumber = '') {
  const match = String(invoiceNumber || '').match(/(\d+)\s*$/);
  return match ? Number(match[1]) : 0;
}

function buildLookupMap(items = []) {
  return new Map(items.map((item) => [String(item.id), item]));
}

function resolveMasterByIdOrName(items = [], value = '') {
  const needle = String(value || '').trim().toLowerCase();
  if (!needle) return null;
  return items.find((item) => {
    const id = String(item?.id || '').trim().toLowerCase();
    const name = String(item?.name || '').trim().toLowerCase();
    return id === needle || name === needle;
  }) || null;
}

async function recordAutomationLog({
  amcId,
  runId,
  runSource = 'manual',
  action,
  status = 'Success',
  dueDate = null,
  invoiceId = null,
  invoiceNumber = '',
  message = '',
  payload = {}
}) {
  if (!amcId || !runId || !action) return null;
  try {
    return await amcAutomationLogModel.create({
      id: createId('amclog'),
      amcId,
      runId,
      runSource,
      action,
      status,
      dueDate,
      invoiceId,
      invoiceNumber,
      message,
      payload
    });
  } catch (error) {
    console.error('[AMC] Failed to write automation log:', error.message);
    return null;
  }
}

function buildAmcInvoiceItem(amc = {}, client = {}, settings = {}, dueDate = null) {
  const amount = round2(amc.amcAmount || 0);
  const gstRate = String(amc.gstType || '').trim().toLowerCase() === 'non-gst'
    ? 0
    : toNumber(settings?.gst?.defaultRate ?? 18, 18);

  return {
    serviceId: '',
    serviceName: amc.title || amc.amcType || 'AMC',
    serviceCategoryId: '',
    serviceCategoryName: 'Maintenance',
    description: `${amc.title || amc.amcType || 'AMC'}${dueDate ? ` for ${dueDate}` : ''}`,
    hsnCode: '',
    quantity: 1,
    unit: amc.billingCycle || 'AMC',
    rate: amount,
    taxRate: gstRate,
    gstRate,
    discount: 0,
    manualRateOverride: true,
    serviceSnapshot: {
      id: `amc-${amc.id}`,
      name: amc.title || amc.amcType || 'AMC',
      categoryId: 'amc',
      categoryName: 'Maintenance',
      sacCode: '',
      unit: amc.billingCycle || 'AMC',
      defaultPrice: amount,
      gstRate
    }
  };
}

function resolveBillingCycleMonths(amc = {}, amcTypeMaster = null, billingCycles = []) {
  const billingCycleMaster = amc.billingCycle
    ? resolveMasterByIdOrName(billingCycles, amc.billingCycle)
    : null;

  return parseBillingCycleMonths(amc.billingCycle || amcTypeMaster?.payload?.defaultBillingCycle, billingCycleMaster);
}

async function loadContext() {
  const [settings, clients, projects, invoices, amcs, amcTypes, billingCycles] = await Promise.all([
    getSettings(),
    clientModel.list(),
    projectModel.list(),
    invoiceModel.list({ orderBy: 'invoice_date ASC, created_at ASC' }),
    amcModel.list({ orderBy: 'updated_at ASC' }),
    masterItemModel.listByType('amc_type'),
    masterItemModel.listByType('billing_cycle')
  ]);

  return {
    settings: settings || {},
    clientMap: buildLookupMap(clients),
    projectMap: buildLookupMap(projects),
    invoices,
    amcs,
    amcTypes,
    billingCycles
  };
}

async function sendAmcReminder({ amc, client, dueDate }) {
  const smtp = await resolveSmtpConfig();
  if (!smtp) {
    return { sent: false, reason: 'SMTP not configured' };
  }

  if (!client?.email) {
    return { sent: false, reason: 'Client email missing' };
  }

  const amountText = Number(amc.amcAmount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const subject = `AMC reminder: ${amc.title || amc.amcType || 'AMC'}${dueDate ? ` due on ${dueDate}` : ''}`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <p>Hello ${client.companyName || client.name || 'Client'},</p>
      <p>This is a reminder for your AMC <strong>${amc.title || amc.amcType || 'AMC'}</strong>${dueDate ? ` due on <strong>${dueDate}</strong>` : ''}.</p>
      <p>Amount: <strong>Rs. ${amountText}</strong></p>
      ${amc.remarks ? `<p>Notes: ${String(amc.remarks)}</p>` : ''}
      <p>Please review and process the renewal or billing as needed.</p>
    </div>
  `;

  await sendMail({
    to: client.email,
    subject,
    html,
    text: `Reminder for AMC ${amc.title || amc.amcType || 'AMC'}${dueDate ? ` due on ${dueDate}` : ''}. Amount: Rs. ${amountText}.`
  });

  return { sent: true, reason: '' };
}

async function createAmcInvoice({ amc, client, project, settings, dueDate, nextSequence }) {
  const invoiceDate = normalizeDate(new Date()) || dueDate || new Date().toISOString().slice(0, 10);
  const defaultInvoiceType = getDefaultInvoiceTypeForClient(client || {}, settings || {});
  const invoiceType = amc.gstType && String(amc.gstType).trim().toLowerCase() === 'non-gst'
    ? 'Regular'
    : defaultInvoiceType;
  const amountType = amc.gstType && String(amc.gstType).trim().toLowerCase() === 'non-gst'
    ? 'No Tax'
    : 'GST Extra';
  const items = [buildAmcInvoiceItem(amc, client, settings, dueDate)];
  const baseInvoice = {
    invoiceNumber: generateInvoiceNumber(settings || {}, nextSequence, invoiceDate),
    invoiceDate,
    dueDate: addDays(invoiceDate, toNumber(settings?.invoice?.defaultDueDays ?? 15, 15)),
    clientId: client.id,
    projectId: project?.id || amc.projectId || null,
    placeOfSupply: getPlaceOfSupplyForClient(client || {}, settings || {}),
    invoiceType,
    amountType,
    status: 'Draft',
    notes: `Auto-generated from AMC ${amc.title || amc.amcType || 'AMC'}${dueDate ? ` for ${dueDate}` : ''}.`,
    isRecurring: true,
    recurringInterval: amc.billingCycle || 'None',
    sourceAmcId: amc.id,
    sourceAmcDueDate: dueDate,
    items
  };

  const totals = calculateInvoiceTotals(baseInvoice, items, settings || {}, client || {});
  const payload = {
    ...baseInvoice,
    financialYear: getFinancialYear(invoiceDate),
    taxableAmount: totals.taxableAmount,
    cgst: totals.cgst,
    sgst: totals.sgst,
    utgst: totals.utgst,
    igst: totals.igst,
    gstAmount: totals.gstAmount,
    totalAmount: totals.totalAmount,
    items: totals.items
  };

  const record = await invoiceModel.create(payload);
  const snapshot = await syncInvoiceFinancialState(record.id);
  return snapshot || record;
}

async function runAmcAutomation({ dryRun = false, runSource = 'manual' } = {}) {
  const { settings, clientMap, projectMap, invoices, amcs, amcTypes, billingCycles } = await loadContext();
  const today = normalizeDate(new Date()) || new Date().toISOString().slice(0, 10);
  const runId = createId('amcrun');
  const existingByAmc = new Map();

  invoices.forEach((invoice) => {
    const key = String(invoice.sourceAmcId || '').trim();
    if (!key) return;
    if (!existingByAmc.has(key)) existingByAmc.set(key, []);
    existingByAmc.get(key).push(invoice);
  });

  const sequenceBase = invoices.reduce((max, invoice) => Math.max(max, extractSequence(invoice.invoiceNumber)), 0) + 1;
  let nextSequence = sequenceBase;
  const results = [];
  let remindersSent = 0;
  let invoicesCreated = 0;
  let skipped = 0;

  for (const amc of amcs) {
    const dueDate = normalizeDate(amc.nextInvoiceDate || amc.endDate || amc.startDate);
    const client = amc.clientId ? clientMap.get(String(amc.clientId)) || null : null;
    const project = amc.projectId ? projectMap.get(String(amc.projectId)) || null : null;
    const status = String(amc.status || 'Active').trim() || 'Active';
    const reminderDays = toNumber(amc.reminderDays ?? 7, 7);
    const daysRemaining = dueDate ? daysUntil(dueDate, today) : null;
    const existingInvoices = existingByAmc.get(String(amc.id)) || [];
    const hasInvoiceForPeriod = existingInvoices.some((invoice) => normalizeDate(invoice.sourceAmcDueDate || invoice.invoiceDate) === dueDate);
    const amcTypeMaster = resolveMasterByIdOrName(amcTypes, amc.amcType);
    const billingMonths = resolveBillingCycleMonths(amc, amcTypeMaster, billingCycles);
    const canRemind = daysRemaining != null && daysRemaining <= reminderDays;
    const canInvoice = status === 'Active' && Boolean(amc.autoInvoice) && daysRemaining != null && daysRemaining <= 0;
    const reminderAlreadySent = normalizeDate(amc.lastReminderSentForDate) === dueDate;
    const invoiceAlreadyGenerated = normalizeDate(amc.lastInvoiceGeneratedForDate) === dueDate || hasInvoiceForPeriod;

    if (status === 'Cancelled') {
      skipped += 1;
      results.push({ amcId: amc.id, action: 'skipped', reason: 'Cancelled' });
      if (!dryRun) {
        await recordAutomationLog({
          amcId: amc.id,
          runId,
          runSource,
          action: 'skipped',
          status: 'Warning',
          dueDate,
          message: 'AMC is cancelled',
          payload: { reason: 'Cancelled' }
        });
      }
      continue;
    }

    const result = {
      amcId: amc.id,
      title: amc.title || amc.amcType || 'AMC',
      dueDate,
      daysRemaining,
      reminderSent: false,
      invoiceCreated: false,
      warnings: []
    };

    if (canRemind && !reminderAlreadySent) {
      try {
        if (!dryRun) {
          const reminderResult = await sendAmcReminder({ amc, client, dueDate });
          if (reminderResult.sent) {
            remindersSent += 1;
            result.reminderSent = true;
            await recordAutomationLog({
              amcId: amc.id,
              runId,
              runSource,
              action: 'reminder_sent',
              status: 'Success',
              dueDate,
              message: `Reminder sent for ${dueDate || 'next billing date'}`,
              payload: { dueDate, reminderDays }
            });
          } else {
            result.warnings.push(reminderResult.reason);
            await recordAutomationLog({
              amcId: amc.id,
              runId,
              runSource,
              action: 'reminder_failed',
              status: 'Warning',
              dueDate,
              message: reminderResult.reason || 'Reminder skipped',
              payload: { dueDate, reminderDays }
            });
          }
        } else {
          result.reminderSent = true;
        }
      } catch (error) {
        result.warnings.push(`Reminder failed: ${error.message}`);
        if (!dryRun) {
          await recordAutomationLog({
            amcId: amc.id,
            runId,
            runSource,
            action: 'reminder_failed',
            status: 'Error',
            dueDate,
            message: error.message,
            payload: { dueDate, reminderDays }
          });
        }
      }
    }

    if (canInvoice && !invoiceAlreadyGenerated) {
      if (!client) {
        result.warnings.push('Client missing, invoice skipped');
        if (!dryRun) {
          await recordAutomationLog({
            amcId: amc.id,
            runId,
            runSource,
            action: 'invoice_skipped',
            status: 'Warning',
            dueDate,
            message: 'Client missing, invoice skipped',
            payload: { dueDate }
          });
        }
      } else if (!dryRun) {
        try {
          const invoice = await createAmcInvoice({
            amc,
            client,
            project,
            settings,
            dueDate,
            nextSequence
          });
          invoicesCreated += 1;
          nextSequence += 1;
          result.invoiceCreated = true;
          result.invoiceId = invoice?.id || null;
          result.invoiceNumber = invoice?.invoiceNumber || null;
          existingByAmc.set(String(amc.id), [...existingInvoices, invoice]);
          await recordAutomationLog({
            amcId: amc.id,
            runId,
            runSource,
            action: 'invoice_created',
            status: 'Success',
            dueDate,
            invoiceId: invoice?.id || null,
            invoiceNumber: invoice?.invoiceNumber || '',
            message: `Invoice ${invoice?.invoiceNumber || ''} created from AMC`,
            payload: { dueDate, nextSequence: nextSequence - 1 }
          });
        } catch (error) {
          result.warnings.push(`Invoice creation failed: ${error.message}`);
          await recordAutomationLog({
            amcId: amc.id,
            runId,
            runSource,
            action: 'invoice_failed',
            status: 'Error',
            dueDate,
            message: error.message,
            payload: { dueDate }
          });
        }
      } else {
        result.invoiceCreated = true;
        result.invoiceNumber = generateInvoiceNumber(settings || {}, nextSequence, today);
        nextSequence += 1;
      }
    }

    if (!dryRun && (result.reminderSent || result.invoiceCreated)) {
      const patch = {
        lastAutomationRunAt: new Date().toISOString(),
        lastReminderSentAt: result.reminderSent ? new Date().toISOString() : amc.lastReminderSentAt || null,
        lastReminderSentForDate: result.reminderSent ? dueDate : amc.lastReminderSentForDate || null,
        lastInvoiceGeneratedAt: result.invoiceCreated ? new Date().toISOString() : amc.lastInvoiceGeneratedAt || null,
        lastInvoiceGeneratedForDate: result.invoiceCreated ? dueDate : amc.lastInvoiceGeneratedForDate || null,
        lastGeneratedInvoiceId: result.invoiceId || amc.lastGeneratedInvoiceId || null,
        lastGeneratedInvoiceNumber: result.invoiceNumber || amc.lastGeneratedInvoiceNumber || null
      };

      if (result.invoiceCreated) {
        patch.nextInvoiceDate = billingMonths && dueDate ? addMonths(dueDate, billingMonths) : amc.nextInvoiceDate || null;
      }

      await amcModel.update(amc.id, patch);
    } else if (!dryRun) {
      await amcModel.update(amc.id, {
        lastAutomationRunAt: new Date().toISOString()
      });
    }

    if (!result.reminderSent && !result.invoiceCreated && result.warnings.length === 0) {
      skipped += 1;
    }

    results.push(result);
  }

  return {
    success: true,
    runId,
    runSource,
    today,
    remindersSent,
    invoicesCreated,
    skipped,
    count: amcs.length,
    results
  };
}

function scheduleAmcAutomation({ schedule = process.env.AMC_AUTOMATION_CRON || '15 9 * * *', timezone = 'Asia/Kolkata' } = {}) {
  const cron = require('node-cron');
  if (!cron.validate(schedule)) {
    throw new Error(`Invalid AMC automation cron schedule: ${schedule}`);
  }

  return cron.schedule(schedule, () => {
    console.log('\n[AMC] Scheduled automation triggered...');
    runAmcAutomation({ runSource: 'cron' })
      .then((result) => {
        console.log(`[AMC] Automation complete. reminders=${result.remindersSent}, invoices=${result.invoicesCreated}, skipped=${result.skipped}`);
      })
      .catch((error) => {
        console.error('[AMC] Automation failed:', error.message);
      });
  }, { timezone });
}

module.exports = {
  runAmcAutomation,
  scheduleAmcAutomation
};
