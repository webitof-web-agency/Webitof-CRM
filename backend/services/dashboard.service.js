// Personal dashboard for the signed-in user (GET /dashboard/me): today's work, own leads, leave,
// this month and recent notifications in one call. Every section checks the permission the page
// for that data needs and is built on its own: a failing section comes back as null with an
// error, the rest still loads.
const { query } = require('../config/db');
const { hasPermission } = require('../middlewares/auth');
const followUpEngine = require('./followUpEngine.service');
const notificationService = require('./notification.service');
const { getSettings } = require('../models/settings.model');

const TIMEZONE = 'Asia/Kolkata';
const LIST_LIMIT = 8;
const CLOSED_FOLLOW_UP = ['Completed', 'Cancelled', 'Failed', 'Auto-Closed'];

function hasAny(user, permissions) {
  return Boolean(user?.isSuperAdmin) || permissions.some((permission) => hasPermission(user, permission));
}

function istDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function monthStart(day) {
  return `${day.slice(0, 7)}-01`;
}

async function section(name, run) {
  try {
    return await run();
  } catch (error) {
    console.error(`Dashboard section ${name} failed:`, error.message);
    return { error: 'Could not load' };
  }
}

function leadStates(settings) {
  const statuses = settings?.statuses?.leads || [];
  const byState = (state) => statuses
    .filter((item) => item && typeof item === 'object' && String(item.state || '').toLowerCase() === state)
    .map((item) => String(item.label));
  const won = byState('won');
  return { won: won.length ? won : ['Won'], closed: [...(won.length ? won : ['Won']), ...byState('lost'), 'Lost'] };
}

async function followUps(user) {
  const center = await followUpEngine.getCommandCenter(user);
  const mine = (rows = []) => rows.filter((row) => String(row.assignedTo || '') === String(user.id));
  const overdue = mine(center.sections.overdue);
  const dueToday = mine(center.sections.dueToday);
  const items = [...overdue, ...dueToday]
    .sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)))
    .slice(0, LIST_LIMIT)
    .map((row) => ({
      id: row.id,
      title: row.title,
      dueAt: row.dueAt,
      priority: row.priority,
      status: row.effectiveStatus || row.status,
      type: row.followUpType || row.type || '',
      relatedType: row.relatedEntityType || '',
      relatedId: row.relatedEntityId || '',
      relatedLabel: row.relatedEntityLabel || ''
    }));
  return { overdue: overdue.length, dueToday: dueToday.length, items };
}

async function tasks(user) {
  const rows = await require('./hrm/work').tasks(user, user.hrmEmployeeId);
  const today = istDate();
  const open = (Array.isArray(rows) ? rows : [])
    .filter((task) => !['completed', 'done', 'cancelled', 'closed'].includes(String(task.status || '').toLowerCase()))
    .sort((a, b) => String(a.deadline || '9999').localeCompare(String(b.deadline || '9999')));
  return {
    open: open.length,
    overdue: open.filter((task) => task.deadline && String(task.deadline).slice(0, 10) < today).length,
    items: open.slice(0, LIST_LIMIT).map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      deadline: task.deadline,
      projectId: task.projectId,
      projectTitle: task.projectTitle || ''
    }))
  };
}

async function meetings(user) {
  const today = istDate();
  const result = await query(
    `select id, title, event_type, start_time, end_time, location, lead_id, client_id, project_id
       from lead_events
      where start_date = $1::date
        and event_type <> 'task'
        and (owner_user_id = $2 or allowed_user_ids ? $2 or visibility = 'all_team')
      order by coalesce(start_time, '99:99') asc
      limit ${LIST_LIMIT}`,
    [today, String(user.id)]
  );
  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    type: row.event_type,
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location,
    leadId: row.lead_id,
    clientId: row.client_id,
    projectId: row.project_id
  }));
}

async function leads(user, settings) {
  const { closed } = leadStates(settings);
  const today = istDate();
  const mine = 'l.assigned_to = $1';
  const [byStatus, totals, recent] = await Promise.all([
    query(`select coalesce(l.status, 'New') as status, count(*)::int as count from leads l where ${mine} group by 1 order by 2 desc`, [user.id]),
    query(
      `select count(*)::int as total,
              count(*) filter (where lower(coalesce(l.lead_temperature, '')) = 'hot' and not (coalesce(l.status, '') = any($2::text[])))::int as hot,
              count(*) filter (where (l.created_at at time zone '${TIMEZONE}')::date = $3::date)::int as new_today,
              count(*) filter (where coalesce(l.next_follow_up_time, '') = '' and not (coalesce(l.status, '') = any($2::text[])))::int as no_follow_up
         from leads l where ${mine}`,
      [user.id, closed, today]
    ),
    query(
      `select l.id, l.name, l.company_name, l.status, l.lead_temperature, l.next_follow_up_time, l.created_at
         from leads l
        where ${mine} and not (coalesce(l.status, '') = any($2::text[]))
        order by (lower(coalesce(l.lead_temperature, '')) = 'hot') desc, l.created_at desc
        limit 6`,
      [user.id, closed]
    )
  ]);
  const colors = Object.fromEntries((settings?.statuses?.leads || []).map((item) => [item.label, item.color]));
  const t = totals.rows[0] || {};
  return {
    total: t.total || 0,
    hot: t.hot || 0,
    newToday: t.new_today || 0,
    noFollowUp: t.no_follow_up || 0,
    byStatus: byStatus.rows.map((row) => ({ status: row.status, count: row.count, color: colors[row.status] || null })),
    items: recent.rows.map((row) => ({
      id: row.id,
      name: row.name,
      company: row.company_name,
      status: row.status,
      temperature: row.lead_temperature,
      nextFollowUp: row.next_follow_up_time,
      createdAt: row.created_at
    }))
  };
}

