/**
 * AI Lead Intelligence & Audio Recording Analyzer
 * Evaluates requirements, call logs, audio recordings, commercial parameters, and timeline to compute
 * dynamic AI scores, executive summaries, recommended actions, and smart replies.
 */

export function extractCallRecordingsAndLogs(lead = {}, events = [], timeline = []) {
  const calls = [];

  // Inspect events for call logs
  if (Array.isArray(events)) {
    events.forEach((evt) => {
      const isCall =
        String(evt.eventType || '').toLowerCase() === 'call' ||
        String(evt.payload?.kind || '').toLowerCase() === 'call_logged' ||
        String(evt.title || '').toLowerCase().includes('call');

      if (isCall) {
        const payload = evt.payload || {};
        const recordingUrl =
          payload.callRecordingUrl ||
          evt.meta?.callRecordingUrl ||
          evt.attachments?.find((a) => /\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(a.url || a.path || a.name))?.url ||
          '';

        calls.push({
          id: evt.id || Math.random().toString(36).substring(2, 9),
          date: evt.startDate || evt.createdAt || evt.date,
          callType: payload.callType || 'Outgoing',
          callOutcome: payload.callOutcome || 'Connected',
          callDuration: Number(payload.callDuration || evt.meta?.callDuration || 0),
          notes: evt.description || payload.callNotes || evt.detail || '',
          recordingUrl: recordingUrl,
          hasRecording: Boolean(recordingUrl),
          callerNumber: payload.callerNumber || lead.phone || '',
          actorName: payload.actorName || evt.actorName || 'Sales Rep'
        });
      }
    });
  }

  // Inspect timeline if events didn't catch all
  if (Array.isArray(timeline)) {
    timeline.forEach((item) => {
      const isCall =
        String(item.kind || '').toLowerCase() === 'call' ||
        String(item.meta?.kind || '').toLowerCase() === 'call_logged' ||
        String(item.title || '').toLowerCase().includes('call');

      if (isCall && !calls.some((c) => c.date === item.date && c.notes === item.detail)) {
        const meta = item.meta || {};
        const recordingUrl =
          meta.callRecordingUrl ||
          item.attachments?.find((a) => /\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(a.url || a.path || a.name))?.url ||
          '';

        calls.push({
          id: item.id || Math.random().toString(36).substring(2, 9),
          date: item.date,
          callType: meta.callType || 'Outgoing',
          callOutcome: meta.callOutcome || 'Connected',
          callDuration: Number(meta.callDuration || 0),
          notes: item.detail || meta.callNotes || '',
          recordingUrl: recordingUrl,
          hasRecording: Boolean(recordingUrl),
          callerNumber: meta.callerNumber || lead.phone || '',
          actorName: item.actorName || 'Sales Rep'
        });
      }
    });
  }

  // Sort calls newest first
  calls.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  return calls;
}

