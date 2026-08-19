import { useState, useEffect } from 'react';
import { ThemeSwitcher } from './ThemeSwitcher';
import { ShieldCheck, Lock } from 'lucide-react';

export function AuthLayout({
  title,
  subtitle,
  badge = 'iOS 26 Liquid Edition',
  isAuthenticating = false,
  children
}) {
  const [logo, setLogo] = useState(null);

  useEffect(() => {
    const loadLogos = () => {
      try {
        const raw = window.localStorage.getItem('webitof-logos');
        if (raw) setLogo(JSON.parse(raw).primary);
      } catch (e) {}
    };
    loadLogos();
    window.addEventListener('logos-updated', loadLogos);
    return () => window.removeEventListener('logos-updated', loadLogos);
  }, []);

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between items-center bg-[#f4f7fb] dark:bg-[#07090e] text-slate-900 dark:text-[#f5f5f7] transition-colors duration-300 overflow-x-hidden p-4 sm:p-6 md:p-8 font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','Plus_Jakarta_Sans',sans-serif] selection:bg-blue-500/25 selection:text-blue-600 dark:selection:text-blue-300">
      {/* ===================================================================== */}
      {/* iOS 26 / visionOS VIBRANT LIQUID AURORA BACKDROP                       */}
      {/* ===================================================================== */}
      {/* Top Left Sapphire / Electric Blue */}
      <div className="absolute -top-32 -left-32 h-[520px] w-[520px] rounded-full bg-gradient-to-tr from-[#0071E3] via-[#00C6FF] to-[#0072FF] opacity-25 dark:opacity-30 blur-[130px] pointer-events-none animate-pulse-subtle" />
      
      {/* Bottom Right Purple / Magenta Aurora */}
      <div className="absolute -bottom-32 -right-32 h-[560px] w-[560px] rounded-full bg-gradient-to-bl from-[#7928CA] via-[#FF0080] to-[#6366F1] opacity-20 dark:opacity-25 blur-[140px] pointer-events-none" />
      
      {/* Top Right Coral / Gold Warmth */}
      <div className="absolute -top-20 -right-20 h-[420px] w-[420px] rounded-full bg-gradient-to-br from-[#FF453A] via-[#FF9F0A] to-[#FF375F] opacity-15 dark:opacity-20 blur-[120px] pointer-events-none" />
      
      {/* Center Cyan Liquid Orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-gradient-to-r from-[#00F2FE] via-[#4FACFE] to-[#0071E3] opacity-15 dark:opacity-15 blur-[150px] pointer-events-none" />

      {/* ===================================================================== */}
      {/* TOP FLOATING THEME SWITCHER CAPSULE                                   */}
      {/* ===================================================================== */}
      <header className="relative z-20 flex w-full max-w-4xl items-center justify-end py-1">
        {/* Theme Switcher Glass Capsule */}
        <div className="liquid-glass-pill px-2.5 py-1.5 rounded-full flex items-center gap-2 shadow-sm">
          <ThemeSwitcher />
        </div>
      </header>

      {/* ===================================================================== */}
      {/* CENTER: iOS 26 LIQUID GLASS CARD                                      */}
      {/* ===================================================================== */}
      <main className="relative z-20 my-auto flex w-full flex-col items-center justify-center py-6">
        <div className="w-full max-w-[430px]">
          {/* Liquid Glass Container */}
          <div className="liquid-glass-card relative rounded-[32px] overflow-hidden transition-all duration-300 animate-fade-scale">
            {/* Top Specular Light Reflection */}
            <div className={`absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/90 dark:via-white/35 to-transparent transition-opacity duration-300 ${isAuthenticating ? 'opacity-100' : 'opacity-70'}`} />

            {/* Card Body Container */}
            <div className="p-7 sm:p-9">
              {/* 3D Liquid Glass App Icon */}
              <div className="mb-6 flex flex-col items-center justify-center text-center">
                <div className="relative mb-3.5 flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-b from-[#0077ED] via-[#0071E3] to-[#005bb5] text-white font-black text-2xl shadow-xl shadow-blue-500/35 border border-white/40 ring-4 ring-blue-500/15 transition-transform duration-300">
                  {isAuthenticating && (
                    <div className="absolute inset-0 rounded-[22px] ring-4 ring-cyan-400/80 animate-biometric-radar pointer-events-none" />
                  )}
                  <span className="drop-shadow-md">W</span>
                  <div className="absolute inset-0 rounded-[22px] bg-gradient-to-tr from-white/30 via-transparent to-transparent pointer-events-none" />
                </div>

                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed max-w-[320px]">
                    {subtitle}
                  </p>
                ) : null}
              </div>

              {/* Form Content */}
              {children}
            </div>
          </div>
        </div>
      </main>

      {/* ===================================================================== */}
      {/* FOOTER: CLEAN FLOATING GLASS CAPSULE FOOTER                           */}
      {/* ===================================================================== */}
      <footer className="relative z-20 flex w-full max-w-4xl items-center justify-center py-2">
        <div className="liquid-glass-pill flex items-center gap-3 px-6 py-2 rounded-full text-xs text-slate-700 dark:text-slate-300 shadow-sm">
          <span>&copy; {new Date().getFullYear()} Webitof Inc.</span>
          <span>•</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-[#30d158]">
            <ShieldCheck size={13} />
            256-Bit Encrypted
          </span>
        </div>
      </footer>
    </div>
  );
}
