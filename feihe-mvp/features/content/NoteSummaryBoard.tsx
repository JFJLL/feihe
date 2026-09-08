'use client';

import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { ProgressBar } from '../../components/ui/operations/ProgressBar';
import type { NotesListResponse } from './content-view-model';

export function NoteSummaryBoard({ summary, mode, loading, error }: {
  summary: NotesListResponse['summary'];
  mode: 'registry' | 'collection';
  loading: boolean;
  error?: string;
}) {
  const registry = mode === 'registry';
  const rows = registry ? [
    { label: '基础资料完整', count: summary.basicProfileCount, theme: 'green' as const },
    { label: '基础资料待补', count: summary.missingBasicProfileCount, theme: 'yellow' as const },
  ] : [
    { label: '已有采集时间或验收状态', count: summary.fetchedCount, theme: 'teal' as const },
    { label: '待抓取且无采集时间', count: summary.unfetchedCount, theme: 'yellow' as const },
  ];
  const accounted = rows.reduce((sum, row) => sum + row.count, 0);
  const unknown = Math.max(0, summary.total - accounted);
  return (
    <DashboardSection eyebrow={registry ? 'CONTENT STRATEGY' : 'ACTION SLA'}
      title={registry ? '台账资料完整度与补录缺口' : '项目采集覆盖与首采缺口'}
      desc={registry ? '项目全量台账，不随下方列表筛选变化；基础资料完整指封面与一级分类均已填充。' : '项目全量资产，按已保存的采集时间或验收状态统计；不代表实时抓取成功率，不随列表筛选变化。'}>
      {error ? <div role="status" className="empty">看板暂不可用：{error}</div> : loading ? <div role="status" className="empty">正在读取真实汇总…</div> : summary.total > 0 ? (
        <div className="stack">
          {rows.map(row => <div key={row.label}>
            <div className="card-header-row"><strong>{row.label}</strong><span>{row.count.toLocaleString()} / {summary.total.toLocaleString()} 篇 · {(row.count / summary.total * 100).toFixed(1)}%</span></div>
            <ProgressBar value={row.count} max={summary.total} theme={row.theme} />
          </div>)}
          {unknown > 0 && <p className="muted">另有 {unknown.toLocaleString()} 篇状态未归类，不计入以上两组。</p>}
        </div>
      ) : <div className="empty">暂无笔记资产，暂不计算占比</div>}
    </DashboardSection>
  );
}
