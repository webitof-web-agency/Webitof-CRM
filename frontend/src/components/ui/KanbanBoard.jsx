import { useEffect, useMemo, useState } from 'react';
import { Calendar, CircleUser, IndianRupee, MoreVertical, Phone, Pencil, Trash2, Eye } from 'lucide-react';
import { cn } from '../../lib/cn';

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
        const color = statusColors[status.label] || '#64748b';
        const isDragOver = dragOverStatus === status.label;

        return (
          <div
            key={status.label}
            className="flex w-[320px] shrink-0 flex-col overflow-hidden rounded-[var(--radius-card,1.25rem)] border border-transparent"
            onDragOver={(e) => handleDragOver(e, status.label)}
            onDrop={(e) => handleDrop(e, status.label)}
            style={{
              backgroundColor: isDragOver ? `${color}10` : `${color}05`,
              borderColor: isDragOver ? `${color}45` : 'transparent'
            }}
          >
            <div className="mb-2 flex items-center justify-between gap-3 px-4 py-3" style={{ backgroundColor: `${color}18` }}>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold" style={{ color }}>{status.label}</h3>
                <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: `${color}2A`, color }}>
                  {columnLeads.length}
                </span>
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {draggedLeadId ? 'Drop to move' : ' '}
              </div>
            </div>

            <div className="flex min-h-[150px] flex-col gap-3 px-2 pb-2">
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
                      'group relative cursor-pointer rounded-[var(--radius-card,1rem)] border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
                      draggedLeadId === lead.id && 'opacity-50'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-sm font-semibold text-[var(--text-main)]">{lead.name}</h4>
                        {lead.companyName ? <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{lead.companyName}</p> : null}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId((current) => (current === lead.id ? null : lead.id));
                          }}
                          className="rounded-full p-1.5 text-slate-500 opacity-0 transition hover:bg-slate-100 hover:text-slate-900 group-hover:opacity-100"
                          aria-label="Lead actions"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {openMenuId === lead.id && (
                          <div
                            className="absolute right-3 top-10 z-20 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-lg"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                              onClick={() => {
                                setOpenMenuId(null);
                                onLeadClick?.(lead);
                              }}
                            >
                              <Eye size={14} /> View
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                              onClick={() => {
                                setOpenMenuId(null);
                                onLeadEdit?.(lead);
                              }}
                            >
                              <Pencil size={14} /> Edit
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                              onClick={() => {
                                setOpenMenuId(null);
                                onLeadDelete?.(lead);
                              }}
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {labels.length ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {labels.slice(0, 2).map((label) => renderLabelChip(label))}
                        {labels.length > 2 ? (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                            +{labels.length - 2}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                      <div className="flex min-w-0 items-center gap-1.5 truncate">
                        <Phone size={13} className="shrink-0 text-slate-400" />
                        <span className="truncate">{formatPhoneDisplay(lead.ownerPhone || lead.phone)}</span>
                      </div>
                      {lead.value > 0 ? (
                        <div className="flex shrink-0 items-center gap-1 font-medium text-emerald-600">
                          <IndianRupee size={13} />
                          {Number(lead.value || 0).toLocaleString('en-IN')}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
                        <CircleUser size={13} className="shrink-0 text-slate-400" />
                        <span className="truncate">{lead.primaryContactName || 'No primary contact'}</span>
                      </div>
                      {lead.followUpDate ? (
                        <div className="flex shrink-0 items-center gap-1 rounded-full border border-rose-100 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-600">
                          <Calendar size={12} />
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
