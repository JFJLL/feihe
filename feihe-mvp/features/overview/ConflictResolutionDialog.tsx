'use client';
import { Dialog } from '../../components/ui/Dialog';
export function ConflictResolutionDialog({ open, serverVersion, localVersion, onReload, onForceSave, onCancel, busy = false }: {
  open: boolean; serverVersion: number; localVersion: number; onReload: () => void; onForceSave: () => void; onCancel: () => void; busy?: boolean;
}) {
  return <Dialog open={open} title="检测到看板并发修改冲突 (409)" onClose={() => { if (!busy) onCancel(); }} width={500} footer={<>
    <button disabled={busy} onClick={onCancel}>保留草稿并关闭</button>
    <button disabled={busy} onClick={onReload}>放弃草稿并加载最新版</button>
    <button disabled={busy} className="primary" onClick={onForceSave}>{busy ? '正在保存…' : '强制覆盖发布'}</button>
  </>}><p>其他团队成员已发布新版本（服务器最新版本为 <strong>v{serverVersion}</strong>，您的编辑基于 <strong>v{localVersion}</strong>）。</p><p>本地草稿已完整保留。加载最新版会放弃当前草稿；覆盖发布会保留当前配置。</p></Dialog>;
}
