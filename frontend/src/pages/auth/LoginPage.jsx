import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  KeyRound,
  Check,
  Send,
  CheckCircle2,
  X,
  Sparkles
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { useAuth } from '../../context/AuthContext';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, forgotPassword, resetPassword } = useAuth();

  // Login Form States
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [rememberMe, setRememberMe] = useState(true);
  const [loginStatus, setLoginStatus] = useState('idle'); // 'idle' | 'authenticating' | 'success'
  const [showPassword, setShowPassword] = useState(false);

  // Forgot Password Modal States
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState('request'); // 'request' | 'verify'
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [resetForm, setResetForm] = useState({
    otp: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [modalBusy, setModalBusy] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  function openForgotModal() {
    setForgotIdentifier(form.identifier || '');
    setModalStep('request');
    setIsForgotModalOpen(true);
  }

  function closeForgotModal() {
    setIsForgotModalOpen(false);
  }

  // Handle Escape key to close modal
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isForgotModalOpen) {
        closeForgotModal();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isForgotModalOpen]);

  // 1. Submit Login
  async function handleLoginSubmit(event) {
    event.preventDefault();
    if (!form.identifier.trim() || !form.password) {
      toast.error('Please enter your email and password');
      return;
    }
    setLoginStatus('authenticating');
    try {
      await login(form.identifier, form.password);
      setLoginStatus('success');
      setTimeout(() => {
        navigate('/app/dashboard', { replace: true });
      }, 450);
    } catch (error) {
      setLoginStatus('idle');
      toast.error(error.message || 'Unable to login');
    }
  }

  // 2. Submit Forgot Password (Request OTP)
  async function handleForgotSubmit(event) {
    event?.preventDefault();
    if (!forgotIdentifier.trim()) {
      toast.error('Please enter your email or username');
      return;
    }
    setModalBusy(true);
    try {
      await forgotPassword(forgotIdentifier);
      toast.success('Verification OTP sent to registered email');
      setModalStep('verify');
    } catch (error) {
      toast.error(error.message || 'Unable to send OTP');
    } finally {
      setModalBusy(false);
    }
  }

  // 3. Submit Reset Password (Verify OTP & Update Password)
  async function handleResetSubmit(event) {
    event.preventDefault();
    if (!resetForm.otp.trim() || !resetForm.newPassword) {
      toast.error('Please enter the OTP and your new password');
      return;
    }
    if (resetForm.newPassword !== resetForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setModalBusy(true);
    try {
      await resetPassword(
        forgotIdentifier,
        resetForm.otp,
        resetForm.newPassword,
        resetForm.confirmPassword
      );
      toast.success('Password updated successfully! You can now log in.');
      setForm((prev) => ({ ...prev, identifier: forgotIdentifier, password: '' }));
      closeForgotModal();
    } catch (error) {
      toast.error(error.message || 'Unable to reset password');
    } finally {
      setModalBusy(false);
    }
  }

  return (
    <>
      <AuthLayout
        badge="iOS 26 Liquid Edition"
        title="Sign In"
        subtitle="Authenticate with your Webitof ID to access your workspace."
        isAuthenticating={loginStatus === 'authenticating'}
      >
        <form className="space-y-3.5" onSubmit={handleLoginSubmit}>
          {/* Email or Username */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
              Email or Username
            </label>
            <div className="relative">
              <Input
                iconLeft={Mail}
                value={form.identifier}
                onChange={(event) =>
                  setForm((current) => ({ ...current, identifier: event.target.value }))
                }
                placeholder="Email"
                autoComplete="username"
                autoFocus
                disabled={loginStatus !== 'idle'}
                required
                className="liquid-glass-input h-10.5 rounded-[14px] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/20 transition-all duration-200"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
                Password
              </label>
              <button
                type="button"
                onClick={openForgotModal}
                disabled={loginStatus !== 'idle'}
                className="text-xs font-semibold text-[var(--primary)] hover:underline transition-colors cursor-pointer disabled:opacity-50"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative flex items-center">
              <Input
                iconLeft={Lock}
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({ ...current, password: event.target.value }))
                }
                placeholder="Password"
                autoComplete="current-password"
                disabled={loginStatus !== 'idle'}
                className="liquid-glass-input h-10.5 pr-10 rounded-[14px] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/20 transition-all duration-200"
                required
              />
              <button
                type="button"
                disabled={loginStatus !== 'idle'}
                className="absolute right-3 z-10 flex items-center justify-center p-1.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/10 transition-all cursor-pointer disabled:opacity-50"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <div className="flex items-center justify-between pt-0.5">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <button
                type="button"
                disabled={loginStatus !== 'idle'}
                onClick={() => setRememberMe(!rememberMe)}
                className={`h-4.5 w-4.5 rounded-[7px] border flex items-center justify-center transition-all duration-150 ${
                  rememberMe
                    ? 'bg-[var(--primary)] border-[var(--primary)] text-white shadow-md shadow-[var(--primary)]/30'
                    : 'border-slate-300 dark:border-white/[0.2] bg-white/70 dark:bg-white/5'
                }`}
              >
                {rememberMe ? <Check size={12} strokeWidth={3} /> : null}
              </button>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">
                Remember me
              </span>
            </label>
          </div>

          {/* Submit CTA Button with Dynamic Shimmer & Biometric State */}
          <button
            type="submit"
            disabled={loginStatus !== 'idle'}
            className={`w-full h-11 text-sm font-bold rounded-[14px] transition-all duration-300 flex items-center justify-center gap-2 group mt-2.5 cursor-pointer select-none ${
              loginStatus === 'success'
                ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white shadow-xl shadow-emerald-500/30 border border-emerald-300/40 scale-[1.01]'
                : loginStatus === 'authenticating'
                ? 'liquid-shimmer-btn bg-gradient-to-r from-[var(--primary)] via-[#64d2ff] to-[var(--primary)] text-white shadow-xl shadow-[var(--primary)]/40 border border-white/40 cursor-wait'
                : 'bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:scale-[0.98] text-white shadow-xl shadow-[var(--primary)]/30 border border-white/30'
            }`}
          >
            {loginStatus === 'authenticating' ? (
              <div className="flex items-center justify-center gap-2.5">
                <span className="relative flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-300 opacity-80"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 border-2 border-white border-t-transparent animate-spin"></span>
                </span>
                <span className="tracking-wide">Unlocking Workspace...</span>
              </div>
            ) : loginStatus === 'success' ? (
              <div className="flex items-center justify-center gap-2 animate-fade-in">
                <CheckCircle2 size={18} className="text-white animate-pulse" />
                <span>Access Granted</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <span>Sign In to Workspace</span>
                <ArrowRight
                  size={16}
                  className="transition-transform duration-200 group-hover:translate-x-1"
                />
              </div>
            )}
          </button>

          {/* Trust Badges Bar */}
          <div className="pt-3 mt-1.5 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-center gap-4 text-[11px] text-slate-600 dark:text-slate-400 font-medium">
            <div className="flex items-center gap-1">
              <KeyRound size={12} className="text-[var(--primary)]" />
              <span>Encrypted Session</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1">
              <ShieldCheck size={12} className="text-emerald-600 dark:text-[#30d158]" />
              <span>Role RBAC</span>
            </div>
          </div>
        </form>
      </AuthLayout>

      {/* =================================================================== */}
      {/* iOS 26 LIQUID GLASS FORGOT PASSWORD MODAL POPUP                     */}
      {/* =================================================================== */}
      {isForgotModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 dark:bg-black/70 backdrop-blur-md animate-fade-in"
          onClick={closeForgotModal}
        >
          <div
            className="liquid-glass-card animate-glass-modal relative w-full max-w-[430px] rounded-[30px] overflow-hidden p-6 sm:p-8 shadow-2xl border border-white/80 dark:border-white/15"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Specular Light Highlight */}
            <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/90 dark:via-white/40 to-transparent" />

            {/* Modal Header */}
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[var(--primary)] text-white shadow-md shadow-[var(--primary)]/30 border border-white/40">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                    {modalStep === 'request' ? 'Reset Password' : 'Verify & Set Password'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {modalStep === 'request'
                      ? 'We will send a 6-digit OTP code to your email.'
                      : 'Enter the code and choose your new password.'}
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={closeForgotModal}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-black/[0.05] dark:bg-white/10 hover:scale-105 transition-all cursor-pointer"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Step 1: Request OTP Form */}
            {modalStep === 'request' ? (
              <form className="space-y-4" onSubmit={handleForgotSubmit}>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
                    Registered Email or Username
                  </label>
                  <Input
                    iconLeft={Mail}
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    placeholder="admin@webitof.com"
                    autoFocus
                    required
                    className="liquid-glass-input h-11 rounded-[16px] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/20"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeForgotModal}
                    className="w-1/3 h-11 text-xs font-semibold rounded-[14px] text-slate-700 dark:text-slate-300 hover:bg-black/[0.05] dark:hover:bg-white/10 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <Button
                    type="submit"
                    className="w-2/3 h-11 text-xs font-bold rounded-[14px] bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:scale-[0.98] text-white shadow-lg shadow-[var(--primary)]/30 border border-white/30 transition-all cursor-pointer"
                    loading={modalBusy}
                  >
                    <span>Send OTP</span>
                    <Send size={14} />
                  </Button>
                </div>
              </form>
            ) : (
              /* Step 2: Verify OTP & Set Password Form */
              <form className="space-y-3.5" onSubmit={handleResetSubmit}>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
                    6-Digit OTP Code
                  </label>
                  <Input
                    iconLeft={KeyRound}
                    value={resetForm.otp}
                    onChange={(e) =>
                      setResetForm((prev) => ({ ...prev, otp: e.target.value }))
                    }
                    placeholder="123456"
                    autoFocus
                    required
                    className="liquid-glass-input h-10.5 rounded-[14px] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/20 font-mono tracking-widest"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
                    New Password
                  </label>
                  <div className="relative flex items-center">
                    <Input
                      iconLeft={Lock}
                      type={showResetPassword ? 'text' : 'password'}
                      value={resetForm.newPassword}
                      onChange={(e) =>
                        setResetForm((prev) => ({ ...prev, newPassword: e.target.value }))
                      }
                      placeholder="••••••••••••"
                      required
                      className="liquid-glass-input h-10.5 pr-10 rounded-[14px] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/20"
                    />
                    <button
                      type="button"
                      className="absolute right-3 z-10 flex items-center justify-center p-1.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/10 transition-all cursor-pointer"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      aria-label={showResetPassword ? 'Hide password' : 'Show password'}
                    >
                      {showResetPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
                    Confirm Password
                  </label>
                  <Input
                    iconLeft={Lock}
                    type={showResetPassword ? 'text' : 'password'}
                    value={resetForm.confirmPassword}
                    onChange={(e) =>
                      setResetForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                    }
                    placeholder="••••••••••••"
                    required
                    className="liquid-glass-input h-10.5 rounded-[14px] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/20"
                  />
                </div>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setModalStep('request')}
                    className="text-xs font-semibold text-[var(--primary)] hover:underline cursor-pointer"
                  >
                    Change Email
                  </button>
                  <button
                    type="button"
                    onClick={() => handleForgotSubmit()}
                    className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:underline cursor-pointer"
                  >
                    Resend OTP
                  </button>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 text-xs font-bold rounded-[14px] bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:scale-[0.98] text-white shadow-lg shadow-[var(--primary)]/30 border border-white/30 transition-all mt-2 cursor-pointer"
                  loading={modalBusy}
                >
                  <span>Update Password</span>
                  <CheckCircle2 size={15} />
                </Button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
