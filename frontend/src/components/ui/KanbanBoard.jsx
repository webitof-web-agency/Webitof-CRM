import { useEffect, useMemo, useState } from 'react';
import { Calendar, CircleUser, IndianRupee, MoreVertical, Phone, Pencil, Trash2, Eye } from 'lucide-react';
import { cn } from '../../lib/cn';
import { getLeadStatusColor } from '../../config/leadManagement';

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

function formatPhoneDisplay(value) {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  if (raw.startsWith('+')) return raw;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return raw;
  return `+${digits}`;
}

function renderLabelPill(label, color, compact = true) {
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

export function KanbanBoard({
  leads = [],
  statuses = [],
  statusColors = {},
  labelColors = {},
  onStatusChange,
  onLeadClick,
  onLeadEdit,
  onLeadDelete
}) {
  const [draggedLeadId, setDraggedLeadId] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  useEffect(() => {
    function handleOutsideClick() {
      setOpenMenuId(null);
    }

    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const leadsByStatus = useMemo(() => statuses.reduce((acc, status) => {
    acc[status.label] = leads.filter((lead) => lead.status === status.label);
    return acc;
  }, {}), [leads, statuses]);

  function handleDragStart(e, lead) {
    setDraggedLeadId(lead.id);
    e.dataTransfer.setData('text/plain', lead.id);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      e.currentTarget.style.opacity = '0.5';
    }, 0);
  }

  function handleDragEnd(e) {
    e.currentTarget.style.opacity = '1';
    setDraggedLeadId(null);
    setDragOverStatus(null);
  }

  function handleDragOver(e, statusLabel) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStatus !== statusLabel) {
      setDragOverStatus(statusLabel);
    }
  }

  function handleDrop(e, statusLabel) {
    e.preventDefault();
    setDragOverStatus(null);
    const leadId = e.dataTransfer.getData('text/plain');
    if (leadId) {
      onStatusChange?.(leadId, statusLabel);
    }
  }

  function renderLabelChip(label) {
    return <span key={label}>{renderLabelPill(label, labelColors[label])}</span>;
  }

  return (
    <div className="flex min-h-[600px] w-full items-start gap-4 overflow-x-auto pb-4">
      {statuses.map((status) => {
        const columnLeads = leadsByStatus[status.label] || [];
        const color = statusColors[status.label] || status.color || getLeadStatusColor(status.label, statusColors);
        const isDragOver = dragOverStatus === status.label;

        return (
          <div
            key={status.label}
            className="flex w-[320px] shrink-0 flex-col overflow-hidden rounded-[var(--radius-card,1.25rem)] border border-[var(--border)] bg-[var(--surface-2)]/50 transition-colors"
            onDragOver={(e) => handleDragOver(e, status.label)}
            onDrop={(e) => handleDrop(e, status.label)}
            style={{
              borderColor: isDragOver ? color : undefined
            }}
          >
            {/* Column Header */}
            <div
              className="mb-2 flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)]"
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                <h3 className="text-xs font-bold text-[var(--text-main)] truncate">{status.label}</h3>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)]"
                >
                  {columnLeads.length}
                </span>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {draggedLeadId ? 'Drop here' : ' '}
              </div>
            </div>

            {/* Column Body / Cards */}
            <div className="flex min-h-[160px] flex-col gap-2.5 px-2.5 pb-2.5">
              {columnLeads.map((lead) => {
                const labels = normalizeLabels(lead.labels);
                return (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, lead)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onLeadClick?.(lead)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onLeadClick?.(lead);
                      }
                    }}
                    className={cn(
                      'group relative cursor-pointer rounded-[var(--radius-card,1rem)] border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs transition-all duration-150 hover:-translate-y-0.5 hover:shadow-xs hover:border-[var(--border-hover)]',
                      draggedLeadId === lead.id && 'opacity-50'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-xs font-bold text-[var(--text-main)]">
                          {lead.name}
                        </h4>
                        {lead.companyName ? (
                          <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                            {lead.companyName}
                          </p>
                        ) : null}
                      </div>
                      <div className="relative flex items-center gap-1">
                        <button
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId((current) => (current === lead.id ? null : lead.id));
                          }}
                          className="rounded-lg p-1 text-[var(--text-muted)] opacity-0 transition hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)] group-hover:opacity-100 cursor-pointer"
                          aria-label="Lead actions"
                        >
                          <MoreVertical size={15} />
                        </button>
                        {openMenuId === lead.id && (
                          <div
                            className="absolute right-0 top-7 z-20 w-36 overflow-hidden rounded-xl border border-[var(--border-glass)] bg-[var(--surface)] p-1 shadow-[var(--shadow-modal)] animate-fade-scale"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-[var(--text-main)] hover:bg-[var(--hover-bg)] cursor-pointer"
                              onClick={() => {
                                setOpenMenuId(null);
                                onLeadClick?.(lead);
                              }}
                            >
                              <Eye size={13} /> View
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-[var(--text-main)] hover:bg-[var(--hover-bg)] cursor-pointer"
                              onClick={() => {
                                setOpenMenuId(null);
                                onLeadEdit?.(lead);
                              }}
                            >
                              <Pencil size={13} /> Edit
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                              onClick={() => {
                                setOpenMenuId(null);
                                onLeadDelete?.(lead);
                              }}
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {labels.length ? (
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {labels.slice(0, 2).map((label) => renderLabelChip(label))}
                        {labels.length > 2 ? (
                          <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.2 text-[10px] font-semibold text-[var(--text-muted)]">
                            +{labels.length - 2}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
                      <div className="flex min-w-0 items-center gap-1 truncate">
                        <Phone size={12} className="shrink-0 opacity-70" />
                        <span className="truncate">
                          {formatPhoneDisplay(lead.ownerPhone || lead.phone)}
                        </span>
                      </div>
                      {lead.value > 0 ? (
                        <div className="flex shrink-0 items-center gap-0.5 font-bold text-emerald-600 dark:text-emerald-400">
                          <IndianRupee size={11} />
                          {Number(lead.value || 0).toLocaleString('en-IN')}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2 pt-1 border-t border-[var(--border-muted)]">
                      <div className="flex min-w-0 items-center gap-1 text-[10px] text-[var(--text-muted)]">
                        <CircleUser size={12} className="shrink-0 opacity-70" />
                        <span className="truncate">
                          {lead.primaryContactName || 'No primary contact'}
                        </span>
                      </div>
                      {lead.followUpDate ? (
                        <div className="flex shrink-0 items-center gap-1 rounded-full border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                          <Calendar size={10} />
                          {String(lead.followUpDate).substring(0, 10)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
