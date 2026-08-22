import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Activity, CalendarDays, CalendarPlus, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Edit3, HelpCircle, Mail, MapPin, Mic, Paperclip, Phone, Save, Tag, UserPlus, Users, Wand2, X, Trash2, Layers, MoreHorizontal, Hexagon, CheckCircle, Search, User, RefreshCcw, PlusCircle, Anchor, Eye, Printer, FileText, Download, MessageSquare, Send, Sparkles, ArrowRightCircle, PhoneCall, Bell, CheckSquare, MessageCircle, Zap, Volume2, RotateCw } from 'lucide-react';
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
import { FollowUpFormModal } from '../../components/followups/FollowUpModals';
import { WhatsAppModal } from '../../components/common/WhatsAppModal';
import { normalizeEventAttachment, normalizeEventAttachments } from '../../components/events/eventAttachments';
import {
  DEFAULT_LEAD_OPTIONS,
  getLeadStatusColor,
  getLeadSourceColor,
  getLeadServiceColor
} from '../../config/leadManagement';

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
  description: '',
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

function renderLabelPill(label, color, compact = false) {
  const badgeColor = color || '#2563eb';
  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold whitespace-nowrap ${
        compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-xs'
      }`}
      style={{
        backgroundColor: `${badgeColor}14`,
        borderColor: `${badgeColor}2E`,
        color: badgeColor
      }}
    >
      {label}
    </span>
  );
}

function renderStatusPill(status, color, compact = false) {
  if (!status) return <span className="text-sm text-[var(--text-muted)]">-</span>;
  const badgeColor = color || getLeadStatusColor(status);
  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold whitespace-nowrap ${
        compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-xs'
      }`}
      style={{
        backgroundColor: `${badgeColor}14`,
        borderColor: `${badgeColor}2E`,
        color: badgeColor
      }}
    >
      {status}
    </span>
  );
}

function renderSourcePill(source, color, compact = false) {
  if (!source) return <span className="text-sm text-[var(--text-muted)]">-</span>;
  const badgeColor = color || getLeadSourceColor(source);
  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold whitespace-nowrap ${
        compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-xs'
      }`}
      style={{
        backgroundColor: `${badgeColor}14`,
        borderColor: `${badgeColor}2E`,
        color: badgeColor
      }}
    >
      {source}
    </span>
  );
}

function renderServicePill(service, color, compact = false) {
  if (!service) return <span className="text-sm text-[var(--text-muted)]">-</span>;
  const badgeColor = color || getLeadServiceColor(service);
  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold whitespace-nowrap ${
        compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-xs'
      }`}
      style={{
        backgroundColor: `${badgeColor}14`,
        borderColor: `${badgeColor}2E`,
        color: badgeColor
      }}
    >
      {service}
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

