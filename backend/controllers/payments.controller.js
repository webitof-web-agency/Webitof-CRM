const { createCrudController } = require('./crudController');
const paymentModel = require('../models/payment.model');
const invoiceModel = require('../models/invoice.model');
const { withTransaction } = require('../config/db');
const { syncInvoiceFinancialState, getInvoiceBalance, isPaymentCounted } = require('../services/finance.service');
const { toNumber, round2, businessDate } = require('../utils/format');
const { notifyBusinessEvent } = require('../services/notification.service');
const followUpEngine = require('../services/followUpEngine.service');

const paymentsController = createCrudController(paymentModel, {
  defaultOrder: 'payment_date DESC'
});

function paymentError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const money = (value) => Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });

// `db` is the open transaction: the invoice row is locked in it, so two payments recorded at the same
// moment cannot both pass the balance check.
async function normalizePayment(body = {}, current = null, db = null) {
  // After a merge, `base` already holds the saved values, so clearing a field (invoice, notes, bank) works.
  const base = current ? { ...current, ...body } : { ...body };
  let clientId = base.clientId || null;
  let projectId = base.projectId || null;
  const invoiceId = base.invoiceId || null;

  const amountReceived = toNumber(base.amountReceived ?? 0);
  const tdsDeducted = toNumber(base.tdsDeducted ?? 0);
  if (!Number.isFinite(amountReceived) || amountReceived <= 0) throw paymentError('Enter an amount received greater than zero.');
  if (!Number.isFinite(tdsDeducted) || tdsDeducted < 0) throw paymentError('TDS deducted cannot be negative.');

  const paymentStatus = base.paymentStatus || 'Received';
  const transactionId = String(base.transactionId || '').trim();

  if (invoiceId) {
    if (db) await db.query('select id from invoices where id = $1 for update', [invoiceId]);
    const invoice = await invoiceModel.findById(invoiceId, db);
    if (!invoice) throw paymentError('The selected invoice does not exist.', 404);
    if (['Cancelled', 'Draft'].includes(String(invoice.status || ''))) {
      throw paymentError(`Payments cannot be recorded against a ${String(invoice.status).toLowerCase()} invoice.`, 409);
    }
    if (clientId && invoice.clientId && String(clientId) !== String(invoice.clientId)) {
      throw paymentError('This payment\'s client does not match the invoice\'s client.');
    }
    clientId = clientId || invoice.clientId || null;
    projectId = projectId || invoice.projectId || null;

    // A payment that counts as received may not exceed what is still owed.
    const financialChange =
      !current ||
      round2(current.amountReceived) !== round2(amountReceived) ||
      round2(current.tdsDeducted) !== round2(tdsDeducted) ||
      String(current.invoiceId || '') !== String(invoiceId) ||
      String(current.paymentStatus || 'Received') !== String(paymentStatus);
    if (financialChange && isPaymentCounted({ paymentStatus })) {
      const balance = await getInvoiceBalance(invoiceId, db, { excludePaymentId: current?.id });
      const applied = round2(amountReceived + tdsDeducted);
      if (balance && applied > round2(balance.balanceDue) + 0.005) {
        throw paymentError(
          `This payment (${money(applied)} including TDS) is more than the invoice balance of ${money(balance.balanceDue)}. Record only the balance, or correct the invoice first.`,
          409
        );
      }
    }
  }

  // The same bank reference (UTR / cheque number) must not be recorded twice.
  if (transactionId && db) {
    const duplicate = await db.query(
      "select id from payments where lower(transaction_id) = lower($1) and id <> $2 limit 1",
      [transactionId, current?.id || '']
    );
    if (duplicate.rows[0]) throw paymentError('A payment with this transaction reference is already recorded.', 409);
  }

  return {
    ...base,
    paymentDate: base.paymentDate || businessDate(),
    clientId,
    projectId,
    invoiceId,
    amountReceived,
    tdsDeducted,
    paymentStatus,
    paymentMode: base.paymentMode || 'Bank Transfer',
    bankAccountId: base.bankAccountId || null,
    transactionId,
    notes: base.notes ?? ''
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
      const body = await normalizePayment(req.body || {}, null, db);
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
      const body = await normalizePayment(req.body || {}, current, db);
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
    const current = await withTransaction(async (db) => {
      const existing = await paymentModel.findById(req.params.id, db);
      if (!existing) return null;
      const removed = await paymentModel.remove(req.params.id, db);
      if (!removed) return null;
      await syncInvoicesForPaymentChange(db, existing, null);
      return existing;
    });

    if (!current) {
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

// Exposed so the validation rules can be tested without a database.
paymentsController.normalizePayment = normalizePayment;

module.exports = paymentsController;
