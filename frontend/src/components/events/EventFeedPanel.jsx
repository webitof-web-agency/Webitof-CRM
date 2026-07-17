import { CalendarDays, Edit3, MapPin, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { formatDateOnlyDisplay } from '../../lib/dateOnly';

function getScopeTypeLabel(scopeType) {
  const normalized = String(scopeType || '').toLowerCase();
  if (normalized === 'lead') return 'Lead';
  if (normalized === 'client') return 'Client';
  if (normalized === 'project') return 'Project';
  return 'Global';
}

function getVisibilityLabel(visibility) {
  const normalized = String(visibility || 'all_team').toLowerCase();
  if (normalized === 'only_me') return 'Only me';
  if (normalized === 'specific') return 'Specific members';
  return 'All team members';
}

function formatTimeRange(event) {
  const dateStr = event?.startDate ? formatDateOnlyDisplay(event.startDate, 'en-US') : '';
  let timeStr = '';
  if (event?.startTime && event?.endTime) timeStr = `${event.startTime} - ${event.endTime}`;
  else if (event?.startTime) timeStr = event.startTime;
  else if (event?.endTime) timeStr = event.endTime;

  if (dateStr && timeStr) return `${dateStr} | ${timeStr}`;
  if (dateStr) return dateStr;
  if (timeStr) return timeStr;
  return 'All day';
}

export function EventFeedPanel({
  selectedDate,
  selectedDateLabel,
  selectedDateEvents = [],
  events,
  onEditEvent,
  onDeleteEvent,
  subtitle = 'All events.',
  className = ''
}) {
  const displayEvents = (events && events.length > 0) ? events : selectedDateEvents;

  return (
    <div className={`min-h-0 space-y-4 lg:sticky lg:top-4 ${className}`.trim()}>
      <Card className="p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-[var(--primary)]" />
            <div className="text-sm font-semibold text-slate-900">Events</div>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            {displayEvents.length} event(s)
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {displayEvents.length ? displayEvents.map((event) => (
            <div
              key={event.id}
              onClick={() => onEditEvent?.(event)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onEditEvent?.(event);
                }
              }}
              className="group w-full rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary)_4%,white)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
                      style={{ backgroundColor: `${(event.color || '#3b82f6')}18`, color: event.color || '#3b82f6' }}
                    >
                      {getScopeTypeLabel(event.scopeType)}
                    </span>
                    <span className="text-xs text-slate-400">{formatTimeRange(event)}</span>
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
                    <span>{getVisibilityLabel(event.visibility)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditEvent?.(event);
                    }}
                    title="Edit event"
                    className="h-8 w-8"
                  >
                    <Edit3 size={15} />
                  </Button>
                  {onDeleteEvent ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteEvent?.(event);
                      }}
                      title="Delete event"
                      className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={15} />
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              No events found.
            </div>
          )}
        </div>
      </Card>

    </div>
  );
}
