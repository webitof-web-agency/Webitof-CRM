import { useState } from 'react';
import { cn } from '../../lib/cn';

// Fixed series colours (validated categorical slots, light / dark). A series keeps its colour on
// every chart of the dashboard: revenue is always blue, expense aqua, and so on.
export const SERIES = {
  revenue: { label: 'Revenue', fill: 'fill-[#257de0] dark:fill-[#338ced]', bg: 'bg-[#257de0] dark:bg-[#338ced]', stroke: 'stroke-[#257de0] dark:stroke-[#338ced]' },
  received: { label: 'Received', fill: 'fill-[#f47230] dark:fill-[#e76624]', bg: 'bg-[#f47230] dark:bg-[#e76624]', stroke: 'stroke-[#f47230] dark:stroke-[#e76624]' },
  expense: { label: 'Expense', fill: 'fill-[#00b894] dark:fill-[#00a888]', bg: 'bg-[#00b894] dark:bg-[#00a888]', stroke: 'stroke-[#00b894] dark:stroke-[#00a888]' },
  profit: { label: 'Profit', fill: 'fill-[#6a4ce2] dark:fill-[#9887ef]', bg: 'bg-[#6a4ce2] dark:bg-[#9887ef]', stroke: 'stroke-[#6a4ce2] dark:stroke-[#9887ef]' },
  due: { label: 'Due', fill: 'fill-[#f2a600] dark:fill-[#d28e05]', bg: 'bg-[#f2a600] dark:bg-[#d28e05]', stroke: 'stroke-[#f2a600] dark:stroke-[#d28e05]' }
};
// Status colours carry meaning only (good / warning / serious / critical) and always come with a label.
export const STATUS = { good: '#0aac23', warning: '#fbb315', serious: '#f18a59', critical: '#dc3c3d' };
export const scoreColor = (score) => (score == null ? '#94a3b8' : score >= 80 ? STATUS.good : score >= 60 ? STATUS.warning : score >= 40 ? STATUS.serious : STATUS.critical);
// One hue light → dark for "how late" (sequential, magnitude).
export const SEQUENTIAL = ['#84b9f3', '#519ced', '#257de0', '#1b64be', '#0f4a96'];

export function Legend({ items }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-muted)]">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className={cn('h-2.5 w-2.5 rounded-sm', item.className)} style={item.color ? { background: item.color } : undefined} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

// Tiny trend line under a KPI (last 12 months). Area + line, no axes.
export function Sparkline({ values = [], series = SERIES.revenue, height = 28 }) {
  const points = values.map((v) => Number(v || 0));
  if (points.length < 2 || points.every((v) => v === 0)) return <div style={{ height }} />;
  const max = Math.max(...points);
  const min = Math.min(0, ...points);
  const w = 100;
  const xy = points.map((v, i) => [(i / (points.length - 1)) * w, height - 2 - ((v - min) / Math.max(1, max - min)) * (height - 4)]);
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="block w-full" style={{ height }} aria-hidden="true">
      <polygon points={`0,${height} ${line} ${w},${height}`} className={cn(series.fill, 'opacity-15')} />
      <polyline points={line} fill="none" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" className={series.stroke} />
    </svg>
  );
}

