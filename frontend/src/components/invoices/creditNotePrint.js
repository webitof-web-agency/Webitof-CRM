import { formatDate, formatINR } from '../../lib/format';

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

// Opens a clean, print-ready credit note in its own window (the app's own page chrome is not printed).
export function printCreditNote({ note, invoice, client, company = {} }) {
  const lines = Array.isArray(note.items) ? note.items : [];
  const rows = lines
    .map(
      (line, index) => `<tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(line.description || line.serviceName || 'Item')}</td>
        <td class="num">${escapeHtml(line.quantity ?? 1)}</td>
        <td class="num">${escapeHtml(formatINR(line.rate))}</td>
        <td class="num">${escapeHtml(formatINR(line.taxableAmount ?? Number(line.rate || 0) * Number(line.quantity || 1)))}</td>
      </tr>`
    )
    .join('');
  const tax = [
    ['CGST', note.cgst],
    ['SGST', note.sgst],
    ['UTGST', note.utgst],
    ['IGST', note.igst]
  ]
    .filter(([, value]) => Number(value) > 0)
    .map(([label, value]) => `<tr><td>${label}</td><td class="num">${escapeHtml(formatINR(value))}</td></tr>`)
    .join('');
  const cancelled = String(note.status) === 'Cancelled';
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(note.creditNoteNumber)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 32px; font-size: 13px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .muted { color: #555; }
  .head { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border-bottom: 1px solid #ddd; padding: 8px 6px; text-align: left; vertical-align: top; }
  th { background: #f4f4f4; }
  .num { text-align: right; white-space: nowrap; }
  .totals { width: 280px; margin-left: auto; }
  .totals td { border: 0; padding: 4px 6px; }
  .grand td { border-top: 2px solid #111; font-weight: bold; font-size: 15px; }
  .stamp { color: #b00020; border: 2px solid #b00020; display: inline-block; padding: 2px 10px; font-weight: bold; margin-bottom: 8px; }
</style></head><body>
  <div class="head">
    <div>
      <h1>Credit Note</h1>
      ${cancelled ? '<div class="stamp">CANCELLED</div>' : ''}
      <div><strong>${escapeHtml(note.creditNoteNumber)}</strong></div>
      <div class="muted">Date: ${escapeHtml(formatDate(note.issueDate))}</div>
      <div class="muted">Against invoice: ${escapeHtml(invoice?.invoiceNumber || '')}${invoice?.invoiceDate ? ` dated ${escapeHtml(formatDate(invoice.invoiceDate))}` : ''}</div>
    </div>
    <div style="text-align:right">
      <strong>${escapeHtml(company.name || company.companyName || '')}</strong>
      <div class="muted">${escapeHtml(company.address || '')}</div>
      ${company.gstin ? `<div class="muted">GSTIN: ${escapeHtml(company.gstin)}</div>` : ''}
    </div>
  </div>
  <div style="margin-bottom:16px">
    <div class="muted">Credited to</div>
    <strong>${escapeHtml(client?.companyName || client?.name || '')}</strong>
    <div class="muted">${escapeHtml(client?.billingAddress || client?.address || '')}</div>
    ${client?.gstin ? `<div class="muted">GSTIN: ${escapeHtml(client.gstin)}</div>` : ''}
  </div>
  <div><strong>Reason:</strong> ${escapeHtml(note.reason || '')}</div>
  <table>
    <thead><tr><th>#</th><th>Description</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Taxable value</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5">Credit of the whole invoice</td></tr>'}</tbody>
  </table>
  <table class="totals">
    <tr><td>Taxable value</td><td class="num">${escapeHtml(formatINR(note.taxableAmount))}</td></tr>
    ${tax}
    <tr class="grand"><td>Total credited</td><td class="num">${escapeHtml(formatINR(note.totalAmount))}</td></tr>
  </table>
  <script>window.onload = function () { window.focus(); window.print(); };</script>
</body></html>`;
  const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
  if (!win) return false; // blocked by the browser
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
