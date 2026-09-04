'use client';

import Link from '../../components/ui/AppLink';
import type { Dashboard, GrowthSettings, GrowthKeyword, Note } from '../../lib/types/project';
import { PanelHead } from '../../components/ui/PanelHead';
import { compact, num, pct } from '../../lib/hooks/use-project-data';
import { isOwnedNote, keywordMatches } from './KeywordRadar';

function growthScore(note: Note, keywords: GrowthKeyword[]) {
  const parts: Array<{ value: number; weight: number }> = [];
  if (num(note.interactionCount) > 0) {
    parts.push({
      value: Math.min(100, (Math.log10(num(note.interactionCount) + 1) / 4) * 100),
      weight: 35,
    });
  }
  const conversion =
    num(note.exposure) > 0 ? num(note.readCount) / num(note.exposure) : null;
  if (conversion !== null) {
    parts.push({ value: Math.min(100, (conversion / 0.15) * 100), weight: 25 });
  }
  parts.push({
    value: keywords.some((item) => keywordMatches(note, item.keyword)) ? 90 : 40,
    weight: 20,
  });
  parts.push({
    value: note.productScope === '本品' || isOwnedNote(note) ? 90 : 58,
    weight: 20,
  });
  const totalWeight = parts.reduce((sum, item) => sum + item.weight, 0);
  return {
    score: Math.round(
      parts.reduce((sum, item) => sum + item.value * item.weight, 0) /
        Math.max(1, totalWeight)
    ),
    coverage: parts.length,
    conversion,
  };
}

export function SeedEngine({
  data,
  growth,
  save,
  openNote,
  projectId,
}: {
  data: Dashboard;
  growth: GrowthSettings;
  save: (next: GrowthSettings, message: string) => Promise<void>;
  openNote?: (id: string) => void;
  projectId: string;
}) {
  const candidates = data.notes
    .map((note) => ({ note, ...growthScore(note, growth.watchKeywords) }))
    .sort((a, b) => b.score - a.score);
  const selected = new Set(growth.seedNoteIds);

  return (
    <div className="stack">
      <section className="seed-explainer">
        <div>
          <small>SEED LOGIC</small>
          <strong>现阶段种子分 = 项目内容可证明的表现</strong>
          <p>
            按互动表现、阅读转化、观察关键词命中和本品适配加权；字段缺失时同步显示完整度。接入蒲公英和聚光后，再加入真实
            CTR、CPUV 与投放消耗。
          </p>
        </div>
        <dl>
          <div>
            <dt>自动入选参考线</dt>
            <dd>{growth.thresholds.seedScore} 分</dd>
          </div>
          <div>
            <dt>已加入种子池</dt>
            <dd>{growth.seedNoteIds.length} 篇</dd>
          </div>
          <div>
            <dt>真实投放字段</dt>
            <dd>待授权</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <PanelHead eyebrow="AUTO SEED" title="项目种子候选" />
        <div className="seed-table">
          <div className="seed-row header">
            <span>笔记</span>
            <span>建议分</span>
            <span>数据完整度</span>
            <span>互动</span>
            <span>阅读转化</span>
            <span>关键词</span>
            <span>种子池</span>
          </div>
          {candidates.slice(0, 30).map(({ note, score, coverage, conversion }) => (
            <div className="seed-row" key={note.id}>
              <span>
                <strong>{note.title || note.id}</strong>
                <small>
                  {note.author || '未知作者'} · {isOwnedNote(note) ? '自有发布' : '自然内容'}
                </small>
              </span>
              <span>
                <b
                  className={
                    score >= growth.thresholds.seedScore ? 'score-good' : 'score-normal'
                  }
                >
                  {score}
                </b>
              </span>
              <span>{coverage}/4</span>
              <span>{compact(note.interactionCount)}</span>
              <span>{conversion === null ? '—' : pct(conversion)}</span>
              <span>
                {growth.watchKeywords
                  .filter((item) => keywordMatches(note, item.keyword))
                  .map((item) => item.keyword)
                  .join('、') || '未命中'}
              </span>
              <span>
                <button
                  onClick={() =>
                    void save(
                      {
                        ...growth,
                        seedNoteIds: selected.has(note.id)
                          ? growth.seedNoteIds.filter((id) => id !== note.id)
                          : [...growth.seedNoteIds, note.id],
                      },
                      selected.has(note.id) ? '已移出种子池' : '已加入种子池'
                    )
                  }
                >
                  {selected.has(note.id) ? '移出' : '加入'}
                </button>
                {openNote && <button onClick={() => openNote(note.id)}>明细</button>}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="paid-pending">
        <div>
          <small>PAID VALIDATION</small>
          <h3>聚光投放验证区</h3>
          <p>
            CTR × CPUV 四象限需要真实投放数据。当前库中的 CPR/CPE 不会被冒充为 CPUV。
          </p>
        </div>
        <div className="paid-fields">
          <span>
            消耗<strong>待接入</strong>
          </span>
          <span>
            投放 CTR<strong>待接入</strong>
          </span>
          <span>
            CPUV<strong>待接入</strong>
          </span>
          <span>
            转化 / 加粉<strong>待接入</strong>
          </span>
        </div>
        <Link href={'/projects/' + encodeURIComponent(projectId) + '/settings?tab=integrations'}>
          配置聚光接口 →
        </Link>
      </section>
    </div>
  );
}
