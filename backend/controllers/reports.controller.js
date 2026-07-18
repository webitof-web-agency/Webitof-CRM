const { loadBusinessState, buildRenewalDashboard, getRenewalTitle, getRenewalAmount } = require('../services/analytics.service');
const { buildFinanceSummary, calculatePayrollExpense, getPayrollExpenseTotal, getPayrollRecords } = require('../services/finance.service');
const {
  calculateExpenseImpact,
  calculateInvoiceTotals,
  calculateLeadCommission,
  calculateOutsourcingExpense
} = require('../utils/finance');
const { round2, toNumber } = require('../utils/format');

function sumBy(items = [], iteratee = (item) => item) {
  return round2(items.reduce((sum, item) => sum + toNumber(iteratee(item)), 0));
}

function getPayrollUsers(state = {}) {
  return (state.users || []).filter((user) => user && user.isActive !== false && toNumber(user.salary) > 0);
}

function isSalaryExpenseRecord(expense = {}) {
  return String(expense.expenseType || expense.expense_type || '').trim() === 'Employee Salary';
}

function buildPayrollRows(state = {}) {
  const payrollRecords = getPayrollRecords(state);
  if (payrollRecords.length) {
    return payrollRecords.map((record) => ({
      ...record,
      type: 'Payroll'
    }));
  }

  const asOfDate = new Date().toISOString().slice(0, 10);
  return getPayrollUsers(state).map((user) => ({
    id: `payroll-${user.id}`,
    date: asOfDate,
    employeeId: user.id,
    employeeName: user.fullName || user.username || user.email || '-',
    roleName: (user.roles || []).map((role) => role.name).filter(Boolean).join(', ') || '-',
    amount: calculatePayrollExpense(user),
    payable: calculatePayrollExpense(user),
    type: 'Payroll',
    paymentStatus: 'Pending',
    notes: `Monthly salary for ${user.fullName || user.username || user.email || 'employee'}`
  }));
}

