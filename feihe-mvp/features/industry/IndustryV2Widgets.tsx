import React from 'react';
import type { IndustryJobStatus, IndustryV2Metric } from '../../lib/industry-v2-types';

export function isSafeHttpUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function SafeExternalLink({
  href,
  children,
  className,
  title,
}: {
  href: string | null | undefined;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  if (!href || !isSafeHttpUrl(href)) {
    return <span className={className} title={title}>{children}</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      title={title || '在新标签页打开链接（安全链接）'}
    >
      {children}
    </a>
  );
}

export function formatMetricNumber(val: number | null | undefined): string {
  if (val === null || val === undefined) return '-';
  return Number(val).toLocaleString('zh-CN');
}

export function formatMetricPercent(metric: IndustryV2Metric | null | undefined): string {
  if (!metric || metric.value === null || metric.value === undefined) return '-';
  return `${(metric.value * 100).toFixed(1)}%`;
}

export function CoverageStatusBadge({ status }: { status: IndustryJobStatus }) {
  const map: Record<IndustryJobStatus, { label: string; cls: string }> = {
    complete: { label: '已完成', cls: 'v2-badge-complete' },
    partial: { label: '部分完成(截断)', cls: 'v2-badge-partial' },
    running: { label: '采集中', cls: 'v2-badge-running' },
    pending: { label: '排队中', cls: 'v2-badge-pending' },
    failed: { label: '采集失败', cls: 'v2-badge-failed' },
  };
  const current = map[status] || { label: status, cls: 'v2-badge-default' };
  return <span className={`v2-badge ${current.cls}`}>{current.label}</span>;
}

export function KpiCard({
  label,
  value,
  unit,
  subtext,
  denominator,
  badge,
  tooltip,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  subtext?: React.ReactNode;
  denominator?: string;
  badge?: React.ReactNode;
  tooltip?: string;
}) {
  return (
    <div className="v2-kpi-card" title={tooltip}>
      <div className="v2-kpi-top">
        <span className="v2-kpi-label">{label}</span>
        {badge}
      </div>
      <div className="v2-kpi-value-row">
        <span className="v2-kpi-value">{value}</span>
        {unit && <span className="v2-kpi-unit">{unit}</span>}
      </div>
      {(subtext || denominator) && (
        <div className="v2-kpi-subtext">
          {subtext}
          {denominator && <span className="v2-kpi-denominator">（{denominator}）</span>}
        </div>
      )}
    </div>
  );
}

export function QueryPillBadge({ kind, label }: { kind: 'own' | 'category' | 'competitor'; label: string }) {
  const kindLabels: Record<string, { prefix: string; cls: string }> = {
    own: { prefix: '本品', cls: 'v2-query-own' },
    category: { prefix: '品类', cls: 'v2-query-category' },
    competitor: { prefix: '竞品', cls: 'v2-query-competitor' },
  };
  const current = kindLabels[kind] || { prefix: '查询', cls: 'v2-query-default' };
  // Avoid repeating prefix if label already starts with it (e.g. "本品: 启萃")
  const cleanLabel = label.startsWith(current.prefix)
    ? label.slice(current.prefix.length).replace(/^[:：\s]+/, '')
    : label;
  return (
    <span className={`v2-query-pill ${current.cls}`}>
      <span className="v2-query-prefix">{current.prefix}</span>
      <span className="v2-query-label">{cleanLabel || label}</span>
    </span>
  );
}

export function EmptyStateBox({
  title = '暂无分析数据',
  message = '当前所选查询或范围内暂未匹配到有效样本数据。',
  action,
}: {
  title?: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="v2-empty-box">
      <div className="v2-empty-icon" aria-hidden="true">📊</div>
      <h4 className="v2-empty-title">{title}</h4>
      <p className="v2-empty-message">{message}</p>
      {action && <div className="v2-empty-action">{action}</div>}
    </div>
  );
}

export function PaginationBar({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange?: (newSize: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages - 1);

  return (
    <div className="v2-pagination">
      <div className="v2-pagination-info">
        共 <strong className="v2-num">{total}</strong> 条记录 · 第 {currentPage + 1} / {totalPages} 页
      </div>
      <div className="v2-pagination-actions">
        {onPageSizeChange && (
          <div className="v2-page-size-selector">
            <span>每页:</span>
            <button
              type="button"
              className={`v2-page-size-btn ${pageSize === 10 ? 'active' : ''}`}
              onClick={() => onPageSizeChange(10)}
            >
              10
            </button>
            <button
              type="button"
              className={`v2-page-size-btn ${pageSize === 20 ? 'active' : ''}`}
              onClick={() => onPageSizeChange(20)}
            >
              20
            </button>
          </div>
        )}
        <button
          type="button"
          className="v2-btn v2-btn-sm"
          disabled={currentPage <= 0}
          onClick={() => onPageChange(currentPage - 1)}
        >
          上一页
        </button>
        <button
          type="button"
          className="v2-btn v2-btn-sm"
          disabled={currentPage >= totalPages - 1}
          onClick={() => onPageChange(currentPage + 1)}
        >
          下一页
        </button>
      </div>
    </div>
  );
}
