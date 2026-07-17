import { Monitor, MoonStar, Palette, SunMedium } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/cn';

export function ThemeSwitcher() {
  const { theme, mode, themes, setTheme, toggleMode } = useTheme();

  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1">
      {themes.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => setTheme(item.key)}
          className={cn(
            'rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition',
            theme === item.key ? 'bg-white/10 text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          )}
          style={{ borderColor: item.accent }}
          title={item.label}
        >
          <span className="inline-flex items-center gap-1.5">
            <Palette size={12} style={{ color: item.accent }} />
            {item.label}
          </span>
        </button>
      ))}
      <button
        type="button"
        onClick={toggleMode}
        className="rounded-full p-2 text-[var(--text-muted)] transition hover:bg-white/10 hover:text-[var(--text)]"
        title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {mode === 'dark' ? <SunMedium size={16} /> : <MoonStar size={16} />}
      </button>
    </div>
  );
}
