import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Save, RefreshCw, Building2, Palette, Mail, FileText, Shield, Image, Upload, Trash2, Check, AppWindow, Box, X, ListTodo, Plus, Calculator, Receipt, ToggleLeft, Clock3, ShieldAlert, CheckCircle2, Globe, Copy, Code2, Send, Zap, Key, PenTool, FileCheck2, ExternalLink, Eye, Download, Pencil, EyeOff, HardDrive } from 'lucide-react';
import { SearchableSelect } from '../components/forms/SearchableSelect';
import { INDIA_STATE_OPTIONS, getCitiesByState, getStateCode } from '../data/indiaLocations';
import { Modal } from '../components/ui/Modal';
import { toast } from 'sonner';
import { api, API_BASE_URL } from '../api/client';
import { getFileViewUrl } from '../lib/fileUpload';
import { StorageSettingsPanel } from '../components/settings/StorageSettingsPanel';
import { Card } from '../components/ui/Card';
import { Input, Textarea } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_SETTINGS } from '../config/defaultSettings';
import { applyTheme, applyUiSettings, persistAndApplyThemeSettings } from '../config/theme';
import { cn } from '../lib/cn';
import { FileBrowserModal } from '../components/ui/FileBrowserModal';
import { ThemeSwitcher } from '../components/layout/ThemeSwitcher';

function mergeDeep(target = {}, source = {}) {
  const result = Array.isArray(target) ? [...target] : { ...target };
  Object.entries(source || {}).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = mergeDeep(target?.[key] || {}, value);
    } else {
      result[key] = value;
    }
  });
  return result;
}

function updateSection(setState, section, key, value) {
  setState((current) => ({
    ...current,
    [section]: {
      ...(current[section] || {}),
      [key]: value
    }
  }));
}

async function copyToClipboard(text, label = 'Value') {
  if (!text) return;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
      return;
    }
  } catch (err) {
    // Fall back to execCommand
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (successful) {
      toast.success(`${label} copied to clipboard`);
    } else {
      toast.error(`Unable to copy ${label}`);
    }
  } catch (err) {
    toast.error(`Unable to copy ${label}`);
  }
}

function normalizeBadgeItem(item, fallbackColor = '#64748b') {
  if (typeof item === 'string') {
    return { label: item, color: fallbackColor, state: 'open' };
  }

  if (item && typeof item === 'object') {
    return {
      label: item.label || item.value || '',
      color: item.color || item.badgeColor || fallbackColor,
      state: item.state || 'open'
    };
  }

  return { label: '', color: fallbackColor, state: 'open' };
}

const COMPANY_CERTIFICATE_TYPES = [
  { type: 'incorporation', label: 'Certificate of Incorporation (COI / CIN)', defaultNumber: 'U72900CT2022OPC013562', desc: 'MCA RoC Certificate' },
  { type: 'udyam', label: 'Udyam MSME Registration Certificate', defaultNumber: 'UDYAM-CG-14-0034411', desc: 'Ministry of MSME' },
  { type: 'gst', label: 'GST Registration Certificate (REG-06)', defaultNumber: '22AADCW3373Q1ZW', desc: 'GST Portal REG-06' },
  { type: 'pan', label: 'Company PAN Card', defaultNumber: 'AADCW3373Q', desc: 'Income Tax Department' },
  { type: 'tan', label: 'TAN Allotment Letter', defaultNumber: 'JBPW00418F', desc: 'TDS / Tax Allotment' },
  { type: 'iso', label: 'ISO / Quality Certification', defaultNumber: '', desc: 'Quality Management' }
];

