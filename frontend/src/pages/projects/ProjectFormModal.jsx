import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { SearchableSelect } from '../../components/forms/SearchableSelect';
import { AttachmentPicker } from '../../components/ui/AttachmentPicker';
import { normalizeSharedLabels, mergeSharedLabelOptions } from '../../lib/labels';

const EMPTY_FORM = {
  clientId: '',
  title: '',
  projectType: '',
  assignedTo: '',
  status: 'Not Started',
  billingType: 'Fixed',
  progressPercent: '0',
  value: '',
  startDate: '',
  deadline: '',
  description: '',
  notes: '',
  labels: [],
  attachments: []
};

function formatDateInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const direct = raw.match(/^\d{4}-\d{2}-\d{2}/);
  if (direct) return direct[0];
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function parseListValue(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') return item.label || item.value || '';
        return '';
      })
      .filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parseListValue(parsed) : [];
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function parseAttachments(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!item) return null;
        if (typeof item === 'string') {
          return {
            id: item,
            driveFileId: item,
            name: item,
            originalName: item,
            driveWebViewLink: '',
            mimeType: ''
          };
        }
        if (typeof item === 'object') {
          const driveFileId = String(item.driveFileId || item.id || '').trim();
          if (!driveFileId) return null;
          return {
            id: item.id || driveFileId,
            driveFileId,
            name: item.name || item.originalName || 'File',
            originalName: item.originalName || item.name || 'File',
            driveWebViewLink: item.driveWebViewLink || item.webViewLink || '',
            mimeType: item.mimeType || ''
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return parseAttachments(parsed);
    } catch {
      return [];
    }
  }

  return [];
}

function normalizeProjectRecord(record = {}) {
  const status = record.status || 'Not Started';
  return {
    clientId: record.clientId || record.client_id || '',
    title: record.title || '',
    projectType: record.projectType || record.project_type || '',
    assignedTo: record.assignedTo || record.assigned_to || '',
    status,
    billingType: record.billingType || record.billing_type || 'Fixed',
    progressPercent: record.progressPercent != null
      ? String(record.progressPercent)
      : status === 'Completed'
        ? '100'
        : status === 'In Progress'
          ? '50'
          : status === 'On Hold'
            ? '25'
            : '0',
    value: record.value != null ? String(record.value) : '',
    startDate: formatDateInput(record.startDate),
    deadline: formatDateInput(record.deadline),
    description: record.description || '',
    notes: record.notes || '',
    labels: parseListValue(record.labels),
    attachments: parseAttachments(record.attachments)
  };
}

