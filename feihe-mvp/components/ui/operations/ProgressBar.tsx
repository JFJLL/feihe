import React from 'react';

export function ProgressBar({
  value,
  max = 100,
  theme = 'blue',
  className = '',
}: {
  value: number;
  max?: number;
  theme?: 'blue' | 'green' | 'yellow' | 'red' | 'teal';
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={`ops-progress-track ${className}`}>
      <div className={`ops-progress-bar ops-progress-${theme}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
