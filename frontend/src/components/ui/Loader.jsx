import { cn } from '../../lib/cn';

export function Loader({ className, text = 'Loading...' }) {
  return (
    <div className={cn('flex items-center justify-center text-sm text-[var(--text-muted)]', className)}>
      {text}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4 py-12">
      <Loader text="Loading..." />
    </div>
  );
}
