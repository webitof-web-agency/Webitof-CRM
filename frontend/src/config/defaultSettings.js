export const DEFAULT_SETTINGS = {
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
    prefix: 'WEB',
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
  complianceNote: 'GST, TDS, and ITC calculations are based on configured settings. Final filing and compliance should be verified by accountant or CA.',
  roles: {
    admin: ['all'],
    accountant: ['finance', 'reports'],
    sales: ['clients', 'projects', 'invoices']
  },
  ui: {
    inputRadius: '0.75rem',
    buttonRadius: '0.5rem',
    cardRadius: '1.5rem'
  },
  logos: {
    primary: '',
    sidebar: '',
    sidebarCollapsed: '',
    favicon: ''
  },
  statuses: {
    leads: [
      { label: 'New', color: '#3b82f6' },
      { label: 'Qualified', color: '#f59e0b' },
      { label: 'Won', color: '#10b981' },
      { label: 'Lost', color: '#ef4444' }
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
