import React, { useState, useEffect, useRef } from 'react';
import type { Note, NoteDetail } from '../../lib/types/project';
import { api, cnTime, pct } from '../../lib/hooks/use-project-data';

export type NoteDetailContext = 'content' | 'comments' | 'acceptance' | 'growth' | 'insights';

export function NoteDetailDrawer({
  detail,
  close,
  saveNote,
  removeNote,
  context = 'content',
  defaultTab,
}: {
  detail: NoteDetail;
  close: () => void;
  saveNote?: (note: Note) => void;
  removeNote?: (note: Note) => void;
  context?: NoteDetailContext;
  defaultTab?: 'basic' | 'performance' | 'comments' | 'acceptance';
}) {
  const n = detail.note;
  const [draft, setDraft] = useState(n);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationReason, setCalibrationReason] = useState('');
  const [calibrationSuccess, setCalibrationSuccess] = useState('');
  const drawerRef = useRef<HTMLElement>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);

  const initialTab = defaultTab || (
    context === 'comments' || context === 'acceptance' ? 'comments' :
    context === 'insights' ? 'performance' :
    'basic'
  );
  const [tab, setTab] = useState<'basic' | 'performance' | 'comments' | 'acceptance'>(initialTab);

  const allowEditStatus = context === 'acceptance';

  useEffect(() => {
    triggerElementRef.current = document.activeElement as HTMLElement | null;
    drawerRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      triggerElementRef.current?.focus();
    };
  }, [close]);

  async function handleCalibrateAcceptance() {
    if (!draft?.id || !draft.status) return;
    setCalibrating(true);
    setCalibrationSuccess('');
    try {
      await api('/api/resources', {
        method: 'POST',
        body: JSON.stringify({
          action: 'calibrate_acceptance',
          id: draft.id,
          status: draft.status,
          reason: calibrationReason || '人工验收校正',
        }),
      });
      setCalibrationSuccess('验收状态已校正并记入审计日志');
      if (saveNote) saveNote(draft);
    } catch (e) {
      alert(e instanceof Error ? e.message : '校正失败');
    } finally {
      setCalibrating(false);
    }
  }

  return (
    <div className="drawer-backdrop" onMouseDown={close}>
      <aside
        ref={drawerRef}
        tabIndex={-1}
        className="drawer"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ width: '520px', maxWidth: '92vw', outline: 'none' }}
      >
        <button type="button" className="drawer-close" onClick={close} aria-label="关闭抽屉">
          ×
        </button>
        <small style={{ color: '#0284c7', fontWeight: 700 }}>NOTE DETAIL</small>
        <h2 style={{ fontSize: '18px', marginTop: '4px', marginBottom: '8px' }}>{n?.title || n?.id || '笔记明细'}</h2>
        <p className="drawer-meta" style={{ fontSize: '12.5px', color: '#64748b' }}>
          {n?.author || '未知博主'} · {n?.status || '待抓取'} · 最近抓取 {cnTime(n?.lastFetchedAt)}
        </p>

        <nav className="ops-drawer-tabs" role="tablist" aria-label="明细标签">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'basic'}
            className={`ops-drawer-tab ${tab === 'basic' ? 'active' : ''}`}
            onClick={() => setTab('basic')}
          >
            基础资料
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'performance'}
            className={`ops-drawer-tab ${tab === 'performance' ? 'active' : ''}`}
            onClick={() => setTab('performance')}
          >
            内容表现
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'comments'}
            className={`ops-drawer-tab ${tab === 'comments' ? 'active' : ''}`}
            onClick={() => setTab('comments')}
          >
            评论监测
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'acceptance'}
            className={`ops-drawer-tab ${tab === 'acceptance' ? 'active' : ''}`}
            onClick={() => setTab('acceptance')}
          >
            验收与处置
          </button>
        </nav>

        {tab === 'basic' && (
          <div className="drawer-tab-content" role="tabpanel" aria-label="基础资料">
            {draft && (
              <section className="note-editor">
                <label>
                  标题
                  <input
                    value={draft.title || ''}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  />
                </label>
                <label>
                  博主
                  <input
                    value={draft.author || ''}
                    onChange={(e) => setDraft({ ...draft, author: e.target.value })}
                  />
                </label>
                <label>
                  笔记链接
                  <input
                    value={draft.url || ''}
                    onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                  />
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <label>
                    来源分类
                    <select
                      value={draft.sourceType || 'scan'}
                      onChange={(e) => setDraft({ ...draft, sourceType: e.target.value })}
                    >
                      <option value="owned">自有发布</option>
                      <option value="commercial">商业合作</option>
                      <option value="keyword_scan">关键词扫描</option>
                    </select>
                  </label>
                  <label>
                    产品范围
                    <select
                      value={draft.productScope || '本品'}
                      onChange={(e) => setDraft({ ...draft, productScope: e.target.value })}
                    >
                      <option value="本品">本品</option>
                      <option value="竞品">竞品</option>
                      <option value="其他">其他</option>
                    </select>
                  </label>
                </div>

                {allowEditStatus ? (
                  <label>
                    验收状态（人工校正）
                    <select
                      value={draft.status || '待抓取'}
                      onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                    >
                      <option value="待抓取">待抓取</option>
                      <option value="符合基础要求">符合基础要求</option>
                      <option value="符合且能汇报">符合且能汇报</option>
                      <option value="不够30条需补充">不够30条需补充</option>
                    </select>
                  </label>
                ) : (
                  <div style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 8px' }}>
                    验收状态：<strong>{draft.status || '待抓取'}</strong>（如需调整请在评论运营-交付验收中进行校正）
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  {saveNote && (
                    <button type="button" className="primary" onClick={() => saveNote(draft)}>
                      保存基础资料
                    </button>
                  )}
                  {removeNote && (
                    <button type="button" className="danger-link" onClick={() => removeNote(draft)}>
                      移出项目
                    </button>
                  )}
                </div>
              </section>
            )}
          </div>
        )}

        {tab === 'performance' && (
          <div className="drawer-tab-content" role="tabpanel" aria-label="内容表现">
            <section className="mini-kpis">
              <article>
                <p>阅读量</p>
                <strong>{n?.readCount ? Number(n.readCount).toLocaleString() : '—'}</strong>
                <span className="up">单篇总阅读</span>
              </article>
              <article>
                <p>互动量</p>
                <strong>{n?.interactionCount ? Number(n.interactionCount).toLocaleString() : '—'}</strong>
                <span className="up">赞藏评总计</span>
              </article>
              <article>
                <p>互动率</p>
                <strong>
                  {n?.readCount && n?.interactionCount
                    ? pct(Number(n.interactionCount) / Number(n.readCount))
                    : '—'}
                </strong>
                <span className="up">互动/阅读</span>
              </article>
            </section>

            <div style={{ marginTop: '16px', fontSize: '13px', display: 'grid', gap: '8px' }}>
              <div><strong>内容方向：</strong>{n?.category1 || '待补充'}</div>
              <div><strong>内容形式：</strong>{n?.noteType || '待补充'}</div>
              <div><strong>达人层级：</strong>{n?.creatorLevel || '待补充'}</div>
              <div><strong>点赞数：</strong>{n?.likeCount ?? '—'}</div>
              <div><strong>收藏数：</strong>{n?.favoriteCount ?? '—'}</div>
            </div>
          </div>
        )}

        {tab === 'comments' && (
          <div className="drawer-tab-content" role="tabpanel" aria-label="评论监测">
            <section className="mini-kpis">
              <article>
                <p>评论总数</p>
                <strong>{n?.commentTotal || 0}</strong>
                <span className="up">主评+楼中楼</span>
              </article>
              <article>
                <p>正向评论</p>
                <strong>{n?.positiveCount || 0}</strong>
                <span className="up">
                  {n?.commentTotal ? pct((n.positiveCount || 0) / n.commentTotal) : '—'}
                </span>
              </article>
              <article>
                <p>负向/问询</p>
                <strong>{(n?.negativeCount || 0) + (n?.questionCount || 0)}</strong>
                <span className="danger">重点复查</span>
              </article>
            </section>

            <h3 style={{ fontSize: '14px', marginTop: '16px', marginBottom: '8px' }}>抓取指标快照</h3>
            <div className="snapshot-list">
              {detail.snapshots && detail.snapshots.length ? (
                detail.snapshots.map((x) => (
                  <div key={x.capturedAt}>
                    <time>{cnTime(x.capturedAt)}</time>
                    <span>主评 {x.l1Count}</span>
                    <span>楼中楼 {x.l2Count}</span>
                    <b>合计 {x.totalCount}</b>
                  </div>
                ))
              ) : (
                <div className="empty">暂无历史快照</div>
              )}
            </div>
          </div>
        )}

        {tab === 'acceptance' && (
          <div className="drawer-tab-content" role="tabpanel" aria-label="验收与处置">
            <div style={{ marginBottom: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px', fontSize: '13px' }}>
              <div><strong>当前验收状态：</strong>{n?.status || '待抓取'}</div>
              <div><strong>前5主评品牌提及率：</strong>{pct(n?.brandMentionTop5 || 0)}</div>
            </div>

            {allowEditStatus && (
              <div style={{ margin: '16px 0', padding: '14px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <strong style={{ fontSize: '13.5px', color: '#166534' }}>人工验收校正（独立审计归档）</strong>
                <div style={{ display: 'grid', gap: '8px', marginTop: '8px' }}>
                  <label style={{ fontSize: '12px', color: '#15803d' }}>
                    校正验收结果
                    <select
                      value={draft?.status || '待抓取'}
                      onChange={(e) => setDraft((prev) => (prev ? { ...prev, status: e.target.value } : prev))}
                    >
                      <option value="待抓取">待抓取</option>
                      <option value="符合基础要求">符合基础要求</option>
                      <option value="符合且能汇报">符合且能汇报</option>
                      <option value="需补充">需补充</option>
                    </select>
                  </label>
                  <label style={{ fontSize: '12px', color: '#15803d' }}>
                    校正原因说明
                    <input
                      placeholder="例如：人工复核前5条主评品牌提及达标"
                      value={calibrationReason}
                      onChange={(e) => setCalibrationReason(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="primary"
                    disabled={calibrating}
                    style={{ background: '#16a34a', borderColor: '#15803d', fontSize: '12.5px', padding: '6px 12px' }}
                    onClick={handleCalibrateAcceptance}
                  >
                    {calibrating ? '校正提交中…' : '提交人工验收校正'}
                  </button>
                  {calibrationSuccess && (
                    <span style={{ fontSize: '12px', color: '#15803d' }}>✓ {calibrationSuccess}</span>
                  )}
                </div>
              </div>
            )}

            <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>需处置关键评论</h3>
            <div className="drawer-comments">
              {detail.comments && detail.comments.length ? (
                detail.comments.map((x) => (
                  <article key={x.id}>
                    <span>{x.sentiment} · {x.category}</span>
                    <p>{x.content}</p>
                    <small>{x.action} · {x.treatmentStatus}</small>
                  </article>
                ))
              ) : (
                <div className="empty">暂无需处置的关键评论</div>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
