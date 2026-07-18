import { Building2, BriefcaseBusiness, FileText, ReceiptText, Wallet, Users, ShieldCheck, Settings, RotateCw, FileArchive, Banknote, Boxes, MessageSquareText, BellRing, Clock, Send, AlertCircle, List, CalendarDays, CheckSquare, TriangleAlert } from 'lucide-react';

const text = (name, label, extra = {}) => ({ name, label, type: 'text', ...extra });
const textarea = (name, label, extra = {}) => ({ name, label, type: 'textarea', ...extra });
const number = (name, label, extra = {}) => ({ name, label, type: 'number', ...extra });
const money = (name, label, extra = {}) => ({ name, label, type: 'number', step: '0.01', ...extra });
const date = (name, label, extra = {}) => ({ name, label, type: 'date', ...extra });
const checkbox = (name, label, extra = {}) => ({ name, label, type: 'checkbox', ...extra });
const select = (name, label, options, extra = {}) => ({ name, label, type: 'select', options, ...extra });
const customer = (name, label, extra = {}) => ({ name, label, type: 'customer', ...extra });
const json = (name, label, extra = {}) => ({ name, label, type: 'json', ...extra });
const multiselect = (name, label, options, extra = {}) => ({ name, label, type: 'multiselect', options, ...extra });
const attachment = (name, label, extra = {}) => ({ name, label, type: 'attachment', ...extra });

const getAmcDaysRemaining = (row = {}) => {
  const target = row.nextInvoiceDate || row.endDate;
  if (!target) return null;
  const start = new Date();
  const end = new Date(target);
  if (Number.isNaN(end.getTime())) return null;
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
};

const getAmcAutomationState = (row = {}) => {
  const daysRemaining = getAmcDaysRemaining(row);
  const status = String(row.status || '').trim();
  if (status === 'Cancelled') return 'Disabled';
  if (row.autoInvoice && daysRemaining != null && daysRemaining <= 0) return 'Invoice due';
  if (row.autoInvoice && daysRemaining != null && daysRemaining <= Number(row.reminderDays || 7)) return 'Reminder window';
  if (row.autoInvoice) return 'Scheduled';
  return 'Manual only';
};

const getAmcQuickFilter = (row = {}, filterKey = 'all') => {
  const status = String(row.status || '').trim();
  const daysRemaining = getAmcDaysRemaining(row);
  const reminderDays = Number(row.reminderDays || 7);

  if (filterKey === 'all') return true;
  if (filterKey === 'dueSoon') return status !== 'Cancelled' && daysRemaining != null && daysRemaining <= reminderDays;
  if (filterKey === 'autoInvoiceOn') return Boolean(row.autoInvoice);
  if (filterKey === 'manualOnly') return !row.autoInvoice;
  if (filterKey === 'cancelled') return status === 'Cancelled';
  return true;
};

const getRenewalDaysRemaining = (row = {}) => {
  const target = row.dueDate || row.renewalDate || row.expiryDate || row.reminderDate;
  if (!target) return null;
  const end = new Date(target);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
};

const getRenewalAutomationState = (row = {}) => {
  const status = String(row.status || '').trim();
  const daysRemaining = getRenewalDaysRemaining(row);
  const reminderDays = Number(row.reminderDays || 30);
  if (status === 'Cancelled') return 'Cancelled';
  if (status === 'Renewed') return 'Renewed';
  if (daysRemaining == null) return 'Open';
  if (daysRemaining < 0) return 'Expired';
  if (daysRemaining <= reminderDays) return 'Due Soon';
  return row.autoRenewal ? 'Scheduled' : 'Upcoming';
};

const getRenewalQuickFilter = (row = {}, filterKey = 'all') => {
  const status = String(row.status || '').trim();
  const daysRemaining = getRenewalDaysRemaining(row);
  const reminderDays = Number(row.reminderDays || 30);
  if (filterKey === 'all') return true;
  if (filterKey === 'dueSoon') return status !== 'Cancelled' && status !== 'Renewed' && daysRemaining != null && daysRemaining <= reminderDays;
  if (filterKey === 'expired') return status !== 'Cancelled' && status !== 'Renewed' && daysRemaining != null && daysRemaining < 0;
  if (filterKey === 'autoRenewalOn') return Boolean(row.autoRenewal);
  if (filterKey === 'manualOnly') return !row.autoRenewal;
  return true;
};

const getOutsourcingDaysRemaining = (row = {}) => {
  const target = row.dueDate || row.expenseDate;
  if (!target) return null;
  const end = new Date(target);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
};

const getOutsourcingAutomationState = (row = {}) => {
  const approvalStatus = String(row.approvalStatus || 'Pending').trim() || 'Pending';
  const paymentStatus = String(row.paymentStatus || 'Pending').trim() || 'Pending';
  const daysRemaining = getOutsourcingDaysRemaining(row);
  const reminderDays = Number(row.reminderDays || 7);
  if (paymentStatus === 'Paid') return 'Paid';
  if (approvalStatus === 'Pending') return 'Pending Approval';
  if (daysRemaining == null) return 'Open';
  if (daysRemaining < 0) return 'Overdue';
  if (daysRemaining <= reminderDays) return 'Due Soon';
  return 'Scheduled';
};

