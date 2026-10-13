'use client';

export function UnsavedChangesDialog({
  open,
  title = '未保存的看板修改',
  message = '您有尚未保存的看板卡片修改。切换数据集或离开页面将导致未保存的草稿丢失，是否先保存修改？',
  onSave,
  onDiscard,
  onCancel,
}: {
  open: boolean;
  title?: string;
  message?: string;
  onSave: () => Promise<void>;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.45)', display: 'grid', placeItems: 'center', zIndex: 9999 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 460, width: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{title}</h3>
        <p style={{ margin: '0 0 20px 0', fontSize: 13, color: '#475569', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 13 }}
          >
            继续编辑
          </button>
          <button
            onClick={onDiscard}
            style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fee2e2', color: '#ef4444', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            放弃修改
          </button>
          <button
            onClick={onSave}
            style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            保存修改
          </button>
        </div>
      </div>
    </div>
  );
}
