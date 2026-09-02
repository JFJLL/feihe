import React from 'react';

export function LoadingState({ text = '数据加载中…' }: { text?: string }) {
  return (
    <div className="ui-state-box loading" role="status">
      <span className="ui-spinner" />
      <p>{text}</p>
    </div>
  );
}
