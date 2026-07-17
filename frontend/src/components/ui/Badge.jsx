import { cn } from '../../lib/cn';

const tones = {
  neutral: 'bg-white/10 text-white/80 border-white/10',
  success: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/20',
  warning: 'bg-amber-500/15 text-amber-200 border-amber-400/20',
  danger: 'bg-rose-500/15 text-rose-200 border-rose-400/20',
  info: 'bg-sky-500/15 text-sky-200 border-sky-400/20'
};

export function Badge({ className = '', tone = 'neutral', ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]',
        tones[tone] || tones.neutral,
        className
      )}
      {...props}
    />
  );
}
