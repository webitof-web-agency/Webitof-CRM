export const SERVICE_PAYMENT_PLAN_OPTIONS = [
  {
    value: 'split_50_50',
    label: '50% advance + 50% before live',
    description: '50% advance and remaining 50% after work completion, before going live.',
    milestones: [
      { percentage: 50, milestone: 'Advance before project start' },
      { percentage: 50, milestone: 'After complete work, before going live' }
    ]
  },
  {
    value: 'split_40_30_30',
    label: '40% + 30% + 30%',
    description: '40% advance, 30% after software/website demo, and 30% before going live.',
    milestones: [
      { percentage: 40, milestone: 'Advance before project start' },
      { percentage: 30, milestone: 'After software / website demo' },
      { percentage: 30, milestone: 'After complete work, before going live' }
    ]
  },
  {
    value: 'full_advance',
    label: '100% advance',
    description: 'The complete project amount is payable before project commencement.',
    milestones: [
      { percentage: 100, milestone: 'Advance before project start' }
    ]
  },
  {
    value: 'manual',
    label: 'Manual payment plan',
    description: 'Choose the number of installments and define percentage and condition for each part.',
    milestones: []
  }
];

function cloneMilestones(milestones = []) {
  return milestones.map((item) => ({
    percentage: Number(item?.percentage || 0),
    milestone: String(item?.milestone || '').trim()
  }));
}

export function createServicePaymentPlan(type = 'split_50_50') {
  const selected = SERVICE_PAYMENT_PLAN_OPTIONS.find((option) => option.value === type) || SERVICE_PAYMENT_PLAN_OPTIONS[0];
  return {
    type: selected.value,
    milestones: selected.value === 'manual'
      ? [
          { percentage: 50, milestone: 'First payment milestone' },
          { percentage: 50, milestone: 'Final payment milestone' }
        ]
      : cloneMilestones(selected.milestones)
  };
}

function parseLegacyPaymentInfo(paymentInfo = '') {
  const lines = String(paymentInfo || '').split(/\r?\n|\s*;\s*/).map((line) => line.trim()).filter(Boolean);
  const parsed = lines.map((line) => {
    const match = line.match(/^(\d+(?:\.\d+)?)%\s*(?:[-–—:]\s*)?(.*)$/i);
    return match ? { percentage: Number(match[1]), milestone: match[2] || 'Payment milestone' } : null;
  });
  if (parsed.length && parsed.every(Boolean)) return parsed;
  return [];
}

export function normalizeServicePaymentPlan(paymentPlan, paymentInfo = '') {
  if (paymentPlan && typeof paymentPlan === 'object' && paymentPlan.type) {
    const normalized = createServicePaymentPlan(paymentPlan.type);
    const milestones = cloneMilestones(paymentPlan.milestones || []);
    return { ...normalized, milestones: milestones.length ? milestones : normalized.milestones };
  }

  const parsed = parseLegacyPaymentInfo(paymentInfo);
  if (parsed.length) return { type: 'manual', milestones: parsed };
  if (String(paymentInfo || '').trim()) {
    return {
      type: 'manual',
      milestones: [{ percentage: 100, milestone: String(paymentInfo).trim() }]
    };
  }
  return createServicePaymentPlan();
}

export function formatServicePaymentPlan(paymentPlan) {
  const normalized = normalizeServicePaymentPlan(paymentPlan);
  return normalized.milestones
    .map((item) => `${Number(item.percentage || 0)}% ${String(item.milestone || '').trim()}`.trim())
    .join('\n');
}
