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
  variant = 'cards',
}: {
  tabs: ModuleTab[];
  activeTab: string;
  onChange: (id: string) => void;
  /** 'cards' keeps the overview card entries; 'compact' is the underline tab strip. */
  variant?: 'cards' | 'compact';
}) {
  if (variant === 'compact') {
    return (
      <nav className="workspace-compact-tabs" aria-label="模块切换" role="tablist">
        {tabs.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`workspace-compact-tab${isActive ? ' active' : ''}`}
              onClick={() => onChange(t.id)}
            >
              <span className="workspace-compact-tab-label">{t.title}</span>
              {t.badge !== undefined && t.badge !== '' && (
                <span className="workspace-compact-tab-badge">{t.badge}</span>
              )}
            </button>
          );
        })}
      </nav>
    );
  }

  const gridClass = `ops-module-tabs-${tabs.length}`;
  return (
    <nav className={`ops-module-tabs ${gridClass}`} aria-label="模块切换">
      {tabs.map((t) => {
        const isActive = activeTab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={isActive}
            className={`ops-module-tab ${isActive ? 'active' : ''}`}
            onClick={() => onChange(t.id)}
          >
            <span className="ops-module-tab-icon" aria-hidden="true">{t.icon}</span>
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
