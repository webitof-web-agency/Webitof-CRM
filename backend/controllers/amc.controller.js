const { createCrudController } = require('./crudController');
const amcModel = require('../models/amc.model');
const amcAutomationLogModel = require('../models/amcAutomationLog.model');
const masterItemModel = require('../models/masterItem.model');
const { round2, toNumber } = require('../utils/format');
const { runAmcAutomation } = require('../services/amcAutomation.service');
const { notifyBusinessEvent } = require('../services/notification.service');

function normalizeDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  return text ? text.slice(0, 10) : null;
}

function parseBillingCycleMonths(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return null;
  if (text.includes('month')) return text.includes('quarter') ? 3 : 1;
  if (text.includes('half')) return 6;
  if (text.includes('year')) return 12;
  return null;
}

function resolveMasterItem(record = {}, items = []) {
  const value = String(record || '').trim().toLowerCase();
  if (!value) return null;
  return items.find((item) => {
    const id = String(item?.id || '').trim().toLowerCase();
    const name = String(item?.name || '').trim().toLowerCase();
    return id === value || name === value;
  }) || null;
}

function addMonths(dateValue, months = 0) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  date.setMonth(date.getMonth() + Number(months || 0));
  return date.toISOString().slice(0, 10);
}

function daysUntil(dateValue, fromDate = new Date()) {
  if (!dateValue) return null;
  const target = new Date(dateValue);
  const base = new Date(fromDate);
  if (Number.isNaN(target.getTime()) || Number.isNaN(base.getTime())) return null;
  return Math.ceil((target - base) / (1000 * 60 * 60 * 24));
}

function summarizeAmc(record = {}) {
  const title = String(record.title || record.amcType || '').trim() || 'AMC';
  const nextDueDate = normalizeDate(record.nextInvoiceDate || record.endDate);
  const daysRemaining = nextDueDate ? daysUntil(nextDueDate) : null;
  const reminderDays = toNumber(record.reminderDays, 7);
  const baseStatus = String(record.status || 'Active').trim() || 'Active';
  const renewalStatus = baseStatus === 'Cancelled'
    ? 'Cancelled'
    : daysRemaining == null
      ? baseStatus
      : daysRemaining < 0
        ? 'Expired'
        : daysRemaining <= reminderDays
          ? 'Due Soon'
          : baseStatus;

  return {
    ...record,
    title,
    startDate: normalizeDate(record.startDate),
    endDate: normalizeDate(record.endDate),
    nextInvoiceDate: nextDueDate,
    daysRemaining,
    billingCycle: record.billingCycle || '',
    amcAmount: round2(record.amcAmount),
    reminderDays,
    autoInvoice: Boolean(record.autoInvoice),
    status: baseStatus,
    renewalStatus,
    isDueSoon: renewalStatus === 'Due Soon',
    lastInvoiceGeneratedAt: normalizeDate(record.lastInvoiceGeneratedAt),
    lastReminderSentAt: normalizeDate(record.lastReminderSentAt)
  };
}

function buildAmcRunSummary(runLogs = []) {
  const latestRunId = runLogs[0]?.runId || null;
  const remindersSent = runLogs.filter((item) => item.action === 'reminder_sent').length;
  const invoicesCreated = runLogs.filter((item) => item.action === 'invoice_created').length;
  const skipped = runLogs.filter((item) => ['skipped', 'invoice_skipped'].includes(item.action)).length;
  const failures = runLogs.filter((item) => ['reminder_failed', 'invoice_failed'].includes(item.action) || String(item.status || '').trim() === 'Error').length;
  const affectedAmcs = new Set(runLogs.map((item) => item.amcId).filter(Boolean)).size;

  return {
    runId: latestRunId,
    runSource: runLogs[0]?.runSource || null,
    startedAt: runLogs[0]?.createdAt || null,
    remindersSent,
    invoicesCreated,
    skipped,
    failures,
    events: runLogs.length,
    affectedAmcs
  };
}

