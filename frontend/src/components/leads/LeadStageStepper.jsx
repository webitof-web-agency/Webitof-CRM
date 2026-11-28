import React, { useMemo } from 'react';
import { Check, Clock, XCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

const DEFAULT_STAGES = [
  'New',
  'Contacted',
  'Requirement Collected',
  'Qualified',
  'Quotation Sent',
  'Won'
];

export function LeadStageStepper({
  currentStatus = 'New',
  createdAt,
  lastStatusChangedAt,
  onChangeStatus,
  disabled = false
}) {
  const normalizedCurrent = String(currentStatus || 'New').trim();
  const isWon = normalizedCurrent.toLowerCase() === 'won';
  const isLost = ['lost', 'not interested', 'invalid lead'].includes(normalizedCurrent.toLowerCase());

  // Find index of current stage in standard sequence
  const currentIndex = useMemo(() => {
    const idx = DEFAULT_STAGES.findIndex(
      (s) => s.toLowerCase() === normalizedCurrent.toLowerCase()
    );
    if (idx !== -1) return idx;
    // Fallback fuzzy match
    if (normalizedCurrent.toLowerCase().includes('requirement')) return 2;
    if (normalizedCurrent.toLowerCase().includes('quotation') || normalizedCurrent.toLowerCase().includes('proposal')) return 4;
    if (normalizedCurrent.toLowerCase().includes('follow')) return 1;
    return 0;
  }, [normalizedCurrent]);

  // Calculate days in current stage
  const daysInStage = useMemo(() => {
    const startDateStr = lastStatusChangedAt || createdAt;
    if (!startDateStr) return 0;
    const start = new Date(startDateStr);
    const now = new Date();
    const diff = Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    return diff;
  }, [createdAt, lastStatusChangedAt]);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-2xs">
      {/* One row: title, the six stages, time in the current stage */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          Lead Journey
        </span>

        <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
          {DEFAULT_STAGES.map((stage, index) => {
            const isCompleted = !isLost && index < currentIndex;
            const isCurrent = !isLost && index === currentIndex;
            const isFuture = !isLost && index > currentIndex;

            return (
              <button
                key={stage}
                type="button"
                disabled={disabled || isCurrent}
                onClick={() => onChangeStatus && onChangeStatus(stage)}
                className={cn(
                  'group flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-left transition-all cursor-pointer select-none',
                  isCurrent &&
                    'border-blue-500/40 bg-blue-500/10 ring-1 ring-blue-500/20',
                  isCompleted &&
                    'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/50',
                  isFuture &&
                    'border-[var(--border-muted)] bg-[var(--surface-2)]/40 hover:bg-[var(--surface-2)] hover:border-[var(--border)] opacity-75 hover:opacity-100',
                  isLost &&
                    'border-[var(--border-muted)] bg-[var(--surface-2)]/30 opacity-50'
                )}
                title={isCurrent ? 'Current stage' : `Move to ${stage}`}
              >
                {/* Step indicator node */}
                <span
                  className={cn(
                    'flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                    isCurrent && 'bg-blue-600 text-white',
                    isCompleted && 'bg-emerald-600 text-white',
                    isFuture && 'bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)]',
                    isLost && 'bg-gray-200 dark:bg-gray-800 text-gray-400'
                  )}
                >
                  {isCompleted ? <Check size={11} strokeWidth={3} /> : index + 1}
                </span>

                <span
                  className={cn(
                    'min-w-0 truncate text-[11px] font-semibold leading-tight',
                    isCurrent && 'font-bold text-blue-600 dark:text-blue-400',
                    isCompleted && 'text-emerald-700 dark:text-emerald-300',
                    isFuture && 'text-[var(--text-muted)] group-hover:text-[var(--text-main)]',
                    isLost && 'text-gray-400'
                  )}
                >
                  {stage}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <Clock size={12} className="shrink-0" />
          <span>
            In{' '}
            <strong
              className={cn(
                'font-semibold',
                isWon ? 'text-emerald-600 dark:text-emerald-400' : isLost ? 'text-rose-600 dark:text-rose-400' : 'text-[var(--text-main)]'
              )}
            >
              {normalizedCurrent}
            </strong>{' '}
            for{' '}
            <strong className="font-semibold text-[var(--text-main)]">
              {daysInStage} day{daysInStage === 1 ? '' : 's'}
            </strong>
          </span>
        </div>
      </div>

      <div>
        {/* If Lost Warning Flag */}
        {isLost && (
          <div className="mt-2 flex items-center justify-between rounded-lg bg-rose-500/10 border border-rose-500/25 px-2.5 py-1.5 text-xs text-rose-700 dark:text-rose-300">
            <div className="flex items-center gap-1.5">
              <XCircle size={14} />
              <span>Lead marked as <strong>{normalizedCurrent}</strong>.</span>
            </div>
            {onChangeStatus && (
              <button
                type="button"
                onClick={() => onChangeStatus('New')}
                className="font-bold underline hover:no-underline cursor-pointer"
              >
                Reopen Lead
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
export default LeadStageStepper;
