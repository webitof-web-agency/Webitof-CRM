export const DEFAULT_SETTINGS = {
  company: {
    name: 'Webitof',
    legalName: 'WEBITOF WEB AGENCY (OPC) PRIVATE LIMITED',
    logoUrl: '/assets/images/horizontal-logo.png',
    address: 'Unit No. 3033, 3rd Floor, Currency Tower, VIP Rd, Vishal Nagar, Raipur, Chhattisgarh 492001, India',
    registeredOffice: '182, Ward No. 5, Bhathapara, Saloni Seoni, Raipur, Chhattisgarh 493661, India',
    city: 'Raipur',
    state: 'Chhattisgarh',
    stateCode: '22',
    country: 'India',
    pincode: '492001',
    gstin: '22AADCW3373Q1ZW',
    pan: 'AADCW3373Q',
    cin: 'U72900CT2022OPC013562',
    udyam: 'UDYAM-CG-14-0034411',
    tan: 'JBPW00418F',
    iso: '',
    email: 'contact@webitof.com',
    phone: '+91 9174786123',
    alternatePhone: '+91 9183456123',
    website: 'https://webitof.com',
    signatoryName: 'Hitesh Kumar Kurre',
    signatoryDesignation: 'Managing Director',
    signatureUrl: '',
    signatureFileId: '',
    certificates: [
      {
        id: 'webitof-incorporation',
        type: 'incorporation',
        label: 'Certificate of Incorporation (COI)',
        docNumber: 'U72900CT2022OPC013562',
        name: 'CERTIFICATE OF INCORPORATION.PDF',
        url: '/assets/docs/CERTIFICATE OF INCORPORATION.PDF',
        mimeType: 'application/pdf',
        source: 'Ministry of Corporate Affairs (MCA)',
        uploadedAt: '2022-08-05T00:00:00.000Z'
      },
      {
        id: 'webitof-gst',
        type: 'gst',
        label: 'GST Registration Certificate (Form GST REG-06)',
        docNumber: '22AADCW3373Q1ZW',
        name: 'GST Webitof.pdf',
        url: '/assets/docs/GST Webitof.pdf',
        mimeType: 'application/pdf',
        source: 'GST System / CBIC',
        uploadedAt: '2026-07-11T00:00:00.000Z'
      },
      {
        id: 'webitof-udyam',
        type: 'udyam',
        label: 'Udyam MSME Registration Certificate',
        docNumber: 'UDYAM-CG-14-0034411',
        name: 'Udyam Registration Certificate Full 2026.pdf',
        url: '/assets/docs/Udyam Registration Certificate Full 2026.pdf',
        mimeType: 'application/pdf',
        source: 'Ministry of MSME',
        uploadedAt: '2022-08-11T00:00:00.000Z'
      },
      {
        id: 'webitof-pan',
        type: 'pan',
        label: 'Company Permanent Account Number (PAN Card)',
        docNumber: 'AADCW3373Q',
        name: 'Webitof PAN .pdf',
        url: '/assets/docs/Webitof PAN .pdf',
        mimeType: 'application/pdf',
        source: 'Income Tax Department',
        uploadedAt: '2022-08-05T00:00:00.000Z'
      },
      {
        id: 'webitof-tan',
        type: 'tan',
        label: 'Tax Deduction Account Number (TAN) Allotment Letter',
        docNumber: 'JBPW00418F',
        name: 'Webitof TAN.pdf',
        url: '/assets/docs/Webitof TAN.pdf',
        mimeType: 'application/pdf',
        source: 'Income Tax Department',
        uploadedAt: '2022-08-05T00:00:00.000Z'
      }
    ]
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
    primaryColor: '#4361ee',
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
  // Logos are static files, not settings: see config/brandAssets.js.
  invoiceTheme: {
    watermarkUrl: '/assets/images/invoice_watermark.png'
  },
  statuses: {
    leads: [
      { label: 'New', color: '#2563eb' },
      { label: 'Contacted', color: '#6366f1' },
      { label: 'Requirement Collected', color: '#0891b2' },
      { label: 'Qualified', color: '#8b5cf6' },
      { label: 'Unqualified', color: '#f43f5e' },
      { label: 'Quotation Pending', color: '#ea580c' },
      { label: 'Quotation Sent', color: '#9333ea' },
      { label: 'Negotiation', color: '#db2777' },
      { label: 'Follow-up', color: '#0284c7' },
      { label: 'Demo Scheduled', color: '#f59e0b' },
      { label: 'Meeting Scheduled', color: '#4f46e5' },
      { label: 'On Hold', color: '#d97706' },
      { label: 'Won', color: '#16a34a' },
      { label: 'Lost', color: '#dc2626' },
      { label: 'Not Interested', color: '#e11d48' },
      { label: 'Invalid Lead', color: '#64748b' },
      { label: 'Duplicate', color: '#6b7280' }
    ],
    clients: [
      { label: 'Active', color: '#10b981' },
      { label: 'Inactive', color: '#64748b' }
    ],
    // Same as backend/config/pipelineFields.js (fallback until the settings API answers).
    projects: [
      { label: 'Not Started', color: '#64748b' },
      { label: 'Requirement Gathering', color: '#0ea5e9' },
      { label: 'Awaiting Advance', color: '#f97316' },
      { label: 'Planning', color: '#6366f1' },
      { label: 'Design', color: '#d946ef' },
      { label: 'In Progress', color: '#3b82f6' },
      { label: 'Content Pending', color: '#eab308' },
      { label: 'Testing / QA', color: '#8b5cf6' },
      { label: 'Client Review', color: '#06b6d4' },
      { label: 'Revisions', color: '#ec4899' },
      { label: 'On Hold', color: '#f59e0b' },
      { label: 'Waiting on Client', color: '#fb923c' },
      { label: 'Payment Pending', color: '#ef4444' },
      { label: 'Ready for Launch', color: '#14b8a6' },
      { label: 'Live', color: '#22c55e' },
      { label: 'Completed', color: '#10b981' },
      { label: 'Support / Warranty', color: '#0891b2' },
      { label: 'Handed Over', color: '#475569' },
      { label: 'AMC', color: '#7c3aed' },
      { label: 'Cancelled', color: '#dc2626' },
      { label: 'Closed', color: '#334155' }
    ]
  },
  // Same as backend/config/pipelineFields.js (fallback until the settings API answers).
  sources: {
    leads: ['Website', 'Website Contact Form', 'Landing Page', 'Live Chat', 'Chatbot', 'Google Search (SEO)', 'Google Ads', 'Google Business Profile', 'Bing Ads', 'Facebook', 'Facebook Ads', 'Instagram', 'Instagram Ads', 'LinkedIn', 'LinkedIn Ads', 'YouTube', 'X (Twitter)', 'Quora', 'Pinterest', 'WhatsApp', 'WhatsApp Business', 'Telegram', 'SMS', 'Phone Call', 'Inbound Call', 'Missed Call', 'Cold Call', 'Email', 'Email Campaign', 'Newsletter', 'IndiaMART', 'Justdial', 'TradeIndia', 'Sulekha', 'ExportersIndia', 'Clutch', 'GoodFirms', 'Directory Listing', 'Upwork', 'Freelancer', 'Fiverr', 'Guru', 'PeoplePerHour', 'Toptal', 'Referral', 'Existing Client', 'Repeat Client', 'Employee Reference', 'Partner', 'Channel Partner', 'Reseller', 'Affiliate', 'Walk-in', 'Event / Exhibition', 'Trade Show', 'Seminar / Webinar', 'Workshop', 'Networking Event', 'Business Card', 'Newspaper / Print Ad', 'Radio / TV', 'Hoarding / Outdoor', 'Pamphlet / Flyer', 'Government Tender', 'GeM Portal', 'Other']
  },
  labels: []
};
