import { useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../lib/cn';

export function SlideOver({ open, title, children, onClose, footer, width = 'w-full max-w-lg' }) {
  const overlayRef = useRef();

  if (!open) return null;

  const handleBackdropClick = (e) => {
    if (e.target?.closest?.('[data-modal-portal="true"]')) return;
    if (overlayRef.current && e.target === overlayRef.current) {
      onClose();
    }
  };

  return (
    <div 
      ref={overlayRef}
      className="fixed inset-0 z-[60] overflow-hidden bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={handleBackdropClick}
      role="presentation"
    >
      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
        <div 
          className={cn("pointer-events-auto relative w-screen bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300", width)}
          role="dialog"
          aria-modal="true"
          aria-label={title || "Panel"}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 shrink-0 bg-white z-10 shadow-sm relative">
            <h3 className="text-lg font-semibold text-[var(--text-main)]">{title}</h3>
            <Button variant="ghost" size="icon" type="button" aria-label="Close panel" onClick={onClose} className="-mr-2">
              <X size={20} />
            </Button>
          </div>
          
          {/* Body */}
          <div className="flex-1 overflow-y-auto bg-slate-50 relative">
            {children}
          </div>
          
          {/* Footer */}
          {footer ? (
            <div className="border-t border-slate-200 bg-white px-6 py-5 shrink-0 relative z-10 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
