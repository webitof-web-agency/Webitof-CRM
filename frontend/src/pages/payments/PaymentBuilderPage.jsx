import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { PageLoader } from '../../components/ui/Loader';
import { PAYMENT_STATUS_OPTIONS } from '../../lib/paymentStatus';

export function PaymentBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  
  const [draft, setDraft] = useState({
    paymentDate: new Date().toISOString().slice(0, 10),
    clientId: location.state?.clientId || '',
    invoiceId: location.state?.invoiceId || '',
    amountReceived: '',
    tdsDeducted: 0,
    paymentStatus: 'Received',
    paymentMode: 'Bank Transfer',
    bankAccountId: '',
    transactionId: '',
    notes: ''
  });

  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const [clientsRes, invoicesRes, bankRes] = await Promise.all([
          api.resources.list('/clients', token),
          api.resources.list('/invoices', token),
          api.resources.list('/banking/accounts', token)
        ]);
        if (!active) return;
        setClients(clientsRes.data || []);
        setInvoices(invoicesRes.data || []);
        setBankAccounts(bankRes.data || []);

        if (id && id !== 'new') {
          const payRes = await api.resources.get('/payments', id, token);
          if (active) {
            setDraft({
              ...payRes.data,
              paymentDate: payRes.data.paymentDate?.slice(0, 10) || '',
              paymentStatus: payRes.data.paymentStatus || 'Received'
            });
          }
        } else if (location.state?.invoiceId) {
          // If coming from an invoice, prefill the amount
          const inv = invoicesRes.data?.find(i => String(i.id) === String(location.state.invoiceId));
          if (inv) {
            setDraft(d => ({ ...d, amountReceived: inv.totalAmount }));
          }
        }
      } catch (err) {
        if (active) toast.error('Failed to load data');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadData();
    return () => { active = false; };
  }, [id, token, location.state]);

  const handleSave = async () => {
    if (!draft.clientId) return toast.error('Client is required');
    if (!draft.paymentDate) return toast.error('Payment Date is required');
    if (!draft.amountReceived) return toast.error('Amount is required');

    setSaving(true);
    try {
      if (id && id !== 'new') {
        await api.resources.update('/payments', id, draft, token);
        toast.success('Payment updated');
      } else {
        await api.resources.create('/payments', draft, token);
        toast.success('Payment recorded');
      }
      navigate('/app/payments');
    } catch (err) {
      toast.error(err.message || 'Failed to save payment');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <PageHeader
        title={id && id !== 'new' ? 'Edit Payment' : 'Record Payment'}
        actions={[
          { label: 'Cancel', variant: 'secondary', onClick: () => navigate(-1) }
        ]}
      />

      <Card className="p-6 md:p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-main)]">Client *</label>
            <Select
              options={clients.map(c => ({ value: c.id, label: c.companyName || c.name }))}
              value={draft.clientId}
              onChange={(val) => setDraft(d => ({ ...d, clientId: val, invoiceId: '' }))}
              placeholder="Select Client"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-main)]">Against Invoice</label>
            <Select
              options={invoices.filter(i => !draft.clientId || String(i.clientId) === String(draft.clientId)).map(i => ({ 
                value: i.id, 
                label: `${i.invoiceNumber} (₹${(Number(i.totalAmount) || 0).toLocaleString('en-IN')})` 
              }))}
              value={draft.invoiceId}
              onChange={(val) => {
                const inv = invoices.find(i => String(i.id) === String(val));
                setDraft(d => ({ ...d, invoiceId: val, amountReceived: inv ? inv.totalAmount : d.amountReceived }));
              }}
              placeholder="Select Invoice (Optional)"
            />
          </div>
          
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-main)]">Payment Date *</label>
            <Input
              type="date"
              value={draft.paymentDate}
              onChange={(e) => setDraft(d => ({ ...d, paymentDate: e.target.value }))}
            />
          </div>
          
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-main)]">Amount Received (₹) *</label>
            <Input
              type="number"
              min="0"
              value={draft.amountReceived}
              onChange={(e) => setDraft(d => ({ ...d, amountReceived: e.target.value }))}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-main)]">Payment Status</label>
            <Select
              options={PAYMENT_STATUS_OPTIONS.map(status => ({ value: status, label: status }))}
              value={draft.paymentStatus}
              onChange={(val) => setDraft(d => ({ ...d, paymentStatus: val }))}
              placeholder="Select Status"
              searchable={false}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-main)]">Payment Mode</label>
            <Select
              options={['Bank Transfer', 'UPI', 'Cheque', 'Cash', 'Credit Card'].map(m => ({ value: m, label: m }))}
              value={draft.paymentMode}
              onChange={(val) => setDraft(d => ({ ...d, paymentMode: val }))}
              placeholder="Select Mode"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-main)]">Transaction ID / Ref #</label>
            <Input
              value={draft.transactionId}
              onChange={(e) => setDraft(d => ({ ...d, transactionId: e.target.value }))}
              placeholder="NEFT / UTR / Cheque No"
            />
          </div>

          <div className="md:col-span-2 border-t border-[var(--border)] pt-6">
            <label className="mb-1 block text-sm font-medium text-[var(--text-main)]">Notes / Remarks</label>
            <textarea
              className="w-full min-h-[100px] rounded-xl border border-[var(--border)] bg-transparent px-4 py-3 text-sm text-[var(--text-main)] transition-colors focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              value={draft.notes}
              onChange={(e) => setDraft(d => ({ ...d, notes: e.target.value }))}
              placeholder="Any additional details..."
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-[var(--border)]">
          <Button onClick={handleSave} disabled={saving} className="min-w-[140px]">
            {saving ? 'Saving...' : <><Save size={16} className="mr-2" /> Save Payment</>}
          </Button>
        </div>
      </Card>
    </div>
  );
}
