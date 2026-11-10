import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from './Input';
import { cn } from '../../lib/cn';

// Password field with a show/hide eye button. Takes the same props as Input.
export const PasswordInput = forwardRef(function PasswordInput({ className = '', disabled, ...props }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative w-full">
      <Input
        ref={ref}
        {...props}
        disabled={disabled}
        type={visible ? 'text' : 'password'}
        className={cn('pr-10', className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
        className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--text-muted)] transition hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)] disabled:pointer-events-none disabled:opacity-50"
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
});
