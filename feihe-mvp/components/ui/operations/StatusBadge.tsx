import React from 'react';

export function StatusBadge({
  status,
  theme,
  className = '',
}: {
  status: string;
  theme?: 'blue' | 'green' | 'yellow' | 'red' | 'teal' | 'purple' | 'indigo' | 'gray';
  className?: string;
}) {
  let autoTheme = theme;
  if (!autoTheme) {
    if (status.includes('达标') || status.includes('已完成') || status.includes('一致') || status.includes('已外显') || status.includes('已处理') || status.includes('已同步')) {
      autoTheme = 'green';
    } else if (status.includes('补充') || status.includes('待') || status.includes('观察') || status.includes('优化')) {
      autoTheme = 'yellow';
    } else if (status.includes('未') || status.includes('删除') || status.includes('失败') || status.includes('负向')) {
      autoTheme = 'red';
    } else if (status.includes('自有') || status.includes('回复')) {
      autoTheme = 'blue';
    } else {
      autoTheme = 'gray';
    }
  }
  return <span className={`ops-badge ops-badge-${autoTheme} ${className}`}>{status}</span>;
}
