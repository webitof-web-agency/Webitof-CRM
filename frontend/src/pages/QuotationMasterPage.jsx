import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Building2,
  ExternalLink,
  Globe2,
  ImagePlus,
  Link2,
  Plus,
  Save,
  Trash2,
  Upload,
  UsersRound
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../api/client';
import { getFileViewUrl } from '../lib/fileUpload';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Input, Textarea } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { Loader } from '../components/ui/Loader';
import quotationBackgroundImage from '../../assets/images/invoice_watermark.png';

const BUILT_IN_QUOTATION_BACKGROUND = 'builtin:invoice_watermark.png';

const EMPTY_MASTER = {
  aboutCompany: 'Webitof is a premium software development company in Raipur, building practical websites, mobile apps and cloud software systems designed for growth.\nWe work with startups, service brands and established companies that need modern digital execution with measurable outcomes.\nOur business-first delivery model keeps projects practical, scalable and aligned with conversion, operations and long-term growth.',
  expertise: 'Website & Ecommerce Development\nMobile App Development\nCustom CRM, ERP & SaaS\nCloud Software & Business Automation',
  developmentCapabilities: 'React, Next.js, Node.js, PHP & Laravel\nFlutter & React Native\nMySQL, PostgreSQL & MongoDB\nAWS, Azure, Google Cloud & Docker',
  businessContactDetails: '+91 9174786123 / +91 9183456123\ncontact@webitof.com\nUnit No. 3033, 3rd Floor, Currency Tower, VIP Rd, Vishal Nagar, Raipur, Chhattisgarh 492001, India',
  experienceYears: '8+',
  clientsServed: '550+',
  projectsDelivered: '600+',
  countriesServed: '15+',
  clientsPageUrl: 'https://webitof.com/#clients',
  qrCaption: 'Scan to view all clients',
  topClients: [
    { id: 'webitof-client-gk-electric', name: 'Gk Electric', logoUrl: 'https://webitof.com/assets/images/clients-logo/gk-electric-logo.webp', logoFileId: '' },
    { id: 'webitof-client-kamla-horeca', name: 'Kamla Horeca', logoUrl: 'https://webitof.com/assets/images/clients-logo/kamla-horeca-logo.webp', logoFileId: '' },
    { id: 'webitof-client-vains', name: 'Vains', logoUrl: 'https://webitof.com/assets/images/clients-logo/vains-logo.webp', logoFileId: '' },
    { id: 'webitof-client-vedamrit', name: 'Vedamrit', logoUrl: 'https://webitof.com/assets/images/clients-logo/vedamrit-logo.webp', logoFileId: '' },
    { id: 'webitof-client-travel-tailor', name: 'Travel Tailor', logoUrl: 'https://webitof.com/assets/images/clients-logo/travel-tailor-logo.webp', logoFileId: '' },
    { id: 'webitof-client-wedding-lecious', name: 'The Wedding Lecious', logoUrl: 'https://webitof.com/assets/images/clients-logo/the-wedding-lecious-logo.webp', logoFileId: '' },
    { id: 'webitof-client-skillverse', name: 'Skillverse', logoUrl: 'https://webitof.com/assets/images/clients-logo/skillverse-logo.webp', logoFileId: '' },
    { id: 'webitof-client-abhiyantri', name: 'Abhiyantri', logoUrl: 'https://webitof.com/assets/images/clients-logo/abhiyantri-logo.webp', logoFileId: '' },
    { id: 'webitof-client-ahira', name: 'Ahira Eco Adventures', logoUrl: 'https://webitof.com/assets/images/clients-logo/ahira-eco-adventures-logo.webp', logoFileId: '' },
    { id: 'webitof-client-ca-monk', name: 'Ca Monk', logoUrl: 'https://webitof.com/assets/images/clients-logo/ca-monk-logo.webp', logoFileId: '' },
    { id: 'webitof-client-gpat', name: 'Gpat Discussion Center', logoUrl: 'https://webitof.com/assets/images/clients-logo/gpat-discussion-center-logo.webp', logoFileId: '' },
    { id: 'webitof-client-albury', name: 'Albury College', logoUrl: 'https://webitof.com/assets/images/clients-logo/albury-college-logo-2.webp', logoFileId: '' }
  ],
  backgroundImageUrl: BUILT_IN_QUOTATION_BACKGROUND,
  backgroundImageFileId: '',
  backgroundOpacity: 8,
  isActive: true
};

