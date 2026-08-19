import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Activity, CalendarDays, CalendarPlus, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Edit3, HelpCircle, Mail, MapPin, Mic, Paperclip, Phone, Save, Tag, UserPlus, Users, Wand2, X, Trash2, Layers, MoreHorizontal, Hexagon, CheckCircle, Search, User, RefreshCcw, PlusCircle, Anchor, Eye, Printer, FileText, Download, MessageSquare, Send } from 'lucide-react';
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
import { DEFAULT_LEAD_OPTIONS } from '../../config/leadManagement';

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

const EMPTY_QUOTATION = {
  title: '',
  serviceNames: [],
  proposalDate: '',
  validUntil: '',
  amount: '',
  discountEnabled: false,
  discountType: 'percent',
  discountValue: '',
  gstApplicable: false,
  gstRate: '18',
  status: 'Draft',
  quotationLink: '',
  comments: '',
  reminders: [],
  postedComments: []
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

function formatLeadAmount(value, currency = 'INR') {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '-';
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency || 'INR'} ${amount.toLocaleString('en-IN')}`;
  }
}

function toAmountNumber(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = String(value).replace(/,/g, '').trim();
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function pickAmount(...values) {
  for (const value of values) {
    const amount = toAmountNumber(value);
    if (amount != null) return amount;
  }
  return null;
}

function extractAmountFromText(text) {
  const raw = String(text || '');
  if (!raw.trim()) return null;
  const currencyMatch = raw.match(/(?:rs\.?|inr|usd|\$)\s*([0-9][0-9,]*(?:\.\d+)?)/i);
  if (currencyMatch) return toAmountNumber(currencyMatch[1]);
  const labelledMatch = raw.match(/(?:amount|quotation|quote|total)\D{0,24}([0-9][0-9,]*(?:\.\d+)?)/i);
  return labelledMatch ? toAmountNumber(labelledMatch[1]) : null;
}

function getStructuredField(text, label) {
  const lines = String(text || '').split(/\r?\n/);
  const needle = String(label || '').trim().toLowerCase();
  const line = lines.find((item) => item.trim().toLowerCase().startsWith(`${needle}:`));
  return line ? line.slice(line.indexOf(':') + 1).trim() : '';
}

function getStructuredFields(text, label) {
  const lines = String(text || '').split(/\r?\n/);
  const needle = String(label || '').trim().toLowerCase();
  return lines
    .filter((item) => item.trim().toLowerCase().startsWith(`${needle}:`))
    .map((item) => item.slice(item.indexOf(':') + 1).trim())
    .filter(Boolean);
}

function removeStructuredQuotationLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .filter((line) => !/^\s*(service|amount|discount type|discount value|gst applicable|gst rate|total amount|status|quotation link|task|reminder|comments?)\s*:/i.test(line))
    .join('\n')
    .trim();
}

function cleanSingleLine(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function splitStructuredParts(value) {
  return String(value || '').split('|').map((item) => item.trim());
}

function addDaysToDate(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseQuotationServices(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toBooleanValue(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['true', 'yes', '1', 'on', 'gst'].includes(normalized)) return true;
  if (['false', 'no', '0', 'off', 'none', 'no tax'].includes(normalized)) return false;
  return fallback;
}

function calculateQuotationTotals({ amount, discountEnabled, discountType, discountValue, gstApplicable, gstRate }) {
  const roundAmount = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  const subtotal = Math.max(0, toAmountNumber(amount) ?? 0);
  const rawDiscount = discountEnabled ? Math.max(0, toAmountNumber(discountValue) ?? 0) : 0;
  const discountAmount = Math.min(
    subtotal,
    discountType === 'flat' ? rawDiscount : (subtotal * Math.min(rawDiscount, 100)) / 100
  );
  const roundedDiscount = roundAmount(discountAmount);
  const taxableAmount = roundAmount(Math.max(0, subtotal - roundedDiscount));
  const taxRate = gstApplicable ? Math.max(0, toAmountNumber(gstRate) ?? 0) : 0;
  const gstAmount = roundAmount((taxableAmount * taxRate) / 100);
  return {
    subtotal: roundAmount(subtotal),
    discountAmount: roundedDiscount,
    taxableAmount,
    gstAmount,
    totalAmount: roundAmount(taxableAmount + gstAmount)
  };
}

function getLeadServiceNames(lead) {
  const services = normalizeLabels(lead?.requiredServices);
  const otherDetails = String(lead?.otherServiceDetails || '').trim();
  if (otherDetails && services.includes('Other')) {
    return services.map((item) => item === 'Other' ? `Other: ${otherDetails}` : item);
  }
  if (otherDetails && !services.length) return [otherDetails];
  return services;
}

function getQuotationDate(event) {
  return String(event?.startDate || event?.endDate || event?.createdAt || event?.updatedAt || '');
}

function getLatestQuotationEvent(events = []) {
  return [...events]
    .filter((event) => {
      const type = String(event?.eventType || event?.type || '').toLowerCase();
      const text = `${event?.title || ''} ${event?.description || ''}`.toLowerCase();
      return type === 'quotation' || text.includes('quotation') || text.includes('quote');
    })
    .sort((a, b) => getQuotationDate(b).localeCompare(getQuotationDate(a)))[0] || null;
}

function getQuotationAmount(lead, quotationEvent) {
  const directAmount = pickAmount(
    lead?.quotationAmount,
    lead?.quotedAmount,
    lead?.quoteAmount,
    lead?.quotationValue,
    quotationEvent?.quotationAmount,
    quotationEvent?.quotedAmount,
    quotationEvent?.quoteAmount,
    quotationEvent?.totalAmount,
    quotationEvent?.amount,
    quotationEvent?.value,
    getStructuredField(quotationEvent?.description, 'Amount')
  );
  if (directAmount != null) return directAmount;
  return extractAmountFromText(`${quotationEvent?.title || ''} ${quotationEvent?.description || ''}`);
}

function getQuotationStatus(lead, quotationEvent) {
  const structuredStatus = getStructuredField(quotationEvent?.description, 'Status');
  if (structuredStatus) return structuredStatus;
  const directStatus = displayValue(
    lead?.quotationStatus || lead?.quoteStatus || lead?.quotationSendStatus || quotationEvent?.quotationStatus || quotationEvent?.quoteStatus || quotationEvent?.status,
    ''
  );
  if (directStatus) return directStatus;
  const sentFlag = lead?.quotationSent ?? lead?.quoteSent ?? lead?.isQuotationSent;
  if (sentFlag === true) return 'Sent';
  if (sentFlag === false) return 'Not sent';
  if (!quotationEvent) return 'Not sent';
  const text = `${quotationEvent.title || ''} ${quotationEvent.description || ''}`.toLowerCase();
  if (/(sent|send|shared|emailed|mail|whatsapp|delivered)/.test(text)) return 'Sent';
  if (/(draft|pending|not sent)/.test(text)) return 'Draft';
  return 'Logged';
}

function getQuotationDetails(event, lead = null) {
  const serviceNames = getLeadServiceNames(lead);
  const description = String(event?.description || '');
  const quotedServices = parseQuotationServices(event?.serviceNames || event?.payload?.serviceNames || getStructuredField(description, 'Service'));
  const selectedServices = quotedServices.length ? quotedServices : serviceNames.slice(0, 1);
  const structuredAmount = getStructuredField(description, 'Amount');
  const amount = pickAmount(
    event?.quotationAmount,
    event?.quotedAmount,
    event?.quoteAmount,
    event?.totalAmount,
    event?.amount,
    event?.value,
    structuredAmount
  ) ?? extractAmountFromText(`${event?.title || ''} ${description}`);
  const discountType = String(event?.discountType || event?.payload?.discountType || getStructuredField(description, 'Discount Type') || 'percent').toLowerCase() === 'flat' ? 'flat' : 'percent';
  const discountValue = pickAmount(event?.discountValue, event?.payload?.discountValue, getStructuredField(description, 'Discount Value')) ?? 0;
  const gstApplicable = toBooleanValue(event?.gstApplicable ?? event?.payload?.gstApplicable ?? getStructuredField(description, 'GST Applicable'), false);
  const gstRate = pickAmount(event?.gstRate, event?.payload?.gstRate, getStructuredField(description, 'GST Rate')) ?? 18;
  const totals = calculateQuotationTotals({
    amount,
    discountEnabled: discountValue > 0,
    discountType,
    discountValue,
    gstApplicable,
    gstRate
  });
  return {
    id: event?.id || '',
    title: event?.title || 'Quotation',
    serviceNames: selectedServices,
    serviceName: selectedServices.join(', '),
    proposalDate: event?.startDate || event?.createdAt || '',
    validUntil: event?.endDate || '',
    amount,
    discountEnabled: discountValue > 0,
    discountType,
    discountValue,
    gstApplicable,
    gstRate,
    ...totals,
    status: getQuotationStatus(null, event),
    invoiceId: event?.invoiceId || event?.payload?.invoiceId || '',
    invoiceNumber: event?.invoiceNumber || event?.payload?.invoiceNumber || '',
    quotationLink: getStructuredField(description, 'Quotation Link'),
    comments: getStructuredField(description, 'Comments') || removeStructuredQuotationLines(description),
    reminders: getStructuredFields(description, 'Reminder').map((item) => {
      const [title, date, time] = splitStructuredParts(item);
      return { title: title || '', date: date || '', time: time || '' };
    }),
    postedComments: getStructuredFields(description, 'Comment').map((item) => {
      const [author, createdAt, ...messageParts] = splitStructuredParts(item);
      return {
        author: author || 'User',
        createdAt: createdAt || '',
        message: messageParts.join(' | ') || item
      };
    })
  };
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

function displayValue(value, fallback = '-') {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  if (value == null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function DetailRow({ label, value }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
      <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</div>
      <div className="mt-0.5 min-w-0 whitespace-normal break-words text-[13px] font-medium leading-5 text-slate-800 [overflow-wrap:anywhere] [&_a]:break-all">
        {value || '-'}
      </div>
    </div>
  );
}

function DetailCard({ title, items = [], children, open = false, onToggle }) {
  return (
    <Card className="overflow-hidden rounded-xl border-slate-200 p-0 shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 bg-white px-4 py-2.5 text-left transition hover:bg-slate-50"
      >
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <ChevronRight size={16} className={cn('shrink-0 text-slate-400 transition-transform', open && 'rotate-90')} />
      </button>
      {open ? (
        <div className="grid grid-cols-1 gap-2.5 border-t border-slate-100 p-3 sm:grid-cols-2 2xl:grid-cols-3">
          {items.map((item) => (
            <DetailRow key={item.label} label={item.label} value={item.value} />
          ))}
          {children}
        </div>
      ) : null}
    </Card>
  );
}

function ChipList({ items = [] }) {
  const values = normalizeLabels(items);
  if (!values.length) return '-';
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((item) => (
        <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
          {item}
        </span>
      ))}
    </div>
  );
}

function AttachmentList({ items = [] }) {
  const files = Array.isArray(items) ? items : [];
  if (!files.length) return '-';
  return (
    <div className="flex flex-wrap gap-1.5">
      {files.map((file) => {
        const key = file.driveFileId || file.id || file.name;
        const label = file.name || file.originalName || 'File';
        if (file.driveWebViewLink) {
          return (
            <a key={key} href={file.driveWebViewLink} target="_blank" rel="noreferrer" className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-[var(--primary)] hover:underline">
              {label}
            </a>
          );
        }
        return <span key={key} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">{label}</span>;
      })}
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

function QuotationEditor({
  onClose,
  onSave,
  leadId,
  initialValue = null,
  busy = false,
  serviceOptions = [],
  currency = 'INR',
  defaultAmount = '',
  defaultGstApplicable = false,
  defaultGstRate = 18
}) {
  const [formData, setFormData] = useState(EMPTY_QUOTATION);
  const [reminderDraft, setReminderDraft] = useState({ title: '', date: '', time: '' });
  const [commentDraft, setCommentDraft] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    if (initialValue?.id) {
      const details = getQuotationDetails(initialValue);
      setFormData({
        ...EMPTY_QUOTATION,
        title: details.title || '',
        serviceNames: details.serviceNames || [],
        proposalDate: formatDateInput(details.proposalDate),
        validUntil: formatDateInput(details.validUntil),
        amount: details.amount != null ? String(details.amount) : '',
        discountEnabled: details.discountEnabled,
        discountType: details.discountType || 'percent',
        discountValue: details.discountValue ? String(details.discountValue) : '',
        gstApplicable: details.gstApplicable,
        gstRate: String(details.gstRate ?? defaultGstRate),
        status: details.status || 'Draft',
        quotationLink: details.quotationLink || '',
        comments: details.comments || '',
        reminders: details.reminders || [],
        postedComments: details.postedComments || []
      });
      setReminderDraft({ title: '', date: '', time: '' });
      setCommentDraft('');
      return;
    }
    const today = new Date();
    const defaultServices = serviceOptions.length ? serviceOptions : [];
    setFormData({
      ...EMPTY_QUOTATION,
      serviceNames: defaultServices,
      title: defaultServices.length ? `${defaultServices.join(', ')} quotation` : '',
      proposalDate: toDateOnlyString(today),
      validUntil: toDateOnlyString(addDaysToDate(today, 30)),
      amount: defaultAmount != null && defaultAmount !== '' ? String(defaultAmount) : '',
      gstApplicable: Boolean(defaultGstApplicable),
      gstRate: String(defaultGstRate || 18)
    });
    setReminderDraft({ title: '', date: '', time: '' });
    setCommentDraft('');
  }, [initialValue, serviceOptions, defaultAmount, defaultGstApplicable, defaultGstRate]);

  const serviceSelectOptions = useMemo(() => {
    const values = [...serviceOptions, ...(formData.serviceNames || [])].map(cleanSingleLine).filter(Boolean);
    return Array.from(new Set(values)).map((item) => ({ value: item, label: item }));
  }, [serviceOptions, formData.serviceNames]);

  const selectedServices = Array.isArray(formData.serviceNames) ? formData.serviceNames.filter(Boolean) : [];
  const serviceSummary = selectedServices.join(', ');
  const proposalTitle = formData.title.trim() || (serviceSummary ? `${serviceSummary} quotation` : 'Quotation');
  const amount = toAmountNumber(formData.amount);
  const quotationTotals = calculateQuotationTotals(formData);

  function setField(key, value) {
    setFormData((cur) => ({ ...cur, [key]: value }));
  }

  function addReminder() {
    const title = cleanSingleLine(reminderDraft.title);
    if (!title) return;
    setFormData((cur) => ({ ...cur, reminders: [...(cur.reminders || []), { ...reminderDraft, title }] }));
    setReminderDraft({ title: '', date: '', time: '' });
  }

  function addComment() {
    const message = cleanSingleLine(commentDraft);
    if (!message) return;
    setFormData((cur) => ({
      ...cur,
      postedComments: [
        ...(cur.postedComments || []),
        { author: 'You', createdAt: new Date().toISOString(), message }
      ]
    }));
    setCommentDraft('');
  }

  function removeReminder(index) {
    setFormData((cur) => ({ ...cur, reminders: (cur.reminders || []).filter((_, itemIndex) => itemIndex !== index) }));
  }

  function removeComment(index) {
    setFormData((cur) => ({ ...cur, postedComments: (cur.postedComments || []).filter((_, itemIndex) => itemIndex !== index) }));
  }

  function getSummaryLines() {
    return [
      ['Quotation', proposalTitle],
      ['Service', serviceSummary || '-'],
      ['Proposal date', formData.proposalDate || '-'],
      ['Valid until', formData.validUntil || '-'],
      ['Base amount', amount != null ? formatLeadAmount(amount, currency) : '-'],
      ['Discount', formData.discountEnabled ? formatLeadAmount(quotationTotals.discountAmount, currency) : '-'],
      ['GST', formData.gstApplicable ? `${formatLeadAmount(quotationTotals.gstAmount, currency)} (${formData.gstRate || 0}%)` : 'Not applicable'],
      ['Total', amount != null ? formatLeadAmount(quotationTotals.totalAmount, currency) : '-'],
      ['Status', formData.status || 'Draft'],
      ['Link', formData.quotationLink || '-'],
      ['Comments', formData.comments || '-']
    ];
  }

  function openPreview({ print = false } = {}) {
    const preview = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
    if (!preview) {
      toast.error('Popup blocked. Allow popups to preview quotation.');
      return;
    }
    const rows = getSummaryLines().map(([label, value]) => `<tr><th>${label}</th><td>${String(value).replace(/[<>&]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[char]))}</td></tr>`).join('');
    preview.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${proposalTitle}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; margin: 32px; }
            h1 { font-size: 24px; margin: 0 0 6px; }
            p { color: #64748b; margin: 0 0 24px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border-bottom: 1px solid #e2e8f0; padding: 12px; text-align: left; font-size: 14px; }
            th { width: 180px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; font-size: 11px; }
          </style>
        </head>
        <body>
          <h1>${proposalTitle}</h1>
          <p>Quotation summary</p>
          <table>${rows}</table>
        </body>
      </html>
    `);
    preview.document.close();
    if (print) {
      preview.setTimeout(() => {
        preview.focus();
        preview.print();
      }, 300);
    }
  }

  async function generatePdf(download = false) {
    setPdfBusy(true);
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      pdf.setFontSize(18);
      pdf.text(proposalTitle, 14, 18);
      pdf.setFontSize(10);
      pdf.setTextColor(100, 116, 139);
      pdf.text('Quotation summary', 14, 26);
      pdf.setTextColor(15, 23, 42);
      let y = 40;
      getSummaryLines().forEach(([label, value]) => {
        pdf.setFontSize(9);
        pdf.setTextColor(100, 116, 139);
        pdf.text(label, 14, y);
        pdf.setFontSize(11);
        pdf.setTextColor(15, 23, 42);
        pdf.text(String(value || '-'), 62, y);
        y += 9;
      });
      const fileName = `${proposalTitle.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'quotation'}.pdf`;
      if (download) {
        pdf.save(fileName);
      } else {
        window.open(pdf.output('bloburl'), '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to generate PDF');
    } finally {
      setPdfBusy(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!formData.title.trim() && !selectedServices.length) {
      toast.error('Quotation title or service name is required');
      return;
    }
    if (formData.amount !== '' && amount == null) {
      toast.error('Enter a valid quotation amount');
      return;
    }
    const discountValue = formData.discountEnabled ? (toAmountNumber(formData.discountValue) ?? 0) : 0;
    if (formData.discountEnabled && formData.discountType === 'percent' && discountValue > 100) {
      toast.error('Discount percentage cannot exceed 100');
      return;
    }
    if (formData.discountEnabled && formData.discountType === 'flat' && amount != null && discountValue > amount) {
      toast.error('Flat discount cannot exceed the quotation amount');
      return;
    }
    if (formData.status === 'Approved' && (!amount || amount <= 0)) {
      toast.error('Enter an amount greater than zero before approval');
      return;
    }

    const title = formData.title.trim() || `${serviceSummary} quotation`;
    const description = [
      serviceSummary ? `Service: ${cleanSingleLine(serviceSummary)}` : '',
      amount != null ? `Amount: ${amount}` : '',
      `Discount Type: ${formData.discountType || 'percent'}`,
      `Discount Value: ${discountValue}`,
      `GST Applicable: ${formData.gstApplicable ? 'Yes' : 'No'}`,
      `GST Rate: ${formData.gstApplicable ? (toAmountNumber(formData.gstRate) ?? 0) : 0}`,
      `Total Amount: ${quotationTotals.totalAmount}`,
      `Status: ${formData.status || 'Draft'}`,
      formData.quotationLink.trim() ? `Quotation Link: ${cleanSingleLine(formData.quotationLink)}` : '',
      formData.comments.trim() ? `Comments: ${cleanSingleLine(formData.comments)}` : '',
      ...(formData.reminders || []).map((item) => `Reminder: ${cleanSingleLine(item.title)} | ${item.date || ''} | ${item.time || ''}`),
      ...(formData.postedComments || []).map((item) => `Comment: ${cleanSingleLine(item.author || 'User')} | ${item.createdAt || new Date().toISOString()} | ${cleanSingleLine(item.message)}`)
    ].filter(Boolean).join('\n');

    await onSave({
      leadId,
      eventType: 'quotation',
      title,
      description,
      startDate: formData.proposalDate || '',
      endDate: formData.validUntil || '',
      color: '#0891b2',
      labels: ['Quotation', formData.status || 'Draft'],
      serviceNames: selectedServices,
      amount: amount ?? 0,
      discountType: formData.discountType || 'percent',
      discountValue,
      gstApplicable: Boolean(formData.gstApplicable),
      gstRate: formData.gstApplicable ? (toAmountNumber(formData.gstRate) ?? 0) : 0,
      subtotal: quotationTotals.subtotal,
      discountAmount: quotationTotals.discountAmount,
      taxableAmount: quotationTotals.taxableAmount,
      gstAmount: quotationTotals.gstAmount,
      totalAmount: quotationTotals.totalAmount
    });
  }

  return (
    <Card className="p-0 border-slate-200">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{initialValue?.id ? 'Edit quotation' : 'Add quotation'}</h2>
          <p className="text-sm text-slate-500">Create proposal details, actions, reminders and comments in one page</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="lead-quotation-form" disabled={busy}>{busy ? 'Saving...' : 'Save quotation'}</Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <form id="lead-quotation-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="md:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-slate-600">Quotation title</span>
              <Input className="h-10 px-3 py-2" value={formData.title} onChange={(event) => setField('title', event.target.value)} placeholder="Website development quotation" autoFocus />
            </label>
            <label className="md:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-slate-600">Service</span>
              <SearchableSelect
                value={selectedServices}
                onChange={(value) => {
                  const nextServices = Array.isArray(value) ? value : [];
                  setFormData((cur) => ({
                    ...cur,
                    serviceNames: nextServices,
                    title: cur.title || (nextServices.length ? `${nextServices.join(', ')} quotation` : '')
                  }));
                }}
                options={serviceSelectOptions}
                placeholder="Select service"
                searchPlaceholder="Search service..."
                multiple
                triggerClassName="min-h-10 py-2"
              />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-600">Proposal date</span>
              <Input className="h-10 px-3 py-2" type="date" value={formData.proposalDate} onChange={(event) => setField('proposalDate', event.target.value)} />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-600">Valid until</span>
              <Input className="h-10 px-3 py-2" type="date" value={formData.validUntil} onChange={(event) => setField('validUntil', event.target.value)} />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-600">Base amount ({currency || 'INR'})</span>
              <Input className="h-10 px-3 py-2" type="number" min="0" step="0.01" value={formData.amount} onChange={(event) => setField('amount', event.target.value)} placeholder="0.00" />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-600">Status</span>
              <SearchableSelect
                value={formData.status}
                onChange={(value) => setField('status', value)}
                options={['Draft', 'Sent', 'Approved', 'Rejected', 'Expired'].map((item) => ({ value: item, label: item }))}
                placeholder="Draft"
                triggerClassName="h-10 py-2"
              />
            </label>
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 md:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.discountEnabled)}
                    onChange={(event) => setField('discountEnabled', event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                  />
                  Apply discount
                </label>
                {formData.discountEnabled ? (
                  <span className="text-xs font-medium text-emerald-700">-{formatLeadAmount(quotationTotals.discountAmount, currency)}</span>
                ) : null}
              </div>
              {formData.discountEnabled ? (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <SearchableSelect
                    value={formData.discountType}
                    onChange={(value) => setField('discountType', value)}
                    options={[{ value: 'percent', label: 'Percent (%)' }, { value: 'flat', label: `Flat (${currency || 'INR'})` }]}
                    triggerClassName="h-9 py-1.5"
                  />
                  <Input
                    className="h-9 px-3 py-1.5"
                    type="number"
                    min="0"
                    max={formData.discountType === 'percent' ? 100 : undefined}
                    step="0.01"
                    value={formData.discountValue}
                    onChange={(event) => setField('discountValue', event.target.value)}
                    placeholder={formData.discountType === 'percent' ? 'Discount %' : 'Discount amount'}
                  />
                </div>
              ) : null}
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 md:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.gstApplicable)}
                    onChange={(event) => setField('gstApplicable', event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                  />
                  Apply GST
                </label>
                {formData.gstApplicable ? (
                  <div className="w-36">
                    <SearchableSelect
                      value={String(formData.gstRate)}
                      onChange={(value) => setField('gstRate', value)}
                      options={['0', '5', '12', '18', '28'].map((rate) => ({ value: rate, label: `GST ${rate}%` }))}
                      triggerClassName="h-9 py-1.5"
                    />
                  </div>
                ) : <span className="text-xs font-medium text-slate-500">No tax</span>}
              </div>
            </div>
            <label className="md:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-slate-600">Quotation link</span>
              <Input className="h-10 px-3 py-2" value={formData.quotationLink} onChange={(event) => setField('quotationLink', event.target.value)} placeholder="https://docs.google.com/..." />
            </label>
            <label className="md:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-slate-600">Internal comments</span>
              <Textarea className="min-h-[80px] px-3 py-2" value={formData.comments} onChange={(event) => setField('comments', event.target.value)} rows={3} placeholder="Short note for this quotation" />
            </label>
          </div>
        </form>

        <aside className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2 font-semibold text-slate-900"><Anchor size={16} /> Proposal info</div>
              <MoreHorizontal size={18} className="text-slate-400" />
            </div>
            <div className="divide-y divide-slate-100 px-4 text-sm">
              <div className="flex items-start gap-2 py-3 text-blue-700"><Layers size={16} className="mt-0.5 shrink-0" /><span className="min-w-0 truncate">{proposalTitle}</span></div>
              <div className="flex justify-between gap-3 py-3"><span className="font-semibold">Proposal date:</span><span>{formData.proposalDate || '-'}</span></div>
              <div className="flex justify-between gap-3 py-3"><span className="font-semibold">Valid until:</span><span>{formData.validUntil || '-'}</span></div>
              <div className="space-y-2 py-3">
                <div className="flex justify-between gap-3 text-slate-600"><span>Base amount</span><span>{formatLeadAmount(quotationTotals.subtotal, currency)}</span></div>
                {formData.discountEnabled ? <div className="flex justify-between gap-3 text-emerald-700"><span>Discount</span><span>-{formatLeadAmount(quotationTotals.discountAmount, currency)}</span></div> : null}
                {formData.gstApplicable ? <div className="flex justify-between gap-3 text-slate-600"><span>GST ({formData.gstRate || 0}%)</span><span>{formatLeadAmount(quotationTotals.gstAmount, currency)}</span></div> : null}
                <div className="flex justify-between gap-3 border-t border-slate-100 pt-2 text-base font-bold text-slate-900"><span>Total</span><span>{formatLeadAmount(quotationTotals.totalAmount, currency)}</span></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 rounded-lg border border-slate-200 bg-white text-sm text-blue-700">
            <button type="button" onClick={() => openPreview()} className="flex items-center gap-2 border-b border-r border-slate-100 px-4 py-3 hover:bg-slate-50"><Eye size={16} /> Preview</button>
            <button type="button" onClick={() => openPreview({ print: true })} className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 hover:bg-slate-50"><Printer size={16} /> Print</button>
            <button type="button" onClick={() => generatePdf(false)} disabled={pdfBusy} className="flex items-center gap-2 border-r border-slate-100 px-4 py-3 hover:bg-slate-50 disabled:opacity-50"><FileText size={16} /> View PDF</button>
            <button type="button" onClick={() => generatePdf(true)} disabled={pdfBusy} className="flex items-center gap-2 px-4 py-3 hover:bg-slate-50 disabled:opacity-50"><Download size={16} /> Download PDF</button>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-900"><Clock3 size={16} className="mr-2 inline" />Reminders</div>
            <div className="space-y-2 p-4">
              <Input className="h-9 px-3 py-2" value={reminderDraft.title} onChange={(event) => setReminderDraft((cur) => ({ ...cur, title: event.target.value }))} placeholder="Reminder title" />
              <div className="grid grid-cols-2 gap-2">
                <Input className="h-9 px-3 py-2" type="date" value={reminderDraft.date} onChange={(event) => setReminderDraft((cur) => ({ ...cur, date: event.target.value }))} />
                <Input className="h-9 px-3 py-2" type="time" value={reminderDraft.time} onChange={(event) => setReminderDraft((cur) => ({ ...cur, time: event.target.value }))} />
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={addReminder}><PlusCircle size={16} /> Add reminder</Button>
              {(formData.reminders || []).map((reminder, index) => (
                <div key={`${reminder.title}-${index}`} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{reminder.title} {reminder.date ? `- ${reminder.date}` : ''} {reminder.time || ''}</span>
                  <button type="button" onClick={() => removeReminder(index)} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-900"><MessageSquare size={16} className="mr-2 inline" />Comments</div>
            <div className="space-y-3 p-4">
              <Textarea className="min-h-[74px] bg-slate-50 px-3 py-2" value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} rows={2} placeholder="Write a comment..." />
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-500"><Paperclip size={16} /></span>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-500"><Mic size={16} /></span>
                </div>
                <Button type="button" onClick={addComment}><Send size={16} /> Post Comment</Button>
              </div>
              {(formData.postedComments || []).map((comment, index) => (
                <div key={`${comment.createdAt}-${index}`} className="border-t border-slate-100 pt-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{comment.author || 'User'}</span>
                    <button type="button" onClick={() => removeComment(index)} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">{comment.createdAt ? new Date(comment.createdAt).toLocaleString() : ''}</div>
                  <div className="mt-1 whitespace-pre-wrap text-slate-700">{comment.message}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </Card>
  );
}

export function LeadQuotationPage() {
  const { id, quotationId } = useParams();
  const navigate = useNavigate();
  const { token, user, hasPermission } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const response = await api.resources.get('/leads', `${id}/summary`, token);
      setData(response.data || null);
    } catch (error) {
      toast.error(error.message || 'Failed to load lead');
      navigate('/app/leads');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, quotationId, token]);

  const lead = data?.lead || null;
  const events = data?.events || [];
  const serviceNames = useMemo(() => getLeadServiceNames(lead), [lead]);
  const quotationEvent = useMemo(() => {
    if (!quotationId) return null;
    return events.find((event) => String(event.id) === String(quotationId)) || null;
  }, [events, quotationId]);
  const latestQuotation = useMemo(() => getLatestQuotationEvent(events), [events]);
  const defaultAmount = getQuotationAmount(lead, latestQuotation) ?? lead?.estimatedBudget ?? lead?.value ?? '';
  const canWriteLead = hasPermission('leads.write') || hasPermission('leads.manage');

  useEffect(() => {
    if (!loading && quotationId && data && !quotationEvent) {
      toast.error('Quotation not found');
      navigate(`/app/leads/${id}`);
    }
  }, [loading, quotationId, data, quotationEvent, navigate, id]);

  async function saveQuotation(payload) {
    if (!canWriteLead) {
      toast.error('You do not have permission to save quotation');
      return;
    }
    setBusy(true);
    try {
      let response;
      if (quotationEvent?.id) {
        response = await api.resources.update('/lead-events', quotationEvent.id, {
          ...payload,
          eventType: 'quotation',
          scopeType: 'lead',
          scopeId: id,
          leadId: id,
          clientId: '',
          projectId: '',
          visibility: payload.visibility || 'all_team'
        }, token);
      } else {
        response = await api.resources.create('/lead-events', {
          ...payload,
          eventType: 'quotation',
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
      api.cache.invalidate('/invoices');
      const invoice = response?.automation?.invoice;
      if (response?.automation?.invoiceCreated && invoice) {
        toast.success(`Quotation approved. Invoice ${invoice.invoiceNumber} created and payment reminder scheduled.`);
      } else if (invoice) {
        toast.success(`Quotation updated. Linked invoice ${invoice.invoiceNumber} is ready.`);
      } else {
        toast.success(quotationEvent ? 'Quotation updated' : 'Quotation added');
      }
      navigate(`/app/leads/${id}`);
    } catch (error) {
      toast.error(error.message || 'Failed to save quotation');
    } finally {
      setBusy(false);
    }
  }

  if (loading || !lead || (quotationId && !quotationEvent)) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <button type="button" onClick={() => navigate(`/app/leads/${id}`)} className="inline-flex items-center gap-2 font-medium text-slate-600 hover:text-[var(--primary)]">
          <ArrowLeft size={16} /> Back to Lead
        </button>
        <span>/</span>
        <span className="font-semibold text-slate-900">{lead.companyName || lead.name || lead.contactPerson || 'Lead'}</span>
        <span className="text-slate-400">{lead.leadNumber || ''}</span>
      </div>
      <QuotationEditor
        onClose={() => navigate(`/app/leads/${id}`)}
        onSave={saveQuotation}
        leadId={id}
        initialValue={quotationEvent}
        busy={busy}
        serviceOptions={serviceNames}
        currency={lead.currency || 'INR'}
        defaultAmount={defaultAmount}
        defaultGstApplicable={toBooleanValue(lead.gstInvoiceRequired, false)}
        defaultGstRate={18}
      />
    </div>
  );
}

function LeadStatusModal({ open, status, options, busy = false, onClose, onSubmit }) {
  const [formData, setFormData] = useState({ lostReason: '', lostReasonNotes: '' });

  useEffect(() => {
    if (open) setFormData({ lostReason: '', lostReasonNotes: '' });
  }, [open, status]);

  if (!open) return null;

  function handleSubmit(event) {
    event.preventDefault();
    if (!formData.lostReason) {
      toast.error('Select a reason');
      return;
    }
    if (formData.lostReason === 'Other' && !formData.lostReasonNotes.trim()) {
      toast.error('Enter reason notes');
      return;
    }
    onSubmit?.({
      status,
      lostReason: formData.lostReason,
      lostReasonNotes: formData.lostReasonNotes.trim()
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Mark as ${status}`}
      width="520px"
      footer={(
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="lead-status-form" disabled={busy}>{busy ? 'Saving...' : 'Update status'}</Button>
        </div>
      )}
    >
      <form id="lead-status-form" onSubmit={handleSubmit} className="space-y-4">
        <label>
          <span className="mb-1.5 block text-sm font-medium text-slate-600">Reason</span>
          <SearchableSelect
            value={formData.lostReason}
            onChange={(value) => setFormData((current) => ({ ...current, lostReason: value }))}
            options={(options.lostReasons || []).map((item) => ({ value: item, label: item }))}
            placeholder="Select reason"
            allowClear={false}
          />
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-medium text-slate-600">Notes</span>
          <Textarea
            value={formData.lostReasonNotes}
            onChange={(event) => setFormData((current) => ({ ...current, lostReasonNotes: event.target.value }))}
            rows={3}
            placeholder="Short reason note"
          />
        </label>
      </form>
    </Modal>
  );
}

function CallLogModal({ open, onClose, onSave, options, canManageRecording = false, defaultNumber = '', busy = false }) {
  const [formData, setFormData] = useState({
    callType: 'Outgoing', callDateTime: '', callDuration: '', callerNumber: '', callOutcome: 'Connected',
    callRecordingUrl: '', callNotes: '', consentConfirmed: false
  });

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setFormData({
      callType: 'Outgoing',
      callDateTime: now.toISOString().slice(0, 16),
      callDuration: '',
      callerNumber: defaultNumber || '',
      callOutcome: 'Connected',
      callRecordingUrl: '',
      callNotes: '',
      consentConfirmed: false
    });
  }, [open, defaultNumber]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!formData.callType || !formData.callDateTime) {
      toast.error('Call type and date are required');
      return;
    }
    if (formData.callRecordingUrl && !formData.consentConfirmed) {
      toast.error('Confirm recording consent before saving the recording reference');
      return;
    }
    await onSave({ ...formData, callDuration: Number(formData.callDuration || 0) });
  }

  const selectOptions = (items = []) => items.map((item) => ({ value: item, label: item }));
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log Call"
      width="620px"
      footer={(
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="lead-call-form" disabled={busy}>{busy ? 'Saving...' : 'Save Call'}</Button>
        </div>
      )}
    >
      <form id="lead-call-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label>
          <span className="mb-1.5 block text-sm font-medium text-slate-600">Call type</span>
          <SearchableSelect value={formData.callType} onChange={(value) => setFormData((current) => ({ ...current, callType: value }))} options={selectOptions(options.callTypes)} allowClear={false} />
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-medium text-slate-600">Date and time</span>
          <Input type="datetime-local" value={formData.callDateTime} onChange={(event) => setFormData((current) => ({ ...current, callDateTime: event.target.value }))} />
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-medium text-slate-600">Caller number</span>
          <Input value={formData.callerNumber} onChange={(event) => setFormData((current) => ({ ...current, callerNumber: event.target.value }))} />
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-medium text-slate-600">Duration in seconds</span>
          <Input type="number" min="0" value={formData.callDuration} onChange={(event) => setFormData((current) => ({ ...current, callDuration: event.target.value }))} />
        </label>
        <label className="md:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-slate-600">Outcome</span>
          <SearchableSelect value={formData.callOutcome} onChange={(value) => setFormData((current) => ({ ...current, callOutcome: value }))} options={selectOptions(options.callOutcomes)} allowClear={false} />
        </label>
        <label className="md:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-slate-600">Call notes</span>
          <Textarea value={formData.callNotes} onChange={(event) => setFormData((current) => ({ ...current, callNotes: event.target.value }))} rows={3} />
        </label>
        {canManageRecording ? (
          <>
            <label className="md:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-slate-600">Recording URL</span>
              <Input type="url" value={formData.callRecordingUrl} onChange={(event) => setFormData((current) => ({ ...current, callRecordingUrl: event.target.value }))} />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 md:col-span-2">
              <input type="checkbox" checked={formData.consentConfirmed} onChange={(event) => setFormData((current) => ({ ...current, consentConfirmed: event.target.checked }))} />
              Recording consent confirmed
            </label>
          </>
        ) : null}
      </form>
    </Modal>
  );
}

export function LeadDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user, hasPermission } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingMeta, setSavingMeta] = useState(false);
  const [editingLeadOpen, setEditingLeadOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [statusChange, setStatusChange] = useState(null);
  const [callOpen, setCallOpen] = useState(false);
  const [callBusy, setCallBusy] = useState(false);
  const [leadOptions, setLeadOptions] = useState(DEFAULT_LEAD_OPTIONS);
  const [users, setUsers] = useState([]);
  const [pipelines, setPipelines] = useState([]);
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
  const [openDetailSections, setOpenDetailSections] = useState({});

  async function load() {
    setLoading(true);
    try {
      const [summaryRes, filesRes, settingsRes, usersRes, pipelinesRes, leadOptionsRes] = await Promise.allSettled([
        api.resources.get('/leads', `${id}/summary`, token),
        api.files.list(token, '', 'leads', id),
        api.settings.get(token),
        api.resources.list('/users/lookup', token),
        api.resources.list('/lead-pipelines', token),
        api.resources.list('/leads/options', token)
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
      if (pipelinesRes.status === 'fulfilled') {
        setPipelines(pipelinesRes.value.data || []);
      }
      if (leadOptionsRes.status === 'fulfilled') {
        setLeadOptions((current) => ({ ...current, ...(leadOptionsRes.value.data || {}) }));
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

  useEffect(() => {
    setOpenDetailSections({});
  }, [id]);

  const lead = data?.lead || null;
  const contacts = data?.contacts || [];
  const events = data?.events || [];
  const timeline = data?.timeline || [];
  const summary = data?.summary || {};
  const userOptions = useMemo(() => normalizeUserOptions(users), [users]);
  const pipeline = useMemo(() => pipelines.find((item) => String(item.id) === String(lead?.pipelineId)) || null, [pipelines, lead?.pipelineId]);
  const primaryContact = data?.primaryContact || contacts[0] || null;
  const serviceNames = useMemo(() => getLeadServiceNames(lead), [lead]);
  const latestQuotationEvent = useMemo(() => getLatestQuotationEvent(events), [events]);
  const quotationAmount = useMemo(() => getQuotationAmount(lead, latestQuotationEvent), [lead, latestQuotationEvent]);
  const quotationStatus = useMemo(() => getQuotationStatus(lead, latestQuotationEvent), [lead, latestQuotationEvent]);
  const clientBudget = lead?.estimatedBudget ?? lead?.value;
  const quotationRows = useMemo(() => {
    return events
      .filter((event) => {
        const type = String(event?.eventType || event?.type || '').toLowerCase();
        const text = `${event?.title || ''} ${event?.description || ''}`.toLowerCase();
        return type === 'quotation' || text.includes('quotation') || text.includes('quote');
      })
      .sort((a, b) => getQuotationDate(b).localeCompare(getQuotationDate(a)))
      .map((event) => ({ event, ...getQuotationDetails(event, lead) }));
  }, [events, lead]);

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

  const leadStatusOptions = useMemo(() => {
    const values = [
      lead?.status,
      ...(settings?.statuses?.leads || []).map((item) => typeof item === 'string' ? item : item?.label || item?.value || ''),
      ...(leadOptions.statuses || []),
      'New',
      'Follow-up',
      wonStatusLabel,
      'Lost',
      'Not Interested'
    ].map((item) => String(item || '').trim()).filter(Boolean);
    return Array.from(new Set(values)).map((item) => ({ value: item, label: item }));
  }, [lead?.status, settings, leadOptions.statuses, wonStatusLabel]);

  const canWriteLead = hasPermission('leads.write') || hasPermission('leads.manage');
  const canConvertLead = canWriteLead || hasPermission('leads.convert');
  const canManageRecording = hasPermission('leads.view_call_recording');
  const isWon = String(lead?.status || '').trim().toLowerCase() === String(wonStatusLabel || 'Won').trim().toLowerCase()
    || String(lead?.status || '').trim().toLowerCase() === 'won';
  const isLost = ['lost', 'not interested'].includes(String(lead?.status || '').trim().toLowerCase());

  const leadInfoItems = [
    { label: 'Lead ID', value: lead?.leadNumber || lead?.id || '-' },
    { label: 'Company / business name', value: displayValue(lead?.companyName || lead?.name) },
    { label: 'Type', value: lead?.type || '-' },
    { label: 'Pipeline', value: pipeline?.name || 'Default Pipeline' },
    { label: 'Status', value: displayValue(lead?.status) },
    { label: 'Source', value: lead?.source || '-' },
    { label: 'Owner', value: ownerName, tooltip: 'Who manages this lead' },
    { label: 'Contact person', value: lead?.contactPerson || (primaryContact ? `${primaryContact.firstName || ''} ${primaryContact.lastName || ''}`.trim() || '-' : '-') },
    { label: 'Primary mobile', value: formatPhoneDisplay(lead?.phone) },
    { label: 'Created by', value: createdByName },
    { label: 'Required services', value: <ChipList items={lead?.requiredServices} /> },
    { label: 'Temperature', value: lead?.leadTemperature || '-' },
    { label: 'Priority', value: lead?.priority || '-' },
    { label: 'Estimated budget', value: formatLeadAmount(lead?.estimatedBudget ?? lead?.value, lead?.currency) },
    { label: 'Next follow-up', value: lead?.followUpDate ? `${lead.followUpDate}${lead.nextFollowUpTime ? ` ${lead.nextFollowUpTime}` : ''}` : '-' },
    { label: 'State', value: lead?.state || '-' },
    { label: 'City', value: lead?.city || '-' },
    { label: 'Country', value: lead?.country || '-' }
  ];

  const contactDetailItems = [
    { label: 'Alternate mobile', value: formatPhoneDisplay(lead?.alternatePhone) },
    { label: 'WhatsApp number', value: formatPhoneDisplay(lead?.whatsappNumber) },
    { label: 'Email', value: displayValue(lead?.email) },
    {
      label: 'Website',
      value: lead?.website ? (
        <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" className="text-[var(--primary)] hover:underline">
          {lead.website}
        </a>
      ) : '-'
    },
    { label: 'Country', value: displayValue(lead?.country) },
    { label: 'State', value: displayValue(lead?.state) },
    { label: 'City', value: displayValue(lead?.city) },
    { label: 'PIN code', value: displayValue(lead?.pincode) },
    { label: 'Preferred language', value: displayValue(lead?.preferredLanguage) },
    { label: 'Preferred contact method', value: displayValue(lead?.preferredContactMethod) },
    { label: 'Preferred contact time', value: displayValue(lead?.preferredContactTime) },
    { label: 'Address', value: displayValue(lead?.address) }
  ];

  const requirementDetailItems = [
    { label: 'Required services', value: <ChipList items={lead?.requiredServices} /> },
    { label: 'Other service details', value: displayValue(lead?.otherServiceDetails) },
    { label: 'Requirement summary', value: displayValue(lead?.requirementSummary) },
    { label: 'Project title', value: displayValue(lead?.requirementTitle) },
    { label: 'Detailed requirement', value: displayValue(lead?.requirementDescription) },
    { label: 'Client pain points', value: displayValue(lead?.clientPainPoints) },
    { label: 'Expected features', value: displayValue(lead?.expectedFeatures) },
    {
      label: 'Reference website / app',
      value: lead?.referenceUrl ? (
        <a href={lead.referenceUrl.startsWith('http') ? lead.referenceUrl : `https://${lead.referenceUrl}`} target="_blank" rel="noreferrer" className="text-[var(--primary)] hover:underline">
          {lead.referenceUrl}
        </a>
      ) : '-'
    },
    { label: 'Preferred technology', value: displayValue(lead?.preferredTechnology) },
    { label: 'Existing system details', value: displayValue(lead?.existingSystemDetails) },
    { label: 'Expected start date', value: formatDate(lead?.expectedStartDate) },
    { label: 'Expected delivery date', value: formatDate(lead?.expectedDeliveryDate) },
    { label: 'Requirement attachments', value: <AttachmentList items={lead?.requirementAttachments} /> }
  ];

  const commercialDetailItems = [
    { label: 'Estimated budget', value: formatLeadAmount(lead?.estimatedBudget ?? lead?.value, lead?.currency) },
    { label: 'Budget minimum', value: formatLeadAmount(lead?.budgetMin, lead?.currency) },
    { label: 'Budget maximum', value: formatLeadAmount(lead?.budgetMax, lead?.currency) },
    { label: 'Budget range', value: displayValue(lead?.budgetRange) },
    { label: 'Currency', value: displayValue(lead?.currency) },
    { label: 'Budget confirmed', value: displayValue(lead?.budgetConfirmed) },
    { label: 'Billing type', value: displayValue(lead?.billingType) },
    { label: 'GST invoice required', value: displayValue(lead?.gstInvoiceRequired) },
    { label: 'Purchase timeline', value: displayValue(lead?.purchaseTimeline) },
    { label: 'Expected closing date', value: formatDate(lead?.expectedClosingDate) },
    { label: 'Payment preference', value: displayValue(lead?.paymentPreference) }
  ];

  const qualificationDetailItems = [
    { label: 'Decision maker identified', value: displayValue(lead?.decisionMakerIdentified) },
    { label: 'Contact is decision maker', value: displayValue(Boolean(lead?.contactIsDecisionMaker)) },
    { label: 'Requirement confirmed', value: displayValue(lead?.requirementConfirmed) },
    { label: 'Timeline confirmed', value: displayValue(lead?.timelineConfirmed) },
    { label: 'Authority confirmed', value: displayValue(lead?.authorityConfirmed) },
    { label: 'Need confirmed', value: displayValue(lead?.needConfirmed) },
    { label: 'Lead score', value: lead?.leadScore != null ? String(lead.leadScore) : '-' },
    { label: 'Conversion probability', value: lead?.conversionProbability != null ? `${lead.conversionProbability}%` : '-' },
    { label: 'Qualification notes', value: displayValue(lead?.qualificationNotes) }
  ];

  const followUpDetailItems = [
    { label: 'Follow-up date', value: formatDate(lead?.followUpDate) },
    { label: 'Follow-up time', value: displayValue(lead?.nextFollowUpTime) },
    { label: 'Follow-up mode', value: displayValue(lead?.followUpMode) },
    { label: 'Reminder', value: displayValue(lead?.reminder) },
    { label: 'Follow-up priority', value: displayValue(lead?.followUpPriority) },
    { label: 'Assigned team', value: displayValue(lead?.assignedTeam) },
    { label: 'Follow-up note', value: displayValue(lead?.followUpNote) },
    { label: 'Notes', value: displayValue(lead?.notes) }
  ];

  const sourceCampaignItems = [
    { label: 'Lead source', value: displayValue(lead?.source) },
    { label: 'Campaign name', value: displayValue(lead?.campaignName) },
    { label: 'Source reference', value: displayValue(lead?.sourceReference) },
    { label: 'UTM source', value: displayValue(lead?.utmSource) },
    { label: 'UTM medium', value: displayValue(lead?.utmMedium) },
    { label: 'UTM campaign', value: displayValue(lead?.utmCampaign) }
  ];

  const referralCommissionItems = [
    { label: 'Referrer type', value: displayValue(lead?.referrerType) },
    { label: 'Referrer name', value: displayValue(lead?.referrerName) },
    { label: 'Referrer contact', value: formatPhoneDisplay(lead?.referrerContact) },
    { label: 'Client / employee / partner ID', value: displayValue(lead?.referrerReferenceId) },
    { label: 'Commission applicable', value: displayValue(Boolean(lead?.commissionApplicable)) },
    { label: 'Commission type', value: displayValue(lead?.commissionType) },
    { label: 'Commission value', value: lead?.commissionValue != null ? String(lead.commissionValue) : '-' },
    { label: 'Commission notes', value: displayValue(lead?.commissionNotes) }
  ];

  const lostDuplicateItems = [
    { label: 'Lost reason', value: displayValue(lead?.lostReason) },
    { label: 'Lost reason notes', value: displayValue(lead?.lostReasonNotes) },
    { label: 'Competitor name', value: displayValue(lead?.competitorName) },
    { label: 'Competitor price', value: formatLeadAmount(lead?.competitorPrice, lead?.currency) },
    { label: 'Reconnect in future', value: displayValue(Boolean(lead?.reconnectInFuture)) },
    { label: 'Reconnect date', value: formatDate(lead?.reconnectDate) },
    { label: 'Original lead', value: displayValue(lead?.originalLeadId) }
  ];

  const detailSections = [
    { key: 'quick', title: 'Quick Lead Details', items: leadInfoItems },
    { key: 'contact', title: 'Contact Details', items: contactDetailItems },
    { key: 'requirement', title: 'Requirement Details', items: requirementDetailItems },
    { key: 'commercial', title: 'Commercial Details', items: commercialDetailItems },
    { key: 'qualification', title: 'Qualification', items: qualificationDetailItems },
    { key: 'followup', title: 'Follow-up', items: followUpDetailItems },
    { key: 'source', title: 'Source and Campaign', items: sourceCampaignItems },
    ...(lead?.referrerType || lead?.referrerName || lead?.referrerContact || lead?.commissionApplicable || lead?.commissionType || lead?.commissionValue || lead?.commissionNotes
      ? [{ key: 'referral', title: 'Referral / Expected Commission', items: referralCommissionItems }]
      : []),
    ...(isLost || lead?.lostReason || lead?.competitorName || lead?.reconnectInFuture || lead?.originalLeadId
      ? [{ key: 'lost', title: 'Lost / Duplicate Details', items: lostDuplicateItems }]
      : [])
  ];

  function toggleDetailSection(key) {
    setOpenDetailSections((current) => ({ ...current, [key]: !current[key] }));
  }

  function setAllDetailSections(open) {
    setOpenDetailSections(open
      ? Object.fromEntries(detailSections.map((section) => [section.key, true]))
      : {}
    );
  }

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
      return;
    }
    if (type === 'quotation') {
      navigate(`/app/leads/${id}/quotations/new`);
    }
  }

  function openEditActivity(event) {
    if (!event || event.isSynthetic) return;
    const nextType = String(event.eventType || event.type || 'task').toLowerCase();
    if (nextType === 'quotation') {
      navigate(`/app/leads/${id}/quotations/${event.id}`);
      return;
    }
    const nextDate = parseDateOnly(event?.startDate || event?.endDate || '');
    if (nextDate) setCalendarDate(nextDate);
    setActivityType(
      nextType === 'note' ? 'note' :
        nextType === 'reminder' ? 'reminder' :
          nextType === 'event' ? 'event' :
            nextType === 'quotation' ? 'quotation' : 'task'
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
    { key: 'quotations', label: `Quotations (${quotationRows.length || 0})`, icon: PlusCircle },
    { key: 'timeline', label: `Timeline (${timeline.length || 0})`, icon: Clock3 },
    { key: 'contacts', label: `Contacts (${contacts.length || 0})`, icon: Users },
    { key: 'events', label: `Events (${events.filter((e) => String(e.eventType || e.type || '').toLowerCase() === 'event').length || 0})`, icon: CalendarDays },
    { key: 'files', label: `Files (${files.length || 0})`, icon: Paperclip }
  ], [activityBuckets, quotationRows.length, timeline.length, contacts.length, events, files.length]);

  function buildLeadMetaPatch(nextPatch = {}) {
    const patch = { ...nextPatch };
    if (!Object.prototype.hasOwnProperty.call(patch, 'status')) return patch;

    const requiredServices = normalizeLabels(lead?.requiredServices);
    if (requiredServices.length) patch.requiredServices = requiredServices;

    if (requiredServices.includes('Other')) {
      const explicitOther = String(lead?.otherServiceDetails || '').trim();
      const displayedOther = serviceNames
        .map((item) => String(item || '').trim())
        .find((item) => item.toLowerCase().startsWith('other:'));
      const derivedOther = displayedOther ? displayedOther.slice(displayedOther.indexOf(':') + 1).trim() : '';
      patch.otherServiceDetails = explicitOther || derivedOther || 'Other service';
    }

    return patch;
  }

  async function saveLeadMeta(nextPatch) {
    setSavingMeta(true);
    try {
      const response = await api.resources.update('/leads', id, buildLeadMetaPatch(nextPatch), token);
      api.cache.invalidate('/leads');
      if (response?.deletedLead && response?.clientId) {
        api.cache.invalidate('/clients');
        toast.success('Lead converted to client');
        navigate(`/app/clients/${response.clientId}`);
        return true;
      }
      toast.success('Lead updated');
      await load();
      return true;
    } catch (error) {
      toast.error(error.message || 'Failed to update lead');
      return false;
    } finally {
      setSavingMeta(false);
    }
  }

  async function changeLeadStatus(nextStatus) {
    const normalized = String(nextStatus || '').trim();
    if (!normalized || normalized === lead?.status) return;
    if (['Lost', 'Not Interested'].includes(normalized) && !lead?.lostReason) {
      setStatusChange({ status: normalized });
      return;
    }
    await saveLeadMeta({ status: normalized });
  }

  async function submitStatusChange(payload) {
    const ok = await saveLeadMeta(payload);
    if (ok) setStatusChange(null);
  }

  async function saveCall(payload) {
    setCallBusy(true);
    try {
      await api.resources.create(`/leads/${id}/calls`, payload, token);
      api.cache.invalidate('/leads');
      toast.success('Call logged');
      setCallOpen(false);
      await load();
    } catch (error) {
      toast.error(error.message || 'Failed to log call');
    } finally {
      setCallBusy(false);
    }
  }

  async function reopenLead() {
    setSavingMeta(true);
    try {
      await api.resources.create(`/leads/${id}/reopen`, { status: 'Follow-up' }, token);
      api.cache.invalidate('/leads');
      toast.success('Lead reopened');
      await load();
    } catch (error) {
      toast.error(error.message || 'Failed to reopen lead');
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
    <div className="space-y-5 overflow-hidden">
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-3">
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
            <h1 className="min-w-0 max-w-full truncate text-base font-semibold tracking-tight text-[var(--text-main)]">
              {lead.companyName || lead.name}
            </h1>
            {lead.leadNumber ? <span className="text-xs font-semibold text-slate-400">{lead.leadNumber}</span> : null}
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
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          {canWriteLead ? (
            <div className="w-44">
              <SearchableSelect
                value={lead.status || ''}
                onChange={changeLeadStatus}
                options={leadStatusOptions}
                placeholder="Change status"
                triggerClassName="h-10 py-2 shadow-sm"
              />
            </div>
          ) : null}
          {canWriteLead ? (
            <Button variant="outline" className="h-10 shadow-sm" onClick={() => setCallOpen(true)}>
              <Phone size={16} className="mr-2" /> Log Call
            </Button>
          ) : null}
          {canWriteLead ? (
            <Button variant="outline" className="h-10 shadow-sm" onClick={() => setEditingLeadOpen(true)}>
              <Edit3 size={16} className="mr-2" /> Edit Lead
            </Button>
          ) : null}
          {canWriteLead && isLost ? (
            <Button variant="outline" className="h-10 shadow-sm" onClick={reopenLead} disabled={savingMeta}>
              <RefreshCcw size={16} className="mr-2" /> Reopen
            </Button>
          ) : null}
          {canWriteLead && !isWon && !isLost ? (
            <Button variant="outline" className="h-10 shadow-sm" onClick={() => changeLeadStatus(wonStatusLabel)} disabled={savingMeta}>
              <CheckCircle2 size={16} className="mr-2" /> Mark Won
            </Button>
          ) : null}
          {canConvertLead && isWon && !lead.convertedClientId ? (
            <Button variant="outline" className="h-10 shadow-sm" onClick={() => setConvertOpen(true)}>
              <Wand2 size={16} className="mr-2" /> Convert Lead
            </Button>
          ) : null}
          {lead.convertedClientId ? (
            <Button className="h-10 shadow-sm" onClick={() => navigate(`/app/clients/${lead.convertedClientId}`)}>
              <UserPlus size={16} className="mr-2" /> View Client
            </Button>
          ) : null}
        </div>
      </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-t-lg border-b-2 px-3 py-3 text-sm font-medium transition-colors whitespace-nowrap',
                activeTab === tab.key
                  ? 'border-[var(--primary)] bg-blue-50/50 text-[var(--primary)]'
                  : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              {Icon && <Icon size={16} className={activeTab === tab.key ? 'text-[var(--primary)]' : 'text-slate-400'} />}
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className={cn('grid gap-6', activeTab === 'overview' ? 'xl:grid-cols-[minmax(0,1.8fr)_380px]' : 'xl:grid-cols-1')}>
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <div>
              <Card className="flex min-w-0 items-center gap-4 rounded-2xl border border-cyan-100 bg-cyan-50/30 px-4 py-4 shadow-sm">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-cyan-600">
                  <Tag size={22} strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Budget & Quotation</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="min-w-0">
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Client</span>
                      <span className="block text-base font-bold text-slate-800">{formatLeadAmount(clientBudget, lead.currency)}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Quoted</span>
                      <span className="block text-base font-bold text-slate-800">{quotationAmount != null ? formatLeadAmount(quotationAmount, lead.currency) : '-'}</span>
                      <span className={cn(
                        'mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                        String(quotationStatus).toLowerCase() === 'sent'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : String(quotationStatus).toLowerCase() === 'not sent'
                            ? 'border-slate-200 bg-slate-50 text-slate-600'
                            : 'border-amber-200 bg-amber-50 text-amber-700'
                      )}>
                        {quotationStatus}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex min-w-0 items-center">
                    <span className="min-w-0 truncate text-xs text-slate-400" title={serviceNames.join(', ')}>
                      {serviceNames.join(', ') || 'No service'}
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'quotations' && (
            <Card className="p-0 border-slate-200">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Quotations</h2>
                  <p className="text-sm text-slate-500">Proposal amount, status, validity and service details</p>
                </div>
                {canWriteLead ? (
                  <Button variant="outline" className="shadow-sm bg-white hover:bg-slate-50" onClick={() => openActivity('quotation')}>
                    <PlusCircle size={16} className="mr-2" />
                    Add quotation
                  </Button>
                ) : null}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Quotation', 'Service', 'Proposal date', 'Valid until', 'Amount', 'Status', 'Invoice', 'Comments', ''].map((heading) => (
                        <th key={heading || 'actions'} className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {quotationRows.length ? quotationRows.map((item) => (
                      <tr key={item.id} className="transition hover:bg-slate-50">
                        <td className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">{item.title}</td>
                        <td className="max-w-[220px] truncate border-b border-slate-100 px-4 py-3 text-sm text-slate-600" title={item.serviceName}>{item.serviceName || '-'}</td>
                        <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">{formatDate(item.proposalDate)}</td>
                        <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">{formatDate(item.validUntil)}</td>
                        <td className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">{item.totalAmount != null ? formatLeadAmount(item.totalAmount, lead.currency) : '-'}</td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          <span className={cn(
                            'inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold',
                            String(item.status).toLowerCase() === 'sent'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : String(item.status).toLowerCase() === 'draft'
                                ? 'border-slate-200 bg-slate-50 text-slate-600'
                                : String(item.status).toLowerCase() === 'approved'
                                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                                  : 'border-amber-200 bg-amber-50 text-amber-700'
                          )}>
                            {item.status || 'Draft'}
                          </span>
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3 text-sm">
                          {item.invoiceId ? (
                            <button type="button" onClick={() => navigate(`/app/invoices/${item.invoiceId}`)} className="font-semibold text-[var(--primary)] hover:underline">
                              {item.invoiceNumber || 'View invoice'}
                            </button>
                          ) : <span className="text-slate-400">-</span>}
                        </td>
                        <td className="max-w-[260px] truncate border-b border-slate-100 px-4 py-3 text-sm text-slate-600" title={item.comments}>{item.comments || '-'}</td>
                        <td className="border-b border-slate-100 px-4 py-3 text-right">
                          {canWriteLead ? (
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditActivity(item.event)} title="Edit quotation">
                                <Edit3 size={16} />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setActivityDeleteTarget(item.event)} title="Delete quotation" className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">
                          No quotation added yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {activeTab === 'overview' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-3 px-1">
                <h2 className="text-sm font-semibold text-slate-900">Lead Details</h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAllDetailSections(true)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    Open all
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllDetailSections(false)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    Close all
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2.5">
                {detailSections.map((section) => (
                  <DetailCard
                    key={section.key}
                    title={section.title}
                    items={section.items}
                    open={Boolean(openDetailSections[section.key])}
                    onToggle={() => toggleDetailSection(section.key)}
                  />
                ))}
              </div>
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

        {activeTab === 'overview' ? (
        <div className="space-y-4">
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
                <Layers size={16} className="text-slate-500 shrink-0" />
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold"
                  style={{
                    backgroundColor: `${(pipeline?.color || '#64748b')}1A`,
                    borderColor: `${(pipeline?.color || '#64748b')}33`,
                    color: pipeline?.color || '#64748b'
                  }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: pipeline?.color || '#64748b' }} />
                  {pipeline?.name || 'Default Pipeline'}
                </span>
              </div>
              <div className="flex items-start gap-4 border-b border-slate-100 px-5 py-3.5">
                <Tag size={16} className="text-slate-500 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium uppercase tracking-[0.1em] text-slate-400">Service name</div>
                  <div className="mt-1"><ChipList items={serviceNames} /></div>
                </div>
              </div>
              <div className="flex items-start gap-4 border-b border-slate-100 px-5 py-3.5">
                <Tag size={16} className="text-slate-500 shrink-0 mt-0.5" />
                <div className="grid min-w-0 flex-1 grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-[0.1em] text-slate-400">Client budget</div>
                    <div className="mt-1 text-sm font-semibold text-slate-800">{formatLeadAmount(clientBudget, lead.currency)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase tracking-[0.1em] text-slate-400">Quotation</div>
                    <div className="mt-1 text-sm font-semibold text-slate-800">{quotationAmount != null ? formatLeadAmount(quotationAmount, lead.currency) : '-'}</div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-3.5">
                <CheckCircle size={16} className="text-slate-500 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-medium uppercase tracking-[0.1em] text-slate-400">Quotation status</div>
                  <span className={cn(
                    'mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold',
                    quotationStatus === 'Sent'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : quotationStatus === 'Not sent'
                        ? 'border-slate-200 bg-slate-50 text-slate-600'
                        : 'border-amber-200 bg-amber-50 text-amber-700'
                  )}>
                    {quotationStatus}
                  </span>
                </div>
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
                  }) : <span className="text-sm text-slate-500">-</span>}
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
        ) : null}
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

      <CallLogModal
        open={callOpen}
        onClose={() => setCallOpen(false)}
        onSave={saveCall}
        options={leadOptions}
        canManageRecording={canManageRecording}
        defaultNumber={lead.phone || primaryContact?.phone || ''}
        busy={callBusy}
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

      <LeadStatusModal
        open={Boolean(statusChange)}
        status={statusChange?.status || ''}
        options={leadOptions}
        busy={savingMeta}
        onClose={() => { if (!savingMeta) setStatusChange(null); }}
        onSubmit={submitStatusChange}
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
