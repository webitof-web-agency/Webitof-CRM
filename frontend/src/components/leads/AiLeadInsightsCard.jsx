import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Zap,
  TrendingUp,
  AlertCircle,
  PhoneCall,
  Mic,
  Volume2,
  Play,
  Pause,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  MessageSquare,
  Mail,
  FileText,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/cn';
import { Button } from '../ui/Button';
import { analyzeLeadIntelligence } from '../../utils/aiLeadAnalyzer';

export function AiLeadInsightsCard({
  lead,
  primaryContact,
  events = [],
  timeline = [],
  onLogCall,
  onScheduleFollowUp,
  onAddQuotation
}) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeReplyTab, setActiveReplyTab] = useState('whatsapp'); // 'whatsapp' | 'email' | 'urgent'
  const [copied, setCopied] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Compute analysis dynamically
  const intelligence = useMemo(() => {
    return analyzeLeadIntelligence({
      lead,
      primaryContact,
      events,
      timeline
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead, primaryContact, events, timeline, refreshKey]);

  const {
    score,
    scoreBreakdown,
    intentBadge,
    callSentiment,
    callSentimentScore,
    latestCall,
    hasRecording,
    callsWithRecordings,
    executiveSummary,
    keyOpportunity,
    keyRisk,
    recommendedAction,
    smartReplies
  } = intelligence;

  // Audio recording reference
  const recordingCall = callsWithRecordings[0] || (latestCall?.recordingUrl ? latestCall : null);
  const recordingUrl = recordingCall?.recordingUrl || '';

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setRefreshKey((k) => k + 1);
      setIsRefreshing(false);
      toast.success('AI Insights refreshed with latest lead and conversation context');
    }, 600);
  };

  const currentReplyText = useMemo(() => {
    if (activeReplyTab === 'whatsapp') return smartReplies.whatsapp;
    if (activeReplyTab === 'email') return `${smartReplies.email.subject}\n\n${smartReplies.email.body}`;
    return smartReplies.urgent;
  }, [activeReplyTab, smartReplies]);

  const handleCopyReply = async () => {
    try {
      await navigator.clipboard.writeText(currentReplyText);
      setCopied(true);
      toast.success('AI reply copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleSendWhatsApp = () => {
    const phoneNum = lead.phone || primaryContact?.phone || '';
    const rawDigits = String(phoneNum).replace(/\D/g, '');
    const validNumber = rawDigits.startsWith('91') || rawDigits.length > 10 ? rawDigits : `91${rawDigits}`;
    const textToSend = activeReplyTab === 'whatsapp' ? smartReplies.whatsapp : smartReplies.urgent;
    const url = `https://wa.me/${validNumber}?text=${encodeURIComponent(textToSend)}`;
    window.open(url, '_blank');
  };

  const handleSendEmail = () => {
    const emailAddr = lead.email || primaryContact?.email || '';
    const subject = encodeURIComponent(smartReplies.email.subject);
    const body = encodeURIComponent(smartReplies.email.body);
    const url = `mailto:${emailAddr}?subject=${subject}&body=${body}`;
    window.location.href = url;
  };

  // SVG circular gauge calculations
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const scoreColorClass =
    score >= 75
      ? 'text-emerald-500 stroke-emerald-500'
      : score >= 50
        ? 'text-amber-500 stroke-amber-500'
        : 'text-rose-500 stroke-rose-500';

  return (
    <div className="overflow-hidden rounded-xl border border-violet-500/20 bg-[var(--surface)] shadow-sm transition-all hover:border-violet-500/35 dark:border-violet-500/25">
      {/* Top Gradient Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-muted)] bg-gradient-to-r from-violet-500/10 via-indigo-500/5 to-transparent px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-500 text-white shadow-xs">
            <Sparkles size={14} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">
                AI Lead Insights
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-600 dark:text-violet-400 border border-violet-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-ping" />
                Live AI
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Re-analyze lead"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className={cn(isRefreshing && 'animate-spin text-violet-500')} />
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse' : 'Expand'}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Primary Score & Intent Section */}
      <div className="p-4 bg-gradient-to-b from-[var(--surface)] to-[var(--surface-2)]/40 border-b border-[var(--border-muted)]">
        <div className="flex items-center gap-3.5">
          {/* Circular Score Gauge */}
          <div className="relative flex h-18 w-18 shrink-0 items-center justify-center">
            <svg className="h-18 w-18 -rotate-90 transform" viewBox="0 0 80 80">
              <circle
                cx="40"
                cy="40"
                r={radius}
                className="stroke-[var(--border)]"
                strokeWidth="7"
                fill="transparent"
              />
              <circle
                cx="40"
                cy="40"
                r={radius}
                className={cn('transition-all duration-1000 ease-out', scoreColorClass)}
                strokeWidth="7"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-lg font-black tracking-tight text-[var(--text-main)] leading-none">
                {score}
              </span>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] tracking-wider uppercase mt-0.5">
                Score
              </span>
            </div>
          </div>

          {/* Intent & Key Tags */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide border shadow-2xs',
                  intentBadge.color === 'emerald' &&
                    'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
                  intentBadge.color === 'amber' &&
                    'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400',
                  intentBadge.color === 'rose' &&
                    'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400'
                )}
              >
                <Zap size={11} className="shrink-0 fill-current" />
                {intentBadge.text}
              </span>
            </div>

            <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">
              Synthesized from requirements, confirmed budget, decision-maker status & call logs.
            </p>
          </div>
        </div>

        {/* Breakdown Badges */}
        <div className="grid grid-cols-2 gap-1.5 mt-3 pt-3 border-t border-[var(--border-muted)]/70">
          <div className="flex items-center justify-between rounded-lg bg-[var(--surface)] px-2.5 py-1.5 border border-[var(--border-muted)] text-[11px]">
            <span className="text-[var(--text-muted)]">Budget Fit</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {lead.budgetConfirmed ? '✓ Confirmed' : lead.estimatedBudget ? 'Estimated' : 'TBD'}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-[var(--surface)] px-2.5 py-1.5 border border-[var(--border-muted)] text-[11px]">
            <span className="text-[var(--text-muted)]">Authority</span>
            <span className="font-semibold text-[var(--text-main)]">
              {primaryContact?.jobTitle || (lead.contactIsDecisionMaker ? 'Decision Maker' : 'Verified')}
            </span>
          </div>
        </div>
      </div>

      {/* Expandable Deep Dive Sections */}
      {isExpanded && (
        <div className="p-4 space-y-4 text-xs">
          {/* AI Executive Summary */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5 font-bold uppercase tracking-wider text-[11px] text-[var(--text-main)]">
              <Sparkles size={13} className="text-violet-500" />
              <span>Executive Synthesis</span>
            </div>
            <div className="rounded-lg bg-violet-500/5 border border-violet-500/20 p-3 leading-relaxed text-[var(--text-main)]">
              {executiveSummary}
            </div>

            {/* Quick Opportunity & Risk Pill */}
            <div className="mt-2 space-y-1.5">
              <div className="flex items-start gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
                <span>
                  <strong className="font-semibold text-[var(--text-main)]">Opportunity:</strong> {keyOpportunity}
                </span>
              </div>
              {keyRisk && (
                <div className="flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" />
                  <span>
                    <strong className="font-semibold text-[var(--text-main)]">Action Note:</strong> {keyRisk}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Call Recording & Conversation Intelligence */}
          <div className="pt-2 border-t border-[var(--border-muted)]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-[var(--text-main)]">
                <Mic size={13} className="text-indigo-500" />
                <span>Call & Recording Intel</span>
              </div>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                Sentiment: {callSentiment}
              </span>
            </div>

            {hasRecording && recordingUrl ? (
              <div className="rounded-lg bg-[var(--surface-2)] border border-[var(--border)] p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <Volume2 size={12} />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-[var(--text-main)]">
                        Call Audio Recording
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        {recordingCall?.callDuration ? `${Math.round(recordingCall.callDuration / 60)}m duration` : 'Logged recording'} • {recordingCall?.callOutcome || 'Connected'}
                      </p>
                    </div>
                  </div>
                  <a
                    href={recordingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Open <ExternalLink size={10} />
                  </a>
                </div>

                {/* HTML5 Audio Player Preview */}
                <audio
                  controls
                  className="w-full h-7 rounded-md accent-violet-600"
                  src={recordingUrl}
                  preload="metadata"
                >
                  Your browser does not support audio playback.
                </audio>

                {recordingCall?.notes && (
                  <p className="text-[11px] text-[var(--text-muted)] italic border-t border-[var(--border-muted)] pt-1.5 line-clamp-2">
                    &ldquo;{recordingCall.notes}&rdquo;
                  </p>
                )}
              </div>
            ) : latestCall ? (
              <div className="rounded-lg bg-[var(--surface-2)]/60 border border-[var(--border-muted)] p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--text-main)]">
                    {latestCall.callType} Call ({latestCall.callOutcome})
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {latestCall.callDuration ? `${latestCall.callDuration}s` : 'Logged'}
                  </span>
                </div>
                {latestCall.notes ? (
                  <p className="text-[11px] text-[var(--text-muted)] italic line-clamp-2">
                    &ldquo;{latestCall.notes}&rdquo;
                  </p>
                ) : (
                  <p className="text-[10px] text-[var(--text-muted)]">
                    No recording link attached to this call log.
                  </p>
                )}
                {onLogCall && (
                  <button
                    type="button"
                    onClick={onLogCall}
                    className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 hover:underline pt-0.5 inline-block cursor-pointer"
                  >
                    + Log New Call with Recording URL
                  </button>
                )}
              </div>
            ) : (
              <div className="rounded-lg bg-[var(--surface-2)]/40 border border-dashed border-[var(--border-muted)] p-2.5 text-center">
                <p className="text-[11px] text-[var(--text-muted)]">
                  No call recordings logged yet.
                </p>
                {onLogCall && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onLogCall}
                    className="mt-1.5 h-6 text-[11px] px-2.5 text-violet-600 dark:text-violet-400"
                  >
                    <PhoneCall size={11} className="mr-1" /> Log Discovery Call
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Recommended Next Action */}
          <div className="pt-2 border-t border-[var(--border-muted)]">
            <div className="flex items-center gap-1.5 mb-1.5 font-bold uppercase tracking-wider text-[11px] text-[var(--text-main)]">
              <Zap size={13} className="text-amber-500" />
              <span>Recommended Next Action</span>
            </div>
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 p-3 space-y-2">
              <p className="font-bold text-[var(--text-main)] text-xs">
                {recommendedAction.title}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                {recommendedAction.reason}
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {onScheduleFollowUp && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onScheduleFollowUp}
                    className="h-7 text-[11px] px-2.5 bg-[var(--surface)] hover:bg-[var(--surface-2)]"
                  >
                    <Calendar size={12} className="mr-1 text-amber-500" /> Schedule Demo
                  </Button>
                )}
                {onAddQuotation && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onAddQuotation}
                    className="h-7 text-[11px] px-2.5 bg-[var(--surface)] hover:bg-[var(--surface-2)]"
                  >
                    <FileText size={12} className="mr-1 text-indigo-500" /> Prepare Quotation
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* AI Smart Suggested Reply */}
          <div className="pt-2 border-t border-[var(--border-muted)] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-[var(--text-main)]">
                <MessageSquare size={13} className="text-violet-500" />
                <span>AI Suggested Reply</span>
              </div>
              {/* Mode Tabs */}
              <div className="flex items-center rounded-lg bg-[var(--surface-2)] p-0.5 border border-[var(--border-muted)] text-[10px]">
                <button
                  type="button"
                  onClick={() => setActiveReplyTab('whatsapp')}
                  className={cn(
                    'px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer',
                    activeReplyTab === 'whatsapp'
                      ? 'bg-[var(--surface)] text-[var(--text-main)] shadow-2xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  )}
                >
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => setActiveReplyTab('email')}
                  className={cn(
                    'px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer',
                    activeReplyTab === 'email'
                      ? 'bg-[var(--surface)] text-[var(--text-main)] shadow-2xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  )}
                >
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => setActiveReplyTab('urgent')}
                  className={cn(
                    'px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer',
                    activeReplyTab === 'urgent'
                      ? 'bg-[var(--surface)] text-[var(--text-main)] shadow-2xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  )}
                >
                  Closing
                </button>
              </div>
            </div>

            {/* Reply Content Box */}
            <div className="relative rounded-lg bg-[var(--surface-2)] border border-[var(--border)] p-3 text-[11px] text-[var(--text-main)] leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto font-sans">
              {currentReplyText}
            </div>

            {/* Reply Action Buttons */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyReply}
                className="h-7.5 text-[11px] px-2 bg-[var(--surface)]"
              >
                {copied ? <Check size={12} className="mr-1 text-emerald-500" /> : <Copy size={12} className="mr-1" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleSendWhatsApp}
                className="h-7.5 text-[11px] px-2 bg-emerald-500/10 hover:bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
              >
                <MessageSquare size={12} className="mr-1" /> WhatsApp
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleSendEmail}
                className="h-7.5 text-[11px] px-2 bg-blue-500/10 hover:bg-blue-500/15 border-blue-500/30 text-blue-600 dark:text-blue-400"
              >
                <Mail size={12} className="mr-1" /> Email
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default AiLeadInsightsCard;
