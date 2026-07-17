import { useEffect, useMemo, useState } from 'react';
import { FileText, CalendarRange, ArrowRight } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../forms/SearchableSelect';
import { getFinancialYear } from '../../lib/financialYear';

function sumTotal(items = []) {
  return items.reduce((sum, item) => sum + Number(item.totalAmount || item.amount || 0), 0);
}

export function InvoiceExportModal({ open, onClose, invoices = [], onGenerate }) {
  const [selectedYear, setSelectedYear] = useState('');

  useEffect(() => {
    if (!open) return;
    setSelectedYear('');
  }, [open]);

  const yearOptions = useMemo(() => {
    const years = new Set(invoices.map((invoice) => getFinancialYear(invoice.invoiceDate || invoice.createdAt)));
    years.add(getFinancialYear(new Date()));
    return Array.from(years)
      .sort((a, b) => b.localeCompare(a))
      .map((year) => ({ value: year, label: `FY ${year}` }));
  }, [invoices]);

  const selectedInvoices = useMemo(() => {
    if (!selectedYear) return [];
    return invoices.filter((invoice) => getFinancialYear(invoice.invoiceDate || invoice.createdAt) === selectedYear);
  }, [invoices, selectedYear]);

  const totalAmount = sumTotal(selectedInvoices);
  const canGenerate = Boolean(selectedYear && selectedInvoices.length);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Export invoices"
      subtitle="Select a financial year, then generate a printable PDF for all invoices in that year."
      width="min(720px, 96vw)"
    >
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              <CalendarRange size={14} />
              Financial year
            </div>
            <SearchableSelect
              value={selectedYear}
              onChange={(value) => setSelectedYear(value)}
              options={yearOptions}
              placeholder="Select financial year"
              searchPlaceholder="Search financial year..."
              allowClear={false}
            />
            <p className="mt-2 text-xs text-slate-500">
              Only invoices dated inside the selected financial year will be included.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              <FileText size={14} />
              Export summary
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-slate-500">Selected FY</span>
                <span className="font-semibold text-slate-900">{selectedYear ? `FY ${selectedYear}` : '-'}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-slate-500">Invoices</span>
                <span className="font-semibold text-slate-900">{selectedInvoices.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-slate-500">Total amount</span>
                <span className="font-semibold text-slate-900">{totalAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          {selectedYear
            ? (selectedInvoices.length
                ? `${selectedInvoices.length} invoice${selectedInvoices.length === 1 ? '' : 's'} are ready for export.`
                : 'No invoices found for the selected financial year.')
            : 'Choose a financial year to enable PDF generation.'}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        <Button
          disabled={!canGenerate}
          onClick={() => onGenerate?.(selectedYear)}
          className="inline-flex items-center gap-2"
        >
          Generate PDF
          <ArrowRight size={16} />
        </Button>
      </div>
    </Modal>
  );
}
