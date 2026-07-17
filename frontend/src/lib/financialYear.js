export function getFinancialYear(value = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '2026-27';
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const startYear = month >= 4 ? year : year - 1;
  const endYear = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endYear}`;
}

export function formatFinancialYear(value = new Date()) {
  return `FY ${getFinancialYear(value)}`;
}
