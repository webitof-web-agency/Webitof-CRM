import { useEffect, useState } from 'react';
import { Save, RefreshCw, Building2, Palette, Mail, FileText, Shield, Image, Upload, Trash2, Check, AppWindow, Box, X, ListTodo, Plus, Calculator, Receipt, ToggleLeft } from 'lucide-react';
import { SearchableSelect } from '../components/forms/SearchableSelect';
import { INDIA_STATE_OPTIONS, getCitiesByState, getStateCode } from '../data/indiaLocations';
import { Modal } from '../components/ui/Modal';
import { toast } from 'sonner';
import { api, API_BASE_URL } from '../api/client';
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

export function SettingsPage() {
  const { token } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('company');
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

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const response = await api.settings.get(token);
        if (!mounted) return;
        const loadedSettings = mergeDeep(DEFAULT_SETTINGS, response.data || {});
        setSettings(loadedSettings);
        persistAndApplyThemeSettings(loadedSettings);
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
            if (uploadedFile && uploadedFile.driveFileId) {
              finalLogos[key] = `${API_BASE_URL}/files/drive/${uploadedFile.driveFileId}/view`;
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

  const tabs = [
    { id: 'company', label: 'Company Profile', icon: Building2 },
    { id: 'branding', label: 'Branding', icon: Image },
    { id: 'ui', label: 'UI Settings', icon: Palette },
    { id: 'email', label: 'SMTP & Email', icon: Mail },
    { id: 'invoice', label: 'Invoices', icon: FileText },
    { id: 'taxes', label: 'Taxes & Compliance', icon: Calculator },
    { id: 'custom_fields', label: 'Custom Fields', icon: ListTodo },
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
              <Card className="space-y-4 p-6">
                <div className="mb-6 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <Building2 size={20} className="text-slate-800" />
                    <h3 className="text-lg font-semibold text-slate-800">Business identity</h3>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">Your company details used across the system.</p>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  {[
                    ['name', 'Name'],
                    ['legalName', 'Legal Name'],
                    ['email', 'Email'],
                    ['phone', 'Phone'],
                    ['website', 'Website'],
                    ['gstin', 'GSTIN'],

                    ['pan', 'PAN']
                  ].map(([key, label]) => (
                    <div key={key}>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
                      <Input value={settings.company?.[key] || ''} onChange={(event) => updateSection(setSettings, 'company', key, event.target.value)} />
                    </div>
                  ))}

                  {/* State — SearchableSelect */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">State</label>
                    <SearchableSelect
                      value={settings.company?.state || ''}
                      onChange={(val) => {
                        const code = getStateCode(val);
                        updateSection(setSettings, 'company', 'state', val);
                        if (code) updateSection(setSettings, 'company', 'stateCode', code);
                      }}
                      options={INDIA_STATE_OPTIONS}
                      placeholder="Select State"
                      allowClear={false}
                    />
                  </div>

                  {/* City — Filtered by State */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">City</label>
                    <SearchableSelect
                      value={settings.company?.city || ''}
                      onChange={(val) => updateSection(setSettings, 'company', 'city', val)}
                      options={getCitiesByState(settings.company?.state || '').map(c => ({ value: c, label: c }))}
                      placeholder={settings.company?.state ? `Cities in ${settings.company.state}` : 'Select state first'}
                      allowClear={false}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">State Code</label>
                    <Input value={settings.company?.stateCode || ''} onChange={(e) => updateSection(setSettings, 'company', 'stateCode', e.target.value)} placeholder="Auto-filled" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Country</label>
                    <Input value={settings.company?.country || ''} onChange={(e) => updateSection(setSettings, 'company', 'country', e.target.value)} placeholder="India" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Pincode</label>
                    <Input value={settings.company?.pincode || ''} onChange={(e) => updateSection(setSettings, 'company', 'pincode', e.target.value)} />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Address</label>
                    <Textarea value={settings.company?.address || ''} onChange={(event) => updateSection(setSettings, 'company', 'address', event.target.value)} />
                  </div>
                </div>
              </Card>

              <div className="flex justify-end pt-2">
                <Button onClick={() => handleSaveSection(['company'], 'Company details saved')} disabled={saving}>
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
                <div className="mb-6 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <Image size={20} className="text-slate-800" />
                    <h3 className="text-lg font-semibold text-slate-800">Logos & Assets</h3>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">Company branding images.</p>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  {[
                    ['primary', 'Primary Logo', '1000×250px'],
                    ['sidebar', 'Sidebar Expanded', '1000×250px'],
                    ['sidebarCollapsed', 'Sidebar Collapsed', '250×250px'],
                    ['favicon', 'Favicon', '64×64px']
                  ].map(([key, label, desc]) => (
                    <div 
                      key={key} 
                      className="flex flex-col p-4 border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                      style={{ borderRadius: 'var(--radius-card, 0.75rem)' }}
                    >
                      <div className="mb-4">
                        <label className="block text-sm font-semibold text-slate-800">{label}</label>
                      </div>

                      <div className="flex flex-col gap-3 mt-auto">
                        {/* Preview Box */}
                        <div 
                          className="flex h-32 items-center justify-center border border-slate-200 bg-white p-4 shadow-sm overflow-hidden"
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
                            <div className="flex flex-col items-center text-slate-400">
                              <Image size={32} className="mb-2 opacity-50" />
                              <span className="text-xs font-medium">No image</span>
                            </div>
                          )}
                        </div>

                        {/* Input Row */}
                        <div className="flex items-center gap-2">
                          <div 
                            className="flex-1 flex items-center h-9 px-3 border border-slate-200 bg-white text-sm text-slate-600 overflow-hidden shadow-sm"
                            style={{ borderRadius: 'var(--radius-input, 0.5rem)' }}
                          >
                            <span className="truncate">
                              {pendingLogos[key] ? (pendingLogos[key].name || 'logo.png') : (settings.logos?.[key] ? 'uploaded_logo.png' : 'Choose file...')}
                            </span>
                          </div>

                          <button
                            type="button"
                            disabled={uploadingLogo !== null}
                            onClick={() => setBrowserOpenKey(key)}
                            className="inline-flex items-center justify-center border border-slate-200 bg-white h-9 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 shrink-0"
                            style={{ borderRadius: 'var(--radius-button, 0.5rem)' }}
                          >
                            <Image size={14} className="mr-1.5" />
                            Browse
                          </button>

                          {(pendingLogos[key] || settings.logos?.[key]) && (
                            <button
                              type="button"
                              onClick={() => {
                                if (pendingLogos[key]) {
                                  setPendingLogos(prev => {
                                    const next = { ...prev };
                                    delete next[key];
                                    return next;
                                  });
                                } else {
                                  updateSection(setSettings, 'logos', key, '');
                                }
                              }}
                              className="inline-flex items-center justify-center border border-slate-200 bg-white h-9 w-9 text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors shadow-sm shrink-0"
                              style={{ borderRadius: 'var(--radius-button, 0.5rem)' }}
                            >
                              <X size={16} />
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
                onSelect={(file) => {
                  if (browserOpenKey && file.driveFileId) {
                    const url = `${API_BASE_URL}/files/drive/${file.driveFileId}/view`;
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
                }}
              />
            </div>
          )}

          {activeTab === 'ui' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <Card className="space-y-4 p-6">
                <div className="mb-6 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <AppWindow size={20} className="text-slate-800" />
                    <h3 className="text-lg font-semibold text-slate-800">Browser & Document Title</h3>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">Customize the application title displayed in the browser tab.</p>
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">Title Text</label>
                  <Input
                    placeholder="CRM"
                    value={settings.ui?.titleText || 'CRM'}
                    onChange={(e) => {
                      updateSection(setSettings, 'ui', 'titleText', e.target.value);
                      document.title = `Settings - ${e.target.value || 'CRM'}`;
                    }}
                  />
                  <p className="text-xs text-slate-500 mt-1">This changes the text in the top browser tab (e.g., Settings - Your Title).</p>
                </div>
              </Card>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="space-y-4 p-6 lg:col-span-2">
                  <div className="mb-6 border-b border-slate-100 pb-4">
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
                        {['#3b82f6', '#8b5cf6', '#f43f5e', '#10b981', '#f59e0b', '#06b6d4', '#4361ee'].map((color) => {
                          const isActive =
                            (settings.branding?.primaryColor || '#3b82f6').toLowerCase() ===
                            color.toLowerCase();
                          return (
                            <button
                              key={color}
                              type="button"
                              className={cn(
                                'relative flex items-center justify-center h-10 w-10 rounded-full shadow-sm border border-black/10 transition-all hover:scale-110 cursor-pointer',
                                isActive
                                  ? 'scale-110 ring-2 ring-offset-2 ring-[var(--primary)]'
                                  : 'hover:ring-2 hover:ring-offset-2 hover:ring-slate-300'
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

                        <div className="relative h-10 w-10 rounded-full shadow-sm border border-black/10 overflow-hidden hover:scale-110 transition-all hover:ring-2 hover:ring-offset-2 hover:ring-slate-300 group cursor-pointer">
                          <input
                            type="color"
                            className="absolute inset-[-50%] w-[200%] h-[200%] cursor-pointer p-0 m-0 border-0"
                            value={settings.branding?.primaryColor || '#3b82f6'}
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
                  <div className="mb-6 border-b border-slate-100 pb-4 flex items-center gap-2">
                    <Palette size={20} className="text-slate-800" />
                    <h3 className="text-lg font-semibold text-slate-800">Live Preview</h3>
                  </div>

                  <div
                    className="border border-slate-200 overflow-hidden bg-slate-50 flex flex-col mt-4 transition-all duration-300"
                    style={{ borderRadius: settings.ui?.cardRadius || '1.5rem' }}
                  >
                    {/* Mock Header */}
                    <div className="h-10 border-b border-slate-200 bg-slate-100/50 flex items-center justify-between px-4">
                      <div className="text-xs font-medium text-slate-700">Dashboard</div>
                      <div className="flex gap-2">
                        <div className="w-4 h-4 bg-slate-200" style={{ borderRadius: `calc(${settings.ui?.buttonRadius || '0.5rem'} * 0.4)` }}></div>
                        <div className="w-4 h-4 bg-slate-200" style={{ borderRadius: `calc(${settings.ui?.buttonRadius || '0.5rem'} * 0.4)` }}></div>
                      </div>
                    </div>

                    <div className="flex h-48">
                      {/* Mock Sidebar */}
                      <div className="w-24 border-r border-slate-200 bg-white p-3 flex flex-col gap-3">
                        <div className="text-[10px] font-bold text-slate-700 mb-2 flex items-center gap-0.5">
                          <span style={{ color: settings.branding?.primaryColor || '#3b82f6' }}>CR</span>M
                        </div>
                        <div className="h-2.5 w-full transition-all duration-300" style={{ backgroundColor: settings.branding?.primaryColor || '#3b82f6', borderRadius: `calc(${settings.ui?.buttonRadius || '0.5rem'} * 0.25)` }}></div>
                        <div className="h-2.5 w-full bg-slate-200 transition-all duration-300" style={{ borderRadius: `calc(${settings.ui?.buttonRadius || '0.5rem'} * 0.25)` }}></div>
                        <div className="h-2.5 w-full bg-slate-200 transition-all duration-300" style={{ borderRadius: `calc(${settings.ui?.buttonRadius || '0.5rem'} * 0.25)` }}></div>
                        <div className="h-2.5 w-full bg-slate-200 transition-all duration-300" style={{ borderRadius: `calc(${settings.ui?.buttonRadius || '0.5rem'} * 0.25)` }}></div>
                        <div className="h-2.5 w-full bg-slate-200 transition-all duration-300" style={{ borderRadius: `calc(${settings.ui?.buttonRadius || '0.5rem'} * 0.25)` }}></div>
                      </div>

                      {/* Mock Content */}
                      <div className="flex-1 bg-slate-50/50 p-4 flex flex-col gap-3">
                        {/* Mock Input */}
                        <div className="h-6 w-3/4 bg-white border border-slate-200 flex items-center gap-1.5 px-2 transition-all duration-300" style={{ borderRadius: `calc(${settings.ui?.inputRadius || '0.75rem'} * 0.6)` }}>
                          <div className="w-2.5 h-2.5 rounded-full border-2 border-slate-300 relative after:content-[''] after:absolute after:w-1 after:h-0.5 after:bg-slate-300 after:bottom-[-2px] after:right-[-3px] after:rotate-45"></div>
                          <div className="h-1.5 w-12 bg-slate-200 rounded-full"></div>
                        </div>
                        <div className="h-2.5 rounded-full w-1/2 bg-slate-200 mb-1"></div>

                        {/* Mock Buttons */}
                        <div className="flex gap-2 mb-1">
                          <div className="h-6 w-12 transition-all duration-300" style={{ backgroundColor: `color-mix(in srgb, ${settings.branding?.primaryColor || '#3b82f6'} 20%, transparent)`, borderRadius: `calc(${settings.ui?.buttonRadius || '0.5rem'} * 0.6)` }}></div>
                          <div className="h-6 w-12 bg-slate-200 transition-all duration-300" style={{ borderRadius: `calc(${settings.ui?.buttonRadius || '0.5rem'} * 0.6)` }}></div>
                          <div className="h-6 w-12 bg-slate-200 transition-all duration-300" style={{ borderRadius: `calc(${settings.ui?.buttonRadius || '0.5rem'} * 0.6)` }}></div>
                        </div>

                        {/* Mock Inner Card */}
                        <div className="flex-1 bg-white border border-slate-100 p-2 flex flex-col gap-2 transition-all duration-300" style={{ borderRadius: `calc(${settings.ui?.cardRadius || '1.5rem'} * 0.4)` }}>
                          <div className="h-2 rounded-full w-full bg-slate-100 mt-1"></div>
                          <div className="h-2 rounded-full w-5/6 bg-slate-100"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              <Card className="space-y-4 p-6">
                <div className="mb-6 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <Box size={20} className="text-slate-800" />
                    <h3 className="text-lg font-semibold text-slate-800">UI Elements</h3>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">Adjust the border radius of components.</p>
                </div>
                <div className="grid gap-8 md:grid-cols-3">
                  {[
                    ['inputRadius', 'Input Radius', '0.75rem'],
                    ['buttonRadius', 'Button Radius', '0.5rem'],
                    ['cardRadius', 'Card Radius', '1.5rem']
                  ].map(([key, label, def]) => (
                    <div key={key} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-slate-700">{label}</label>
                        <span className="text-xs font-mono font-medium text-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] px-2 py-0.5 rounded-full">
                          {settings.ui?.[key] || def}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="3"
                        step="0.125"
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[var(--primary)] hover:bg-slate-300 transition-colors"
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
                <div className="mb-6 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <Mail size={20} className="text-slate-800" />
                    <h3 className="text-lg font-semibold text-slate-800">SMTP Server</h3>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">Configuration for sending emails.</p>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  {[
                    ['host', 'Host'],
                    ['port', 'Port'],
                    ['username', 'Username'],
                    ['password', 'Password'],
                    ['fromName', 'From Name'],
                    ['fromEmail', 'From Email']
                  ].map(([key, label]) => (
                    <div key={key}>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
                      <Input
                        type={key === 'password' ? 'password' : 'text'}
                        value={settings.smtp?.[key] || ''}
                        onChange={(event) => updateSection(setSettings, 'smtp', key, event.target.value)}
                      />
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
                      <span className="text-sm font-medium text-slate-700">Use secure transport (TLS/SSL)</span>
                    </label>
                  </div>
                </div>
              </Card>

              <Card className="space-y-4 p-6">
                <div className="mb-6 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <FileText size={20} className="text-slate-800" />
                    <h3 className="text-lg font-semibold text-slate-800">Automated messages</h3>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">Default templates for outgoing emails.</p>
                </div>
                <div className="space-y-5">
                  {[
                    ['invoice', 'Invoice Template'],
                    ['paymentReminder', 'Payment Reminder'],
                    ['passwordReset', 'Password Reset OTP']
                  ].map(([key, label]) => (
                    <div key={key}>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
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
                <div className="mb-6 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <FileText size={20} className="text-slate-800" />
                    <h3 className="text-lg font-semibold text-slate-800">Invoice defaults</h3>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">Configure formatting and default terms for invoices.</p>
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
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
                      <Input
                        type={type || 'text'}
                        value={settings.invoice?.[key] ?? ''}
                        onChange={(event) => updateSection(setSettings, 'invoice', key, type === 'number' ? Number(event.target.value) : event.target.value)}
                      />
                    </div>
                  ))}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Invoice Number Format</label>
                    <select
                      className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-[var(--primary)] focus:outline-none"
                      value={String(settings.invoice?.numberFormat || 'month_year') === 'financial_year' ? 'financial_year' : 'month_year'}
                      onChange={(event) => updateSection(setSettings, 'invoice', 'numberFormat', event.target.value)}
                    >
                      <option value="month_year">Prefix + Month-Year + Sequence</option>
                      <option value="financial_year">Prefix + Financial Year + Sequence</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Terms & Conditions</label>
                    <Textarea rows={4} value={settings.invoice?.terms || ''} onChange={(event) => updateSection(setSettings, 'invoice', 'terms', event.target.value)} />
                  </div>
                </div>
              </Card>

              {/* Invoice Theme Color */}
              <Card className="space-y-4 p-6">
                <div className="mb-4 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <Palette size={20} className="text-slate-800" />
                    <h3 className="text-lg font-semibold text-slate-800">Invoice Theme Color</h3>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">This color controls the header, table header, and accents of your invoices.</p>
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
                          isActive ? "scale-110 ring-2 ring-offset-2" : "hover:ring-2 hover:ring-offset-2 hover:ring-slate-300"
                        )}
                        style={{ backgroundColor: color, '--tw-ring-color': color }}
                        onClick={() => updateSection(setSettings, 'invoiceTheme', 'primaryColor', color)}
                      >
                        {isActive && <Check size={18} className="text-white drop-shadow-md" />}
                      </button>
                    );
                  })}
                  <div className="w-px h-8 bg-slate-200 mx-1" />
                  <div className="relative h-10 w-10 rounded-full shadow-sm border border-black/10 overflow-hidden hover:scale-110 transition-all hover:ring-2 hover:ring-offset-2 hover:ring-slate-300 group" title="Custom Color">
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
                    <span className="text-xs font-mono text-slate-500">{settings.invoiceTheme?.primaryColor || '#4361EE'}</span>
                  </div>
                </div>
              </Card>

              {/* Watermark Image */}
              <Card className="space-y-4 p-6">
                <div className="mb-4 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <Image size={20} className="text-slate-800" />
                    <h3 className="text-lg font-semibold text-slate-800">Invoice Watermark</h3>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">This watermark will appear behind the content of every invoice (preview, print, public page).</p>
                </div>
                <div className="flex flex-col gap-4">
                  {(pendingWatermark?.previewUrl || settings.invoiceTheme?.watermarkUrl) && (
                    <div className="relative inline-block">
                      <img
                        src={pendingWatermark?.previewUrl || settings.invoiceTheme?.watermarkUrl}
                        alt="Watermark Preview"
                        className="h-24 w-auto object-contain rounded-lg border border-slate-200 bg-slate-50 p-2"
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
                    <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-slate-200 rounded-[var(--radius-button,0.5rem)] hover:bg-slate-50 transition-colors">
                      <Upload size={15} className="text-slate-500" />
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
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-slate-200 rounded-[var(--radius-button,0.5rem)] hover:bg-slate-50 transition-colors"
                      onClick={() => setWatermarkBrowserOpen(true)}
                    >
                      <Image size={15} className="text-slate-500" />
                      Browse Files
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">Recommended: PNG with transparency (opacity ~10–15%). Max size: 2MB.</p>
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
                      if (uploaded?.driveFileId) {
                        const url = `${API_BASE_URL}/files/drive/${uploaded.driveFileId}/view`;
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
                <div className="mb-4 border-b border-slate-100 pb-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Receipt size={20} className="text-slate-800" />
                      <h3 className="text-lg font-semibold text-slate-800">Invoice Templates</h3>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">Create and manage reusable invoice templates with branding.</p>
                  </div>
                  <Button size="sm" onClick={() => openTemplateModal()}>
                    <Plus size={14} className="mr-1" /> New Template
                  </Button>
                </div>
                {(Array.isArray(settings.invoiceTemplates) ? settings.invoiceTemplates : []).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
                    No templates yet. Create your first invoice template!
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {(settings.invoiceTemplates || []).map((tpl) => (
                      <div key={tpl.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-lg shrink-0 flex items-center justify-center text-white font-bold text-base" style={{ backgroundColor: tpl.primaryColor || '#3b82f6' }}>
                            {(tpl.name || 'T').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate">{tpl.name}</div>
                            <div className="text-xs text-slate-500">{tpl.layout || 'modern'} layout{tpl.isDefault ? ' · Default' : ''}</div>
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
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                            >
                              Set Default
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openTemplateModal(tpl)}
                            className="p-1.5 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
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
                            className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
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
                if (file.driveFileId) {
                  const url = `${API_BASE_URL}/files/drive/${file.driveFileId}/view`;
                  setPendingWatermark({ file: null, previewUrl: url, driveUrl: url });
                }
                setWatermarkBrowserOpen(false);
              }}
            />
          )}

          {activeTab === 'custom_fields' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <Card className="space-y-4 p-6">
                <div className="mb-6 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <ListTodo size={20} className="text-slate-800" />
                    <h3 className="text-lg font-semibold text-slate-800">Custom Fields Builder</h3>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">Manage lead statuses, sources, and labels for different modules.</p>
                </div>
                
                <div className="flex gap-4 border-b border-slate-200 mb-6">
                  {[
                    { id: 'leads', label: 'Lead Fields' },
                    { id: 'clients', label: 'Client Fields' },
                    { id: 'projects', label: 'Project Fields' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveModuleTab(tab.id)}
                      className={cn(
                        "pb-3 text-sm font-medium transition-colors relative",
                        activeModuleTab === tab.id 
                          ? "text-[var(--primary)]" 
                          : "text-slate-500 hover:text-slate-700"
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
                      <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Statuses</h4>
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
                          <div key={index} className="flex items-center justify-between px-3 py-2.5 border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors group" style={{ borderRadius: 'var(--radius-input, 0.75rem)' }}>
                            <div className="flex items-center gap-2.5">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: statusObj.color }} />
                              <span className="text-sm font-medium text-slate-700">{statusObj.label}</span>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                className="p-1.5 text-slate-400 hover:text-[var(--primary)] rounded-md hover:bg-white focus:outline-none"
                                onClick={() => {
                                  setFieldEditorType('statuses');
                                  setFieldEditorData({ index, value: statusObj.label });
                                  setFieldEditorValue(statusObj.label);
                                  setFieldEditorColor(statusObj.color);
                                  setFieldEditorState(statusObj.state || 'open');
                                  setFieldEditorOpen(true);
                                }}
                              >
                                <AppWindow size={14} />
                              </button>
                              <button
                                type="button"
                                className="p-1.5 text-slate-400 hover:text-red-500 rounded-md hover:bg-white focus:outline-none"
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
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {!(settings.statuses?.[activeModuleTab] || []).length && (
                        <div className="px-4 py-8 text-center border border-dashed border-slate-200 bg-slate-50/50" style={{ borderRadius: 'var(--radius-input, 0.75rem)' }}>
                          <p className="text-sm text-slate-500">No custom statuses added yet.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sources Section (Only for Leads right now, but could be dynamic) */}
                  {activeModuleTab === 'leads' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Sources</h4>
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
                          <div key={index} className="flex items-center justify-between px-3 py-2.5 border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors group" style={{ borderRadius: 'var(--radius-input, 0.75rem)' }}>
                            <span className="text-sm font-medium text-slate-700">{source}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                className="p-1.5 text-slate-400 hover:text-[var(--primary)] rounded-md hover:bg-white focus:outline-none"
                                onClick={() => {
                                  setFieldEditorType('sources');
                                  setFieldEditorData({ index, value: source });
                                  setFieldEditorValue(source);
                                  setFieldEditorOpen(true);
                                }}
                              >
                                <AppWindow size={14} />
                              </button>
                              <button
                                type="button"
                                className="p-1.5 text-slate-400 hover:text-red-500 rounded-md hover:bg-white focus:outline-none"
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
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                        {!(settings.sources?.[activeModuleTab] || []).length && (
                          <div className="px-4 py-8 text-center border border-dashed border-slate-200 bg-slate-50/50" style={{ borderRadius: 'var(--radius-input, 0.75rem)' }}>
                            <p className="text-sm text-slate-500">No custom sources added yet.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Shared labels</h4>
                        <p className="mt-1 text-sm text-slate-500">
                          Labels are now managed from the table headers and shared across leads, clients, tasks, notes, and reminders.
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
                <div className="mb-4 border-b border-slate-100 pb-4 flex items-center gap-2">
                  <Receipt size={20} className="text-slate-800" />
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">GST Configuration</h3>
                    <p className="text-sm text-slate-500 mt-0.5">Control how GST is applied across invoices.</p>
                  </div>
                </div>
                <div className="flex flex-col gap-4">
                  {[
                    { key: 'gstRegistered', label: 'Company is GST Registered', desc: 'Enable GST on all invoices.' },
                    { key: 'autoDetectTax', label: 'Smart Tax Engine (Auto CGST/SGST vs IGST)', desc: 'Automatically apply CGST+SGST for local clients and IGST for inter-state/export based on state codes.' },
                    { key: 'lutEnabled', label: 'LUT Export Enabled', desc: 'Apply zero-rated GST for international/overseas clients under Letter of Undertaking.' },
                    { key: 'enableCess', label: 'Enable GST Cess', desc: 'Apply Cess on top of GST for applicable goods/services.' },
                  ].map(({ key, label, desc }) => (
                    <label key={key} className="flex items-start gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={!!(settings.gst?.[key])}
                        onChange={(e) => updateSection(setSettings, 'gst', key, e.target.checked)}
                        className="mt-1 w-4 h-4 rounded text-[var(--primary)] border-slate-300"
                      />
                      <div>
                        <div className="text-sm font-medium text-slate-800">{label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </Card>

              {/* Tax Rate Defaults */}
              <Card className="space-y-4 p-6">
                <div className="mb-4 border-b border-slate-100 pb-4">
                  <h3 className="text-base font-semibold text-slate-800">Default Tax Rates</h3>
                  <p className="text-sm text-slate-500 mt-0.5">These are used when no rate is specified on a line item.</p>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Default GST Rate (%)</label>
                    <Input type="number" min={0} max={100}
                      value={settings.gst?.defaultRate ?? 18}
                      onChange={(e) => updateSection(setSettings, 'gst', 'defaultRate', Number(e.target.value))}
                      placeholder="18" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">CGST Rate (%)</label>
                    <Input type="number" min={0} max={50}
                      value={settings.gst?.cgstRate ?? 9}
                      onChange={(e) => updateSection(setSettings, 'gst', 'cgstRate', Number(e.target.value))}
                      placeholder="9" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">SGST Rate (%)</label>
                    <Input type="number" min={0} max={50}
                      value={settings.gst?.sgstRate ?? 9}
                      onChange={(e) => updateSection(setSettings, 'gst', 'sgstRate', Number(e.target.value))}
                      placeholder="9" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">IGST Rate (%)</label>
                    <Input type="number" min={0} max={100}
                      value={settings.gst?.igstRate ?? 18}
                      onChange={(e) => updateSection(setSettings, 'gst', 'igstRate', Number(e.target.value))}
                      placeholder="18" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Default Export Treatment</label>
                    <Input
                      value={settings.gst?.defaultExportTreatment || ''}
                      onChange={(e) => updateSection(setSettings, 'gst', 'defaultExportTreatment', e.target.value)}
                      placeholder="Export without payment of IGST under LUT" />
                  </div>
                </div>
              </Card>

              {/* TDS Settings */}
              <Card className="space-y-4 p-6">
                <div className="mb-4 border-b border-slate-100 pb-4">
                  <h3 className="text-base font-semibold text-slate-800">TDS Configuration</h3>
                  <p className="text-sm text-slate-500 mt-0.5">Tax Deducted at Source settings for payments received from clients.</p>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Default TDS Section</label>
                    <Input
                      value={settings.tds?.commissionSection || '194H'}
                      onChange={(e) => updateSection(setSettings, 'tds', 'commissionSection', e.target.value)}
                      placeholder="194H" />
                    <p className="text-xs text-slate-400 mt-1">e.g. 194H (Commission), 194J (Professional)</p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">TDS Rate (%)</label>
                    <Input type="number" min={0} max={100}
                      value={settings.tds?.commissionRate ?? 2}
                      onChange={(e) => updateSection(setSettings, 'tds', 'commissionRate', Number(e.target.value))}
                      placeholder="2" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">TDS Threshold (₹)</label>
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
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Template Name</label>
            <Input
              value={templateDraft.name}
              onChange={(event) => setTemplateDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder="e.g. Minimal Blue"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Primary Color</label>
            <Input
              type="color"
              value={templateDraft.primaryColor || '#3b82f6'}
              onChange={(event) => setTemplateDraft((current) => ({ ...current, primaryColor: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Layout</label>
            <select
              className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-[var(--primary)] focus:outline-none"
              value={templateDraft.layout || 'modern'}
              onChange={(event) => setTemplateDraft((current) => ({ ...current, layout: event.target.value }))}
            >
              <option value="modern">Modern</option>
              <option value="classic">Classic</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Footer Text</label>
            <Textarea
              rows={3}
              value={templateDraft.footerText || ''}
              onChange={(event) => setTemplateDraft((current) => ({ ...current, footerText: event.target.value }))}
              placeholder="Thank you for your business!"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(templateDraft.showLogo)}
              onChange={(event) => setTemplateDraft((current) => ({ ...current, showLogo: event.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary)]"
            />
            Show company logo
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(templateDraft.isDefault)}
              onChange={(event) => setTemplateDraft((current) => ({ ...current, isDefault: event.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary)]"
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
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Value *</label>
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
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Pipeline State</label>
              <select
                className="w-full h-10 px-3 py-2 border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-all"
                style={{ borderRadius: 'var(--radius-input, 0.5rem)' }}
                value={fieldEditorState}
                onChange={e => setFieldEditorState(e.target.value)}
              >
                <option value="open">Open (Active Lead)</option>
                <option value="won">Won (Convert to Client)</option>
                <option value="lost">Lost (Failed Lead)</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Leads dragged to a "Won" status will prompt for Client conversion.
              </p>
            </div>
          )}

          {fieldEditorType !== 'sources' && (
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Badge Color</label>
              <div className="flex flex-wrap gap-2">
                {presetColors.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFieldEditorColor(color)}
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center transition-all text-white",
                      fieldEditorColor === color ? "scale-110 shadow-md ring-2 ring-offset-2 ring-slate-300" : "hover:scale-105 opacity-90 hover:opacity-100"
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

      <FileBrowserModal
        open={browserOpenKey !== null}
        onClose={() => setBrowserOpenKey(null)}
        onSelect={(file) => {
          if (browserOpenKey) {
            updateSection(setSettings, 'logos', browserOpenKey, `${API_BASE_URL}/files/drive/${file.driveFileId}/view`);
            setBrowserOpenKey(null);
          }
        }}
        uploadModule="settings"
        uploadEntityId="logos"
      />
    </div>
  );
}
