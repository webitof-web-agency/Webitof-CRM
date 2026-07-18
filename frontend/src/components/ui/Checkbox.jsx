import { cn } from '../../lib/cn';

export function Checkbox({ className = '', ...props }) {
  return (
    <input
      type="checkbox"
      className={cn(
        'h-4 w-4 rounded border-slate-300 bg-white/10 outline-none transition',
        className
      )}
      style={{ accentColor: 'var(--primary)' }}
      {...props}
    />
  );
}
