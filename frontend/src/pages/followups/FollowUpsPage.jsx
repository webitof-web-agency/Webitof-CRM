import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, ArrowRight, BarChart3, BellRing, CalendarDays, CheckCircle2,
  ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleAlert, Clock3, Download, ExternalLink, Eye, Filter, Flame, LayoutList, MapPin,
  Loader2, Mail, MessageCircle, MoreHorizontal, MoreVertical, Pencil, Phone, Play, Plus, RefreshCcw, Search,
  Settings2, ShieldAlert, Sparkles, TimerReset, Trash2, UserRound, UsersRound, Workflow, Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { cn } from '../../lib/cn';
import { exportToCsv } from '../../lib/exportCsv';
import { WhatsAppModal } from '../../components/common/WhatsAppModal';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input, Textarea } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { CompleteFollowUpModal, FollowUpFormModal, RescheduleFollowUpModal } from '../../components/followups/FollowUpModals';

const tabs = [
  { id: 'today', label: 'Today', icon: Clock3 },
  { id: 'list', label: 'List', icon: LayoutList },
  { id: 'visit', label: 'Visit', icon: MapPin },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'attention', label: 'Attention', icon: ShieldAlert },
  { id: 'workload', label: 'Workload', icon: UsersRound },
  { id: 'completed', label: 'Completed', icon: CheckCircle2 },
  { id: 'report', label: 'Report', icon: BarChart3 },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'automation', label: 'Automation', icon: Workflow }
];

const VISIT_FOLLOW_UP_TYPES = ['Visit', 'Site visit'];

const terminalStatuses = new Set(['Completed', 'Cancelled', 'Failed', 'Auto-Closed']);

function formatDateTime(value) {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatRelativeSeconds(seconds = 0) {
  const value = Number(seconds || 0);
  if (value < 60) return `${value}s`;
  if (value < 3600) return `${Math.floor(value / 60)}m`;
  if (value < 86400) return `${Math.floor(value / 3600)}h ${Math.floor((value % 3600) / 60)}m`;
  return `${Math.floor(value / 86400)}d ${Math.floor((value % 86400) / 3600)}h`;
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

function renderStatusPill(status, compact = false) {
  if (!status) return <span className="text-xs text-[var(--text-muted)]">-</span>;
  const colorMap = {
    Overdue: '#e11d48',
    'Due Today': '#2563eb',
    Scheduled: '#64748b',
    'In Progress': '#0284c7',
    'Waiting for Client': '#8b5cf6',
    'Waiting for Internal Team': '#7c3aed',
    'No Response': '#f97316',
    Escalated: '#dc2626',
    Completed: '#10b981',
    Cancelled: '#64748b'
  };
  const badgeColor = colorMap[status] || '#64748b';
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold whitespace-nowrap",
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs"
      )}
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

function renderPriorityPill(priority, compact = false) {
  if (!priority) return null;
  const colorMap = {
    Critical: '#e11d48',
    High: '#f59e0b',
    Medium: '#2563eb',
    Low: '#64748b'
  };
  const badgeColor = colorMap[priority] || '#64748b';
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold whitespace-nowrap",
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs"
      )}
      style={{
        backgroundColor: `${badgeColor}14`,
        borderColor: `${badgeColor}2E`,
        color: badgeColor
      }}
    >
      {priority}
    </span>
  );
}

function entityRoute(item) {
  const type = String(item.relatedEntityType || '').toLowerCase();
  if (['lead', 'opportunity', 'deal'].includes(type)) return `/app/leads/${item.relatedEntityId}`;
  if (type === 'quotation' || type === 'proposal') return item.leadId ? `/app/leads/${item.leadId}` : '/app/leads';
  if (type === 'client') return `/app/clients/${item.relatedEntityId}`;
  if (type === 'project') return `/app/projects/${item.relatedEntityId}`;
  if (type === 'invoice') return `/app/invoices/${item.relatedEntityId}`;
  if (type === 'payment') return `/app/payments/${item.relatedEntityId}`;
  if (type === 'amc') return `/app/amc/${item.relatedEntityId}`;
  if (type === 'renewal') return '/app/renewals';
  return '';
}

function getQuickRescheduleOptions() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const getLocalDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // 1. +1 Hour
  const plus1 = new Date(now.getTime() + 60 * 60 * 1000);
  const plus1Date = getLocalDateStr(plus1);
  const plus1Time = `${pad(plus1.getHours())}:${pad(plus1.getMinutes())}`;

  // 2. Today 5 PM
  const today5pmDate = getLocalDateStr(now);
  const today5pmTime = '17:00';

  // 3. Tomorrow 11 AM
  const tom = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (tom.getDay() === 0) tom.setDate(tom.getDate() + 1); // skip Sunday
  const tomDate = getLocalDateStr(tom);
  const tomTime = '11:00';

  // 4. +2 Days (11 AM)
  const plus2 = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  if (plus2.getDay() === 0) plus2.setDate(plus2.getDate() + 1);
  const plus2Date = getLocalDateStr(plus2);
  const plus2Time = '11:00';

  // 5. Next Monday 11 AM
  const nextMon = new Date(now);
  const daysUntilMon = ((1 + 7 - now.getDay()) % 7) || 7;
  nextMon.setDate(now.getDate() + daysUntilMon);
  const nextMonDate = getLocalDateStr(nextMon);
  const nextMonTime = '11:00';

  return [
    { label: '+1 Hr', date: plus1Date, time: plus1Time },
    { label: 'Today 5 PM', date: today5pmDate, time: today5pmTime },
    { label: 'Tomorrow 11 AM', date: tomDate, time: tomTime },
    { label: '+2 Days', date: plus2Date, time: plus2Time },
    { label: 'Next Mon', date: nextMonDate, time: nextMonTime }
  ];
}

function openDirectWhatsApp(item) {
  const phone = item.relatedPhone || item.phone || item.mobile;
  if (!phone) {
    toast.error('No phone number available for this record');
    return;
  }
  let cleanPhone = String(phone).replace(/[^0-9]/g, '');
  if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;

  const name = item.relatedEntityLabel || item.companyName || 'there';
  const purpose = item.purpose || item.title || 'our scheduled discussion';
  const message = `Hi ${name}, following up regarding ${purpose}. Please let me know when would be a convenient time to connect over a quick call. Thanks!`;
  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function Metric({ label, value, helper, icon: Icon, tone = 'blue', active = false, onClick }) {
  const toneConfig = {
    rose: {
      bg: 'bg-rose-500/10',
      text: 'text-rose-600 dark:text-rose-400',
      border: 'hover:border-rose-200 dark:hover:border-rose-900/50',
      activeRing: 'border-rose-500/40 ring-2 ring-rose-500/15 bg-rose-500/5'
    },
    blue: {
      bg: 'bg-blue-500/10',
      text: 'text-blue-600 dark:text-blue-400',
      border: 'hover:border-blue-200 dark:hover:border-blue-900/50',
      activeRing: 'border-blue-500/40 ring-2 ring-blue-500/15 bg-blue-500/5'
    },
    amber: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'hover:border-amber-200 dark:hover:border-amber-900/50',
      activeRing: 'border-amber-500/40 ring-2 ring-amber-500/15 bg-amber-500/5'
    },
    emerald: {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-600 dark:text-emerald-400',
      border: 'hover:border-emerald-200 dark:hover:border-emerald-900/50',
      activeRing: 'border-emerald-500/40 ring-2 ring-emerald-500/15 bg-emerald-500/5'
    },
    violet: {
      bg: 'bg-violet-500/10',
      text: 'text-violet-600 dark:text-violet-400',
      border: 'hover:border-violet-200 dark:hover:border-violet-900/50',
      activeRing: 'border-violet-500/40 ring-2 ring-violet-500/15 bg-violet-500/5'
    }
  }[tone] || {
    bg: 'bg-slate-500/10',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'hover:border-slate-300 dark:hover:border-slate-700',
    activeRing: 'border-[var(--primary)]/40 ring-2 ring-[var(--primary)]/15 bg-[var(--primary)]/5'
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-2 rounded-2xl border bg-[var(--surface)] px-3 py-1.5 transition-all duration-150 hover:shadow-sm cursor-pointer select-none shrink-0",
        active
          ? toneConfig.activeRing
          : cn("border-[var(--border)]", toneConfig.border)
      )}
    >
      <div className={cn("flex h-7 w-7 items-center justify-center rounded-xl group-hover:scale-110 transition-transform shrink-0", toneConfig.bg, toneConfig.text)}>
        <Icon size={15} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] truncate leading-tight">{label}</div>
        <div className="flex items-baseline gap-1">
          <span className={cn("text-base font-black tracking-tight", toneConfig.text)}>
            {value ?? 0}
          </span>
          {helper && <span className="text-[10px] text-slate-400 font-medium truncate">{helper}</span>}
        </div>
      </div>
    </div>
  );
}

