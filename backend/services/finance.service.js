const clientModel = require('../models/client.model');
const invoiceModel = require('../models/invoice.model');
const paymentModel = require('../models/payment.model');
const expenseModel = require('../models/expense.model');
const outsourcingModel = require('../models/outsourcingExpense.model');
const leadCommissionModel = require('../models/leadCommission.model');
const bankTransactionModel = require('../models/bankTransaction.model');
const { getSettings } = require('../models/settings.model');
const {
  calculateExpenseImpact,
  calculateInvoiceTotals,
  calculateLeadCommission,
  calculateOutsourcingExpense
} = require('../utils/finance');
const { getFinancialYear } = require('../utils/invoice');
const { round2, toNumber } = require('../utils/format');

function sumBy(items = [], iteratee = (item) => item) {
  return round2(items.reduce((sum, item) => sum + toNumber(iteratee(item)), 0));
}

function getActivePayrollUsers(state = {}) {
  return (state.users || []).filter((user) => user && user.isActive !== false && toNumber(user.salary) > 0);
}

function calculatePayrollExpense(user = {}) {
  return round2(toNumber(user.salary));
}

function normalizeDateValue(value) {
  if (!value) return '';
  const text = String(value);
  return text.includes('T') ? text.slice(0, 10) : text;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysUntil(dateString, fromDate = new Date()) {
  const target = parseDate(dateString);
  const base = parseDate(fromDate);
  if (!target || !base) return null;
  return Math.ceil((target - base) / (1000 * 60 * 60 * 24));
}

function getPaymentAppliedAmount(payment = {}) {
  return round2(toNumber(payment.amountReceived) + toNumber(payment.tdsDeducted));
}

function getInvoiceSnapshot(invoice = {}, payments = [], settings = {}, client = {}) {
  const totals = calculateInvoiceTotals(invoice, invoice.items || [], settings, client || {});
  const amountPaid = round2(sumBy(payments, getPaymentAppliedAmount));
  const balanceDue = round2(Math.max(0, totals.totalAmount - amountPaid));
  const paymentProgress = totals.totalAmount > 0 ? round2(Math.min(100, (amountPaid / totals.totalAmount) * 100)) : 0;
  const today = new Date();
  const overdueDays = invoice.dueDate ? daysUntil(invoice.dueDate, today) : null;
  const currentStatus = String(invoice.status || '').trim();
  let computedStatus = currentStatus || 'Sent';

  if (currentStatus !== 'Cancelled') {
    if (currentStatus === 'Draft') {
      computedStatus = amountPaid > 0 ? (balanceDue <= 0 ? 'Paid' : 'Partially Paid') : 'Draft';
    } else if (totals.totalAmount > 0 && balanceDue <= 0) {
      computedStatus = 'Paid';
    } else if (amountPaid > 0) {
      computedStatus = 'Partially Paid';
    } else if (overdueDays !== null && overdueDays < 0) {
      computedStatus = 'Overdue';
    } else if (!currentStatus) {
      computedStatus = 'Sent';
    }
  }

  return {
    ...invoice,
    ...totals,
    financialYear: getFinancialYear(invoice.invoiceDate || invoice.invoice_date || invoice.createdAt),
    storedStatus: currentStatus || 'Sent',
    amountPaid,
    balanceDue,
    paymentProgress,
    overdueDays: overdueDays == null ? null : Math.abs(Math.min(overdueDays, 0)),
    isOverdue: currentStatus !== 'Cancelled' && currentStatus !== 'Paid' && balanceDue > 0 && overdueDays !== null && overdueDays < 0,
    status: computedStatus,
    computedStatus
  };
}

function buildPaymentLedgerEntry(payment = {}, client = null, project = null, invoice = null) {
  const appliedAmount = getPaymentAppliedAmount(payment);
  return {
    id: payment.id,
    module: 'payments',
    entryType: 'receipt',
    direction: 'in',
    date: normalizeDateValue(payment.paymentDate || payment.createdAt),
    amount: appliedAmount,
    clientId: payment.clientId || client?.id || null,
    clientName: client?.companyName || client?.name || '-',
    projectId: payment.projectId || project?.id || null,
    projectName: project?.title || '-',
    invoiceId: payment.invoiceId || invoice?.id || null,
    invoiceNumber: invoice?.invoiceNumber || '-',
    bankAccountId: payment.bankAccountId || null,
    reference: payment.transactionId || payment.id,
    status: 'Posted',
    title: 'Payment received',
    notes: payment.notes || ''
  };
}

function buildInvoiceLedgerEntry(snapshot = {}, client = null, project = null) {
  return {
    id: snapshot.id,
    module: 'invoices',
    entryType: 'invoice',
    direction: 'in',
    date: normalizeDateValue(snapshot.invoiceDate || snapshot.createdAt),
    amount: snapshot.totalAmount,
    clientId: snapshot.clientId || client?.id || null,
    clientName: client?.companyName || client?.name || '-',
    projectId: snapshot.projectId || project?.id || null,
    projectName: project?.title || '-',
    invoiceId: snapshot.id,
    invoiceNumber: snapshot.invoiceNumber || '-',
    financialYear: snapshot.financialYear || getFinancialYear(snapshot.invoiceDate || snapshot.createdAt),
    status: snapshot.computedStatus || snapshot.status || 'Sent',
    title: 'Invoice issued',
    notes: snapshot.notes || '',
    balanceDue: snapshot.balanceDue,
    amountPaid: snapshot.amountPaid,
    paymentProgress: snapshot.paymentProgress
  };
}

function buildExpenseLedgerEntry(expense = {}, client = null, project = null) {
  const impact = calculateExpenseImpact(expense);
  return {
    id: expense.id,
    module: 'expenses',
    entryType: 'expense',
    direction: 'out',
    date: normalizeDateValue(expense.expenseDate || expense.createdAt),
    amount: impact.totalCashOut,
    clientId: expense.clientId || client?.id || null,
    clientName: client?.companyName || client?.name || '-',
    projectId: expense.projectId || project?.id || null,
    projectName: project?.title || '-',
    status: 'Posted',
    title: 'Expense booked',
    notes: expense.notes || expense.vendor || '',
    payable: impact.totalCashOut,
    inputGst: impact.inputGst,
    itcEligible: Boolean(expense.itcEligible)
  };
}

function buildPayrollLedgerEntry(user = {}) {
  const amount = calculatePayrollExpense(user);
  if (!amount) return null;
  return {
    id: `payroll-${user.id}`,
    module: 'payroll',
    entryType: 'salary',
    direction: 'out',
    date: normalizeDateValue(user.lastLoginAt || user.createdAt || new Date().toISOString()),
    amount,
    clientId: null,
    clientName: '-',
    projectId: null,
    projectName: '-',
    status: 'Pending',
    title: 'Salary payable',
    notes: `Monthly salary for ${user.fullName || user.username || user.email || 'employee'}`,
    payable: amount,
    employeeId: user.id,
    employeeName: user.fullName || user.username || user.email || '-'
  };
}

function buildOutsourcingLedgerEntry(expense = {}, client = null, project = null, vendor = null, settings = {}) {
  const impact = calculateOutsourcingExpense(expense, vendor || {}, settings || {});
  return {
    id: expense.id,
    module: 'outsourcing',
    entryType: 'payable',
    direction: 'out',
    date: normalizeDateValue(expense.expenseDate || expense.createdAt),
    amount: impact.totalAmount,
    clientId: expense.clientId || client?.id || null,
    clientName: client?.companyName || client?.name || '-',
    projectId: expense.projectId || project?.id || null,
    projectName: project?.title || '-',
    vendorId: expense.vendorId || vendor?.id || null,
    vendorName: expense.vendorName || vendor?.name || '-',
    status: expense.paymentStatus || 'Pending',
    title: 'Outsourcing payable',
    notes: expense.notes || expense.description || '',
    payable: impact.totalAmount,
    inputGst: impact.inputGst,
    itcEligible: Boolean(impact.itcEligible)
  };
}

function buildCommissionLedgerEntry(commission = {}, client = null, project = null, partner = null, settings = {}) {
  const impact = calculateLeadCommission(commission, partner || {}, settings || {});
  return {
    id: commission.id,
    module: 'lead-commissions',
    entryType: 'payable',
    direction: 'out',
    date: normalizeDateValue(commission.commissionDate || commission.createdAt),
    amount: impact.netPayable,
    clientId: commission.clientId || client?.id || null,
    clientName: client?.companyName || client?.name || '-',
    projectId: commission.projectId || project?.id || null,
    projectName: project?.title || '-',
    partnerId: commission.partnerId || partner?.id || null,
    partnerName: commission.partnerName || partner?.name || '-',
    status: commission.paymentStatus || 'Pending',
    title: 'Lead commission payable',
    notes: commission.notes || '',
    payable: impact.netPayable,
    inputGst: impact.inputGst,
    tdsAmount: impact.tdsAmount
  };
}

function buildBankTransactionLedgerEntry(transaction = {}, client = null, project = null, invoice = null, expense = null) {
  return {
    id: transaction.id,
    module: 'banking',
    entryType: 'bank-transaction',
    direction: String(transaction.transactionType || '').toLowerCase() === 'debit' ? 'out' : 'in',
    date: normalizeDateValue(transaction.date || transaction.createdAt),
    amount: toNumber(transaction.amount),
    clientId: transaction.linkedClientId || client?.id || null,
    clientName: client?.companyName || client?.name || '-',
    projectId: transaction.linkedProjectId || project?.id || null,
    projectName: project?.title || '-',
    invoiceId: transaction.linkedInvoiceId || invoice?.id || null,
    invoiceNumber: invoice?.invoiceNumber || '-',
    expenseId: transaction.linkedExpenseId || expense?.id || null,
    expenseVendor: expense?.vendor || expense?.vendorName || '-',
    bankAccountId: transaction.bankAccountId || null,
    reference: transaction.id,
    status: transaction.transactionType || 'Adjustment',
    title: 'Bank transaction',
    notes: transaction.notes || ''
  };
}

function buildFinanceSummary(state = {}) {
  const settings = state.settings || {};
  const clientById = new Map((state.clients || []).map((client) => [String(client.id), client]));
  const projectById = new Map((state.projects || []).map((project) => [String(project.id), project]));
  const vendorById = new Map((state.vendors || []).map((vendor) => [String(vendor.id), vendor]));

  const invoiceSnapshots = (state.invoices || [])
    .filter((invoice) => invoice.status !== 'Cancelled')
    .map((invoice) => getInvoiceSnapshot(invoice, (state.payments || []).filter((payment) => String(payment.invoiceId) === String(invoice.id)), settings, clientById.get(String(invoice.clientId)) || {}));

  const expenseImpacts = (state.expenses || []).map(calculateExpenseImpact);
  const outsourcingImpacts = (state.outsourcingExpenses || []).map((item) => calculateOutsourcingExpense(item, vendorById.get(String(item.vendorId)) || {}, settings));
  const commissionImpacts = (state.leadCommissions || []).map((item) => calculateLeadCommission(item, vendorById.get(String(item.partnerId)) || {}, settings));
  const payrollUsers = getActivePayrollUsers(state);
  const payrollExpense = sumBy(payrollUsers, calculatePayrollExpense);
  const bankTransactionCredits = (state.bankTransactions || []).filter((item) => String(item.transactionType || '').toLowerCase() !== 'debit').reduce((sum, item) => sum + toNumber(item.amount), 0);
  const bankTransactionDebits = (state.bankTransactions || []).filter((item) => String(item.transactionType || '').toLowerCase() === 'debit').reduce((sum, item) => sum + toNumber(item.amount), 0);

  const totalReceived = sumBy(state.payments || [], getPaymentAppliedAmount);
  const totalOutstanding = sumBy(invoiceSnapshots, (item) => item.balanceDue);
  const totalExpense = sumBy(expenseImpacts, (item) => item.expenseAmount);
  const totalOutsourcingPayable = sumBy(outsourcingImpacts, (item) => item.totalAmount);
  const totalCommissionPayable = sumBy(commissionImpacts, (item) => item.netPayable);
  const totalPayables = round2(totalExpense + totalOutsourcingPayable + totalCommissionPayable + payrollExpense);
  const cashInBank = round2((state.bankAccounts || []).reduce((sum, account) => sum + toNumber(account.openingBalance), 0) + bankTransactionCredits - bankTransactionDebits);

  return {
    totalInvoices: (state.invoices || []).length,
    totalInvoiceAmount: sumBy(invoiceSnapshots, (item) => item.totalAmount),
    totalTaxableAmount: sumBy(invoiceSnapshots, (item) => item.taxableAmount),
    totalReceived,
    totalOutstanding,
    totalOverdueOutstanding: sumBy(invoiceSnapshots.filter((item) => item.isOverdue), (item) => item.balanceDue),
    totalExpenses: totalExpense,
    totalPayrollExpense: payrollExpense,
    totalOutsourcingPayable,
    totalCommissionPayable,
    totalPayables,
    officeExpense: round2(totalExpense + payrollExpense),
    cashInBank,
    totalReceivables: round2(totalOutstanding),
    netCashFlow: round2(totalReceived - totalPayables),
    paymentCount: (state.payments || []).length,
    overdueInvoiceCount: invoiceSnapshots.filter((item) => item.isOverdue).length,
    partialPaymentCount: invoiceSnapshots.filter((item) => item.computedStatus === 'Partially Paid').length,
    paidInvoiceCount: invoiceSnapshots.filter((item) => item.computedStatus === 'Paid').length,
    unreconciledBankTransactions: (state.bankTransactions || []).filter((transaction) => !transaction.linkedInvoiceId && !transaction.linkedExpenseId).length,
    bankCredits: round2(bankTransactionCredits),
    bankDebits: round2(bankTransactionDebits),
    payrollUsers: payrollUsers.length,
    averageSalary: payrollUsers.length ? round2(payrollExpense / payrollUsers.length) : 0
  };
}

function buildFinanceLedger(state = {}, filters = {}) {
  const settings = state.settings || {};
  const clientById = new Map((state.clients || []).map((client) => [String(client.id), client]));
  const projectById = new Map((state.projects || []).map((project) => [String(project.id), project]));
  const invoiceById = new Map((state.invoices || []).map((invoice) => [String(invoice.id), invoice]));
  const expenseById = new Map((state.expenses || []).map((expense) => [String(expense.id), expense]));
  const vendorById = new Map((state.vendors || []).map((vendor) => [String(vendor.id), vendor]));
  const paymentsByInvoiceId = new Map();

  (state.payments || []).forEach((payment) => {
    const key = String(payment.invoiceId || '');
    if (!paymentsByInvoiceId.has(key)) paymentsByInvoiceId.set(key, []);
    paymentsByInvoiceId.get(key).push(payment);
  });

  const entries = [
    ...(state.invoices || [])
      .filter((invoice) => invoice.status !== 'Cancelled')
      .map((invoice) => getInvoiceSnapshot(invoice, paymentsByInvoiceId.get(String(invoice.id)) || [], settings, clientById.get(String(invoice.clientId)) || {}))
      .map((snapshot) => buildInvoiceLedgerEntry(snapshot, clientById.get(String(snapshot.clientId)) || null, projectById.get(String(snapshot.projectId)) || null)),
    ...(state.payments || []).map((payment) => buildPaymentLedgerEntry(
      payment,
      clientById.get(String(payment.clientId)) || null,
      projectById.get(String(payment.projectId)) || null,
      invoiceById.get(String(payment.invoiceId)) || null
    )),
    ...(state.expenses || []).map((expense) => buildExpenseLedgerEntry(
      expense,
      clientById.get(String(expense.clientId)) || null,
      projectById.get(String(expense.projectId)) || null
    )),
    ...(state.outsourcingExpenses || []).map((expense) => buildOutsourcingLedgerEntry(
      expense,
      clientById.get(String(expense.clientId)) || null,
      projectById.get(String(expense.projectId)) || null,
      vendorById.get(String(expense.vendorId)) || null,
      settings
    )),
    ...(state.leadCommissions || []).map((commission) => buildCommissionLedgerEntry(
      commission,
      clientById.get(String(commission.clientId)) || null,
      projectById.get(String(commission.projectId)) || null,
      vendorById.get(String(commission.partnerId)) || null,
      settings
    )),
    ...(state.users || []).map((user) => buildPayrollLedgerEntry(user)).filter(Boolean),
    ...(state.bankTransactions || []).map((transaction) => buildBankTransactionLedgerEntry(
      transaction,
      clientById.get(String(transaction.linkedClientId)) || null,
      projectById.get(String(transaction.linkedProjectId)) || null,
      invoiceById.get(String(transaction.linkedInvoiceId)) || null,
      expenseById.get(String(transaction.linkedExpenseId)) || null
    ))
  ].filter((entry) => entry.date);

  const normalizedFilters = {
    type: String(filters.type || filters.entryType || '').trim().toLowerCase(),
    module: String(filters.module || '').trim().toLowerCase(),
    clientId: String(filters.clientId || '').trim(),
    projectId: String(filters.projectId || '').trim(),
    invoiceId: String(filters.invoiceId || '').trim(),
    bankAccountId: String(filters.bankAccountId || '').trim(),
    status: String(filters.status || '').trim().toLowerCase(),
    from: filters.from || filters.startDate || '',
    to: filters.to || filters.endDate || ''
  };

  const filtered = entries.filter((entry) => {
    if (normalizedFilters.type && String(entry.entryType || '').toLowerCase() !== normalizedFilters.type) return false;
    if (normalizedFilters.module && String(entry.module || '').toLowerCase() !== normalizedFilters.module) return false;
    if (normalizedFilters.clientId && String(entry.clientId || '') !== normalizedFilters.clientId) return false;
    if (normalizedFilters.projectId && String(entry.projectId || '') !== normalizedFilters.projectId) return false;
    if (normalizedFilters.invoiceId && String(entry.invoiceId || '') !== normalizedFilters.invoiceId) return false;
    if (normalizedFilters.bankAccountId && String(entry.bankAccountId || '') !== normalizedFilters.bankAccountId) return false;
    if (normalizedFilters.status && String(entry.status || '').toLowerCase() !== normalizedFilters.status) return false;
    if (normalizedFilters.from && entry.date < normalizeDateValue(normalizedFilters.from)) return false;
    if (normalizedFilters.to && entry.date > normalizeDateValue(normalizedFilters.to)) return false;
    return true;
  });

  const searchText = String(filters.search || filters.q || '').trim().toLowerCase();
  const searched = searchText
    ? filtered.filter((entry) => {
        const haystack = [
          entry.title,
          entry.notes,
          entry.clientName,
          entry.projectName,
          entry.invoiceNumber,
          entry.vendorName,
          entry.partnerName,
          entry.employeeName,
          entry.reference,
          entry.status,
          entry.module,
          entry.entryType
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(searchText);
      })
    : filtered;

  const sorted = [...searched].sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id || '').localeCompare(String(a.id || '')));

  return {
    entries: sorted,
    totals: {
      totalIn: sumBy(sorted.filter((item) => item.direction === 'in'), (item) => item.amount),
      totalOut: sumBy(sorted.filter((item) => item.direction === 'out'), (item) => item.amount),
      net: round2(sumBy(sorted.filter((item) => item.direction === 'in'), (item) => item.amount) - sumBy(sorted.filter((item) => item.direction === 'out'), (item) => item.amount)),
      invoices: sorted.filter((item) => item.module === 'invoices').length,
      payments: sorted.filter((item) => item.module === 'payments').length,
      expenses: sorted.filter((item) => item.module === 'expenses').length,
      payroll: sorted.filter((item) => item.module === 'payroll').length,
      outsourcing: sorted.filter((item) => item.module === 'outsourcing').length,
      commissions: sorted.filter((item) => item.module === 'lead-commissions').length,
      bankTransactions: sorted.filter((item) => item.module === 'banking').length
    }
  };
}

