// Small shared checks for money and date fields on finance-side records (AMC, renewals,
// expenses). They throw a 400 the error handler shows as-is.
function fail(message) {
  throw Object.assign(new Error(message), { statusCode: 400 });
}

// Every named field that is present must be a finite number >= 0.
function nonNegative(record, labels) {
  for (const [key, label] of Object.entries(labels)) {
    const value = record[key];
    if (value === undefined || value === null || value === '') continue;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) fail(`${label} cannot be negative.`);
  }
}

function percent(record, key, label, max = 100) {
  const value = record[key];
  if (value === undefined || value === null || value === '') return;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > max) fail(`${label} must be between 0 and ${max} %.`);
}

// Both dates present -> the end may not come before the start. Dates compare as YYYY-MM-DD text.
function dateOrder(start, end, message) {
  const a = String(start || '').slice(0, 10);
  const b = String(end || '').slice(0, 10);
  if (a && b && b < a) fail(message);
}

module.exports = { fail, nonNegative, percent, dateOrder };
