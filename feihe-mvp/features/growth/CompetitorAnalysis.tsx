'use client';

import { useState } from 'react';
import type { Dashboard } from '../../lib/types/project';
import { GrowthMetricCard as MetricCard, GrowthReadout } from './GrowthReadout';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { EmptyState } from '../../components/ui/EmptyState';
import { TimeSeriesChart } from '../../components/ui/TimeSeriesChart';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { BrandLandscape } from './BrandLandscape';
import { CompetitorIntelligenceSection } from './CompetitorIntelligenceSection';
import { numeric, percent, ratio, completeSum, change, previousMonth, compactMetric } from './metrics';
import { paletteColor } from '../../lib/workspace-palette';

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
  const combinedTrend = search.slice(-30).map(r => ({
    date: r.date,
    lingxi: numeric(r.lingxi),
    spotlight: numeric(r.spotlight),
  }));

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
      {/* 左侧：合并图表与表格，直接使用高信息密度横向柱状图展示全部数据 */}
      <DashboardSection
        title="竞品月报 · 搜索指数对比"
        eyebrow="MONTHLY SEARCH RANKING"
        desc="合并展示搜索热度走势条、数值、环比增跌幅与工作表来源。柱条等比缩放，融合图表与明细数据。"
        extra={<label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>月份 <CustomSelect value={month} onChange={setSelectedMonth} options={[...months].reverse()} /></label>}
      >
        {current.length ? (
          <div className="ops-table-wrap" style={{ maxHeight: '380px', overflowY: 'auto' }}>
            <table className="ops-table" style={{ width: '100%', tableLayout: 'auto' }}>
              <thead>
                <tr>
                  <th style={{ width: '38%' }}>品牌 / 品线与热度</th>
                  <th style={{ width: '22%' }}>搜索指数</th>
                  <th style={{ width: '22%' }}>较前月</th>
                  <th style={{ width: '18%' }}>来源</th>
                </tr>
              </thead>
              <tbody>
            {(() => {
              const validVals = current.map(c => numeric(c.value)).filter((v): v is number => v !== null && Number.isFinite(v));
              const maxVal = validVals.length ? Math.max(0, ...validVals) : 0;
              const prevMonth = previousMonth(month);
              return current.map((row, i) => {
                const val = numeric(row.value);
                const isPositive = val !== null && val > 0;
                const pct = isPositive && maxVal > 0 ? (val / maxVal) * 100 : 0;
                const prev = monthly.filter(r => r.month === prevMonth && r.brand === row.brand && r.sheetId === row.sheetId);
                const unique = current.filter(r => r.brand === row.brand && r.sheetId === row.sheetId).length === 1;
                return (
                  <tr key={row.sheetId + row.brand + i}>
                    <td>
                      <div style={{ marginBottom: 4 }}><strong>{row.brand}</strong></div>
                      <div style={{ height: 5, background: '#edf2f7', borderRadius: 3, overflow: 'hidden', width: '100%' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: paletteColor('brand:' + row.brand), borderRadius: 3 }} />
                      </div>
                    </td>
                    <td><GrowthReadout value={row.value} /></td>
                    <td>{percent(change(row.value, unique && prev.length === 1 ? prev[0].value : null))}</td>
                    <td><a href={'https://yimeichuanbo.feishu.cn/wiki/J8bnw5Mx4inxbukp2HYcgjMznJg?sheet=' + encodeURIComponent(row.sheetId)} target="_blank" rel="noreferrer">工作表 ↗</a></td>
                  </tr>
                );
              });
            })()}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="暂无月报数据" text="同步已填写的竞品月份后显示。" />}
      </DashboardSection>

      {/* 右侧：将灵犀和聚光合并为一个双曲线对比折线图，消除卡片紧贴与重复 */}
      <DashboardSection
        title="启萃灵犀与聚光搜索指数趋势对比"
        eyebrow="SEARCH TREND BENCHMARK"
        desc="灵犀官方大盘搜索（蓝线）与聚光商业搜索（紫线）合并同轴展示；近30天变化轨迹一目了然。"
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', marginTop: 14 }}>
          <TimeSeriesChart
            rows={combinedTrend}
            title="启萃搜索指数双线对比趋势"
            unit="指数"
            height={265}
            series={[
              { key: 'lingxi', label: '灵犀搜索指数', color: '#0284c7' },
              { key: 'spotlight', label: '聚光搜索指数', color: '#8b5cf6' },
            ]}
          />
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
            <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11.5, color: '#64748b' }}>灵犀搜索峰值</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0284c7', marginTop: 3 }}>{compactMetric(Math.max(0, ...combinedTrend.map(r => r.lingxi || 0)))}</div>
            </div>
            <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11.5, color: '#64748b' }}>聚光搜索峰值</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#8b5cf6', marginTop: 3 }}>{compactMetric(Math.max(0, ...combinedTrend.map(r => r.spotlight || 0)))}</div>
            </div>
            <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11.5, color: '#64748b' }}>近30天监测样本</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginTop: 3 }}>{combinedTrend.length} 天</div>
            </div>
          </div>
        </div>
      </DashboardSection>
    </div>
    <DashboardSection title="品牌问题反馈分布" eyebrow="SOURCE FEEDBACK" desc="来自内容规划表的品牌问题收集记录；为收集到的讨论，不代表已证实的产品问题。源表未提供 P0/P1/P2 等级。">
      {(() => {
        const issues = data.feishu?.competitorIssues || [];
        if (!issues.length) return <EmptyState title="暂无来源记录" text="同步内容规划表中的品牌问题收集工作表后展示。" />;
        const counts = new Map<string, number>();
        const categories = new Map<string, number>();
        for (const issue of issues) {
          counts.set(issue.brand, (counts.get(issue.brand) || 0) + 1);
          categories.set(issue.category, (categories.get(issue.category) || 0) + 1);
        }
        const renderCounts = (entries: Map<string, number>) => [...entries].sort((a, b) => b[1] - a[1]).map(([label, count]) => <div key={label} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 48px', alignItems: 'center', gap: 10, marginBottom: 10 }}><span style={{ fontSize: 12 }}>{label}</span><div style={{ background: '#e2e8f0', borderRadius: 6, height: 12 }}><div style={{ height: '100%', borderRadius: 6, width: `${count / Math.max(...entries.values()) * 100}%`, background: '#1e6091' }} /></div><strong style={{ fontSize: 12 }}>{count} 条</strong></div>);
        return <><div className="workspace-two-col" style={{ alignItems: 'start' }}><div><h4>按品牌 · {issues.length} 条记录</h4>{renderCounts(counts)}</div><div><h4>按问题类别</h4>{renderCounts(categories)}</div></div>
          <details><summary>查看全部 {issues.length} 条来源讨论</summary><div className="ops-table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}><table className="ops-table"><thead><tr><th>时间</th><th>品牌 / 品线</th><th>类别</th><th>讨论摘要</th></tr></thead><tbody>{issues.map((issue, i) => <tr key={i}><td>{issue.time} {issue.week}</td><td>{issue.brand} {issue.productLine}</td><td>{issue.category}</td><td style={{ whiteSpace: 'normal', minWidth: 200 }}>{issue.discussion || '未填写'}</td></tr>)}</tbody></table></div></details></>;
      })()}
    </DashboardSection>

    <CompetitorIntelligenceSection intelligence={data.feishu?.intelligence} />
    {onSwitchTab && <div className="workspace-header-actions"><button onClick={() => onSwitchTab('radar')}>查看关键词机会</button><button onClick={() => onSwitchTab('inspiration')}>进入灵感选题</button></div>}
  </div>;
}
