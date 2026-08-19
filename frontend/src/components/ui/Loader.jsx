import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

export function Loader({ className, text = 'Loading...', size = 'md' }) {
  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-8 w-8'
  };

  return (
    <div className={cn('inline-flex items-center justify-center gap-2.5 text-xs font-medium text-[var(--text-muted)]', className)}>
      <Loader2 className={cn('animate-spin text-[var(--primary)] shrink-0', iconSizes[size] || iconSizes.md)} />
      {text ? <span>{text}</span> : null}
    </div>
  );
}

export function PageLoader({ message = 'Loading workspace...' }) {
  return (
    <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3 px-4 py-12 animate-fade-scale">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface)] border border-[var(--border-glass)] shadow-[var(--shadow-card)] backdrop-blur-md">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
      <p className="text-xs font-medium text-[var(--text-muted)]">{message}</p>
    </div>
  );
}
