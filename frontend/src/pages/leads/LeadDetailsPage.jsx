import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Activity, CalendarDays, CalendarPlus, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Edit3, HelpCircle, Mail, MapPin, Mic, Paperclip, Phone, Save, Tag, UserPlus, Users, Wand2, X, Trash2, Layers, MoreHorizontal, Hexagon, CheckCircle, Search, User, RefreshCcw, PlusCircle, Anchor, Eye, Printer, FileText, Download, MessageSquare, Send, Sparkles, ArrowRightCircle, PhoneCall, Bell, CheckSquare, MessageCircle, Zap, Volume2, RotateCw, ExternalLink, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
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
import { RichTextEditor } from '../../components/forms/RichTextEditor';
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
import { AiLeadInsightsCard } from '../../components/leads/AiLeadInsightsCard';
import { AiLeadInsightDetailsTab } from '../../components/leads/AiLeadInsightDetailsTab';
import { LeadOverdueBanner } from '../../components/leads/LeadOverdueBanner';
import { LeadStageStepper } from '../../components/leads/LeadStageStepper';
import { LeadBantTracker } from '../../components/leads/LeadBantTracker';
import { QuickServiceTagger } from '../../components/leads/QuickServiceTagger';
import { WhatsAppTemplateModal } from '../../components/leads/WhatsAppTemplateModal';
import { LeadStageVelocityBadge } from '../../components/leads/LeadStageVelocityBadge';
import { MergeLeadModal } from '../../components/leads/MergeLeadModal';
import { FollowUpCadenceStepper } from '../../components/followups/FollowUpQuickPresets';
import { GitMerge, Brain, ChevronUp, ChevronDown, Scale, RotateCcw, ShieldCheck } from 'lucide-react';
import { normalizeEventAttachment, normalizeEventAttachments } from '../../components/events/eventAttachments';
import {
  DEFAULT_LEAD_OPTIONS,
  getLeadStatusColor,
  getLeadSourceColor,
  getLeadServiceColor
} from '../../config/leadManagement';
import {
  QUOTATION_PACKAGE_PRESETS,
  MILESTONE_PRESETS,
  buildWhatsAppProposalPitch
} from '../../config/quotationPresets';
import { QuotationBuilderModal } from '../../components/quotations/QuotationBuilderModal';
import {
  canonicalRoute,
  clientRoute,
  eventRouteSegment,
  invoiceRoute,
  leadRoute,
  matchesRouteIdentifier
} from '../../utils/entityRoutes';

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
  items: [],
  features: [],
  scopeOfWork: '',
  technologyStack: '',
  timeline: '',
  customContent: '',
  paymentInfo: '',
  termsAndConditions: '',
  legalAgreements: [],
  afterCompletion: '',
  amcPlan: null,
  nextYearCostSummary: '',
  milestoneTemplate: '',
  terms: '',
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
    .filter((line) => !/^\s*(service|amount|items json|quotation data json|milestone template|discount type|discount value|gst applicable|gst rate|total amount|status|quotation link|task|reminder|comments?)\s*:/i.test(line))
    .join('\n')
    .trim();
}

function cleanSingleLine(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function textLines(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueTextLines(...values) {
  return Array.from(new Set(values.flatMap(textLines)));
}

function joinTextBlocks(...values) {
  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value, index, rows) => rows.indexOf(value) === index)
    .join('\n\n');
}

function stripHtml(value) {
  if (!value) return '';
  if (typeof document === 'undefined') return String(value).replace(/<[^>]*>/g, ' ');
  const container = document.createElement('div');
  container.innerHTML = String(value);
  return container.textContent || container.innerText || '';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[char]));
}

function safeRichHtml(value) {
  if (typeof document === 'undefined') return escapeHtml(stripHtml(value));
  const template = document.createElement('template');
  template.innerHTML = String(value || '');
  template.content.querySelectorAll('script,style,iframe,object,embed,form,input,button').forEach((node) => node.remove());
  template.content.querySelectorAll('*').forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const val = String(attribute.value || '').trim().toLowerCase();
      if (name.startsWith('on') || name === 'style' || (['href', 'src'].includes(name) && val.startsWith('javascript:'))) {
        node.removeAttribute(attribute.name);
      }
    });
  });
  return template.innerHTML;
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

function isQuotationEvent(event) {
  if (!event) return false;
  const type = String(event?.eventType || event?.type || '').toLowerCase();
  if (type === 'quotation') return true;
  const labels = Array.isArray(event?.labels) ? event.labels.map((l) => String(l).toLowerCase()) : [];
  if (labels.includes('quotation')) return true;
  return false;
}

function getQuotationDate(event) {
  return String(event?.createdAt || event?.startDate || event?.endDate || event?.updatedAt || '');
}

function getLatestQuotationEvent(events = []) {
  const quotations = (events || []).filter(isQuotationEvent);
  if (!quotations.length) return null;
  return [...quotations].sort((a, b) => {
    const dateB = getQuotationDate(b);
    const dateA = getQuotationDate(a);
    return dateB.localeCompare(dateA);
  })[0] || null;
}

function getQuotationAmount(lead, quotationEvent) {
  if (!quotationEvent && !lead?.quotationAmount && !lead?.quotedAmount && !lead?.quotationValue) {
    return null;
  }
  const directAmount = pickAmount(
    quotationEvent?.payload?.totalAmount,
    quotationEvent?.payload?.amount,
    quotationEvent?.payload?.subtotal,
    quotationEvent?.totalAmount,
    quotationEvent?.amount,
    quotationEvent?.quotationAmount,
    quotationEvent?.quotedAmount,
    quotationEvent?.quoteAmount,
    quotationEvent?.value,
    getStructuredField(quotationEvent?.description, 'Total Amount'),
    getStructuredField(quotationEvent?.description, 'Amount'),
    lead?.quotationAmount,
    lead?.quotedAmount,
    lead?.quoteAmount,
    lead?.quotationValue
  );
  if (directAmount != null) return directAmount;
  if (quotationEvent) {
    return extractAmountFromText(`${quotationEvent?.title || ''} ${quotationEvent?.description || ''}`);
  }
  return null;
}

