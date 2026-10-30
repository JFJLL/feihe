import React, { useRef } from 'react';

export type ModuleTab = {
  id: string;
  title: string;
  desc: string;
  badge?: string | number;
  icon: string;
};

function renderTabIcon(t: ModuleTab) {
  if (t.id === 'overview' || t.icon === '📊') {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    );
  }
  if (t.id === 'daily' || t.icon === '📅') {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    );
  }
  if (!t.icon) return null;
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="3" fill="currentColor" />
    </svg>
  );
}

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
    <nav className={`ops-module-tabs ${gridClass}`} aria-label="模块切换" role="tablist">
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
            data-tab-id={t.id}
            className={`ops-module-tab ${isActive ? 'active' : ''}`}
            onClick={() => {
              if (!isActive) onChange(t.id);
            }}
            onKeyDown={(e) => handleKeyDown(e, idx)}
          >
            <span className="ops-module-tab-icon" aria-hidden="true">{renderTabIcon(t)}</span>
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
