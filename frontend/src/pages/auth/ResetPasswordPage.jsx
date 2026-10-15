import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, Lock, Mail, KeyRound, Eye, EyeOff } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { useAuth } from '../../context/AuthContext';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { resetPassword } = useAuth();
  const [form, setForm] = useState({
    identifier: params.get('identifier') || '',
    otp: '',
    password: '',
    confirmPassword: ''
  });
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const identifier = params.get('identifier') || '';
    if (identifier) {
      setForm((current) => ({ ...current, identifier }));
    }
  }, [params]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.otp || !form.password) {
      toast.error('Please enter the OTP and your new password');
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      await resetPassword(form.identifier, form.otp, form.password, form.confirmPassword);
      toast.success('Password updated successfully');
      navigate('/login');
    } catch (error) {
      toast.error(error.message || 'Unable to reset password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      badge="iOS 26 Security"
      title="Create New Password"
      subtitle="Enter the OTP sent to your registered email and choose a strong password."
    >
      <form className="space-y-3.5" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label className="block text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
            Email or Username
          </label>
          <Input
            iconLeft={Mail}
            value={form.identifier}
            onChange={(event) =>
              setForm((current) => ({ ...current, identifier: event.target.value }))
            }
            required
            className="liquid-glass-input h-10.5 rounded-[14px] text-sm text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#86868b] dark:placeholder:text-[#6e6e73] focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/20"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
            6-Digit OTP Code
          </label>
          <Input
            iconLeft={KeyRound}
            value={form.otp}
            onChange={(event) => setForm((current) => ({ ...current, otp: event.target.value }))}
            placeholder="123456"
            autoFocus
            required
            className="liquid-glass-input h-10.5 rounded-[14px] text-sm text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#86868b] dark:placeholder:text-[#6e6e73] focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/20 font-mono tracking-widest"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
            New Password
          </label>
          <div className="relative flex items-center">
            <Input
              iconLeft={Lock}
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({ ...current, password: event.target.value }))
              }
              placeholder="••••••••••••"
              required
              className="liquid-glass-input h-10.5 pr-10 rounded-[14px] text-sm text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#86868b] dark:placeholder:text-[#6e6e73] focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/20"
            />
            <button
              type="button"
              className="absolute right-3 z-10 flex items-center justify-center p-1.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/10 transition-all cursor-pointer"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
            Confirm New Password
          </label>
          <Input
            iconLeft={Lock}
            type={showPassword ? 'text' : 'password'}
            value={form.confirmPassword}
            onChange={(event) =>
              setForm((current) => ({ ...current, confirmPassword: event.target.value }))
            }
            placeholder="••••••••••••"
            required
            className="liquid-glass-input h-10.5 rounded-[14px] text-sm text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#86868b] dark:placeholder:text-[#6e6e73] focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/20"
          />
        </div>

        <Button
          type="submit"
          className="w-full h-11.5 text-sm font-bold rounded-[16px] bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:scale-[0.98] text-white shadow-xl shadow-[var(--primary)]/30 border border-white/30 transition-all duration-200 mt-2 cursor-pointer"
          loading={busy}
        >
          <span>Save New Password</span>
          <CheckCircle2 size={16} />
        </Button>

        <div className="flex items-center justify-between pt-2 text-xs">
          <Link
            className="inline-flex items-center gap-1 font-semibold text-[var(--primary)] hover:underline transition-colors"
            to="/login"
          >
            <ArrowLeft size={13} />
            Back to login
          </Link>
          <Link
            className="text-[#86868b] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] hover:underline transition-colors"
            to="/forgot-password"
          >
            Resend OTP
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
