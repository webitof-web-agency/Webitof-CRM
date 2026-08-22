export const DEFAULT_LEAD_OPTIONS = {
  statuses: ['New', 'Contacted', 'Requirement Collected', 'Qualified', 'Unqualified', 'Quotation Pending', 'Quotation Sent', 'Negotiation', 'Follow-up', 'Demo Scheduled', 'Meeting Scheduled', 'On Hold', 'Won', 'Lost', 'Not Interested', 'Invalid Lead', 'Duplicate'],
  sources: ['Website', 'Google Ads', 'Facebook Ads', 'Instagram Ads', 'WhatsApp', 'Phone Call', 'Email', 'Referral', 'Existing Client', 'IndiaMART', 'Justdial', 'LinkedIn', 'Freelancer', 'Upwork', 'Walk-in', 'Employee Reference', 'Partner', 'Other'],
  referralSources: ['Referral', 'Partner', 'Employee Reference', 'Existing Client'],
  services: ['Website Development', 'E-commerce Website', 'Mobile App Development', 'Custom Software Development', 'ERP Development', 'CRM Development', 'UI/UX Design', 'Digital Marketing', 'Search Engine Optimisation', 'Social Media Management', 'Google Ads', 'Meta Ads', 'Graphic Design', 'Branding', 'Domain Registration', 'Web Hosting', 'Cloud Services', 'Software AMC', 'Website Maintenance', 'App Maintenance', 'IT Consulting', 'Other'],
  temperatures: ['Hot', 'Warm', 'Cold'],
  priorities: ['Low', 'Medium', 'High', 'Urgent'],
  preferredLanguages: ['English', 'Hindi', 'Gujarati', 'Marathi', 'Bengali', 'Tamil', 'Telugu', 'Kannada', 'Other'],
  contactMethods: ['Phone Call', 'WhatsApp', 'Email', 'Video Meeting', 'Office Meeting'],
  followUpModes: ['Phone Call', 'WhatsApp', 'Email', 'Video Meeting', 'Office Meeting', 'Client Location Meeting', 'Demo', 'Other'],
  reminders: ['No Reminder', 'At Follow-up Time', '15 Minutes Before', '30 Minutes Before', '1 Hour Before', '1 Day Before', 'Custom'],
  budgetRanges: ['Below INR 10,000', 'INR 10,000-INR 25,000', 'INR 25,000-INR 50,000', 'INR 50,000-INR 1,00,000', 'INR 1,00,000-INR 5,00,000', 'Above INR 5,00,000', 'Not Disclosed', 'Custom'],
  budgetConfirmation: ['Yes', 'No', 'Not Disclosed'],
  billingTypes: ['Fixed Price', 'Hourly', 'Daily', 'Monthly Retainer', 'Milestone Based', 'AMC', 'Subscription', 'Not Decided'],
  gstOptions: ['Yes', 'No', 'Not Confirmed'],
  purchaseTimelines: ['Immediately', 'Within 7 Days', 'Within 15 Days', 'Within 30 Days', 'Within 3 Months', 'More Than 3 Months', 'Just Enquiring', 'Not Confirmed'],
  paymentPreferences: ['Bank Transfer', 'UPI', 'Card', 'Cheque', 'Cash', 'Milestone Based', 'Not Decided'],
  decisionMakerOptions: ['Yes', 'No', 'Unknown'],
  confirmationOptions: ['Yes', 'No', 'Unknown'],
  commissionTypes: ['Percentage', 'Fixed Amount'],
  referrerTypes: ['Client', 'Employee', 'Partner', 'Individual', 'Other'],
  lostReasons: ['Budget Issue', 'Price Too High', 'Requirement Cancelled', 'Competitor Selected', 'No Response', 'Timeline Issue', 'Service Not Available', 'Client Not Interested', 'Project Postponed', 'Duplicate Lead', 'Fake Lead', 'Invalid Contact', 'Internal Capacity Issue', 'Other'],
  callTypes: ['Incoming', 'Outgoing', 'Missed'],
  callOutcomes: ['Connected', 'No Answer', 'Busy', 'Switched Off', 'Call Back Requested', 'Requirement Collected', 'Not Interested', 'Wrong Number', 'Other'],
  currencies: ['INR', 'USD', 'EUR', 'GBP'],
  scoreRules: {
    requirementConfirmed: 20,
    budgetConfirmed: 20,
    decisionMakerIdentified: 20,
    timelineConfirmed: 20,
    followUpScheduled: 10,
    validContactDetails: 10
  }
};

