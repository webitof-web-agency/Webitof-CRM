import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { api } from '../../api/client';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { SearchableSelect } from './SearchableSelect';
import { INDIA_STATE_OPTIONS, getCitiesByState } from '../../data/indiaLocations';
import { PhoneInput } from './PhoneInput';
import { normalizeSharedLabels, mergeSharedLabelOptions } from '../../lib/labels';

const EMPTY_FORM = {
  type: 'Organization',
  name: '',
  companyName: '',
  pipelineId: '',
  status: '',
  ownerName: '',
  managers: '',
  source: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  country: 'India',
  phone: '',
  website: '',
  vatNumber: '',
  gstNumber: '',
  currency: '',
  currencySymbol: '',
  labels: [],
  email: '',
  value: ''
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
          color: item.color || '#64748b'
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
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function LeadFormRow({ label, children, required }) {
  return (
    <div className="flex flex-col gap-1 py-2 md:flex-row md:items-start md:gap-4">
      <div className="shrink-0 pt-2 text-sm font-medium text-slate-500 md:w-32 lg:w-40">
        {label} {required && <span className="text-red-500">*</span>}
      </div>
      <div className="min-w-0 flex-1">
        {children}
      </div>
    </div>
  );
}

export function LeadFormModal({ open, onClose, onSuccess, initialData = null }) {
  const { token } = useAuth();
  const [busy, setBusy] = useState(false);
  const [statuses, setStatuses] = useState([]);
  const [sources, setSources] = useState([]);
  const [labelOptions, setLabelOptions] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!open) return;

    async function load() {
      try {
        const [settingsRes, usersRes, pipelinesRes] = await Promise.allSettled([
          api.settings.get(token),
          api.resources.list('/users/lookup', token),
          api.resources.list('/lead-pipelines', token)
        ]);
        const data = settingsRes.status === 'fulfilled' ? settingsRes.value.data : {};
        if (usersRes.status === 'fulfilled') {
          setUsers(usersRes.value.data || []);
        }
        const loadedPipelines = pipelinesRes.status === 'fulfilled' ? (pipelinesRes.value.data || []) : [];
        setPipelines(loadedPipelines);

        let loadedStatuses = [{ label: 'New', color: '#3b82f6' }];
        let loadedSources = ['Website'];

        if (data?.statuses?.leads?.length > 0) loadedStatuses = data.statuses.leads;
        if (data?.sources?.leads?.length > 0) loadedSources = data.sources.leads;
        setLabelOptions(normalizeSharedLabels(data?.labels || []));
        setStatuses(loadedStatuses);
        setSources(loadedSources);

        if (!initialData) {
          const firstStatus = typeof loadedStatuses[0] === 'string' ? loadedStatuses[0] : loadedStatuses[0]?.label || 'New';
          const firstSource = typeof loadedSources[0] === 'string' ? loadedSources[0] : loadedSources[0]?.label || '';
          setFormData({
            ...EMPTY_FORM,
            pipelineId: loadedPipelines[0]?.id || '',
            status: firstStatus,
            source: firstSource,
            country: 'India'
          });
        } else {
          setFormData({
            type: initialData.type || 'Organization',
            name: initialData.name || '',
            companyName: initialData.companyName || '',
            pipelineId: initialData.pipelineId || loadedPipelines[0]?.id || '',
            status: initialData.status || '',
            ownerName: initialData.ownerName || '',
            assignedTo: initialData.assignedTo ? String(initialData.assignedTo) : '',
            managers: initialData.managers || '',
            source: initialData.source || '',
            address: initialData.address || '',
            city: initialData.city || '',
            state: initialData.state || '',
            pincode: initialData.pincode || '',
            country: initialData.country || 'India',
            phone: initialData.phone || '',
            website: initialData.website || '',
            vatNumber: initialData.vatNumber || '',
            gstNumber: initialData.gstNumber || '',
            currency: initialData.currency || '',
            currencySymbol: initialData.currencySymbol || '',
            labels: parseLabels(initialData.labels),
            email: initialData.email || '',
            value: initialData.value || ''
          });
        }
      } catch (error) {
        console.error('Failed to load lead form data:', error);
      }
    }

    load();
  }, [open, token, initialData]);

  const set = (field, value) => setFormData((prev) => {
    const next = { ...prev, [field]: value };
    if (field === 'state') next.city = '';
    return next;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.type === 'Person' && !formData.name.trim()) {
      toast.error('Full Name is required for Person');
      return;
    }

    if (formData.type === 'Organization' && !formData.companyName.trim()) {
      toast.error('Company Name is required for Organization');
      return;
    }

    if (!formData.assignedTo) {
      toast.error('Please select an Owner (Sales Rep)');
      return;
    }

    if (!formData.pipelineId) {
      toast.error('Please select a pipeline');
      return;
    }

    setBusy(true);
    try {
      const payload = {
        ...formData,
        name: formData.type === 'Organization' ? (formData.companyName || formData.name) : formData.name,
        ownerName: String(formData.ownerName || '').trim(),
        value: formData.value ? Number(formData.value) : 0,
        labels: Array.isArray(formData.labels) ? formData.labels : parseLabels(formData.labels)
      };

      if (initialData?.id) {
        const response = await api.resources.update('/leads', initialData.id, payload, token);
        toast.success('Lead updated successfully');
        onSuccess?.(response.data);
      } else {
        const response = await api.resources.create('/leads', payload, token);
        toast.success('Lead created successfully');
        onSuccess?.(response.data);
      }

      onClose();
    } catch (error) {
      toast.error(error.message || 'Failed to save lead');
    } finally {
      setBusy(false);
    }
  };

  const statusOptions = statuses.map((status) => {
    const label = typeof status === 'string' ? status : status.label;
    return { value: label, label };
  });

  const sourceOptions = sources.map((source) => {
    const label = typeof source === 'string' ? source : source.label;
    return { value: label, label };
  });
  const pipelineOptions = pipelines.map((pipeline) => ({ value: pipeline.id, label: pipeline.name }));

  const leadLabelOptions = mergeSharedLabelOptions(labelOptions, formData.labels);
  const cityOptions = getCitiesByState(formData.state).map((city) => ({ value: city, label: city }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialData ? 'Edit Lead' : 'Add lead'}
      width="800px"
      footer={(
        <div className="flex justify-end gap-3">
          <Button variant="outline" className="shadow-sm font-medium" onClick={onClose} disabled={busy}>Close</Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? 'Saving...' : 'Save'}
          </Button>
        </div>
      )}
    >
      <form onSubmit={handleSubmit} className="flex flex-col px-1">
        <LeadFormRow label="Type">
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
        </LeadFormRow>

        {formData.type === 'Person' && (
          <LeadFormRow label="Name" required>
            <Input name="name" value={formData.name} onChange={(e) => set('name', e.target.value)} placeholder="Full Name" />
          </LeadFormRow>
        )}

        {formData.type === 'Organization' && (
          <LeadFormRow label="Company name" required>
            <Input name="companyName" value={formData.companyName} onChange={(e) => set('companyName', e.target.value)} placeholder="Company name" />
          </LeadFormRow>
        )}

        <LeadFormRow label="Pipeline" required>
          <SearchableSelect
            value={formData.pipelineId}
            onChange={(val) => set('pipelineId', val)}
            options={pipelineOptions}
            placeholder="Select Pipeline"
            allowClear={false}
          />
        </LeadFormRow>

        <LeadFormRow label="Status">
          <SearchableSelect
            value={formData.status}
            onChange={(val) => set('status', val)}
            options={statusOptions}
            placeholder="Select Status"
            allowClear={false}
          />
        </LeadFormRow>

        <LeadFormRow label="Owner" required>
          <SearchableSelect
            value={formData.assignedTo || ''}
            onChange={(val) => {
              const user = users.find(u => String(u.id) === String(val));
              set('assignedTo', val);
              set('ownerName', user ? (user.fullName || user.username || user.email || '') : '');
            }}
            options={users.map(u => ({ value: String(u.id), label: u.fullName || u.username || u.email || String(u.id) }))}
            placeholder="Select Owner (Sales Rep)"
            allowClear={false}
          />
        </LeadFormRow>

        <LeadFormRow label="Managers">
          <Input name="managers" value={formData.managers} onChange={(e) => set('managers', e.target.value)} placeholder="Managers" />
        </LeadFormRow>

        <LeadFormRow label="Source">
          <SearchableSelect
            value={formData.source}
            onChange={(val) => set('source', val)}
            options={sourceOptions}
            placeholder="Select Source"
            allowClear={false}
          />
        </LeadFormRow>

        <LeadFormRow label="Email">
          <Input name="email" type="email" value={formData.email} onChange={(e) => set('email', e.target.value)} placeholder="Email" />
        </LeadFormRow>

        <LeadFormRow label="Address">
          <Textarea name="address" value={formData.address} onChange={(e) => set('address', e.target.value)} placeholder="Address" rows={3} />
        </LeadFormRow>

        <LeadFormRow label="State">
          <SearchableSelect
            value={formData.state}
            onChange={(val) => {
              set('state', val);
              set('city', '');
            }}
            options={INDIA_STATE_OPTIONS}
            placeholder="Select State"
          />
        </LeadFormRow>

        <LeadFormRow label="City">
          <SearchableSelect
            value={formData.city}
            onChange={(val) => set('city', val)}
            options={cityOptions}
            disabled={!formData.state}
            placeholder={formData.state ? `Cities in ${formData.state}` : 'Select state first'}
          />
        </LeadFormRow>

        <LeadFormRow label="Country">
          <Input name="country" value={formData.country} onChange={(e) => set('country', e.target.value)} placeholder="Country" />
        </LeadFormRow>

        <LeadFormRow label="Zip">
          <Input name="pincode" value={formData.pincode} onChange={(e) => set('pincode', e.target.value)} placeholder="Zip" />
        </LeadFormRow>

        <LeadFormRow label="Phone">
          <PhoneInput
            name="phone"
            value={formData.phone}
            onChange={(e) => set('phone', e.target.value)}
            onCountryChange={(country) => {
              if (country?.name) {
                set('country', country.name);
              }
            }}
            defaultCountry="in"
            placeholder="Phone number"
          />
        </LeadFormRow>

        <LeadFormRow label="Website">
          <Input name="website" value={formData.website} onChange={(e) => set('website', e.target.value)} placeholder="Website" />
        </LeadFormRow>

        <LeadFormRow label="VAT Number">
          <Input name="vatNumber" value={formData.vatNumber} onChange={(e) => set('vatNumber', e.target.value)} placeholder="VAT Number" />
        </LeadFormRow>

        <LeadFormRow label="GST Number">
          <Input name="gstNumber" value={formData.gstNumber} onChange={(e) => set('gstNumber', e.target.value)} placeholder="GST Number" />
        </LeadFormRow>

        <LeadFormRow label="Currency">
          <SearchableSelect
            value={formData.currency}
            onChange={(val) => set('currency', val)}
            options={[
              { value: 'USD', label: 'USD ($)' },
              { value: 'EUR', label: 'EUR (€)' },
              { value: 'INR', label: 'INR (₹)' },
              { value: 'GBP', label: 'GBP (£)' }
            ]}
            placeholder="Keep it blank to use the default (USD)"
            allowClear={true}
          />
        </LeadFormRow>

        <LeadFormRow label="Currency Symbol">
          <Input name="currencySymbol" value={formData.currencySymbol} onChange={(e) => set('currencySymbol', e.target.value)} placeholder="Keep it blank to use the default ($)" />
        </LeadFormRow>

        <LeadFormRow label="Labels">
          <SearchableSelect
            value={formData.labels}
            onChange={(val) => set('labels', val)}
            options={leadLabelOptions}
            placeholder="Select Labels"
            searchPlaceholder="Search labels..."
            multiple
          />
        </LeadFormRow>

        <LeadFormRow label="Value">
          <Input type="number" min="0" step="0.01" value={formData.value} onChange={(e) => set('value', e.target.value)} placeholder="Lead value" />
        </LeadFormRow>
      </form>
    </Modal>
  );
}
