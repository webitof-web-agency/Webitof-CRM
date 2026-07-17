import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Activity, CalendarDays, CalendarPlus, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Edit3, HelpCircle, Mail, MapPin, Mic, Paperclip, Phone, Save, Tag, UserPlus, Users, Wand2, X, Trash2, Layers, MoreHorizontal, Hexagon, CheckCircle, Search, User } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { PageLoader } from '../../components/ui/Loader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { FileComposerModal } from '../../components/ui/FileComposerModal';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { AttachmentPicker } from '../../components/ui/AttachmentPicker';
import { SearchableSelect } from '../../components/forms/SearchableSelect';
import { PhoneInput } from '../../components/forms/PhoneInput';
import { LeadFormModal } from '../../components/forms/LeadFormModal';
import { ConvertLeadModal } from '../../components/forms/ConvertLeadModal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { INDIA_STATE_OPTIONS } from '../../data/indiaLocations';
import { cn } from '../../lib/cn';
import { normalizeSharedLabels, mergeSharedLabelOptions } from '../../lib/labels';
import { formatDateOnlyInput } from '../../lib/dateOnly';
import { EventFormModal } from '../../components/events/EventFormModal';
import { EventFeedPanel } from '../../components/events/EventFeedPanel';
import { normalizeEventAttachment, normalizeEventAttachments } from '../../components/events/eventAttachments';

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

const EMPTY_CONTACT = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  jobTitle: '',
  gender: 'Other',
  notes: ''
};

const EMPTY_EVENT = {
  eventType: 'event',
  title: '',
  description: '',
  startDate: '',
  startTime: '',
  endDate: '',
  endTime: '',
  location: '',
  labels: [],
  color: '#3b82f6',
  attachments: []
};

const EMPTY_NOTE = {
  title: '',
  description: '',
  category: 'General',
  labels: [],
  color: '#3b82f6',
  attachments: []
};

const EMPTY_TASK = {
  title: '',
  description: '',
  points: '1',
  assignedTo: '',
  collaborators: [],
  status: 'To do',
  priority: 'Medium',
  labels: [],
  startDate: '',
  deadline: '',
  recurring: false,
  color: '#0ea5e9',
  attachments: []
};

const EMPTY_REMINDER = {
  title: '',
  date: '',
  time: '',
  repeat: false,
  color: '#f59e0b'
};

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

function normalizeAttachment(file) {
  if (!file || typeof file !== 'object') return null;
  const driveFileId = String(file.driveFileId || file.id || '').trim();
  if (!driveFileId) return null;
  return {
    driveFileId,
    name: file.name || file.originalName || 'File',
    mimeType: file.mimeType || '',
    sizeBytes: Number(file.sizeBytes || file.size || 0) || 0,
    driveWebViewLink: file.driveWebViewLink || file.webViewLink || ''
  };
}

function normalizeAttachmentList(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeAttachment).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? normalizeAttachmentList(parsed) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function ColorSwatches({ value, onChange, colors, size = 'sm' }) {
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={cn(
            size === 'lg' ? 'h-5 w-5' : 'h-4 w-4',
            'rounded-full border transition',
            value === color ? 'ring-2 ring-slate-300 ring-offset-1' : 'border-transparent'
          )}
          style={{ backgroundColor: color }}
          aria-label={`Select color ${color}`}
          title={color}
        />
      ))}
    </div>
  );
}

