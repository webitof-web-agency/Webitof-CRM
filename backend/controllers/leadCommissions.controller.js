const { createCrudController } = require('./crudController');
const leadCommissionModel = require('../models/leadCommission.model');
const masterItemModel = require('../models/masterItem.model');
const { getSettings } = require('../models/settings.model');
const { calculateLeadCommission } = require('../utils/finance');
const { round2, toNumber } = require('../utils/format');

async function normalizeCommission(body = {}, current = null) {
  const settings = (await getSettings()) || {};
  const base = current ? { ...current, ...body } : { ...body };
  const partner = base.partnerId ? await masterItemModel.findOne('vendor', base.partnerId) : null;
  const commissionBaseAmount = round2(toNumber(base.commissionBaseAmount || current?.commissionBaseAmount));
  const calculated = calculateLeadCommission({ ...base, commissionBaseAmount }, partner || {}, settings);

  return {
    ...base,
    commissionDate: base.commissionDate || current?.commissionDate || new Date().toISOString().slice(0, 10),
    partnerId: base.partnerId || partner?.id || current?.partnerId || null,
    partnerName: base.partnerName || partner?.name || current?.partnerName || '',
    clientId: base.clientId || current?.clientId || null,
    projectId: base.projectId || current?.projectId || null,
    commissionType: calculated.commissionType,
    commissionPercentage: calculated.commissionPercentage,
    commissionBaseAmount: calculated.commissionBaseAmount,
    commissionAmount: calculated.commissionAmount,
    gstRegistered: calculated.gstRegistered,
    gstRate: calculated.gstRate,
    gstAmount: calculated.gstAmount,
    grossPayable: calculated.grossPayable,
    tdsApplicable: calculated.tdsApplicable,
    tdsSection: calculated.tdsSection,
    tdsRate: calculated.tdsRate,
    tdsAmount: calculated.tdsAmount,
    netPayable: calculated.netPayable,
    paymentStatus: base.paymentStatus || current?.paymentStatus || 'Pending',
    tdsDepositStatus: base.tdsDepositStatus || current?.tdsDepositStatus || 'Not Deposited'
  };
}

const leadCommissionsController = createCrudController(leadCommissionModel, {
  defaultOrder: 'commission_date DESC',
  onCreate: (body) => normalizeCommission(body, null),
  onUpdate: (body, req, current) => normalizeCommission(body, current)
});

module.exports = leadCommissionsController;
