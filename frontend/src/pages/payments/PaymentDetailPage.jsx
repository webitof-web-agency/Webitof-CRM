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
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
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
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
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
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Amount Received</p>
              <p className="text-3xl font-bold text-slate-900">{formatMoney(payment.amountReceived)}</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 text-slate-400" size={18} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Payment Date</p>
                <p className="text-base font-medium text-slate-900">{formatDate(payment.paymentDate)}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CreditCard className="mt-0.5 text-slate-400" size={18} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Payment Mode</p>
                <p className="text-base font-medium text-slate-900">{payment.paymentMode || '-'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Activity className="mt-0.5 text-slate-400" size={18} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Payment Status</p>
                <p className="text-base font-medium text-slate-900">{paymentStatus}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Hash className="mt-0.5 text-slate-400" size={18} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Transaction ID / Reference</p>
                <p className="text-base font-medium text-slate-900">{payment.transactionId || '-'}</p>
              </div>
            </div>

            {payment.tdsDeducted > 0 && (
              <div className="flex items-start gap-3">
                <Activity className="mt-0.5 text-slate-400" size={18} />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">TDS Deducted</p>
                  <p className="text-base font-medium text-slate-900">{formatMoney(payment.tdsDeducted)}</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6 space-y-6 bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">Related Records</h3>
          
          <div className="space-y-5">
            {client && (
              <div 
                className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-blue-300 transition-colors"
                onClick={() => navigate(`/app/clients/${client.id}`)}
              >
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Building size={20} />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase">Client</p>
                  <p className="font-semibold text-slate-900">{client.name || client.companyName}</p>
                </div>
              </div>
            )}

            {invoice && (
              <div 
                className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-blue-300 transition-colors"
                onClick={() => navigate(`/app/invoices/${invoice.id}`)}
              >
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <FileText size={20} />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase">Invoice</p>
                  <p className="font-semibold text-slate-900">{invoice.invoiceNumber}</p>
                  <p className="text-xs text-slate-500">
                    {invoice.status || 'Sent'} · Balance {formatMoney(invoiceBalance)}
                  </p>
                </div>
              </div>
            )}

            {project && (
              <div 
                className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-blue-300 transition-colors"
                onClick={() => navigate(`/app/projects/${project.id}`)}
              >
                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                  <Briefcase size={20} />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase">Project</p>
                  <p className="font-semibold text-slate-900 truncate max-w-[200px]">{project.title}</p>
                </div>
              </div>
            )}

            {bankAccount && (
              <div 
                className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-blue-300 transition-colors"
                onClick={() => navigate(`/app/banking`)}
              >
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                  <Activity size={20} />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase">Bank Account</p>
                  <p className="font-semibold text-slate-900">{bankAccount.bankName} - {bankAccount.accountNumber?.slice(-4)}</p>
                </div>
              </div>
            )}
            
            {(!client && !invoice && !project && !bankAccount) && (
              <div className="text-sm text-slate-500 text-center py-4">
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
        <div id="payment-receipt-print" className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-6 text-slate-800">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">{company.name || 'Webitof'}</h2>
              <p className="text-xs text-slate-500">{company.address || company.email || ''}</p>
              {company.gstin && <p className="text-[11px] text-slate-500 font-mono">GSTIN: {company.gstin}</p>}
            </div>
            <div className="text-right">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle2 size={12} className="mr-1" /> PAYMENT RECEIPT
              </span>
              <p className="text-xs font-bold text-slate-900 mt-1.5 font-mono">{receiptNumber}</p>
              <p className="text-xs text-slate-500">Date: {formatDate(payment.paymentDate)}</p>
            </div>
          </div>

          {/* Body */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Received From</span>
              <p className="font-bold text-sm text-slate-900">{client?.companyName || client?.name || 'Client'}</p>
              {client?.email && <p className="text-slate-500">{client.email}</p>}
              {client?.mobile && <p className="text-slate-500">{client.mobile}</p>}
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Payment Details</span>
              <p className="font-semibold text-slate-800">Mode: <span className="font-bold">{payment.paymentMode || 'Direct'}</span></p>
              {payment.transactionId && <p className="text-slate-600 font-mono">Txn: {payment.transactionId}</p>}
              {invoice && <p className="text-slate-600">Against Invoice: <span className="font-bold">#{invoice.invoiceNumber}</span></p>}
            </div>
          </div>

          {/* Amount Box */}
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">Amount Received</span>
              <p className="text-xs text-emerald-700 font-medium mt-0.5">Payment successfully processed & verified</p>
            </div>
            <span className="text-2xl font-black text-emerald-700">
              {formatMoney(payment.amountReceived)}
            </span>
          </div>

          {payment.notes && (
            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="font-bold text-slate-700">Notes: </span>{payment.notes}
            </div>
          )}

          {/* Signatures */}
          <div className="pt-6 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
            <span>Generated electronically by Webitof CRM</span>
            <div className="text-right">
              <div className="w-32 border-b border-slate-300 pb-8 mb-1 text-center text-slate-600 font-semibold italic">
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
