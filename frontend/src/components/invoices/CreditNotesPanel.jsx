import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { SimpleTable } from '../ui/SimpleTable';
import { Textarea } from '../ui/Input';
import { formatDate, formatINR } from '../../lib/format';
import { CreditNoteModal } from './CreditNoteModal';
import { printCreditNote } from './creditNotePrint';

/** Credit notes of one invoice: what has been credited, issue a new one, print or cancel existing ones. */
export function CreditNotesPanel({ invoice, client, company, canWrite, token, onChanged }) {
  const [issueOpen, setIssueOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState(false);

  const notes = Array.isArray(invoice.creditNotes) ? invoice.creditNotes : [];
  const issuedTotal = Number(invoice.creditTotal || 0);
  const refundDue = Number(invoice.refundDue || 0);
  const issuable = !['Draft', 'Cancelled', 'Credited'].includes(invoice.status);
  // An invoice with nothing to show and nothing the user may do needs no panel.
  if (!notes.length && !(canWrite && issuable)) return null;

  async function cancelNote() {
    if (!cancelReason.trim()) return toast.error('Give a reason for cancelling the credit note.');
    setBusy(true);
    try {
      await api.creditNotes.cancel(token, cancelTarget.id, { reason: cancelReason.trim() });
      api.cache.invalidate('/invoices');
      toast.success(`${cancelTarget.creditNoteNumber} cancelled`);
      setCancelTarget(null);
      setCancelReason('');
      onChanged?.();
    } catch (error) {
      toast.error(error.message || 'Could not cancel the credit note');
    } finally {
      setBusy(false);
    }
  }

  function print(note) {
    if (!printCreditNote({ note, invoice, client, company })) toast.error('Allow pop-ups to print the credit note.');
  }

  return (
    <div className="print:hidden mx-auto mb-6 max-w-5xl px-4">
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-[var(--text-main)]">Credit notes</h2>
            <p className="text-xs text-[var(--text-muted)]">
              Invoice {formatINR(invoice.totalAmount)} · Credited {formatINR(issuedTotal)} · Paid {formatINR(invoice.amountPaid)} · Balance due {formatINR(invoice.balanceDue)}
            </p>
          </div>
          {canWrite && issuable ? (
            <Button size="sm" variant="secondary" onClick={() => setIssueOpen(true)}>
              Issue credit note
            </Button>
          ) : null}
        </div>

        {refundDue > 0 ? (
          <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            The client has paid or been credited {formatINR(refundDue)} more than this invoice is worth. That amount is owed back to them.
          </p>
        ) : null}

        {notes.length ? (
          <SimpleTable
            rows={notes}
            columns={[
              { key: 'number', label: 'Credit note', nowrap: true, className: 'font-semibold', render: (note) => note.creditNoteNumber },
              { key: 'date', label: 'Date', nowrap: true, render: (note) => formatDate(note.issueDate) },
              { key: 'reason', label: 'Reason', className: 'max-w-xs', render: (note) => <span className="line-clamp-2">{note.reason}</span> },
              { key: 'total', label: 'Total', align: 'right', nowrap: true, className: 'tabular-nums', render: (note) => formatINR(note.totalAmount) },
              {
                key: 'status',
                label: 'Status',
                render: (note) => <Badge tone={note.status === 'Cancelled' ? 'danger' : 'success'}>{note.status}</Badge>
              },
              {
                key: 'actions',
                label: '',
                align: 'right',
                render: (note) => (
                  <div className="flex justify-end gap-1">
                    <Button size="xs" variant="ghost" onClick={() => print(note)}>Print</Button>
                    {canWrite && note.status === 'Issued' ? (
                      <Button size="xs" variant="ghost" className="text-rose-600" onClick={() => setCancelTarget(note)}>Cancel</Button>
                    ) : null}
                  </div>
                )
              }
            ]}
          />
        ) : (
          <p className="text-xs text-[var(--text-muted)]">No credit notes have been issued against this invoice.</p>
        )}
      </Card>

      <CreditNoteModal open={issueOpen} onClose={() => setIssueOpen(false)} invoice={invoice} token={token} onIssued={() => onChanged?.()} />

      <Modal open={Boolean(cancelTarget)} onClose={busy ? () => {} : () => setCancelTarget(null)} title="Cancel credit note" subtitle={cancelTarget?.creditNoteNumber} width="min(480px,96vw)">
        <div className="space-y-3">
          <p className="text-sm text-[var(--text-muted)]">
            Cancelling puts {cancelTarget ? formatINR(cancelTarget.totalAmount) : ''} back on what the client owes for this invoice. The credit note number is not reused.
          </p>
          <Textarea rows={3} maxLength={500} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Why is this credit note being cancelled?" aria-label="Reason for cancelling" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCancelTarget(null)} disabled={busy}>Keep it</Button>
            <Button variant="destructive" onClick={cancelNote} loading={busy}>Cancel credit note</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