export function SettingsPage() {
  const { token, hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'company');
  // Google Drive sign-in redirects back with ?tab=storage&gdrive=connected|error&message=…
  const [oauthResult] = useState(() => (searchParams.get('gdrive')
    ? { gdrive: searchParams.get('gdrive'), message: searchParams.get('message') || '' }
    : null));
  const clearOauthResult = useCallback(() => setSearchParams({}, { replace: true }), [setSearchParams]);
  const [uploadingLogo, setUploadingLogo] = useState(null);
  const [pendingLogos, setPendingLogos] = useState({});
  const [browserOpenKey, setBrowserOpenKey] = useState(null);
  const [activeModuleTab, setActiveModuleTab] = useState('leads');
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const DEFAULT_LAYOUT_ORDER = ['header', 'billTo', 'table', 'totals', 'notes', 'bank'];
  const [templateDraft, setTemplateDraft] = useState({ name: '', primaryColor: '#3b82f6', layout: 'modern', showLogo: true, footerText: 'Thank you for your business!', isDefault: false, layoutOrder: DEFAULT_LAYOUT_ORDER });
  const [tplDragIndex, setTplDragIndex] = useState(null);
  const [tplDragOverIndex, setTplDragOverIndex] = useState(null);
  const [fieldEditorOpen, setFieldEditorOpen] = useState(false);
  const [fieldEditorType, setFieldEditorType] = useState('statuses');
  const [fieldEditorData, setFieldEditorData] = useState({ index: -1, value: '' });
  const [fieldEditorValue, setFieldEditorValue] = useState('');
  const [fieldEditorColor, setFieldEditorColor] = useState('#3b82f6');
  const [fieldEditorState, setFieldEditorState] = useState('open');
  const presetColors = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#64748b','#06b6d4','#f97316'];
  const invoicePresetColors = ['#4361EE', '#7C3AED', '#0D9488', '#DC2626'];
  const [pendingWatermark, setPendingWatermark] = useState(null);
  const [watermarkBrowserOpen, setWatermarkBrowserOpen] = useState(false);
  const [uploadingWatermark, setUploadingWatermark] = useState(false);
  const [uploadingCompanyAsset, setUploadingCompanyAsset] = useState('');
  const [previewDoc, setPreviewDoc] = useState(null);
  const [companyBrowserKey, setCompanyBrowserKey] = useState(null);
  const [customCertModalOpen, setCustomCertModalOpen] = useState(false);
  const [customCertDraft, setCustomCertDraft] = useState({ type: 'custom', label: '', docNumber: '', file: null, url: '', name: '' });
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);

  const [followUpSettings, setFollowUpSettings] = useState({
    timezone: 'Asia/Kolkata',
    businessHours: { start: '09:30', end: '18:30' },
    protectionThresholds: {
      highValueLead: 250000,
      untouchedHours: 24,
      waitingHours: 48,
      maxReschedules: 3,
      dailyWorkloadWarning: 12,
      maxCriticalSnoozes: 1,
      renewalWindowDays: 90
    }
  });
  const [savingFollowUps, setSavingFollowUps] = useState(false);
  const [webhookTestDraft, setWebhookTestDraft] = useState({
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '9876543210',
    companyName: 'Acme Media',
    service: 'Website Design & Development',
    source: 'Website Contact Form',
    message: 'Interested in redesigning our agency website.'
  });
  const [webhookTestLoading, setWebhookTestLoading] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState(null);
  const [snippetTab, setSnippetTab] = useState('curl');

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const [settingsRes, followUpRes] = await Promise.allSettled([
          api.settings.get(token),
          api.followUps.getSettings(token)
        ]);

        if (!mounted) return;

        if (settingsRes.status === 'fulfilled' && settingsRes.value?.data) {
          const loadedSettings = mergeDeep(DEFAULT_SETTINGS, settingsRes.value.data || {});
          setSettings(loadedSettings);
          persistAndApplyThemeSettings(loadedSettings);
        }

        if (followUpRes.status === 'fulfilled' && followUpRes.value?.data) {
          const fData = followUpRes.value.data;
          setFollowUpSettings({
            timezone: fData.timezone || 'Asia/Kolkata',
            businessHours: fData.businessHours || { start: '09:30', end: '18:30' },
            protectionThresholds: {
              highValueLead: 250000,
              untouchedHours: 24,
              waitingHours: 48,
              maxReschedules: 3,
              dailyWorkloadWarning: 12,
              maxCriticalSnoozes: 1,
              renewalWindowDays: 90,
              ...(fData.protectionThresholds || {})
            }
          });
        }
      } catch (error) {
        if (!mounted) return;
        toast.error(error.message || 'Unable to load settings');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [token]);

  const updateFollowUpThreshold = (key, value) => {
    setFollowUpSettings((curr) => ({
      ...curr,
      protectionThresholds: {
        ...(curr.protectionThresholds || {}),
        [key]: Number(value)
      }
    }));
  };

  const saveFollowUpSettings = async () => {
    setSavingFollowUps(true);
    try {
      const response = await api.followUps.saveSettings(token, followUpSettings);
      toast.success('Follow-up SLA & Policy settings saved successfully');
      if (response?.data) setFollowUpSettings(response.data);
    } catch (error) {
      toast.error(error.message || 'Failed to save follow-up settings');
    } finally {
      setSavingFollowUps(false);
    }
  };

  useEffect(() => {
    if (settings.ui) {
      applyUiSettings(settings.ui);
    }
  }, [settings.ui]);

  const openTemplateModal = (template = null) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateDraft({
        ...template,
        layoutOrder: Array.isArray(template.layoutOrder) && template.layoutOrder.length ? template.layoutOrder : DEFAULT_LAYOUT_ORDER
      });
    } else {
      setEditingTemplate(null);
      setTemplateDraft({
        name: '',
        primaryColor: settings.branding?.primaryColor || '#3b82f6',
        layout: 'modern',
        showLogo: true,
        footerText: 'Thank you for your business!',
        isDefault: false,
        layoutOrder: DEFAULT_LAYOUT_ORDER
      });
    }
    setTemplateModalOpen(true);
  };

  const saveTemplate = async () => {
    const name = String(templateDraft.name || '').trim();
    if (!name) {
      toast.error('Template name is required');
      return;
    }

    const currentTemplates = Array.isArray(settings.invoiceTemplates) ? settings.invoiceTemplates : [];
    const templateId = editingTemplate?.id || `tpl-${Date.now()}`;
    const nextTemplate = {
      ...templateDraft,
      id: templateId,
      name,
      primaryColor: templateDraft.primaryColor || settings.branding?.primaryColor || '#3b82f6',
      layout: templateDraft.layout || 'modern',
      showLogo: Boolean(templateDraft.showLogo),
      footerText: String(templateDraft.footerText || '').trim(),
      isDefault: Boolean(templateDraft.isDefault),
      layoutOrder: Array.isArray(templateDraft.layoutOrder) && templateDraft.layoutOrder.length ? templateDraft.layoutOrder : DEFAULT_LAYOUT_ORDER
    };

    let updated = editingTemplate
      ? currentTemplates.map((template) => (template.id === templateId ? nextTemplate : template))
      : [...currentTemplates, nextTemplate];

    if (nextTemplate.isDefault) {
      updated = updated.map((template) => ({ ...template, isDefault: template.id === templateId }));
    } else if (!updated.some((template) => template.isDefault) && updated.length) {
      updated = updated.map((template, index) => ({ ...template, isDefault: index === 0 }));
    }

    setSettings((current) => ({ ...current, invoiceTemplates: updated }));
    try {
      await api.settings.save(token, { invoiceTemplates: updated });
      toast.success(editingTemplate ? 'Template updated' : 'Template created');
      setTemplateModalOpen(false);
      setEditingTemplate(null);
    } catch (error) {
      toast.error(error.message || 'Failed to save template');
    }
  };

  async function handleSaveSection(sectionKeys, successMessage) {
    setSaving(true);
    try {
      let finalLogos = { ...(settings.logos || {}) };
      if (sectionKeys.includes('logos') && Object.keys(pendingLogos).length > 0) {
        setUploadingLogo('all');
        for (const [key, data] of Object.entries(pendingLogos)) {
          if (data.driveUrl) { finalLogos[key] = data.driveUrl; continue; }
          if (data.file) {
            const formData = new FormData();
            formData.append('file', data.file);
            formData.append('moduleName', 'settings');
            formData.append('isPublic', 'true');
            const fileRes = await api.files.upload(token, formData);
            const uploadedFile = fileRes.data?.[0];
            if (uploadedFile?.id) {
              finalLogos[key] = getFileViewUrl(uploadedFile);
            }
          }
        }
        setPendingLogos({});
        setUploadingLogo(null);
      }
      const payload = {};
      sectionKeys.forEach(key => {
        if (key === 'logos') { payload.logos = finalLogos; }
        else { payload[key] = key in settings ? settings[key] : null; }
      });
      const saveRes = await api.settings.save(token, payload);
      const merged = mergeDeep(settings, saveRes.data || payload);
      setSettings(merged);
      persistAndApplyThemeSettings(merged);
      toast.success(successMessage || 'Settings saved successfully');
    } catch (error) {
      toast.error(error.message || 'Unable to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function saveCompanyAsset(nextCompany, successMessage) {
    const saveRes = await api.settings.save(token, { company: nextCompany });
    const merged = mergeDeep(settings, saveRes.data || { company: nextCompany });
    setSettings(merged);
    toast.success(successMessage);
  }

  async function uploadCompanyAsset(file, { kind, type = '', label = '', docNumber = '' }) {
    if (!file) return;
    const isSignature = kind === 'signature';
    if (isSignature && !String(file.type || '').startsWith('image/')) {
      toast.error('Signature must be an image file (PNG/JPG/SVG)');
      return;
    }
    const allowedCertificate = String(file.type || '').startsWith('image/') || file.type === 'application/pdf';
    if (!isSignature && !allowedCertificate) {
      toast.error('Certificate must be a PDF or image file');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error('File must be smaller than 15 MB');
      return;
    }

    const uploadKey = isSignature ? 'signature' : `certificate-${type}`;
    setUploadingCompanyAsset(uploadKey);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('moduleName', 'settings');
      formData.append('entityId', 'company-profile');
      formData.append('folderKey', isSignature ? 'company/signature' : 'company/certificates');
      formData.append('isPublic', 'true');
      const fileRes = await api.files.upload(token, formData);
      const uploaded = fileRes.data?.[0];
      const url = uploaded?.id ? getFileViewUrl(uploaded) : URL.createObjectURL(file);
      const currentCompany = settings.company || {};
      let nextCompany;

      if (isSignature) {
        nextCompany = {
          ...currentCompany,
          signatureUrl: url,
          signatureFileId: uploaded?.id || uploaded?.driveFileId || '',
          signatureFileName: file.name
        };
      } else {
        const existing = Array.isArray(currentCompany.certificates) ? currentCompany.certificates : [];
        const nextCertificate = {
          id: uploaded?.id || `certificate-${type}-${Date.now()}`,
          type,
          label: label || type,
          docNumber: docNumber || '',
          name: file.name,
          url,
          fileId: uploaded?.id || uploaded?.driveFileId || '',
          mimeType: file.type,
          uploadedAt: new Date().toISOString()
        };
        const isCustom = type.startsWith('custom_') || type === 'custom' || type === 'other';
        nextCompany = {
          ...currentCompany,
          certificates: [
            ...existing.filter((certificate) =>
              isCustom ? certificate.id !== nextCertificate.id : certificate.type !== type
            ),
            nextCertificate
          ]
        };
      }

      await saveCompanyAsset(nextCompany, isSignature ? 'Authorized signature uploaded' : `${label || 'Certificate'} uploaded`);
    } catch (error) {
      console.error('Company asset upload error:', error);
      toast.error(error.message || 'Company document upload failed');
    } finally {
      setUploadingCompanyAsset('');
    }
  }

  async function removeCompanyAsset({ kind, type = '', id = '' }) {
    setUploadingCompanyAsset(kind === 'signature' ? 'signature' : `certificate-${type || id}`);
    try {
      const currentCompany = settings.company || {};
      const nextCompany = kind === 'signature'
        ? { ...currentCompany, signatureUrl: '', signatureFileId: '', signatureFileName: '' }
        : {
            ...currentCompany,
            certificates: (currentCompany.certificates || []).filter(
              (certificate) => {
                if (id && certificate.id === id) return false;
                if (type && certificate.type === type && !certificate.type.startsWith('custom_') && certificate.type !== 'custom') return false;
                return true;
              }
            )
          };
      await saveCompanyAsset(nextCompany, kind === 'signature' ? 'Signature removed' : 'Certificate removed');
    } catch (error) {
      toast.error(error.message || 'Unable to remove company document');
    } finally {
      setUploadingCompanyAsset('');
    }
  }

  async function handleCompanyFileBrowserSelect(file) {
    if (!file) return;
    const url = getFileViewUrl(file);
    const currentCompany = settings.company || {};

    if (companyBrowserKey === 'signature') {
      const nextCompany = {
        ...currentCompany,
        signatureUrl: url,
        signatureFileId: file.id || file.driveFileId || '',
        signatureFileName: file.name || file.originalName || 'signature.png'
      };
      await saveCompanyAsset(nextCompany, 'Authorized signature attached from Drive');
    } else if (companyBrowserKey?.startsWith('cert-')) {
      const type = companyBrowserKey.replace('cert-', '');
      const certTypeObj = COMPANY_CERTIFICATE_TYPES.find((c) => c.type === type) || { label: type };
      const existing = Array.isArray(currentCompany.certificates) ? currentCompany.certificates : [];
      const isCustom = type.startsWith('custom_') || type === 'custom' || type === 'other';
      const nextCert = {
        id: file.id || `certificate-${type}-${Date.now()}`,
        type,
        label: certTypeObj.label,
        docNumber: certTypeObj.defaultNumber || '',
        name: file.name || file.originalName || `${type}-certificate`,
        url,
        fileId: file.id || file.driveFileId || '',
        mimeType: file.mimeType || 'application/pdf',
        uploadedAt: new Date().toISOString()
      };
      const nextCompany = {
        ...currentCompany,
        certificates: [...existing.filter((c) => isCustom ? c.id !== nextCert.id : c.type !== type), nextCert]
      };
      await saveCompanyAsset(nextCompany, `${certTypeObj.label} attached from Drive`);
    }
    setCompanyBrowserKey(null);
  }


  const tabs = [
    { id: 'company', label: 'Company Profile', icon: Building2 },
    { id: 'branding', label: 'Branding', icon: Image },
    { id: 'ui', label: 'UI Settings', icon: Palette },
    { id: 'email', label: 'SMTP & Email', icon: Mail },
    { id: 'invoice', label: 'Invoices', icon: FileText },
    { id: 'taxes', label: 'Taxes & Compliance', icon: Calculator },
    { id: 'custom_fields', label: 'Custom Fields', icon: ListTodo },
    { id: 'followups', label: 'Follow-ups & SLA', icon: Clock3 },
    { id: 'integrations', label: 'Webhooks & API', icon: Globe },
    { id: 'storage', label: 'Storage & Backup', icon: HardDrive },
  ];

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your system configurations.</p>
      </div>
      <div className="flex flex-col md:flex-row gap-8 items-start">
        <Card className="w-full md:w-64 shrink-0 flex flex-col gap-1 p-3 sticky top-24 shadow-sm h-fit">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ borderRadius: 'var(--radius-button, 0.5rem)' }}
                className={cn("flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all text-left cursor-pointer group", isActive ? "bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--primary)]" : "text-slate-600 hover:bg-[color-mix(in_srgb,var(--primary)_5%,transparent)] hover:text-[var(--primary)]")}>
                <Icon size={18} strokeWidth={isActive ? 2 : 1.5} />
                {tab.label}
              </button>
            );
          })}
        </Card>
        <div className="flex-1 min-w-0 space-y-6">
          {activeTab === 'company' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              {/* Card 1: Business Identity & Legal Information */}
              <Card className="space-y-4 p-6">
                <div className="mb-6 border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Building2 size={20} className="text-slate-800" />
                      <h3 className="text-lg font-semibold text-slate-800">Business Identity & Legal Details</h3>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">Official corporate, tax, and registration information of Webitof.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 size={13} className="text-emerald-600" /> OPC Private Limited
                    </span>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Brand / Trading Name</label>
                    <Input
                      value={settings.company?.name || ''}
                      onChange={(e) => updateSection(setSettings, 'company', 'name', e.target.value)}
                      placeholder="Webitof"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Legal Registered Name</label>
                    <Input
                      value={settings.company?.legalName || ''}
                      onChange={(e) => updateSection(setSettings, 'company', 'legalName', e.target.value)}
                      placeholder="WEBITOF WEB AGENCY (OPC) PRIVATE LIMITED"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Corporate Identification Number (CIN)
                    </label>
                    <div className="relative">
                      <Input
                        value={settings.company?.cin || ''}
                        onChange={(e) => updateSection(setSettings, 'company', 'cin', e.target.value)}
                        placeholder="U72900CT2022OPC013562"
                        className="font-mono uppercase pr-10"
                      />
                      {settings.company?.cin && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(settings.company.cin, 'CIN')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          title="Copy CIN"
                        >
                          <Copy size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">GSTIN</label>
                    <div className="relative">
                      <Input
                        value={settings.company?.gstin || ''}
                        onChange={(e) => updateSection(setSettings, 'company', 'gstin', e.target.value)}
                        placeholder="22AADCW3373Q1ZW"
                        className="font-mono uppercase pr-10"
                      />
                      {settings.company?.gstin && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(settings.company.gstin, 'GSTIN')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          title="Copy GSTIN"
                        >
                          <Copy size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Udyam Registration Number (MSME)
                    </label>
                    <div className="relative">
                      <Input
                        value={settings.company?.udyam || ''}
                        onChange={(e) => updateSection(setSettings, 'company', 'udyam', e.target.value)}
                        placeholder="UDYAM-CG-14-0034411"
                        className="font-mono uppercase pr-10"
                      />
                      {settings.company?.udyam && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(settings.company.udyam, 'Udyam Number')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          title="Copy Udyam Number"
                        >
                          <Copy size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">PAN (Permanent Account Number)</label>
                    <div className="relative">
                      <Input
                        value={settings.company?.pan || ''}
                        onChange={(e) => updateSection(setSettings, 'company', 'pan', e.target.value)}
                        placeholder="AADCW3373Q"
                        className="font-mono uppercase pr-10"
                      />
                      {settings.company?.pan && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(settings.company.pan, 'PAN')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          title="Copy PAN"
                        >
                          <Copy size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">TAN (Tax Deduction Account Number)</label>
                    <div className="relative">
                      <Input
                        value={settings.company?.tan || ''}
                        onChange={(e) => updateSection(setSettings, 'company', 'tan', e.target.value)}
                        placeholder="JBPW00418F"
                        className="font-mono uppercase pr-10"
                      />
                      {settings.company?.tan && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(settings.company.tan, 'TAN')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          title="Copy TAN"
                        >
                          <Copy size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Official Email</label>
                    <Input
                      value={settings.company?.email || ''}
                      onChange={(e) => updateSection(setSettings, 'company', 'email', e.target.value)}
                      placeholder="contact@webitof.com"
                      type="email"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Primary Phone</label>
                    <Input
                      value={settings.company?.phone || ''}
                      onChange={(e) => updateSection(setSettings, 'company', 'phone', e.target.value)}
                      placeholder="+91 9174786123"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Alternate Phone / WhatsApp</label>
                    <Input
                      value={settings.company?.alternatePhone || ''}
                      onChange={(e) => updateSection(setSettings, 'company', 'alternatePhone', e.target.value)}
                      placeholder="+91 9183456123"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Website</label>
                    <Input
                      value={settings.company?.website || ''}
                      onChange={(e) => updateSection(setSettings, 'company', 'website', e.target.value)}
                      placeholder="https://webitof.com"
                    />
                  </div>
                </div>
              </Card>

              {/* Card 2: Registered & Corporate Office Addresses */}
              <Card className="space-y-4 p-6">
                <div className="mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-2">
                    <Building2 size={20} className="text-slate-800 dark:text-slate-100" />
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Office Addresses</h3>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Official registered office and commercial headquarters addresses.</p>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                        Registered Office Address (as per RoC records)
                      </label>
                      <span className="text-xs text-slate-400">Statutory / MCA address</span>
                    </div>
                    <Textarea
                      rows={2}
                      value={settings.company?.registeredOffice || ''}
                      onChange={(e) => updateSection(setSettings, 'company', 'registeredOffice', e.target.value)}
                      placeholder="182, Ward No. 5, Bhathapara, Saloni Seoni, Raipur, Chhattisgarh 493661, India"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                        Corporate / Operational Headquarters Address
                      </label>
                      <span className="text-xs text-slate-400">Commercial office address for invoices</span>
                    </div>
                    <Textarea
                      rows={2}
                      value={settings.company?.address || ''}
                      onChange={(e) => updateSection(setSettings, 'company', 'address', e.target.value)}
                      placeholder="Unit No. 3033, 3rd Floor, Currency Tower, VIP Rd, Vishal Nagar, Raipur, Chhattisgarh 492001, India"
                    />
                  </div>

                  {/* State — SearchableSelect */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">State</label>
                    <SearchableSelect
                      value={settings.company?.state || ''}
                      onChange={(val) => {
                        const code = getStateCode(val);
                        updateSection(setSettings, 'company', 'state', val);
                        if (code) updateSection(setSettings, 'company', 'stateCode', code);
                      }}
                      options={INDIA_STATE_OPTIONS}
                      placeholder="Select State"
                    />
                  </div>

                  {/* City — Filtered by State */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">City</label>
                    <SearchableSelect
                      value={settings.company?.city || ''}
                      onChange={(val) => updateSection(setSettings, 'company', 'city', val)}
                      options={getCitiesByState(settings.company?.state || '').map(c => ({ value: c, label: c }))}
                      placeholder={settings.company?.state ? `Cities in ${settings.company.state}` : 'Select state first'}
                    />
                  </div>

                  {/* State Code, Pincode, Country — Symmetrical 3-Column Grid */}
                  <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">State Code</label>
                      <Input
                        value={settings.company?.stateCode || ''}
                        onChange={(e) => updateSection(setSettings, 'company', 'stateCode', e.target.value)}
                        placeholder="22"
                        className="font-mono uppercase"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Pincode</label>
                      <Input
                        value={settings.company?.pincode || ''}
                        onChange={(e) => updateSection(setSettings, 'company', 'pincode', e.target.value)}
                        placeholder="492001"
                        className="font-mono"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Country</label>
                      <Input
                        value={settings.company?.country || ''}
                        onChange={(e) => updateSection(setSettings, 'company', 'country', e.target.value)}
                        placeholder="India"
                      />
                    </div>
                  </div>
                </div>
              </Card>

              {/* Card 3: Authorized Signature & Seal */}
              <Card className="space-y-4 p-6">
                <div className="mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-2">
                    <PenTool size={20} className="text-slate-800 dark:text-slate-100" />
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Authorized Signature & Signatory</h3>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Signature image and authorized signatory details applied to invoices, quotation PDFs, and receipts.
                  </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2 items-start">
                  {/* Signature Preview & Actions */}
                  <div className="flex flex-col gap-3">
                    <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">Signature Image</label>
                    <div className="relative border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col items-center justify-center min-h-[160px] text-center overflow-hidden">
                      {settings.company?.signatureUrl ? (
                        <div className="flex flex-col items-center gap-2">
                          <img
                            src={settings.company.signatureUrl}
                            alt="Authorized Signature"
                            className="max-h-24 max-w-full object-contain"
                          />
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate max-w-[200px]">
                            {settings.company.signatureFileName || 'signature.png'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-slate-400 dark:text-slate-500 p-2">
                          <PenTool size={36} className="mb-2 opacity-40 text-slate-600 dark:text-slate-400" />
                          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No signature image uploaded</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">PNG with transparent background recommended</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="file"
                        id="signature-file-upload"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadCompanyAsset(file, { kind: 'signature' });
                          e.target.value = '';
                        }}
                      />
                      <label
                        htmlFor="signature-file-upload"
                        className={cn(
                          "inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm cursor-pointer transition-colors",
                          uploadingCompanyAsset === 'signature' && "opacity-50 pointer-events-none"
                        )}
                      >
                        {uploadingCompanyAsset === 'signature' ? (
                          <><div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" /> Uploading...</>
                        ) : (
                          <><Upload size={15} /> Upload Signature</>
                        )}
                      </label>

                      <Button
                        variant="outline"
                        type="button"
                        onClick={() => setCompanyBrowserKey('signature')}
                        className="text-sm"
                      >
                        <Image size={15} className="mr-1.5" /> Browse CRM Files
                      </Button>

                      {settings.company?.signatureUrl && (
                        <Button
                          variant="ghost"
                          type="button"
                          onClick={() => removeCompanyAsset({ kind: 'signature' })}
                          className="text-sm text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 size={15} className="mr-1.5" /> Remove
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Signatory Info & Invoice Stamp Preview */}
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Authorized Signatory Name</label>
                      <Input
                        value={settings.company?.signatoryName || ''}
                        onChange={(e) => updateSection(setSettings, 'company', 'signatoryName', e.target.value)}
                        placeholder="Hitesh Kumar Kurre"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Signatory Designation</label>
                      <Input
                        value={settings.company?.signatoryDesignation || ''}
                        onChange={(e) => updateSection(setSettings, 'company', 'signatoryDesignation', e.target.value)}
                        placeholder="Director & Managing Director"
                      />
                    </div>

                    {/* Invoice Footer Preview Box */}
                    <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 shadow-xs text-xs space-y-1">
                      <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Invoice Stamp & Signature Preview
                      </div>
                      <div className="text-slate-700 dark:text-slate-200 font-semibold">
                        For {settings.company?.legalName || 'WEBITOF WEB AGENCY (OPC) PRIVATE LIMITED'}
                      </div>
                      <div className="h-12 flex items-center">
                        {settings.company?.signatureUrl ? (
                          <img
                            src={settings.company.signatureUrl}
                            alt="Signature preview"
                            className="max-h-12 object-contain"
                          />
                        ) : (
                          <span className="italic text-slate-400 dark:text-slate-500 text-xs">[ Signature Image ]</span>
                        )}
                      </div>
                      <div className="font-medium text-slate-800 dark:text-slate-100">
                        {settings.company?.signatoryName || 'Hitesh Kumar Kurre'}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">
                        {settings.company?.signatoryDesignation || 'Authorized Signatory'}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Card 4: Statutory Certificates & Corporate Documents */}
              <Card className="space-y-4 p-6">
                <div className="mb-6 border-b border-slate-100 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileCheck2 size={20} className="text-slate-800 dark:text-slate-100" />
                      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Company Certificates & Statutory Documents</h3>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Upload and manage all statutory registration certificates (COI, MSME Udyam, GST, PAN, TAN, ISO).
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCustomCertDraft({ type: 'custom', label: '', docNumber: '', file: null, url: '', name: '' });
                      setCustomCertModalOpen(true);
                    }}
                    className="shrink-0"
                  >
                    <Plus size={15} className="mr-1.5" /> Upload New Certificate
                  </Button>
                </div>

                {/* Certificates Grid */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {COMPANY_CERTIFICATE_TYPES.map((certType) => {
                    const attached = (settings.company?.certificates || []).find((c) => c.type === certType.type);
                    const isUploading = uploadingCompanyAsset === `certificate-${certType.type}`;

                    return (
                      <div
                        key={certType.type}
                        className={cn(
                          "flex flex-col p-4 rounded-xl border transition-all",
                          attached
                            ? "border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-xs"
                            : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-900/60"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                              attached ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                            )}>
                              <FileText size={16} />
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight">
                                {attached?.label || certType.label}
                              </h4>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">{certType.desc}</p>
                            </div>
                          </div>
                          {attached ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full shrink-0">
                              <Check size={11} strokeWidth={2.5} /> Attached
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full shrink-0">
                              Pending
                            </span>
                          )}
                        </div>

                        {/* Doc Number / ID */}
                        <div className="my-2 p-2 rounded bg-white/80 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 text-xs">
                          <span className="text-slate-400 dark:text-slate-500 text-[10px] block uppercase font-medium">Ref / Registration No.</span>
                          <span className="font-mono font-medium text-slate-700 dark:text-slate-200 select-all">
                            {attached?.docNumber || certType.defaultNumber || '—'}
                          </span>
                        </div>

                        {/* File preview / Action Row */}
                        <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                          {attached ? (
                            <div className="flex items-center gap-1.5 w-full">
                              <Button
                                size="sm"
                                variant="outline"
                                type="button"
                                onClick={() => setPreviewDoc(attached)}
                                className="flex-1 text-xs h-8"
                              >
                                <Eye size={13} className="mr-1" /> View
                              </Button>
                              <a
                                href={attached.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                download={attached.name || 'document.pdf'}
                                className="inline-flex items-center justify-center h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                title="Open / Download"
                              >
                                <ExternalLink size={13} />
                              </a>
                              <input
                                type="file"
                                id={`replace-${certType.type}`}
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) uploadCompanyAsset(file, { kind: 'certificate', type: certType.type, label: certType.label, docNumber: certType.defaultNumber });
                                  e.target.value = '';
                                }}
                              />
                              <label
                                htmlFor={`replace-${certType.type}`}
                                className="inline-flex items-center justify-center h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                title="Replace File"
                              >
                                <Upload size={13} />
                              </label>
                              <button
                                type="button"
                                onClick={() => removeCompanyAsset({ kind: 'certificate', type: certType.type })}
                                className="inline-flex items-center justify-center h-8 px-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                title="Remove"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 w-full">
                              <input
                                type="file"
                                id={`upload-${certType.type}`}
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) uploadCompanyAsset(file, { kind: 'certificate', type: certType.type, label: certType.label, docNumber: certType.defaultNumber });
                                  e.target.value = '';
                                }}
                              />
                              <label
                                htmlFor={`upload-${certType.type}`}
                                className={cn(
                                  "flex-1 inline-flex items-center justify-center gap-1 h-8 px-3 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer",
                                  isUploading && "opacity-50 pointer-events-none"
                                )}
                              >
                                {isUploading ? (
                                  <><div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" /> Uploading</>
                                ) : (
                                  <><Upload size={13} /> Upload File</>
                                )}
                              </label>
                              <button
                                type="button"
                                onClick={() => setCompanyBrowserKey(`cert-${certType.type}`)}
                                className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium"
                                title="Select from CRM Drive"
                              >
                                Drive
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Additional / Custom Attached Certificates (if any) */}
                {(() => {
                  const customCerts = (settings.company?.certificates || []).filter(
                    (c) => !COMPANY_CERTIFICATE_TYPES.some((ct) => ct.type === c.type)
                  );
                  if (!customCerts.length) return null;

                  return (
                    <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                        Additional Uploaded Certificates ({customCerts.length})
                      </h4>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {customCerts.map((cert) => (
                          <div
                            key={cert.id || cert.url}
                            className="flex flex-col p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-xs"
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                                  <FileText size={16} />
                                </div>
                                <div>
                                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight">{cert.label}</h4>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[170px]">{cert.name}</p>
                                </div>
                              </div>
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full shrink-0">
                                <Check size={11} strokeWidth={2.5} /> Attached
                              </span>
                            </div>
                            {cert.docNumber && (
                              <div className="my-2 p-2 rounded bg-white/80 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 text-xs">
                                <span className="text-slate-400 dark:text-slate-500 text-[10px] block uppercase font-medium">Ref / Registration No.</span>
                                <span className="font-mono text-slate-700 dark:text-slate-200 select-all">{cert.docNumber}</span>
                              </div>
                            )}
                            <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                type="button"
                                onClick={() => setPreviewDoc(cert)}
                                className="flex-1 text-xs h-8"
                              >
                                <Eye size={13} className="mr-1" /> View
                              </Button>
                              <a
                                href={cert.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                download={cert.name || 'certificate.pdf'}
                                className="inline-flex items-center justify-center h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                title="Open / Download"
                              >
                                <ExternalLink size={13} />
                              </a>
                              <button
                                type="button"
                                onClick={() => removeCompanyAsset({ kind: 'certificate', id: cert.id, type: cert.type })}
                                className="inline-flex items-center justify-center h-8 px-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                title="Remove"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </Card>

              {/* Save Button Bar */}
              <div className="flex justify-end pt-2">
                <Button onClick={() => handleSaveSection(['company'], 'Company details saved successfully')} disabled={saving}>
                  {saving ? (
                    <><div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white/20 border-t-white" /> Saving...</>
                  ) : (
                    <><Save size={16} className="mr-2" /> Save Company Details</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'branding' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <Card className="space-y-4 p-6">
                <div className="mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-2">
                    <Image size={20} className="text-slate-800 dark:text-slate-100" />
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Logos & Assets</h3>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Company branding images used across invoices, sidebar, and app headers.</p>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  {[
                    ['primary', 'Primary Logo (Light Mode)', '1000×250px (Default: horizontal-logo.png)'],
                    ['primaryDark', 'Primary Logo (Dark Mode)', '1000×250px (Default: horizontal-white-logo.png)'],
                    ['sidebar', 'Sidebar Expanded (Light Mode)', '1000×250px (Default: horizontal-logo.png)'],
                    ['sidebarDark', 'Sidebar Expanded (Dark Mode)', '1000×250px (Default: horizontal-white-logo.png)'],
                    ['sidebarCollapsed', 'Sidebar Collapsed (Light Mode)', '250×250px (Default: round-logo.png)'],
                    ['sidebarCollapsedDark', 'Sidebar Collapsed (Dark Mode)', '250×250px (Default: webitof-icon-white.png)'],
                    ['quotation', 'Quotation / Proposal Logo', 'Commercial Proposals & SOW (Default: main-logo.png)'],
                    ['favicon', 'Favicon', '64×64px (Default: round-logo.png)'],
                    ['loginLight', 'Login Screen Logo (Light Mode)', 'Icon / Logo (Default: webitof-icon.png)'],
                    ['loginDark', 'Login Screen Logo (Dark Mode)', 'Icon / Logo (Default: webitof-icon-white.png)']
                  ].map(([key, label, desc]) => (
                    <div 
                      key={key} 
                      className="flex flex-col p-4 border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors"
                      style={{ borderRadius: 'var(--radius-card, 0.75rem)' }}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <label className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</label>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">{desc}</span>
                      </div>

                      <div className="flex flex-col gap-3 mt-auto">
                        {/* Preview Box */}
                        <div 
                          className={cn(
                            "flex h-32 items-center justify-center border border-slate-200 dark:border-slate-800 p-4 shadow-sm overflow-hidden",
                            ['primaryDark', 'sidebarDark', 'sidebarCollapsedDark', 'loginDark'].includes(key)
                              ? "bg-slate-950 border-slate-800"
                              : "bg-white dark:bg-slate-900/80"
                          )}
                          style={{ borderRadius: 'calc(var(--radius-card, 0.75rem) - 4px)' }}
                        >
                          {(pendingLogos[key] || settings.logos?.[key]) ? (
                            <img
                              src={pendingLogos[key]?.previewUrl || (() => {
                                let url = settings.logos[key];
                                if (url && url.includes('drive.google.com')) {
                                  const match = url.match(/[?&]id=([^&]+)/);
                                  if (match) return `${API_BASE_URL}/files/drive/${match[1]}/view`;
                                }
                                return url;
                              })()}
                              alt="preview"
                              className="max-h-full max-w-full object-contain"
                            />
                          ) : (
                            <div className="flex flex-col items-center text-slate-400 dark:text-slate-500">
                              <Image size={32} className="mb-2 opacity-50" />
                              <span className="text-xs font-medium">No image uploaded</span>
                            </div>
                          )}
                        </div>

                        {/* Input Row */}
                        <div className="flex items-center gap-2">
                          <div 
                            className="flex-1 flex items-center h-9 px-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-600 dark:text-slate-300 overflow-hidden shadow-sm"
                            style={{ borderRadius: 'var(--radius-input, 0.5rem)' }}
                          >
                            <span className="truncate">
                              {pendingLogos[key] ? (pendingLogos[key].name || 'logo.png') : (settings.logos?.[key] ? 'uploaded_logo.png' : 'Choose file...')}
                            </span>
                          </div>

                          <input
                            type="file"
                            id={`logo-upload-${key}`}
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setPendingLogos((prev) => ({
                                  ...prev,
                                  [key]: {
                                    file,
                                    previewUrl: URL.createObjectURL(file),
                                    name: file.name
                                  }
                                }));
                              }
                              e.target.value = '';
                            }}
                          />
                          <label
                            htmlFor={`logo-upload-${key}`}
                            className="inline-flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 h-9 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm cursor-pointer shrink-0"
                            style={{ borderRadius: 'var(--radius-button, 0.5rem)' }}
                            title="Upload from computer"
                          >
                            <Upload size={13} className="mr-1" />
                            Upload
                          </label>

                          <button
                            type="button"
                            disabled={uploadingLogo !== null}
                            onClick={() => setBrowserOpenKey(key)}
                            className="inline-flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 h-9 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50 shrink-0 cursor-pointer"
                            style={{ borderRadius: 'var(--radius-button, 0.5rem)' }}
                            title="Browse from CRM Drive"
                          >
                            <Image size={13} className="mr-1" />
                            Drive
                          </button>

                          {(pendingLogos[key] || settings.logos?.[key]) && (
                            <button
                              type="button"
                              onClick={() => {
                                if (pendingLogos[key]) {
                                  setPendingLogos((prev) => {
                                    const next = { ...prev };
                                    delete next[key];
                                    return next;
                                  });
                                } else {
                                  updateSection(setSettings, 'logos', key, '');
                                }
                              }}
                              className="inline-flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 h-9 w-9 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shadow-sm shrink-0 cursor-pointer"
                              style={{ borderRadius: 'var(--radius-button, 0.5rem)' }}
                              title="Remove logo"
                            >
                              <X size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="flex justify-end pt-2">
                <Button onClick={() => handleSaveSection(['logos', 'branding'], 'Branding settings saved')} disabled={saving || uploadingLogo !== null}>
                  {saving || uploadingLogo !== null ? (
                    <><div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white/20 border-t-white" /> Saving...</>
                  ) : (
                    <><Save size={16} className="mr-2" /> Save Branding</>
                  )}
                </Button>
              </div>

              <FileBrowserModal
                open={browserOpenKey !== null}
                onClose={() => setBrowserOpenKey(null)}
                uploadModule="settings"
                uploadEntityId="logos"
                onSelect={(file) => {
                  if (browserOpenKey && getFileViewUrl(file)) {
                    const url = getFileViewUrl(file);
                    setPendingLogos(prev => ({
                      ...prev,
                      [browserOpenKey]: {
                        file: null,
                        previewUrl: url,
                        driveUrl: url,
                        name: file.originalName || file.name
                      }
                    }));
                  }
                  setBrowserOpenKey(null);
                }}
              />
            </div>
          )}

          {activeTab === 'ui' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <Card className="space-y-4 p-6">
                <div className="mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-2">
                    <AppWindow size={20} className="text-slate-800 dark:text-slate-100" />
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Browser & Document Title</h3>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Customize the application title displayed in the browser tab.</p>
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Title Text</label>
                  <Input
                    placeholder="CRM"
                    value={settings.ui?.titleText || 'CRM'}
                    onChange={(e) => {
                      updateSection(setSettings, 'ui', 'titleText', e.target.value);
                      document.title = `Settings - ${e.target.value || 'CRM'}`;
                    }}
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">This changes the text in the top browser tab (e.g., Settings - Your Title).</p>
                </div>
              </Card>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="space-y-4 p-6 lg:col-span-2">
                  <div className="mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div className="flex items-center gap-2">
                      <Palette size={20} className="text-[var(--text-main)]" />
                      <h3 className="text-lg font-semibold text-[var(--text-main)]">Theme & Appearance</h3>
                    </div>
                    <p className="text-sm text-[var(--text-muted)] mt-1">Interface mode and primary brand colors.</p>
                  </div>

                  <div className="space-y-6">
                    {/* Theme Mode Selector */}
                    <div>
                      <label className="text-sm font-medium text-[var(--text-main)] block mb-2">Theme Mode</label>
                      <ThemeSwitcher showPresets={false} />
                    </div>

                    <div className="flex flex-col gap-3 pt-2 border-t border-[var(--border)]">
                      <label className="text-sm font-medium text-[var(--text-main)]">Primary Brand Color</label>
                      <div className="flex items-center gap-4">
                        {['#4361ee', '#3b82f6', '#8b5cf6', '#f43f5e', '#10b981', '#f59e0b', '#06b6d4'].map((color) => {
                          const isActive =
                            (settings.branding?.primaryColor || '#4361ee').toLowerCase() ===
                            color.toLowerCase();
                          return (
                            <button
                              key={color}
                              type="button"
                              className={cn(
                                'relative flex items-center justify-center h-10 w-10 rounded-full shadow-sm border border-black/10 transition-all hover:scale-110 cursor-pointer',
                                isActive
                                  ? 'scale-110 ring-2 ring-offset-2 ring-[var(--primary)]'
                                  : 'hover:ring-2 hover:ring-offset-2 hover:ring-slate-300 dark:hover:ring-slate-600'
                              )}
                              style={{ backgroundColor: color }}
                              onClick={() => {
                                updateSection(setSettings, 'branding', 'primaryColor', color);
                                applyTheme(color);
                              }}
                            >
                              {isActive && <Check size={18} className="text-white drop-shadow-md" />}
                            </button>
                          );
                        })}

                        <div className="w-px h-8 bg-[var(--border)] mx-1"></div>

                        <div className="relative h-10 w-10 rounded-full shadow-sm border border-black/10 overflow-hidden hover:scale-110 transition-all hover:ring-2 hover:ring-offset-2 hover:ring-slate-300 dark:hover:ring-slate-600 group cursor-pointer">
                          <input
                            type="color"
                            className="absolute inset-[-50%] w-[200%] h-[200%] cursor-pointer p-0 m-0 border-0"
                            value={settings.branding?.primaryColor || '#4361ee'}
                            onChange={(event) => {
                              updateSection(setSettings, 'branding', 'primaryColor', event.target.value);
                              applyTheme(event.target.value);
                            }}
                            title="Custom Color"
                          />
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 rounded-full">
                            <Palette size={16} className="text-white drop-shadow-md" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="space-y-4 p-6 lg:col-span-1">
                  <div className="mb-6 border-b border-slate-100 dark:border-slate-800 pb-4 flex items-center gap-2">
                    <Palette size={20} className="text-slate-800 dark:text-slate-100" />
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Live Preview</h3>
                  </div>

                  <div
                    className="border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-900 flex flex-col mt-4 transition-all duration-300"
                    style={{ borderRadius: settings.ui?.cardRadius || '1.5rem' }}
                  >
                    {/* Mock Header */}
                    <div className="h-10 border-b border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/80 flex items-center justify-between px-4">
                      <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Dashboard</div>
                      <div className="flex gap-2">
                        <div className="w-4 h-4 bg-slate-200 dark:bg-slate-700" style={{ borderRadius: `calc(${settings.ui?.buttonRadius || '0.5rem'} * 0.4)` }}></div>
                        <div className="w-4 h-4 bg-slate-200 dark:bg-slate-700" style={{ borderRadius: `calc(${settings.ui?.buttonRadius || '0.5rem'} * 0.4)` }}></div>
                      </div>
                    </div>

                    <div className="flex h-48">
                      {/* Mock Sidebar */}
                      <div className="w-24 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 flex flex-col gap-3">
                        <div className="text-[10px] font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-0.5">
                          <span style={{ color: settings.branding?.primaryColor || '#4361ee' }}>CR</span>M
                        </div>
                        <div className="h-2.5 w-full transition-all duration-300" style={{ backgroundColor: settings.branding?.primaryColor || '#4361ee', borderRadius: `calc(${settings.ui?.buttonRadius || '0.5rem'} * 0.25)` }}></div>
                        <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-700 transition-all duration-300" style={{ borderRadius: `calc(${settings.ui?.buttonRadius || '0.5rem'} * 0.25)` }}></div>
                        <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-700 transition-all duration-300" style={{ borderRadius: `calc(${settings.ui?.buttonRadius || '0.5rem'} * 0.25)` }}></div>
                        <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-700 transition-all duration-300" style={{ borderRadius: `calc(${settings.ui?.buttonRadius || '0.5rem'} * 0.25)` }}></div>
                        <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-700 transition-all duration-300" style={{ borderRadius: `calc(${settings.ui?.buttonRadius || '0.5rem'} * 0.25)` }}></div>
                      </div>

                      {/* Mock Content */}
                      <div className="flex-1 bg-slate-50/50 dark:bg-slate-900/50 p-4 flex flex-col gap-3">
                        {/* Mock Input */}
                        <div className="h-6 w-3/4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 px-2 transition-all duration-300" style={{ borderRadius: `calc(${settings.ui?.inputRadius || '0.75rem'} * 0.6)` }}>
                          <div className="w-2.5 h-2.5 rounded-full border-2 border-slate-300 dark:border-slate-600 relative after:content-[''] after:absolute after:w-1 after:h-0.5 after:bg-slate-300 dark:after:bg-slate-600 after:bottom-[-2px] after:right-[-3px] after:rotate-45"></div>
                          <div className="h-1.5 w-12 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                        </div>
                        <div className="h-2.5 rounded-full w-1/2 bg-slate-200 dark:bg-slate-700 mb-1"></div>

                        {/* Mock Buttons */}
                        <div className="flex gap-2 mb-1">
                          <div className="h-6 w-12 transition-all duration-300" style={{ backgroundColor: `color-mix(in srgb, ${settings.branding?.primaryColor || '#4361ee'} 20%, transparent)`, borderRadius: `calc(${settings.ui?.buttonRadius || '0.5rem'} * 0.6)` }}></div>
                          <div className="h-6 w-12 bg-slate-200 dark:bg-slate-700 transition-all duration-300" style={{ borderRadius: `calc(${settings.ui?.buttonRadius || '0.5rem'} * 0.6)` }}></div>
                          <div className="h-6 w-12 bg-slate-200 dark:bg-slate-700 transition-all duration-300" style={{ borderRadius: `calc(${settings.ui?.buttonRadius || '0.5rem'} * 0.6)` }}></div>
                        </div>

                        {/* Mock Inner Card */}
                        <div className="flex-1 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-2 flex flex-col gap-2 transition-all duration-300" style={{ borderRadius: `calc(${settings.ui?.cardRadius || '1.5rem'} * 0.4)` }}>
                          <div className="h-2 rounded-full w-full bg-slate-100 dark:bg-slate-700 mt-1"></div>
                          <div className="h-2 rounded-full w-5/6 bg-slate-100 dark:bg-slate-700"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              <Card className="space-y-4 p-6">
                <div className="mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-2">
                    <Box size={20} className="text-slate-800 dark:text-slate-100" />
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">UI Elements</h3>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Adjust the border radius of components.</p>
                </div>
                <div className="grid gap-8 md:grid-cols-3">
                  {[
                    ['inputRadius', 'Input Radius', '0.75rem'],
                    ['buttonRadius', 'Button Radius', '0.5rem'],
                    ['cardRadius', 'Card Radius', '1.5rem']
                  ].map(([key, label, def]) => (
                    <div key={key} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</label>
                        <span className="text-xs font-mono font-medium text-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] px-2 py-0.5 rounded-full">
                          {settings.ui?.[key] || def}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="3"
                        step="0.125"
                        className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[var(--primary)] hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                        value={parseFloat((settings.ui?.[key] || def).replace('rem', '')) || 0}
                        onChange={(event) => updateSection(setSettings, 'ui', key, `${event.target.value}rem`)}
                      />
                    </div>
                  ))}
                </div>
              </Card>

              <div className="flex justify-end pt-2">
                <Button onClick={() => handleSaveSection(['branding', 'ui'], 'UI settings saved')} disabled={saving}>
                  {saving ? (
                    <><div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white/20 border-t-white" /> Saving...</>
                  ) : (
                    <><Save size={16} className="mr-2" /> Save UI Settings</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'email' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <Card className="space-y-4 p-6">
                <div className="mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-2">
                    <Mail size={20} className="text-slate-800 dark:text-slate-100" />
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">SMTP Server</h3>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Configuration for sending emails.</p>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  {[
                    ['host', 'Host', 'smtp.gmail.com'],
                    ['port', 'Port', '587'],
                    ['username', 'Username', 'user@example.com'],
                    ['password', 'Password', '••••••••••••'],
                    ['fromName', 'From Name', 'Webitof'],
                    ['fromEmail', 'From Email', 'contact@webitof.com']
                  ].map(([key, label, ph]) => (
                    <div key={key}>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</label>
                      {key === 'password' ? (
                        <div className="relative">
                          <Input
                            type={showSmtpPassword ? 'text' : 'password'}
                            value={settings.smtp?.[key] || ''}
                            onChange={(event) => updateSection(setSettings, 'smtp', key, event.target.value)}
                            placeholder={ph}
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSmtpPassword((prev) => !prev)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                            title={showSmtpPassword ? 'Hide password' : 'Show password'}
                          >
                            {showSmtpPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      ) : (
                        <Input
                          type="text"
                          value={settings.smtp?.[key] || ''}
                          onChange={(event) => updateSection(setSettings, 'smtp', key, event.target.value)}
                          placeholder={ph}
                        />
                      )}
                    </div>
                  ))}
                  <div className="md:col-span-2 mt-2">
                    <label className="inline-flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded text-[var(--primary)] focus:ring-[var(--primary)]"
                        checked={Boolean(settings.smtp?.secure)}
                        onChange={(event) => updateSection(setSettings, 'smtp', 'secure', event.target.checked)}
                      />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Use secure transport (TLS/SSL)</span>
                    </label>
                  </div>
                </div>
              </Card>

              <Card className="space-y-4 p-6">
                <div className="mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-2">
                    <FileText size={20} className="text-slate-800 dark:text-slate-100" />
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Automated messages</h3>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Default templates for outgoing emails.</p>
                </div>
                <div className="space-y-5">
                  {[
                    ['invoice', 'Invoice Template'],
                    ['paymentReminder', 'Payment Reminder'],
                    ['passwordReset', 'Password Reset OTP']
                  ].map(([key, label]) => (
                    <div key={key}>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</label>
                      <Textarea rows={4} value={settings.emailTemplates?.[key] || ''} onChange={(event) => updateSection(setSettings, 'emailTemplates', key, event.target.value)} />
                    </div>
                  ))}
                </div>
              </Card>

              <div className="flex justify-end pt-2">
                <Button onClick={() => handleSaveSection(['smtp', 'emailTemplates'], 'SMTP & Email settings saved')} disabled={saving}>
                  {saving ? (
                    <><div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white/20 border-t-white" /> Saving...</>
                  ) : (
                    <><Save size={16} className="mr-2" /> Save Email Settings</>
                  )}
                </Button>
              </div>
            </div>
          )}

                    {activeTab === 'invoice' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <Card className="space-y-4 p-6">
                <div className="mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-2">
                    <FileText size={20} className="text-slate-800 dark:text-slate-100" />
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Invoice defaults</h3>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Configure formatting and default terms for invoices.</p>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  {[
                    ['prefix', 'Prefix'],
                    ['nextSequence', 'Next Sequence', 'number'],
                    ['financialYear', 'Financial Year'],
                    ['defaultDueDays', 'Default Due Days', 'number'],
                    ['signatureName', 'Signature Name']
                  ].map(([key, label, type]) => (
                    <div key={key}>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
                      <Input
                        type={type || 'text'}
                        value={settings.invoice?.[key] ?? ''}
                        onChange={(event) => updateSection(setSettings, 'invoice', key, type === 'number' ? Number(event.target.value) : event.target.value)}
                      />
                    </div>
                  ))}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Invoice Number Format</label>
                    <select
                      className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200 focus:border-[var(--primary)] focus:outline-none"
                      value={String(settings.invoice?.numberFormat || 'month_year') === 'financial_year' ? 'financial_year' : 'month_year'}
                      onChange={(event) => updateSection(setSettings, 'invoice', 'numberFormat', event.target.value)}
                    >
                      <option value="month_year">Prefix + Month-Year + Sequence</option>
                      <option value="financial_year">Prefix + Financial Year + Sequence</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Terms & Conditions</label>
                    <Textarea rows={4} value={settings.invoice?.terms || ''} onChange={(event) => updateSection(setSettings, 'invoice', 'terms', event.target.value)} />
                  </div>
                </div>
              </Card>

              {/* Invoice Theme Color */}
              <Card className="space-y-4 p-6">
                <div className="mb-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-2">
                    <Palette size={20} className="text-slate-800 dark:text-slate-100" />
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Invoice Theme Color</h3>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">This color controls the header, table header, and accents of your invoices.</p>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  {invoicePresetColors.map(color => {
                    const isActive = (settings.invoiceTheme?.primaryColor || '#4361EE').toLowerCase() === color.toLowerCase();
                    return (
                      <button
                        key={color}
                        type="button"
                        className={cn(
                          "relative flex items-center justify-center h-10 w-10 rounded-full shadow-sm border border-black/10 transition-all hover:scale-110",
                          isActive ? "scale-110 ring-2 ring-offset-2 ring-slate-400 dark:ring-slate-500" : "hover:ring-2 hover:ring-offset-2 hover:ring-slate-300 dark:hover:ring-slate-600"
                        )}
                        style={{ backgroundColor: color, '--tw-ring-color': color }}
                        onClick={() => updateSection(setSettings, 'invoiceTheme', 'primaryColor', color)}
                      >
                        {isActive && <Check size={18} className="text-white drop-shadow-md" />}
                      </button>
                    );
                  })}
                  <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-1" />
                  <div className="relative h-10 w-10 rounded-full shadow-sm border border-black/10 overflow-hidden hover:scale-110 transition-all hover:ring-2 hover:ring-offset-2 hover:ring-slate-300 dark:hover:ring-slate-600 group" title="Custom Color">
                    <input
                      type="color"
                      className="absolute inset-[-50%] w-[200%] h-[200%] cursor-pointer p-0 m-0 border-0"
                      value={settings.invoiceTheme?.primaryColor || '#4361EE'}
                      onChange={(e) => updateSection(setSettings, 'invoiceTheme', 'primaryColor', e.target.value)}
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-full">
                      <Palette size={15} className="text-white" />
                    </div>
                  </div>
                  <div className="ml-4 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg border border-black/10 shadow-sm" style={{ backgroundColor: settings.invoiceTheme?.primaryColor || '#4361EE' }} />
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{settings.invoiceTheme?.primaryColor || '#4361EE'}</span>
                  </div>
                </div>
              </Card>

              {/* Watermark Image */}
              <Card className="space-y-4 p-6">
                <div className="mb-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-2">
                    <Image size={20} className="text-slate-800 dark:text-slate-100" />
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Invoice Watermark</h3>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">This watermark will appear behind the content of every invoice (preview, print, public page).</p>
                </div>
                <div className="flex flex-col gap-4">
                  {(pendingWatermark?.previewUrl || settings.invoiceTheme?.watermarkUrl) && (
                    <div className="relative inline-block">
                      <img
                        src={pendingWatermark?.previewUrl || settings.invoiceTheme?.watermarkUrl}
                        alt="Watermark Preview"
                        className="h-24 w-auto object-contain rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-2"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (pendingWatermark) { setPendingWatermark(null); }
                          else { updateSection(setSettings, 'invoiceTheme', 'watermarkUrl', ''); }
                        }}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-[var(--radius-button,0.5rem)] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <Upload size={15} className="text-slate-500 dark:text-slate-400" />
                      Upload Image
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => setPendingWatermark({ file, previewUrl: ev.target.result });
                          reader.readAsDataURL(file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-[var(--radius-button,0.5rem)] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => setWatermarkBrowserOpen(true)}
                    >
                      <Image size={15} className="text-slate-500 dark:text-slate-400" />
                      Browse Files
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Recommended: PNG with transparency (opacity ~10–15%). Max size: 2MB.</p>
                </div>
              </Card>

              <div className="flex justify-end pt-2">
                <Button onClick={async () => {
                  if (pendingWatermark?.file) {
                    setUploadingWatermark(true);
                    try {
                      const formData = new FormData();
                      formData.append('file', pendingWatermark.file);
                      formData.append('moduleName', 'settings');
                      formData.append('isPublic', 'true');
                      const fileRes = await api.files.upload(token, formData);
                      const uploaded = fileRes.data?.[0];
                      if (uploaded?.id) {
                        const url = getFileViewUrl(uploaded);
                        updateSection(setSettings, 'invoiceTheme', 'watermarkUrl', url);
                        setPendingWatermark(null);
                      }
                    } catch(err) {
                      toast.error('Failed to upload watermark');
                    } finally {
                      setUploadingWatermark(false);
                    }
                  } else if (pendingWatermark?.driveUrl) {
                    updateSection(setSettings, 'invoiceTheme', 'watermarkUrl', pendingWatermark.driveUrl);
                    setPendingWatermark(null);
                  }
                  await handleSaveSection(['invoice', 'invoiceTheme'], 'Invoice settings saved');
                }} disabled={saving || uploadingWatermark}>
                  {saving || uploadingWatermark ? (
                    <><div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white/20 border-t-white" /> Saving...</>
                  ) : (
                    <><Save size={16} className="mr-2" /> Save Invoice Settings</>
                  )}
                </Button>
              </div>

              {/* Invoice Templates */}
              <Card className="space-y-4 p-6">
                <div className="mb-4 border-b border-slate-100 dark:border-slate-800 pb-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Receipt size={20} className="text-slate-800 dark:text-slate-100" />
                      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Invoice Templates</h3>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Create and manage reusable invoice templates with branding.</p>
                  </div>
                  <Button size="sm" onClick={() => openTemplateModal()}>
                    <Plus size={14} className="mr-1" /> New Template
                  </Button>
                </div>
                {(Array.isArray(settings.invoiceTemplates) ? settings.invoiceTemplates : []).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-400 dark:text-slate-500">
                    No templates yet. Create your first invoice template!
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {(settings.invoiceTemplates || []).map((tpl) => (
                      <div key={tpl.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-4 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-lg shrink-0 flex items-center justify-center text-white font-bold text-base shadow-xs" style={{ backgroundColor: tpl.primaryColor || '#3b82f6' }}>
                            {(tpl.name || 'T').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">{tpl.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{tpl.layout || 'modern'} layout{tpl.isDefault ? ' · Default' : ''}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {!tpl.isDefault && (
                            <button
                              type="button"
                              onClick={async () => {
                                const updated = (settings.invoiceTemplates || []).map(t => ({ ...t, isDefault: t.id === tpl.id }));
                                const next = { ...settings, invoiceTemplates: updated };
                                setSettings(next);
                                await handleSaveSection(['invoiceTemplates'], 'Default template set');
                              }}
                              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                            >
                              Set Default
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openTemplateModal(tpl)}
                            className="p-1.5 rounded text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                            title="Edit template"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!window.confirm(`Delete template "${tpl.name}"?`)) return;
                              const updated = (settings.invoiceTemplates || []).filter(t => t.id !== tpl.id);
                              setSettings(s => ({ ...s, invoiceTemplates: updated }));
                              await api.settings.save(token, { invoiceTemplates: updated });
                              toast.success('Template deleted');
                            }}
                            className="p-1.5 rounded text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                            title="Delete template"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

            </div>
          )}

          {activeTab === 'invoice' && watermarkBrowserOpen && (
            <FileBrowserModal
              open={watermarkBrowserOpen}
              onClose={() => setWatermarkBrowserOpen(false)}
              onSelect={(file) => {
                if (getFileViewUrl(file)) {
                  const url = getFileViewUrl(file);
                  setPendingWatermark({ file: null, previewUrl: url, driveUrl: url });
                }
                setWatermarkBrowserOpen(false);
              }}
            />
          )}

          {activeTab === 'custom_fields' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <Card className="space-y-4 p-6">
                <div className="mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-2">
                    <ListTodo size={20} className="text-slate-800 dark:text-slate-100" />
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Custom Fields Builder</h3>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage pipeline statuses, acquisition sources, and custom lifecycle fields.</p>
                </div>
                
                <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800 mb-6">
                  {[
                    { id: 'leads', label: 'Lead Fields' },
                    { id: 'clients', label: 'Client Fields' },
                    { id: 'projects', label: 'Project Fields' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveModuleTab(tab.id)}
                      className={cn(
                        "pb-3 text-sm font-medium transition-colors relative cursor-pointer",
                        activeModuleTab === tab.id 
                          ? "text-[var(--primary)]" 
                          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                      )}
                    >
                      {tab.label}
                      {activeModuleTab === tab.id && (
                        <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[var(--primary)] rounded-t-full" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Statuses Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Statuses</h4>
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => {
                          setFieldEditorType('statuses');
                          setFieldEditorData({ index: -1, value: '' });
                          setFieldEditorValue('');
                          setFieldEditorColor(presetColors[0]);
                          setFieldEditorState('open');
                          setFieldEditorOpen(true);
                        }}
                      >
                        <Plus size={14} className="mr-1.5" /> Add Status
                      </Button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {(settings.statuses?.[activeModuleTab] || []).map((statusItem, index) => {
                        const statusObj = typeof statusItem === 'string' ? { label: statusItem, color: '#64748b' } : statusItem;
                        return (
                          <div key={index} className="flex items-center justify-between px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors group" style={{ borderRadius: 'var(--radius-input, 0.75rem)' }}>
                            <div className="flex items-center gap-2.5">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: statusObj.color }} />
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{statusObj.label}</span>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                className="p-1.5 text-slate-400 hover:text-[var(--primary)] rounded-md hover:bg-white dark:hover:bg-slate-800 focus:outline-none cursor-pointer"
                                onClick={() => {
                                  setFieldEditorType('statuses');
                                  setFieldEditorData({ index, value: statusObj.label });
                                  setFieldEditorValue(statusObj.label);
                                  setFieldEditorColor(statusObj.color);
                                  setFieldEditorState(statusObj.state || 'open');
                                  setFieldEditorOpen(true);
                                }}
                                title="Edit Status"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                className="p-1.5 text-slate-400 hover:text-red-500 rounded-md hover:bg-white dark:hover:bg-slate-800 focus:outline-none cursor-pointer"
                                onClick={async () => {
                                  const newArr = (settings.statuses?.[activeModuleTab] || []).filter((_, i) => i !== index);
                                  updateSection(setSettings, 'statuses', activeModuleTab, newArr);
                                  try {
                                    await api.settings.save(token, { statuses: { ...settings.statuses, [activeModuleTab]: newArr } });
                                    toast.success('Status deleted');
                                  } catch (e) {
                                    toast.error('Failed to delete status');
                                  }
                                }}
                                title="Delete Status"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {!(settings.statuses?.[activeModuleTab] || []).length && (
                        <div className="px-4 py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20" style={{ borderRadius: 'var(--radius-input, 0.75rem)' }}>
                          <p className="text-sm text-slate-500 dark:text-slate-400">No custom statuses added yet.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sources Section for Leads OR Guidance Card for Clients/Projects */}
                  {activeModuleTab === 'leads' ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Sources</h4>
                        <Button 
                          size="sm" 
                          variant="secondary"
                          onClick={() => {
                            setFieldEditorType('sources');
                            setFieldEditorData({ index: -1, value: '' });
                            setFieldEditorValue('');
                            setFieldEditorOpen(true);
                          }}
                        >
                          <Plus size={14} className="mr-1.5" /> Add Source
                        </Button>
                      </div>
                      <div className="flex flex-col gap-2">
                        {(settings.sources?.[activeModuleTab] || []).map((source, index) => (
                          <div key={index} className="flex items-center justify-between px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors group" style={{ borderRadius: 'var(--radius-input, 0.75rem)' }}>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{source}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                className="p-1.5 text-slate-400 hover:text-[var(--primary)] rounded-md hover:bg-white dark:hover:bg-slate-800 focus:outline-none cursor-pointer"
                                onClick={() => {
                                  setFieldEditorType('sources');
                                  setFieldEditorData({ index, value: source });
                                  setFieldEditorValue(source);
                                  setFieldEditorOpen(true);
                                }}
                                title="Edit Source"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                className="p-1.5 text-slate-400 hover:text-red-500 rounded-md hover:bg-white dark:hover:bg-slate-800 focus:outline-none cursor-pointer"
                                onClick={async () => {
                                  const newArr = (settings.sources?.[activeModuleTab] || []).filter((_, i) => i !== index);
                                  updateSection(setSettings, 'sources', activeModuleTab, newArr);
                                  try {
                                    await api.settings.save(token, { sources: { ...settings.sources, [activeModuleTab]: newArr } });
                                    toast.success('Source deleted');
                                  } catch (e) {
                                    toast.error('Failed to delete source');
                                  }
                                }}
                                title="Delete Source"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                        {!(settings.sources?.[activeModuleTab] || []).length && (
                          <div className="px-4 py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20" style={{ borderRadius: 'var(--radius-input, 0.75rem)' }}>
                            <p className="text-sm text-slate-500 dark:text-slate-400">No custom sources added yet.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                          {activeModuleTab === 'clients' ? 'Client Pipeline Guide' : 'Project Workflow Guide'}
                        </h4>
                      </div>
                      <div className="p-4 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-950/20 text-xs text-blue-900 dark:text-blue-300 space-y-2">
                        <p className="font-semibold text-blue-950 dark:text-blue-200">
                          {activeModuleTab === 'clients' ? 'Client Account Lifecycle' : 'Project Stage Pipeline'}
                        </p>
                        <p className="leading-relaxed">
                          {activeModuleTab === 'clients' 
                            ? 'Statuses categorize clients through onboarding, active servicing, retention, or churn. You can define custom statuses on the left to match your company account management process.'
                            : 'Project stages track deliverables from requirements and development through QA and launch. Reorder or add milestones to align with your project delivery cycle.'}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="md:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Shared labels</h4>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          Labels are managed from the table headers and shared across leads, clients, tasks, notes, and reminders.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              <div className="flex justify-end pt-2">
                <Button onClick={() => handleSaveSection(['statuses', 'sources'], 'Custom fields saved')} disabled={saving}>
                  {saving ? (
                    <><div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white/20 border-t-white" /> Saving...</>
                  ) : (
                    <><Save size={16} className="mr-2" /> Save Custom Fields</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'taxes' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">

              {/* Master GST Switches */}
              <Card className="space-y-4 p-6">
                <div className="mb-4 border-b border-slate-100 dark:border-slate-800 pb-4 flex items-center gap-2">
                  <Receipt size={20} className="text-slate-800 dark:text-slate-100" />
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">GST Configuration</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Control how GST is applied across invoices.</p>
                  </div>
                </div>
                <div className="flex flex-col gap-4">
                  {[
                    { key: 'gstRegistered', label: 'Company is GST Registered', desc: 'Enable GST on all invoices.' },
                    { key: 'autoDetectTax', label: 'Smart Tax Engine (Auto CGST/SGST vs IGST)', desc: 'Automatically apply CGST+SGST for local clients and IGST for inter-state/export based on state codes.' },
                    { key: 'lutEnabled', label: 'LUT Export Enabled', desc: 'Apply zero-rated GST for international/overseas clients under Letter of Undertaking.' },
                    { key: 'enableCess', label: 'Enable GST Cess', desc: 'Apply Cess on top of GST for applicable goods/services.' },
                  ].map(({ key, label, desc }) => (
                    <label key={key} className="flex items-start gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                      <input
                        type="checkbox"
                        checked={!!(settings.gst?.[key])}
                        onChange={(e) => updateSection(setSettings, 'gst', key, e.target.checked)}
                        className="mt-1 w-4 h-4 rounded text-[var(--primary)] border-slate-300 dark:border-slate-700"
                      />
                      <div>
                        <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{label}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </Card>

              {/* Tax Rate Defaults */}
              <Card className="space-y-4 p-6">
                <div className="mb-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Default Tax Rates</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">These are used when no rate is specified on a line item.</p>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Default GST Rate (%)</label>
                    <Input type="number" min={0} max={100}
                      value={settings.gst?.defaultRate ?? 18}
                      onChange={(e) => updateSection(setSettings, 'gst', 'defaultRate', Number(e.target.value))}
                      placeholder="18" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">CGST Rate (%)</label>
                    <Input type="number" min={0} max={50}
                      value={settings.gst?.cgstRate ?? 9}
                      onChange={(e) => updateSection(setSettings, 'gst', 'cgstRate', Number(e.target.value))}
                      placeholder="9" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">SGST Rate (%)</label>
                    <Input type="number" min={0} max={50}
                      value={settings.gst?.sgstRate ?? 9}
                      onChange={(e) => updateSection(setSettings, 'gst', 'sgstRate', Number(e.target.value))}
                      placeholder="9" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">IGST Rate (%)</label>
                    <Input type="number" min={0} max={100}
                      value={settings.gst?.igstRate ?? 18}
                      onChange={(e) => updateSection(setSettings, 'gst', 'igstRate', Number(e.target.value))}
                      placeholder="18" />
                  </div>
                  <div className="md:col-span-1 lg:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Default Export Treatment</label>
                    <Input
                      value={settings.gst?.defaultExportTreatment || ''}
                      onChange={(e) => updateSection(setSettings, 'gst', 'defaultExportTreatment', e.target.value)}
                      placeholder="Export without payment of IGST under LUT" />
                  </div>
                </div>
              </Card>

              {/* TDS Settings */}
              <Card className="space-y-4 p-6">
                <div className="mb-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">TDS Configuration</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Tax Deducted at Source settings for payments received from clients.</p>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Default TDS Section</label>
                    <Input
                      value={settings.tds?.commissionSection || '194H'}
                      onChange={(e) => updateSection(setSettings, 'tds', 'commissionSection', e.target.value)}
                      placeholder="194H" />
                    <p className="text-xs text-slate-400 mt-1">e.g. 194H (Commission), 194J (Professional)</p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">TDS Rate (%)</label>
                    <Input type="number" min={0} max={100}
                      value={settings.tds?.commissionRate ?? 2}
                      onChange={(e) => updateSection(setSettings, 'tds', 'commissionRate', Number(e.target.value))}
                      placeholder="2" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">TDS Threshold (₹)</label>
                    <Input type="number" min={0}
                      value={settings.tds?.commissionThreshold ?? 15000}
                      onChange={(e) => updateSection(setSettings, 'tds', 'commissionThreshold', Number(e.target.value))}
                      placeholder="15000" />
                    <p className="text-xs text-slate-400 mt-1">TDS applies only above this limit</p>
                  </div>
                </div>
              </Card>

              <div className="flex justify-end pt-2">
                <Button onClick={() => handleSaveSection(['gst', 'tds'], 'Tax settings saved')} disabled={saving}>
                  {saving ? (
                    <><div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white/20 border-t-white" /> Saving...</>
                  ) : (
                    <><Save size={16} className="mr-2" /> Save Tax Settings</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'followups' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              {/* Top Action Card */}
              <Card className="p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--primary)] shrink-0">
                      <Clock3 size={22} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">
                        Follow-up Engine & SLA Policy Settings
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Control business calendar, operating hours, risk thresholds and automated protection policies.
                      </p>
                    </div>
                  </div>

                  <Button onClick={saveFollowUpSettings} disabled={savingFollowUps} className="shrink-0 self-end sm:self-center">
                    {savingFollowUps ? (
                      <><div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white/20 border-t-white" /> Saving...</>
                    ) : (
                      <><Save size={16} className="mr-2" /> Save Settings</>
                    )}
                  </Button>
                </div>
              </Card>

              <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                {/* Left Column: Protection Thresholds */}
                <Card className="p-6 space-y-5">
                  <div className="border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <ShieldAlert size={18} className="text-rose-500" />
                      <h3 className="text-base font-bold text-slate-800">Risk & SLA Protection Thresholds</h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      These values configure how the CRM detects neglected leads, high-value deals at risk, and overdue bottlenecks.
                    </p>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        High-Value Deal Threshold (₹)
                      </label>
                      <Input
                        type="number"
                        value={followUpSettings.protectionThresholds?.highValueLead ?? 250000}
                        onChange={(e) => updateFollowUpThreshold('highValueLead', e.target.value)}
                      />
                      <p className="text-xs text-slate-400 mt-1">Deals above this value trigger priority alerts.</p>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Untouched Lead SLA (Hours)
                      </label>
                      <Input
                        type="number"
                        value={followUpSettings.protectionThresholds?.untouchedHours ?? 24}
                        onChange={(e) => updateFollowUpThreshold('untouchedHours', e.target.value)}
                      />
                      <p className="text-xs text-slate-400 mt-1">Hours before a newly assigned lead is marked neglected.</p>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Waiting-for-Client Limit (Hours)
                      </label>
                      <Input
                        type="number"
                        value={followUpSettings.protectionThresholds?.waitingHours ?? 48}
                        onChange={(e) => updateFollowUpThreshold('waitingHours', e.target.value)}
                      />
                      <p className="text-xs text-slate-400 mt-1">Hours before client inaction triggers a re-engagement nudge.</p>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Max Allowable Reschedules
                      </label>
                      <Input
                        type="number"
                        value={followUpSettings.protectionThresholds?.maxReschedules ?? 3}
                        onChange={(e) => updateFollowUpThreshold('maxReschedules', e.target.value)}
                      />
                      <p className="text-xs text-slate-400 mt-1">Reschedule count before deal is flagged as stalling.</p>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Daily Workload Limit per Agent
                      </label>
                      <Input
                        type="number"
                        value={followUpSettings.protectionThresholds?.dailyWorkloadWarning ?? 12}
                        onChange={(e) => updateFollowUpThreshold('dailyWorkloadWarning', e.target.value)}
                      />
                      <p className="text-xs text-slate-400 mt-1">Daily follow-up limit before agent shows as overloaded.</p>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Renewal Window Notice (Days)
                      </label>
                      <Input
                        type="number"
                        value={followUpSettings.protectionThresholds?.renewalWindowDays ?? 90}
                        onChange={(e) => updateFollowUpThreshold('renewalWindowDays', e.target.value)}
                      />
                      <p className="text-xs text-slate-400 mt-1">Days in advance to generate upcoming contract renewals.</p>
                    </div>
                  </div>
                </Card>

                {/* Right Column: Operating Hours & Customer Safety */}
                <div className="space-y-6">
                  <Card className="p-6 space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <Clock3 size={18} className="text-blue-500" />
                        <h3 className="text-base font-bold text-slate-800">Operating Hours</h3>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Automated tasks respect local working hours.</p>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Time Zone</label>
                      <select
                        className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-[var(--primary)] focus:outline-none"
                        value={followUpSettings.timezone || 'Asia/Kolkata'}
                        onChange={(e) => setFollowUpSettings((curr) => ({ ...curr, timezone: e.target.value }))}
                      >
                        <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Shift Starts</label>
                        <Input
                          type="time"
                          value={followUpSettings.businessHours?.start || '09:30'}
                          onChange={(e) => setFollowUpSettings((curr) => ({
                            ...curr,
                            businessHours: { ...(curr.businessHours || {}), start: e.target.value }
                          }))}
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Shift Ends</label>
                        <Input
                          type="time"
                          value={followUpSettings.businessHours?.end || '18:30'}
                          onChange={(e) => setFollowUpSettings((curr) => ({
                            ...curr,
                            businessHours: { ...(curr.businessHours || {}), end: e.target.value }
                          }))}
                        />
                      </div>
                    </div>
                  </Card>

                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-sm space-y-1.5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                      <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-300">Customer Safety Policy</h4>
                    </div>
                    <p className="text-xs text-emerald-800 dark:text-emerald-400 leading-relaxed">
                      Automated messages are never sent outside working hours or to opted-out contacts without human verification.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'storage' && (
            <StorageSettingsPanel
              token={token}
              canWrite={hasPermission('settings.write')}
              oauthResult={oauthResult}
              onOauthResultShown={clearOauthResult}
            />
          )}

          {activeTab === 'integrations' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              {/* Endpoint Card */}
              <Card className="p-6 space-y-5">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                      <Globe size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Public Lead Capture Webhook</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Accept inbound leads directly from your WordPress site, Elementor forms, Webflow, or custom landing pages.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Public Webhook URL (POST)</label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={`${window.location.origin}/api/leads/webhook?key=webitof-crm-webhook-secret`}
                        className="font-mono text-xs bg-slate-50 dark:bg-slate-900/60 select-all"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => copyToClipboard(`${window.location.origin}/api/leads/webhook?key=webitof-crm-webhook-secret`, 'Webhook URL')}
                        className="shrink-0 cursor-pointer"
                      >
                        <Copy size={15} className="mr-1.5" /> Copy URL
                      </Button>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Send a JSON <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-blue-600 dark:text-blue-400 font-bold">POST</code> request with your form payload.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Webhook Secret API Key</label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value="webitof-crm-webhook-secret"
                        className="font-mono text-xs bg-slate-50 dark:bg-slate-900/60 select-all"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => copyToClipboard('webitof-crm-webhook-secret', 'API Key')}
                        className="shrink-0 cursor-pointer"
                      >
                        <Copy size={15} />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Authentication Headers</label>
                    <Input
                      readOnly
                      value="x-crm-webhook-key: webitof-crm-webhook-secret"
                      className="font-mono text-xs bg-slate-50 dark:bg-slate-900/60"
                    />
                  </div>
                </div>

                <div className="p-4 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/40 flex items-start gap-3">
                  <Zap size={18} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-900 dark:text-blue-200 space-y-1">
                    <p className="font-bold">Automated Lead Intelligence</p>
                    <p className="text-blue-800 dark:text-blue-300">
                      When a lead is submitted via webhook, the CRM automatically detects duplicates by phone/email, tags the lead with source tracking, and provisions the initial SLA follow-up task.
                    </p>
                  </div>
                </div>
              </Card>

              {/* Live Test Sandbox */}
              <Card className="p-6 space-y-5">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Send size={16} className="text-emerald-600 dark:text-emerald-400" />
                    Live Webhook Test Sandbox
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Test submitting an incoming lead to verify your webhook integration.</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">Full Name</label>
                    <Input
                      value={webhookTestDraft.name}
                      onChange={(e) => setWebhookTestDraft(curr => ({ ...curr, name: e.target.value }))}
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">Phone / Mobile</label>
                    <Input
                      value={webhookTestDraft.phone}
                      onChange={(e) => setWebhookTestDraft(curr => ({ ...curr, phone: e.target.value }))}
                      placeholder="9876543210"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">Email</label>
                    <Input
                      value={webhookTestDraft.email}
                      onChange={(e) => setWebhookTestDraft(curr => ({ ...curr, email: e.target.value }))}
                      placeholder="jane@example.com"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">Company Name</label>
                    <Input
                      value={webhookTestDraft.companyName}
                      onChange={(e) => setWebhookTestDraft(curr => ({ ...curr, companyName: e.target.value }))}
                      placeholder="Acme Media"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">Service Requested</label>
                    <Input
                      value={webhookTestDraft.service}
                      onChange={(e) => setWebhookTestDraft(curr => ({ ...curr, service: e.target.value }))}
                      placeholder="Web Development"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">Source Tag</label>
                    <Input
                      value={webhookTestDraft.source}
                      onChange={(e) => setWebhookTestDraft(curr => ({ ...curr, source: e.target.value }))}
                      placeholder="Website Contact Form"
                    />
                  </div>
                  <div className="sm:col-span-2 md:col-span-3">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">Inquiry / Message</label>
                    <Textarea
                      rows={2}
                      value={webhookTestDraft.message}
                      onChange={(e) => setWebhookTestDraft(curr => ({ ...curr, message: e.target.value }))}
                      placeholder="Requirement description..."
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button
                    type="button"
                    onClick={async () => {
                      if (!webhookTestDraft.name || !webhookTestDraft.phone) {
                        toast.error('Name and Phone are required');
                        return;
                      }
                      setWebhookTestLoading(true);
                      setWebhookTestResult(null);
                      try {
                        const res = await fetch('/api/leads/webhook?key=webitof-crm-webhook-secret', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(webhookTestDraft)
                        });
                        const data = await res.json();
                        setWebhookTestResult({ status: res.status, data });
                        if (data.success) {
                          toast.success(`Lead captured successfully! Lead ID: #${data.data?.leadId || ''}`);
                        } else {
                          toast.error(data.message || 'Webhook rejected');
                        }
                      } catch (err) {
                        setWebhookTestResult({ status: 500, data: { error: err.message } });
                        toast.error(err.message || 'Failed to send test webhook');
                      } finally {
                        setWebhookTestLoading(false);
                      }
                    }}
                    disabled={webhookTestLoading}
                    className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  >
                    <Send size={15} className="mr-1.5" />
                    {webhookTestLoading ? 'Sending...' : 'Send Test Lead via Webhook'}
                  </Button>
                </div>

                {webhookTestResult && (
                  <div className="mt-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900 dark:bg-slate-950 text-slate-100 space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between border-b border-slate-700 dark:border-slate-800 pb-2">
                      <span className="font-bold text-slate-300">Server Response</span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${webhookTestResult.status === 200 || webhookTestResult.status === 201 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        HTTP {webhookTestResult.status}
                      </span>
                    </div>
                    <pre className="overflow-x-auto text-[11px] leading-relaxed text-emerald-300">
                      {JSON.stringify(webhookTestResult.data, null, 2)}
                    </pre>
                  </div>
                )}
              </Card>

              {/* Code Snippets Card */}
              <Card className="p-6 space-y-4">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <Code2 size={16} className="text-blue-600 dark:text-blue-400" />
                      Integration Code Snippets
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Drop-in code for external websites and forms.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs">
                      {['curl', 'javascript', 'php'].map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setSnippetTab(tab)}
                          className={`px-2.5 py-1 rounded-md font-medium uppercase tracking-wider transition ${snippetTab === tab ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => {
                      let code = '';
                      if (snippetTab === 'curl') {
                        code = `curl -X POST "${window.location.origin}/api/leads/webhook?key=webitof-crm-webhook-secret" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "name": "Jane Smith",\n    "phone": "+91 98765 43210",\n    "email": "jane@example.com",\n    "companyName": "Acme Corp",\n    "service": "Web Development",\n    "source": "Website Contact Form",\n    "message": "Interested in redesigning our website.",\n    "budget": 50000\n  }'`;
                      } else if (snippetTab === 'javascript') {
                        code = `fetch('${window.location.origin}/api/leads/webhook?key=webitof-crm-webhook-secret', {\n  method: 'POST',\n  headers: {\n    'Content-Type': 'application/json'\n  },\n  body: JSON.stringify({\n    name: formData.name,\n    phone: formData.phone,\n    email: formData.email,\n    companyName: formData.company,\n    service: formData.service,\n    source: 'Website Form',\n    message: formData.message\n  })\n})\n.then(res => res.json())\n.then(data => console.log('Lead captured in CRM:', data));`;
                      } else {
                        code = `<?php\n$url = '${window.location.origin}/api/leads/webhook?key=webitof-crm-webhook-secret';\n$payload = json_encode([\n    'name'        => $_POST['name'],\n    'phone'       => $_POST['phone'],\n    'email'       => $_POST['email'],\n    'companyName' => $_POST['company'],\n    'service'     => $_POST['service'],\n    'source'      => 'WordPress Contact Form',\n    'message'     => $_POST['message']\n]);\n$ch = curl_init($url);\ncurl_setopt($ch, CURLOPT_POSTFIELDS, $payload);\ncurl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\n$result = curl_exec($ch);\ncurl_close($ch);\n?>`;
                      }
                      copyToClipboard(code, `${snippetTab.toUpperCase()} Snippet`);
                    }}
                    className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition shadow-sm opacity-80 group-hover:opacity-100 flex items-center gap-1 text-xs"
                    title="Copy code"
                  >
                    <Copy size={13} /> Copy
                  </button>
                  <pre className="p-4 bg-slate-900 dark:bg-slate-950 text-slate-100 rounded-xl overflow-x-auto text-xs font-mono leading-relaxed border border-slate-800">
                    {snippetTab === 'curl' && `curl -X POST "${window.location.origin}/api/leads/webhook?key=webitof-crm-webhook-secret" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Jane Smith",
    "phone": "+91 98765 43210",
    "email": "jane@example.com",
    "companyName": "Acme Corp",
    "service": "Web Development",
    "source": "Website Contact Form",
    "message": "Interested in redesigning our website.",
    "budget": 50000
  }'`}

                    {snippetTab === 'javascript' && `fetch('${window.location.origin}/api/leads/webhook?key=webitof-crm-webhook-secret', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: formData.name,
    phone: formData.phone,
    email: formData.email,
    companyName: formData.company,
    service: formData.service,
    source: 'Website Form',
    message: formData.message
  })
})
.then(res => res.json())
.then(data => console.log('Lead captured in CRM:', data));`}

                    {snippetTab === 'php' && `<?php
// WordPress / PHP Contact Form Integration
$url = '${window.location.origin}/api/leads/webhook?key=webitof-crm-webhook-secret';
$payload = json_encode([
    'name'        => $_POST['name'],
    'phone'       => $_POST['phone'],
    'email'       => $_POST['email'],
    'companyName' => $_POST['company'],
    'service'     => $_POST['service'],
    'source'      => 'WordPress Contact Form',
    'message'     => $_POST['message']
]);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$result = curl_exec($ch);
curl_close($ch);
?>`}
                  </pre>
                </div>
              </Card>
            </div>
          )}

        </div>
      </div>

      <Modal
        open={templateModalOpen}
        onClose={() => {
          setTemplateModalOpen(false);
          setEditingTemplate(null);
        }}
        title={editingTemplate ? 'Edit Invoice Template' : 'New Invoice Template'}
        subtitle="Create a reusable invoice look used by the builder, details page, and public invoice page."
        width="720px"
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setTemplateModalOpen(false); setEditingTemplate(null); }}>
              Cancel
            </Button>
            <Button onClick={saveTemplate}>
              <Save size={16} className="mr-2" /> Save Template
            </Button>
          </div>
        )}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Template Name</label>
            <Input
              value={templateDraft.name}
              onChange={(event) => setTemplateDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder="e.g. Minimal Blue"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Primary Color</label>
            <Input
              type="color"
              value={templateDraft.primaryColor || '#3b82f6'}
              onChange={(event) => setTemplateDraft((current) => ({ ...current, primaryColor: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Layout</label>
            <select
              className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200 focus:border-[var(--primary)] focus:outline-none"
              value={templateDraft.layout || 'modern'}
              onChange={(event) => setTemplateDraft((current) => ({ ...current, layout: event.target.value }))}
            >
              <option value="modern">Modern</option>
              <option value="classic">Classic</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Footer Text</label>
            <Textarea
              rows={3}
              value={templateDraft.footerText || ''}
              onChange={(event) => setTemplateDraft((current) => ({ ...current, footerText: event.target.value }))}
              placeholder="Thank you for your business!"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={Boolean(templateDraft.showLogo)}
              onChange={(event) => setTemplateDraft((current) => ({ ...current, showLogo: event.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-[var(--primary)] focus:ring-[var(--primary)]"
            />
            Show company logo
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={Boolean(templateDraft.isDefault)}
              onChange={(event) => setTemplateDraft((current) => ({ ...current, isDefault: event.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-[var(--primary)] focus:ring-[var(--primary)]"
            />
            Set as default template
          </label>
        </div>
      </Modal>

      <Modal
        open={fieldEditorOpen}
        onClose={() => setFieldEditorOpen(false)}
        title={fieldEditorData.index >= 0 ? `Edit ${fieldEditorType === 'statuses' ? 'Status' : fieldEditorType === 'labels' ? 'Label' : 'Source'}` : `Add New ${fieldEditorType === 'statuses' ? 'Status' : fieldEditorType === 'labels' ? 'Label' : 'Source'}`}
        subtitle={`Enter the value for this ${fieldEditorType === 'statuses' ? 'status' : fieldEditorType === 'labels' ? 'label' : 'source'} option.`}
        width="400px"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setFieldEditorOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              if (!fieldEditorValue.trim()) {
                toast.error('Value cannot be empty');
                return;
              }
              const val = fieldEditorValue.trim();
              const section = fieldEditorType;
              const currentArr = [...(settings[section]?.[activeModuleTab] || [])];
              const isColoredField = section === 'statuses' || section === 'labels';
              const getItemLabel = (item) => {
                if (isColoredField) return normalizeBadgeItem(item).label;
                return typeof item === 'string' ? item : String(item ?? '');
              };
              
              if (fieldEditorData.index >= 0) {
                if (currentArr.some((item, idx) => getItemLabel(item).toLowerCase() === val.toLowerCase() && idx !== fieldEditorData.index)) {
                  toast.error('This value already exists');
                  return;
                }
                currentArr[fieldEditorData.index] = isColoredField ? { label: val, color: fieldEditorColor, ...(section === 'statuses' ? { state: fieldEditorState } : {}) } : val;
              } else {
                if (currentArr.some(item => getItemLabel(item).toLowerCase() === val.toLowerCase())) {
                  toast.error('This value already exists');
                  return;
                }
                currentArr.push(isColoredField ? { label: val, color: fieldEditorColor, ...(section === 'statuses' ? { state: fieldEditorState } : {}) } : val);
              }
              
              updateSection(setSettings, section, activeModuleTab, currentArr);
              setFieldEditorOpen(false);
              
              const typeName = section === 'statuses' ? 'Status' : section === 'labels' ? 'Label' : 'Source';
              try {
                await api.settings.save(token, { [section]: { ...settings[section], [activeModuleTab]: currentArr } });
                toast.success(`${typeName} saved successfully`);
              } catch (e) {
                toast.error(`Failed to save ${typeName}`);
              }
            }}>
              Save Option
            </Button>
          </div>
        }
      >
        <div className="py-2 space-y-5">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Value *</label>
            <Input 
              value={fieldEditorValue} 
              onChange={e => setFieldEditorValue(e.target.value)} 
              placeholder={`e.g. ${fieldEditorType === 'statuses' ? 'In Progress' : fieldEditorType === 'labels' ? 'Enterprise' : 'Website'}`}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                }
              }}
            />
          </div>

          {fieldEditorType === 'statuses' && (
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Pipeline State</label>
              <select
                className="w-full h-10 px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-all"
                style={{ borderRadius: 'var(--radius-input, 0.5rem)' }}
                value={fieldEditorState}
                onChange={e => setFieldEditorState(e.target.value)}
              >
                <option value="open">Open (Active Lead)</option>
                <option value="won">Won (Convert to Client)</option>
                <option value="lost">Lost (Failed Lead)</option>
              </select>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Leads dragged to a "Won" status will prompt for Client conversion.
              </p>
            </div>
          )}

          {fieldEditorType !== 'sources' && (
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Badge Color</label>
              <div className="flex flex-wrap gap-2">
                {presetColors.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFieldEditorColor(color)}
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center transition-all text-white",
                      fieldEditorColor === color ? "scale-110 shadow-md ring-2 ring-offset-2 ring-slate-400 dark:ring-slate-500" : "hover:scale-105 opacity-90 hover:opacity-100"
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                  >
                    {fieldEditorColor === color && <Check size={16} strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Company Document Preview Modal */}
      <Modal
        open={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc?.label || 'Certificate Preview'}
        width="min(960px, 95vw)"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-200">{previewDoc?.name || previewDoc?.label}</span>
              {previewDoc?.docNumber && (
                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-slate-600 dark:text-slate-300">
                  {previewDoc.docNumber}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {previewDoc?.url && (
                <a
                  href={previewDoc.url}
                  download={previewDoc.name || `${previewDoc.type || 'document'}.pdf`}
                  className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium"
                >
                  <Download size={13} /> Download
                </a>
              )}
              {previewDoc?.url && (
                <a
                  href={previewDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium"
                >
                  <ExternalLink size={13} /> Open in new window
                </a>
              )}
            </div>
          </div>
          <div className="flex justify-center items-center bg-slate-900/5 dark:bg-slate-950/40 rounded-xl p-3 min-h-[350px] max-h-[75vh] overflow-auto">
            {previewDoc?.url && (previewDoc.mimeType === 'application/pdf' || previewDoc.url.toLowerCase().endsWith('.pdf') || previewDoc.name?.toLowerCase().endsWith('.pdf')) ? (
              <iframe
                src={previewDoc.url}
                className="w-full h-[65vh] rounded-lg border border-slate-200 dark:border-slate-800 bg-white"
                title={previewDoc.label}
              />
            ) : previewDoc?.url ? (
              <img
                src={previewDoc.url}
                alt={previewDoc?.label || 'Certificate'}
                className="max-h-[65vh] max-w-full object-contain rounded-lg shadow-sm"
              />
            ) : (
              <div className="text-slate-400 dark:text-slate-500 text-sm">No preview available</div>
            )}
          </div>
        </div>
      </Modal>

      {/* Upload New Certificate Modal */}
      <Modal
        open={customCertModalOpen}
        onClose={() => setCustomCertModalOpen(false)}
        title="Upload Corporate Certificate"
        width="min(560px, 95vw)"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Certificate Type</label>
            <select
              value={customCertDraft.type}
              onChange={(e) => {
                const val = e.target.value;
                const found = COMPANY_CERTIFICATE_TYPES.find((c) => c.type === val);
                setCustomCertDraft((prev) => ({
                  ...prev,
                  type: val,
                  label: found?.label || (val === 'custom' ? '' : prev.label),
                  docNumber: found?.defaultNumber || prev.docNumber
                }));
              }}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <optgroup label="Statutory Document Slots">
                {COMPANY_CERTIFICATE_TYPES.map((ct) => (
                  <option key={ct.type} value={ct.type}>{ct.label}</option>
                ))}
              </optgroup>
              <optgroup label="Other Corporate Documents">
                <option value="custom">Other / Custom Certificate</option>
              </optgroup>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Certificate Title / Label</label>
            <Input
              value={customCertDraft.label}
              onChange={(e) => setCustomCertDraft((prev) => ({ ...prev, label: e.target.value }))}
              placeholder="e.g. GST Registration Certificate (REG-06)"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Registration / Reference Number</label>
            <Input
              value={customCertDraft.docNumber}
              onChange={(e) => setCustomCertDraft((prev) => ({ ...prev, docNumber: e.target.value }))}
              placeholder="e.g. 22AADCW3373Q1ZW"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Upload File (PDF / Image)</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setCustomCertDraft((prev) => ({ ...prev, file, name: file.name }));
                }
              }}
              className="w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 dark:file:bg-blue-900/40 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/60"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Or Paste Public Document URL</label>
            <Input
              value={customCertDraft.url}
              onChange={(e) => setCustomCertDraft((prev) => ({ ...prev, url: e.target.value }))}
              placeholder="https://example.com/certificate.pdf"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" type="button" onClick={() => setCustomCertModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={uploadingCompanyAsset !== '' || (!customCertDraft.file && !customCertDraft.url)}
              onClick={async () => {
                const isCustom = customCertDraft.type === 'custom' || customCertDraft.type.startsWith('custom_');
                if (customCertDraft.file) {
                  await uploadCompanyAsset(customCertDraft.file, {
                    kind: 'certificate',
                    type: isCustom ? `custom_${Date.now()}` : customCertDraft.type,
                    label: customCertDraft.label || (isCustom ? 'Custom Certificate' : customCertDraft.type),
                    docNumber: customCertDraft.docNumber
                  });
                } else if (customCertDraft.url) {
                  const currentCompany = settings.company || {};
                  const existing = Array.isArray(currentCompany.certificates) ? currentCompany.certificates : [];
                  const certId = isCustom ? `custom_${Date.now()}` : `cert-${customCertDraft.type}`;
                  const nextCert = {
                    id: certId,
                    type: isCustom ? certId : customCertDraft.type,
                    label: customCertDraft.label || (isCustom ? 'Custom Certificate' : customCertDraft.type),
                    docNumber: customCertDraft.docNumber || '',
                    name: customCertDraft.name || `${customCertDraft.label || 'certificate'}`,
                    url: customCertDraft.url,
                    uploadedAt: new Date().toISOString()
                  };
                  const nextCompany = {
                    ...currentCompany,
                    certificates: [...existing.filter((c) => isCustom ? c.id !== certId : c.type !== customCertDraft.type), nextCert]
                  };
                  await saveCompanyAsset(nextCompany, `${nextCert.label} attached`);
                }
                setCustomCertModalOpen(false);
              }}
            >
              {uploadingCompanyAsset ? 'Uploading...' : 'Save & Attach'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* FileBrowserModal for Company Assets */}
      <FileBrowserModal
        open={companyBrowserKey !== null}
        onClose={() => setCompanyBrowserKey(null)}
        onSelect={handleCompanyFileBrowserSelect}
        uploadModule="settings"
        uploadEntityId="company-profile"
      />

      <FileBrowserModal
        open={browserOpenKey !== null}
        onClose={() => setBrowserOpenKey(null)}
        onSelect={(file) => {
          if (browserOpenKey) {
            updateSection(setSettings, 'logos', browserOpenKey, getFileViewUrl(file));
            setBrowserOpenKey(null);
          }
        }}
        uploadModule="settings"
        uploadEntityId="logos"
      />
    </div>
  );
}
