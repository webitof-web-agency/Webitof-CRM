export const QUOTATION_PACKAGE_PRESETS = [
  {
    id: 'pkg-corporate-website',
    name: 'Corporate Website',
    icon: 'Globe',
    badge: 'Popular',
    title: 'Custom Corporate Website Development',
    serviceNames: ['Web Development', 'UI/UX Design', 'SEO Optimization'],
    amount: 35000,
    validityDays: 30,
    gstApplicable: true,
    gstRate: 18,
    milestoneTemplate: '50% Advance on Project Kickoff, 30% on Design & Prototype Approval, 20% on Final Go-Live',
    items: [
      { name: 'UI/UX Wireframes & Visual Design', description: 'Custom responsive layout design for 5-8 core pages with interactive prototyping.', qty: 1, rate: 10000, amount: 10000 },
      { name: 'Frontend & Backend Development', description: 'Modern React/Next.js/WordPress responsive build, contact forms, CMS integration.', qty: 1, rate: 18000, amount: 18000 },
      { name: 'On-Page SEO & Performance Tuning', description: 'Meta tags, sitemap setup, schema markup, 90+ Google PageSpeed score optimization.', qty: 1, rate: 4000, amount: 4000 },
      { name: 'Domain, SSL & Cloud Deployment', description: 'Cloud server setup, SSL encryption, business email routing and launch.', qty: 1, rate: 3000, amount: 3000 }
    ],
    terms: '1. 50% advance to initiate work.\n2. Delivery timeline: 14 business days from content handover.\n3. Includes 30 days of free post-launch support and bug fixes.'
  },
  {
    id: 'pkg-ecommerce-store',
    name: 'E-Commerce Store',
    icon: 'ShoppingCart',
    badge: 'High Value',
    title: 'Full-Stack E-Commerce Store & Payment Gateway',
    serviceNames: ['E-Commerce', 'Web Development', 'Payment Gateway'],
    amount: 65000,
    validityDays: 30,
    gstApplicable: true,
    gstRate: 18,
    milestoneTemplate: '40% Advance, 40% on Catalog & Payment Integration, 20% on Handover & Training',
    items: [
      { name: 'E-Commerce Platform Architecture', description: 'Custom store setup with product categories, variations, stock management & filters.', qty: 1, rate: 25000, amount: 25000 },
      { name: 'Payment & Logistics Integration', description: 'Razorpay / Cashfree / Stripe UPI gateway integration with automated courier tracking (Shiprocket / Delhivery).', qty: 1, rate: 15000, amount: 15000 },
      { name: 'Customer Portal & Cart Experience', description: 'Wishlist, instant checkout, WhatsApp order notifications, discount coupon engine.', qty: 1, rate: 15000, amount: 15000 },
      { name: 'Admin Dashboard & Analytics', description: 'Sales report generator, invoice downloading, inventory alert dashboard.', qty: 1, rate: 10000, amount: 10000 }
    ],
    terms: '1. Client provides product imagery and SKU data.\n2. Gateway approvals subject to client business KYC.\n3. Includes 45 days post-launch support.'
  },
  {
    id: 'pkg-custom-crm-saas',
    name: 'Custom CRM / SaaS Platform',
    icon: 'LayoutGrid',
    badge: 'Enterprise',
    title: 'Custom Cloud CRM & Workflow Automation Suite',
    serviceNames: ['Custom CRM', 'Cloud Architecture', 'API Integration'],
    amount: 125000,
    validityDays: 45,
    gstApplicable: true,
    gstRate: 18,
    milestoneTemplate: '35% Advance, 35% on Alpha Core Build, 20% on Integration & Testing, 10% on Go-Live',
    items: [
      { name: 'System Architecture & Database Schema', description: 'Scalable multi-tenant PostgreSQL/Node architecture with role-based access control (RBAC).', qty: 1, rate: 35000, amount: 35000 },
      { name: 'Lead Pipeline & Contact Management', description: 'Kanban boards, customizable stages, activity timeline, and bulk CSV export/import.', qty: 1, rate: 35000, amount: 35000 },
      { name: 'Invoicing & Automated Follow-Up Engine', description: 'Automated invoice builder with UPI QR, follow-up SLA triggers, and WhatsApp outreach modal.', qty: 1, rate: 35000, amount: 35000 },
      { name: 'API Integrations & Webhooks', description: 'REST APIs, webhooks for website lead capture, and analytics reports.', qty: 1, rate: 20000, amount: 20000 }
    ],
    terms: '1. Source code ownership handed over upon full payment clearance.\n2. Milestone sign-offs required at each sprint.\n3. Includes 60 days warranty & support.'
  },
  {
    id: 'pkg-digital-marketing-seo',
    name: 'Digital Marketing & SEO Retainer',
    icon: 'TrendingUp',
    badge: 'Monthly',
    title: 'Complete Growth & Performance Marketing Retainer',
    serviceNames: ['Digital Marketing', 'SEO Optimization', 'Social Media'],
    amount: 25000,
    validityDays: 15,
    gstApplicable: true,
    gstRate: 18,
    milestoneTemplate: '100% Advance at start of each monthly billing cycle',
    items: [
      { name: 'Technical & On-Page SEO Campaign', description: 'Target 15 primary keywords, competitor audit, schema optimization, and monthly ranking reports.', qty: 1, rate: 10000, amount: 10000 },
      { name: 'Meta & Google Ads Campaign Management', description: 'Ad creative design, audience targeting, conversion tracking setup, and weekly ROAS tuning.', qty: 1, rate: 10000, amount: 10000 },
      { name: 'Social Media Management (12 Posts/mo)', description: 'Branded social graphics, copywriting, hashtag strategy, and community engagement.', qty: 1, rate: 5000, amount: 5000 }
    ],
    terms: '1. Ad spend paid directly by client to ad platforms (Google/Meta).\n2. Minimum 3-month engagement recommended for optimal results.\n3. Monthly analytics report provided on 1st of every month.'
  },
  {
    id: 'pkg-mobile-app',
    name: 'Mobile App (iOS & Android)',
    icon: 'Smartphone',
    badge: 'Native/Cross',
    title: 'Cross-Platform Mobile App Development',
    serviceNames: ['Mobile App', 'UI/UX Design', 'API Integration'],
    amount: 150000,
    validityDays: 30,
    gstApplicable: true,
    gstRate: 18,
    milestoneTemplate: '30% Advance, 30% UI Prototype, 25% Beta Build, 15% App Store Publishing',
    items: [
      { name: 'Mobile UI/UX Design System', description: 'Native look-and-feel iOS/Android components, animations, and Figma prototypes.', qty: 1, rate: 30000, amount: 30000 },
      { name: 'React Native / Flutter App Build', description: 'Cross-platform native mobile application with offline storage, smooth 60fps animations.', qty: 1, rate: 70000, amount: 70000 },
      { name: 'Backend API & Push Notifications', description: 'Firebase cloud messaging, real-time sync, user authentication, and secure payment SDK.', qty: 1, rate: 35000, amount: 35000 },
      { name: 'App Store & Play Store Deployment', description: 'Store listing assets, privacy policy compliance, and review submission management.', qty: 1, rate: 15000, amount: 15000 }
    ],
    terms: '1. Google Play & Apple Developer accounts to be provided by client.\n2. Store approval times vary based on Apple/Google review queues.\n3. Includes 60 days bug-fix support.'
  },
  {
    id: 'pkg-amc-support',
    name: 'Annual Maintenance (AMC)',
    icon: 'ShieldCheck',
    badge: 'Recurring',
    title: 'Comprehensive Annual Maintenance & Tech Support Contract',
    serviceNames: ['Cloud Architecture', 'Web Development'],
    amount: 18000,
    validityDays: 30,
    gstApplicable: true,
    gstRate: 18,
    milestoneTemplate: '100% Upfront Annual Payment (or 50% Bi-Annual)',
    items: [
      { name: 'Cloud Server & Security Maintenance', description: 'Automated weekly off-site backups, SSL renewals, firewall management, and server patch updates.', qty: 1, rate: 8000, amount: 8000 },
      { name: 'Minor Content & UI Revisions', description: 'Up to 5 hours/month of dedicated developer time for banner changes, content updates, and tweaks.', qty: 1, rate: 6000, amount: 6000 },
      { name: 'Priority Support & 24h SLA', description: 'Dedicated technical contact for emergency downtime restoration and bug fixes.', qty: 1, rate: 4000, amount: 4000 }
    ],
    terms: '1. Valid for 12 months from agreement signing.\n2. Major new feature additions will be quoted separately.\n3. 24-hour turnaround for emergency critical bugs.'
  }
];

