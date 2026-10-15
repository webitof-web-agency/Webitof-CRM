import { useEffect, useMemo, useState } from 'react';
import {
  Scale,
  Plus,
  Search,
  Star,
  Check,
  Copy,
  Edit2,
  Trash2,
  Eye,
  RefreshCw,
  FileText,
  ShieldCheck,
  CheckCircle2,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
  BookOpen,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Input, Textarea } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/overlays/ConfirmDialog';
import { SearchableSelect } from '../components/forms/SearchableSelect';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { cn } from '../lib/cn';

export const IT_AGREEMENT_TYPES = [
  { value: 'terms_and_conditions', label: 'Terms and Conditions', category: 'General', defaultInQuotation: true },
  { value: 'service_agreement', label: 'Service Agreement / Development Agreement', category: 'Contracts', defaultInQuotation: false },
  { value: 'sow', label: 'SOW (Statement of Work)', category: 'Project Governance', defaultInQuotation: false },
  { value: 'payment_terms', label: 'Payment Terms Agreement', category: 'Commercial', defaultInQuotation: true },
  { value: 'nda', label: 'NDA (Non-Disclosure Agreement)', category: 'Confidentiality', defaultInQuotation: false },
  { value: 'ip_ownership', label: 'IP Ownership / Source Code Agreement', category: 'Intellectual Property', defaultInQuotation: true },
  { value: 'change_request', label: 'Change Request Agreement', category: 'Project Governance', defaultInQuotation: false },
  { value: 'dpa', label: 'DPA (Data Processing Agreement)', category: 'Security & Privacy', defaultInQuotation: false },
  { value: 'sla', label: 'SLA (Service Level Agreement)', category: 'Operations', defaultInQuotation: false },
  { value: 'amc_agreement', label: 'AMC / Maintenance Agreement', category: 'Maintenance', defaultInQuotation: false },
  { value: 'project_acceptance', label: 'Project Acceptance / Sign-off', category: 'Project Governance', defaultInQuotation: false },
  { value: 'handover_certificate', label: 'Handover Certificate', category: 'Project Governance', defaultInQuotation: false },
  { value: 'termination_closure', label: 'Termination / Closure Agreement', category: 'Contracts', defaultInQuotation: false }
];

