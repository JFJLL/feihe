'use client';

import type { Dashboard, AnalyticRow } from '../../lib/types/project';
import { PanelHead } from '../../components/ui/PanelHead';
import { EmptyState } from '../../components/ui/EmptyState';
import { compact, num, pct } from '../../lib/hooks/use-project-data';

function bestBrand(rows: AnalyticRow[], key: 'positive' | 'negative', inverse = false) {
  const valid = rows.filter((x) => num(x.comments) > 0);
  if (!valid.length) return '暂无足够评论样本。';
  const sorted = [...valid].sort(
    (a, b) => num(b[key]) / num(b.comments) - num(a[key]) / num(a.comments)
  );
  const row = sorted[0];
  return (
    String(row.brand) +
    ' 的' +
    (inverse ? '负向风险' : '正向口碑') +
    '占比最高，为 ' +
    pct(num(row[key]) / num(row.comments)) +
    '。'
  );
}

export function CompetitorAnalysis({ data }: { data: Dashboard }) {
  const brands = data.analytics.brands;
  const maxComments = Math.max(1, ...brands.map((x) => num(x.comments)));

  return (
    <div className="stack">
      <section className="panel">
        <PanelHead
          eyebrow="BRAND LANDSCAPE"
          title="品牌竞争格局"
          extra={<span className="subtle">声量 × 正向率 × 风险率 × 内容效率</span>}
        />
        <div className="brand-cards">
          {brands.slice(0, 4).map((row, index) => {
            const comments = num(row.comments);
            const positive = num(row.positive);
            const negative = num(row.negative);
            return (
              <article key={row.brand + '-' + index}>
                <i style={{ width: Math.max(8, (comments / maxComments) * 100) + '%' }} />
                <small>{String(row.brand)}</small>
                <strong>{compact(comments)}</strong>
                <p>
                  {num(row.notes)} 篇笔记 · {compact(row.interactions)} 互动
                </p>
                <div>
                  <span>正向 {comments ? pct(positive / comments) : '—'}</span>
                  <span>风险 {comments ? pct(negative / comments) : '—'}</span>
                </div>
              </article>
            );
          })}
          {!brands.length && (
            <EmptyState title="暂无竞品数据" text="关键词扫描后将自动生成品牌竞争格局。" />
          )}
        </div>
      </section>

      <section className="competitor-layout">
        <article className="panel span-2">
          <PanelHead eyebrow="CROSS BRAND" title="品牌横向对比" />
          <div className="brand-table">
            <div className="brand-th">
              <span>品牌/关键词</span>
              <span>笔记</span>
              <span>评论</span>
              <span>正向率</span>
              <span>负向率</span>
              <span>阅读</span>
              <span>互动</span>
              <span>费用</span>
            </div>
            {brands.map((row, index) => {
              const comments = num(row.comments);
              return (
                <div key={row.brand + '-' + index}>
                  <strong>{String(row.brand)}</strong>
                  <span>{num(row.notes)}</span>
                  <span>{compact(comments)}</span>
                  <span>{comments ? pct(num(row.positive) / comments) : '—'}</span>
                  <span className="risk-text">
                    {comments ? pct(num(row.negative) / comments) : '—'}
                  </span>
                  <span>{compact(row.reads)}</span>
                  <span>{compact(row.interactions)}</span>
                  <span>{num(row.cost) ? '¥' + compact(row.cost) : '—'}</span>
                </div>
              );
            })}
          </div>
        </article>

        <article className="panel">
          <PanelHead eyebrow="STRATEGY MAP" title="竞品策略解读" />
          <ul className="insight-list">
            <li>
              <b>声量领先</b>
              <span>
                {brands[0]
                  ? String(brands[0].brand) +
                    ' 当前覆盖 ' +
                    num(brands[0].notes) +
                    ' 篇、' +
                    compact(brands[0].comments) +
                    ' 条评论。'
                  : '扫描竞品关键词后生成。'}
              </span>
            </li>
            <li>
              <b>口碑优势</b>
              <span>{bestBrand(brands, 'positive')}</span>
            </li>
            <li>
              <b>风险机会</b>
              <span>{bestBrand(brands, 'negative', true)}</span>
            </li>
            <li>
              <b>下一步</b>
              <span>可继续下钻同品牌的内容方向、达人层级与原始笔记链接。</span>
            </li>
          </ul>
        </article>
      </section>
    </div>
  );
}
