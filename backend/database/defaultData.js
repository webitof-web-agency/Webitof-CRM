const DEFAULT_SETTINGS = {
  company: {
    name: 'Webitof',
    legalName: 'Webitof IT Services',
    logoUrl: './assets/images/placeholder-logo.svg',
    address: 'Raipur, Chhattisgarh',
    city: 'Raipur',
    state: 'Chhattisgarh',
    stateCode: '22',
    country: 'India',
    pincode: '492001',
    gstin: '22AAAAA0000A1Z5',
    pan: 'AAAAA0000A',
    cin: '',
    udyam: '',
    iso: '',
    email: 'accounts@webitof.com',
    phone: '+91 90000 00000',
    website: 'https://webitof.com'
  },
  gst: {
    defaultRate: 18,
    cgstRate: 9,
    sgstRate: 9,
    igstRate: 18,
    lutEnabled: true,
    gstRegistered: true,
    autoDetectTax: true,
    defaultExportTreatment: 'Export without payment of IGST under LUT',
    enableCgst: true,
    enableSgst: true,
    enableUtgst: true,
    enableIgst: true,
    enableCess: false
  },
  tds: {
    commissionSection: '194H',
    commissionRate: 2,
    commissionThreshold: 15000
  },
  invoice: {
    prefix: 'INV',
    nextSequence: 1,
    financialYear: '',
    numberFormat: 'month_year',
    defaultDueDays: 15,
    terms: 'Payment due as per invoice due date. Late payments may attract additional charges.',
    signatureName: 'Authorized Signatory'
  },
  bank: {
    bankName: 'HDFC Bank',
    accountHolder: 'Webitof IT Services',
    accountNumber: '000000000000',
    ifsc: 'HDFC0000000',
    branch: 'Raipur',
    upiId: 'webitof@upi'
  },
  branding: {
    primaryColor: '#2392f8',
    accentColor: '#5e1cd5'
  },
  smtp: {
    host: '',
    port: '',
    username: '',
    password: '',
    secure: false,
    fromName: 'Webitof CRM',
    fromEmail: ''
  },
  emailTemplates: {
    invoice: 'Dear {{client}}, please find your invoice {{invoiceNumber}} attached.',
    paymentReminder: 'Dear {{client}}, this is a reminder for invoice {{invoiceNumber}}.',
    passwordReset: 'Your password reset OTP is {{otp}}. It expires in {{minutes}} minutes.'
  },
  complianceNote: 'GST, TDS, and ITC calculations are based on configured settings. Final filing and compliance should be verified by accountant/CA.',
  roles: {
    admin: ['all'],
    accountant: ['finance', 'reports'],
    sales: ['clients', 'projects', 'invoices']
  },
  statuses: {
    leads: [
      { label: 'New', color: '#3b82f6', state: 'open' },
      { label: 'Qualified', color: '#f59e0b', state: 'open' },
      { label: 'Won', color: '#10b981', state: 'won' },
      { label: 'Lost', color: '#ef4444', state: 'lost' }
    ],
    clients: [
      { label: 'Active', color: '#10b981' },
      { label: 'Inactive', color: '#64748b' }
    ],
    projects: [
      { label: 'Not Started', color: '#64748b' },
      { label: 'In Progress', color: '#3b82f6' },
      { label: 'Completed', color: '#10b981' },
      { label: 'On Hold', color: '#f59e0b' }
    ]
  },
  sources: {
    leads: ['Website', 'Referral', 'Cold Call', 'Other']
  },
  labels: []
};

