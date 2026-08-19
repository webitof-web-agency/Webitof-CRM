import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Save, GripVertical, Eye, EyeOff,
  ChevronDown, ChevronUp, ToggleLeft, ToggleRight, X, Send,
  Building2, Info, MapPin, FileText, AlertCircle,
  LayoutTemplate, User, Table2, Calculator
} from 'lucide-react';
import { toast } from 'sonner';
import { api, API_BASE_URL } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/Loader';
import { SearchableSelect } from '../../components/forms/SearchableSelect';
import { InvoicePreview } from '../../components/invoices/InvoicePreview';
import { formatFinancialYear } from '../../lib/financialYear';
import { normalizeInvoiceNumber } from '../../lib/invoiceNumber';
import {
  determineTaxType, getTaxLabel, validateGSTIN
} from '../../lib/taxCalculator';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function uid() { return Math.random().toString(36).slice(2, 10); }

const DEFAULT_ITEM = () => ({
  _id: uid(),
  serviceId: '',
  serviceName: '',
  serviceCategoryId: '',
  serviceCategoryName: '',
  description: '',
  hsnCode: '',
  quantity: 1,
  unit: 'Nos',
  rate: 0,
  taxRate: 18,
  gstRate: 18,
  discount: 0,
  manualRateOverride: false,
  serviceSnapshot: null,
  hidden: false
});

const UNIT_OPTIONS = ['Nos', 'Pcs', 'Hrs', 'Days', 'Months', 'Kg', 'Litre', 'Set', 'Job', 'Other'].map(u => ({ value: u, label: u }));
const GST_RATES = [0, 5, 12, 18, 28].map(r => ({ value: r, label: `${r}%` }));
const STATUS_OPTIONS = ['Draft', 'Sent', 'Paid', 'Partially Paid', 'Overdue', 'Cancelled'].map(s => ({ value: s, label: s }));

function formatInvoiceNumber(settings, invoiceDate, sequence = 1) {
  const prefix = settings?.invoice?.prefix || 'INV';
  const formattedSequence = String(sequence).padStart(3, '0');
  return `${prefix}-${formattedSequence}`;
}

function extractInvoiceSequence(invoiceNumber = '') {
  const match = String(invoiceNumber || '').match(/(\d+)\s*$/);
  return match ? Number(match[1]) : 0;
}

function getNextInvoiceSequence(invoices = [], currentId = null) {
  const maxSequence = (invoices || []).reduce((max, invoice) => {
    if (currentId && String(invoice.id) === String(currentId)) return max;
    const sequence = extractInvoiceSequence(invoice.invoiceNumber);
    return Number.isFinite(sequence) && sequence > max ? sequence : max;
  }, 0);
  return maxSequence + 1;
}

