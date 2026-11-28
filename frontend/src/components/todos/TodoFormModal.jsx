import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { confirmAction } from '../../lib/confirm';
import { istDate } from '../../lib/format';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { Select } from '../ui/Select';
import { cn } from '../../lib/cn';

export const TODO_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
export const TODO_STATUSES = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' }
];
const RELATED_TYPES = ['Lead', 'Client', 'Project', 'Invoice'];
const REMINDERS = [
  { value: 0, label: 'At due time only' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 1440, label: '1 day before' }
];

function dueParts(todo) {
  if (!todo?.dueAt) return { dueDate: '', dueTime: '' };
  const date = new Date(todo.dueAt);
  return {
    dueDate: istDate(0, date),
    dueTime: todo.allDay ? '' : date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' })
  };
}

function emptyTodo(defaults = {}, userId = '') {
  return {
    title: '', description: '', status: 'todo', priority: 'Medium', dueDate: istDate(0), dueTime: '',
    reminderMinutes: 15, assignedTo: userId, relatedEntityType: '', relatedEntityId: '', relatedEntityLabel: '',
    checklist: [], syncToCalendar: true, ...defaults
  };
}

function RelatedPicker({ type, id, label, onChange, locked }) {
  const { token } = useAuth();
  const [text, setText] = useState('');
  const query = useDebouncedValue(text, 250);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!type || query.trim().length < 2) {
      setResults([]);
      return undefined;
    }
    let active = true;
    setLoading(true);
    api.followUps.relatedSearch(token, type, query.trim())
      .then((response) => active && setResults(response.data || []))
      .catch(() => active && setResults([]))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [query, token, type]);

  if (locked) {
    return <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">{type}: {label || id}</div>;
  }
  return (
    <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
      <Select
        value={type}
        onChange={(value) => onChange({ relatedEntityType: value, relatedEntityId: '', relatedEntityLabel: '' })}
        options={[{ value: '', label: 'Not linked' }, ...RELATED_TYPES.map((value) => ({ value, label: value }))]}
      />
      {type ? (
        id ? (
          <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50/70 px-3 py-2 text-xs font-bold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            <span className="truncate">{label || id}</span>
            <button type="button" onClick={() => onChange({ relatedEntityId: '', relatedEntityLabel: '' })} className="ml-2 shrink-0 cursor-pointer text-emerald-700"><X size={13} /></button>
          </div>
        ) : (
          <div className="relative">
            <Search size={13} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
            <Input className="pl-8" value={text} onChange={(event) => setText(event.target.value)} placeholder={`Search ${type.toLowerCase()}…`} />
            {loading ? <Loader2 size={13} className="absolute right-3 top-3 animate-spin text-slate-400" /> : null}
            {results.length ? (
              <div className="absolute left-0 right-0 z-50 mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                {results.map((item) => (
                  <button key={item.id} type="button" onClick={() => { onChange({ relatedEntityId: item.id, relatedEntityLabel: item.label }); setText(''); setResults([]); }} className="block w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-blue-500/10 cursor-pointer">
                    <span className="block font-semibold text-slate-800 dark:text-slate-100">{item.label}</span>
                    {item.subtitle ? <span className="block text-[11px] text-slate-500">{item.subtitle}</span> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )
      ) : null}
    </div>
  );
}

// Create / edit a todo. `defaults` pre-fills a new one (e.g. linked to the lead page it was opened from).
export function TodoFormModal({ open, onClose, onSaved, todo = null, defaults = {}, lockRelated = false }) {
  const { token, user } = useAuth();
  const [form, setForm] = useState(emptyTodo(defaults, user?.id));
  const [users, setUsers] = useState([]);
  const [newItem, setNewItem] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setNewItem('');
    setForm(todo
      ? { ...emptyTodo({}, user?.id), ...todo, ...dueParts(todo), checklist: todo.checklist || [] }
      : emptyTodo(defaults, user?.id));
    api.resources.list('/users/lookup', token).then((response) => setUsers(response.data || [])).catch(() => setUsers([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, todo?.id]);

  const userOptions = useMemo(() => users.map((item) => ({ value: item.id, label: item.fullName || item.email })), [users]);

  function set(key, value) {
    setErrors((current) => ({ ...current, [key]: '' }));
    setForm((current) => ({ ...current, [key]: value }));
  }

  function addChecklistItem() {
    const text = newItem.trim();
    if (!text) return;
    set('checklist', [...(form.checklist || []), { id: `chk_${Date.now()}`, text, done: false }]);
    setNewItem('');
  }

  async function save(event) {
    event?.preventDefault?.();
    if (!form.title.trim()) {
      setErrors({ title: 'Title is required' });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        title: form.title, description: form.description, status: form.status, priority: form.priority,
        dueDate: form.dueDate || '', dueTime: form.dueDate ? form.dueTime : '', reminderMinutes: Number(form.reminderMinutes),
        assignedTo: form.assignedTo || user?.id, relatedEntityType: form.relatedEntityType, relatedEntityId: form.relatedEntityId,
        relatedEntityLabel: form.relatedEntityLabel, checklist: form.checklist, syncToCalendar: form.syncToCalendar
      };
      const response = todo?.id ? await api.todos.update(token, todo.id, payload) : await api.todos.create(token, payload);
      toast.success(todo?.id ? 'Todo updated' : 'Todo added');
      onSaved?.(response.data);
      onClose();
    } catch (error) {
      setErrors(error.payload?.details || {});
      toast.error(error.message || 'Could not save the todo');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!todo?.id) return;
    const ok = await confirmAction({ title: 'Delete this todo?', description: 'It is also removed from the Google Calendar it was in.', confirmText: 'Delete', type: 'danger' });
    if (!ok) return;
    setBusy(true);
    try {
      await api.todos.remove(token, todo.id);
      toast.success('Todo deleted');
      onSaved?.(null);
      onClose();
    } catch (error) {
      toast.error(error.message || 'Could not delete the todo');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={todo?.id ? 'Edit todo' : 'New todo'}
      width="min(620px, 96vw)"
      footer={(
        <div className="flex items-center justify-between gap-2">
          <div>
            {todo?.id && (String(todo.createdBy) === String(user?.id) || user?.isSuperAdmin) ? (
              <Button type="button" variant="ghost" size="sm" onClick={remove} disabled={busy} className="gap-1.5 text-rose-600">
                <Trash2 size={14} /> Delete
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" form="todo-form" loading={busy}>{todo?.id ? 'Save changes' : 'Add todo'}</Button>
          </div>
        </div>
      )}
    >
      <form id="todo-form" onSubmit={save} className="space-y-3">
        <div>
          <Input value={form.title} onChange={(event) => set('title', event.target.value)} placeholder="What needs to be done?" autoFocus />
          {errors.title ? <span className="mt-1 block text-xs font-semibold text-rose-500">{errors.title}</span> : null}
        </div>
        <Textarea value={form.description} onChange={(event) => set('description', event.target.value)} rows={2} placeholder="Details (optional)" />

        <div className="grid gap-2.5 sm:grid-cols-3">
          <label className="space-y-1">
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">Due date</span>
            <Input type="date" value={form.dueDate} onChange={(event) => set('dueDate', event.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">Time <span className="font-normal text-slate-400">(empty = all day)</span></span>
            <Input type="time" value={form.dueTime} onChange={(event) => set('dueTime', event.target.value)} disabled={!form.dueDate} />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">Remind me</span>
            <Select value={String(form.reminderMinutes)} onChange={(value) => set('reminderMinutes', Number(value))} options={REMINDERS.map((item) => ({ value: String(item.value), label: item.label }))} />
          </label>
        </div>
        {errors.dueDate ? <span className="block text-xs font-semibold text-rose-500">{errors.dueDate}</span> : null}

        <div>
          <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">Priority</span>
          <div className="grid grid-cols-4 gap-2">
            {TODO_PRIORITIES.map((priority) => (
              <button key={priority} type="button" onClick={() => set('priority', priority)} className={cn('rounded-xl border px-2 py-1.5 text-xs font-semibold transition cursor-pointer', form.priority === priority ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200')}>
                {priority}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">Assign to</span>
            <Select value={form.assignedTo} onChange={(value) => set('assignedTo', value)} options={userOptions} placeholder="Me" />
            {errors.assignedTo ? <span className="block text-xs font-semibold text-rose-500">{errors.assignedTo}</span> : null}
          </label>
          {todo?.id ? (
            <label className="space-y-1">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">Status</span>
              <Select value={form.status} onChange={(value) => set('status', value)} options={TODO_STATUSES} />
            </label>
          ) : null}
        </div>

        <div className="space-y-1">
          <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">Linked to</span>
          <RelatedPicker
            type={form.relatedEntityType}
            id={form.relatedEntityId}
            label={form.relatedEntityLabel}
            locked={lockRelated && Boolean(form.relatedEntityId)}
            onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
          />
        </div>

        <div className="space-y-1.5">
          <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">Checklist</span>
          {(form.checklist || []).map((item, index) => (
            <div key={item.id || index} className="flex items-center gap-2">
              <button type="button" onClick={() => set('checklist', form.checklist.map((row, i) => (i === index ? { ...row, done: !row.done } : row)))} className={cn('flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border cursor-pointer', item.done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300')}>
                {item.done ? <Check size={11} /> : null}
              </button>
              <input value={item.text} onChange={(event) => set('checklist', form.checklist.map((row, i) => (i === index ? { ...row, text: event.target.value } : row)))} className={cn('flex-1 bg-transparent text-sm outline-none', item.done && 'text-slate-400 line-through')} />
              <button type="button" onClick={() => set('checklist', form.checklist.filter((_, i) => i !== index))} className="shrink-0 cursor-pointer text-slate-400 hover:text-rose-600"><X size={13} /></button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input value={newItem} onChange={(event) => setNewItem(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addChecklistItem(); } }} placeholder="Add a step and press Enter" />
            <Button type="button" variant="outline" size="sm" onClick={addChecklistItem} className="shrink-0"><Plus size={14} /></Button>
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={form.syncToCalendar} onChange={(event) => set('syncToCalendar', event.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
          <CalendarDays size={14} className="text-sky-600" /> Put it in the assignee's Google Calendar (when connected)
        </label>
      </form>
    </Modal>
  );
}
