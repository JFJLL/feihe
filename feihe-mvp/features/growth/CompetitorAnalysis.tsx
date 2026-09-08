'use client';

import { useState } from 'react';
import type { Dashboard } from '../../lib/types/project';
import { GrowthMetricCard as MetricCard, GrowthReadout } from './GrowthReadout';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { EmptyState } from '../../components/ui/EmptyState';
import { TimeSeriesChart } from '../../components/ui/TimeSeriesChart';
import { BrandLandscape } from './BrandLandscape';
import { CompetitorIntelligenceSection } from './CompetitorIntelligenceSection';
import { numeric, percent, ratio, completeSum, change, previousMonth } from './metrics';
import { HorizontalBarList } from '../overview/OverviewCharts';

export function CompetitorAnalysis({ data, onSwitchTab }: { data: Dashboard; onSwitchTab?: (tab: string) => void }) {
  const [selectedMonth, setSelectedMonth] = useState('');
  const monthly = data.feishu?.competitor || [];
  const months = [...new Set(monthly.map(r => r.month))].sort();
  const month = months.includes(selectedMonth) ? selectedMonth : months.at(-1) || '';
  const current = monthly.filter(r => r.month === month).sort((a, b) => (numeric(b.value) ?? -Infinity) - (numeric(a.value) ?? -Infinity));
  const brands = data.analytics.brands || [];
  const totalNotes = completeSum(brands.map(r => r.notes));
  const totalComments = completeSum(brands.map(r => r.comments));
  const search = [...(data.feishu?.search || [])].sort((a, b) => a.date.localeCompare(b.date));
  const latest = search.at(-1);
  const previous = search.at(-2);

  return <div className="stack animate-fade-in growth-analysis">
    <div className="reference-daily-grid">
      <MetricCard label="启萃灵犀搜索指数" value={latest?.lingxi} tag={latest?.date || '未同步'} desc={'较上一条记录 ' + percent(change(latest?.lingxi, previous?.lingxi)) + ' · ' + (previous?.date || '无比较基期')} />
      <MetricCard label="启萃聚光搜索指数" value={latest?.spotlight} theme="teal" tag={latest?.date || '未同步'} desc={'较上一条记录 ' + percent(change(latest?.spotlight, previous?.spotlight)) + ' · ' + (previous?.date || '无比较基期')} />
      <MetricCard label="项目监测笔记" value={totalNotes} unit="篇" theme="green" desc={brands.length + ' 个归一品牌分组（含未标注竞品）'} />
      <MetricCard label="项目评论样本" value={totalComments} unit="条" theme="purple" desc="来自当前项目筛选范围；不代表全平台声量" />
    </div>
    <BrandLandscape brands={brands} />
    <DashboardSection title="品牌样本份额与内容效率" eyebrow="PROJECT SAMPLE" desc="份额分母为当前项目全部品牌样本。互动/阅读为记录比值，非去重用户转化率；篇均互动仅使用已提供互动的笔记。缺失显示 —，真实零显示 0。">
      {brands.length ? <div className="ops-table-wrap"><table className="ops-table">
        <thead><tr><th>品牌</th><th>笔记</th><th>笔记份额</th><th>评论</th><th>评论份额</th><th>正向评论率</th><th>负向评论率</th><th>阅读</th><th>互动</th><th>篇均互动</th><th>互动/阅读</th><th>样本 CPE（元）</th></tr></thead>
        <tbody>{brands.map(row => <tr key={String(row.brand)}>
          <td><strong>{String(row.brand)}</strong></td><td><GrowthReadout value={row.notes} /></td><td>{percent(ratio(row.notes, totalNotes))}</td>
          <td><GrowthReadout value={row.comments} /></td><td>{percent(ratio(row.comments, totalComments))}</td>
          <td>{percent(ratio(row.positive, row.comments))}</td><td>{percent(ratio(row.negative, row.comments))}</td>
          <td><GrowthReadout value={row.reads} /></td><td><GrowthReadout value={row.interactions} /></td><td><GrowthReadout value={ratio(row.interactions, row.interactionSamples)} /></td>
          <td>{percent(ratio(row.pairedInteractions, row.pairedReads))}</td><td><GrowthReadout value={ratio(row.pairedCost, row.costInteractions)} /></td>
        </tr>)}</tbody>
      </table></div> : <EmptyState title="暂无品牌样本" text="同步项目笔记后显示品牌份额和效率。" />}
      <p className="metric-note">阅读、互动为已记录值之和；互动/阅读仅使用两项均有记录的笔记，CPE 仅使用费用与互动均有记录的笔记。零分母不计算比率。费用口径为笔记报价，非实际投放结算。</p>
    </DashboardSection>
    <div className="workspace-two-col competitor-source-grid">
      <DashboardSection title="竞品月报 · 搜索指数对比" eyebrow="MONTHLY SEARCH" desc="按来源工作表展示，不跨来源求和或推断市场份额。较前月仅比较同工作表、同品牌的唯一记录；缺月或重复记录不计算。" extra={<label>月份 <select aria-label="竞品月报月份" value={month} onChange={e => setSelectedMonth(e.target.value)}>{[...months].reverse().map(m => <option key={m}>{m}</option>)}</select></label>}>
        {current.length ? <div className="stack" style={{ gap: 14 }}>
          <div style={{ padding: '4px 0 6px' }}>
            <p className="metric-note" style={{ marginBottom: 8 }}>当月各品牌/品线搜索热度横向对比：</p>
            <HorizontalBarList items={current.slice(0, 7).map((r, i) => {
              const val = numeric(r.value) || 0;
              const maxVal = Math.max(1, ...current.map(c => numeric(c.value) || 0));
              return {
                label: r.brand,
                amount: val,
                pct: (val / maxVal) * 100,
                color: ['#0284c7', '#0d9488', '#8b5cf6', '#16a34a', '#d97706', '#6366f1', '#ec4899'][i % 7],
                subText: `${(val / 10000).toFixed(1)}万 指数`,
              };
            })} />
          </div>
          <div className="ops-table-wrap" style={{ maxHeight: '280px', overflowY: 'auto' }}><table className="ops-table">
            <thead><tr><th>品牌 / 品线</th><th>搜索指数</th><th>较前月</th><th>来源</th></tr></thead>
            <tbody>{current.map((row, i) => {
              const prevMonth = previousMonth(month);
              const prev = monthly.filter(r => r.month === prevMonth && r.brand === row.brand && r.sheetId === row.sheetId);
              const unique = current.filter(r => r.brand === row.brand && r.sheetId === row.sheetId).length === 1;
              return <tr key={row.sheetId + row.brand + i}><td>{row.brand}</td><td><GrowthReadout value={row.value} /></td><td>{percent(change(row.value, unique && prev.length === 1 ? prev[0].value : null))}</td><td><a href={'https://yimeichuanbo.feishu.cn/wiki/J8bnw5Mx4inxbukp2HYcgjMznJg?sheet=' + encodeURIComponent(row.sheetId)} target="_blank" rel="noreferrer">工作表 ↗</a></td></tr>;
            })}</tbody>
          </table></div>
        </div> : <EmptyState title="暂无月报数据" text="同步已填写的竞品月份后显示。" />}
      </DashboardSection>
      <DashboardSection title="启萃搜索指数趋势" desc="灵犀与聚光分别展示，单位与采集口径可能不同，不相加。缺失观测不补零；仅有已记录日期参与展示。">
        {(['lingxi', 'spotlight'] as const).map((key, i) => <TimeSeriesChart key={key} rows={search.slice(-30).map(r => ({ date: r.date, [key]: numeric(r[key]) }))} title={i ? '聚光搜索指数' : '灵犀搜索指数'} unit="指数" series={[{ key, label: i ? '聚光' : '灵犀', color: i ? '#8b5cf6' : '#0284c7' }]} />)}
      </DashboardSection>
    </div>
    <CompetitorIntelligenceSection intelligence={data.feishu?.intelligence} />
    {onSwitchTab && <div className="workspace-header-actions"><button onClick={() => onSwitchTab('radar')}>查看关键词机会</button><button onClick={() => onSwitchTab('inspiration')}>进入灵感选题</button></div>}
  </div>;
}
