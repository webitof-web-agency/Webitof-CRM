import React, { useRef, useState } from 'react';
import { Mail, Phone, Globe, MessageSquare, Clock, Camera, Facebook, Twitter, Linkedin, Youtube, Instagram, Github } from 'lucide-react';
import { UserAvatar } from '../ui/UserAvatar';
import { Tabs } from '../ui/Tabs';
import { Input, Textarea } from '../ui/Input';
import { Button } from '../ui/Button';
import imageCompression from 'browser-image-compression';
import { API_BASE_URL, api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';

const FIELD_CLASS = 'bg-transparent shadow-none border-b border-slate-200 border-x-0 border-t-0 rounded-none px-0 focus:ring-0 focus:border-[var(--primary)] h-8';

function FieldRow({ label, children }) {
  return (
    <div className="grid grid-cols-[130px_1fr] items-center gap-4 py-1">
      <label className="text-sm font-medium text-slate-500">{label}</label>
      <div>{children}</div>
    </div>
  );
}

export function ProfilePanel({ data, type, onClose, leadData, onSaved }) {
  const { token } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState(data?.avatarUrl || null);
  const [avatarFileId, setAvatarFileId] = useState(data?.avatarFileId || null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  if (!data) return null;

  const isOwner = type === 'owner';
  const name = isOwner
    ? (data.fullName || data.name || 'System Admin')
    : `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Unknown Contact';

  const email = data.email || '';
  const phone = data.phone || '';
  const jobTitle = data.jobTitle || (isOwner ? data.role : '');
  const gender = data.gender || 'Male';

  // ─── General Info Tab ──────────────────────────────────────────────────────
  function handleGeneralSave(e) {
    e.preventDefault();
    const form = e.currentTarget.closest('form');
    const fd = new FormData(form);
    const payload = {
      firstName: fd.get('firstName'),
      lastName: fd.get('lastName'),
      email: fd.get('email'),
      phone: fd.get('phone'),
      jobTitle: fd.get('jobTitle'),
      gender: fd.get('gender'),
      isPrimary: fd.get('isPrimary') === 'on',
      notes: fd.get('notes'),
      avatarUrl,
      avatarFileId,
    };
    setSaving(true);
    const endpoint = data.clientId ? '/client-contacts' : '/lead-contacts';
    api.resources.update(endpoint, data.id, payload, token)
      .then(() => { toast.success('Contact saved'); onSaved?.(); })
      .catch((err) => toast.error(err.message || 'Save failed'))
      .finally(() => setSaving(false));
  }

  const generalInfoTab = (
    <form className="p-6 space-y-4">
      <h4 className="text-lg font-semibold text-slate-800">General Info</h4>
      <div className="grid grid-cols-1 gap-3 max-w-lg">
        <FieldRow label="First name">
          <Input name="firstName" defaultValue={data.firstName || name.split(' ')[0]} className={FIELD_CLASS} />
        </FieldRow>
        <FieldRow label="Last name">
          <Input name="lastName" defaultValue={data.lastName || name.split(' ').slice(1).join(' ')} className={FIELD_CLASS} />
        </FieldRow>
        <FieldRow label="Email">
          <Input name="email" type="email" defaultValue={email} className={FIELD_CLASS} />
        </FieldRow>
        <FieldRow label="Phone">
          <Input name="phone" type="tel" defaultValue={phone} className={FIELD_CLASS} />
        </FieldRow>
        {!isOwner && (
          <FieldRow label="Job Title">
            <Input name="jobTitle" defaultValue={jobTitle} className={FIELD_CLASS} />
          </FieldRow>
        )}
        {!isOwner && (
          <FieldRow label="Gender">
            <div className="flex items-center gap-3 h-8">
              {['Male', 'Female', 'Other'].map((g) => (
                <label key={g} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="gender"
                    value={g}
                    defaultChecked={gender === g || (g === 'Other' && gender !== 'Male' && gender !== 'Female')}
                    className="h-4 w-4 !appearance-auto"
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span className="text-sm text-slate-700">{g}</span>
                </label>
              ))}
            </div>
          </FieldRow>
        )}
        {!isOwner && (
          <FieldRow label="Primary contact">
            <input
              type="checkbox"
              name="isPrimary"
              defaultChecked={data.isPrimary !== false}
              className="h-4 w-4 rounded !appearance-auto"
              style={{ accentColor: 'var(--primary)' }}
            />
          </FieldRow>
        )}
        {!isOwner && (
          <FieldRow label="Notes">
            <Textarea name="notes" defaultValue={data.notes || ''} rows={3} className="border border-slate-200 rounded px-2 py-1 w-full text-sm focus:ring-0 focus:border-[var(--primary)]" />
          </FieldRow>
        )}
      </div>
      <div className="pt-4">
        <Button type="button" disabled={saving} onClick={handleGeneralSave}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );

  // ─── Company Tab (lead data) ────────────────────────────────────────────────
  const ld = leadData || {};

  function handleCompanySave(e) {
    e.preventDefault();
    if (!ld.id) return toast.error('No lead data linked');
    const form = e.currentTarget.closest('form');
    const fd = new FormData(form);
    const payload = {
      companyName: fd.get('companyName'),
      website: fd.get('website'),
      address: fd.get('address'),
      city: fd.get('city'),
      state: fd.get('state'),
      pincode: fd.get('pincode'),
      country: fd.get('country'),
      vatNumber: fd.get('vatNumber'),
      gstNumber: fd.get('gstNumber'),
      source: fd.get('source'),
      status: fd.get('status'),
      value: fd.get('value'),
    };
    setSaving(true);
    api.resources.update('/leads', ld.id, payload, token)
      .then(() => { toast.success('Company info saved'); onSaved?.(); })
      .catch((err) => toast.error(err.message || 'Save failed'))
      .finally(() => setSaving(false));
  }

  const companyTab = (
    <form className="p-6 space-y-4">
      <h4 className="text-lg font-semibold text-slate-800">Company Info</h4>
      <div className="grid grid-cols-1 gap-3 max-w-lg">
        <FieldRow label="Company Name">
          <Input name="companyName" defaultValue={ld.companyName || ld.name || ''} className={FIELD_CLASS} />
        </FieldRow>
        <FieldRow label="Website">
          <Input name="website" defaultValue={ld.website || ''} className={FIELD_CLASS} placeholder="https://" />
        </FieldRow>
        <FieldRow label="Status">
          <Input name="status" defaultValue={ld.status || ''} className={FIELD_CLASS} />
        </FieldRow>
        <FieldRow label="Source">
          <Input name="source" defaultValue={ld.source || ''} className={FIELD_CLASS} />
        </FieldRow>
        <FieldRow label="Lead Value">
          <Input name="value" type="number" defaultValue={ld.value || ''} className={FIELD_CLASS} placeholder="0" />
        </FieldRow>
        <FieldRow label="Address">
          <Input name="address" defaultValue={ld.address || ''} className={FIELD_CLASS} />
        </FieldRow>
        <FieldRow label="City">
          <Input name="city" defaultValue={ld.city || ''} className={FIELD_CLASS} />
        </FieldRow>
        <FieldRow label="State">
          <Input name="state" defaultValue={ld.state || ''} className={FIELD_CLASS} />
        </FieldRow>
        <FieldRow label="Zip / Pincode">
          <Input name="pincode" defaultValue={ld.pincode || ''} className={FIELD_CLASS} />
        </FieldRow>
        <FieldRow label="Country">
          <Input name="country" defaultValue={ld.country || ''} className={FIELD_CLASS} />
        </FieldRow>
        <FieldRow label="GST Number">
          <Input name="gstNumber" defaultValue={ld.gstNumber || ''} className={FIELD_CLASS} />
        </FieldRow>
        <FieldRow label="VAT Number">
          <Input name="vatNumber" defaultValue={ld.vatNumber || ''} className={FIELD_CLASS} />
        </FieldRow>
      </div>
      <div className="pt-4">
        <Button type="button" disabled={saving || !ld.id} onClick={handleCompanySave}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );

  // ─── Social Links Tab ───────────────────────────────────────────────────────
  const SOCIAL_FIELDS = [
    { key: 'facebook', label: 'Facebook', Icon: Facebook, placeholder: 'https://www.facebook.com/' },
    { key: 'twitter', label: 'Twitter / X', Icon: Twitter, placeholder: 'https://twitter.com/' },
    { key: 'linkedin', label: 'LinkedIn', Icon: Linkedin, placeholder: 'https://www.linkedin.com/' },
    { key: 'whatsapp', label: 'WhatsApp', Icon: Phone, placeholder: 'https://wa.me/+00XXXXXXXXX' },
    { key: 'youtube', label: 'YouTube', Icon: Youtube, placeholder: 'https://www.youtube.com/' },
    { key: 'instagram', label: 'Instagram', Icon: Instagram, placeholder: 'https://instagram.com/' },
    { key: 'github', label: 'GitHub', Icon: Github, placeholder: 'https://github.com/' },
    { key: 'website', label: 'Website', Icon: Globe, placeholder: 'https://yoursite.com' },
  ];

  function handleSocialSave(e) {
    e.preventDefault();
    if (!data.id) return;
    const form = e.currentTarget.closest('form');
    const fd = new FormData(form);
    const social = {};
    SOCIAL_FIELDS.forEach(({ key }) => { social[key] = fd.get(key) || ''; });
    const payload = { social };
    setSaving(true);
    api.resources.update('/lead-contacts', data.id, payload, token)
      .then(() => { toast.success('Social links saved'); onSaved?.(); })
      .catch((err) => toast.error(err.message || 'Save failed'))
      .finally(() => setSaving(false));
  }

  const social = data.social || {};

  async function handleAvatarFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setAvatarUploading(true);
    try {
      let uploadFile = file;
      if (file.type.startsWith('image/')) {
        try {
          uploadFile = await imageCompression(file, {
            maxSizeMB: 1,
            maxWidthOrHeight: 1024,
            useWebWorker: true
          });
        } catch (err) {
          console.error('Compression error:', err);
        }
      }

      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('moduleName', isOwner ? 'users' : 'leads');
      formData.append('entityId', data.id);
      formData.append('isPublic', 'true');

      const uploadRes = await api.files.upload(token, formData);
      const uploadedFile = uploadRes.data?.[0];
      if (!uploadedFile?.driveFileId) {
        throw new Error('Upload failed');
      }

      const nextAvatarUrl = `${API_BASE_URL}/files/drive/${uploadedFile.driveFileId}/view`;
      setAvatarUrl(nextAvatarUrl);
      setAvatarFileId(uploadedFile.id);
      toast.success('Profile picture updated!');
    } catch (error) {
      toast.error(error.message || 'Failed to upload profile picture');
    } finally {
      setAvatarUploading(false);
      event.target.value = '';
    }
  }

  const socialTab = (
    <form className="p-6 space-y-4">
      <h4 className="text-lg font-semibold text-slate-800">Social Links</h4>
      <div className="grid grid-cols-1 gap-3 max-w-lg">
        {SOCIAL_FIELDS.map(({ key, label, Icon, placeholder }) => (
          <FieldRow key={key} label={label}>
            <div className="flex items-center gap-2">
              <Icon size={15} className="text-slate-400 shrink-0" />
              <Input
                name={key}
                defaultValue={social[key] || ''}
                placeholder={placeholder}
                className={FIELD_CLASS}
              />
            </div>
          </FieldRow>
        ))}
      </div>
      <div className="pt-4">
        <Button type="button" disabled={saving} onClick={handleSocialSave}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );

  // ─── Build Tabs ─────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'general', label: 'General Info', content: generalInfoTab },
    ...(!isOwner ? [{ id: 'company', label: 'Company', content: companyTab }] : []),
    { id: 'social', label: 'Social Links', content: socialTab },
  ];

  if (isOwner) {
    tabs.push({ id: 'account', label: 'Account Settings', content: (
      <div className="p-12 text-center text-slate-500">Account settings coming soon.</div>
    )});
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Profile Header */}
      <div className="bg-[var(--primary)] px-8 pt-10 pb-8 text-white relative flex-shrink-0">
        <div className="flex items-start gap-8">
          {/* Avatar with camera button */}
          <div className="flex flex-col items-center">
            <div className="relative group">
              <div className="h-32 w-32 rounded-full overflow-hidden border-4 border-white/30 shadow-md bg-white">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
                ) : (
                  <UserAvatar name={name} className="h-full w-full rounded-none" fallbackSize={60} />
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="absolute bottom-1 right-1 p-1.5 bg-white rounded-full text-slate-500 shadow border border-slate-200 hover:text-[var(--primary)] transition-colors"
                title="Change profile picture"
              >
                <Camera size={16} />
              </button>
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-center">{name}</h2>
          </div>

          {/* Info block */}
          <div className="flex flex-col gap-4 pt-2">
            {jobTitle && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-white/20 text-white border border-white/30 self-start">
                {jobTitle}
              </span>
            )}
            <div className="flex flex-col gap-3 mt-1 text-white text-sm font-medium">
              {email && (
                <div className="flex items-center gap-2.5">
                  <Mail size={16} className="text-white/80" />
                  <span>{email}</span>
                </div>
              )}
              {phone && (
                <div className="flex items-center gap-2.5">
                  <Phone size={16} className="text-white/80" />
                  <span>{phone}</span>
                </div>
              )}
            </div>
            {isOwner && (
              <div className="flex items-center gap-3 mt-2">
                <button className="h-8 w-8 rounded-full border border-white/30 flex items-center justify-center hover:bg-white/10 transition-colors">
                  <Globe size={14} />
                </button>
                <button className="h-8 px-3 rounded text-xs font-medium border border-white/30 flex items-center justify-center hover:bg-white/10 transition-colors gap-2">
                  <MessageSquare size={14} /> Send message
                </button>
                <button className="h-8 px-3 rounded text-xs font-medium border border-white/30 flex items-center justify-center hover:bg-white/10 transition-colors gap-2">
                  <Clock size={14} /> Reminder
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white flex-1 overflow-auto">
        <Tabs tabs={tabs} defaultTab="general" />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarFileChange}
      />
    </div>
  );
}
