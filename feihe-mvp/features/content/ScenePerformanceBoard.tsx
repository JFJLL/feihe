'use client';
import { contentDirectionLabel } from '../../lib/dashboard-display';
import { useState } from 'react';
import type { Note } from '../../lib/types/project';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { EmptyState } from '../../components/ui/EmptyState';
import { scenePerformance } from './scene-performance';

export function ScenePerformanceBoard({
  notes,
  onRowClick,
}: {
  notes: Note[];
  onRowClick?: (scene: string, level: string, matchedNotes: Note[]) => void;
}) {
  const [scene, setScene] = useState('');
  const rows = scenePerformance(notes);
  const scenes = [...new Set(rows.map(r => r.scene))];
  const filtered = rows.filter(r => !scene || r.scene === scene);
  const show = (v: number | null) => v === null ? '—' : v.toLocaleString('zh-CN', { maximumFractionDigits: 2 });

  const handleRowClick = (r: { scene: string; level: string }) => {
    if (!onRowClick) return;
    const normScene = contentDirectionLabel(r.scene);
    const matched = notes.filter(n => {
      const noteScene = contentDirectionLabel(n.category1);
      const matchScene = (n.category1 === r.scene) || (noteScene === normScene);
      const matchLevel = (n.creatorLevel || '未标注').trim() === r.level.trim();
      return matchScene && matchLevel;
    });
    onRowClick(r.scene, r.level, matched);
  };

  return <>
    <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>内容方向<CustomSelect ariaLabel="筛选内容方向" value={scene} onChange={setScene}
      options={[{ value: '', label: '全部方向' }, ...scenes.map(value => ({ value, label: contentDirectionLabel(value) }))]} /></label>
    {filtered.length ? <div className="ops-table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}><table className="ops-table">
      <thead><tr><th>方向 / 达人层级</th><th>篇数</th><th>篇均互动</th><th>报价 CPE（元）</th><th>有效样本</th></tr></thead><tbody>
        {filtered.map(r => (
          <tr
            key={JSON.stringify([r.scene, r.level])}
            onClick={() => handleRowClick(r)}
            style={{ cursor: onRowClick ? 'pointer' : 'default' }}
            title={onRowClick ? '点击查看该方向×层级下的笔记' : undefined}
          >
            <td>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 600, color: onRowClick ? '#0d74ce' : 'inherit' }}>{contentDirectionLabel(r.scene)} / {r.level}</span>
                {onRowClick && <span style={{ fontSize: 12, padding: '1px 5px', borderRadius: 4, background: '#e6f4fe', color: '#0d74ce', border: '0.5px solid #e6f4fe', whiteSpace: 'nowrap' }}>查看笔记 ↗</span>}
              </div>
            </td>
            <td>{r.count}</td>
            <td>{show(r.avg)}</td>
            <td>{show(r.cpe)}</td>
            <td>互动 {r.samples} / 成本 {r.costSamples}{r.samples < 5 ? ' / 小样本' : ''}</td>
          </tr>
        ))}
      </tbody></table></div> : <EmptyState title="暂无内容效果样本" text="同步笔记表现后查看各方向的发布数量和效果。" />}
    <p className="metric-note">覆盖当前项目全部 {notes.length} 篇已收录笔记。篇均互动包含真实零值；CPE仅对报价、互动均有记录的笔记计算总报价/总互动，非实际结算。缺失显示 —。</p>
  </>;
}