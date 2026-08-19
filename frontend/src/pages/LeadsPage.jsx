import { UserAvatar } from '../components/ui/UserAvatar';
import { useEffect, useState, useMemo, useRef } from 'react';
import { Plus, Pencil, Trash2, Search, List, LayoutGrid, Eye, Tag, ArrowLeft, GitBranch, Save, X, SlidersHorizontal, UserRoundCog, RefreshCw, CalendarClock, Download, Phone, Copy, Check, MoreVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Checkbox } from '../components/ui/Checkbox';
import { Button } from '../components/ui/Button';
import { DataTable } from '../components/ui/Table';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Modal } from '../components/ui/Modal';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { LeadFormModal } from '../components/forms/LeadFormModal';
import { SearchableSelect } from '../components/forms/SearchableSelect';
import { KanbanBoard } from '../components/ui/KanbanBoard';
import { LabelManagerModal } from '../components/labels/LabelManagerModal';
import { cn } from '../lib/cn';
import { normalizeSharedLabels } from '../lib/labels';
import { SlideOver } from '../components/ui/SlideOver';
import { ProfilePanel } from '../components/panels/ProfilePanel';
import { DEFAULT_LEAD_OPTIONS } from '../config/leadManagement';

function normalizeLabels(value) {
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
      return Array.isArray(parsed) ? normalizeLabels(parsed) : [];
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function renderLabelPill(label, color, compact = false) {
  const badgeColor = color || '#2563eb';
  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold ${compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-xs'
        }`}
      style={{
        backgroundColor: `${badgeColor}14`,
        borderColor: `${badgeColor}2A`,
        color: badgeColor
      }}
    >
      {label}
    </span>
  );
}

function LabelsCell({ labels = [], labelColors = {} }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const normalized = Array.isArray(labels)
    ? labels.map((l) => (typeof l === 'string' ? l : l?.label || l?.value || '')).filter(Boolean)
    : [];

  if (!normalized.length) {
    return <span className="text-sm text-[var(--text-muted)]">-</span>;
  }

  const firstLabel = normalized[0];
  const remainingCount = normalized.length - 1;
  const allLabelsTooltip = normalized.join(', ');

  return (
    <div
      className="relative inline-flex items-center gap-1.5"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      title={allLabelsTooltip}
    >
      {/* 1st Visible Label */}
      <span className="max-w-[130px] truncate">
        {renderLabelPill(firstLabel, labelColors[firstLabel])}
      </span>

      {/* +N Remaining Counter Badge */}
      {remainingCount > 0 && (
        <span className="inline-flex items-center justify-center rounded-full border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/10 px-1.5 py-0.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 backdrop-blur-md cursor-pointer hover:bg-black/10 dark:hover:bg-white/20 transition-all select-none">
          +{remainingCount}
        </span>
      )}

      {/* Floating VisionOS Glass Tooltip only on this cell hover */}
      {remainingCount > 0 && showTooltip && (
        <div className="animate-in fade-in zoom-in-95 duration-150 origin-bottom-left absolute bottom-full left-0 mb-2 z-50 p-2.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/80 dark:border-white/15 shadow-2xl shadow-black/10 dark:shadow-black/40 min-w-[180px] max-w-[300px] flex flex-wrap gap-1.5 items-center pointer-events-auto">
          <div className="w-full text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">
            All Labels ({normalized.length})
          </div>
          {normalized.map((label, idx) => (
            <span key={`${label}-${idx}`}>
              {renderLabelPill(label, labelColors[label])}
            </span>
          ))}
          {/* Tooltip pointer triangle */}
          <div className="absolute top-full left-4 -mt-[1px] border-4 border-transparent border-t-white/95 dark:border-t-slate-900/95" />
        </div>
      )}
    </div>
  );
}

function WhatsAppIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.118.553 4.106 1.517 5.832L0 24l6.336-1.476C8.016 23.473 9.957 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.871 0-3.645-.51-5.176-1.4l-.371-.215-3.774.88.895-3.682-.239-.379C2.417 15.659 1.888 13.882 1.888 12c0-5.576 4.536-10.112 10.112-10.112 5.576 0 10.112 4.536 10.112 10.112S17.576 22 12 22z"/>
    </svg>
  );
}

function RowActionsDropdown({ row, navigate, canCreate, canDelete, setEditingData, setFormOpen, setDeleteTarget }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <div
      ref={menuRef}
      className="relative inline-block text-left"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="inline-flex items-center justify-center h-8 w-8 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none"
        title="Actions"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-36 rounded-xl bg-[var(--surface)] p-1.5 shadow-modal border border-[var(--border)] z-50 text-left animate-in fade-in zoom-in-95 duration-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              navigate(`/app/leads/${row.id}`);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--hover-bg)] transition-colors cursor-pointer"
          >
            <Eye className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            View
          </button>

          {canCreate && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                setEditingData(row);
                setFormOpen(true);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--hover-bg)] transition-colors cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              Edit
            </button>
          )}

          {canDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                setDeleteTarget(row);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-500" />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function normalizeLabelOptions(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      if (typeof item === 'string') {
        return { label: item, color: '#64748b' };
      }
      if (item && typeof item === 'object') {
        return {
          label: item.label || item.value || '',
          color: item.color || '#64748b'
        };
      }
      return null;
    })
    .filter((item) => item && item.label);
}

function formatPhoneDisplay(value) {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  if (raw.startsWith('+')) return raw;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return raw;
  return `+${digits}`;
}

function formatFollowUpDateDisplay(dateStr, timeStr) {
  if (!dateStr) return { shortText: '-', fullText: '-' };
  const parts = String(dateStr).split('T')[0].split('-');
  if (parts.length < 3) {
    const fallback = `${dateStr}${timeStr ? ` ${timeStr}` : ''}`;
    return { shortText: fallback, fullText: fallback };
  }

  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  if (isNaN(year) || isNaN(monthIdx) || isNaN(day) || monthIdx < 0 || monthIdx > 11) {
    const fallback = `${dateStr}${timeStr ? ` ${timeStr}` : ''}`;
    return { shortText: fallback, fullText: fallback };
  }

  const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fullMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const shortMonth = shortMonths[monthIdx];
  const fullMonth = fullMonths[monthIdx];

  let timeFormatted = '';
  if (timeStr) {
    const timeParts = String(timeStr).split(':');
    if (timeParts.length >= 2) {
      let hr = parseInt(timeParts[0], 10);
      const min = String(timeParts[1]).padStart(2, '0').slice(0, 2);
      if (!isNaN(hr)) {
        const ampm = hr >= 12 ? 'PM' : 'AM';
        hr = hr % 12 || 12;
        const hrStr = String(hr).padStart(2, '0');
        timeFormatted = ` ${hrStr}:${min} ${ampm}`;
      } else {
        timeFormatted = ` ${timeStr}`;
      }
    } else {
      timeFormatted = ` ${timeStr}`;
    }
  }

  return {
    shortText: `${day} ${shortMonth}${timeFormatted}`,
    fullText: `${day} ${fullMonth} ${year}${timeFormatted}`
  };
}

function formatCreatedAtDisplay(dateStr) {
  if (!dateStr) return { shortText: '-', fullText: '-' };
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return { shortText: String(dateStr), fullText: String(dateStr) };

  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fullMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const month = months[d.getMonth()];
  const fullMonth = fullMonths[d.getMonth()];
  const year = d.getFullYear();

  let hr = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  const ampm = hr >= 12 ? 'PM' : 'AM';
  hr = hr % 12 || 12;
  const hrStr = String(hr).padStart(2, '0');

  return {
    shortText: `${day} ${month} ${hrStr}:${min} ${ampm}`,
    fullText: `${day} ${fullMonth} ${year} ${hrStr}:${min}:${sec} ${ampm}`
  };
}

function formatLeadAmount(value, currency = 'INR') {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '-';
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency || 'INR'} ${amount.toLocaleString('en-IN')}`;
  }
}

