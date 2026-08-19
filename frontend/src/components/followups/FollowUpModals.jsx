import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { Select } from '../ui/Select';

const emptyForm = {
  relatedEntityType: 'Lead', relatedEntityId: '', relatedEntityLabel: '', title: '', followUpType: 'Call',
  purpose: '', date: '', time: '10:00', expectedDurationMinutes: 30, priority: 'Medium', assignedTo: '',
  assignedTeam: '', reminderSettings: [{ channel: 'inApp', minutesBefore: 30 }], description: '', expectedOutcome: '',
  nextAction: '', tagsText: '', location: '', internalNote: '', isRecurring: false, recurrenceFrequency: 'monthly'
};

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowInput() {
  const date = new Date(Date.now() + 24 * 3600000);
  return date.toISOString().slice(0, 10);
}

function Field({ label, required = false, error = '', children, wide = false, helper = '' }) {
  return (
    <label className={wide ? 'md:col-span-2' : ''}>
      <span className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]">{label}{required ? <span className="ml-1 text-rose-500">*</span> : null}</span>
      {children}
      {helper ? <span className="mt-1 block text-[11px] text-[var(--text-muted)]">{helper}</span> : null}
      {error ? <span className="mt-1 block text-xs font-semibold text-rose-500">{error}</span> : null}
    </label>
  );
}

function toOption(value) {
  return { value, label: value };
}

