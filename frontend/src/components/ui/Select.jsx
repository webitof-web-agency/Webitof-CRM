import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search } from 'lucide-react';
import { cn } from '../../lib/cn';

export function Select({
  options = [],
  value,
  onChange,
  placeholder = 'Select an option...',
  className = '',
  searchable = true,
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const [coords, setCoords] = useState(null);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    return options.filter((opt) =>
      String(opt.label || opt.name || '')
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [options, search]);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event) {
      const target = event.target;
      if (containerRef.current && containerRef.current.contains(target)) return;
      if (dropdownRef.current && dropdownRef.current.contains(target)) return;
      setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, []);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    function updateCoords() {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dialog = containerRef.current.closest('[role="dialog"]');
      const dialogBottom = dialog ? dialog.getBoundingClientRect().bottom : window.innerHeight;
      const dialogTop = dialog ? dialog.getBoundingClientRect().top : 0;

      const spaceBelow = dialogBottom - rect.bottom;
      const spaceAbove = rect.top - dialogTop;

      const dropUp = spaceBelow < 280 && spaceAbove > spaceBelow;

      setCoords({
        left: Math.max(8, rect.left),
        width: Math.min(rect.width, window.innerWidth - 16),
        top: dropUp ? undefined : rect.bottom + 6,
        bottom: dropUp ? window.innerHeight - rect.top + 6 : undefined,
      });
    }

    updateCoords();
    window.addEventListener('scroll', updateCoords, true);
    window.addEventListener('resize', updateCoords);

    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      const selectedIndex = filteredOptions.findIndex((opt) => opt.value === value);
      setFocusedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
  }, [isOpen, value, filteredOptions]);

  function handleKeyDown(e) {
    if (disabled) return;
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      setIsOpen(false);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
        onChange?.(filteredOptions[focusedIndex].value);
        setIsOpen(false);
      }
    }
  }

  return (
    <div className={cn('relative w-full', className)} ref={containerRef} onKeyDown={handleKeyDown}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex w-full items-center justify-between rounded-[var(--radius-input,0.625rem)] border border-[var(--input-border,var(--border))] bg-[var(--input-bg,var(--surface))] px-3.5 py-2.5 text-sm text-[var(--text-main)] outline-none transition-all duration-150 shadow-2xs focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-subtle)] disabled:pointer-events-none disabled:opacity-50 disabled:bg-[var(--surface-2)]',
          !selectedOption && 'text-[var(--text-muted)]',
          isOpen && 'border-[var(--primary)] ring-2 ring-[var(--primary-subtle)]'
        )}
      >
        <span className="truncate text-left font-normal">
          {selectedOption ? selectedOption.label || selectedOption.name : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={cn('shrink-0 text-[var(--text-muted)] transition-transform duration-200 ml-2', isOpen && 'rotate-180 text-[var(--primary)]')}
        />
      </button>

      {isOpen && coords
        ? createPortal(
            <div
              ref={dropdownRef}
              data-modal-portal="true"
              data-portal="true"
              className="fixed z-[9999] rounded-[var(--radius-card,1rem)] border border-[var(--border-glass)] bg-[var(--surface)] shadow-[var(--shadow-float)] backdrop-blur-xl overflow-hidden flex flex-col animate-fade-scale"
              style={{ ...coords, maxHeight: '280px' }}
            >
              {searchable && (
                <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2 text-[var(--text-muted)] bg-[var(--surface-2)]">
                  <Search size={14} className="shrink-0" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-transparent text-xs text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)]"
                  />
                </div>
              )}
              <div className="overflow-y-auto p-1.5 flex-1 space-y-0.5">
                {filteredOptions.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">No results found.</div>
                ) : (
                  filteredOptions.map((opt, i) => {
                    const isSelected = opt.value === value;
                    return (
                      <button
                        key={opt.value ?? i}
                        type="button"
                        onClick={() => {
                          onChange?.(opt.value);
                          setIsOpen(false);
                        }}
                        onMouseEnter={() => setFocusedIndex(i)}
                        className={cn(
                          'flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors text-left cursor-pointer',
                          isSelected
                            ? 'bg-[var(--primary-subtle)] text-[var(--primary)]'
                            : focusedIndex === i
                            ? 'bg-[var(--hover-bg)] text-[var(--text-main)]'
                            : 'text-[var(--text-main)] hover:bg-[var(--hover-bg)]'
                        )}
                      >
                        <span className="truncate">{opt.label || opt.name}</span>
                        {isSelected ? <Check size={14} className="shrink-0 text-[var(--primary)] ml-2" /> : null}
                      </button>
                    );
                  })
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
