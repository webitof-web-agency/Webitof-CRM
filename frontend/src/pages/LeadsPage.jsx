import { UserAvatar } from '../components/ui/UserAvatar';
import { useEffect, useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, List, LayoutGrid, Eye, Tag, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { DataTable } from '../components/ui/Table';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { LeadFormModal } from '../components/forms/LeadFormModal';
import { SearchableSelect } from '../components/forms/SearchableSelect';
import { KanbanBoard } from '../components/ui/KanbanBoard';
import { LabelManagerModal } from '../components/labels/LabelManagerModal';
import { cn } from '../lib/cn';
import { normalizeSharedLabels } from '../lib/labels';
import { SlideOver } from '../components/ui/SlideOver';
import { ProfilePanel } from '../components/panels/ProfilePanel';

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

export function LeadsPage() {
  const { token, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [leadContacts, setLeadContacts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState('updated_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [selectedIds, setSelectedIds] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [viewType, setViewType] = useState('table');

  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [allStatuses, setAllStatuses] = useState([]);
  const [statusColors, setStatusColors] = useState({});
  const [labelColors, setLabelColors] = useState({});
  const [formOpen, setFormOpen] = useState(false);
  const [editingData, setEditingData] = useState(null);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [panelData, setPanelData] = useState(null);
  const [panelType, setPanelType] = useState(null);
  const [panelLeadData, setPanelLeadData] = useState(null);

  const canCreate = hasPermission('leads.manage') || hasPermission('leads.write');
  const canDelete = hasPermission('leads.manage') || hasPermission('leads.delete');

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

  const columns = useMemo(() => [
    {
      key: 'name', label: 'Lead Name', render: (row) => (
        <div className="font-medium text-[var(--text-main)]">{row.name}</div>
      )
    },
    {
      key: 'primaryContact', label: 'Primary contact', render: (row) => {
        const primaryContact = primaryContactsByLeadId.get(String(row.id));
        const name = primaryContact ? `${primaryContact.firstName || ''} ${primaryContact.lastName || ''}`.trim() : '';
        if (!name) return <span className="text-sm font-medium text-[var(--text-main)]">-</span>;
        return (
          <div className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 -m-1 rounded transition-colors group" onClick={() => { setPanelData(primaryContact); setPanelType('contact'); setPanelLeadData(row); }}>
            <UserAvatar name={name} className="h-7 w-7" fallbackSize={14} />
            <div className="text-sm font-medium text-[var(--text-main)] truncate">
              {name}
            </div>
          </div>
        );
      }
    },
    {
      key: 'phone', label: 'Phone', render: (row) => {
        const primaryContact = primaryContactsByLeadId.get(String(row.id));
        const rowPhone = formatPhoneDisplay(row.phone);
        const contactPhone = formatPhoneDisplay(primaryContact?.phone);
        const contactName = primaryContact ? `${primaryContact.firstName || ''} ${primaryContact.lastName || ''}`.trim() : '';
        return (
          <div className="space-y-1.5 text-sm">
            {rowPhone && rowPhone !== '-' && (
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Company</span>
                <span className="font-medium text-[var(--text-main)]">{rowPhone}</span>
              </div>
            )}
            {contactPhone && contactPhone !== '-' && contactPhone !== rowPhone && (
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{contactName || 'Contact'}</span>
                <span className="text-xs text-[var(--primary)]">{contactPhone}</span>
              </div>
            )}
            {!rowPhone || rowPhone === '-' ? <span className="text-[var(--text-muted)]">-</span> : null}
          </div>
        );
      }
    },
    {
      key: 'ownerName', label: 'Owner', render: (row) => {
        const name = row.ownerName || userNameById.get(String(row.assignedTo));
        if (!name) return <span className="text-sm font-medium text-[var(--text-main)]">-</span>;

        return (
          <div
            className="flex items-center gap-2 cursor-pointer p-1 -m-1 rounded transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              if (row.assignedTo) navigate(`/app/users/${row.assignedTo}`);
            }}
            title="View user profile"
          >
            <UserAvatar name={name} className="h-7 w-7" fallbackSize={14} />
            <div className="text-sm font-medium text-[var(--text-main)] truncate">
              {name}
            </div>
          </div>
        );
      }
    },
    {
      key: 'labels', label: 'Labels', render: (row) => {
        const labels = normalizeLabels(row.labels);
        if (!labels.length) {
          return <span className="text-sm text-[var(--text-muted)]">-</span>;
        }
        return (
          <div className="flex flex-wrap gap-1.5">
            {labels.slice(0, 3).map((label) => (
              <span key={label}>{renderLabelPill(label, labelColors[label])}</span>
            ))}
            {labels.length > 3 && (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-500">
                +{labels.length - 3}
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: 'createdAt', label: 'Created At', render: (row) => {
        if (!row.createdAt) return <span className="text-sm text-[var(--text-muted)]">-</span>;
        const d = new Date(row.createdAt);
        if (Number.isNaN(d.getTime())) return <span className="text-sm text-[var(--text-muted)]">-</span>;
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        let hr = d.getHours();
        const min = String(d.getMinutes()).padStart(2, '0');
        const sec = String(d.getSeconds()).padStart(2, '0');
        const ampm = hr >= 12 ? 'PM' : 'AM';
        hr = hr % 12 || 12;
        const hrStr = String(hr).padStart(2, '0');
        return (
          <span className="text-sm text-slate-600">
            {`${dd}-${mm}-${yyyy} ${hrStr}:${min}:${sec} ${ampm}`}
          </span>
        );
      }
    },
    {
      key: 'status', label: 'Status', render: (row) => {
        const color = statusColors[row.status] || '#64748b'; // default slate
        return (
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border"
            style={{ backgroundColor: `${color}1A`, color: color, borderColor: `${color}33` }}
          >
            {row.status}
          </span>
        );
      }
    }
  ], [labelColors, statusColors, primaryContactsByLeadId, userNameById]);



  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const [res, settingsRes] = await Promise.allSettled([
          api.resources.list('/leads', token, debouncedSearch),
          api.settings.get(token)
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

        const [contactsRes, usersRes] = await Promise.allSettled([
          api.resources.list('/lead-contacts', token),
          api.resources.list('/users/lookup', token)
        ]);
        if (active && contactsRes.status === 'fulfilled') {
          setLeadContacts(contactsRes.value.data || []);
        }
        if (active && usersRes.status === 'fulfilled') {
          setUsers(usersRes.value.data || []);
        }
      } catch (error) {
        if (active) toast.error('Failed to load data');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [token, debouncedSearch, reloadTick]);

  const sortedRows = useMemo(() => {
    let filtered = [...rows];

    if (statusFilter) {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    if (dateFilter) {
      filtered = filtered.filter(r => r.created_at?.startsWith(dateFilter) || r.followUpDate?.startsWith(dateFilter));
    }

    return filtered.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
    });
  }, [rows, sortKey, sortDirection, statusFilter, dateFilter]);

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

  async function handleStatusChange(leadId, newStatus) {
    const leadToUpdate = rows.find(r => r.id === leadId);
    if (!leadToUpdate || leadToUpdate.status === newStatus) return;

    setRows(curr => curr.map(r => r.id === leadId ? { ...r, status: newStatus } : r));

    try {
      await api.resources.update('/leads', leadId, { status: newStatus }, token);
      toast.success('Lead status updated');
    } catch (error) {
      setRows(curr => curr.map(r => r.id === leadId ? { ...r, status: leadToUpdate.status } : r));
      toast.error(error.message || 'Failed to update status');
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
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
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">Leads</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{rows.length} total leads</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white p-1 border border-slate-200 h-11" style={{ borderRadius: 'var(--radius-button, 1rem)' }}>
            <button
              type="button"
              onClick={() => setViewType('table')}
              className={cn('h-full px-4 transition-all flex items-center justify-center', viewType === 'table' ? 'bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--primary)] font-medium' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50')}
              style={{ borderRadius: 'calc(var(--radius-button, 1rem) - 4px)' }}
            >
              <List size={20} />
            </button>
            <button
              type="button"
              onClick={() => setViewType('kanban')}
              className={cn('h-full px-4 transition-all flex items-center justify-center', viewType === 'kanban' ? 'bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--primary)] font-medium' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50')}
              style={{ borderRadius: 'calc(var(--radius-button, 1rem) - 4px)' }}
            >
              <LayoutGrid size={20} />
            </button>
          </div>
          {canCreate && (
            <Button type="button" variant="outline" onClick={() => setLabelsOpen(true)}>
              <Tag size={16} className="mr-2" /> Manage labels
            </Button>
          )}
          {canCreate && (
            <Button type="button" onClick={() => { setEditingData(null); setFormOpen(true); }}>
              <Plus size={16} className="mr-2" /> New Lead
            </Button>
          )}
        </div>
      </div>

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
              <div className="w-48">
                <SearchableSelect
                  value={statusFilter}
                  onChange={val => { setStatusFilter(val); setPage(1); }}
                  options={[
                    { label: 'All Statuses', value: '' },
                    ...Array.from(new Set(rows.map(r => r.status))).filter(Boolean).map(s => ({ label: s, value: s }))
                  ]}
                  placeholder="All Statuses"
                />
              </div>
              <Input
                type="date"
                value={dateFilter}
                onChange={e => { setDateFilter(e.target.value); setPage(1); }}
                className="w-auto py-2"
                title="Filter by Date"
              />
            </div>
          }
          loading={loading}
          columns={columns}
          rows={sortedRows}
          selectable={canDelete}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSortChange={(k, d) => { setSortKey(k); setSortDirection(d); }}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          rowActions={(row) => (
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={(event) => {
                  event.stopPropagation();
                  navigate(`/app/leads/${row.id}`);
                }}
                title="View Lead"
              >
                <Eye size={16} />
              </Button>
              {canCreate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(event) => {
                    event.stopPropagation();
                    setEditingData(row);
                    setFormOpen(true);
                  }}
                  title="Edit Lead"
                >
                  <Pencil size={16} />
                </Button>
              )}
              {canDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(event) => {
                    event.stopPropagation();
                    setDeleteTarget(row);
                  }}
                  title="Delete"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={16} />
                </Button>
              )}
            </div>
          )}
        />
      ) : (
        <>
          <Card className="p-4 md:p-5 mb-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <Input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); setSelectedIds([]); }}
                  placeholder="Search leads..."
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-48">
                  <SearchableSelect
                    value={statusFilter}
                    onChange={val => { setStatusFilter(val); setPage(1); }}
                    options={[
                      { label: 'All Statuses', value: '' },
                      ...Array.from(new Set(rows.map(r => r.status))).filter(Boolean).map(s => ({ label: s, value: s }))
                    ]}
                    placeholder="All Statuses"
                  />
                </div>
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={e => { setDateFilter(e.target.value); setPage(1); }}
                  className="w-auto py-2"
                  title="Filter by Date"
                />
              </div>
            </div>
          </Card>
          <div className="pt-2">
            <KanbanBoard
              leads={kanbanLeads}
              statuses={allStatuses.length > 0 ? allStatuses : Array.from(new Set(rows.map(r => r.status))).filter(Boolean).map(s => ({ label: s }))}
              statusColors={statusColors}
              labelColors={labelColors}
              onStatusChange={handleStatusChange}
              onLeadClick={(lead) => navigate(`/app/leads/${lead.id}`)}
              onLeadEdit={canCreate ? (lead) => {
                setEditingData(lead);
                setFormOpen(true);
              } : undefined}
              onLeadDelete={canDelete ? (lead) => setDeleteTarget(lead) : undefined}
            />
          </div>
        </>
      )}

      <LeadFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initialData={editingData}
        onSuccess={() => setReloadTick(c => c + 1)}
      />

      <LabelManagerModal
        open={labelsOpen}
        onClose={() => setLabelsOpen(false)}
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



    </div>
  );
}