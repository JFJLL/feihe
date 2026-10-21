import React, { useMemo } from 'react';
import type { IndustryV2Report, IndustryV2Note } from '../../lib/industry-v2-types';
import {
  SafeExternalLink,
  EmptyStateBox,
  formatMetricNumber,
} from './IndustryV2Widgets';

export function IndustryV2ActionsTab({
  report,
}: {
  report: IndustryV2Report;
}) {
  const { actions, notes } = report;

  // Notes map for evidence resolution
  const notesMap = useMemo(() => {
    const map = new Map<string, IndustryV2Note>();
    for (const n of notes) {
      map.set(n.noteId, n);
    }
    return map;
  }, [notes]);

  const highPriorityCount = actions.filter((a) => a.priority === 'high').length;
  const mediumPriorityCount = actions.filter((a) => a.priority === 'medium').length;

  return (
    <div className="v2-tab-content">
      {/* Aggregated priority summary */}
      <section className="v2-section" aria-label="行动机会概览">
        <div className="v2-grid-3">
          <div className="v2-kpi-card">
            <span className="v2-kpi-label">识别机会总数</span>
            <div className="v2-kpi-value-row">
              <span className="v2-kpi-value">{actions.length}</span>
              <span className="v2-kpi-unit">项</span>
            </div>
            <span className="v2-kpi-subtext">基于当前采样样本特征观察</span>
          </div>
          <div className="v2-kpi-card">
            <span className="v2-kpi-label">高优先级建议 (High)</span>
            <div className="v2-kpi-value-row">
              <span className="v2-kpi-value" style={{ color: '#b91c1c' }}>
                {highPriorityCount}
              </span>
              <span className="v2-kpi-unit">项</span>
            </div>
            <span className="v2-kpi-subtext">建议近期优先立项或重点优化</span>
          </div>
          <div className="v2-kpi-card">
            <span className="v2-kpi-label">中优先级建议 (Medium)</span>
            <div className="v2-kpi-value-row">
              <span className="v2-kpi-value" style={{ color: '#0369a1' }}>
                {mediumPriorityCount}
              </span>
              <span className="v2-kpi-unit">项</span>
            </div>
            <span className="v2-kpi-subtext">可持续跟进并按节奏排期尝试</span>
          </div>
        </div>
      </section>

      {/* Actions List */}
      <section className="v2-section" aria-label="行动清单">
        {actions.length === 0 ? (
          <EmptyStateBox message="暂无建议行动项。样本量充足后将自动归纳。" />
        ) : (
          <div className="v2-actions-list">
            {actions.map((act) => {
              const evidenceNotes: IndustryV2Note[] = [];
              for (const eid of act.evidenceIds || []) {
                const found = notesMap.get(eid);
                if (found) evidenceNotes.push(found);
              }

              return (
                <div key={act.id} className="v2-card v2-action-card">
                  <div className="v2-action-header">
                    <div className="v2-action-title-row">
                      <span
                        className={`v2-priority-badge ${
                          act.priority === 'high' ? 'priority-high' : 'priority-medium'
                        }`}
                      >
                        {act.priority === 'high' ? '🔥 高优先级' : '💡 中优先级'}
                      </span>
                      <h3 className="v2-action-title">{act.title}</h3>
                    </div>
                  </div>

                  <div className="v2-action-body">
                    <div className="v2-action-block">
                      <h4 className="v2-action-subhead">🔍 现象发现与样本观察</h4>
                      <p className="v2-action-desc">{act.finding}</p>
                    </div>

                    <div className="v2-action-block">
                      <h4 className="v2-action-subhead">🎯 建议行动方案</h4>
                      <p className="v2-action-desc action-suggestion">{act.suggestion}</p>
                    </div>

                    {act.basis && (
                      <div className="v2-action-block">
                        <h4 className="v2-action-subhead">📊 事实数据支撑与依据</h4>
                        <p className="v2-action-basis">{act.basis}</p>
                      </div>
                    )}

                    {evidenceNotes.length > 0 && (
                      <div className="v2-action-evidence-section">
                        <h4 className="v2-action-subhead">
                          📎 样本支撑笔记证据 ({evidenceNotes.length} 篇)
                        </h4>
                        <div className="v2-evidence-grid">
                          {evidenceNotes.map((ev) => (
                            <div key={ev.noteId} className="v2-evidence-card">
                              <SafeExternalLink
                                href={ev.url}
                                className="v2-evidence-title"
                                title={`安全打开原文：${ev.title}`}
                              >
                                {ev.title || '（无标题样本）'} ↗
                              </SafeExternalLink>
                              <div className="v2-evidence-meta">
                                <span>{ev.brand || '未知品牌'}</span>
                                <span>·</span>
                                <span>{ev.creatorName || '匿名博主'}</span>
                                <span>·</span>
                                <span>互动 {formatMetricNumber(ev.interactions)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
