// Seeds the Service Master (service categories + services) from the catalogue on webitof.com
// (nav menu, /services, /sitemap "Custom & Ready Software", CMS & design pages), read 2026-11-13.
//
// Prices are NOT on the website: defaultPrice / minimumBudget here are starting estimates, marked
// payload.priceEstimated = true so they can be reviewed in Service Master. Satta-matka pages on the
// sitemap are deliberately left out.
//
// Safe to re-run:
//   - a category or service is inserted only when neither its id nor its (type, name) exists, so
//     anything edited in Service Master stays as it is;
//   - the older default services (Website Development, E-commerce Website Development, WhatsApp
//     Business API Integration) move into the matching website category only while they still sit
//     in the old "Development" category, keeping their price and text;
//   - the old "Development" and "Design" categories are switched off once no active service uses them.
//
// Usage: node database/seed-website-services.js --yes   (writes to the database in DATABASE_URL)
const { withTransaction, closePool } = require('../config/db');

const SITE = 'https://webitof.com';
const SAC_IT = '998314'; // IT design and development services

const CATEGORIES = [
  ['svc-cat-core-development', 'Core Development', 'Websites, mobile apps, web applications, SaaS, cloud, CRM and ERP software development.'],
  ['svc-cat-whatsapp-api', 'WhatsApp API', 'Official WhatsApp Business API and Cloud API integration, automation, chatbots and CRM sync.'],
  ['svc-cat-custom-software', 'Custom Software', 'Software built to order for a business process or industry: CRM, ERP, HRM, billing, portals and apps.'],
  ['svc-cat-readymade-software', 'Readymade Software', 'Ready-to-deploy software and apps, customised and branded for the client.'],
  ['svc-cat-cms-design', 'CMS & Design', 'WordPress, Shopify, Elementor and other CMS builds, UI/UX and graphic design.']
];
// Categories kept from the ERP defaults (not on the website, but needed for hosting, AMC and support).
const KEPT_CATEGORY_ORDER = { 'svc-cat-hosting': 6, 'svc-cat-maintenance': 7, 'svc-cat-seo': 8, 'svc-cat-support': 9 };
const RETIRED_CATEGORIES = ['svc-cat-development', 'svc-cat-design'];
// Older default services and the website category they belong to.
const MOVED_SERVICES = {
  'svc-web-dev': 'svc-cat-core-development',
  'svc-ecommerce-dev': 'svc-cat-core-development',
  'svc-whatsapp-api': 'svc-cat-whatsapp-api'
};

const TERMS = {
  project: {
    paymentInfo: '40% advance\n30% after design / module approval\n30% before production launch',
    termsAndConditions: 'Scope as per the approved proposal. Two revision rounds are included. Client provides content, approvals and third-party accounts on time. Third-party licence, API, hosting and gateway charges are billed separately.',
    afterCompletion: '30-day bug-fix warranty\nAdmin training\nSource code and credential handover\nDeployment assistance'
  },
  readymade: {
    paymentInfo: '50% advance\n50% before go-live',
    termsAndConditions: 'Readymade product deployed with the client\'s branding and settings. Changes beyond configuration are quoted separately. Hosting, domain, SMS / WhatsApp / gateway charges are billed separately.',
    afterCompletion: 'Setup and data import assistance\nAdmin training\n30-day bug-fix warranty'
  },
  whatsapp: {
    paymentInfo: '60% advance\n40% after integration testing',
    termsAndConditions: 'Requires a Meta Business account and verified number. Meta conversation charges and BSP fees are billed by the provider. Templates are subject to Meta approval.',
    afterCompletion: 'API documentation\n15-day integration warranty\nTemplate and webhook handover'
  },
  design: {
    paymentInfo: '50% advance\n50% on final delivery',
    termsAndConditions: 'Two revision rounds are included. Source files are handed over after full payment. Stock images and fonts are licensed separately.',
    afterCompletion: 'Editable source files\nExport in agreed formats'
  }
};

const WEB = ['tech-html5', 'tech-css3', 'tech-javascript', 'tech-react-js', 'tech-next-js', 'tech-node-js', 'tech-postgresql', 'tech-aws'];
const MOBILE = ['tech-flutter', 'tech-react-native', 'tech-android', 'tech-ios', 'tech-dart', 'tech-firebase'];
const MERN = ['tech-mongodb', 'tech-express-js', 'tech-react-js', 'tech-node-js', 'tech-mern-stack'];
const API = ['tech-rest-api-development', 'tech-node-js', 'tech-jwt-authentication'];
const CLOUD = ['tech-aws', 'tech-docker', 'tech-ci-cd-pipeline', 'tech-cloudflare'];
const WA = ['tech-whatsapp-api', 'tech-rest-api-development', 'tech-node-js'];
const PAY = ['tech-payment-gateway-integration', 'tech-razorpay'];

// [id, name, category, price, { description, features, tech, timeline, unit, terms, path }]
const S = (id, name, category, price, extra) => ({ id, name, category, price, ...extra });
const lines = (...items) => items.join('\n');

