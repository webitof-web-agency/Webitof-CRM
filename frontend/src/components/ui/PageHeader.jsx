import { Button } from './Button';
import { cn } from '../../lib/cn';

export function PageHeader({
  title,
  description,
  actions = [],
  eyebrow,
  meta,
  children,
  className = ''
}) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[var(--text-main)] truncate">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
            {description}
          </p>
        ) : null}
        {meta ? <div className="mt-2 text-xs text-[var(--text-muted)]">{meta}</div> : null}
      </div>

      {(actions.length > 0 || children) && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant || 'primary'}
              size={action.size || 'sm'}
              onClick={action.onClick}
              loading={action.loading}
              disabled={action.disabled}
            >
              {action.icon ? <action.icon size={15} /> : null}
              {action.label}
            </Button>
          ))}
          {children}
        </div>
      )}
    </div>
  );
}