const DEFAULT_SERVICE_CATEGORIES = [
  {
    id: 'svc-cat-development',
    type: 'service_category',
    name: 'Development',
    is_active: true,
    sort_order: 1,
    payload: {
      description: 'Software, website, and custom application work.'
    }
  },
  {
    id: 'svc-cat-hosting',
    type: 'service_category',
    name: 'Hosting',
    is_active: true,
    sort_order: 2,
    payload: {
      description: 'Domain, hosting, SSL, and infrastructure services.'
    }
  },
  {
    id: 'svc-cat-maintenance',
    type: 'service_category',
    name: 'Maintenance',
    is_active: true,
    sort_order: 3,
    payload: {
      description: 'AMC, support, and ongoing maintenance services.'
    }
  },
  {
    id: 'svc-cat-design',
    type: 'service_category',
    name: 'Design',
    is_active: true,
    sort_order: 4,
    payload: {
      description: 'Creative, UI/UX, and branding services.'
    }
  },
  {
    id: 'svc-cat-seo',
    type: 'service_category',
    name: 'SEO',
    is_active: true,
    sort_order: 5,
    payload: {
      description: 'Search engine optimization and growth services.'
    }
  },
  {
    id: 'svc-cat-support',
    type: 'service_category',
    name: 'Support',
    is_active: true,
    sort_order: 6,
    payload: {
      description: 'Technical support, training, and helpdesk services.'
    }
  }
];

const DEFAULT_SERVICES = [
  {
    id: 'svc-web-dev',
    type: 'service',
    name: 'Website Development',
    is_active: true,
    sort_order: 1,
    payload: {
      categoryId: 'svc-cat-development',
      categoryName: 'Development',
      sacCode: '998314',
      sac: '998314',
      gstRate: 18,
      unit: 'Project',
      defaultPrice: 40000,
      isRecurring: false,
      isAmcService: false
    }
  },
  {
    id: 'svc-domain-hosting',
    type: 'service',
    name: 'Domain + Hosting Setup',
    is_active: true,
    sort_order: 2,
    payload: {
      categoryId: 'svc-cat-hosting',
      categoryName: 'Hosting',
      sacCode: '998315',
      sac: '998315',
      gstRate: 18,
      unit: 'Year',
      defaultPrice: 10000,
      isRecurring: true,
      isAmcService: false
    }
  },
  {
    id: 'svc-amc',
    type: 'service',
    name: 'Website AMC',
    is_active: true,
    sort_order: 3,
    payload: {
      categoryId: 'svc-cat-maintenance',
      categoryName: 'Maintenance',
      sacCode: '998313',
      sac: '998313',
      gstRate: 18,
      unit: 'Month',
      defaultPrice: 5000,
      isRecurring: true,
      isAmcService: true
    }
  }
];