function formatCsvCell(value) {
  const normalized = Array.isArray(value)
    ? value.join(', ')
    : value && typeof value === 'object'
      ? JSON.stringify(value)
      : String(value ?? '');
  const formulaSafe = /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
  return `"${formulaSafe.replace(/"/g, '""')}"`;
}

const EMPTY_PIPELINE_FORM = {
  name: '',
  description: '',
  color: '#2563eb',
  sortOrder: 0,
  isActive: true
};

const EMPTY_BULK_FORM = {
  assignedTo: '',
  status: '',
  statusNote: '',
  lostReason: '',
  lostReasonNotes: '',
  reconnectInFuture: false,
  reconnectDate: '',
  followUpDate: '',
  nextFollowUpTime: '',
  followUpMode: '',
  reminder: 'No Reminder',
  followUpNote: '',
  followUpPriority: 'Medium'
};

function BulkLeadActionModal({ open, action, count, users, statuses, options, busy, onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY_BULK_FORM);

  useEffect(() => {
    if (open) setForm(EMPTY_BULK_FORM);
  }, [open, action]);

  if (!open) return null;

  const isLost = ['Lost', 'Not Interested'].includes(form.status);
  const title = action === 'assign' ? 'Bulk assign leads' : action === 'status' ? 'Bulk status update' : 'Schedule bulk follow-up';

  function submit(event) {
    event.preventDefault();
    onSubmit(form);
  }

  return (
    <Modal
      open={open}
      title={title}
      subtitle={`${count} selected lead${count === 1 ? '' : 's'}`}
      onClose={onClose}
      width="min(620px, 96vw)"
      footer={(
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="bulk-lead-action-form" disabled={busy}>
            {busy ? 'Updating...' : 'Apply to selected'}
          </Button>
        </div>
      )}
    >
      <form id="bulk-lead-action-form" onSubmit={submit} className="space-y-4">
        {action === 'assign' ? (
          <label className="block space-y-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            <span>Assign to</span>
            <SearchableSelect
              value={form.assignedTo}
              onChange={(value) => setForm((current) => ({ ...current, assignedTo: value }))}
              options={users.map((user) => ({ value: user.id, label: user.fullName || user.username || user.email || user.id }))}
              placeholder="Select active employee"
            />
          </label>
        ) : null}

        {action === 'status' ? (
          <>
            <label className="block space-y-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              <span>Status</span>
              <SearchableSelect
                value={form.status}
                onChange={(value) => setForm((current) => ({ ...current, status: value, lostReason: '', lostReasonNotes: '', reconnectInFuture: false, reconnectDate: '' }))}
                options={statuses.map((status) => ({ value: status, label: status }))}
                placeholder="Select status"
              />
            </label>
            <label className="block space-y-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              <span>Status note</span>
              <Input value={form.statusNote} onChange={(event) => setForm((current) => ({ ...current, statusNote: event.target.value }))} placeholder="Optional note" />
            </label>
            {isLost ? (
              <>
                <label className="block space-y-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  <span>Lost reason</span>
                  <SearchableSelect
                    value={form.lostReason}
                    onChange={(value) => setForm((current) => ({ ...current, lostReason: value }))}
                    options={(options.lostReasons || []).map((reason) => ({ value: reason, label: reason }))}
                    placeholder="Select reason"
                  />
                </label>
                <label className="block space-y-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  <span>Reason notes</span>
                  <Input value={form.lostReasonNotes} onChange={(event) => setForm((current) => ({ ...current, lostReasonNotes: event.target.value }))} placeholder="Required when reason is Other" />
                </label>
                <label className="inline-flex items-center gap-2.5 text-xs font-semibold text-[var(--text-main)] cursor-pointer select-none">
                  <Checkbox checked={form.reconnectInFuture} onChange={(event) => setForm((current) => ({ ...current, reconnectInFuture: event.target.checked, reconnectDate: event.target.checked ? current.reconnectDate : '' }))} />
                  Reconnect in future
                </label>
                {form.reconnectInFuture ? (
                  <label className="block space-y-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    <span>Reconnect date</span>
                    <Input type="date" value={form.reconnectDate} onChange={(event) => setForm((current) => ({ ...current, reconnectDate: event.target.value }))} />
                  </label>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}

        {action === 'follow_up' ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <span>Follow-up date</span>
                <Input type="date" value={form.followUpDate} onChange={(event) => setForm((current) => ({ ...current, followUpDate: event.target.value }))} />
              </label>
              <label className="block space-y-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <span>Time</span>
                <Input type="time" value={form.nextFollowUpTime} onChange={(event) => setForm((current) => ({ ...current, nextFollowUpTime: event.target.value }))} />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <span>Mode</span>
                <SearchableSelect value={form.followUpMode} onChange={(value) => setForm((current) => ({ ...current, followUpMode: value }))} options={(options.followUpModes || []).map((item) => ({ value: item, label: item }))} placeholder="Select mode" />
              </label>
              <label className="block space-y-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <span>Reminder</span>
                <SearchableSelect value={form.reminder} onChange={(value) => setForm((current) => ({ ...current, reminder: value }))} options={(options.reminders || []).map((item) => ({ value: item, label: item }))} placeholder="Select reminder" />
              </label>
            </div>
            <label className="block space-y-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              <span>Follow-up note</span>
              <Input value={form.followUpNote} onChange={(event) => setForm((current) => ({ ...current, followUpNote: event.target.value }))} placeholder="Optional note" />
            </label>
          </>
        ) : null}
      </form>
    </Modal>
  );
}

function PipelineManagerModal({ open, onClose, pipelines = [], token, onSaved }) {
  const [draft, setDraft] = useState(EMPTY_PIPELINE_FORM);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    if (!open) {
      setDraft(EMPTY_PIPELINE_FORM);
      setEditingId(null);
      setDeleteTarget(null);
    }
  }, [open]);

  function editPipeline(pipeline) {
    setEditingId(pipeline.id);
    setDraft({
      name: pipeline.name || '',
      description: pipeline.description || '',
      color: pipeline.color || '#2563eb',
      sortOrder: Number(pipeline.sortOrder || 0),
      isActive: pipeline.isActive !== false
    });
  }

  function resetForm() {
    setEditingId(null);
    setDraft(EMPTY_PIPELINE_FORM);
  }

  async function savePipeline(event) {
    event.preventDefault();
    if (!draft.name.trim()) {
      toast.error('Pipeline name is required');
      return;
    }

    setBusy(true);
    try {
      if (editingId) {
        await api.resources.update('/lead-pipelines', editingId, draft, token);
        toast.success('Pipeline updated');
      } else {
        await api.resources.create('/lead-pipelines', draft, token);
        toast.success('Pipeline created');
      }
      resetForm();
      onSaved?.();
    } catch (error) {
      toast.error(error.message || 'Unable to save pipeline');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeletePipeline() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.resources.remove('/lead-pipelines', deleteTarget.id, token);
      toast.success('Pipeline removed');
      setDeleteTarget(null);
      resetForm();
      onSaved?.();
    } catch (error) {
      toast.error(error.message || 'Unable to remove pipeline');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="Lead Pipelines" subtitle="Create pipeline buckets and assign users to only the pipelines they should see." width="min(980px, 96vw)">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-3">
            {pipelines.map((pipeline) => (
              <div key={pipeline.id} className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-2xs">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: pipeline.color || '#64748b' }} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-xs font-bold text-[var(--text-main)]">{pipeline.name}</p>
                    {pipeline.isActive === false ? (
                      <span className="rounded-full bg-[var(--surface-2)] border border-[var(--border)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--text-muted)]">Inactive</span>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-[var(--text-muted)]">{pipeline.description || pipeline.code || 'No description'}</p>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => editPipeline(pipeline)} title="Edit pipeline" className="h-8 w-8">
                  <Pencil size={14} />
                </Button>
                {pipeline.id !== 'pipe-default' ? (
                  <Button type="button" variant="ghost" size="icon" onClick={() => setDeleteTarget(pipeline)} title="Delete pipeline" className="h-8 w-8 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600">
                    <Trash2 size={14} />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>

          <form onSubmit={savePipeline} className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/40 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[var(--text-main)]">{editingId ? 'Edit pipeline' : 'New pipeline'}</h3>
              {editingId ? (
                <Button type="button" variant="ghost" size="icon" onClick={resetForm} title="Cancel edit" className="h-7 w-7">
                  <X size={14} />
                </Button>
              ) : null}
            </div>
            <Input value={draft.name} onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))} placeholder="Pipeline name" />
            <Input value={draft.description} onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} placeholder="Description" />
            <div className="grid grid-cols-[1fr_96px] gap-3">
              <Input type="color" value={draft.color} onChange={(event) => setDraft((prev) => ({ ...prev, color: event.target.value }))} title="Pipeline color" />
              <Input type="number" value={draft.sortOrder} onChange={(event) => setDraft((prev) => ({ ...prev, sortOrder: Number(event.target.value || 0) }))} placeholder="Sort" />
            </div>
            <label className="inline-flex items-center gap-2.5 text-xs font-semibold text-[var(--text-main)] cursor-pointer select-none">
              <Checkbox
                checked={draft.isActive}
                onChange={(event) => setDraft((prev) => ({ ...prev, isActive: event.target.checked }))}
              />
              Active
            </label>
            <Button type="submit" disabled={busy} className="w-full">
              <Save size={14} className="mr-1.5" />
              {busy ? 'Saving...' : editingId ? 'Update Pipeline' : 'Create Pipeline'}
            </Button>
          </form>
        </div>
      </Modal>
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete pipeline"
        description={`Delete ${deleteTarget?.name}? Pipelines with existing leads will be disabled instead of removed.`}
        confirmText="Delete"
        type="danger"
        isLoading={busy}
        onConfirm={confirmDeletePipeline}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

export function LeadsPage() {
  const { token, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [leadContacts, setLeadContacts] = useState([]);
  const [users, setUsers] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState('updatedAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [pipelineFilter, setPipelineFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [temperatureFilter, setTemperatureFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');
  const [overdueFilter, setOverdueFilter] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [viewType, setViewType] = useState('table');

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (sourceFilter) count++;
    if (serviceFilter) count++;
    if (temperatureFilter) count++;
    if (priorityFilter) count++;
    if (assignedFilter) count++;
    if (dateFilter) count++;
    if (overdueFilter) count++;
    return count;
  }, [sourceFilter, serviceFilter, temperatureFilter, priorityFilter, assignedFilter, dateFilter, overdueFilter]);

  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [allStatuses, setAllStatuses] = useState([]);
  const [leadOptions, setLeadOptions] = useState(DEFAULT_LEAD_OPTIONS);
  const [statusColors, setStatusColors] = useState({});
  const [labelColors, setLabelColors] = useState({});
  const [formOpen, setFormOpen] = useState(false);
  const [editingData, setEditingData] = useState(null);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [pipelinesOpen, setPipelinesOpen] = useState(false);
  const [panelData, setPanelData] = useState(null);
  const [panelType, setPanelType] = useState(null);
  const [panelLeadData, setPanelLeadData] = useState(null);
  const [copiedPhoneId, setCopiedPhoneId] = useState(null);

  const canCreate = hasPermission('leads.manage') || hasPermission('leads.write');
  const canDelete = hasPermission('leads.manage') || hasPermission('leads.delete');
  const canBulkAssign = hasPermission('leads.manage') || hasPermission('leads.assign') || hasPermission('leads.write');
  const canBulkStatus = hasPermission('leads.manage') || hasPermission('leads.write');
  const canBulkFollowUp = hasPermission('leads.manage') || hasPermission('leads.manage_followup') || hasPermission('leads.write');
  const canBulkExport = hasPermission('leads.manage') || hasPermission('leads.export');
  const canSelectLeads = canBulkAssign || canBulkStatus || canBulkFollowUp || canBulkExport;
  const canManagePipelines = hasPermission('users.manage');

  const bulkStatuses = useMemo(() => Array.from(new Set([
    ...(allStatuses || []).map((item) => typeof item === 'string' ? item : item?.label || item?.value || ''),
    ...(leadOptions.statuses || []),
    ...rows.map((row) => row.status || '')
  ].filter(Boolean))), [allStatuses, leadOptions.statuses, rows]);

  const primaryContactsByLeadId = useMemo(() => {
    const grouped = new Map();
    [...leadContacts]
      .sort((a, b) => {
        const aTime = new Date(a.createdAt || a.updatedAt || 0).getTime();
        const bTime = new Date(b.createdAt || b.updatedAt || 0).getTime();
        if (aTime !== bTime) return aTime - bTime;
        return String(a.id || '').localeCompare(String(b.id || ''));
      })
      .forEach((contact) => {
        if (!grouped.has(String(contact.leadId))) {
          grouped.set(String(contact.leadId), contact);
        }
      });
    return grouped;
  }, [leadContacts]);

  const userNameById = useMemo(() => new Map(users.map((user) => [String(user.id), user.fullName || user.username || user.email || user.id])), [users]);
  const pipelineById = useMemo(() => new Map(pipelines.map((pipeline) => [String(pipeline.id), pipeline])), [pipelines]);

  const columns = useMemo(() => [
    {
      key: 'name', label: 'Lead', render: (row) => (
        <div className="min-w-36">
          <div className="font-medium text-[var(--text-main)]">{row.contactPerson || row.name}</div>
          {row.companyName && row.companyName !== row.contactPerson ? <div className="mt-0.5 text-xs text-slate-500">{row.companyName}</div> : null}
        </div>
      )
    },
    {
      key: 'contact', label: 'Contact', render: (row) => {
        const primaryContact = primaryContactsByLeadId.get(String(row.id));
        const contactName = primaryContact ? `${primaryContact.firstName || ''} ${primaryContact.lastName || ''}`.trim() : (row.contactPerson || row.name || '');
        const rawPhone = primaryContact?.phone || row.phone || '';
        const phone = formatPhoneDisplay(rawPhone);
        const dpTooltip = contactName ? (phone && phone !== '-' ? `${contactName} (${phone})` : contactName) : (phone && phone !== '-' ? phone : 'Primary contact');
        const phoneTooltip = phone && phone !== '-' ? phone : 'No phone number';
        const cleanDigits = String(rawPhone || '').replace(/\D/g, '');

        const handleCopy = (e) => {
          e.stopPropagation();
          if (!rawPhone || rawPhone === '-') {
            toast.error('No phone number available');
            return;
          }
          const numToCopy = rawPhone || phone;
          navigator.clipboard.writeText(numToCopy);
          toast.success(`Copied: ${numToCopy}`);
          setCopiedPhoneId(row.id);
          setTimeout(() => setCopiedPhoneId(null), 2000);
        };

        return (
          <div className="flex items-center gap-1.5">
            {/* Primary contact DP */}
            <div
              className="cursor-pointer group relative"
              title={dpTooltip}
              onClick={(e) => {
                e.stopPropagation();
                if (primaryContact) {
                  setPanelData(primaryContact);
                  setPanelType('contact');
                  setPanelLeadData(row);
                }
              }}
            >
              <UserAvatar name={contactName || 'Lead'} className="h-8 w-8 transition-transform group-hover:scale-105" fallbackSize={14} />
            </div>

            {/* Call Icon */}
            {rawPhone && rawPhone !== '-' ? (
              <a
                href={`tel:${rawPhone}`}
                onClick={(e) => e.stopPropagation()}
                title={phoneTooltip}
                className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <Phone className="h-3.5 w-3.5" />
              </a>
            ) : (
              <span title={phoneTooltip} className="inline-flex items-center justify-center h-7 w-7 text-slate-300 cursor-not-allowed">
                <Phone className="h-3.5 w-3.5" />
              </span>
            )}

            {/* WhatsApp Icon */}
            {cleanDigits ? (
              <a
                href={`https://wa.me/${cleanDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title={phoneTooltip}
                className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
              >
                <WhatsAppIcon className="h-3.5 w-3.5" />
              </a>
            ) : (
              <span title={phoneTooltip} className="inline-flex items-center justify-center h-7 w-7 text-slate-300 cursor-not-allowed">
                <WhatsAppIcon className="h-3.5 w-3.5" />
              </span>
            )}

            {/* Copy Number Icon */}
            <button
              type="button"
              onClick={handleCopy}
              title={phoneTooltip}
              className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              {copiedPhoneId === row.id ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        );
      }
    },
    {
      key: 'requiredServices', label: 'Service', render: (row) => {
        const services = normalizeLabels(row.requiredServices);
        if (!services.length) return <span className="text-sm text-[var(--text-muted)]">-</span>;
        const allServicesText = services.join(', ');
        return (
          <div className="flex items-center gap-1.5 cursor-help" title={allServicesText}>
            <span className="max-w-36 truncate text-sm font-medium text-slate-700">{services[0]}</span>
            {services.length > 1 && (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                +{services.length - 1}
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: 'estimatedBudget', label: 'Budget', render: (row) => <span className="whitespace-nowrap text-sm font-medium text-slate-700">{formatLeadAmount(row.estimatedBudget ?? row.value, row.currency)}</span>
    },
    {
      key: 'status', label: 'Status', render: (row) => {
        const color = statusColors[row.status] || '#64748b'; // default slate
        return (
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border"
            style={{ backgroundColor: `${color}1A`, color: color, borderColor: `${color}33` }}
          >
            {row.status}
          </span>
        );
      }
    },
    {
      key: 'followUpDate', label: 'Follow-up', render: (row) => {
        if (!row.followUpDate) return <span className="text-xs text-[var(--text-muted)]">-</span>;
        const { shortText, fullText } = formatFollowUpDateDisplay(row.followUpDate, row.nextFollowUpTime);
        const overdue = row.followUpDate < new Date().toISOString().slice(0, 10) && !['Won', 'Lost', 'Not Interested'].includes(row.status);
        return (
          <span
            title={fullText}
            className={`whitespace-nowrap text-xs font-medium cursor-help ${overdue ? 'text-rose-500 font-semibold' : 'text-slate-500'}`}
          >
            {shortText}
          </span>
        );
      }
    },
    {
      key: 'labels', label: 'Labels', render: (row) => (
        <LabelsCell labels={row.labels} labelColors={labelColors} />
      )
    },
    { key: 'source', label: 'Source', render: (row) => <span className="text-sm text-slate-600">{row.source || '-'}</span> },
    {
      key: 'pipelineId', label: 'Pipeline', render: (row) => {
        const pipeline = pipelineById.get(String(row.pipelineId));
        const color = pipeline?.color || '#64748b';
        return (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap"
            style={{ backgroundColor: `${color}14`, borderColor: `${color}30`, color }}
          >
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
            {pipeline?.name || 'Default Pipeline'}
          </span>
        );
      }
    },
    {
      key: 'createdAt', label: 'Created At', render: (row) => {
        if (!row.createdAt) return <span className="text-sm text-[var(--text-muted)]">-</span>;
        const { shortText, fullText } = formatCreatedAtDisplay(row.createdAt);
        return (
          <span className="text-xs text-slate-500 font-medium whitespace-nowrap cursor-help" title={fullText}>
            {shortText}
          </span>
        );
      }
    }
  ], [labelColors, statusColors, primaryContactsByLeadId, userNameById, pipelineById, copiedPhoneId]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const [res, settingsRes, optionsRes] = await Promise.allSettled([
          api.resources.list('/leads', token, debouncedSearch, {
            pipelineId: pipelineFilter,
            status: statusFilter,
            source: sourceFilter,
            requiredService: serviceFilter,
            leadTemperature: temperatureFilter,
            priority: priorityFilter,
            assignedTo: assignedFilter,
            overdue: overdueFilter ? 'true' : ''
          }),
          api.settings.get(token),
          api.resources.list('/leads/options', token)
        ]);

        if (active && res.status === 'fulfilled') {
          setRows(res.value.data || []);
        } else if (active && res.status === 'rejected') {
          toast.error(res.reason?.message || 'Failed to load leads');
        }

        if (active && settingsRes.status === 'fulfilled') {
          const s = settingsRes.value.data;

          if (s?.statuses?.leads) {
            setAllStatuses(s.statuses.leads);
            const smap = {};
            s.statuses.leads.forEach(x => { smap[x.label] = x.color; });
            setStatusColors(smap);
          }

          if (s?.labels) {
            const lmap = {};
            normalizeSharedLabels(s.labels).forEach((item) => {
              lmap[item.label] = item.color;
            });
            setLabelColors(lmap);
          }
        }

        const [contactsRes, usersRes, pipelinesRes] = await Promise.allSettled([
          api.resources.list('/lead-contacts', token),
          api.resources.list('/users/lookup', token),
          api.resources.list('/lead-pipelines', token)
        ]);
        if (active && contactsRes.status === 'fulfilled') {
          setLeadContacts(contactsRes.value.data || []);
        }
        if (active && usersRes.status === 'fulfilled') {
          setUsers(usersRes.value.data || []);
        }

        if (active && optionsRes.status === 'fulfilled') {
          setLeadOptions((current) => ({ ...current, ...(optionsRes.value.data || {}) }));
        }
        if (active && pipelinesRes.status === 'fulfilled') {
          const nextPipelines = pipelinesRes.value.data || [];
          setPipelines(nextPipelines);
          if (pipelineFilter && !nextPipelines.some((pipeline) => String(pipeline.id) === String(pipelineFilter))) {
            setPipelineFilter('');
          }
        }
      } catch (error) {
        if (active) toast.error('Failed to load data');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [token, debouncedSearch, pipelineFilter, statusFilter, sourceFilter, serviceFilter, temperatureFilter, priorityFilter, assignedFilter, overdueFilter, reloadTick]);

  const sortedRows = useMemo(() => {
    let filtered = [...rows];

    if (statusFilter) {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    if (pipelineFilter) {
      filtered = filtered.filter(r => String(r.pipelineId || '') === String(pipelineFilter));
    }

    if (dateFilter) {
      filtered = filtered.filter(r => r.createdAt?.startsWith(dateFilter) || r.followUpDate?.startsWith(dateFilter));
    }

    return filtered.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const aNum = Number(aVal ?? 0);
      const bNum = Number(bVal ?? 0);
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    });
  }, [rows, sortKey, sortDirection, statusFilter, pipelineFilter, dateFilter]);

  const kanbanLeads = useMemo(() => sortedRows.map((row) => {
    const primaryContact = primaryContactsByLeadId.get(String(row.id));
    return {
      ...row,
      primaryContactName: primaryContact ? `${primaryContact.firstName || ''} ${primaryContact.lastName || ''}`.trim() : '',
      primaryContactPhone: primaryContact?.phone || '',
      ownerPhone: row.phone || '',
      contactCount: primaryContact ? 1 : 0
    };
  }), [sortedRows, primaryContactsByLeadId]);

  async function handleStatusChange(leadId, newStatus) {
    const leadToUpdate = rows.find(r => r.id === leadId);
    if (!leadToUpdate || leadToUpdate.status === newStatus) return;

    setRows(curr => curr.map(r => r.id === leadId ? { ...r, status: newStatus } : r));

    try {
      await api.resources.update('/leads', leadId, { status: newStatus }, token);
      toast.success('Lead status updated');
    } catch (error) {
      setRows(curr => curr.map(r => r.id === leadId ? { ...r, status: leadToUpdate.status } : r));
      toast.error(error.message || 'Failed to update status');
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.resources.remove('/leads', deleteTarget.id, token);
      toast.success('Lead deleted');
      setRows(curr => curr.filter(item => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error.message || 'Failed to delete lead');
    } finally {
      setDeleting(false);
    }
  }

  async function applyBulkAction(form) {
    if (!selectedIds.length || !bulkAction) return;
    if (bulkAction === 'assign' && !form.assignedTo) {
      toast.error('Select an employee');
      return;
    }
    if (bulkAction === 'status' && !form.status) {
      toast.error('Select a status');
      return;
    }
    if (bulkAction === 'status' && ['Lost', 'Not Interested'].includes(form.status) && !form.lostReason) {
      toast.error('Select a lost reason');
      return;
    }
    if (bulkAction === 'status' && form.lostReason === 'Other' && !form.lostReasonNotes.trim()) {
      toast.error('Enter lost reason notes');
      return;
    }
    if (bulkAction === 'status' && form.reconnectInFuture && !form.reconnectDate) {
      toast.error('Select a reconnect date');
      return;
    }
    if (bulkAction === 'follow_up' && !form.followUpDate) {
      toast.error('Select a follow-up date');
      return;
    }

    setBulkBusy(true);
    try {
      const response = await api.resources.create('/leads/bulk', { ids: selectedIds, action: bulkAction, ...form }, token);
      toast.success(`${response.count || selectedIds.length} leads updated`);
      setSelectedIds([]);
      setBulkAction('');
      setReloadTick((current) => current + 1);
    } catch (error) {
      toast.error(error.message || 'Bulk update failed');
    } finally {
      setBulkBusy(false);
    }
  }

  function exportSelectedLeads() {
    const selected = rows.filter((row) => selectedIds.includes(row.id));
    if (!selected.length) {
      toast.error('Select at least one lead');
      return;
    }
    const fields = [
      ['Lead ID', 'leadNumber'], ['Contact', 'contactPerson'], ['Company', 'companyName'], ['Phone', 'phone'],
      ['Email', 'email'], ['Services', 'requiredServices'], ['Source', 'source'], ['Status', 'status'],
      ['Temperature', 'leadTemperature'], ['Priority', 'priority'], ['Budget', 'estimatedBudget'],
      ['Assigned To', 'assignedTo'], ['Follow-up Date', 'followUpDate'], ['Created At', 'createdAt']
    ];
    const csv = [
      fields.map(([label]) => formatCsvCell(label)).join(','),
      ...selected.map((row) => fields.map(([, key]) => formatCsvCell(row[key])).join(','))
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success(`${selected.length} leads exported`);
  }

  if (panelData) {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)] animate-in fade-in duration-200">
        <div className="flex items-center gap-3 px-1 pb-4 shrink-0">
          <button
            type="button"
            onClick={() => { setPanelData(null); setPanelLeadData(null); }}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-[var(--primary)] transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Leads
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-medium text-slate-700">
            {panelType === 'owner' ? 'Owner Profile' : 'Contact Profile'}
          </span>
        </div>
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <ProfilePanel
            data={panelData}
            type={panelType}
            leadData={panelLeadData}
            onClose={() => { setPanelData(null); setPanelLeadData(null); }}
            onSaved={() => setReloadTick(c => c + 1)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">Leads</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{rows.length} total leads</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant={filtersOpen || activeFiltersCount > 0 ? "secondary" : "outline"}
            onClick={() => setFiltersOpen((value) => !value)}
            title="Lead filters"
            className={cn("!rounded-xl font-semibold relative", (filtersOpen || activeFiltersCount > 0) && "text-[var(--primary)] border-[var(--primary)]/30")}
          >
            <SlidersHorizontal size={15} className="mr-1.5" />
            Filters
            {activeFiltersCount > 0 && (
              <span className="ml-1.5 rounded-full bg-[var(--primary)] text-white px-1.5 py-0.2 text-[10px] font-extrabold leading-none">
                {activeFiltersCount}
              </span>
            )}
          </Button>

          <div className="flex bg-[var(--surface-2)] p-1 border border-[var(--border)] h-10 rounded-xl">
            <button
              type="button"
              onClick={() => setViewType('table')}
              className={cn(
                'h-full px-3 transition-all flex items-center justify-center rounded-lg cursor-pointer',
                viewType === 'table'
                  ? 'bg-[var(--surface)] text-[var(--primary)] font-bold shadow-2xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              )}
              title="Table view"
            >
              <List size={16} />
            </button>
            <button
              type="button"
              onClick={() => setViewType('kanban')}
              className={cn(
                'h-full px-3 transition-all flex items-center justify-center rounded-lg cursor-pointer',
                viewType === 'kanban'
                  ? 'bg-[var(--surface)] text-[var(--primary)] font-bold shadow-2xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              )}
              title="Kanban view"
            >
              <LayoutGrid size={16} />
            </button>
          </div>

          {canCreate && (
            <Button type="button" variant="outline" onClick={() => setLabelsOpen(true)} className="!rounded-xl font-semibold">
              <Tag size={15} className="mr-1.5" /> Manage labels
            </Button>
          )}
          {canManagePipelines && (
            <Button type="button" variant="outline" onClick={() => setPipelinesOpen(true)} className="!rounded-xl font-semibold">
              <GitBranch size={15} className="mr-1.5" /> Pipelines
            </Button>
          )}
          {canCreate && (
            <Button type="button" onClick={() => { setEditingData(null); setFormOpen(true); }} className="!rounded-xl font-semibold shadow-2xs">
              <Plus size={15} className="mr-1.5" /> New Lead
            </Button>
          )}
        </div>
      </div>

      {filtersOpen ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs space-y-4 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={14} className="text-[var(--primary)]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">Filter Leads</span>
              {activeFiltersCount > 0 && (
                <span className="rounded-full bg-[var(--primary-subtle)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--primary)]">
                  {activeFiltersCount} active
                </span>
              )}
            </div>
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSourceFilter('');
                  setServiceFilter('');
                  setTemperatureFilter('');
                  setPriorityFilter('');
                  setAssignedFilter('');
                  setDateFilter('');
                  setOverdueFilter(false);
                  setPage(1);
                }}
                className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-rose-500 transition-colors cursor-pointer"
              >
                <X size={14} /> Clear filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Source</label>
              <SearchableSelect
                value={sourceFilter}
                onChange={(value) => { setSourceFilter(value); setPage(1); }}
                options={[{ value: '', label: 'All sources' }, ...(leadOptions.sources || []).map((item) => ({ value: item, label: item }))]}
                placeholder="All sources"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Service</label>
              <SearchableSelect
                value={serviceFilter}
                onChange={(value) => { setServiceFilter(value); setPage(1); }}
                options={[{ value: '', label: 'All services' }, ...(leadOptions.services || []).map((item) => ({ value: item, label: item }))]}
                placeholder="All services"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Temperature</label>
              <SearchableSelect
                value={temperatureFilter}
                onChange={(value) => { setTemperatureFilter(value); setPage(1); }}
                options={[{ value: '', label: 'All temperatures' }, ...(leadOptions.temperatures || []).map((item) => ({ value: item, label: item }))]}
                placeholder="All temperatures"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Priority</label>
              <SearchableSelect
                value={priorityFilter}
                onChange={(value) => { setPriorityFilter(value); setPage(1); }}
                options={[{ value: '', label: 'All priorities' }, ...(leadOptions.priorities || []).map((item) => ({ value: item, label: item }))]}
                placeholder="All priorities"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Assigned To</label>
              <SearchableSelect
                value={assignedFilter}
                onChange={(value) => { setAssignedFilter(value); setPage(1); }}
                options={[{ value: '', label: 'All employees' }, ...users.map((item) => ({ value: item.id, label: item.fullName || item.username || item.email || item.id }))]}
                placeholder="All employees"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Date</label>
              <Input
                type="date"
                value={dateFilter}
                onChange={(event) => { setDateFilter(event.target.value); setPage(1); }}
                title="Created or follow-up date"
                className="h-10 text-xs"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--border)]">
            <label className="inline-flex items-center gap-2.5 text-xs font-semibold text-[var(--text-main)] cursor-pointer select-none">
              <Checkbox
                checked={overdueFilter}
                onChange={(event) => { setOverdueFilter(event.target.checked); setPage(1); }}
              />
              Overdue follow-ups only
            </label>
          </div>
        </div>
      ) : null}

      {viewType === 'table' && selectedIds.length ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-2.5 shadow-2xs animate-in fade-in duration-150">
          <span className="text-xs font-bold text-[var(--text-main)]">{selectedIds.length} lead(s) selected</span>
          <div className="flex flex-wrap items-center gap-2">
            {canBulkAssign ? <Button type="button" variant="outline" size="sm" onClick={() => setBulkAction('assign')}><UserRoundCog size={14} className="mr-1.5" />Assign</Button> : null}
            {canBulkStatus ? <Button type="button" variant="outline" size="sm" onClick={() => setBulkAction('status')}><RefreshCw size={14} className="mr-1.5" />Status</Button> : null}
            {canBulkFollowUp ? <Button type="button" variant="outline" size="sm" onClick={() => setBulkAction('follow_up')}><CalendarClock size={14} className="mr-1.5" />Follow-up</Button> : null}
            {canBulkExport ? <Button type="button" variant="outline" size="sm" onClick={exportSelectedLeads}><Download size={14} className="mr-1.5" />Export</Button> : null}
            <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedIds([])} title="Clear selection" className="h-8 w-8 text-[var(--text-muted)] hover:text-[var(--text-main)]"><X size={14} /></Button>
          </div>
        </div>
      ) : null}

      {viewType === 'table' ? (
        <DataTable
          toolbarLeft={
            <div className="relative flex-1 w-full max-w-sm">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); setSelectedIds([]); }}
                placeholder="Search leads..."
                className="pl-9 w-full"
              />
            </div>
          }
          toolbarRight={
            <div className="flex items-center gap-3">
              <div className="w-52">
                <SearchableSelect
                  value={pipelineFilter}
                  onChange={val => { setPipelineFilter(val); setPage(1); }}
                  options={[
                    { label: 'All Pipelines', value: '' },
                    ...pipelines.map((pipeline) => ({ label: pipeline.name, value: pipeline.id }))
                  ]}
                  placeholder="All Pipelines"
                />
              </div>
              <div className="w-48">
                <SearchableSelect
                  value={statusFilter}
                  onChange={val => { setStatusFilter(val); setPage(1); }}
                  options={[
                    { label: 'All Statuses', value: '' },
                    ...Array.from(new Set(rows.map(r => r.status))).filter(Boolean).map(s => ({ label: s, value: s }))
                  ]}
                  placeholder="All Statuses"
                />
              </div>
            </div>
          }
          loading={loading}
          columns={columns}
          rows={sortedRows}
          selectable={canSelectLeads}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSortChange={(k, d) => { setSortKey(k); setSortDirection(d); }}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          onRowClick={(row) => navigate(`/app/leads/${row.id}`)}
          rowActions={(row) => (
            <RowActionsDropdown
              row={row}
              navigate={navigate}
              canCreate={canCreate}
              canDelete={canDelete}
              setEditingData={setEditingData}
              setFormOpen={setFormOpen}
              setDeleteTarget={setDeleteTarget}
            />
          )}
        />
      ) : (
        <div className="pt-2">
          <KanbanBoard
            leads={kanbanLeads}
            statuses={allStatuses.length > 0 ? allStatuses : Array.from(new Set(rows.map(r => r.status))).filter(Boolean).map(s => ({ label: s }))}
            statusColors={statusColors}
            labelColors={labelColors}
            onStatusChange={handleStatusChange}
            onLeadClick={(lead) => navigate(`/app/leads/${lead.id}`)}
            onLeadEdit={canCreate ? (lead) => {
              setEditingData(lead);
              setFormOpen(true);
            } : undefined}
            onLeadDelete={canDelete ? (lead) => setDeleteTarget(lead) : undefined}
          />
        </div>
      )}

      <LeadFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initialData={editingData}
        options={leadOptions}
        users={users}
        pipelines={pipelines}
        onSuccess={() => setReloadTick(c => c + 1)}
      />

      <LabelManagerModal
        open={labelsOpen}
        onClose={() => setLabelsOpen(false)}
        onSaved={() => setReloadTick((c) => c + 1)}
      />

      <PipelineManagerModal
        open={pipelinesOpen}
        onClose={() => setPipelinesOpen(false)}
        pipelines={pipelines}
        token={token}
        onSaved={() => setReloadTick((c) => c + 1)}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Lead"
        description={`Are you sure you want to delete ${deleteTarget?.name}? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
        isLoading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <BulkLeadActionModal
        open={Boolean(bulkAction)}
        action={bulkAction}
        count={selectedIds.length}
        users={users.filter((user) => user.isActive !== false)}
        statuses={bulkStatuses}
        options={leadOptions}
        busy={bulkBusy}
        onClose={() => { if (!bulkBusy) setBulkAction(''); }}
        onSubmit={applyBulkAction}
      />



    </div>
  );
}
