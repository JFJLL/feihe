'use client';
import { Dialog } from '../../components/ui/Dialog';
export function UnsavedChangesDialog({ open, title = '未保存的看板修改', message = '您有尚未保存的看板修改。保存成功后才会切换数据集或离开页面。', onSave, onDiscard, onCancel, busy = false }: {
  open: boolean; title?: string; message?: string; onSave: () => Promise<void>; onDiscard: () => void; onCancel: () => void; busy?: boolean;
}) {
  return <Dialog open={open} title={title} onClose={() => { if (!busy) onCancel(); }} width={480} footer={<>
    <button disabled={busy} onClick={onCancel}>继续编辑</button>
    <button disabled={busy} onClick={onDiscard}>放弃修改</button>
    <button disabled={busy} className="primary" onClick={() => void onSave()}>{busy ? '正在保存…' : '保存修改'}</button>
  </>}><p>{message}</p></Dialog>;
}