const SERVICES = [
  // ---- Core Development (nav "Core Development" + /services "Core Service Pages") ----
  S('svc-app-dev', 'App Development', 'svc-cat-core-development', 150000, {
    path: '/app-development-company-in-raipur',
    description: 'Android, iOS, Flutter and React Native app development for startups and businesses, with scalable backends and secure APIs.',
    features: lines('Android app development', 'iOS app development', 'Flutter app development', 'React Native app development', 'Ecommerce app development', 'Business app development', 'Startup app development', 'Cross platform app development'),
    tech: [...MOBILE, 'tech-node-js', 'tech-rest-api-development'], timeline: '6-10 weeks'
  }),
  S('svc-software-dev', 'Software Development', 'svc-cat-core-development', 120000, {
    path: '/software-development-company-in-raipur',
    description: 'Custom software, automation platforms and process-focused enterprise solutions for growing businesses.',
    features: lines('Custom software development', 'Business automation software', 'Enterprise software solutions', 'Billing software', 'Inventory software', 'CRM software', 'ERP software', 'Cloud-based software'),
    tech: [...WEB, ...API], timeline: '6-12 weeks'
  }),
  S('svc-web-app-dev', 'Web Application Development', 'svc-cat-core-development', 100000, {
    path: '/web-application-development-company',
    description: 'Custom web app development, admin panels, dashboards and API systems on a cloud-ready architecture.',
    features: lines('Custom web applications', 'Dashboard development', 'Admin panel development', 'API development', 'SaaS web apps', 'CRM web apps', 'ERP web apps', 'Secure cloud web applications'),
    tech: [...WEB, ...API], timeline: '6-10 weeks'
  }),
  S('svc-mern-dev', 'MERN Stack Development', 'svc-cat-core-development', 120000, {
    path: '/mern-stack-development-company',
    description: 'MongoDB, Express, React and Node.js full stack product development with reliable APIs and product-ready dashboards.',
    features: lines('MongoDB development', 'Express.js development', 'React.js development', 'Node.js development', 'MERN web apps', 'MERN SaaS platforms', 'API development', 'Dashboard development'),
    tech: [...MERN, 'tech-rest-api-development', 'tech-aws'], timeline: '6-10 weeks'
  }),
  S('svc-nextjs-dev', 'Next.js Development', 'svc-cat-core-development', 60000, {
    path: '/next-js-development-company',
    description: 'SEO-friendly Next.js websites and scalable modern web applications with faster performance.',
    features: lines('Next.js website development', 'Next.js web application development', 'SEO optimized Next.js websites', 'Server side rendering', 'API routes', 'Dashboard development', 'SaaS development'),
    tech: ['tech-next-js', 'tech-react-js', 'tech-typescript', 'tech-tailwind-css', 'tech-node-js', 'tech-technical-seo'], timeline: '3-6 weeks'
  }),
  S('svc-cloud-software-dev', 'Cloud Software Development', 'svc-cat-core-development', 150000, {
    path: '/cloud-software-development-company',
    description: 'Cloud CRM, ERP, billing and scalable cloud software for multi-user business operations.',
    features: lines('Cloud software for businesses', 'Cloud CRM', 'Cloud ERP', 'Cloud billing software', 'Cloud inventory management software', 'SaaS platforms', 'Secure cloud applications', 'Scalable cloud solutions'),
    tech: [...WEB, ...CLOUD], timeline: '8-12 weeks'
  }),
  S('svc-saas-dev', 'SaaS Development', 'svc-cat-core-development', 250000, {
    path: '/saas-development-company',
    description: 'SaaS product development, MVP launch, subscription billing and dashboard modules, from MVP to full platform.',
    features: lines('SaaS product development', 'MVP development', 'Subscription software', 'Admin dashboard', 'User dashboard', 'Payment gateway integration', 'API integration', 'Cloud deployment'),
    tech: [...WEB, ...CLOUD, ...PAY], timeline: '10-16 weeks'
  }),
  S('svc-crm-software-dev', 'CRM Software Development', 'svc-cat-core-development', 120000, {
    path: '/crm-software-development-company',
    description: 'Lead management CRM, sales CRM, cloud CRM and automation workflows for customer communication and service.',
    features: lines('Custom CRM development', 'Lead management CRM', 'Sales CRM', 'Customer support CRM', 'Cloud CRM', 'CRM dashboard', 'CRM automation'),
    tech: [...WEB, 'tech-whatsapp-api', 'tech-email-api'], timeline: '6-10 weeks'
  }),
  S('svc-erp-software-dev', 'ERP Software Development', 'svc-cat-core-development', 250000, {
    path: '/erp-software-development-company',
    description: 'Custom ERP for inventory, billing, staff and operations management, connecting the whole business workflow.',
    features: lines('Custom ERP development', 'Inventory management', 'Billing management', 'Staff management', 'Sales management', 'Reports and dashboard', 'Cloud ERP'),
    tech: [...WEB, ...CLOUD], timeline: '10-16 weeks'
  }),

  // ---- WhatsApp API ----
  S('svc-wa-cloud-api', 'WhatsApp Cloud API Integration', 'svc-cat-whatsapp-api', 20000, {
    path: '/whatsapp-cloud-api-integration', terms: 'whatsapp',
    description: "Connects Meta's official WhatsApp Cloud API to websites, CRMs, ERPs, mobile apps and custom software, with webhooks, token management and sync logs.",
    features: lines('API token & webhook configuration', 'Programmatic message routing', 'CRM & ERP system integration', 'Template messages to unsaved numbers', 'Delivery and read status sync'),
    tech: [...WA, 'tech-crm-integration', 'tech-erp-integration'], timeline: '1-2 weeks after Meta approval'
  }),
  S('svc-wa-automation', 'WhatsApp Business API Automation', 'svc-cat-whatsapp-api', 30000, {
    path: '/whatsapp-business-api-automation-in-raipur', terms: 'whatsapp',
    description: 'Automates customer support, sales enquiries, order updates and appointment reminders on the official WhatsApp Business API.',
    features: lines('Automated replies and journeys', 'Order and appointment updates', 'Lead capture and routing', 'Broadcast with approved templates', 'Reports on delivery and replies'),
    tech: [...WA, 'tech-chatbot-integration'], timeline: '2-3 weeks after Meta approval'
  }),
  S('svc-wa-chatbot', 'WhatsApp Chatbot Development', 'svc-cat-whatsapp-api', 35000, {
    path: '/whatsapp-chatbot-development-in-raipur', terms: 'whatsapp',
    description: 'WhatsApp chatbots that answer customers, qualify leads and hand chats to the team, on the official Business API.',
    features: lines('Menu and keyword based bot flows', 'Lead qualification', 'FAQ and support answers', 'Human handover', 'CRM sync of conversations'),
    tech: [...WA, 'tech-chatbot-integration'], timeline: '2-4 weeks after Meta approval'
  }),
  S('svc-wa-crm-integration', 'WhatsApp CRM Integration', 'svc-cat-whatsapp-api', 25000, {
    path: '/whatsapp-crm-integration', terms: 'whatsapp',
    description: 'Syncs WhatsApp chat histories, incoming leads and follow-up updates into the CRM (Zoho, HubSpot, Salesforce, LeadSquared, Bitrix24 or custom CRMs).',
    features: lines('Unified chat history', 'CRM-triggered automations', 'Lead distribution & metrics'),
    tech: [...WA, 'tech-crm-integration'], timeline: '1-3 weeks'
  }),
  S('svc-wa-ecommerce-automation', 'WhatsApp Ecommerce Automation', 'svc-cat-whatsapp-api', 30000, {
    path: '/whatsapp-ecommerce-automation', terms: 'whatsapp',
    description: 'Order confirmations, shipping updates, abandoned-cart reminders and catalogue sharing for online stores over WhatsApp.',
    features: lines('Order confirmation messages', 'Shipping and delivery updates', 'Abandoned cart reminders', 'Catalogue and product sharing', 'Store / WooCommerce / Shopify integration'),
    tech: [...WA, 'tech-woocommerce', 'tech-shopify', 'tech-shiprocket-integration'], timeline: '2-3 weeks after Meta approval'
  }),
  S('svc-wa-notification-api', 'WhatsApp Notification API', 'svc-cat-whatsapp-api', 15000, {
    path: '/whatsapp-notification-api', terms: 'whatsapp',
    description: 'Transactional WhatsApp notifications (OTP, alerts, invoices, reminders) sent from your software through an API.',
    features: lines('Template based notifications', 'OTP and alert messages', 'Invoice / document sending', 'Delivery status logging', 'API for your software'),
    tech: WA, timeline: '1-2 weeks after Meta approval'
  }),
  S('svc-wa-schools', 'WhatsApp API for Schools & Colleges', 'svc-cat-whatsapp-api', 25000, {
    path: '/whatsapp-api-for-schools-colleges-in-raipur', terms: 'whatsapp',
    description: 'WhatsApp API for schools and colleges: admission enquiries, fee reminders, attendance and notice alerts to parents and students.',
    features: lines('Admission enquiry automation', 'Fee reminders', 'Attendance and result alerts', 'Notices and circulars', 'Parent communication'),
    tech: WA, timeline: '2-3 weeks after Meta approval'
  }),
  S('svc-wa-real-estate', 'WhatsApp API for Real Estate', 'svc-cat-whatsapp-api', 25000, {
    path: '/whatsapp-api-for-real-estate-in-raipur', terms: 'whatsapp',
    description: 'WhatsApp API for real estate: property enquiry capture, brochure sharing, site-visit booking and follow-ups.',
    features: lines('Property enquiry capture', 'Brochure and listing sharing', 'Site visit booking', 'Lead follow-up reminders', 'CRM integration'),
    tech: [...WA, 'tech-crm-integration'], timeline: '2-3 weeks after Meta approval'
  }),
  S('svc-wa-clinic', 'WhatsApp API for Clinic & Hospital', 'svc-cat-whatsapp-api', 25000, {
    path: '/whatsapp-api-for-clinic-hospital-in-raipur', terms: 'whatsapp',
    description: 'WhatsApp API for clinics and hospitals: appointment booking, reminders, reports sharing and patient follow-ups.',
    features: lines('Appointment booking', 'Appointment reminders', 'Report and prescription sharing', 'Patient follow-ups', 'Health camp and offer broadcasts'),
    tech: WA, timeline: '2-3 weeks after Meta approval'
  }),

  // ---- Custom Software (/sitemap "Custom & Ready Software", custom pages) ----
  S('svc-custom-crm', 'Custom CRM Development', 'svc-cat-custom-software', 120000, {
    path: '/custom-crm-development-in-raipur',
    description: 'CRM built around your sales process: leads, pipelines, follow-ups, team roles and reports.',
    features: lines('Lead and pipeline management', 'Follow-ups and reminders', 'Roles and permissions', 'WhatsApp / email integration', 'Reports and dashboards'),
    tech: [...WEB, 'tech-whatsapp-api'], timeline: '6-10 weeks'
  }),
  S('svc-custom-erp', 'Custom ERP Development', 'svc-cat-custom-software', 250000, {
    path: '/custom-erp-development-in-raipur',
    description: 'ERP built for your operations: inventory, purchase, sales, billing, staff and accounts in one system.',
    features: lines('Inventory and purchase', 'Sales and billing with GST', 'Staff and HR', 'Accounts and reports', 'Role-based access'),
    tech: [...WEB, ...CLOUD], timeline: '10-16 weeks'
  }),
  S('svc-custom-hrm', 'Custom HRM Development', 'svc-cat-custom-software', 150000, {
    path: '/custom-hrm-development-in-raipur',
    description: 'HRM software for employees, attendance, leave, payroll and HR workflows, with an employee app if needed.',
    features: lines('Employee records', 'Attendance and geofencing', 'Leave management', 'Payroll and payslips', 'Employee self-service app'),
    tech: [...WEB, 'tech-flutter'], timeline: '8-12 weeks'
  }),
  S('svc-custom-billing', 'Custom Billing Software Development', 'svc-cat-custom-software', 60000, {
    path: '/custom-billing-software-development-in-raipur',
    description: 'Billing software made for your business: GST invoices, payments, stock and reports.',
    features: lines('GST invoicing', 'Payment tracking', 'Customer and product masters', 'Stock management', 'Sales and tax reports'),
    tech: WEB, timeline: '4-6 weeks'
  }),
  S('svc-custom-rto', 'RTO Service Management Software', 'svc-cat-custom-software', 80000, {
    path: '/custom-rto-service-management-software-development-in-raipur',
    description: 'Software for RTO agents and consultants to manage vehicle work, documents, customers, fees and reminders.',
    features: lines('Customer and vehicle records', 'Service / work tracking', 'Document management', 'Fees and payments', 'Renewal reminders'),
    tech: WEB, timeline: '5-8 weeks'
  }),
  S('svc-custom-tour-travel', 'Tour & Travel Website and App Development', 'svc-cat-custom-software', 150000, {
    path: '/custom-tour-and-travel-website-and-app-development-in-raipur',
    description: 'Tour and travel website and app with packages, enquiries, bookings and payments.',
    features: lines('Tour package listing', 'Enquiry and booking', 'Online payments', 'Customer app', 'Admin panel'),
    tech: [...WEB, ...MOBILE, ...PAY], timeline: '8-12 weeks'
  }),
  S('svc-custom-ecommerce', 'Custom Ecommerce Development', 'svc-cat-custom-software', 120000, {
    path: '/custom-ecommerce-development-in-raipur',
    description: 'Custom-built ecommerce store with catalogue, cart, payments, orders and an admin panel.',
    features: lines('Product catalogue', 'Cart and checkout', 'Payment gateway', 'Order and inventory management', 'Admin dashboard'),
    tech: [...WEB, 'tech-custom-e-commerce-development', ...PAY, 'tech-shiprocket-integration'], timeline: '8-12 weeks'
  }),
  S('svc-custom-info-website', 'Informational Website Development', 'svc-cat-custom-software', 20000, {
    path: '/custom-informational-website-development-in-raipur',
    description: 'Business information website presenting the company, services and contact details, SEO-ready.',
    features: lines('Up to 6 pages', 'Responsive design', 'Contact / enquiry form', 'Basic on-page SEO', 'Google Maps and WhatsApp button'),
    tech: ['tech-html5', 'tech-css3', 'tech-javascript', 'tech-wordpress', 'tech-on-page-seo'], timeline: '7-15 working days'
  }),
  S('svc-custom-clothes-billing', 'Clothes Billing Software Development', 'svc-cat-custom-software', 50000, {
    path: '/custom-clothes-billing-software-development-in-raipur',
    description: 'Billing and stock software for clothing stores, with size / colour variants, barcodes and GST bills.',
    features: lines('Size and colour variants', 'Barcode billing', 'GST invoices', 'Stock and purchase', 'Sales reports'),
    tech: WEB, timeline: '4-6 weeks'
  }),
  S('svc-custom-urbanclap-clone', 'UrbanClap Clone Web & App Development', 'svc-cat-custom-software', 250000, {
    path: '/custom-urban-clap-clone-web-and-app-development-in-raipur',
    description: 'Home-services marketplace like Urban Company: customer app, partner app, bookings, payments and admin panel.',
    features: lines('Customer app and website', 'Service partner app', 'Booking and scheduling', 'Online payments and commission', 'Admin panel'),
    tech: [...WEB, ...MOBILE, ...PAY, 'tech-google-maps-api'], timeline: '12-16 weeks'
  }),
  S('svc-custom-classified', 'Classified Portal Development', 'svc-cat-custom-software', 80000, {
    path: '/custom-classified-development-in-raipur',
    description: 'Classified ads portal where users post and search listings by category and location.',
    features: lines('Ad posting and categories', 'Search and location filters', 'User accounts', 'Paid / featured listings', 'Admin moderation'),
    tech: [...WEB, ...PAY], timeline: '6-8 weeks'
  }),
  S('svc-custom-news-portal', 'News Portal Development', 'svc-cat-custom-software', 50000, {
    path: '/custom-news-portal-development-in-raipur',
    description: 'News portal with categories, editors, fast article pages and ad slots.',
    features: lines('Categories and tags', 'Editor and reporter roles', 'Breaking news and video', 'Ad placements', 'SEO and social sharing'),
    tech: ['tech-wordpress', 'tech-next-js', 'tech-technical-seo', 'tech-page-speed-optimization'], timeline: '3-5 weeks'
  }),
  S('svc-custom-matrimonial-app', 'Matrimonial App Development', 'svc-cat-custom-software', 150000, {
    path: '/custom-matrimonial-app-development-in-raipur',
    description: 'Custom matrimonial app with profiles, matching, chat and paid membership plans.',
    features: lines('Profile creation and verification', 'Search and match filters', 'Interest and chat', 'Membership plans', 'Admin panel'),
    tech: [...MOBILE, 'tech-node-js', ...PAY], timeline: '10-14 weeks'
  }),
  S('svc-custom-matrimonial-website', 'Matrimonial Website Development', 'svc-cat-custom-software', 70000, {
    path: '/custom-matrimonial-website-development-in-raipur',
    description: 'Custom matrimonial website with profiles, matching, enquiries and paid membership plans.',
    features: lines('Profile creation and verification', 'Search and match filters', 'Interest and messaging', 'Membership plans', 'Admin panel'),
    tech: [...WEB, ...PAY], timeline: '6-8 weeks'
  }),
  S('svc-cab-booking', 'Cab Booking App and Website Development', 'svc-cat-custom-software', 300000, {
    path: '/cab-booking-app-and-website-development-in-raipur',
    description: 'Cab booking platform with rider app, driver app, live tracking, fares, payments and admin panel.',
    features: lines('Rider app and website', 'Driver app', 'Live tracking and maps', 'Fare and payment management', 'Admin and dispatch panel'),
    tech: [...MOBILE, 'tech-node-js', 'tech-socket-io', 'tech-google-maps-api', ...PAY], timeline: '12-16 weeks'
  }),
  S('svc-real-estate-website', 'Real Estate Website Development', 'svc-cat-custom-software', 50000, {
    path: '/real-estate-website-development-company-in-raipur',
    description: 'Real estate website with property listings, search, enquiry capture and site-visit booking.',
    features: lines('Property listings', 'Search and filters', 'Enquiry and site visit forms', 'Agent / builder pages', 'WhatsApp and CRM integration'),
    tech: [...WEB, 'tech-google-maps-api', 'tech-crm-integration'], timeline: '3-5 weeks'
  }),

  // ---- Readymade Software ----
  S('svc-readymade-crm', 'Readymade CRM Software', 'svc-cat-readymade-software', 30000, {
    path: '/readymade-crm-software-development-in-raipur', terms: 'readymade', unit: 'License',
    description: 'Ready-to-deploy CRM for leads, deals and sales pipelines, customised and deployed for your team.',
    features: lines('Lead & pipeline management (Kanban, lead routing)', 'Automated follow-ups (WhatsApp, SMS, email templates)', 'Sales analytics & reports (CSV/PDF export)', 'CSV / Excel import', 'Custom fields and pipeline stages', 'Cloud hosting with daily backups'),
    tech: [...WEB, 'tech-whatsapp-api', 'tech-sms-api'], timeline: '1-2 weeks'
  }),
  S('svc-readymade-erp', 'Readymade ERP Software', 'svc-cat-readymade-software', 60000, {
    path: '/readymade-erp-software-development-in-raipur', terms: 'readymade', unit: 'License',
    description: 'Ready-to-deploy ERP for inventory, billing, purchase, staff and reports.',
    features: lines('Inventory and purchase', 'GST billing', 'Staff management', 'Reports and dashboard', 'Cloud hosting'),
    tech: WEB, timeline: '2-3 weeks'
  }),
  S('svc-readymade-hrm', 'Readymade HRM Software', 'svc-cat-readymade-software', 35000, {
    path: '/readymade-hrm-software-development-in-raipur', terms: 'readymade', unit: 'License',
    description: 'Ready-to-deploy HRM for employees, attendance, leave and payroll.',
    features: lines('Employee records', 'Attendance', 'Leave management', 'Payroll and payslips', 'Employee app'),
    tech: [...WEB, 'tech-flutter'], timeline: '1-2 weeks'
  }),
  S('svc-readymade-pos', 'Readymade POS Software', 'svc-cat-readymade-software', 25000, {
    path: '/readymade-pos-software-development-in-raipur', terms: 'readymade', unit: 'License',
    description: 'Point-of-sale software for shops and restaurants: quick billing, stock and daily reports.',
    features: lines('Quick billing / barcode', 'GST bills', 'Stock management', 'Customer records', 'Daily sales reports'),
    tech: WEB, timeline: '1 week'
  }),
  S('svc-readymade-billing-cloud', 'Readymade Billing Cloud Software', 'svc-cat-readymade-software', 20000, {
    path: '/readymade-billing-cloud-software-development-in-raipur', terms: 'readymade', unit: 'License',
    description: 'Cloud billing software usable from any device: GST invoices, payments and reports.',
    features: lines('GST invoices', 'Payment tracking', 'Customer and product masters', 'Multi-device cloud access', 'Reports'),
    tech: [...WEB, 'tech-aws'], timeline: '1 week'
  }),
  S('svc-readymade-gym', 'Readymade Gym Management System', 'svc-cat-readymade-software', 30000, {
    path: '/readymade-gym-management-system-development-in-raipur', terms: 'readymade', unit: 'License',
    description: 'Gym management software for members, plans, fees, attendance and trainers.',
    features: lines('Member and plan management', 'Fee collection and reminders', 'Attendance', 'Trainer management', 'WhatsApp reminders'),
    tech: [...WEB, 'tech-whatsapp-api'], timeline: '1-2 weeks'
  }),
  S('svc-readymade-medical-store', 'Readymade Medical Online Store App & Web App', 'svc-cat-readymade-software', 80000, {
    path: '/readymade-medical-online-store-app-and-web-app-development-in-raipur', terms: 'readymade', unit: 'License',
    description: 'Online medical store app and web app with prescription upload, orders, payments and delivery.',
    features: lines('Customer app and web app', 'Prescription upload', 'Orders and payments', 'Delivery tracking', 'Admin panel'),
    tech: [...MOBILE, ...WEB, ...PAY], timeline: '3-4 weeks'
  }),
  S('svc-readymade-grocery-store', 'Readymade Grocery Online Store App & Web App', 'svc-cat-readymade-software', 80000, {
    path: '/readymade-grocery-online-store-app-and-web-app-development-in-raipur', terms: 'readymade', unit: 'License',
    description: 'Online grocery store app and web app with catalogue, slots, payments and delivery.',
    features: lines('Customer app and web app', 'Catalogue and offers', 'Delivery slots', 'Online payments', 'Admin and delivery panel'),
    tech: [...MOBILE, ...WEB, ...PAY], timeline: '3-4 weeks'
  }),
  S('svc-readymade-blinkit-clone', 'Readymade Blinkit Clone App & Web App', 'svc-cat-readymade-software', 150000, {
    path: '/readymade-blinkit-clone-app-and-web-app-development-in-raipur', terms: 'readymade', unit: 'License',
    description: 'Quick-commerce app like Blinkit: customer app, store / dark-store panel, delivery app and admin.',
    features: lines('Customer app and web app', 'Store / dark-store panel', 'Delivery partner app', 'Live order tracking', 'Admin panel'),
    tech: [...MOBILE, ...WEB, 'tech-google-maps-api', ...PAY], timeline: '4-6 weeks'
  }),
  S('svc-readymade-salon', 'Readymade Multi Vendor Salon Web App & App', 'svc-cat-readymade-software', 120000, {
    path: '/readymade-multi-vendor-salon-web-app-and-app-development-in-raipur', terms: 'readymade', unit: 'License',
    description: 'Multi-vendor salon booking platform: customer app, salon panel, bookings, payments and admin.',
    features: lines('Customer app and web app', 'Salon / vendor panel', 'Appointment booking', 'Online payments and commission', 'Admin panel'),
    tech: [...MOBILE, ...WEB, ...PAY], timeline: '4-6 weeks'
  }),
  S('svc-readymade-clothes-billing', 'Ready to Use Clothes Billing Software', 'svc-cat-readymade-software', 20000, {
    path: '/ready-to-use-clothes-billing-software-development-in-raipur', terms: 'readymade', unit: 'License',
    description: 'Ready-to-use billing and stock software for clothing stores.',
    features: lines('Size and colour variants', 'Barcode billing', 'GST invoices', 'Stock reports'),
    tech: WEB, timeline: '1 week'
  }),
  S('svc-readymade-matrimonial-website', 'Ready to Use Matrimonial Website', 'svc-cat-readymade-software', 30000, {
    path: '/ready-to-use-matrimonial-website-development-in-raipur', terms: 'readymade', unit: 'License',
    description: 'Ready-to-use matrimonial website with profiles, search, interests and membership plans.',
    features: lines('Profiles and search', 'Interests and messaging', 'Membership plans', 'Admin panel'),
    tech: [...WEB, ...PAY], timeline: '1-2 weeks'
  }),
  S('svc-readymade-matrimonial-app', 'Ready to Use Matrimonial App', 'svc-cat-readymade-software', 60000, {
    path: '/ready-to-use-matrimonial-app-development-in-raipur', terms: 'readymade', unit: 'License',
    description: 'Ready-to-use matrimonial app with profiles, matching, chat and membership plans.',
    features: lines('Profiles and search', 'Interests and chat', 'Membership plans', 'Push notifications', 'Admin panel'),
    tech: [...MOBILE, ...PAY], timeline: '2-3 weeks'
  }),

  // ---- CMS & Design ----
  S('svc-wordpress-dev', 'WordPress Development', 'svc-cat-cms-design', 25000, {
    path: '/wordpress-developer-in-raipur',
    description: 'WordPress websites with custom themes and plugins, fast, secure and easy to manage.',
    features: lines('Custom WordPress theme', 'Plugin development and setup', 'Responsive design', 'Speed and security hardening', 'On-page SEO setup'),
    tech: ['tech-wordpress', 'tech-custom-wordpress-theme-development', 'tech-wordpress-plugin-development', 'tech-php', 'tech-mysql'], timeline: '2-3 weeks'
  }),
  S('svc-woocommerce-dev', 'WooCommerce Development', 'svc-cat-cms-design', 45000, {
    path: '/woocommerce-developer-in-raipur',
    description: 'WooCommerce online stores on WordPress with payments, shipping and order management.',
    features: lines('Product catalogue and variants', 'Payment gateway', 'Shipping integration', 'Order management', 'Coupons and offers'),
    tech: ['tech-woocommerce', 'tech-wordpress', ...PAY, 'tech-shiprocket-integration'], timeline: '3-5 weeks'
  }),
  S('svc-shopify-dev', 'Shopify Development', 'svc-cat-cms-design', 40000, {
    path: '/shopify-developer-in-raipur',
    description: 'Shopify store setup and customisation: theme, products, payments and apps.',
    features: lines('Theme setup and customisation', 'Product and collection setup', 'Payment and shipping setup', 'App integration', 'Store launch'),
    tech: ['tech-shopify', ...PAY], timeline: '2-4 weeks'
  }),
  S('svc-elementor-dev', 'Elementor Development', 'svc-cat-cms-design', 20000, {
    path: '/elementor-developer-in-raipur',
    description: 'Elementor-built WordPress pages and websites, easy for your team to edit.',
    features: lines('Elementor page design', 'Landing pages', 'Responsive layouts', 'Forms and popups', 'Editable templates'),
    tech: ['tech-elementor', 'tech-wordpress'], timeline: '1-2 weeks'
  }),
  S('svc-gutenberg-dev', 'Gutenberg Development', 'svc-cat-cms-design', 20000, {
    path: '/gutenberg-developer-in-raipur',
    description: 'WordPress sites and custom blocks built with the Gutenberg block editor.',
    features: lines('Custom Gutenberg blocks', 'Block patterns and templates', 'Responsive layouts', 'Editor-friendly setup'),
    tech: ['tech-gutenberg', 'tech-wordpress', 'tech-react-js'], timeline: '1-3 weeks'
  }),
  S('svc-webflow-dev', 'Webflow Development', 'svc-cat-cms-design', 35000, {
    path: '/webflow-developer-in-raipur',
    description: 'Webflow websites with CMS collections, interactions and responsive design.',
    features: lines('Webflow design and build', 'CMS collections', 'Interactions and animations', 'Responsive layouts', 'Hosting setup'),
    tech: ['tech-webflow'], timeline: '2-3 weeks'
  }),
  S('svc-figma-uiux', 'Figma UI/UX Design', 'svc-cat-cms-design', 25000, {
    path: '/figma-designer-in-raipur', terms: 'design',
    description: 'UI/UX design in Figma for websites and apps: wireframes, design system and clickable prototype.',
    features: lines('User flows and wireframes', 'High-fidelity screens', 'Design system / components', 'Clickable prototype', 'Developer handoff'),
    tech: ['tech-figma', 'tech-wireframing', 'tech-prototyping', 'tech-responsive-ui-design'], timeline: '1-3 weeks'
  }),
  S('svc-graphic-design', 'Graphic Design', 'svc-cat-cms-design', 5000, {
    path: '/photoshop-designer-in-raipur', terms: 'design', unit: 'Design',
    description: 'Graphic design for brand and marketing: logos, social media creatives, banners and brochures.',
    features: lines('Logo and brand assets', 'Social media creatives', 'Banners and posters', 'Brochures and flyers'),
    tech: ['tech-photoshop', 'tech-illustrator', 'tech-canva'], timeline: '2-5 working days'
  }),
  S('svc-wireframe-prototype', 'Wireframing & Prototyping', 'svc-cat-cms-design', 15000, {
    path: '/wireframing-designer-in-raipur', terms: 'design',
    description: 'Wireframes and interactive prototypes to plan screens and flows before development.',
    features: lines('Sitemap and user flows', 'Low-fidelity wireframes', 'Interactive prototype', 'Review sessions'),
    tech: ['tech-wireframing', 'tech-prototyping', 'tech-figma'], timeline: '1-2 weeks'
  })
];