function roundToTwo(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function buildLineTaxBreakdown({
  taxableAmount = 0,
  gstRate = 0,
  taxType = 'none'
} = {}) {
  const amount = roundToTwo(taxableAmount);
  const rate = Number(gstRate) || 0;

  if (taxType === 'none' || taxType === 'igst_zero' || rate <= 0) {
    return {
      taxableAmount: amount,
      cgst: 0,
      sgst: 0,
      utgst: 0,
      igst: 0,
      gstAmount: 0,
      totalAmount: amount
    };
  }

  const gstAmount = roundToTwo((amount * rate) / 100);
  if (taxType === 'cgst_sgst') {
    const half = roundToTwo(gstAmount / 2);
    return {
      taxableAmount: amount,
      cgst: half,
      sgst: roundToTwo(gstAmount - half),
      utgst: 0,
      igst: 0,
      gstAmount,
      totalAmount: roundToTwo(amount + gstAmount)
    };
  }

  if (taxType === 'cgst_utgst') {
    const half = roundToTwo(gstAmount / 2);
    return {
      taxableAmount: amount,
      cgst: half,
      sgst: 0,
      utgst: roundToTwo(gstAmount - half),
      igst: 0,
      gstAmount,
      totalAmount: roundToTwo(amount + gstAmount)
    };
  }

  return {
    taxableAmount: amount,
    cgst: 0,
    sgst: 0,
    utgst: 0,
    igst: gstAmount,
    gstAmount,
    totalAmount: roundToTwo(amount + gstAmount)
  };
}

function resolveItemGstRate(item = {}, fallbackRate = 0, liveService = null) {
  const candidates = [
    item.serviceId ? liveService?.gstRate : null,
    item.serviceSnapshot?.gstRate,
    item.gstRate,
    item.taxRate,
    fallbackRate
  ];
  for (const value of candidates) {
    if (value === undefined || value === null || String(value).trim() === '') continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function resolveItemRate(item = {}, fallbackRate = 0, liveService = null) {
  const hasManualOverride = Boolean(item.manualRateOverride && Number(item.rate) > 0);
  const candidates = item.serviceId
    ? [
        hasManualOverride ? item.rate : null,
        liveService?.defaultPrice,
        item.serviceSnapshot?.defaultPrice,
        item.rate,
        fallbackRate
      ]
    : [
        item.rate,
        item.serviceSnapshot?.defaultPrice,
        fallbackRate
      ];
  for (const value of candidates) {
    if (value === undefined || value === null || String(value).trim() === '') continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

// ─── Drag & Drop Line Item Row ────────────────────────────────────────────────

function LineItemRow({
  item,
  index,
  onUpdate,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  isDragOver,
  serviceOptions = [],
  serviceLookup = new Map(),
  onApplyService,
  onClearService,
  canEditServiceRates = false
}) {
  const liveService = item.serviceId ? serviceLookup.get(String(item.serviceId)) : null;
  const effectiveRate = resolveItemRate(item, liveService?.defaultPrice ?? 0, liveService);
  const amount = (Number(item.quantity) || 0) * effectiveRate;
  const disc = (amount * (Number(item.discount) || 0)) / 100;
  const netAmount = amount - disc;

  return (
    <tr
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(index); }}
      onDrop={(e) => onDrop(e, index)}
      className={`group transition-all border-b border-slate-100 hover:bg-white/30 ${isDragOver ? 'border-t-2 border-[var(--primary)] bg-white/50' : ''} ${item.hidden ? 'opacity-60 grayscale-[30%]' : ''}`}
    >
      {/* Drag Handle */}
      <td className="py-3 pl-2 pr-1 w-8 align-top">
        <div className="mt-1.5 text-slate-300 cursor-grab active:cursor-grabbing hover:text-slate-600 transition-colors flex justify-center">
          <GripVertical size={16} />
        </div>
      </td>
      {/* Description */}
      <td className="py-3 px-1 min-w-[240px]">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <SearchableSelect
              options={serviceOptions}
              value={item.serviceId || ''}
              onChange={(val) => onApplyService?.(index, val)}
              placeholder="Select service..."
              searchPlaceholder="Search services..."
              className="min-w-0 flex-1"
              triggerClassName="px-2.5 py-1.5 text-xs rounded-[var(--radius-input,0.75rem)] bg-white border-slate-200 hover:border-slate-300 h-8"
            />
            {item.serviceId && (
              <button
                type="button"
                onClick={() => onClearService?.(index)}
                className="shrink-0 p-1.5 rounded-[var(--radius-input,0.75rem)] text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors border border-transparent hover:border-red-100"
                title="Clear linked service"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <input
            value={item.description}
            onChange={e => onUpdate(index, 'description', e.target.value)}
            placeholder={item.serviceId ? 'Service description' : 'Item description'}
            className="w-full text-xs bg-white border border-slate-200 rounded-[var(--radius-input,0.75rem)] px-2.5 py-1.5 hover:border-slate-300 focus:bg-white focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none transition-all placeholder:text-slate-400 text-slate-700"
          />
          <input
            value={item.hsnCode}
            onChange={e => onUpdate(index, 'hsnCode', e.target.value)}
            placeholder="HSN / SAC code"
            className="w-full text-[11px] bg-white border border-slate-200 rounded-[var(--radius-input,0.75rem)] px-2.5 py-1.5 hover:border-slate-300 focus:bg-white focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none transition-all placeholder:text-slate-400 text-slate-600"
          />
        </div>
      </td>
      {/* Qty */}
      <td className="py-3 px-1 w-20 align-top">
        <input
          type="number" min="0" step="0.01"
          value={item.quantity}
          onChange={e => onUpdate(index, 'quantity', e.target.value)}
          className="w-full text-xs text-center bg-white border border-slate-200 rounded-[var(--radius-input,0.75rem)] px-2 py-1.5 hover:border-slate-300 focus:bg-white focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none transition-all text-slate-700 font-medium"
        />
      </td>
      {/* Unit */}
      <td className="py-3 px-1 w-28 align-top">
        <SearchableSelect
          options={UNIT_OPTIONS}
          value={item.unit}
          onChange={val => onUpdate(index, 'unit', val)}
          placeholder="Unit"
          triggerClassName="px-2 py-1.5 text-xs rounded-[var(--radius-input,0.75rem)] bg-white border-slate-200 hover:border-slate-300 h-8"
        />
      </td>
      {/* Rate */}
      <td className="py-3 px-1 w-28 align-top">
        <div className="space-y-1">
          <input
            type="number" min="0" step="0.01"
            value={effectiveRate}
            onChange={e => onUpdate(index, 'rate', e.target.value)}
            disabled={Boolean(item.serviceId) && !canEditServiceRates}
            className={`w-full text-xs text-right bg-white border border-slate-200 rounded-[var(--radius-input,0.75rem)] px-2 py-1.5 hover:border-slate-300 focus:bg-white focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none transition-all text-slate-700 font-medium ${Boolean(item.serviceId) && !canEditServiceRates ? 'cursor-not-allowed opacity-60 bg-slate-100' : ''}`}
          />
          {item.serviceId && !canEditServiceRates && (
            <p className="text-[9px] text-amber-600 text-right leading-tight font-medium px-1 mt-0.5">Locked price</p>
          )}
        </div>
      </td>
      {/* Discount % */}
      <td className="py-3 px-1 w-20 align-top">
        <input
          type="number" min="0" max="100" step="0.1"
          value={item.discount}
          onChange={e => onUpdate(index, 'discount', e.target.value)}
          className="w-full text-xs text-center bg-white border border-slate-200 rounded-[var(--radius-input,0.75rem)] px-2 py-1.5 hover:border-slate-300 focus:bg-white focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none transition-all text-slate-700"
        />
      </td>
      {/* Amount */}
      <td className="py-3 px-2 w-28 text-right align-top">
        <div className="font-semibold text-slate-800 text-[13px] bg-white/50 border border-transparent rounded-[var(--radius-input,0.75rem)] px-2 py-1.5">
          ₹{fmt(netAmount)}
        </div>
      </td>
      {/* Actions */}
      <td className="py-3 pl-1 pr-1 w-16 align-top">
        <div className="flex items-center justify-center gap-1 bg-white border border-slate-200 rounded-[var(--radius-input,0.75rem)] p-0.5 shadow-sm">
          <button
            type="button"
            onClick={() => onUpdate(index, 'hidden', !item.hidden)}
            className={`p-1.5 rounded transition-colors ${item.hidden ? 'text-slate-400 bg-slate-100 hover:text-slate-600' : 'text-[var(--primary)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary)]'}`}
            title={item.hidden ? 'Show item' : 'Hide item'}
          >
            {item.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <div className="w-px h-3 bg-slate-200 mx-0.5"></div>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="p-1.5 rounded text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Delete item"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main Builder Page ────────────────────────────────────────────────────────

export function InvoiceBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user, hasPermission } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [serviceCatalog, setServiceCatalog] = useState([]);
  const [settings, setSettings] = useState({});
  const [logos, setLogos] = useState({});
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [showGST, setShowGST] = useState(true);
  const [showAdvance, setShowAdvance] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const dragIndex = useRef(null);
  const canEditServiceRates = useMemo(() => {
    const roleCodes = Array.isArray(user?.roles) ? user.roles.map((role) => String(role?.code || '').toLowerCase()) : [];
    return Boolean(
      user?.isSuperAdmin
      || hasPermission('masters.write')
      || hasPermission('settings.write')
      || roleCodes.some((code) => code === 'admin' || code === 'accountant')
    );
  }, [hasPermission, user]);

  const [draft, setDraft] = useState({
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    clientId: location.state?.clientId || '',
    projectId: location.state?.projectId || '',
    placeOfSupply: '',
    invoiceType: 'Regular',
    amountType: 'GST Extra',
    taxRate: 18,
    status: 'Draft',
    notes: '',
    bankDetails: '',
    bankAccountId: '',
    templateId: '',
    poNumber: '',
    discountType: 'percent',
    discountValue: 0,
    advanceAmount: 0,
    items: []
  });

  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const [clientsRes, projectsRes, settingsRes, invoicesRes, bankAccountsRes, serviceCatalogRes] = await Promise.all([
          api.resources.list('/clients', token),
          api.resources.list('/projects', token),
          api.settings.get(token),
          api.resources.list('/invoices', token).catch(() => ({ data: [] })),
          api.resources.list('/banking/accounts', token).catch(() => ({ data: [] })),
          api.resources.list('/invoices/service-catalog?activeOnly=false', token).catch(() => ({ data: [] }))
        ]);
        if (!active) return;
        setClients(clientsRes.data || []);
        setProjects(projectsRes.data || []);
        setInvoices(invoicesRes.data || []);
        setBankAccounts(bankAccountsRes.data || []);
        setServiceCatalog(serviceCatalogRes.data || []);
        const s = settingsRes.data || {};
        setSettings(s);
        setLogos(s.logos || {});
        const tmps = Array.isArray(s.invoiceTemplates) ? s.invoiceTemplates : [];
        setTemplates(tmps);
        const def = tmps.find(t => t.isDefault) || tmps[0] || null;
        if (def) setSelectedTemplateId(def.id);
        const serviceMap = new Map((serviceCatalogRes.data || []).map((service) => [String(service.id), service]));

        if (id && id !== 'new') {
          const invRes = await api.resources.get('/invoices', id, token);
          if (active) {
            const inv = invRes.data;
            const items = Array.isArray(inv.items) ? inv.items.map((item) => {
              const service = serviceMap.get(String(item.serviceId || ''));
              if (!service) {
                return {
                  _id: uid(),
                  ...item,
                  gstRate: Number(item.gstRate ?? item.taxRate ?? inv.taxRate ?? draft.taxRate ?? 18),
                  taxRate: Number(item.taxRate ?? item.gstRate ?? inv.taxRate ?? draft.taxRate ?? 18)
                };
              }
              const storedRate = Number(item.rate ?? 0);
              const serviceRate = Number(service.defaultPrice ?? item.rate ?? 0);
              const resolvedRate = storedRate > 0 ? storedRate : serviceRate;
              const resolvedGstRate = Number(item.gstRate ?? item.taxRate ?? service.gstRate ?? inv.taxRate ?? draft.taxRate ?? 18);
              return {
                _id: uid(),
                ...item,
                rate: resolvedRate,
                gstRate: resolvedGstRate,
                taxRate: resolvedGstRate,
                manualRateOverride: Boolean(item.manualRateOverride && storedRate > 0),
                serviceName: service.name || item.serviceName || '',
                serviceCategoryId: service.categoryId || item.serviceCategoryId || '',
                serviceCategoryName: service.categoryName || item.serviceCategoryName || '',
                hsnCode: item.hsnCode || service.sacCode || '',
                unit: item.unit || service.unit || 'Nos',
                serviceSnapshot: {
                  id: service.id,
                  name: service.name || '',
                  categoryId: service.categoryId || '',
                  categoryName: service.categoryName || '',
                  sacCode: service.sacCode || '',
                  unit: service.unit || 'Nos',
                  defaultPrice: Number(service.defaultPrice ?? 0),
                  gstRate: Number(service.gstRate ?? 18)
                }
              };
            }) : [];
            const existingBank = (bankAccountsRes.data || []).find(account => String(account.id) === String(inv.bankAccountId));
            setDraft({
              ...inv,
              invoiceNumber: normalizeInvoiceNumber(inv.invoiceNumber),
              bankAccount: inv.bankAccount || existingBank || null,
              invoiceDate: inv.invoiceDate?.slice(0, 10) || '',
              dueDate: inv.dueDate?.slice(0, 10) || '',
              bankAccountId: inv.bankAccountId || existingBank?.id || '',
              templateId: inv.templateId || (def?.id || ''),
              items
            });
            setShowGST(inv.amountType === 'GST Extra');
            setShowDiscount(Number(inv.discountValue || inv.discountAmount || 0) > 0);
            setShowAdvance(Number(inv.advanceAmount || 0) > 0);
            setSelectedTemplateId(inv.templateId || def?.id || '');
          }
        } else {
          const defaultDue = s?.invoice?.defaultDueDays || 30;
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + Number(defaultDue));
          const defaultBank = (bankAccountsRes.data || []).find(account => account.isPrimary) || (bankAccountsRes.data || [])[0] || null;
          const draftInvoiceDate = new Date().toISOString().slice(0, 10);
          const nextSequence = getNextInvoiceSequence(
            invoicesRes.data || [],
            null
          );
          setDraft(d => ({
            ...d,
            invoiceNumber: formatInvoiceNumber(s, draftInvoiceDate, nextSequence),
            dueDate: dueDate.toISOString().slice(0, 10),
            notes: s?.invoice?.terms || '',
            taxRate: s?.gst?.defaultRate ?? 18,
            bankAccountId: defaultBank?.id || '',
            templateId: def?.id || '',
            items: [DEFAULT_ITEM()]
          }));
          setSelectedTemplateId(def?.id || '');
        }
      } catch (err) {
        if (active) toast.error('Failed to load data');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadData();
    return () => { active = false; };
  }, [id, token, canEditServiceRates]);

  const selectedClient = useMemo(() => clients.find(c => String(c.id) === String(draft.clientId)), [clients, draft.clientId]);
  const selectedTemplate = useMemo(() => templates.find(t => t.id === selectedTemplateId) || null, [templates, selectedTemplateId]);
  const selectedBankAccount = useMemo(() => bankAccounts.find(account => String(account.id) === String(draft.bankAccountId)) || null, [bankAccounts, draft.bankAccountId]);
  const serviceLookup = useMemo(() => new Map(serviceCatalog.map((service) => [String(service.id), service])), [serviceCatalog]);
  const serviceOptions = useMemo(() => {
    return [...serviceCatalog]
      .sort((a, b) => {
        const activeA = a.isActive === false ? 1 : 0;
        const activeB = b.isActive === false ? 1 : 0;
        return activeA - activeB
          || String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true, sensitivity: 'base' });
      })
      .map((service) => ({
        value: String(service.id),
        label: `${service.name || 'Service'}${service.isActive === false ? ' (Inactive)' : ''}`,
        description: [
          service.isActive === false ? 'Inactive' : '',
          service.categoryName,
          service.sacCode ? `SAC ${service.sacCode}` : '',
          service.unit || '',
          Number(service.defaultPrice) > 0 ? `₹${fmt(service.defaultPrice)}` : '',
          Number.isFinite(Number(service.gstRate)) ? `GST ${Number(service.gstRate)}%` : ''
        ].filter(Boolean).join(' • '),
        disabled: service.isActive === false,
        color: service.isActive === false ? '#94a3b8' : ''
      }));
  }, [serviceCatalog]);

  useEffect(() => {
    if (!serviceCatalog.length) return;
    setDraft((currentDraft) => {
      let changed = false;
      const items = (currentDraft.items || []).map((item) => {
        if (!item?.serviceId) return item;
        const service = serviceLookup.get(String(item.serviceId));
        if (!service) return item;

        const liveRate = Number(service.defaultPrice ?? 0);
        const liveGstRate = Number(service.gstRate ?? 18);
        const currentRate = Number(item.rate ?? 0);
        const currentGstRate = Number(item.gstRate ?? item.taxRate ?? 0);
        const keepManualRate = Boolean(item.manualRateOverride && currentRate > 0);

        const next = { ...item };
        if (!keepManualRate && (currentRate <= 0 || !Number.isFinite(currentRate))) {
          next.rate = liveRate;
          changed = true;
        }
        if (!Number.isFinite(currentGstRate) || currentGstRate <= 0) {
          next.gstRate = liveGstRate;
          next.taxRate = liveGstRate;
          changed = true;
        }
        if (!next.serviceSnapshot || Number(next.serviceSnapshot.defaultPrice ?? 0) !== liveRate || Number(next.serviceSnapshot.gstRate ?? 0) !== liveGstRate) {
          next.serviceSnapshot = {
            ...(next.serviceSnapshot || {}),
            id: service.id,
            name: service.name || '',
            categoryId: service.categoryId || '',
            categoryName: service.categoryName || '',
            sacCode: service.sacCode || '',
            unit: service.unit || 'Nos',
            defaultPrice: liveRate,
            gstRate: liveGstRate
          };
          changed = true;
        }
        if (!next.serviceName) next.serviceName = service.name || '';
        if (!next.serviceCategoryId) next.serviceCategoryId = service.categoryId || '';
        if (!next.serviceCategoryName) next.serviceCategoryName = service.categoryName || '';
        if (!next.hsnCode) next.hsnCode = service.sacCode || '';
        if (!next.unit) next.unit = service.unit || 'Nos';
        return next;
      });

      if (!changed) return currentDraft;
      return { ...currentDraft, items };
    });
  }, [serviceCatalog, serviceLookup]);

  // Auto-fill client fields on selection
  useEffect(() => {
    if (!selectedClient) return;
    const hasGstin = Boolean(selectedClient.gstin);
    setShowGST(hasGstin && draft.amountType === 'GST Extra');
    setDraft(d => ({
      ...d,
      placeOfSupply: selectedClient.placeOfSupply || selectedClient.state || d.placeOfSupply || ''
    }));
  }, [selectedClient]);

  const taxType = useMemo(() => {
    if (!showGST || draft.amountType !== 'GST Extra') return 'none';
    return determineTaxType({
      gstSettings: settings.gst || {},
      companyStateCode: settings.company?.stateCode,
      client: selectedClient || {}
    });
  }, [showGST, draft.amountType, settings, selectedClient]);

  const totals = useMemo(() => {
    let subtotal = 0;
    const visibleItems = (draft.items || []).filter(i => !i.hidden);
    const lineRows = visibleItems.map((item) => {
      const quantity = Number(item.quantity) || 0;
      const service = item.serviceId ? serviceLookup.get(String(item.serviceId)) : null;
      const rate = resolveItemRate(item, service?.defaultPrice ?? 0, service);
      const lineAmount = quantity * rate;
      const lineDiscount = (lineAmount * (Number(item.discount) || 0)) / 100;
      const grossLine = lineAmount - lineDiscount;
      const effectiveRate = showGST && draft.amountType === 'GST Extra'
        ? resolveItemGstRate(item, draft.taxRate, service)
        : 0;
      return {
        item,
        quantity,
        rate,
        grossLine: roundToTwo(grossLine < 0 ? 0 : grossLine),
        effectiveRate: Number(effectiveRate) || 0
      };
    });

    lineRows.forEach((row) => {
      subtotal += row.grossLine;
    });

    // Global discount
    let discountAmount = 0;
    if (showDiscount && Number(draft.discountValue) > 0) {
      discountAmount = draft.discountType === 'percent'
        ? (subtotal * Number(draft.discountValue)) / 100
        : Number(draft.discountValue);
    }
    discountAmount = Math.min(discountAmount, subtotal);
    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const discountRatio = subtotal > 0 ? (discountAmount / subtotal) : 0;

    const taxTotals = lineRows.reduce((acc, row) => {
      const lineDiscountShare = roundToTwo(row.grossLine * discountRatio);
      const lineTaxable = roundToTwo(Math.max(0, row.grossLine - lineDiscountShare));
      const lineBreakdown = buildLineTaxBreakdown({
        taxableAmount: lineTaxable,
        gstRate: row.effectiveRate,
        taxType
      });
      acc.cgst += lineBreakdown.cgst;
      acc.sgst += lineBreakdown.sgst;
      acc.utgst += lineBreakdown.utgst;
      acc.igst += lineBreakdown.igst;
      acc.totalTax += lineBreakdown.gstAmount;
      return acc;
    }, { cgst: 0, sgst: 0, utgst: 0, igst: 0, totalTax: 0 });

    let totalAmount = taxType === 'none'
      ? taxableAmount
      : taxableAmount + taxTotals.totalTax;
    if (showAdvance && Number(draft.advanceAmount) > 0) {
      totalAmount = Math.max(0, totalAmount - Number(draft.advanceAmount));
    }

    return {
      subtotal,
      discountAmount,
      taxableAmount,
      taxRate: showGST && draft.amountType === 'GST Extra'
        ? Number(draft.taxRate) || 0
        : 0,
      taxType,
      cgst: roundToTwo(taxTotals.cgst),
      sgst: roundToTwo(taxTotals.sgst),
      utgst: roundToTwo(taxTotals.utgst),
      igst: roundToTwo(taxTotals.igst),
      totalTax: roundToTwo(taxTotals.totalTax),
      totalAmount
    };
  }, [draft.items, draft.taxRate, draft.discountType, draft.discountValue, draft.advanceAmount, taxType, showDiscount, showAdvance, showGST, serviceLookup]);

  const addItem = () => setDraft(d => ({ ...d, items: [...d.items, DEFAULT_ITEM()] }));
  const removeItem = (index) => setDraft(d => ({ ...d, items: d.items.filter((_, i) => i !== index) }));
  const updateItem = (index, field, value) => setDraft(d => {
    const items = [...d.items];
    const current = items[index] || DEFAULT_ITEM();
    items[index] = {
      ...current,
      [field]: value,
      ...(field === 'rate' ? { manualRateOverride: true } : {})
    };
    return { ...d, items };
  });
  const applyServiceToItem = (index, serviceId) => setDraft(d => {
    const service = serviceLookup.get(String(serviceId));
    const items = [...d.items];
    const defaultLineTaxRate = showGST && d.amountType === 'GST Extra'
      ? Number(d.taxRate || settings?.gst?.defaultRate || 0)
      : 0;

    if (!service) {
      items[index] = {
        ...(items[index] || DEFAULT_ITEM()),
        serviceId: '',
        serviceName: '',
        serviceCategoryId: '',
        serviceCategoryName: '',
        gstRate: defaultLineTaxRate,
        taxRate: defaultLineTaxRate,
        serviceSnapshot: null
      };
      return { ...d, items };
    }

    const existing = items[index] || DEFAULT_ITEM();
    const sameService = String(existing.serviceId || '') === String(service.id || '');
    const manualRateOverride = Boolean(existing.manualRateOverride);
    const nextRate = sameService && manualRateOverride && Number(existing.rate) > 0
      ? Number(existing.rate)
      : Number(service.defaultPrice ?? 0);

    items[index] = {
      ...existing,
      serviceId: service.id,
      serviceName: service.name || '',
      serviceCategoryId: service.categoryId || '',
      serviceCategoryName: service.categoryName || '',
      description: existing.description || service.name || '',
      hsnCode: existing.hsnCode || service.sacCode || '',
      unit: existing.unit || service.unit || 'Nos',
      rate: nextRate,
      gstRate: Number(service.gstRate ?? defaultLineTaxRate ?? 0),
      taxRate: Number(service.gstRate ?? defaultLineTaxRate ?? 0),
      manualRateOverride: false,
      serviceSnapshot: {
        id: service.id,
        name: service.name || '',
        categoryId: service.categoryId || '',
        categoryName: service.categoryName || '',
        sacCode: service.sacCode || '',
        unit: service.unit || 'Nos',
        defaultPrice: Number(service.defaultPrice ?? 0),
        gstRate: Number(service.gstRate ?? 18)
      }
    };

    return { ...d, items };
  });
  const clearServiceFromItem = (index) => setDraft(d => {
    const items = [...d.items];
    const current = items[index] || DEFAULT_ITEM();
    const fallbackTaxRate = showGST && d.amountType === 'GST Extra'
      ? Number(d.taxRate || settings?.gst?.defaultRate || 0)
      : 0;
    items[index] = {
      ...current,
      serviceId: '',
      serviceName: '',
      serviceCategoryId: '',
      serviceCategoryName: '',
      gstRate: fallbackTaxRate,
      taxRate: fallbackTaxRate,
      manualRateOverride: false,
      serviceSnapshot: null
    };
    return { ...d, items };
  });

  // Drag & Drop
  const onDragStart = (e, index) => {
    dragIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (index) => setDragOverIndex(index);
  const onDrop = (e, dropIndex) => {
    e.preventDefault();
    const from = dragIndex.current;
    if (from === null || from === dropIndex) return;
    setDraft(d => {
      const items = [...d.items];
      const [moved] = items.splice(from, 1);
      items.splice(dropIndex, 0, moved);
      return { ...d, items };
    });
    dragIndex.current = null;
    setDragOverIndex(null);
  };

  const handleSave = async (statusOverride) => {
    if (!draft.clientId) return toast.error('Client is required');
    if ((draft.items || []).filter(i => !i.hidden).length === 0) return toast.error('Add at least one visible item');
    if (selectedClient?.gstin) {
      const gstinErr = validateGSTIN(selectedClient.gstin);
      if (gstinErr) return toast.error(`Client GSTIN: ${gstinErr}`);
    }

    setSaving(true);
    try {
      const { bankAccount, ...draftPayload } = draft;
      const payload = {
        ...draftPayload,
        status: statusOverride || draft.status,
        templateId: selectedTemplateId || draft.templateId || null,
        amountType: showGST ? 'GST Extra' : 'No Tax',
        discountValue: showDiscount ? draft.discountValue : 0,
        discountType: draft.discountType || 'percent',
        advanceAmount: showAdvance ? draft.advanceAmount : 0,
        taxableAmount: totals.taxableAmount,
        cgst: totals.cgst,
        sgst: totals.sgst,
        igst: totals.igst,
        gstAmount: totals.totalTax,
        totalAmount: totals.totalAmount,
        taxType: totals.taxType,
        taxRate: totals.taxRate,
          items: draft.items.map(({ _id, ...rest }) => ({
            ...rest,
            rate: resolveItemRate(rest, serviceLookup.get(String(rest.serviceId || ''))?.defaultPrice ?? 0, serviceLookup.get(String(rest.serviceId || '')) || null),
            gstRate: resolveItemGstRate(rest, draft.taxRate, serviceLookup.get(String(rest.serviceId || '')) || null),
            taxRate: resolveItemGstRate(rest, draft.taxRate, serviceLookup.get(String(rest.serviceId || '')) || null)
          }))
      };

      if (id && id !== 'new') {
        await api.resources.update('/invoices', id, payload, token);
        toast.success('Invoice updated');
      } else {
        const res = await api.resources.create('/invoices', payload, token);
        toast.success('Invoice created');
        const newId = res.data?.id;
        if (newId) { navigate(`/app/invoices/${newId}`); return; }
      }
      navigate('/app/invoices');
    } catch (err) {
      toast.error(err.message || 'Failed to save invoice');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  const clientOptions = clients.map(c => ({ value: String(c.id), label: c.companyName || c.name || 'Unknown' }));
  const templateColor = selectedTemplate?.primaryColor || 'var(--primary)';
  const uiColor = settings.branding?.primaryColor || 'var(--primary)';
  const bankOptions = bankAccounts.map((bank) => ({
    value: String(bank.id),
    label: `${bank.bankName || 'Bank'}${bank.accountHolderName ? ` • ${bank.accountHolderName}` : ''}${bank.accountNumber ? ` • ${String(bank.accountNumber).slice(-4)}` : ''}`
  }));
  const currentInvoiceId = id && id !== 'new' ? id : null;
  const nextInvoiceNumber = formatInvoiceNumber(
    settings,
    draft.invoiceDate || new Date().toISOString().slice(0, 10),
    getNextInvoiceSequence(invoices, currentInvoiceId)
  );
  const selectedFinancialYear = formatFinancialYear(draft.invoiceDate || new Date().toISOString().slice(0, 10));

  const projectOptions = projects.filter(p => !draft.clientId || String(p.clientId) === String(draft.clientId)).map(p => ({ value: String(p.id), label: p.title }));
  const templateOptions = [{ value: '', label: 'Default Template' }, ...templates.map(t => ({ value: t.id, label: t.name }))];

  return (
    <div className="flex flex-col gap-0 h-[calc(100vh-4rem)] overflow-hidden" style={{ minHeight: 0 }}>
      {/* Top Bar (Simplified) */}
      <div className="shrink-0 flex items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate('/app/invoices')} className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="h-5 w-px bg-slate-300 mx-2" />
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">{id && id !== 'new' ? 'Edit Invoice' : 'New Invoice'}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => handleSave()} disabled={saving} className="shadow-sm">
            {saving ? 'Saving…' : <><Save size={16} className="mr-1.5" /> Save Draft</>}
          </Button>
          <Button onClick={() => handleSave('Sent')} disabled={saving} className="shadow-sm shadow-[var(--primary)]/20">
            <Send size={16} className="mr-1.5" /> Save & Send
          </Button>
        </div>
      </div>

      {/* Split Pane */}
      <div className="flex-1 flex overflow-hidden min-h-0 px-4 py-4 gap-4 bg-white/50">
        {/* ── Left: Form ──────────────────────────────────────────── */}
        <div className="w-[55%] shrink-0 overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-8 custom-scrollbar">

          {/* ── Section 1: Client & Basic Info ── */}
          <div className="space-y-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Invoice Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-600">Client <span className="text-red-500">*</span></label>
                <SearchableSelect
                  options={clientOptions}
                  value={String(draft.clientId || '')}
                  onChange={val => setDraft(d => ({ ...d, clientId: val, projectId: '' }))}
                  placeholder="Select client…"
                />
                {selectedClient && (
                  <div className="mt-2 rounded-xl bg-white border border-slate-200 shadow-sm px-3 py-2.5 text-xs text-slate-600 space-y-1">
                    {selectedClient.billingAddress && <div className="flex items-start gap-1.5"><MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" /> <span>{selectedClient.billingAddress}, {selectedClient.city}, {selectedClient.state}</span></div>}
                    {selectedClient.gstin && <div className="flex items-center gap-1.5"><FileText size={14} className="text-slate-400 shrink-0" /> <span>GSTIN: <strong className="text-slate-800">{selectedClient.gstin}</strong></span></div>}
                    {!selectedClient.gstin && <div className="flex items-center gap-1.5 text-amber-600"><AlertCircle size={14} className="shrink-0" /> <span>No GSTIN — GST will be disabled</span></div>}
                  </div>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Template</label>
                <SearchableSelect
                  options={templateOptions}
                  value={selectedTemplateId}
                  onChange={val => {
                    setSelectedTemplateId(val);
                    setDraft(d => ({ ...d, templateId: val }));
                  }}
                  placeholder="Template"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Project</label>
                <SearchableSelect
                  options={[{ value: '', label: '— None —' }, ...projectOptions]}
                  value={String(draft.projectId || '')}
                  onChange={val => setDraft(d => ({ ...d, projectId: val }))}
                  placeholder="Link to project…"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Status</label>
                <SearchableSelect options={STATUS_OPTIONS} value={draft.status} onChange={val => setDraft(d => ({ ...d, status: val }))} />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="block text-xs font-semibold text-slate-600">Invoice Number <span className="text-red-500">*</span></label>
                  <button
                    type="button"
                    onClick={() => setDraft(d => ({ ...d, invoiceNumber: nextInvoiceNumber }))}
                    className="text-[11px] font-semibold text-[var(--primary)] hover:opacity-80"
                  >
                    Generate
                  </button>
                </div>
                <Input value={draft.invoiceNumber} onChange={e => setDraft(d => ({ ...d, invoiceNumber: e.target.value }))} className="text-sm" />
                <p className="mt-1 text-[11px] text-slate-400">Editable field. Click Generate if you want the system format.</p>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">Financial year: {selectedFinancialYear}</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">PO Number</label>
                <Input value={draft.poNumber || ''} onChange={e => setDraft(d => ({ ...d, poNumber: e.target.value }))} placeholder="Optional" className="text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Invoice Date</label>
                <Input type="date" value={draft.invoiceDate} onChange={e => setDraft(d => ({ ...d, invoiceDate: e.target.value }))} className="text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Due Date</label>
                <Input type="date" value={draft.dueDate} onChange={e => setDraft(d => ({ ...d, dueDate: e.target.value }))} className="text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Place of Supply</label>
                <Input value={draft.placeOfSupply || ''} onChange={e => setDraft(d => ({ ...d, placeOfSupply: e.target.value }))} className="text-sm" />
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* ── Section 2: Line Items ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Line Items</h3>
              <button type="button" onClick={addItem} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors" style={{ color: uiColor, backgroundColor: `${uiColor}15` }}>
                <Plus size={13} /> Add Item
              </button>
            </div>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full border-collapse text-xs min-w-[860px]">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="w-8 pb-3" />
                    <th className="text-left pb-3 text-slate-500 font-bold text-[10px] uppercase tracking-wider px-1">Description / HSN</th>
                    <th className="text-center pb-3 text-slate-500 font-bold text-[10px] uppercase tracking-wider px-1 w-20">Qty</th>
                    <th className="text-center pb-3 text-slate-500 font-bold text-[10px] uppercase tracking-wider px-1 w-28">Unit</th>
                    <th className="text-right pb-3 text-slate-500 font-bold text-[10px] uppercase tracking-wider px-1 w-28">Rate (₹)</th>
                    <th className="text-center pb-3 text-slate-500 font-bold text-[10px] uppercase tracking-wider px-1 w-20">Disc%</th>
                    <th className="text-right pb-3 text-slate-500 font-bold text-[10px] uppercase tracking-wider px-2 w-28">Amount</th>
                    <th className="w-16 pb-3" />
                  </tr>
                </thead>
                <tbody onDragLeave={() => setDragOverIndex(null)}>
                  {draft.items.map((item, index) => (
                    <LineItemRow
                      key={item._id}
                      item={item}
                      index={index}
                      onUpdate={updateItem}
                      onRemove={removeItem}
                      onDragStart={onDragStart}
                      onDragOver={onDragOver}
                      onDrop={onDrop}
                      isDragOver={dragOverIndex === index}
                      serviceOptions={serviceOptions}
                      serviceLookup={serviceLookup}
                      onApplyService={applyServiceToItem}
                      onClearService={clearServiceFromItem}
                      canEditServiceRates={canEditServiceRates}
                    />
                  ))}
                  {draft.items.length === 0 && (
                    <tr><td colSpan={8} className="py-6 text-center text-slate-400 text-xs">No items. Click "Add Item" to start.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* ── Section 3: GST & Tax ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Tax Settings</h3>
              <button type="button" onClick={() => setShowGST(v => !v)} className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors" style={showGST ? { color: uiColor, backgroundColor: `${uiColor}15` } : { backgroundColor: '#f1f5f9', color: '#64748b' }}>
                {showGST ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                GST {showGST ? 'ON' : 'OFF'}
              </button>
            </div>
            {showGST && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">GST Rate</label>
                  <SearchableSelect options={GST_RATES} value={draft.taxRate} onChange={val => setDraft(d => ({ ...d, taxRate: Number(val) }))} />
                </div>
                <div className="flex items-end pb-0.5">
                  <div 
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ color: uiColor, backgroundColor: `${uiColor}15` }}
                  >
                    {getTaxLabel(taxType)}
                  </div>
                </div>
                <div className="col-span-2 rounded-xl bg-white border border-slate-200 shadow-sm px-4 py-3 space-y-2">
                  <div className="flex justify-between text-xs text-slate-600"><span>Subtotal</span><span className="font-medium">₹{fmt(totals.taxableAmount)}</span></div>
                  {taxType === 'cgst_sgst' && <>
                    <div className="flex justify-between text-xs text-slate-600"><span>CGST ({totals.taxRate / 2}%)</span><span>₹{fmt(totals.cgst)}</span></div>
                    <div className="flex justify-between text-xs text-slate-600"><span>SGST ({totals.taxRate / 2}%)</span><span>₹{fmt(totals.sgst)}</span></div>
                  </>}
                  {taxType === 'igst' && <div className="flex justify-between text-xs text-slate-600"><span>IGST ({totals.taxRate}%)</span><span>₹{fmt(totals.igst)}</span></div>}
                  <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-2 mt-1 text-slate-800"><span>Total</span><span>₹{fmt(totals.totalAmount)}</span></div>
                </div>
              </div>
            )}
            {!showGST && (
              <div className="rounded-xl bg-white shadow-sm border border-slate-200 px-4 py-3">
                <div className="flex justify-between text-sm font-bold text-slate-800"><span>Total (No Tax)</span><span>₹{fmt(totals.taxableAmount)}</span></div>
              </div>
            )}
          </div>

          <hr className="border-slate-100" />

          {/* ── Section 4: Discount ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Discount</h3>
              <button type="button" onClick={() => setShowDiscount(v => !v)} className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors" style={showDiscount ? { color: uiColor, backgroundColor: `${uiColor}15` } : { backgroundColor: '#f1f5f9', color: '#64748b' }}>
                {showDiscount ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                {showDiscount ? 'Applied' : 'None'}
              </button>
            </div>
            {showDiscount && (
              <div className="flex items-center gap-2">
                <SearchableSelect options={[{ value: 'percent', label: 'Percent (%)' }, { value: 'flat', label: 'Flat (₹)' }]} value={draft.discountType} onChange={val => setDraft(d => ({ ...d, discountType: val }))} className="w-36" />
                <Input type="number" min="0" value={draft.discountValue} onChange={e => setDraft(d => ({ ...d, discountValue: e.target.value }))} className="w-28 text-sm" />
                {Number(totals.discountAmount) > 0 && <span className="text-xs text-emerald-600 font-semibold">-₹{fmt(totals.discountAmount)}</span>}
              </div>
            )}
          </div>

          <hr className="border-slate-100" />

          {/* ── Section 5: Advance / TDS ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Advance Paid</h3>
              <button type="button" onClick={() => setShowAdvance(v => !v)} className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors" style={showAdvance ? { color: uiColor, backgroundColor: `${uiColor}15` } : { backgroundColor: '#f1f5f9', color: '#64748b' }}>
                {showAdvance ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                {showAdvance ? 'Applied' : 'None'}
              </button>
            </div>
            {showAdvance && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">Advance (₹)</label>
                <Input type="number" min="0" value={draft.advanceAmount} onChange={e => setDraft(d => ({ ...d, advanceAmount: e.target.value }))} className="w-36 text-sm" />
              </div>
            )}
          </div>

          <hr className="border-slate-100" />

          {/* ── Section 6: Notes & Bank ── */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Notes & Terms</h3>
            <textarea
              value={draft.notes || ''}
              onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
              placeholder="Payment terms, delivery details, thank-you note…"
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-[var(--primary)] focus:outline-none resize-none"
            />
            <div className="pt-1 space-y-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-400">Bank Account</label>
              {bankOptions.length > 0 ? (
                <SearchableSelect
                  options={[{ value: '', label: 'Default company bank' }, ...bankOptions]}
                  value={String(draft.bankAccountId || '')}
                  onChange={val => setDraft(d => ({ ...d, bankAccountId: val }))}
                  placeholder="Select bank account"
                />
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white shadow-sm px-4 py-3 text-xs text-slate-500">
                  No bank accounts found. The invoice preview will use the company bank settings.
                </div>
              )}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-3 text-xs text-slate-500">
                {selectedBankAccount ? (
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-800 flex items-center gap-2">
                      <Building2 size={14} className="text-indigo-500" />
                      {selectedBankAccount.bankName || 'Bank'}
                    </div>
                    <div className="pl-5">{selectedBankAccount.accountHolderName || '-'}</div>
                    <div className="pl-5">{selectedBankAccount.accountNumber ? `•••• ${String(selectedBankAccount.accountNumber).slice(-4)}` : 'Account number hidden'}</div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2"><Info size={14} className="text-[var(--primary)] shrink-0" /> <span>Default bank details from Settings will be used in preview and public invoice.</span></div>
                )}
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* ── Section 7: Layout Configurator ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Invoice Structure</h3>
              <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Drag to reorder</span>
            </div>
            <div className="space-y-1.5" onDragLeave={() => setDragOverIndex(null)}>
              {(draft.layoutOrder || selectedTemplate?.layoutOrder || ['header', 'billTo', 'table', 'totals', 'notes', 'bank']).map((blockId, index) => {
                const blockLabels = {
                  header: 'Header (Logo & Invoice Details)',
                  billTo: 'Billed To & Supply Details',
                  table: 'Line Items Table',
                  totals: 'Totals & Tax Summary',
                  notes: 'Notes & Terms',
                  bank: 'Bank Details'
                };
                const isHidden = draft.hiddenBlocks?.includes(blockId);
                const isDragOver = dragOverIndex === `block-${index}`;
                return (
                  <div
                    key={blockId}
                    draggable
                    onDragStart={(e) => {
                      dragIndex.current = `block-${index}`;
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverIndex(`block-${index}`);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const fromStr = dragIndex.current;
                      if (!fromStr || !fromStr.startsWith('block-')) return;
                      const from = parseInt(fromStr.split('-')[1]);
                      if (from === index) return;
                      setDraft(d => {
                        const newOrder = [...(d.layoutOrder || selectedTemplate?.layoutOrder || ['header', 'billTo', 'table', 'totals', 'notes', 'bank'])];
                        const [moved] = newOrder.splice(from, 1);
                        newOrder.splice(index, 0, moved);
                        return { ...d, layoutOrder: newOrder };
                      });
                      dragIndex.current = null;
                      setDragOverIndex(null);
                    }}
                    className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${isDragOver ? 'border-[var(--primary)] shadow-md ring-1 ring-[var(--primary)] bg-white' : 'border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-slate-300'} ${isHidden ? 'opacity-70 !bg-white' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="cursor-grab text-slate-300 hover:text-slate-500 flex items-center justify-center">
                        <GripVertical size={16} />
                      </div>
                      <div className={`p-2 rounded-lg ${isHidden ? 'bg-slate-200 text-slate-500' : 'bg-[var(--primary)]/10 text-[var(--primary)]'}`}>
                        {blockId === 'header' && <LayoutTemplate size={16} />}
                        {blockId === 'billTo' && <User size={16} />}
                        {blockId === 'table' && <Table2 size={16} />}
                        {blockId === 'totals' && <Calculator size={16} />}
                        {blockId === 'notes' && <FileText size={16} />}
                        {blockId === 'bank' && <Building2 size={16} />}
                        {!['header','billTo','table','totals','notes','bank'].includes(blockId) && <LayoutTemplate size={16} />}
                      </div>
                      <span className={`text-[13px] font-semibold ${isHidden ? 'text-slate-500' : 'text-slate-700'}`}>
                        {blockLabels[blockId] || blockId}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDraft(d => {
                        const currentHidden = d.hiddenBlocks || [];
                        const newHidden = isHidden ? currentHidden.filter(b => b !== blockId) : [...currentHidden, blockId];
                        return { ...d, hiddenBlocks: newHidden };
                      })}
                      className={`p-2 rounded-lg transition-colors ${isHidden ? 'text-slate-400 hover:bg-slate-200 hover:text-slate-600' : 'text-[var(--primary)] hover:bg-[var(--primary)]/20 hover:text-[var(--primary)]'}`}
                      title={isHidden ? "Show block" : "Hide block"}
                    >
                      {isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Right: Live Preview ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-sm flex justify-center py-8 custom-scrollbar relative">
          <div className="absolute top-4 right-4 bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-1 rounded-[var(--radius-input,0.75rem)] text-[10px] font-bold tracking-wider flex items-center gap-1.5 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE
          </div>
          <div className="w-full max-w-[210mm]">
            <InvoicePreview
              draft={draft}
              client={selectedClient}
              company={settings.company || {}}
              logos={logos}
              template={selectedTemplate}
              bankAccount={draft.bankAccount || selectedBankAccount}
              bankSettings={settings.bank || {}}
              invoiceSettings={settings}
              totals={totals}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
