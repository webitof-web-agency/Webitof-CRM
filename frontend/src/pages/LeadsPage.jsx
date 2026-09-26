import { UserAvatar } from '../components/ui/UserAvatar';
import { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, Pencil, Trash2, Search, List, LayoutGrid, Eye, Tag, ArrowLeft,
  GitBranch, Save, X, SlidersHorizontal, UserRoundCog, RefreshCw,
  CalendarClock, Download, Phone, Copy, Check, MoreVertical,
  Globe, Mail, Users, Building2, Store, Footprints, Briefcase, Handshake,
  Flame, TrendingUp, Upload, ChevronDown, UserMinus, Trophy, XCircle
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
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
import { LeadImportModal } from '../components/forms/LeadImportModal';
import { SearchableSelect } from '../components/forms/SearchableSelect';
import { KanbanBoard } from '../components/ui/KanbanBoard';
import { LabelManagerModal } from '../components/labels/LabelManagerModal';
import { cn } from '../lib/cn';
import { normalizeSharedLabels } from '../lib/labels';
import { SlideOver } from '../components/ui/SlideOver';
import { ProfilePanel } from '../components/panels/ProfilePanel';
import { WhatsAppModal } from '../components/common/WhatsAppModal';
import { exportToCsv } from '../lib/exportCsv';
import {
  DEFAULT_LEAD_OPTIONS,
  DEFAULT_LEAD_STATUS_COLORS,
  getLeadStatusColor,
  getLeadSourceColor,
  getLeadServiceColor,
  getLeadTemperatureColor,
  getLeadPriorityColor
} from '../config/leadManagement';
import { leadRoute } from '../utils/entityRoutes';

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

function InlineStatusCell({ status, leadId, statusColors, statusOptions = [], onStatusChange }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const color = getLeadStatusColor(status, statusColors);

  const availableStatuses = statusOptions.length ? statusOptions : Object.keys(DEFAULT_LEAD_STATUS_COLORS);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
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
    <div className="relative inline-flex items-center" ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="group inline-flex items-center gap-1 cursor-pointer select-none transition-transform active:scale-95 focus:outline-none"
        title="Click to quickly change status"
      >
        <span
          className="inline-flex items-center rounded-full border font-semibold whitespace-nowrap px-2.5 py-0.5 text-xs transition-all group-hover:shadow-xs group-hover:brightness-105"
          style={{
            backgroundColor: `${color}14`,
            borderColor: `${color}2E`,
            color: color
          }}
        >
          {status || 'New'}
          <ChevronDown size={11} className="ml-1 -mr-0.5 opacity-60 group-hover:opacity-100 transition-opacity" />
        </span>
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="animate-in fade-in zoom-in-95 duration-150 absolute top-full left-0 mt-1.5 z-50 min-w-[170px] rounded-2xl bg-white/95 dark:bg-slate-900/95 p-1.5 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl shadow-black/10 dark:shadow-black/50"
        >
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Change Status
          </div>
          <div className="max-h-56 overflow-y-auto space-y-0.5 custom-scrollbar">
            {availableStatuses.map((st) => {
              const stLabel = typeof st === 'string' ? st : st?.label || st?.value;
              const stColor = getLeadStatusColor(stLabel, statusColors);
              const isSelected = stLabel === status;
              return (
                <button
                  key={stLabel}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (stLabel !== status) {
                      onStatusChange(leadId, stLabel);
                    }
                  }}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left",
                    isSelected
                      ? "bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  )}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: stColor }} />
                    <span className="truncate">{stLabel}</span>
                  </span>
                  {isSelected && <Check size={13} className="text-emerald-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function LeadsMoreMenu({ canCreate, canManagePipelines, onExportClick, onImportClick, onLabelsClick, onPipelinesClick }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
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
      className="relative inline-flex items-center"
      ref={menuRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] transition-all hover:bg-[var(--surface-2)] hover:text-[var(--text-main)] cursor-pointer select-none",
          open && "bg-[var(--surface-2)] text-[var(--text-main)] border-[var(--primary)]/30 ring-2 ring-[var(--primary)]/10"
        )}
        title="More actions (Export CSV, Import CSV, Labels, Pipelines)"
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div
          className="animate-in fade-in zoom-in-95 duration-150 absolute right-0 top-full mt-1.5 z-50 min-w-[190px] rounded-2xl bg-white/95 dark:bg-slate-900/95 p-1.5 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-black/10 dark:shadow-black/50 space-y-0.5"
        >
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onExportClick?.();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
          >
            <Download size={14} className="text-emerald-500 shrink-0" />
            <span>Export to CSV</span>
          </button>

          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onImportClick();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
            >
              <Upload size={14} className="text-blue-500 shrink-0" />
              <span>Import CSV</span>
            </button>
          )}

          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onLabelsClick();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
            >
              <Tag size={14} className="text-purple-500 shrink-0" />
              <span>Manage Labels</span>
            </button>
          )}

          {canManagePipelines && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onPipelinesClick();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
            >
              <GitBranch size={14} className="text-emerald-500 shrink-0" />
              <span>Manage Pipelines</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function GoogleIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

function FacebookIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

function InstagramIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
    </svg>
  );
}

function LinkedInIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v7.6H9.2v-7.6H6.46M7.83 6.25c-.9 0-1.63.73-1.63 1.63s.73 1.63 1.63 1.63 1.63-.73 1.63-1.63-.73-1.63-1.63-1.63z"/>
    </svg>
  );
}

function getSourceIcon(source, className = "h-3.5 w-3.5") {
  const s = String(source || '').toLowerCase().trim();
  if (s.includes('google')) return <GoogleIcon className={className} />;
  if (s.includes('facebook') || s.includes('meta')) return <FacebookIcon className={className} />;
  if (s.includes('instagram') || s.includes('insta')) return <InstagramIcon className={className} />;
  if (s.includes('linkedin')) return <LinkedInIcon className={className} />;
  if (s.includes('whatsapp') || s.includes('wa')) return <WhatsAppIcon className={className} />;
  if (s.includes('web') || s.includes('site') || s.includes('organic')) return <Globe className={className} />;
  if (s.includes('call') || s.includes('phone')) return <Phone className={className} />;
  if (s.includes('mail')) return <Mail className={className} />;
  if (s.includes('refer') || s.includes('employee')) return <Users className={className} />;
  if (s.includes('client')) return <Building2 className={className} />;
  if (s.includes('trade') || s.includes('show') || s.includes('expo') || s.includes('event')) return <Store className={className} />;
  if (s.includes('walk')) return <Footprints className={className} />;
  if (s.includes('free') || s.includes('upwork') || s.includes('fiverr')) return <Briefcase className={className} />;
  if (s.includes('partner')) return <Handshake className={className} />;
  if (s.includes('mart') || s.includes('dial')) return <Store className={className} />;
  return <Globe className={className} />;
}

