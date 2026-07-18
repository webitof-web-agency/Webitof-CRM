import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Pencil, Plus, RefreshCw, Trash2, Bell, TriangleAlert, Sparkles, Clock3, Play, History, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../api/client';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { DataTable } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';
import { ResourceForm } from '../components/forms/ResourceForm';
import { ConfirmDialog } from '../components/overlays/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { sortRows } from '../lib/resource';

function getWritePermission(permission = '') {
  if (!permission) return '';
  if (permission.includes('manage')) return permission;
  if (permission.endsWith('.read')) return permission.replace('.read', '.write');
  return permission;
}

function getDeletePermission(permission = '') {
  if (!permission) return '';
  if (permission.includes('manage')) return permission;
  if (permission.endsWith('.read')) return permission.replace('.read', '.delete');
  return permission;
}

function needsLookup(fields = [], predicate) {
  return fields.some((field) => predicate(field));
}

function pickLookups(fields = []) {
  return {
    clients: needsLookup(fields, (field) => field.type === 'customer' || ['clientId', 'linkedClientId'].includes(field.name)),
    vendors: needsLookup(fields, (field) => ['partnerId', 'vendorId'].includes(field.name) || field.lookupKey === 'vendors'),
    users: needsLookup(fields, (field) => ['employeeId', 'payeeId'].includes(field.name) || field.lookupKey === 'users'),
    expenseCategories: needsLookup(fields, (field) => field.name === 'categoryId' || field.lookupKey === 'expenseCategories'),
    renewalProviders: needsLookup(fields, (field) => field.name === 'providerId' || field.lookupKey === 'renewalProviders'),
    amcTypes: needsLookup(fields, (field) => field.name === 'amcType' || field.lookupKey === 'amcTypes'),
    projects: needsLookup(fields, (field) => ['projectId', 'linkedProjectId'].includes(field.name)),
    invoices: needsLookup(fields, (field) => ['invoiceId', 'linkedInvoiceId'].includes(field.name)),
    expenses: needsLookup(fields, (field) => ['expenseId', 'linkedExpenseId'].includes(field.name)),
    bankAccounts: needsLookup(fields, (field) => field.name === 'bankAccountId'),
    roles: needsLookup(fields, (field) => field.name === 'roleIds'),
    permissions: needsLookup(fields, (field) => field.name === 'permissionIds')
  };
}

