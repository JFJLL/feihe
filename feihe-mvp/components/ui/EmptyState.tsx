import React from 'react';

export function EmptyState({
  title = '暂无数据',
  text,
  action,
}: {
  title?: string;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="ui-state-box empty">
      <div className="ui-state-icon">∅</div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action && <div className="ui-state-action">{action}</div>}
    </div>
  );
}
