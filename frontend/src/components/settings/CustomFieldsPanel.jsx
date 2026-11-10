import { useState } from 'react';
import { ListTodo, Lock, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { confirmAction } from '../../lib/confirm';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ThemedSelect } from '../ui/ThemedSelect';

// Built-in values come from backend/config/pipelineFields.js and cannot be changed here.
// Values added here are stored in the database and shown after the built-in ones.
const GROUPS = [
  { id: 'lead-statuses', kind: 'statuses', module: 'leads', title: 'Lead statuses', noun: 'status', withState: true },
  { id: 'lead-sources', kind: 'sources', module: 'leads', title: 'Lead sources', noun: 'source' },
  { id: 'client-statuses', kind: 'statuses', module: 'clients', title: 'Client statuses', noun: 'status' },
  { id: 'project-statuses', kind: 'statuses', module: 'projects', title: 'Project statuses', noun: 'status', withPhase: true }
];

const STATES = [
  { value: 'open', label: 'Open' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' }
];

// Project phase drives the dashboard counts: open = active, completed, cancelled.
const PHASES = [
  { value: 'open', label: 'Active (open)' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' }
];

const EMPTY_DRAFT = { label: '', color: '#3b82f6', state: 'open', phase: 'open' };

const labelOf = (item) => (typeof item === 'string' ? item : item?.label || '');

export function CustomFieldsPanel({ token, canWrite, settings, onSaved }) {
  const [adding, setAdding] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [busy, setBusy] = useState('');

  const listOf = (group) => settings?.[group.kind]?.[group.module] || [];
  const isCustom = (group, item) => (group.kind === 'sources'
    ? (settings?.customSources?.[group.module] || []).includes(item)
    : Boolean(item?.custom));

  async function save(group, nextList, message) {
    setBusy(group.id);
    try {
      const response = await api.settings.save(token, { [group.kind]: { [group.module]: nextList } });
      const data = response?.data || {};
      onSaved({ statuses: data.statuses, sources: data.sources, customSources: data.customSources });
      toast.success(message);
      return true;
    } catch (error) {
      toast.error(error.message || 'Could not save');
      return false;
    } finally {
      setBusy('');
    }
  }

  async function add(group) {
    const label = draft.label.replace(/\s+/g, ' ').trim();
    if (!label) return toast.error(`Enter a ${group.noun} name`);
    if (label.length > 60) return toast.error('Keep the name under 60 characters');
    if (listOf(group).some((item) => labelOf(item).toLowerCase() === label.toLowerCase())) {
      return toast.error(`"${label}" already exists`);
    }
    const entry = group.kind === 'sources'
      ? label
      : {
        label,
        color: draft.color,
        ...(group.withState ? { state: draft.state } : {}),
        ...(group.withPhase ? { phase: draft.phase } : {})
      };
    if (await save(group, [...listOf(group), entry], `${group.title.replace(/s$/, '')} added`)) {
      setAdding(null);
      setDraft(EMPTY_DRAFT);
    }
  }

  async function remove(group, item) {
    const label = labelOf(item);
    const ok = await confirmAction({
      title: `Remove "${label}"?`,
      description: `Records that already use this ${group.noun} keep it; it is no longer offered for new ones.`,
      confirmText: 'Remove',
      type: 'danger'
    });
    if (!ok) return;
    await save(group, listOf(group).filter((entry) => labelOf(entry) !== label), `"${label}" removed`);
  }

  return (
    <Card className="space-y-3 p-4 sm:p-5">
      <div className="mb-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <ListTodo size={18} className="text-slate-800 dark:text-slate-100" />
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Custom Fields</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          <Lock size={11} className="inline -mt-0.5" /> Built-in values are fixed in code
          (<code>backend/config/pipelineFields.js</code>). Values you add here appear after them in every form and board,
          and can be removed again.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {GROUPS.map((group) => {
          const items = listOf(group);
          const open = adding === group.id;
          return (
            <div key={group.id} className="min-w-0">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  {group.title} <span className="font-normal text-slate-400">({items.length})</span>
                </h4>
                {canWrite && !open ? (
                  <button
                    type="button"
                    onClick={() => { setAdding(group.id); setDraft(EMPTY_DRAFT); }}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--hover-bg)]"
                  >
                    <Plus size={13} /> Add
                  </button>
                ) : null}
              </div>

              {open ? (
                <form
                  className="mb-2 space-y-2 rounded-xl border border-[var(--primary)]/30 bg-[var(--surface)] p-2.5"
                  onSubmit={(event) => { event.preventDefault(); add(group); }}
                >
                  <Input
                    autoFocus
                    value={draft.label}
                    maxLength={60}
                    onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
                    placeholder={`New ${group.noun} name`}
                  />
                  {group.kind === 'statuses' ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={draft.color}
                        onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))}
                        className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-transparent p-0.5 dark:border-slate-700"
                        title="Colour"
                      />
                      {group.withState ? (
                        <ThemedSelect
                          value={draft.state}
                          onChange={(event) => setDraft((current) => ({ ...current, state: event.target.value }))}
                          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                        >
                          {STATES.map((state) => <option key={state.value} value={state.value}>{state.label}</option>)}
                        </ThemedSelect>
                      ) : null}
                      {group.withPhase ? (
                        <ThemedSelect
                          value={draft.phase}
                          onChange={(event) => setDraft((current) => ({ ...current, phase: event.target.value }))}
                          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                          title="Counted in the dashboard as"
                        >
                          {PHASES.map((phase) => <option key={phase.value} value={phase.value}>{phase.label}</option>)}
                        </ThemedSelect>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="flex justify-end gap-2">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(null)} disabled={busy === group.id}>Cancel</Button>
                    <Button type="submit" size="sm" loading={busy === group.id}>Add</Button>
                  </div>
                </form>
              ) : null}

              <ul className="max-h-[26rem] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
                {items.map((item) => {
                  const entry = typeof item === 'string' ? { label: item } : item;
                  const custom = isCustom(group, item);
                  return (
                    <li key={entry.label} className="group flex items-center gap-2 px-3 py-1.5 text-[13px] text-slate-700 dark:text-slate-200">
                      {entry.color ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} /> : null}
                      <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                      {entry.state === 'won' ? <span className="text-[10px] font-semibold uppercase text-emerald-600">won</span> : null}
                      {entry.state === 'lost' ? <span className="text-[10px] font-semibold uppercase text-rose-500">lost</span> : null}
                      {entry.phase === 'completed' ? <span className="text-[10px] font-semibold uppercase text-emerald-600">done</span> : null}
                      {entry.phase === 'cancelled' ? <span className="text-[10px] font-semibold uppercase text-rose-500">cancelled</span> : null}
                      {custom ? (
                        <>
                          <span className="rounded bg-[var(--primary-subtle)] px-1 text-[10px] font-semibold text-[var(--primary)]">custom</span>
                          {canWrite ? (
                            <button
                              type="button"
                              onClick={() => remove(group, item)}
                              disabled={busy === group.id}
                              className="rounded p-0.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-50"
                              title={`Remove ${entry.label}`}
                            >
                              <X size={13} />
                            </button>
                          ) : null}
                        </>
                      ) : (
                        <Lock size={11} className="shrink-0 text-slate-300 dark:text-slate-600" aria-label="Built-in" />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Labels are managed from the table headers and shared across leads, clients, tasks, notes and reminders.
      </p>
    </Card>
  );
}
