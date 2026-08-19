import { AlertTriangle, Info, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { cn } from '../../lib/cn';

const icons = {
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
  danger: ShieldAlert
};

const iconWrappers = {
  warning: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
  danger: 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200 dark:border-rose-800',
  info: 'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400 border border-sky-200 dark:border-sky-800',
  success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
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
    <Modal open={open} onClose={onCancel} width="440px" hideHeader>
      <div className="flex flex-col items-center text-center p-4">
        <div
          className={cn(
            'mb-4 flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm',
            iconWrappers[type] || iconWrappers.info
          )}
        >
          <Icon size={26} />
        </div>
        <h3 className="mb-2 text-lg font-bold text-[var(--text-main)]">{title}</h3>
        <p className="mb-6 text-xs leading-relaxed text-[var(--text-muted)] max-w-sm">{description}</p>
        <div className="flex w-full gap-2.5">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            variant={type === 'danger' ? 'destructive' : 'primary'}
            className="flex-1"
            loading={isLoading}
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
