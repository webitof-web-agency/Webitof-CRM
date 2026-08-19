import { useState } from 'react';
import { cn } from '../../lib/cn';

export function Tabs({
  tabs = [],
  defaultTab,
  activeTab: controlledActiveTab,
  onChange,
  variant = 'underline', // 'underline' | 'pills' | 'segmented'
  className = ''
}) {
  const [internalActiveTab, setInternalActiveTab] = useState(
    defaultTab || (tabs[0] && tabs[0].id)
  );

  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab;

  const handleTabChange = (tabId) => {
    if (controlledActiveTab === undefined) {
      setInternalActiveTab(tabId);
    }
    onChange?.(tabId);
  };

  return (
    <div className={cn('w-full', className)}>
      {variant === 'pills' || variant === 'segmented' ? (
        <div className="inline-flex p-1 bg-[var(--surface-2)] rounded-xl border border-[var(--border)] gap-1 overflow-x-auto hide-scrollbar">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap cursor-pointer',
                  isActive
                    ? 'bg-[var(--surface)] text-[var(--text-main)] shadow-xs border border-[var(--border-muted)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-bg)]'
                )}
              >
                {Icon ? <Icon size={14} className={isActive ? 'text-[var(--primary)]' : ''} /> : null}
                <span>{tab.label}</span>
                {tab.count != null ? (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                      isActive
                        ? 'bg-[var(--primary-subtle)] text-[var(--primary)]'
                        : 'bg-[var(--surface-3)] text-[var(--text-muted)]'
                    )}
                  >
                    {tab.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex w-full border-b border-[var(--border)]">
          <div className="flex w-full overflow-x-auto hide-scrollbar gap-2">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    'inline-flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-xs font-semibold transition-all duration-150 border-b-2 -mb-px cursor-pointer',
                    isActive
                      ? 'border-[var(--primary)] text-[var(--primary)]'
                      : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--border)]'
                  )}
                >
                  {Icon ? <Icon size={14} /> : null}
                  <span>{tab.label}</span>
                  {tab.count != null ? (
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                        isActive
                          ? 'bg-[var(--primary-subtle)] text-[var(--primary)]'
                          : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                      )}
                    >
                      {tab.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab Panels */}
      <div className="mt-4">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={cn(activeTab === tab.id ? 'block animate-fade-scale' : 'hidden')}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}
