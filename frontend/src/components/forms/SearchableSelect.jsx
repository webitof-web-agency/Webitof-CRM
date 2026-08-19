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
        top: dropUp ? undefined : rect.bottom + 4,
        bottom: dropUp ? window.innerHeight - rect.top + 4 : undefined,
        maxHeight: Math.min(300, dropUp ? spaceAbove - 10 : spaceBelow - 10)
      });
    }

    updateCoords();
    window.addEventListener('resize', updateCoords);
    window.addEventListener('scroll', updateCoords, true);
    return () => {
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [open]);

  const normalizedOptions = useMemo(
    () => (Array.isArray(options) ? options.map((opt) => normalizeOption(opt)) : []),
    [options]
  );

  const selectedValues = useMemo(() => {
    if (multiple) {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string' && value.trim()) return value.split(',').map((v) => v.trim()).filter(Boolean);
      return [];
    }
    return value != null ? [value] : [];
  }, [multiple, value]);

  const selectedValueSet = useMemo(
    () => new Set(selectedValues.map((val) => String(val))),
    [selectedValues]
  );

  const selectedItems = useMemo(
    () => normalizedOptions.filter((opt) => selectedValueSet.has(String(opt.value))),
    [normalizedOptions, selectedValueSet]
  );

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalizedOptions;
    return normalizedOptions.filter(
      (opt) =>
        opt.label?.toLowerCase().includes(q) ||
        opt.description?.toLowerCase().includes(q) ||
        String(opt.value).toLowerCase().includes(q)
    );
  }, [normalizedOptions, query]);

  function toggleValue(nextValue) {
    if (disabled) return;
    const option = normalizedOptions.find((item) => String(item.value) === String(nextValue));
    if (option?.disabled) return;
    if (multiple) {
      const next = new Map(selectedValues.map((item) => [String(item), item]));
      if (next.has(String(nextValue))) next.delete(String(nextValue));
      else next.set(String(nextValue), nextValue);
      onChange?.([...next.values()]);
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
    onChange?.(selectedValues.filter((item) => String(item) !== String(nextValue)));
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
          className={cn(
            'flex w-full cursor-pointer items-start justify-between gap-3 rounded-[var(--radius-input,0.625rem)] border border-[var(--input-border)] bg-[var(--surface)] px-3.5 py-2 text-left text-xs font-medium text-[var(--text-main)] outline-none transition focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary-subtle)] disabled:cursor-not-allowed disabled:opacity-60 shadow-2xs',
            triggerClassName
          )}
        >
          <div className="min-w-0 flex-1">
            {selectedItems.length ? (
              <div className="flex flex-wrap gap-1.5">
                {selectedItems.map((item) => renderChip(item))}
              </div>
            ) : (
              <span className="text-[var(--text-muted)]">{placeholder}</span>
            )}
          </div>
          <span className="flex items-center gap-2 text-[var(--text-muted)] pt-0.5">
            <ChevronDown size={14} className={cn('transition-transform duration-200', open && 'rotate-180')} />
          </span>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
          className={cn(
            'flex w-full items-center justify-between gap-3 rounded-[var(--radius-input,0.625rem)] border border-[var(--input-border)] bg-[var(--surface)] px-3.5 py-2 text-left text-xs font-medium text-[var(--text-main)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-subtle)] disabled:cursor-not-allowed disabled:opacity-60 shadow-2xs cursor-pointer',
            triggerClassName
          )}
        >
          <span className={cn('min-w-0 flex-1 truncate', !selectedItems.length && 'text-[var(--text-muted)]')}>
            {selectedItems[0]?.label || placeholder}
          </span>
          <span className="flex items-center gap-2 text-[var(--text-muted)]">
            <ChevronDown size={14} className={cn('transition-transform duration-200', open && 'rotate-180')} />
          </span>
        </button>
      )}

      {open && coords ? createPortal(
        <div
          ref={dropdownRef}
          data-modal-portal="true"
          onMouseDown={(event) => event.stopPropagation()}
          className="fixed z-[9999] overflow-hidden rounded-2xl border border-[var(--border-glass)] bg-[var(--surface)] shadow-[var(--shadow-modal)] backdrop-blur-xl animate-fade-scale"
          style={coords}
        >
          <div className="border-b border-[var(--border)] p-2 bg-[var(--surface)]">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="pl-9 text-xs"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto p-1.5 flex flex-col gap-0.5">
            {filteredOptions.length ? filteredOptions.map((option) => {
              const active = selectedValueSet.has(String(option.value));
              const color = option.color || '';
              const optionDisabled = Boolean(option.disabled);
              return (
                <button
                  key={String(option.value)}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2.5 px-2.5 py-2 text-left rounded-xl transition text-xs font-medium cursor-pointer',
                    optionDisabled
                      ? active
                        ? 'cursor-not-allowed bg-[var(--surface-2)] text-[var(--text-muted)] opacity-60'
                        : 'cursor-not-allowed text-[var(--text-muted)] opacity-40'
                      : active 
                        ? 'bg-[var(--primary-subtle)] text-[var(--primary)] font-bold'
                        : 'text-[var(--text-main)] hover:bg-[var(--hover-bg)]'
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
                      <span className={cn('block text-xs', optionDisabled && 'opacity-70')}>{option.label}</span>
                      {optionDisabled ? (
                        <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
                          Inactive
                        </span>
                      ) : null}
                    </span>
                    {option.description ? <span className="mt-0.5 block text-[11px] text-[var(--text-muted)]">{option.description}</span> : null}
                  </span>
                  {active ? <Check size={14} className="shrink-0 text-[var(--primary)]" /> : null}
                </button>
              );
            }) : (
              <div className="px-4 py-8 text-center text-xs text-[var(--text-muted)]">No options found</div>
            )}
          </div>
          {multiple && selectedItems.length ? (
            <div className="border-t border-[var(--border)] px-3 py-2 bg-[var(--surface-2)]/40">
              <div className="flex flex-wrap gap-1.5">
                {selectedItems.slice(0, maxSelectedChips).map((item) => (
                  <span key={String(item.value)} className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 text-[11px] text-[var(--text-main)]">
                    {item.label}
                  </span>
                ))}
                {selectedItems.length > maxSelectedChips ? (
                  <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
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
