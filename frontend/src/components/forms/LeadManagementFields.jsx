import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, Sparkles, User, FileText, DollarSign, Calendar, Layers, Flag } from 'lucide-react';
import { Input, Textarea } from '../ui/Input';
import { AttachmentPicker } from '../ui/AttachmentPicker';
import { SearchableSelect } from './SearchableSelect';
import { PhoneInput } from './PhoneInput';
import { INDIA_STATE_OPTIONS, getCitiesByState } from '../../data/indiaLocations';
import {
  calculateLeadScore,
  toSelectOptions,
  getLeadStatusColor,
  getLeadSourceColor,
  getLeadServiceColor,
  getLeadTemperatureColor,
  getLeadPriorityColor
} from '../../config/leadManagement';
import { cn } from '../../lib/cn';

function Field({ label, required = false, error = '', children, wide = false }) {
  return (
    <div className={wide ? 'md:col-span-2 xl:col-span-3' : ''}>
      <label className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]">
        {label}{required ? <span className="ml-1 text-rose-500 font-bold">*</span> : null}
      </label>
      {children}
      {error ? <span className="mt-1 block text-xs font-semibold text-rose-500">{error}</span> : null}
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, open = true, onOpenChange, tone = 'default' }) {
  const border =
    tone === 'warning'
      ? 'border-amber-500/30 bg-amber-500/5'
      : 'border-[var(--border)] bg-[var(--surface)]';
  return (
    <details
      className={`group rounded-2xl border ${border} shadow-2xs transition-all overflow-hidden mb-4`}
      open={open}
      onToggle={(event) => onOpenChange?.(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-xs font-bold text-[var(--text-main)] hover:bg-[var(--hover-bg)] transition-colors focus:outline-none select-none">
        <div className="flex items-center gap-2.5">
          {Icon ? (
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[var(--surface-2)] text-[var(--text-muted)] group-open:bg-[var(--primary-subtle)] group-open:text-[var(--primary)] transition-colors shrink-0">
              <Icon size={14} />
            </span>
          ) : (
            <span className="h-2 w-2 rounded-full bg-[var(--primary)] shrink-0" />
          )}
          <span>{title}</span>
        </div>
        <ChevronDown size={15} className="shrink-0 text-[var(--text-muted)] transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 px-5 pb-5 pt-2 md:grid-cols-2 xl:grid-cols-3 border-t border-[var(--border)] bg-[var(--surface)]">
        {children}
      </div>
    </details>
  );
}

const BASE_SECTION_IDS = ['quick', 'contact', 'requirement', 'commercial', 'qualification', 'followUp', 'source'];

function getInitialOpenSections({ referralRequired, lostStatus, duplicateStatus }) {
  return {
    quick: true,
    contact: false,
    requirement: false,
    commercial: false,
    qualification: false,
    followUp: false,
    source: false,
    referral: referralRequired,
    lost: lostStatus,
    duplicate: duplicateStatus
  };
}

function CompactSelect({ triggerClassName = '', ...props }) {
  return (
    <SearchableSelect
      {...props}
      triggerClassName={cn('!min-h-9 !px-3 !py-1.5 rounded-xl border-[var(--input-border)] text-xs shadow-2xs', triggerClassName)}
    />
  );
}

function attachmentRecord(file = {}) {
  return {
    id: file.id || file.driveFileId,
    driveFileId: file.driveFileId || file.id,
    name: file.name || file.originalName || 'File',
    originalName: file.originalName || file.name || 'File',
    driveWebViewLink: file.driveWebViewLink || '',
    mimeType: file.mimeType || ''
  };
}

export function LeadManagementFields({
  formData,
  set,
  errors = {},
  options,
  users = [],
  pipelines = [],
  duplicateLeads = [],
  allSectionsOpenExternal
}) {
  const referralRequired = (options.referralSources || []).includes(formData.source);
  const lostStatus = ['Lost', 'Not Interested'].includes(formData.status);
  const duplicateStatus = formData.status === 'Duplicate';
  const cityOptions = getCitiesByState(formData.state).map((city) => ({ value: city, label: city }));
  const score = calculateLeadScore(formData, options.scoreRules);
  const followUpPast = formData.followUpDate && formData.followUpDate < new Date().toISOString().slice(0, 10);
  const select = (items) => toSelectOptions(items);
  const assignedTeamOptions = useMemo(() => {
    const optionMap = new Map();
    users.forEach((item) => {
      const label = item.fullName || item.username || item.email || '';
      if (!label) return;
      optionMap.set(label, {
        value: label,
        label,
        description: [item.username, item.roles?.[0]?.name].filter(Boolean).join(' - ') || 'Team member'
      });
    });
    if (formData.assignedTeam && !optionMap.has(formData.assignedTeam)) {
      optionMap.set(formData.assignedTeam, {
        value: formData.assignedTeam,
        label: formData.assignedTeam,
        description: 'Current value'
      });
    }
    return [...optionMap.values()];
  }, [formData.assignedTeam, users]);

  const sectionIds = useMemo(() => {
    const ids = [...BASE_SECTION_IDS];
    if (referralRequired) ids.splice(5, 0, 'referral');
    if (lostStatus) ids.splice(ids.length - 1, 0, 'lost');
    if (duplicateStatus) ids.splice(ids.length - 1, 0, 'duplicate');
    return ids;
  }, [duplicateStatus, lostStatus, referralRequired]);

  const [openSections, setOpenSections] = useState(() => getInitialOpenSections({ referralRequired, lostStatus, duplicateStatus }));

  useEffect(() => {
    if (allSectionsOpenExternal !== undefined) {
      setOpenSections(sectionIds.reduce((next, sectionId) => ({ ...next, [sectionId]: Boolean(allSectionsOpenExternal) }), {}));
    }
  }, [allSectionsOpenExternal, sectionIds]);

  useEffect(() => {
    setOpenSections((current) => {
      const initialOpenSections = getInitialOpenSections({ referralRequired, lostStatus, duplicateStatus });
      let changed = false;
      const next = {};
      sectionIds.forEach((sectionId) => {
        next[sectionId] = current[sectionId] ?? Boolean(initialOpenSections[sectionId]);
        if (next[sectionId] !== current[sectionId]) changed = true;
      });
      if (Object.keys(current).length !== sectionIds.length) changed = true;
      return changed ? next : current;
    });
  }, [duplicateStatus, lostStatus, referralRequired, sectionIds]);

  const sectionProps = (sectionId) => ({
    open: Boolean(openSections[sectionId]),
    onOpenChange: (isOpen) => setOpenSections((current) => (
      current[sectionId] === isOpen ? current : { ...current, [sectionId]: isOpen }
    ))
  });

  return (
    <div className="lead-management-fields space-y-4">
      {/* Quick Lead Details */}
      <SectionCard title="Quick Lead Details" icon={Sparkles} {...sectionProps('quick')}>
        {formData.leadNumber ? (
          <Field label="Lead ID">
            <Input value={formData.leadNumber} readOnly className="bg-slate-50 text-slate-500 rounded-xl" />
          </Field>
        ) : null}

        <Field label="Pipeline" required error={errors.pipelineId}>
          <CompactSelect value={formData.pipelineId} onChange={(value) => set('pipelineId', value)} options={pipelines.map((item) => ({ value: item.id, label: item.name }))} placeholder="Select pipeline" allowClear={false} />
        </Field>

        <Field label="Lead Type">
          <div className="flex h-9 items-center rounded-xl bg-slate-100 p-1 border border-slate-200/80">
            {['Organization', 'Person'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => set('type', type)}
                className={cn(
                  'flex-1 h-full rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5',
                  formData.type === type
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                )}
              >
                {type === 'Organization' ? '🏢 Business' : '👤 Person'}
              </button>
            ))}
          </div>
        </Field>

        {formData.type === 'Organization' ? (
          <Field label="Company / Business Name" required error={errors.companyName}>
            <Input value={formData.companyName} onChange={(event) => set('companyName', event.target.value)} placeholder="e.g. Acme Corp" className="rounded-xl" />
          </Field>
        ) : (
          <Field label="Full Name" required error={errors.name}>
            <Input value={formData.name} onChange={(event) => set('name', event.target.value)} placeholder="Full name" className="rounded-xl" />
          </Field>
        )}

        <Field label="Primary Contact Person" required error={errors.contactPerson}>
          <Input value={formData.contactPerson} onChange={(event) => set('contactPerson', event.target.value)} placeholder="Contact person name" className="rounded-xl" />
        </Field>

        <Field label="Primary Mobile" required error={errors.phone}>
          <PhoneInput name="phone" value={formData.phone} onChange={(event) => set('phone', event.target.value)} onCountryChange={(country) => country?.name && set('country', country.name)} required compact />
        </Field>

        <Field label="Required Services" required error={errors.requiredServices} wide>
          <CompactSelect
            value={formData.requiredServices}
            onChange={(value) => set('requiredServices', value)}
            options={(options.services || []).map((s) => typeof s === 'string' ? { value: s, label: s, color: getLeadServiceColor(s) } : { value: s.label || s.value, label: s.label || s.value, color: s.color || getLeadServiceColor(s.label || s.value) })}
            placeholder="Select services"
            searchPlaceholder="Search services..."
            multiple
          />
        </Field>

        {formData.requiredServices?.includes('Other') ? (
          <Field label="Other Service Details" required error={errors.otherServiceDetails} wide>
            <Input value={formData.otherServiceDetails} onChange={(event) => set('otherServiceDetails', event.target.value)} placeholder="Specify custom service" className="rounded-xl" />
          </Field>
        ) : null}

        <Field label="Requirement Summary" wide>
          <Textarea value={formData.requirementSummary} onChange={(event) => set('requirementSummary', event.target.value)} rows={2} placeholder="Short summary of client requirements..." className="rounded-xl" />
        </Field>

        <Field label="Estimated Budget" error={errors.estimatedBudget}>
          <Input type="number" min="0" step="0.01" value={formData.estimatedBudget} onChange={(event) => set('estimatedBudget', event.target.value)} placeholder="e.g. 50000" className="rounded-xl" />
        </Field>

        <Field label="Lead Source" required error={errors.source}>
          <CompactSelect
            value={formData.source}
            onChange={(value) => set('source', value)}
            options={(options.sources || []).map((s) => typeof s === 'string' ? { value: s, label: s, color: getLeadSourceColor(s) } : { value: s.label || s.value, label: s.label || s.value, color: s.color || getLeadSourceColor(s.label || s.value) })}
            placeholder="Select source"
            allowClear={false}
          />
        </Field>

        <Field label="Status" required error={errors.status}>
          <CompactSelect
            value={formData.status}
            onChange={(value) => set('status', value)}
            options={(options.statuses || []).map((s) => typeof s === 'string' ? { value: s, label: s, color: getLeadStatusColor(s) } : { value: s.label || s.value, label: s.label || s.value, color: s.color || getLeadStatusColor(s.label || s.value) })}
            placeholder="Select status"
            allowClear={false}
          />
        </Field>

        <Field label="Temperature">
          <CompactSelect
            value={formData.leadTemperature}
            onChange={(value) => set('leadTemperature', value)}
            options={(options.temperatures || []).map((t) => typeof t === 'string' ? { value: t, label: t, color: getLeadTemperatureColor(t) } : { value: t.label || t.value, label: t.label || t.value, color: t.color || getLeadTemperatureColor(t.label || t.value) })}
            placeholder="Select temperature"
          />
        </Field>

        <Field label="Priority">
          <CompactSelect
            value={formData.priority}
            onChange={(value) => set('priority', value)}
            options={(options.priorities || []).map((p) => typeof p === 'string' ? { value: p, label: p, color: getLeadPriorityColor(p) } : { value: p.label || p.value, label: p.label || p.value, color: p.color || getLeadPriorityColor(p.label || p.value) })}
            placeholder="Select priority"
          />
        </Field>

        <Field label="Next Follow-up Date" error={errors.followUpDate}>
          <Input type="date" value={formData.followUpDate} onChange={(event) => set('followUpDate', event.target.value)} className="rounded-xl" />
          {followUpPast ? <span className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-700"><AlertTriangle size={13} />Follow-up date is in the past</span> : null}
        </Field>

        <Field label="Next Follow-up Time">
          <Input type="time" value={formData.nextFollowUpTime} onChange={(event) => set('nextFollowUpTime', event.target.value)} className="rounded-xl" />
        </Field>

        <Field label="Assigned Employee" required error={errors.assignedTo}>
          <CompactSelect
            value={formData.assignedTo}
            onChange={(value) => {
              const user = users.find((item) => String(item.id) === String(value));
              set('assignedTo', value);
              set('leadOwner', value);
              set('ownerName', user?.fullName || user?.username || user?.email || '');
            }}
            options={users.map((item) => ({ value: String(item.id), label: item.fullName || item.username || item.email || String(item.id) }))}
            placeholder="Select employee"
            allowClear={false}
          />
        </Field>

        <Field label="Notes" wide>
          <Textarea value={formData.notes} onChange={(event) => set('notes', event.target.value)} rows={2} placeholder="Internal notes..." className="rounded-xl" />
        </Field>
      </SectionCard>

      {duplicateLeads.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 shadow-2xs mb-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-700" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-amber-900">Possible Duplicate Lead Detected</div>
              <div className="mt-1 flex flex-wrap gap-2">
                {duplicateLeads.map((lead) => (
                  <a key={lead.id} href={`/app/leads/${lead.id}`} target="_blank" rel="noreferrer" className="text-xs font-medium text-amber-800 underline underline-offset-2 hover:text-amber-950">
                    {lead.leadNumber || lead.contactPerson || lead.companyName || lead.name}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Contact Details */}
      <SectionCard title="Contact & Address" icon={User} {...sectionProps('contact')}>
        <Field label="Alternate Mobile">
          <PhoneInput name="alternatePhone" value={formData.alternatePhone} onChange={(event) => set('alternatePhone', event.target.value)} compact />
        </Field>

        <Field label="WhatsApp Number">
          <PhoneInput name="whatsappNumber" value={formData.whatsappNumber} onChange={(event) => set('whatsappNumber', event.target.value)} compact />
          <label className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
            <input type="checkbox" checked={Boolean(formData.whatsappSameAsPhone)} onChange={(event) => {
              set('whatsappSameAsPhone', event.target.checked);
              if (event.target.checked) set('whatsappNumber', formData.phone);
            }} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            Same as primary mobile
          </label>
        </Field>

        <Field label="Email" error={errors.email}>
          <Input type="email" value={formData.email} onChange={(event) => set('email', event.target.value)} placeholder="name@company.com" className="rounded-xl" />
        </Field>

        <Field label="Website" error={errors.website}>
          <Input type="url" value={formData.website} onChange={(event) => set('website', event.target.value)} placeholder="https://example.com" className="rounded-xl" />
        </Field>

        <Field label="Country">
          <Input value={formData.country} onChange={(event) => set('country', event.target.value)} className="rounded-xl" />
        </Field>

        <Field label="State">
          <CompactSelect value={formData.state} onChange={(value) => set('state', value)} options={INDIA_STATE_OPTIONS} placeholder="Select state" />
        </Field>

        <Field label="City">
          <CompactSelect value={formData.city} onChange={(value) => set('city', value)} options={cityOptions} disabled={!formData.state} placeholder={formData.state ? 'Select city' : 'Select state first'} />
        </Field>

        <Field label="PIN Code">
          <Input value={formData.pincode} onChange={(event) => set('pincode', event.target.value)} inputMode="numeric" className="rounded-xl" />
        </Field>

        <Field label="Address" wide>
          <Textarea value={formData.address} onChange={(event) => set('address', event.target.value)} rows={2} placeholder="Street address..." className="rounded-xl" />
        </Field>

        <Field label="Preferred Language">
          <CompactSelect value={formData.preferredLanguage} onChange={(value) => set('preferredLanguage', value)} options={select(options.preferredLanguages)} placeholder="Select language" />
        </Field>

        <Field label="Preferred Contact Method">
          <CompactSelect value={formData.preferredContactMethod} onChange={(value) => set('preferredContactMethod', value)} options={select(options.contactMethods)} placeholder="Select method" />
        </Field>

        <Field label="Preferred Contact Time">
          <Input type="time" value={formData.preferredContactTime} onChange={(event) => set('preferredContactTime', event.target.value)} className="rounded-xl" />
        </Field>
      </SectionCard>

      {/* Requirement Details */}
      <SectionCard title="Requirement Details" icon={FileText} {...sectionProps('requirement')}>
        <Field label="Project Title" wide>
          <Input value={formData.requirementTitle} onChange={(event) => set('requirementTitle', event.target.value)} placeholder="Project title / scope" className="rounded-xl" />
        </Field>

        <Field label="Detailed Requirement" wide>
          <Textarea value={formData.requirementDescription} onChange={(event) => set('requirementDescription', event.target.value)} rows={4} placeholder="Full project scope and requirements..." className="rounded-xl" />
        </Field>

        <Field label="Client Pain Points" wide>
          <Textarea value={formData.clientPainPoints} onChange={(event) => set('clientPainPoints', event.target.value)} rows={2} className="rounded-xl" />
        </Field>

        <Field label="Expected Features" wide>
          <Textarea value={formData.expectedFeatures} onChange={(event) => set('expectedFeatures', event.target.value)} rows={2} className="rounded-xl" />
        </Field>

        <Field label="Reference Website / App" error={errors.referenceUrl}>
          <Input type="url" value={formData.referenceUrl} onChange={(event) => set('referenceUrl', event.target.value)} placeholder="https://" className="rounded-xl" />
        </Field>

        <Field label="Preferred Technology">
          <Input value={formData.preferredTechnology} onChange={(event) => set('preferredTechnology', event.target.value)} placeholder="e.g. React, Node.js" className="rounded-xl" />
        </Field>

        <Field label="Existing System Details" wide>
          <Textarea value={formData.existingSystemDetails} onChange={(event) => set('existingSystemDetails', event.target.value)} rows={2} className="rounded-xl" />
        </Field>

        <Field label="Expected Start Date">
          <Input type="date" value={formData.expectedStartDate} onChange={(event) => set('expectedStartDate', event.target.value)} className="rounded-xl" />
        </Field>

        <Field label="Expected Delivery Date" error={errors.expectedDeliveryDate}>
          <Input type="date" value={formData.expectedDeliveryDate} onChange={(event) => set('expectedDeliveryDate', event.target.value)} className="rounded-xl" />
        </Field>

        <div className="md:col-span-2 xl:col-span-3">
          <AttachmentPicker
            attachments={formData.requirementAttachments || []}
            uploadModule="leads"
            uploadEntityId={formData.id || formData.attachmentDraftId}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip"
            onAddFile={(file) => {
              const next = attachmentRecord(file);
              set('requirementAttachments', [...(formData.requirementAttachments || []).filter((item) => String(item.driveFileId || item.id) !== String(next.driveFileId)), next]);
            }}
            onRemoveFile={(driveFileId) => set('requirementAttachments', (formData.requirementAttachments || []).filter((item) => String(item.driveFileId || item.id) !== String(driveFileId)))}
          />
        </div>
      </SectionCard>

      {/* Commercial Details */}
      <SectionCard title="Commercial Details" icon={DollarSign} {...sectionProps('commercial')}>
        <Field label="Budget Minimum" error={errors.budgetMin}>
          <Input type="number" min="0" step="0.01" value={formData.budgetMin} onChange={(event) => set('budgetMin', event.target.value)} className="rounded-xl" />
        </Field>

        <Field label="Budget Maximum" error={errors.budgetMax}>
          <Input type="number" min="0" step="0.01" value={formData.budgetMax} onChange={(event) => set('budgetMax', event.target.value)} className="rounded-xl" />
        </Field>

        <Field label="Budget Range">
          <CompactSelect value={formData.budgetRange} onChange={(value) => set('budgetRange', value)} options={select(options.budgetRanges)} placeholder="Select range" />
        </Field>

        <Field label="Currency">
          <CompactSelect value={formData.currency} onChange={(value) => set('currency', value)} options={select(options.currencies)} placeholder="Select currency" />
        </Field>

        <Field label="Budget Confirmed">
          <CompactSelect value={formData.budgetConfirmed} onChange={(value) => set('budgetConfirmed', value)} options={select(options.budgetConfirmation)} placeholder="Select" />
        </Field>

        <Field label="Billing Type">
          <CompactSelect value={formData.billingType} onChange={(value) => set('billingType', value)} options={select(options.billingTypes)} placeholder="Select billing type" />
        </Field>

        <Field label="GST Invoice Required">
          <CompactSelect value={formData.gstInvoiceRequired} onChange={(value) => set('gstInvoiceRequired', value)} options={select(options.gstOptions)} placeholder="Select" />
        </Field>

        <Field label="Purchase Timeline">
          <CompactSelect value={formData.purchaseTimeline} onChange={(value) => set('purchaseTimeline', value)} options={select(options.purchaseTimelines)} placeholder="Select timeline" />
        </Field>

        <Field label="Expected Closing Date">
          <Input type="date" value={formData.expectedClosingDate} onChange={(event) => set('expectedClosingDate', event.target.value)} className="rounded-xl" />
        </Field>

        <Field label="Payment Preference">
          <CompactSelect value={formData.paymentPreference} onChange={(value) => set('paymentPreference', value)} options={select(options.paymentPreferences)} placeholder="Select preference" />
        </Field>
      </SectionCard>

      {/* Qualification Details */}
      <SectionCard title="Qualification & Scoring" icon={Flag} {...sectionProps('qualification')}>
        <Field label="Decision Maker Identified">
          <CompactSelect value={formData.decisionMakerIdentified} onChange={(value) => set('decisionMakerIdentified', value)} options={select(options.decisionMakerOptions)} placeholder="Select" />
        </Field>

        <Field label="Contact is Decision Maker">
          <label className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={Boolean(formData.contactIsDecisionMaker)} onChange={(event) => set('contactIsDecisionMaker', event.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            Confirmed
          </label>
        </Field>

        {[
          ['requirementConfirmed', 'Requirement Confirmed'],
          ['timelineConfirmed', 'Timeline Confirmed'],
          ['authorityConfirmed', 'Authority Confirmed'],
          ['needConfirmed', 'Need Confirmed']
        ].map(([key, label]) => (
          <Field key={key} label={label}>
            <CompactSelect value={formData[key]} onChange={(value) => set(key, value)} options={select(options.confirmationOptions)} placeholder="Select" />
          </Field>
        ))}

        <Field label="Calculated Lead Score">
          <Input value={score} readOnly className="bg-slate-50 font-semibold text-blue-700 rounded-xl" />
        </Field>

        <Field label="Conversion Probability (%)" error={errors.conversionProbability}>
          <Input type="number" min="0" max="100" value={formData.conversionProbability} onChange={(event) => set('conversionProbability', event.target.value)} placeholder="0 - 100" className="rounded-xl" />
        </Field>

        <Field label="Qualification Notes" wide>
          <Textarea value={formData.qualificationNotes} onChange={(event) => set('qualificationNotes', event.target.value)} rows={2} className="rounded-xl" />
        </Field>
      </SectionCard>

      {referralRequired ? (
        <SectionCard title="Referral / Expected Commission" icon={DollarSign} tone="warning" {...sectionProps('referral')}>
          <Field label="Referrer Type" required error={errors.referrerType}>
            <CompactSelect value={formData.referrerType} onChange={(value) => set('referrerType', value)} options={select(options.referrerTypes)} placeholder="Select type" />
          </Field>

          <Field label="Referrer Name" required error={errors.referrerName}>
            <Input value={formData.referrerName} onChange={(event) => set('referrerName', event.target.value)} className="rounded-xl" />
          </Field>

          <Field label="Referrer Contact" required error={errors.referrerContact}>
            <PhoneInput name="referrerContact" value={formData.referrerContact} onChange={(event) => set('referrerContact', event.target.value)} compact />
          </Field>

          <Field label="Client / Employee / Partner ID">
            <Input value={formData.referrerReferenceId} onChange={(event) => set('referrerReferenceId', event.target.value)} className="rounded-xl" />
          </Field>

          <Field label="Commission Applicable">
            <label className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={Boolean(formData.commissionApplicable)} onChange={(event) => set('commissionApplicable', event.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              Yes
            </label>
          </Field>

          {formData.commissionApplicable ? (
            <>
              <Field label="Commission Type" required error={errors.commissionType}>
                <CompactSelect value={formData.commissionType} onChange={(value) => set('commissionType', value)} options={select(options.commissionTypes)} placeholder="Select type" />
              </Field>

              <Field label="Commission Value" required error={errors.commissionValue}>
                <Input type="number" min="0" max={formData.commissionType === 'Percentage' ? '100' : undefined} value={formData.commissionValue} onChange={(event) => set('commissionValue', event.target.value)} className="rounded-xl" />
              </Field>

              <Field label="Commission Notes" wide>
                <Textarea value={formData.commissionNotes} onChange={(event) => set('commissionNotes', event.target.value)} rows={2} className="rounded-xl" />
              </Field>
            </>
          ) : null}
        </SectionCard>
      ) : null}

      {/* Follow-up Details */}
      <SectionCard title="Follow-up & Team" icon={Calendar} {...sectionProps('followUp')}>
        <Field label="Follow-up Mode">
          <CompactSelect value={formData.followUpMode} onChange={(value) => set('followUpMode', value)} options={select(options.followUpModes)} placeholder="Select mode" />
        </Field>

        <Field label="Reminder">
          <CompactSelect value={formData.reminder} onChange={(value) => set('reminder', value)} options={select(options.reminders)} placeholder="Select reminder" />
        </Field>

        <Field label="Follow-up Priority">
          <CompactSelect value={formData.followUpPriority} onChange={(value) => set('followUpPriority', value)} options={select(options.priorities)} placeholder="Select priority" />
        </Field>

        <Field label="Assigned Team">
          <CompactSelect
            value={formData.assignedTeam}
            onChange={(value) => set('assignedTeam', value)}
            options={assignedTeamOptions}
            placeholder="Select team member"
            searchPlaceholder="Search team..."
          />
        </Field>

        <Field label="Follow-up Note" wide>
          <Textarea value={formData.followUpNote} onChange={(event) => set('followUpNote', event.target.value)} rows={2} className="rounded-xl" />
        </Field>
      </SectionCard>

      {lostStatus ? (
        <SectionCard title="Lost Lead Details" icon={AlertTriangle} tone="warning" {...sectionProps('lost')}>
          <Field label="Lost Reason" required error={errors.lostReason}>
            <CompactSelect value={formData.lostReason} onChange={(value) => set('lostReason', value)} options={select(options.lostReasons)} placeholder="Select reason" />
          </Field>

          <Field label="Competitor Name">
            <Input value={formData.competitorName} onChange={(event) => set('competitorName', event.target.value)} className="rounded-xl" />
          </Field>

          <Field label="Competitor Price" error={errors.competitorPrice}>
            <Input type="number" min="0" value={formData.competitorPrice} onChange={(event) => set('competitorPrice', event.target.value)} className="rounded-xl" />
          </Field>

          <Field label="Reconnect in Future">
            <label className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={Boolean(formData.reconnectInFuture)} onChange={(event) => set('reconnectInFuture', event.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              Yes
            </label>
          </Field>

          {formData.reconnectInFuture ? (
            <Field label="Reconnect Date" required error={errors.reconnectDate}>
              <Input type="date" value={formData.reconnectDate} onChange={(event) => set('reconnectDate', event.target.value)} className="rounded-xl" />
            </Field>
          ) : null}

          <Field label="Lost Reason Notes" required={formData.lostReason === 'Other'} error={errors.lostReasonNotes} wide>
            <Textarea value={formData.lostReasonNotes} onChange={(event) => set('lostReasonNotes', event.target.value)} rows={2} className="rounded-xl" />
          </Field>
        </SectionCard>
      ) : null}

      {formData.status === 'Duplicate' ? (
        <SectionCard title="Duplicate Mapping" icon={AlertTriangle} tone="warning" {...sectionProps('duplicate')}>
          <Field label="Original Lead" required error={errors.originalLeadId} wide>
            <CompactSelect value={formData.originalLeadId} onChange={(value) => set('originalLeadId', value)} options={duplicateLeads.map((lead) => ({ value: lead.id, label: `${lead.leadNumber || lead.id} - ${lead.contactPerson || lead.companyName || lead.name}` }))} placeholder="Select original lead" />
          </Field>
        </SectionCard>
      ) : null}

      {/* Source and Campaign */}
      <SectionCard title="Source & Campaign Details" icon={Layers} {...sectionProps('source')}>
        <Field label="Campaign Name">
          <Input value={formData.campaignName} onChange={(event) => set('campaignName', event.target.value)} className="rounded-xl" />
        </Field>

        <Field label="Source Reference" required={formData.source === 'Other'} error={errors.sourceReference}>
          <Input value={formData.sourceReference} onChange={(event) => set('sourceReference', event.target.value)} className="rounded-xl" />
        </Field>

        <Field label="UTM Source">
          <Input value={formData.utmSource} onChange={(event) => set('utmSource', event.target.value)} className="rounded-xl" />
        </Field>

        <Field label="UTM Medium">
          <Input value={formData.utmMedium} onChange={(event) => set('utmMedium', event.target.value)} className="rounded-xl" />
        </Field>

        <Field label="UTM Campaign">
          <Input value={formData.utmCampaign} onChange={(event) => set('utmCampaign', event.target.value)} className="rounded-xl" />
        </Field>
      </SectionCard>

      <style>{`
        .lead-management-fields input,
        .lead-management-fields select,
        .lead-management-fields textarea {
          border-radius: 0.75rem !important;
        }
        .lead-management-fields details {
          border-radius: 1rem !important;
        }
      `}</style>
    </div>
  );
}
