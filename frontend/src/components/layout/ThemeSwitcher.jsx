import { Laptop, Moon, Sun, Palette } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/cn';

export function ThemeSwitcher({ showPresets = false }) {
  const { theme, mode, themes, setTheme, setMode } = useTheme();

  return (
    <div className="flex items-center gap-2">
      {/* Light / Dark / System Segmented Switcher */}
      <div className="inline-flex items-center p-0.5 rounded-full border border-[var(--border)] bg-[var(--surface-2)] shadow-2xs">
        <button
          type="button"
          onClick={() => setMode('light')}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full transition-all duration-150 cursor-pointer',
            mode === 'light'
              ? 'bg-[var(--surface)] text-[var(--primary)] shadow-2xs'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          )}
          title="Light mode"
          aria-label="Light mode"
        >
          <Sun size={14} strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() => setMode('dark')}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full transition-all duration-150 cursor-pointer',
            mode === 'dark'
              ? 'bg-[var(--surface)] text-[var(--primary)] shadow-2xs'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          )}
          title="Dark mode"
          aria-label="Dark mode"
        >
          <Moon size={14} strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() => setMode('system')}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full transition-all duration-150 cursor-pointer',
            mode === 'system'
              ? 'bg-[var(--surface)] text-[var(--primary)] shadow-2xs'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          )}
          title="System preference"
          aria-label="System preference"
        >
          <Laptop size={14} strokeWidth={2} />
        </button>
      </div>

      {/* Preset Accent Color Buttons */}
      {showPresets ? (
        <div className="hidden sm:flex items-center gap-1 pl-1">
          {themes.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTheme(item.key)}
              className={cn(
                'h-5 w-5 rounded-full transition-transform duration-150 cursor-pointer border-2',
                theme === item.key ? 'scale-115 border-white dark:border-slate-900 ring-2 ring-[var(--primary)]' : 'border-transparent opacity-75 hover:opacity-100'
              )}
              style={{ backgroundColor: item.accent }}
              title={item.label}
              aria-label={`Select ${item.label} accent color`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
