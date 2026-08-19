const LEAD_STATUSES = [
  'New',
  'Contacted',
  'Requirement Collected',
  'Qualified',
  'Unqualified',
  'Quotation Pending',
  'Quotation Sent',
  'Negotiation',
  'Follow-up',
  'Demo Scheduled',
  'Meeting Scheduled',
  'On Hold',
  'Won',
  'Lost',
  'Not Interested',
  'Invalid Lead',
  'Duplicate'
];

const LEAD_SOURCES = [
  'Website',
  'Google Ads',
  'Facebook Ads',
  'Instagram Ads',
  'WhatsApp',
  'Phone Call',
  'Email',
  'Referral',
  'Existing Client',
  'IndiaMART',
  'Justdial',
  'LinkedIn',
  'Freelancer',
  'Upwork',
  'Walk-in',
  'Employee Reference',
  'Partner',
  'Other'
];

const REFERRAL_SOURCES = ['Referral', 'Partner', 'Employee Reference', 'Existing Client'];

const SERVICE_OPTIONS = [
  'Website Development',
  'E-commerce Website',
  'Mobile App Development',
  'Custom Software Development',
  'ERP Development',
  'CRM Development',
  'UI/UX Design',
  'Digital Marketing',
  'Search Engine Optimisation',
  'Social Media Management',
  'Google Ads',
  'Meta Ads',
  'Graphic Design',
  'Branding',
  'Domain Registration',
  'Web Hosting',
  'Cloud Services',
  'Software AMC',
  'Website Maintenance',
  'App Maintenance',
  'IT Consulting',
  'Other'
];

const LEAD_OPTIONS = {
  statuses: LEAD_STATUSES,
  sources: LEAD_SOURCES,
  referralSources: REFERRAL_SOURCES,
  services: SERVICE_OPTIONS,
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
  currencies: ['INR', 'USD', 'EUR', 'GBP']
};

const LEAD_SCORE_RULES = Object.freeze({
  requirementConfirmed: 20,
  budgetConfirmed: 20,
  decisionMakerIdentified: 20,
  timelineConfirmed: 20,
  followUpScheduled: 10,
  validContactDetails: 10
});

function isAffirmative(value) {
  return value === true || String(value || '').trim().toLowerCase() === 'yes';
}

function calculateLeadScore(lead = {}) {
  let score = 0;
  if (isAffirmative(lead.requirementConfirmed)) score += LEAD_SCORE_RULES.requirementConfirmed;
  if (isAffirmative(lead.budgetConfirmed)) score += LEAD_SCORE_RULES.budgetConfirmed;
  if (isAffirmative(lead.decisionMakerIdentified)) score += LEAD_SCORE_RULES.decisionMakerIdentified;
  if (isAffirmative(lead.timelineConfirmed)) score += LEAD_SCORE_RULES.timelineConfirmed;
  if (lead.followUpDate) score += LEAD_SCORE_RULES.followUpScheduled;
  if (lead.phone && (lead.email || lead.whatsappNumber)) score += LEAD_SCORE_RULES.validContactDetails;
  return Math.min(100, Math.max(0, score));
}

module.exports = {
  LEAD_OPTIONS,
  LEAD_SCORE_RULES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  REFERRAL_SOURCES,
  SERVICE_OPTIONS,
  calculateLeadScore,
  isAffirmative
};
