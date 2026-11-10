// Input rules for people data (HRM employee form, candidates). `clean.*` runs on every
// keystroke so a field cannot hold characters it never accepts (no letters in a phone);
// `valid.*` is the final check on Next/Save. The server applies the same rules
// (backend/services/hrm/validators.js).

const digits = (value, max) => String(value ?? "").replace(/\D/g, "").slice(0, max);

export const clean = {
  // A leading + then up to 15 digits; spaces/dashes the user types are dropped.
  phone: (value) => {
    const text = String(value ?? "");
    return (text.trimStart().startsWith("+") ? "+" : "") + digits(text, 15);
  },
  // Letters (any script), spaces and . ' - only.
  name: (value) => String(value ?? "").replace(/[^\p{L}\p{M} .'-]/gu, "").replace(/\s{2,}/g, " "),
  email: (value) => String(value ?? "").replace(/\s/g, "").toLowerCase(),
  pin: (value) => digits(value, 6),
  uan: (value) => digits(value, 12),
  accountNumber: (value) => digits(value, 18),
  pan: (value) => String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10),
  ifsc: (value) => String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11),
  employeeCode: (value) => String(value ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40),
};

export const valid = {
  phone: (value) => /^\+?\d{10,15}$/.test(String(value ?? "")),
  name: (value) => /^\p{L}[\p{L}\p{M} .'-]*$/u.test(String(value ?? "").trim()),
  email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "")),
  pin: (value) => /^\d{6}$/.test(String(value ?? "")),
  uan: (value) => /^\d{12}$/.test(String(value ?? "")),
  accountNumber: (value) => /^\d{9,18}$/.test(String(value ?? "")),
  pan: (value) => /^[A-Z]{5}\d{4}[A-Z]$/.test(String(value ?? "")),
  ifsc: (value) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(value ?? "")),
};

// Latest date of birth allowed (14 years before today), as YYYY-MM-DD.
export function latestBirthDate(today) {
  const [y, m, d] = String(today).split("-").map(Number);
  return `${y - 14}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
