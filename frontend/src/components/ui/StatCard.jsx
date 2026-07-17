import { Card } from './Card';

export function StatCard({ title, value, helper, icon: Icon, trend, tone = 'default' }) {
  return (
    <Card className="flex min-h-[150px] flex-col justify-between">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-muted)]">{title}</p>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)]">{value}</div>
        </div>
        {Icon ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-[var(--accent)]">
            <Icon size={20} />
          </div>
        ) : null}
      </div>
      <div className="mt-6 flex items-center justify-between text-sm">
        <span className="text-[var(--text-muted)]">{helper}</span>
        {trend ? (
          <span
            className={
              tone === 'positive'
                ? 'font-medium text-emerald-300'
                : tone === 'negative'
                  ? 'font-medium text-rose-300'
                  : 'font-medium text-[var(--accent)]'
            }
          >
            {trend}
          </span>
        ) : null}
      </div>
    </Card>
  );
}
