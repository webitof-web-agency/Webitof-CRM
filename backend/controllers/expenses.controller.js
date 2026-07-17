const { createCrudController } = require('./crudController');
const expenseModel = require('../models/expense.model');
const masterItemModel = require('../models/masterItem.model');
const { getSettings } = require('../models/settings.model');
const { round2, toNumber } = require('../utils/format');

async function normalizeExpense(body = {}, current = null) {
  const settings = (await getSettings()) || {};
  const base = current ? { ...current, ...body } : { ...body };
  const vendor = base.vendorId ? await masterItemModel.findOne('vendor', base.vendorId) : null;
  const amountBeforeGst = toNumber(base.amountBeforeGst || current?.amountBeforeGst);
  const gstRate = toNumber(base.gstRate, settings?.gst?.defaultRate ?? 18);
  const gstAmount = round2(toNumber(base.gstAmount) || (amountBeforeGst * gstRate / 100));
  const totalAmount = round2(toNumber(base.totalAmount) || amountBeforeGst + gstAmount);

  return {
    ...base,
    vendor: base.vendor || vendor?.name || current?.vendor || '',
    vendorId: base.vendorId || vendor?.id || current?.vendorId || null,
    categoryId: base.categoryId || current?.categoryId || null,
    clientId: base.clientId || current?.clientId || null,
    projectId: base.projectId || current?.projectId || null,
    amountBeforeGst,
    gstRate,
    gstAmount,
    totalAmount,
    vendorGstin: String(base.vendorGstin || current?.vendorGstin || '').toUpperCase()
  };
}

const expensesController = createCrudController(expenseModel, {
  defaultOrder: 'expense_date DESC',
  onCreate: (body) => normalizeExpense(body, null),
  onUpdate: (body, req, current) => normalizeExpense(body, current)
});

module.exports = expensesController;
