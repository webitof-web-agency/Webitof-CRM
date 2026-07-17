import { Button } from './Button';

export function PageHeader({ title, description, actions = [], eyebrow, meta }) {
  return (
    <div className="flex flex-col gap-5 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.2)] md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">{eyebrow}</p> : null}
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--text)] md:text-4xl">{title}</h1>
        {description ? <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-muted)]">{description}</p> : null}
        {meta ? <div className="mt-4 text-sm text-[var(--text-muted)]">{meta}</div> : null}
      </div>
      {actions.length ? (
        <div className="flex flex-wrap items-center gap-3">
          {actions.map((action) => (
            <Button key={action.label} variant={action.variant || 'primary'} size={action.size || 'md'} onClick={action.onClick}>
              {action.icon ? <action.icon size={16} /> : null}
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
