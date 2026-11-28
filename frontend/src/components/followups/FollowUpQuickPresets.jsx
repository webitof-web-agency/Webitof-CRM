import { Clock, Sun, Calendar, CalendarDays, Sparkles } from 'lucide-react';

export function getQuickPresetValues(presetKey) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const formatLocalDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  switch (presetKey) {
    case 'today_evening': {
      return {
        date: formatLocalDate(now),
        time: '17:00',
        label: 'Today 5:00 PM'
      };
    }
    case 'tomorrow_morning': {
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      return {
        date: formatLocalDate(tomorrow),
        time: '10:00',
        label: 'Tomorrow 10:00 AM'
      };
    }
    case 'in_3_days': {
      const in3 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      return {
        date: formatLocalDate(in3),
        time: '11:00',
        label: 'In 3 Days (11:00 AM)'
      };
    }
    case 'next_monday': {
      const nextMon = new Date(now);
      const day = nextMon.getDay();
      const diff = (day === 0 ? 1 : 8 - day); // Days until next Monday
      nextMon.setDate(nextMon.getDate() + diff);
      return {
        date: formatLocalDate(nextMon),
        time: '10:30',
        label: 'Next Monday 10:30 AM'
      };
    }
    default:
      return null;
  }
}

export function FollowUpQuickPresets({ onSelectPreset, className = '' }) {
  const presets = [
    { key: 'today_evening', label: 'Today 5 PM', icon: Clock, desc: 'End of day callback' },
    { key: 'tomorrow_morning', label: 'Tomorrow 10 AM', icon: Sun, desc: 'Fresh morning start' },
    { key: 'in_3_days', label: 'In 3 Days', icon: Calendar, desc: 'Mid-week follow-up' },
    { key: 'next_monday', label: 'Next Monday', icon: CalendarDays, desc: 'Start of next week' }
  ];

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        <Sparkles size={12} className="text-amber-500" />
        <span>Quick Schedule Presets:</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {presets.map((preset) => {
          const Icon = preset.icon;
          return (
            <button
              key={preset.key}
              type="button"
              onClick={() => {
                const values = getQuickPresetValues(preset.key);
                if (values) onSelectPreset(values);
              }}
              title={preset.desc}
              className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-800/60 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700/60 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-medium transition cursor-pointer"
            >
              <Icon size={13} className="text-slate-500 group-hover:text-blue-500 shrink-0" />
              <span className="truncate">{preset.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FollowUpCadenceStepper({ currentAttempt = 0, onStartCadence }) {
  const steps = [
    { step: 1, name: 'Attempt 1', label: 'Discovery Call', window: '+3 hrs / Next Morning' },
    { step: 2, name: 'Attempt 2', label: 'Proposal Review', window: 'Day 2 @ 11 AM' },
    { step: 3, name: 'Attempt 3', label: 'Final Closing Check', window: 'Day 5 @ 10:30 AM' }
  ];

  // One row: title, the three attempts (number + name + timing on one line), then the action.
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-blue-200/60 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 px-3 py-2 lg:flex-row lg:items-center lg:gap-3">
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">⚡</span>
        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Sales Cadence</span>
      </div>

      <div className="grid min-w-0 flex-1 grid-cols-1 gap-1.5 sm:grid-cols-3">
        {steps.map((s) => {
          const isDone = currentAttempt >= s.step;
          const isCurrent = currentAttempt + 1 === s.step;
          return (
            <div
              key={s.step}
              title={`${s.name}: ${s.label} (${s.window})`}
              className={`flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1 transition ${
                isDone
                  ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/60'
                  : isCurrent
                  ? 'bg-blue-100/70 dark:bg-blue-900/40 border-blue-400 dark:border-blue-700'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60'
              }`}
            >
              <span
                className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  isDone
                    ? 'bg-emerald-600 text-white'
                    : isCurrent
                    ? 'bg-blue-600 text-white'
                    : 'border border-slate-300 dark:border-slate-700 text-slate-500'
                }`}
              >
                {isDone ? '✓' : s.step}
              </span>
              <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{s.label}</span>
              <span className="ml-auto shrink-0 text-[10px] text-slate-500 dark:text-slate-400">{s.window}</span>
            </div>
          );
        })}
      </div>

      {onStartCadence ? (
        <button
          type="button"
          onClick={onStartCadence}
          className="shrink-0 text-left text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
        >
          Apply Next Step
        </button>
      ) : null}
    </div>
  );
}
