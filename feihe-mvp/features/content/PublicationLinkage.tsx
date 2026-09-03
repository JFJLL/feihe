'use client';

import type { Dashboard } from '../../lib/types/project';
import { PanelHead } from '../../components/ui/PanelHead';
import { EmptyState } from '../../components/ui/EmptyState';
import { compact, cnTime, num } from '../../lib/hooks/use-project-data';
import { isOwnedNote, noteDirection } from '../growth/KeywordRadar';

export function PublicationLinkage({
  data,
  openNote,
}: {
  data: Dashboard;
  openNote: (id: string) => void;
}) {
  const owned = data.notes.filter(isOwnedNote).sort((a, b) => {
    const scoreA = (num(a.commentTotal) * 10) + num(a.interactionCount) + num(a.readCount) + (a.title ? 100 : 0);
    const scoreB = (num(b.commentTotal) * 10) + num(b.interactionCount) + num(b.readCount) + (b.title ? 100 : 0);
    return scoreB - scoreA;
  });
  const natural = data.notes.filter((note) => !isOwnedNote(note));
  const directions = new Map<
    string,
    { owned: number; natural: number; interactions: number; comments: number }
  >();

  data.notes.forEach((note) => {
    const key = noteDirection(note);
    const row = directions.get(key) || { owned: 0, natural: 0, interactions: 0, comments: 0 };
    if (isOwnedNote(note)) row.owned += 1;
    else row.natural += 1;
    row.interactions += num(note.interactionCount);
    row.comments += num(note.commentTotal);
    directions.set(key, row);
  });

  const rows = [...directions.entries()].sort((a, b) => b[1].natural - a[1].natural);
  const opportunities = rows.filter(([, row]) => row.natural > row.owned).length;

  return (
    <div className="stack">
      <section className="linkage-kpis">
        <article>
          <small>自有 / 商业发布</small>
          <strong>{owned.length}</strong>
          <p>来自发布进度表与自有内容源</p>
        </article>
        <article>
          <small>自然内容样本</small>
          <strong>{natural.length}</strong>
          <p>关键词扫描与自然讨论</p>
        </article>
        <article>
          <small>方向缺口</small>
          <strong>{opportunities}</strong>
          <p>自然内容数高于自有发布的方向</p>
        </article>
        <article>
          <small>自然样本互动</small>
          <strong>
            {compact(natural.reduce((sum, note) => sum + num(note.interactionCount), 0))}
          </strong>
          <p>当前筛选周期内</p>
        </article>
      </section>

      <section className="panel">
        <PanelHead eyebrow="OWNED × ORGANIC" title="发布与反馈联动分析" />
        <p className="metric-note">
          将发布进度表中的自有笔记与关键词扫描的自然内容按方向对齐，发现“用户正在讨论、我们还没覆盖”的内容缺口。
        </p>
        <div className="report-table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th>内容方向</th>
                <th>自有发布</th>
                <th>自然内容</th>
                <th>样本互动</th>
                <th>样本评论</th>
                <th>覆盖判断</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([direction, row]) => (
                <tr key={direction}>
                  <td>{direction}</td>
                  <td>{row.owned}</td>
                  <td>{row.natural}</td>
                  <td>{compact(row.interactions)}</td>
                  <td>{compact(row.comments)}</td>
                  <td>
                    <i className={'pill ' + (row.natural > row.owned ? 'warn-pill' : 'green-pill')}>
                      {row.natural > row.owned ? '值得补充' : '已有覆盖'}
                    </i>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <PanelHead eyebrow="RECENT PUBLICATIONS" title="自有发布与自然反馈" />
        <div className="publication-grid">
          {owned.slice(0, 12).map((note) => (
            <article key={note.id}>
              <small>
                {note.publishedAt ? cnTime(note.publishedAt) : '发布时间待补充'} · {noteDirection(note)}
              </small>
              <strong>{note.title || note.id}</strong>
              <dl>
                <div>
                  <dt>阅读</dt>
                  <dd>{num(note.readCount) > 0 ? compact(note.readCount) : '待同步'}</dd>
                </div>
                <div>
                  <dt>互动</dt>
                  <dd>{num(note.interactionCount) > 0 ? compact(note.interactionCount) : '待同步'}</dd>
                </div>
                <div>
                  <dt>评论</dt>
                  <dd>{num(note.commentTotal) > 0 ? compact(note.commentTotal) : (note.status === '待抓取' ? '待抓取' : '0')}</dd>
                </div>
                <div>
                  <dt>负面</dt>
                  <dd>{num(note.negativeCount) > 0 ? compact(note.negativeCount) : '0'}</dd>
                </div>
              </dl>
              <button onClick={() => openNote(note.id)}>查看内容与评论 →</button>
            </article>
          ))}
          {!owned.length && (
            <EmptyState
              title="尚未识别到自有发布笔记"
              text="请先在数据源或内容池中同步发布进度表。"
            />
          )}
        </div>
      </section>
    </div>
  );
}
