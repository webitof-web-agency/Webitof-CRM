import { Button } from './Button';

export function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-white/10 bg-white/[0.03] px-6 py-12 text-center">
      <h3 className="text-lg font-semibold text-[var(--text)]">{title}</h3>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-muted)]">{description}</p>
      {actionLabel ? (
        <Button className="mt-6" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