const DEFAULT_EXPENSE_CATEGORIES = [
  {
    id: 'exp-domain',
    type: 'expense_category',
    name: 'Domain Purchase',
    is_active: true,
    sort_order: 10,
    payload: { group: 'Direct Cost', defaultGstRate: 18, itcEligible: true, requiresInvoice: true, requiresEmployee: false, isPayroll: false, sortOrder: 10 }
  },
  {
    id: 'exp-hosting',
    type: 'expense_category',
    name: 'Hosting Server',
    is_active: true,
    sort_order: 20,
    payload: { group: 'Direct Cost', defaultGstRate: 18, itcEligible: true, requiresInvoice: true, requiresEmployee: false, isPayroll: false, sortOrder: 20 }
  },
  {
    id: 'exp-software',
    type: 'expense_category',
    name: 'Software Subscription',
    is_active: true,
    sort_order: 30,
    payload: { group: 'Operating Expense', defaultGstRate: 18, itcEligible: true, requiresInvoice: true, requiresEmployee: false, isPayroll: false, sortOrder: 30 }
  },
  {
    id: 'exp-office',
    type: 'expense_category',
    name: 'Office Expense',
    is_active: true,
    sort_order: 40,
    payload: { group: 'Operating Expense', defaultGstRate: 18, itcEligible: false, requiresInvoice: false, requiresEmployee: false, isPayroll: false, sortOrder: 40 }
  },
  {
    id: 'exp-utility',
    type: 'expense_category',
    name: 'Utility Bill',
    is_active: true,
    sort_order: 50,
    payload: { group: 'Operating Expense', defaultGstRate: 18, itcEligible: true, requiresInvoice: true, requiresEmployee: false, isPayroll: false, sortOrder: 50 }
  },
  {
    id: 'exp-travel',
    type: 'expense_category',
    name: 'Travel',
    is_active: true,
    sort_order: 60,
    payload: { group: 'Operating Expense', defaultGstRate: 5, itcEligible: false, requiresInvoice: true, requiresEmployee: false, isPayroll: false, sortOrder: 60 }
  },
  {
    id: 'exp-salary',
    type: 'expense_category',
    name: 'Employee Salary',
    is_active: true,
    sort_order: 70,
    payload: { group: 'Payroll', defaultGstRate: 0, itcEligible: false, requiresInvoice: false, requiresEmployee: true, isPayroll: true, sortOrder: 70 }
  },
  {
    id: 'exp-reimbursement',
    type: 'expense_category',
    name: 'Reimbursement',
    is_active: true,
    sort_order: 80,
    payload: { group: 'Payroll', defaultGstRate: 0, itcEligible: false, requiresInvoice: false, requiresEmployee: true, isPayroll: true, sortOrder: 80 }
  },
  {
    id: 'exp-statutory',
    type: 'expense_category',
    name: 'Statutory / Tax',
    is_active: true,
    sort_order: 90,
    payload: { group: 'Statutory', defaultGstRate: 0, itcEligible: false, requiresInvoice: false, requiresEmployee: false, isPayroll: false, sortOrder: 90 }
  },
  {
    id: 'exp-capex',
    type: 'expense_category',
    name: 'Asset / Capex',
    is_active: true,
    sort_order: 100,
    payload: { group: 'Capex', defaultGstRate: 18, itcEligible: true, requiresInvoice: true, requiresEmployee: false, isPayroll: false, sortOrder: 100 }
  }
];

const DEFAULT_TAX_RATES = [
  { id: 'gst-0', type: 'tax_rate', name: 'GST 0%', is_active: true, payload: { rate: 0 } },
  { id: 'gst-5', type: 'tax_rate', name: 'GST 5%', is_active: true, payload: { rate: 5 } },
  { id: 'gst-12', type: 'tax_rate', name: 'GST 12%', is_active: true, payload: { rate: 12 } },
  { id: 'gst-18', type: 'tax_rate', name: 'GST 18%', is_active: true, payload: { rate: 18 } },
  { id: 'gst-28', type: 'tax_rate', name: 'GST 28%', is_active: true, payload: { rate: 28 } }
];

const DEFAULT_VENDORS = [
  {
    id: 'vendor-godaddy',
    type: 'vendor',
    name: 'GoDaddy',
    is_active: true,
    payload: {
      vendorType: 'Agency',
      gstRegistered: true,
      gstin: '',
      pan: '',
      address: '',
      state: 'Maharashtra',
      mobile: '',
      email: '',
      bankDetails: '',
      upiId: '',
      tdsApplicable: false,
      defaultTdsSection: 'Not Applicable',
      notes: ''
    }
  },
  {
    id: 'vendor-hostinger',
    type: 'vendor',
    name: 'Hostinger',
    is_active: true,
    payload: {
      vendorType: 'Agency',
      gstRegistered: true,
      gstin: '',
      pan: '',
      address: '',
      state: 'Karnataka',
      mobile: '',
      email: '',
      bankDetails: '',
      upiId: '',
      tdsApplicable: false,
      defaultTdsSection: 'Not Applicable',
      notes: ''
    }
  },
  {
    id: 'vendor-referral-sample',
    type: 'vendor',
    name: 'Rahul Referral Partner',
    is_active: true,
    payload: {
      vendorType: 'Referral Partner',
      gstRegistered: true,
      gstin: '22BBBBB1111B1Z5',
      pan: 'BBBBB1111B',
      address: 'Raipur',
      state: 'Chhattisgarh',
      mobile: '+91 90000 00002',
      email: 'rahul@example.com',
      bankDetails: 'HDFC Current A/C',
      upiId: 'rahul@upi',
      tdsApplicable: true,
      defaultTdsSection: '194H',
      notes: 'Sample GST registered lead partner.'
    }
  },
  {
    id: 'vendor-designer-sample',
    type: 'vendor',
    name: 'Freelance Graphic Designer',
    is_active: true,
    payload: {
      vendorType: 'Freelancer',
      gstRegistered: false,
      gstin: '',
      pan: 'CCCCC2222C',
      address: 'Bhilai',
      state: 'Chhattisgarh',
      mobile: '+91 90000 00003',
      email: 'designer@example.com',
      bankDetails: 'SBI Savings A/C',
      upiId: 'designer@upi',
      tdsApplicable: false,
      defaultTdsSection: 'Not Applicable',
      notes: 'Sample unregistered outsource vendor.'
    }
  }
];

