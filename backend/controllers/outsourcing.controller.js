const { createCrudController } = require('./crudController');
const outsourcingModel = require('../models/outsourcingExpense.model');
const masterItemModel = require('../models/masterItem.model');
const { getSettings } = require('../models/settings.model');
const { calculateOutsourcingExpense } = require('../utils/finance');
const { round2, toNumber } = require('../utils/format');

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
    paymentStatus: base.paymentStatus || current?.paymentStatus || 'Pending'
  };
}

const outsourcingController = createCrudController(outsourcingModel, {
  defaultOrder: 'expense_date DESC',
  onCreate: (body) => normalizeOutsourcing(body, null),
  onUpdate: (body, req, current) => normalizeOutsourcing(body, current)
});

module.exports = outsourcingController;
