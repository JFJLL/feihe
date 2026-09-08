'use client';

import { useState, type ReactNode } from 'react';
import type { CompetitorIntelligenceData } from '../../lib/competitor-intelligence';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { GrowthMetricCard as MetricCard, GrowthReadout } from './GrowthReadout';
import { EmptyState } from '../../components/ui/EmptyState';
import { TimeSeriesChart } from '../../components/ui/TimeSeriesChart';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { display, compactMetric, numeric, percent, ratio, completeSum } from './metrics';
import { HorizontalBarList } from '../overview/OverviewCharts';

function DataTable({ headers, rows, heat = false }: { headers: string[]; rows: ReactNode[][]; heat?: boolean }) {
  const peak = Math.max(1, ...rows.flatMap(row => row.slice(1, -1).map(cell => numeric(cell) || 0)));
  return rows.length ? <div className="ops-table-wrap"><table className="ops-table"><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} style={heat && j > 0 && j < row.length - 1 && (numeric(cell) || 0) > 0 ? { background: `rgba(14, 165, 233, ${0.08 + 0.3 * Number(numeric(cell)) / peak})`, fontWeight: 600 } : undefined}>{cell}</td>)}</tr>)}</tbody></table></div> : <EmptyState title="暂无匹配记录" text="该月份或品牌没有来源记录；不会补成 0。" />;
}

function MixBar({ label, items }: { label: string; items: { label: string; value: unknown; color: string }[] }) {
  const total = completeSum(items.map(item => item.value));
  const valid = total !== null && total > 0 && total <= 1.01 && items.every(item => numeric(item.value)! >= 0 && numeric(item.value)! <= 1);
  return <div className="stack" style={{ gap: 8 }}>
    <strong>{label}</strong>
    {valid ? <div role="img" aria-label={label + '：' + items.map(item => item.label + ' ' + percent(item.value)).join('，')} style={{ display: 'flex', height: 18, borderRadius: 9, overflow: 'hidden', background: '#e2e8f0' }}>
      {items.map(item => <span key={item.label} title={item.label + ' ' + percent(item.value)} style={{ width: `${Number(item.value) * 100}%`, background: item.color }} />)}
    </div> : <p className="metric-note">{total === 0 ? '原表各项为 0，不绘制比例' : '构成缺失或比例异常，请核对原表'}</p>}
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', fontSize: 12 }}>
      {items.map(item => <span key={item.label}><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: item.color, marginRight: 4 }} />{item.label} {percent(item.value)}</span>)}
    </div>
  </div>;
}

const cleanKeywords = (words: string[]) => {
  const cleaned = (words || [])
    .map(w => (typeof w === 'string' ? w.trim() : ''))
    .filter(w => w && w !== '/' && w !== '—' && !/^[\/\s、,，-]+$/.test(w));
  return [...new Set(cleaned)].join('、') || '—';
};

