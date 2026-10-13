'use client';

export function ConflictResolutionDialog({
  open,
  serverVersion,
  localVersion,
  onReload,
  onForceSave,
  onCancel,
}: {
  open: boolean;
  serverVersion: number;
  localVersion: number;
  onReload: () => void;
  onForceSave: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.5)', display: 'grid', placeItems: 'center', zIndex: 9999 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 480, width: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 24 }}>⚠</span>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#b45309' }}>检测到看板并发修改冲突 (409)</h3>
        </div>
        <p style={{ margin: '0 0 14px 0', fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
          其他团队成员已发布了新版本（服务器最新版本为 <strong>v{serverVersion}</strong>，您的编辑基于 <strong>v{localVersion}</strong>）。
        </p>
        <p style={{ margin: '0 0 20px 0', fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
          您的本地草稿已完整保留。您可以选择重新加载最新版本，或以当前草稿覆盖发布。
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 13 }}
          >
            保留草稿并关闭
          </button>
          <button
            onClick={onReload}
            style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #93c5fd', background: '#eff6ff', color: '#2563eb', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            重新加载最新版
          </button>
          <button
            onClick={onForceSave}
            style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#d97706', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            强制覆盖发布
          </button>
        </div>
      </div>
    </div>
  );
}