function buildBankReconciliation(state = {}, filters = {}) {
  const clientById = new Map((state.clients || []).map((client) => [String(client.id), client]));
  const projectById = new Map((state.projects || []).map((project) => [String(project.id), project]));
  const invoiceById = new Map((state.invoices || []).map((invoice) => [String(invoice.id), invoice]));
  const expenseById = new Map((state.expenses || []).map((expense) => [String(expense.id), expense]));

  const entries = (state.bankTransactions || []).map((transaction) => {
    const invoice = transaction.linkedInvoiceId ? invoiceById.get(String(transaction.linkedInvoiceId)) || null : null;
    const expense = transaction.linkedExpenseId ? expenseById.get(String(transaction.linkedExpenseId)) || null : null;
    const client = transaction.linkedClientId ? clientById.get(String(transaction.linkedClientId)) || null : null;
    const project = transaction.linkedProjectId ? projectById.get(String(transaction.linkedProjectId)) || null : null;
    const matchStatus = transaction.linkedInvoiceId || transaction.linkedExpenseId
      ? 'matched'
      : transaction.linkedClientId || transaction.linkedProjectId
        ? 'suggested'
        : 'unmatched';

    return {
      id: transaction.id,
      date: normalizeDateValue(transaction.date || transaction.createdAt),
      bankAccountId: transaction.bankAccountId || null,
      transactionType: transaction.transactionType || 'Adjustment',
      amount: toNumber(transaction.amount),
      matchStatus,
      clientId: transaction.linkedClientId || client?.id || null,
      clientName: client?.companyName || client?.name || '-',
      projectId: transaction.linkedProjectId || project?.id || null,
      projectName: project?.title || '-',
      invoiceId: transaction.linkedInvoiceId || invoice?.id || null,
      invoiceNumber: invoice?.invoiceNumber || '-',
      expenseId: transaction.linkedExpenseId || expense?.id || null,
      expenseVendor: expense?.vendor || expense?.vendorName || '-',
      notes: transaction.notes || ''
    };
  });

  const filtered = entries.filter((entry) => {
    if (filters.bankAccountId && String(entry.bankAccountId || '') !== String(filters.bankAccountId)) return false;
    if (filters.matchStatus && String(entry.matchStatus || '').toLowerCase() !== String(filters.matchStatus).toLowerCase()) return false;
    if (filters.clientId && String(entry.clientId || '') !== String(filters.clientId)) return false;
    if (filters.projectId && String(entry.projectId || '') !== String(filters.projectId)) return false;
    if (filters.from && entry.date < normalizeDateValue(filters.from)) return false;
    if (filters.to && entry.date > normalizeDateValue(filters.to)) return false;
    return true;
  });

  const searchText = String(filters.search || filters.q || '').trim().toLowerCase();
  const searched = searchText
    ? filtered.filter((entry) => {
        const haystack = [
          entry.clientName,
          entry.projectName,
          entry.invoiceNumber,
          entry.expenseVendor,
          entry.notes,
          entry.transactionType,
          entry.matchStatus
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(searchText);
      })
    : filtered;

  const sorted = [...searched].sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id || '').localeCompare(String(a.id || '')));

  return {
    entries: sorted,
    summary: {
      total: sorted.length,
      matched: sorted.filter((item) => item.matchStatus === 'matched').length,
      suggested: sorted.filter((item) => item.matchStatus === 'suggested').length,
      unmatched: sorted.filter((item) => item.matchStatus === 'unmatched').length,
      matchedAmount: sumBy(sorted.filter((item) => item.matchStatus === 'matched'), (item) => item.amount),
      unmatchedAmount: sumBy(sorted.filter((item) => item.matchStatus === 'unmatched'), (item) => item.amount)
    }
  };
}

