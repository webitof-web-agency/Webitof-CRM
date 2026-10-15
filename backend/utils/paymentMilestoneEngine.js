/**
 * Webitof Enterprise Quotation - Payment Milestone Engine
 * Centralized, testable milestone management, calculation, and validation.
 */

const MILESTONE_PRESETS = [
  {
    id: 'standard-3-stage',
    name: '50 / 30 / 20 — Standard 3-Stage Delivery',
    milestones: [
      { id: 'ms-1', name: 'Mobilization Advance & Project Kickoff', percentage: 50, dueEvent: 'Upon formal contract signing & kickoff' },
      { id: 'ms-2', name: 'Architecture & Design Prototype Approval', percentage: 30, dueEvent: 'Upon UI/UX prototype & blueprint sign-off' },
      { id: 'ms-3', name: 'Final UAT, Deployment & Go-Live', percentage: 20, dueEvent: 'Upon successful production deployment & handover' }
    ]
  },
  {
    id: 'sprint-4-stage',
    name: '40 / 30 / 20 / 10 — Enterprise 4-Stage Sprint',
    milestones: [
      { id: 'ms-1', name: 'Mobilization Advance & Architecture Blueprint', percentage: 40, dueEvent: 'Upon contract execution' },
      { id: 'ms-2', name: 'Core Alpha Modules & Architecture Demonstration', percentage: 30, dueEvent: 'Upon completion of Alpha core build' },
      { id: 'ms-3', name: 'Omnichannel Integrations & Beta UAT Sign-off', percentage: 20, dueEvent: 'Upon completion of Beta testing & integration' },
      { id: 'ms-4', name: 'Final Production Deployment & Knowledge Transfer', percentage: 10, dueEvent: 'Prior to final go-live & handover' }
    ]
  },
  {
    id: 'ecommerce-3-stage',
    name: '40 / 40 / 20 — E-Commerce & Platform Deployment',
    milestones: [
      { id: 'ms-1', name: 'Platform Architecture & Design Advance', percentage: 40, dueEvent: 'Upon agreement execution' },
      { id: 'ms-2', name: 'Catalog, Cart & Payment Gateway Integration', percentage: 40, dueEvent: 'Upon gateway testing & storefront demonstration' },
      { id: 'ms-3', name: 'Admin Handover, Training & Go-Live', percentage: 20, dueEvent: 'Upon operational training & live launch' }
    ]
  },
  {
    id: 'upfront-100',
    name: '100% Upfront — Fixed Retainer / Quick Turnaround',
    milestones: [
      { id: 'ms-1', name: '100% Full Mobilization Advance', percentage: 100, dueEvent: 'Upon contract signing prior to commencement' }
    ]
  }
];

/**
 * Validate that an array of milestones sum to 100%
 */
function validateMilestones(milestones = []) {
  if (!Array.isArray(milestones) || milestones.length === 0) {
    return {
      isValid: false,
      totalPercentage: 0,
      difference: 100,
      error: 'At least one payment milestone is required.'
    };
  }

  const totalPercentage = milestones.reduce((sum, ms) => {
    const pct = Number(ms.percentage || 0);
    return sum + (Number.isFinite(pct) ? pct : 0);
  }, 0);

  const roundedTotal = Math.round(totalPercentage * 100) / 100;
  const difference = Math.round((100 - roundedTotal) * 100) / 100;

  if (Math.abs(difference) > 0.01) {
    return {
      isValid: false,
      totalPercentage: roundedTotal,
      difference,
      error: `Total milestone percentage is ${roundedTotal}%. It must equal exactly 100% (${difference > 0 ? `${difference}% remaining` : `${Math.abs(difference)}% excess`}).`
    };
  }

  return {
    isValid: true,
    totalPercentage: 100,
    difference: 0,
    error: null
  };
}

/**
 * Calculate deterministic milestone amounts from a base total with rounding compensation.
 * The final milestone absorbs any fractional rupee discrepancy so sum(amounts) === baseAmount exactly.
 */
function calculateMilestoneAmounts(milestones = [], baseAmount = 0) {
  const numericTotal = Math.max(0, Number(baseAmount || 0));
  if (!Array.isArray(milestones) || milestones.length === 0 || numericTotal === 0) {
    return (milestones || []).map((ms) => ({ ...ms, amount: 0 }));
  }

  let accumulatedAmount = 0;
  const result = milestones.map((ms, index) => {
    const pct = Math.max(0, Number(ms.percentage || 0));
    const isLast = index === milestones.length - 1;

    let msAmount;
    if (isLast) {
      // Absorb rounding difference
      msAmount = Math.max(0, Math.round(numericTotal - accumulatedAmount));
    } else {
      msAmount = Math.round((numericTotal * pct) / 100);
      accumulatedAmount += msAmount;
    }

    return {
      ...ms,
      percentage: pct,
      amount: msAmount
    };
  });

  return result;
}

/**
 * Parse milestone schedule from text or payload.
 * Crucially resolves conflicts where multiple schedules were concatenated together.
 */
function parseMilestonesFromText(text = '', baseAmount = 0) {
  if (!text || typeof text !== 'string') return [];

  const rawLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!rawLines.length) return [];

  // Parse lines that contain percentage indicators
  const parsedItems = [];
  for (const line of rawLines) {
    const pctMatch = line.match(/(\d+(?:\.\d+)?)%/);
    if (pctMatch) {
      const pct = parseFloat(pctMatch[1]);
      // Extract clean description removing percentage
      let cleanDesc = line.replace(/^\d+[\.\)]\s*/, '').replace(/MS-\d+[:\s-]*/i, '').trim();
      parsedItems.push({
        name: cleanDesc,
        percentage: pct,
        dueEvent: cleanDesc
      });
    }
  }

  if (!parsedItems.length) {
    return [];
  }

  // Detect and resolve duplication:
  // If the parsed items contain multiple distinct sets (e.g. Schedule A summing to 100%
  // followed by Schedule B summing to 100%), extract ONLY the first coherent 100% group!
  let currentGroup = [];
  let runningSum = 0;

  for (const item of parsedItems) {
    currentGroup.push(item);
    runningSum += item.percentage;
    if (Math.abs(runningSum - 100) < 0.01) {
      // Coherent 100% schedule found! Break immediately to prevent appending second schedule
      return calculateMilestoneAmounts(
        currentGroup.map((it, idx) => ({
          id: `ms-${idx + 1}`,
          name: it.name,
          percentage: it.percentage,
          dueEvent: it.dueEvent
        })),
        baseAmount
      );
    }
  }

  // If not exactly 100, return the parsed items formatted
  return calculateMilestoneAmounts(
    parsedItems.map((it, idx) => ({
      id: `ms-${idx + 1}`,
      name: it.name,
      percentage: it.percentage,
      dueEvent: it.dueEvent
    })),
    baseAmount
  );
}

/**
 * Serialize an array of milestones to plain text for backward compatibility
 */
function serializeMilestonesToText(milestones = []) {
  if (!Array.isArray(milestones) || !milestones.length) return '';
  return milestones
    .map((ms, index) => `${index + 1}. ${ms.percentage}% — ${ms.name || `Milestone ${index + 1}`}${ms.dueEvent && ms.dueEvent !== ms.name ? ` (${ms.dueEvent})` : ''}`)
    .join('\n');
}

module.exports = {
  MILESTONE_PRESETS,
  validateMilestones,
  calculateMilestoneAmounts,
  parseMilestonesFromText,
  serializeMilestonesToText
};
