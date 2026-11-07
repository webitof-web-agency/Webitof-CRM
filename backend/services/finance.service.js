const clientModel = require('../models/client.model');
const invoiceModel = require('../models/invoice.model');
const paymentModel = require('../models/payment.model');
const creditNoteModel = require('../models/creditNote.model');
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
const { businessDate, round2, toNumber } = require('../utils/format');

function sumBy(items = [], iteratee = (item) => item) {
  return round2(items.reduce((sum, item) => sum + toNumber(iteratee(item)), 0));
}

function getActivePayrollUsers(state = {}) {
  return (state.users || []).filter((user) => user && user.isActive !== false && toNumber(user.salary) > 0);
}

function calculatePayrollExpense(user = {}) {
  return round2(toNumber(user.salary));
}

function isSalaryExpenseRecord(expense = {}) {
  return String(expense.expenseType || expense.expense_type || '').trim() === 'Employee Salary';
}

function buildPayrollRecordFromUser(user = {}) {
  const amount = calculatePayrollExpense(user);
  if (!amount) return null;
  return {
    id: `payroll-${user.id}`,
    date: normalizeDateValue(new Date().toISOString()),
    employeeId: user.id,
    employeeName: user.fullName || user.username || user.email || '-',
    roleName: (user.roles || []).map((role) => role.name).filter(Boolean).join(', ') || '-',
    amount,
    payable: amount,
    paymentStatus: 'Pending',
    notes: `Monthly salary for ${user.fullName || user.username || user.email || 'employee'}`,
    source: 'user'
  };
}

function buildPayrollRecordFromExpense(expense = {}) {
  const amount = round2(toNumber(expense.totalAmount || expense.amountBeforeGst || expense.balanceDue || expense.paidAmount || 0));
  if (!amount) return null;
  return {
    id: expense.id,
    date: normalizeDateValue(expense.periodEnd || expense.periodStart || expense.dueDate || expense.expenseDate || expense.createdAt),
    employeeId: expense.employeeId || expense.payeeId || null,
    employeeName: expense.payeeName || expense.vendor || 'Employee',
    roleName: expense.costCenter || '-',
    amount,
    payable: round2(toNumber(expense.balanceDue || amount)),
    paymentStatus: expense.paymentStatus || expense.status || 'Pending',
    notes: expense.notes || `Salary expense for ${expense.payeeName || expense.vendor || 'employee'}`,
    status: expense.status || 'Approved',
    source: 'expense'
  };
}

function getPayrollRecords(state = {}) {
  const salaryExpenses = (state.expenses || []).filter(isSalaryExpenseRecord);
  if (salaryExpenses.length) {
    return salaryExpenses.map(buildPayrollRecordFromExpense).filter(Boolean);
  }

  return (state.users || [])
    .filter((user) => user && user.isActive !== false && toNumber(user.salary) > 0)
    .map(buildPayrollRecordFromUser)
    .filter(Boolean);
}

function getPayrollExpenseTotal(state = {}) {
  return sumBy(getPayrollRecords(state), (record) => record.amount);
}

function getPayrollRecordCount(state = {}) {
  return getPayrollRecords(state).length;
}

function normalizeDateValue(value) {
  if (!value) return '';
  const text = String(value);
  // Ensure we have a valid Date string, but do not slice it
  return text;
}

