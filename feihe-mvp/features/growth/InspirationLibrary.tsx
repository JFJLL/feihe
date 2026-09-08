'use client';

import { useState } from 'react';
import type { Dashboard, GrowthSettings, Note } from '../../lib/types/project';
import { PanelHead } from '../../components/ui/PanelHead';
import { EmptyState } from '../../components/ui/EmptyState';
import { compact, num } from '../../lib/hooks/use-project-data';
import { keywordMatches, noteDirection } from './KeywordRadar';
import { GrowthSampleBoard } from './GrowthSampleBoard';
import { MetricCard } from '../../components/ui/operations/MetricCard';
import { display, percent, ratio } from './metrics';
import { NoteThumbnail } from '../../components/ui/NoteThumbnail';

export function InspirationLibrary({
  data,
  growth,
  save,
  openNote,
}: {
  data: Dashboard;
  growth: GrowthSettings;
  save: (next: GrowthSettings, message: string) => Promise<void>;
  openNote?: (id: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [keyword, setKeyword] = useState('');
  const [reason, setReason] = useState('');

  const auto = data.notes
    .filter((note) => num(note.interactionCount) > growth.thresholds.breakoutInteractions)
    .sort((a, b) => num(b.interactionCount) - num(a.interactionCount));

  async function addFromNote(note: Note) {
    if (growth.inspirations.some((item) => item.sourceNoteId === note.id)) return;
    await save(
      {
        ...growth,
        inspirations: [
          {
            id: 'idea-' + Date.now(),
            title: note.title || '来自 ' + (note.author || note.id) + ' 的内容灵感',
            keyword:
              growth.watchKeywords.find((item) => keywordMatches(note, item.keyword))?.keyword ||
              noteDirection(note),
            stage: '候选',
            reason:
              '项目高热样本：互动 ' +
              num(note.interactionCount).toLocaleString() +
              '，评论 ' +
              display(note.commentTotal),
            sourceNoteId: note.id,
            sourceType: '项目高热',
            owner: '',
          },
          ...growth.inspirations,
        ],
      },
      '已从高热笔记沉淀一条灵感'
    );
  }

  async function addManual() {
    if (!title.trim()) return;
    await save(
      {
        ...growth,
        inspirations: [
          {
            id: 'idea-' + Date.now(),
            title: title.trim(),
            keyword: keyword.trim(),
            stage: '候选',
            reason: reason.trim(),
            sourceType: '人工维护',
            owner: '',
          },
          ...growth.inspirations,
        ],
      },
      '人工灵感已保存'
    );
    setTitle('');
    setKeyword('');
    setReason('');
  }

  const stages = ['候选', '选题池', '已采纳', '已发布'];

  return (
    <div className="stack">
      <div className="reference-daily-grid">
        {stages.map((stage, i) => <MetricCard key={stage} label={stage} value={growth.inspirations.filter(item => item.stage === stage).length} unit="条" theme={(['blue', 'teal', 'purple', 'green'] as const)[i]} desc={'当前阶段占比 ' + percent(ratio(growth.inspirations.filter(item => item.stage === stage).length, growth.inspirations.length)) + ' · 非历史转化率'} />)}
      </div>
      <GrowthSampleBoard notes={data.notes} threshold={growth.thresholds.breakoutInteractions} />
      <section className="inspiration-split">
        <article className="panel">
          <PanelHead eyebrow="PLATFORM SIGNAL" title="项目高热灵感" />
          <p className="metric-note">
            取自本次载入笔记中超过互动阈值的样本，展示前 10 条；可查看来源并沉淀选题。
          </p>
          <div className="idea-source-list">
            {auto.slice(0, 10).map((note) => (
              <div key={note.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
                <NoteThumbnail
                  src={note.coverUrl}
                  title={note.title}
                  author={note.author}
                  category={noteDirection(note)}
                />
                </div>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: 'block', fontSize: '13px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {note.title || note.id}
                  </strong>
                  <small style={{ display: 'block', fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                    {noteDirection(note)} · 互动 {compact(note.interactionCount)} · 评论 {display(note.commentTotal)}
                  </small>
                </span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                  {openNote && <button type="button" className="subtle-btn" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => openNote(note.id)}>明细</button>}
                  <button
                    type="button"
                    className="primary"
                    style={{ padding: '4px 10px', fontSize: '12px' }}
                    disabled={growth.inspirations.some((item) => item.sourceNoteId === note.id)}
                    onClick={() => void addFromNote(note)}
                  >
                    {growth.inspirations.some((item) => item.sourceNoteId === note.id)
                      ? '已沉淀'
                      : '沉淀灵感'}
                  </button>
                </div>
              </div>
            ))}
            {!auto.length && <EmptyState title="暂无高热样本" text="当前项目暂无达到爆文阈值的笔记。" />}
          </div>
        </article>

        <article className="panel manual-idea">
          <PanelHead eyebrow="CURATED IDEA" title="人工补充灵感" />
          <label>
            灵感标题
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="如：换奶期宝宝适应过程记录"
            />
          </label>
          <label>
            关联关键词
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="如：转奶、肠胃适应"
            />
          </label>
          <label>
            判断理由
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="记录来源、受众、可复用结构和为什么值得做"
            />
          </label>
          <button
            className="primary wide"
            disabled={!title.trim()}
            onClick={() => void addManual()}
          >
            保存到灵感库
          </button>
        </article>
      </section>

      <section className="panel">
        <PanelHead eyebrow="IDEA PIPELINE" title="灵感与选题流转" />
        <div className="idea-board">
          {stages.map((stage) => (
            <section key={stage}>
              <header>
                <strong>{stage}</strong>
                <span>{growth.inspirations.filter((item) => item.stage === stage).length}</span>
              </header>
              {growth.inspirations
                .filter((item) => item.stage === stage)
                .map((item) => {
                  const srcNote = item.sourceNoteId ? data.notes.find((n) => n.id === item.sourceNoteId) : null;
                  return (
                  <article key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {srcNote && (
                        <div style={{ width: '36px', height: '36px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0 }}>
                        <NoteThumbnail
                          src={srcNote.coverUrl}
                          title={srcNote.title}
                          author={srcNote.author}
                          category={noteDirection(srcNote)}
                        />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span className="section-mini-tag tag-blue" style={{ fontSize: '10px', padding: '1px 6px' }}>{item.sourceType}</span>
                          {item.keyword && <span className="section-mini-tag tag-teal" style={{ fontSize: '10px', padding: '1px 6px' }}>{item.keyword}</span>}
                          <span className="section-mini-tag tag-purple" style={{ fontSize: '10px', padding: '1px 6px' }}>{item.stage}</span>
                        </div>
                        <strong style={{ display: 'block', fontSize: '13px', marginTop: '4px', color: '#0f172a' }}>{item.title}</strong>
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>{item.reason || '尚未补充判断理由'}</p>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                      {item.sourceNoteId && openNote && (
                        <button type="button" className="subtle-btn" style={{ padding: '3px 8px', fontSize: '11.5px' }} onClick={() => openNote(item.sourceNoteId!)}>来源笔记</button>
                      )}
                      <button
                        type="button"
                        className="subtle-btn"
                        style={{ padding: '3px 8px', fontSize: '11.5px', color: '#0284c7' }}
                        onClick={() => {
                          const next = stages[Math.min(stages.length - 1, stages.indexOf(stage) + 1)];
                          void save(
                            {
                              ...growth,
                              inspirations: growth.inspirations.map((idea) =>
                                idea.id === item.id ? { ...idea, stage: next } : idea
                              ),
                            },
                            '灵感已流转至“' + next + '”'
                          );
                        }}
                        disabled={stage === '已发布'}
                      >
                        推进 ➔
                      </button>
                      <button
                        type="button"
                        className="danger-link"
                        style={{ padding: '3px 6px', fontSize: '11.5px', marginLeft: 'auto' }}
                        onClick={() =>
                          void save(
                            {
                              ...growth,
                              inspirations: growth.inspirations.filter(
                                (idea) => idea.id !== item.id
                              ),
                            },
                            '灵感已移除'
                          )
                        }
                      >
                        删除
                      </button>
                    </div>
                  </article>
                  );
                })}
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
