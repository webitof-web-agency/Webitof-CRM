import { Card } from './Card';
import { cn } from '../../lib/cn';

export function StatCard({
  title,
  value,
  helper,
  icon: Icon,
  trend,
  tone = 'default',
  className = '',
  sparkline
}) {
  return (
    <Card
      className={cn(
        'relative overflow-hidden flex min-h-[145px] flex-col justify-between p-5 sm:p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl cursor-default',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
            {title}
          </p>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
            {value}
          </div>
        </div>
        {Icon ? (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-gradient-to-b from-[#0077ED]/15 to-[#0071E3]/5 dark:from-[#0071E3]/25 dark:to-[#0071E3]/10 text-[#0071E3] dark:text-[#2997FF] border border-[#0071E3]/25 dark:border-[#0071E3]/35 shadow-xs">
            <Icon size={20} strokeWidth={2.2} />
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 text-xs">
        <span className="text-slate-500 dark:text-slate-400 truncate font-medium">{helper}</span>
        {trend ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-bold shrink-0 text-[11px] shadow-2xs backdrop-blur-md',
              tone === 'positive' || tone === 'success'
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                : tone === 'negative' || tone === 'danger'
                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30'
                : 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/25'
            )}
          >
            {trend}
          </span>
        ) : null}
      </div>

      {sparkline ? (
        <div className="absolute inset-x-0 bottom-0 h-10 opacity-30 pointer-events-none">
          {sparkline}
        </div>
      ) : null}
    </Card>
  );
}
