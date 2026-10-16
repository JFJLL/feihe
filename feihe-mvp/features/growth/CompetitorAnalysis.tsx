'use client';

import { useState } from 'react';
import type { Dashboard, Note } from '../../lib/types/project';
import { GrowthMetricCard as MetricCard, GrowthReadout } from './GrowthReadout';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { EmptyState } from '../../components/ui/EmptyState';
import { TimeSeriesChart } from '../../components/ui/TimeSeriesChart';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { BrandLandscape } from './BrandLandscape';
import { CompetitorIntelligenceSection } from './CompetitorIntelligenceSection';
import { RealCompetitorMonitor } from '../competitors/RealCompetitorMonitor';
import { useProject } from '../../components/project-shell/ProjectContext';
import '../../styles/competitors.css';
import { numeric, percent, ratio, completeSum, change, previousMonth, compactMetric } from './metrics';
import { paletteColor } from '../../lib/workspace-palette';

export function CompetitorAnalysis({
  data,
  onSwitchTab,
  openCategoryNotes,
  openNote,
}: {
  data: Dashboard;
  onSwitchTab?: (tab: string) => void;
  openCategoryNotes?: (opts: { title: string; subtitle?: string; tag?: string; notes: Note[]; maxCount?: number }) => void;
  openNote?: (id: string) => void;
}) {
  const { projectId } = useProject();
  const handleBrandClick = (brandName: string) => {
    if (!openCategoryNotes) return;
    const clean = brandName.trim();
    const matched = (data.notes || []).filter(n => {
      const b = (n.brand || '').trim();
      const scope = (n.productScope || '').trim();
      if (clean === '启萃' || clean === '飞鹤' || clean === '飞鹤启萃') {
        return b === '启萃' || b === '飞鹤' || b === '飞鹤启萃' || b === '本品' || scope !== '竞品';
      }
      return b === clean || scope === clean;
    });
    openCategoryNotes({
      title: '品牌样本 · ' + clean,
      subtitle: '归属于 ' + clean + ' 的样本共 ' + matched.length + ' 篇，展示前 50 篇（按互动量降序）',
      tag: '品牌样本',
      notes: matched,
      maxCount: 50,
    });
  };

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
  const validLingxi = search.filter(r => typeof r.lingxi === 'number' && Number.isFinite(r.lingxi));
  const displayLingxi = (latest && typeof latest.lingxi === 'number') ? latest : validLingxi.at(-1);
  const prevLingxi = displayLingxi ? search.filter(r => r.date < displayLingxi.date && typeof r.lingxi === 'number').at(-1) : previous;
  const validSpotlight = search.filter(r => typeof r.spotlight === 'number' && Number.isFinite(r.spotlight));
  const displaySpotlight = (latest && typeof latest.spotlight === 'number') ? latest : validSpotlight.at(-1);
  const prevSpotlight = displaySpotlight ? search.filter(r => r.date < displaySpotlight.date && typeof r.spotlight === 'number').at(-1) : previous;
  const combinedTrend = search.slice(-30).map(r => ({
    date: r.date,
    lingxi: numeric(r.lingxi),
    spotlight: numeric(r.spotlight),
  }));

  return <div className="stack animate-fade-in growth-analysis">
    {/* 第四批核心：真实竞品监测主视图 (本地归一化库与有界调度，项目专属看板) */}
    <RealCompetitorMonitor projectId={projectId || 'qicui'} openNote={openNote} openCategoryNotes={openCategoryNotes} />

    {/* 历史月报与静态快照归档（2026-08 旧样本参考，非实时监控，默认折叠收纳） */}
    <details className="comp-legacy-archive">
      <summary>
        <span>📦 历史月报归档与静态快照 (2026-08 旧样本参考，非实时监控)</span>
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>点击展开/收起历史飞书月报</span>
      </summary>
      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ padding: '0.625rem 0.875rem', background: '#fef3c7', borderRadius: '6px', fontSize: '0.8125rem', color: '#92400e', border: '1px solid #fde68a' }}>
          ⚠️ <strong>历史来源声明</strong>：下方图表与数据均来源于 2026 年 8 月飞书月报静态快照存档，不代表当前最新舆情监测实况。最新竞品监测请以上方真实采集看板为准。
        </div>

    <div className="reference-daily-grid" style={{ alignItems: 'stretch' }}>
      <MetricCard
        label="启萃灵犀搜索指数"
        value={displayLingxi?.lingxi}
        tag={displayLingxi?.date || '未同步'}
        desc={'较上一条记录 ' + percent(change(displayLingxi?.lingxi, prevLingxi?.lingxi)) + (displayLingxi ? ' · 源表最新录入至 ' + displayLingxi.date.slice(5) + (displayLingxi.date < '2026-09-08' ? '（暂未更新至9-08）' : '') : ' · 无比较基期')}
      />
      <MetricCard
        label="启萃聚光搜索指数"
        value={displaySpotlight?.spotlight}
        theme="teal"
        tag={displaySpotlight?.date || '未同步'}
        desc={'较上一条记录 ' + percent(change(displaySpotlight?.spotlight, prevSpotlight?.spotlight)) + (displaySpotlight ? ' · 源表最新至 ' + displaySpotlight.date.slice(5) : ' · 无比较基期')}
      />
      <MetricCard label="项目监测笔记" value={totalNotes} unit="篇" theme="green" desc={brands.length + ' 个归一品牌分组（含未标注竞品）'} />
      <MetricCard label="项目评论样本" value={totalComments} unit="条" theme="purple" desc="来自当前项目筛选范围；不代表全平台声量" />
    </div>
    <BrandLandscape brands={brands} onBrandClick={handleBrandClick} />
    <DashboardSection title="品牌样本份额与内容效率" eyebrow="PROJECT SAMPLE" desc="份额分母为当前项目全部品牌样本。互动/阅读为记录比值，非去重用户转化率；篇均互动仅使用已提供互动的笔记。缺失显示 —，真实零显示 0。">
      {brands.length ? <div className="ops-table-wrap"><table className="ops-table">
        <thead><tr><th>品牌</th><th>笔记</th><th>笔记份额</th><th>评论</th><th>评论份额</th><th>正向评论率</th><th>负向评论率</th><th>阅读</th><th>互动</th><th>篇均互动</th><th>互动/阅读</th><th>样本 CPE（元）</th></tr></thead>
        <tbody>{brands.map(row => <tr key={String(row.brand)} onClick={() => handleBrandClick(String(row.brand))} style={{ cursor: 'pointer' }} title="点击查看该品牌样本笔记">
          <td><strong>{String(row.brand)}</strong></td><td><GrowthReadout value={row.notes} /></td><td>{percent(ratio(row.notes, totalNotes))}</td>
          <td><GrowthReadout value={row.comments} /></td><td>{percent(ratio(row.comments, totalComments))}</td>
          <td>{percent(ratio(row.positive, row.comments))}</td><td>{percent(ratio(row.negative, row.comments))}</td>
          <td><GrowthReadout value={row.reads} /></td><td><GrowthReadout value={row.interactions} /></td><td><GrowthReadout value={ratio(row.interactions, row.interactionSamples)} /></td>
          <td>{percent(ratio(row.pairedInteractions, row.pairedReads))}</td><td><GrowthReadout value={ratio(row.pairedCost, row.costInteractions)} /></td>
        </tr>)}</tbody>
      </table></div> : <EmptyState compact title="暂无品牌样本" text="同步项目笔记后显示品牌份额和效率。" />}
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
        ) : <EmptyState compact title="暂无月报数据" text="同步已填写的竞品月份后显示。" />}
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
        if (!issues.length) return <EmptyState compact title="暂无来源记录" text="同步内容规划表中的品牌问题收集工作表后展示。" />;
        const counts = new Map<string, number>();
        const categories = new Map<string, number>();
        for (const issue of issues) {
          counts.set(issue.brand, (counts.get(issue.brand) || 0) + 1);
          categories.set(issue.category, (categories.get(issue.category) || 0) + 1);
        }
        const totalIssues = issues.length;
        const brandColors: Record<string, string> = {
          '飞鹤': '#1e6091',
          '金领冠': '#f59e0b',
          '合生元': '#0d9488',
          'A2': '#7c3aed',
          '爱他美': '#e11d48',
          '未标注': '#64748b',
        };
        const sortedBrands = [...counts.entries()].sort((a, b) => b[1] - a[1]);
        const sortedCategories = [...categories.entries()].sort((a, b) => b[1] - a[1]);
        const maxBrand = sortedBrands[0]?.[1] || 1;
        const maxCat = sortedCategories[0]?.[1] || 1;

        return (
          <div className="stack" style={{ gap: 16 }}>
            <div className="workspace-two-col" style={{ alignItems: 'stretch' }}>
              {/* 左列：品牌分布与洞察卡片 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '18px 20px', height: '100%', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <strong style={{ fontSize: 14, color: '#0f172a' }}>按品牌归属分布</strong>
                    <span style={{ fontSize: 12, color: '#64748b' }}>共 {totalIssues} 条讨论</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {sortedBrands.map(([brand, count]) => {
                      const pctVal = ((count / totalIssues) * 100).toFixed(1);
                      const barPct = ((count / maxBrand) * 100).toFixed(1);
                      const color = brandColors[brand] || '#1e6091';
                      return (
                        <div key={brand} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 75px', alignItems: 'center', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={brand}>
                              {brand}
                            </span>
                          </div>
                          <div style={{ background: '#f1f5f9', borderRadius: 5, height: 9, overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 5, width: barPct + '%', background: color, transition: 'width 0.4s ease' }} />
                          </div>
                          <div style={{ textAlign: 'right', fontSize: 12, color: '#475569', whiteSpace: 'nowrap' }}>
                            <strong style={{ color: '#0f172a' }}>{count}</strong> 条 ({pctVal}%)
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 左侧下半部健康度小结，填补空白且提升分析价值 */}
                <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, lineHeight: 1.6, color: '#475569', marginTop: 14 }}>
                  <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>💡 品牌讨论分布洞察</div>
                  <div>• 讨论重点在未标注记录（{(counts.get('未标注') || 0)}条）与金领冠（{(counts.get('金领冠') || 0)}条）。</div>
                  <div>• 飞鹤本品讨论合计 {(counts.get('飞鹤') || 0)} 条，主要集中在买赠权益与活动政策承接。</div>
                </div>
              </div>

              {/* 右列：问题类别分布卡片 */}
              <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '18px 20px', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <strong style={{ fontSize: 14, color: '#0f172a' }}>按问题类别拆解</strong>
                  <span style={{ fontSize: 12, color: '#64748b' }}>TOP 10 核心问题</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {sortedCategories.map(([category, count]) => {
                    const pctVal = ((count / totalIssues) * 100).toFixed(1);
                    const barPct = ((count / maxCat) * 100).toFixed(1);
                    return (
                      <div key={category} style={{ display: 'grid', gridTemplateColumns: '135px 1fr 75px', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 12.5, color: '#334155', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={category}>
                          {category}
                        </span>
                        <div style={{ background: '#f1f5f9', borderRadius: 5, height: 9, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 5, width: barPct + '%', background: '#0284c7', transition: 'width 0.4s ease' }} />
                        </div>
                        <div style={{ textAlign: 'right', fontSize: 12, color: '#475569', whiteSpace: 'nowrap' }}>
                          <strong style={{ color: '#0f172a' }}>{count}</strong> 条 ({pctVal}%)
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <details style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 16px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#1e6091', padding: '4px 0' }}>
                查看全部 {issues.length} 条来源讨论明细
              </summary>
              <div className="ops-table-wrap" style={{ maxHeight: 360, overflowY: 'auto', marginTop: 10 }}>
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>时间</th>
                      <th>品牌 / 品线</th>
                      <th>类别</th>
                      <th>讨论摘要</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issues.map((issue, i) => (
                      <tr key={i}>
                        <td>{issue.time} {issue.week}</td>
                        <td>{issue.brand} {issue.productLine}</td>
                        <td>{issue.category}</td>
                        <td style={{ whiteSpace: 'normal', minWidth: 200 }}>{issue.discussion || '未填写'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        );
      })()}
    </DashboardSection>

    <CompetitorIntelligenceSection intelligence={data.feishu?.intelligence} />
      </div>
    </details>

    {onSwitchTab && <div className="workspace-header-actions"><button onClick={() => onSwitchTab('radar')}>查看关键词机会</button><button onClick={() => onSwitchTab('inspiration')}>进入灵感选题</button></div>}
  </div>;
}
