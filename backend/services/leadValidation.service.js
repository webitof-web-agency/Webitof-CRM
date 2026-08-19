const { REFERRAL_SOURCES, calculateLeadScore, isAffirmative } = require('../config/leadManagement');

function toList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return toList(parsed);
  } catch {
    // Comma-separated values are supported for older API clients.
  }
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function isValidPhone(value) {
  if (!value) return false;
  const digits = String(value).replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

function isValidEmail(value) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

function isValidUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(String(value).trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function asNumber(value) {
  if (value === '' || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validateLeadPayload(lead = {}, {
  isCreate = false,
  legacyRecord = false,
  enforceLostFields = false,
  enforceReferralFields = false,
  enforceDuplicateFields = false,
  enforceOtherServiceDetails = false
} = {}) {
  const errors = {};
  const services = toList(lead.requiredServices || lead.requiredService);
  const status = String(lead.status || '').trim();
  const source = String(lead.source || '').trim();

  if (isCreate || !legacyRecord || lead.contactPerson) {
    if (!String(lead.contactPerson || '').trim()) errors.contactPerson = 'Contact person name is required';
  }
  if (isCreate || !legacyRecord || lead.phone) {
    if (!String(lead.phone || '').trim()) errors.phone = 'Primary mobile number is required';
    else if (!isValidPhone(lead.phone)) errors.phone = 'Enter a valid phone number with 7 to 15 digits';
  }
  if (isCreate && !services.length) errors.requiredServices = 'Select at least one required service';
  if (isCreate && !source) errors.source = 'Lead source is required';
  if (isCreate && !status) errors.status = 'Lead status is required';
  if (!isValidEmail(lead.email)) errors.email = 'Enter a valid email address';
  if (!isValidUrl(lead.website)) errors.website = 'Website must be a valid http or https URL';
  if (!isValidUrl(lead.referenceUrl)) errors.referenceUrl = 'Reference URL must be a valid http or https URL';

  const nonNegativeFields = [
    ['value', 'Lead value'],
    ['estimatedBudget', 'Estimated budget'],
    ['budgetMin', 'Minimum budget'],
    ['budgetMax', 'Maximum budget'],
    ['commissionValue', 'Commission value'],
    ['competitorPrice', 'Competitor price']
  ];
  nonNegativeFields.forEach(([key, label]) => {
    const value = asNumber(lead[key]);
    if (value != null && value < 0) errors[key] = `${label} cannot be negative`;
  });

  const budgetMin = asNumber(lead.budgetMin);
  const budgetMax = asNumber(lead.budgetMax);
  if (budgetMin != null && budgetMax != null && budgetMin > budgetMax) {
    errors.budgetMax = 'Maximum budget must be greater than or equal to minimum budget';
  }

  const probability = asNumber(lead.conversionProbability);
  if (probability != null && (probability < 0 || probability > 100)) {
    errors.conversionProbability = 'Conversion probability must be between 0 and 100';
  }

  if (isAffirmative(lead.commissionApplicable)) {
    if (!String(lead.commissionType || '').trim()) errors.commissionType = 'Commission type is required';
    const commissionValue = asNumber(lead.commissionValue);
    if (commissionValue == null) errors.commissionValue = 'Commission value is required';
    if (String(lead.commissionType || '').toLowerCase() === 'percentage' && commissionValue != null && commissionValue > 100) {
      errors.commissionValue = 'Commission percentage must be between 0 and 100';
    }
  }

  const hasReferralDetails = Boolean(lead.referrerType || lead.referrerName || lead.referrerContact || lead.referrerReferenceId);
  if (REFERRAL_SOURCES.includes(source) && (!legacyRecord || hasReferralDetails || enforceReferralFields)) {
    if (!String(lead.referrerType || '').trim()) errors.referrerType = 'Referrer type is required';
    if (!String(lead.referrerName || '').trim()) errors.referrerName = 'Referrer name is required';
    if (!isValidPhone(lead.referrerContact)) errors.referrerContact = 'A valid referrer contact number is required';
  }

  const hasLostDetails = Boolean(lead.lostReason || lead.lostReasonNotes || lead.competitorName || lead.reconnectInFuture);
  if (['Lost', 'Not Interested'].includes(status) && (!legacyRecord || hasLostDetails || enforceLostFields)) {
    if (!String(lead.lostReason || '').trim()) errors.lostReason = 'Lost reason is required';
    if (lead.lostReason === 'Other' && !String(lead.lostReasonNotes || '').trim()) {
      errors.lostReasonNotes = 'Lost reason notes are required when reason is Other';
    }
    if (Boolean(lead.reconnectInFuture) && !lead.reconnectDate) {
      errors.reconnectDate = 'Reconnect date is required';
    }
  }

  if (status === 'Duplicate' && !lead.originalLeadId && (!legacyRecord || enforceDuplicateFields)) {
    errors.originalLeadId = 'Select the original lead';
  }
  if (services.includes('Other') && (isCreate || enforceOtherServiceDetails) && !String(lead.otherServiceDetails || '').trim()) {
    errors.otherServiceDetails = 'Describe the other required service';
  }
  if (source === 'Other' && !String(lead.sourceReference || '').trim()) {
    errors.sourceReference = 'Source reference is required when source is Other';
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
    normalized: {
      requiredServices: services,
      leadScore: calculateLeadScore({ ...lead, requiredServices: services })
    }
  };
}

function createValidationError(errors) {
  const error = new Error(Object.values(errors)[0] || 'Lead validation failed');
  error.statusCode = 400;
  error.details = errors;
  return error;
}

module.exports = {
  createValidationError,
  isValidEmail,
  isValidPhone,
  isValidUrl,
  toList,
  validateLeadPayload
};
