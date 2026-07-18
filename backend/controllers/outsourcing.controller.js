const { createCrudController } = require('./crudController');
const outsourcingModel = require('../models/outsourcingExpense.model');
const masterItemModel = require('../models/masterItem.model');
const workflowAutomationLogModel = require('../models/workflowAutomationLog.model');
const { getSettings } = require('../models/settings.model');
const { calculateOutsourcingExpense } = require('../utils/finance');
const { round2, toNumber } = require('../utils/format');
const { buildOutsourcingAutomationSummary, runOutsourcingAutomation, summarizeOutsourcing } = require('../services/outsourcingAutomation.service');
const { notifyBusinessEvent } = require('../services/notification.service');

async function normalizeOutsourcing(body = {}, current = null) {
  const settings = (await getSettings()) || {};
  const base = current ? { ...current, ...body } : { ...body };
  const vendor = base.vendorId ? await masterItemModel.findOne('vendor', base.vendorId) : null;
  const calculated = calculateOutsourcingExpense(base, vendor || {}, settings);
  const baseAmount = round2(toNumber(base.baseAmount || current?.baseAmount || calculated.baseAmount));

  return {
    ...base,
    clientId: base.clientId || current?.clientId || null,
    projectId: base.projectId || current?.projectId || null,
    vendorId: base.vendorId || vendor?.id || current?.vendorId || null,
    vendorName: base.vendorName || vendor?.name || current?.vendorName || '',
    baseAmount,
    vendorGstRegistered: Boolean(base.vendorGstRegistered ?? vendor?.gstRegistered ?? current?.vendorGstRegistered),
    gstApplicable: Boolean(base.gstApplicable ?? current?.gstApplicable),
    gstRate: calculated.gstRate,
    gstAmount: calculated.gstAmount,
    totalAmount: calculated.totalAmount,
    itcEligible: Boolean(base.itcEligible ?? current?.itcEligible ?? true),
    approvalStatus: String(base.approvalStatus || current?.approvalStatus || 'Pending').trim() || 'Pending',
    dueDate: base.dueDate || current?.dueDate || null,
    paymentStatus: String(base.paymentStatus || current?.paymentStatus || 'Pending').trim() || 'Pending',
    reminderDays: Math.max(1, toNumber(base.reminderDays ?? current?.reminderDays ?? settings?.invoice?.defaultDueDays ?? 7, 7)),
    lastReminderSentAt: base.lastReminderSentAt || current?.lastReminderSentAt || null,
    lastReminderSentForDate: base.lastReminderSentForDate || current?.lastReminderSentForDate || null,
    lastAutomationRunAt: base.lastAutomationRunAt || current?.lastAutomationRunAt || null
  };
}

function buildOutsourcingRunSummary(runLogs = []) {
  return {
    runId: runLogs[0]?.runId || null,
    runSource: runLogs[0]?.runSource || null,
    startedAt: runLogs[0]?.createdAt || null,
    remindersSent: runLogs.filter((item) => ['approval_reminder_sent', 'payment_reminder_sent'].includes(item.action)).length,
    alertsSent: runLogs.filter((item) => ['approval_alert', 'due_alert', 'overdue_alert'].includes(item.action)).length,
    skipped: runLogs.filter((item) => item.action === 'skipped').length,
    failures: runLogs.filter((item) => String(item.status || '').trim() === 'Error' || String(item.action || '').includes('failed')).length,
    events: runLogs.length,
    affectedRecords: new Set(runLogs.map((item) => item.entityId).filter(Boolean)).size
  };
}

function buildOutsourcingAutomationFeed(logs = [], { limit = 20, runsLimit = 5 } = {}) {
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
    return {
      ...buildOutsourcingRunSummary(runLogs),
      entries: runLogs.slice(0, limit)
    };
  };

  const recentRuns = orderedRunIds.slice(0, runsLimit).map((runId) => buildRun(runId));

  return {
    latestRun: recentRuns[0] || null,
    recentRuns
  };
}

const baseController = createCrudController(outsourcingModel, {
  defaultOrder: 'expense_date DESC',
  onList: async (rows = []) => rows.map(summarizeOutsourcing),
  onCreate: (body) => normalizeOutsourcing(body, null),
  onUpdate: (body, req, current) => normalizeOutsourcing(body, current)
});

module.exports = {
  ...baseController,
  create: async (req, res, next) => {
    try {
      const body = await normalizeOutsourcing(req.body || {}, null);
      const record = await outsourcingModel.create(body);
      notifyBusinessEvent({
        moduleName: 'outsourcing',
        eventKey: 'created',
        entity: record,
        clientId: record.clientId || null,
        title: 'Outsourcing expense created',
        message: `${record.workType || 'Outsourcing expense'} was created.`,
        actorUserId: req.user?.id || null,
        notifyClient: Boolean(record.clientId),
        routePath: `/app/outsourcing/${record.id}`
      }).catch(() => {});
      res.status(201).json({ success: true, data: summarizeOutsourcing(record, await getSettings()) });
    } catch (error) {
      next(error);
    }
  },
  update: async (req, res, next) => {
    try {
      const current = await outsourcingModel.findById(req.params.id);
      if (!current) {
        return res.status(404).json({ success: false, message: 'Record not found' });
      }
      const body = await normalizeOutsourcing(req.body || {}, current);
      const record = await outsourcingModel.update(req.params.id, body);
      notifyBusinessEvent({
        moduleName: 'outsourcing',
        eventKey: 'updated',
        entity: record,
        clientId: record.clientId || null,
        title: 'Outsourcing expense updated',
        message: `${record.workType || 'Outsourcing expense'} was updated.`,
        actorUserId: req.user?.id || null,
        notifyClient: Boolean(record.clientId),
        routePath: `/app/outsourcing/${record.id}`
      }).catch(() => {});
      res.json({ success: true, data: summarizeOutsourcing(record, await getSettings()) });
    } catch (error) {
      next(error);
    }
  },
  getById: async (req, res, next) => {
    try {
      const record = await outsourcingModel.findById(req.params.id);
      if (!record) {
        return res.status(404).json({ success: false, message: 'Record not found' });
      }
      res.json({ success: true, data: summarizeOutsourcing(record, await getSettings()) });
    } catch (error) {
      next(error);
    }
  },
  getAutomationSummary: async (req, res, next) => {
    try {
      const summary = await buildOutsourcingAutomationSummary();
      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  },
  getAutomationLogs: async (req, res, next) => {
    try {
      const limit = Math.max(1, toNumber(req.query?.limit, 20));
      const runsLimit = Math.max(1, toNumber(req.query?.runsLimit, 5));
      const logs = await workflowAutomationLogModel.list({
        where: { moduleName: 'outsourcing' },
        orderBy: 'created_at DESC'
      });

      const feed = buildOutsourcingAutomationFeed(logs, { limit, runsLimit });
      res.json({
        success: true,
        data: feed
      });
    } catch (error) {
      next(error);
    }
  },
  getAutomationHistory: async (req, res, next) => {
    try {
      const record = await outsourcingModel.findById(req.params.id);
      if (!record) {
        return res.status(404).json({ success: false, message: 'Record not found' });
      }

      const limit = Math.max(1, toNumber(req.query?.limit, 20));
      const logs = await workflowAutomationLogModel.list({
        where: { moduleName: 'outsourcing', entityId: req.params.id },
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
  runAutomation: async (req, res, next) => {
    try {
      const dryRun = String(req.query?.dryRun || req.body?.dryRun || '').trim().toLowerCase() === 'true';
      const result = await runOutsourcingAutomation({ dryRun, runSource: 'manual' });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
};
