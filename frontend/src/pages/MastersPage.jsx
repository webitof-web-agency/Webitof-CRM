import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { STATIC_TECHNOLOGIES } from '../config/technologyStacks';
import {
  SERVICE_PAYMENT_PLAN_OPTIONS,
  createServicePaymentPlan,
  formatServicePaymentPlan,
  normalizeServicePaymentPlan
} from '../config/paymentPlans';

const masterTypes = [
  { key: 'service_category', label: 'Service Categories' },
  { key: 'service', label: 'Services' },
  { key: 'expense_category', label: 'Expense Categories' },
  { key: 'tax_rate', label: 'Tax Rates' },
  { key: 'vendor', label: 'Vendors' },
  { key: 'renewal_provider', label: 'Renewal Providers' },
  { key: 'amc_type', label: 'AMC Plans' },
  { key: 'billing_cycle', label: 'Billing Cycles' },
  { key: 'invoice_term', label: 'Invoice Terms' },
  { key: 'follow_up_type', label: 'Follow-up Types' }
];

function singularLabel(label = 'Item') {
  const map = {
    'Service Categories': 'Service Category',
    Services: 'Service',
    'Expense Categories': 'Expense Category',
    'Tax Rates': 'Tax Rate',
    Vendors: 'Vendor',
    'Renewal Providers': 'Renewal Provider',
    'AMC Plans': 'AMC Plan',
    'Billing Cycles': 'Billing Cycle',
    'Invoice Terms': 'Invoice Term',
    'Follow-up Types': 'Follow-up Type'
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
  {
    name: 'serviceKind',
    label: 'Service Type',
    type: 'select',
    options: [
      { value: 'primary', label: 'Primary service' },
      { value: 'addon', label: 'Add-on service' }
    ],
    defaultValue: 'primary'
  },
  {
    name: 'parentServiceIds',
    label: 'Available With (Parent Services)',
    type: 'multiselect',
    lookupKey: 'services',
    lookupDescriptionKey: 'categoryName',
    placeholder: 'Select services where this add-on should be suggested',
    visibleWhen: { field: 'serviceKind', equals: 'addon' }
  },
  { name: 'unit', label: 'Unit', type: 'select', options: SERVICE_UNIT_OPTIONS, defaultValue: 'Nos' },
  { name: 'defaultPrice', label: 'Default Price', type: 'money', defaultValue: 0 },
  { name: 'minimumBudget', label: 'Minimum Suggested Budget', type: 'money', defaultValue: 0, description: 'Used to flag whether the lead budget is suitable.', descriptionDisplay: 'tooltip' },
  { name: 'gstRate', label: 'GST Rate (%)', type: 'number', defaultValue: 18 },
  { name: 'description', label: 'Short Description', type: 'textarea', rows: 6, placeholder: 'Short service summary shown in quotation builder' },
  { name: 'scopeOfWork', label: 'Scope of Work', type: 'textarea', rows: 6, placeholder: 'Complete default scope/deliverables for this service' },
  { name: 'featuresText', label: 'Default Feature List', type: 'textarea', rows: 6, placeholder: 'One feature per line. These become editable quotation features.' },
  {
    name: 'technologyStackIds',
    label: 'Technology Stack',
    type: 'checkbox_group',
    lookupKey: 'technologies',
    lookupDescriptionKey: 'description',
    description: 'Select all technologies used for this service. Options are grouped by capability.',
    collapsibleGroups: true,
    showOptionDescriptions: false,
    showOptionIcons: true
  },
  {
    name: 'paymentPlan',
    label: 'Payment Information / Milestones',
    type: 'payment_plan',
    options: SERVICE_PAYMENT_PLAN_OPTIONS,
    defaultValue: createServicePaymentPlan(),
    required: true,
    description: 'Choose a standard payment plan or create a manual installment schedule. The total must be 100%.'
  },
  { name: 'termsAndConditions', label: 'Terms & Conditions', type: 'textarea', rows: 3, placeholder: 'Service-specific quotation terms' },
  { name: 'afterCompletion', label: 'After Project Completion We Provide', type: 'textarea', rows: 3, placeholder: 'Training, warranty, handover, credentials, etc.' },
  { name: 'timeline', label: 'Default Timeline', type: 'text', placeholder: 'e.g. 6-8 weeks' },
  {
    name: 'amcPlanId',
    label: 'Recommended AMC Plan',
    type: 'text',
    lookupKey: 'amcPlans',
    lookupDescriptionKey: 'description',
    placeholder: 'Select an AMC plan'
  },
  { name: 'nextYearCost', label: 'Default Cost From Next Year', type: 'money', defaultValue: 0, description: 'Renewal/AMC/hosting cost used in next-year summary.', descriptionDisplay: 'tooltip' },
  { name: 'isRecurring', label: 'Recurring Service', type: 'checkbox', defaultValue: false },
  { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
  { name: 'sortOrder', label: 'Sort Order', type: 'number', defaultValue: 0 }
];

const SERVICE_FIELD_CLASS_NAMES = {
  parentServiceIds: 'md:col-span-2 xl:col-span-6',
  description: 'md:col-span-2 xl:col-span-4',
  scopeOfWork: 'md:col-span-2 xl:col-span-4',
  featuresText: 'md:col-span-2 xl:col-span-4',
  technologyStackIds: 'md:col-span-2 xl:col-span-12',
  paymentPlan: 'md:col-span-2 xl:col-span-12',
  termsAndConditions: 'md:col-span-1 xl:col-span-6',
  afterCompletion: 'md:col-span-1 xl:col-span-6',
  timeline: 'md:col-span-1 xl:col-span-2',
  amcPlanId: 'md:col-span-1 xl:col-span-3',
  nextYearCost: 'md:col-span-1 xl:col-span-2',
  isRecurring: 'md:col-span-1 xl:col-span-2',
  isActive: 'md:col-span-1 xl:col-span-2',
  sortOrder: 'md:col-span-1 xl:col-span-1'
};

const AMC_TYPE_FIELDS = [
  { name: 'name', label: 'AMC Plan Name', type: 'text', required: true, placeholder: 'e.g. Website Care - Standard' },
  { name: 'planCode', label: 'Plan Code', type: 'text', placeholder: 'e.g. AMC-WEB-STD' },
  { name: 'description', label: 'Plan Description', type: 'textarea', rows: 3, placeholder: 'Short summary shown in quotations' },
  { name: 'defaultCost', label: 'Plan Cost', type: 'money', defaultValue: 0 },
  { name: 'nextYearCost', label: 'Renewal Cost', type: 'money', defaultValue: 0 },
  {
    name: 'defaultBillingCycle',
    label: 'Billing Cycle',
    type: 'select',
    options: ['Monthly', 'Quarterly', 'Half Yearly', 'Yearly'].map((value) => ({ value, label: value })),
    defaultValue: 'Yearly'
  },
  { name: 'durationMonths', label: 'Plan Duration (Months)', type: 'number', defaultValue: 12 },
  { name: 'supportHours', label: 'Included Support Hours', type: 'number', defaultValue: 0 },
  { name: 'responseSlaHours', label: 'Response SLA (Hours)', type: 'number', defaultValue: 24 },
  { name: 'includedItems', label: 'What Is Included', type: 'textarea', rows: 7, placeholder: 'One included item per line' },
  { name: 'excludedItems', label: 'What Is Not Included', type: 'textarea', rows: 7, placeholder: 'One excluded item per line' },
  { name: 'termsAndConditions', label: 'AMC Terms & Conditions', type: 'textarea', rows: 5 },
  {
    name: 'linkedServiceIds',
    label: 'Applicable Services',
    type: 'multiselect',
    lookupKey: 'services',
    lookupDescriptionKey: 'categoryName',
    placeholder: 'Select services that can use this AMC plan'
  },
  { name: 'autoInvoice', label: 'Auto Invoice', type: 'checkbox', defaultValue: false },
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
        { key: 'serviceKind', label: 'Type', render: (row) => row.serviceKind === 'addon' ? 'Add-on' : 'Primary' },
        { key: 'defaultPrice', label: 'Default Price', align: 'right', type: 'money' },
        { key: 'timeline', label: 'Timeline' },
        { key: 'gstRate', label: 'GST %', align: 'right' },
        { key: 'unit', label: 'Unit' },
        { key: 'isRecurring', label: 'Recurring', type: 'badge' },
        { key: 'sortOrder', label: 'Order', align: 'right' },
        { key: 'isActive', label: 'Active', type: 'badge' }
      ],
      fullWidthFields: ['parentServiceIds', 'description', 'featuresText', 'scopeOfWork', 'technologyStackIds', 'paymentPlan', 'termsAndConditions', 'afterCompletion']
    };
  }

  if (activeType === 'amc_type') {
    return {
      fields: AMC_TYPE_FIELDS,
      columns: [
        { key: 'name', label: 'AMC Plan' },
        { key: 'planCode', label: 'Code' },
        { key: 'defaultCost', label: 'Cost', type: 'money', align: 'right' },
        { key: 'defaultBillingCycle', label: 'Billing' },
        { key: 'supportHours', label: 'Support Hrs', align: 'right' },
        { key: 'responseSlaHours', label: 'SLA Hrs', align: 'right' },
        { key: 'isActive', label: 'Active', type: 'badge' }
      ],
      fullWidthFields: ['description', 'includedItems', 'excludedItems', 'termsAndConditions', 'linkedServiceIds']
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
      serviceKind: record.serviceKind || record.payload?.serviceKind || 'primary',
      parentServiceIds: Array.isArray(record.parentServiceIds) ? record.parentServiceIds : (Array.isArray(record.payload?.parentServiceIds) ? record.payload.parentServiceIds : []),
      minimumBudget: Number(record.minimumBudget ?? record.payload?.minimumBudget ?? 0),
      featuresText: record.featuresText || record.payload?.featuresText || '',
      scopeOfWork: record.scopeOfWork || record.payload?.scopeOfWork || '',
      technologyStack: record.technologyStack || record.payload?.technologyStack || '',
      technologyStackIds: Array.isArray(record.technologyStackIds) ? record.technologyStackIds : (Array.isArray(record.payload?.technologyStackIds) ? record.payload.technologyStackIds : []),
      timeline: record.timeline || record.payload?.timeline || '',
      paymentInfo: record.paymentInfo || record.payload?.paymentInfo || '',
      paymentPlan: normalizeServicePaymentPlan(
        record.paymentPlan || record.payload?.paymentPlan,
        record.paymentInfo || record.payload?.paymentInfo || ''
      ),
      termsAndConditions: record.termsAndConditions || record.payload?.termsAndConditions || '',
      afterCompletion: record.afterCompletion || record.payload?.afterCompletion || '',
      amcPlanId: record.amcPlanId || record.payload?.amcPlanId || '',
      nextYearCost: Number(record.nextYearCost ?? record.payload?.nextYearCost ?? 0),
      isRecurring: Boolean(record.isRecurring),
      isActive: record.isActive !== false,
      sortOrder: Number(record.sortOrder ?? 0),
      priceHistory: Array.isArray(record.priceHistory) ? record.priceHistory : Array.isArray(record.payload?.priceHistory) ? record.payload.priceHistory : [],
      lastPriceChangeAt: record.lastPriceChangeAt || record.payload?.lastPriceChangeAt || '',
      lastPriceChangeBy: record.lastPriceChangeBy || record.payload?.lastPriceChangeBy || null
    };
  }

  if (type === 'amc_type') {
    return {
      ...record,
      planCode: record.planCode || record.payload?.planCode || '',
      description: record.description || record.payload?.description || '',
      defaultCost: Number(record.defaultCost ?? record.payload?.defaultCost ?? 0),
      nextYearCost: Number(record.nextYearCost ?? record.payload?.nextYearCost ?? 0),
      defaultBillingCycle: record.defaultBillingCycle || record.payload?.defaultBillingCycle || 'Yearly',
      durationMonths: Number(record.durationMonths ?? record.payload?.durationMonths ?? 12),
      supportHours: Number(record.supportHours ?? record.payload?.supportHours ?? 0),
      responseSlaHours: Number(record.responseSlaHours ?? record.payload?.responseSlaHours ?? 24),
      includedItems: record.includedItems || record.payload?.includedItems || '',
      excludedItems: record.excludedItems || record.payload?.excludedItems || '',
      termsAndConditions: record.termsAndConditions || record.payload?.termsAndConditions || '',
      linkedServiceIds: Array.isArray(record.linkedServiceIds) ? record.linkedServiceIds : (Array.isArray(record.payload?.linkedServiceIds) ? record.payload.linkedServiceIds : []),
      autoInvoice: Boolean(record.autoInvoice ?? record.payload?.autoInvoice),
      isActive: record.isActive !== false,
      sortOrder: Number(record.sortOrder ?? 0)
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

export function MastersPage({ initialType = '', serviceMasterOnly = false }) {
  const { token, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [activeType, setActiveType] = useState(initialType || (serviceMasterOnly ? 'service' : 'expense_category'));
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
  const availableTypes = useMemo(
    () => serviceMasterOnly
      ? masterTypes.filter((type) => ['service', 'service_category'].includes(type.key))
      : masterTypes.filter((type) => !['service', 'service_category'].includes(type.key)),
    [serviceMasterOnly]
  );

  useEffect(() => {
    if (!initialType || initialType === activeType) return;
    setActiveType(initialType);
    setServiceStatusFilter('all');
    setSortKey('sortOrder');
    setSortDirection('asc');
    setActiveRecord(null);
    setDeleteTarget(null);
  }, [initialType, activeType]);

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
    serviceCategories: recordsByType.service_category || [],
    services: recordsByType.service || [],
    amcPlans: recordsByType.amc_type || [],
    technologies: STATIC_TECHNOLOGIES
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
    const total = availableTypes.reduce((sum, type) => sum + (recordsByType[type.key]?.length || 0), 0);
    const active = rows.filter((row) => row.isActive).length;
    const inactive = rows.length - active;
    return { total, active, inactive, current: rows.length };
  }, [availableTypes, recordsByType, rows]);

  function openCreate() {
    if (serviceMasterOnly && activeType === 'service') {
      navigate('/app/service-master/services/new');
      return;
    }
    setActiveRecord(null);
    setEditorOpen(true);
  }

  function openEdit(record) {
    if (serviceMasterOnly && activeType === 'service') {
      navigate(`/app/service-master/services/${record.id}/edit`);
      return;
    }
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
      if (['service', 'service_category'].includes(activeType)) {
        api.cache.invalidate('/invoices/service-catalog');
        api.cache.invalidate('/leads/options');
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
      if (['service', 'service_category'].includes(activeType)) {
        api.cache.invalidate('/invoices/service-catalog');
        api.cache.invalidate('/leads/options');
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
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-main)]">{serviceMasterOnly ? 'Service Master' : 'Masters'}</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {serviceMasterOnly
              ? (activeType === 'service'
                ? 'Manage quotation-ready services, pricing, features and add-ons.'
                : 'Organize services into reusable categories.')
              : 'Manage reusable lookup data used throughout the CRM.'}
          </p>
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

      {!serviceMasterOnly ? <div className="flex items-center gap-6 border-b border-slate-200 px-2 overflow-x-auto">
        {availableTypes.map((type) => (
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
      </div> : null}

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

export function ServiceMasterFormPage() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const { token, hasPermission } = useAuth();
  const [record, setRecord] = useState(null);
  const [lookups, setLookups] = useState({ serviceCategories: [], services: [], amcPlans: [], technologies: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const editing = Boolean(serviceId);
  const canWrite = hasPermission('masters.write');

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const [categoryResponse, serviceResponse, amcResponse] = await Promise.all([
          api.resources.list('/masters/service_category', token),
          api.resources.list('/masters/service', token),
          api.resources.list('/masters/amc_type', token)
        ]);
        if (!mounted) return;
        const serviceCategories = (categoryResponse.data || []).map((item) => normalizeMasterRecord('service_category', item));
        const services = (serviceResponse.data || []).map((item) => normalizeMasterRecord('service', item, { serviceCategories }));
        const amcPlans = (amcResponse.data || []).map((item) => normalizeMasterRecord('amc_type', item));
        const technologies = STATIC_TECHNOLOGIES;
        const current = editing ? services.find((item) => String(item.id) === String(serviceId)) : null;
        if (editing && !current) {
          toast.error('Service not found');
          navigate('/app/service-master/services', { replace: true });
          return;
        }
        setLookups({ serviceCategories, services, amcPlans, technologies });
        setRecord(current);
      } catch (error) {
        toast.error(error.message || 'Unable to load service form');
        navigate('/app/service-master/services', { replace: true });
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [editing, navigate, serviceId, token]);

  async function saveService(payload) {
    if (!canWrite) {
      toast.error('You do not have permission to save services');
      return;
    }
    setBusy(true);
    try {
      const servicePayload = {
        ...payload,
        paymentInfo: formatServicePaymentPlan(payload.paymentPlan)
      };
      if (editing) {
        await api.resources.update('/masters/service', serviceId, servicePayload, token);
      } else {
        await api.resources.create('/masters/service', servicePayload, token);
      }
      api.cache.invalidate('/masters/service');
      api.cache.invalidate('/invoices/service-catalog');
      api.cache.invalidate('/leads/options');
      toast.success(editing ? 'Service updated' : 'Service created');
      navigate('/app/service-master/services');
    } catch (error) {
      toast.error(error.message || 'Unable to save service');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="py-16 text-center text-sm text-[var(--text-muted)]">Loading service form...</div>;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <Card className="p-4">
        <ResourceForm
          key={record?.id || 'new-service'}
          fields={SERVICE_FIELDS}
          record={record}
          lookups={lookups}
          onSubmit={saveService}
          onCancel={() => navigate('/app/service-master/services')}
          submitLabel={editing ? 'Update Service' : 'Create Service'}
          busy={busy}
          fullWidthFields={['parentServiceIds', 'description', 'featuresText', 'scopeOfWork', 'technologyStackIds', 'paymentPlan', 'termsAndConditions', 'afterCompletion']}
          compact
          gridClassName="grid gap-x-4 gap-y-3 md:grid-cols-2 xl:grid-cols-12"
          defaultFieldClassName="xl:col-span-3"
          fieldClassNames={SERVICE_FIELD_CLASS_NAMES}
        />
      </Card>
    </div>
  );
}
