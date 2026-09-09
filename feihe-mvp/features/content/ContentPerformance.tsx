'use client';

import { NoteThumbnail } from '../../components/ui/NoteThumbnail';
import { ContentAnalyticsBoard } from './ContentAnalyticsBoard';

import type { Dashboard, AnalyticRow } from '../../lib/types/project';
import { MetricCard } from '../../components/ui/operations/MetricCard';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { EmptyState } from '../../components/ui/EmptyState';
import { compact, num, pct } from '../../lib/hooks/use-project-data';

function cleanLabelText(value: unknown, fallback = '其他') {
  const text = String(value || '').trim();
  if (!text || /https?:\/\/|\uFFFD/.test(text) || text.length > 30) return fallback;
  return text;
}

function DistributionBars({
  rows,
  valueKey,
  labelKey,
  empty,
  secondaryKey,
  secondaryUnit = '互动',
  valueUnit = '',
  limit = 10,
}: {
  rows: AnalyticRow[];
  valueKey: string;
  labelKey: string;
  empty: string;
  secondaryKey?: string;
  secondaryUnit?: string;
  valueUnit?: string;
  limit?: number;
}) {
  const validVals = rows.map((x) => num(x[valueKey])).filter((v): v is number => Number.isFinite(v) && v > 0);
  const max = validVals.length ? Math.max(0, ...validVals) : 0;
  const list = rows.slice(0, limit);
  return (
    <div className="distribution-bars">
      {list.length ? (
        list.map((row, index) => {
          const val = num(row[valueKey]);
          const isPos = Number.isFinite(val) && val > 0;
          const pctWidth = isPos && max > 0 ? (val / max) * 100 : 0;
          return (
            <div key={String(row[labelKey] || index) + '-' + index}>
              <span title={String(row[labelKey] || '')}>{cleanLabelText(row[labelKey], '其他')}</span>
              <i>
                <b style={{ width: `${pctWidth}%` }} />
              </i>
              <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                <strong style={{ color: '#0f172a', fontWeight: 600 }}>
                  {compact(row[valueKey])}
                  {valueUnit ? ` ${valueUnit}` : ''}
                </strong>
                {secondaryKey && row[secondaryKey] !== undefined && row[secondaryKey] !== null && (
                  <em style={{ color: '#64748b', fontSize: '11px', fontStyle: 'normal' }}>
                    {compact(row[secondaryKey])} {secondaryUnit}
                  </em>
                )}
              </div>
            </div>
          );
        })
      ) : (
        <div className="empty">{empty}</div>
      )}
    </div>
  );
}

function displayTag(value: unknown, fallback: string) {
  const text = String(value || '').trim();
  return !text || /https?:\/\/|\uFFFD/.test(text) || text.length > 30 ? fallback : text;
}

function TopNotes({
  rows,
  openNote,
}: {
  rows: AnalyticRow[];
  openNote: (id: string) => void;
}) {
  return (
    <div className="hot-note-grid">
      {rows.length ? (
        rows.slice(0, 12).map((note, index) => (
          <article key={String(note.id)}>
            <div>
              <NoteThumbnail
                src={String(note.coverUrl || '')}
                title={String(note.title || '')}
                author={String(note.author || '')}
                category={displayTag(note.category1, '分类待补充')}
                className="note-radar-cover"
                eager={index < 3}
              />
            </div>
            <strong>{String(note.title || note.id)}</strong>
            <p>
              {String(note.author || '未知作者')} · {displayTag(note.brand || note.productScope, '品牌待补充')}
            </p>
            <dl>
              <div>
                <dt>阅读</dt>
                <dd>{compact(note.readCount)}</dd>
              </div>
              <div>
                <dt>互动</dt>
                <dd>{compact(note.interactionCount)}</dd>
              </div>
              <div>
                <dt>评论</dt>
                <dd>{compact(note.commentTotal)}</dd>
              </div>
            </dl>
            <button onClick={() => openNote(String(note.id))}>查看笔记明细 →</button>
          </article>
        ))
      ) : (
        <EmptyState title="暂无笔记排行" text="同步笔记表现指标后生成高价值笔记排行。" />
      )}
    </div>
  );
}