function buildAmcAutomationFeed(logs = [], { limit = 20, runsLimit = 5 } = {}) {
  const orderedRunIds = [];
  const runMap = new Map();

  logs.forEach((item) => {
    const runId = item?.runId || null;
    if (!runId) return;
    if (!runMap.has(runId)) {
      runMap.set(runId, []);
      orderedRunIds.push(runId);
    }
    runMap.get(runId).push(item);
  });

  const buildRun = (runId) => {
    const runLogs = runMap.get(runId) || [];
    const summary = buildAmcRunSummary(runLogs);
    return {
      ...summary,
      entries: runLogs.slice(0, limit)
    };
  };

  const recentRuns = orderedRunIds.slice(0, runsLimit).map((runId) => buildRun(runId));

  return {
    latestRun: recentRuns[0] || null,
    recentRuns
  };
}

async function normalizeAmc(body = {}, current = null) {
  const base = current ? { ...current, ...body } : { ...body };
  const amcTypes = await masterItemModel.listByType('amc_type');
  const amcTypeMeta = resolveMasterItem(base.amcType || current?.amcType, amcTypes);
  const billingCycle = String(base.billingCycle || current?.billingCycle || amcTypeMeta?.payload?.defaultBillingCycle || '').trim();
  const billingMonths = parseBillingCycleMonths(billingCycle) || toNumber(amcTypeMeta?.payload?.billingMonths, 0) || parseBillingCycleMonths(amcTypeMeta?.payload?.defaultBillingCycle);
  const startDate = normalizeDate(base.startDate || current?.startDate);
  const endDate = normalizeDate(base.endDate || base.renewalDate || current?.endDate || current?.renewalDate);
  const nextInvoiceDate = normalizeDate(base.nextInvoiceDate || current?.nextInvoiceDate || (billingMonths && startDate ? addMonths(startDate, billingMonths) : null));
  const title = String(base.title || current?.title || base.amcType || '').trim() || 'AMC';
  const reminderDays = toNumber(base.reminderDays ?? current?.reminderDays ?? amcTypeMeta?.payload?.defaultReminderDays ?? 7, 7);
  const autoInvoice = base.autoInvoice ?? current?.autoInvoice ?? amcTypeMeta?.payload?.autoInvoice ?? false;

  return {
    ...base,
    title,
    amcType: String(base.amcType || current?.amcType || '').trim(),
    clientId: base.clientId || current?.clientId || null,
    projectId: base.projectId || current?.projectId || null,
    startDate,
    endDate,
    billingCycle,
    amcAmount: round2(base.amcAmount ?? current?.amcAmount ?? 0),
    gstType: String(base.gstType || current?.gstType || '').trim(),
    nextInvoiceDate,
    reminderDays,
    status: String(base.status || current?.status || 'Active').trim() || 'Active',
    autoInvoice: Boolean(autoInvoice),
    remarks: String(base.remarks || current?.remarks || '').trim(),
    supportScope: String(base.supportScope || current?.supportScope || amcTypeMeta?.payload?.supportScope || '').trim(),
    supportHours: toNumber(base.supportHours ?? current?.supportHours ?? amcTypeMeta?.payload?.supportHours ?? 0, 0),
    responseSlaHours: toNumber(base.responseSlaHours ?? current?.responseSlaHours ?? amcTypeMeta?.payload?.responseSlaHours ?? 24, 24),
    lastAutomationRunAt: base.lastAutomationRunAt || current?.lastAutomationRunAt || null,
    lastInvoiceGeneratedAt: base.lastInvoiceGeneratedAt || current?.lastInvoiceGeneratedAt || null,
    lastReminderSentAt: base.lastReminderSentAt || current?.lastReminderSentAt || null,
    lastGeneratedInvoiceId: base.lastGeneratedInvoiceId || current?.lastGeneratedInvoiceId || null,
    lastGeneratedInvoiceNumber: base.lastGeneratedInvoiceNumber || current?.lastGeneratedInvoiceNumber || null,
    lastReminderSentForDate: base.lastReminderSentForDate || current?.lastReminderSentForDate || null,
    lastInvoiceGeneratedForDate: base.lastInvoiceGeneratedForDate || current?.lastInvoiceGeneratedForDate || null
  };
}

