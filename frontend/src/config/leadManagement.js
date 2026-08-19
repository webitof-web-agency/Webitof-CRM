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
