import React from 'react';

export function ResultNotice({
  type = 'info',
  children,
  className = '',
}: {
  type?: 'success' | 'error' | 'info';
  children: React.ReactNode;
  className?: string;
}) {
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  return (
    <div className={`ops-result-notice ops-result-notice-${type} ${className}`}>
      <span style={{ fontWeight: 700 }}>{icon}</span>
      <div style={{ flex: 1, whiteSpace: 'pre-wrap' }}>{children}</div>
    </div>
  );
}
