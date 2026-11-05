import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' };

// Lets the signed-in user change their own password. Used by the profile panel.
export function ChangePasswordForm() {
  const { token } = useAuth();
  const [values, setValues] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const set = (key) => (event) => setValues((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (values.newPassword.length < 8) return toast.error('New password must be at least 8 characters long');
    if (values.newPassword !== values.confirmPassword) return toast.error('New password and confirmation do not match');
    setSaving(true);
    try {
      await api.auth.changePassword(token, values);
      toast.success('Password changed');
      setValues(EMPTY);
    } catch (error) {
      toast.error(error.message || 'Could not change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-4 p-6">
      <div>
        <h3 className="text-sm font-bold text-[var(--text-main)]">Change password</h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Use at least 8 characters.</p>
      </div>
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold text-[var(--text-muted)]">Current password</span>
        <Input type="password" autoComplete="current-password" value={values.currentPassword} onChange={set('currentPassword')} required />
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold text-[var(--text-muted)]">New password</span>
        <Input type="password" autoComplete="new-password" value={values.newPassword} onChange={set('newPassword')} required minLength={8} />
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold text-[var(--text-muted)]">Confirm new password</span>
        <Input type="password" autoComplete="new-password" value={values.confirmPassword} onChange={set('confirmPassword')} required minLength={8} />
      </label>
      <Button type="submit" size="sm" loading={saving}>Change password</Button>
    </form>
  );
}