export function ResourcePage({ schema }) {
  const navigate = useNavigate();
  const { token, hasPermission } = useAuth();
  const automationSummaryPath = schema.automationSummaryPath || (schema.key === 'amc' ? '/amc/automation/summary' : '');
  const automationRunPath = schema.automationRunPath || (schema.key === 'amc' ? '/amc/automation/run' : '');
  const [rows, setRows] = useState([]);
  const [lookups, setLookups] = useState({ clients: [], roles: [], permissions: [], bankAccounts: [], projects: [], invoices: [], expenses: [], users: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [dateFilter, setDateFilter] = useState('');
  const [sortKey, setSortKey] = useState(schema.columns?.[0]?.key || 'updatedAt');
  const [sortDirection, setSortDirection] = useState('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeQuickFilter, setActiveQuickFilter] = useState(schema.quickFilters?.[0]?.key || 'all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeRecord, setActiveRecord] = useState(null);
  const [busy, setBusy] = useState(false);
  const [automationBusy, setAutomationBusy] = useState(false);
  const [automationSummary, setAutomationSummary] = useState(null);
  const [automationHistoryOpen, setAutomationHistoryOpen] = useState(false);
  const [automationHistoryLoading, setAutomationHistoryLoading] = useState(false);
  const [automationHistoryRows, setAutomationHistoryRows] = useState([]);
  const [automationHistoryTarget, setAutomationHistoryTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  const createPermission = getWritePermission(schema.permission);
  const deletePermission = getDeletePermission(schema.permission);
  const canCreate = !schema.readOnly && (!createPermission || hasPermission(createPermission));
  const canEdit = !schema.readOnly && canCreate;
  const canDelete = !schema.readOnly && (!deletePermission || hasPermission(deletePermission));

  useEffect(() => {
    setActiveQuickFilter(schema.quickFilters?.[0]?.key || 'all');
  }, [schema.key, schema.quickFilters]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const lookupNeeds = pickLookups(schema.fields || []);
        const rowsResponse = await api.resources.list(schema.apiPath, token, debouncedSearch);
        const summaryResponse = automationSummaryPath
          ? await api.resources.list(automationSummaryPath, token).catch(() => ({ data: null }))
          : { data: null };
        const customLookupEntries = Object.entries(schema.lookupPaths || {});
        const customLookupResults = await Promise.allSettled(
          customLookupEntries.map(([, path]) => api.resources.list(path, token))
        );
        const lookupResults = await Promise.allSettled([
          lookupNeeds.clients ? api.resources.list('/clients', token) : Promise.resolve({ data: [] }),
          lookupNeeds.vendors ? api.resources.list('/masters/vendor', token) : Promise.resolve({ data: [] }),
          lookupNeeds.users ? api.resources.list('/users', token) : Promise.resolve({ data: [] }),
          lookupNeeds.expenseCategories ? api.resources.list('/masters/expense_category', token) : Promise.resolve({ data: [] }),
          lookupNeeds.renewalProviders ? api.resources.list('/masters/renewal_provider', token) : Promise.resolve({ data: [] }),
          lookupNeeds.amcTypes ? api.resources.list('/masters/amc_type', token) : Promise.resolve({ data: [] }),
          lookupNeeds.roles ? api.resources.list('/roles', token) : Promise.resolve({ data: [] }),
          lookupNeeds.permissions ? api.resources.list('/permissions', token) : Promise.resolve({ data: [] }),
          lookupNeeds.projects ? api.resources.list('/projects', token) : Promise.resolve({ data: [] }),
          lookupNeeds.invoices ? api.resources.list('/invoices', token) : Promise.resolve({ data: [] }),
          lookupNeeds.expenses ? api.resources.list('/expenses', token) : Promise.resolve({ data: [] }),
          lookupNeeds.bankAccounts ? api.resources.list('/banking/accounts', token) : Promise.resolve({ data: [] })
        ]);
        const [clientsResult, vendorsResult, usersResult, expenseCategoriesResult, renewalProvidersResult, amcTypesResult, rolesResult, permissionsResult, projectsResult, invoicesResult, expensesResult, bankAccountsResult] = lookupResults.map((result) =>
          result.status === 'fulfilled' ? result.value : { data: [] }
        );
        const customLookupObject = customLookupEntries.reduce((acc, [key], index) => {
          acc[key] = customLookupResults[index]?.status === 'fulfilled' ? customLookupResults[index].value.data || [] : [];
          return acc;
        }, {});

        if (!active) return;
        setRows(rowsResponse.data || []);
        setAutomationSummary(summaryResponse.data || null);
        setLookups((current) => ({
          ...current,
          clients: clientsResult.data || [],
          vendors: vendorsResult.data || [],
          users: usersResult.data || [],
          expenseCategories: expenseCategoriesResult.data || [],
          renewalProviders: renewalProvidersResult.data || [],
          amcTypes: amcTypesResult.data || [],
          roles: rolesResult.data || [],
          permissions: permissionsResult.data || [],
          projects: projectsResult.data || [],
          invoices: invoicesResult.data || [],
          expenses: expensesResult.data || [],
          bankAccounts: bankAccountsResult.data || [],
          ...customLookupObject
        }));
      } catch (error) {
        if (!active) return;
        toast.error(error.message || `Unable to load ${schema.label.toLowerCase()}`);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [automationSummaryPath, debouncedSearch, reloadTick, schema.apiPath, schema.fields, schema.label, token]);

  const sortedRows = useMemo(() => {
    let result = rows;
    if (dateFilter) {
      result = result.filter(row => {
        const d = row.date || row.createdAt || row.updatedAt || '';
        return String(d).startsWith(dateFilter);
      });
    }
    if (schema.filterRow) {
      result = result.filter((row) => schema.filterRow(row, activeQuickFilter));
    }
    return sortRows(result, sortKey, sortDirection);
  }, [rows, sortKey, sortDirection, dateFilter, activeQuickFilter, schema]);

  const amcDashboard = useMemo(() => {
    if (schema.key !== 'amc') return null;

    const normalizeDays = (row = {}) => {
      const target = row.nextInvoiceDate || row.endDate;
      if (!target) return null;
      const end = new Date(target);
      if (Number.isNaN(end.getTime())) return null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    };

    const amcRows = rows || [];
    const activeRows = amcRows.filter((row) => String(row.status || '').trim() !== 'Cancelled');
    const dueSoonRows = amcRows.filter((row) => {
      const days = normalizeDays(row);
      return String(row.status || '').trim() !== 'Cancelled' && days != null && days <= Number(row.reminderDays || 7);
    });
    const overdueRows = amcRows.filter((row) => {
      const days = normalizeDays(row);
      return String(row.status || '').trim() !== 'Cancelled' && days != null && days < 0;
    });
    const autoOffRows = amcRows.filter((row) => !row.autoInvoice && String(row.status || '').trim() !== 'Cancelled');
    const lastAutomationRunAt = amcRows
      .map((row) => row.lastAutomationRunAt)
      .filter(Boolean)
      .sort((left, right) => new Date(right) - new Date(left))[0] || null;
    const lastInvoiceGeneratedAt = amcRows
      .map((row) => row.lastInvoiceGeneratedAt)
      .filter(Boolean)
      .sort((left, right) => new Date(right) - new Date(left))[0] || null;

    return {
      total: amcRows.length,
      active: activeRows.length,
      dueSoon: dueSoonRows.length,
      overdue: overdueRows.length,
      autoOff: autoOffRows.length,
      lastAutomationRunAt,
      lastInvoiceGeneratedAt
    };
  }, [rows, schema.key]);
  const quickFilterCounts = useMemo(() => {
    if (!Array.isArray(schema.quickFilters) || !schema.quickFilters.length) return {};
    return schema.quickFilters.reduce((acc, filter) => {
      acc[filter.key] = rows.filter((row) => (typeof schema.filterRow === 'function' ? schema.filterRow(row, filter.key) : true)).length;
      return acc;
    }, {});
  }, [rows, schema.filterRow, schema.quickFilters]);

  const renderedQuickFilters = useMemo(() => {
    if (!Array.isArray(schema.quickFilters) || !schema.quickFilters.length) return [];
    return schema.quickFilters.map((filter) => ({
      ...filter,
      label: `${filter.label} (${quickFilterCounts[filter.key] ?? 0})`
    }));
  }, [quickFilterCounts, schema.quickFilters]);

  const automationMetrics = useMemo(() => {
    if (!automationSummary || !automationSummaryPath) return [];
    const defaults = schema.automationSummaryMetrics || [
      { key: 'remindersSent', label: 'Reminders' },
      { key: 'alertsSent', label: 'Alerts' },
      { key: 'skipped', label: 'Skipped' },
      { key: 'failures', label: 'Failures' }
    ];
    return defaults.map((metric) => ({
      ...metric,
      value: automationSummary?.[metric.key] ?? 0
    }));
  }, [automationSummary, automationSummaryPath, schema.automationSummaryMetrics]);

  function openCreate() {
    setActiveRecord(null);
    setEditorOpen(true);
  }

  function openEdit(record) {
    setActiveRecord(record);
    setEditorOpen(true);
  }

  async function openAutomationHistory(record) {
    if (!schema.hasAutomationHistory || !record?.id) return;
    setAutomationHistoryTarget(record);
    setAutomationHistoryOpen(true);
    setAutomationHistoryLoading(true);
    try {
      const response = await api.resources.list(`${schema.apiPath}/${record.id}/automation-history`, token, '', { limit: 20 });
      setAutomationHistoryRows(response.data || []);
    } catch (error) {
      setAutomationHistoryRows([]);
      toast.error(error.message || 'Unable to load automation history');
    } finally {
      setAutomationHistoryLoading(false);
    }
  }

  async function runAutomation() {
    setAutomationBusy(true);
    try {
      const response = await api.resources.create(automationRunPath, { dryRun: false }, token);
      const result = response.data || {};
      const failures = result.failures ?? (Array.isArray(result.results) ? result.results.filter((item) => Array.isArray(item.warnings) && item.warnings.length).length : 0);
      setAutomationSummary({
        runId: result.runId || null,
        runSource: result.runSource || 'manual',
        startedAt: new Date().toISOString(),
        remindersSent: result.remindersSent || 0,
        alertsSent: result.alertsSent || 0,
        invoicesCreated: result.invoicesCreated || 0,
        skipped: result.skipped || 0,
        failures,
        events: result.results?.length || 0,
        affectedRecords: result.count || 0,
        affectedAmcs: schema.key === 'amc' ? (result.count || 0) : undefined
      });
      if (schema.key === 'amc') {
        toast.success(
          `Automation complete: ${result.remindersSent || 0} reminders, ${result.invoicesCreated || 0} invoices, ${result.skipped || 0} skipped`
        );
      } else {
        toast.success(
          `Automation complete: ${result.remindersSent || 0} reminders, ${result.alertsSent || 0} alerts, ${result.skipped || 0} skipped`
        );
      }
      if (automationSummaryPath) {
        api.cache.invalidate(automationSummaryPath);
      }
      setReloadTick((current) => current + 1);
    } catch (error) {
      toast.error(error.message || 'Unable to run automation');
    } finally {
      setAutomationBusy(false);
    }
  }

  async function saveRecord(payload) {
    setBusy(true);
    try {
      const response = activeRecord
        ? await api.resources.update(schema.apiPath, activeRecord.id, payload, token)
        : await api.resources.create(schema.apiPath, payload, token);
      toast.success(activeRecord ? `${schema.singular || schema.label} updated` : `${schema.singular || schema.label} created`);
      setEditorOpen(false);
      setActiveRecord(null);
      setRows((current) => {
        if (!activeRecord) return [response.data, ...current];
        return current.map((item) => (item.id === response.data.id ? response.data : item));
      });
    } catch (error) {
      toast.error(error.message || 'Unable to save record');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.resources.remove(schema.apiPath, deleteTarget.id, token);
      toast.success(`${schema.singular || schema.label} deleted`);
      setRows((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error.message || 'Unable to delete record');
    } finally {
      setDeleting(false);
    }
  }

  const recordCount = rows.length;
  const pageMeta = `${recordCount} records`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">{schema.label}</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{schema.searchPlaceholder || `Manage ${schema.label.toLowerCase()} records.`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {automationRunPath && canEdit ? (
            <Button variant="outline" onClick={runAutomation} disabled={automationBusy}>
              {automationBusy ? <RefreshCw size={16} className="mr-2 animate-spin" /> : <Play size={16} className="mr-2" />}
              Run Automation
            </Button>
          ) : null}
          {canCreate && (
            <Button type="button" onClick={openCreate}>
              <Plus size={16} className="mr-2" /> Add {schema.singular || schema.label}
            </Button>
          )}
        </div>
      </div>

      {automationSummaryPath ? (
        <Card className="w-full border-none shadow-none flex flex-col xl:flex-row xl:overflow-hidden rounded-2xl bg-white xl:bg-transparent">
          <div className="flex items-center gap-5 p-5 bg-white xl:border-y xl:border-l xl:border-slate-200 rounded-t-2xl xl:rounded-tr-none xl:rounded-l-2xl min-w-[340px]">
             <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 relative">
               {schema.icon && <schema.icon size={32} />}
               <div className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm border border-slate-100">
                 <Settings size={14} className="text-violet-600" />
               </div>
             </div>
             <div className="space-y-1">
               <div className="text-[11px] font-bold uppercase tracking-widest text-violet-600">Latest automation</div>
               <div className="text-xl font-bold text-[var(--text-main)]">
                 {automationSummary?.runId ? `Run ${String(automationSummary.runId).slice(-6)}` : 'No run yet'}
               </div>
               <div className="text-[13px] text-[var(--text-muted)] pb-1">
                 {automationSummary?.startedAt ? `Started ${new Date(automationSummary.startedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : 'Trigger automation to see the summary here.'}
               </div>
               <div className="flex flex-wrap gap-2 text-[11px] text-[var(--text-muted)] font-medium">
                 <span className="rounded-full bg-slate-100 px-2.5 py-0.5">Records: {automationSummary?.affectedAmcs ?? automationSummary?.affectedRecords ?? automationSummary?.count ?? 0}</span>
                 <span className="rounded-full bg-slate-100 px-2.5 py-0.5">Events: {automationSummary?.events ?? 0}</span>
                 <span className="rounded-full bg-slate-100 px-2.5 py-0.5">Source: {automationSummary?.runSource || 'manual'}</span>
               </div>
             </div>
          </div>
          <div className="flex-1 flex flex-wrap xl:flex-nowrap items-center gap-3 p-5 xl:bg-slate-50/50 xl:border-y xl:border-r xl:border-slate-200 rounded-b-2xl xl:rounded-bl-none xl:rounded-r-2xl overflow-x-auto">
            {automationMetrics.slice(0, 4).map((metric) => (
              <div key={metric.key} className={`rounded-xl border border-slate-200 bg-white px-5 py-4 flex-1 min-w-[140px] shadow-sm border-b-[3px] ${metric.border || 'border-b-slate-300'}`}>
                <div className="flex items-center gap-2 mb-3">
                  {metric.icon && <metric.icon size={16} className={metric.color || 'text-slate-400'} />}
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{metric.label}</div>
                </div>
                <div className="text-3xl font-bold text-[var(--text-main)]">{metric.value ?? 0}</div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="pt-2">
        {amcDashboard ? (
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Overdue</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">{amcDashboard.overdue}</div>
                  <div className="mt-1 text-xs text-slate-500">Needs immediate attention</div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
                  <TriangleAlert size={18} />
                </div>
              </div>
            </Card>
            <Card className="border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Due Soon</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">{amcDashboard.dueSoon}</div>
                  <div className="mt-1 text-xs text-slate-500">Inside reminder window</div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
                  <Bell size={18} />
                </div>
              </div>
            </Card>
            <Card className="border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Auto Invoice Off</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">{amcDashboard.autoOff}</div>
                  <div className="mt-1 text-xs text-slate-500">Manual billing only</div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                  <Sparkles size={18} />
                </div>
              </div>
            </Card>
            <Card className="border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Last Run</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{amcDashboard.lastAutomationRunAt ? new Date(amcDashboard.lastAutomationRunAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never'}</div>
                  <div className="mt-1 text-xs text-slate-500">{amcDashboard.lastInvoiceGeneratedAt ? `Last invoice: ${new Date(amcDashboard.lastInvoiceGeneratedAt).toLocaleDateString('en-IN')}` : 'No invoice generated yet'}</div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-500">
                  <Clock3 size={18} />
                </div>
              </div>
            </Card>
          </div>
        ) : null}

        {Array.isArray(renderedQuickFilters) && renderedQuickFilters.length ? (
          <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-1">
            {renderedQuickFilters.map((filter) => {
              const active = activeQuickFilter === filter.key;
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setActiveQuickFilter(filter.key)}
                  className={`px-5 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-[1px] flex items-center gap-2 ${
                    active
                      ? 'border-[var(--primary)] text-[var(--primary)]'
                      : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-slate-300'
                  }`}
                >
                  {filter.icon && <filter.icon size={16} />}
                  {filter.label}
                </button>
              );
            })}
          </div>
        ) : null}
        <DataTable
          toolbarLeft={
            <div className="relative flex-1 w-full max-w-sm">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </div>
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                  setSelectedIds([]);
                }}
                placeholder={schema.searchPlaceholder || `Search ${schema.label.toLowerCase()}...`}
                className="pl-9 w-full"
              />
            </div>
          }
          toolbarRight={
            <div className="flex items-center gap-3">
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
          columns={schema.columns || []}
          rows={sortedRows}
          lookups={lookups}
          rowKey="id"
          selectable={Boolean(canDelete)}
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
          onRowClick={schema.hasDetailsPage ? (row) => navigate(row.id) : undefined}
          rowActions={
            canEdit || canDelete || schema.hasDetailsPage || schema.hasAutomationHistory
              ? (row) => (
                  <div className="flex items-center justify-end gap-2">
                    {schema.hasAutomationHistory ? (
                      <Button type="button" variant="ghost" size="icon" onClick={() => openAutomationHistory(row)} title="Automation History">
                        <History size={16} />
                      </Button>
                    ) : null}
                    {schema.hasDetailsPage ? (
                      <Button type="button" variant="ghost" size="icon" onClick={() => navigate(row.id)} title="View Details">
                        <Eye size={16} />
                      </Button>
                    ) : null}
                    {canEdit ? (
                      <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(row)} title="Edit">
                        <Pencil size={16} />
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button type="button" variant="ghost" size="icon" onClick={() => setDeleteTarget(row)} title="Delete">
                        <Trash2 size={16} />
                      </Button>
                    ) : null}
                  </div>
                )
              : null
          }
        />
      </div>

      <Modal
        open={automationHistoryOpen}
        title={`${automationHistoryTarget?.title || automationHistoryTarget?.name || schema.singular || schema.label} Automation History`}
        onClose={() => {
          setAutomationHistoryOpen(false);
          setAutomationHistoryRows([]);
          setAutomationHistoryTarget(null);
        }}
        width="min(1100px, 96vw)"
      >
        <DataTable
          loading={automationHistoryLoading}
          columns={[
            { key: 'createdAt', label: 'Time', type: 'date' },
            { key: 'action', label: 'Action' },
            { key: 'status', label: 'Status', type: 'badge' },
            { key: 'dueDate', label: 'Due Date', type: 'date' },
            { key: 'referenceName', label: 'Reference' },
            { key: 'message', label: 'Message', ellipsis: true }
          ]}
          rows={automationHistoryRows}
          selectable={false}
          emptyTitle="No automation history yet"
          emptyDescription="Run automation to create history entries for this record."
          pageSize={6}
        />
      </Modal>

      <Modal
        open={editorOpen}
        title={`${activeRecord ? 'Edit' : 'Add'} ${schema.singular || schema.label}`}
        onClose={() => {
          setEditorOpen(false);
          setActiveRecord(null);
        }}
        width="min(980px, 96vw)"
      >
        <ResourceForm
          key={`${schema.key}:${activeRecord?.id || 'new'}`}
          fields={schema.fields || []}
          record={activeRecord}
          lookups={lookups}
          onSubmit={saveRecord}
          onCancel={() => {
            setEditorOpen(false);
            setActiveRecord(null);
          }}
          submitLabel={activeRecord ? 'Update' : 'Create'}
          busy={busy}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete ${schema.singular || schema.label}`}
        description={`This action will remove ${deleteTarget?.name || deleteTarget?.title || deleteTarget?.code || 'the selected record'}.`}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
        busy={deleting}
      />
    </div>
  );
}