const getOutsourcingQuickFilter = (row = {}, filterKey = 'all') => {
  const approvalStatus = String(row.approvalStatus || 'Pending').trim() || 'Pending';
  const paymentStatus = String(row.paymentStatus || 'Pending').trim() || 'Pending';
  const daysRemaining = getOutsourcingDaysRemaining(row);
  const reminderDays = Number(row.reminderDays || 7);
  if (filterKey === 'all') return true;
  if (filterKey === 'pendingApproval') return approvalStatus === 'Pending';
  if (filterKey === 'dueSoon') return paymentStatus !== 'Paid' && approvalStatus !== 'Pending' && daysRemaining != null && daysRemaining <= reminderDays && daysRemaining >= 0;
  if (filterKey === 'overdue') return paymentStatus !== 'Paid' && approvalStatus !== 'Pending' && daysRemaining != null && daysRemaining < 0;
  if (filterKey === 'paid') return paymentStatus === 'Paid';
  return true;
};

export const schemaRegistry = {
  dashboard: {
    key: 'dashboard',
    label: 'Dashboard',
    icon: Building2,
    path: '/app/dashboard',
    type: 'dashboard'
  },
  clients: {
    key: 'clients',
    label: 'Clients',
    singular: 'Client',
    icon: Building2,
    path: '/app/clients',
    apiPath: '/clients',
    permission: 'clients.read',
    searchPlaceholder: 'Search by name, company, email, mobile',
    columns: [
      { key: 'name', label: 'Client', render: (row) => row.companyName || row.name },
      { key: 'mobile', label: 'Mobile' },
      { key: 'email', label: 'Email' },
      { key: 'placeOfSupply', label: 'Place of Supply', render: (row) => row.placeOfSupply || row.state || row.country },
      { key: 'gstRegistrationType', label: 'GST Type' },
      { key: 'gstin', label: 'GSTIN' },
      { key: 'openingBalance', label: 'Opening Balance', align: 'right', type: 'money' },
      { key: 'status', label: 'Status', type: 'badge' }
    ],
    fields: [
      text('name', 'Client Name', { required: true }),
      text('companyName', 'Company Name'),
      text('contactPerson', 'Contact Person'),
      text('mobile', 'Mobile'),
      text('email', 'Email', { type: 'email' }),
      textarea('billingAddress', 'Billing Address'),
      textarea('shippingAddress', 'Shipping Address'),
      { name: 'state', label: 'State', type: 'state_select' },
      text('stateCode', 'State Code', { placeholder: 'Auto-filled from state' }),
      text('pincode', 'Pincode'),
      text('country', 'Country', { defaultValue: 'India' }),
      { name: 'placeOfSupply', label: 'City / Place of Supply', type: 'city_select' },
      select('clientType', 'Client Type', ['Company', 'Individual', 'Startup', 'Government', 'NGO', 'Other'], { defaultValue: 'Company' }),
      select('taxTreatment', 'Tax Treatment', ['Regular', 'Composition', 'Unregistered', 'SEZ', 'Overseas'], { defaultValue: 'Regular' }),
      select('gstRegistrationType', 'GST Registration Type', ['Registered', 'Unregistered', 'Composition', 'SEZ', 'Overseas'], { defaultValue: 'Unregistered' }),
      text('gstin', 'GSTIN'),
      text('pan', 'PAN'),
      select('currency', 'Currency', ['INR', 'USD', 'EUR', 'AED'], { defaultValue: 'INR' }),
      money('openingBalance', 'Opening Balance', { defaultValue: 0 }),
      checkbox('tdsApplicable', 'TDS Applicable'),
      select('tdsSection', 'TDS Section', ['Not Applicable', '194C', '194H', '194I', '194J', '194B'], { defaultValue: 'Not Applicable' }),
      select('status', 'Status', ['Active', 'Inactive', 'Lead'], { defaultValue: 'Active' }),
      textarea('notes', 'Notes')
    ]
  },
  projects: {
    key: 'projects',
    label: 'Projects',
    singular: 'Project',
    icon: BriefcaseBusiness,
    path: '/app/projects',
    apiPath: '/projects',
    permission: 'projects.read',
    searchPlaceholder: 'Search projects',
    columns: [
      { key: 'title', label: 'Project' },
      { key: 'clientId', label: 'Client', render: (row, lookups) => lookups.clients?.find((client) => client.id === row.clientId)?.name || '-' },
      { key: 'projectType', label: 'Type' },
      { key: 'value', label: 'Value', align: 'right', type: 'money' },
      { key: 'deadline', label: 'Deadline', type: 'date' },
      { key: 'status', label: 'Status', type: 'badge' }
    ],
    fields: [
      customer('clientId', 'Client'),
      text('title', 'Project Title', { required: true }),
      text('projectType', 'Project Type'),
      money('value', 'Project Value', { defaultValue: 0 }),
      date('startDate', 'Start Date'),
      date('deadline', 'Deadline'),
      select('status', 'Status', ['Active', 'Paused', 'Completed', 'On Hold', 'Archived'], { defaultValue: 'Active' }),
      select('billingType', 'Billing Type', ['Fixed', 'Hourly', 'Milestone', 'Recurring'], { defaultValue: 'Fixed' }),
      money('costEstimate', 'Cost Estimate', { defaultValue: 0 }),
      textarea('notes', 'Notes')
    ]
  },
  invoices: {
    key: 'invoices',
    label: 'Invoices',
    singular: 'Invoice',
    icon: ReceiptText,
    path: '/app/invoices',
    apiPath: '/invoices',
    permission: 'invoices.read',
    searchPlaceholder: 'Search invoices',
    columns: [
      { key: 'invoiceNumber', label: 'Invoice #' },
      { key: 'clientId', label: 'Client', render: (row, lookups) => lookups.clients?.find((client) => client.id === row.clientId)?.name || '-' },
      { key: 'invoiceDate', label: 'Date', type: 'date' },
      { key: 'dueDate', label: 'Due Date', type: 'date' },
      { key: 'totalAmount', label: 'Total', align: 'right', type: 'money' },
      { key: 'status', label: 'Status', type: 'badge' }
    ],
    fields: [
      text('invoiceNumber', 'Invoice Number', { required: true }),
      date('invoiceDate', 'Invoice Date', { required: true }),
      date('dueDate', 'Due Date'),
      customer('clientId', 'Client', { required: true }),
      text('projectId', 'Project', { lookupKey: 'projects' }),
      text('placeOfSupply', 'Place of Supply'),
      select('invoiceType', 'Invoice Type', ['Regular', 'Export', 'SEZ', 'Proforma', 'Credit Note', 'Debit Note'], { defaultValue: 'Regular' }),
      select('amountType', 'Amount Type', ['GST Extra', 'GST Inclusive'], { defaultValue: 'GST Extra' }),
      select('status', 'Status', ['Draft', 'Sent', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'], { defaultValue: 'Sent' }),
      checkbox('isRecurring', 'Recurring Invoice'),
      select('recurringInterval', 'Recurring Interval', ['None', 'Monthly', 'Quarterly', 'Yearly'], { defaultValue: 'None' }),
      money('taxableAmount', 'Taxable Amount', { defaultValue: 0 }),
      money('cgst', 'CGST', { defaultValue: 0 }),
      money('sgst', 'SGST', { defaultValue: 0 }),
      money('utgst', 'UTGST', { defaultValue: 0 }),
      money('igst', 'IGST', { defaultValue: 0 }),
      money('gstAmount', 'GST Amount', { defaultValue: 0 }),
      money('totalAmount', 'Total Amount', { defaultValue: 0 }),
      json('items', 'Items JSON'),
      textarea('notes', 'Notes')
    ]
  },
  payments: {
    key: 'payments',
    label: 'Payments',
    singular: 'Payment',
    icon: Wallet,
    path: '/app/payments',
    apiPath: '/payments',
    permission: 'payments.read',
    searchPlaceholder: 'Search payments',
    columns: [
      { key: 'paymentDate', label: 'Date', type: 'date' },
      { key: 'clientId', label: 'Client', render: (row, lookups) => lookups.clients?.find((client) => client.id === row.clientId)?.name || '-' },
      { key: 'invoiceId', label: 'Invoice' },
      { key: 'paymentStatus', label: 'Status', type: 'badge' },
      { key: 'amountReceived', label: 'Received', align: 'right', type: 'money' },
      { key: 'paymentMode', label: 'Mode' }
    ],
    fields: [
      date('paymentDate', 'Payment Date', { required: true }),
      customer('clientId', 'Client'),
      text('projectId', 'Project', { lookupKey: 'projects' }),
      text('invoiceId', 'Invoice', { lookupKey: 'invoices' }),
      money('amountReceived', 'Amount Received', { defaultValue: 0 }),
      money('tdsDeducted', 'TDS Deducted', { defaultValue: 0 }),
      select('paymentStatus', 'Payment Status', ['Received', 'Pending Clearance', 'Cleared', 'Bounced', 'Refunded', 'Reversed'], { defaultValue: 'Received' }),
      text('paymentMode', 'Payment Mode'),
      text('bankAccountId', 'Bank Account', { lookupKey: 'bankAccounts', lookupLabelKey: 'accountHolderName', lookupDescriptionKey: 'accountNumber' }),
      text('transactionId', 'Transaction ID'),
      textarea('notes', 'Notes')
    ]
  },
  expenses: {
    key: 'expenses',
    label: 'Expenses',
    singular: 'Expense',
    icon: FileArchive,
    path: '/app/expenses',
    apiPath: '/expenses',
    permission: 'expenses.read',
    hasDetailsPage: true,
    searchPlaceholder: 'Search expenses',
    lookupPaths: {
      vendors: '/masters/vendor',
      expenseCategories: '/masters/expense_category',
      clients: '/clients',
      projects: '/projects',
      users: '/users'
    },
    columns: [
      { key: 'expenseDate', label: 'Date', type: 'date' },
      { key: 'expenseType', label: 'Type' },
      { key: 'payeeName', label: 'Payee', render: (row) => row.payeeName || row.vendor || '-' },
      { key: 'categoryId', label: 'Category', render: (row, lookups) => lookups.expenseCategories?.find((c) => c.id === row.categoryId)?.name || '-' },
      { key: 'totalAmount', label: 'Amount', align: 'right', type: 'money' },
      { key: 'paymentStatus', label: 'Payment', type: 'badge' },
      { key: 'status', label: 'Status', type: 'badge' },
      { key: 'balanceDue', label: 'Balance Due', align: 'right', type: 'money' }
    ],
    fields: [
      date('expenseDate', 'Expense Date', { required: true }),
      select('expenseType', 'Expense Type', [
        'Vendor Bill',
        'Employee Salary',
        'Reimbursement',
        'Subscription',
        'Utility',
        'Travel',
        'Asset / Capex',
        'Statutory / Tax',
        'Other'
      ], { defaultValue: 'Vendor Bill', required: true }),
      select('payeeType', 'Payee Type', ['Vendor', 'Employee', 'Client', 'Internal', 'Other'], { defaultValue: 'Vendor', required: true }),
      text('payeeName', 'Payee Name', { visibleWhen: { field: 'payeeType', in: ['Internal', 'Other'] } }),
      text('vendorId', 'Vendor', { lookupKey: 'vendors', lookupDescriptionKey: 'vendorType', visibleWhen: { field: 'payeeType', equals: 'Vendor' } }),
      text('employeeId', 'Employee', { lookupKey: 'users', lookupLabelKey: 'fullName', lookupDescriptionKey: 'email', visibleWhen: { field: 'payeeType', equals: 'Employee' } }),
      customer('clientId', 'Client'),
      text('categoryId', 'Category', { lookupKey: 'expenseCategories' }),
      text('projectId', 'Project', { lookupKey: 'projects' }),
      date('periodStart', 'Period Start', { visibleWhen: { field: 'expenseType', equals: 'Employee Salary' } }),
      date('periodEnd', 'Period End', { visibleWhen: { field: 'expenseType', equals: 'Employee Salary' } }),
      date('dueDate', 'Due Date'),
      money('amountBeforeGst', 'Amount Before GST', { defaultValue: 0, visibleWhen: { field: 'expenseType', notEquals: 'Employee Salary' } }),
      number('gstRate', 'GST Rate', { defaultValue: 0, visibleWhen: { field: 'expenseType', notEquals: 'Employee Salary' } }),
      money('gstAmount', 'GST Amount', { defaultValue: 0, visibleWhen: { field: 'expenseType', notEquals: 'Employee Salary' } }),
      money('totalAmount', 'Total Amount', { defaultValue: 0 }),
      money('paidAmount', 'Paid Amount', { defaultValue: 0 }),
      money('balanceDue', 'Balance Due', { defaultValue: 0 }),
      text('invoiceNumber', 'Invoice Number'),
      text('vendorGstin', 'Vendor GSTIN', { visibleWhen: { field: 'payeeType', equals: 'Vendor' } }),
      text('paymentMode', 'Payment Mode'),
      text('bankAccountId', 'Bank Account', { lookupKey: 'bankAccounts', lookupLabelKey: 'accountHolderName', lookupDescriptionKey: 'accountNumber' }),
      text('costCenter', 'Cost Center'),
      checkbox('itcEligible', 'ITC Eligible'),
      checkbox('rcmApplicable', 'RCM Applicable'),
      checkbox('tdsApplicable', 'TDS Applicable'),
      text('tdsSection', 'TDS Section', { visibleWhen: { field: 'tdsApplicable', truthy: true } }),
      money('tdsRate', 'TDS Rate', { defaultValue: 0, visibleWhen: { field: 'tdsApplicable', truthy: true } }),
      money('tdsAmount', 'TDS Amount', { defaultValue: 0, visibleWhen: { field: 'tdsApplicable', truthy: true } }),
      select('status', 'Status', ['Draft', 'Pending Approval', 'Approved', 'Scheduled', 'Paid', 'Partially Paid', 'On Hold', 'Cancelled'], { defaultValue: 'Draft' }),
      select('approvalStatus', 'Approval Status', ['Pending', 'Approved', 'Rejected', 'Skipped'], { defaultValue: 'Pending' }),
      select('paymentStatus', 'Payment Status', ['Unpaid', 'Partially Paid', 'Scheduled', 'Paid', 'On Hold', 'Cancelled'], { defaultValue: 'Unpaid' }),
      attachment('attachments', 'Attachments'),
      textarea('notes', 'Notes')
    ]
  },
  outsourcing: {
    key: 'outsourcing',
    label: 'Outsourcing',
    singular: 'Outsourcing Expense',
    icon: Boxes,
    path: '/app/outsourcing',
    apiPath: '/outsourcing',
    permission: 'outsourcing.read',
    hasAutomationHistory: true,
    searchPlaceholder: 'Search outsourcing',
    lookupPaths: {
      vendors: '/masters/vendor',
      clients: '/clients',
      projects: '/projects'
    },
    automationRunPath: '/outsourcing/automation/run',
    automationSummaryPath: '/outsourcing/automation/summary',
    automationSummaryMetrics: [
      { key: 'alertsSent', label: 'Alerts', icon: BellRing, color: 'text-violet-500', border: 'border-b-violet-500' },
      { key: 'remindersSent', label: 'Reminders', icon: Clock, color: 'text-blue-500', border: 'border-b-blue-500' },
      { key: 'pendingApproval', label: 'Pending Approval', icon: Send, color: 'text-orange-500', border: 'border-b-orange-500' },
      { key: 'overdue', label: 'Overdue', icon: AlertCircle, color: 'text-rose-500', border: 'border-b-rose-500' }
    ],
    columns: [
      { key: 'expenseDate', label: 'Date', type: 'date' },
      { key: 'vendorName', label: 'Vendor', render: (row, lookups) => {
        if (row.vendorName) return row.vendorName;
        const vendor = lookups.vendors?.find((item) => item.id === row.vendorId);
        return vendor?.name || '-';
      } },
      { key: 'workType', label: 'Work Type' },
      { key: 'approvalStatus', label: 'Approval', type: 'badge' },
      { key: 'dueDate', label: 'Due Date', type: 'date' },
      { key: 'paymentStatus', label: 'Payment', type: 'badge' },
      { key: 'automationState', label: 'Automation', type: 'badge', render: (row) => row.alertState || getOutsourcingAutomationState(row) },
      { key: 'totalAmount', label: 'Total', align: 'right', type: 'money' }
    ],
    quickFilters: [
      { key: 'all', label: 'All', icon: List },
      { key: 'pendingApproval', label: 'Pending Approval', icon: BellRing },
      { key: 'dueSoon', label: 'Due Soon', icon: CalendarDays },
      { key: 'overdue', label: 'Overdue', icon: Clock },
      { key: 'paid', label: 'Paid', icon: CheckSquare }
    ],
    filterRow: (row, filterKey) => getOutsourcingQuickFilter(row, filterKey),
    fields: [
      date('expenseDate', 'Expense Date', { required: true }),
      customer('clientId', 'Client'),
      text('projectId', 'Project', { lookupKey: 'projects' }),
      text('vendorId', 'Vendor', { lookupKey: 'vendors', lookupDescriptionKey: 'vendorType' }),
      text('vendorName', 'Vendor Name'),
      text('workType', 'Work Type'),
      textarea('description', 'Description'),
      money('baseAmount', 'Base Amount', { defaultValue: 0 }),
      checkbox('vendorGstRegistered', 'Vendor GST Registered'),
      checkbox('gstApplicable', 'GST Applicable'),
      number('gstRate', 'GST Rate', { defaultValue: 0 }),
      money('gstAmount', 'GST Amount', { defaultValue: 0 }),
      money('totalAmount', 'Total Amount', { defaultValue: 0 }),
      checkbox('itcEligible', 'ITC Eligible'),
      select('approvalStatus', 'Approval Status', ['Pending', 'Approved', 'Rejected', 'Hold'], { defaultValue: 'Pending' }),
      date('dueDate', 'Due Date'),
      number('reminderDays', 'Reminder Days', { defaultValue: 7 }),
      select('paymentStatus', 'Payment Status', ['Pending', 'Partially Paid', 'Paid', 'On Hold'], { defaultValue: 'Pending' }),
      text('vendorInvoiceNumber', 'Vendor Invoice Number'),
      text('vendorInvoiceUrl', 'Vendor Invoice URL'),
      text('paymentProofUrl', 'Payment Proof URL'),
      textarea('notes', 'Notes')
    ]
  },
  'lead-commissions': {
    key: 'lead-commissions',
    label: 'Lead Commissions',
    singular: 'Lead Commission',
    icon: MessageSquareText,
    path: '/app/lead-commissions',
    apiPath: '/lead-commissions',
    permission: 'lead-commissions.read',
    searchPlaceholder: 'Search lead commissions',
    lookupPaths: {
      vendors: '/masters/vendor',
      clients: '/clients',
      projects: '/projects'
    },
    columns: [
      { key: 'commissionDate', label: 'Date', type: 'date' },
      { key: 'partnerId', label: 'Partner', render: (row, lookups) => lookups.vendors?.find((vendor) => vendor.id === row.partnerId)?.name || row.partnerName || '-' },
      { key: 'clientId', label: 'Client', render: (row, lookups) => lookups.clients?.find((client) => client.id === row.clientId)?.name || '-' },
      { key: 'commissionAmount', label: 'Commission', align: 'right', type: 'money' },
      { key: 'grossPayable', label: 'Gross', align: 'right', type: 'money' },
      { key: 'netPayable', label: 'Net', align: 'right', type: 'money' },
      { key: 'paymentStatus', label: 'Payment', type: 'badge' }
    ],
    fields: [
      date('commissionDate', 'Commission Date', { required: true }),
      text('partnerId', 'Partner', { required: true, lookupKey: 'vendors', lookupDescriptionKey: 'vendorType' }),
      text('partnerName', 'Partner Name'),
      customer('clientId', 'Client'),
      text('projectId', 'Project', { lookupKey: 'projects' }),
      select('commissionType', 'Commission Type', ['Percentage', 'Fixed'], { defaultValue: 'Percentage' }),
      money('commissionPercentage', 'Commission Percentage', { defaultValue: 0 }),
      money('commissionBaseAmount', 'Commission Base Amount', { defaultValue: 0 }),
      money('commissionAmount', 'Commission Amount', { defaultValue: 0 }),
      checkbox('gstRegistered', 'GST Registered'),
      money('gstRate', 'GST Rate', { defaultValue: 0 }),
      money('gstAmount', 'GST Amount', { defaultValue: 0 }),
      money('grossPayable', 'Gross Payable', { defaultValue: 0 }),
      checkbox('tdsApplicable', 'TDS Applicable', { defaultValue: true }),
      text('tdsSection', 'TDS Section'),
      money('tdsRate', 'TDS Rate', { defaultValue: 0 }),
      money('tdsAmount', 'TDS Amount', { defaultValue: 0 }),
      money('netPayable', 'Net Payable', { defaultValue: 0 }),
      select('paymentStatus', 'Payment Status', ['Pending', 'Partially Paid', 'Paid', 'On Hold'], { defaultValue: 'Pending' }),
      text('invoiceNumber', 'Invoice Number'),
      text('invoiceUrl', 'Invoice URL'),
      select('tdsDepositStatus', 'TDS Deposit Status', ['Not Deposited', 'Deposited', 'Pending'], { defaultValue: 'Not Deposited' }),
      textarea('notes', 'Notes')
    ]
  },
  banking: {
    key: 'banking',
    label: 'Banking',
    singular: 'Banking',
    icon: Banknote,
    path: '/app/banking',
    type: 'compound',
    permission: 'banking.read'
  },
  amc: {
    key: 'amc',
    label: 'AMC',
    singular: 'AMC',
    icon: RotateCw,
    path: '/app/amc',
    apiPath: '/amc',
    permission: 'amc.read',
    hasDetailsPage: true,
    searchPlaceholder: 'Search AMC',
    lookupPaths: {
      amcTypes: '/masters/amc_type',
      billingCycles: '/masters/billing_cycle',
      clients: '/clients',
      projects: '/projects'
    },
    automationRunPath: '/amc/automation/run',
    automationSummaryPath: '/amc/automation/summary',
    automationSummaryMetrics: [
      { key: 'remindersSent', label: 'Reminders', icon: Clock, color: 'text-violet-500', border: 'border-b-violet-500' },
      { key: 'invoicesCreated', label: 'Invoices', icon: ReceiptText, color: 'text-blue-500', border: 'border-b-blue-500' },
      { key: 'skipped', label: 'Skipped', icon: FileArchive, color: 'text-orange-500', border: 'border-b-orange-500' },
      { key: 'failures', label: 'Failures', icon: TriangleAlert, color: 'text-rose-500', border: 'border-b-rose-500' }
    ],
    columns: [
      { key: 'title', label: 'AMC Title', render: (row) => row.title || row.amcType || 'AMC' },
      { key: 'clientId', label: 'Client', render: (row, lookups) => lookups.clients?.find((client) => client.id === row.clientId)?.name || '-' },
      { key: 'projectId', label: 'Project', render: (row, lookups) => lookups.projects?.find((project) => project.id === row.projectId)?.title || '-' },
      { key: 'amcType', label: 'AMC Type', render: (row, lookups) => lookups.amcTypes?.find((item) => item.id === row.amcType || item.name === row.amcType)?.name || row.amcType || '-' },
      { key: 'billingCycle', label: 'Billing Cycle', render: (row, lookups) => lookups.billingCycles?.find((item) => item.id === row.billingCycle || item.name === row.billingCycle)?.name || row.billingCycle || '-' },
      { key: 'startDate', label: 'Start Date', type: 'date' },
      { key: 'endDate', label: 'Renewal / End Date', type: 'date' },
      { key: 'nextInvoiceDate', label: 'Next Invoice', type: 'date' },
      { key: 'daysRemaining', label: 'Due In', render: (row) => {
        const days = getAmcDaysRemaining(row);
        if (days == null) return '-';
        if (days < 0) return `Overdue ${Math.abs(days)}d`;
        if (days === 0) return 'Due today';
        return `${days}d`;
      } },
      { key: 'status', label: 'Status', render: (row) => row.renewalStatus || row.status || '-' },
      { key: 'automationState', label: 'Automation', type: 'badge', render: (row) => getAmcAutomationState(row) },
      { key: 'amcAmount', label: 'Amount', align: 'right', type: 'money' },
      { key: 'autoInvoice', label: 'Auto Invoice', render: (row) => (row.autoInvoice ? 'Yes' : 'No') },
      { key: 'lastInvoiceGeneratedAt', label: 'Last Invoice', type: 'date' },
      { key: 'lastReminderSentAt', label: 'Last Reminder', type: 'date' }
    ],
    quickFilters: [
      { key: 'all', label: 'All', icon: List },
      { key: 'dueSoon', label: 'Due Soon', icon: CalendarDays },
      { key: 'autoInvoiceOn', label: 'Auto Invoice On', icon: RotateCw },
      { key: 'manualOnly', label: 'Manual Only', icon: FileText },
      { key: 'cancelled', label: 'Cancelled', icon: FileArchive }
    ],
    filterRow: (row, filterKey) => getAmcQuickFilter(row, filterKey),
    fields: [
      customer('clientId', 'Client'),
      text('projectId', 'Project', { lookupKey: 'projects' }),
      text('title', 'AMC Title', { required: true, placeholder: 'Website AMC, Server Maintenance, etc.' }),
      select('amcType', 'AMC Type', [], { lookupKey: 'amcTypes' }),
      date('startDate', 'Start Date'),
      date('endDate', 'Renewal / End Date'),
      date('nextInvoiceDate', 'Next Invoice Date'),
      select('billingCycle', 'Billing Cycle', [], { lookupKey: 'billingCycles' }),
      number('reminderDays', 'Reminder Days', { defaultValue: 7 }),
      select('status', 'Status', ['Draft', 'Active', 'On Hold', 'Cancelled'], { defaultValue: 'Active' }),
      money('amcAmount', 'AMC Amount', { defaultValue: 0 }),
      select('gstType', 'GST Type', ['GST', 'IGST', 'Non-GST'], { defaultValue: 'GST' }),
      checkbox('autoInvoice', 'Auto Invoice', { defaultValue: false }),
      text('supportScope', 'Support Scope'),
      number('supportHours', 'Support Hours', { defaultValue: 0 }),
      number('responseSlaHours', 'Response SLA (Hours)', { defaultValue: 24 }),
      textarea('remarks', 'Remarks')
    ]
  },
  renewals: {
    key: 'renewals',
    label: 'Renewals',
    singular: 'Renewal',
    icon: FileText,
    path: '/app/renewals',
    apiPath: '/renewals',
    permission: 'renewals.read',
    hasAutomationHistory: true,
    searchPlaceholder: 'Search renewals',
    lookupPaths: {
      renewalProviders: '/masters/renewal_provider',
      clients: '/clients',
      projects: '/projects'
    },
    automationRunPath: '/renewals/automation/run',
    automationSummaryPath: '/renewals/automation/summary',
    automationSummaryMetrics: [
      { key: 'remindersSent', label: 'Reminders', icon: Clock, color: 'text-violet-500', border: 'border-b-violet-500' },
      { key: 'alertsSent', label: 'Alerts', icon: BellRing, color: 'text-blue-500', border: 'border-b-blue-500' },
      { key: 'dueSoon', label: 'Due Soon', icon: CalendarDays, color: 'text-orange-500', border: 'border-b-orange-500' },
      { key: 'overdue', label: 'Expired', icon: AlertCircle, color: 'text-rose-500', border: 'border-b-rose-500' }
    ],
    columns: [
      { key: 'title', label: 'Title', render: (row) => row.title || row.domainName || row.hostingName || row.packageName || row.softwareName || '-' },
      { key: 'provider', label: 'Provider', render: (row) => row.providerName || row.provider || '-' },
      { key: 'renewalDate', label: 'Renewal Date', type: 'date' },
      { key: 'daysRemaining', label: 'Due In', render: (row) => {
        const days = getRenewalDaysRemaining(row);
        if (days == null) return '-';
        if (days < 0) return `Overdue ${Math.abs(days)}d`;
        if (days === 0) return 'Due today';
        return `${days}d`;
      } },
      { key: 'renewalStatus', label: 'Status', type: 'badge', render: (row) => row.renewalStatus || getRenewalAutomationState(row) },
      { key: 'alertState', label: 'Automation', type: 'badge', render: (row) => row.alertState || getRenewalAutomationState(row) },
      { key: 'reminderDays', label: 'Reminder Days', align: 'right', type: 'number' },
      { key: 'autoRenewal', label: 'Auto Renewal', render: (row) => (row.autoRenewal ? 'Yes' : 'No') },
      { key: 'lastReminderSentAt', label: 'Last Reminder', type: 'date' }
    ],
    quickFilters: [
      { key: 'all', label: 'All', icon: List },
      { key: 'dueSoon', label: 'Due Soon', icon: CalendarDays },
      { key: 'expired', label: 'Expired', icon: AlertCircle },
      { key: 'autoRenewalOn', label: 'Auto Renewal On', icon: RotateCw },
      { key: 'manualOnly', label: 'Manual Only', icon: FileText }
    ],
    filterRow: (row, filterKey) => getRenewalQuickFilter(row, filterKey),
    fields: [
      customer('clientId', 'Client'),
      text('projectId', 'Project', { lookupKey: 'projects' }),
      text('title', 'Title', { required: true }),
      text('providerId', 'Provider', { lookupKey: 'renewalProviders' }),
      text('providerName', 'Provider Name'),
      select('category', 'Category', ['Domain', 'Hosting', 'Software', 'License', 'Subscription', 'AMC', 'Other'], { defaultValue: 'Other' }),
      text('serviceType', 'Service Type'),
      text('domainName', 'Domain Name'),
      text('hostingName', 'Hosting Name'),
      text('packageName', 'Package Name'),
      text('softwareName', 'Software Name'),
      text('licenseScope', 'License Scope'),
      number('seats', 'Seats', { defaultValue: 0 }),
      text('licenseKey', 'License Key'),
      text('provider', 'Provider Text'),
      date('purchaseDate', 'Purchase Date'),
      number('durationYears', 'Duration Years', { defaultValue: 1 }),
      date('renewalDate', 'Renewal Date'),
      date('expiryDate', 'Expiry Date'),
      money('purchasePrice', 'Purchase Price', { defaultValue: 0 }),
      money('renewalPrice', 'Renewal Price', { defaultValue: 0 }),
      money('renewalCost', 'Renewal Cost', { defaultValue: 0 }),
      money('clientCharge', 'Client Charge', { defaultValue: 0 }),
      date('reminderDate', 'Reminder Date'),
      number('reminderDays', 'Reminder Days', { defaultValue: 30 }),
      checkbox('autoRenewal', 'Auto Renewal', { defaultValue: false }),
      select('financeAction', 'Finance Action', ['None', 'Create Invoice', 'Create Expense', 'Create Credit Note', 'Notify Team'], { defaultValue: 'None' }),
      select('status', 'Status', ['Pending', 'Upcoming', 'Due Soon', 'Renewed', 'Expired', 'Cancelled'], { defaultValue: 'Pending' }),
      text('financeEntryId', 'Finance Entry ID'),
      text('financeEntryType', 'Finance Entry Type'),
      text('sourceInvoiceId', 'Source Invoice ID'),
      text('sourceExpenseId', 'Source Expense ID'),
      money('amount', 'Amount', { defaultValue: 0 }),
      textarea('notes', 'Notes')
    ]
  },
  masters: {
    key: 'masters',
    label: 'Masters',
    singular: 'Master Item',
    icon: ShieldCheck,
    path: '/app/masters',
    apiPath: '/masters',
    permission: 'masters.read',
    searchPlaceholder: 'Search master items',
    columns: [
      { key: 'type', label: 'Type' },
      { key: 'name', label: 'Name' },
      { key: 'isActive', label: 'Active', type: 'badge' }
    ],
    fields: [
      text('type', 'Type', { required: true }),
      text('name', 'Name', { required: true }),
      checkbox('isActive', 'Active'),
      number('sortOrder', 'Sort Order', { defaultValue: 0 }),
      json('payload', 'Payload JSON')
    ]
  },
  users: {
    key: 'users',
    label: 'Users',
    singular: 'User',
    icon: Users,
    path: '/app/users',
    apiPath: '/users',
    permission: 'users.manage',
    searchPlaceholder: 'Search users',
    columns: [
      { key: 'fullName', label: 'Name' },
      { key: 'username', label: 'Username' },
      { key: 'email', label: 'Email' },
      { key: 'roles', label: 'Roles', render: (row) => (row.roles || []).map((role) => role.name).join(', ') || '-' },
      { key: 'isActive', label: 'Status', type: 'badge' }
    ],
    fields: [
      text('fullName', 'Full Name', { required: true }),
      text('username', 'Username', { required: true }),
      text('email', 'Email', { required: true, type: 'email' }),
      text('password', 'Password', { type: 'password' }),
      checkbox('isActive', 'Active', { defaultValue: true }),
      multiselect('roleIds', 'Roles', [])
    ]
  },
  roles: {
    key: 'roles',
    label: 'Roles',
    singular: 'Role',
    icon: ShieldCheck,
    path: '/app/roles',
    apiPath: '/roles',
    permission: 'roles.manage',
    searchPlaceholder: 'Search roles',
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Name' },
      { key: 'isSystem', label: 'System', type: 'badge' },
      { key: 'isActive', label: 'Status', type: 'badge' }
    ],
    fields: [
      text('code', 'Code', { required: true }),
      text('name', 'Name', { required: true }),
      textarea('description', 'Description'),
      checkbox('isSystem', 'System Role', { defaultValue: false }),
      checkbox('isActive', 'Active', { defaultValue: true }),
      multiselect('permissionIds', 'Permissions', [])
    ]
  },
  permissions: {
    key: 'permissions',
    label: 'Permissions',
    singular: 'Permission',
    icon: ShieldCheck,
    path: '/app/permissions',
    apiPath: '/permissions',
    permission: 'permissions.manage',
    searchPlaceholder: 'Search permissions',
    readOnly: true,
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Name' },
      { key: 'module', label: 'Module' },
      { key: 'action', label: 'Action' },
      { key: 'description', label: 'Description' }
    ]
  },
  settings: {
    key: 'settings',
    label: 'Settings',
    singular: 'Settings',
    icon: Settings,
    path: '/app/settings',
    type: 'settings',
    permission: 'settings.read'
  },
  reports: {
    key: 'reports',
    label: 'Reports',
    singular: 'Report',
    icon: FileText,
    path: '/app/reports',
    type: 'reports',
    permission: 'reports.view'
  },
  files: {
    key: 'files',
    label: 'Files',
    singular: 'File',
    icon: FileArchive,
    path: '/app/files',
    apiPath: '/files',
    permission: 'files.read',
    searchPlaceholder: 'Search file records',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'folderPath', label: 'Folder' },
      { key: 'fileType', label: 'Type' },
      { key: 'size', label: 'Size' },
      { key: 'status', label: 'Status', type: 'badge' }
    ],
    fields: [
      text('name', 'Name', { required: true }),
      text('folderPath', 'Folder Path'),
      text('fileType', 'File Type'),
      text('sourceUrl', 'Source URL'),
      text('notes', 'Notes')
    ]
  }
};

export const navigationItems = [
  'dashboard',
  'clients',
  'projects',
  'invoices',
  'payments',
  'expenses',
  'outsourcing',
  'banking',
  'amc',
  'renewals',
  'masters',
  'reports',
  'files',
  'users',
  'roles',
  'permissions',
  'settings'
].map((key) => schemaRegistry[key]).filter(Boolean);
