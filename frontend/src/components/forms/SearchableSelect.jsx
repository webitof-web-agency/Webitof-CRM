import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { Input } from '../ui/Input';
import { cn } from '../../lib/cn';
import { normalizeOption } from '../../lib/resource';

function useOutsideClick(ref, onOutside) {
  useEffect(() => {
    function handle(event) {
      if (Array.isArray(ref)) {
        if (ref.some(r => r.current && r.current.contains(event.target))) return;
      } else {
        if (!ref.current || ref.current.contains(event.target)) return;
      }
      onOutside?.();
    }

    document.addEventListener('mousedown', handle, true);
    return () => document.removeEventListener('mousedown', handle, true);
  }, [onOutside, ref]);
}

export function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select an option',
  searchPlaceholder = 'Search options...',
  multiple = false,
  disabled = false,
  className = '',
  triggerClassName = '',
  maxSelectedChips = 2
}) {
  const rootRef = useRef(null);
  const dropdownRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState(null);

  useOutsideClick(useMemo(() => [rootRef, dropdownRef], []), () => setOpen(false));

  useEffect(() => {
    if (!open || !rootRef.current) return;
    
    function updateCoords() {
      if (!rootRef.current) return;
      const rect = rootRef.current.getBoundingClientRect();
      const dialog = rootRef.current.closest('[role="dialog"]');
      const dialogBottom = dialog ? dialog.getBoundingClientRect().bottom : window.innerHeight;
      const dialogTop = dialog ? dialog.getBoundingClientRect().top : 0;
      
      const spaceBelow = dialogBottom - rect.bottom;
      const spaceAbove = rect.top - dialogTop;
      
      const dropUp = spaceBelow < 300 && spaceAbove > spaceBelow;
      
      setCoords({
        left: rect.left,
        width: rect.width,
        top: dropUp ? undefined : rect.bottom + 8,
        bottom: dropUp ? window.innerHeight - rect.top + 8 : undefined,
      });
    }
    
    updateCoords();
    window.addEventListener('scroll', updateCoords, true);
    window.addEventListener('resize', updateCoords);
    
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [open]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const normalizedOptions = useMemo(() => options.map(normalizeOption).filter((option) => option.label), [options]);

  const selectedValues = multiple ? (Array.isArray(value) ? value : []) : (value !== undefined && value !== null ? [value] : []);
  const selectedItems = normalizedOptions.filter((option) => selectedValues.includes(option.value));

  const filteredOptions = useMemo(() => {
    const searchable = query.trim().toLowerCase();
    if (!searchable) return normalizedOptions;
    return normalizedOptions.filter((option) => {
      const haystack = `${option.label} ${option.description} ${String(option.value)}`.toLowerCase();
      return haystack.includes(searchable);
    });
  }, [normalizedOptions, query]);

  function toggleValue(nextValue) {
    if (disabled) return;
    const option = normalizedOptions.find((item) => String(item.value) === String(nextValue));
    if (option?.disabled) return;
    if (multiple) {
      const next = new Set(selectedValues);
      if (next.has(nextValue)) next.delete(nextValue);
      else next.add(nextValue);
      onChange?.([...next]);
      return;
    }

    onChange?.(nextValue);
    setOpen(false);
  }

  function removeValue(nextValue) {
    if (disabled) return;
    if (!multiple) {
      onChange?.('');
      return;
    }
    onChange?.(selectedValues.filter((item) => item !== nextValue));
  }

  function renderChip(item) {
    const color = item.color || '';
    const chipStyle = color
      ? {
          backgroundColor: `${color}1A`,
          borderColor: `${color}33`,
          color
        }
      : {};

    return (
      <span
        key={String(item.value)}
        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
        style={chipStyle}
      >
        {color ? <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} /> : null}
        <span className="max-w-[10rem] truncate">{item.label}</span>
        <button
          type="button"
          className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-current transition hover:bg-black/10"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            removeValue(item.value);
          }}
          aria-label={`Remove ${item.label}`}
        >
          <X size={10} />
        </button>
      </span>
    );
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {multiple ? (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          onClick={() => !disabled && setOpen((current) => !current)}
          onKeyDown={(event) => {
            if (disabled) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setOpen((current) => !current);
            }
          }}
          className={cn("flex w-full cursor-pointer items-start justify-between gap-3 rounded-[var(--radius-input,0.75rem)] border border-slate-200 bg-white px-4 py-3 text-left text-sm text-[var(--text-main)] outline-none transition focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60", triggerClassName)}
        >
          <div className="min-w-0 flex-1">
            {selectedItems.length ? (
              <div className="flex flex-wrap gap-2">
                {selectedItems.map((item) => renderChip(item))}
              </div>
            ) : (
              <span className="text-[var(--text-muted)]">{placeholder}</span>
            )}
          </div>
          <span className="flex items-center gap-2 text-[var(--text-muted)] pt-0.5">
            <ChevronDown size={16} className={cn('transition', open && 'rotate-180')} />
          </span>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
          className={cn("flex w-full items-center justify-between gap-3 rounded-[var(--radius-input,0.75rem)] border border-slate-200 bg-white px-4 py-3 text-left text-sm text-[var(--text-main)] outline-none transition focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60", triggerClassName)}
        >
          <span className={cn('min-w-0 flex-1 truncate', !selectedItems.length && 'text-[var(--text-muted)]')}>
            {selectedItems[0]?.label || placeholder}
          </span>
          <span className="flex items-center gap-2 text-[var(--text-muted)]">
            <ChevronDown size={16} className={cn('transition', open && 'rotate-180')} />
          </span>
        </button>
      )}

      {open && coords ? createPortal(
        <div
          ref={dropdownRef}
          data-modal-portal="true"
          onMouseDown={(event) => event.stopPropagation()}
          className="fixed z-[9999] overflow-hidden rounded-[var(--radius-card,1.5rem)] border border-slate-200 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.12)]"
          style={coords}
        >
          <div className="border-b border-slate-100 p-2">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="pl-9"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto p-1.5 flex flex-col gap-0.5">
            {filteredOptions.length ? filteredOptions.map((option) => {
              const active = selectedValues.includes(option.value);
              const color = option.color || '';
              const optionDisabled = Boolean(option.disabled);
              return (
                <button
                  key={String(option.value)}
                  type="button"
                  style={{ borderRadius: 'var(--radius-button, 0.5rem)' }}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition',
                    optionDisabled
                      ? active
                        ? 'cursor-not-allowed bg-slate-100 text-slate-500'
                        : 'cursor-not-allowed text-slate-400'
                      : active 
                        ? 'bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)]'
                        : 'text-[var(--text-main)] hover:bg-slate-50 hover:text-[var(--primary)]'
                  )}
                  onMouseDown={(event) => {
                    if (optionDisabled) {
                      event.preventDefault();
                      return;
                    }
                    event.preventDefault();
                  }}
                  onClick={() => toggleValue(option.value)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      {color ? <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} /> : null}
                      <span className={cn('block text-sm', optionDisabled && 'opacity-70')}>{option.label}</span>
                      {optionDisabled ? (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
                          Inactive
                        </span>
                      ) : null}
                    </span>
                    {option.description ? <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{option.description}</span> : null}
                  </span>
                </button>
              );
            }) : (
              <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">No options found</div>
            )}
          </div>
          {multiple && selectedItems.length ? (
            <div className="border-t border-slate-100 px-3 py-2">
              <div className="flex flex-wrap gap-2">
                {selectedItems.slice(0, maxSelectedChips).map((item) => (
                  <span key={String(item.value)} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-[var(--text-main)]">
                    {item.label}
                  </span>
                ))}
                {selectedItems.length > maxSelectedChips ? (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-[var(--text-muted)]">
                    +{selectedItems.length - maxSelectedChips} more
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>,
        document.body
      ) : null}
    </div>
  );
}
