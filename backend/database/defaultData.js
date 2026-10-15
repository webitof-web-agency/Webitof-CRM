const DEFAULT_SETTINGS = {
  company: {
    name: 'Webitof',
    legalName: 'WEBITOF WEB AGENCY (OPC) PRIVATE LIMITED',
    logoUrl: './assets/images/placeholder-logo.svg',
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
      { id: 'webitof-incorporation', type: 'incorporation', label: 'Certificate of Incorporation (COI)', docNumber: 'U72900CT2022OPC013562', name: 'CERTIFICATE OF INCORPORATION.PDF', url: '/assets/docs/CERTIFICATE OF INCORPORATION.PDF', mimeType: 'application/pdf', source: 'Ministry of Corporate Affairs (MCA)', uploadedAt: '2022-08-05T00:00:00.000Z' },
      { id: 'webitof-gst', type: 'gst', label: 'GST Registration Certificate (Form GST REG-06)', docNumber: '22AADCW3373Q1ZW', name: 'GST Webitof.pdf', url: '/assets/docs/GST Webitof.pdf', mimeType: 'application/pdf', source: 'GST System / CBIC', uploadedAt: '2026-07-11T00:00:00.000Z' },
      { id: 'webitof-udyam', type: 'udyam', label: 'Udyam MSME Registration Certificate', docNumber: 'UDYAM-CG-14-0034411', name: 'Udyam Registration Certificate Full 2026.pdf', url: '/assets/docs/Udyam Registration Certificate Full 2026.pdf', mimeType: 'application/pdf', source: 'Ministry of MSME', uploadedAt: '2022-08-11T00:00:00.000Z' },
      { id: 'webitof-pan', type: 'pan', label: 'Company Permanent Account Number (PAN Card)', docNumber: 'AADCW3373Q', name: 'Webitof PAN .pdf', url: '/assets/docs/Webitof PAN .pdf', mimeType: 'application/pdf', source: 'Income Tax Department', uploadedAt: '2022-08-05T00:00:00.000Z' },
      { id: 'webitof-tan', type: 'tan', label: 'Tax Deduction Account Number (TAN) Allotment Letter', docNumber: 'JBPW00418F', name: 'Webitof TAN.pdf', url: '/assets/docs/Webitof TAN.pdf', mimeType: 'application/pdf', source: 'Income Tax Department', uploadedAt: '2022-08-05T00:00:00.000Z' }
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
      minimumBudget: 35000,
      serviceKind: 'primary',
      parentServiceIds: [],
      description: 'Responsive business website with CMS, lead forms, SEO-ready pages and launch support.',
      featuresText: 'Responsive UI for mobile, tablet and desktop\nUp to 8 business pages\nCMS/admin panel\nContact and enquiry forms\nBasic on-page SEO setup\nGoogle Analytics integration\nSSL and production deployment',
      scopeOfWork: 'Requirement discovery, UI design, responsive development, CMS setup, content placement, quality assurance and production deployment.',
      technologyStackIds: ['tech-html5', 'tech-css3', 'tech-javascript', 'tech-react-js', 'tech-next-js', 'tech-node-js', 'tech-postgresql', 'tech-aws'],
      timeline: '4-6 weeks',
      paymentInfo: '40% advance\n30% after design approval\n30% before production launch',
      termsAndConditions: 'Two design revision rounds are included. Client will provide final content and approvals on time. Third-party license and gateway charges are billed separately.',
      afterCompletion: '30-day bug-fix warranty\nAdmin training\nSource-code and credential handover\nDeployment assistance',
      amcPlanId: 'amc-website-standard',
      nextYearCost: 18000,
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
      minimumBudget: 8000,
      serviceKind: 'addon',
      parentServiceIds: ['svc-web-dev', 'svc-ecommerce-dev'],
      description: 'Domain, managed hosting, SSL and basic server setup for one year.',
      featuresText: 'Domain configuration\nManaged hosting setup\nSSL certificate\nDNS and email record configuration\nBasic uptime monitoring',
      scopeOfWork: 'Provision the hosting account, connect the domain, configure SSL/DNS and deploy the approved website.',
      technologyStackIds: ['tech-aws', 'tech-cloudflare', 'tech-ssl-configuration', 'tech-domain-dns-management'],
      timeline: '2-3 business days',
      paymentInfo: '100% before procurement',
      termsAndConditions: 'Domain availability and third-party provider pricing apply at the time of purchase.',
      afterCompletion: 'Hosting credentials and renewal schedule',
      nextYearCost: 10000,
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
      minimumBudget: 5000,
      serviceKind: 'addon',
      parentServiceIds: ['svc-web-dev', 'svc-ecommerce-dev'],
      description: 'Ongoing website updates, monitoring, backups and technical support.',
      featuresText: 'Monthly updates\nSecurity monitoring\nScheduled backups\nUptime monitoring\nMinor content changes\nPriority support',
      scopeOfWork: 'Preventive maintenance and minor content/technical updates within the selected support-hour limit.',
      technologyStackIds: ['tech-cloudflare', 'tech-github', 'tech-server-deployment', 'tech-ssl-configuration'],
      timeline: '12-month plan',
      paymentInfo: 'Monthly or annual advance billing',
      termsAndConditions: 'New modules, redesigns and third-party charges are excluded and quoted separately.',
      afterCompletion: 'Monthly maintenance report and renewal reminder',
      amcPlanId: 'amc-website-standard',
      nextYearCost: 60000,
      isRecurring: true,
      isAmcService: true
    }
  },
  {
    id: 'svc-ecommerce-dev',
    type: 'service',
    name: 'E-commerce Website Development',
    is_active: true,
    sort_order: 4,
    payload: {
      categoryId: 'svc-cat-development',
      categoryName: 'Development',
      sacCode: '998314',
      sac: '998314',
      gstRate: 18,
      unit: 'Project',
      defaultPrice: 95000,
      minimumBudget: 80000,
      serviceKind: 'primary',
      parentServiceIds: [],
      description: 'Complete online store with catalog, cart, checkout, payments and order administration.',
      featuresText: 'Responsive storefront\nProduct and category management\nSearch, filters and wishlist\nCart and secure checkout\nPayment gateway integration\nOrder and inventory management\nCoupons and discount rules\nCustomer account and order tracking\nEmail order notifications\nBasic SEO and analytics',
      scopeOfWork: 'Discovery, UI/UX, storefront and admin development, payment integration, testing, product import support and deployment.',
      technologyStackIds: ['tech-react-js', 'tech-next-js', 'tech-node-js', 'tech-express-js', 'tech-postgresql', 'tech-payment-gateway-api', 'tech-aws', 'tech-docker'],
      timeline: '8-10 weeks',
      paymentInfo: '40% advance\n30% after storefront approval\n20% after integrations\n10% before launch',
      termsAndConditions: 'Up to 100 initial products are included for assisted import. Gateway, shipping aggregator and paid plugin charges are separate.',
      afterCompletion: '45-day bug-fix warranty\nAdmin and order-management training\nSource-code handover\nLaunch support',
      amcPlanId: 'amc-website-standard',
      nextYearCost: 30000,
      isRecurring: false,
      isAmcService: false
    }
  },
  {
    id: 'svc-whatsapp-api',
    type: 'service',
    name: 'WhatsApp Business API Integration',
    is_active: true,
    sort_order: 5,
    payload: {
      categoryId: 'svc-cat-development',
      categoryName: 'Development',
      sacCode: '998314',
      sac: '998314',
      gstRate: 18,
      unit: 'Project',
      defaultPrice: 25000,
      minimumBudget: 20000,
      serviceKind: 'addon',
      parentServiceIds: ['svc-web-dev', 'svc-ecommerce-dev'],
      description: 'WhatsApp Business API setup and transactional notification integration.',
      featuresText: 'Business account onboarding assistance\nApproved template configuration\nOrder/enquiry notifications\nWebhook integration\nDelivery-status logging',
      scopeOfWork: 'Configure the provider account, templates, API credentials, webhooks and agreed notification journeys.',
      technologyStackIds: ['tech-whatsapp-api', 'tech-rest-api-development', 'tech-node-js', 'tech-express-js'],
      timeline: '1-2 weeks after Meta approval',
      paymentInfo: '60% advance\n40% after integration testing',
      termsAndConditions: 'Meta/provider conversation charges and account approval are outside the development fee.',
      afterCompletion: 'API documentation and 15-day integration warranty',
      nextYearCost: 12000,
      isRecurring: false,
      isAmcService: false
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

const DEFAULT_QUOTATION_MASTERS = [
  {
    id: 'quotation-master-default',
    type: 'quotation_master',
    name: 'Default Quotation Profile',
    is_active: true,
    sort_order: 0,
    payload: {
      aboutCompany: 'Webitof is a premium software development company in Raipur, building practical websites, mobile apps and cloud software systems designed for growth.\nWe work with startups, service brands and established companies that need modern digital execution with measurable outcomes.\nOur business-first delivery model keeps projects practical, scalable and aligned with conversion, operations and long-term growth.',
      expertise: 'Website & Ecommerce Development\nMobile App Development\nCustom CRM, ERP & SaaS\nCloud Software & Business Automation',
      developmentCapabilities: 'React, Next.js, Node.js, PHP & Laravel\nFlutter & React Native\nMySQL, PostgreSQL & MongoDB\nAWS, Azure, Google Cloud & Docker',
      businessContactDetails: '+91 9174786123 / +91 9183456123\ncontact@webitof.com\nUnit No. 3033, 3rd Floor, Currency Tower, VIP Rd, Vishal Nagar, Raipur, Chhattisgarh 492001, India',
      experienceYears: '8+',
      clientsServed: '550+',
      projectsDelivered: '600+',
      countriesServed: '15+',
      clientsPageUrl: 'https://webitof.com/#clients',
      qrCaption: 'Scan to view all clients',
      topClients: [
        { id: 'webitof-client-gk-electric', name: 'Gk Electric', logoUrl: 'https://webitof.com/assets/images/clients-logo/gk-electric-logo.webp', logoFileId: '' },
        { id: 'webitof-client-kamla-horeca', name: 'Kamla Horeca', logoUrl: 'https://webitof.com/assets/images/clients-logo/kamla-horeca-logo.webp', logoFileId: '' },
        { id: 'webitof-client-vains', name: 'Vains', logoUrl: 'https://webitof.com/assets/images/clients-logo/vains-logo.webp', logoFileId: '' },
        { id: 'webitof-client-vedamrit', name: 'Vedamrit', logoUrl: 'https://webitof.com/assets/images/clients-logo/vedamrit-logo.webp', logoFileId: '' },
        { id: 'webitof-client-travel-tailor', name: 'Travel Tailor', logoUrl: 'https://webitof.com/assets/images/clients-logo/travel-tailor-logo.webp', logoFileId: '' },
        { id: 'webitof-client-wedding-lecious', name: 'The Wedding Lecious', logoUrl: 'https://webitof.com/assets/images/clients-logo/the-wedding-lecious-logo.webp', logoFileId: '' },
        { id: 'webitof-client-skillverse', name: 'Skillverse', logoUrl: 'https://webitof.com/assets/images/clients-logo/skillverse-logo.webp', logoFileId: '' },
        { id: 'webitof-client-abhiyantri', name: 'Abhiyantri', logoUrl: 'https://webitof.com/assets/images/clients-logo/abhiyantri-logo.webp', logoFileId: '' },
        { id: 'webitof-client-ahira', name: 'Ahira Eco Adventures', logoUrl: 'https://webitof.com/assets/images/clients-logo/ahira-eco-adventures-logo.webp', logoFileId: '' },
        { id: 'webitof-client-ca-monk', name: 'Ca Monk', logoUrl: 'https://webitof.com/assets/images/clients-logo/ca-monk-logo.webp', logoFileId: '' },
        { id: 'webitof-client-gpat', name: 'Gpat Discussion Center', logoUrl: 'https://webitof.com/assets/images/clients-logo/gpat-discussion-center-logo.webp', logoFileId: '' },
        { id: 'webitof-client-albury', name: 'Albury College', logoUrl: 'https://webitof.com/assets/images/clients-logo/albury-college-logo-2.webp', logoFileId: '' }
      ],
      backgroundImageUrl: 'builtin:invoice_watermark.png',
      backgroundImageFileId: '',
      backgroundOpacity: 8,
      isActive: true,
      sourceUrl: 'https://webitof.com/',
      sourceScannedAt: '2026-10-11'
    }
  }
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
    id: 'amc-website-standard',
    type: 'amc_type',
    name: 'Website Care - Standard',
    is_active: true,
    sort_order: 5,
    payload: {
      group: 'Maintenance', planCode: 'AMC-WEB-STD', description: 'Standard annual care plan for business and e-commerce websites.',
      defaultBillingCycle: 'Yearly', defaultReminderDays: 15, autoInvoice: true, durationMonths: 12,
      defaultCost: 18000, nextYearCost: 18000, supportHours: 12, responseSlaHours: 24,
      includedItems: 'Security and dependency updates\nScheduled backups\nUptime monitoring\nMinor content updates within support hours\nBug diagnosis\nMonthly health report',
      excludedItems: 'New modules or pages\nMajor UI redesign\nThird-party subscription charges\nBulk content entry\nPaid advertising or SEO campaigns',
      termsAndConditions: 'Unused support hours do not roll over. Critical incidents receive priority; enhancement work is separately estimated.',
      linkedServiceIds: ['svc-web-dev', 'svc-ecommerce-dev']
    }
  },
  {
    id: 'amc-website',
    type: 'amc_type',
    name: 'Website Maintenance',
    is_active: true,
    sort_order: 10,
    payload: {
      group: 'Maintenance', planCode: 'AMC-WEB-MONTHLY', description: 'Flexible monthly maintenance plan for websites.',
      defaultBillingCycle: 'Monthly', defaultReminderDays: 7, autoInvoice: true, durationMonths: 1,
      defaultCost: 5000, nextYearCost: 60000, supportHours: 10, responseSlaHours: 24,
      includedItems: 'Security and dependency updates\nScheduled backups\nUptime monitoring\nMinor content updates within support hours\nBug diagnosis',
      excludedItems: 'New modules or pages\nMajor UI redesign\nThird-party charges\nBulk content entry',
      termsAndConditions: 'Unused support hours do not roll over. Enhancement work is separately estimated.',
      linkedServiceIds: ['svc-web-dev', 'svc-ecommerce-dev']
    }
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

const DEFAULT_LEGAL_TERMS = [
  {
    id: 'legal-terms-conditions',
    type: 'legal_term',
    name: 'Terms and Conditions',
    is_active: true,
    sort_order: 1,
    payload: {
      documentType: 'terms_and_conditions',
      category: 'General',
      isDefault: true,
      includeInQuotation: true,
      description: 'Core commercial and operational terms & conditions for project proposals',
      content: `1. Quotation Validity: This quotation is valid for 30 calendar days from the date of issue.
2. Acceptance of Scope: Commencement of work shall begin upon receipt of the initial advance payment and signed proposal acceptance.
3. Client Deliverables: Timely delivery depends strictly on timely inputs, branding assets, API credentials, and approvals provided by the client.
4. Third-Party Costs: Domain names, web hosting, third-party API licenses, SMS gateways, and app store developer accounts are billed directly or separately.
5. Communication & Reviews: Primary communication, progress updates, and revision requests shall be handled through designated email and ticketing channels.
6. Governing Law & Dispute Resolution: This engagement is governed by local laws and subject to the exclusive jurisdiction of the competent courts in Raipur, Chhattisgarh.`
    }
  },
  {
    id: 'legal-service-agreement',
    type: 'legal_term',
    name: 'Service Agreement / Development Agreement',
    is_active: true,
    sort_order: 2,
    payload: {
      documentType: 'service_agreement',
      category: 'Contracts',
      isDefault: false,
      includeInQuotation: false,
      description: 'Formal Master Services & Software Development Agreement terms',
      content: `1. Professional Standard: The Service Provider agrees to deliver software engineering and digital services in a professional, workmanlike manner adhering to industry standards.
2. Independent Contractor: The relationship between the parties is that of an independent contractor. Neither party is an agent, partner, or joint venturer of the other.
3. Development Milestones: Engineering sprints and deliverable milestones will follow the approved project roadmap. Client feedback must be provided within 5 business days of milestone completion.
4. Post-Launch Warranty: A 30-day bug-fix warranty is provided following production release for bugs directly attributable to the agreed scope.
5. Non-Solicitation: During the engagement and for 12 months thereafter, neither party shall directly solicit or hire the employees or contractors of the other party without prior written consent.`
    }
  },
  {
    id: 'legal-sow',
    type: 'legal_term',
    name: 'SOW (Statement of Work)',
    is_active: true,
    sort_order: 3,
    payload: {
      documentType: 'sow',
      category: 'Project Governance',
      isDefault: false,
      includeInQuotation: false,
      description: 'Detailed scope specification, milestone deliverables, and exclusion boundaries',
      content: `1. Scope Boundaries: The deliverables and technical features explicitly outlined in this proposal constitute the entire scope of work. Any features not specifically mentioned are deemed out of scope.
2. Deliverable Verification: Each deliverable will be deployed to a designated staging environment for verification against the acceptance criteria.
3. Review Turnaround: The client agrees to test and provide consolidated feedback within 7 business days of each milestone drop. Absence of objections within this window constitutes deemed milestone approval.
4. Project Managers: Each party will designate a single Point of Contact (POC) authorized to sign off on technical clarifications, sprint reviews, and approvals.`
    }
  },
  {
    id: 'legal-payment-terms',
    type: 'legal_term',
    name: 'Payment Terms Agreement',
    is_active: true,
    sort_order: 4,
    payload: {
      documentType: 'payment_terms',
      category: 'Commercial',
      isDefault: false,
      includeInQuotation: true,
      description: 'Milestone billing schedule, due dates, late fees, and payment terms',
      content: `1. Payment Schedule:
   - 40% Advance Payment: Upon project signing and kickoff.
   - 40% Intermediate Milestone: Upon completion of core development & staging deployment.
   - 20% Final Settlement: Upon project UAT sign-off prior to production go-live & source transfer.
2. Due Date: Invoices are payable within 7 business days from date of presentation.
3. Late Payments: Overdue balances beyond 15 days incur interest at 1.5% per month or the legal statutory maximum.
4. Suspension of Work: The service provider reserves the right to suspend development and staging server access if payments remain past due for more than 10 business days.`
    }
  },
  {
    id: 'legal-nda',
    type: 'legal_term',
    name: 'NDA (Non-Disclosure Agreement)',
    is_active: true,
    sort_order: 5,
    payload: {
      documentType: 'nda',
      category: 'Confidentiality',
      isDefault: false,
      includeInQuotation: false,
      description: 'Confidentiality, trade secrets, business logic, and proprietary data protection',
      content: `1. Confidential Information: Both parties acknowledge that proprietary business data, customer records, technical architectures, credentials, and source code shared during this engagement constitute Confidential Information.
2. Duty of Care: Both parties agree to protect such confidential information with the same degree of care used for their own proprietary data, and in no event less than reasonable care.
3. Permitted Purpose: Confidential Information shall be used exclusively for the performance of obligations under this contract.
4. Exclusions: Confidentiality does not apply to information that is publicly known, rightfully received from a third party without breach, or independently developed.
5. Term: Confidentiality obligations remain binding during the engagement and for 3 years following contract termination.`
    }
  },
  {
    id: 'legal-ip-ownership',
    type: 'legal_term',
    name: 'IP Ownership / Source Code Agreement',
    is_active: true,
    sort_order: 6,
    payload: {
      documentType: 'ip_ownership',
      category: 'Intellectual Property',
      isDefault: false,
      includeInQuotation: true,
      description: 'Ownership transfer, repository access, licenses, and portfolio rights',
      content: `1. IP Transfer: Full intellectual property rights, copyright, custom source code, and design assets developed under this agreement transfer to the client upon 100% full settlement of all project invoices.
2. Pre-Existing Components: The Service Provider retains ownership of its proprietary pre-existing software libraries, boilerplate tools, and developer utilities incorporated into the project, granting the client a perpetual, royalty-free, worldwide license to use them.
3. Open-Source Libraries: Any third-party open-source libraries remain subject to their respective open-source license agreements (e.g., MIT, Apache 2.0).
4. Portfolio Credit: The Service Provider reserves the right to showcase non-confidential project screenshots, logos, and case study overviews in its company portfolio and marketing collateral.`
    }
  },
  {
    id: 'legal-change-request',
    type: 'legal_term',
    name: 'Change Request Agreement',
    is_active: true,
    sort_order: 7,
    payload: {
      documentType: 'change_request',
      category: 'Project Governance',
      isDefault: false,
      includeInQuotation: false,
      description: 'Change order workflow, scope expansion pricing, and timeline adjustments',
      content: `1. Scope Modification: Any modification, addition, or deletion to the approved specifications must follow a formal Change Request (CR) procedure.
2. Impact Analysis: Upon receiving a change request, the Service Provider will prepare a CR document detailing the technical feasibility, timeline impact, and associated commercial cost.
3. Sign-off Required: Work on requested changes will not commence until both parties have executed the written Change Request addendum and agreed upon pricing.
4. Billing Basis: Approved change requests will be billed at the standard hourly development rate or as a fixed-fee milestone addendum.`
    }
  },
  {
    id: 'legal-dpa',
    type: 'legal_term',
    name: 'DPA (Data Processing Agreement)',
    is_active: true,
    sort_order: 8,
    payload: {
      documentType: 'dpa',
      category: 'Security & Privacy',
      isDefault: false,
      includeInQuotation: false,
      description: 'Data protection standards, privacy compliance, IT Act & DPDP Act compliance',
      content: `1. Scope of Processing: The Service Provider shall process client personal and business data strictly to the extent necessary to deliver the contracted software engineering services.
2. Security Controls: The Service Provider implements administrative, physical, and technical safeguards including TLS 1.3 encryption in transit and encrypted data storage where applicable.
3. Sub-processors: Sub-processors (such as cloud hosting providers and database engines) engaged by the Service Provider are bound by data confidentiality terms at least as stringent as this agreement.
4. Incident Notification: In the event of a confirmed security breach involving client data, the Service Provider will notify the client within 48 hours and provide technical remediation assistance.
5. Data Deletion: Upon contract termination and written request, the Service Provider will securely erase or return client data from active development environments within 30 days.`
    }
  },
  {
    id: 'legal-sla',
    type: 'legal_term',
    name: 'SLA (Service Level Agreement)',
    is_active: true,
    sort_order: 9,
    payload: {
      documentType: 'sla',
      category: 'Operations',
      isDefault: false,
      includeInQuotation: false,
      description: 'Support response times, incident resolution categories, and service uptime',
      content: `1. Support Window: Standard technical assistance is provided Monday through Saturday, 10:00 AM to 7:00 PM IST (excluding public holidays).
2. Priority Response Times:
   - Priority 1 (System Down / Blocker): Response within 2 hours; resolution effort continuous until stabilized.
   - Priority 2 (Major Feature Impacted): Response within 6 business hours; workaround or fix within 24 hours.
   - Priority 3 (Minor Bug / UI Glitch): Response within 12 business hours; resolution in next scheduled build.
   - Priority 4 (General Inquiry / Task): Response within 24 business hours.
3. System Uptime: Managed cloud hosting environments aim for 99.5% service uptime excluding scheduled off-peak maintenance windows.`
    }
  },
  {
    id: 'legal-amc-agreement',
    type: 'legal_term',
    name: 'AMC / Maintenance Agreement',
    is_active: true,
    sort_order: 10,
    payload: {
      documentType: 'amc_agreement',
      category: 'Maintenance',
      isDefault: false,
      includeInQuotation: false,
      description: 'Annual maintenance contract terms, periodic updates, and support scope',
      content: `1. Coverage Period: AMC coverage is valid for 12 continuous months from the effective date, renewable annually.
2. Inclusions:
   - Routine dependency updates, security patches, and server monitoring.
   - Periodic database backups and recovery drills.
   - Dedicated technical support hours per month as specified in the chosen plan.
3. Exclusions: New feature modules, third-party API subscription costs, database migrations to new platforms, and design overhauls are excluded from AMC scope.
4. Non-Rollover: Unused monthly support hours do not carry over into subsequent months.
5. Invoicing: AMC fees are billed 100% in advance on an annual or quarterly schedule.`
    }
  },
  {
    id: 'legal-project-acceptance',
    type: 'legal_term',
    name: 'Project Acceptance / Sign-off',
    is_active: true,
    sort_order: 11,
    payload: {
      documentType: 'project_acceptance',
      category: 'Project Governance',
      isDefault: false,
      includeInQuotation: false,
      description: 'Formal User Acceptance Testing (UAT) guidelines and project acceptance criteria',
      content: `1. UAT Period: The client is granted a 10-business-day User Acceptance Testing (UAT) window upon deployment of the release candidate to the staging environment.
2. Issue Logging: Any variance between the approved scope and application behavior must be logged with reproducible steps within the UAT window.
3. Deemed Sign-off: If no blocker or critical defects are formally submitted within the 10-business-day UAT period, the project will be deemed accepted and signed off.
4. Production Release: Final production deployment and live domain cutover proceed immediately upon execution of the Acceptance Certificate.`
    }
  },
  {
    id: 'legal-handover-certificate',
    type: 'legal_term',
    name: 'Handover Certificate',
    is_active: true,
    sort_order: 12,
    payload: {
      documentType: 'handover_certificate',
      category: 'Project Governance',
      isDefault: false,
      includeInQuotation: false,
      description: 'Verification checklist for deliverables, credentials, and repository transfer',
      content: `1. Handover Verification: The Service Provider formally transfers the following deliverables upon final invoice clearance:
   - Production source code repository access and commit history.
   - Administrative credentials for CMS, hosting, and cloud infrastructure.
   - System configuration documentation, architectural diagrams, and deployment guides.
2. Handover Walkthrough: The Service Provider will conduct up to two 60-minute remote training walkthroughs with the client's internal team.
3. Acknowledgment: The client acknowledges receipt of all stated assets and confirms successful credential verification.`
    }
  },
  {
    id: 'legal-termination-closure',
    type: 'legal_term',
    name: 'Termination / Closure Agreement',
    is_active: true,
    sort_order: 13,
    payload: {
      documentType: 'termination_closure',
      category: 'Contracts',
      isDefault: false,
      includeInQuotation: false,
      description: 'Contract termination clauses, cure periods, and final account settlement',
      content: `1. Termination for Convenience: Either party may terminate this agreement by providing 30 days written notice to the other party.
2. Termination for Material Breach: If either party commits a material breach, the non-breaching party may issue written notice specifying the breach. If un-cured within 15 calendar days, the contract terminates immediately.
3. Financial Settlement: Upon termination, the client shall pay for all work completed, milestone progress, and non-cancellable expenses incurred up to the effective termination date.
4. Asset Return: Upon settlement of accounts, the Service Provider will transfer all completed deliverables and securely delete or return client confidential assets.`
    }
  }
];

module.exports = {
  DEFAULT_SETTINGS,
  DEFAULT_SERVICE_CATEGORIES,
  DEFAULT_SERVICES,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_TAX_RATES,
  DEFAULT_QUOTATION_MASTERS,
  DEFAULT_VENDORS,
  DEFAULT_RENEWAL_PROVIDERS,
  DEFAULT_AMC_TYPES,
  DEFAULT_BILLING_CYCLES,
  DEFAULT_INVOICE_TERMS,
  DEFAULT_LEGAL_TERMS
};
