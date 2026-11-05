import { ConfirmModal } from '../ui/ConfirmModal';

// Kept for existing call sites; it is ConfirmModal with the older prop names, so every
// confirmation in the app looks the same (message as body text, not as a title subtitle).
export function ConfirmDialog({
  open,
  title = 'Confirm action',
  description = 'Are you sure you want to continue?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'destructive',
  onConfirm,
  onClose,
  busy = false
}) {
  return (
    <ConfirmModal
      open={open}
      title={title}
      description={description}
      confirmText={confirmLabel}
      cancelText={cancelLabel}
      type={tone === 'destructive' ? 'danger' : 'info'}
      onConfirm={onConfirm}
      onCancel={onClose}
      isLoading={busy}
    />
  );
}
