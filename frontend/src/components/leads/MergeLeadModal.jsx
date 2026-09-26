import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Input';
import { GitMerge, ArrowRight, AlertTriangle, ShieldCheck, Check } from 'lucide-react';
import { toast } from 'sonner';
import { request } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export function MergeLeadModal({ open, onClose, primaryLead, duplicateLead, onSuccess }) {
  const { token } = useAuth();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('Merged duplicate contact records');

  if (!primaryLead || !duplicateLead) return null;

  async function handleMerge() {
    setBusy(true);
    try {
      const res = await request('/leads/merge', {
        method: 'POST',
        token,
        body: {
          primaryLeadId: primaryLead.id,
          duplicateLeadId: duplicateLead.id,
          note
        }
      });
      toast.success(res.message || 'Leads successfully merged');
      onSuccess?.(res.data);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to merge leads');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Merge Duplicate Lead"
      subtitle={`Consolidate duplicate lead ${duplicateLead.leadNumber || ''} into master lead ${primaryLead.leadNumber || ''}`}
      width="min(760px, 96vw)"
      footer={(
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleMerge}
            loading={busy}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
          >
            <GitMerge size={14} className="mr-1.5" />
            Confirm & Merge
          </Button>
        </div>
      )}
    >
      <div className="space-y-4">
        {/* Info Banner */}
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 dark:bg-indigo-950/30 dark:border-indigo-900/60 p-3.5 flex items-start gap-3">
          <GitMerge size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
          <div className="text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed">
            <p className="font-semibold mb-1">What happens when you merge?</p>
            <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-300">
              <li>All <strong>call recordings, activity logs, timeline events, and notes</strong> from the duplicate lead will be transferred into this primary lead.</li>
              <li>The duplicate lead ({duplicateLead.leadNumber || 'Duplicate'}) will be marked as <strong>Merged</strong> and linked to this record.</li>
              <li>This primary lead will remain active with complete history consolidated in one place.</li>
            </ul>
          </div>
        </div>

        {/* Side by side comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Primary Lead (Target) */}
          <div className="rounded-xl border-2 border-emerald-500/60 bg-emerald-50/20 dark:bg-emerald-950/10 p-3.5 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-200 dark:border-emerald-800">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck size={14} /> Master / Primary Lead
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                {primaryLead.leadNumber || primaryLead.id}
              </span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div><span className="text-slate-500">Contact:</span> <strong className="text-slate-800 dark:text-slate-100">{primaryLead.contactPerson || primaryLead.name || 'N/A'}</strong></div>
              <div><span className="text-slate-500">Company:</span> <strong className="text-slate-800 dark:text-slate-100">{primaryLead.companyName || 'N/A'}</strong></div>
              <div><span className="text-slate-500">Phone:</span> <span className="font-mono text-slate-700 dark:text-slate-300">{primaryLead.phone || 'N/A'}</span></div>
              <div><span className="text-slate-500">Email:</span> <span className="text-slate-700 dark:text-slate-300">{primaryLead.email || 'N/A'}</span></div>
              <div><span className="text-slate-500">Status:</span> <span className="font-semibold text-slate-700 dark:text-slate-300">{primaryLead.status}</span></div>
            </div>
          </div>

          {/* Duplicate Lead (Source) */}
          <div className="rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50/20 dark:bg-amber-950/10 p-3.5 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-amber-200 dark:border-amber-800">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle size={14} /> Duplicate to be Merged
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                {duplicateLead.leadNumber || duplicateLead.id}
              </span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div><span className="text-slate-500">Contact:</span> <strong className="text-slate-800 dark:text-slate-100">{duplicateLead.contactPerson || duplicateLead.name || 'N/A'}</strong></div>
              <div><span className="text-slate-500">Company:</span> <strong className="text-slate-800 dark:text-slate-100">{duplicateLead.companyName || 'N/A'}</strong></div>
              <div><span className="text-slate-500">Phone:</span> <span className="font-mono text-slate-700 dark:text-slate-300">{duplicateLead.phone || 'N/A'}</span></div>
              <div><span className="text-slate-500">Email:</span> <span className="text-slate-700 dark:text-slate-300">{duplicateLead.email || 'N/A'}</span></div>
              <div><span className="text-slate-500">Status:</span> <span className="font-semibold text-slate-700 dark:text-slate-300">{duplicateLead.status}</span></div>
            </div>
          </div>
        </div>

        {/* Reason / Note */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Merge Audit Note:
          </label>
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Duplicate enquiry from web form merged into existing consultation lead."
            className="text-xs"
          />
        </div>
      </div>
    </Modal>
  );
}
