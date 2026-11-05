// `orderBy` values from the query string end up inside "order by <value>" in SQL, so only plain
// "column [asc|desc]" lists are accepted. Anything else (subqueries, functions, comments,
// semicolons) falls back to the controller's default order instead of reaching the database.
const ORDER_TERM = /^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)?(\s+(asc|desc))?(\s+nulls\s+(first|last))?$/i;

function safeOrderBy(requested, fallback) {
  const value = Array.isArray(requested) ? requested[0] : requested;
  if (typeof value !== 'string' || !value.trim() || value.length > 120) return fallback;
  const terms = value.split(',').map((term) => term.trim());
  return terms.length <= 3 && terms.every((term) => ORDER_TERM.test(term)) ? terms.join(', ') : fallback;
}

module.exports = { safeOrderBy };
