import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, ShieldCheck, Layers3, Clock3 } from 'lucide-react';
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
      <PageHeader
        eyebrow="Administration"
        title="Masters"
        description="Manage reusable lookup data used throughout the CRM."
        actions={[
          { label: 'Refresh', icon: RefreshCw, variant: 'secondary', onClick: () => setReloadTick((value) => value + 1) },
          ...(canWrite ? [{ label: `Add ${singularLabel(activeTypeMeta.label)}`, icon: Plus, onClick: openCreate }] : [])
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total" value={loading ? '...' : String(stats.total)} helper="All master records" icon={Layers3} />
        <StatCard title="Current Type" value={loading ? '...' : String(stats.current)} helper={activeTypeMeta.label} icon={ShieldCheck} />
        <StatCard title="Active" value={loading ? '...' : String(stats.active)} helper="Enabled items" icon={ShieldCheck} tone="positive" />
        <StatCard title="Inactive" value={loading ? '...' : String(stats.inactive)} helper="Disabled items" icon={ShieldCheck} tone="negative" />
      </div>

      <div className="flex flex-wrap gap-2">
        {masterTypes.map((type) => (
          <Button
            key={type.key}
            type="button"
            size="sm"
            variant={activeType === type.key ? 'primary' : 'secondary'}
            onClick={() => {
              setActiveType(type.key);
              setServiceStatusFilter('all');
              setSortKey('sortOrder');
              setSortDirection('asc');
              setActiveRecord(null);
              setDeleteTarget(null);
            }}
          >
            {type.label}
          </Button>
        ))}
      </div>

      <Card className="space-y-4 p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">Search {activeTypeMeta.label.toLowerCase()}</label>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${activeTypeMeta.label.toLowerCase()}`}
            />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[var(--text-muted)]">
            {rows.length} records
          </div>
        </div>

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
          toolbarRight={toolbarRight}
          onCreate={canWrite ? openCreate : undefined}
          createLabel={`Add ${singularLabel(activeTypeMeta.label)}`}
          rowClassName={(row) => (activeType === 'service' && row.isActive === false ? 'opacity-60 bg-slate-50/80' : '')}
          rowActions={
            canWrite || canDelete
              ? (row) => (
                  <div className="flex items-center justify-end gap-2">
                    {canWrite ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(row)}>
                        Edit
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setDeleteTarget(row)}>
                        Delete
                      </Button>
                    ) : null}
                  </div>
                )
              : undefined
          }
        />
      </Card>

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
