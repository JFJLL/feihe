import React, { useRef } from 'react';

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
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let targetIndex = -1;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      targetIndex = (currentIndex + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      targetIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      targetIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      targetIndex = tabs.length - 1;
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (tabs[currentIndex].id !== activeTab) {
        onChange(tabs[currentIndex].id);
      }
      return;
    }

    if (targetIndex >= 0 && targetIndex !== currentIndex) {
      const btn = tabsRef.current[targetIndex];
      btn?.focus();
      const isReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      btn?.scrollIntoView({ behavior: isReduced ? 'auto' : 'smooth', block: 'nearest', inline: 'nearest' });
    }
  };

  if (variant === 'compact') {
    return (
      <nav className="workspace-compact-tabs" aria-label="模块切换" role="tablist">
        {tabs.map((t, idx) => {
          const isActive = activeTab === t.id;
          return (
            <button
              ref={(el) => { tabsRef.current[idx] = el; }}
              key={t.id}
              id={`workspace-tab-${t.id}`}
              type="button"
              role="tab"
              tabIndex={isActive ? 0 : -1}
              aria-selected={isActive}
              aria-controls={`workspace-tabpanel-${t.id}`}
              className={`workspace-compact-tab${isActive ? ' active' : ''}`}
              onClick={() => {
                if (!isActive) onChange(t.id);
              }}
              onKeyDown={(e) => handleKeyDown(e, idx)}
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
            onClick={() => {
              if (!isActive) onChange(t.id);
            }}
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
