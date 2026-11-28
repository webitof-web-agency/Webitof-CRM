// Todos: personal or assigned to a colleague, optionally linked to a lead / client / project.
// Who sees what: your own (created by you or assigned to you); todos.view_all opens everyone's.
// The assignee and the creator may change a todo; only the creator (or view_all) may delete it.
// Assigning, completing and due reminders notify through the normal notification channels, and a
// todo with a due date sits in the assignee's Google Calendar (calendarSync.service).
const { query } = require('../config/db');
const todoModel = require('../models/todo.model');
const { hasPermission } = require('../middlewares/auth');
const { createId } = require('../utils/format');

const STATUSES = ['todo', 'in_progress', 'done'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const VIEWS = ['today', 'upcoming', 'overdue', 'open', 'done', 'all'];
const RELATED_TYPES = ['', 'Lead', 'Client', 'Project', 'Invoice', 'AMC', 'Renewal'];
const RELATED_ROUTES = {
  Lead: (id) => `/app/leads/${id}`,
  Client: (id) => `/app/clients/${id}`,
  Project: (id) => `/app/projects/${id}`,
  Invoice: (id) => `/app/invoices/${id}`,
  AMC: (id) => `/app/amc/${id}`,
  Renewal: () => '/app/renewals'
};

function httpError(message, statusCode = 400, details = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = true;
  if (details) error.details = details;
  return error;
}

function canViewAll(user) {
  return Boolean(user?.isSuperAdmin || hasPermission(user, 'todos.view_all'));
}

function isInvolved(todo, user) {
  const me = String(user?.id || '');
  return [todo.assignedTo, todo.createdBy].some((id) => String(id || '') === me);
}

function assertCanSee(todo, user) {
  if (!todo || todo.deletedAt) throw httpError('Todo not found', 404);
  if (!canViewAll(user) && !isInvolved(todo, user)) throw httpError('Todo not found', 404);
}

// ─── input ──────────────────────────────────────────────────────────────────────

function istIso(date, time) {
  const value = new Date(`${String(date).slice(0, 10)}T${time || '00:00'}:00+05:30`);
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

// dueDate (YYYY-MM-DD) + dueTime (HH:mm, optional: no time = all day) or a full dueAt.
function parseDue(body = {}, current = null) {
  if (body.dueDate === '' || body.dueAt === '' || body.dueAt === null) return { dueAt: null, allDay: false };
  if (body.dueDate) {
    const time = /^\d{2}:\d{2}/.test(String(body.dueTime || '')) ? String(body.dueTime).slice(0, 5) : '';
    const dueAt = istIso(body.dueDate, time || '09:00');
    if (!dueAt) throw httpError('Enter a valid due date', 400, { dueDate: 'Enter a valid due date' });
    return { dueAt, allDay: !time };
  }
  if (body.dueAt) {
    const value = new Date(body.dueAt);
    if (Number.isNaN(value.getTime())) throw httpError('Enter a valid due date', 400, { dueDate: 'Enter a valid due date' });
    return { dueAt: value.toISOString(), allDay: Boolean(body.allDay) };
  }
  return current ? { dueAt: current.dueAt, allDay: current.allDay } : { dueAt: null, allDay: false };
}

function normalizeChecklist(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      id: String(item?.id || createId('chk')).slice(0, 60),
      text: String(item?.text || '').trim().slice(0, 300),
      done: Boolean(item?.done)
    }))
    .filter((item) => item.text)
    .slice(0, 50);
}

function normalizeTags(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(list.map((tag) => String(tag || '').trim()).filter(Boolean))].slice(0, 20);
}

async function assertActiveUser(userId) {
  if (!userId) return;
  const result = await query('select id from users where id = $1 and is_active = true', [String(userId)]);
  if (!result.rows[0]) throw httpError('Choose an active user to assign this todo to', 400, { assignedTo: 'Choose an active user' });
}

// ─── reading ────────────────────────────────────────────────────────────────────

async function userNames() {
  const result = await query('select id, full_name from users');
  return new Map(result.rows.map((row) => [String(row.id), row.full_name]));
}

