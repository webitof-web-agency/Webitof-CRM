import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../lib/cn';

export function SlideOver({
  open,
  title,
  subtitle,
  children,
  onClose,
  footer,
  width = 'w-full max-w-lg'
}) {
  const overlayRef = useRef();

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose?.();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleBackdropClick = (e) => {
    if (e.target?.closest?.('[data-modal-portal="true"]')) return;
    if (overlayRef.current && e.target === overlayRef.current) {
      onClose?.();
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] overflow-hidden bg-slate-950/45 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={handleBackdropClick}
      role="presentation"
    >
      <div className="absolute inset-y-0 right-0 flex max-w-full pl-6 sm:pl-10">
        <div
          className={cn(
            'pointer-events-auto relative w-screen bg-[var(--surface)] shadow-[var(--shadow-modal)] flex flex-col h-full animate-in slide-in-from-right duration-300 border-l border-[var(--border)]',
            width
          )}
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === 'string' ? title : 'Panel'}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-6 py-4.5 shrink-0 bg-[var(--surface)]/95 backdrop-blur-md z-10">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-[var(--text-main)] truncate">
                {title}
              </h3>
              {subtitle ? (
                <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{subtitle}</p>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              aria-label="Close panel"
              onClick={onClose}
              className="rounded-full h-8 w-8 text-[var(--text-muted)] hover:text-[var(--text-main)] -mr-2"
            >
              <X size={17} />
            </Button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto bg-[var(--surface)] relative p-6">
            {children}
          </div>

          {/* Footer */}
          {footer ? (
            <div className="border-t border-[var(--border)] bg-[var(--surface-2)]/90 backdrop-blur-sm px-6 py-4 shrink-0 relative z-10 flex items-center justify-end gap-2.5">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