export const IT_LEGAL_PRESETS = [
  {
    type: 'terms_and_conditions',
    label: 'Terms and Conditions',
    category: 'General',
    description: 'Core commercial and operational terms & conditions for project proposals',
    includeInQuotation: true,
    content: `1. Quotation Validity: This quotation is valid for 30 calendar days from the date of issue.
2. Acceptance of Scope: Commencement of work shall begin upon receipt of the initial advance payment and signed proposal acceptance.
3. Client Deliverables: Timely delivery depends strictly on timely inputs, branding assets, API credentials, and approvals provided by the client.
4. Third-Party Costs: Domain names, web hosting, third-party API licenses, SMS gateways, and app store developer accounts are billed directly or separately.
5. Communication & Reviews: Primary communication, progress updates, and revision requests shall be handled through designated email and ticketing channels.
6. Governing Law & Dispute Resolution: This engagement is governed by local laws and subject to the exclusive jurisdiction of the competent courts in Raipur, Chhattisgarh.`
  },
  {
    type: 'service_agreement',
    label: 'Service Agreement / Development Agreement',
    category: 'Contracts',
    description: 'Formal Master Services & Software Development Agreement terms',
    includeInQuotation: false,
    content: `1. Professional Standard: The Service Provider agrees to deliver software engineering and digital services in a professional, workmanlike manner adhering to industry standards.
2. Independent Contractor: The relationship between the parties is that of an independent contractor. Neither party is an agent, partner, or joint venturer of the other.
3. Development Milestones: Engineering sprints and deliverable milestones will follow the approved project roadmap. Client feedback must be provided within 5 business days of milestone completion.
4. Post-Launch Warranty: A 30-day bug-fix warranty is provided following production release for bugs directly attributable to the agreed scope.
5. Non-Solicitation: During the engagement and for 12 months thereafter, neither party shall directly solicit or hire the employees or contractors of the other party without prior written consent.`
  },
  {
    type: 'sow',
    label: 'SOW (Statement of Work)',
    category: 'Project Governance',
    description: 'Detailed scope specification, milestone deliverables, and exclusion boundaries',
    includeInQuotation: false,
    content: `1. Scope Boundaries: The deliverables and technical features explicitly outlined in this proposal constitute the entire scope of work. Any features not specifically mentioned are deemed out of scope.
2. Deliverable Verification: Each deliverable will be deployed to a designated staging environment for verification against the acceptance criteria.
3. Review Turnaround: The client agrees to test and provide consolidated feedback within 7 business days of each milestone drop. Absence of objections within this window constitutes deemed milestone approval.
4. Project Managers: Each party will designate a single Point of Contact (POC) authorized to sign off on technical clarifications, sprint reviews, and approvals.`
  },
  {
    type: 'payment_terms',
    label: 'Payment Terms Agreement',
    category: 'Commercial',
    description: 'Milestone billing schedule, due dates, late fees, and payment terms',
    includeInQuotation: true,
    content: `1. Payment Schedule:
   - 40% Advance Payment: Upon project signing and kickoff.
   - 40% Intermediate Milestone: Upon completion of core development & staging deployment.
   - 20% Final Settlement: Upon project UAT sign-off prior to production go-live & source transfer.
2. Due Date: Invoices are payable within 7 business days from date of presentation.
3. Late Payments: Overdue balances beyond 15 days incur interest at 1.5% per month or the legal statutory maximum.
4. Suspension of Work: The service provider reserves the right to suspend development and staging server access if payments remain past due for more than 10 business days.`
  },
  {
    type: 'nda',
    label: 'NDA (Non-Disclosure Agreement)',
    category: 'Confidentiality',
    description: 'Confidentiality, trade secrets, business logic, and proprietary data protection',
    includeInQuotation: false,
    content: `1. Confidential Information: Both parties acknowledge that proprietary business data, customer records, technical architectures, credentials, and source code shared during this engagement constitute Confidential Information.
2. Duty of Care: Both parties agree to protect such confidential information with the same degree of care used for their own proprietary data, and in no event less than reasonable care.
3. Permitted Purpose: Confidential Information shall be used exclusively for the performance of obligations under this contract.
4. Exclusions: Confidentiality does not apply to information that is publicly known, rightfully received from a third party without breach, or independently developed.
5. Term: Confidentiality obligations remain binding during the engagement and for 3 years following contract termination.`
  },
  {
    type: 'ip_ownership',
    label: 'IP Ownership / Source Code Agreement',
    category: 'Intellectual Property',
    description: 'Ownership transfer, repository access, licenses, and portfolio rights',
    includeInQuotation: true,
    content: `1. IP Transfer: Full intellectual property rights, copyright, custom source code, and design assets developed under this agreement transfer to the client upon 100% full settlement of all project invoices.
2. Pre-Existing Components: The Service Provider retains ownership of its proprietary pre-existing software libraries, boilerplate tools, and developer utilities incorporated into the project, granting the client a perpetual, royalty-free, worldwide license to use them.
3. Open-Source Libraries: Any third-party open-source libraries remain subject to their respective open-source license agreements (e.g., MIT, Apache 2.0).
4. Portfolio Credit: The Service Provider reserves the right to showcase non-confidential project screenshots, logos, and case study overviews in its company portfolio and marketing collateral.`
  },
  {
    type: 'change_request',
    label: 'Change Request Agreement',
    category: 'Project Governance',
    description: 'Change order workflow, scope expansion pricing, and timeline adjustments',
    includeInQuotation: false,
    content: `1. Scope Modification: Any modification, addition, or deletion to the approved specifications must follow a formal Change Request (CR) procedure.
2. Impact Analysis: Upon receiving a change request, the Service Provider will prepare a CR document detailing the technical feasibility, timeline impact, and associated commercial cost.
3. Sign-off Required: Work on requested changes will not commence until both parties have executed the written Change Request addendum and agreed upon pricing.
4. Billing Basis: Approved change requests will be billed at the standard hourly development rate or as a fixed-fee milestone addendum.`
  },
  {
    type: 'dpa',
    label: 'DPA (Data Processing Agreement)',
    category: 'Security & Privacy',
    description: 'Data protection standards, privacy compliance, IT Act & DPDP Act compliance',
    includeInQuotation: false,
    content: `1. Scope of Processing: The Service Provider shall process client personal and business data strictly to the extent necessary to deliver the contracted software engineering services.
2. Security Controls: The Service Provider implements administrative, physical, and technical safeguards including TLS 1.3 encryption in transit and encrypted data storage where applicable.
3. Sub-processors: Sub-processors (such as cloud hosting providers and database engines) engaged by the Service Provider are bound by data confidentiality terms at least as stringent as this agreement.
4. Incident Notification: In the event of a confirmed security breach involving client data, the Service Provider will notify the client within 48 hours and provide technical remediation assistance.
5. Data Deletion: Upon contract termination and written request, the Service Provider will securely erase or return client data from active development environments within 30 days.`
  },
  {
    type: 'sla',
    label: 'SLA (Service Level Agreement)',
    category: 'Operations',
    description: 'Support response times, incident resolution categories, and service uptime',
    includeInQuotation: false,
    content: `1. Support Window: Standard technical assistance is provided Monday through Saturday, 10:00 AM to 7:00 PM IST (excluding public holidays).
2. Priority Response Times:
   - Priority 1 (System Down / Blocker): Response within 2 hours; resolution effort continuous until stabilized.
   - Priority 2 (Major Feature Impacted): Response within 6 business hours; workaround or fix within 24 hours.
   - Priority 3 (Minor Bug / UI Glitch): Response within 12 business hours; resolution in next scheduled build.
   - Priority 4 (General Inquiry / Task): Response within 24 business hours.
3. System Uptime: Managed cloud hosting environments aim for 99.5% service uptime excluding scheduled off-peak maintenance windows.`
  },
  {
    type: 'amc_agreement',
    label: 'AMC / Maintenance Agreement',
    category: 'Maintenance',
    description: 'Annual maintenance contract terms, periodic updates, and support scope',
    includeInQuotation: false,
    content: `1. Coverage Period: AMC coverage is valid for 12 continuous months from the effective date, renewable annually.
2. Inclusions:
   - Routine dependency updates, security patches, and server monitoring.
   - Periodic database backups and recovery drills.
   - Dedicated technical support hours per month as specified in the chosen plan.
3. Exclusions: New feature modules, third-party API subscription costs, database migrations to new platforms, and design overhauls are excluded from AMC scope.
4. Non-Rollover: Unused monthly support hours do not carry over into subsequent months.
5. Invoicing: AMC fees are billed 100% in advance on an annual or quarterly schedule.`
  },
  {
    type: 'project_acceptance',
    label: 'Project Acceptance / Sign-off',
    category: 'Project Governance',
    description: 'Formal User Acceptance Testing (UAT) guidelines and project acceptance criteria',
    includeInQuotation: false,
    content: `1. UAT Period: The client is granted a 10-business-day User Acceptance Testing (UAT) window upon deployment of the release candidate to the staging environment.
2. Issue Logging: Any variance between the approved scope and application behavior must be logged with reproducible steps within the UAT window.
3. Deemed Sign-off: If no blocker or critical defects are formally submitted within the 10-business-day UAT period, the project will be deemed accepted and signed off.
4. Production Release: Final production deployment and live domain cutover proceed immediately upon execution of the Acceptance Certificate.`
  },
  {
    type: 'handover_certificate',
    label: 'Handover Certificate',
    category: 'Project Governance',
    description: 'Verification checklist for deliverables, credentials, and repository transfer',
    includeInQuotation: false,
    content: `1. Handover Verification: The Service Provider formally transfers the following deliverables upon final invoice clearance:
   - Production source code repository access and commit history.
   - Administrative credentials for CMS, hosting, and cloud infrastructure.
   - System configuration documentation, architectural diagrams, and deployment guides.
2. Handover Walkthrough: The Service Provider will conduct up to two 60-minute remote training walkthroughs with the client's internal team.
3. Acknowledgment: The client acknowledges receipt of all stated assets and confirms successful credential verification.`
  },
  {
    type: 'termination_closure',
    label: 'Termination / Closure Agreement',
    category: 'Contracts',
    description: 'Contract termination clauses, cure periods, and final account settlement',
    includeInQuotation: false,
    content: `1. Termination for Convenience: Either party may terminate this agreement by providing 30 days written notice to the other party.
2. Termination for Material Breach: If either party commits a material breach, the non-breaching party may issue written notice specifying the breach. If un-cured within 15 calendar days, the contract terminates immediately.
3. Financial Settlement: Upon termination, the client shall pay for all work completed, milestone progress, and non-cancellable expenses incurred up to the effective termination date.
4. Asset Return: Upon settlement of accounts, the Service Provider will transfer all completed deliverables and securely delete or return client confidential assets.`
  }
];

