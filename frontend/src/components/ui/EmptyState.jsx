import { Button } from './Button';
import { Search } from 'lucide-react';

export function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl bg-white px-6 py-12 text-center relative overflow-hidden">
      {/* Background Dots */}
      <div className="absolute inset-0 z-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at center, #000 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
      
      {/* Illustration */}
      <div className="relative z-10 mb-6 flex items-center justify-center">
        <div className="relative flex h-24 w-20 flex-col rounded-t-xl rounded-br-xl bg-indigo-100 p-3 shadow-inner">
          {/* Folded corner */}
          <div className="absolute -left-3 -top-3 h-8 w-8 rounded-full bg-indigo-50 mix-blend-multiply blur-xl"></div>
          <div className="absolute top-0 right-0 h-4 w-4 rounded-bl-xl bg-indigo-200"></div>
          {/* Lines */}
          <div className="mt-2 h-2 w-10 rounded-full bg-white/60"></div>
          <div className="mt-2 h-2 w-14 rounded-full bg-white/60"></div>
          <div className="mt-2 h-2 w-12 rounded-full bg-white/60"></div>
          {/* Magnifying Glass */}
          <div className="absolute -bottom-2 -right-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 shadow-lg border-4 border-white transform rotate-12">
            <Search size={20} className="text-white" />
          </div>
        </div>
      </div>
      
      <h3 className="relative z-10 text-xl font-bold text-slate-900">{title}</h3>
      <p className="relative z-10 mt-2 max-w-xl text-sm leading-6 text-slate-500">{description}</p>
      
      {actionLabel ? (
        <Button className="relative z-10 mt-6" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
