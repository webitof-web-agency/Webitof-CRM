import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Activity,
  Briefcase,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Bell,
  FileText,
  Globe,
  HelpCircle,
  Mail,
  MapPin,
  Paperclip,
  Phone,
  Pencil,
  Receipt,
  Save,
  Tag,
  Trash2,
  Layers,
  MoreHorizontal,
  Hexagon,
  CheckCircle,
  Search,
  User,
  UserPlus,
  Users,
  Wallet
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { PageLoader } from '../../components/ui/Loader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { Input, Textarea } from '../../components/ui/Input';
import { SearchableSelect } from '../../components/forms/SearchableSelect';
import { PhoneInput } from '../../components/forms/PhoneInput';
import { AttachmentPicker } from '../../components/ui/AttachmentPicker';
import { FileComposerModal } from '../../components/ui/FileComposerModal';
import { ClientFormPage as ClientFormModal } from './ClientFormPage';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { cn } from '../../lib/cn';
import { normalizeSharedLabels, mergeSharedLabelOptions } from '../../lib/labels';
import { formatDateOnlyDisplay, formatDateOnlyInput, isSameDateOnly } from '../../lib/dateOnly';
import { EventFeedPanel } from '../../components/events/EventFeedPanel';

function InfoTooltip({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <div 
      className="relative inline-flex items-center" 
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button 
        type="button"
        className="text-slate-400 hover:text-slate-600 focus:outline-none cursor-help"
      >
        <HelpCircle size={14} />
      </button>
      {open && (
        <div className="absolute left-1/2 bottom-full mb-1.5 -translate-x-1/2 w-max max-w-[200px] whitespace-normal rounded-md bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg z-50 text-center normal-case tracking-normal">
          {text}
          <div className="absolute left-1/2 top-full -mt-1 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
        </div>
      )}
    </div>
  );
}

const ACTIVITY_COLORS = ['#2563eb', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#14b8a6', '#ec4899', '#6366f1', '#0ea5e9', '#f97316', '#84cc16'];
const EMPTY_CONTACT = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  jobTitle: '',
  gender: 'Other',
  notes: ''
};

function createLocalId(prefix = 'client-activity') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeLabelOptions(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      if (typeof item === 'string') {
        return { value: item, label: item, color: '#64748b' };
      }
      if (item && typeof item === 'object') {
        const label = item.label || item.value || '';
        return {
          value: item.value || label,
          label,
          color: item.color || item.badgeColor || '#64748b'
        };
      }
      return null;
    })
    .filter(Boolean);
}

