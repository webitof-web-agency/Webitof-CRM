import { useState, useEffect } from 'react';

export function AuthLayout({ title, subtitle, children }) {
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
    <div className="relative flex min-h-screen items-center justify-center bg-white overflow-hidden">
      <section className="flex w-full flex-col items-center justify-center px-6 py-10 lg:px-12">
        {logo && (
          <div className="mb-8 flex justify-center">
            <img src={logo} alt="Logo" className="h-28 w-auto max-w-[360px] object-contain drop-shadow-sm" />
          </div>
        )}
        <div className="bg-white border border-border shadow-[0_8px_30px_rgb(0,0,0,0.04)] w-full max-w-lg rounded-[var(--radius-card,1.75rem)] px-7 pt-7 pb-11 md:px-10 md:pt-10 md:pb-16">
          <div className="mb-8">
            <h2 className="text-3xl font-semibold tracking-tight">{title}</h2>
            {subtitle ? <p className="mt-3 text-sm leading-6 text-text-muted">{subtitle}</p> : null}
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}
