import React, { useMemo } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  UserCheck,
  FileCheck,
  Calendar
} from 'lucide-react';
import { cn } from '../../lib/cn';

export function LeadBantTracker({
  lead = {},
  primaryContact = null,
  onUpdateMeta,
  canWrite = true
}) {
  const isBudgetConfirmed = Boolean(
    lead.budgetConfirmed === true ||
    String(lead.budgetConfirmed || '').toLowerCase() === 'true' ||
    String(lead.budgetConfirmed || '').toLowerCase() === 'confirmed' ||
    String(lead.budgetConfirmed || '').toLowerCase() === 'yes'
  );

  const isAuthorityConfirmed = Boolean(
    lead.contactIsDecisionMaker ||
    lead.decisionMakerIdentified === 'Yes' ||
    String(primaryContact?.jobTitle || '').toLowerCase().includes('decision maker') ||
    String(primaryContact?.jobTitle || '').toLowerCase().includes('owner') ||
    String(primaryContact?.jobTitle || '').toLowerCase().includes('founder') ||
    String(primaryContact?.jobTitle || '').toLowerCase().includes('director')
  );

  const isNeedConfirmed = Boolean(
    lead.needConfirmed === 'Yes' ||
    lead.requirementConfirmed === 'Yes' ||
    (Array.isArray(lead.requiredServices) && lead.requiredServices.length > 0)
  );

  const isTimelineConfirmed = Boolean(
    lead.timelineConfirmed === 'Yes' ||
    (lead.expectedClosingDate && String(lead.expectedClosingDate).trim())
  );

  // Calculate overall qualification readiness
  const verifiedCount = [isBudgetConfirmed, isAuthorityConfirmed, isNeedConfirmed, isTimelineConfirmed].filter(Boolean).length;
  const progressPercent = Math.round((verifiedCount / 4) * 100);

  const formattedBudget = (lead.estimatedBudget ?? lead.value)
    ? `${lead.currencySymbol || '₹'}${Number(lead.estimatedBudget ?? lead.value).toLocaleString('en-IN')}`
    : 'Not Specified';

  const contactName = primaryContact
    ? `${primaryContact.firstName || ''} ${primaryContact.lastName || ''}`.trim()
    : lead.contactPerson || 'Contact';

  const services = Array.isArray(lead.requiredServices) ? lead.requiredServices : [];

  const pillars = [
    {
      key: 'budget',
      icon: DollarSign,
      iconClass: 'text-emerald-500',
      label: '[B] Budget',
      done: isBudgetConfirmed,
      doneText: 'Confirmed',
      pendingText: 'Unconfirmed',
      value: formattedBudget,
      detail: lead.billingType || 'Standard Billing',
      actionTitle: isBudgetConfirmed ? 'Unmark budget confirmed' : 'Mark budget confirmed',
      onToggle: () => onUpdateMeta && onUpdateMeta({ budgetConfirmed: !isBudgetConfirmed })
    },
    {
      key: 'authority',
      icon: UserCheck,
      iconClass: 'text-blue-500',
      label: '[A] Authority',
      done: isAuthorityConfirmed,
      doneText: 'Decision Maker',
      pendingText: 'Unverified',
      value: contactName,
      detail: primaryContact?.jobTitle || (isAuthorityConfirmed ? 'Verified Authority' : 'Role not assigned'),
      actionTitle: isAuthorityConfirmed ? 'Unmark authority' : 'Verify as decision maker',
      onToggle: () => onUpdateMeta && onUpdateMeta({
        contactIsDecisionMaker: !isAuthorityConfirmed,
        decisionMakerIdentified: !isAuthorityConfirmed ? 'Yes' : 'No'
      })
    },
    {
      key: 'need',
      icon: FileCheck,
      iconClass: 'text-indigo-500',
      label: '[N] Need',
      done: isNeedConfirmed,
      doneText: 'Specified',
      pendingText: 'Pending Scope',
      value: services.length
        ? `${services.length} Service${services.length > 1 ? 's' : ''}`
        : lead.requirementDescription || lead.notes ? 'Notes Provided' : 'Needs Scoping',
      detail: services.length ? services.join(', ') : lead.notes ? 'General note present' : 'No services tagged',
      actionTitle: isNeedConfirmed ? 'Unmark need' : 'Confirm requirement scope',
      onToggle: () => onUpdateMeta && onUpdateMeta({
        needConfirmed: isNeedConfirmed ? 'No' : 'Yes',
        requirementConfirmed: isNeedConfirmed ? 'No' : 'Yes'
      })
    },
    {
      key: 'timeline',
      icon: Calendar,
      iconClass: 'text-amber-500',
      label: '[T] Timeline',
      done: isTimelineConfirmed,
      doneText: 'Confirmed',
      pendingText: 'Unset',
      value: lead.expectedClosingDate || lead.purchaseTimeline || 'Not Disclosed',
      detail: lead.expectedClosingDate ? `Close target: ${lead.expectedClosingDate}` : 'Target date not set',
      actionTitle: isTimelineConfirmed ? 'Unmark timeline' : 'Confirm closing timeline',
      onToggle: () => onUpdateMeta && onUpdateMeta({ timelineConfirmed: isTimelineConfirmed ? 'No' : 'Yes' })
    }
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-2xs">
      {/* Header: title, pillar count and progress on one line */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[var(--border-muted)] pb-2 mb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400">
            <ShieldCheck size={14} />
          </div>
          <h3
            className="text-sm font-bold text-[var(--text-main)]"
            title="Verify Budget, Authority, Need, and Timeline to ensure high sales closure probability"
          >
            Deal Qualification (BANT)
          </h3>
          <span className="rounded-md bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-600 dark:text-violet-400 border border-violet-500/20">
            {verifiedCount} / 4 Verified
          </span>
        </div>

        {/* Progress Bar Display */}
        <div className="flex items-center gap-2 w-full sm:w-44 shrink-0">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)] border border-[var(--border-muted)]">
            <div
              className={cn(
                'h-full transition-all duration-500',
                progressPercent >= 75
                  ? 'bg-emerald-500'
                  : progressPercent >= 50
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-bold text-[var(--text-main)] shrink-0 w-9 text-right">
            {progressPercent}%
          </span>
        </div>
      </div>

      {/* 4 BANT pillars, two lines each: label + status, then value + detail + action */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {pillars.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <div
              key={pillar.key}
              className={cn(
                'rounded-lg border px-3 py-2 transition-all',
                pillar.done
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-[var(--border-muted)] bg-[var(--surface-2)]/40'
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                  <Icon size={12} className={pillar.iconClass} /> {pillar.label}
                </span>
                {pillar.done ? (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={11} /> {pillar.doneText}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                    <AlertCircle size={11} /> {pillar.pendingText}
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex items-baseline gap-1.5 min-w-0">
                <span className="shrink-0 max-w-[60%] truncate text-sm font-bold text-[var(--text-main)]" title={pillar.value}>
                  {pillar.value}
                </span>
                <span className="min-w-0 flex-1 truncate text-[10px] text-[var(--text-muted)]" title={pillar.detail}>
                  {pillar.detail}
                </span>
                {canWrite ? (
                  <button
                    type="button"
                    onClick={pillar.onToggle}
                    title={pillar.actionTitle}
                    className="shrink-0 text-[10px] font-semibold text-[var(--primary)] hover:underline cursor-pointer"
                  >
                    {pillar.done ? 'Undo' : '✓ Confirm'}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default LeadBantTracker;
