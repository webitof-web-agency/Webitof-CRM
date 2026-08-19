import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { api } from '../../api/client';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { DEFAULT_LEAD_OPTIONS } from '../../config/leadManagement';
import { LeadManagementFields } from './LeadManagementFields';
import { cn } from '../../lib/cn';

const EMPTY_FORM = {
  id: '', leadNumber: '', type: 'Organization', name: '', companyName: '', contactPerson: '', pipelineId: '', status: '',
  ownerName: '', assignedTo: '', leadOwner: '', secondaryAssignees: [], managers: '', source: '', campaignName: '',
  sourceReference: '', utmSource: '', utmMedium: '', utmCampaign: '', referrerType: '', referrerName: '',
  referrerContact: '', referrerReferenceId: '', commissionApplicable: false, commissionType: '', commissionValue: '',
  commissionNotes: '', requiredServices: [], otherServiceDetails: '', requirementTitle: '', requirementSummary: '',
  requirementDescription: '', clientPainPoints: '', expectedFeatures: '', referenceUrl: '', preferredTechnology: '',
  existingSystemDetails: '', expectedStartDate: '', expectedDeliveryDate: '', requirementAttachments: [], address: '',
  city: '', state: '', pincode: '', country: 'India', phone: '', alternatePhone: '', whatsappNumber: '',
  whatsappSameAsPhone: false, preferredLanguage: '', preferredContactMethod: '', preferredContactTime: '', website: '',
  vatNumber: '', gstNumber: '', currency: 'INR', currencySymbol: '', labels: [], email: '', value: '', estimatedBudget: '',
  budgetMin: '', budgetMax: '', budgetRange: '', budgetConfirmed: 'Not Disclosed', billingType: '',
  gstInvoiceRequired: 'Not Confirmed', expectedClosingDate: '', paymentPreference: '', purchaseTimeline: '',
  leadTemperature: 'Warm', priority: 'Medium', conversionProbability: '', statusNote: '', followUpDate: '',
  nextFollowUpTime: '', followUpMode: '', reminder: 'No Reminder', followUpNote: '', assignedTeam: '',
  followUpPriority: 'Medium', notes: '', firstConversationSummary: '', lastConversationSummary: '', clientExpectations: '',
  internalNotes: '', preferredCommunicationChannel: '', lastContactDate: '', lastContactTime: '',
  decisionMakerIdentified: 'Unknown', contactIsDecisionMaker: false, requirementConfirmed: 'Unknown',
  timelineConfirmed: 'Unknown', authorityConfirmed: 'Unknown', needConfirmed: 'Unknown', qualificationNotes: '',
  lostReason: '', lostReasonNotes: '', competitorName: '', competitorPrice: '', reconnectInFuture: false,
  reconnectDate: '', originalLeadId: '', attachmentDraftId: ''
};

