import React from 'react';

export function WorkspaceToolbar({
  children,
  extra,
  className = '',
}: {
  children: React.ReactNode;
  extra?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`ops-toolbar ${className}`}>
      <div className="ops-toolbar-filters">{children}</div>
      {extra && <div className="ops-toolbar-actions">{extra}</div>}
    </div>
  );
}
