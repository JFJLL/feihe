'use client';

import React from 'react';
import type { ToastMessage } from '../project-shell/ProjectContext';

export function FeedbackToastContainer({
  toasts,
  onClose,
}: {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}) {
  if (!toasts.length) return null;

  return (
    <div className="feedback-toast-container" role="region" aria-label="操作通知">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={'feedback-toast ' + toast.type}
          role="status"
        >
          <span className="toast-icon">
            {toast.type === 'error' ? '✕' : toast.type === 'info' ? 'ℹ' : '✓'}
          </span>
          <span className="toast-text">{toast.text}</span>
          <button
            className="toast-close"
            onClick={() => onClose(toast.id)}
            aria-label="关闭通知"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}