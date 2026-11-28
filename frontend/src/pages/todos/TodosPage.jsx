import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlarmClock, CalendarClock, CheckCircle2, ListTodo, Plus, Search, Sun, Inbox, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { istDate } from '../../lib/format';
import { cn } from '../../lib/cn';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { TodoFormModal } from '../../components/todos/TodoFormModal';
import { TodoList } from '../../components/todos/TodoList';

const VIEWS = [
  { id: 'today', label: 'Today', icon: Sun, empty: 'Nothing due today. Nice!' },
  { id: 'overdue', label: 'Overdue', icon: AlarmClock, empty: 'Nothing overdue.' },
  { id: 'upcoming', label: 'Upcoming', icon: CalendarClock, empty: 'Nothing coming up.' },
  { id: 'open', label: 'All open', icon: Inbox, empty: 'No open todos.' },
  { id: 'done', label: 'Done', icon: CheckCircle2, empty: 'Nothing completed yet.' },
  { id: 'all', label: 'Everything', icon: Layers, empty: 'No todos yet.' }
];

const SCOPES = [
  { value: 'mine', label: 'Mine (made by me or for me)' },
  { value: 'assigned_to_me', label: 'Assigned to me' },
  { value: 'created_by_me', label: 'I assigned to others' }
];

export function TodosPage() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = VIEWS.some((item) => item.id === searchParams.get('view')) ? searchParams.get('view') : 'today';
  const [scope, setScope] = useState('mine');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [canViewAll, setCanViewAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickDate, setQuickDate] = useState(istDate(0));
  const [quickBusy, setQuickBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await api.todos.list(token, { view, scope, search: debouncedSearch });
      setRows(response.data || []);
      setCounts(response.counts || {});
      setCanViewAll(Boolean(response.canViewAll));
    } catch (error) {
      toast.error(error.message || 'Could not load todos');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, scope, token, view]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // ?focus=<id> (from a notification or the calendar) opens that todo.
  useEffect(() => {
    const focus = searchParams.get('focus');
    if (!focus) return;
    api.todos.get(token, focus)
      .then((response) => { setEditing(response.data); setFormOpen(true); })
      .catch((error) => toast.error(error.message || 'Todo not found'));
    const next = new URLSearchParams(searchParams);
    next.delete('focus');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, token]);

  const scopes = useMemo(() => (canViewAll ? [...SCOPES, { value: 'all', label: 'Everyone' }] : SCOPES), [canViewAll]);
  const current = VIEWS.find((item) => item.id === view);

  function setView(id) {
    const next = new URLSearchParams(searchParams);
    next.set('view', id);
    setSearchParams(next, { replace: true });
  }

  async function toggle(todo) {
    setBusyId(todo.id);
    try {
      await api.todos.update(token, todo.id, { status: todo.status === 'done' ? 'todo' : 'done' });
      if (todo.status !== 'done') toast.success('Done!');
      await load();
    } catch (error) {
      toast.error(error.message || 'Could not update the todo');
    } finally {
      setBusyId('');
    }
  }

  async function quickAdd(event) {
    event.preventDefault();
    if (!quickTitle.trim()) return;
    setQuickBusy(true);
    try {
      await api.todos.create(token, { title: quickTitle.trim(), dueDate: quickDate || '' });
      setQuickTitle('');
      toast.success('Todo added');
      await load();
    } catch (error) {
      toast.error(error.message || 'Could not add the todo');
    } finally {
      setQuickBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600"><ListTodo size={18} /></div>
          <div>
            <h1 className="text-lg font-bold text-[var(--text-main)]">Todos</h1>
            <p className="text-xs text-[var(--text-muted)]">Your own tasks and the ones you give colleagues. Due ones also go to Google Calendar.</p>
          </div>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-1.5"><Plus size={15} /> New todo</Button>
      </div>

      <form onSubmit={quickAdd} className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 sm:flex-row">
        <Input value={quickTitle} onChange={(event) => setQuickTitle(event.target.value)} placeholder="Quick add: type a todo and press Enter" className="flex-1" />
        <Input type="date" value={quickDate} onChange={(event) => setQuickDate(event.target.value)} className="sm:w-40" />
        <Button type="submit" loading={quickBusy} disabled={!quickTitle.trim()} className="gap-1.5"><Plus size={14} /> Add</Button>
      </form>

      <div className="flex flex-wrap items-center gap-1.5">
        {VIEWS.map((item) => {
          const Icon = item.icon;
          const active = item.id === view;
          const count = counts[item.id];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition cursor-pointer',
                active ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
              )}
            >
              <Icon size={13} /> {item.label}
              {count ? (
                <span className={cn('rounded-full px-1.5 text-[10px]', active ? 'bg-white/25' : item.id === 'overdue' ? 'bg-rose-500/15 text-rose-600' : 'bg-[var(--surface-2)]')}>{count}</span>
              ) : null}
            </button>
          );
        })}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-2.5 text-[var(--text-muted)]" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search todos" className="h-8 w-48 pl-8 text-xs" />
          </div>
          <div className="w-56"><Select value={scope} onChange={setScope} options={scopes} /></div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3, 4].map((key) => <Skeleton key={key} className="h-12 rounded-xl" />)}</div>
      ) : (
        <TodoList
          todos={rows}
          busyId={busyId}
          onToggle={toggle}
          onOpen={(todo) => { setEditing(todo); setFormOpen(true); }}
          emptyText={current?.empty}
        />
      )}

      <TodoFormModal
        open={formOpen}
        todo={editing}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSaved={() => load()}
      />
    </div>
  );
}