function mergeLabelOptions(baseOptions = [], selectedLabels = []) {
  const map = new Map(baseOptions.map((item) => [String(item.value), item]));
  const labels = Array.isArray(selectedLabels)
    ? selectedLabels
    : typeof selectedLabels === 'string'
      ? selectedLabels.split(',')
      : [];

  labels.forEach((label) => {
    const value = String(label || '').trim();
    if (!value || map.has(value)) return;
    map.set(value, { value, label: value, color: '#64748b' });
  });

  return Array.from(map.values());
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
            driveWebViewLink: item.driveWebViewLink || '',
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

function SectionRow({ label, children }) {
  return (
    <div className="flex flex-col gap-1 py-2 md:flex-row md:items-start md:gap-4">
      <div className="shrink-0 pt-2 text-sm font-medium text-slate-500 md:w-32 lg:w-40">
        {label}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function ContactModal({ open, onClose, onSave, clientId, initialValue = null, busy = false }) {
  const [formData, setFormData] = useState(initialValue || EMPTY_CONTACT);

  useEffect(() => {
    setFormData(initialValue || EMPTY_CONTACT);
  }, [initialValue, open]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!formData.firstName.trim() && !formData.lastName.trim()) {
      toast.error('Contact name is required');
      return;
    }

    await onSave({
      ...formData,
      clientId,
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      jobTitle: formData.jobTitle.trim(),
      gender: formData.gender,
      notes: formData.notes.trim()
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialValue ? 'Edit contact' : 'Add contact'}
      width="760px"
      footer={(
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Close</Button>
          <Button onClick={handleSubmit} disabled={busy}>{busy ? 'Saving...' : 'Save'}</Button>
        </div>
      )}
    >
      <form onSubmit={handleSubmit} className="flex flex-col px-1">
        <SectionRow label="First name">
          <Input value={formData.firstName} onChange={(e) => setFormData((cur) => ({ ...cur, firstName: e.target.value }))} placeholder="First name" autoFocus />
        </SectionRow>
        <SectionRow label="Last name">
          <Input value={formData.lastName} onChange={(e) => setFormData((cur) => ({ ...cur, lastName: e.target.value }))} placeholder="Last name" />
        </SectionRow>
        <SectionRow label="Email">
          <Input type="email" value={formData.email} onChange={(e) => setFormData((cur) => ({ ...cur, email: e.target.value }))} placeholder="Email" />
        </SectionRow>
        <SectionRow label="Phone">
          <PhoneInput
            value={formData.phone}
            onChange={(e) => setFormData((cur) => ({ ...cur, phone: e.target.value }))}
            defaultCountry="in"
            placeholder="Phone number"
          />
        </SectionRow>
        <SectionRow label="Job Title">
          <Input value={formData.jobTitle} onChange={(e) => setFormData((cur) => ({ ...cur, jobTitle: e.target.value }))} placeholder="Job title" />
        </SectionRow>
        <SectionRow label="Gender">
          <div className="flex items-center gap-5 pt-1.5">
            {['Male', 'Female', 'Other'].map((option) => (
              <label key={option} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="client-contact-gender"
                  value={option}
                  checked={formData.gender === option}
                  onChange={(e) => setFormData((cur) => ({ ...cur, gender: e.target.value }))}
                  className="text-[var(--primary)] focus:ring-[var(--primary)]"
                />
                <span className="text-sm text-slate-700">{option}</span>
              </label>
            ))}
          </div>
        </SectionRow>
        <SectionRow label="Notes">
          <Textarea value={formData.notes} onChange={(e) => setFormData((cur) => ({ ...cur, notes: e.target.value }))} placeholder="Notes" rows={3} />
        </SectionRow>
      </form>
    </Modal>
  );
}

function normalizeActivities(value) {
  const items = Array.isArray(value)
    ? value
    : typeof value === 'string' && value.trim()
      ? (() => {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })()
      : [];

  return items
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const type = String(item.type || item.eventType || 'note').toLowerCase();
      const common = {
        id: String(item.id || createLocalId(type)),
        type,
        title: String(item.title || '').trim(),
        description: String(item.description || '').trim(),
        labels: parseListValue(item.labels),
        color: item.color || ACTIVITY_COLORS[0],
        attachments: parseAttachments(item.attachments),
        createdAt: item.createdAt || item.created_at || new Date().toISOString(),
        updatedAt: item.updatedAt || item.updated_at || item.createdAt || new Date().toISOString(),
        createdByName: item.createdByName || item.actorName || 'System'
      };

      return {
        ...common,
        points: item.points != null ? String(item.points) : '1',
        assignedTo: item.assignedTo || '',
        collaborators: parseListValue(item.collaborators),
        status: item.status || 'To do',
        priority: item.priority || 'Medium',
        startDate: formatDateInput(item.startDate),
        deadline: formatDateInput(item.deadline),
        recurring: Boolean(item.recurring),
        repeat: item.repeat || 'Daily',
        category: item.category || 'General',
        date: formatDateInput(item.date || item.reminderDate || item.startDate),
        time: item.time || item.startTime || '',
        location: item.location || '',
        endDate: formatDateInput(item.endDate),
        endTime: item.endTime || '',
        active: item.active !== false
      };
    })
    .filter(Boolean);
}

function formatMoney(value, currency = 'INR', symbol = '') {
  const amount = Number(value || 0);
  if (symbol) {
    return `${symbol}${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  }

  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  } catch {
    return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  }
}

function formatDate(value) {
  return formatDateOnlyDisplay(value);
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDateInput(value) {
  return formatDateOnlyInput(value);
}

function formatPhoneDisplay(value) {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  return raw.startsWith('+') ? raw : `+${raw.replace(/[^\d]/g, '') || raw}`;
}

function renderStatusPill(value) {
  const color = value === 'Active'
    ? '#10b981'
    : value === 'Inactive'
      ? '#64748b'
      : '#3b82f6';

  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
      style={{
        backgroundColor: `${color}14`,
        color,
        borderColor: `${color}2A`
      }}
    >
      {value || '-'}
    </span>
  );
}

function renderTag(label, color = '#2563eb') {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
      style={{
        backgroundColor: `${color}14`,
        color,
        borderColor: `${color}2A`
      }}
    >
      {label}
    </span>
  );
}

function getCalendarStartOfMonth(date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getCalendarStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, amount) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

function sameDay(a, b) {
  return isSameDateOnly(a, b);
}

function getActivityDate(activity) {
  return activity?.startDate || activity?.date || activity?.deadline || activity?.createdAt || activity?.updatedAt || '';
}

function getActivityKindLabel(kind = '') {
  const lower = String(kind || '').toLowerCase();
  return {
    task: 'Task',
    note: 'Note',
    reminder: 'Reminder',
    event: 'Event',
    created: 'Created',
    updated: 'Updated'
  }[lower] || 'Activity';
}

function getActivityAccent(activity) {
  if (activity?.color) return activity.color;
  const kind = String(activity?.type || activity?.kind || '').toLowerCase();
  if (kind === 'task') return '#0ea5e9';
  if (kind === 'note') return '#8b5cf6';
  if (kind === 'reminder') return '#f59e0b';
  if (kind === 'event') return '#10b981';
  if (kind === 'created') return '#0f766e';
  if (kind === 'updated') return '#3b82f6';
  return '#64748b';
}

function getCalendarTitle(date, view) {
  const d = new Date(date);
  if (view === 'day') {
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  }
  if (view === 'week') {
    const start = getCalendarStartOfWeek(d);
    const end = addDays(start, 6);
    return `${start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} - ${end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  }
  if (view === 'list') {
    return 'Activity list';
  }
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function ActivityCard({ item, onEdit, onDelete }) {
  const accent = getActivityAccent(item);
  const isSynthetic = Boolean(item?.isSynthetic);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{ backgroundColor: `${accent}18`, color: accent }}
            >
              {getActivityKindLabel(item.type)}
            </span>
            {item.priority ? (
            <span className="rounded-full bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {item.priority}
            </span>
          ) : null}
          {isSynthetic ? (
            <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-600">
              Follow-up
            </span>
          ) : null}
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-900">{item.title || 'Untitled activity'}</div>
          {item.description ? <div className="mt-1 text-sm text-slate-600">{item.description}</div> : null}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span>{formatDateTime(getActivityDate(item))}</span>
            {item.assignedTo ? <span>Assigned to {item.assignedTo}</span> : null}
            {item.location ? <span>{item.location}</span> : null}
          </div>
          {Array.isArray(item.labels) && item.labels.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {item.labels.slice(0, 4).map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                  style={{
                    backgroundColor: `${accent}10`,
                    borderColor: `${accent}30`,
                    color: accent
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {!isSynthetic ? (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => onEdit?.(item)} title="Edit">
              <Pencil size={16} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete?.(item)} title="Delete" className="text-red-500 hover:text-red-600 hover:bg-red-50">
              <Trash2 size={16} />
            </Button>
          </div>
        ) : null}
      </div>
      {Array.isArray(item.attachments) && item.attachments.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {item.attachments.map((file) => (
            <a
              key={file.driveFileId || file.id}
              href={file.driveWebViewLink || `#${file.driveFileId || file.id}`}
              target={file.driveWebViewLink ? '_blank' : undefined}
              rel={file.driveWebViewLink ? 'noreferrer' : undefined}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300"
            >
              <Paperclip size={12} />
              {file.name || file.originalName || 'File'}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ActivitySection({ title, description, items, accent, emptyText, onAdd, onEdit, onDelete, actionLabel }) {
  return (
    <Card className="p-5">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
        <Button variant="secondary" onClick={onAdd}>
          <CalendarPlus size={16} className="mr-2" />
          Add {actionLabel || title.replace(/s$/i, '').toLowerCase()}
        </Button>
      </div>
      <div className="mt-4 space-y-3">
        {items.length ? items.map((item) => <ActivityCard key={item.id} item={item} onEdit={onEdit} onDelete={onDelete} accent={accent} />) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            {emptyText}
          </div>
        )}
      </div>
    </Card>
  );
}

function ActivityComposerModal({
  open,
  mode,
  initialValue,
  onClose,
  onSave,
  busy,
  labelOptions,
  userOptions,
  token,
  uploadModule,
  uploadEntityId
}) {
  const [formData, setFormData] = useState(null);

  useEffect(() => {
    if (!open) return;

    const common = {
      title: '',
      description: '',
      labels: [],
      color: ACTIVITY_COLORS[0],
      attachments: []
    };

    const base = {
      task: {
        ...common,
        points: '1',
        assignedTo: '',
        collaborators: [],
        status: 'To do',
        priority: 'Medium',
        startDate: '',
        deadline: '',
        recurring: false,
        category: 'General'
      },
      note: {
        ...common,
        category: 'General'
      },
      reminder: {
        ...common,
        date: '',
        time: '',
        repeat: false,
        repeatType: 'Daily'
      },
      event: {
        ...common,
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        location: '',
        visibility: 'all_team',
        allowedUserIds: [],
        allowedTeamIds: []
      }
    };

    const source = initialValue || {};
    const next = {
      ...base[mode],
      ...source,
      title: source.title || '',
      description: source.description || '',
      labels: parseListValue(source.labels),
      color: source.color || ACTIVITY_COLORS[0],
      attachments: parseAttachments(source.attachments),
      points: source.points != null ? String(source.points) : base[mode].points,
      assignedTo: source.assignedTo || '',
      collaborators: parseListValue(source.collaborators),
      status: source.status || base[mode].status,
      priority: source.priority || base[mode].priority,
      startDate: formatDateInput(source.startDate),
      deadline: formatDateInput(source.deadline),
      recurring: Boolean(source.recurring),
      category: source.category || base[mode].category,
      date: formatDateInput(source.date || source.reminderDate || source.startDate),
      time: source.time || source.startTime || '',
      repeat: Boolean(source.repeat),
      repeatType: source.repeatType || 'Daily',
      location: source.location || '',
      endDate: formatDateInput(source.endDate),
      endTime: source.endTime || '',
      visibility: String(source.visibility || 'all_team').toLowerCase() === 'onlyme'
        ? 'only_me'
        : String(source.visibility || 'all_team').toLowerCase() === 'specific_members_and_teams'
          ? 'specific'
          : String(source.visibility || 'all_team').toLowerCase(),
      allowedUserIds: parseListValue(source.allowedUserIds),
      allowedTeamIds: parseListValue(source.allowedTeamIds)
    };

    setFormData(next);
  }, [initialValue, mode, open]);

  const taskStatusOptions = [
    { value: 'To do', label: 'To do' },
    { value: 'In progress', label: 'In progress' },
    { value: 'Review', label: 'Review' },
    { value: 'Done', label: 'Done' }
  ];

  const taskPriorityOptions = [
    { value: 'Low', label: 'Low' },
    { value: 'Medium', label: 'Medium' },
    { value: 'High', label: 'High' },
    { value: 'Urgent', label: 'Urgent' }
  ];

  const pointsOptions = Array.from({ length: 10 }, (_, index) => {
    const point = String(index + 1);
    return { value: point, label: `${point} Point${point === '1' ? '' : 's'}` };
  });

  const reminderRepeatOptions = [
    { value: 'Daily', label: 'Daily' },
    { value: 'Weekly', label: 'Weekly' },
    { value: 'Monthly', label: 'Monthly' },
    { value: 'Yearly', label: 'Yearly' }
  ];

  const noteCategoryOptions = [
    { value: 'General', label: 'General' },
    { value: 'Follow-up', label: 'Follow-up' },
    { value: 'Billing', label: 'Billing' },
    { value: 'Support', label: 'Support' },
    { value: 'Strategy', label: 'Strategy' }
  ];

  const eventVisibilityOptions = [
    { value: 'only_me', label: 'Only me' },
    { value: 'all_team', label: 'All team members' },
    { value: 'specific', label: 'Specific members and teams' }
  ];

  const set = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }));

  async function handleSubmit(event) {
    event?.preventDefault?.();
    if (!formData?.title?.trim()) {
      toast.error('Title is required');
      return;
    }
    await onSave({
      ...formData,
      type: mode,
      attachments: formData.attachments || [],
      labels: parseListValue(formData.labels),
      collaborators: parseListValue(formData.collaborators),
      points: formData.points || '1',
      recurring: Boolean(formData.recurring),
      repeat: Boolean(formData.repeat),
      updatedAt: new Date().toISOString()
    });
  }

  function appendAttachment(file) {
    if (!file) return;
    const next = parseAttachments(formData?.attachments);
    const mapped = {
      id: file.id || file.driveFileId,
      driveFileId: file.driveFileId || file.id,
      name: file.name || file.originalName || 'File',
      originalName: file.originalName || file.name || 'File',
      driveWebViewLink: file.driveWebViewLink || '',
      mimeType: file.mimeType || ''
    };
    if (next.some((item) => String(item.driveFileId) === String(mapped.driveFileId))) return;
    set('attachments', [mapped, ...next]);
  }

  if (!open || !formData) return null;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={`Add ${mode}`}
        subtitle={mode === 'task'
          ? 'Create a task and assign it to a team member.'
          : mode === 'note'
            ? 'Capture a client note with labels and color.'
            : mode === 'reminder'
              ? 'Set a reminder for this client.'
              : 'Schedule a client event.'}
        width="min(980px, 96vw)"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <Input value={formData.title} onChange={(e) => set('title', e.target.value)} placeholder="Title" />
              <Textarea value={formData.description} onChange={(e) => set('description', e.target.value)} placeholder="Description..." rows={mode === 'event' ? 5 : 7} />

              {(mode === 'task' || mode === 'note' || mode === 'reminder' || mode === 'event') && (
                <SearchableSelect
                  value={formData.labels}
                  onChange={(val) => set('labels', val)}
                  options={labelOptions}
                  placeholder="Labels"
                  searchPlaceholder="Search labels..."
                  multiple
                />
              )}

              <AttachmentPicker
                attachments={Array.isArray(formData.attachments) ? formData.attachments : []}
                uploadModule={uploadModule}
                uploadEntityId={uploadEntityId}
                onAddFile={appendAttachment}
                onRemoveFile={(driveFileId) => set('attachments', (formData.attachments || []).filter((item) => String(item.driveFileId || item.id) !== String(driveFileId)))}
              />
            </div>

            <div className="space-y-3">
              {mode === 'task' ? (
                <>
                  <SearchableSelect value={formData.points} onChange={(val) => set('points', val)} options={pointsOptions} placeholder="Points" allowClear={false} />
                  <SearchableSelect value={formData.assignedTo} onChange={(val) => set('assignedTo', val)} options={userOptions} placeholder="Assign to" allowClear={true} />
                  <SearchableSelect value={formData.collaborators} onChange={(val) => set('collaborators', val)} options={userOptions} placeholder="Collaborators" multiple searchPlaceholder="Search teammates..." />
                  <SearchableSelect value={formData.status} onChange={(val) => set('status', val)} options={taskStatusOptions} placeholder="Status" allowClear={false} />
                  <SearchableSelect value={formData.priority} onChange={(val) => set('priority', val)} options={taskPriorityOptions} placeholder="Priority" allowClear={false} />
                  <Input type="date" value={formData.startDate} onChange={(e) => set('startDate', e.target.value)} placeholder="Start date" />
                  <Input type="date" value={formData.deadline} onChange={(e) => set('deadline', e.target.value)} placeholder="Deadline" />
                  <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                    <input type="checkbox" checked={Boolean(formData.recurring)} onChange={(e) => set('recurring', e.target.checked)} />
                    Recurring
                  </label>
                </>
              ) : null}

              {mode === 'note' ? (
                <>
                  <SearchableSelect value={formData.category} onChange={(val) => set('category', val)} options={noteCategoryOptions} placeholder="Category" allowClear={false} />
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Color</div>
                    <div className="flex flex-wrap gap-2">
                      {ACTIVITY_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => set('color', color)}
                          className={cn('h-6 w-6 rounded-full border-2 transition', formData.color === color ? 'border-slate-300 ring-2 ring-offset-2' : 'border-white/70')}
                          style={{ backgroundColor: color }}
                          aria-label={`Note color ${color}`}
                        />
                      ))}
                    </div>
                  </div>
                </>
              ) : null}

              {mode === 'reminder' ? (
                <>
                  <Input type="date" value={formData.date} onChange={(e) => set('date', e.target.value)} placeholder="Date" />
                  <Input type="time" value={formData.time} onChange={(e) => set('time', e.target.value)} placeholder="Time" />
                  <SearchableSelect value={formData.repeatType} onChange={(val) => set('repeatType', val)} options={reminderRepeatOptions} placeholder="Repeat" allowClear={false} />
                  <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                    <input type="checkbox" checked={Boolean(formData.repeat)} onChange={(e) => set('repeat', e.target.checked)} />
                    Repeat
                  </label>
                </>
              ) : null}

              {mode === 'event' ? (
                <>
                  <Input type="date" value={formData.startDate} onChange={(e) => set('startDate', e.target.value)} placeholder="Start date" />
                  <Input type="time" value={formData.startTime} onChange={(e) => set('startTime', e.target.value)} placeholder="Start time" />
                  <Input type="date" value={formData.endDate} onChange={(e) => set('endDate', e.target.value)} placeholder="End date" />
                  <Input type="time" value={formData.endTime} onChange={(e) => set('endTime', e.target.value)} placeholder="End time" />
                  <Input value={formData.location} onChange={(e) => set('location', e.target.value)} placeholder="Location" />
                  <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Share with</div>
                    <div className="flex flex-wrap items-center gap-6 pt-1">
                      {eventVisibilityOptions.map((option) => (
                        <label key={option.value} className="flex cursor-pointer items-center gap-2">
                          <input
                            type="radio"
                            name="client-event-visibility"
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
                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
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
                </>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Close</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save'}</Button>
          </div>
        </form>
      </Modal>

    </>
  );
}

function CalendarPanel({ events, view, currentDate, onViewChange, onDateChange, onEditEvent, onDeleteEvent, onAddTask, onAddNote, onAddReminder, onAddEvent }) {
  const range = useMemo(() => {
    const base = new Date(currentDate);
    if (view === 'day') {
      return { start: base, end: base };
    }
    if (view === 'week') {
      const start = getCalendarStartOfWeek(base);
      return { start, end: addDays(start, 6) };
    }
    if (view === 'list') {
      const start = new Date(base);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(base);
      end.setMonth(end.getMonth() + 2);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    const start = getCalendarStartOfMonth(base);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, [currentDate, view]);

  const visibleEvents = useMemo(() => {
    return (events || [])
      .filter((event) => {
        const date = getActivityDate(event);
        if (!date) return false;
        const parsed = new Date(date);
        if (Number.isNaN(parsed.getTime())) return false;
        return parsed >= range.start && parsed <= range.end;
      })
      .sort((a, b) => String(getActivityDate(b)).localeCompare(String(getActivityDate(a))));
  }, [events, range.end, range.start]);

  const monthCells = useMemo(() => {
    const start = getCalendarStartOfMonth(currentDate);
    const firstCell = getCalendarStartOfWeek(start);
    return Array.from({ length: 42 }, (_, index) => addDays(firstCell, index));
  }, [currentDate]);

  const weekDays = useMemo(() => {
    if (view === 'day') return [new Date(currentDate)];
    const start = getCalendarStartOfWeek(currentDate);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [currentDate, view]);

  function shiftDate(amount) {
    const next = new Date(currentDate);
    if (view === 'day') next.setDate(next.getDate() + amount);
    else if (view === 'week') next.setDate(next.getDate() + amount * 7);
    else next.setMonth(next.getMonth() + amount);
    onDateChange(next);
  }

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-slate-800" />
          <h3 className="text-lg font-semibold text-slate-900">Events</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-[var(--radius-button,1rem)] border border-slate-200 bg-white p-1">
            <Button variant="ghost" size="icon" onClick={() => shiftDate(-1)} className="h-9 w-9">
              <ChevronLeft size={16} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDateChange(new Date())} className="h-9 w-auto px-3 text-sm">
              today
            </Button>
            <Button variant="ghost" size="icon" onClick={() => shiftDate(1)} className="h-9 w-9">
              <ChevronRight size={16} />
            </Button>
          </div>
          <div className="text-base font-semibold text-slate-900">{getCalendarTitle(currentDate, view)}</div>
          <div className="flex items-center rounded-[var(--radius-button,1rem)] border border-slate-200 bg-white p-1">
            {['month', 'week', 'day'].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onViewChange(item)}
                className={cn(
                  'rounded-[var(--radius-button,1rem)] px-3 py-1.5 text-sm font-medium capitalize transition',
                  view === item ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                {item}
              </button>
            ))}
          </div>
          {onAddEvent && (
            <Button variant="outline" onClick={onAddEvent} className="ml-1 shrink-0 bg-white shadow-sm hover:bg-slate-50">
              + Add event
            </Button>
          )}
        </div>
      </div>

      {view === 'month' ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="px-3 py-2">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthCells.map((day) => {
              const items = visibleEvents.filter((event) => sameDay(getActivityDate(event), day)).slice(0, 3);
              const isCurrentMonth = day.getMonth() === new Date(currentDate).getMonth();
              const isToday = isSameDateOnly(day, new Date());
              const isSelected = isSameDateOnly(day, currentDate);
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'min-h-32 border-r border-b border-slate-100 p-3 text-left transition hover:bg-slate-50',
                    !isCurrentMonth && 'bg-slate-50/70 text-slate-400',
                    isSelected && 'bg-[color-mix(in_srgb,var(--primary)_7%,white)]',
                    isToday && 'ring-1 ring-inset ring-[var(--primary)]'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => onDateChange(day)}
                      className={cn('text-sm font-semibold', isToday ? 'text-[var(--primary)]' : 'text-slate-800')}
                    >
                      {day.getDate()}
                    </button>
                    {isToday ? <span className="rounded-full bg-[var(--primary)] px-2 py-0.5 text-[10px] font-semibold uppercase text-white">today</span> : null}
                  </div>
                  <div className="mt-2 space-y-1">
                    {items.map((item) => {
                      const accent = getActivityAccent(item);
                      return (
                        <div key={`${item.id}-${day.toISOString()}`} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditEvent(item);
                            }}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
                            <span className="truncate">{item.title}</span>
                          </button>
                          {onDeleteEvent ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteEvent(item);
                              }}
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                              aria-label="Delete event"
                            >
                              <Trash2 size={10} />
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : view !== 'list' ? (
        <div className="mt-4 space-y-3">
          {weekDays.map((day) => {
            const dayItems = visibleEvents.filter((event) => sameDay(getActivityDate(event), day));
            return (
              <div key={day.toISOString()} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">
                    {day.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short' })}
                  </div>
                  <div className="text-xs text-slate-500">{dayItems.length} item(s)</div>
                </div>
                <div className="mt-3 space-y-2">
                  {dayItems.length ? dayItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left hover:border-slate-300"
                    >
                      <button
                        type="button"
                        onClick={() => onEditEvent(item)}
                        className="flex min-w-0 flex-1 items-start gap-3 text-left"
                      >
                        <span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getActivityAccent(item) }} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                          <div className="text-xs text-slate-500">{item.description || 'No description'}</div>
                        </div>
                      </button>
                      {onDeleteEvent ? (
                        <button
                          type="button"
                          onClick={() => onDeleteEvent(item)}
                          className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                          aria-label="Delete event"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
                      No events on this day.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {view === 'list' ? (
        <div className="mt-4 space-y-3">
          {visibleEvents.length ? visibleEvents.map((item) => <ActivityCard key={item.id} item={item} onEdit={onEditEvent} onDelete={onDeleteEvent} />) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              No events in the selected range.
            </div>
          )}
        </div>
      ) : null}
    </Card>
  );
}

export function ClientDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [data, setData] = useState(null);
  const [settings, setSettings] = useState(null);
  const [users, setUsers] = useState([]);
  const [files, setFiles] = useState([]);
  const [filesModalOpen, setFilesModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [activityType, setActivityType] = useState(null);
  const [activityEdit, setActivityEdit] = useState(null);
  const [activityBusy, setActivityBusy] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactEdit, setContactEdit] = useState(null);
  const [contactBusy, setContactBusy] = useState(false);
  const [contactDeleteTarget, setContactDeleteTarget] = useState(null);
  const [contactDeleteBusy, setContactDeleteBusy] = useState(false);
  const [metaBusy, setMetaBusy] = useState(false);
  const [calendarView, setCalendarView] = useState('month');
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const results = await Promise.allSettled([
          api.resources.get('/clients', `${id}/summary`, token),
          api.files.list(token, '', 'clients', id),
          api.settings.get(token),
          api.resources.list('/users', token, '')
        ]);

        if (!active) return;

        const [summaryRes, filesRes, settingsRes, usersRes] = results;
        if (summaryRes.status === 'fulfilled') {
          setData(summaryRes.value.data || null);
        } else {
          throw summaryRes.reason || new Error('Failed to load client details');
        }

        if (filesRes.status === 'fulfilled') {
          setFiles(filesRes.value.data || []);
        } else {
          setFiles([]);
        }

        if (settingsRes.status === 'fulfilled') {
          setSettings(settingsRes.value.data || null);
        }

        if (usersRes.status === 'fulfilled') {
          setUsers(usersRes.value.data || []);
        } else {
          setUsers([]);
        }
      } catch (error) {
        if (active) {
          toast.error(error.message || 'Failed to load client details');
          navigate('/app/clients');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [id, navigate, refreshTick, token]);

  const client = data?.client || {};
  const summary = data?.summary || {};
  const projects = data?.projects || [];
  const invoices = data?.invoices || [];
  const payments = data?.payments || [];
  const amcs = data?.amcs || [];
  const renewals = data?.renewals || [];
  const contacts = data?.contacts || [];
  const primaryContact = data?.primaryContact || contacts[0] || null;
  const backendTimeline = data?.timeline || [];
  const activityItems = normalizeActivities(client.activities);
  const events = data?.events || [];
  const eventItems = events.filter((item) => String(item.eventType || item.type || '').toLowerCase() === 'event');
  const userLookup = useMemo(() => new Map(users.map((item) => [String(item.id), item.fullName || item.username || item.email || 'System'])), [users]);
  const mergedTimeline = useMemo(() => {
    const source = Array.isArray(backendTimeline) && backendTimeline.length
      ? backendTimeline
      : [
        ...activityItems.map((item) => ({
          date: getActivityDate(item),
          title: item.title || getActivityKindLabel(item.type),
          detail: item.description || item.category || 'Client activity',
          kind: item.type,
          actorName: item.createdByName || user?.fullName || user?.username || 'System',
          color: item.color || null,
          meta: item,
          amount: 0
        })),
        ...eventItems.map((item) => ({
          date: item.startDate || item.endDate || item.createdAt,
          title: item.title || 'Event',
          detail: item.description || item.location || 'Client event',
          kind: 'event',
          actorName: userLookup.get(String(item.ownerUserId)) || user?.fullName || user?.username || 'System',
          color: item.color || null,
          meta: item,
          amount: 0
        }))
      ];

    const map = new Map();
    source.forEach((item) => {
      if (!item?.date) return;
      const key = [
        item.kind || '',
        item.date || '',
        item.title || '',
        item.detail || '',
        item.actorName || ''
      ].join('|');
      if (!map.has(key)) map.set(key, item);
    });

    return Array.from(map.values()).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [activityItems, backendTimeline, eventItems, user?.fullName, user?.username, userLookup]);

  const labelOptions = useMemo(() => {
    return mergeSharedLabelOptions(normalizeSharedLabels(settings?.labels || []), client.labels);
  }, [client.labels, settings]);

  const clientPipelineStages = useMemo(() => {
    const configured = Array.isArray(settings?.statuses?.clients) ? settings.statuses.clients : [];
    const stages = configured.map((item) => {
      if (typeof item === 'string') {
        return { label: item, color: '#64748b' };
      }
      return {
        label: item.label || item.value || '',
        color: item.color || '#64748b'
      };
    }).filter((item) => item.label);

    if (client.status && !stages.some((item) => item.label === client.status)) {
      stages.push({ label: client.status, color: '#64748b' });
    }

    return stages;
  }, [client.status, settings]);

  const labels = parseListValue(client.labels);
  const ownerName = client.contactPerson || client.ownerName || '-';
  const currency = client.currency || 'INR';
  const currencySymbol = client.currencySymbol || '';
  const userOptions = useMemo(() => users.map((item) => {
    const label = item.fullName || item.username || item.email || 'User';
    return {
      value: item.id,
      label,
      description: [item.username, item.roles?.[0]?.name].filter(Boolean).join(' • ') || 'Team member'
    };
  }), [users]);

  const taskItems = activityItems.filter((item) => item.type === 'task');
  const noteItems = activityItems.filter((item) => item.type === 'note');
  const reminderItems = useMemo(() => {
    const followUpReminder = client?.followUpDate
      ? [{
          id: `follow-up-${id}`,
          type: 'reminder',
          title: 'Client follow-up',
          description: client.notes || 'Client follow-up reminder',
          date: client.followUpDate,
          startDate: client.followUpDate,
          endDate: client.followUpDate,
          time: '',
          color: '#f59e0b',
          isSynthetic: true
        }]
      : [];
    return [...followUpReminder, ...activityItems.filter((item) => item.type === 'reminder')];
  }, [activityItems, client?.followUpDate, client?.notes, id]);
  const recentClientEvents = mergedTimeline.slice(0, 4);
  const currentStageIndex = Math.max(clientPipelineStages.findIndex((item) => item.label === client.status), 0);
  const stageProgress = clientPipelineStages.length > 1
    ? Math.round(((currentStageIndex + 1) / clientPipelineStages.length) * 100)
    : (client.status ? 100 : 0);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'timeline', label: `Timeline (${mergedTimeline.length})`, icon: Clock3 },
    { id: 'contacts', label: `Contacts (${summary.contactsCount ?? contacts.length})`, icon: Users },
    { id: 'tasks', label: `Tasks (${taskItems.length})`, icon: CalendarPlus },
    { id: 'notes', label: `Notes (${noteItems.length})`, icon: Tag },
    { id: 'reminders', label: `Reminders (${reminderItems.length})`, icon: Bell },
    { id: 'events', label: `Events (${eventItems.length})`, icon: CalendarDays },
    { id: 'projects', label: `Projects (${projects.length})`, icon: Briefcase },
    { id: 'invoices', label: `Invoices (${invoices.length})`, icon: Receipt },
    { id: 'payments', label: `Payments (${payments.length})`, icon: Wallet },
    { id: 'amcs', label: `AMC (${amcs.length})`, icon: FileText },
    { id: 'renewals', label: `Renewals (${renewals.length})`, icon: FileText },
    { id: 'files', label: `Files (${files.length})`, icon: Paperclip }
  ];

  async function saveClientMeta(nextPatch) {
    setMetaBusy(true);
    try {
      await api.resources.update('/clients', id, nextPatch, token);
      api.cache.invalidate('/clients');
      toast.success('Client updated');
      setRefreshTick((current) => current + 1);
    } catch (error) {
      toast.error(error.message || 'Failed to update client');
    } finally {
      setMetaBusy(false);
    }
  }

  async function saveClientActivity(payload) {
    setActivityBusy(true);
    try {
      const type = String(payload.type || activityType || 'note').toLowerCase();
      const editing = Boolean(activityEdit?.id);
      const now = new Date().toISOString();

      if (type === 'event') {
        const eventPayload = {
          ...payload,
          scopeType: 'client',
          scopeId: id,
          clientId: id,
          leadId: '',
          projectId: '',
          visibility: payload.visibility || 'all_team',
          ownerUserId: user?.id || payload.ownerUserId || '',
          labels: parseListValue(payload.labels),
          allowedUserIds: parseListValue(payload.allowedUserIds),
          allowedTeamIds: parseListValue(payload.allowedTeamIds),
          color: payload.color || ACTIVITY_COLORS[0],
          updatedAt: now
        };

        if (editing && activityEdit.source !== 'legacy') {
          await api.resources.update('/events', activityEdit.id, eventPayload, token);
        } else if (editing && activityEdit.source === 'legacy') {
          const currentActivities = normalizeActivities(client.activities);
          const nextActivity = {
            ...payload,
            id: activityEdit.id,
            type: 'event',
            title: String(payload.title || '').trim(),
            description: String(payload.description || '').trim(),
            labels: parseListValue(payload.labels),
            attachments: parseAttachments(payload.attachments),
            color: payload.color || ACTIVITY_COLORS[0],
            createdByName: activityEdit.createdByName || user?.fullName || user?.username || user?.email || 'System',
            createdAt: activityEdit.createdAt || now,
            updatedAt: now
          };
          const nextActivities = currentActivities.map((item) => (String(item.id) === String(nextActivity.id) ? { ...item, ...nextActivity } : item));
          await api.resources.update('/clients', id, { activities: nextActivities }, token);
        } else {
          await api.resources.create('/events', eventPayload, token);
        }
        api.cache.invalidate('/events');
      } else {
        const currentActivities = normalizeActivities(client.activities);
        const nextActivity = {
          ...payload,
          id: activityEdit?.id || createLocalId(type || 'activity'),
          type,
          title: String(payload.title || '').trim(),
          description: String(payload.description || '').trim(),
          labels: parseListValue(payload.labels),
          attachments: parseAttachments(payload.attachments),
          color: payload.color || ACTIVITY_COLORS[0],
          createdByName: user?.fullName || user?.username || user?.email || 'System',
          createdAt: activityEdit?.createdAt || now,
          updatedAt: now
        };

        const nextActivities = editing
          ? currentActivities.map((item) => (String(item.id) === String(nextActivity.id) ? { ...item, ...nextActivity } : item))
          : [nextActivity, ...currentActivities];

        await api.resources.update('/clients', id, { activities: nextActivities }, token);
      }
      api.cache.invalidate('/clients');
      toast.success(editing ? 'Activity updated' : 'Activity added');
      setActivityType(null);
      setActivityEdit(null);
      setRefreshTick((current) => current + 1);
    } catch (error) {
      toast.error(error.message || 'Failed to save activity');
    } finally {
      setActivityBusy(false);
    }
  }

  async function saveClientContact(payload) {
    setContactBusy(true);
    try {
      const editing = Boolean(contactEdit?.id);
      const nextPayload = {
        ...payload,
        isPrimary: editing ? Boolean(contactEdit?.isPrimary) : contacts.length === 0
      };

      if (editing) {
        await api.resources.update('/client-contacts', contactEdit.id, nextPayload, token);
      } else {
        await api.resources.create('/client-contacts', nextPayload, token);
      }

      api.cache.invalidate('/clients');
      api.cache.invalidate('/client-contacts');
      toast.success(editing ? 'Contact updated' : 'Contact added');
      setContactOpen(false);
      setContactEdit(null);
      setRefreshTick((current) => current + 1);
    } catch (error) {
      toast.error(error.message || 'Failed to save contact');
    } finally {
      setContactBusy(false);
    }
  }

  async function deleteClientContact() {
    if (!contactDeleteTarget) return;
    setContactDeleteBusy(true);
    try {
      await api.resources.remove('/client-contacts', contactDeleteTarget.id, token);
      api.cache.invalidate('/clients');
      api.cache.invalidate('/client-contacts');
      toast.success('Contact deleted');
      setContactDeleteTarget(null);
      setRefreshTick((current) => current + 1);
    } catch (error) {
      toast.error(error.message || 'Failed to delete contact');
    } finally {
      setContactDeleteBusy(false);
    }
  }

  async function deleteClientActivity(activity) {
    if (!activity) return;
    try {
      if (String(activity.type || activity.eventType || '').toLowerCase() === 'event' && activity.source !== 'legacy') {
        await api.resources.remove('/events', activity.id, token);
        api.cache.invalidate('/events');
      } else if (String(activity.type || activity.eventType || '').toLowerCase() === 'event' && activity.source === 'legacy') {
        const nextActivities = normalizeActivities(client.activities).filter((item) => String(item.id) !== String(activity.id));
        await api.resources.update('/clients', id, { activities: nextActivities }, token);
      } else {
        const nextActivities = normalizeActivities(client.activities).filter((item) => String(item.id) !== String(activity.id));
        await api.resources.update('/clients', id, { activities: nextActivities }, token);
      }
      api.cache.invalidate('/clients');
      toast.success('Activity deleted');
      setRefreshTick((current) => current + 1);
    } catch (error) {
      toast.error(error.message || 'Failed to delete activity');
    }
  }

  const clientInfoItems = [
    { label: 'Type', value: client.clientType || client.type || 'Organization' },
    { label: 'Source', value: client.source || '-' },
    { label: 'Owner', value: ownerName, tooltip: 'Who manages this client' },
    { label: 'Primary contact', value: ownerName },
    { label: 'Company number', value: formatPhoneDisplay(client.mobile) },
    { label: 'Email', value: client.email || '-' },
    { label: 'Website', value: client.website || '-' },
    { label: 'Value', value: formatMoney(client.openingBalance || 0, currency, currencySymbol) }
  ];

  const addressLine = [client.billingAddress, client.city, client.state, client.country].filter(Boolean).join(', ');

  if (loading) return <PageLoader />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/app/clients')}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800"
            >
              <ArrowLeft size={16} />
              Back to Clients
            </button>
            <span className="text-slate-300">/</span>
            <h1 className="text-base font-semibold tracking-tight text-[var(--text-main)]">
              {client.companyName || client.name || 'Client'}
            </h1>
          </div>
          <div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {renderStatusPill(client.status)}
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                {client.clientType || client.type || 'Organization'}
              </span>
              {labels.slice(0, 3).map((label) => {
                const color = labelOptions.find((item) => item.label === label)?.color || '#2563eb';
                return <span key={label}>{renderTag(label, color)}</span>;
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" className="shadow-sm" onClick={() => setEditOpen(true)}>
            <Pencil size={16} className="mr-2" />
            Edit Client
          </Button>
          <Button onClick={() => navigate('/app/projects', { state: { openProjectForm: true, clientId: id } })}>
            <Briefcase size={16} className="mr-2" />
            Add Project
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-6 border-b border-slate-200 px-2 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'group flex items-center gap-2 whitespace-nowrap border-b-2 py-4 text-sm font-medium transition-colors',
                isActive
                  ? 'border-[var(--primary)] text-[var(--primary)]'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
              )}
            >
              <Icon size={16} className={isActive ? 'text-[var(--primary)]' : 'text-slate-400 group-hover:text-slate-500'} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_360px]">
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-2">
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-blue-600 text-white shadow-sm">
                      <Briefcase size={20} />
                    </div>
                    <span className="text-2xl font-bold text-slate-800">{summary.totalProjects || 0}</span>
                  </div>
                  <div className="text-sm font-medium text-slate-500 mt-1">
                    Projects
                  </div>
                </Card>
                <Card className="p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-2">
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-emerald-600 text-white shadow-sm">
                      <Receipt size={20} />
                    </div>
                    <span className="text-2xl font-bold text-slate-800">{formatMoney(summary.totalInvoiceAmount || 0, currency, currencySymbol)}</span>
                  </div>
                  <div className="text-sm font-medium text-slate-500 mt-1">
                    Invoiced
                  </div>
                </Card>
                <Card className="p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-2">
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-purple-600 text-white shadow-sm">
                      <Wallet size={20} />
                    </div>
                    <span className="text-2xl font-bold text-slate-800">{formatMoney(summary.totalReceived || 0, currency, currencySymbol)}</span>
                  </div>
                  <div className="text-sm font-medium text-slate-500 mt-1">
                    Received
                  </div>
                </Card>
                <Card className="p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-2">
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-amber-600 text-white shadow-sm">
                      <Clock3 size={20} />
                    </div>
                    <span className="text-2xl font-bold text-slate-800">{formatMoney(summary.totalDue || 0, currency, currencySymbol)}</span>
                  </div>
                  <div className="text-sm font-medium text-slate-500 mt-1">
                    Outstanding
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.75fr]">
                <Card className="space-y-4 p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-[var(--text-main)]">Client snapshot</h3>
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Quick details</span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Primary contact</p>
                      <p className="mt-2 text-sm font-semibold text-[var(--text-main)]">{ownerName}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Email</p>
                      <p className="mt-2 break-all text-sm font-semibold text-[var(--text-main)]">{client.email || '-'}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Phone</p>
                      <p className="mt-2 text-sm font-semibold text-[var(--text-main)]">{formatPhoneDisplay(client.mobile)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Address</p>
                      <p className="mt-2 whitespace-pre-line text-sm font-semibold text-[var(--text-main)]">{addressLine || '-'}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Labels</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {labels.length ? labels.map((label) => {
                          const color = labelOptions.find((item) => item.label === label)?.color || '#2563eb';
                          return <span key={label}>{renderTag(label, color)}</span>;
                        }) : <span className="text-sm text-[var(--text-muted)]">-</span>}
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="space-y-4 p-5">
                  <h3 className="text-lg font-bold text-[var(--text-main)]">Financial snapshot</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <span className="text-[var(--text-muted)]">Total projects</span>
                      <span className="font-semibold text-[var(--text-main)]">{summary.totalProjects || 0}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <span className="text-[var(--text-muted)]">AMC active</span>
                      <span className="font-semibold text-[var(--text-main)]">{summary.amcActive || 0}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <span className="text-[var(--text-muted)]">Pending renewals</span>
                      <span className="font-semibold text-[var(--text-main)]">{summary.pendingRenewals || 0}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <span className="text-[var(--text-muted)]">Profit / loss</span>
                      <span className={cn('font-semibold', (summary.totalProfitLoss || 0) >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                        {formatMoney(summary.totalProfitLoss || 0, currency, currencySymbol)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <span className="text-[var(--text-muted)]">Activities</span>
                      <span className="font-semibold text-[var(--text-main)]">{summary.activitiesCount || activityItems.length}</span>
                    </div>
                  </div>
                </Card>

                <Card className="space-y-4 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-[var(--text-main)]">Pipeline stage</h3>
                      <p className="text-sm text-slate-500">Current stage and recent milestones</p>
                    </div>
                    {renderStatusPill(client.status)}
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-[var(--text-muted)]">Progress</span>
                      <span className="font-semibold text-[var(--text-main)]">{stageProgress}%</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-[var(--primary)]"
                        style={{ width: `${stageProgress}%` }}
                      />
                    </div>
                    {clientPipelineStages.length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {clientPipelineStages.map((stage, index) => {
                          const active = stage.label === client.status;
                          const done = index < currentStageIndex;
                          const color = stage.color || '#64748b';
                          return (
                            <span
                              key={stage.label}
                              className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
                              style={{
                                backgroundColor: active || done ? `${color}18` : '#ffffff',
                                color: active || done ? color : '#64748b',
                                borderColor: active || done ? `${color}33` : '#e2e8f0'
                              }}
                            >
                              {index + 1}. {stage.label}
                            </span>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4">
                    {recentClientEvents.length ? (
                      <div className="relative pl-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200 space-y-4">
                        {recentClientEvents.map((item, index) => {
                          const accent = item.color || getActivityAccent(item);
                          return (
                            <div key={`${item.date}-${item.title}-${index}`} className="relative group">
                              <div className="absolute -left-[30px] top-1.5 flex h-[14px] w-[14px] items-center justify-center rounded-full border-2 border-white bg-slate-200 group-hover:scale-125 transition-transform" style={{ backgroundColor: accent }} />
                              <div className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm" style={{ color: accent, backgroundColor: `${accent}15` }}>
                                    {item.kind || 'activity'}
                                  </span>
                                  <span className="text-xs font-semibold tracking-wider text-slate-400">{formatDate(item.date)}</span>
                                </div>
                                <h4 className="text-sm font-bold text-slate-800">{item.title}</h4>
                                {item.detail && <p className="mt-1 text-xs text-slate-600 line-clamp-2 leading-relaxed">{item.detail}</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                        No recent stage activity yet.
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              <ActivitySection
                title="Client actions"
                description="Tasks, notes, reminders, and events for this client"
                items={activityItems.slice(0, 6)}
                accent="#2563eb"
                emptyText="No activities yet."
                onAdd={() => setActivityType('task')}
                onEdit={(item) => {
                  setActivityEdit(item);
                  setActivityType(item.type || 'note');
                }}
                onDelete={deleteClientActivity}
                actionLabel="activity"
              />
            </>
          )}

          {activeTab === 'timeline' && (
            <div className="w-full space-y-6 mt-2">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Timeline</h2>
                  <p className="text-sm text-slate-500 mt-1">Follow-ups, changes, and activity history</p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {mergedTimeline.length} Events
                </div>
              </div>
              
              {mergedTimeline.length ? (
                <div className="relative pl-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200 space-y-6">
                  {mergedTimeline.map((item, index) => {
                    const accent = item.color || getActivityAccent(item);
                    return (
                      <div key={`${item.date}-${item.title}-${index}`} className="relative group">
                        <div className="absolute -left-[30px] top-1.5 flex h-[14px] w-[14px] items-center justify-center rounded-full border-2 border-white bg-slate-200 group-hover:scale-125 transition-transform" style={{ backgroundColor: accent }}></div>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm" style={{ color: accent, backgroundColor: `${accent}15` }}>
                              {item.kind || 'activity'}
                            </span>
                            <span className="text-xs font-semibold tracking-wider text-slate-400">{formatDate(item.date)}</span>
                            {item.actorName ? (
                              <span className="text-xs font-medium text-slate-500">by {item.actorName}</span>
                            ) : null}
                          </div>
                          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                            <h4 className="text-sm font-bold text-slate-800">{item.title}</h4>
                            {item.detail && <p className="mt-1 text-sm text-slate-600 leading-relaxed">{item.detail}</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-[var(--text-muted)]">
                  No timeline items yet.
                </div>
              )}
            </div>
          )}

          {activeTab === 'contacts' && (
            <Card className="space-y-4 p-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-main)]">Contacts</h3>
                  <p className="text-sm text-slate-500">{contacts.length} contact(s)</p>
                </div>
                <Button variant="secondary" onClick={() => { setContactEdit(null); setContactOpen(true); }}>
                  <UserPlus size={16} />
                  Add contact
                </Button>
              </div>

              {primaryContact ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Primary contact</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--text-main)]">
                      {`${primaryContact.firstName || ''} ${primaryContact.lastName || ''}`.trim() || '-'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{primaryContact.jobTitle || 'Contact'}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Email</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--text-main)]">{primaryContact.email || '-'}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Phone</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--text-main)]">{formatPhoneDisplay(primaryContact.phone)}</p>
                  </div>
                </div>
              ) : null}

              <div className="space-y-3">
                {contacts.length ? contacts.map((contact, index) => {
                  const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Contact';
                  const initials = [contact.firstName?.[0], contact.lastName?.[0]].filter(Boolean).join('').toUpperCase() || 'C';
                  const isPrimary = Boolean(contact.isPrimary) || (!primaryContact && index === 0);
                  return (
                    <div key={contact.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[color-mix(in_srgb,var(--primary)_30%,#dbeafe)] hover:shadow-md">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex min-w-0 flex-1 items-start gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-sm font-bold text-[var(--primary)]">
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-base font-bold text-[var(--text-main)]">{fullName}</div>
                              {isPrimary ? (
                                <span className="rounded-full bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                                  Primary contact
                                </span>
                              ) : null}
                            </div>
                            <div className="text-sm text-slate-500">{contact.jobTitle || 'Contact'}</div>
                            <div className="mt-2 space-y-1 text-sm text-slate-600">
                              {contact.email ? (
                                <div className="flex items-center gap-2">
                                  <Mail size={14} />
                                  <span className="break-all">{contact.email}</span>
                                </div>
                              ) : null}
                              {contact.phone ? (
                                <div className="flex items-center gap-2">
                                  <Phone size={14} />
                                  <span>{formatPhoneDisplay(contact.phone)}</span>
                                </div>
                              ) : null}
                              {contact.notes ? <div className="text-xs text-slate-500">{contact.notes}</div> : null}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 self-start md:self-auto">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit contact"
                            onClick={() => {
                              setContactEdit(contact);
                              setContactOpen(true);
                            }}
                          >
                            <Pencil size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete contact"
                            className="text-red-500 hover:bg-red-50 hover:text-red-600"
                            onClick={() => setContactDeleteTarget(contact)}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                    No contacts added yet.
                  </div>
                )}
              </div>
            </Card>
          )}

          {activeTab === 'tasks' && (
            <ActivitySection
              title="Tasks"
              description="Follow-up work for the client"
              items={taskItems}
              accent="#0ea5e9"
              emptyText="No tasks yet."
              onAdd={() => setActivityType('task')}
              onEdit={(item) => { setActivityEdit(item); setActivityType('task'); }}
              onDelete={deleteClientActivity}
            />
          )}

          {activeTab === 'notes' && (
            <ActivitySection
              title="Notes"
              description="Internal notes and context"
              items={noteItems}
              accent="#8b5cf6"
              emptyText="No notes yet."
              onAdd={() => setActivityType('note')}
              onEdit={(item) => { setActivityEdit(item); setActivityType('note'); }}
              onDelete={deleteClientActivity}
            />
          )}

          {activeTab === 'reminders' && (
            <ActivitySection
              title="Reminders"
              description="Time-based follow ups"
              items={reminderItems}
              accent="#f59e0b"
              emptyText="No reminders yet."
              onAdd={() => setActivityType('reminder')}
              onEdit={(item) => { setActivityEdit(item); setActivityType('reminder'); }}
              onDelete={deleteClientActivity}
            />
          )}

          {activeTab === 'events' && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.08fr)_320px]">
              <CalendarPanel
                events={eventItems}
                view={calendarView}
                currentDate={calendarDate}
                onViewChange={setCalendarView}
                onDateChange={setCalendarDate}
                onEditEvent={(item) => {
                  setActivityEdit(item);
                  setActivityType(item.type || 'event');
                }}
                onDeleteEvent={(item) => setActivityDeleteTarget(item)}
                onAddTask={() => setActivityType('task')}
                onAddNote={() => setActivityType('note')}
                onAddReminder={() => setActivityType('reminder')}
                onAddEvent={() => setActivityType('event')}
              />
              <EventFeedPanel
                selectedDate={calendarDate}
                selectedDateLabel={getCalendarTitle(calendarDate, 'day')}
                selectedDateEvents={eventItems.filter((item) => sameDay(getActivityDate(item), calendarDate))}
                events={eventItems}
                onEditEvent={(item) => {
                  setActivityEdit(item);
                  setActivityType(item.type || 'event');
                }}
                onDeleteEvent={(item) => setActivityDeleteTarget(item)}
                subtitle="Client events in the current calendar."
                emptyText="No client events available."
              />
            </div>
          )}

          {activeTab === 'projects' && (
            <Card className="p-5">
              <DataTable
                columns={[
                  { key: 'title', label: 'Project Name' },
                  { key: 'projectType', label: 'Type' },
                  { key: 'deadline', label: 'Deadline', type: 'date' },
                  { key: 'status', label: 'Status', type: 'badge' },
                  { key: 'value', label: 'Value', type: 'money', align: 'right' }
                ]}
                rows={projects}
                selectable={false}
              />
            </Card>
          )}

          {activeTab === 'invoices' && (
            <Card className="p-5">
              <DataTable
                columns={[
                  { key: 'invoiceNumber', label: 'Invoice #' },
                  { key: 'invoiceDate', label: 'Date', type: 'date' },
                  { key: 'status', label: 'Status', type: 'badge' },
                  { key: 'totalAmount', label: 'Amount', type: 'money', align: 'right' }
                ]}
                rows={invoices}
                selectable={false}
              />
            </Card>
          )}

          {activeTab === 'payments' && (
            <Card className="p-5">
              <DataTable
                columns={[
                  { key: 'paymentDate', label: 'Date', type: 'date' },
                  { key: 'paymentMode', label: 'Mode' },
                  { key: 'transactionId', label: 'Transaction ID' },
                  { key: 'amountReceived', label: 'Amount Received', type: 'money', align: 'right' }
                ]}
                rows={payments}
                selectable={false}
              />
            </Card>
          )}

          {activeTab === 'amcs' && (
            <Card className="p-5">
              <DataTable
                columns={[
                  { key: 'title', label: 'Title', render: (row) => row.title || row.amcType || 'AMC' },
                  { key: 'startDate', label: 'Start Date', type: 'date' },
                  { key: 'endDate', label: 'End Date', type: 'date' },
                  { key: 'status', label: 'Status', type: 'badge' },
                  { key: 'amcAmount', label: 'Amount', type: 'money', align: 'right' }
                ]}
                rows={amcs}
                selectable={false}
              />
            </Card>
          )}

          {activeTab === 'renewals' && (
            <Card className="p-5">
              <DataTable
                columns={[
                  { key: 'title', label: 'Title' },
                  { key: 'purchaseDate', label: 'Purchase Date', type: 'date' },
                  { key: 'renewalDate', label: 'Renewal Date', type: 'date' },
                  { key: 'status', label: 'Status', type: 'badge' },
                  { key: 'amount', label: 'Amount', type: 'money', align: 'right' }
                ]}
                rows={renewals}
                selectable={false}
              />
            </Card>
          )}

          {activeTab === 'files' && (
            <Card className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-main)]">Files</h3>
                  <p className="text-sm text-slate-500">{files.length} file(s)</p>
                </div>
                <Button variant="secondary" onClick={() => setFilesModalOpen(true)}>
                  <Paperclip size={16} className="mr-2" />
                  Add File
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {files.length ? files.map((file) => (
                  <a
                    key={file.id}
                    href={file.driveWebViewLink || `#${file.id}`}
                    target={file.driveWebViewLink ? '_blank' : undefined}
                    rel={file.driveWebViewLink ? 'noreferrer' : undefined}
                    className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-[var(--primary)] hover:shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                        <Paperclip size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--text-main)]">{file.title || file.originalName || file.name || 'File'}</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          {file.moduleName || 'clients'} {file.entityId ? `#${file.entityId}` : ''}
                        </p>
                        {file.description ? <p className="mt-1 line-clamp-2 text-xs text-slate-500">{file.description}</p> : null}
                        <p className="mt-2 text-xs text-[var(--text-muted)]">{formatDate(file.createdAt)}</p>
                      </div>
                    </div>
                  </a>
                )) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-[var(--text-muted)]">
                    No files uploaded for this client yet.
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="p-0 border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-slate-800" />
                <h2 className="text-lg font-semibold text-slate-900">Client info</h2>
              </div>
              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 text-slate-500">
                <MoreHorizontal size={18} />
              </button>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-3.5">
                <Hexagon size={16} className="text-slate-500 shrink-0" />
                <span className="text-sm text-slate-700">{client.clientType || client.type || 'Organization'}</span>
              </div>
              <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-3.5">
                <CheckCircle size={16} className="text-slate-500 shrink-0" />
                {renderStatusPill(client.status)}
              </div>
              <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-3.5">
                <Search size={16} className="text-slate-500 shrink-0" />
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-600">
                  {client.source || 'Site'}
                </span>
              </div>
              <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-3.5">
                <Tag size={16} className="text-slate-500 shrink-0" />
                <div className="flex flex-wrap gap-1.5 items-center">
                  {labels.length ? labels.map((label) => {
                    const color = labelOptions.find((item) => item.label === label)?.color || '#2563eb';
                    return <span key={label}>{renderTag(label, color)}</span>;
                  }) : <span className="text-sm text-[var(--text-muted)]">-</span>}
                </div>
              </div>
              <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-3.5">
                <User size={16} className="text-slate-500 shrink-0" />
                <div className="flex items-center gap-2">
                  <UserAvatar name={ownerName} className="h-6 w-6" fallbackSize={24} />
                  <span className="text-sm text-[var(--primary)] font-medium">{ownerName}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-3.5">
                <Users size={16} className="text-slate-500 shrink-0" />
                <button type="button" className="text-sm text-[var(--primary)] font-medium hover:underline">Add Managers</button>
              </div>
              <div className="flex items-start gap-4 border-b border-slate-100 px-5 py-3.5">
                <MapPin size={16} className="text-slate-500 shrink-0 mt-0.5" />
                <div className="text-sm text-slate-700">
                  {client.billingAddress && <div>{client.billingAddress}</div>}
                  {(client.city || client.state) && <div>{[client.city, client.state].filter(Boolean).join(', ')}</div>}
                  {client.country && <div>{client.country}</div>}
                  {(!client.billingAddress && !client.city && !client.state && !client.country) && <span>-</span>}
                </div>
              </div>
              <div className="flex items-center gap-4 px-5 py-3.5">
                <Phone size={16} className="text-slate-500 shrink-0" />
                <span className="text-sm text-slate-700">{formatPhoneDisplay(client.mobile) || '-'}</span>
              </div>
            </div>
          </Card>
          
          <Card className="p-0 border-slate-200">
            <div className="border-b border-slate-100 px-5 py-3">
              <h3 className="text-sm font-semibold text-slate-800">Additional Details</h3>
            </div>
            <div className="flex flex-col px-5 py-2">
              <div className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-0">
                <span className="text-xs font-medium uppercase tracking-[0.1em] text-slate-400">Email</span>
                <span className="text-sm text-slate-700">{client.email || '-'}</span>
              </div>
              <div className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-0">
                <span className="text-xs font-medium uppercase tracking-[0.1em] text-slate-400">Value</span>
                <span className="text-sm text-slate-700">
                  {formatMoney(client.openingBalance || 0, currency, currencySymbol)}
                </span>
              </div>
              {client.website ? (
                <div className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-0">
                  <span className="text-xs font-medium uppercase tracking-[0.1em] text-slate-400">Website</span>
                  <a href={client.website.startsWith('http') ? client.website : `https://${client.website}`} target="_blank" rel="noreferrer" className="text-sm text-[var(--primary)] hover:underline">
                    {client.website}
                  </a>
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
              <Globe size={18} className="text-slate-800" />
              <h2 className="text-lg font-semibold text-slate-900">Contact card</h2>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <User size={16} className="text-slate-500" />
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Owner</div>
                  <div className="text-sm font-semibold text-slate-900">{ownerName}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <Phone size={16} className="text-slate-500" />
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Phone</div>
                  <div className="text-sm font-semibold text-slate-900">{formatPhoneDisplay(client.mobile)}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <Mail size={16} className="text-slate-500" />
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Email</div>
                  <div className="truncate text-sm font-semibold text-slate-900">{client.email || '-'}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <MapPin size={16} className="text-slate-500" />
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Address</div>
                  <div className="text-sm font-semibold text-slate-900">{addressLine || '-'}</div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <ClientFormModal
        open={editOpen}
        clientId={id}
        initialData={client}
        onClose={() => setEditOpen(false)}
        onSuccess={() => setRefreshTick((current) => current + 1)}
      />

      <ContactModal
        open={contactOpen}
        clientId={id}
        initialValue={contactEdit}
        onClose={() => {
          setContactOpen(false);
          setContactEdit(null);
        }}
        onSave={saveClientContact}
        busy={contactBusy}
      />

      <ConfirmModal
        open={Boolean(contactDeleteTarget)}
        title="Delete contact?"
        description={`Remove ${contactDeleteTarget ? `${contactDeleteTarget.firstName || ''} ${contactDeleteTarget.lastName || ''}`.trim() || 'this contact' : 'this contact'} from the client.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        isLoading={contactDeleteBusy}
        onCancel={() => setContactDeleteTarget(null)}
        onConfirm={deleteClientContact}
      />

      <ActivityComposerModal
        open={Boolean(activityType)}
        mode={activityType || 'note'}
        initialValue={activityEdit}
        onClose={() => { setActivityType(null); setActivityEdit(null); }}
        onSave={saveClientActivity}
        busy={activityBusy}
        labelOptions={labelOptions}
        userOptions={userOptions}
        token={token}
        uploadModule="clients"
        uploadEntityId={id}
      />

      <FileComposerModal
        open={filesModalOpen}
        onClose={() => setFilesModalOpen(false)}
        title="Add File"
        subtitle="Upload a file for this client"
        settings={settings}
        uploadModule="clients"
        uploadEntityId={id}
        onSave={async () => {
          await load();
          setFilesModalOpen(false);
        }}
      />
    </div>
  );
}
