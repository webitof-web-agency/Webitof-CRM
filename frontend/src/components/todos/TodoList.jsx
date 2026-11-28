import { Link } from 'react-router-dom';
import { AlarmClock, CalendarDays, Check, ListChecks, UserRound } from 'lucide-react';
import { cn } from '../../lib/cn';

const PRIORITY_COLORS = { Critical: '#e11d48', High: '#f59e0b', Medium: '#2563eb', Low: '#64748b' };

export function formatTodoDue(todo) {
  if (!todo?.dueAt) return '';
  const date = new Date(todo.dueAt);
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
  const tomorrow = new Date(Date.now() + 86400000);
  const tomorrowKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(tomorrow);
  const day = dayKey === todayKey ? 'Today' : dayKey === tomorrowKey ? 'Tomorrow'
    : new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' }).format(date);
  if (todo.allDay) return day;
  const time = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
  return `${day}, ${time}`;
}

// One line per todo: tick to complete, click to open. Used on the Todos page and on lead pages.
export function TodoList({ todos = [], onToggle, onOpen, busyId = '', compact = false, showAssignee = true, emptyText = 'Nothing here.' }) {
  if (!todos.length) {
    return <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">{emptyText}</div>;
  }
  return (
    <div className="divide-y divide-[var(--border-muted)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      {todos.map((todo) => {
        const done = todo.status === 'done';
        const color = PRIORITY_COLORS[todo.priority] || PRIORITY_COLORS.Medium;
        return (
          <div key={todo.id} className={cn('group flex items-start gap-3 px-3 transition hover:bg-[var(--surface-2)]', compact ? 'py-2' : 'py-2.5')}>
            <button
              type="button"
              onClick={() => onToggle?.(todo)}
              disabled={busyId === todo.id}
              title={done ? 'Mark as not done' : 'Mark as done'}
              className={cn(
                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition cursor-pointer',
                done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-[var(--border)] hover:border-emerald-500'
              )}
            >
              {done ? <Check size={12} strokeWidth={3} /> : null}
            </button>
            <button type="button" onClick={() => onOpen?.(todo)} className="min-w-0 flex-1 text-left cursor-pointer">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className={cn('text-sm font-semibold', done ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-main)]')}>{todo.title}</span>
                <span className="rounded-full border px-1.5 py-px text-[10px] font-semibold" style={{ color, borderColor: `${color}40`, backgroundColor: `${color}12` }}>{todo.priority}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[var(--text-muted)]">
                {todo.dueAt ? (
                  <span className={cn('inline-flex items-center gap-1', todo.isOverdue && 'font-semibold text-rose-600')}>
                    {todo.isOverdue ? <AlarmClock size={11} /> : <CalendarDays size={11} />}
                    {todo.isOverdue ? 'Overdue · ' : ''}{formatTodoDue(todo)}
                  </span>
                ) : null}
                {todo.checklistTotal ? (
                  <span className="inline-flex items-center gap-1"><ListChecks size={11} /> {todo.checklistDone}/{todo.checklistTotal}</span>
                ) : null}
                {showAssignee && todo.assigneeName ? (
                  <span className="inline-flex items-center gap-1"><UserRound size={11} /> {todo.assigneeName}{todo.creatorName && todo.creatorName !== todo.assigneeName ? ` · by ${todo.creatorName}` : ''}</span>
                ) : null}
              </div>
            </button>
            {todo.relatedEntityLabel ? (
              todo.relatedRoute ? (
                <Link to={todo.relatedRoute} className="hidden max-w-[40%] shrink-0 truncate rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-600 hover:bg-blue-500/20 sm:inline-block">
                  {todo.relatedEntityLabel}
                </Link>
              ) : (
                <span className="hidden max-w-[40%] shrink-0 truncate rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--text-muted)] sm:inline-block">{todo.relatedEntityLabel}</span>
              )
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