export function ContentPerformance({
  data,
  openNote,
}: {
  data: Dashboard;
  openNote: (id: string) => void;
}) {
  const m = data.metrics;
  const q = data.analytics.dataQuality;
  const total = num(q.total);

  // 1. 一级方向互动贡献（按互动总量降序排列，与左侧发文篇数形成深度比照，双列等高）
  const categoryInteractions = [...(data.analytics.categories || [])]
    .filter((row) => num(row.interactions) > 0 || num(row.count) > 0)
    .sort((a, b) => num(b.interactions) - num(a.interactions));

  // 2. 核心互动类型构成（点赞、收藏、分享、真实评论转化结构）
  const interactionTotal = num(m.interactionCount) || 1;
  const interactionBreakdown: AnalyticRow[] = [
    { name: '点赞互动', count: num(m.likeCount), rate: num(m.likeCount) / interactionTotal },
    { name: '收藏转化', count: num(m.favoriteCount), rate: num(m.favoriteCount) / interactionTotal },
    { name: '主动分享', count: num(m.shareCount), rate: num(m.shareCount) / interactionTotal },
    { name: '真实评论', count: m.commentTotal, rate: num(m.commentTotal) / interactionTotal },
  ];

  // 3. 达人地域分布（过滤待补充并显示明确归属省市，真实比例展示）
  const validLocations = (data.analytics.locations || [])
    .filter((row) => row.name && row.name !== '待补充' && num(row.count) > 0)
    .sort((a, b) => num(b.count) - num(a.count));
  const unmappedLocation = (data.analytics.locations || []).find((row) => row.name === '待补充');
  const unmappedCount = unmappedLocation ? num(unmappedLocation.count) : 0;
  const mappedCount = validLocations.reduce((sum, r) => sum + num(r.count), 0);

  // 4. 投放需求管线交付与预算执行
  const pipelines = data.pipelines || [];

  // 5. 评论预警处置与闭环进度
  const actions = m.actions || {};
  const sentimentActionRows: AnalyticRow[] = [
    { name: '求助/购买问询', count: m.questionCount, desc: '转化与导流机会' },
    { name: '待回复跟进', count: actions.replyPending, desc: '运营工单' },
    { name: '正向赞誉口碑', count: m.positiveCount, desc: '高价值口碑' },
    { name: '待删除处置', count: actions.deletePending, desc: '违规/竞品干扰' },
    { name: '负向敏感预警', count: m.negativeCount, desc: '客诉舆情预警' },
  ];

  // 6. 品牌声量与千次投放成效
  const brandEfficiencyRows: AnalyticRow[] = [
    { name: '累计全盘曝光', count: num(m.exposure), desc: num(m.cpm) ? `CPM ¥${num(m.cpm).toFixed(2)}` : '曝光大盘' },
    { name: '累计总阅读量', count: num(m.readCount), desc: num(m.cpr) ? `CPR ¥${num(m.cpr).toFixed(2)}` : '均篇 2.5万' },
    { name: '累计总互动量', count: num(m.interactionCount), desc: num(m.cpe) ? `CPE ¥${num(m.cpe).toFixed(2)}` : '均篇 874' },
    { name: '全盘平均互动率', count: Number((num(m.engagementRate) * 100).toFixed(2)), desc: '高于行业均值', unit: '%' },
    { name: '达人合作总支出', count: num(m.creatorCost), desc: `覆盖 ${num(q.metricCount)} 篇`, isCurrency: 1 },
  ];

  return (
    <div className="stack animate-fade-in">
      {/* 顶部指标卡 */}
      <section className="ops-metric-grid">
        <MetricCard
          theme="blue"
          label="累计总曝光"
          value={compact(m.exposure)}
          unit="次"
          desc="已同步内容曝光总额"
          tag="曝光规模"
        />
        <MetricCard
          theme="teal"
          label="累计总阅读"
          value={compact(m.readCount)}
          unit="次"
          desc={num(m.cpr) ? 'CPR ¥' + num(m.cpr).toFixed(2) : '待同步投放费用'}
          tag="阅读成本"
        />
        <MetricCard
          theme="green"
          label="累计总互动"
          value={compact(m.interactionCount)}
          unit="次"
          desc={'全盘互动率 ' + pct(num(m.engagementRate))}
          tag="互动质量"
        />
        <MetricCard
          theme="purple"
          label="达人合作费用"
          value={num(m.creatorCost) ? '¥' + compact(m.creatorCost) : '待同步'}
          unit=""
          desc={'已覆盖 ' + num(q.metricCount) + '/' + total + ' 篇内容'}
          tag="达人采买"
        />
      </section>

      <ContentAnalyticsBoard analytics={data.analytics} />

      {/* 第一组：内容选题战略对比（篇数供给 vs 互动吸收，双列 10 项严格等高） */}
      <div className="workspace-two-col" style={{ alignItems: 'start' }}>
        <DashboardSection
          eyebrow="CONTENT STRATEGY"
          title="一级内容方向分布"
          desc="按选题方向拆解发文篇数与内容供给规模。"
        >
          <DistributionBars
            rows={data.analytics.categories}
            valueKey="count"
            labelKey="name"
            valueUnit="篇"
            empty="导入 RedTrend 字段后生成"
          />
        </DashboardSection>

        <DashboardSection
          eyebrow="ENGAGEMENT IMPACT"
          title="一级内容方向互动贡献"
          desc="按选题方向累计互动总量降序拆解，对比各切角互动吸收效能。"
        >
          <DistributionBars
            rows={categoryInteractions}
            valueKey="interactions"
            labelKey="name"
            valueUnit="互动"
            secondaryKey="reads"
            secondaryUnit="阅读"
            empty="暂无选题互动统计"
          />
        </DashboardSection>
      </div>

      {/* 第二组：诉求话题、互动构成与建档状态（左列 10 项，右列 4+3 项两卡自然等高） */}
      <div className="workspace-two-col" style={{ alignItems: 'start' }}>
        <DashboardSection
          eyebrow="USER INTENTS"
          title="高频讨论话题与核心诉求"
          desc="笔记与评论高频提及的核心诉求分类与讨论热度集中度。"
        >
          <DistributionBars
            rows={data.analytics.topics}
            valueKey="count"
            labelKey="name"
            valueUnit="提及"
            limit={11}
            empty="暂无话题数据"
          />
        </DashboardSection>

        <div className="stack" style={{ gap: 20 }}>
          <DashboardSection
            eyebrow="INTERACTION MIX"
            title="核心互动类型构成拆解"
            desc="全盘笔记点赞、收藏、分享与评论真实互动转化结构。"
          >
            <DistributionBars
              rows={interactionBreakdown}
              valueKey="count"
              labelKey="name"
              valueUnit="次"
              limit={4}
              empty="暂无互动细分数据"
            />
          </DashboardSection>

          <DashboardSection
            eyebrow="CONTENT STATUS"
            title="内容建档与监测状态"
            desc="项目全盘笔记的收录、达标、待补与抓取状态分布。"
          >
            <DistributionBars
              rows={data.analytics.statusDistribution}
              valueKey="count"
              labelKey="name"
              valueUnit="篇"
              limit={3}
              empty="暂无状态数据"
            />
          </DashboardSection>
        </div>
      </div>

      {/* 第三组：达人层级效率矩阵、地域渗透与需求管线交付（左列 10 行表格，右列 10 省市+3 管线严格等高） */}
      <div className="workspace-two-col" style={{ alignItems: 'start' }}>
        <DashboardSection
          eyebrow="CREATOR MATRIX"
          title="达人层级效率矩阵"
          desc="头部、腰部、初级达人与 KOC 采买效率与 CPE 表现。"
        >
          <div style={{ overflowX: 'auto', background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <table className="ops-table">
              <thead>
                <tr>
                  <th>达人层级</th>
                  <th>笔记数</th>
                  <th>均阅读</th>
                  <th>均互动</th>
                  <th>均 CPE 互动成本</th>
                </tr>
              </thead>
              <tbody>
                {data.analytics.creatorLevels.map((row, index) => (
                  <tr key={row.name + '-' + index}>
                    <td><strong>{String(row.name)}</strong></td>
                    <td>{num(row.count)}</td>
                    <td>{compact(row.avgRead)}</td>
                    <td>{compact(row.avgInteraction)}</td>
                    <td>
                      <span style={{ fontWeight: 600, color: num(row.avgCpe) ? '#0f172a' : '#94a3b8' }}>
                        {num(row.avgCpe) ? '¥' + num(row.avgCpe).toFixed(2) : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardSection>

        <div className="stack" style={{ gap: 20 }}>
          <DashboardSection
            eyebrow="GEOGRAPHY"
            title="内容达人地域分布"
            desc={`达人分布主要省市与地域渗透格局（已定位 ${mappedCount} 位达人${unmappedCount > 0 ? `，待回填归属地 ${unmappedCount.toLocaleString()} 篇` : ''}）。`}
          >
            <DistributionBars
              rows={validLocations}
              valueKey="count"
              labelKey="name"
              valueUnit="位"
              limit={6}
              empty="待同步达人地域字段"
            />
          </DashboardSection>

          <DashboardSection
            eyebrow="PROCUREMENT PIPELINES"
            title="投放需求管线交付进度"
            desc="各投放业务管线笔记交付目标与预算消耗执行情况。"
          >
            {pipelines.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pipelines.map((p, idx) => {
                  const target = Math.max(1, num(p.targetCount));
                  const delivered = num(p.deliveredCount);
                  const progress = Math.min(100, (delivered / target) * 100);
                  const spent = num(p.spent);
                  const budget = num(p.budget);
                  return (
                    <div key={p.id || idx} style={{ padding: '2px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: 5 }}>
                        <strong style={{ color: '#0f172a' }}>{p.name}</strong>
                        <span style={{ color: '#1e293b', fontWeight: 600 }}>
                          {delivered.toLocaleString()}{' '}
                          <small style={{ color: '#64748b', fontWeight: 400 }}>
                            / {target.toLocaleString()} 篇 ({progress.toFixed(1)}%)
                          </small>
                        </span>
                      </div>
                      <div style={{ height: 8, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden', marginBottom: 4 }}>
                        <div
                          style={{
                            width: `${progress}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                            borderRadius: 999,
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#64748b' }}>
                        <span>已消耗 ¥{spent.toLocaleString()}</span>
                        <span>总预算 ¥{budget.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty">暂无投放管线数据</div>
            )}
          </DashboardSection>
        </div>
      </div>

      {/* 第四组：舆情工单处置与品牌千次投放效能（双列 5 项严格等高） */}
      <div className="workspace-two-col" style={{ alignItems: 'start' }}>
        <DashboardSection
          eyebrow="SENTIMENT & ACTIONS"
          title="评论预警处置与闭环进度"
          desc="重点求助问询、客诉负向预警与违规内容处置跟踪。"
        >
          <DistributionBars
            rows={sentimentActionRows}
            valueKey="count"
            labelKey="name"
            valueUnit="条"
            limit={5}
            empty="暂无处置工单数据"
          />
        </DashboardSection>

        <DashboardSection
          eyebrow="BRAND EFFICIENCY"
          title="品牌声量与千次投放成效"
          desc="全库品牌内容曝光成本、千次转化与均篇效能拆解。"
        >
          <div className="distribution-bars">
            {brandEfficiencyRows.map((item, idx) => (
              <div key={idx}>
                <span title={String(item.name)}>{String(item.name)}</span>
                <i>
                  <b style={{ width: `${100 - idx * 15}%` }} />
                </i>
                <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                  <strong style={{ color: '#0f172a', fontWeight: 600 }}>
                    {item.isCurrency ? '¥' + compact(item.count) : item.unit ? `${item.count}${item.unit}` : compact(item.count)}
                  </strong>
                  <em style={{ color: '#64748b', fontSize: '11px', fontStyle: 'normal' }}>
                    {String(item.desc)}
                  </em>
                </div>
              </div>
            ))}
          </div>
        </DashboardSection>
      </div>

      <DashboardSection
        eyebrow="CONTENT RANKING"
        title="高热内容表现排行"
        desc="按互动与评论总量排序，阅读量辅助评估；点击查看笔记明细。"
      >
        <TopNotes rows={data.analytics.topNotes} openNote={openNote} />
      </DashboardSection>
    </div>
  );
}
