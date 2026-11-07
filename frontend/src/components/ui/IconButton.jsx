import { forwardRef } from 'react';
import { cn } from '../../lib/cn';

// Quiet icon-only action (edit, delete, view, close...). Hover tints use theme tokens and alpha
// colours so they read correctly in both light and dark mode.
//
//  - size "sm" | "md": padding-based (grows with the icon).
//  - box "6" | "7" | "7.5" | "8" | "9" | "9.5" | "10": fixed square instead (toolbar and close buttons).
//  - shape "rounded" | "full"; variant "ghost" | "outline".
//  - Extra classes (for example absolute positioning inside an input) go in className.
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

// Full class names so Tailwind can see them.
const boxes = {
  6: 'h-6 w-6',
  7: 'h-7 w-7',
  '7.5': 'h-7.5 w-7.5',
  8: 'h-8 w-8',
  9: 'h-9 w-9',
  '9.5': 'h-9.5 w-9.5',
  10: 'h-10 w-10'
};

const variants = {
  ghost: '',
  outline:
    'border border-[var(--border)] bg-[var(--surface)] shadow-2xs hover:border-[var(--border-hover)]'
};

export const IconButton = forwardRef(function IconButton(
  {
    tone = 'neutral',
    size = 'md',
    box,
    shape = 'rounded',
    variant = 'ghost',
    className = '',
    title,
    'aria-label': ariaLabel,
    type = 'button',
    children,
    ...props
  },
  ref
) {
  const square = box != null ? boxes[String(box)] : null;
  const rounding = shape === 'full' ? 'rounded-full' : square ? 'rounded-lg' : (sizes[size] || sizes.md).split(' ')[1];
  const padding = square ? 'p-0' : (sizes[size] || sizes.md).split(' ')[0];
  return (
    <button
      ref={ref}
      type={type}
      title={title}
      aria-label={ariaLabel ?? title}
      className={cn(
        'inline-flex shrink-0 items-center justify-center text-[var(--text-muted)] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:pointer-events-none disabled:opacity-50',
        square || padding,
        rounding,
        variants[variant] || variants.ghost,
        tones[tone] || tones.neutral,
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
