import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, ShieldCheck, Layers3, Clock3, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { DataTable } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';
import { ResourceForm } from '../components/forms/ResourceForm';
import { ConfirmDialog } from '../components/overlays/ConfirmDialog';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { sortRows } from '../lib/resource';
import { cn } from '../lib/cn';

const masterTypes = [
  { key: 'service_category', label: 'Service Categories' },
  { key: 'service', label: 'Services' },
  { key: 'expense_category', label: 'Expense Categories' },
  { key: 'tax_rate', label: 'Tax Rates' },
  { key: 'vendor', label: 'Vendors' },
  { key: 'renewal_provider', label: 'Renewal Providers' },
  { key: 'amc_type', label: 'AMC Types' },
  { key: 'billing_cycle', label: 'Billing Cycles' },
  { key: 'invoice_term', label: 'Invoice Terms' }
];

function singularLabel(label = 'Item') {
  const map = {
    'Service Categories': 'Service Category',
    Services: 'Service',
    'Expense Categories': 'Expense Category',
    'Tax Rates': 'Tax Rate',
    Vendors: 'Vendor',
    'Renewal Providers': 'Renewal Provider',
    'AMC Types': 'AMC Type',
    'Billing Cycles': 'Billing Cycle',
    'Invoice Terms': 'Invoice Term'
  };
  return map[label] || label.replace(/s$/, '') || 'Item';
}

const SERVICE_UNIT_OPTIONS = ['Nos', 'Pcs', 'Hrs', 'Days', 'Months', 'Years', 'Project', 'AMC', 'Other'].map((unit) => ({
  value: unit,
  label: unit
}));

