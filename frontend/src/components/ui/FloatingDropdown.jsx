import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn';

const hiddenPosition = { top: 0, left: 0, visibility: 'hidden' };

/**
 * Portal-based dropdown for controls inside scrollable tables and clipped cards.
 * The menu is positioned against the trigger in viewport coordinates, so parent
 * overflow and stacking contexts cannot crop it.
 */
export function FloatingDropdown({
  trigger,
  children,
  align = 'end',
  side = 'auto',
  gap = 6,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(hiddenPosition);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => {
    setPosition(hiddenPosition);
    setOpen((current) => !current);
  }, []);

  const updatePosition = useCallback(() => {
    const triggerElement = triggerRef.current;
    const menuElement = menuRef.current;
    if (!triggerElement || !menuElement) return;

    const triggerRect = triggerElement.getBoundingClientRect();
    const menuRect = menuElement.getBoundingClientRect();
    const viewportPadding = 8;
    const fitsBelow = triggerRect.bottom + gap + menuRect.height <= window.innerHeight - viewportPadding;
    const fitsAbove = triggerRect.top - gap - menuRect.height >= viewportPadding;
    const placeAbove = side === 'top' || (side === 'auto' && !fitsBelow && fitsAbove);

    let top = placeAbove
      ? triggerRect.top - menuRect.height - gap
      : triggerRect.bottom + gap;
    let left =
      align === 'start'
        ? triggerRect.left
        : align === 'center'
          ? triggerRect.left + (triggerRect.width - menuRect.width) / 2
          : triggerRect.right - menuRect.width;

    top = Math.max(viewportPadding, Math.min(top, window.innerHeight - menuRect.height - viewportPadding));
    left = Math.max(viewportPadding, Math.min(left, window.innerWidth - menuRect.width - viewportPadding));
    setPosition({ top, left, visibility: 'visible' });
  }, [align, gap, side]);

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return undefined;
    const handleOutside = (event) => {
      if (
        !triggerRef.current?.contains(event.target) &&
        !menuRef.current?.contains(event.target)
      ) {
        close();
      }
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [close, open, updatePosition]);

  const menu =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            className={cn(
              'fixed z-[9999] rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-modal)] backdrop-blur-xl transition-opacity duration-100 ease-out',
              className,
            )}
            style={{
              ...position,
              opacity: position.visibility === 'visible' ? 1 : 0,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            {typeof children === 'function' ? children({ close }) : children}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {trigger({ ref: triggerRef, open, toggle, close })}
      {menu}
    </>
  );
}
