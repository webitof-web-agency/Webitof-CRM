import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, Download, FileText, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { PageLoader } from '../../components/ui/Loader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { InvoicePreview } from '../../components/invoices/InvoicePreview';
import { getFinancialYear } from '../../lib/financialYear';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';

function parseQuery(search = '') {
  return new URLSearchParams(search);
}

export function InvoiceExportPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const printedRef = useRef(false);

  const query = useMemo(() => parseQuery(location.search), [location.search]);
  const selectedYear = query.get('fy') || '';
  const autoPrint = query.get('print') === '1';

  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const [invoiceRes, clientRes, settingsRes] = await Promise.all([
          api.resources.list('/invoices', token),
          api.resources.list('/clients', token),
          api.settings.get(token)
        ]);

        if (!active) return;
        setInvoices(invoiceRes.data || []);
        setClients(clientRes.data || []);
        setSettings(settingsRes.data || {});
      } catch (error) {
        if (active) {
          toast.error(error.message || 'Failed to load invoice export');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [token]);

  const clientMap = useMemo(() => new Map(clients.map((client) => [String(client.id), client])), [clients]);

  const selectedInvoices = useMemo(() => {
    const filtered = (invoices || [])
      .filter((invoice) => getFinancialYear(invoice.invoiceDate || invoice.createdAt) === selectedYear)
      .sort((a, b) => String(a.invoiceDate || a.createdAt || '').localeCompare(String(b.invoiceDate || b.createdAt || '')));
    return filtered;
  }, [invoices, selectedYear]);

  const nextSlide = () => setCurrentSlide((p) => Math.min(p + 1, selectedInvoices.length - 1));
  const prevSlide = () => setCurrentSlide((p) => Math.max(p - 1, 0));

  useEffect(() => {
    if (!autoPrint || loading || printedRef.current || !selectedInvoices.length) return;
    printedRef.current = true;
    const timer = window.setTimeout(() => window.print(), 1500);
    return () => window.clearTimeout(timer);
  }, [autoPrint, loading, selectedInvoices.length]);

  if (loading) return <PageLoader />;

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const sheets = document.querySelectorAll('.invoice-export-sheet');
      if (!sheets.length) throw new Error("No invoices to export.");

      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      
      for (let i = 0; i < sheets.length; i++) {
        const sheet = sheets[i];
        const invoiceNode = sheet.firstElementChild;
        
        const dataUrl = await toJpeg(invoiceNode, { 
          quality: 0.98,
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          style: { margin: '0' },
          width: invoiceNode.offsetWidth,
          height: invoiceNode.offsetHeight
        });
        
        if (i > 0) {
          pdf.addPage();
        }
        
        const imgProps = pdf.getImageProperties(dataUrl);
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      }
      
      pdf.save(`Invoices_Export_${selectedLabel}.pdf`);
      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('PDF Generation Error:', error);
      toast.error('Failed to generate PDF: ' + (error?.message || 'Unknown error'));
    } finally {
      setDownloading(false);
    }
  };

  const company = settings?.company || {};
  const logos = settings?.logos || {};
  const invoiceSettings = settings || {};
  const bankSettings = settings?.bank || {};
  const selectedLabel = selectedYear ? `FY ${selectedYear}` : '-';

  return (
    <div className="invoice-export-root min-h-screen bg-white print:bg-white print:!bg-white">
      <div className="print:hidden sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="w-full flex items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/app/invoices')} className="gap-2">
              <ArrowLeft size={16} />
              Back
            </Button>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Export invoices</div>
              <h1 className="text-lg font-bold text-slate-900">{selectedLabel}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => window.print()} className="gap-2 shadow-sm border-slate-200 bg-white hover:bg-slate-50">
              <Printer size={16} />
              Print
            </Button>
            <Button variant="primary" onClick={handleDownloadPDF} disabled={downloading} className="gap-2">
              <Download size={16} />
              {downloading ? 'Generating...' : 'Download PDF'}
            </Button>
          </div>
        </div>
      </div>

      <main className="w-full px-4 py-6 sm:px-8 print:px-0 print:py-0">
        {selectedInvoices.length ? (
          <div className="space-y-6">
            <Card className="print:hidden p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]">
                  <FileText size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{selectedInvoices.length} invoice{selectedInvoices.length === 1 ? '' : 's'} ready</h2>
                  <p className="text-sm text-slate-500">
                    Each invoice is laid out on its own A4 page for clean browser printing or PDF export.
                  </p>
                </div>
              </div>

              {selectedInvoices.length > 1 && (
                <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
                  <span className="text-sm font-medium text-slate-600">
                    {currentSlide + 1} of {selectedInvoices.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevSlide} disabled={currentSlide === 0}>
                      <ChevronLeft size={16} />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextSlide} disabled={currentSlide === selectedInvoices.length - 1}>
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            {/* Visual Slider */}
            <div className="print:hidden relative w-full flex justify-center items-start min-h-[500px]">
              {selectedInvoices.map((invoice, index) => {
                if (index !== currentSlide) return null;
                return (
                  <div key={`view-${invoice.id}`} className="mx-auto w-full max-w-[210mm] animate-in fade-in slide-in-from-right-4 duration-300">
                    <InvoicePreview
                      draft={{ ...invoice, financialYear: invoice.financialYear || getFinancialYear(invoice.invoiceDate || invoice.createdAt) }}
                      client={clientMap.get(String(invoice.clientId)) || {}}
                      company={company}
                      logos={logos}
                      template={settings?.invoiceTemplates?.find((item) => String(item.id) === String(invoice.templateId)) || settings?.invoiceTemplates?.find((item) => item.isDefault) || settings?.invoiceTemplates?.[0] || {}}
                      bankAccount={invoice.bankAccount || null}
                      bankSettings={bankSettings}
                      invoiceSettings={invoiceSettings}
                      pageNumber={index + 1}
                      totalPages={selectedInvoices.length}
                    />
                  </div>
                );
              })}
            </div>

            {/* Hidden container exclusively for export/print rendering */}
            <div id="export-container" className="absolute -left-[9999px] print:static print:block space-y-8 print:space-y-0">
              {selectedInvoices.map((invoice, index) => (
                <section
                  key={invoice.id}
                  className="invoice-export-sheet mx-auto max-w-[210mm] print:max-w-none print:break-after-page print:break-inside-avoid"
                  style={{ breakAfter: index === selectedInvoices.length - 1 ? 'auto' : 'page' }}
                >
                  <InvoicePreview
                    draft={{ ...invoice, financialYear: invoice.financialYear || getFinancialYear(invoice.invoiceDate || invoice.createdAt) }}
                    client={clientMap.get(String(invoice.clientId)) || {}}
                    company={company}
                    logos={logos}
                    template={settings?.invoiceTemplates?.find((item) => String(item.id) === String(invoice.templateId)) || settings?.invoiceTemplates?.find((item) => item.isDefault) || settings?.invoiceTemplates?.[0] || {}}
                    bankAccount={invoice.bankAccount || null}
                    bankSettings={bankSettings}
                    invoiceSettings={invoiceSettings}
                    pageNumber={index + 1}
                    totalPages={selectedInvoices.length}
                  />
                </section>
              ))}
            </div>
          </div>
        ) : (
          <Card className="mx-auto mt-10 max-w-2xl p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <AlertTriangle size={20} />
            </div>
            <h2 className="text-xl font-bold text-slate-900">No invoices found</h2>
            <p className="mt-2 text-sm text-slate-500">
              There are no invoices in {selectedLabel}. Go back and choose another financial year.
            </p>
            <div className="mt-6">
              <Button onClick={() => navigate('/app/invoices')}>Back to invoices</Button>
            </div>
          </Card>
        )}
      </main>

      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm;
            background-color: white !important;
          }
          body * { visibility: hidden; }
          .invoice-export-root, .invoice-export-root * { visibility: visible !important; }
          .invoice-export-root {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background-color: white !important;
          }
          .invoice-export-sheet {
            margin: 0 !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            break-after: page;
            page-break-after: always;
          }
          .invoice-export-sheet:last-child {
            break-after: auto !important;
            page-break-after: auto !important;
          }
          .print\:hidden {
            display: none !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #invoice-document {
            box-shadow: none !important;
            margin: 0 auto !important;
            background-color: white !important;
          }
        }
      `}</style>
    </div>
  );
}
