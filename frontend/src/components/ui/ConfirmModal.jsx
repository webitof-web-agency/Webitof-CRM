import { AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { cn } from '../../lib/cn';

const icons = {
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle,
  danger: AlertTriangle
};

export function ConfirmModal({
  open,
  title,
  description,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
  isLoading = false
}) {
  const Icon = icons[type] || Info;

  return (
    <Modal open={open} onClose={onCancel} width="400px">
      <div className="flex flex-col items-center text-center p-2">
        <div
          className={cn(
            'mb-4 flex h-14 w-14 items-center justify-center rounded-full',
            type === 'warning' && 'bg-amber-100 text-amber-600',
            type === 'danger' && 'bg-red-100 text-red-600',
            type === 'info' && 'bg-blue-100 text-blue-600',
            type === 'success' && 'bg-emerald-100 text-emerald-600'
          )}
        >
          <Icon size={28} />
        </div>
        <h3 className="mb-2 text-xl font-bold text-[var(--text-main)]">{title}</h3>
        <p className="mb-8 text-sm text-[var(--text-muted)]">{description}</p>
        <div className="flex w-full gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            className="flex-1"
            disabled={isLoading}
            onClick={onConfirm}
            style={{
              backgroundColor: type === 'danger' ? 'var(--danger)' : type === 'warning' ? 'var(--warning)' : type === 'success' ? 'var(--success)' : 'var(--primary)',
              color: 'white',
              border: 'none'
            }}
          >
            {isLoading ? 'Processing...' : confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