async function hrm(user) {
  const summary = await require('./hrm/profileSummary').summary(user, user.hrmEmployeeId);
  const today = istDate();
  const holidays = await query(
    `select name, work_date, optional from hrm_holidays where work_date >= $1::date order by work_date asc limit 3`,
    [today]
  );
  return {
    month: summary.month,
    leave: summary.leave,
    pendingRequests: summary.pendingRequests,
    workReports: summary.workReports,
    holidays: holidays.rows.map((row) => ({ name: row.name, date: row.work_date, optional: Boolean(row.optional) }))
  };
}

async function notifications(user) {
  const rows = await notificationService.listNotifications(user.id, { limit: 5 });
  const unread = await query(`select count(*)::int as count from notifications where user_id = $1 and coalesce(is_read, false) = false`, [String(user.id)]);
  return {
    unread: unread.rows[0]?.count || 0,
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      message: row.message,
      severity: row.severity,
      isRead: Boolean(row.isRead),
      moduleName: row.moduleName,
      entityId: row.entityId,
      createdAt: row.createdAt
    }))
  };
}

async function performance(user, settings, flags) {
  const today = istDate();
  const from = monthStart(today);
  const { won } = leadStates(settings);
  const tasks = [];
  if (flags.leads) {
    tasks.push(query(
      `select count(*) filter (where (l.created_at at time zone '${TIMEZONE}')::date >= $2::date)::int as assigned,
              count(*) filter (where l.status = any($3::text[]) and (coalesce(l.last_status_changed_at, l.updated_at) at time zone '${TIMEZONE}')::date >= $2::date)::int as won
         from leads l where l.assigned_to = $1`,
      [user.id, from, won]
    ).then((r) => ({ leadsAssigned: r.rows[0]?.assigned || 0, leadsWon: r.rows[0]?.won || 0 })));
  }
  if (flags.followUps) {
    tasks.push(query(
      `select count(*) filter (where status = 'Completed')::int as done,
              count(*) filter (where status = 'Completed' and updated_at <= due_at)::int as on_time
         from follow_ups
        where deleted_at is null and coalesce(completed_by, assigned_to) = $1
          and (updated_at at time zone '${TIMEZONE}')::date >= $2::date`,
      [user.id, from]
    ).then((r) => ({ followUpsDone: r.rows[0]?.done || 0, followUpsOnTime: r.rows[0]?.on_time || 0 })));
  }
  if (flags.calls) {
    tasks.push(query(
      `select count(*)::int as calls, coalesce(sum(duration_seconds), 0)::int as seconds
         from call_logs where user_id = $1 and (started_at at time zone '${TIMEZONE}')::date >= $2::date`,
      [user.id, from]
    ).then((r) => ({ calls: r.rows[0]?.calls || 0, callMinutes: Math.round((r.rows[0]?.seconds || 0) / 60) })));
  }
  const parts = await Promise.all(tasks);
  return Object.assign({ from }, ...parts);
}

async function myDashboard(user) {
  const settings = (await getSettings()) || {};
  const flags = {
    followUps: hasAny(user, ['followups.view_own', 'followups.view_team', 'followups.view_all']),
    leads: hasAny(user, ['leads.read']),
    calls: hasAny(user, ['calls.read']),
    hrm: Boolean(user?.hrmEmployeeId) && hasAny(user, ['hrm.self_service', 'hrm.view_own'])
  };
  const [follow, task, meet, lead, hr, notes, perf] = await Promise.all([
    flags.followUps ? section('followUps', () => followUps(user)) : null,
    flags.hrm ? section('tasks', () => tasks(user)) : null,
    section('meetings', () => meetings(user)),
    flags.leads ? section('leads', () => leads(user, settings)) : null,
    flags.hrm ? section('hrm', () => hrm(user)) : null,
    section('notifications', () => notifications(user)),
    section('performance', () => performance(user, settings, flags))
  ]);
  return {
    user: { id: user.id, name: user.fullName || user.username || '', hasEmployeeProfile: Boolean(user?.hrmEmployeeId) },
    date: istDate(),
    timezone: TIMEZONE,
    followUps: follow,
    tasks: task,
    meetings: meet,
    leads: lead,
    hrm: hr,
    notifications: notes,
    performance: perf
  };
}

module.exports = { myDashboard, _private: { leadStates, istDate } };
