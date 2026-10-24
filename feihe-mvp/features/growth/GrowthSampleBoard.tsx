import type { Note } from '../../lib/types/project';
import { MetricCard } from '../../components/ui/operations/MetricCard';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { EmptyState } from '../../components/ui/EmptyState';
import { numeric, completeSum, display, ratio, percent } from './metrics';
import { HorizontalBarList } from '../overview/OverviewCharts';
import { GrowthReadout } from './GrowthReadout';
import { sampleDirection, REVIEW_DIRECTION } from './directions';
import { paletteColor } from '../../lib/workspace-palette';


export function GrowthSampleBoard({ notes, threshold, onDirectionClick }: { notes: Note[]; threshold: number; onDirectionClick?: (direction: string) => void }) {
  const observed = notes.filter(n => numeric(n.interactionCount) !== null);
  const hot = observed.filter(n => numeric(n.interactionCount)! > threshold);
  const groups = [...new Set(notes.map(sampleDirection))].map(direction => {
    const sample = notes.filter(n => sampleDirection(n) === direction);
    const valid = sample.filter(n => numeric(n.interactionCount) !== null);
    return { direction, count: sample.length, valid: valid.length, hot: valid.filter(n => numeric(n.interactionCount)! > threshold).length, interactions: completeSum(valid.map(n => n.interactionCount)) };
  }).sort((a, b) => b.hot - a.hot || b.count - a.count);
  const pending = groups.find(g => g.direction === REVIEW_DIRECTION)?.count || 0;
  const validGroups = groups.filter(g => g.direction !== REVIEW_DIRECTION);
  const classified = notes.length - pending;
  const directionStyle = { width: '180px', maxWidth: '180px', whiteSpace: 'normal' as const, overflowWrap: 'anywhere' as const };

  return <div className="stack growth-sample-board">
    <div className="reference-daily-grid">
      <MetricCard label="本次载入样本" value={notes.length} unit="篇" desc={'当前项目载入 ' + notes.length + ' 篇笔记样本；覆盖全部已采集档案'} />
      <MetricCard label="互动数据覆盖" value={percent(ratio(observed.length, notes.length))} theme="teal" desc={observed.length + ' 篇有互动记录；0 计为已记录'} />
      <MetricCard label="样本高热率" value={percent(ratio(hot.length, observed.length))} theme="purple" desc={'互动 > ' + display(threshold) + '，分母为有互动记录的样本'} />
      <MetricCard label="已记录篇均互动" value={display(ratio(completeSum(observed.map(n => n.interactionCount)), observed.length))} theme="green" desc="已记录互动之和 / 有互动记录的笔记数" />
    </div>
    <DashboardSection title="内容方向机会分布" eyebrow="SAMPLE OPPORTUNITIES" desc="优先有效二级分类，其次一级分类。URL、空白及超过 40 字符的分类不参与方向排行；按高热样本数优先、样本总量补充排序，不推断全网热度。">
      <p className="metric-note" role="status">分类待核对：<strong>{pending}</strong> 篇 / 有效分类：{classified} / {notes.length} 篇。待核对样本保留在下方明细，排除于方向图。</p>
      <div className="workspace-two-col" style={{ minWidth: 0 }}>
        <section className="panel" style={{ minWidth: 0, overflowWrap: 'anywhere' }} aria-label="有效内容方向贡献图">
          <h3>有效方向样本贡献</h3>
          <p className="metric-note">展示前 8 个方向；分母为全部 {classified} 篇有效分类样本，未展示方向仍计入分母。</p>
          {validGroups.length ? <HorizontalBarList onItemClick={it => onDirectionClick && onDirectionClick(it.label)} items={validGroups.slice(0, 8).map((g) => ({ label: g.direction, amount: g.count, pct: Number(ratio(g.count, classified)) * 100, color: paletteColor('direction:' + g.direction), subText: g.count + ' 篇 / 高热 ' + g.hot + ' 篇' }))} /> : <EmptyState title="暂无有效内容方向" text="请核对分类字段后查看方向贡献；待核对样本不会作为方向上榜。" />}
        </section>
        <div style={{ minWidth: 0, maxWidth: '100%' }}>
          {groups.length ? <div className="ops-table-wrap" style={{ width: '100%', maxWidth: '100%', maxHeight: '440px', overflowX: 'auto', overflowY: 'auto', border: '0.5px solid var(--slate-6, #d9d9e0)', borderRadius: '6px' }}><table className="ops-table" style={{ tableLayout: 'fixed', width: '100%', minWidth: '720px' }}><thead style={{ position: 'sticky', top: 0, background: '#ffffff', zIndex: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}><tr><th style={directionStyle}>方向</th><th>样本数</th><th>样本份额</th><th>互动覆盖</th><th>高热样本</th><th>高热率</th><th>篇均互动</th></tr></thead><tbody>{[...validGroups, ...groups.filter(g => g.direction === REVIEW_DIRECTION)].map(g => <tr key={g.direction} onClick={() => onDirectionClick && onDirectionClick(g.direction)} style={{ cursor: onDirectionClick ? 'pointer' : 'default' }} title={onDirectionClick ? '点击查看该方向笔记' : undefined}><td style={directionStyle}><span style={{ color: onDirectionClick ? '#0d74ce' : 'inherit', fontWeight: 600 }}>{g.direction}</span>{onDirectionClick && <span style={{ fontSize: 12, padding: '1px 4px', marginLeft: 6, borderRadius: 4, background: '#e6f4fe', color: '#0d74ce' }}>查看 ↗</span>}</td><td>{g.count}</td><td>{percent(ratio(g.count, notes.length))}</td><td>{g.valid} / {g.count}</td><td>{g.hot}</td><td>{percent(ratio(g.hot, g.valid))}</td><td><GrowthReadout value={ratio(g.interactions, g.valid)} /></td></tr>)}</tbody></table></div> : <EmptyState title="暂无样本" text="同步项目内容后显示机会分布。" />}
        </div>
      </div>
    </DashboardSection>
  </div>;
}
