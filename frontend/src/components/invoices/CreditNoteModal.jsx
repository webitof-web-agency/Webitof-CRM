import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { Input, Textarea } from '../ui/Input';
import { formatINR, istDate } from '../../lib/format';

const emptyLine = () => ({ description: '', quantity: 1, rate: '', gstRate: '' });

/**
 * Raise a credit note against an issued invoice: credit all of it, or just some lines. The server prices and taxes
 * the credit with the invoice's own GST treatment and refuses anything beyond the invoice's value.
 */
export function CreditNoteModal({ open, onClose, invoice, token, onIssued }) {
  const [mode, setMode] = useState('full');
  const [lines, setLines] = useState([emptyLine()]);
  const [reason, setReason] = useState('');
  const [issueDate, setIssueDate] = useState(istDate(0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setMode('full');
    setLines([emptyLine()]);
    setReason('');
    setIssueDate(istDate(0));
    setError('');
  }, [open]);

  // What is left to credit: taxable value plus GST of the invoice, less credit notes already issued.
  const remaining = useMemo(() => {
    const worth = Number(invoice?.taxableAmount || 0) + Number(invoice?.gstAmount || 0);
    return Math.max(0, Math.round((worth - Number(invoice?.creditTotal || 0)) * 100) / 100);
  }, [invoice]);

  const setLine = (index, patch) => setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  const startFromInvoice = () => {
    const source = (invoice?.items || []).filter((item) => !item.hidden);
    if (!source.length) return;
    setLines(
      source.map((item) => ({
        description: item.description || item.serviceName || 'Item',
        quantity: Number(item.quantity ?? item.qty ?? 1) || 1,
        rate: Number(item.rate) || '',
        gstRate: item.gstRate ?? item.taxRate ?? ''
      }))
    );
  };

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!reason.trim()) return setError('Give a reason for the credit note.');
    const body = { invoiceId: invoice.id, reason: reason.trim(), issueDate };
    if (mode === 'part') {
      const cleaned = lines.map((line) => ({
        description: String(line.description || '').trim(),
        quantity: Number(line.quantity),
        rate: Number(line.rate),
        ...(line.gstRate !== '' && line.gstRate != null ? { gstRate: Number(line.gstRate) } : {})
      }));
      if (cleaned.some((line) => !line.description || !(line.quantity > 0) || !(line.rate > 0))) {
        return setError('Every line needs a description, a quantity and an amount greater than zero.');
      }
      body.items = cleaned;
    }
    setBusy(true);
    try {
      const response = await api.creditNotes.create(token, body);
      api.cache.invalidate('/invoices');
      toast.success(`Credit note ${response.data?.creditNote?.creditNoteNumber || ''} issued`);
      onIssued?.(response.data);
      onClose();
    } catch (requestError) {
      setError(requestError.message || 'Could not issue the credit note');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title="Issue credit note" subtitle={invoice?.invoiceNumber} width="min(680px,96vw)">
      <form onSubmit={submit} className="space-y-4">
        {error ? (
          <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        ) : null}

        <p className="text-sm text-[var(--text-muted)]">
          A credit note reduces what the client owes on this invoice. The invoice itself is not changed. GST is worked out at the invoice's own rates.
          You can still credit up to <strong className="text-[var(--text-main)]">{formatINR(remaining)}</strong>.
        </p>

        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-semibold text-[var(--text-main)]">What to credit</legend>
          {[
            ['full', 'The whole invoice', 'Cancels the invoice\'s value (use for a full return or a billing error).'],
            ['part', 'Part of it', 'Credit specific lines or amounts.']
          ].map(([value, label, help]) => (
            <label key={value} className="flex cursor-pointer items-start gap-2 rounded-xl border border-[var(--border)] p-3 text-sm">
              <input type="radio" name="credit-mode" className="mt-1 accent-[var(--primary)]" checked={mode === value} onChange={() => setMode(value)} />
              <span>
                <span className="font-semibold text-[var(--text-main)]">{label}</span>
                <span className="block text-xs text-[var(--text-muted)]">{help}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {mode === 'part' ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[var(--text-main)]">Lines to credit (amounts before GST)</p>
              <Button type="button" size="xs" variant="secondary" onClick={startFromInvoice}>Start from invoice lines</Button>
            </div>
            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_5rem_7rem_5rem_auto]">
                <Input aria-label={`Line ${index + 1} description`} placeholder="Description" value={line.description} onChange={(e) => setLine(index, { description: e.target.value })} />
                <Input aria-label={`Line ${index + 1} quantity`} type="number" min="0" step="any" placeholder="Qty" value={line.quantity} onChange={(e) => setLine(index, { quantity: e.target.value })} />
                <Input aria-label={`Line ${index + 1} amount`} type="number" min="0" step="any" placeholder="Amount each" value={line.rate} onChange={(e) => setLine(index, { rate: e.target.value })} />
                <Input aria-label={`Line ${index + 1} GST rate`} type="number" min="0" max="100" step="any" placeholder="GST %" value={line.gstRate} onChange={(e) => setLine(index, { gstRate: e.target.value })} />
                <IconButton tone="danger" title={`Remove line ${index + 1}`} disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, i) => i !== index))}>
                  <Trash2 size={15} />
                </IconButton>
              </div>
            ))}
            <Button type="button" size="sm" variant="secondary" onClick={() => setLines((current) => [...current, emptyLine()])} disabled={lines.length >= 50}>Add line</Button>
            <p className="text-xs text-[var(--text-muted)]">Leave GST % empty to use the invoice's default rate.</p>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-[var(--text-main)]">Reason *</span>
            <Textarea rows={3} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="For example: services not delivered, rate corrected, goods returned" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-[var(--text-main)]">Credit note date</span>
            <Input type="date" value={issueDate} min={String(invoice?.invoiceDate || '').slice(0, 10) || undefined} max={istDate(0)} onChange={(e) => setIssueDate(e.target.value)} />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={remaining <= 0}>Issue credit note</Button>
        </div>
      </form>
    </Modal>
  );
}