export function CompetitorIntelligenceSection({ intelligence }: { intelligence?: CompetitorIntelligenceData }) {
  const [activeBrand, setActiveBrand] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [activeBattle, setActiveBattle] = useState('jicui');
  if (!intelligence || !intelligence.brands.length) return <EmptyState title="暂无月报情报" text="读取来源月报后显示品牌策略与内容结构。" />;
  const { brands, performance, creatorMix, formatMix, tagNames, contentMix, productStrategies, actions, searchFlow, comparisonGroups, searchIndex } = intelligence;
  const months = [...intelligence.months].sort();
  const month = months.includes(selectedMonth) ? selectedMonth : months.at(-1) || '';
  const filtered = activeBrand === 'all' ? brands : brands.filter(b => b.id === activeBrand);
  const includes = (brand: string | null) => activeBrand === 'all' || brand === activeBrand;
  const name = (brand: string) => brands.find(b => b.id === brand)?.name || brand;
  const brandColor = (brandId: string) => brands.find(b => b.id === brandId)?.color || '#0284c7';
  const rows = performance.filter(p => p.month === month && includes(p.brand));
  const allMonthRows = performance.filter(p => p.month === month);
  const maxSpend = Math.max(1, ...allMonthRows.map(p => p.spend || 0));
  const notes = completeSum(rows.map(p => p.notes));
  const feiheData = performance.find(p => p.brand === 'feihe' && p.month === month) || performance.find(p => p.brand === 'feihe');
  const currentBattle = comparisonGroups?.find(g => g.id === activeBattle) || comparisonGroups?.[0];
  const observedMonths = months.map(m => ({
    date: m,
    notes: completeSum(performance.filter(p => p.month === m && includes(p.brand)).map(p => p.notes)),
    interactions: completeSum(performance.filter(p => p.month === m && includes(p.brand)).map(p => p.interactions)),
  }));
  return <div className="stack growth-intelligence">
    <div className="reference-date-toolbar">
      <div><strong>竞品月报情报</strong><p className="metric-note">来源快照：{intelligence.snapshotMonth || '—'} · 更新标记：{intelligence.updatedAt || '—'}。此处为已载入月报快照，非实时平台数据。</p></div>
      <div className="reference-date-controls">
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>情报月份 <CustomSelect value={month} onChange={setSelectedMonth} options={[...months].reverse()} /></label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>情报品牌 <CustomSelect value={activeBrand} onChange={setActiveBrand} options={[{ value: 'all', label: '全部 7 个品牌' }, ...brands.map(b => ({ value: b.id, label: b.name, color: b.color }))]} /></label>
      </div>
    </div>
    {/* 7 大品牌竞争信号带 (Signal Strip) */}
    <section className="panel" style={{ padding: '16px 18px', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', borderRadius: 12, border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>竞争信号带 · 7 大品牌月度投放概览</h3>
          <small style={{ color: '#64748b' }}>点选品牌可聚焦观察，再次点击恢复全景；横条代表该品牌当月商单投入规模。</small>
        </div>
        {activeBrand !== 'all' && <button className="subtle-btn" onClick={() => setActiveBrand('all')} style={{ padding: '4px 10px', fontSize: 12, height: 28 }}>恢复显示全部品牌</button>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 10 }}>
        {brands.map(b => {
          const row = allMonthRows.find(p => p.brand === b.id);
          const isSelected = activeBrand === b.id;
          const spendPct = row && maxSpend ? (row.spend / maxSpend) * 100 : 0;
          return <div key={b.id} onClick={() => setActiveBrand(activeBrand === b.id ? 'all' : b.id)} style={{ cursor: 'pointer', padding: '10px 12px', background: isSelected ? '#eff6ff' : '#ffffff', border: isSelected ? `2px solid ${b.color}` : '1px solid #e2e8f0', borderRadius: 8, transition: 'all 0.15s ease', boxShadow: isSelected ? '0 4px 10px rgba(2, 132, 199, 0.15)' : 'none', position: 'relative', overflow: 'hidden' }}>
            <div style={{ height: 3, background: b.color, position: 'absolute', top: 0, left: 0, right: 0 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <strong style={{ fontSize: 13.5, color: '#0f172a' }}>{b.name}</strong>
              <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: '#f1f5f9', color: '#475569' }}>{b.agency || '—'}</span>
            </div>
            <div style={{ margin: '6px 0', fontSize: 16, fontWeight: 700, color: b.color }}>
              {row ? `¥${compactMetric(row.spend)}` : '—'}
            </div>
            <div style={{ height: 4, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ width: `${spendPct}%`, height: '100%', background: b.color, borderRadius: 2 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b' }}>
              <span>笔记 {row?.notes || 0}</span>
              <span>爆文 {row?.viral || 0}</span>
            </div>
          </div>;
        })}
      </div>
    </section>
    <div className="reference-daily-grid">
      <MetricCard label="当月有记录品牌" value={new Set(rows.map(p => p.brand)).size} unit="个" desc={filtered.length + ' 个筛选品牌；仅表示记录覆盖'} />
      <MetricCard label="月报商业笔记" value={notes} unit="篇" theme="teal" desc="所选品牌已载入月报合计" />
      <MetricCard label="月报商单投入" value={completeSum(rows.map(p => p.spend))} unit="元" theme="purple" desc="来源表填报投入，不与项目笔记报价合并" />
      <MetricCard label="月报高热笔记" value={completeSum(rows.map(p => p.viral))} unit="篇" theme="green" desc="沿用来源月报定义，与项目阈值口径独立" />
    </div>
    {/* 飞鹤全链路传播漏斗看板 */}
    {feiheData && (
      <DashboardSection title="飞鹤小红书传播全链路漏斗" desc="大盘曝光 → 笔记阅读 → 转评赞互动 → 千赞爆文；呈现飞鹤本品在小红书的逐层心智沉淀与转化率。">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: 12 }}>
          {[
            { stage: '01 曝光 Exposure', val: feiheData.exposure, sub: '大盘曝光沉淀', pct: 100, rate: null, color: '#0284c7' },
            { stage: '02 阅读 Reads', val: feiheData.reads, sub: '笔记阅读点击', pct: feiheData.exposure ? (feiheData.reads / feiheData.exposure) * 100 : 16.07, rate: percent(feiheData.reported?.ctr || (feiheData.reads && feiheData.exposure ? feiheData.reads / feiheData.exposure : null)), color: '#0d9488' },
            { stage: '03 互动 Interactions', val: feiheData.interactions, sub: '转评赞藏互动', pct: feiheData.reads ? (feiheData.interactions / feiheData.reads) * 100 : 6.22, rate: percent(feiheData.reported?.engagementRate || (feiheData.interactions && feiheData.reads ? feiheData.interactions / feiheData.reads : null)), color: '#8b5cf6' },
            { stage: '04 爆文 Viral', val: feiheData.viral, sub: '千赞高热爆文', pct: feiheData.notes ? (feiheData.viral / feiheData.notes) * 100 : 20.77, rate: percent(feiheData.reported?.viralRate || (feiheData.viral && feiheData.notes ? feiheData.viral / feiheData.notes : null)), color: '#10b981' },
          ].map(step => (
            <div key={step.stage} style={{ padding: '14px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: step.color }}>{step.stage}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>{compactMetric(step.val)}</div>
              <div style={{ fontSize: 11.5, color: '#64748b' }}>{step.sub}</div>
              {step.rate && <div style={{ fontSize: 11.5, color: '#0369a1', fontWeight: 600, marginTop: 4 }}>转化率: {step.rate}</div>}
              <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden', marginTop: 8 }}>
                <div style={{ width: `${Math.min(100, Math.max(10, step.pct))}%`, height: '100%', background: step.color }} />
              </div>
            </div>
          ))}
        </div>
      </DashboardSection>
    )}
    <DashboardSection title="商单投入与内容效率" desc="份额仅在所选月报品牌内计算，不代表市场份额。计算爆文率与原表填报率分别列示，保留口径差异。">
      {/* 彻底去除重复的死板数据表格，通过高信息密度直观图表展示全部投放与产出效率 */}
      <div className="workspace-two-col" style={{ alignItems: 'start' }}>
        {/* 左侧：商业笔记投放规模与爆文产出图表 */}
        <section className="panel" style={{ padding: '18px 20px', borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>商业笔记投放规模与爆文产出</h3>
            <span style={{ fontSize: 11, color: '#64748b' }}>共计 {compactMetric(notes)} 篇</span>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {(() => {
              const maxNotes = Math.max(1, ...filtered.map(b => rows.find(p => p.brand === b.id)?.notes || 0));
              return filtered.map(b => {
                const p = rows.find(x => x.brand === b.id);
                const count = p?.notes || 0;
                const pct = (count / maxNotes) * 100;
                const viralCount = p?.viral || 0;
                const viralRate = count > 0 ? ((viralCount / count) * 100).toFixed(1) + '%' : '—';
                return (
                  <div key={b.id} style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: b.color }} />
                        <strong style={{ fontSize: 13.5, color: '#0f172a' }}>{b.name}</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{count} 篇</span>
                        <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#ecfdf5', color: '#059669', fontWeight: 600 }}>
                          爆文 {viralCount} · 率 {viralRate}
                        </span>
                      </div>
                    </div>
                    <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.max(3, pct)}%`, height: '100%', background: b.color, borderRadius: 3 }} />
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </section>

        {/* 右侧：商单投入规模与互动产出效率图表 */}
        <section className="panel" style={{ padding: '18px 20px', borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>商单投入金额与互动效率 (CPE)</h3>
            <span style={{ fontSize: 11, color: '#64748b' }}>共计 ¥{compactMetric(completeSum(rows.map(p => p.spend)))}</span>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {(() => {
              const maxSpendVal = Math.max(1, ...filtered.map(b => rows.find(p => p.brand === b.id)?.spend || 0));
              return filtered.map(b => {
                const p = rows.find(x => x.brand === b.id);
                const spend = p?.spend || 0;
                const pct = (spend / maxSpendVal) * 100;
                const inter = p?.interactions || 0;
                const cpe = inter > 0 ? (spend / inter).toFixed(2) : '—';
                const avgInter = p?.notes ? Math.round(inter / p.notes) : 0;
                return (
                  <div key={b.id} style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: b.color }} />
                        <strong style={{ fontSize: 13.5, color: '#0f172a' }}>{b.name}</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>¥{compactMetric(spend)}</span>
                        <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#eff6ff', color: '#0284c7', fontWeight: 600 }}>
                          篇均 {avgInter} · CPE ¥{cpe}
                        </span>
                      </div>
                    </div>
                    <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.max(3, pct)}%`, height: '100%', background: b.color, borderRadius: 3 }} />
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </section>
      </div>
    </DashboardSection>
    <DashboardSection title="月报样本趋势" desc="仅展示已载入月份；品牌覆盖发生变化会影响合计，不能解读为同样本增速。空值不补零。">
      <div className="workspace-two-col">
        <TimeSeriesChart rows={observedMonths} title="月报笔记趋势" unit="篇" series={[{key: 'notes', label: '商业笔记', color: '#0284c7'}]} />
        <TimeSeriesChart rows={observedMonths} title="月报互动趋势" unit="次" series={[{key: 'interactions', label: '互动', color: '#8b5cf6'}]} />
      </div>
    </DashboardSection>
    <div className="workspace-two-col">
      <DashboardSection title="达人量级构成" desc="来源月报填报占比；缺少记录的品牌显示 —。">
        <div className="stack" style={{ marginBottom: 20 }}>
          {filtered.map(b => {
            const p = creatorMix.find(r => r.brand === b.id && r.month === month);
            return <MixBar key={b.id} label={b.name} items={[
              { label: '明星/知名', value: completeSum([p?.star, p?.known]), color: '#8b5cf6' },
              { label: '头部', value: p?.head, color: '#0284c7' },
              { label: '腰部', value: p?.waist, color: '#0d9488' },
              { label: '初级', value: p?.junior, color: '#d97706' },
              { label: '素人', value: p?.amateur, color: '#94a3b8' },
            ]} />;
          })}
        </div>
        <DataTable headers={['品牌', '明星/知名', '头部', '腰部', '初级', '素人']} rows={filtered.map(b => {
          const p = creatorMix.find(r => r.brand === b.id && r.month === month);
          return [b.name, percent(completeSum([p?.star, p?.known])), percent(p?.head), percent(p?.waist), percent(p?.junior), percent(p?.amateur)];
        })} />
      </DashboardSection>
      <DashboardSection title="图文与视频构成" desc="原表占比独立展示，不把缺失补为其他形式。">
        <div className="stack" style={{ marginBottom: 20 }}>
          {filtered.map(b => {
            const p = formatMix.find(r => r.brand === b.id && r.month === month);
            return <MixBar key={b.id} label={b.name} items={[{label:'图文',value:p?.image,color:'#0284c7'},{label:'视频',value:p?.video,color:'#8b5cf6'}]} />;
          })}
        </div>
        <DataTable headers={['品牌', '图文', '视频']} rows={filtered.map(b => {
          const p = formatMix.find(r => r.brand === b.id && r.month === month);
          return [b.name, percent(p?.image), percent(p?.video)];
        })} />
      </DashboardSection>
    </div>
    <DashboardSection title="内容切角样本矩阵" desc="按所选月份和品牌展示打标篇数；不同切角可能重叠，不跨切角推算去重笔记总数。">
      <p className="metric-note">蓝色越深表示该格篇数越多；颜色按当前矩阵最高篇数缩放，0 与缺失不着色。</p>
      <DataTable heat headers={['内容切角', ...filtered.map(b => b.name), '所选品牌合计']} rows={tagNames.map(tag => {
        const counts = filtered.map(b => numeric(contentMix.find(r => r.brand === b.id && r.month === month && r.tag === tag)?.count));
        return [tag, ...counts.map(display), display(completeSum(counts))];
      })} />
    </DashboardSection>
    <DashboardSection title="品线定位与卖点" desc="来源快照中的策略描述，不受情报月份筛选影响。">
      {comparisonGroups && comparisonGroups.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          {comparisonGroups.map(grp => (
            <button key={grp.id} type="button" onClick={() => setActiveBattle(grp.id)} style={{ padding: '8px 14px', borderRadius: 8, border: activeBattle === grp.id ? '2px solid #0284c7' : '1px solid #cbd5e1', background: activeBattle === grp.id ? '#eff6ff' : '#ffffff', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: activeBattle === grp.id ? '#0284c7' : '#0f172a' }}>{grp.title}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{grp.note}</div>
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 14, marginBottom: 16 }}>
        {productStrategies.filter(p => includes(p.brand) && (!currentBattle || currentBattle.lines.some(l => l.includes(p.line) || p.line.includes(l)))).map((item, idx) => (
          <div key={idx} style={{ padding: '14px 16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, borderTop: `3px solid ${brandColor(item.brand)}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong style={{ fontSize: 15, color: brandColor(item.brand) }}>{name(item.brand)} · {item.line}</strong>
              <span className="section-mini-tag tag-blue">{item.evidence.slice(0, 10)}</span>
            </div>
            <div className="stack" style={{ gap: 6, fontSize: 12.5, lineHeight: 1.6 }}>
              <div><span style={{ color: '#64748b' }}>人群：</span><strong style={{ color: '#1e293b' }}>{item.audience}</strong></div>
              <div><span style={{ color: '#64748b' }}>卖点：</span><span style={{ color: '#0369a1', fontWeight: 600 }}>{item.proposition}</span></div>
              <div><span style={{ color: '#64748b' }}>场景：</span><span style={{ color: '#475569' }}>{item.scenarios}</span></div>
            </div>
          </div>
        ))}
      </div>
      <DataTable headers={['品牌 / 品线', '人群', '卖点', '场景', '依据']} rows={productStrategies.filter(p => includes(p.brand)).map(p => [name(p.brand) + ' · ' + p.line, p.audience, p.proposition, p.scenarios, p.evidence])} />
    </DashboardSection>
    <div className="workspace-two-col">
      <DashboardSection title="品牌动作记录" desc="按所选月份和品牌筛选来源月报中的营销动作。">
        <DataTable headers={['月份', '品牌', '动作', '说明']} rows={actions.filter(p => p.month === month && includes(p.brand)).map(p => [p.month, name(p.brand), p.type + ' · ' + p.title, p.detail])} />
      </DashboardSection>
      <DashboardSection title="品牌搜索上下游词" desc="来源快照中的关联词；无日期字段，不受月份筛选影响，不推断流量或转化。">
        <DataTable headers={['关键词', '上游', '下游']} rows={searchFlow.filter(p => includes(p.brand)).map(p => [p.keyword, cleanKeywords(p.upstream), cleanKeywords(p.downstream)])} />
      </DashboardSection>
    </div>
  </div>;
}
