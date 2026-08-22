/**
 * Universal CSV Export Utility for CRM Tables
 */

function sanitizeValue(value) {
  if (value == null) return '';
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return `"${value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ').replace(/"/g, '""')}"`;
    }
    return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
  }
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCsv(filename, columns, data) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('No data available to export');
  }

  // Header row
  const headerRow = columns.map((col) => sanitizeValue(col.label || col.key)).join(',');

  // Data rows
  const dataRows = data.map((row) => {
    return columns.map((col) => {
      let val;
      if (typeof col.accessor === 'function') {
        val = col.accessor(row);
      } else if (col.key) {
        val = row[col.key];
      }
      return sanitizeValue(val);
    }).join(',');
  });

  const csvContent = [headerRow, ...dataRows].join('\r\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const cleanFilename = filename.endsWith('.csv') ? filename : `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.setAttribute('download', cleanFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
