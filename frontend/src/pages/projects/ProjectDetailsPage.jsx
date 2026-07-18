import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Activity,
  Briefcase,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  FolderOpen,
  Mail,
  Paperclip,
  Pencil,
  Phone,
  UserPlus,
  Tag,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
  CheckCircle2,
  Layers,
  MoreHorizontal,
  Hexagon,
  CheckCircle,
  Building,
  User,
  DollarSign,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { PageLoader } from '../../components/ui/Loader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Input, Textarea } from '../../components/ui/Input';
import { SearchableSelect } from '../../components/forms/SearchableSelect';
import { AttachmentPicker } from '../../components/ui/AttachmentPicker';
import { cn } from '../../lib/cn';
import { normalizeSharedLabels, mergeSharedLabelOptions } from '../../lib/labels';
import { formatDateOnlyDisplay, formatDateOnlyInput, isSameDateOnly, toDateOnlyKey } from '../../lib/dateOnly';
import { EventFeedPanel } from '../../components/events/EventFeedPanel';
import { ProjectFormModal } from './ProjectFormModal';
import { ProjectFileModal } from './ProjectFileModal';

const ACTIVITY_COLORS = ['#2563eb', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#14b8a6', '#ec4899', '#6366f1'];

function createLocalId(prefix = 'project-activity') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDateInput(value) {
  return formatDateOnlyInput(value);
}

function formatPhoneDisplay(value) {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  if (raw.startsWith('+')) return raw;
  const digits = raw.replace(/\D/g, '');
  return digits ? `+${digits}` : raw;
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

function formatMoney(value) {
  const amount = Number(value || 0);
  return amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

function getProjectProgressSeries(events = [], months = 6) {
  const today = new Date();
  const buckets = [];

  for (let index = months - 1; index >= 0; index -= 1) {
    const bucketDate = new Date(today.getFullYear(), today.getMonth() - index, 1);
    buckets.push({
      key: `${bucketDate.getFullYear()}-${String(bucketDate.getMonth() + 1).padStart(2, '0')}`,
      label: bucketDate.toLocaleDateString('en-IN', { month: 'short' }),
      detail: bucketDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      raw: 0
    });
  }

  const weights = {
    created: 16,
    updated: 10,
    task: 14,
    note: 6,
    reminder: 8,
    event: 12,
    invoice: 10,
    expense: 6,
    attachment: 4,
    file: 4
  };

  events.forEach((event) => {
    const date = new Date(getActivityDate(event));
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const bucket = buckets.find((item) => item.key === key);
    if (!bucket) return;
    const kind = String(event.kind || event.type || '').toLowerCase();
    bucket.raw += weights[kind] || 5;
  });

  let cumulative = 0;
  const withCumulative = buckets.map((bucket) => {
    cumulative += bucket.raw;
    return { ...bucket, cumulative };
  });
  const max = Math.max(...withCumulative.map((item) => item.cumulative), 1);

  return withCumulative.map((item) => ({
    ...item,
    value: Math.round((item.cumulative / max) * 100)
  }));
}

function ProgressTrendChart({ series = [] }) {
  const width = 720;
  const height = 240;
  const paddingX = 32;
  const paddingY = 24;
  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingY * 2;
  const maxValue = 100;
  const minValue = 0;
  const stepX = series.length > 1 ? plotWidth / (series.length - 1) : 0;
  const xAt = (index) => paddingX + stepX * index;
  const yAt = (value) => height - paddingY - ((value - minValue) / (maxValue - minValue || 1)) * plotHeight;
  const points = series.map((item, index) => `${xAt(index)},${yAt(item.value)}`).join(' ');
  const linePath = series.length ? series.map((item, index) => `${index === 0 ? 'M' : 'L'} ${xAt(index)} ${yAt(item.value)}`).join(' ') : '';
  const areaPath = series.length
    ? `${linePath} L ${xAt(series.length - 1)} ${height - paddingY} L ${xAt(0)} ${height - paddingY} Z`
    : '';

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h4 className="text-lg font-bold text-[var(--text-main)]">Progress trend</h4>
          <p className="text-sm text-slate-500">Cumulative project activity score over recent months.</p>
        </div>
        <TrendingUp size={18} className="text-[var(--primary)]" />
      </div>
      <div className="p-4">
        {series.length ? (
          <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full">
            <defs>
              <linearGradient id="project-progress-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 25, 50, 75, 100].map((tick) => (
              <g key={tick}>
                <line
                  x1={paddingX}
                  y1={yAt(tick)}
                  x2={width - paddingX}
                  y2={yAt(tick)}
                  stroke="#e2e8f0"
                  strokeDasharray={tick === 0 ? '0' : '6 6'}
                />
                <text x={8} y={yAt(tick) + 4} fill="#94a3b8" fontSize="10" fontWeight="600">
                  {tick}
                </text>
              </g>
            ))}
            <path d={areaPath} fill="url(#project-progress-area)" />
            <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            {series.map((item, index) => (
              <g key={item.key || item.label}>
                <circle cx={xAt(index)} cy={yAt(item.value)} r="5.5" fill="white" stroke="var(--primary)" strokeWidth="3" />
                <text x={xAt(index)} y={height - 4} textAnchor="middle" fill="#64748b" fontSize="11" fontWeight="600">
                  {item.label}
                </text>
              </g>
            ))}
          </svg>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Not enough project activity yet to build a trend chart.
          </div>
        )}
      </div>
      {series.length ? (
        <div className="grid gap-3 border-t border-slate-100 px-5 py-4 sm:grid-cols-3">
          {series.slice(-3).map((item) => (
            <div key={item.key} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{item.detail}</div>
              <div className="mt-2 text-2xl font-bold text-[var(--text-main)]">{item.value}%</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
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
      return {
        id: String(item.id || createLocalId(type)),
        type,
        title: String(item.title || '').trim(),
        description: String(item.description || '').trim(),
        labels: parseListValue(item.labels),
        color: item.color || ACTIVITY_COLORS[0],
        attachments: parseAttachments(item.attachments),
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
        date: formatDateInput(item.date || item.reminderDate || item.startDate || item.deadline || item.createdAt),
        time: item.time || item.startTime || '',
        location: item.location || '',
        endDate: formatDateInput(item.endDate),
        endTime: item.endTime || '',
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
        createdByName: item.createdByName || item.actorName || 'System'
      };
    })
    .filter(Boolean);
}

function normalizeActivityColor(activity) {
  if (activity?.color) return activity.color;
  const kind = String(activity?.type || '').toLowerCase();
  if (kind === 'task') return '#0ea5e9';
  if (kind === 'note') return '#8b5cf6';
  if (kind === 'reminder') return '#f59e0b';
  if (kind === 'event') return '#10b981';
  return '#64748b';
}

function getActivityKindLabel(kind = '') {
  const lower = String(kind || '').toLowerCase();
  return {
    task: 'Task',
    note: 'Note',
    reminder: 'Reminder',
    event: 'Event',
    file: 'File'
  }[lower] || 'Activity';
}

function getActivityDate(activity) {
  return activity?.startDate || activity?.date || activity?.deadline || activity?.createdAt || activity?.updatedAt || '';
}

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function startOfWeek(date) {
  const result = startOfDay(date);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

function endOfWeek(date) {
  const result = startOfWeek(date);
  result.setDate(result.getDate() + 6);
  return endOfDay(result);
}

function startOfMonth(date) {
  const result = startOfDay(date);
  result.setDate(1);
  return result;
}

function endOfMonth(date) {
  const result = startOfMonth(date);
  result.setMonth(result.getMonth() + 1);
  result.setDate(0);
  return endOfDay(result);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function isSameDay(left, right) {
  return isSameDateOnly(left, right);
}

function formatCalendarTitle(date, view) {
  if (view === 'week') {
    const start = startOfWeek(date);
    const end = endOfWeek(date);
    return `${start.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  if (view === 'day') {
    return date.toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function getCalendarCells(date) {
  const firstDay = startOfMonth(date);
  const gridStart = startOfWeek(firstDay);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function getActivitiesForDate(events, date) {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  return events.filter((event) => {
    const start = startOfDay(parseDateOnly(getActivityDate(event)) || date);
    const end = endOfDay(parseDateOnly(event.endDate || event.deadline || event.date) || start);
    return start <= dayEnd && end >= dayStart;
  }).sort((a, b) => String(getActivityDate(b)).localeCompare(String(getActivityDate(a))));
}

function getGroupedEvents(events) {
  const map = new Map();
  events.forEach((event) => {
    const key = toDateOnlyKey(getActivityDate(event));
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(event);
  });

  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, items }));
}

function parseDateOnly(value) {
  const raw = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [year, month, day] = raw.split('-').map((item) => Number(item));
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function renderLabelPill(label, color) {
  const badgeColor = color || '#2563eb';
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
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

function renderStatusPill(value) {
  const color = value === 'Completed'
    ? '#10b981'
    : value === 'In Progress'
      ? '#3b82f6'
      : value === 'On Hold'
        ? '#f59e0b'
        : value === 'Cancelled'
          ? '#ef4444'
          : '#64748b';

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

function getProgressValue(project = {}) {
  const explicit = Number(project.progressPercent ?? project.progress ?? 0);
  if (Number.isFinite(explicit) && explicit > 0) return Math.max(0, Math.min(100, explicit));
  const status = String(project.status || '').toLowerCase();
  if (status === 'completed') return 100;
  if (status === 'in progress') return 55;
  if (status === 'on hold') return 25;
  return 0;
}

function ActivityCard({ item, onEdit, onDelete }) {
  const accent = normalizeActivityColor(item);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{ backgroundColor: `${accent}18`, color: accent }}
            >
              {item.kind || 'activity'}
            </span>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{formatDate(getActivityDate(item))}</div>
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-900">{item.title || 'Untitled'}</div>
          <div className="text-sm text-slate-600">{item.detail || 'No description'}</div>
        </div>
        <div className="flex items-center gap-2">
          {onEdit ? (
            <button
              type="button"
              onClick={() => onEdit(item)}
              className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label="Edit activity"
            >
              <Pencil size={16} />
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(item)}
              className="rounded-full p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
              aria-label="Delete activity"
            >
              <Trash2 size={16} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ActivitySection({ title, description, items, emptyText, onAdd, onEdit, onDelete, actionLabel }) {
  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-lg font-bold text-[var(--text-main)]">{title}</h3>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
        <Button variant="secondary" onClick={onAdd}>
          <CalendarPlus size={16} className="mr-2" />
          Add {actionLabel || 'activity'}
        </Button>
      </div>

      <div className="space-y-3">
        {items.length ? (
          items.map((item, index) => (
            <ActivityCard
              key={item.id || `${title}-${index}`}
              item={item}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
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
        repeat: false
      },
      event: {
        ...common,
        startDate: formatDateInput(new Date()),
        startTime: '',
        endDate: formatDateInput(new Date()),
        endTime: '',
        location: '',
        visibility: 'all_team',
        allowedUserIds: [],
        allowedTeamIds: []
      }
    };

    const source = initialValue || {};
    setFormData({
      ...base[mode],
      ...source,
      labels: parseListValue(source.labels),
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
      date: formatDateInput(source.date || source.reminderDate || source.startDate || source.deadline),
      time: source.time || source.startTime || '',
      repeat: Boolean(source.repeat),
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
    });
  }, [initialValue, mode, open]);

  const set = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }));

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

  async function handleSubmit(event) {
    event?.preventDefault?.();
    if (!formData?.title?.trim()) {
      toast.error('Title is required');
      return;
    }

    await onSave({
      ...formData,
      type: mode,
      attachments: parseAttachments(formData.attachments),
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
            ? 'Capture a project note with labels and color.'
            : mode === 'reminder'
              ? 'Set a reminder for this project.'
              : 'Schedule a project event.'}
        width="min(980px, 96vw)"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <Input value={formData.title} onChange={(e) => set('title', e.target.value)} placeholder="Title" />

              {mode === 'reminder' ? null : (
                <>
                  <Textarea value={formData.description} onChange={(e) => set('description', e.target.value)} placeholder="Description..." rows={mode === 'event' ? 5 : 7} />
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
                    onRemoveFile={(driveFileId) => set('attachments', (formData.attachments || []).filter((item) => String(item.driveFileId || item.id) !== String(driveFileId)))}
                  />
                </>
              )}
            </div>

            <div className="space-y-3">
              {mode === 'task' ? (
                <>
                  <SearchableSelect value={formData.points} onChange={(val) => set('points', val)} options={pointsOptions} placeholder="Points" />
                  <SearchableSelect value={formData.assignedTo} onChange={(val) => set('assignedTo', val)} options={userOptions} placeholder="Assign to" />
                  <SearchableSelect value={formData.collaborators} onChange={(val) => set('collaborators', val)} options={userOptions} placeholder="Collaborators" multiple searchPlaceholder="Search teammates..." />
                  <SearchableSelect value={formData.status} onChange={(val) => set('status', val)} options={taskStatusOptions} placeholder="Status" />
                  <SearchableSelect value={formData.priority} onChange={(val) => set('priority', val)} options={taskPriorityOptions} placeholder="Priority" />
                  <Input type="date" value={formData.startDate} onChange={(e) => set('startDate', e.target.value)} />
                  <Input type="date" value={formData.deadline} onChange={(e) => set('deadline', e.target.value)} />
                  <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                    <input type="checkbox" checked={Boolean(formData.recurring)} onChange={(e) => set('recurring', e.target.checked)} />
                    Recurring
                  </label>
                </>
              ) : null}

              {mode === 'note' ? (
                <>
                  <SearchableSelect value={formData.category} onChange={(val) => set('category', val)} options={noteCategoryOptions} placeholder="Category" />
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
                  <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                    <input type="checkbox" checked={Boolean(formData.repeat)} onChange={(e) => set('repeat', e.target.checked)} />
                    Repeat
                  </label>
                </>
              ) : null}

              {mode === 'event' ? (
                <>
                  <Input type="date" value={formData.startDate} onChange={(e) => set('startDate', e.target.value)} />
                  <Input type="time" value={formData.startTime} onChange={(e) => set('startTime', e.target.value)} />
                  <Input type="date" value={formData.endDate} onChange={(e) => set('endDate', e.target.value)} />
                  <Input type="time" value={formData.endTime} onChange={(e) => set('endTime', e.target.value)} />
                  <Input value={formData.location} onChange={(e) => set('location', e.target.value)} placeholder="Location" />
                  <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Share with</div>
                    <div className="flex flex-wrap items-center gap-6 pt-1">
                      {eventVisibilityOptions.map((option) => (
                        <label key={option.value} className="flex cursor-pointer items-center gap-2">
                          <input
                            type="radio"
                            name="project-event-visibility"
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

function ProjectCalendar({ events, view, currentDate, onViewChange, onDateChange, onEditEvent, onDeleteEvent, onAddTask, onAddNote, onAddReminder, onAddEvent }) {
  const monthCells = useMemo(() => getCalendarCells(currentDate), [currentDate]);
  const weekDays = useMemo(() => {
    if (view === 'day') return [new Date(currentDate)];
    const start = startOfWeek(currentDate);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [currentDate, view]);

  const visibleEvents = useMemo(() => getActivitiesForDate(events || [], currentDate), [currentDate, events, view]);

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
          <div className="text-base font-semibold text-slate-900">{formatCalendarTitle(currentDate, view)}</div>
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
              const dayItems = getActivitiesForDate(events, day).slice(0, 3);
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
                    {dayItems.map((item) => {
                      const accent = normalizeActivityColor(item);
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
            const dayItems = getActivitiesForDate(events, day);
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
                        <span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: normalizeActivityColor(item) }} />
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
          {visibleEvents.length ? visibleEvents.map((item) => (
            <ActivityCard key={item.id} item={item} onEdit={onEditEvent} onDelete={onDeleteEvent} />
          )) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              No events in the selected range.
            </div>
          )}
        </div>
      ) : null}
    </Card>
  );
}

export function ProjectDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [settings, setSettings] = useState(null);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [activityType, setActivityType] = useState(null);
  const [activityEdit, setActivityEdit] = useState(null);
  const [activityBusy, setActivityBusy] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState('month');
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [projectFormInitialData, setProjectFormInitialData] = useState(null);
  const [projectFileOpen, setProjectFileOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const [summaryRes, clientsRes, settingsRes, usersRes] = await Promise.allSettled([
          api.resources.get('/projects', `${id}/summary`, token),
          api.resources.list('/clients', token),
          api.settings.get(token),
          api.resources.list('/users', token)
        ]);

        if (!active) return;

        if (summaryRes.status === 'fulfilled') setData(summaryRes.value.data || null);
        else throw summaryRes.reason || new Error('Failed to load project details');

        if (clientsRes.status === 'fulfilled') setClients(clientsRes.value.data || []);
        if (settingsRes.status === 'fulfilled') setSettings(settingsRes.value.data || null);
        if (usersRes.status === 'fulfilled') setUsers(usersRes.value.data || []);
      } catch (error) {
        if (active) {
          toast.error(error.message || 'Failed to load project details');
          navigate('/app/projects');
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

  const project = data?.project || {};
  const client = data?.client || null;
  const clientDisplayName = data?.clientDisplayName || client?.companyName || client?.name || project.clientName || project.client || project.clientId || '-';
  const ownerDisplayName = data?.ownerDisplayName || project.assignedToName || project.ownerName || project.createdByName || '-';
  const summary = data?.summary || {};
  const invoices = data?.invoices || [];
  const expenses = data?.expenses || [];
  const contacts = data?.contacts || [];
  const primaryContact = data?.primaryContact || contacts[0] || null;
  const timeline = data?.timeline || [];

  const projectActivities = useMemo(() => normalizeActivities(project.activities || data?.activities || []), [data?.activities, project.activities]);
  const events = data?.events || [];
  const eventItems = events.filter((item) => String(item.eventType || item.type || '').toLowerCase() === 'event');
  const userLookup = useMemo(() => new Map(users.map((item) => [String(item.id), item.fullName || item.username || item.email || 'System'])), [users]);
  const mergedTimeline = useMemo(() => {
    const source = Array.isArray(timeline) && timeline.length
      ? timeline
      : [
        ...projectActivities.map((activity) => ({
          date: getActivityDate(activity),
          title: activity.title || getActivityKindLabel(activity.type),
          detail: activity.description || activity.category || 'Project activity',
          kind: activity.type,
          actorName: activity.createdByName || user?.fullName || user?.username || 'System',
          color: activity.color || null,
          meta: activity,
          amount: 0
        })),
        ...eventItems.map((event) => ({
          date: event.startDate || event.endDate || event.createdAt,
          title: event.title || 'Event',
          detail: event.description || event.location || 'Project event',
          kind: 'event',
          actorName: userLookup.get(String(event.ownerUserId)) || user?.fullName || user?.username || 'System',
          color: event.color || null,
          meta: event,
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
  }, [eventItems, projectActivities, timeline, userLookup, user?.fullName, user?.username]);

  const labelOptions = useMemo(() => {
    return mergeSharedLabelOptions(normalizeSharedLabels(settings?.labels || []), project.labels || []);
  }, [project.labels, settings]);

  const userOptions = useMemo(() => users.map((item) => ({
    value: item.id,
    label: item.fullName || item.username || item.email || 'User',
    description: [item.username, item.roles?.[0]?.name].filter(Boolean).join(' - ') || 'Team member'
  })), [users]);

  const ownerName = useMemo(() => {
    const owner = userOptions.find((item) => String(item.value) === String(project.assignedTo));
    return owner?.label || project.assignedToName || '-';
  }, [project.assignedTo, project.assignedToName, userOptions]);

  const labels = normalizeSharedLabels(project.labels || []);
  const progressValue = getProgressValue(project);
  const progressSeries = useMemo(() => getProjectProgressSeries(mergedTimeline), [mergedTimeline]);
  const taskItems = projectActivities.filter((item) => item.type === 'task');
  const noteItems = projectActivities.filter((item) => item.type === 'note');
  const reminderItems = projectActivities.filter((item) => item.type === 'reminder');
  const fileItems = projectActivities.flatMap((item) => Array.isArray(item.attachments) ? item.attachments.map((file) => ({ ...file, activityId: item.id, activityTitle: item.title || getActivityKindLabel(item.type) })) : []);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'report', label: `Progress Report (${mergedTimeline.length})`, icon: TrendingUp },
    { id: 'timeline', label: `Timeline (${mergedTimeline.length})`, icon: Clock3 },
    { id: 'contacts', label: `Contacts (${contacts.length})`, icon: Users },
    { id: 'tasks', label: `Tasks (${taskItems.length})`, icon: CalendarPlus },
    { id: 'notes', label: `Notes (${noteItems.length})`, icon: Tag },
    { id: 'reminders', label: `Reminders (${reminderItems.length})`, icon: Clock3 },
    { id: 'calendar', label: `Events (${eventItems.length})`, icon: CalendarDays },
    { id: 'files', label: `Files (${fileItems.length})`, icon: Paperclip },
    { id: 'invoices', label: `Invoices (${invoices.length})`, icon: Wallet },
    { id: 'expenses', label: `Expenses (${expenses.length})`, icon: FolderOpen }
  ];

  async function saveProjectActivity(payload) {
    setActivityBusy(true);
    try {
      const now = new Date().toISOString();
      const type = String(payload.type || activityType || 'note').toLowerCase();
      const editing = Boolean(activityEdit?.id);

      if (type === 'event') {
        const eventPayload = {
          ...payload,
          scopeType: 'project',
          scopeId: id,
          projectId: id,
          leadId: '',
          clientId: '',
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
          const currentActivities = normalizeActivities(project.activities || []);
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
          await api.resources.update('/projects', id, { activities: nextActivities }, token);
        } else {
          await api.resources.create('/events', eventPayload, token);
        }
        api.cache.invalidate('/events');
        api.cache.invalidate('/projects');
      } else {
        const currentActivities = normalizeActivities(project.activities || []);
        const nextActivity = {
          ...payload,
          id: activityEdit?.id || createLocalId(type || 'activity'),
          type,
          title: String(payload.title || '').trim(),
          description: String(payload.description || '').trim(),
          labels: parseListValue(payload.labels),
          attachments: parseAttachments(payload.attachments),
          color: payload.color || ACTIVITY_COLORS[0],
          createdByName: activityEdit?.createdByName || user?.fullName || user?.username || user?.email || 'System',
          createdAt: activityEdit?.createdAt || now,
          updatedAt: now
        };

        const nextActivities = editing
          ? currentActivities.map((item) => (String(item.id) === String(nextActivity.id) ? { ...item, ...nextActivity } : item))
          : [nextActivity, ...currentActivities];

        await api.resources.update('/projects', id, { activities: nextActivities }, token);
      }
      api.cache.invalidate('/projects');
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

  async function deleteProjectActivity(activity) {
    if (!activity) return;
    try {
      if (String(activity.type || activity.eventType || '').toLowerCase() === 'event' && activity.source !== 'legacy') {
        await api.resources.remove('/events', activity.id, token);
        api.cache.invalidate('/events');
      } else {
        const nextActivities = normalizeActivities(project.activities || []).filter((item) => String(item.id) !== String(activity.id));
        await api.resources.update('/projects', id, { activities: nextActivities }, token);
      }
      api.cache.invalidate('/projects');
      toast.success('Activity deleted');
      setRefreshTick((current) => current + 1);
    } catch (error) {
      toast.error(error.message || 'Failed to delete activity');
    }
  }

  async function saveProjectFile(payload) {
    if (!payload?.attachments?.length) return;
    try {
      const currentActivities = normalizeActivities(project.activities || []);
      const fileTitle = String(payload.title || '').trim() || payload.attachments?.[0]?.name || 'Project file';
      const now = new Date().toISOString();

      const nextActivities = [
        {
          id: createLocalId('project-file'),
          type: 'file',
          title: fileTitle,
          description: String(payload.description || '').trim(),
          labels: Array.isArray(payload.labels) ? payload.labels : ['File'],
          attachments: payload.attachments,
          color: '#2563eb',
          createdByName: user?.fullName || user?.username || user?.email || 'System',
          createdAt: now,
          updatedAt: now
        },
        ...currentActivities
      ];

      await api.resources.update('/projects', id, { activities: nextActivities }, token);
      api.cache.invalidate('/projects');
      toast.success('File saved to project');
      setProjectFileOpen(false);
      setRefreshTick((current) => current + 1);
    } catch (error) {
      toast.error(error.message || 'Failed to save file');
    }
  }

  if (loading) return <PageLoader />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/app/projects')}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800"
            >
              <ArrowLeft size={16} />
              Back to Projects
            </button>
            <span className="text-slate-300">/</span>
            <h1 className="text-base font-semibold tracking-tight text-[var(--text-main)]">
              {project.title || 'Project'}
            </h1>
          </div>
          <div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                {project.projectType || 'Project'}
              </span>
              {renderStatusPill(project.status)}
              {labels.slice(0, 4).map((label) => {
                const match = labelOptions.find((item) => item.label === label.label);
                return <span key={label.label}>{renderLabelPill(label.label, match?.color || label.color)}</span>;
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" className="shadow-sm bg-white" onClick={() => {
            setProjectFormInitialData(project);
            setProjectFormOpen(true);
          }}>
            <Pencil size={16} className="mr-2" />
            Edit Project
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
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'inline-flex items-center gap-2 px-1 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap',
                isActive
                  ? 'border-[var(--primary)] text-[var(--primary)]'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900'
              )}
            >
              {Icon && <Icon size={16} className={isActive ? 'text-[var(--primary)]' : 'text-slate-400'} />}
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_380px]">
        <div className="space-y-6">
          {activeTab === 'overview' ? (
            <>
              <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="px-4 py-6 md:px-5 flex items-center gap-4 shadow-sm border border-slate-100 rounded-[16px]">
                  <div className="shrink-0 w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-emerald-50/80 text-emerald-500">
                    <Activity size={24} strokeWidth={2} />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">Total Activities</p>
                    <h3 className="text-lg md:text-xl font-bold text-slate-800 leading-tight truncate">{mergedTimeline.length}</h3>
                    <p className="mt-1 text-xs text-slate-400 truncate">Logged events & calls</p>
                  </div>
                </Card>

                <Card className="px-4 py-6 md:px-5 flex items-center gap-4 shadow-sm border border-slate-100 rounded-[16px]">
                  <div className="shrink-0 w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-purple-50/80 text-purple-500">
                    <CheckCircle2 size={24} strokeWidth={2} />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">Total Tasks</p>
                    <h3 className="text-lg md:text-xl font-bold text-slate-800 leading-tight truncate">{taskItems.length}</h3>
                    <p className="mt-1 text-xs text-slate-400 truncate">Action items</p>
                  </div>
                </Card>

                <Card className="px-4 py-6 md:px-5 flex items-center gap-4 shadow-sm border border-slate-100 rounded-[16px]">
                  <div className="shrink-0 w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-amber-50/80 text-amber-500">
                    <Tag size={24} strokeWidth={2} />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">Total Notes</p>
                    <h3 className="text-lg md:text-xl font-bold text-slate-800 leading-tight truncate">{noteItems.length}</h3>
                    <p className="mt-1 text-xs text-slate-400 truncate">Important remarks</p>
                  </div>
                </Card>

                <Card className="px-4 py-6 md:px-5 flex items-center gap-4 shadow-sm border border-slate-100 rounded-[16px]">
                  <div className="shrink-0 w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-blue-50/80 text-blue-500">
                    <Clock3 size={24} strokeWidth={2} />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">Total Reminders</p>
                    <h3 className="text-lg md:text-xl font-bold text-slate-800 leading-tight truncate">{reminderItems.length}</h3>
                    <p className="mt-1 text-xs text-slate-400 truncate">Upcoming alerts</p>
                  </div>
                </Card>
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="p-0 border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Building size={18} className="text-slate-800" />
                      <h3 className="text-lg font-bold text-[var(--text-main)]">Linked client</h3>
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">CRM links</span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-3.5">
                      <Building size={16} className="text-slate-500 shrink-0" />
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-[var(--text-main)]">{clientDisplayName}</span>
                        <span className="text-xs text-slate-500">{client?.clientType || client?.type || 'Client'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-3.5">
                      <User size={16} className="text-slate-500 shrink-0" />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Owner</span>
                        <span className="text-sm font-medium text-[var(--text-main)]">{ownerDisplayName || ownerName}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 px-5 py-3.5">
                      <Tag size={16} className="text-slate-500 shrink-0" />
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Labels</span>
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {labels.length ? labels.map((label) => {
                            const match = labelOptions.find((item) => item.label === label.label);
                            return <span key={label.label}>{renderLabelPill(label.label, match?.color || label.color)}</span>;
                          }) : <span className="text-sm text-[var(--text-muted)]">-</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="p-0 border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Activity size={18} className="text-slate-800" />
                      <h3 className="text-lg font-bold text-[var(--text-main)]">Activity snapshot</h3>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 size={16} className="text-slate-500 shrink-0" />
                        <span className="text-sm font-medium text-slate-700">Tasks</span>
                      </div>
                      <span className="font-semibold text-slate-900">{summary.tasksCount ?? taskItems.length}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Tag size={16} className="text-slate-500 shrink-0" />
                        <span className="text-sm font-medium text-slate-700">Notes</span>
                      </div>
                      <span className="font-semibold text-slate-900">{summary.notesCount ?? noteItems.length}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Clock3 size={16} className="text-slate-500 shrink-0" />
                        <span className="text-sm font-medium text-slate-700">Reminders</span>
                      </div>
                      <span className="font-semibold text-slate-900">{summary.remindersCount ?? reminderItems.length}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Calendar size={16} className="text-slate-500 shrink-0" />
                        <span className="text-sm font-medium text-slate-700">Events</span>
                      </div>
                      <span className="font-semibold text-slate-900">{summary.eventsCount ?? eventItems.length}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <UserPlus size={16} className="text-slate-500 shrink-0" />
                        <span className="text-sm font-medium text-slate-700">Created by</span>
                      </div>
                      <span className="font-semibold text-slate-900">{project.createdByName || 'System'}</span>
                    </div>
                  </div>
                </Card>
              </div>
            </>
          ) : null}

          {activeTab === 'report' ? (
            <Card className="space-y-5 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-main)]">Progress report</h3>
                  <p className="text-sm text-[var(--text-muted)]">
                    Activity-driven trend view, milestone pacing, and current delivery status.
                  </p>
                </div>
                <span className="rounded-full bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                  {progressValue}% current
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="border border-slate-200 bg-slate-50 p-4 shadow-none">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Progress</div>
                  <div className="mt-2 text-2xl font-bold text-[var(--text-main)]">{progressValue}%</div>
                </Card>
                <Card className="border border-slate-200 bg-slate-50 p-4 shadow-none">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Activities</div>
                  <div className="mt-2 text-2xl font-bold text-[var(--text-main)]">{mergedTimeline.length}</div>
                </Card>
                <Card className="border border-slate-200 bg-slate-50 p-4 shadow-none">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Invoiced</div>
                  <div className="mt-2 text-2xl font-bold text-[var(--text-main)]">{formatMoney(summary.invoiceTotal || 0)}</div>
                </Card>
                <Card className="border border-slate-200 bg-slate-50 p-4 shadow-none">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Expenses</div>
                  <div className="mt-2 text-2xl font-bold text-[var(--text-main)]">{formatMoney(summary.expenseAmount || 0)}</div>
                </Card>
              </div>

              <ProgressTrendChart series={progressSeries} />

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="space-y-4 p-5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-bold text-[var(--text-main)]">Delivery snapshot</h4>
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Project data</span>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <span className="text-slate-500">Client</span>
                      <span className="font-semibold text-[var(--text-main)]">{clientDisplayName}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <span className="text-slate-500">Owner</span>
                      <span className="font-semibold text-[var(--text-main)]">{ownerDisplayName || ownerName}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <span className="text-slate-500">Primary contact</span>
                      <span className="font-semibold text-[var(--text-main)]">
                        {primaryContact ? `${primaryContact.firstName || ''} ${primaryContact.lastName || ''}`.trim() || '-' : '-'}
                      </span>
                    </div>
                    <div className="flex items-start justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <span className="text-slate-500">Labels</span>
                      <div className="flex max-w-[220px] flex-wrap justify-end gap-1.5">
                        {labels.length ? labels.map((label) => {
                          const match = labelOptions.find((item) => item.label === label.label);
                          return <span key={label.label}>{renderLabelPill(label.label, match?.color || label.color)}</span>;
                        }) : <span className="text-[var(--text-muted)]">-</span>}
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="space-y-4 p-5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-bold text-[var(--text-main)]">Latest milestones</h4>
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Recent</span>
                  </div>
                  <div className="mt-4">
                    {mergedTimeline.length ? (
                      <div className="relative pl-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200 space-y-4">
                        {mergedTimeline.slice(0, 5).map((item, index) => {
                          const accent = item.color || normalizeActivityColor(item.meta || item);
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
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-[var(--text-muted)]">
                        No report data yet.
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </Card>
          ) : null}

          {activeTab === 'timeline' ? (
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
                    const accent = item.color || normalizeActivityColor(item.meta || item);
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
          ) : null}

          {activeTab === 'contacts' ? (
            <Card className="space-y-4 p-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-main)]">Contacts</h3>
                  <p className="text-sm text-slate-500">{contacts.length} contact(s)</p>
                </div>
                <Button variant="secondary" onClick={() => navigate(client?.id ? `/app/clients/${client.id}` : '/app/projects')}>
                  <UserPlus size={16} className="mr-2" />
                  View client contacts
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
                    <p className="mt-2 break-all text-sm font-semibold text-[var(--text-main)]">{primaryContact.email || '-'}</p>
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
                    <div key={contact.id || `${fullName}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
                              {contact.source ? <div className="text-xs text-slate-500">{contact.source}</div> : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                    No related contacts found.
                  </div>
                )}
              </div>
            </Card>
          ) : null}

          {activeTab === 'tasks' ? (
            <ActivitySection
              title="Tasks"
              description="Work items assigned to the project."
              items={taskItems}
              emptyText="No tasks yet."
              onAdd={() => setActivityType('task')}
              onEdit={(item) => {
                setActivityEdit(item);
                setActivityType('task');
              }}
              onDelete={deleteProjectActivity}
              actionLabel="task"
            />
          ) : null}

          {activeTab === 'notes' ? (
            <ActivitySection
              title="Notes"
              description="Internal notes and context for the project."
              items={noteItems}
              emptyText="No notes yet."
              onAdd={() => setActivityType('note')}
              onEdit={(item) => {
                setActivityEdit(item);
                setActivityType('note');
              }}
              onDelete={deleteProjectActivity}
              actionLabel="note"
            />
          ) : null}

          {activeTab === 'reminders' ? (
            <ActivitySection
              title="Reminders"
              description="Project follow-ups and private reminders."
              items={reminderItems}
              emptyText="No reminders yet."
              onAdd={() => setActivityType('reminder')}
              onEdit={(item) => {
                setActivityEdit(item);
                setActivityType('reminder');
              }}
              onDelete={deleteProjectActivity}
              actionLabel="reminder"
            />
          ) : null}

          {activeTab === 'calendar' ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.08fr)_320px]">
              <ProjectCalendar
                events={eventItems}
                view={calendarView}
                currentDate={currentDate}
                onViewChange={setCalendarView}
                onDateChange={setCurrentDate}
                onEditEvent={(item) => {
                  setActivityEdit(item);
                  setActivityType(item.type || 'event');
                }}
                onDeleteEvent={(item) => deleteProjectActivity(item)}
                onAddTask={() => setActivityType('task')}
                onAddNote={() => setActivityType('note')}
                onAddReminder={() => setActivityType('reminder')}
                onAddEvent={() => setActivityType('event')}
              />
              <EventFeedPanel
                selectedDate={currentDate}
                selectedDateLabel={formatCalendarTitle(currentDate, 'day')}
                selectedDateEvents={getActivitiesForDate(eventItems, currentDate)}
                events={eventItems}
                onEditEvent={(item) => {
                  setActivityEdit(item);
                  setActivityType(item.type || 'event');
                }}
                onDeleteEvent={(item) => deleteProjectActivity(item)}
                subtitle="Project events in the current calendar."
                emptyText="No project events available."
              />
            </div>
          ) : null}

          {activeTab === 'files' ? (
            <Card className="space-y-4 p-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-main)]">Files</h3>
                  <p className="text-sm text-slate-500">{fileItems.length} file(s)</p>
                </div>
                <Button variant="secondary" onClick={() => setProjectFileOpen(true)}>
                  <Paperclip size={16} className="mr-2" />
                  Add File
                </Button>
              </div>
              {fileItems.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {fileItems.map((file, index) => (
                    <div key={`${file.driveFileId || file.id || index}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900">{file.name}</div>
                          <div className="mt-1 text-xs text-slate-500">{file.activityTitle || 'Attachment'}</div>
                        </div>
                        {file.driveWebViewLink ? (
                          <a href={file.driveWebViewLink} target="_blank" rel="noreferrer" className="text-[var(--primary)] hover:underline">
                            Open
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  No files attached yet. Click Add File to attach project documents.
                </div>
              )}
            </Card>
          ) : null}

          {activeTab === 'invoices' ? (
            <Card className="space-y-4 p-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-main)]">Invoices</h3>
                  <p className="text-sm text-slate-500">{invoices.length} invoice(s)</p>
                </div>
              </div>
              <DataTable
                columns={[
                  { key: 'invoiceNumber', label: 'Invoice #' },
                  { key: 'invoiceDate', label: 'Date', type: 'date' },
                  { key: 'status', label: 'Status', type: 'badge' },
                  { key: 'totalAmount', label: 'Amount', type: 'money', align: 'right' }
                ]}
                rows={invoices || []}
                selectable={false}
              />
            </Card>
          ) : null}

          {activeTab === 'expenses' ? (
            <Card className="p-5">
              <DataTable
                columns={[
                  { key: 'expenseDate', label: 'Date', type: 'date' },
                  { key: 'vendor', label: 'Vendor' },
                  { key: 'totalAmount', label: 'Total', type: 'money', align: 'right' },
                  { key: 'paymentMode', label: 'Payment Mode' }
                ]}
                rows={expenses || []}
                selectable={false}
              />
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card className="p-0 border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-slate-800" />
                <h2 className="text-lg font-semibold text-slate-900">Project info</h2>
              </div>
              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 text-slate-500">
                <MoreHorizontal size={18} />
              </button>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-3.5">
                <Hexagon size={16} className="text-slate-500 shrink-0" />
                <span className="text-sm text-slate-700">{project.projectType || 'Project'}</span>
              </div>
              <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-3.5">
                <CheckCircle size={16} className="text-slate-500 shrink-0" />
                <div className="flex">{renderStatusPill(project.status)}</div>
              </div>
              <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-3.5">
                <Building size={16} className="text-slate-500 shrink-0" />
                <span className="text-sm text-slate-700">{clientDisplayName || '-'}</span>
              </div>
              <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-3.5">
                <User size={16} className="text-slate-500 shrink-0" />
                <span className="text-sm text-slate-700">{ownerDisplayName || ownerName || '-'}</span>
              </div>
              <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-3.5">
                <UserPlus size={16} className="text-slate-500 shrink-0" />
                <span className="text-sm text-slate-700">{project.createdByName || 'System'}</span>
              </div>
              {project.value ? (
                <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-3.5">
                  <DollarSign size={16} className="text-slate-500 shrink-0" />
                  <span className="text-sm text-slate-700">{formatMoney(project.value)}</span>
                </div>
              ) : null}
              {project.startDate ? (
                <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-3.5">
                  <Calendar size={16} className="text-slate-500 shrink-0" />
                  <span className="text-sm text-slate-700">{formatDate(project.startDate)} (Start Date)</span>
                </div>
              ) : null}
              {project.deadline ? (
                <div className="flex items-center gap-4 px-5 py-3.5">
                  <Calendar size={16} className="text-slate-500 shrink-0" />
                  <span className="text-sm text-slate-700">{formatDate(project.deadline)} (Deadline)</span>
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      </div>

      <ActivityComposerModal
        open={Boolean(activityType)}
        mode={activityEdit?.type || activityType || 'note'}
        initialValue={activityEdit}
        onClose={() => {
          setActivityType(null);
          setActivityEdit(null);
        }}
        onSave={saveProjectActivity}
        busy={activityBusy}
        labelOptions={labelOptions}
        userOptions={userOptions}
        uploadModule="projects"
        uploadEntityId={id}
      />

      <ProjectFileModal
        open={projectFileOpen}
        onClose={() => setProjectFileOpen(false)}
        onSave={saveProjectFile}
        settings={settings}
        uploadModule="projects"
        uploadEntityId={id}
      />

      <ProjectFormModal
        open={projectFormOpen}
        onClose={() => {
          setProjectFormOpen(false);
          setProjectFormInitialData(null);
        }}
        onSuccess={() => {
          setProjectFormOpen(false);
          setProjectFormInitialData(null);
          setRefreshTick((current) => current + 1);
        }}
        initialData={projectFormInitialData}
        clients={clients}
        users={users}
        settings={settings}
      />
    </div>
  );
}


