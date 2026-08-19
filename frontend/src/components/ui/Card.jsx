import { cn } from '../../lib/cn';

const cardVariants = {
  default:
    'liquid-glass-card border border-white/80 dark:border-white/10 shadow-[var(--shadow-card)]',
  glass:
    'liquid-glass-card border border-white/90 dark:border-white/15 shadow-[var(--shadow-glass)]',
  elevated:
    'liquid-glass-card border border-white/90 dark:border-white/15 shadow-[var(--shadow-float)]',
  flat:
    'bg-white/60 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.06] shadow-none backdrop-blur-md',
  interactive:
    'liquid-glass-card border border-white/80 dark:border-white/10 shadow-[var(--shadow-card)] glass-card-interactive cursor-pointer hover:border-[#0071E3]/40 dark:hover:border-[#2997FF]/40'
};

export function Card({
  as: Tag = 'section',
  variant = 'default',
  className = '',
  ...props
}) {
  return (
    <Tag
      className={cn(
        'relative rounded-[22px] p-5 sm:p-6 transition-all duration-200 backdrop-blur-xl',
        'before:absolute before:inset-x-0 before:top-0 before:h-[1px] before:bg-gradient-to-r before:from-transparent before:via-white/90 dark:before:via-white/20 before:to-transparent before:pointer-events-none',
        cardVariants[variant] || cardVariants.default,
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className = '', ...props }) {
  return (
    <div
      className={cn('mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3', className)}
      {...props}
    />
  );
}

export function CardTitle({ as: Tag = 'h3', className = '', ...props }) {
  return (
    <Tag
      className={cn('text-base font-semibold tracking-tight text-[var(--text-main)]', className)}
      {...props}
    />
  );
}

export function CardDescription({ className = '', ...props }) {
  return (
    <p
      className={cn('mt-1 text-xs text-[var(--text-muted)] leading-relaxed', className)}
      {...props}
    />
  );
}

export function CardBody({ className = '', ...props }) {
  return (
    <div
      className={cn('text-sm text-[var(--text-muted)]', className)}
      {...props}
    />
  );
}

export function CardFooter({ className = '', ...props }) {
  return (
    <div
      className={cn('mt-5 flex items-center justify-between border-t border-[var(--border)] pt-4', className)}
      {...props}
    />
  );
}
