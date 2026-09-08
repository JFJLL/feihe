'use client';

import { useState, type ReactNode } from 'react';
import Link from '../../components/ui/AppLink';
import type { Dashboard, Ops, Project } from '../../lib/types/project';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { FeishuSources, SyncButton } from '../../components/ui/FeishuSources';
import { WorkspaceModuleTabs } from '../../components/ui/operations/WorkspaceModuleTabs';
import { TimeSeriesChart } from '../../components/ui/TimeSeriesChart';
import { HorizontalBarList, TierDoughnutChart, Sparkline } from './OverviewCharts';
import { api, compact, num } from '../../lib/hooks/use-project-data';
import { useProjectTab } from '../../lib/hooks/useProjectTab';
import { overviewPeriod, sumMetric, finiteMetric, matchedBudget } from './overview-view-model';

const amount = (value: unknown) => finiteMetric(value)?.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) ?? '—';
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
  const tierItems = creatorRows.map((r, i) => ({ label: String(r.name || '未标注'), count: num(r.count), pct: creatorTotal ? num(r.count) / creatorTotal * 100 : 0, color: colors[i % colors.length] }));
  const formatRows = dashboard.analytics.formats || [];
  const formatTotal = formatRows.reduce((sum, r) => sum + num(r.count), 0);
  const recent = quarterRows.slice(-30).map(r => ({ ...r, date: String(r.date) }));
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
        <div className="health-card-head"><span className="section-mini-tag tag-blue">决策层 · 今日健康度总览</span><span className="health-date-hint">投放 {date || '待同步'} · 笔记 {latestNoteDate || '待同步'}</span></div>
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
          { title: `${Number(date.slice(5, 7))}月当月 · 截至${monthDay}日`, spend: monthSpend, budget: monthBudget, time: monthDay / monthDays * 100, days: `${monthDay}/${monthDays}`, tone: 'blue', count: monthRows.length },
          { title: `Q3 累计 · 7月1日—${date.slice(5)}`, spend: quarterSpend, budget: quarterBudget, time: quarterDay / 92 * 100, days: `${quarterDay}/92`, tone: 'purple', count: quarterRows.length },
        ].map(item => <div key={item.title} className={`budget-sub-card pastel-${item.tone}`}>
          <div className="sub-card-title"><strong>{item.title}</strong></div>
          <Progress label={`时间进度（${item.days} 天）`} value={item.time} tone="gray" />
          <Progress label="同日期 · 消耗 / 计划" value={item.budget.plan && item.budget.spend !== null ? item.budget.spend / item.budget.plan * 100 : null} tone={item.tone} detail={`${item.budget.count} 个可比日期 · 实际 ¥${amount(item.budget.spend)} / 计划 ¥${amount(item.budget.plan)}`} />
          <div className="budget-diff-box"><span className="diff-val">{item.spend === null ? '—' : `¥${compact(item.spend)}`}</span><span className="diff-desc">覆盖 {item.count} 个有投放数据的日期</span></div>
        </div>)}</div> : <EmptyState title="等待投放数据" text="点击同步最新数据后展示月度与季度进度。" />}
        <div className="budget-footer-notes">计划为已填日期的预算合计，并非完整月度或季度预算。时间进度按自然日计算。</div>
      </Section>

      <Section tag="一、投流效率" title="KFS 投流与采买结构" tone="teal" hint="投流与达人采买分开展示">
        <div className="two-col-chart-grid">
          <div className="chart-inner-panel"><div className="inner-head"><strong>信息流 / 搜索投流结构</strong><small>Q3 已同步日期</small></div>
            {channelTotal ? <HorizontalBarList items={[{ label: '信息流 F', amount: num(feedSpend), pct: num(feedSpend) / channelTotal * 100, color: colors[0], subText: `¥${amount(feedSpend)}` }, { label: '搜索 S', amount: num(searchSpend), pct: num(searchSpend) / channelTotal * 100, color: colors[2], subText: `¥${amount(searchSpend)}` }]} /> : <EmptyState title="暂无投流结构" text="同步已填写的信息流与搜索消耗后显示。" />}
          </div>
          <div className="chart-inner-panel"><div className="inner-head"><strong>达人 K · 内容采买</strong><small>项目笔记报价合计</small></div><div className="reference-big-number">¥{compact(m.creatorCost)}</div><div className="reference-stat-pair"><span>商业合作笔记<strong>{num(m.commercialCount)} 篇</strong></span><span>内容平均 CPE<strong>¥{amount(m.cpe)}</strong></span></div><p className="reference-note">使用笔记库已有报价与互动表现；采买费用与投流消耗为不同口径。</p></div>
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
        <div className="ops-table-wrap reference-content-detail"><table className="ops-table"><thead><tr><th>内容切角 / 场景</th><th>笔记数</th><th>阅读量</th><th>互动量</th><th>笔记分布</th></tr></thead><tbody>{dashboard.analytics.categories.slice(0, 8).map((r, i) => <tr key={`${r.name}-${i}`}><td>{String(r.name || '未标注')}</td><td>{num(r.count)}</td><td>{compact(r.reads)}</td><td>{compact(r.interactions)}</td><td><Progress label="占项目笔记" value={m.noteCount ? num(r.count) / m.noteCount * 100 : null} /></td></tr>)}</tbody></table></div>
      </Section>

      <Section tag="行动层" title="复盘洞察与下一步行动" tone="purple" hint="从数据直接进入运营">
        <div className="two-col-chart-grid"><div className="reference-learning"><strong>当前观察</strong><p>内容库共 {m.noteCount} 篇，累计互动 {compact(m.interactionCount)} 次。已标注的内容方向中，{String(dashboard.analytics.categories[0]?.name || '暂无方向')}收录最多。</p><p>当前真实评论快照合计 {m.commentTotal} 条，正向 {m.positiveCount} 条，负向 {m.negativeCount} 条。继续优先处理待回复和待删除事项。</p></div><div className="reference-actions">
          <Link href={`/projects/${encodeURIComponent(projectId)}/comments?tab=actions`}><span><strong>处理 {pending} 条风险待办</strong><small>达人回复与删除处置</small></span><b>去处理 →</b></Link>
          <Link href={`/projects/${encodeURIComponent(projectId)}/content?tab=analysis`}><span><strong>复盘高热内容与切角</strong><small>阅读、互动与达人效率</small></span><b>看内容 →</b></Link>
          <Link href={`/projects/${encodeURIComponent(projectId)}/growth?tab=competitor`}><span><strong>对照竞品月报与搜索趋势</strong><small>使用已接入的品牌工作表</small></span><b>看竞品 →</b></Link>
        </div></div>
      </Section>
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
        <p className="reference-note">投流消耗优先使用周投放表 F+S；聚光全量当日消耗 ¥{amount(daily.ads_spend)}，CTR、互动来自聚光全量样本，两者范围不同。缺失值显示 —。</p>
      </>}
    </div>}

    <Section tag="AI 复盘" title="基于项目数据生成运营报告" tone="purple"><div className="report-prompt"><textarea aria-label="报告需求" value={prompt} onChange={e => setPrompt(e.target.value)} /><button className="primary-btn" onClick={generate} disabled={busy || !prompt.trim()}>{busy ? '正在生成…' : '生成复盘报告'}</button></div>{error && <p role="alert">{error}</p>}{report && <Link href={`/api/report-html?id=${encodeURIComponent(report)}&projectId=${encodeURIComponent(projectId)}`} target="_blank">查看生成报告 →</Link>}</Section>
  </div>;
}
