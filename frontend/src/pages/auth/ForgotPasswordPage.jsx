import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Send, Mail } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { useAuth } from '../../context/AuthContext';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { forgotPassword } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!identifier.trim()) {
      toast.error('Please enter your email or username');
      return;
    }
    setBusy(true);
    try {
      await forgotPassword(identifier);
      toast.success('OTP sent to registered email');
      navigate(`/reset-password?identifier=${encodeURIComponent(identifier)}`);
    } catch (error) {
      toast.error(error.message || 'Unable to send OTP');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      badge="iOS 26 Recovery"
      title="Reset Password"
      subtitle="Enter your registered email or username to receive a security OTP."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
            Email or Username
          </label>
          <Input
            iconLeft={Mail}
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="admin@webitof.com"
            autoFocus
            required
            className="liquid-glass-input h-11 rounded-[16px] text-sm text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#86868b] dark:placeholder:text-[#6e6e73] focus:border-[#0071E3] dark:focus:border-[#00C6FF] focus:ring-4 focus:ring-[#0071E3]/20 transition-all duration-200"
          />
        </div>

        <Button
          type="submit"
          className="w-full h-11.5 text-sm font-bold rounded-[16px] bg-gradient-to-r from-[#0077ED] via-[#0071E3] to-[#005bb5] hover:brightness-110 active:scale-[0.98] text-white shadow-xl shadow-blue-600/30 border border-white/30 transition-all duration-200 mt-2 cursor-pointer"
          loading={busy}
        >
          <span>Send Verification OTP</span>
          <Send size={15} />
        </Button>

        <div className="text-center pt-2">
          <Link
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0071E3] dark:text-[#2997FF] hover:underline transition-colors"
            to="/login"
          >
            <ArrowLeft size={14} />
            Back to login
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