function AttachmentChips({ attachments = [], onRemove }) {
  if (!attachments.length) return null;
  return (
    <div className="flex flex-wrap gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3">
      {attachments.map((file) => (
        <span
          key={file.driveFileId}
          className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
        >
          <span className="truncate">{file.name}</span>
          {file.driveWebViewLink ? (
            <a
              href={file.driveWebViewLink}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--primary)] hover:underline"
            >
              View
            </a>
          ) : null}
          {onRemove ? (
            <button
              type="button"
              className="text-slate-400 hover:text-rose-500"
              onClick={() => onRemove(file.driveFileId)}
              aria-label={`Remove ${file.name}`}
            >
              ×
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
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

function normalizeUserOptions(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const label = item.fullName || item.username || item.email || item.id;
      if (!label) return null;
      return {
        value: item.id,
        label,
        description: [item.username, item.roles?.[0]?.name].filter(Boolean).join(' • ') || 'Team member'
      };
    })
    .filter(Boolean);
}

function formatPhoneDisplay(value) {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  if (raw.startsWith('+')) return raw;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return raw;
  return `+${digits}`;
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

function formatDate(value) {
  if (!value) return '-';
  return String(value).slice(0, 10);
}

function formatDateInput(value) {
  return formatDateOnlyInput(value);
}

function parseDateOnly(value) {
  const raw = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [year, month, day] = raw.split('-').map((part) => Number(part));
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateOnlyString(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  if (!(left instanceof Date) || !(right instanceof Date)) return false;
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function formatCalendarTitle(date, view) {
  if (view === 'week') {
    const start = startOfWeek(date);
    const end = endOfWeek(date);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  if (view === 'day') {
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatEventTime(event) {
  if (event.startTime && event.endTime) return `${event.startTime} - ${event.endTime}`;
  if (event.startTime) return event.startTime;
  if (event.endTime) return event.endTime;
  return 'All day';
}

function getEventStart(event) {
  return parseDateOnly(event?.startDate || event?.endDate || '');
}

function getEventEnd(event) {
  return parseDateOnly(event?.endDate || event?.startDate || '');
}

function eventOverlapsRange(event, rangeStart, rangeEnd) {
  const start = startOfDay(getEventStart(event) || rangeStart);
  const end = endOfDay(getEventEnd(event) || start);
  return start <= endOfDay(rangeEnd) && end >= startOfDay(rangeStart);
}

function sortEvents(a, b) {
  const aStart = getEventStart(a)?.getTime() || 0;
  const bStart = getEventStart(b)?.getTime() || 0;
  if (aStart !== bStart) return aStart - bStart;
  const aTime = String(a.startTime || a.endTime || '00:00');
  const bTime = String(b.startTime || b.endTime || '00:00');
  if (aTime !== bTime) return aTime.localeCompare(bTime);
  return String(a.title || '').localeCompare(String(b.title || ''));
}

function getEventBadgeColor(event) {
  if (event.color) return event.color;
  if (event.eventType === 'reminder') return '#f59e0b';
  if (event.eventType === 'note') return '#8b5cf6';
  if (event.eventType === 'task') return '#0ea5e9';
  return event.color || '#3b82f6';
}

function getActivityLabel(eventType) {
  if (eventType === 'reminder') return 'Reminder';
  if (eventType === 'note') return 'Note';
  if (eventType === 'task') return 'Task';
  return 'Activity';
}

function getDaysInMonthGrid(date) {
  const firstDay = startOfMonth(date);
  const gridStart = startOfWeek(firstDay);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function getEventsForDate(events, date) {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  return events.filter((event) => {
    const start = startOfDay(getEventStart(event) || date);
    const end = endOfDay(getEventEnd(event) || start);
    return start <= dayEnd && end >= dayStart;
  }).sort(sortEvents);
}

function getGroupedEvents(events) {
  const map = new Map();
  events.forEach((event) => {
    const key = toDateOnlyString(getEventStart(event) || new Date());
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(event);
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({ date, items: items.sort(sortEvents) }));
}

function LeadEventsCalendar({
  events,
  view,
  currentDate,
  onViewChange,
  onDateChange,
  onAddEvent,
  onAddNote,
  onAddReminder,
  onEditEvent,
  onDeleteEvent
}) {
  const today = new Date();
  const monthCells = useMemo(() => getDaysInMonthGrid(currentDate), [currentDate]);
  const visibleRangeEvents = useMemo(() => {
    if (view === 'week') {
      return events.filter((event) => eventOverlapsRange(event, startOfWeek(currentDate), endOfWeek(currentDate))).sort(sortEvents);
    }
    if (view === 'day') {
      return getEventsForDate(events, currentDate);
    }
    return events
      .filter((event) => eventOverlapsRange(event, startOfMonth(currentDate), endOfMonth(currentDate)))
      .sort(sortEvents);
  }, [events, currentDate, view]);
  const selectedDateEvents = useMemo(() => getEventsForDate(visibleRangeEvents, currentDate), [currentDate, visibleRangeEvents]);
  const feedEvents = useMemo(() => visibleRangeEvents.slice(0, 8), [visibleRangeEvents]);
  const selectedDateLabel = formatCalendarTitle(currentDate, 'day');

  function goPrev() {
    if (view === 'week') {
      onDateChange(addDays(currentDate, -7));
      return;
    }
    if (view === 'day') {
      onDateChange(addDays(currentDate, -1));
      return;
    }
    onDateChange(addMonths(currentDate, -1));
  }

  function goNext() {
    if (view === 'week') {
      onDateChange(addDays(currentDate, 7));
      return;
    }
    if (view === 'day') {
      onDateChange(addDays(currentDate, 1));
      return;
    }
    onDateChange(addMonths(currentDate, 1));
  }

  function renderEventChip(event) {
    const color = getEventBadgeColor(event);
    return (
      <div
        key={event.id}
        className="flex w-full items-center gap-2 rounded-lg border px-2 py-1 text-left text-xs font-medium transition"
        style={{ backgroundColor: `${color}1A`, borderColor: `${color}2A`, color }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEditEvent(event);
          }}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="min-w-0 flex-1 truncate">{event.title}</span>
        </button>
        {onDeleteEvent ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteEvent(event);
            }}
            className="rounded-full p-1 text-slate-500 transition hover:bg-white/80 hover:text-rose-600"
            aria-label="Delete event"
          >
            <Trash2 size={12} />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.08fr)_320px]">
      <div className="space-y-4">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-slate-800" />
            <h3 className="text-lg font-semibold text-slate-900">Events</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-[var(--radius-button,1rem)] border border-slate-200 bg-white p-1">
              <Button variant="ghost" size="icon" onClick={goPrev} className="h-9 w-9">
                <ChevronLeft size={16} />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onDateChange(new Date())} className="h-9 w-9 text-sm w-auto px-3">
                today
              </Button>
              <Button variant="ghost" size="icon" onClick={goNext} className="h-9 w-9">
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
              <Button variant="outline" onClick={onAddEvent} className="shadow-sm bg-white hover:bg-slate-50 shrink-0 ml-1">
                + Add event
              </Button>
            )}
          </div>
        </div>

        {view === 'month' ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="px-3 py-2 text-center text-sm font-semibold text-slate-700">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthCells.map((day) => {
                const dayEvents = getEventsForDate(events, day);
                const inMonth = day.getMonth() === currentDate.getMonth();
                const isToday = isSameDay(day, today);
                const isSelected = isSameDay(day, currentDate);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => onDateChange(day)}
                    className={cn(
                      'min-h-28 border-b border-r border-slate-100 p-2 text-left transition hover:bg-slate-50',
                      !inMonth && 'bg-slate-50/70 text-slate-400',
                      isSelected && 'bg-[color-mix(in_srgb,var(--primary)_7%,white)]',
                      isToday && 'ring-1 ring-inset ring-[var(--primary)]'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn('text-sm font-semibold', isToday && 'text-[var(--primary)]')}>{day.getDate()}</span>
                      {isToday ? <span className="rounded-full bg-[var(--primary)] px-2 py-0.5 text-[10px] font-semibold uppercase text-white">today</span> : null}
                    </div>
                    <div className="mt-2 space-y-1">
                      {dayEvents.slice(0, 3).map((event) => renderEventChip(event))}
                      {dayEvents.length > 3 ? (
                        <div className="px-1 text-[11px] font-medium text-slate-500">+{dayEvents.length - 3} more</div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {view === 'week' ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
              {Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(currentDate), index)).map((day) => (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => onDateChange(day)}
                  className={cn('px-3 py-3 text-left', isSameDay(day, currentDate) && 'bg-[color-mix(in_srgb,var(--primary)_7%,white)]')}
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                  <div className={cn('mt-1 text-base font-semibold text-slate-900', isSameDay(day, today) && 'text-[var(--primary)]')}>{day.getDate()}</div>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-7 divide-x divide-slate-100">
              {Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(currentDate), index)).map((day) => {
                const dayEvents = getEventsForDate(events, day);
                return (
                  <div key={day.toISOString()} className="min-h-64 p-2">
                    <div className="space-y-1.5">
                      {dayEvents.length ? dayEvents.map((event) => renderEventChip(event)) : <div className="px-1 py-2 text-xs text-slate-400">No activities</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {view === 'day' ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Selected day</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{formatCalendarTitle(currentDate, 'day')}</div>
              </div>
            </div>
            <div className="space-y-3">
              {visibleRangeEvents.length ? visibleRangeEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:bg-white"
                >
                  <button
                    type="button"
                    onClick={() => onEditEvent(event)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <span className="mt-1 h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: getEventBadgeColor(event) }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {getActivityLabel(event.eventType)}
                        </span>
                        <span className="text-sm font-semibold text-slate-900">{event.title}</span>
                      </div>
                      <div className="mt-2 text-sm text-slate-600">{event.description || '-'}</div>
                      <div className="mt-2 text-xs text-slate-500">{formatEventTime(event)}</div>
                    </div>
                  </button>
                  {onDeleteEvent ? (
                    <button
                      type="button"
                      onClick={() => onDeleteEvent(event)}
                      className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Delete event"
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                  No activities for this day.
                </div>
              )}
            </div>
          </div>
        ) : null}

        {view === 'list' ? (
          <div className="space-y-4">
            {getGroupedEvents(visibleRangeEvents).length ? getGroupedEvents(visibleRangeEvents).map((group) => (
              <div key={group.date} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {group.date ? parseDateOnly(group.date)?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Activities'}
                </div>
                <div className="space-y-2">
                  {group.items.map((event) => (
                    <div
                      key={event.id}
                      className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:bg-white"
                    >
                      <button
                        type="button"
                        onClick={() => onEditEvent(event)}
                        className="flex min-w-0 flex-1 items-start gap-3 text-left"
                      >
                        <span className="mt-1 h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: getEventBadgeColor(event) }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                              {getActivityLabel(event.eventType)}
                            </span>
                            <span className="text-sm font-semibold text-slate-900">{event.title}</span>
                          </div>
                          <div className="mt-2 text-sm text-slate-600">{event.description || '-'}</div>
                          <div className="mt-2 text-xs text-slate-500">{formatEventTime(event)}</div>
                        </div>
                      </button>
                      {onDeleteEvent ? (
                        <button
                          type="button"
                          onClick={() => onDeleteEvent(event)}
                          className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                          aria-label="Delete event"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                No activities added yet.
              </div>
            )}
          </div>
        ) : null}
      </div>

      <EventFeedPanel
        selectedDate={currentDate}
        selectedDateLabel={selectedDateLabel}
        selectedDateEvents={selectedDateEvents}
        events={feedEvents}
        onEditEvent={onEditEvent}
        onDeleteEvent={onDeleteEvent}
        subtitle="Selected day and visible lead events."
        emptyText="No visible lead events in this range."
      />
    </div>
  );
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

function ContactModal({ open, onClose, onSave, leadId, initialValue = null, busy = false }) {
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
      leadId,
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
            onCountryChange={(country) => {
              if (country?.name) {
                setFormData((cur) => ({ ...cur, country: country.name }));
              }
            }}
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
                  name="gender"
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

function NoteModal({ open, onClose, onSave, leadId, labelOptions = [], initialValue = null, busy = false }) {
  const [formData, setFormData] = useState(initialValue || EMPTY_NOTE);

  useEffect(() => {
    setFormData({
      ...(initialValue || EMPTY_NOTE),
      labels: normalizeLabels(initialValue?.labels),
      attachments: normalizeAttachmentList(initialValue?.attachments)
    });
  }, [initialValue, open]);

  const noteLabelOptions = useMemo(() => mergeLabelOptions(labelOptions, formData.labels), [labelOptions, formData.labels]);
  const presetColors = ['#84cc16', '#06b6d4', '#3b82f6', '#94a3b8', '#f59e0b', '#ef4444', '#db2777', '#8b5cf6'];
  const attachments = Array.isArray(formData.attachments) ? formData.attachments : [];

  async function handleSubmit(event) {
    event.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Note title is required');
      return;
    }
    await onSave({
      leadId,
      eventType: 'note',
      title: formData.title.trim(),
      description: formData.description.trim(),
      category: formData.category || 'General',
      labels: Array.isArray(formData.labels) ? formData.labels : normalizeLabels(formData.labels),
      color: formData.color || '#3b82f6',
      attachments: attachments
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialValue?.id ? 'Edit note' : 'Add note'}
      width="920px"
      footer={(
        <div className="flex items-center justify-between gap-3">
          <div></div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onClose} disabled={busy}>Close</Button>
            <Button onClick={handleSubmit} disabled={busy}>{busy ? 'Saving...' : 'Save'}</Button>
          </div>
        </div>
      )}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input value={formData.title} onChange={(e) => setFormData((cur) => ({ ...cur, title: e.target.value }))} placeholder="Title" autoFocus />
        <Textarea value={formData.description} onChange={(e) => setFormData((cur) => ({ ...cur, description: e.target.value }))} placeholder="Description..." rows={12} />
        <SearchableSelect
          value={formData.category}
          onChange={(val) => setFormData((cur) => ({ ...cur, category: val }))}
          options={['General', 'Follow-up', 'Client', 'Internal', 'Issue'].map((item) => ({ value: item, label: item }))}
          placeholder="- Category -"
          allowClear={false}
        />
        <SearchableSelect
          value={formData.labels}
          onChange={(val) => setFormData((cur) => ({ ...cur, labels: val }))}
          options={noteLabelOptions}
          placeholder="Labels"
          searchPlaceholder="Search labels..."
          multiple
        />
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Color</div>
          <ColorSwatches value={formData.color} onChange={(color) => setFormData((cur) => ({ ...cur, color }))} colors={presetColors} size="lg" />
        </div>
        <AttachmentPicker
          attachments={attachments}
          uploadModule="leads"
          uploadEntityId={leadId}
          onAddFile={(file) => {
            const selected = normalizeAttachment(file);
            if (!selected) return;
            setFormData((cur) => {
              const currentAttachments = normalizeAttachmentList(cur.attachments);
              if (currentAttachments.some((item) => item.driveFileId === selected.driveFileId)) {
                return cur;
              }
              return { ...cur, attachments: [...currentAttachments, selected] };
            });
          }}
          onRemoveFile={(driveFileId) => setFormData((cur) => ({
            ...cur,
            attachments: normalizeAttachmentList(cur.attachments).filter((file) => file.driveFileId !== driveFileId)
          }))}
        />
      </form>
    </Modal>
  );
}

function TaskModal({ open, onClose, onSave, leadId, userOptions = [], labelOptions = [], initialValue = null, busy = false }) {
  const [formData, setFormData] = useState(initialValue || EMPTY_TASK);

  useEffect(() => {
    setFormData({
      ...(initialValue || EMPTY_TASK),
      labels: normalizeLabels(initialValue?.labels),
      attachments: normalizeAttachmentList(initialValue?.attachments)
    });
  }, [initialValue, open]);

  const taskLabelOptions = useMemo(() => mergeLabelOptions(labelOptions, formData.labels), [labelOptions, formData.labels]);
  const collaboratorOptions = useMemo(() => userOptions.filter((item) => String(item.value) !== String(formData.assignedTo)), [userOptions, formData.assignedTo]);
  const pointOptions = [1, 2, 3, 5, 8, 13].map((point) => ({ value: String(point), label: `${point} Point${point > 1 ? 's' : ''}` }));
  const attachments = Array.isArray(formData.attachments) ? formData.attachments : [];

  async function handleSubmit(event) {
    event.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Task title is required');
      return;
    }
    await onSave({
      leadId,
      eventType: 'task',
      title: formData.title.trim(),
      description: formData.description.trim(),
      points: formData.points,
      assignedTo: formData.assignedTo || '',
      collaborators: Array.isArray(formData.collaborators) ? formData.collaborators : [],
      status: formData.status || 'To do',
      priority: formData.priority || 'Medium',
      labels: Array.isArray(formData.labels) ? formData.labels : normalizeLabels(formData.labels),
      startDate: formData.startDate || '',
      endDate: formData.deadline || '',
      recurring: Boolean(formData.recurring),
      color: formData.color || '#0ea5e9',
      attachments
    });
  }

  const userLookup = new Map(userOptions.map((item) => [String(item.value), item.label]));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialValue?.id ? 'Edit task' : 'Add task'}
      width="980px"
      footer={(
        <div className="flex items-center justify-between gap-3">
          <div></div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onClose} disabled={busy}>Close</Button>
            <Button variant="outline" onClick={handleSubmit} disabled={busy}>Save & show</Button>
            <Button onClick={handleSubmit} disabled={busy}>{busy ? 'Saving...' : 'Save'}</Button>
          </div>
        </div>
      )}
    >
      <form onSubmit={handleSubmit} className="flex flex-col px-1">
        <SectionRow label="Title">
          <Input value={formData.title} onChange={(e) => setFormData((cur) => ({ ...cur, title: e.target.value }))} placeholder="Title" autoFocus />
        </SectionRow>
        <SectionRow label="Description">
          <Textarea value={formData.description} onChange={(e) => setFormData((cur) => ({ ...cur, description: e.target.value }))} placeholder="Description" rows={3} />
        </SectionRow>
        <SectionRow label="Points">
          <SearchableSelect
            value={formData.points}
            onChange={(val) => setFormData((cur) => ({ ...cur, points: val }))}
            options={pointOptions}
            placeholder="1 Point"
            allowClear={false}
          />
        </SectionRow>
        <SectionRow label="Assign to">
          <SearchableSelect
            value={formData.assignedTo}
            onChange={(val) => setFormData((cur) => ({ ...cur, assignedTo: val }))}
            options={userOptions}
            placeholder="Assign to"
            searchPlaceholder="Search users..."
            allowClear={false}
          />
        </SectionRow>
        <SectionRow label="Collaborators">
          <SearchableSelect
            value={formData.collaborators}
            onChange={(val) => setFormData((cur) => ({ ...cur, collaborators: val }))}
            options={collaboratorOptions}
            placeholder="Collaborators"
            searchPlaceholder="Search collaborators..."
            multiple
          />
        </SectionRow>
        <SectionRow label="Status">
          <SearchableSelect
            value={formData.status}
            onChange={(val) => setFormData((cur) => ({ ...cur, status: val }))}
            options={['To do', 'In progress', 'Completed', 'Blocked'].map((item) => ({ value: item, label: item }))}
            placeholder="To do"
            allowClear={false}
          />
        </SectionRow>
        <SectionRow label="Priority">
          <SearchableSelect
            value={formData.priority}
            onChange={(val) => setFormData((cur) => ({ ...cur, priority: val }))}
            options={['Low', 'Medium', 'High', 'Urgent'].map((item) => ({ value: item, label: item }))}
            placeholder="Priority"
            allowClear={false}
          />
        </SectionRow>
        <SectionRow label="Labels">
          <SearchableSelect
            value={formData.labels}
            onChange={(val) => setFormData((cur) => ({ ...cur, labels: val }))}
            options={taskLabelOptions}
            placeholder="Labels"
            searchPlaceholder="Search labels..."
            multiple
          />
        </SectionRow>
        <SectionRow label="Start date">
          <Input type="date" value={formData.startDate} onChange={(e) => setFormData((cur) => ({ ...cur, startDate: e.target.value }))} />
        </SectionRow>
        <SectionRow label="Deadline">
          <Input type="date" value={formData.deadline} onChange={(e) => setFormData((cur) => ({ ...cur, deadline: e.target.value }))} />
        </SectionRow>
        <SectionRow label="Recurring">
          <div className="flex items-center gap-4 pt-1.5">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(formData.recurring)}
                onChange={(e) => setFormData((cur) => ({ ...cur, recurring: e.target.checked }))}
                className="!appearance-auto"
                style={{ accentColor: 'var(--primary)' }}
              />
              <span className="text-sm text-slate-700">Repeat task</span>
            </label>
          </div>
        </SectionRow>
        <div className="mt-1 flex flex-wrap gap-2 pt-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Assigned</span>
          <span className="text-xs text-slate-600">{userLookup.get(String(formData.assignedTo)) || 'Unassigned'}</span>
        </div>
        <AttachmentPicker
          attachments={attachments}
          uploadModule="leads"
          uploadEntityId={leadId}
          onAddFile={(file) => {
            const selected = normalizeAttachment(file);
            if (!selected) return;
            setFormData((cur) => {
              const currentAttachments = normalizeAttachmentList(cur.attachments);
              if (currentAttachments.some((item) => item.driveFileId === selected.driveFileId)) {
                return cur;
              }
              return { ...cur, attachments: [...currentAttachments, selected] };
            });
          }}
          onRemoveFile={(driveFileId) => setFormData((cur) => ({
            ...cur,
            attachments: normalizeAttachmentList(cur.attachments).filter((file) => file.driveFileId !== driveFileId)
          }))}
        />
      </form>
    </Modal>
  );
}

function EventModal({ open, onClose, onSave, leadId, initialValue = null, labelOptions = [], busy = false }) {
  const [formData, setFormData] = useState(initialValue || EMPTY_EVENT);
  const presetColors = ['#84cc16', '#06b6d4', '#3b82f6', '#94a3b8', '#f59e0b', '#ef4444', '#db2777', '#8b5cf6'];

  useEffect(() => {
    setFormData({
      ...(initialValue || EMPTY_EVENT),
      color: (initialValue && initialValue.color) || EMPTY_EVENT.color,
      attachments: normalizeEventAttachments(initialValue?.attachments)
    });
  }, [initialValue, open]);

  const attachments = Array.isArray(formData.attachments) ? formData.attachments : [];

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

  async function handleSubmit(event) {
    event.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Event title is required');
      return;
    }
    await onSave({
      leadId,
      eventType: 'event',
      title: formData.title.trim(),
      description: formData.description || '',
      startDate: formData.startDate || '',
      endDate: formData.endDate || '',
      startTime: formData.startTime || '',
      endTime: formData.endTime || '',
      location: formData.location || '',
      labels: formData.labels || [],
      color: formData.color || '#3b82f6',
      attachments: normalizeEventAttachments(formData.attachments)
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialValue?.id ? 'Edit event' : 'Add event'}
      width="600px"
      footer={(
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Close</Button>
          <Button onClick={handleSubmit} disabled={busy}>{busy ? 'Saving...' : 'Save'}</Button>
        </div>
      )}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input value={formData.title} onChange={(e) => setFormData((cur) => ({ ...cur, title: e.target.value }))} placeholder="Title" autoFocus />
        <Textarea value={formData.description} onChange={(e) => setFormData((cur) => ({ ...cur, description: e.target.value }))} placeholder="Description" rows={3} />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Input type="date" value={formData.startDate} onChange={(e) => setFormData((cur) => ({ ...cur, startDate: e.target.value }))} placeholder="Start date" />
            <Input type="time" value={formData.startTime} onChange={(e) => setFormData((cur) => ({ ...cur, startTime: e.target.value }))} placeholder="Start time" />
          </div>
          <div className="space-y-2">
            <Input type="date" value={formData.endDate} onChange={(e) => setFormData((cur) => ({ ...cur, endDate: e.target.value }))} placeholder="End date" />
            <Input type="time" value={formData.endTime} onChange={(e) => setFormData((cur) => ({ ...cur, endTime: e.target.value }))} placeholder="End time" />
          </div>
        </div>

        <Input value={formData.location} onChange={(e) => setFormData((cur) => ({ ...cur, location: e.target.value }))} placeholder="Location" />

        <SearchableSelect
          value={formData.labels}
          onChange={(val) => setFormData((cur) => ({ ...cur, labels: val }))}
          options={labelOptions}
          placeholder="Labels"
          multiple
        />

        <AttachmentPicker
          attachments={attachments}
          uploadModule="leads"
          uploadEntityId={leadId}
          onAddFile={appendAttachment}
          onRemoveFile={(driveFileId) => setFormData((cur) => ({
            ...(cur || {}),
            attachments: normalizeEventAttachments(cur.attachments).filter((item) => String(item.driveFileId || item.id) !== String(driveFileId))
          }))}
        />

        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Color</div>
          <ColorSwatches value={formData.color} onChange={(color) => setFormData((cur) => ({ ...cur, color }))} colors={presetColors} size="lg" />
        </div>
      </form>
    </Modal>
  );
}

function ReminderModal({ open, onClose, onSave, leadId, initialValue = null, busy = false }) {
  const [formData, setFormData] = useState(initialValue || EMPTY_REMINDER);

  useEffect(() => {
    setFormData({
      ...(initialValue || EMPTY_REMINDER),
      color: (initialValue && initialValue.color) || EMPTY_REMINDER.color
    });
  }, [initialValue, open]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Reminder title is required');
      return;
    }
    await onSave({
      leadId,
      eventType: 'reminder',
      title: formData.title.trim(),
      startDate: formData.date || '',
      endDate: formData.date || '',
      startTime: formData.time || '',
      endTime: formData.time || '',
      repeat: Boolean(formData.repeat),
      color: formData.color || '#f59e0b'
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialValue?.id ? 'Edit reminder' : 'Add reminder'}
      width="560px"
      footer={(
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Close</Button>
          <Button onClick={handleSubmit} disabled={busy}>{busy ? 'Adding...' : 'Add'}</Button>
        </div>
      )}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input value={formData.title} onChange={(e) => setFormData((cur) => ({ ...cur, title: e.target.value }))} placeholder="Title" autoFocus />
        <div className="grid gap-4 md:grid-cols-2">
          <Input type="date" value={formData.date} onChange={(e) => setFormData((cur) => ({ ...cur, date: e.target.value }))} />
          <Input type="time" value={formData.time} onChange={(e) => setFormData((cur) => ({ ...cur, time: e.target.value }))} />
        </div>
        <label className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            checked={Boolean(formData.repeat)}
            onChange={(e) => setFormData((cur) => ({ ...cur, repeat: e.target.checked }))}
            className="h-4 w-4 rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary)]"
          />
          <span className="text-sm text-slate-700">Repeat</span>
        </label>
      </form>
    </Modal>
  );
}

export function LeadDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingMeta, setSavingMeta] = useState(false);
  const [editingLeadOpen, setEditingLeadOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [calendarView, setCalendarView] = useState('month');
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [files, setFiles] = useState([]);
  const [filesModalOpen, setFilesModalOpen] = useState(false);

  const [contactOpen, setContactOpen] = useState(false);
  const [contactBusy, setContactBusy] = useState(false);
  const [contactEdit, setContactEdit] = useState(null);
  const [contactDeleteTarget, setContactDeleteTarget] = useState(null);

  const [activityType, setActivityType] = useState(null);
  const [activityEdit, setActivityEdit] = useState(null);
  const [activityBusy, setActivityBusy] = useState(false);
  const [activityDeleteTarget, setActivityDeleteTarget] = useState(null);

  const [settings, setSettings] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  async function load() {
    setLoading(true);
    try {
      const [summaryRes, filesRes, settingsRes, usersRes] = await Promise.allSettled([
        api.resources.get('/leads', `${id}/summary`, token),
        api.resources.list('/files', token, { parentId: id, parentType: 'lead' }),
        api.settings.get(token),
        api.resources.list('/users/lookup', token)
      ]);

      if (summaryRes.status === 'fulfilled') {
        setData(summaryRes.value.data);
      } else {
        throw summaryRes.reason;
      }

      if (settingsRes.status === 'fulfilled') {
        setSettings(settingsRes.value.data || null);
      }

      if (filesRes.status === 'fulfilled') {
        setFiles(filesRes.value.data || []);
      } else {
        setFiles([]);
      }

      if (usersRes.status === 'fulfilled') {
        setUsers(usersRes.value.data || []);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to load lead details');
      navigate('/app/leads');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  const lead = data?.lead || null;
  const contacts = data?.contacts || [];
  const events = data?.events || [];
  const timeline = data?.timeline || [];
  const summary = data?.summary || {};
  const userOptions = useMemo(() => normalizeUserOptions(users), [users]);
  const primaryContact = data?.primaryContact || contacts[0] || null;

  const labelOptions = useMemo(() => {
    return mergeSharedLabelOptions(normalizeSharedLabels(settings?.labels || []), normalizeLabels(lead?.labels));
  }, [settings, lead?.labels]);

  const statusColors = useMemo(() => {
    const map = {};
    (settings?.statuses?.leads || []).forEach((item) => {
      if (item && typeof item === 'object' && item.label) {
        map[item.label] = item.color || '#64748b';
      }
    });
    return map;
  }, [settings]);

  const labelColorMap = useMemo(() => {
    const map = new Map();
    labelOptions.forEach((item) => {
      map.set(String(item.label || item.value || '').trim(), item.color || '#64748b');
    });
    return map;
  }, [labelOptions]);

  const ownerName = useMemo(() => {
    if (lead?.ownerName) return lead.ownerName;
    const fallbackOwner = users.find((user) => String(user.id) === String(lead?.assignedTo));
    return fallbackOwner?.fullName || fallbackOwner?.username || fallbackOwner?.email || '-';
  }, [users, lead?.ownerName, lead?.assignedTo]);

  const createdByName = useMemo(() => {
    const creator = users.find((user) => String(user.id) === String(lead?.createdBy));
    return creator?.fullName || creator?.username || creator?.email || '-';
  }, [users, lead?.createdBy]);

  const wonStatusLabel = useMemo(() => {
    const statuses = settings?.statuses?.leads || [];
    const won = statuses.find((item) => item && typeof item === 'object' && String(item.state || '').toLowerCase() === 'won');
    return won?.label || 'Won';
  }, [settings]);

  const leadInfoItems = [
    { label: 'Type', value: lead?.type || '-' },
    { label: 'Source', value: lead?.source || '-' },
    { label: 'Owner', value: ownerName, tooltip: 'Who manages this lead' },
    { label: 'Company number', value: formatPhoneDisplay(lead?.phone) },
    { label: 'Created by', value: createdByName },
    { label: 'Primary contact', value: primaryContact ? `${primaryContact.firstName || ''} ${primaryContact.lastName || ''}`.trim() || '-' : '-' },
    { label: 'Primary phone', value: formatPhoneDisplay(primaryContact?.phone) },
    { label: 'State', value: lead?.state || '-' },
    { label: 'City', value: lead?.city || '-' },
    { label: 'Country', value: lead?.country || '-' }
  ];

  function openActivity(type) {
    const baseDate = toDateOnlyString(calendarDate);
    if (type === 'note') {
      setActivityType('note');
      setActivityEdit(null);
      return;
    }
    if (type === 'task') {
      setActivityType('task');
      setActivityEdit({
        ...EMPTY_TASK,
        assignedTo: lead?.assignedTo || lead?.createdBy || users[0]?.id || '',
        startDate: baseDate,
        deadline: baseDate
      });
      return;
    }
    if (type === 'reminder') {
      setActivityType('reminder');
      setActivityEdit({
        ...EMPTY_REMINDER,
        date: baseDate
      });
      return;
    }
    if (type === 'event') {
      setActivityType('event');
      setActivityEdit({
        ...EMPTY_EVENT,
        startDate: baseDate,
        endDate: baseDate
      });
    }
  }

  function openEditActivity(event) {
    if (!event || event.isSynthetic) return;
    const nextDate = parseDateOnly(event?.startDate || event?.endDate || '');
    if (nextDate) setCalendarDate(nextDate);
    const nextType = String(event.eventType || event.type || 'task').toLowerCase();
    setActivityType(
      nextType === 'note' ? 'note' :
        nextType === 'reminder' ? 'reminder' :
          nextType === 'event' ? 'event' : 'task'
    );
    setActivityEdit(event);
  }

  const activityBuckets = useMemo(() => {
    const bucket = (types) => events.filter((event) => types.includes(String(event.eventType || event.type || '').toLowerCase())).sort((a, b) => {
      const aDate = String(a.startDate || a.endDate || a.createdAt || '');
      const bDate = String(b.startDate || b.endDate || b.createdAt || '');
      if (aDate !== bDate) return bDate.localeCompare(aDate);
      return String(a.title || '').localeCompare(String(b.title || ''));
    });
    const followUpReminder = lead?.followUpDate
      ? [{
        id: `follow-up-${lead.id}`,
        eventType: 'reminder',
        title: 'Lead follow-up',
        description: lead.notes || 'Lead follow-up reminder',
        startDate: lead.followUpDate,
        endDate: lead.followUpDate,
        startTime: '',
        endTime: '',
        isSynthetic: true
      }]
      : [];
    return {
      task: bucket(['task']),
      note: bucket(['note']),
      reminder: [...followUpReminder, ...bucket(['reminder'])]
    };
  }, [events, lead?.followUpDate, lead?.id, lead?.notes]);

  const tabs = useMemo(() => [
    { key: 'overview', label: 'Overview', icon: Activity },
    { key: 'tasks', label: `Tasks (${activityBuckets.task.length || 0})`, icon: CheckCircle2 },
    { key: 'notes', label: `Notes (${activityBuckets.note.length || 0})`, icon: Tag },
    { key: 'reminders', label: `Reminders (${activityBuckets.reminder.length || 0})`, icon: Clock3 },
    { key: 'timeline', label: `Timeline (${timeline.length || 0})`, icon: Clock3 },
    { key: 'contacts', label: `Contacts (${contacts.length || 0})`, icon: Users },
    { key: 'events', label: `Events (${events.filter((e) => String(e.eventType || e.type || '').toLowerCase() === 'event').length || 0})`, icon: CalendarDays },
    { key: 'files', label: `Files (${files.length || 0})`, icon: Paperclip }
  ], [activityBuckets, timeline.length, contacts.length, events, files.length]);

  async function saveLeadMeta(nextPatch) {
    setSavingMeta(true);
    try {
      const response = await api.resources.update('/leads', id, nextPatch, token);
      api.cache.invalidate('/leads');
      if (response?.deletedLead && response?.clientId) {
        api.cache.invalidate('/clients');
        toast.success('Lead converted to client');
        navigate(`/app/clients/${response.clientId}`);
        return;
      }
      toast.success('Lead updated');
      await load();
    } catch (error) {
      toast.error(error.message || 'Failed to update lead');
    } finally {
      setSavingMeta(false);
    }
  }

  async function saveContact(payload) {
    setContactBusy(true);
    try {
      if (contactEdit?.id) {
        await api.resources.update('/lead-contacts', contactEdit.id, payload, token);
      } else {
        await api.resources.create('/lead-contacts', payload, token);
      }
      api.cache.invalidate('/leads');
      toast.success(contactEdit ? 'Contact updated' : 'Contact added');
      setContactOpen(false);
      setContactEdit(null);
      await load();
    } catch (error) {
      toast.error(error.message || 'Failed to save contact');
    } finally {
      setContactBusy(false);
    }
  }

  async function saveActivity(payload) {
    setActivityBusy(true);
    try {
      const type = String(payload.eventType || activityType || 'event').toLowerCase();
      if (activityEdit?.id) {
        const route = type === 'event' ? '/events' : '/lead-events';
        await api.resources.update(route, activityEdit.id, {
          ...payload,
          eventType: type,
          scopeType: 'lead',
          scopeId: id,
          leadId: id,
          clientId: '',
          projectId: '',
          visibility: payload.visibility || 'all_team'
        }, token);
      } else {
        const route = type === 'event' ? '/events' : '/lead-events';
        await api.resources.create(route, {
          ...payload,
          eventType: type,
          scopeType: 'lead',
          scopeId: id,
          leadId: id,
          clientId: '',
          projectId: '',
          visibility: payload.visibility || 'all_team',
          ownerUserId: user?.id || payload.ownerUserId || ''
        }, token);
      }
      api.cache.invalidate('/leads');
      toast.success(activityEdit ? 'Activity updated' : 'Activity added');
      setActivityType(null);
      setActivityEdit(null);
      await load();
    } catch (error) {
      toast.error(error.message || 'Failed to save activity');
    } finally {
      setActivityBusy(false);
    }
  }

  async function confirmDeleteContact() {
    if (!contactDeleteTarget) return;
    try {
      await api.resources.remove('/lead-contacts', contactDeleteTarget.id, token);
      api.cache.invalidate('/leads');
      toast.success('Contact deleted');
      setContactDeleteTarget(null);
      await load();
    } catch (error) {
      toast.error(error.message || 'Failed to delete contact');
    }
  }

  async function confirmDeleteActivity() {
    if (!activityDeleteTarget) return;
    try {
      const type = String(activityDeleteTarget?.eventType || activityDeleteTarget?.type || 'event').toLowerCase();
      const route = type === 'event' ? '/events' : '/lead-events';
      await api.resources.remove(route, activityDeleteTarget.id, token);
      api.cache.invalidate('/leads');
      toast.success('Activity deleted');
      setActivityDeleteTarget(null);
      await load();
    } catch (error) {
      toast.error(error.message || 'Failed to delete activity');
    }
  }

  if (loading) return <PageLoader />;
  if (!lead) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/app/leads')}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800"
            >
              <ArrowLeft size={16} />
              Back to Leads
            </button>
            <span className="text-slate-300">/</span>
            <h1 className="text-base font-semibold tracking-tight text-[var(--text-main)]">
              {lead.companyName || lead.name}
            </h1>
          </div>
          <div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                {lead.type || 'Organization'}
              </span>
              <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: `${(statusColors[lead.status] || '#64748b')}1A`, borderColor: `${(statusColors[lead.status] || '#64748b')}33`, color: statusColors[lead.status] || '#64748b' }}>
                {lead.status}
              </span>
              {normalizeLabels(lead.labels).slice(0, 3).map((label) => (
                <span key={label}>{renderLabelPill(label, labelColorMap.get(label) || '#2563eb')}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" className="shadow-sm" onClick={() => setEditingLeadOpen(true)}>
            <Edit3 size={16} className="mr-2" />
            Edit Lead
          </Button>
          <Button variant="outline" className="shadow-sm" onClick={() => setConvertOpen(true)}>
            <Wand2 size={16} className="mr-2" />
            Convert to client
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-6 border-b border-slate-200 px-2 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'inline-flex items-center gap-2 px-1 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap',
                activeTab === tab.key
                  ? 'border-[var(--primary)] text-[var(--primary)]'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900'
              )}
            >
              {Icon && <Icon size={16} className={activeTab === tab.key ? 'text-[var(--primary)]' : 'text-slate-400'} />}
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_380px]">
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-blue-600 text-white shadow-sm">
                    <Users size={20} />
                  </div>
                  <span className="text-2xl font-bold text-slate-800">{summary.contactsCount || contacts.length || 0}</span>
                </div>
                <div className="text-sm font-medium text-slate-500 mt-1">
                  Total Contacts
                </div>
              </Card>

              <Card className="p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-emerald-600 text-white shadow-sm">
                    <Activity size={20} />
                  </div>
                  <span className="text-2xl font-bold text-slate-800">{summary.eventsCount || events.length || 0}</span>
                </div>
                <div className="text-sm font-medium text-slate-500 mt-1">
                  Total Activities
                </div>
              </Card>

              <Card className="p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-purple-600 text-white shadow-sm">
                    <CheckCircle2 size={20} />
                  </div>
                  <span className="text-2xl font-bold text-slate-800">{summary.tasksCount || 0}</span>
                </div>
                <div className="text-sm font-medium text-slate-500 mt-1">
                  Total Tasks
                </div>
              </Card>

              <Card className="p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-amber-600 text-white shadow-sm">
                    <Clock3 size={20} />
                  </div>
                  <span className="text-2xl font-bold text-slate-800">{summary.remindersCount || 0}</span>
                </div>
                <div className="text-sm font-medium text-slate-500 mt-1">
                  Total Reminders
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'events' && (
            <Card className="p-5">
              <LeadEventsCalendar
                events={events.filter((e) => String(e.eventType || e.type || '').toLowerCase() === 'event')}
                view={calendarView}
                currentDate={calendarDate}
                onViewChange={setCalendarView}
                onDateChange={setCalendarDate}
                onAddEvent={() => openActivity('event')}
                onEditEvent={openEditActivity}
                onDeleteEvent={(event) => setActivityDeleteTarget(event)}
              />
            </Card>
          )}

          {activeTab === 'overview' && (
            <Card className="p-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab('timeline')}>
                  View all
                </Button>
              </div>
              <div className="mt-6">
                {timeline.length ? (
                  <div className="relative pl-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200 space-y-5">
                    {timeline.slice(0, 5).map((item, index) => {
                      let badgeColor = '#64748b';
                      if (item.kind === 'created') badgeColor = '#0f766e';
                      else if (item.kind === 'status_changed') badgeColor = '#f59e0b';
                      else if (item.kind === 'updated') badgeColor = '#3b82f6';
                      else if (item.color) badgeColor = item.color;
                      else if (item.kind === 'task') badgeColor = '#0ea5e9';
                      else if (item.kind === 'note') badgeColor = '#8b5cf6';
                      else if (item.kind === 'reminder') badgeColor = '#f59e0b';
                      
                      return (
                        <div key={`${item.title}-${index}`} className="relative group">
                          <div className="absolute -left-[30px] top-1.5 flex h-[14px] w-[14px] items-center justify-center rounded-full border-2 border-white bg-slate-200 group-hover:scale-125 transition-transform" style={{ backgroundColor: badgeColor }} />
                          <div className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm" style={{ color: badgeColor, backgroundColor: `${badgeColor}15` }}>
                                {item.kind || 'activity'}
                              </span>
                              <span className="text-xs font-semibold tracking-wider text-slate-400">{formatDate(item.date)}</span>
                            </div>
                            <p className="text-sm font-bold text-slate-800">{item.title}</p>
                            {item.detail && <p className="mt-1 text-xs text-slate-600 line-clamp-2 leading-relaxed">{item.detail}</p>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-[var(--text-muted)]">
                    No recent activity.
                  </div>
                )}
              </div>
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
                          {file.moduleName || 'leads'} {file.entityId ? `#${file.entityId}` : ''}
                        </p>
                        {file.description ? <p className="mt-1 line-clamp-2 text-xs text-slate-500">{file.description}</p> : null}
                        <p className="mt-2 text-xs text-[var(--text-muted)]">{formatDate(file.createdAt)}</p>
                      </div>
                    </div>
                  </a>
                )) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-[var(--text-muted)]">
                    No files uploaded for this lead yet.
                  </div>
                )}
              </div>
            </Card>
          )}

          {activeTab === 'contacts' && (
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Contacts</h2>
                  <p className="text-sm text-slate-500">{contacts.length} contact(s)</p>
                </div>
                <Button variant="secondary" onClick={() => { setContactEdit(null); setContactOpen(true); }}>
                  <UserPlus size={16} className="mr-2" />
                  Add contact
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {contacts.length ? contacts.map((contact, index) => (
                  <div key={contact.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)]">
                        {`${contact.firstName || ''}`.slice(0, 1)}{`${contact.lastName || ''}`.slice(0, 1)}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-slate-900">
                            {contact.firstName} {contact.lastName}
                          </div>
                          {index === 0 ? (
                            <span className="rounded-full bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                              Primary contact
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-slate-500">{contact.jobTitle || 'Contact'}</div>
                        <div className="mt-2 space-y-1 text-sm text-slate-600">
                          {contact.email ? <div className="flex items-center gap-2"><Mail size={14} /> {contact.email}</div> : null}
                          {contact.phone ? <div className="flex items-center gap-2"><Phone size={14} /> {formatPhoneDisplay(contact.phone)}</div> : null}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => { setContactEdit(contact); setContactOpen(true); }}>
                        <Edit3 size={16} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setContactDeleteTarget(contact)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                    No contacts added yet.
                  </div>
                )}
              </div>
            </Card>
          )}

          {(activeTab === 'tasks' || activeTab === 'notes' || activeTab === 'reminders') && (() => {
            const isTasks = activeTab === 'tasks';
            const isNotes = activeTab === 'notes';
            const section = isTasks
              ? { key: 'task', title: 'Tasks', description: 'Follow-up work for the lead', items: activityBuckets.task, accent: '#0ea5e9', addIcon: CalendarPlus, addLabel: 'Add task', onAdd: () => openActivity('task') }
              : isNotes
                ? { key: 'note', title: 'Notes', description: 'Internal notes and context', items: activityBuckets.note, accent: '#8b5cf6', addIcon: Tag, addLabel: 'Add note', onAdd: () => openActivity('note') }
                : { key: 'reminder', title: 'Reminders', description: 'Time-based follow ups', items: activityBuckets.reminder, accent: '#f59e0b', addIcon: Clock3, addLabel: 'Add reminder', onAdd: () => openActivity('reminder') };

            const AddIcon = section.addIcon;

            return (
              <Card className="p-5">
                <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{section.title}</h2>
                    <p className="text-sm text-slate-500">{section.description}</p>
                  </div>
                  <Button variant="outline" className="shadow-sm bg-white hover:bg-slate-50" onClick={section.onAdd}>
                    <AddIcon size={16} className="mr-2" />
                    {section.addLabel}
                  </Button>
                </div>
                <div className="mt-4 space-y-3">
                  {section.items.length ? section.items.map((item) => (
                    item.isSynthetic ? (
                      <div
                        key={item.id}
                        className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                              {item.eventType}
                            </span>
                            <span className="truncate text-base font-semibold text-slate-900">{item.title}</span>
                          </div>
                          <div className="mt-1 text-sm text-slate-600">
                            {item.description || 'No description provided'}
                          </div>
                          <div className="mt-2 text-xs font-medium text-slate-400">
                            {formatEventTime(item)}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openEditActivity(item)}
                        className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 hover:shadow-md shadow-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                              {item.eventType}
                            </span>
                            <span className="truncate text-base font-semibold text-slate-900">{item.title}</span>
                          </div>
                          <div className="mt-1 text-sm text-slate-600">
                            {item.description || 'No description provided'}
                          </div>
                          <div className="mt-2 text-xs font-medium text-slate-400">
                            {formatEventTime(item)}
                          </div>
                        </div>
                      </button>
                    )
                  )) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
                      No {section.title.toLowerCase()} added yet.
                    </div>
                  )}
                </div>
              </Card>
            );
          })()}

          {activeTab === 'timeline' && (
            <div className="w-full space-y-6 mt-2">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Timeline</h2>
                  <p className="text-sm text-slate-500 mt-1">Follow-ups, changes, and activity history</p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {timeline.length} Events
                </div>
              </div>
              
              {timeline.length ? (
                <div className="relative pl-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200 space-y-6">
                  {timeline.map((item, index) => {
                    let badgeColor = '#64748b';
                    if (item.kind === 'created') badgeColor = '#0f766e';
                    else if (item.kind === 'status_changed') badgeColor = '#f59e0b';
                    else if (item.kind === 'updated') badgeColor = '#3b82f6';
                    else if (item.color) badgeColor = item.color;
                    else if (item.kind === 'task') badgeColor = '#0ea5e9';
                    else if (item.kind === 'note') badgeColor = '#8b5cf6';
                    else if (item.kind === 'reminder') badgeColor = '#f59e0b';

                    return (
                      <div key={`${item.title}-${index}`} className="relative group">
                        <div className="absolute -left-[30px] top-1.5 flex h-[14px] w-[14px] items-center justify-center rounded-full border-2 border-white bg-slate-200 group-hover:scale-125 transition-transform" style={{ backgroundColor: badgeColor }}></div>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm" style={{ color: badgeColor, backgroundColor: `${badgeColor}15` }}>
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
                            
                            {Array.isArray(item.attachments) && item.attachments.length ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {item.attachments.slice(0, 4).map((file) => (
                                  <a
                                    key={file.driveFileId}
                                    href={file.driveWebViewLink || `#${file.driveFileId}`}
                                    target={file.driveWebViewLink ? '_blank' : undefined}
                                    rel={file.driveWebViewLink ? 'noreferrer' : undefined}
                                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300"
                                  >
                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: badgeColor }} />
                                    {file.name}
                                  </a>
                                ))}
                              </div>
                            ) : null}
                            
                            {Array.isArray(item.meta?.changes) && item.meta.changes.length ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {item.meta.changes.slice(0, 4).map((change) => (
                                  <span key={change.key} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                    {change.label}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  No timeline items yet.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card className="p-0 border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-slate-800" />
                <h2 className="text-lg font-semibold text-slate-900">Lead info</h2>
              </div>
              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 text-slate-500">
                <MoreHorizontal size={18} />
              </button>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-3.5">
                <Hexagon size={16} className="text-slate-500 shrink-0" />
                <span className="text-sm text-slate-700">{lead.type || 'Organization'}</span>
              </div>
              <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-3.5">
                <CheckCircle size={16} className="text-slate-500 shrink-0" />
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600" style={{ backgroundColor: `${(statusColors[lead.status] || '#64748b')}1A`, borderColor: `${(statusColors[lead.status] || '#64748b')}33`, color: statusColors[lead.status] || '#64748b' }}>
                  {lead.status || 'New'}
                </span>
              </div>
              <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-3.5">
                <Search size={16} className="text-slate-500 shrink-0" />
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-600">
                  {lead.source || 'Site'}
                </span>
              </div>
              <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-3.5">
                <Tag size={16} className="text-slate-500 shrink-0" />
                <div className="flex flex-wrap gap-1.5 items-center">
                  {normalizeLabels(lead.labels).length ? normalizeLabels(lead.labels).map((label) => {
                    const color = labelColorMap.get(label) || '#2563eb';
                    return <span key={label}>{renderLabelPill(label, color)}</span>;
                  }) : <button type="button" onClick={() => setLabelsOpen && setLabelsOpen(true)} className="text-sm text-[var(--primary)] font-medium hover:underline">Add Label</button>}
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
                  {lead.address && <div>{lead.address}</div>}
                  {(lead.city || lead.state) && <div>{[lead.city, lead.state].filter(Boolean).join(', ')}</div>}
                  {lead.country && <div>{lead.country}</div>}
                  {(!lead.address && !lead.city && !lead.state && !lead.country) && <span>-</span>}
                </div>
              </div>
              <div className="flex items-center gap-4 px-5 py-3.5">
                <Phone size={16} className="text-slate-500 shrink-0" />
                <span className="text-sm text-slate-700">{formatPhoneDisplay(lead.phone) || '-'}</span>
              </div>
            </div>
          </Card>

          <Card className="p-0 border-slate-200">
            <div className="border-b border-slate-100 px-5 py-3">
              <h3 className="text-sm font-semibold text-slate-800">Additional Details</h3>
            </div>
            <div className="flex flex-col px-5 py-2">
              <div className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-0">
                <span className="text-xs font-medium uppercase tracking-[0.1em] text-slate-400">Primary Contact</span>
                <span className="text-sm text-slate-700">
                  {primaryContact ? `${primaryContact.firstName || ''} ${primaryContact.lastName || ''}`.trim() || '-' : '-'}
                </span>
                {primaryContact?.phone && (
                  <span className="text-xs text-slate-500">{formatPhoneDisplay(primaryContact.phone)}</span>
                )}
              </div>
              <div className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-0">
                <span className="text-xs font-medium uppercase tracking-[0.1em] text-slate-400">Lead Value</span>
                <span className="text-sm text-slate-700">
                  {lead.currencySymbol || '$'}{Number(lead.value || 0).toLocaleString()} {lead.currency || 'USD'}
                </span>
              </div>
              {lead.website ? (
                <div className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-0">
                  <span className="text-xs font-medium uppercase tracking-[0.1em] text-slate-400">Website</span>
                  <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" className="text-sm text-[var(--primary)] hover:underline">
                    {lead.website}
                  </a>
                </div>
              ) : null}
              {(lead.vatNumber || lead.gstNumber) ? (
                <div className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-0">
                  <span className="text-xs font-medium uppercase tracking-[0.1em] text-slate-400">Tax Info</span>
                  {lead.vatNumber ? <span className="text-sm text-slate-700">VAT: {lead.vatNumber}</span> : null}
                  {lead.gstNumber ? <span className="text-sm text-slate-700">GST: {lead.gstNumber}</span> : null}
                </div>
              ) : null}
              <div className="flex flex-col gap-1 py-3">
                <span className="text-xs font-medium uppercase tracking-[0.1em] text-slate-400">Created By</span>
                <span className="text-sm text-slate-700">{createdByName}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <LeadFormModal
        open={editingLeadOpen}
        onClose={() => setEditingLeadOpen(false)}
        initialData={lead}
        onSuccess={(result) => {
          setEditingLeadOpen(false);
          if (result?.deletedLead && result?.clientId) {
            navigate(`/app/clients/${result.clientId}`);
            return;
          }
          load();
        }}
      />

      <ConvertLeadModal
        open={convertOpen}
        onClose={() => setConvertOpen(false)}
        lead={lead}
        targetStatus={wonStatusLabel}
        onSuccess={(result) => {
          setConvertOpen(false);
          if (result?.clientId) {
            navigate(`/app/clients/${result.clientId}`);
          } else {
            navigate('/app/leads');
          }
        }}
      />

      <ContactModal
        open={contactOpen}
        onClose={() => { setContactOpen(false); setContactEdit(null); }}
        onSave={saveContact}
        leadId={id}
        initialValue={contactEdit}
        busy={contactBusy}
      />

      <NoteModal
        open={activityType === 'note'}
        onClose={() => { setActivityType(null); setActivityEdit(null); }}
        onSave={saveActivity}
        leadId={id}
        labelOptions={labelOptions}
        initialValue={activityEdit && activityType === 'note' ? activityEdit : null}
        busy={activityBusy}
      />

      <TaskModal
        open={activityType === 'task'}
        onClose={() => { setActivityType(null); setActivityEdit(null); }}
        onSave={saveActivity}
        leadId={id}
        userOptions={userOptions}
        labelOptions={labelOptions}
        initialValue={activityEdit && activityType === 'task' ? activityEdit : null}
        busy={activityBusy}
      />

      <ReminderModal
        open={activityType === 'reminder'}
        onClose={() => { setActivityType(null); setActivityEdit(null); }}
        onSave={saveActivity}
        leadId={id}
        initialValue={activityEdit && activityType === 'reminder' ? activityEdit : null}
        busy={activityBusy}
      />

      <EventFormModal
        open={activityType === 'event'}
        onClose={() => { setActivityType(null); setActivityEdit(null); }}
        onSave={saveActivity}
        title={activityEdit?.id ? 'Edit event' : 'Add event'}
        subtitle="Create a lead event and share it with the right people."
        defaultScopeType="lead"
        defaultScopeId={id}
        scopeLocked
        labelOptions={labelOptions}
        userOptions={userOptions}
        initialValue={activityEdit && activityType === 'event' ? activityEdit : null}
        busy={activityBusy}
        uploadModule="leads"
        uploadEntityId={id}
      />

      <FileComposerModal
        open={filesModalOpen}
        onClose={() => setFilesModalOpen(false)}
        title="Add File"
        subtitle="Upload a file for this lead"
        settings={settings}
        uploadModule="leads"
        uploadEntityId={id}
        onSave={async () => {
          await load();
          setFilesModalOpen(false);
        }}
      />

      <ConfirmModal
        open={Boolean(contactDeleteTarget)}
        title="Delete contact"
        description={`Delete ${contactDeleteTarget?.firstName || ''} ${contactDeleteTarget?.lastName || ''}? This cannot be undone.`}
        confirmText="Delete"
        type="danger"
        isLoading={false}
        onConfirm={confirmDeleteContact}
        onCancel={() => setContactDeleteTarget(null)}
      />

      <ConfirmModal
        open={Boolean(activityDeleteTarget)}
        title="Delete activity"
        description={`Delete ${activityDeleteTarget?.title || 'this activity'}? This cannot be undone.`}
        confirmText="Delete"
        type="danger"
        isLoading={false}
        onConfirm={confirmDeleteActivity}
        onCancel={() => setActivityDeleteTarget(null)}
      />
    </div>
  );
}
