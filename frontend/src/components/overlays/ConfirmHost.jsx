import { useEffect, useRef, useState } from 'react';
import { ConfirmModal } from '../ui/ConfirmModal';
import { registerConfirmHost } from '../../lib/confirm';

// Mounted once in App. Shows one confirmation at a time and resolves the promise from confirmAction().
export function ConfirmHost() {
  const [queue, setQueue] = useState([]);
  const current = queue[0] || null;
  const currentRef = useRef(null);
  currentRef.current = current;

  useEffect(() => registerConfirmHost((request) => setQueue((items) => [...items, request])), []);

  function settle(result) {
    const request = currentRef.current;
    if (!request) return;
    request.resolve(result);
    setQueue((items) => items.slice(1));
  }

  // Own stacking layer so a confirmation always sits above the dialog that asked for it.
  return (
    <div className="relative z-[60]">
    <ConfirmModal
      open={Boolean(current)}
      title={current?.title || 'Are you sure?'}
      description={current?.description || ''}
      confirmText={current?.confirmText || 'Confirm'}
      cancelText={current?.cancelText || 'Cancel'}
      type={current?.type || 'warning'}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
    </div>
  );
}
