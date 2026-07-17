import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

const alertConfig = {
  success: {
    icon: CheckCircle,
    containerClass: 'border-emerald-200 bg-emerald-50',
    iconClass: 'text-emerald-600',
    titleClass: 'text-emerald-800',
    descClass: 'text-emerald-700/90'
  },
  warning: {
    icon: AlertTriangle,
    containerClass: 'border-amber-200 bg-amber-50',
    iconClass: 'text-amber-600',
    titleClass: 'text-amber-800',
    descClass: 'text-amber-700/90'
  },
  danger: {
    icon: XCircle,
    containerClass: 'border-red-200 bg-red-50',
    iconClass: 'text-red-600',
    titleClass: 'text-red-800',
    descClass: 'text-red-700/90'
  },
  info: {
    icon: Info,
    containerClass: 'border-blue-200 bg-blue-50',
    iconClass: 'text-blue-600',
    titleClass: 'text-blue-800',
    descClass: 'text-blue-700/90'
  }
};

export function Alert({ type = 'info', title, description, className }) {
  const config = alertConfig[type] || alertConfig.info;
  const Icon = config.icon;

  return (
    <div className={cn('flex items-start gap-4 rounded-xl border p-4 shadow-sm', config.containerClass, className)}>
      <Icon size={20} className={cn('mt-0.5 shrink-0', config.iconClass)} />
      <div className="flex-1">
        {title && <h4 className={cn('font-semibold', config.titleClass)}>{title}</h4>}
        {description && <p className={cn('text-sm', config.descClass, title && 'mt-1')}>{description}</p>}
      </div>
    </div>
  );
}
