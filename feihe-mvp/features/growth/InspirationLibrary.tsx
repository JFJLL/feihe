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
              <div key={note.id}>
                <span>
                  <strong>{note.title || note.id}</strong>
                  <small>
                    {noteDirection(note)} · 互动 {compact(note.interactionCount)} · 评论{' '}
                    {display(note.commentTotal)}
                  </small>
                </span>
                {openNote && <button onClick={() => openNote(note.id)}>明细</button>}
                <button
                  className="primary"
                  disabled={growth.inspirations.some((item) => item.sourceNoteId === note.id)}
                  onClick={() => void addFromNote(note)}
                >
                  {growth.inspirations.some((item) => item.sourceNoteId === note.id)
                    ? '已沉淀'
                    : '沉淀灵感'}
                </button>
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
                .map((item) => (
                  <article key={item.id}>
                    <small>
                      {item.sourceType} · {item.keyword || '未关联关键词'}
                    </small>
                    <strong>{item.title}</strong>
                    <p>{item.reason || '尚未补充判断理由'}</p>
                    <div>
                      {item.sourceNoteId && openNote && (
                        <button onClick={() => openNote(item.sourceNoteId!)}>来源笔记</button>
                      )}
                      <button
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
                        推进
                      </button>
                      <button
                        className="danger-link"
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
                ))}
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
