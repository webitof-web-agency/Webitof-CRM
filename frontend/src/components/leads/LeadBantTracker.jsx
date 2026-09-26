import React, { useMemo } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  UserCheck,
  FileCheck,
  Calendar,
  Sparkles
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

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
      {/* Top Header & Progress */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-muted)] pb-4 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400">
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[var(--text-main)]">Deal Qualification (BANT Tracker)</h3>
              <span className="rounded-md bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-600 dark:text-violet-400 border border-violet-500/20">
                {verifiedCount} / 4 Pillars Verified
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Verify Budget, Authority, Need, and Timeline to ensure high sales closure probability
            </p>
          </div>
        </div>

        {/* Progress Bar Display */}
        <div className="flex items-center gap-3 w-full sm:w-48 shrink-0">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)] border border-[var(--border-muted)]">
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

      {/* 4 BANT Pillars Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Pillar 1: Budget */}
        <div
          className={cn(
            'flex flex-col justify-between rounded-xl border p-3.5 transition-all',
            isBudgetConfirmed
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : 'border-[var(--border-muted)] bg-[var(--surface-2)]/40'
          )}
        >
          <div>
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                <DollarSign size={12} className="text-emerald-500" /> [B] Budget
              </span>
              {isBudgetConfirmed ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={11} /> Confirmed
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  <AlertCircle size={11} /> Unconfirmed
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-[var(--text-main)] truncate" title={formattedBudget}>
              {formattedBudget}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
              {lead.billingType || 'Standard Billing'}
            </p>
          </div>

          {canWrite && (
            <button
              type="button"
              onClick={() => onUpdateMeta && onUpdateMeta({ budgetConfirmed: !isBudgetConfirmed })}
              className="mt-3 text-[10px] font-semibold text-[var(--primary)] hover:underline text-left cursor-pointer"
            >
              {isBudgetConfirmed ? 'Unmark Confirmed' : '✓ Mark Budget Confirmed'}
            </button>
          )}
        </div>

        {/* Pillar 2: Authority */}
        <div
          className={cn(
            'flex flex-col justify-between rounded-xl border p-3.5 transition-all',
            isAuthorityConfirmed
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : 'border-[var(--border-muted)] bg-[var(--surface-2)]/40'
          )}
        >
          <div>
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                <UserCheck size={12} className="text-blue-500" /> [A] Authority
              </span>
              {isAuthorityConfirmed ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={11} /> Decision Maker
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  <AlertCircle size={11} /> Unverified
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-[var(--text-main)] truncate" title={contactName}>
              {contactName}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">
              {primaryContact?.jobTitle || (isAuthorityConfirmed ? 'Verified Authority' : 'Role not assigned')}
            </p>
          </div>

          {canWrite && (
            <button
              type="button"
              onClick={() =>
                onUpdateMeta &&
                onUpdateMeta({
                  contactIsDecisionMaker: !isAuthorityConfirmed,
                  decisionMakerIdentified: !isAuthorityConfirmed ? 'Yes' : 'No'
                })
              }
              className="mt-3 text-[10px] font-semibold text-[var(--primary)] hover:underline text-left cursor-pointer"
            >
              {isAuthorityConfirmed ? 'Unmark Authority' : '✓ Verify as Decision Maker'}
            </button>
          )}
        </div>

        {/* Pillar 3: Need */}
        <div
          className={cn(
            'flex flex-col justify-between rounded-xl border p-3.5 transition-all',
            isNeedConfirmed
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : 'border-[var(--border-muted)] bg-[var(--surface-2)]/40'
          )}
        >
          <div>
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                <FileCheck size={12} className="text-indigo-500" /> [N] Need
              </span>
              {isNeedConfirmed ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={11} /> Specified
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  <AlertCircle size={11} /> Pending Scope
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-[var(--text-main)] truncate">
              {Array.isArray(lead.requiredServices) && lead.requiredServices.length > 0
                ? `${lead.requiredServices.length} Service${lead.requiredServices.length > 1 ? 's' : ''}`
                : lead.requirementDescription || lead.notes ? 'Notes Provided' : 'Needs Scoping'}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">
              {Array.isArray(lead.requiredServices) && lead.requiredServices.length > 0
                ? lead.requiredServices.join(', ')
                : lead.notes ? 'General note present' : 'No services tagged'}
            </p>
          </div>

          {canWrite && (
            <button
              type="button"
              onClick={() =>
                onUpdateMeta &&
                onUpdateMeta({
                  needConfirmed: isNeedConfirmed ? 'No' : 'Yes',
                  requirementConfirmed: isNeedConfirmed ? 'No' : 'Yes'
                })
              }
              className="mt-3 text-[10px] font-semibold text-[var(--primary)] hover:underline text-left cursor-pointer"
            >
              {isNeedConfirmed ? 'Unmark Need' : '✓ Confirm Requirement Scope'}
            </button>
          )}
        </div>

        {/* Pillar 4: Timeline */}
        <div
          className={cn(
            'flex flex-col justify-between rounded-xl border p-3.5 transition-all',
            isTimelineConfirmed
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : 'border-[var(--border-muted)] bg-[var(--surface-2)]/40'
          )}
        >
          <div>
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                <Calendar size={12} className="text-amber-500" /> [T] Timeline
              </span>
              {isTimelineConfirmed ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={11} /> Confirmed
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  <AlertCircle size={11} /> Unset
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-[var(--text-main)] truncate">
              {lead.expectedClosingDate || lead.purchaseTimeline || 'Not Disclosed'}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">
              {lead.expectedClosingDate ? `Close target: ${lead.expectedClosingDate}` : 'Target date not set'}
            </p>
          </div>

          {canWrite && (
            <button
              type="button"
              onClick={() =>
                onUpdateMeta &&
                onUpdateMeta({
                  timelineConfirmed: isTimelineConfirmed ? 'No' : 'Yes'
                })
              }
              className="mt-3 text-[10px] font-semibold text-[var(--primary)] hover:underline text-left cursor-pointer"
            >
              {isTimelineConfirmed ? 'Unmark Timeline' : '✓ Confirm Closing Timeline'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
export default LeadBantTracker;
