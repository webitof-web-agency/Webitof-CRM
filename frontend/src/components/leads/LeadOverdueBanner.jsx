import React, { useMemo } from 'react';
import { AlertTriangle, Clock, Phone, MessageSquare, CalendarPlus, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/cn';

export function LeadOverdueBanner({
  lead = {},
  reminders = [],
  onCall,
  onWhatsApp,
  onReschedule,
  onComplete
}) {
  const followUpInfo = useMemo(() => {
    // 1. Check direct followUpDate on lead
    let targetDate = lead.followUpDate ? String(lead.followUpDate).trim() : null;
    let targetTime = lead.nextFollowUpTime || '';
    let targetMode = lead.followUpMode || 'Call';
    let targetPriority = lead.followUpPriority || 'High';
    let targetItem = null;

    // 2. Or earliest uncompleted reminder from reminders list
    if (Array.isArray(reminders) && reminders.length > 0) {
      const activeReminders = reminders.filter(
        (r) => !['completed', 'auto-closed', 'cancelled'].includes(String(r.status || '').toLowerCase())
      );
      if (activeReminders.length > 0) {
        // Sort earliest first
        const sorted = [...activeReminders].sort(
          (a, b) => new Date(a.date || a.startDate || 0).getTime() - new Date(b.date || b.startDate || 0).getTime()
        );
        const earliest = sorted[0];
        targetDate = earliest.date || earliest.startDate || targetDate;
        targetTime = earliest.startTime || targetTime;
        targetPriority = earliest.priority || targetPriority;
        targetItem = earliest;
      }
    }

    if (!targetDate) return null;

    // Calculate days difference
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const [y, m, d] = targetDate.split('-').map(Number);
    if (!y || !m || !d) return null;
    const scheduledDate = new Date(y, m - 1, d);

    const diffTime = scheduledDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        status: 'overdue',
        days: Math.abs(diffDays),
        date: targetDate,
        time: targetTime,
        mode: targetMode,
        priority: targetPriority,
        item: targetItem
      };
    }

    if (diffDays === 0) {
      return {
        status: 'today',
        days: 0,
        date: targetDate,
        time: targetTime,
        mode: targetMode,
        priority: targetPriority,
        item: targetItem
      };
    }

    return null;
  }, [lead.followUpDate, lead.nextFollowUpTime, lead.followUpMode, lead.followUpPriority, reminders]);

  if (!followUpInfo) return null;

  const isOverdue = followUpInfo.status === 'overdue';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border p-4 shadow-sm transition-all',
        isOverdue
          ? 'border-rose-500/40 bg-gradient-to-r from-rose-500/15 via-rose-500/10 to-[var(--surface)] dark:from-rose-950/40 dark:via-rose-900/20'
          : 'border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-[var(--surface)] dark:from-amber-950/40 dark:via-amber-900/20'
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left Side: Alert Badge & Details */}
        <div className="flex items-start gap-3.5 min-w-0">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-xs',
              isOverdue
                ? 'bg-rose-500 text-white animate-pulse'
                : 'bg-amber-500 text-white'
            )}
          >
            {isOverdue ? <AlertTriangle size={20} /> : <Clock size={20} />}
          </div>

          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider',
                  isOverdue
                    ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                    : 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                )}
              >
                {isOverdue
                  ? `⚠️ Follow-up Overdue by ${followUpInfo.days} Day${followUpInfo.days > 1 ? 's' : ''}`
                  : '⏰ Follow-up Due Today'}
              </span>

              {followUpInfo.priority && (
                <span className="rounded-md bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)] border border-[var(--border-muted)]">
                  {followUpInfo.priority} Priority
                </span>
              )}
            </div>

            <p className="text-xs text-[var(--text-main)] font-medium pt-0.5">
              Scheduled date:{' '}
              <strong className="font-semibold text-[var(--text-main)]">{followUpInfo.date}</strong>
              {followUpInfo.time ? ` at ${followUpInfo.time}` : ''}
              {followUpInfo.mode ? ` (${followUpInfo.mode})` : ''}
              {lead.followUpNote ? ` • "${lead.followUpNote}"` : ''}
            </p>
          </div>
        </div>

        {/* Right Side: Quick Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {onCall && (
            <Button
              size="sm"
              onClick={onCall}
              className="h-8 text-xs px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
            >
              <Phone size={13} className="mr-1.5" /> Call Now
            </Button>
          )}

          {onWhatsApp && (
            <Button
              size="sm"
              variant="outline"
              onClick={onWhatsApp}
              className="h-8 text-xs px-2.5 rounded-lg border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 cursor-pointer"
            >
              <MessageSquare size={13} className="mr-1" /> WhatsApp
            </Button>
          )}

          {onReschedule && (
            <Button
              size="sm"
              variant="outline"
              onClick={onReschedule}
              className="h-8 text-xs px-2.5 rounded-lg border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)] text-[var(--text-main)] cursor-pointer"
            >
              <CalendarPlus size={13} className="mr-1 text-amber-500" /> Reschedule
            </Button>
          )}

          {onComplete && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onComplete(followUpInfo.item)}
              className="h-8 text-xs px-2 rounded-lg text-[var(--text-muted)] hover:text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
              title="Mark follow-up completed"
            >
              <CheckCircle2 size={15} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
export default LeadOverdueBanner;
