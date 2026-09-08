'use client';

import { useState, type ReactNode } from 'react';
import type { CompetitorIntelligenceData } from '../../lib/competitor-intelligence';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { GrowthMetricCard as MetricCard, GrowthReadout } from './GrowthReadout';
import { EmptyState } from '../../components/ui/EmptyState';
import { TimeSeriesChart } from '../../components/ui/TimeSeriesChart';
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

export function CompetitorIntelligenceSection({ intelligence }: { intelligence?: CompetitorIntelligenceData }) {
  const [activeBrand, setActiveBrand] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('');
  if (!intelligence || !intelligence.brands.length) return <EmptyState title="暂无月报情报" text="读取来源月报后显示品牌策略与内容结构。" />;
  const { brands, performance, creatorMix, formatMix, tagNames, contentMix, productStrategies, actions, searchFlow } = intelligence;
  const months = [...intelligence.months].sort();
  const month = months.includes(selectedMonth) ? selectedMonth : months.at(-1) || '';
  const filtered = activeBrand === 'all' ? brands : brands.filter(b => b.id === activeBrand);
  const includes = (brand: string | null) => activeBrand === 'all' || brand === activeBrand;
  const name = (brand: string) => brands.find(b => b.id === brand)?.name || brand;
  const rows = performance.filter(p => p.month === month && includes(p.brand));
  const notes = completeSum(rows.map(p => p.notes));
  const observedMonths = months.map(m => ({
    date: m,
    notes: completeSum(performance.filter(p => p.month === m && includes(p.brand)).map(p => p.notes)),
    interactions: completeSum(performance.filter(p => p.month === m && includes(p.brand)).map(p => p.interactions)),
  }));
  return <div className="stack growth-intelligence">
    <div className="reference-date-toolbar">
      <div><strong>竞品月报情报</strong><p className="metric-note">来源快照：{intelligence.snapshotMonth || '—'} · 更新标记：{intelligence.updatedAt || '—'}。此处为已载入月报快照，非实时平台数据。</p></div>
      <div className="reference-date-controls">
        <label>情报月份 <select aria-label="情报月份" value={month} onChange={e => setSelectedMonth(e.target.value)}>{[...months].reverse().map(m => <option key={m}>{m}</option>)}</select></label>
        <label>情报品牌 <select aria-label="情报品牌" value={activeBrand} onChange={e => setActiveBrand(e.target.value)}><option value="all">全部品牌</option>{brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
      </div>
    </div>
    <div className="reference-daily-grid">
      <MetricCard label="当月有记录品牌" value={new Set(rows.map(p => p.brand)).size} unit="个" desc={filtered.length + ' 个筛选品牌；仅表示记录覆盖'} />
      <MetricCard label="月报商业笔记" value={notes} unit="篇" theme="teal" desc="所选品牌已载入月报合计" />
      <MetricCard label="月报商单投入" value={completeSum(rows.map(p => p.spend))} unit="元" theme="purple" desc="来源表填报投入，不与项目笔记报价合并" />
      <MetricCard label="月报高热笔记" value={completeSum(rows.map(p => p.viral))} unit="篇" theme="green" desc="沿用来源月报定义，与项目阈值口径独立" />
    </div>
    <DashboardSection title="商单投入与内容效率" desc="份额仅在所选月报品牌内计算，不代表市场份额。计算爆文率与原表填报率分别列示，保留口径差异。">
      <div className="workspace-two-col">
        {(['notes', 'spend'] as const).map(key => {
          const samples = rows.filter(p => rows.filter(other => other.brand === p.brand).length === 1 && numeric(p[key]) !== null);
          const total = completeSum(samples.map(p => p[key]));
          return <section className="panel" key={key}>
            <h3>{key === 'notes' ? '商业笔记样本贡献' : '填报商单投入贡献'}</h3>
            <p className="metric-note">分母为所选月份、所选品牌的有效唯一记录合计 {compactMetric(total)} {key === 'notes' ? '篇' : '元'}；缺失和重复记录不参与，零值见明细。</p>
            {total !== null && total > 0 ? <HorizontalBarList items={samples.filter(p => Number(p[key]) > 0).sort((a, b) => b[key] - a[key]).map((p, i) => ({ label: name(p.brand), amount: p[key], pct: Number(ratio(p[key], total)) * 100, color: ['#0284c7', '#0d9488', '#8b5cf6', '#16a34a'][i % 4], subText: compactMetric(p[key]) + (key === 'notes' ? ' 篇' : ' 元') }))} /> : <EmptyState title="暂无可计算的贡献" text="所选来源缺失或合计为零；不生成比例。" />}
          </section>;
        })}
      </div>
      <DataTable headers={['品牌', '笔记', '所选样本份额', '投入（元）', '互动', '篇均互动', '投入/互动（元）', '计算爆文率', '原表爆文率', '来源']} rows={filtered.map(b => {
        const matches = rows.filter(p => p.brand === b.id);
        const p = matches.length === 1 ? matches[0] : undefined;
        return [b.name, <GrowthReadout key="notes" value={p?.notes} />, percent(ratio(p?.notes, notes)), <GrowthReadout key="spend" value={p?.spend} />, <GrowthReadout key="interactions" value={p?.interactions} />, <GrowthReadout key="average" value={ratio(p?.interactions, p?.notes)} />, <GrowthReadout key="cost" value={ratio(p?.spend, p?.interactions)} />, percent(ratio(p?.viral, p?.notes)), percent(p?.reported?.viralRate), matches.length > 1 ? '重复来源记录，需核对' : p?.source || '—'];
      })} />
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
      <DataTable headers={['品牌 / 品线', '人群', '卖点', '场景', '依据']} rows={productStrategies.filter(p => includes(p.brand)).map(p => [name(p.brand) + ' · ' + p.line, p.audience, p.proposition, p.scenarios, p.evidence])} />
    </DashboardSection>
    <div className="workspace-two-col">
      <DashboardSection title="品牌动作记录" desc="按所选月份和品牌筛选来源月报中的营销动作。">
        <DataTable headers={['月份', '品牌', '动作', '说明']} rows={actions.filter(p => p.month === month && includes(p.brand)).map(p => [p.month, name(p.brand), p.type + ' · ' + p.title, p.detail])} />
      </DashboardSection>
      <DashboardSection title="品牌搜索上下游词" desc="来源快照中的关联词；无日期字段，不受月份筛选影响，不推断流量或转化。">
        <DataTable headers={['关键词', '上游', '下游']} rows={searchFlow.filter(p => includes(p.brand)).map(p => [p.keyword, p.upstream.join('、') || '—', p.downstream.join('、') || '—'])} />
      </DashboardSection>
    </div>
  </div>;
}
