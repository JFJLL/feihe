'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

export function Dialog({ open = true, title, children, footer, onClose, width = 560, initialFocus }: {
  open?: boolean; title: string; children: ReactNode; footer?: ReactNode; onClose: () => void; width?: number; initialFocus?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const element = ref.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    element?.showModal();
    const first = (initialFocus ? element?.querySelector<HTMLElement>(initialFocus) : null) || element?.querySelector<HTMLElement>('input:not([disabled]), button:not([disabled]), [tabindex="0"]');
    first?.focus();
    return () => { element?.close(); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [open, initialFocus]);
  if (!open) return null;
  return <dialog ref={ref} className="shared-dialog" aria-labelledby={titleId}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]')]
        .filter(el => el.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); event.currentTarget.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement as HTMLElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement as HTMLElement))) {
        event.preventDefault(); first.focus();
      }
    }}
    onCancel={event => { event.preventDefault(); onClose(); }}
    style={{ width: `min(${width}px, calc(100vw - 24px))`, maxWidth: 'calc(100vw - 24px)', maxHeight: '90dvh', padding: 0, border: '1px solid #e2e8f0', borderRadius: 12, color: '#0f172a' }}>
    <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(90dvh - 2px)', minHeight: 0 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
        <h3 id={titleId} style={{ margin: 0, fontSize: 17 }}>{title}</h3>
        <button type="button" aria-label="关闭弹窗" onClick={onClose} style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: 6 }}>✕</button>
      </header>
      <div style={{ padding: 20, overflowY: 'auto', minHeight: 0 }}>{children}</div>
      {footer && <footer style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10, padding: '14px 20px', borderTop: '1px solid #e2e8f0', flexShrink: 0 }}>{footer}</footer>}
    </div>
  </dialog>;
}
