import React from 'react';

export function ErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry?: () => void;
}) {
  return (
    <div className="ui-state-box error" role="alert">
      <div className="ui-state-icon">⚠️</div>
      <h3>数据加载异常</h3>
      <p>{error || '无法获取实时数据，请检查网络或服务状态'}</p>
      {onRetry && (
        <button className="primary" onClick={onRetry}>
          重新加载
        </button>
      )}
    </div>
  );
}