function normalizeMaster(record) {
  const payload = record?.payload || record || {};
  return {
    ...EMPTY_MASTER,
    ...payload,
    id: record?.id || '',
    topClients: Array.isArray(payload.topClients) ? payload.topClients : [],
    backgroundOpacity: Math.min(30, Math.max(0, Number(payload.backgroundOpacity ?? 8)))
  };
}

function Field({ label, hint, required = false, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-[var(--text-main)]">
        {label}{required ? <span className="ml-1 text-rose-500">*</span> : null}
      </span>
      {children}
      {hint ? <span className="block text-xs leading-relaxed text-[var(--text-muted)]">{hint}</span> : null}
    </label>
  );
}

function MetricInput({ icon: Icon, label, value, placeholder, onChange, disabled = false }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary-subtle)] text-[var(--primary)]">
        <Icon size={18} />
      </div>
      <div className="mb-1.5 text-xs font-semibold text-[var(--text-muted)]">{label}</div>
      <Input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} disabled={disabled} />
    </div>
  );
}

export function QuotationMasterPage() {
  const { token, hasPermission } = useAuth();
  const [form, setForm] = useState(EMPTY_MASTER);
  const [recordId, setRecordId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState('');
  const backgroundInputRef = useRef(null);
  const logoInputRefs = useRef({});
  const canWrite = hasPermission('masters.write');

  useEffect(() => {
    let mounted = true;
    api.resources.list('/masters/quotation_master', token)
      .then((response) => {
        if (!mounted) return;
        const current = response?.data?.[0] || null;
        setRecordId(current?.id || '');
        setForm(normalizeMaster(current));
      })
      .catch((error) => toast.error(error.message || 'Unable to load quotation master'))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [token]);

  const lineCount = useMemo(() => form.aboutCompany.split(/\r?\n/).filter((line) => line.trim()).length, [form.aboutCompany]);
  const qrUrl = form.clientsPageUrl.trim()
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(form.clientsPageUrl.trim())}`
    : '';
  const backgroundPreviewUrl = form.backgroundImageUrl === BUILT_IN_QUOTATION_BACKGROUND
    ? quotationBackgroundImage
    : form.backgroundImageUrl;

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateClient(index, patch) {
    setForm((current) => ({
      ...current,
      topClients: current.topClients.map((client, clientIndex) => clientIndex === index ? { ...client, ...patch } : client)
    }));
  }

  function addClient() {
    if (form.topClients.length >= 12) {
      toast.error('You can showcase up to 12 top clients');
      return;
    }
    setForm((current) => ({
      ...current,
      topClients: [...current.topClients, { id: `client-${Date.now()}`, name: '', logoUrl: '', logoFileId: '' }]
    }));
  }

  function removeClient(index) {
    setForm((current) => ({ ...current, topClients: current.topClients.filter((_, clientIndex) => clientIndex !== index) }));
  }

  async function uploadImage(file, target, index = null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5 MB');
      return;
    }
    const uploadKey = index == null ? target : `${target}-${index}`;
    setUploading(uploadKey);
    try {
      const data = new FormData();
      data.append('file', file);
      data.append('moduleName', 'quotation-master');
      data.append('entityId', recordId || 'default');
      data.append('isPublic', 'true');
      const response = await api.files.upload(token, data);
      const uploaded = response?.data?.[0];
      if (!uploaded?.id) throw new Error('Upload did not return a file reference');
      const imageUrl = getFileViewUrl(uploaded);
      if (target === 'background') {
        setForm((current) => ({ ...current, backgroundImageUrl: imageUrl, backgroundImageFileId: uploaded.id || '' }));
      } else {
        updateClient(index, { logoUrl: imageUrl, logoFileId: uploaded.id || '' });
      }
      toast.success(target === 'background' ? 'Background uploaded' : 'Client logo uploaded');
    } catch (error) {
      toast.error(error.message || 'Image upload failed');
    } finally {
      setUploading('');
    }
  }

  async function save() {
    if (!canWrite) return;
    const meaningfulLines = form.aboutCompany.split(/\r?\n/).filter((line) => line.trim());
    if (meaningfulLines.length > 5) {
      toast.error('About the Company can contain a maximum of 5 non-empty lines');
      return;
    }
    if (form.clientsPageUrl && !/^https?:\/\//i.test(form.clientsPageUrl.trim())) {
      toast.error('Clients page URL must start with http:// or https://');
      return;
    }
    setSaving(true);
    try {
      const cleanClients = form.topClients
        .map((client) => ({ ...client, name: client.name.trim(), logoUrl: client.logoUrl.trim() }))
        .filter((client) => client.name || client.logoUrl);
      const payload = {
        name: 'Default Quotation Profile',
        isActive: true,
        sortOrder: 0,
        payload: {
          ...form,
          aboutCompany: form.aboutCompany.trim(),
          expertise: form.expertise.trim(),
          developmentCapabilities: form.developmentCapabilities.trim(),
          businessContactDetails: form.businessContactDetails.trim(),
          clientsPageUrl: form.clientsPageUrl.trim(),
          qrCaption: form.qrCaption.trim(),
          topClients: cleanClients,
          backgroundOpacity: Number(form.backgroundOpacity)
        }
      };
      const response = recordId
        ? await api.resources.update('/masters/quotation_master', recordId, payload, token)
        : await api.resources.create('/masters/quotation_master', payload, token);
      const saved = response?.data || {};
      setRecordId(saved.id || recordId);
      setForm(normalizeMaster(saved));
      api.cache.invalidate('/masters/quotation_master');
      toast.success('Quotation master saved');
    } catch (error) {
      toast.error(error.message || 'Unable to save quotation master');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex min-h-[45vh] items-center justify-center"><Loader text="Loading quotation master..." size="lg" /></div>;

  return (
    <div className="space-y-5 pb-24">
      <PageHeader
        title="Quotation Master"
        description="Control the reusable company profile, credibility, client showcase and background used in quotations."
        eyebrow="Administration"
      >
        {canWrite ? <Button onClick={save} loading={saving}><Save size={16} /> Save Master</Button> : null}
      </PageHeader>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>About the Company</CardTitle>
                <CardDescription>A concise company introduction and the capabilities shown in every quotation.</CardDescription>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${lineCount > 5 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                {lineCount}/5 lines
              </span>
            </CardHeader>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field label="Short Company Introduction" hint="Maximum 3–5 short, non-empty lines. Keep it client-focused.">
                  <Textarea rows={5} maxLength={700} value={form.aboutCompany} onChange={(event) => update('aboutCompany', event.target.value)} placeholder="Who you are, the value you create and the industries you serve..." disabled={!canWrite} error={lineCount > 5} />
                </Field>
              </div>
              <Field label="Expertise" hint="Core domains, industries or specialist strengths.">
                <Textarea rows={4} maxLength={500} value={form.expertise} onChange={(event) => update('expertise', event.target.value)} placeholder="Product engineering, digital transformation, UI/UX..." disabled={!canWrite} />
              </Field>
              <Field label="Development Capabilities" hint="Technology and delivery capabilities.">
                <Textarea rows={4} maxLength={500} value={form.developmentCapabilities} onChange={(event) => update('developmentCapabilities', event.target.value)} placeholder="Web, mobile, cloud, integrations, QA and DevOps..." disabled={!canWrite} />
              </Field>
              <div className="md:col-span-2">
                <Field label="Business Contact Details" hint="Address, email, phone or sales contact. Use one item per line.">
                  <Textarea rows={3} maxLength={400} value={form.businessContactDetails} onChange={(event) => update('businessContactDetails', event.target.value)} placeholder="Business email | Phone | Office address" disabled={!canWrite} />
                </Field>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Experience &amp; Reach</CardTitle>
                <CardDescription>Use presentation-ready values such as 10+, 250+ or 15+.</CardDescription>
              </div>
            </CardHeader>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricInput icon={Award} label="Years of Experience" placeholder="e.g. 10+" value={form.experienceYears} onChange={(value) => update('experienceYears', value)} disabled={!canWrite} />
              <MetricInput icon={UsersRound} label="Clients Served" placeholder="e.g. 120+" value={form.clientsServed} onChange={(value) => update('clientsServed', value)} disabled={!canWrite} />
              <MetricInput icon={Building2} label="Projects Delivered" placeholder="e.g. 250+" value={form.projectsDelivered} onChange={(value) => update('projectsDelivered', value)} disabled={!canWrite} />
              <MetricInput icon={Globe2} label="Countries Served" placeholder="e.g. 15+" value={form.countriesServed} onChange={(value) => update('countriesServed', value)} disabled={!canWrite} />
            </div>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Top Clients</CardTitle>
                <CardDescription>Add up to 12 client names and logos for the quotation trust strip.</CardDescription>
              </div>
              {canWrite ? <Button variant="secondary" size="sm" onClick={addClient}><Plus size={15} /> Add Client</Button> : null}
            </CardHeader>
            {form.topClients.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {form.topClients.map((client, index) => (
                  <div key={client.id || index} className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                    <button type="button" onClick={() => canWrite && logoInputRefs.current[index]?.click()} className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-[var(--border)] bg-white text-slate-400">
                      {client.logoUrl ? <img src={client.logoUrl} alt={client.name || 'Client logo'} className="h-full w-full object-contain p-2" /> : <ImagePlus size={22} />}
                    </button>
                    <input ref={(node) => { logoInputRefs.current[index] = node; }} type="file" accept="image/*" className="hidden" onChange={(event) => { uploadImage(event.target.files?.[0], 'logo', index); event.target.value = ''; }} />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Input value={client.name} onChange={(event) => updateClient(index, { name: event.target.value })} placeholder="Client name" disabled={!canWrite} />
                      <button type="button" className="text-xs font-semibold text-[var(--primary)] disabled:opacity-50" disabled={!canWrite || Boolean(uploading)} onClick={() => logoInputRefs.current[index]?.click()}>
                        {uploading === `logo-${index}` ? 'Uploading...' : client.logoUrl ? 'Replace logo' : 'Upload logo'}
                      </button>
                    </div>
                    {canWrite ? <button type="button" onClick={() => removeClient(index)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Remove ${client.name || 'client'}`}><Trash2 size={16} /></button> : null}
                  </div>
                ))}
              </div>
            ) : (
              <button type="button" onClick={addClient} disabled={!canWrite} className="flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] px-6 py-10 text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:pointer-events-none">
                <ImagePlus size={28} />
                <span className="mt-2 text-sm font-semibold">Add your first client logo</span>
              </button>
            )}
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>All Clients QR Code</CardTitle>
                <CardDescription>The QR code is generated from this URL and printed beside the top-client logos.</CardDescription>
              </div>
            </CardHeader>
            <div className="grid gap-5 md:grid-cols-[1fr_180px]">
              <div className="space-y-4">
                <Field label="All Clients Page URL" hint="Use a public portfolio, case-study or client-list page.">
                  <Input iconLeft={Link2} type="url" value={form.clientsPageUrl} onChange={(event) => update('clientsPageUrl', event.target.value)} placeholder="https://yourcompany.com/clients" disabled={!canWrite} />
                </Field>
                <Field label="QR Caption">
                  <Input value={form.qrCaption} onChange={(event) => update('qrCaption', event.target.value)} placeholder="Scan to view all clients" disabled={!canWrite} />
                </Field>
                {form.clientsPageUrl ? <a href={form.clientsPageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)]">Test destination <ExternalLink size={13} /></a> : null}
              </div>
              <div className="flex min-h-44 items-center justify-center rounded-2xl border border-[var(--border)] bg-white p-3">
                {qrUrl ? <img src={qrUrl} alt="All clients QR code" className="h-36 w-36" /> : <div className="text-center text-xs text-slate-400"><Link2 className="mx-auto mb-2" size={24} />Enter a URL to preview QR</div>}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Quotation Background Image</CardTitle>
                <CardDescription>Upload a subtle brand pattern or watermark. It will sit behind quotation content.</CardDescription>
              </div>
            </CardHeader>
            <div className="grid gap-5 md:grid-cols-[1fr_240px]">
              <div className="space-y-4">
                <input ref={backgroundInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { uploadImage(event.target.files?.[0], 'background'); event.target.value = ''; }} />
                <div className="flex flex-wrap gap-2">
                  {canWrite ? <Button variant="secondary" onClick={() => backgroundInputRef.current?.click()} disabled={Boolean(uploading)}><Upload size={16} /> {uploading === 'background' ? 'Uploading...' : form.backgroundImageUrl ? 'Replace Image' : 'Upload Image'}</Button> : null}
                  {canWrite && form.backgroundImageUrl ? <Button variant="ghost" onClick={() => setForm((current) => ({ ...current, backgroundImageUrl: '', backgroundImageFileId: '' }))}><Trash2 size={16} /> Remove</Button> : null}
                </div>
                <Field label={`Background Opacity (${form.backgroundOpacity}%)`} hint="Recommended: 5–12% so quotation text stays readable.">
                  <input type="range" min="0" max="30" step="1" value={form.backgroundOpacity} onChange={(event) => update('backgroundOpacity', Number(event.target.value))} disabled={!canWrite} className="w-full accent-[var(--primary)]" />
                </Field>
              </div>
              <div className="relative min-h-40 overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
                {backgroundPreviewUrl ? <img src={backgroundPreviewUrl} alt="Quotation background preview" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: form.backgroundOpacity / 100 }} /> : null}
                <div className="relative z-10 m-5 rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-sm">
                  <div className="h-2 w-24 rounded bg-slate-800" />
                  <div className="mt-3 h-1.5 w-full rounded bg-slate-200" />
                  <div className="mt-2 h-1.5 w-4/5 rounded bg-slate-200" />
                  <div className="mt-5 h-8 rounded bg-blue-50" />
                </div>
              </div>
            </div>
          </Card>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
          <Card className="overflow-hidden p-0">
            <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-5 text-white">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-200">Quotation profile</div>
              <div className="mt-2 text-xl font-bold">Company credibility block</div>
              <p className="mt-2 text-xs leading-relaxed text-blue-100">This content is reusable. Existing quotation-specific scope, pricing and terms remain unchanged.</p>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">About Company</div>
                <p className="mt-2 line-clamp-5 whitespace-pre-line text-sm leading-relaxed text-[var(--text-main)]">{form.aboutCompany || 'Your short company introduction will appear here.'}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  [form.experienceYears, 'Years'],
                  [form.clientsServed, 'Clients'],
                  [form.projectsDelivered, 'Projects'],
                  [form.countriesServed, 'Countries']
                ].map(([value, label]) => <div key={label} className="rounded-xl bg-[var(--surface-2)] p-3"><div className="text-lg font-bold text-[var(--primary)]">{value || '—'}</div><div className="text-[10px] font-semibold uppercase text-[var(--text-muted)]">{label}</div></div>)}
              </div>
              <div className="flex -space-x-2">
                {form.topClients.slice(0, 6).map((client, index) => <div key={client.id || index} title={client.name} className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-slate-100 text-[9px] font-bold text-slate-500">{client.logoUrl ? <img src={client.logoUrl} alt="" className="h-full w-full object-contain p-1" /> : (client.name || '?').slice(0, 2).toUpperCase()}</div>)}
              </div>
            </div>
          </Card>
          {!canWrite ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">You have read-only access. Ask an administrator for Masters write permission to edit this profile.</div> : null}
        </aside>
      </div>

      {canWrite ? <div className="fixed bottom-5 right-5 z-40 rounded-2xl border border-white/70 bg-white/85 p-2 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/85"><Button size="lg" onClick={save} loading={saving}><Save size={17} /> Save Quotation Master</Button></div> : null}
    </div>
  );
}
