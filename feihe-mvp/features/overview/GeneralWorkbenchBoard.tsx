'use client';

import { useEffect, useState } from 'react';
import type { Project } from '../../lib/types/project';
import { MetricCard } from '../../components/ui/operations/MetricCard';
import { api } from '../../lib/hooks/use-project-data';
import Link from '../../components/ui/AppLink';

export function GeneralWorkbenchBoard({
  projectId,
  project,
}: {
  projectId: string;
  project?: Project;
}) {
  const [datasets, setDatasets] = useState<Array<{ id: string; name: string; rowCount: number; updatedAt: string }>>([]);
  const [activeDataset, setActiveDataset] = useState<{ id: string; name: string; rows: Array<Record<string, unknown>> } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api<{ ok: boolean; datasets: Array<{ id: string; name: string; rowCount: number; updatedAt: string }> }>(`/api/datasets?projectId=${encodeURIComponent(projectId)}`)
      .then(async (res) => {
        if (cancelled) return;
        setDatasets(res.datasets || []);
        if (res.datasets && res.datasets.length > 0) {
          const first = res.datasets[0];
          const detail = await api<{ ok: boolean; dataset: { id: string; name: string; rows: Array<Record<string, unknown>> } }>(`/api/datasets?projectId=${encodeURIComponent(projectId)}&id=${encodeURIComponent(first.id)}`);
          if (!cancelled && detail.dataset) {
            setActiveDataset(detail.dataset);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const rows = activeDataset?.rows || [];
  const totalTasks = rows.length;
  const completedTasks = rows.filter((r) => {
    const s = String(r.status || r['状态'] || r.state || '').trim();
    return /已完成|完成|done|finished/i.test(s);
  }).length;

  const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) + '%' : '—';

  let totalBudget = 0;
  let totalSpent = 0;
  for (const r of rows) {
    const b = Number(r.budget ?? r['预算'] ?? 0);
    const s = Number(r.spent ?? r.actual_spent ?? r['实际支出'] ?? 0);
    if (Number.isFinite(b)) totalBudget += b;
    if (Number.isFinite(s)) totalSpent += s;
  }

  const budgetExecutionRate = totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(1) + '%' : '—';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI Cards Grid */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <MetricCard
          label="任务记录总数"
          value={totalTasks}
          unit="项"
          theme="blue"
          desc="当前业务数据集收录的总行数"
        />
        <MetricCard
          label="已完成项"
          value={completedTasks}
          unit="项"
          theme="green"
          desc="状态标记为已完成的任务项"
        />
        <MetricCard
          label="任务完成率"
          value={completionRate}
          theme="teal"
          desc={totalTasks > 0 ? `有效样本量 ${totalTasks} 项` : '暂无数据行'}
        />
        <MetricCard
          label="预算执行率"
          value={budgetExecutionRate}
          theme="purple"
          desc={totalBudget > 0 ? `预算 ¥${totalBudget.toLocaleString()} · 支出 ¥${totalSpent.toLocaleString()}` : '未配置预算'}
        />
      </section>

      {/* Dataset Data Table */}
      <section
        style={{
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          padding: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              业务数据集明细表 · {activeDataset?.name || '通用数据'}
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              支持按字段进行结构化浏览与指标聚合，不依赖社媒/笔记假设。
            </p>
          </div>
          <div>
            <Link
              href={`/projects/${encodeURIComponent(projectId)}/settings`}
              style={{
                fontSize: 13,
                color: '#2563eb',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              接入新飞书表格或导入数据 →
            </Link>
          </div>
        </div>

        {rows.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  {Object.keys(rows[0] || {}).map((key) => (
                    <th key={key} style={{ padding: '10px 12px', fontWeight: 600, color: '#475569' }}>
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 15).map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    {Object.keys(rows[0] || {}).map((key) => (
                      <td key={key} style={{ padding: '10px 12px', color: '#1e293b' }}>
                        {String(row[key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 15 && (
              <div style={{ textAlign: 'center', padding: '12px', color: '#64748b', fontSize: 12 }}>
                共 {rows.length} 行数据，已显示前 15 行
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
            <p style={{ fontSize: 14, margin: '0 0 12px 0' }}>当前通用项目尚未导入数据集或绑定数据源。</p>
            <Link
              href={`/projects/${encodeURIComponent(projectId)}/settings`}
              style={{
                display: 'inline-block',
                background: '#2563eb',
                color: '#fff',
                padding: '8px 16px',
                borderRadius: 6,
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              ＋ 接入数据源
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
