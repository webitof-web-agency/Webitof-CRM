import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../lib/cn';

export function Modal({
  open,
  title,
  subtitle,
  children,
  onClose,
  footer,
  headerActions,
  width = 'min(920px, 95vw)',
  maxHeight = 'min(88vh, 840px)',
  hideHeader = false,
  headerClassName = '',
  bodyClassName = '',
  footerClassName = ''
}) {
  const modalRef = useRef();

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
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      onClose?.();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/45 dark:bg-black/70 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
      role="presentation"
      onMouseDown={handleBackdropClick}
    >
      <div className="flex min-h-full items-center justify-center p-3 sm:p-5 py-6">
        <div
          ref={modalRef}
          className="liquid-glass-card animate-glass-modal relative w-full rounded-[26px] border border-white/80 dark:border-white/15 shadow-2xl flex flex-col overflow-hidden transition-all"
          style={{ maxWidth: width, maxHeight }}
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === 'string' ? title : 'Modal'}
        >
          {/* Top Specular Light Highlight */}
          <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/90 dark:via-white/35 to-transparent z-40" />
          {hideHeader ? (
            <div className={cn('flex justify-end px-6 pt-4', headerClassName)}>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                aria-label="Close modal"
                onClick={onClose}
                className="rounded-full hover:bg-[var(--hover-bg)]"
              >
                <X size={17} />
              </Button>
            </div>
          ) : (
            <div
              className={cn(
                'flex items-center justify-between gap-4 border-b border-[var(--border)] px-6 py-4 shrink-0 bg-[var(--surface)]/95 backdrop-blur-md sticky top-0 z-30',
                headerClassName
              )}
            >
              <div>
                <div className="text-base font-bold text-[var(--text-main)] flex items-center gap-2.5">
                  {typeof title === 'string' ? <h3>{title}</h3> : title}
                  {subtitle ? (
                    <span className="inline-flex items-center rounded-full bg-[var(--primary-subtle)] px-2.5 py-0.5 text-xs font-semibold text-[var(--primary)] border border-[color-mix(in_srgb,var(--primary)_20%,transparent)]">
                      {subtitle}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {headerActions}
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  aria-label="Close modal"
                  onClick={onClose}
                  className="rounded-full h-8 w-8 hover:bg-[var(--hover-bg)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
                >
                  <X size={17} />
                </Button>
              </div>
            </div>
          )}
          <div
            className={cn(
              hideHeader ? 'px-6 pb-6 pt-2 overflow-y-auto' : 'px-6 py-5 overflow-y-auto',
              bodyClassName
            )}
          >
            {children}
          </div>
          {footer ? (
            <div
              className={cn(
                'border-t border-[var(--border)] px-6 py-3.5 bg-[var(--surface-2)]/90 backdrop-blur-sm shrink-0 flex items-center justify-end gap-2.5',
                footerClassName
              )}
            >
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
