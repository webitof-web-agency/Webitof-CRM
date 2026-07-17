import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer, CheckCircle2, Clock, XCircle, Send } from 'lucide-react';
import { InvoicePreview as InvoiceDocument } from '../../components/invoices/InvoicePreview';
import { normalizeInvoiceNumber } from '../../lib/invoiceNumber';

const STATUS_COLORS = {
  Paid: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  Sent: { bg: 'bg-blue-100', text: 'text-blue-700' },
  Draft: { bg: 'bg-slate-100', text: 'text-slate-600' },
  Overdue: { bg: 'bg-red-100', text: 'text-red-700' },
  'Partially Paid': { bg: 'bg-amber-100', text: 'text-amber-700' },
  Cancelled: { bg: 'bg-red-100', text: 'text-red-600' },
};

function fmt(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function InvoicePublicPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch(`/api/invoices/public/${id}`).then(r => r.json());
        if (!res.success) throw new Error(res.message || 'Invoice not found');
        if (active) setData(res.data);
      } catch (err) {
        if (active) setError(err.message || 'Failed to load invoice');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="h-10 w-10 rounded-full border-4 border-blue-500 border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Loading invoice…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl p-10 shadow-sm max-w-sm">
          <XCircle size={40} className="text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900">Invoice Not Found</h2>
          <p className="text-slate-500 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const { invoice, client, company, logos, branding, template, bank, bankAccount, invoiceSettings } = data;
  const displayInvoice = { ...invoice, invoiceNumber: normalizeInvoiceNumber(invoice.invoiceNumber) };
  const resolvedTemplate = template || (branding ? { primaryColor: branding.primaryColor || '#3b82f6', footerText: 'Thank you for your business!' } : null);
  const statusInfo = STATUS_COLORS[invoice.status] || STATUS_COLORS.Draft;

  return (
    <div className="min-h-screen bg-white">
      {/* Top Bar */}
      <div className="print:hidden bg-white border-b border-slate-200 shadow-sm px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logos?.primary ? (
              <img src={logos.primary} alt="Logo" className="h-8 object-contain" />
            ) : (
              <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: branding?.primaryColor || '#3b82f6' }}>
                {(company?.name || 'C').charAt(0)}
              </div>
            )}
            <span className="text-sm font-semibold text-slate-700">{company?.name || 'Invoice'}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${statusInfo.bg} ${statusInfo.text}`}>
              {invoice.status}
            </span>
            <span className="text-sm font-bold text-slate-900">
              ₹{fmt(invoice.totalAmount)}
            </span>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Printer size={13} /> Print
            </button>
          </div>
        </div>
      </div>

      {/* Invoice */}
      <div className="max-w-4xl mx-auto p-4 py-8 print:p-0 print:max-w-none flex flex-col items-center">
        <div className="w-full max-w-[210mm]">
          <InvoiceDocument
            draft={displayInvoice}
            client={client}
            company={company}
            logos={logos}
            template={resolvedTemplate}
            bankAccount={bankAccount || null}
            bankSettings={bank || {}}
            invoiceSettings={invoiceSettings || {}}
          />
        </div>

        {/* Footer note */}
        <div className="print:hidden text-center mt-6 text-xs text-slate-400">
          This is a secure invoice shared with you. For queries, contact {company?.email || company?.phone || 'the sender'}.
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          .print\:hidden { display: none !important; }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body { 
            background: white; 
            margin: 0; 
            padding: 0; 
          }
          #invoice-document, #invoice-document * { visibility: visible !important; }
        }
      `}</style>
    </div>
  );
}
