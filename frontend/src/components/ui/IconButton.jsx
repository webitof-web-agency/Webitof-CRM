import { forwardRef } from 'react';
import { cn } from '../../lib/cn';

// Quiet icon-only action (edit, delete, view...). Hover tints use theme tokens and alpha
// colours so they read correctly in both light and dark mode.
const tones = {
  neutral: 'hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)]',
  primary: 'hover:bg-[var(--primary)]/10 hover:text-[var(--primary)]',
  danger: 'hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400',
  success: 'hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400'
};

const sizes = {
  sm: 'p-1.5 rounded-md',
  md: 'p-2 rounded-lg'
};

export const IconButton = forwardRef(function IconButton(
  { tone = 'neutral', size = 'md', className = '', title, 'aria-label': ariaLabel, type = 'button', children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      title={title}
      aria-label={ariaLabel ?? title}
      className={cn(
        'inline-flex shrink-0 items-center justify-center text-[var(--text-muted)] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:pointer-events-none disabled:opacity-50',
        sizes[size] || sizes.md,
        tones[tone] || tones.neutral,
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