function decorate(todo, names) {
  if (!todo) return null;
  const now = Date.now();
  const due = todo.dueAt ? new Date(todo.dueAt).getTime() : null;
  return {
    ...todo,
    assigneeName: names.get(String(todo.assignedTo || '')) || '',
    creatorName: names.get(String(todo.createdBy || '')) || '',
    relatedRoute: todo.relatedEntityType && todo.relatedEntityId && RELATED_ROUTES[todo.relatedEntityType]
      ? RELATED_ROUTES[todo.relatedEntityType](todo.relatedEntityId)
      : '',
    isOverdue: Boolean(due && todo.status !== 'done' && (todo.allDay ? due + 86400000 : due) < now),
    checklistDone: (todo.checklist || []).filter((item) => item.done).length,
    checklistTotal: (todo.checklist || []).length
  };
}

const IST_TODAY = `(now() at time zone 'Asia/Kolkata')::date`;
const VIEW_SQL = {
  today: `t.status <> 'done' and t.due_at is not null and (t.due_at at time zone 'Asia/Kolkata')::date <= ${IST_TODAY}`,
  upcoming: `t.status <> 'done' and t.due_at is not null and (t.due_at at time zone 'Asia/Kolkata')::date > ${IST_TODAY}`,
  overdue: `t.status <> 'done' and t.due_at is not null and ((t.all_day and (t.due_at at time zone 'Asia/Kolkata')::date < ${IST_TODAY}) or (not t.all_day and t.due_at < now()))`,
  open: `t.status <> 'done'`,
  done: `t.status = 'done'`,
  all: 'true'
};

function buildWhere(filters = {}, user, values) {
  const clauses = ['t.deleted_at is null'];
  const add = (sql, value) => {
    values.push(value);
    clauses.push(sql.replace('?', `$${values.length}`));
  };
  const me = String(user?.id || '');
  const scope = String(filters.scope || 'mine');
  if (scope === 'assigned_to_me') add('t.assigned_to = ?', me);
  else if (scope === 'created_by_me') add('t.created_by = ?', me);
  else if (scope === 'all' && canViewAll(user)) {
    if (filters.assignedTo) add('t.assigned_to = ?', String(filters.assignedTo));
  } else {
    values.push(me);
    clauses.push(`(t.assigned_to = $${values.length} or t.created_by = $${values.length})`);
  }
  if (filters.relatedEntityType) add('t.related_entity_type = ?', String(filters.relatedEntityType));
  if (filters.relatedEntityId) add('t.related_entity_id = ?', String(filters.relatedEntityId));
  if (filters.priority && PRIORITIES.includes(filters.priority)) add('t.priority = ?', filters.priority);
  if (filters.status && STATUSES.includes(filters.status)) add('t.status = ?', filters.status);
  if (filters.search) {
    values.push(`%${String(filters.search).trim().toLowerCase()}%`);
    clauses.push(`(lower(t.title) like $${values.length} or lower(t.description) like $${values.length} or lower(t.related_entity_label) like $${values.length})`);
  }
  return clauses;
}

async function listTodos(filters = {}, user) {
  const view = VIEWS.includes(filters.view) ? filters.view : 'open';
  const values = [];
  const clauses = buildWhere(filters, user, values);
  const limit = Math.min(500, Math.max(1, Number(filters.limit || 200)));
  const order = view === 'done'
    ? 't.completed_at desc nulls last, t.updated_at desc'
    : `t.due_at asc nulls last, array_position(array['Critical','High','Medium','Low'], t.priority), t.created_at desc`;
  const rows = await query(
    `select t.* from todos t where ${[...clauses, VIEW_SQL[view]].join(' and ')} order by ${order} limit ${limit}`,
    values
  );
  const countValues = [];
  const countClauses = buildWhere({ ...filters, status: '' }, user, countValues).join(' and ');
  const counts = await query(
    `select ${Object.entries(VIEW_SQL).map(([key, sql]) => `count(*) filter (where ${sql})::int as "${key}"`).join(', ')}
     from todos t where ${countClauses}`,
    countValues
  );
  const names = await userNames();
  return {
    rows: rows.rows.map((row) => decorate(todoModel.hydrateRow(row), names)),
    counts: counts.rows[0] || {},
    view,
    canViewAll: canViewAll(user)
  };
}

