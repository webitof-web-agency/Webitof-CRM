import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { normalizeSharedLabels } from '../../lib/labels';
import { cn } from '../../lib/cn';

const PRESET_COLORS = ['#7c3aed', '#2563eb', '#06b6d4', '#10b981', '#84cc16', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#64748b', '#14b8a6', '#c084fc'];

function makeEmptyLabel(color = PRESET_COLORS[0]) {
  return { label: '', color };
}

export function LabelManagerModal({ open, onClose, onSaved }) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [labels, setLabels] = useState([]);
  const [draft, setDraft] = useState(makeEmptyLabel());
  const [editingIndex, setEditingIndex] = useState(-1);

  useEffect(() => {
    if (!open) return;

    let active = true;
    async function load() {
      setLoading(true);
      try {
        const res = await api.settings.get(token);
        if (!active) return;
        setLabels(normalizeSharedLabels(res.data?.labels || []));
      } catch (error) {
        if (active) toast.error(error.message || 'Failed to load labels');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [open, token]);

  useEffect(() => {
    if (!open) {
      setDraft(makeEmptyLabel());
      setEditingIndex(-1);
    }
  }, [open]);

  const normalizedLabels = useMemo(() => labels.map((item) => ({
    ...item,
    color: item.color || '#64748b'
  })), [labels]);

  const commitDraft = () => {
    const value = String(draft.label || '').trim();
    if (!value) {
      toast.error('Label cannot be empty');
      return false;
    }

    const duplicateIndex = labels.findIndex((item, index) => item.label.toLowerCase() === value.toLowerCase() && index !== editingIndex);
    if (duplicateIndex >= 0) {
      toast.error('This label already exists');
      return false;
    }

    setLabels((current) => {
      const next = [...current];
      const entry = { value, label: value, color: draft.color || PRESET_COLORS[0], state: 'open' };
      if (editingIndex >= 0 && editingIndex < next.length) {
        next[editingIndex] = entry;
      } else {
        next.push(entry);
      }
      return next;
    });

    setDraft(makeEmptyLabel());
    setEditingIndex(-1);
    return true;
  };

  async function handleSave() {
    setSaving(true);
    try {
      const response = await api.settings.save(token, { labels: labels.map((item) => ({
        label: item.label,
        color: item.color || PRESET_COLORS[0],
        state: item.state || 'open'
      })) });
      onSaved?.(response.data?.labels || labels);
      toast.success('Labels saved');
      onClose?.();
    } catch (error) {
      toast.error(error.message || 'Failed to save labels');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Manage labels"
      subtitle="Create one shared label list used across leads, clients, tasks, notes, and reminders."
      width="min(920px, 96vw)"
      footer={(
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Close</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : (
              <>
                <Save size={16} className="mr-2" />
                Save labels
              </>
            )}
          </Button>
        </div>
      )}
    >
      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="flex-1">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Label</label>
                <Input
                  value={draft.label}
                  onChange={(e) => setDraft((current) => ({ ...current, label: e.target.value }))}
                  placeholder="Enter label name"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setDraft((current) => ({ ...current, color }))}
                    className={cn(
                      'h-7 w-7 rounded-full border transition',
                      draft.color === color ? 'ring-2 ring-slate-300 ring-offset-1' : 'border-transparent'
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`Select label color ${color}`}
                    title={color}
                  />
                ))}
              </div>
              <Button type="button" onClick={commitDraft} className="md:self-end">
                {editingIndex >= 0 ? <Pencil size={16} className="mr-2" /> : <Plus size={16} className="mr-2" />}
                {editingIndex >= 0 ? 'Update' : 'Add'}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Created labels</h4>
              <span className="text-sm text-slate-500">{normalizedLabels.length} total</span>
            </div>

            {normalizedLabels.length ? (
              <div className="flex flex-wrap gap-2">
                {normalizedLabels.map((item, index) => (
                  <div
                    key={`${item.label}-${index}`}
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium"
                    style={{
                      backgroundColor: `${item.color}14`,
                      borderColor: `${item.color}2A`,
                      color: item.color
                    }}
                  >
                    <span>{item.label}</span>
                    <button
                      type="button"
                      className="rounded-full p-0.5 hover:bg-white/70"
                      onClick={() => {
                        setEditingIndex(index);
                        setDraft({ label: item.label, color: item.color });
                      }}
                      aria-label={`Edit ${item.label}`}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className="rounded-full p-0.5 hover:bg-white/70"
                      onClick={() => setLabels((current) => current.filter((_, i) => i !== index))}
                      aria-label={`Delete ${item.label}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                No labels created yet.
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