const CATEGORY_LIST = [
  'All',
  'General',
  'Contracts',
  'Project Governance',
  'Commercial',
  'Confidentiality',
  'Intellectual Property',
  'Security & Privacy',
  'Operations',
  'Maintenance'
];

const EMPTY_FORM = {
  name: '',
  documentType: 'terms_and_conditions',
  category: 'General',
  includeInQuotation: false,
  isDefault: false,
  description: '',
  content: '',
  isActive: true,
  sortOrder: 0
};

export function LegalMasterPage() {
  const { token, hasPermission } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 200);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [quotationFilter, setQuotationFilter] = useState('all'); // 'all', 'in_quotation', 'not_in_quotation'

  // Modals state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const [previewItem, setPreviewItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  const canWrite = hasPermission('masters.write') || hasPermission('masters.read');
  const canDelete = hasPermission('masters.delete') || hasPermission('masters.write');

  // Load legal items
  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const response = await api.resources.list('/masters/legal_term', token, debouncedSearch);
        if (!mounted) return;
        const raw = response?.data || [];
        const normalized = raw.map((item) => {
          const payload = item.payload || {};
          return {
            ...item,
            id: item.id,
            name: item.name,
            documentType: item.documentType || payload.documentType || '',
            category: item.category || payload.category || 'General',
            content: item.content !== undefined ? item.content : (item.terms || payload.content || payload.terms || ''),
            includeInQuotation: Boolean(item.includeInQuotation ?? payload.includeInQuotation ?? false),
            isDefault: Boolean(item.isDefault ?? payload.isDefault),
            description: item.description || payload.description || '',
            isActive: item.isActive !== false && item.is_active !== false,
            sortOrder: Number(item.sortOrder ?? item.sort_order ?? 0)
          };
        });
        setItems(normalized);
      } catch (err) {
        if (!mounted) return;
        toast.error(err.message || 'Failed to load Legal Master data');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [debouncedSearch, reloadTick, token]);

  const quotationCount = useMemo(() => items.filter((i) => i.includeInQuotation).length, [items]);

  // Filtered rows
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (categoryFilter !== 'All' && item.category !== categoryFilter) return false;
      if (quotationFilter === 'in_quotation' && !item.includeInQuotation) return false;
      if (quotationFilter === 'not_in_quotation' && item.includeInQuotation) return false;
      if (debouncedSearch) {
        const query = debouncedSearch.toLowerCase();
        const matchesName = String(item.name || '').toLowerCase().includes(query);
        const matchesDesc = String(item.description || '').toLowerCase().includes(query);
        const matchesContent = String(item.content || '').toLowerCase().includes(query);
        const matchesCategory = String(item.category || '').toLowerCase().includes(query);
        if (!matchesName && !matchesDesc && !matchesContent && !matchesCategory) return false;
      }
      return true;
    }).sort((a, b) => {
      if (a.isDefault !== b.isDefault) return b.isDefault ? 1 : -1;
      if (a.includeInQuotation !== b.includeInQuotation) return b.includeInQuotation ? 1 : -1;
      return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
    });
  }, [items, categoryFilter, quotationFilter, debouncedSearch]);

  function handleOpenCreate() {
    setEditingItem(null);
    setFormData({
      ...EMPTY_FORM,
      name: IT_LEGAL_PRESETS[0].label,
      documentType: IT_LEGAL_PRESETS[0].type,
      category: IT_LEGAL_PRESETS[0].category,
      description: IT_LEGAL_PRESETS[0].description,
      content: IT_LEGAL_PRESETS[0].content,
      includeInQuotation: true
    });
    setEditorOpen(true);
  }

  function handleOpenEdit(item) {
    setEditingItem(item);
    setFormData({
      name: item.name || '',
      documentType: item.documentType || 'terms_and_conditions',
      category: item.category || 'General',
      includeInQuotation: Boolean(item.includeInQuotation),
      isDefault: Boolean(item.isDefault),
      description: item.description || '',
      content: item.content || '',
      isActive: item.isActive !== false,
      sortOrder: item.sortOrder || 0
    });
    setEditorOpen(true);
  }

  async function handleToggleQuotation(item, e) {
    e?.stopPropagation();
    const nextVal = !item.includeInQuotation;
    try {
      await api.resources.update(
        '/masters/legal_term',
        item.id,
        {
          ...item,
          includeInQuotation: nextVal,
          payload: {
            ...(item.payload || {}),
            includeInQuotation: nextVal
          }
        },
        token
      );
      toast.success(
        nextVal
          ? `"${item.name}" will now be included in quotations by default`
          : `"${item.name}" excluded from quotation defaults`
      );
      setItems((prev) => prev.map((it) => it.id === item.id ? { ...it, includeInQuotation: nextVal } : it));
      if (previewItem?.id === item.id) {
        setPreviewItem({ ...previewItem, includeInQuotation: nextVal });
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update quotation toggle');
    }
  }

  async function handleSave(event) {
    event?.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Please enter a template name');
      return;
    }
    if (!formData.content.trim()) {
      toast.error('Please enter agreement clauses');
      return;
    }

    setBusy(true);
    try {
      const payload = {
        name: formData.name.trim(),
        is_active: formData.isActive,
        isActive: formData.isActive,
        sort_order: Number(formData.sortOrder || 0),
        sortOrder: Number(formData.sortOrder || 0),
        category: formData.category,
        documentType: formData.documentType,
        description: formData.description.trim(),
        content: formData.content.trim(),
        includeInQuotation: Boolean(formData.includeInQuotation),
        isDefault: Boolean(formData.isDefault),
        payload: {
          category: formData.category,
          documentType: formData.documentType,
          description: formData.description.trim(),
          content: formData.content.trim(),
          includeInQuotation: Boolean(formData.includeInQuotation),
          isDefault: Boolean(formData.isDefault)
        }
      };

      if (editingItem?.id) {
        await api.resources.update('/masters/legal_term', editingItem.id, payload, token);
        toast.success('Legal agreement template updated successfully');
      } else {
        await api.resources.create('/masters/legal_term', payload, token);
        toast.success('Legal agreement template created successfully');
      }

      setEditorOpen(false);
      setReloadTick((t) => t + 1);
    } catch (err) {
      toast.error(err.message || 'Failed to save legal agreement');
    } finally {
      setBusy(false);
    }
  }

  async function handleSetDefault(item) {
    if (item.isDefault) return;
    setBusy(true);
    try {
      await api.resources.update(
        '/masters/legal_term',
        item.id,
        {
          ...item,
          isDefault: true,
          includeInQuotation: true,
          payload: {
            ...(item.payload || {}),
            isDefault: true,
            includeInQuotation: true
          }
        },
        token
      );
      toast.success(`"${item.name}" is now the primary Default Quotation Terms`);
      setReloadTick((t) => t + 1);
      if (previewItem?.id === item.id) {
        setPreviewItem({ ...previewItem, isDefault: true, includeInQuotation: true });
      }
    } catch (err) {
      toast.error(err.message || 'Failed to set default template');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.resources.remove('/masters/legal_term', deleteTarget.id, token);
      toast.success(`Deleted "${deleteTarget.name}"`);
      setDeleteTarget(null);
      setReloadTick((t) => t + 1);
    } catch (err) {
      toast.error(err.message || 'Failed to delete legal template');
    } finally {
      setBusy(false);
    }
  }

  function handleCopyContent(text) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success('Agreement clauses copied to clipboard');
  }

  function applyPreset(preset) {
    setFormData((prev) => ({
      ...prev,
      name: preset.label,
      documentType: preset.type,
      category: preset.category,
      description: preset.description,
      includeInQuotation: preset.includeInQuotation,
      content: preset.content
    }));
    toast.success(`Loaded "${preset.label}" standard IT clauses`);
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <PageHeader
        title="Legal Master"
        description="Comprehensive IT company agreements, Terms & Conditions, SLAs, SOWs, DPAs, and NDAs. Toggle which agreements appear at the end of client quotations."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReloadTick((t) => t + 1)}
              disabled={loading}
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </Button>
            {canWrite && (
              <Button size="sm" onClick={handleOpenCreate} className="gap-1.5 shadow-sm">
                <Plus size={16} /> Add Legal Agreement
              </Button>
            )}
          </div>
        }
      />

      {/* Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total IT Legal Agreements"
          value={items.length}
          icon={FileText}
          description="Contracts, SOWs, NDAs, DPAs & SLAs"
        />
        <Card className="p-5 flex flex-col justify-between border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-teal-50/40">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-800">
              <CheckCircle2 size={15} className="text-emerald-600" /> Active in Quotations
            </div>
            <div className="text-2xl font-black text-slate-900">
              {quotationCount} <span className="text-sm font-medium text-slate-500">of {items.length} enabled</span>
            </div>
            <p className="text-xs text-slate-600">
              Agreements toggled ON are automatically included at the end of client quotations.
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-emerald-200/80 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQuotationFilter(quotationFilter === 'in_quotation' ? 'all' : 'in_quotation')}
              className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
            >
              {quotationFilter === 'in_quotation' ? 'Show All Agreements' : 'Filter Quotation Agreements'}
            </button>
          </div>
        </Card>
        <Card className="p-5 flex flex-col justify-between border-blue-200 bg-gradient-to-br from-blue-50/70 to-indigo-50/40">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-700">
              <Star size={14} className="fill-blue-600 text-blue-600" /> Primary Quotation Terms
            </div>
            <div className="text-base font-bold text-slate-900 truncate">
              {items.find((i) => i.isDefault)?.name || 'Terms and Conditions'}
            </div>
            <p className="text-xs text-slate-600 line-clamp-1">
              Primary governing terms automatically attached to every quotation proposal.
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-blue-100 flex items-center gap-2">
            <span className="text-[11px] font-medium text-blue-800">
              Toggle buttons below control quotation visibility for each agreement.
            </span>
          </div>
        </Card>
      </div>

      {/* Filter and Category Toolbar */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agreements, SOW, NDA, SLA, clauses..."
              className="pl-9 text-xs sm:text-sm h-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5 bg-[var(--surface-2)]">
              <button
                type="button"
                onClick={() => setQuotationFilter('all')}
                className={cn(
                  'px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer',
                  quotationFilter === 'all'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                )}
              >
                All ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setQuotationFilter('in_quotation')}
                className={cn(
                  'px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1',
                  quotationFilter === 'in_quotation'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-emerald-700 hover:text-emerald-900'
                )}
              >
                In Quotation ({quotationCount})
              </button>
              <button
                type="button"
                onClick={() => setQuotationFilter('not_in_quotation')}
                className={cn(
                  'px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer',
                  quotationFilter === 'not_in_quotation'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                )}
              >
                Excluded ({items.length - quotationCount})
              </button>
            </div>
          </div>
        </div>

        {/* Category Chips Bar */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[var(--border)]">
          <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
            <Filter size={12} /> Category:
          </span>
          {CATEGORY_LIST.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer border',
                categoryFilter === cat
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </Card>

      {/* Agreements Cards & Table List */}
      <Card className="overflow-hidden">
        {loading && items.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="animate-spin text-blue-500" size={24} />
            <span className="text-sm">Loading IT legal agreements...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <Scale className="mx-auto text-slate-300" size={36} />
            <div className="font-semibold text-slate-700">No agreements match your filters</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Clear search or category filters to see all available IT agreements.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {filteredItems.map((item) => {
              const inQuotation = Boolean(item.includeInQuotation);
              const isDefault = Boolean(item.isDefault);
              return (
                <div
                  key={item.id}
                  className={cn(
                    'p-4 sm:p-5 transition-colors hover:bg-slate-50/70 flex flex-col lg:flex-row lg:items-start justify-between gap-4',
                    inQuotation && 'bg-emerald-50/20'
                  )}
                >
                  <div className="space-y-2.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        {item.name}
                      </h3>
                      {isDefault && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                          <Star size={11} className="fill-blue-600 text-blue-600" /> Default Terms
                        </span>
                      )}
                      <Badge variant="outline" className="text-[10px] font-semibold">
                        {item.category}
                      </Badge>
                      <Badge variant={item.isActive ? 'success' : 'neutral'} className="text-[10px]">
                        {item.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    {item.description && (
                      <p className="text-xs text-slate-500 line-clamp-1">
                        {item.description}
                      </p>
                    )}

                    {/* Clauses snippet */}
                    <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3 text-xs text-slate-700 font-mono leading-relaxed line-clamp-3 whitespace-pre-line">
                      {item.content || '(No clauses defined)'}
                    </div>
                  </div>

                  {/* Actions & Quotation Toggle */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-end gap-2.5 shrink-0 pt-1">
                    {/* 🔘 TOGGLE BUTTON FOR QUOTATION */}
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border rounded-xl px-3 py-1.5 shadow-2xs">
                      <span className="text-[11px] font-semibold text-slate-600">
                        Show in Quotation:
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleToggleQuotation(item, e)}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold transition-all cursor-pointer border',
                          inQuotation
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs hover:bg-emerald-700'
                            : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                        )}
                        title={inQuotation ? 'Click to exclude from quotations' : 'Click to include in quotations'}
                      >
                        {inQuotation ? (
                          <>
                            <CheckCircle2 size={13} />
                            <span>ON</span>
                          </>
                        ) : (
                          <>
                            <span className="h-2 w-2 rounded-full bg-slate-400" />
                            <span>OFF</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Buttons row */}
                    <div className="flex items-center gap-1.5">
                      {!isDefault && canWrite && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetDefault(item)}
                          className="h-8 px-2 text-xs text-blue-700 hover:bg-blue-50 border-blue-200"
                          title="Set as primary default quotation terms"
                        >
                          <Star size={13} className="mr-1 text-blue-600" /> Make Default
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewItem(item)}
                        className="h-8 px-2 text-xs"
                        title="Preview full document clauses"
                      >
                        <Eye size={14} className="text-slate-600" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyContent(item.content)}
                        className="h-8 px-2 text-xs"
                        title="Copy text"
                      >
                        <Copy size={14} className="text-slate-600" />
                      </Button>
                      {canWrite && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(item)}
                          className="h-8 px-2 text-xs"
                          title="Edit agreement"
                        >
                          <Edit2 size={14} className="text-slate-600" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(item)}
                          className="h-8 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                          title="Delete agreement"
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Add / Edit Modal */}
      <Modal
        open={editorOpen}
        onClose={() => !busy && setEditorOpen(false)}
        title={editingItem ? `Edit: ${formData.name}` : 'Create IT Legal Agreement Template'}
        description="Configure clauses, agreement scope, and whether to include this document in quotations."
        width="760px"
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setEditorOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={busy}>
              {busy ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Template'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          {/* Quick IT Presets */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                <BookOpen size={14} /> Standard IT Company Agreement Presets:
              </span>
              <span className="text-[11px] text-indigo-600 font-medium">Click to load standard clauses</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
              {IT_LEGAL_PRESETS.map((p) => (
                <button
                  key={p.type}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-indigo-900 shadow-2xs border border-indigo-200 hover:bg-indigo-100 transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-semibold text-slate-700">Agreement Title *</span>
              <Input
                value={formData.name}
                onChange={(e) => setFormData((cur) => ({ ...cur, name: e.target.value }))}
                placeholder="e.g. SOW (Statement of Work)"
                required
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-semibold text-slate-700">Document Type</span>
              <select
                value={formData.documentType}
                onChange={(e) => {
                  const val = e.target.value;
                  const matched = IT_AGREEMENT_TYPES.find((t) => t.value === val);
                  setFormData((cur) => ({
                    ...cur,
                    documentType: val,
                    category: matched?.category || cur.category
                  }));
                }}
                className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-1)] px-3 text-xs font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              >
                {IT_AGREEMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-xs font-semibold text-slate-700">Category</span>
              <Input
                value={formData.category}
                onChange={(e) => setFormData((cur) => ({ ...cur, category: e.target.value }))}
                placeholder="e.g. Contracts, Security, Governance"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-semibold text-slate-700">Description (Optional)</span>
              <Input
                value={formData.description}
                onChange={(e) => setFormData((cur) => ({ ...cur, description: e.target.value }))}
                placeholder="Brief summary of when to use this agreement"
              />
            </label>
          </div>

          {/* Quotation Toggle Box */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-600" />
                Include in Quotations by Default
              </span>
              <p className="text-[11px] text-slate-600">
                When enabled, this legal agreement will be automatically included at the end of every client proposal.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.includeInQuotation}
                onChange={(e) => setFormData((cur) => ({ ...cur, includeInQuotation: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <label className="block">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Legal Agreement Clauses *</span>
              <span className="text-[11px] text-slate-400">Numbered clauses recommended</span>
            </div>
            <Textarea
              value={formData.content}
              onChange={(e) => setFormData((cur) => ({ ...cur, content: e.target.value }))}
              rows={9}
              placeholder="1. Clause title: Clause details..."
              className="font-mono text-xs leading-relaxed bg-white"
              required
            />
          </label>

          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData((cur) => ({ ...cur, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-medium text-slate-700">Active</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isDefault}
                onChange={(e) => setFormData((cur) => ({ ...cur, isDefault: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-medium text-slate-700">Primary Default Template</span>
            </label>
          </div>
        </form>
      </Modal>

      {/* Preview Full Clauses Modal */}
      {previewItem && (
        <Modal
          open={Boolean(previewItem)}
          onClose={() => setPreviewItem(null)}
          title={previewItem.name}
          description={`${previewItem.category} Agreement`}
          width="680px"
          footer={
            <div className="flex justify-between w-full items-center">
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleQuotation(previewItem)}
                  className={cn(
                    'text-xs gap-1',
                    previewItem.includeInQuotation
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'text-slate-700'
                  )}
                >
                  {previewItem.includeInQuotation ? '✓ Included in Quotation' : '+ Add to Quotation'}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyContent(previewItem.content)}
                  className="gap-1.5"
                >
                  <Copy size={14} /> Copy
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPreviewItem(null)}>
                  Close
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{previewItem.category}</Badge>
                {previewItem.includeInQuotation && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    <CheckCircle2 size={12} className="text-emerald-700" /> In Quotation
                  </span>
                )}
                {previewItem.isDefault && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                    <Star size={12} className="fill-blue-600 text-blue-600" /> Default Terms
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400">
                {previewItem.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs sm:text-sm text-slate-800 font-mono leading-relaxed whitespace-pre-line max-h-[420px] overflow-y-auto">
              {previewItem.content || '(No content)'}
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Legal Agreement Template"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? Quotations already created will keep their text, but this template won't be available for new proposals.`}
        confirmText="Delete Agreement"
        variant="danger"
        busy={busy}
      />
    </div>
  );
}

export default LegalMasterPage;
