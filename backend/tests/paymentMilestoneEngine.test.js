const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateMilestones,
  calculateMilestoneAmounts,
  parseMilestonesFromText,
  serializeMilestonesToText,
  MILESTONE_PRESETS
} = require('../utils/paymentMilestoneEngine');

test('milestone validator detects valid 100% total', () => {
  const milestones = [
    { percentage: 50 },
    { percentage: 30 },
    { percentage: 20 }
  ];
  const res = validateMilestones(milestones);
  assert.equal(res.isValid, true);
  assert.equal(res.totalPercentage, 100);
  assert.equal(res.error, null);
});

test('milestone validator catches invalid sum (e.g. 90% or 110%)', () => {
  const under = [{ percentage: 40 }, { percentage: 40 }];
  const underRes = validateMilestones(under);
  assert.equal(underRes.isValid, false);
  assert.equal(underRes.totalPercentage, 80);
  assert.match(underRes.error, /20% remaining/);

  const over = [{ percentage: 60 }, { percentage: 50 }];
  const overRes = validateMilestones(over);
  assert.equal(overRes.isValid, false);
  assert.equal(overRes.totalPercentage, 110);
  assert.match(overRes.error, /10% excess/);
});

test('milestone amount calculation accurately handles penny rounding down to zero discrepancy', () => {
  const baseAmount = 141600;
  const milestones = [
    { id: '1', name: 'Advance', percentage: 40 },
    { id: '2', name: 'Alpha', percentage: 30 },
    { id: '3', name: 'Beta', percentage: 20 },
    { id: '4', name: 'Launch', percentage: 10 }
  ];

  const calculated = calculateMilestoneAmounts(milestones, baseAmount);
  assert.equal(calculated[0].amount, 56640);
  assert.equal(calculated[1].amount, 42480);
  assert.equal(calculated[2].amount, 28320);
  assert.equal(calculated[3].amount, 14160);

  const sum = calculated.reduce((acc, m) => acc + m.amount, 0);
  assert.equal(sum, baseAmount);
});

test('milestone parser resolves and removes duplicated appended schedules', () => {
  const corruptedText = `
    1. 40% Mobilization Advance
    2. 30% Architecture Demonstration
    3. 20% Integration Testing
    4. 10% Final Launch
    1. 60% Advance on Kickoff
    2. 40% After Integration Testing
  `;

  const parsed = parseMilestonesFromText(corruptedText, 100000);
  assert.equal(parsed.length, 4);
  assert.equal(parsed[0].percentage, 40);
  assert.equal(parsed[1].percentage, 30);
  assert.equal(parsed[2].percentage, 20);
  assert.equal(parsed[3].percentage, 10);

  const total = parsed.reduce((sum, m) => sum + m.percentage, 0);
  assert.equal(total, 100);
});

test('all standard milestone presets validate to 100%', () => {
  for (const preset of MILESTONE_PRESETS) {
    const val = validateMilestones(preset.milestones);
    assert.equal(val.isValid, true, `Preset ${preset.name} failed 100% validation`);
  }
});
