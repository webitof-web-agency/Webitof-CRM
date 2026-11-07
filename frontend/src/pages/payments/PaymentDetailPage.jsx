import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Calendar, Building, FileText, Briefcase, Hash, DollarSign, Activity, Edit3, Printer, Download, CheckCircle2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { PageLoader } from '../../components/ui/Loader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { PaymentFormModal } from '../../components/forms/PaymentFormModal';
import { Badge } from '../../components/ui/Badge';
import { getInvoiceStatusTone, getPaymentStatusTone } from '../../lib/paymentStatus';
import { canonicalRoute, clientRoute, invoiceRoute, paymentRoute, projectRoute } from '../../utils/entityRoutes';

export function PaymentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, hasPermission } = useAuth();
  
  const [payment, setPayment] = useState(null);
  const [client, setClient] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [project, setProject] = useState(null);
  const [bankAccount, setBankAccount] = useState(null);
  const [companySettings, setCompanySettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        setLoading(true);
        // Load the payment
        const paymentRes = await api.resources.get('/payments', id, token);
        if (!mounted) return;
        
        const paymentData = paymentRes.data;
        setPayment(paymentData);
        
        // Load related entities if they exist
        const promises = [
          api.settings.get(token).then((res) => setCompanySettings(res.data)).catch(() => {})
        ];
        
        if (paymentData.clientId) {
          promises.push(
            api.resources.get('/clients', paymentData.clientId, token)
              .then(res => setClient(res.data))
              .catch(() => {})
          );
        }
        
        if (paymentData.invoiceId) {
          promises.push(
            api.resources.get('/invoices', paymentData.invoiceId, token)
              .then(res => setInvoice(res.data))
              .catch(() => {})
          );
        }
        
        if (paymentData.projectId) {
          promises.push(
            api.resources.get('/projects', paymentData.projectId, token)
              .then(res => setProject(res.data))
              .catch(() => {})
          );
        }

        if (paymentData.bankAccountId) {
          promises.push(
            api.resources.get('/banking/accounts', paymentData.bankAccountId, token)
              .then(res => setBankAccount(res.data))
              .catch(() => {})
          );
        }
        
        await Promise.allSettled(promises);
      } catch (error) {
        if (mounted) {
          toast.error(error.message || 'Failed to load payment details');
          navigate('/app/payments');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    
    loadData();
    return () => { mounted = false; };
  }, [id, token, navigate]);

  useEffect(() => {
    if (!payment?.id) return;
    const next = canonicalRoute('payments', payment, `/app/payments/${id}`);
    if (next) navigate(next, { replace: true });
  }, [id, navigate, payment]);

  if (loading) return <PageLoader />;
  if (!payment) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const paymentStatus = payment.paymentStatus || 'Received';
  const invoiceStatus = invoice?.status || 'Sent';
  const invoiceBalance = invoice ? Math.max(0, (invoice.totalAmount || 0) - (invoice.paidAmount || 0)) : 0;
  const company = companySettings?.company || {};
  const receiptNumber = `REC-${(payment.id || '').substring(0, 8).toUpperCase()}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/app/payments')}
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
            >
              <ArrowLeft size={16} />
              Back to Payments
            </button>
            <span className="text-slate-300">/</span>
            <h1 className="text-base font-semibold tracking-tight text-[var(--text-main)]">
              Payment {payment.id?.substring(0, 8)}
            </h1>
          </div>
          <div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-xs font-medium text-[var(--text-muted)]">
                {payment.paymentMode || 'Payment'}
              </span>
              <Badge tone={getPaymentStatusTone(paymentStatus)}>{paymentStatus}</Badge>
              {invoice ? <Badge tone={getInvoiceStatusTone(invoiceStatus)}>{invoiceStatus}</Badge> : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            className="shadow-xs cursor-pointer"
            onClick={() => setReceiptOpen(true)}
          >
            <Printer size={16} className="mr-2 text-emerald-600" />
            Print Receipt
          </Button>
          {hasPermission('payments.write') && (
            <Button variant="outline" className="shadow-xs cursor-pointer" onClick={() => setEditOpen(true)}>
              <Edit3 size={16} className="mr-2" />
              Edit Payment
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-[var(--border)] pb-4">
            <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wider">Amount Received</p>
              <p className="text-3xl font-bold text-[var(--text-main)]">{formatMoney(payment.amountReceived)}</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 text-[var(--text-muted)]" size={18} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Payment Date</p>
                <p className="text-base font-medium text-[var(--text-main)]">{formatDate(payment.paymentDate)}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CreditCard className="mt-0.5 text-[var(--text-muted)]" size={18} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Payment Mode</p>
                <p className="text-base font-medium text-[var(--text-main)]">{payment.paymentMode || '-'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Activity className="mt-0.5 text-[var(--text-muted)]" size={18} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Payment Status</p>
                <p className="text-base font-medium text-[var(--text-main)]">{paymentStatus}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Hash className="mt-0.5 text-[var(--text-muted)]" size={18} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Transaction ID / Reference</p>
                <p className="text-base font-medium text-[var(--text-main)]">{payment.transactionId || '-'}</p>
              </div>
            </div>

            {payment.tdsDeducted > 0 && (
              <div className="flex items-start gap-3">
                <Activity className="mt-0.5 text-[var(--text-muted)]" size={18} />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">TDS Deducted</p>
                  <p className="text-base font-medium text-[var(--text-main)]">{formatMoney(payment.tdsDeducted)}</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6 space-y-6 bg-slate-50/50">
          <h3 className="text-lg font-bold text-[var(--text-main)] border-b border-[var(--border)] pb-2">Related Records</h3>
          
          <div className="space-y-5">
            {client && (
              <div 
                className="flex items-center gap-3 p-3 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl cursor-pointer hover:border-blue-300 transition-colors"
                onClick={() => navigate(clientRoute(client))}
              >
                <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded-lg">
                  <Building size={20} />
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--text-muted)] uppercase">Client</p>
                  <p className="font-semibold text-[var(--text-main)]">{client.name || client.companyName}</p>
                </div>
              </div>
            )}

            {invoice && (
              <div 
                className="flex items-center gap-3 p-3 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl cursor-pointer hover:border-blue-300 transition-colors"
                onClick={() => navigate(invoiceRoute(invoice))}
              >
                <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
                  <FileText size={20} />
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--text-muted)] uppercase">Invoice</p>
                  <p className="font-semibold text-[var(--text-main)]">{invoice.invoiceNumber}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {invoice.status || 'Sent'} · Balance {formatMoney(invoiceBalance)}
                  </p>
                </div>
              </div>
            )}

            {project && (
              <div 
                className="flex items-center gap-3 p-3 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl cursor-pointer hover:border-blue-300 transition-colors"
                onClick={() => navigate(projectRoute(project))}
              >
                <div className="p-2 bg-purple-500/10 text-purple-600 rounded-lg">
                  <Briefcase size={20} />
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--text-muted)] uppercase">Project</p>
                  <p className="font-semibold text-[var(--text-main)] truncate max-w-[200px]">{project.title}</p>
                </div>
              </div>
            )}

            {bankAccount && (
              <div 
                className="flex items-center gap-3 p-3 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl cursor-pointer hover:border-blue-300 transition-colors"
                onClick={() => navigate(`/app/banking`)}
              >
                <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg">
                  <Activity size={20} />
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--text-muted)] uppercase">Bank Account</p>
                  <p className="font-semibold text-[var(--text-main)]">{bankAccount.bankName} - {bankAccount.accountNumber?.slice(-4)}</p>
                </div>
              </div>
            )}
            
            {(!client && !invoice && !project && !bankAccount) && (
              <div className="text-sm text-[var(--text-muted)] text-center py-4">
                No related records found.
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Payment Receipt Modal */}
      <Modal
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        title="Official Payment Receipt"
        subtitle={`Receipt voucher for payment #${receiptNumber}`}
        width="680px"
        footer={(
          <div className="flex items-center justify-between w-full">
            <Button variant="ghost" size="sm" onClick={() => setReceiptOpen(false)}>
              Close
            </Button>
            <Button
              size="sm"
              onClick={() => window.print()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs cursor-pointer"
            >
              <Printer size={14} className="mr-1.5" />
              Print Receipt
            </Button>
          </div>
        )}
      >
        <div id="payment-receipt-print" className="p-6 bg-[var(--surface-elevated)] rounded-2xl border border-[var(--border)] shadow-xs space-y-6 text-[var(--text-main)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
            <div>
              <h2 className="text-lg font-black text-[var(--text-main)]">{company.name || 'Webitof'}</h2>
              <p className="text-xs text-[var(--text-muted)]">{company.address || company.email || ''}</p>
              {company.gstin && <p className="text-[11px] text-[var(--text-muted)] font-mono">GSTIN: {company.gstin}</p>}
            </div>
            <div className="text-right">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-800 border border-emerald-500/25">
                <CheckCircle2 size={12} className="mr-1" /> PAYMENT RECEIPT
              </span>
              <p className="text-xs font-bold text-[var(--text-main)] mt-1.5 font-mono">{receiptNumber}</p>
              <p className="text-xs text-[var(--text-muted)]">Date: {formatDate(payment.paymentDate)}</p>
            </div>
          </div>

          {/* Body */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-[var(--surface-2)] rounded-xl border border-[var(--border)] space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Received From</span>
              <p className="font-bold text-sm text-[var(--text-main)]">{client?.companyName || client?.name || 'Client'}</p>
              {client?.email && <p className="text-[var(--text-muted)]">{client.email}</p>}
              {client?.mobile && <p className="text-[var(--text-muted)]">{client.mobile}</p>}
            </div>
            <div className="p-3 bg-[var(--surface-2)] rounded-xl border border-[var(--border)] space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Payment Details</span>
              <p className="font-semibold text-[var(--text-main)]">Mode: <span className="font-bold">{payment.paymentMode || 'Direct'}</span></p>
              {payment.transactionId && <p className="text-[var(--text-muted)] font-mono">Txn: {payment.transactionId}</p>}
              {invoice && <p className="text-[var(--text-muted)]">Against Invoice: <span className="font-bold">#{invoice.invoiceNumber}</span></p>}
            </div>
          </div>

          {/* Amount Box */}
          <div className="p-4 bg-emerald-50/70 border border-emerald-500/25 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">Amount Received</span>
              <p className="text-xs text-emerald-700 font-medium mt-0.5">Payment successfully processed & verified</p>
            </div>
            <span className="text-2xl font-black text-emerald-700">
              {formatMoney(payment.amountReceived)}
            </span>
          </div>

          {payment.notes && (
            <div className="text-xs text-[var(--text-muted)] bg-[var(--surface-2)] p-3 rounded-xl border border-[var(--border)]">
              <span className="font-bold text-[var(--text-main)]">Notes: </span>{payment.notes}
            </div>
          )}

          {/* Signatures */}
          <div className="pt-6 border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span>Generated electronically by Webitof CRM</span>
            <div className="text-right">
              <div className="w-32 border-b border-[var(--border)] pb-8 mb-1 text-center text-[var(--text-muted)] font-semibold italic">
                Authorised Signatory
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <PaymentFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initialData={payment}
        onSuccess={() => {
          setEditOpen(false);
          window.location.reload();
        }}
      />
    </div>
  );
}
