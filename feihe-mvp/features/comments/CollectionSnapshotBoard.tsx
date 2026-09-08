'use client';

import type { NoteListItem } from '../content/content-view-model';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { ProgressBar } from '../../components/ui/operations/ProgressBar';

export function CollectionSnapshotBoard({ items, loading, error }: { items: NoteListItem[]; loading: boolean; error?: string }) {
  const comparable = items.filter(note => note.latestSnapshotTime && typeof note.commentDelta === 'number' && Number.isFinite(note.commentDelta));
  const groups = [
    { label: '评论增加', count: comparable.filter(note => note.commentDelta! > 0).length, theme: 'green' as const },
    { label: '评论减少', count: comparable.filter(note => note.commentDelta! < 0).length, theme: 'yellow' as const },
    { label: '评论持平', count: comparable.filter(note => note.commentDelta === 0).length, theme: 'blue' as const },
    { label: '缺少可比快照', count: items.length - comparable.length, theme: 'teal' as const },
  ];
  return <DashboardSection eyebrow="VOICE TREND" title="当前页笔记快照变化分布" desc={`仅下方当前页 ${items.length} 篇笔记；比较各篇最近两次快照，采集间隔不同，差值不是每日新增评论。`}>
    {error ? <div className="empty">快照分布暂不可用：{error}</div> : loading ? <div className="empty" role="status">正在读取快照…</div> : items.length ? <div className="stack">
      {groups.map(group => <div key={group.label}>
        <div className="card-header-row"><strong>{group.label}</strong><span>{group.count} 篇 · {(group.count / items.length * 100).toFixed(1)}%</span></div>
        <ProgressBar value={group.count} max={items.length} theme={group.theme} />
      </div>)}
    </div> : <div className="empty">当前筛选下暂无笔记</div>}
  </DashboardSection>;
}
