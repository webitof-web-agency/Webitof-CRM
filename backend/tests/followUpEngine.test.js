const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateEffectiveStatus,
  calculatePriority,
  calculateReminderAt,
  getEscalationLevel,
  getNextRecurrenceAt,
  isTerminalRelatedStatus,
  isWithinBusinessHours,
  matchesConditions,
  parseDateTime,
  scheduleRetry
} = require('../services/followUpEngine.service');

test('due status distinguishes overdue, due today and completed records', () => {
  const now = new Date('2026-08-02T06:30:00.000Z'); // noon IST
  assert.equal(calculateEffectiveStatus({ status: 'Scheduled', dueAt: '2026-08-02T07:30:00.000Z' }, now), 'Due Today');
  assert.equal(calculateEffectiveStatus({ status: 'Scheduled', dueAt: '2026-08-02T05:30:00.000Z' }, now), 'Overdue');
  assert.equal(calculateEffectiveStatus({ status: 'Completed', dueAt: '2026-08-01T05:30:00.000Z' }, now), 'Completed');
});

test('priority calculation is explainable and raises business risk', () => {
  const high = calculatePriority({ priority: 'Medium', quotationValue: 300000 });
  assert.equal(high.priority, 'High');
  assert.match(high.reason, /2,50,000/);
  const critical = calculatePriority({ priority: 'Low', promiseMissed: true });
  assert.equal(critical.priority, 'Critical');
  assert.match(critical.reason, /promise date/i);
});

test('next-action closure rules recognize terminal related states', () => {
  assert.equal(isTerminalRelatedStatus('Lead', 'Won'), true);
  assert.equal(isTerminalRelatedStatus('Lead', 'Qualified'), false);
  assert.equal(isTerminalRelatedStatus('Invoice', 'Paid'), true);
  assert.equal(isTerminalRelatedStatus('Renewal', 'Renewed'), true);
});

test('sequence and automation conditions support comparison operators', () => {
  const record = { source: 'Website', value: 75000, tags: ['hot', 'seo'], client: { category: 'A' } };
  assert.equal(matchesConditions(record, { source: 'Website', value: { $gt: 50000 }, tags: { $contains: 'hot' }, 'client.category': { $in: ['A', 'B'] } }), true);
  assert.equal(matchesConditions(record, { value: { $lte: 10000 } }), false);
});

test('reminder timing is deterministic and idempotency-safe input can be derived', () => {
  assert.equal(calculateReminderAt('2026-08-02T10:00:00.000Z', 30), '2026-08-02T09:30:00.000Z');
  assert.equal(calculateReminderAt('invalid', 30), null);
});

test('escalation level selects the highest elapsed threshold', () => {
  const schedule = [{ level: 1, minutesOverdue: 30 }, { level: 2, minutesOverdue: 120 }, { level: 3, minutesOverdue: 1440 }];
  assert.equal(getEscalationLevel(20, schedule), 0);
  assert.equal(getEscalationLevel(121, schedule), 2);
  assert.equal(getEscalationLevel(2000, schedule), 3);
});

test('recurrence creates only the next controlled occurrence', () => {
  assert.equal(getNextRecurrenceAt('2026-08-02T04:30:00.000Z', { frequency: 'weekly', interval: 1, respectBusinessHours: false }), '2026-08-09T04:30:00.000Z');
  assert.equal(getNextRecurrenceAt('2026-08-02T04:30:00.000Z', { frequency: 'monthly', interval: 1, endDate: '2026-08-15' }), null);
});

test('business-hours scheduler respects Indian working hours and holidays', () => {
  const settings = { timezone: 'Asia/Kolkata', businessHours: { start: '09:30', end: '18:30', workingDays: [1, 2, 3, 4, 5, 6] }, holidayDates: ['2026-08-15'] };
  assert.equal(isWithinBusinessHours('2026-08-03T05:00:00.000Z', settings), true); // Monday 10:30 IST
  assert.equal(isWithinBusinessHours('2026-08-02T05:00:00.000Z', settings), false); // Sunday
  assert.equal(isWithinBusinessHours('2026-08-15T05:00:00.000Z', settings), false); // holiday
});

test('smart retry uses configured delays and maximum attempts', () => {
  const policy = { delaysMinutes: [120, 1440], maxAttempts: 2, respectBusinessHours: false };
  assert.equal(scheduleRetry(1, '2026-08-03T04:00:00.000Z', policy), '2026-08-03T06:00:00.000Z');
  assert.equal(scheduleRetry(3, '2026-08-03T04:00:00.000Z', policy), null);
});

test('Asia/Kolkata local date and time parses without server-timezone dependence', () => {
  assert.equal(parseDateTime('', '2026-08-02', '10:00', 'Asia/Kolkata'), '2026-08-02T04:30:00.000Z');
});
