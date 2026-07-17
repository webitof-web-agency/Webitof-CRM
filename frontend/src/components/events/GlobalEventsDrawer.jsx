import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Edit3, MapPin, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { mergeSharedLabelOptions, normalizeSharedLabels } from '../../lib/labels';
import { formatDateOnlyDisplay, isSameDateOnly, toDateOnlyKey } from '../../lib/dateOnly';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ConfirmModal } from '../ui/ConfirmModal';
import { EventFormModal } from './EventFormModal';

function formatDate(value) {
  return formatDateOnlyDisplay(value);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfWeek(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function getMonthCells(date) {
  const first = startOfMonth(date);
  const gridStart = startOfWeek(first);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function getScopeTypeLabel(scopeType) {
  const normalized = String(scopeType || '').toLowerCase();
  if (normalized === 'lead') return 'Lead';
  if (normalized === 'client') return 'Client';
  if (normalized === 'project') return 'Project';
  return 'Global';
}

function getVisibilityLabel(event) {
  const visibility = String(event?.visibility || 'all_team').toLowerCase();
  if (visibility === 'only_me') return 'Only me';
  if (visibility === 'specific') return 'Specific members';
  return 'All team members';
}

function getScopeRecordLabel(event, lookup = {}) {
  const scopeType = String(event.scopeType || '').toLowerCase();
  const scopeId = String(event.scopeId || '').trim();
  if (scopeType === 'lead') return lookup.leads?.get(scopeId) || 'Lead';
  if (scopeType === 'client') return lookup.clients?.get(scopeId) || 'Client';
  if (scopeType === 'project') return lookup.projects?.get(scopeId) || 'Project';
  return 'Global';
}

function getEventDateKey(event) {
  return toDateOnlyKey(event.startDate || event.endDate || event.createdAt || '');
}

function getEventCountForDay(events, day) {
  const key = toDateOnlyKey(day);
  if (!key) return 0;
  return events.reduce((count, event) => (getEventDateKey(event) === key ? count + 1 : count), 0);
}

function formatTimeRange(event) {
  if (event.startTime && event.endTime) return `${event.startTime} - ${event.endTime}`;
  if (event.startTime) return event.startTime;
  if (event.endTime) return event.endTime;
  return '';
}

function groupEventsByDate(events = []) {
  const map = new Map();
  events.forEach((event) => {
    const key = getEventDateKey(event);
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(event);
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, items: items.sort((a, b) => String(b.startDate || b.createdAt || '').localeCompare(String(a.startDate || a.createdAt || ''))) }));
}

function createDraftAttachmentEntityId() {
  return `event-draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function GlobalEventsDrawer({ open, onClose, token, user, sharedLabels = [] }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [settings, setSettings] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [scopeOptions, setScopeOptions] = useState({ leads: [], clients: [], projects: [] });
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [scopeFilter, setScopeFilter] = useState('all');

  const userOptions = useMemo(() => users.map((item) => ({
    value: item.id,
    label: item.fullName || item.username || item.email || 'User',
    description: [item.username, item.roles?.[0]?.name].filter(Boolean).join(' - ') || 'Team member'
  })), [users]);
  const labelOptions = useMemo(() => {
    const sourceLabels = normalizeSharedLabels(sharedLabels);
    const fetchedLabels = normalizeSharedLabels(settings?.labels || []);
    return mergeSharedLabelOptions([...sourceLabels, ...fetchedLabels]);
  }, [sharedLabels, settings]);
  const userLookup = useMemo(() => new Map(users.map((item) => [String(item.id), item.fullName || item.username || item.email || 'User'])), [users]);

  const scopeLookup = useMemo(() => ({
    leads: new Map(leads.map((item) => [String(item.id), item.companyName || item.name || item.title || 'Lead'])),
    clients: new Map(clients.map((item) => [String(item.id), item.companyName || item.name || 'Client'])),
    projects: new Map(projects.map((item) => [String(item.id), item.title || 'Project']))
  }), [clients, leads, projects]);

  const visibleEvents = useMemo(() => {
    if (scopeFilter === 'all') return events;
    return events.filter((event) => String(event.scopeType || 'global').toLowerCase() === scopeFilter);
  }, [events, scopeFilter]);

  const groupedEvents = useMemo(() => groupEventsByDate(visibleEvents), [visibleEvents]);

  const monthCells = useMemo(() => getMonthCells(calendarDate), [calendarDate]);

  const selectedDateKey = useMemo(() => toDateOnlyKey(calendarDate), [calendarDate]);
  const selectedDateEvents = useMemo(() => {
    if (!selectedDateKey) return [];
    return visibleEvents.filter((event) => getEventDateKey(event) === selectedDateKey);
  }, [selectedDateKey, visibleEvents]);

  const scopeFilters = [
    { value: 'all', label: 'All' },
    { value: 'global', label: 'Global' },
    { value: 'lead', label: 'Lead' },
    { value: 'client', label: 'Client' },
    { value: 'project', label: 'Project' }
  ];

  const monthTitle = calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  async function load() {
    setLoading(true);
    try {
      const [eventsRes, usersRes, leadsRes, clientsRes, projectsRes, settingsRes] = await Promise.allSettled([
        api.resources.list('/events', token),
        api.resources.list('/users', token),
        api.resources.list('/leads', token),
        api.resources.list('/clients', token),
        api.resources.list('/projects', token),
        api.settings.get(token)
      ]);

      if (eventsRes.status === 'fulfilled') setEvents(eventsRes.value.data || []);
      if (usersRes.status === 'fulfilled') setUsers(usersRes.value.data || []);
      if (leadsRes.status === 'fulfilled') setLeads(leadsRes.value.data || []);
      if (clientsRes.status === 'fulfilled') setClients(clientsRes.value.data || []);
      if (projectsRes.status === 'fulfilled') setProjects(projectsRes.value.data || []);
      if (settingsRes.status === 'fulfilled') setSettings(settingsRes.value.data || null);
      setScopeOptions({
        leads: (leadsRes.status === 'fulfilled' ? leadsRes.value.data || [] : []).map((item) => ({
          value: item.id,
          label: item.companyName || item.name || `Lead ${item.id}`,
          description: item.status || 'Lead'
        })),
        clients: (clientsRes.status === 'fulfilled' ? clientsRes.value.data || [] : []).map((item) => ({
          value: item.id,
          label: item.companyName || item.name || `Client ${item.id}`,
          description: item.status || 'Client'
        })),
        projects: (projectsRes.status === 'fulfilled' ? projectsRes.value.data || [] : []).map((item) => ({
          value: item.id,
          label: item.title || `Project ${item.id}`,
          description: item.status || 'Project'
        }))
      });
    } catch (error) {
      toast.error(error.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, token]);

  useEffect(() => {
    if (!open) return;
    setCalendarDate(new Date());
    setScopeFilter('all');
  }, [open]);

  const currentUserName = user?.fullName || user?.username || user?.email || 'System';

  async function saveEvent(payload) {
    setBusy(true);
    try {
      const editing = Boolean(editingEvent?.id);
      if (editing) {
        await api.resources.update('/events', editingEvent.id, payload, token);
      } else {
        await api.resources.create('/events', {
          ...payload,
          ownerUserId: user?.id || payload.ownerUserId || ''
        }, token);
      }
      toast.success(editing ? 'Event updated' : 'Event added');
      await load();
      setEditingEvent(null);
    } catch (error) {
      toast.error(error.message || 'Failed to save event');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await api.resources.remove('/events', deleteTarget.id, token);
      toast.success('Event deleted');
      setDeleteTarget(null);
      await load();
    } catch (error) {
      toast.error(error.message || 'Failed to delete event');
    }
  }

  async function cleanupDraftAttachments(entityId) {
    const draftId = String(entityId || '').trim();
    if (!draftId) return;

    try {
      const response = await api.files.list(token, '', 'events', draftId);
      const files = Array.isArray(response.data) ? response.data : [];
      await Promise.allSettled(files.map((file) => api.files.deleteDriveFile(token, file.driveFileId || file.id)));
      api.cache.invalidate('/files');
    } catch (error) {
      console.error('Failed to clean up draft event attachments', error);
    }
  }

  async function handleCloseEditor() {
    if (editingEvent?.attachmentEntityId && !editingEvent?.id) {
      await cleanupDraftAttachments(editingEvent.attachmentEntityId);
    }
    setEditingEvent(null);
  }

  function shiftCalendar(months) {
    setCalendarDate((current) => {
      const next = new Date(current);
      next.setMonth(next.getMonth() + months);
      return next;
    });
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />
      <aside
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-[1040px] bg-white shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
        aria-hidden={!open}
      >
        <div className="flex h-full flex-col overflow-hidden">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <div>
              <div className="flex items-center gap-2">
                <CalendarDays size={18} className="text-[var(--primary)]" />
                <h2 className="text-lg font-semibold text-slate-900">Events</h2>
              </div>
              <p className="mt-1 text-sm text-slate-500">Global calendar events linked across leads, clients, and projects.</p>
            </div>
            <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={() => setEditingEvent({ scopeType: 'global', visibility: 'all_team', attachmentEntityId: createDraftAttachmentEntityId() })}>
                <CalendarPlus size={16} className="mr-2" />
                Add event
              </Button>
              <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Close events">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[260px_minmax(0,1fr)]">
            <div className="min-h-0 overflow-y-auto border-b border-slate-100 bg-slate-50/70 p-4 lg:border-b-0 lg:border-r lg:border-slate-100">
              <Card className="p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => shiftCalendar(-1)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900"
                    aria-label="Previous month"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div className="text-sm font-semibold text-slate-900">{monthTitle}</div>
                  <button
                    type="button"
                    onClick={() => shiftCalendar(1)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900"
                    aria-label="Next month"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="py-1">{day}</div>
                  ))}
                </div>

                <div className="mt-2 grid grid-cols-7 gap-1">
                  {monthCells.map((day) => {
                    const inMonth = day.getMonth() === calendarDate.getMonth();
                    const isSelected = isSameDateOnly(day, calendarDate);
                    const isToday = isSameDateOnly(day, new Date());
                    const count = getEventCountForDay(visibleEvents, day);
                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        onClick={() => setCalendarDate(day)}
                        className={[
                          'flex h-10 flex-col items-center justify-center rounded-xl border text-xs font-medium transition',
                          inMonth ? 'border-slate-200 bg-white text-slate-700 hover:border-[var(--primary)] hover:text-[var(--primary)]' : 'border-slate-100 bg-slate-50 text-slate-300',
                          isSelected ? 'border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_10%,white)] text-[var(--primary)]' : '',
                          isToday ? 'ring-1 ring-inset ring-[var(--primary)]' : ''
                        ].join(' ')}
                        aria-label={`Select ${day.toDateString()}`}
                      >
                        <span className="leading-none">{day.getDate()}</span>
                        {count ? <span className="mt-0.5 text-[10px] font-semibold text-[var(--primary)]">{count}</span> : <span className="mt-0.5 h-1 w-1 rounded-full bg-transparent" />}
                      </button>
                    );
                  })}
                </div>
              </Card>

              <Card className="mt-4 p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Quick filters</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {scopeFilters.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setScopeFilter(item.value)}
                      className={[
                        'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                        scopeFilter === item.value
                          ? 'border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_10%,white)] text-[var(--primary)]'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                      ].join(' ')}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="mt-4 space-y-2 text-xs text-slate-500">
                  <div className="flex items-center justify-between">
                    <span>Visible events</span>
                    <span className="font-semibold text-slate-700">{visibleEvents.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Selected day</span>
                    <span className="font-semibold text-slate-700">{selectedDateEvents.length}</span>
                  </div>
                </div>
              </Card>
            </div>

            <div className="min-h-0 overflow-y-auto p-4 lg:p-6">
              {loading ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  Loading events...
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Event feed</div>
                      <div className="mt-1 text-sm text-slate-500">Click any card to edit the event.</div>
                    </div>
                    <div className="text-xs text-slate-500">
                      {visibleEvents.length} total
                    </div>
                  </div>

                  <Card className="p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{formatDate(calendarDate)}</div>
                        <div className="mt-1 text-xs text-slate-500">Selected date preview</div>
                      </div>
                      <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                        {selectedDateEvents.length} event(s)
                      </div>
                    </div>
                    {selectedDateEvents.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedDateEvents.slice(0, 5).map((event) => (
                          <button
                            key={event.id}
                            type="button"
                            onClick={() => setEditingEvent(event)}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
                          >
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: event.color || '#3b82f6' }} />
                            <span className="max-w-[10rem] truncate">{event.title || 'Untitled event'}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                        No events on the selected day.
                      </div>
                    )}
                  </Card>

                  {groupedEvents.length ? groupedEvents.map((group) => (
                    <Card key={group.date} className="space-y-3 p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-900">{formatDate(group.date)}</div>
                        <div className="text-xs text-slate-500">{group.items.length} event(s)</div>
                      </div>
                      <div className="space-y-3">
                        {group.items.map((event) => (
                          <button
                            key={event.id}
                            type="button"
                            onClick={() => setEditingEvent(event)}
                            className="group w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary)_4%,white)]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
                                    style={{ backgroundColor: `${(event.color || '#3b82f6')}18`, color: event.color || '#3b82f6' }}
                                  >
                                    Event
                                  </span>
                                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    {getScopeTypeLabel(event.scopeType)}
                                  </span>
                                  {String(event.scopeType || '').toLowerCase() !== 'global' ? (
                                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                      {getScopeRecordLabel(event, scopeLookup)}
                                    </span>
                                  ) : null}
                                  <span className="text-xs text-slate-400">{formatTimeRange(event) || formatDate(event.startDate || event.endDate || event.createdAt)}</span>
                                </div>
                                <div className="mt-2 text-sm font-semibold text-slate-900">{event.title || 'Untitled event'}</div>
                                {event.description ? <div className="mt-1 text-sm text-slate-600">{event.description}</div> : null}
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                  {event.location ? (
                                    <span className="inline-flex items-center gap-1">
                                      <MapPin size={12} />
                                      {event.location}
                                    </span>
                                  ) : null}
                                  <span>{getVisibilityLabel(event)}</span>
                                  {event.ownerUserId ? <span>by {userLookup.get(String(event.ownerUserId)) || currentUserName}</span> : null}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditingEvent(event); }} title="Edit event">
                                  <Edit3 size={16} />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeleteTarget(event); }} title="Delete event" className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                  <Trash2 size={16} />
                                </Button>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </Card>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                      No events found. Click Add event to create one.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      <EventFormModal
        open={Boolean(editingEvent)}
        title={editingEvent?.id ? 'Edit event' : 'Add event'}
        subtitle="Create a global event or link it to a lead, client, or project."
        onClose={handleCloseEditor}
        onSave={saveEvent}
        busy={busy}
        initialValue={editingEvent}
        labelOptions={labelOptions}
        userOptions={userOptions}
        scopeOptions={scopeOptions}
        uploadModule="events"
        uploadEntityId={editingEvent?.id || editingEvent?.attachmentEntityId || 'global'}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete event"
        description={`Delete ${deleteTarget?.title || 'this event'}? This cannot be undone.`}
        confirmText="Delete"
        type="danger"
        isLoading={false}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