async function syncInvoiceFinancialState(invoiceId, dbClient = null) {
  if (!invoiceId) return null;
  const exec = dbClient?.query || null;
  const [invoiceResult, paymentResult, settingsResult] = await Promise.all([
    invoiceModel.findById(invoiceId, dbClient),
    exec
      ? exec.call(dbClient, 'select * from payments where invoice_id = $1 order by payment_date asc, created_at asc', [invoiceId])
      : paymentModel.list({ where: { invoiceId } }),
    getSettings()
  ]);

  const invoice = invoiceResult;
  if (!invoice) return null;

  const payments = Array.isArray(paymentResult?.rows)
    ? paymentResult.rows.map((row) => paymentModel.hydrateRow(row))
    : Array.isArray(paymentResult)
      ? paymentResult
      : [];

  const client = exec
    ? await clientModel.findById(invoice.clientId, dbClient)
    : (settingsResult && invoice.clientId ? await clientModel.findById(invoice.clientId) : null);
  const snapshot = getInvoiceSnapshot(invoice, payments, settingsResult || {}, client || {});
  const desiredStatus = snapshot.computedStatus || invoice.status;
  if (String(invoice.status || '') !== String(desiredStatus || '')) {
    await invoiceModel.update(invoiceId, { status: desiredStatus }, dbClient);
  }

  return {
    ...snapshot,
    status: desiredStatus
  };
}

module.exports = {
  buildBankReconciliation,
  buildFinanceLedger,
  buildFinanceSummary,
  buildPaymentLedgerEntry,
  buildInvoiceLedgerEntry,
  getInvoiceSnapshot,
  getPaymentAppliedAmount,
  calculatePayrollExpense,
  syncInvoiceFinancialState
};
