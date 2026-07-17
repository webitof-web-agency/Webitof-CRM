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
  searchable = true
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const [coords, setCoords] = useState(null);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    return options.filter(opt => opt.label.toLowerCase().includes(search.toLowerCase()));
  }, [options, search]);

  const selectedOption = options.find(opt => opt.value === value);

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
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      const selectedIndex = filteredOptions.findIndex(opt => opt.value === value);
      setFocusedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
  }, [isOpen, value]); // Added value to dependencies just in case

  function handleKeyDown(e) {
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
      setFocusedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => (prev > 0 ? prev - 1 : prev));
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
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex w-full items-center justify-between rounded-[var(--radius-input,0.75rem)] border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]',
          !selectedOption && 'text-[var(--text-muted)]',
          isOpen && 'border-[var(--primary)] ring-1 ring-[var(--primary)]'
        )}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown size={16} className={cn('text-[var(--text-muted)] transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && coords ? createPortal(
        <div 
          ref={dropdownRef} 
          className="fixed z-[9999] rounded-[var(--radius-card,1.5rem)] border border-slate-200 bg-white shadow-lg overflow-hidden flex flex-col"
          style={{ ...coords, maxHeight: '250px' }}
        >
          {searchable && (
            <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 text-[var(--text-muted)]">
              <Search size={14} className="shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
          )}
          <div className="overflow-y-auto p-1 flex-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-[var(--text-muted)]">No results found.</div>
            ) : (
              filteredOptions.map((opt, i) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange?.(opt.value); setIsOpen(false); }}
                  onMouseEnter={() => setFocusedIndex(i)}
                  style={{ borderRadius: 'var(--radius-button, 0.5rem)' }}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2.5 text-sm transition-colors',
                    opt.value === value
                      ? 'bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)] font-medium'
                      : focusedIndex === i
                        ? 'bg-slate-50 text-[var(--primary)]'
                        : 'text-[var(--text-main)] hover:bg-slate-50 hover:text-[var(--primary)]'
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}
