import { AlertTriangle, CheckCircle2, Info, XCircle, X } from 'lucide-react';
import { cn } from '../../lib/cn';

const alertConfig = {
  success: {
    icon: CheckCircle2,
    containerClass:
      'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200',
    iconClass: 'text-emerald-600 dark:text-emerald-400',
    titleClass: 'text-emerald-900 dark:text-emerald-200',
    descClass: 'text-emerald-800/90 dark:text-emerald-300/90'
  },
  warning: {
    icon: AlertTriangle,
    containerClass:
      'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200',
    iconClass: 'text-amber-600 dark:text-amber-400',
    titleClass: 'text-amber-900 dark:text-amber-200',
    descClass: 'text-amber-800/90 dark:text-amber-300/90'
  },
  danger: {
    icon: XCircle,
    containerClass:
      'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200',
    iconClass: 'text-rose-600 dark:text-rose-400',
    titleClass: 'text-rose-900 dark:text-rose-200',
    descClass: 'text-rose-800/90 dark:text-rose-300/90'
  },
  info: {
    icon: Info,
    containerClass:
      'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-200',
    iconClass: 'text-sky-600 dark:text-sky-400',
    titleClass: 'text-sky-900 dark:text-sky-200',
    descClass: 'text-sky-800/90 dark:text-sky-300/90'
  }
};

export function Alert({
  type = 'info',
  title,
  description,
  children,
  onDismiss,
  className = ''
}) {
  const config = alertConfig[type] || alertConfig.info;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'relative flex items-start gap-3 rounded-xl border p-3.5 text-xs shadow-2xs transition-colors',
        config.containerClass,
        className
      )}
      role="alert"
    >
      <Icon size={18} className={cn('mt-0.5 shrink-0', config.iconClass)} />
      <div className="flex-1 min-w-0">
        {title && <h4 className={cn('font-bold text-xs', config.titleClass)}>{title}</h4>}
        {description && <p className={cn('leading-relaxed', config.descClass, title && 'mt-0.5')}>{description}</p>}
        {children && <div className={cn('mt-1', config.descClass)}>{children}</div>}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          aria-label="Dismiss alert"
        >
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
}
