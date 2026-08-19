import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from './SearchableSelect';
import { toast } from 'sonner';
import { api, request } from '../../api/client';
import { ArrowRight, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function ConvertLeadModal({ open, onClose, lead, targetStatus, onSuccess }) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [duplicateClients, setDuplicateClients] = useState([]);
  const [clientChoice, setClientChoice] = useState('new');
  const [createProject, setCreateProject] = useState(false);
  const [projectTitle, setProjectTitle] = useState('');

  useEffect(() => {
    if (!open || !lead?.id) return;
    let active = true;
    setPreviewLoading(true);
    request(`/leads/${lead.id}/conversion-preview`, { token })
      .then((response) => {
        if (!active) return;
        const matches = response.data?.duplicateClients || [];
        setDuplicateClients(matches);
        setClientChoice(matches.length ? '' : 'new');
        setProjectTitle(response.data?.projectDefaults?.title || lead.requirementTitle || lead.companyName || lead.name || '');
      })
      .catch((error) => {
        if (active) toast.error(error.message || 'Failed to check existing clients');
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });
    return () => { active = false; };
  }, [open, lead?.id, lead?.requirementTitle, lead?.companyName, lead?.name, token]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!lead?.id || !clientChoice) return;
    setLoading(true);
    try {
      const response = await request(`/leads/${lead.id}/convert`, {
        method: 'POST',
        token,
        body: {
          existingClientId: clientChoice === 'new' ? '' : clientChoice,
          forceCreateClient: clientChoice === 'new',
          createProject,
          projectTitle: createProject ? projectTitle : ''
        }
      });
      api.cache.invalidate('/leads');
      api.cache.invalidate('/clients');
      api.cache.invalidate('/projects');
      toast.success(createProject ? 'Lead converted to client and project' : 'Lead converted to client');
      onSuccess?.(response);
      onClose();
    } catch (error) {
      if (error.status === 409 && error.payload?.details?.duplicateClients) {
        setDuplicateClients(error.payload.details.duplicateClients);
        setClientChoice('');
      }
      toast.error(error.message || 'Failed to convert lead');
    } finally {
      setLoading(false);
    }
  }

  const clientOptions = [
    ...duplicateClients.map((client) => ({
      value: client.id,
      label: `${client.companyName || client.name}${client.mobile ? ` - ${client.mobile}` : ''}`
    })),
    { value: 'new', label: 'Create new client' }
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Convert Lead"
      subtitle={`${lead?.leadNumber || lead?.name || lead?.companyName || 'Lead'} will remain available in Leads.`}
      width="560px"
      footer={(
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" form="convert-lead-form" disabled={loading || previewLoading || !clientChoice || (createProject && !projectTitle.trim())}>
            <UserPlus size={16} className="mr-2" />
            {loading ? 'Converting...' : 'Convert Lead'}
          </Button>
        </div>
      )}
    >
      <form id="convert-lead-form" onSubmit={handleSubmit} className="space-y-5">
        <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-3 py-3 text-sm font-medium text-emerald-800">
          <ArrowRight size={18} className="shrink-0 text-emerald-600" />
          Status will be set to {targetStatus || 'Won'} and conversion IDs will be saved on the lead.
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Client</span>
          <SearchableSelect value={clientChoice} onChange={setClientChoice} options={clientOptions} placeholder={previewLoading ? 'Checking clients...' : 'Select existing or create new'} allowClear={false} disabled={previewLoading} />
        </label>

        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={createProject} onChange={(event) => setCreateProject(event.target.checked)} />
          Create project
        </label>

        {createProject ? (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Project title</span>
            <Input value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} />
          </label>
        ) : null}
      </form>
    </Modal>
  );
}
