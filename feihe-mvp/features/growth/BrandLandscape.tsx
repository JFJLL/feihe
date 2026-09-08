import type { AnalyticRow } from '../../lib/types/project';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { EmptyState } from '../../components/ui/EmptyState';
import { HorizontalBarList, TierDoughnutChart } from '../overview/OverviewCharts';
import { GrowthReadout } from './GrowthReadout';
import { numeric, compactMetric, display, completeSum, percent, ratio } from './metrics';
import { paletteColor } from '../../lib/workspace-palette';

/** Brand colors come from the stable brand key, not the current row order. */
const brandColor = (brand: string) => paletteColor('brand:' + brand);

/** Cards, charts and detail table share the SQL-normalized brand rows. */
export function BrandLandscape({ brands }: { brands: AnalyticRow[] }) {
  const totalNotes = completeSum(brands.map(row => row.notes));
  const observed = brands.filter(row => numeric(row.interactions) !== null);
  const totalInteractions = completeSum(observed.map(row => row.interactions));
  const colored = brands.map((row) => ({ row, color: brandColor(String(row.brand)) }));
  const contributions = colored.filter(({ row }) => (numeric(row.interactions) ?? 0) > 0)
    .sort((a, b) => Number(b.row.interactions) - Number(a.row.interactions));
  const single = brands.length === 1 ? brands[0] : null;

  return <DashboardSection title="品牌竞争格局" eyebrow="BRAND LANDSCAPE" desc="【单篇监测笔记库】当前项目已收录 1,405 篇启萃本品监测笔记；全网 7 大竞品横向月报大盘（飞鹤、金领冠、爱他美、美素佳儿、a2、合生元、君乐宝）请见下方【飞鹤竞品月报全景情报台】。">
    {!brands.length ? <EmptyState title="暂无品牌样本" text="同步项目笔记后显示品牌卡片与贡献图。" /> : (
      <div className="stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 16, alignItems: 'stretch' }}>
        {brands.map((row) => {
          const interVal = numeric(row.interactions);
          const titleStr = `${String(row.brand)}：${interVal === null ? '未提供' : display(row.interactions)}互动`;
          return (
            <div
              className="growth-brand-card panel"
              data-brand={String(row.brand)}
              key={String(row.brand)}
              title={titleStr}
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '100%',
                margin: 0,
                padding: '22px',
                borderRadius: 14,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 7px rgba(22, 52, 76, 0.04)',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <strong style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{String(row.brand)}</strong>
                  <span className="section-mini-tag tag-blue">
                    {'笔记份额 ' + percent(ratio(row.notes, totalNotes))}
                  </span>
                </div>
                <div style={{ margin: '10px 0 4px' }}>
                  <div style={{ fontSize: 34, fontWeight: 800, color: '#0284c7', lineHeight: 1.15 }}>
                    <GrowthReadout value={row.interactions} />
                    <small style={{ fontSize: 13, fontWeight: 500, color: '#64748b', marginLeft: 6 }}>互动</small>
                  </div>
                  <p className="metric-note" style={{ margin: '6px 0 0', fontSize: 12, color: '#64748b' }}>
                    已记录互动 · {display(row.interactionSamples)} / {display(row.notes)} 篇有记录
                  </p>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14, marginTop: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#334155', marginBottom: 6 }}>
                  <span>笔记 <strong><GrowthReadout value={row.notes} /></strong> 篇</span>
                  <span>评论 <strong><GrowthReadout value={row.comments} /></strong> 条</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#334155', marginBottom: 6 }}>
                  <span>正向率 <strong style={{ color: '#10b981' }}>{percent(ratio(row.positive, row.comments))}</strong></span>
                  <span>负向率 <strong style={{ color: '#ef4444' }}>{percent(ratio(row.negative, row.comments))}</strong></span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#64748b' }}>
                  <span>篇均互动</span>
                  <strong style={{ color: '#0284c7' }}><GrowthReadout value={ratio(row.interactions, row.interactionSamples)} /> 次/篇</strong>
                </div>
              </div>
            </div>
          );
        })}
        <section className="panel" aria-label="品牌笔记样本贡献" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', margin: 0, padding: '18px', borderRadius: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>笔记样本构成</h3>
            <p className="metric-note">分母：当前筛选全部品牌 {compactMetric(totalNotes)} 篇笔记。单品牌 100% 仅表示当前样本构成。</p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, padding: '8px 0' }}>
            {totalNotes !== null && totalNotes > 0 ? <TierDoughnutChart total={totalNotes} items={colored.map(({ row, color }) => ({ label: String(row.brand), count: Number(row.notes), pct: Number(ratio(row.notes, totalNotes)) * 100, color }))} /> : <EmptyState title="暂无可计算的笔记份额" text="笔记总数为 0 或缺失时不绘制占比。" />}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 6 }}>
            单品精细化运营样本，覆盖蒲公英达人与KFS投放笔记
          </div>
        </section>
        <section className="panel" aria-label="品牌已记录互动贡献" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', margin: 0, padding: '18px', borderRadius: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>已记录互动贡献</h3>
            <p className="metric-note">分母：{observed.length} / {brands.length} 个品牌已记录互动之和 <GrowthReadout value={totalInteractions} />；缺失品牌不参与。零值保留在卡片，不绘制非零条形。</p>
          </div>
          <div style={{ margin: '10px 0', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {totalInteractions !== null && totalInteractions > 0 ? contributions.map(({ row, color }) => <div key={String(row.brand)} title={String(row.brand) + '：' + display(row.interactions) + ' 次互动'}>
              <HorizontalBarList items={[{ label: String(row.brand), amount: Number(row.interactions), pct: Number(ratio(row.interactions, totalInteractions)) * 100, color, subText: compactMetric(row.interactions) + ' 次互动' }]} />
            </div>) : <EmptyState title="暂无可计算的互动贡献" text="已记录互动合计为 0 或缺失，不生成份额。" />}
          </div>
          <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: '#64748b' }}>互动/阅读转化率</span>
              <strong style={{ color: '#10b981' }}>{percent(ratio(single?.pairedInteractions, single?.pairedReads))}</strong>
            </div>
          </div>
        </section>
      </div>
    )}
  </DashboardSection>;
}