function formatActivityTimestamp(dateStr, timeStr) {
  if (!dateStr) return { isUpcoming: false, relative: '', formatted: '-', dateOnly: '-', timeOnly: '' };
  try {
    const fullDate = timeStr && !String(dateStr).includes('T') ? `${String(dateStr).slice(0, 10)}T${timeStr}` : String(dateStr);
    const d = new Date(fullDate);
    if (isNaN(d.getTime())) {
      return {
        isUpcoming: false,
        relative: '',
        formatted: `${String(dateStr).slice(0, 10)}${timeStr ? ` at ${timeStr}` : ''}`,
        dateOnly: String(dateStr).slice(0, 10),
        timeOnly: timeStr || ''
      };
    }

    const now = new Date();
    // Compare date boundary
    const isFuture = d.getTime() > now.getTime();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    let relative = '';
    if (isFuture) {
      const futureMs = d.getTime() - now.getTime();
      const futureHours = Math.floor(futureMs / (1000 * 60 * 60));
      const futureDays = Math.ceil(futureMs / (1000 * 60 * 60 * 24));

      if (futureDays <= 0) {
        if (futureHours <= 1) relative = 'In a few minutes';
        else relative = `Today in ${futureHours} hrs`;
      } else if (futureDays === 1) {
        relative = 'Tomorrow';
      } else if (futureDays < 30) {
        relative = `In ${futureDays} days`;
      } else {
        relative = `Due in ${futureDays} days`;
      }
    } else {
      if (diffSec >= 0 && diffSec < 60) relative = 'Just now';
      else if (diffMin > 0 && diffMin < 60) relative = `${diffMin} min${diffMin > 1 ? 's' : ''} ago`;
      else if (diffHours > 0 && diffHours < 24) relative = `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
      else if (diffDays === 1) relative = 'Yesterday';
      else if (diffDays > 1 && diffDays < 7) relative = `${diffDays} days ago`;
    }

    const formattedDate = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const formattedTime = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    return {
      isUpcoming: isFuture,
      relative,
      formatted: `${formattedDate}${String(dateStr).includes('T') || timeStr ? ` • ${formattedTime}` : ''}`,
      dateOnly: formattedDate,
      timeOnly: formattedTime
    };
  } catch {
    return {
      isUpcoming: false,
      relative: '',
      formatted: String(dateStr).slice(0, 10),
      dateOnly: String(dateStr).slice(0, 10),
      timeOnly: ''
    };
  }
}

function getActivityMeta(item) {
  const kind = String(item.kind || item.eventType || item.type || 'activity').toLowerCase();
  const title = String(item.title || '').toLowerCase();

  if (kind === 'follow_up' || title.includes('follow up') || title.includes('follow-up')) {
    return {
      label: 'Follow-up Due',
      icon: Clock3,
      color: '#f59e0b',
      bg: 'bg-amber-500/15',
      border: 'border-amber-500/30',
      text: 'text-amber-700 dark:text-amber-300'
    };
  }
  if (kind === 'created' || kind === 'lead_created' || title.includes('lead created')) {
    return {
      label: 'Lead Created',
      icon: Sparkles,
      color: '#0d9488',
      bg: 'bg-teal-500/15',
      border: 'border-teal-500/30',
      text: 'text-teal-700 dark:text-teal-300'
    };
  }
  if (kind === 'status_changed' || kind === 'status' || title.includes('status changed')) {
    return {
      label: 'Status Changed',
      icon: ArrowRightCircle,
      color: '#f59e0b',
      bg: 'bg-amber-500/15',
      border: 'border-amber-500/30',
      text: 'text-amber-700 dark:text-amber-300'
    };
  }
  if (kind === 'call' || kind === 'call_logged' || title.includes('call')) {
    return {
      label: 'Call Logged',
      icon: PhoneCall,
      color: '#10b981',
      bg: 'bg-emerald-500/15',
      border: 'border-emerald-500/30',
      text: 'text-emerald-700 dark:text-emerald-300'
    };
  }
  if (kind === 'quotation' || kind === 'proposal' || title.includes('quotation') || title.includes('proposal')) {
    return {
      label: 'Quotation',
      icon: FileText,
      color: '#6366f1',
      bg: 'bg-indigo-500/15',
      border: 'border-indigo-500/30',
      text: 'text-indigo-700 dark:text-indigo-300'
    };
  }
  if (kind === 'task' || title.includes('task')) {
    return {
      label: 'Task',
      icon: CheckSquare,
      color: '#0284c7',
      bg: 'bg-sky-500/15',
      border: 'border-sky-500/30',
      text: 'text-sky-700 dark:text-sky-300'
    };
  }
  if (kind === 'note' || title.includes('note')) {
    return {
      label: 'Note',
      icon: MessageSquare,
      color: '#8b5cf6',
      bg: 'bg-purple-500/15',
      border: 'border-purple-500/30',
      text: 'text-purple-700 dark:text-purple-300'
    };
  }
  if (kind === 'reminder' || title.includes('reminder')) {
    return {
      label: 'Reminder',
      icon: Bell,
      color: '#f97316',
      bg: 'bg-orange-500/15',
      border: 'border-orange-500/30',
      text: 'text-orange-700 dark:text-orange-300'
    };
  }
  return {
    label: item.kind || 'Activity',
    icon: Activity,
    color: '#64748b',
    bg: 'bg-slate-500/15',
    border: 'border-slate-500/30',
    text: 'text-slate-700 dark:text-slate-300'
  };
}

function getTaskStatusMeta(status) {
  const st = String(status || 'to do').toLowerCase().trim();
  if (st === 'completed') {
    return {
      label: 'Completed',
      bg: 'bg-emerald-500/15',
      border: 'border-emerald-500/30',
      text: 'text-emerald-700 dark:text-emerald-300',
      dot: 'bg-emerald-500'
    };
  }
  if (st === 'in progress') {
    return {
      label: 'In Progress',
      bg: 'bg-sky-500/15',
      border: 'border-sky-500/30',
      text: 'text-sky-700 dark:text-sky-300',
      dot: 'bg-sky-500'
    };
  }
  if (st === 'blocked') {
    return {
      label: 'Blocked',
      bg: 'bg-rose-500/15',
      border: 'border-rose-500/30',
      text: 'text-rose-700 dark:text-rose-300',
      dot: 'bg-rose-500'
    };
  }
  return {
    label: status || 'To Do',
    bg: 'bg-slate-500/15',
    border: 'border-slate-500/30',
    text: 'text-slate-700 dark:text-slate-300',
    dot: 'bg-slate-500'
  };
}

function getTaskPriorityMeta(priority) {
  const pr = String(priority || 'medium').toLowerCase().trim();
  if (pr === 'urgent') {
    return {
      label: 'Urgent',
      bg: 'bg-rose-500/15',
      border: 'border-rose-500/30',
      text: 'text-rose-700 dark:text-rose-300'
    };
  }
  if (pr === 'high') {
    return {
      label: 'High',
      bg: 'bg-orange-500/15',
      border: 'border-orange-500/30',
      text: 'text-orange-700 dark:text-orange-300'
    };
  }
  if (pr === 'low') {
    return {
      label: 'Low',
      bg: 'bg-slate-500/15',
      border: 'border-slate-500/30',
      text: 'text-slate-600 dark:text-slate-400'
    };
  }
  return {
    label: 'Medium',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/30',
    text: 'text-amber-700 dark:text-amber-300'
  };
}

function getFollowUpStatus(item) {
  if (!item) return { isCompleted: false, remark: '' };
  const isCompleted = Boolean(
    item.status === 'Completed' ||
    item.isCompleted ||
    (Array.isArray(item.labels) && item.labels.includes('completed')) ||
    String(item.title || '').toLowerCase().startsWith('completed:') ||
    String(item.description || '').includes('[Completed')
  );

  let remark = '';
  if (item.remark) {
    remark = item.remark;
  } else if (item.outcome) {
    remark = item.outcome;
  } else if (item.description && item.description.includes('Remark:')) {
    const parts = item.description.split('Remark:');
    if (parts[1]) {
      remark = parts[1].trim();
    }
  }

  return { isCompleted, remark };
}

function getLocalDateStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function computeAutoCadence(currentAttempts = 0) {
  const now = new Date();
  const todayStr = getLocalDateStr();

  if (currentAttempts <= 0) {
    // Attempt 1: Call attempted -> No response. Schedule +3 Hours from now
    const plus3 = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const hour = plus3.getHours();

    if (hour >= 18 || hour < 9) {
      // If +3 hours is late evening, push to next day 10:30 AM
      const nextDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      if (nextDay.getDay() === 0) nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().slice(0, 10);
      return {
        nextAttempt: 1,
        date: nextDayStr,
        time: '10:30',
        remark: 'Attempt 1: Call not answered / No response. Auto-scheduled follow-up for next morning at 10:30 AM.',
        isCold: false,
        scheduleNext: true
      };
    } else {
      const pad = (n) => String(n).padStart(2, '0');
      const timeStr = `${pad(plus3.getHours())}:${pad(plus3.getMinutes())}`;
      return {
        nextAttempt: 1,
        date: todayStr,
        time: timeStr,
        remark: `Attempt 1: Call not answered / No response. Auto-scheduled follow-up in 3 hours (${timeStr}).`,
        isCold: false,
        scheduleNext: true
      };
    }
  } else if (currentAttempts === 1) {
    // Attempt 2: Next day at 11:00 AM
    const nextDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    if (nextDay.getDay() === 0) nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = nextDay.toISOString().slice(0, 10);
    return {
      nextAttempt: 2,
      date: nextDayStr,
      time: '11:00',
      remark: 'Attempt 2: Call not answered / No response. Auto-scheduled follow-up for next day at 11:00 AM.',
      isCold: false,
      scheduleNext: true
    };
  } else {
    // Attempt 3: 3rd failed attempt -> Move to Unresponsive / Cold Lead
    return {
      nextAttempt: 3,
      date: '',
      time: '',
      remark: 'Attempt 3: No response received after 3 attempts. Lead moved to Unresponsive / Cold Lead.',
      isCold: true,
      scheduleNext: false
    };
  }
}

function getWhatsAppMessage(leadName, templateKey = 'follow_up', service = '') {
  const name = leadName || 'there';
  const serviceText = service ? ` for ${service}` : '';

  switch (templateKey) {
    case 'connected':
      return `Hi ${name}, it was great speaking with you${service ? ` regarding ${service}` : ''}. As discussed, we are proceeding with the next steps. Please let me know if you need any further details. Thanks!`;
    case 'no_response':
    case 'missed_call':
      return `Hi ${name}, I tried calling you just now regarding your enquiry${serviceText}. Please let me know when would be a convenient time to connect over a quick call. Thanks!`;
    case 'busy':
      return `Hi ${name}, noted that you were occupied when I called. I will connect with you again today as requested. If you are free earlier, feel free to drop a message here. Thanks!`;
    case 'switched_off':
      return `Hi ${name}, tried reaching your number regarding your requirement${serviceText}, but your phone was unreachable/switched off. Please let me know when you are available or share an alternate number. Thanks!`;
    case 'meeting_reminder':
      return `Hi ${name}, gentle reminder regarding our scheduled follow-up discussion today. Looking forward to connecting with you. Thanks!`;
    default:
      return `Hi ${name}, following up on your requirement${serviceText}. Please let me know if you have any questions or if you would like to proceed. Thanks!`;
  }
}

function openWhatsAppNudge(phone, leadName, templateKey = 'follow_up', service = '') {
  if (!phone) {
    toast.error('No phone number available for this lead');
    return;
  }
  let cleanPhone = String(phone).replace(/[^0-9]/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = `91${cleanPhone}`;
  }

  const message = getWhatsAppMessage(leadName, templateKey, service);
  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function playReminderChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) {
    // Ignore audio permission errors
  }
}

function getQuickRescheduleOptions() {
  const now = new Date();
  const todayStr = getLocalDateStr();

  // 1. +1 Hour
  const plus1H = new Date(now.getTime() + 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const plus1HTime = `${pad(plus1H.getHours())}:${pad(plus1H.getMinutes())}`;

  // 2. Tomorrow
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  // 3. +2 Days
  const in2Days = new Date(now.getTime() + 2 * 24 * 60 * 1000);
  const in2DaysStr = in2Days.toISOString().slice(0, 10);

  // 4. Next Monday
  const nextMon = new Date(now.getTime());
  const day = nextMon.getDay();
  const daysUntilMonday = day === 0 ? 1 : (8 - day);
  nextMon.setDate(nextMon.getDate() + daysUntilMonday);
  const nextMonStr = nextMon.toISOString().slice(0, 10);

  return [
    { key: 'plus1', label: '+1 Hr', date: todayStr, time: plus1HTime, display: `Today at ${plus1HTime}` },
    { key: 'today5pm', label: 'Today 5 PM', date: todayStr, time: '17:00', display: 'Today at 05:00 PM' },
    { key: 'tomorrow', label: 'Tomorrow 11 AM', date: tomorrowStr, time: '11:00', display: 'Tomorrow at 11:00 AM' },
    { key: 'in2days', label: '+2 Days', date: in2DaysStr, time: '11:00', display: `${in2DaysStr} at 11:00 AM` },
    { key: 'nextMon', label: 'Next Mon', date: nextMonStr, time: '11:00', display: 'Next Monday at 11:00 AM' }
  ];
}

function PaginationBar({
  currentPage = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
  className = ''
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems <= pageSize) return null;

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-muted)] pt-3.5 mt-4 px-1 text-xs text-[var(--text-muted)]', className)}>
      <div>
        Showing <span className="font-semibold text-[var(--text-main)]">{totalItems ? startIndex + 1 : 0}</span> to <span className="font-semibold text-[var(--text-main)]">{endIndex}</span> of <span className="font-semibold text-[var(--text-main)]">{totalItems}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-main)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--surface-2)] transition cursor-pointer"
          title="Previous page"
        >
          <ChevronLeft size={14} />
        </button>

        <span className="px-2 font-semibold text-[var(--text-main)]">
          {currentPage} / {totalPages}
        </span>

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-main)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--surface-2)] transition cursor-pointer"
          title="Next page"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
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
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="min-w-0 flex-1 truncate">{event.title}</span>
        </button>
        {onDeleteEvent ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteEvent(event);
            }}
            className="rounded-full p-1 text-[var(--text-muted)] transition hover:bg-rose-500/10 hover:text-rose-500 cursor-pointer"
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
        <div className="flex flex-col gap-4 border-b border-[var(--border-muted)] pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-[var(--text-main)]" />
            <h3 className="text-lg font-semibold text-[var(--text-main)]">Events</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-[var(--radius-button,1rem)] border border-[var(--border)] bg-[var(--surface-2)] p-1">
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
            <div className="text-base font-semibold text-[var(--text-main)]">{formatCalendarTitle(currentDate, view)}</div>
            <div className="flex items-center rounded-[var(--radius-button,1rem)] border border-[var(--border)] bg-[var(--surface-2)] p-1">
              {['month', 'week', 'day'].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onViewChange(item)}
                  className={cn(
                    'rounded-[var(--radius-button,1rem)] px-3 py-1.5 text-sm font-medium capitalize transition cursor-pointer',
                    view === item ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)]'
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
            {onAddEvent && (
              <Button variant="outline" onClick={onAddEvent} className="shadow-sm shrink-0 ml-1">
                + Add event
              </Button>
            )}
          </div>
        </div>

        {view === 'month' ? (
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface-2)]">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="px-3 py-2 text-center text-sm font-semibold text-[var(--text-muted)]">{day}</div>
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
                      'min-h-28 border-b border-r border-[var(--border-muted)] p-2 text-left transition hover:bg-[var(--hover-bg)] cursor-pointer',
                      !inMonth && 'bg-[var(--surface-2)]/40 text-[var(--text-muted)] opacity-60',
                      isSelected && 'bg-[var(--primary-subtle)]',
                      isToday && 'ring-1 ring-inset ring-[var(--primary)]'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn('text-sm font-semibold text-[var(--text-main)]', isToday && 'text-[var(--primary)]')}>{day.getDate()}</span>
                      {isToday ? <span className="rounded-full bg-[var(--primary)] px-2 py-0.5 text-[10px] font-semibold uppercase text-white">today</span> : null}
                    </div>
                    <div className="mt-2 space-y-1">
                      {dayEvents.slice(0, 3).map((event) => renderEventChip(event))}
                      {dayEvents.length > 3 ? (
                        <div className="px-1 text-[11px] font-medium text-[var(--text-muted)]">+{dayEvents.length - 3} more</div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {view === 'week' ? (
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface-2)]">
              {Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(currentDate), index)).map((day) => (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => onDateChange(day)}
                  className={cn('px-3 py-3 text-left cursor-pointer', isSameDay(day, currentDate) && 'bg-[var(--primary-subtle)]')}
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                  <div className={cn('mt-1 text-base font-semibold text-[var(--text-main)]', isSameDay(day, today) && 'text-[var(--primary)]')}>{day.getDate()}</div>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-7 divide-x divide-[var(--border-muted)]">
              {Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(currentDate), index)).map((day) => {
                const dayEvents = getEventsForDate(events, day);
                return (
                  <div key={day.toISOString()} className="min-h-64 p-2">
                    <div className="space-y-1.5">
                      {dayEvents.length ? dayEvents.map((event) => renderEventChip(event)) : <div className="px-1 py-2 text-xs text-[var(--text-muted)]">No activities</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {view === 'day' ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Selected day</div>
                <div className="mt-1 text-lg font-semibold text-[var(--text-main)]">{formatCalendarTitle(currentDate, 'day')}</div>
              </div>
            </div>
            <div className="space-y-3">
              {visibleRangeEvents.length ? visibleRangeEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex w-full items-start gap-3 rounded-2xl border border-[var(--border-muted)] bg-[var(--surface-2)] p-4 text-left transition hover:bg-[var(--hover-bg)]"
                >
                  <button
                    type="button"
                    onClick={() => onEditEvent(event)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left cursor-pointer"
                  >
                    <span className="mt-1 h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: getEventBadgeColor(event) }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] border border-[var(--border-muted)]">
                          {getActivityLabel(event.eventType)}
                        </span>
                        <span className="text-sm font-semibold text-[var(--text-main)]">{event.title}</span>
                      </div>
                      <div className="mt-2 text-sm text-[var(--text-muted)]">{event.description || '-'}</div>
                      <div className="mt-2 text-xs text-[var(--text-muted)]">{formatEventTime(event)}</div>
                    </div>
                  </button>
                  {onDeleteEvent ? (
                    <button
                      type="button"
                      onClick={() => onDeleteEvent(event)}
                      className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-rose-500/10 hover:text-rose-500 cursor-pointer"
                      aria-label="Delete event"
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                  No activities for this day.
                </div>
              )}
            </div>
          </div>
        ) : null}

        {view === 'list' ? (
          <div className="space-y-4">
            {getGroupedEvents(visibleRangeEvents).length ? getGroupedEvents(visibleRangeEvents).map((group) => (
              <div key={group.date} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {group.date ? parseDateOnly(group.date)?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Activities'}
                </div>
                <div className="space-y-2">
                  {group.items.map((event) => (
                    <div
                      key={event.id}
                      className="flex w-full items-start gap-3 rounded-2xl border border-[var(--border-muted)] bg-[var(--surface-2)] p-4 text-left transition hover:bg-[var(--hover-bg)]"
                    >
                      <button
                        type="button"
                        onClick={() => onEditEvent(event)}
                        className="flex min-w-0 flex-1 items-start gap-3 text-left cursor-pointer"
                      >
                        <span className="mt-1 h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: getEventBadgeColor(event) }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] border border-[var(--border-muted)]">
                              {getActivityLabel(event.eventType)}
                            </span>
                            <span className="text-sm font-semibold text-[var(--text-main)]">{event.title}</span>
                          </div>
                          <div className="mt-2 text-sm text-[var(--text-muted)]">{event.description || '-'}</div>
                          <div className="mt-2 text-xs text-[var(--text-muted)]">{formatEventTime(event)}</div>
                        </div>
                      </button>
                      {onDeleteEvent ? (
                        <button
                          type="button"
                          onClick={() => onDeleteEvent(event)}
                          className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-rose-500/10 hover:text-rose-500 cursor-pointer"
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
              <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
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
    <div className="flex flex-col gap-1.5 py-2 md:flex-row md:items-start md:gap-4">
      {label ? <div className="w-full text-xs font-semibold text-[var(--text-muted)] md:w-32 md:pt-2.5">{label}</div> : null}
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
    <div className="min-w-0 rounded-lg border border-[var(--border-muted)] bg-[var(--surface-2)] px-3 py-2">
      <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">{label}</div>
      <div className="mt-0.5 min-w-0 whitespace-normal break-words text-[13px] font-medium leading-5 text-[var(--text-main)] [overflow-wrap:anywhere] [&_a]:break-all">
        {value || '-'}
      </div>
    </div>
  );
}

function DetailCard({ title, items = [], children, open = false, onToggle }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xs transition">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition cursor-pointer select-none",
          open
            ? "bg-[var(--surface-2)]/70 border-b border-[var(--border-muted)]"
            : "bg-[var(--surface)] hover:bg-[var(--hover-bg)]"
        )}
      >
        <span className="text-sm font-semibold text-[var(--text-main)]">{title}</span>
        <ChevronRight size={16} className={cn('shrink-0 text-[var(--text-muted)] transition-transform duration-200', open && 'rotate-90 text-[var(--primary)]')} />
      </button>
      {open ? (
        <div className="grid grid-cols-1 gap-3 bg-[var(--surface)] p-5 sm:grid-cols-2 2xl:grid-cols-3">
          {items.map((item) => (
            <DetailRow key={item.label} label={item.label} value={item.value} />
          ))}
          {children}
        </div>
      ) : null}
    </div>
  );
}

function ChipList({ items = [] }) {
  const values = normalizeLabels(items);
  if (!values.length) return '-';
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((item) => (
        <span key={item}>
          {renderServicePill(item, getLeadServiceColor(item), true)}
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
            <a key={key} href={file.driveWebViewLink} target="_blank" rel="noreferrer" className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs font-medium text-[var(--primary)] hover:underline">
              {label}
            </a>
          );
        }
        return <span key={key} className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-xs font-medium text-[var(--text-muted)]">{label}</span>;
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

function ActivityViewModal({
  open,
  onClose,
  item,
  onEdit,
  onCompleteFollowUp,
  canWriteLead,
  userLookup
}) {
  if (!item) return null;
  const isTask = String(item.eventType || item.type || '').toLowerCase() === 'task';
  const isReminder = String(item.eventType || item.type || '').toLowerCase() === 'reminder';
  const isLeadFollowUp = Boolean(item.isLeadFollowUp || item.isSynthetic);
  const meta = getActivityMeta(item);
  const timeInfo = formatActivityTimestamp(item.startDate || item.date || item.createdAt, item.startTime || item.time);
  const statusMeta = isTask ? getTaskStatusMeta(item.status) : null;
  const priorityMeta = isTask ? getTaskPriorityMeta(item.priority) : null;
  const followUpStatus = getFollowUpStatus(item);

  const assignedName = isTask && item.assignedTo ? (userLookup?.get(String(item.assignedTo)) || item.assignedUser || 'Assigned') : null;
  const collaboratorNames = isTask && Array.isArray(item.collaborators) && item.collaborators.length
    ? item.collaborators.map((c) => userLookup?.get(String(c)) || String(c)).filter(Boolean).join(', ')
    : null;
  const labelsList = Array.isArray(item.labels) ? item.labels : [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={(
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border', meta.bg, meta.border, meta.text)}>
            {isLeadFollowUp ? 'Lead Follow-Up' : meta.label}
          </span>
          {followUpStatus.isCompleted ? (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
              <CheckCircle2 size={10} className="text-emerald-600" />
              Completed
            </span>
          ) : timeInfo.isUpcoming ? (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 flex items-center gap-1">
              <Clock3 size={10} className="text-amber-600" />
              {timeInfo.relative || 'Upcoming'}
            </span>
          ) : null}
          {statusMeta && (
            <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1', statusMeta.bg, statusMeta.border, statusMeta.text)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', statusMeta.dot)} />
              {statusMeta.label}
            </span>
          )}
          {priorityMeta && (
            <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border', priorityMeta.bg, priorityMeta.border, priorityMeta.text)}>
              {priorityMeta.label} Priority
            </span>
          )}
          {isTask && item.recurring ? (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 border border-purple-500/30 text-purple-700 dark:text-purple-300">
              🔁 Recurring
            </span>
          ) : null}
          <div className="w-full mt-1">
            <span className="truncate max-w-full font-bold text-base text-[var(--text-main)] block">
              {item.title}
            </span>
          </div>
        </div>
      )}
      width="640px"
      footer={(
        <div className="flex flex-wrap justify-between items-center gap-2 w-full">
          <div className="flex items-center gap-2">
            {!followUpStatus.isCompleted && isReminder && canWriteLead && onCompleteFollowUp ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onCompleteFollowUp(item);
                }}
                className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 cursor-pointer shadow-xs"
              >
                <CheckCircle2 size={14} className="mr-1.5 text-emerald-600" />
                Complete Follow-Up
              </Button>
            ) : null}

            {canWriteLead && onEdit ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onEdit(item);
                }}
                className="cursor-pointer shadow-xs"
              >
                <Edit3 size={14} className="mr-1.5" />
                Edit {isLeadFollowUp ? 'Follow-Up' : isTask ? 'Task' : isReminder ? 'Reminder' : 'Activity'}
              </Button>
            ) : null}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="cursor-pointer">
            Close
          </Button>
        </div>
      )}
    >
      <div className="space-y-4 py-1">
        {/* Remark / Outcome Callout if Completed */}
        {followUpStatus.remark ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-600" />
              Follow-Up Outcome / Remark
            </h4>
            <p className="text-xs text-emerald-950 dark:text-emerald-100 whitespace-pre-wrap leading-relaxed">
              {followUpStatus.remark}
            </p>
          </div>
        ) : null}

        {/* Structured Task Info Grid */}
        {isTask ? (
          <div className="rounded-xl border border-[var(--border-muted)] bg-[var(--surface-2)]/60 p-4 space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[11px] font-medium text-[var(--text-muted)] block">👤 Assign to:</span>
                <span className="font-semibold text-[var(--text-main)] mt-0.5 block">{assignedName || 'Unassigned'}</span>
              </div>

              <div>
                <span className="text-[11px] font-medium text-[var(--text-muted)] block">👥 Collaborators:</span>
                <span className="font-semibold text-[var(--text-main)] mt-0.5 block">{collaboratorNames || 'None'}</span>
              </div>

              <div>
                <span className="text-[11px] font-medium text-[var(--text-muted)] block">📅 Start Date:</span>
                <span className="font-semibold text-[var(--text-main)] mt-0.5 block">{item.startDate ? formatDate(item.startDate) : '-'}</span>
              </div>

              <div>
                <span className="text-[11px] font-medium text-[var(--text-muted)] block">⏰ Deadline:</span>
                <span className="font-semibold text-[var(--text-main)] mt-0.5 block">{item.endDate || item.deadline ? formatDate(item.endDate || item.deadline) : '-'}</span>
              </div>

              <div>
                <span className="text-[11px] font-medium text-[var(--text-muted)] block">⭐ Story Points:</span>
                <span className="font-semibold text-[var(--text-main)] mt-0.5 block">{item.points ? `${item.points} Points` : '-'}</span>
              </div>

              <div>
                <span className="text-[11px] font-medium text-[var(--text-muted)] block">🔁 Recurring Task:</span>
                <span className="font-semibold text-[var(--text-main)] mt-0.5 block">{item.recurring ? 'Yes (Repeat task)' : 'No'}</span>
              </div>
            </div>

            {labelsList.length ? (
              <div className="border-t border-[var(--border-muted)]/60 pt-2.5">
                <span className="text-[11px] font-medium text-[var(--text-muted)] block mb-1.5">🏷️ Labels:</span>
                <div className="flex flex-wrap gap-1.5">
                  {labelsList.map((label) => (
                    <span key={label} className="rounded-md border border-[var(--border-muted)] bg-[var(--surface)] px-2 py-0.5 text-xs font-semibold text-[var(--text-main)]">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : isReminder ? (
          <div className="rounded-xl border border-[var(--border-muted)] bg-[var(--surface-2)]/60 p-4 space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[11px] font-medium text-[var(--text-muted)] block">📅 Scheduled Date:</span>
                <span className="font-semibold text-[var(--text-main)] mt-0.5 block">{item.startDate || item.date ? formatDate(item.startDate || item.date) : '-'}</span>
              </div>

              <div>
                <span className="text-[11px] font-medium text-[var(--text-muted)] block">⏰ Scheduled Time:</span>
                <span className="font-semibold text-[var(--text-main)] mt-0.5 block">{item.startTime || item.time || 'All day / Not set'}</span>
              </div>

              <div>
                <span className="text-[11px] font-medium text-[var(--text-muted)] block">📞 Follow-up Mode:</span>
                <span className="font-semibold text-[var(--text-main)] mt-0.5 block">{item.followUpMode || 'Phone / Call'}</span>
              </div>

              <div>
                <span className="text-[11px] font-medium text-[var(--text-muted)] block">⚡ Priority:</span>
                <span className="font-semibold text-[var(--text-main)] mt-0.5 block">{item.followUpPriority || 'Medium'}</span>
              </div>

              <div>
                <span className="text-[11px] font-medium text-[var(--text-muted)] block">👥 Assigned Team / User:</span>
                <span className="font-semibold text-[var(--text-main)] mt-0.5 block">{item.assignedTeam || (item.assignedTo ? userLookup?.get(String(item.assignedTo)) : null) || 'Unassigned'}</span>
              </div>

              <div>
                <span className="text-[11px] font-medium text-[var(--text-muted)] block">🔔 Reminder Alert:</span>
                <span className="font-semibold text-[var(--text-main)] mt-0.5 block">{item.reminder || 'Default Notification'}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--border-muted)] bg-[var(--surface-2)]/60 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span className="font-medium">Scheduled / Time:</span>
              <div className="flex items-center gap-1.5 font-semibold text-[var(--text-main)]">
                <Clock3 size={13} className="text-[var(--primary)]" />
                <span>{formatEventTime(item) || timeInfo.formatted}</span>
              </div>
            </div>

            {item.actorName && (
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)] border-t border-[var(--border-muted)]/60 pt-2">
                <span className="font-medium">Created / Logged by:</span>
                <span className="font-semibold text-[var(--text-main)]">{item.actorName}</span>
              </div>
            )}

            {item.location && (
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)] border-t border-[var(--border-muted)]/60 pt-2">
                <span className="font-medium">Location:</span>
                <span className="font-semibold text-[var(--text-main)]">{item.location}</span>
              </div>
            )}
          </div>
        )}

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
            Description / Content
          </h4>
          <div className="rounded-xl border border-[var(--border-muted)] bg-[var(--surface)] p-3.5 text-xs text-[var(--text-main)] leading-relaxed whitespace-pre-wrap min-h-[70px]">
            {item.description || item.detail || item.notes || 'No description provided.'}
          </div>
        </div>

        {Array.isArray(item.attachments) && item.attachments.length ? (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2 flex items-center gap-1.5">
              <Paperclip size={13} />
              Attachments ({item.attachments.length})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {item.attachments.map((file) => {
                const fileUrl = file.driveWebViewLink || file.webContentLink || file.url || `#${file.driveFileId || file.id}`;
                const downloadUrl = file.webContentLink || file.downloadUrl || file.driveWebViewLink || file.url;

                return (
                  <div
                    key={file.driveFileId || file.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-muted)] bg-[var(--surface-2)]/60 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--primary)] shrink-0">
                        <Paperclip size={13} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-[var(--text-main)]" title={file.name || file.title || 'File'}>
                          {file.name || file.title || 'File'}
                        </p>
                        {file.size ? (
                          <p className="text-[10px] text-[var(--text-muted)]">{file.size}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {file.driveWebViewLink || file.url ? (
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="View / Open File"
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--primary)] hover:border-[var(--primary)] transition cursor-pointer"
                        >
                          <Eye size={12} />
                        </a>
                      ) : null}

                      <a
                        href={downloadUrl}
                        download={file.name || 'download'}
                        target="_blank"
                        rel="noreferrer"
                        title="Download File"
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--primary)] hover:border-[var(--primary)] transition cursor-pointer"
                      >
                        <Download size={12} />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function CompleteFollowUpModal({
  open,
  onClose,
  item,
  lead,
  onComplete,
  busy = false
}) {
  const [outcome, setOutcome] = useState('connected');
  const [remark, setRemark] = useState('');
  const [scheduleNext, setScheduleNext] = useState(false);
  const [nextDate, setNextDate] = useState('');
  const [nextTime, setNextTime] = useState('');
  const [nextMode, setNextMode] = useState('Phone Call');
  const [nextNote, setNextNote] = useState('');
  const [cadenceInfo, setCadenceInfo] = useState(null);

  const currentAttempts = Number(lead?.followUpAttempts || 0);

  useEffect(() => {
    if (open) {
      setOutcome('connected');
      setRemark('');
      setScheduleNext(false);
      setNextDate('');
      setNextTime('');
      setNextMode('Phone Call');
      setNextNote('');
      setCadenceInfo(null);
    }
  }, [open]);

  if (!item) return null;

  function selectOutcome(key) {
    setOutcome(key);
    if (key === 'no_response') {
      const cadence = computeAutoCadence(currentAttempts);
      setCadenceInfo(cadence);
      setRemark(cadence.remark);
      if (cadence.isCold) {
        setScheduleNext(false);
        setNextDate('');
        setNextTime('');
      } else {
        setScheduleNext(true);
        setNextDate(cadence.date);
        setNextTime(cadence.time);
        setNextMode('Phone Call');
        setNextNote(`Auto-follow-up (Attempt ${cadence.nextAttempt}/3)`);
      }
    } else if (key === 'busy') {
      setCadenceInfo(null);
      setScheduleNext(true);
      setNextDate(getLocalDateStr());
      setNextTime('17:00');
      setNextMode('Phone Call');
      setRemark('Client was busy on call, requested callback later today.');
      setNextNote('Call back client');
    } else if (key === 'switched_off') {
      setCadenceInfo(null);
      setScheduleNext(true);
      const nextDay = new Date(Date.now() + 24 * 60 * 60 * 1000);
      setNextDate(nextDay.toISOString().slice(0, 10));
      setNextTime('12:00');
      setNextMode('Phone Call');
      setRemark('Phone switched off / Unreachable.');
      setNextNote('Retry call');
    } else {
      // connected
      setCadenceInfo(null);
      setRemark('');
      setScheduleNext(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!remark.trim()) {
      toast.error('Please enter a completion remark / outcome');
      return;
    }
    await onComplete({
      item,
      outcome,
      remark: remark.trim(),
      scheduleNext,
      nextDate,
      nextTime,
      nextMode,
      nextNote: nextNote.trim(),
      isCold: Boolean(cadenceInfo?.isCold)
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={(
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600">
            <CheckCircle2 size={16} />
          </div>
          <span className="font-bold text-base text-[var(--text-main)]">
            Complete Follow-Up / Reminder
          </span>
        </div>
      )}
      width="580px"
      footer={(
        <div className="flex justify-end gap-2.5">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={busy}
            className="bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs"
          >
            <CheckCircle2 size={14} className="mr-1.5" />
            {busy ? 'Saving...' : 'Mark as Completed'}
          </Button>
        </div>
      )}
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-1">
        {/* Context Summary */}
        <div className="rounded-xl border border-[var(--border-muted)] bg-[var(--surface-2)]/60 p-3.5 space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span className="font-medium">Follow-Up Item:</span>
            <span className="font-bold text-[var(--text-main)]">{item.title}</span>
          </div>
          <div className="flex items-center justify-between text-[var(--text-muted)] border-t border-[var(--border-muted)]/50 pt-1.5">
            <span className="font-medium">Scheduled Date:</span>
            <span className="font-semibold text-[var(--text-main)]">
              {item.startDate || item.date ? formatDate(item.startDate || item.date) : '-'} {item.startTime ? `• ${item.startTime}` : ''}
            </span>
          </div>
        </div>

        {/* Quick Outcome Selector */}
        <div>
          <label className="block text-xs font-bold text-[var(--text-main)] mb-1.5">
            Select Call / Contact Outcome:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => selectOutcome('connected')}
              className={cn(
                'flex flex-col items-center justify-center p-2 rounded-xl border text-center transition cursor-pointer',
                outcome === 'connected'
                  ? 'bg-emerald-500/15 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold shadow-2xs'
                  : 'bg-[var(--surface-2)] border-[var(--border-muted)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-3)]'
              )}
            >
              <span className="text-base mb-0.5">🟢</span>
              <span className="text-[11px] leading-tight">Connected / Spoke</span>
            </button>

            <button
              type="button"
              onClick={() => selectOutcome('no_response')}
              className={cn(
                'flex flex-col items-center justify-center p-2 rounded-xl border text-center transition cursor-pointer',
                outcome === 'no_response'
                  ? 'bg-red-500/15 border-red-500 text-red-800 dark:text-red-300 font-bold shadow-2xs ring-1 ring-red-400'
                  : 'bg-[var(--surface-2)] border-[var(--border-muted)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-3)]'
              )}
            >
              <span className="text-base mb-0.5">🔴</span>
              <span className="text-[11px] leading-tight">No Response (Auto)</span>
            </button>

            <button
              type="button"
              onClick={() => selectOutcome('busy')}
              className={cn(
                'flex flex-col items-center justify-center p-2 rounded-xl border text-center transition cursor-pointer',
                outcome === 'busy'
                  ? 'bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-300 font-bold shadow-2xs'
                  : 'bg-[var(--surface-2)] border-[var(--border-muted)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-3)]'
              )}
            >
              <span className="text-base mb-0.5">🟡</span>
              <span className="text-[11px] leading-tight">Busy / Callback</span>
            </button>

            <button
              type="button"
              onClick={() => selectOutcome('switched_off')}
              className={cn(
                'flex flex-col items-center justify-center p-2 rounded-xl border text-center transition cursor-pointer',
                outcome === 'switched_off'
                  ? 'bg-orange-500/15 border-orange-500 text-orange-800 dark:text-orange-300 font-bold shadow-2xs'
                  : 'bg-[var(--surface-2)] border-[var(--border-muted)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-3)]'
              )}
            >
              <span className="text-base mb-0.5">🟠</span>
              <span className="text-[11px] leading-tight">Switched Off</span>
            </button>
          </div>
        </div>

        {/* Auto Cadence Notice */}
        {outcome === 'no_response' && cadenceInfo && (
          <div className={cn(
            'rounded-xl border p-3 text-xs space-y-1',
            cadenceInfo.isCold
              ? 'border-red-500/30 bg-red-500/10 text-red-900 dark:text-red-200'
              : 'border-blue-500/30 bg-blue-500/10 text-blue-900 dark:text-blue-200'
          )}>
            <div className="flex items-center gap-1.5 font-bold">
              <span>{cadenceInfo.isCold ? '❄️ 3rd Attempt Exceeded' : '⚡ Smart Cadence Activated'}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/40 dark:bg-black/20">
                Attempt {currentAttempts + 1}/3
              </span>
            </div>
            <p className="text-[11px] leading-relaxed">
              {cadenceInfo.isCold
                ? 'No response after 3 attempts. Submitting will automatically transition this lead to Unresponsive / Cold Lead and close active follow-ups.'
                : `Next follow-up automatically calculated for ${cadenceInfo.date === getLocalDateStr() ? 'today at ' + cadenceInfo.time : 'next day (' + formatDate(cadenceInfo.date) + ') at ' + cadenceInfo.time}.`}
            </p>
          </div>
        )}

        {/* 1-Click WhatsApp Quick Nudge with Dynamic Outcome Template */}
        {(lead?.phone || lead?.mobile) && (() => {
          const outcomeLabels = {
            connected: { title: 'Post-Call Summary', sub: 'Send discussion summary & next steps' },
            no_response: { title: 'Missed Call Nudge', sub: 'Send missed call & convenient time request' },
            busy: { title: 'Busy / Callback Later', sub: 'Send acknowledgement for callback later' },
            switched_off: { title: 'Unreachable / Switched Off', sub: 'Send unreachable alert & alternate contact request' }
          };
          const meta = outcomeLabels[outcome] || outcomeLabels.connected;
          const previewText = getWhatsAppMessage(lead.name || lead.contactPerson, outcome, lead.serviceName);

          return (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-600 text-white shrink-0">
                    <MessageCircle size={13} />
                  </div>
                  <div className="truncate">
                    <span className="font-bold text-emerald-950 dark:text-emerald-200 block truncate">
                      WhatsApp: {lead.phone || lead.mobile} ({meta.title})
                    </span>
                    <span className="text-[10px] text-emerald-800 dark:text-emerald-300 block">
                      {meta.sub}
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => openWhatsAppNudge(lead.phone || lead.mobile, lead.name || lead.contactPerson, outcome, lead.serviceName)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 h-7 text-xs shadow-xs shrink-0 cursor-pointer font-semibold"
                >
                  <Send size={12} className="mr-1.5" />
                  Send WhatsApp
                </Button>
              </div>

              {/* Message Preview Box */}
              <div className="rounded-lg bg-white/70 dark:bg-slate-900/60 border border-emerald-500/20 p-2 text-[11px] text-emerald-950 dark:text-emerald-200 italic leading-relaxed whitespace-pre-wrap">
                💬 "{previewText}"
              </div>
            </div>
          );
        })()}

        {/* Remark / Outcome */}
        <div>
          <label className="block text-xs font-bold text-[var(--text-main)] mb-1.5">
            Follow-Up Outcome / Completion Remark <span className="text-red-500">*</span>
          </label>
          <Textarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="e.g. Spoke with client, discussed requirements and budget. Client agreed to proceed, requested revised quotation."
            rows={3}
            autoFocus
            className="rounded-xl text-xs"
          />
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            Mention the key summary, discussion points, or next action decided in this follow-up.
          </p>
        </div>

        {/* Schedule Next Follow-up Toggle */}
        <div className="rounded-xl border border-[var(--border-muted)] bg-[var(--surface)] p-3.5 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={scheduleNext}
              onChange={(e) => setScheduleNext(e.target.checked)}
              className="!appearance-auto"
              style={{ accentColor: 'var(--primary)' }}
            />
            <span className="text-xs font-bold text-[var(--text-main)]">
              Schedule Next Follow-Up for this Lead
            </span>
          </label>

          {scheduleNext && (
            <div className="space-y-3 pt-2 border-t border-[var(--border-muted)]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                    Next Follow-Up Date *
                  </label>
                  <Input
                    type="date"
                    value={nextDate}
                    onChange={(e) => setNextDate(e.target.value)}
                    className="rounded-lg text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                    Next Follow-Up Time
                  </label>
                  <Input
                    type="time"
                    value={nextTime}
                    onChange={(e) => setNextTime(e.target.value)}
                    className="rounded-lg text-xs"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {[
                      { val: '10:00', label: '10:00 AM' },
                      { val: '11:30', label: '11:30 AM' },
                      { val: '14:00', label: '02:00 PM' },
                      { val: '16:00', label: '04:00 PM' },
                      { val: '18:00', label: '06:00 PM' }
                    ].map((slot) => (
                      <button
                        key={slot.val}
                        type="button"
                        onClick={() => setNextTime(slot.val)}
                        className={cn(
                          'px-1.5 py-0.5 rounded text-[10px] font-medium border transition cursor-pointer',
                          nextTime === slot.val
                            ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                            : 'bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--border-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-3)]'
                        )}
                      >
                        {slot.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                    Follow-Up Mode
                  </label>
                  <SearchableSelect
                    value={nextMode}
                    onChange={(val) => setNextMode(val)}
                    options={[
                      { value: 'Phone Call', label: 'Phone Call' },
                      { value: 'Meeting', label: 'Meeting' },
                      { value: 'WhatsApp', label: 'WhatsApp' },
                      { value: 'Email', label: 'Email' }
                    ]}
                    allowClear={false}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                    Next Note / Goal
                  </label>
                  <Input
                    value={nextNote}
                    onChange={(e) => setNextNote(e.target.value)}
                    placeholder="e.g. Send revised contract"
                    className="rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
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
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);

  const [contactOpen, setContactOpen] = useState(false);
  const [contactBusy, setContactBusy] = useState(false);
  const [contactEdit, setContactEdit] = useState(null);
  const [contactDeleteTarget, setContactDeleteTarget] = useState(null);

  const [activityType, setActivityType] = useState(null);
  const [activityEdit, setActivityEdit] = useState(null);
  const [activityBusy, setActivityBusy] = useState(false);
  const [activityDeleteTarget, setActivityDeleteTarget] = useState(null);
  const [viewActivityTarget, setViewActivityTarget] = useState(null);
  const [completeFollowUpTarget, setCompleteFollowUpTarget] = useState(null);
  const [completeFollowUpBusy, setCompleteFollowUpBusy] = useState(false);

  const [settings, setSettings] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [openDetailSections, setOpenDetailSections] = useState({});
  const [tabPages, setTabPages] = useState({
    timeline: 1,
    quotations: 1,
    tasks: 1,
    notes: 1,
    reminders: 1,
    contacts: 1,
    files: 1
  });

  const setTabPage = (tabKey, page) => {
    setTabPages((cur) => ({ ...cur, [tabKey]: page }));
  };

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
    setTabPages({
      timeline: 1,
      quotations: 1,
      tasks: 1,
      notes: 1,
      reminders: 1,
      contacts: 1,
      files: 1
    });
  }, [id]);

  const lead = data?.lead || null;
  const contacts = data?.contacts || [];
  const events = data?.events || [];
  const timeline = data?.timeline || [];
  const sortedTimeline = useMemo(() => {
    return [...(data?.timeline || [])].sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt || 0).getTime();
      const dateB = new Date(b.date || b.createdAt || 0).getTime();
      if (!isNaN(dateA) && !isNaN(dateB) && dateA !== dateB) {
        return dateB - dateA;
      }
      return String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || ''));
    });
  }, [data?.timeline]);
  const summary = data?.summary || {};
  const userOptions = useMemo(() => normalizeUserOptions(users), [users]);
  const userLookup = useMemo(() => new Map(userOptions.map((item) => [String(item.value), item.label])), [userOptions]);
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

  const winProbability = useMemo(() => {
    if (lead?.conversionProbability != null && lead?.conversionProbability !== '') {
      const num = Number(lead.conversionProbability);
      return Number.isFinite(num) ? num : null;
    }
    return null;
  }, [lead?.conversionProbability]);

  const leadScore = useMemo(() => {
    if (lead?.leadScore != null && lead?.leadScore !== '') {
      const num = Number(lead.leadScore);
      return Number.isFinite(num) ? num : null;
    }
    return null;
  }, [lead?.leadScore]);

  const quotationAlert = useMemo(() => {
    if (!quotationRows.length) return null;
    const q = quotationRows[0];
    if (!q) return null;

    const proposalDateStr = q.proposalDate ? formatDate(q.proposalDate) : null;
    const validUntilDateStr = q.validUntil ? formatDate(q.validUntil) : null;

    if (!q.validUntil) {
      if (proposalDateStr) {
        return {
          type: 'info',
          text: `Proposal sent on ${proposalDateStr}`,
          status: q.status
        };
      }
      return null;
    }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const validUntil = new Date(q.validUntil);
      validUntil.setHours(0, 0, 0, 0);

      const diffMs = validUntil.getTime() - today.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        return {
          type: 'expired',
          text: `${proposalDateStr ? `Proposal sent on ${proposalDateStr} • ` : ''}Expired on ${validUntilDateStr} (${Math.abs(diffDays)}d ago)`,
          status: q.status
        };
      } else if (diffDays === 0) {
        return {
          type: 'expiring_today',
          text: `${proposalDateStr ? `Proposal sent on ${proposalDateStr} • ` : ''}Valid until today (Expires today)`,
          status: q.status
        };
      } else if (diffDays <= 7) {
        return {
          type: 'expiring_soon',
          text: `${proposalDateStr ? `Proposal sent on ${proposalDateStr} • ` : ''}Valid until ${validUntilDateStr} (Expiring in ${diffDays} day${diffDays > 1 ? 's' : ''})`,
          status: q.status
        };
      } else {
        return {
          type: 'valid',
          text: `${proposalDateStr ? `Proposal sent on ${proposalDateStr} • ` : ''}Valid until ${validUntilDateStr} (${diffDays} days left)`,
          status: q.status
        };
      }
    } catch {
      return {
        type: 'info',
        text: `Proposal valid until ${validUntilDateStr}`,
        status: q.status
      };
    }
  }, [quotationRows]);

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
    return Array.from(new Set(values)).map((item) => ({
      value: item,
      label: item,
      color: getLeadStatusColor(item, statusColors)
    }));
  }, [lead?.status, settings, leadOptions.statuses, wonStatusLabel, statusColors]);

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
        relatedEntityType: 'Lead',
        relatedEntityId: id,
        relatedEntityLabel: lead?.title || lead?.companyName || lead?.contactPersonName || 'Lead',
        lockRelatedEntity: true,
        assignedTo: lead?.assignedTo || user?.id || '',
        title: lead?.title ? `Follow-up with ${lead.title}` : '',
        followUpType: 'Call',
        purpose: '',
        priority: 'Medium',
        date: baseDate || '',
        time: '10:00',
        description: ''
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
    if (!event) return;
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
    if (nextType === 'reminder') {
      setActivityEdit({
        id: event.followUpId || (event.id && !event.isSynthetic && !String(event.id).startsWith('follow-up-') ? event.id : undefined),
        relatedEntityType: 'Lead',
        relatedEntityId: id,
        relatedEntityLabel: lead?.title || lead?.companyName || lead?.contactPersonName || 'Lead',
        lockRelatedEntity: true,
        assignedTo: event.assignedTo || lead?.assignedTo || user?.id || '',
        title: event.title || '',
        followUpType: event.followUpType || event.followUpMode || 'Call',
        purpose: event.purpose || '',
        priority: event.priority || event.followUpPriority || 'Medium',
        date: formatDateOnlyInput(event.startDate || event.date || event.endDate),
        time: event.startTime || event.time || '10:00',
        description: event.description || event.notes || ''
      });
      return;
    }
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
        description: lead.followUpNote || lead.notes || 'Lead follow-up reminder',
        startDate: lead.followUpDate,
        endDate: lead.followUpDate,
        startTime: lead.nextFollowUpTime || lead.followUpTime || '',
        endTime: '',
        followUpMode: lead.followUpMode,
        followUpPriority: lead.followUpPriority,
        reminder: lead.reminder,
        assignedTeam: lead.assignedTeam,
        assignedTo: lead.assignedTo,
        isSynthetic: true,
        isLeadFollowUp: true
      }]
      : [];
    const allReminders = [
      ...followUpReminder,
      ...events.filter((event) => ['reminder'].includes(String(event.eventType || event.type || '').toLowerCase()))
    ];

    const now = Date.now();
    const sortedReminders = [...allReminders].sort((a, b) => {
      const aDate = String(a.startDate || a.date || a.endDate || a.createdAt || '');
      const bDate = String(b.startDate || b.date || b.endDate || b.createdAt || '');
      const aTime = aDate ? new Date(`${aDate} ${a.startTime || a.time || '00:00'}`).getTime() : 0;
      const bTime = bDate ? new Date(`${bDate} ${b.startTime || b.time || '00:00'}`).getTime() : 0;

      const aIsUpcoming = !isNaN(aTime) && aTime >= now;
      const bIsUpcoming = !isNaN(bTime) && bTime >= now;

      // Upcoming reminders come first
      if (aIsUpcoming && !bIsUpcoming) return -1;
      if (!aIsUpcoming && bIsUpcoming) return 1;

      if (aIsUpcoming && bIsUpcoming) {
        // Both upcoming: earliest date first (ascending order: e.g. Aug 22 before Sept 23)
        if (aTime !== bTime) return aTime - bTime;
        return aDate.localeCompare(bDate);
      }

      // If both are past: most recent past first
      if (aTime !== bTime) return bTime - aTime;
      return bDate.localeCompare(aDate);
    });

    return {
      task: bucket(['task']),
      note: bucket(['note']),
      reminder: sortedReminders
    };
  }, [events, lead?.followUpDate, lead?.id, lead?.notes, lead?.followUpNote, lead?.nextFollowUpTime, lead?.followUpTime, lead?.followUpMode, lead?.followUpPriority, lead?.reminder, lead?.assignedTeam, lead?.assignedTo]);

  const [taskStatusFilter, setTaskStatusFilter] = useState('all');

  const taskStatusCounts = useMemo(() => {
    const counts = { all: activityBuckets.task.length, 'to do': 0, 'in progress': 0, 'completed': 0, 'blocked': 0 };
    activityBuckets.task.forEach((task) => {
      const st = String(task.status || 'to do').toLowerCase().trim();
      if (counts[st] !== undefined) {
        counts[st] += 1;
      } else {
        counts['to do'] += 1;
      }
    });
    return counts;
  }, [activityBuckets.task]);

  const filteredTasks = useMemo(() => {
    if (taskStatusFilter === 'all') return activityBuckets.task;
    return activityBuckets.task.filter((task) => {
      const st = String(task.status || 'to do').toLowerCase().trim();
      return st === taskStatusFilter.toLowerCase().trim();
    });
  }, [activityBuckets.task, taskStatusFilter]);

  const [reminderStatusFilter, setReminderStatusFilter] = useState('all');

  const reminderStatusCounts = useMemo(() => {
    const todayStr = getLocalDateStr();
    let today = 0;
    let upcoming = 0;
    let past = 0;
    let completed = 0;

    activityBuckets.reminder.forEach((r) => {
      const { isCompleted } = getFollowUpStatus(r);
      if (isCompleted) {
        completed += 1;
        return;
      }
      const rawDate = r.startDate || r.date || r.endDate || '';
      const itemDate = rawDate.slice(0, 10);
      if (itemDate === todayStr) {
        today += 1;
      } else if (itemDate > todayStr || (!itemDate && new Date(r.createdAt).getTime() >= Date.now())) {
        upcoming += 1;
      } else {
        past += 1;
      }
    });
    return { all: activityBuckets.reminder.length, today, upcoming, past, completed };
  }, [activityBuckets.reminder]);

  const filteredReminders = useMemo(() => {
    if (reminderStatusFilter === 'all') return activityBuckets.reminder;
    const todayStr = getLocalDateStr();

    return activityBuckets.reminder.filter((r) => {
      const { isCompleted } = getFollowUpStatus(r);
      if (reminderStatusFilter === 'completed') return isCompleted;
      if (isCompleted) return false;

      const rawDate = r.startDate || r.date || r.endDate || '';
      const itemDate = rawDate.slice(0, 10);

      if (reminderStatusFilter === 'today') {
        return itemDate === todayStr;
      }
      if (reminderStatusFilter === 'upcoming') {
        return itemDate > todayStr || (!itemDate && new Date(r.createdAt).getTime() >= Date.now());
      }
      if (reminderStatusFilter === 'past') {
        return itemDate < todayStr;
      }
      return true;
    });
  }, [activityBuckets.reminder, reminderStatusFilter]);

  const tabs = useMemo(() => [
    { key: 'overview', label: 'Overview', icon: Activity },
    { key: 'details', label: 'Lead Details', icon: FileText },
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

      const isConnected = ['Connected', 'Interested', 'Discussion Done', 'Call Connected', 'Proposal Requested'].some(
        (o) => String(payload.callOutcome || '').toLowerCase().includes(o.toLowerCase())
      );

      // If call is Connected, reset followUpAttempts to 0 and revive lead if cold/lost
      if (isConnected && ((lead?.followUpAttempts || 0) > 0 || ['Lost', 'Cold', 'Unresponsive'].includes(lead?.status))) {
        await api.resources.update('/leads', id, {
          ...lead,
          followUpAttempts: 0,
          status: ['Lost', 'Cold', 'Unresponsive'].includes(lead?.status) ? 'Follow-up' : lead?.status
        }, token);
      }

      api.cache.invalidate('/leads');
      toast.success(isConnected ? 'Call logged & auto-cadence reset to active' : 'Call logged');
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
      if (activityEdit?.id === `follow-up-${id}` || activityEdit?.isSynthetic || activityEdit?.isLeadFollowUp) {
        await api.resources.update('/leads', id, {
          ...lead,
          followUpDate: payload.startDate || payload.date || '',
          nextFollowUpTime: payload.startTime || payload.time || '',
          followUpNote: payload.description || lead?.followUpNote || '',
          notes: payload.description || lead?.notes || ''
        }, token);
        api.cache.invalidate('/leads');
        api.cache.invalidate('/follow-ups');
        toast.success('Lead follow-up updated');
        setActivityType(null);
        setActivityEdit(null);
        await load();
        return;
      }

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

        if (type === 'reminder' && (payload.startDate || payload.date)) {
          const dueAt = `${payload.startDate || payload.date}T${payload.startTime || payload.time || '10:00'}:00+05:30`;
          await api.followUps.create(token, {
            relatedEntityType: 'Lead',
            relatedEntityId: id,
            title: payload.title || `Follow-up with ${lead.title || lead.companyName || 'Lead'}`,
            description: payload.description || '',
            followUpType: payload.followUpMode || 'Call',
            dueAt,
            priority: payload.priority || 'High',
            assignedTo: payload.assignedTo || lead?.assignedTo || user?.id
          }).catch(() => {});
        }
      }
      api.cache.invalidate('/leads');
      api.cache.invalidate('/follow-ups');
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
      if (activityDeleteTarget.id === `follow-up-${id}` || activityDeleteTarget.isSynthetic || activityDeleteTarget.isLeadFollowUp) {
        await api.resources.update('/leads', id, {
          ...lead,
          followUpDate: '',
          nextFollowUpTime: '',
          followUpMode: '',
          followUpPriority: '',
          followUpNote: ''
        }, token);
        api.cache.invalidate('/leads');
        api.cache.invalidate('/follow-ups');
        toast.success('Lead follow-up deleted');
        setActivityDeleteTarget(null);
        await load();
        return;
      }

      if (activityDeleteTarget.payload?.followUpId || (activityDeleteTarget.id && String(activityDeleteTarget.id).startsWith('fu_'))) {
        const targetFuId = activityDeleteTarget.payload?.followUpId || activityDeleteTarget.id;
        await api.followUps.remove(token, targetFuId).catch(() => {});
      }

      const type = String(activityDeleteTarget?.eventType || activityDeleteTarget?.type || 'event').toLowerCase();
      const route = type === 'event' ? '/events' : '/lead-events';
      await api.resources.remove(route, activityDeleteTarget.id, token);
      api.cache.invalidate('/leads');
      api.cache.invalidate('/follow-ups');
      toast.success('Activity deleted');
      setActivityDeleteTarget(null);
      await load();
    } catch (error) {
      toast.error(error.message || 'Failed to delete activity');
    }
  }

  async function quickRescheduleReminder(item, targetDateStr, targetTimeStr, label) {
    try {
      if (item.id === `follow-up-${id}` || item.isSynthetic || item.isLeadFollowUp) {
        await api.resources.update('/leads', id, {
          ...lead,
          followUpDate: targetDateStr,
          nextFollowUpTime: targetTimeStr
        }, token);
      } else {
        await api.resources.update('/lead-events', item.id, {
          ...item,
          startDate: targetDateStr,
          endDate: targetDateStr,
          startTime: targetTimeStr
        }, token);
      }

      if (item.payload?.followUpId || (item.id && String(item.id).startsWith('fu_'))) {
        const targetFuId = item.payload?.followUpId || item.id;
        await api.followUps.reschedule(token, targetFuId, {
          date: targetDateStr,
          time: targetTimeStr,
          reason: `Quick reschedule to ${label}`
        }).catch(() => {});
      }

      api.cache.invalidate('/leads');
      api.cache.invalidate('/follow-ups');
      toast.success(`Rescheduled to ${label}`);
      await load();
    } catch (error) {
      toast.error(error.message || 'Failed to reschedule');
    }
  }

  async function handleCompleteFollowUp({
    item,
    outcome = 'connected',
    remark,
    scheduleNext,
    nextDate,
    nextTime,
    nextMode,
    nextNote,
    isCold = false
  }) {
    setCompleteFollowUpBusy(true);
    try {
      const todayDate = new Date().toISOString().slice(0, 10);
      const currentAttempts = Number(lead?.followUpAttempts || 0);
      const nextAttempts = outcome === 'no_response' ? currentAttempts + 1 : 0;

      const completionNote = `[Completed: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} - Outcome: ${outcome || 'Done'}]\nRemark: ${remark.trim()}`;
      const combinedDescription = item.description
        ? `${item.description}\n\n${completionNote}`
        : completionNote;

      // 1. Create or update event record in lead-events as Completed with Remark
      if (item.id && !item.isSynthetic && !item.isLeadFollowUp) {
        await api.resources.update('/lead-events', item.id, {
          ...item,
          status: 'Completed',
          title: item.title?.startsWith('Completed:') ? item.title : `Completed: ${item.title}`,
          description: combinedDescription,
          labels: [...(Array.isArray(item.labels) ? item.labels.filter((l) => l !== 'completed') : []), 'completed', `outcome:${outcome}`],
          color: '#10b981'
        }, token);
      } else {
        await api.resources.create('/lead-events', {
          leadId: id,
          eventType: 'reminder',
          title: `Completed: ${item.title || 'Lead follow-up'}`,
          description: combinedDescription,
          startDate: item.startDate || lead?.followUpDate || todayDate,
          endDate: item.endDate || lead?.followUpDate || todayDate,
          startTime: item.startTime || lead?.nextFollowUpTime || '',
          labels: ['completed', 'follow-up', `outcome:${outcome}`],
          color: '#10b981'
        }, token);
      }

      if (item.payload?.followUpId || (item.id && String(item.id).startsWith('fu_'))) {
        const targetFuId = item.payload?.followUpId || item.id;
        const actualOutcomeMap = {
          connected: 'Connected',
          no_response: 'No Response',
          busy: 'Busy',
          switched_off: 'Switched Off'
        };
        await api.followUps.complete(token, targetFuId, {
          actualOutcome: actualOutcomeMap[outcome] || 'Connected',
          communicationResult: actualOutcomeMap[outcome] || 'Connected',
          discussionNote: remark.trim() || 'Completed from lead page',
          nextFollowUpDate: scheduleNext && nextDate ? nextDate : '',
          nextFollowUpTime: scheduleNext && nextTime ? nextTime : '',
          noNextFollowUpReason: !scheduleNext ? 'Follow-up completed' : ''
        }).catch(() => {});
      }

      // 2. Update Lead metadata, status, cadence attempts
      const updatedNotes = `${lead.notes || ''}\n[Follow-Up ${new Date().toLocaleDateString()}]: ${remark.trim()}`.trim();

      let nextLeadStatus = lead.status;
      if (isCold || (outcome === 'no_response' && nextAttempts >= 3)) {
        // 3 failed attempts: Move to Cold / Unresponsive (or Lost)
        nextLeadStatus = 'Lost';
      } else if (outcome === 'connected') {
        if (['Lost', 'Cold', 'Unresponsive'].includes(lead.status)) {
          nextLeadStatus = 'Follow-up';
        }
      }

      const leadPayload = {
        ...lead,
        followUpAttempts: isCold ? 0 : nextAttempts,
        status: nextLeadStatus,
        followUpDate: scheduleNext && nextDate ? nextDate : '',
        nextFollowUpTime: scheduleNext && nextTime ? nextTime : '',
        followUpMode: scheduleNext ? (nextMode || lead.followUpMode || 'Phone Call') : '',
        followUpNote: scheduleNext ? (nextNote || '') : '',
        notes: updatedNotes
      };

      if (isCold || (outcome === 'no_response' && nextAttempts >= 3)) {
        leadPayload.lostReason = 'Unresponsive / No reply after 3 attempts';
      }

      await api.resources.update('/leads', id, leadPayload, token);

      api.cache.invalidate('/leads');
      api.cache.invalidate('/follow-ups');
      if (isCold || (outcome === 'no_response' && nextAttempts >= 3)) {
        toast.success('Lead marked as Unresponsive / Cold after 3 attempts');
      } else if (outcome === 'no_response') {
        toast.success(`Auto follow-up scheduled (Attempt ${nextAttempts}/3)`);
      } else {
        toast.success('Follow-up completed!');
      }
      setCompleteFollowUpTarget(null);
      if (viewActivityTarget) setViewActivityTarget(null);
      await load();
    } catch (error) {
      toast.error(error.message || 'Failed to complete follow-up');
    } finally {
      setCompleteFollowUpBusy(false);
    }
  }

  if (loading) return <PageLoader />;
  if (!lead) return null;

  return (
    <div className="space-y-5 overflow-hidden">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/app/leads')}
                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
              >
                <ArrowLeft size={16} />
                Back to Leads
              </button>
              <span className="text-[var(--text-muted)] opacity-40">/</span>
              <h1 className="min-w-0 max-w-full truncate text-base font-semibold tracking-tight text-[var(--text-main)]">
                {lead.companyName || lead.name}
              </h1>
              {lead.leadNumber ? <span className="text-xs font-semibold text-[var(--text-muted)]">{lead.leadNumber}</span> : null}
            </div>
            <div className="space-y-2">
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[var(--border-muted)] bg-[var(--surface-2)] px-3 py-1 text-xs font-medium text-[var(--text-muted)]">
                  {lead.type || 'Organization'}
                </span>
                {renderStatusPill(lead.status, getLeadStatusColor(lead.status, statusColors))}
                {normalizeLabels(lead.labels).slice(0, 3).map((label) => (
                  <span key={label}>{renderLabelPill(label, labelColorMap.get(label) || '#2563eb')}</span>
                ))}

                {lead.followUpAttempts > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300 shadow-2xs">
                    <span>⚡</span> Auto Follow-Up (Attempt {lead.followUpAttempts}/3)
                  </span>
                ) : null}

                {/* 🎯 Deal Probability / Score Indicator */}
                {winProbability != null ? (
                  <span className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-2xs',
                    winProbability >= 70
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : winProbability >= 40
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                        : 'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300'
                  )}>
                    <span>🎯</span> {winProbability}% Win Chance
                  </span>
                ) : null}

                {leadScore != null ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:text-violet-300 shadow-2xs">
                    <span>⭐</span> Score: {leadScore}
                  </span>
                ) : null}
              </div>

              {/* 📅 Quotation Expiry / Validity Alert */}
              {quotationAlert ? (
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <div className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-medium transition shadow-2xs',
                    quotationAlert.type === 'expired'
                      ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
                      : (quotationAlert.type === 'expiring_soon' || quotationAlert.type === 'expiring_today')
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                        : 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                  )}>
                    <Clock3 size={13} className="shrink-0" />
                    <span>{quotationAlert.text}</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('quotations')}
                      className="ml-1 font-bold underline hover:opacity-80 cursor-pointer"
                    >
                      View
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            {canWriteLead ? (
              <div className="w-52 min-w-[190px]">
                <SearchableSelect
                  value={lead.status || ''}
                  onChange={changeLeadStatus}
                  options={leadStatusOptions}
                  placeholder="Change status"
                  triggerClassName="h-9 px-3 text-xs font-semibold rounded-xl bg-[var(--surface)] hover:bg-[var(--hover-bg)] border-[var(--border)] shadow-xs transition"
                />
              </div>
            ) : null}
            {canWriteLead ? (
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3.5 text-xs font-semibold rounded-xl border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--hover-bg)] text-[var(--text-main)] shadow-xs transition cursor-pointer"
                onClick={() => setCallOpen(true)}
              >
                <Phone size={14} className="mr-1.5 text-emerald-600 dark:text-emerald-400" /> Log Call
              </Button>
            ) : null}
            {canWriteLead ? (
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3.5 text-xs font-semibold rounded-xl border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--hover-bg)] text-[var(--text-main)] shadow-xs transition cursor-pointer"
                onClick={() => setEditingLeadOpen(true)}
              >
                <Edit3 size={14} className="mr-1.5 text-blue-600 dark:text-blue-400" /> Edit Lead
              </Button>
            ) : null}
            {canWriteLead && isLost ? (
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3.5 text-xs font-semibold rounded-xl border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 shadow-xs transition cursor-pointer"
                onClick={reopenLead}
                disabled={savingMeta}
              >
                <RefreshCcw size={14} className="mr-1.5" /> Reopen
              </Button>
            ) : null}
            {canWriteLead && !isWon && !isLost ? (
              <Button
                size="sm"
                className="h-9 px-4 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs border border-emerald-600 transition cursor-pointer"
                onClick={() => changeLeadStatus(wonStatusLabel)}
                disabled={savingMeta}
              >
                <CheckCircle2 size={15} className="mr-1.5" /> Mark Won
              </Button>
            ) : null}
            {canConvertLead && isWon && !lead.convertedClientId ? (
              <Button
                size="sm"
                className="h-9 px-4 text-xs font-semibold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xs border border-transparent transition cursor-pointer"
                onClick={() => setConvertOpen(true)}
              >
                <Wand2 size={15} className="mr-1.5" /> Convert Lead
              </Button>
            ) : null}
            {lead.convertedClientId ? (
              <Button
                size="sm"
                className="h-9 px-4 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
                onClick={() => navigate(`/app/clients/${lead.convertedClientId}`)}
              >
                <UserPlus size={15} className="mr-1.5" /> View Client
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto border-b border-[var(--border)] px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-t-lg border-b-2 px-3 py-3 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer',
                activeTab === tab.key
                  ? 'border-[var(--primary)] bg-[var(--primary-subtle)] text-[var(--primary)]'
                  : 'border-transparent text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)]'
              )}
            >
              {Icon && <Icon size={16} className={activeTab === tab.key ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'} />}
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className={cn('grid gap-6', (activeTab === 'overview' || activeTab === 'details') ? 'xl:grid-cols-[minmax(0,1.8fr)_380px]' : 'xl:grid-cols-1')}>
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* 1. Commercial Highlights (Budget, Quotation & Services) */}
              <Card className="flex flex-col gap-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 dark:bg-cyan-500/10 p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-500/15 pb-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                      <Tag size={20} strokeWidth={2} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Commercial Overview</p>
                      <h3 className="text-sm font-bold text-[var(--text-main)]">Budget & Quotation</h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-[var(--text-muted)]">Status:</span>
                    <span className={cn(
                      'inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                      String(quotationStatus).toLowerCase() === 'sent'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : String(quotationStatus).toLowerCase() === 'approved'
                          ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300'
                          : String(quotationStatus).toLowerCase() === 'not sent'
                            ? 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
                            : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300'
                    )}>
                      {quotationStatus}
                    </span>
                    {canWriteLead ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openActivity('quotation')}
                        className="h-7 text-xs px-2.5 ml-1 border-cyan-500/30 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10 cursor-pointer"
                      >
                        <PlusCircle size={13} className="mr-1" />
                        {quotationAmount != null ? 'New Quotation' : 'Add Quotation'}
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {/* Metric 1: Client Budget */}
                  <div className="rounded-xl border border-cyan-500/15 bg-[var(--surface)]/80 p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between gap-1">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Client Budget</span>
                      {lead?.budgetConfirmed != null ? (
                        <span className={cn(
                          'rounded-sm px-1 py-0.2 text-[9px] font-bold uppercase',
                          lead.budgetConfirmed ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-slate-500/15 text-slate-500'
                        )}>
                          {lead.budgetConfirmed ? 'Confirmed' : 'Estimated'}
                        </span>
                      ) : null}
                    </div>
                    <span className="mt-1.5 block text-base font-bold text-[var(--text-main)] truncate" title={formatLeadAmount(clientBudget, lead?.currency)}>
                      {formatLeadAmount(clientBudget, lead?.currency)}
                    </span>
                  </div>

                  {/* Metric 2: Quotation Value */}
                  <div className="rounded-xl border border-cyan-500/15 bg-[var(--surface)]/80 p-3.5 shadow-2xs">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Quotation Value</span>
                    <span className="mt-1.5 block text-base font-bold text-[var(--text-main)] truncate" title={quotationAmount != null ? formatLeadAmount(quotationAmount, lead?.currency) : '-'}>
                      {quotationAmount != null ? formatLeadAmount(quotationAmount, lead?.currency) : '-'}
                    </span>
                  </div>

                  {/* Metric 3: Billing / Deal Type */}
                  <div className="rounded-xl border border-cyan-500/15 bg-[var(--surface)]/80 p-3.5 shadow-2xs">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Billing Type</span>
                    <span className="mt-1.5 block text-sm font-bold text-[var(--text-main)] truncate" title={lead?.billingType || lead?.paymentPreference || '-'}>
                      {lead?.billingType || lead?.paymentPreference || '-'}
                    </span>
                  </div>

                  {/* Metric 4: Expected Close / Timeline */}
                  <div className="rounded-xl border border-cyan-500/15 bg-[var(--surface)]/80 p-3.5 shadow-2xs">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Expected Close</span>
                    <span className="mt-1.5 block text-sm font-bold text-[var(--text-main)] truncate" title={formatDate(lead?.expectedClosingDate) !== '-' ? formatDate(lead?.expectedClosingDate) : (lead?.purchaseTimeline || '-')}>
                      {formatDate(lead?.expectedClosingDate) !== '-' ? formatDate(lead?.expectedClosingDate) : (lead?.purchaseTimeline || '-')}
                    </span>
                  </div>
                </div>

                {serviceNames.length > 0 ? (
                  <div className="pt-1">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Required Services</span>
                      <span className="rounded-full bg-cyan-500/15 px-1.5 py-0.2 text-[10px] font-bold text-cyan-700 dark:text-cyan-300">
                        {serviceNames.length}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {serviceNames.map((service) => (
                        <span key={service}>
                          {renderServicePill(service, getLeadServiceColor(service))}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </Card>

              {/* 2. Next Scheduled Follow-up & Reminders */}
              <Card className="p-5 border-[var(--border)] bg-[var(--surface)] shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-[var(--border-muted)] pb-3">
                  <div className="flex items-center gap-2">
                    <Clock3 size={16} className="text-amber-500" />
                    <h3 className="text-sm font-bold text-[var(--text-main)]">Next Scheduled Follow-up & Reminders</h3>
                  </div>
                  {canWriteLead ? (
                    <Button variant="outline" size="sm" onClick={() => openActivity('reminder')} className="h-8 text-xs">
                      <CalendarPlus size={14} className="mr-1.5" />
                      + Schedule Follow-up
                    </Button>
                  ) : null}
                </div>

                {activityBuckets.reminder.length > 0 ? (
                  <div className="space-y-2.5">
                    {activityBuckets.reminder.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10 p-3.5"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                              Reminder
                            </span>
                            <span className="text-xs font-semibold text-[var(--text-muted)]">
                              {formatDate(item.date || item.startDate)} {item.startTime ? `at ${item.startTime}` : ''}
                            </span>
                          </div>
                          <p className="text-sm font-bold text-[var(--text-main)] truncate">{item.title}</p>
                          {item.description ? (
                            <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">{item.description}</p>
                          ) : null}
                        </div>
                        {!item.isSystemFollowUp && canWriteLead ? (
                          <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                            <Button variant="ghost" size="icon" onClick={() => openEditActivity(item)} className="h-7 w-7 text-[var(--text-muted)] hover:text-[var(--text-main)]">
                              <Edit3 size={14} />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setActivityDeleteTarget(item)} className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10">
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-6 text-center">
                    <p className="text-xs font-medium text-[var(--text-muted)]">No active follow-ups or reminders scheduled for this lead.</p>
                    {canWriteLead ? (
                      <Button variant="ghost" size="sm" onClick={() => openActivity('reminder')} className="mt-2 text-xs text-[var(--primary)]">
                        + Set a Follow-up Date
                      </Button>
                    ) : null}
                  </div>
                )}
              </Card>

              {/* 3. Requirement & Key Notes Box */}
              {(lead.notes || lead.requirementDescription || lead.otherServiceDetails) ? (
                <Card className="p-5 border-[var(--border)] bg-[var(--surface)] shadow-sm space-y-2">
                  <div className="flex items-center justify-between border-b border-[var(--border-muted)] pb-2.5">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-[var(--primary)]" />
                      <h3 className="text-sm font-bold text-[var(--text-main)]">Requirement & Key Notes</h3>
                    </div>
                    {canWriteLead ? (
                      <Button variant="ghost" size="sm" onClick={() => openActivity('note')} className="h-7 text-xs">
                        + Add Note
                      </Button>
                    ) : null}
                  </div>
                  <div className="space-y-3 pt-1">
                    {lead.requirementDescription ? (
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Client Requirement</span>
                        <p className="mt-1 text-xs text-[var(--text-main)] whitespace-pre-wrap leading-relaxed rounded-lg bg-[var(--surface-2)] border border-[var(--border-muted)] p-3">
                          {lead.requirementDescription}
                        </p>
                      </div>
                    ) : null}
                    {lead.notes ? (
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">General Notes</span>
                        <p className="mt-1 text-xs text-[var(--text-main)] whitespace-pre-wrap leading-relaxed rounded-lg bg-[var(--surface-2)] border border-[var(--border-muted)] p-3">
                          {lead.notes}
                        </p>
                      </div>
                    ) : null}
                    {lead.otherServiceDetails ? (
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Other Service Details</span>
                        <p className="mt-1 text-xs text-[var(--text-main)] rounded-lg bg-[var(--surface-2)] border border-[var(--border-muted)] p-2.5">
                          {lead.otherServiceDetails}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </Card>
              ) : null}

              {/* 4. Recent Activity Feed */}
              <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xs">
                <div className="flex items-center justify-between border-b border-[var(--border-muted)] px-5 py-3.5 bg-[var(--surface-2)]/50">
                  <div className="flex items-center gap-2">
                    <Activity size={16} className="text-[var(--primary)]" />
                    <h2 className="text-sm font-bold text-[var(--text-main)]">Recent Activity</h2>
                    <span className="rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-muted)] border border-[var(--border-muted)]">
                      {sortedTimeline.length}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab('timeline')}
                    className="h-7 text-xs font-semibold px-2.5 text-[var(--primary)] hover:text-[var(--primary)] cursor-pointer"
                  >
                    View full timeline →
                  </Button>
                </div>
                <div className="p-4">
                  {sortedTimeline.length ? (
                    <div className="relative before:absolute before:left-3 before:top-2.5 before:bottom-2.5 before:w-[2px] before:bg-[var(--border-muted)] space-y-2.5">
                      {sortedTimeline.slice(0, 5).map((item, index) => {
                        const meta = getActivityMeta(item);
                        const Icon = meta.icon;
                        const timeInfo = formatActivityTimestamp(item.date || item.createdAt);

                        return (
                          <div key={`${item.title}-${item.date}-${index}`} className="relative pl-9 group">
                            {/* Timeline Icon Node */}
                            <div className={cn(
                              'absolute left-0 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--surface)] shadow-2xs transition-transform group-hover:scale-110 z-10',
                              meta.bg,
                              meta.text
                            )}>
                              <Icon size={11} />
                            </div>

                            {/* Minimal Activity Item Card */}
                            <div className="rounded-xl border border-[var(--border-muted)] bg-[var(--surface-2)]/30 hover:bg-[var(--surface-2)]/70 px-3.5 py-2.5 shadow-2xs hover:shadow-xs transition-all">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-2 min-w-0">
                                  <span className={cn(
                                    'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border shrink-0',
                                    meta.bg,
                                    meta.border,
                                    meta.text
                                  )}>
                                    {meta.label}
                                  </span>
                                  <span className="text-xs font-bold text-[var(--text-main)] truncate">{item.title}</span>
                                  {item.actorName && (
                                    <span className="text-[11px] font-medium text-[var(--text-muted)] shrink-0 hidden sm:inline">
                                      • <span>{item.actorName}</span>
                                    </span>
                                  )}
                                </div>

                                <div className="flex flex-col items-end shrink-0 text-right" title={timeInfo.formatted}>
                                  {timeInfo.isUpcoming ? (
                                    <div className="flex flex-col items-end">
                                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-md">
                                        <Clock3 size={11} className="shrink-0 text-amber-600 dark:text-amber-400" />
                                        <span>{timeInfo.relative || 'Upcoming'}</span>
                                      </span>
                                      <span className="mt-0.5 text-[10px] font-medium text-amber-700/80 dark:text-amber-300/80">
                                        {timeInfo.formatted}
                                      </span>
                                    </div>
                                  ) : timeInfo.relative ? (
                                    <div className="flex flex-col items-end">
                                      <div className="flex items-center gap-1 text-[11px] font-bold text-[var(--primary)]">
                                        <Clock3 size={11} className="shrink-0 opacity-80" />
                                        <span>{timeInfo.relative}</span>
                                      </div>
                                      <span className="mt-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                                        {timeInfo.formatted}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1 text-[11px] font-medium text-[var(--text-muted)]">
                                      <Clock3 size={11} className="shrink-0 opacity-70" />
                                      <span>{timeInfo.formatted}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {item.detail && item.detail !== item.title && (
                                <p className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed line-clamp-2">
                                  {item.detail}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)]/40 p-8 text-center text-sm text-[var(--text-muted)]">
                      No recent activity recorded for this lead.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 px-1">
                <div>
                  <h2 className="text-base font-bold text-[var(--text-main)]">Lead Details & Specifications</h2>
                  <p className="text-xs text-[var(--text-muted)]">Structured lead specifications, contact profile, and requirements</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAllDetailSections(true)}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] transition hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)] cursor-pointer"
                  >
                    Open all
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllDetailSections(false)}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] transition hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)] cursor-pointer"
                  >
                    Close all
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3">
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

          {activeTab === 'quotations' && (() => {
            const quotationPage = tabPages.quotations || 1;
            const quotationPageSize = 10;
            const pagedQuotations = quotationRows.slice((quotationPage - 1) * quotationPageSize, quotationPage * quotationPageSize);

            return (
              <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xs">
                <div className="flex flex-col gap-3 border-b border-[var(--border-muted)] px-5 py-4 md:flex-row md:items-center md:justify-between bg-[var(--surface-2)]/50">
                  <div>
                    <h2 className="text-base font-bold text-[var(--text-main)]">Quotations</h2>
                    <p className="text-xs text-[var(--text-muted)]">Proposal amount, status, validity and service details</p>
                  </div>
                  {canWriteLead ? (
                    <Button variant="outline" size="sm" className="shadow-sm" onClick={() => openActivity('quotation')}>
                      <PlusCircle size={15} className="mr-1.5" />
                      Add quotation
                    </Button>
                  ) : null}
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-0">
                    <thead className="bg-[var(--surface-2)]">
                      <tr>
                        {['Quotation', 'Service', 'Proposal date', 'Valid until', 'Amount', 'Status', 'Invoice', 'Comments', ''].map((heading) => (
                          <th key={heading || 'actions'} className="border-b border-[var(--border)] px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pagedQuotations.length ? pagedQuotations.map((item) => (
                        <tr key={item.id} className="transition hover:bg-[var(--hover-bg)]">
                          <td className="border-b border-[var(--border-muted)] px-4 py-3 text-sm">
                            <button
                              type="button"
                              onClick={() => navigate(`/app/leads/${id}/quotations/${item.id}`)}
                              className="text-left font-semibold text-[var(--text-main)] hover:text-[var(--primary)] hover:underline cursor-pointer"
                            >
                              {item.title}
                            </button>
                          </td>
                          <td className="max-w-[220px] truncate border-b border-[var(--border-muted)] px-4 py-3 text-sm text-[var(--text-muted)]" title={item.serviceName}>{item.serviceName || '-'}</td>
                          <td className="border-b border-[var(--border-muted)] px-4 py-3 text-sm text-[var(--text-muted)]">{formatDate(item.proposalDate)}</td>
                          <td className="border-b border-[var(--border-muted)] px-4 py-3 text-sm text-[var(--text-muted)]">{formatDate(item.validUntil)}</td>
                          <td className="border-b border-[var(--border-muted)] px-4 py-3 text-sm font-semibold text-[var(--text-main)]">{item.totalAmount != null ? formatLeadAmount(item.totalAmount, lead.currency) : '-'}</td>
                          <td className="border-b border-[var(--border-muted)] px-4 py-3">
                            <span className={cn(
                              'inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold',
                              String(item.status).toLowerCase() === 'sent'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : String(item.status).toLowerCase() === 'draft'
                                  ? 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
                                  : String(item.status).toLowerCase() === 'approved'
                                    ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300'
                                    : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300'
                            )}>
                              {item.status || 'Draft'}
                            </span>
                          </td>
                          <td className="border-b border-[var(--border-muted)] px-4 py-3 text-sm">
                            {item.invoiceId ? (
                              <button type="button" onClick={() => navigate(`/app/invoices/${item.invoiceId}`)} className="font-semibold text-[var(--primary)] hover:underline cursor-pointer">
                                {item.invoiceNumber || 'View invoice'}
                              </button>
                            ) : <span className="text-[var(--text-muted)]">-</span>}
                          </td>
                          <td className="max-w-[260px] truncate border-b border-[var(--border-muted)] px-4 py-3 text-sm text-[var(--text-muted)]" title={item.comments}>{item.comments || '-'}</td>
                          <td className="border-b border-[var(--border-muted)] px-4 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate(`/app/leads/${id}/quotations/${item.id}`)}
                                title="View quotation"
                                className="h-7 w-7 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 cursor-pointer"
                              >
                                <Eye size={15} />
                              </Button>
                              {canWriteLead ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => navigate(`/app/leads/${id}/quotations/${item.id}`)}
                                    title="Edit quotation"
                                    className="h-7 w-7 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 cursor-pointer"
                                  >
                                    <Edit3 size={15} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setActivityDeleteTarget(item.event)}
                                    title="Delete quotation"
                                    className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10 cursor-pointer"
                                  >
                                    <Trash2 size={15} />
                                  </Button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={9} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                            No quotation added yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 pb-4">
                  <PaginationBar
                    currentPage={quotationPage}
                    totalItems={quotationRows.length}
                    pageSize={quotationPageSize}
                    onPageChange={(page) => setTabPage('quotations', page)}
                  />
                </div>
              </div>
            );
          })()}

          {activeTab === 'events' && (
            <Card className="p-5 border-[var(--border)] bg-[var(--surface)]">
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

          {activeTab === 'files' && (() => {
            const filePage = tabPages.files || 1;
            const filePageSize = 12;
            const pagedFiles = files.slice((filePage - 1) * filePageSize, filePage * filePageSize);

            return (
              <Card className="space-y-4 p-5 border-[var(--border)] bg-[var(--surface)]">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--border-muted)] pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-[var(--text-main)]">Files</h3>
                    <p className="text-sm text-[var(--text-muted)]">{files.length} file(s)</p>
                  </div>
                  <Button variant="secondary" onClick={() => setFilesModalOpen(true)}>
                    <Paperclip size={16} className="mr-2" />
                    Add File
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {pagedFiles.length ? pagedFiles.map((file) => (
                    <a
                      key={file.id}
                      href={file.driveWebViewLink || `#${file.id}`}
                      target={file.driveWebViewLink ? '_blank' : undefined}
                      rel={file.driveWebViewLink ? 'noreferrer' : undefined}
                      className="rounded-2xl border border-[var(--border-muted)] bg-[var(--surface-2)] p-4 transition hover:border-[var(--primary)] hover:shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--surface)] text-[var(--text-muted)]">
                          <Paperclip size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[var(--text-main)]">{file.title || file.originalName || file.name || 'File'}</p>
                          <p className="mt-1 text-xs text-[var(--text-muted)]">
                            {file.moduleName || 'leads'} {file.entityId ? `#${file.entityId}` : ''}
                          </p>
                          {file.description ? <p className="mt-1 line-clamp-2 text-xs text-[var(--text-muted)]">{file.description}</p> : null}
                          <p className="mt-2 text-xs text-[var(--text-muted)]">{formatDate(file.createdAt)}</p>
                        </div>
                      </div>
                    </a>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-8 text-center text-sm text-[var(--text-muted)] col-span-full">
                      No files uploaded for this lead yet.
                    </div>
                  )}
                </div>
                <PaginationBar
                  currentPage={filePage}
                  totalItems={files.length}
                  pageSize={filePageSize}
                  onPageChange={(page) => setTabPage('files', page)}
                />
              </Card>
            );
          })()}

          {activeTab === 'contacts' && (() => {
            const contactPage = tabPages.contacts || 1;
            const contactPageSize = 10;
            const pagedContacts = contacts.slice((contactPage - 1) * contactPageSize, contactPage * contactPageSize);

            return (
              <Card className="p-5 border-[var(--border)] bg-[var(--surface)]">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--border-muted)] pb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--text-main)]">Contacts</h2>
                    <p className="text-sm text-[var(--text-muted)]">{contacts.length} contact(s)</p>
                  </div>
                  <Button variant="secondary" onClick={() => { setContactEdit(null); setContactOpen(true); }}>
                    <UserPlus size={16} className="mr-2" />
                    Add contact
                  </Button>
                </div>
                <div className="mt-4 space-y-3">
                  {pagedContacts.length ? pagedContacts.map((contact, index) => (
                    <div key={contact.id} className="flex flex-col gap-4 rounded-2xl border border-[var(--border-muted)] bg-[var(--surface-2)] p-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)] font-bold text-sm">
                          {`${contact.firstName || ''}`.slice(0, 1)}{`${contact.lastName || ''}`.slice(0, 1)}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-semibold text-[var(--text-main)]">
                              {contact.firstName} {contact.lastName}
                            </div>
                            {index === 0 && contactPage === 1 ? (
                              <span className="rounded-full bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                                Primary contact
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs text-[var(--text-muted)]">{contact.jobTitle || 'Contact'}</div>
                          <div className="mt-2 space-y-1 text-sm text-[var(--text-muted)]">
                            {contact.email ? <div className="flex items-center gap-2"><Mail size={14} /> {contact.email}</div> : null}
                            {contact.phone ? <div className="flex items-center gap-2"><Phone size={14} /> {formatPhoneDisplay(contact.phone)}</div> : null}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setContactEdit(contact); setContactOpen(true); }}>
                          <Edit3 size={16} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setContactDeleteTarget(contact)} className="text-red-500 hover:text-red-600 hover:bg-red-500/10">
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                      No contacts added yet.
                    </div>
                  )}
                </div>
                <PaginationBar
                  currentPage={contactPage}
                  totalItems={contacts.length}
                  pageSize={contactPageSize}
                  onPageChange={(page) => setTabPage('contacts', page)}
                />
              </Card>
            );
          })()}

          {activeTab === 'tasks' && (() => {
            const taskPage = tabPages.tasks || 1;
            const taskPageSize = 10;
            const pagedTasks = filteredTasks.slice((taskPage - 1) * taskPageSize, taskPage * taskPageSize);

            const filterTabs = [
              { key: 'all', label: 'All Tasks', count: taskStatusCounts.all },
              { key: 'to do', label: 'To Do', count: taskStatusCounts['to do'] },
              { key: 'in progress', label: 'In Progress', count: taskStatusCounts['in progress'] },
              { key: 'completed', label: 'Completed', count: taskStatusCounts['completed'] },
              { key: 'blocked', label: 'Blocked', count: taskStatusCounts['blocked'] }
            ];

            return (
              <Card className="p-5 border-[var(--border)] bg-[var(--surface)] space-y-4">
                {/* Header: Title + Add Task Button */}
                <div className="flex flex-col gap-3 border-b border-[var(--border-muted)] pb-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--text-main)]">Tasks</h2>
                    <p className="text-sm text-[var(--text-muted)]">Follow-up work, assignments, and milestones for this lead</p>
                  </div>
                  <Button variant="outline" className="shadow-sm" onClick={() => openActivity('task')}>
                    <CalendarPlus size={16} className="mr-2 text-sky-500" />
                    Add task
                  </Button>
                </div>

                {/* Status Filter Tab Pills */}
                <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border-muted)] pb-3.5">
                  {filterTabs.map((tab) => {
                    const active = taskStatusFilter === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => {
                          setTaskStatusFilter(tab.key);
                          setTabPage('tasks', 1);
                        }}
                        className={cn(
                          'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer',
                          active
                            ? 'bg-[var(--primary)] text-white shadow-2xs'
                            : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-bg)]'
                        )}
                      >
                        <span>{tab.label}</span>
                        <span className={cn(
                          'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                          active ? 'bg-white/20 text-white' : 'bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border-muted)]'
                        )}>
                          {tab.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Task Cards List */}
                <div className="space-y-3">
                  {pagedTasks.length ? pagedTasks.map((item) => {
                    const isSynthetic = Boolean(item.isSynthetic);
                    const statusMeta = getTaskStatusMeta(item.status);
                    const priorityMeta = getTaskPriorityMeta(item.priority);
                    const assignedName = item.assignedTo ? (userLookup?.get(String(item.assignedTo)) || item.assignedUser || 'Assigned') : null;
                    const collaboratorNames = Array.isArray(item.collaborators) && item.collaborators.length
                      ? item.collaborators.map((c) => userLookup?.get(String(c)) || String(c)).filter(Boolean).join(', ')
                      : null;
                    const labelsList = Array.isArray(item.labels) ? item.labels : [];

                    return (
                      <div
                        key={item.id}
                        className="group relative rounded-xl border border-[var(--border-muted)] bg-[var(--surface-2)]/30 hover:bg-[var(--surface-2)]/70 p-4 transition-all duration-200 shadow-2xs hover:shadow-xs hover:border-[var(--border)] space-y-2.5"
                      >
                        {/* Top Row: Badges (Status, Priority, Recurring, Points) + Title + Actions */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                            {/* Status Badge */}
                            <span className={cn(
                              'rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border shrink-0 flex items-center gap-1',
                              statusMeta.bg,
                              statusMeta.border,
                              statusMeta.text
                            )}>
                              <span className={cn('h-1.5 w-1.5 rounded-full', statusMeta.dot)} />
                              {statusMeta.label}
                            </span>

                            {/* Priority Badge */}
                            <span className={cn(
                              'rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border shrink-0',
                              priorityMeta.bg,
                              priorityMeta.border,
                              priorityMeta.text
                            )}>
                              {priorityMeta.label}
                            </span>

                            {/* Recurring Badge */}
                            {item.recurring ? (
                              <span className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 border border-purple-500/30 text-purple-700 dark:text-purple-300 shrink-0">
                                🔁 Recurring
                              </span>
                            ) : null}

                            {/* Points Badge */}
                            {item.points ? (
                              <span className="rounded-md px-2 py-0.5 text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 shrink-0">
                                ⭐ {item.points} pts
                              </span>
                            ) : null}

                            {/* Task Title */}
                            <span className="font-bold text-sm text-[var(--text-main)] truncate max-w-full block">
                              {item.title}
                            </span>
                          </div>

                          {/* Minimal Action Buttons: View, Edit, Delete */}
                          <div className="flex items-center gap-1 shrink-0">
                            {/* View Action */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setViewActivityTarget(item)}
                              title="View task details"
                              className="h-7 w-7 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 cursor-pointer"
                            >
                              <Eye size={14} />
                            </Button>

                            {/* Edit Action */}
                            {!isSynthetic && canWriteLead ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditActivity(item)}
                                title="Edit task"
                                className="h-7 w-7 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 cursor-pointer"
                              >
                                <Edit3 size={14} />
                              </Button>
                            ) : null}

                            {/* Delete Action */}
                            {!isSynthetic && canWriteLead ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setActivityDeleteTarget(item)}
                                title="Delete task"
                                className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10 cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </Button>
                            ) : null}
                          </div>
                        </div>

                        {/* Description */}
                        {item.description ? (
                          <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-2">
                            {item.description}
                          </p>
                        ) : null}

                        {/* Structured Metadata Grid: Assignee, Collaborators, Start Date, Deadline */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs border-t border-[var(--border-muted)]/60 pt-2.5">
                          {/* Assignee & Collaborators */}
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
                            <span className="font-medium text-[var(--text-main)] flex items-center gap-1 bg-[var(--surface)] px-2 py-0.5 rounded-md border border-[var(--border-muted)]">
                              👤 <span className="font-semibold">{assignedName || 'Unassigned'}</span>
                            </span>
                            {collaboratorNames ? (
                              <span className="text-[10px] text-[var(--text-muted)] bg-[var(--surface)] px-1.5 py-0.5 rounded-md border border-[var(--border-muted)]" title={`Collaborators: ${collaboratorNames}`}>
                                👥 {collaboratorNames}
                              </span>
                            ) : null}
                          </div>

                          {/* Dates & Timeline */}
                          <div className="flex flex-wrap items-center sm:justify-end gap-2 text-[11px]">
                            {item.startDate ? (
                              <span className="text-[var(--text-muted)] flex items-center gap-1 font-medium">
                                📅 Start: <span className="text-[var(--text-main)] font-semibold">{formatDate(item.startDate)}</span>
                              </span>
                            ) : null}
                            {(item.endDate || item.deadline) ? (
                              <span className="font-medium text-[var(--primary)] flex items-center gap-1 bg-[var(--primary)]/10 border border-[var(--primary)]/20 px-2 py-0.5 rounded-md">
                                ⏰ Deadline: <span className="font-bold">{formatDate(item.endDate || item.deadline)}</span>
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* Labels Section */}
                        {labelsList.length ? (
                          <div className="flex flex-wrap items-center gap-1 border-t border-[var(--border-muted)]/40 pt-2">
                            <span className="text-[10px] font-medium text-[var(--text-muted)] mr-1">🏷️ Labels:</span>
                            {labelsList.map((label) => (
                              <span key={label} className="rounded-md border border-[var(--border-muted)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
                                {label}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        {/* Attachments Section */}
                        {Array.isArray(item.attachments) && item.attachments.length ? (
                          <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--border-muted)]/60 pt-2 text-[11px] text-[var(--text-muted)]">
                            <span className="font-medium flex items-center gap-1 text-[10px]">
                              <Paperclip size={11} /> {item.attachments.length} file{item.attachments.length > 1 ? 's' : ''}:
                            </span>
                            {item.attachments.slice(0, 3).map((file) => (
                              <a
                                key={file.driveFileId || file.id}
                                href={file.driveWebViewLink || file.webContentLink || file.url || `#${file.driveFileId || file.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-main)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition cursor-pointer"
                              >
                                <Paperclip size={10} />
                                <span className="truncate max-w-[130px]">{file.name || 'File'}</span>
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  }) : (
                    <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-4 py-12 text-center text-sm text-[var(--text-muted)]">
                      {taskStatusFilter === 'all' ? 'No tasks added yet for this lead.' : `No tasks with status "${taskStatusFilter}".`}
                    </div>
                  )}
                </div>

                <PaginationBar
                  currentPage={taskPage}
                  totalItems={filteredTasks.length}
                  pageSize={taskPageSize}
                  onPageChange={(page) => setTabPage('tasks', page)}
                />
              </Card>
            );
          })()}

          {activeTab === 'notes' && (() => {
            const notePage = tabPages.notes || 1;
            const notePageSize = 10;
            const notesList = activityBuckets.note;
            const pagedNotes = notesList.slice((notePage - 1) * notePageSize, notePage * notePageSize);

            return (
              <Card className="p-5 border-[var(--border)] bg-[var(--surface)] space-y-4">
                {/* Header */}
                <div className="flex flex-col gap-3 border-b border-[var(--border-muted)] pb-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--text-main)]">Notes</h2>
                    <p className="text-sm text-[var(--text-muted)]">Internal notes, team context and communication records ({notesList.length} total)</p>
                  </div>
                  <Button variant="outline" className="shadow-sm" onClick={() => openActivity('note')}>
                    <Tag size={16} className="mr-2 text-purple-500" />
                    Add note
                  </Button>
                </div>

                {/* Notes List */}
                <div className="space-y-3">
                  {pagedNotes.length ? pagedNotes.map((item) => {
                    const isSynthetic = Boolean(item.isSynthetic);
                    const labelsList = Array.isArray(item.labels) ? item.labels : [];
                    const timeInfo = formatActivityTimestamp(item.startDate || item.date || item.createdAt, item.startTime);

                    return (
                      <div
                        key={item.id}
                        className="group relative rounded-xl border border-[var(--border-muted)] bg-[var(--surface-2)]/30 hover:bg-[var(--surface-2)]/70 p-4 transition-all duration-200 shadow-2xs hover:shadow-xs hover:border-[var(--border)] space-y-2.5"
                      >
                        {/* Top Row: Category Badge + Title + Action Buttons */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                            <span className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 border border-purple-500/30 text-purple-700 dark:text-purple-300 shrink-0">
                              {item.category || 'Note'}
                            </span>
                            <span className="font-bold text-sm text-[var(--text-main)] truncate max-w-full block">
                              {item.title}
                            </span>
                          </div>

                          {/* Minimal Action Buttons: View, Edit, Delete */}
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setViewActivityTarget(item)}
                              title="View note details"
                              className="h-7 w-7 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 cursor-pointer"
                            >
                              <Eye size={14} />
                            </Button>

                            {!isSynthetic && canWriteLead ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditActivity(item)}
                                title="Edit note"
                                className="h-7 w-7 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 cursor-pointer"
                              >
                                <Edit3 size={14} />
                              </Button>
                            ) : null}

                            {!isSynthetic && canWriteLead ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setActivityDeleteTarget(item)}
                                title="Delete note"
                                className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10 cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </Button>
                            ) : null}
                          </div>
                        </div>

                        {/* Note Content / Description */}
                        {item.description ? (
                          <div className="rounded-lg bg-[var(--surface)]/90 border border-[var(--border-muted)]/70 p-3 text-xs text-[var(--text-main)] leading-relaxed line-clamp-3 whitespace-pre-wrap">
                            {item.description}
                          </div>
                        ) : null}

                        {/* Labels Section */}
                        {labelsList.length ? (
                          <div className="flex flex-wrap items-center gap-1 pt-0.5">
                            <span className="text-[10px] font-medium text-[var(--text-muted)] mr-1">🏷️ Labels:</span>
                            {labelsList.map((label) => (
                              <span key={label} className="rounded-md border border-[var(--border-muted)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
                                {label}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        {/* Bottom Row: Author + Date & Time + Attachments */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-muted)]/60 pt-2.5 text-[11px] text-[var(--text-muted)]">
                          <div className="flex items-center gap-2 font-medium">
                            {item.actorName && (
                              <span>👤 <span className="text-[var(--text-main)] font-semibold">{item.actorName}</span></span>
                            )}
                            <span>📅 {timeInfo.formatted}</span>
                          </div>

                          {Array.isArray(item.attachments) && item.attachments.length ? (
                            <div className="flex items-center gap-1 font-medium bg-[var(--surface)] px-2 py-0.5 rounded-md border border-[var(--border-muted)]">
                              <Paperclip size={11} />
                              <span>{item.attachments.length} file{item.attachments.length > 1 ? 's' : ''}</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-4 py-12 text-center text-sm text-[var(--text-muted)]">
                      No notes added yet for this lead.
                    </div>
                  )}
                </div>

                <PaginationBar
                  currentPage={notePage}
                  totalItems={notesList.length}
                  pageSize={notePageSize}
                  onPageChange={(page) => setTabPage('notes', page)}
                />
              </Card>
            );
          })()}

          {activeTab === 'reminders' && (() => {
            const reminderPage = tabPages.reminders || 1;
            const reminderPageSize = 10;
            const pagedReminders = filteredReminders.slice((reminderPage - 1) * reminderPageSize, reminderPage * reminderPageSize);

            const filterTabs = [
              { key: 'all', label: 'All Reminders', count: reminderStatusCounts.all, isBlue: true },
              { key: 'today', label: 'Today', count: reminderStatusCounts.today, isBlue: true },
              { key: 'upcoming', label: 'Upcoming / Due', count: reminderStatusCounts.upcoming, isAmber: true },
              { key: 'past', label: 'Past Pending', count: reminderStatusCounts.past, isRed: true },
              { key: 'completed', label: 'Completed', count: reminderStatusCounts.completed, isGreen: true }
            ];

            return (
              <Card className="p-5 border-[var(--border)] bg-[var(--surface)] space-y-4">
                {/* Header */}
                <div className="flex flex-col gap-3 border-b border-[var(--border-muted)] pb-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--text-main)]">Reminders</h2>
                    <p className="text-sm text-[var(--text-muted)]">Time-based alerts, follow-up calls and scheduled activities</p>
                  </div>
                  <Button variant="outline" className="shadow-sm" onClick={() => openActivity('reminder')}>
                    <Clock3 size={16} className="mr-2 text-amber-500" />
                    Add reminder
                  </Button>
                </div>

                {/* 📊 Follow-Up Performance & Pipeline Health Summary (Point 5) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="rounded-xl border border-[var(--border-muted)] bg-[var(--surface-2)]/40 p-3 space-y-1">
                    <span className="text-[11px] font-medium text-[var(--text-muted)] flex items-center gap-1">
                      <Clock3 size={12} className="text-blue-500" /> Total Reminders
                    </span>
                    <p className="text-lg font-bold text-[var(--text-main)] leading-none">{reminderStatusCounts.all}</p>
                  </div>

                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
                    <span className="text-[11px] font-medium text-amber-800 dark:text-amber-300 flex items-center gap-1">
                      <Bell size={12} className="text-amber-600" /> Due Today
                    </span>
                    <p className="text-lg font-bold text-amber-900 dark:text-amber-200 leading-none">{reminderStatusCounts.today}</p>
                  </div>

                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-1">
                    <span className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 size={12} className="text-emerald-600" /> Completed
                    </span>
                    <p className="text-lg font-bold text-emerald-900 dark:text-emerald-200 leading-none">{reminderStatusCounts.completed}</p>
                  </div>

                  <div className={cn(
                    'rounded-xl border p-3 space-y-1',
                    (lead?.followUpAttempts || 0) > 0
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200'
                      : 'border-blue-500/30 bg-blue-500/10 text-blue-900 dark:text-blue-200'
                  )}>
                    <span className="text-[11px] font-medium flex items-center gap-1">
                      <Zap size={12} className={(lead?.followUpAttempts || 0) > 0 ? 'text-amber-600' : 'text-blue-600'} /> Cadence Status
                    </span>
                    <p className="text-sm font-bold truncate leading-none">
                      {(lead?.followUpAttempts || 0) > 0 ? `Attempt ${lead.followUpAttempts}/3` : 'Active / Normal'}
                    </p>
                  </div>
                </div>

                {/* 🔔 Due Today Alert Banner & Audio Alert (Point 3) */}
                {reminderStatusCounts.today > 0 && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
                        <Bell size={16} className="animate-pulse" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                          Follow-Up Scheduled for Today ({reminderStatusCounts.today} {reminderStatusCounts.today === 1 ? 'item' : 'items'})
                        </h4>
                        <p className="text-[11px] text-amber-800 dark:text-amber-300 truncate">
                          {lead.followUpDate ? `Scheduled at ${lead.nextFollowUpTime || 'Today'} with ${lead.name || lead.companyName}` : 'Make sure to connect with the client today.'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={playReminderChime}
                        title="Test Reminder Chime Sound"
                        className="h-7 text-xs text-amber-900 dark:text-amber-200 hover:bg-amber-500/20 px-2 cursor-pointer"
                      >
                        <Volume2 size={13} className="mr-1" /> Chime
                      </Button>
                      {(lead?.phone || lead?.mobile) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openWhatsAppNudge(lead.phone || lead.mobile, lead.name || lead.contactPerson, 'meeting_reminder', lead.serviceName)}
                          className="bg-white/90 dark:bg-slate-800 text-xs h-7 border-emerald-500/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer shadow-2xs"
                        >
                          <MessageCircle size={13} className="mr-1 text-emerald-600" />
                          WhatsApp Nudge
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        onClick={() => setCallOpen(true)}
                        className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-7 shadow-xs cursor-pointer"
                      >
                        <Phone size={13} className="mr-1" />
                        Log Call
                      </Button>
                    </div>
                  </div>
                )}

                {/* Filter Tabs */}
                <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border-muted)] pb-3.5">
                  {filterTabs.map((tab) => {
                    const active = reminderStatusFilter === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => {
                          setReminderStatusFilter(tab.key);
                          setTabPage('reminders', 1);
                        }}
                        className={cn(
                          'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer',
                          active
                            ? tab.isBlue
                              ? 'bg-blue-600 text-white shadow-2xs'
                              : tab.isAmber
                                ? 'bg-amber-600 text-white shadow-2xs'
                                : tab.isRed
                                  ? 'bg-rose-600 text-white shadow-2xs'
                                  : tab.isGreen
                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                    : 'bg-[var(--primary)] text-white shadow-2xs'
                            : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-bg)]'
                        )}
                      >
                        <span>{tab.label}</span>
                        <span className={cn(
                          'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                          active ? 'bg-white/20 text-white' : 'bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border-muted)]'
                        )}>
                          {tab.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Reminders List */}
                <div className="space-y-3">
                  {pagedReminders.length ? pagedReminders.map((item) => {
                    const isSynthetic = Boolean(item.isSynthetic);
                    const followUpStatus = getFollowUpStatus(item);
                    const timeInfo = formatActivityTimestamp(item.startDate || item.date || item.endDate, item.startTime || item.time);
                    const isRecurring = Boolean(item.repeat || item.recurring);

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          'group relative rounded-xl border p-4 transition-all duration-200 shadow-2xs hover:shadow-xs space-y-2.5',
                          followUpStatus.isCompleted
                            ? 'border-emerald-500/30 bg-emerald-500/[0.03] hover:bg-emerald-500/[0.07]'
                            : timeInfo.isUpcoming
                              ? 'border-amber-500/30 bg-amber-500/[0.04] hover:bg-amber-500/[0.08]'
                              : 'border-[var(--border-muted)] bg-[var(--surface-2)]/30 hover:bg-[var(--surface-2)]/70 hover:border-[var(--border)]'
                        )}
                      >
                        {/* Top Row: Status Pill + Recurring + Title + Actions */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                            {/* Status Pill */}
                            {followUpStatus.isCompleted ? (
                              <span className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 shrink-0 flex items-center gap-1">
                                <CheckCircle2 size={10} className="text-emerald-600 dark:text-emerald-400" />
                                Completed
                              </span>
                            ) : (
                              <span className={cn(
                                'rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border shrink-0 flex items-center gap-1',
                                timeInfo.isUpcoming
                                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300'
                                  : 'bg-slate-500/15 border-slate-500/30 text-slate-700 dark:text-slate-300'
                              )}>
                                <Clock3 size={10} className={timeInfo.isUpcoming ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'} />
                                {timeInfo.isUpcoming ? (timeInfo.relative || 'Upcoming') : 'Pending / Due'}
                              </span>
                            )}

                            {isRecurring ? (
                              <span className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 border border-purple-500/30 text-purple-700 dark:text-purple-300 shrink-0">
                                🔁 Repeating
                              </span>
                            ) : null}

                            {isSynthetic ? (
                              <span className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-sky-500/15 border border-sky-500/30 text-sky-700 dark:text-sky-300 shrink-0">
                                ⭐ Lead Follow-Up
                              </span>
                            ) : null}

                            <span className="font-bold text-sm text-[var(--text-main)] truncate max-w-full block">
                              {item.title}
                            </span>
                          </div>

                          {/* Minimal Action Buttons: Complete, WhatsApp, View, Edit, Delete (Point 1) */}
                          <div className="flex items-center gap-1 shrink-0">
                            {/* Quick Mark Complete Button */}
                            {!followUpStatus.isCompleted && canWriteLead ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setCompleteFollowUpTarget(item)}
                                title="Mark follow-up as completed & add remark"
                                className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 cursor-pointer"
                              >
                                <CheckCircle2 size={15} />
                              </Button>
                            ) : null}

                            {/* 1-Click WhatsApp Quick Nudge Button (Point 1) */}
                            {(lead?.phone || lead?.mobile) ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openWhatsAppNudge(lead.phone || lead.mobile, lead.name || lead.contactPerson, 'follow_up', lead.serviceName)}
                                title="Send 1-Click WhatsApp follow-up nudge"
                                className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 cursor-pointer"
                              >
                                <MessageCircle size={15} />
                              </Button>
                            ) : null}

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setViewActivityTarget(item)}
                              title="View reminder details"
                              className="h-7 w-7 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 cursor-pointer"
                            >
                              <Eye size={14} />
                            </Button>

                            {canWriteLead ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditActivity(item)}
                                title={isSynthetic ? 'Edit lead follow-up' : 'Edit reminder'}
                                className="h-7 w-7 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 cursor-pointer"
                              >
                                <Edit3 size={14} />
                              </Button>
                            ) : null}

                            {canWriteLead ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setActivityDeleteTarget(item)}
                                title={isSynthetic ? 'Delete lead follow-up' : 'Delete reminder'}
                                className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10 cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </Button>
                            ) : null}
                          </div>
                        </div>

                        {/* Remark Box if Completed */}
                        {followUpStatus.remark ? (
                          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-xs text-emerald-950 dark:text-emerald-200 leading-relaxed">
                            <span className="font-semibold flex items-center gap-1 text-[11px] text-emerald-800 dark:text-emerald-300 mb-0.5">
                              <CheckCircle2 size={12} className="text-emerald-600" />
                              Follow-Up Remark / Outcome:
                            </span>
                            <span className="whitespace-pre-wrap">{followUpStatus.remark}</span>
                          </div>
                        ) : null}

                        {/* Note / Description */}
                        {item.description || item.notes ? (
                          <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-2">
                            {item.description || item.notes}
                          </p>
                        ) : null}

                        {/* Structured Timing & Relative Info */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-muted)]/60 pt-2.5 text-[11px]">
                          <div className="flex items-center gap-1.5 font-medium text-[var(--text-muted)]">
                            <span>📅 Scheduled: <span className="font-semibold text-[var(--text-main)]">{timeInfo.formatted}</span></span>
                          </div>

                          <div className={cn(
                            'font-semibold px-2 py-0.5 rounded-md text-xs',
                            followUpStatus.isCompleted
                              ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/15'
                              : timeInfo.isUpcoming
                                ? 'text-amber-700 dark:text-amber-300 bg-amber-500/15'
                                : 'text-[var(--text-muted)]'
                          )}>
                            {followUpStatus.isCompleted ? 'Completed' : timeInfo.relative ? `⏰ ${timeInfo.relative}` : `⏰ ${timeInfo.dateOnly}`}
                          </div>
                        </div>

                        {/* ⚡ 1-Click Quick Reschedule Chips (Point 2) */}
                        {!followUpStatus.isCompleted && canWriteLead ? (
                          <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--border-muted)]/50 pt-2">
                            <span className="text-[10px] font-semibold text-[var(--text-muted)] flex items-center gap-1 mr-0.5">
                              <Zap size={11} className="text-amber-500" /> Quick Reschedule:
                            </span>
                            {getQuickRescheduleOptions().map((opt) => (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() => quickRescheduleReminder(item, opt.date, opt.time, opt.display)}
                                title={`Reschedule to ${opt.display}`}
                                className="px-2 py-0.5 rounded-md text-[10px] font-medium border border-[var(--border-muted)] bg-[var(--surface)] hover:bg-[var(--surface-3)] hover:text-[var(--primary)] hover:border-[var(--primary)] text-[var(--text-muted)] transition cursor-pointer"
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  }) : (
                    <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-4 py-12 text-center text-sm text-[var(--text-muted)]">
                      {reminderStatusFilter === 'all' ? 'No reminders added yet for this lead.' : `No ${reminderStatusFilter} reminders found.`}
                    </div>
                  )}
                </div>

                <PaginationBar
                  currentPage={reminderPage}
                  totalItems={filteredReminders.length}
                  pageSize={reminderPageSize}
                  onPageChange={(page) => setTabPage('reminders', page)}
                />
              </Card>
            );
          })()}

          {activeTab === 'timeline' && (() => {
            const timelinePage = tabPages.timeline || 1;
            const timelinePageSize = 10;
            const pagedTimeline = sortedTimeline.slice((timelinePage - 1) * timelinePageSize, timelinePage * timelinePageSize);

            return (
              <div className="w-full space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div>
                    <h2 className="text-lg font-bold text-[var(--text-main)]">Lead Timeline</h2>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">Chronological history of all events, calls, notes, and status updates (latest first)</p>
                  </div>
                  <div className="rounded-full bg-[var(--surface-2)] border border-[var(--border-muted)] px-3 py-1 text-xs font-bold text-[var(--text-muted)]">
                    {sortedTimeline.length} Total Events
                  </div>
                </div>

                {pagedTimeline.length ? (
                  <div className="relative before:absolute before:left-3 before:top-2.5 before:bottom-2.5 before:w-[2px] before:bg-[var(--border-muted)] space-y-2.5">
                    {pagedTimeline.map((item, index) => {
                      const meta = getActivityMeta(item);
                      const Icon = meta.icon;
                      const timeInfo = formatActivityTimestamp(item.date || item.createdAt);

                      return (
                        <div key={`${item.title}-${item.date}-${index}`} className="relative pl-9 group">
                          {/* Timeline Icon Node */}
                          <div className={cn(
                            'absolute left-0 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--surface)] shadow-2xs transition-transform group-hover:scale-110 z-10',
                            meta.bg,
                            meta.text
                          )}>
                            <Icon size={11} />
                          </div>

                          {/* Minimal Activity Item Card */}
                          <div className="rounded-xl border border-[var(--border-muted)] bg-[var(--surface)] hover:bg-[var(--surface-2)]/60 px-4 py-3 shadow-2xs hover:shadow-xs transition-all">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-2 min-w-0">
                                <span className={cn(
                                  'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border shrink-0',
                                  meta.bg,
                                  meta.border,
                                  meta.text
                                )}>
                                  {meta.label}
                                </span>
                                <span className="text-sm font-bold text-[var(--text-main)] truncate">{item.title}</span>
                                {item.actorName && (
                                  <span className="text-xs font-medium text-[var(--text-muted)] shrink-0 hidden sm:inline">
                                    • <span>{item.actorName}</span>
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-col items-end shrink-0 text-right" title={timeInfo.formatted}>
                                {timeInfo.isUpcoming ? (
                                  <div className="flex flex-col items-end">
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-md">
                                      <Clock3 size={12} className="shrink-0 text-amber-600 dark:text-amber-400" />
                                      <span>{timeInfo.relative || 'Upcoming'}</span>
                                    </span>
                                    <span className="mt-0.5 text-[11px] font-medium text-amber-700/80 dark:text-amber-300/80">
                                      {timeInfo.formatted}
                                    </span>
                                  </div>
                                ) : timeInfo.relative ? (
                                  <div className="flex flex-col items-end">
                                    <div className="flex items-center gap-1 text-xs font-bold text-[var(--primary)]">
                                      <Clock3 size={12} className="shrink-0 opacity-80" />
                                      <span>{timeInfo.relative}</span>
                                    </div>
                                    <span className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                                      {timeInfo.formatted}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
                                    <Clock3 size={12} className="shrink-0 opacity-70" />
                                    <span>{timeInfo.formatted}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {item.detail && item.detail !== item.title && (
                              <p className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed line-clamp-2">
                                {item.detail}
                              </p>
                            )}

                            {Array.isArray(item.attachments) && item.attachments.length ? (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {item.attachments.slice(0, 4).map((file) => (
                                  <a
                                    key={file.driveFileId || file.id}
                                    href={file.driveWebViewLink || `#${file.driveFileId || file.id}`}
                                    target={file.driveWebViewLink ? '_blank' : undefined}
                                    rel={file.driveWebViewLink ? 'noreferrer' : undefined}
                                    className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--text-main)] transition cursor-pointer"
                                  >
                                    <Paperclip size={11} />
                                    <span className="truncate max-w-[160px]">{file.name}</span>
                                  </a>
                                ))}
                              </div>
                            ) : null}

                            {Array.isArray(item.meta?.changes) && item.meta.changes.length ? (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {item.meta.changes.slice(0, 4).map((change) => (
                                  <span key={change.key || change.label} className="rounded border border-[var(--border-muted)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
                                    {change.label}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)]/40 p-10 text-center text-sm text-[var(--text-muted)]">
                    No timeline events recorded.
                  </div>
                )}

                <PaginationBar
                  currentPage={timelinePage}
                  totalItems={sortedTimeline.length}
                  pageSize={timelinePageSize}
                  onPageChange={(page) => setTabPage('timeline', page)}
                />
              </div>
            );
          })()}
        </div>

        {(activeTab === 'overview' || activeTab === 'details') ? (
        <div className="space-y-4">
          {/* Quick 1-Click Action & Contact Card */}
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xs">
            <div className="flex items-center justify-between border-b border-[var(--border-muted)] px-5 py-3.5 bg-[var(--surface-2)]">
              <div className="flex items-center gap-2">
                <User size={16} className="text-[var(--primary)]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">Primary Contact</h3>
              </div>
              {canWriteLead ? (
                <Button variant="ghost" size="sm" onClick={() => { setContactEdit(primaryContact || null); setContactOpen(true); }} className="h-7 text-xs px-2">
                  {primaryContact ? 'Edit' : '+ Add'}
                </Button>
              ) : null}
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-base font-bold text-[var(--text-main)]">
                  {primaryContact ? `${primaryContact.firstName || ''} ${primaryContact.lastName || ''}`.trim() : (lead.contactPerson || lead.name || 'No contact named')}
                </p>
                {primaryContact?.jobTitle ? (
                  <p className="text-xs font-medium text-[var(--text-muted)] mt-0.5">{primaryContact.jobTitle}</p>
                ) : null}
              </div>

              {/* 1-Click Action Buttons */}
              <div className="grid grid-cols-3 gap-2.5">
                {(() => {
                  const phoneNum = lead.phone || primaryContact?.phone;
                  const rawDigits = String(phoneNum || '').replace(/\D/g, '');
                  const waUrl = rawDigits ? `https://wa.me/${rawDigits.startsWith('91') || rawDigits.length > 10 ? rawDigits : `91${rawDigits}`}` : null;
                  const emailAddr = lead.email || primaryContact?.email;

                  return (
                    <>
                      <a
                        href={phoneNum ? `tel:${phoneNum}` : undefined}
                        onClick={(e) => { if (!phoneNum) e.preventDefault(); }}
                        className={cn(
                          'group flex flex-col items-center justify-center gap-1.5 py-2.5 px-1 rounded-xl border transition-all text-center select-none',
                          phoneNum
                            ? 'border-[var(--border)] bg-[var(--surface-2)]/50 hover:bg-emerald-500/10 hover:border-emerald-500/30 text-[var(--text-main)] hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer shadow-xs'
                            : 'border-[var(--border-muted)] bg-[var(--surface-2)] text-[var(--text-muted)] opacity-40 cursor-not-allowed'
                        )}
                        title={phoneNum ? `Call ${phoneNum}` : 'No phone number'}
                      >
                        <div className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-lg transition-transform group-hover:scale-110',
                          phoneNum ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-gray-200 dark:bg-gray-800 text-gray-400'
                        )}>
                          <Phone size={14} />
                        </div>
                        <span className="text-[11px] font-semibold">Call</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => { if (phoneNum) setWhatsAppOpen(true); }}
                        className={cn(
                          'group flex flex-col items-center justify-center gap-1.5 py-2.5 px-1 rounded-xl border transition-all text-center select-none cursor-pointer',
                          phoneNum
                            ? 'border-[var(--border)] bg-[var(--surface-2)]/50 hover:bg-emerald-500/10 hover:border-emerald-500/30 text-[var(--text-main)] hover:text-emerald-600 dark:hover:text-emerald-400 shadow-xs'
                            : 'border-[var(--border-muted)] bg-[var(--surface-2)] text-[var(--text-muted)] opacity-40 cursor-not-allowed'
                        )}
                        title={phoneNum ? `WhatsApp ${phoneNum}` : 'No phone number'}
                      >
                        <div className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-lg transition-transform group-hover:scale-110',
                          phoneNum ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-gray-200 dark:bg-gray-800 text-gray-400'
                        )}>
                          <MessageSquare size={14} />
                        </div>
                        <span className="text-[11px] font-semibold">WhatsApp</span>
                      </button>
                      <a
                        href={emailAddr ? `mailto:${emailAddr}` : undefined}
                        onClick={(e) => { if (!emailAddr) e.preventDefault(); }}
                        className={cn(
                          'group flex flex-col items-center justify-center gap-1.5 py-2.5 px-1 rounded-xl border transition-all text-center select-none',
                          emailAddr
                            ? 'border-[var(--border)] bg-[var(--surface-2)]/50 hover:bg-blue-500/10 hover:border-blue-500/30 text-[var(--text-main)] hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer shadow-xs'
                            : 'border-[var(--border-muted)] bg-[var(--surface-2)] text-[var(--text-muted)] opacity-40 cursor-not-allowed'
                        )}
                        title={emailAddr ? `Email ${emailAddr}` : 'No email address'}
                      >
                        <div className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-lg transition-transform group-hover:scale-110',
                          emailAddr ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' : 'bg-gray-200 dark:bg-gray-800 text-gray-400'
                        )}>
                          <Mail size={14} />
                        </div>
                        <span className="text-[11px] font-semibold">Email</span>
                      </a>
                    </>
                  );
                })()}
              </div>

              <div className="space-y-2 pt-2 border-t border-[var(--border-muted)] text-xs text-[var(--text-muted)]">
                {(lead.phone || primaryContact?.phone) ? (
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="shrink-0 text-[var(--text-muted)]" />
                    <span className="text-[var(--text-main)] font-medium">{formatPhoneDisplay(lead.phone || primaryContact?.phone)}</span>
                  </div>
                ) : null}
                {(lead.email || primaryContact?.email) ? (
                  <div className="flex items-center gap-2 truncate">
                    <Mail size={14} className="shrink-0 text-[var(--text-muted)]" />
                    <span className="text-[var(--text-main)] font-medium truncate">{lead.email || primaryContact?.email}</span>
                  </div>
                ) : null}
                {(lead.address || lead.city || lead.state || lead.country) ? (
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="shrink-0 text-[var(--text-muted)] mt-0.5" />
                    <span>{[lead.address, lead.city, lead.state, lead.country].filter(Boolean).join(', ')}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Lead Info Snapshot Card */}
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xs">
            <div className="flex items-center justify-between border-b border-[var(--border-muted)] px-5 py-3.5 bg-[var(--surface-2)]">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-[var(--primary)]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">Lead Snapshot</h3>
              </div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-4 border-b border-[var(--border-muted)] px-5 py-3">
                <span className="text-xs font-semibold text-[var(--text-muted)]">Type</span>
                <span className="text-xs font-semibold text-[var(--text-main)]">{lead.type || 'Organization'}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-[var(--border-muted)] px-5 py-3">
                <span className="text-xs font-semibold text-[var(--text-muted)]">Pipeline</span>
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
              <div className="flex items-center justify-between gap-4 border-b border-[var(--border-muted)] px-5 py-3">
                <span className="text-xs font-semibold text-[var(--text-muted)]">Status</span>
                <div>{renderStatusPill(lead.status || 'New', getLeadStatusColor(lead.status || 'New', statusColors), true)}</div>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-[var(--border-muted)] px-5 py-3">
                <span className="text-xs font-semibold text-[var(--text-muted)]">Source</span>
                <div>{renderSourcePill(lead.source || 'Website', getLeadSourceColor(lead.source || 'Website'), true)}</div>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-[var(--border-muted)] px-5 py-3">
                <span className="text-xs font-semibold text-[var(--text-muted)]">Assigned Owner</span>
                <div className="flex items-center gap-2">
                  <UserAvatar name={ownerName} className="h-5 w-5" fallbackSize={20} />
                  <span className="text-xs text-[var(--primary)] font-semibold">{ownerName}</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-[var(--border-muted)] px-5 py-3">
                <span className="text-xs font-semibold text-[var(--text-muted)]">Labels</span>
                <div className="flex flex-wrap gap-1 items-center justify-end">
                  {normalizeLabels(lead.labels).length ? normalizeLabels(lead.labels).slice(0, 3).map((label) => {
                    const color = labelColorMap.get(label) || '#2563eb';
                    return <span key={label}>{renderLabelPill(label, color, true)}</span>;
                  }) : <span className="text-xs text-[var(--text-muted)]">-</span>}
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 px-5 py-3">
                <span className="text-xs font-semibold text-[var(--text-muted)]">Created</span>
                <span className="text-xs text-[var(--text-main)] font-medium">{formatDate(lead.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Additional Details Card */}
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xs">
            <div className="border-b border-[var(--border-muted)] px-5 py-3 bg-[var(--surface-2)]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">Additional Details</h3>
            </div>
            <div className="flex flex-col px-5 py-2">
              <div className="flex items-center justify-between border-b border-[var(--border-muted)] py-2.5 last:border-0">
                <span className="text-xs font-medium text-[var(--text-muted)]">Lead Value</span>
                <span className="text-xs font-bold text-[var(--text-main)]">
                  {lead.currencySymbol || '$'}{Number(lead.value || 0).toLocaleString()} {lead.currency || 'USD'}
                </span>
              </div>
              {lead.website ? (
                <div className="flex items-center justify-between border-b border-[var(--border-muted)] py-2.5 last:border-0">
                  <span className="text-xs font-medium text-[var(--text-muted)]">Website</span>
                  <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" className="text-xs text-[var(--primary)] hover:underline truncate max-w-[180px]">
                    {lead.website}
                  </a>
                </div>
              ) : null}
              {(lead.vatNumber || lead.gstNumber) ? (
                <div className="flex items-center justify-between border-b border-[var(--border-muted)] py-2.5 last:border-0">
                  <span className="text-xs font-medium text-[var(--text-muted)]">Tax Info</span>
                  <span className="text-xs font-semibold text-[var(--text-main)]">
                    {lead.vatNumber ? `VAT: ${lead.vatNumber}` : `GST: ${lead.gstNumber}`}
                  </span>
                </div>
              ) : null}
              {createdByName ? (
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-xs font-medium text-[var(--text-muted)]">Created By</span>
                  <span className="text-xs text-[var(--text-main)] font-medium">{createdByName}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        ) : null}
      </div>

      <LeadFormModal
        open={editingLeadOpen}
        initialData={lead}
        lead={lead}
        options={leadOptions}
        users={users}
        pipelines={pipelines}
        onClose={() => setEditingLeadOpen(false)}
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

      <FollowUpFormModal
        open={activityType === 'reminder'}
        onClose={() => { setActivityType(null); setActivityEdit(null); }}
        onSaved={async () => {
          setActivityType(null);
          setActivityEdit(null);
          await load();
        }}
        initialValue={activityType === 'reminder' ? activityEdit : null}
        lockRelatedEntity={true}
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

      <ActivityViewModal
        open={Boolean(viewActivityTarget)}
        onClose={() => setViewActivityTarget(null)}
        item={viewActivityTarget}
        onEdit={openEditActivity}
        onCompleteFollowUp={(item) => setCompleteFollowUpTarget(item)}
        canWriteLead={canWriteLead}
        userLookup={userLookup}
      />

      <CompleteFollowUpModal
        open={Boolean(completeFollowUpTarget)}
        onClose={() => setCompleteFollowUpTarget(null)}
        item={completeFollowUpTarget}
        lead={lead}
        onComplete={handleCompleteFollowUp}
        busy={completeFollowUpBusy}
      />

      <WhatsAppModal
        open={whatsAppOpen}
        onClose={() => setWhatsAppOpen(false)}
        recipient={{
          leadId: lead?.id,
          name: lead?.contactPerson || lead?.name,
          companyName: lead?.companyName,
          phone: lead?.phone || primaryContact?.phone,
          services: lead?.requiredServices,
          amount: lead?.estimatedBudget || lead?.value
        }}
        onSent={load}
      />
    </div>
  );
}
