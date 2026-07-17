import { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { UserAvatar } from '../components/ui/UserAvatar';
import { User, Mail, Shield, Camera, Key, Save, Phone, MapPin, Trash2, Upload, X, Image } from 'lucide-react';
import { api, API_BASE_URL } from '../api/client';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';

export function ProfilePage() {
  const { user, token, updateProfile, deleteAvatar } = useAuth();
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const [pendingFile, setPendingFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(false);

  const displayAvatarUrl = previewUrl || (pendingDelete ? null : user?.avatarUrl);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData(e.target);
      const payload = {
        fullName: formData.get('fullName'),
        phone: formData.get('phone'),
        address: formData.get('address')
      };

      if (pendingDelete) {
        await deleteAvatar();
      }

      if (pendingFile) {
        const fileData = new FormData();
        fileData.append('file', pendingFile);
        fileData.append('moduleName', 'users');
        fileData.append('entityId', user.id);
        fileData.append('isPublic', 'true');

        const uploadRes = await api.files.upload(token, fileData);
        const uploadedFile = uploadRes.data?.[0];

        if (uploadedFile) {
          payload.avatarUrl = `${API_BASE_URL}/files/drive/${uploadedFile.driveFileId}/view`;
          payload.avatarFileId = uploadedFile.id;
        } else {
          throw new Error("Upload failed");
        }
      }

      await updateProfile(payload);

      setPendingFile(null);
      setPreviewUrl(null);
      setPendingDelete(false);

      toast.success("Profile updated successfully!");
    } catch (error) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    toast.error("Password update not implemented yet");
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let uploadFile = file;
    if (file.type.startsWith('image/')) {
      try {
        uploadFile = await imageCompression(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1024,
          useWebWorker: true,
        });
      } catch (err) {
        console.error('Compression error:', err);
      }
    }

    setPendingFile(uploadFile);
    setPendingDelete(false);

    const reader = new FileReader();
    reader.onload = (ev) => setPreviewUrl(ev.target.result);
    reader.readAsDataURL(uploadFile);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteAvatar = () => {
    setPendingFile(null);
    setPreviewUrl(null);
    setPendingDelete(true);
  };

  return (
    <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Profile</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your account settings and preferences.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2 items-stretch">

        {/* Personal Information & Avatar */}
        <Card className="p-6 shadow-sm h-full flex flex-col">
          <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center bg-blue-50 text-[var(--primary)]" style={{ borderRadius: 'var(--radius-button, 0.5rem)' }}>
              <User size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Personal Information</h3>
              <p className="text-sm text-slate-500">Update your profile details.</p>
            </div>
          </div>

          <div className="mb-6 border-b border-slate-100 pb-6">
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-medium text-slate-700">Profile Image</label>
            </div>

            <div className="flex items-center gap-6">
              {/* Avatar Box */}
              <div 
                className="flex h-24 w-24 shrink-0 items-center justify-center border border-slate-200 bg-slate-50 shadow-sm overflow-hidden p-1"
                style={{ borderRadius: 'var(--radius-card, 0.75rem)' }}
              >
                {displayAvatarUrl ? (
                  <img src={displayAvatarUrl} alt="Avatar" className="h-full w-full object-cover" style={{ borderRadius: 'calc(var(--radius-card, 0.75rem) - 4px)' }} />
                ) : (
                  <UserAvatar 
                    name={user?.fullName || user?.name || 'Admin'} 
                    className="h-full w-full rounded-none bg-transparent" 
                    fallbackSize={40} 
                  />
                )}
              </div>

              {/* Input Row and Desc */}
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div 
                    className="flex-1 flex items-center h-10 px-3 border border-slate-200 bg-white text-sm text-slate-600 overflow-hidden shadow-sm"
                    style={{ borderRadius: 'var(--radius-input, 0.5rem)' }}
                  >
                    <span className="truncate">
                      {displayAvatarUrl ? (pendingFile?.name || pendingFile?.originalName || 'avatar.png') : 'Choose file...'}
                    </span>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center justify-center border border-slate-200 bg-white h-10 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm shrink-0"
                    style={{ borderRadius: 'var(--radius-button, 0.5rem)' }}
                  >
                    <Image size={16} className="mr-2" />
                    Choose file
                  </button>

                  {displayAvatarUrl && (
                    <button
                      type="button"
                      onClick={handleDeleteAvatar}
                      className="inline-flex items-center justify-center border border-slate-200 bg-white h-10 w-10 text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors shadow-sm shrink-0"
                      style={{ borderRadius: 'var(--radius-button, 0.5rem)' }}
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-500">Upload a profile picture. Recommended size: 250x250px</p>
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <form onSubmit={handleProfileSave} className="space-y-5 flex-1 flex flex-col">
            <div className="grid gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Full Name</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <User size={16} className="text-slate-400" />
                  </div>
                  <Input
                    type="text"
                    name="fullName"
                    defaultValue={user?.fullName || user?.name || 'System Admin'}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Email Address</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Mail size={16} className="text-slate-400" />
                  </div>
                  <Input
                    type="email"
                    disabled
                    defaultValue={user?.email || 'admin@webitof.com'}
                    className="pl-10 cursor-not-allowed bg-slate-50 text-slate-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Phone Number</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Phone size={16} className="text-slate-400" />
                  </div>
                  <Input
                    type="tel"
                    name="phone"
                    defaultValue={user?.phone || ''}
                    placeholder="+91 00000 00000"
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Address</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <MapPin size={16} className="text-slate-400" />
                  </div>
                  <Input
                    type="text"
                    name="address"
                    defaultValue={user?.address || ''}
                    placeholder="Your City, State"
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={loading} className="gap-2">
                {loading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                ) : (
                  <Save size={16} />
                )}
                Save Changes
              </Button>
            </div>
          </form>
        </Card>

        {/* Security / Password */}
        <Card className="p-6 shadow-sm h-full flex flex-col">
          <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center bg-orange-50 text-orange-500" style={{ borderRadius: 'var(--radius-button, 0.5rem)' }}>
              <Key size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Security</h3>
              <p className="text-sm text-slate-500">Update your password to keep your account secure.</p>
            </div>
          </div>

          <form onSubmit={handlePasswordSave} className="space-y-5">
            <div className="grid gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Current Password</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">New Password</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Confirm Password</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <Button type="submit" variant="outline">Update Password</Button>
            </div>
          </form>
        </Card>
      </div>

    </div>
  );
}
