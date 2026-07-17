import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Mail, Phone, MapPin, Camera,
  Globe, Facebook, Twitter, Linkedin,
  Youtube, Instagram, Github, Shield,
  User as UserIcon, Check, X, Briefcase, Building2, Tag
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { API_BASE_URL, api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { UserAvatar } from '../components/ui/UserAvatar';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Tabs } from '../components/ui/Tabs';
import { toast } from 'sonner';

const FIELD_CLASS = 'bg-transparent shadow-none border-b border-slate-200 border-x-0 border-t-0 rounded-none px-0 focus:ring-0 focus:border-[var(--primary)] h-8 text-sm';

function FieldRow({ label, children }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-4 py-1.5">
      <label className="text-sm font-medium text-slate-500">{label}</label>
      <div>{children}</div>
    </div>
  );
}

const SOCIAL_FIELDS = [
  { key: 'facebook', label: 'Facebook', Icon: Facebook, placeholder: 'https://www.facebook.com/' },
  { key: 'twitter', label: 'Twitter / X', Icon: Twitter, placeholder: 'https://twitter.com/' },
  { key: 'linkedin', label: 'LinkedIn', Icon: Linkedin, placeholder: 'https://www.linkedin.com/in/' },
  { key: 'youtube', label: 'YouTube', Icon: Youtube, placeholder: 'https://www.youtube.com/' },
  { key: 'instagram', label: 'Instagram', Icon: Instagram, placeholder: 'https://instagram.com/' },
  { key: 'github', label: 'GitHub', Icon: Github, placeholder: 'https://github.com/' },
  { key: 'website', label: 'Website', Icon: Globe, placeholder: 'https://yoursite.com' },
];