function renderSourceIcon(source) {
  if (!source) return <span className="text-sm text-[var(--text-muted)]">-</span>;
  const color = getLeadSourceColor(source);
  return (
    <div
      className="inline-flex items-center justify-center h-7 w-7 rounded-full border shadow-2xs transition-all duration-150 hover:scale-110 cursor-help"
      style={{
        backgroundColor: `${color}14`,
        borderColor: `${color}2E`,
        color: color
      }}
      title={`Source: ${source}`}
    >
      {getSourceIcon(source, "h-3.5 w-3.5")}
    </div>
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

function ServicesCell({ services = [] }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [coords, setCoords] = useState(null);
  const cellRef = useRef(null);
  const normalized = Array.isArray(services)
    ? services.map((s) => (typeof s === 'string' ? s : s?.label || s?.value || '')).filter(Boolean)
    : [];

  if (!normalized.length) {
    return <span className="text-sm text-[var(--text-muted)]">-</span>;
  }

  const firstService = normalized[0];
  const remainingCount = normalized.length - 1;
  const allServicesTooltip = normalized.join(', ');

  const handleMouseEnter = () => {
    if (cellRef.current) {
      const rect = cellRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpwards = spaceBelow < 180;
      setCoords({
        top: openUpwards ? undefined : rect.bottom + 6,
        bottom: openUpwards ? window.innerHeight - rect.top + 6 : undefined,
        left: Math.max(12, Math.min(rect.left, window.innerWidth - 330)),
        openUpwards
      });
      setShowTooltip(true);
    }
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  return (
    <div
      ref={cellRef}
      className="relative inline-flex items-center gap-1.5"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      title={allServicesTooltip}
    >
      {/* 1st Visible Service Pill */}
      <span className="max-w-[140px] truncate">
        {renderServicePill(firstService, getLeadServiceColor(firstService))}
      </span>

      {/* +N Remaining Counter Badge */}
      {remainingCount > 0 && (
        <span className="inline-flex items-center justify-center rounded-full border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/10 px-1.5 py-0.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 backdrop-blur-md cursor-pointer hover:bg-black/10 dark:hover:bg-white/20 transition-all select-none">
          +{remainingCount}
        </span>
      )}

      {/* Floating Glass Tooltip via Portal (Escapes table overflow and always on topmost z-index) */}
      {remainingCount > 0 && showTooltip && coords && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed z-[999999] p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl shadow-black/25 dark:shadow-black/70 min-w-[200px] max-w-[320px] flex flex-wrap gap-1.5 items-center pointer-events-none animate-in fade-in zoom-in-95 duration-150"
          style={{
            top: coords.top !== undefined ? `${coords.top}px` : undefined,
            bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
            left: `${coords.left}px`
          }}
        >
          <div className="w-full text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
            Required Services ({normalized.length})
          </div>
          {normalized.map((service, idx) => (
            <span key={`${service}-${idx}`}>
              {renderServicePill(service, getLeadServiceColor(service))}
            </span>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

function LabelsCell({ labels = [], labelColors = {} }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [coords, setCoords] = useState(null);
  const cellRef = useRef(null);
  const normalized = Array.isArray(labels)
    ? labels.map((l) => (typeof l === 'string' ? l : l?.label || l?.value || '')).filter(Boolean)
    : [];

  if (!normalized.length) {
    return <span className="text-sm text-[var(--text-muted)]">-</span>;
  }

  const firstLabel = normalized[0];
  const remainingCount = normalized.length - 1;
  const allLabelsTooltip = normalized.join(', ');

  const handleMouseEnter = () => {
    if (cellRef.current) {
      const rect = cellRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpwards = spaceBelow < 180;
      setCoords({
        top: openUpwards ? undefined : rect.bottom + 6,
        bottom: openUpwards ? window.innerHeight - rect.top + 6 : undefined,
        left: Math.max(12, Math.min(rect.left, window.innerWidth - 330)),
        openUpwards
      });
      setShowTooltip(true);
    }
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  return (
    <div
      ref={cellRef}
      className="relative inline-flex items-center gap-1.5"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
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

      {/* Floating Glass Tooltip via Portal */}
      {remainingCount > 0 && showTooltip && coords && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed z-[999999] p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl shadow-black/25 dark:shadow-black/70 min-w-[200px] max-w-[320px] flex flex-wrap gap-1.5 items-center pointer-events-none animate-in fade-in zoom-in-95 duration-150"
          style={{
            top: coords.top !== undefined ? `${coords.top}px` : undefined,
            bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
            left: `${coords.left}px`
          }}
        >
          <div className="w-full text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
            All Labels ({normalized.length})
          </div>
          {normalized.map((label, idx) => (
            <span key={`${label}-${idx}`}>
              {renderLabelPill(label, labelColors[label])}
            </span>
          ))}
        </div>,
        document.body
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
          <Link
            to={leadRoute(row)}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--hover-bg)] transition-colors cursor-pointer"
          >
            <Eye className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            View
          </Link>

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

function BulkLeadActionModal({ open, action, count, users, statuses, options, busy, onClose, onSubmit, statusColors = {} }) {
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
                options={statuses.map((status) => ({
                  value: status,
                  label: status,
                  color: getLeadStatusColor(status, statusColors)
                }))}
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
  const [activeTab, setActiveTab] = useState('all');
  const [importOpen, setImportOpen] = useState(false);

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
  const [whatsAppData, setWhatsAppData] = useState(null);

  const handleExportCsv = () => {
    if (!filteredRows || filteredRows.length === 0) {
      toast.error('No leads available to export');
      return;
    }
    const cols = [
      { label: 'Lead ID', key: 'leadNumber' },
      { label: 'Contact Person', key: 'contactPerson' },
      { label: 'Company Name', key: 'companyName' },
      { label: 'Phone', key: 'phone' },
      { label: 'Email', key: 'email' },
      { label: 'Status', key: 'status' },
      { label: 'Source', key: 'source' },
      { label: 'Priority', key: 'priority' },
      { label: 'Temperature', key: 'leadTemperature' },
      { label: 'Required Services', accessor: (row) => Array.isArray(row.requiredServices) ? row.requiredServices.join(', ') : (row.requiredServices || '') },
      { label: 'Estimated Budget (INR)', key: 'estimatedBudget' },
      { label: 'Follow-up Date', key: 'followUpDate' },
      { label: 'Assigned User', accessor: (row) => users?.find((u) => u.id === row.assignedTo)?.fullName || row.assignedTo || '' },
      { label: 'Created Date', accessor: (row) => row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-IN') : '' }
    ];
    exportToCsv('leads_export', cols, filteredRows);
    toast.success(`Exported ${filteredRows.length} leads to CSV`);
  };

  const canCreate = hasPermission('leads.manage') || hasPermission('leads.write');
  const canDelete = hasPermission('leads.manage') || hasPermission('leads.delete');
  const canBulkAssign = hasPermission('leads.manage') || hasPermission('leads.assign') || hasPermission('leads.write');
  const canBulkStatus = hasPermission('leads.manage') || hasPermission('leads.write');
  const canBulkFollowUp = hasPermission('leads.manage') || hasPermission('leads.manage_followup') || hasPermission('leads.write');
  const canBulkExport = hasPermission('leads.manage') || hasPermission('leads.export');
  const canSelectLeads = canBulkAssign || canBulkStatus || canBulkFollowUp || canBulkExport;
  const canManagePipelines = hasPermission('users.manage');

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const stats = useMemo(() => {
    let total = rows.length;
    let hot = 0;
    let followUpsDue = 0;
    let unassigned = 0;
    let won = 0;
    let lost = 0;
    let totalPipelineValue = 0;

    rows.forEach((r) => {
      if (r.leadTemperature === 'Hot' || r.temperature === 'Hot') hot++;
      if (r.followUpDate && r.followUpDate <= todayStr && !['Won', 'Lost', 'Not Interested'].includes(r.status)) {
        followUpsDue++;
      }
      if (!r.assignedTo) unassigned++;
      if (r.status === 'Won') won++;
      if (['Lost', 'Not Interested'].includes(r.status)) lost++;
      if (!['Lost', 'Not Interested', 'Invalid Lead', 'Duplicate'].includes(r.status)) {
        const val = Number(r.estimatedBudget ?? r.value ?? 0);
        if (!isNaN(val)) totalPipelineValue += val;
      }
    });

    return {
      total,
      hot,
      followUpsDue,
      unassigned,
      won,
      lost,
      totalPipelineValue
    };
  }, [rows, todayStr]);

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

  async function handleStatusChange(leadId, newStatus) {
    const leadToUpdate = rows.find(r => r.id === leadId);
    if (!leadToUpdate || leadToUpdate.status === newStatus) return;

    setRows(curr => curr.map(r => r.id === leadId ? { ...r, status: newStatus } : r));

    try {
      await api.resources.update('/leads', leadId, { status: newStatus }, token);
      toast.success(`Status updated to "${newStatus}"`);
    } catch (error) {
      setRows(curr => curr.map(r => r.id === leadId ? { ...r, status: leadToUpdate.status } : r));
      toast.error(error.message || 'Failed to update status');
    }
  }

  const columns = useMemo(() => [
    {
      key: 'name', label: 'Lead', render: (row) => (
        <div className="min-w-36">
          <Link
            to={leadRoute(row)}
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-[var(--text-main)] hover:text-[var(--primary)] hover:underline transition-colors block"
          >
            {row.contactPerson || row.name}
          </Link>
          {row.companyName && row.companyName !== row.contactPerson ? (
            <div className="mt-0.5 text-xs text-[var(--text-muted)]">{row.companyName}</div>
          ) : null}
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
        const cleanDigits = String(rawPhone || '').replace(/\D/g, '');
        const hasPhone = Boolean(rawPhone && rawPhone !== '-');

        const handleCopy = (e) => {
          e.stopPropagation();
          if (!hasPhone) {
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
          <div className="flex items-center gap-2">
            {/* Primary Contact Avatar */}
            <div
              className="cursor-pointer group relative shrink-0"
              title={`${dpTooltip} • Click to view profile`}
              onClick={(e) => {
                e.stopPropagation();
                if (primaryContact) {
                  setPanelData(primaryContact);
                  setPanelType('contact');
                  setPanelLeadData(row);
                }
              }}
            >
              <UserAvatar
                name={contactName || 'Lead'}
                className="h-8 w-8 ring-2 ring-slate-100 dark:ring-slate-800 shadow-2xs transition-all duration-200 group-hover:scale-105 group-hover:ring-[var(--primary)]/30"
                fallbackSize={14}
              />
            </div>

            {/* Encapsulated Action Pill */}
            <div className="flex items-center bg-slate-50 dark:bg-slate-800/70 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/70 shadow-2xs gap-0.5">
              {/* Call Action */}
              {hasPhone ? (
                <a
                  href={`tel:${rawPhone}`}
                  onClick={(e) => e.stopPropagation()}
                  title={`Call: ${phone}`}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-500/10 active:scale-95 transition-all"
                >
                  <Phone size={13} />
                </a>
              ) : (
                <span title="No phone number" className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-300 dark:text-slate-600 cursor-not-allowed">
                  <Phone size={13} />
                </span>
              )}

              {/* WhatsApp Action */}
              {cleanDigits ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setWhatsAppData({
                      leadId: row.id,
                      name: contactName,
                      companyName: row.companyName,
                      phone: rawPhone,
                      services: row.requiredServices,
                      amount: row.estimatedBudget || row.value
                    });
                  }}
                  title={`WhatsApp Outreach: ${phone}`}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-500/10 active:scale-95 transition-all cursor-pointer"
                >
                  <WhatsAppIcon className="h-3.5 w-3.5" />
                </button>
              ) : (
                <span title="No phone number" className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-300 dark:text-slate-600 cursor-not-allowed">
                  <WhatsAppIcon className="h-3.5 w-3.5" />
                </span>
              )}

              {/* Copy Number Action */}
              <button
                type="button"
                onClick={handleCopy}
                title={hasPhone ? (copiedPhoneId === row.id ? 'Copied!' : `Copy: ${phone}`) : 'No phone number'}
                disabled={!hasPhone}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-lg transition-all cursor-pointer",
                  copiedPhoneId === row.id
                    ? "text-emerald-600 bg-emerald-500/15 font-bold scale-105"
                    : hasPhone
                      ? "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 active:scale-95"
                      : "text-slate-300 dark:text-slate-600 cursor-not-allowed"
                )}
              >
                {copiedPhoneId === row.id ? (
                  <Check size={13} className="text-emerald-600" />
                ) : (
                  <Copy size={13} />
                )}
              </button>
            </div>
          </div>
        );
      }
    },
    {
      key: 'requiredServices', label: 'Service', render: (row) => (
        <ServicesCell services={row.requiredServices} />
      )
    },
    {
      key: 'estimatedBudget', label: 'Budget', render: (row) => (
        <span className="whitespace-nowrap text-xs font-medium text-slate-600 dark:text-slate-300">
          {formatLeadAmount(row.estimatedBudget ?? row.value, row.currency)}
        </span>
      )
    },
    {
      key: 'status', label: 'Status', render: (row) => (
        <InlineStatusCell
          status={row.status}
          leadId={row.id}
          statusColors={statusColors}
          statusOptions={leadOptions.statuses}
          onStatusChange={handleStatusChange}
        />
      )
    },
    {
      key: 'followUpDate', label: 'Follow-up', render: (row) => {
        if (!row.followUpDate) return <span className="text-xs text-[var(--text-muted)]">-</span>;
        const { shortText, fullText } = formatFollowUpDateDisplay(row.followUpDate, row.nextFollowUpTime);
        const overdue = row.followUpDate < new Date().toISOString().slice(0, 10) && !['Won', 'Lost', 'Not Interested'].includes(row.status);
        return (
          <span
            title={fullText}
            className={cn(
              "whitespace-nowrap text-xs font-medium cursor-help",
              overdue ? "text-rose-500 font-bold" : "text-[var(--text-muted)]"
            )}
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
    {
      key: 'source', label: 'Source', render: (row) => (
        renderSourceIcon(row.source)
      )
    },
    {
      key: 'pipelineId', label: 'Pipeline', render: (row) => {
        const pipeline = pipelineById.get(String(row.pipelineId));
        const color = pipeline?.color || '#64748b';
        return (
          <span
            className="inline-flex items-center rounded-full border font-semibold px-2.5 py-0.5 text-xs whitespace-nowrap"
            style={{ backgroundColor: `${color}14`, borderColor: `${color}2E`, color }}
          >
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
          <span className="text-xs text-[var(--text-muted)] font-medium whitespace-nowrap cursor-help" title={fullText}>
            {shortText}
          </span>
        );
      }
    }
  ], [labelColors, statusColors, leadOptions.statuses, primaryContactsByLeadId, userNameById, pipelineById, copiedPhoneId, rows]);

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

    // Quick Tab Preset Filters
    if (activeTab === 'followups') {
      filtered = filtered.filter(
        (r) => r.followUpDate && r.followUpDate <= todayStr && !['Won', 'Lost', 'Not Interested'].includes(r.status)
      );
    } else if (activeTab === 'hot') {
      filtered = filtered.filter((r) => r.leadTemperature === 'Hot' || r.temperature === 'Hot');
    } else if (activeTab === 'unassigned') {
      filtered = filtered.filter((r) => !r.assignedTo);
    } else if (activeTab === 'won') {
      filtered = filtered.filter((r) => r.status === 'Won');
    } else if (activeTab === 'lost') {
      filtered = filtered.filter((r) => ['Lost', 'Not Interested'].includes(r.status));
    }

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
  }, [rows, activeTab, todayStr, sortKey, sortDirection, statusFilter, pipelineFilter, dateFilter]);

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

  async function confirmDelete() {
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
        <div className="flex-1 bg-[var(--surface)] rounded-2xl shadow-sm border border-[var(--border)] overflow-hidden flex flex-col">
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
    <div className="space-y-4">
      {/* 1 Single Top Header Row: 6 KPI Cards on Left + Action Icons on Right */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* 6 Compact KPI Cards */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:flex xl:items-center xl:gap-2 overflow-x-auto">
          {/* Total Leads */}
          <div
            onClick={() => { setActiveTab('all'); setPage(1); }}
            className={cn(
              "group relative flex items-center gap-2 rounded-2xl border bg-[var(--surface)] px-3 py-1.5 transition-all duration-150 hover:shadow-sm cursor-pointer select-none shrink-0",
              activeTab === 'all'
                ? "border-[var(--primary)]/40 ring-2 ring-[var(--primary)]/15 bg-[var(--primary)]/5"
                : "border-[var(--border)] hover:border-slate-300 dark:hover:border-slate-700"
            )}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform shrink-0">
              <Users size={15} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] truncate leading-tight">Total Leads</div>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-black tracking-tight text-[var(--text-main)]">{stats.total}</span>
                <span className="text-[10px] text-slate-400 font-medium truncate">records</span>
              </div>
            </div>
          </div>

          {/* Hot Leads */}
          <div
            onClick={() => { setActiveTab('hot'); setPage(1); }}
            className={cn(
              "group relative flex items-center gap-2 rounded-2xl border bg-[var(--surface)] px-3 py-1.5 transition-all duration-150 hover:shadow-sm cursor-pointer select-none shrink-0",
              activeTab === 'hot'
                ? "border-rose-500/40 ring-2 ring-rose-500/15 bg-rose-500/5"
                : "border-[var(--border)] hover:border-rose-200 dark:hover:border-rose-900/50"
            )}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform shrink-0">
              <Flame size={15} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] truncate leading-tight">Hot Leads</div>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-black tracking-tight text-rose-600 dark:text-rose-400">{stats.hot}</span>
                <span className="text-[10px] text-slate-400 font-medium truncate">priority</span>
              </div>
            </div>
          </div>

          {/* Due Follow-ups */}
          <div
            onClick={() => { setActiveTab('followups'); setPage(1); }}
            className={cn(
              "group relative flex items-center gap-2 rounded-2xl border bg-[var(--surface)] px-3 py-1.5 transition-all duration-150 hover:shadow-sm cursor-pointer select-none shrink-0",
              activeTab === 'followups'
                ? "border-amber-500/40 ring-2 ring-amber-500/15 bg-amber-500/5"
                : "border-[var(--border)] hover:border-amber-200 dark:hover:border-amber-900/50"
            )}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform shrink-0">
              <CalendarClock size={15} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] truncate leading-tight">Due Follow-ups</div>
              <div className="flex items-baseline gap-1">
                <span className={cn("text-base font-black tracking-tight", stats.followUpsDue > 0 ? "text-amber-600 dark:text-amber-400" : "text-[var(--text-main)]")}>
                  {stats.followUpsDue}
                </span>
                <span className="text-[10px] text-slate-400 font-medium truncate">due</span>
              </div>
            </div>
          </div>

          {/* Unassigned */}
          <div
            onClick={() => { setActiveTab('unassigned'); setPage(1); }}
            className={cn(
              "group relative flex items-center gap-2 rounded-2xl border bg-[var(--surface)] px-3 py-1.5 transition-all duration-150 hover:shadow-sm cursor-pointer select-none shrink-0",
              activeTab === 'unassigned'
                ? "border-violet-500/40 ring-2 ring-violet-500/15 bg-violet-500/5"
                : "border-[var(--border)] hover:border-violet-200 dark:hover:border-violet-900/50"
            )}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 group-hover:scale-110 transition-transform shrink-0">
              <UserMinus size={15} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] truncate leading-tight">Unassigned</div>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-black tracking-tight text-violet-600 dark:text-violet-400">{stats.unassigned}</span>
                <span className="text-[10px] text-slate-400 font-medium truncate">leads</span>
              </div>
            </div>
          </div>

          {/* Won / Converted */}
          <div
            onClick={() => { setActiveTab('won'); setPage(1); }}
            className={cn(
              "group relative flex items-center gap-2 rounded-2xl border bg-[var(--surface)] px-3 py-1.5 transition-all duration-150 hover:shadow-sm cursor-pointer select-none shrink-0",
              activeTab === 'won'
                ? "border-emerald-500/40 ring-2 ring-emerald-500/15 bg-emerald-500/5"
                : "border-[var(--border)] hover:border-emerald-200 dark:hover:border-emerald-900/50"
            )}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform shrink-0">
              <Trophy size={15} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] truncate leading-tight">Won / Converted</div>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-black tracking-tight text-emerald-600 dark:text-emerald-400">{stats.won}</span>
                <span className="text-[10px] text-slate-400 font-medium truncate">closed</span>
              </div>
            </div>
          </div>

          {/* Lost Leads */}
          <div
            onClick={() => { setActiveTab('lost'); setPage(1); }}
            className={cn(
              "group relative flex items-center gap-2 rounded-2xl border bg-[var(--surface)] px-3 py-1.5 transition-all duration-150 hover:shadow-sm cursor-pointer select-none shrink-0",
              activeTab === 'lost'
                ? "border-rose-500/40 ring-2 ring-rose-500/15 bg-rose-500/5"
                : "border-[var(--border)] hover:border-rose-200 dark:hover:border-rose-900/50"
            )}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform shrink-0">
              <XCircle size={15} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] truncate leading-tight">Lost Leads</div>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-black tracking-tight text-rose-600 dark:text-rose-400">{stats.lost}</span>
                <span className="text-[10px] text-slate-400 font-medium truncate">dropped</span>
              </div>
            </div>
          </div>

          {/* Pipeline Value */}
          <div
            onClick={() => { setActiveTab('all'); setPage(1); }}
            className="group relative flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 transition-all duration-150 hover:shadow-sm hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer select-none shrink-0"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform shrink-0">
              <TrendingUp size={15} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] truncate leading-tight">Pipeline Value</div>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-black tracking-tight text-emerald-600 dark:text-emerald-400 truncate">
                  {formatLeadAmount(stats.totalPipelineValue, 'INR')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Icon Buttons on Right in Same Row */}
        <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
          <Button
            type="button"
            variant={filtersOpen || activeFiltersCount > 0 ? "secondary" : "outline"}
            size="icon"
            onClick={() => setFiltersOpen((value) => !value)}
            title={activeFiltersCount > 0 ? `Filters (${activeFiltersCount} active)` : "Filters"}
            className={cn(
              "!rounded-xl h-9 w-9 relative",
              (filtersOpen || activeFiltersCount > 0) && "text-[var(--primary)] border-[var(--primary)]/30 ring-2 ring-[var(--primary)]/10"
            )}
          >
            <SlidersHorizontal size={15} />
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--primary)] text-white text-[9px] font-black leading-none ring-2 ring-white dark:ring-slate-900">
                {activeFiltersCount}
              </span>
            )}
          </Button>

          <div className="flex bg-[var(--surface-2)] p-0.5 border border-[var(--border)] h-9 rounded-xl items-center">
            <button
              type="button"
              onClick={() => setViewType('table')}
              className={cn(
                'h-8 px-2.5 transition-all flex items-center justify-center rounded-lg cursor-pointer',
                viewType === 'table'
                  ? 'bg-[var(--surface)] text-[var(--primary)] font-bold shadow-2xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              )}
              title="Table view"
            >
              <List size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewType('kanban')}
              className={cn(
                'h-8 px-2.5 transition-all flex items-center justify-center rounded-lg cursor-pointer',
                viewType === 'kanban'
                  ? 'bg-[var(--surface)] text-[var(--primary)] font-bold shadow-2xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              )}
              title="Kanban view"
            >
              <LayoutGrid size={15} />
            </button>
          </div>

          <LeadsMoreMenu
            canCreate={canCreate}
            canManagePipelines={canManagePipelines}
            onExportClick={handleExportCsv}
            onImportClick={() => setImportOpen(true)}
            onLabelsClick={() => setLabelsOpen(true)}
            onPipelinesClick={() => setPipelinesOpen(true)}
          />

          {canCreate && (
            <Button
              type="button"
              size="icon"
              onClick={() => { setEditingData(null); setFormOpen(true); }}
              title="New Lead"
              className="!rounded-xl h-9 w-9 font-semibold shadow-2xs bg-[var(--primary)] text-white hover:brightness-105 transition-all shrink-0"
            >
              <Plus size={18} />
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
                options={[
                  { value: '', label: 'All sources' },
                  ...(leadOptions.sources || []).map((item) => ({
                    value: item,
                    label: item,
                    color: getLeadSourceColor(item)
                  }))
                ]}
                placeholder="All sources"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Service</label>
              <SearchableSelect
                value={serviceFilter}
                onChange={(value) => { setServiceFilter(value); setPage(1); }}
                options={[
                  { value: '', label: 'All services' },
                  ...(leadOptions.services || []).map((item) => ({
                    value: item,
                    label: item,
                    color: getLeadServiceColor(item)
                  }))
                ]}
                placeholder="All services"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Temperature</label>
              <SearchableSelect
                value={temperatureFilter}
                onChange={(value) => { setTemperatureFilter(value); setPage(1); }}
                options={[
                  { value: '', label: 'All temperatures' },
                  ...(leadOptions.temperatures || []).map((item) => ({
                    value: item,
                    label: item,
                    color: getLeadTemperatureColor(item)
                  }))
                ]}
                placeholder="All temperatures"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Priority</label>
              <SearchableSelect
                value={priorityFilter}
                onChange={(value) => { setPriorityFilter(value); setPage(1); }}
                options={[
                  { value: '', label: 'All priorities' },
                  ...(leadOptions.priorities || []).map((item) => ({
                    value: item,
                    label: item,
                    color: getLeadPriorityColor(item)
                  }))
                ]}
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
                    ...Array.from(new Set(rows.map(r => r.status))).filter(Boolean).map(s => ({
                      label: s,
                      value: s,
                      color: getLeadStatusColor(s, statusColors)
                    }))
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
          onRowClick={(row) => navigate(leadRoute(row))}
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
            statuses={allStatuses.length > 0 ? allStatuses.map(s => ({
              ...s,
              color: s.color || getLeadStatusColor(s.label, statusColors)
            })) : Array.from(new Set(rows.map(r => r.status))).filter(Boolean).map(s => ({
              label: s,
              color: getLeadStatusColor(s, statusColors)
            }))}
            statusColors={statusColors}
            labelColors={labelColors}
            onStatusChange={handleStatusChange}
            onLeadClick={(lead) => navigate(leadRoute(lead))}
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

      <LeadImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => {
          setImportOpen(false);
          setReloadTick((c) => c + 1);
        }}
        pipelines={pipelines}
        users={users}
        token={token}
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
        statusColors={statusColors}
        options={leadOptions}
        busy={bulkBusy}
        onClose={() => { if (!bulkBusy) setBulkAction(''); }}
        onSubmit={applyBulkAction}
      />

      <WhatsAppModal
        open={Boolean(whatsAppData)}
        onClose={() => setWhatsAppData(null)}
        recipient={whatsAppData}
        onSent={() => setReloadTick((c) => c + 1)}
      />

    </div>
  );
}