function servicePayload(service, category, order) {
  const terms = TERMS[service.terms || 'project'];
  const price = service.price;
  return {
    categoryId: category[0],
    categoryName: category[1],
    sacCode: SAC_IT,
    sac: SAC_IT,
    gstRate: 18,
    unit: service.unit || 'Project',
    defaultPrice: price,
    // Starting figure, not from the website: review in Service Master.
    minimumBudget: Math.round((price * 0.8) / 1000) * 1000,
    priceEstimated: true,
    serviceKind: 'primary',
    parentServiceIds: [],
    description: service.description,
    featuresText: service.features,
    scopeOfWork: `Requirement discovery, planning, ${service.name.toLowerCase()} as per the approved scope, testing, deployment and handover.`,
    technologyStackIds: [...new Set(service.tech || [])],
    timeline: service.timeline || '',
    paymentInfo: terms.paymentInfo,
    termsAndConditions: terms.termsAndConditions,
    afterCompletion: terms.afterCompletion,
    isRecurring: false,
    isAmcService: false,
    nextYearCost: 0,
    sourceUrl: `${SITE}${service.path}`,
    sortOrder: order,
    priceHistory: [{
      id: `svc-price-seed-${service.id}`,
      from: price,
      to: price,
      reason: 'created (estimated starting price, website seed)',
      changedAt: new Date().toISOString(),
      changedBy: { id: null, name: 'Website services seed', username: null, email: null }
    }],
    lastPriceChangeAt: new Date().toISOString(),
    lastPriceChangeBy: { id: null, name: 'Website services seed', username: null, email: null }
  };
}

