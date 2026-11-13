// One phone format for leads and clients: "+<country><number>", digits only.
// A bare 10-digit number (or 0 + 10 digits) is Indian and gets +91, the same rule user profiles
// use, so "98765 43210" from a website form and "+91 98765 43210" from the CRM are one number.
function normalizePhone(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (!raw.startsWith('+')) {
    if (digits.length === 10) digits = `91${digits}`;
    else if (digits.length === 11 && digits.startsWith('0')) digits = `91${digits.slice(1)}`;
  }
  return `+${digits}`;
}

// SQL that compares two phone numbers by their last 10 digits, so rows saved before
// normalization ("+9876543210", "098765 43210") still match "+919876543210".
function phoneMatchSql(column, placeholder) {
  return `right(regexp_replace(coalesce(${column}, ''), '\\D', '', 'g'), 10) = right(${placeholder}, 10)`;
}

module.exports = { normalizePhone, phoneMatchSql };