function getDateOnly(value) {
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

// Only money that actually landed counts against an invoice. Bounced, Reversed, Refunded
// and still-uncleared payments are recorded for history but must not reduce the balance due.
const COUNTED_PAYMENT_STATUSES = new Set(['received', 'cleared']);

function isPaymentCounted(payment = {}) {
  const status = String(payment.paymentStatus || '').trim().toLowerCase();
  return !status || COUNTED_PAYMENT_STATUSES.has(status);
}

function getPaymentAppliedAmount(payment = {}) {
  if (!isPaymentCounted(payment)) return 0;
  return round2(toNumber(payment.amountReceived) + toNumber(payment.tdsDeducted));
}

// Money that actually reached the bank. TDS the client withheld settles the invoice (getPaymentAppliedAmount)
// but was paid to the government, so it is not cash and must not count towards cash flow.
function getPaymentCashAmount(payment = {}) {
  return isPaymentCounted(payment) ? round2(toNumber(payment.amountReceived)) : 0;
}

function getPaymentTdsAmount(payment = {}) {
  return isPaymentCounted(payment) ? round2(toNumber(payment.tdsDeducted)) : 0;
}

// ---- credit notes ------------------------------------------------------------------------------------------
// A credit note reduces what the client owes on an issued invoice. It counts while Issued; cancelling it restores
// the balance. The invoice is never edited.
const isIssuedCreditNote = (note = {}) => String(note.status || 'Issued').trim() === 'Issued';

function groupCreditNotesByInvoice(notes = []) {
  const map = new Map();
  for (const note of notes || []) {
    if (!isIssuedCreditNote(note) || !note.invoiceId) continue;
    const key = String(note.invoiceId);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(note);
  }
  return map;
}

// What a credit note against this invoice can be worth at most: its taxable value plus GST (before any advance
// that was deducted from the amount due).
function getInvoiceCreditCapacity(invoice = {}, settings = {}, client = {}) {
  const totals = calculateInvoiceTotals(invoice, invoice.items || [], settings, client || {});
  return round2(toNumber(totals.taxableAmount) + toNumber(totals.gstAmount));
}

// Totals for a credit note. With no items it credits the whole invoice; with items they are priced and taxed
// exactly like invoice lines, using the invoice's own tax treatment (GST type, place of supply, inclusive/exclusive).
function calculateCreditNoteTotals(invoice = {}, settings = {}, client = {}, items = null) {
  const source = items
    ? { amountType: invoice.amountType, placeOfSupply: invoice.placeOfSupply, invoiceType: invoice.invoiceType, items }
    : invoice;
  const totals = calculateInvoiceTotals(source, source.items || [], settings, client || {});
  const taxableAmount = round2(toNumber(totals.taxableAmount));
  const gstAmount = round2(toNumber(totals.gstAmount));
  return {
    items: totals.items || [],
    taxableAmount,
    cgst: round2(toNumber(totals.cgst)),
    sgst: round2(toNumber(totals.sgst)),
    utgst: round2(toNumber(totals.utgst)),
    igst: round2(toNumber(totals.igst)),
    gstAmount,
    totalAmount: round2(taxableAmount + gstAmount)
  };
}

async function loadCreditNotesForInvoice(invoiceId, dbClient = null) {
  if (!invoiceId) return [];
  const exec = dbClient?.query || null;
  if (exec) {
    const result = await exec.call(dbClient, "select * from credit_notes where invoice_id = $1 and status = 'Issued'", [invoiceId]);
    return (result?.rows || []).map((row) => creditNoteModel.hydrateRow(row));
  }
  return creditNoteModel.list({ where: { invoiceId, status: 'Issued' } });
}

function getInvoiceSnapshot(invoice = {}, payments = [], settings = {}, client = {}, creditNotes = []) {
  const totals = calculateInvoiceTotals(invoice, invoice.items || [], settings, client || {});
  const amountPaid = round2(sumBy(payments, getPaymentAppliedAmount));
  const creditTotal = round2(sumBy((creditNotes || []).filter(isIssuedCreditNote), (note) => note.totalAmount));
  const balanceDue = round2(Math.max(0, totals.totalAmount - amountPaid - creditTotal));
  // Paid plus credited more than the invoice is worth: the client is owed the difference back.
  const refundDue = round2(Math.max(0, amountPaid + creditTotal - totals.totalAmount));
  const paymentProgress = totals.totalAmount > 0 ? round2(Math.min(100, (amountPaid / totals.totalAmount) * 100)) : 0;
  // Whole days against today's IST calendar date: due today is 0, due yesterday is -1.
  const overdueDays = invoice.dueDate ? daysUntil(getDateOnly(invoice.dueDate), businessDate()) : null;
  const currentStatus = String(invoice.status || '').trim();
  let computedStatus = currentStatus || 'Sent';

  if (currentStatus !== 'Cancelled') {
    if (currentStatus === 'Draft') {
      computedStatus = amountPaid > 0 ? (balanceDue <= 0 ? 'Paid' : 'Partially Paid') : 'Draft';
    } else if (totals.totalAmount > 0 && balanceDue <= 0) {
      // Settled with money: Paid. Settled only by credit notes (nothing received): Credited.
      computedStatus = amountPaid <= 0 && creditTotal > 0 ? 'Credited' : 'Paid';
    } else if (amountPaid > 0) {
      computedStatus = 'Partially Paid';
    } else if (overdueDays !== null && overdueDays < 0) {
      computedStatus = 'Overdue';
    } else if (!currentStatus || ['Paid', 'Partially Paid', 'Overdue', 'Credited'].includes(currentStatus)) {
      // Payments were removed or the due date moved: fall back to an open invoice.
      computedStatus = 'Sent';
    }
  }

  return {
    ...invoice,
    ...totals,
    financialYear: getFinancialYear(invoice.invoiceDate || invoice.invoice_date || invoice.createdAt),
    storedStatus: currentStatus || 'Sent',
    amountPaid,
    creditTotal,
    refundDue,
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
  const cashAmount = getPaymentCashAmount(payment);
  return {
    id: payment.id,
    module: 'payments',
    entryType: 'receipt',
    direction: 'in',
    date: normalizeDateValue(payment.paymentDate || payment.createdAt),
    // The ledger is a cash view: what reached the bank. The TDS withheld is shown beside it.
    amount: cashAmount,
    tdsDeducted: getPaymentTdsAmount(payment),
    appliedAmount,
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
  if (isSalaryExpenseRecord(expense)) {
    const amount = round2(toNumber(expense.totalAmount || expense.amountBeforeGst || expense.balanceDue || expense.paidAmount || 0));
    return {
      id: expense.id,
      module: 'payroll',
      entryType: 'salary',
      direction: 'out',
      date: normalizeDateValue(expense.periodEnd || expense.periodStart || expense.dueDate || expense.expenseDate || expense.createdAt),
      amount,
      clientId: expense.clientId || client?.id || null,
      clientName: client?.companyName || client?.name || '-',
      projectId: expense.projectId || project?.id || null,
      projectName: project?.title || '-',
      status: expense.status || expense.paymentStatus || 'Scheduled',
      title: 'Salary expense',
      notes: expense.notes || expense.payeeName || expense.vendor || '',
      payable: round2(toNumber(expense.balanceDue || amount)),
      employeeId: expense.employeeId || expense.payeeId || null,
      employeeName: expense.payeeName || expense.vendor || '-',
      paymentStatus: expense.paymentStatus || 'Unpaid',
      expenseType: expense.expenseType || 'Employee Salary'
    };
  }

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

function buildPayrollLedgerEntry(record = {}) {
  const amount = round2(toNumber(record.amount));
  if (!amount) return null;
  return {
    id: record.id,
    module: 'payroll',
    entryType: 'salary',
    direction: 'out',
    date: normalizeDateValue(record.date || new Date().toISOString()),
    amount,
    clientId: null,
    clientName: '-',
    projectId: null,
    projectName: '-',
    status: record.status || record.paymentStatus || 'Pending',
    title: 'Salary payable',
    notes: record.notes || `Monthly salary for ${record.employeeName || 'employee'}`,
    payable: round2(toNumber(record.payable || amount)),
    employeeId: record.employeeId || null,
    employeeName: record.employeeName || '-',
    roleName: record.roleName || '-',
    paymentStatus: record.paymentStatus || 'Pending',
    source: record.source || 'user'
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

// Only Credit and Debit move money in or out. Transfers (between our own accounts) and Adjustments have no
// reliable direction, so they are listed in the ledger but kept out of cash totals.
const bankTypeOf = (transaction = {}) => String(transaction.transactionType || '').trim().toLowerCase();
const isCashBankType = (transaction = {}) => ['credit', 'debit'].includes(bankTypeOf(transaction));

function buildBankTransactionLedgerEntry(transaction = {}, client = null, project = null, invoice = null, expense = null) {
  return {
    neutral: !isCashBankType(transaction),
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

// A Draft has not been issued to the client and a Cancelled invoice no longer counts: neither is revenue,
// output GST or a receivable. Every report and dashboard uses this one test.
const isIssuedInvoice = (invoice = {}) => !['Cancelled', 'Draft'].includes(String(invoice.status || '').trim());

// ---- reporting period -------------------------------------------------------------------------------------
// P&L and GST are filed per month or per financial year (April to March), so reports take a period. Dates are
// plain Indian calendar dates (YYYY-MM-DD); nothing here goes through UTC.
const REPORT_DATE_FIELDS = {
  invoices: ['invoiceDate', 'createdAt'],
  expenses: ['expenseDate', 'createdAt'],
  outsourcingExpenses: ['expenseDate', 'createdAt'],
  leadCommissions: ['commissionDate', 'createdAt'],
  payments: ['paymentDate', 'createdAt'],
  creditNotes: ['issueDate', 'createdAt']
};

function reportPeriodError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

const isCalendarDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const lastDayOfMonth = (year, month) => new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

// Financial year that contains a YYYY-MM-DD date: 1 April to 31 March.
function financialYearBounds(dateString) {
  const year = Number(dateString.slice(0, 4));
  const month = Number(dateString.slice(5, 7));
  const startYear = month >= 4 ? year : year - 1;
  return { from: `${startYear}-04-01`, to: `${startYear + 1}-03-31`, label: `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}` };
}

// query: { period: 'all' | 'thisFy' | 'lastFy' | 'thisMonth' | 'lastMonth' } or { from, to } or { fy: '2025-26' }
function parseReportPeriod(query = {}, today = businessDate()) {
  const period = String(query.period || '').trim();
  const todayYear = Number(today.slice(0, 4));
  const todayMonth = Number(today.slice(5, 7));
  if (period === 'thisFy') return { active: true, ...financialYearBounds(today) };
  if (period === 'lastFy') {
    const current = financialYearBounds(today);
    return { active: true, ...financialYearBounds(`${Number(current.from.slice(0, 4)) - 1}-04-01`) };
  }
  if (period === 'thisMonth') return { active: true, from: `${today.slice(0, 7)}-01`, to: lastDayOfMonth(todayYear, todayMonth), label: 'This month' };
  if (period === 'lastMonth') {
    const year = todayMonth === 1 ? todayYear - 1 : todayYear;
    const month = todayMonth === 1 ? 12 : todayMonth - 1;
    return { active: true, from: `${year}-${String(month).padStart(2, '0')}-01`, to: lastDayOfMonth(year, month), label: 'Last month' };
  }
  if (query.fy) {
    const match = String(query.fy).match(/^(\d{4})-(\d{2})$/);
    if (!match || (Number(match[1]) + 1) % 100 !== Number(match[2])) throw reportPeriodError('Financial year must look like 2025-26.');
    return { active: true, from: `${match[1]}-04-01`, to: `${Number(match[1]) + 1}-03-31`, label: `FY ${query.fy}` };
  }
  const from = String(query.from || '').trim();
  const to = String(query.to || '').trim();
  if (!from && !to) return { active: false, from: '', to: '', label: 'All time' };
  if ((from && !isCalendarDate(from)) || (to && !isCalendarDate(to))) throw reportPeriodError('Dates must be valid and look like 2026-04-01.');
  if (from && to && from > to) throw reportPeriodError('The start date is after the end date.');
  return { active: true, from, to, label: `${from || 'start'} to ${to || 'today'}` };
}

// A copy of the business state limited to a period. Invoices by invoice date, payments by payment date, costs by
// their own dates. An active period also drops the "salary payable per user" fallback, which would otherwise
// invent a current-month payroll cost for any past period.
function filterStateByPeriod(state = {}, period = { active: false }) {
  if (!period.active) return state;
  const inRange = (record, fields) => {
    const raw = fields.map((field) => record?.[field]).find(Boolean);
    const day = getDateOnly(raw);
    if (!day) return false;
    if (period.from && day < period.from) return false;
    if (period.to && day > period.to) return false;
    return true;
  };
  const filtered = { ...state, users: [] };
  for (const [collection, fields] of Object.entries(REPORT_DATE_FIELDS)) {
    filtered[collection] = (state[collection] || []).filter((record) => inRange(record, fields));
  }
  return filtered;
}

// Draft, rejected and cancelled expenses were never incurred, so they stay out of totals.
const isVoidedExpense = (expense = {}) =>
  ['Draft', 'Cancelled', 'Rejected'].includes(String(expense.status || '').trim()) ||
  String(expense.approvalStatus || '').trim() === 'Rejected';

function buildFinanceSummary(state = {}, filters = {}) {
  const settings = state.settings || {};
  const clientById = new Map((state.clients || []).map((client) => [String(client.id), client]));
  const projectById = new Map((state.projects || []).map((project) => [String(project.id), project]));
  const vendorById = new Map((state.vendors || []).map((vendor) => [String(vendor.id), vendor]));

  const fromDate = filters.from ? getDateOnly(filters.from) : '';
  const toDate = filters.to ? getDateOnly(filters.to) : '';

  function isWithinRange(dateValue) {
    if (!dateValue) return true;
    const normalized = getDateOnly(dateValue);
    if (fromDate && normalized < fromDate) return false;
    if (toDate && normalized > toDate) return false;
    return true;
  }

  const validPayments = (state.payments || []).filter(p => isWithinRange(p.paymentDate || p.createdAt));

  // Credit notes issued up to the end of the period count against their invoice's balance.
  const creditNotesInScope = (state.creditNotes || []).filter((note) => !toDate || getDateOnly(note.issueDate || note.createdAt) <= toDate);
  const creditsByInvoice = groupCreditNotesByInvoice(creditNotesInScope);
  const invoiceSnapshots = (state.invoices || [])
    .filter((invoice) => isIssuedInvoice(invoice) && isWithinRange(invoice.invoiceDate || invoice.createdAt))
    .map((invoice) => getInvoiceSnapshot(invoice, validPayments.filter((payment) => String(payment.invoiceId) === String(invoice.id)), settings, clientById.get(String(invoice.clientId)) || {}, creditsByInvoice.get(String(invoice.id)) || []));
  const totalCreditNotes = sumBy((state.creditNotes || []).filter((note) => isIssuedCreditNote(note) && isWithinRange(note.issueDate || note.createdAt)), (note) => note.totalAmount);

  const expenseImpacts = (state.expenses || [])
    .filter(e => isWithinRange(e.expenseDate || e.createdAt) && !isSalaryExpenseRecord(e) && !isVoidedExpense(e))
    .map(calculateExpenseImpact);
    
  const outsourcingImpacts = (state.outsourcingExpenses || [])
    .filter(e => isWithinRange(e.expenseDate || e.createdAt))
    .map((item) => calculateOutsourcingExpense(item, vendorById.get(String(item.vendorId)) || {}, settings));
    
  const commissionImpacts = (state.leadCommissions || [])
    .filter(c => isWithinRange(c.commissionDate || c.createdAt))
    .map((item) => calculateLeadCommission(item, vendorById.get(String(item.partnerId)) || {}, settings));
    
  const payrollRecords = getPayrollRecords(state);
  const payrollExpense = sumBy(payrollRecords, (record) => record.amount);
  const payrollEmployeeCount = new Set(payrollRecords.map((record) => String(record.employeeId || '')).filter(Boolean)).size;
  
  const validBankTransactions = (state.bankTransactions || []).filter(t => isWithinRange(t.date || t.createdAt));
  const bankTransactionCredits = validBankTransactions.filter((item) => bankTypeOf(item) === 'credit').reduce((sum, item) => sum + toNumber(item.amount), 0);
  const bankTransactionDebits = validBankTransactions.filter((item) => bankTypeOf(item) === 'debit').reduce((sum, item) => sum + toNumber(item.amount), 0);

  const totalReceived = sumBy(validPayments, getPaymentAppliedAmount);
  const totalCashReceived = sumBy(validPayments, getPaymentCashAmount);
  const totalTdsDeducted = sumBy(validPayments, getPaymentTdsAmount);
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
    totalCreditNotes,
    totalReceived,
    totalCashReceived,
    totalTdsDeducted,
    totalOutstanding,
    totalOverdueOutstanding: sumBy(invoiceSnapshots.filter((item) => item.isOverdue), (item) => item.balanceDue),
    totalExpenses: totalExpense,
    totalPayrollExpense: payrollExpense,
    payrollEmployeeCount,
    totalOutsourcingPayable,
    totalCommissionPayable,
    totalPayables,
    officeExpense: round2(totalExpense + payrollExpense),
    cashInBank,
    totalReceivables: round2(totalOutstanding),
    netCashFlow: round2(totalCashReceived - totalPayables),
    paymentCount: (state.payments || []).length,
    overdueInvoiceCount: invoiceSnapshots.filter((item) => item.isOverdue).length,
    partialPaymentCount: invoiceSnapshots.filter((item) => item.computedStatus === 'Partially Paid').length,
    paidInvoiceCount: invoiceSnapshots.filter((item) => item.computedStatus === 'Paid').length,
    unreconciledBankTransactions: (state.bankTransactions || []).filter((transaction) => !transaction.linkedInvoiceId && !transaction.linkedExpenseId).length,
    bankCredits: round2(bankTransactionCredits),
    bankDebits: round2(bankTransactionDebits),
    payrollRecords: payrollRecords.length,
    averageSalary: payrollEmployeeCount ? round2(payrollExpense / payrollEmployeeCount) : 0
  };
}

function buildFinanceLedger(state = {}, filters = {}) {
  const settings = state.settings || {};
  const clientById = new Map((state.clients || []).map((client) => [String(client.id), client]));
  const projectById = new Map((state.projects || []).map((project) => [String(project.id), project]));
  const invoiceById = new Map((state.invoices || []).map((invoice) => [String(invoice.id), invoice]));
  const expenseById = new Map((state.expenses || []).map((expense) => [String(expense.id), expense]));
  const vendorById = new Map((state.vendors || []).map((vendor) => [String(vendor.id), vendor]));
  const payrollRecords = getPayrollRecords(state);
  const paymentsByInvoiceId = new Map();

  (state.payments || []).forEach((payment) => {
    const key = String(payment.invoiceId || '');
    if (!paymentsByInvoiceId.has(key)) paymentsByInvoiceId.set(key, []);
    paymentsByInvoiceId.get(key).push(payment);
  });

  const ledgerCredits = groupCreditNotesByInvoice(state.creditNotes);
  const entries = [
    ...(state.invoices || [])
      .filter((invoice) => invoice.status !== 'Cancelled')
      .map((invoice) => getInvoiceSnapshot(invoice, paymentsByInvoiceId.get(String(invoice.id)) || [], settings, clientById.get(String(invoice.clientId)) || {}, ledgerCredits.get(String(invoice.id)) || []))
      .map((snapshot) => buildInvoiceLedgerEntry(snapshot, clientById.get(String(snapshot.clientId)) || null, projectById.get(String(snapshot.projectId)) || null)),
    ...(state.payments || []).map((payment) => buildPaymentLedgerEntry(
      payment,
      clientById.get(String(payment.clientId)) || null,
      projectById.get(String(payment.projectId)) || null,
      invoiceById.get(String(payment.invoiceId)) || null
    )),
    ...(state.expenses || []).filter((expense) => !isSalaryExpenseRecord(expense)).map((expense) => buildExpenseLedgerEntry(
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
    ...payrollRecords.map(buildPayrollLedgerEntry).filter(Boolean),
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
    if (normalizedFilters.from && getDateOnly(entry.date) < getDateOnly(normalizedFilters.from)) return false;
    if (normalizedFilters.to && getDateOnly(entry.date) > getDateOnly(normalizedFilters.to)) return false;
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

  // Totals count cash movements once. An issued invoice is a receivable, not cash, and a bank row tied to an
  // invoice or expense mirrors a payment/expense that is already in the list, so both are left out.
  const cashEntries = sorted.filter(
    (item) => item.module !== 'invoices' && !item.neutral && !(item.module === 'banking' && (item.invoiceId || item.expenseId))
  );
  const cashIn = sumBy(cashEntries.filter((item) => item.direction === 'in'), (item) => item.amount);
  const cashOut = sumBy(cashEntries.filter((item) => item.direction === 'out'), (item) => item.amount);
  return {
    entries: sorted,
    totals: {
      totalIn: cashIn,
      totalOut: cashOut,
      net: round2(cashIn - cashOut),
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
    if (filters.from && getDateOnly(entry.date) < getDateOnly(filters.from)) return false;
    if (filters.to && getDateOnly(entry.date) > getDateOnly(filters.to)) return false;
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
  const [invoiceResult, paymentResult, settingsResult, creditNotes] = await Promise.all([
    invoiceModel.findById(invoiceId, dbClient),
    exec
      ? exec.call(dbClient, 'select * from payments where invoice_id = $1 order by payment_date asc, created_at asc', [invoiceId])
      : paymentModel.list({ where: { invoiceId } }),
    getSettings(),
    loadCreditNotesForInvoice(invoiceId, dbClient)
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
  const snapshot = getInvoiceSnapshot(invoice, payments, settingsResult || {}, client || {}, creditNotes);
  const desiredStatus = snapshot.computedStatus || invoice.status;
  if (String(invoice.status || '') !== String(desiredStatus || '')) {
    await invoiceModel.update(invoiceId, { status: desiredStatus }, dbClient);
  }

  return {
    ...snapshot,
    status: desiredStatus
  };
}

// What is still owed on an invoice, ignoring one payment (the one being edited). Used to stop a payment
// from exceeding the balance.
async function getInvoiceBalance(invoiceId, dbClient = null, { excludePaymentId = '' } = {}) {
  if (!invoiceId) return null;
  const exec = dbClient?.query || null;
  const [invoice, paymentResult, settings, creditNotes] = await Promise.all([
    invoiceModel.findById(invoiceId, dbClient),
    exec
      ? exec.call(dbClient, 'select * from payments where invoice_id = $1', [invoiceId])
      : paymentModel.list({ where: { invoiceId } }),
    getSettings(),
    loadCreditNotesForInvoice(invoiceId, dbClient)
  ]);
  if (!invoice) return null;
  const payments = (Array.isArray(paymentResult?.rows) ? paymentResult.rows.map((row) => paymentModel.hydrateRow(row)) : paymentResult || [])
    .filter((payment) => !excludePaymentId || String(payment.id) !== String(excludePaymentId));
  const client = invoice.clientId ? await clientModel.findById(invoice.clientId, dbClient) : null;
  const snapshot = getInvoiceSnapshot(invoice, payments, settings || {}, client || {}, creditNotes);
  return { invoice, balanceDue: snapshot.balanceDue, totalAmount: snapshot.totalAmount };
}

module.exports = {
  isIssuedCreditNote,
  groupCreditNotesByInvoice,
  getInvoiceCreditCapacity,
  calculateCreditNoteTotals,
  loadCreditNotesForInvoice,
  getInvoiceBalance,
  buildBankReconciliation,
  buildFinanceLedger,
  buildFinanceSummary,
  buildPaymentLedgerEntry,
  buildInvoiceLedgerEntry,
  getInvoiceSnapshot,
  parseReportPeriod,
  filterStateByPeriod,
  isIssuedInvoice,
  getPaymentAppliedAmount,
  getPaymentCashAmount,
  getPaymentTdsAmount,
  isPaymentCounted,
  calculatePayrollExpense,
  getPayrollExpenseTotal,
  getPayrollRecords,
  getPayrollRecordCount,
  syncInvoiceFinancialState
};