async function getTodo(id, user) {
  const todo = await todoModel.findByExactId(id);
  assertCanSee(todo, user);
  return decorate(todo, await userNames());
}

// ─── notifications ──────────────────────────────────────────────────────────────

function formatDue(row) {
  const dueAt = row.dueAt || row.due_at;
  if (!dueAt) return '';
  const allDay = row.allDay ?? row.all_day;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    ...(allDay ? {} : { hour: 'numeric', minute: '2-digit', hour12: true })
  }).format(new Date(dueAt)) + (allDay ? ' (all day)' : '');
}

// The detail rows a todo notification shows (email table, WhatsApp lines, push text).
function todoDetails(row, users = new Map()) {
  const get = (camel, snake) => row[camel] ?? row[snake];
  const creatorId = String(get('createdBy', 'created_by') || '');
  const creator = users instanceof Map ? (users.get(creatorId)?.fullName || users.get(creatorId) || '') : '';
  const checklist = Array.isArray(row.checklist) ? row.checklist : [];
  return [
    { label: 'Due', value: formatDue(row) || 'No due date' },
    { label: 'Priority', value: get('priority', 'priority') || 'Medium' },
    get('relatedEntityLabel', 'related_entity_label') ? { label: get('relatedEntityType', 'related_entity_type') || 'Related', value: get('relatedEntityLabel', 'related_entity_label') } : null,
    creator ? { label: 'Assigned by', value: typeof creator === 'string' ? creator : '' } : null,
    checklist.length ? { label: 'Checklist', value: `${checklist.filter((item) => item.done).length} of ${checklist.length} done` } : null,
    get('description', 'description') ? { label: 'Details', value: String(get('description', 'description')).slice(0, 300) } : null
  ].filter((item) => item && item.value);
}

async function notifyUser(userId, { eventKey, title, message, todo, actorUserId, severity = 'info' }) {
  if (!userId || String(userId) === String(actorUserId || '')) return;
  try {
    const { listUsers } = require('./auth.service');
    const users = await listUsers();
    const user = users.find((item) => String(item.id) === String(userId));
    if (!user || user.isActive === false) return;
    const names = new Map(users.map((item) => [String(item.id), item.fullName]));
    await require('./notification.service').createInternalNotification({
      user,
      moduleName: 'todos',
      eventKey,
      entity: { id: todo.id, entityType: 'todo' },
      title,
      message,
      severity,
      actorUserId,
      routePath: `/app/todos?focus=${todo.id}`,
      payload: { details: todoDetails(todo, names) }
    });
  } catch (error) {
    console.error('[Todos] Notification failed:', error.message);
  }
}

// ─── writing ────────────────────────────────────────────────────────────────────

async function createTodo(body = {}, user) {
  const title = String(body.title || '').trim();
  if (!title) throw httpError('Title is required', 400, { title: 'Title is required' });
  const assignedTo = String(body.assignedTo || user.id);
  await assertActiveUser(assignedTo);
  const { dueAt, allDay } = parseDue(body);
  const relatedType = RELATED_TYPES.includes(body.relatedEntityType) ? body.relatedEntityType : '';
  const todo = await todoModel.create({
    title: title.slice(0, 300),
    description: String(body.description || '').trim().slice(0, 5000),
    status: STATUSES.includes(body.status) ? body.status : 'todo',
    priority: PRIORITIES.includes(body.priority) ? body.priority : 'Medium',
    dueAt,
    allDay,
    reminderMinutes: Math.max(0, Math.min(1440, Number(body.reminderMinutes ?? 15))),
    assignedTo,
    createdBy: String(user.id),
    relatedEntityType: relatedType,
    relatedEntityId: relatedType ? String(body.relatedEntityId || '') : '',
    relatedEntityLabel: relatedType ? String(body.relatedEntityLabel || body.relatedEntityId || '').slice(0, 300) : '',
    checklist: normalizeChecklist(body.checklist),
    tags: normalizeTags(body.tags),
    syncToCalendar: body.syncToCalendar !== false,
    completedAt: body.status === 'done' ? new Date().toISOString() : null,
    completedBy: body.status === 'done' ? String(user.id) : null,
    deletedAt: null
  });
  if (assignedTo !== String(user.id)) {
    await notifyUser(assignedTo, {
      eventKey: 'assigned',
      title: `New todo for you: ${todo.title}`,
      message: `${user.fullName || 'A colleague'} assigned you a todo.`,
      todo,
      actorUserId: user.id
    });
  }
  return getTodo(todo.id, user);
}

