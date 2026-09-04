'use client';

import Link from '../../components/ui/AppLink';
import type { Dashboard, AnalyticRow } from '../../lib/types/project';
import { PanelHead } from '../../components/ui/PanelHead';
import { EmptyState } from '../../components/ui/EmptyState';
import { compact, num, pct } from '../../lib/hooks/use-project-data';

function TrendChart({ data, multi = false }: { data: AnalyticRow[]; multi?: boolean }) {
  if (!data.length) return <EmptyState title="完成至少两轮评论抓取后生成趋势" />;
  const width = 760;
  const height = 220;
  const pad = 28;
  const max = Math.max(1, ...data.map((x) => num(x.total)));
  const points = (key: string) =>
    data
      .map(
        (row, index) =>
          (pad + (index * (width - pad * 2)) / Math.max(1, data.length - 1)) +
          ',' +
          (height - pad - (num(row[key]) / max) * (height - pad * 2))
      )
      .join(' ');

  return (
    <div className="trend-wrap">
      <svg viewBox={'0 0 ' + width + ' ' + height} role="img" aria-label="评论声量趋势">
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2e7be7" stopOpacity=".24" />
            <stop offset="1" stopColor="#2e7be7" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <line
            key={v}
            x1={pad}
            x2={width - pad}
            y1={pad + v * (height - pad * 2)}
            y2={pad + v * (height - pad * 2)}
            stroke="#edf1f6"
          />
        ))}
        <polyline
          points={points('total')}
          fill="none"
          stroke="#176be0"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {multi && (
          <>
            <polyline
              points={points('positive')}
              fill="none"
              stroke="#4aa487"
              strokeWidth="2"
            />
            <polyline
              points={points('negative')}
              fill="none"
              stroke="#e25760"
              strokeWidth="2"
            />
            <polyline
              points={points('question')}
              fill="none"
              stroke="#eba329"
              strokeWidth="2"
            />
          </>
        )}
      </svg>
      <div className="trend-axis">
        <span>{String(data[0].date)}</span>
        <span>{String(data.at(-1)?.date)}</span>
      </div>
      <div className="trend-legend">
        <i className="total" />总评论
        {multi && (
          <>
            <i className="pos" />正向
            <i className="neg" />负向
            <i className="que" />问询
          </>
        )}
      </div>
    </div>
  );
}

function DistributionBars({
  rows,
  valueKey,
  labelKey,
  empty,
}: {
  rows: AnalyticRow[];
  valueKey: string;
  labelKey: string;
  empty: string;
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
          </div>
        ))
      ) : (
        <div className="empty">{empty}</div>
      )}
    </div>
  );
}

function ActionSummary({ actions }: { actions: Record<string, number> }) {
  const total = Math.max(1, num(actions.total));
  return (
    <div className="action-summary">
      <div>
        <strong>{pct(num(actions.handled) / total)}</strong>
        <span>整体闭环率</span>
      </div>
      <dl>
        <div>
          <dt>已处理</dt>
          <dd>{num(actions.handled)}</dd>
        </div>
        <div>
          <dt>待达人回复</dt>
          <dd>{num(actions.replyPending)}</dd>
        </div>
        <div>
          <dt>待删除</dt>
          <dd>{num(actions.deletePending)}</dd>
        </div>
        <div>
          <dt>已消失</dt>
          <dd>{num(actions.disappeared)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function VoiceIntelligence({
  data,
  projectId,
}: {
  data: Dashboard;
  projectId: string;
}) {
  const m = data.metrics;
  const total = Math.max(1, m.commentTotal);
  const topPositive = data.analytics.topics.find((x) => x.sentiment === '正向');
  const topNegative = data.analytics.topics.find((x) => x.sentiment === '负向');

  return (
    <div className="stack">
      <section className="voice-hero">
        <article className="panel sentiment-panel">
          <PanelHead eyebrow="SENTIMENT" title="消费者反馈结构" />
          <div className="sentiment-body">
            <div
              className="donut"
              style={{
                background:
                  'conic-gradient(#176ae3 0 ' +
                  m.positiveRate * 100 +
                  '%,#93a3ba ' +
                  m.positiveRate * 100 +
                  '% ' +
                  (m.positiveRate + num(m.neutralCount) / total) * 100 +
                  '%,#efa31e ' +
                  (m.positiveRate + num(m.neutralCount) / total) * 100 +
                  '% ' +
                  (m.positiveRate + num(m.neutralCount) / total + m.questionRate) * 100 +
                  '%,#ef5258 0)',
              }}
            >
              <div>
                <strong>{pct(m.positiveRate)}</strong>
                <span>正向口碑</span>
              </div>
            </div>
            <dl>
              {[
                ['正向', m.positiveCount, 'positive'],
                ['中立', num(m.neutralCount), 'neutral'],
                ['问询', m.questionCount, 'ask'],
                ['负向', m.negativeCount, 'negative'],
              ].map(([label, value, cls]) => (
                <div key={String(label)}>
                  <dt>
                    <i className={'legend ' + cls} />
                    {label}
                  </dt>
                  <dd>{compact(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </article>

        <article className="panel span-2">
          <PanelHead eyebrow="VOICE TREND" title="正向 / 负向 / 问询变化" />
          <TrendChart data={data.analytics.trend} multi />
        </article>
      </section>

      <section className="content-layout">
        <article className="panel">
          <PanelHead eyebrow="TOPIC TAXONOMY" title="动态话题分类" />
          <DistributionBars
            rows={data.analytics.topics}
            valueKey="count"
            labelKey="name"
            empty="暂无关键评论主题"
          />
        </article>

        <article className="panel">
          <PanelHead eyebrow="VOICE OF CUSTOMER" title="口碑结论" />
          <ul className="insight-list">
            <li>
              <b>核心正向</b>
              <span>
                {topPositive
                  ? '“' + String(topPositive.name) + '”是当前最集中的正向体验，共 ' + num(topPositive.count) + ' 条。'
                  : '正向样本积累后自动识别真实体验主题。'}
              </span>
            </li>
            <li>
              <b>问题焦点</b>
              <span>
                {topNegative
                  ? '“' + String(topNegative.name) + '”是当前首要风险主题，共 ' + num(topNegative.count) + ' 条。'
                  : '当前尚未形成可识别的集中负向主题。'}
              </span>
            </li>
            <li>
              <b>购买决策</b>
              <span>
                问询占 {pct(m.questionRate)}，建议按产品体验、使用效果与价格服务分流承接。
              </span>
            </li>
          </ul>
          <Link
            className="primary wide panel-cta"
            href={'/projects/' + encodeURIComponent(projectId) + '/comments?tab=risk'}
            style={{ textAlign: 'center', textDecoration: 'none', display: 'block', marginTop: '16px' }}
          >
            查看评论原文与处置
          </Link>
        </article>

        <article className="panel">
          <PanelHead eyebrow="ACTION SLA" title="风险闭环" />
          <ActionSummary actions={m.actions} />
        </article>
      </section>
    </div>
  );
}
