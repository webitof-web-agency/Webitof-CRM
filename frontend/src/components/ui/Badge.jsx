import { cn } from '../../lib/cn';

const tones = {
  neutral:
    'bg-slate-500/12 text-slate-700 dark:text-slate-300 border-slate-500/20 backdrop-blur-md',
  success:
    'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 backdrop-blur-md',
  warning:
    'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30 backdrop-blur-md',
  danger:
    'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 backdrop-blur-md',
  info:
    'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30 backdrop-blur-md',
  primary:
    'bg-[var(--primary)]/15 text-[var(--primary)] dark:text-[var(--primary)] border-[var(--primary)]/30 backdrop-blur-md',
  purple:
    'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 backdrop-blur-md',
  cyan:
    'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30 backdrop-blur-md'
};

const dotColors = {
  neutral: 'bg-slate-400 dark:bg-slate-400',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-sky-500',
  primary: 'bg-[var(--primary)]',
  purple: 'bg-purple-500',
  cyan: 'bg-cyan-500'
};

export function Badge({
  className = '',
  tone = 'neutral',
  size = 'sm',
  dot = false,
  children,
  ...props
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors select-none',
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-xs',
        tones[tone] || tones.neutral,
        className
      )}
      {...props}
    >
      {dot ? (
        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotColors[tone] || dotColors.neutral)} />
      ) : null}
      {children}
    </span>
  );
}