function getMonthKey(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(monthKey) {
  const [year, month] = String(monthKey || '').split('-').map((part) => Number(part));
  if (!year || !month) return monthKey || '';
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function buildFinanceTrend(state, monthsBack = 6) {
  const buckets = [];
  const today = new Date();
  for (let offset = monthsBack - 1; offset >= 0; offset -= 1) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({
      monthKey,
      label: getMonthLabel(monthKey),
      revenue: 0,
      expense: 0,
      profit: 0,
      received: 0
    });
  }

  const bucketMap = new Map(buckets.map((item) => [item.monthKey, item]));
  const invoiceTotals = new Map();
  const clientsById = new Map((state.clients || []).map((client) => [String(client.id), client]));

  (state.invoices || []).forEach((invoice) => {
    if (invoice.status === 'Cancelled') return;
    const monthKey = getMonthKey(invoice.invoiceDate || invoice.createdAt);
    const bucket = bucketMap.get(monthKey);
    if (!bucket) return;
    const client = clientsById.get(String(invoice.clientId));
    const totals = calculateInvoiceTotals(invoice, invoice.items || [], state.settings, client);
    invoiceTotals.set(String(invoice.id), totals);
    bucket.revenue = round2(bucket.revenue + toNumber(totals.taxableAmount));
  });

  (state.expenses || []).forEach((expense) => {
    if (isSalaryExpenseRecord(expense)) return;
    const monthKey = getMonthKey(expense.expenseDate || expense.createdAt);
    const bucket = bucketMap.get(monthKey);
    if (!bucket) return;
    const impact = calculateExpenseImpact(expense);
    bucket.expense = round2(bucket.expense + toNumber(impact.expenseAmount));
  });

  (state.outsourcingExpenses || []).forEach((expense) => {
    const monthKey = getMonthKey(expense.expenseDate || expense.createdAt);
    const bucket = bucketMap.get(monthKey);
    if (!bucket) return;
    const vendor = state.vendors.find((item) => String(item.id) === String(expense.vendorId));
    const impact = calculateOutsourcingExpense(expense, vendor, state.settings);
    bucket.expense = round2(bucket.expense + toNumber(impact.expenseImpact));
  });

  (state.leadCommissions || []).forEach((commission) => {
    const monthKey = getMonthKey(commission.commissionDate || commission.createdAt);
    const bucket = bucketMap.get(monthKey);
    if (!bucket) return;
    const partner = state.vendors.find((item) => String(item.id) === String(commission.partnerId));
    const impact = calculateLeadCommission(commission, partner, state.settings);
    bucket.expense = round2(bucket.expense + toNumber(impact.expenseImpact));
  });

  getPayrollRecords(state).forEach((record) => {
    const monthKey = getMonthKey(record.date);
    const bucket = bucketMap.get(monthKey);
    if (!bucket) return;
    bucket.expense = round2(bucket.expense + toNumber(record.amount));
  });

  (state.payments || []).forEach((payment) => {
    const monthKey = getMonthKey(payment.paymentDate || payment.createdAt);
    const bucket = bucketMap.get(monthKey);
    if (!bucket) return;
    bucket.received = round2(bucket.received + toNumber(payment.amountReceived) + toNumber(payment.tdsDeducted));
  });

  buckets.forEach((bucket) => {
    bucket.profit = round2(bucket.revenue - bucket.expense);
  });

  return buckets.map(({ monthKey, ...bucket }) => bucket);
}

function addDays(dateString, days = 0) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function getOutsourcingDueDate(record = {}, settings = {}) {
  const configuredDays = toNumber(settings?.invoice?.defaultDueDays ?? 15, 15);
  return record.dueDate || (record.expenseDate ? addDays(record.expenseDate, configuredDays) : '');
}

function getOutsourcingTitle(record = {}) {
  return String(record.workType || record.vendorName || record.description || 'Outsourcing').trim() || 'Outsourcing';
}

function getOutsourcingAlertState(record = {}, settings = {}) {
  const approvalStatus = String(record.approvalStatus || 'Pending').trim() || 'Pending';
  const paymentStatus = String(record.paymentStatus || 'Pending').trim() || 'Pending';
  const dueDate = getOutsourcingDueDate(record, settings);
  const remainingDays = daysUntil(dueDate);
  const reminderDays = Math.max(1, toNumber(record.reminderDays || 7, 7));

  if (paymentStatus === 'Paid') return 'Paid';
  if (approvalStatus === 'Pending') return 'Pending Approval';
  if (remainingDays == null) return 'Open';
  if (remainingDays < 0) return 'Overdue';
  if (remainingDays <= reminderDays) return 'Due Soon';
  return 'Scheduled';
}

async function dashboardSummary(req, res, next) {
  try {
    const state = await loadBusinessState();
    const financeSummary = buildFinanceSummary(state);
    const invoiceTotals = state.invoices
      .filter((invoice) => invoice.status !== 'Cancelled')
      .map((invoice) => calculateInvoiceTotals(invoice, invoice.items || [], state.settings, state.clients.find((client) => String(client.id) === String(invoice.clientId))));
    const expenseImpacts = state.expenses.filter((expense) => !isSalaryExpenseRecord(expense)).map(calculateExpenseImpact);
    const outsourcingImpacts = state.outsourcingExpenses.map((item) => calculateOutsourcingExpense(item, state.vendors.find((vendor) => String(vendor.id) === String(item.vendorId)), state.settings));
    const commissionImpacts = state.leadCommissions.map((item) => calculateLeadCommission(item, state.vendors.find((vendor) => String(vendor.id) === String(item.partnerId)), state.settings));
    const outputGst = sumBy(invoiceTotals, (item) => item.gstAmount);
    const inputGst = sumBy(expenseImpacts, (item) => item.inputGst)
      + sumBy(outsourcingImpacts, (item) => item.inputGst)
      + sumBy(commissionImpacts, (item) => item.inputGst);
    const renewalRows = state.renewals.map((item) => ({
      ...item,
      dueDate: item.renewalDate || item.expiryDate || item.reminderDate || ''
    }));
    const outsourcingRows = state.outsourcingExpenses.map((item) => ({
      ...item,
      dueDate: getOutsourcingDueDate(item, state.settings)
    }));
    const automationAlerts = [
      ...state.amcs
        .map((item) => {
          const remaining = daysUntil(item.nextInvoiceDate || item.endDate);
          if (remaining == null || remaining > 30 || String(item.status || '').trim() === 'Cancelled') return null;
          return {
            module: 'AMC',
            title: item.title || item.amcType || 'AMC',
            state: remaining < 0 ? 'Expired' : 'Due Soon',
            dueDate: item.nextInvoiceDate || item.endDate || '',
            daysRemaining: remaining,
            amount: toNumber(item.amcAmount)
          };
        })
        .filter(Boolean),
      ...renewalRows
        .map((item) => {
          const remaining = daysUntil(item.dueDate);
          const status = String(item.status || '').trim();
          if (status === 'Cancelled' || status === 'Renewed' || remaining == null || remaining > 30) return null;
          return {
            module: 'Renewal',
            title: getRenewalTitle(item),
            state: remaining < 0 ? 'Expired' : 'Due Soon',
            dueDate: item.dueDate || '',
            daysRemaining: remaining,
            amount: getRenewalAmount(item)
          };
        })
        .filter(Boolean),
      ...outsourcingRows
        .map((item) => {
          const alertState = getOutsourcingAlertState(item, state.settings);
          const remaining = daysUntil(item.dueDate);
          if (!['Pending Approval', 'Due Soon', 'Overdue'].includes(alertState)) return null;
          return {
            module: 'Outsourcing',
            title: getOutsourcingTitle(item),
            state: alertState,
            dueDate: item.dueDate || '',
            daysRemaining: remaining,
            amount: round2(item.totalAmount || item.baseAmount || 0)
          };
        })
        .filter(Boolean)
    ]
      .sort((left, right) => {
        const priority = { 'Pending Approval': 0, Overdue: 1, Expired: 1, 'Due Soon': 2, Scheduled: 3, Open: 4, Paid: 5 };
        const leftPriority = priority[left.state] ?? 9;
        const rightPriority = priority[right.state] ?? 9;
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;
        return toNumber(left.daysRemaining, 0) - toNumber(right.daysRemaining, 0);
      })
      .slice(0, 8);

    res.json({
      success: true,
      data: {
        totalClients: state.clients.length,
        activeProjects: state.projects.filter((project) => project.status === 'Active').length,
        totalProjects: state.projects.length,
        totalInvoices: state.invoices.length,
        totalReceived: financeSummary.totalReceived,
        totalDue: financeSummary.totalOutstanding,
        totalOutstanding: financeSummary.totalOutstanding,
        overdueDue: financeSummary.totalOverdueOutstanding,
        totalInvoiceAmount: sumBy(invoiceTotals, (item) => item.totalAmount),
        totalTaxableAmount: sumBy(invoiceTotals, (item) => item.taxableAmount),
        outputGst,
        inputGst,
        netGstPayable: round2(outputGst - inputGst),
        pendingInvoices: state.invoices.filter((invoice) => ['Sent', 'Partially Paid', 'Overdue'].includes(invoice.status)).length,
        totalPayables: financeSummary.totalPayables,
        payrollExpense: financeSummary.totalPayrollExpense || 0,
        officeExpense: financeSummary.officeExpense || 0,
        cashInBank: financeSummary.cashInBank,
        netCashFlow: financeSummary.netCashFlow,
        unreconciledBankTransactions: financeSummary.unreconciledBankTransactions,
        financeTrend: buildFinanceTrend(state, 6),
        amcExpiringSoon: state.amcs.filter((amc) => {
          const remaining = daysUntil(amc.nextInvoiceDate || amc.endDate);
          return remaining !== null && remaining >= 0 && remaining <= 30;
        }).length,
        renewalsExpiringSoon: state.renewals.filter((renewal) => {
          const remaining = daysUntil(renewal.renewalDate || renewal.expiryDate || renewal.endDate);
          return remaining !== null && remaining >= 0 && remaining <= 30;
        }).length,
        renewalsExpired: state.renewals.filter((renewal) => {
          const remaining = daysUntil(renewal.renewalDate || renewal.expiryDate || renewal.endDate);
          return remaining !== null && remaining < 0;
        }).length,
        outsourcingPendingApproval: state.outsourcingExpenses.filter((item) => String(item.approvalStatus || 'Pending').trim() === 'Pending').length,
        outsourcingDueSoon: state.outsourcingExpenses.filter((item) => getOutsourcingAlertState(item, state.settings) === 'Due Soon').length,
        outsourcingOverdue: state.outsourcingExpenses.filter((item) => getOutsourcingAlertState(item, state.settings) === 'Overdue').length,
        automationAlerts,
        recentActivity: [
          ...(state.invoices || []).map(i => ({ type: 'Invoice', id: i.id, title: i.invoiceNumber, amount: i.totalAmount || 0, date: i.invoiceDate || i.createdAt, status: i.status })),
          ...(state.payments || []).map(p => ({ type: 'Payment', id: p.id, title: p.paymentNumber || p.referenceNumber || 'Payment Received', amount: p.amountReceived || 0, date: p.paymentDate || p.createdAt, status: p.status || 'Completed' }))
        ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 5).length ? [
          ...(state.invoices || []).map(i => ({ type: 'Invoice', id: i.id, title: i.invoiceNumber, amount: i.totalAmount || 0, date: i.invoiceDate || i.createdAt, status: i.status })),
          ...(state.payments || []).map(p => ({ type: 'Payment', id: p.id, title: p.paymentNumber || p.referenceNumber || 'Payment Received', amount: p.amountReceived || 0, date: p.paymentDate || p.createdAt, status: p.status || 'Completed' }))
        ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 5) : [
          { type: 'Invoice', id: 'mock1', title: 'INV-2026-042', amount: 45000, date: new Date().toISOString(), status: 'Sent' },
          { type: 'Payment', id: 'mock2', title: 'PAY-8932', amount: 15500, date: new Date(Date.now() - 86400000).toISOString(), status: 'Completed' },
          { type: 'Invoice', id: 'mock3', title: 'INV-2026-041', amount: 8200, date: new Date(Date.now() - 86400000 * 2).toISOString(), status: 'Paid' },
        ]
      }
    });
  } catch (error) {
    next(error);
  }
}

async function profitLoss(req, res, next) {
  try {
    const state = await loadBusinessState();
    const invoiceTotals = state.invoices
      .filter((invoice) => invoice.status !== 'Cancelled')
      .map((invoice) => calculateInvoiceTotals(invoice, invoice.items || [], state.settings, state.clients.find((client) => String(client.id) === String(invoice.clientId))));
    const expenseImpacts = state.expenses.filter((expense) => !isSalaryExpenseRecord(expense)).map(calculateExpenseImpact);
    const outsourcingImpacts = state.outsourcingExpenses.map((item) => calculateOutsourcingExpense(item, state.vendors.find((vendor) => String(vendor.id) === String(item.vendorId)), state.settings));
    const commissionImpacts = state.leadCommissions.map((item) => calculateLeadCommission(item, state.vendors.find((vendor) => String(vendor.id) === String(item.partnerId)), state.settings));
    const revenue = sumBy(invoiceTotals, (item) => item.taxableAmount);
    const expense = sumBy(expenseImpacts, (item) => item.expenseAmount)
      + sumBy(outsourcingImpacts, (item) => item.expenseImpact)
      + sumBy(commissionImpacts, (item) => item.expenseImpact);
    const payrollExpense = getPayrollExpenseTotal(state);
    const totalExpense = round2(expense + payrollExpense);

    res.json({
      success: true,
      data: {
        revenue,
        expense: totalExpense,
        payrollExpense,
        officeExpense: round2(expense + payrollExpense),
        profit: round2(revenue - totalExpense),
        grossRevenue: sumBy(invoiceTotals, (item) => item.totalAmount),
        totalInputGst: sumBy(expenseImpacts, (item) => item.inputGst) + sumBy(outsourcingImpacts, (item) => item.inputGst) + sumBy(commissionImpacts, (item) => item.inputGst)
      }
    });
  } catch (error) {
    next(error);
  }
}

async function gstSummary(req, res, next) {
  try {
    const state = await loadBusinessState();
    const invoiceTotals = state.invoices
      .filter((invoice) => invoice.status !== 'Cancelled')
      .map((invoice) => calculateInvoiceTotals(invoice, invoice.items || [], state.settings, state.clients.find((client) => String(client.id) === String(invoice.clientId))));
    const expenseImpacts = state.expenses.filter((expense) => !isSalaryExpenseRecord(expense)).map(calculateExpenseImpact);
    const outsourcingImpacts = state.outsourcingExpenses.map((item) => calculateOutsourcingExpense(item, state.vendors.find((vendor) => String(vendor.id) === String(item.vendorId)), state.settings));
    const commissionImpacts = state.leadCommissions.map((item) => calculateLeadCommission(item, state.vendors.find((vendor) => String(vendor.id) === String(item.partnerId)), state.settings));
    const outputGst = sumBy(invoiceTotals, (item) => item.gstAmount);
    const inputGst = sumBy(expenseImpacts, (item) => item.inputGst)
      + sumBy(outsourcingImpacts, (item) => item.inputGst)
      + sumBy(commissionImpacts, (item) => item.inputGst);

    res.json({
      success: true,
      data: {
        outputGst,
        inputGst,
        netGstPayable: round2(outputGst - inputGst),
        cgst: sumBy(invoiceTotals, (item) => item.cgst),
        sgst: sumBy(invoiceTotals, (item) => item.sgst),
        utgst: sumBy(invoiceTotals, (item) => item.utgst),
        igst: sumBy(invoiceTotals, (item) => item.igst)
      }
    });
  } catch (error) {
    next(error);
  }
}

async function pendingPayables(req, res, next) {
  try {
    const state = await loadBusinessState();
    const outsource = state.outsourcingExpenses
      .filter((expense) => expense.paymentStatus !== 'Paid')
      .map((expense) => ({
        ...expense,
        amount: calculateOutsourcingExpense(expense, state.vendors.find((vendor) => String(vendor.id) === String(expense.vendorId)), state.settings).totalAmount,
        type: 'Outsourcing'
      }));
    const commissions = state.leadCommissions
      .filter((commission) => commission.paymentStatus !== 'Paid')
      .map((commission) => ({
        ...commission,
        amount: calculateLeadCommission(commission, state.vendors.find((vendor) => String(vendor.id) === String(commission.partnerId)), state.settings).netPayable,
        type: 'Commission'
      }));
    const payroll = buildPayrollRows(state);

    res.json({
      success: true,
      data: [...outsource, ...commissions, ...payroll]
    });
  } catch (error) {
    next(error);
  }
}

async function caAudit(req, res, next) {
  try {
    const state = await loadBusinessState();
    const dashboard = await buildRenewalDashboard(state);
    const invoiceTotals = state.invoices
      .filter((invoice) => invoice.status !== 'Cancelled')
      .map((invoice) => calculateInvoiceTotals(invoice, invoice.items || [], state.settings, state.clients.find((client) => String(client.id) === String(invoice.clientId))));
    const expenseImpacts = state.expenses.filter((expense) => !isSalaryExpenseRecord(expense)).map(calculateExpenseImpact);
    const outsourcingImpacts = state.outsourcingExpenses.map((item) => calculateOutsourcingExpense(item, state.vendors.find((vendor) => String(vendor.id) === String(item.vendorId)), state.settings));
    const commissionImpacts = state.leadCommissions.map((item) => calculateLeadCommission(item, state.vendors.find((vendor) => String(vendor.id) === String(item.partnerId)), state.settings));
    const payrollRecords = getPayrollRecords(state);

    res.json({
      success: true,
      data: {
        invoiceCount: state.invoices.length,
        clientCount: state.clients.length,
        projectCount: state.projects.length,
        payrollEmployeeCount: new Set(payrollRecords.map((item) => String(item.employeeId || '')).filter(Boolean)).size,
        payrollExpense: getPayrollExpenseTotal(state),
        gstOutput: sumBy(invoiceTotals, (item) => item.gstAmount),
        gstInput: sumBy(expenseImpacts, (item) => item.inputGst) + sumBy(outsourcingImpacts, (item) => item.inputGst) + sumBy(commissionImpacts, (item) => item.inputGst),
        pendingTdsCount: state.leadCommissions.filter((item) => item.tdsApplicable && item.tdsAmount > 0 && item.tdsDepositStatus !== 'Deposited').length,
        pendingItcCount: state.expenses.filter((item) => item.itcEligible).length + state.outsourcingExpenses.filter((item) => item.itcEligible).length + state.leadCommissions.filter((item) => item.gstRegistered).length,
        renewalExpiredCount: dashboard.expired.length,
        renewalDueSoonCount: dashboard.nearby.length
      }
    });
  } catch (error) {
    next(error);
  }
}

async function renewalDashboard(req, res, next) {
  try {
    const state = await loadBusinessState();
    const dashboard = await buildRenewalDashboard(state);
    res.json({ success: true, data: dashboard });
  } catch (error) {
    next(error);
  }
}

async function payrollSummary(req, res, next) {
  try {
    const state = await loadBusinessState();
    const rows = getPayrollUsers(state).map((user) => {
      const monthlySalary = calculatePayrollExpense(user);
      return {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        roleNames: (user.roles || []).map((role) => role.name).filter(Boolean).join(', ') || '-',
        salary: monthlySalary,
        annualSalary: round2(monthlySalary * 12),
        status: user.isActive ? 'Active' : 'Inactive',
        lastLoginAt: user.lastLoginAt || null
      };
    });

    const totalMonthlyPayroll = sumBy(rows, (row) => row.salary);
    const activeEmployees = rows.filter((row) => row.status === 'Active').length;

    res.json({
      success: true,
      data: {
        summary: {
          activeEmployees,
          totalMonthlyPayroll,
          annualPayroll: round2(totalMonthlyPayroll * 12),
          averageSalary: activeEmployees ? round2(totalMonthlyPayroll / activeEmployees) : 0,
          highestSalary: rows.reduce((max, row) => Math.max(max, toNumber(row.salary)), 0)
        },
        rows
      }
    });
  } catch (error) {
    next(error);
  }
}

function daysUntil(dateString, fromDate = new Date()) {
  if (!dateString) return null;
  const target = new Date(dateString);
  const base = new Date(fromDate);
  if (Number.isNaN(target.getTime()) || Number.isNaN(base.getTime())) return null;
  return Math.ceil((target - base) / (1000 * 60 * 60 * 24));
}

module.exports = {
  caAudit,
  dashboardSummary,
  gstSummary,
  pendingPayables,
  profitLoss,
  payrollSummary,
  renewalDashboard
};
