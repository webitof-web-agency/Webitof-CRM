import { forwardRef } from 'react';
import { cn } from '../../lib/cn';

// Selectable filter / choice chip. One look for "on" and "off" everywhere; `tone` only picks the
// accent used when active (use it for meaning, e.g. emerald for WhatsApp).
const ACTIVE = {
  primary: 'border-[var(--primary)] bg-[var(--primary)] text-white shadow-xs',
  emerald: 'border-emerald-600 bg-emerald-600 text-white shadow-xs',
  blue: 'border-blue-600 bg-blue-600 text-white shadow-xs',
  amber: 'border-amber-600 bg-amber-600 text-white shadow-xs',
  rose: 'border-rose-600 bg-rose-600 text-white shadow-xs',
  violet: 'border-violet-600 bg-violet-600 text-white shadow-xs'
};

const INACTIVE =
  'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--border-hover)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)]';

const SIZES = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-1.5 text-xs'
};

const SHAPES = {
  pill: 'rounded-full',
  rounded: 'rounded-lg'
};

export const Chip = forwardRef(function Chip(
  { active = false, tone = 'primary', shape = 'pill', size = 'md', className = '', type = 'button', children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={active}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap border font-semibold transition-colors cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:pointer-events-none disabled:opacity-50',
        SHAPES[shape] || SHAPES.pill,
        SIZES[size] || SIZES.md,
        active ? ACTIVE[tone] || ACTIVE.primary : INACTIVE,
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
