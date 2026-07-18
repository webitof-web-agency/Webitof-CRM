const { createCrudController } = require('./crudController');
const expenseModel = require('../models/expense.model');
const masterItemModel = require('../models/masterItem.model');
const clientModel = require('../models/client.model');
const userModel = require('../models/user.model');
const { getSettings } = require('../models/settings.model');
const { round2, toNumber } = require('../utils/format');
const { notifyBusinessEvent } = require('../services/notification.service');

const EXPENSE_TYPE_DEFAULTS = {
  'Employee Salary': 'Employee',
  Reimbursement: 'Employee',
  'Vendor Bill': 'Vendor',
  Subscription: 'Vendor',
  Utility: 'Vendor',
  Travel: 'Other',
  'Asset / Capex': 'Vendor',
  'Statutory / Tax': 'Other',
  Other: 'Other'
};

function normalizeDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  return text ? text.slice(0, 10) : null;
}

async function resolvePayee(base = {}, expenseType = 'Vendor Bill', payeeType = 'Vendor') {
  const normalizedExpenseType = String(expenseType || 'Vendor Bill').trim();
  const normalizedPayeeType = String(payeeType || EXPENSE_TYPE_DEFAULTS[normalizedExpenseType] || 'Vendor').trim();
  const vendorId = base.vendorId || base.payeeId || null;
  const employeeId = base.employeeId || base.payeeId || null;
  const clientId = base.clientId || base.payeeId || null;

  if (normalizedPayeeType === 'Internal' || normalizedPayeeType === 'Other') {
    const payeeName = String(base.payeeName || base.vendor || '').trim();
    return {
      payeeId: base.payeeId || null,
      payeeName,
      vendorId: null,
      employeeId: null,
      clientId: null,
      vendor: payeeName
    };
  }

  if (normalizedPayeeType === 'Employee' || normalizedExpenseType === 'Employee Salary' || normalizedExpenseType === 'Reimbursement') {
    const employee = employeeId ? await userModel.findById(employeeId) : null;
    const payeeName = String(base.payeeName || employee?.fullName || employee?.username || employee?.email || '').trim();
    return {
      payeeId: base.payeeId || employee?.id || employeeId || null,
      payeeName,
      vendorId: base.vendorId || null,
      employeeId: employee?.id || employeeId || null,
      clientId,
      vendorGstin: base.vendorGstin || '',
      vendor: payeeName
    };
  }

  if (normalizedPayeeType === 'Client') {
    const client = clientId ? await clientModel.findById(clientId) : null;
    const payeeName = String(base.payeeName || client?.companyName || client?.name || '').trim();
    return {
      payeeId: base.payeeId || client?.id || clientId || null,
      payeeName,
      vendorId: base.vendorId || null,
      employeeId: base.employeeId || null,
      clientId: client?.id || clientId || null,
      vendorGstin: base.vendorGstin || '',
      vendor: payeeName
    };
  }

  const vendor = vendorId ? await masterItemModel.findOne('vendor', vendorId) : null;
  const payeeName = String(base.payeeName || vendor?.name || base.vendor || '').trim();
  return {
    payeeId: base.payeeId || vendor?.id || vendorId || null,
    payeeName,
    vendorId: vendor?.id || vendorId || null,
    employeeId: base.employeeId || null,
    clientId,
    vendorGstin: base.vendorGstin || '',
    vendor: payeeName
  };
}

