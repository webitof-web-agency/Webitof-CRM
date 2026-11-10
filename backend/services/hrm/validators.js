// Field rules for people data in HRM (employee form, candidates). Each helper returns the
// cleaned value (trimmed, upper-cased, spaces removed...) or fails with a readable message.
// The web form enforces the same rules while typing (frontend/src/lib/fieldRules.js).
const c = require("./core");

const NAME_RE = /^\p{L}[\p{L}\p{M} .'-]*$/u;

function personName(value, label, required = false, max = 160) {
  const text = c.text(value, label, max, required);
  if (!text) return text;
  const clean = text.replace(/\s+/g, " ");
  if (!NAME_RE.test(clean))
    c.fail(`${label} can contain only letters, spaces and . ' -`);
  return clean;
}

// Stored without spaces or dashes: "+91 98765-43210" -> "+919876543210".
function phone(value, label, required = false) {
  const text = c.text(value, label, 30, required);
  if (!text) return text;
  const clean = text.replace(/[\s()-]/g, "");
  if (!/^\+?\d{10,15}$/.test(clean))
    c.fail(`${label} must be 10 to 15 digits (a leading + is allowed)`);
  // Stored with the country code: a bare Indian number (10 digits, or 0 + STD code) gets +91,
  // otherwise phone widgets read its first digits as a country code (8839… shown as +88).
  if (/^\d{10}$/.test(clean)) return `+91${clean}`;
  if (/^0\d{10}$/.test(clean)) return `+91${clean.slice(1)}`;
  return clean;
}

function email(value, label, required = false) {
  const text = c.text(value, label, 254, required);
  if (!text) return text;
  const clean = text.replace(/\s+/g, "").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) c.fail(`Invalid ${label.toLowerCase()}`);
  return clean;
}

function pattern(value, label, re, hint, { upper = false, strip = false, max = 40 } = {}) {
  const text = c.text(value, label, max);
  if (!text) return text;
  let clean = strip ? text.replace(/\s+/g, "") : text;
  if (upper) clean = clean.toUpperCase();
  if (!re.test(clean)) c.fail(`${label} ${hint}`);
  return clean;
}

const pin = (v) => pattern(v, "PIN code", /^\d{6}$/, "must be 6 digits", { strip: true });
const pan = (v) => pattern(v, "PAN", /^[A-Z]{5}\d{4}[A-Z]$/, "must look like ABCDE1234F", { upper: true, strip: true });
const ifsc = (v) => pattern(v, "IFSC", /^[A-Z]{4}0[A-Z0-9]{6}$/, "must look like HDFC0001234", { upper: true, strip: true });
const accountNumber = (v) => pattern(v, "Account number", /^\d{9,18}$/, "must be 9 to 18 digits", { strip: true });
const uan = (v) => pattern(v, "UAN", /^\d{12}$/, "must be 12 digits", { strip: true });
const employeeCode = (v) =>
  pattern(v, "Employee code", /^[A-Za-z0-9_-]+$/, "can contain only letters, digits, - and _", { strip: true });

// Date of birth: a real past date and at least 14 years before today.
function dateOfBirth(value, today) {
  const dob = c.date(value, "Date of birth", true);
  if (!dob) return dob;
  if (dob > today) c.fail("Date of birth cannot be in the future");
  const [y, m, d] = today.split("-").map(Number);
  const limit = `${y - 14}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  if (dob > limit) c.fail("The employee must be at least 14 years old");
  return dob;
}

module.exports = {
  accountNumber,
  dateOfBirth,
  email,
  employeeCode,
  ifsc,
  pan,
  personName,
  phone,
  pin,
  uan,
};