async function updateTodo(id, body = {}, user) {
  const current = await todoModel.findByExactId(id);
  assertCanSee(current, user);
  const patch = {};
  if (body.title !== undefined) {
    const title = String(body.title || '').trim();
    if (!title) throw httpError('Title is required', 400, { title: 'Title is required' });
    patch.title = title.slice(0, 300);
  }
  if (body.description !== undefined) patch.description = String(body.description || '').trim().slice(0, 5000);
  if (body.priority !== undefined && PRIORITIES.includes(body.priority)) patch.priority = body.priority;
  if (body.reminderMinutes !== undefined) patch.reminderMinutes = Math.max(0, Math.min(1440, Number(body.reminderMinutes) || 0));
  if (body.dueDate !== undefined || body.dueAt !== undefined) Object.assign(patch, parseDue(body, current));
  if (body.checklist !== undefined) patch.checklist = normalizeChecklist(body.checklist);
  if (body.tags !== undefined) patch.tags = normalizeTags(body.tags);
  if (body.syncToCalendar !== undefined) patch.syncToCalendar = Boolean(body.syncToCalendar);
  if (body.relatedEntityType !== undefined) {
    const relatedType = RELATED_TYPES.includes(body.relatedEntityType) ? body.relatedEntityType : '';
    patch.relatedEntityType = relatedType;
    patch.relatedEntityId = relatedType ? String(body.relatedEntityId || '') : '';
    patch.relatedEntityLabel = relatedType ? String(body.relatedEntityLabel || body.relatedEntityId || '').slice(0, 300) : '';
  }
  let reassignedTo = null;
  if (body.assignedTo !== undefined && String(body.assignedTo || '') !== String(current.assignedTo || '')) {
    const next = String(body.assignedTo || user.id);
    await assertActiveUser(next);
    patch.assignedTo = next;
    reassignedTo = next;
  }
  let completedNow = false;
  if (body.status !== undefined && STATUSES.includes(body.status) && body.status !== current.status) {
    patch.status = body.status;
    if (body.status === 'done') {
      patch.completedAt = new Date().toISOString();
      patch.completedBy = String(user.id);
      completedNow = true;
    } else {
      patch.completedAt = null;
      patch.completedBy = null;
    }
  }
  if (!Object.keys(patch).length) return getTodo(id, user);
  const updated = await todoModel.update(current.id, patch);
  if (reassignedTo && reassignedTo !== String(user.id)) {
    await notifyUser(reassignedTo, {
      eventKey: 'assigned',
      title: `New todo for you: ${updated.title}`,
      message: `${user.fullName || 'A colleague'} assigned you a todo.`,
      todo: updated,
      actorUserId: user.id
    });
  }
  if (completedNow && updated.createdBy && String(updated.createdBy) !== String(user.id)) {
    await notifyUser(updated.createdBy, {
      eventKey: 'completed',
      title: `Todo done: ${updated.title}`,
      message: `${user.fullName || 'The assignee'} marked the todo you gave as done.`,
      todo: updated,
      actorUserId: user.id,
      severity: 'success'
    });
  }
  return getTodo(id, user);
}

async function deleteTodo(id, user) {
  const current = await todoModel.findByExactId(id);
  assertCanSee(current, user);
  if (!canViewAll(user) && String(current.createdBy || '') !== String(user.id)) {
    throw httpError('Only the person who created this todo can delete it', 403);
  }
  await todoModel.update(current.id, { deletedAt: new Date().toISOString() });
  return { deleted: true };
}

module.exports = {
  PRIORITIES,
  STATUSES,
  VIEWS,
  createTodo,
  deleteTodo,
  getTodo,
  listTodos,
  todoDetails,
  updateTodo
};
