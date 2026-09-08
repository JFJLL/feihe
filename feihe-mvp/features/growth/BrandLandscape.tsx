import type { AnalyticRow } from '../../lib/types/project';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { EmptyState } from '../../components/ui/EmptyState';
import { HorizontalBarList, TierDoughnutChart } from '../overview/OverviewCharts';
import { GrowthMetricCard, GrowthReadout } from './GrowthReadout';
import { numeric, compactMetric, display, completeSum, percent, ratio } from './metrics';

const colors = ['#0284c7', '#0d9488', '#8b5cf6', '#16a34a', '#d97706', '#4f46e5'];
const themes = ['blue', 'teal', 'purple', 'green', 'yellow', 'indigo'] as const;

/** Cards, charts and detail table share the SQL-normalized brand rows. */
export function BrandLandscape({ brands }: { brands: AnalyticRow[] }) {
  const totalNotes = completeSum(brands.map(row => row.notes));
  const observed = brands.filter(row => numeric(row.interactions) !== null);
  const totalInteractions = completeSum(observed.map(row => row.interactions));
  const colored = brands.map((row, i) => ({ row, color: colors[i % colors.length] }));
  const contributions = colored.filter(({ row }) => (numeric(row.interactions) ?? 0) > 0)
    .sort((a, b) => Number(b.row.interactions) - Number(a.row.interactions));

  return <DashboardSection title="品牌竞争格局" eyebrow="BRAND LANDSCAPE" desc="【单篇监测笔记库】当前项目已收录 1,405 篇启萃本品监测笔记；全网 7 大竞品横向月报大盘（飞鹤、金领冠、爱他美、美素佳儿、a2、合生元、君乐宝）请见下方【飞鹤竞品月报全景情报台】。">
    {!brands.length ? <EmptyState title="暂无品牌样本" text="同步项目笔记后显示品牌卡片与贡献图。" /> : <div className="stack" style={brands.length === 1 ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', alignItems: 'start' } : undefined}>
      <div className="reference-daily-grid" style={brands.length === 1 ? { gridTemplateColumns: 'minmax(0, 1fr)' } : undefined}>
        {brands.map((row, i) => <div className="stack growth-brand-card" data-brand={String(row.brand)} key={String(row.brand)}>
          <GrowthMetricCard label={String(row.brand)} value={row.interactions} unit="互动" theme={themes[i % themes.length]}
            tag={'笔记份额 ' + percent(ratio(row.notes, totalNotes))}
            desc={'已记录互动 · ' + display(row.interactionSamples) + ' / ' + display(row.notes) + ' 篇有记录'} />
          <div className="reference-kpi-meta">
            <span>笔记 <strong><GrowthReadout value={row.notes} /></strong> 篇</span>{' · '}
            <span>评论 <strong><GrowthReadout value={row.comments} /></strong> 条</span>
          </div>
          <div className="reference-kpi-meta">
            <span>正向率 <strong>{percent(ratio(row.positive, row.comments))}</strong></span>{' · '}
            <span>负向率 <strong>{percent(ratio(row.negative, row.comments))}</strong></span>
          </div>
          <div className="reference-kpi-meta">篇均互动 <strong><GrowthReadout value={ratio(row.interactions, row.interactionSamples)} /></strong></div>
        </div>)}
      </div>
      <div className="workspace-two-col">
        <section className="panel" aria-label="品牌笔记样本贡献">
          <h3>笔记样本构成</h3>
          <p className="metric-note">分母：当前筛选全部品牌 {compactMetric(totalNotes)} 篇笔记。单品牌 100% 仅表示当前样本构成。</p>
          {totalNotes !== null && totalNotes > 0 ? <TierDoughnutChart total={totalNotes} items={colored.map(({ row, color }) => ({ label: String(row.brand), count: Number(row.notes), pct: Number(ratio(row.notes, totalNotes)) * 100, color }))} /> : <EmptyState title="暂无可计算的笔记份额" text="笔记总数为 0 或缺失时不绘制占比。" />}
        </section>
        <section className="panel" aria-label="品牌已记录互动贡献">
          <h3>已记录互动贡献</h3>
          <p className="metric-note">分母：{observed.length} / {brands.length} 个品牌已记录互动之和 <GrowthReadout value={totalInteractions} />；缺失品牌不参与。零值保留在卡片，不绘制非零条形。</p>
          {totalInteractions !== null && totalInteractions > 0 ? contributions.map(({ row, color }) => <div key={String(row.brand)} title={String(row.brand) + '：' + display(row.interactions) + ' 次互动'}>
            <HorizontalBarList items={[{ label: String(row.brand), amount: Number(row.interactions), pct: Number(ratio(row.interactions, totalInteractions)) * 100, color, subText: compactMetric(row.interactions) + ' 次互动' }]} />
          </div>) : <EmptyState title="暂无可计算的互动贡献" text="已记录互动合计为 0 或缺失，不生成份额。" />}
        </section>
      </div>
    </div>}
  </DashboardSection>;
}