const baseController = createCrudController(amcModel, {
  defaultOrder: 'updated_at DESC',
  onList: async (rows = []) => rows.map(summarizeAmc),
  onCreate: (body) => normalizeAmc(body, null),
  onUpdate: (body, req, current) => normalizeAmc(body, current)
});

module.exports = {
  ...baseController,
  create: async (req, res, next) => {
    try {
      const body = await normalizeAmc(req.body || {}, null);
      const record = await amcModel.create(body);
      notifyBusinessEvent({
        moduleName: 'amc',
        eventKey: 'created',
        entity: record,
        clientId: record.clientId || null,
        title: 'AMC created',
        message: `${record.title || record.amcType || 'AMC'} was created.`,
        actorUserId: req.user?.id || null,
        notifyClient: Boolean(record.clientId),
        routePath: `/app/amc/${record.id}`
      }).catch(() => {});
      res.status(201).json({ success: true, data: summarizeAmc(record) });
    } catch (error) {
      next(error);
    }
  },
  update: async (req, res, next) => {
    try {
      const current = await amcModel.findById(req.params.id);
      if (!current) {
        return res.status(404).json({ success: false, message: 'Record not found' });
      }
      const body = await normalizeAmc(req.body || {}, current);
      const record = await amcModel.update(req.params.id, body);
      notifyBusinessEvent({
        moduleName: 'amc',
        eventKey: 'updated',
        entity: record,
        clientId: record.clientId || null,
        title: 'AMC updated',
        message: `${record.title || record.amcType || 'AMC'} was updated.`,
        actorUserId: req.user?.id || null,
        notifyClient: Boolean(record.clientId),
        routePath: `/app/amc/${record.id}`
      }).catch(() => {});
      res.json({ success: true, data: summarizeAmc(record) });
    } catch (error) {
      next(error);
    }
  },
  getById: async (req, res, next) => {
    try {
      const record = await amcModel.findById(req.params.id);
      if (!record) {
        return res.status(404).json({ success: false, message: 'Record not found' });
      }
      res.json({ success: true, data: summarizeAmc(record) });
    } catch (error) {
      next(error);
    }
  },
  getAutomationHistory: async (req, res, next) => {
    try {
      const record = await amcModel.findById(req.params.id);
      if (!record) {
        return res.status(404).json({ success: false, message: 'Record not found' });
      }

      const limit = Math.max(1, toNumber(req.query?.limit, 20));
      const logs = await amcAutomationLogModel.list({
        where: { amcId: req.params.id },
        orderBy: 'created_at DESC'
      });

      res.json({
        success: true,
        data: logs.slice(0, limit)
      });
    } catch (error) {
      next(error);
    }
  },
  getAutomationLogs: async (req, res, next) => {
    try {
      const limit = Math.max(1, toNumber(req.query?.limit, 20));
      const runsLimit = Math.max(1, toNumber(req.query?.runsLimit, 5));
      const logs = await amcAutomationLogModel.list({
        orderBy: 'created_at DESC'
      });

      const feed = buildAmcAutomationFeed(logs, { limit, runsLimit });
      res.json({
        success: true,
        data: feed
      });
    } catch (error) {
      next(error);
    }
  },
  getAutomationSummary: async (req, res, next) => {
    try {
      const logs = await amcAutomationLogModel.list({ orderBy: 'created_at DESC' });
      if (!logs.length) {
        return res.json({
          success: true,
          data: {
            runId: null,
            runSource: null,
            startedAt: null,
            remindersSent: 0,
            invoicesCreated: 0,
            skipped: 0,
            failures: 0,
            events: 0,
            affectedAmcs: 0
          }
        });
      }

      const latestRunId = logs[0]?.runId || null;
      const latestRunLogs = latestRunId ? logs.filter((item) => item.runId === latestRunId) : [];
      const summary = buildAmcRunSummary(latestRunLogs);

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      next(error);
    }
  },
  runAutomation: async (req, res, next) => {
    try {
      const dryRun = String(req.query?.dryRun || req.body?.dryRun || '').trim().toLowerCase() === 'true';
      const result = await runAmcAutomation({ dryRun });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
};
