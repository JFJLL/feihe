'use client';

import { NoteThumbnail } from '../../components/ui/NoteThumbnail';
import { ContentAnalyticsBoard } from './ContentAnalyticsBoard';

import type { Dashboard, AnalyticRow } from '../../lib/types/project';
import { MetricCard } from '../../components/ui/operations/MetricCard';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { EmptyState } from '../../components/ui/EmptyState';
import { compact, num, pct } from '../../lib/hooks/use-project-data';

function DistributionBars({
  rows,
  valueKey,
  labelKey,
  empty,
  secondaryKey,
}: {
  rows: AnalyticRow[];
  valueKey: string;
  labelKey: string;
  empty: string;
  secondaryKey?: string;
}) {
  const max = Math.max(1, ...rows.map((x) => num(x[valueKey])));
  return (
    <div className="distribution-bars">
      {rows.length ? (
        rows.slice(0, 10).map((row, index) => (
          <div key={row[labelKey] + '-' + index}>
            <span>{String(row[labelKey] || '待补充')}</span>
            <i>
              <b style={{ width: Math.max(3, (num(row[valueKey]) / max) * 100) + '%' }} />
            </i>
            <strong>{compact(row[valueKey])}</strong>
            {secondaryKey && <em>{compact(row[secondaryKey])} 互动</em>}
          </div>
        ))
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

      <div className="workspace-two-col">
        <DashboardSection
          eyebrow="CONTENT STRATEGY"
          title="一级内容方向分布"
          desc="按选题方向拆解笔记分布与讨论集中度。"
        >
          <DistributionBars
            rows={data.analytics.categories}
            valueKey="count"
            labelKey="name"
            empty="导入 RedTrend 字段后生成"
          />
        </DashboardSection>

        <DashboardSection
          eyebrow="FORMAT MIX"
          title="内容形式与互动贡献"
          desc="图文 vs 视频形式的内容分布与互动贡献拆解。"
        >
          <DistributionBars
            rows={data.analytics.formats}
            valueKey="count"
            labelKey="name"
            empty="待同步图文/视频字段"
            secondaryKey="interactions"
          />
        </DashboardSection>

        <DashboardSection
          eyebrow="CREATOR EFFICIENCY"
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

        <DashboardSection
          eyebrow="GEOGRAPHY"
          title="内容达人地域分布"
          desc="达人分布主要省市与地域渗透格局。"
        >
          <DistributionBars
            rows={data.analytics.locations}
            valueKey="count"
            labelKey="name"
            empty="待同步达人地域字段"
          />
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
