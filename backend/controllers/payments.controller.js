const { createCrudController } = require('./crudController');
const paymentModel = require('../models/payment.model');
const invoiceModel = require('../models/invoice.model');
const { withTransaction } = require('../config/db');
const { syncInvoiceFinancialState } = require('../services/finance.service');
const { toNumber } = require('../utils/format');
const { notifyBusinessEvent } = require('../services/notification.service');
const followUpEngine = require('../services/followUpEngine.service');

const paymentsController = createCrudController(paymentModel, {
  defaultOrder: 'payment_date DESC'
});

async function normalizePayment(body = {}, current = null) {
  const base = current ? { ...current, ...body } : { ...body };
  let clientId = base.clientId || current?.clientId || null;
  let projectId = base.projectId || current?.projectId || null;
  const invoiceId = base.invoiceId || current?.invoiceId || null;

  if (invoiceId) {
    const invoice = await invoiceModel.findById(invoiceId);
    if (invoice) {
      clientId = clientId || invoice.clientId || null;
      projectId = projectId || invoice.projectId || null;
    }
  }

  return {
    ...base,
    paymentDate: base.paymentDate || current?.paymentDate || new Date().toISOString().slice(0, 10),
    clientId,
    projectId,
    invoiceId,
    amountReceived: toNumber(base.amountReceived ?? current?.amountReceived ?? 0),
    tdsDeducted: toNumber(base.tdsDeducted ?? current?.tdsDeducted ?? 0),
    paymentStatus: base.paymentStatus || current?.paymentStatus || 'Received',
    paymentMode: base.paymentMode || current?.paymentMode || 'Bank Transfer',
    bankAccountId: base.bankAccountId || current?.bankAccountId || null,
    transactionId: base.transactionId || current?.transactionId || '',
    notes: base.notes || current?.notes || ''
  };
}

async function syncInvoicesForPaymentChange(db, before = null, after = null) {
  const invoiceIds = new Set([before?.invoiceId, after?.invoiceId].filter(Boolean).map((value) => String(value)));
  for (const invoiceId of invoiceIds) {
    await syncInvoiceFinancialState(invoiceId, db);
  }
}

paymentsController.create = async (req, res, next) => {
  try {
    const record = await withTransaction(async (db) => {
      const body = await normalizePayment(req.body || {}, null);
      const created = await paymentModel.create(body, db);
      await syncInvoicesForPaymentChange(db, null, created);
      if (created.invoiceId) {
        const invoice = await invoiceModel.findById(created.invoiceId, db);
        if (String(invoice?.status || '').toLowerCase() === 'paid') {
          await followUpEngine.autoCloseEntityFollowUps('Invoice', created.invoiceId, 'Payment fully received', req.user, { db });
          await followUpEngine.handleBusinessTrigger('payment_received', 'Invoice', created.invoiceId, req.user, { db });
          await db.query(
            `update payment_promises set status='Fulfilled', fulfilled_amount=promised_amount,
             fulfilled_date=$2, missed=false, updated_by=$3, updated_at=now()
             where invoice_id=$1 and status in ('Pending','Missed')`,
            [created.invoiceId, created.paymentDate, req.user?.id || null]
          );
        }
      }
      return paymentModel.findById(created.id, db);
    });

    if (record) {
      notifyBusinessEvent({
        moduleName: 'payments',
        eventKey: 'created',
        entity: record,
        clientId: record.clientId || null,
        title: 'Payment recorded',
        message: `Payment of ₹${Number(record.amountReceived || 0).toLocaleString('en-IN')} was recorded.`,
        actorUserId: req.user?.id || null,
        notifyClient: Boolean(record.clientId),
        routePath: `/app/payments/${record.id}`
      }).catch(() => {});
    }

    res.status(201).json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
};

paymentsController.update = async (req, res, next) => {
  try {
    const record = await withTransaction(async (db) => {
      const current = await paymentModel.findById(req.params.id, db);
      if (!current) return null;
      const body = await normalizePayment(req.body || {}, current);
      const updated = await paymentModel.update(req.params.id, body, db);
      await syncInvoicesForPaymentChange(db, current, updated);
      if (updated.invoiceId) {
        const invoice = await invoiceModel.findById(updated.invoiceId, db);
        if (String(invoice?.status || '').toLowerCase() === 'paid') {
          await followUpEngine.autoCloseEntityFollowUps('Invoice', updated.invoiceId, 'Payment fully received', req.user, { db });
          await followUpEngine.handleBusinessTrigger('payment_received', 'Invoice', updated.invoiceId, req.user, { db });
          await db.query(
            `update payment_promises set status='Fulfilled', fulfilled_amount=promised_amount,
             fulfilled_date=$2, missed=false, updated_by=$3, updated_at=now()
             where invoice_id=$1 and status in ('Pending','Missed')`,
            [updated.invoiceId, updated.paymentDate, req.user?.id || null]
          );
        }
      }
      return paymentModel.findById(updated.id, db);
    });

    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    notifyBusinessEvent({
      moduleName: 'payments',
      eventKey: 'updated',
      entity: record,
      clientId: record.clientId || null,
      title: 'Payment updated',
      message: `Payment of ₹${Number(record.amountReceived || 0).toLocaleString('en-IN')} was updated.`,
      actorUserId: req.user?.id || null,
      notifyClient: Boolean(record.clientId),
      routePath: `/app/payments/${record.id}`
    }).catch(() => {});

    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
};

paymentsController.remove = async (req, res, next) => {
  try {
    const ok = await withTransaction(async (db) => {
      const current = await paymentModel.findById(req.params.id, db);
      if (!current) return false;
      const removed = await paymentModel.remove(req.params.id, db);
      if (removed) {
        await syncInvoicesForPaymentChange(db, current, null);
      }
      return removed;
    });

    if (!ok) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    notifyBusinessEvent({
      moduleName: 'payments',
      eventKey: 'deleted',
      entity: current,
      clientId: current.clientId || null,
      title: 'Payment deleted',
      message: `Payment of ₹${Number(current.amountReceived || 0).toLocaleString('en-IN')} was deleted.`,
      severity: 'warning',
      actorUserId: req.user?.id || null,
      notifyClient: Boolean(current.clientId)
    }).catch(() => {});

    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = paymentsController;