function getQuotationStatus(lead, quotationEvent) {
  if (!quotationEvent) return 'Not sent';
  const structuredStatus = getStructuredField(quotationEvent?.description, 'Status');
  if (structuredStatus) return structuredStatus;
  const payloadStatus = quotationEvent?.payload?.status || quotationEvent?.status;
  if (payloadStatus && payloadStatus !== 'Scheduled') return payloadStatus;
  const directStatus = displayValue(
    lead?.quotationStatus || lead?.quoteStatus || lead?.quotationSendStatus,
    ''
  );
  if (directStatus) return directStatus;
  const sentFlag = lead?.quotationSent ?? lead?.quoteSent ?? lead?.isQuotationSent;
  if (sentFlag === true) return 'Sent';
  if (sentFlag === false) return 'Draft';
  const text = `${quotationEvent.title || ''} ${quotationEvent.description || ''}`.toLowerCase();
  if (/(approved|accepted)/.test(text)) return 'Approved';
  if (/(rejected|declined)/.test(text)) return 'Rejected';
  if (/(sent|send|shared|emailed|mail|whatsapp|delivered)/.test(text)) return 'Sent';
  return 'Draft';
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
  const structuredQuotationData = (() => {
    try {
      const raw = getStructuredField(description, 'Quotation Data JSON');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  })();
  const readDetail = (key, fallback = '') => event?.[key] ?? event?.payload?.[key] ?? structuredQuotationData?.[key] ?? fallback;
  return {
    id: event?.id || '',
    title: event?.title || 'Quotation',
    serviceNames: selectedServices,
    serviceName: selectedServices.join(', '),
    proposalDate: event?.startDate || event?.createdAt || '',
    validUntil: event?.endDate || '',
    amount,
    items: (() => {
      try {
        const directItems = readDetail('items', null);
        if (Array.isArray(directItems)) return directItems;
        const raw = getStructuredField(description, 'Items JSON');
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    })(),
    features: Array.isArray(readDetail('features', [])) ? readDetail('features', []) : textLines(readDetail('features', '')),
    scopeOfWork: readDetail('scopeOfWork', ''),
    technologyStack: readDetail('technologyStack', ''),
    timeline: readDetail('timeline', ''),
    customContent: readDetail('customContent', ''),
    paymentInfo: readDetail('paymentInfo', ''),
    termsAndConditions: readDetail('termsAndConditions', ''),
    legalAgreements: (() => {
      const direct = readDetail('legalAgreements', null);
      if (Array.isArray(direct)) return direct;
      try {
        const raw = getStructuredField(description, 'Legal Agreements JSON');
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    })(),
    afterCompletion: readDetail('afterCompletion', ''),
    amcPlan: readDetail('amcPlan', null),
    nextYearCostSummary: readDetail('nextYearCostSummary', ''),
    milestoneTemplate: getStructuredField(description, 'Milestone Template') || '',
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

function formatCallDuration(seconds) {
  const sec = Number(seconds);
  if (!Number.isFinite(sec) || sec <= 0) return null;
  const mins = Math.floor(sec / 60);
  const remSec = Math.floor(sec % 60);
  if (mins === 0) return `${remSec}s`;
  return `${mins}m ${remSec < 10 ? '0' : ''}${remSec}s`;
}

function getCallOutcomeBadge(outcome) {
  if (!outcome) return null;
  const o = String(outcome).toLowerCase();
  if (o.includes('connected') || o.includes('interested') || o.includes('discussion')) {
    return { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-700 dark:text-emerald-300' };
  }
  if (o.includes('busy') || o.includes('follow') || o.includes('callback') || o.includes('rescheduled')) {
    return { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-700 dark:text-amber-300' };
  }
  if (o.includes('wrong') || o.includes('not interested') || o.includes('switched off') || o.includes('no answer') || o.includes('unreachable') || o.includes('missed')) {
    return { bg: 'bg-rose-500/15', border: 'border-rose-500/30', text: 'text-rose-700 dark:text-rose-300' };
  }
  return { bg: 'bg-blue-500/15', border: 'border-blue-500/30', text: 'text-blue-700 dark:text-blue-300' };
}

function extractCallData(item) {
  if (!item) return null;
  const kind = String(item.kind || item.eventType || item.type || '').toLowerCase();
  const title = String(item.title || '').toLowerCase();
  const hasRecording = Boolean(
    item.meta?.callRecordingUrl ||
    item.payload?.callRecordingUrl ||
    item.recordingUrl ||
    item.recordingFile?.url ||
    item.recordingFile?.driveWebViewLink ||
    (Array.isArray(item.attachments) && item.attachments.some((a) => a?.kind === 'call_recording' || (typeof a?.url === 'string' && a.url.match(/\.(mp3|wav|ogg|m4a|aac|webm)($|\?)/i))))
  );
  const isCall = kind === 'call' || kind === 'call_logged' || title.includes('call') || hasRecording;

  if (!isCall) return null;

  const recordingUrl =
    item.meta?.callRecordingUrl ||
    item.payload?.callRecordingUrl ||
    item.recordingUrl ||
    item.recordingFile?.url ||
    item.recordingFile?.driveWebViewLink ||
    (Array.isArray(item.attachments) && item.attachments.find((a) => a?.kind === 'call_recording' || (typeof a?.url === 'string' && a.url.match(/\.(mp3|wav|ogg|m4a|aac|webm)($|\?)/i)))?.url) ||
    null;

  const duration = item.meta?.callDuration ?? item.payload?.callDuration ?? null;
  const outcome = item.meta?.callOutcome || item.payload?.callOutcome || null;
  const type = item.meta?.callType || item.payload?.callType || null;
  const callerNumber = item.meta?.callerNumber || item.payload?.callerNumber || null;
  const aiTakeaways = item.meta?.aiTakeaways || item.payload?.aiTakeaways || null;

  return {
    isCall: true,
    recordingUrl,
    duration: duration ? Number(duration) : null,
    outcome,
    type,
    callerNumber,
    aiTakeaways
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



const LEGAL_CATEGORIES = [
  'All',
  'General',
  'Contracts',
  'Project Governance',
  'Commercial',
  'Confidentiality',
  'Intellectual Property',
  'Security & Privacy',
  'Operations',
  'Maintenance'
];

function buildInitialLegalAgreements(savedAgreements, masterLegalTerms = [], fallbackTerms = '') {
  if (Array.isArray(masterLegalTerms) && masterLegalTerms.length > 0) {
    const savedMap = new Map((savedAgreements || []).map((item) => [String(item.id || item.documentType || item.name).toLowerCase(), item]));
    return masterLegalTerms.map((term) => {
      const key1 = String(term.id || '').toLowerCase();
      const key2 = String(term.documentType || '').toLowerCase();
      const key3 = String(term.name || '').toLowerCase();
      const saved = (key1 && savedMap.get(key1)) || (key2 && savedMap.get(key2)) || (key3 && savedMap.get(key3));

      if (saved) {
        return {
          id: term.id,
          name: saved.name || term.name,
          documentType: saved.documentType || term.documentType || 'terms_and_conditions',
          category: saved.category || term.category || 'General',
          enabled: saved.enabled !== undefined ? Boolean(saved.enabled) : Boolean(term.includeInQuotation),
          content: saved.content !== undefined ? saved.content : (term.content || '')
        };
      }

      const isTerms = term.documentType === 'terms_and_conditions' || String(term.name).toLowerCase().includes('terms');
      return {
        id: term.id,
        name: term.name,
        documentType: term.documentType || 'terms_and_conditions',
        category: term.category || 'General',
        enabled: Boolean(term.includeInQuotation),
        content: (isTerms && fallbackTerms?.trim()) ? fallbackTerms : (term.content || '')
      };
    });
  }

  if (Array.isArray(savedAgreements) && savedAgreements.length > 0) {
    return savedAgreements;
  }

  if (fallbackTerms?.trim()) {
    return [{
      id: 'default-terms',
      name: 'Terms & Conditions',
      documentType: 'terms_and_conditions',
      category: 'General',
      enabled: true,
      content: fallbackTerms
    }];
  }

  return [];
}

function QuotationEditor({
  onClose,
  onSave,
  leadId,
  lead = null,
  settings = null,
  quotationMaster = null,
  initialValue = null,
  busy = false,
  serviceOptions = [],
  serviceCatalog = [],
  amcPlans = [],
  legalTerms = [],
  defaultTermsAndConditions = '',
  currency = 'INR',
  defaultAmount = '',
  defaultGstApplicable = false,
  defaultGstRate = 18
}) {
  const [formData, setFormData] = useState(EMPTY_QUOTATION);
  const [reminderDraft, setReminderDraft] = useState({ title: '', date: '', time: '' });
  const [commentDraft, setCommentDraft] = useState('');
  const [featureDraft, setFeatureDraft] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const [expandedAgreements, setExpandedAgreements] = useState({});
  const [legalSearch, setLegalSearch] = useState('');
  const [legalCategoryFilter, setLegalCategoryFilter] = useState('All');

  useEffect(() => {
    if (initialValue?.id || initialValue?.title) {
      const details = getQuotationDetails(initialValue, lead);
      const initialAgreements = buildInitialLegalAgreements(
        details.legalAgreements,
        legalTerms,
        details.termsAndConditions || defaultTermsAndConditions || ''
      );
      setFormData({
        ...EMPTY_QUOTATION,
        title: details.title || '',
        serviceNames: details.serviceNames || [],
        proposalDate: formatDateInput(details.proposalDate),
        validUntil: formatDateInput(details.validUntil),
        amount: details.amount != null ? String(details.amount) : '',
        items: details.items || [],
        features: details.features || [],
        scopeOfWork: details.scopeOfWork || '',
        technologyStack: details.technologyStack || '',
        timeline: details.timeline || '',
        customContent: details.customContent || '',
        paymentInfo: details.paymentInfo || '',
        termsAndConditions: details.termsAndConditions || defaultTermsAndConditions || '',
        legalAgreements: initialAgreements,
        afterCompletion: details.afterCompletion || '',
        amcPlan: details.amcPlan || null,
        nextYearCostSummary: details.nextYearCostSummary || '',
        milestoneTemplate: details.milestoneTemplate || '',
        terms: details.terms || '',
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
    const defaultServices = serviceOptions.length ? serviceOptions : (lead ? getLeadServiceNames(lead) : []);
    const templatePatch = buildServiceTemplatePatch(defaultServices);
    const initialTerms = templatePatch.termsAndConditions?.trim()
      ? templatePatch.termsAndConditions
      : (defaultTermsAndConditions || '');
    const initialAgreements = buildInitialLegalAgreements(
      null,
      legalTerms,
      initialTerms
    );
    setFormData({
      ...EMPTY_QUOTATION,
      serviceNames: defaultServices,
      title: defaultServices.length ? `${defaultServices.join(', ')} proposal for ${lead?.companyName || lead?.name || 'Client'}` : '',
      proposalDate: toDateOnlyString(today),
      validUntil: toDateOnlyString(addDaysToDate(today, 30)),
      amount: templatePatch.amount || (defaultAmount != null && defaultAmount !== '' ? String(defaultAmount) : ''),
      ...templatePatch,
      termsAndConditions: initialTerms,
      legalAgreements: initialAgreements,
      gstApplicable: Boolean(defaultGstApplicable),
      gstRate: String(defaultGstRate || 18)
    });
    setReminderDraft({ title: '', date: '', time: '' });
    setCommentDraft('');
  }, [initialValue, serviceOptions, serviceCatalog, amcPlans, legalTerms, defaultTermsAndConditions, defaultAmount, defaultGstApplicable, defaultGstRate, lead]);

  function toggleAgreement(index) {
    setFormData((prev) => {
      const list = [...(prev.legalAgreements || [])];
      if (list[index]) {
        list[index] = { ...list[index], enabled: !list[index].enabled };
      }
      return { ...prev, legalAgreements: list };
    });
  }

  function updateAgreementContent(index, newContent) {
    setFormData((prev) => {
      const list = [...(prev.legalAgreements || [])];
      if (list[index]) {
        list[index] = { ...list[index], content: newContent };
      }
      return { ...prev, legalAgreements: list };
    });
  }

  function resetAgreementToTemplate(index) {
    setFormData((prev) => {
      const list = [...(prev.legalAgreements || [])];
      const item = list[index];
      if (!item) return prev;
      const master = legalTerms.find((t) => t.id === item.id || t.documentType === item.documentType || t.name === item.name);
      if (master) {
        list[index] = { ...list[index], content: master.content || '' };
        toast.success(`Reset "${item.name}" to template`);
      }
      return { ...prev, legalAgreements: list };
    });
  }

  function toggleAllAgreements(enableAll) {
    setFormData((prev) => ({
      ...prev,
      legalAgreements: (prev.legalAgreements || []).map((a) => ({ ...a, enabled: enableAll }))
    }));
    toast.success(enableAll ? 'Enabled all legal agreements for this quotation' : 'Excluded all legal agreements from this quotation');
  }

  function resetAllAgreementsFromMaster() {
    const fresh = buildInitialLegalAgreements(null, legalTerms, defaultTermsAndConditions);
    setFormData((prev) => ({
      ...prev,
      legalAgreements: fresh,
      termsAndConditions: defaultTermsAndConditions || ''
    }));
    toast.success('Reset all legal agreements from Legal Master templates');
  }

  function findCatalogServices(names = []) {
    const catalogByName = new Map(serviceCatalog.map((service) => [String(service.name || '').trim().toLowerCase(), service]));
    return names.map((name) => catalogByName.get(String(name || '').trim().toLowerCase())).filter(Boolean);
  }

  function findRecommendedAmc(selectedRecords = []) {
    const directId = selectedRecords.map((service) => service.amcPlanId).find(Boolean);
    if (directId) return amcPlans.find((plan) => String(plan.id) === String(directId)) || null;
    const selectedIds = new Set(selectedRecords.map((service) => String(service.id)));
    return amcPlans.find((plan) => (plan.linkedServiceIds || []).some((id) => selectedIds.has(String(id)))) || null;
  }

  function buildServiceTemplatePatch(names = []) {
    const selectedRecords = findCatalogServices(names);
    if (!selectedRecords.length) return {};
    const items = selectedRecords.map((service, index) => {
      const rate = Math.max(0, Number(service.defaultPrice || 0));
      return {
        id: `service-${service.id || index}`,
        serviceId: service.id || '',
        name: service.name,
        description: service.description || service.scopeOfWork || '',
        qty: 1,
        rate,
        amount: rate,
        isAddon: service.serviceKind === 'addon',
        templateGenerated: true
      };
    });
    const catalogTotal = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const leadBudget = Number(lead?.estimatedBudget ?? lead?.value ?? defaultAmount ?? 0);
    const recommendedAmc = findRecommendedAmc(selectedRecords);
    const nextYearRows = selectedRecords
      .filter((service) => Number(service.nextYearCost || 0) > 0)
      .map((service) => `${service.name}: ${formatLeadAmount(service.nextYearCost, currency)} / year`);
    if (recommendedAmc && Number(recommendedAmc.nextYearCost || recommendedAmc.defaultCost || 0) > 0) {
      nextYearRows.push(`${recommendedAmc.name}: ${formatLeadAmount(recommendedAmc.nextYearCost || recommendedAmc.defaultCost, currency)} / ${recommendedAmc.defaultBillingCycle || 'year'}`);
    }
    return {
      items,
      amount: String(catalogTotal > 0 ? catalogTotal : (leadBudget > 0 ? leadBudget : '')),
      features: uniqueTextLines(...selectedRecords.map((service) => service.featuresText)),
      scopeOfWork: joinTextBlocks(...selectedRecords.map((service) => service.scopeOfWork)),
      technologyStack: uniqueTextLines(...selectedRecords.map((service) => service.technologyStack)).join('\n'),
      timeline: uniqueTextLines(...selectedRecords.map((service) => service.timeline)).join(' + '),
      paymentInfo: joinTextBlocks(...selectedRecords.map((service) => service.paymentInfo)),
      termsAndConditions: joinTextBlocks(...selectedRecords.map((service) => service.termsAndConditions)),
      afterCompletion: joinTextBlocks(...selectedRecords.map((service) => service.afterCompletion)),
      amcPlan: recommendedAmc ? { ...recommendedAmc } : null,
      nextYearCostSummary: nextYearRows.join('\n')
    };
  }

  function applyServiceTemplates(names, showMessage = true) {
    const templatePatch = buildServiceTemplatePatch(names);
    setFormData((current) => ({
      ...current,
      serviceNames: names,
      title: current.title || (names.length ? `${names.join(', ')} quotation` : ''),
      ...templatePatch,
      termsAndConditions: templatePatch.termsAndConditions?.trim() || current.termsAndConditions || defaultTermsAndConditions || ''
    }));
    if (showMessage && Object.keys(templatePatch).length) toast.success('Service template, costing and quotation sections loaded');
  }

  const serviceSelectOptions = useMemo(() => {
    const values = [...serviceCatalog.map((service) => service.name), ...serviceOptions, ...(formData.serviceNames || [])].map(cleanSingleLine).filter(Boolean);
    return Array.from(new Set(values)).map((item) => {
      const service = serviceCatalog.find((entry) => String(entry.name).toLowerCase() === String(item).toLowerCase());
      return {
        value: item,
        label: item,
        description: service ? `${service.categoryName || 'Service'} · ${formatLeadAmount(service.defaultPrice, currency)}${service.serviceKind === 'addon' ? ' · Add-on' : ''}` : ''
      };
    });
  }, [serviceCatalog, serviceOptions, formData.serviceNames, currency]);

  const selectedServices = Array.isArray(formData.serviceNames) ? formData.serviceNames.filter(Boolean) : [];
  const serviceSummary = selectedServices.join(', ');
  const proposalTitle = formData.title.trim() || (serviceSummary ? `${serviceSummary} quotation` : 'Quotation');
  const amount = toAmountNumber(formData.amount);
  const quotationTotals = calculateQuotationTotals(formData);
  const leadBudget = Number(lead?.estimatedBudget ?? lead?.value ?? 0);
  const budgetDifference = leadBudget > 0 ? leadBudget - quotationTotals.subtotal : null;
  const selectedCatalogRecords = useMemo(() => findCatalogServices(selectedServices), [serviceCatalog, selectedServices]);
  const selectedCatalogIds = useMemo(() => new Set(selectedCatalogRecords.map((service) => String(service.id))), [selectedCatalogRecords]);
  const suggestedAddons = useMemo(() => serviceCatalog.filter((service) => (
    service.serviceKind === 'addon'
    && !selectedCatalogIds.has(String(service.id))
    && (service.parentServiceIds || []).some((id) => selectedCatalogIds.has(String(id)))
  )), [serviceCatalog, selectedCatalogIds]);

  function setField(key, value) {
    setFormData((cur) => ({ ...cur, [key]: value }));
  }

  function addFeature() {
    const value = cleanSingleLine(featureDraft);
    if (!value) return;
    setFormData((current) => ({ ...current, features: Array.from(new Set([...(current.features || []), value])) }));
    setFeatureDraft('');
  }

  function removeFeature(index) {
    setFormData((current) => ({ ...current, features: (current.features || []).filter((_, itemIndex) => itemIndex !== index) }));
  }

  function applyAmcPlan(planId) {
    const plan = amcPlans.find((item) => String(item.id) === String(planId)) || null;
    setFormData((current) => ({
      ...current,
      amcPlan: plan ? { ...plan } : null,
      nextYearCostSummary: plan
        ? joinTextBlocks(current.nextYearCostSummary, `${plan.name}: ${formatLeadAmount(plan.nextYearCost || plan.defaultCost || 0, currency)} / ${plan.defaultBillingCycle || 'year'}`)
        : current.nextYearCostSummary
    }));
  }

  // 1-Click Package Preset Loader
  function applyPackagePreset(preset) {
    const today = new Date();
    const clientName = lead?.companyName || lead?.name || 'Client';
    const items = (preset.items || []).map((it, idx) => ({ ...it, id: `pkg-item-${idx + 1}` }));
    setFormData((cur) => ({
      ...cur,
      title: `${preset.title} for ${clientName}`,
      serviceNames: Array.from(new Set([...cur.serviceNames, ...preset.serviceNames])),
      amount: String(preset.amount),
      items,
      proposalDate: toDateOnlyString(today),
      validUntil: toDateOnlyString(addDaysToDate(today, preset.validityDays || 30)),
      gstApplicable: preset.gstApplicable,
      gstRate: String(preset.gstRate || 18),
      milestoneTemplate: preset.milestoneTemplate,
      comments: [
        `Payment Schedule: ${preset.milestoneTemplate}`,
        `Terms & Scope:\n${preset.terms}`
      ].filter(Boolean).join('\n\n')
    }));
    toast.success(`Loaded "${preset.name}" preset (₹${Number(preset.amount).toLocaleString('en-IN')})`);
  }

  // 1-Click Auto-Fill from Lead Data
  function handleAutoFillFromLead() {
    if (!lead) return;
    const today = new Date();
    const leadServices = getLeadServiceNames(lead);
    const clientName = lead.companyName || lead.name || lead.contactPerson || 'Client';
    const leadBudget = lead.estimatedBudget || lead.value || '';
    const templatePatch = buildServiceTemplatePatch(leadServices);

    setFormData((cur) => ({
      ...cur,
      title: leadServices.length ? `${leadServices.join(', ')} proposal for ${clientName}` : `Custom Project Proposal for ${clientName}`,
      serviceNames: leadServices.length ? leadServices : cur.serviceNames,
      amount: templatePatch.amount || (leadBudget ? String(leadBudget) : cur.amount),
      ...templatePatch,
      proposalDate: toDateOnlyString(today),
      validUntil: toDateOnlyString(addDaysToDate(today, 30)),
      gstApplicable: toBooleanValue(lead.gstInvoiceRequired, false),
      comments: cur.comments || lead.notes || lead.statusNote || lead.description || ''
    }));
    toast.success('Quotation pre-filled from Lead data!');
  }

  // Deliverables Line Items
  function addDeliverableItem() {
    setFormData((cur) => {
      const nextItems = [
        ...(cur.items || []),
        { id: `item-${Date.now()}`, name: '', description: '', qty: 1, rate: 0, amount: 0 }
      ];
      return { ...cur, items: nextItems };
    });
  }

  function updateDeliverableItem(index, key, value) {
    setFormData((cur) => {
      const nextItems = [...(cur.items || [])];
      const item = { ...nextItems[index], [key]: value };
      const qty = Number(item.qty) || 0;
      const rate = Number(item.rate) || 0;
      item.amount = qty * rate;
      nextItems[index] = item;
      
      const totalFromItems = nextItems.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      return {
        ...cur,
        items: nextItems,
        amount: totalFromItems > 0 ? String(totalFromItems) : cur.amount
      };
    });
  }

  function removeDeliverableItem(index) {
    setFormData((cur) => {
      const nextItems = (cur.items || []).filter((_, i) => i !== index);
      const totalFromItems = nextItems.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      return {
        ...cur,
        items: nextItems,
        amount: totalFromItems > 0 ? String(totalFromItems) : cur.amount
      };
    });
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
      ['Timeline', formData.timeline || '-'],
      ['Base amount', amount != null ? formatLeadAmount(amount, currency) : '-'],
      ['Discount', formData.discountEnabled ? formatLeadAmount(quotationTotals.discountAmount, currency) : '-'],
      ['GST', formData.gstApplicable ? `${formatLeadAmount(quotationTotals.gstAmount, currency)} (${formData.gstRate || 0}%)` : 'Not applicable'],
      ['Total', amount != null ? formatLeadAmount(quotationTotals.totalAmount, currency) : '-'],
      ['Status', formData.status || 'Draft'],
      ['Link', formData.quotationLink || '-'],
      ['Comments', formData.comments || '-']
    ];
  }

  function openOutputTab(actionLabel) {
    // Do not pass window dimensions/features here: those make browsers render a popup
    // instead of a normal tab. Opening synchronously also avoids async popup blocking.
    const outputTab = window.open('about:blank', '_blank');
    if (!outputTab) {
      toast.error(`Unable to open ${actionLabel}. Please allow new tabs for this site.`);
      return null;
    }
    try {
      outputTab.opener = null;
    } catch {
      // Some browsers expose opener as read-only; the output can still be shown safely.
    }
    return outputTab;
  }

  function renderOutputStatus(outputTab, title, message, tone = 'loading') {
    if (!outputTab || outputTab.closed) return;
    const color = tone === 'error' ? '#dc2626' : '#2563eb';
    outputTab.document.open();
    outputTab.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${escapeHtml(title)}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #0f172a; }
            .status { width: min(420px, calc(100vw - 40px)); padding: 28px; border: 1px solid #e2e8f0; border-radius: 16px; background: white; text-align: center; box-shadow: 0 12px 35px rgba(15, 23, 42, .08); }
            .dot { display: inline-block; width: 10px; height: 10px; margin-right: 8px; border-radius: 999px; background: ${color}; }
            h1 { margin: 0 0 8px; font-size: 18px; }
            p { margin: 0; color: #64748b; font-size: 14px; }
          </style>
        </head>
        <body><div class="status"><h1><span class="dot"></span>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></div></body>
      </html>
    `);
    outputTab.document.close();
  }

  function openPreview({ print = false } = {}) {
    const previewKey = lead?.leadNumber || lead?.id || `draft_${Date.now()}`;
    const refNumber = lead?.leadNumber ? `WBT-${lead.leadNumber}` : `WBT-PROP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const previewPayload = {
      formData,
      lead,
      settings,
      quotationMaster,
      proposalTitle,
      serviceSummary,
      currency,
      quotationTotals,
      refNumber,
      savedAt: new Date().toISOString()
    };

    try {
      localStorage.setItem(`crm_quotation_preview_${previewKey}`, JSON.stringify(previewPayload));
      localStorage.setItem('crm_quotation_preview_latest', JSON.stringify(previewPayload));
    } catch (err) {
      console.warn('Failed to store preview in localStorage:', err);
    }

    const previewUrl = `#/quotations/preview?key=${encodeURIComponent(previewKey)}${print ? '&print=1' : ''}`;
    const outputTab = window.open(previewUrl, '_blank');
    if (!outputTab) {
      toast.error('Unable to open preview tab. Please allow popups for this site.');
    }
  }

    async function generatePdf(download = false) {
    const pdfTab = openOutputTab(download ? 'PDF download' : 'PDF preview');
    if (!pdfTab) return;
    renderOutputStatus(
      pdfTab,
      download ? 'Preparing PDF download' : 'Preparing PDF preview',
      'Your quotation PDF is being generated. This tab will update automatically.'
    );
    setPdfBusy(true);
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      pdf.setFontSize(16);
      pdf.text(proposalTitle, 14, 18);
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Client: ${lead?.companyName || lead?.name || 'Client'} | Date: ${formData.proposalDate || '-'}`, 14, 25);
      pdf.setTextColor(15, 23, 42);
      let y = 36;
      getSummaryLines().forEach(([label, value]) => {
        pdf.setFontSize(9);
        pdf.setTextColor(100, 116, 139);
        pdf.text(label, 14, y);
        pdf.setFontSize(10);
        pdf.setTextColor(15, 23, 42);
        pdf.text(String(value || '-'), 62, y);
        y += 8;
      });
      const pdfSections = [
        ['Project Cost Summary', (formData.items || []).map((item, index) => (
          `${index + 1}. ${item.name || 'Deliverable'} - ${item.qty || 1} x ${formatLeadAmount(item.rate || 0, currency)} = ${formatLeadAmount(item.amount || 0, currency)}`
        )).join('\n')],
        ['Scope of Work / Complete Feature List', (formData.features || []).map((feature) => `- ${feature}`).join('\n')],
        ['Detailed Scope of Work', formData.scopeOfWork],
        ['Technology Stack', formData.technologyStack],
        ['Timeline', formData.timeline],
        ['Additional Project Details', stripHtml(formData.customContent)],
        ['Payment Information', formData.paymentInfo],
        ['We Provide After Project Completion', formData.afterCompletion],
        ['AMC / Maintenance Plan', formData.amcPlan ? [
          formData.amcPlan.name,
          formData.amcPlan.description,
          `Cost: ${formatLeadAmount(formData.amcPlan.defaultCost || 0, currency)} / ${formData.amcPlan.defaultBillingCycle || 'Yearly'}`,
          formData.amcPlan.includedItems ? `Included:\n${formData.amcPlan.includedItems}` : '',
          formData.amcPlan.excludedItems ? `Not included:\n${formData.amcPlan.excludedItems}` : ''
        ].filter(Boolean).join('\n') : ''],
        ['Cost Summary for Next Year', formData.nextYearCostSummary]
      ];
      const enabledAgreements = (formData.legalAgreements || []).filter((a) => a.enabled && String(a.content || '').trim());
      if (enabledAgreements.length > 0) {
        enabledAgreements.forEach((agreement) => {
          pdfSections.push([agreement.name, agreement.content]);
        });
      } else if (String(formData.termsAndConditions || '').trim()) {
        pdfSections.push(['Terms & Conditions', formData.termsAndConditions]);
      }
      const activePdfSections = pdfSections.filter(([, value]) => String(value || '').trim());
      activePdfSections.forEach(([heading, value]) => {
        const bodyLines = pdf.splitTextToSize(String(value), 180);
        const requiredHeight = 9 + (bodyLines.length * 4.5);
        if (y + requiredHeight > 282) {
          pdf.addPage();
          y = 18;
        }
        pdf.setFontSize(11);
        pdf.setTextColor(15, 23, 42);
        pdf.text(heading, 14, y);
        y += 6;
        pdf.setFontSize(9);
        pdf.setTextColor(51, 65, 85);
        bodyLines.forEach((line) => {
          if (y > 282) {
            pdf.addPage();
            y = 18;
          }
          pdf.text(line, 14, y);
          y += 4.5;
        });
        y += 4;
      });
      const fileName = `${proposalTitle.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'quotation'}.pdf`;
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      if (download) {
        const downloadLink = document.createElement('a');
        downloadLink.href = pdfUrl;
        downloadLink.download = fileName;
        downloadLink.style.display = 'none';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();
      }
      pdfTab.location.replace(pdfUrl);
      window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
    } catch (error) {
      renderOutputStatus(
        pdfTab,
        'PDF generation failed',
        error.message || 'The quotation PDF could not be generated.',
        'error'
      );
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
    const defaultTermsMatch = (formData.legalAgreements || []).find((a) => a.enabled && (a.documentType === 'terms_and_conditions' || String(a.name || '').toLowerCase().includes('terms')));
    const quotationData = {
      items: formData.items || [],
      features: formData.features || [],
      scopeOfWork: formData.scopeOfWork || '',
      technologyStack: formData.technologyStack || '',
      timeline: formData.timeline || '',
      customContent: formData.customContent || '',
      paymentInfo: formData.paymentInfo || '',
      termsAndConditions: defaultTermsMatch?.content || formData.termsAndConditions || '',
      legalAgreements: formData.legalAgreements || [],
      afterCompletion: formData.afterCompletion || '',
      amcPlan: formData.amcPlan || null,
      nextYearCostSummary: formData.nextYearCostSummary || ''
    };
    const description = [
      serviceSummary ? `Service: ${cleanSingleLine(serviceSummary)}` : '',
      amount != null ? `Amount: ${amount}` : '',
      formData.items?.length ? `Items JSON: ${JSON.stringify(formData.items)}` : '',
      formData.milestoneTemplate ? `Milestone Template: ${cleanSingleLine(formData.milestoneTemplate)}` : '',
      `Quotation Data JSON: ${JSON.stringify(quotationData)}`,
      formData.legalAgreements?.length ? `Legal Agreements JSON: ${JSON.stringify(formData.legalAgreements)}` : '',
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
      ...quotationData,
      milestoneTemplate: formData.milestoneTemplate || '',
      quotationLink: formData.quotationLink.trim(),
      comments: formData.comments.trim(),
      reminders: formData.reminders || [],
      postedComments: formData.postedComments || [],
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

  const generatedWhatsAppPitch = useMemo(() => {
    return buildWhatsAppProposalPitch({
      leadName: lead?.contactPerson || lead?.name,
      companyName: lead?.companyName,
      proposalTitle,
      serviceSummary,
      totalAmount: quotationTotals.totalAmount,
      currency,
      validityDate: formData.validUntil
    });
  }, [lead, proposalTitle, serviceSummary, quotationTotals.totalAmount, currency, formData.validUntil]);

  return (
    <Card className="p-0 border-slate-200">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{initialValue?.id ? 'Edit quotation' : 'Add quotation'}</h2>
          <p className="text-sm text-slate-500">Fast proposal builder with 1-click packages, deliverables breakdown & WhatsApp dispatch</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="lead-quotation-form" disabled={busy}>{busy ? 'Saving...' : 'Save quotation'}</Button>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* 1-Click Package Presets & Smart Auto-Fill Bar */}
        <div className="rounded-xl border border-blue-200/80 dark:border-blue-900/40 bg-gradient-to-r from-blue-50/70 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 p-3.5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500 fill-amber-500" />
              1-Click Agency Package Presets
            </span>
            {lead && (
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={handleAutoFillFromLead}
                className="bg-white dark:bg-slate-900 border-blue-300 hover:bg-blue-50 text-blue-700 dark:text-blue-300 text-xs font-semibold cursor-pointer shadow-xs"
              >
                <Zap size={13} className="mr-1 text-amber-500 fill-amber-500" />
                Auto-Fill from Lead Requirements
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {QUOTATION_PACKAGE_PRESETS.map((pkg) => (
              <button
                key={pkg.id}
                type="button"
                onClick={() => applyPackagePreset(pkg)}
                className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/50 text-xs font-medium text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-xs"
              >
                <span>{pkg.name}</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">₹{(pkg.amount / 1000).toFixed(0)}k</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <form id="lead-quotation-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-slate-600">Quotation title</span>
                <Input className="h-10 px-3 py-2" value={formData.title} onChange={(event) => setField('title', event.target.value)} placeholder="Website development quotation" autoFocus />
              </label>

              <label className="md:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-slate-600">Services Included</span>
                <SearchableSelect
                  value={selectedServices}
                  onChange={(value) => {
                    const nextServices = Array.isArray(value) ? value : [];
                    applyServiceTemplates(nextServices, false);
                  }}
                  options={serviceSelectOptions}
                  placeholder="Select service"
                  searchPlaceholder="Search service..."
                  multiple
                  triggerClassName="min-h-10 py-2"
                />
              </label>

              {(leadBudget > 0 || suggestedAddons.length > 0) ? (
                <div className="md:col-span-2 grid gap-3 lg:grid-cols-2">
                  {leadBudget > 0 ? (
                    <div className={cn(
                      'rounded-xl border p-3.5',
                      budgetDifference != null && budgetDifference >= 0
                        ? 'border-emerald-200 bg-emerald-50/70'
                        : 'border-amber-200 bg-amber-50/70'
                    )}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Lead Budget Fit</div>
                          <div className="mt-1 text-sm font-semibold text-slate-900">Budget: {formatLeadAmount(leadBudget, currency)}</div>
                        </div>
                        <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', budgetDifference >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800')}>
                          {budgetDifference >= 0 ? `${formatLeadAmount(budgetDifference, currency)} available` : `${formatLeadAmount(Math.abs(budgetDifference), currency)} over budget`}
                        </span>
                      </div>
                    </div>
                  ) : null}
                  {suggestedAddons.length ? (
                    <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-3.5">
                      <div className="text-xs font-bold uppercase tracking-wider text-violet-700">Suggested Add-ons</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {suggestedAddons.map((addon) => (
                          <button
                            key={addon.id}
                            type="button"
                            onClick={() => applyServiceTemplates([...selectedServices, addon.name])}
                            className="rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-left text-xs font-semibold text-violet-800 hover:border-violet-400"
                          >
                            + {addon.name} · {formatLeadAmount(addon.defaultPrice, currency)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Itemized Deliverables & Scope Builder */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/30 p-3.5 md:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-blue-600" />
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Scope of Deliverables & Line Items</span>
                  </div>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={addDeliverableItem}
                    className="cursor-pointer text-xs"
                  >
                    <PlusCircle size={13} className="mr-1 text-blue-600" /> Add Line Item
                  </Button>
                </div>

                {formData.items?.length ? (
                  <div className="space-y-2">
                    {formData.items.map((item, idx) => (
                      <div key={item.id || idx} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2 shadow-xs">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{idx + 1}</span>
                          <Input
                            className="h-8 flex-1 text-sm font-medium"
                            placeholder="Deliverable Name (e.g. UI/UX Wireframing)"
                            value={item.name}
                            onChange={(e) => updateDeliverableItem(idx, 'name', e.target.value)}
                          />
                          <div className="w-20">
                            <Input
                              type="number"
                              min="1"
                              className="h-8 text-sm text-center"
                              placeholder="Qty"
                              value={item.qty}
                              onChange={(e) => updateDeliverableItem(idx, 'qty', e.target.value)}
                            />
                          </div>
                          <div className="w-28">
                            <Input
                              type="number"
                              min="0"
                              className="h-8 text-sm"
                              placeholder="Rate"
                              value={item.rate}
                              onChange={(e) => updateDeliverableItem(idx, 'rate', e.target.value)}
                            />
                          </div>
                          <div className="w-28 text-right font-semibold text-sm text-slate-800 dark:text-slate-200">
                            ₹{Number(item.amount || 0).toLocaleString('en-IN')}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeDeliverableItem(idx)}
                            className="text-slate-400 hover:text-red-500 p-1 cursor-pointer"
                          >
                            <X size={15} />
                          </button>
                        </div>
                        <Input
                          className="h-7 text-xs text-slate-500 bg-slate-50 dark:bg-slate-950/40"
                          placeholder="Scope & description (e.g. 5-8 custom page layouts with responsive design)..."
                          value={item.description}
                          onChange={(e) => updateDeliverableItem(idx, 'description', e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-4 text-center text-xs text-slate-400">
                    No itemized breakdown added. You can use single base amount or click "Add Line Item" / select a Package Preset above.
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5 md:col-span-2 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-slate-800">Complete Feature List</div>
                    <div className="text-xs text-slate-500">Loaded from Service Master. Add or remove features for this quotation.</div>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{formData.features?.length || 0} features</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <Input
                    value={featureDraft}
                    onChange={(event) => setFeatureDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addFeature();
                      }
                    }}
                    placeholder="Add an extra feature..."
                  />
                  <Button type="button" variant="outline" onClick={addFeature}><PlusCircle size={15} /> Add feature</Button>
                </div>
                {formData.features?.length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {formData.features.map((feature, index) => (
                      <div key={`${feature}-${index}`} className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                        <span className="flex-1">{feature}</span>
                        <button type="button" onClick={() => removeFeature(index)} className="text-slate-400 hover:text-rose-500"><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                ) : <div className="text-xs text-slate-400">No default features found. Add project-specific features above.</div>}
              </div>

              <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="mb-4">
                  <div className="text-sm font-bold text-slate-800">Quotation Template Sections</div>
                  <div className="text-xs text-slate-500">These sections are automatically loaded from the selected services and remain editable.</div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="md:col-span-2">
                    <span className="mb-1.5 block text-sm font-medium text-slate-600">Scope of Work</span>
                    <Textarea value={formData.scopeOfWork} onChange={(event) => setField('scopeOfWork', event.target.value)} rows={5} placeholder="Complete scope of work..." />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-sm font-medium text-slate-600">Technology Stack</span>
                    <Textarea value={formData.technologyStack} onChange={(event) => setField('technologyStack', event.target.value)} rows={4} placeholder="One technology per line" />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-sm font-medium text-slate-600">Timeline</span>
                    <Textarea value={formData.timeline} onChange={(event) => setField('timeline', event.target.value)} rows={4} placeholder="Delivery stages and timeline" />
                  </label>
                  <label className="md:col-span-2">
                    <span className="mb-1.5 block text-sm font-medium text-slate-600">Payment Information</span>
                    <Textarea value={formData.paymentInfo} onChange={(event) => setField('paymentInfo', event.target.value)} rows={4} placeholder="Payment milestones and bank/payment notes" />
                  </label>
                  <label className="md:col-span-2">
                    <span className="mb-1.5 block text-sm font-medium text-slate-600">We Provide After Project Completion</span>
                    <Textarea value={formData.afterCompletion} onChange={(event) => setField('afterCompletion', event.target.value)} rows={4} placeholder="Warranty, training, handover and support..." />
                  </label>
                  <label className="md:col-span-2">
                    <span className="mb-1.5 block text-sm font-medium text-slate-600">Custom Input (Rich Text)</span>
                    <RichTextEditor value={formData.customContent} onChange={(value) => setField('customContent', value)} />
                  </label>
                </div>
              </div>

              {/* 📋 Legal Agreements & Compliance Clauses (Positioned at the end of quotation) */}
              {(() => {
                const list = formData.legalAgreements || [];
                const filtered = list.map((item, originalIndex) => ({ item, originalIndex })).filter(({ item }) => {
                  if (legalCategoryFilter !== 'All' && item.category !== legalCategoryFilter) return false;
                  if (legalSearch.trim()) {
                    const q = legalSearch.toLowerCase().trim();
                    const matchName = String(item.name || '').toLowerCase().includes(q);
                    const matchCat = String(item.category || '').toLowerCase().includes(q);
                    const matchContent = String(item.content || '').toLowerCase().includes(q);
                    if (!matchName && !matchCat && !matchContent) return false;
                  }
                  return true;
                });
                const enabledCount = list.filter((a) => a.enabled).length;

                return (
                  <div className="md:col-span-2 rounded-xl border border-blue-200 bg-blue-50/20 p-4 space-y-4">
                    {/* Top Header */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                          <Scale size={17} className="text-blue-600" />
                          Legal Agreements & Compliance Clauses
                          <span className="text-[11px] font-normal text-slate-500">(Rendered at End of Quotation)</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Select which IT company agreements to attach to this quotation. Toggle ON or OFF for each agreement.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn(
                          "text-xs font-semibold px-2.5 py-1 rounded-full border",
                          enabledCount > 0
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        )}>
                          {enabledCount} of {list.length} Included
                        </span>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs border-slate-300 text-slate-700 hover:bg-slate-100"
                          onClick={() => toggleAllAgreements(true)}
                          title="Enable all agreements in proposal"
                        >
                          Include All
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs border-slate-300 text-slate-700 hover:bg-slate-100"
                          onClick={() => toggleAllAgreements(false)}
                          title="Exclude all agreements from proposal"
                        >
                          Exclude All
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-100/60"
                          onClick={resetAllAgreementsFromMaster}
                          title="Reset all agreements to Legal Master defaults"
                        >
                          <RotateCcw size={12} /> Reset Defaults
                        </Button>
                      </div>
                    </div>

                    {/* Filter and Search Bar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1 border-t border-blue-100/80">
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                        {LEGAL_CATEGORIES.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setLegalCategoryFilter(cat)}
                            className={cn(
                              "px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer",
                              legalCategoryFilter === cat
                                ? "bg-blue-600 text-white shadow-2xs"
                                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                            )}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>

                      <div className="relative min-w-[200px] sm:w-56 shrink-0">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={legalSearch}
                          onChange={(e) => setLegalSearch(e.target.value)}
                          placeholder="Search agreements (NDA, SOW, SLA)..."
                          className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-7 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                        />
                        {legalSearch && (
                          <button
                            type="button"
                            onClick={() => setLegalSearch('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Agreements Cards Grid / List */}
                    {list.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center bg-white">
                        <Scale size={24} className="mx-auto text-slate-400 mb-2" />
                        <p className="text-xs text-slate-600 font-medium">No legal templates loaded yet.</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-3 text-xs"
                          onClick={resetAllAgreementsFromMaster}
                        >
                          Initialize 13 IT Agreements from Legal Master
                        </Button>
                      </div>
                    ) : filtered.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center bg-white text-xs text-slate-500">
                        No agreements match filter &quot;{legalSearch || legalCategoryFilter}&quot;.
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                        {filtered.map(({ item: agreement, originalIndex }) => {
                          const keyId = agreement.id || agreement.name || originalIndex;
                          const isExpanded = Boolean(expandedAgreements[keyId]);

                          return (
                            <div
                              key={keyId}
                              className={cn(
                                "rounded-xl border transition-all duration-200",
                                agreement.enabled
                                  ? "border-blue-200 bg-white shadow-xs"
                                  : "border-slate-200/80 bg-slate-50/70 opacity-75 hover:opacity-100"
                              )}
                            >
                              <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  {/* Interactive Toggle Button */}
                                  <button
                                    type="button"
                                    onClick={() => toggleAgreement(originalIndex)}
                                    role="switch"
                                    aria-checked={agreement.enabled}
                                    className={cn(
                                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                                      agreement.enabled ? "bg-emerald-600" : "bg-slate-300"
                                    )}
                                    title={agreement.enabled ? "Toggle OFF to exclude from proposal" : "Toggle ON to include in proposal"}
                                  >
                                    <span
                                      className={cn(
                                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                        agreement.enabled ? "translate-x-5" : "translate-x-0"
                                      )}
                                    />
                                  </button>

                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={cn(
                                        "text-xs truncate",
                                        agreement.enabled ? "text-slate-900 font-bold" : "text-slate-600 font-medium"
                                      )}>
                                        {agreement.name}
                                      </span>

                                      {agreement.category && (
                                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                                          {agreement.category}
                                        </span>
                                      )}

                                      {agreement.enabled ? (
                                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                          <CheckCircle2 size={11} /> Included in Proposal
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                                          Excluded
                                        </span>
                                      )}
                                    </div>

                                    {!isExpanded && (
                                      <p className="text-[11px] text-slate-400 truncate mt-0.5 max-w-xl">
                                        {agreement.content?.replace(/\n/g, ' ') || 'No clauses configured'}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedAgreements((prev) => ({ ...prev, [keyId]: !prev[keyId] }))}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                  >
                                    {isExpanded ? (
                                      <>
                                        <span>Collapse</span>
                                        <ChevronUp size={13} />
                                      </>
                                    ) : (
                                      <>
                                        <span>Edit Clauses</span>
                                        <ChevronDown size={13} />
                                      </>
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => resetAgreementToTemplate(originalIndex)}
                                    className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-md transition cursor-pointer"
                                    title="Reset clauses to template default"
                                  >
                                    <RotateCcw size={13} />
                                  </button>
                                </div>
                              </div>

                              {/* Expanded Clauses Editor */}
                              {isExpanded && (
                                <div className="border-t border-slate-100 bg-slate-50/50 p-3.5 space-y-2 rounded-b-xl">
                                  <div className="flex items-center justify-between text-xs text-slate-500">
                                    <span>Proposal clauses (customizable for this client):</span>
                                    <span className="text-[11px] text-slate-400 font-mono">
                                      {(agreement.content || '').length} characters
                                    </span>
                                  </div>
                                  <Textarea
                                    value={agreement.content || ''}
                                    onChange={(e) => updateAgreementContent(originalIndex, e.target.value)}
                                    rows={5}
                                    placeholder="Agreement clauses..."
                                    className="font-mono text-xs leading-relaxed bg-white"
                                  />
                                  <p className="text-[11px] text-slate-400 italic">
                                    * Changes made here are saved with this quotation and do not alter the Legal Master templates.
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="md:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-4">
                <div>
                  <div className="text-sm font-bold text-slate-800">AMC / Maintenance Plan</div>
                  <div className="text-xs text-slate-500">Select a reusable AMC plan; inclusions and exclusions come from AMC Master.</div>
                </div>
                <SearchableSelect
                  value={formData.amcPlan?.id || ''}
                  onChange={applyAmcPlan}
                  options={amcPlans.map((plan) => ({
                    value: plan.id,
                    label: plan.name,
                    description: `${formatLeadAmount(plan.defaultCost, currency)} · ${plan.defaultBillingCycle || 'Yearly'} · ${plan.responseSlaHours || '-'}h SLA`
                  }))}
                  placeholder="No AMC plan selected"
                />
                {formData.amcPlan ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <label>
                      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-emerald-800">Included</span>
                      <Textarea value={formData.amcPlan.includedItems || ''} onChange={(event) => setField('amcPlan', { ...formData.amcPlan, includedItems: event.target.value })} rows={6} />
                    </label>
                    <label>
                      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-rose-700">Not Included</span>
                      <Textarea value={formData.amcPlan.excludedItems || ''} onChange={(event) => setField('amcPlan', { ...formData.amcPlan, excludedItems: event.target.value })} rows={6} />
                    </label>
                  </div>
                ) : null}
                <label>
                  <span className="mb-1.5 block text-sm font-medium text-slate-600">Cost Summary for Next Year</span>
                  <Textarea value={formData.nextYearCostSummary} onChange={(event) => setField('nextYearCostSummary', event.target.value)} rows={4} placeholder="Renewals, hosting, AMC and license costs for year two..." />
                </label>
              </div>

              <label>
                <span className="mb-1.5 block text-sm font-medium text-slate-600">Proposal date</span>
                <Input className="h-10 px-3 py-2" type="date" value={formData.proposalDate} onChange={(event) => setField('proposalDate', event.target.value)} />
              </label>

              <label>
                <span className="mb-1.5 block text-sm font-medium text-slate-600">Valid until</span>
                <Input className="h-10 px-3 py-2" type="date" value={formData.validUntil} onChange={(event) => setField('validUntil', event.target.value)} />
              </label>

              <label>
                <span className="mb-1.5 block text-sm font-medium text-slate-600">Base amount ({currency || 'INR'}) {formData.items?.length ? '· calculated from line items' : ''}</span>
                <Input className="h-10 px-3 py-2 font-mono font-semibold" type="number" min="0" step="0.01" value={formData.amount} onChange={(event) => setField('amount', event.target.value)} readOnly={Boolean(formData.items?.length)} placeholder="0.00" />
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

              {/* Discount Section */}
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

              {/* GST Section */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 md:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.gstApplicable)}
                      onChange={(event) => setField('gstApplicable', event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                    Apply GST (Tax Invoice)
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

              {/* Payment Schedule / Milestones */}
              <div className="md:col-span-2 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-600">Payment Milestones Preset</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {MILESTONE_PRESETS.map((tmpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setField('comments', `${formData.comments ? `${formData.comments}\n\n` : ''}Payment Milestones:\n${tmpl}`)}
                      className="text-[11px] px-2.5 py-1 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 font-medium transition cursor-pointer"
                    >
                      + {tmpl.split(',')[0]}...
                    </button>
                  ))}
                </div>
              </div>

              <label className="md:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="block text-sm font-medium text-slate-600">Quotation link (Preview / Client URL)</span>
                  <button
                    type="button"
                    onClick={() => {
                      const pKey = lead?.leadNumber || lead?.id || `draft_${Date.now()}`;
                      const fullUrl = `${window.location.origin}${window.location.pathname}#/quotations/preview?key=${encodeURIComponent(pKey)}`;
                      setField('quotationLink', fullUrl);
                      try {
                        const refNum = lead?.leadNumber ? `WBT-${lead.leadNumber}` : `WBT-PROP-${new Date().getFullYear()}-001`;
                        const pPayload = {
                          formData,
                          lead,
                          settings,
                          proposalTitle,
                          serviceSummary,
                          currency,
                          quotationTotals,
                          refNumber: refNum,
                          savedAt: new Date().toISOString()
                        };
                        localStorage.setItem(`crm_quotation_preview_${pKey}`, JSON.stringify(pPayload));
                        localStorage.setItem('crm_quotation_preview_latest', JSON.stringify(pPayload));
                      } catch {}
                      navigator.clipboard?.writeText(fullUrl);
                      toast.success('Live preview link generated & copied to clipboard!');
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <ExternalLink size={12} /> Auto-generate CRM Preview Link
                  </button>
                </div>
                <Input className="h-10 px-3 py-2 font-mono text-xs" value={formData.quotationLink} onChange={(event) => setField('quotationLink', event.target.value)} placeholder="https://..." />
              </label>

              <label className="md:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-slate-600">Scope, Terms & Internal comments</span>
                <Textarea className="min-h-[90px] px-3 py-2" value={formData.comments} onChange={(event) => setField('comments', event.target.value)} rows={3} placeholder="Payment schedule, terms of delivery, deliverables scope..." />
              </label>
            </div>
          </form>

          {/* Right Summary & Actions Panel */}
          <aside className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div className="flex items-center gap-2 font-semibold text-slate-900"><Anchor size={16} /> Proposal Summary</div>
                <MoreHorizontal size={18} className="text-slate-400" />
              </div>
              <div className="divide-y divide-slate-100 px-4 text-sm">
                <div className="flex items-start gap-2 py-3 text-blue-700"><Layers size={16} className="mt-0.5 shrink-0" /><span className="min-w-0 truncate font-medium">{proposalTitle}</span></div>
                <div className="flex justify-between gap-3 py-2.5"><span className="text-slate-500 font-medium">Proposal date:</span><span>{formData.proposalDate || '-'}</span></div>
                <div className="flex justify-between gap-3 py-2.5"><span className="text-slate-500 font-medium">Valid until:</span><span>{formData.validUntil || '-'}</span></div>
                <div className="space-y-2 py-3">
                  <div className="flex justify-between gap-3 text-slate-600"><span>Base amount</span><span>{formatLeadAmount(quotationTotals.subtotal, currency)}</span></div>
                  {formData.discountEnabled ? <div className="flex justify-between gap-3 text-emerald-700"><span>Discount</span><span>-{formatLeadAmount(quotationTotals.discountAmount, currency)}</span></div> : null}
                  {formData.gstApplicable ? <div className="flex justify-between gap-3 text-slate-600"><span>GST ({formData.gstRate || 0}%)</span><span>{formatLeadAmount(quotationTotals.gstAmount, currency)}</span></div> : null}
                  <div className="flex justify-between gap-3 border-t border-slate-100 pt-2 text-base font-bold text-slate-900"><span>Total Investment</span><span>{formatLeadAmount(quotationTotals.totalAmount, currency)}</span></div>
                </div>
              </div>
            </div>

            {/* Outreach & Export Actions */}
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <div className="p-2 border-b border-slate-100">
                <Button
                  type="button"
                  onClick={() => setWhatsAppOpen(true)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MessageCircle size={16} /> Share Proposal on WhatsApp
                </Button>
              </div>
              <div className="grid grid-cols-2 text-sm text-blue-700">
                <button type="button" onClick={() => openPreview()} className="flex items-center gap-2 border-b border-r border-slate-100 px-4 py-3 hover:bg-slate-50 cursor-pointer"><Eye size={16} /> Preview</button>
                <button type="button" onClick={() => openPreview({ print: true })} className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 hover:bg-slate-50 cursor-pointer"><Printer size={16} /> Print</button>
                <button type="button" onClick={() => generatePdf(false)} disabled={pdfBusy} className="flex items-center gap-2 border-r border-slate-100 px-4 py-3 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"><FileText size={16} /> View PDF</button>
                <button type="button" onClick={() => generatePdf(true)} disabled={pdfBusy} className="flex items-center gap-2 px-4 py-3 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"><Download size={16} /> Download PDF</button>
              </div>
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
                    <button type="button" onClick={() => removeReminder(index)} className="text-slate-400 hover:text-red-500 cursor-pointer"><X size={14} /></button>
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
                  <Button type="button" onClick={addComment} className="cursor-pointer"><Send size={16} /> Post</Button>
                </div>
                {(formData.postedComments || []).map((comment, index) => (
                  <div key={`${comment.createdAt}-${index}`} className="border-t border-slate-100 pt-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{comment.author || 'User'}</span>
                      <button type="button" onClick={() => removeComment(index)} className="text-slate-400 hover:text-red-500 cursor-pointer"><X size={14} /></button>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">{comment.createdAt ? new Date(comment.createdAt).toLocaleString() : ''}</div>
                    <div className="mt-1 whitespace-pre-wrap text-slate-700">{comment.message}</div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <WhatsAppModal
        open={whatsAppOpen}
        onClose={() => setWhatsAppOpen(false)}
        lead={lead}
        initialTemplate="proposal"
        initialMessage={generatedWhatsAppPitch}
        clientPhone={lead?.mobile || lead?.phone || ''}
      />
    </Card>
  );
}

export function LeadQuotationPage({ mode = '' }) {
  const { id, quotationId } = useParams();
  const [searchParams] = useSearchParams();
  const fromRevisionId = searchParams.get('fromRevision');
  const navigate = useNavigate();
  const { token, user, hasPermission } = useAuth();
  const [data, setData] = useState(null);
  const [quotationOptions, setQuotationOptions] = useState({ serviceCatalog: [], amcPlans: [] });
  const [settings, setSettings] = useState(null);
  const [quotationMaster, setQuotationMaster] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const loadRequestRef = useRef(0);
  const isCreateMode = mode === 'create' || !quotationId || String(quotationId).toLowerCase() === 'new';
  const effectiveQuotationId = isCreateMode ? '' : quotationId;

  async function load() {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    try {
      const [response, optionsResponse, settingsResponse, quotationMasterResponse] = await Promise.all([
        api.resources.get('/leads', `${id}/summary`, token),
        api.resources.list('/leads/options', token),
        api.settings.get(token).catch(() => null),
        api.resources.list('/masters/quotation_master', token).catch(() => null)
      ]);
      if (requestId !== loadRequestRef.current) return;
      setData(response.data || null);
      setQuotationOptions(optionsResponse.data || { serviceCatalog: [], amcPlans: [], legalTerms: [], defaultTermsAndConditions: '' });
      setSettings(settingsResponse?.data || null);
      setQuotationMaster(quotationMasterResponse?.data?.[0] || null);
    } catch (error) {
      if (requestId !== loadRequestRef.current) return;
      toast.error(error.message || 'Failed to load lead');
      navigate('/app/leads');
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    load();
    return () => {
      loadRequestRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, effectiveQuotationId, token]);

  const lead = data?.lead || null;
  const events = data?.events || [];
  const serviceNames = useMemo(() => getLeadServiceNames(lead), [lead]);
  const serviceCatalog = quotationOptions.serviceCatalog || [];
  const amcPlans = quotationOptions.amcPlans || [];
  const legalTerms = quotationOptions.legalTerms || [];
  const defaultTermsAndConditions = quotationOptions.defaultTermsAndConditions || '';
  
  const quotationEvent = useMemo(() => {
    if (!effectiveQuotationId) return null;
    return events.find((event) => matchesRouteIdentifier(effectiveQuotationId, event)) || null;
  }, [events, effectiveQuotationId]);

  const revisionSourceEvent = useMemo(() => {
    if (!fromRevisionId) return null;
    const source = events.find((event) => matchesRouteIdentifier(fromRevisionId, event));
    if (!source) return null;
    const prevTitle = source.title || 'Quotation';
    const cleanTitle = prevTitle.replace(/\s*\(Rev\s*\d+\)$/i, '');
    const revCount = (events.filter((e) => e.eventType === 'quotation').length || 1) + 1;
    return {
      ...source,
      id: undefined,
      title: `${cleanTitle} (Rev ${revCount})`
    };
  }, [events, fromRevisionId]);

  const latestQuotation = useMemo(() => getLatestQuotationEvent(events), [events]);
  const defaultAmount = getQuotationAmount(lead, latestQuotation) ?? lead?.estimatedBudget ?? lead?.value ?? '';
  const canWriteLead = hasPermission('leads.write') || hasPermission('leads.manage');

  useEffect(() => {
    if (!loading && !isCreateMode && effectiveQuotationId && data && !quotationEvent) {
      toast.error('Quotation not found', { id: 'quotation-not-found' });
      navigate(leadRoute(lead || id));
    }
  }, [loading, isCreateMode, effectiveQuotationId, data, quotationEvent, navigate, id, lead]);

  useEffect(() => {
    if (isCreateMode) toast.dismiss('quotation-not-found');
  }, [isCreateMode]);

  useEffect(() => {
    if (loading || !lead?.id) return;
    const base = leadRoute(lead);
    const next = !isCreateMode && quotationEvent
      ? `${base}/quotations/${eventRouteSegment(quotationEvent)}`
      : `${base}/quotations/new${window.location.hash.includes('?') ? window.location.hash.slice(window.location.hash.indexOf('?')) : ''}`;
    const current = window.location.hash.replace(/^#/, '');
    if (current !== next) navigate(next, { replace: true });
  }, [loading, lead, quotationEvent, isCreateMode, navigate]);

  const currentSavedEventIdRef = useRef(quotationEvent?.id || null);

  useEffect(() => {
    if (quotationEvent?.id) {
      currentSavedEventIdRef.current = quotationEvent.id;
    }
  }, [quotationEvent?.id]);

  async function autoSaveQuotation(payload) {
    if (!canWriteLead || !lead?.id) return;
    try {
      const targetId = currentSavedEventIdRef.current || quotationEvent?.id;
      if (targetId) {
        await api.resources.update('/lead-events', targetId, {
          ...payload,
          status: payload.status || 'Draft',
          eventType: 'quotation',
          scopeType: 'lead',
          scopeId: lead.id,
          leadId: lead.id,
          clientId: '',
          projectId: '',
          visibility: payload.visibility || 'all_team'
        }, token);
      }
    } catch (err) {
      console.warn('Background auto-save failed:', err);
    }
  }

  async function saveQuotation(payload) {
    if (!canWriteLead) {
      toast.error('You do not have permission to save quotation');
      return;
    }
    setBusy(true);
    try {
      let response;
      const targetId = currentSavedEventIdRef.current || quotationEvent?.id;
      if (targetId) {
        response = await api.resources.update('/lead-events', targetId, {
          ...payload,
          eventType: 'quotation',
          scopeType: 'lead',
          scopeId: lead.id,
          leadId: lead.id,
          clientId: '',
          projectId: '',
          visibility: payload.visibility || 'all_team'
        }, token);
      } else {
        response = await api.resources.create('/lead-events', {
          ...payload,
          eventType: 'quotation',
          scopeType: 'lead',
          scopeId: lead.id,
          leadId: lead.id,
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
      navigate(leadRoute(lead));
    } catch (error) {
      toast.error(error.message || 'Failed to save quotation');
    } finally {
      setBusy(false);
    }
  }

  if (loading || !lead || (!isCreateMode && !quotationEvent)) return <PageLoader />;

  return (
    <QuotationBuilderModal
      isModal={false}
      onClose={() => navigate(leadRoute(lead))}
      onSave={saveQuotation}
      onAutoSave={autoSaveQuotation}
      leadId={id}
      lead={lead}
      settings={settings}
      quotationMaster={quotationMaster}
      initialValue={quotationEvent || revisionSourceEvent}
      busy={busy}
      serviceOptions={serviceNames}
      serviceCatalog={serviceCatalog}
      amcPlans={amcPlans}
      legalTerms={legalTerms}
      defaultTermsAndConditions={defaultTermsAndConditions}
      currency={lead.currency || 'INR'}
      defaultAmount={defaultAmount}
      defaultGstApplicable={toBooleanValue(lead.gstInvoiceRequired, false)}
      defaultGstRate={18}
    />
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
  const callData = extractCallData(item);
  const isCall = Boolean(callData?.isCall);
  const callOutcomeBadge = callData?.outcome ? getCallOutcomeBadge(callData.outcome) : null;

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
          {isCall && callData?.outcome && callOutcomeBadge ? (
            <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border', callOutcomeBadge.bg, callOutcomeBadge.border, callOutcomeBadge.text)}>
              {callData.outcome}
            </span>
          ) : null}
          {isCall && callData?.duration ? (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold border border-[var(--border-muted)] bg-[var(--surface-2)] text-[var(--text-muted)]">
              ⏱️ {formatCallDuration(callData.duration)}
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
        ) : isCall ? (
          <div className="rounded-xl border border-[var(--border-muted)] bg-[var(--surface-2)]/60 p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[11px] font-medium text-[var(--text-muted)] block">📞 Call Type:</span>
                <span className="font-semibold text-[var(--text-main)] mt-0.5 block">{callData.type || 'Outgoing'}</span>
              </div>
              <div>
                <span className="text-[11px] font-medium text-[var(--text-muted)] block">📱 Caller Number:</span>
                <span className="font-semibold text-[var(--text-main)] mt-0.5 block">{formatPhoneDisplay(callData.callerNumber)}</span>
              </div>
              <div>
                <span className="text-[11px] font-medium text-[var(--text-muted)] block">🎯 Outcome:</span>
                <span className="font-semibold text-[var(--text-main)] mt-0.5 block">{callData.outcome || 'Logged'}</span>
              </div>
              <div>
                <span className="text-[11px] font-medium text-[var(--text-muted)] block">⏱️ Duration:</span>
                <span className="font-semibold text-[var(--text-main)] mt-0.5 block">{formatCallDuration(callData.duration) || 'Not recorded'}</span>
              </div>
              <div>
                <span className="text-[11px] font-medium text-[var(--text-muted)] block">📅 Date & Time:</span>
                <span className="font-semibold text-[var(--text-main)] mt-0.5 block">{timeInfo.formatted}</span>
              </div>
              {item.actorName && (
                <div>
                  <span className="text-[11px] font-medium text-[var(--text-muted)] block">👤 Logged by:</span>
                  <span className="font-semibold text-[var(--text-main)] mt-0.5 block">{item.actorName}</span>
                </div>
              )}
            </div>

            {/* Audio Recording Player */}
            {callData.recordingUrl ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-2 mt-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                      <Volume2 size={13} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                        Call Audio Recording
                      </h4>
                      {callData.duration ? (
                        <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80">
                          Duration: {formatCallDuration(callData.duration)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <a
                    href={callData.recordingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer"
                  >
                    Open audio <ExternalLink size={12} />
                  </a>
                </div>
                <audio
                  controls
                  preload="metadata"
                  src={callData.recordingUrl}
                  className="w-full h-8 rounded-lg accent-emerald-600"
                />
              </div>
            ) : null}
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
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [whatsAppTemplatesOpen, setWhatsAppTemplatesOpen] = useState(false);
  const [duplicateLeads, setDuplicateLeads] = useState([]);
  const [mergeTargetLead, setMergeTargetLead] = useState(null);
  const [expandedCallAI, setExpandedCallAI] = useState({});
  const loadRequestRef = useRef(0);

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
  const urlTab = searchParams.get('tab');
  const [activeTab, setActiveTabState] = useState(() => urlTab || 'overview');

  const setActiveTab = (tabKey) => {
    setActiveTabState(tabKey);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tabKey === 'overview') {
        next.delete('tab');
      } else {
        next.set('tab', tabKey);
      }
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    if (urlTab && urlTab !== activeTab) {
      setActiveTabState(urlTab);
    }
  }, [urlTab]);
  const [openDetailSections, setOpenDetailSections] = useState({});
  const [tabPages, setTabPages] = useState({
    timeline: 1,
    calls: 1,
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
    const requestId = ++loadRequestRef.current;
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
      if (requestId !== loadRequestRef.current) return;

      if (summaryRes.status === 'fulfilled') {
        setData(summaryRes.value.data);
        const l = summaryRes.value.data?.lead;
        if (l && (l.phone || l.email)) {
          api.resources.list('/leads/duplicates', token, '', { phone: l.phone, email: l.email, excludeId: l.id })
            .then((res) => setDuplicateLeads(res?.data || []))
            .catch(() => setDuplicateLeads([]));
        } else {
          setDuplicateLeads([]);
        }
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
      if (requestId !== loadRequestRef.current) return;
      toast.error(error.message || 'Failed to load lead details');
      navigate('/app/leads');
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    load();
    return () => {
      loadRequestRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  useEffect(() => {
    setOpenDetailSections({});
    setTabPages({
      timeline: 1,
      calls: 1,
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
    return (events || [])
      .filter(isQuotationEvent)
      .sort((a, b) => getQuotationDate(b).localeCompare(getQuotationDate(a)))
      .map((event) => ({ event, ...getQuotationDetails(event, lead) }));
  }, [events, lead]);

  const leadCalls = useMemo(() => {
    const list = [];
    const seenIds = new Set();

    (events || []).forEach((evt) => {
      const callData = extractCallData(evt);
      if (callData?.isCall) {
        const idKey = evt.id || `${evt.title}-${evt.startDate || evt.date}`;
        if (!seenIds.has(idKey)) {
          seenIds.add(idKey);
          list.push({
            id: evt.id,
            rawEvent: evt,
            title: evt.title || `${callData.type || 'Outgoing'} call`,
            description: evt.description || evt.detail || '',
            date: evt.startDate || evt.date || evt.createdAt,
            time: evt.startTime || evt.time || '',
            createdAt: evt.createdAt,
            actorName: evt.actorName || evt.payload?.actorName || userLookup?.get(String(evt.ownerUserId)) || 'System',
            payload: evt.payload || evt.meta || {},
            meta: evt.meta || evt.payload || {},
            ...callData,
            attachments: evt.attachments || []
          });
        }
      }
    });

    (timeline || []).forEach((item) => {
      const callData = extractCallData(item);
      if (callData?.isCall) {
        const idKey = item.id || `${item.title}-${item.date}`;
        if (!seenIds.has(idKey)) {
          seenIds.add(idKey);
          list.push({
            id: item.id,
            rawEvent: item,
            title: item.title || `${callData.type || 'Outgoing'} call`,
            description: item.detail || item.description || '',
            date: item.date || item.createdAt,
            time: item.time || '',
            createdAt: item.createdAt || item.date,
            actorName: item.actorName || item.meta?.actorName || 'System',
            payload: item.payload || item.meta || {},
            meta: item.meta || item.payload || {},
            ...callData,
            attachments: item.attachments || []
          });
        }
      }
    });

    return list.sort((a, b) => {
      const aDate = new Date(a.date || a.createdAt || 0).getTime();
      const bDate = new Date(b.date || b.createdAt || 0).getTime();
      if (!isNaN(aDate) && !isNaN(bDate) && aDate !== bDate) {
        return bDate - aDate;
      }
      return String(b.date || '').localeCompare(String(a.date || ''));
    });
  }, [events, timeline, userLookup]);

  const callStats = useMemo(() => {
    let totalSec = 0;
    let connected = 0;
    let missedOrBusy = 0;
    let recordings = 0;

    leadCalls.forEach((call) => {
      if (call.duration) totalSec += Number(call.duration);
      const oc = String(call.outcome || '').toLowerCase();
      if (oc.includes('connected') || oc.includes('interested') || oc.includes('discussion') || oc.includes('done')) {
        connected += 1;
      } else if (oc.includes('busy') || oc.includes('no answer') || oc.includes('switched off') || oc.includes('unreachable') || oc.includes('missed') || oc.includes('wrong')) {
        missedOrBusy += 1;
      }
      if (call.recordingUrl) {
        recordings += 1;
      }
    });

    const mins = Math.floor(totalSec / 60);
    const remSec = totalSec % 60;
    const talkTimeFormatted = mins > 0 ? `${mins}m ${remSec}s` : `${remSec}s`;

    return {
      total: leadCalls.length,
      connected,
      missedOrBusy,
      recordings,
      totalTalkTime: talkTimeFormatted
    };
  }, [leadCalls]);

  const [callFilter, setCallFilter] = useState('all');

  const filteredCalls = useMemo(() => {
    if (callFilter === 'all') return leadCalls;
    if (callFilter === 'connected') {
      return leadCalls.filter((c) => {
        const oc = String(c.outcome || '').toLowerCase();
        return oc.includes('connected') || oc.includes('interested') || oc.includes('discussion') || oc.includes('done');
      });
    }
    if (callFilter === 'missed') {
      return leadCalls.filter((c) => {
        const oc = String(c.outcome || '').toLowerCase();
        return oc.includes('busy') || oc.includes('no answer') || oc.includes('switched off') || oc.includes('unreachable') || oc.includes('missed') || oc.includes('wrong');
      });
    }
    if (callFilter === 'recordings') {
      return leadCalls.filter((c) => Boolean(c.recordingUrl));
    }
    return leadCalls;
  }, [leadCalls, callFilter]);

  useEffect(() => {
    if (!lead?.id) return;
    const next = canonicalRoute('leads', lead, `/app/leads/${id}`);
    if (next) navigate(next, { replace: true });
  }, [id, lead, navigate]);

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

  const dealAgeDays = useMemo(() => {
    if (!lead?.createdAt) return 0;
    const created = new Date(lead.createdAt);
    const now = new Date();
    return Math.max(0, Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
  }, [lead?.createdAt]);

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
      navigate(leadRoute(lead || id, 'quotations/new'));
    }
  }

  function openEditActivity(event) {
    if (!event) return;
    const nextType = String(event.eventType || event.type || 'task').toLowerCase();
    if (nextType === 'quotation') {
      navigate(leadRoute(lead || id, `quotations/${eventRouteSegment(event)}`));
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
        relatedEntityId: lead?.id || id,
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
    { key: 'ai-insight', label: 'AI Insight', icon: Sparkles },
    { key: 'details', label: 'Lead Details', icon: FileText },
    { key: 'tasks', label: `Tasks (${activityBuckets.task.length || 0})`, icon: CheckCircle2 },
    { key: 'notes', label: `Notes (${activityBuckets.note.length || 0})`, icon: Tag },
    { key: 'reminders', label: `Reminders (${activityBuckets.reminder.length || 0})`, icon: Clock3 },
    { key: 'quotations', label: `Quotations (${quotationRows.length || 0})`, icon: PlusCircle },
    { key: 'timeline', label: `Timeline (${timeline.length || 0})`, icon: Clock3 },
    { key: 'calls', label: `Call History (${leadCalls.length || 0})`, icon: PhoneCall },
    { key: 'contacts', label: `Contacts (${contacts.length || 0})`, icon: Users },
    { key: 'events', label: `Events (${events.filter((e) => String(e.eventType || e.type || '').toLowerCase() === 'event').length || 0})`, icon: CalendarDays },
    { key: 'files', label: `Files (${files.length || 0})`, icon: Paperclip }
  ], [activityBuckets, quotationRows.length, timeline.length, leadCalls.length, contacts.length, events, files.length]);

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
        navigate(clientRoute(response.client || response.clientId));
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
      {duplicateLeads.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 dark:border-amber-700/80 bg-amber-50/90 dark:bg-amber-950/40 p-4 text-xs text-amber-900 dark:text-amber-200 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300">
              <GitMerge size={16} />
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100">
                Potential Duplicate Lead Detected ({duplicateLeads.length})
              </p>
              <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                Found matching record: <strong>{duplicateLeads[0].leadNumber || 'Duplicate'}</strong> ({duplicateLeads[0].name || duplicateLeads[0].contactPerson}) with matching phone/email.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setMergeTargetLead(duplicateLeads[0])}
            className="h-8 px-3.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shrink-0"
          >
            <GitMerge size={14} className="mr-1.5" /> Compare & Merge
          </Button>
        </div>
      ) : null}

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

                {/* ⏱️ Stage Velocity & SLA Aging Tracker */}
                <LeadStageVelocityBadge lead={lead} timeline={timeline} />

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
                className="h-9 px-3.5 text-xs font-semibold rounded-xl border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 shadow-xs transition cursor-pointer"
                onClick={() => setWhatsAppTemplatesOpen(true)}
              >
                <MessageSquare size={14} className="mr-1.5 text-emerald-600 dark:text-emerald-400" /> WhatsApp
              </Button>
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
            {canConvertLead && !lead.convertedClientId ? (
              <Button
                size="sm"
                className="h-9 px-4 text-xs font-semibold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xs border border-transparent transition cursor-pointer"
                onClick={() => setConvertOpen(true)}
              >
                <Wand2 size={15} className="mr-1.5" /> Convert to Client
              </Button>
            ) : null}
            {lead.convertedClientId ? (
              <Button
                size="sm"
                className="h-9 px-4 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
                onClick={() => navigate(clientRoute(lead.convertedClient || lead.convertedClientId))}
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
              {/* Point 1: Overdue & Due Today Follow-up Alert Banner */}
              <LeadOverdueBanner
                lead={lead}
                reminders={activityBuckets.reminder}
                onCall={() => setCallOpen(true)}
                onWhatsApp={() => setWhatsAppOpen(true)}
                onReschedule={() => openActivity('reminder')}
                onComplete={(item) =>
                  setCompleteFollowUpTarget(
                    item || {
                      id: lead?.id,
                      title: 'Lead follow-up',
                      date: lead?.followUpDate,
                      startTime: lead?.nextFollowUpTime,
                      description: lead?.followUpNote || ''
                    }
                  )
                }
              />

              {/* Point 2: Visual Pipeline Stage Stepper */}
              <LeadStageStepper
                currentStatus={lead?.status}
                createdAt={lead?.createdAt}
                lastStatusChangedAt={lead?.lastStatusChangedAt}
                onChangeStatus={changeLeadStatus}
                disabled={savingMeta}
              />

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

                {/* Point 3: Expanded 6-Metric Responsive Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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

                  {/* Metric 5: Deal Age / Velocity */}
                  <div className="rounded-xl border border-cyan-500/15 bg-[var(--surface)]/80 p-3.5 shadow-2xs">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Pipeline Age</span>
                    <span className="mt-1.5 block text-sm font-bold text-[var(--text-main)] truncate" title={`${dealAgeDays} Days active`}>
                      {dealAgeDays} Day{dealAgeDays === 1 ? '' : 's'}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block truncate">
                      Since {formatDate(lead?.createdAt)}
                    </span>
                  </div>

                  {/* Metric 6: Proposal Readiness */}
                  <div className="rounded-xl border border-cyan-500/15 bg-[var(--surface)]/80 p-3.5 shadow-2xs">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Proposal</span>
                    {quotationAmount != null ? (
                      <span className="mt-1.5 block text-sm font-bold text-emerald-600 dark:text-emerald-400 truncate">
                        Quotation Sent
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openActivity('quotation')}
                        className="mt-1.5 text-xs font-bold text-[var(--primary)] hover:underline truncate block text-left cursor-pointer"
                      >
                        + Create Quote
                      </button>
                    )}
                    <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block truncate">
                      {quotationStatus || 'Not sent'}
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

              {/* Point 4: 4-Pillar BANT Qualification Tracker */}
              <LeadBantTracker
                lead={lead}
                primaryContact={primaryContact}
                onUpdateMeta={saveLeadMeta}
                canWrite={canWriteLead}
              />

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

                {/* ⚡ Smart Sales Cadence Stepper */}
                <FollowUpCadenceStepper
                  currentAttempt={lead.followUpAttempts || (activityBuckets.reminder.length > 0 ? 1 : 0)}
                  onStartCadence={() => openActivity('reminder')}
                />

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
              <Card className="p-5 border-[var(--border)] bg-[var(--surface)] shadow-sm space-y-3.5">
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

                {/* Point 6: Fast-Action Requirement Tagger */}
                <QuickServiceTagger
                  lead={lead}
                  onUpdateServices={(services) => saveLeadMeta({ requiredServices: services })}
                  canWrite={canWriteLead}
                />

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
                  {!lead.requirementDescription && !lead.notes && !lead.otherServiceDetails && (
                    <p className="text-xs text-[var(--text-muted)] italic py-1">
                      No text notes recorded yet. Use the tags above or click "+ Add Note" to log client requirements.
                    </p>
                  )}
                </div>
              </Card>

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
                        const callData = extractCallData(item);
                        const outcomeBadge = callData?.outcome ? getCallOutcomeBadge(callData.outcome) : null;

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
                            <div
                              onClick={() => setViewActivityTarget(item)}
                              className="rounded-xl border border-[var(--border-muted)] bg-[var(--surface-2)]/30 hover:bg-[var(--surface-2)]/70 px-3.5 py-2.5 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
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
                                  {callData?.outcome && outcomeBadge ? (
                                    <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-md border shrink-0', outcomeBadge.bg, outcomeBadge.border, outcomeBadge.text)}>
                                      {callData.outcome}
                                    </span>
                                  ) : null}
                                  {callData?.duration ? (
                                    <span className="text-[10px] font-semibold text-[var(--text-muted)] bg-[var(--surface)] border border-[var(--border-muted)] px-1.5 py-0.5 rounded-md shrink-0">
                                      ⏱️ {formatCallDuration(callData.duration)}
                                    </span>
                                  ) : null}
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

                              {/* Call Recording Audio Player */}
                              {callData?.recordingUrl ? (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="mt-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 dark:bg-emerald-500/10 p-2.5 shadow-2xs"
                                >
                                  <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                                        <Volume2 size={11} />
                                      </div>
                                      <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                                        Call Recording
                                      </span>
                                      {callData.duration ? (
                                        <span className="text-[11px] font-medium text-emerald-700/80 dark:text-emerald-400/80">
                                          ({formatCallDuration(callData.duration)})
                                        </span>
                                      ) : null}
                                    </div>
                                    <a
                                      href={callData.recordingUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer"
                                    >
                                      Open audio <ExternalLink size={11} />
                                    </a>
                                  </div>
                                  <audio
                                    controls
                                    preload="metadata"
                                    src={callData.recordingUrl}
                                    className="w-full h-8 rounded-lg accent-emerald-600"
                                  />
                                </div>
                              ) : null}
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

          {activeTab === 'ai-insight' && (
            <AiLeadInsightDetailsTab
              lead={lead}
              primaryContact={primaryContact}
              events={events}
              timeline={timeline}
              onLogCall={() => setCallOpen(true)}
              onScheduleFollowUp={() => openActivity('reminder')}
              onAddQuotation={() => openActivity('quotation')}
            />
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
                <div className="flex flex-col gap-2 border-b border-[var(--border-muted)] bg-[var(--surface-2)]/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-[var(--text-main)]">Quotations</h2>
                    <p className="text-[11px] text-[var(--text-muted)]">Proposal amount, status, validity and service details</p>
                  </div>
                  {canWriteLead ? (
                    <Button variant="outline" size="sm" className="h-8 px-3 text-xs shadow-sm" onClick={() => openActivity('quotation')}>
                      <PlusCircle size={14} className="mr-1.5" />
                      Add quotation
                    </Button>
                  ) : null}
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[980px] w-full table-fixed border-separate border-spacing-0">
                    <colgroup>
                      <col className="w-[25%]" />
                      <col className="w-[10%]" />
                      <col className="w-[10%]" />
                      <col className="w-[11%]" />
                      <col className="w-[9%]" />
                      <col className="w-[10%]" />
                      <col className="w-[11%]" />
                      <col className="w-[14%]" />
                    </colgroup>
                    <thead className="bg-[var(--surface-2)]">
                      <tr>
                        {['Quotation / Service', 'Proposal date', 'Valid until', 'Amount', 'Status', 'Invoice', 'Comments', ''].map((heading) => (
                          <th key={heading || 'actions'} className="border-b border-[var(--border)] px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pagedQuotations.length ? pagedQuotations.map((item) => (
                        <tr key={item.id} className="transition hover:bg-[var(--hover-bg)]">
                          <td className="border-b border-[var(--border-muted)] px-3 py-2">
                            <button
                              type="button"
                              onClick={() => navigate(leadRoute(lead, `quotations/${eventRouteSegment(item.event || item)}`))}
                              className="block w-full truncate text-left text-xs font-semibold text-[var(--text-main)] hover:text-[var(--primary)] hover:underline cursor-pointer"
                              title={item.title}
                            >
                              {item.title}
                            </button>
                            <div className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]" title={item.serviceName}>
                              {item.serviceName || 'No service specified'}
                            </div>
                          </td>
                          <td className="whitespace-nowrap border-b border-[var(--border-muted)] px-3 py-2 text-xs text-[var(--text-muted)]">{formatDate(item.proposalDate)}</td>
                          <td className="whitespace-nowrap border-b border-[var(--border-muted)] px-3 py-2 text-xs text-[var(--text-muted)]">{formatDate(item.validUntil)}</td>
                          <td className="whitespace-nowrap border-b border-[var(--border-muted)] px-3 py-2 text-xs font-semibold text-[var(--text-main)]">{item.totalAmount != null ? formatLeadAmount(item.totalAmount, lead.currency) : '-'}</td>
                          <td className="border-b border-[var(--border-muted)] px-3 py-2">
                            <span className={cn(
                              'inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold',
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
                          <td className="truncate border-b border-[var(--border-muted)] px-3 py-2 text-xs">
                            {item.invoiceId ? (
                              <button type="button" onClick={() => navigate(invoiceRoute({ id: item.invoiceId, invoiceNumber: item.invoiceNumber }))} className="font-semibold text-[var(--primary)] hover:underline cursor-pointer">
                                {item.invoiceNumber || 'View invoice'}
                              </button>
                            ) : <span className="text-[var(--text-muted)]">-</span>}
                          </td>
                          <td className="truncate border-b border-[var(--border-muted)] px-3 py-2 text-xs text-[var(--text-muted)]" title={item.comments}>{item.comments || '-'}</td>
                          <td className="border-b border-[var(--border-muted)] px-2 py-2 text-right">
                            <div className="flex justify-end gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate(leadRoute(lead, `quotations/${eventRouteSegment(item.event || item)}`))}
                                title="View quotation"
                                className="h-6 w-6 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 cursor-pointer"
                              >
                                <Eye size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  const message = buildWhatsAppProposalPitch({
                                    leadName: lead?.contactPerson || lead?.name,
                                    companyName: lead?.companyName,
                                    proposalTitle: item.title,
                                    serviceSummary: item.serviceName,
                                    totalAmount: item.totalAmount,
                                    currency: lead?.currency || 'INR',
                                    validityDate: item.validUntil
                                  });
                                  const phone = lead?.mobile || lead?.phone || primaryContact?.phone || '';
                                  const cleanPhone = phone.replace(/[^0-9]/g, '');
                                  if (cleanPhone) {
                                    window.open(`https://wa.me/${cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
                                  } else {
                                    setWhatsAppOpen(true);
                                  }
                                }}
                                title="Share proposal via WhatsApp"
                                className="h-6 w-6 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                              >
                                <MessageCircle size={14} />
                              </Button>
                              {canWriteLead ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => navigate(`${leadRoute(lead, 'quotations/new')}?fromRevision=${eventRouteSegment(item.event || item)}`)}
                                    title="Duplicate / Clone as Revision"
                                    className="h-6 w-6 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                                  >
                                    <RotateCw size={14} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => navigate(leadRoute(lead, `quotations/${eventRouteSegment(item.event || item)}`))}
                                    title="Edit quotation"
                                    className="h-6 w-6 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 cursor-pointer"
                                  >
                                    <Edit3 size={14} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setActivityDeleteTarget(item.event)}
                                    title="Delete quotation"
                                    className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-500/10 cursor-pointer"
                                  >
                                    <Trash2 size={14} />
                                  </Button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                            No quotation added yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {quotationRows.length > quotationPageSize ? (
                  <div className="px-4 pb-3">
                    <PaginationBar
                      currentPage={quotationPage}
                      totalItems={quotationRows.length}
                      pageSize={quotationPageSize}
                      onPageChange={(page) => setTabPage('quotations', page)}
                    />
                  </div>
                ) : null}
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
                      const callData = extractCallData(item);
                      const outcomeBadge = callData?.outcome ? getCallOutcomeBadge(callData.outcome) : null;

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
                          <div
                            onClick={() => setViewActivityTarget(item)}
                            className="rounded-xl border border-[var(--border-muted)] bg-[var(--surface)] hover:bg-[var(--surface-2)]/60 px-4 py-3 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                          >
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
                                {callData?.outcome && outcomeBadge ? (
                                  <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-md border shrink-0', outcomeBadge.bg, outcomeBadge.border, outcomeBadge.text)}>
                                    {callData.outcome}
                                  </span>
                                ) : null}
                                {callData?.duration ? (
                                  <span className="text-[10px] font-semibold text-[var(--text-muted)] bg-[var(--surface-2)] border border-[var(--border-muted)] px-1.5 py-0.5 rounded-md shrink-0">
                                    ⏱️ {formatCallDuration(callData.duration)}
                                  </span>
                                ) : null}
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

                            {/* Call Recording Audio Player */}
                            {callData?.recordingUrl ? (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="mt-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 dark:bg-emerald-500/10 p-3 shadow-2xs"
                              >
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                                      <Volume2 size={13} />
                                    </div>
                                    <div>
                                      <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                                        Call Recording
                                      </h4>
                                      {callData.duration ? (
                                        <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80">
                                          Duration: {formatCallDuration(callData.duration)}
                                        </p>
                                      ) : null}
                                    </div>
                                  </div>
                                  <a
                                    href={callData.recordingUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer"
                                  >
                                    Open audio <ExternalLink size={12} />
                                  </a>
                                </div>
                                <audio
                                  controls
                                  preload="metadata"
                                  src={callData.recordingUrl}
                                  className="w-full h-8 rounded-lg accent-emerald-600"
                                />
                              </div>
                            ) : null}

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

          {activeTab === 'calls' && (() => {
            const callsPage = tabPages.calls || 1;
            const callsPageSize = 10;
            const pagedCalls = filteredCalls.slice((callsPage - 1) * callsPageSize, callsPage * callsPageSize);

            return (
              <div className="w-full space-y-5">
                {/* 1. Header Toolbar with Metrics & Log Call Action */}
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-muted)] pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-2xs">
                        <PhoneCall size={22} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-bold text-[var(--text-main)]">Call History & Recordings</h2>
                          <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                            {leadCalls.length} {leadCalls.length === 1 ? 'Call' : 'Calls'}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          Mobile phone dialer logs with audio playback, caller numbers, outcomes, and instant redial
                        </p>
                      </div>
                    </div>

                    {canWriteLead ? (
                      <Button
                        onClick={() => setCallOpen(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs rounded-xl h-9 px-4 text-xs font-semibold cursor-pointer shrink-0"
                      >
                        <Phone size={14} className="mr-1.5" /> + Log New Call
                      </Button>
                    ) : null}
                  </div>

                  {/* Quick Call Metrics Cards (Mobile Dialer Style) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-[var(--border-muted)] bg-[var(--surface-2)]/50 p-3.5 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">Total Calls</span>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-xl font-bold text-[var(--text-main)]">{callStats.total}</span>
                        <span className="text-[11px] font-medium text-[var(--text-muted)]">logged</span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 p-3.5 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block">Connected</span>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{callStats.connected}</span>
                        <span className="text-[11px] font-medium text-emerald-700/70 dark:text-emerald-400/70">
                          ({callStats.total ? Math.round((callStats.connected / callStats.total) * 100) : 0}%)
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 dark:bg-cyan-500/10 p-3.5 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-300 block">Total Talk Time</span>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-xl font-bold text-cyan-700 dark:text-cyan-300">{callStats.totalTalkTime}</span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 dark:bg-purple-500/10 p-3.5 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 block">Recordings Available</span>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-xl font-bold text-purple-700 dark:text-purple-300">{callStats.recordings}</span>
                        <span className="text-[11px] font-medium text-purple-700/70 dark:text-purple-400/70">🎙️ audio files</span>
                      </div>
                    </div>
                  </div>

                  {/* Filter Tabs Bar (iOS / Android Style) */}
                  <div className="flex items-center gap-2 overflow-x-auto pt-1 border-t border-[var(--border-muted)]/60">
                    {[
                      { key: 'all', label: `All Calls (${leadCalls.length})` },
                      { key: 'connected', label: `Connected (${callStats.connected})` },
                      { key: 'missed', label: `Missed / Busy (${callStats.missedOrBusy})` },
                      { key: 'recordings', label: `🎙️ Audio Recordings (${callStats.recordings})` }
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => {
                          setCallFilter(tab.key);
                          setTabPage('calls', 1);
                        }}
                        className={cn(
                          'rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer shrink-0',
                          callFilter === tab.key
                            ? 'bg-[var(--primary)] text-white shadow-xs'
                            : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--text-main)] border border-[var(--border-muted)]'
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Mobile Phone Call Log List */}
                {pagedCalls.length ? (
                  <div className="space-y-3">
                    {pagedCalls.map((call, idx) => {
                      const timeInfo = formatActivityTimestamp(call.date || call.createdAt, call.time);
                      const isIncoming = String(call.type || '').toLowerCase() === 'incoming';
                      const oc = String(call.outcome || '').toLowerCase();
                      const isMissed = oc.includes('no answer') || oc.includes('switched off') || oc.includes('unreachable') || oc.includes('missed');
                      const isBusy = oc.includes('busy');
                      const outcomeBadge = getCallOutcomeBadge(call.outcome);

                      const DirectionIcon = isIncoming
                        ? ArrowDownLeft
                        : isMissed
                          ? PhoneMissed
                          : isBusy
                            ? PhoneOff
                            : ArrowUpRight;

                      const iconBg = isMissed
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                        : isBusy
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                          : isIncoming
                            ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
                            : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';

                      return (
                        <div
                          key={call.id || `call-${idx}`}
                          onClick={() => setViewActivityTarget(call.rawEvent || call)}
                          className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]/40 p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-all cursor-pointer space-y-3"
                        >
                          {/* Main Call Log Row */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                              {/* Dialer Bubble Icon */}
                              <div className={cn(
                                'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-transform group-hover:scale-105 shadow-2xs',
                                iconBg
                              )}>
                                <DirectionIcon size={18} strokeWidth={2.2} />
                              </div>

                              {/* Caller & Contact Info */}
                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-sm font-bold text-[var(--text-main)] truncate">
                                    {lead.contactPerson || lead.name || call.title}
                                  </h3>

                                  {/* Call Type Pill */}
                                  <span className={cn(
                                    'text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider',
                                    isIncoming
                                      ? 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                                      : isMissed
                                        ? 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                                        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                  )}>
                                    {call.type || 'Outgoing'}
                                  </span>

                                  {/* Call Outcome Badge */}
                                  {call.outcome && outcomeBadge && (
                                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-md border', outcomeBadge.bg, outcomeBadge.border, outcomeBadge.text)}>
                                      {call.outcome}
                                    </span>
                                  )}

                                  {/* Duration badge */}
                                  {call.duration ? (
                                    <span className="text-[11px] font-semibold text-[var(--text-muted)] bg-[var(--surface-2)] border border-[var(--border-muted)] px-2 py-0.5 rounded-md flex items-center gap-1">
                                      <Clock3 size={11} />
                                      {formatCallDuration(call.duration)}
                                    </span>
                                  ) : null}
                                </div>

                                {/* Phone number and Actor attribution */}
                                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                                  <span className="font-semibold text-[var(--text-main)] flex items-center gap-1">
                                    <Phone size={11} className="text-[var(--primary)]" />
                                    {formatPhoneDisplay(call.callerNumber || lead.phone) || 'N/A'}
                                  </span>
                                  {call.actorName && (
                                    <span>• Logged by <span className="font-medium text-[var(--text-main)]">{call.actorName}</span></span>
                                  )}
                                  {call.attachments?.length ? (
                                    <span className="text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-0.5">
                                      • 🎙️ Audio Available
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>

                            {/* Timestamp & Action Buttons */}
                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--border-muted)]/50">
                              <div className="text-left sm:text-right" title={timeInfo.formatted}>
                                <span className="text-xs font-bold text-[var(--text-main)] block">
                                  {timeInfo.dateOnly}
                                </span>
                                <span className="text-[11px] font-medium text-[var(--text-muted)] block">
                                  {timeInfo.timeOnly || (timeInfo.relative ? `(${timeInfo.relative})` : '')}
                                </span>
                              </div>

                              {/* Quick Action Dial Buttons */}
                              <div className="flex items-center gap-1.5">
                                <a
                                  href={`tel:${call.callerNumber || lead.phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  title="Call Number"
                                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition cursor-pointer shadow-2xs"
                                >
                                  <Phone size={14} />
                                </a>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setWhatsAppTemplatesOpen(true);
                                  }}
                                  title="Send WhatsApp Template"
                                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition cursor-pointer shadow-2xs"
                                >
                                  <MessageSquare size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setViewActivityTarget(call.rawEvent || call);
                                  }}
                                  title="View Details"
                                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--primary)] transition cursor-pointer shadow-2xs"
                                >
                                  <Eye size={14} />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Call Notes / Discussion Summary */}
                          {call.description ? (
                            <div className="rounded-xl border border-[var(--border-muted)]/80 bg-[var(--surface-2)]/40 p-3 text-xs text-[var(--text-main)] leading-relaxed">
                              <p className="line-clamp-3 whitespace-pre-wrap">{call.description}</p>
                            </div>
                          ) : null}

                          {/* Audio Recording Player Widget (Mobile Cassette Style) */}
                          {call.recordingUrl ? (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-teal-500/5 p-3.5 shadow-2xs space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                                    <Volume2 size={15} className="animate-pulse" />
                                  </div>
                                  <div>
                                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block">
                                      Call Recording Audio
                                    </span>
                                    <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80">
                                      {call.duration ? `Duration: ${formatCallDuration(call.duration)} • ` : ''}
                                      {call.attachments?.[0]?.name || 'Recorded conversation'}
                                    </span>
                                  </div>
                                </div>

                                <a
                                  href={call.recordingUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-lg transition cursor-pointer"
                                >
                                  Open audio <ExternalLink size={12} />
                                </a>
                              </div>

                              <audio
                                controls
                                preload="metadata"
                                src={call.recordingUrl}
                                className="w-full h-8 rounded-lg accent-emerald-600"
                              />
                            </div>
                          ) : null}

                          {/* 🧠 AI Call Breakdown & Key Takeaways */}
                          {(() => {
                            const rawTakeaways = call.aiTakeaways || call.payload?.aiTakeaways || call.meta?.aiTakeaways;
                            const hasRecording = Boolean(call.recordingUrl);
                            if (!rawTakeaways && !hasRecording) return null;

                            // Safe fallback AI synthesis if not already seeded
                            const defaultService = (Array.isArray(lead?.requiredServices) ? lead.requiredServices[0] : lead?.requiredServices) || lead?.requiredService || 'Web Development & Solutions';
                            const takeaways = rawTakeaways || {
                              summary: call.description || 'Customer inquiry and discovery session.',
                              requirements: [defaultService, 'Scope and budget clarification'],
                              objections: ['Timeline and delivery milestones confirmation requested'],
                              nextSteps: ['Share detailed proposal and schedule review call'],
                              sentiment: 'Positive / High Intent (80%)'
                            };

                            const requirements = Array.isArray(takeaways?.requirements)
                              ? takeaways.requirements
                              : (takeaways?.requirements ? [String(takeaways.requirements)] : []);
                            const objections = Array.isArray(takeaways?.objections)
                              ? takeaways.objections
                              : (takeaways?.objections ? [String(takeaways.objections)] : []);
                            const nextSteps = Array.isArray(takeaways?.nextSteps)
                              ? takeaways.nextSteps
                              : (takeaways?.nextSteps ? [String(takeaways.nextSteps)] : []);

                            const isExpanded = Boolean(expandedCallAI[call.id || idx]);

                            return (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/50 to-purple-50/30 dark:from-indigo-950/30 dark:to-purple-950/20 p-3 shadow-2xs space-y-2.5 transition-all"
                              >
                                <div
                                  className="flex items-center justify-between gap-2 cursor-pointer select-none"
                                  onClick={() => setExpandedCallAI((prev) => ({ ...prev, [call.id || idx]: !prev[call.id || idx] }))}
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-2xs shrink-0">
                                      <Brain size={13} />
                                    </div>
                                    <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                                      AI Call Breakdown & Transcription Takeaways
                                    </span>
                                    {takeaways?.sentiment ? (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800">
                                        {takeaways.sentiment}
                                      </span>
                                    ) : null}
                                  </div>
                                  <button
                                    type="button"
                                    className="text-indigo-600 dark:text-indigo-400 text-xs font-semibold flex items-center gap-1 hover:underline cursor-pointer shrink-0"
                                  >
                                    <span>{isExpanded ? 'Hide' : 'Expand'}</span>
                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                  </button>
                                </div>

                                {isExpanded ? (
                                  <div className="space-y-2.5 pt-2 border-t border-indigo-200/60 dark:border-indigo-900/40 text-xs animate-fadeIn">
                                    {takeaways?.summary ? (
                                      <div>
                                        <span className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">Executive Summary:</span>
                                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{takeaways.summary}</p>
                                      </div>
                                    ) : null}

                                    {requirements.length ? (
                                      <div>
                                        <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Requirements Extracted:</span>
                                        <div className="flex flex-wrap gap-1.5">
                                          {requirements.map((req, rIdx) => (
                                            <span key={rIdx} className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-[11px] font-medium">
                                              ✓ {req}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    ) : null}

                                    {objections.length ? (
                                      <div>
                                        <span className="font-bold text-amber-700 dark:text-amber-400 block mb-1">Client Questions / Considerations:</span>
                                        <div className="flex flex-wrap gap-1.5">
                                          {objections.map((obj, oIdx) => (
                                            <span key={oIdx} className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-[11px] font-medium">
                                              ⚠️ {obj}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    ) : null}

                                    {nextSteps.length ? (
                                      <div>
                                        <span className="font-bold text-emerald-700 dark:text-emerald-400 block mb-1">Committed Next Action:</span>
                                        <div className="flex flex-wrap gap-1.5">
                                          {nextSteps.map((step, sIdx) => (
                                            <span key={sIdx} className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-[11px] font-medium">
                                              🎯 {step}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)]/40 p-12 text-center space-y-3">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)]">
                      <PhoneCall size={24} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-[var(--text-main)]">No Calls Found</h3>
                      <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
                        {callFilter === 'all'
                          ? 'No calls have been logged yet for this lead. Use the button below to log your first call.'
                          : `No calls matching filter "${callFilter}".`}
                      </p>
                    </div>
                    {canWriteLead ? (
                      <Button
                        onClick={() => setCallOpen(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-9 px-4 text-xs font-semibold"
                      >
                        <Phone size={14} className="mr-1.5" /> Log First Call
                      </Button>
                    ) : null}
                  </div>
                )}

                {/* 3. Pagination */}
                <PaginationBar
                  currentPage={callsPage}
                  totalItems={filteredCalls.length}
                  pageSize={callsPageSize}
                  onPageChange={(page) => setTabPage('calls', page)}
                />
              </div>
            );
          })()}
        </div>

        {(activeTab === 'overview' || activeTab === 'details') ? (
        <div className="space-y-4">
          {/* AI Insights Card */}
          <AiLeadInsightsCard
            lead={lead}
            primaryContact={primaryContact}
            events={events}
            timeline={timeline}
            onLogCall={() => setCallOpen(true)}
            onScheduleFollowUp={() => openActivity('reminder')}
            onAddQuotation={() => openActivity('quotation')}
          />

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
              {lead.website ? (
                <div className="flex items-center justify-between gap-4 border-b border-[var(--border-muted)] px-5 py-3">
                  <span className="text-xs font-semibold text-[var(--text-muted)]">Website</span>
                  <a
                    href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[var(--primary)] font-medium hover:underline truncate max-w-[180px]"
                  >
                    {lead.website}
                  </a>
                </div>
              ) : null}
              {createdByName ? (
                <div className="flex items-center justify-between gap-4 border-b border-[var(--border-muted)] px-5 py-3">
                  <span className="text-xs font-semibold text-[var(--text-muted)]">Created By</span>
                  <span className="text-xs text-[var(--text-main)] font-medium">{createdByName}</span>
                </div>
              ) : null}
              {(lead.vatNumber || lead.gstNumber) ? (
                <div className="flex items-center justify-between gap-4 border-b border-[var(--border-muted)] px-5 py-3">
                  <span className="text-xs font-semibold text-[var(--text-muted)]">Tax Info</span>
                  <span className="text-xs font-semibold text-[var(--text-main)]">
                    {lead.vatNumber ? `VAT: ${lead.vatNumber}` : `GST: ${lead.gstNumber}`}
                  </span>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-4 px-5 py-3">
                <span className="text-xs font-semibold text-[var(--text-muted)]">Created</span>
                <span className="text-xs text-[var(--text-main)] font-medium">{formatDate(lead.createdAt)}</span>
              </div>
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
            navigate(clientRoute(result.client || result.clientId));
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
            navigate(clientRoute(result.client || result.clientId));
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

      <WhatsAppTemplateModal
        open={whatsAppTemplatesOpen}
        onClose={() => setWhatsAppTemplatesOpen(false)}
        lead={lead}
      />

      <MergeLeadModal
        open={Boolean(mergeTargetLead)}
        onClose={() => setMergeTargetLead(null)}
        primaryLead={lead}
        duplicateLead={mergeTargetLead}
        onSuccess={() => {
          setMergeTargetLead(null);
          load();
        }}
      />
    </div>
  );
}
