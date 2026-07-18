import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../ui/Modal';
import { Input, Textarea } from '../ui/Input';
import { Button } from '../ui/Button';
import { SearchableSelect } from './SearchableSelect';
import { PAYMENT_STATUS_OPTIONS } from '../../lib/paymentStatus';

function PaymentFormRow({ label, children, required }) {
  return (
    <div className="flex flex-col gap-1 py-2 md:flex-row md:items-start md:gap-4">
      <div className="shrink-0 pt-2 text-sm font-medium text-slate-500 md:w-48 lg:w-56">
        {label} {required && <span className="text-red-500">*</span>}
      </div>
      <div className="min-w-0 flex-1">
        {children}
      </div>
    </div>
  );
}

export function PaymentFormModal({ open, onClose, onSuccess, initialData = null }) {
  const { token } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  
  const [draft, setDraft] = useState({
    paymentDate: new Date().toISOString().slice(0, 10),
    clientId: '',
    invoiceId: '',
    amountReceived: '',
    tdsDeducted: 0,
    paymentStatus: 'Received',
    paymentMode: 'Bank Transfer',
    transactionId: '',
    notes: ''
  });

  useEffect(() => {
    if (!open) return;
    
    let active = true;
    async function loadData() {
      setLoading(true);
      try {
        const [clientsRes, invoicesRes] = await Promise.all([
          api.resources.list('/clients', token),
          api.resources.list('/invoices', token)
        ]);
        if (!active) return;
        setClients(clientsRes.data || []);
        setInvoices(invoicesRes.data || []);

        if (initialData?.id) {
          const payRes = await api.resources.get('/payments', initialData.id, token);
          if (active) {
            setDraft({
              ...payRes.data,
              paymentDate: payRes.data.paymentDate?.slice(0, 10) || '',
            });
          }
        } else if (initialData) {
          // Prefill logic for new payment
          setDraft(prev => ({
            ...prev,
            clientId: initialData.clientId || '',
            invoiceId: initialData.invoiceId || '',
            amountReceived: initialData.amountReceived || prev.amountReceived,
            paymentStatus: initialData.paymentStatus || prev.paymentStatus
          }));
        } else {
            setDraft({
                paymentDate: new Date().toISOString().slice(0, 10),
                clientId: '',
                invoiceId: '',
                amountReceived: '',
                tdsDeducted: 0,
                paymentStatus: 'Received',
                paymentMode: 'Bank Transfer',
                transactionId: '',
                notes: ''
            });
        }
      } catch (err) {
        if (active) toast.error('Failed to load data');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadData();
    return () => { active = false; };
  }, [open, token, initialData]);

  const handleSave = async () => {
    if (!draft.clientId) return toast.error('Client is required');
    if (!draft.paymentDate) return toast.error('Payment Date is required');
    if (!draft.amountReceived) return toast.error('Amount is required');

    setSaving(true);
    try {
      if (initialData?.id) {
        await api.resources.update('/payments', initialData.id, draft, token);
        toast.success('Payment updated');
      } else {
        await api.resources.create('/payments', draft, token);
        toast.success('Payment recorded');
      }
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(err.message || 'Failed to save payment');
    } finally {
      setSaving(false);
    }
  };

  const clientOptions = clients.map(c => ({ value: c.id, label: c.companyName || c.name }));
  const invoiceOptions = invoices
    .filter(i => !draft.clientId || String(i.clientId) === String(draft.clientId))
    .map(i => ({ 
      value: i.id, 
      label: `${i.invoiceNumber} (₹${(Number(i.totalAmount) || 0).toLocaleString('en-IN')})` 
    }));
  
  const modeOptions = ['Bank Transfer', 'UPI', 'Cheque', 'Cash', 'Credit Card'].map(m => ({ value: m, label: m }));
  const statusOptions = PAYMENT_STATUS_OPTIONS.map((status) => ({ value: status, label: status }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialData?.id ? 'Edit Payment' : 'Record Payment'}
      width="800px"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || loading} className="min-w-[140px]">
            {saving ? 'Saving...' : <><Save size={16} className="mr-2" /> Save Payment</>}
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="py-12 flex justify-center"><div className="w-8 h-8 rounded-full border-4 border-[var(--primary)] border-t-transparent animate-spin" /></div>
      ) : (
        <div className="flex flex-col px-1 space-y-1">
          <PaymentFormRow label="Client" required>
            <SearchableSelect
              options={clientOptions}
              value={draft.clientId}
              onChange={(val) => setDraft(d => ({ ...d, clientId: val, invoiceId: '' }))}
              placeholder="Select Client"
              allowClear={false}
            />
          </PaymentFormRow>

          <PaymentFormRow label="Against Invoice">
            <SearchableSelect
              options={invoiceOptions}
              value={draft.invoiceId}
              onChange={(val) => {
                const inv = invoices.find(i => String(i.id) === String(val));
                setDraft(d => ({ ...d, invoiceId: val, amountReceived: inv ? inv.totalAmount : d.amountReceived }));
              }}
              placeholder="Select Invoice (Optional)"
            />
          </PaymentFormRow>
          
          <PaymentFormRow label="Payment Date" required>
            <Input
              type="date"
              value={draft.paymentDate}
              onChange={(e) => setDraft(d => ({ ...d, paymentDate: e.target.value }))}
            />
          </PaymentFormRow>
          
          <PaymentFormRow label="Amount Received (₹)" required>
            <Input
              type="number"
              min="0"
              value={draft.amountReceived}
              onChange={(e) => setDraft(d => ({ ...d, amountReceived: e.target.value }))}
            />
          </PaymentFormRow>

          <PaymentFormRow label="Payment Status">
            <SearchableSelect
              options={statusOptions}
              value={draft.paymentStatus}
              onChange={(val) => setDraft(d => ({ ...d, paymentStatus: val }))}
              placeholder="Select status"
              allowClear={false}
            />
          </PaymentFormRow>

          <PaymentFormRow label="Payment Mode">
            <SearchableSelect
              options={modeOptions}
              value={draft.paymentMode}
              onChange={(val) => setDraft(d => ({ ...d, paymentMode: val }))}
              placeholder="Select Mode"
              allowClear={false}
            />
          </PaymentFormRow>

          <PaymentFormRow label="Transaction ID / Ref #">
            <Input
              value={draft.transactionId}
              onChange={(e) => setDraft(d => ({ ...d, transactionId: e.target.value }))}
              placeholder="NEFT / UTR / Cheque No"
            />
          </PaymentFormRow>

          <PaymentFormRow label="Notes / Remarks">
            <Textarea
              value={draft.notes}
              onChange={(e) => setDraft(d => ({ ...d, notes: e.target.value }))}
              placeholder="Any additional details..."
              rows={3}
            />
          </PaymentFormRow>
        </div>
      )}
    </Modal>
  );
}
