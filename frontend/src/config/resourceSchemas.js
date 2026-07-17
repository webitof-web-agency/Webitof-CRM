import { Building2, BriefcaseBusiness, FileText, ReceiptText, Wallet, Users, ShieldCheck, Settings, RotateCw, FileArchive, Banknote, Boxes, MessageSquareText } from 'lucide-react';

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
    searchPlaceholder: 'Search expenses',
    lookupPaths: {
      vendors: '/masters/vendor',
      expenseCategories: '/masters/expense_category',
      clients: '/clients',
      projects: '/projects'
    },
    columns: [
      { key: 'expenseDate', label: 'Date', type: 'date' },
      { key: 'vendor', label: 'Vendor' },
      { key: 'totalAmount', label: 'Total', align: 'right', type: 'money' },
      { key: 'paymentMode', label: 'Payment Mode' }
    ],
    fields: [
      date('expenseDate', 'Expense Date', { required: true }),
      text('vendor', 'Vendor', { required: true }),
      text('vendorId', 'Vendor', { lookupKey: 'vendors', lookupDescriptionKey: 'vendorType' }),
      text('categoryId', 'Category', { lookupKey: 'expenseCategories' }),
      customer('clientId', 'Client'),
      text('projectId', 'Project', { lookupKey: 'projects' }),
      money('amountBeforeGst', 'Amount Before GST', { defaultValue: 0 }),
      number('gstRate', 'GST Rate', { defaultValue: 0 }),
      money('gstAmount', 'GST Amount', { defaultValue: 0 }),
      money('totalAmount', 'Total Amount', { defaultValue: 0 }),
      text('invoiceNumber', 'Invoice Number'),
      text('vendorGstin', 'Vendor GSTIN'),
      text('paymentMode', 'Payment Mode'),
      text('bankAccountId', 'Bank Account', { lookupKey: 'bankAccounts', lookupLabelKey: 'accountHolderName', lookupDescriptionKey: 'accountNumber' }),
      checkbox('itcEligible', 'ITC Eligible'),
      checkbox('rcmApplicable', 'RCM Applicable'),
      text('attachmentUrl', 'Attachment URL'),
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
    searchPlaceholder: 'Search outsourcing',
    lookupPaths: {
      vendors: '/masters/vendor',
      clients: '/clients',
      projects: '/projects'
    },
    columns: [
      { key: 'expenseDate', label: 'Date', type: 'date' },
      { key: 'vendorName', label: 'Vendor' },
      { key: 'workType', label: 'Work Type' },
      { key: 'totalAmount', label: 'Total', align: 'right', type: 'money' },
      { key: 'paymentStatus', label: 'Payment' }
    ],
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
    searchPlaceholder: 'Search AMC',
    lookupPaths: {
      amcTypes: '/masters/amc_type',
      clients: '/clients',
      projects: '/projects'
    },
    columns: [
      { key: 'amcDate', label: 'Date', render: (row) => row.amcDate || row.startDate || row.createdAt?.slice(0, 10) },
      { key: 'clientId', label: 'Client', render: (row, lookups) => lookups.clients?.find((client) => client.id === row.clientId)?.name || '-' },
      { key: 'title', label: 'Title' },
      { key: 'status', label: 'Status', type: 'badge' }
    ],
    fields: [
      customer('clientId', 'Client'),
      text('projectId', 'Project', { lookupKey: 'projects' }),
      text('title', 'Title', { required: true }),
      select('amcType', 'AMC Type', [], { lookupKey: 'amcTypes' }),
      date('startDate', 'Start Date'),
      date('renewalDate', 'Renewal Date'),
      select('status', 'Status', ['Active', 'Expired', 'Pending', 'On Hold'], { defaultValue: 'Active' }),
      money('amount', 'Amount', { defaultValue: 0 }),
      textarea('notes', 'Notes')
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
    searchPlaceholder: 'Search renewals',
    lookupPaths: {
      renewalProviders: '/masters/renewal_provider',
      clients: '/clients',
      projects: '/projects'
    },
    columns: [
      { key: 'renewalDate', label: 'Renewal Date', type: 'date' },
      { key: 'title', label: 'Title' },
      { key: 'providerName', label: 'Provider' },
      { key: 'status', label: 'Status', type: 'badge' }
    ],
    fields: [
      text('title', 'Title', { required: true }),
      text('providerId', 'Provider', { lookupKey: 'renewalProviders' }),
      text('providerName', 'Provider Name'),
      text('serviceType', 'Service Type'),
      date('renewalDate', 'Renewal Date'),
      date('nextRenewalDate', 'Next Renewal Date'),
      select('status', 'Status', ['Upcoming', 'Due', 'Renewed', 'Expired'], { defaultValue: 'Upcoming' }),
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