async function seed(db) {
  const counts = { categoriesAdded: 0, servicesAdded: 0, servicesSkipped: 0, servicesMoved: 0, categoriesRetired: 0 };
  const exists = async (id, type, name) => (await db.query('select 1 from master_items where id = $1 or (type = $2 and lower(name) = lower($3))', [id, type, name])).rowCount > 0;

  for (const [index, [id, name, description]] of CATEGORIES.entries()) {
    if (await exists(id, 'service_category', name)) continue;
    await db.query(
      `insert into master_items (id, type, name, is_active, sort_order, payload) values ($1, 'service_category', $2, true, $3, $4::jsonb)`,
      [id, name, index + 1, JSON.stringify({ description, sourceUrl: `${SITE}/services` })]
    );
    counts.categoriesAdded += 1;
  }
  for (const [id, order] of Object.entries(KEPT_CATEGORY_ORDER)) {
    await db.query("update master_items set sort_order = $2, updated_at = now() where id = $1 and type = 'service_category'", [id, order]);
  }

  const categoryById = new Map((await db.query("select id, name from master_items where type = 'service_category'")).rows.map((r) => [r.id, [r.id, r.name]]));
  for (const [index, service] of SERVICES.entries()) {
    if (await exists(service.id, 'service', service.name)) {
      counts.servicesSkipped += 1;
      continue;
    }
    const category = categoryById.get(service.category);
    if (!category) throw new Error(`Category ${service.category} missing for ${service.name}`);
    await db.query(
      `insert into master_items (id, type, name, is_active, sort_order, payload) values ($1, 'service', $2, true, $3, $4::jsonb)`,
      [service.id, service.name, 100 + index, JSON.stringify(servicePayload(service, category, 100 + index))]
    );
    counts.servicesAdded += 1;
  }

  // Older defaults join the website categories while still in the old "Development" category.
  for (const [id, categoryId] of Object.entries(MOVED_SERVICES)) {
    const category = categoryById.get(categoryId);
    const moved = await db.query(
      `update master_items
          set payload = payload || jsonb_build_object('categoryId', $2::text, 'categoryName', $3::text), updated_at = now()
        where id = $1 and type = 'service' and payload->>'categoryId' = 'svc-cat-development'`,
      [id, category[0], category[1]]
    );
    counts.servicesMoved += moved.rowCount;
  }

  for (const id of RETIRED_CATEGORIES) {
    const inUse = await db.query("select 1 from master_items where type = 'service' and is_active = true and payload->>'categoryId' = $1 limit 1", [id]);
    if (inUse.rowCount) continue;
    const retired = await db.query("update master_items set is_active = false, updated_at = now() where id = $1 and type = 'service_category' and is_active = true", [id]);
    counts.categoriesRetired += retired.rowCount;
  }
  return counts;
}

if (require.main === module) {
  if (!process.argv.includes('--yes')) {
    console.error('Adds the webitof.com service categories and services to the database in DATABASE_URL. Re-run with --yes to continue.');
    process.exit(1);
  }
  const target = (() => {
    try {
      const u = new URL(String(process.env.DATABASE_URL || require('dotenv').config().parsed?.DATABASE_URL || '').replace(/^"|"$/g, ''));
      return `${u.hostname}:${u.port || 5432}/${u.pathname.slice(1)}`;
    } catch {
      return 'DATABASE_URL';
    }
  })();
  withTransaction(seed)
    .then((counts) => {
      console.log(`Website services seeded into ${target}:`);
      for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(20)} ${v}`);
    })
    .catch((e) => {
      console.error('Seeding failed, nothing was changed:', e.message);
      process.exitCode = 1;
    })
    .finally(closePool);
}

module.exports = { seed, CATEGORIES, SERVICES };
