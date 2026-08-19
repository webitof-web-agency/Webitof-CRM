const test = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../config/db');
const engine = require('../services/followUpEngine.service');

test('create, reschedule, complete and create-next are atomic with audit history', async (t) => {
  const db = await pool.connect().catch(() => null);
  if (!db) return t.skip('PostgreSQL is not available');
  await db.query('begin');
  try {
    const userResult = await db.query(`select id from users where is_active=true order by created_at asc limit 1`);
    const leadResult = await db.query(
      `select l.id from leads l where not exists (
         select 1 from follow_ups f where f.related_entity_type='Lead' and f.related_entity_id=l.id
           and f.deleted_at is null and f.status=any($1::text[])
       ) order by l.created_at asc limit 1`,
      [engine.ACTIVE_FOLLOW_UP_STATUSES]
    );
    if (!userResult.rows[0] || !leadResult.rows[0]) return t.skip('An active user and lead are required for the integration test');
    const actor = { id: userResult.rows[0].id, isSuperAdmin: true, permissions: [] };
    const created = await engine.createFollowUp({
      relatedEntityType: 'Lead', relatedEntityId: leadResult.rows[0].id,
      title: 'Integration follow-up', followUpType: 'Call', purpose: 'Automated verification',
      dueAt: new Date(Date.now() + 4 * 3600000).toISOString(), assignedTo: actor.id,
      reminderSettings: [{ channel: 'inApp', minutesBefore: 30 }]
    }, actor, { db });
    assert.ok(created.record.id);

    const reminderResult = await db.query('select count(*)::int as count from follow_up_reminders where follow_up_id=$1', [created.record.id]);
    assert.equal(reminderResult.rows[0].count, 1);

    const automationRuleId = `fuarule-integration-${Date.now()}`;
    await db.query(
      `insert into follow_up_automation_rules (id,name,trigger_key,conditions,actions,priority,version,is_active,payload)
       values ($1,'Integration priority rule','integration_trigger',$2::jsonb,$3::jsonb,1,1,true,'{}'::jsonb)`,
      [automationRuleId, JSON.stringify({ source: 'Website' }), JSON.stringify([{ type: 'change_priority', priority: 'Critical' }])]
    );
    const automation = await engine.executeAutomationRules('integration_trigger', {
      relatedEntityType: 'Lead', relatedEntityId: leadResult.rows[0].id, eventId: created.record.id, payload: { source: 'Website' }
    }, actor, { db });
    assert.equal(automation.executed, 1);
    const repeatedAutomation = await engine.executeAutomationRules('integration_trigger', {
      relatedEntityType: 'Lead', relatedEntityId: leadResult.rows[0].id, eventId: created.record.id, payload: { source: 'Website' }
    }, actor, { db });
    assert.equal(repeatedAutomation.skipped, 1);
    const automatedRecord = await db.query('select priority from follow_ups where id=$1', [created.record.id]);
    assert.equal(automatedRecord.rows[0].priority, 'Critical');

    const reassigned = await engine.reassignFollowUp(created.record.id, {
      assignedTo: actor.id, reason: 'Integration reassignment verification'
    }, actor, { db });
    assert.equal(reassigned.assignedTo, actor.id);

    const escalated = await engine.escalateFollowUp(created.record.id, {
      level: 2, reason: 'Integration escalation verification'
    }, actor, { db });
    assert.equal(escalated.status, 'Escalated');
    assert.equal(escalated.escalationLevel, 2);

    const rescheduled = await engine.rescheduleFollowUp(created.record.id, {
      dueAt: new Date(Date.now() + 8 * 3600000).toISOString(), reason: 'Client requested callback', note: 'Integration test'
    }, actor, 'reschedule', { db });
    assert.equal(rescheduled.status, 'Rescheduled');
    assert.equal(rescheduled.rescheduleCount, 1);

    const completed = await engine.completeFollowUp(created.record.id, {
      actualOutcome: 'Connected', communicationResult: 'Connected', discussionNote: 'Requirements discussed',
      nextActionRequired: true, nextAction: 'Send proposal', nextFollowUpAt: new Date(Date.now() + 24 * 3600000).toISOString()
    }, actor, { db });
    assert.equal(completed.followUp.status, 'Completed');
    assert.ok(completed.nextFollowUp?.id);
    assert.equal(completed.nextFollowUp.previousFollowUpId, created.record.id);

    const history = await db.query('select action from follow_up_audit_logs where follow_up_id=$1', [created.record.id]);
    assert.deepEqual(
      history.rows.map((row) => row.action).sort(),
      ['created', 'automation_change_priority', 'reassigned', 'escalated', 'reschedule', 'completed'].sort()
    );
  } finally {
    await db.query('rollback');
    db.release();
  }
});

test('active records cannot be closed without a next action unless the actor has override permission', async (t) => {
  const db = await pool.connect().catch(() => null);
  if (!db) return t.skip('PostgreSQL is not available');
  await db.query('begin');
  try {
    const userResult = await db.query(`select id from users where is_active=true order by created_at asc limit 1`);
    const leadResult = await db.query(
      `select l.id from leads l where l.status not in ('Won','Lost','Not Interested','Invalid Lead','Duplicate')
       and not exists (select 1 from follow_ups f where f.related_entity_type='Lead' and f.related_entity_id=l.id and f.deleted_at is null and f.status=any($1::text[]))
       order by l.created_at asc limit 1`,
      [engine.ACTIVE_FOLLOW_UP_STATUSES]
    );
    if (!userResult.rows[0] || !leadResult.rows[0]) return t.skip('An active user and lead are required for the integration test');
    const actor = { id: userResult.rows[0].id, isSuperAdmin: false, permissions: ['followups.create', 'followups.complete'] };
    const created = await engine.createFollowUp({
      relatedEntityType: 'Lead', relatedEntityId: leadResult.rows[0].id,
      title: 'Next-action enforcement', followUpType: 'Call', purpose: 'Validation verification',
      dueAt: new Date(Date.now() + 4 * 3600000).toISOString(), assignedTo: actor.id
    }, actor, { db, system: true });

    await db.query(`update follow_up_settings set protection_thresholds=jsonb_set(protection_thresholds,'{maxReschedules}','3'::jsonb) where id='default'`);
    await db.query('update follow_ups set reschedule_count=3 where id=$1', [created.record.id]);
    await assert.rejects(
      engine.rescheduleFollowUp(created.record.id, {
        dueAt: new Date(Date.now() + 8 * 3600000).toISOString(), reason: 'Fourth reschedule attempt'
      }, actor, 'reschedule', { db }),
      (error) => error.statusCode === 403 && /manager approval/i.test(error.message)
    );

    await assert.rejects(
      engine.completeFollowUp(created.record.id, {
        actualOutcome: 'Connected', communicationResult: 'Connected', discussionNote: 'Still active',
        nextActionRequired: false, noNextFollowUpReason: 'User attempted to close an active record'
      }, actor, { db }),
      (error) => error.statusCode === 400 && Boolean(error.details?.nextAction) && Boolean(error.details?.nextFollowUpAt)
    );
  } finally {
    await db.query('rollback');
    db.release();
  }
});

test.after(async () => {
  await pool.end();
});
