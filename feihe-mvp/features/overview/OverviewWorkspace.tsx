'use client';

import { contentDirectionLabel } from '../../lib/dashboard-display';
import { useState, type ReactNode } from 'react';
import Link from '../../components/ui/AppLink';
import type { Dashboard, Ops, Project } from '../../lib/types/project';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { FeishuSources, SyncButton } from '../../components/ui/FeishuSources';
import { WorkspaceModuleTabs } from '../../components/ui/operations/WorkspaceModuleTabs';
import { TimeSeriesChart } from '../../components/ui/TimeSeriesChart';
import { HorizontalBarList, TierDoughnutChart, Sparkline, KfsStackedAreaChart, TierSpendDistribution } from './OverviewCharts';
import { EffectScatterChart, DistributionHistogram, BoxPlotChart } from './AdvancedCharts';
import { api, compact, num } from '../../lib/hooks/use-project-data';
import { useProjectTab } from '../../lib/hooks/useProjectTab';
import { KpiComparison } from './KpiComparison';
import { overviewPeriod, sumMetric, finiteMetric, matchedBudget } from './overview-view-model';

const amount = (value: unknown) => finiteMetric(value)?.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) ?? '—';
const formatDateZh = (val: string | null | undefined) => {
  if (!val) return '';
  const match = String(val).match(/(\d{4}-)?(\d{1,2})-(\d{1,2})/);
  return match ? `${Number(match[2])}月${Number(match[3])}日` : String(val);
};
const colors = ['#1e6091', '#16a34a', '#7c3aed', '#f59e0b', '#0d9488', '#64748b'];

function Section({ tag, title, tone = 'blue', hint, children }: {
  tag: string; title: string; tone?: string; hint?: string; children: ReactNode;
}) {
  return <section className={`pastel-card reference-section section-${tone}`}>
    <div className="card-header-row"><div className="header-left"><span className={`section-mini-tag tag-${tone}`}>{tag}</span><h3>{title}</h3></div>{hint && <span className="header-tag">{hint}</span>}</div>{children}
  </section>;
}