export const MILESTONE_PRESETS = [
  '50% Advance on Kickoff, 30% on Design Approval, 20% on Final Go-Live',
  '40% Advance, 40% on Beta Delivery, 20% on Handover',
  '35% Advance, 35% on Alpha Core Build, 20% on Integration, 10% on Go-Live',
  '100% Advance at start of billing cycle',
  '100% Full Payment upon agreement signing'
];

export function buildWhatsAppProposalPitch({ leadName, companyName, proposalTitle, serviceSummary, totalAmount, currency = 'INR', validityDate }) {
  const formattedAmount = Number(totalAmount || 0).toLocaleString('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 });
  const clientName = leadName || companyName || 'there';
  
  return `Hi ${clientName},

Thank you for discussing your requirements with Webitof! 🚀

We have prepared the official proposal for your project:
📌 *Proposal:* ${proposalTitle || 'Project Quotation'}
🛠️ *Scope & Services:* ${serviceSummary || 'Custom Solutions'}
💰 *Investment Amount:* ${formattedAmount} (incl. taxes where applicable)
⏳ *Proposal Validity:* ${validityDate ? new Date(validityDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '30 Days'}

Please review and let us know if you have any questions or require any adjustments. We look forward to partnering with you!

Best regards,
*Team Webitof*
🌐 www.webitof.com | 📞 +91-XXXXXXXXXX`;
}
