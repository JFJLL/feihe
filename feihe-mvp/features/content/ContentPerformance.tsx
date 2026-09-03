'use client';

import type { Dashboard, AnalyticRow } from '../../lib/types/project';
import { PanelHead } from '../../components/ui/PanelHead';
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
              {note.coverUrl ? (
                <img src={String(note.coverUrl)} alt="" />
              ) : (
                <span>{String(note.author || '笔').slice(0, 1)}</span>
              )}
              <i>TOP {String(index + 1).padStart(2, '0')} · {String(note.category1 || note.creatorLevel || '笔记')}</i>
            </div>
            <strong>{String(note.title || note.id)}</strong>
            <p>
              {String(note.author || '未知作者')} · {String(note.brand || note.productScope || '本品')}
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
  const total = Math.max(1, num(q.total));

  return (
    <div className="stack">
      <section className="executive-kpis content-kpis">
        <article className="metric">
          <p>总曝光</p>
          <strong>{compact(m.exposure)}</strong>
          <span>已同步内容指标</span>
        </article>
        <article className="metric">
          <p>总阅读</p>
          <strong>{compact(m.readCount)}</strong>
          <span>{num(m.cpr) ? 'CPR ¥' + num(m.cpr).toFixed(2) : '待同步费用'}</span>
        </article>
        <article className="metric">
          <p>总互动</p>
          <strong>{compact(m.interactionCount)}</strong>
          <span>互动率 {pct(num(m.engagementRate))}</span>
        </article>
        <article className="metric">
          <p>达人费用</p>
          <strong>{num(m.creatorCost) ? '¥' + compact(m.creatorCost) : '待同步'}</strong>
          <span>
            覆盖 {num(q.metricCount)}/{total} 篇
          </span>
        </article>
        <article className="metric">
          <p>投流笔记</p>
          <strong>{num(m.promotedCount)}</strong>
          <span>占监测内容 {pct(num(m.promotedCount) / total)}</span>
        </article>
        <article className="metric">
          <p>商业合作</p>
          <strong>{num(m.commercialCount)}</strong>
          <span>占监测内容 {pct(num(m.commercialCount) / total)}</span>
        </article>
      </section>

      <section className="content-layout">
        <article className="panel">
          <PanelHead eyebrow="CONTENT STRATEGY" title="一级内容方向" />
          <DistributionBars
            rows={data.analytics.categories}
            valueKey="count"
            labelKey="name"
            empty="导入 RedTrend 字段后生成"
          />
        </article>

        <article className="panel">
          <PanelHead eyebrow="FORMAT MIX" title="内容形式与互动贡献" />
          <DistributionBars
            rows={data.analytics.formats}
            valueKey="count"
            labelKey="name"
            empty="待同步图文/视频字段"
            secondaryKey="interactions"
          />
        </article>

        <article className="panel">
          <PanelHead eyebrow="CREATOR EFFICIENCY" title="达人层级效率" />
          <div className="matrix-table">
            <div className="matrix-head">
              <span>达人层级</span>
              <span>笔记</span>
              <span>均阅读</span>
              <span>均互动</span>
              <span>均 CPE</span>
            </div>
            {data.analytics.creatorLevels.map((row, index) => (
              <div key={row.name + '-' + index}>
                <strong>{String(row.name)}</strong>
                <span>{num(row.count)}</span>
                <span>{compact(row.avgRead)}</span>
                <span>{compact(row.avgInteraction)}</span>
                <span>{num(row.avgCpe) ? '¥' + num(row.avgCpe).toFixed(2) : '—'}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <PanelHead eyebrow="GEOGRAPHY" title="内容达人地域" />
          <DistributionBars
            rows={data.analytics.locations}
            valueKey="count"
            labelKey="name"
            empty="待同步达人地域字段"
          />
        </article>
      </section>

      <article className="panel">
        <PanelHead
          eyebrow="CONTENT RANKING"
          title="内容表现明细"
          extra={<span className="subtle">互动、评论、效率三维排序</span>}
        />
        <TopNotes rows={data.analytics.topNotes} openNote={openNote} />
      </article>
    </div>
  );
}
