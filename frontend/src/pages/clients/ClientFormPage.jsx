import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, SaveAll } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { SearchableSelect } from '../../components/forms/SearchableSelect';
import { PhoneInput } from '../../components/forms/PhoneInput';
import { INDIA_STATE_OPTIONS, getCitiesByState, getStateCode } from '../../data/indiaLocations';
import { normalizeSharedLabels, mergeSharedLabelOptions } from '../../lib/labels';

const EMPTY_FORM = {
  type: 'Organization',
  name: '',
  companyName: '',
  contactPerson: '',
  managers: '',
  source: '',
  email: '',
  billingAddress: '',
  shippingAddress: '',
  city: '',
  state: '',
  stateCode: '',
  country: 'India',
  pincode: '',
  mobile: '',
  website: '',
  vatNumber: '',
  gstNumber: '',
  currency: '',
  currencySymbol: '',
  labels: [],
  followUpDate: '',
  openingBalance: '',
  status: 'Active',
  assignedTo: ''
};

function normalizeLabelOptions(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      if (typeof item === 'string') {
        return { value: item, label: item, color: '#64748b' };
      }
      if (item && typeof item === 'object') {
        const label = item.label || item.value || '';
        return {
          value: item.value || label,
          label,
          color: item.color || item.badgeColor || '#64748b'
        };
      }
      return null;
    })
    .filter(Boolean);
}

function mergeLabelOptions(baseOptions = [], selectedLabels = []) {
  const map = new Map(baseOptions.map((item) => [String(item.value), item]));
  const labels = Array.isArray(selectedLabels)
    ? selectedLabels
    : typeof selectedLabels === 'string'
      ? selectedLabels.split(',')
      : [];
  labels.forEach((label) => {
    const value = String(label || '').trim();
    if (!value || map.has(value)) return;
    map.set(value, { value, label: value, color: '#64748b' });
  });
  return Array.from(map.values());
}

function parseLabels(value) {
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
      return Array.isArray(parsed) ? parseLabels(parsed) : [];
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }

  return [];
}

function formatDateInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const direct = raw.match(/^\d{4}-\d{2}-\d{2}/);
  if (direct) return direct[0];
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function formatPhoneValue(value, fallbackDialCode = '91') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('+')) return raw;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const dial = String(fallbackDialCode || '').replace(/\D/g, '');
  if (dial && !digits.startsWith(dial)) {
    return `+${dial}${digits}`;
  }
  return `+${digits}`;
}

