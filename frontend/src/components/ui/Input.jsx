import { forwardRef } from 'react';
import { cn } from '../../lib/cn';

const baseInputStyles =
  'w-full rounded-[var(--radius-input,0.625rem)] border border-[var(--input-border,var(--border))] bg-[var(--input-bg,var(--surface))] px-3.5 py-2.5 text-sm text-[var(--text-main)] outline-none transition-all duration-150 placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:bg-[var(--surface)] focus:ring-2 focus:ring-[var(--primary-subtle)] disabled:pointer-events-none disabled:opacity-50 disabled:bg-[var(--surface-2)] shadow-2xs';

export const Input = forwardRef(function Input(
  {
    className = '',
    error = false,
    iconLeft: IconLeft,
    iconRight: IconRight,
    type = 'text',
    ...props
  },
  ref
) {
  if (IconLeft || IconRight) {
    return (
      <div className="relative w-full flex items-center">
        {IconLeft ? (
          <div className="absolute left-3.5 z-10 flex items-center pointer-events-none text-slate-500 dark:text-slate-400">
            <IconLeft size={16} />
          </div>
        ) : null}
        <input
          ref={ref}
          type={type}
          className={cn(
            baseInputStyles,
            IconLeft && 'pl-10',
            IconRight && 'pr-10',
            error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20',
            className
          )}
          {...props}
        />
        {IconRight ? (
          <div className="absolute right-3.5 z-10 flex items-center pointer-events-none text-slate-500 dark:text-slate-400">
            <IconRight size={16} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        baseInputStyles,
        error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20',
        className
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef(function Textarea(
  { className = '', error = false, rows = 3, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        baseInputStyles,
        'min-h-[5rem] resize-y py-2.5',
        error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20',
        className
      )}
      {...props}
    />
  );
});
