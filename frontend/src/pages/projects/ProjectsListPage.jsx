import { useEffect, useMemo, useState } from 'react';
import { Eye, Pencil, Plus, RefreshCw, Tag, Trash2, Search } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/Table';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { SearchableSelect } from '../../components/forms/SearchableSelect';
import { LabelManagerModal } from '../../components/labels/LabelManagerModal';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { normalizeSharedLabels, mergeSharedLabelOptions } from '../../lib/labels';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { ProjectFormModal } from './ProjectFormModal';
import { clientRoute, projectRoute, userRoute } from '../../utils/entityRoutes';

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

function renderStatusPill(value, settings) {
  const configured = settings?.statuses?.projects || [];
  const statusColor = configured.find((item) => String(item.label || item) === String(value))?.color;
  const color = statusColor || (
    value === 'Completed' ? '#10b981'
      : value === 'In Progress' ? '#3b82f6'
        : value === 'On Hold' ? '#f59e0b'
          : value === 'Cancelled' ? '#ef4444'
            : '#64748b'
  );

  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
      style={{
        backgroundColor: `${color}14`,
        color,
        borderColor: `${color}2A`
      }}
    >
      {value || '-'}
    </span>
  );
}

function getProgressValue(row) {
  const explicit = Number(row?.progressPercent ?? row?.progress ?? 0);
  if (Number.isFinite(explicit) && explicit > 0) return Math.max(0, Math.min(100, explicit));
  if (String(row?.status || '').toLowerCase() === 'completed') return 100;
  if (String(row?.status || '').toLowerCase() === 'in progress') return 55;
  if (String(row?.status || '').toLowerCase() === 'on hold') return 25;
  return 0;
}

