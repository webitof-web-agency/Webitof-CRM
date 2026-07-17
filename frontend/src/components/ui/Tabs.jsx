import React, { useState } from 'react';
import { cn } from '../../lib/cn';

export function Tabs({ tabs, defaultTab, className }) {
  const [activeTab, setActiveTab] = useState(defaultTab || (tabs[0] && tabs[0].id));

  return (
    <div className={cn("w-full", className)}>
      <div className="flex w-full border-b border-slate-200">
        <div className="flex w-full overflow-x-auto hide-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "whitespace-nowrap px-6 py-3 text-sm font-medium transition-colors border-b-2",
                activeTab === tab.id
                  ? "border-[var(--primary)] text-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_5%,transparent)]"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-0">
        {tabs.map((tab) => (
          <div key={tab.id} className={cn(activeTab === tab.id ? 'block' : 'hidden animate-in fade-in')}>
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}
