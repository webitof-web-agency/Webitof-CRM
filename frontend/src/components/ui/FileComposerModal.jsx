import { useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input, Textarea } from './Input';
import { SearchableSelect } from '../forms/SearchableSelect';
import { AttachmentPicker } from './AttachmentPicker';
import { normalizeSharedLabels, mergeSharedLabelOptions } from '../../lib/labels';

const EMPTY_FORM = {
  title: '',
  description: '',
  labels: [],
  attachments: []
};

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

  return [];
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

export function FileComposerModal({
  open,
  onClose,
  onSave,
  busy = false,
  initialData = null,
  settings = null,
  title = 'Add File',
  subtitle = 'Attach files and keep them tied to this record.',
  uploadModule = 'general',
  uploadEntityId = ''
}) {
  const [formData, setFormData] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!open) return;
    setFormData({
      title: initialData?.title || '',
      description: initialData?.description || '',
      labels: parseListValue(initialData?.labels || []),
      attachments: parseAttachments(initialData?.attachments || [])
    });
  }, [initialData, open]);

  const labelOptions = useMemo(() => {
    return mergeSharedLabelOptions(normalizeSharedLabels(settings?.labels || []), formData.labels);
  }, [formData.labels, settings]);

  function set(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event?.preventDefault?.();
    if (!formData.title.trim()) return;
    if (!formData.attachments.length) return;
    await onSave?.({
      title: formData.title.trim(),
      description: formData.description.trim(),
      labels: Array.isArray(formData.labels) ? formData.labels : [],
      attachments: parseAttachments(formData.attachments)
    });
  }

  if (!open) return null;

  const uploadFields = {
    title: formData.title.trim(),
    description: formData.description.trim(),
    labels: JSON.stringify(Array.isArray(formData.labels) ? formData.labels : [])
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      width="min(860px, 96vw)"
      footer={(
        <div className="flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Close</Button>
          <Button onClick={handleSubmit} disabled={busy || !formData.title.trim() || !formData.attachments.length}>
            {busy ? 'Saving...' : 'Save File'}
          </Button>
        </div>
      )}
    >
      <form onSubmit={handleSubmit} className="space-y-4 px-1">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-600">Title *</label>
          <Input value={formData.title} onChange={(e) => set('title', e.target.value)} placeholder="File title" autoFocus />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-600">Description</label>
          <Textarea value={formData.description} onChange={(e) => set('description', e.target.value)} placeholder="Short note about this file" rows={3} />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-600">Labels</label>
          <SearchableSelect
            value={formData.labels}
            onChange={(val) => set('labels', val)}
            options={labelOptions}
            placeholder="Select labels"
            searchPlaceholder="Search labels..."
            multiple
          />
        </div>

        <AttachmentPicker
          attachments={formData.attachments}
          uploadModule={uploadModule}
          uploadEntityId={uploadEntityId}
          uploadFields={uploadFields}
          onAddFile={(file) => {
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
          }}
          onRemoveFile={(driveFileId) => set('attachments', formData.attachments.filter((item) => String(item.driveFileId || item.id) !== String(driveFileId)))}
        />
      </form>
    </Modal>
  );
}
