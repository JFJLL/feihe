import React from 'react';

export type TabItem = {
  id: string;
  label: string;
  copy?: string;
  badge?: string | number;
};

export type SectionTabsProps = {
  items: TabItem[] | Array<[string, string, string?]>;
  value: string;
  onChange: (id: string) => void;
  className?: string;
};

export function SectionTabs({
  items,
  value,
  onChange,
  className = '',
}: SectionTabsProps) {
  const normalized: TabItem[] = items.map((item) => {
    if (Array.isArray(item)) {
      return { id: item[0], label: item[1], copy: item[2] };
    }
    return item;
  });

  return (
    <div className={'section-tabs ' + className} role="tablist">
      {normalized.map((item) => {
        const isActive = value === item.id;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={isActive}
            className={isActive ? 'active' : ''}
            onClick={() => onChange(item.id)}
          >
            <strong>{item.label}</strong>
            {item.copy && <small>{item.copy}</small>}
            {item.badge !== undefined && <span className="tab-badge">{item.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}
