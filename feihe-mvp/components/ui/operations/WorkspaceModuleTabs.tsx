import React from 'react';

export type ModuleTab = {
  id: string;
  title: string;
  desc: string;
  badge?: string | number;
  icon: string;
};

export function WorkspaceModuleTabs({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: ModuleTab[];
  activeTab: string;
  onChange: (id: string) => void;
}) {
  const gridClass = tabs.length === 3 ? 'ops-module-tabs-3' : tabs.length === 4 ? 'ops-module-tabs-4' : '';
  return (
    <nav className={`ops-module-tabs ${gridClass}`} aria-label="模块切换">
      {tabs.map((t) => {
        const isActive = activeTab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`ops-module-tab ${isActive ? 'active' : ''}`}
            onClick={() => onChange(t.id)}
          >
            <span className="tab-icon">{t.icon}</span>
            <div className="ops-module-tab-body">
              <div className="ops-module-tab-title">
                <strong>{t.title}</strong>
                {t.badge !== undefined && <span className="ops-module-tab-badge">{t.badge}</span>}
              </div>
              <span className="ops-module-tab-desc">{t.desc}</span>
            </div>
          </button>
        );
      })}
    </nav>
  );
}
