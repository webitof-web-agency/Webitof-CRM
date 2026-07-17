import { cn } from '../../lib/cn';

export function Checkbox({ className = '', ...props }) {
  return (
    <input
      type="checkbox"
      className={cn(
        'h-4 w-4 rounded border-white/20 bg-white/10 text-[var(--accent)] outline-none transition focus:ring-2 focus:ring-[color:color-mix(in srgb, var(--accent) 35%, transparent)]',
        className
      )}
      {...props}
    />
  );
}
