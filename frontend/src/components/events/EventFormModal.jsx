import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { SearchableSelect } from '../forms/SearchableSelect';
import { AttachmentPicker } from '../ui/AttachmentPicker';
import { normalizeEventAttachment, normalizeEventAttachments } from './eventAttachments';
import { formatDateOnlyInput } from '../../lib/dateOnly';

const DEFAULT_COLORS = ['#84cc16', '#06b6d4', '#3b82f6', '#94a3b8', '#f59e0b', '#ef4444', '#db2777', '#8b5cf6'];

function normalizeArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return normalizeArray(parsed);
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function formatDateInput(value) {
  return formatDateOnlyInput(value);
}

function buildScopeOptions(scopeType, scopeOptions = {}) {
  if (scopeType === 'lead') return scopeOptions.leads || [];
  if (scopeType === 'client') return scopeOptions.clients || [];
  if (scopeType === 'project') return scopeOptions.projects || [];
  return [];
}

export function EventFormModal({
  open,
  title = 'Event',
  subtitle = '',
  onClose,
  onSave,
  busy = false,
  initialValue = null,
  labelOptions = [],
  userOptions = [],
  scopeLocked = false,
  defaultScopeType = 'global',
  defaultScopeId = '',
  scopeOptions = {},
  uploadModule = 'events',
  uploadEntityId = ''
}) {
  const [formData, setFormData] = useState(null);

  useEffect(() => {
    if (!open) return;
    const nextScopeType = scopeLocked ? defaultScopeType : String(initialValue?.scopeType || defaultScopeType || 'global').toLowerCase();
    const nextScopeId = scopeLocked ? defaultScopeId : String(initialValue?.scopeId || initialValue?.leadId || initialValue?.clientId || initialValue?.projectId || defaultScopeId || '').trim();
    const nextVisibility = String(initialValue?.visibility || 'all_team').toLowerCase();

    setFormData({
      title: initialValue?.title || '',
      description: initialValue?.description || '',
      startDate: formatDateInput(initialValue?.startDate),
      endDate: formatDateInput(initialValue?.endDate),
      startTime: initialValue?.startTime || '',
      endTime: initialValue?.endTime || '',
      location: initialValue?.location || '',
      labels: normalizeArray(initialValue?.labels),
      color: initialValue?.color || DEFAULT_COLORS[2],
      scopeType: nextScopeType,
      scopeId: nextScopeId,
      visibility: nextVisibility === 'onlyme' ? 'only_me' : nextVisibility === 'specific_members_and_teams' ? 'specific' : nextVisibility,
      allowedUserIds: normalizeArray(initialValue?.allowedUserIds),
      allowedTeamIds: normalizeArray(initialValue?.allowedTeamIds),
      attachments: normalizeEventAttachments(initialValue?.attachments)
    });
  }, [defaultScopeId, defaultScopeType, initialValue, open, scopeLocked]);

  const selectedScopeOptions = useMemo(() => buildScopeOptions(formData?.scopeType, scopeOptions), [formData?.scopeType, scopeOptions]);

  function set(field, value) {
    setFormData((current) => ({ ...(current || {}), [field]: value }));
  }

  async function handleSubmit(event) {
    event?.preventDefault?.();
    if (!formData?.title?.trim()) {
      toast.error('Event title is required');
      return;
    }
    if (formData.scopeType && formData.scopeType !== 'global' && !String(formData.scopeId || '').trim()) {
      toast.error('Select a linked record');
      return;
    }
    if (formData.visibility === 'specific' && !formData.allowedUserIds.length && !formData.allowedTeamIds.length) {
      toast.error('Select at least one member or team');
      return;
    }

    const payload = {
      ...formData,
      eventType: 'event',
      title: String(formData.title || '').trim(),
      description: String(formData.description || '').trim(),
      labels: normalizeArray(formData.labels),
      allowedUserIds: normalizeArray(formData.allowedUserIds),
      allowedTeamIds: normalizeArray(formData.allowedTeamIds),
      attachments: normalizeEventAttachments(formData.attachments),
      visibility: formData.visibility || 'all_team',
      scopeType: scopeLocked ? defaultScopeType : formData.scopeType || 'global',
      scopeId: scopeLocked ? defaultScopeId : formData.scopeId || '',
      leadId: (scopeLocked ? defaultScopeType : formData.scopeType) === 'lead' ? (scopeLocked ? defaultScopeId : formData.scopeId || '') : '',
      clientId: (scopeLocked ? defaultScopeType : formData.scopeType) === 'client' ? (scopeLocked ? defaultScopeId : formData.scopeId || '') : '',
      projectId: (scopeLocked ? defaultScopeType : formData.scopeType) === 'project' ? (scopeLocked ? defaultScopeId : formData.scopeId || '') : '',
      attachmentEntityId: uploadEntityId || ''
    };

    await onSave(payload);
  }

  function appendAttachment(file) {
    const selected = normalizeEventAttachment(file);
    if (!selected) return;
    setFormData((current) => {
      const currentAttachments = normalizeEventAttachments(current?.attachments);
      if (currentAttachments.some((item) => String(item.driveFileId || item.id) === String(selected.driveFileId || selected.id))) {
        return current;
      }
      return { ...(current || {}), attachments: [selected, ...currentAttachments] };
    });
  }

  if (!open || !formData) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      width="min(860px, 96vw)"
      footer={(
        <div className="flex justify-end gap-3">
          <Button variant="ghost" className="font-medium" onClick={onClose} disabled={busy}>Close</Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? 'Saving...' : 'Save'}
          </Button>
        </div>
      )}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input value={formData.title} onChange={(e) => set('title', e.target.value)} placeholder="Title" autoFocus />
        <Textarea value={formData.description} onChange={(e) => set('description', e.target.value)} placeholder="Description" rows={4} />

        {!scopeLocked ? (
          <div className="grid gap-4 md:grid-cols-2">
            <SearchableSelect
              value={formData.scopeType}
              onChange={(val) => {
                const nextScope = String(val || 'global').toLowerCase();
                set('scopeType', nextScope);
                set('scopeId', '');
              }}
              options={[
                { value: 'global', label: 'Global' },
                { value: 'lead', label: 'Lead' },
                { value: 'client', label: 'Client' },
                { value: 'project', label: 'Project' }
              ]}
              placeholder="Scope"
            />
            {formData.scopeType && formData.scopeType !== 'global' ? (
              <SearchableSelect
                value={formData.scopeId}
                onChange={(val) => set('scopeId', val)}
                options={selectedScopeOptions}
                placeholder="Linked record"
                searchPlaceholder="Search records..."
              />
            ) : (
              <div className="rounded-[var(--radius-input,0.75rem)] border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                This event is not linked to a specific record.
              </div>
            )}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Input type="date" value={formData.startDate} onChange={(e) => set('startDate', e.target.value)} />
            <Input type="time" value={formData.startTime} onChange={(e) => set('startTime', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Input type="date" value={formData.endDate} onChange={(e) => set('endDate', e.target.value)} />
            <Input type="time" value={formData.endTime} onChange={(e) => set('endTime', e.target.value)} />
          </div>
        </div>

        <Input value={formData.location} onChange={(e) => set('location', e.target.value)} placeholder="Location" />

        <SearchableSelect
          value={formData.labels}
          onChange={(val) => set('labels', val)}
          options={labelOptions}
          placeholder="Labels"
          searchPlaceholder="Search labels..."
          multiple
        />

        <AttachmentPicker
          attachments={Array.isArray(formData.attachments) ? formData.attachments : []}
          uploadModule={uploadModule}
          uploadEntityId={uploadEntityId}
          onAddFile={appendAttachment}
          onRemoveFile={(driveFileId) => set('attachments', normalizeEventAttachments(formData.attachments).filter((item) => String(item.driveFileId || item.id) !== String(driveFileId)))}
        />

        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Share with</div>
          <div className="flex flex-wrap items-center gap-6 pt-1">
            {[
              { value: 'only_me', label: 'Only me' },
              { value: 'all_team', label: 'All team members' },
              { value: 'specific', label: 'Specific members and teams' }
            ].map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2"
              >
                <input
                  type="radio"
                  name="event-visibility"
                  value={option.value}
                  checked={formData.visibility === option.value}
                  onChange={(e) => set('visibility', e.target.value)}
                  className="!appearance-auto"
                  style={{ accentColor: 'var(--primary)' }}
                />
                <span className="text-sm text-slate-700">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {formData.visibility === 'specific' ? (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Specific members</div>
            <SearchableSelect
              value={formData.allowedUserIds}
              onChange={(val) => set('allowedUserIds', val)}
              options={userOptions}
              placeholder="Select members"
              searchPlaceholder="Search members..."
              multiple
            />
            <div className="text-xs text-slate-500">
              Team groups are not modeled in this workspace, so member selection is enabled here.
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Color</div>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => set('color', color)}
                className={`h-6 w-6 rounded-full border-2 transition ${formData.color === color ? 'border-slate-300 ring-2 ring-offset-2' : 'border-white/70'}`}
                style={{ backgroundColor: color }}
                aria-label={`Select color ${color}`}
              />
            ))}
          </div>
        </div>

      </form>
    </Modal>
  );
}
