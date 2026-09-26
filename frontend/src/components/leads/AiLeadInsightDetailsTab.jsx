import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Zap,
  TrendingUp,
  AlertCircle,
  PhoneCall,
  Mic,
  Volume2,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  MessageSquare,
  Mail,
  FileText,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  ShieldAlert,
  Flame,
  CheckSquare,
  Clock,
  Send,
  Sliders,
  DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/cn';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { analyzeLeadIntelligence } from '../../utils/aiLeadAnalyzer';

export function AiLeadInsightDetailsTab({
  lead,
  primaryContact,
  events = [],
  timeline = [],
  onLogCall,
  onScheduleFollowUp,
  onAddQuotation
}) {
  const [activeReplyTab, setActiveReplyTab] = useState('whatsapp');
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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

  const recordingCall = callsWithRecordings[0] || (latestCall?.recordingUrl ? latestCall : null);
  const recordingUrl = recordingCall?.recordingUrl || '';

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setRefreshKey((k) => k + 1);
      setIsRefreshing(false);
      toast.success('AI Lead Insights refreshed with latest pipeline context');
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
      toast.success('AI smart pitch copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleSendWhatsApp = () => {
    const phoneNum = lead?.phone || primaryContact?.phone || '';
    const rawDigits = String(phoneNum).replace(/\D/g, '');
    const validNumber = rawDigits.startsWith('91') || rawDigits.length > 10 ? rawDigits : `91${rawDigits}`;
    const textToSend = activeReplyTab === 'whatsapp' ? smartReplies.whatsapp : smartReplies.urgent;
    const url = `https://wa.me/${validNumber}?text=${encodeURIComponent(textToSend)}`;
    window.open(url, '_blank');
  };

  const handleSendEmail = () => {
    const emailAddr = lead?.email || primaryContact?.email || '';
    const subject = encodeURIComponent(smartReplies.email.subject);
    const body = encodeURIComponent(smartReplies.email.body);
    const url = `mailto:${emailAddr}?subject=${subject}&body=${body}`;
    window.location.href = url;
  };

  // Score styling
  const isHot = score >= 75;
  const isWarm = score >= 50 && score < 75;
  const scoreTier = isHot ? 'Hot Lead' : isWarm ? 'Warm Lead' : 'Cold Lead';
  const tierColor = isHot
    ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30'
    : isWarm
    ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30'
    : 'text-slate-600 dark:text-slate-400 bg-slate-500/10 border-slate-500/30';

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* 1. High Impact Hero Intelligence Header */}
      <div className="relative overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-600/10 via-indigo-500/5 to-[var(--surface)] p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Radial Win Gauge */}
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  className="stroke-[var(--border-muted)]/50"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  className={isHot ? 'stroke-rose-500' : isWarm ? 'stroke-amber-500' : 'stroke-slate-500'}
                  strokeWidth="8"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black tracking-tight text-[var(--text-main)]">
                  {score}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Win Score
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-[var(--text-main)]">
                  AI Lead Intelligence & Deal Insights
                </h2>
                <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold border', tierColor)}>
                  {isHot ? <Flame size={12} className="fill-current" /> : <Zap size={12} />}
                  {scoreTier}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2.5 py-0.5 text-xs font-semibold text-violet-600 dark:text-violet-400 border border-violet-500/25">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-ping" />
                  Live Engine
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] max-w-xl leading-relaxed">
                Continuous cognitive evaluation of client requirements, commercial budget confirmation, call transcripts, audio recordings, and stage velocity.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-8 text-xs font-semibold"
            >
              <RefreshCw size={13} className={cn('mr-1.5', isRefreshing && 'animate-spin')} />
              Re-analyze
            </Button>
          </div>
        </div>

        {/* 4 Summary Stats Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-violet-500/15">
          <div className="rounded-xl border border-[var(--border-muted)] bg-[var(--surface)]/80 p-3 shadow-2xs">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Buying Intent</span>
            <span className="mt-1 block text-sm font-bold text-[var(--text-main)]">
              {intentBadge.text}
            </span>
          </div>
          <div className="rounded-xl border border-[var(--border-muted)] bg-[var(--surface)]/80 p-3 shadow-2xs">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Deal Probability</span>
            <span className="mt-1 block text-sm font-bold text-emerald-600 dark:text-emerald-400">
              {score >= 80 ? '85% High' : score >= 50 ? '55% Moderate' : '20% Low'}
            </span>
          </div>
          <div className="rounded-xl border border-[var(--border-muted)] bg-[var(--surface)]/80 p-3 shadow-2xs">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Budget Fit</span>
            <span className="mt-1 block text-sm font-bold text-[var(--text-main)]">
              {lead?.budgetConfirmed ? '✓ Confirmed' : lead?.estimatedBudget ? 'Estimated' : 'TBD'}
            </span>
          </div>
          <div className="rounded-xl border border-[var(--border-muted)] bg-[var(--surface)]/80 p-3 shadow-2xs">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Call Sentiment</span>
            <span className="mt-1 block text-sm font-bold text-[var(--text-main)]">
              {callSentiment || 'Neutral'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Strategic Insights 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Synthesis, Opportunity & Risks */}
        <div className="space-y-6">
          {/* Executive Synthesis Card */}
          <Card className="p-5 border-[var(--border)] bg-[var(--surface)] shadow-sm space-y-3.5">
            <div className="flex items-center gap-2 border-b border-[var(--border-muted)] pb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400">
                <Sparkles size={15} />
              </div>
              <h3 className="text-sm font-bold text-[var(--text-main)]">Executive Deal Synthesis</h3>
            </div>
            <p className="text-xs leading-relaxed text-[var(--text-main)] rounded-xl bg-violet-500/5 border border-violet-500/20 p-4">
              {executiveSummary}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                  <CheckCircle2 size={14} className="shrink-0" />
                  <span>Key Opportunity</span>
                </div>
                <p className="text-xs text-[var(--text-main)] leading-relaxed">
                  {keyOpportunity}
                </p>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10 p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-bold text-xs">
                  <ShieldAlert size={14} className="shrink-0" />
                  <span>Deal Risk & Watchlist</span>
                </div>
                <p className="text-xs text-[var(--text-main)] leading-relaxed">
                  {keyRisk || 'No critical deal risks detected. Maintain current engagement cadence.'}
                </p>
              </div>
            </div>
          </Card>

          {/* Recommended Next Action & Playbook */}
          <Card className="p-5 border-emerald-500/25 bg-emerald-500/5 dark:bg-emerald-500/10 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <CheckSquare size={15} />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">AI Playbook</span>
                  <h3 className="text-sm font-bold text-[var(--text-main)]">Recommended Next Action</h3>
                </div>
              </div>
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                High Priority
              </span>
            </div>

            <p className="text-xs font-medium text-[var(--text-main)] leading-relaxed">
              {recommendedAction}
            </p>

            <div className="flex items-center gap-2 flex-wrap pt-2">
              {onScheduleFollowUp && (
                <Button size="sm" onClick={onScheduleFollowUp} className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer">
                  <Clock size={13} className="mr-1.5" />
                  Schedule Follow-up
                </Button>
              )}
              {onLogCall && (
                <Button variant="outline" size="sm" onClick={onLogCall} className="h-8 text-xs font-semibold cursor-pointer">
                  <PhoneCall size={13} className="mr-1.5" />
                  Log Call
                </Button>
              )}
              {onAddQuotation && (
                <Button variant="outline" size="sm" onClick={onAddQuotation} className="h-8 text-xs font-semibold cursor-pointer">
                  <FileText size={13} className="mr-1.5" />
                  Create Quotation
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: AI Outreach Studio & Voice Intel */}
        <div className="space-y-6">
          {/* Smart AI Outreach Studio */}
          <Card className="p-5 border-[var(--border)] bg-[var(--surface)] shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-muted)] pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                  <MessageSquare size={15} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-main)]">AI Smart Outreach Studio</h3>
                  <p className="text-[11px] text-[var(--text-muted)]">Context-aware personalized pitches ready to deploy</p>
                </div>
              </div>

              {/* Channel Selector */}
              <div className="flex items-center rounded-lg bg-[var(--surface-2)] p-1 border border-[var(--border-muted)]">
                <button
                  type="button"
                  onClick={() => setActiveReplyTab('whatsapp')}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-bold transition-all cursor-pointer',
                    activeReplyTab === 'whatsapp'
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  )}
                >
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => setActiveReplyTab('email')}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-bold transition-all cursor-pointer',
                    activeReplyTab === 'email'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  )}
                >
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => setActiveReplyTab('urgent')}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-bold transition-all cursor-pointer',
                    activeReplyTab === 'urgent'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  )}
                >
                  Urgent
                </button>
              </div>
            </div>

            {/* Generated Message Preview */}
            <div className="relative rounded-xl border border-[var(--border-muted)] bg-[var(--surface-2)]/70 p-4">
              <p className="text-xs whitespace-pre-wrap leading-relaxed text-[var(--text-main)] font-sans">
                {currentReplyText}
              </p>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyReply}
                className="h-8 text-xs font-semibold cursor-pointer"
              >
                {copied ? <Check size={13} className="mr-1.5 text-emerald-500" /> : <Copy size={13} className="mr-1.5" />}
                {copied ? 'Copied!' : 'Copy text'}
              </Button>

              {activeReplyTab === 'whatsapp' || activeReplyTab === 'urgent' ? (
                <Button
                  size="sm"
                  onClick={handleSendWhatsApp}
                  className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                >
                  <Send size={13} className="mr-1.5" />
                  Launch WhatsApp
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleSendEmail}
                  className="h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                >
                  <Mail size={13} className="mr-1.5" />
                  Compose Email
                </Button>
              )}
            </div>
          </Card>

          {/* Call Intel & Audio Recording */}
          {(hasRecording || latestCall) && (
            <Card className="p-5 border-[var(--border)] bg-[var(--surface)] shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--border-muted)] pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                    <Mic size={15} />
                  </div>
                  <h3 className="text-sm font-bold text-[var(--text-main)]">Voice & Conversation Intelligence</h3>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  Sentiment: {callSentiment}
                </span>
              </div>

              {recordingUrl ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Volume2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-bold text-[var(--text-main)]">Logged Audio Recording</span>
                    </div>
                    <a
                      href={recordingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer"
                    >
                      Open file <ExternalLink size={11} />
                    </a>
                  </div>
                  <audio controls src={recordingUrl} className="w-full h-8 rounded-lg" />
                  {recordingCall?.notes && (
                    <p className="text-xs text-[var(--text-muted)] italic border-t border-[var(--border-muted)] pt-2">
                      &ldquo;{recordingCall.notes}&rdquo;
                    </p>
                  )}
                </div>
              ) : latestCall ? (
                <div className="rounded-xl border border-[var(--border-muted)] bg-[var(--surface-2)] p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--text-main)]">{latestCall.callType} Call ({latestCall.callOutcome})</span>
                    <span className="text-[10px] text-[var(--text-muted)]">{latestCall.callDuration}s duration</span>
                  </div>
                  {latestCall.notes && (
                    <p className="text-xs text-[var(--text-muted)] italic line-clamp-2">
                      &ldquo;{latestCall.notes}&rdquo;
                    </p>
                  )}
                </div>
              ) : null}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