function parseList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => typeof item === 'string' ? item : item?.label || item?.value || '').filter(Boolean);
  }
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parseList(parsed);
  } catch {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function createDraftId() {
  if (globalThis.crypto?.randomUUID) return `lead-draft-${globalThis.crypto.randomUUID()}`;
  return `lead-draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeOptions(options = {}, settings = {}) {
  const settingsStatuses = (settings?.statuses?.leads || []).map((item) => typeof item === 'string' ? item : item?.label).filter(Boolean);
  const settingsSources = (settings?.sources?.leads || []).map((item) => typeof item === 'string' ? item : item?.label).filter(Boolean);
  const serviceOptions = [...new Set([...(options?.services || DEFAULT_LEAD_OPTIONS.services), 'Other'])];
  return {
    ...DEFAULT_LEAD_OPTIONS,
    ...(options || {}),
    statuses: settingsStatuses.length ? settingsStatuses : options?.statuses || DEFAULT_LEAD_OPTIONS.statuses,
    sources: settingsSources.length ? settingsSources : options?.sources || DEFAULT_LEAD_OPTIONS.sources,
    services: serviceOptions,
    scoreRules: { ...DEFAULT_LEAD_OPTIONS.scoreRules, ...(options?.scoreRules || {}) }
  };
}

function normalizeInitialData(initialData, pipelines = [], options = {}, settings = {}) {
  const safePipelines = Array.isArray(pipelines) ? pipelines : [];
  const safeStatuses = options?.statuses || DEFAULT_LEAD_OPTIONS.statuses;
  const safeSources = options?.sources || DEFAULT_LEAD_OPTIONS.sources;

  if (!initialData) {
    return {
      ...EMPTY_FORM,
      attachmentDraftId: createDraftId(),
      pipelineId: safePipelines[0]?.id || '',
      status: safeStatuses[0] || 'New',
      source: safeSources[0] || 'Website',
      currency: settings?.currency || settings?.defaultCurrency || 'INR'
    };
  }

  const next = { ...EMPTY_FORM };
  Object.keys(EMPTY_FORM).forEach((key) => {
    if (initialData[key] !== undefined && initialData[key] !== null) next[key] = initialData[key];
  });
  next.id = initialData.id || '';
  next.pipelineId = initialData.pipelineId || safePipelines[0]?.id || '';
  next.assignedTo = initialData.assignedTo ? String(initialData.assignedTo) : '';
  next.leadOwner = initialData.leadOwner ? String(initialData.leadOwner) : next.assignedTo;
  next.labels = parseList(initialData.labels);
  next.requiredServices = parseList(initialData.requiredServices);
  next.secondaryAssignees = parseList(initialData.secondaryAssignees);
  next.requirementAttachments = Array.isArray(initialData.requirementAttachments) ? initialData.requirementAttachments : [];
  next.commissionApplicable = Boolean(initialData.commissionApplicable);
  next.contactIsDecisionMaker = Boolean(initialData.contactIsDecisionMaker);
  next.reconnectInFuture = Boolean(initialData.reconnectInFuture);
  next.whatsappSameAsPhone = Boolean(initialData.phone && initialData.whatsappNumber && initialData.phone === initialData.whatsappNumber);
  next.attachmentDraftId = initialData.id || createDraftId();
  return next;
}

function isValidUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function validateForm(formData, initialData, options) {
  const errors = {};
  const isCreate = !initialData?.id;
  const digits = String(formData.phone || '').replace(/\D/g, '');
  const referrerDigits = String(formData.referrerContact || '').replace(/\D/g, '');
  const isLegacyLost = !isCreate && initialData.status === formData.status && !initialData.lostReason;
  const isLegacyReferral = !isCreate && initialData.source === formData.source && !initialData.referrerName;

  if (formData.type === 'Organization' && !String(formData.companyName || '').trim()) errors.companyName = 'Company name is required';
  if (formData.type === 'Person' && !String(formData.name || '').trim()) errors.name = 'Full name is required';
  if (isCreate && !String(formData.contactPerson || '').trim()) errors.contactPerson = 'Contact person is required';
  if (isCreate && !digits) errors.phone = 'Primary mobile number is required';
  else if (digits && (digits.length < 7 || digits.length > 15)) errors.phone = 'Enter a valid mobile number';
  if (isCreate && !formData.requiredServices.length) errors.requiredServices = 'Select at least one service';
  if (!formData.source) errors.source = 'Lead source is required';
  if (!formData.status) errors.status = 'Lead status is required';
  if (!formData.pipelineId) errors.pipelineId = 'Pipeline is required';
  if (!formData.assignedTo) errors.assignedTo = 'Assigned employee is required';
  if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = 'Enter a valid email address';
  if (!isValidUrl(formData.website)) errors.website = 'Enter a valid http or https URL';
  if (!isValidUrl(formData.referenceUrl)) errors.referenceUrl = 'Enter a valid http or https URL';

  const min = formData.budgetMin === '' ? null : Number(formData.budgetMin);
  const max = formData.budgetMax === '' ? null : Number(formData.budgetMax);
  const estimated = formData.estimatedBudget === '' ? null : Number(formData.estimatedBudget);
  if (estimated != null && estimated < 0) errors.estimatedBudget = 'Budget cannot be negative';
  if (min != null && min < 0) errors.budgetMin = 'Budget cannot be negative';
  if (max != null && max < 0) errors.budgetMax = 'Budget cannot be negative';
  if (min != null && max != null && min > max) errors.budgetMax = 'Maximum budget must be at least the minimum budget';
  const probability = formData.conversionProbability === '' ? null : Number(formData.conversionProbability);
  if (probability != null && (probability < 0 || probability > 100)) errors.conversionProbability = 'Use a value from 0 to 100';
  if (formData.expectedStartDate && formData.expectedDeliveryDate && formData.expectedStartDate > formData.expectedDeliveryDate) {
    errors.expectedDeliveryDate = 'Delivery date must be after the start date';
  }

  if (formData.requiredServices.includes('Other') && !String(formData.otherServiceDetails || '').trim()) errors.otherServiceDetails = 'Describe the other service';
  if (formData.source === 'Other' && !String(formData.sourceReference || '').trim()) errors.sourceReference = 'Source reference is required';
  if ((options.referralSources || []).includes(formData.source) && !isLegacyReferral) {
    if (!formData.referrerType) errors.referrerType = 'Referrer type is required';
    if (!String(formData.referrerName || '').trim()) errors.referrerName = 'Referrer name is required';
    if (referrerDigits.length < 7 || referrerDigits.length > 15) errors.referrerContact = 'Valid referrer contact is required';
  }
  if (formData.commissionApplicable) {
    if (!formData.commissionType) errors.commissionType = 'Commission type is required';
    const commission = formData.commissionValue === '' ? null : Number(formData.commissionValue);
    if (commission == null || commission < 0) errors.commissionValue = 'Valid commission value is required';
    if (formData.commissionType === 'Percentage' && commission > 100) errors.commissionValue = 'Percentage cannot exceed 100';
  }
  if (['Lost', 'Not Interested'].includes(formData.status) && !isLegacyLost) {
    if (!formData.lostReason) errors.lostReason = 'Lost reason is required';
    if (formData.lostReason === 'Other' && !String(formData.lostReasonNotes || '').trim()) errors.lostReasonNotes = 'Notes are required';
    if (formData.reconnectInFuture && !formData.reconnectDate) errors.reconnectDate = 'Reconnect date is required';
  }
  if (formData.status === 'Duplicate' && !formData.originalLeadId && (isCreate || initialData.status !== 'Duplicate')) {
    errors.originalLeadId = 'Select the original lead';
  }
  return errors;
}

export function LeadFormModal({ open, onClose, initialData, options: externalOptions, users: externalUsers, pipelines: externalPipelines, onSuccess }) {
  const { token, user } = useAuth();
  const [internalOptions, setInternalOptions] = useState(DEFAULT_LEAD_OPTIONS);
  const [internalUsers, setInternalUsers] = useState([]);
  const [internalPipelines, setInternalPipelines] = useState([]);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [allSectionsOpen, setAllSectionsOpen] = useState(false);
  const [duplicateLeads, setDuplicateLeads] = useState([]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    async function load() {
      try {
        const [settingsRes, usersRes, pipelinesRes, optionsRes] = await Promise.allSettled([
          api.settings.get(token),
          api.resources.list('/users/lookup', token),
          api.resources.list('/lead-pipelines', token),
          api.resources.list('/leads/options', token)
        ]);
        if (!active) return;
        const settings = settingsRes.status === 'fulfilled' ? settingsRes.value.data || {} : {};
        if (usersRes.status === 'fulfilled') setInternalUsers(usersRes.value.data || []);
        if (pipelinesRes.status === 'fulfilled') setInternalPipelines(pipelinesRes.value.data || []);
        if (optionsRes.status === 'fulfilled') setInternalOptions(normalizeOptions(optionsRes.value.data, settings));
      } catch (err) {
        console.error('Failed loading lead options:', err);
      }
    }
    load();
    return () => { active = false; };
  }, [open, token]);

  const users = externalUsers && externalUsers.length ? externalUsers : internalUsers;
  const pipelines = externalPipelines && externalPipelines.length ? externalPipelines : internalPipelines;
  const effectiveOptions = externalOptions || internalOptions;
  const leadOptions = useMemo(() => normalizeOptions(effectiveOptions, user?.tenantSettings), [effectiveOptions, user?.tenantSettings]);
  const [formData, setFormData] = useState(() => normalizeInitialData(initialData, pipelines, leadOptions, user?.tenantSettings));

  useEffect(() => {
    if (!open) return;
    setFormData(normalizeInitialData(initialData, pipelines, leadOptions, user?.tenantSettings));
    setErrors({});
    setDuplicateLeads([]);
    setDirty(false);
  }, [open, initialData, pipelines, leadOptions, user?.tenantSettings]);

  useEffect(() => {
    if (!open || (!dirty && !busy)) return undefined;
    const warn = (event) => {
      if (!dirty || busy) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [open, dirty, busy]);

  useEffect(() => {
    if (!open) return undefined;
    const digits = String(formData.phone || '').replace(/\D/g, '');
    const email = String(formData.email || '').trim();
    if (digits.length < 7 && !email) {
      setDuplicateLeads([]);
      return undefined;
    }
    const timer = window.setTimeout(async () => {
      try {
        const response = await api.resources.list('/leads/duplicates', token, '', {
          phone: digits.length >= 7 ? formData.phone : '',
          email,
          excludeId: initialData?.id || ''
        });
        setDuplicateLeads(response.data || []);
      } catch {
        setDuplicateLeads([]);
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [open, token, formData.phone, formData.email, initialData?.id]);

  const set = (field, value) => {
    setDirty(true);
    setErrors((current) => ({ ...current, [field]: '' }));
    setFormData((current) => {
      const next = { ...current, [field]: value };
      if (field === 'state' && value !== current.state) next.city = '';
      if (field === 'phone' && current.whatsappSameAsPhone) next.whatsappNumber = value;
      if (field === 'type' && value === 'Person' && !current.contactPerson) next.contactPerson = current.name;
      return next;
    });
  };

  const requestClose = () => {
    if (dirty && !busy && !window.confirm('Discard unsaved lead changes?')) return;
    onClose();
  };

  const handleSubmit = async (event) => {
    event?.preventDefault?.();
    if (busy) return;
    const nextErrors = validateForm(formData, initialData, leadOptions);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      toast.error(Object.values(nextErrors)[0]);
      return;
    }

    setBusy(true);
    try {
      const estimatedBudget = formData.estimatedBudget === '' ? null : Number(formData.estimatedBudget);
      const payload = {
        ...formData,
        name: formData.type === 'Organization' ? (formData.companyName || formData.name) : formData.name,
        whatsappNumber: formData.whatsappSameAsPhone ? formData.phone : formData.whatsappNumber,
        value: estimatedBudget ?? (formData.value === '' ? 0 : Number(formData.value)),
        estimatedBudget,
        labels: parseList(formData.labels),
        requiredServices: parseList(formData.requiredServices),
        secondaryAssignees: parseList(formData.secondaryAssignees)
      };
      delete payload.whatsappSameAsPhone;
      delete payload.leadNumber;
      delete payload.id;

      const response = initialData?.id
        ? await api.resources.update('/leads', initialData.id, payload, token)
        : await api.resources.create('/leads', payload, token);
      setDirty(false);
      toast.success(initialData?.id ? 'Lead updated successfully' : 'Lead created successfully');
      if (response.warnings?.duplicateLeads?.length) toast.warning('Lead saved with a possible duplicate match');
      onSuccess?.(response.data);
      onClose();
    } catch (error) {
      if (error.payload?.details) setErrors(error.payload.details);
      toast.error(error.message || 'Failed to save lead');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={requestClose}
      title={(
        <div className="flex items-center gap-2.5">
          <span>{initialData ? 'Edit Lead' : 'Add New Lead'}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-100">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
            Lead Details
          </span>
        </div>
      )}
      subtitle={initialData?.leadNumber || ''}
      width="min(820px, 95vw)"
      maxHeight="90vh"
      headerClassName="px-6 py-3.5 border-b border-slate-100"
      headerActions={(
        <button
          type="button"
          onClick={() => setAllSectionsOpen((prev) => !prev)}
          className="inline-flex h-7 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors focus:outline-none"
        >
          <ChevronDown size={14} className={cn('transition-transform', allSectionsOpen && 'rotate-180')} />
          {allSectionsOpen ? 'Collapse All' : 'Expand All'}
        </button>
      )}
      bodyClassName="px-6 py-4 overflow-y-auto"
      footerClassName="px-6 py-3.5 bg-slate-50/90 border-t border-slate-100"
      footer={(
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">
            {dirty ? '● Unsaved changes' : ''}
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={requestClose} disabled={busy} className="rounded-xl px-4 text-xs font-medium">
              Cancel
            </Button>
            <Button type="submit" form="lead-management-form" size="sm" disabled={busy} className="rounded-xl px-5 text-xs font-semibold shadow-sm">
              {busy ? 'Saving...' : initialData ? 'Update Lead' : 'Create Lead'}
            </Button>
          </div>
        </div>
      )}
    >
      <form id="lead-management-form" onSubmit={handleSubmit}>
        <LeadManagementFields
          formData={formData}
          set={set}
          errors={errors}
          options={leadOptions}
          users={users}
          pipelines={pipelines}
          duplicateLeads={duplicateLeads}
          allSectionsOpenExternal={allSectionsOpen}
        />
      </form>
    </Modal>
  );
}