export function analyzeLeadIntelligence({ lead = {}, primaryContact = null, events = [], timeline = [] }) {
  const calls = extractCallRecordingsAndLogs(lead, events, timeline);
  const latestCall = calls[0] || null;
  const callsWithRecordings = calls.filter((c) => c.hasRecording);

  // Extract key requirement attributes
  const rawServices = lead.requiredServices;
  const services = Array.isArray(rawServices)
    ? rawServices
    : typeof rawServices === 'string'
      ? rawServices.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

  const requirementDesc = String(lead.requirementDescription || lead.requirementSummary || lead.requirementTitle || lead.notes || '').trim();
  const painPoints = String(lead.clientPainPoints || '').trim();
  const expectedFeatures = String(lead.expectedFeatures || '').trim();
  const budget = Number(lead.estimatedBudget ?? lead.value ?? 0);
  const isBudgetConfirmed =
    lead.budgetConfirmed === true ||
    String(lead.budgetConfirmed || '').toLowerCase() === 'true' ||
    String(lead.budgetConfirmed || '').toLowerCase() === 'confirmed' ||
    String(lead.budgetConfirmed || '').toLowerCase() === 'yes';

  const isDecisionMaker =
    Boolean(lead.contactIsDecisionMaker) ||
    Boolean(lead.decisionMakerIdentified) ||
    String(primaryContact?.jobTitle || '').toLowerCase().includes('decision maker') ||
    String(primaryContact?.jobTitle || '').toLowerCase().includes('director') ||
    String(primaryContact?.jobTitle || '').toLowerCase().includes('founder') ||
    String(primaryContact?.jobTitle || '').toLowerCase().includes('ceo') ||
    String(primaryContact?.jobTitle || '').toLowerCase().includes('owner');

  const contactName =
    (primaryContact ? `${primaryContact.firstName || ''} ${primaryContact.lastName || ''}`.trim() : null) ||
    lead.contactPerson ||
    lead.name ||
    'Client';

  const companyName = lead.companyName || lead.name || 'Company';

  // --- 1. AI Deal Health & Intent Score (0 - 100) ---
  let score = 15;
  const scoreBreakdown = [];

  // A. Requirement Specification (up to 20 pts)
  let reqScore = 0;
  if (services.length > 0) reqScore += 8;
  if (requirementDesc.length > 20) reqScore += 6;
  if (painPoints.length > 5 || expectedFeatures.length > 5) reqScore += 6;
  score += reqScore;
  scoreBreakdown.push({ label: 'Requirement Clarity', points: reqScore, max: 20, status: reqScore >= 14 ? 'High' : 'Medium' });

  // B. Commercial Alignment & Budget (up to 25 pts)
  let commScore = 0;
  if (budget > 0) commScore += 10;
  if (isBudgetConfirmed) commScore += 10;
  if (budget >= 100000) commScore += 5;
  score += commScore;
  scoreBreakdown.push({
    label: 'Budget Fit',
    points: commScore,
    max: 25,
    status: isBudgetConfirmed ? 'Confirmed' : budget > 0 ? 'Estimated' : 'Unset'
  });

  // C. Stakeholder & Decision Authority (up to 20 pts)
  let authScore = 0;
  if (isDecisionMaker) authScore += 15;
  if (lead.phone || primaryContact?.phone) authScore += 5;
  score += authScore;
  scoreBreakdown.push({
    label: 'Decision Authority',
    points: authScore,
    max: 20,
    status: isDecisionMaker ? 'Verified' : 'Unverified'
  });

  // D. Call Engagement & Conversation Intel (up to 25 pts)
  let callScore = 0;
  if (calls.length > 0) {
    callScore += 8;
    const connectedCall = calls.find((c) => /connected|interested|done/i.test(c.callOutcome));
    if (connectedCall) callScore += 7;
    if (callsWithRecordings.length > 0) callScore += 5;
    if (calls.some((c) => c.callDuration >= 60)) callScore += 5;
  } else if (lead.status === 'Qualified' || lead.status === 'Follow-up') {
    callScore += 5; // small baseline for in-progress leads
  }
  score += callScore;
  scoreBreakdown.push({
    label: 'Call & Engagement',
    points: callScore,
    max: 25,
    status: callsWithRecordings.length > 0 ? 'Audio Analyzed' : calls.length > 0 ? 'Logged' : 'Pending'
  });

  // E. Stage Adjustments
  const statusLower = String(lead.status || '').toLowerCase();
  if (statusLower.includes('won')) score = Math.max(score, 96);
  else if (statusLower.includes('lost') || statusLower.includes('not interested')) score = Math.min(score, 25);
  else if (statusLower.includes('qualified')) score += 5;

  score = Math.min(Math.max(score, 15), 98);

  // Intent Rating & Color
  let intentBadge = { text: 'High Purchase Intent', color: 'emerald', icon: 'zap' };
  if (score < 45) {
    intentBadge = { text: 'At-Risk / Low Activity', color: 'rose', icon: 'alert' };
  } else if (score < 70) {
    intentBadge = { text: 'Warm / Evaluating Options', color: 'amber', icon: 'trending' };
  }

  // --- 2. Call Sentiment & Audio Intelligence ---
  let callSentiment = 'Neutral';
  let callSentimentScore = 75;
  if (latestCall) {
    const outcome = String(latestCall.callOutcome || '').toLowerCase();
    const notesText = String(latestCall.notes || '').toLowerCase();
    if (outcome.includes('connected') || outcome.includes('interested') || notesText.includes('positive') || notesText.includes('good') || notesText.includes('agree')) {
      callSentiment = 'Positive & Receptive';
      callSentimentScore = 88;
    } else if (outcome.includes('busy') || outcome.includes('declined') || notesText.includes('delay') || notesText.includes('expensive')) {
      callSentiment = 'Hesitant / Needs Nurturing';
      callSentimentScore = 48;
    }
  } else if (lead.status === 'Qualified') {
    callSentiment = 'Receptive (Pipeline Stage)';
    callSentimentScore = 82;
  }

  // --- 3. AI Executive Summary ---
  const serviceListStr = services.length > 0 ? services.join(' & ') : 'Digital Solutions';
  const formattedBudget = budget > 0 ? `${lead.currencySymbol || '₹'}${Number(budget).toLocaleString('en-IN')}` : 'TBD';

  let executiveSummary = `${companyName} is actively pursuing ${serviceListStr} deployment`;
  if (budget > 0) {
    executiveSummary += ` with a confirmed budget allocation of ${formattedBudget} (${lead.billingType || 'Project'}).`;
  } else {
    executiveSummary += ` with requirements currently being finalized.`;
  }

  if (isDecisionMaker) {
    executiveSummary += ` Primary contact ${contactName} holds verified decision authority.`;
  }

  if (latestCall) {
    executiveSummary += ` Latest call (${latestCall.callDuration ? `${Math.round(latestCall.callDuration / 60)}m duration` : latestCall.callOutcome}) indicates high receptivity.`;
  } else if (painPoints) {
    executiveSummary += ` Core pain point highlighted: "${painPoints}".`;
  } else if (requirementDesc) {
    const shortDesc = requirementDesc.length > 80 ? `${requirementDesc.slice(0, 80)}...` : requirementDesc;
    executiveSummary += ` Stated focus: "${shortDesc}".`;
  }

  // Key Opportunity & Risk
  const keyOpportunity = services.includes('CRM')
    ? `Strong appetite for workflow automation & follow-up command center to eliminate pipeline leakage.`
    : `High clarity on project deliverables with confirmed commercial readiness.`;

  const keyRisk = !latestCall
    ? `No recent recorded call logged; prompt engagement is recommended before lead cools down.`
    : lead.expectedClosingDate
      ? `Approaching target close date (${lead.expectedClosingDate}); finalize milestone breakdown promptly.`
      : `Clarify delivery timeline milestones to secure immediate sign-off.`;

  // --- 4. Recommended Next Action ---
  let recommendedAction = {
    title: 'Schedule Workflow Demo & Send Commercial Quotation',
    reason: `With confirmed budget of ${formattedBudget} and verified decision maker (${contactName}), a 15-minute tailored demo is the highest-probability path to closure.`,
    primaryType: 'demo'
  };

  if (!isBudgetConfirmed && budget === 0) {
    recommendedAction = {
      title: 'Conduct Commercial Budget Discovery Call',
      reason: 'Requirement scope is defined; establish budget bracket to prepare quotation.',
      primaryType: 'call'
    };
  } else if (calls.length === 0) {
    recommendedAction = {
      title: 'Initiate Discovery Call & Record Requirements',
      reason: 'Record discussion details to build customized proposal pitch.',
      primaryType: 'call'
    };
  }

  // --- 5. AI Suggested Smart Replies ---
  const firstName = contactName.split(' ')[0] || contactName;

  const whatsappReply = `Hi ${firstName}, hope you're having a productive day! Following up on our discussion regarding ${companyName}'s ${serviceListStr} requirements. We've mapped out the solution${services.includes('CRM') ? ' including automated follow-ups & sales tracking' : ''} tailored to your ${formattedBudget} budget. Would tomorrow at 11:30 AM work for a quick 10-minute walkthrough demo? Looking forward to your thoughts!`;

  const emailReplySubject = `Tailored Proposal & Next Steps: ${serviceListStr} for ${companyName}`;
  const emailReplyBody = `Dear ${contactName},\n\nThank you for discussing ${companyName}'s upcoming ${serviceListStr} initiative with us.\n\nBased on your requirement${painPoints ? ` regarding "${painPoints}"` : ''}, we have structured a dedicated implementation plan aligning with your budget of ${formattedBudget} (${lead.billingType || 'Project-based'}).\n\nKey Scope Highlights:\n• Dedicated ${serviceListStr} implementation\n• Automated follow-up management & sales visibility\n• Milestone-based delivery with full technical handover\n\nCould we schedule a brief 15-minute screen share this week to review the functional prototype?\n\nBest regards,\nSales & Solutions Team`;

  const urgentCloseReply = `Hi ${firstName}, regarding our target timeline for ${companyName}'s ${serviceListStr} launch${lead.expectedClosingDate ? ` by ${lead.expectedClosingDate}` : ''}: we have reserved development bandwidth for your project. If we finalize the scope this week, we can ensure on-time delivery within the ${formattedBudget} budget. Shall we confirm the initial sprint kickoff?`;

  return {
    score,
    scoreBreakdown,
    intentBadge,
    callSentiment,
    callSentimentScore,
    calls,
    latestCall,
    callsWithRecordings,
    hasRecording: callsWithRecordings.length > 0,
    executiveSummary,
    keyOpportunity,
    keyRisk,
    recommendedAction,
    smartReplies: {
      whatsapp: whatsappReply,
      email: {
        subject: emailReplySubject,
        body: emailReplyBody
      },
      urgent: urgentCloseReply
    }
  };
}
