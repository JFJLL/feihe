import React from 'react';

export function EmptyState({
  title = '暂无数据',
  text,
  action,
  icon,
  compact = false,
}: {
  title?: string;
  text?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`ui-state-box empty${compact ? ' compact' : ''}`}>
      <div className="ui-state-icon" aria-hidden="true">
        {icon || (
          <svg
            className="empty-state-svg"
            width="32"
            height="32"
            viewBox="0 0 48 48"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="8" y="10" width="32" height="28" rx="4" />
            <path d="M8 20h32" />
            <path d="M19 28h10" />
            <circle cx="14" cy="15" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="19" cy="15" r="1.5" fill="currentColor" stroke="none" />
          </svg>
        )}
      </div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action && <div className="ui-state-action">{action}</div>}
    </div>
  );
}