function FormRow({ label, children, required }) {
  return (
    <div className="flex flex-col gap-1 py-2 md:flex-row md:items-start md:gap-4">
      <div className="shrink-0 pt-2 text-sm font-medium text-slate-500 md:w-32 lg:w-40">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function ProjectFormModal({
  open,
  onClose,
  onSuccess,
  initialData = null,
  clients = [],
  users = [],
  settings = null
}) {
  const { token, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [formData, setFormData] = useState(normalizeProjectRecord(initialData || EMPTY_FORM));

  useEffect(() => {
    if (!open) return;
    setFormData(normalizeProjectRecord(initialData || EMPTY_FORM));
  }, [initialData, open]);

  const clientOptions = useMemo(() => clients.map((client) => ({
    value: client.id,
    label: client.companyName || client.name || 'Client',
    description: [client.clientType || client.type || 'Client', client.mobile || client.phone].filter(Boolean).join(' • ')
  })), [clients]);

  const userOptions = useMemo(() => users.map((item) => ({
    value: item.id,
    label: item.fullName || item.username || item.email || 'User',
    description: [item.username, item.roles?.[0]?.name].filter(Boolean).join(' • ') || 'Team member'
  })), [users]);

  const labelOptions = useMemo(() => {
    return mergeSharedLabelOptions(normalizeSharedLabels(settings?.labels || []), formData.labels);
  }, [formData.labels, settings]);

  const statusOptions = useMemo(() => {
    const configured = settings?.statuses?.projects?.length ? settings.statuses.projects : [
      { label: 'Not Started', color: '#64748b' },
      { label: 'In Progress', color: '#3b82f6' },
      { label: 'Completed', color: '#10b981' },
      { label: 'On Hold', color: '#f59e0b' }
    ];
    const values = configured.map((item) => (typeof item === 'string' ? item : item.label));
    return Array.from(new Set(values.concat(['Active', 'Paused', 'Cancelled', 'Archived']))).map((value) => ({ value, label: value }));
  }, [settings]);

  const billingOptions = [
    { value: 'Fixed', label: 'Fixed' },
    { value: 'Hourly', label: 'Hourly' },
    { value: 'Milestone', label: 'Milestone' },
    { value: 'Recurring', label: 'Recurring' }
  ];

  const progressOptions = [
    { value: '0', label: '0% - Not Started' },
    { value: '25', label: '25% - Planning' },
    { value: '50', label: '50% - In Progress' },
    { value: '75', label: '75% - Review' },
    { value: '100', label: '100% - Completed' }
  ];

  function set(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function appendAttachment(file) {
    if (!file) return;
    const next = parseAttachments(formData.attachments);
    const mapped = {
      id: file.id || file.driveFileId,
      driveFileId: file.driveFileId || file.id,
      name: file.name || file.originalName || 'File',
      originalName: file.originalName || file.name || 'File',
      driveWebViewLink: file.driveWebViewLink || '',
      mimeType: file.mimeType || ''
    };
    if (next.some((item) => String(item.driveFileId || item.id) === String(mapped.driveFileId || mapped.id))) return;
    set('attachments', [mapped, ...next]);
  }

  async function handleSubmit(event) {
    event?.preventDefault?.();
    if (!formData.title.trim()) {
      toast.error('Project title is required');
      return;
    }
    if (!formData.clientId) {
      toast.error('Please select a client');
      return;
    }

    setBusy(true);
    try {
      const payload = {
        clientId: formData.clientId || '',
        title: formData.title.trim(),
        projectType: formData.projectType.trim(),
        assignedTo: formData.assignedTo || '',
        status: formData.status || 'Not Started',
        billingType: formData.billingType || 'Fixed',
        progressPercent: Number(formData.progressPercent || 0),
        value: formData.value === '' ? 0 : Number(formData.value || 0),
        startDate: formData.startDate || '',
        deadline: formData.deadline || '',
        description: formData.description || '',
        notes: formData.notes || '',
        labels: Array.isArray(formData.labels) ? formData.labels : parseListValue(formData.labels),
        attachments: parseAttachments(formData.attachments),
        createdBy: initialData?.id ? undefined : user?.id || '',
        createdByName: initialData?.id ? undefined : (user?.fullName || user?.username || user?.email || 'System')
      };

      if (!payload.createdBy) delete payload.createdBy;
      if (!payload.createdByName) delete payload.createdByName;

      const response = initialData?.id
        ? await api.resources.update('/projects', initialData.id, payload, token)
        : await api.resources.create('/projects', payload, token);

      toast.success(initialData?.id ? 'Project updated' : 'Project created');
      onSuccess?.(response.data || payload);
      onClose?.();
    } catch (error) {
      toast.error(error.message || 'Failed to save project');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialData?.id ? 'Edit Project' : 'Add Project'}
      subtitle="Create a clean client project with the essential details."
      width="min(920px, 96vw)"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Close</Button>
          <Button type="submit" form="project-form" disabled={busy}>{busy ? 'Saving...' : 'Save Project'}</Button>
        </div>
      }
    >
      <form id="project-form" onSubmit={handleSubmit} className="flex flex-col">
        <FormRow label="Client" required>
          <SearchableSelect
            value={formData.clientId}
            onChange={(val) => set('clientId', val)}
            options={clientOptions}
            placeholder="Select client"
            searchPlaceholder="Search clients..."
          />
        </FormRow>
        <FormRow label="Project title" required>
          <Input value={formData.title} onChange={(e) => set('title', e.target.value)} placeholder="Project title" autoFocus />
        </FormRow>
        <FormRow label="Project type">
          <Input value={formData.projectType} onChange={(e) => set('projectType', e.target.value)} placeholder="Website, App, AMC..." />
        </FormRow>
        <FormRow label="Owner">
          <SearchableSelect
            value={formData.assignedTo}
            onChange={(val) => set('assignedTo', val)}
            options={userOptions}
            placeholder="Assign team member"
            searchPlaceholder="Search users..."
          />
        </FormRow>
        <FormRow label="Status">
          <SearchableSelect
            value={formData.status}
            onChange={(val) => set('status', val)}
            options={statusOptions}
            placeholder="Select status"
          />
        </FormRow>
        <FormRow label="Billing type">
          <SearchableSelect
            value={formData.billingType}
            onChange={(val) => set('billingType', val)}
            options={billingOptions}
            placeholder="Select billing type"
          />
        </FormRow>
        <FormRow label="Progress">
          <SearchableSelect
            value={formData.progressPercent}
            onChange={(val) => set('progressPercent', val)}
            options={progressOptions}
            placeholder="Select progress"
          />
        </FormRow>
        <FormRow label="Start date">
          <Input type="date" value={formData.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </FormRow>
        <FormRow label="Deadline">
          <Input type="date" value={formData.deadline} onChange={(e) => set('deadline', e.target.value)} />
        </FormRow>
        <FormRow label="Value">
          <Input type="number" min="0" step="0.01" value={formData.value} onChange={(e) => set('value', e.target.value)} placeholder="Project value" />
        </FormRow>
        <FormRow label="Labels">
          <SearchableSelect
            value={formData.labels}
            onChange={(val) => set('labels', val)}
            options={labelOptions}
            placeholder="Select labels"
            searchPlaceholder="Search labels..."
            multiple
          />
        </FormRow>
        <FormRow label="Description">
          <Textarea rows={4} value={formData.description} onChange={(e) => set('description', e.target.value)} placeholder="Project description" />
        </FormRow>
        <FormRow label="Notes">
          <Textarea rows={4} value={formData.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Internal notes" />
        </FormRow>
        <FormRow label="Attachments">
          <AttachmentPicker
            attachments={formData.attachments || []}
            uploadModule="projects"
            uploadEntityId={initialData?.id || formData.clientId || ''}
            onAddFile={appendAttachment}
            onRemoveFile={(driveFileId) => set('attachments', (formData.attachments || []).filter((item) => String(item.driveFileId || item.id) !== String(driveFileId)))}
          />
        </FormRow>

      </form>
    </Modal>
  );
}
