import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Printer, Pencil, CreditCard, Share2,
  Mail, MessageCircle, Link2, CheckCircle2, Clock, XCircle, ChevronDown, X, Send
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { PageLoader } from '../../components/ui/Loader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { InvoicePreview as InvoiceDocument } from '../../components/invoices/InvoicePreview';
import { normalizeInvoiceNumber } from '../../lib/invoiceNumber';
import { canonicalRoute, invoiceRoute } from '../../utils/entityRoutes';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

const STATUS_COLORS = {
  Paid: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle2 },
  Sent: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Send },
  Draft: { bg: 'bg-slate-100', text: 'text-slate-600', icon: Clock },
  Overdue: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
  'Partially Paid': { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock },
  Cancelled: { bg: 'bg-red-100', text: 'text-red-600', icon: XCircle },
};

const WhatsAppIcon = ({ size = 16, className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

// ─── Email Modal ───────────────────────────────────────────────────────────────

function EmailModal({ open, onClose, invoice, client, onSend, sending, publicUrl }) {
  const [to, setTo] = useState(client?.email || '');
  const [subject, setSubject] = useState(`Invoice ${invoice?.invoiceNumber || ''}`);
  const [body, setBody] = useState(`Dear ${client?.companyName || client?.name || 'Client'},\n\nPlease view and download your invoice ${invoice?.invoiceNumber || ''} using the link below:\n${publicUrl || ''}\n\nTotal Amount: ₹${fmt(invoice?.totalAmount || 0)}\nDue Date: ${fmtDate(invoice?.dueDate) || 'On Receipt'}\n\nThank you for your business!\n`);

  useEffect(() => {
    if (open) {
      setTo(client?.email || '');
      setSubject(`Invoice ${invoice?.invoiceNumber || ''}`);
      setBody(`Dear ${client?.companyName || client?.name || 'Client'},\n\nPlease view and download your invoice ${invoice?.invoiceNumber || ''} using the link below:\n${publicUrl || ''}\n\nTotal Amount: ₹${fmt(invoice?.totalAmount || 0)}\nDue Date: ${fmtDate(invoice?.dueDate) || 'On Receipt'}\n\nThank you for your business!\n`);
    }
  }, [open, client, invoice, publicUrl]);

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Send Invoice via Email" size="md">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">To</label>
          <Input value={to} onChange={e => setTo(e.target.value)} placeholder="client@example.com" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Subject</label>
          <Input value={subject} onChange={e => setSubject(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Message</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={7}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none resize-none"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSend(to, subject, body)} disabled={sending || !to}>
            {sending ? 'Sending…' : <><Send size={14} className="mr-1.5" /> Send Email</>}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Details Page ────────────────────────────────────────────────────────

export function InvoiceDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, hasPermission } = useAuth();
  const [invoice, setInvoice] = useState(null);
  const [client, setClient] = useState(null);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [emailOpen, setEmailOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const canEdit = hasPermission('invoices.manage') || hasPermission('invoices.write');

  useEffect(() => {
    if (!invoice?.id) return;
    const next = canonicalRoute('invoices', invoice, `/app/invoices/${id}`);
    if (next) navigate(next, { replace: true });
  }, [id, invoice, navigate]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [invRes, settingsRes] = await Promise.all([
          api.resources.get('/invoices', id, token),
          api.settings.get(token)
        ]);
        if (active) {
          setInvoice(invRes.data);
          setSettings(settingsRes.data || {});
          if (invRes.data.clientId) {
            const clientRes = await api.resources.get('/clients', invRes.data.clientId, token);
            setClient(clientRes.data);
          }
        }
      } catch (err) {
        if (active) { toast.error('Failed to load invoice'); navigate('/app/invoices'); }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [id, token, navigate]);

  if (loading) return <PageLoader />;
  if (!invoice) return null;
  const invoiceNumber = normalizeInvoiceNumber(invoice.invoiceNumber);
  const displayInvoice = { ...invoice, invoiceNumber };

  const publicUrl = `${window.location.origin}${window.location.pathname.split('#')[0]}#/invoice/public/${invoice.id}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success('Public link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy link');
    }
  };

  const handleWhatsApp = () => {
    const phone = client?.mobile?.replace(/\D/g, '') || '';
    const message = encodeURIComponent(
      `Hello ${client?.companyName || client?.name || ''},\n\nPlease find your invoice *${invoiceNumber}* here:\n${publicUrl}\n\nAmount: ₹${fmt(invoice.totalAmount)}\nDue: ${fmtDate(invoice.dueDate) || 'On Receipt'}\n\nThank you!`
    );
    window.open(phone ? `https://wa.me/${phone}?text=${message}` : `https://wa.me/?text=${message}`, '_blank');
  };

  const handleSendEmail = async (to, subject, body) => {
    setSendingEmail(true);
    try {
      await fetch(`/api/invoices/${invoice.id}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to, subject, body })
      }).then(r => r.json()).then(r => {
        if (!r.success) throw new Error(r.message);
      });
      toast.success('Email sent successfully!');
      setEmailOpen(false);
    } catch (err) {
      toast.error(err.message || 'Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  const templates = Array.isArray(settings.invoiceTemplates) ? settings.invoiceTemplates : [];
  const template = templates.find(t => String(t.id) === String(invoice.templateId)) || templates.find(t => t.isDefault) || templates[0] || null;
  const statusInfo = STATUS_COLORS[invoice.status] || STATUS_COLORS.Draft;
  const StatusIcon = statusInfo.icon;

  return (
    <>
      <div className="pb-12 min-h-[calc(100vh-4rem)]">
        {/* Full-width Action Bar */}
        <div className="print:hidden px-4 sm:px-8 py-4 mb-6 bg-white/50 border-b border-slate-200">
          <div className="w-full flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => navigate('/app/invoices')} className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors" title="Back to Invoices">
                <ArrowLeft size={16} />
                Back
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-slate-900">Invoice {invoiceNumber}</h1>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-sm border border-black/5 ${statusInfo.bg} ${statusInfo.text}`}>
                    <StatusIcon size={14} /> {invoice.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Public Link Mini Card */}
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 mr-2 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-3 border-r border-slate-200">Public Link</span>
                <div className="flex items-center gap-0.5 px-1.5">
                  <button onClick={handleCopyLink} className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Copy Link">
                    {copied ? <CheckCircle2 size={16} className="text-emerald-600" /> : <Link2 size={16} />}
                  </button>
                  <button onClick={handleWhatsApp} className="p-1.5 rounded-lg text-slate-500 hover:text-green-600 hover:bg-green-50 transition-colors" title="WhatsApp Link">
                    <WhatsAppIcon size={16} />
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <Button variant="secondary" onClick={() => setEmailOpen(true)} className="bg-white border-slate-200 shadow-sm hover:border-blue-200 hover:text-blue-700 hover:bg-blue-50/50">
                <Mail size={16} className="mr-1.5" /> Email
              </Button>
              <Button variant="secondary" onClick={() => window.print()} className="bg-white border-slate-200 shadow-sm hover:border-slate-300 hover:bg-slate-50">
                <Printer size={16} className="mr-1.5" /> Print
              </Button>
              
              {/* Edit (only Draft/Sent) */}
              {canEdit && ['Draft', 'Sent'].includes(invoice.status) && (
                <Button variant="secondary" onClick={() => navigate(invoiceRoute(invoice, 'edit'))} className="bg-white border-slate-200 shadow-sm hover:border-amber-200 hover:text-amber-700 hover:bg-amber-50/50">
                  <Pencil size={16} className="mr-1.5" /> Edit
                </Button>
              )}

              {/* Record Payment (hide if fully paid) */}
              {invoice.status !== 'Paid' && invoice.status !== 'Cancelled' && (
                <Button onClick={() => navigate('/app/payments/new', { state: { invoiceId: invoice.id, clientId: invoice.clientId } })} className="shadow-md shadow-[var(--primary)]/20 px-5">
                  <CreditCard size={16} className="mr-2" /> Record Payment
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Invoice Document Wrapper */}
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex justify-center print:justify-start print:p-0">
          <div className="w-full max-w-[210mm]">
            <InvoiceDocument draft={displayInvoice}
              client={client}
              company={settings?.company || {}}
              logos={settings?.logos || {}}
              template={template}
              bankAccount={displayInvoice.bankAccount || null}
              bankSettings={settings?.bank || {}}
              invoiceSettings={settings || {}}
              pageNumber={1}
              totalPages={1}
            />
          </div>
        </div>
      </div>
      </div>

      {/* Email Modal */}
      <EmailModal 
        open={emailOpen} 
        onClose={() => setEmailOpen(false)} 
        invoice={displayInvoice} 
        client={client} 
        onSend={handleSendEmail} 
        sending={sendingEmail} 
        publicUrl={publicUrl}
      />

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            margin: 0;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * { visibility: hidden; }
          #invoice-document, #invoice-document * { visibility: visible; }
          #invoice-document { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </>
  );
}