function Progress({ label, value, detail, tone = 'blue' }: { label: string; value: number | null; detail?: string; tone?: string }) {
  return <div className="budget-bar-group">
    <div className="bar-labels"><span>{label}</span><strong>{value === null ? '未设置' : `${amount(value)}%`}</strong></div>
    <div className="progress-track-bg" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value === null ? undefined : Math.min(100, Math.max(0, value))} aria-valuetext={value === null ? '目标未设置' : `${amount(value)}%`}>
      {value !== null && <div className={`progress-fill-bar bar-${tone}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />}
    </div>{detail && <small className="progress-detail">{detail}</small>}
  </div>;
}

export function OverviewWorkspace({ projectId, project, dashboard, ops, onRefresh = async () => {} }: {
  projectId: string; project?: Project; dashboard: Dashboard; ops: Ops; loading?: boolean;
  onRefresh?: (opts?: { fresh?: boolean }) => Promise<void>;
}) {
  const [tab, setTab] = useProjectTab('overview', ['overview', 'daily']);
  const [selected, setSelected] = useState('');
  const [scatterCategory, setScatterCategory] = useState('');
  const [prompt, setPrompt] = useState('根据当前项目数据复盘投放、内容表现与评论风险，给出下一步行动。');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState('');
  const [error, setError] = useState('');
  const { rows, daily, date, monthRows, quarterRows, monthDay, monthDays, quarterDay } = overviewPeriod(dashboard.feishu?.daily || [], selected);
  const monthSpend = sumMetric(monthRows, 'actual_spend');
  const quarterSpend = sumMetric(quarterRows, 'actual_spend');
  const monthBudget = matchedBudget(monthRows);
  const quarterBudget = matchedBudget(quarterRows);
  const feedSpend = sumMetric(quarterRows, 'feed_spend');
  const searchSpend = sumMetric(quarterRows, 'search_spend');
  const channelTotal = num(feedSpend) + num(searchSpend);
  const m = dashboard.metrics;
  const pending = num(m.actions?.replyPending) + num(m.actions?.deletePending);
  const creatorRows = dashboard.analytics.creatorLevels || [];
  const creatorTotal = creatorRows.reduce((sum, r) => sum + num(r.count), 0);
  const tierItems = creatorRows.map((r, i) => ({ label: contentDirectionLabel(r.name), count: num(r.count), pct: creatorTotal ? num(r.count) / creatorTotal * 100 : 0, color: colors[i % colors.length] }));
  // 达人层级采买金额分布（从笔记库聚合）
  const tierSpendMap = new Map<string, { spend: number; count: number }>();
  for (const note of dashboard.notes || []) {
    const level = note.creatorLevel || '未标注';
    const price = num(note.notePrice);
    const existing = tierSpendMap.get(level) || { spend: 0, count: 0 };
    existing.spend += price;
    existing.count += 1;
    tierSpendMap.set(level, existing);
  }
  const tierSpendItems = [...tierSpendMap.entries()]
    .filter(([, v]) => v.spend > 0)
    .sort((a, b) => b[1].spend - a[1].spend)
    .map(([label, v], i) => ({ label, spend: v.spend, count: v.count, color: colors[i % colors.length] }));
  const formatRows = dashboard.analytics.formats || [];
  const formatTotal = formatRows.reduce((sum, r) => sum + num(r.count), 0);
  // 内容效果散点图数据（阅读量 vs 互动量，按内容方向着色）
  const categoryColorMap = new Map<string, string>();
  const scatterNotes = (dashboard.notes || []).filter(n => !scatterCategory || contentDirectionLabel(n.category1) === scatterCategory);
  const scatterPoints = scatterNotes
    .filter(n => finiteMetric(n.readCount) !== null && finiteMetric(n.interactionCount) !== null)
    .map((n, i) => {
      const cat = contentDirectionLabel(n.category1);
      if (!categoryColorMap.has(cat)) categoryColorMap.set(cat, cat === '未标注' ? '#94a3b8' : colors[categoryColorMap.size % colors.length]);
      return { x: num(n.readCount), y: num(n.interactionCount), size: num(n.commentTotal), color: categoryColorMap.get(cat) || colors[0], label: `${n.title || '无标题'} · ${cat} · ${n.author || '未知达人'}`, id: String(n.id || i) };
    });
  // 笔记阅读量分布直方图
  const readValues = (dashboard.notes || []).map(n => finiteMetric(n.readCount)).filter((v): v is number => v !== null && v >= 0);
  const readBands = [0, 1000, 5000, 10000, 50000, 100000, 500000];
  const readBandLabels = ['0–1千', '1千–5千', '5千–1万', '1万–5万', '5万–10万', '10万–50万', '50万及以上'];
  const histBins = readBands.map((lo, i) => ({
    label: readBandLabels[i],
    count: readValues.filter(v => v >= lo && v < (readBands[i + 1] ?? Infinity)).length,
  }));
  // 达人层级效果箱线图数据
  const boxPlotGroups = (dashboard.analytics.creatorLevels || [])
    .map(level => {
      const levelNotes = (dashboard.notes || []).filter(n => (n.creatorLevel || '') === level.name);
      const interactions = levelNotes.map(n => finiteMetric(n.interactionCount)).filter((v): v is number => v !== null && v >= 0);
      return { label: String(level.name), values: interactions };
    })
    .filter(g => g.values.length > 0);
  // 爆文TOP20
  const top20Notes = [...(dashboard.notes || [])]
    .filter(n => num(n.interactionCount) > 0 || num(n.readCount) > 0)
    .sort((a, b) => num(b.interactionCount) - num(a.interactionCount))
    .slice(0, 20);

  // ===== 新增精美看板数据 =====
  // 达人效率排行榜
  const creatorEfficiency = (dashboard.analytics.creatorLevels || [])
    .map(row => ({
      name: String(row.name),
      count: num(row.count),
      avgRead: num(row.avgRead),
      avgInteraction: num(row.avgInteraction),
      avgCpe: num(row.avgCpe),
      efficiency: finiteMetric(row.avgCpe),
    }))
    .filter(r => r.count > 0)
    .sort((a, b) => (a.efficiency ?? Infinity) - (b.efficiency ?? Infinity));

  // 互动质量分析（点赞/收藏/分享/分享占比）
  const totalInteraction = num(m.likeCount) + num(m.favoriteCount) + num(m.shareCount);
  const interactionQuality = [
    { label: '点赞', value: num(m.likeCount), pct: totalInteraction ? num(m.likeCount) / totalInteraction * 100 : 0, color: '#3b82f6', icon: '♥' },
    { label: '收藏', value: num(m.favoriteCount), pct: totalInteraction ? num(m.favoriteCount) / totalInteraction * 100 : 0, color: '#f59e0b', icon: '★' },
    { label: '分享', value: num(m.shareCount), pct: totalInteraction ? num(m.shareCount) / totalInteraction * 100 : 0, color: '#10b981', icon: '↗' },
  ].filter(i => i.value > 0);
  const recent: Array<Record<string, string | number | null> & { date: string }> = quarterRows.slice(-30).map(r => ({ ...r, date: String(r.date) }));
  const previous = quarterRows.at(-2);
  const latestNoteDate = dashboard.feishu?.reports.find(r => r.sheetId === '3Wsban')?.latestDate;
  const summary = [
    { tag: '消耗', text: `${date || '待同步'} 实际投放 ¥${amount(daily?.actual_spend)}，当日计划 ¥${amount(daily?.plan_spend)}，达成率 ${amount(daily?.achieve_pct)}%。` },
    { tag: '效率', text: `信息流 CTR ${amount(daily?.feed_ctr)}%，搜索 CTR ${amount(daily?.search_ctr)}%；按聚光展现、点击加权计算。` },
    { tag: '内容', text: `项目已收录 ${m.noteCount.toLocaleString()} 篇笔记，累计阅读 ${compact(m.readCount)} 次，互动 ${compact(m.interactionCount)} 次。` },
    { tag: '行动', text: `有 ${pending} 条风险评论待处理，其中待回复 ${num(m.actions?.replyPending)} 条、待删除 ${num(m.actions?.deletePending)} 条。` },
  ];
  const dailyCards = [
    { key: 'actual_spend', title: '当日实际消耗', unit: '元', tone: 'blue', desc: `当日计划 ¥${amount(daily?.plan_spend)}` },
    { key: 'achieve_pct', title: '计划达成率', unit: '%', tone: 'green', desc: '实际消耗 / 当日已填计划' },
    { key: 'feed_ctr', title: '信息流 CTR', unit: '%', tone: 'teal', desc: `信息流消耗 ¥${amount(daily?.feed_spend)}` },
    { key: 'search_ctr', title: '搜索 CTR', unit: '%', tone: 'purple', desc: `搜索消耗 ¥${amount(daily?.search_spend)}` },
    { key: 'xhm_cpuv', title: '小红盟 CPUV', unit: '元', tone: 'amber', desc: '源表小红盟 UV 成本' },
    { key: 'xhx_cpuv', title: '小红星 CPUV', unit: '元', tone: 'orange', desc: '源表小红星 UV 成本' },
    { key: 'notes_today', title: '当日发布笔记', unit: '篇', tone: 'blue', desc: '发布日期为当日的已收录笔记' },
    { key: 'interactions', title: '聚光当日互动', unit: '次', tone: 'green', desc: '聚光投放样本互动合计' },
  ];

  async function generate() {
    if (!prompt.trim()) return;
    setBusy(true); setError(''); setReport('');
    try {
      const result = await api<{ reportId: string }>('/api/agent', { method: 'POST', body: JSON.stringify({ projectId, prompt }) });
      setReport(result.reportId);
      await onRefresh({ fresh: true });
    } catch (e) { setError(e instanceof Error ? e.message : '生成失败'); }
    finally { setBusy(false); }
  }

  function stepDate(delta: number) {
    const index = rows.findIndex(r => r.date === date);
    const next = rows[Math.max(0, Math.min(rows.length - 1, index + delta))];
    if (next) setSelected(String(next.date));
  }

  return <div className="ops-workspace overview-colorful-page reference-workspace">
    <PageHeader eyebrow="FEIHE · Q3 DASHBOARD" title={project?.name || '项目总览'} subtitle="2026年 Q3 · 小红书种草与电商引流 · 项目数据看板">
      <div className="workspace-header-actions"><span className="overview-quarter-pill">投放截至 {date || '待同步'}</span><SyncButton projectId={projectId} onRefresh={onRefresh} /></div>
    </PageHeader>
    <WorkspaceModuleTabs tabs={[
      { id: 'overview', title: '总览 · Q3累计全盘', desc: '决策摘要、月度进度、投流效率与内容复盘', icon: '📊' },
      { id: 'daily', title: '分日 · 日报监控看板', desc: '日期切换、8大核心指标与近30天趋势', icon: '📅' },
    ]} activeTab={tab} onChange={setTab} />
    <FeishuSources data={dashboard.feishu} projectId={projectId} />

    {tab === 'overview' && <div className="overview-block-content">
      <section className="pastel-card health-overview-card">
        <div className="health-card-head"><span className="section-mini-tag tag-blue">决策层 · 今日指标与待办</span><span className="health-date-hint">投放 {date || '待同步'} · 笔记 {latestNoteDate || '待同步'}</span></div>
        <div className="health-main-row">
          <div className="health-score-dial"><div className="score-number">{amount(daily?.achieve_pct)}<small>%</small></div><div className="score-label">当日计划达成率</div><div className="score-badge">实际消耗 / 已填计划</div></div>
          <div className="health-indicators-grid">{[
            { title: '消耗节奏', value: `¥${amount(daily?.actual_spend)}`, desc: `当日计划 ¥${amount(daily?.plan_spend)}`, tone: 'green' },
            { title: '信息流 CTR', value: `${amount(daily?.feed_ctr)}%`, desc: '点击合计 / 展现合计', tone: 'teal' },
            { title: '搜索 CTR', value: `${amount(daily?.search_ctr)}%`, desc: '搜索广告实际点击效率', tone: 'purple' },
            { title: '待处置风险', value: `${pending} 条`, desc: `待回复 ${num(m.actions?.replyPending)} · 待删除 ${num(m.actions?.deletePending)}`, tone: pending ? 'amber' : 'green' },
          ].map(item => <div key={item.title} className={`health-indicator-card pastel-${item.tone}`}><div className="indicator-top"><strong>{item.title}</strong></div><div className="indicator-val">{item.value}</div><div className="indicator-desc">{item.desc}</div></div>)}</div>
        </div>
        <div className="health-exec-summary"><div className="exec-title"><strong>Executive Summary · 关键数据摘要</strong></div><ul className="exec-summary-list">{summary.map(item => <li className="exec-item" key={item.tag}><span className={`exec-tag ${item.tag === '行动' ? 'tag-warn' : 'tag-blue'}`}>{item.tag}</span><span>{item.text}</span></li>)}</ul></div>
      </section>

      <Section tag="预算节奏" title="预算消耗节奏对比" tone="amber" hint="当月进度与季度全盘">
        {date ? <div className="budget-dual-grid">{[
          { title: `${Number(date.slice(5, 7))}月当月 · 截至${formatDateZh(date)}`, spend: monthSpend, budget: monthBudget, time: monthDay / monthDays * 100, days: `${monthDay}/${monthDays}`, tone: 'blue', count: monthRows.length },
          { title: `Q3 累计 · 7月1日—${formatDateZh(date)}`, spend: quarterSpend, budget: quarterBudget, time: quarterDay / 92 * 100, days: `${quarterDay}/92`, tone: 'purple', count: quarterRows.length },
        ].map(item => <div key={item.title} className={`budget-sub-card pastel-${item.tone}`}>
          <div className="sub-card-title"><strong>{item.title}</strong></div>
          <Progress label={`时间进度（${item.days} 天）`} value={item.time} tone="gray" />
          <Progress label="同日期 · 消耗 / 计划" value={item.budget.plan && item.budget.spend !== null ? item.budget.spend / item.budget.plan * 100 : null} tone={item.tone} detail={`${item.budget.count} 个可比日期 · 实际 ¥${amount(item.budget.spend)} / 计划 ¥${amount(item.budget.plan)}`} />
          <div className="budget-diff-box"><span className="diff-val">{item.spend === null ? '—' : `¥${compact(item.spend)}`}</span><span className="diff-desc">覆盖 {item.count} 个有投放数据的日期</span></div>
        </div>)}</div> : <EmptyState title="等待投放数据" text="点击同步最新数据后展示月度与季度进度。" />}
        <div className="budget-footer-notes">计划为已填日期的预算合计，并非完整月度或季度预算。时间进度按自然日计算。</div>
      </Section>

      <Section tag="一、投流效率" title="KFS 投流与采买结构" tone="teal" hint="投流与达人采买分开展示">
        <div className="two-col-chart-grid" style={{ alignItems: 'stretch' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="chart-inner-panel"><div className="inner-head"><strong>信息流 / 搜索投流结构</strong><small>Q3 已同步日期</small></div>
              {channelTotal ? <HorizontalBarList items={[{ label: '信息流 F', amount: num(feedSpend), pct: num(feedSpend) / channelTotal * 100, color: colors[0], subText: `¥${amount(feedSpend)}` }, { label: '搜索 S', amount: num(searchSpend), pct: num(searchSpend) / channelTotal * 100, color: colors[2], subText: `¥${amount(searchSpend)}` }]} /> : <EmptyState title="暂无投流结构" text="同步已填写的信息流与搜索消耗后显示。" />}
            </div>
            <div className="chart-inner-panel" style={{ flex: 1 }}>
              <div className="inner-head"><strong>达人 K · 内容采买</strong><small>项目笔记报价合计</small></div>
              <div className="reference-big-number">¥{compact(m.creatorCost)}</div>
              <div className="reference-stat-pair"><span>商业合作笔记<strong>{num(m.commercialCount)} 篇</strong></span><span>内容平均 CPE<strong>¥{amount(m.cpe)}</strong></span></div>
              <p className="reference-note" style={{ margin: 0 }}>使用笔记库已有报价与互动表现；采买费用与投流消耗为不同口径。</p>
            </div>
          </div>
          <div className="chart-inner-panel" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="inner-head"><strong>KFS 分渠道消耗趋势（堆叠面积）</strong><small>近 {recent.length} 个数据日 · 信息流 F + 搜索 S</small></div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              {recent.some(r => finiteMetric(r.feed_spend) !== null || finiteMetric(r.search_spend) !== null)
                ? <KfsStackedAreaChart height={220} rows={recent.map(r => ({ date: String(r.date), feed_spend: finiteMetric(r.feed_spend), search_spend: finiteMetric(r.search_spend) }))} />
                : <EmptyState title="暂无分渠道日度消耗" text="同步周投放表的信息流与搜索分渠道消耗后显示堆叠趋势。" />}
            </div>
          </div>
        </div>
      </Section>

      <Section tag="二、内容产出" title="种草发布与切角渗透" tone="purple" hint="当前项目累计笔记库">
        <div className="content-kpi-grid">{[
          { label: '种草笔记总数', value: m.noteCount, unit: '篇', tone: 'blue', desc: `已发布 ${num(m.publishedCount)} 篇` },
          { label: '累计内容阅读', value: compact(m.readCount), unit: '次', tone: 'green', desc: `累计曝光 ${compact(m.exposure)} 次` },
          { label: '累计内容互动', value: compact(m.interactionCount), unit: '次', tone: 'purple', desc: `项目发布目标 ${ops.settings.goals.publishTarget || '未设置'}` },
        ].map(item => <div key={item.label} className={`pastel-card pastel-${item.tone} content-stat-box`}><div className="stat-head">{item.label}</div><div className="stat-value">{item.value}<small> {item.unit}</small></div><div className="stat-sub">{item.desc}</div></div>)}</div>
        <div className="two-col-chart-grid reference-content-detail">
          <div className="chart-inner-panel"><div className="inner-head"><strong>达人量级结构分布</strong><small>{creatorTotal} 篇已收录笔记</small></div>{creatorTotal ? <TierDoughnutChart items={tierItems} total={creatorTotal} /> : <EmptyState title="达人层级待补充" text="同步笔记库后显示层级分布。" />}</div>
          <div className="chart-inner-panel"><div className="inner-head"><strong>内容形式分布</strong><small>已收录笔记</small></div><HorizontalBarList items={formatRows.map((r, i) => ({ label: String(r.name), amount: num(r.count), pct: formatTotal ? num(r.count) / formatTotal * 100 : 0, color: colors[i % colors.length], subText: `${num(r.count)} 篇 · ${compact(r.interactions)} 互动` }))} /></div>
        </div>
        <div className="two-col-chart-grid reference-content-detail" style={{ marginTop: 14, alignItems: 'stretch' }}>
          {tierSpendItems.length > 0 ? (
            <div className="chart-inner-panel">
              <div className="inner-head"><strong>达人层级采买金额分布</strong><small>项目全量笔记报价分布</small></div>
              <TierSpendDistribution items={tierSpendItems} />
            </div>
          ) : <div className="chart-inner-panel"><EmptyState title="暂无采买分布" text="记录报价后显示达人层级采买分布。" /></div>}
          <div className="chart-inner-panel" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="inner-head"><strong>内容切角 / 场景渗透</strong><small>TOP 8 方向笔记与互动</small></div>
            <div className="ops-table-wrap" style={{ flex: 1, margin: 0, overflowX: 'auto' }}>
              <table className="ops-table" style={{ width: '100%' }}>
                <thead><tr><th>切角 / 场景</th><th>篇数</th><th>阅读</th><th>互动</th><th>分布</th></tr></thead>
                <tbody>{dashboard.analytics.categories.slice(0, 8).map((r, i) => (
                  <tr key={`${r.name}-${i}`}>
                    <td>{contentDirectionLabel(r.name)}</td>
                    <td>{num(r.count)}</td>
                    <td>{compact(r.reads)}</td>
                    <td>{compact(r.interactions)}</td>
                    <td><Progress label="" value={m.noteCount ? num(r.count) / m.noteCount * 100 : null} /></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </div>
      </Section>

      <Section tag="三、内容效果" title="内容效果深度分析" tone="blue" hint="散点矩阵 · 分布直方图 · 箱线图">
        <div className="two-col-chart-grid">
          <div className="chart-inner-panel"><div className="inner-head"><strong>笔记阅读与互动效果（散点图）</strong><small>X=阅读量 Y=互动量 · {scatterPoints.length}篇完整记录（含零值）· 点大小=采集评论数</small></div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>内容方向<CustomSelect ariaLabel="散点图内容方向" value={scatterCategory} onChange={setScatterCategory} options={[{ value: '', label: '全部方向' }, ...[...new Set(dashboard.notes.map(n => contentDirectionLabel(n.category1)))].sort().map(value => ({ value, label: value }))]} /></label>
            {scatterPoints.length > 0 ? <EffectScatterChart points={scatterPoints} /> : <EmptyState title="暂无散点数据" text="同步笔记阅读与互动指标后生成效果矩阵。" />}
          </div>
          <div className="chart-inner-panel" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="inner-head"><strong>笔记阅读量分布直方图</strong><small>{readValues.length} 篇有阅读数据的笔记</small></div>
            <div style={{ display: 'flex', alignItems: 'center', height: 38, marginBottom: 10, fontSize: 12, color: '#64748b' }}>
              <span>主流分布集中于 <strong style={{ color: '#0f172a' }}>1千~5千</strong> 区间（占比最高）</span>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              {readValues.length > 0 ? <DistributionHistogram bins={histBins} color="#1e6091" height={280} /> : <EmptyState title="暂无分布数据" text="同步笔记阅读量后生成分布直方图。" />}
            </div>
          </div>
        </div>
        {boxPlotGroups.length > 0 && <div className="chart-inner-panel" style={{ marginTop: 14 }}>
          <div className="inner-head"><strong>达人层级互动量箱线图</strong><small>各层级已记录互动量分布（含零值，缺失不参与）</small></div>
          <BoxPlotChart groups={boxPlotGroups} unit="互动" />
        </div>}
      </Section>

      <KpiComparison data={dashboard.feishu} />

      <Section tag="五、爆文排行" title="高热内容 TOP20 排行榜" tone="amber" hint="项目全量笔记按互动量排序">
        {top20Notes.length > 0 ? <div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>#</th><th>笔记标题</th><th>达人</th><th>内容方向</th><th>阅读量</th><th>互动量</th><th>评论数</th><th>互动率</th></tr></thead><tbody>{top20Notes.map((n, i) => <tr key={String(n.id || i)}><td><strong style={{ color: i < 3 ? '#f59e0b' : '#64748b' }}>{i + 1}</strong></td><td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={String(n.title || '')}>{String(n.title || '无标题')}</td><td>{String(n.author || '未知')}</td><td>{contentDirectionLabel(n.category1)}</td><td>{compact(n.readCount)}</td><td><strong>{compact(n.interactionCount)}</strong></td><td>{compact(n.commentTotal)}</td><td>{num(n.readCount) > 0 ? (num(n.interactionCount) / num(n.readCount) * 100).toFixed(2) + '%' : '—'}</td></tr>)}</tbody></table></div> : <EmptyState title="暂无爆文数据" text="同步笔记互动指标后生成TOP20排行榜。" />}
      </Section>

      {/* ===== 新增：内容健康度仪表盘 + 达人效率排行 ===== */}
      <div className="workspace-two-col" style={{ alignItems: 'start' }}>
        <div className="stack"><Section tag="数据覆盖" title="内容数据与待办" tone="green" hint="真实记录覆盖情况">
          <div className="reference-daily-grid">
            {[
              { label: '当前项目笔记', value: (dashboard.notes || []).length, unit: '篇' },
              { label: '已记录阅读量', value: readValues.length, unit: '篇（含零值）' },
              { label: '阅读和互动均有记录', value: dashboard.notes.filter(n => finiteMetric(n.readCount) !== null && finiteMetric(n.interactionCount) !== null).length, unit: '篇' },
              { label: '风险待处理', value: pending, unit: '条' },
            ].map(item => <div className="chart-inner-panel" key={item.label}><small>{item.label}</small><div><strong>{item.value.toLocaleString()}</strong> {item.unit}</div></div>)}
          </div>
          <p className="metric-note">分布图覆盖当前项目全部已收录笔记；评论来自采集快照，不串联为用户转化漏斗。内容最新有效日期：{latestNoteDate || '待同步'}。</p>
          <Link href={`/projects/${encodeURIComponent(projectId)}/comments?tab=actions`}>查看风险待办 →</Link>
        </Section>

        <Section tag="字段覆盖" title="内容分析还缺哪些数据" tone="blue" hint="按全量笔记核对">
          <HorizontalBarList items={[
            { label: '内容方向', count: (dashboard.notes || []).filter(n => n.category1).length },
            { label: '达人层级', count: (dashboard.notes || []).filter(n => n.creatorLevel).length },
            { label: '阅读量', count: readValues.length },
            { label: '互动量', count: (dashboard.notes || []).filter(n => finiteMetric(n.interactionCount) !== null).length },
          ].map((item, i) => ({ label: item.label, amount: item.count, pct: dashboard.notes.length ? item.count / dashboard.notes.length * 100 : 0, color: colors[i], subText: `${item.count} 篇有记录 · ${dashboard.notes.length - item.count} 篇待补充` }))} />
          <p className="metric-note">方向缺失的笔记仍计入阅读和互动总量；不参与已标注方向的效果判断。</p>
        </Section></div>

        <Section tag="达人效率" title="达人层级效率排行榜" tone="teal" hint="按篇均CPE升序，缺失排末尾">
          {creatorEfficiency.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 550, overflowY: 'auto' }}>
              {creatorEfficiency.map((c, i) => (
                <div key={i} style={{ padding: '12px 14px', background: i === 0 ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' : '#f8fafc', borderRadius: 10, border: `1px solid ${i === 0 ? '#fbbf24' : '#e2e8f0'}`, position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 22, height: 22, borderRadius: '50%', background: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : '#e2e8f0', color: i < 3 ? '#fff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>{i + 1}</span>
                      <strong style={{ fontSize: 14, color: '#1e293b' }}>{c.name}</strong>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', background: '#ccfbf1', padding: '3px 10px', borderRadius: 999 }}>篇均CPE {c.efficiency === null ? '—' : '¥' + c.efficiency.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, fontSize: 11 }}>
                    <div><span style={{ color: '#94a3b8' }}>笔记数</span><br /><strong style={{ color: '#334155', fontSize: 13 }}>{c.count}</strong></div>
                    <div><span style={{ color: '#94a3b8' }}>均阅读</span><br /><strong style={{ color: '#334155', fontSize: 13 }}>{compact(c.avgRead)}</strong></div>
                    <div><span style={{ color: '#94a3b8' }}>均互动</span><br /><strong style={{ color: '#334155', fontSize: 13 }}>{compact(c.avgInteraction)}</strong></div>
                    <div><span style={{ color: '#94a3b8' }}>均CPE</span><br /><strong style={{ color: '#334155', fontSize: 13 }}>{c.efficiency !== null ? '¥' + c.efficiency.toFixed(1) : '—'}</strong></div>
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyState title="暂无达人效率数据" text="同步达人层级表现指标后生成效率排行榜。" />}
        </Section>
      </div>

      {/* ===== 新增：互动质量分析 ===== */}
      <Section tag="互动质量" title="已记录点赞、收藏与分享构成" tone="purple" hint="比例仅在三项已记录指标中计算">
        <div className="workspace-two-col" style={{ alignItems: 'start' }}>
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '10px 0' }}>
              {interactionQuality.map((item, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 28, height: 28, borderRadius: 8, background: item.color + '15', color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{item.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{item.label}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{item.value.toLocaleString()}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 6 }}>{item.pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div style={{ height: 10, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${item.pct}%`, height: '100%', background: `linear-gradient(90deg, ${item.color}cc, ${item.color})`, borderRadius: 999, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: '16px', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 12, letterSpacing: '0.5px' }}>互动质量洞察</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 550, overflowY: 'auto' }}>
              <div style={{ padding: '10px 12px', background: '#fff', borderRadius: 8, borderLeft: '3px solid #3b82f6' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>点赞占比</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>{interactionQuality.find(i => i.label === '点赞')?.pct.toFixed(1) || 0}%</div>
                <div style={{ fontSize: 10.5, color: '#94a3b8' }}>浅层互动，反映内容吸引力</div>
              </div>
              <div style={{ padding: '10px 12px', background: '#fff', borderRadius: 8, borderLeft: '3px solid #f59e0b' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>收藏占比</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>{interactionQuality.find(i => i.label === '收藏')?.pct.toFixed(1) || 0}%</div>
                <div style={{ fontSize: 10.5, color: '#94a3b8' }}>深度互动，反映内容价值密度</div>
              </div>
              <div style={{ padding: '10px 12px', background: '#fff', borderRadius: 8, borderLeft: '3px solid #8b5cf6' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>分享占比</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>{interactionQuality.find(i => i.label === '分享')?.pct.toFixed(1) || 0}%</div>
                <div style={{ fontSize: 10.5, color: '#94a3b8' }}>采集评论单独查看，不计入此构成</div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section tag="行动层" title="复盘洞察与下一步行动" tone="purple" hint="从数据直接进入运营">
        <div className="two-col-chart-grid"><div className="reference-learning"><strong>当前观察</strong><p>内容库共 {m.noteCount} 篇，累计互动 {compact(m.interactionCount)} 次。已标注的内容方向中，{String(dashboard.analytics.categories[0]?.name || '暂无方向')}收录最多。</p><p>当前真实评论快照合计 {m.commentTotal} 条，正向 {m.positiveCount} 条，负向 {m.negativeCount} 条。继续优先处理待回复和待删除事项。</p></div><div className="reference-actions">
          <Link href={`/projects/${encodeURIComponent(projectId)}/comments?tab=actions`}><span><strong>处理 {pending} 条风险待办</strong><small>达人回复与删除处置</small></span><b>去处理 →</b></Link>
          <Link href={`/projects/${encodeURIComponent(projectId)}/content?tab=analysis`}><span><strong>复盘高热内容与切角</strong><small>阅读、互动与达人效率</small></span><b>看内容 →</b></Link>
          <Link href={`/projects/${encodeURIComponent(projectId)}/growth?tab=competitor`}><span><strong>对照竞品月报与搜索趋势</strong><small>使用已接入的品牌工作表</small></span><b>看竞品 →</b></Link>
        </div></div>
      </Section>
      {/* ===== 跨表整合：统一指标字典 ===== */}
      <details><summary>查看指标定义与口径说明</summary><Section tag="指标字典" title="统一指标定义与口径说明" tone="blue" hint="跨模块一致性保障">
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead><tr><th>指标名称</th><th>定义公式</th><th>数据来源</th><th>适用模块</th><th>注意事项</th></tr></thead>
            <tbody>
              {[
                { name: 'CTR（点击率）', formula: '点击量 / 展现量 × 100%', source: '聚光投放报表', module: 'Overview/日报', note: '信息流与搜索分开计算' },
                { name: 'CPUV（单次访问成本）', formula: '消耗 / 独立访客数(UV)', source: '小红盟/小红星报表', module: 'Overview/日报', note: '区分盟/星两个平台' },
                { name: 'CPE（单次互动成本）', formula: '达人采买费用 / 互动总量', source: '笔记库报价+互动数据', module: 'Overview/Content', note: '费用为笔记报价，非实际结算' },
                { name: '互动率', formula: '互动量 / 阅读量 × 100%', source: '笔记表现数据', module: 'Overview/Content', note: '互动=点赞+收藏+分享+评论' },
                { name: '计划达成率', formula: '实际消耗 / 当日计划消耗 × 100%', source: '周趋势底表', module: 'Overview/日报', note: '仅已填计划日期有效' },
                { name: '外显率', formula: '已外显评论数 / 供应商交付总数 × 100%', source: '评论区执行数据', module: 'Comments/执行总览', note: '区分原文一致与改写外显' },
                { name: '闭环率', formula: '已闭环风险评论数 / 风险评论总数 × 100%', source: '评论处置actions', module: 'Comments/执行总览', note: '闭环=达人回复/删除下架/自然消失' },
                { name: '篇均互动', formula: '互动总量 / 有互动数据的笔记数', source: '笔记表现数据', module: 'Content/Growth', note: '仅使用已提供互动的笔记' },
                { name: '搜索指数', formula: '灵犀/聚光平台品牌搜索热度值', source: '站内搜索指数表', module: 'Growth/竞品分析', note: '灵犀=官方大盘，聚光=商业搜索' },
                { name: '采买金额', formula: 'Σ笔记报价(notePrice)', source: '笔记库', module: 'Overview/Content', note: '按达人层级聚合，报价非结算' },
              ].map((row, i) => (
                <tr key={i}>
                  <td><strong>{row.name}</strong></td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{row.formula}</td>
                  <td>{row.source}</td>
                  <td>{row.module}</td>
                  <td style={{ color: '#64748b', fontSize: 12 }}>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="metric-note" style={{ marginTop: 10 }}>以上指标口径在 Overview、Content、Comments、Growth 四大模块中保持一致。新增看板时必须遵循本字典定义，确保跨模块数据可比。</p>
      </Section></details>
    </div>}

    {tab === 'daily' && <div className="overview-block-content">
      <div className="reference-date-toolbar"><div><span className="section-mini-tag tag-blue">分析层 · 日报数据</span><small>选择日期后，指标与趋势一起更新</small></div><div className="reference-date-controls"><button onClick={() => stepDate(-1)} disabled={!date || date === rows[0]?.date} aria-label="前一个数据日期">←</button><label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>日报日期 <CustomSelect value={date} onChange={setSelected} options={[...rows].reverse().map(r => ({ value: String(r.date), label: `${String(r.date)}${String(r.date) === String(rows.at(-1)?.date) ? ' (最新)' : ''}` }))} /></label><button onClick={() => stepDate(1)} disabled={!date || date === rows.at(-1)?.date} aria-label="后一个数据日期">→</button><button onClick={() => setSelected('')}>最新日期</button></div></div>
      {!daily ? <EmptyState title="尚无日度投放数据" text="同步现有飞书数据源后查看日报。" /> : <>
        <div className="reference-daily-grid">{dailyCards.map(item => {
          const currentValue = finiteMetric(daily[item.key]);
          const previousValue = finiteMetric(previous?.[item.key]);
          const delta = currentValue !== null && previousValue !== null && previousValue !== 0 ? (currentValue - previousValue) / Math.abs(previousValue) * 100 : null;
          const spark = quarterRows.slice(-14).map(r => finiteMetric(r[item.key]));
          return <article className={`pastel-card pastel-${item.tone} reference-kpi`} key={item.key}><div className="stat-head"><span>{item.title}</span><span className={`section-mini-tag tag-${item.tone}`}>日报</span></div><div className="stat-value">{amount(currentValue)}<small> {item.unit}</small></div><div className="reference-kpi-meta">{item.desc}</div><div className="reference-kpi-delta">{delta === null ? '暂无可比前期' : `较前一数据日 ${delta >= 0 ? '+' : ''}${amount(delta)}%`}</div>{spark.every(v => v !== null) && <Sparkline data={spark as number[]} color={item.tone === 'purple' ? colors[2] : colors[0]} />}</article>;
        })}</div>
        <div className="workspace-two-col"><Section tag="消耗趋势" title="近30个数据日 · 计划与实际"><TimeSeriesChart rows={recent} title="计划与实际消耗" unit="元" series={[{ key: 'plan_spend', label: '计划', color: '#94a3b8' }, { key: 'actual_spend', label: '实际', color: colors[0] }]} /></Section><Section tag="CTR趋势" title="信息流与搜索 · 点击效率" tone="teal"><TimeSeriesChart rows={recent} title="信息流与搜索CTR" unit="%" series={[{ key: 'feed_ctr', label: '信息流', color: '#0d9488' }, { key: 'search_ctr', label: '搜索', color: colors[2] }]} /></Section></div>
        <div className="workspace-two-col" style={{ marginTop: 14 }}><Section tag="CPUV趋势" title="小红盟 / 小红星 · UV成本趋势" tone="amber"><TimeSeriesChart rows={recent} title="CPUV 周趋势" unit="元" series={[{ key: 'xhm_cpuv', label: '小红盟 CPUV', color: '#f59e0b' }, { key: 'xhx_cpuv', label: '小红星 CPUV', color: '#ea580c' }]} /></Section><Section tag="效率对比" title="核心效率指标 · 当日 vs 前一日" tone="purple">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 550, overflowY: 'auto' }}>
            {([
              { label: '信息流 CTR', current: finiteMetric(daily?.feed_ctr), prev: finiteMetric(previous?.feed_ctr), unit: '%', tone: 'teal' as const, benchmark: null as number | null, lowerIsBetter: false },
              { label: '搜索 CTR', current: finiteMetric(daily?.search_ctr), prev: finiteMetric(previous?.search_ctr), unit: '%', tone: 'purple' as const, benchmark: null as number | null, lowerIsBetter: false },
              { label: '小红盟 CPUV', current: finiteMetric(daily?.xhm_cpuv), prev: finiteMetric(previous?.xhm_cpuv), unit: '元', tone: 'amber' as const, benchmark: null as number | null, lowerIsBetter: true },
              { label: '小红星 CPUV', current: finiteMetric(daily?.xhx_cpuv), prev: finiteMetric(previous?.xhx_cpuv), unit: '元', tone: 'orange' as const, benchmark: null as number | null, lowerIsBetter: true },
            ] as Array<{ label: string; current: number | null; prev: number | null; unit: string; tone: string; benchmark: number | null; lowerIsBetter: boolean }>).map(item => {
              const delta = item.current !== null && item.prev !== null && item.prev !== 0 ? (item.current - item.prev) / Math.abs(item.prev) * 100 : null;
              const isGood = delta === null ? null : item.lowerIsBetter ? delta <= 0 : delta >= 0;
              const meetsBench = item.benchmark === null || item.current === null ? null : item.lowerIsBetter ? item.current <= item.benchmark : item.current >= item.benchmark;
              return (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.tone === 'teal' ? '#0d9488' : item.tone === 'purple' ? '#7c3aed' : item.tone === 'amber' ? '#f59e0b' : '#ea580c' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{item.label}</span>
                    {item.benchmark !== null && <span style={{ fontSize: 10.5, color: meetsBench ? '#16a34a' : '#dc2626', background: meetsBench ? '#f0fdf4' : '#fef2f2', padding: '2px 6px', borderRadius: 4 }}>基准 {item.benchmark}{item.unit}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                    <strong style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{item.current === null ? '—' : amount(item.current)}<small style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}> {item.unit}</small></strong>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: delta === null ? '#94a3b8' : isGood ? '#16a34a' : '#dc2626' }}>{delta === null ? '无前期对比' : `${delta >= 0 ? '+' : ''}${amount(delta)}%`}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Section></div>
        <p className="reference-note">投流消耗优先使用周投放表 F+S；聚光全量当日消耗 ¥{amount(daily.ads_spend)}，CTR、互动来自聚光全量样本，两者范围不同。缺失值显示 —。</p>
      </>}
    </div>}

    <Section tag="AI 复盘" title="基于项目数据生成运营报告" tone="purple"><div className="report-prompt"><textarea aria-label="报告需求" value={prompt} onChange={e => setPrompt(e.target.value)} /><button className="primary-btn" onClick={generate} disabled={busy || !prompt.trim()}>{busy ? '正在生成…' : '生成复盘报告'}</button></div>{error && <p role="alert">{error}</p>}{report && <Link href={`/api/report-html?id=${encodeURIComponent(report)}&projectId=${encodeURIComponent(projectId)}`} target="_blank">查看生成报告 →</Link>}</Section>
  </div>;
}