// Progress ring (0–100+) with the value in the middle.
export function Ring({ value, size = 76, stroke = 8, color, label, sub }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-[var(--surface-2)]" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={color || scoreColor(value)}
          strokeDasharray={`${(pct / 100) * c} ${c}`}
          style={{ transition: 'stroke-dasharray .6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-tight">
        <span className="text-base font-bold tabular-nums text-[var(--text-main)]">{label ?? (value == null ? '—' : `${value}%`)}</span>
        {sub ? <span className="text-[10px] text-[var(--text-muted)]">{sub}</span> : null}
      </div>
    </div>
  );
}

// Donut for parts of a whole, with a 2px gap between slices and the total in the middle.
export function Donut({ items, size = 132, stroke = 18, centerLabel, centerSub }) {
  const [hover, setHover] = useState(null);
  const total = items.reduce((s, item) => s + item.value, 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = total && items.filter((i) => i.value).length > 1 ? 2 : 0;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-[var(--surface-2)]" />
          {total
            ? items.map((item) => {
                const length = (item.value / total) * c;
                const dash = Math.max(0, length - gap);
                const el = item.value ? (
                  <circle
                    key={item.label}
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    strokeWidth={hover === item.label ? stroke + 4 : stroke}
                    stroke={item.color}
                    strokeDasharray={`${dash} ${c - dash}`}
                    strokeDashoffset={-offset}
                    onMouseEnter={() => setHover(item.label)}
                    onMouseLeave={() => setHover(null)}
                    style={{ transition: 'stroke-width .15s' }}
                  />
                ) : null;
                offset += length;
                return el;
              })
            : null}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center leading-tight">
          {hover ? (
            <>
              <span className="text-lg font-bold tabular-nums text-[var(--text-main)]">{items.find((i) => i.label === hover)?.value}</span>
              <span className="max-w-[80%] truncate text-[10px] text-[var(--text-muted)]">{hover}</span>
            </>
          ) : (
            <>
              <span className="text-lg font-bold tabular-nums text-[var(--text-main)]">{centerLabel ?? total}</span>
              {centerSub ? <span className="text-[10px] text-[var(--text-muted)]">{centerSub}</span> : null}
            </>
          )}
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1 text-xs">
        {items.map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-2" onMouseEnter={() => setHover(item.label)} onMouseLeave={() => setHover(null)}>
            <span className="flex min-w-0 items-center gap-1.5 text-[var(--text-muted)]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: item.color }} />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="font-semibold tabular-nums text-[var(--text-main)]">
              {item.value}
              {total ? <span className="ml-1 font-normal text-[var(--text-muted)]">{Math.round((item.value / total) * 100)}%</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Sales funnel: tapered bars, step-to-step conversion between them.
export function Funnel({ steps }) {
  const max = Math.max(1, steps[0]?.count || 0);
  const shades = ['#84b9f3', '#519ced', '#257de0', '#1b64be'];
  return (
    <div className="space-y-1">
      {steps.map((step, index) => (
        <div key={step.stage}>
          {index ? <p className="text-center text-[10px] text-[var(--text-muted)]">↓ {step.rate}% moved on</p> : null}
          <div className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs text-[var(--text-muted)]">{step.stage}</span>
            <div className="flex flex-1 justify-center">
              <div
                className="flex h-8 items-center justify-center rounded-lg text-xs font-bold text-white transition-all"
                style={{ width: `${Math.max(14, (step.count / max) * 100)}%`, background: shades[index] || shades[3] }}
                title={`${step.stage}: ${step.count}`}
              >
                {step.count}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Horizontal bars for one measure over a few categories.
export function BarList({ items, format = (v) => v, className = SERIES.revenue.bg, labelWidth = '7.5rem' }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  if (!items.length) return null;
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="grid items-center gap-2 text-xs" style={{ gridTemplateColumns: `minmax(0,${labelWidth}) 1fr auto` }} title={`${item.label}: ${format(item.value)}`}>
          <span className="truncate text-[var(--text-muted)]">{item.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
            <span
              className={cn('block h-full rounded-full', !item.color && (item.className || className))}
              style={{ width: `${Math.max(item.value ? 4 : 0, (item.value / max) * 100)}%`, ...(item.color ? { background: item.color } : {}) }}
            />
          </span>
          <span className="font-semibold tabular-nums text-[var(--text-main)]">{format(item.value)}</span>
        </li>
      ))}
    </ul>
  );
}

// One bar split into parts (aging buckets, paid vs due), 2px gaps between parts.
export function StackBar({ parts, height = 14 }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div className="flex w-full gap-[2px] overflow-hidden rounded-full bg-[var(--surface-2)]" style={{ height }}>
      {total
        ? parts.filter((p) => p.value > 0).map((p) => (
            <span key={p.label} title={`${p.label}: ${p.display ?? p.value}`} className={cn('h-full first:rounded-l-full last:rounded-r-full', p.className)} style={{ width: `${(p.value / total) * 100}%`, ...(p.color ? { background: p.color } : {}) }} />
          ))
        : null}
    </div>
  );
}

// Twelve months on one ₹ axis: revenue and expense bars, profit as a line with dots; hover a month
// for every figure.
export function ComboChart({ months, format }) {
  const [hover, setHover] = useState(null);
  const values = months.flatMap((m) => [m.revenue, m.expense, m.profit, m.received]).map((v) => Number(v || 0));
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const span = max - min;
  const h = 180;
  const y = (v) => h - ((Number(v || 0) - min) / span) * h;
  const zero = y(0);
  const step = 100 / months.length;
  const profitLine = months.map((m, i) => `${(i + 0.5) * step},${y(m.profit)}`).join(' ');
  const empty = values.every((v) => v === 0);
  return (
    <div>
      <Legend items={[{ label: 'Revenue', className: SERIES.revenue.bg }, { label: 'Expense', className: SERIES.expense.bg }, { label: 'Profit', className: SERIES.profit.bg }]} />
      <div className="relative mt-3">
        <svg viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" className="block h-48 w-full overflow-visible" aria-label="Revenue, expense and profit by month">
          <line x1="0" x2="100" y1={zero} y2={zero} vectorEffect="non-scaling-stroke" className="stroke-[var(--border)]" strokeWidth="1" />
          {months.map((m, i) => {
            const x = i * step;
            const bw = step * 0.3;
            const bar = (v, offset, cls) => {
              const top = Math.min(y(v), zero);
              const height = Math.max(Number(v) ? 1.5 : 0, Math.abs(zero - y(v)));
              return <rect x={x + step * offset} y={top} width={bw} height={height} rx="0.8" className={cls} />;
            };
            return (
              <g key={m.from} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={x} y="0" width={step} height={h} className={hover === i ? 'fill-[var(--surface-2)]' : 'fill-transparent'} />
                {bar(m.revenue, 0.17, SERIES.revenue.fill)}
                {bar(m.expense, 0.53, SERIES.expense.fill)}
              </g>
            );
          })}
          <polyline points={profitLine} fill="none" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" className={cn(SERIES.profit.stroke, 'pointer-events-none')} />
        </svg>
        {/* Dots as HTML so they stay round on a stretched SVG. */}
        <div className="pointer-events-none absolute inset-0 h-48">
          {months.map((m, i) => (
            <span
              key={m.from}
              className={cn('absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--surface)]', SERIES.profit.bg)}
              style={{ left: `${(i + 0.5) * step}%`, top: `${(y(m.profit) / h) * 100}%` }}
            />
          ))}
        </div>
        <div className="mt-1.5 flex text-center text-[10px] text-[var(--text-muted)]">
          {months.map((m) => (
            <span key={m.from} className="flex-1">{m.month}</span>
          ))}
        </div>
        {hover != null ? (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs shadow-lg"
            style={{ left: `${Math.min(86, Math.max(14, (hover + 0.5) * step))}%` }}
          >
            <p className="mb-1 font-semibold text-[var(--text-main)]">{months[hover].month}</p>
            {[
              ['Revenue', months[hover].revenue, SERIES.revenue.bg],
              ['Expense', months[hover].expense, SERIES.expense.bg],
              ['Profit', months[hover].profit, SERIES.profit.bg],
              ['Invoiced', months[hover].invoiced, null],
              ['Received', months[hover].received, null]
            ].map(([label, value, bg]) => (
              <p key={label} className="flex items-center gap-1.5 text-[var(--text-muted)]">
                <span className={cn('h-2 w-2 rounded-sm', bg || 'bg-transparent')} />
                {label}: <span className="font-semibold tabular-nums text-[var(--text-main)]">{format(value)}</span>
              </p>
            ))}
          </div>
        ) : null}
        {empty ? <p className="absolute inset-x-0 top-16 text-center text-xs text-[var(--text-muted)]">No invoices or expenses in the last 12 months yet.</p> : null}
      </div>
    </div>
  );
}