function ClientFormRow({ label, children, required }) {
  return (
    <div className="flex flex-col gap-1 py-2 md:flex-row md:items-start md:gap-4">
      <div className="shrink-0 pt-2 text-sm font-medium text-slate-500 md:w-32 lg:w-40">
        {label} {required && <span className="text-red-500">*</span>}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function normalizeClientRecord(record = {}) {
  const normalizedType = record.clientType === 'Person' || record.type === 'Person'
    ? 'Person'
    : 'Organization';
  return {
    type: normalizedType,
    name: record.name || record.companyName || '',
    companyName: record.companyName || record.name || '',
    contactPerson: record.contactPerson || record.ownerName || record.primaryContact || '',
    managers: record.managers || '',
    source: record.source || '',
    email: record.email || '',
    billingAddress: record.billingAddress || '',
    shippingAddress: record.shippingAddress || '',
    city: record.city || '',
    state: record.state || '',
    stateCode: record.stateCode || '',
    country: record.country || 'India',
    pincode: record.pincode || '',
    mobile: formatPhoneValue(record.mobile || record.phone || '', '91'),
    website: record.website || '',
    vatNumber: record.vatNumber || '',
    gstNumber: record.gstNumber || '',
    currency: record.currency || '',
    currencySymbol: record.currencySymbol || '',
    labels: parseLabels(record.labels),
    followUpDate: formatDateInput(record.followUpDate),
    openingBalance: record.openingBalance != null ? String(record.openingBalance) : '',
    status: record.status || 'Active',
    assignedTo: record.assignedTo || ''
  };
}

export function ClientFormPage({
  open: openProp,
  onClose: onCloseProp,
  onSuccess: onSuccessProp,
  clientId: clientIdProp = null,
  initialData: initialDataProp = null
} = {}) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const effectiveClientId = clientIdProp || initialDataProp?.id || id;
  const isEdit = Boolean(effectiveClientId);
  const isOpen = openProp ?? true;

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const initialRecord = initialDataProp ? { ...initialDataProp } : null;
        const [settingsRes, usersRes, clientRes] = await Promise.allSettled([
          api.settings.get(token),
          api.resources.list('/users/lookup', token, ''),
          isEdit && effectiveClientId
            ? api.resources.get('/clients', effectiveClientId, token)
            : Promise.resolve(null)
        ]);

        if (!mounted) return;

        if (settingsRes.status === 'fulfilled') {
          setSettings(settingsRes.value?.data || null);
        }

        if (usersRes.status === 'fulfilled') {
          setUsers(usersRes.value?.data || []);
        }

        if (clientRes?.status === 'fulfilled') {
          setFormData(normalizeClientRecord({ ...initialRecord, ...(clientRes.value?.data || {}) }));
        } else if (initialRecord) {
          setFormData(normalizeClientRecord(initialRecord));
        } else {
          setFormData(EMPTY_FORM);
        }
      } catch (error) {
        if (mounted) toast.error(error.message || 'Failed to load client form');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [effectiveClientId, initialDataProp, isEdit, isOpen, token]);

  const set = (field, value) => setFormData((prev) => {
    const next = { ...prev, [field]: value };
    if (field === 'state') {
      next.stateCode = getStateCode(value) || '';
      next.city = '';
    }
    if (field === 'country') {
      next.country = value;
    }
    return next;
  });

  const sourceOptions = useMemo(() => {
    const items = settings?.sources?.clients?.length ? settings.sources.clients : (settings?.sources?.leads || []);
    return items.map((item) => {
      if (typeof item === 'string') return { value: item, label: item };
      return { value: item.value || item.label, label: item.label || item.value };
    });
  }, [settings]);

  const labelOptions = useMemo(() => {
    return mergeSharedLabelOptions(normalizeSharedLabels(settings?.labels || []), formData.labels);
  }, [settings, formData.labels]);

  const userOptions = useMemo(() => {
    return users.map((u) => ({ value: String(u.id), label: u.fullName || u.username }));
  }, [users]);

  const cityOptions = getCitiesByState(formData.state).map((city) => ({ value: city, label: city }));

  const statusOptions = (settings?.statuses?.clients?.length ? settings.statuses.clients : [
    { label: 'Active', color: '#10b981' },
    { label: 'Inactive', color: '#64748b' }
  ]).map((status) => {
    const label = typeof status === 'string' ? status : status.label;
    return { value: label, label };
  });

  async function handleSubmit(stayOnPage = false, event) {
    event?.preventDefault?.();

    if (!formData.name.trim() && !formData.companyName.trim()) {
      toast.error('Client name or company name is required');
      return;
    }

    setBusy(true);
    try {
      const payload = {
        clientType: formData.type,
        name: formData.type === 'Person'
          ? (formData.name || formData.companyName || '').trim()
          : (formData.companyName || formData.name || '').trim(),
        companyName: formData.companyName.trim(),
        contactPerson: formData.contactPerson || '',
        managers: formData.managers || '',
        source: formData.source || '',
        email: formData.email || '',
        billingAddress: formData.billingAddress || '',
        shippingAddress: formData.shippingAddress || '',
        city: formData.city || '',
        state: formData.state || '',
        stateCode: formData.stateCode || '',
        country: formData.country || 'India',
        pincode: formData.pincode || '',
        mobile: formatPhoneValue(formData.mobile || '', '91'),
        website: formData.website || '',
        vatNumber: formData.vatNumber || '',
        gstNumber: formData.gstNumber || '',
        currency: formData.currency || '',
        currencySymbol: formData.currencySymbol || '',
        labels: Array.isArray(formData.labels) ? formData.labels : parseLabels(formData.labels),
        followUpDate: formData.followUpDate || '',
        openingBalance: formData.openingBalance === '' ? 0 : Number(formData.openingBalance || 0),
        status: formData.status || 'Active',
        assignedTo: formData.assignedTo || null
      };

      const response = isEdit
        ? await api.resources.update('/clients', effectiveClientId, payload, token)
        : await api.resources.create('/clients', payload, token);

      toast.success(isEdit ? 'Client updated successfully' : 'Client created successfully');
      onSuccessProp?.(response.data || payload);

      if (stayOnPage) {
        if (!isEdit) {
          setFormData((current) => ({ ...EMPTY_FORM, type: current.type }));
        }
        return;
      }

      if (onCloseProp) {
        onCloseProp();
        return;
      }

      navigate(isEdit ? `/app/clients/${effectiveClientId}` : `/app/clients/${response.data?.id || response.data?.id?.toString?.() || ''}`);
    } catch (error) {
      toast.error(error.message || 'Failed to save client');
    } finally {
      setBusy(false);
    }
  }

  function handleClose() {
    if (onCloseProp) {
      onCloseProp();
      return;
    }
    navigate(isEdit ? `/app/clients/${effectiveClientId}` : '/app/clients');
  }

  if (!isOpen) return null;

  return (
      <Modal
      open={isOpen}
      onClose={handleClose}
      title={isEdit ? 'Edit Client' : 'Add Client'}
      width="min(980px, 96vw)"
      footer={(
        <div className="flex justify-end gap-3 w-full">
          <Button type="button" variant="outline" className="shadow-sm" onClick={handleClose} disabled={busy}>
            Close
          </Button>
          <Button
            type="button"
            variant="outline"
            className="shadow-sm font-medium"
            onClick={() => handleSubmit(true)}
            disabled={busy}
          >
            {busy ? 'Saving...' : (
              <span className="flex items-center">
                <SaveAll size={16} className="mr-2" />
                Save & continue
              </span>
            )}
          </Button>
          <Button type="button" onClick={(e) => handleSubmit(false, e)} disabled={busy}>
            {busy ? 'Saving...' : (
              <span className="flex items-center">
                <Save size={16} className="mr-2" />
                Save
              </span>
            )}
          </Button>
        </div>
      )}
    >
      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : (
        <form className="flex flex-col" onSubmit={(event) => handleSubmit(false, event)}>
          <ClientFormRow label="Type">
            <div className="flex items-center gap-4 pt-1.5">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="type"
                  value="Organization"
                  checked={formData.type === 'Organization'}
                  onChange={(e) => set('type', e.target.value)}
                  className="!appearance-auto"
                  style={{ accentColor: 'var(--primary)' }}
                />
                <span className="text-sm text-slate-700">Organization</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="type"
                  value="Person"
                  checked={formData.type === 'Person'}
                  onChange={(e) => set('type', e.target.value)}
                  className="!appearance-auto"
                  style={{ accentColor: 'var(--primary)' }}
                />
                <span className="text-sm text-slate-700">Person</span>
              </label>
            </div>
          </ClientFormRow>

          {formData.type === 'Person' ? (
            <ClientFormRow label="Name" required>
              <Input value={formData.name} onChange={(e) => set('name', e.target.value)} placeholder="Full name" />
            </ClientFormRow>
          ) : (
            <ClientFormRow label="Company name" required>
              <Input value={formData.companyName} onChange={(e) => set('companyName', e.target.value)} placeholder="Company name" />
            </ClientFormRow>
          )}

          <ClientFormRow label="Owner">
            <SearchableSelect
              value={formData.assignedTo}
              onChange={(val) => set('assignedTo', val)}
              options={userOptions}
              placeholder="Select Owner"
              allowClear={true}
            />
          </ClientFormRow>

          <ClientFormRow label="Managers">
            <Input
              value={formData.managers}
              onChange={(e) => set('managers', e.target.value)}
              placeholder="Managers"
            />
          </ClientFormRow>

          <ClientFormRow label="Source">
            <SearchableSelect
              value={formData.source}
              onChange={(val) => set('source', val)}
              options={sourceOptions}
              placeholder="Select Source"
              allowClear={true}
            />
          </ClientFormRow>

          <ClientFormRow label="Email">
            <Input type="email" value={formData.email} onChange={(e) => set('email', e.target.value)} placeholder="Email" />
          </ClientFormRow>

          <ClientFormRow label="Phone">
            <PhoneInput
              value={formData.mobile}
              onChange={(e) => set('mobile', e.target.value)}
              onCountryChange={(country) => {
                if (country?.name) {
                  set('country', country.name);
                }
              }}
              defaultCountry="in"
              placeholder="Phone number"
            />
          </ClientFormRow>

          <ClientFormRow label="Website">
            <Input value={formData.website} onChange={(e) => set('website', e.target.value)} placeholder="Website" />
          </ClientFormRow>

          <ClientFormRow label="VAT Number">
            <Input value={formData.vatNumber} onChange={(e) => set('vatNumber', e.target.value)} placeholder="VAT Number" />
          </ClientFormRow>

          <ClientFormRow label="GST Number">
            <Input value={formData.gstNumber} onChange={(e) => set('gstNumber', e.target.value)} placeholder="GST Number" />
          </ClientFormRow>

          <ClientFormRow label="Currency">
            <SearchableSelect
              value={formData.currency}
              onChange={(val) => set('currency', val)}
              options={[
                { value: 'USD', label: 'USD' },
                { value: 'INR', label: 'INR' },
                { value: 'EUR', label: 'EUR' },
                { value: 'GBP', label: 'GBP' }
              ]}
              placeholder="Keep it blank to use the default (USD)"
              allowClear={true}
            />
          </ClientFormRow>

          <ClientFormRow label="Currency symbol">
            <Input value={formData.currencySymbol} onChange={(e) => set('currencySymbol', e.target.value)} placeholder="Keep it blank to use the default ($)" />
          </ClientFormRow>

          <ClientFormRow label="Address">
            <Textarea value={formData.billingAddress} onChange={(e) => set('billingAddress', e.target.value)} placeholder="Address" rows={3} />
          </ClientFormRow>

          <ClientFormRow label="Shipping address">
            <Textarea value={formData.shippingAddress} onChange={(e) => set('shippingAddress', e.target.value)} placeholder="Shipping address" rows={3} />
          </ClientFormRow>

          <ClientFormRow label="State">
            <SearchableSelect
              value={formData.state}
              onChange={(val) => set('state', val)}
              options={INDIA_STATE_OPTIONS}
              placeholder="Select State"
            />
          </ClientFormRow>

          <ClientFormRow label="City">
            <SearchableSelect
              value={formData.city}
              onChange={(val) => set('city', val)}
              options={cityOptions}
              disabled={!formData.state}
              placeholder={formData.state ? `Cities in ${formData.state}` : 'Select state first'}
            />
          </ClientFormRow>

          <ClientFormRow label="Country">
            <Input value={formData.country} onChange={(e) => set('country', e.target.value)} placeholder="Country" />
          </ClientFormRow>

          <ClientFormRow label="Zip">
            <Input value={formData.pincode} onChange={(e) => set('pincode', e.target.value)} placeholder="Zip" />
          </ClientFormRow>

          <ClientFormRow label="Labels">
            <SearchableSelect
              value={formData.labels}
              onChange={(val) => set('labels', val)}
              options={labelOptions}
              placeholder="Select Labels"
              searchPlaceholder="Search labels..."
              multiple
            />
          </ClientFormRow>

          <ClientFormRow label="Follow up">
            <Input type="date" value={formData.followUpDate} onChange={(e) => set('followUpDate', e.target.value)} />
          </ClientFormRow>

          <ClientFormRow label="Value">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={formData.openingBalance}
              onChange={(e) => set('openingBalance', e.target.value)}
              placeholder="Lead value"
            />
          </ClientFormRow>

          <ClientFormRow label="Status">
            <SearchableSelect
              value={formData.status}
              onChange={(val) => set('status', val)}
              options={statusOptions}
              placeholder="Select Status"
              allowClear={false}
            />
          </ClientFormRow>

        </form>
      )}
    </Modal>
  );
}
