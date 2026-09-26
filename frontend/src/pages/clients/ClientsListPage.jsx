import { useEffect, useState, useMemo } from 'react';
import { Plus, Eye, Pencil, Trash2, Tag, List, LayoutGrid, Search, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/Table';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { SearchableSelect } from '../../components/forms/SearchableSelect';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { ClientFormPage as ClientFormModal } from './ClientFormPage';
import { LabelManagerModal } from '../../components/labels/LabelManagerModal';
import { KanbanBoard } from '../../components/ui/KanbanBoard';
import { normalizeSharedLabels } from '../../lib/labels';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { ProfilePanel } from '../../components/panels/ProfilePanel';
import { clientRoute, userRoute } from '../../utils/entityRoutes';

function formatPhoneDisplay(value) {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  return raw.startsWith('+') ? raw : `+${raw.replace(/[^\d]/g, '') || raw}`;
}

function formatDateDisplay(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10) || '-';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
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

function LabelsCell({ labels = [] }) {
  const normalized = Array.isArray(labels) ? labels.filter(Boolean) : [];
  if (!normalized.length) return <span className="text-sm text-[var(--text-muted)]">-</span>;

  const first = normalized[0];
  const remainingCount = normalized.length - 1;
  const allText = normalized.map((l) => l.label || l).join(', ');

  return (
    <div className="relative group inline-flex items-center gap-1.5" title={allText}>
      <span className="max-w-[130px] truncate">
        {renderLabelPill(first.label || first, first.color)}
      </span>
      {remainingCount > 0 && (
        <span className="inline-flex items-center justify-center rounded-full border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/10 px-1.5 py-0.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 backdrop-blur-md cursor-pointer hover:bg-black/10 dark:hover:bg-white/20 transition-all select-none">
          +{remainingCount}
        </span>
      )}
      {remainingCount > 0 && (
        <div className="pointer-events-none opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 ease-out scale-95 group-hover:scale-100 origin-bottom-left absolute bottom-full left-0 mb-2 z-50 p-2.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/80 dark:border-white/15 shadow-2xl min-w-[180px] max-w-[300px] flex flex-wrap gap-1.5 items-center">
          <div className="w-full text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">
            All Labels ({normalized.length})
          </div>
          {normalized.map((item, idx) => (
            <span key={`${item.label || item}-${idx}`}>
              {renderLabelPill(item.label || item, item.color)}
            </span>
          ))}
          <div className="absolute top-full left-4 -mt-[1px] border-4 border-transparent border-t-white/95 dark:border-t-slate-900/95" />
        </div>
      )}
    </div>
  );
}

export function ClientsListPage() {
  const { token, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState([]);
  const [sortKey, setSortKey] = useState('updatedAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [viewType, setViewType] = useState('table');
  
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editingData, setEditingData] = useState(null);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [allStatuses, setAllStatuses] = useState([]);
  const [statusColors, setStatusColors] = useState({});
  const [labelColors, setLabelColors] = useState({});
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelData, setPanelData] = useState(null);
  const [panelClientData, setPanelClientData] = useState(null);

  const canCreate = hasPermission('clients.manage') || hasPermission('clients.write');
  const canDelete = hasPermission('clients.manage') || hasPermission('clients.delete');
  const canEdit = canCreate;

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const results = await Promise.allSettled([
          api.resources.list('/clients', token, debouncedSearch),
          api.resources.list('/client-contacts', token, ''),
          api.resources.list('/users/lookup', token, ''),
          api.settings.get(token)
        ]);

        if (!active) return;

        const [clientsRes, contactsRes, usersRes, settingsRes] = results;
        if (clientsRes.status === 'fulfilled') {
          setRows(clientsRes.value.data || []);
        } else {
          throw clientsRes.reason || new Error('Failed to load clients');
        }

        if (contactsRes.status === 'fulfilled') {
          setContacts(contactsRes.value.data || []);
        } else {
          setContacts([]);
        }

        if (usersRes.status === 'fulfilled') {
          setUsers(usersRes.value.data || []);
        } else {
          setUsers([]);
        }

        if (settingsRes.status === 'fulfilled') {
          const data = settingsRes.value.data || {};
          setSettings(data);

          if (Array.isArray(data.statuses?.clients) && data.statuses.clients.length) {
            setAllStatuses(data.statuses.clients);
            const colorMap = {};
            data.statuses.clients.forEach((item) => {
              const normalized = typeof item === 'string' ? { label: item, color: '#64748b' } : item;
              colorMap[normalized.label] = normalized.color || '#64748b';
            });
            setStatusColors(colorMap);
          } else {
            setAllStatuses([]);
            setStatusColors({});
          }

          if (Array.isArray(data.labels)) {
            const labelMap = {};
            normalizeSharedLabels(data.labels).forEach((item) => {
              labelMap[item.label] = item.color;
            });
            setLabelColors(labelMap);
          }
        }
      } catch (error) {
        if (active) toast.error(error.message || 'Failed to load clients');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [token, debouncedSearch, reloadTick]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (typeFilter && (row.clientType || row.type || '') !== typeFilter) {
        return false;
      }
      if (statusFilter && (row.status || '') !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [rows, typeFilter, statusFilter]);

  const clientStatuses = useMemo(() => {
    const baseStatuses = (allStatuses || [])
      .map((item) => (typeof item === 'string' ? { label: item, color: '#64748b' } : { label: item?.label || item?.value || '', color: item?.color || '#64748b' }))
      .filter((s) => s.label);
    const seen = new Set(baseStatuses.map((item) => item.label));
    const merged = [...baseStatuses];
    rows.forEach((row) => {
      if (row.status && !seen.has(row.status)) {
        merged.push({ label: row.status, color: '#64748b' });
        seen.add(row.status);
      }
    });
    return merged;
  }, [allStatuses, rows]);

  const contactMap = useMemo(() => {
    const map = new Map();
    contacts.forEach((contact) => {
      const clientId = contact?.clientId || contact?.client_id;
      if (!clientId) return;
      const normalized = {
        ...contact,
        clientId,
        firstName: contact.firstName || contact.first_name || '',
        lastName: contact.lastName || contact.last_name || '',
        jobTitle: contact.jobTitle || contact.job_title || '',
        phone: contact.phone || contact.mobile || '',
        isPrimary: Boolean(contact.isPrimary ?? contact.is_primary)
      };
      const current = map.get(String(clientId));
      if (!current || (normalized.isPrimary && !current.isPrimary)) {
        map.set(String(clientId), normalized);
      }
    });
    return map;
  }, [contacts]);

  const ownerMap = useMemo(() => {
    const map = new Map();
    users.forEach((user) => {
      map.set(String(user.id), user);
    });
    return map;
  }, [users]);

  const columns = useMemo(() => ([
    { key: 'name', label: 'Client', render: (row) => row.companyName || row.name },
    {
      key: 'primaryContact',
      label: 'Primary contact',
      render: (row) => {
        const contact = contactMap.get(String(row.id));
        const fullName = contact ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() : '';
        const displayName = fullName || row.contactPerson || '-';
        if (displayName === '-') return <span className="text-sm font-medium text-[var(--text-main)]">-</span>;

        return (
          <div
            className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 -m-1 rounded transition-colors group"
            onClick={(e) => {
              e.stopPropagation();
              setPanelData(contact || { firstName: row.contactPerson || '' });
              setPanelClientData(row);
              setPanelOpen(true);
            }}
          >
            <UserAvatar name={displayName} className="h-7 w-7" fallbackSize={14} />
            <div className="text-sm font-medium text-[var(--text-main)] truncate">
              {displayName}
            </div>
          </div>
        );
      }
    },
    {
      key: 'mobile',
      label: 'Phone',
      render: (row) => {
        const primaryContact = contactMap.get(String(row.id));
        const rowPhone = formatPhoneDisplay(row.mobile || row.phone);
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
            {contactPhone && contactPhone !== '-' && (
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{contactName || 'Contact'}</span>
                <span className="text-xs text-[var(--primary)]">{contactPhone}</span>
              </div>
            )}
            {(!rowPhone || rowPhone === '-') && (!contactPhone || contactPhone === '-') ? (
              <span className="text-[var(--text-muted)]">-</span>
            ) : null}
          </div>
        );
      }
    },
    {
      key: 'owner',
      label: 'Owner',
      render: (row) => {
        const owner = ownerMap.get(String(row.assignedTo));
        const displayName = owner?.fullName || owner?.username || row.ownerName || '-';
        if (displayName === '-') return <span className="text-sm font-medium text-[var(--text-main)]">-</span>;

        return (
          <div
            className="flex items-center gap-2 cursor-pointer p-1 -m-1 rounded transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              if (row.assignedTo) navigate(userRoute(owner || row.assignedTo));
            }}
            title="View user profile"
          >
            <UserAvatar name={displayName} className="h-7 w-7" fallbackSize={14} />
            <div className="text-sm font-medium text-[var(--text-main)] truncate">
              {displayName}
            </div>
          </div>
        );
      }
    },
    { key: 'placeOfSupply', label: 'Location', render: (row) => [row.city, row.state].filter(Boolean).join(', ') || row.placeOfSupply || '-' },
    {
      key: 'labels',
      label: 'Labels',
      render: (row) => {
        const labels = normalizeSharedLabels(row.labels);
        if (!labels.length) return <span className="text-sm text-[var(--text-muted)]">-</span>;
        return (
          <div className="flex flex-wrap gap-1.5">
            {labels.slice(0, 3).map((label) => (
              <span key={label.label}>{renderLabelPill(label.label, label.color)}</span>
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
    { key: 'createdAt', label: 'Created At', render: (row) => {
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
    }},
    { key: 'openingBalance', label: 'Balance', align: 'right', type: 'money' },
    { key: 'status', label: 'Status', type: 'badge' }
  ]), [contactMap, ownerMap]);

  const displayRows = useMemo(() => filteredRows.map((row) => ({
    ...row,
    _primaryContact: contactMap.get(String(row.id)) || null,
    _owner: ownerMap.get(String(row.assignedTo)) || null
  })), [filteredRows, contactMap, ownerMap]);

  const kanbanRows = useMemo(() => displayRows.map((row) => {
    const primaryContact = contactMap.get(String(row.id));
    const primaryContactName = primaryContact ? `${primaryContact.firstName || ''} ${primaryContact.lastName || ''}`.trim() : '';
    const primaryContactPhone = primaryContact?.phone || row.mobile || row.phone || '';
    return {
      ...row,
      primaryContactName,
      primaryContactPhone,
      ownerPhone: row.mobile || row.phone || primaryContactPhone,
      contactCount: primaryContact ? 1 : 0
    };
  }), [displayRows, contactMap]);

  const pipelineSummary = useMemo(() => {
    const counts = new Map();
    filteredRows.forEach((row) => {
      const key = row.status || 'Unassigned';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return [
      { label: 'All Clients', value: filteredRows.length, color: '#2563eb' },
      ...clientStatuses.map((status) => ({
        label: status.label,
        value: counts.get(status.label) || 0,
        color: statusColors[status.label] || status.color || '#64748b'
      }))
    ];
  }, [clientStatuses, filteredRows, statusColors]);

  const sortedRows = useMemo(() => {
    return [...displayRows].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const aNum = Number(aVal ?? 0);
      const bNum = Number(bVal ?? 0);
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    });
  }, [displayRows, sortKey, sortDirection]);

  async function handleStatusChange(clientId, newStatus) {
    const clientToUpdate = rows.find((item) => item.id === clientId);
    if (!clientToUpdate || clientToUpdate.status === newStatus) return;

    setRows((curr) => curr.map((item) => (item.id === clientId ? { ...item, status: newStatus } : item)));

    try {
      await api.resources.update('/clients', clientId, { status: newStatus }, token);
      toast.success('Client status updated');
    } catch (error) {
      setRows((curr) => curr.map((item) => (item.id === clientId ? { ...item, status: clientToUpdate.status } : item)));
      toast.error(error.message || 'Failed to update client status');
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.resources.remove('/clients', deleteTarget.id, token);
      toast.success('Client deleted');
      setRows(curr => curr.filter(item => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error.message || 'Failed to delete client');
    } finally {
      setDeleting(false);
    }
  }

  if (panelOpen && panelData) {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)] animate-in fade-in duration-200">
        <div className="flex items-center gap-3 px-1 pb-4 shrink-0">
          <button
            type="button"
            onClick={() => setPanelOpen(false)}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-[var(--primary)] transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Clients
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-medium text-slate-700">
            Contact Profile
          </span>
        </div>
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <ProfilePanel
            data={panelData}
            type="contact"
            leadData={panelClientData}
            onClose={() => setPanelOpen(false)}
            onSaved={() => setReloadTick(c => c + 1)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">Clients</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{rows.length} total clients</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-11 items-center rounded-[var(--radius-button,0.75rem)] border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setViewType('table')}
              className={`flex h-full items-center justify-center px-4 transition-all ${viewType === 'table' ? 'bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] font-medium text-[var(--primary)]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
              style={{ borderRadius: 'calc(var(--radius-button,0.75rem) - 4px)' }}
            >
              <List size={20} />
            </button>
            <button
              type="button"
              onClick={() => setViewType('kanban')}
              className={`flex h-full items-center justify-center px-4 transition-all ${viewType === 'kanban' ? 'bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] font-medium text-[var(--primary)]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
              style={{ borderRadius: 'calc(var(--radius-button,0.75rem) - 4px)' }}
            >
              <LayoutGrid size={20} />
            </button>
          </div>
          {canCreate && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setLabelsOpen(true)}
            >
              <Tag size={16} className="mr-2" />
              Manage labels
            </Button>
          )}
          {canCreate && (
            <Button
              type="button"
              onClick={() => {
                setEditingData(null);
                setFormOpen(true);
              }}
            >
              <Plus size={16} className="mr-2" />
              Add Client
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
                  placeholder="Search clients..."
                  className="pl-9 w-full"
                />
              </div>
            }
            toolbarRight={
              <div className="flex items-center gap-3">
                <div className="w-40">
                  <SearchableSelect
                    value={typeFilter}
                    onChange={(val) => { setTypeFilter(val); setPage(1); }}
                    options={[
                      { value: '', label: 'All Types' },
                      { value: 'Organization', label: 'Organization' },
                      { value: 'Person', label: 'Person' }
                    ]}
                    placeholder="All Types"
                    allowClear={false}
                  />
                </div>
                <div className="w-48">
                  <SearchableSelect
                    value={statusFilter}
                    onChange={(val) => { setStatusFilter(val); setPage(1); }}
                    options={[
                      { value: '', label: 'All Statuses' },
                      ...clientStatuses.map((status) => ({ value: status.label, label: status.label }))
                    ]}
                    placeholder="All Statuses"
                    allowClear={false}
                  />
                </div>
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
                <Button variant="ghost" size="icon" onClick={() => navigate(clientRoute(row))} title="View Details">
                  <Eye size={16} />
                </Button>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingData(row);
                      setFormOpen(true);
                    }}
                    title="Edit Client"
                  >
                    <Pencil size={16} />
                  </Button>
                )}
                {canDelete && (
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(row)} title="Delete" className="text-red-500 hover:text-red-600 hover:bg-red-50">
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
                  placeholder="Search clients..."
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-40">
                  <SearchableSelect
                    value={typeFilter}
                    onChange={(val) => { setTypeFilter(val); setPage(1); }}
                    options={[
                      { value: '', label: 'All Types' },
                      { value: 'Organization', label: 'Organization' },
                      { value: 'Person', label: 'Person' }
                    ]}
                    placeholder="All Types"
                    allowClear={false}
                  />
                </div>
                <div className="w-48">
                  <SearchableSelect
                    value={statusFilter}
                    onChange={(val) => { setStatusFilter(val); setPage(1); }}
                    options={[
                      { value: '', label: 'All Statuses' },
                      ...clientStatuses.map((status) => ({ value: status.label, label: status.label }))
                    ]}
                    placeholder="All Statuses"
                    allowClear={false}
                  />
                </div>
              </div>
            </div>
          </Card>
          <div className="pt-2">
            <KanbanBoard
              leads={kanbanRows}
              statuses={clientStatuses.length > 0 ? clientStatuses : Array.from(new Set(rows.map((row) => row.status))).filter(Boolean).map((status) => ({ label: status }))}
              statusColors={statusColors}
              labelColors={labelColors}
              onStatusChange={handleStatusChange}
              onLeadClick={(client) => navigate(clientRoute(client))}
              onLeadEdit={canEdit ? (client) => {
                setEditingData(client);
                setFormOpen(true);
              } : undefined}
              onLeadDelete={canDelete ? (client) => setDeleteTarget(client) : undefined}
            />
          </div>
          </>
        )}

      <ClientFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingData(null);
        }}
        initialData={editingData}
        onSuccess={() => setReloadTick((c) => c + 1)}
      />

      <LabelManagerModal
        open={labelsOpen}
        onClose={() => setLabelsOpen(false)}
        onSaved={() => setReloadTick((c) => c + 1)}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Client"
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
