import { useCallback, useEffect, useState } from 'react';
import { ListTodo, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { TodoFormModal } from './TodoFormModal';
import { TodoList } from './TodoList';

// Todos linked to one record (a lead, client or project page): open ones first, a few done ones after.
export function RelatedTodosCard({ relatedEntityType, relatedEntityId, relatedEntityLabel = '', className = '' }) {
  const { token } = useAuth();
  const [todos, setTodos] = useState([]);
  const [busyId, setBusyId] = useState('');
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!relatedEntityId) return;
    try {
      // "all" falls back to the user's own todos on the server when they may not see everyone's.
      const response = await api.todos.list(token, { view: 'all', scope: 'all', relatedEntityType, relatedEntityId, limit: 50 });
      const rows = response.data || [];
      setTodos([...rows.filter((todo) => todo.status !== 'done'), ...rows.filter((todo) => todo.status === 'done').slice(0, 5)]);
    } catch {
      setTodos([]);
    }
  }, [relatedEntityId, relatedEntityType, token]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(todo) {
    setBusyId(todo.id);
    try {
      await api.todos.update(token, todo.id, { status: todo.status === 'done' ? 'todo' : 'done' });
      await load();
    } catch (error) {
      toast.error(error.message || 'Could not update the todo');
    } finally {
      setBusyId('');
    }
  }

  const openCount = todos.filter((todo) => todo.status !== 'done').length;

  return (
    <Card className={`px-4 py-3 border-[var(--border)] bg-[var(--surface)] shadow-sm space-y-2 ${className}`}>
      <div className="flex items-center justify-between border-b border-[var(--border-muted)] pb-2">
        <div className="flex items-center gap-2">
          <ListTodo size={16} className="text-[var(--primary)]" />
          <h3 className="text-sm font-bold text-[var(--text-main)]">Todos</h3>
          {openCount ? <span className="rounded-full bg-blue-500/10 px-1.5 text-[10px] font-bold text-blue-600">{openCount} open</span> : null}
        </div>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus size={13} /> Add todo
        </Button>
      </div>
      <TodoList
        todos={todos}
        busyId={busyId}
        compact
        onToggle={toggle}
        onOpen={(todo) => { setEditing(todo); setOpen(true); }}
        emptyText="No todos for this record yet."
      />
      <TodoFormModal
        open={open}
        todo={editing}
        lockRelated
        defaults={{ relatedEntityType, relatedEntityId, relatedEntityLabel }}
        onClose={() => { setOpen(false); setEditing(null); }}
        onSaved={() => load()}
      />
    </Card>
  );
}
