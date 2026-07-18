const { createCrudController } = require('./crudController');
const renewalModel = require('../models/renewal.model');
const masterItemModel = require('../models/masterItem.model');
const workflowAutomationLogModel = require('../models/workflowAutomationLog.model');
const { toNumber, round2 } = require('../utils/format');
const { buildRenewalAutomationSummary, runRenewalAutomation, summarizeRenewal } = require('../services/renewalAutomation.service');
const { notifyBusinessEvent } = require('../services/notification.service');

async function normalizeRenewal(body = {}, current = null) {
  const base = current ? { ...current, ...body } : { ...body };
  const providerItem = base.providerId ? await masterItemModel.findOne('renewal_provider', base.providerId) : null;
  const providerValue = String(
    base.provider
    || base.providerName
    || providerItem?.name
    || base.providerId
    || current?.provider
    || current?.providerName
    || current?.providerId
    || ''
  ).trim();

  return {
    ...base,
    clientId: base.clientId || current?.clientId || null,
    projectId: base.projectId || current?.projectId || null,
    category: String(base.category || current?.category || 'General').trim() || 'General',
    provider: providerValue,
    providerName: String(base.providerName || providerItem?.name || current?.providerName || providerValue).trim(),
    purchaseDate: base.purchaseDate || current?.purchaseDate || null,
    renewalDate: base.renewalDate || current?.renewalDate || null,
    expiryDate: base.expiryDate || current?.expiryDate || null,
    reminderDate: base.reminderDate || current?.reminderDate || null,
    durationYears: toNumber(base.durationYears ?? current?.durationYears ?? 1, 1),
    seats: base.seats == null || base.seats === '' ? current?.seats ?? null : toNumber(base.seats, current?.seats ?? null),
    purchasePrice: round2(base.purchasePrice ?? current?.purchasePrice ?? 0),
    renewalPrice: round2(base.renewalPrice ?? current?.renewalPrice ?? 0),
    renewalCost: round2(base.renewalCost ?? current?.renewalCost ?? 0),
    clientCharge: round2(base.clientCharge ?? current?.clientCharge ?? 0),
    reminderDays: Math.max(1, toNumber(base.reminderDays ?? current?.reminderDays ?? 30, 30)),
    autoRenewal: Boolean(base.autoRenewal ?? current?.autoRenewal ?? false),
    financeAction: String(base.financeAction || current?.financeAction || 'None').trim() || 'None',
    status: String(base.status || current?.status || 'Pending').trim() || 'Pending',
    remarks: String(base.remarks || current?.remarks || '').trim()
  };
}

const baseController = createCrudController(renewalModel, {
  defaultOrder: 'renewal_date ASC NULLS LAST',
  onList: async (rows = []) => rows.map(summarizeRenewal),
  onCreate: (body) => normalizeRenewal(body, null),
  onUpdate: (body, req, current) => normalizeRenewal(body, current)
});

module.exports = {
  ...baseController,
  create: async (req, res, next) => {
    try {
      const body = await normalizeRenewal(req.body || {}, null);
      const record = await renewalModel.create(body);
      notifyBusinessEvent({
        moduleName: 'renewals',
        eventKey: 'created',
        entity: record,
        clientId: record.clientId || null,
        title: 'Renewal created',
        message: `${record.category || 'Renewal'} was created.`,
        actorUserId: req.user?.id || null,
        notifyClient: Boolean(record.clientId),
        routePath: `/app/renewals/${record.id}`
      }).catch(() => {});
      res.status(201).json({ success: true, data: summarizeRenewal(record) });
    } catch (error) {
      next(error);
    }
  },
  update: async (req, res, next) => {
    try {
      const current = await renewalModel.findById(req.params.id);
      if (!current) {
        return res.status(404).json({ success: false, message: 'Record not found' });
      }
      const body = await normalizeRenewal(req.body || {}, current);
      const record = await renewalModel.update(req.params.id, body);
      notifyBusinessEvent({
        moduleName: 'renewals',
        eventKey: 'updated',
        entity: record,
        clientId: record.clientId || null,
        title: 'Renewal updated',
        message: `${record.category || 'Renewal'} was updated.`,
        actorUserId: req.user?.id || null,
        notifyClient: Boolean(record.clientId),
        routePath: `/app/renewals/${record.id}`
      }).catch(() => {});
      res.json({ success: true, data: summarizeRenewal(record) });
    } catch (error) {
      next(error);
    }
  },
  getById: async (req, res, next) => {
    try {
      const record = await renewalModel.findById(req.params.id);
      if (!record) {
        return res.status(404).json({ success: false, message: 'Record not found' });
      }
      res.json({ success: true, data: summarizeRenewal(record) });
    } catch (error) {
      next(error);
    }
  },
  getAutomationSummary: async (req, res, next) => {
    try {
      const summary = await buildRenewalAutomationSummary();
      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  },
  getAutomationHistory: async (req, res, next) => {
    try {
      const record = await renewalModel.findById(req.params.id);
      if (!record) {
        return res.status(404).json({ success: false, message: 'Record not found' });
      }

      const limit = Math.max(1, toNumber(req.query?.limit, 20));
      const logs = await workflowAutomationLogModel.list({
        where: { moduleName: 'renewals', entityId: req.params.id },
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
      const result = await runRenewalAutomation({ dryRun, runSource: 'manual' });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
};
