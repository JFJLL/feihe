import React from 'react';

export function DataTableShell({
  children,
  page,
  pageSize,
  total,
  onPageChange,
  loading = false,
  className = '',
}: {
  children: React.ReactNode;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (newPage: number) => void;
  loading?: boolean;
  className?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = total === 0 ? 1 : Math.min(page, totalPages);
  const startItem = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(total, safePage * pageSize);

  React.useEffect(() => {
    if (page > totalPages && totalPages >= 1) {
      onPageChange(totalPages);
    }
  }, [page, totalPages, onPageChange]);

  return (
    <div className={`ops-data-shell ${className}`} style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
      <div className="ops-table-container">
        {children}
      </div>
      <div className="ops-pagination">
        <span>
          显示第 <strong>{startItem}</strong> - <strong>{endItem}</strong> 条，共 <strong>{total}</strong> 条记录
        </span>
        <div className="ops-pagination-controls">
          <button
            type="button"
            className="ops-pagination-btn"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
          >
            上一页
          </button>
          <span>第 {page} / {totalPages} 页</span>
          <button
            type="button"
            className="ops-pagination-btn"
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(page + 1)}
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
}
