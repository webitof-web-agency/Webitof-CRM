import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

const variants = {
  primary:
    'bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:scale-[0.98] text-white shadow-md shadow-[var(--primary)]/25 border border-white/20 focus-visible:ring-[var(--primary)]',
  secondary:
    'bg-white/70 dark:bg-white/[0.08] hover:bg-white/95 dark:hover:bg-white/[0.14] text-slate-800 dark:text-slate-100 border border-black/10 dark:border-white/15 active:scale-[0.98] shadow-xs backdrop-blur-md focus-visible:ring-[var(--primary)]',
  outline:
    'bg-white/60 dark:bg-white/[0.05] border border-black/10 dark:border-white/15 text-slate-800 dark:text-slate-100 hover:bg-white/90 dark:hover:bg-white/10 active:scale-[0.98] shadow-xs backdrop-blur-md focus-visible:ring-[var(--primary)]',
  ghost:
    'bg-transparent text-slate-600 dark:text-slate-400 hover:bg-black/[0.05] dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white active:scale-[0.98] focus-visible:ring-[var(--primary)]',
  destructive:
    'bg-gradient-to-r from-rose-500 via-rose-600 to-rose-700 text-white hover:brightness-110 active:scale-[0.98] shadow-md shadow-rose-500/25 border border-white/20 focus-visible:ring-rose-400',
  danger:
    'bg-gradient-to-r from-rose-500 via-rose-600 to-rose-700 text-white hover:brightness-110 active:scale-[0.98] shadow-md shadow-rose-500/25 border border-white/20 focus-visible:ring-rose-400',
  subtle:
    'bg-[var(--primary)]/12 dark:bg-[var(--primary)]/20 hover:bg-[var(--primary)]/20 dark:hover:bg-[var(--primary)]/30 text-[var(--primary)] dark:text-[var(--primary)] border border-[var(--primary)]/25 active:scale-[0.98] focus-visible:ring-[var(--primary)]',
  glass:
    'bg-white/70 dark:bg-white/[0.08] hover:bg-white/95 dark:hover:bg-white/[0.16] border border-white/80 dark:border-white/20 text-slate-900 dark:text-white shadow-xs backdrop-blur-xl active:scale-[0.98] focus-visible:ring-[var(--primary)]'
};

const sizes = {
  xs: 'h-7.5 px-3 text-xs rounded-[10px] gap-1.5 font-semibold',
  sm: 'h-8.5 px-3.5 text-xs font-semibold rounded-[12px] gap-1.5',
  md: 'h-10 px-4 text-xs sm:text-sm font-semibold rounded-[14px] gap-2',
  lg: 'h-11.5 px-5.5 text-sm font-bold rounded-[16px] gap-2.5',
  icon: 'h-9.5 w-9.5 p-0 rounded-[12px] justify-center',
  'icon-sm': 'h-8 w-8 p-0 rounded-[10px] justify-center'
};

export const Button = forwardRef(function Button(
  {
    as: Tag = 'button',
    className = '',
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    children,
    type = 'button',
    ...props
  },
  ref
) {
  const isButton = Tag === 'button';

  return (
    <Tag
      ref={ref}
      type={isButton ? type : undefined}
      disabled={isButton ? disabled || loading : undefined}
      aria-disabled={disabled || loading ? true : undefined}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap outline-none transition-all duration-150 select-none cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface)] disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant] || variants.primary,
        sizes[size] || sizes.md,
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
      ) : null}
      {children}
    </Tag>
  );
});