function FollowUpActions({ item, onAction }) {
  const closed = terminalStatuses.has(item.status);
  const phone = item.relatedPhone || item.phone || item.mobile;

  return (
    <div className="flex items-center gap-1 shrink-0">
      {!closed && (
        <button
          type="button"
          onClick={() => onAction('complete', item)}
          title="Mark Complete"
          className="flex h-7.5 w-7.5 items-center justify-center rounded-lg text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/20 bg-emerald-500/5 transition shadow-2xs cursor-pointer"
        >
          <CheckCircle2 size={14} />
        </button>
      )}

      {phone && (
        <button
          type="button"
          onClick={() => openDirectWhatsApp(item)}
          title="WhatsApp Nudge"
          className="flex h-7.5 w-7.5 items-center justify-center rounded-lg text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/20 bg-emerald-500/5 transition shadow-2xs cursor-pointer"
        >
          <MessageCircle size={14} />
        </button>
      )}

      <button
        type="button"
        onClick={() => onAction('details', item)}
        title="View Details"
        className="flex h-7.5 w-7.5 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-2)] border border-[var(--border)] bg-[var(--surface)] transition shadow-2xs cursor-pointer"
      >
        <Eye size={13} />
      </button>

      <button
        type="button"
        onClick={() => onAction('edit', item)}
        title="Edit Follow-up"
        className="flex h-7.5 w-7.5 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-2)] border border-[var(--border)] bg-[var(--surface)] transition shadow-2xs cursor-pointer"
      >
        <Pencil size={13} />
      </button>

      {!closed && (
        <button
          type="button"
          onClick={() => onAction('reschedule', item)}
          title="Custom Reschedule"
          className="flex h-7.5 w-7.5 items-center justify-center rounded-lg text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/20 bg-amber-500/5 transition shadow-2xs cursor-pointer"
        >
          <TimerReset size={13} />
        </button>
      )}

      <button
        type="button"
        onClick={() => onAction('delete', item)}
        title="Delete"
        className="flex h-7.5 w-7.5 items-center justify-center rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 border border-rose-500/20 bg-rose-500/5 transition shadow-2xs cursor-pointer"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function FollowUpCard({ item, onAction, dense = false }) {
  const navigate = useNavigate();
  const closed = terminalStatuses.has(item.status);
  const quickOptions = getQuickRescheduleOptions();
  const route = entityRoute(item);
  const [openMenu, setOpenMenu] = useState(false);
  const phone = item.relatedPhone || item.phone || item.mobile;

  // Dense Mode for Kanban Columns
  if (dense) {
    return (
      <div
        className={cn(
          "group relative rounded-2xl border bg-[var(--surface)] p-3.5 shadow-2xs hover:shadow-xl hover:-translate-y-1 hover:border-[var(--primary)]/40 transition-all duration-200 ease-out space-y-2.5 hover:bg-gradient-to-b hover:from-[var(--surface)] hover:to-[var(--surface-2)]/30",
          item.effectiveStatus === 'Overdue'
            ? "border-rose-500/40 ring-1 ring-rose-500/15 shadow-[0_4px_16px_rgba(244,63,94,0.06)] hover:border-rose-500/70 hover:shadow-[0_10px_25px_rgba(244,63,94,0.14)]"
            : "border-[var(--border)] hover:border-[var(--primary)]/40"
        )}
      >
        {/* Top Header Row: Priority + Status Badges on left, Action Icons on right */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex flex-wrap items-center gap-1 min-w-0">
            {renderPriorityPill(item.priority, true)}
            {renderStatusPill(item.effectiveStatus || item.status, true)}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!closed && (
              <button
                type="button"
                onClick={() => onAction('complete', item)}
                title="Mark Complete"
                className="flex h-6.5 w-6.5 items-center justify-center rounded-lg text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-500/10 border border-emerald-500/20 bg-emerald-500/5 transition shadow-2xs cursor-pointer"
              >
                <CheckCircle2 size={13} />
              </button>
            )}
            {phone && (
              <button
                type="button"
                onClick={() => openDirectWhatsApp(item)}
                title="WhatsApp Nudge"
                className="flex h-6.5 w-6.5 items-center justify-center rounded-lg text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-500/10 border border-emerald-500/20 bg-emerald-500/5 transition shadow-2xs cursor-pointer"
              >
                <MessageCircle size={13} />
              </button>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(!openMenu)}
                title="Actions"
                className="flex h-6.5 w-6.5 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-2)] border border-[var(--border)] bg-[var(--surface)] transition shadow-2xs cursor-pointer"
              >
                <MoreVertical size={13} />
              </button>
              {openMenu && (
                <div
                  className="absolute right-0 top-7 z-30 w-36 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-lg animate-fade-scale"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-[var(--text-main)] hover:bg-[var(--hover-bg)] cursor-pointer"
                    onClick={() => { setOpenMenu(false); onAction('details', item); }}
                  >
                    <Eye size={13} /> View
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-[var(--text-main)] hover:bg-[var(--hover-bg)] cursor-pointer"
                    onClick={() => { setOpenMenu(false); onAction('edit', item); }}
                  >
                    <Pencil size={13} /> Edit
                  </button>
                  {!closed && (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer"
                      onClick={() => { setOpenMenu(false); onAction('reschedule', item); }}
                    >
                      <TimerReset size={13} /> Reschedule
                    </button>
                  )}
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                    onClick={() => { setOpenMenu(false); onAction('delete', item); }}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Title */}
        <h4
          onClick={() => onAction('details', item)}
          className="text-xs font-bold text-[var(--text-main)] hover:text-[var(--primary)] transition cursor-pointer line-clamp-2 leading-snug"
        >
          {item.title}
        </h4>

        {/* Related Lead Link */}
        {route ? (
          <button
            type="button"
            onClick={() => onAction('view_lead', item)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition cursor-pointer max-w-full truncate"
            title="View Lead Profile"
          >
            <UserRound size={10} className="shrink-0" />
            <span className="truncate">{item.relatedEntityLabel || item.relatedEntityId}</span>
            <ExternalLink size={9} className="opacity-70 shrink-0" />
          </button>
        ) : null}

        {/* Note / Description */}
        {item.description && !item.description.startsWith('Remark:') ? (
          <p className="text-[11px] text-[var(--text-muted)] line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        ) : null}

        {/* Footer (Assignee + Due Date/Time) */}
        <div className="flex items-center justify-between gap-1 pt-2 border-t border-[var(--border-muted)] text-[10.5px]">
          <div className="flex items-center gap-1 font-medium text-[var(--text-muted)] truncate min-w-0">
            <UserRound size={11} className="text-[var(--text-muted)] shrink-0" />
            <span className="truncate">{item.assigneeName || 'Unassigned'}</span>
          </div>
          <div className="flex items-center gap-1 font-semibold text-[var(--text-main)] shrink-0">
            <Clock3 size={11} className={item.effectiveStatus === 'Overdue' ? 'text-rose-500' : 'text-[var(--text-muted)]'} />
            <span>{formatDateTime(item.dueAt)}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-2xl border bg-[var(--surface)] p-4 transition-all duration-150 hover:shadow-md space-y-3",
      item.effectiveStatus === 'Overdue'
        ? "border-rose-500/40 ring-1 ring-rose-500/15 shadow-[0_4px_20px_rgba(244,63,94,0.06)]"
        : "border-[var(--border)]"
    )}>
      {/* Top Header Row: Status Badge + Title + Action Icons */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {renderPriorityPill(item.priority, true)}
            {renderStatusPill(item.effectiveStatus || item.status, true)}
            {route ? (
              <button
                type="button"
                onClick={() => onAction('view_lead', item)}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition cursor-pointer"
                title="View Lead Profile"
              >
                <UserRound size={11} />
                <span>{item.relatedEntityLabel || item.relatedEntityId}</span>
                <ExternalLink size={10} className="opacity-70" />
              </button>
            ) : null}
          </div>

          <h3
            onClick={() => onAction('details', item)}
            className="text-sm font-bold text-[var(--text-main)] hover:text-[var(--primary)] transition cursor-pointer"
          >
            {item.title}
          </h3>
        </div>

        {/* Action Buttons */}
        <FollowUpActions item={item} onAction={onAction} />
      </div>

      {/* Remark / Outcome Callout if Completed */}
      {(item.actualOutcome || item.discussionNote) ? (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
          <span className="font-semibold flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-300 mb-0.5">
            <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" />
            Follow-Up Remark / Outcome ({item.actualOutcome || 'Completed'}):
          </span>
          <span className="whitespace-pre-wrap">{item.discussionNote || item.description}</span>
        </div>
      ) : null}

      {/* Note / Description */}
      {item.description && !item.description.startsWith('Remark:') ? (
        <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-2">
          {item.description}
        </p>
      ) : null}

      {/* Scheduled Line & Timing */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-muted)] pt-2.5 text-[11px]">
        <div className="flex items-center gap-2 font-medium text-[var(--text-muted)]">
          {item.assigneeName ? (
            <span className="inline-flex items-center gap-1 text-[var(--text-main)] bg-[var(--surface-2)] border border-[var(--border)] px-2 py-0.5 rounded-full font-medium text-[11px]">
              <UserRound size={12} className="text-[var(--text-muted)]" />
              {item.assigneeName}
            </span>
          ) : (
            <span className="text-[var(--text-muted)]">👤 Unassigned</span>
          )}
          {item.purpose || item.followUpType ? (
            <span className="text-[var(--text-muted)]">· {item.purpose || item.followUpType}</span>
          ) : null}
        </div>

        {/* Right side: Timing */}
        <div className="flex flex-col items-end gap-1">
          <div className={`font-semibold px-2.5 py-0.5 rounded-full text-xs inline-flex items-center gap-1 ${
            closed
              ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20'
              : item.effectiveStatus === 'Overdue'
                ? 'text-rose-700 dark:text-rose-300 bg-rose-500/10 border border-rose-500/20'
                : 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20'
          }`}>
            {closed ? 'Completed' : item.overdueDurationSeconds ? `⏰ Overdue ${formatRelativeSeconds(item.overdueDurationSeconds)}` : `⏰ ${item.effectiveStatus || 'Scheduled'}`}
          </div>
          <span className="text-[11px] font-semibold text-[var(--text-main)] flex items-center gap-1">
            <Clock3 size={12} className="text-[var(--text-muted)]" />
            {formatDateTime(item.dueAt)}
          </span>
        </div>
      </div>

      {/* Quick Reschedule Chips */}
      {!closed && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--border-muted)] pt-2">
          <span className="text-[10px] font-semibold text-[var(--text-muted)] flex items-center gap-1 mr-0.5">
            <Zap size={11} className="text-amber-500" /> Quick Reschedule:
          </span>
          {quickOptions.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => onAction('quick_reschedule', { ...item, _rescheduleDate: opt.date, _rescheduleTime: opt.time, _rescheduleLabel: opt.label })}
              title={`Reschedule to ${opt.label}`}
              className="px-2 py-0.5 rounded-lg text-[10px] font-semibold border border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface)] hover:text-[var(--primary)] hover:border-[var(--primary)] text-[var(--text-muted)] transition cursor-pointer"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TodayView({ data, loading, onAction }) {
  const sections = [
    ['overdue', 'Overdue', 'Immediate recovery required', 'rose', AlertTriangle],
    ['dueToday', 'Due today', 'Today’s action queue', 'blue', Clock3],
    ['critical', 'Critical', 'Highest business risk', 'amber', Flame],
    ['dueNow', 'Due now', 'Within 30 minutes', 'amber', BellRing],
    ['missingNextAction', 'Missing next action', 'Action must be clarified', 'rose', ShieldAlert],
    ['waitingForClient', 'Waiting for client', 'Needs a timed response check', 'violet', TimerReset]
  ];

  // By default only 'overdue' is open, and opening another closes the previous one
  const [openSection, setOpenSection] = useState('overdue');

  function toggleSection(key) {
    setOpenSection((prev) => (prev === key ? null : key));
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-36 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map(([key, title, description, tone, Icon]) => {
        const rows = data?.sections?.[key] || [];
        if (!rows.length && !['overdue', 'dueToday', 'critical'].includes(key)) return null;

        const isOpen = openSection === key;

        const toneConfig = {
          rose: { bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400', badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
          blue: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
          amber: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
          violet: { bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400', badge: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20' }
        }[tone] || { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400', badge: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' };

        return (
          <div key={key} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
            {/* Clickable Header for Collapsing */}
            <button
              type="button"
              onClick={() => toggleSection(key)}
              className="w-full flex items-center justify-between p-4 bg-[var(--surface)] hover:bg-[var(--surface-2)]/60 transition cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", toneConfig.bg, toneConfig.text)}>
                  <Icon size={17} />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                    {title}
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">{description}</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", toneConfig.badge)}>
                  {rows.length} {rows.length === 1 ? 'item' : 'items'}
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] shadow-2xs">
                  {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </span>
              </div>
            </button>

            {/* Collapsible Content */}
            {isOpen && (
              <div className="p-4 pt-2 space-y-3 border-t border-[var(--border-muted)] bg-[var(--surface-2)]/20">
                {rows.length ? (
                  rows.map((item) => (
                    <FollowUpCard key={item.id} item={item} onAction={onAction} />
                  ))
                ) : (
                  <EmptyState
                    title={`No ${title.toLowerCase()} follow-ups`}
                    description="The queue is clear for this section."
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const QUICK_FILTER_TABS = [
  { id: 'all', label: 'All', icon: LayoutList, tone: 'slate', helper: 'All active follow-ups' },
  { id: 'overdue', label: 'Overdue', icon: AlertTriangle, tone: 'rose', helper: 'Past scheduled time' },
  { id: 'due_today', label: 'Due today', icon: Clock3, tone: 'blue', helper: 'Today’s working queue' },
  { id: 'critical', label: 'Critical', icon: Flame, tone: 'amber', helper: 'Highest business risk' },
  { id: 'upcoming', label: 'Upcoming', icon: CalendarDays, tone: 'emerald', helper: 'Future scheduled items' }
];

function ListView({ rows, meta, filters, setFilters, counts = {}, loading, onAction, onRefresh, title = '', description = '' }) {
  const activeQuick = filters.quickFilter || 'all';
  const quickOptions = getQuickRescheduleOptions();
  const quickCounts = meta.quickCounts || {};
  const hasQuickCounts = Object.keys(quickCounts).length > 0;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-0 overflow-hidden shadow-2xs">
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-[var(--text-main)]">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-[var(--text-muted)]">{description}</p> : null}
          </div>
          <Badge tone="neutral" size="sm">
            {hasQuickCounts ? (quickCounts.all || 0) : (meta.total || 0)}
          </Badge>
        </div>
      ) : null}

      {/* Quick Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[var(--border)] bg-[var(--surface-2)]/60 p-2 sm:px-3">
        {QUICK_FILTER_TABS.map((tab) => {
          const active = activeQuick === tab.id;
          const Icon = tab.icon;
          const countVal = tab.id === 'all'
            ? (hasQuickCounts ? quickCounts.all : (meta.total ?? rows.length ?? 0))
            : (hasQuickCounts ? quickCounts[tab.id] : undefined);

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilters((current) => ({
                ...current,
                quickFilter: tab.id,
                page: 1
              }))}
              title={tab.helper}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer select-none",
                active
                  ? "bg-[var(--primary)] text-white shadow-2xs font-bold"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text-main)]"
              )}
            >
              <Icon size={13} className={active ? "text-white" : "text-[var(--text-muted)]"} />
              <span>{tab.label}</span>
              {countVal !== undefined && countVal !== null ? (
                <span className={cn(
                  "inline-flex h-4.5 min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10.5px] font-extrabold leading-none shrink-0",
                  active
                    ? "bg-white/25 text-white"
                    : "bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)]"
                )}>
                  {countVal}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-[var(--border)] p-3 sm:px-4 bg-[var(--surface)]">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          <input
            type="text"
            className="w-full h-9 pl-9 pr-3 text-xs rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/50 text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/15 focus:border-[var(--primary)]/40 transition"
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value, page: 1 }))}
            placeholder="Search name, phone, purpose or record ID..."
          />
        </div>
        <div className="w-[140px] sm:w-[160px]">
          <Select
            value={filters.status}
            onChange={(value) => setFilters((current) => ({
              ...current,
              status: value,
              quickFilter: 'all',
              page: 1
            }))}
            options={[{ value: '', label: 'All statuses' }, 'Scheduled', 'Due Today', 'In Progress', 'Waiting for Client', 'Waiting for Internal Team', 'No Response', 'Escalated', 'Completed'].map((item) => typeof item === 'string' ? { value: item, label: item } : item)}
          />
        </div>
        <div className="w-[130px] sm:w-[145px]">
          <Select
            value={filters.priority}
            onChange={(value) => setFilters((current) => ({
              ...current,
              priority: value,
              quickFilter: 'all',
              page: 1
            }))}
            options={[{ value: '', label: 'All priorities' }, ...['Low', 'Medium', 'High', 'Critical'].map((value) => ({ value, label: value }))]}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (!rows || !rows.length) {
              toast.error('No follow-up records to export');
              return;
            }
            const cols = [
              { label: 'Title', key: 'title' },
              { label: 'Contact/Entity', key: 'relatedEntityLabel' },
              { label: 'Type', key: 'relatedEntityType' },
              { label: 'Company', key: 'companyName' },
              { label: 'Phone', accessor: (r) => r.relatedPhone || r.phone || '' },
              { label: 'Due Date', accessor: (r) => r.dueAt ? new Date(r.dueAt).toLocaleString('en-IN') : '' },
              { label: 'Priority', key: 'priority' },
              { label: 'Status', key: 'status' },
              { label: 'Effective Status', key: 'effectiveStatus' },
              { label: 'Assignee', key: 'assigneeName' },
              { label: 'Purpose', key: 'purpose' },
              { label: 'Next Action', key: 'nextAction' }
            ];
            exportToCsv('follow_ups_export', cols, rows);
            toast.success(`Exported ${rows.length} follow-ups to CSV`);
          }}
          title="Export CSV"
          className="!rounded-xl h-9 px-3 gap-1.5 cursor-pointer shadow-2xs"
        >
          <Download size={14} className="text-emerald-600" />
          <span>Export</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          title="Refresh List"
          className="!rounded-xl h-9 px-3 gap-1.5 cursor-pointer shadow-2xs"
        >
          <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-xs sm:text-sm">
          <thead className="bg-[var(--surface-2)]/60 text-[10.5px] uppercase font-bold tracking-wider text-[var(--text-muted)] border-b border-[var(--border)]">
            <tr>
              <th className="px-4 py-3 font-bold">Record / Client</th>
              <th className="px-4 py-3 font-bold">Purpose & Title</th>
              <th className="px-4 py-3 font-bold">Scheduled / Due</th>
              <th className="px-3 py-3 font-bold text-center">Priority</th>
              <th className="px-3 py-3 font-bold text-center">Status</th>
              <th className="px-4 py-3 font-bold">Assignee</th>
              <th className="px-4 py-3 font-bold">Next Action</th>
              <th className="px-4 py-3 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-muted)]">
            {loading ? (
              <tr><td colSpan="8" className="p-6"><Skeleton className="h-36 rounded-xl" /></td></tr>
            ) : rows.map((item) => {
              const closed = terminalStatuses.has(item.status);
              const initials = (item.assigneeName || 'UA')
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();

              return (
                <tr key={item.id} className="align-middle hover:bg-[var(--hover-bg)] transition-colors duration-100 group">
                  {/* Record */}
                  <td className="px-4 py-3">
                    <button
                      className="font-bold text-[var(--text-main)] hover:text-[var(--primary)] text-left cursor-pointer leading-tight transition"
                      onClick={() => onAction('details', item)}
                    >
                      {item.relatedEntityLabel || 'Unknown Record'}
                    </button>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                      <span className="font-mono text-[10px] bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)] px-1.5 py-0.5 rounded-full">
                        {item.followUpNumber || 'FU'}
                      </span>
                      <span>·</span>
                      <span className="capitalize">{item.relatedEntityType || 'Lead'}</span>
                    </div>
                    {item.companyName && (
                      <p className="mt-0.5 text-xs font-medium text-[var(--text-muted)] truncate max-w-[200px]">
                        {item.companyName}
                      </p>
                    )}
                  </td>

                  {/* Purpose & Title */}
                  <td className="max-w-[220px] px-4 py-3">
                    <p className="font-bold text-[var(--text-main)] text-xs sm:text-sm leading-snug">
                      {item.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                      {item.purpose || item.followUpType || 'General follow-up'}
                    </p>
                  </td>

                  {/* Scheduled / Due */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Clock3 size={13} className={item.effectiveStatus === 'Overdue' ? 'text-rose-500' : 'text-[var(--text-muted)]'} />
                      <span className={cn("text-xs font-semibold", item.effectiveStatus === 'Overdue' ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-[var(--text-main)]')}>
                        {formatDateTime(item.dueAt)}
                      </span>
                    </div>
                    {item.overdueDurationSeconds ? (
                      <p className="mt-0.5 text-[11px] font-semibold text-rose-500 dark:text-rose-400">
                        {formatRelativeSeconds(item.overdueDurationSeconds)} late
                      </p>
                    ) : null}

                    {/* Compact Quick Reschedule Buttons */}
                    {!closed && (
                      <div className="mt-1.5 flex items-center gap-1">
                        {quickOptions.slice(0, 3).map((opt) => (
                          <button
                            key={opt.label}
                            type="button"
                            onClick={() => onAction('quick_reschedule', { ...item, _rescheduleDate: opt.date, _rescheduleTime: opt.time, _rescheduleLabel: opt.label })}
                            className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] hover:bg-[var(--surface)] transition cursor-pointer"
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Priority */}
                  <td className="px-3 py-3 text-center">
                    {renderPriorityPill(item.priority)}
                  </td>

                  {/* Status */}
                  <td className="px-3 py-3 text-center">
                    {renderStatusPill(item.effectiveStatus)}
                  </td>

                  {/* Assignee */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[10px] font-bold text-[var(--text-main)]">
                        {initials}
                      </span>
                      <span className="text-xs font-medium text-[var(--text-main)] truncate max-w-[120px]">
                        {item.assigneeName || 'Unassigned'}
                      </span>
                    </div>
                  </td>

                  {/* Next Action */}
                  <td className="max-w-[200px] px-4 py-3">
                    <p className="text-xs text-[var(--text-muted)] truncate">
                      {item.nextAction || '—'}
                    </p>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end">
                      <FollowUpActions item={item} onAction={onAction} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!loading && !rows.length ? (
        <div className="p-8"><EmptyState title="No follow-ups match" description="Change filters or schedule a new follow-up." /></div>
      ) : null}

      {/* Pagination Footer */}
      {(() => {
        const currentPage = filters.page || 1;
        const pageSize = filters.limit || 10;
        const totalItems = meta.total || rows.length || 0;
        const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
        const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
        const endIndex = Math.min(currentPage * pageSize, totalItems);

        const getPageNumbers = () => {
          if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
          }
          const pages = [];
          if (currentPage <= 3) {
            pages.push(1, 2, 3, 4, '...', totalPages);
          } else if (currentPage >= totalPages - 2) {
            pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
          } else {
            pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
          }
          return pages;
        };

        return (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-3 text-xs text-[var(--text-muted)] bg-[var(--surface)]">
            <div className="flex flex-wrap items-center gap-4">
              <span>
                Showing <span className="font-bold text-[var(--text-main)]">{startIndex}</span> to{' '}
                <span className="font-bold text-[var(--text-main)]">{endIndex}</span> of{' '}
                <span className="font-bold text-[var(--text-main)]">{totalItems}</span> records
              </span>

              <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <span>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setFilters((current) => ({ ...current, limit: Number(e.target.value), page: 1 }))}
                  className="h-7.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--text-main)] px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-[var(--primary)] cursor-pointer"
                >
                  {[10, 25, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={currentPage <= 1}
                onClick={() => setFilters((current) => ({ ...current, page: currentPage - 1 }))}
                className="cursor-pointer"
              >
                Previous
              </Button>

              <div className="hidden sm:flex items-center gap-1 mx-1">
                {getPageNumbers().map((p, idx) => {
                  if (p === '...') {
                    return (
                      <span key={`ellipsis-${idx}`} className="px-1 text-[var(--text-muted)] select-none">
                        ...
                      </span>
                    );
                  }
                  const active = p === currentPage;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setFilters((current) => ({ ...current, page: p }))}
                      className={cn(
                        "flex h-7 min-w-[28px] items-center justify-center px-2 rounded-lg text-xs font-semibold transition cursor-pointer",
                        active
                          ? "bg-[var(--primary)] text-white font-bold shadow-2xs"
                          : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-main)] hover:bg-[var(--surface-2)]"
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>

              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={currentPage >= totalPages}
                onClick={() => setFilters((current) => ({ ...current, page: currentPage + 1 }))}
                className="cursor-pointer"
              >
                Next
              </Button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function CalendarView({ rows, month, setMonth, onAction, onCreate, loading }) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const first = new Date(year, monthIndex, 1);
  const startOffset = first.getDay();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [...Array(startOffset).fill(null), ...Array.from({ length: days }, (_, index) => index + 1)];
  const byDay = rows.reduce((map, item) => {
    const date = new Date(item.dueAt);
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
    if (!map[key]) map[key] = [];
    map[key].push(item);
    return map;
  }, {});

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-0 overflow-hidden shadow-2xs">
      <div className="flex items-center justify-between border-b border-[var(--border)] p-3.5 px-4 bg-[var(--surface)]">
        <Button variant="outline" size="icon" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))} className="!rounded-xl h-8 w-8 cursor-pointer">
          <ArrowLeft size={14} />
        </Button>
        <h2 className="font-bold text-sm sm:text-base text-[var(--text-main)]">
          {month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        </h2>
        <Button variant="outline" size="icon" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))} className="!rounded-xl h-8 w-8 cursor-pointer">
          <ArrowRight size={14} />
        </Button>
      </div>

      {loading ? (
        <div className="p-6"><Skeleton className="h-[520px] rounded-xl" /></div>
      ) : (
        <div className="grid grid-cols-7 bg-[var(--border)] gap-px">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
            <div key={label} className="bg-[var(--surface-2)]/80 p-2 text-center text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {label}
            </div>
          ))}
          {cells.map((day, index) => {
            const key = day ? `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
            const items = byDay[key] || [];
            const isToday = key === new Date().toISOString().slice(0, 10);
            return (
              <div
                key={`${day}-${index}`}
                onClick={() => {
                  if (day) onCreate?.({ date: key });
                }}
                className={cn(
                  "min-h-28 p-2 transition-colors relative flex flex-col justify-between select-none",
                  day
                    ? "bg-[var(--surface)] hover:bg-[var(--surface-2)]/80 cursor-pointer group"
                    : "bg-[var(--surface-2)]/30 pointer-events-none"
                )}
                title={day ? `Click empty space to schedule follow-up on ${key}` : undefined}
              >
                {day ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "text-xs font-bold transition-colors",
                        isToday
                          ? "flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-2xs font-extrabold"
                          : "text-[var(--text-muted)] group-hover:text-[var(--text-main)]"
                      )}>
                        {day}
                      </span>
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold text-[var(--primary)] flex items-center gap-0.5 bg-[var(--primary)]/10 px-1.5 py-0.5 rounded-md">
                        <Plus size={10} /> Add
                      </span>
                    </div>

                    <div className="mt-1.5 space-y-1 flex-1">
                      {items.slice(0, 3).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAction('details', item);
                          }}
                          title="Click to view details"
                          className={cn(
                            "block w-full truncate rounded-lg px-2 py-1 text-left text-[10.5px] font-semibold transition-all cursor-pointer shadow-2xs hover:shadow-xs hover:scale-[1.01] active:scale-[0.99]",
                            item.effectiveStatus === 'Overdue'
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20"
                              : item.priority === 'Critical'
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20"
                                : terminalStatuses.has(item.status)
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 line-through opacity-70"
                                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 hover:bg-blue-500/20"
                          )}
                        >
                          {new Date(item.dueAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} {item.title}
                        </button>
                      ))}
                      {items.length > 3 ? (
                        <p className="text-[10px] font-bold text-[var(--primary)] pl-0.5 pt-0.5">
                          +{items.length - 3} more
                        </p>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const ATTENTION_CATEGORY_CONFIG = {
  missingNextAction: {
    label: 'Missing Next Action',
    description: 'Leads with finished activity but no upcoming follow-up scheduled.',
    icon: ShieldAlert,
    tone: 'rose'
  },
  overdue: {
    label: 'Overdue Follow-ups',
    description: 'Follow-ups past scheduled time requiring immediate execution.',
    icon: AlertTriangle,
    tone: 'rose'
  },
  unassigned: {
    label: 'Unassigned Records',
    description: 'New or active leads without an assigned team member.',
    icon: UserRound,
    tone: 'violet'
  },
  highValueAtRisk: {
    label: 'High-Value Deals At Risk',
    description: 'Major opportunities with stalled or delayed follow-up cycles.',
    icon: Flame,
    tone: 'amber'
  },
  waitingTooLong: {
    label: 'Waiting Too Long',
    description: 'Awaiting client response for extended days without a check-in.',
    icon: TimerReset,
    tone: 'violet'
  },
  repeatedlyRescheduled: {
    label: 'Repeatedly Rescheduled',
    description: 'Follow-ups postponed multiple times indicating stalled interest.',
    icon: Clock3,
    tone: 'amber'
  },
  promiseDateMissed: {
    label: 'Promise Date Missed',
    description: 'Payment or decision commitment date passed without closure.',
    icon: BellRing,
    tone: 'rose'
  },
  renewalRisk: {
    label: 'Renewal Risk',
    description: 'Upcoming service or contract renewals without follow-up.',
    icon: Zap,
    tone: 'amber'
  },
  assignmentRisk: {
    label: 'Assignment Risk',
    description: 'Recently assigned leads not yet contacted within target SLA.',
    icon: AlertTriangle,
    tone: 'rose'
  }
};

function AttentionView({ data, loading, onCreate, onAction }) {
  const navigate = useNavigate();
  const [filterMode, setFilterMode] = useState('issues'); // 'issues' | 'all'

  if (loading) return <Skeleton className="h-96 rounded-2xl" />;

  const categories = Object.entries(data?.categories || {});
  const totalIssues = categories.reduce((sum, [, rows]) => sum + (rows?.length || 0), 0);
  const categoriesWithIssues = categories.filter(([, rows]) => rows?.length > 0);
  const displayedCategories = filterMode === 'issues' && categoriesWithIssues.length > 0 ? categoriesWithIssues : categories;

  return (
    <div className="space-y-4">
      {/* Top Risk Health Summary Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-2xl shrink-0 shadow-2xs",
            totalIssues > 0 ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          )}>
            {totalIssues > 0 ? <ShieldAlert size={20} /> : <CheckCircle2 size={20} />}
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-[var(--text-main)] flex items-center gap-2">
              <span>Risk & Dropout Prevention Center</span>
              <span className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold border",
                totalIssues > 0
                  ? "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  : "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              )}>
                {totalIssues > 0 ? `${totalIssues} Items Need Action` : 'All Queues Healthy'}
              </span>
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Automated anomaly detection for unassigned leads, stalled deals, overdue follow-ups and missing next actions.
            </p>
          </div>
        </div>

        {/* Filter Switcher */}
        <div className="flex items-center gap-1.5 self-end sm:self-center bg-[var(--surface-2)] p-1 rounded-xl border border-[var(--border)] shrink-0">
          <button
            type="button"
            onClick={() => setFilterMode('issues')}
            className={cn(
              "px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer select-none",
              filterMode === 'issues'
                ? "bg-[var(--surface)] text-[var(--text-main)] font-bold shadow-2xs"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
            )}
          >
            Issues Only ({categoriesWithIssues.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={cn(
              "px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer select-none",
              filterMode === 'all'
                ? "bg-[var(--surface)] text-[var(--text-main)] font-bold shadow-2xs"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
            )}
          >
            All Categories ({categories.length})
          </button>
        </div>
      </div>

      {/* Grid of Risk Cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        {displayedCategories.map(([key, rows]) => {
          const config = ATTENTION_CATEGORY_CONFIG[key] || {
            label: key,
            description: 'Records requiring review and action.',
            icon: CircleAlert,
            tone: 'slate'
          };
          const Icon = config.icon;
          const hasItems = rows && rows.length > 0;

          const toneClasses = {
            rose: { bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400', badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
            amber: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
            violet: { bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400', badge: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20' },
            blue: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' }
          }[config.tone] || { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400', badge: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' };

          return (
            <div
              key={key}
              className={cn(
                "rounded-2xl border bg-[var(--surface)] p-4 shadow-2xs transition-all flex flex-col justify-between",
                hasItems ? "border-[var(--border)] hover:shadow-xs" : "border-[var(--border)]/70 opacity-80"
              )}
            >
              <div>
                {/* Category Header */}
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span className={cn("flex h-8.5 w-8.5 items-center justify-center rounded-xl shrink-0 mt-0.5", toneClasses.bg, toneClasses.text)}>
                      <Icon size={16} />
                    </span>
                    <div>
                      <h3 className="font-bold text-sm text-[var(--text-main)] leading-tight">{config.label}</h3>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">{config.description}</p>
                    </div>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold border shrink-0", hasItems ? toneClasses.badge : "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400")}>
                    {rows.length}
                  </span>
                </div>

                {/* Items List */}
                <div className="space-y-2">
                  {rows.slice(0, 8).map((row, rIdx) => {
                    const entityId = row.entityId || row.relatedEntityId || row.id;
                    const entityType = row.entityType || row.relatedEntityType || 'Lead';
                    const entityLabel = row.relatedEntityLabel || row.label || row.title || row.follow_up_number || `Record #${entityId}`;
                    const leadLink = ['Lead', 'lead'].includes(entityType) && entityId ? `/app/leads/${entityId}` : '';

                    return (
                      <div
                        key={row.id || `${entityType}-${entityId}-${rIdx}`}
                        className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-2)]/50 hover:bg-[var(--surface-2)] p-2.5 border border-[var(--border-muted)] transition-colors group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {leadLink ? (
                              <button
                                type="button"
                                onClick={() => navigate(leadLink)}
                                className="truncate text-xs font-bold text-[var(--text-main)] hover:text-[var(--primary)] text-left transition cursor-pointer flex items-center gap-1"
                                title="Open Lead Profile"
                              >
                                <span>{entityLabel}</span>
                                <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--primary)] shrink-0" />
                              </button>
                            ) : (
                              <p className="truncate text-xs font-bold text-[var(--text-main)]">{entityLabel}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--text-muted)]">
                            <span className="inline-flex items-center gap-1 font-medium">
                              <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]/60" />
                              {entityType}
                            </span>
                            {row.status ? <span>· {row.status}</span> : null}
                            {row.value ? <span className="font-semibold text-emerald-600 dark:text-emerald-400">· ₹{Number(row.value).toLocaleString('en-IN')}</span> : null}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {entityId ? (
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => onCreate({
                                relatedEntityType: entityType,
                                relatedEntityId: entityId,
                                relatedEntityLabel: entityLabel,
                                title: `${config.label} follow-up`,
                                priority: key.includes('Risk') || key === 'promiseDateMissed' ? 'Critical' : 'High'
                              })}
                              className="!rounded-lg h-6.5 px-2 text-[11px] font-semibold cursor-pointer shadow-2xs hover:border-[var(--primary)] hover:text-[var(--primary)]"
                            >
                              <Plus size={11} className="mr-0.5" />
                              Schedule
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}

                  {!rows.length ? (
                    <div className="py-4 text-center text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 rounded-xl border border-emerald-500/10 flex items-center justify-center gap-1.5">
                      <CheckCircle2 size={13} />
                      <span>Queue clear · No issues in this category</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WorkloadView({ data, loading, onSelectAssignee }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'overdue' | 'top' | 'light'
  const [sortBy, setSortBy] = useState('assigned'); // 'assigned' | 'overdue' | 'completion'

  if (loading) return <Skeleton className="h-96 rounded-2xl" />;

  const rawAssignees = Object.entries(data?.byAssignee || {});
  
  // Calculate summary metrics
  const totalMembers = rawAssignees.length;
  const totalAssigned = rawAssignees.reduce((sum, [, v]) => sum + (v.total || 0), 0);
  const totalCompleted = rawAssignees.reduce((sum, [, v]) => sum + (v.completed || 0), 0);
  const totalOverdue = rawAssignees.reduce((sum, [, v]) => sum + (v.overdue || 0), 0);
  const avgCompletionRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;

  // Filter & Sort
  const processedAssignees = rawAssignees
    .map(([name, values]) => {
      const total = values.total || 0;
      const completed = values.completed || 0;
      const overdue = values.overdue || 0;
      const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
      const pending = Math.max(0, total - completed);

      let status = 'Balanced';
      let statusTone = 'blue';
      if (overdue >= 3) {
        status = 'High Risk';
        statusTone = 'rose';
      } else if (rate >= 75 && total >= 5) {
        status = 'Top Performer';
        statusTone = 'emerald';
      } else if (total < 5) {
        status = 'Available';
        statusTone = 'violet';
      }

      return {
        name,
        total,
        completed,
        overdue,
        pending,
        rate,
        status,
        statusTone
      };
    })
    .filter((item) => {
      if (search.trim() && !item.name.toLowerCase().includes(search.toLowerCase().trim())) return false;
      if (filter === 'overdue' && item.overdue === 0) return false;
      if (filter === 'top' && item.rate < 70) return false;
      if (filter === 'light' && item.total >= 5) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'overdue') return b.overdue - a.overdue;
      if (sortBy === 'completion') return b.rate - a.rate;
      return b.total - a.total;
    });

  return (
    <div className="space-y-4">
      {/* Top Team Workload KPI Banner */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <UsersRound size={20} />
            </span>
            <div>
              <p className="text-xs text-[var(--text-muted)] font-medium">Team Size</p>
              <h3 className="text-lg font-bold text-[var(--text-main)]">{totalMembers} Members</h3>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <LayoutList size={20} />
            </span>
            <div>
              <p className="text-xs text-[var(--text-muted)] font-medium">Total Workload</p>
              <h3 className="text-lg font-bold text-[var(--text-main)]">{totalAssigned} Tasks</h3>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={20} />
            </span>
            <div>
              <p className="text-xs text-[var(--text-muted)] font-medium">Team Completion</p>
              <h3 className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{avgCompletionRate}%</h3>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <AlertTriangle size={20} />
            </span>
            <div>
              <p className="text-xs text-[var(--text-muted)] font-medium">Team Overdue</p>
              <h3 className="text-lg font-bold text-rose-600 dark:text-rose-400">{totalOverdue} Tasks</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Main Workload Card */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-0 overflow-hidden shadow-2xs">
        {/* Controls Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] p-3.5 px-4 bg-[var(--surface)]">
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <div className="relative w-full">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search team member..."
                className="w-full h-8.5 pl-8.5 pr-3 text-xs rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/50 text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/15"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-[var(--surface-2)] p-1 rounded-xl border border-[var(--border)]">
              {[
                { id: 'all', label: 'All' },
                { id: 'overdue', label: 'Overdue (>0)' },
                { id: 'top', label: 'Top (≥70%)' },
                { id: 'light', label: 'Available (<5)' }
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "px-2.5 py-1 text-[11px] font-semibold rounded-lg transition cursor-pointer select-none",
                    filter === f.id
                      ? "bg-[var(--surface)] text-[var(--text-main)] font-bold shadow-2xs"
                      : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--text-main)] px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--primary)] cursor-pointer"
            >
              <option value="assigned">Sort: Most Tasks</option>
              <option value="overdue">Sort: Most Overdue</option>
              <option value="completion">Sort: Highest Rate</option>
            </select>
          </div>
        </div>

        {/* Workload List */}
        <div className="divide-y divide-[var(--border-muted)]">
          {processedAssignees.map((emp) => {
            const initials = emp.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase() || 'EM';

            const completedWidth = emp.total > 0 ? (emp.completed / emp.total) * 100 : 0;
            const overdueWidth = emp.total > 0 ? (emp.overdue / emp.total) * 100 : 0;
            const pendingWidth = Math.max(0, 100 - completedWidth - overdueWidth);

            const statusBadgeClasses = {
              rose: 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400',
              emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
              violet: 'border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400',
              blue: 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400'
            }[emp.statusTone];

            return (
              <div
                key={emp.name}
                className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 hover:bg-[var(--hover-bg)] transition-colors group"
              >
                {/* Member Info */}
                <div className="flex items-center gap-3 min-w-[220px]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs shrink-0 border border-blue-500/20 shadow-2xs">
                    {initials}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-[var(--text-main)]">{emp.name}</h4>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold border", statusBadgeClasses)}>
                        {emp.status}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {emp.total} total follow-ups assigned
                    </p>
                  </div>
                </div>

                {/* Progress Bar & Breakdown */}
                <div className="flex-1 max-w-md space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-[var(--text-muted)] font-medium flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" /> {emp.completed} Completed
                      <span className="h-2 w-2 rounded-full bg-rose-500 ml-1.5" /> {emp.overdue} Overdue
                      <span className="h-2 w-2 rounded-full bg-blue-500 ml-1.5" /> {emp.pending} Pending
                    </span>
                    <span className="font-bold text-[var(--text-main)]">{emp.rate}% Done</span>
                  </div>

                  {/* Multi-segment Progress Bar */}
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)] flex shadow-inner">
                    <div
                      style={{ width: `${completedWidth}%` }}
                      className="h-full bg-emerald-500 transition-all duration-300"
                      title={`${emp.completed} completed (${Math.round(completedWidth)}%)`}
                    />
                    <div
                      style={{ width: `${overdueWidth}%` }}
                      className="h-full bg-rose-500 transition-all duration-300"
                      title={`${emp.overdue} overdue (${Math.round(overdueWidth)}%)`}
                    />
                    <div
                      style={{ width: `${pendingWidth}%` }}
                      className="h-full bg-blue-500/70 transition-all duration-300"
                      title={`${emp.pending} pending (${Math.round(pendingWidth)}%)`}
                    />
                  </div>
                </div>

                {/* Action button to view tasks */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSelectAssignee?.(emp.name)}
                    className="!rounded-xl h-8 px-3 text-xs font-semibold cursor-pointer shadow-2xs hover:border-[var(--primary)] hover:text-[var(--primary)]"
                  >
                    <span>View Tasks</span>
                    <ArrowRight size={13} className="ml-1 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                </div>
              </div>
            );
          })}

          {!processedAssignees.length && (
            <div className="p-8 text-center text-xs text-[var(--text-muted)]">
              No team members match the selected filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getDistributionConfig(type, label) {
  const l = String(label).toLowerCase();
  
  if (type === 'type') {
    if (l.includes('whatsapp')) return { color: '#10b981', icon: MessageCircle, tone: 'emerald' };
    if (l.includes('call') || l.includes('phone')) return { color: '#2563eb', icon: Phone, tone: 'blue' };
    if (l.includes('meeting') || l.includes('in-person')) return { color: '#8b5cf6', icon: UsersRound, tone: 'violet' };
    if (l.includes('email') || l.includes('mail')) return { color: '#f59e0b', icon: Mail, tone: 'amber' };
    return { color: 'var(--primary)', icon: LayoutList, tone: 'primary' };
  }

  if (type === 'priority') {
    if (l.includes('critical')) return { color: '#e11d48', tone: 'rose' };
    if (l.includes('high')) return { color: '#f59e0b', tone: 'amber' };
    if (l.includes('medium')) return { color: '#2563eb', tone: 'blue' };
    if (l.includes('low')) return { color: '#64748b', tone: 'slate' };
  }

  if (type === 'status') {
    if (l.includes('completed') || l.includes('done')) return { color: '#10b981', tone: 'emerald' };
    if (l.includes('overdue') || l.includes('escalated') || l.includes('failed')) return { color: '#e11d48', tone: 'rose' };
    if (l.includes('in progress') || l.includes('working')) return { color: '#0284c7', tone: 'sky' };
    if (l.includes('waiting')) return { color: '#8b5cf6', tone: 'violet' };
    if (l.includes('due today')) return { color: '#2563eb', tone: 'blue' };
    return { color: '#64748b', tone: 'slate' };
  }

  if (type === 'outcome') {
    if (l.includes('interest') || l.includes('convert') || l.includes('fix') || l.includes('clos') || l.includes('sent') || l.includes('complet')) {
      return { color: '#10b981', tone: 'emerald' };
    }
    if (l.includes('resched') || l.includes('call back') || l.includes('budget') || l.includes('follow')) {
      return { color: '#f59e0b', tone: 'amber' };
    }
    if (l.includes('not') || l.includes('no response') || l.includes('lost') || l.includes('cancel')) {
      return { color: '#e11d48', tone: 'rose' };
    }
  }

  return { color: 'var(--primary)', tone: 'primary' };
}

function Distribution({ title, data = {}, type = 'generic' }) {
  const rows = Object.entries(data || {}).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((sum, [, val]) => sum + Number(val || 0), 0);
  const max = Math.max(1, ...rows.map(([, value]) => Number(value || 0)));

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3 border-b border-[var(--border-muted)] pb-2.5">
          <h3 className="font-bold text-sm text-[var(--text-main)]">{title}</h3>
          <span className="text-xs font-semibold text-[var(--text-muted)]">{total} Total</span>
        </div>

        <div className="space-y-3">
          {rows.map(([label, value]) => {
            const count = Number(value || 0);
            const percent = total > 0 ? Math.round((count / total) * 100) : 0;
            const config = getDistributionConfig(type, label);
            const Icon = config.icon;

            return (
              <div key={label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-main)] font-semibold flex items-center gap-1.5">
                    {Icon ? <Icon size={13} style={{ color: config.color }} /> : <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: config.color }} />}
                    <span>{label}</span>
                  </span>
                  <span className="font-bold text-[var(--text-main)] flex items-center gap-1.5">
                    <span>{count}</span>
                    <span className="text-[11px] font-medium text-[var(--text-muted)]">({percent}%)</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.max(3, (count / max) * 100)}%`,
                      backgroundColor: config.color
                    }}
                  />
                </div>
              </div>
            );
          })}

          {!rows.length ? <p className="py-6 text-center text-xs text-[var(--text-muted)]">No data recorded yet.</p> : null}
        </div>
      </div>
    </div>
  );
}

function AnalyticsView({ data, loading }) {
  if (loading) return <Skeleton className="h-96 rounded-2xl" />;

  const topChannel = Object.entries(data?.byType || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Phone Call';
  const totalCompleted = data?.completed || 0;
  const completionRate = data?.completionRate || 0;

  return (
    <div className="space-y-4">
      {/* 5 KPI Metric Cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Total Volume" value={data?.total} helper="Cumulative tasks" icon={LayoutList} tone="blue" />
        <Metric label="Completion Rate" value={data?.completed} helper={`${completionRate}% closed`} icon={CheckCircle2} tone="emerald" />
        <Metric label="Avg Overdue" value={data?.overdue} helper={`${data?.averageOverdueHours || 0} avg hours`} icon={AlertTriangle} tone="rose" />
        <Metric label="Critical Risk" value={data?.critical} helper="Priority risk" icon={Flame} tone="amber" />
        <Metric label="Unassigned Gap" value={data?.unassigned} helper="Needs ownership" icon={UserRound} tone="violet" />
      </div>

      {/* Intelligence Highlights Banner */}
      <div className="grid gap-3 sm:grid-cols-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
        <div className="flex items-center gap-3 p-1">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs shrink-0">
            <Zap size={16} />
          </span>
          <div>
            <p className="text-[11px] font-medium text-[var(--text-muted)]">Preferred Channel</p>
            <h4 className="text-xs sm:text-sm font-bold text-[var(--text-main)]">{topChannel}</h4>
          </div>
        </div>

        <div className="flex items-center gap-3 p-1">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs shrink-0">
            <CheckCircle2 size={16} />
          </span>
          <div>
            <p className="text-[11px] font-medium text-[var(--text-muted)]">Closure Velocity</p>
            <h4 className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">{completionRate}% Completed</h4>
          </div>
        </div>

        <div className="flex items-center gap-3 p-1">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-xs shrink-0">
            <AlertTriangle size={16} />
          </span>
          <div>
            <p className="text-[11px] font-medium text-[var(--text-muted)]">Recovery Backlog</p>
            <h4 className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400">{data?.overdue || 0} Overdue Tasks</h4>
          </div>
        </div>
      </div>

      {/* 4 Thematic Distribution Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Distribution title="Status Distribution" data={data?.byStatus} type="status" />
        <Distribution title="Outcome & Result Breakdown" data={data?.byOutcome} type="outcome" />
        <Distribution title="Priority Breakdown" data={data?.byPriority} type="priority" />
        <Distribution title="Communication Channel Effectiveness" data={data?.byType} type="type" />
      </div>
    </div>
  );
}

function AutomationView({ options, onRefresh }) {
  const { token, hasPermission } = useAuth();
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState({ kind: '', record: null });
  const [activeCategory, setActiveCategory] = useState('all'); // 'all' | 'template' | 'sequence' | 'automation' | 'escalation'

  const sequences = options.sequences || [];
  const templates = options.templates || [];
  const automationRules = options.automationRules || [];
  const escalationRules = options.escalationRules || [];

  const totalTemplates = templates.length;
  const totalSequences = sequences.length;
  const totalRules = automationRules.length;
  const totalEscalations = escalationRules.length;

  async function run() {
    setBusy(true);
    try {
      const response = await api.followUps.runAutomation(token);
      toast.success(`Processed ${response.data.remindersSent} reminders and ${response.data.escalations} escalations`);
      onRefresh();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Automation KPI Strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Mail size={18} />
            </span>
            <div>
              <p className="text-xs text-[var(--text-muted)] font-medium">Templates</p>
              <h3 className="text-lg font-bold text-[var(--text-main)]">{totalTemplates} Pre-saved</h3>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Workflow size={18} />
            </span>
            <div>
              <p className="text-xs text-[var(--text-muted)] font-medium">Drip Sequences</p>
              <h3 className="text-lg font-bold text-[var(--text-main)]">{totalSequences} Sequences</h3>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Zap size={18} />
            </span>
            <div>
              <p className="text-xs text-[var(--text-muted)] font-medium">Event Triggers</p>
              <h3 className="text-lg font-bold text-[var(--text-main)]">{totalRules} Active Rules</h3>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <ShieldAlert size={18} />
            </span>
            <div>
              <p className="text-xs text-[var(--text-muted)] font-medium">Escalation Policies</p>
              <h3 className="text-lg font-bold text-[var(--text-main)]">{totalEscalations} Policies</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Automation Control Header */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-sm sm:text-base text-[var(--text-main)] flex items-center gap-2">
            <span>Automation Control & Workflow Engine</span>
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Idempotent reminder triggers, escalation policies, sequence chains and payment-promise monitoring.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-center">
          {hasPermission('followups.manage_automation') ? (
            <Button
              onClick={run}
              disabled={busy}
              className="!rounded-xl h-8.5 px-3.5 text-xs font-semibold cursor-pointer shadow-2xs bg-[var(--primary)] text-white hover:brightness-105"
            >
              {busy ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Sparkles size={14} className="mr-1.5" />}
              Run Cycle Now
            </Button>
          ) : null}
        </div>
      </div>

      {/* Module Filter Switcher */}
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-2xs">
        {[
          { id: 'all', label: 'All Modules', count: totalTemplates + totalSequences + totalRules + totalEscalations },
          { id: 'template', label: 'Templates', count: totalTemplates },
          { id: 'sequence', label: 'Sequences', count: totalSequences },
          { id: 'automation', label: 'Automation Rules', count: totalRules },
          { id: 'escalation', label: 'Escalation Rules', count: totalEscalations }
        ].map((tab) => {
          const active = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCategory(tab.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer select-none",
                active
                  ? "bg-[var(--primary)] text-white shadow-2xs font-bold"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]"
              )}
            >
              <span>{tab.label}</span>
              <span className={cn(
                "inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-extrabold leading-none",
                active ? "bg-white/25 text-white" : "bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)]"
              )}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Grid of Automation Modules */}
      <div className="grid gap-4 lg:grid-cols-2">
        {(activeCategory === 'all' || activeCategory === 'template') && (
          <ConfigList
            title="Templates"
            description="Pre-formatted follow-up titles and types for one-click scheduling."
            icon={Mail}
            tone="blue"
            rows={templates}
            empty="No templates configured"
            canManage={hasPermission('followups.manage_templates')}
            onCreate={() => setEditor({ kind: 'template', record: null })}
            onEdit={(record) => setEditor({ kind: 'template', record })}
          />
        )}

        {(activeCategory === 'all' || activeCategory === 'sequence') && (
          <ConfigList
            title="Sequences"
            description="Multi-step drip follow-up chains that execute on automated schedules."
            icon={Workflow}
            tone="violet"
            rows={sequences}
            empty="No sequences configured"
            canManage={hasPermission('followups.manage_sequences')}
            onCreate={() => setEditor({ kind: 'sequence', record: null })}
            onEdit={(record) => setEditor({ kind: 'sequence', record })}
            renderMeta={(row) => `${row.trigger_key || row.triggerKey} · ${row.steps?.length || 0} steps · v${row.version || 1}`}
          />
        )}

        {(activeCategory === 'all' || activeCategory === 'automation') && (
          <ConfigList
            title="Automation Rules"
            description="Event-triggered rules that automatically schedule follow-up actions."
            icon={Zap}
            tone="emerald"
            rows={automationRules}
            empty="No automation rules configured"
            canManage={hasPermission('followups.manage_automation')}
            onCreate={() => setEditor({ kind: 'automation', record: null })}
            onEdit={(record) => setEditor({ kind: 'automation', record })}
            renderMeta={(row) => `When ${row.trigger_key || row.triggerKey || 'manual'} · priority ${row.priority || 100}`}
          />
        )}

        {(activeCategory === 'all' || activeCategory === 'escalation') && (
          <ConfigList
            title="Escalation Rules"
            description="Auto-escalation policies that alert managers when follow-ups are overdue."
            icon={ShieldAlert}
            tone="rose"
            rows={escalationRules}
            empty="No escalation rules configured"
            canManage={hasPermission('followups.manage_escalations')}
            onCreate={() => setEditor({ kind: 'escalation', record: null })}
            onEdit={(record) => setEditor({ kind: 'escalation', record })}
            renderMeta={(row) => `${(row.levels || []).length} escalation levels configured`}
          />
        )}
      </div>

      <ConfigEditorModal
        open={Boolean(editor.kind)}
        kind={editor.kind}
        record={editor.record}
        onClose={() => setEditor({ kind: '', record: null })}
        onSaved={() => { setEditor({ kind: '', record: null }); onRefresh(); }}
      />
    </div>
  );
}

function ConfigList({ title, description, icon: Icon = LayoutList, tone = 'blue', rows, empty, renderMeta, canManage = false, onCreate, onEdit }) {
  const toneClasses = {
    rose: { bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400' },
    violet: { bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' }
  }[tone] || { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400' };

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs flex flex-col justify-between">
      <div>
        <div className="mb-3 flex items-start justify-between gap-3 border-b border-[var(--border-muted)] pb-3">
          <div className="flex items-start gap-2.5">
            <span className={cn("flex h-8.5 w-8.5 items-center justify-center rounded-xl shrink-0 mt-0.5", toneClasses.bg, toneClasses.text)}>
              <Icon size={16} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-[var(--text-main)]">{title}</h3>
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-main)] px-2 py-0.5 text-[10px] font-bold">
                  {rows.length}
                </span>
              </div>
              {description ? <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{description}</p> : null}
            </div>
          </div>
          {canManage ? (
            <Button size="xs" variant="outline" onClick={onCreate} className="!rounded-xl h-7 px-2.5 text-xs font-semibold cursor-pointer shadow-2xs">
              <Plus size={12} className="mr-1" /> New
            </Button>
          ) : null}
        </div>

        <div className="space-y-2">
          {rows.map((row) => (
            <button
              type="button"
              onClick={() => canManage && onEdit?.(row)}
              key={row.id}
              className="block w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left transition hover:bg-[var(--surface-2)] hover:border-[var(--primary)]/40 cursor-pointer shadow-2xs group"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-xs sm:text-sm text-[var(--text-main)] group-hover:text-[var(--primary)] transition">
                  {row.name}
                </p>
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold border shrink-0",
                  row.is_active === false || row.isActive === false
                    ? "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]"
                    : "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                )}>
                  {row.is_active === false || row.isActive === false ? 'Inactive' : 'Active'}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {renderMeta ? renderMeta(row) : `${row.category || 'General'} · ${row.follow_up_type || row.followUpType || ''}`}
              </p>
            </button>
          ))}
          {!rows.length ? <p className="py-6 text-center text-xs text-[var(--text-muted)]">{empty}</p> : null}
        </div>
      </div>
    </div>
  );
}

function ConfigEditorModal({ open, kind, record, onClose, onSaved }) {
  const { token } = useAuth();
  const [form, setForm] = useState({ name: '', description: '', category: 'General', followUpType: 'Call', defaultTitle: '', defaultPriority: 'Medium', triggerKey: 'manual', applicableEntityType: 'Quotation', priority: 100, conditionsText: '{}', actionsText: '[]', levelsText: '[]', isActive: true, steps: [] });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      name: record?.name || '', description: record?.description || '', category: record?.category || 'General',
      followUpType: record?.follow_up_type || record?.followUpType || 'Call', defaultTitle: record?.default_title || record?.defaultTitle || '',
      defaultPriority: record?.default_priority || record?.defaultPriority || 'Medium', triggerKey: record?.trigger_key || record?.triggerKey || 'quotation_sent',
      applicableEntityType: record?.applicable_entity_type || record?.applicableEntityType || 'Quotation', isActive: record?.is_active !== false && record?.isActive !== false,
      priority: Number(record?.priority || 100), conditionsText: JSON.stringify(record?.conditions || {}, null, 2),
      actionsText: JSON.stringify(record?.actions || [], null, 2), levelsText: JSON.stringify(record?.levels || [], null, 2),
      steps: (record?.steps || []).map((step) => ({ id: step.id, name: step.name || '', delayHours: Number(step.delay_minutes || step.delayMinutes || 0) / 60, actionType: step.action_type || step.actionType || 'create_follow_up', followUpType: step.follow_up_type || step.followUpType || 'Call', titleTemplate: step.title_template || step.titleTemplate || '' }))
    });
  }, [open, record]);

  function set(key, value) { setForm((current) => ({ ...current, [key]: value })); }
  function updateStep(index, key, value) { setForm((current) => ({ ...current, steps: current.steps.map((step, stepIndex) => stepIndex === index ? { ...step, [key]: value } : step) })); }

  async function save(event) {
    event.preventDefault();
    if (!form.name.trim()) return toast.error('Name is required');
    setBusy(true);
    try {
      const paths = { template: '/follow-up-templates', sequence: '/follow-up-sequences', automation: '/follow-up-automation-rules', escalation: '/follow-up-escalation-rules' };
      const path = paths[kind];
      let payload = form;
      if (kind === 'sequence') payload = { ...form, steps: form.steps.map((step, index) => ({ ...step, stepOrder: index + 1, delayMinutes: Math.max(0, Number(step.delayHours || 0) * 60) })) };
      if (kind === 'automation') payload = { ...form, conditions: JSON.parse(form.conditionsText || '{}'), actions: JSON.parse(form.actionsText || '[]'), priority: Number(form.priority || 100) };
      if (kind === 'escalation') payload = { ...form, conditions: JSON.parse(form.conditionsText || '{}'), levels: JSON.parse(form.levelsText || '[]') };
      if (record?.id) await api.followUps.updateConfig(token, path, record.id, payload);
      else await api.followUps.createConfig(token, path, payload);
      toast.success(`${kind[0].toUpperCase()}${kind.slice(1)} saved`);
      onSaved();
    } catch (error) { toast.error(error instanceof SyntaxError ? 'Conditions, actions and levels must be valid JSON' : error.message || 'Unable to save configuration'); }
    finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={`${record ? 'Edit' : 'New'} ${kind}`} width="min(760px, 96vw)" footer={<div className="flex justify-end gap-3"><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="config-editor-form" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin mr-1.5" />}Save</Button></div>}>
      <form id="config-editor-form" onSubmit={save} className="grid gap-4 md:grid-cols-2">
        <label className="text-xs font-semibold text-[var(--text-main)]">Name<Input className="mt-1.5" value={form.name} onChange={(event) => set('name', event.target.value)} /></label>
        <label className="text-xs font-semibold text-[var(--text-main)]">Active<span className="mt-3 flex items-center gap-2 text-sm font-normal"><input type="checkbox" checked={form.isActive} onChange={(event) => set('isActive', event.target.checked)} />Available for use</span></label>
        <label className="md:col-span-2 text-xs font-semibold text-[var(--text-main)]">Description<Textarea className="mt-1.5" value={form.description} onChange={(event) => set('description', event.target.value)} rows={2} /></label>
        {kind === 'template' ? (
          <>
            <label className="text-xs font-semibold text-[var(--text-main)]">Category<Input className="mt-1.5" value={form.category} onChange={(event) => set('category', event.target.value)} /></label>
            <label className="text-xs font-semibold text-[var(--text-main)]">Type<Input className="mt-1.5" value={form.followUpType} onChange={(event) => set('followUpType', event.target.value)} /></label>
            <label className="md:col-span-2 text-xs font-semibold text-[var(--text-main)]">Default title<Input className="mt-1.5" value={form.defaultTitle} onChange={(event) => set('defaultTitle', event.target.value)} /></label>
          </>
        ) : null}
        {kind === 'sequence' ? (
          <>
            <label className="text-xs font-semibold text-[var(--text-main)]">Trigger<Input className="mt-1.5" value={form.triggerKey} onChange={(event) => set('triggerKey', event.target.value)} /></label>
            <label className="text-xs font-semibold text-[var(--text-main)]">Entity type<Input className="mt-1.5" value={form.applicableEntityType} onChange={(event) => set('applicableEntityType', event.target.value)} /></label>
            <div className="md:col-span-2 rounded-2xl border border-[var(--border)] p-4 bg-[var(--surface-2)]/30">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-[var(--text-main)]">Sequence steps</h4>
                  <p className="text-xs text-[var(--text-muted)]">Ordered delays are measured from the previous step.</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => set('steps', [...form.steps, { name: `Step ${form.steps.length + 1}`, delayHours: 24, actionType: 'create_follow_up', followUpType: 'Call', titleTemplate: '' }])} className="!rounded-xl cursor-pointer"><Plus size={14} className="mr-1" />Step</Button>
              </div>
              <div className="mt-3 space-y-3">
                {form.steps.map((step, index) => (
                  <div key={step.id || index} className="grid gap-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] p-3 md:grid-cols-[1fr_100px_150px_auto]">
                    <Input value={step.name} onChange={(event) => updateStep(index, 'name', event.target.value)} placeholder="Step name" />
                    <Input type="number" min="0" value={step.delayHours} onChange={(event) => updateStep(index, 'delayHours', event.target.value)} title="Delay hours" />
                    <Select value={step.actionType} onChange={(value) => updateStep(index, 'actionType', value)} options={[{ value: 'create_follow_up', label: 'Create follow-up' }, { value: 'escalate', label: 'Escalate' }]} />
                    <Button type="button" variant="outline" size="sm" onClick={() => set('steps', form.steps.filter((_, stepIndex) => stepIndex !== index))} className="!rounded-xl cursor-pointer">Remove</Button>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
        {kind === 'automation' ? (
          <>
            <label className="text-xs font-semibold text-[var(--text-main)]">When (trigger)<Input className="mt-1.5" value={form.triggerKey} onChange={(event) => set('triggerKey', event.target.value)} placeholder="lead_created" /></label>
            <label className="text-xs font-semibold text-[var(--text-main)]">Execution priority<Input className="mt-1.5" type="number" value={form.priority} onChange={(event) => set('priority', event.target.value)} /></label>
            <label className="md:col-span-2 text-xs font-semibold text-[var(--text-main)]">Conditions (JSON object)<Textarea className="mt-1.5 font-mono text-xs" value={form.conditionsText} onChange={(event) => set('conditionsText', event.target.value)} rows={5} /></label>
            <label className="md:col-span-2 text-xs font-semibold text-[var(--text-main)]">Actions (JSON array)<Textarea className="mt-1.5 font-mono text-xs" value={form.actionsText} onChange={(event) => set('actionsText', event.target.value)} rows={6} /></label>
          </>
        ) : null}
        {kind === 'escalation' ? (
          <>
            <label className="md:col-span-2 text-xs font-semibold text-[var(--text-main)]">Conditions (JSON object)<Textarea className="mt-1.5 font-mono text-xs" value={form.conditionsText} onChange={(event) => set('conditionsText', event.target.value)} rows={5} /></label>
            <label className="md:col-span-2 text-xs font-semibold text-[var(--text-main)]">Escalation levels (JSON array)<Textarea className="mt-1.5 font-mono text-xs" value={form.levelsText} onChange={(event) => set('levelsText', event.target.value)} rows={7} /></label>
          </>
        ) : null}
      </form>
    </Modal>
  );
}

function ActivityViewModal({ item, open, onClose, onComplete, onEdit, onViewLead }) {
  if (!item) return null;
  const isCompleted = item.status === 'Completed' || item.status === 'Auto-Closed';
  const leadRoute = entityRoute(item);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={(
        <div className="flex flex-wrap items-center gap-2">
          {renderPriorityPill(item.priority)}
          {renderStatusPill(item.effectiveStatus || item.status)}
          <span className="text-xs font-mono text-[var(--text-muted)] bg-[var(--surface-2)] border border-[var(--border)] px-2 py-0.5 rounded-full">
            {item.followUpNumber}
          </span>
          <div className="w-full mt-1">
            <span className="truncate max-w-full font-bold text-base text-[var(--text-main)] block">
              {item.title}
            </span>
          </div>
        </div>
      )}
      width="min(640px, 96vw)"
      footer={(
        <div className="flex flex-wrap justify-between items-center gap-2 w-full">
          <div className="flex flex-wrap items-center gap-2">
            {!isCompleted && onComplete ? (
              <Button
                size="sm"
                onClick={() => {
                  onClose();
                  onComplete(item);
                }}
                className="!rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer shadow-xs"
              >
                <CheckCircle2 size={14} className="mr-1.5" />
                Complete Follow-Up
              </Button>
            ) : null}

            {onEdit ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onEdit(item);
                }}
                className="!rounded-xl cursor-pointer"
              >
                <Pencil size={14} className="mr-1.5" />
                Edit Follow-Up
              </Button>
            ) : null}

            {leadRoute && onViewLead ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onViewLead(leadRoute);
                }}
                className="!rounded-xl text-blue-600 dark:text-blue-400 border-blue-500/20 bg-blue-500/10 hover:bg-blue-500/20 cursor-pointer font-medium"
              >
                <ExternalLink size={14} className="mr-1.5" />
                View Lead Profile
              </Button>
            ) : null}
          </div>

          <Button variant="ghost" size="sm" onClick={onClose} className="!rounded-xl cursor-pointer">
            Close
          </Button>
        </div>
      )}
    >
      <div className="space-y-4 py-1">
        {/* Outcome / Remark Box if Completed */}
        {(item.actualOutcome || item.discussionNote) ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/30 p-3.5 space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
              Follow-Up Outcome / Remark ({item.actualOutcome || 'Completed'})
            </h4>
            <p className="text-xs text-emerald-950 dark:text-emerald-200 whitespace-pre-wrap leading-relaxed">
              {item.discussionNote || item.description}
            </p>
          </div>
        ) : null}

        {/* Structured Grid Info */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/40 p-4 space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[11px] font-medium text-[var(--text-muted)] block">👤 Related Record:</span>
              <span className="font-semibold text-[var(--text-main)] mt-0.5 block">
                {item.relatedEntityLabel || item.relatedEntityId} ({item.relatedEntityType || 'Lead'})
              </span>
            </div>

            <div>
              <span className="text-[11px] font-medium text-[var(--text-muted)] block">👤 Assignee:</span>
              <span className="font-semibold text-[var(--text-main)] mt-0.5 block">
                {item.assigneeName || 'Unassigned'}
              </span>
            </div>

            <div>
              <span className="text-[11px] font-medium text-[var(--text-muted)] block">📅 Scheduled Date & Time:</span>
              <span className="font-semibold text-[var(--text-main)] mt-0.5 block">
                {formatDateTime(item.dueAt)}
              </span>
            </div>

            <div>
              <span className="text-[11px] font-medium text-[var(--text-muted)] block">📞 Contact Phone:</span>
              <span className="font-semibold text-[var(--text-main)] mt-0.5 block">
                {item.relatedPhone || item.phone || item.mobile || '—'}
              </span>
            </div>

            <div>
              <span className="text-[11px] font-medium text-[var(--text-muted)] block">🎯 Purpose / Type:</span>
              <span className="font-semibold text-[var(--text-main)] mt-0.5 block">
                {item.purpose || item.followUpType || 'Call'}
              </span>
            </div>

            {item.location ? (
              <div>
                <span className="text-[11px] font-medium text-[var(--text-muted)] block">📍 Visit Location:</span>
                <span className="font-semibold text-[var(--text-main)] mt-0.5 block">
                  {item.location}
                </span>
              </div>
            ) : null}

            <div>
              <span className="text-[11px] font-medium text-[var(--text-muted)] block">⏩ Next Action:</span>
              <span className="font-semibold text-[var(--text-main)] mt-0.5 block">
                {item.nextAction || 'Not captured'}
              </span>
            </div>
          </div>
        </div>

        {/* Description / Notes */}
        {item.description && !item.description.startsWith('Remark:') && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 space-y-1">
            <span className="text-[11px] font-bold text-[var(--text-muted)] block">📝 Notes / Instructions:</span>
            <p className="text-xs text-[var(--text-main)] whitespace-pre-wrap leading-relaxed">
              {item.description}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[var(--text-main)]">{value}</p>
    </div>
  );
}

function MoreActionsModal({ item, open, onClose, onAction }) {
  return (
    <Modal open={open} onClose={onClose} title="More follow-up actions" subtitle={item?.followUpNumber} width="min(520px, 96vw)">
      <div className="grid gap-3 sm:grid-cols-2">
        <Button variant="outline" onClick={() => onAction('snooze', item)} className="!rounded-xl cursor-pointer"><BellRing size={16} className="mr-1.5" />Snooze with reason</Button>
        <Button variant="outline" onClick={() => onAction('escalate', item)} className="!rounded-xl cursor-pointer"><ShieldAlert size={16} className="mr-1.5" />Escalate</Button>
        <Button variant="outline" onClick={() => onAction('acknowledge', item)} className="!rounded-xl cursor-pointer"><CheckCircle2 size={16} className="mr-1.5" />Acknowledge reminder</Button>
        <Button variant="outline" onClick={() => onAction('edit', item)} className="!rounded-xl cursor-pointer"><Settings2 size={16} className="mr-1.5" />Edit follow-up</Button>
      </div>
    </Modal>
  );
}

function CompletedFollowUpsView({ options, onAction, onScheduleNext }) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState('all'); // 'today', 'yesterday', '1week', '1month', 'all', 'custom'
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    api.resources.list('/users/lookup', token)
      .then((res) => setUsers(res.data || []))
      .catch(() => {});
  }, [token]);

  const loadCompleted = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      let from, to;

      if (dateRange === 'today') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        from = start.toISOString();
        to = end.toISOString();
      } else if (dateRange === 'yesterday') {
        const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const start = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 0, 0, 0);
        const end = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 23, 59, 59, 999);
        from = start.toISOString();
        to = end.toISOString();
      } else if (dateRange === '1week') {
        const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        from = start.toISOString();
        to = now.toISOString();
      } else if (dateRange === '1month') {
        const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        from = start.toISOString();
        to = now.toISOString();
      } else if (dateRange === 'custom') {
        if (customFrom) from = new Date(`${customFrom}T00:00:00`).toISOString();
        if (customTo) to = new Date(`${customTo}T23:59:59.999`).toISOString();
      }

      const query = {
        status: 'Completed',
        limit: 100,
        from,
        to,
        assignedTo: selectedEmployee || undefined,
        search: debouncedSearch || undefined
      };

      const res = await api.followUps.list(token, query);
      setItems(res.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load completed follow-ups');
    } finally {
      setLoading(false);
    }
  }, [dateRange, customFrom, customTo, selectedEmployee, debouncedSearch, token]);

  useEffect(() => {
    loadCompleted();
  }, [loadCompleted]);

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-4 shadow-2xs">
        {/* Date Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: '1week', label: '1 Week' },
            { id: '1month', label: '1 Month' },
            { id: 'all', label: 'All Time' },
            { id: 'custom', label: 'Custom' }
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setDateRange(chip.id)}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer",
                dateRange === chip.id
                  ? "bg-emerald-600 text-white shadow-2xs font-bold"
                  : "bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-2)]/80"
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Custom Date Range Picker */}
        {dateRange === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[var(--border-muted)]">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs">
              <span className="font-semibold text-[var(--text-muted)]">From:</span>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="bg-transparent text-xs font-bold text-[var(--text-main)] outline-none cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs">
              <span className="font-semibold text-[var(--text-muted)]">To:</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="bg-transparent text-xs font-bold text-[var(--text-main)] outline-none cursor-pointer"
              />
            </div>
            {(customFrom || customTo) && (
              <button
                type="button"
                onClick={() => { setCustomFrom(''); setCustomTo(''); }}
                className="text-[11px] font-semibold text-rose-500 hover:text-rose-600 transition cursor-pointer underline"
              >
                Clear range
              </button>
            )}
          </div>
        )}

        {/* Employee Filter & Search Controls */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-[var(--border-muted)]">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            <input
              type="text"
              className="w-full h-9 pl-9 pr-3 text-xs rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/50 text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/40 transition"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lead name, phone, outcome or purpose..."
            />
          </div>

          <div className="w-[180px] sm:w-[220px]">
            <Select
              value={selectedEmployee}
              onChange={(val) => setSelectedEmployee(val)}
              options={[
                { value: '', label: 'All Employees' },
                ...users.map((u) => ({ value: u.id, label: u.name || u.full_name || u.email }))
              ]}
            />
          </div>

          <button
            type="button"
            onClick={loadCompleted}
            title="Refresh"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface)] transition cursor-pointer shrink-0"
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold ml-auto">
            <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
            <span>{items.length} Completed</span>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : items.length === 0 ? (
        <EmptyState
          title="No completed follow-ups found"
          description="There are no completed follow-up records matching your selected filters."
        />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const phone = item.relatedPhone || item.phone || item.mobile;
            const leadRoute = entityRoute(item);
            const leadName = item.relatedEntityLabel || item.companyName || 'Lead';
            const requirement = item.purpose || item.title || 'Follow-up discussion';
            const channel = item.followUpType || 'Phone Call';
            const outcomeNote = item.discussionNote || item.actualOutcome || item.description || 'Completed successfully';

            return (
              <div
                key={item.id}
                className="relative rounded-2xl border border-[var(--border)] border-l-4 border-l-emerald-500 bg-[var(--surface)] p-4 shadow-2xs hover:shadow-md transition-all duration-150 space-y-3"
              >
                {/* Top Row: Lead Name (with ↗) + Priority + Completed Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {leadRoute ? (
                      <button
                        type="button"
                        onClick={() => navigate(leadRoute)}
                        className="group inline-flex items-center gap-1 text-sm font-bold text-[var(--text-main)] hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer text-left truncate max-w-full"
                        title="View Lead Profile"
                      >
                        <span className="truncate">{leadName}</span>
                        <ExternalLink size={13} className="shrink-0 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition" />
                      </button>
                    ) : (
                      <span className="text-sm font-bold text-[var(--text-main)] truncate block">
                        {leadName}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {renderPriorityPill(item.priority, true)}
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      <CheckCircle2 size={11} className="text-emerald-600 dark:text-emerald-400" />
                      Completed
                    </span>
                  </div>
                </div>

                {/* Contact & Tags Row */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  {phone ? (
                    <a
                      href={`tel:${phone}`}
                      className="inline-flex items-center gap-1 font-medium text-[var(--text-main)] hover:text-emerald-600 transition"
                    >
                      <Phone size={12} className="text-[var(--text-muted)]" />
                      <span>{phone}</span>
                    </a>
                  ) : null}

                  {requirement ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)] truncate max-w-[160px]">
                      {requirement}
                    </span>
                  ) : null}

                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[11px] font-medium border border-emerald-500/20">
                    ✓ Contacted ({channel})
                  </span>
                </div>

                {/* Outcome Box (Green container) */}
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-50/60 dark:bg-emerald-950/20 p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
                    <span>✓ Completed</span>
                  </div>
                  <p className="text-xs text-emerald-950 dark:text-emerald-200/90 whitespace-pre-wrap leading-relaxed">
                    {outcomeNote}
                  </p>
                </div>

                {/* Metadata Row: Completed By + Timestamp */}
                <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-[var(--text-muted)]">
                  <div className="flex items-center gap-1 truncate min-w-0">
                    <UserRound size={12} className="shrink-0 text-[var(--text-muted)]" />
                    <span className="truncate">Completed by: <strong className="text-[var(--text-main)] font-semibold">{item.assigneeName || 'Team Member'}</strong></span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 font-medium">
                    <Clock3 size={12} className="text-[var(--text-muted)]" />
                    <span>{formatDateTime(item.updatedAt || item.dueAt)}</span>
                  </div>
                </div>

                {/* Action Buttons Row */}
                <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-muted)]">
                  {phone ? (
                    <button
                      type="button"
                      onClick={() => window.open(`tel:${phone}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-xl text-xs font-semibold bg-[var(--primary)] text-white hover:brightness-105 transition cursor-pointer shadow-2xs"
                    >
                      <Phone size={13} />
                      <span>Call</span>
                    </button>
                  ) : null}

                  {phone ? (
                    <button
                      type="button"
                      onClick={() => openDirectWhatsApp(item)}
                      className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition cursor-pointer shadow-2xs"
                    >
                      <MessageCircle size={13} />
                      <span>WhatsApp</span>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => onScheduleNext(item)}
                    className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-xl text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 transition cursor-pointer shadow-2xs"
                  >
                    <Plus size={13} />
                    <span>Schedule Next</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onAction('details', item)}
                    title="View details"
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface)] transition cursor-pointer shrink-0"
                  >
                    <MoreHorizontal size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FollowUpReportView({ onAction }) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState('today'); // 'today', 'yesterday', '1week', '1month', 'all', 'custom'
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [recentRows, setRecentRows] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    api.resources.list('/users/lookup', token)
      .then((res) => setUsers(res.data || []))
      .catch(() => {});
  }, [token]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      let from, to;

      if (dateRange === 'today') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        from = start.toISOString();
        to = end.toISOString();
      } else if (dateRange === 'yesterday') {
        const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const start = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 0, 0, 0);
        const end = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 23, 59, 59, 999);
        from = start.toISOString();
        to = end.toISOString();
      } else if (dateRange === '1week') {
        const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        from = start.toISOString();
        to = now.toISOString();
      } else if (dateRange === '1month') {
        const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        from = start.toISOString();
        to = now.toISOString();
      } else if (dateRange === 'custom') {
        if (customFrom) from = new Date(`${customFrom}T00:00:00`).toISOString();
        if (customTo) to = new Date(`${customTo}T23:59:59.999`).toISOString();
      }

      const queryParams = {
        from,
        to,
        assignedTo: selectedEmployee || undefined
      };

      const [analyticsRes, listRes] = await Promise.all([
        api.followUps.analytics(token, queryParams),
        api.followUps.list(token, { ...queryParams, limit: 50, sortBy: 'createdAt', sortDirection: 'desc' })
      ]);

      setAnalyticsData(analyticsRes.data || {});
      setRecentRows(listRes.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load follow-up report');
    } finally {
      setLoading(false);
    }
  }, [dateRange, customFrom, customTo, selectedEmployee, token]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const assigneesMap = analyticsData?.byAssignee || {};
  const memberEntries = Object.entries(assigneesMap).map(([name, data]) => {
    const total = data.total || 0;
    const completed = data.completed || 0;
    const overdue = data.overdue || 0;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return {
      name,
      total,
      completed,
      overdue,
      rate
    };
  }).sort((a, b) => b.completed - a.completed);

  const totalCompleted = analyticsData?.completed ?? memberEntries.reduce((sum, m) => sum + m.completed, 0);
  const totalVolume = analyticsData?.total ?? memberEntries.reduce((sum, m) => sum + m.total, 0);
  const totalOverdue = analyticsData?.overdue ?? memberEntries.reduce((sum, m) => sum + m.overdue, 0);
  const completionRate = totalVolume > 0 ? Math.round((totalCompleted / totalVolume) * 100) : 0;
  const activeMembersCount = memberEntries.length || users.length;

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Date Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '1week', label: '1 Week' },
              { id: '1month', label: '1 Month' },
              { id: 'all', label: 'All Time' },
              { id: 'custom', label: 'Custom' }
            ].map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setDateRange(chip.id)}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer",
                  dateRange === chip.id
                    ? "bg-[var(--primary)] text-white shadow-2xs font-bold"
                    : "bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-2)]/80"
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Employee Dropdown Selector + Refresh */}
          <div className="flex items-center gap-2">
            <div className="w-[180px] sm:w-[220px]">
              <Select
                value={selectedEmployee}
                onChange={(val) => setSelectedEmployee(val)}
                options={[
                  { value: '', label: 'All Members' },
                  ...users.map((u) => ({ value: u.id, label: u.name || u.full_name || u.email }))
                ]}
              />
            </div>

            <button
              type="button"
              onClick={loadReport}
              title="Refresh Report"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface)] transition cursor-pointer shrink-0"
            >
              <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {dateRange === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border-muted)]">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs">
              <span className="font-semibold text-[var(--text-muted)]">From:</span>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="bg-transparent text-xs font-bold text-[var(--text-main)] outline-none cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs">
              <span className="font-semibold text-[var(--text-muted)]">To:</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="bg-transparent text-xs font-bold text-[var(--text-main)] outline-none cursor-pointer"
              />
            </div>
            {(customFrom || customTo) && (
              <button
                type="button"
                onClick={() => { setCustomFrom(''); setCustomTo(''); }}
                className="text-[11px] font-semibold text-rose-500 hover:text-rose-600 transition cursor-pointer underline"
              >
                Clear range
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4 Executive KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-muted)]">Total Completed</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={16} />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{totalCompleted}</span>
            <span className="text-xs font-medium text-[var(--text-muted)]">follow-ups</span>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-muted)]">Completion Rate</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Zap size={16} />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{completionRate}%</span>
            <span className="text-xs font-medium text-[var(--text-muted)]">of {totalVolume} total</span>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-muted)]">Overdue Backlog</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <AlertTriangle size={16} />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400">{totalOverdue}</span>
            <span className="text-xs font-medium text-[var(--text-muted)]">pending action</span>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-muted)]">Active Team</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <UsersRound size={16} />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-violet-600 dark:text-violet-400">{activeMembersCount}</span>
            <span className="text-xs font-medium text-[var(--text-muted)]">agents tracking</span>
          </div>
        </div>
      </div>

      {/* Employee Workload & Performance Leaderboard */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-main)]">Employee Performance Leaderboard</h3>
            <p className="text-xs text-[var(--text-muted)]">Who completed how many follow-ups in this period</p>
          </div>
          <span className="text-xs font-bold text-[var(--text-muted)] px-2.5 py-1 rounded-full bg-[var(--surface-2)]">
            {memberEntries.length} Active Members
          </span>
        </div>

        {loading ? (
          <Skeleton className="h-48 rounded-xl" />
        ) : memberEntries.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] text-center py-6">No employee activity recorded for this period.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {memberEntries.map((member, idx) => {
              const initials = member.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'EM';
              let statusLabel = 'Balanced';
              let statusTone = 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20';
              if (member.overdue >= 3) {
                statusLabel = 'High Risk';
                statusTone = 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20';
              } else if (member.rate >= 70 && member.completed >= 1) {
                statusLabel = 'Top Performer';
                statusTone = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20';
              }

              return (
                <div
                  key={member.name}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/30 p-3.5 space-y-3 hover:border-[var(--primary)]/40 transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)]/15 text-[var(--primary)] font-bold text-xs shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-[var(--text-main)] truncate">{member.name}</span>
                          <span className="text-[10px] font-semibold text-[var(--text-muted)]">#{idx + 1}</span>
                        </div>
                        <span className={cn("inline-block rounded-md border px-1.5 py-0.2 text-[10px] font-semibold mt-0.5", statusTone)}>
                          {statusLabel}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{member.completed}</span>
                      <span className="text-[11px] text-[var(--text-muted)]"> / {member.total}</span>
                    </div>
                  </div>

                  {/* Completion Rate Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--text-muted)]">Completion</span>
                      <span className="font-bold text-[var(--text-main)]">{member.rate}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[var(--surface-2)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                        style={{ width: `${Math.min(100, member.rate)}%` }}
                      />
                    </div>
                  </div>

                  {/* Overdue info */}
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[var(--border-muted)]">
                    <span className="text-[var(--text-muted)]">Overdue Tasks:</span>
                    <span className={cn("font-bold", member.overdue > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>
                      {member.overdue}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Itemized Follow-up Activity Log */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-main)]">Recent Follow-up Activity Log</h3>
            <p className="text-xs text-[var(--text-muted)]">Individual follow-ups logged in this time period</p>
          </div>
          <span className="text-xs font-semibold text-[var(--text-muted)]">{recentRows.length} Records</span>
        </div>

        {loading ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : recentRows.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] text-center py-6">No activity records found for this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-muted)] uppercase tracking-wider font-semibold text-[10px]">
                  <th className="py-2.5 px-3">Lead / Client</th>
                  <th className="py-2.5 px-3">Assignee</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Outcome / Notes</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-muted)]">
                {recentRows.map((row) => {
                  const leadRoute = entityRoute(row);
                  return (
                    <tr key={row.id} className="hover:bg-[var(--surface-2)]/40 transition">
                      <td className="py-2.5 px-3 font-semibold text-[var(--text-main)]">
                        {leadRoute ? (
                          <button
                            type="button"
                            onClick={() => navigate(leadRoute)}
                            className="inline-flex items-center gap-1 hover:text-[var(--primary)] transition cursor-pointer text-left"
                          >
                            <span>{row.relatedEntityLabel || row.companyName || 'Lead'}</span>
                            <ExternalLink size={10} className="opacity-60" />
                          </button>
                        ) : (
                          <span>{row.relatedEntityLabel || row.companyName || 'Lead'}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-[var(--text-muted)]">{row.assigneeName || 'Unassigned'}</td>
                      <td className="py-2.5 px-3 text-[var(--text-muted)]">{row.followUpType || 'Call'}</td>
                      <td className="py-2.5 px-3">{renderStatusPill(row.effectiveStatus || row.status, true)}</td>
                      <td className="py-2.5 px-3 max-w-[240px] truncate text-[var(--text-muted)]">
                        {row.discussionNote || row.actualOutcome || row.description || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-[var(--text-muted)] whitespace-nowrap">{formatDateTime(row.dueAt || row.updatedAt)}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => onAction('details', row)}
                          className="px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition text-[11px] font-medium cursor-pointer"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function FollowUpsPage() {
  const { token, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('view') || 'today';
  const [activeTab, setActiveTab] = useState(tabs.some((item) => item.id === initialTab) ? initialTab : 'today');
  const [options, setOptions] = useState({});
  const [todayData, setTodayData] = useState(null);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [attention, setAttention] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', status: '', priority: '', quickFilter: 'all', page: 1, limit: 10 });
  const debouncedSearch = useDebouncedValue(filters.search, 300);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [formState, setFormState] = useState({ open: false, initial: null });
  const [completeItem, setCompleteItem] = useState(null);
  const [rescheduleState, setRescheduleState] = useState({ item: null, mode: 'reschedule' });
  const [details, setDetails] = useState(null);
  const [more, setMore] = useState(null);

  const loadOptions = useCallback(async () => {
    try {
      const response = await api.followUps.options(token);
      setOptions(response.data || {});
    } catch (error) {
      toast.error(error.message || 'Unable to load follow-up options');
    }
  }, [token]);

  const loadToday = useCallback(async () => {
    const response = await api.followUps.today(token);
    setTodayData(response.data);
  }, [token]);

  const loadRows = useCallback(async () => {
    const query = { search: debouncedSearch, status: filters.status, priority: filters.priority, quickFilter: filters.quickFilter !== 'all' ? filters.quickFilter : undefined, page: filters.page, limit: filters.limit || 10 };
    if (activeTab === 'visit') {
      query.followUpTypes = VISIT_FOLLOW_UP_TYPES.join(',');
    }
    if (activeTab === 'calendar') {
      query.from = new Date(month.getFullYear(), month.getMonth(), 1).toISOString();
      query.to = new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString();
      query.limit = 200;
    }
    if (activeTab === 'workload') query.limit = 200;
    const response = await api.followUps.list(token, query);
    setRows(response.data || []);
    setMeta(response.meta || { total: 0 });
  }, [activeTab, debouncedSearch, filters.limit, filters.page, filters.priority, filters.quickFilter, filters.status, month, token]);

  const loadAttention = useCallback(async () => {
    const response = await api.followUps.attention(token);
    setAttention(response.data);
  }, [token]);

  const loadAnalytics = useCallback(async () => {
    const response = await api.followUps.analytics(token);
    setAnalytics(response.data);
  }, [token]);

  const refresh = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const summaryLoads = [loadToday(), loadAttention()];
      if (activeTab === 'today') await Promise.all(summaryLoads);
      else if (['list', 'visit', 'calendar'].includes(activeTab)) await Promise.all([...summaryLoads, loadRows()]);
      else if (activeTab === 'attention') await Promise.all(summaryLoads);
      else if (['analytics', 'workload'].includes(activeTab)) await Promise.all([...summaryLoads, loadAnalytics(), activeTab === 'workload' ? loadRows() : Promise.resolve()]);
      else if (activeTab === 'automation') await Promise.all([...summaryLoads, loadOptions()]);
    } catch (error) {
      toast.error(error.message || 'Unable to load follow-ups');
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [activeTab, loadAnalytics, loadAttention, loadOptions, loadRows, loadToday]);

  useEffect(() => { loadOptions(); }, [loadOptions]);
  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const focus = searchParams.get('focus');
    if (!focus || !token) return;
    api.followUps.get(token, focus).then((response) => setDetails(response.data)).catch(() => {});
  }, [searchParams, token]);

  useEffect(() => {
    const view = searchParams.get('view');
    if (view && tabs.some((item) => item.id === view) && view !== activeTab) {
      setActiveTab(view);
    }
  }, [searchParams, activeTab]);

  function handleScheduleNext(item) {
    setFormState({
      open: true,
      initial: {
        relatedEntityType: item.relatedEntityType || 'Lead',
        relatedEntityId: item.relatedEntityId,
        relatedEntityLabel: item.relatedEntityLabel,
        clientPhone: item.relatedPhone || item.phone,
        purpose: 'Follow-up regarding previous discussion',
        title: `Follow-up with ${item.relatedEntityLabel || 'Lead'}`
      }
    });
  }

  function changeTab(tab) {
    setActiveTab(tab);
    setSearchParams({ view: tab });
    if (['list', 'visit'].includes(tab)) {
      setFilters((current) => ({
        ...current,
        quickFilter: 'all',
        status: '',
        priority: '',
        page: 1
      }));
    }
  }

  function handleSaved() {
    api.cache.invalidate('/leads');
    api.cache.invalidate('/follow-ups');
    refresh(false);
  }

  function handleSelectAssignee(assigneeName) {
    changeTab('list');
    setFilters((c) => ({ ...c, search: assigneeName, page: 1, quickFilter: 'all', status: '', priority: '' }));
  }

  function showQuickList(quickFilter) {
    changeTab('list');
    setFilters((c) => ({ ...c, quickFilter, status: '', priority: '', page: 1 }));
  }

  async function handleAction(action, item) {
    try {
      if (action === 'details') { const response = await api.followUps.get(token, item.id); setDetails(response.data); return; }
      if (action === 'complete') { setDetails(null); setMore(null); setCompleteItem(item); return; }
      if (action === 'reschedule' || action === 'snooze') { setDetails(null); setMore(null); setRescheduleState({ item, mode: action }); return; }
      if (action === 'more') { setMore(item); return; }
      if (action === 'edit') { setMore(null); setFormState({ open: true, initial: item }); return; }
      if (action === 'view_lead') { const route = entityRoute(item); if (route) navigate(route); return; }
      if (action === 'start') { await api.followUps.start(token, item.id); toast.success('Follow-up marked in progress'); }
      if (action === 'escalate') { await api.followUps.escalate(token, item.id, { reason: 'Manually escalated from command center' }); toast.success('Follow-up escalated'); setMore(null); }
      if (action === 'acknowledge') { await api.followUps.acknowledge(token, item.id); toast.success('Reminder acknowledged'); setMore(null); }
      if (action === 'delete') {
        if (!window.confirm(`Are you sure you want to delete follow-up "${item.title || item.followUpNumber}"?`)) return;
        await api.followUps.remove(token, item.id);
        toast.success('Follow-up deleted successfully');
      }
      if (action === 'quick_reschedule') {
        const { _rescheduleDate, _rescheduleTime, _rescheduleLabel } = item;
        const payload = {
          date: _rescheduleDate,
          time: _rescheduleTime,
          reason: `Quick Reschedule: ${_rescheduleLabel}`,
          note: `Quick rescheduled to ${_rescheduleLabel}`
        };
        await api.followUps.reschedule(token, item.id, payload);
        toast.success(`Follow-up rescheduled to ${_rescheduleLabel}`);
      }
      api.cache.invalidate('/leads');
      api.cache.invalidate('/follow-ups');
      await refresh(false);
    } catch (error) { toast.error(error.message || 'Action failed'); }
  }

  const counts = {
    ...todayData?.counts,
    overdue: todayData?.counts?.overdue ?? analytics?.overdue,
    dueToday: todayData?.counts?.dueToday,
    critical: todayData?.counts?.critical ?? analytics?.critical,
    missingNextAction: attention?.counts?.missingNextAction ?? todayData?.counts?.missingNextAction,
    upcoming: todayData?.sections?.upcoming?.length ?? 0
  };
  const visibleTabs = tabs.filter((item) => !['analytics'].includes(item.id) || hasPermission('followups.analytics', 'followups.view_all'));
  const attentionBadge = attention
    ? (attention.counts?.overdue || 0) + (attention.counts?.missingNextAction || 0)
    : 0;

  return (
    <div className="space-y-4">
      {/* Row 1: 6 KPI Cards on Left + Add Follow-Up Button on Right */}
      <div className="flex items-center justify-between gap-3">
        {/* 6 Compact KPI Cards */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:flex xl:items-center xl:gap-2 overflow-x-auto pb-1 xl:pb-0 flex-1 min-w-0">
          <Metric label="Overdue" value={counts.overdue} helper="late" icon={AlertTriangle} tone="rose" active={activeTab === 'list' && filters.quickFilter === 'overdue'} onClick={() => showQuickList('overdue')} />
          <Metric label="Due today" value={counts.dueToday} helper="queue" icon={Clock3} tone="blue" active={activeTab === 'list' && filters.quickFilter === 'due_today'} onClick={() => showQuickList('due_today')} />
          <Metric label="Critical" value={counts.critical} helper="risk" icon={Flame} tone="amber" active={activeTab === 'list' && filters.quickFilter === 'critical'} onClick={() => showQuickList('critical')} />
          <Metric label="Waiting" value={(counts.waitingForClient || 0) + (counts.waitingForInternalTeam || 0)} helper="pending" icon={TimerReset} tone="violet" active={activeTab === 'list' && filters.status === 'Waiting for Client'} onClick={() => { changeTab('list'); setFilters((c) => ({ ...c, status: 'Waiting for Client', priority: '', quickFilter: 'all', page: 1 })); }} />
          <Metric label="Unassigned" value={counts.unassigned || analytics?.unassigned} helper="leads" icon={UserRound} tone="violet" active={activeTab === 'attention'} onClick={() => changeTab('attention')} />
          <Metric label="Missing action" value={counts.missingNextAction} helper="actions" icon={ShieldAlert} tone="rose" active={activeTab === 'attention'} onClick={() => changeTab('attention')} />
        </div>

        {/* Add Follow-Up Button on Right */}
        {hasPermission('followups.create') && (
          <Button
            type="button"
            size="icon"
            onClick={() => setFormState({
              open: true,
              initial: activeTab === 'visit' ? { followUpType: 'Visit', purpose: 'Visit / Meeting' } : null
            })}
            title="Schedule Follow-up"
            className="!rounded-xl h-9 w-9 font-semibold shadow-2xs bg-[var(--primary)] text-white hover:brightness-105 transition-all shrink-0"
          >
            <Plus size={18} />
          </Button>
        )}
      </div>

      {/* Row 2: Dedicated Navigation Tabs Row */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-2xs">
        {visibleTabs.map((tab) => {
          const active = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => changeTab(tab.id)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold transition cursor-pointer whitespace-nowrap select-none',
                active
                  ? 'bg-[var(--primary)] text-white shadow-2xs font-bold'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]'
              )}
              title={tab.label}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
              {tab.id === 'attention' && attentionBadge > 0 ? (
                <span className={cn(
                  "inline-flex h-4.5 min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10.5px] font-extrabold leading-none shrink-0",
                  active ? "bg-white/30 text-white" : "bg-rose-500 text-white"
                )}>
                  {attentionBadge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {activeTab === 'today' ? <TodayView data={todayData} loading={loading} onAction={handleAction} /> : null}
      {activeTab === 'list' ? <ListView rows={rows} meta={meta} filters={filters} setFilters={setFilters} counts={counts} loading={loading} onAction={handleAction} onRefresh={refresh} /> : null}
      {activeTab === 'completed' ? <CompletedFollowUpsView options={options} onAction={handleAction} onScheduleNext={handleScheduleNext} /> : null}
      {activeTab === 'report' ? <FollowUpReportView onAction={handleAction} /> : null}
      {activeTab === 'visit' ? <ListView rows={rows} meta={meta} filters={filters} setFilters={setFilters} counts={counts} loading={loading} onAction={handleAction} onRefresh={refresh} title="Visit follow-ups" description="Client-site and office-visit meetings." /> : null}
      {activeTab === 'calendar' ? <CalendarView rows={rows} month={month} setMonth={setMonth} onAction={handleAction} onCreate={(initial) => setFormState({ open: true, initial })} loading={loading} /> : null}
      {activeTab === 'attention' ? <AttentionView data={attention} loading={loading} onCreate={(initial) => setFormState({ open: true, initial })} onAction={handleAction} /> : null}
      {activeTab === 'analytics' ? <AnalyticsView data={analytics} loading={loading} /> : null}
      {activeTab === 'workload' ? <WorkloadView data={analytics} loading={loading} onSelectAssignee={handleSelectAssignee} /> : null}
      {activeTab === 'automation' ? <AutomationView options={options} onRefresh={() => { loadOptions(); refresh(); }} /> : null}

      <FollowUpFormModal open={formState.open} initialValue={formState.initial} options={options} onClose={() => setFormState({ open: false, initial: null })} onSaved={handleSaved} />
      <CompleteFollowUpModal open={Boolean(completeItem)} followUp={completeItem} options={options} onClose={() => setCompleteItem(null)} onSaved={handleSaved} />
      <RescheduleFollowUpModal open={Boolean(rescheduleState.item)} followUp={rescheduleState.item} mode={rescheduleState.mode} onClose={() => setRescheduleState({ item: null, mode: 'reschedule' })} onSaved={handleSaved} />
      <ActivityViewModal item={details} open={Boolean(details)} onClose={() => { setDetails(null); if (searchParams.get('focus')) { searchParams.delete('focus'); setSearchParams(searchParams); } }} onComplete={(target) => { setDetails(null); setCompleteItem(target); }} onEdit={(target) => { setDetails(null); setFormState({ open: true, initial: target }); }} onViewLead={(route) => navigate(route)} />
      <MoreActionsModal item={more} open={Boolean(more)} onClose={() => setMore(null)} onAction={handleAction} />
    </div>
  );
}