export function toSelectOptions(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const label = typeof item === 'string' ? item : item?.label || item?.value || '';
    return { value: label, label };
  }).filter((item) => item.value);
}

export function calculateLeadScore(formData = {}, rules = DEFAULT_LEAD_OPTIONS.scoreRules) {
  let score = 0;
  if (formData.requirementConfirmed === 'Yes') score += Number(rules.requirementConfirmed || 0);
  if (formData.budgetConfirmed === 'Yes') score += Number(rules.budgetConfirmed || 0);
  if (formData.decisionMakerIdentified === 'Yes') score += Number(rules.decisionMakerIdentified || 0);
  if (formData.timelineConfirmed === 'Yes') score += Number(rules.timelineConfirmed || 0);
  if (formData.followUpDate) score += Number(rules.followUpScheduled || 0);
  if (formData.phone && (formData.email || formData.whatsappNumber)) score += Number(rules.validContactDetails || 0);
  return Math.min(100, Math.max(0, score));
}

export const DEFAULT_LEAD_STATUS_COLORS = {
  'New': '#2563eb', // Vibrant Blue
  'Contacted': '#6366f1', // Indigo
  'Requirement Collected': '#0891b2', // Cyan
  'Qualified': '#8b5cf6', // Violet
  'Unqualified': '#f43f5e', // Rose
  'Quotation Pending': '#ea580c', // Orange
  'Quotation Sent': '#9333ea', // Deep Purple
  'Negotiation': '#db2777', // Fuchsia / Pink
  'Follow-up': '#0284c7', // Sky Blue
  'Demo Scheduled': '#f59e0b', // Amber
  'Meeting Scheduled': '#4f46e5', // Deep Indigo
  'On Hold': '#d97706', // Warm Amber
  'Won': '#16a34a', // Emerald Green
  'Lost': '#dc2626', // Crimson Red
  'Not Interested': '#e11d48', // Bright Rose Red
  'Invalid Lead': '#64748b', // Slate Gray
  'Duplicate': '#6b7280' // Gray
};

const FALLBACK_PALETTE = [
  '#2563eb', '#16a34a', '#8b5cf6', '#ea580c', '#0891b2',
  '#db2777', '#0284c7', '#d97706', '#6366f1', '#10b981',
  '#ec4899', '#4f46e5', '#14b8a6', '#f59e0b'
];

export function getLeadStatusColor(status, customColors = {}) {
  if (!status) return '#64748b';
  const clean = String(status).trim();
  if (customColors && customColors[clean]) return customColors[clean];

  if (DEFAULT_LEAD_STATUS_COLORS[clean]) return DEFAULT_LEAD_STATUS_COLORS[clean];

  const lower = clean.toLowerCase();
  for (const [key, val] of Object.entries(DEFAULT_LEAD_STATUS_COLORS)) {
    if (key.toLowerCase() === lower) return val;
  }

  if (customColors) {
    for (const [key, val] of Object.entries(customColors)) {
      if (key.toLowerCase() === lower && val) return val;
    }
  }

  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % FALLBACK_PALETTE.length;
  return FALLBACK_PALETTE[index];
}

export const DEFAULT_LEAD_SOURCE_COLORS = {
  'Website': '#0284c7', // Sky Blue
  'Google Ads': '#ea580c', // Orange
  'Facebook Ads': '#2563eb', // Blue
  'Instagram Ads': '#db2777', // Magenta/Pink
  'WhatsApp': '#16a34a', // Emerald Green
  'Phone Call': '#0891b2', // Cyan
  'Cold Call': '#0284c7', // Sky Blue
  'LinkedIn': '#0a66c2', // LinkedIn Blue
  'Email': '#8b5cf6', // Violet
  'Referral': '#10b981', // Green
  'Existing Client': '#059669', // Emerald
  'IndiaMART': '#0d9488', // Teal
  'Justdial': '#ea580c', // Orange
  'Freelancer': '#16a34a', // Green
  'Upwork': '#10b981', // Emerald
  'Walk-in': '#7c3aed', // Purple
  'Partner': '#9333ea', // Deep Purple
  'Trade Show': '#f59e0b', // Amber
  'Employee Reference': '#059669', // Green
  'Other': '#64748b' // Slate
};

