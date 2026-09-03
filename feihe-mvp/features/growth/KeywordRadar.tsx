'use client';

import { useState } from 'react';
import type { Dashboard, GrowthSettings, Rules, Note } from '../../lib/types/project';
import { PanelHead } from '../../components/ui/PanelHead';
import { EmptyState } from '../../components/ui/EmptyState';
import { compact, num } from '../../lib/hooks/use-project-data';
import { LingxiTrackLive } from '../../app/lingxi-track';

function noteSearchText(note: Note) {
  return [note.title, note.author, note.category1, note.category2, note.brand, note.productScope]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function keywordMatches(note: Note, keyword: string) {
  return Boolean(keyword) && noteSearchText(note).includes(keyword.trim().toLowerCase());
}

export function isOwnedNote(note: Note) {
  return note.sourceType === 'owned' || note.sourceType === '自有发布' || note.sourceType === '商业笔记';
}

export function noteDirection(note: Note) {
  return note.category1 || note.category2 || note.brand || '待补充内容方向';
}

export function KeywordRadar({
  data,
  growth,
  rules,
  save,
  openNote,
  projectId,
  toast,
}: {
  data: Dashboard;
  growth: GrowthSettings;
  rules: Rules;
  save: (next: GrowthSettings, message: string) => Promise<void>;
  openNote?: (id: string) => void;
  projectId: string;
  toast?: (v: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [dataView, setDataView] = useState<'project' | 'lingxi'>('project');
  const [draft, setDraft] = useState('');
  const [scope, setScope] = useState('本品');
  const [threshold, setThreshold] = useState(growth.thresholds.breakoutInteractions);

  const suggested = [...rules.brands, ...rules.competitors]
    .filter((word) => !growth.watchKeywords.some((item) => item.keyword === word))
    .slice(0, 8);

  async function add(keyword = draft) {
    const value = keyword.trim();
    if (!value) return;
    await save(
      {
        ...growth,
        watchKeywords: [
          ...growth.watchKeywords,
          {
            id: 'kw-' + Date.now(),
            keyword: value,
            scope,
            source: '项目内容库',
            status: 'tracking',
            priority: 3,
          },
        ],
      },
      '已开始观察“' + value + '”'
    );
    setDraft('');
  }

  const rows = growth.watchKeywords.map((item) => {
    const matches = data.notes.filter((note) => keywordMatches(note, item.keyword));
    const breakout = matches.filter(
      (note) => num(note.interactionCount) > growth.thresholds.breakoutInteractions
    );
    return {
      item,
      matches,
      breakout,
      interactions: matches.reduce((sum, note) => sum + num(note.interactionCount), 0),
      comments: matches.reduce((sum, note) => sum + num(note.commentTotal), 0),
    };
  });

  const hotNotes = data.notes
    .filter((note) => num(note.interactionCount) > growth.thresholds.breakoutInteractions)
    .sort((a, b) => num(b.interactionCount) - num(a.interactionCount));

  return (
    <div className="stack">
      {/* View Switcher: Project Notes vs Lingxi Realtime Industry */}
      <div className="view-toggle-bar" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          className={'primary ' + (dataView === 'project' ? '' : 'subtle-btn')}
          style={dataView !== 'project' ? { background: '#ffffff', color: '#475569', borderColor: '#cbd5e1' } : {}}
          onClick={() => setDataView('project')}
        >
          📊 项目内容机会
        </button>
        <button
          className={'primary ' + (dataView === 'lingxi' ? '' : 'subtle-btn')}
          style={dataView !== 'lingxi' ? { background: '#ffffff', color: '#475569', borderColor: '#cbd5e1' } : {}}
          onClick={() => setDataView('lingxi')}
        >
          🌐 灵犀行业大盘（实时）
        </button>
      </div>

      {dataView === 'lingxi' ? (
        <LingxiTrackLive projectId={projectId} toast={toast || (() => undefined)} />
      ) : (
        <>
          <section className="panel keyword-control" id="growth-keywords">
            <div>
              <PanelHead eyebrow="WATCHLIST" title="关键词观察清单" />
              <p style={{ margin: '4px 0 12px', color: 'var(--text-muted)', fontSize: '13px' }}>
                计算项目内容库中匹配关键词的笔记、互动量与爆文样本；平台搜索趋势需接入趋势数据源后显示。
              </p>
            </div>
            <div className="keyword-add">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void add();
                }}
                placeholder="输入品牌词、场景词或痛点词"
              />
              <select value={scope} onChange={(e) => setScope(e.target.value)}>
                <option>本品</option>
                <option>竞品</option>
                <option>场景</option>
                <option>痛点</option>
              </select>
              <button className="primary" onClick={() => void add()}>
                加入观察
              </button>
            </div>
            {!growth.watchKeywords.length && (
              <div className="keyword-suggestions">
                <span>建议从项目词库开始：</span>
                {suggested.map((word) => (
                  <button key={word} onClick={() => void add(word)}>
                    ＋ {word}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="growth-kpis">
            <article>
              <small>观察关键词</small>
              <strong>{growth.watchKeywords.length}</strong>
              <p>由当前项目独立维护</p>
            </article>
            <article>
              <small>匹配笔记</small>
              <strong>{new Set(rows.flatMap((row) => row.matches.map((n) => n.id))).size}</strong>
              <p>标题、方向、品牌命中</p>
            </article>
            <article>
              <small>爆文样本</small>
              <strong>{hotNotes.length}</strong>
              <p>互动量 &gt; {growth.thresholds.breakoutInteractions.toLocaleString()}</p>
            </article>
            <article className="pending">
              <small>平台实时增速</small>
              <strong>—</strong>
              <p>待接入 RedTrend 趋势源</p>
            </article>
          </section>

          <section className="panel threshold-strip">
            <div>
              <strong>爆文判断阈值</strong>
              <p>只影响项目库内高热样本判断，不等同于官方全网爆文口径。</p>
            </div>
            <label>
              互动量超过
              <input
                type="number"
                min="1"
                value={threshold}
                onChange={(e) => setThreshold(num(e.target.value))}
              />
            </label>
            <button
              onClick={() =>
                void save(
                  {
                    ...growth,
                    thresholds: {
                      ...growth.thresholds,
                      breakoutInteractions: Math.max(1, threshold),
                    },
                  },
                  '爆文判断阈值已更新'
                )
              }
            >
              保存阈值
            </button>
          </section>

          <section className="panel">
            <PanelHead eyebrow="KEYWORD RADAR" title="关键词机会明细" />
            <div className="keyword-table">
              <div className="keyword-row header">
                <span>关键词 / 范围</span>
                <span>项目匹配笔记</span>
                <span>爆文样本</span>
                <span>样本互动</span>
                <span>样本评论</span>
                <span>平台环比</span>
                <span>操作</span>
              </div>
              {rows.length ? (
                rows.map(({ item, matches, breakout, interactions, comments }) => (
                  <div className="keyword-row" key={item.id}>
                    <span>
                      <strong>{item.keyword}</strong>
                      <small>
                        {item.scope} · {item.source}
                      </small>
                    </span>
                    <span>{matches.length}</span>
                    <span>{breakout.length}</span>
                    <span>{compact(interactions)}</span>
                    <span>{compact(comments)}</span>
                    <span>
                      <i className="pending-pill">待接入</i>
                    </span>
                    <span>
                      <button
                        onClick={() =>
                          void save(
                            {
                              ...growth,
                              watchKeywords: growth.watchKeywords.filter(
                                (kw) => kw.id !== item.id
                              ),
                            },
                            '观察关键词已移除'
                          )
                        }
                      >
                        移除
                      </button>
                    </span>
                  </div>
                ))
              ) : (
                <EmptyState title="尚未设置观察关键词" text="添加关键词后将自动计算匹配笔记与机会明细。" />
              )}
            </div>
          </section>

          <section className="panel">
            <PanelHead eyebrow="BREAKOUT NOTES" title="项目高热笔记样本" />
            <div className="hot-note-grid">
              {hotNotes.slice(0, 12).map((note) => (
                <article key={note.id}>
                  <div>
                    {note.coverUrl ? (
                      <img src={note.coverUrl} alt="" />
                    ) : (
                      <span>{(note.author || '笔').slice(0, 1)}</span>
                    )}
                    <i>{isOwnedNote(note) ? '自有发布' : '自然内容'}</i>
                  </div>
                  <strong>{note.title || note.id}</strong>
                  <p>
                    {noteDirection(note)} · {note.author || '未知作者'}
                  </p>
                  <dl>
                    <div>
                      <dt>互动</dt>
                      <dd>{compact(note.interactionCount)}</dd>
                    </div>
                    <div>
                      <dt>评论</dt>
                      <dd>{compact(note.commentTotal)}</dd>
                    </div>
                    <div>
                      <dt>阅读</dt>
                      <dd>{compact(note.readCount)}</dd>
                    </div>
                  </dl>
                  {openNote && (
                    <button onClick={() => openNote(note.id)}>查看笔记明细 →</button>
                  )}
                </article>
              ))}
              {!hotNotes.length && (
                <EmptyState
                  title="暂无高热笔记"
                  text="当前筛选周期内暂未发现达到爆文阈值的笔记，可调整阈值或同步更多数据。"
                />
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