function ProgressCell({ row }) {
  const progress = getProgressValue(row);
  return (
    <div className="min-w-[160px] max-w-[220px] space-y-1">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
        <span>Progress</span>
        <span>{progress}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function normalizeProjectRow(row = {}, clientMap, userMap) {
  const labels = normalizeSharedLabels(row.labels || []);
  const client = clientMap.get(String(row.clientId || row.client_id)) || null;
  const directOwnerId = row.assignedTo || row.assigned_to;
  const ownerId = directOwnerId || (client ? (client.assignedTo || client.assigned_to) : null);
  const owner = ownerId ? userMap.get(String(ownerId)) : null;

  return {
    ...row,
    _client: client,
    _owner: owner,
    _labels: labels,
    _progress: getProgressValue(row)
  };
}

export function ProjectsListPage() {
  const { token, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState('updatedAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [selectedIds, setSelectedIds] = useState([]);
  const [clientFilter, setClientFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [projectFormInitialData, setProjectFormInitialData] = useState(null);

  const canCreate = hasPermission('projects.manage') || hasPermission('projects.write');
  const canDelete = hasPermission('projects.manage') || hasPermission('projects.delete');
  const canEdit = canCreate;

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const results = await Promise.allSettled([
          api.resources.list('/projects', token, debouncedSearch),
          api.resources.list('/clients', token),
          api.resources.list('/users/lookup', token),
          api.settings.get(token)
        ]);

        if (!active) return;

        const [projectsRes, clientsRes, usersRes, settingsRes] = results;
        setRows(projectsRes.status === 'fulfilled' ? (projectsRes.value.data || []) : []);
        setClients(clientsRes.status === 'fulfilled' ? (clientsRes.value.data || []) : []);
        setUsers(usersRes.status === 'fulfilled' ? (usersRes.value.data || []) : []);
        setSettings(settingsRes.status === 'fulfilled' ? (settingsRes.value.data || null) : null);
      } catch (error) {
        if (active) toast.error(error.message || 'Failed to load projects');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [debouncedSearch, reloadTick, token]);

  useEffect(() => {
    const state = location.state || {};
    if (!state.openProjectForm) return;

    setProjectFormInitialData(state.project || state.initialData || (state.clientId ? { clientId: state.clientId } : null));
    setProjectFormOpen(true);
    navigate('/app/projects', { replace: true });
  }, [location.state, navigate]);

  const clientMap = useMemo(() => {
    const map = new Map();
    clients.forEach((client) => map.set(String(client.id), client));
    return map;
  }, [clients]);

  const userMap = useMemo(() => {
    const map = new Map();
    users.forEach((user) => map.set(String(user.id), user));
    return map;
  }, [users]);

  const labelOptions = useMemo(() => {
    return mergeSharedLabelOptions(
      normalizeSharedLabels(settings?.labels || []),
      rows.flatMap((row) => normalizeSharedLabels(row.labels || []))
    );
  }, [rows, settings]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (clientFilter && String(row.clientId || '') !== String(clientFilter)) return false;
      if (statusFilter && String(row.status || '') !== String(statusFilter)) return false;
      if (typeFilter && String(row.projectType || '') !== String(typeFilter)) return false;
      return true;
    });
  }, [clientFilter, rows, statusFilter, typeFilter]);

  const displayRows = useMemo(() => filteredRows.map((row) => normalizeProjectRow(row, clientMap, userMap)), [clientMap, filteredRows, userMap]);

  const sortedRows = useMemo(() => {
    return [...displayRows].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
    });
  }, [displayRows, sortDirection, sortKey]);

  const clientOptions = useMemo(() => clients.map((client) => ({
    value: client.id,
    label: client.companyName || client.name || 'Client',
    description: [client.clientType || client.type || 'Client', client.mobile || client.phone].filter(Boolean).join(' • ')
  })), [clients]);

  const statusOptions = useMemo(() => {
    const configured = settings?.statuses?.projects?.length ? settings.statuses.projects : [
      { label: 'Not Started', color: '#64748b' },
      { label: 'In Progress', color: '#3b82f6' },
      { label: 'Completed', color: '#10b981' },
      { label: 'On Hold', color: '#f59e0b' }
    ];
    const values = configured.map((status) => (typeof status === 'string' ? status : status.label));
    return [
      { value: '', label: 'All Statuses' },
      ...Array.from(new Set(values.concat(['Active', 'Paused', 'Cancelled', 'Archived']))).map((status) => ({
        value: status,
        label: status
      }))
    ];
  }, [settings]);

  const typeOptions = useMemo(() => {
    const discovered = Array.from(new Set(rows.map((row) => String(row.projectType || '').trim()).filter(Boolean)));
    return [{ value: '', label: 'All Types' }, ...discovered.map((value) => ({ value, label: value }))];
  }, [rows]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.resources.remove('/projects', deleteTarget.id, token);
      toast.success('Project deleted');
      setRows((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error.message || 'Failed to delete project');
    } finally {
      setDeleting(false);
    }
  }

  const columns = [
    {
      key: 'title',
      label: 'Project',
      render: (row) => (
        <div className="min-w-[220px]">
          <div className="font-semibold text-[var(--text-main)]">{row.title || '-'}</div>
          <div className="text-xs text-[var(--text-muted)]">{row.projectType || 'Project'}</div>
        </div>
      )
    },
    {
      key: 'clientId',
      label: 'Client',
      render: (row) => (
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (row.clientId) navigate(clientRoute(row._client || row.clientId));
          }}
          className="min-w-[160px] cursor-pointer block text-left transition p-1 -m-1 rounded"
          title="View client details"
        >
          <div className="font-semibold text-[var(--text-main)]">
            {row._client?.companyName || row._client?.name || '-'}
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            {row._client?.clientType || row._client?.type || 'Client'}
          </div>
        </div>
      )
    },
    {
      key: 'assignedTo',
      label: 'Owner',
      render: (row) => (
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (row._owner?.id) navigate(userRoute(row._owner));
          }}
          className="min-w-[140px] flex items-center gap-2 cursor-pointer p-1 -m-1 rounded transition-colors"
          title="View user profile"
        >
          <UserAvatar name={row._owner?.fullName || row._owner?.username || row._owner?.email} url={row._owner?.avatarUrl || row._owner?.avatar_url} className="h-7 w-7" fallbackSize={14} />
          <div className="text-sm font-medium text-[var(--text-main)] truncate">
            {row._owner?.fullName || row._owner?.username || row._owner?.email || '-'}
          </div>
        </div>
      )
    },
    {
      key: 'value',
      label: 'Value',
      align: 'right',
      render: (row) => {
        const amount = Number(row.value || 0);
        return (
          <div className="min-w-[110px] text-right font-semibold text-[var(--text-main)]">
            {amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
          </div>
        );
      }
    },
    {
      key: 'progressPercent',
      label: 'Progress',
      render: (row) => <ProgressCell row={row} />
    },
    {
      key: 'labels',
      label: 'Labels',
      render: (row) => {
        const labels = row._labels || [];
        if (!labels.length) return <span className="text-sm text-[var(--text-muted)]">-</span>;
        return (
          <div className="flex flex-wrap gap-1.5">
            {labels.slice(0, 3).map((label) => {
              const match = labelOptions.find((item) => item.label === label.label);
              return <span key={label.label}>{renderLabelPill(label.label, match?.color || label.color)}</span>;
            })}
            {labels.length > 3 ? (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-500">
                +{labels.length - 3}
              </span>
            ) : null}
          </div>
        );
      }
    },
    { key: 'deadline', label: 'Deadline', render: (row) => {
      if (!row.deadline) return <span className="text-sm text-[var(--text-muted)]">-</span>;
      const d = new Date(row.deadline);
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
    } },
    { key: 'status', label: 'Status', render: (row) => renderStatusPill(row.status, settings) }
  ];

  function openProjectForm(initialData = null) {
    setProjectFormInitialData(initialData);
    setProjectFormOpen(true);
  }

  function closeProjectForm() {
    setProjectFormOpen(false);
    setProjectFormInitialData(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">Projects</h1>
          <p className="text-sm text-[var(--text-muted)]">{rows.length} projects</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canCreate ? (
            <Button type="button" variant="outline" onClick={() => setLabelsOpen(true)}>
              <Tag size={16} className="mr-2" />
              Manage labels
            </Button>
          ) : null}
          {canCreate ? (
            <Button type="button" onClick={() => openProjectForm()}>
              <Plus size={16} className="mr-2" />
              Add Project
            </Button>
          ) : null}

        </div>
      </div>
      <Card className="space-y-4">
        <DataTable
          toolbarLeft={
            <div className="relative flex-1 max-w-sm">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                  setSelectedIds([]);
                }}
                placeholder="Search by project, client, owner..."
                className="pl-9"
              />
            </div>
          }
          toolbarRight={
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-48">
                <SearchableSelect
                  value={clientFilter}
                  onChange={(val) => {
                    setClientFilter(val);
                    setPage(1);
                  }}
                  options={[{ value: '', label: 'All Clients' }, ...clientOptions]}
                  placeholder="All Clients"
                />
              </div>
              <div className="w-48">
                <SearchableSelect
                  value={statusFilter}
                  onChange={(val) => {
                    setStatusFilter(val);
                    setPage(1);
                  }}
                  options={statusOptions}
                  placeholder="All Statuses"
                />
              </div>
              <div className="w-48">
                <SearchableSelect
                  value={typeFilter}
                  onChange={(val) => {
                    setTypeFilter(val);
                    setPage(1);
                  }}
                  options={typeOptions}
                  placeholder="All Types"
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
          onSortChange={(key, direction) => {
            setSortKey(key);
            setSortDirection(direction);
          }}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          rowActions={(row) => (
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="icon" onClick={() => navigate(projectRoute(row))} title="View Project">
                <Eye size={16} />
              </Button>
              {canEdit ? (
                <Button variant="ghost" size="icon" onClick={() => openProjectForm(row)} title="Edit Project">
                  <Pencil size={16} />
                </Button>
              ) : null}
              {canDelete ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteTarget(row)}
                  title="Delete"
                  className="text-red-500 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </Button>
              ) : null}
            </div>
          )}
        />
      </Card>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Project"
        description={`Are you sure you want to delete ${deleteTarget?.title || 'this project'}? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
        isLoading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <LabelManagerModal
        open={labelsOpen}
        onClose={() => setLabelsOpen(false)}
        onSaved={(savedLabels) => {
          setSettings((current) => ({ ...(current || {}), labels: savedLabels }));
          api.cache.invalidate('/settings');
          setReloadTick((current) => current + 1);
        }}
      />

      <ProjectFormModal
        open={projectFormOpen}
        onClose={closeProjectForm}
        onSuccess={() => {
          setReloadTick((current) => current + 1);
          closeProjectForm();
        }}
        initialData={projectFormInitialData}
        clients={clients}
        users={users}
        settings={settings}
      />
    </div>
  );
}