async function normalizeExpense(body = {}, current = null) {
  const settings = (await getSettings()) || {};
  const base = current ? { ...current, ...body } : { ...body };
  const expenseType = String(base.expenseType || current?.expenseType || 'Vendor Bill').trim() || 'Vendor Bill';
  const payeeType = String(base.payeeType || current?.payeeType || EXPENSE_TYPE_DEFAULTS[expenseType] || 'Vendor').trim() || 'Vendor';
  const payee = await resolvePayee(base, expenseType, payeeType);
  const salaryUser = payee.employeeId ? await userModel.findById(payee.employeeId) : null;
  const salaryAmount = toNumber(salaryUser?.salary || 0);
  const amountBeforeGst = expenseType === 'Employee Salary'
    ? toNumber(base.amountBeforeGst || current?.amountBeforeGst || salaryAmount)
    : toNumber(base.amountBeforeGst ?? current?.amountBeforeGst ?? 0);
  const gstRate = expenseType === 'Employee Salary' ? 0 : toNumber(base.gstRate, settings?.gst?.defaultRate ?? 18);
  const gstAmount = expenseType === 'Employee Salary' ? 0 : round2(toNumber(base.gstAmount) || (amountBeforeGst * gstRate / 100));
  const totalAmount = round2(toNumber(base.totalAmount) || amountBeforeGst + gstAmount);
  const tdsRate = toNumber(base.tdsRate ?? current?.tdsRate ?? 0);
  const tdsAmount = round2(toNumber(base.tdsAmount) || (base.tdsApplicable ? totalAmount * tdsRate / 100 : 0));
  const paidAmount = round2(toNumber(base.paidAmount ?? current?.paidAmount ?? 0));
  const balanceDue = round2(Math.max(0, totalAmount - paidAmount));
  const periodStart = normalizeDate(base.periodStart || current?.periodStart);
  const periodEnd = normalizeDate(base.periodEnd || current?.periodEnd);
  const dueDate = normalizeDate(base.dueDate || current?.dueDate);
  const status = String(base.status || current?.status || (expenseType === 'Employee Salary' ? 'Approved' : 'Draft')).trim() || 'Draft';
  const approvalStatus = String(base.approvalStatus || current?.approvalStatus || (expenseType === 'Employee Salary' ? 'Approved' : 'Pending')).trim() || 'Pending';
  const paymentStatus = String(base.paymentStatus || current?.paymentStatus || (paidAmount > 0 ? (balanceDue > 0 ? 'Partially Paid' : 'Paid') : 'Unpaid')).trim() || 'Unpaid';
  const attachments = Array.isArray(base.attachments)
    ? base.attachments
    : Array.isArray(current?.attachments)
      ? current.attachments
      : [];

  return {
    ...base,
    expenseType,
    payeeType,
    payeeId: payee.payeeId,
    payeeName: payee.payeeName,
    vendor: payee.vendor,
    vendorId: payee.vendorId,
    employeeId: payee.employeeId,
    vendorGstin: String(base.vendorGstin || current?.vendorGstin || payee.vendorGstin || '').toUpperCase(),
    categoryId: base.categoryId || current?.categoryId || null,
    clientId: base.clientId || current?.clientId || null,
    projectId: base.projectId || current?.projectId || null,
    amountBeforeGst,
    gstRate,
    gstAmount,
    totalAmount,
    tdsApplicable: Boolean(base.tdsApplicable ?? current?.tdsApplicable),
    tdsSection: base.tdsSection || current?.tdsSection || '',
    tdsRate,
    tdsAmount,
    status,
    approvalStatus,
    paymentStatus,
    periodStart,
    periodEnd,
    dueDate,
    paidAmount,
    balanceDue,
    costCenter: base.costCenter || current?.costCenter || '',
    attachments
  };
}

const expensesController = createCrudController(expenseModel, {
  defaultOrder: 'expense_date DESC',
  onCreate: (body) => normalizeExpense(body, null),
  onUpdate: (body, req, current) => normalizeExpense(body, current)
});

expensesController.create = async (req, res, next) => {
  try {
    const body = await normalizeExpense(req.body || {}, null);
    const record = await expenseModel.create(body);
    notifyBusinessEvent({
      moduleName: 'expenses',
      eventKey: 'created',
      entity: record,
      title: 'Expense created',
      message: `${record.expenseType || 'Expense'} for ${record.payeeName || record.vendor || 'your business'} was created.`,
      actorUserId: req.user?.id || null,
      routePath: `/app/expenses/${record.id}`
    }).catch(() => {});
    res.status(201).json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
};

expensesController.update = async (req, res, next) => {
  try {
    const current = await expenseModel.findById(req.params.id);
    if (!current) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    const body = await normalizeExpense(req.body || {}, current);
    const record = await expenseModel.update(req.params.id, body);
    notifyBusinessEvent({
      moduleName: 'expenses',
      eventKey: 'updated',
      entity: record,
      title: 'Expense updated',
      message: `${record.expenseType || 'Expense'} for ${record.payeeName || record.vendor || 'your business'} was updated.`,
      actorUserId: req.user?.id || null,
      routePath: `/app/expenses/${record.id}`
    }).catch(() => {});
    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
};

expensesController.remove = async (req, res, next) => {
  try {
    const current = await expenseModel.findById(req.params.id);
    if (!current) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    const ok = await expenseModel.remove(req.params.id);
    if (!ok) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    notifyBusinessEvent({
      moduleName: 'expenses',
      eventKey: 'deleted',
      entity: current,
      title: 'Expense deleted',
      message: `${current.expenseType || 'Expense'} for ${current.payeeName || current.vendor || 'your business'} was deleted.`,
      severity: 'warning',
      actorUserId: req.user?.id || null
    }).catch(() => {});
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = expensesController;