const DEFAULT_RENEWAL_PROVIDERS = [
  { id: 'provider-godaddy', type: 'renewal_provider', name: 'GoDaddy', is_active: true, payload: { providerType: 'Domain' } },
  { id: 'provider-hostinger', type: 'renewal_provider', name: 'Hostinger', is_active: true, payload: { providerType: 'Hosting' } },
  { id: 'provider-namecheap', type: 'renewal_provider', name: 'Namecheap', is_active: true, payload: { providerType: 'Domain' } },
  { id: 'provider-microsoft', type: 'renewal_provider', name: 'Microsoft', is_active: true, payload: { providerType: 'Software License' } }
];

const DEFAULT_AMC_TYPES = [
  {
    id: 'amc-website',
    type: 'amc_type',
    name: 'Website Maintenance',
    is_active: true,
    sort_order: 10,
    payload: { group: 'Maintenance', defaultBillingCycle: 'Monthly', defaultReminderDays: 7, autoInvoice: true, supportHours: 10, responseSlaHours: 24 }
  },
  {
    id: 'amc-server',
    type: 'amc_type',
    name: 'Server Maintenance',
    is_active: true,
    sort_order: 20,
    payload: { group: 'Maintenance', defaultBillingCycle: 'Monthly', defaultReminderDays: 5, autoInvoice: true, supportHours: 24, responseSlaHours: 4 }
  },
  {
    id: 'amc-seo',
    type: 'amc_type',
    name: 'SEO Maintenance',
    is_active: true,
    sort_order: 30,
    payload: { group: 'Maintenance', defaultBillingCycle: 'Monthly', defaultReminderDays: 7, autoInvoice: false, supportHours: 8, responseSlaHours: 48 }
  }
];

const DEFAULT_BILLING_CYCLES = [
  { id: 'cycle-monthly', type: 'billing_cycle', name: 'Monthly', is_active: true, payload: { months: 1 } },
  { id: 'cycle-quarterly', type: 'billing_cycle', name: 'Quarterly', is_active: true, payload: { months: 3 } },
  { id: 'cycle-half-yearly', type: 'billing_cycle', name: 'Half Yearly', is_active: true, payload: { months: 6 } },
  { id: 'cycle-yearly', type: 'billing_cycle', name: 'Yearly', is_active: true, payload: { months: 12 } }
];

const DEFAULT_INVOICE_TERMS = [
  {
    id: 'term-standard',
    type: 'invoice_term',
    name: 'Standard Terms',
    is_active: true,
    payload: {
      text: DEFAULT_SETTINGS.invoice.terms,
      isDefault: true
    }
  }
];

module.exports = {
  DEFAULT_SETTINGS,
  DEFAULT_SERVICE_CATEGORIES,
  DEFAULT_SERVICES,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_TAX_RATES,
  DEFAULT_VENDORS,
  DEFAULT_RENEWAL_PROVIDERS,
  DEFAULT_AMC_TYPES,
  DEFAULT_BILLING_CYCLES,
  DEFAULT_INVOICE_TERMS
};
