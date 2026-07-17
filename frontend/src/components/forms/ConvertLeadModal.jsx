import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { toast } from 'sonner';
import { api, request } from '../../api/client';
import { ArrowRight, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function ConvertLeadModal({ open, onClose, lead, targetStatus, onSuccess }) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!lead?.id) return;

    setLoading(true);
    try {
      const response = await request(`/leads/${lead.id}/convert`, { method: 'POST', token, body: {} });
      api.cache.invalidate('/leads');
      api.cache.invalidate('/clients');
      toast.success('Lead successfully converted to Client!');
      onSuccess?.(response.data);
      onClose();
    } catch (error) {
      toast.error(error.message || 'Failed to convert lead');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Convert to Client"
      subtitle={`"${lead?.name || lead?.companyName || 'This lead'}" will be moved to clients and removed from leads.`}
      width="520px"
      footer={(
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Converting...' : (
              <span className="flex items-center">
                <UserPlus size={16} className="mr-2" />
                Convert & Save
              </span>
            )}
          </Button>
        </div>
      )}
    >
      <div className="space-y-4 py-2">
        <div className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
          <ArrowRight size={18} className="text-emerald-500" />
          Lead data will be copied into a Client record automatically. The lead will be removed after conversion.
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Target Status</div>
          <div className="mt-1 text-sm font-semibold text-slate-800">{targetStatus || 'Won'}</div>
          <div className="mt-3 text-xs leading-5 text-slate-500">
            We will keep the lead's fields in sync with the client record through the client form and schema.
          </div>
        </div>
      </div>
    </Modal>
  );
}