const SERVICE_CATEGORY_FIELDS = [
  { name: 'name', label: 'Category Name', type: 'text', required: true, placeholder: 'e.g. Development' },
  { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Short note about this category' },
  { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
  { name: 'sortOrder', label: 'Sort Order', type: 'number', defaultValue: 0 }
];

const SERVICE_FIELDS = [
  { name: 'name', label: 'Service Name', type: 'text', required: true, placeholder: 'e.g. Website Development' },
  {
    name: 'categoryId',
    label: 'Category',
    type: 'text',
    lookupKey: 'serviceCategories',
    lookupDescriptionKey: 'description',
    placeholder: 'Select service category'
  },
  { name: 'sacCode', label: 'SAC Code', type: 'text', placeholder: 'e.g. 998314' },
  { name: 'unit', label: 'Unit', type: 'select', options: SERVICE_UNIT_OPTIONS, defaultValue: 'Nos' },
  { name: 'defaultPrice', label: 'Default Price', type: 'money', defaultValue: 0 },
  { name: 'gstRate', label: 'GST Rate (%)', type: 'number', defaultValue: 18 },
  { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Optional service notes' },
  { name: 'isRecurring', label: 'Recurring Service', type: 'checkbox', defaultValue: false },
  { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
  { name: 'sortOrder', label: 'Sort Order', type: 'number', defaultValue: 0 }
];

function getMasterConfig(activeType, lookups = {}) {
  if (activeType === 'service_category') {
    return {
      fields: SERVICE_CATEGORY_FIELDS,
      columns: [
        { key: 'name', label: 'Category' },
        { key: 'description', label: 'Description', ellipsis: true, render: (row) => row.description || row.payload?.description || '-' },
        { key: 'sortOrder', label: 'Order', align: 'right' },
        { key: 'isActive', label: 'Active', type: 'badge' }
      ],
      fullWidthFields: ['description']
    };
  }

  if (activeType === 'service') {
    const serviceCategories = lookups.serviceCategories || [];
    return {
      fields: SERVICE_FIELDS,
      columns: [
        { key: 'name', label: 'Service' },
        {
          key: 'categoryId',
          label: 'Category',
          render: (row) => serviceCategories.find((item) => String(item.id) === String(row.categoryId))?.name || row.categoryName || row.category || '-'
        },
        { key: 'sacCode', label: 'SAC' },
        { key: 'defaultPrice', label: 'Default Price', align: 'right', type: 'money' },
        { key: 'gstRate', label: 'GST %', align: 'right' },
        { key: 'unit', label: 'Unit' },
        { key: 'isRecurring', label: 'Recurring', type: 'badge' },
        { key: 'sortOrder', label: 'Order', align: 'right' },
        { key: 'isActive', label: 'Active', type: 'badge' }
      ],
      fullWidthFields: ['description']
    };
  }

  return {
    fields: masterFields,
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'sortOrder', label: 'Order', align: 'right' },
      { key: 'isActive', label: 'Active', type: 'badge' },
      { key: 'payload', label: 'Payload', ellipsis: true }
    ],
    fullWidthFields: ['payload']
  };
}

function normalizeMasterRecord(type, record = {}, lookups = {}) {
  if (type === 'service_category') {
    return {
      ...record,
      description: record.description || record.payload?.description || ''
    };
  }

  if (type === 'service') {
    const serviceCategories = lookups.serviceCategories || [];
    const categoryId = record.categoryId || record.payload?.categoryId || '';
    const categoryName = record.categoryName || record.payload?.categoryName || record.category || record.payload?.category || '';
    const matchedCategory = serviceCategories.find((item) => String(item.id) === String(categoryId))
      || serviceCategories.find((item) => String(item.name).toLowerCase() === String(categoryName).toLowerCase());

    return {
      ...record,
      categoryId: categoryId || matchedCategory?.id || '',
      categoryName: categoryName || matchedCategory?.name || '',
      sacCode: record.sacCode || record.sac || '',
      unit: record.unit || 'Nos',
      defaultPrice: Number(record.defaultPrice ?? 0),
      gstRate: Number(record.gstRate ?? 18),
      description: record.description || record.payload?.description || '',
      isRecurring: Boolean(record.isRecurring),
      isActive: record.isActive !== false,
      sortOrder: Number(record.sortOrder ?? 0),
      priceHistory: Array.isArray(record.priceHistory) ? record.priceHistory : Array.isArray(record.payload?.priceHistory) ? record.payload.priceHistory : [],
      lastPriceChangeAt: record.lastPriceChangeAt || record.payload?.lastPriceChangeAt || '',
      lastPriceChangeBy: record.lastPriceChangeBy || record.payload?.lastPriceChangeBy || null
    };
  }

  return record;
}

const masterFields = [
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
  { name: 'sortOrder', label: 'Sort Order', type: 'number', defaultValue: 0 },
  { name: 'payload', label: 'Payload JSON', type: 'json', description: 'Store type-specific config here.' }
];

export function MastersPage() {
  const { token, hasPermission } = useAuth();
  const [activeType, setActiveType] = useState(masterTypes[0].key);
  const [recordsByType, setRecordsByType] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('sortOrder');
  const [sortDirection, setSortDirection] = useState('asc');
  const [serviceStatusFilter, setServiceStatusFilter] = useState('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeRecord, setActiveRecord] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  const debouncedSearch = useDebouncedValue(search, 250);
  const canWrite = hasPermission('masters.write');
  const canDelete = hasPermission('masters.delete');

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const responses = await Promise.all(
          masterTypes.map((type) => api.resources.list(`/masters/${type.key}`, token, debouncedSearch))
        );
        if (!mounted) return;
        const next = {};
        const rawByType = {};
        masterTypes.forEach((type, index) => {
          rawByType[type.key] = responses[index]?.data || [];
        });

        const serviceCategories = (rawByType.service_category || []).map((record) => normalizeMasterRecord('service_category', record));
        masterTypes.forEach((type) => {
          const rawRows = rawByType[type.key] || [];
          next[type.key] = rawRows.map((record) => normalizeMasterRecord(type.key, record, { serviceCategories }));
        });
        setRecordsByType(next);
      } catch (error) {
        if (!mounted) return;
        toast.error(error.message || 'Unable to load master data');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [debouncedSearch, reloadTick, token]);

  const rows = recordsByType[activeType] || [];
  const activeTypeMeta = masterTypes.find((type) => type.key === activeType) || masterTypes[0];
  const lookupData = useMemo(() => ({
    serviceCategories: recordsByType.service_category || []
  }), [recordsByType]);
  const activeTypeConfig = useMemo(() => getMasterConfig(activeType, lookupData), [activeType, lookupData]);
  const visibleRows = useMemo(() => {
    if (activeType !== 'service') return rows;
    if (serviceStatusFilter === 'active') return rows.filter((row) => row.isActive !== false);
    if (serviceStatusFilter === 'inactive') return rows.filter((row) => row.isActive === false);
    return rows;
  }, [activeType, rows, serviceStatusFilter]);
  const sortedRows = useMemo(() => sortRows(visibleRows, sortKey, sortDirection), [visibleRows, sortKey, sortDirection]);
  const servicePriceHistory = useMemo(() => {
    if (activeType !== 'service' || !activeRecord) return [];
    return Array.isArray(activeRecord.priceHistory) ? [...activeRecord.priceHistory] : [];
  }, [activeRecord, activeType]);
  const latestServicePriceEntry = useMemo(() => {
    if (!servicePriceHistory.length) return null;
    return servicePriceHistory[servicePriceHistory.length - 1] || null;
  }, [servicePriceHistory]);
  const serviceCounts = useMemo(() => {
    const serviceRows = recordsByType.service || [];
    return {
      all: serviceRows.length,
      active: serviceRows.filter((row) => row.isActive !== false).length,
      inactive: serviceRows.filter((row) => row.isActive === false).length
    };
  }, [recordsByType.service]);

  const stats = useMemo(() => {
    const total = masterTypes.reduce((sum, type) => sum + (recordsByType[type.key]?.length || 0), 0);
    const active = rows.filter((row) => row.isActive).length;
    const inactive = rows.length - active;
    return { total, active, inactive, current: rows.length };
  }, [recordsByType, rows]);

  function openCreate() {
    setActiveRecord(null);
    setEditorOpen(true);
  }

  function openEdit(record) {
    setActiveRecord(record);
    setEditorOpen(true);
  }

  async function saveRecord(payload) {
    setBusy(true);
    try {
      const response = activeRecord
        ? await api.resources.update(`/masters/${activeType}`, activeRecord.id, payload, token)
        : await api.resources.create(`/masters/${activeType}`, payload, token);
      const savedRecord = normalizeMasterRecord(activeType, response.data, lookupData);
      toast.success(activeRecord ? 'Master item updated' : 'Master item created');
      setRecordsByType((current) => ({
        ...current,
        [activeType]: activeRecord
          ? (current[activeType] || []).map((item) => (item.id === savedRecord.id ? savedRecord : item))
          : [savedRecord, ...(current[activeType] || [])]
      }));
      if (activeType === 'service' || activeType === 'service_category') {
        api.cache.invalidate('/invoices/service-catalog');
      }
      setEditorOpen(false);
      setActiveRecord(null);
    } catch (error) {
      toast.error(error.message || 'Unable to save master item');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.resources.remove(`/masters/${activeType}`, deleteTarget.id, token);
      toast.success('Master item deleted');
      setRecordsByType((current) => ({
        ...current,
        [activeType]: (current[activeType] || []).filter((item) => item.id !== deleteTarget.id)
      }));
      if (activeType === 'service' || activeType === 'service_category') {
        api.cache.invalidate('/invoices/service-catalog');
      }
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error.message || 'Unable to delete master item');
    } finally {
      setBusy(false);
    }
  }

  const toolbarRight = activeType === 'service' ? (
    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-1">
      {[
        { key: 'all', label: `All (${serviceCounts.all})` },
        { key: 'active', label: `Active (${serviceCounts.active})` },
        { key: 'inactive', label: `Inactive (${serviceCounts.inactive})` }
      ].map((option) => {
        const selected = serviceStatusFilter === option.key;
        return (
          <Button
            key={option.key}
            type="button"
            size="sm"
            variant={selected ? 'primary' : 'ghost'}
            onClick={() => setServiceStatusFilter(option.key)}
            className="h-8 px-3"
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  ) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-main)]">Masters</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Manage reusable lookup data used throughout the CRM.</p>
        </div>
        <div className="flex items-center gap-3">
          {canWrite ? (
            <Button onClick={openCreate}>
              <Plus size={16} className="mr-2" /> Add {singularLabel(activeTypeMeta.label)}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="px-4 py-6 md:px-5 flex items-center gap-4 shadow-sm border border-slate-100 rounded-[16px]">
          <div className="shrink-0 w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-blue-50/80 text-blue-500">
            <Layers3 size={24} strokeWidth={2} />
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">Total</p>
            <h3 className="text-lg md:text-xl font-bold text-slate-800 leading-tight truncate">{loading ? '...' : String(stats.total)}</h3>
            <p className="mt-1 text-xs text-slate-400 truncate">All master records</p>
          </div>
        </Card>
        
        <Card className="px-4 py-6 md:px-5 flex items-center gap-4 shadow-sm border border-slate-100 rounded-[16px]">
          <div className="shrink-0 w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-indigo-50/80 text-indigo-500">
            <ShieldCheck size={24} strokeWidth={2} />
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">Current Type</p>
            <h3 className="text-lg md:text-xl font-bold text-slate-800 leading-tight truncate">{loading ? '...' : String(stats.current)}</h3>
            <p className="mt-1 text-xs text-slate-400 truncate">{activeTypeMeta.label}</p>
          </div>
        </Card>
        
        <Card className="px-4 py-6 md:px-5 flex items-center gap-4 shadow-sm border border-slate-100 rounded-[16px]">
          <div className="shrink-0 w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-emerald-50/80 text-emerald-500">
            <ShieldCheck size={24} strokeWidth={2} />
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">Active</p>
            <h3 className="text-lg md:text-xl font-bold text-slate-800 leading-tight truncate">{loading ? '...' : String(stats.active)}</h3>
            <p className="mt-1 text-xs text-slate-400 truncate">Enabled items</p>
          </div>
        </Card>

        <Card className="px-4 py-6 md:px-5 flex items-center gap-4 shadow-sm border border-slate-100 rounded-[16px]">
          <div className="shrink-0 w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-rose-50/80 text-rose-500">
            <ShieldCheck size={24} strokeWidth={2} />
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">Inactive</p>
            <h3 className="text-lg md:text-xl font-bold text-slate-800 leading-tight truncate">{loading ? '...' : String(stats.inactive)}</h3>
            <p className="mt-1 text-xs text-slate-400 truncate">Disabled items</p>
          </div>
        </Card>
      </div>

      <div className="flex items-center gap-6 border-b border-slate-200 px-2 overflow-x-auto">
        {masterTypes.map((type) => (
          <button
            key={type.key}
            type="button"
            onClick={() => {
              setActiveType(type.key);
              setServiceStatusFilter('all');
              setSortKey('sortOrder');
              setSortDirection('asc');
              setActiveRecord(null);
              setDeleteTarget(null);
            }}
            className={cn(
              'inline-flex items-center gap-2 px-1 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap',
              activeType === type.key
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900'
            )}
          >
            {type.label}
          </button>
        ))}
      </div>

      <div className="pt-2">

        <DataTable
          loading={loading}
          columns={activeTypeConfig.columns}
          rows={sortedRows}
          lookups={lookupData}
          selectable={canDelete}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSortChange={(key, direction) => {
            setSortKey(key);
            setSortDirection(direction);
          }}
          toolbarLeft={
            <div className="relative flex-1 w-full max-w-sm">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </div>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={`Search ${activeTypeMeta.label.toLowerCase()}...`}
                className="pl-9 w-full"
              />
            </div>
          }
          toolbarRight={toolbarRight}
          rowClassName={(row) => (activeType === 'service' && row.isActive === false ? 'opacity-60 bg-slate-50/80' : '')}
          rowActions={
            canWrite || canDelete
              ? (row) => (
                  <div className="flex items-center justify-end gap-1">
                    {canWrite ? (
                      <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(row)} title="Edit" className="h-8 w-8 text-slate-400 hover:text-[var(--primary)]">
                        <Edit2 size={16} />
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button type="button" variant="ghost" size="icon" onClick={() => setDeleteTarget(row)} title="Delete" className="h-8 w-8 text-slate-400 hover:text-rose-500">
                        <Trash2 size={16} />
                      </Button>
                    ) : null}
                  </div>
                )
              : undefined
          }
        />
      </div>

      <Modal
        open={editorOpen}
        title={`${activeRecord ? 'Edit' : 'Add'} ${singularLabel(activeTypeMeta.label)}`}
        subtitle={`Type: ${activeTypeMeta.label}`}
        onClose={() => {
          setEditorOpen(false);
          setActiveRecord(null);
        }}
        width="min(860px, 96vw)"
      >
        <div className="space-y-5">
          <ResourceForm
            key={`${activeType}:${activeRecord?.id || 'new'}`}
            fields={activeTypeConfig.fields}
            record={activeRecord}
            lookups={lookupData}
            onSubmit={saveRecord}
            onCancel={() => {
              setEditorOpen(false);
              setActiveRecord(null);
            }}
            submitLabel={activeRecord ? 'Update Item' : 'Create Item'}
            busy={busy}
            fullWidthFields={activeTypeConfig.fullWidthFields}
          />

          {activeType === 'service' && activeRecord ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Clock3 size={16} className="text-[var(--primary)]" />
                    <h4 className="text-sm font-semibold text-slate-900">Service Summary</h4>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Current status and price history for this service.</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${activeRecord.isActive === false ? 'border-slate-200 bg-slate-100 text-slate-600' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                  {activeRecord.isActive === false ? 'Inactive' : 'Active'}
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Current Price</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    ₹{Number(activeRecord.defaultPrice ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">Used in invoice builder unless manually overridden by finance.</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Last Change</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {latestServicePriceEntry?.changedAt
                      ? new Date(latestServicePriceEntry.changedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                    : 'No changes yet'}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {latestServicePriceEntry?.changedBy?.name
                      ? `By ${latestServicePriceEntry.changedBy.name}${latestServicePriceEntry.changedBy.username ? ` (@${latestServicePriceEntry.changedBy.username})` : ''}`
                      : activeRecord.lastPriceChangeBy?.name
                        ? `By ${activeRecord.lastPriceChangeBy.name}${activeRecord.lastPriceChangeBy.username ? ` (@${activeRecord.lastPriceChangeBy.username})` : ''}`
                        : 'No change owner recorded'}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Price History</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {servicePriceHistory.length} entr{servicePriceHistory.length === 1 ? 'y' : 'ies'}
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {servicePriceHistory.length ? servicePriceHistory.slice().reverse().map((entry) => {
                  const changedAt = entry?.changedAt ? new Date(entry.changedAt) : null;
                  const timestamp = changedAt && !Number.isNaN(changedAt.getTime())
                    ? changedAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                    : 'Unknown time';
                  return (
                    <div key={entry.id || `${entry.changedAt}-${entry.to}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-900">
                          ₹{Number(entry.from ?? entry.to ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span className="mx-2 text-slate-300">→</span>
                          ₹{Number(entry.to ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[11px] text-slate-500">{timestamp}</div>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 uppercase tracking-[0.16em]">{entry.reason || 'updated'}</span>
                        {entry.changedBy?.name ? <span>By {entry.changedBy.name}</span> : null}
                        {entry.changedBy?.username ? <span>@{entry.changedBy.username}</span> : null}
                      </div>
                    </div>
                  );
                }) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                    No price changes recorded yet.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete master item"
        description={`This will remove ${deleteTarget?.name || 'the selected item'} from ${activeTypeMeta.label}.`}
        confirmLabel={busy ? 'Deleting...' : 'Delete'}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
        busy={busy}
      />
    </div>
  );
}
