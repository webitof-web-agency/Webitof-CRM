import { Button } from './Button';
import { Search } from 'lucide-react';
import { cn } from '../../lib/cn';

export function EmptyState({
  title = 'No records found',
  description = 'There are no items to display at this moment.',
  actionLabel,
  onAction,
  icon: CustomIcon,
  className = ''
}) {
  const Icon = CustomIcon || Search;

  return (
    <div
      className={cn(
        'flex min-h-[360px] flex-col items-center justify-center rounded-[var(--radius-card,1.25rem)] bg-[var(--surface)] border border-[var(--border)] px-6 py-12 text-center relative overflow-hidden transition-all',
        className
      )}
    >
      {/* Ambient background dots */}
      <div
        className="absolute inset-0 z-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at center, var(--text-muted) 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      />

      {/* Modern Glass Illustration */}
      <div className="relative z-10 mb-5 flex items-center justify-center animate-fade-scale">
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-[var(--primary-subtle)] text-[var(--primary)] border border-[color-mix(in_srgb,var(--primary)_20%,transparent)] shadow-sm">
          <Icon size={32} strokeWidth={1.8} />
          <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface)] border border-[var(--border)] shadow-xs">
            <span className="h-2 w-2 rounded-full bg-[var(--primary)] animate-pulse-subtle" />
          </div>
        </div>
      </div>

      <h3 className="relative z-10 text-base font-bold text-[var(--text-main)]">{title}</h3>
      {description ? (
        <p className="relative z-10 mt-1 max-w-sm text-xs leading-relaxed text-[var(--text-muted)]">
          {description}
        </p>
      ) : null}

      {actionLabel && onAction ? (
        <Button className="relative z-10 mt-5" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