export function FollowUpFormModal({ open, onClose, onSaved, options = {}, initialValue = null }) {
  const { token } = useAuth();
  const [form, setForm] = useState({ ...emptyForm, date: tomorrowInput() });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [relatedOptions, setRelatedOptions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!open) return;
    const source = initialValue || {};
    const due = source.dueAt ? new Date(source.dueAt) : null;
    setForm({
      ...emptyForm,
      ...source,
      date: due && !Number.isNaN(due.getTime()) ? due.toISOString().slice(0, 10) : source.date || tomorrowInput(),
      time: due && !Number.isNaN(due.getTime()) ? due.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: source.timezone || 'Asia/Kolkata' }) : source.time || '10:00',
      tagsText: Array.isArray(source.tags) ? source.tags.join(', ') : '',
      recurrenceFrequency: source.recurrenceRule?.frequency || 'monthly'
    });
    setSearch(source.relatedEntityLabel || '');
    setRelatedOptions(source.relatedEntityId ? [{ value: source.relatedEntityId, label: source.relatedEntityLabel || source.relatedEntityId }] : []);
    setErrors({});
    setDirty(false);
    api.resources.list('/users/lookup', token).then((response) => setUsers(response.data || [])).catch(() => setUsers([]));
  }, [initialValue, open, token]);

  useEffect(() => {
    if (!open || !debouncedSearch.trim() || form.relatedEntityType === 'Custom') return;
    let active = true;
    setSearching(true);
    api.followUps.relatedSearch(token, form.relatedEntityType, debouncedSearch)
      .then((response) => active && setRelatedOptions((response.data || []).map((item) => ({ value: item.id, label: item.label }))))
      .catch(() => active && setRelatedOptions([]))
      .finally(() => active && setSearching(false));
    return () => { active = false; };
  }, [debouncedSearch, form.relatedEntityType, open, token]);

  function set(key, value) {
    setDirty(true);
    setErrors((current) => ({ ...current, [key]: '' }));
    setForm((current) => ({ ...current, [key]: value }));
  }

  function close() {
    if (dirty && !window.confirm('Discard unsaved follow-up changes?')) return;
    onClose();
  }

  function validate() {
    const next = {};
    if (!form.relatedEntityId) next.relatedEntityId = 'Select a related record';
    if (!form.title.trim()) next.title = 'Title is required';
    if (!form.date) next.date = 'Date is required';
    if (!form.time) next.time = 'Time is required';
    if (!form.assignedTo) next.assignedTo = 'Assignee is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save(event) {
    event.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      const selected = relatedOptions.find((item) => String(item.value) === String(form.relatedEntityId));
      const payload = {
        ...form,
        relatedEntityLabel: selected?.label || form.relatedEntityLabel || form.relatedEntityId,
        tags: form.tagsText.split(',').map((item) => item.trim()).filter(Boolean),
        recurrenceRule: form.isRecurring ? { frequency: form.recurrenceFrequency, interval: 1, respectBusinessHours: true } : {},
        timezone: 'Asia/Kolkata'
      };
      const response = initialValue?.id
        ? await api.followUps.update(token, initialValue.id, { ...payload, version: initialValue.version })
        : await api.followUps.create(token, payload);
      const duplicateCount = response.warnings?.duplicates?.length || 0;
      toast.success(initialValue?.id ? 'Follow-up updated' : 'Follow-up scheduled');
      if (duplicateCount) toast.warning(`${duplicateCount} similar pending follow-up${duplicateCount === 1 ? '' : 's'} found`);
      if (response.warnings?.workload) toast.warning(response.warnings.workload);
      setDirty(false);
      onSaved?.(response.data);
      onClose();
    } catch (error) {
      setErrors(error.payload?.details || {});
      toast.error(error.message || 'Unable to save follow-up');
    } finally {
      setBusy(false);
    }
  }

  const selectedRelated = useMemo(() => relatedOptions.find((item) => String(item.value) === String(form.relatedEntityId)), [form.relatedEntityId, relatedOptions]);
  const isPast = form.date && `${form.date}T${form.time || '00:00'}` < new Date().toISOString().slice(0, 16);

  return (
    <Modal
      open={open}
      onClose={close}
      title={initialValue?.id ? 'Edit follow-up' : 'Schedule follow-up'}
      subtitle="Asia/Kolkata"
      footer={<div className="flex justify-end gap-3"><Button type="button" variant="outline" size="sm" onClick={close}>Cancel</Button><Button type="submit" size="sm" form="follow-up-form" loading={busy}><CalendarClock size={15} className="mr-1" />{initialValue?.id ? 'Save changes' : 'Schedule'}</Button></div>}
    >
      <form id="follow-up-form" onSubmit={save} className="grid gap-4 md:grid-cols-2">
        <Field label="Related record type" required>
          <Select value={form.relatedEntityType} onChange={(value) => { set('relatedEntityType', value); set('relatedEntityId', ''); setSearch(''); }} options={(options.entityTypes || ['Lead', 'Client', 'Invoice', 'Project', 'Renewal', 'Custom']).map(toOption)} />
        </Field>
        <Field label="Related record" required error={errors.relatedEntityId}>
          {form.relatedEntityType === 'Custom' ? (
            <Input value={form.relatedEntityId} onChange={(event) => { set('relatedEntityId', event.target.value); set('relatedEntityLabel', event.target.value); }} placeholder="Custom record reference" />
          ) : (
            <div className="space-y-2">
              <div className="relative"><Search size={14} className="absolute left-3 top-3 text-[var(--text-muted)]" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${form.relatedEntityType.toLowerCase()}...`} /></div>
              {searching ? <p className="text-xs text-[var(--text-muted)]">Searching...</p> : null}
              {relatedOptions.length ? <Select value={form.relatedEntityId} onChange={(value) => set('relatedEntityId', value)} options={relatedOptions} placeholder="Select matching record" /> : null}
            </div>
          )}
        </Field>
        {selectedRelated ? <div className="md:col-span-2 rounded-2xl border border-[var(--primary-subtle)] bg-[var(--primary-subtle)] p-3 text-xs font-medium text-[var(--primary)]"><span className="font-bold">Selected:</span> {selectedRelated.label}</div> : null}
        <Field label="Title" required error={errors.title} wide><Input value={form.title} onChange={(event) => set('title', event.target.value)} placeholder="What needs to happen next?" /></Field>
        <Field label="Type"><Select value={form.followUpType} onChange={(value) => set('followUpType', value)} options={(options.followUpTypes || ['Call', 'Email', 'Meeting']).map(toOption)} /></Field>
        <Field label="Purpose"><Input value={form.purpose} onChange={(event) => set('purpose', event.target.value)} placeholder="e.g. Quotation decision" /></Field>
        <Field label="Date" required error={errors.date}><Input type="date" value={form.date} onChange={(event) => set('date', event.target.value)} /></Field>
        <Field label="Time" required error={errors.time}><Input type="time" value={form.time} onChange={(event) => set('time', event.target.value)} /></Field>
        {isPast ? <div className="md:col-span-2 flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs font-semibold text-amber-500"><AlertTriangle size={15} />This date is in the past. The follow-up will immediately appear overdue.</div> : null}
        <Field label="Duration (minutes)"><Input type="number" min="5" step="5" value={form.expectedDurationMinutes} onChange={(event) => set('expectedDurationMinutes', Number(event.target.value))} /></Field>
        <Field label="Priority"><Select value={form.priority} onChange={(value) => set('priority', value)} options={(options.priorities || ['Low', 'Medium', 'High', 'Critical']).map(toOption)} /></Field>
        <Field label="Assignee" required error={errors.assignedTo}><Select value={form.assignedTo} onChange={(value) => set('assignedTo', value)} options={users.map((user) => ({ value: user.id, label: user.fullName || user.email }))} placeholder="Select employee" /></Field>
        <Field label="Team"><Input value={form.assignedTeam} onChange={(event) => set('assignedTeam', event.target.value)} placeholder="Optional team reference" /></Field>
        <Field label="Expected outcome"><Input value={form.expectedOutcome} onChange={(event) => set('expectedOutcome', event.target.value)} /></Field>
        <Field label="Next action"><Input value={form.nextAction} onChange={(event) => set('nextAction', event.target.value)} placeholder="Concrete action after this follow-up" /></Field>
        <Field label="Description" wide><Textarea value={form.description} onChange={(event) => set('description', event.target.value)} rows={3} /></Field>
        <Field label="Internal note" wide><Textarea value={form.internalNote} onChange={(event) => set('internalNote', event.target.value)} rows={2} /></Field>
        <Field label="Tags"><Input value={form.tagsText} onChange={(event) => set('tagsText', event.target.value)} placeholder="sales, payment, urgent" /></Field>
        <Field label="Location / meeting link"><Input value={form.location} onChange={(event) => set('location', event.target.value)} /></Field>
        <div className="md:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/30 p-4">
          <label className="flex items-center gap-3 text-xs font-semibold text-[var(--text-main)] cursor-pointer"><input type="checkbox" checked={form.isRecurring} onChange={(event) => set('isRecurring', event.target.checked)} className="h-4 w-4 rounded" style={{ accentColor: 'var(--primary)' }} />Recurring follow-up</label>
          {form.isRecurring ? <div className="mt-3 max-w-xs"><Select value={form.recurrenceFrequency} onChange={(value) => set('recurrenceFrequency', value)} options={['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }))} /></div> : null}
        </div>
      </form>
    </Modal>
  );
}

export function CompleteFollowUpModal({ open, followUp, options = {}, onClose, onSaved }) {
  const { token } = useAuth();
  const [form, setForm] = useState({ actualOutcome: '', communicationResult: '', discussionNote: '', relatedStatus: '', nextActionRequired: true, nextAction: '', nextFollowUpDate: tomorrowInput(), nextFollowUpTime: '10:00', noNextFollowUpReason: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ actualOutcome: '', communicationResult: '', discussionNote: '', relatedStatus: '', nextActionRequired: true, nextAction: followUp?.nextAction || '', nextFollowUpDate: tomorrowInput(), nextFollowUpTime: '10:00', noNextFollowUpReason: '' });
    setErrors({});
  }, [followUp, open]);

  function set(key, value) { setForm((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: '' })); }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await api.followUps.complete(token, followUp.id, form);
      toast.success(response.nextFollowUp ? 'Completed and next follow-up scheduled' : 'Follow-up completed');
      onSaved?.(response.data, response.nextFollowUp);
      onClose();
    } catch (error) {
      setErrors(error.payload?.details || {});
      toast.error(error.message || 'Unable to complete follow-up');
    } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Complete follow-up" subtitle={followUp?.followUpNumber} width="min(760px, 96vw)" footer={<div className="flex justify-end gap-3"><Button variant="outline" size="sm" onClick={onClose}>Cancel</Button><Button type="submit" size="sm" form="complete-follow-up-form" loading={busy}><CheckCircle2 size={15} className="mr-1" />Complete safely</Button></div>}>
      <form id="complete-follow-up-form" onSubmit={save} className="grid gap-4 md:grid-cols-2">
        <Field label="Actual outcome" required error={errors.actualOutcome}><Select value={form.actualOutcome} onChange={(value) => { set('actualOutcome', value); if (!form.communicationResult) set('communicationResult', value); }} options={(options.outcomes || []).map(toOption)} placeholder="Select outcome" /></Field>
        <Field label="Communication result" required error={errors.communicationResult}><Input value={form.communicationResult} onChange={(event) => set('communicationResult', event.target.value)} placeholder="Connected, no response..." /></Field>
        <Field label="Discussion note" required error={errors.discussionNote} wide><Textarea value={form.discussionNote} onChange={(event) => set('discussionNote', event.target.value)} rows={4} placeholder="Capture the facts, commitments and blockers discussed." /></Field>
        <Field label="Lead / client status update"><Input value={form.relatedStatus} onChange={(event) => set('relatedStatus', event.target.value)} placeholder="Optional status update" /></Field>
        <div className="flex items-end pb-2"><label className="flex items-center gap-3 text-xs font-semibold text-[var(--text-main)] cursor-pointer"><input type="checkbox" checked={form.nextActionRequired} onChange={(event) => set('nextActionRequired', event.target.checked)} className="h-4 w-4 rounded" style={{ accentColor: 'var(--primary)' }} />Create the next follow-up</label></div>
        {form.nextActionRequired ? (
          <>
            <Field label="Next action" required error={errors.nextAction} wide><Input value={form.nextAction} onChange={(event) => set('nextAction', event.target.value)} placeholder="What must happen next?" /></Field>
            <Field label="Next follow-up date" required error={errors.nextFollowUpAt}><Input type="date" min={todayInput()} value={form.nextFollowUpDate} onChange={(event) => set('nextFollowUpDate', event.target.value)} /></Field>
            <Field label="Next follow-up time" required><Input type="time" value={form.nextFollowUpTime} onChange={(event) => set('nextFollowUpTime', event.target.value)} /></Field>
          </>
        ) : <Field label="Reason for no next follow-up" required error={errors.noNextFollowUpReason} wide><Textarea value={form.noNextFollowUpReason} onChange={(event) => set('noNextFollowUpReason', event.target.value)} placeholder="Use only for a valid closure such as converted, lost, paid, completed, resolved or cancelled." /></Field>}
      </form>
    </Modal>
  );
}

export function RescheduleFollowUpModal({ open, followUp, mode = 'reschedule', onClose, onSaved }) {
  const { token } = useAuth();
  const [form, setForm] = useState({ date: tomorrowInput(), time: '10:00', reason: '', note: '', minutes: 30 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setForm({ date: tomorrowInput(), time: '10:00', reason: '', note: '', minutes: 30 }); setError(''); }
  }, [open]);

  async function save(event) {
    event.preventDefault();
    if (!form.reason.trim()) { setError('Reason is required'); return; }
    setBusy(true);
    try {
      const response = mode === 'snooze' ? await api.followUps.snooze(token, followUp.id, form) : await api.followUps.reschedule(token, followUp.id, form);
      toast.success(mode === 'snooze' ? 'Follow-up snoozed' : 'Follow-up rescheduled');
      onSaved?.(response.data);
      onClose();
    } catch (requestError) {
      setError(requestError.payload?.details?.reason || requestError.payload?.details?.dueAt || requestError.message);
    } finally { setBusy(false); }
  }

  const reasons = ['Client unavailable', 'Client requested callback', 'Waiting for proposal', 'Waiting for internal team', 'Technical clarification', 'Payment commitment changed', 'Meeting postponed', 'Employee unavailable', 'Other'];
  return (
    <Modal open={open} onClose={onClose} title={mode === 'snooze' ? 'Snooze follow-up' : 'Reschedule follow-up'} subtitle={followUp?.followUpNumber} width="min(620px, 96vw)" footer={<div className="flex justify-end gap-3"><Button variant="outline" size="sm" onClick={onClose}>Cancel</Button><Button type="submit" size="sm" form="reschedule-follow-up-form" loading={busy}>{mode === 'snooze' ? 'Snooze' : 'Reschedule'}</Button></div>}>
      <form id="reschedule-follow-up-form" onSubmit={save} className="grid gap-4 md:grid-cols-2">
        {mode === 'snooze' ? <Field label="Snooze duration"><Select value={String(form.minutes)} onChange={(value) => setForm((current) => ({ ...current, minutes: Number(value) }))} options={[10, 30, 60, 120, 1440].map((value) => ({ value: String(value), label: value < 60 ? `${value} minutes` : value === 1440 ? 'Next day' : `${value / 60} hours` }))} /></Field> : <><Field label="New date" required><Input type="date" min={todayInput()} value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} /></Field><Field label="New time" required><Input type="time" value={form.time} onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))} /></Field></>}
        <Field label="Reason" required error={error} wide><Select value={form.reason} onChange={(value) => { setForm((current) => ({ ...current, reason: value })); setError(''); }} options={reasons.map(toOption)} placeholder="Select reason" /></Field>
        <Field label="Note" wide><Textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} rows={3} /></Field>
      </form>
    </Modal>
  );
}