export const DEFAULT_LEAD_SERVICE_COLORS = {
  'Web Development': '#2563eb', // Blue
  'Website Development': '#2563eb', // Blue
  'E-commerce Website': '#7c3aed', // Purple
  'Mobile App Development': '#0891b2', // Cyan
  'Custom Software Development': '#6366f1', // Indigo
  'Custom Software': '#6366f1', // Indigo
  'ERP Development': '#4f46e5', // Deep Indigo
  'CRM Development': '#0d9488', // Teal
  'Lead CRM': '#0d9488', // Teal
  'LMS Development': '#0284c7', // Sky Blue
  'UI/UX Design': '#db2777', // Pink
  'Digital Marketing': '#ea580c', // Orange
  'Search Engine Optimisation': '#16a34a', // Green
  'Social Media Management': '#ec4899', // Fuchsia
  'Google Ads': '#f59e0b', // Amber
  'Meta Ads': '#2563eb', // Blue
  'Graphic Design': '#a855f7', // Violet
  'Branding': '#9333ea', // Purple
  'Domain Registration': '#0284c7', // Sky Blue
  'Web Hosting': '#0891b2', // Cyan
  'Cloud Services': '#3b82f6', // Blue
  'Software AMC': '#10b981', // Emerald
  'Website Maintenance': '#059669', // Green
  'App Maintenance': '#0891b2', // Cyan
  'IT Consulting': '#6366f1', // Indigo
  'Other': '#64748b' // Slate
};

export const DEFAULT_LEAD_TEMPERATURE_COLORS = {
  'Hot': '#ef4444', // Red
  'Warm': '#f59e0b', // Amber
  'Cold': '#3b82f6' // Blue
};

export const DEFAULT_LEAD_PRIORITY_COLORS = {
  'Urgent': '#ef4444', // Red
  'High': '#ea580c', // Orange
  'Medium': '#f59e0b', // Amber
  'Low': '#10b981' // Green
};

export function getLeadSourceColor(source, customColors = {}) {
  if (!source) return '#64748b';
  const clean = String(source).trim();
  if (customColors && customColors[clean]) return customColors[clean];
  if (DEFAULT_LEAD_SOURCE_COLORS[clean]) return DEFAULT_LEAD_SOURCE_COLORS[clean];

  const lower = clean.toLowerCase();
  for (const [key, val] of Object.entries(DEFAULT_LEAD_SOURCE_COLORS)) {
    if (key.toLowerCase() === lower) return val;
  }
  if (customColors) {
    for (const [key, val] of Object.entries(customColors)) {
      if (key.toLowerCase() === lower && val) return val;
    }
  }

  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % FALLBACK_PALETTE.length;
  return FALLBACK_PALETTE[index];
}

export function getLeadServiceColor(service, customColors = {}) {
  if (!service) return '#64748b';
  const clean = String(service).trim();
  if (customColors && customColors[clean]) return customColors[clean];
  if (DEFAULT_LEAD_SERVICE_COLORS[clean]) return DEFAULT_LEAD_SERVICE_COLORS[clean];

  const lower = clean.toLowerCase();
  for (const [key, val] of Object.entries(DEFAULT_LEAD_SERVICE_COLORS)) {
    if (key.toLowerCase() === lower) return val;
  }
  if (customColors) {
    for (const [key, val] of Object.entries(customColors)) {
      if (key.toLowerCase() === lower && val) return val;
    }
  }

  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % FALLBACK_PALETTE.length;
  return FALLBACK_PALETTE[index];
}

export function getLeadTemperatureColor(temperature) {
  if (!temperature) return '#64748b';
  const clean = String(temperature).trim();
  return DEFAULT_LEAD_TEMPERATURE_COLORS[clean] || '#64748b';
}

export function getLeadPriorityColor(priority) {
  if (!priority) return '#64748b';
  const clean = String(priority).trim();
  return DEFAULT_LEAD_PRIORITY_COLORS[clean] || '#64748b';
}