export function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, hasPermission, user: authUser } = useAuth();

  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [assignedProjects, setAssignedProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarFileId, setAvatarFileId] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef(null);

  const isSelf = String(authUser?.id) === String(id);
  const canManageUsers = hasPermission('users.manage');
  
  const canEditBasic = canManageUsers || isSelf;
  const canEditSensitive = canManageUsers;

  useEffect(() => {
    if (!id || !token) return;
    setLoading(true);
    Promise.allSettled([
      api.resources.get('/users', id, token),
      api.resources.list('/roles', token),
      api.resources.list('/projects', token)
    ]).then(([userRes, rolesRes, projectsRes]) => {
      if (userRes.status === 'fulfilled') {
        const u = userRes.value.data || userRes.value;
        setUser(u);
        setAvatarUrl(u?.avatarUrl || null);
        setAvatarFileId(u?.avatarFileId || null);
      }
      if (rolesRes.status === 'fulfilled') {
        setRoles(rolesRes.value.data || []);
      }
      if (projectsRes.status === 'fulfilled') {
        const allProjects = projectsRes.value.data || [];
        setAssignedProjects(allProjects.filter(p => String(p.assignedTo) === String(id)));
      }
    }).finally(() => setLoading(false));
  }, [id, token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-20 text-slate-500">
        <UserIcon size={40} className="mx-auto mb-4 text-slate-300" />
        <p className="text-lg font-medium">User not found</p>
        <Button className="mt-4" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  const name = user.fullName || user.username || user.email || 'User';

  // ── Save General Info ──────────────────────────────────────────────
  function handleGeneralSave(e) {
    e.preventDefault();
    const form = e.currentTarget.closest('form');
    const fd = new FormData(form);
    const payload = {
      fullName: fd.get('fullName'),
      username: fd.get('username'),
      email: fd.get('email'),
      phone: fd.get('phone'),
      address: fd.get('address'),
      avatarUrl: avatarUrl || user.avatarUrl,
      avatarFileId: avatarFileId || user.avatarFileId || null,
    };
    setSaving(true);
    api.resources.update('/users', id, payload, token)
      .then(() => {
        toast.success('User saved!');
        setUser(prev => ({ ...prev, ...payload }));
      })
      .catch(err => toast.error(err.message || 'Save failed'))
      .finally(() => setSaving(false));
  }

  // ── Save Social Links ──────────────────────────────────────────────
  function handleSocialSave(e) {
    e.preventDefault();
    const form = e.currentTarget.closest('form');
    const fd = new FormData(form);
    const social = {};
    SOCIAL_FIELDS.forEach(({ key }) => { social[key] = fd.get(key) || ''; });
    setSaving(true);
    api.resources.update('/users', id, { social }, token)
      .then(() => toast.success('Social links saved!'))
      .catch(err => toast.error(err.message || 'Save failed'))
      .finally(() => setSaving(false));
  }

  const social = user.social || {};

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
      formData.append('moduleName', 'users');
      formData.append('entityId', id);
      formData.append('isPublic', 'true');

      const uploadRes = await api.files.upload(token, formData);
      const uploadedFile = uploadRes.data?.[0];
      if (!uploadedFile?.driveFileId) {
        throw new Error('Upload failed');
      }

      const nextAvatarUrl = `${API_BASE_URL}/files/drive/${uploadedFile.driveFileId}/view`;
      setAvatarUrl(nextAvatarUrl);
      setAvatarFileId(uploadedFile.id);
      setUser((prev) => (prev ? { ...prev, avatarUrl: nextAvatarUrl, avatarFileId: uploadedFile.id } : prev));

      await api.resources.update('/users', id, {
        avatarUrl: nextAvatarUrl,
        avatarFileId: uploadedFile.id
      }, token);

      toast.success('Profile picture updated!');
    } catch (error) {
      toast.error(error.message || 'Failed to upload profile picture');
    } finally {
      setAvatarUploading(false);
      event.target.value = '';
    }
  }

  // ─── Tabs Content ────────────────────────────────────────────────────────
  const generalInfoTab = (
    <form className="p-6 space-y-4 max-w-2xl">
      <h4 className="text-lg font-semibold text-slate-800">General Info</h4>
      <div className="space-y-1">
        <FieldRow label="Full Name">
          <Input name="fullName" defaultValue={user.fullName || ''} className={FIELD_CLASS} readOnly={!canEditBasic} />
        </FieldRow>
        <FieldRow label="Username">
          <Input name="username" defaultValue={user.username || ''} className={FIELD_CLASS} readOnly={!canEditBasic} />
        </FieldRow>
        <FieldRow label="Email">
          <Input name="email" type="email" defaultValue={user.email || ''} className={FIELD_CLASS} readOnly={!canEditBasic} />
        </FieldRow>
        <FieldRow label="Phone">
          <Input name="phone" type="tel" defaultValue={user.phone || ''} className={FIELD_CLASS} readOnly={!canEditBasic} placeholder="—" />
        </FieldRow>
        <FieldRow label="Address">
          <Input name="address" defaultValue={user.address || ''} className={FIELD_CLASS} readOnly={!canEditBasic} placeholder="—" />
        </FieldRow>
        <FieldRow label="Status">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
            {user.isActive ? 'Active' : 'Inactive'}
          </span>
        </FieldRow>
        <FieldRow label="Last Login">
          <span className="text-sm text-slate-600">
            {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : '—'}
          </span>
        </FieldRow>
      </div>
      {canEditBasic && (
        <div className="pt-4">
          <Button type="button" disabled={saving} onClick={handleGeneralSave}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}
    </form>
  );

  const jobInfoTab = (
    <form className="p-6 space-y-4 max-w-2xl">
      <h4 className="text-lg font-semibold text-slate-800">Job Info</h4>
      <div className="space-y-1">
        <FieldRow label="Role">
          <div className="flex items-center gap-2 h-8">
            <Shield size={15} className="text-[var(--primary)]" />
            <span className="text-sm font-medium text-slate-700">
              {(user.roles && user.roles[0]?.name) || roles.find(r => r.id === user.roleId)?.name || user.role || '—'}
            </span>
          </div>
        </FieldRow>
        <FieldRow label="Salary">
          <Input
            name="salary"
            type="number"
            defaultValue={user.salary || ''}
            className={FIELD_CLASS}
            readOnly={!canEditSensitive}
            placeholder="—"
          />
        </FieldRow>
      </div>
      {canEditSensitive && (
        <div className="pt-4">
          <Button type="button" disabled={saving} onClick={(e) => {
            const form = e.currentTarget.closest('form');
            const fd = new FormData(form);
            setSaving(true);
            api.resources.update('/users', id, { salary: fd.get('salary') }, token)
              .then(() => toast.success('Job info saved!'))
              .catch(err => toast.error(err.message || 'Save failed'))
              .finally(() => setSaving(false));
          }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}
    </form>
  );


  // ── Assigned Projects Tab ─────────────────────────────────────────────
  const assignedProjectsTab = (
    <div className="p-6">
      <h4 className="text-lg font-semibold text-slate-800 mb-4">Assigned Projects</h4>
      {assignedProjects.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Briefcase size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="font-medium text-slate-500">No projects assigned</p>
          <p className="text-sm mt-1">This user has no projects assigned yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {assignedProjects.map(project => {
            const progress = project.progressPercent || (project.status === 'Completed' ? 100 : project.status === 'In Progress' ? 55 : project.status === 'On Hold' ? 25 : 0);
            const statusColor = project.status === 'Completed' ? '#10b981' : project.status === 'In Progress' ? '#3b82f6' : project.status === 'On Hold' ? '#f59e0b' : '#64748b';
            return (
              <div key={project.id} className="flex items-center gap-4 py-3.5">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${statusColor}18` }}>
                  <Briefcase size={16} style={{ color: statusColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{project.title || '—'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: statusColor }} />
                    </div>
                    <span className="text-[11px] text-slate-400">{progress}%</span>
                  </div>
                </div>
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
                  style={{ backgroundColor: `${statusColor}14`, color: statusColor, borderColor: `${statusColor}30` }}
                >
                  {project.status || '—'}
                </span>
                {project.deadline && (
                  <span className="text-[11px] text-slate-400 shrink-0">
                    {new Date(project.deadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const tabs = [
    { id: 'general', label: 'General Info', content: generalInfoTab },
    { id: 'job', label: 'Job Info', content: jobInfoTab },
    { id: 'projects', label: `Projects (${assignedProjects.length})`, content: assignedProjectsTab },
    { id: 'account', label: 'Account Settings', content: (
      <div className="p-12 text-center text-slate-400">
        <UserIcon size={32} className="mx-auto mb-3 text-slate-300" />
        <p className="font-medium text-slate-500">Coming Soon</p>
      </div>
    )},
  ];

  return (
    <div className="space-y-0">
      {/* Back bar */}
      <div className="flex items-center gap-3 px-1 pb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-[var(--primary)] transition-colors"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-medium text-slate-700">User Profile</span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* ── Banner Header ── */}
        <div
          className="relative px-8 pt-10 pb-6 text-white"
          style={{ background: 'linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 70%, #1e1b4b) 100%)' }}
        >
          <div className="flex items-start gap-8">
            {/* Avatar */}
            <div className="flex flex-col items-center shrink-0">
              <div className="relative">
                <div className="h-28 w-28 rounded-full overflow-hidden border-4 border-white/30 shadow-xl bg-white">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
                  ) : (
                    <UserAvatar name={name} className="h-full w-full rounded-none" fallbackSize={52} />
                  )}
                </div>
                {canEditBasic && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="absolute bottom-0 right-0 p-1.5 bg-white rounded-full text-slate-500 shadow-md border border-slate-200 hover:text-[var(--primary)] transition-colors"
                    title="Change profile picture"
                  >
                    <Camera size={14} />
                  </button>
                )}
              </div>
              <h1 className="mt-3 text-xl font-bold tracking-tight text-center">{name}</h1>
            </div>

            {/* Info block */}
            <div className="flex flex-col gap-3 pt-1 flex-1">
              {/* Role badge */}
              {(() => {
                const roleName = (user.roles && user.roles.length > 0 ? user.roles.map(r => r.name).join(', ') : null) 
                  || roles.find(r => r.id === user.roleId)?.name 
                  || user.role 
                  || user.roleCode
                  || 'User'; // Added fallback so badge always shows
                
                return (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/20 text-white border border-white/30 self-start mb-2">
                    <Shield size={12} />
                    {roleName}
                  </span>
                );
              })()}
              <div className="flex flex-col gap-2 text-sm font-medium text-white/90">
                {user.email && (
                  <div className="flex items-center gap-2.5">
                    <Mail size={14} className="text-white/70" />
                    <span>{user.email}</span>
                  </div>
                )}
                {user.phone && (
                  <div className="flex items-center gap-2.5">
                    <Phone size={14} className="text-white/70" />
                    <span>{user.phone}</span>
                  </div>
                )}
                {user.address && (
                  <div className="flex items-center gap-2.5">
                    <MapPin size={14} className="text-white/70" />
                    <span>{user.address}</span>
                  </div>
                )}
              </div>

              {/* Status pill */}
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${user.isActive ? 'bg-green-400/20 text-green-100 border-green-400/30' : 'bg-red-400/20 text-red-100 border-red-400/30'}`}>
                  {user.isActive ? <Check size={10} /> : <X size={10} />}
                  {user.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
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
