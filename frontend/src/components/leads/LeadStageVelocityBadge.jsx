import { useMemo } from 'react';
import { Clock, AlertTriangle, Flame, ShieldAlert, CheckCircle2 } from 'lucide-react';

export function LeadStageVelocityBadge({ lead, timeline = [], className = '' }) {
  const status = lead?.status || 'New';

  const stageDuration = useMemo(() => {
    // Find the latest status change event in timeline if available
    const statusEvent = (timeline || []).find((e) => {
      const kind = String(e.kind || '').toLowerCase();
      const title = String(e.title || '').toLowerCase();
      return kind.includes('status') || title.includes('status') || kind === 'created';
    });

    const timestamp = statusEvent?.createdAt || lead?.updatedAt || lead?.createdAt;
    if (!timestamp) return { days: 0, hours: 0, text: 'Today' };

    const diffMs = Math.max(0, Date.now() - new Date(timestamp).getTime());
    const hours = Math.floor(diffMs / (3600 * 1000));
    const days = Math.floor(hours / 24);

    if (days === 0) {
      return { days: 0, hours, text: hours <= 1 ? 'Just now' : `${hours}h ago` };
    }
    return { days, hours, text: `${days}d in stage` };
  }, [lead?.updatedAt, lead?.createdAt, timeline]);

  // SLA Check: has any call been made?
  const hasFirstContact = useMemo(() => {
    return (timeline || []).some((e) => {
      const kind = String(e.kind || '').toLowerCase();
      const title = String(e.title || '').toLowerCase();
      return kind === 'call' || kind === 'call_logged' || title.includes('call') || kind === 'meeting';
    });
  }, [timeline]);

  // Determine Stale / Alert state based on stage and days
  const alertInfo = useMemo(() => {
    const d = stageDuration.days;

    if (status === 'Won' || status === 'Converted') {
      return { isStale: false, type: 'won', label: 'Won Deal', bg: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' };
    }
    if (status === 'Lost' || status === 'Not Interested') {
      return { isStale: false, type: 'lost', label: 'Archived', bg: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700' };
    }

    if (status === 'New') {
      if (!hasFirstContact) {
        return {
          isStale: d >= 1,
          type: 'sla_pending',
          label: d >= 1 ? `⚠️ ${d}d in New - First Call Pending` : '⚡ First Contact SLA Pending',
          bg: d >= 1 ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800 animate-pulse' : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
        };
      }
      return { isStale: false, type: 'normal', label: `${stageDuration.text}`, bg: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' };
    }

    if (status.includes('Proposal') || status.includes('Quotation')) {
      if (d >= 5) {
        return { isStale: true, type: 'stale_proposal', label: `⚠️ ${d}d since Proposal (Follow-up due)`, bg: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800' };
      }
    }

    if (status.includes('Negotiation')) {
      if (d >= 7) {
        return { isStale: true, type: 'stale_deal', label: `🔥 ${d}d in Negotiation (High Stale Risk)`, bg: 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800' };
      }
    }

    if (d >= 7) {
      return { isStale: true, type: 'stale_general', label: `⚠️ ${d}d in current stage`, bg: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' };
    }

    return {
      isStale: false,
      type: 'normal',
      label: `⏱️ ${stageDuration.text}`,
      bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
    };
  }, [status, stageDuration, hasFirstContact]);

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${alertInfo.bg} ${className}`}>
      {alertInfo.type === 'sla_pending' ? (
        <Flame size={13} className="text-rose-500 shrink-0" />
      ) : alertInfo.isStale ? (
        <AlertTriangle size={13} className="text-amber-500 shrink-0" />
      ) : alertInfo.type === 'won' ? (
        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
      ) : (
        <Clock size={13} className="text-slate-400 shrink-0" />
      )}
      <span>{alertInfo.label}</span>
    </div>
  );
}
