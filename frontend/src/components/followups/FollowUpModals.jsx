import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarClock, Check, CheckCircle2, ChevronDown, Loader2, MessageCircle, Search, Send, X } from 'lucide-react';
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
      <span className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200">{label}{required ? <span className="ml-1 text-rose-500">*</span> : null}</span>
      {children}
      {helper ? <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400">{helper}</span> : null}
      {error ? <span className="mt-1 block text-xs font-semibold text-rose-500">{error}</span> : null}
    </label>
  );
}

function toOption(value) {
  return { value, label: value };
}

function RelatedRecordCombobox({ entityType, value, label, onChange, token, error }) {
  const [queryText, setQueryText] = useState('');
  const debouncedQuery = useDebouncedValue(queryText, 250);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Clear query when entityType changes
  useEffect(() => {
    setQueryText('');
    setResults([]);
    setIsOpen(false);
  }, [entityType]);

  // Only search when query has 3 or more characters
  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (trimmed.length < 3) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    let active = true;
    setLoading(true);
    api.followUps.relatedSearch(token, entityType, trimmed)
      .then((res) => {
        if (active) {
          setResults(res.data || []);
          setIsOpen(true);
        }
      })
      .catch(() => {
        if (active) setResults([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [debouncedQuery, entityType, token]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // When value and label are selected
  if (value && label) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-emerald-300 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/40 px-3 py-2 min-h-[42px] transition">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-2xs">
            <Check size={12} />
          </span>
          <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200 truncate">
            {label}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange('', '');
            setQueryText('');
            setResults([]);
            setIsOpen(false);
          }}
          className="ml-2 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer shadow-2xs shrink-0"
        >
          Change
        </button>
      </div>
    );
  }

  const queryLen = queryText.trim().length;

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-3 text-slate-400 dark:text-slate-500 pointer-events-none" />
        <Input
          className="pl-9 pr-8"
          value={queryText}
          onChange={(e) => {
            const val = e.target.value;
            setQueryText(val);
            if (val.trim().length >= 3) {
              setIsOpen(true);
            } else {
              setIsOpen(false);
            }
          }}
          placeholder={`Type 3+ letters to search ${entityType.toLowerCase()}...`}
        />
        {loading ? (
          <Loader2 size={14} className="absolute right-3 top-3 animate-spin text-slate-400 dark:text-slate-500" />
        ) : queryText ? (
          <button
            type="button"
            onClick={() => {
              setQueryText('');
              setResults([]);
              setIsOpen(false);
            }}
            className="absolute right-2.5 top-2.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-0.5 cursor-pointer"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>

      {error ? (
        <span className="mt-1 block text-xs font-semibold text-rose-500">{error}</span>
      ) : null}

      {/* Floating Dropdown - Only open when 3+ chars typed */}
      {isOpen && queryLen >= 3 && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 shadow-lg ring-1 ring-black/5">
          {loading ? (
            <div className="p-3 text-center text-xs text-slate-400 dark:text-slate-500 flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin text-slate-400 dark:text-slate-500" />
              <span>Searching {entityType.toLowerCase()} records...</span>
            </div>
          ) : results.length > 0 ? (
            results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onChange(item.id, item.label);
                  setIsOpen(false);
                  setQueryText('');
                  setResults([]);
                }}
                className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-blue-950/60 transition cursor-pointer group"
              >
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-700 dark:group-hover:text-blue-400 truncate">
                    {item.label}
                  </p>
                  {item.subtitle ? (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                      {item.subtitle}
                    </p>
                  ) : null}
                </div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 shrink-0">
                  Select ↵
                </span>
              </button>
            ))
          ) : (
            <div className="p-3 text-center text-xs text-slate-400 dark:text-slate-500">
              {`No matching ${entityType.toLowerCase()} records found`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const QUICK_TITLES = [
  'Call to discuss quotation',
  'Payment follow-up',
  'Demo & Requirement review',
  'Client decision check'
];

const QUICK_PURPOSES = [
  'Price Negotiation',
  'Demo / Meeting',
  'Payment Follow-up',
  'Requirement Gathering',
  'Proposal Review',
  'Decision Pending'
];

const QUICK_TYPES = [
  { value: 'Call', icon: '📞', label: 'Call' },
  { value: 'WhatsApp', icon: '💬', label: 'WhatsApp' },
  { value: 'Meeting', icon: '🤝', label: 'Meeting' },
  { value: 'Email', icon: '✉️', label: 'Email' }
];

const PRIORITIES_LIST = [
  { value: 'Low', label: 'Low', active: 'bg-slate-700 text-white border-slate-700' },
  { value: 'Medium', label: 'Medium', active: 'bg-blue-600 text-white border-blue-600' },
  { value: 'High', label: 'High', active: 'bg-amber-600 text-white border-amber-600' },
  { value: 'Critical', label: 'Critical', active: 'bg-rose-600 text-white border-rose-600' }
];

function daysAheadInput(days) {
  const date = new Date(Date.now() + days * 24 * 3600000);
  return date.toISOString().slice(0, 10);
}

export function FollowUpFormModal({ open, onClose, onSaved, options = {}, initialValue = null, lockRelatedEntity = false, hideRelatedEntity = false }) {
  const { token, user } = useAuth();
  const [form, setForm] = useState({ ...emptyForm, date: tomorrowInput() });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!open) return;
    const source = initialValue || {};
    const due = source.dueAt ? new Date(source.dueAt) : null;
    
    api.resources.list('/users/lookup', token)
      .then((response) => {
        const uList = response.data || [];
        setUsers(uList);
        setForm({
          ...emptyForm,
          ...source,
          assignedTo: source.assignedTo || user?.id || (uList[0]?.id || ''),
          date: due && !Number.isNaN(due.getTime()) ? due.toISOString().slice(0, 10) : source.date || tomorrowInput(),
          time: due && !Number.isNaN(due.getTime()) ? due.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: source.timezone || 'Asia/Kolkata' }) : source.time || '10:00',
          tagsText: Array.isArray(source.tags) ? source.tags.join(', ') : '',
          recurrenceFrequency: source.recurrenceRule?.frequency || 'monthly'
        });
      })
      .catch(() => {
        setUsers([]);
        setForm({
          ...emptyForm,
          ...source,
          assignedTo: source.assignedTo || user?.id || '',
          date: due && !Number.isNaN(due.getTime()) ? due.toISOString().slice(0, 10) : source.date || tomorrowInput(),
          time: due && !Number.isNaN(due.getTime()) ? due.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: source.timezone || 'Asia/Kolkata' }) : source.time || '10:00',
          tagsText: Array.isArray(source.tags) ? source.tags.join(', ') : '',
          recurrenceFrequency: source.recurrenceRule?.frequency || 'monthly'
        });
      });

    setErrors({});
    setDirty(false);
  }, [initialValue, open, token, user?.id]);

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
      const payload = {
        ...form,
        relatedEntityLabel: form.relatedEntityLabel || form.relatedEntityId,
        tags: form.tagsText ? form.tagsText.split(',').map((item) => item.trim()).filter(Boolean) : (form.tags || []),
        recurrenceRule: form.isRecurring ? { frequency: form.recurrenceFrequency, interval: 1, respectBusinessHours: true } : {},
        timezone: 'Asia/Kolkata'
      };
      const response = initialValue?.id
        ? await api.followUps.update(token, initialValue.id, { ...payload, version: initialValue.version })
        : await api.followUps.create(token, payload);
      const duplicateCount = response.warnings?.duplicates?.length || 0;
      toast.success(initialValue?.id ? 'Follow-up updated successfully' : 'Follow-up scheduled successfully');
      if (duplicateCount) toast.warning(`${duplicateCount} similar pending follow-up${duplicateCount === 1 ? '' : 's'} found`);
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

  const isPast = form.date && `${form.date}T${form.time || '00:00'}` < new Date().toISOString().slice(0, 16);
  const isEdit = Boolean(initialValue?.id);
  const shouldHideRelated = hideRelatedEntity || lockRelatedEntity || Boolean(initialValue?.hideRelatedEntity) || Boolean(initialValue?.lockRelatedEntity);

  return (
    <Modal
      open={open}
      onClose={close}
      title={isEdit ? 'Edit follow-up' : 'Schedule follow-up'}
      width="min(560px, 96vw)"
      footer={(
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={close} className="cursor-pointer">
            Cancel
          </Button>
          <Button type="submit" size="sm" form="follow-up-form" loading={busy} className="cursor-pointer font-semibold px-4">
            <CalendarClock size={15} className="mr-1.5" />
            {isEdit ? 'Save changes' : 'Schedule Follow-up'}
          </Button>
        </div>
      )}
    >
      <form id="follow-up-form" onSubmit={save} className="space-y-3 py-0.5">
        {/* Row 1: Related Record */}
        {shouldHideRelated ? null : isEdit ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900 p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">Related Record</span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {form.relatedEntityLabel || form.relatedEntityId}
              </span>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 font-semibold">
              {form.relatedEntityType || 'Lead'}
            </span>
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label="Related record type" required>
              <Select
                value={form.relatedEntityType}
                onChange={(value) => {
                  set('relatedEntityType', value);
                  set('relatedEntityId', '');
                  set('relatedEntityLabel', '');
                }}
                options={(options.entityTypes || ['Lead', 'Contact', 'Client', 'Opportunity', 'Deal', 'Quotation', 'Proposal', 'Invoice', 'Payment', 'Project', 'Task', 'AMC', 'Renewal', 'Custom']).map(toOption)}
              />
            </Field>

            <Field label="Related record" required error={errors.relatedEntityId}>
              {form.relatedEntityType === 'Custom' ? (
                <Input
                  value={form.relatedEntityId}
                  onChange={(event) => { set('relatedEntityId', event.target.value); set('relatedEntityLabel', event.target.value); }}
                  placeholder="Custom reference"
                />
              ) : (
                <RelatedRecordCombobox
                  entityType={form.relatedEntityType}
                  value={form.relatedEntityId}
                  label={form.relatedEntityLabel}
                  onChange={(id, label) => {
                    set('relatedEntityId', id);
                    set('relatedEntityLabel', label);
                    if (!form.title) {
                      set('title', `Follow-up with ${label}`);
                    }
                  }}
                  token={token}
                  error={errors.relatedEntityId}
                />
              )}
            </Field>
          </div>
        )}

        {/* Row 2: Title (100% Full Width) */}
        <div>
          <Field label="Title" required error={errors.title}>
            <Input
              value={form.title}
              onChange={(event) => set('title', event.target.value)}
              placeholder="e.g. Call to discuss quotation / Next review"
            />
          </Field>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">⚡ Quick:</span>
            {QUICK_TITLES.map((qTitle) => (
              <button
                key={qTitle}
                type="button"
                onClick={() => set('title', qTitle)}
                className="px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 text-slate-600 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 border border-slate-200 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-700 transition cursor-pointer"
              >
                {qTitle}
              </button>
            ))}
          </div>
        </div>

        {/* Row 3: Purpose (100% Full Width) */}
        <div>
          <Field label="Purpose">
            <Input
              value={form.purpose}
              onChange={(event) => set('purpose', event.target.value)}
              placeholder="e.g. Price Negotiation / Demo"
            />
          </Field>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">⚡ Quick:</span>
            {QUICK_PURPOSES.map((qPurp) => (
              <button
                key={qPurp}
                type="button"
                onClick={() => set('purpose', qPurp)}
                className="px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 text-slate-600 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 border border-slate-200 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-700 transition cursor-pointer"
              >
                {qPurp}
              </button>
            ))}
          </div>
        </div>

        {/* Row 4: Follow-Up Type (100% Full Width) */}
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200">Follow-Up Type</span>
          <div className="grid grid-cols-4 gap-2">
            {QUICK_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => set('followUpType', t.value)}
                className={`flex items-center justify-center gap-2 py-2 px-2 rounded-xl text-xs font-semibold border transition cursor-pointer text-center ${
                  form.followUpType === t.value
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-bold'
                    : 'bg-slate-50 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <span className="text-sm leading-none">{t.icon}</span>
                <span className="text-xs font-medium leading-none">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Row 5: Priority (100% Full Width) */}
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200">Priority</span>
          <div className="grid grid-cols-4 gap-2">
            {PRIORITIES_LIST.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => set('priority', p.value)}
                className={`flex items-center justify-center py-2 px-2 rounded-xl text-xs font-semibold border transition cursor-pointer text-center ${
                  form.priority === p.value
                    ? p.active
                    : 'bg-slate-50 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <span className="text-xs font-medium leading-none">{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Row 5: Date & Time (100% Full Width Container with Chips) */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/90 p-3 space-y-2.5">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label="Date" required error={errors.date}>
              <Input
                type="date"
                value={form.date}
                onChange={(event) => set('date', event.target.value)}
              />
            </Field>
            <Field label="Time" required error={errors.time}>
              <Input
                type="time"
                value={form.time}
                onChange={(event) => set('time', event.target.value)}
              />
            </Field>
          </div>

          {/* Quick Date & Time Presets */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1">
              <span className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">📅 Date:</span>
              <button
                type="button"
                onClick={() => set('date', todayInput())}
                className={`px-2 py-0.5 rounded text-[10.5px] font-semibold border transition cursor-pointer ${
                  form.date === todayInput()
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-bold'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => set('date', tomorrowInput())}
                className={`px-2 py-0.5 rounded text-[10.5px] font-semibold border transition cursor-pointer ${
                  form.date === tomorrowInput()
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-bold'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => set('date', daysAheadInput(2))}
                className={`px-2 py-0.5 rounded text-[10.5px] font-semibold border transition cursor-pointer ${
                  form.date === daysAheadInput(2)
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-bold'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                +2 Days
              </button>
              <button
                type="button"
                onClick={() => set('date', daysAheadInput(7))}
                className={`px-2 py-0.5 rounded text-[10.5px] font-semibold border transition cursor-pointer ${
                  form.date === daysAheadInput(7)
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-bold'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                +1 Wk
              </button>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">⏰ Time:</span>
              {['10:00', '11:30', '14:00', '16:00', '17:30', '18:30'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('time', t)}
                  className={`px-1.5 py-0.5 rounded text-[10.5px] font-medium border transition cursor-pointer ${
                    form.time === t
                      ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-2xs'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {t === '10:00' ? '10:00 AM' : t === '11:30' ? '11:30 AM' : t === '14:00' ? '02:00 PM' : t === '16:00' ? '04:00 PM' : t === '17:30' ? '05:30 PM' : '06:30 PM'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isPast ? (
          <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 px-2.5 py-1.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">
            <AlertTriangle size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <span>This follow-up date/time is in the past and will appear as Overdue.</span>
          </div>
        ) : null}

        {/* Row 6: Assignee (100% Full Width) */}
        <Field label="Assignee" required error={errors.assignedTo}>
          <Select
            value={form.assignedTo}
            onChange={(value) => set('assignedTo', value)}
            options={users.map((u) => ({ value: u.id, label: u.fullName || u.email }))}
            placeholder="Select employee"
          />
        </Field>

        {/* Row 7: Notes / Description (100% Full Width) */}
        <Field label="Notes / Description">
          <Textarea
            value={form.description}
            onChange={(event) => set('description', event.target.value)}
            rows={2}
            className="min-h-[52px]"
            placeholder="Add context or notes for this follow-up..."
          />
        </Field>
      </form>
    </Modal>
  );
}

function computeAutoCadence(currentAttempts = 0) {
  const now = new Date();
  const todayStr = todayInput();

  if (currentAttempts <= 0) {
    const plus3 = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const hour = plus3.getHours();

    if (hour >= 18 || hour < 9) {
      const nextDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      if (nextDay.getDay() === 0) nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().slice(0, 10);
      return {
        nextAttempt: 1,
        date: nextDayStr,
        time: '10:30',
        remark: 'Attempt 1: Call not answered / No response. Auto-scheduled follow-up for next morning at 10:30 AM.',
        isCold: false,
        scheduleNext: true
      };
    } else {
      const pad = (n) => String(n).padStart(2, '0');
      const timeStr = `${pad(plus3.getHours())}:${pad(plus3.getMinutes())}`;
      return {
        nextAttempt: 1,
        date: todayStr,
        time: timeStr,
        remark: `Attempt 1: Call not answered / No response. Auto-scheduled follow-up in 3 hours (${timeStr}).`,
        isCold: false,
        scheduleNext: true
      };
    }
  } else if (currentAttempts === 1) {
    const nextDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    if (nextDay.getDay() === 0) nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = nextDay.toISOString().slice(0, 10);
    return {
      nextAttempt: 2,
      date: nextDayStr,
      time: '11:00',
      remark: 'Attempt 2: Call not answered / No response. Auto-scheduled follow-up for next day at 11:00 AM.',
      isCold: false,
      scheduleNext: true
    };
  } else {
    return {
      nextAttempt: 3,
      date: '',
      time: '',
      remark: 'Attempt 3: No response received after 3 attempts. Moved to Unresponsive / Cold Lead.',
      isCold: true,
      scheduleNext: false
    };
  }
}

function getWhatsAppMessage(name = 'there', templateKey = 'connected', purpose = '') {
  const purposeText = purpose ? ` regarding ${purpose}` : '';

  switch (templateKey) {
    case 'connected':
      return `Hi ${name}, it was great speaking with you${purposeText}. As discussed, we are proceeding with the next steps. Please let me know if you need any further details. Thanks!`;
    case 'no_response':
    case 'missed_call':
      return `Hi ${name}, I tried calling you just now${purposeText}. Please let me know when would be a convenient time to connect over a quick call. Thanks!`;
    case 'busy':
      return `Hi ${name}, noted that you were occupied when I called. I will connect with you again today as requested. If you are free earlier, feel free to drop a message here. Thanks!`;
    case 'switched_off':
      return `Hi ${name}, tried reaching your number${purposeText}, but your phone was unreachable/switched off. Please let me know when you are available or share an alternate number. Thanks!`;
    default:
      return `Hi ${name}, following up${purposeText}. Please let me know if you have any questions or if you would like to proceed. Thanks!`;
  }
}

function openWhatsAppDirect(phone, name, outcome, purpose) {
  if (!phone) {
    toast.error('No phone number available for this record');
    return;
  }
  let cleanPhone = String(phone).replace(/[^0-9]/g, '');
  if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;

  const message = getWhatsAppMessage(name, outcome, purpose);
  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function CompleteFollowUpModal({ open, followUp, options = {}, onClose, onSaved }) {
  const { token } = useAuth();
  const [outcome, setOutcome] = useState('connected');
  const [remark, setRemark] = useState('');
  const [scheduleNext, setScheduleNext] = useState(false);
  const [nextDate, setNextDate] = useState(tomorrowInput());
  const [nextTime, setNextTime] = useState('11:00');
  const [nextMode, setNextMode] = useState('Call');
  const [nextNote, setNextNote] = useState('');
  const [cadenceInfo, setCadenceInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  const currentAttempts = Number(followUp?.attemptsCount || followUp?.followUpAttempts || 0);

  useEffect(() => {
    if (!open) return;
    setOutcome('connected');
    setRemark('');
    setScheduleNext(false);
    setNextDate(tomorrowInput());
    setNextTime('11:00');
    setNextMode(followUp?.followUpType || 'Call');
    setNextNote('');
    setCadenceInfo(null);
  }, [followUp, open]);

  if (!followUp) return null;

  function selectOutcome(key) {
    setOutcome(key);
    if (key === 'no_response') {
      const cadence = computeAutoCadence(currentAttempts);
      setCadenceInfo(cadence);
      setRemark(cadence.remark);
      if (cadence.isCold) {
        setScheduleNext(false);
        setNextDate('');
        setNextTime('');
      } else {
        setScheduleNext(true);
        setNextDate(cadence.date);
        setNextTime(cadence.time);
        setNextMode('Call');
        setNextNote(`Auto-follow-up (Attempt ${cadence.nextAttempt}/3)`);
      }
    } else if (key === 'busy') {
      setCadenceInfo(null);
      setScheduleNext(true);
      setNextDate(todayInput());
      setNextTime('17:00');
      setNextMode('Call');
      setRemark('Client was busy on call, requested callback later today.');
      setNextNote('Call back client');
    } else if (key === 'switched_off') {
      setCadenceInfo(null);
      setScheduleNext(true);
      setNextDate(tomorrowInput());
      setNextTime('12:00');
      setNextMode('Call');
      setRemark('Phone switched off / Unreachable.');
      setNextNote('Retry call');
    } else {
      setCadenceInfo(null);
      setRemark('');
      setScheduleNext(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!remark.trim()) {
      toast.error('Please enter a completion remark / outcome');
      return;
    }
    setBusy(true);
    try {
      const actualOutcomeMap = {
        connected: 'Connected',
        no_response: 'No Response',
        busy: 'Busy',
        switched_off: 'Switched Off'
      };

      const payload = {
        actualOutcome: actualOutcomeMap[outcome] || 'Connected',
        communicationResult: actualOutcomeMap[outcome] || 'Connected',
        discussionNote: remark.trim(),
        nextActionRequired: scheduleNext,
        nextAction: scheduleNext ? (nextNote.trim() || 'Follow-up discussion') : '',
        nextFollowUpDate: scheduleNext && nextDate ? nextDate : '',
        nextFollowUpTime: scheduleNext && nextTime ? nextTime : '',
        nextFollowUpType: nextMode,
        noNextFollowUpReason: !scheduleNext ? 'Follow-up completed' : '',
        isCold: Boolean(cadenceInfo?.isCold)
      };

      const response = await api.followUps.complete(token, followUp.id, payload);
      api.cache.invalidate('/leads');
      api.cache.invalidate('/follow-ups');
      toast.success(response.nextFollowUp ? 'Completed and next follow-up scheduled' : 'Follow-up completed');
      onSaved?.(response.data, response.nextFollowUp);
      onClose();
    } catch (error) {
      toast.error(error.message || 'Unable to complete follow-up');
    } finally {
      setBusy(false);
    }
  }

  const phone = followUp.relatedPhone || followUp.phone || followUp.mobile;
  const name = followUp.relatedEntityLabel || followUp.companyName || 'there';

  const outcomeLabels = {
    connected: { title: 'Post-Call Summary', sub: 'Send discussion summary & next steps' },
    no_response: { title: 'Missed Call Nudge', sub: 'Send missed call & convenient time request' },
    busy: { title: 'Busy / Callback Later', sub: 'Send acknowledgement for callback later' },
    switched_off: { title: 'Unreachable / Switched Off', sub: 'Send unreachable alert & alternate contact request' }
  };
  const meta = outcomeLabels[outcome] || outcomeLabels.connected;
  const previewText = getWhatsAppMessage(name, outcome, followUp.purpose || followUp.title);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={(
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={16} />
          </div>
          <span className="font-bold text-base text-slate-900 dark:text-white">
            Complete Follow-Up / Reminder
          </span>
        </div>
      )}
      width="min(640px, 96vw)"
      footer={(
        <div className="flex justify-end gap-2.5">
          <Button variant="ghost" onClick={onClose} disabled={busy} className="cursor-pointer">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={busy}
            className="bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer font-semibold shadow-xs"
          >
            <CheckCircle2 size={14} className="mr-1.5" />
            {busy ? 'Saving...' : 'Mark as Completed'}
          </Button>
        </div>
      )}
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-1">
        {/* Context Summary */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3.5 space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="font-medium">Follow-Up Item:</span>
            <span className="font-bold text-slate-900 dark:text-white">{followUp.title}</span>
          </div>
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-slate-800 pt-1.5">
            <span className="font-medium">Scheduled Date:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {followUp.dueAt ? new Date(followUp.dueAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
            </span>
          </div>
          {followUp.relatedEntityLabel ? (
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-slate-800 pt-1.5">
              <span className="font-medium">Related Record:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {followUp.relatedEntityLabel} ({followUp.relatedEntityType})
              </span>
            </div>
          ) : null}
        </div>

        {/* Call / Contact Outcome Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1.5">
            Select Call / Contact Outcome:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => selectOutcome('connected')}
              className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition cursor-pointer ${
                outcome === 'connected'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 dark:border-emerald-600 text-emerald-800 dark:text-emerald-300 font-bold ring-1 ring-emerald-400 dark:ring-emerald-500'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <span className="text-base mb-0.5">🟢</span>
              <span className="text-[11px] leading-tight">Connected / Spoke</span>
            </button>

            <button
              type="button"
              onClick={() => selectOutcome('no_response')}
              className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition cursor-pointer ${
                outcome === 'no_response'
                  ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-500 dark:border-rose-600 text-rose-800 dark:text-rose-300 font-bold ring-1 ring-rose-400 dark:ring-rose-500'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <span className="text-base mb-0.5">🔴</span>
              <span className="text-[11px] leading-tight">No Response (Auto)</span>
            </button>

            <button
              type="button"
              onClick={() => selectOutcome('busy')}
              className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition cursor-pointer ${
                outcome === 'busy'
                  ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-500 dark:border-amber-600 text-amber-800 dark:text-amber-300 font-bold ring-1 ring-amber-400 dark:ring-amber-500'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <span className="text-base mb-0.5">🟡</span>
              <span className="text-[11px] leading-tight">Busy / Callback</span>
            </button>

            <button
              type="button"
              onClick={() => selectOutcome('switched_off')}
              className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition cursor-pointer ${
                outcome === 'switched_off'
                  ? 'bg-orange-50 dark:bg-orange-950/60 border-orange-500 dark:border-orange-600 text-orange-800 dark:text-orange-300 font-bold ring-1 ring-orange-400 dark:ring-orange-500'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <span className="text-base mb-0.5">🟠</span>
              <span className="text-[11px] leading-tight">Switched Off</span>
            </button>
          </div>
        </div>

        {/* Auto Cadence Notice */}
        {outcome === 'no_response' && cadenceInfo && (
          <div className={`rounded-xl border p-3 text-xs space-y-1 ${
            cadenceInfo.isCold
              ? 'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200'
              : 'border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200'
          }`}>
            <div className="flex items-center gap-1.5 font-bold">
              <span>{cadenceInfo.isCold ? '❄️ 3rd Attempt Exceeded' : '⚡ Smart Cadence Activated'}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/60 dark:bg-black/30 font-semibold">
                Attempt {currentAttempts + 1}/3
              </span>
            </div>
            <p className="text-[11px] leading-relaxed">
              {cadenceInfo.isCold
                ? 'No response after 3 attempts. Submitting will automatically transition this record to Unresponsive / Cold.'
                : `Next follow-up automatically calculated for ${cadenceInfo.date === todayInput() ? 'today at ' + cadenceInfo.time : 'next day (' + cadenceInfo.date + ') at ' + cadenceInfo.time}.`}
            </p>
          </div>
        )}

        {/* 1-Click WhatsApp Quick Nudge */}
        {phone && (
          <div className="rounded-xl border border-emerald-500/30 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/40 p-3 text-xs space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-600 text-white shrink-0">
                  <MessageCircle size={13} />
                </div>
                <div className="truncate">
                  <span className="font-bold text-emerald-950 dark:text-emerald-200 block truncate">
                    WhatsApp: {phone} ({meta.title})
                  </span>
                  <span className="text-[10px] text-emerald-800 dark:text-emerald-400 block">
                    {meta.sub}
                  </span>
                </div>
              </div>

              <Button
                type="button"
                size="sm"
                onClick={() => openWhatsAppDirect(phone, name, outcome, followUp.purpose || followUp.title)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 h-7 text-xs shadow-xs shrink-0 cursor-pointer font-semibold"
              >
                <Send size={12} className="mr-1.5" />
                Send WhatsApp
              </Button>
            </div>

            {/* Message Preview Box */}
            <div className="rounded-lg bg-white dark:bg-slate-900 border border-emerald-500/20 dark:border-emerald-800/40 p-2 text-[11px] text-emerald-950 dark:text-emerald-200 italic leading-relaxed whitespace-pre-wrap">
              💬 "{previewText}"
            </div>
          </div>
        )}

        {/* Remark / Outcome */}
        <div>
          <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1.5">
            Follow-Up Outcome / Completion Remark <span className="text-rose-500">*</span>
          </label>
          <Textarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="e.g. Spoke with client, discussed requirements and budget. Client agreed to proceed, requested revised quotation."
            rows={3}
            autoFocus
            className="rounded-xl text-xs"
          />
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            Mention the key summary, discussion points, or next action decided in this follow-up.
          </p>
        </div>

        {/* Schedule Next Follow-up Toggle */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/90 p-3.5 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={scheduleNext}
              onChange={(e) => setScheduleNext(e.target.checked)}
              className="!appearance-auto"
              style={{ accentColor: 'var(--primary)' }}
            />
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              Schedule Next Follow-Up for this Record
            </span>
          </label>

          {scheduleNext && (
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Next Follow-Up Date *
                  </label>
                  <Input
                    type="date"
                    min={todayInput()}
                    value={nextDate}
                    onChange={(e) => setNextDate(e.target.value)}
                    className="rounded-lg text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Next Follow-Up Time
                  </label>
                  <Input
                    type="time"
                    value={nextTime}
                    onChange={(e) => setNextTime(e.target.value)}
                    className="rounded-lg text-xs"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {[
                      { val: '10:00', label: '10:00 AM' },
                      { val: '11:30', label: '11:30 AM' },
                      { val: '14:00', label: '02:00 PM' },
                      { val: '16:00', label: '04:00 PM' },
                      { val: '18:00', label: '06:00 PM' }
                    ].map((chip) => (
                      <button
                        key={chip.val}
                        type="button"
                        onClick={() => setNextTime(chip.val)}
                        className={`text-[10px] px-1.5 py-0.5 rounded border transition cursor-pointer ${
                          nextTime === chip.val
                            ? 'bg-[var(--primary)] text-white border-[var(--primary)] font-bold'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Follow-Up Mode
                  </label>
                  <Select
                    value={nextMode}
                    onChange={(val) => setNextMode(val)}
                    options={(options.followUpTypes || ['Call', 'WhatsApp', 'Email', 'Meeting', 'Video meeting', 'Demo', 'Proposal follow-up', 'Payment follow-up', 'Custom']).map((v) => ({ value: v, label: v }))}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Next Note / Goal
                  </label>
                  <Input
                    value={nextNote}
                    onChange={(e) => setNextNote(e.target.value)}
                    placeholder="e.g. Send revised contract"
                    className="rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
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
