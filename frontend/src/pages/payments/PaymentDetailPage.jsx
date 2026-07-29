import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Calendar, Building, FileText, Briefcase, Hash, DollarSign, Activity, Edit3 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { PageLoader } from '../../components/ui/Loader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
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
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

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
        const promises = [];
        
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
    return Number(amount || 0).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    });
  };

  const invoiceStatus = invoice?.status || 'Sent';
  const invoiceBalance = Number(invoice?.balanceDue || 0);
  const paymentStatus = payment.paymentStatus || 'Received';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/app/payments')}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800"
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
        {hasPermission('payments.write') && (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" className="shadow-sm" onClick={() => setEditOpen(true)}>
              <Edit3 size={16} className="mr-2" />
              Edit Payment
            </Button>
          </div>
        )}
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
