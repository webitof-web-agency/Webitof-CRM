import { cn } from '../../lib/cn';

export function Skeleton({ className = '', ...props }) {
  return (
    <div
      className={cn('animate-pulse rounded-lg bg-[var(--surface-3)] opacity-70', className)}
      {...props}
    />
  );
}
