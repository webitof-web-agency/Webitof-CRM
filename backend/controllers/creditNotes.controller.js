const creditNoteModel = require('../models/creditNote.model');
const invoiceModel = require('../models/invoice.model');
const clientModel = require('../models/client.model');
const { getSettings } = require('../models/settings.model');
const { withTransaction } = require('../config/db');
const finance = require('../services/finance.service');
const { notifyBusinessEvent } = require('../services/notification.service');
const { businessDate, round2, toNumber } = require('../utils/format');

const MAX_LINES = 50;

function httpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const money = (value) => Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });

function isCalendarDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

// Credit notes run on their own sequence (CN-001, CN-002, ...). Called with the number lock held.
async function nextCreditNoteNumber(settings, db) {
  const prefix = String(settings?.creditNote?.prefix || 'CN').trim() || 'CN';
  const result = await db.query('select credit_note_number from credit_notes');
  const highest = (result.rows || []).reduce((max, row) => {
    const match = String(row.credit_note_number || '').match(/(\d+)\s*$/);
    const sequence = match ? Number(match[1]) : 0;
    return Number.isFinite(sequence) && sequence > max ? sequence : max;
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(3, '0')}`;
}

// Lines of a partial credit note, priced and taxed like invoice lines (no per-line discounts).
function readLines(raw) {
  if (!Array.isArray(raw) || raw.length === 0) throw httpError('Add at least one line to credit.');
  if (raw.length > MAX_LINES) throw httpError(`A credit note can have at most ${MAX_LINES} lines.`);
  return raw.map((line, index) => {
    const description = String(line?.description || '').trim();
    const quantity = toNumber(line?.quantity ?? 1);
    const rate = toNumber(line?.rate);
    if (!description || description.length > 200) throw httpError(`Line ${index + 1}: enter a description (up to 200 characters).`);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1e6) throw httpError(`Line ${index + 1}: quantity must be greater than zero.`);
    if (!Number.isFinite(rate) || rate <= 0) throw httpError(`Line ${index + 1}: the amount to credit must be greater than zero.`);
    const clean = { description, quantity, rate };
    if (line?.gstRate != null && line.gstRate !== '') {
      const gstRate = toNumber(line.gstRate);
      if (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100) throw httpError(`Line ${index + 1}: GST rate must be between 0 and 100.`);
      clean.gstRate = gstRate;
    }
    if (line?.hsnCode) clean.hsnCode = String(line.hsnCode).slice(0, 20);
    return clean;
  });
}

async function list(req, res, next) {
  try {
    const rows = await creditNoteModel.list({
      where: { invoiceId: req.query?.invoiceId, status: req.query?.status },
      orderBy: 'issue_date DESC, created_at DESC'
    });
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const note = await creditNoteModel.findByExactId(req.params.id);
    if (!note) return res.status(404).json({ success: false, message: 'Credit note not found' });
    const invoice = await invoiceModel.findById(note.invoiceId);
    const client = note.clientId ? await clientModel.findById(note.clientId) : null;
    res.json({ success: true, data: { ...note, invoiceNumber: invoice?.invoiceNumber || null, clientName: client?.companyName || client?.name || null } });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const body = req.body || {};
    const invoiceId = String(body.invoiceId || '').trim();
    if (!invoiceId) throw httpError('Choose the invoice to credit.');
    const reason = String(body.reason || '').trim();
    if (!reason) throw httpError('Give a reason for the credit note.');
    if (reason.length > 500) throw httpError('The reason can be at most 500 characters.');
    const issueDate = String(body.issueDate || businessDate()).slice(0, 10);
    if (!isCalendarDate(issueDate)) throw httpError('Issue date must be a valid date.');
    // No lines means "credit the whole invoice"; lines mean a partial credit.
    const lines = Array.isArray(body.items) && body.items.length ? readLines(body.items) : null;

    const { record, snapshot } = await withTransaction(async (db) => {
      // One credit-note number at a time, and one credit at a time per invoice, so two simultaneous credits
      // cannot both pass the cap below.
      await db.query(`select pg_advisory_xact_lock(hashtext('webitof-credit-note-number'))`);
      await db.query('select id from invoices where id = $1 for update', [invoiceId]);
      const invoice = await invoiceModel.findById(invoiceId, db);
      if (!invoice) throw httpError('Invoice not found.', 404);
      if (['Draft', 'Cancelled'].includes(String(invoice.status || ''))) {
        throw httpError(`A credit note cannot be raised against a ${String(invoice.status).toLowerCase()} invoice.`, 409);
      }
      if (invoice.invoiceDate && issueDate < String(invoice.invoiceDate).slice(0, 10)) {
        throw httpError('A credit note cannot be dated before its invoice.');
      }
      const [settings, client, existing] = await Promise.all([
        getSettings(),
        invoice.clientId ? clientModel.findById(invoice.clientId, db) : Promise.resolve(null),
        finance.loadCreditNotesForInvoice(invoiceId, db)
      ]);

      const totals = finance.calculateCreditNoteTotals(invoice, settings || {}, client || {}, lines);
      if (!(totals.totalAmount > 0)) throw httpError('The credit note value must be greater than zero.');
      const capacity = finance.getInvoiceCreditCapacity(invoice, settings || {}, client || {});
      const already = round2(existing.reduce((sum, note) => sum + toNumber(note.totalAmount), 0));
      if (round2(already + totals.totalAmount) > round2(capacity) + 0.005) {
        throw httpError(
          `Credit notes cannot exceed the invoice value of ${money(capacity)}. ${money(already)} is already credited, so at most ${money(Math.max(0, capacity - already))} can still be credited.`,
          409
        );
      }

      const creditNoteNumber = await nextCreditNoteNumber(settings, db);
      const created = await creditNoteModel.create({
        creditNoteNumber,
        invoiceId,
        clientId: invoice.clientId || null,
        issueDate,
        reason,
        status: 'Issued',
        amountType: invoice.amountType || null,
        placeOfSupply: invoice.placeOfSupply || null,
        items: totals.items,
        taxableAmount: totals.taxableAmount,
        cgst: totals.cgst,
        sgst: totals.sgst,
        utgst: totals.utgst,
        igst: totals.igst,
        gstAmount: totals.gstAmount,
        totalAmount: totals.totalAmount,
        createdBy: req.user?.id || null
      }, db);
      // Re-work the invoice's status and balance now that it is credited.
      const synced = await finance.syncInvoiceFinancialState(invoiceId, db);
      return { record: created, snapshot: synced };
    });

    notifyBusinessEvent({
      moduleName: 'invoices',
      eventKey: 'credit_note_issued',
      entity: record,
      clientId: record.clientId || null,
      title: 'Credit note issued',
      message: `Credit note ${record.creditNoteNumber} for ${money(record.totalAmount)} was issued.`,
      actorUserId: req.user?.id || null,
      notifyClient: false,
      routePath: `/app/invoices/${record.invoiceId}`
    }).catch(() => {});

    res.status(201).json({ success: true, data: { creditNote: record, invoice: snapshot } });
  } catch (error) {
    if (error?.code === '23505') return next(httpError('That credit note number is already used. Try again.', 409));
    next(error);
  }
}

async function cancel(req, res, next) {
  try {
    const reason = String(req.body?.reason || '').trim();
    if (!reason) throw httpError('Give a reason for cancelling the credit note.');
    const { record, snapshot } = await withTransaction(async (db) => {
      const found = await creditNoteModel.findByExactId(req.params.id, db);
      if (!found) throw httpError('Credit note not found.', 404);
      await db.query('select id from invoices where id = $1 for update', [found.invoiceId]);
      const note = await creditNoteModel.findByExactId(req.params.id, db);
      if (String(note.status || '') !== 'Issued') throw httpError('This credit note is already cancelled.', 409);
      const updated = await creditNoteModel.update(note.id, { status: 'Cancelled', cancelledAt: new Date().toISOString(), cancelReason: reason.slice(0, 500) }, db);
      const synced = await finance.syncInvoiceFinancialState(note.invoiceId, db);
      return { record: updated, snapshot: synced };
    });
    res.json({ success: true, data: { creditNote: record, invoice: snapshot } });
  } catch (error) {
    next(error);
  }
}

module.exports = { list, getById, create, cancel };
