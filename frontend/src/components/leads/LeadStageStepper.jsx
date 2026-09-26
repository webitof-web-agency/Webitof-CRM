import React, { useMemo } from 'react';
import { Check, Clock, ChevronRight, Trophy, XCircle, ArrowRight } from 'lucide-react';
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
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
      {/* Header Info: Stage Name & Duration */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-muted)] pb-3 mb-3.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Lead Journey & Stage
          </span>
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-bold',
              isWon
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                : isLost
                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25'
                  : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25'
            )}
          >
            {normalizedCurrent}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <Clock size={12} className="shrink-0 text-[var(--text-muted)]" />
          <span>
            In <strong className="font-semibold text-[var(--text-main)]">{normalizedCurrent}</strong> for{' '}
            <strong className="font-semibold text-[var(--text-main)]">
              {daysInStage} day{daysInStage === 1 ? '' : 's'}
            </strong>
          </span>
        </div>
      </div>

      {/* Stepper Progress Bar */}
      <div className="relative">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
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
                  'group relative flex flex-col items-center justify-center rounded-xl p-2.5 text-center transition-all cursor-pointer border select-none',
                  isCurrent &&
                    'border-blue-500/40 bg-gradient-to-b from-blue-500/10 to-blue-500/5 shadow-xs ring-2 ring-blue-500/20',
                  isCompleted &&
                    'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/50',
                  isFuture &&
                    'border-[var(--border-muted)] bg-[var(--surface-2)]/40 hover:bg-[var(--surface-2)] hover:border-[var(--border)] opacity-75 hover:opacity-100',
                  isLost &&
                    'border-[var(--border-muted)] bg-[var(--surface-2)]/30 opacity-50'
                )}
                title={isCurrent ? 'Current stage' : `Advance to ${stage}`}
              >
                {/* Step indicator node */}
                <div
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-transform group-hover:scale-105 mb-1.5',
                    isCurrent && 'bg-blue-600 text-white shadow-2xs',
                    isCompleted && 'bg-emerald-600 text-white shadow-2xs',
                    isFuture && 'bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)]',
                    isLost && 'bg-gray-200 dark:bg-gray-800 text-gray-400'
                  )}
                >
                  {isCompleted ? <Check size={13} strokeWidth={3} /> : index + 1}
                </div>

                <span
                  className={cn(
                    'text-[11px] font-bold truncate max-w-full leading-tight',
                    isCurrent && 'text-blue-600 dark:text-blue-400',
                    isCompleted && 'text-emerald-700 dark:text-emerald-300',
                    isFuture && 'text-[var(--text-muted)] group-hover:text-[var(--text-main)]',
                    isLost && 'text-gray-400'
                  )}
                >
                  {stage}
                </span>

                {isCurrent && (
                  <span className="mt-1 h-1 w-4 rounded-full bg-blue-500 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        {/* If Lost Warning Flag */}
        {isLost && (
          <div className="mt-3 flex items-center justify-between rounded-lg bg-rose-500/10 border border-rose-500/25 p-2.5 text-xs text-rose-700 dark:text-rose-300">
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
