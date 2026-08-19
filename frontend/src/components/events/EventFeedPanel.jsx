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
            <div className="text-xs font-bold text-[var(--text-main)]">Events</div>
          </div>
          <div className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-0.5 text-xs font-bold text-[var(--text-muted)]">
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
              className="group w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left shadow-2xs transition hover:border-[var(--primary)] hover:shadow-xs cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      style={{ backgroundColor: `${(event.color || '#3b82f6')}18`, color: event.color || '#3b82f6' }}
                    >
                      {getScopeTypeLabel(event.scopeType)}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">{formatTimeRange(event)}</span>
                  </div>
                  <div className="mt-2 text-xs font-bold text-[var(--text-main)]">{event.title || 'Untitled event'}</div>
                  {event.description ? <div className="mt-1 text-xs text-[var(--text-muted)]">{event.description}</div> : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
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
                    <Edit3 size={14} />
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
                      className="h-8 w-8 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600"
                    >
                      <Trash2 size={14} />
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          )) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)]/30 px-4 py-4 text-center text-xs text-[var(--text-muted)]">
              No events found.
            </div>
          )}
        </div>
      </Card>

    </div>
  );
}
